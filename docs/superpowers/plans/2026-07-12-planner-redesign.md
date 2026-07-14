# Planner Redesign + Itinerary Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the planner's step-selection page as a map-first experience and the summary page as an editable route canvas, with itineraries saved to PostgreSQL (add / remove / reorder / swap / notes / title / date) and a "My itineraries" page.

**Architecture:** Split the 1362-line `Planner.jsx` into a `usePlannerSession` hook plus view components (`PlannerHome`, `StepExplorer`, `ItineraryCanvas`, `StopPicker`). Backend gains an `itineraries` table + CRUD router, a stateless `POST /planner/options` endpoint (reuses `generate_followup_suggestions` with a synthetic session), and `GET /geocode`. All itinerary edits are client-local; Save serializes to the API.

**Tech Stack:** React 19 + Vite + TailwindCSS 4 + framer-motion 12 (`Reorder` for drag) + react-leaflet 5; FastAPI + SQLAlchemy + PostgreSQL (JSONB); pytest for backend tests; Playwright (plain `node` scripts) for e2e.

**Spec:** `docs/superpowers/specs/2026-07-12-planner-redesign-design.md`

## Global Constraints

- Work on branch `feat/planner-redesign`. Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- **No new dependencies** — npm or pip. framer-motion, axios, leaflet, lucide-react, pytest are already available.
- **No emoji in backend `print()`/log output** (Windows cp1252 console crashes). Emoji in frontend JSX is fine.
- Frontend API base is hardcoded `http://localhost:8000` (project convention — do not centralize).
- JWT validation, CORS wildcard, in-memory planner sessions are **tracked TODOs — do not fix**.
- Schema changes go in `models.py`; re-run `python create_tables.py` (no Alembic).
- Tailwind utility classes only; functional components + hooks only; path alias `@` → `src/`.
- SerpAPI budget: any new search path must go through `search_places` (cache-first) — max 1 primary + 1 fallback query per request.
- Backend tests run against the local PostgreSQL (`meetbuddy` db) like the existing `test_cache.py`; call router/handler functions directly with a `SessionLocal()` — do not add httpx/TestClient.
- Run backend commands from `meetbuddy2/backend/`, frontend from `meetbuddy2/`.

---

### Task 1: Itinerary model

**Files:**
- Modify: `meetbuddy2/backend/models.py`
- Test: `meetbuddy2/backend/test_itineraries.py` (new)

**Interfaces:**
- Produces: `models.Itinerary` with columns `id: int PK`, `user_id: int FK users.id`, `title: Text`, `planned_date: Date|None`, `stops: JSONB list`, `created_at/updated_at: tz DateTime`. Stop shape (convention, JSONB is schemaless): `{"step": "restaurant|activity|stay|cafe|custom", "place": {…normalized place…}, "note": ""}`.

- [ ] **Step 1: Write the failing test**

```python
# test_itineraries.py
# Runs against the local meetbuddy PostgreSQL, like test_cache.py.
import uuid

from database import SessionLocal
from models import Itinerary, User


def _ensure_user(db):
    user = db.query(User).first()
    if user:
        return user.id
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Test", last_name="User", email=f"it-{tag}@test.local",
                phone=f"9{tag}", username=f"it_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


def test_itinerary_model_roundtrip():
    db = SessionLocal()
    try:
        uid = _ensure_user(db)
        it = Itinerary(user_id=uid, title="Test plan",
                       stops=[{"step": "restaurant", "place": {"title": "X"}, "note": ""}])
        db.add(it)
        db.commit()
        db.refresh(it)
        assert it.id is not None
        assert it.created_at is not None
        assert it.stops[0]["place"]["title"] == "X"
        db.delete(it)
        db.commit()
    finally:
        db.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest test_itineraries.py -v`
Expected: FAIL — `ImportError: cannot import name 'Itinerary' from 'models'`

- [ ] **Step 3: Add the model**

In `models.py`, replace the imports line and append the class:

```python
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
```

```python
class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(Text, nullable=False)
    planned_date = Column(Date, nullable=True)
    stops = Column(JSONB, nullable=False, default=list)  # [{step, place, note}]
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False)
```

- [ ] **Step 4: Create the table**

Run: `python create_tables.py`
Expected: exits 0, no emoji output. Verify: `python -c "from sqlalchemy import inspect; from database import engine; print('itineraries' in inspect(engine).get_table_names())"` prints `True`.

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest test_itineraries.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add meetbuddy2/backend/models.py meetbuddy2/backend/test_itineraries.py
git commit -m "feat(backend): itineraries table for saved plans"
```

---

### Task 2: Itineraries CRUD router (and retire itinerary_manager.py)

**Files:**
- Create: `meetbuddy2/backend/itineraries.py`
- Modify: `meetbuddy2/backend/main.py` (register router)
- Delete: `meetbuddy2/backend/itinerary_manager.py` (session-based sketch superseded by DB persistence — per spec)
- Test: `meetbuddy2/backend/test_itineraries.py` (extend)

**Interfaces:**
- Consumes: `models.Itinerary` (Task 1), `database.get_db`.
- Produces HTTP API used by Tasks 8–9:
  - `POST /itineraries` body `{user_id, title, planned_date?, stops}` → full itinerary dict
  - `GET /itineraries?user_id=` → `[{id, title, planned_date, stop_count, updated_at}]`
  - `GET /itineraries/{id}?user_id=` → full dict `{id, user_id, title, planned_date, stops, created_at, updated_at}`
  - `PUT /itineraries/{id}` body `{user_id, title?, planned_date?, stops?}` → full dict
  - `DELETE /itineraries/{id}?user_id=` → `{"message": "deleted"}`
  - Wrong `user_id` → 404 (isolation).

- [ ] **Step 1: Write the failing tests** (append to `test_itineraries.py`)

```python
import pytest
from fastapi import HTTPException

import itineraries as api


def test_itinerary_crud_roundtrip():
    db = SessionLocal()
    created_id = None
    try:
        uid = _ensure_user(db)
        created = api.create_itinerary(
            api.ItineraryIn(user_id=uid, title="Date night",
                            stops=[{"step": "restaurant", "place": {"title": "A"}, "note": ""}]),
            db)
        created_id = created["id"]
        assert created["title"] == "Date night"

        listing = api.list_itineraries(uid, db)
        assert any(row["id"] == created_id and row["stop_count"] == 1 for row in listing)

        updated = api.update_itinerary(
            created_id,
            api.ItineraryUpdate(user_id=uid, title="Anniversary",
                                stops=[{"step": "restaurant", "place": {"title": "A"}, "note": "window table"},
                                       {"step": "activity", "place": {"title": "B"}, "note": ""}]),
            db)
        assert updated["title"] == "Anniversary"
        assert len(updated["stops"]) == 2

        fetched = api.get_itinerary(created_id, uid, db)
        assert fetched["stops"][0]["note"] == "window table"

        assert api.delete_itinerary(created_id, uid, db)["message"] == "deleted"
        created_id = None
        with pytest.raises(HTTPException):
            api.get_itinerary(created["id"], uid, db)
    finally:
        if created_id:
            db.query(Itinerary).filter(Itinerary.id == created_id).delete()
            db.commit()
        db.close()


def test_itinerary_user_isolation():
    db = SessionLocal()
    try:
        uid = _ensure_user(db)
        created = api.create_itinerary(api.ItineraryIn(user_id=uid, title="Mine", stops=[]), db)
        with pytest.raises(HTTPException):
            api.get_itinerary(created["id"], uid + 999999, db)
        api.delete_itinerary(created["id"], uid, db)
    finally:
        db.close()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest test_itineraries.py -v`
Expected: 2 new tests FAIL with `ModuleNotFoundError: No module named 'itineraries'`

- [ ] **Step 3: Write the router**

```python
# itineraries.py — saved-itinerary CRUD.
# JWT validation is a tracked project TODO: like the rest of the API,
# endpoints trust the user_id the client sends.
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Itinerary

router = APIRouter(prefix="/itineraries", tags=["itineraries"])


