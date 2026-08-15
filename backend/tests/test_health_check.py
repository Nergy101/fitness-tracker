"""Tests for the /api/health endpoint and its system health checks (NER-239)."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.health_check import run_health_checks


class TestHealthCheckHelpers:
    """Unit tests for the individual health check functions via run_health_checks."""

    def test_returns_status_ok_when_all_green(self):
        """Database ok + migrations ok => top-level status ok."""
        with (
            patch("app.health_check._database_status", return_value="ok"),
            patch(
                "app.health_check._migrations_status",
                return_value={"status": "ok", "current": "abc123"},
            ),
            patch(
                "app.health_check._disk_status",
                return_value={"status": "ok", "path": "/data", "free_bytes": 1_000_000_000},
            ),
        ):
            result = run_health_checks("1.2.0")

        assert result["status"] == "ok"
        assert result["version"] == "1.2.0"
        assert result["database"] == "ok"
        assert result["migrations"] == "ok"
        assert result["disk"] == {"status": "ok", "path": "/data", "free_bytes": 1_000_000_000}

    def test_degraded_when_database_error(self):
        """Failed DB check degrades status (still HTTP 200 downstream)."""
        with (
            patch("app.health_check._database_status", return_value="error"),
            patch(
                "app.health_check._migrations_status",
                return_value={"status": "ok", "current": "abc123"},
            ),
            patch("app.health_check._disk_status", return_value={"status": "unknown", "path": None, "free_bytes": None}),
        ):
            result = run_health_checks("1.2.0")

        assert result["status"] == "degraded"
        assert result["database"] == "error"

    def test_degraded_when_migrations_error(self):
        """Failed migration check degrades status."""
        with (
            patch("app.health_check._database_status", return_value="ok"),
            patch(
                "app.health_check._migrations_status",
                return_value={"status": "error", "current": "stale"},
            ),
            patch("app.health_check._disk_status", return_value={"status": "unknown", "path": None, "free_bytes": None}),
        ):
            result = run_health_checks("1.2.0")

        assert result["status"] == "degraded"
        assert result["migrations"] == "error"

    def test_disk_warn_does_not_degrade(self):
        """Disk warnings are monitor-only and never degrade top-level status."""
        with (
            patch("app.health_check._database_status", return_value="ok"),
            patch(
                "app.health_check._migrations_status",
                return_value={"status": "ok", "current": "abc123"},
            ),
            patch(
                "app.health_check._disk_status",
                return_value={"status": "warn", "path": "/data", "free_bytes": 50_000_000},
            ),
        ):
            result = run_health_checks("1.2.0")

        assert result["status"] == "ok"
        assert result["disk"] == {"status": "warn", "path": "/data", "free_bytes": 50_000_000}


class TestHealthEndpoint:
    """Integration tests for GET /api/health via the TestClient."""

    URL = "/api/health"

    def test_public_no_auth(self, client: TestClient):
        """Health is public — no auth header required."""
        resp = client.get(self.URL)
        assert resp.status_code == 200

    def test_response_shape(self, client: TestClient):
        """Response is additive with the expected keys, always HTTP 200."""
        resp = client.get(self.URL)
        assert resp.status_code == 200
        data = resp.json()
        assert set(data) >= {"status", "version", "database", "migrations"}
        assert data["status"] in ("ok", "degraded")
        assert data["version"] == "1.2.0"

    def test_database_check(self, client: TestClient):
        """Database check runs SELECT 1 against the live engine."""
        # In the in-memory test DB, SELECT 1 always succeeds.
        assert client.get(self.URL).json()["database"] == "ok"

    def test_migration_checks_not_applied_on_memory_db(self, client: TestClient):
        """In-memory test DB uses create_all, so no alembic_version table.

        The migrations status must be reported as 'not-applied' (never crash).
        """
        resp = client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["migrations"] == "not-applied"
