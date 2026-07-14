"""Tests for Boxing CRUD endpoints."""

from datetime import date
from fastapi.testclient import TestClient


class TestListBoxing:
    URL = "/api/v1/boxing"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list(self, client: TestClient, auth_headers: dict):
        client.post(self.URL, json={
            "duration_seconds": 1800, "notes": "Light session",
        }, headers=auth_headers)
        client.post(self.URL, json={
            "duration_seconds": 3600, "notes": "Heavy session",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        # Newest first
        assert data[0]["duration_seconds"] == 3600
        assert data[1]["duration_seconds"] == 1800


class TestCreateBoxing:
    URL = "/api/v1/boxing"

    def test_create_basic(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1800,
            "notes": "Morning boxing",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_seconds"] == 1800
        assert data["kcal_per_min"] == 10.0  # default
        assert data["notes"] == "Morning boxing"
        assert "id" in data
        assert "created_at" in data
        # Date defaults to today
        assert data["date"] == date.today().isoformat()

    def test_create_with_date(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 2700,
            "date": "2026-06-15",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["date"] == "2026-06-15"

    def test_create_creates_workout_session(self, client: TestClient, auth_headers: dict):
        """Creating a boxing entry should also create a WorkoutSession for unified history."""
        client.post(self.URL, json={
            "duration_seconds": 1800, "notes": "Test session",
        }, headers=auth_headers)

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 1
        assert sessions[0]["template_name"] == "Boxing: 30min"
        assert sessions[0]["total_duration_seconds"] == 1800
        assert sessions[0]["notes"] == "Test session"

    def test_create_with_different_duration(self, client: TestClient, auth_headers: dict):
        """45min boxing should create a 'Boxing: 45min' mirror session."""
        client.post(self.URL, json={
            "duration_seconds": 2700, "notes": "45 min session",
        }, headers=auth_headers)

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 1
        assert sessions[0]["template_name"] == "Boxing: 45min"
        assert sessions[0]["total_duration_seconds"] == 2700

    def test_create_kcal_estimation(self, client: TestClient, auth_headers: dict):
        """30min at default 10 kcal/min = 300 kcal."""
        client.post(self.URL, json={
            "duration_seconds": 1800,
        }, headers=auth_headers)

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert sessions[0]["total_kcal_estimated"] == 300.0


class TestUpdateBoxing:
    def test_update_duration(self, client: TestClient, auth_headers: dict):
        """Update from 30min to 45min — mirror session should rename and update."""
        create = client.post("/api/v1/boxing", json={
            "duration_seconds": 1800,
        }, headers=auth_headers).json()
        bid = create["id"]

        resp = client.put(f"/api/v1/boxing/{bid}", json={
            "duration_seconds": 2700,
            "notes": "Updated duration",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["duration_seconds"] == 2700
        assert data["notes"] == "Updated duration"

        # Mirror session should have updated name and duration
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 1
        assert sessions[0]["template_name"] == "Boxing: 45min"
        assert sessions[0]["total_duration_seconds"] == 2700
        assert sessions[0]["notes"] == "Updated duration"

    def test_update_notes_only(self, client: TestClient, auth_headers: dict):
        """Update only notes — mirror session should update notes, keep duration."""
        create = client.post("/api/v1/boxing", json={
            "duration_seconds": 1800,
        }, headers=auth_headers).json()
        bid = create["id"]

        resp = client.put(f"/api/v1/boxing/{bid}", json={
            "duration_seconds": 1800,
            "notes": "New notes only",
        }, headers=auth_headers)
        assert resp.status_code == 200

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert sessions[0]["notes"] == "New notes only"
        assert sessions[0]["total_duration_seconds"] == 1800

    def test_update_missing(self, client: TestClient, auth_headers: dict):
        resp = client.put("/api/v1/boxing/99999", json={
            "duration_seconds": 600,
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteBoxing:
    def test_delete(self, client: TestClient, auth_headers: dict):
        create = client.post("/api/v1/boxing", json={
            "duration_seconds": 1200,
        }, headers=auth_headers).json()
        bid = create["id"]

        resp = client.delete(f"/api/v1/boxing/{bid}", headers=auth_headers)
        assert resp.status_code == 204

        # Verify removed from list (no individual GET endpoint)
        entries = client.get("/api/v1/boxing", headers=auth_headers).json()
        assert all(e["id"] != bid for e in entries)

    def test_delete_removes_workout_session(self, client: TestClient, auth_headers: dict):
        create = client.post("/api/v1/boxing", json={
            "duration_seconds": 1200,
        }, headers=auth_headers).json()
        bid = create["id"]

        # Before delete, a session exists
        assert len(client.get("/api/v1/sessions", headers=auth_headers).json()) == 1

        client.delete(f"/api/v1/boxing/{bid}", headers=auth_headers)

        # Session should be gone
        assert len(client.get("/api/v1/sessions", headers=auth_headers).json()) == 0

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/api/v1/boxing/99999", headers=auth_headers)
        assert resp.status_code == 404


class TestBoxingEdgeCases:
    def test_same_day_multiple_entries(self, client: TestClient, auth_headers: dict):
        """Two entries on the same day, different durations — both should have mirror sessions."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "notes": "Morning",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "notes": "Evening",
        }, headers=auth_headers)

        entries = client.get("/api/v1/boxing", headers=auth_headers).json()
        assert len(entries) == 2

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 2
        names = {s["template_name"] for s in sessions}
        assert "Boxing: 30min" in names
        assert "Boxing: 60min" in names

    def test_same_day_same_duration(self, client: TestClient, auth_headers: dict):
        """Two entries same day, same duration — both should have mirror sessions."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "notes": "Session 1",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "notes": "Session 2",
        }, headers=auth_headers)

        entries = client.get("/api/v1/boxing", headers=auth_headers).json()
        assert len(entries) == 2

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 2

    def test_custom_kcal_per_min(self, client: TestClient, auth_headers: dict):
        """Custom kcal_per_min should produce correct kcal estimate."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800,
            "kcal_per_min": 12.0,
        }, headers=auth_headers)

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert sessions[0]["total_kcal_estimated"] == 360.0  # 30 * 12

    def test_delete_only_target_entry(self, client: TestClient, auth_headers: dict):
        """Deleting one entry should not affect the other."""
        e1 = client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "notes": "Keep",
        }, headers=auth_headers).json()
        e2 = client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "notes": "Delete",
        }, headers=auth_headers).json()

        client.delete(f"/api/v1/boxing/{e2['id']}", headers=auth_headers)

        entries = client.get("/api/v1/boxing", headers=auth_headers).json()
        assert len(entries) == 1
        assert entries[0]["id"] == e1["id"]
        assert entries[0]["notes"] == "Keep"

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 1
        assert "30min" in sessions[0]["template_name"]


class TestBoxingStats:
    URL = "/api/v1/boxing/stats"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 0
        assert data["total_duration_seconds"] == 0
        assert data["monthly_breakdown"] == []

    def test_single_entry(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 1
        assert data["total_duration_seconds"] == 1800
        assert data["total_hours"] == 0.5
        assert data["avg_duration_seconds"] == 1800.0
        assert data["avg_kcal_per_min"] == 10.0
        assert data["total_kcal_estimated"] == 300.0

    def test_multiple_entries(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "kcal_per_min": 10.0,
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "kcal_per_min": 12.0,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 2
        assert data["total_duration_seconds"] == 5400
        assert data["total_hours"] == 1.5
        assert data["avg_duration_seconds"] == 2700.0
        assert data["avg_kcal_per_min"] == 11.0
        # (30*10) + (60*12) = 300 + 720 = 1020
        assert data["total_kcal_estimated"] == 1020.0

    def test_monthly_breakdown(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "date": "2026-06-10",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "date": "2026-06-20",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 2700, "date": "2026-07-05",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["monthly_breakdown"]) == 2
        # Most recent month first
        july = data["monthly_breakdown"][0]
        assert july["month"] == "2026-07"
        assert july["sessions"] == 1
        assert july["total_minutes"] == 45

        june = data["monthly_breakdown"][1]
        assert june["month"] == "2026-06"
        assert june["sessions"] == 2
        assert june["total_minutes"] == 90  # 30 + 60


class TestBoxingPrs:
    URL = "/api/v1/boxing/prs"

    def test_empty(self, client: TestClient, auth_headers: dict):
        """Returns empty defaults when no boxing entries exist."""
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["longest_session_seconds"] is None
        assert data["most_kcal_session"] is None
        assert data["total_hours_all_time"] == 0.0
        assert data["most_rounds_session"] is None

    def test_single_entry(self, client: TestClient, auth_headers: dict):
        """Returns correct PRs for a single boxing entry."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "kcal_per_min": 10.0,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["longest_session_seconds"] == 1800
        assert data["most_kcal_session"] == 300.0  # 30min * 10 kcal/min
        assert data["total_hours_all_time"] == 0.5
        assert data["most_rounds_session"] is None  # no rounds set

    def test_multiple_entries(self, client: TestClient, auth_headers: dict):
        """Returns correct PRs across multiple entries — picks max values."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "kcal_per_min": 10.0, "notes": "Short",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "kcal_per_min": 12.0, "notes": "Long",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 2700, "kcal_per_min": 15.0, "notes": "Medium",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        # Longest session: 3600s
        assert data["longest_session_seconds"] == 3600
        # Most kcal: 60min * 12 = 720.0 (higher than 45min * 15 = 675.0)
        assert data["most_kcal_session"] == 720.0
        # Total hours: (1800 + 3600 + 2700) / 3600 = 2.25
        assert data["total_hours_all_time"] == 2.2  # round(2.25, 1) = 2.2 (banker's rounding)
        assert data["most_rounds_session"] is None  # no rounds set

    def test_most_rounds(self, client: TestClient, auth_headers: dict):
        """most_rounds_session picks the entry with the highest round count."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "rounds": 8, "notes": "8 rounds",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "rounds": 12, "notes": "12 rounds",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 2700, "rounds": 6, "notes": "6 rounds",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["most_rounds_session"] == 12

    def test_most_rounds_mixed(self, client: TestClient, auth_headers: dict):
        """most_rounds_session ignores entries without rounds set."""
        client.post("/api/v1/boxing", json={
            "duration_seconds": 1800, "notes": "no rounds",
        }, headers=auth_headers)
        client.post("/api/v1/boxing", json={
            "duration_seconds": 3600, "rounds": 10, "notes": "10 rounds",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["most_rounds_session"] == 10


class TestUpdateBoxingMirrorExercise:
    """NER-172: editing a boxing entry must update the mirror SessionExercise."""

    def test_update_updates_session_exercise(self, client: TestClient, auth_headers: dict):
        """PUT to boxing entry updates the mirror SessionExercise duration + kcal."""
        create = client.post("/api/v1/boxing", json={
            "duration_seconds": 1800,
            "kcal_per_min": 10.0,
        }, headers=auth_headers).json()
        bid = create["id"]

        # Get the created session id
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert len(sessions) == 1
        sid = sessions[0]["id"]

        # Edit: double duration and increase kcal/min
        resp = client.put(f"/api/v1/boxing/{bid}", json={
            "duration_seconds": 3600,
            "kcal_per_min": 12.0,
        }, headers=auth_headers)
        assert resp.status_code == 200

        # Fetch session detail and check SessionExercise
        detail = client.get(f"/api/v1/sessions/{sid}", headers=auth_headers).json()
        exercises = detail["exercises"]
        assert len(exercises) == 1
        ex = exercises[0]
        assert ex["duration_seconds"] == 3600
        # 3600s / 60 * 12.0 = 720.0 kcal
        assert ex["kcal_burned"] == 720.0