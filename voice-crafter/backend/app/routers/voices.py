"""Voice-Crafter Voice Profiles Router"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_, update
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid, logging

from app.database import get_db
from app.models import User, VoiceProfile, VoiceSample, VoiceVersion, VoiceLike, VoiceComment, VoiceVisibility, AuditLog, AuditAction
from app.services.auth_service import get_current_user
from app.services.entitlement_service import check_voice_profile_quota

router = APIRouter()
logger = logging.getLogger(__name__)


class VoiceProfileCreate(BaseModel):
    name: str
    description: Optional[str] = None
    language: str = "en"
    gender: Optional[str] = None
    age_style: Optional[str] = None
    accent: Optional[str] = None
    speaking_style: Optional[str] = None
    emotion_tags: List[str] = []
    use_case_tags: List[str] = []
    custom_tags: List[str] = []
    visibility: str = "private"
    license_type: str = "personal"
    consent_verified: bool = False
    consent_text: Optional[str] = None


class VoiceProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    gender: Optional[str] = None
    age_style: Optional[str] = None
    accent: Optional[str] = None
    speaking_style: Optional[str] = None
    emotion_tags: Optional[List[str]] = None
    use_case_tags: Optional[List[str]] = None
    custom_tags: Optional[List[str]] = None
    visibility: Optional[str] = None


def voice_to_dict(v: VoiceProfile, current_user_id: str = None) -> dict:
    return {
        "id": v.id, "name": v.name, "description": v.description,
        "owner_id": v.owner_id, "language": v.language, "gender": v.gender,
        "age_style": v.age_style, "accent": v.accent, "speaking_style": v.speaking_style,
        "emotion_tags": v.emotion_tags or [], "use_case_tags": v.use_case_tags or [],
        "custom_tags": v.custom_tags or [], "visibility": v.visibility,
        "avatar_url": v.avatar_url, "preview_url": v.preview_url,
        "base_model": v.base_model, "fine_tuned": v.fine_tuned,
        "quality_score": v.quality_score, "similarity_score": v.similarity_score,
        "likes_count": v.likes_count, "plays_count": v.plays_count,
        "clones_count": v.clones_count, "downloads_count": v.downloads_count,
        "training_status": v.training_status, "is_active": v.is_active,
        "is_archived": v.is_archived, "is_hub_featured": v.is_hub_featured,
        "license_type": v.license_type, "consent_verified": v.consent_verified,
        "is_synthetic": v.is_synthetic,
        "created_at": v.created_at, "updated_at": v.updated_at,
    }


@router.post("/", status_code=201)
async def create_voice_profile(
    body: VoiceProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_voice_profile_quota(current_user, db)
    if body.visibility not in ["private", "organization", "public"]:
        raise HTTPException(400, "Invalid visibility")
    profile = VoiceProfile(
        owner_id=current_user.id,
        name=body.name, description=body.description,
        language=body.language, gender=body.gender, age_style=body.age_style,
        accent=body.accent, speaking_style=body.speaking_style,
        emotion_tags=body.emotion_tags, use_case_tags=body.use_case_tags,
        custom_tags=body.custom_tags, visibility=body.visibility,
        license_type=body.license_type, consent_verified=body.consent_verified,
        consent_text=body.consent_text,
    )
    db.add(profile)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.VOICE_CREATE,
                    resource_type="voice_profile", details={"name": body.name}))
    await db.commit()
    await db.refresh(profile)
    return voice_to_dict(profile)


@router.get("/")
async def list_my_voices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    language: Optional[str] = None,
    visibility: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(VoiceProfile).where(
        VoiceProfile.owner_id == current_user.id,
        VoiceProfile.is_active == True,
    )
    if search:
        q = q.where(or_(VoiceProfile.name.ilike(f"%{search}%"), VoiceProfile.description.ilike(f"%{search}%")))
    if language:
        q = q.where(VoiceProfile.language == language)
    if visibility:
        q = q.where(VoiceProfile.visibility == visibility)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    result = await db.execute(q.order_by(desc(VoiceProfile.created_at)).offset((page-1)*page_size).limit(page_size))
    voices = result.scalars().all()
    return {"total": total, "page": page, "page_size": page_size, "voices": [voice_to_dict(v) for v in voices]}


@router.get("/{voice_id}")
async def get_voice(voice_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == voice_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Voice not found")
    if v.owner_id != current_user.id and v.visibility == "private":
        raise HTTPException(403, "Access denied")
    return voice_to_dict(v)


@router.put("/{voice_id}")
async def update_voice(
    voice_id: str, body: VoiceProfileUpdate,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == voice_id, VoiceProfile.owner_id == current_user.id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Voice not found")
    for field, val in body.dict(exclude_none=True).items():
        setattr(v, field, val)
    v.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(v)
    return voice_to_dict(v)


@router.delete("/{voice_id}")
async def delete_voice(voice_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == voice_id, VoiceProfile.owner_id == current_user.id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Voice not found")
    v.is_active = False
    v.is_archived = True
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.VOICE_DELETE,
                    resource_type="voice_profile", resource_id=voice_id))
    await db.commit()
    return {"message": "Voice archived"}


@router.post("/{voice_id}/like")
async def toggle_like(voice_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == voice_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Voice not found")
    existing = await db.execute(select(VoiceLike).where(VoiceLike.voice_profile_id == voice_id, VoiceLike.user_id == current_user.id))
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        v.likes_count = max(0, v.likes_count - 1)
        liked = False
    else:
        db.add(VoiceLike(voice_profile_id=voice_id, user_id=current_user.id))
        v.likes_count += 1
        liked = True
    await db.commit()
    return {"liked": liked, "likes_count": v.likes_count}


@router.post("/{voice_id}/comments")
async def add_comment(
    voice_id: str, content: str, parent_id: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if len(content.strip()) < 1 or len(content) > 2000:
        raise HTTPException(400, "Comment must be 1-2000 characters")
    comment = VoiceComment(voice_profile_id=voice_id, user_id=current_user.id,
                           content=content.strip(), parent_id=parent_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {"id": comment.id, "content": comment.content, "created_at": comment.created_at}


@router.get("/{voice_id}/comments")
async def list_comments(voice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VoiceComment, User.username, User.display_name, User.avatar_url)
        .join(User, VoiceComment.user_id == User.id)
        .where(VoiceComment.voice_profile_id == voice_id, VoiceComment.is_deleted == False, VoiceComment.parent_id == None)
        .order_by(desc(VoiceComment.created_at))
    )
    rows = result.all()
    return [{"id": r[0].id, "content": r[0].content, "user": {"username": r[1], "display_name": r[2], "avatar_url": r[3]}, "created_at": r[0].created_at} for r in rows]
