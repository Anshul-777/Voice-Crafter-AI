"""Voice-Crafter Redis Client"""
import logging
from app.config import settings

logger = logging.getLogger(__name__)
_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
        except ImportError:
            import aioredis
        _redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis

async def cache_set(key: str, value: str, ttl: int = None):
    r = await get_redis()
    await r.set(key, value, ex=ttl or settings.REDIS_CACHE_TTL)

async def cache_get(key: str) -> str | None:
    r = await get_redis()
    return await r.get(key)

async def cache_delete(key: str):
    r = await get_redis()
    await r.delete(key)

async def rate_limit_check(key: str, limit: int, window: int) -> tuple[bool, int]:
    """Returns (allowed, remaining)."""
    r = await get_redis()
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    results = await pipe.execute()
    count = results[0]
    remaining = max(0, limit - count)
    return count <= limit, remaining
