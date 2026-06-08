"""Voice-Crafter - Cloning, Generation, Hub, Plans, Analytics, Users, Orgs, APIKeys, Notifications, History, Audit, Quality, Benchmarks, Streaming, Uploads, Admin routers"""

# ── CLONING ──────────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, update
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, timezone
import uuid, hashlib, logging

from app.database import get_db
from app.models import *
from app.services.auth_service import get_current_user
from app.services.entitlement_service import check_clone_quota, check_generation_quota, get_usage_summary, get_plan_limits, PLAN_LIMITS
from app.config import settings
from app.utils.storage import get_storage

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CLONING ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
cloning_router = APIRouter()

class CloneJobCreate(BaseModel):
    voice_profile_id: str
    mode: str = "zero_shot"
    fine_tune_steps: Optional[int] = None

@cloning_router.post("/start", status_code=201)
async def start_clone_job(
    body: CloneJobCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_clone_quota(current_user, db)
    # Verify voice profile ownership
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == body.voice_profile_id, VoiceProfile.owner_id == current_user.id))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(404, "Voice profile not found")
    # Check samples exist
    samples_result = await db.execute(select(VoiceSample).where(VoiceSample.voice_profile_id == body.voice_profile_id))
    samples = samples_result.scalars().all()
    if not samples:
        raise HTTPException(400, "Upload at least one voice sample before cloning")

    limits = get_plan_limits(current_user.plan_tier)
    if body.mode == "fine_tune" and not limits.get("fine_tuning"):
        raise HTTPException(402, "Fine-tuning requires Pro or Enterprise plan")

    job = CloneJob(
        user_id=current_user.id, voice_profile_id=body.voice_profile_id,
        status=JobStatus.QUEUED, mode=body.mode,
        fine_tune_steps=body.fine_tune_steps, queued_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.CLONE_START,
                    resource_type="clone_job", details={"voice_id": body.voice_profile_id, "mode": body.mode}))
    await db.commit()
    await db.refresh(job)

    # Dispatch Celery task
    from app.workers.cloning_tasks import run_clone_task
    task = run_clone_task.delay(job_id=job.id, user_id=current_user.id,
                                 voice_profile_id=body.voice_profile_id, mode=body.mode,
                                 fine_tune_steps=body.fine_tune_steps)
    job.celery_task_id = task.id
    await db.commit()

    return {"job_id": job.id, "status": "queued", "message": "Clone job queued"}


