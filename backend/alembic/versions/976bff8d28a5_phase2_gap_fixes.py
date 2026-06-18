"""phase2 gap fixes

Revision ID: 976bff8d28a5
Revises: 4a24961900c5
Create Date: 2026-06-04 12:06:43.152341

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '976bff8d28a5'
down_revision: Union[str, None] = '4a24961900c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type BEFORE the column that uses it
    pourstatus = sa.Enum(
        'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
        name='pourstatus', schema='transaction'
    )
    pourstatus.create(op.get_bind(), checkfirst=True)

    # cube_samples — new columns
    op.add_column('cube_samples', sa.Column('lab_id', sa.BigInteger(), nullable=True), schema='transaction')
    op.add_column('cube_samples', sa.Column('lab_dispatch_date', sa.Date(), nullable=True), schema='transaction')
    op.add_column('cube_samples', sa.Column('expected_result_date', sa.Date(), nullable=True), schema='transaction')
    op.add_column('cube_samples', sa.Column('result_reminder_sent', sa.Boolean(), nullable=False, server_default='false'), schema='transaction')
    op.add_column('cube_samples', sa.Column('lab_dispatch_notes', sa.Text(), nullable=True), schema='transaction')
    op.create_foreign_key(None, 'cube_samples', 'testing_labs', ['lab_id'], ['lab_id'], source_schema='transaction', referent_schema='master')

    # pours — new columns (enum type created above)
    op.add_column('pours', sa.Column('status', sa.Enum('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='pourstatus', schema='transaction'), nullable=False, server_default='PLANNED'), schema='transaction')
    op.add_column('pours', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True), schema='transaction')
    op.add_column('pours', sa.Column('volume_actual_cum', sa.Numeric(precision=10, scale=2), nullable=True), schema='transaction')
    op.add_column('pours', sa.Column('completion_notes', sa.Text(), nullable=True), schema='transaction')

    # rmc_dispatches — new columns
    op.add_column('rmc_dispatches', sa.Column('volume_received_cum', sa.Numeric(precision=8, scale=2), nullable=True), schema='transaction')
    op.add_column('rmc_dispatches', sa.Column('volume_remaining_cum', sa.Numeric(precision=8, scale=2), nullable=True), schema='transaction')
    op.add_column('rmc_dispatches', sa.Column('grade_confirmed_id', sa.BigInteger(), nullable=True), schema='transaction')
    op.add_column('rmc_dispatches', sa.Column('grade_mismatch', sa.Boolean(), nullable=False, server_default='false'), schema='transaction')
    op.add_column('rmc_dispatches', sa.Column('slump_at_site_mm', sa.Numeric(precision=6, scale=1), nullable=True), schema='transaction')
    op.add_column('rmc_dispatches', sa.Column('is_complete', sa.Boolean(), nullable=False, server_default='false'), schema='transaction')
    op.create_foreign_key(None, 'rmc_dispatches', 'grades', ['grade_confirmed_id'], ['grade_id'], source_schema='transaction', referent_schema='master')


def downgrade() -> None:
    op.drop_constraint(None, 'rmc_dispatches', schema='transaction', type_='foreignkey')
    op.drop_column('rmc_dispatches', 'is_complete', schema='transaction')
    op.drop_column('rmc_dispatches', 'slump_at_site_mm', schema='transaction')
    op.drop_column('rmc_dispatches', 'grade_mismatch', schema='transaction')
    op.drop_column('rmc_dispatches', 'grade_confirmed_id', schema='transaction')
    op.drop_column('rmc_dispatches', 'volume_remaining_cum', schema='transaction')
    op.drop_column('rmc_dispatches', 'volume_received_cum', schema='transaction')
    op.drop_column('pours', 'completion_notes', schema='transaction')
    op.drop_column('pours', 'volume_actual_cum', schema='transaction')
    op.drop_column('pours', 'completed_at', schema='transaction')
    op.drop_column('pours', 'status', schema='transaction')
    sa.Enum(name='pourstatus', schema='transaction').drop(op.get_bind(), checkfirst=True)
    op.drop_constraint(None, 'cube_samples', schema='transaction', type_='foreignkey')
    op.drop_column('cube_samples', 'lab_dispatch_notes', schema='transaction')
    op.drop_column('cube_samples', 'result_reminder_sent', schema='transaction')
    op.drop_column('cube_samples', 'expected_result_date', schema='transaction')
    op.drop_column('cube_samples', 'lab_dispatch_date', schema='transaction')
    op.drop_column('cube_samples', 'lab_id', schema='transaction')