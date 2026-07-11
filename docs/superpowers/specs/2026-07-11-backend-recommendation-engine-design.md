# Backend Recommendation Engine v2 — Design

**Date:** 2026-07-11
**Status:** Approved
**Branch:** `feat/backend-reco-engine-v2`

## Goal

Improve restaurant/place recommendation quality, cut SerpAPI credit consumption to
~1 call per planner step (from up to 5 at session start and 4 per follow-up step),
add a persistent shared cache, and restructure the backend planner code — all
without changing any API response shape the frontend depends on.

## User decisions (asked, not assumed)

| Decision | Choice |
|---|---|
| Cache store | PostgreSQL table in the existing `meetbuddy` DB, behind a small interface so Redis can replace it later |
| Dead code | Wire `place_analyzer.py` into scoring; delete `classifier.py`, `itinerary_manager.py`, `cab_service.py` |
| API budget | Aggressive: ~1 SerpAPI call per step, fallback only on truly-thin results |
| Cleanup depth | Restructure `planner.py` into focused modules |

## Current problems

1. **Credit burn.** `generate_initial_suggestions` runs a waterfall of up to 5 SerpAPI
   searches; each `select`/`skip` runs up to 4 more. A 3-step flow ≈ 10 credits.
2. **Weak cache.** In-memory dict, 1-hour TTL, 100-entry cap, keyed on exact query
   text — near-zero cross-user sharing, dies on restart.
3. **Slow first search (60–90 s).** Places missing coords are geocoded via Nominatim
   with a 1 s sleep each, and results are never reused across queries.
4. **Unused intelligence.** `place_analyzer.py` (mood fit, atmosphere, parking,
   private seating from reviews/descriptions) is imported by nothing. Live scoring is
   just rating + 2 keyword checks + distance boost.
5. **Dead weight.** ~500 lines of never-imported modules; `planner.py` is 1,086 lines
   mixing normalization, geocoding, directives, search orchestration, and scoring;
   two haversine copies; bulky `raw` SerpAPI blobs stored in sessions and responses.
6. **Pointless over-fetch.** Code requests 40–50 results but the SerpAPI google_maps
   engine returns ~20 per page; the larger `num_results` does nothing.

## Design

### 1. Module restructure

```
backend/
├── planner.py          Orchestration only: generate_initial_suggestions /
│                       generate_followup_suggestions (~250 lines)
├── directives.py       normalize_to_labels, _build_search_directives,
│                       determine_flow_from_preferences, label/type maps
├── scoring.py          Ranking pipeline: rating, distance boost, priorities,
│                       avoid-list, place_analyzer signals, dedupe, step-type filters
├── geo.py              Single haversine, coord normalization, geocode +
│                       reverse-geocode (through the cache)
├── cache.py            Postgres-backed cache interface: get(key) / set(key, value, ttl)
├── scraper.py          Pure SerpAPI fetch + response parsing (no caching inside)
├── place_analyzer.py   Unchanged; consumed by scoring.py
└── deleted: classifier.py, itinerary_manager.py, cab_service.py
```

`main.py` endpoints and every response shape stay identical. Zero frontend changes.

### 2. Persistent cache (PostgreSQL)

New table, created by `create_tables.py`:

```sql
api_cache(
  key         TEXT PRIMARY KEY,
  value       JSONB       NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
)
```

`cache.py` exposes `get(key) -> value | None` and `set(key, value, ttl_seconds)`.
Expired rows are treated as misses and overwritten on next set; a cheap
opportunistic `DELETE ... WHERE expires_at < now()` runs on set. The interface is
the seam for a future Redis swap (~50-line change).

Two logical layers:

- **Place-search cache** — key: `search:{normalized_query}:{lat2}:{lng2}:{radius_bucket}`
  where coords are rounded to 2 decimals (~1.1 km) and radius is bucketed
  (2500 / 6000 / 10000 / 25000 / 50000 m, matching directive radii).
  Queries come from the questionnaire's controlled vocabulary, so users with
  similar answers in the same area share entries. **TTL: 7 days.**
- **Geocode cache** — `geocode:{normalized_address}` → coords, and
  `revgeo:{lat3}:{lng3}` → area name. **TTL: 90 days.** The 1 s polite sleep
  applies only to actual Nominatim calls, never to cache hits.

### 3. Search orchestration: ~1 call per step

Initial suggestions:
1. Build **one** query: flavor terms (from directives) + category name + location.
2. Fetch one SerpAPI page (~20 results), cache the parsed page.
3. Only if post-distance-filter results < 5 → **one** broad fallback
   (plain category + location). No second-type attempt, no generic-token attempt,
   no location-only last resort.

Follow-up steps (activity/stay/restaurant): same 1-plus-conditional-fallback
pattern using the step's flavor terms; the per-type query loop is removed.

Swap/regenerate requests re-rank the cached page instead of re-searching.

Cost: **≤3 credits cold for a 3-step flow (was ~10), 0 warm.** A per-request
SerpAPI call counter is logged so savings are visible.

### 4. Scoring pipeline (recommendation quality)

`scoring.py` composes, in order, all local and free:

1. **Base**: rating-derived score (existing).
2. **Distance boost** (existing, incl. weekend-escape shaping).
3. **Surprise-mode priority weights** (existing: food quality / distance / budget / ambience).
4. **NEW — analyzer signals** from `place_analyzer.py` on data already in each result:
   - `analyze_mood_fit(place, mood, mood_subs)` → additive mood-match score
   - `detect_atmosphere` flags matched against directives (rooftop answer ↔
     `is_rooftop`, live-music add-on ↔ `has_live_music`, quiet/scenic prefs)
   - `analyze_stage2_preferences` → compatibility score (private seating,
     parking/valet when the user asked for it)
5. **Avoid-list filter** (existing).
6. **Step-type filtering**: the activity-step keyword blacklist (which wrongly
   drops e.g. "Street Food Museum") is replaced by analyzer/tag-based filtering —
   exclude a venue from activities only when food signals dominate and no
   activity signal is present.
7. Dedupe by place_id (existing), weekend-escape sector diversification (existing).

Because ranking now personalizes locally, the broad shared cache page serves
users with different questionnaire flavors without extra API calls.

### 5. Hygiene

- Strip `raw` from place dicts before returning or storing in sessions
  (sessions re-serialize to disk on every selection).
- One haversine and one coord-normalizer, in `geo.py`.
- `logging` module replaces bare `print`s in the touched backend files
  (no emoji — Windows cp1252 consoles).
- `requirements.txt` unchanged (no new dependencies).

### Error handling

- Cache/DB failure → log a warning and fall through to a live SerpAPI call;
  the cache is an optimization, never a point of failure.
- SerpAPI failure → existing behavior kept: collect `search_errors`, surface
  `search_error` in the response when options are empty.
- Nominatim failure → return None, proceed without coords (existing behavior).

### Testing & verification

- **Gate:** existing Playwright E2E matrix — 15/15 across surprise / semi /
  full-control modes, zero response-shape regressions.
- **Credit assertion:** instrumented counter shows ≤3 SerpAPI calls for a cold
  3-step flow and 0 for a warm repeat.
- **Unit tests (small pytest):** cache set/get/TTL-expiry against Postgres;
  scoring pipeline ordering with a fixed fixture of fake places; activity-step
  filter keeps "Street Food Museum"-style venues.

### Out of scope (tracked, intentional — CLAUDE.md)

JWT validation, CORS restriction, session storage rework, frontend API base URL,
Redis (interface-ready, not installed), SerpAPI pagination beyond page 1.
