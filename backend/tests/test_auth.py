"""Tests for Auth endpoint and middleware."""

import base64
import time

from fastapi.testclient import TestClient

from .conftest import TEST_PASSWORD
from app.routers.auth import (
    MAX_FAILED_ATTEMPTS,
    TOKEN_TTL_SECONDS,
    issue_token,
    revoke_token,
    validate_token,
)
from app.models.models import AuthToken


class TestLogin:
    URL = "/api/auth/login"

    def test_login_success(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={"password": TEST_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["message"] == "Authenticated successfully"

    def test_login_wrong_password(self, client: TestClient):
        resp = client.post(self.URL, json={"password": "wrong-password"})
        assert resp.status_code == 401
        assert "Wrong password" in resp.json()["detail"]

    def test_login_empty_password(self, client: TestClient):
        resp = client.post(self.URL, json={"password": ""})
        assert resp.status_code == 401


class TestAuthMiddleware:
    """Tests that the auth middleware protects /api/v1/* routes."""

    PUBLIC_HEALTH = "/api/health"
    PROTECTED_URL = "/api/v1/exercises"

    def test_health_public(self, client: TestClient):
        """Health check should be public."""
        resp = client.get(self.PUBLIC_HEALTH)
        assert resp.status_code == 200
        data = resp.json()
        # The health payload is additive — status is present and public (no auth).
        assert data["status"] in ("ok", "degraded")
        assert "version" in data
        assert "database" in data
        assert "migrations" in data

    def test_auth_login_public(self, client: TestClient):
        """Auth endpoint should be public."""
        resp = client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 401  # wrong pw, but the endpoint is reachable

    def test_protected_no_auth(self, client: TestClient):
        """Protected route without auth header returns 401."""
        resp = client.get(self.PROTECTED_URL)
        assert resp.status_code == 401
        assert "missing" in resp.json()["detail"].lower()

    def test_protected_invalid_token(self, client: TestClient):
        """Invalid auth format returns 401."""
        resp = client.get(self.PROTECTED_URL, headers={"Authorization": "Basic invalidbase64!"})
        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()

    def test_protected_wrong_password(self, client: TestClient):
        """Auth with wrong password returns 401."""
        raw = "fitness:wrongpassword"
        token = base64.b64encode(raw.encode()).decode()
        resp = client.get(self.PROTECTED_URL, headers={"Authorization": f"Basic {token}"})
        assert resp.status_code == 401

    def test_protected_valid_auth(self, client: TestClient, auth_headers: dict):
        """Valid auth token allows access."""
        resp = client.get(self.PROTECTED_URL, headers=auth_headers)
        assert resp.status_code == 200  # empty list is fine

    def test_protected_bare_password_token(self, client: TestClient):
        """A Basic token of just the password (no 'user:' prefix) is accepted,
        since the username is ignored — matches hand-configured automation headers."""
        token = base64.b64encode(TEST_PASSWORD.encode()).decode()
        resp = client.get(self.PROTECTED_URL, headers={"Authorization": f"Basic {token}"})
        assert resp.status_code == 200

    def test_protected_no_bearer_prefix(self, client: TestClient):
        """Missing 'Basic ' prefix (wrong scheme) returns 401."""
        raw = f"fitness:{TEST_PASSWORD}"
        token = base64.b64encode(raw.encode()).decode()
        resp = client.get(self.PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_options_passes_through(self, client: TestClient):
        """CORS preflight OPTIONS requests should pass through auth."""
        resp = client.options(self.PROTECTED_URL)
        # Returns 405 (Method Not Allowed) since no OPTIONS handler is registered,
        # but crucially does NOT return 401 — auth middleware lets it through.
        assert resp.status_code == 405

    def test_bad_format_raises_401(self, client: TestClient):
        """Garbage in the Basic token raises 401."""
        resp = client.get(self.PROTECTED_URL, headers={"Authorization": "Basic this-is-not-base64!!!"})
        assert resp.status_code == 401


class TestRateLimit:
    """The login endpoint and auth middleware lock out brute-force attempts."""

    URL = "/api/auth/login"
    PROTECTED_URL = "/api/v1/exercises"

    def test_login_locks_out_after_threshold(self, client: TestClient):
        for _ in range(MAX_FAILED_ATTEMPTS):
            assert client.post(self.URL, json={"password": "nope"}).status_code == 401
        locked = client.post(self.URL, json={"password": "nope"})
        assert locked.status_code == 429
        assert "Retry-After" in locked.headers
        # Even the correct password is refused while locked out.
        assert client.post(self.URL, json={"password": TEST_PASSWORD}).status_code == 429

    def test_login_success_resets_failure_count(self, client: TestClient):
        for _ in range(MAX_FAILED_ATTEMPTS - 1):
            assert client.post(self.URL, json={"password": "nope"}).status_code == 401
        # A success clears the counter...
        assert client.post(self.URL, json={"password": TEST_PASSWORD}).status_code == 200
        # ...so the next wrong attempt is a plain 401, not a lockout.
        assert client.post(self.URL, json={"password": "nope"}).status_code == 401

    def test_middleware_locks_out_password_brute_force(self, client: TestClient):
        token = base64.b64encode(b"fitness:wrong").decode()
        headers = {"Authorization": f"Basic {token}"}
        for _ in range(MAX_FAILED_ATTEMPTS):
            assert client.get(self.PROTECTED_URL, headers=headers).status_code == 401
        assert client.get(self.PROTECTED_URL, headers=headers).status_code == 429


class TestTokenPersistence:
    """Session tokens are stored in the DB (AuthToken) so they survive a
    backend restart instead of living only in process memory."""

    PROTECTED_URL = "/api/v1/exercises"

    def test_issued_token_is_persisted_in_db(self, client: TestClient, db):
        token = issue_token()
        row = db.get(AuthToken, token)
        assert row is not None
        # Sliding-window TTL is stored as float epoch seconds.
        assert row.expires_at > time.time()
        assert row.expires_at <= time.time() + TOKEN_TTL_SECONDS + 1

    def test_login_token_row_authorizes_request(self, client: TestClient, db):
        resp = client.post("/api/auth/login", json={"password": TEST_PASSWORD})
        token = resp.json()["token"]
        assert db.get(AuthToken, token) is not None
        ok = client.get(
            self.PROTECTED_URL, headers={"Authorization": f"Bearer {token}"}
        )
        assert ok.status_code == 200

    def test_validate_refreshes_sliding_ttl(self, client: TestClient, db):
        token = issue_token()
        # Backdate the stored expiry so a successful validate must push it out.
        row = db.get(AuthToken, token)
        row.expires_at = time.time() + 5
        db.commit()

        assert validate_token(token) is True
        db.expire_all()
        refreshed = db.get(AuthToken, token)
        assert refreshed.expires_at > time.time() + TOKEN_TTL_SECONDS - 5

    def test_expired_token_is_rejected_and_removed(self, client: TestClient, db):
        db.add(AuthToken(token="stale-token", expires_at=time.time() - 1))
        db.commit()

        assert validate_token("stale-token") is False
        db.expire_all()
        assert db.get(AuthToken, "stale-token") is None

    def test_revoke_removes_token_from_db(self, client: TestClient, db):
        token = issue_token()
        assert db.get(AuthToken, token) is not None

        revoke_token(token)
        db.expire_all()
        assert db.get(AuthToken, token) is None
        assert validate_token(token) is False
