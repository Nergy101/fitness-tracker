"""add quick_activity_entries table

Revision ID: dd12531288f4
Revises: 778c620466ab
Create Date: 2026-07-12 09:57:24.169237+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd12531288f4'
down_revision: Union[str, None] = '778c620466ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('quick_activity_entries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('activity_type', sa.String(length=32), nullable=False),
    sa.Column('duration_seconds', sa.Integer(), nullable=False),
    sa.Column('kcal_per_min', sa.Float(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quick_activity_entries_activity_type'), 'quick_activity_entries', ['activity_type'], unique=False)
    op.create_index(op.f('ix_quick_activity_entries_id'), 'quick_activity_entries', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_quick_activity_entries_id'), table_name='quick_activity_entries')
    op.drop_index(op.f('ix_quick_activity_entries_activity_type'), table_name='quick_activity_entries')
    op.drop_table('quick_activity_entries')