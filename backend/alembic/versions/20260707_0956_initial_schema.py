"""initial schema — full FitnessTracker database

Revision ID: 0d4df2102a99
Revises: 
Create Date: 2026-07-07 09:56:28.666974+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d4df2102a99'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── exercises ──
    op.create_table('exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='other'),
        sa.Column('default_kcal_per_min', sa.Float(), nullable=True, server_default='5.0'),
        sa.Column('default_duration_seconds', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('image_url', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exercises_id'), 'exercises', ['id'], unique=False)

    # ── workout_templates ──
    op.create_table('workout_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('mode', sa.String(length=20), nullable=False, server_default='circuit'),
        sa.Column('time_cap_seconds', sa.Integer(), nullable=True),
        sa.Column('rounds', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('rest_between_rounds', sa.Integer(), nullable=False, server_default='180'),
        sa.Column('is_pinned', sa.Boolean(), nullable=True),
        sa.Column('pinned_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workout_templates_id'), 'workout_templates', ['id'], unique=False)

    # ── workout_template_exercises ──
    op.create_table('workout_template_exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('rest_after_seconds', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('superset_group', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['template_id'], ['workout_templates.id'], ),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workout_template_exercises_id'), 'workout_template_exercises', ['id'], unique=False)

    # ── workout_sessions ──
    op.create_table('workout_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('template_name', sa.String(length=255), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('total_duration_seconds', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_kcal_estimated', sa.Float(), nullable=True, server_default='0.0'),
        sa.ForeignKeyConstraint(['template_id'], ['workout_templates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workout_sessions_id'), 'workout_sessions', ['id'], unique=False)

    # ── session_exercises ──
    op.create_table('session_exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('exercise_name', sa.String(length=255), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('kcal_burned', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.ForeignKeyConstraint(['session_id'], ['workout_sessions.id'], ),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_session_exercises_id'), 'session_exercises', ['id'], unique=False)

    # ── exercise_logs ──
    op.create_table('exercise_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_exercise_id', sa.Integer(), nullable=False),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.Column('set_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_exercise_id'], ['session_exercises.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exercise_logs_id'), 'exercise_logs', ['id'], unique=False)

    # ── Health tracking tables ──

    op.create_table('user_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('height_cm', sa.Float(), nullable=True),
        sa.Column('birthday', sa.Date(), nullable=True),
        sa.Column('gender', sa.String(length=20), nullable=True),
        sa.Column('goal_weight_kg', sa.Float(), nullable=True),
        sa.Column('weight_unit', sa.String(length=10), nullable=True, server_default='kg'),
        sa.Column('reminder_time', sa.Time(), nullable=True),
        sa.Column('notifications_enabled', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_profiles_id'), 'user_profiles', ['id'], unique=False)

    op.create_table('weight_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('weight_kg', sa.Float(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weight_entries_id'), 'weight_entries', ['id'], unique=False)

    op.create_table('body_measurements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('waist_cm', sa.Float(), nullable=True),
        sa.Column('hips_cm', sa.Float(), nullable=True),
        sa.Column('chest_cm', sa.Float(), nullable=True),
        sa.Column('left_arm_cm', sa.Float(), nullable=True),
        sa.Column('right_arm_cm', sa.Float(), nullable=True),
        sa.Column('left_thigh_cm', sa.Float(), nullable=True),
        sa.Column('right_thigh_cm', sa.Float(), nullable=True),
        sa.Column('neck_cm', sa.Float(), nullable=True),
        sa.Column('estimated_body_fat_pct', sa.Float(), nullable=True),
        sa.Column('body_fat_method', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_body_measurements_id'), 'body_measurements', ['id'], unique=False)

    op.create_table('wellness_checkins',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('mood', sa.Integer(), nullable=True),
        sa.Column('energy', sa.Integer(), nullable=True),
        sa.Column('stress', sa.Integer(), nullable=True),
        sa.Column('sleep_hours', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wellness_checkins_id'), 'wellness_checkins', ['id'], unique=False)

    op.create_table('run_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=False),
        sa.Column('pace_per_km', sa.Float(), nullable=True),
        sa.Column('run_type', sa.String(length=10), nullable=False, server_default='run'),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_run_entries_id'), 'run_entries', ['id'], unique=False)

    op.create_table('push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.Text(), nullable=False),
        sa.Column('auth', sa.Text(), nullable=False),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('endpoint')
    )
    op.create_index(op.f('ix_push_subscriptions_id'), 'push_subscriptions', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_push_subscriptions_id'), table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
    op.drop_index(op.f('ix_run_entries_id'), table_name='run_entries')
    op.drop_table('run_entries')
    op.drop_index(op.f('ix_wellness_checkins_id'), table_name='wellness_checkins')
    op.drop_table('wellness_checkins')
    op.drop_index(op.f('ix_body_measurements_id'), table_name='body_measurements')
    op.drop_table('body_measurements')
    op.drop_index(op.f('ix_weight_entries_id'), table_name='weight_entries')
    op.drop_table('weight_entries')
    op.drop_index(op.f('ix_user_profiles_id'), table_name='user_profiles')
    op.drop_table('user_profiles')
    op.drop_index(op.f('ix_exercise_logs_id'), table_name='exercise_logs')
    op.drop_table('exercise_logs')
    op.drop_index(op.f('ix_session_exercises_id'), table_name='session_exercises')
    op.drop_table('session_exercises')
    op.drop_index(op.f('ix_workout_sessions_id'), table_name='workout_sessions')
    op.drop_table('workout_sessions')
    op.drop_index(op.f('ix_workout_template_exercises_id'), table_name='workout_template_exercises')
    op.drop_table('workout_template_exercises')
    op.drop_index(op.f('ix_workout_templates_id'), table_name='workout_templates')
    op.drop_table('workout_templates')
    op.drop_index(op.f('ix_exercises_id'), table_name='exercises')
    op.drop_table('exercises')
