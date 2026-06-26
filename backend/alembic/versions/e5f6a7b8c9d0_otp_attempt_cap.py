"""security — OTP brute-force attempt counter

Adds ``auth.email_otps.attempts``: failed verification attempts against a code.
verify_otp burns the OTP once this hits the cap (auth_service.MAX_OTP_ATTEMPTS),
so a 6-digit code can't be brute-forced inside its validity window. Mirrored on
the SQLAlchemy model so the test schema (create_all) gets it too.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-27 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_otps",
        sa.Column(
            "attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        schema="auth",
    )


def downgrade() -> None:
    op.drop_column("email_otps", "attempts", schema="auth")
