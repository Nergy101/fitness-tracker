"""add notes to workout_sessions

Revision ID: 778c620466ab
Revises: f0a249b5d504
Create Date: 2026-07-10 09:25:42.735077+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '778c620466ab'
down_revision: Union[str, None] = 'f0a249b5d504'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Guard: the column may already exist when running against a DB created by
    # Base.metadata.create_all (the pre-Alembic adoption path tested in CI).
    insp = sa.inspect(op.get_bind())
    cols = [c["name"] for c in insp.get_columns("workout_sessions")]
    if "notes" not in cols:
        op.add_column('workout_sessions', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    # SQLite can't drop columns directly; use batch_alter_table
    with op.batch_alter_table('workout_sessions') as batch_op:
        batch_op.drop_column('notes')
