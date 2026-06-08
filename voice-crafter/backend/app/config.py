"""
Voice-Crafter Platform Configuration
All settings loaded from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator
from typing import List, Optional, Union
import secrets
import os


class Settings(BaseSettings):
    """Platform-wide configuration."""

    # ── Application ─────────────────────────────────────────────────────────
    APP_NAME: str = "Voice-Crafter"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(64)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24       # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    API_KEY_PREFIX: str = "vc_"

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://voicecrafter:voicecrafter@localhost:5432/voicecrafter"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # ── Redis ────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 300           # 5 minutes default cache
    REDIS_SESSION_TTL: int = 86400       # 24 hours session
    REDIS_JOB_TTL: int = 604800          # 7 days job history

    # ── Celery Worker ────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_MAX_RETRIES: int = 3
    CELERY_TASK_TIMEOUT: int = 3600      # 1 hour max task

    # ── Storage (MinIO / S3 compatible) ─────────────────────────────────────
    STORAGE_BACKEND: str = "minio"       # minio | s3 | local
    STORAGE_ENDPOINT: str = "localhost:9000"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_SECURE: bool = False
    STORAGE_REGION: str = "us-east-1"
    BUCKET_VOICES: str = "vc-voices"
    BUCKET_SAMPLES: str = "vc-samples"
    BUCKET_OUTPUTS: str = "vc-outputs"
    BUCKET_UPLOADS: str = "vc-uploads"
    BUCKET_EVIDENCE: str = "vc-evidence"
    BUCKET_EXPORTS: str = "vc-exports"
    LOCAL_STORAGE_PATH: str = "/tmp/voice-crafter-storage"

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "https://voicecrafter.ai",
        "https://app.voicecrafter.ai",
    ]

    # ── Rate Limiting ────────────────────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_FREE_RPM: int = 30
    RATE_LIMIT_STARTER_RPM: int = 120
    RATE_LIMIT_PRO_RPM: int = 600
    RATE_LIMIT_ENTERPRISE_RPM: int = 3000
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── ML Models ────────────────────────────────────────────────────────────
    MODELS_DIR: str = "./models"
    DEVICE: str = "auto"                 # auto | cpu | cuda | mps
    TORCH_DTYPE: str = "float32"         # float32 | float16 | bfloat16

    # TTS / Voice Cloning
    TTS_MODEL: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    TTS_SAMPLE_RATE: int = 22050
    TTS_MAX_TEXT_LENGTH: int = 5000
    TTS_STREAMING_CHUNK_SIZE: int = 50  # tokens per streaming chunk

    # Detection Models
    AASIST_MODEL_PATH: str = "./models/aasist/AASIST.pth"
    RAWNET2_MODEL_PATH: str = "./models/rawnet2/RawNet2.pth"
    DETECTION_SAMPLE_RATE: int = 16000
    DETECTION_CHUNK_DURATION_MS: int = 2000   # 2-second analysis windows
    DETECTION_OVERLAP_MS: int = 500           # 500ms overlap
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.65

    # Diarization
    DIARIZATION_ENABLED: bool = True
    DIARIZATION_MODEL: str = "pyannote/speaker-diarization-3.1"
    HF_TOKEN: Optional[str] = None       # HuggingFace token for pyannote

    # ── Audio Processing ─────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 200
    SUPPORTED_AUDIO_FORMATS: List[str] = ["wav", "mp3", "flac", "ogg", "m4a", "aac", "webm"]
    AUDIO_NORMALIZATION_LEVEL: float = -23.0   # LUFS target
    MIN_SAMPLE_DURATION_SEC: float = 3.0
    MAX_SAMPLE_DURATION_SEC: float = 300.0

    # ── Plan Limits ──────────────────────────────────────────────────────────
    # Free plan
    FREE_VOICE_PROFILES: int = 2
    FREE_CLONE_JOBS_PER_MONTH: int = 5
    FREE_GENERATION_CHARS_PER_MONTH: int = 10_000
    FREE_DETECTION_MINUTES_PER_MONTH: int = 30
    FREE_STORAGE_MB: int = 500

    # Starter plan
    STARTER_VOICE_PROFILES: int = 10
    STARTER_CLONE_JOBS_PER_MONTH: int = 50
    STARTER_GENERATION_CHARS_PER_MONTH: int = 100_000
    STARTER_DETECTION_MINUTES_PER_MONTH: int = 300
    STARTER_STORAGE_MB: int = 5_000

    # Pro plan
    PRO_VOICE_PROFILES: int = 50
    PRO_CLONE_JOBS_PER_MONTH: int = 500
    PRO_GENERATION_CHARS_PER_MONTH: int = 1_000_000
    PRO_DETECTION_MINUTES_PER_MONTH: int = 3_000
    PRO_STORAGE_MB: int = 50_000

    # Enterprise plan
    ENTERPRISE_VOICE_PROFILES: int = -1   # unlimited
    ENTERPRISE_CLONE_JOBS_PER_MONTH: int = -1
    ENTERPRISE_GENERATION_CHARS_PER_MONTH: int = -1
    ENTERPRISE_DETECTION_MINUTES_PER_MONTH: int = -1
    ENTERPRISE_STORAGE_MB: int = -1

    # ── Payment (gateway placeholder) ────────────────────────────────────────
    PAYMENT_GATEWAY: str = "stripe"      # stripe | razorpay | paddle
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None

    # Stripe Price IDs
    STRIPE_STARTER_MONTHLY: Optional[str] = None
    STRIPE_STARTER_YEARLY: Optional[str] = None
    STRIPE_PRO_MONTHLY: Optional[str] = None
    STRIPE_PRO_YEARLY: Optional[str] = None
    STRIPE_ENTERPRISE_MONTHLY: Optional[str] = None

    # ── Email ────────────────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@voicecrafter.ai"
    SMTP_FROM_NAME: str = "Voice-Crafter"
    SMTP_TLS: bool = True

    # ── OAuth ────────────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None

    # ── Monitoring ───────────────────────────────────────────────────────────
    PROMETHEUS_ENABLED: bool = True
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    AUDIT_LOG_RETENTION_DAYS: int = 365

    # ── WebSocket ────────────────────────────────────────────────────────────
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS_PER_USER: int = 5
    WS_BUFFER_SIZE: int = 65536

    # ── Evidence & Chain of Custody ──────────────────────────────────────────
    EVIDENCE_HASH_ALGORITHM: str = "sha256"
    EVIDENCE_RETENTION_DAYS: int = 2555  # 7 years for legal
    CHAIN_OF_CUSTODY_ENABLED: bool = True

    # ── Feature Flags ────────────────────────────────────────────────────────
    FEATURE_CLONING: bool = True
    FEATURE_GENERATION: bool = True
    FEATURE_DETECTION: bool = True
    FEATURE_STREAMING: bool = True
    FEATURE_HUB: bool = True
    FEATURE_DIARIZATION: bool = True
    FEATURE_FINE_TUNING: bool = True
    FEATURE_RED_TEAM: bool = True
    FEATURE_BENCHMARKS: bool = True
    FEATURE_SOCIAL: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True

    @validator("DEVICE", pre=True, always=True)
    def resolve_device(cls, v):
        if v == "auto":
            try:
                import torch
                if torch.cuda.is_available():
                    return "cuda"
                elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    return "mps"
                return "cpu"
            except ImportError:
                return "cpu"
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
