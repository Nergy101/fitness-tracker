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
    # Kcal for runs/walks lives on their mirror sessions; workout kcal on
    # real sessions.
    weekly: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "workout_min": 0.0, "run_min": 0.0, "walk_min": 0.0, "boxing_min": 0.0, "cycling_min": 0.0,
            "run_km": 0.0, "walk_km": 0.0, "cycling_km": 0.0,
            "workout_kcal": 0.0, "run_kcal": 0.0, "walk_kcal": 0.0, "boxing_kcal": 0.0, "cycling_kcal": 0.0,
        }
    )
    for s in sessions:
        wk = _monday_of(_session_date(s)).isoformat()
        if is_mirror_session(s):
            name = s.template_name or ""
            if name.startswith("Boxing:"):
                weekly[wk]["boxing_min"] += (s.total_duration_seconds or 0) / 60
                weekly[wk]["boxing_kcal"] += s.total_kcal_estimated or 0.0
            elif name.startswith("Cycling:"):
                # Minutes/km come from the CyclingEntry loop below; the mirror
                # only carries the kcal estimate.
                weekly[wk]["cycling_kcal"] += s.total_kcal_estimated or 0.0
            elif name.startswith("Walk:"):
                weekly[wk]["walk_kcal"] += s.total_kcal_estimated or 0.0
            else:
                weekly[wk]["run_kcal"] += s.total_kcal_estimated or 0.0
        else:
            weekly[wk]["workout_min"] += (s.total_duration_seconds or 0) / 60
            weekly[wk]["workout_kcal"] += s.total_kcal_estimated or 0.0
    for r in runs:
        wk = _monday_of(r.date).isoformat()
        kind = "walk" if r.run_type == "walk" else "run"
        weekly[wk][f"{kind}_min"] += r.duration_seconds / 60
        weekly[wk][f"{kind}_km"] += r.distance_km

    cycling_rides = db.query(CyclingEntry).order_by(CyclingEntry.date.asc()).all()
    for c in cycling_rides:
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

    # Consistency score: ≥3 workout/run days per week = 100%.
    # Walk km add bonus % on top (1% per km).
    # Collect qualifying days (workouts + runs, excluding walks) and walk km.
    workout_run_days: set[date] = set()
    for s in sessions:
        d = _session_date(s)
        if d < thirty_days_ago:
            continue
        if is_mirror_session(s):
            # Walk mirror sessions don't count toward the 3/week target.
            if not (s.template_name or "").startswith("Walk:"):
                workout_run_days.add(d)
        else:
            workout_run_days.add(d)
    for r in runs:
        if r.date >= thirty_days_ago and r.run_type != "walk":
            workout_run_days.add(r.date)

    # Walk km in the 30-day window for bonus percentage.
    walk_km = sum(
        r.distance_km for r in runs
        if r.date >= thirty_days_ago and r.run_type == "walk"
    )

    # Divide the 30-day window into calendar weeks (Mon–Sun).
    # Count weeks where ≥3 days had a workout/run.
    week_start = _monday_of(thirty_days_ago)
    qualifying_weeks = 0
    total_weeks = 0
    cursor = week_start
    while cursor <= today:
        week_end = cursor + timedelta(days=6)
        days_in_week = sum(
            1 for d in workout_run_days
            if cursor <= d <= min(week_end, today)
        )
        # For partial weeks (start or end of window), prorate the 3-day target
        # by the fraction of the week that falls inside the 30-day window.
        week_window_start = max(cursor, thirty_days_ago)
        week_window_end = min(week_end, today)
        window_days = (week_window_end - week_window_start).days + 1
        if window_days <= 0:
            cursor = week_end + timedelta(days=1)
            continue
        target = max(1, round(3 * window_days / 7))
        total_weeks += 1
        if days_in_week >= target:
            qualifying_weeks += 1
        cursor = week_end + timedelta(days=1)

    base_pct = round((qualifying_weeks / max(total_weeks, 1)) * 100, 1)
    # Walk distance is a small bonus, capped, and the whole score is clamped to
    # 100 so it stays a percentage (was: unbounded pct + raw km).
    WALK_BONUS_CAP_KM = 20.0
    consistency_pct = round(min(100.0, base_pct + min(walk_km, WALK_BONUS_CAP_KM)), 1)

    # ── 100% consistency streak (resets when score drops below 100) ──
    # Walk backwards day-by-day, recomputing the 30-day consistency window.
    streak_days = 0
    all_activity_dates: set[date] = set()
    for s in sessions:
        all_activity_dates.add(_session_date(s))
    for r in runs:
        all_activity_dates.add(r.date)
    boxing_entries = db.query(BoxingEntry).with_entities(BoxingEntry.date).all()
    for (d,) in boxing_entries:
        all_activity_dates.add(d)
    cycling_rides = db.query(CyclingEntry).with_entities(CyclingEntry.date).all()
    for (d,) in cycling_rides:
        all_activity_dates.add(d)

    WALK_BONUS_CAP_KM = 20.0
    for days_back in range(0, 366):
        window_end = today - timedelta(days=days_back)
        window_start = window_end - timedelta(days=30)
        # Collect qualifying days in this window
        win_days: set[date] = set()
        win_walk_km = 0.0
        for d in all_activity_dates:
            if window_start <= d <= window_end:
                # Exclude walk mirror sessions — count only non-walk activity
                win_days.add(d)
        for r2 in runs:
            if window_start <= r2.date <= window_end and r2.run_type == "walk":
                win_walk_km += r2.distance_km
        # Compute weeks in this window
        week_start2 = _monday_of(window_start)
        qw = 0
        tw = 0
        cursor2 = week_start2
        while cursor2 <= window_end:
            week_end2 = cursor2 + timedelta(days=6)
            days_in_week = sum(
                1 for d in win_days
                if cursor2 <= d <= min(week_end2, window_end)
            )
            wwa = max(cursor2, window_start)
            wwe = min(week_end2, window_end)
            window_days2 = (wwe - wwa).days + 1
            if window_days2 <= 0:
                cursor2 = week_end2 + timedelta(days=1)
                continue
            target2 = max(1, round(3 * window_days2 / 7))
            tw += 1
            if days_in_week >= target2:
                qw += 1
            cursor2 = week_end2 + timedelta(days=1)
        bp2 = round((qw / max(tw, 1)) * 100, 1)
        cp2 = round(min(100.0, bp2 + min(win_walk_km, WALK_BONUS_CAP_KM)), 1)
        if cp2 >= 100.0:
            streak_days += 1
        else:
            break

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
        consistency_streak_days=streak_days,
        total_sessions_all=len(workouts),
        total_runs=sum(1 for r in runs if r.run_type != "walk"),
        total_walks=sum(1 for r in runs if r.run_type == "walk"),
        total_boxing=db.query(BoxingEntry).count(),
        total_cycling=db.query(CyclingEntry).count(),
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
