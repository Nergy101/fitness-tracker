"""add rounds to boxing_entries

Revision ID: fa08ef57c463
Revises: d0b196644944
Create Date: 2026-07-11 08:31:42.827346+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa08ef57c463'
down_revision: Union[str, None] = 'd0b196644944'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "rounds" not in [c["name"] for c in insp.get_columns("boxing_entries")]:
        op.add_column('boxing_entries', sa.Column('rounds', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('boxing_entries') as batch_op:
        batch_op.drop_column('rounds')