"""add cycling_entries table

Revision ID: c4ff5c2c3579
Revises: e538293b14d1
Create Date: 2026-07-31 07:56:07.987148+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4ff5c2c3579'
down_revision: Union[str, None] = 'e538293b14d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    # An earlier release of this migration aborted midway: SQLite DDL
    # autocommits under pysqlite, so cycling_entries survived while the
    # alembic_version stamp did not.  Re-running must not trip over the
    # leftovers, or the deploy crash-loops on "table already exists".
    if not insp.has_table("cycling_entries"):
        op.create_table('cycling_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )

    if not any(
        ix["name"] == op.f('ix_cycling_entries_id')
        for ix in insp.get_indexes("cycling_entries")
    ):
        op.create_index(op.f('ix_cycling_entries_id'), 'cycling_entries', ['id'], unique=False)

    cols = [c["name"] for c in insp.get_columns("workout_sessions")]
    with op.batch_alter_table("workout_sessions") as batch_op:
        if "cycling_entry_id" not in cols:
            batch_op.add_column(sa.Column("cycling_entry_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_workout_sessions_cycling_entry_id",
                "cycling_entries",
                ["cycling_entry_id"], ["id"],
            )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = [c["name"] for c in insp.get_columns("workout_sessions")]

    with op.batch_alter_table("workout_sessions") as batch_op:
        if "cycling_entry_id" in cols:
            batch_op.drop_constraint(
                "fk_workout_sessions_cycling_entry_id",
                type_="foreignkey",
            )
            batch_op.drop_column("cycling_entry_id")

    op.drop_index(op.f('ix_cycling_entries_id'), table_name='cycling_entries')
    op.drop_table('cycling_entries')
