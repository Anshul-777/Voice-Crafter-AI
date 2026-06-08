"""Voice-Crafter Background Scheduler"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging

logger = logging.getLogger(__name__)


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_cleanup_expired_tokens, "interval", hours=6, id="cleanup_tokens")
    scheduler.add_job(_update_social_counts, "interval", minutes=30, id="social_counts")
    scheduler.start()
    logger.info("Background scheduler started")
    return scheduler


async def _cleanup_expired_tokens():
    try:
        from app.database import SessionLocal
        from app.models import RefreshToken, EmailVerification, PasswordReset
        from sqlalchemy import delete
        from datetime import datetime, timezone
        async with SessionLocal() as db:
            now = datetime.now(timezone.utc)
            await db.execute(delete(RefreshToken).where(RefreshToken.expires_at < now))
            await db.execute(delete(EmailVerification).where(EmailVerification.expires_at < now))
            await db.execute(delete(PasswordReset).where(PasswordReset.expires_at < now))
            await db.commit()
    except Exception as e:
        logger.error(f"Token cleanup failed: {e}")


async def _update_social_counts():
    try:
        from app.database import SessionLocal
        from app.models import User, VoiceProfile, VoiceLike, UserFollow
        from sqlalchemy import select, func, update
        async with SessionLocal() as db:
            # Update voice counts per user
            result = await db.execute(
                select(VoiceProfile.owner_id, func.count(VoiceProfile.id).label("cnt"))
                .where(VoiceProfile.is_active == True, VoiceProfile.is_archived == False)
                .group_by(VoiceProfile.owner_id)
            )
            for row in result:
                await db.execute(
                    update(User).where(User.id == row.owner_id).values(voices_count=row.cnt)
                )
            await db.commit()
    except Exception as e:
        logger.error(f"Social count update failed: {e}")