@cloning_router.get("/{job_id}")
async def get_clone_job(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloneJob).where(CloneJob.id == job_id, CloneJob.user_id == current_user.id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Clone job not found")
    return {
        "id": job.id, "voice_profile_id": job.voice_profile_id,
        "status": job.status, "progress": job.progress,
        "progress_message": job.progress_message,
        "mode": job.mode, "quality_score": job.quality_score,
        "similarity_score": job.similarity_score, "preview_url": job.preview_url,
        "error_message": job.error_message,
        "started_at": job.started_at, "completed_at": job.completed_at,
        "created_at": job.created_at,
    }


@cloning_router.get("/")
async def list_clone_jobs(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(CloneJob).where(CloneJob.user_id == current_user.id).order_by(desc(CloneJob.created_at))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.offset((page-1)*page_size).limit(page_size))
    jobs = result.scalars().all()
    return {"total": total, "jobs": [{"id": j.id, "voice_profile_id": j.voice_profile_id, "status": j.status,
             "progress": j.progress, "mode": j.mode, "quality_score": j.quality_score,
             "created_at": j.created_at, "completed_at": j.completed_at} for j in jobs]}


@cloning_router.post("/upload-sample/{voice_profile_id}")
async def upload_voice_sample(
    voice_profile_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == voice_profile_id, VoiceProfile.owner_id == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Voice profile not found")

    ext = (file.filename or "sample.wav").rsplit(".", 1)[-1].lower()
    if ext not in settings.SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, "File too large")

    file_hash = hashlib.sha256(content).hexdigest()
    storage_key = f"samples/{current_user.id}/{voice_profile_id}/{uuid.uuid4()}.{ext}"

    # Quick audio info
    import soundfile as sf
    import io as _io
    try:
        audio_info = sf.info(_io.BytesIO(content))
        duration = audio_info.duration
        sample_rate = audio_info.samplerate
    except Exception:
        duration, sample_rate = 0.0, 16000

    if duration < settings.MIN_SAMPLE_DURATION_SEC:
        raise HTTPException(400, f"Sample too short ({duration:.1f}s). Minimum {settings.MIN_SAMPLE_DURATION_SEC}s required.")

    storage = await get_storage()
    await storage.upload(settings.BUCKET_SAMPLES, storage_key, content, content_type=f"audio/{ext}")

    sample = VoiceSample(
        voice_profile_id=voice_profile_id, storage_key=storage_key,
        original_filename=file.filename or f"sample.{ext}",
        duration_seconds=duration, sample_rate=sample_rate,
        file_size_bytes=len(content), format=ext, sha256_hash=file_hash,
    )
    db.add(sample)

    # Run quality analysis in background
    from app.workers.quality_tasks import analyze_sample_quality
    await db.commit()
    await db.refresh(sample)
    analyze_sample_quality.delay(sample_id=sample.id, storage_key=storage_key)

    return {
        "sample_id": sample.id, "duration_seconds": duration,
        "sample_rate": sample_rate, "message": "Sample uploaded and queued for quality analysis"
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GENERATION ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
generation_router = APIRouter()

class GenerationRequest(BaseModel):
    text: str
    voice_profile_id: Optional[str] = None
    language: str = "en"
    emotion: str = "neutral"
    speaking_style: Optional[str] = None
    speed: float = 1.0
    pitch: float = 1.0
    temperature: float = 0.7
    output_format: str = "wav"
    use_ssml: bool = False

@generation_router.post("/", status_code=201)
async def generate_speech(
    body: GenerationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "text is required")
    if len(text) > settings.TTS_MAX_TEXT_LENGTH:
        raise HTTPException(400, f"Text too long (max {settings.TTS_MAX_TEXT_LENGTH} chars)")

    await check_generation_quota(current_user, len(text), db)

    voice_profile = None
    if body.voice_profile_id:
        result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == body.voice_profile_id))
        voice_profile = result.scalar_one_or_none()
        if not voice_profile:
            raise HTTPException(404, "Voice profile not found")
        if voice_profile.owner_id != current_user.id and voice_profile.visibility == "private":
            raise HTTPException(403, "Cannot use private voice")

    job = GenerationJob(
        user_id=current_user.id, voice_profile_id=body.voice_profile_id,
        status=JobStatus.QUEUED, text=text, language=body.language,
        emotion=body.emotion, speaking_style=body.speaking_style,
        speed=body.speed, pitch=body.pitch, temperature=body.temperature,
        output_format=body.output_format, use_ssml=body.use_ssml,
        character_count=len(text),
    )
    db.add(job)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.GENERATION_START,
                    resource_type="generation_job", details={"chars": len(text), "lang": body.language}))
    await db.commit()
    await db.refresh(job)

    from app.workers.generation_tasks import run_generation_task
    task = run_generation_task.delay(job_id=job.id, user_id=current_user.id)
    job.celery_task_id = task.id
    await db.commit()

    return {"job_id": job.id, "status": "queued", "character_count": len(text)}


