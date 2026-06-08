"""
Voice-Crafter Detection Tasks (Celery)
Background processing for file-based deepfake detection.
"""

import asyncio
import hashlib
import json
import logging
import os
import tempfile
import time
from datetime import datetime, timezone
from typing import Optional

from app.workers.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="detection.run",
    max_retries=settings.CELERY_MAX_RETRIES,
    soft_time_limit=3600,
    time_limit=3900,
)
def run_detection_task(
    self,
    job_id: str,
    user_id: str,
    storage_key: str,
    enable_diarization: bool = True,
    confidence_threshold: float = 0.65,
):
    """
    Run deepfake detection on an uploaded audio file.
    Downloads from storage, runs pipeline, saves results to DB.
    """
    return asyncio.get_event_loop().run_until_complete(
        _run_detection_async(
            task=self,
            job_id=job_id,
            user_id=user_id,
            storage_key=storage_key,
            enable_diarization=enable_diarization,
            confidence_threshold=confidence_threshold,
        )
    )


async def _run_detection_async(
    task,
    job_id: str,
    user_id: str,
    storage_key: str,
    enable_diarization: bool,
    confidence_threshold: float,
):
    """Async implementation of detection task."""
    from app.database import SessionLocal
    from app.models import DetectionJob, JobStatus, AuditLog, AuditAction, Notification, NotificationType
    from app.utils.storage import get_storage
    from app.ml.detection_pipeline import get_detection_pipeline

    async with SessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(DetectionJob).where(DetectionJob.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            logger.error(f"Detection job {job_id} not found")
            return

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

    tmp_path = None
    try:
        # Download file from storage
        storage = await get_storage()
        audio_bytes = await storage.download(settings.BUCKET_UPLOADS, storage_key)

        # Save to temp file
        suffix = "." + storage_key.rsplit(".", 1)[-1] if "." in storage_key else ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        # Build progress callback
        progress_steps = []

        async def progress_cb(pct: int, msg: str):
            progress_steps.append((pct, msg))
            async with SessionLocal() as db:
                from sqlalchemy import select
                res = await db.execute(select(DetectionJob).where(DetectionJob.id == job_id))
                j = res.scalar_one_or_none()
                if j:
                    j.progress = pct / 100.0
                    j.progress_message = msg
                    await db.commit()

        # Run pipeline
        pipeline = get_detection_pipeline()
        detection_result = await pipeline.analyze_file(
            audio_path=tmp_path,
            confidence_threshold=confidence_threshold,
            enable_diarization=enable_diarization,
            progress_callback=progress_cb,
        )

        # Compute evidence hash
        evidence_data = json.dumps({
            "job_id": job_id,
            "verdict": detection_result.verdict,
            "ensemble_confidence": detection_result.ensemble_confidence,
            "model_scores": detection_result.model_scores,
            "segments": detection_result.segments,
        }, sort_keys=True, default=str)
        evidence_hash = hashlib.sha256(evidence_data.encode()).hexdigest()

        # Save results
        async with SessionLocal() as db:
            from sqlalchemy import select
            result = await db.execute(select(DetectionJob).where(DetectionJob.id == job_id))
            job = result.scalar_one_or_none()

            if job:
                job.status = JobStatus.COMPLETED
                job.progress = 1.0
                job.verdict = detection_result.verdict
                job.ensemble_confidence = detection_result.ensemble_confidence
                job.is_synthetic = detection_result.is_synthetic
                job.risk_score = detection_result.risk_score
                job.aasist_score = detection_result.model_scores.get("aasist")
                job.rawnet2_score = detection_result.model_scores.get("rawnet2")
                job.prosodic_score = detection_result.model_scores.get("prosodic")
                job.spectral_score = detection_result.model_scores.get("spectral")
                job.glottal_score = detection_result.model_scores.get("glottal")
                job.segments = detection_result.segments
                job.suspicious_segments = detection_result.suspicious_segments
                job.confidence_timeline = detection_result.confidence_timeline
                job.speakers = detection_result.speakers
                job.flagged_reasons = detection_result.flagged_reasons
                job.explanation = detection_result.explanation
                job.duration_seconds = detection_result.duration_seconds
                job.processing_time_ms = detection_result.processing_time_ms
                job.evidence_hash = evidence_hash
                job.model_versions = detection_result.model_versions
                job.diarization_completed = enable_diarization and len(detection_result.speakers) > 0
                job.completed_at = datetime.now(timezone.utc)

                # Add to chain of custody
                existing_coc = job.chain_of_custody or []
                existing_coc.append({
                    "event": "analysis_complete",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "verdict": detection_result.verdict,
                    "evidence_hash": evidence_hash,
                    "model_versions": detection_result.model_versions,
                    "processing_time_ms": detection_result.processing_time_ms,
                })
                job.chain_of_custody = existing_coc

                await db.commit()

            # Audit log
            db.add(AuditLog(
                user_id=user_id,
                action=AuditAction.DETECTION_COMPLETE,
                resource_type="detection_job",
                resource_id=job_id,
                details={
                    "verdict": detection_result.verdict,
                    "is_synthetic": detection_result.is_synthetic,
                    "confidence": detection_result.ensemble_confidence,
                    "evidence_hash": evidence_hash,
                },
            ))

            # Create notification
            is_alert = detection_result.is_synthetic
            db.add(Notification(
                user_id=user_id,
                type=NotificationType.DETECTION_ALERT if is_alert else NotificationType.GENERATION_COMPLETE,
                title="Detection Complete" + (" ⚠️ Synthetic Audio Detected" if is_alert else " ✅ Audio Authentic"),
                message=(
                    f"Analysis complete. Verdict: {detection_result.verdict.replace('_', ' ').title()}. "
                    f"Confidence: {detection_result.ensemble_confidence:.1%}. "
                    f"{'Suspicious segments found.' if detection_result.suspicious_segments else 'No suspicious segments.'}"
                ),
                action_url=f"/detection/{job_id}",
                metadata={"job_id": job_id, "verdict": detection_result.verdict},
            ))
            await db.commit()

        # Update usage
        await _update_usage(user_id, detection_result.duration_seconds)

        logger.info(
            f"Detection complete: job={job_id} verdict={detection_result.verdict} "
            f"confidence={detection_result.ensemble_confidence:.3f} "
            f"duration={detection_result.duration_seconds:.1f}s "
            f"processing={detection_result.processing_time_ms}ms"
        )

    except Exception as exc:
        logger.error(f"Detection task failed: job={job_id} error={exc}", exc_info=True)

        async with SessionLocal() as db:
            from sqlalchemy import select
            result = await db.execute(select(DetectionJob).where(DetectionJob.id == job_id))
            job = result.scalar_one_or_none()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc)[:1000]
                job.completed_at = datetime.now(timezone.utc)
                await db.commit()

            # Notify failure
            db.add(Notification(
                user_id=user_id,
                type=NotificationType.CLONE_FAILED,
                title="Detection Failed",
                message=f"Detection analysis failed: {str(exc)[:200]}",
                action_url=f"/detection/{job_id}",
            ))
            await db.commit()

        # Retry if appropriate
        if task.request.retries < task.max_retries:
            raise task.retry(exc=exc, countdown=60 * (task.request.retries + 1))
        raise

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


async def _update_usage(user_id: str, duration_seconds: float):
    """Update detection usage record for the user."""
    from app.database import SessionLocal
    from app.models import UsageRecord
    from sqlalchemy import select
    from datetime import datetime

    month_year = datetime.now().strftime("%Y-%m")
    minutes = duration_seconds / 60.0

    async with SessionLocal() as db:
        result = await db.execute(
            select(UsageRecord).where(
                UsageRecord.user_id == user_id,
                UsageRecord.month_year == month_year,
                UsageRecord.resource_type == "detection_minutes",
            )
        )
        record = result.scalar_one_or_none()
        if record:
            record.quantity += minutes
        else:
            db.add(UsageRecord(
                user_id=user_id,
                month_year=month_year,
                resource_type="detection_minutes",
                quantity=minutes,
                unit="minutes",
            ))
        await db.commit()
