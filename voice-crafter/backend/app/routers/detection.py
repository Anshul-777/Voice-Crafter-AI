"""
Voice-Crafter Detection Router
Deepfake detection: file upload, real-time, batch, evidence export.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from typing import Optional, List
import uuid, io, json, hashlib, logging
from datetime import datetime, timezone

from app.database import get_db
from app.models import (
    User, DetectionJob, JobStatus, DetectionVerdict,
    UploadedFile, AuditLog, AuditAction, Notification, NotificationType,
    UsageRecord
)
from app.services.auth_service import get_current_user
from app.services.entitlement_service import check_detection_quota
from app.workers.detection_tasks import run_detection_task
from app.utils.storage import get_storage
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class DetectionStartResponse(BaseModel):
    job_id: str
    status: str
    message: str


class DetectionResultResponse(BaseModel):
    job_id: str
    status: str
    verdict: Optional[str]
    ensemble_confidence: Optional[float]
    is_synthetic: Optional[bool]
    risk_score: Optional[float]
    model_scores: dict
    segments: list
    suspicious_segments: list
    confidence_timeline: list
    speakers: list
    flagged_reasons: list
    explanation: Optional[str]
    analyst_notes: Optional[str]
    duration_seconds: Optional[float]
    processing_time_ms: Optional[int]
    evidence_hash: Optional[str]
    created_at: datetime


@router.post("/analyze", response_model=DetectionStartResponse)
async def analyze_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    confidence_threshold: float = Query(default=0.65, ge=0.0, le=1.0),
    enable_diarization: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an audio file for deepfake detection analysis.
    Returns a job ID to poll for results.
    """
    # Validate file format
    filename = file.filename or "upload.wav"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in settings.SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(settings.SUPPORTED_AUDIO_FORMATS)}"
        )

    # Check file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    # Check quota
    await check_detection_quota(current_user, db)

    # Compute hash for chain of custody
    file_hash = hashlib.sha256(content).hexdigest()

    # Store file
    storage = await get_storage()
    storage_key = f"detection/{current_user.id}/{uuid.uuid4()}.{ext}"
    await storage.upload(settings.BUCKET_UPLOADS, storage_key, content, content_type=file.content_type)

    # Create upload record
    upload_record = UploadedFile(
        user_id=current_user.id,
        storage_key=storage_key,
        original_filename=filename,
        content_type=file.content_type or f"audio/{ext}",
        file_size_bytes=len(content),
        sha256_hash=file_hash,
        purpose="detection",
        status="pending",
    )
    db.add(upload_record)
    await db.flush()

    # Create detection job
    job = DetectionJob(
        user_id=current_user.id,
        status=JobStatus.QUEUED,
        mode="file",
        input_storage_key=storage_key,
        original_filename=filename,
        input_hash=file_hash,
        confidence_threshold=confidence_threshold,
        chain_of_custody=[{
            "event": "file_received",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hash": file_hash,
            "user_id": current_user.id,
            "filename": filename,
            "size_bytes": len(content),
        }],
    )
    db.add(job)
    await db.flush()

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.DETECTION_START,
        resource_type="detection_job",
        resource_id=job.id,
        details={"filename": filename, "size_mb": round(size_mb, 2), "hash": file_hash},
    ))
    await db.commit()

    # Dispatch Celery task
    task = run_detection_task.delay(
        job_id=job.id,
        user_id=current_user.id,
        storage_key=storage_key,
        enable_diarization=enable_diarization and settings.DIARIZATION_ENABLED,
        confidence_threshold=confidence_threshold,
    )

    # Update job with celery task id
    job.celery_task_id = task.id
    await db.commit()

    return DetectionStartResponse(
        job_id=job.id,
        status="queued",
        message="Detection job queued. Poll /detection/{job_id} for results.",
    )


@router.get("/{job_id}", response_model=DetectionResultResponse)
async def get_detection_result(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detection job result and status."""
    result = await db.execute(
        select(DetectionJob).where(
            DetectionJob.id == job_id,
            DetectionJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Detection job not found")

    return DetectionResultResponse(
        job_id=job.id,
        status=job.status,
        verdict=job.verdict,
        ensemble_confidence=job.ensemble_confidence,
        is_synthetic=job.is_synthetic,
        risk_score=job.risk_score,
        model_scores={
            "aasist": job.aasist_score,
            "rawnet2": job.rawnet2_score,
            "prosodic": job.prosodic_score,
            "spectral": job.spectral_score,
            "glottal": job.glottal_score,
        },
        segments=job.segments or [],
        suspicious_segments=job.suspicious_segments or [],
        confidence_timeline=job.confidence_timeline or [],
        speakers=job.speakers or [],
        flagged_reasons=job.flagged_reasons or [],
        explanation=job.explanation,
        analyst_notes=job.analyst_notes,
        duration_seconds=job.duration_seconds,
        processing_time_ms=job.processing_time_ms,
        evidence_hash=job.evidence_hash,
        created_at=job.created_at,
    )


@router.get("/")
async def list_detection_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None),
    verdict_filter: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's detection jobs with pagination."""
    query = select(DetectionJob).where(DetectionJob.user_id == current_user.id)

    if status_filter:
        query = query.where(DetectionJob.status == status_filter)
    if verdict_filter:
        query = query.where(DetectionJob.verdict == verdict_filter)

    query = query.order_by(desc(DetectionJob.created_at))

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    jobs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "verdict": j.verdict,
                "ensemble_confidence": j.ensemble_confidence,
                "is_synthetic": j.is_synthetic,
                "risk_score": j.risk_score,
                "original_filename": j.original_filename,
                "duration_seconds": j.duration_seconds,
                "progress": j.progress,
                "created_at": j.created_at,
                "completed_at": j.completed_at,
            }
            for j in jobs
        ],
    }


