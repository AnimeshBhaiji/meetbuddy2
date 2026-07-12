# Planner Redesign + Itinerary Editing — Design

**Date:** 2026-07-12
**Status:** Approved
**Scope:** Redesign the step-selection ("plan your itinerary") and summary ("your perfect itinerary") pages; add full itinerary editing (add / remove / reorder / swap / notes) with database persistence.

## Decisions (user-approved)

| Question | Decision |
|---|---|
| Step page layout | **Map-first immersive**: full-viewport map, floating controls, bottom card carousel + collapsed "View all options" grid below the map |
| Summary page layout | **Route canvas**: map hero with numbered route + docked editing panel |
| Add-a-stop source | **Cached options first**, "find something else" runs a fresh anchored search |
| Edit cascade | **Edits are local** — no automatic re-picking of later stops |
| Persistence | **PostgreSQL** per user + "My itineraries" list page |
| Extras | Notes per stop, custom manual stop (Nominatim), itinerary title & date |
| Code structure | Split `Planner.jsx` into components + shared session hook |

## Frontend Architecture

`src/pages/Planner.jsx` (1362 lines, three views in one file) is split into:

- **`src/hooks/usePlannerSession.js`** — all session state and API calls, moved unchanged: startSession, selectOption, skipStep, autoPlan, goBackOneStep, optionsByStep, selectedChain, planMode, directives, error state. One hook, consumed by the page components.
- **`src/pages/Planner.jsx`** — thin router between the three views (state machine `home | step | summary` stays).
- **`src/components/planner/PlannerHome.jsx`** — prefs summary, location input + GPS, flow preview, Generate button. Restyled to match the new visual identity; behavior unchanged.
- **`src/components/planner/StepExplorer.jsx`** — the new map-first step page (below).
- **`src/components/planner/ItineraryCanvas.jsx`** — the new summary page (below).
- **`src/components/planner/StopPicker.jsx`** — shared add/swap picker panel (below).
- **`src/components/MapPlanner.jsx`** — reused as-is; wire the existing dormant `onAddToItinerary` popup prop where relevant.

Old markup is deleted, not kept behind flags.

## Step Page — `StepExplorer`

- **Full-viewport map** (MapPlanner, `className` for sizing). Selected stops shown as numbered pins; current-step options as dot pins.
- **Floating top bar** (glass style): step progress pills (① 🍽️ → ② 🎯 → ③ 🏨), filter chips + sort (full-control mode), Back / Skip / Cancel. Semi-mode shortlist banner and full-mode step editor move into this bar as popovers, behavior unchanged.
- **Bottom card carousel**: horizontally swipeable ranked option cards floating over the map; card #1 carries the "MeetBuddy's pick" badge. Card shows photo thumb, title, rating, distance, Select + Open. Hover/tap pings the matching pin (existing `highlightedPlace` mechanism).
- **"View all options ▾"** — a collapsed section rendered below the map viewport. Expanding it scrolls open the full card grid (today's rich `StepGrid` cards) for side-by-side comparison. Collapsed by default on every step.
- Empty state / search-error handling identical to today (retry / go back / error banner).

## Summary Page — `ItineraryCanvas`

- **Map hero** with numbered route pins, polyline, and a route summary chip (total km, stop count).
- **Editing panel** — docked right on desktop, bottom sheet on mobile:
  - Compact stop rows: `⠿ ① 🍽️ Kohinoor Rooftop  [⇄] [✕] [✏️]`
  - **Reorder:** drag via framer-motion `Reorder.Group` (already a dependency).
  - **Swap (⇄):** opens StopPicker for that stop's category.
  - **Remove (✕):** deletes the stop (route renumbers).
  - **Note (✏️):** inline text field per stop, saved with the itinerary, shown on print.
  - **Add (＋):** between any two stops and at the ends; opens StopPicker.
  - All edits are **local state only** — the map redraws instantly; no session calls, no cascade.
- **Title + date** fields (default title from mood/flow, date optional).
- **"Don't forget" service notes** (existing `deriveServiceNotes`) kept below the stops.
- **Actions:** Save (POST/PUT itinerary), Print (print-friendly list layout), Plan another (reset).

## StopPicker (add & swap)

Three tabs in one panel:

1. **Suggestions** — unused options from `optionsByStep` for the chosen category (instant, zero API). For reopened itineraries (no session), this tab is fed by the options endpoint instead.
2. **Find something else** — category picker (restaurant / activity / café / stay / …) → `POST /planner/options` → ranked results, cache-first.
3. **Custom place** — free-text name/address → backend geocode (existing Nominatim path) → confirm pin → added as a stop with `step: "custom"`.

## Backend

### New: stateless options endpoint

`POST /planner/options` — `{category, anchor: {lat, lng}, preferences?, radius_m?}` → `{options: [...], search_error?}`.
Reuses the existing directives → search (`search_places`, cache-first) → `rank_places` pipeline anchored to the given coords. No session required, so it works for editing reopened itineraries. Same ≤1-SerpAPI-call-per-request budget as planner steps.

### New: itinerary persistence

Model (`models.py`), tables created via `create_tables.py` re-run:

```python
class Itinerary(Base):
    __tablename__ = "itineraries"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(Text, nullable=False)
    planned_date = Column(Date, nullable=True)
    stops = Column(JSONB, nullable=False)  # [{step, place, note}]
    created_at / updated_at (server defaults)
```

Endpoints (router `itineraries.py`, same conventions as existing routes — `user_id` in payload/query, JWT validation stays a tracked TODO):

- `POST /itineraries` — create
- `GET /itineraries?user_id=` — list (id, title, planned_date, stop count, updated_at)
- `GET /itineraries/{id}` — full itinerary
- `PUT /itineraries/{id}` — update (title, date, stops)
- `DELETE /itineraries/{id}` — delete

`itinerary_manager.py` is integrated if its existing sketch fits these endpoints; otherwise superseded and removed as part of this work.

### Geocode for custom stops

Expose existing `geo.geocode_address` as `GET /geocode?q=` (cache-first, 90-day TTL, polite Nominatim usage already implemented).

## My Itineraries

- New page `src/pages/MyItineraries.jsx` + route `/itineraries` + navbar link.
- Card list of saved itineraries (title, date, stops preview, updated). Open → `ItineraryCanvas` in edit mode (sessionless; StopPicker uses `/planner/options`). Delete with confirm.

## Data Flow Notes

- During an active planning session, the itinerary lives in `selectedChain` (hook state) exactly as today; Save serializes it to the API.
- A reopened itinerary hydrates `ItineraryCanvas` directly from `GET /itineraries/{id}` — no planner session exists and none is created.
- Swap alternatives on reopened itineraries anchor to the **previous stop's coords** (or the first stop's, for stop #1).

## Error Handling

- Options search failures: inline banner in StopPicker with retry (mirrors step-page behavior).
- Save/update failures: non-blocking error toast; local state is never discarded.
- Geocode miss for custom place: inline "couldn't find that address" with the option to place it without coordinates (excluded from map/route line).

## Testing

- **Backend:** pytest for itineraries CRUD (create/list/get/update/delete + wrong-user isolation) and `/planner/options` (cache-hit path, anchor filtering).
- **Frontend e2e (Playwright):** plan → summary → add a stop (cached) → reorder → note → remove → save → reload → reopen from My itineraries → verify edits persisted. Existing `matrix-e2e.cjs` stays as the planner regression.

## Out of Scope

- Planner session API redesign (v2 backend stays as-is).
- JWT validation, CORS, hardcoded API base (tracked TODOs).
- Auto-booking / external reservations.
