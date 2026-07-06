from datetime import datetime, timezone, date
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, Date, Time
)
from sqlalchemy.orm import relationship
from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    category = Column(String(50), nullable=False, default="other")  # cardio, strength, flexibility, other
    default_kcal_per_min = Column(Float, default=5.0)
    default_duration_seconds = Column(Integer, default=30)
    image_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    mode = Column(String(20), nullable=False, default="circuit")  # circuit | amrap | emom
    time_cap_seconds = Column(Integer, nullable=True)  # for amrap mode
    rounds = Column(Integer, nullable=False, default=1)
    rest_between_rounds = Column(Integer, nullable=False, default=180)
    is_pinned = Column(Boolean, default=False)
    pinned_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    exercises = relationship("WorkoutTemplateExercise", back_populates="template", cascade="all, delete-orphan", order_by="WorkoutTemplateExercise.order_index")


class WorkoutTemplateExercise(Base):
    __tablename__ = "workout_template_exercises"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("workout_templates.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    duration_seconds = Column(Integer, default=30)
    rest_after_seconds = Column(Integer, default=0)
    order_index = Column(Integer, nullable=False)
    superset_group = Column(Integer, nullable=True)

    template = relationship("WorkoutTemplate", back_populates="exercises")
    exercise = relationship("Exercise")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("workout_templates.id"), nullable=True)
    template_name = Column(String(255), default="")  # snapshot in case template is deleted
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime, nullable=True)
    total_duration_seconds = Column(Integer, default=0)
    total_kcal_estimated = Column(Float, default=0.0)

    exercises = relationship("SessionExercise", back_populates="session", cascade="all, delete-orphan", order_by="SessionExercise.order_index")


class SessionExercise(Base):
    __tablename__ = "session_exercises"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("workout_sessions.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=True)
    exercise_name = Column(String(255), default="")  # snapshot
    duration_seconds = Column(Integer, default=30)
    kcal_burned = Column(Float, default=0.0)
    order_index = Column(Integer, nullable=False)
    completed = Column(Boolean, default=True)

    session = relationship("WorkoutSession", back_populates="exercises")
    logs = relationship("ExerciseLog", back_populates="session_exercise", cascade="all, delete-orphan", order_by="ExerciseLog.set_number")


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_exercise_id = Column(Integer, ForeignKey("session_exercises.id"), nullable=False)
    weight_kg = Column(Float, nullable=True)
    reps = Column(Integer, nullable=True)
    set_number = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session_exercise = relationship("SessionExercise", back_populates="logs")


# ─── Health Tracking Models ────────────────────────────────


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    height_cm = Column(Float, nullable=True)
    birthday = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)  # male, female, other
    goal_weight_kg = Column(Float, nullable=True)
    weight_unit = Column(String(10), default="kg")  # kg or lbs
    reminder_time = Column(Time, nullable=True)
    notifications_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class WeightEntry(Base):
    __tablename__ = "weight_entries"

    id = Column(Integer, primary_key=True, index=True)
    weight_kg = Column(Float, nullable=False)
    date = Column(Date, nullable=False, default=lambda: date.today())
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BodyMeasurement(Base):
    __tablename__ = "body_measurements"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, default=lambda: date.today())
    waist_cm = Column(Float, nullable=True)
    hips_cm = Column(Float, nullable=True)
    chest_cm = Column(Float, nullable=True)
    left_arm_cm = Column(Float, nullable=True)
    right_arm_cm = Column(Float, nullable=True)
    left_thigh_cm = Column(Float, nullable=True)
    right_thigh_cm = Column(Float, nullable=True)
    neck_cm = Column(Float, nullable=True)
    estimated_body_fat_pct = Column(Float, nullable=True)
    body_fat_method = Column(String(20), nullable=True)  # manual, navy
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class WellnessCheckin(Base):
    __tablename__ = "wellness_checkins"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, default=lambda: date.today())
    mood = Column(Integer, nullable=True)       # 1-5
    energy = Column(Integer, nullable=True)     # 1-5
    stress = Column(Integer, nullable=True)     # 1-5
    sleep_hours = Column(Float, nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RunEntry(Base):
    __tablename__ = "run_entries"

    id = Column(Integer, primary_key=True, index=True)
    duration_seconds = Column(Integer, nullable=False)
    distance_km = Column(Float, nullable=False)
    pace_per_km = Column(Float, nullable=True)  # computed: seconds per km
    date = Column(Date, nullable=False, default=lambda: date.today())
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    user_agent = Column(String(512), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
