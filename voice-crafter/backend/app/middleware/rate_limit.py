"""Voice-Crafter Rate Limiting Middleware"""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time, logging
from app.config import settings

logger = logging.getLogger(__name__)

PLAN_LIMITS = {
    "free": settings.RATE_LIMIT_FREE_RPM,
    "starter": settings.RATE_LIMIT_STARTER_RPM,
    "pro": settings.RATE_LIMIT_PRO_RPM,
    "enterprise": settings.RATE_LIMIT_ENTERPRISE_RPM,
}

SKIP_PATHS = {"/health", "/", "/api/docs", "/api/redoc", "/api/openapi.json", "/api/v1/auth/login", "/api/v1/auth/register"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        # Get client IP
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )

        # Determine plan from token (best effort, don't block auth-less requests here)
        plan = "free"
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            from app.services.auth_service import decode_token
            payload = decode_token(auth_header[7:])
            if payload:
                plan = payload.get("plan", "free")

        limit = PLAN_LIMITS.get(plan, settings.RATE_LIMIT_FREE_RPM)
        key = f"rl:{client_ip}:{int(time.time() // settings.RATE_LIMIT_WINDOW_SECONDS)}"

        try:
            from app.utils.redis_client import rate_limit_check
            allowed, remaining = await rate_limit_check(key, limit, settings.RATE_LIMIT_WINDOW_SECONDS)
        except Exception:
            # If Redis is down, allow the request
            return await call_next(request)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "message": f"Rate limit of {limit} req/min exceeded. Upgrade your plan for higher limits."},
                headers={"Retry-After": str(settings.RATE_LIMIT_WINDOW_SECONDS), "X-Rate-Limit-Limit": str(limit)},
            )

        response = await call_next(request)
        response.headers["X-Rate-Limit-Limit"] = str(limit)
        response.headers["X-Rate-Limit-Remaining"] = str(remaining)
        return response
