"""Backup and restore router — JSON dumps of all data tables.

Backup path comes from settings.toml ([backup] path) and cannot be
changed via the API. Only the interval (disabled/daily/weekly) and
the last_backup timestamp are managed through the settings endpoint.
"""

import json
import os
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
    RunEntry, BoxingEntry, PushSubscription, HealthMetric, HealthWorkout,
)
from app.settings import settings

# Every data table, in FK-safe insert order (parents before children). Used
# for dumps and to validate/spell restore statements.
BACKUP_MODELS = [
    Exercise, UserProfile, WeightEntry, BodyMeasurement, WellnessCheckin,
    RunEntry, BoxingEntry, PushSubscription,
    WorkoutTemplate, WorkoutTemplateExercise,
    WorkoutSession, SessionExercise, ExerciseLog,
    HealthMetric, HealthWorkout,
]
# table name -> allowed column names (guards restore against injected columns).
ALLOWED_COLUMNS: dict[str, set[str]] = {
    m.__tablename__: {c.key for c in m.__table__.columns} for m in BACKUP_MODELS
}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["backup"])

CONFIG_FILENAME = "backup_config.json"
# Persisted alongside data (set FITNESS_BACKUP_CONFIG_PATH to /data/... in
# Docker); defaults to the working dir for local/dev/test runs.
CONFIG_PATH = Path(os.getenv("FITNESS_BACKUP_CONFIG_PATH", CONFIG_FILENAME))
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
    """Read backup directory from settings.toml [backup] path.

    FITNESS_BACKUP_PATH env var overrides settings.toml (for tests/Docker).
    """
    env_path = os.getenv("FITNESS_BACKUP_PATH")
    if env_path:
        return Path(env_path)
    backup_settings = settings.get("backup", {})
    path = backup_settings.get("path", "/backups")
    return Path(path)