class ItineraryIn(BaseModel):
    user_id: int
    title: str
    planned_date: Optional[date] = None
    stops: List[Dict[str, Any]] = []


class ItineraryUpdate(BaseModel):
    user_id: int
    title: Optional[str] = None
    planned_date: Optional[date] = None
    stops: Optional[List[Dict[str, Any]]] = None


def _to_dict(it: Itinerary) -> Dict[str, Any]:
    return {
        "id": it.id,
        "user_id": it.user_id,
        "title": it.title,
        "planned_date": it.planned_date.isoformat() if it.planned_date else None,
        "stops": it.stops or [],
        "created_at": it.created_at.isoformat() if it.created_at else None,
        "updated_at": it.updated_at.isoformat() if it.updated_at else None,
    }


def _get_owned(itinerary_id: int, user_id: int, db: Session) -> Itinerary:
    it = (db.query(Itinerary)
          .filter(Itinerary.id == itinerary_id, Itinerary.user_id == user_id)
          .first())
    if not it:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return it


@router.post("")
def create_itinerary(payload: ItineraryIn, db: Session = Depends(get_db)):
    it = Itinerary(user_id=payload.user_id, title=payload.title,
                   planned_date=payload.planned_date, stops=payload.stops)
    db.add(it)
    db.commit()
    db.refresh(it)
    return _to_dict(it)


@router.get("")
def list_itineraries(user_id: int, db: Session = Depends(get_db)):
    rows = (db.query(Itinerary).filter(Itinerary.user_id == user_id)
            .order_by(Itinerary.updated_at.desc()).all())
    return [{
        "id": r.id,
        "title": r.title,
        "planned_date": r.planned_date.isoformat() if r.planned_date else None,
        "stop_count": len(r.stops or []),
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    } for r in rows]


@router.get("/{itinerary_id}")
def get_itinerary(itinerary_id: int, user_id: int, db: Session = Depends(get_db)):
    return _to_dict(_get_owned(itinerary_id, user_id, db))


@router.put("/{itinerary_id}")
def update_itinerary(itinerary_id: int, payload: ItineraryUpdate, db: Session = Depends(get_db)):
    it = _get_owned(itinerary_id, payload.user_id, db)
    data = payload.dict(exclude_unset=True)
    for field in ("title", "planned_date", "stops"):
        if field in data:
            setattr(it, field, data[field])
    db.commit()
    db.refresh(it)
    return _to_dict(it)


@router.delete("/{itinerary_id}")
def delete_itinerary(itinerary_id: int, user_id: int, db: Session = Depends(get_db)):
    it = _get_owned(itinerary_id, user_id, db)
    db.delete(it)
    db.commit()
    return {"message": "deleted"}
```

- [ ] **Step 4: Register the router in `main.py`**

Add to the imports block (after the `planner_sessions` import):

```python
from itineraries import router as itineraries_router
```

Add directly after the CORS middleware block:

```python
app.include_router(itineraries_router)
```

- [ ] **Step 5: Delete the superseded module**

Run: `grep -rn "itinerary_manager" meetbuddy2/backend --include="*.py"`
Expected: only `itinerary_manager.py` itself (it was never imported). Then delete the file:

```bash
git rm meetbuddy2/backend/itinerary_manager.py
```

- [ ] **Step 6: Run tests + import check**

Run: `python -m pytest test_itineraries.py -v` → 3 PASS
Run: `python -c "import main"` → exits 0

- [ ] **Step 7: Commit**

```bash
git add -A meetbuddy2/backend
git commit -m "feat(backend): itineraries CRUD API; retire session-based itinerary_manager"
```

---

### Task 3: Stateless options endpoint (`POST /planner/options`)

**Files:**
- Modify: `meetbuddy2/backend/planner.py` (cafe category in `generate_followup_suggestions`)
- Modify: `meetbuddy2/backend/main.py` (endpoint)
- Test: `meetbuddy2/backend/test_planner_options.py` (new)

**Interfaces:**
- Consumes: `generate_followup_suggestions(session_state, next_step, num_results)` — anchors to `session_state["payload"]["coords"]` when `steps` is empty.
- Produces: `POST /planner/options` body `{category: "restaurant"|"cafe"|"activity"|"stay", anchor: {lat, lng}, preferences?: {…questionnaire prefs…}, location?: str}` → `{options: […ranked places…], anchor_text, search_error?}`. Used by `StopPicker` (Task 7).

- [ ] **Step 1: Write the failing test**

```python
# test_planner_options.py
# Verifies the synthetic-session reuse of generate_followup_suggestions and
# the new cafe category. Patches planner.search_places: no network, no credits.
import planner


FAKE_PLACES = [
    {"title": "Blue Tokai", "address": "MG Road", "lat": 12.9750, "lng": 77.6040,
     "rating": "4.6", "place_id": "p1"},
    {"title": "Far Cafe", "address": "Airport Rd", "lat": 13.3000, "lng": 77.9000,
     "rating": "4.8", "place_id": "p2"},
]


def _fake_search(query, coords, radius_m):
    _fake_search.calls.append(query)
    return [dict(p) for p in FAKE_PLACES]


def test_options_without_session_anchor_to_coords(monkeypatch):
    _fake_search.calls = []
    monkeypatch.setattr(planner, "search_places", _fake_search)
    state = {"payload": {"preferences": {"mood": "Romantic"},
                         "coords": {"lat": 12.9716, "lng": 77.5946}}, "steps": []}
    result = planner.generate_followup_suggestions(state, "cafe", num_results=10)
    titles = [o["title"] for o in result["options"]]
    assert "Blue Tokai" in titles          # within followup radius
    assert "Far Cafe" not in titles        # ~40 km away -> radius-filtered
    assert any("cafe" in q.lower() for q in _fake_search.calls)


def test_options_unknown_category_falls_back_to_restaurants(monkeypatch):
    _fake_search.calls = []
    monkeypatch.setattr(planner, "search_places", _fake_search)
    state = {"payload": {"preferences": {}, "coords": {"lat": 12.9716, "lng": 77.5946}},
             "steps": []}
    result = planner.generate_followup_suggestions(state, "restaurant", num_results=10)
    assert result["options"], "expected ranked options"
```

- [ ] **Step 2: Run test to verify the cafe case fails**

Run: `python -m pytest test_planner_options.py -v`
Expected: `test_options_without_session_anchor_to_coords` FAILS (no query contains "cafe" — the else-branch builds restaurant queries); the second test PASSES already.

- [ ] **Step 3: Add the cafe branch to `generate_followup_suggestions`**

In `planner.py`, inside the query-builder chain (after the `elif next_step == "stay":` block, before the final `else:`), insert:

```python
    elif next_step == "cafe":
        flavor = " ".join((directives.get("restaurant_terms") or [])[:2])
        primary_q = f"{flavor} cafes".strip() if flavor else "cafes"
        fallback_q = "cafes and bakeries"
```

And add to `STEP_TYPES` (top of file):

```python
    "cafe": ["cafe", "bakery"],
```

Note: `rank_places` is already called with `step=next_step`; `scoring.py` only applies hard type-filtering for known steps, so `"cafe"` passes through with generic scoring — that is fine, do not modify scoring.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest test_planner_options.py -v` → 2 PASS
Also run the existing suites: `python -m pytest test_scoring.py test_cache.py -v` → all PASS (no regressions)

- [ ] **Step 5: Add the endpoint to `main.py`** (after the `/planner/session/{sid}/skip` route)

```python
# Stateless options search — powers add/swap on saved itineraries where no
# planner session exists. Reuses the followup pipeline with a synthetic state.
@app.post("/planner/options")
async def planner_options(request: Request):
    try:
        raw = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    anchor = raw.get("anchor") or {}
    if anchor.get("lat") is None or anchor.get("lng") is None:
        raise HTTPException(status_code=400, detail="Missing anchor coordinates")

    category = raw.get("category") or "restaurant"
    synthetic_state = {
        "payload": {
            "preferences": raw.get("preferences") or {},
            "coords": {"lat": anchor["lat"], "lng": anchor["lng"]},
            "location": raw.get("location"),
        },
        "steps": [],
    }
    follow = generate_followup_suggestions(synthetic_state, category, num_results=15)
    return {
        "options": follow.get("options", []),
        "anchor_text": follow.get("anchor_text"),
        "search_error": follow.get("search_error"),
    }
```

