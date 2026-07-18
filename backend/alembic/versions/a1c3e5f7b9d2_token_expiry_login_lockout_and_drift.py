"""Token expiry, login lockout, and model/migration drift fixes.

Three unrelated-but-small schema changes, batched into one revision:

1. **Confirmation-token expiry.** ``master.suppliers`` and
   ``master.testing_labs`` get ``confirmation_token_expires_at``. The
   confirmation link is a bearer credential sent by email and previously never
   expired and was never cleared after use, so a forwarded or leaked message
   could be replayed indefinitely to rewrite ``contact_email`` — the address
   every later dispatch / mix-submission / lab-report link is sent to.

2. **Login lockout.** ``auth.users`` gets ``failed_login_attempts`` and
   ``locked_until``. Password login had no attempt cap at all (only the OTP
   paths were bounded). Kept in the DB, not process memory, so a lockout
   survives the restarts and sleep/wake cycles of a hosted instance.

3. **Drift fixes.** ``auth.email_otps.created_at`` and
   ``auth.project_members.assigned_at`` are non-optional on the models but were
   created nullable, so the test schema (built from models) enforced a
   constraint the real database did not. Both carry ``server_default=now()``, so
   no backfill is needed.

The fourth drift item — four unique constraints whose model-side names differed
from the migration-side names — is fixed on the models only (explicit
``UniqueConstraint`` with the migration's name). The database is already
correct, so there is nothing to migrate.

Revision ID: a1c3e5f7b9d2
Revises: f0e1d2c3b4a5
"""

import sqlalchemy as sa
from alembic import op

revision = "a1c3e5f7b9d2"
down_revision = "f0e1d2c3b4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Confirmation-token expiry.
    for table in ("suppliers", "testing_labs"):
        op.add_column(
            table,
            sa.Column(
                "confirmation_token_expires_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
            schema="master",
        )

    # Backfill: rows that already hold a token get a fresh window rather than
    # being cut off. The service treats a NULL expiry as expired (so a token can
    # never be unbounded again), which without this would instantly invalidate
    # every in-flight confirmation link.
    for table in ("suppliers", "testing_labs"):
        op.execute(
            f"UPDATE master.{table} "
            "SET confirmation_token_expires_at = now() + interval '14 days' "
            "WHERE confirmation_token IS NOT NULL"
        )

    # 2. Login lockout.
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        schema="auth",
    )
    op.add_column(
        "users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        schema="auth",
    )

    # 3. NOT NULL drift. Both columns default to now() server-side, so existing
    #    rows are already populated — but fill defensively before the ALTER so
    #    the migration can't fail on unexpected data.
    op.execute(
        "UPDATE auth.email_otps SET created_at = now() WHERE created_at IS NULL"
    )
    op.alter_column(
        "email_otps",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        schema="auth",
    )
    op.execute(
        "UPDATE auth.project_members SET assigned_at = now() WHERE assigned_at IS NULL"
    )
    op.alter_column(
        "project_members",
        "assigned_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        schema="auth",
    )


def downgrade() -> None:
    op.alter_column(
        "project_members",
        "assigned_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        schema="auth",
    )
    op.alter_column(
        "email_otps",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        schema="auth",
    )
    op.drop_column("users", "locked_until", schema="auth")
    op.drop_column("users", "failed_login_attempts", schema="auth")
    for table in ("testing_labs", "suppliers"):
        op.drop_column(table, "confirmation_token_expires_at", schema="master")
