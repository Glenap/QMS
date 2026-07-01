"""IS-456/10262 quality alerts

Adds quality.alerts: a strength alert for the QE + PM (individual failure, group
moving-average drift, or downward trend) feeding the alert bell/feed.

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-07-01 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    level = sa.Enum("INFO", "WARNING", "CRITICAL", name="alertlevel", schema="quality")
    status = sa.Enum("OPEN", "ACKNOWLEDGED", name="alertstatus", schema="quality")

    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("level", level, nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("sample_id", sa.BigInteger(), nullable=True),
        sa.Column("pour_id", sa.BigInteger(), nullable=True),
        sa.Column("supplier_id", sa.BigInteger(), nullable=True),
        sa.Column("status", status, nullable=False),
        sa.Column("acknowledged_by", sa.BigInteger(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["master.projects.project_id"]),
        sa.ForeignKeyConstraint(["sample_id"], ["transaction.cube_samples.sample_id"]),
        sa.ForeignKeyConstraint(["pour_id"], ["transaction.pours.pour_id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["master.suppliers.supplier_id"]),
        sa.ForeignKeyConstraint(["acknowledged_by"], ["auth.users.user_id"]),
        sa.PrimaryKeyConstraint("alert_id"),
        schema="quality",
    )
    op.create_index(
        "idx_alerts_project_status", "alerts", ["project_id", "status"], schema="quality"
    )


def downgrade() -> None:
    op.drop_table("alerts", schema="quality")
    op.execute("DROP TYPE IF EXISTS quality.alertstatus")
    op.execute("DROP TYPE IF EXISTS quality.alertlevel")
