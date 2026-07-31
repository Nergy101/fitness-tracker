"""Activity energy-expenditure estimates.

Pure functions — no DB session, no ORM models — so routers and Alembic data
migrations can share one source of truth for the formulas.
"""

from bisect import bisect_right

# Gross MET by average speed (km/h) for outdoor cycling, from the 2024 Adult
# Compendium of Physical Activities, Bicycling (codes 01018–01060). Each anchor
# is the midpoint of a published mph band:
#     5.5 mph ->  8.9 km/h -> 3.5   leisure
#     9.4 mph -> 15.1 km/h -> 5.8   leisure
#   10–11.9   -> 17.6 km/h -> 6.8   slow, light effort
#   12–13.9   -> 20.8 km/h -> 8.0   moderate effort
#   14–15.9   -> 24.1 km/h -> 10.0  fast, vigorous effort
#   16–19     -> 28.2 km/h -> 12.0  very fast, racing
#     >20 mph -> 32.2 km/h -> 16.8  racing, not drafting
# We interpolate between anchors instead of using the bands as steps: a band
# boundary would swing the estimate ~20% on a 0.2 km/h difference in average
# speed, which looks like a bug to anyone logging similar rides.
_CYCLING_MET_SPEEDS = (8.9, 15.1, 17.6, 20.8, 24.1, 28.2, 32.2)
_CYCLING_METS = (3.5, 5.8, 6.8, 8.0, 10.0, 12.0, 16.8)


def cycling_met(speed_kmh: float) -> float:
    """Gross MET for an average riding speed, clamped to the published range."""
    if speed_kmh <= _CYCLING_MET_SPEEDS[0]:
        return _CYCLING_METS[0]
    if speed_kmh >= _CYCLING_MET_SPEEDS[-1]:
        return _CYCLING_METS[-1]
    i = bisect_right(_CYCLING_MET_SPEEDS, speed_kmh)
    lo_speed, hi_speed = _CYCLING_MET_SPEEDS[i - 1], _CYCLING_MET_SPEEDS[i]
    lo_met, hi_met = _CYCLING_METS[i - 1], _CYCLING_METS[i]
    return lo_met + (hi_met - lo_met) * (speed_kmh - lo_speed) / (hi_speed - lo_speed)


def cycling_kcal(distance_km: float, duration_seconds: int, weight_kg: float) -> float:
    """Active (above-resting) kcal for a ride — the number a watch calls
    "active energy".

    1 MET is 1 kcal/kg/h, so gross burn is MET × kg × hours and the active part
    is (MET − 1) × kg × hours. Cycling burn is driven by speed rather than
    distance — 30 km in 1 h and 30 km in 2 h are very different rides — so the
    estimate needs both, unlike running where kcal/km is roughly constant.
    """
    hours = duration_seconds / 3600
    if hours <= 0 or distance_km <= 0:
        return 0.0
    met = cycling_met(distance_km / hours)
    return round((met - 1.0) * weight_kg * hours, 1)


# Superseded distance-only factor, kept so the data migration that recalibrated
# stored ride estimates can roll back.
LEGACY_CYCLING_FACTOR = 0.45


def legacy_cycling_kcal(distance_km: float, weight_kg: float) -> float:
    """Pre-recalibration estimate: a flat 0.45 kcal/kg/km regardless of speed."""
    return round(LEGACY_CYCLING_FACTOR * weight_kg * distance_km, 1)