@generation_router.get("/{job_id}")
async def get_generation_job(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GenerationJob).where(GenerationJob.id == job_id, GenerationJob.user_id == current_user.id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Generation job not found")
    output_url = None
    if job.output_storage_key and job.status == JobStatus.COMPLETED:
        try:
            storage = await get_storage()
            output_url = await storage.presigned_url(settings.BUCKET_OUTPUTS, job.output_storage_key, expires_hours=24)
        except Exception:
            pass
    return {
        "id": job.id, "status": job.status, "progress": job.progress,
        "text": job.text[:200] + ("..." if len(job.text) > 200 else ""),
        "language": job.language, "emotion": job.emotion,
        "voice_profile_id": job.voice_profile_id,
        "duration_seconds": job.duration_seconds,
        "character_count": job.character_count,
        "output_format": job.output_format,
        "output_url": output_url,
        "error_message": job.error_message,
        "created_at": job.created_at, "completed_at": job.completed_at,
    }


@generation_router.get("/")
async def list_generation_jobs(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(GenerationJob).where(GenerationJob.user_id == current_user.id).order_by(desc(GenerationJob.created_at))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.offset((page-1)*page_size).limit(page_size))
    jobs = result.scalars().all()
    return {"total": total, "jobs": [{
        "id": j.id, "status": j.status, "language": j.language,
        "emotion": j.emotion, "voice_profile_id": j.voice_profile_id,
        "character_count": j.character_count, "duration_seconds": j.duration_seconds,
        "output_format": j.output_format, "created_at": j.created_at,
    } for j in jobs]}


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC HUB ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
hub_router = APIRouter()

@hub_router.get("/voices")
async def hub_list_voices(
    page: int = Query(1, ge=1), page_size: int = Query(24, ge=1, le=100),
    search: Optional[str] = None, language: Optional[str] = None,
    gender: Optional[str] = None, style: Optional[str] = None,
    sort: str = Query("popular", pattern="^(popular|newest|likes|plays)$"),
    db: AsyncSession = Depends(get_db),
):
    """Browse public voice library."""
    from sqlalchemy import case
    q = select(VoiceProfile, User.username, User.display_name, User.avatar_url).join(
        User, VoiceProfile.owner_id == User.id
    ).where(VoiceProfile.visibility == "public", VoiceProfile.is_active == True, VoiceProfile.is_archived == False)

    if search:
        q = q.where(VoiceProfile.name.ilike(f"%{search}%"))
    if language:
        q = q.where(VoiceProfile.language == language)
    if gender:
        q = q.where(VoiceProfile.gender == gender)

    sort_col = {
        "popular": desc(VoiceProfile.plays_count),
        "newest": desc(VoiceProfile.created_at),
        "likes": desc(VoiceProfile.likes_count),
        "plays": desc(VoiceProfile.plays_count),
    }.get(sort, desc(VoiceProfile.plays_count))

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar()
    result = await db.execute(q.order_by(sort_col).offset((page-1)*page_size).limit(page_size))
    rows = result.all()

    return {
        "total": total, "page": page, "page_size": page_size,
        "voices": [{
            **{k: getattr(r[0], k) for k in ["id","name","description","language","gender","age_style",
               "accent","speaking_style","emotion_tags","use_case_tags","custom_tags",
               "avatar_url","preview_url","base_model","fine_tuned","quality_score",
               "likes_count","plays_count","clones_count","is_hub_featured","license_type","created_at"]},
            "owner": {"username": r[1], "display_name": r[2], "avatar_url": r[3]},
        } for r in rows]
    }


@hub_router.get("/voices/{voice_id}")
async def hub_get_voice(voice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VoiceProfile, User.username, User.display_name, User.avatar_url)
        .join(User, VoiceProfile.owner_id == User.id)
        .where(VoiceProfile.id == voice_id, VoiceProfile.visibility == "public")
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Voice not found in hub")
    v = row[0]
    # Increment plays
    v.plays_count += 1
    await db.commit()
    return {**{k: getattr(v, k) for k in ["id","name","description","language","gender","age_style",
        "accent","speaking_style","emotion_tags","use_case_tags","custom_tags",
        "avatar_url","preview_url","base_model","fine_tuned","quality_score","similarity_score",
        "likes_count","plays_count","clones_count","downloads_count","is_hub_featured",
        "license_type","consent_verified","created_at"]},
        "owner": {"username": row[1], "display_name": row[2], "avatar_url": row[3]}}


@hub_router.get("/featured")
async def hub_featured(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VoiceProfile, User.username, User.display_name, User.avatar_url)
        .join(User, VoiceProfile.owner_id == User.id)
        .where(VoiceProfile.is_hub_featured == True, VoiceProfile.visibility == "public", VoiceProfile.is_active == True)
        .order_by(desc(VoiceProfile.plays_count)).limit(12)
    )
    rows = result.all()
    return {"voices": [{
        "id": r[0].id, "name": r[0].name, "language": r[0].language,
        "gender": r[0].gender, "avatar_url": r[0].avatar_url, "preview_url": r[0].preview_url,
        "likes_count": r[0].likes_count, "plays_count": r[0].plays_count,
        "quality_score": r[0].quality_score,
        "owner": {"username": r[1], "display_name": r[2], "avatar_url": r[3]},
    } for r in rows]}


@hub_router.get("/stats")
async def hub_stats(db: AsyncSession = Depends(get_db)):
    voice_count = (await db.execute(select(func.count(VoiceProfile.id)).where(VoiceProfile.visibility=="public", VoiceProfile.is_active==True))).scalar()
    user_count = (await db.execute(select(func.count(User.id)).where(User.is_active==True))).scalar()
    total_plays = (await db.execute(select(func.sum(VoiceProfile.plays_count)).where(VoiceProfile.visibility=="public"))).scalar()
    return {"public_voices": voice_count, "active_users": user_count, "total_plays": total_plays or 0}


# ═══════════════════════════════════════════════════════════════════════════════
# PLANS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
plans_router = APIRouter()

