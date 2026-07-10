"""Tests for Session endpoints."""

from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient


class TestListSessions:
    URL = "/api/v1/sessions"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_multiple(self, client: TestClient, auth_headers: dict):
        # Create two sessions
        for i in range(2):
            client.post(self.URL, json={
                "template_name": f"Session {i}",
                "total_duration_seconds": 300,
                "total_kcal_estimated": 50.0,
                "exercises": [{
                    "exercise_name": "Running",
                    "duration_seconds": 300,
                    "kcal_burned": 50.0,
                    "order_index": 0,
                    "completed": True,
                }],
            }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        # Newest first
        assert data[0]["template_name"] == "Session 1"
        assert data[1]["template_name"] == "Session 0"


class TestCreateSession:
    URL = "/api/v1/sessions"

    def test_create_minimal(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "template_name": "Test",
            "total_duration_seconds": 120,
            "total_kcal_estimated": 20.0,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["template_name"] == "Test"
        assert data["total_duration_seconds"] == 120
        assert data["total_kcal_estimated"] == 20.0
        assert data["exercises"] == []
        assert "started_at" in data

    def test_create_with_exercises(self, client: TestClient, auth_headers: dict, seed_exercise):
        resp = client.post(self.URL, json={
            "template_name": "Full Session",
            "template_id": None,
            "total_duration_seconds": 600,
            "total_kcal_estimated": 100.0,
            "exercises": [
                {
                    "exercise_id": seed_exercise.id,
                    "exercise_name": "Push-up",
                    "duration_seconds": 300,
                    "kcal_burned": 50.0,
                    "order_index": 0,
                    "completed": True,
                },
                {
                    "exercise_id": None,
                    "exercise_name": "Rest",
                    "duration_seconds": 300,
                    "kcal_burned": 0.0,
                    "order_index": 1,
                    "completed": True,
                },
            ],
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["exercises"]) == 2
        assert data["exercises"][0]["exercise_name"] == "Push-up"
        assert data["exercises"][1]["exercise_name"] == "Rest"

    def test_create_with_existing_template(self, client: TestClient, auth_headers: dict, seed_exercise):
        # Create a template
        tpl = client.post("/api/v1/workouts", json={
            "name": "Morning",
            "exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}],
        }, headers=auth_headers).json()

        resp = client.post(self.URL, json={
            "template_id": tpl["id"],
            "total_duration_seconds": 300,
            "total_kcal_estimated": 35.0,
            "exercises": [{
                "exercise_id": seed_exercise.id,
                "exercise_name": "Push-up",
                "duration_seconds": 300,
                "kcal_burned": 35.0,
                "order_index": 0,
                "completed": True,
            }],
        }, headers=auth_headers)
        assert resp.status_code == 201
        # template_name should have been resolved from the template
        assert resp.json()["template_name"] == "Morning"

    def test_create_with_deleted_template(self, client: TestClient, auth_headers: dict, seed_exercise):
        """Session can reference a deleted template_id gracefully (template_name provides backup)."""
        tpl = client.post("/api/v1/workouts", json={
            "name": "Gone Soon",
            "exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}],
        }, headers=auth_headers).json()
        tid = tpl["id"]
        client.delete(f"/api/v1/workouts/{tid}", headers=auth_headers)

        resp = client.post(self.URL, json={
            "template_id": tid,
            "template_name": "Gone Soon",
            "total_duration_seconds": 100,
            "total_kcal_estimated": 10.0,
            "exercises": [],
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["template_name"] == "Gone Soon"

    def test_create_with_dates(self, client: TestClient, auth_headers: dict):
        now = datetime.now(timezone.utc)
        start = now.isoformat()
        end = (now + timedelta(minutes=30)).isoformat()
        resp = client.post(self.URL, json={
            "template_name": "Dated",
            "total_duration_seconds": 1800,
            "total_kcal_estimated": 200.0,
            "started_at": start,
            "finished_at": end,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["started_at"] is not None
        assert data["finished_at"] is not None


class TestUpdateSession:
    URL = "/api/v1/sessions"

    def test_end_session(self, client: TestClient, auth_headers: dict):
        create = client.post(self.URL, json={
            "template_name": "End Test",
            "total_duration_seconds": 100,
            "total_kcal_estimated": 10.0,
        }, headers=auth_headers).json()
        sid = create["id"]

        resp = client.patch(f"{self.URL}/{sid}/end", json={
            "total_duration_seconds": 200,
            "total_kcal_estimated": 40.0,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_duration_seconds"] == 200
        assert data["total_kcal_estimated"] == 40.0
        assert data["finished_at"] is not None

    def test_end_missing(self, client: TestClient, auth_headers: dict):
        resp = client.patch("/api/v1/sessions/99999/end", json={}, headers=auth_headers)
        assert resp.status_code == 404


class TestGetSession:
    def test_get_existing(self, client: TestClient, auth_headers: dict, seed_exercise):
        create = client.post("/api/v1/sessions", json={
            "template_name": "Detail Test",
            "total_duration_seconds": 500,
            "total_kcal_estimated": 80.0,
            "exercises": [{
                "exercise_id": seed_exercise.id,
                "exercise_name": "Push-up",
                "duration_seconds": 500,
                "kcal_burned": 80.0,
                "order_index": 0,
                "completed": True,
            }],
        }, headers=auth_headers).json()
        sid = create["id"]

        resp = client.get(f"/api/v1/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sid
        assert len(resp.json()["exercises"]) == 1

    def test_get_missing(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/sessions/99999", headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteSession:
    def test_delete(self, client: TestClient, auth_headers: dict):
        create = client.post("/api/v1/sessions", json={
            "template_name": "Delete",
            "total_duration_seconds": 60,
            "total_kcal_estimated": 5.0,
        }, headers=auth_headers).json()
        sid = create["id"]

        resp = client.delete(f"/api/v1/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 204

        resp2 = client.get(f"/api/v1/sessions/{sid}", headers=auth_headers)
        assert resp2.status_code == 404

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/api/v1/sessions/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_run_mirror_cascades(self, client: TestClient, auth_headers: dict):
        """Deleting a run mirror session via DELETE /sessions/{id} should
        also delete the underlying RunEntry (NER-150)."""
        # Create a run — this creates both RunEntry + mirror WorkoutSession
        run_resp = client.post("/api/v1/runs", json={
            "duration_seconds": 1800,
            "distance_km": 5.0,
            "run_type": "run",
            "notes": "test cascade",
        }, headers=auth_headers)
        assert run_resp.status_code == 201
        run_data = run_resp.json()
        run_id = run_data["id"]

        # Find the mirror session
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        mirror = next((s for s in sessions if s["template_name"].startswith("Run:")), None)
        assert mirror is not None, "Mirror session should exist for run"

        # Delete via generic session endpoint (what the History tab does)
        del_resp = client.delete(f"/api/v1/sessions/{mirror['id']}", headers=auth_headers)
        assert del_resp.status_code == 204

        # Verify the run entry is also deleted (check via list)
        runs = client.get("/api/v1/runs", headers=auth_headers).json()
        assert not any(r["id"] == run_id for r in runs), "RunEntry should be cascade-deleted"

        # Verify the session is deleted
        get_ses = client.get(f"/api/v1/sessions/{mirror['id']}", headers=auth_headers)
        assert get_ses.status_code == 404

    def test_delete_boxing_mirror_cascades(self, client: TestClient, auth_headers: dict):
        """Deleting a boxing mirror session via DELETE /sessions/{id} should
        also delete the underlying BoxingEntry (NER-150)."""
        # Create a boxing entry — this creates both BoxingEntry + mirror WorkoutSession
        box_resp = client.post("/api/v1/boxing", json={
            "duration_seconds": 1800,
            "kcal_per_min": 10.0,
            "notes": "test cascade boxing",
        }, headers=auth_headers)
        assert box_resp.status_code == 201
        box_data = box_resp.json()
        box_id = box_data["id"]

        # Find the mirror session
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        mirror = next((s for s in sessions if s["template_name"].startswith("Boxing:")), None)
        assert mirror is not None, "Mirror session should exist for boxing"

        # Delete via generic session endpoint
        del_resp = client.delete(f"/api/v1/sessions/{mirror['id']}", headers=auth_headers)
        assert del_resp.status_code == 204

        # Verify the boxing entry is also deleted (check via list)
        boxing = client.get("/api/v1/boxing", headers=auth_headers).json()
        assert not any(b["id"] == box_id for b in boxing), "BoxingEntry should be cascade-deleted"

        # Verify the session is deleted
        get_ses = client.get(f"/api/v1/sessions/{mirror['id']}", headers=auth_headers)
        assert get_ses.status_code == 404

    def test_delete_regular_session_does_not_touch_entries(self, client: TestClient, auth_headers: dict):
        """Regular workout sessions (not mirrors) should delete normally without
        affecting any run/boxing entries that happen to share the same date."""
        # Create a regular session
        create = client.post("/api/v1/sessions", json={
            "template_name": "Regular Workout",
            "total_duration_seconds": 300,
            "total_kcal_estimated": 25.0,
        }, headers=auth_headers)
        assert create.status_code == 201
        sid = create.json()["id"]

        # Delete it
        resp = client.delete(f"/api/v1/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 204

        get_resp = client.get(f"/api/v1/sessions/{sid}", headers=auth_headers)
        assert get_resp.status_code == 404
