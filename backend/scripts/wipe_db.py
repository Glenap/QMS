"""wipe_db.py — delete ALL data from the live database.

Truncates every table (RESTART IDENTITY CASCADE) across all schemas, then
re-seeds the global reference catalogs (grades, components) so the app keeps
working — those are seed data, not user data.

Usage (from the backend/ directory):
    uv run python scripts/wipe_db.py --yes          # wipe + re-seed catalogs
    uv run python scripts/wipe_db.py --yes --no-seed  # wipe everything, no re-seed

Safety: refuses to run without --yes, and refuses entirely when
ENVIRONMENT=production.
"""

import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.config import settings
from app.database.base import Base
from app.database.seed import COMPONENTS, GRADES
from app.models.master import Component, Grade

# All tables across every schema; CASCADE handles FK ordering.
_TABLES = ", ".join(
    f'"{t.schema}"."{t.name}"' for t in Base.metadata.sorted_tables
)
_TRUNCATE_SQL = f"TRUNCATE TABLE {_TABLES} RESTART IDENTITY CASCADE"


async def wipe(*, reseed: bool) -> None:
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text(_TRUNCATE_SQL))
        if reseed:
            await conn.execute(Grade.__table__.insert(), GRADES)
            await conn.execute(Component.__table__.insert(), COMPONENTS)
    await engine.dispose()


def main() -> None:
    db_name = settings.DATABASE_URL.rsplit("/", 1)[-1]

    if settings.is_production:
        print("Refusing to wipe a PRODUCTION database. Aborting.")
        sys.exit(1)

    args = set(sys.argv[1:])
    if "--yes" not in args:
        print(f"This will DELETE ALL DATA in database '{db_name}'.")
        print("Re-run to confirm:  uv run python scripts/wipe_db.py --yes")
        sys.exit(1)

    reseed = "--no-seed" not in args
    asyncio.run(wipe(reseed=reseed))
    print(
        f"Wiped all data in '{db_name}'."
        + (" Re-seeded grade + component catalogs." if reseed else "")
    )


if __name__ == "__main__":
    main()
