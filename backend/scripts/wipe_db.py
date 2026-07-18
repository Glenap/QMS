"""wipe_db.py — delete ALL data from the live database.

Truncates every table (RESTART IDENTITY CASCADE) across all schemas, then
re-seeds the global reference catalogs (grades, components) so the app keeps
working — those are seed data, not user data.

Usage (from the backend/ directory):
    uv run python scripts/wipe_db.py --yes          # wipe + re-seed catalogs
    uv run python scripts/wipe_db.py --yes --no-seed  # wipe everything, no re-seed

Safety: refuses to run without --yes, and refuses unless ENVIRONMENT names a
known-safe local environment. The wipe itself lives in app/database/wipe.py,
shared with scripts/seed_demo.py.
"""

import asyncio
import sys

from app.config import settings
from app.database.wipe import ensure_wipe_allowed, wipe_database


def main() -> None:
    db_name = settings.DATABASE_URL.rsplit("/", 1)[-1]

    ensure_wipe_allowed("wipe the database")

    args = set(sys.argv[1:])
    if "--yes" not in args:
        print(f"This will DELETE ALL DATA in database '{db_name}'.")
        print("Re-run to confirm:  uv run python scripts/wipe_db.py --yes")
        sys.exit(1)

    reseed = "--no-seed" not in args
    asyncio.run(wipe_database(reseed=reseed))
    print(
        f"Wiped all data in '{db_name}'."
        + (" Re-seeded grade + component catalogs." if reseed else "")
    )


if __name__ == "__main__":
    main()
