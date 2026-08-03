from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WorkoutSession, RunEntry, BoxingEntry, CyclingEntry, WeightEntry, is_mirror_session
from app.schemas import (
    DailyActivityPoint, DailyActivityResponse, StatsOverviewResponse, WeeklyActivityStats,
)

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _session_date(s: WorkoutSession) -> date:
    return s.started_at.date() if hasattr(s.started_at, "date") else s.started_at


# A 3-day window must contain at least one activity: two rest days in a row are
# fine, three break the chain.
CONSISTENCY_WINDOW_DAYS = 3
CONSISTENCY_SCORE_DAYS = 30


def _consistency(activity_days: set[date], today: date) -> tuple[float, int]:
    """Consistency score and how long it has been perfect.

    Score: the share of 3-day windows inside the last 30 days that contain at
    least one activity — 100% means never three days off in a row.

    Streak: how many days back from today that has held. Uncapped, so it keeps
    climbing past the 30-day scoring window as a motivator.
    """
    def covered(window_end: date) -> bool:
        return any(
            window_end - timedelta(days=offset) in activity_days
            for offset in range(CONSISTENCY_WINDOW_DAYS)
        )

    if not activity_days:
        return 0.0, 0

    window_ends = [
        today - timedelta(days=offset)
        for offset in range(CONSISTENCY_SCORE_DAYS - CONSISTENCY_WINDOW_DAYS + 1)
    ]
    pct = round(sum(1 for end in window_ends if covered(end)) / len(window_ends) * 100, 1)

    earliest = min(activity_days)
    streak_days = 0
    cursor = today
    while cursor >= earliest and covered(cursor):
        streak_days += 1
        cursor -= timedelta(days=1)

    return pct, streak_days


