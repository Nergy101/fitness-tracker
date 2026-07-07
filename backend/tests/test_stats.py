"""Behavioral tests for GET /api/v1/stats/overview.

Contracts defended:
- Empty DB returns zeros and no weekly buckets.
- Run and walk entries split correctly into separate weekly fields; mirror
  WorkoutSessions do NOT bleed into workout_minutes.
- Creating a run via POST /api/v1/runs auto-creates a mirror WorkoutSession
  (template_id=None, template_name starts with "Run:"); that session is
  excluded from total_sessions_all and workout_minutes (core double-count
  invariant).
- A real WorkoutSession (non-mirror) DOES increment total_sessions_all and
  workout_minutes without touching run counts.
- total_kcal_burned aggregates mirror-session kcal (default 75 kg weight, or
  the latest logged weight entry).
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient

RUNS_URL = "/api/v1/runs"
SESSIONS_URL = "/api/v1/sessions"
WEIGHT_URL = "/api/v1/health/weight"
OVERVIEW_URL = "/api/v1/stats/overview"


def _monday_of(d: date) -> str:
    """ISO date of the Monday in the same week as *d* (mirrors stats.py logic)."""
    return (d - timedelta(days=d.weekday())).isoformat()


def _this_week() -> str:
    return _monday_of(date.today())


# ---------------------------------------------------------------------------
# 1. Empty DB
# ---------------------------------------------------------------------------


class TestStatsOverviewEmptyDB:
    def test_returns_zeros_and_no_weekly_buckets(self, client: TestClient, auth_headers: dict):
        """Empty DB: 200 with empty activity_weekly and all-zero counters."""
        resp = client.get(OVERVIEW_URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        assert data["activity_weekly"] == []
        assert data["total_runs"] == 0
        assert data["total_walks"] == 0
        assert data["total_sessions_all"] == 0
        assert data["total_kcal_burned"] == 0.0


# ---------------------------------------------------------------------------
# 2. Run / walk split
# ---------------------------------------------------------------------------


class TestStatsOverviewRunWalkSplit:
    def test_one_run_and_one_walk_split_into_correct_fields(
        self, client: TestClient, auth_headers: dict
    ):
        """One run + one walk each map to their own minute/km fields in the week bucket.

        The week bucket's workout_minutes must remain zero because both
        WorkoutSessions that were auto-created are mirror sessions.
        """
        client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": 5.0, "run_type": "run"},
            headers=auth_headers,
        )
        client.post(
            RUNS_URL,
            json={"duration_seconds": 3600, "distance_km": 3.0, "run_type": "walk"},
            headers=auth_headers,
        )

        resp = client.get(OVERVIEW_URL, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        assert data["total_runs"] == 1
        assert data["total_walks"] == 1

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in data["activity_weekly"]}
        assert this_week in buckets, (
            f"Expected week {this_week!r} in {sorted(buckets)!r}"
        )
        wk = buckets[this_week]

        assert wk["run_minutes"] == 30.0    # 1800 s / 60
        assert wk["walk_minutes"] == 60.0   # 3600 s / 60
        assert wk["run_km"] == 5.0
        assert wk["walk_km"] == 3.0
        assert wk["workout_minutes"] == 0.0  # mirror sessions must not contribute


# ---------------------------------------------------------------------------
# 3. No double-counting (core invariant)
# ---------------------------------------------------------------------------


class TestStatsOverviewNoDoubleCount:
    """Mirror WorkoutSessions must never bleed into workout counts."""

    def test_mirror_session_excluded_from_workout_totals(
        self, client: TestClient, auth_headers: dict
    ):
        """Creating a run auto-creates a mirror WorkoutSession; that session
        must not appear in total_sessions_all or workout_minutes."""
        resp = client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": 5.0, "run_type": "run"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        assert stats["total_sessions_all"] == 0, (
            "Mirror session from run creation must not count as a workout session"
        )
        assert stats["total_runs"] == 1

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in stats["activity_weekly"]}
        assert this_week in buckets
        wk = buckets[this_week]

        assert wk["workout_minutes"] == 0.0, (
            "Mirror session must not contribute workout_minutes"
        )
        assert wk["run_minutes"] > 0.0, (
            "Run minutes must still be populated from the run entry"
        )

    def test_real_workout_counts_independently_of_run(
        self, client: TestClient, auth_headers: dict
    ):
        """A real WorkoutSession (non-mirror template_name) increments
        total_sessions_all and workout_minutes without touching run tallies."""
        # Run creates a mirror session — must stay excluded.
        client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": 5.0, "run_type": "run"},
            headers=auth_headers,
        )

        # Real workout session: template_name does NOT start with "Run:" or "Walk:".
        today_iso = date.today().isoformat()
        sess_resp = client.post(
            SESSIONS_URL,
            json={
                "template_name": "Morning Workout",
                "total_duration_seconds": 3600,
                "total_kcal_estimated": 200.0,
                "started_at": f"{today_iso}T08:00:00Z",
                "finished_at": f"{today_iso}T09:00:00Z",
            },
            headers=auth_headers,
        )
        assert sess_resp.status_code == 201

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        assert stats["total_sessions_all"] == 1, (
            "Real workout session must appear in total_sessions_all"
        )
        assert stats["total_runs"] == 1, (
            "Run count must be unaffected by adding a workout session"
        )
        assert stats["total_walks"] == 0

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in stats["activity_weekly"]}
        assert this_week in buckets
        wk = buckets[this_week]

        assert wk["workout_minutes"] == 60.0, (
            "Real session's 3600 s must appear as 60.0 workout_minutes"
        )
        assert wk["run_minutes"] > 0.0, (
            "Run minutes from the run entry must still be present"
        )

    def test_walk_mirror_also_excluded(self, client: TestClient, auth_headers: dict):
        """Walk entries create 'Walk: X.Xkm' mirror sessions; those are also excluded
        from workout counts (both 'Run:' and 'Walk:' prefixes are treated as mirrors)."""
        client.post(
            RUNS_URL,
            json={"duration_seconds": 2400, "distance_km": 2.5, "run_type": "walk"},
            headers=auth_headers,
        )

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        assert stats["total_sessions_all"] == 0, (
            "Walk mirror session must not count as a workout session"
        )
        assert stats["total_walks"] == 1
        assert stats["total_runs"] == 0

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in stats["activity_weekly"]}
        assert this_week in buckets
        wk = buckets[this_week]

        assert wk["workout_minutes"] == 0.0
        assert wk["walk_minutes"] == 40.0   # 2400 s / 60


# ---------------------------------------------------------------------------
# 4. kcal
# ---------------------------------------------------------------------------


class TestStatsOverviewKcal:
    def test_kcal_from_run_mirror_with_default_weight(
        self, client: TestClient, auth_headers: dict
    ):
        """total_kcal_burned includes the mirror session's estimate.

        Formula (from runs.py _calc_run_kcal):
            kcal = round(factor * weight_kg * distance_km, 1)
        factor = 0.97 for run; default weight_kg = 75.0 (no WeightEntry).
        """
        distance_km = 5.0
        resp = client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": distance_km, "run_type": "run"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        expected_kcal = round(0.97 * 75.0 * distance_km, 1)  # 363.8
        assert stats["total_kcal_burned"] == expected_kcal, (
            f"Expected {expected_kcal}, got {stats['total_kcal_burned']}"
        )

    def test_kcal_uses_latest_logged_weight(self, client: TestClient, auth_headers: dict):
        """When a WeightEntry exists, kcal calculation uses the logged weight."""
        logged_weight = 80.0
        client.post(
            WEIGHT_URL,
            json={"weight_kg": logged_weight},
            headers=auth_headers,
        )

        distance_km = 5.0
        client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": distance_km, "run_type": "run"},
            headers=auth_headers,
        )

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        expected_kcal = round(0.97 * logged_weight * distance_km, 1)  # 388.0
        assert stats["total_kcal_burned"] == expected_kcal, (
            f"Expected {expected_kcal} (using logged weight {logged_weight} kg), "
            f"got {stats['total_kcal_burned']}"
        )

    def test_walk_kcal_uses_lower_factor(self, client: TestClient, auth_headers: dict):
        """Walk kcal uses factor 0.5 (not 0.97), so it differs measurably from a run of equal distance."""
        distance_km = 5.0
        client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": distance_km, "run_type": "walk"},
            headers=auth_headers,
        )

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        expected_kcal = round(0.5 * 75.0 * distance_km, 1)  # 187.5
        assert stats["total_kcal_burned"] == expected_kcal, (
            f"Expected {expected_kcal} for walk, got {stats['total_kcal_burned']}"
        )


# ---------------------------------------------------------------------------
# 5. Per-week kcal split (run_kcal / walk_kcal / workout_kcal in activity_weekly)
# ---------------------------------------------------------------------------


class TestStatsOverviewWeeklyKcalSplit:
    """run_kcal / walk_kcal / workout_kcal fields inside weekly buckets are
    populated by the right source and do NOT leak into each other."""

    def test_run_populates_run_kcal_only(self, client: TestClient, auth_headers: dict):
        """A run entry's mirror session kcal lands in run_kcal only.

        Formula: round(0.97 * 75.0 * 5.0, 1) == 363.8 (default weight, no WeightEntry).
        walk_kcal and workout_kcal must remain zero — no cross-contamination.
        """
        distance_km = 5.0
        resp = client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": distance_km, "run_type": "run"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in stats["activity_weekly"]}
        assert this_week in buckets, f"Expected week {this_week!r} in {sorted(buckets)!r}"
        wk = buckets[this_week]

        expected_run_kcal = round(0.97 * 75.0 * distance_km, 1)  # 363.8
        assert wk["run_kcal"] == expected_run_kcal, (
            f"Expected run_kcal={expected_run_kcal}, got {wk['run_kcal']}"
        )
        assert wk["walk_kcal"] == 0.0, f"walk_kcal must be 0.0, got {wk['walk_kcal']}"
        assert wk["workout_kcal"] == 0.0, f"workout_kcal must be 0.0, got {wk['workout_kcal']}"

    def test_walk_populates_walk_kcal_only(self, client: TestClient, auth_headers: dict):
        """A walk entry's mirror session kcal (factor 0.5) lands in walk_kcal only.

        run_kcal must stay zero — the 'Walk:' prefix routes kcal to walk_kcal, not run_kcal.
        """
        distance_km = 4.0
        resp = client.post(
            RUNS_URL,
            json={"duration_seconds": 2400, "distance_km": distance_km, "run_type": "walk"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in stats["activity_weekly"]}
        assert this_week in buckets, f"Expected week {this_week!r} in {sorted(buckets)!r}"
        wk = buckets[this_week]

        expected_walk_kcal = round(0.5 * 75.0 * distance_km, 1)  # 150.0
        assert wk["walk_kcal"] == expected_walk_kcal, (
            f"Expected walk_kcal={expected_walk_kcal}, got {wk['walk_kcal']}"
        )
        assert wk["run_kcal"] == 0.0, f"run_kcal must be 0.0, got {wk['run_kcal']}"
        assert wk["workout_kcal"] == 0.0, f"workout_kcal must be 0.0, got {wk['workout_kcal']}"

    def test_workout_and_run_kcal_isolated_in_same_week(
        self, client: TestClient, auth_headers: dict
    ):
        """Real workout and run in the same week each populate their own kcal field.

        Contracts defended:
        - workout session's total_kcal_estimated goes to workout_kcal only.
        - run mirror session's kcal goes to run_kcal only.
        - walk_kcal stays zero.
        - Neither bleeds into the other (mirror kcal never lands in workout_kcal;
          workout kcal never lands in run_kcal).
        """
        today_iso = date.today().isoformat()
        workout_kcal_value = 250.0
        run_distance_km = 5.0

        # Real (non-mirror) workout session — template_name has no Run:/Walk: prefix.
        sess_resp = client.post(
            SESSIONS_URL,
            json={
                "template_name": "Strength Training",
                "total_duration_seconds": 3000,
                "total_kcal_estimated": workout_kcal_value,
                "started_at": f"{today_iso}T07:00:00Z",
                "finished_at": f"{today_iso}T07:50:00Z",
            },
            headers=auth_headers,
        )
        assert sess_resp.status_code == 201

        # Run — auto-creates a mirror session with run_kcal = round(0.97*75*5, 1).
        run_resp = client.post(
            RUNS_URL,
            json={"duration_seconds": 1800, "distance_km": run_distance_km, "run_type": "run"},
            headers=auth_headers,
        )
        assert run_resp.status_code == 201

        stats = client.get(OVERVIEW_URL, headers=auth_headers).json()

        this_week = _this_week()
        buckets = {w["week_start"]: w for w in stats["activity_weekly"]}
        assert this_week in buckets, f"Expected week {this_week!r} in {sorted(buckets)!r}"
        wk = buckets[this_week]

        expected_run_kcal = round(0.97 * 75.0 * run_distance_km, 1)  # 363.8
        assert wk["workout_kcal"] == workout_kcal_value, (
            f"workout_kcal must equal the real session's kcal "
            f"({workout_kcal_value}), got {wk['workout_kcal']}"
        )
        assert wk["run_kcal"] == expected_run_kcal, (
            f"run_kcal must equal the mirror session's kcal "
            f"({expected_run_kcal}), got {wk['run_kcal']}"
        )
        assert wk["walk_kcal"] == 0.0, (
            f"walk_kcal must be 0.0, got {wk['walk_kcal']}"
        )
