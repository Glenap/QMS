"""mix design RMC ownership (Phase 4A)

- master.mixapprovalstatus += PENDING (RMC-submitted, awaiting QE review)
- master.mix_designs += the detailed RMC submission fields + QE review fields
- master.suppliers += mix_submission_token / mix_submission_sent_at (the separate
  per-supplier mix-design submission link)
- new master.supplier_required_grades (grades the contractor wants this RMC to
  submit a mix design for)

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-06-30 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_MIX_COLUMNS = [
    ("mix_design_ref", sa.String(length=50)),
    ("mix_type", sa.String(length=50)),
    ("exposure_condition", sa.String(length=50)),
    ("ggbs_kg", sa.Numeric(7, 2)),
    ("total_binder_kg", sa.Numeric(7, 2)),
    ("free_water_l", sa.Numeric(7, 2)),
    ("target_mean_strength_mpa", sa.Numeric(6, 2)),
    ("max_aggregate_size_mm", sa.Integer()),
    ("slump_range_mm", sa.String(length=30)),
    ("rejection_reason", sa.Text()),
    ("observed_28day_strength_mpa", sa.Numeric(6, 2)),
]


def upgrade() -> None:
    op.execute(
        "ALTER TYPE master.mixapprovalstatus ADD VALUE IF NOT EXISTS 'PENDING'"
    )

    for name, type_ in _MIX_COLUMNS:
        op.add_column(
            "mix_designs", sa.Column(name, type_, nullable=True), schema="master"
        )

    op.add_column(
        "suppliers",
        sa.Column("mix_submission_token", sa.String(length=100), nullable=True),
        schema="master",
    )
    op.add_column(
        "suppliers",
        sa.Column("mix_submission_sent_at", sa.DateTime(timezone=True), nullable=True),
        schema="master",
    )
    op.create_unique_constraint(
        "uq_supplier_mix_submission_token",
        "suppliers",
        ["mix_submission_token"],
        schema="master",
    )

    op.create_table(
        "supplier_required_grades",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("supplier_id", sa.BigInteger(), nullable=False),
        sa.Column("grade_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"], ["master.suppliers.supplier_id"]
        ),
        sa.ForeignKeyConstraint(["grade_id"], ["master.grades.grade_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "supplier_id", "grade_id", name="uq_supplier_required_grade"
        ),
        schema="master",
    )


def downgrade() -> None:
    op.drop_table("supplier_required_grades", schema="master")
    op.drop_constraint(
        "uq_supplier_mix_submission_token",
        "suppliers",
        schema="master",
        type_="unique",
    )
    op.drop_column("suppliers", "mix_submission_sent_at", schema="master")
    op.drop_column("suppliers", "mix_submission_token", schema="master")
    for name, _ in reversed(_MIX_COLUMNS):
        op.drop_column("mix_designs", name, schema="master")
    # The enum value PENDING is intentionally left in place (Postgres can't drop
    # an enum value without recreating the type).
