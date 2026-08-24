"""add equipment/muscle_group to exercises, rpe/notes to exercise_logs (NER-222/242/241/228)

Revision ID: 9bce257a8436
Revises: 14210fb828f7
Create Date: 2026-08-20 11:40:47.235459+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9bce257a8436'
down_revision: Union[str, None] = '14210fb828f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    """True if the table already has the column.

    Guards the pre-Alembic adoption path where the DB was created with
    ``Base.metadata.create_all`` (which already includes these columns);
    re-adding them would fail with 'duplicate column name'.
    """
    insp = sa.inspect(op.get_bind())
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    if not _has_column("exercise_logs", "rpe"):
        op.add_column('exercise_logs', sa.Column('rpe', sa.Integer(), nullable=True))
    if not _has_column("exercise_logs", "notes"):
        op.add_column('exercise_logs', sa.Column('notes', sa.Text(), nullable=True))
    if not _has_column("exercises", "equipment"):
        op.add_column('exercises', sa.Column('equipment', sa.String(length=50), nullable=True))
    if not _has_column("exercises", "muscle_group"):
        op.add_column('exercises', sa.Column('muscle_group', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('exercises', 'muscle_group')
    op.drop_column('exercises', 'equipment')
    op.drop_column('exercise_logs', 'notes')
    op.drop_column('exercise_logs', 'rpe')
