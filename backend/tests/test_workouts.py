"""Tests for Workout Template CRUD endpoints."""

from fastapi.testclient import TestClient


class TestListWorkouts:
    URL = "/api/v1/workouts"

    def test_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_templates(self, client: TestClient, auth_headers: dict, seed_exercises):
        # Create a template first
        ex_id = seed_exercises[0].id
        client.post(self.URL, json={
            "name": "Morning Routine",
            "exercises": [{"exercise_id": ex_id, "duration_seconds": 30, "order_index": 0}],
        }, headers=auth_headers)

        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Morning Routine"


class TestGetWorkout:
    def test_existing(self, client: TestClient, auth_headers: dict, seed_exercises):
        ex_id = seed_exercises[0].id
        create_resp = client.post("/api/v1/workouts", json={
            "name": "Full Body",
            "description": "All rounder",
            "rounds": 2,
            "rest_between_rounds": 60,
            "exercises": [
                {"exercise_id": ex_id, "duration_seconds": 30, "order_index": 0},
            ],
        }, headers=auth_headers)
        wid = create_resp.json()["id"]

        resp = client.get(f"/api/v1/workouts/{wid}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Full Body"
        assert data["description"] == "All rounder"
        assert data["rounds"] == 2
        assert data["rest_between_rounds"] == 60
        assert len(data["exercises"]) == 1
        assert data["exercises"][0]["exercise"]["name"] == "Push-up"
        # Computed durations
        assert data["work_duration_seconds"] == 60   # 30s * 2 rounds
        assert data["rest_duration_seconds"] == 60   # (2-1) * 60
        assert data["total_duration_seconds"] == 120

    def test_missing(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/workouts/99999", headers=auth_headers)
        assert resp.status_code == 404


class TestCreateWorkout:
    URL = "/api/v1/workouts"

    def test_create_minimal(self, client: TestClient, auth_headers: dict, seed_exercise):
        resp = client.post(self.URL, json={
            "name": "Quick Set",
            "exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}],
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Quick Set"
        assert data["rounds"] == 1
        assert len(data["exercises"]) == 1

    def test_create_with_multiple_exercises(self, client: TestClient, auth_headers: dict, seed_exercises):
        exercises = [{"exercise_id": e.id, "duration_seconds": 45, "order_index": i}
                     for i, e in enumerate(seed_exercises)]
        resp = client.post(self.URL, json={
            "name": "Circuit",
            "rounds": 3,
            "rest_between_rounds": 30,
            "exercises": exercises,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["rounds"] == 3
        assert len(data["exercises"]) == 5
        # work = 45*5*3 = 675, rest = (3-1)*30 = 60, total = 735
        assert data["work_duration_seconds"] == 675
        assert data["rest_duration_seconds"] == 60
        assert data["total_duration_seconds"] == 735

    def test_create_with_nonexistent_exercise(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={
            "name": "Bad",
            "exercises": [{"exercise_id": 99999, "order_index": 0}],
        }, headers=auth_headers)
        assert resp.status_code == 404

    def test_create_no_name(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.URL, json={"exercises": []}, headers=auth_headers)
        assert resp.status_code == 422


class TestUpdateWorkout:
    def test_update_basic(self, client: TestClient, auth_headers: dict, seed_exercises):
        # Create
        ex_id = seed_exercises[0].id
        create = client.post("/api/v1/workouts", json={
            "name": "Old Name",
            "exercises": [{"exercise_id": ex_id, "order_index": 0}],
        }, headers=auth_headers)
        wid = create.json()["id"]

        # Update name and rounds only
        resp = client.put(f"/api/v1/workouts/{wid}", json={
            "name": "New Name",
            "rounds": 3,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "New Name"
        assert data["rounds"] == 3

    def test_update_exercises(self, client: TestClient, auth_headers: dict, seed_exercises):
        ex1, ex2 = seed_exercises[0], seed_exercises[1]
        create = client.post("/api/v1/workouts", json={
            "name": "Test",
            "exercises": [{"exercise_id": ex1.id, "order_index": 0}],
        }, headers=auth_headers)
        wid = create.json()["id"]

        # Replace exercises
        resp = client.put(f"/api/v1/workouts/{wid}", json={
            "exercises": [
                {"exercise_id": ex2.id, "duration_seconds": 60, "order_index": 0},
            ],
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["exercises"]) == 1
        assert resp.json()["exercises"][0]["exercise"]["name"] == "Squat"

    def test_update_missing(self, client: TestClient, auth_headers: dict):
        resp = client.put("/api/v1/workouts/99999", json={"name": "Nope"}, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteWorkout:
    def test_delete_existing(self, client: TestClient, auth_headers: dict, seed_exercise):
        create = client.post("/api/v1/workouts", json={
            "name": "Delete Me",
            "exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}],
        }, headers=auth_headers)
        wid = create.json()["id"]

        resp = client.delete(f"/api/v1/workouts/{wid}", headers=auth_headers)
        assert resp.status_code == 204

        resp2 = client.get(f"/api/v1/workouts/{wid}", headers=auth_headers)
        assert resp2.status_code == 404

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/api/v1/workouts/99999", headers=auth_headers)
        assert resp.status_code == 404
