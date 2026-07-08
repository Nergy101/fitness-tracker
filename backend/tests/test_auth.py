"""Tests for Auth endpoint and middleware."""

import base64
from fastapi.testclient import TestClient

from .conftest import TEST_PASSWORD


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
        assert resp.json() == {"status": "ok"}

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