@router.patch("/{job_id}/notes")
async def update_analyst_notes(
    job_id: str,
    notes: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or update analyst notes on a detection result."""
    result = await db.execute(
        select(DetectionJob).where(DetectionJob.id == job_id, DetectionJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if len(notes) > 5000:
        raise HTTPException(status_code=400, detail="Notes cannot exceed 5000 characters")

    job.analyst_notes = notes
    await db.commit()

    return {"message": "Notes updated", "analyst_notes": notes}


@router.get("/{job_id}/evidence")
async def get_evidence_report(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get chain-of-custody evidence report for a detection job."""
    result = await db.execute(
        select(DetectionJob).where(DetectionJob.id == job_id, DetectionJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not yet completed")

    # Audit the evidence export
    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.EVIDENCE_EXPORT,
        resource_type="detection_job",
        resource_id=job_id,
        details={"evidence_hash": job.evidence_hash},
    ))
    await db.commit()

    return {
        "job_id": job.id,
        "original_filename": job.original_filename,
        "input_hash": job.input_hash,
        "evidence_hash": job.evidence_hash,
        "verdict": job.verdict,
        "ensemble_confidence": job.ensemble_confidence,
        "is_synthetic": job.is_synthetic,
        "risk_score": job.risk_score,
        "flagged_reasons": job.flagged_reasons,
        "explanation": job.explanation,
        "analyst_notes": job.analyst_notes,
        "model_versions": job.model_versions,
        "chain_of_custody": job.chain_of_custody,
        "suspicious_segments": job.suspicious_segments,
        "speakers": job.speakers,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "processing_time_ms": job.processing_time_ms,
    }


@router.get("/{job_id}/export/json")
async def export_detection_json(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export full detection report as JSON."""
    result = await db.execute(
        select(DetectionJob).where(DetectionJob.id == job_id, DetectionJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    report = {
        "platform": "Voice-Crafter",
        "report_type": "deepfake_detection",
        "report_version": "1.0",
        "job_id": job.id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input": {
            "filename": job.original_filename,
            "sha256_hash": job.input_hash,
            "duration_seconds": job.duration_seconds,
            "sample_rate": job.sample_rate,
        },
        "verdict": {
            "result": job.verdict,
            "is_synthetic": job.is_synthetic,
            "ensemble_confidence": job.ensemble_confidence,
            "risk_score": job.risk_score,
            "confidence_threshold": job.confidence_threshold,
        },
        "model_scores": {
            "aasist": job.aasist_score,
            "rawnet2": job.rawnet2_score,
            "prosodic": job.prosodic_score,
            "spectral": job.spectral_score,
            "glottal": job.glottal_score,
        },
        "flagged_reasons": job.flagged_reasons,
        "explanation": job.explanation,
        "analyst_notes": job.analyst_notes,
        "suspicious_segments": job.suspicious_segments,
        "confidence_timeline": job.confidence_timeline,
        "speakers": job.speakers,
        "model_versions": job.model_versions,
        "chain_of_custody": job.chain_of_custody,
        "evidence_hash": job.evidence_hash,
        "processing_time_ms": job.processing_time_ms,
    }

    json_bytes = json.dumps(report, indent=2, default=str).encode()
    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="detection_{job_id}.json"'},
    )


@router.delete("/{job_id}")
async def delete_detection_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a detection job and its associated files."""
    result = await db.execute(
        select(DetectionJob).where(DetectionJob.id == job_id, DetectionJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == JobStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Cannot delete a job currently being processed")

    # Delete from storage
    if job.input_storage_key:
        try:
            storage = await get_storage()
            await storage.delete(settings.BUCKET_UPLOADS, job.input_storage_key)
        except Exception as e:
            logger.warning(f"Failed to delete storage file for job {job_id}: {e}")

    await db.delete(job)
    await db.commit()

    return {"message": "Detection job deleted"}


@router.get("/stats/summary")
async def get_detection_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated detection statistics for current user."""
    result = await db.execute(
        select(
            func.count(DetectionJob.id).label("total"),
            func.count(DetectionJob.id).filter(DetectionJob.is_synthetic == True).label("synthetic_count"),
            func.count(DetectionJob.id).filter(DetectionJob.verdict == DetectionVerdict.AUTHENTIC).label("authentic_count"),
            func.avg(DetectionJob.ensemble_confidence).label("avg_confidence"),
            func.avg(DetectionJob.risk_score).label("avg_risk"),
            func.avg(DetectionJob.processing_time_ms).label("avg_processing_ms"),
        ).where(
            DetectionJob.user_id == current_user.id,
            DetectionJob.status == JobStatus.COMPLETED,
        )
    )
    row = result.one()

    verdict_dist = await db.execute(
        select(DetectionJob.verdict, func.count(DetectionJob.id).label("count"))
        .where(DetectionJob.user_id == current_user.id, DetectionJob.status == JobStatus.COMPLETED)
        .group_by(DetectionJob.verdict)
    )
    verdict_distribution = {str(r.verdict): r.count for r in verdict_dist}

    return {
        "total_jobs": row.total or 0,
        "synthetic_detected": row.synthetic_count or 0,
        "authentic_verified": row.authentic_count or 0,
        "avg_confidence": round(float(row.avg_confidence or 0), 4),
        "avg_risk_score": round(float(row.avg_risk or 0), 4),
        "avg_processing_ms": round(float(row.avg_processing_ms or 0), 2),
        "verdict_distribution": verdict_distribution,
    }
