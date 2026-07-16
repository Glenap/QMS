"""dispatch-first pour model

The workflow inverts: a dispatch is now raised before any pour and the pour is
recorded from the accepted delivery (one delivery → one pour, pour volume =
delivered volume). Two schema changes support this:

  * ``transaction.rmc_dispatches`` gains its own ``project_id`` — a dispatch used
    to be scoped to a project only through its pour, which no longer exists when
    the dispatch is raised. Existing rows are backfilled from the pour link.
  * ``transaction.pour_dispatch_links.dispatch_id`` becomes unique — one delivery
    yields at most one pour (the old non-unique index is dropped).

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-07-10 09:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── rmc_dispatches.project_id ────────────────────────────────────────────
    op.add_column(
        "rmc_dispatches",
        sa.Column("project_id", sa.BigInteger(), nullable=True),
        schema="transaction",
    )
    # Backfill from each dispatch's linked pour (every existing dispatch had one).
    op.execute(
        """
        UPDATE transaction.rmc_dispatches AS d
        SET project_id = p.project_id
        FROM transaction.pour_dispatch_links AS l
        JOIN transaction.pours AS p ON p.pour_id = l.pour_id
        WHERE l.dispatch_id = d.dispatch_id
        """
    )
    op.alter_column(
        "rmc_dispatches", "project_id", nullable=False, schema="transaction"
    )
    op.create_foreign_key(
        "fk_rmc_dispatches_project",
        "rmc_dispatches",
        "projects",
        ["project_id"],
        ["project_id"],
        source_schema="transaction",
        referent_schema="master",
    )
    op.create_index(
        "idx_rmc_dispatch_project",
        "rmc_dispatches",
        ["project_id"],
        schema="transaction",
    )

    # ── pour_dispatch_links: one pour per delivery ───────────────────────────
    op.execute("DROP INDEX IF EXISTS transaction.idx_pdl_dispatch")
    op.create_unique_constraint(
        "uq_pdl_dispatch", "pour_dispatch_links", ["dispatch_id"], schema="transaction"
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_pdl_dispatch", "pour_dispatch_links", schema="transaction", type_="unique"
    )
    op.create_index(
        "idx_pdl_dispatch", "pour_dispatch_links", ["dispatch_id"], schema="transaction"
    )

    op.drop_index("idx_rmc_dispatch_project", "rmc_dispatches", schema="transaction")
    op.drop_constraint(
        "fk_rmc_dispatches_project",
        "rmc_dispatches",
        schema="transaction",
        type_="foreignkey",
    )
    op.drop_column("rmc_dispatches", "project_id", schema="transaction")
