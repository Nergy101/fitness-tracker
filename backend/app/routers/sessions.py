from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WorkoutSession, SessionExercise, WorkoutTemplate
from app.schemas import WorkoutSessionCreate, WorkoutSessionEnd, WorkoutSessionResponse, SessionExerciseResponse

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
    db.delete(session)
    db.commit()
