"""client-registered RMC/labs + contractor approval

The client can now register RMC suppliers + testing labs (project setting
``registration_by = CLIENT``); the contractor then accepts/rejects each.

  * ``master.projects.registration_by`` — CONTRACTOR (default) | CLIENT.
  * ``master.suppliers`` / ``master.testing_labs`` gain ``registered_by``
    (CONTRACTOR | CLIENT), ``approval_status`` (NOT_REQUIRED | PENDING |
    ACCEPTED | REJECTED) and ``approval_reason``.

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-07-10 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ENTITY_TABLES = ("suppliers", "testing_labs")


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "registration_by", sa.String(length=20), nullable=False,
            server_default="CONTRACTOR",
        ),
        schema="master",
    )
    for table in _ENTITY_TABLES:
        op.add_column(
            table,
            sa.Column(
                "registered_by", sa.String(length=20), nullable=False,
                server_default="CONTRACTOR",
            ),
            schema="master",
        )
        op.add_column(
            table,
            sa.Column(
                "approval_status", sa.String(length=20), nullable=False,
                server_default="NOT_REQUIRED",
            ),
            schema="master",
        )
        op.add_column(
            table,
            sa.Column("approval_reason", sa.Text(), nullable=True),
            schema="master",
        )


def downgrade() -> None:
    for table in _ENTITY_TABLES:
        for col in ("approval_reason", "approval_status", "registered_by"):
            op.drop_column(table, col, schema="master")
    op.drop_column("projects", "registration_by", schema="master")
