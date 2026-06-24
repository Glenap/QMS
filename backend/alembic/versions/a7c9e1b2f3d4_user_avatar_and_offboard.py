"""user profile picture + offboarding flag

Adds auth.users.avatar_url (data: URL profile picture) and
auth.users.is_offboarded (org-admin deactivation that survives the OTP flow).

Revision ID: a7c9e1b2f3d4
Revises: f1a2b3c4d5e6
Create Date: 2026-06-24 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c9e1b2f3d4"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_offboarded",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        schema="auth",
    )
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.Text(), nullable=True),
        schema="auth",
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url", schema="auth")
    op.drop_column("users", "is_offboarded", schema="auth")
