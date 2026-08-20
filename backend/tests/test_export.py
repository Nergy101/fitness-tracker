"""Tests for the CSV export endpoint (NER-190)."""

import csv
import io
from datetime import date, datetime, timezone

from app.models.models import (
    WeightEntry,
    RunEntry,
    BoxingEntry,
    CyclingEntry,
    BodyMeasurement,
    WellnessCheckin,
    InjuryMarker,
)


def _parse_csv(resp):
    return list(csv.reader(io.StringIO(resp.text)))


def test_export_requires_auth(client):
    resp = client.get("/api/v1/export/weights")
    assert resp.status_code == 401


def test_export_unknown_entity_404(client, auth_headers):
    resp = client.get("/api/v1/export/nope", headers=auth_headers)
    assert resp.status_code == 404


def test_export_weights(client, auth_headers, db):
    db.add(WeightEntry(weight_kg=80.5, date=date(2026, 8, 1), notes="morning"))
    db.add(WeightEntry(weight_kg=79.9, date=date(2026, 8, 2), notes=""))
    db.commit()

    resp = client.get("/api/v1/export/weights", headers=auth_headers)
    assert resp.status_code == 200
    assert "attachment; filename=weights.csv" in resp.headers["content-disposition"]
    rows = _parse_csv(resp)
    assert rows[0] == ["date", "weight_kg", "notes"]
    assert ["2026-08-01", "80.5", "morning"] in rows
    assert ["2026-08-02", "79.9", ""] in rows


def test_export_runs(client, auth_headers, db):
    db.add(RunEntry(duration_seconds=1800, distance_km=5.0, run_type="run", date=date(2026, 8, 3), notes="easy"))
    db.commit()
    resp = client.get("/api/v1/export/runs", headers=auth_headers)
    assert resp.status_code == 200
    rows = _parse_csv(resp)
    assert rows[0] == ["date", "type", "distance_km", "duration_seconds", "pace_per_km", "notes"]
    assert ["2026-08-03", "run", "5.0", "1800", "", "easy"] in rows


def test_export_boxing_and_cycling(client, auth_headers, db):
    db.add(BoxingEntry(duration_seconds=2700, kcal_per_min=10.0, rounds=3, date=date(2026, 8, 4), notes="sparring"))
    db.add(CyclingEntry(duration_seconds=3600, distance_km=25.0, date=date(2026, 8, 5), notes="commute"))
    db.commit()

    resp = client.get("/api/v1/export/boxing", headers=auth_headers)
    assert resp.status_code == 200
    rows = _parse_csv(resp)
    assert ["2026-08-04", "2700", "10.0", "3", "sparring"] in rows

    resp = client.get("/api/v1/export/cycling", headers=auth_headers)
    rows = _parse_csv(resp)
    assert ["2026-08-05", "3600", "25.0", "commute"] in rows


def test_export_measurements_wellness_injuries(client, auth_headers, db):
    db.add(BodyMeasurement(date=date(2026, 8, 1), waist_cm=90.0, chest_cm=100.0))
    db.add(WellnessCheckin(date=date(2026, 8, 1), mood=4, energy=3, sleep_hours=7.5))
    db.add(InjuryMarker(date=date(2026, 8, 1), body_part="knee", severity=2))
    db.commit()

    resp = client.get("/api/v1/export/measurements", headers=auth_headers)
    rows = _parse_csv(resp)
    assert rows[0][0] == "date"
    # columns: date, waist, hips, chest, ... waist=90, chest=100
    assert ["2026-08-01", "90.0", "", "100.0", "", "", "", "", "", "", "", ""] in rows

    resp = client.get("/api/v1/export/wellness", headers=auth_headers)
    rows = _parse_csv(resp)
    assert ["2026-08-01", "4", "3", "", "7.5", ""] in rows

    resp = client.get("/api/v1/export/injuries", headers=auth_headers)
    rows = _parse_csv(resp)
    assert ["2026-08-01", "knee", "2", "", ""] in rows


def test_export_sessions_includes_exercise_sets(client, auth_headers, db):
    from app.models.models import WorkoutSession, SessionExercise, ExerciseLog

    s = WorkoutSession(
        template_name="Full Body",
        started_at=datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc),
        total_duration_seconds=1800,
        total_kcal_estimated=250.0,
    )
    db.add(s)
    db.flush()
    se = SessionExercise(session_id=s.id, exercise_name="Push-up", order_index=0)
    db.add(se)
    db.flush()
    db.add(ExerciseLog(session_exercise_id=se.id, weight_kg=80, reps=10, set_number=1, rpe=8, notes="hard"))
    db.commit()

    resp = client.get("/api/v1/export/sessions", headers=auth_headers)
    assert resp.status_code == 200
    rows = _parse_csv(resp)
    assert rows[0][0] == "started_at"
    # started_at ISO, template name, duration, kcal, exercise, weight, reps, rpe, notes
    assert any(r[1] == "Full Body" and r[5] == "80.0" and r[6] == "10" and r[7] == "8" and r[8] == "hard" for r in rows)