- [ ] **Step 6: Verify import + commit**

Run: `python -c "import main"` → exits 0

```bash
git add meetbuddy2/backend/planner.py meetbuddy2/backend/main.py meetbuddy2/backend/test_planner_options.py
git commit -m "feat(backend): stateless POST /planner/options with cafe category"
```

---

### Task 4: Geocode endpoint (`GET /geocode`)

**Files:**
- Modify: `meetbuddy2/backend/main.py`
- Test: `meetbuddy2/backend/test_geocode_endpoint.py` (new)

**Interfaces:**
- Consumes: `geo.geocode_address(text) -> (lat, lng) | None` (cached 90d, Nominatim-polite — already implemented).
- Produces: `GET /geocode?q=<text>` → `{lat, lng}` | 404 | 400. Used by StopPicker's Custom tab (Task 7).

- [ ] **Step 1: Write the failing test**

```python
# test_geocode_endpoint.py
import pytest
from fastapi import HTTPException

import main


def test_geocode_returns_coords(monkeypatch):
    monkeypatch.setattr(main, "geocode_address", lambda q: (12.97, 77.59))
    assert main.geocode(q="MG Road Bangalore") == {"lat": 12.97, "lng": 77.59}


def test_geocode_miss_404(monkeypatch):
    monkeypatch.setattr(main, "geocode_address", lambda q: None)
    with pytest.raises(HTTPException) as exc:
        main.geocode(q="zzz nowhere")
    assert exc.value.status_code == 404


def test_geocode_blank_400():
    with pytest.raises(HTTPException) as exc:
        main.geocode(q="   ")
    assert exc.value.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest test_geocode_endpoint.py -v`
Expected: FAIL — `AttributeError: module 'main' has no attribute 'geocode'`

- [ ] **Step 3: Add the endpoint** (in `main.py`, after `/planner/options`)

Add the import near the other planner imports:

```python
from geo import geocode_address
```

```python
# Free-text -> coords for custom itinerary stops (cache-first Nominatim).
@app.get("/geocode")
def geocode(q: str = ""):
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Missing query")
    coords = geocode_address(q.strip())
    if not coords:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"lat": coords[0], "lng": coords[1]}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest test_geocode_endpoint.py -v` → 3 PASS

- [ ] **Step 5: Commit**

```bash
git add meetbuddy2/backend/main.py meetbuddy2/backend/test_geocode_endpoint.py
git commit -m "feat(backend): GET /geocode for custom itinerary stops"
```

---

### Task 5: Extract `usePlannerSession` hook (mechanical refactor, no visual change)

**Files:**
- Create: `meetbuddy2/src/hooks/usePlannerSession.js`
- Modify: `meetbuddy2/src/pages/Planner.jsx`
- Test: `meetbuddy2/e2e/planner-flow.cjs` (new — repo-tracked Playwright smoke)

**Interfaces:**
- Produces (consumed by Tasks 6/8/9): default export `usePlannerSession()` returning one object with **exactly** these keys:
  `userPrefs, user, placeText, setPlaceText, coords, locLoading, page, setPage, sessionId, setSessionId, currentStep, stepOptions, anchorText, selectedChain, setSelectedChain, sessionLoading, flowText, initialFlow, showOverlay, overlayText, highlightedPlace, setHighlightedPlace, plannerError, setPlannerError, planMode, directives, optionsByStep, setOptionsByStep, swapIndex, setSwapIndex, showAllOptions, setShowAllOptions, activeFilters, setActiveFilters, sortBy, setSortBy, showStepEditor, setShowStepEditor, upcomingSteps, useMyLocation, handlePlaceTextBlur, startSession, autoPlan, swapStop, skipStep, removeUpcomingStep, addUpcomingStep, moveUpcomingStep, selectOption, goBackOneStep`
- Also exports (named, moved from Planner.jsx verbatim): `STEP_EMOJI`, `humanStepName`, `PREF_META`, `FILTER_MATCHERS`, `deriveServiceNotes`, `applyFiltersAndSort`.

- [ ] **Step 1: Create the hook file**

`src/hooks/usePlannerSession.js` — header:

```js
// src/hooks/usePlannerSession.js
// All planner session state + API calls, extracted from Planner.jsx so the
// view components (PlannerHome / StepExplorer / ItineraryCanvas) stay thin.
import { useState, useEffect } from "react";
import axios from "axios";

export const PREF_META = [ /* moved verbatim from Planner.jsx lines 26-32 */ ];
export const STEP_EMOJI = { restaurant: "🍽️", activity: "🎯", stay: "🏨", cafe: "☕", custom: "📍" };
export const FILTER_MATCHERS = { /* moved verbatim from lines 37-42 */ };
export const deriveServiceNotes = (prefs) => { /* moved verbatim from lines 46-85 */ };
export const applyFiltersAndSort = (options, filters, sortBy) => { /* moved verbatim from lines 87-101 */ };
export const humanStepName = (step) =>
  ({ restaurant: "Restaurant", activity: "Activity / Things to do", stay: "Stay / Hotel",
     cafe: "Cafe", custom: "Custom stop" }[step] || step);

export default function usePlannerSession() {
  // …everything below moved verbatim from Planner.jsx…
  return { /* the exact key list from Interfaces above */ };
}
```

Move **verbatim** into the hook body (current `Planner.jsx` line references):
- All `useState`/`useEffect` declarations: lines 298–355
- `persistPrefs`, `useMyLocation`, `handlePlaceTextBlur`: 357–394
- `deriveFlowFromPlaceTypes` (keep private, not returned): 399–409
- `startSession`: 417–520 · `autoPlan`: 524–572 · `swapStop`: 576–618 · `skipStep`: 622–663
- `upcomingSteps` + `setUpcoming` + `removeUpcomingStep`/`addUpcomingStep`/`moveUpcomingStep`: 666–689
- `selectOption`: 692–758 · `goBackOneStep`: 761–801

Two mechanical edits while moving: `humanStepName` becomes the module-level export (delete the copy inside the component, lines 411–414), and `STEP_EMOJI` gains the `cafe`/`custom` entries shown above.

- [ ] **Step 2: Rewire `Planner.jsx`**

- Delete everything the hook absorbed (constants, helpers, state, functions).
- Replace with: `import usePlannerSession, { PREF_META, STEP_EMOJI, FILTER_MATCHERS, deriveServiceNotes, applyFiltersAndSort, humanStepName } from "@/hooks/usePlannerSession";` and at the top of the component: `const P = usePlannerSession();`
- In the JSX (kept as-is for now), prefix every moved identifier with `P.` (e.g. `page` → `P.page`, `startSession` → `P.startSession`). `displayPref` (lines 803–807) and the JSX components `ErrorBanner`, `StepGrid`, `FullOverlay`, `FlowStepper` stay in `Planner.jsx` for this task.

- [ ] **Step 3: Lint + build**

Run from `meetbuddy2/`: `npm run lint` → 0 errors, then `npm run build` → succeeds.

- [ ] **Step 4: Create the repo e2e smoke script**

```js
// meetbuddy2/e2e/planner-flow.cjs
// Smoke: seeded prefs -> 3-step planner flow -> summary. Needs backend :8000
// and vite :5173 running, and a warm/valid SerpAPI or cached searches.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("user", JSON.stringify({ user_id: 1, username: "test" }));
    localStorage.setItem("userPreferences", JSON.stringify({
      mood: "Romantic", planningStyle: "Full control", adventureLevel: "Stick to the city",
      memorableFactor: "Amazing food",
      location: "Indiranagar Bangalore",
    }));
  });
  await page.goto("http://localhost:5173/planner");
  await page.waitForTimeout(1500);
  await page.click("text=Generate itinerary");
  await page.waitForSelector("text=Select", { timeout: 90000 });
  for (let i = 0; i < 3; i++) {
    const sel = page.locator('button:has-text("Select")').first();
    if (!(await sel.count())) break;
    await sel.click();
    await page.waitForTimeout(4000);
    if (await page.locator("text=Your perfect").count()) break;
  }
  const done = (await page.locator("text=Your perfect").count()) > 0;
  console.log(done ? "PLANNER FLOW: PASS" : "PLANNER FLOW: FAIL");
  await browser.close();
  process.exit(done ? 0 : 1);
})();
```

