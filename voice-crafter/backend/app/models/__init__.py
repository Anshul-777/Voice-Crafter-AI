"""
Voice-Crafter Database Models
Complete schema for the enterprise voice AI platform.
"""

import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, 
    ForeignKey, JSON, Enum, BigInteger, Index, UniqueConstraint,
    CheckConstraint, event
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
try:
    from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
except Exception:
    UUID = String
    JSONB = JSON
    ARRAY = JSON
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


# ─── Enums ───────────────────────────────────────────────────────────────────

class PlanTier(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class UserRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"
    OWNER = "owner"
    SUPER_ADMIN = "super_admin"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class VoiceVisibility(str, enum.Enum):
    PRIVATE = "private"
    ORGANIZATION = "organization"
    PUBLIC = "public"


class DetectionVerdict(str, enum.Enum):
    AUTHENTIC = "authentic"
    SYNTHETIC_TTS = "synthetic_tts"
    VOICE_CONVERSION = "voice_conversion"
    PARTIAL_MANIPULATION = "partial_manipulation"
    INCONCLUSIVE = "inconclusive"


class AuditAction(str, enum.Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    REGISTER = "register"
    PROFILE_UPDATE = "profile_update"
    VOICE_CREATE = "voice_create"
    VOICE_DELETE = "voice_delete"
    CLONE_START = "clone_start"
    CLONE_COMPLETE = "clone_complete"
    GENERATION_START = "generation_start"
    GENERATION_COMPLETE = "generation_complete"
    DETECTION_START = "detection_start"
    DETECTION_COMPLETE = "detection_complete"
    PLAN_CHANGE = "plan_change"
    API_KEY_CREATE = "api_key_create"
    API_KEY_REVOKE = "api_key_revoke"
    EXPORT_CREATE = "export_create"
    MEMBER_INVITE = "member_invite"
    MEMBER_REMOVE = "member_remove"
    SETTINGS_CHANGE = "settings_change"
    FILE_UPLOAD = "file_upload"
    EVIDENCE_EXPORT = "evidence_export"


class NotificationType(str, enum.Enum):
    CLONE_COMPLETE = "clone_complete"
    CLONE_FAILED = "clone_failed"
    GENERATION_COMPLETE = "generation_complete"
    DETECTION_ALERT = "detection_alert"
    QUOTA_WARNING = "quota_warning"
    QUOTA_EXCEEDED = "quota_exceeded"
    PLAN_CHANGED = "plan_changed"
    MEMBER_JOINED = "member_joined"
    FILE_VALIDATED = "file_validated"
    FILE_FAILED = "file_failed"
    SYSTEM_ALERT = "system_alert"
    NEW_FOLLOWER = "new_follower"
    VOICE_LIKED = "voice_liked"
    COMMENT_RECEIVED = "comment_received"


class StreamSessionType(str, enum.Enum):
    DETECTION = "detection"
    GENERATION = "generation"
    CLONING = "cloning"


# ─── Users & Auth ─────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Auth
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    oauth_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    oauth_provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Plan
    plan_tier: Mapped[PlanTier] = mapped_column(Enum(PlanTier), default=PlanTier.FREE)
    plan_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Preferences
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    theme: Mapped[str] = mapped_column(String(20), default="light")

    # Social stats (cached)
    followers_count: Mapped[int] = mapped_column(Integer, default=0)
    following_count: Mapped[int] = mapped_column(Integer, default=0)
    voices_count: Mapped[int] = mapped_column(Integer, default=0)
    plays_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    api_keys: Mapped[List["APIKey"]] = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    voice_profiles: Mapped[List["VoiceProfile"]] = relationship("VoiceProfile", back_populates="owner", cascade="all, delete-orphan")
    clone_jobs: Mapped[List["CloneJob"]] = relationship("CloneJob", back_populates="user", cascade="all, delete-orphan")
    generation_jobs: Mapped[List["GenerationJob"]] = relationship("GenerationJob", back_populates="user", cascade="all, delete-orphan")
    detection_jobs: Mapped[List["DetectionJob"]] = relationship("DetectionJob", back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    usage_records: Mapped[List["UsageRecord"]] = relationship("UsageRecord", back_populates="user", cascade="all, delete-orphan")
    org_memberships: Mapped[List["OrganizationMember"]] = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_plan_tier", "plan_tier"),
        Index("ix_users_created_at", "created_at"),
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    device_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False)   # first 8 chars for display
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    scopes: Mapped[List[str]] = mapped_column(JSON, default=list)
    rate_limit_rpm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    usage_count: Mapped[int] = mapped_column(BigInteger, default=0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="api_keys")


# ─── Organizations & Teams ────────────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    plan_tier: Mapped[PlanTier] = mapped_column(Enum(PlanTier), default=PlanTier.FREE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    members: Mapped[List["OrganizationMember"]] = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    invitations: Mapped[List["OrganizationInvitation"]] = relationship("OrganizationInvitation", back_populates="organization", cascade="all, delete-orphan")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.MEMBER)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    permissions: Mapped[List[str]] = mapped_column(JSON, default=list)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="org_memberships")

    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_member"),)


class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.MEMBER)
    invited_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="invitations")


