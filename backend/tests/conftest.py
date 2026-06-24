"""
Pytest configuration and shared fixtures.

Integration tests run against a dedicated PostgreSQL database
(`construction_test_db`) on the same server configured in .env. The schema is
created from the SQLAlchemy models (fast, no Alembic) and each test runs against
a freshly-truncated, isolated database.

Outbound email (register-contractor / invite) is patched out so tests never
hit a real SMTP server.
"""

import asyncio

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401  — registers every table on Base.metadata
from app.config import settings
from app.database.base import Base
from app.database.seed import COMPONENTS, GRADES
from app.database.session import get_db
from app.main import app
from app.models.master import Component, Grade

# ── Test database URLs ──────────────────────────────────────────────────────
TEST_DB_NAME = "construction_test_db"
_BASE_URL, _ = settings.DATABASE_URL.rsplit("/", 1)
TEST_DATABASE_URL = f"{_BASE_URL}/{TEST_DB_NAME}"
# Raw libpq DSN (drop the SQLAlchemy "+asyncpg" marker) for server-level ops.
_ADMIN_DSN = f"{_BASE_URL.replace('+asyncpg', '')}/postgres"

SCHEMAS = ("auth", "master", "transaction", "quality", "audit")

# TRUNCATE every model table in one statement; CASCADE handles FK order.
_TRUNCATE_SQL = "TRUNCATE TABLE {} RESTART IDENTITY CASCADE".format(
    ", ".join(f'"{t.schema}"."{t.name}"' for t in Base.metadata.sorted_tables)
)


async def _bootstrap_database() -> None:
    # 1. Create the test database if it does not exist.
    admin = await asyncpg.connect(_ADMIN_DSN)
    try:
        exists = await admin.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB_NAME
        )
        if not exists:
            await admin.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    finally:
        await admin.close()

    # 2. Rebuild a clean schema from the models.
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        for schema in SCHEMAS:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        for schema in SCHEMAS:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _database():
    """Create the test database + schema once for the whole session."""
    asyncio.run(_bootstrap_database())
    yield


@pytest_asyncio.fixture
async def engine(_database):
    """Per-test async engine; truncates all tables then re-seeds the global
    reference catalogs (grades/components) so each test starts clean but with
    the catalogs present (the live DB gets them via an Alembic migration)."""
    eng = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.execute(text(_TRUNCATE_SQL))
        await conn.execute(Grade.__table__.insert(), GRADES)
        await conn.execute(Component.__table__.insert(), COMPONENTS)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncSession:
    """A session for tests to assert directly against the database."""
    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def client(engine, monkeypatch) -> AsyncClient:
    """HTTP client bound to the app, wired to the test DB with email stubbed."""
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

    TestSession = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )

    async def _override_get_db():
        # Mirror production get_db: commit on success, rollback on error.
        async with TestSession() as session:
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