@router.get("/overview", response_model=StatsOverviewResponse)
def stats_overview(db: Session = Depends(get_db)):
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.started_at.asc()).all()
    runs = db.query(RunEntry).order_by(RunEntry.date.asc()).all()
    weights = db.query(WeightEntry).order_by(WeightEntry.date.asc()).all()

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    # Mirror sessions carry the run/walk kcal estimate, so summing every
    # session covers workouts and runs alike. Scoped to the last 30 days.
    total_kcal = sum(
        s.total_kcal_estimated for s in sessions
        if _session_date(s) >= thirty_days_ago
    )

    workouts = [s for s in sessions if not is_mirror_session(s)]

    # Weekly activity, split by type (last 12 weeks with any activity).
    #
    # Each activity is bucketed on ONE date: its session's. Runs/walks/rides are
    # stored twice — the entry owns distance, the mirror session owns duration
    # and the kcal estimate — so keying each half on its own date lets a pair
    # that disagrees about the day land in different weeks (and, in the daily
    # charts, on different bars). The mirror decides the week; the entry only
    # supplies km. Entries with no mirror fall back to their own date.
    cycling_rides = db.query(CyclingEntry).order_by(CyclingEntry.date.asc()).all()
    runs_by_id = {r.id: r for r in runs}
    rides_by_id = {c.id: c for c in cycling_rides}
    mirrored_run_ids: set[int] = set()
    mirrored_ride_ids: set[int] = set()

    weekly: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "workout_min": 0.0, "run_min": 0.0, "walk_min": 0.0, "boxing_min": 0.0, "cycling_min": 0.0,
            "run_km": 0.0, "walk_km": 0.0, "cycling_km": 0.0,
            "workout_kcal": 0.0, "run_kcal": 0.0, "walk_kcal": 0.0, "boxing_kcal": 0.0, "cycling_kcal": 0.0,
        }
    )
    for s in sessions:
        wk = _monday_of(_session_date(s)).isoformat()
        if not is_mirror_session(s):
            weekly[wk]["workout_min"] += (s.total_duration_seconds or 0) / 60
            weekly[wk]["workout_kcal"] += s.total_kcal_estimated or 0.0
            continue

        name = s.template_name or ""
        if name.startswith("Boxing:"):
            kind = "boxing"
        elif name.startswith("Cycling:"):
            kind = "cycling"
        elif name.startswith("Walk:"):
            kind = "walk"
        else:
            kind = "run"
        weekly[wk][f"{kind}_min"] += (s.total_duration_seconds or 0) / 60
        weekly[wk][f"{kind}_kcal"] += s.total_kcal_estimated or 0.0

        run = runs_by_id.get(s.run_entry_id) if s.run_entry_id else None
        ride = rides_by_id.get(s.cycling_entry_id) if s.cycling_entry_id else None
        if run is not None:
            mirrored_run_ids.add(run.id)
            weekly[wk][f"{kind}_km"] += run.distance_km
        if ride is not None:
            mirrored_ride_ids.add(ride.id)
            weekly[wk]["cycling_km"] += ride.distance_km

    for r in runs:
        if r.id in mirrored_run_ids:
            continue
        wk = _monday_of(r.date).isoformat()
        kind = "walk" if r.run_type == "walk" else "run"
        weekly[wk][f"{kind}_min"] += r.duration_seconds / 60
        weekly[wk][f"{kind}_km"] += r.distance_km

    for c in cycling_rides:
        if c.id in mirrored_ride_ids:
            continue
        wk = _monday_of(c.date).isoformat()
        weekly[wk]["cycling_min"] += c.duration_seconds / 60
        weekly[wk]["cycling_km"] += c.distance_km

    activity_weekly = [
        WeeklyActivityStats(
            week_start=wk,
            workout_minutes=round(weekly[wk]["workout_min"], 1),
            run_minutes=round(weekly[wk]["run_min"], 1),
            walk_minutes=round(weekly[wk]["walk_min"], 1),
            boxing_minutes=round(weekly[wk]["boxing_min"], 1),
            cycling_minutes=round(weekly[wk]["cycling_min"], 1),
            run_km=round(weekly[wk]["run_km"], 2),
            walk_km=round(weekly[wk]["walk_km"], 2),
            cycling_km=round(weekly[wk]["cycling_km"], 2),
            workout_kcal=round(weekly[wk]["workout_kcal"], 1),
            run_kcal=round(weekly[wk]["run_kcal"], 1),
            walk_kcal=round(weekly[wk]["walk_kcal"], 1),
            boxing_kcal=round(weekly[wk]["boxing_kcal"], 1),
            cycling_kcal=round(weekly[wk]["cycling_kcal"], 1),
        )
        for wk in sorted(weekly.keys(), reverse=True)[:12]
    ]

    # Consistency: never go three days without training. Every activity counts —
    # workouts, runs, walks, boxing, rides — so an activity day is any day with
    # a session (mirrors included) or a dedicated entry.
    boxing_entries = db.query(BoxingEntry).all()
    activity_days = {_session_date(s) for s in sessions}
    activity_days |= {r.date for r in runs}
    activity_days |= {c.date for c in cycling_rides}
    activity_days |= {b.date for b in boxing_entries}
    consistency_pct, consistency_streak_days = _consistency(activity_days, today)

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

    # Weight change over the last 30 days (last vs first entry in the window)
    avg_weight_change = None
    window_weights = [w for w in weights if w.date >= thirty_days_ago]
    if len(window_weights) >= 2:
        avg_weight_change = round(window_weights[-1].weight_kg - window_weights[0].weight_kg, 2)

    return StatsOverviewResponse(
        activity_weekly=activity_weekly,
        total_kcal_burned=round(total_kcal, 1),
        consistency_score_pct=consistency_pct,
        consistency_streak_days=consistency_streak_days,
        total_sessions_all=len(workouts),
        total_runs=sum(1 for r in runs if r.run_type != "walk"),
        total_walks=sum(1 for r in runs if r.run_type == "walk"),
        total_boxing=len(boxing_entries),
        total_cycling=len(cycling_rides),
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
