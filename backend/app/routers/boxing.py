from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import BoxingEntry, WorkoutSession, SessionExercise
from app.schemas import BoxingEntryCreate, BoxingEntryResponse

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

    session = WorkoutSession(
        template_id=None,
        template_name=f"Boxing: {mins}min",
        started_at=datetime.combine(entry.date, datetime.min.time(), tzinfo=timezone.utc),
        finished_at=datetime.combine(entry.date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(seconds=entry.duration_seconds),
        total_duration_seconds=entry.duration_seconds,
        total_kcal_estimated=kcal,
        notes=entry.notes,
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


def _delete_workout_session(entry: BoxingEntry, db: Session) -> None:
    """Remove the associated WorkoutSession when a boxing entry is deleted."""
    date_start = datetime.combine(entry.date, datetime.min.time(), tzinfo=timezone.utc)
    date_end = date_start + timedelta(days=1)
    mins = entry.duration_seconds // 60
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.template_name.ilike(f"Boxing: {mins}min"),
        WorkoutSession.started_at >= date_start,
        WorkoutSession.started_at < date_end,
    ).all()
    for s in sessions:
        db.delete(s)
    db.commit()


@router.get("", response_model=list[BoxingEntryResponse])
def list_boxing(db: Session = Depends(get_db)):
    return db.query(BoxingEntry).order_by(BoxingEntry.date.desc(), BoxingEntry.created_at.desc()).all()


@router.post("", response_model=BoxingEntryResponse, status_code=201)
def create_boxing(data: BoxingEntryCreate, db: Session = Depends(get_db)):
    entry = BoxingEntry(
        duration_seconds=data.duration_seconds,
        kcal_per_min=data.kcal_per_min,
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
    if data.date:
        entry.date = data.date
    entry.notes = data.notes
    db.commit()

    # Update the associated WorkoutSession
    mins = entry.duration_seconds // 60
    kcal = _calc_boxing_kcal(entry.duration_seconds, entry.kcal_per_min)
    date_start = datetime.combine(entry.date, datetime.min.time(), tzinfo=timezone.utc)
    date_end = date_start + timedelta(days=1)
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.template_name.ilike(f"Boxing: {mins}min"),
        WorkoutSession.started_at >= date_start,
        WorkoutSession.started_at < date_end,
    ).all()
    for s in sessions:
        s.template_name = f"Boxing: {mins}min"
        s.total_duration_seconds = entry.duration_seconds
        s.total_kcal_estimated = kcal
        s.notes = entry.notes
        db.commit()

    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_boxing(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(BoxingEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Boxing entry not found")
    _delete_workout_session(entry, db)
    db.delete(entry)
    db.commit()
