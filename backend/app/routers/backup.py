"""Backup and restore router — JSON dumps of all data tables."""

import json
import logging
from datetime import date, datetime, time, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    Exercise, WorkoutTemplate, WorkoutTemplateExercise,
    WorkoutSession, SessionExercise, ExerciseLog,
    UserProfile, WeightEntry, BodyMeasurement, WellnessCheckin,
    RunEntry, PushSubscription, HealthMetric, HealthWorkout,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["backup"])

CONFIG_FILENAME = "backup_config.json"
CONFIG_PATH = Path(CONFIG_FILENAME)  # stored in backend working directory
DEFAULT_BACKUP_DIR = "./backups"
BACKUP_VERSION = "1.0"

# ─── Helpers ──────────────────────────────────────────────


def _load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_config(config: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def _get_backup_dir() -> Path:
    """Read backup directory from config, or return default."""
    config = _load_config()
    return Path(config.get("location", DEFAULT_BACKUP_DIR))


def _table_name(model) -> str:
    return model.__tablename__


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict."""
    return {c.key: _serialize_val(getattr(row, c.key)) for c in row.__table__.columns}


def _serialize_val(val):
    # NB: datetime must be checked before date (it's a date subclass);
    # time is neither — forgetting it made json.dumps 500 on any profile
    # with a reminder_time set.
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (date, time)):
        return val.isoformat()
    return val


def _dump_tables(db: Session) -> dict:
    """Dump all data tables to a JSON-serializable dict."""
    models = [
        Exercise, WorkoutTemplate, WorkoutTemplateExercise,
        WorkoutSession, SessionExercise, ExerciseLog,
        UserProfile, WeightEntry, BodyMeasurement, WellnessCheckin,
        RunEntry, PushSubscription, HealthMetric, HealthWorkout,
    ]
    tables = {}
    for model in models:
        rows = db.query(model).all()
        tables[_table_name(model)] = [_row_to_dict(r) for r in rows]
    return tables


def _do_backup(db: Session, backup_dir: Path) -> dict:
    """Perform a backup, return metadata dict."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "version": BACKUP_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tables": _dump_tables(db),
    }
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    filename = f"fitness-tracker-backup-{ts}.json"
    filepath = backup_dir / filename
    filepath.write_text(json.dumps(data, indent=2))
    size = filepath.stat().st_size
    table_counts = {t: len(rows) for t, rows in data["tables"].items()}
    return {"filename": filename, "path": str(filepath), "size_bytes": size, "table_counts": table_counts}


# ─── Schemas ─────────────────────────────────────────────


class BackupConfigResponse(BaseModel):
    location: str
    interval: str  # disabled, daily, weekly
    last_backup: str | None = None


class BackupConfigUpdate(BaseModel):
    location: str | None = None
    interval: str | None = None  # disabled, daily, weekly


class BackupResultResponse(BaseModel):
    filename: str
    path: str
    size_bytes: int
    table_counts: dict[str, int]


class BackupFileResponse(BaseModel):
    filename: str
    size_bytes: int
    created_at: str
    table_counts: dict[str, int]


class RestoreRequest(BaseModel):
    filename: str


# ─── Config Endpoints ───────────────────────────────────


@router.get("/settings/backup", response_model=BackupConfigResponse)
def get_backup_config():
    config = _load_config()
    return BackupConfigResponse(
        location=config.get("location", DEFAULT_BACKUP_DIR),
        interval=config.get("interval", "disabled"),
        last_backup=config.get("last_backup"),
    )


@router.put("/settings/backup", response_model=BackupConfigResponse)
def update_backup_config(data: BackupConfigUpdate):
    config = _load_config()
    if data.location is not None:
        config["location"] = data.location
    if data.interval is not None:
        if data.interval not in ("disabled", "daily", "weekly"):
            raise HTTPException(400, "interval must be disabled, daily, or weekly")
        config["interval"] = data.interval
    _save_config(config)
    return BackupConfigResponse(
        location=config.get("location", DEFAULT_BACKUP_DIR),
        interval=config.get("interval", "disabled"),
        last_backup=config.get("last_backup"),
    )


