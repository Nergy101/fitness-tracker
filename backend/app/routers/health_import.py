"""Apple Health import: ingest Health Auto Export JSON and expose curated
time-series for the Stats dashboard.

Health Auto Export (iOS) posts a document shaped like:
    {"data": {"metrics": [{name, units, data:[{date, qty|Avg|..., source}]}],
              "workouts": [{id, name, start, end, distance:{qty,units}, ...}]}}

Metrics are daily aggregates (one point per day at local midnight), so
(metric_name, date) is a stable idempotent key — a re-sync of the same day
overwrites in place. Workouts key on their export UUID.
"""
import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import HealthMetric, HealthWorkout
from app.schemas import (
    HealthImportResult, HealthInsightsResponse, HealthSeries, HealthPoint,
    HealthWorkoutSummary, HealthWorkoutsResponse, SleepStages,
)

router = APIRouter(prefix="/api/v1/import", tags=["import"])

# SQLite caps bound parameters (~32k on modern builds); keep inserts well under.
_CHUNK = 400
KJ_PER_KCAL = 4.184

# For metrics whose points have no plain `qty`, which field is the scalar.
_SCALAR_KEY = {"heart_rate": "Avg", "sleep_analysis": "totalSleep"}


# Health Auto Export normally emits `yyyy-MM-dd HH:mm:ss Z`, but aggregated
# sleep can be date-only, and some sources omit the timezone.
_DATE_FORMATS = ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d")


def _parse_dt(s) -> datetime | None:
    if not isinstance(s, str):
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _metric_qty(name: str, point: dict) -> float | None:
    # Prefer the metric-specific scalar (e.g. sleep's totalSleep) so aggregated
    # shapes win even if a stray `qty` is present; else the plain qty. Health
    # Auto Export's "aggregated" format emits {Min, Max, Avg} with no qty for
    # ANY metric — fall back to Avg so those imports aren't stored as NULL
    # (which made imports "succeed" while every insight series stayed empty).
    key = _SCALAR_KEY.get(name)
    if key and isinstance(point.get(key), (int, float)):
        return point[key]
    val = point.get("qty")
    if isinstance(val, (int, float)):
        return val
    avg = point.get("Avg")
    return avg if isinstance(avg, (int, float)) else None


def _nested_qty(container: dict, key: str) -> float | None:
    """Health Auto Export wraps workout scalars as {qty, units}; unwrap to the
    number (or accept a bare number / None)."""
    v = container.get(key)
    if isinstance(v, dict):
        v = v.get("qty")
    return v if isinstance(v, (int, float)) else None


def _chunked_upsert(db: Session, model, rows: list[dict], index_elements: list[str]) -> int:
    """Bulk INSERT ... ON CONFLICT DO UPDATE in param-safe chunks. Rows must
    already be de-duplicated on the conflict key (SQLite rejects touching the
    same row twice in one statement)."""
    if not rows:
        return 0
    update_cols = [c for c in rows[0].keys() if c not in index_elements]
    for i in range(0, len(rows), _CHUNK):
        batch = rows[i:i + _CHUNK]
        stmt = sqlite_insert(model).values(batch)
        stmt = stmt.on_conflict_do_update(
            index_elements=index_elements,
            set_={c: getattr(stmt.excluded, c) for c in update_cols},
        )
        db.execute(stmt)
    return len(rows)


# Metrics whose points are per-interval amounts: multiple points on one
# calendar day ADD UP (an hourly export has ~24 of them). Everything else is
# a gauge — same-day points average instead.
_CUMULATIVE = {
    "step_count", "active_energy", "basal_energy_burned", "apple_exercise_time",
    "apple_stand_time", "flights_climbed", "walking_running_distance", "distance",
    "swimming_distance", "cycling_distance",
}

# Sleep stage keys that sum across same-day fragments.
_SLEEP_STAGE_KEYS = ("totalSleep", "deep", "core", "rem", "awake", "asleep", "inBed")


