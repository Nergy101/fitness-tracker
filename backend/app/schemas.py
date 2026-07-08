from datetime import datetime, date
from typing import Optional, Annotated
from pydantic import BaseModel
from pydantic.functional_validators import BeforeValidator


def _coerce_date(v):
    """Coerce string/date to date or None. Pydantic v2.13+ doesn't auto-coerce Optional[date]."""
    if v is None:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        parts = v.split("-")
        return date(int(parts[0]), int(parts[1]), int(parts[2]))
    return v


DateField = Annotated[Optional[date], BeforeValidator(_coerce_date)]


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
    rest_after_seconds: int = 0
    order_index: int = 0
    superset_group: Optional[int] = None


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
    mode: str = "circuit"
    time_cap_seconds: Optional[int] = None
    rounds: int = 1
    rest_between_rounds: int = 180
    is_pinned: bool = False
    pinned_order: Optional[int] = None
    warmup_seconds: int = 0
    cooldown_seconds: int = 0


class WorkoutTemplateCreate(WorkoutTemplateBase):
    exercises: list[WorkoutTemplateExerciseCreate] = []


class WorkoutTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    time_cap_seconds: Optional[int] = None
    rounds: Optional[int] = None
    rest_between_rounds: Optional[int] = None
    is_pinned: Optional[bool] = None
    pinned_order: Optional[int] = None
    warmup_seconds: Optional[int] = None
    cooldown_seconds: Optional[int] = None
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


class ExerciseLogCreate(BaseModel):
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    set_number: int = 1


class ExerciseLogResponse(BaseModel):
    id: int
    session_exercise_id: int
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    set_number: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionExerciseResponse(SessionExerciseBase):
    id: int
    session_id: int
    logs: list[ExerciseLogResponse] = []

    model_config = {"from_attributes": True}


class WorkoutSessionCreate(BaseModel):
    template_id: Optional[int] = None
    template_name: str = ""
    exercises: list[SessionExerciseCreate] = []
    total_duration_seconds: int = 0
    total_kcal_estimated: float = 0.0
    # Optional — set by history import to preserve original timing; the runner
    # omits them and the server stamps "now".
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


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


# ─── Health Schemas ─────────────────────────────────────────


class UserProfileResponse(BaseModel):
    height_cm: Optional[float] = None
    birthday: Optional[date] = None
    gender: Optional[str] = None
    goal_weight_kg: Optional[float] = None
    weight_unit: str = "kg"
    reminder_time: Optional[str] = None  # HH:MM format
    notifications_enabled: bool = False

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    height_cm: Optional[float] = None
    birthday: DateField = None
    gender: Optional[str] = None
    goal_weight_kg: Optional[float] = None
    weight_unit: Optional[str] = None
    reminder_time: Optional[str] = None
    notifications_enabled: Optional[bool] = None


class WeightEntryCreate(BaseModel):
    weight_kg: float
    date: DateField = None
    notes: str = ""


class WeightEntryResponse(BaseModel):
    id: int
    weight_kg: float
    date: date
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WeightStatsResponse(BaseModel):
    latest: Optional[WeightEntryResponse] = None
    min: Optional[WeightEntryResponse] = None
    max: Optional[WeightEntryResponse] = None
    avg_7d: Optional[float] = None
    avg_30d: Optional[float] = None
    total_entries: int = 0


class StreakResponse(BaseModel):
    current_streak: int = 0
    best_streak: int = 0
    last_logged_date: Optional[date] = None


class GoalProgressResponse(BaseModel):
    start_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    progress_percentage: Optional[float] = None
    remaining_kg: Optional[float] = None


class BodyMeasurementCreate(BaseModel):
    date: DateField = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    left_arm_cm: Optional[float] = None
    right_arm_cm: Optional[float] = None
    left_thigh_cm: Optional[float] = None
    right_thigh_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    estimated_body_fat_pct: Optional[float] = None
    body_fat_method: Optional[str] = None
    notes: str = ""


class BodyMeasurementResponse(BaseModel):
    id: int
    date: date
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    left_arm_cm: Optional[float] = None
    right_arm_cm: Optional[float] = None
    left_thigh_cm: Optional[float] = None
    right_thigh_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    estimated_body_fat_pct: Optional[float] = None
    body_fat_method: Optional[str] = None
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MeasurementChangesResponse(BaseModel):
    first: Optional[BodyMeasurementResponse] = None
    latest: Optional[BodyMeasurementResponse] = None
    deltas: dict[str, Optional[float]] = {}  # field_name -> delta


class WellnessCreate(BaseModel):
    date: DateField = None
    mood: Optional[int] = None
    energy: Optional[int] = None
    stress: Optional[int] = None
    sleep_hours: Optional[float] = None
    notes: str = ""


