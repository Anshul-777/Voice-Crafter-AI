#!/usr/bin/env python3
"""
Voice-Crafter database initialization script.
Run once after setting up the database.
Creates tables and inserts required seed data (plans).
"""
import asyncio, sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

async def main():
    from app.database import engine, Base, SessionLocal
    from app.models import Plan, PlanTier
    from sqlalchemy import select

    log.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("✅ Tables created")

    log.info("Seeding plan definitions...")
    async with SessionLocal() as db:
        existing = (await db.execute(select(Plan))).scalars().all()
        if existing:
            log.info(f"  Plans already exist ({len(existing)} found), skipping seed")
        else:
            plans = [
                Plan(tier=PlanTier.FREE, name="Free", price_monthly_usd=0, price_yearly_usd=0,
                     max_voice_profiles=2, max_clone_jobs_monthly=5,
                     max_generation_chars_monthly=10_000, max_detection_minutes_monthly=30,
                     max_storage_mb=500, max_api_keys=0, max_org_members=1, rate_limit_rpm=30,
                     max_upload_size_mb=50, has_streaming=False, has_fine_tuning=False,
                     has_diarization=False, has_evidence_export=False, has_api_access=False,
                     has_analytics=False, has_hub_publish=False, has_ssml=False),
                Plan(tier=PlanTier.STARTER, name="Starter", price_monthly_usd=19, price_yearly_usd=190,
                     max_voice_profiles=10, max_clone_jobs_monthly=50,
                     max_generation_chars_monthly=100_000, max_detection_minutes_monthly=300,
                     max_storage_mb=5000, max_api_keys=3, max_org_members=5, rate_limit_rpm=120,
                     max_upload_size_mb=100, has_streaming=True, has_fine_tuning=False,
                     has_diarization=True, has_evidence_export=True, has_api_access=True,
                     has_analytics=True, has_hub_publish=True, has_ssml=False),
                Plan(tier=PlanTier.PRO, name="Pro", price_monthly_usd=79, price_yearly_usd=790,
                     max_voice_profiles=50, max_clone_jobs_monthly=500,
                     max_generation_chars_monthly=1_000_000, max_detection_minutes_monthly=3000,
                     max_storage_mb=50_000, max_api_keys=10, max_org_members=25, rate_limit_rpm=600,
                     max_upload_size_mb=200, has_streaming=True, has_fine_tuning=True,
                     has_diarization=True, has_evidence_export=True, has_api_access=True,
                     has_analytics=True, has_hub_publish=True, has_ssml=True,
                     has_priority_queue=True),
                Plan(tier=PlanTier.ENTERPRISE, name="Enterprise", price_monthly_usd=299, price_yearly_usd=2990,
                     max_voice_profiles=-1, max_clone_jobs_monthly=-1,
                     max_generation_chars_monthly=-1, max_detection_minutes_monthly=-1,
                     max_storage_mb=-1, max_api_keys=-1, max_org_members=-1, rate_limit_rpm=3000,
                     max_upload_size_mb=500, has_streaming=True, has_fine_tuning=True,
                     has_diarization=True, has_evidence_export=True, has_api_access=True,
                     has_analytics=True, has_hub_publish=True, has_ssml=True,
                     has_priority_queue=True, has_sla=True, has_custom_models=True),
            ]
            for p in plans:
                db.add(p)
            await db.commit()
            log.info(f"✅ Created {len(plans)} plan definitions")

    log.info("")
    log.info("✅ Database initialization complete!")
    log.info("   Next: Create your first user via POST /api/v1/auth/register")

if __name__ == "__main__":
    asyncio.run(main())