def _merge_day_points(name: str, points: list[dict]) -> tuple[float | None, dict]:
    """Collapse all of a day's points into one (qty, extras) pair.

    Health Auto Export's aggregation setting decides how many points a day
    has: "Days" gives one (merge is the identity), "Hours"/"Minutes" give
    many. Keeping only the last one made a 3k-step day read as the final
    interval's 11 steps.
    """
    if len(points) == 1:
        pt = points[0]
        extra = {k: v for k, v in pt.items() if k not in ("date", "source", "qty")}
        return _metric_qty(name, pt), extra

    qtys = [q for q in (_metric_qty(name, p) for p in points) if q is not None]
    if not qtys:
        qty = None
    elif name in _CUMULATIVE or name == "sleep_analysis":
        qty = sum(qtys)
    else:
        qty = sum(qtys) / len(qtys)

    # Merged extras: keep the shapes downstream readers rely on.
    extra: dict = {}
    if name == "heart_rate":
        mins = [p["Min"] for p in points if isinstance(p.get("Min"), (int, float))]
        maxs = [p["Max"] for p in points if isinstance(p.get("Max"), (int, float))]
        if mins:
            extra["Min"] = min(mins)
        if maxs:
            extra["Max"] = max(maxs)
        if qty is not None:
            extra["Avg"] = qty
    elif name == "sleep_analysis":
        for key in _SLEEP_STAGE_KEYS:
            vals = [p[key] for p in points if isinstance(p.get(key), (int, float))]
            if vals:
                extra[key] = round(sum(vals), 4)
    else:
        extra = {k: v for k, v in points[-1].items() if k not in ("date", "source", "qty")}
    return qty, extra


