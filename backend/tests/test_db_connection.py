"""
Phase 1 exit-condition test.

This test must pass before you proceed to Phase 2.
It verifies:
  1. The DATABASE_URL in .env is correct and reachable
  2. The async engine + asyncpg driver are wired correctly
  3. asyncio + pytest-asyncio are configured properly

Run with:
    pytest tests/test_db_connection.py -v
"""
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from app.config import settings 


@pytest.fixture
async def test_engine():
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool, 
        echo=False
    )
    yield engine
    await engine.dispose()

@pytest.mark.asyncio
async def test_database_connection(test_engine):
    """
    Sends SELECT 1 to the database.
    If this passes, the full async stack is working:
      .env → config.py → engine.py → asyncpg → PostgreSQL
    """
    async with test_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        row = result.scalar()
        assert row == 1, f"Expected 1, got {row}"


@pytest.mark.asyncio
async def test_schemas_exist(test_engine):
    """
    Verifies all four schemas are present after running:
        alembic upgrade head

    Run this test AFTER your first alembic upgrade, not before.
    The schemas are created automatically by alembic/env.py.
    """
    expected_schemas = {"master", "transaction", "quality", "audit"}
    async with test_engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name = ANY(:schemas)"
            ),
            {"schemas": list(expected_schemas)},
        )
        found = {row[0] for row in result.fetchall()}
        missing = expected_schemas - found
        assert not missing, f"Missing schemas: {missing}. Did you run 'alembic upgrade head'?"
