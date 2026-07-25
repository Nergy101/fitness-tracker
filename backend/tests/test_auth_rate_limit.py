"""Tests verifying that Bearer 401s do not consume the auth rate limit budget.

The auth middleware only rate-limits Basic auth failures (password guessing).
Bearer token failures (expired/revoked tokens) must NOT count toward the rate
limiter — otherwise concurrent 401s from old tokens would fill the limiter and
lock users out of the login endpoint entirely (NER-177 / NER-225).
"""

import base64

from fastapi.testclient import TestClient

from .conftest import TEST_PASSWORD
from app.routers.auth import MAX_FAILED_ATTEMPTS


class TestBearer401DoesNotConsumeRateLimit:
    """Bearer token 401s must not count toward rate limit budget."""

    PROTECTED_URL = "/api/v1/exercises"
    LOGIN_URL = "/api/auth/login"

    def test_bearer_401s_do_not_trigger_rate_limit(self, client: TestClient):
        """Multiple Bearer failures should NOT cause lockout — password login still works."""
        for _ in range(MAX_FAILED_ATTEMPTS + 5):
            resp = client.get(
                self.PROTECTED_URL,
                headers={"Authorization": "Bearer invalid_token_xyz"},
            )
            assert resp.status_code == 401

        # Password login must still succeed
        resp = client.post(self.LOGIN_URL, json={"password": TEST_PASSWORD})
        assert resp.status_code == 200

    def test_bearer_401s_do_not_contribute_to_basic_limit(self, client: TestClient):
        """Bearer failures don't count toward the Basic auth limit.
        
        If Bearer 401s consumed the budget, the 3 Bearer failures + 2 Basic failures
        would fill the limiter. Only Basic failures should count.
        """
        # Sprinkle some Bearer failures first
        for _ in range(3):
            client.get(
                self.PROTECTED_URL,
                headers={"Authorization": "Bearer invalid_token_xyz"},
            )

        # Now make exactly MAX_FAILED_ATTEMPTS Basic auth failures — each returns 401
        token = base64.b64encode(b"fitness:wrong").decode()
        basic_headers = {"Authorization": f"Basic {token}"}
        for _ in range(MAX_FAILED_ATTEMPTS):
            resp = client.get(self.PROTECTED_URL, headers=basic_headers)
            assert resp.status_code == 401

        # The (MAX_FAILED_ATTEMPTS + 1)th request triggers the lockout
        resp = client.get(self.PROTECTED_URL, headers=basic_headers)
        assert resp.status_code == 429

        # Even correct password is locked out
        correct = base64.b64encode(f"fitness:{TEST_PASSWORD}".encode()).decode()
        resp = client.get(
            self.PROTECTED_URL,
            headers={"Authorization": f"Basic {correct}"},
        )
        assert resp.status_code == 429

    def test_bearer_flood_does_not_lock_out(self, client: TestClient):
        """A flood of 50 Bearer failures must not trigger rate limit."""
        for _ in range(50):
            client.get(
                self.PROTECTED_URL,
                headers={"Authorization": "Bearer invalid_token_xyz"},
            )

        resp = client.post(self.LOGIN_URL, json={"password": TEST_PASSWORD})
        assert resp.status_code == 200

    def test_middleware_bearer_auth_does_not_record_failure(self, client: TestClient):
        """Bearer token auth that passes but token is invalid returns 401,
        does NOT call record_failure, and does not affect rate limit."""
        for _ in range(MAX_FAILED_ATTEMPTS * 2):
            client.get(
                self.PROTECTED_URL,
                headers={"Authorization": "Bearer completely_invalid_token"},
            )

        # Login must still work — no rate limit triggered
        resp = client.post(self.LOGIN_URL, json={"password": TEST_PASSWORD})
        assert resp.status_code == 200
