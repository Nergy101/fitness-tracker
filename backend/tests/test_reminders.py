"""Tests for app/reminders.py — the scheduled workout reminder rule (NER-297)."""

import datetime as dt
from zoneinfo import ZoneInfo

from app.reminders import should_send_reminder

TZ = ZoneInfo("Europe/Amsterdam")


def _time(h, m=0):
    return dt.time(h, m)


def test_no_reminder_when_notifications_disabled():
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 18, 0, tzinfo=TZ),
        _time(17, 0),
        False,
        False,
    ) is False


def test_no_reminder_without_reminder_time():
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 18, 0, tzinfo=TZ),
        None,
        True,
        False,
    ) is False


def test_no_reminder_when_activity_logged_today():
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 18, 0, tzinfo=TZ),
        _time(17, 0),
        True,
        True,
    ) is False


def test_no_reminder_before_scheduled_time():
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 8, 0, tzinfo=TZ),
        _time(17, 0),
        True,
        False,
    ) is False


def test_reminder_fires_at_and_after_scheduled_time():
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 17, 0, tzinfo=TZ),
        _time(17, 0),
        True,
        False,
    ) is True
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 18, 30, tzinfo=TZ),
        _time(17, 0),
        True,
        False,
    ) is True


def test_no_reminder_midnight_crossing_respects_date():
    # 00:30 is after 23:00 clock-wise but it's a NEW day — should_send_reminder
    # compares time-of-day only (date boundary handled by the caller's "today"
    # activity check). At 00:30 the reminder_time 23:00 has NOT yet passed
    # today, so it must not fire.
    assert should_send_reminder(
        dt.datetime(2026, 8, 20, 0, 30, tzinfo=TZ),
        _time(23, 0),
        True,
        False,
    ) is False
