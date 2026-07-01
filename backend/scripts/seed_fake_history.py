"""Seed example workout-history sessions for demos/dev.

Ensures the base catalog + templates exist, wipes any existing sessions, then
generates deterministic sessions spread over the last few weeks so the History
tab's stats and weekly chart are populated. Run via `make run-fake-history`.

Deterministic (fixed RNG seed) and idempotent — re-running yields the same set.
"""
from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, engine, Base, ensure_schema  # noqa: E402
from app.models.models import (  # noqa: E402
    WorkoutTemplate,
    WorkoutSession,
    SessionExercise,
)
from seed import seed  # noqa: E402

# How many past days to spread sessions over, and roughly how often we train.
DAYS_BACK = 24
# Probability a given day has a workout (skips rest days naturally).
TRAIN_DAY_CHANCE = 0.6
DEFAULT_KCAL_PER_MIN = 5.0


def _session_from_template(tpl: WorkoutTemplate, started_at: datetime) -> WorkoutSession:
    per_round = sum(te.duration_seconds for te in tpl.exercises)
    work = per_round * tpl.rounds
    rest = max(0, tpl.rounds - 1) * tpl.rest_between_rounds
    total_duration = work + rest
    total_kcal = sum(
        (te.duration_seconds / 60)
        * (te.exercise.default_kcal_per_min if te.exercise else DEFAULT_KCAL_PER_MIN)
        for te in tpl.exercises
    ) * tpl.rounds

    session = WorkoutSession(
        template_id=tpl.id,
        template_name=tpl.name,
        started_at=started_at,
        finished_at=started_at + timedelta(seconds=total_duration),
        total_duration_seconds=total_duration,
        total_kcal_estimated=round(total_kcal, 1),
    )
    for i, te in enumerate(tpl.exercises):
        kcal = (te.duration_seconds / 60) * (
            te.exercise.default_kcal_per_min if te.exercise else DEFAULT_KCAL_PER_MIN
        )
        session.exercises.append(
            SessionExercise(
                exercise_id=te.exercise_id,
                exercise_name=te.exercise.name if te.exercise else "",
                duration_seconds=te.duration_seconds,
                kcal_burned=round(kcal, 1),
                order_index=i,
                completed=True,
            )
        )
    return session


def seed_fake_history() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    # Guarantee exercises + templates exist first.
    seed()

    rng = random.Random(1337)  # deterministic
    db = SessionLocal()
    try:
        templates = db.query(WorkoutTemplate).all()
        if not templates:
            print("No workout templates found — nothing to base history on.")
            return

        # Clear existing sessions so the demo set is clean and repeatable.
        removed = db.query(WorkoutSession).count()
        db.query(WorkoutSession).delete()
        db.commit()

        now = datetime.now(timezone.utc)
        added = 0
        for day in range(DAYS_BACK, -1, -1):
            if rng.random() > TRAIN_DAY_CHANCE:
                continue
            tpl = rng.choice(templates)
            # Train at a plausible hour, varied per day.
            started = (now - timedelta(days=day)).replace(
                hour=rng.choice([7, 8, 12, 18, 19, 20]),
                minute=rng.choice([0, 15, 30, 45]),
                second=0,
                microsecond=0,
            )
            db.add(_session_from_template(tpl, started))
            added += 1

        db.commit()
        print(
            f"Fake history seeded: removed {removed} old session(s), "
            f"added {added} across the last {DAYS_BACK} days."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed_fake_history()
