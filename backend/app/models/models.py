from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    exercises = relationship("WorkoutTemplateExercise", back_populates="template", cascade="all, delete-orphan", order_by="WorkoutTemplateExercise.order_index")


class WorkoutTemplateExercise(Base):
    __tablename__ = "workout_template_exercises"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("workout_templates.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    duration_seconds = Column(Integer, default=30)
    order_index = Column(Integer, nullable=False)

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
