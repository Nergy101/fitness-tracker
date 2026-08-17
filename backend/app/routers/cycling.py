from datetime import date, datetime, timedelta

from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.pagination import apply_pagination
from app.energy import cycling_kcal
from app.models.models import CyclingEntry, WorkoutSession, SessionExercise, WeightEntry
from app.schemas import (
    CyclingEntryCreate, CyclingEntryResponse, CyclingStatsResponse, MonthlyCyclingStats,
    CyclingPrsResponse, DailyActivityPoint, DailyActivityResponse,
)

router = APIRouter(prefix="/api/v1/cycling", tags=["cycling"])


def _rider_weight_kg(db: Session, ride_date=None) -> float:
    """Weight nearest on-or-before `ride_date` (falling back to the earliest
    entry, then a 75 kg default) so historical rides aren't recomputed with
    today's weight."""
    entry = None
    if ride_date is not None:
        entry = (
            db.query(WeightEntry)
            .filter(WeightEntry.date <= ride_date)
            .order_by(WeightEntry.date.desc())
            .first()
        )
    if entry is None:
        entry = db.query(WeightEntry).order_by(WeightEntry.date.asc()).first()
    return entry.weight_kg if entry else 75.0


def _calc_cycling_kcal(
    distance_km: float, duration_seconds: int, db: Session, ride_date=None
) -> float:
    """Active kcal for a ride, from its average speed (see app.energy)."""
    return cycling_kcal(distance_km, duration_seconds, _rider_weight_kg(db, ride_date))


def _create_workout_session(entry: CyclingEntry, db: Session) -> None:
    """Mirror this cycling entry into a WorkoutSession for the unified History tab."""
    kcal = _calc_cycling_kcal(entry.distance_km, entry.duration_seconds, db, entry.date)

    start = datetime.combine(entry.date, datetime.min.time())
    session = WorkoutSession(
        template_id=None,
        template_name=f"Cycling: {entry.distance_km:.1f}km",
        cycling_entry_id=entry.id,
        started_at=start,
        finished_at=start + timedelta(seconds=entry.duration_seconds),
        total_duration_seconds=entry.duration_seconds,
        total_kcal_estimated=kcal,
        notes=entry.notes,
    )
    db.add(session)
    db.flush()

    ses_ex = SessionExercise(
        session_id=session.id,
        exercise_id=None,
        exercise_name="Cycling",
        duration_seconds=entry.duration_seconds,
        kcal_burned=kcal,
        order_index=0,
        completed=True,
    )
    db.add(ses_ex)
    db.commit()


@router.get("", response_model=list[CyclingEntryResponse])
def list_cycling(
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    query = db.query(CyclingEntry).order_by(CyclingEntry.date.desc(), CyclingEntry.created_at.desc())
    query = apply_pagination(query, limit, offset, response)
    return query.all()


@router.post("", response_model=CyclingEntryResponse, status_code=201)
def create_cycling(data: CyclingEntryCreate, db: Session = Depends(get_db)):
    entry = CyclingEntry(
        duration_seconds=data.duration_seconds,
        distance_km=data.distance_km,
        date=data.date or date.today(),
        notes=data.notes,
    )
    db.add(entry)
    db.flush()

    _create_workout_session(entry, db)

    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=CyclingEntryResponse)
