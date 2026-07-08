"""Regression tests for run_migrations() pre-Alembic adoption path.

Production incident defended:
  A SQLite DB created by an old release via Base.metadata.create_all (tables +
  data, no alembic_version stamp) made `alembic upgrade head` crash-loop with
  "table exercises already exists".  Worse variant: alembic_version table EXISTS
  but is EMPTY (alembic created it, then died mid-migration).

  The fix stamps PRE_ALEMBIC_BASELINE when tables exist but no version row,
  then runs upgrade head.

Each test uses a tmp_path SQLite file and invokes run_migrations() in a
subprocess, because conftest.py binds the in-process engine to
sqlite:///:memory: before any app imports and it cannot be repointed.
"""

import os
import subprocess
import sys

from sqlalchemy import create_engine, inspect, text

# conftest.py already imported app modules; these are cache hits.
from app.database import Base
import app.models.models  # noqa: F401 — ensures Base.metadata is fully populated
from app.models.models import HealthMetric, HealthWorkout  # noqa: F401

# backend/ directory — alembic.ini lives here and '' in sys.path resolves here.
BACKEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _db_url(db_path) -> str:
    """Absolute SQLite URL.  str(db_path) starts with '/', so three slashes
    in the scheme plus the leading '/' of the path gives the required four."""
    return f"sqlite:///{db_path}"


def _alembic_head() -> str:
    """Current Alembic head revision, derived by parsing the migration files.
    (Importing `alembic` in-process fails here: the local backend/alembic/
    migrations dir shadows the installed package on sys.path.)"""
    import glob
    import re

    revisions, down_revisions = set(), set()
    for path in glob.glob(os.path.join(BACKEND_DIR, "alembic", "versions", "*.py")):
        with open(path) as fh:
            txt = fh.read()
        r = re.search(r'^revision\b.*?=\s*[\'"]([0-9a-fA-F]+)[\'"]', txt, re.M)
        d = re.search(r'^down_revision\b.*?=\s*[\'"]([0-9a-fA-F]+)[\'"]', txt, re.M)
        if r:
            revisions.add(r.group(1))
        if d:
            down_revisions.add(d.group(1))
    heads = revisions - down_revisions
    assert len(heads) == 1, f"expected a single head, found {heads}"
    return heads.pop()


def _run(db_path) -> subprocess.CompletedProcess:
    """Invoke run_migrations() in a child process against *db_path*."""
    return subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.database import run_migrations; run_migrations()",
        ],
        cwd=BACKEND_DIR,
        env={
            **os.environ,
            "DATABASE_URL": _db_url(db_path),
            # FITNESS_PASSWORD is required by app.config at import time.
            "FITNESS_PASSWORD": "test-password-123",
        },
        capture_output=True,
        text=True,
    )


# ─── Tests ────────────────────────────────────────────────────────────────────


