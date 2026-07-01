from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    """Apply lightweight, additive migrations that create_all can't handle
    (it never alters existing tables). Idempotent and safe to call on startup."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        if "workout_templates" in tables:
            cols = {c["name"] for c in inspector.get_columns("workout_templates")}
            if "rounds" not in cols:
                conn.execute(text(
                    "ALTER TABLE workout_templates ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1"
                ))
            if "rest_between_rounds" not in cols:
                conn.execute(text(
                    "ALTER TABLE workout_templates ADD COLUMN rest_between_rounds INTEGER NOT NULL DEFAULT 180"
                ))
        if "exercises" in tables:
            cols = {c["name"] for c in inspector.get_columns("exercises")}
            if "image_url" not in cols:
                conn.execute(text(
                    "ALTER TABLE exercises ADD COLUMN image_url VARCHAR(512)"
                ))

        # Health tracking tables — ensure they exist (new tables are created by create_all above)
        # Add any additive columns for these tables here in future versions.


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
