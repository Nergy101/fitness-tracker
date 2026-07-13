from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(Engine, "connect")
def _enable_sqlite_fk(dbapi_connection, _connection_record):
    """SQLite ignores FK constraints unless asked per-connection. Turn them on
    so cascades/RESTRICT actually fire and deletes can't orphan child rows."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


# Revision whose schema matches what pre-Alembic releases created via
# Base.metadata.create_all (the initial migration, 20260707_0956).
PRE_ALEMBIC_BASELINE = "0d4df2102a99"


def run_migrations() -> None:
    """Apply all pending Alembic migrations on startup.

    For in-memory SQLite (used in tests), falls back to create_all since
    each connection creates a separate in-memory database.
    """
    if DATABASE_URL.endswith(":memory:") or DATABASE_URL == "sqlite://":
        # In-memory DB — use SQLAlchemy's create_all directly
        # Import models so Base.metadata knows all tables
        import app.models.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        return

    # File-based DB — use Alembic for proper migration tracking
    import os
    import subprocess
    import sys

    from sqlalchemy import inspect, text

    # Prefer the venv's alembic binary (CI/E2E), fall back to system PATH
    venv_bin = os.path.join(os.path.dirname(sys.executable), "alembic")
    alembic_bin = venv_bin if os.path.isfile(venv_bin) else "alembic"

    backend_dir = os.path.join(os.path.dirname(__file__), "..")

    def run_alembic(*args: str) -> None:
        proc = subprocess.run(
            [alembic_bin, *args],
            cwd=backend_dir,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            # Surface Alembic's own output — a bare CalledProcessError hides
            # the actual migration failure in container logs.
            raise RuntimeError(
                f"alembic {' '.join(args)} failed (exit {proc.returncode}):\n"
                f"{proc.stdout}{proc.stderr}"
            )

    # Adopt databases that predate Alembic: older releases created the schema
    # via Base.metadata.create_all, so tables exist but there is no version
    # stamp. Replaying the initial migration would fail with "table already
    # exists" — stamp the baseline revision (whose schema equals what
    # create_all produced) so `upgrade head` only applies newer migrations.
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "exercises" in tables:
        stamped = False
        if "alembic_version" in tables:
            with engine.connect() as conn:
                stamped = bool(
                    conn.execute(text("SELECT version_num FROM alembic_version")).first()
                )
        if not stamped:
            run_alembic("stamp", PRE_ALEMBIC_BASELINE)

    run_alembic("upgrade", "head")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
