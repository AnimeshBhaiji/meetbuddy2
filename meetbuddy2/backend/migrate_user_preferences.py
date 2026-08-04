# One-off migration: user_last_prefs.json -> users.preferences (JSONB).
# create_tables.py uses create_all(), which never alters an existing table, so
# this has to run once by hand:  python migrate_user_preferences.py
# Safe to re-run — every step checks the current state first.
import json
import os

from sqlalchemy import text

from database import engine

PREFS_FILE = os.path.join(os.path.dirname(__file__), "user_last_prefs.json")


def _has_column(conn) -> bool:
    return bool(conn.execute(text(
        "select 1 from information_schema.columns "
        "where table_name = 'users' and column_name = 'preferences'")).first())


def migrate():
    with engine.begin() as conn:
        if not _has_column(conn):
            conn.execute(text(
                "alter table users add column preferences jsonb not null default '{}'::jsonb"))
            print("Added users.preferences.")
        else:
            print("users.preferences already present.")

        # The old file held at most one user (each save overwrote the whole
        # file), so this backfills one row at best — and nothing if that user
        # has since been deleted.
        moved = 0
        if os.path.exists(PREFS_FILE):
            try:
                with open(PREFS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"Could not read {PREFS_FILE}: {e}")
                data = {}

            for uid, prefs in (data or {}).items():
                try:
                    uid_int = int(uid)
                except (TypeError, ValueError):
                    continue
                result = conn.execute(
                    text("update users set preferences = cast(:p as jsonb) "
                         "where id = :i and preferences = '{}'::jsonb"),
                    {"p": json.dumps(prefs), "i": uid_int})
                moved += result.rowcount
            print(f"Backfilled {moved} user(s) from user_last_prefs.json.")
        else:
            print("No user_last_prefs.json to backfill from.")

    if os.path.exists(PREFS_FILE):
        os.remove(PREFS_FILE)
        print("Removed user_last_prefs.json — preferences now live in the database.")
    print("Migration complete.")


if __name__ == "__main__":
    migrate()