PLAN_DETAILS = {
    "free": {"name": "Free", "price_monthly": 0, "price_yearly": 0,
             "description": "Get started with voice AI", "color": "#6B7280",
             "features": ["2 voice profiles", "5 clone jobs/month", "10K chars/month", "30 min detection/month", "500MB storage"]},
    "starter": {"name": "Starter", "price_monthly": 19, "price_yearly": 190,
                 "description": "For creators and individuals", "color": "#3B82F6",
                 "features": ["10 voice profiles", "50 clone jobs/month", "100K chars/month", "300 min detection/month", "5GB storage", "Streaming", "Diarization", "API access", "Hub publishing"]},
    "pro": {"name": "Pro", "price_monthly": 79, "price_yearly": 790,
             "description": "For teams and professionals", "color": "#8B5CF6",
             "features": ["50 voice profiles", "500 clone jobs/month", "1M chars/month", "3000 min detection/month", "50GB storage", "Fine-tuning", "SSML support", "Priority queue", "All Starter features"]},
    "enterprise": {"name": "Enterprise", "price_monthly": 299, "price_yearly": 2990,
                    "description": "For organizations at scale", "color": "#F59E0B",
                    "features": ["Unlimited everything", "Custom models", "SLA guarantee", "Dedicated support", "Custom integrations", "All Pro features"]},
}

@plans_router.get("/")
async def list_plans():
    return {"plans": [{"tier": k, **v} for k, v in PLAN_DETAILS.items()]}


@plans_router.get("/current")
async def get_current_plan(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    usage = await get_usage_summary(current_user, db)
    plan_info = PLAN_DETAILS.get(current_user.plan_tier, PLAN_DETAILS["free"])
    return {"tier": current_user.plan_tier, "plan": plan_info, **usage}


@plans_router.post("/upgrade")
async def upgrade_plan(
    tier: str, billing_cycle: str = "monthly",
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """
    Initiate plan upgrade. In production this creates a Stripe/Razorpay checkout session.
    Currently returns a checkout URL placeholder and updates plan immediately for demo.
    """
    valid_tiers = ["free", "starter", "pro", "enterprise"]
    if tier not in valid_tiers:
        raise HTTPException(400, f"Invalid tier. Choose from: {valid_tiers}")

    plan_tier = PlanTier(tier)

    # Payment gateway integration point
    if settings.STRIPE_SECRET_KEY and tier != "free":
        # Real Stripe checkout would go here
        checkout_url = f"https://checkout.stripe.com/pay/placeholder_{tier}"
        return {"checkout_url": checkout_url, "message": "Redirecting to payment..."}

    # For free tier or when no gateway is configured - apply immediately
    old_tier = current_user.plan_tier
    current_user.plan_tier = plan_tier
    db.add(Subscription(user_id=current_user.id, plan_tier=plan_tier, billing_cycle=billing_cycle, status="active"))
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.PLAN_CHANGE,
                    details={"from": old_tier, "to": tier, "billing_cycle": billing_cycle}))
    db.add(Notification(user_id=current_user.id, type=NotificationType.PLAN_CHANGED,
                        title=f"Plan changed to {PLAN_DETAILS[tier]['name']}",
                        message=f"Your plan has been updated to {PLAN_DETAILS[tier]['name']}."))
    await db.commit()
    return {"message": f"Plan updated to {tier}", "tier": tier, "new_limits": get_plan_limits(plan_tier)}


# ═══════════════════════════════════════════════════════════════════════════════
# API KEYS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
apikeys_router = APIRouter()

@apikeys_router.post("/", status_code=201)
async def create_api_key(
    name: str, scopes: List[str] = Query(default=["read", "write"]),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    limits = get_plan_limits(current_user.plan_tier)
    if not limits.get("api_access"):
        raise HTTPException(402, "API access requires Starter plan or higher")

    result = await db.execute(select(func.count(APIKey.id)).where(APIKey.user_id == current_user.id, APIKey.is_active == True))
    count = result.scalar()
    max_keys = {"free": 0, "starter": 3, "pro": 10, "enterprise": -1}.get(current_user.plan_tier, 0)
    if max_keys != -1 and count >= max_keys:
        raise HTTPException(402, f"API key limit ({max_keys}) reached. Upgrade for more keys.")

    import secrets as _secrets
    raw_key = settings.API_KEY_PREFIX + _secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    api_key = APIKey(
        user_id=current_user.id, name=name,
        key_prefix=raw_key[:12], key_hash=key_hash, scopes=scopes,
    )
    db.add(api_key)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.API_KEY_CREATE, details={"name": name}))
    await db.commit()
    await db.refresh(api_key)

    return {"id": api_key.id, "name": name, "key": raw_key, "prefix": api_key.key_prefix,
            "scopes": scopes, "created_at": api_key.created_at,
            "warning": "Store this key safely - it won't be shown again"}


@apikeys_router.get("/")
async def list_api_keys(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).where(APIKey.user_id == current_user.id, APIKey.is_active == True).order_by(desc(APIKey.created_at)))
    keys = result.scalars().all()
    return {"keys": [{"id": k.id, "name": k.name, "prefix": k.key_prefix, "scopes": k.scopes,
                      "last_used_at": k.last_used_at, "usage_count": k.usage_count,
                      "created_at": k.created_at} for k in keys]}


