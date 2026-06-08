"""Voice-Crafter Quality Analysis Task"""
import asyncio, logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name="quality.analyze_sample")
def analyze_sample_quality(self, sample_id: str, storage_key: str):
    return asyncio.get_event_loop().run_until_complete(_analyze(sample_id, storage_key))

async def _analyze(sample_id: str, storage_key: str):
    from app.database import SessionLocal
    from app.models import VoiceSample
    from app.utils.storage import get_storage
    from app.config import settings
    from sqlalchemy import select
    import soundfile as sf, io, librosa, numpy as np

    try:
        storage = await get_storage()
        content = await storage.download(settings.BUCKET_SAMPLES, storage_key)
        audio, sr = sf.read(io.BytesIO(content))
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        audio = audio.astype(np.float32)

        rms = librosa.feature.rms(y=audio, frame_length=1024, hop_length=256)[0]
        speech_ratio = float(np.mean(rms > 0.01))
        noise_floor = float(np.percentile(np.abs(audio), 10))
        signal = float(np.percentile(np.abs(audio), 90))
        snr = 20 * np.log10(signal / (noise_floor + 1e-8))
        clipping = float(np.mean(np.abs(audio) > 0.99))
        issues = []
        if snr < 15: issues.append("high_noise")
        if speech_ratio < 0.3: issues.append("low_speech")
        if clipping > 0.001: issues.append("clipping")
        if len(audio)/sr < 3: issues.append("too_short")
        quality_score = min(100, max(0, snr/30*40 + speech_ratio*40 + min(20, len(audio)/sr/30*20)))

        async with SessionLocal() as db:
            result = await db.execute(select(VoiceSample).where(VoiceSample.id == sample_id))
            sample = result.scalar_one_or_none()
            if sample:
                sample.snr_db = round(float(snr), 2)
                sample.speech_ratio = round(speech_ratio, 3)
                sample.noise_level = round(float(noise_floor), 4)
                sample.quality_score = round(quality_score, 1)
                sample.quality_issues = issues
                sample.is_suitable = quality_score >= 50
                await db.commit()

        logger.info(f"Quality analysis complete for sample {sample_id}: score={quality_score:.1f}")
    except Exception as e:
        logger.error(f"Quality analysis failed for {sample_id}: {e}")
