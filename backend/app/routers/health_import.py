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
    # shapes win even if a stray `qty` is present; else the plain qty.
    key = _SCALAR_KEY.get(name)
    if key and isinstance(point.get(key), (int, float)):
        return point[key]
    val = point.get("qty")
    return val if isinstance(val, (int, float)) else None


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


@router.post("/data", response_model=HealthImportResult)
def import_data(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Ingest a Health Auto Export document. Idempotent: metrics upsert on
    (metric_name, date), workouts on their UUID — safe to call on every sync."""
    data = payload.get("data", payload) if isinstance(payload, dict) else {}

    # ── Metrics ──
    metric_rows: dict[tuple[str, date], dict] = {}
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
            extra = {k: v for k, v in pt.items() if k not in ("date", "source", "qty")}
            metric_rows[(name, d)] = {
                "metric_name": name,
                "date": d,
                "units": units,
                "qty": _metric_qty(name, pt),
                "data": json.dumps(extra) if extra else None,
                "source": pt.get("source"),
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


@router.get("/insights", response_model=HealthInsightsResponse)
def health_insights(days: int = 120, db: Session = Depends(get_db)):
    """Per-metric daily series for the curated dashboard metrics, most recent
    `days` window. Only metrics with data are returned."""
    cutoff = date.today() - timedelta(days=max(days, 1))
    series: list[HealthSeries] = []
    for name, label, unit, maybe_kj in _INSIGHTS:
        rows = db.execute(
            select(HealthMetric.date, HealthMetric.qty, HealthMetric.units)
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
            )
            for d, q, u in rows
        ]
        series.append(HealthSeries(metric=name, label=label, unit=unit, points=points))
    return HealthInsightsResponse(series=series)