@apikeys_router.delete("/{key_id}")
async def revoke_api_key(key_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(404, "API key not found")
    key.is_active = False
    key.revoked_at = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.API_KEY_REVOKE, details={"key_id": key_id}))
    await db.commit()
    return {"message": "API key revoked"}


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
notifications_router = APIRouter()

@notifications_router.get("/")
async def list_notifications(
    unread_only: bool = False, page: int = 1, page_size: int = 30,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.order_by(desc(Notification.created_at)).offset((page-1)*page_size).limit(page_size))
    notifs = result.scalars().all()
    unread_count = (await db.execute(select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id, Notification.is_read == False))).scalar()
    return {
        "total": total, "unread_count": unread_count,
        "notifications": [{"id": n.id, "type": n.type, "title": n.title,
                           "message": n.message, "action_url": n.action_url,
                           "is_read": n.is_read, "created_at": n.created_at} for n in notifs]
    }


@notifications_router.post("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id))
    n = result.scalar_one_or_none()
    if n:
        n.is_read = True
        n.read_at = datetime.now(timezone.utc)
        await db.commit()
    return {"message": "Marked as read"}


@notifications_router.post("/read-all")
async def mark_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False).values(is_read=True, read_at=datetime.now(timezone.utc)))
    await db.commit()
    return {"message": "All notifications marked as read"}


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
analytics_router = APIRouter()

