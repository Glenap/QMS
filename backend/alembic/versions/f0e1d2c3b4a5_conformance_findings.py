"""Conformance findings — per-photo defect classification

ADD ``quality.conformance_findings`` — an inspector's classification of one
conformance photo (a CONFORMANCE_POST / _RCC document) against the curated defect
taxonomy: which defect, its severity, the chosen remediation option, and notes.
One finding per photo (``document_id`` is unique; the service upserts by it).

Revision ID: f0e1d2c3b4a5
Revises: e8f9a0b1c2d3
Create Date: 2026-07-17 18:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f0e1d2c3b4a5"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conformance_findings",
        sa.Column("finding_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("document_id", sa.BigInteger(), nullable=False),
        sa.Column("phase", sa.String(length=10), nullable=False),
        sa.Column("defect_code", sa.String(length=80), nullable=False),
        sa.Column("defect_label", sa.String(length=200), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=False),
        sa.Column("remediation_choice", sa.String(length=1), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["master.projects.project_id"]),
        sa.ForeignKeyConstraint(["document_id"], ["master.documents.document_id"]),
        sa.ForeignKeyConstraint(["created_by"], ["auth.users.user_id"]),
        sa.PrimaryKeyConstraint("finding_id"),
        sa.UniqueConstraint("document_id"),
        schema="quality",
    )
    op.create_index(
        "idx_conformance_finding_project", "conformance_findings", ["project_id"], schema="quality"
    )


def downgrade() -> None:
    op.drop_index("idx_conformance_finding_project", table_name="conformance_findings", schema="quality")
    op.drop_table("conformance_findings", schema="quality")
