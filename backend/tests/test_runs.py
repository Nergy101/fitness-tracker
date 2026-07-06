"""Tests for Run CRUD + Stats endpoints."""

from datetime import date
from fastapi.testclient import TestClient


class TestListRuns:
    URL = "/api/v1/runs"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list(self, client: TestClient, auth_headers: dict):
        client.post(self.URL, json={
            "duration_seconds": 1800, "distance_km": 5.0, "notes": "Easy run",
        }, headers=auth_headers)
        client.post(self.URL, json={
            "duration_seconds": 3600, "distance_km": 10.0, "notes": "Long run",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        # Newest first
        assert data[0]["distance_km"] == 10.0


class TestCreateRun:
    URL = "/api/v1/runs"

    def test_create_basic(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1800,
            "distance_km": 5.0,
            "notes": "Morning run",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_seconds"] == 1800
        assert data["distance_km"] == 5.0
        assert data["notes"] == "Morning run"
        assert data["pace_per_km"] == 360.0  # 1800 / 5.0 = 360.0
        assert "id" in data
        assert "created_at" in data
        # Date defaults to today
        assert data["date"] == date.today().isoformat()

    def test_create_with_date(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1500,
            "distance_km": 4.2,
            "date": "2026-06-15",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["date"] == "2026-06-15"

    def test_create_creates_workout_session(self, client: TestClient, auth_headers: dict):
        """Creating a run should also create a WorkoutSession for unified history."""
        client.post(self.URL, json={
            "duration_seconds": 1800, "distance_km": 5.0,
        }, headers=auth_headers)

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 1
        assert "Run:" in sessions[0]["template_name"]

    def test_pace_computation(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 2700,
            "distance_km": 10.0,
        }, headers=auth_headers)
        assert resp.json()["pace_per_km"] == 270.0  # 2700/10


class TestUpdateRun:
    def test_update_basic(self, client: TestClient, auth_headers: dict):
        create = client.post("/api/v1/runs", json={
            "duration_seconds": 1800, "distance_km": 5.0,
        }, headers=auth_headers).json()
        rid = create["id"]

        resp = client.put(f"/api/v1/runs/{rid}", json={
            "duration_seconds": 2100,
            "distance_km": 7.0,
            "notes": "Updated",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["duration_seconds"] == 2100
        assert data["distance_km"] == 7.0
        assert data["notes"] == "Updated"
        assert data["pace_per_km"] == 300.0  # 2100/7

    def test_update_missing(self, client: TestClient, auth_headers: dict):
        resp = client.put("/api/v1/runs/99999", json={
            "duration_seconds": 600, "distance_km": 2.0,
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteRun:
    def test_delete(self, client: TestClient, auth_headers: dict):
        create = client.post("/api/v1/runs", json={
            "duration_seconds": 600, "distance_km": 2.0,
        }, headers=auth_headers).json()
        rid = create["id"]

        resp = client.delete(f"/api/v1/runs/{rid}", headers=auth_headers)
        assert resp.status_code == 204

        # Verify removed from list (no individual GET endpoint)
        entries = client.get("/api/v1/runs", headers=auth_headers).json()
        assert all(e["id"] != rid for e in entries)

    def test_delete_removes_workout_session(self, client: TestClient, auth_headers: dict):
        create = client.post("/api/v1/runs", json={
            "duration_seconds": 600, "distance_km": 2.0,
        }, headers=auth_headers).json()
        rid = create["id"]

        # Before delete, a session exists
        assert len(client.get("/api/v1/sessions", headers=auth_headers).json()) == 1

        client.delete(f"/api/v1/runs/{rid}", headers=auth_headers)

        # Session should be gone
        assert len(client.get("/api/v1/sessions", headers=auth_headers).json()) == 0

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/api/v1/runs/99999", headers=auth_headers)
        assert resp.status_code == 404


class TestRunStats:
    URL = "/api/v1/runs/stats"

    def test_empty_db(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_runs"] == 0
        assert data["total_distance_km"] == 0.0
        assert data["total_duration_seconds"] == 0

    def test_single_run(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/runs", json={
            "duration_seconds": 1800, "distance_km": 5.0,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["total_runs"] == 1
        assert data["total_distance_km"] == 5.0
        assert data["total_duration_seconds"] == 1800
        assert data["avg_pace_per_km"] == 360.0

    def test_multiple_runs_totals(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/runs", json={
            "duration_seconds": 1800, "distance_km": 5.0,
        }, headers=auth_headers)
        client.post("/api/v1/runs", json={
            "duration_seconds": 3600, "distance_km": 10.0,
        }, headers=auth_headers)
        client.post("/api/v1/runs", json={
            "duration_seconds": 900, "distance_km": 2.5,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["total_runs"] == 3
        assert data["total_distance_km"] == 17.5  # 5+10+2.5
        assert data["total_duration_seconds"] == 6300  # 1800+3600+900
        assert data["avg_pace_per_km"] == 360.0  # 6300/17.5

    def test_longest_run(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/runs", json={
            "duration_seconds": 1800, "distance_km": 5.0,
        }, headers=auth_headers)
        client.post("/api/v1/runs", json={
            "duration_seconds": 4200, "distance_km": 15.0,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["longest_run_distance_km"] == 15.0
        assert data["longest_run_seconds"] == 4200

    def test_fastest_5k(self, client: TestClient, auth_headers: dict):
        # Run at 5k distance
        client.post("/api/v1/runs", json={
            "duration_seconds": 1500, "distance_km": 5.0,  # 25 min 5k
        }, headers=auth_headers)
        client.post("/api/v1/runs", json={
            "duration_seconds": 1200, "distance_km": 5.0,  # 20 min 5k (faster!)
        }, headers=auth_headers)
        # Run just outside 5k range
        client.post("/api/v1/runs", json={
            "duration_seconds": 900, "distance_km": 4.0,  # not 5k
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["fastest_5k_seconds"] == 1200

    def test_fastest_10k(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/runs", json={
            "duration_seconds": 3600, "distance_km": 10.0,
        }, headers=auth_headers)
        client.post("/api/v1/runs", json={
            "duration_seconds": 3300, "distance_km": 10.0,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["fastest_10k_seconds"] == 3300

    def test_monthly_breakdown(self, client: TestClient, auth_headers: dict):
        # Create runs in different months
        client.post("/api/v1/runs", json={
            "duration_seconds": 1800, "distance_km": 5.0,
            "date": "2026-06-01",
        }, headers=auth_headers)
        client.post("/api/v1/runs", json={
            "duration_seconds": 3600, "distance_km": 10.0,
            "date": "2026-07-01",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        months = {(m["month"], m["runs"]) for m in data["monthly_breakdown"]}
        assert ("2026-06", 1) in months
        assert ("2026-07", 1) in months