def update_cycling(entry_id: int, data: CyclingEntryCreate, db: Session = Depends(get_db)):
    entry = db.get(CyclingEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Cycling entry not found")
    entry.duration_seconds = data.duration_seconds
    entry.distance_km = data.distance_km
    if data.date:
        entry.date = data.date
    entry.notes = data.notes
    db.commit()

    # Sync the associated WorkoutSession mirror
    kcal = _calc_cycling_kcal(entry.distance_km, entry.duration_seconds, db, entry.date)
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.cycling_entry_id == entry.id,
    ).all()
    start = datetime.combine(entry.date, datetime.min.time())
    for s in sessions:
        s.template_name = f"Cycling: {entry.distance_km:.1f}km"
        s.total_duration_seconds = entry.duration_seconds
        s.total_kcal_estimated = kcal
        s.notes = entry.notes
        s.started_at = start
        s.finished_at = start + timedelta(seconds=entry.duration_seconds)
        for se in db.query(SessionExercise).filter(SessionExercise.session_id == s.id).all():
            se.duration_seconds = entry.duration_seconds
            se.kcal_burned = kcal
    db.commit()

    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_cycling(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(CyclingEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Cycling entry not found")
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.cycling_entry_id == entry.id,
    ).all()
    for s in sessions:
        db.delete(s)
    db.flush()
    db.delete(entry)
    db.commit()


@router.get("/stats", response_model=CyclingStatsResponse)
def cycling_stats(db: Session = Depends(get_db)):
    entries = db.query(CyclingEntry).order_by(CyclingEntry.date.asc()).all()
    if not entries:
        return CyclingStatsResponse()

    total_sessions = len(entries)
    total_duration = sum(e.duration_seconds for e in entries)
    total_hours = round(total_duration / 3600, 1)
    total_distance = sum(e.distance_km for e in entries)
    avg_duration = round(total_duration / total_sessions, 1) if total_sessions > 0 else None
    avg_distance = round(total_distance / total_sessions, 1) if total_sessions > 0 else None
    total_kcal = round(
        sum(_calc_cycling_kcal(e.distance_km, e.duration_seconds, db, e.date) for e in entries), 1
    )

    # Monthly breakdown
    monthly: dict[str, MonthlyCyclingStats] = {}
    for e in entries:
        key = e.date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = MonthlyCyclingStats(month=key, sessions=0, total_minutes=0, total_km=0.0)
        monthly[key].sessions += 1
        monthly[key].total_minutes += e.duration_seconds // 60
        monthly[key].total_km += e.distance_km

    monthly_list = sorted(monthly.values(), key=lambda m: m.month, reverse=True)[:12]
    for m in monthly_list:
        m.total_km = round(m.total_km, 1)

    return CyclingStatsResponse(
        total_sessions=total_sessions,
        total_duration_seconds=total_duration,
        total_hours=total_hours,
        total_distance_km=round(total_distance, 1),
        avg_duration_seconds=avg_duration,
        avg_distance_km=avg_distance,
        total_kcal_estimated=total_kcal,
        monthly_breakdown=monthly_list,
    )


@router.get("/prs", response_model=CyclingPrsResponse)
def cycling_prs(db: Session = Depends(get_db)):
    """Personal records for cycling rides."""
    entries = db.query(CyclingEntry).all()
    if not entries:
        return CyclingPrsResponse()

    longest_km = max(e.distance_km for e in entries)
    longest_ride = next(e for e in entries if e.distance_km == longest_km)
    most_kcal = max(_calc_cycling_kcal(e.distance_km, e.duration_seconds, db, e.date) for e in entries)
    total_hours = round(sum(e.duration_seconds for e in entries) / 3600, 1)

    return CyclingPrsResponse(
        longest_ride_seconds=longest_ride.duration_seconds,
        longest_ride_km=longest_km,
        most_kcal_ride=round(most_kcal, 1),
        total_hours_all_time=total_hours,
    )


@router.get("/stats/trends", response_model=DailyActivityResponse)
def cycling_trends(days: int = 120, db: Session = Depends(get_db)):
    """Daily cycling minutes + kcal for the most recent `days` window.

    Kcal is the speed-based estimate (same `_calc_cycling_kcal` used when a
    ride is logged), so the Health chart matches the History/PR numbers.
    """
    cutoff = date.today() - timedelta(days=max(days, 1))
    entries = (
        db.query(CyclingEntry)
        .filter(CyclingEntry.date >= cutoff)
        .order_by(CyclingEntry.date.asc())
        .all()
    )

    per_day: dict[date, dict[str, float]] = defaultdict(lambda: {"minutes": 0.0, "kcal": 0.0})
    for e in entries:
        per_day[e.date]["minutes"] += e.duration_seconds / 60
        per_day[e.date]["kcal"] += _calc_cycling_kcal(e.distance_km, e.duration_seconds, db, e.date)

    return DailyActivityResponse(days=[
        DailyActivityPoint(date=d.isoformat(), minutes=round(v["minutes"], 1), kcal=round(v["kcal"], 1))
        for d, v in sorted(per_day.items())
    ])