@router.post("/data", response_model=HealthImportResult)
def import_data(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Ingest a Health Auto Export document. Idempotent: metrics upsert on
    (metric_name, date), workouts on their UUID — safe to call on every sync."""
    data = payload.get("data", payload) if isinstance(payload, dict) else {}

    # ── Metrics ── group every point by calendar day, then collapse.
    day_points: dict[tuple[str, date], list[dict]] = {}
    day_meta: dict[tuple[str, date], dict] = {}
    for m in data.get("metrics", []) or []:
        name = m.get("name")
        if not name:
            continue
        units = m.get("units", "") or ""
        for pt in m.get("data", []) or []:
            dt = _parse_dt(pt.get("date"))
            if dt is None:
                continue
            d = dt.date()
            day_points.setdefault((name, d), []).append(pt)
            day_meta[(name, d)] = {"units": units, "source": pt.get("source")}

    metric_rows: dict[tuple[str, date], dict] = {}
    for (name, d), pts in day_points.items():
        qty, extra = _merge_day_points(name, pts)
        metric_rows[(name, d)] = {
            "metric_name": name,
            "date": d,
            "units": day_meta[(name, d)]["units"],
            "qty": qty,
            "data": json.dumps(extra) if extra else None,
            "source": day_meta[(name, d)]["source"],
        }

    # ── Workouts ──
    workout_rows: dict[str, dict] = {}
    for w in data.get("workouts", []) or []:
        ext = w.get("id")
        if not ext:
            continue

        # Keep only scalar fields; drop the big point arrays (route, heart-rate
        # samples, per-second step/distance) so the row stays lean.
        scalars = {
            k: v for k, v in w.items()
            if not isinstance(v, list) and k not in ("metadata",)
        }
        workout_rows[ext] = {
            "external_id": ext,
            "name": w.get("name", "") or "",
            "location": w.get("location"),
            "start": _parse_dt(w.get("start")),
            "end": _parse_dt(w.get("end")),
            "duration_seconds": w.get("duration") if isinstance(w.get("duration"), (int, float)) else None,
            "distance_km": _nested_qty(w, "distance"),
            "active_energy_kj": _nested_qty(w, "activeEnergyBurned") or _nested_qty(w, "activeEnergy"),
            "total_energy_kj": _nested_qty(w, "totalEnergy"),
            "avg_heart_rate": _nested_qty(w, "avgHeartRate"),
            "max_heart_rate": _nested_qty(w, "maxHeartRate"),
            "data": json.dumps(scalars, default=str),
        }

    n_metrics = _chunked_upsert(db, HealthMetric, list(metric_rows.values()), ["metric_name", "date"])
    n_workouts = _chunked_upsert(db, HealthWorkout, list(workout_rows.values()), ["external_id"])
    db.commit()

    dates = [d for (_n, d) in metric_rows.keys()]
    return HealthImportResult(
        metrics_imported=n_metrics,
        workouts_imported=n_workouts,
        metric_types=len({n for (n, _d) in metric_rows.keys()}),
        earliest=min(dates).isoformat() if dates else None,
        latest=max(dates).isoformat() if dates else None,
    )


# Curated metrics surfaced on the dashboard — ones the app doesn't already
# track natively. (metric_name, label, display unit, convert-kJ-to-kcal).
# Energy units are user-configurable (kJ or kcal), so conversion is applied
# only when the stored unit is actually kJ.
_INSIGHTS: list[tuple[str, str, str, bool]] = [
    ("resting_heart_rate", "Resting Heart Rate", "bpm", False),
    ("vo2_max", "VO\u2082 Max", "ml/kg\u00b7min", False),
    ("step_count", "Daily Steps", "steps", False),
    ("sleep_analysis", "Sleep", "h", False),
    ("active_energy", "Active Energy", "kcal", True),
    ("apple_exercise_time", "Exercise Minutes", "min", False),
]


def _float_or_none(v) -> float | None:
    return v if isinstance(v, (int, float)) else None


def _sleep_stages(raw: str | None) -> SleepStages | None:
    """Stage hours from a sleep_analysis point's retained JSON; None when the
    export had no stage breakdown (e.g. non-Watch sources report only totals)."""
    extra = json.loads(raw) if raw else {}
    stages = SleepStages(
        deep=_float_or_none(extra.get("deep")),
        core=_float_or_none(extra.get("core")),
        rem=_float_or_none(extra.get("rem")),
        awake=_float_or_none(extra.get("awake")),
    )
    if stages.deep is None and stages.core is None and stages.rem is None:
        return None
    return stages


@router.get("/insights", response_model=HealthInsightsResponse)
def health_insights(days: int = 120, db: Session = Depends(get_db)):
    """Per-metric daily series for the curated dashboard metrics, most recent
    `days` window. Only metrics with data are returned."""
    cutoff = date.today() - timedelta(days=max(days, 1))
    series: list[HealthSeries] = []
    for name, label, unit, maybe_kj in _INSIGHTS:
        rows = db.execute(
            select(HealthMetric.date, HealthMetric.qty, HealthMetric.units, HealthMetric.data)
            .where(HealthMetric.metric_name == name, HealthMetric.date >= cutoff, HealthMetric.qty.isnot(None))
            .order_by(HealthMetric.date.asc())
        ).all()
        if not rows:
            continue
        # Convert each point to kcal only when that row was stored in kJ, so a
        # mid-history unit change doesn't skew the series.
        points = [
            HealthPoint(
                date=d.isoformat(),
                value=round(q / KJ_PER_KCAL if (maybe_kj and (u or "").lower() == "kj") else q, 2),
                stages=_sleep_stages(raw) if name == "sleep_analysis" else None,
            )
            for d, q, u, raw in rows
        ]
        series.append(HealthSeries(metric=name, label=label, unit=unit, points=points))

    # Heart-rate range band: qty is the daily Avg; Min/Max live in the raw
    # point JSON (import keeps every non-qty field there).
    hr_rows = db.execute(
        select(HealthMetric.date, HealthMetric.qty, HealthMetric.data)
        .where(HealthMetric.metric_name == "heart_rate", HealthMetric.date >= cutoff, HealthMetric.qty.isnot(None))
        .order_by(HealthMetric.date.asc())
    ).all()
    if hr_rows:
        points = []
        for d, q, raw in hr_rows:
            extra = json.loads(raw) if raw else {}
            points.append(HealthPoint(
                date=d.isoformat(),
                value=round(q, 2),
                min=_float_or_none(extra.get("Min")),
                max=_float_or_none(extra.get("Max")),
            ))
        series.append(HealthSeries(metric="heart_rate", label="Heart Rate", unit="bpm", points=points))

    return HealthInsightsResponse(series=series)


def _workout_energy_kcal(w: HealthWorkout) -> float | None:
    """Workout energy in kcal. The stored column follows the export's unit
    setting; the raw payload (kept in `data`) says which unit that was.
    Convert only when it was kJ — default kJ, matching the column contract."""
    kj = w.active_energy_kj if w.active_energy_kj is not None else w.total_energy_kj
    if kj is None:
        return None
    units = ""
    if w.data:
        raw = json.loads(w.data)
        for key in ("activeEnergyBurned", "activeEnergy", "totalEnergy"):
            v = raw.get(key)
            if isinstance(v, dict) and isinstance(v.get("units"), str):
                units = v["units"]
                break
    if units.lower() in ("kcal", "cal"):
        return round(kj, 1)
    return round(kj / KJ_PER_KCAL, 1)


@router.get("/workouts", response_model=HealthWorkoutsResponse)
def health_workouts(days: int = 120, db: Session = Depends(get_db)):
    """Imported workout summaries for the most recent `days` window, oldest
    first — feeds the intensity scatter on the Health tab."""
    cutoff = datetime.combine(date.today() - timedelta(days=max(days, 1)), datetime.min.time())
    rows = db.execute(
        select(HealthWorkout)
        .where(HealthWorkout.start.isnot(None), HealthWorkout.start >= cutoff)
        .order_by(HealthWorkout.start.asc())
    ).scalars().all()
    return HealthWorkoutsResponse(workouts=[
        HealthWorkoutSummary(
            date=w.start.date().isoformat(),
            name=w.name or "",
            duration_min=round(w.duration_seconds / 60, 1) if w.duration_seconds is not None else None,
            distance_km=w.distance_km,
            energy_kcal=_workout_energy_kcal(w),
            avg_hr=w.avg_heart_rate,
            max_hr=w.max_heart_rate,
        )
        for w in rows
    ])
