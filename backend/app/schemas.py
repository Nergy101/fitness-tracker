from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# --- Exercise Schemas ---
class ExerciseBase(BaseModel):
    name: str
    description: str = ""
    category: str = "other"
    default_kcal_per_min: float = 5.0
    default_duration_seconds: int = 30
    image_url: Optional[str] = None


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    default_kcal_per_min: Optional[float] = None
    default_duration_seconds: Optional[int] = None
    image_url: Optional[str] = None


class ExerciseResponse(ExerciseBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Workout Template Schemas ---
class WorkoutTemplateExerciseBase(BaseModel):
    exercise_id: int
    duration_seconds: int = 30
    order_index: int = 0


class WorkoutTemplateExerciseCreate(WorkoutTemplateExerciseBase):
    pass


class WorkoutTemplateExerciseResponse(WorkoutTemplateExerciseBase):
    id: int
    template_id: int
    exercise: Optional[ExerciseResponse] = None

    model_config = {"from_attributes": True}


class WorkoutTemplateBase(BaseModel):
    name: str
    description: str = ""
    rounds: int = 1
    rest_between_rounds: int = 180


class WorkoutTemplateCreate(WorkoutTemplateBase):
    exercises: list[WorkoutTemplateExerciseCreate] = []


class WorkoutTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rounds: Optional[int] = None
    rest_between_rounds: Optional[int] = None
    exercises: Optional[list[WorkoutTemplateExerciseCreate]] = None


class WorkoutTemplateResponse(WorkoutTemplateBase):
    id: int
    created_at: datetime
    exercises: list[WorkoutTemplateExerciseResponse] = []
    work_duration_seconds: int = 0
    rest_duration_seconds: int = 0
    total_duration_seconds: int = 0

    model_config = {"from_attributes": True}


# --- Session Schemas ---
class SessionExerciseBase(BaseModel):
    exercise_id: Optional[int] = None
    exercise_name: str = ""
    duration_seconds: int = 30
    kcal_burned: float = 0.0
    order_index: int = 0
    completed: bool = True


class SessionExerciseCreate(SessionExerciseBase):
    pass


class SessionExerciseResponse(SessionExerciseBase):
    id: int
    session_id: int

    model_config = {"from_attributes": True}


class WorkoutSessionCreate(BaseModel):
    template_id: Optional[int] = None
    template_name: str = ""
    exercises: list[SessionExerciseCreate] = []
    total_duration_seconds: int = 0
    total_kcal_estimated: float = 0.0


class WorkoutSessionEnd(BaseModel):
    finished_at: Optional[datetime] = None
    total_duration_seconds: Optional[int] = None
    total_kcal_estimated: Optional[float] = None


class WorkoutSessionResponse(BaseModel):
    id: int
    template_id: Optional[int] = None
    template_name: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    total_duration_seconds: int
    total_kcal_estimated: float
    exercises: list[SessionExerciseResponse] = []

    model_config = {"from_attributes": True}