class TestRunMigrations:

    def test_pre_alembic_no_version_table(self, tmp_path):
        """Tables from create_all (no alembic_version table) + one data row:
        - subprocess exits 0
        - alembic_version stamped at PRE_ALEMBIC_BASELINE (which is also head)
        - pre-existing data row survives unchanged
        """
        db_file = tmp_path / "pre_alembic.db"
        url = _db_url(db_file)

        # Simulate an old release: schema without migration tracking.
        setup_engine = create_engine(url)
        try:
            Base.metadata.create_all(bind=setup_engine)
            # An old release predates the health_* tables; drop them so the DB
            # faithfully matches a pre-Alembic BASELINE schema (adoption then
            # stamps baseline and `upgrade head` creates them).
            HealthMetric.__table__.drop(bind=setup_engine)
            HealthWorkout.__table__.drop(bind=setup_engine)
            with setup_engine.connect() as conn:
                conn.execute(
                    text(
                        "INSERT INTO exercises "
                        "(name, description, category, default_kcal_per_min, default_duration_seconds) "
                        "VALUES ('Squat', 'Leg press', 'strength', 5.0, 60)"
                    )
                )
                conn.commit()
        finally:
            setup_engine.dispose()

        proc = _run(db_file)
        diag = proc.stdout + proc.stderr
        assert proc.returncode == 0, f"run_migrations() failed:\n{diag}"

        verify_engine = create_engine(url)
        try:
            with verify_engine.connect() as conn:
                version = conn.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar()
                head = _alembic_head()
                assert version == head, (
                    f"Expected head stamp {head!r}, got {version!r}"
                )
                assert "health_metrics" in inspect(verify_engine).get_table_names(), (
                    "post-baseline migration did not run during adoption"
                )

                count = conn.execute(
                    text("SELECT COUNT(*) FROM exercises WHERE name = 'Squat'")
                ).scalar()
                assert count == 1, "Pre-existing exercise row was lost during migration"
        finally:
            verify_engine.dispose()

    def test_interrupted_adoption_empty_version_table(self, tmp_path):
        """alembic_version table EXISTS but has NO rows (exact production crash
        state: alembic created the table, then died before the stamp INSERT
        committed):
        - subprocess exits 0
        - alembic_version stamped at PRE_ALEMBIC_BASELINE
        - pre-existing data row survives
        """
        db_file = tmp_path / "interrupted.db"
        url = _db_url(db_file)

        setup_engine = create_engine(url)
        try:
            Base.metadata.create_all(bind=setup_engine)
            HealthMetric.__table__.drop(bind=setup_engine)
            HealthWorkout.__table__.drop(bind=setup_engine)
            with setup_engine.connect() as conn:
                # alembic_version with Alembic's real DDL but zero rows.
                conn.execute(
                    text(
                        "CREATE TABLE alembic_version ("
                        "version_num VARCHAR(32) NOT NULL, "
                        "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
                    )
                )
                conn.execute(
                    text(
                        "INSERT INTO exercises "
                        "(name, description, category, default_kcal_per_min, default_duration_seconds) "
                        "VALUES ('Deadlift', 'Hip hinge', 'strength', 6.0, 45)"
                    )
                )
                conn.commit()
        finally:
            setup_engine.dispose()

        proc = _run(db_file)
        diag = proc.stdout + proc.stderr
        assert proc.returncode == 0, f"run_migrations() failed:\n{diag}"

        verify_engine = create_engine(url)
        try:
            with verify_engine.connect() as conn:
                version = conn.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar()
                head = _alembic_head()
                assert version == head, (
                    f"Expected head stamp {head!r}, got {version!r}"
                )
                assert "health_metrics" in inspect(verify_engine).get_table_names(), (
                    "post-baseline migration did not run during adoption"
                )

                count = conn.execute(
                    text("SELECT COUNT(*) FROM exercises WHERE name = 'Deadlift'")
                ).scalar()
                assert count == 1, "Pre-existing exercise row was lost during migration"
        finally:
            verify_engine.dispose()

    def test_fresh_empty_db(self, tmp_path):
        """No existing tables (fresh install, db_file does not exist yet):
        - subprocess exits 0
        - exercises table created by alembic upgrade head
        - alembic_version stamped at head (== PRE_ALEMBIC_BASELINE, the sole migration)
        """
        db_file = tmp_path / "fresh.db"  # does not exist; SQLite creates on first connect

        proc = _run(db_file)
        diag = proc.stdout + proc.stderr
        assert proc.returncode == 0, f"run_migrations() on fresh DB failed:\n{diag}"

        verify_engine = create_engine(_db_url(db_file))
        try:
            table_names = set(inspect(verify_engine).get_table_names())
            assert "exercises" in table_names, (
                f"exercises table missing after upgrade head; found: {sorted(table_names)}"
            )

            with verify_engine.connect() as conn:
                version = conn.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar()
            head = _alembic_head()
            assert version == head, (
                f"Expected head stamp {head!r}, got {version!r}"
            )
        finally:
            verify_engine.dispose()
