from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.models import WorkoutTemplate, WorkoutTemplateExercise, Exercise
from app.schemas import (
    WorkoutTemplateCreate, WorkoutTemplateUpdate, WorkoutTemplateResponse,
    WorkoutTemplateExerciseResponse
)

router = APIRouter(prefix="/api/v1/workouts", tags=["workouts"])


class PinToggle(BaseModel):
    is_pinned: bool


def _build_template_response(template: WorkoutTemplate) -> WorkoutTemplateResponse:
    per_round = sum(te.duration_seconds for te in template.exercises)
    work_duration = per_round * template.rounds
    rest_between = template.rest_between_rounds if template.rest_between_rounds else 0
    rest_duration = max(0, template.rounds - 1) * rest_between
    ex_responses = []
    for te in template.exercises:
        ex_responses.append(WorkoutTemplateExerciseResponse(
            id=te.id,
            template_id=te.template_id,
            exercise_id=te.exercise_id,
            duration_seconds=te.duration_seconds,
            rest_after_seconds=te.rest_after_seconds or 0,
            order_index=te.order_index,
            superset_group=te.superset_group,
            exercise=te.exercise,
        ))
    return WorkoutTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        mode=template.mode or "circuit",
        time_cap_seconds=template.time_cap_seconds,
        rounds=template.rounds,
        rest_between_rounds=template.rest_between_rounds,
        is_pinned=template.is_pinned or False,
        pinned_order=template.pinned_order,
        warmup_seconds=template.warmup_seconds or 0,
        cooldown_seconds=template.cooldown_seconds or 0,
        created_at=template.created_at,
        exercises=ex_responses,
        work_duration_seconds=work_duration,
        rest_duration_seconds=rest_duration,
        total_duration_seconds=work_duration + rest_duration + (template.warmup_seconds or 0) + (template.cooldown_seconds or 0),
    )


@router.get("", response_model=list[WorkoutTemplateResponse])
def list_workouts(db: Session = Depends(get_db)):
    templates = db.query(WorkoutTemplate).order_by(
        WorkoutTemplate.is_pinned.desc(),
        WorkoutTemplate.pinned_order.asc().nulls_last(),
        WorkoutTemplate.created_at.desc(),
    ).all()
    return [_build_template_response(t) for t in templates]


@router.get("/{workout_id}", response_model=WorkoutTemplateResponse)
def get_workout(workout_id: int, db: Session = Depends(get_db)):
    template = db.get(WorkoutTemplate, workout_id)
    if not template:
        raise HTTPException(status_code=404, detail="Workout template not found")
    return _build_template_response(template)


@router.post("", response_model=WorkoutTemplateResponse, status_code=201)
def create_workout(data: WorkoutTemplateCreate, db: Session = Depends(get_db)):
    template = WorkoutTemplate(name=data.name, description=data.description, mode=data.mode, time_cap_seconds=data.time_cap_seconds, rounds=data.rounds, rest_between_rounds=data.rest_between_rounds, warmup_seconds=data.warmup_seconds, cooldown_seconds=data.cooldown_seconds)
    if data.is_pinned:
        max_order = db.query(WorkoutTemplate.pinned_order).filter(
            WorkoutTemplate.is_pinned
        ).order_by(WorkoutTemplate.pinned_order.desc()).first()
        template.is_pinned = True
        template.pinned_order = (max_order[0] + 1) if max_order and max_order[0] is not None else 1
    db.add(template)
    db.flush()

    for i, ex_data in enumerate(data.exercises):
        exercise = db.get(Exercise, ex_data.exercise_id)
        if not exercise:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Exercise {ex_data.exercise_id} not found")
        template_exercise = WorkoutTemplateExercise(
            template_id=template.id,
            exercise_id=ex_data.exercise_id,
            duration_seconds=ex_data.duration_seconds or exercise.default_duration_seconds,
            rest_after_seconds=ex_data.rest_after_seconds or 0,
            order_index=ex_data.order_index if ex_data.order_index else i,
            superset_group=ex_data.superset_group,
        )
        db.add(template_exercise)

    db.commit()
    db.refresh(template)
    return _build_template_response(template)


@router.put("/{workout_id}", response_model=WorkoutTemplateResponse)
def update_workout(workout_id: int, data: WorkoutTemplateUpdate, db: Session = Depends(get_db)):
    template = db.get(WorkoutTemplate, workout_id)
    if not template:
        raise HTTPException(status_code=404, detail="Workout template not found")

    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.mode is not None:
        template.mode = data.mode
    if data.time_cap_seconds is not None:
        template.time_cap_seconds = data.time_cap_seconds
    if data.rounds is not None:
        template.rounds = data.rounds
    if data.rest_between_rounds is not None:
        template.rest_between_rounds = data.rest_between_rounds
    if data.is_pinned is not None:
        template.is_pinned = data.is_pinned
        if data.is_pinned and template.pinned_order is None:
            max_order = db.query(WorkoutTemplate.pinned_order).filter(
                WorkoutTemplate.is_pinned
            ).order_by(WorkoutTemplate.pinned_order.desc()).first()
            template.pinned_order = (max_order[0] + 1) if max_order and max_order[0] is not None else 1
        elif not data.is_pinned:
            template.pinned_order = None
    if data.pinned_order is not None:
        template.pinned_order = data.pinned_order
    if data.warmup_seconds is not None:
        template.warmup_seconds = data.warmup_seconds
    if data.cooldown_seconds is not None:
        template.cooldown_seconds = data.cooldown_seconds

    if data.exercises is not None:
        # Remove existing exercises
        db.query(WorkoutTemplateExercise).filter(
            WorkoutTemplateExercise.template_id == template.id
        ).delete()
        db.flush()

        for i, ex_data in enumerate(data.exercises):
            exercise = db.get(Exercise, ex_data.exercise_id)
            if not exercise:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Exercise {ex_data.exercise_id} not found")
            template_exercise = WorkoutTemplateExercise(
                template_id=template.id,
                exercise_id=ex_data.exercise_id,
                duration_seconds=ex_data.duration_seconds or exercise.default_duration_seconds,
                rest_after_seconds=ex_data.rest_after_seconds or 0,
                order_index=ex_data.order_index if ex_data.order_index else i,
                superset_group=ex_data.superset_group,
            )
            db.add(template_exercise)

    db.commit()
    db.refresh(template)
    return _build_template_response(template)


@router.patch("/{workout_id}/pin", response_model=WorkoutTemplateResponse)
def toggle_pin(workout_id: int, data: PinToggle, db: Session = Depends(get_db)):
    template = db.get(WorkoutTemplate, workout_id)
    if not template:
        raise HTTPException(status_code=404, detail="Workout template not found")

    template.is_pinned = data.is_pinned
    if data.is_pinned and template.pinned_order is None:
        max_order = db.query(WorkoutTemplate.pinned_order).filter(
            WorkoutTemplate.is_pinned
        ).order_by(WorkoutTemplate.pinned_order.desc()).first()
        template.pinned_order = (max_order[0] + 1) if max_order and max_order[0] is not None else 1
    elif not data.is_pinned:
        template.pinned_order = None

    db.commit()
    db.refresh(template)
    return _build_template_response(template)


@router.delete("/{workout_id}", status_code=204)
def delete_workout(workout_id: int, db: Session = Depends(get_db)):
    template = db.get(WorkoutTemplate, workout_id)
    if not template:
        raise HTTPException(status_code=404, detail="Workout template not found")
    db.delete(template)
    db.commit()