- [ ] **Step 5: Run the e2e smoke**

Start both servers (backend: `python main.py` from `meetbuddy2/backend/`; frontend: `npm run dev` from `meetbuddy2/` — background them), then:
Run: `node meetbuddy2/e2e/planner-flow.cjs`
Expected: `PLANNER FLOW: PASS`

- [ ] **Step 6: Commit**

```bash
git add meetbuddy2/src/hooks/usePlannerSession.js meetbuddy2/src/pages/Planner.jsx meetbuddy2/e2e/planner-flow.cjs
git commit -m "refactor(planner): extract usePlannerSession hook, add e2e smoke"
```

---

### Task 6: Map-first step page (`StepExplorer`) + `PlannerHome`

**Files:**
- Create: `meetbuddy2/src/components/planner/PlannerHome.jsx`
- Create: `meetbuddy2/src/components/planner/StepExplorer.jsx`
- Modify: `meetbuddy2/src/pages/Planner.jsx` (render new components for `home`/`step`)

**Interfaces:**
- Consumes: `usePlannerSession` object (Task 5), `MapPlanner` (existing; accepts `className` to control size), `GlassCard`/`GlowButton`, `applyFiltersAndSort`, `humanStepName`, `STEP_EMOJI`.
- Produces: `<PlannerHome P={P} />` and `<StepExplorer P={P} />` where `P` is the hook object. `StepGrid` and `ErrorBanner` move from `Planner.jsx` into `StepExplorer.jsx` (exported: `export { ErrorBanner }` for reuse by ItineraryCanvas).

- [ ] **Step 1: Create `PlannerHome.jsx`**

Move the `page === "home"` JSX (Planner.jsx lines 816–920) into the new component verbatim, converting `P.`-prefixed identifiers into destructured hook fields:

```jsx
// src/components/planner/PlannerHome.jsx
import { motion } from "framer-motion";
import { MapPin, LocateFixed, Rocket } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import { PREF_META } from "@/hooks/usePlannerSession";
import { ErrorBanner } from "./StepExplorer";

const displayPref = (val) => {
  if (!val) return "—";
  return Array.isArray(val) ? val.join(", ") : String(val);
};

export default function PlannerHome({ P }) {
  const { userPrefs, placeText, setPlaceText, coords, locLoading, useMyLocation,
          handlePlaceTextBlur, flowText, plannerError, startSession, sessionLoading } = P;
  return (
    /* lines 817-919 of the old Planner.jsx, unchanged markup */
  );
}
```

- [ ] **Step 2: Create `StepExplorer.jsx`**

Full component (new layout; `StepGrid`, `ErrorBanner` moved here from `Planner.jsx` unchanged):

