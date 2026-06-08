"""
Voice-Crafter Platform - Main FastAPI Application
Enterprise Voice AI: Cloning · Generation · Detection
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
import time
import os

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.audit import AuditMiddleware
from app.routers import (
    auth, users, voices, cloning, generation,
    detection, hub, plans, admin, analytics,
    apikeys, notifications, websocket_router,
    uploads, history, audit_logs, organizations,
    quality, benchmarks, streaming
)
from app.utils.logger import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    logger.info("🚀 Voice-Crafter Platform starting up...")

    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialized")

    # Initialize model registry (best-effort)
    try:
        from app.ml.model_registry import ModelRegistry
        registry = ModelRegistry()
        await registry.initialize()
        app.state.model_registry = registry
        logger.info("✅ ML Model Registry initialized")
    except Exception as e:
        logger.warning(f"ML Model Registry initialization failed: {e}")

    # Initialize Redis connection (best-effort)
    try:
        from app.utils.redis_client import get_redis
        redis = await get_redis()
        app.state.redis = redis
        logger.info("✅ Redis connection established")
    except Exception as e:
        logger.warning(f"Redis initialization failed: {e}")

    # Initialize storage backend (best-effort)
    try:
        from app.utils.storage import StorageBackend
        storage = StorageBackend()
        await storage.ensure_buckets()
        app.state.storage = storage
        logger.info("✅ Storage backend ready")
    except Exception as e:
        logger.warning(f"Storage backend initialization failed: {e}")

    # Start background scheduler (best-effort)
    try:
        from app.workers.scheduler import start_scheduler
        scheduler = start_scheduler()
        app.state.scheduler = scheduler
        logger.info("✅ Background scheduler started")
    except Exception as e:
        logger.warning(f"Scheduler start failed: {e}")

    logger.info("🎙️ Voice-Crafter Platform is LIVE")
    yield

    # Shutdown
    logger.info("🛑 Voice-Crafter shutting down...")
    if hasattr(app.state, 'scheduler'):
        app.state.scheduler.shutdown()
    if hasattr(app.state, 'redis'):
        await app.state.redis.close()
    logger.info("✅ Shutdown complete")


app = FastAPI(
    title="Voice-Crafter API",
    description="""
    ## Voice-Crafter: Enterprise Voice AI Platform

    The most complete all-in-one platform for:
    - **Voice Cloning** - Zero-shot & fine-tuned speaker cloning
    - **Voice Generation** - Expressive TTS with emotion & style control
    - **Deepfake Detection** - Multi-model ensemble fraud defense
    - **Live Streaming** - Real-time voice analysis & synthesis
    - **Public Voice Hub** - Community voice template library

    ### Authentication
    - Bearer token (JWT) for user sessions
    - API Key for programmatic access
    - OAuth2 for enterprise SSO

    ### Rate Limits
    Enforced per plan tier. See /api/v1/plans for current limits.
    """,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Middleware Stack ──────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Rate-Limit-Remaining", "X-Rate-Limit-Reset"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditMiddleware)


@app.middleware("http")
async def add_request_metadata(request: Request, call_next):
    """Add request ID and timing to every request."""
    import uuid
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = time.time()

    response = await call_next(request)

    process_time = (time.time() - start_time) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response


# ── Global Exception Handlers ─────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "not_found", "message": "Resource not found", "path": str(request.url)},
    )


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An internal server error occurred"},
    )


# ── API Routers ───────────────────────────────────────────────────────────────

API_PREFIX = "/api/v1"

app.include_router(auth.router,          prefix=f"{API_PREFIX}/auth",          tags=["Authentication"])
app.include_router(users.router,         prefix=f"{API_PREFIX}/users",         tags=["Users"])
app.include_router(organizations.router, prefix=f"{API_PREFIX}/organizations", tags=["Organizations"])
app.include_router(voices.router,        prefix=f"{API_PREFIX}/voices",        tags=["Voice Profiles"])
app.include_router(cloning.router,       prefix=f"{API_PREFIX}/cloning",       tags=["Voice Cloning"])
app.include_router(generation.router,    prefix=f"{API_PREFIX}/generation",    tags=["Voice Generation"])
app.include_router(detection.router,     prefix=f"{API_PREFIX}/detection",     tags=["Deepfake Detection"])
app.include_router(streaming.router,     prefix=f"{API_PREFIX}/streaming",     tags=["Live Streaming"])
app.include_router(hub.router,           prefix=f"{API_PREFIX}/hub",           tags=["Public Voice Hub"])
app.include_router(plans.router,         prefix=f"{API_PREFIX}/plans",         tags=["Plans & Billing"])
app.include_router(apikeys.router,       prefix=f"{API_PREFIX}/api-keys",      tags=["API Keys"])
app.include_router(analytics.router,     prefix=f"{API_PREFIX}/analytics",     tags=["Analytics"])
app.include_router(notifications.router, prefix=f"{API_PREFIX}/notifications", tags=["Notifications"])
app.include_router(uploads.router,       prefix=f"{API_PREFIX}/uploads",       tags=["File Uploads"])
app.include_router(history.router,       prefix=f"{API_PREFIX}/history",       tags=["History"])
app.include_router(audit_logs.router,    prefix=f"{API_PREFIX}/audit",         tags=["Audit Logs"])
app.include_router(quality.router,       prefix=f"{API_PREFIX}/quality",       tags=["Quality Analysis"])
app.include_router(benchmarks.router,    prefix=f"{API_PREFIX}/benchmarks",    tags=["Benchmarks"])
app.include_router(admin.router,         prefix=f"{API_PREFIX}/admin",         tags=["Admin"])
app.include_router(websocket_router.router, prefix="/ws",                       tags=["WebSocket"])


# ── Health & Info Endpoints ───────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check(request: Request):
    """Platform health check with component status."""
    try:
        from app.utils.redis_client import get_redis
        components = {}

        # Check database
        try:
            from sqlalchemy import text
            async with SessionLocal() as db:
                await db.execute(text("SELECT 1"))
            components["database"] = {"status": "healthy"}
        except Exception as e:
            components["database"] = {"status": "unhealthy", "error": str(e)}

        # Check Redis
        try:
            redis = await get_redis()
            await redis.ping()
            components["redis"] = {"status": "healthy"}
        except Exception as e:
            components["redis"] = {"status": "unhealthy", "error": str(e)}

        # Check model registry
        try:
            registry = getattr(request.app.state, 'model_registry', None)
            if registry:
                loaded = await registry.get_loaded_models()
                components["models"] = {"status": "healthy", "loaded": loaded}
            else:
                components["models"] = {"status": "not_initialized"}
        except Exception as e:
            components["models"] = {"status": "unhealthy", "error": str(e)}

        # Check storage
        try:
            storage = getattr(request.app.state, 'storage', None)
            if storage:
                ok = await storage.health_check()
                components["storage"] = {"status": "healthy" if ok else "degraded"}
            else:
                components["storage"] = {"status": "not_initialized"}
        except Exception as e:
            components["storage"] = {"status": "unhealthy", "error": str(e)}

        overall = "healthy" if all(
            c.get("status") == "healthy" for c in components.values()
        ) else "degraded"

        return {
            "status": overall,
            "version": "1.0.0",
            "platform": "Voice-Crafter",
            "environment": settings.ENVIRONMENT,
            "components": components,
            "timestamp": time.time(),
        }
    except Exception as exc:
        logger.exception("Health check failed unexpectedly")
        return {
            "status": "degraded",
            "version": "1.0.0",
            "platform": "Voice-Crafter",
            "environment": settings.ENVIRONMENT,
            "components": {"error": str(exc)},
            "timestamp": time.time(),
        }


@app.get("/", tags=["System"])
async def root():
    return {
        "platform": "Voice-Crafter",
        "tagline": "Enterprise Voice AI · Clone · Generate · Detect",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/health",
    }
