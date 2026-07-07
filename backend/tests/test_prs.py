"""Behavioral tests for GET /api/v1/health/prs (personal records).

Verified contracts:
1. Empty DB  → 200, every nullable PR field is null, longest_streak_days == 0.
2. Independent run maxima: longest_run_km and longest_run_seconds reflect
   different runs when the longer-distance run != the longer-duration run.
3. Walk records: walk fields set from walk entry + mirror kcal; run fields null.
4. Pace threshold (MIN_PACE_DISTANCE_KM = 1.0): sub-1 km runs never set
   best_pace_seconds_per_km; a run at exactly 1.0 km does.
5. Fastest 5K window (4.5–5.5 km): only runs inside that range set
   fastest_5k_seconds; a 6.0 km run does not.
6. Workout records exclude mirrors: auto-created mirror sessions from run/walk
   creation leave workout PR fields null; a real non-mirror session sets them.
7. Longest streak: longest chain of consecutive calendar days with any activity.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient

RUNS_URL = "/api/v1/runs"
SESSIONS_URL = "/api/v1/sessions"
PRS_URL = "/api/v1/health/prs"

# Default weight used by kcal estimation when no WeightEntry exists (runs.py)
_DEFAULT_WEIGHT_KG = 75.0
_RUN_KCAL_FACTOR = 0.97
_WALK_KCAL_FACTOR = 0.5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _post_run(client, headers, *, distance_km, duration_seconds, run_type="run", date_str=None):
    payload = {
        "distance_km": distance_km,
        "duration_seconds": duration_seconds,
        "run_type": run_type,
    }
    if date_str is not None:
        payload["date"] = date_str
    resp = client.post(RUNS_URL, json=payload, headers=headers)
    assert resp.status_code == 201, resp.text


def _post_session(
    client,
    headers,
    *,
    template_name,
    total_duration_seconds=0,
    total_kcal_estimated=0.0,
    started_at=None,
    exercises=None,
):
    payload = {
        "template_name": template_name,
        "total_duration_seconds": total_duration_seconds,
        "total_kcal_estimated": total_kcal_estimated,
    }
    if started_at is not None:
        payload["started_at"] = started_at
    if exercises is not None:
        payload["exercises"] = exercises
    resp = client.post(SESSIONS_URL, json=payload, headers=headers)
    assert resp.status_code == 201, resp.text


def _get_prs(client, headers):
    resp = client.get(PRS_URL, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# 1. Empty DB
# ---------------------------------------------------------------------------


class TestPrsEmptyDB:
    def test_all_record_fields_null_streak_zero(self, client: TestClient, auth_headers: dict):
        """Empty DB: 200 OK, every nullable PR field is null and longest_streak_days is 0."""
        data = _get_prs(client, auth_headers)

        # Runs
        assert data["longest_run_km"] is None
        assert data["longest_run_seconds"] is None
        assert data["fastest_5k_seconds"] is None
        assert data["fastest_10k_seconds"] is None
        assert data["best_pace_seconds_per_km"] is None
        assert data["most_kcal_run"] is None
        assert data["best_week_run_km"] is None
        # Walks
        assert data["longest_walk_km"] is None
        assert data["longest_walk_seconds"] is None
        assert data["most_kcal_walk"] is None
        # Workouts
        assert data["longest_workout_seconds"] is None
        assert data["most_kcal_workout"] is None
        assert data["most_exercises_workout"] is None
        # Overall
        assert data["longest_streak_days"] == 0


# ---------------------------------------------------------------------------
# 2. Independent run maxima
# ---------------------------------------------------------------------------


class TestPrsIndependentRunMaxima:
    def test_longest_km_and_longest_seconds_come_from_different_runs(
        self, client: TestClient, auth_headers: dict
    ):
        """longest_run_km and longest_run_seconds are independent maxima.

        Run A (10 km, 3000 s): holds the distance record.
        Run B ( 5 km, 4000 s): holds the time record.
        Both records coexist; walk fields remain null.
        """
        _post_run(client, auth_headers, distance_km=10.0, duration_seconds=3000)
        _post_run(client, auth_headers, distance_km=5.0, duration_seconds=4000)

        data = _get_prs(client, auth_headers)

        assert data["longest_run_km"] == 10.0, (
            "longest_run_km must come from run A (10 km)"
        )
        assert data["longest_run_seconds"] == 4000, (
            "longest_run_seconds must come from run B (4000 s)"
        )

        # Walk fields unaffected — no walks were posted
        assert data["longest_walk_km"] is None
        assert data["longest_walk_seconds"] is None
        assert data["most_kcal_walk"] is None


# ---------------------------------------------------------------------------
# 3. Walk records
# ---------------------------------------------------------------------------


class TestPrsWalkRecords:
    def test_walk_sets_walk_fields_run_fields_stay_null(
        self, client: TestClient, auth_headers: dict
    ):
        """One walk sets longest_walk_km/seconds and most_kcal_walk from its
        auto-created mirror session; run-specific PR fields remain null."""
        distance_km = 3.0
        duration_seconds = 2400
        _post_run(
            client,
            auth_headers,
            distance_km=distance_km,
            duration_seconds=duration_seconds,
            run_type="walk",
        )

        data = _get_prs(client, auth_headers)

        assert data["longest_walk_km"] == distance_km
        assert data["longest_walk_seconds"] == duration_seconds

        expected_kcal = round(_WALK_KCAL_FACTOR * _DEFAULT_WEIGHT_KG * distance_km, 1)
        assert data["most_kcal_walk"] == expected_kcal, (
            f"Expected most_kcal_walk={expected_kcal}, got {data['most_kcal_walk']}"
        )

        # Run-specific records must stay null — no runs were posted
        assert data["longest_run_km"] is None
        assert data["longest_run_seconds"] is None
        assert data["most_kcal_run"] is None


# ---------------------------------------------------------------------------
# 4. Pace threshold (MIN_PACE_DISTANCE_KM = 1.0)
# ---------------------------------------------------------------------------


class TestPrsPaceThreshold:
    def test_sub_1km_run_excluded_from_pace_record(
        self, client: TestClient, auth_headers: dict
    ):
        """A run under 1.0 km must not set best_pace_seconds_per_km,
        regardless of how fast the apparent pace is."""
        # 0.5 km in 100 s → 200 s/km — would be an absurd record if allowed
        _post_run(client, auth_headers, distance_km=0.5, duration_seconds=100)

        data = _get_prs(client, auth_headers)

        assert data["best_pace_seconds_per_km"] is None, (
            "Runs under 1.0 km must not contribute to the pace record"
        )

    def test_at_1km_threshold_sets_pace_record_sub_threshold_pace_ignored(
        self, client: TestClient, auth_headers: dict
    ):
        """A run at exactly 1.0 km qualifies for best_pace_seconds_per_km.

        A sub-threshold run with a faster apparent pace is posted first to confirm
        it is excluded: only the ≥1 km run's pace must appear in the record.
        """
        # Sub-threshold: pace = 200 s/km — must be ignored
        _post_run(client, auth_headers, distance_km=0.5, duration_seconds=100)
        # At-threshold: pace = 300 s/km — the only eligible run
        _post_run(client, auth_headers, distance_km=1.0, duration_seconds=300)

        data = _get_prs(client, auth_headers)

        assert data["best_pace_seconds_per_km"] == 300.0, (
            f"Expected pace 300.0 s/km from the 1.0 km run, "
            f"got {data['best_pace_seconds_per_km']}"
        )


# ---------------------------------------------------------------------------
# 5. Fastest 5K window (4.5 km ≤ distance ≤ 5.5 km)
# ---------------------------------------------------------------------------


class TestPrsFastest5K:
    def test_5km_run_sets_fastest_5k_seconds(self, client: TestClient, auth_headers: dict):
        """A run at 5.0 km falls inside the 4.5–5.5 km window and sets fastest_5k_seconds."""
        _post_run(client, auth_headers, distance_km=5.0, duration_seconds=1500)

        data = _get_prs(client, auth_headers)

        assert data["fastest_5k_seconds"] == 1500

    def test_6km_run_outside_window_does_not_set_fastest_5k(
        self, client: TestClient, auth_headers: dict
    ):
        """A run at 6.0 km is outside the 5K window and must not set fastest_5k_seconds."""
        _post_run(client, auth_headers, distance_km=6.0, duration_seconds=1800)

        data = _get_prs(client, auth_headers)

        assert data["fastest_5k_seconds"] is None, (
            "A 6.0 km run must not count as a 5K PR"
        )


# ---------------------------------------------------------------------------
# 6. Workout records exclude mirrors
# ---------------------------------------------------------------------------


class TestPrsWorkoutRecordsExcludeMirrors:
    def test_only_mirrors_leave_workout_fields_null(
        self, client: TestClient, auth_headers: dict
    ):
        """Auto-created mirror sessions from run and walk creation must not
        populate workout PR fields."""
        _post_run(client, auth_headers, distance_km=5.0, duration_seconds=1800)
        _post_run(
            client, auth_headers, distance_km=3.0, duration_seconds=1200, run_type="walk"
        )

        data = _get_prs(client, auth_headers)

        assert data["longest_workout_seconds"] is None, (
            "Mirror sessions must not populate longest_workout_seconds"
        )
        assert data["most_kcal_workout"] is None, (
            "Mirror sessions must not populate most_kcal_workout"
        )
        assert data["most_exercises_workout"] is None, (
            "Mirror sessions must not populate most_exercises_workout"
        )

    def test_real_session_sets_workout_fields_mirrors_excluded(
        self, client: TestClient, auth_headers: dict
    ):
        """A real (non-mirror) WorkoutSession sets all three workout PR fields.

        A run with a longer duration is posted first to confirm its mirror is
        excluded; the workout records must reflect only the real session.
        """
        # Run auto-creates a mirror with 7200 s — must not inflate workout PRs
        _post_run(client, auth_headers, distance_km=10.0, duration_seconds=7200)

        today_iso = date.today().isoformat()
        _post_session(
            client,
            auth_headers,
            template_name="Strength Circuit",
            total_duration_seconds=3600,
            total_kcal_estimated=400.0,
            started_at=f"{today_iso}T08:00:00Z",
            exercises=[
                {
                    "exercise_name": "Squat",
                    "duration_seconds": 60,
                    "kcal_burned": 15.0,
                    "order_index": 0,
                },
                {
                    "exercise_name": "Press",
                    "duration_seconds": 60,
                    "kcal_burned": 12.0,
                    "order_index": 1,
                },
            ],
        )

        data = _get_prs(client, auth_headers)

        assert data["longest_workout_seconds"] == 3600, (
            "longest_workout_seconds must come from the real session (3600 s), "
            "not the run mirror (7200 s)"
        )
        assert data["most_kcal_workout"] == 400.0, (
            "most_kcal_workout must reflect the real session's estimate"
        )
        assert data["most_exercises_workout"] == 2, (
            "most_exercises_workout must count only the real session's exercises"
        )


# ---------------------------------------------------------------------------
# 7. Longest streak
# ---------------------------------------------------------------------------


class TestPrsLongestStreak:
    def test_three_consecutive_days_plus_isolated_day_gives_streak_of_three(
        self, client: TestClient, auth_headers: dict
    ):
        """Longest streak equals 3 when three consecutive days are followed by a gap.

        Active days: 2026-01-01, 2026-01-02, 2026-01-03 (chain of 3).
        Isolated:    2026-01-05 (one-day gap at 2026-01-04 breaks it).
        """
        base = date(2026, 1, 1)
        for offset in (0, 1, 2):  # three consecutive days
            _post_run(
                client,
                auth_headers,
                distance_km=5.0,
                duration_seconds=1800,
                date_str=(base + timedelta(days=offset)).isoformat(),
            )
        # Isolated day — one-day gap at 2026-01-04 prevents extending the chain
        _post_run(
            client,
            auth_headers,
            distance_km=5.0,
            duration_seconds=1800,
            date_str=(base + timedelta(days=4)).isoformat(),
        )

        data = _get_prs(client, auth_headers)

        assert data["longest_streak_days"] == 3, (
            f"Expected 3-day streak, got {data['longest_streak_days']}"
        )
