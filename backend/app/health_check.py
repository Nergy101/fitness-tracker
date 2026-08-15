"""System health checks for the /api/health endpoint.

Checks actual system state rather than returning a static "ok": database
connectivity, migration status, and disk space. Used by Docker healthchecks
(NER-219) and monitoring. A failed DB check degrades the status but still
returns HTTP 200 so the healthcheck reports "degraded" rather than killing the
container — alerts are handled by monitoring.
"""

from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import inspect, text

from app.database import engine

# Minimum free disk space before we flag a warning (in bytes). Docker healthchecks
# keep passing on "warn" — this is a monitoring signal, not a liveness gate.
MIN_FREE_DISK_BYTES = 100 * 1024 * 1024  # 100 MB

_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")


def _database_status() -> str:
    """Run SELECT 1 against the engine. Returns 'ok' or 'error'."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok"
    except Exception:  # pragma: no cover - exercise via mocked failure in tests
        return "error"


def _migration_head() -> Optional[str]:
    """Return the single Alembic head revision by scanning migration files.

    A valid migration tree has exactly one revision that is not referenced as a
    down_revision by any other migration. Multiple (or zero) heads means the
    migration chain is invalid.
    """
    versions_dir = os.path.join(_BACKEND_DIR, "alembic", "versions")
    revisions: dict[str, str] = {}
    down_references: set[str] = set()
    if not os.path.isdir(versions_dir):
        return None
    for fname in os.listdir(versions_dir):
        if not fname.endswith(".py"):
            continue
        try:
            with open(os.path.join(versions_dir, fname), encoding="utf-8") as f:
                src = f.read()
        except OSError:  # pragma: no cover
            continue
        rev = re.search(r"^revision\s*:\s*str\s*=\s*['\"]([^'\"]+)['\"]", src, re.M)
        down = re.search(
            r"^down_revision\s*:\s*Union\[str, None\]\s*=\s*['\"]([^'\"]+)['\"]",
            src,
            re.M,
        )
        if rev:
            revisions[rev.group(1)] = fname
            if down:
                down_references.add(down.group(1))
    heads = [r for r in revisions if r not in down_references]
    if len(heads) == 1:
        return heads[0]
    return None


def _migrations_status() -> dict:
    """Check that alembic_version exists and is stamped at the migration head.

    Returns a dict with 'status' ('ok'|'error'|'not-applied') and the current
    version for diagnostics. In-memory/test DBs bootstrap their schema directly
    and have no alembic_version table — reported as 'not-applied'.
    """
    try:
        inspector = inspect(engine)
        if "alembic_version" not in set(inspector.get_table_names()):
            return {"status": "not-applied", "current": None}
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).first()
        current = row[0] if row else None
    except Exception:  # pragma: no cover - exercise via mocked failure in tests
        return {"status": "error", "current": None}

    if not current:
        return {"status": "error", "current": None}
    head = _migration_head()
    if head is None:
        # Invalid migration tree (no single head) — flag it.
        return {"status": "error", "current": current}
    if current != head:
        return {"status": "error", "current": current}
    return {"status": "ok", "current": current}


def _disk_status() -> dict:
    """Check free disk space on the data dir. Warn-only; never degrades status.

    Returns 'ok' | 'warn' | 'unknown'. Falls back to the backend dir if /data
    isn't present (local dev).
    """
    candidates = ["/data", _BACKEND_DIR]
    for path in candidates:
        if os.path.isdir(path):
            try:
                usage = shutil.disk_usage(path)
            except OSError:  # pragma: no cover
                continue
            free_bytes = usage.free
            return {
                "status": "ok" if free_bytes >= MIN_FREE_DISK_BYTES else "warn",
                "path": path,
                "free_bytes": free_bytes,
            }
    return {"status": "unknown", "path": None, "free_bytes": None}


@dataclass
class HealthResult:
    """Aggregated health check result."""

    database: str
    migrations: dict = field(default_factory=dict)
    disk: dict = field(default_factory=dict)
    version: Optional[str] = None

    def to_dict(self) -> dict:
        status = "ok"
        if self.database == "error" or self.migrations.get("status") == "error":
            status = "degraded"
        result = {
            "status": status,
            "version": self.version,
            "database": self.database,
            "migrations": self.migrations.get("status", "unknown"),
        }
        # Disk space is warn-only — include but never influence top-level status.
        if self.disk.get("status") not in (None, "unknown"):
            result["disk"] = self.disk
        return result


def run_health_checks(version: str) -> dict:
    """Run all health checks and return the aggregated response dict."""
    result = HealthResult(
        database=_database_status(),
        migrations=_migrations_status(),
        disk=_disk_status(),
        version=version,
    )
    return result.to_dict()
