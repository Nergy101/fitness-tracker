from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import RunEntry, WorkoutSession, SessionExercise, WeightEntry
from app.schemas import (
    RunEntryCreate, RunEntryResponse, RunStatsResponse,
)

router = APIRouter(prefix="/api/v1/runs", tags=["runs"])


def _compute_pace(duration_seconds: int, distance_km: float) -> float:
    if distance_km <= 0:
        return 0.0
    return round(duration_seconds / distance_km, 1)


def _calc_run_kcal(distance_km: float, db: Session) -> float:
    """Estimate calories burned using a weight-based formula: 0.97 kcal per kg per km.
    Falls back to 75kg if no weight data is available."""
    latest = db.query(WeightEntry).order_by(WeightEntry.date.desc()).first()
    weight_kg = latest.weight_kg if latest else 75.0
    return round(0.97 * weight_kg * distance_km, 1)


def _create_workout_session(run: RunEntry, db: Session) -> None:
    """Create a matching WorkoutSession so runs appear in the unified History tab."""
    kcal = _calc_run_kcal(run.distance_km, db)

    session = WorkoutSession(
        template_id=None,
        template_name=f"Run: {run.distance_km:.1f}km",
        started_at=datetime.combine(run.date, datetime.min.time(), tzinfo=timezone.utc),
        finished_at=datetime.combine(run.date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(seconds=run.duration_seconds),
        total_duration_seconds=run.duration_seconds,
        total_kcal_estimated=kcal,
    )
    db.add(session)
    db.flush()

    ses_ex = SessionExercise(
        session_id=session.id,
        exercise_id=None,
        exercise_name="Running",
        duration_seconds=run.duration_seconds,
        kcal_burned=kcal,
        order_index=0,
        completed=True,
    )
    db.add(ses_ex)
    db.commit()


def _delete_workout_session(run: RunEntry, db: Session) -> None:
    """Remove the associated WorkoutSession when a run is deleted."""
    date_start = datetime.combine(run.date, datetime.min.time(), tzinfo=timezone.utc)
    date_end = date_start + timedelta(days=1)
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.template_name.ilike(f"Run: {run.distance_km:.1f}km"),
        WorkoutSession.started_at >= date_start,
        WorkoutSession.started_at < date_end,
    ).all()
    for s in sessions:
        db.delete(s)
    db.commit()


@router.get("", response_model=list[RunEntryResponse])
def list_runs(db: Session = Depends(get_db)):
    return db.query(RunEntry).order_by(RunEntry.date.desc(), RunEntry.created_at.desc()).all()


@router.post("", response_model=RunEntryResponse, status_code=201)
def create_run(data: RunEntryCreate, db: Session = Depends(get_db)):
    pace = _compute_pace(data.duration_seconds, data.distance_km)
    run = RunEntry(
        duration_seconds=data.duration_seconds,
        distance_km=data.distance_km,
        pace_per_km=pace,
        date=data.date or date.today(),
        notes=data.notes,
    )
    db.add(run)
    db.flush()

    # Also create a matching WorkoutSession for the unified history
    _create_workout_session(run, db)

    db.refresh(run)
    return run


@router.put("/{run_id}", response_model=RunEntryResponse)
def update_run(run_id: int, data: RunEntryCreate, db: Session = Depends(get_db)):
    run = db.get(RunEntry, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.duration_seconds = data.duration_seconds
    run.distance_km = data.distance_km
    run.pace_per_km = _compute_pace(data.duration_seconds, data.distance_km)
    if data.date:
        run.date = data.date
    run.notes = data.notes
    db.commit()
    db.refresh(run)
    return run


@router.delete("/{run_id}", status_code=204)
def delete_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(RunEntry, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    _delete_workout_session(run, db)
    db.delete(run)
    db.commit()


@router.get("/stats", response_model=RunStatsResponse)
def run_stats(db: Session = Depends(get_db)):
    entries = db.query(RunEntry).order_by(RunEntry.date.asc()).all()
    if not entries:
        return RunStatsResponse()

    total_runs = len(entries)
    total_distance = sum(e.distance_km for e in entries)
    total_duration = sum(e.duration_seconds for e in entries)
    avg_pace = round(total_duration / total_distance, 1) if total_distance > 0 else None

    # Weekly breakdown
    today = date.today()
    current_week_start = today - timedelta(days=today.weekday())
    prev_week_start = current_week_start - timedelta(days=7)

    current_week_dist = sum(
        e.distance_km for e in entries
        if current_week_start <= e.date <= today
    )
    prev_week_dist = sum(
        e.distance_km for e in entries
        if prev_week_start <= e.date < current_week_start
    )

    # Best week (rolling 7-day window)
    best_week = 0.0
    sorted_dates = sorted(set(e.date for e in entries))
    for d in sorted_dates:
        window_end = d + timedelta(days=7)
        week_dist = sum(e.distance_km for e in entries if d <= e.date <= window_end)
        best_week = max(best_week, week_dist)

    # Personal records
    sorted_by_dist = sorted(entries, key=lambda e: e.distance_km, reverse=True)
    fastest_5k = None
    fastest_10k = None
    longest_run = sorted_by_dist[0] if sorted_by_dist else None

    for e in entries:
        if 4.5 <= e.distance_km <= 5.5:
            if fastest_5k is None or e.duration_seconds < fastest_5k:
                fastest_5k = e.duration_seconds
        if 9.5 <= e.distance_km <= 10.5:
            if fastest_10k is None or e.duration_seconds < fastest_10k:
                fastest_10k = e.duration_seconds

    # Monthly breakdown (last 6 months)
    monthly = {}
    for e in entries:
        key = e.date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "distance_km": 0.0, "duration_seconds": 0, "runs": 0}
        monthly[key]["distance_km"] += e.distance_km
        monthly[key]["duration_seconds"] += e.duration_seconds
        monthly[key]["runs"] += 1

    monthly_list = sorted(monthly.values(), key=lambda m: m["month"], reverse=True)[:6]
    for m in monthly_list:
        m["distance_km"] = round(m["distance_km"], 1)
        m["pace"] = round(m["duration_seconds"] / m["distance_km"], 1) if m["distance_km"] > 0 else None

    return RunStatsResponse(
        total_runs=total_runs,
        total_distance_km=round(total_distance, 1),
        total_duration_seconds=total_duration,
        avg_pace_per_km=avg_pace,
        current_week_distance_km=round(current_week_dist, 1),
        previous_week_distance_km=round(prev_week_dist, 1),
        best_week_distance_km=round(best_week, 1),
        fastest_5k_seconds=fastest_5k,
        fastest_10k_seconds=fastest_10k,
        longest_run_seconds=longest_run.duration_seconds if longest_run else None,
        longest_run_distance_km=longest_run.distance_km if longest_run else None,
        monthly_breakdown=monthly_list,
    )