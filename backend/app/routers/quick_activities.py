from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import QuickActivityEntry, WorkoutSession, SessionExercise
from app.schemas import QuickActivityEntryCreate, QuickActivityEntryResponse

router = APIRouter(prefix="/api/v1/quick-activities", tags=["quick-activities"])

# Labels for the mirror session template_name.
ACTIVITY_LABELS: dict[str, str] = {
    "yoga": "Yoga",
    "cycling": "Cycling",
    "swimming": "Swimming",
    "hiit": "HIIT",
}


def _calc_kcal(duration_seconds: int, kcal_per_min: float) -> float:
    return round((duration_seconds / 60) * kcal_per_min, 1)


def _create_workout_session(entry: QuickActivityEntry, db: Session) -> None:
    """Mirror this quick activity into a WorkoutSession so it appears in the
    unified History tab and activity stats."""
    label = ACTIVITY_LABELS.get(entry.activity_type, entry.activity_type.title())
    kcal = _calc_kcal(entry.duration_seconds, entry.kcal_per_min)
    mins = entry.duration_seconds // 60

    session = WorkoutSession(
        template_id=None,
        template_name=f"{label}: {mins}min",
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
        exercise_name=label,
        duration_seconds=entry.duration_seconds,
        kcal_burned=kcal,
        order_index=0,
        completed=True,
    )
    db.add(ses_ex)
    db.commit()


def _delete_workout_session(entry: QuickActivityEntry, db: Session) -> None:
    """Remove the associated WorkoutSession when a quick activity is deleted."""
    label = ACTIVITY_LABELS.get(entry.activity_type, entry.activity_type.title())
    date_start = datetime.combine(entry.date, datetime.min.time(), tzinfo=timezone.utc)
    date_end = date_start + timedelta(days=1)
    mins = entry.duration_seconds // 60
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.template_name.ilike(f"{label}: {mins}min"),
        WorkoutSession.started_at >= date_start,
        WorkoutSession.started_at < date_end,
    ).all()
    for s in sessions:
        db.delete(s)
    db.commit()


@router.get("", response_model=list[QuickActivityEntryResponse])
def list_quick_activities(
    activity_type: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(QuickActivityEntry).order_by(
        QuickActivityEntry.date.desc(), QuickActivityEntry.created_at.desc()
    )
    if activity_type:
        q = q.filter(QuickActivityEntry.activity_type == activity_type)
    return q.all()


@router.post("", response_model=QuickActivityEntryResponse, status_code=201)
def create_quick_activity(data: QuickActivityEntryCreate, db: Session = Depends(get_db)):
    entry = QuickActivityEntry(
        activity_type=data.activity_type,
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


@router.put("/{entry_id}", response_model=QuickActivityEntryResponse)
def update_quick_activity(entry_id: int, data: QuickActivityEntryCreate, db: Session = Depends(get_db)):
    entry = db.get(QuickActivityEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Quick activity entry not found")

    entry.activity_type = data.activity_type
    entry.duration_seconds = data.duration_seconds
    entry.kcal_per_min = data.kcal_per_min
    if data.date:
        entry.date = data.date
    entry.notes = data.notes
    db.commit()

    # Update the associated WorkoutSession
    label = ACTIVITY_LABELS.get(entry.activity_type, entry.activity_type.title())
    mins = entry.duration_seconds // 60
    kcal = _calc_kcal(entry.duration_seconds, entry.kcal_per_min)
    date_start = datetime.combine(entry.date, datetime.min.time(), tzinfo=timezone.utc)
    date_end = date_start + timedelta(days=1)
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.template_name.ilike(f"{label}: {mins}min"),
        WorkoutSession.started_at >= date_start,
        WorkoutSession.started_at < date_end,
    ).all()
    for s in sessions:
        s.template_name = f"{label}: {mins}min"
        s.total_duration_seconds = entry.duration_seconds
        s.total_kcal_estimated = kcal
        s.notes = entry.notes
        db.commit()

    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_quick_activity(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(QuickActivityEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Quick activity entry not found")
    _delete_workout_session(entry, db)
    db.delete(entry)
    db.commit()