class WellnessResponse(BaseModel):
    id: int
    date: date
    mood: Optional[int] = None
    energy: Optional[int] = None
    stress: Optional[int] = None
    sleep_hours: Optional[float] = None
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WellnessTrendsResponse(BaseModel):
    weekly_averages: list[dict] = []  # [{week_start, avg_mood, avg_energy, avg_stress, avg_sleep}]


class HealthScoreResponse(BaseModel):
    score: float = 0.0
    bmi_score: float = 0.0
    workout_score: float = 0.0
    streak_score: float = 0.0
    measurement_score: float = 0.0
    spotlight: str = ""


# ─── Run Schemas ────────────────────────────────────────────


class RunEntryCreate(BaseModel):
    duration_seconds: int
    distance_km: float
    date: DateField = None
    notes: str = ""
    run_type: str = "run"  # run | walk


class RunEntryResponse(BaseModel):
    id: int
    duration_seconds: int
    distance_km: float
    pace_per_km: Optional[float] = None
    date: date
    notes: str
    run_type: str = "run"
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── PR / Stats Schemas ────────────────────────────────────


class PrsResponse(BaseModel):
    """Activity-level personal records, split by type (runs / walks /
    workouts) rather than per-exercise."""
    # Runs
    longest_run_km: float | None = None
    longest_run_seconds: int | None = None
    fastest_5k_seconds: int | None = None
    fastest_10k_seconds: int | None = None
    best_pace_seconds_per_km: float | None = None
    most_kcal_run: float | None = None
    best_week_run_km: float | None = None
    # Walks
    longest_walk_km: float | None = None
    longest_walk_seconds: int | None = None
    most_kcal_walk: float | None = None
    # Workouts
    longest_workout_seconds: int | None = None
    most_kcal_workout: float | None = None
    most_exercises_workout: int | None = None
    # Overall
    longest_streak_days: int = 0


class WeeklyActivityStats(BaseModel):
    """One week of activity, split by type so charts can stack without
    double-counting (run/walk mirror sessions are excluded from workouts)."""
    week_start: str
    workout_minutes: float
    run_minutes: float
    walk_minutes: float
    run_km: float
    walk_km: float
    workout_kcal: float
    run_kcal: float
    walk_kcal: float


class StatsOverviewResponse(BaseModel):
    activity_weekly: list[WeeklyActivityStats] = []
    total_kcal_burned: float = 0.0
    consistency_score_pct: float = 0.0
    total_sessions_all: int = 0
    total_runs: int = 0
    total_walks: int = 0
    current_month_minutes: float = 0.0
    previous_month_minutes: float = 0.0
    current_month_vs_previous_pct: float | None = None
    avg_weight_change_kg: float | None = None


class RunStatsResponse(BaseModel):
    total_runs: int = 0
    total_distance_km: float = 0.0
    total_duration_seconds: int = 0
    avg_pace_per_km: Optional[float] = None
    current_week_distance_km: float = 0.0
    previous_week_distance_km: float = 0.0
    best_week_distance_km: float = 0.0
    fastest_5k_seconds: Optional[int] = None
    fastest_10k_seconds: Optional[int] = None
    longest_run_seconds: Optional[int] = None
    longest_run_distance_km: Optional[float] = None
    monthly_breakdown: list[dict] = []


# ─── Apple Health import ───────────────────────────────────


class HealthImportResult(BaseModel):
    metrics_imported: int = 0
    workouts_imported: int = 0
    metric_types: int = 0
    earliest: str | None = None
    latest: str | None = None


class SleepStages(BaseModel):
    """Per-stage sleep hours from Health Auto Export; totalSleep (the point's
    `value`) is deep + core + rem — awake time is reported but not slept."""
    deep: float | None = None
    core: float | None = None
    rem: float | None = None
    awake: float | None = None


class HealthPoint(BaseModel):
    date: str
    value: float
    min: float | None = None
    max: float | None = None
    stages: SleepStages | None = None


class HealthSeries(BaseModel):
    metric: str
    label: str
    unit: str
    points: list[HealthPoint] = []


class HealthInsightsResponse(BaseModel):
    series: list[HealthSeries] = []


class HealthWorkoutSummary(BaseModel):
    date: str
    name: str
    duration_min: float | None = None
    distance_km: float | None = None
    energy_kcal: float | None = None
    avg_hr: float | None = None
    max_hr: float | None = None


class HealthWorkoutsResponse(BaseModel):
    workouts: list[HealthWorkoutSummary] = []


class DailyActivityPoint(BaseModel):
    date: str
    minutes: float
    kcal: float


class DailyActivityResponse(BaseModel):
    days: list[DailyActivityPoint] = []
