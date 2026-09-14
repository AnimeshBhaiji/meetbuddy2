# Cache behavior against the real Postgres. Run: python -m pytest test_cache.py -q
import time
import uuid

from sqlalchemy import text

import cache


def _key():
    return f"test:{uuid.uuid4()}"


def test_set_get_roundtrip():
    k = _key()
    value = {"places": [{"title": "Café ₹₹", "rating": 4.5}], "n": 3}
    cache.set(k, value, 60)
    assert cache.get(k) == value


def test_expired_is_miss():
    k = _key()
    cache.set(k, "gone", 0)
    time.sleep(1)
    assert cache.get(k) is None


def test_overwrite_and_miss():
    k = _key()
    assert cache.get(k) is None
    cache.set(k, [1, 2], 60)
    cache.set(k, [3], 60)
    assert cache.get(k) == [3]


def test_empty_values_are_cacheable():
    # empty list must round-trip as a hit (search_places caches empty pages)
    k = _key()
    cache.set(k, [], 60)
    assert cache.get(k) == []


def _row_exists(k):
    with cache.engine.begin() as conn:
        return conn.execute(text("SELECT 1 FROM api_cache WHERE key = :k"), {"k": k}).fetchone() is not None


def test_expired_rows_are_swept_at_most_once_an_interval(monkeypatch):
    """Deleting expired rows is housekeeping (get() already ignores them), so a
    write only sweeps once the interval has passed, not on every write."""
    expired = _key()
    cache.set(expired, "old", 0)
    time.sleep(1)

    monkeypatch.setattr(cache, "_last_sweep", time.monotonic(), raising=False)  # a sweep just ran
    cache.set(_key(), "new", 60)
    assert _row_exists(expired), "a write swept expired rows again before the interval passed"
    assert cache.get(expired) is None  # still invisible to readers

    monkeypatch.setattr(cache, "_last_sweep", time.monotonic() - cache.SWEEP_INTERVAL)  # interval passed
    cache.set(_key(), "newer", 60)
    assert not _row_exists(expired)
