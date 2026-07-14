# MeetBuddy Copilot Instructions

## Project Overview
**MeetBuddy** is a full-stack meet-planning application that helps users discover and organize group outings (restaurants, activities, accommodations) based on personalized preferences. It features a questionnaire-driven flow that builds customized itineraries using the SerpAPI for venue discovery.

**Stack:**
- **Frontend:** React 19 + Vite + TailwindCSS 4 + Radix UI components + Leaflet maps
- **Backend:** FastAPI + PostgreSQL + SQLAlchemy ORM
- **Auth:** Basic username/email login with bcrypt password hashing
- **Data:** localStorage for client state, in-memory sessions server-side

---

## Architecture & Key Components

### Frontend Data Flow (State Management Pattern)

**Contexts** (instead of Redux—minimize boilerplate):
1. **`AuthContext`** (`src/context/AuthContext.jsx`): Manages `user` state & auth tokens. Persists to localStorage.
2. **`QuestionnaireContext`** (`src/context/QuestionnaireContext.jsx`): Tracks user preference answers across stages, syncs with localStorage as `userPreferences`.

**Key Pattern:** 
- Questionnaire answers → stored in `userPreferences` key in localStorage
- On routes like `/planner`, components read from localStorage and pass to backend
- Backend uses `preferences.json` (id→label mappings) + `PREFERENCE_TO_FLOW` logic to determine recommended activity sequence

### Core Pages & Their Responsibilities

| Page | Purpose | Key Behavior |
|------|---------|--------------|
| `LandingPage` | Hero/entry point | No auth required |
| `QuestionnaireStage1/2` | Multi-step preference collection | Updates `QuestionnaireContext`, chains to `QuestionnaireSummary` |
| `QuestionnaireSummary` | Review & confirm preferences | Displays selected answers before `/planner` redirect |
| `Planner` (complex) | Core experience—iterative plan generation | See below |
| `RestaurantList` | Legacy single-shot recommendation display | Uses direct API call (deprecated pattern) |
| `Profile` | User settings (minimal implementation) | Reads from `AuthContext.user` |

### Planner.jsx Architecture (Most Complex)

**Two operating modes:**
1. **Home mode** (`page === "home"`): Shows initial flow diagram based on preferences + location input
2. **Stepper mode** (`page === "step"`): Iterates through each step (restaurant → activity → stay), showing 3 options per step, allowing multi-select chain building

**State Machine:**
```
home → (start session) → step → (select options) → (next step) → summary
```

**Critical functions:**
- `generateInitialFlow()`: Maps user preferences to step sequence (e.g., "Weekend escape" → `["restaurant", "activity", "stay"]`)
- `startSession()`: Creates backend session via `/session/start`, stores `sessionId` in state
- `handleNextStep()`: Sends current selections to `/session/select`, updates UI with next step's options
- `handleSummary()`: Navigates to summary view with full itinerary chain

**Data from backend:**
- `stepOptions[]`: Array of place objects `{name, address, url, type, rating, coords: {lat, lng}, ...}`
- `selectedChain[]`: User's build-up of selections `[{step: "restaurant", place: {...}}, ...]`
- Map integration via `MapPlanner`: Visualizes all step options + selected chain route as polyline

---

## Backend Architecture

### FastAPI Endpoints (main.py)

**Auth Flow:**
- `POST /signup` → creates User record, hashes password with bcrypt
- `POST /login` → validates credentials, returns `{user_id, token}` (basic JWT support)

**Questionnaire & Planning:**
- `POST /preferences` → stores user's questionnaire answers
- `POST /session/start` → creates temporary session, calls `generate_initial_suggestions()`, returns initial 3 restaurant options
- `POST /session/select` → records user's selection via `push_selection()`, generates options for next step
- `POST /session/summary` → retrieves full `selectedChain` from session for final review

**Key middleware:**
- CORS enabled for all origins (development convenience—restrict in production)
- Database dependency injection via `Depends(get_db)`

### Planner Logic (planner.py)

**Core algorithm:**
1. **Normalize preferences** → Convert questionnaire answers (dicts/lists) to standard label format via `PREFERENCE_TO_FLOW` mapping
2. **Determine flow** → Map preference labels to step sequence (e.g., "Fun & Energetic" → `["restaurant", "activity"]`)
3. **Generate suggestions** → For each step, call `scraper.search_places()` (Postgres-cached SerpAPI page), rank via `scoring.rank_places()`
4. **Filter & rank** → `LABEL_TO_PLACE_TYPES` determines which Google Place types to fetch per step

**Key assumption:** Preferences in `preferences.json` define categories (mood, planningStyle, etc.); their selected labels influence both flow & place type selection.

### Data Models

**User** (`models.py`):
```python
User: {id, first_name, last_name, email, phone, username, password_hash}
```

**Session** (`planner_sessions.py`—in-memory, 1-hour TTL):
```python
{
  session_id, user_id, created_at, updated_at,
  payload: {userPrefs, location, coords},
  anchor: {initialState},
  steps: [{step, place, ts}, ...],  # user's selections
  last_options: {restaurant: [...], activity: [...], ...}  # all options shown for each step
}
```

---

## Developer Workflows

### Local Development

**Frontend:**
```powershell
cd meetbuddy2
npm install
npm run dev          # Vite dev server (default: http://localhost:5173)
npm run lint         # ESLint check
npm run build        # Production bundle
```

**Backend:**
```powershell
cd backend
pip install -r requirements.txt
python create_tables.py  # Initialize PostgreSQL schema
python main.py           # Uvicorn server (default: http://localhost:8000)
```

