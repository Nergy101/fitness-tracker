"""add_warmup_cooldown_to_workout_templates

Revision ID: 83dd52a38bdc
Revises: 5187c13f60b6
Create Date: 2026-07-08 08:41:37.514688+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83dd52a38bdc'
down_revision: Union[str, None] = '5187c13f60b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility.  When the DB was created
    # by Base.metadata.create_all (test / adoption path), these columns already
    # exist — reflect the table to avoid "duplicate column" errors.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {c['name'] for c in inspector.get_columns('workout_templates')}

    with op.batch_alter_table('workout_templates') as batch_op:
        if 'warmup_seconds' not in existing:
            batch_op.add_column(sa.Column('warmup_seconds', sa.Integer(), nullable=True,
                                          server_default='0'))
        if 'cooldown_seconds' not in existing:
            batch_op.add_column(sa.Column('cooldown_seconds', sa.Integer(), nullable=True,
                                          server_default='0'))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {c['name'] for c in inspector.get_columns('workout_templates')}

    with op.batch_alter_table('workout_templates') as batch_op:
        if 'cooldown_seconds' in existing:
            batch_op.drop_column('cooldown_seconds')
        if 'warmup_seconds' in existing:
            batch_op.drop_column('warmup_seconds')
