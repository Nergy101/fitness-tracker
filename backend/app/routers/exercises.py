from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.models import Exercise, SessionExercise, ExerciseLog
from app.schemas import ExerciseCreate, ExerciseUpdate, ExerciseResponse, ExerciseLogResponse

router = APIRouter(prefix="/api/v1/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
def list_exercises(search: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Exercise)
    if search:
        query = query.filter(Exercise.name.ilike(f"%{search}%"))
    return query.order_by(Exercise.name).all()


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: int, db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.post("", response_model=ExerciseResponse, status_code=201)
def create_exercise(data: ExerciseCreate, db: Session = Depends(get_db)):
    exercise = Exercise(**data.model_dump())
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(exercise_id: int, data: ExerciseUpdate, db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(exercise, key, val)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    db.delete(exercise)
    db.commit()


@router.get("/{exercise_id}/logs", response_model=list[ExerciseLogResponse])
def get_exercise_logs(exercise_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """Return the most recent weight/reps logs for an exercise, for progressive overload."""
    # Join through session_exercises → exercise_logs, filtered by exercise_id
    logs = (
        db.query(ExerciseLog)
        .join(SessionExercise, ExerciseLog.session_exercise_id == SessionExercise.id)
        .filter(SessionExercise.exercise_id == exercise_id)
        .order_by(ExerciseLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ExerciseLogResponse(
            id=log.id,
            session_exercise_id=log.session_exercise_id,
            weight_kg=log.weight_kg,
            reps=log.reps,
            set_number=log.set_number,
            created_at=log.created_at,
        )
        for log in logs
    ]