```jsx
// src/components/planner/StepExplorer.jsx
// Map-first step page: full-viewport map, floating controls, bottom option
// carousel, and a collapsed "view all options" card grid below the map.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ArrowLeft, ArrowRight, X, Star, ExternalLink, Check,
         RotateCcw, ChevronDown, ChevronUp, AlertTriangle, SlidersHorizontal } from "lucide-react";
import MapPlanner from "@/components/MapPlanner";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import { STEP_EMOJI, humanStepName, applyFiltersAndSort } from "@/hooks/usePlannerSession";

export function ErrorBanner({ message }) { /* moved verbatim from Planner.jsx lines 104-116 */ }

function StepGrid({ options = [], onSelect, loading, onHighlight, onRetry, onBack, pickBadge = false }) {
  /* moved verbatim from Planner.jsx lines 119-235 */
}

// Compact option card for the floating bottom carousel
function CarouselCard({ o, idx, pickBadge, onSelect, onHighlight, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.05, 0.4) }}
      onMouseEnter={() => onHighlight(o)}
      onMouseLeave={() => onHighlight(null)}
      className="snap-start shrink-0 w-64 glass-strong rounded-2xl border border-white/10 hover:border-brand/50 transition-colors overflow-hidden"
    >
      {o.thumbnail && (
        <div className="h-20 overflow-hidden relative">
          <img src={o.thumbnail} alt={o.title} className="w-full h-full object-cover" />
          {pickBadge && idx === 0 && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-gradient-to-r from-brand to-brand-2">
              ⭐ MeetBuddy's pick
            </span>
          )}
        </div>
      )}
      <div className="p-3">
        {!o.thumbnail && pickBadge && idx === 0 && (
          <span className="inline-block mb-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-gradient-to-r from-brand to-brand-2">
            ⭐ MeetBuddy's pick
          </span>
        )}
        <p className="font-semibold text-sm text-white line-clamp-1">{o.title || o.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{o.address}</p>
        <div className="flex items-center gap-2.5 mt-1.5 text-xs">
          {o.rating && (
            <span className="text-yellow-400 flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400" /> {o.rating}
            </span>
          )}
          {o.distance_meters != null && (
            <span className="text-brand-3">
              {o.distance_meters < 1000
                ? `${Math.round(o.distance_meters)} m`
                : `${(o.distance_meters / 1000).toFixed(1)} km`}
            </span>
          )}
        </div>
        <div className="flex gap-1.5 mt-2.5">
          <button
            onClick={() => onSelect(o)}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gradient-to-r from-brand to-brand-2 text-white rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> Select
          </button>
          {o.link && (
            <button
              onClick={() => window.open(o.link, "_blank", "noopener,noreferrer")}
              className="px-2 py-1.5 glass rounded-lg text-xs cursor-pointer hover:bg-white/10"
              aria-label="Open in Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function StepExplorer({ P }) {
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [showControls, setShowControls] = useState(false); // filter/sort + step editor popover
  const {
    currentStep, stepOptions, initialFlow, planMode, directives, anchorText,
    selectedChain, sessionLoading, plannerError, highlightedPlace, setHighlightedPlace,
    activeFilters, setActiveFilters, sortBy, setSortBy, showAllOptions, setShowAllOptions,
    upcomingSteps, removeUpcomingStep, addUpcomingStep, moveUpcomingStep,
    selectOption, goBackOneStep, skipStep, startSession, setPage, setSessionId, setSelectedChain,
  } = P;

  const shortlist = planMode === "semi" ? directives?.shortlist : null;
  let displayedOptions = shortlist && !showAllOptions ? stepOptions.slice(0, shortlist) : stepOptions;
  if (planMode === "full") displayedOptions = applyFiltersAndSort(displayedOptions, activeFilters, sortBy);
  const filterChips = planMode === "full" ? directives?.filters || [] : [];
  const currentIdx = initialFlow.indexOf(currentStep);

  const cancel = () => { setPage("home"); setSessionId(null); setSelectedChain([]); };

  return (
    <div className="max-w-none">
      {/* ------- full-viewport map stage ------- */}
      <div className="relative h-[calc(100vh-7rem)] min-h-[480px]">
        <MapPlanner
          className="absolute inset-0"
          options={displayedOptions}
          selectedChain={selectedChain}
          onSelect={selectOption}
          highlightedPlace={highlightedPlace}
        />

        {/* floating top bar */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex items-start justify-between gap-3 pointer-events-none">
          <div className="glass-strong rounded-2xl px-4 py-3 border border-white/10 pointer-events-auto max-w-[70%]">
            <div className="flex items-center gap-2 flex-wrap">
              {initialFlow.map((step, i) => (
                <span
                  key={step}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    i === currentIdx
                      ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50"
                      : i < currentIdx
                      ? "glass text-brand-3 border border-brand/25"
                      : "glass text-muted-foreground"
                  }`}
                >
                  {i < currentIdx ? <Check className="w-3 h-3" /> : <span>{STEP_EMOJI[step] ?? "📍"}</span>}
                  {humanStepName(step)}
                </span>
              ))}
              <span className="glass px-2.5 py-1 rounded-full text-[10px] font-medium text-brand-3 border border-brand/25">
                {planMode === "full" ? "🎛️ Full control" : "🎨 Guided"}
              </span>
            </div>
            {anchorText && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-brand-3" /> {anchorText}
              </p>
            )}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            {planMode === "full" && (
              <GlowButton variant="ghost" onClick={() => setShowControls((s) => !s)} aria-label="Filters and steps">
                <SlidersHorizontal className="w-4 h-4" />
              </GlowButton>
            )}
            <GlowButton variant="ghost" onClick={goBackOneStep}>
              <ArrowLeft className="w-4 h-4" /> Back
            </GlowButton>
            {planMode === "full" && (
              <GlowButton variant="ghost" onClick={skipStep}>
                Skip <ArrowRight className="w-4 h-4" />
              </GlowButton>
            )}
            <GlowButton variant="danger" onClick={cancel} aria-label="Cancel planning">
              <X className="w-4 h-4" />
            </GlowButton>
          </div>
        </div>

        {/* full-control popover: filter chips + sort + upcoming-step editor */}
        <AnimatePresence>
          {planMode === "full" && showControls && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-24 right-4 z-[1000] glass-strong rounded-2xl p-5 border border-white/10 w-80 max-h-[60vh] overflow-y-auto"
            >
              {/* filter chips + sort pills: markup moved verbatim from Planner.jsx lines 1048-1088 */}
              {/* upcoming-step editor: markup moved verbatim from Planner.jsx lines 992-1042 */}
            </motion.div>
          )}
        </AnimatePresence>

        {/* shortlist banner (semi mode) */}
        {shortlist && stepOptions.length > shortlist && (
          <div className="absolute bottom-44 left-4 z-[1000] glass-strong rounded-xl px-4 py-2 border border-brand/20 text-xs text-muted-foreground">
            {showAllOptions ? `All ${stepOptions.length} options` : `✨ Top ${Math.min(shortlist, stepOptions.length)} picks`}
            <button
              onClick={() => setShowAllOptions((s) => !s)}
              className="ml-2 font-medium text-brand-3 hover:text-white cursor-pointer"
            >
              {showAllOptions ? "Back to shortlist" : "Show all"}
            </button>
          </div>
        )}

        {/* bottom option carousel */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="mb-2"><ErrorBanner message={plannerError} /></div>
          {displayedOptions.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto snap-x pb-2">
              {displayedOptions.map((o, idx) => (
                <CarouselCard
                  key={o.place_id || `${o.title}-${idx}`}
                  o={o} idx={idx}
                  pickBadge={planMode === "semi" && !showAllOptions}
                  onSelect={selectOption}
                  onHighlight={setHighlightedPlace}
                  loading={sessionLoading}
                />
              ))}
            </div>
          ) : (
            <GlassCard variant="strong" className="p-6 text-center">
              <p className="text-sm text-foreground/85 mb-3">
                {stepOptions.length > 0 ? "No venues match your filters." : "😅 No options for this step."}
              </p>
              {stepOptions.length > 0 ? (
                <GlowButton variant="ghost" onClick={() => setActiveFilters([])}>Clear filters</GlowButton>
              ) : (
                <div className="flex justify-center gap-3">
                  <GlowButton onClick={startSession}><RotateCcw className="w-4 h-4" /> Retry</GlowButton>
                  <GlowButton variant="ghost" onClick={cancel}><ArrowLeft className="w-4 h-4" /> Go back</GlowButton>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      {/* ------- collapsed "view all options" grid below the map ------- */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <button
          onClick={() => setShowAllGrid((s) => !s)}
          className="w-full flex items-center justify-center gap-2 glass rounded-2xl py-3 text-sm font-medium text-brand-3 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {showAllGrid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showAllGrid ? "Hide detailed cards" : `View all ${displayedOptions.length} options as cards`}
        </button>
        <AnimatePresence>
          {showAllGrid && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-5"
            >
              <StepGrid
                options={displayedOptions}
                pickBadge={planMode === "semi" && !showAllOptions}
                onSelect={selectOption}
                loading={sessionLoading}
                onHighlight={setHighlightedPlace}
                onRetry={startSession}
                onBack={cancel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

Note: the two `/* moved verbatim */` popover blocks are literal copies of the referenced Planner.jsx line ranges with identifiers destructured from `P` (already in scope) — copy them, don't rewrite them.

- [ ] **Step 3: Rewire `Planner.jsx`**

Replace the `page === "home"` block with `<PlannerHome P={P} />` and the `page === "step"` block with `<StepExplorer P={P} />`. Delete the now-moved `StepGrid`, `ErrorBanner`, `FlowStepper` (fully superseded by the floating pill bar), `displayPref`, and their now-unused imports. The `page === "summary"` block, swap modal, and `FullOverlay` stay unchanged this task (summary still imports `ErrorBanner`? — it doesn't; only home/step used it. If lint flags anything unused, delete it).

- [ ] **Step 4: Verify**

Run: `npm run lint` → 0 errors; `npm run build` → success; `node meetbuddy2/e2e/planner-flow.cjs` (servers running) → `PLANNER FLOW: PASS`.
Manual check (headed browser or screenshot via Playwright): map fills the viewport, cards overlay at the bottom, "View all options" starts collapsed.

- [ ] **Step 5: Commit**

```bash
git add meetbuddy2/src
git commit -m "feat(ui): map-first step explorer + extracted planner home"
```

---

### Task 7: `StopPicker` (shared add / swap panel)

**Files:**
- Create: `meetbuddy2/src/components/planner/StopPicker.jsx`

**Interfaces:**
- Consumes: `POST http://localhost:8000/planner/options` (Task 3), `GET http://localhost:8000/geocode` (Task 4), `STEP_EMOJI`/`humanStepName`.
- Produces: `<StopPicker open category anchor prefs cachedOptions excludeKeys onPick onClose />`
  - `open: bool` · `category: "restaurant"|"cafe"|"activity"|"stay"` (initial tab-2 selection and suggestions source)
  - `anchor: {lat, lng} | null` — coords the fresh search anchors to
  - `prefs: object` — questionnaire prefs forwarded to the options endpoint
  - `cachedOptions: {[step]: places[]}` — suggestions source (pass `optionsByStep` live, `{}` when reopened)
  - `excludeKeys: string[]` — `place_id || title` values already in the itinerary
  - `onPick(place, step)` — called with the chosen place and its category (`"custom"` for tab 3)

- [ ] **Step 1: Write the component**

```jsx
// src/components/planner/StopPicker.jsx
// One picker for both "swap this stop" and "add a stop": cached suggestions
// first (free), fresh anchored search on demand, or a custom geocoded place.
import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Star, MapPin, Loader2 } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import { STEP_EMOJI, humanStepName } from "@/hooks/usePlannerSession";

const CATEGORIES = ["restaurant", "cafe", "activity", "stay"];
const placeKey = (p) => p.place_id || p.title;

function PlaceRow({ o, onPick }) {
  return (
    <button
      onClick={() => onPick(o)}
      className="w-full text-left glass rounded-xl p-3.5 hover:bg-white/10 hover:border-brand/40 border border-transparent transition-all cursor-pointer flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{o.title || o.name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{o.address}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0 text-xs">
        {o.rating && (
          <span className="text-yellow-400 flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400" /> {o.rating}
          </span>
        )}
        {o.distance_meters != null && (
          <span className="text-brand-3">
            {o.distance_meters < 1000
              ? `${Math.round(o.distance_meters)} m`
              : `${(o.distance_meters / 1000).toFixed(1)} km`}
          </span>
        )}
      </div>
    </button>
  );
}

export default function StopPicker({ open, category, anchor, prefs, cachedOptions = {},
                                     excludeKeys = [], onPick, onClose }) {
  const [tab, setTab] = useState("suggestions"); // suggestions | search | custom
  const [searchCat, setSearchCat] = useState(category || "restaurant");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // custom tab
  const [customText, setCustomText] = useState("");
  const [customCoords, setCustomCoords] = useState(null);

  useEffect(() => {
    if (open) {
      setTab("suggestions"); setSearchCat(category || "restaurant");
      setResults(null); setError(null); setCustomText(""); setCustomCoords(null);
    }
  }, [open, category]);

  const suggestions = (cachedOptions[category] || []).filter((o) => !excludeKeys.includes(placeKey(o)));

  const runSearch = async () => {
    if (!anchor) { setError("No location to search around."); return; }
    setLoading(true); setError(null);
    try {
      const res = await axios.post("http://localhost:8000/planner/options",
        { category: searchCat, anchor, preferences: prefs || {} }, { timeout: 60000 });
      if (res.data.search_error) setError(`Search failed: ${res.data.search_error}`);
      setResults((res.data.options || []).filter((o) => !excludeKeys.includes(placeKey(o))));
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const locateCustom = async () => {
    if (!customText.trim()) return;
    setLoading(true); setError(null); setCustomCoords(null);
    try {
      const res = await axios.get("http://localhost:8000/geocode",
        { params: { q: customText.trim() }, timeout: 30000 });
      setCustomCoords(res.data);
    } catch {
      setError("Couldn't find that address — you can still add it without a map pin.");
    } finally {
      setLoading(false);
    }
  };

  const addCustom = () => {
    onPick({ title: customText.trim(), address: customText.trim(),
             lat: customCoords?.lat ?? null, lng: customCoords?.lng ?? null }, "custom");
  };

  const TABS = [["suggestions", "Suggestions"], ["search", "Find more"], ["custom", "Custom place"]];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-white/10"
          >
            <div className="p-5 pb-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex gap-1.5">
                {TABS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                      tab === key ? "glass text-white border border-white/25" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={onClose} aria-label="Close"
                      className="p-2 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 min-h-[200px]">
              {error && <p className="text-sm text-red-300">{error}</p>}

              {tab === "suggestions" && (
                suggestions.length > 0 ? (
                  suggestions.slice(0, 10).map((o) => (
                    <PlaceRow key={placeKey(o)} o={o} onPick={(p) => onPick(p, category)} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No unused suggestions for this step — try "Find more".
                  </p>
                )
              )}

              {tab === "search" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap pb-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSearchCat(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
                          searchCat === c
                            ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50"
                            : "glass text-foreground/75 hover:bg-white/10"
                        }`}
                      >
                        {STEP_EMOJI[c]} {humanStepName(c)}
                      </button>
                    ))}
                    <GlowButton onClick={runSearch} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
                    </GlowButton>
                  </div>
                  {results && results.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nothing found nearby.</p>
                  )}
                  {(results || []).slice(0, 10).map((o) => (
                    <PlaceRow key={placeKey(o)} o={o} onPick={(p) => onPick(p, searchCat)} />
                  ))}
                </>
              )}

              {tab === "custom" && (
                <div className="space-y-3">
                  <input
                    value={customText}
                    onChange={(e) => { setCustomText(e.target.value); setCustomCoords(null); }}
                    onKeyDown={(e) => e.key === "Enter" && locateCustom()}
                    placeholder="Place name or address…"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-brand/60"
                  />
                  <div className="flex gap-2">
                    <GlowButton variant="ghost" onClick={locateCustom} disabled={loading || !customText.trim()}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Locate
                    </GlowButton>
                    <GlowButton onClick={addCustom} disabled={!customText.trim()}>
                      Add to itinerary
                    </GlowButton>
                  </div>
                  {customCoords && (
                    <p className="text-xs text-brand-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Found: {customCoords.lat.toFixed(4)}, {customCoords.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint` → 0 errors; `npm run build` → success (component not yet mounted — that's Task 8).

- [ ] **Step 3: Commit**

```bash
git add meetbuddy2/src/components/planner/StopPicker.jsx
git commit -m "feat(ui): StopPicker panel — cached suggestions, fresh search, custom place"
```

---

### Task 8: Route-canvas summary (`ItineraryCanvas`) with local editing

**Files:**
- Create: `meetbuddy2/src/components/planner/ItineraryCanvas.jsx`
- Modify: `meetbuddy2/src/pages/Planner.jsx` (render it for `summary`; delete old summary + swap modal)

**Interfaces:**
- Consumes: hook object `P`, `StopPicker` (Task 7), `MapPlanner`, `deriveServiceNotes`, `POST/PUT /itineraries` (Task 2), framer-motion `Reorder`.
- Produces: `<ItineraryCanvas P={P} initialItinerary={null|{id,title,planned_date,stops}} />` — `initialItinerary` non-null when reopened from My Itineraries (Task 9). Maintains local `stops = [{step, place, note}]`; all edits local; Save creates (`POST`) or updates (`PUT`) and stores the returned `id` for subsequent saves.

- [ ] **Step 1: Write the component**

```jsx
// src/components/planner/ItineraryCanvas.jsx
// "Your perfect itinerary" as an editable route canvas. All edits are local:
// the map redraws instantly, nothing cascades, Save persists to the API.
import { useMemo, useState } from "react";
import axios from "axios";
import { motion, Reorder } from "framer-motion";
import { GripVertical, RefreshCw, X, Plus, StickyNote, Rocket, Printer,
         Save, PartyPopper, MapPin, Check } from "lucide-react";
import MapPlanner from "@/components/MapPlanner";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import StopPicker from "./StopPicker";
import { STEP_EMOJI, humanStepName, deriveServiceNotes } from "@/hooks/usePlannerSession";

const haversineKm = (a, b) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
};

const stopKey = (s) => s.place?.place_id || s.place?.title || "";

export default function ItineraryCanvas({ P, initialItinerary = null }) {
  const { userPrefs, user, selectedChain, optionsByStep, setPage, setSessionId, setSelectedChain } = P;

  const [stops, setStops] = useState(() =>
    initialItinerary
      ? initialItinerary.stops
      : selectedChain.map((s) => ({ step: s.step, place: s.place, note: "" }))
  );
  const [title, setTitle] = useState(initialItinerary?.title || `${userPrefs?.mood || "My"} meetup plan`);
  const [plannedDate, setPlannedDate] = useState(initialItinerary?.planned_date || "");
  const [savedId, setSavedId] = useState(initialItinerary?.id || null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [noteOpen, setNoteOpen] = useState(null);     // stop key with the note field open
  // picker: {mode: "swap"|"add", index, category}
  const [picker, setPicker] = useState(null);

  const coordsOf = (s) =>
    s.place?.lat != null && s.place?.lng != null
      ? { lat: Number(s.place.lat), lng: Number(s.place.lng) } : null;

  const totalKm = useMemo(() => {
    const pts = stops.map(coordsOf).filter(Boolean);
    let km = 0;
    for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
    return km;
  }, [stops]);

  // anchor a picker search to the stop before the insertion point (or first stop)
  const pickerAnchor = (index) => {
    for (let i = Math.min(index, stops.length) - 1; i >= 0; i--) {
      const c = coordsOf(stops[i]);
      if (c) return c;
    }
    return stops.map(coordsOf).find(Boolean) || (userPrefs?.coords ?? null);
  };

  const applyPick = (place, step) => {
    setStops((cur) => {
      const next = [...cur];
      if (picker.mode === "swap") next[picker.index] = { ...next[picker.index], step, place };
      else next.splice(picker.index, 0, { step, place, note: "" });
      return next;
    });
    setPicker(null);
    setSaveState("idle");
  };

  const save = async () => {
    if (!user) return;
    setSaveState("saving");
    const payload = { user_id: user.user_id, title: title.trim() || "Untitled plan",
                      planned_date: plannedDate || null, stops };
    try {
      const res = savedId
        ? await axios.put(`http://localhost:8000/itineraries/${savedId}`, payload, { timeout: 30000 })
        : await axios.post("http://localhost:8000/itineraries", payload, { timeout: 30000 });
      setSavedId(res.data.id);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const planAnother = () => { setPage("home"); setSessionId(null); setSelectedChain([]); };
  const serviceNotes = deriveServiceNotes(userPrefs);

  const AddBetween = ({ index }) => (
    <button
      onClick={() => setPicker({ mode: "add", index, category: "restaurant" })}
      className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-brand-3/70 hover:text-brand-3 transition-colors cursor-pointer print:hidden"
    >
      <Plus className="w-3 h-3" /> add a stop here
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 mb-5 print:hidden">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center glow-sm">
          <PartyPopper className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Your perfect <span className="text-gradient">itinerary</span>
          </h1>
          <p className="text-sm text-muted-foreground">Drag, swap, and tweak until it's yours.</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* -------- map hero -------- */}
        <div className="relative glass-strong rounded-3xl overflow-hidden border border-white/10 min-h-[420px] lg:min-h-[600px]">
          <MapPlanner
            className="absolute inset-0"
            options={[]}
            selectedChain={stops}
          />
          <div className="absolute bottom-3 left-3 z-[1000] glass-strong rounded-xl px-3.5 py-2 text-xs text-foreground/85 border border-white/10">
            {stops.length} stop{stops.length === 1 ? "" : "s"}
            {totalKm > 0 && <> · ~{totalKm.toFixed(1)} km route</>}
          </div>
        </div>

        {/* -------- editing panel -------- */}
        <GlassCard variant="gradient" className="p-6">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaveState("idle"); }}
            className="w-full bg-transparent text-xl font-semibold text-white outline-none border-b border-transparent focus:border-brand/40 pb-1 mb-2"
            aria-label="Itinerary title"
          />
          <input
            type="date"
            value={plannedDate || ""}
            onChange={(e) => { setPlannedDate(e.target.value); setSaveState("idle"); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground/85 outline-none focus:border-brand/50 mb-5 [color-scheme:dark]"
            aria-label="Planned date"
          />

          <AddBetween index={0} />
          <Reorder.Group axis="y" values={stops} onReorder={(v) => { setStops(v); setSaveState("idle"); }} className="space-y-1">
            {stops.map((s, i) => (
              <div key={stopKey(s) + i}>
                <Reorder.Item value={s} className="glass rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 print:hidden" />
                  <span className="w-6 h-6 shrink-0 bg-gradient-to-br from-brand to-brand-2 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-brand-3 uppercase tracking-wider">
                      {STEP_EMOJI[s.step] ?? "📍"} {humanStepName(s.step)}
                    </p>
                    <p className="text-sm text-white font-medium truncate">{s.place?.title || s.place?.name}</p>
                    {s.note && <p className="text-xs text-muted-foreground truncate">📝 {s.note}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0 print:hidden">
                    <button onClick={() => setNoteOpen(noteOpen === i ? null : i)} aria-label="Edit note"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer">
                      <StickyNote className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPicker({ mode: "swap", index: i, category: s.step === "custom" ? "restaurant" : s.step })}
                            aria-label="Swap stop"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setStops((cur) => cur.filter((_, j) => j !== i)); setSaveState("idle"); }}
                            aria-label="Remove stop"
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-white/10 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Reorder.Item>
                {noteOpen === i && (
                  <input
                    autoFocus
                    value={s.note || ""}
                    onChange={(e) => { const v = e.target.value;
                      setStops((cur) => cur.map((st, j) => (j === i ? { ...st, note: v } : st))); setSaveState("idle"); }}
                    onKeyDown={(e) => e.key === "Enter" && setNoteOpen(null)}
                    onBlur={() => setNoteOpen(null)}
                    placeholder="Add a note — e.g. book a window table"
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-foreground outline-none focus:border-brand/50 print:hidden"
                  />
                )}
                <AddBetween index={i + 1} />
              </div>
            ))}
          </Reorder.Group>

          {stops.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No stops yet — add one above.
            </p>
          )}

          {serviceNotes.length > 0 && (
            <div className="mt-5 glass rounded-2xl p-4 border border-brand/20">
              <p className="text-sm font-semibold text-white mb-2">Don't forget</p>
              <ul className="space-y-1.5">
                {serviceNotes.map((note) => (
                  <li key={note} className="text-xs text-foreground/85">{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2.5 mt-6 print:hidden">
            <GlowButton onClick={save} disabled={saveState === "saving" || stops.length === 0} size="lg" className="w-full">
              {saveState === "saving" ? <RefreshCw className="w-4.5 h-4.5 animate-spin" />
               : saveState === "saved" ? <Check className="w-4.5 h-4.5" /> : <Save className="w-4.5 h-4.5" />}
              {saveState === "saved" ? "Saved!" : savedId ? "Save changes" : "Save itinerary"}
            </GlowButton>
            {saveState === "error" && (
              <p className="text-xs text-red-300 text-center">Couldn't save — your plan is still here, try again.</p>
            )}
            <div className="flex gap-2.5">
              <GlowButton variant="ghost" onClick={() => window.print()} className="flex-1">
                <Printer className="w-4.5 h-4.5" /> Print
              </GlowButton>
              <GlowButton variant="ghost" onClick={planAnother} className="flex-1">
                <Rocket className="w-4.5 h-4.5" /> Plan another
              </GlowButton>
            </div>
          </div>
        </GlassCard>
      </div>

      <StopPicker
        open={picker != null}
        category={picker?.category || "restaurant"}
        anchor={picker ? pickerAnchor(picker.index) : null}
        prefs={userPrefs}
        cachedOptions={optionsByStep}
        excludeKeys={stops.map(stopKey)}
        onPick={applyPick}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewire `Planner.jsx`**

Replace the whole `page === "summary"` block with `<ItineraryCanvas P={P} />` and **delete** the old swap modal (`swapIndex` UI) — swapping now lives in the canvas. Remove now-unused imports and the `swapIndex`/`setSwapIndex` and `swapStop` entries from the hook return **only if** nothing else references them (`swapStop`'s cascade behavior is intentionally retired per spec; delete it from the hook and its `axios` re-chain code).

- [ ] **Step 3: Verify**

Run: `npm run lint` → 0 errors; `npm run build` → success; `node meetbuddy2/e2e/planner-flow.cjs` → PASS.
Manual (headed): on the summary — drag a stop row (order changes, polyline redraws), remove a stop, add a stop from Suggestions, add a note, Save (row appears in DB: `python -c "from database import SessionLocal; from models import Itinerary; db=SessionLocal(); print(db.query(Itinerary).count())"`).

- [ ] **Step 4: Commit**

```bash
git add meetbuddy2/src
git commit -m "feat(ui): editable route-canvas itinerary with save, notes, add/swap/remove/reorder"
```

---

### Task 9: My Itineraries page + reopen flow + navbar

**Files:**
- Create: `meetbuddy2/src/pages/MyItineraries.jsx`
- Modify: `meetbuddy2/src/App.jsx` (route), `meetbuddy2/src/components/Navbar.jsx` (nav link), `meetbuddy2/src/pages/Planner.jsx` (hydrate from router state)

**Interfaces:**
- Consumes: `GET /itineraries?user_id=`, `GET /itineraries/{id}?user_id=`, `DELETE /itineraries/{id}?user_id=` (Task 2); `ItineraryCanvas`'s `initialItinerary` prop (Task 8).
- Produces: route `/itineraries` (protected); opening a saved plan navigates to `/planner` with `location.state = { itineraryId }`.

- [ ] **Step 1: Write `MyItineraries.jsx`**

```jsx
// src/pages/MyItineraries.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Trash2, ArrowRight, Rocket } from "lucide-react";
import Navbar from "../components/Navbar";
import AmbientBackground from "@/components/AmbientBackground";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";

export default function MyItineraries() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const load = async () => {
    if (!user) return setItems([]);
    try {
      const res = await axios.get("http://localhost:8000/itineraries",
        { params: { user_id: user.user_id }, timeout: 30000 });
      setItems(res.data);
    } catch {
      setError("Couldn't load your itineraries.");
      setItems([]);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (id) => {
    if (!window.confirm("Delete this itinerary?")) return;
    try {
      await axios.delete(`http://localhost:8000/itineraries/${id}`,
        { params: { user_id: user.user_id }, timeout: 30000 });
      setItems((cur) => cur.filter((i) => i.id !== id));
    } catch {
      setError("Delete failed. Please try again.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="app" />
      <Navbar />
      <div className="min-h-screen pt-28 pb-16 max-w-4xl mx-auto px-6">
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                   className="text-3xl md:text-5xl font-bold text-white mb-8">
          My <span className="text-gradient">itineraries</span>
        </motion.h1>
        {error && <p className="text-sm text-red-300 mb-4">{error}</p>}
        {items === null && <p className="text-muted-foreground">Loading…</p>}
        {items && items.length === 0 && (
          <GlassCard variant="strong" className="p-10 text-center">
            <p className="text-foreground/85 mb-5">No saved plans yet — build one and hit Save.</p>
            <GlowButton onClick={() => navigate("/planner")}>
              <Rocket className="w-4.5 h-4.5" /> Plan a meetup
            </GlowButton>
          </GlassCard>
        )}
        <div className="space-y-3">
          {(items || []).map((it, idx) => (
            <motion.div key={it.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}>
              <GlassCard variant="gradient" className="p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-white truncate">{it.title}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {it.stop_count} stops</span>
                    {it.planned_date && (
                      <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {it.planned_date}</span>
                    )}
                  </p>
                </div>
                <GlowButton onClick={() => navigate("/planner", { state: { itineraryId: it.id } })}>
                  Open <ArrowRight className="w-4 h-4" />
                </GlowButton>
                <button onClick={() => remove(it.id)} aria-label="Delete itinerary"
                        className="p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-white/10 cursor-pointer">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the route** (`App.jsx`)

```jsx
import MyItineraries from "./pages/MyItineraries";
```

```jsx
          <Route
            path="/itineraries"
            element={wrap(
              <ProtectedRoute>
                <MyItineraries />
              </ProtectedRoute>
            )}
          />
```

- [ ] **Step 3: Add the nav link** (`Navbar.jsx`)

In `navLinks` (line ~47), inside the `isLoggedIn` spread after the Planner entry, add (import `Bookmark` from lucide-react):

```jsx
          { path: "/itineraries", label: "My Plans", icon: Bookmark },
```

- [ ] **Step 4: Hydrate a reopened itinerary in `Planner.jsx`**

```jsx
import { useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
```

Inside the component:

```jsx
  const location = useLocation();
  const [reopened, setReopened] = useState(null);

  useEffect(() => {
    const id = location.state?.itineraryId;
    if (!id) return;
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) return;
    axios.get(`http://localhost:8000/itineraries/${id}`,
      { params: { user_id: user.user_id }, timeout: 30000 })
      .then((res) => { setReopened(res.data); P.setPage("summary"); })
      .catch(() => P.setPlannerError("Couldn't open that itinerary."));
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
```

And the summary render becomes:

```jsx
        {P.page === "summary" && (
          <ItineraryCanvas key={reopened?.id ?? "live"} P={P} initialItinerary={reopened} />
        )}
```

(`key` forces a fresh canvas when switching between a live plan and a reopened one.)

- [ ] **Step 5: Verify**

`npm run lint` → 0 errors; `npm run build` → success.
Manual: save a plan (Task 8), visit `/itineraries` via the navbar "My Plans", Open → canvas shows the saved stops with title/date; edit + Save changes → reload `/itineraries` shows updated `stop_count`; Delete removes the card.

- [ ] **Step 6: Commit**

```bash
git add meetbuddy2/src
git commit -m "feat(ui): My Itineraries page with reopen and delete"
```

---

### Task 10: End-to-end verification + regression sweep

**Files:**
- Create: `meetbuddy2/e2e/itinerary-edit.cjs`

**Interfaces:**
- Consumes: everything above; both dev servers running.

- [ ] **Step 1: Write the editing e2e**

```js
// meetbuddy2/e2e/itinerary-edit.cjs
// Plan -> summary -> edit (note + remove) -> save -> reopen from My Plans.
// Needs backend :8000 + vite :5173 and a real logged-in user id (env USER_ID).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/");
  await page.evaluate((uid) => {
    localStorage.clear();
    localStorage.setItem("user", JSON.stringify({ user_id: uid, username: "test" }));
    localStorage.setItem("userPreferences", JSON.stringify({
      mood: "Romantic", planningStyle: "Surprise me", adventureLevel: "Stick to the city",
      memorableFactor: "Amazing food", location: "Indiranagar Bangalore",
    }));
  }, USER_ID);

  // Surprise mode -> straight to summary
  await page.goto("http://localhost:5173/planner");
  await page.waitForTimeout(1500);
  await page.click("text=Generate itinerary");
  await page.waitForSelector("text=Save itinerary", { timeout: 120000 });

  const stopsBefore = await page.locator('[aria-label="Remove stop"]').count();
  console.log("stops:", stopsBefore);

  // note on first stop
  await page.locator('[aria-label="Edit note"]').first().click();
  await page.fill('input[placeholder*="book a window table"]', "e2e note");
  await page.keyboard.press("Enter");

  // remove last stop (if >1)
  if (stopsBefore > 1) await page.locator('[aria-label="Remove stop"]').last().click();

  // title + save
  await page.fill('[aria-label="Itinerary title"]', "E2E plan");
  await page.click("text=Save itinerary");
  await page.waitForSelector("text=Saved!", { timeout: 30000 });

  // reopen from My Plans
  await page.goto("http://localhost:5173/itineraries");
  await page.waitForSelector("text=E2E plan", { timeout: 15000 });
  await page.click("text=Open");
  await page.waitForSelector("text=Save changes", { timeout: 15000 });
  const noteThere = (await page.locator("text=e2e note").count()) > 0;
  const stopsAfter = await page.locator('[aria-label="Remove stop"]').count();

  const pass = noteThere && (stopsBefore <= 1 || stopsAfter === stopsBefore - 1);
  console.log(pass ? "ITINERARY EDIT: PASS" : `ITINERARY EDIT: FAIL note=${noteThere} stops=${stopsAfter}/${stopsBefore}`);
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
```

- [ ] **Step 2: Run everything**

With both servers up (backend from `meetbuddy2/backend`: `python main.py`; frontend from `meetbuddy2`: `npm run dev`):

```bash
cd meetbuddy2/backend && python -m pytest -v            # all suites: cache, scoring, itineraries, options, geocode
cd ../.. && node meetbuddy2/e2e/planner-flow.cjs        # PLANNER FLOW: PASS
node meetbuddy2/e2e/itinerary-edit.cjs                  # ITINERARY EDIT: PASS
cd meetbuddy2 && npm run lint && npm run build
```

Expected: every suite green, lint clean, build succeeds. If `planner-flow` fails on venue search, check `SERPAPI_KEY` / cache warmth — that's environmental, not a code failure; rerun after one manual flow.

- [ ] **Step 3: Add e2e scripts note + commit**

```bash
git add meetbuddy2/e2e
git commit -m "test(e2e): itinerary editing round-trip"
```

- [ ] **Step 4: Offer the PR**

Branch `feat/planner-redesign` is ready for a PR into `main` (user approves PRs; note the branch stacks on `feat/backend-reco-engine-v2` — that PR merges first or this PR includes both).

---

## Self-Review Notes

- **Spec coverage:** map-first step page (T6), collapsed all-options grid (T6), route-canvas summary with local add/remove/reorder/swap/notes/title/date (T8), cached-first + fresh-search + custom-place picker (T7, backed by T3/T4), DB persistence + My Itineraries (T1/T2/T9), retire `itinerary_manager.py` (T2), e2e + backend tests (T5/T10). Print keeps `window.print()` with `print:hidden` utilities on edit chrome (T8).
- **Type consistency:** hook return keys (T5) match destructuring in T6/T8; `StopPicker` props (T7) match usage in T8; `initialItinerary` (T8) matches `GET /itineraries/{id}` response shape (T2); stop shape `{step, place, note}` consistent across T1/T2/T8/T10.
- **Deliberate scope cuts:** `swapStop` cascade deleted (spec: edits are local); `FlowStepper` deleted (floating pills replace it); mobile bottom-sheet variant of the edit panel deferred — the grid stacks vertically on mobile, which is usable; revisit if mobile feels cramped.