# ─── Voice Profiles ───────────────────────────────────────────────────────────

class VoiceProfile(Base):
    __tablename__ = "voice_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    org_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    preview_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Voice attributes
    language: Mapped[str] = mapped_column(String(10), default="en")
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    age_style: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    accent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    speaking_style: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emotion_tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    use_case_tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    custom_tags: Mapped[List[str]] = mapped_column(JSON, default=list)

    # Visibility & social
    visibility: Mapped[VoiceVisibility] = mapped_column(Enum(VoiceVisibility), default=VoiceVisibility.PRIVATE)
    is_hub_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    plays_count: Mapped[int] = mapped_column(Integer, default=0)
    clones_count: Mapped[int] = mapped_column(Integer, default=0)
    downloads_count: Mapped[int] = mapped_column(Integer, default=0)

    # Model info
    base_model: Mapped[str] = mapped_column(String(100), default="xtts_v2")
    embedding_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fine_tuned: Mapped[bool] = mapped_column(Boolean, default=False)
    fine_tune_steps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Quality metrics
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    similarity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    naturalness_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Licensing
    license_type: Mapped[str] = mapped_column(String(50), default="personal")
    consent_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)

    # State
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    training_status: Mapped[str] = mapped_column(String(20), default="ready")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="voice_profiles")
    samples: Mapped[List["VoiceSample"]] = relationship("VoiceSample", back_populates="voice_profile", cascade="all, delete-orphan")
    versions: Mapped[List["VoiceVersion"]] = relationship("VoiceVersion", back_populates="voice_profile", cascade="all, delete-orphan")
    clone_jobs: Mapped[List["CloneJob"]] = relationship("CloneJob", back_populates="voice_profile")
    generation_jobs: Mapped[List["GenerationJob"]] = relationship("GenerationJob", back_populates="voice_profile")
    likes: Mapped[List["VoiceLike"]] = relationship("VoiceLike", back_populates="voice_profile", cascade="all, delete-orphan")
    comments: Mapped[List["VoiceComment"]] = relationship("VoiceComment", back_populates="voice_profile", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_voice_profiles_owner_id", "owner_id"),
        Index("ix_voice_profiles_visibility", "visibility"),
        Index("ix_voice_profiles_language", "language"),
    )


class VoiceSample(Base):
    __tablename__ = "voice_samples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    voice_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("voice_profiles.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    sample_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Quality analysis
    snr_db: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speech_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    noise_level: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quality_issues: Mapped[List[str]] = mapped_column(JSON, default=list)
    is_suitable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    voice_profile: Mapped["VoiceProfile"] = relationship("VoiceProfile", back_populates="samples")


class VoiceVersion(Base):
    __tablename__ = "voice_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    voice_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("voice_profiles.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    embedding_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    voice_profile: Mapped["VoiceProfile"] = relationship("VoiceProfile", back_populates="versions")