**Database:**
- PostgreSQL connection string in `database.py`: `postgresql://postgres:123456@localhost:5432/meetbuddy`
- Ensure PostgreSQL is running locally; adjust credentials if needed

### Testing Strategy
- No formal test suite currently; manual testing via Postman/Thunder Client for API endpoints
- Frontend validation: ESLint runs on save in most editors

### Debugging Tips
1. **localStorage inspection:** Open DevTools → Application → Local Storage to inspect `user`, `token`, `userPreferences`
2. **Session tracking:** Backend prints session IDs to console; check `planner_sessions.py` for in-memory state
3. **Map issues:** Leaflet requires tile server; if map blank, check network tab for tile layer requests
4. **SerpAPI rate limits:** Check `scraper.py` for API key configuration; logs include search queries

---

## Project Conventions & Patterns

### Frontend Code Style

**React Hooks & Contexts:**
- Prefer functional components with hooks (`useState`, `useContext`)
- No class components in current codebase
- Custom hooks (e.g., `useQuestionnaire`) extracted to `context/` for reusability

**Routing:**
- React Router v7 with simple flat routes (no nested routes currently)
- Auth check via `AuthContext.user` at page level (no route guards yet)

**Component Folder Structure:**
```
src/components/    ← Reusable UI (MapPlanner, Navbar, UI primitives)
src/pages/         ← Full page components (one-to-one with routes)
src/context/       ← Context + custom hooks
src/data/          ← Static data (subQuestionMap.js)
src/assets/        ← Images, SVGs
src/lib/           ← Utils (utils.js for classname helpers)
```

**Styling:**
- TailwindCSS utility classes (no CSS-in-JS)
- Radix UI for accessible base components (Button, Card, Input, Avatar, Badge)
- Custom icons via lucide-react
- Global CSS in `index.css`; component-level via `@apply` or inline Tailwind

**Axios API calls:**
```javascript
// Pattern: inline fetch with error handling in component
const response = await axios.post('http://localhost:8000/session/start', payload);
// No centralized API client yet—consider creating src/api/client.js for consistency
```

### Backend Code Style

**FastAPI patterns:**
- Pydantic `BaseModel` classes for request/response schemas (see `UserCreate`, `UserPreferences` in main.py)
- Dependency injection for database sessions: `Depends(get_db)`
- No formal error handling middleware; relies on FastAPI's built-in HTTP exception handling

**Database:**
- SQLAlchemy ORM with declarative models (`models.py`)
- Queries via ORM methods (`.filter()`, `.first()`, `.query()`)
- No migrations tool (Alembic)—schema created via `Base.metadata.create_all()` in `create_tables.py`

**Session & State:**
- In-memory session storage (`planner_sessions.py`) for temp data during planning flow
- File-based preference storage (`preferences.json`, `user_last_prefs.json`) for config/cache
- No Redis or persistent session store currently

### Environment & Configuration

**Frontend:**
- Base API URL hardcoded to `http://localhost:8000` across components (consider `.env.local` + Vite env vars)
- Path aliases via `jsconfig.json`: `@` → `src/`

**Backend:**
- Database URL hardcoded in `database.py` (use `.env` + `python-dotenv` in production)
- SerpAPI key assumed in `scraper.py` (document setup required)
- Preference mappings from local `preferences.json` & `user_last_prefs.json`

---

## Integration Points & Dependencies

### Frontend ↔ Backend Communication

1. **Auth flow:**
   - POST `/signup` & `/login` → receive `user_id` + `token`
   - Store in localStorage; include `token` in subsequent request headers

2. **Questionnaire → Planning:**
   - Questionnaire saves to localStorage as `userPreferences`
   - Planner page reads from localStorage, sends to backend via `/session/start` payload

3. **Interactive planning (Planner ↔ Backend):**
   - Frontend maintains `sessionId` in state
   - Each user interaction (`/session/select`, etc.) includes `sessionId` for stateful context
   - Backend returns `{stepOptions: [...], nextStep: "activity", ...}`

### External Dependencies

- **SerpAPI** (`scraper.py`): Searches for places by location & type; requires API key
- **Google Places API** (via SerpAPI): Location data, ratings, phone numbers
- **Leaflet/OpenStreetMap** (`MapPlanner.jsx`): Map rendering; free tile layer, no API key needed
- **PostgreSQL**: Must be running locally; credentials in `database.py`

### Known Issues & TODOs

1. **Hardcoded base URLs:** Replace `http://localhost:8000` with environment variables
2. **No authentication tokens in requests:** JWT generation exists but not validated on protected routes
3. **Session persistence:** In-memory sessions lost on backend restart; consider DB-backed sessions
4. **Preference mappings:** `preferences.json` structure undocumented; reverse-engineer from `planner.py` logic
5. **Map highlighting:** Current implementation highlights individual places; doesn't persist selection visual state across steps

---

## Quick Reference: Where to Find Common Patterns

- **State management:** `src/context/AuthContext.jsx`, `QuestionnaireContext.jsx`
- **Preference flow logic:** `backend/planner.py` → `PREFERENCE_TO_FLOW` mapping
- **Map integration:** `src/components/MapPlanner.jsx` → Leaflet setup + custom icons
- **API schemas:** `backend/main.py` → Pydantic models at top of file
- **UI components:** `src/components/ui/` → Radix UI wrappers (Button, Card, Input, etc.)
- **Routing:** `src/App.jsx`
- **Component examples:** `src/pages/Planner.jsx` (complex state), `LandingPage.jsx` (simple)
