"""
Schema coverage — verifies the SQLAlchemy models produce every expected schema
and table. Runs hermetically against the test database that conftest builds with
`Base.metadata.create_all` (no dependency on the live dev DB or manual Alembic).
"""

from sqlalchemy import text

EXPECTED_SCHEMAS = {"auth", "master", "transaction", "quality", "audit"}

EXPECTED_TABLES = [
    # auth
    ("auth", "organisations"),
    ("auth", "users"),
    ("auth", "project_team"),
    ("auth", "org_invitations"),
    ("auth", "token_blacklist"),
    # master
    ("master", "projects"),
    ("master", "towers"),
    ("master", "floors"),
    ("master", "components"),
    ("master", "grades"),
    ("master", "grade_thresholds"),
    ("master", "suppliers"),
    ("master", "mix_designs"),
    ("master", "testing_labs"),
    # transaction
    ("transaction", "pours"),
    ("transaction", "rmc_dispatches"),
    ("transaction", "truck_dispatches"),
    ("transaction", "pour_dispatch_links"),
    ("transaction", "cube_samples"),
    # quality
    ("quality", "cube_tests"),
    ("quality", "ncrs"),
    ("quality", "penalties"),
    ("quality", "corrective_actions"),
    ("quality", "ai_suggestions"),
    ("quality", "alerts"),
    # audit
    ("audit", "ingestion_logs"),
    ("audit", "embeddings"),
]


async def test_all_schemas_exist(db_session):
    result = await db_session.execute(
        text(
            "SELECT schema_name FROM information_schema.schemata "
            "WHERE schema_name = ANY(:schemas)"
        ),
        {"schemas": list(EXPECTED_SCHEMAS)},
    )
    found = {row[0] for row in result.fetchall()}
    assert not (EXPECTED_SCHEMAS - found), f"Missing schemas: {EXPECTED_SCHEMAS - found}"


async def test_all_tables_exist(db_session):
    missing = []
    for schema, table in EXPECTED_TABLES:
        count = (
            await db_session.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = :schema AND table_name = :table"
                ),
                {"schema": schema, "table": table},
            )
        ).scalar()
        if count != 1:
            missing.append(f"{schema}.{table}")
    assert not missing, "Missing tables: " + ", ".join(missing)
