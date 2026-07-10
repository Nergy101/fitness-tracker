from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WorkoutSession, SessionExercise, WorkoutTemplate, ExerciseLog, RunEntry, BoxingEntry, is_mirror_session
from app.schemas import WorkoutSessionCreate, WorkoutSessionEnd, WorkoutSessionResponse, SessionExerciseResponse, ExerciseLogCreate, ExerciseLogResponse
from pydantic import BaseModel


class SessionPatch(BaseModel):
    started_at: Optional[datetime] = None
    notes: Optional[str] = None

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


def _build_session_response(session: WorkoutSession) -> WorkoutSessionResponse:
    ex_responses = [
        SessionExerciseResponse(
            id=se.id,
            session_id=se.session_id,
            exercise_id=se.exercise_id,
            exercise_name=se.exercise_name,
            duration_seconds=se.duration_seconds,
            kcal_burned=se.kcal_burned,
            order_index=se.order_index,
            completed=se.completed,
            logs=[
                ExerciseLogResponse(
                    id=log.id,
                    session_exercise_id=log.session_exercise_id,
                    weight_kg=log.weight_kg,
                    reps=log.reps,
                    set_number=log.set_number,
                    created_at=log.created_at,
                )
                for log in (se.logs or [])
            ],
        )
        for se in session.exercises
    ]
    return WorkoutSessionResponse(
        id=session.id,
        template_id=session.template_id,
        template_name=session.template_name,
        started_at=session.started_at,
        finished_at=session.finished_at,
        total_duration_seconds=session.total_duration_seconds,
        total_kcal_estimated=session.total_kcal_estimated,
        notes=session.notes or "",
        exercises=ex_responses,
    )


@router.get("", response_model=list[WorkoutSessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.started_at.desc()).all()
    return [_build_session_response(s) for s in sessions]


@router.get("/{session_id}", response_model=WorkoutSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(WorkoutSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _build_session_response(session)


@router.post("", response_model=WorkoutSessionResponse, status_code=201)
def create_session(data: WorkoutSessionCreate, db: Session = Depends(get_db)):
    template_name = data.template_name
    if data.template_id:
        template = db.get(WorkoutTemplate, data.template_id)
        if template:
            template_name = template.name

    session = WorkoutSession(
        template_id=data.template_id,
        template_name=template_name,
        started_at=data.started_at or datetime.now(timezone.utc),
        finished_at=data.finished_at,
        total_duration_seconds=data.total_duration_seconds,
        total_kcal_estimated=data.total_kcal_estimated,
        notes=data.notes,
    )
    db.add(session)
    db.flush()

    for i, ex_data in enumerate(data.exercises):
        ses_ex = SessionExercise(
            session_id=session.id,
            exercise_id=ex_data.exercise_id,
            exercise_name=ex_data.exercise_name,
            duration_seconds=ex_data.duration_seconds,
            kcal_burned=ex_data.kcal_burned,
            order_index=ex_data.order_index if ex_data.order_index else i,
            completed=ex_data.completed,
        )
        db.add(ses_ex)

    db.commit()
    db.refresh(session)
    return _build_session_response(session)


@router.patch("/{session_id}/end", response_model=WorkoutSessionResponse)
def end_session(session_id: int, data: WorkoutSessionEnd, db: Session = Depends(get_db)):
    session = db.get(WorkoutSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.finished_at = data.finished_at or datetime.now(timezone.utc)
    if data.total_duration_seconds is not None:
        session.total_duration_seconds = data.total_duration_seconds
    if data.total_kcal_estimated is not None:
        session.total_kcal_estimated = data.total_kcal_estimated

    db.commit()
    db.refresh(session)
    return _build_session_response(session)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(WorkoutSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Cascade-delete the underlying entry for run/walk/boxing mirror sessions.
    # Otherwise only the mirror WorkoutSession is removed, leaving an orphaned
    # RunEntry or BoxingEntry in the database (NER-150).
    name = session.template_name or ""
    session_date = session.started_at.date() if session.started_at else None

    if is_mirror_session(session) and session_date:
        if name.startswith(("Run:", "Walk:")):
            # Parse distance from "Run: 5.0km" or "Walk: 3.2km"
            try:
                dist_str = name.split(": ")[1].rstrip("km")
                distance = float(dist_str)
            except (IndexError, ValueError):
                distance = None

            if distance is not None:
                run_type = "walk" if name.startswith("Walk:") else "run"
                entries = db.query(RunEntry).filter(
                    RunEntry.date == session_date,
                    RunEntry.distance_km == distance,
                    RunEntry.run_type == run_type,
                ).all()
                for entry in entries:
                    db.delete(entry)

        elif name.startswith("Boxing:"):
            # Parse minutes from "Boxing: 30min"
            try:
                mins_str = name.split(": ")[1].rstrip("min")
                target_mins = int(mins_str)
            except (IndexError, ValueError):
                target_mins = None

            if target_mins is not None:
                entries = db.query(BoxingEntry).filter(
                    BoxingEntry.date == session_date,
                    BoxingEntry.duration_seconds == target_mins * 60,
                ).all()
                for entry in entries:
                    db.delete(entry)

    db.delete(session)
    db.commit()


@router.patch("/{session_id}", response_model=WorkoutSessionResponse)
def patch_session(session_id: int, data: SessionPatch, db: Session = Depends(get_db)):
    session = db.get(WorkoutSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if data.started_at is not None:
        session.started_at = data.started_at
    if data.notes is not None:
        session.notes = data.notes
    db.commit()
    db.refresh(session)
    return _build_session_response(session)


@router.post("/{session_id}/exercises/{se_id}/logs", response_model=list[ExerciseLogResponse], status_code=201)
def create_exercise_logs(
    session_id: int,
    se_id: int,
    logs: list[ExerciseLogCreate],
    db: Session = Depends(get_db),
):
    session_exercise = (
        db.query(SessionExercise)
        .filter(SessionExercise.id == se_id, SessionExercise.session_id == session_id)
        .first()
    )
    if not session_exercise:
        raise HTTPException(status_code=404, detail="Session exercise not found")

    existing = db.query(ExerciseLog).filter(
        ExerciseLog.session_exercise_id == se_id
    ).all()
    if existing:
        # Replace: delete old logs, insert new ones
        for el in existing:
            db.delete(el)
        db.flush()

    created = []
    for log_data in logs:
        el = ExerciseLog(
            session_exercise_id=se_id,
            weight_kg=log_data.weight_kg,
            reps=log_data.reps,
            set_number=log_data.set_number,
        )
        db.add(el)
        created.append(el)

    db.commit()
    for el in created:
        db.refresh(el)
    return [
        ExerciseLogResponse(
            id=el.id,
            session_exercise_id=el.session_exercise_id,
            weight_kg=el.weight_kg,
            reps=el.reps,
            set_number=el.set_number,
            created_at=el.created_at,
        )
        for el in created
    ]
