"""add injury_markers table

Revision ID: e538293b14d1
Revises: fa08ef57c463
Create Date: 2026-07-28 08:22:24.790389+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e538293b14d1'
down_revision: Union[str, None] = 'fa08ef57c463'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "injury_markers" not in insp.get_table_names():
        op.create_table('injury_markers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('body_part', sa.String(length=255), nullable=False),
            sa.Column('severity', sa.Integer(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('resolved_date', sa.Date(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_injury_markers_id'), 'injury_markers', ['id'], unique=False)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "injury_markers" in insp.get_table_names():
        op.drop_index(op.f('ix_injury_markers_id'), table_name='injury_markers')
        op.drop_table('injury_markers')
