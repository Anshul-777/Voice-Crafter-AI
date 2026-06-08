"""Voice-Crafter Audit Middleware - request logging"""
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
import logging, time

logger = logging.getLogger(__name__)

AUDIT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_PREFIXES = ("/health", "/api/docs", "/api/redoc", "/api/openapi", "/ws")


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method not in AUDIT_METHODS:
            return await call_next(request)
        if any(request.url.path.startswith(p) for p in SKIP_PREFIXES):
            return await call_next(request)

        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        logger.info(
            f"{request.method} {request.url.path} "
            f"status={response.status_code} "
            f"duration={duration_ms:.1f}ms "
            f"ip={request.client.host if request.client else 'unknown'}"
        )
        return response
