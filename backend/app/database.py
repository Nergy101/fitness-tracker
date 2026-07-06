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
            if "mode" not in cols:
                conn.execute(text(
                    "ALTER TABLE workout_templates ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'circuit'"
                ))
            if "time_cap_seconds" not in cols:
                conn.execute(text(
                    "ALTER TABLE workout_templates ADD COLUMN time_cap_seconds INTEGER"
                ))
        if "exercises" in tables:
            cols = {c["name"] for c in inspector.get_columns("exercises")}
            if "image_url" not in cols:
                conn.execute(text(
                    "ALTER TABLE exercises ADD COLUMN image_url VARCHAR(512)"
                ))
        if "workout_template_exercises" in tables:
            cols = {c["name"] for c in inspector.get_columns("workout_template_exercises")}
            if "rest_after_seconds" not in cols:
                conn.execute(text(
                    "ALTER TABLE workout_template_exercises ADD COLUMN rest_after_seconds INTEGER NOT NULL DEFAULT 0"
                ))

        # Health tracking tables — ensure they exist (new tables are created by create_all above)
        # Add any additive columns for these tables here in future versions.

        # Exercise logs table (NER-101)
        if "exercise_logs" not in tables:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS exercise_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
                    weight_kg REAL,
                    reps INTEGER,
                    set_number INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NOT NULL DEFAULT (datetime('now'))
                )
            """))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
