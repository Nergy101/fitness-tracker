"""Scheduled workout reminder push dispatch (NER-297).

The Settings UI already stores `reminder_time` on the user profile, but nothing
ever dispatches a push at that time. This module fills the gap:

* `should_send_reminder()` — a pure, unit-tested decision function.
* `reminder_loop()` — a background asyncio loop (wired into the FastAPI
  lifespan in ``main.py``) that evaluates the rule periodically and pushes via
  the existing ``notifications._send_push`` path.

Reminder rule: a push fires at the user's scheduled ``reminder_time`` (in
Europe/Amsterdam) when they have not already logged any activity that day.
The loop runs on a coarse poll (default 60s) and marks each reminder as "fired"
for the day so it does not re-fire on subsequent polls.
"""

import asyncio
import datetime as dt
import logging
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.models import (
    PushSubscription,
    UserProfile,
    WorkoutSession,
    RunEntry,
    BoxingEntry,
    CyclingEntry,
)

logger = logging.getLogger("reminders")

TZ = ZoneInfo("Europe/Amsterdam")

# Remember which (profile, date) reminders already fired so a poll only sends
# once per day even if the loop runs several times that day.
_fired: set[tuple[int, str]] = set()


def _today_has_activity(db: Session, day: dt.date) -> bool:
    """Whether any activity (session, run, walk, boxing, ride) was logged on ``day``.

    ``day`` is the user's local (Europe/Amsterdam) calendar day. ``started_at``
    on ``workout_sessions`` is stored naive-UTC, so we convert the local
    midnight bounds to UTC before comparing.
    """
    local_midnight = dt.datetime.combine(day, dt.time.min, tzinfo=TZ)
    utc_start = local_midnight.astimezone(dt.timezone.utc).replace(tzinfo=None)
    utc_end = utc_start + dt.timedelta(days=1)
    if (
        db.query(WorkoutSession.id)
        .filter(WorkoutSession.started_at >= utc_start, WorkoutSession.started_at < utc_end)
        .first()
    ):
        return True
    for model in (RunEntry, BoxingEntry, CyclingEntry):
        if db.query(model.id).filter(model.date == day).first():
            return True
    return False


def should_send_reminder(
    now: dt.datetime,
    reminder_time: dt.time | None,
    notifications_enabled: bool,
    has_activity_today: bool,
) -> bool:
    """Pure decision rule for whether a reminder push should fire.

    Fires when: notifications are enabled, a reminder time is set, the current
    clock time has reached that reminder time, and no activity has been logged
    yet today.
    """
    if not notifications_enabled or reminder_time is None:
        return False
    if has_activity_today:
        return False
    return now.time() >= reminder_time


def _fired_key(profile_id: int, day: dt.date) -> str:
    return f"{profile_id}:{day.isoformat()}"


def reset_fired() -> None:
    """Clear the in-memory 'already fired today' set (used by tests)."""
    _fired.clear()


def run_reminder_once(now: dt.datetime | None = None) -> int:
    """Evaluate the reminder rule for every profile and dispatch pushes.

    Returns the number of pushes sent. Runs synchronously (called from the
    async loop via ``to_thread``).
    """
    now = now or dt.datetime.now(TZ)
    db: Session = SessionLocal()
    sent = 0
    try:
        profiles = db.query(UserProfile).all()
        for profile in profiles:
            day = now.date()
            key = _fired_key(profile.id, day)
            if key in _fired:
                continue
            if should_send_reminder(
                now,
                profile.reminder_time,
                bool(profile.notifications_enabled),
                _today_has_activity(db, day),
            ):
                _fired.add(key)
                subs = (
                    db.query(PushSubscription)
                    .order_by(PushSubscription.created_at.desc())
                    .all()
                )
                if not subs:
                    continue
                payload = {
                    "title": "Time to train",
                    "body": "You haven't logged a workout yet today. Keep the streak alive!",
                    "icon": "/icon-192.png",
                    "badge": "/badge-72.png",
                    "data": {"url": "/"},
                }
                from app.routers.notifications import _send_push

                for sub in subs:
                    if _send_push(sub, payload):
                        sent += 1
    except Exception:
        logger.exception("Reminder dispatch failed")
    finally:
        db.close()
    return sent


async def reminder_loop(poll_seconds: int = 60) -> None:
    """Background loop: periodically check whether a reminder is due."""
    while True:
        await asyncio.to_thread(run_reminder_once)
        await asyncio.sleep(poll_seconds)
