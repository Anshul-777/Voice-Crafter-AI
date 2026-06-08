"""
Voice-Crafter Authentication Router
JWT auth, refresh tokens, email verification, password reset, OAuth.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, BackgroundTasks, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
import logging

from app.database import get_db
from app.models import User, RefreshToken, EmailVerification, PasswordReset, AuditLog, AuditAction
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user
)
from app.services.notification_service import send_verification_email, send_password_reset_email
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    display_name: str
    password: str

    @validator("username")
    def username_valid(cls, v):
        v = v.strip().lower()
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be 3-30 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, numbers, underscores, hyphens")
        return v

    @validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @validator("display_name")
    def display_name_valid(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 60:
            raise ValueError("Display name must be 2-60 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class EmailVerifyRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @validator("new_password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account."""
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check username uniqueness
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create user
    user = User(
        email=body.email,
        username=body.username,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    # Create email verification token
    raw_token = secrets.token_urlsafe(32)
    verification = EmailVerification(
        user_id=user.id,
        token=raw_token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(verification)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action=AuditAction.REGISTER,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"email": body.email, "username": body.username},
    )
    db.add(audit)
    await db.commit()

    # Send verification email in background
    background_tasks.add_task(
        send_verification_email, user.email, user.display_name, raw_token
    )

    logger.info(f"New user registered: {user.email} ({user.id})")

    return {
        "message": "Account created successfully. Please check your email to verify your account.",
        "user_id": user.id,
        "email": user.email,
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and receive JWT tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        # Audit failed attempt
        audit = AuditLog(
            action=AuditAction.LOGIN,
            ip_address=request.client.host if request.client else None,
            details={"email": body.email, "success": False, "reason": "invalid_credentials"},
            status="failure",
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Create tokens
    access_token = create_access_token({"sub": user.id, "email": user.email})
    raw_refresh = secrets.token_urlsafe(64)
    refresh_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()

    refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        device_info=request.headers.get("user-agent", "")[:255],
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_token)

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=user.id,
        action=AuditAction.LOGIN,
        ip_address=request.client.host if request.client else None,
        details={"email": body.email, "success": True},
    )
    db.add(audit)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "plan_tier": user.plan_tier,
            "is_verified": user.is_verified,
        },
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a refresh token for new access + refresh tokens."""
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    refresh_record = result.scalar_one_or_none()

    if not refresh_record:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Get user
    result = await db.execute(select(User).where(User.id == refresh_record.user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Revoke old refresh token
    refresh_record.revoked_at = datetime.now(timezone.utc)

    # Issue new tokens
    access_token = create_access_token({"sub": user.id, "email": user.email})
    new_raw_refresh = secrets.token_urlsafe(64)
    new_hash = hashlib.sha256(new_raw_refresh.encode()).hexdigest()

    new_refresh = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        device_info=refresh_record.device_info,
        ip_address=refresh_record.ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_refresh)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "plan_tier": user.plan_tier,
            "is_verified": user.is_verified,
        },
    }


@router.post("/logout")
async def logout(
    body: RefreshRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke the refresh token and invalidate the session."""
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == current_user.id,
        )
    )
    refresh_record = result.scalar_one_or_none()
    if refresh_record:
        refresh_record.revoked_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.LOGOUT,
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return {"message": "Logged out successfully"}


@router.post("/verify-email")
async def verify_email(
    body: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify email address with token from verification email."""
    result = await db.execute(
        select(EmailVerification).where(
            EmailVerification.token == body.token,
            EmailVerification.used_at.is_(None),
            EmailVerification.expires_at > datetime.now(timezone.utc),
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    # Mark token as used
    record.used_at = datetime.now(timezone.utc)

    # Verify user
    result = await db.execute(select(User).where(User.id == record.user_id))
    user = result.scalar_one_or_none()
    if user:
        user.is_verified = True
        user.email_verified_at = datetime.now(timezone.utc)

    await db.commit()
    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Send password reset email."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user and user.is_active:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        reset = PasswordReset(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        )
        db.add(reset)
        await db.commit()

        background_tasks.add_task(
            send_password_reset_email, user.email, user.display_name, raw_token
        )

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using token from email."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    result = await db.execute(
        select(PasswordReset).where(
            PasswordReset.token_hash == token_hash,
            PasswordReset.used_at.is_(None),
            PasswordReset.expires_at > datetime.now(timezone.utc),
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    record.used_at = datetime.now(timezone.utc)

    result = await db.execute(select(User).where(User.id == record.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    await db.commit()

    return {"message": "Password reset successfully. You may now log in."}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current authenticated user profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "bio": current_user.bio,
        "website": current_user.website,
        "location": current_user.location,
        "plan_tier": current_user.plan_tier,
        "plan_expires_at": current_user.plan_expires_at,
        "is_verified": current_user.is_verified,
        "is_active": current_user.is_active,
        "preferred_language": current_user.preferred_language,
        "timezone": current_user.timezone,
        "email_notifications": current_user.email_notifications,
        "followers_count": current_user.followers_count,
        "following_count": current_user.following_count,
        "voices_count": current_user.voices_count,
        "plays_count": current_user.plays_count,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at,
    }


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for authenticated user."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}
