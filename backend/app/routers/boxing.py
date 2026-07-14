from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import BoxingEntry, WorkoutSession, SessionExercise
from app.schemas import BoxingEntryCreate, BoxingEntryResponse, BoxingStatsResponse, MonthlyBoxingStats, BoxingPrsResponse

router = APIRouter(prefix="/api/v1/boxing", tags=["boxing"])

# Average kcal/min for cardio boxing (moderate-to-vigorous intensity).
DEFAULT_KCAL_PER_MIN = 10.0


def _calc_boxing_kcal(duration_seconds: int, kcal_per_min: float) -> float:
    return round((duration_seconds / 60) * kcal_per_min, 1)


def _create_workout_session(entry: BoxingEntry, db: Session) -> None:
    """Mirror this boxing entry into a WorkoutSession so it appears in the
    unified History tab (orange workout card)."""
    kcal = _calc_boxing_kcal(entry.duration_seconds, entry.kcal_per_min)
    mins = entry.duration_seconds // 60

    # Build notes with rounds info if present
    session_notes = entry.notes
    if entry.rounds:
        session_notes = f"{session_notes} ({entry.rounds} rounds)".strip()

    session = WorkoutSession(
        template_id=None,
        template_name=f"Boxing: {mins}min",
        boxing_entry_id=entry.id,
        started_at=datetime.combine(entry.date, datetime.min.time()),
        finished_at=datetime.combine(entry.date, datetime.min.time()) + timedelta(seconds=entry.duration_seconds),
        total_duration_seconds=entry.duration_seconds,
        total_kcal_estimated=kcal,
        notes=session_notes,
    )
    db.add(session)
    db.flush()

    ses_ex = SessionExercise(
        session_id=session.id,
        exercise_id=None,
        exercise_name="Boxing",
        duration_seconds=entry.duration_seconds,
        kcal_burned=kcal,
        order_index=0,
        completed=True,
    )
    db.add(ses_ex)
    db.commit()


@router.get("", response_model=list[BoxingEntryResponse])
def list_boxing(db: Session = Depends(get_db)):
    return db.query(BoxingEntry).order_by(BoxingEntry.date.desc(), BoxingEntry.created_at.desc()).all()


@router.post("", response_model=BoxingEntryResponse, status_code=201)
def create_boxing(data: BoxingEntryCreate, db: Session = Depends(get_db)):
    entry = BoxingEntry(
        duration_seconds=data.duration_seconds,
        kcal_per_min=data.kcal_per_min,
        rounds=data.rounds,
        date=data.date or date.today(),
        notes=data.notes,
    )
    db.add(entry)
    db.flush()

    _create_workout_session(entry, db)

    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=BoxingEntryResponse)
def update_boxing(entry_id: int, data: BoxingEntryCreate, db: Session = Depends(get_db)):
    entry = db.get(BoxingEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Boxing entry not found")

    entry.duration_seconds = data.duration_seconds
    entry.kcal_per_min = data.kcal_per_min
    entry.rounds = data.rounds
    if data.date:
        entry.date = data.date
    entry.notes = data.notes
    db.commit()

    # Update the associated WorkoutSession
    mins = entry.duration_seconds // 60
    kcal = _calc_boxing_kcal(entry.duration_seconds, entry.kcal_per_min)
    # Build notes with rounds info if present
    session_notes = entry.notes
    if entry.rounds:
        session_notes = f"{session_notes} ({entry.rounds} rounds)".strip()
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.boxing_entry_id == entry.id,
    ).all()
    start = datetime.combine(entry.date, datetime.min.time())
    for s in sessions:
        s.template_name = f"Boxing: {mins}min"
        s.total_duration_seconds = entry.duration_seconds
        s.total_kcal_estimated = kcal
        s.notes = session_notes
        s.started_at = start
        s.finished_at = start + timedelta(seconds=entry.duration_seconds)
        for se in db.query(SessionExercise).filter(SessionExercise.session_id == s.id).all():
            se.duration_seconds = entry.duration_seconds
            se.kcal_burned = kcal
    db.commit()

    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_boxing(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(BoxingEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Boxing entry not found")
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.boxing_entry_id == entry.id,
    ).all()
    for s in sessions:
        db.delete(s)
    # Flush child deletes before removing the parent so FK enforcement passes.
    db.flush()
    db.delete(entry)
    db.commit()


@router.get("/stats", response_model=BoxingStatsResponse)
def boxing_stats(db: Session = Depends(get_db)):
    entries = db.query(BoxingEntry).order_by(BoxingEntry.date.asc()).all()
    if not entries:
        return BoxingStatsResponse()

    total_sessions = len(entries)
    total_duration = sum(e.duration_seconds for e in entries)
    total_hours = round(total_duration / 3600, 1)
    avg_duration = round(total_duration / total_sessions, 1) if total_sessions > 0 else None
    avg_kcal = round(sum(e.kcal_per_min for e in entries) / total_sessions, 1) if total_sessions > 0 else None
    total_kcal = round(sum((e.duration_seconds / 60) * e.kcal_per_min for e in entries), 1)
    # Avg rounds across entries that have rounds set
    entries_with_rounds = [e for e in entries if e.rounds is not None]
    avg_rounds = round(sum(e.rounds for e in entries_with_rounds) / len(entries_with_rounds), 1) if entries_with_rounds else None

    # Monthly breakdown
    monthly: dict[str, MonthlyBoxingStats] = {}
    for e in entries:
        key = e.date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = MonthlyBoxingStats(month=key, sessions=0, total_minutes=0, total_rounds=0)
        monthly[key].sessions += 1
        monthly[key].total_minutes += e.duration_seconds // 60
        if e.rounds is not None:
            monthly[key].total_rounds += e.rounds

    monthly_list = sorted(monthly.values(), key=lambda m: m.month, reverse=True)[:12]

    return BoxingStatsResponse(
        total_sessions=total_sessions,
        total_duration_seconds=total_duration,
        total_hours=total_hours,
        avg_duration_seconds=avg_duration,
        avg_kcal_per_min=avg_kcal,
        avg_rounds=avg_rounds,
        total_kcal_estimated=total_kcal,
        monthly_breakdown=monthly_list,
    )


@router.get("/prs", response_model=BoxingPrsResponse)
def boxing_prs(db: Session = Depends(get_db)):
    """Personal records for boxing sessions."""
    entries = db.query(BoxingEntry).all()
    if not entries:
        return BoxingPrsResponse()

    longest = max(e.duration_seconds for e in entries)
    most_kcal = max((e.duration_seconds / 60) * e.kcal_per_min for e in entries)
    total_hours = round(sum(e.duration_seconds for e in entries) / 3600, 1)
    entries_with_rounds = [e.rounds for e in entries if e.rounds is not None]
    most_rounds = max(entries_with_rounds) if entries_with_rounds else None

    return BoxingPrsResponse(
        longest_session_seconds=longest,
        most_kcal_session=round(most_kcal, 1),
        total_hours_all_time=total_hours,
        most_rounds_session=most_rounds,
    )
