# One-off migration: itineraries.planned_date (Date) -> start_at/end_at/all_day.
# create_tables.py uses create_all(), which never alters an existing table, so
# this has to run once by hand:  python migrate_itinerary_times.py
# Safe to re-run — every step checks the current column layout first.
from sqlalchemy import text

from database import engine


def _columns(conn):
    rows = conn.execute(text(
        "select column_name from information_schema.columns "
        "where table_name = 'itineraries'"))
    return {r[0] for r in rows}


def migrate():
    with engine.begin() as conn:
        cols = _columns(conn)
        if "itineraries" not in {r[0] for r in conn.execute(text(
                "select table_name from information_schema.tables "
                "where table_schema = 'public'"))}:
            print("No itineraries table yet — run create_tables.py first.")
            return

        if "start_at" in cols and "planned_date" not in cols:
            print("Already migrated.")
            return

        if "start_at" not in cols:
            conn.execute(text(
                "alter table itineraries "
                "add column start_at timestamptz, "
                "add column end_at timestamptz, "
                "add column all_day boolean not null default false"))
            print("Added start_at / end_at / all_day.")

        if "planned_date" in cols:
            # Existing rows only ever had a date, so they become all-day plans
            # spanning that whole day.
            moved = conn.execute(text(
                "update itineraries "
                "set start_at = planned_date::timestamptz, "
                "    end_at = planned_date::timestamptz + interval '1 day', "
                "    all_day = true "
                "where planned_date is not null and start_at is null")).rowcount
            print(f"Backfilled {moved} dated row(s) as all-day plans.")

            conn.execute(text("alter table itineraries drop column planned_date"))
            print("Dropped planned_date.")

        conn.execute(text(
            "create index if not exists ix_itineraries_start_at "
            "on itineraries (start_at)"))
    print("Migration complete.")


if __name__ == "__main__":
    migrate()