@analytics_router.get("/overview")
async def analytics_overview(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    usage = await get_usage_summary(current_user, db)
    clone_total = (await db.execute(select(func.count(CloneJob.id)).where(CloneJob.user_id == current_user.id))).scalar()
    gen_total = (await db.execute(select(func.count(GenerationJob.id)).where(GenerationJob.user_id == current_user.id))).scalar()
    det_total = (await db.execute(select(func.count(DetectionJob.id)).where(DetectionJob.user_id == current_user.id))).scalar()
    voice_total = (await db.execute(select(func.count(VoiceProfile.id)).where(VoiceProfile.owner_id == current_user.id, VoiceProfile.is_active == True))).scalar()

    synthetic_count = (await db.execute(select(func.count(DetectionJob.id)).where(
        DetectionJob.user_id == current_user.id,
        DetectionJob.is_synthetic == True,
        DetectionJob.status == "completed"
    ))).scalar()

    return {
        "totals": {"clone_jobs": clone_total, "generation_jobs": gen_total,
                   "detection_jobs": det_total, "voice_profiles": voice_total,
                   "synthetic_detected": synthetic_count},
        "usage": usage["usage"],
        "plan": usage["plan_tier"],
    }


@analytics_router.get("/timeline")
async def analytics_timeline(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Return daily activity counts for the past N days."""
    from sqlalchemy import cast, Date, text
    from datetime import date, timedelta

    end = date.today()
    start = end - timedelta(days=days)

    # Generation by day
    gen_result = await db.execute(
        select(func.date(GenerationJob.created_at).label("day"), func.count().label("count"))
        .where(GenerationJob.user_id == current_user.id, func.date(GenerationJob.created_at) >= start)
        .group_by(func.date(GenerationJob.created_at)).order_by("day")
    )
    gen_by_day = {str(r.day): r.count for r in gen_result}

    det_result = await db.execute(
        select(func.date(DetectionJob.created_at).label("day"), func.count().label("count"))
        .where(DetectionJob.user_id == current_user.id, func.date(DetectionJob.created_at) >= start)
        .group_by(func.date(DetectionJob.created_at)).order_by("day")
    )
    det_by_day = {str(r.day): r.count for r in det_result}

    # Fill gaps
    timeline = []
    current_day = start
    while current_day <= end:
        day_str = str(current_day)
        timeline.append({"date": day_str, "generations": gen_by_day.get(day_str, 0),
                          "detections": det_by_day.get(day_str, 0)})
        current_day += timedelta(days=1)

    return {"timeline": timeline, "days": days}


# ═══════════════════════════════════════════════════════════════════════════════
# USERS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
users_router = APIRouter()

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    preferred_language: Optional[str] = None
    email_notifications: Optional[bool] = None

@users_router.put("/me")
async def update_profile(body: UserUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for field, val in body.dict(exclude_none=True).items():
        setattr(current_user, field, val)
    current_user.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.PROFILE_UPDATE))
    await db.commit()
    return {"message": "Profile updated"}


@users_router.get("/{username}/public")
async def get_public_profile(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    voices_result = await db.execute(
        select(VoiceProfile).where(VoiceProfile.owner_id == user.id, VoiceProfile.visibility == "public", VoiceProfile.is_active == True)
        .order_by(desc(VoiceProfile.plays_count)).limit(8)
    )
    public_voices = voices_result.scalars().all()

    return {
        "id": user.id, "username": user.username, "display_name": user.display_name,
        "bio": user.bio, "website": user.website, "location": user.location,
        "avatar_url": user.avatar_url,
        "followers_count": user.followers_count, "following_count": user.following_count,
        "voices_count": user.voices_count, "plays_count": user.plays_count,
        "created_at": user.created_at,
        "recent_voices": [{"id": v.id, "name": v.name, "language": v.language,
                           "avatar_url": v.avatar_url, "plays_count": v.plays_count,
                           "likes_count": v.likes_count} for v in public_voices],
    }


@users_router.get("/feed/activity")
async def activity_feed(
    page: int = 1, page_size: int = 20,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Get activity feed from followed users' public voice uploads."""
    following_result = await db.execute(
        select(UserFollow.following_id).where(UserFollow.follower_id == current_user.id)
    )
    following_ids = [r[0] for r in following_result.all()]
    if not following_ids:
        return {"activities": [], "message": "Follow users to see their activity here"}

    result = await db.execute(
        select(VoiceProfile, User.username, User.display_name, User.avatar_url)
        .join(User, VoiceProfile.owner_id == User.id)
        .where(VoiceProfile.owner_id.in_(following_ids), VoiceProfile.visibility == "public", VoiceProfile.is_active == True)
        .order_by(desc(VoiceProfile.created_at)).offset((page-1)*page_size).limit(page_size)
    )
    rows = result.all()
    return {"activities": [{"type": "voice_published", "id": r[0].id, "name": r[0].name,
                            "language": r[0].language, "avatar_url": r[0].avatar_url,
                            "created_at": r[0].created_at,
                            "user": {"username": r[1], "display_name": r[2], "avatar_url": r[3]}} for r in rows]}


@users_router.post("/{user_id}/follow")
async def toggle_follow(user_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot follow yourself")
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    existing = (await db.execute(select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.following_id == user_id))).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        current_user.following_count = max(0, current_user.following_count - 1)
        target.followers_count = max(0, target.followers_count - 1)
        following = False
    else:
        db.add(UserFollow(follower_id=current_user.id, following_id=user_id))
        current_user.following_count += 1
        target.followers_count += 1
        following = True
    await db.commit()
    return {"following": following, "followers_count": target.followers_count}


# ═══════════════════════════════════════════════════════════════════════════════
# ORGANIZATIONS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
organizations_router = APIRouter()

@organizations_router.post("/", status_code=201)
async def create_org(name: str, slug: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(Organization).where(Organization.slug == slug))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Slug already taken")
    org = Organization(name=name, slug=slug, owner_id=current_user.id, plan_tier=current_user.plan_tier)
    db.add(org)
    await db.flush()
    db.add(OrganizationMember(org_id=org.id, user_id=current_user.id, role=UserRole.OWNER))
    await db.commit()
    return {"id": org.id, "name": org.name, "slug": org.slug}


@organizations_router.get("/me")
async def my_orgs(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Organization, OrganizationMember.role)
        .join(OrganizationMember, Organization.id == OrganizationMember.org_id)
        .where(OrganizationMember.user_id == current_user.id)
    )
    rows = result.all()
    return {"organizations": [{"id": r[0].id, "name": r[0].name, "slug": r[0].slug,
                               "plan_tier": r[0].plan_tier, "role": r[1]} for r in rows]}


# ═══════════════════════════════════════════════════════════════════════════════
# HISTORY ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
history_router = APIRouter()

@history_router.get("/")
async def get_history(
    page: int = 1, page_size: int = 20,
    job_type: Optional[str] = Query(None, pattern="^(clone|generation|detection)$"),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    items = []
    if not job_type or job_type == "generation":
        res = await db.execute(select(GenerationJob).where(GenerationJob.user_id == current_user.id).order_by(desc(GenerationJob.created_at)).limit(page_size))
        for j in res.scalars().all():
            items.append({"type": "generation", "id": j.id, "status": j.status, "summary": j.text[:80],
                          "language": j.language, "duration_seconds": j.duration_seconds, "created_at": j.created_at})
    if not job_type or job_type == "detection":
        res = await db.execute(select(DetectionJob).where(DetectionJob.user_id == current_user.id).order_by(desc(DetectionJob.created_at)).limit(page_size))
        for j in res.scalars().all():
            items.append({"type": "detection", "id": j.id, "status": j.status, "verdict": j.verdict,
                          "confidence": j.ensemble_confidence, "filename": j.original_filename, "created_at": j.created_at})
    if not job_type or job_type == "clone":
        res = await db.execute(select(CloneJob).where(CloneJob.user_id == current_user.id).order_by(desc(CloneJob.created_at)).limit(page_size))
        for j in res.scalars().all():
            items.append({"type": "clone", "id": j.id, "status": j.status, "mode": j.mode,
                          "quality_score": j.quality_score, "created_at": j.created_at})

    items.sort(key=lambda x: x["created_at"], reverse=True)
    return {"items": items[:page_size], "page": page}


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT LOGS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
audit_logs_router = APIRouter()

@audit_logs_router.get("/")
async def list_audit_logs(
    page: int = 1, page_size: int = 50,
    action: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).where(AuditLog.user_id == current_user.id)
    if action:
        q = q.where(AuditLog.action == action)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.order_by(desc(AuditLog.created_at)).offset((page-1)*page_size).limit(page_size))
    logs = result.scalars().all()
    return {"total": total, "logs": [{"id": l.id, "action": l.action, "resource_type": l.resource_type,
                                      "resource_id": l.resource_id, "ip_address": l.ip_address,
                                      "status": l.status, "details": l.details, "created_at": l.created_at} for l in logs]}


# ═══════════════════════════════════════════════════════════════════════════════
# QUALITY ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
quality_router = APIRouter()

@quality_router.post("/analyze")
async def analyze_audio_quality(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(413, "File too large for quick quality analysis")
    try:
        import soundfile as sf
        import io as _io
        import librosa
        import numpy as np
        audio, sr = sf.read(_io.BytesIO(content))
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        audio = audio.astype(np.float32)
        duration = len(audio) / sr
        rms = float(np.sqrt(np.mean(audio**2)))
        rms_db = 20 * np.log10(rms + 1e-8)
        peak_db = 20 * np.log10(np.max(np.abs(audio)) + 1e-8)
        # Simple SNR estimate
        noise_floor = np.percentile(np.abs(audio), 10)
        signal_level = np.percentile(np.abs(audio), 90)
        snr_db = 20 * np.log10(signal_level / (noise_floor + 1e-8))
        # Speech ratio
        energy = librosa.feature.rms(y=audio, frame_length=1024, hop_length=256)[0]
        speech_ratio = float(np.mean(energy > 0.01))
        # Quality score
        score = min(100, max(0, (snr_db / 30) * 40 + speech_ratio * 40 + min(20, duration / 30 * 20)))
        issues = []
        if snr_db < 15: issues.append("High background noise (SNR < 15dB)")
        if speech_ratio < 0.3: issues.append("Low speech content")
        if duration < 3: issues.append("Recording too short")
        if peak_db > -1: issues.append("Audio clipping detected")
        return {
            "duration_seconds": round(duration, 2), "sample_rate": sr,
            "snr_db": round(snr_db, 2), "rms_db": round(rms_db, 2),
            "peak_db": round(peak_db, 2), "speech_ratio": round(speech_ratio, 3),
            "quality_score": round(score, 1), "issues": issues,
            "suitability": "excellent" if score > 80 else "good" if score > 60 else "fair" if score > 40 else "poor",
            "recommendations": (["Use a quieter environment"] if snr_db < 15 else []) +
                               (["Record longer sample (min 3s)"] if duration < 3 else []),
        }
    except Exception as e:
        raise HTTPException(400, f"Audio analysis failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# BENCHMARKS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
benchmarks_router = APIRouter()

@benchmarks_router.get("/models")
async def get_model_benchmarks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelVersion).order_by(desc(ModelVersion.created_at)))
    models = result.scalars().all()
    benchmarks_result = await db.execute(select(BenchmarkRun).order_by(desc(BenchmarkRun.created_at)).limit(100))
    runs = benchmarks_result.scalars().all()
    return {
        "models": [{"id": m.id, "type": m.model_type, "name": m.model_name, "version": m.version,
                    "is_active": m.is_active, "metrics": m.performance_metrics,
                    "hardware": m.hardware_requirements} for m in models],
        "recent_runs": [{"id": r.id, "model_version_id": r.model_version_id, "dataset": r.dataset_name,
                         "accuracy": r.accuracy, "eer": r.eer, "f1": r.f1_score,
                         "avg_latency_ms": r.avg_latency_ms, "device": r.device,
                         "created_at": r.created_at} for r in runs],
    }


@benchmarks_router.get("/system")
async def get_system_benchmarks():
    import platform, psutil, time as _time
    cpu_pct = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    return {
        "platform": platform.system(), "python_version": platform.python_version(),
        "cpu_cores": psutil.cpu_count(), "cpu_percent": cpu_pct,
        "memory_total_gb": round(mem.total / 1e9, 2),
        "memory_available_gb": round(mem.available / 1e9, 2),
        "memory_percent": mem.percent,
        "device": settings.DEVICE, "timestamp": _time.time(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# UPLOADS ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
uploads_router = APIRouter()

@uploads_router.get("/")
async def list_uploads(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UploadedFile).where(UploadedFile.user_id == current_user.id)
        .order_by(desc(UploadedFile.created_at)).limit(50)
    )
    files = result.scalars().all()
    return {"files": [{"id": f.id, "filename": f.original_filename, "purpose": f.purpose,
                       "size_bytes": f.file_size_bytes, "status": f.status,
                       "created_at": f.created_at} for f in files]}


# ═══════════════════════════════════════════════════════════════════════════════
# STREAMING ROUTER (REST meta endpoints)
# ═══════════════════════════════════════════════════════════════════════════════
streaming_router = APIRouter()

@streaming_router.get("/sessions")
async def list_stream_sessions(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StreamSession).where(StreamSession.user_id == current_user.id)
        .order_by(desc(StreamSession.created_at)).limit(20)
    )
    sessions = result.scalars().all()
    return {"sessions": [{"id": s.id, "type": s.session_type, "status": s.status,
                          "total_chunks": s.total_chunks, "duration_seconds": s.duration_seconds,
                          "current_verdict": s.current_verdict, "started_at": s.started_at,
                          "ended_at": s.ended_at} for s in sessions]}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
admin_router = APIRouter()

async def require_superuser(current_user: User = Depends(get_current_user)):
    if not current_user.is_superuser:
        raise HTTPException(403, "Superuser access required")
    return current_user

@admin_router.get("/stats")
async def admin_stats(su: User = Depends(require_superuser), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(func.count(User.id)))).scalar()
    active = (await db.execute(select(func.count(User.id)).where(User.is_active==True))).scalar()
    voices = (await db.execute(select(func.count(VoiceProfile.id)).where(VoiceProfile.is_active==True))).scalar()
    jobs_gen = (await db.execute(select(func.count(GenerationJob.id)))).scalar()
    jobs_det = (await db.execute(select(func.count(DetectionJob.id)))).scalar()
    plan_dist = await db.execute(select(User.plan_tier, func.count(User.id).label("c")).group_by(User.plan_tier))
    plans = {str(r.plan_tier): r.c for r in plan_dist}
    return {"total_users": users, "active_users": active, "voice_profiles": voices,
            "generation_jobs": jobs_gen, "detection_jobs": jobs_det, "plan_distribution": plans}


