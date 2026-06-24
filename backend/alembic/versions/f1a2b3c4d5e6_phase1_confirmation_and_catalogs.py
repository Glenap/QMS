"""phase 1: supplier/lab confirmation handshake + seed grade & component catalogs

Revision ID: f1a2b3c4d5e6
Revises: e1c2d3e4f5a6
Create Date: 2026-06-23 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

from app.database.seed import COMPONENTS, GRADES

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_confirmation_columns(table: str) -> None:
    op.add_column(
        table,
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        schema="master",
    )
    op.add_column(
        table,
        sa.Column("confirmation_token", sa.String(length=100), nullable=True),
        schema="master",
    )
    op.add_column(
        table,
        sa.Column("confirmation_sent_at", sa.DateTime(timezone=True), nullable=True),
        schema="master",
    )
    op.add_column(
        table,
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        schema="master",
    )
    op.create_unique_constraint(
        f"uq_{table}_confirmation_token", table, ["confirmation_token"], schema="master"
    )


def upgrade() -> None:
    # 1. Confirmation handshake columns on suppliers + testing_labs.
    _add_confirmation_columns("suppliers")
    _add_confirmation_columns("testing_labs")

    # 2. Seed the global grade + component catalogs (idempotent-ish: only run on
    #    a fresh upgrade; re-running would duplicate, so guard on emptiness).
    # Reference the existing PG enum types (create_type=False — already created
    # by the earlier schema migration) so the inserts cast correctly under
    # asyncpg instead of sending bare VARCHAR.
    grade_type_enum = ENUM(
        "NORMAL", "FREE_FLOW", name="gradetype", schema="master", create_type=False
    )
    component_type_enum = ENUM(
        "COLUMN", "SLAB", "BEAM", "RAFT", "SHEAR_WALL", "STAIRCASE",
        "LIFT_CORE", "FOUNDATION",
        name="componenttype", schema="master", create_type=False,
    )

    grades_tbl = sa.table(
        "grades",
        sa.column("grade_name", sa.String),
        sa.column("grade_type", grade_type_enum),
        sa.column("min_strength_mpa", sa.Numeric),
        sa.column("grade_variant", sa.String),
        schema="master",
    )
    components_tbl = sa.table(
        "components",
        sa.column("component_type", component_type_enum),
        sa.column("description", sa.Text),
        schema="master",
    )

    bind = op.get_bind()
    if bind.execute(sa.text('SELECT COUNT(*) FROM master.grades')).scalar() == 0:
        op.bulk_insert(grades_tbl, GRADES)
    if bind.execute(sa.text('SELECT COUNT(*) FROM master.components')).scalar() == 0:
        op.bulk_insert(components_tbl, COMPONENTS)


def downgrade() -> None:
    op.execute("DELETE FROM master.components")
    op.execute("DELETE FROM master.grades")

    for table in ("testing_labs", "suppliers"):
        op.drop_constraint(
            f"uq_{table}_confirmation_token", table, schema="master", type_="unique"
        )
        op.drop_column(table, "confirmed_at", schema="master")
        op.drop_column(table, "confirmation_sent_at", schema="master")
        op.drop_column(table, "confirmation_token", schema="master")
        op.drop_column(table, "status", schema="master")
