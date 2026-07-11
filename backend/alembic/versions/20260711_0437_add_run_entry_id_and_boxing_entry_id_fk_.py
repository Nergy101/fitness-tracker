"""add run_entry_id and boxing_entry_id FK to workout_sessions

Revision ID: d0b196644944
Revises: 778c620466ab
Create Date: 2026-07-11 04:37:31.190373+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0b196644944'
down_revision: Union[str, None] = '778c620466ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = [c["name"] for c in insp.get_columns("workout_sessions")]

    with op.batch_alter_table("workout_sessions") as batch_op:
        if "run_entry_id" not in cols:
            batch_op.add_column(sa.Column("run_entry_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_workout_sessions_run_entry_id",
                "run_entries",
                ["run_entry_id"], ["id"],
            )
        if "boxing_entry_id" not in cols:
            batch_op.add_column(sa.Column("boxing_entry_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_workout_sessions_boxing_entry_id",
                "boxing_entries",
                ["boxing_entry_id"], ["id"],
            )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = [c["name"] for c in insp.get_columns("workout_sessions")]

    with op.batch_alter_table("workout_sessions") as batch_op:
        if "boxing_entry_id" in cols:
            batch_op.drop_constraint(
                "fk_workout_sessions_boxing_entry_id",
                type_="foreignkey",
            )
            batch_op.drop_column("boxing_entry_id")
        if "run_entry_id" in cols:
            batch_op.drop_constraint(
                "fk_workout_sessions_run_entry_id",
                type_="foreignkey",
            )
            batch_op.drop_column("run_entry_id")