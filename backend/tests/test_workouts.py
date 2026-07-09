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


class TestTogglePin:
    URL = "/api/v1/workouts"

    def test_pin_workout(self, client: TestClient, auth_headers: dict, seed_exercise):
        # Create a workout
        create = client.post(self.URL, json={
            "name": "Pin Me",
            "exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}],
        }, headers=auth_headers)
        wid = create.json()["id"]
        assert create.json()["is_pinned"] is False
        assert create.json()["pinned_order"] is None

        # Pin it
        resp = client.patch(f"{self.URL}/{wid}/pin", json={"is_pinned": True}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_pinned"] is True
        assert resp.json()["pinned_order"] == 1

    def test_unpin_workout(self, client: TestClient, auth_headers: dict, seed_exercise):
        # Create and pin
        create = client.post(self.URL, json={
            "name": "Unpin Me",
            "is_pinned": True,
            "exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}],
        }, headers=auth_headers)
        wid = create.json()["id"]

        # Unpin
        resp = client.patch(f"{self.URL}/{wid}/pin", json={"is_pinned": False}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_pinned"] is False
        assert resp.json()["pinned_order"] is None

    def test_pinned_first_ordering(self, client: TestClient, auth_headers: dict, seed_exercise):
        # Create three workouts
        data = {"exercises": [{"exercise_id": seed_exercise.id, "order_index": 0}]}
        client.post(self.URL, json={"name": "Alpha", **data}, headers=auth_headers)
        b = client.post(self.URL, json={"name": "Beta", **data}, headers=auth_headers)
        client.post(self.URL, json={"name": "Gamma", **data}, headers=auth_headers)

        # Pin Beta
        client.patch(f"{self.URL}/{b.json()['id']}/pin", json={"is_pinned": True}, headers=auth_headers)

        # List — Beta should be first
        resp = client.get(self.URL, headers=auth_headers)
        assert resp.status_code == 200
        names = [w["name"] for w in resp.json()]
        assert names[0] == "Beta"  # pinned first
        assert "Alpha" in names[1:]
        assert "Gamma" in names[1:]

    def test_pin_missing(self, client: TestClient, auth_headers: dict):
        resp = client.patch(f"{self.URL}/99999/pin", json={"is_pinned": True}, headers=auth_headers)
        assert resp.status_code == 404

class TestDuplicateWorkout:
    BASE = "/api/v1/workouts"

    def _create_template(self, client: TestClient, auth_headers: dict,
                         name: str, exercises: list, **kwargs) -> dict:
        payload = {"name": name, "exercises": exercises, **kwargs}
        resp = client.post(self.BASE, json=payload, headers=auth_headers)
        assert resp.status_code == 201
        return resp.json()

    def test_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.post(f"{self.BASE}/99999/duplicate", headers=auth_headers)
        assert resp.status_code == 404

    def test_success_copies_fields(self, client: TestClient, auth_headers: dict, seed_exercises):
        ex0, ex1 = seed_exercises[0], seed_exercises[1]
        source = self._create_template(client, auth_headers, "Full Body", [
            {"exercise_id": ex0.id, "duration_seconds": 30, "rest_after_seconds": 15,
             "order_index": 0},
            {"exercise_id": ex1.id, "duration_seconds": 45, "rest_after_seconds": 0,
             "order_index": 1},
        ], description="All rounder", rounds=3, rest_between_rounds=45,
           warmup_seconds=60, cooldown_seconds=30, time_cap_seconds=600)
        src_id = source["id"]

        resp = client.post(f"{self.BASE}/{src_id}/duplicate", headers=auth_headers)
        assert resp.status_code == 201
        clone = resp.json()

        assert clone["id"] != src_id
        assert clone["name"] == "Full Body (Copy)"
        assert clone["description"] == source["description"]
        assert clone["mode"] == source["mode"]
        assert clone["rounds"] == source["rounds"]
        assert clone["rest_between_rounds"] == source["rest_between_rounds"]
        assert clone["warmup_seconds"] == source["warmup_seconds"]
        assert clone["cooldown_seconds"] == source["cooldown_seconds"]
        assert clone["time_cap_seconds"] == source["time_cap_seconds"]

        src_exs = sorted(source["exercises"], key=lambda e: e["order_index"])
        clone_exs = sorted(clone["exercises"], key=lambda e: e["order_index"])
        assert len(clone_exs) == len(src_exs)
        for src_ex, clone_ex in zip(src_exs, clone_exs):
            assert clone_ex["exercise_id"] == src_ex["exercise_id"]
            assert clone_ex["duration_seconds"] == src_ex["duration_seconds"]
            assert clone_ex["rest_after_seconds"] == src_ex["rest_after_seconds"]
            assert clone_ex["order_index"] == src_ex["order_index"]

    def test_naming_increment(self, client: TestClient, auth_headers: dict, seed_exercise):
        source = self._create_template(client, auth_headers, "Full Body", [
            {"exercise_id": seed_exercise.id, "duration_seconds": 30, "order_index": 0},
        ])

        copy1 = client.post(f"{self.BASE}/{source['id']}/duplicate",
                            headers=auth_headers).json()
        assert copy1["name"] == "Full Body (Copy)"

        copy2 = client.post(f"{self.BASE}/{copy1['id']}/duplicate",
                            headers=auth_headers).json()
        assert copy2["name"] == "Full Body (Copy 2)"

        copy3 = client.post(f"{self.BASE}/{copy2['id']}/duplicate",
                            headers=auth_headers).json()
        assert copy3["name"] == "Full Body (Copy 3)"

    def test_clone_is_unpinned_when_source_is_pinned(self, client: TestClient, auth_headers: dict, seed_exercise):
        source = self._create_template(client, auth_headers, "Pinned Workout", [
            {"exercise_id": seed_exercise.id, "duration_seconds": 30, "order_index": 0},
        ])
        src_id = source["id"]

        pin_resp = client.patch(f"{self.BASE}/{src_id}/pin",
                                json={"is_pinned": True}, headers=auth_headers)
        assert pin_resp.status_code == 200
        assert pin_resp.json()["is_pinned"] is True

        resp = client.post(f"{self.BASE}/{src_id}/duplicate", headers=auth_headers)
        assert resp.status_code == 201
        clone = resp.json()

        assert clone["is_pinned"] is False
        assert clone["pinned_order"] is None

    def test_source_unchanged_after_duplicate(self, client: TestClient, auth_headers: dict, seed_exercises):
        ex0, ex1 = seed_exercises[0], seed_exercises[1]
        source = self._create_template(client, auth_headers, "Original", [
            {"exercise_id": ex0.id, "duration_seconds": 30, "order_index": 0},
            {"exercise_id": ex1.id, "duration_seconds": 45, "order_index": 1},
        ])
        src_id = source["id"]

        client.post(f"{self.BASE}/{src_id}/duplicate", headers=auth_headers)

        get_resp = client.get(f"{self.BASE}/{src_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["name"] == "Original"
        assert len(fetched["exercises"]) == 2

        list_resp = client.get(self.BASE, headers=auth_headers)
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 2
