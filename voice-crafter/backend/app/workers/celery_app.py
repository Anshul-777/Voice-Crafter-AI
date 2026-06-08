"""Voice-Crafter Celery Application"""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "voice_crafter",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.detection_tasks",
        "app.workers.cloning_tasks",
        "app.workers.generation_tasks",
        "app.workers.quality_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "detection.*": {"queue": "detection"},
        "cloning.*": {"queue": "cloning"},
        "generation.*": {"queue": "generation"},
    },
    beat_schedule={
        "cleanup-expired-files": {
            "task": "app.workers.maintenance.cleanup_expired_files",
            "schedule": 3600.0,
        },
        "reset-monthly-usage": {
            "task": "app.workers.maintenance.check_usage_resets",
            "schedule": 86400.0,
        },
    },
)