# ─── Backup Endpoints ───────────────────────────────────


@router.post("/backup", response_model=BackupResultResponse)
def create_backup(db: Session = Depends(get_db)):
    backup_dir = _get_backup_dir()
    try:
        result = _do_backup(db, backup_dir)
    except OSError as e:
        raise HTTPException(400, f"Backup location '{backup_dir}' is not writable: {e}")
    # Update last_backup timestamp in config
    config = _load_config()
    config["last_backup"] = datetime.now(timezone.utc).isoformat()
    _save_config(config)
    return BackupResultResponse(**result)


@router.get("/backups")
def list_backups() -> list[BackupFileResponse]:
    backup_dir = _get_backup_dir()
    if not backup_dir.exists():
        return []
    files = []
    for f in sorted(backup_dir.glob("fitness-tracker-backup-*.json"), reverse=True):
        try:
            data = json.loads(f.read_text())
            table_counts = {t: len(rows) for t, rows in data.get("tables", {}).items()}
            files.append(BackupFileResponse(
                filename=f.name,
                size_bytes=f.stat().st_size,
                created_at=data.get("created_at", ""),
                table_counts=table_counts,
            ))
        except (json.JSONDecodeError, OSError):
            continue
    return files


@router.post("/backup/restore")
def restore_backup(req: RestoreRequest, db: Session = Depends(get_db)):
    backup_dir = _get_backup_dir()
    filepath = backup_dir / req.filename
    if not filepath.exists():
        raise HTTPException(404, f"Backup file not found: {req.filename}")

    try:
        data = json.loads(filepath.read_text())
    except (json.JSONDecodeError, OSError):
        raise HTTPException(400, "Invalid backup file")

    tables_data = data.get("tables", {})
    if not tables_data:
        raise HTTPException(400, "Backup file contains no table data")

    # Pre-restore safety backup
    try:
        safety_result = _do_backup(db, backup_dir)
    except OSError as e:
        raise HTTPException(400, f"Backup location '{backup_dir}' is not writable: {e}")

    # Table order matters for FK constraints — delete children first. Only
    # tables present in the backup are truncated, so restoring a file from
    # before a table existed (e.g. pre-Apple-Health backups) leaves that
    # table's current rows alone instead of wiping them.
    delete_order = [
        "exercise_logs", "session_exercises", "workout_sessions",
        "workout_template_exercises", "workout_templates",
        "push_subscriptions", "run_entries", "wellness_checkins",
        "body_measurements", "weight_entries", "user_profiles", "exercises",
        "health_metrics", "health_workouts",
    ]

    # Inspect through the session's own connection: a separate engine
    # connection sees a different (empty) database under in-memory SQLite,
    # which silently skipped every DELETE and made re-inserts collide.
    inspector = inspect(db.get_bind())
    existing_tables = set(inspector.get_table_names())

    try:
        # Truncate in order
        for tname in delete_order:
            if tname in existing_tables and tname in tables_data:
                db.execute(text(f"DELETE FROM {tname}"))

        # Insert from backup data (reverse order for FK parents first)
        insert_order = [
            "exercises", "user_profiles", "weight_entries", "body_measurements",
            "wellness_checkins", "run_entries", "push_subscriptions",
            "workout_templates", "workout_template_exercises",
            "workout_sessions", "session_exercises", "exercise_logs",
            "health_metrics", "health_workouts",
        ]

        for tname in insert_order:
            rows = tables_data.get(tname, [])
            if not rows:
                continue
            columns = list(rows[0].keys())
            col_str = ", ".join(columns)
            placeholders = ", ".join([f":{c}" for c in columns])
            stmt = text(f"INSERT INTO {tname} ({col_str}) VALUES ({placeholders})")
            for row in rows:
                db.execute(stmt, row)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Restore of %s failed", req.filename)
        raise HTTPException(500, "Restore failed — data has been rolled back. A safety backup was created.")

    return {
        "status": "restored",
        "safety_backup": safety_result["filename"],
        "table_counts": {t: len(rows) for t, rows in tables_data.items()},
    }
