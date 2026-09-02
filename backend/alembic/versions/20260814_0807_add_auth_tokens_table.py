"""add auth_tokens table

Revision ID: 7b3e1d9c4a25
Revises: 14210fb828f7
Create Date: 2026-08-14 08:07:00.000000+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b3e1d9c4a25'
down_revision: Union[str, None] = '9bce257a8436'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "auth_tokens" not in insp.get_table_names():
        op.create_table('auth_tokens',
            sa.Column('token', sa.String(length=64), nullable=False),
            sa.Column('expires_at', sa.Float(), nullable=False),
            sa.PrimaryKeyConstraint('token')
        )
        op.create_index(op.f('ix_auth_tokens_expires_at'), 'auth_tokens', ['expires_at'], unique=False)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "auth_tokens" in insp.get_table_names():
        op.drop_index(op.f('ix_auth_tokens_expires_at'), table_name='auth_tokens')
        op.drop_table('auth_tokens')
