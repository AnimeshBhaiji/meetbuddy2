# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Layout

All source code lives in the `meetbuddy2/` subdirectory — the git root contains only that folder. The full architecture is documented in `meetbuddy2/.github/copilot-instructions.md`.

```
meetbuddy2/           ← React frontend (Vite + TailwindCSS 4 + Radix UI + Leaflet)
meetbuddy2/backend/   ← FastAPI backend (PostgreSQL + SQLAlchemy)
```

## Dev Commands

Run these from the repository root (`meetbuddy2/` in the git root refers to the *project* folder, not the root itself):

**Frontend** (Terminal 1):
```
cd meetbuddy2
npm run dev       # Vite dev server → http://localhost:5173
npm run lint      # ESLint check
npm run build     # Production bundle
```

**Backend** (Terminal 2):
```
cd meetbuddy2/backend
python main.py    # Uvicorn → http://localhost:8000
```

**First-time / schema setup:**
```
cd meetbuddy2/backend
pip install -r requirements.txt
python create_tables.py   # Creates PostgreSQL tables (no Alembic — run again after schema changes)
```

## Environment & Database

- `meetbuddy2/backend/.env` must contain `SERPAPI_KEY=<key>` for place discovery
- PostgreSQL connection is **hardcoded** in `meetbuddy2/backend/database.py`: `postgresql://postgres:123456@localhost:5432/meetbuddy` — update the file directly if credentials differ
- No migration tool; all schema changes go in `create_tables.py` and require a re-run

## Known TODOs — Do Not "Fix" Without Explicit Request

- **JWT not validated on protected routes** — tokens are generated but backend skips verification; this is a tracked TODO, not a bug
- **CORS allows all origins** — intentional for local development; do not restrict
- **In-memory sessions** — `planner_sessions.py` data is lost on backend restart; `planner_sessions_data/` disk backup is best-effort
- **Hardcoded API base URL** — frontend components hardcode `http://localhost:8000`; ngrok mode uses a Vite proxy instead

## Commit Convention

Use **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`. Optional scope in parentheses: `feat(planner):`, `fix(auth):`.

## Code Style

- React: functional components + hooks only; no class components
- Styling: TailwindCSS utility classes only; no CSS-in-JS
- Path alias: `@` → `src/` (jsconfig.json)
- Axios API calls are inline per-component; no centralized API client yet