def _table_name(model) -> str:
    return model.__tablename__


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict."""
    return {c.key: _serialize_val(getattr(row, c.key)) for c in row.__table__.columns}


def _serialize_val(val):
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (date, time)):
        return val.isoformat()
    return val


def _dump_tables(db: Session) -> dict:
    """Dump all data tables to a JSON-serializable dict."""
    tables = {}
    for model in BACKUP_MODELS:
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
    location: str      # read-only, from settings.toml
    interval: str      # disabled, daily, weekly (settable via API)
    last_backup: str | None = None


class BackupConfigUpdate(BaseModel):
    interval: str | None = None  # only field the frontend can change


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
        location=str(_get_backup_dir()),
        interval=config.get("interval", "disabled"),
        last_backup=config.get("last_backup"),
    )


@router.put("/settings/backup", response_model=BackupConfigResponse)
def update_backup_config(data: BackupConfigUpdate):
    config = _load_config()
    if data.interval is not None:
        if data.interval not in ("disabled", "daily", "weekly"):
            raise HTTPException(400, "interval must be disabled, daily, or weekly")
        config["interval"] = data.interval
    _save_config(config)
    return BackupConfigResponse(
        location=str(_get_backup_dir()),
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
    # Reject path traversal / absolute paths: restore only reads files that
    # live directly inside the backup dir.
    name = req.filename
    if not name or "/" in name or "\\" in name or ".." in name or Path(name).is_absolute():
        raise HTTPException(400, "Invalid backup filename")
    filepath = (backup_dir / name).resolve()
    if filepath.parent != backup_dir.resolve() or not filepath.is_file():
        raise HTTPException(404, f"Backup file not found: {name}")

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

    # children → parents for deletes (respects FK constraints once enforced).
    delete_order = [
        "exercise_logs", "session_exercises", "workout_sessions",
        "workout_template_exercises", "workout_templates",
        "push_subscriptions", "run_entries", "boxing_entries", "wellness_checkins",
        "body_measurements", "weight_entries", "user_profiles", "exercises",
        "health_metrics", "health_workouts",
    ]

    inspector = inspect(db.get_bind())
    existing_tables = set(inspector.get_table_names())

    try:
        for tname in delete_order:
            if tname in existing_tables and tname in tables_data:
                db.execute(text(f"DELETE FROM {tname}"))

        # parents → children for inserts. workout_sessions references both
        # run_entries and boxing_entries, so those precede it.
        insert_order = [
            "exercises", "user_profiles", "weight_entries", "body_measurements",
            "wellness_checkins", "run_entries", "boxing_entries", "push_subscriptions",
            "workout_templates", "workout_template_exercises",
            "workout_sessions", "session_exercises", "exercise_logs",
            "health_metrics", "health_workouts",
        ]

        for tname in insert_order:
            rows = tables_data.get(tname, [])
            if not rows:
                continue
            allowed = ALLOWED_COLUMNS.get(tname)
            if allowed is None:
                raise HTTPException(400, f"Unknown table in backup: {tname}")
            # Only insert known columns; reject any unexpected key (guards the
            # column-name interpolation below against injection / typos).
            columns = [c for c in rows[0].keys() if c in allowed]
            unknown = set(rows[0].keys()) - allowed
            if unknown:
                raise HTTPException(400, f"Unknown columns for {tname}: {sorted(unknown)}")
            col_str = ", ".join(columns)
            placeholders = ", ".join([f":{c}" for c in columns])
            stmt = text(f"INSERT INTO {tname} ({col_str}) VALUES ({placeholders})")
            for row in rows:
                db.execute(stmt, {c: row.get(c) for c in columns})

        db.commit()
    except HTTPException:
        # A validation error (bad table/column): roll back and surface as-is.
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Restore of %s failed", req.filename)
        raise HTTPException(500, "Restore failed — data has been rolled back. A safety backup was created.")

    return {
        "status": "restored",
        "safety_backup": safety_result["filename"],
        "table_counts": {t: len(rows) for t, rows in tables_data.items()},
    }


@router.delete("/backups/{filename}")
def delete_backup(filename: str):
    """Delete a backup file by filename."""
    backup_dir = _get_backup_dir()
    # Reject path traversal
    if not filename or "/" in filename or "\\" in filename or ".." in filename or Path(filename).is_absolute():
        raise HTTPException(400, "Invalid backup filename")
    filepath = (backup_dir / filename).resolve()
    if filepath.parent != backup_dir.resolve() or not filepath.is_file():
        raise HTTPException(404, f"Backup file not found: {filename}")
    if not filename.startswith("fitness-tracker-backup-") or not filename.endswith(".json"):
        raise HTTPException(400, "Invalid backup filename")
    try:
        filepath.unlink()
    except OSError as e:
        raise HTTPException(500, f"Failed to delete backup: {e}")
    return {"status": "deleted", "filename": filename}


# ─── Scheduler ───────────────────────────────────────────

_INTERVAL_SECONDS = {"daily": 24 * 3600, "weekly": 7 * 24 * 3600}


def _backup_due(config: dict, now: datetime) -> bool:
    """Whether an automatic backup should run given the saved config."""
    period = _INTERVAL_SECONDS.get(config.get("interval", "disabled"))
    if period is None:
        return False  # disabled / unknown
    last = config.get("last_backup")
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(last)
    except (ValueError, TypeError):
        return True
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)
    return (now - last_dt).total_seconds() >= period


def run_scheduled_backup_once() -> bool:
    """Run one due-check and back up if needed. Returns True if it backed up.

    Opens its own DB session (runs outside a request). Never raises — logs and
    returns False on error so the scheduler loop keeps running.
    """
    from app.database import SessionLocal

    try:
        config = _load_config()
        if not _backup_due(config, datetime.now(timezone.utc)):
            return False
        db = SessionLocal()
        try:
            _do_backup(db, _get_backup_dir())
        finally:
            db.close()
        config["last_backup"] = datetime.now(timezone.utc).isoformat()
        _save_config(config)
        logger.info("Scheduled backup completed (interval=%s)", config.get("interval"))
        return True
    except Exception:
        logger.exception("Scheduled backup failed")
        return False


async def scheduler_loop(poll_seconds: int = 3600) -> None:
    """Background loop: check hourly whether a scheduled backup is due."""
    import asyncio

    while True:
        await asyncio.to_thread(run_scheduled_backup_once)
        await asyncio.sleep(poll_seconds)