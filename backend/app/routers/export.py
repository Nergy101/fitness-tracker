"""CSV data export (NER-190).

Provides a single endpoint, ``GET /api/v1/export/{entity}``, that streams each
data type as CSV with a ``Content-Disposition`` attachment header so the browser
downloads it. No password hashes or credentials are included — only user data.
"""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    WorkoutSession,
    WeightEntry,
    RunEntry,
    BoxingEntry,
    CyclingEntry,
    BodyMeasurement,
    WellnessCheckin,
    InjuryMarker,
)

router = APIRouter(prefix="/api/v1/export", tags=["export"])

_ENTITIES = {
    "sessions",
    "weights",
    "runs",
    "boxing",
    "cycling",
    "measurements",
    "wellness",
    "injuries",
}


def _iso(dt_val) -> str:
    if dt_val is None:
        return ""
    return dt_val.isoformat() if hasattr(dt_val, "isoformat") else str(dt_val)


def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _session_rows(db: Session) -> list[list]:
    rows: list[list] = []
    for s in db.query(WorkoutSession).order_by(WorkoutSession.started_at).all():
        for se in s.exercises or []:
            for log in se.logs or []:
                rows.append([
                    _iso(s.started_at),
                    s.template_name,
                    s.total_duration_seconds,
                    round(s.total_kcal_estimated, 1) if s.total_kcal_estimated else "",
                    se.exercise_name,
                    log.weight_kg if log.weight_kg is not None else "",
                    log.reps if log.reps is not None else "",
                    log.rpe if log.rpe is not None else "",
                    log.notes or "",
                    s.notes or "",
                ])
            if not (se.logs or []):
                rows.append([
                    _iso(s.started_at),
                    s.template_name,
                    s.total_duration_seconds,
                    round(s.total_kcal_estimated, 1) if s.total_kcal_estimated else "",
                    se.exercise_name,
                    "", "", "", "", s.notes or "",
                ])
    return rows


@router.get("/{entity}")
def export_entity(entity: str, db: Session = Depends(get_db)):
    """Stream one entity as CSV. Valid entities: sessions, weights, runs, boxing,
    cycling, measurements, wellness, injuries."""
    if entity not in _ENTITIES:
        raise HTTPException(status_code=404, detail=f"Unknown export entity '{entity}'")

    if entity == "sessions":
        header = ["started_at", "template_name", "duration_seconds", "kcal", "exercise", "weight_kg", "reps", "rpe", "set_notes", "session_notes"]
        return _csv_response(_session_rows(db), header, "sessions.csv")

    if entity == "weights":
        header = ["date", "weight_kg", "notes"]
        rows = [
            [w.date.isoformat(), w.weight_kg, w.notes or ""]
            for w in db.query(WeightEntry).order_by(WeightEntry.date).all()
        ]
        return _csv_response(rows, header, "weights.csv")

    if entity == "runs":
        header = ["date", "type", "distance_km", "duration_seconds", "pace_per_km", "notes"]
        rows = [
            [r.date.isoformat(), r.run_type, r.distance_km, r.duration_seconds,
             r.pace_per_km if r.pace_per_km is not None else "", r.notes or ""]
            for r in db.query(RunEntry).order_by(RunEntry.date).all()
        ]
        return _csv_response(rows, header, "runs.csv")

    if entity == "boxing":
        header = ["date", "duration_seconds", "kcal_per_min", "rounds", "notes"]
        rows = [
            [b.date.isoformat(), b.duration_seconds, b.kcal_per_min,
             b.rounds if b.rounds is not None else "", b.notes or ""]
            for b in db.query(BoxingEntry).order_by(BoxingEntry.date).all()
        ]
        return _csv_response(rows, header, "boxing.csv")

    if entity == "cycling":
        header = ["date", "duration_seconds", "distance_km", "notes"]
        rows = [
            [c.date.isoformat(), c.duration_seconds, c.distance_km, c.notes or ""]
            for c in db.query(CyclingEntry).order_by(CyclingEntry.date).all()
        ]
        return _csv_response(rows, header, "cycling.csv")

    if entity == "measurements":
        fields = ["date", "waist_cm", "hips_cm", "chest_cm", "left_arm_cm", "right_arm_cm",
                  "left_thigh_cm", "right_thigh_cm", "neck_cm", "estimated_body_fat_pct",
                  "body_fat_method", "notes"]
        rows = [
            [getattr(m, f) if getattr(m, f) is not None else "" for f in fields]
            for m in db.query(BodyMeasurement).order_by(BodyMeasurement.date).all()
        ]
        return _csv_response(rows, fields, "measurements.csv")

    if entity == "wellness":
        fields = ["date", "mood", "energy", "stress", "sleep_hours", "notes"]
        rows = [
            [getattr(w, f) if getattr(w, f) is not None else "" for f in fields]
            for w in db.query(WellnessCheckin).order_by(WellnessCheckin.date).all()
        ]
        return _csv_response(rows, fields, "wellness.csv")

    # injuries
    fields = ["date", "body_part", "severity", "notes", "resolved_date"]
    rows = [
        [getattr(i, f) if getattr(i, f) is not None else "" for f in fields]
        for i in db.query(InjuryMarker).order_by(InjuryMarker.date).all()
    ]
    return _csv_response(rows, fields, "injuries.csv")
