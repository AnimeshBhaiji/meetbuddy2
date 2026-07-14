# MeetBuddy

**Great meetups, planned in minutes.** MeetBuddy turns a two-minute questionnaire about your group's vibe into a full, mapped itinerary — restaurant → activity → stay — built from real venues near you.

![Stack](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-61dafb) ![Stack](https://img.shields.io/badge/backend-FastAPI-009688) ![Stack](https://img.shields.io/badge/db-PostgreSQL-336791)

---

## How it works

1. **Sign up** and take the questionnaire: mood, planning style, adventure level, add-ons, and what makes the night memorable — each answer has follow-up sub-questions (cuisine, seating, filters, priorities…).
2. **Every answer changes the search.** The backend converts your questionnaire into *search directives*: query flavor terms ("rooftop restaurants", "Italian", "DJ nights"), a search radius (2.5 km in the city up to 50 km for a long drive), scoring priorities (food quality / budget / distance / ambience), and an avoid-list.
3. **Your planning style picks the experience:**

   | You chose | You get |
   |---|---|
   | **Surprise me** | The whole itinerary is auto-built and you land straight on the summary. Every stop has a **Swap** button — swapping re-anchors and refreshes the stops after it. |
   | **Semi-custom** | Guided step-by-step selection. If you asked for a shortlist, you see the top 5 with a ⭐ *MeetBuddy's pick* badge (with a "show all" escape hatch). |
   | **Full control** | Working filter chips (price, live music, …), Best match / Top rated / Nearest sorting, a **Skip step** button, and an editor to add / remove / reorder upcoming steps. |

4. **Venues are real**, fetched live from Google Maps via SerpAPI, geocoded with Nominatim, plotted on a dark Leaflet map, and scored by rating, distance, and how well they match your answers.
5. **The summary is honest.** Services we can't automate yet (ride booking, gift delivery, table reservations) appear as "Don't forget" notes on the itinerary instead of fake buttons.

## Architecture

```
meetbuddy2/                  React 19 + Vite frontend
├── src/pages/               One file per route (Landing, Auth, Questionnaire ×3,
│                            Home, Planner, Calendar, Profile, About)
├── src/components/          Navbar, MapPlanner (Leaflet), AmbientBackground,
│                            ui/ primitives (GlassCard, GlowButton, Field, shadcn-style)
├── src/context/             AuthContext, QuestionnaireContext
├── src/lib/motion.js        Shared animation tokens (one easing curve, 3 durations)
└── backend/                 FastAPI
    ├── main.py              All HTTP endpoints (auth, preferences, planner sessions)
    ├── planner.py           Orchestration: one cached search per step + fallback
    ├── directives.py        Questionnaire → search directives (queries, radius, priorities)
    ├── scoring.py           Local ranking: rating, distance, mood/atmosphere analysis
    ├── place_analyzer.py    Mood-fit / atmosphere / parking detection from reviews
    ├── scraper.py           SerpAPI Google Maps fetch + parsing
    ├── cache.py             Postgres-backed cache (searches 7 days, geocodes 90 days)
    ├── geo.py               Distance math + cached Nominatim geocoding
    ├── planner_sessions.py  In-memory sessions (best-effort disk backup)
    ├── database.py          PostgreSQL connection (SQLAlchemy)
    ├── models.py            User + api_cache tables
    └── create_tables.py     Schema creation script (no migrations — re-run after changes)
```

**Planner session flow:** `POST /planner/session` creates a session and returns first-step options + the plan mode → the frontend either auto-plans (surprise) or walks the steps, calling `POST /planner/session/{id}/select` per pick (and `/skip` in full control) → each selection anchors the next search geographically → the summary maps the chain.

**Design system:** single dark glassmorphism theme — oklch color tokens, Space Grotesk / Inter, glass + glow utilities in `src/index.css`, framer-motion on shared motion tokens, `prefers-reduced-motion` respected. All animation is transform/opacity only; the ambient "aurora" background is pure CSS.

## First-time setup

### Prerequisites

- **Node.js 18+**
- **Python 3.10+**
- **PostgreSQL** (any recent version), running locally
- A **SerpAPI key** — free tier works: <https://serpapi.com/manage-api-key> (real keys are 64-char hex)

### 1. Install dependencies

```bash
# Frontend
cd meetbuddy2
npm install

# Backend
cd backend
pip install -r requirements.txt
```

### 2. Database

Create a PostgreSQL database named `meetbuddy`. The connection string is **hardcoded** in `backend/database.py`:

```
postgresql://postgres:123456@localhost:5432/meetbuddy
```

If your credentials differ, edit that file directly (there is no DB env var yet).

### 3. Environment file

Create `backend/.env`:

```
SERPAPI_KEY=<your_serpapi_key>
```

Without this, venue search fails — the planner will show a "Venue search failed" banner. **Never commit this file** (it's gitignored).

### 4. Create the schema

```bash
cd backend
python create_tables.py
```

There is no migration tool — re-run this after any change to `models.py`.

## Running the app

Two terminals:

```bash
# Terminal 1 — frontend (http://localhost:5173)
cd meetbuddy2
npm run dev

# Terminal 2 — backend (http://localhost:8000)
cd meetbuddy2/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

> **Note:** `python main.py` does *not* start the server — `main.py` has no `__main__` block. Use the uvicorn command above.

Verify the full stack: sign up at <http://localhost:5173>, complete the questionnaire, and generate an itinerary. Searches hit SerpAPI once per planner step (~1 credit each) and are cached in PostgreSQL for 7 days — repeat searches in the same area cost zero credits and return in ~2 s.

Other useful commands:

```bash
npm run lint     # ESLint
npm run build    # production bundle (output in dist/)
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Backend crashes on startup with a connection error | PostgreSQL not running, or credentials don't match `database.py` |
| "Venue search failed: … 401 Invalid API key" | Bad `SERPAPI_KEY`. Real keys are 64-char hex. The `.env` is read **only at startup** — restart the backend after changing it. |
| Planner shows no options | SerpAPI quota exhausted, or the location genuinely has no matches within the radius your questionnaire answers set |
| Blank map | Leaflet tile requests blocked — check the browser Network tab |
| Plan lost mid-session | Backend restarted; planner sessions are in-memory (a tracked limitation) |
| `UnicodeEncodeError` in backend logs on Windows | Don't add emoji to backend `print()` calls — Windows consoles use cp1252 |

## Known limitations (tracked, intentional for now)

- **JWT tokens are issued but not validated** on protected routes
- **CORS allows all origins** — for local development
- **Planner sessions are in-memory** — lost on backend restart
- **Frontend hardcodes** `http://localhost:8000` as the API base (ngrok mode uses a Vite proxy)

## Contributing

- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, optional scope: `feat(planner):`)
- React: functional components + hooks only; styling via TailwindCSS utilities only
- Path alias: `@` → `src/`
- Work on a branch and open a PR — don't push to `main` directly
