"""Tests for Health endpoints (profile, weight, BMI, measurements, wellness, score)."""

from datetime import date, timedelta
from fastapi.testclient import TestClient


# ─── Profile ──────────────────────────────────────────────────

class TestProfile:
    URL = "/api/v1/health/profile"

    def test_get_default(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["height_cm"] is None
        assert data["birthday"] is None
        assert data["gender"] is None
        assert data["goal_weight_kg"] is None
        assert data["weight_unit"] == "kg"
        assert data["notifications_enabled"] is False
        assert data["reminder_time"] == ""

    def test_update(self, client: TestClient, auth_headers: dict):
        resp = client.put(self.URL, json={
            "height_cm": 180.0,
            "gender": "male",
            "goal_weight_kg": 75.0,
            "notifications_enabled": True,
            "reminder_time": "08:00",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["height_cm"] == 180.0
        assert data["gender"] == "male"
        assert data["goal_weight_kg"] == 75.0
        assert data["notifications_enabled"] is True
        assert data["reminder_time"] == "08:00"

    def test_update_partial(self, client: TestClient, auth_headers: dict):
        resp = client.put(self.URL, json={"height_cm": 170.0}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["height_cm"] == 170.0
        # Other fields untouched
        assert resp.json()["weight_unit"] == "kg"

    def test_clear_reminder(self, client: TestClient, auth_headers: dict):
        # Set it first
        client.put(self.URL, json={"reminder_time": "08:00"}, headers=auth_headers)
        # Then clear it
        resp = client.put(self.URL, json={"reminder_time": None}, headers=auth_headers)
        assert resp.json()["reminder_time"] == ""


# ─── Weight ───────────────────────────────────────────────────

class TestWeight:
    LIST_URL = "/api/v1/health/weight"
    STATS_URL = "/api/v1/health/weight/stats"
    STREAK_URL = "/api/v1/health/weight/streak"

    def test_list_empty(self, client: TestClient, auth_headers: dict):
        assert client.get(self.LIST_URL, headers=auth_headers).json() == []

    def test_create(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.LIST_URL, json={
            "weight_kg": 80.0,
            "notes": "Morning weight",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["weight_kg"] == 80.0
        assert data["notes"] == "Morning weight"
        assert data["date"] == date.today().isoformat()

    def test_create_with_date(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.LIST_URL, json={
            "weight_kg": 82.5,
            "date": "2026-06-01",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["date"] == "2026-06-01"

    def test_update(self, client: TestClient, auth_headers: dict):
        create = client.post(self.LIST_URL, json={"weight_kg": 80.0}, headers=auth_headers).json()
        eid = create["id"]

        resp = client.put(f"{self.LIST_URL}/{eid}", json={
            "weight_kg": 79.0,
            "notes": "Updated",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["weight_kg"] == 79.0
        assert resp.json()["notes"] == "Updated"

    def test_update_missing(self, client: TestClient, auth_headers: dict):
        resp = client.put(f"{self.LIST_URL}/99999", json={"weight_kg": 70.0}, headers=auth_headers)
        assert resp.status_code == 404

    def test_delete(self, client: TestClient, auth_headers: dict):
        create = client.post(self.LIST_URL, json={"weight_kg": 80.0}, headers=auth_headers).json()
        eid = create["id"]

        resp = client.delete(f"{self.LIST_URL}/{eid}", headers=auth_headers)
        assert resp.status_code == 204

        # Verify removed from list (no individual GET endpoint)
        entries = client.get(self.LIST_URL, headers=auth_headers).json()
        assert all(e["id"] != eid for e in entries)

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete(f"{self.LIST_URL}/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_weight_stats_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.STATS_URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total_entries"] == 0

    def test_weight_stats(self, client: TestClient, auth_headers: dict):
        today_str = date.today().isoformat()
        client.post(self.LIST_URL, json={"weight_kg": 80.0, "date": today_str}, headers=auth_headers)
        client.post(self.LIST_URL, json={"weight_kg": 79.0, "date": today_str}, headers=auth_headers)
        client.post(self.LIST_URL, json={"weight_kg": 81.0, "date": (date.today() - timedelta(days=3)).isoformat()}, headers=auth_headers)

        resp = client.get(self.STATS_URL, headers=auth_headers)
        data = resp.json()
        assert data["total_entries"] == 3
        assert data["latest"]["weight_kg"] == 79.0  # most recent (by date desc + created_at desc)
        assert data["min"]["weight_kg"] == 79.0
        assert data["max"]["weight_kg"] == 81.0

    def test_avg_last_7_and_30_days(self, client: TestClient, auth_headers: dict):
        today = date.today()
        # Recent entries
        client.post(self.LIST_URL, json={"weight_kg": 80.0, "date": today.isoformat()}, headers=auth_headers)
        client.post(self.LIST_URL, json={"weight_kg": 81.0, "date": today.isoformat()}, headers=auth_headers)
        # Old entry (outside 7 days, within 30)
        old = (today - timedelta(days=14)).isoformat()
        client.post(self.LIST_URL, json={"weight_kg": 82.0, "date": old}, headers=auth_headers)
        # Very old entry (outside 30 days)
        very_old = (today - timedelta(days=45)).isoformat()
        client.post(self.LIST_URL, json={"weight_kg": 85.0, "date": very_old}, headers=auth_headers)

        resp = client.get(self.STATS_URL, headers=auth_headers)
        data = resp.json()
        assert data["total_entries"] == 4
        assert data["avg_7d"] is not None
        assert data["avg_30d"] is not None

    def test_streak_none(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.STREAK_URL, headers=auth_headers)
        assert resp.json()["current_streak"] == 0
        assert resp.json()["best_streak"] == 0

    def test_streak_consecutive_days(self, client: TestClient, auth_headers: dict):
        today = date.today()
        for i in range(3):
            d = (today - timedelta(days=i)).isoformat()
            client.post(self.LIST_URL, json={"weight_kg": 80.0 - i, "date": d}, headers=auth_headers)

        resp = client.get(self.STREAK_URL, headers=auth_headers)
        data = resp.json()
        assert data["current_streak"] == 3

    def test_streak_best(self, client: TestClient, auth_headers: dict):
        today = date.today()
        # 3 consecutive, gap, 2 consecutive
        for i in range(3):
            d = (today - timedelta(days=i)).isoformat()
            client.post(self.LIST_URL, json={"weight_kg": 80.0, "date": d}, headers=auth_headers)
        # gap
        client.post(self.LIST_URL, json={"weight_kg": 80.0, "date": (today - timedelta(days=5)).isoformat()}, headers=auth_headers)
        client.post(self.LIST_URL, json={"weight_kg": 80.0, "date": (today - timedelta(days=6)).isoformat()}, headers=auth_headers)

        resp = client.get(self.STREAK_URL, headers=auth_headers)
        data = resp.json()
        assert data["best_streak"] >= 3


# ─── Goal Progress ───────────────────────────────────────────

class TestGoalProgress:
    URL = "/api/v1/health/goal-progress"

    def test_no_goal(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.json()["goal_weight_kg"] is None

    def test_with_goal_and_weight(self, client: TestClient, auth_headers: dict):
        # Set goal
        client.put("/api/v1/health/profile", json={"goal_weight_kg": 75.0}, headers=auth_headers)
        # Log starting weight
        client.post("/api/v1/health/weight", json={
            "weight_kg": 85.0, "date": "2026-01-01",
        }, headers=auth_headers)
        # Log current weight (partial progress)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 80.0, "date": "2026-07-01",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["start_weight_kg"] == 85.0
        assert data["current_weight_kg"] == 80.0
        assert data["goal_weight_kg"] == 75.0
        assert data["remaining_kg"] == -5.0  # 75 - 80 = -5
        # progress = |85-80| / |85-75| * 100 = 5/10*100 = 50%
        assert data["progress_percentage"] == 50.0

    def test_progress_capped_at_100(self, client: TestClient, auth_headers: dict):
        client.put("/api/v1/health/profile", json={"goal_weight_kg": 70.0}, headers=auth_headers)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 90.0, "date": "2026-01-01",
        }, headers=auth_headers)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 70.0, "date": "2026-07-01",
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        # Exactly at goal = 100%
        assert resp.json()["progress_percentage"] == 100.0


# ─── Body Measurements ───────────────────────────────────────

class TestMeasurements:
    URL = "/api/v1/health/measurements"
    CHANGES_URL = "/api/v1/health/measurements/changes"

    def test_list_empty(self, client: TestClient, auth_headers: dict):
        assert client.get(self.URL, headers=auth_headers).json() == []

    def test_create(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "waist_cm": 85.0,
            "hips_cm": 95.0,
            "notes": "First measurement",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["waist_cm"] == 85.0
        assert data["hips_cm"] == 95.0
        assert data["notes"] == "First measurement"

    def test_update(self, client: TestClient, auth_headers: dict):
        create = client.post(self.URL, json={"waist_cm": 85.0}, headers=auth_headers).json()
        mid = create["id"]

        resp = client.put(f"{self.URL}/{mid}", json={"waist_cm": 83.0}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["waist_cm"] == 83.0

    def test_delete(self, client: TestClient, auth_headers: dict):
        create = client.post(self.URL, json={"waist_cm": 85.0}, headers=auth_headers).json()
        mid = create["id"]
        resp = client.delete(f"{self.URL}/{mid}", headers=auth_headers)
        assert resp.status_code == 204

    def test_changes_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.CHANGES_URL, headers=auth_headers)
        data = resp.json()
        assert data["first"] is None
        assert data["latest"] is None
        assert data["deltas"] == {}

    def test_changes_single_entry(self, client: TestClient, auth_headers: dict):
        client.post(self.URL, json={"waist_cm": 85.0, "chest_cm": 100.0}, headers=auth_headers)
        resp = client.get(self.CHANGES_URL, headers=auth_headers)
        data = resp.json()
        assert data["first"] is not None
        assert data["latest"] is not None
        # Single entry: first == latest; no deltas (need 2+ entries for comparison)
        assert data["deltas"] == {}

    def test_changes_delta(self, client: TestClient, auth_headers: dict):
        client.post(self.URL, json={
            "waist_cm": 90.0, "chest_cm": 100.0, "date": "2026-01-01",
        }, headers=auth_headers)
        client.post(self.URL, json={
            "waist_cm": 85.0, "chest_cm": 102.0, "date": "2026-07-01",
        }, headers=auth_headers)

        resp = client.get(self.CHANGES_URL, headers=auth_headers)
        data = resp.json()
        assert data["deltas"]["waist_cm"] == -5.0
        assert data["deltas"]["chest_cm"] == 2.0

    def test_changes_partial(self, client: TestClient, auth_headers: dict):
        """Field set only in latest, not in first → delta None."""
        client.post(self.URL, json={
            "waist_cm": 90.0, "date": "2026-01-01",
        }, headers=auth_headers)
        client.post(self.URL, json={
            "waist_cm": 85.0, "hips_cm": 95.0, "date": "2026-07-01",
        }, headers=auth_headers)

        resp = client.get(self.CHANGES_URL, headers=auth_headers)
        # hips_cm only in latest, not in first → None
        assert resp.json()["deltas"]["hips_cm"] is None


# ─── Wellness ─────────────────────────────────────────────────

class TestWellness:
    URL = "/api/v1/health/wellness"
    TRENDS_URL = "/api/v1/health/wellness/trends"

    def test_list_empty(self, client: TestClient, auth_headers: dict):
        assert client.get(self.URL, headers=auth_headers).json() == []

    def test_create(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "mood": 4,
            "energy": 3,
            "stress": 2,
            "sleep_hours": 7.5,
            "notes": "Good day",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["mood"] == 4
        assert data["energy"] == 3
        assert data["sleep_hours"] == 7.5

    def test_trends_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.TRENDS_URL, headers=auth_headers)
        assert resp.json()["weekly_averages"] == []

    def test_trends_with_data(self, client: TestClient, auth_headers: dict):
        client.post(self.URL, json={
            "mood": 4, "energy": 3, "stress": 2, "sleep_hours": 7.0,
            "date": "2026-07-01",
        }, headers=auth_headers)
        client.post(self.URL, json={
            "mood": 5, "energy": 4, "stress": 1, "sleep_hours": 8.0,
            "date": "2026-07-02",
        }, headers=auth_headers)

        resp = client.get(self.TRENDS_URL, headers=auth_headers)
        data = resp.json()
        assert len(data["weekly_averages"]) >= 1
        week = data["weekly_averages"][0]
        assert week["avg_mood"] >= 4.0
        assert week["entry_count"] >= 1

    def test_delete(self, client: TestClient, auth_headers: dict):
        created = client.post(self.URL, json={"mood": 3, "energy": 2}, headers=auth_headers).json()
        resp = client.delete(f"{self.URL}/{created['id']}", headers=auth_headers)
        assert resp.status_code == 204
        assert client.get(self.URL, headers=auth_headers).json() == []

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete(f"{self.URL}/9999", headers=auth_headers)
        assert resp.status_code == 404


# ─── Health Score ─────────────────────────────────────────────

class TestHealthScore:
    URL = "/api/v1/health/score"

    def test_no_data(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["score"] == 0.0
        assert data["spotlight"] == "Log your first weight to start tracking progress"

    def test_partial_data(self, client: TestClient, auth_headers: dict):
        # Add weight and height
        client.put("/api/v1/health/profile", json={"height_cm": 180.0}, headers=auth_headers)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 75.0, "date": date.today().isoformat(),
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["bmi_score"] > 0
        assert data["score"] > 0

    def test_full_score(self, client: TestClient, auth_headers: dict):
        # Set profile
        client.put("/api/v1/health/profile", json={
            "height_cm": 175.0, "goal_weight_kg": 70.0,
        }, headers=auth_headers)
        # Add weight (BMI in healthy range → 40 points)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 70.0, "date": date.today().isoformat(),
        }, headers=auth_headers)
        # Add a workout session (workout score)
        client.post("/api/v1/sessions", json={
            "template_name": "Test", "total_duration_seconds": 600, "total_kcal_estimated": 100.0,
            "exercises": [{"exercise_name": "Push-ups", "duration_seconds": 60, "kcal_burned": 10, "order_index": 0, "completed": True}],
        }, headers=auth_headers)
        # Add a measurement
        client.post("/api/v1/health/measurements", json={
            "waist_cm": 80.0, "date": date.today().isoformat(),
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["score"] > 0
        assert data["bmi_score"] >= 20
        assert data["workout_score"] > 0


# ─── BMI ──────────────────────────────────────────────────────

class TestBMI:
    URL = "/api/v1/health/bmi"

    def test_no_profile(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["bmi"] is None
        assert "Set your height" in data["message"]

    def test_no_weight(self, client: TestClient, auth_headers: dict):
        client.put("/api/v1/health/profile", json={"height_cm": 180.0}, headers=auth_headers)
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.json()["bmi"] is None
        assert "Log your weight" in resp.json()["message"]

    def test_bmi_calculation(self, client: TestClient, auth_headers: dict):
        # height=180cm, weight=81kg → BMI = 81/(1.8²) = 81/3.24 = 25.0 (overweight)
        client.put("/api/v1/health/profile", json={"height_cm": 180.0}, headers=auth_headers)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 81.0, "date": date.today().isoformat(),
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["bmi"] == 25.0
        assert data["category"] == "Overweight"
        assert data["color"] == "orange"

    def test_bmi_normal_range(self, client: TestClient, auth_headers: dict):
        # height=170cm, weight=65kg → BMI = 65/(1.7²) = 65/2.89 = 22.5 (normal)
        client.put("/api/v1/health/profile", json={"height_cm": 170.0}, headers=auth_headers)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 65.0, "date": date.today().isoformat(),
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["category"] == "Normal"
        assert data["color"] == "green"

    def test_bmi_with_birthday_age_adult(self, client: TestClient, auth_headers: dict):
        # Adult age (40 years old)
        client.put("/api/v1/health/profile", json={
            "height_cm": 160.0,
            "birthday": "1986-07-03",
        }, headers=auth_headers)
        client.post("/api/v1/health/weight", json={
            "weight_kg": 50.0, "date": date.today().isoformat(),
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        data = resp.json()
        assert data["age"] >= 38  # Age based on current year
        assert data["category"] in ("Normal", "Underweight")
