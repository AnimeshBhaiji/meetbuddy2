# Cache behavior against the real Postgres. Run: python -m pytest test_cache.py -q
import time
import uuid

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
