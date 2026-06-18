"""
tests/test_models.py
--------------------
Phase 2 exit-condition test.

Run with:
    pytest tests/test_models.py -v

Both tests must PASS before moving to Phase 3.
"""
import pytest
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import session
from app.database.session import AsyncSessionLocal
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
async def test_all_schemas_exist(test_engine):
    """
    All 5 schemas must exist after running:
        alembic upgrade head
    """
    expected = {"master", "transaction", "quality", "audit", "auth"}
    async with test_engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name = ANY(:schemas)"
            ),
            {"schemas": list(expected)},
        )
        found = {row[0] for row in result.fetchall()}
        missing = expected - found
        assert not missing, (
            f"Missing schemas: {missing}. Did you run 'alembic upgrade head'?"
        )


@pytest.mark.asyncio
async def test_all_tables_exist(test_engine):
    """
    Spot-check every important table across all 5 schemas.
    If any table is missing, Alembic missed it — check that
    alembic/env.py imports all 5 model files.
    """
    tables = [
        # auth schema
        ("auth", "organisations"),
        ("auth", "users"),
        ("auth", "project_team"),
        ("auth", "org_invitations"),
        # master schema
        ("master", "projects"),
        ("master", "towers"),
        ("master", "floors"),
        ("master", "components"),
        ("master", "grades"),
        ("master", "grade_thresholds"),
        ("master", "suppliers"),
        ("master", "mix_designs"),
        ("master", "testing_labs"),
        # transaction schema
        ("transaction", "pours"),
        ("transaction", "rmc_dispatches"),
        ("transaction", "truck_dispatches"),
        ("transaction", "pour_dispatch_links"),
        ("transaction", "cube_samples"),
        # quality schema
        ("quality", "cube_tests"),
        ("quality", "ncrs"),
        ("quality", "penalties"),
        ("quality", "corrective_actions"),
        ("quality", "ai_suggestions"),
        # audit schema
        ("audit", "audit_logs"),
        ("audit", "ingestion_logs"),
        ("audit", "embeddings"),
    ]

    async with test_engine.connect() as conn:
        missing = []
        for schema, table in tables:
            result = await conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = :schema AND table_name = :table"
                ),
                {"schema": schema, "table": table},
            )
            count = result.scalar()
            if count != 1:
                missing.append(f"{schema}.{table}")

        assert not missing, (
            f"These tables are missing from the database:\n"
            + "\n".join(f"  - {t}" for t in missing)
        )