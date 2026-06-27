---
name: dev-setup
description: Step-by-step guide for setting up the MeetBuddy dev environment from scratch — prerequisites, database, .env, schema, and starting both servers.
---

Walk the user through MeetBuddy's first-time local setup:

1. **Prerequisites:** Confirm PostgreSQL is running, Python 3.10+ and Node.js 18+ are available.

2. **Frontend dependencies:**
   ```
   cd meetbuddy2
   npm install
   ```

3. **Backend dependencies:**
   ```
   cd meetbuddy2/backend
   pip install -r requirements.txt
   ```

4. **Database:** Ensure a PostgreSQL database named `meetbuddy` exists with user `postgres` / password `123456`. If credentials differ, update `meetbuddy2/backend/database.py` directly (no .env for the DB URL yet).

5. **Environment file:** Create `meetbuddy2/backend/.env`:
   ```
   SERPAPI_KEY=<your_serpapi_key>
   ```
   Without this, the planner's place-discovery step will fail.

6. **Create schema:**
   ```
   cd meetbuddy2/backend
   python create_tables.py
   ```
   Re-run this any time models change (no Alembic).

7. **Start frontend** (Terminal 1):
   ```
   cd meetbuddy2
   npm run dev
   ```
   Open http://localhost:5173

8. **Start backend** (Terminal 2):
   ```
   cd meetbuddy2/backend
   python main.py
   ```
   Listens on http://localhost:8000

9. **Verify:** Sign up at http://localhost:5173, complete the questionnaire, and confirm the planner loads options — this exercises the full stack including SerpAPI.

**Common issues:**
- PostgreSQL connection error → DB name/credentials mismatch in `database.py`
- Planner shows no results → check `SERPAPI_KEY` in `.env` and SerpAPI quota
- Blank map → Leaflet tile requests failing; check the Network tab for tile layer errors
- Session lost mid-planning → backend restarted; sessions are in-memory only
