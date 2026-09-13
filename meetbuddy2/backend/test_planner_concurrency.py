"""A slow venue search must not stall the server for everyone else.

The planner routes are async, and the search behind them (SerpAPI, Nominatim,
database) is synchronous. Called directly, one search blocks the event loop
until it returns, so concurrent requests queue behind it.
"""
import asyncio
import time

import httpx

import main
from auth import get_current_user

SEARCH_SECONDS = 0.5
REQUESTS = 3


def _slow_followup(state, category, num_results=15):
    time.sleep(SEARCH_SECONDS)  # stands in for a live SerpAPI call
    return {"options": [{"title": "X"}], "anchor_text": "MG Road"}


async def _fire_concurrently():
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        body = {"anchor": {"lat": 12.9716, "lng": 77.5946}, "category": "cafe"}
        return await asyncio.gather(
            *(client.post("/planner/options", json=body) for _ in range(REQUESTS)))


def test_concurrent_searches_do_not_queue(monkeypatch):
    monkeypatch.setattr(main, "generate_followup_suggestions", _slow_followup)
    main.app.dependency_overrides[get_current_user] = lambda: object()
    try:
        started = time.perf_counter()
        responses = asyncio.run(_fire_concurrently())
        elapsed = time.perf_counter() - started
    finally:
        main.app.dependency_overrides.pop(get_current_user, None)

    assert all(r.status_code == 200 for r in responses)
    # Serialised, three searches take 1.5s; in parallel, about 0.5s.
    assert elapsed < SEARCH_SECONDS * REQUESTS * 0.7, f"requests queued: {elapsed:.2f}s"
