"""Alembic migration environment for FitnessTracker."""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, event, pool
from alembic import context

from app.database import Base, DATABASE_URL

# Import all models so Base.metadata knows about them
from app.models.models import (  # noqa: F401
    Exercise,
    WorkoutTemplate,
    WorkoutTemplateExercise,
    WorkoutSession,
    SessionExercise,
    ExerciseLog,
    UserProfile,
    WeightEntry,
    BodyMeasurement,
    WellnessCheckin,
    RunEntry,
    PushSubscription,
    HealthMetric,
    HealthWorkout,
)

config = context.config

# Override sqlalchemy.url from DATABASE_URL
config.set_main_option("sqlalchemy.url", DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without connecting)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect to DB and apply)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # app.database registers an Engine-wide "connect" listener that turns
    # PRAGMA foreign_keys ON.  Right for the app, fatal for migrations:
    # op.batch_alter_table() emulates ALTER on SQLite by copying the table and
    # issuing DROP TABLE on the original, which raises "FOREIGN KEY constraint
    # failed" the moment any child row references it (session_exercises ->
    # workout_sessions).  Alembic's docs call for disabling FK enforcement
    # around batch migrations.
    #
    # This must run as a raw DBAPI "connect" hook, not connection.execute():
    # any statement issued through the SQLAlchemy Connection begins a logical
    # transaction, and since this block never commits, the alembic_version
    # INSERT would be rolled back on close while the autocommitted DDL stuck —
    # leaving exactly the half-migrated DB this is meant to prevent.
    @event.listens_for(connectable, "connect")
    def _disable_sqlite_fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
