"""Phase 10 — add OCR pipeline tables.

Adds:
  quality.ocr_jobs           — one row per PDF upload/extraction job
  quality.ocr_field_corrections — user corrections to extracted fields

Revision ID: phase10_ocr_tables
Revises: (set to the current head automatically)
Create Date: 2026-07-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "phase10_ocr_tables"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ocr_jobs ────────────────────────────────────────────────────────────

    op.create_table(
        "ocr_jobs",
        sa.Column("job_id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.BigInteger, sa.ForeignKey("master.projects.project_id"), nullable=False),
        sa.Column("document_id", sa.BigInteger, sa.ForeignKey("master.documents.document_id"), nullable=True),
        sa.Column("uploaded_by", sa.BigInteger, sa.ForeignKey("auth.users.user_id"), nullable=True),
        sa.Column(
            "status",
            sa.Enum("QUEUED", "PROCESSING", "COMPLETED", "FAILED",
                    name="ocr_job_status", schema="quality"),
            nullable=False,
            server_default="QUEUED",
        ),
        sa.Column("doc_type", sa.String(50), nullable=True),
        sa.Column("page_count", sa.Integer, nullable=True),
        sa.Column("is_digital", sa.Boolean, nullable=True),
        sa.Column("result_json", JSONB, nullable=True),
        sa.Column("overall_confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("processing_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        schema="quality",
    )
    op.create_index("idx_ocr_jobs_project", "ocr_jobs", ["project_id"], schema="quality")
    op.create_index("idx_ocr_jobs_status",  "ocr_jobs", ["status"],     schema="quality")

    # ── ocr_field_corrections ─────────────────────────────────────────────────
    op.create_table(
        "ocr_field_corrections",
        sa.Column("correction_id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("quality.ocr_jobs.job_id"), nullable=False),
        sa.Column("doc_type", sa.String(50), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("extracted_value", sa.Text, nullable=True),
        sa.Column("corrected_value", sa.Text, nullable=True),
        sa.Column("corrected_by", sa.BigInteger, sa.ForeignKey("auth.users.user_id"), nullable=True),
        sa.Column("corrected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="quality",
    )
    op.create_index("idx_ocr_corrections_job",           "ocr_field_corrections", ["job_id"],               schema="quality")
    op.create_index("idx_ocr_corrections_doctype_field",  "ocr_field_corrections", ["doc_type", "field_name"], schema="quality")


def downgrade() -> None:
    op.drop_table("ocr_field_corrections", schema="quality")
    op.drop_table("ocr_jobs", schema="quality")
    op.execute("DROP TYPE IF EXISTS quality.ocr_job_status")
