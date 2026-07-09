from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    UserProfile, WeightEntry, BodyMeasurement, WellnessCheckin, WorkoutSession,
    RunEntry, is_run_mirror,
)
from app.schemas import (
    UserProfileResponse, UserProfileUpdate,
    WeightEntryCreate, WeightEntryResponse, WeightStatsResponse, StreakResponse,
    GoalProgressResponse,
    BodyMeasurementCreate, BodyMeasurementResponse, MeasurementChangesResponse,
    WellnessCreate, WellnessResponse, WellnessTrendsResponse,
    HealthScoreResponse, PrsResponse,
)

router = APIRouter(prefix="/api/v1/health", tags=["health"])


# ─── Personal Records ────────────────────────────────────────


# Ignore sub-1km runs when ranking pace: a 200m dash produces a meaningless
# "record" pace.
MIN_PACE_DISTANCE_KM = 1.0


def _longest_streak(days: set[date]) -> int:
    """Longest run of days with at most 1 rest day between any two activity
    days (a '2-day gap streak'). Activity on Mon and Wed counts as a streak of
    3 calendar days (Mon–Wed); Mon and Thu has a 2-day gap and breaks."""
    if not days:
        return 0
    best = 0
    for d in sorted(days):
        if d - timedelta(days=1) in days or d - timedelta(days=2) in days:
            continue  # not a streak start (preceded within 1 gap day)
        length = 1  # count the streak-start day
        cursor = d
        while True:
            next_day = cursor + timedelta(days=1)
            if next_day in days:
                length += 1
                cursor = next_day
            elif cursor + timedelta(days=2) in days:
                # One rest day + one training day: add 2 calendar days.
                length += 2
                cursor = cursor + timedelta(days=2)
            else:
                break
        best = max(best, length)
    return best


@router.get("/prs", response_model=PrsResponse)
def personal_records(db: Session = Depends(get_db)):
    """Activity-level personal records: runs, walks, and fitness workouts."""
    entries = db.query(RunEntry).all()
    sessions = db.query(WorkoutSession).all()

    prs = PrsResponse()

    runs = [e for e in entries if e.run_type != "walk"]
    walks = [e for e in entries if e.run_type == "walk"]

    if runs:
        prs.longest_run_km = max(e.distance_km for e in runs)
        prs.longest_run_seconds = max(e.duration_seconds for e in runs)
        paced = [e.pace_per_km for e in runs if e.pace_per_km and e.distance_km >= MIN_PACE_DISTANCE_KM]
        if paced:
            prs.best_pace_seconds_per_km = min(paced)
        for e in runs:
            if 4.5 <= e.distance_km <= 5.5:
                if prs.fastest_5k_seconds is None or e.duration_seconds < prs.fastest_5k_seconds:
                    prs.fastest_5k_seconds = e.duration_seconds
            if 9.5 <= e.distance_km <= 10.5:
                if prs.fastest_10k_seconds is None or e.duration_seconds < prs.fastest_10k_seconds:
                    prs.fastest_10k_seconds = e.duration_seconds
        # Best rolling 7-day window of run distance
        best_week = 0.0
        for d in sorted(set(e.date for e in runs)):
            window_end = d + timedelta(days=7)
            best_week = max(best_week, sum(e.distance_km for e in runs if d <= e.date <= window_end))
        prs.best_week_run_km = round(best_week, 1)

    if walks:
        prs.longest_walk_km = max(e.distance_km for e in walks)
        prs.longest_walk_seconds = max(e.duration_seconds for e in walks)

    # Kcal records come from sessions: run/walk kcal lives on the mirror
    # session the runs router creates, workout kcal on real sessions.
    workouts = []
    for s in sessions:
        if not is_run_mirror(s):
            workouts.append(s)
            continue
        kcal = s.total_kcal_estimated or 0.0
        if s.template_name.startswith("Walk:"):
            if kcal > (prs.most_kcal_walk or 0.0):
                prs.most_kcal_walk = kcal
        elif kcal > (prs.most_kcal_run or 0.0):
            prs.most_kcal_run = kcal

    if workouts:
        prs.longest_workout_seconds = max(s.total_duration_seconds or 0 for s in workouts)
        prs.most_kcal_workout = max(s.total_kcal_estimated or 0.0 for s in workouts)
        prs.most_exercises_workout = max(len(s.exercises) for s in workouts)

    # Longest streak of consecutive days with any activity (runs, walks, or
    # workouts — mirrors share their run's date, so including them is harmless).
    active_days = {e.date for e in entries}
    for s in sessions:
        active_days.add(s.started_at.date() if hasattr(s.started_at, "date") else s.started_at)
    prs.longest_streak_days = _longest_streak(active_days)

    return prs