@admin_router.get("/users")
async def admin_list_users(
    page: int = 1, page_size: int = 50, search: Optional[str] = None,
    su: User = Depends(require_superuser), db: AsyncSession = Depends(get_db),
):
    q = select(User)
    if search:
        q = q.where(User.email.ilike(f"%{search}%") | User.username.ilike(f"%{search}%"))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.order_by(desc(User.created_at)).offset((page-1)*page_size).limit(page_size))
    users = result.scalars().all()
    return {"total": total, "users": [{"id": u.id, "email": u.email, "username": u.username,
                                       "display_name": u.display_name, "plan_tier": u.plan_tier,
                                       "is_active": u.is_active, "is_verified": u.is_verified,
                                       "created_at": u.created_at, "last_login_at": u.last_login_at} for u in users]}


@admin_router.patch("/users/{user_id}/plan")
async def admin_change_plan(user_id: str, tier: str, su: User = Depends(require_superuser), db: AsyncSession = Depends(get_db)):
    if tier not in ["free", "starter", "pro", "enterprise"]:
        raise HTTPException(400, "Invalid tier")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.plan_tier = PlanTier(tier)
    await db.commit()
    return {"message": f"User {user.email} plan set to {tier}"}


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTER EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

# Make each section importable as separate routers
cloning = type('M', (), {'router': cloning_router})()
generation = type('M', (), {'router': generation_router})()
hub = type('M', (), {'router': hub_router})()
plans = type('M', (), {'router': plans_router})()
apikeys = type('M', (), {'router': apikeys_router})()
notifications = type('M', (), {'router': notifications_router})()
analytics = type('M', (), {'router': analytics_router})()
users = type('M', (), {'router': users_router})()
organizations = type('M', (), {'router': organizations_router})()
history = type('M', (), {'router': history_router})()
audit_logs = type('M', (), {'router': audit_logs_router})()
quality = type('M', (), {'router': quality_router})()
benchmarks = type('M', (), {'router': benchmarks_router})()
uploads = type('M', (), {'router': uploads_router})()
streaming = type('M', (), {'router': streaming_router})()
admin = type('M', (), {'router': admin_router})()
