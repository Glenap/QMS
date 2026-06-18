"""added_con_admin

Revision ID: 51a3dda11f5f
Revises: 3c1709b18088
Create Date: 2026-06-04 15:23:43.497900

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '51a3dda11f5f'
down_revision: Union[str, None] = '3c1709b18088'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auth.userrole ADD VALUE IF NOT EXISTS 'CONTRACTOR_ADMIN'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    # To rollback: recreate the type without CONTRACTOR_ADMIN
    pass