# cache.py — Postgres-backed cache. This module is the seam for a future
# Redis swap: keep callers on get()/set() only.
import json
import logging
from typing import Any, Optional

from sqlalchemy import text

from database import engine

logger = logging.getLogger(__name__)


def get(key: str) -> Optional[Any]:
    """Return the cached value, or None on miss/expiry/DB failure."""
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT value FROM api_cache WHERE key = :k AND expires_at > now()"),
                {"k": key},
            ).fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.warning("cache get failed for %s: %s", key, e)
        return None


def set(key: str, value: Any, ttl_seconds: int) -> None:
    """Store a JSON-serializable value; failures are logged, never raised."""
    try:
        with engine.begin() as conn:
            # opportunistic cleanup of expired rows
            conn.execute(text("DELETE FROM api_cache WHERE expires_at < now()"))
            conn.execute(
                text(
                    "INSERT INTO api_cache (key, value, expires_at) "
                    "VALUES (:k, CAST(:v AS jsonb), now() + make_interval(secs => :ttl)) "
                    "ON CONFLICT (key) DO UPDATE "
                    "SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at"
                ),
                {"k": key, "v": json.dumps(value), "ttl": ttl_seconds},
            )
    except Exception as e:
        logger.warning("cache set failed for %s: %s", key, e)
