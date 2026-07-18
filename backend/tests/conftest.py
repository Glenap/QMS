"""
Pytest configuration and shared fixtures.

Integration tests run against a dedicated PostgreSQL database
(`construction_test_db`) on the same server configured in .env. The schema is
created from the SQLAlchemy models (fast, no Alembic) and the reference catalogs
(grades/components) are seeded **once** for the whole session.

Isolation is by transaction rollback, not per-test TRUNCATE: each test runs
inside a single connection-level transaction that is rolled back when the test
ends. The HTTP client and the direct-assertion session share that one
connection (joining the transaction via SAVEPOINTs), so what a request commits
is visible to direct queries within the same test and discarded afterwards. This
is dramatically faster than rebuilding an engine and truncating every table per
test. (Sequence values are not rolled back, so auto-increment ids drift across
tests — fine, since nothing relies on ids resetting to 1.)

Outbound email is patched out so tests never hit a real SMTP server.
"""

import asyncio

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401  — registers every table on Base.metadata
from app.config import settings
from app.core.security import pwd_context
from app.database.base import Base
from app.database.seed import seed_catalogs
from app.database.session import get_db
from app.main import app

# Speed up the suite: bcrypt at its production 12-round cost dominates the
# auth-heavy flows (register / verify-otp / accept-invitation each hash a
# password). Tests still exercise the *real* bcrypt scheme — just at its minimum
# cost factor (~256x faster) — so hashing/verification behaviour is unchanged.
pwd_context.update(bcrypt__rounds=4)

# ── Test database URLs ──────────────────────────────────────────────────────
TEST_DB_NAME = "construction_test_db"
_BASE_URL, _ = settings.DATABASE_URL.rsplit("/", 1)
TEST_DATABASE_URL = f"{_BASE_URL}/{TEST_DB_NAME}"
# Raw libpq DSN (drop the SQLAlchemy "+asyncpg" marker) for server-level ops.
_ADMIN_DSN = f"{_BASE_URL.replace('+asyncpg', '')}/postgres"

SCHEMAS = ("auth", "master", "transaction", "quality", "audit")


async def _terminate_stale_connections(admin: asyncpg.Connection) -> None:
    """Kill any leftover connections to the test database.

    A pytest run interrupted mid-request (Ctrl-C, a killed process, or a CI/tool
    timeout) leaves its connection ``idle in transaction``, still holding table
    locks. The next run's ``DROP SCHEMA`` then blocks on those locks
    indefinitely — the suite appears to "hang for 30 minutes". Forcibly
    terminating any straggler before we touch the schema makes bootstrap
    self-healing instead."""
    await admin.execute(
        """
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
        """,
        TEST_DB_NAME,
    )


async def _bootstrap_database() -> None:
    # 1. Create the test database if it does not exist, and clear any stale
    #    connections left behind by a previously-interrupted run.
    admin = await asyncpg.connect(_ADMIN_DSN)
    try:
        exists = await admin.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB_NAME
        )
        if not exists:
            await admin.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
        else:
            await _terminate_stale_connections(admin)
        # Belt-and-braces: auto-abort any connection that sits idle in a
        # transaction (so a future interrupted run self-clears even before the
        # next bootstrap runs, rather than wedging the database).
        await admin.execute(
            f'ALTER DATABASE "{TEST_DB_NAME}" '
            "SET idle_in_transaction_session_timeout = '60s'"
        )
    finally:
        await admin.close()

    # 2. Rebuild a clean schema from the models and seed the global reference
    #    catalogs once. These are committed, so they survive every test's
    #    per-transaction rollback (the live DB gets them via an Alembic
    #    migration).
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        for schema in SCHEMAS:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        for schema in SCHEMAS:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        await conn.run_sync(Base.metadata.create_all)
        await seed_catalogs(conn)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _database():
    """Create the test database + schema + seed catalogs once per session."""
    asyncio.run(_bootstrap_database())
    yield


@pytest_asyncio.fixture
async def connection(_database):
    """One connection wrapped in a transaction per test, rolled back at the end.

    The reference catalogs were committed during bootstrap, so they stay visible;
    everything the test writes lives in this transaction and is discarded — total
    isolation with no per-test TRUNCATE."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    conn = await engine.connect()
    trans = await conn.begin()
    try:
        yield conn
    finally:
        await trans.rollback()
        await conn.close()
        await engine.dispose()


def _join_session(connection) -> AsyncSession:
    """A session bound to the test's connection that joins its transaction via a
    SAVEPOINT, so a ``commit()`` inside the app code releases the savepoint
    instead of ending the outer transaction (which ``connection`` rolls back)."""
    return AsyncSession(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )


@pytest_asyncio.fixture
async def db_session(connection) -> AsyncSession:
    """A session for tests to assert directly against the database — shares the
    test's connection, so it sees what the HTTP client has committed."""
    async with _join_session(connection) as session:
        yield session


@pytest_asyncio.fixture
async def client(connection, monkeypatch) -> AsyncClient:
    """HTTP client bound to the app, wired to the test's connection with email
    stubbed. Each request gets its own session (mirroring production) on the
    shared connection/transaction."""
    from tests import mailbox

    mailbox.reset()

    async def _no_email(*args, **kwargs):
        return None

    async def _capture_otp(email, code, full_name=None):
        mailbox.OTP_CODES[email] = code

    monkeypatch.setattr(
        "app.services.auth_service.send_invitation_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.auth_service.send_otp_email", _capture_otp
    )
    monkeypatch.setattr(
        "app.services.supplier_service.send_supplier_confirmation_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.lab_service.send_lab_confirmation_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.dispatch_service.send_truck_dispatch_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.dispatch_service.send_truck_result_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.cube_service.send_lab_report_request_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.mixdesign_service.send_mix_design_request_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.supplier_service.send_rmc_issue_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.ncr_service.send_ncr_report_email", _no_email
    )
    monkeypatch.setattr(
        "app.services.membership_service.send_project_assignment_email", _no_email
    )

    async def _override_get_db():
        # Mirror production get_db: commit on success, rollback on error. Here
        # "commit" only releases this request's SAVEPOINT within the test's
        # outer transaction.
        async with _join_session(connection) as session:
            session.autoflush = False
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)
