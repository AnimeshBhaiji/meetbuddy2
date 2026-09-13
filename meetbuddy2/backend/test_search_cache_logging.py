"""Search cache hits and misses must be visible in the backend log, with a
running hit rate — the number that says whether the 7-day cache pays off."""
import logging
import os
import subprocess
import sys

import scraper


def test_backend_shows_info_logs_from_app_modules():
    # A fresh interpreter: pytest installs its own log handlers, which would hide
    # whether main configures logging at all.
    out = subprocess.run(
        [sys.executable, "-c",
         "import logging, main; print(logging.getLogger('scraper').isEnabledFor(logging.INFO))"],
        capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)))
    assert out.stdout.strip().splitlines()[-1:] == ["True"], out.stdout + out.stderr


def test_search_logs_hits_misses_and_running_rate(monkeypatch, caplog):
    store = {}
    monkeypatch.setattr(scraper.cache, "get", lambda k: store.get(k))
    monkeypatch.setattr(scraper.cache, "set", lambda k, v, ttl: store.__setitem__(k, v))
    monkeypatch.setattr(scraper, "fetch_places_page", lambda q, c, r: [{"title": "A"}])
    monkeypatch.setattr(scraper, "_search_stats", {"hit": 0, "miss": 0})

    with caplog.at_level(logging.INFO, logger="scraper"):
        scraper.search_places("cafes", (12.97, 77.59), 2500)     # miss -> live call
        scraper.search_places("cafes", (12.97, 77.59), 2500)     # hit
        scraper.search_places("Cafes ", (12.971, 77.591), 2500)  # hit: same query, same ~1km cell

    msgs = [r.getMessage() for r in caplog.records if r.name == "scraper"]
    assert any(m.startswith("search cache miss (0/1 hits since start, 0%)") for m in msgs), msgs
    assert any(m.startswith("search cache hit (2/3 hits since start, 67%)") for m in msgs), msgs
