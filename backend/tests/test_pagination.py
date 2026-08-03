"""Tests for limit/offset pagination on list endpoints (NER-230).

Every list endpoint accepts `limit` / `offset` query params and reports the
true total via the `X-Total-Count` response header, so clients can compute
`has_more` without a shape-breaking envelope. Aggregating endpoints (stats,
PRs, trends) are not paginated.
"""

from fastapi.testclient import TestClient


class TestRunsPagination:
    URL = "/api/v1/runs"

    def test_default_returns_all(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "X-Total-Count" in resp.headers
        assert len(data) == int(resp.headers["X-Total-Count"])

    def test_limit_slices(self, client: TestClient, auth_headers: dict):
        for i in range(5):
            client.post(self.URL, json={
                "duration_seconds": 600 + i * 100,
                "distance_km": 2.0 + i,
                "date": f"2026-07-{i + 1:02d}",
            }, headers=auth_headers)
        resp = client.get(f"{self.URL}?limit=2", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        assert int(resp.headers["X-Total-Count"]) == 5

    def test_offset_skips(self, client: TestClient, auth_headers: dict):
        for i in range(3):
            client.post(self.URL, json={
                "duration_seconds": 600,
                "distance_km": 2.0 + i,
                "date": f"2026-07-{i + 1:02d}",
            }, headers=auth_headers)
        resp = client.get(f"{self.URL}?limit=2&offset=2", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert int(resp.headers["X-Total-Count"]) == 3


class TestBoxingPagination:
    URL = "/api/v1/boxing"

    def test_limit_and_total_header(self, client: TestClient, auth_headers: dict):
        for i in range(4):
            client.post(self.URL, json={
                "duration_seconds": 1800,
                "kcal_per_min": 10,
                "date": f"2026-07-{i + 1:02d}",
            }, headers=auth_headers)
        resp = client.get(f"{self.URL}?limit=3", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 3
        assert int(resp.headers["X-Total-Count"]) == 4


class TestCyclingPagination:
    URL = "/api/v1/cycling"

    def test_limit_and_total_header(self, client: TestClient, auth_headers: dict):
        for i in range(4):
            client.post(self.URL, json={
                "duration_seconds": 1800,
                "distance_km": 10.0 + i,
                "date": f"2026-07-{i + 1:02d}",
            }, headers=auth_headers)
        resp = client.get(f"{self.URL}?limit=2&offset=2", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        assert int(resp.headers["X-Total-Count"]) == 4


class TestExercisesPagination:
    URL = "/api/v1/exercises"

    def test_limit_and_search_combined(self, client: TestClient, auth_headers: dict):
        # Seed data always has exercises; just verify slicing + header work.
        resp = client.get(f"{self.URL}?limit=5", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) <= 5
        assert "X-Total-Count" in resp.headers

        resp_search = client.get(f"{self.URL}?search=Push&limit=2", headers=auth_headers)
        assert resp_search.status_code == 200
        assert len(resp_search.json()) <= 2


class TestWorkoutsPagination:
    URL = "/api/v1/workouts"

    def test_limit_and_total_header(self, client: TestClient, auth_headers: dict):
        resp = client.get(f"{self.URL}?limit=1", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) <= 1
        assert "X-Total-Count" in resp.headers


class TestSessionsPagination:
    URL = "/api/v1/sessions"

    def test_pagination_metadata_header(self, client: TestClient, auth_headers: dict):
        for i in range(3):
            client.post(self.URL, json={
                "template_name": f"paging-{i}",
                "started_at": f"2026-07-0{i + 1}T08:00:00",
                "total_duration_seconds": 600,
                "total_kcal_estimated": 100,
                "exercises": [{
                    "exercise_name": f"ex-{i}",
                    "duration_seconds": 600,
                    "kcal_burned": 100,
                    "order_index": 0,
                    "completed": True,
                }],
            }, headers=auth_headers)
        resp = client.get(f"{self.URL}?limit=2&offset=0", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        assert int(resp.headers["X-Total-Count"]) >= 3


class TestHealthPagination:
    def test_weight(self, client: TestClient, auth_headers: dict):
        for i in range(3):
            client.post("/api/v1/health/weight", json={
                "weight_kg": 80.0 + i,
                "date": f"2026-07-0{i + 1}",
            }, headers=auth_headers)
        resp = client.get("/api/v1/health/weight?limit=2", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        assert int(resp.headers["X-Total-Count"]) == 3

    def test_measurements(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/health/measurements?limit=1", headers=auth_headers)
        assert resp.status_code == 200
        assert "X-Total-Count" in resp.headers

    def test_wellness(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/health/wellness?limit=1", headers=auth_headers)
        assert resp.status_code == 200
        assert "X-Total-Count" in resp.headers

    def test_injuries(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/health/injuries?limit=1", headers=auth_headers)
        assert resp.status_code == 200
        assert "X-Total-Count" in resp.headers


class TestPaginationValidation:
    def test_negative_limit_rejected(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/runs?limit=-1", headers=auth_headers)
        assert resp.status_code == 422

    def test_negative_offset_rejected(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/runs?offset=-5", headers=auth_headers)
        assert resp.status_code == 422

    def test_limit_capped(self, client: TestClient, auth_headers: dict):
        # limit > 500 is rejected by validation (le=500 on the Query param).
        resp = client.get("/api/v1/runs?limit=99999", headers=auth_headers)
        assert resp.status_code == 422
        # limit at the cap is fine.
        resp = client.get("/api/v1/runs?limit=500", headers=auth_headers)
        assert resp.status_code == 200
