from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


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

    backend_dir = os.path.join(os.path.dirname(__file__), "..")
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=backend_dir,
        check=True,
        capture_output=True,
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
