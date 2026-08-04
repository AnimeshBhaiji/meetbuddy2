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
python -m uvicorn main:app --port 8000   # → http://localhost:8000
```
(`python main.py` exits silently — the file has no `__main__` block.)

**First-time / schema setup:**
```
cd meetbuddy2/backend
pip install -r requirements.txt
python create_tables.py   # Creates PostgreSQL tables (no Alembic — run again after schema changes)
```

## Environment & Database

- `meetbuddy2/backend/.env` must contain:
  - `JWT_SECRET=<random string>` — the backend will not start without it. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`
  - `SERPAPI_KEY=<key>` for place discovery
- PostgreSQL connection is **hardcoded** in `meetbuddy2/backend/database.py`: `postgresql://postgres:123456@localhost:5432/meetbuddy` — update the file directly if credentials differ
- No migration tool. `create_tables.py` uses `create_all()`, which only creates missing tables — it never alters an existing one, so a column change needs a hand-written script. Existing ones, all re-runnable: `backend/migrate_itinerary_times.py`, `backend/migrate_user_preferences.py`
- Backend tests need `pytest` and `httpx` (`pip install pytest httpx`); they are not in `requirements.txt`, which is the runtime list

## Authentication

Every route except `POST /login` and `POST /signup` requires a bearer token.

- Login and signup return a JWT (HS256, 7-day expiry). `src/lib/api.js` attaches it to every request and, on a 401, clears the session and redirects to `/login`.
- **Identity comes from the token only.** Routes never read a `user_id` from a body or query string — a client can set that to any number. Take the account from `Depends(get_current_user)` and scope queries to `user.id`.
- The account's own routes are `/user/me`, not `/user/{id}`, so there is no id to swap.
- `backend/auth.py` refuses to start without `JWT_SECRET`; a default secret would let anyone mint tokens.

## Planner sessions

`planner_sessions.py` stores sessions in the `planner_sessions` table, so they survive a backend restart. They expire 24 hours after the last activity, and creating a session sweeps expired rows (no scheduled job).

- Every function takes the request's `db` session, so a session write shares the route's transaction.
- `get_session` returns a **snapshot, not the live row.** Mutating it does nothing — persist through `update_session`/`push_selection`/`set_last_options`.
- JSONB columns need reassignment, not in-place mutation: `row.steps.append(x)` never reaches the database, `row.steps = [*row.steps, x]` does.

## User preferences

Questionnaire answers live in `users.preferences` (JSONB), written by `POST /save_preferences` and read by `GET /user_prefs/me`, both scoped to the token holder. They are deleted with the account, since the column is part of the row.

They were previously `user_last_prefs.json`, a single-slot file rewritten as `{user_id: prefs}` on every save — so one account saving erased everyone else's. Don't reintroduce a shared file for per-user state.

## Known TODOs — Do Not "Fix" Without Explicit Request

- **CORS allows all origins** — intentional for local development; do not restrict. Safe here because auth uses an `Authorization` header, not cookies.

## Commit Convention

Use **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`. Optional scope in parentheses: `feat(planner):`, `fix(auth):`.

## Code Style

- React: functional components + hooks only; no class components
- Styling: TailwindCSS utility classes only; no CSS-in-JS
- Path alias: `@` → `src/` (jsconfig.json)
- Axios API calls are inline per-component; no centralized API client yet
