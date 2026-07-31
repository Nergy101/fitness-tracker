"""recalibrate stored cycling kcal estimates to the speed-based MET model

Cycling kcal used to be a flat 0.45 kcal/kg/km, which ignored speed and ran
~35% high against watch-measured active energy. The estimate is denormalised
onto each ride's mirror WorkoutSession (and its SessionExercise), so already
logged rides keep the old number until it is recomputed here.

Revision ID: a3f1c07d5b62
Revises: c4ff5c2c3579
Create Date: 2026-07-31 13:00:00.000000+00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.energy import cycling_kcal, legacy_cycling_kcal

# revision identifiers, used by Alembic.
revision: str = 'a3f1c07d5b62'
down_revision: Union[str, None] = 'c4ff5c2c3579'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RIDES = sa.text(
    "SELECT id, distance_km, duration_seconds, date FROM cycling_entries"
)
_WEIGHT_ON_OR_BEFORE = sa.text(
    "SELECT weight_kg FROM weight_entries WHERE date <= :ride_date "
    "ORDER BY date DESC LIMIT 1"
)
_EARLIEST_WEIGHT = sa.text(
    "SELECT weight_kg FROM weight_entries ORDER BY date ASC LIMIT 1"
)
_UPDATE_SESSION = sa.text(
    "UPDATE workout_sessions SET total_kcal_estimated = :kcal "
    "WHERE cycling_entry_id = :entry_id"
)
_UPDATE_SESSION_EXERCISES = sa.text(
    "UPDATE session_exercises SET kcal_burned = :kcal WHERE session_id IN "
    "(SELECT id FROM workout_sessions WHERE cycling_entry_id = :entry_id)"
)


def _rewrite_ride_kcal(recompute) -> None:
    """Recompute every cycling mirror's kcal with `recompute(km, seconds, kg)`."""
    conn = op.get_bind()
    if not sa.inspect(conn).has_table("cycling_entries"):
        return

    for ride in conn.execute(_RIDES).mappings():
        weight_kg = conn.execute(
            _WEIGHT_ON_OR_BEFORE, {"ride_date": ride["date"]}
        ).scalar()
        if weight_kg is None:
            weight_kg = conn.execute(_EARLIEST_WEIGHT).scalar() or 75.0
        kcal = recompute(ride["distance_km"], ride["duration_seconds"], weight_kg)
        params = {"kcal": kcal, "entry_id": ride["id"]}
        conn.execute(_UPDATE_SESSION, params)
        conn.execute(_UPDATE_SESSION_EXERCISES, params)


def upgrade() -> None:
    _rewrite_ride_kcal(cycling_kcal)


def downgrade() -> None:
    _rewrite_ride_kcal(
        lambda distance_km, _duration_seconds, weight_kg: legacy_cycling_kcal(
            distance_km, weight_kg
        )
    )
