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
from app.models.models import HealthMetric, HealthWorkout, BoxingEntry, CyclingEntry, InjuryMarker  # noqa: F401

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


def _alembic(db_path, *args: str) -> subprocess.CompletedProcess:
    """Invoke the Alembic CLI against *db_path*.

    Uses the venv binary for the same reason app.database.run_migrations does:
    the local backend/alembic/ directory shadows the installed package, so
    `python -m alembic` cannot be used here.
    """
    return subprocess.run(
        [os.path.join(os.path.dirname(sys.executable), "alembic"), *args],
        cwd=BACKEND_DIR,
        env={
            **os.environ,
            "DATABASE_URL": _db_url(db_path),
            "FITNESS_PASSWORD": "test-password-123",
        },
        capture_output=True,
        text=True,
    )


def _seed_session_with_child_rows(url: str) -> None:
    """Insert a workout_sessions row plus a session_exercises row pointing at
    it.  The child row is the whole point: batch_alter_table() on SQLite drops
    and recreates workout_sessions, which only fails once something references
    it."""
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "INSERT INTO workout_templates "
                    "(id, name, description, rounds, rest_between_rounds) "
                    "VALUES (1, 'Full Body', 'seed', 1, 10)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO workout_sessions "
                    "(id, template_id, template_name, started_at, total_duration_seconds) "
                    "VALUES (1, 1, 'Full Body', '2026-07-01 10:00:00', 100)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO session_exercises "
                    "(id, session_id, exercise_name, duration_seconds, order_index) "
                    "VALUES (1, 1, 'Push Ups', 30, 0)"
                )
            )
            conn.commit()
    finally:
        engine.dispose()


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
            BoxingEntry.__table__.drop(bind=setup_engine)
            CyclingEntry.__table__.drop(bind=setup_engine)
            InjuryMarker.__table__.drop(bind=setup_engine)
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
            BoxingEntry.__table__.drop(bind=setup_engine)
            CyclingEntry.__table__.drop(bind=setup_engine)
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


