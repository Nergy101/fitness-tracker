from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WorkoutSession, RunEntry, WeightEntry, is_run_mirror
from app.schemas import (
    DailyActivityPoint, DailyActivityResponse, StatsOverviewResponse, WeeklyActivityStats,
)

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _session_date(s: WorkoutSession) -> date:
    return s.started_at.date() if hasattr(s.started_at, "date") else s.started_at


@router.get("/overview", response_model=StatsOverviewResponse)
def stats_overview(db: Session = Depends(get_db)):
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.started_at.asc()).all()
    runs = db.query(RunEntry).order_by(RunEntry.date.asc()).all()
    weights = db.query(WeightEntry).order_by(WeightEntry.date.asc()).all()

    today = date.today()
    # Mirror sessions carry the run/walk kcal estimate, so summing every
    # session covers workouts and runs alike.
    total_kcal = sum(s.total_kcal_estimated for s in sessions)

    workouts = [s for s in sessions if not is_run_mirror(s)]

    # Weekly activity, split by type (last 12 weeks with any activity).
    # Kcal for runs/walks lives on their mirror sessions; workout kcal on
    # real sessions.
    weekly: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "workout_min": 0.0, "run_min": 0.0, "walk_min": 0.0,
            "run_km": 0.0, "walk_km": 0.0,
            "workout_kcal": 0.0, "run_kcal": 0.0, "walk_kcal": 0.0,
        }
    )
    for s in sessions:
        wk = _monday_of(_session_date(s)).isoformat()
        if is_run_mirror(s):
            kind = "walk" if (s.template_name or "").startswith("Walk:") else "run"
            weekly[wk][f"{kind}_kcal"] += s.total_kcal_estimated or 0.0
        else:
            weekly[wk]["workout_min"] += (s.total_duration_seconds or 0) / 60
            weekly[wk]["workout_kcal"] += s.total_kcal_estimated or 0.0
    for r in runs:
        wk = _monday_of(r.date).isoformat()
        kind = "walk" if r.run_type == "walk" else "run"
        weekly[wk][f"{kind}_min"] += r.duration_seconds / 60
        weekly[wk][f"{kind}_km"] += r.distance_km

    activity_weekly = [
        WeeklyActivityStats(
            week_start=wk,
            workout_minutes=round(weekly[wk]["workout_min"], 1),
            run_minutes=round(weekly[wk]["run_min"], 1),
            walk_minutes=round(weekly[wk]["walk_min"], 1),
            run_km=round(weekly[wk]["run_km"], 2),
            walk_km=round(weekly[wk]["walk_km"], 2),
            workout_kcal=round(weekly[wk]["workout_kcal"], 1),
            run_kcal=round(weekly[wk]["run_kcal"], 1),
            walk_kcal=round(weekly[wk]["walk_kcal"], 1),
        )
        for wk in sorted(weekly.keys(), reverse=True)[:12]
    ]

    # Consistency score: % of days exercised in last 30 days
    thirty_days_ago = today - timedelta(days=30)
    session_dates = set()
    for s in sessions:
        d = _session_date(s)
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
        if _session_date(s) >= current_month_start
    ) / 60
    prev_minutes = sum(
        s.total_duration_seconds for s in sessions
        if prev_month_start <= _session_date(s) < current_month_start
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
        activity_weekly=activity_weekly,
        total_kcal_burned=round(total_kcal, 1),
        consistency_score_pct=consistency_pct,
        total_sessions_all=len(workouts),
        total_runs=sum(1 for r in runs if r.run_type != "walk"),
        total_walks=sum(1 for r in runs if r.run_type == "walk"),
        current_month_minutes=round(current_minutes, 1),
        previous_month_minutes=round(prev_minutes, 1),
        current_month_vs_previous_pct=vs_prev,
        avg_weight_change_kg=avg_weight_change,
    )


@router.get("/daily-activity", response_model=DailyActivityResponse)
def daily_activity(days: int = 120, db: Session = Depends(get_db)):
    """Native training load per day (minutes + kcal) for the most recent
    `days` window. Run/walk mirror sessions carry their run's time and kcal,
    so summing every session covers all activity without double-counting."""
    cutoff = date.today() - timedelta(days=max(days, 1))
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.started_at.asc()).all()

    per_day: dict[date, dict[str, float]] = defaultdict(lambda: {"minutes": 0.0, "kcal": 0.0})
    for s in sessions:
        d = _session_date(s)
        if d < cutoff:
            continue
        per_day[d]["minutes"] += (s.total_duration_seconds or 0) / 60
        per_day[d]["kcal"] += s.total_kcal_estimated or 0.0

    return DailyActivityResponse(days=[
        DailyActivityPoint(date=d.isoformat(), minutes=round(v["minutes"], 1), kcal=round(v["kcal"], 1))
        for d, v in sorted(per_day.items())
    ])
