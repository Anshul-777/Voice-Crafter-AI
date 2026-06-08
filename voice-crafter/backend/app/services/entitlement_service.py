"""
Voice-Crafter Entitlement Service
Plan-based quota enforcement for all features.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from app.models import User, UsageRecord, VoiceProfile, CloneJob, GenerationJob, DetectionJob, PlanTier, JobStatus
from app.config import settings


PLAN_LIMITS = {
    PlanTier.FREE: {
        "voice_profiles": settings.FREE_VOICE_PROFILES,
        "clone_jobs_monthly": settings.FREE_CLONE_JOBS_PER_MONTH,
        "generation_chars_monthly": settings.FREE_GENERATION_CHARS_PER_MONTH,
        "detection_minutes_monthly": settings.FREE_DETECTION_MINUTES_PER_MONTH,
        "storage_mb": settings.FREE_STORAGE_MB,
        "max_upload_mb": 50,
        "streaming": False,
        "fine_tuning": False,
        "diarization": False,
        "evidence_export": False,
        "api_access": False,
        "hub_publish": False,
        "ssml": False,
        "priority_queue": False,
        "analytics": False,
    },
    PlanTier.STARTER: {
        "voice_profiles": settings.STARTER_VOICE_PROFILES,
        "clone_jobs_monthly": settings.STARTER_CLONE_JOBS_PER_MONTH,
        "generation_chars_monthly": settings.STARTER_GENERATION_CHARS_PER_MONTH,
        "detection_minutes_monthly": settings.STARTER_DETECTION_MINUTES_PER_MONTH,
        "storage_mb": settings.STARTER_STORAGE_MB,
        "max_upload_mb": 100,
        "streaming": True,
        "fine_tuning": False,
        "diarization": True,
        "evidence_export": True,
        "api_access": True,
        "hub_publish": True,
        "ssml": False,
        "priority_queue": False,
        "analytics": True,
    },
    PlanTier.PRO: {
        "voice_profiles": settings.PRO_VOICE_PROFILES,
        "clone_jobs_monthly": settings.PRO_CLONE_JOBS_PER_MONTH,
        "generation_chars_monthly": settings.PRO_GENERATION_CHARS_PER_MONTH,
        "detection_minutes_monthly": settings.PRO_DETECTION_MINUTES_PER_MONTH,
        "storage_mb": settings.PRO_STORAGE_MB,
        "max_upload_mb": 200,
        "streaming": True,
        "fine_tuning": True,
        "diarization": True,
        "evidence_export": True,
        "api_access": True,
        "hub_publish": True,
        "ssml": True,
        "priority_queue": True,
        "analytics": True,
    },
    PlanTier.ENTERPRISE: {
        "voice_profiles": -1,
        "clone_jobs_monthly": -1,
        "generation_chars_monthly": -1,
        "detection_minutes_monthly": -1,
        "storage_mb": -1,
        "max_upload_mb": 500,
        "streaming": True,
        "fine_tuning": True,
        "diarization": True,
        "evidence_export": True,
        "api_access": True,
        "hub_publish": True,
        "ssml": True,
        "priority_queue": True,
        "analytics": True,
    },
}


def get_plan_limits(tier: PlanTier) -> dict:
    return PLAN_LIMITS.get(tier, PLAN_LIMITS[PlanTier.FREE])


async def get_monthly_usage(user_id: str, resource: str, db: AsyncSession) -> float:
    month_year = datetime.now().strftime("%Y-%m")
    result = await db.execute(
        select(UsageRecord).where(
            UsageRecord.user_id == user_id,
            UsageRecord.month_year == month_year,
            UsageRecord.resource_type == resource,
        )
    )
    record = result.scalar_one_or_none()
    return record.quantity if record else 0.0


async def check_voice_profile_quota(user: User, db: AsyncSession):
    limits = get_plan_limits(user.plan_tier)
    max_profiles = limits["voice_profiles"]
    if max_profiles == -1:
        return
    result = await db.execute(
        select(func.count(VoiceProfile.id)).where(
            VoiceProfile.owner_id == user.id, VoiceProfile.is_active == True
        )
    )
    count = result.scalar()
    if count >= max_profiles:
        raise HTTPException(
            status_code=402,
            detail=f"Voice profile limit reached ({max_profiles}). Upgrade your plan to create more.",
        )


async def check_clone_quota(user: User, db: AsyncSession):
    limits = get_plan_limits(user.plan_tier)
    max_jobs = limits["clone_jobs_monthly"]
    if max_jobs == -1:
        return
    used = await get_monthly_usage(user.id, "clone_jobs", db)
    if used >= max_jobs:
        raise HTTPException(
            status_code=402,
            detail=f"Clone job limit reached ({max_jobs}/month). Upgrade your plan.",
        )


async def check_generation_quota(user: User, char_count: int, db: AsyncSession):
    limits = get_plan_limits(user.plan_tier)
    max_chars = limits["generation_chars_monthly"]
    if max_chars == -1:
        return
    used = await get_monthly_usage(user.id, "generation_chars", db)
    if used + char_count > max_chars:
        remaining = max(0, max_chars - int(used))
        raise HTTPException(
            status_code=402,
            detail=f"Character quota exceeded. {remaining:,} characters remaining this month. Upgrade your plan.",
        )


async def check_detection_quota(user: User, db: AsyncSession):
    limits = get_plan_limits(user.plan_tier)
    max_minutes = limits["detection_minutes_monthly"]
    if max_minutes == -1:
        return
    used = await get_monthly_usage(user.id, "detection_minutes", db)
    if used >= max_minutes:
        raise HTTPException(
            status_code=402,
            detail=f"Detection minutes exhausted ({max_minutes} min/month). Upgrade your plan.",
        )


def require_feature(feature: str):
    """Dependency: require a specific plan feature to be enabled."""
    async def checker(user: User):
        from app.services.auth_service import get_current_user
        limits = get_plan_limits(user.plan_tier)
        if not limits.get(feature, False):
            raise HTTPException(
                status_code=402,
                detail=f"Feature '{feature}' is not available on your current plan. Please upgrade.",
            )
        return user
    return checker


async def get_usage_summary(user: User, db: AsyncSession) -> dict:
    """Get current month usage vs limits."""
    limits = get_plan_limits(user.plan_tier)
    month_year = datetime.now().strftime("%Y-%m")

    resources = ["clone_jobs", "generation_chars", "detection_minutes"]
    usage = {}
    for r in resources:
        used = await get_monthly_usage(user.id, r, db)
        limit = limits.get(f"{r}_monthly", 0)
        usage[r] = {
            "used": used,
            "limit": limit,
            "unlimited": limit == -1,
            "percentage": round(used / limit * 100, 1) if limit > 0 else 0,
        }

    # Voice profiles
    result = await db.execute(
        select(func.count(VoiceProfile.id)).where(
            VoiceProfile.owner_id == user.id, VoiceProfile.is_active == True
        )
    )
    vp_count = result.scalar() or 0
    vp_limit = limits["voice_profiles"]
    usage["voice_profiles"] = {
        "used": vp_count,
        "limit": vp_limit,
        "unlimited": vp_limit == -1,
        "percentage": round(vp_count / vp_limit * 100, 1) if vp_limit > 0 else 0,
    }

    return {
        "plan_tier": user.plan_tier,
        "month_year": month_year,
        "usage": usage,
        "features": {k: v for k, v in limits.items() if isinstance(v, bool)},
    }