def _get_or_create_profile(db: Session) -> UserProfile:
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


# ─── Profile ──────────────────────────────────────────────


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    reminder = ""
    if profile.reminder_time:
        reminder = profile.reminder_time.strftime("%H:%M")
    return UserProfileResponse(
        height_cm=profile.height_cm,
        birthday=profile.birthday,
        gender=profile.gender,
        goal_weight_kg=profile.goal_weight_kg,
        weight_unit=profile.weight_unit or "kg",
        reminder_time=reminder,
        notifications_enabled=profile.notifications_enabled or False,
    )


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(data: UserProfileUpdate, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    updates = data.model_dump(exclude_unset=True)
    if "reminder_time" in updates and updates["reminder_time"]:
        from datetime import time
        parts = updates["reminder_time"].split(":")
        updates["reminder_time"] = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    elif "reminder_time" in updates:
        updates["reminder_time"] = None
    for key, val in updates.items():
        setattr(profile, key, val)
    db.commit()
    db.refresh(profile)
    reminder = ""
    if profile.reminder_time:
        reminder = profile.reminder_time.strftime("%H:%M")
    return UserProfileResponse(
        height_cm=profile.height_cm,
        birthday=profile.birthday,
        gender=profile.gender,
        goal_weight_kg=profile.goal_weight_kg,
        weight_unit=profile.weight_unit or "kg",
        reminder_time=reminder,
        notifications_enabled=profile.notifications_enabled or False,
    )


# ─── Weight ────────────────────────────────────────────────


@router.get("/weight", response_model=list[WeightEntryResponse])
def list_weight(db: Session = Depends(get_db)):
    return db.query(WeightEntry).order_by(WeightEntry.date.desc(), WeightEntry.created_at.desc()).all()


@router.post("/weight", response_model=WeightEntryResponse, status_code=201)
def create_weight(data: WeightEntryCreate, db: Session = Depends(get_db)):
    entry = WeightEntry(
        weight_kg=data.weight_kg,
        date=data.date or date.today(),
        notes=data.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/weight/{entry_id}", response_model=WeightEntryResponse)
def update_weight(entry_id: int, data: WeightEntryCreate, db: Session = Depends(get_db)):
    entry = db.get(WeightEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    entry.weight_kg = data.weight_kg
    if data.date:
        entry.date = data.date
    entry.notes = data.notes
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/weight/{entry_id}", status_code=204)
def delete_weight(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(WeightEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    db.delete(entry)
    db.commit()


@router.get("/weight/stats", response_model=WeightStatsResponse)
def weight_stats(days: int = Query(30, description="Days for avg"), db: Session = Depends(get_db)):
    entries = db.query(WeightEntry).order_by(WeightEntry.date.asc(), WeightEntry.created_at.asc()).all()
    if not entries:
        return WeightStatsResponse(total_entries=0)

    latest = entries[-1]
    min_entry = min(entries, key=lambda e: e.weight_kg)
    max_entry = max(entries, key=lambda e: e.weight_kg)

    cutoff_7d = date.today() - timedelta(days=7)
    cutoff_30d = date.today() - timedelta(days=30)
    recent_7d = [e for e in entries if e.date >= cutoff_7d]
    recent_30d = [e for e in entries if e.date >= cutoff_30d]
    avg_7d = sum(e.weight_kg for e in recent_7d) / len(recent_7d) if recent_7d else None
    avg_30d = sum(e.weight_kg for e in recent_30d) / len(recent_30d) if recent_30d else None

    return WeightStatsResponse(
        latest=WeightEntryResponse.model_validate(latest),
        min=WeightEntryResponse.model_validate(min_entry),
        max=WeightEntryResponse.model_validate(max_entry),
        avg_7d=avg_7d,
        avg_30d=avg_30d,
        total_entries=len(entries),
    )


@router.get("/weight/streak", response_model=StreakResponse)
def weight_streak(db: Session = Depends(get_db)):
    entries = db.query(WeightEntry).order_by(WeightEntry.date.desc()).all()
    if not entries:
        return StreakResponse()

    unique_dates = sorted(set(e.date for e in entries), reverse=True)
    last = unique_dates[0]

    # Current streak: allow at most 1 gap day (2-day gap streak).
    current = 0
    today = date.today()
    if last == today or last == today - timedelta(days=1):
        current = 1
        cursor = last
        for i in range(1, len(unique_dates)):
            gap = (cursor - unique_dates[i]).days
            if gap == 1:
                current += 1
                cursor = unique_dates[i]
            elif gap == 2:
                current += 2  # rest day + training day
                cursor = unique_dates[i]
            else:
                break

    # Best streak: same 2-day gap logic.
    best = 0
    if unique_dates:
        run = 1
        cursor = unique_dates[-1]  # start from oldest
        for i in range(len(unique_dates) - 2, -1, -1):
            gap = (unique_dates[i] - cursor).days
            if gap == 1:
                run += 1
                cursor = unique_dates[i]
            elif gap == 2:
                run += 2
                cursor = unique_dates[i]
            else:
                best = max(best, run)
                run = 1
                cursor = unique_dates[i]
        best = max(best, run)

    return StreakResponse(
        current_streak=current,
        best_streak=best,
        last_logged_date=last,
    )


# ─── Goal Progress ─────────────────────────────────────────


@router.get("/goal-progress", response_model=GoalProgressResponse)
def goal_progress(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    if not profile.goal_weight_kg:
        return GoalProgressResponse()

    entries = db.query(WeightEntry).order_by(WeightEntry.date.asc()).all()
    if len(entries) < 1:
        return GoalProgressResponse(goal_weight_kg=profile.goal_weight_kg)

    start = entries[0]
    current = entries[-1]
    start_w = start.weight_kg
    current_w = current.weight_kg
    goal_w = profile.goal_weight_kg

    # Directional progress: if goal is lower than start it's weight loss,
    # otherwise weight gain. Moving the wrong direction = 0%.
    if goal_w < start_w:
        total_to_lose = start_w - goal_w
        lost_so_far = start_w - current_w
        progress = (lost_so_far / total_to_lose * 100) if total_to_lose > 0 else 0
    elif goal_w > start_w:
        total_to_gain = goal_w - start_w
        gained_so_far = current_w - start_w
        progress = (gained_so_far / total_to_gain * 100) if total_to_gain > 0 else 0
    else:
        progress = 0

    progress = min(max(round(progress, 1), 0), 100)
    remaining = round(goal_w - current_w, 1)

    return GoalProgressResponse(
        start_weight_kg=start_w,
        current_weight_kg=current_w,
        goal_weight_kg=goal_w,
        progress_percentage=progress,
        remaining_kg=remaining,
    )


# ─── Body Measurements ──────────────────────────────────────


@router.get("/measurements", response_model=list[BodyMeasurementResponse])
def list_measurements(db: Session = Depends(get_db)):
    return db.query(BodyMeasurement).order_by(BodyMeasurement.date.desc(), BodyMeasurement.created_at.desc()).all()


@router.post("/measurements", response_model=BodyMeasurementResponse, status_code=201)
def create_measurement(data: BodyMeasurementCreate, db: Session = Depends(get_db)):
    meas = BodyMeasurement(**data.model_dump(exclude_unset=True))
    db.add(meas)
    db.commit()
    db.refresh(meas)
    return meas


@router.put("/measurements/{meas_id}", response_model=BodyMeasurementResponse)
def update_measurement(meas_id: int, data: BodyMeasurementCreate, db: Session = Depends(get_db)):
    meas = db.get(BodyMeasurement, meas_id)
    if not meas:
        raise HTTPException(status_code=404, detail="Measurement not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(meas, key, val)
    db.commit()
    db.refresh(meas)
    return meas


@router.delete("/measurements/{meas_id}", status_code=204)
def delete_measurement(meas_id: int, db: Session = Depends(get_db)):
    meas = db.get(BodyMeasurement, meas_id)
    if not meas:
        raise HTTPException(status_code=404, detail="Measurement not found")
    db.delete(meas)
    db.commit()


@router.get("/measurements/changes", response_model=MeasurementChangesResponse)
def measurement_changes(db: Session = Depends(get_db)):
    entries = db.query(BodyMeasurement).order_by(BodyMeasurement.date.asc()).all()
    if len(entries) < 2:
        first = entries[0] if entries else None
        return MeasurementChangesResponse(
            first=BodyMeasurementResponse.model_validate(first) if first else None,
            latest=BodyMeasurementResponse.model_validate(first) if first else None,
        )

    first = entries[0]
    latest = entries[-1]
    fields = ["waist_cm", "hips_cm", "chest_cm", "left_arm_cm", "right_arm_cm",
              "left_thigh_cm", "right_thigh_cm", "neck_cm"]
    deltas = {}
    for f in fields:
        fv = getattr(first, f, None)
        lv = getattr(latest, f, None)
        if fv is not None and lv is not None:
            deltas[f] = round(lv - fv, 1)
        else:
            deltas[f] = None

    return MeasurementChangesResponse(
        first=BodyMeasurementResponse.model_validate(first),
        latest=BodyMeasurementResponse.model_validate(latest),
        deltas=deltas,
    )


# ─── Wellness Check-ins ──────────────────────────────────────


@router.get("/wellness", response_model=list[WellnessResponse])
def list_wellness(db: Session = Depends(get_db)):
    return db.query(WellnessCheckin).order_by(WellnessCheckin.date.desc()).all()


@router.post("/wellness", response_model=WellnessResponse, status_code=201)
def create_wellness(data: WellnessCreate, db: Session = Depends(get_db)):
    checkin = WellnessCheckin(**data.model_dump(exclude_unset=True))
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.delete("/wellness/{checkin_id}", status_code=204)
def delete_wellness(checkin_id: int, db: Session = Depends(get_db)):
    checkin = db.get(WellnessCheckin, checkin_id)
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in not found")
    db.delete(checkin)
    db.commit()


@router.get("/wellness/trends", response_model=WellnessTrendsResponse)
def wellness_trends(db: Session = Depends(get_db)):
    entries = db.query(WellnessCheckin).order_by(WellnessCheckin.date.asc()).all()
    if not entries:
        return WellnessTrendsResponse()

    weeks: dict[str, list] = {}
    for e in entries:
        monday = e.date - timedelta(days=e.date.weekday())
        key = monday.isoformat()
        if key not in weeks:
            weeks[key] = []
        weeks[key].append(e)

    weekly_averages = []
    for week_start in sorted(weeks.keys(), reverse=True)[:8]:  # last 8 weeks
        items = weeks[week_start]
        moods = [e.mood for e in items if e.mood is not None]
        energies = [e.energy for e in items if e.energy is not None]
        stresses = [e.stress for e in items if e.stress is not None]
        sleeps = [e.sleep_hours for e in items if e.sleep_hours is not None]
        weekly_averages.append({
            "week_start": week_start,
            "avg_mood": round(sum(moods) / len(moods), 1) if moods else None,
            "avg_energy": round(sum(energies) / len(energies), 1) if energies else None,
            "avg_stress": round(sum(stresses) / len(stresses), 1) if stresses else None,
            "avg_sleep": round(sum(sleeps) / len(sleeps), 1) if sleeps else None,
            "entry_count": len(items),
        })

    return WellnessTrendsResponse(weekly_averages=weekly_averages)


# ─── Health Score ────────────────────────────────────────────


def _calculate_bmi(weight_kg: float, height_cm: float) -> float:
    if height_cm <= 0:
        return 0
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)


def _bmi_score(bmi: float, profile: UserProfile) -> float:
    if bmi <= 0:
        return 0
    if 18.5 <= bmi <= 24.9:
        return 40
    elif (25 <= bmi <= 29.9) or (bmi < 18.5 and bmi >= 17):
        return 20
    else:
        return 5


@router.get("/score", response_model=HealthScoreResponse)
def health_score(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    score = 0.0
    spotlight = ""

    # BMI component (0-40)
    bmi_score_val = 0.0
    latest_weight = db.query(WeightEntry).order_by(WeightEntry.date.desc()).first()
    if latest_weight and profile.height_cm:
        bmi = _calculate_bmi(latest_weight.weight_kg, profile.height_cm)
        bmi_score_val = _bmi_score(bmi, profile)
        score += bmi_score_val
        if 18.5 <= bmi <= 24.9:
            spotlight = "Your BMI is in the healthy range — keep it up!"
        elif bmi >= 30:
            spotlight = "Let's work on that BMI — every workout counts!"

    # Workout consistency (0-30)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    session_count = db.query(WorkoutSession).filter(
        WorkoutSession.started_at >= thirty_days_ago
    ).count()
    workout_score_val = min(session_count * 3, 30)
    score += workout_score_val
    if not spotlight and session_count >= 10:
        spotlight = f"{session_count} workouts in 30 days — crushing it!"
    elif not spotlight and session_count >= 5:
        spotlight = f"{session_count} workouts this month — solid consistency!"

    # Streak component (0-15)
    streak_info = weight_streak(db)
    streak_score_val = min(streak_info.current_streak * 0.5, 15)
    score += streak_score_val
    if not spotlight and streak_info.current_streak >= 7:
        spotlight = f"{streak_info.current_streak}-day logging streak — amazing!"
    elif not spotlight and streak_info.current_streak >= 3:
        spotlight = f"{streak_info.current_streak}-day streak — keep it going!"

    # Measurement tracking (0-15)
    meas_count = db.query(BodyMeasurement).count()
    measurement_score_val = min(meas_count * 2, 15)
    score += measurement_score_val
    if not spotlight and meas_count >= 3:
        spotlight = "Tracking measurements — that's dedication!"
    elif not spotlight:
        spotlight = "Log your first weight to start tracking progress"

    score = round(min(score, 100), 1)

    return HealthScoreResponse(
        score=score,
        bmi_score=bmi_score_val,
        workout_score=workout_score_val,
        streak_score=streak_score_val,
        measurement_score=measurement_score_val,
        spotlight=spotlight,
    )


# ─── BMI calculation (utility) ──────────────────────────────


@router.get("/bmi")
def get_bmi(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    if not profile.height_cm:
        return {"bmi": None, "category": None, "message": "Set your height in profile to calculate BMI"}

    latest_weight = db.query(WeightEntry).order_by(WeightEntry.date.desc()).first()
    if not latest_weight:
        return {"bmi": None, "category": None, "message": "Log your weight to calculate BMI"}

    bmi = _calculate_bmi(latest_weight.weight_kg, profile.height_cm)

    # Determine category
    age = None
    if profile.birthday:
        today = date.today()
        age = today.year - profile.birthday.year - (
            (today.month, today.day) < (profile.birthday.month, profile.birthday.day)
        )

    if age is not None and age < 20:
        # Simplified adolescent percentile ranges
        if bmi < 5:
            category = "Underweight"
            color = "yellow"
        elif bmi < 85:
            category = "Normal"
            color = "green"
        elif bmi < 95:
            category = "Overweight"
            color = "orange"
        else:
            category = "Obese"
            color = "red"
    else:
        if bmi < 18.5:
            category = "Underweight"
            color = "yellow"
        elif bmi < 25:
            category = "Normal"
            color = "green"
        elif bmi < 30:
            category = "Overweight"
            color = "orange"
        else:
            category = "Obese"
            color = "red"

    messages = {
        "Underweight": "Consider speaking with a healthcare provider about a healthy weight plan.",
        "Normal": "Great work maintaining a healthy BMI!",
        "Overweight": "Small changes can make a big difference — you've got this!",
        "Obese": "Every workout counts — start small and stay consistent!",
    }

    return {
        "bmi": bmi,
        "category": category,
        "color": color,
        "message": messages.get(category, ""),
        "height_cm": profile.height_cm,
        "weight_kg": latest_weight.weight_kg,
        "age": age,
    }
