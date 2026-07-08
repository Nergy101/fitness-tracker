"""health import — Apple Health metrics + workouts tables

Revision ID: 5187c13f60b6
Revises: 0d4df2102a99
Create Date: 2026-07-07 20:30:00.000000+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5187c13f60b6'
down_revision: Union[str, None] = '0d4df2102a99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'health_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('metric_name', sa.String(length=64), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('units', sa.String(length=32), nullable=True),
        sa.Column('qty', sa.Float(), nullable=True),
        sa.Column('data', sa.Text(), nullable=True),
        sa.Column('source', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('metric_name', 'date', name='uq_health_metric_name_date'),
    )
    op.create_index(op.f('ix_health_metrics_id'), 'health_metrics', ['id'], unique=False)
    op.create_index(op.f('ix_health_metrics_metric_name'), 'health_metrics', ['metric_name'], unique=False)
    op.create_index(op.f('ix_health_metrics_date'), 'health_metrics', ['date'], unique=False)

    op.create_table(
        'health_workouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=True),
        sa.Column('location', sa.String(length=64), nullable=True),
        sa.Column('start', sa.DateTime(), nullable=True),
        sa.Column('end', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('active_energy_kj', sa.Float(), nullable=True),
        sa.Column('total_energy_kj', sa.Float(), nullable=True),
        sa.Column('avg_heart_rate', sa.Float(), nullable=True),
        sa.Column('max_heart_rate', sa.Float(), nullable=True),
        sa.Column('data', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_health_workouts_id'), 'health_workouts', ['id'], unique=False)
    op.create_index(op.f('ix_health_workouts_external_id'), 'health_workouts', ['external_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_health_workouts_external_id'), table_name='health_workouts')
    op.drop_index(op.f('ix_health_workouts_id'), table_name='health_workouts')
    op.drop_table('health_workouts')
    op.drop_index(op.f('ix_health_metrics_date'), table_name='health_metrics')
    op.drop_index(op.f('ix_health_metrics_metric_name'), table_name='health_metrics')
    op.drop_index(op.f('ix_health_metrics_id'), table_name='health_metrics')
    op.drop_table('health_metrics')
