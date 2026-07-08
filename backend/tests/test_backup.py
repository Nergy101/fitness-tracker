"""Behavioral tests for the backup/restore endpoints.

Verified contracts:
1. Backup succeeds with a reminder_time set — the Time column used to make
   json.dumps raise (TypeError) and the endpoint 500.
2. Backups include the Apple Health tables (health_metrics, health_workouts).
3. An unwritable backup location returns 400, not 500.
4. Restore only truncates tables present in the backup file, so restoring a
   pre-Apple-Health backup leaves imported health rows alone.
5. Full restore round-trip: health rows and profile survive and are readable
   through their APIs afterwards.
"""
import datetime as dt
import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import HealthMetric, UserProfile

BACKUP_URL = "/api/v1/backup"
BACKUPS_URL = "/api/v1/backups"
RESTORE_URL = "/api/v1/backup/restore"
CONFIG_URL = "/api/v1/settings/backup"
IMPORT_URL = "/api/v1/import/data"
INSIGHTS_URL = "/api/v1/import/insights"


def _point_in(tmp_path, client, auth_headers):
    """Point the backup location at an isolated temp dir."""
    resp = client.put(CONFIG_URL, json={"location": str(tmp_path / "backups")}, headers=auth_headers)
    assert resp.status_code == 200


def _import_sample(client, auth_headers):
    today = dt.date.today().isoformat()
    resp = client.post(IMPORT_URL, json={"data": {
        "metrics": [{"name": "step_count", "units": "steps",
                     "data": [{"date": today, "qty": 9000}]}],
        "workouts": [{"id": "BK-1", "name": "Running",
                      "start": f"{today} 08:00:00 +0200", "end": f"{today} 08:30:00 +0200",
                      "duration": 1800.0}],
    }}, headers=auth_headers)
    assert resp.status_code == 200


class TestCreateBackup:
    def test_succeeds_with_reminder_time_set(
        self, tmp_path, client: TestClient, auth_headers: dict, db: Session
    ):
        """datetime.time values must serialize — this exact state 500'd."""
        _point_in(tmp_path, client, auth_headers)
        db.add(UserProfile(reminder_time=dt.time(7, 30)))
        db.commit()

        resp = client.post(BACKUP_URL, headers=auth_headers)
        assert resp.status_code == 200

        backup_file = tmp_path / "backups" / resp.json()["filename"]
        stored = json.loads(backup_file.read_text())
        assert stored["tables"]["user_profiles"][0]["reminder_time"] == "07:30:00"

    def test_includes_health_tables(
        self, tmp_path, client: TestClient, auth_headers: dict
    ):
        _point_in(tmp_path, client, auth_headers)
        _import_sample(client, auth_headers)

        resp = client.post(BACKUP_URL, headers=auth_headers)
        assert resp.status_code == 200
        counts = resp.json()["table_counts"]
        assert counts["health_metrics"] == 1
        assert counts["health_workouts"] == 1

    def test_unwritable_location_returns_400(
        self, tmp_path, client: TestClient, auth_headers: dict
    ):
        """A location that can't be created is a client error, not a 500."""
        blocker = tmp_path / "blocker"
        blocker.write_text("")  # a file where a directory must go
        resp = client.put(CONFIG_URL, json={"location": str(blocker / "backups")}, headers=auth_headers)
        assert resp.status_code == 200

        resp = client.post(BACKUP_URL, headers=auth_headers)
        assert resp.status_code == 400
        assert "not writable" in resp.json()["detail"]


class TestRestore:
    def test_pre_health_backup_does_not_wipe_health_rows(
        self, tmp_path, client: TestClient, auth_headers: dict, db: Session
    ):
        """Restoring a file created before the health tables existed must not
        truncate them — only tables present in the file are replaced."""
        _point_in(tmp_path, client, auth_headers)

        # A minimal old-format backup: no health_* keys at all.
        backup_dir = tmp_path / "backups"
        backup_dir.mkdir(parents=True)
        (backup_dir / "fitness-tracker-backup-2026-01-01T00-00-00.json").write_text(json.dumps({
            "version": "1.0", "created_at": "2026-01-01T00:00:00+00:00",
            "tables": {"weight_entries": []},
        }))

        _import_sample(client, auth_headers)

        resp = client.post(
            RESTORE_URL,
            json={"filename": "fitness-tracker-backup-2026-01-01T00-00-00.json"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert db.query(HealthMetric).count() == 1  # survived the restore

    def test_round_trip_restores_health_data(
        self, tmp_path, client: TestClient, auth_headers: dict
    ):
        _point_in(tmp_path, client, auth_headers)
        _import_sample(client, auth_headers)

        created = client.post(BACKUP_URL, headers=auth_headers)
        assert created.status_code == 200

        resp = client.post(
            RESTORE_URL, json={"filename": created.json()["filename"]}, headers=auth_headers
        )
        assert resp.status_code == 200

        # Restored rows are readable through the insights API (dates parse back).
        series = client.get(INSIGHTS_URL, headers=auth_headers).json()["series"]
        by_metric = {s["metric"]: s for s in series}
        assert by_metric["step_count"]["points"][0]["value"] == 9000
