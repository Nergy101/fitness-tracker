"""Tests for Exercise CRUD endpoints."""

from fastapi.testclient import TestClient


class TestListExercises:
    def test_empty_list(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/exercises", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_seeded(self, client: TestClient, auth_headers: dict, seed_exercises):
        resp = client.get("/api/v1/exercises", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5
        # Sorted by name
        names = [e["name"] for e in data]
        assert names == sorted(names)

    def test_search_filter(self, client: TestClient, auth_headers: dict, seed_exercises):
        resp = client.get("/api/v1/exercises?search=push", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Push-up"

    def test_search_case_insensitive(self, client: TestClient, auth_headers: dict, seed_exercises):
        resp = client.get("/api/v1/exercises?search=JUMP", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Jumping Jack"

    def test_search_no_match(self, client: TestClient, auth_headers: dict, seed_exercises):
        resp = client.get("/api/v1/exercises?search=zzzzz", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetExercise:
    def test_get_existing(self, client: TestClient, auth_headers: dict, seed_exercise):
        resp = client.get(f"/api/v1/exercises/{seed_exercise.id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Push-up"
        assert data["category"] == "strength"
        assert data["default_kcal_per_min"] == 7.0
        assert data["default_duration_seconds"] == 30
        assert "id" in data
        assert "created_at" in data

    def test_get_missing(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/v1/exercises/99999", headers=auth_headers)
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


class TestCreateExercise:
    CREATE_URL = "/api/v1/exercises"

    def test_create_valid(self, client: TestClient, auth_headers: dict):
        payload = {
            "name": "Burpee",
            "description": "Full body exercise",
            "category": "cardio",
            "default_kcal_per_min": 12.0,
            "default_duration_seconds": 30,
        }
        resp = client.post(self.CREATE_URL, json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Burpee"
        assert data["category"] == "cardio"
        assert data["id"] is not None

    def test_create_minimal(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.CREATE_URL, json={"name": "Sprint"}, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Sprint"
        assert data["description"] == ""
        assert data["category"] == "other"
        assert data["default_kcal_per_min"] == 5.0

    def test_create_no_name(self, client: TestClient, auth_headers: dict):
        resp = client.post(self.CREATE_URL, json={}, headers=auth_headers)
        assert resp.status_code == 422  # FastAPI validation error

    def test_create_image_url(self, client: TestClient, auth_headers: dict):
        payload = {
            "name": "Test Ex",
            "image_url": "https://example.com/ex.png",
        }
        resp = client.post(self.CREATE_URL, json=payload, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["image_url"] == "https://example.com/ex.png"


class TestUpdateExercise:
    def test_update_all_fields(self, client: TestClient, auth_headers: dict, seed_exercise):
        eid = seed_exercise.id
        payload = {
            "name": "Push-up Pro",
            "description": "Advanced",
            "category": "strength",
            "default_kcal_per_min": 8.5,
            "default_duration_seconds": 45,
        }
        resp = client.put(f"/api/v1/exercises/{eid}", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Push-up Pro"
        assert data["description"] == "Advanced"
        assert data["default_kcal_per_min"] == 8.5

    def test_update_partial(self, client: TestClient, auth_headers: dict, seed_exercise):
        eid = seed_exercise.id
        resp = client.put(f"/api/v1/exercises/{eid}", json={"name": "P-U"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "P-U"
        # Other fields unchanged
        assert resp.json()["category"] == "strength"

    def test_update_missing(self, client: TestClient, auth_headers: dict):
        resp = client.put("/api/v1/exercises/99999", json={"name": "Nope"}, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteExercise:
    def test_delete_existing(self, client: TestClient, auth_headers: dict, seed_exercise):
        eid = seed_exercise.id
        resp = client.delete(f"/api/v1/exercises/{eid}", headers=auth_headers)
        assert resp.status_code == 204
        # Verify it's gone
        resp2 = client.get(f"/api/v1/exercises/{eid}", headers=auth_headers)
        assert resp2.status_code == 404

    def test_delete_missing(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/api/v1/exercises/99999", headers=auth_headers)
        assert resp.status_code == 404
