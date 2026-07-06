from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WorkoutSession, RunEntry, WeightEntry
from app.schemas import StatsOverviewResponse, WeeklyStats

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("/overview", response_model=StatsOverviewResponse)
def stats_overview(db: Session = Depends(get_db)):
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.started_at.asc()).all()
    runs = db.query(RunEntry).order_by(RunEntry.date.asc()).all()
    weights = db.query(WeightEntry).order_by(WeightEntry.date.asc()).all()

    today = date.today()
    total_kcal = sum(s.total_kcal_estimated for s in sessions)

    # Weekly workout volume (last 12 weeks)
    week_buckets: dict[str, list[WorkoutSession]] = {}
    for s in sessions:
        d = s.started_at.date() if hasattr(s.started_at, 'date') else s.started_at
        wk = _monday_of(d).isoformat()
        if wk not in week_buckets:
            week_buckets[wk] = []
        week_buckets[wk].append(s)

    workout_volume = []
    for wk in sorted(week_buckets.keys(), reverse=True)[:12]:
        items = week_buckets[wk]
        total_min = sum(s.total_duration_seconds for s in items) / 60
        total_k = sum(s.total_kcal_estimated for s in items)
        workout_volume.append(WeeklyStats(
            week_start=wk,
            total_minutes=round(total_min, 1),
            total_kcal=round(total_k, 1),
            total_sessions=len(items),
            total_distance_km=0.0,
        ))

    # Weekly run distance
    run_week_buckets: dict[str, list[RunEntry]] = {}
    for r in runs:
        wk = _monday_of(r.date).isoformat()
        if wk not in run_week_buckets:
            run_week_buckets[wk] = []
        run_week_buckets[wk].append(r)

    run_distance = []
    for wk in sorted(run_week_buckets.keys(), reverse=True)[:12]:
        items = run_week_buckets[wk]
        total_dist = sum(r.distance_km for r in items)
        total_min = sum(r.duration_seconds for r in items) / 60
        total_k = sum(r.duration_seconds / 60 * 10.0 for r in items)
        run_distance.append(WeeklyStats(
            week_start=wk,
            total_minutes=round(total_min, 1),
            total_kcal=round(total_k, 1),
            total_sessions=len(items),
            total_distance_km=round(total_dist, 2),
        ))

    # Consistency score: % of days exercised in last 30 days
    thirty_days_ago = today - timedelta(days=30)
    session_dates = set()
    for s in sessions:
        d = s.started_at.date() if hasattr(s.started_at, 'date') else s.started_at
        if d >= thirty_days_ago:
            session_dates.add(d)
    for r in runs:
        if r.date >= thirty_days_ago:
            session_dates.add(r.date)

    days_in_window = 30
    consistency_pct = round((len(session_dates) / days_in_window) * 100, 1)

    # Monthly comparison
    current_month_start = today.replace(day=1)
    prev_month_end = current_month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    current_minutes = sum(
        s.total_duration_seconds for s in sessions
        if (s.started_at.date() if hasattr(s.started_at, 'date') else s.started_at) >= current_month_start
    ) / 60
    prev_minutes = sum(
        s.total_duration_seconds for s in sessions
        if prev_month_start <= (s.started_at.date() if hasattr(s.started_at, 'date') else s.started_at) < current_month_start
    ) / 60

    vs_prev = None
    if prev_minutes > 0:
        vs_prev = round(((current_minutes - prev_minutes) / prev_minutes) * 100, 1)

    # Average weight change (last vs first this month)
    avg_weight_change = None
    this_month_weights = [w for w in weights if w.date >= current_month_start]
    if len(this_month_weights) >= 2:
        avg_weight_change = round(this_month_weights[-1].weight_kg - this_month_weights[0].weight_kg, 2)

    return StatsOverviewResponse(
        workout_volume_weekly=workout_volume,
        run_distance_weekly=run_distance,
        total_kcal_burned=round(total_kcal, 1),
        consistency_score_pct=consistency_pct,
        total_sessions_all=len(sessions),
        total_runs=len(runs),
        current_month_minutes=round(current_minutes, 1),
        previous_month_minutes=round(prev_minutes, 1),
        current_month_vs_previous_pct=vs_prev,
        avg_weight_change_kg=avg_weight_change,
    )
