"""Pytest fixtures for FitnessTracker backend tests.

Fixtures:
- client: FastAPI TestClient with auth headers, in-memory DB, tables created per test
- auth_headers: dict with valid Authorization header
- db: SQLAlchemy session wrapping a transaction that rolls back after each test
"""

import os

# MUST be set BEFORE any app code is imported (settings.py loads on import).
# Force the test password and in-memory DB regardless of CI env.
os.environ["FITNESS_PASSWORD"] = "test-password-123"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# These imports trigger app startup (table creation on the in-memory DB)
from app.database import get_db, engine as app_engine
from app.main import app
from app.models.models import Exercise

TEST_PASSWORD = "test-password-123"


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """Provide a session with in-memory DB. Tables are created once at app import
    and each test gets a transaction that is rolled back automatically."""
    connection = app_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with the test session wired in via dependency override."""

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Valid Basic auth header for the test password."""
    import base64
    raw = f"fitness:{TEST_PASSWORD}"
    token = base64.b64encode(raw.encode()).decode()
    return {"Authorization": f"Basic {token}"}


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Isolate the auth rate limiter between tests (module-global state)."""
    from app.routers.auth import reset_rate_limit

    reset_rate_limit()
    yield


# ─── Helpers ──────────────────────────────────────────────────

@pytest.fixture
def seed_exercise(db: Session) -> Exercise:
    """Create and return a single exercise."""
    ex = Exercise(
        name="Push-up",
        description="A classic push-up",
        category="strength",
        default_kcal_per_min=7.0,
        default_duration_seconds=30,
    )
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


@pytest.fixture
def seed_exercises(db: Session) -> list[Exercise]:
    """Create and return multiple exercises."""
    data = [
        ("Push-up", "strength", 7.0, 30),
        ("Squat", "strength", 6.0, 30),
        ("Jumping Jack", "cardio", 10.0, 30),
        ("Plank", "strength", 5.0, 60),
        ("High Knee", "cardio", 9.0, 30),
    ]
    exercises = []
    for name, cat, kcal, dur in data:
        ex = Exercise(name=name, category=cat, default_kcal_per_min=kcal, default_duration_seconds=dur)
        db.add(ex)
        exercises.append(ex)
    db.commit()
    for ex in exercises:
        db.refresh(ex)
    return exercises