class VoiceLike(Base):
    __tablename__ = "voice_likes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    voice_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("voice_profiles.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    voice_profile: Mapped["VoiceProfile"] = relationship("VoiceProfile", back_populates="likes")

    __table_args__ = (UniqueConstraint("voice_profile_id", "user_id", name="uq_voice_like"),)


class VoiceComment(Base):
    __tablename__ = "voice_comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    voice_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("voice_profiles.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("voice_comments.id"), nullable=True)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    voice_profile: Mapped["VoiceProfile"] = relationship("VoiceProfile", back_populates="comments")


# ─── Social Features ──────────────────────────────────────────────────────────

class UserFollow(Base):
    __tablename__ = "user_follows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    follower_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    following_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_user_follow"),)


# ─── Jobs ─────────────────────────────────────────────────────────────────────

class CloneJob(Base):
    __tablename__ = "clone_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    voice_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("voice_profiles.id"))
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    progress_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Config
    mode: Mapped[str] = mapped_column(String(20), default="zero_shot")  # zero_shot | fine_tune
    fine_tune_steps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), default="xtts_v2")

    # Results
    embedding_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    preview_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    similarity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    # Timing
    queued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="clone_jobs")
    voice_profile: Mapped["VoiceProfile"] = relationship("VoiceProfile", back_populates="clone_jobs")


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    voice_profile_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("voice_profiles.id"), nullable=True)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    progress: Mapped[float] = mapped_column(Float, default=0.0)

    # Input
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en")
    emotion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    speaking_style: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    speed: Mapped[float] = mapped_column(Float, default=1.0)
    pitch: Mapped[float] = mapped_column(Float, default=1.0)
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    output_format: Mapped[str] = mapped_column(String(10), default="wav")
    use_ssml: Mapped[bool] = mapped_column(Boolean, default=False)

    # Output
    output_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_storage_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    character_count: Mapped[int] = mapped_column(Integer, default=0)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    sample_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # State
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_streaming: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="generation_jobs")
    voice_profile: Mapped[Optional["VoiceProfile"]] = relationship("VoiceProfile", back_populates="generation_jobs")


class DetectionJob(Base):
    __tablename__ = "detection_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    mode: Mapped[str] = mapped_column(String(20), default="file")   # file | stream

    # Input
    input_storage_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    input_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sample_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Ensemble result
    verdict: Mapped[Optional[DetectionVerdict]] = mapped_column(Enum(DetectionVerdict), nullable=True)
    ensemble_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_synthetic: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Per-model scores
    aasist_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rawnet2_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    prosodic_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    spectral_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    glottal_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Segment timeline
    segments: Mapped[List[dict]] = mapped_column(JSON, default=list)
    suspicious_segments: Mapped[List[dict]] = mapped_column(JSON, default=list)
    confidence_timeline: Mapped[List[dict]] = mapped_column(JSON, default=list)

    # Speaker diarization
    speakers: Mapped[List[dict]] = mapped_column(JSON, default=list)
    diarization_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Evidence
    evidence_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    evidence_report_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    chain_of_custody: Mapped[List[dict]] = mapped_column(JSON, default=list)

    # Explanation
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    flagged_reasons: Mapped[List[str]] = mapped_column(JSON, default=list)
    model_versions: Mapped[dict] = mapped_column(JSON, default=dict)
    analyst_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Threshold used
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.65)

    # Timing
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="detection_jobs")


class StreamSession(Base):
    __tablename__ = "stream_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    session_type: Mapped[StreamSessionType] = mapped_column(Enum(StreamSessionType))
    ws_connection_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="active")
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    total_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)

    # For detection streams
    current_verdict: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    current_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detection_job_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("detection_jobs.id"), nullable=True)

    extra_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ─── Plans & Billing ──────────────────────────────────────────────────────────

