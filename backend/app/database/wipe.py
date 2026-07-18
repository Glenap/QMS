"""wipe.py — destructive whole-database reset.

One implementation of "delete every row, then restore the global catalogs",
shared by ``scripts/wipe_db.py`` and ``scripts/seed_demo.py`` (which wipes
before it re-seeds). Both used to carry their own copy of the TRUNCATE
statement and the catalog re-insert.

Nothing in the running app imports this module — it exists for the operational
scripts, and it is deliberately hard to fire by accident (see
``ensure_wipe_allowed``).
"""

import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.config import settings
from app.database.base import Base
from app.database.seed import Executor, seed_catalogs

# Environments in which destroying the whole database is an acceptable thing to
# do. The check is a whitelist, not a "!= production" blacklist: a typo, an
# unset variable or a new environment name must FAIL CLOSED, because the first
# thing these scripts do is drop every row.
SAFE_ENVIRONMENTS = frozenset({"development", "local", "test", "testing"})


def ensure_wipe_allowed(action: str) -> None:
    """Abort unless ENVIRONMENT names a known-safe local environment."""
    env = (settings.ENVIRONMENT or "").strip().lower()
    if env not in SAFE_ENVIRONMENTS:
        safe = ", ".join(sorted(SAFE_ENVIRONMENTS))
        sys.exit(
            f"Refusing to {action}: ENVIRONMENT={settings.ENVIRONMENT!r} is not a "
            f"known-safe local environment ({safe}). Aborting."
        )


def truncate_sql() -> str:
    """TRUNCATE for every mapped table, across all schemas.

    Built at call time, not import time, so every model is registered first.
    CASCADE handles FK ordering; RESTART IDENTITY resets the sequences so a
    re-seed produces stable ids.
    """
    tables = ", ".join(f'"{t.schema}"."{t.name}"' for t in Base.metadata.sorted_tables)
    return f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"


async def wipe_all(executor: Executor, *, reseed: bool = True) -> None:
    """Truncate every table on an existing connection/session, then optionally
    restore the catalogs. The caller owns the transaction and the commit."""
    await executor.execute(text(truncate_sql()))
    if reseed:
        await seed_catalogs(executor)


async def wipe_database(*, reseed: bool = True) -> None:
    """Truncate every table on a throwaway engine of its own, and commit."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.begin() as conn:
            await wipe_all(conn, reseed=reseed)
    finally:
        await engine.dispose()
