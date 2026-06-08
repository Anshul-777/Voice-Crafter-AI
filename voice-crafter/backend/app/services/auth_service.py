"""
Voice-Crafter Auth Service
JWT creation/validation, password hashing, current user dependency.
"""

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
from typing import Optional, Union
import hashlib
import logging

from app.database import get_db
from app.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user from JWT or API key."""
    from app.models import User, APIKey

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = None

    # Try JWT first
    if token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")

    # Try API key
    if not user_id and api_key:
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        result = await db.execute(
            select(APIKey).where(
                APIKey.key_hash == key_hash,
                APIKey.is_active == True,
                APIKey.revoked_at.is_(None),
            )
        )
        api_key_record = result.scalar_one_or_none()
        if api_key_record:
            if api_key_record.expires_at and api_key_record.expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="API key expired")

            # Update last used
            api_key_record.last_used_at = datetime.now(timezone.utc)
            api_key_record.usage_count += 1
            await db.commit()

            user_id = api_key_record.user_id

    if not user_id:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user:
        raise credentials_exception

    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    """Require active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Inactive account")
    return current_user


async def get_superuser(current_user=Depends(get_current_user)):
    """Require superuser."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    return current_user


def require_plan(*tiers):
    """Dependency factory: require user to be on one of the given plan tiers."""
    async def checker(current_user=Depends(get_current_user)):
        if current_user.plan_tier not in tiers:
            raise HTTPException(
                status_code=402,
                detail=f"This feature requires a {' or '.join(t.value for t in tiers)} plan",
            )
        return current_user
    return checker
