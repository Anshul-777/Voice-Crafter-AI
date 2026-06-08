"""Voice-Crafter Generation Task"""
import asyncio, logging
from datetime import datetime, timezone
from app.workers.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name="generation.run", max_retries=2, soft_time_limit=1800)
def run_generation_task(self, job_id: str, user_id: str):
    return asyncio.get_event_loop().run_until_complete(_run_gen_async(self, job_id, user_id))

async def _run_gen_async(task, job_id, user_id):
    from app.database import SessionLocal
    from app.models import GenerationJob, JobStatus, VoiceProfile, VoiceSample, Notification, NotificationType, UsageRecord
    from app.utils.storage import get_storage
    from app.ml.tts_pipeline import get_tts_pipeline
    from sqlalchemy import select
    import uuid, os, tempfile

    async with SessionLocal() as db:
        result = await db.execute(select(GenerationJob).where(GenerationJob.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

        # Load job details
        text = job.text
        voice_id = job.voice_profile_id
        language = job.language or "en"
        emotion = job.emotion or "neutral"
        speed = job.speed or 1.0
        temperature = job.temperature or 0.7
        output_format = job.output_format or "wav"

    try:
        tts = get_tts_pipeline()
        storage = await get_storage()

        # Get speaker wav if voice profile exists
        speaker_wav = None
        if voice_id:
            async with SessionLocal() as db:
                vp_result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == voice_id))
                vp = vp_result.scalar_one_or_none()
                if vp:
                    samples_result = await db.execute(
                        select(VoiceSample).where(VoiceSample.voice_profile_id == voice_id).limit(1)
                    )
                    sample = samples_result.scalar_one_or_none()
                    if sample:
                        sample_bytes = await storage.download(settings.BUCKET_SAMPLES, sample.storage_key)
                        with tempfile.NamedTemporaryFile(suffix=f".{sample.format}", delete=False) as f:
                            f.write(sample_bytes)
                            speaker_wav = f.name

        audio_bytes, sr = await tts.synthesize(
            text=text, speaker_wav=speaker_wav, language=language,
            emotion=emotion, speed=speed, temperature=temperature, output_format=output_format
        )

        # Get duration
        import soundfile as sf, io as _io
        try:
            info = sf.info(_io.BytesIO(audio_bytes))
            duration = info.duration
        except Exception:
            duration = len(text) * 0.06  # rough estimate

        # Store output
        storage_key = f"outputs/{user_id}/{uuid.uuid4()}.{output_format}"
        await storage.upload(settings.BUCKET_OUTPUTS, storage_key, audio_bytes, f"audio/{output_format}")

        async with SessionLocal() as db:
            result = await db.execute(select(GenerationJob).where(GenerationJob.id == job_id))
            job = result.scalar_one_or_none()
            if job:
                job.status = JobStatus.COMPLETED
                job.progress = 1.0
                job.output_storage_key = storage_key
                job.duration_seconds = round(duration, 3)
                job.file_size_bytes = len(audio_bytes)
                job.sample_rate = sr
                job.completed_at = datetime.now(timezone.utc)

            month_year = datetime.now().strftime("%Y-%m")
            existing = await db.execute(select(UsageRecord).where(UsageRecord.user_id == user_id, UsageRecord.month_year == month_year, UsageRecord.resource_type == "generation_chars"))
            ur = existing.scalar_one_or_none()
            if ur:
                ur.quantity += len(text)
            else:
                db.add(UsageRecord(user_id=user_id, month_year=month_year, resource_type="generation_chars", quantity=len(text), unit="characters"))

            db.add(Notification(user_id=user_id, type=NotificationType.GENERATION_COMPLETE,
                title="Generation Complete 🔊", message=f"Your {duration:.1f}s audio is ready.",
                action_url=f"/history/generation/{job_id}"))
            await db.commit()

        logger.info(f"Generation {job_id} complete: {duration:.1f}s audio")

    except Exception as e:
        logger.error(f"Generation task failed: {e}", exc_info=True)
        async with SessionLocal() as db:
            result = await db.execute(select(GenerationJob).where(GenerationJob.id == job_id))
            job = result.scalar_one_or_none()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(e)[:500]
                job.completed_at = datetime.now(timezone.utc)
                await db.commit()
        if task.request.retries < task.max_retries:
            raise task.retry(exc=e, countdown=60)
    finally:
        if speaker_wav and __import__("os").path.exists(speaker_wav):
            __import__("os").unlink(speaker_wav)
