"""NCR retests + RMC notifications; drop money penalties

Reshapes the NCR remedy layer:
  * DROP ``quality.penalties`` (+ ``penaltytype`` enum) — money deductions are
    replaced by a formal RMC notification.
  * ADD ``quality.retests`` — an IS-456 in-situ verification (core / rebound /
    UPV) ordered on an NCR; a PASS supports closing without demolition.
  * ADD ``quality.ncr_rmc_notifications`` — audit trail of the QE emailing the
    RMC about an NCR, with an optional attached PDF report.

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-07-16 13:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    retest_type = sa.Enum(
        "CORE_CUTTING", "REBOUND_HAMMER", "UPV", name="retesttype", schema="quality"
    )
    retest_result = sa.Enum("PASS", "FAIL", name="retestresult", schema="quality")

    op.create_table(
        "retests",
        sa.Column("retest_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ncr_id", sa.BigInteger(), nullable=False),
        sa.Column("retest_type", retest_type, nullable=False),
        sa.Column("result", retest_result, nullable=True),
        sa.Column("test_date", sa.Date(), nullable=True),
        sa.Column("observed_strength_mpa", sa.Numeric(7, 2), nullable=True),
        sa.Column("required_strength_mpa", sa.Numeric(7, 2), nullable=True),
        sa.Column("lab_id", sa.BigInteger(), nullable=True),
        sa.Column("report_document_id", sa.BigInteger(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("ordered_by", sa.BigInteger(), nullable=True),
        sa.Column("performed_by", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["ncr_id"], ["quality.ncrs.ncr_id"]),
        sa.ForeignKeyConstraint(["lab_id"], ["master.testing_labs.lab_id"]),
        sa.ForeignKeyConstraint(["report_document_id"], ["master.documents.document_id"]),
        sa.ForeignKeyConstraint(["ordered_by"], ["auth.users.user_id"]),
        sa.ForeignKeyConstraint(["performed_by"], ["auth.users.user_id"]),
        sa.PrimaryKeyConstraint("retest_id"),
        schema="quality",
    )
    op.create_index("idx_retest_ncr", "retests", ["ncr_id"], schema="quality")

    op.create_table(
        "ncr_rmc_notifications",
        sa.Column("notification_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ncr_id", sa.BigInteger(), nullable=False),
        sa.Column("supplier_id", sa.BigInteger(), nullable=True),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("report_document_id", sa.BigInteger(), nullable=True),
        sa.Column("sent_by", sa.BigInteger(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["ncr_id"], ["quality.ncrs.ncr_id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["master.suppliers.supplier_id"]),
        sa.ForeignKeyConstraint(["report_document_id"], ["master.documents.document_id"]),
        sa.ForeignKeyConstraint(["sent_by"], ["auth.users.user_id"]),
        sa.PrimaryKeyConstraint("notification_id"),
        schema="quality",
    )
    op.create_index(
        "idx_ncr_rmc_notification_ncr", "ncr_rmc_notifications", ["ncr_id"], schema="quality"
    )

    op.drop_table("penalties", schema="quality")
    op.execute("DROP TYPE IF EXISTS quality.penaltytype")


def downgrade() -> None:
    penalty_type = sa.Enum(
        "RATE_REDUCTION", "REJECTION", "DEMOLITION", name="penaltytype", schema="quality"
    )
    op.create_table(
        "penalties",
        sa.Column("penalty_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ncr_id", sa.BigInteger(), nullable=False),
        sa.Column("penalty_type", penalty_type, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("applied_by", sa.BigInteger(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["ncr_id"], ["quality.ncrs.ncr_id"]),
        sa.ForeignKeyConstraint(["applied_by"], ["auth.users.user_id"]),
        sa.PrimaryKeyConstraint("penalty_id"),
        schema="quality",
    )

    op.drop_table("ncr_rmc_notifications", schema="quality")
    op.drop_table("retests", schema="quality")
    op.execute("DROP TYPE IF EXISTS quality.retestresult")
    op.execute("DROP TYPE IF EXISTS quality.retesttype")