class TestBatchMigrationsWithChildRows:
    """Production incident defended:

    app.database registers an Engine-wide `PRAGMA foreign_keys=ON` listener.
    Alembic's env.py builds its engine in the same process, so migrations
    inherited FK enforcement.  op.batch_alter_table() emulates ALTER on SQLite
    by copying the table and DROPping the original — which raises
    "FOREIGN KEY constraint failed" as soon as a child row references it.

    Every migration test above ran against an empty database, so the deploy
    that added cycling_entries passed CI and then crash-looped in production
    against real workout_sessions/session_exercises data.  Because pysqlite
    autocommits DDL, the aborted run left cycling_entries behind WITHOUT the
    alembic_version stamp, so each restart re-failed on "table already exists".
    """

    def test_head_migration_survives_populated_child_tables(self, tmp_path):
        """Downgrade one revision from head, then migrate back up with child
        rows present.  Pinned to no specific revision, so it keeps guarding
        whichever migration is newest."""
        db_file = tmp_path / "child_rows.db"
        url = _db_url(db_file)

        assert _run(db_file).returncode == 0
        _seed_session_with_child_rows(url)

        down = _alembic(db_file, "downgrade", "-1")
        assert down.returncode == 0, f"downgrade failed:\n{down.stdout}{down.stderr}"

        proc = _run(db_file)
        diag = proc.stdout + proc.stderr
        assert proc.returncode == 0, (
            f"re-upgrading head with child rows present failed:\n{diag}"
        )

        verify_engine = create_engine(url)
        try:
            with verify_engine.connect() as conn:
                assert conn.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar() == _alembic_head()
                assert conn.execute(
                    text("SELECT COUNT(*) FROM workout_sessions")
                ).scalar() == 1, "session row lost in batch table rebuild"
                assert conn.execute(
                    text("SELECT session_id FROM session_exercises")
                ).scalar() == 1, "child row lost or re-pointed in batch table rebuild"
        finally:
            verify_engine.dispose()

    def test_resumes_half_applied_cycling_migration(self, tmp_path):
        """Exact production crash state: stamped at the cycling migration's
        parent, with BOTH autocommitted leftovers the aborted run left behind —
        the cycling_entries table and the _alembic_tmp_workout_sessions scratch
        table from the batch rebuild that failed on DROP."""
        db_file = tmp_path / "half_applied.db"
        url = _db_url(db_file)

        parent = _alembic(db_file, "upgrade", "e538293b14d1")
        assert parent.returncode == 0, f"{parent.stdout}{parent.stderr}"
        _seed_session_with_child_rows(url)

        setup_engine = create_engine(url)
        try:
            with setup_engine.connect() as conn:
                conn.execute(
                    text(
                        "CREATE TABLE cycling_entries ("
                        "id INTEGER NOT NULL, duration_seconds INTEGER NOT NULL, "
                        "distance_km FLOAT NOT NULL, date DATE NOT NULL, "
                        "notes TEXT, created_at DATETIME, PRIMARY KEY (id))"
                    )
                )
                conn.execute(
                    text("CREATE INDEX ix_cycling_entries_id ON cycling_entries (id)")
                )
                # Scratch table from the batch rebuild that died on DROP TABLE
                # workout_sessions. Empty, because the row copy is DML and got
                # rolled back while the CREATE autocommitted.
                conn.execute(
                    text(
                        "CREATE TABLE _alembic_tmp_workout_sessions ("
                        "id INTEGER NOT NULL, template_id INTEGER, "
                        "template_name VARCHAR(255), started_at DATETIME NOT NULL, "
                        "finished_at DATETIME, total_duration_seconds INTEGER, "
                        "total_kcal_estimated FLOAT, notes TEXT, "
                        "run_entry_id INTEGER, boxing_entry_id INTEGER, "
                        "cycling_entry_id INTEGER, PRIMARY KEY (id))"
                    )
                )
                conn.commit()
        finally:
            setup_engine.dispose()

        proc = _run(db_file)
        diag = proc.stdout + proc.stderr
        assert proc.returncode == 0, f"half-applied DB did not self-heal:\n{diag}"

        verify_engine = create_engine(url)
        try:
            with verify_engine.connect() as conn:
                assert conn.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar() == _alembic_head()
                assert conn.execute(
                    text("SELECT COUNT(*) FROM session_exercises")
                ).scalar() == 1
            names = set(inspect(verify_engine).get_table_names())
            cols = {
                c["name"]
                for c in inspect(verify_engine).get_columns("workout_sessions")
            }
            assert "cycling_entry_id" in cols, (
                "resumed migration skipped the workout_sessions column"
            )
            assert "_alembic_tmp_workout_sessions" not in names, (
                "scratch table from the crashed batch rebuild was left behind"
            )
        finally:
            verify_engine.dispose()

    def test_recovers_scratch_table_when_real_table_was_dropped(self, tmp_path):
        """The data-loss-adjacent branch: a batch rebuild that crashed between
        DROP TABLE X and RENAME leaves the scratch table holding the only copy
        of the rows.  It must be renamed into place, never dropped."""
        db_file = tmp_path / "mid_rename.db"
        url = _db_url(db_file)

        assert _run(db_file).returncode == 0
        _seed_session_with_child_rows(url)

        setup_engine = create_engine(url)
        try:
            with setup_engine.connect() as conn:
                conn.execute(text("PRAGMA foreign_keys=OFF"))
                conn.execute(
                    text(
                        "CREATE TABLE _alembic_tmp_workout_sessions AS "
                        "SELECT * FROM workout_sessions"
                    )
                )
                conn.execute(text("DROP TABLE workout_sessions"))
                conn.commit()
        finally:
            setup_engine.dispose()

        proc = _run(db_file)
        diag = proc.stdout + proc.stderr
        assert proc.returncode == 0, f"mid-rename DB did not self-heal:\n{diag}"

        verify_engine = create_engine(url)
        try:
            names = set(inspect(verify_engine).get_table_names())
            assert "workout_sessions" in names, "scratch table was not renamed back"
            assert "_alembic_tmp_workout_sessions" not in names
            with verify_engine.connect() as conn:
                assert conn.execute(
                    text("SELECT COUNT(*) FROM workout_sessions")
                ).scalar() == 1, "rows were lost recovering the scratch table"
        finally:
            verify_engine.dispose()
