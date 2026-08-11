"""Tests for Cycling CRUD endpoints."""

from datetime import date, timedelta
from fastapi.testclient import TestClient


class TestListCycling:
    URL = "/api/v1/cycling"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list(self, client: TestClient, auth_headers: dict):
        client.post(self.URL, json={
            "duration_seconds": 1800, "distance_km": 8.0, "notes": "Morning ride",
        }, headers=auth_headers)
        client.post(self.URL, json={
            "duration_seconds": 5400, "distance_km": 24.0, "notes": "Long ride",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["duration_seconds"] == 5400
        assert data[1]["duration_seconds"] == 1800


class TestCreateCycling:
    URL = "/api/v1/cycling"

    def test_create_basic(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1800,
            "distance_km": 8.0,
            "notes": "Morning ride",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_seconds"] == 1800
        assert data["distance_km"] == 8.0
        assert data["notes"] == "Morning ride"
        assert "id" in data
        assert "created_at" in data
        assert data["date"] == date.today().isoformat()

    def test_create_with_date(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 3600,
            "distance_km": 15.0,
            "date": "2026-06-15",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["date"] == "2026-06-15"

    def test_creates_mirror_session(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 5400,
            "distance_km": 24.0,
            "notes": "Long ride",
        }, headers=auth_headers)
        assert resp.status_code == 201
        entry = resp.json()

        # Check that a mirror WorkoutSession was created
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        mirror = next(
            (s for s in sessions if s.get("cycling_entry_id") == entry["id"]),
            None,
        )
        assert mirror is not None, "No mirror session found for cycling entry"
        assert mirror["cycling_entry_id"] == entry["id"]
        assert mirror["total_duration_seconds"] == 5400
        assert mirror["notes"] == "Long ride"
        assert "Cycling:" in mirror["template_name"]

    def test_mirror_kcal_is_speed_based_active_energy(
        self, client: TestClient, auth_headers: dict
    ):
        """The mirror's kcal comes from average speed and the rider's weight:
        24 km in 1.5 h is 16 km/h -> MET 6.16, so (6.16 - 1) x 80 kg x 1.5 h.
        The superseded flat 0.45 kcal/kg/km factor would have said 864.0."""
        client.post(
            "/api/v1/health/weight",
            json={"weight_kg": 80.0, "date": "2026-01-01"},
            headers=auth_headers,
        )
        entry = client.post(self.URL, json={
            "duration_seconds": 5400, "distance_km": 24.0,
        }, headers=auth_headers).json()

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        mirror = next(s for s in sessions if s.get("cycling_entry_id") == entry["id"])

        assert mirror["total_kcal_estimated"] == 619.2

    def test_same_distance_at_double_the_speed_burns_more(
        self, client: TestClient, auth_headers: dict
    ):
        """Distance alone cannot price a ride — the old factor scored these two
        identically."""
        slow = client.post(self.URL, json={
            "duration_seconds": 7200, "distance_km": 24.0,
        }, headers=auth_headers).json()
        fast = client.post(self.URL, json={
            "duration_seconds": 3600, "distance_km": 24.0,
        }, headers=auth_headers).json()

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        by_entry = {s["cycling_entry_id"]: s["total_kcal_estimated"] for s in sessions}

        assert by_entry[fast["id"]] > by_entry[slow["id"]]


class TestUpdateCycling:
    URL = "/api/v1/cycling"

    def test_update(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1800, "distance_km": 8.0,
        }, headers=auth_headers)
        entry_id = resp.json()["id"]

        resp = client.put(f"{self.URL}/{entry_id}", json={
            "duration_seconds": 3600,
            "distance_km": 15.0,
            "notes": "Updated ride",
            "date": "2026-06-15",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["duration_seconds"] == 3600
        assert data["distance_km"] == 15.0
        assert data["notes"] == "Updated ride"
        assert data["date"] == "2026-06-15"

    def test_update_mirror_syncs(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1800, "distance_km": 8.0,
        }, headers=auth_headers)
        entry_id = resp.json()["id"]

        # Update to different duration
        client.put(f"{self.URL}/{entry_id}", json={
            "duration_seconds": 5400,
            "distance_km": 24.0,
        }, headers=auth_headers)

        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        mirror = next(
            (s for s in sessions if s.get("cycling_entry_id") == entry_id),
            None,
        )
        assert mirror is not None
        assert mirror["total_duration_seconds"] == 5400
        assert "Cycling: 24.0km" in mirror["template_name"]

    def test_update_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.put(f"{self.URL}/99999", json={
            "duration_seconds": 1800, "distance_km": 8.0,
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteCycling:
    URL = "/api/v1/cycling"

    def test_delete_cascades_to_mirror(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "duration_seconds": 1800, "distance_km": 8.0,
        }, headers=auth_headers)
        entry_id = resp.json()["id"]

        # Verify mirror exists
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        mirror = next(
            (s for s in sessions if s.get("cycling_entry_id") == entry_id),
            None,
        )
        assert mirror is not None

        # Delete the cycling entry
        resp = client.delete(f"{self.URL}/{entry_id}", headers=auth_headers)
        assert resp.status_code == 204

        # Verify entry is gone
        entries = client.get(self.URL, headers=auth_headers).json()
        assert not any(e["id"] == entry_id for e in entries)

        # Verify mirror session is gone
        sessions = client.get("/api/v1/sessions", headers=auth_headers).json()
        assert not any(s.get("cycling_entry_id") == entry_id for s in sessions)


class TestCyclingStats:
    URL = "/api/v1/cycling/stats"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 0

    def test_stats(self, client: TestClient, auth_headers: dict):
        # Create two rides
        client.post("/api/v1/cycling", json={
            "duration_seconds": 1800, "distance_km": 8.0, "date": "2026-06-01",
        }, headers=auth_headers)
        client.post("/api/v1/cycling", json={
            "duration_seconds": 5400, "distance_km": 24.0, "date": "2026-06-15",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 2
        assert data["total_distance_km"] == 32.0
        assert data["total_duration_seconds"] == 7200
        assert data["total_hours"] == 2.0
        assert data["total_kcal_estimated"] > 0
        assert data["avg_duration_seconds"] == 3600.0
        assert data["avg_distance_km"] == 16.0
        assert len(data["monthly_breakdown"]) >= 1


class TestCyclingPRs:
    URL = "/api/v1/cycling/prs"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_hours_all_time"] == 0
        assert data["longest_ride_km"] is None

    def test_prs(self, client: TestClient, auth_headers: dict):
        client.post("/api/v1/cycling", json={
            "duration_seconds": 1800, "distance_km": 8.0,
        }, headers=auth_headers)
        client.post("/api/v1/cycling", json={
            "duration_seconds": 5400, "distance_km": 24.0,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["longest_ride_km"] == 24.0
        assert data["longest_ride_seconds"] == 5400
        assert data["total_hours_all_time"] == 2.0
        assert data["most_kcal_ride"] is not None and data["most_kcal_ride"] > 0


class TestCyclingTrends:
    URL = "/api/v1/cycling/stats/trends"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["days"] == []

    def test_aggregates_daily_minutes_and_kcal(self, client: TestClient, auth_headers: dict):
        today = date.today()
        d1 = today.isoformat()
        d2 = (today - timedelta(days=1)).isoformat()
        client.post("/api/v1/cycling", json={
            "duration_seconds": 3600, "distance_km": 16.0, "date": d1,
        }, headers=auth_headers)
        client.post("/api/v1/cycling", json={
            "duration_seconds": 5400, "distance_km": 24.0, "date": d2,
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        days = resp.json()["days"]
        assert len(days) == 2
        by_date = {d["date"]: d for d in days}
        assert by_date[d1]["minutes"] == 60.0
        assert by_date[d1]["kcal"] > 0
        assert by_date[d2]["minutes"] == 90.0
        assert by_date[d2]["kcal"] > 0

    def test_respects_days_window(self, client: TestClient, auth_headers: dict):
        old = (date.today() - timedelta(days=300)).isoformat()
        client.post("/api/v1/cycling", json={
            "duration_seconds": 3600, "distance_km": 16.0, "date": old,
        }, headers=auth_headers)
        resp = client.get(self.URL + "?days=30", headers=auth_headers)
        assert resp.json()["days"] == []