class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    tier: Mapped[PlanTier] = mapped_column(Enum(PlanTier), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_monthly_usd: Mapped[float] = mapped_column(Float, default=0.0)
    price_yearly_usd: Mapped[float] = mapped_column(Float, default=0.0)

    # Limits
    max_voice_profiles: Mapped[int] = mapped_column(Integer, default=2)
    max_clone_jobs_monthly: Mapped[int] = mapped_column(Integer, default=5)
    max_generation_chars_monthly: Mapped[int] = mapped_column(Integer, default=10_000)
    max_detection_minutes_monthly: Mapped[int] = mapped_column(Integer, default=30)
    max_storage_mb: Mapped[int] = mapped_column(Integer, default=500)
    max_api_keys: Mapped[int] = mapped_column(Integer, default=1)
    max_org_members: Mapped[int] = mapped_column(Integer, default=1)
    rate_limit_rpm: Mapped[int] = mapped_column(Integer, default=30)
    max_upload_size_mb: Mapped[int] = mapped_column(Integer, default=50)

    # Features
    has_streaming: Mapped[bool] = mapped_column(Boolean, default=False)
    has_fine_tuning: Mapped[bool] = mapped_column(Boolean, default=False)
    has_diarization: Mapped[bool] = mapped_column(Boolean, default=False)
    has_evidence_export: Mapped[bool] = mapped_column(Boolean, default=False)
    has_api_access: Mapped[bool] = mapped_column(Boolean, default=False)
    has_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    has_hub_publish: Mapped[bool] = mapped_column(Boolean, default=False)
    has_ssml: Mapped[bool] = mapped_column(Boolean, default=False)
    has_priority_queue: Mapped[bool] = mapped_column(Boolean, default=False)
    has_sla: Mapped[bool] = mapped_column(Boolean, default=False)
    has_custom_models: Mapped[bool] = mapped_column(Boolean, default=False)

    stripe_monthly_price_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stripe_yearly_price_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    plan_tier: Mapped[PlanTier] = mapped_column(Enum(PlanTier), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String(20), default="monthly")  # monthly | yearly
    status: Mapped[str] = mapped_column(String(20), default="active")
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    org_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    month_year: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[str] = mapped_column(String(20), default="count")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="usage_records")

    __table_args__ = (
        UniqueConstraint("user_id", "month_year", "resource_type", name="uq_usage_record"),
        Index("ix_usage_records_month_year", "month_year"),
    )


# ─── File Uploads ─────────────────────────────────────────────────────────────

class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), nullable=False)  # voice_sample | detection | generation
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | validated | rejected
    validation_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ─── Notifications ────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user_id_read", "user_id", "is_read"),
    )


# ─── Audit Logs ───────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    org_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="success")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )


# ─── Model Registry ───────────────────────────────────────────────────────────

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    model_type: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checkpoint_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    performance_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    hardware_requirements: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    model_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("model_versions.id"))
    dataset_name: Mapped[str] = mapped_column(String(100), nullable=False)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    precision: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recall: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    f1_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eer: Mapped[Optional[float]] = mapped_column(Float, nullable=True)          # Equal Error Rate
    auc_roc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    false_positive_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    false_negative_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    p95_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    throughput_rps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sample_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    run_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ─── Quality Analysis ─────────────────────────────────────────────────────────

class QualityAnalysis(Base):
    __tablename__ = "quality_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("uploaded_files.id"))
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)

    # Core metrics
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    sample_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    bit_depth: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    channels: Mapped[int] = mapped_column(Integer, default=1)
    format: Mapped[str] = mapped_column(String(20), nullable=False)

    # Audio quality
    snr_db: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lufs: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    peak_db: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rms_db: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dynamic_range_db: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    clipping_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Speech analysis
    speech_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speech_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pause_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    avg_pause_duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pitch_mean_hz: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pitch_std_hz: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speaking_rate_wpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Noise
    noise_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    background_noise_level: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reverb_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Overall
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    suitability: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    issues: Mapped[List[str]] = mapped_column(JSON, default=list)
    recommendations: Mapped[List[str]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
