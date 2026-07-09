"""Tests for Apple Health import endpoints.

Endpoints under test:
  POST /api/v1/import/data    – ingest Health Auto Export JSON
  GET  /api/v1/import/insights – curated per-metric daily series
"""

import json
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import HealthMetric, HealthWorkout

# ---------------------------------------------------------------------------
# Payload helpers
# ---------------------------------------------------------------------------

_FMT = "%Y-%m-%d %H:%M:%S +0000"


def _date_str(days_ago: int = 0) -> str:
    """Health Auto Export date string for N days ago from today."""
    d = date.today() - timedelta(days=days_ago)
    return d.strftime(_FMT)


def _metric(name: str, units: str, points: list) -> dict:
    return {"name": name, "units": units, "data": points}


def _scalar_point(days_ago: int, qty: float) -> dict:
    """A plain scalar point (qty field) e.g. step_count, resting_heart_rate."""
    return {"date": _date_str(days_ago), "qty": qty, "source": "iPhone"}


def _hr_point(days_ago: int, avg: float, min_bpm: float = 45.0, max_bpm: float = 160.0) -> dict:
    """A heart_rate point — no qty, uses Max/Min/Avg fields."""
    return {
        "date": _date_str(days_ago),
        "Avg": avg,
        "Min": min_bpm,
        "Max": max_bpm,
        "source": "Apple Watch",
    }


def _sleep_point(days_ago: int, total_sleep: float) -> dict:
    """A sleep_analysis point — no qty, uses totalSleep."""
    return {"date": _date_str(days_ago), "totalSleep": total_sleep, "source": "iPhone"}


def _payload(*metrics) -> dict:
    """Wrap metrics in the Health Auto Export envelope (no workouts)."""
    return {"data": {"metrics": list(metrics), "workouts": []}}


def _workout_entry(
    ext_id: str = "WORKOUT-UUID-1",
    name: str = "Running",
    duration: float = 1800.0,
    distance_qty: float = 5.0,
    active_energy_qty: float = 400.0,
    avg_hr: float = 145.0,
    max_hr: float = 175.0,
) -> dict:
    """A representative workout with nested-qty scalars and list-valued fields."""
    return {
        "id": ext_id,
        "name": name,
        "start": _date_str(1),
        "end": _date_str(0),
        "duration": duration,
        "distance": {"qty": distance_qty, "units": "km"},
        "activeEnergyBurned": {"qty": active_energy_qty, "units": "kJ"},
        "avgHeartRate": {"qty": avg_hr, "units": "bpm"},
        "maxHeartRate": {"qty": max_hr, "units": "bpm"},
        # These are list-valued — must be stripped from stored data
        "heartRateData": [{"date": _date_str(1), "bpm": 140}],
        "route": [{"lat": 0.0, "lon": 0.0}],
    }


# ---------------------------------------------------------------------------
# 1. Scalar metric import
# ---------------------------------------------------------------------------


class TestImportScalarMetrics:
    URL = "/api/v1/import/data"

    def test_response_counts_and_date_bounds(
        self, client: TestClient, auth_headers: dict
    ):
        """Response reflects: total unique (name,date) pairs, distinct metric
        types, and the calendar-day span of imported points."""
        payload = _payload(
            _metric(
                "step_count", "count",
                [_scalar_point(d, 8000 + d) for d in range(3)],   # 3 points: day-0,1,2
            ),
            _metric(
                "resting_heart_rate", "bpm",
                [_scalar_point(d, 60 + d) for d in range(2)],     # 2 points: day-0,1
            ),
        )
        resp = client.post(self.URL, json=payload, headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["metrics_imported"] == 5          # 3 + 2 unique (name,date) pairs
        assert body["metric_types"] == 2
        assert body["earliest"] == (date.today() - timedelta(days=2)).isoformat()
        assert body["latest"] == date.today().isoformat()

    def test_rows_visible_via_db_fixture(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Imported rows are immediately queryable through the shared db fixture."""
        payload = _payload(
            _metric("step_count", "count", [
                _scalar_point(0, 9000),
                _scalar_point(1, 7500),
            ]),
        )
        resp = client.post(self.URL, json=payload, headers=auth_headers)
        assert resp.status_code == 200

        rows = (
            db.query(HealthMetric)
            .filter(HealthMetric.metric_name == "step_count")
            .all()
        )
        assert len(rows) == 2
        stored_qtys = {r.qty for r in rows}
        assert 9000.0 in stored_qtys
        assert 7500.0 in stored_qtys


# ---------------------------------------------------------------------------
# 2. Special scalar keys: heart_rate → Avg, sleep_analysis → totalSleep
# ---------------------------------------------------------------------------


class TestSpecialMetricKeys:
    URL = "/api/v1/import/data"

    def test_heart_rate_qty_is_avg(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """heart_rate points store the Avg field as qty, not Max or Min."""
        client.post(
            self.URL,
            json=_payload(_metric("heart_rate", "bpm", [
                _hr_point(0, avg=72.0, min_bpm=45.0, max_bpm=160.0),
            ])),
            headers=auth_headers,
        )

        row = db.query(HealthMetric).filter(
            HealthMetric.metric_name == "heart_rate"
        ).one()
        assert row.qty == 72.0

    def test_heart_rate_data_column_retains_max_min_avg(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """heart_rate data column preserves Max, Min, and Avg from the original
        point — callers need these for range display."""
        client.post(
            self.URL,
            json=_payload(_metric("heart_rate", "bpm", [
                _hr_point(0, avg=72.0, min_bpm=45.0, max_bpm=160.0),
            ])),
            headers=auth_headers,
        )

        row = db.query(HealthMetric).filter(
            HealthMetric.metric_name == "heart_rate"
        ).one()
        stored = json.loads(row.data)
        assert stored["Avg"] == 72.0
        assert stored["Min"] == 45.0
        assert stored["Max"] == 160.0

    def test_sleep_analysis_qty_is_total_sleep(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """sleep_analysis points store totalSleep as qty."""
        client.post(
            self.URL,
            json=_payload(_metric("sleep_analysis", "hr", [
                _sleep_point(0, total_sleep=7.25),
            ])),
            headers=auth_headers,
        )

        row = db.query(HealthMetric).filter(
            HealthMetric.metric_name == "sleep_analysis"
        ).one()
        assert row.qty == 7.25

    def test_sleep_analysis_data_column_has_total_sleep_key(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """sleep_analysis data column retains totalSleep so multi-stage breakdown
        remains available for future display."""
        client.post(
            self.URL,
            json=_payload(_metric("sleep_analysis", "hr", [
                _sleep_point(0, total_sleep=7.25),
            ])),
            headers=auth_headers,
        )

        row = db.query(HealthMetric).filter(
            HealthMetric.metric_name == "sleep_analysis"
        ).one()
        stored = json.loads(row.data)
        assert "totalSleep" in stored
        assert stored["totalSleep"] == 7.25


# ---------------------------------------------------------------------------
# 3. Idempotent upsert
# ---------------------------------------------------------------------------


class TestIdempotentUpsert:
    URL = "/api/v1/import/data"

    def test_second_post_does_not_add_rows(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Posting the identical payload twice leaves the row count unchanged."""
        payload = _payload(
            _metric("step_count", "count", [
                _scalar_point(0, 8000),
                _scalar_point(1, 7000),
            ]),
        )
        client.post(self.URL, json=payload, headers=auth_headers)
        count_after_first = db.query(HealthMetric).count()

        client.post(self.URL, json=payload, headers=auth_headers)
        assert db.query(HealthMetric).count() == count_after_first

    def test_changed_qty_overwrites_not_appends(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Re-importing the same (name, date) with a different qty overwrites
        the existing row — exactly one row exists with the updated value."""
        today_str = _date_str(0)
        payload_v1 = _payload(
            _metric("step_count", "count", [
                {"date": today_str, "qty": 5000, "source": "iPhone"},
            ]),
        )
        payload_v2 = _payload(
            _metric("step_count", "count", [
                {"date": today_str, "qty": 9999, "source": "iPhone"},
            ]),
        )

        client.post(self.URL, json=payload_v1, headers=auth_headers)
        client.post(self.URL, json=payload_v2, headers=auth_headers)

        rows = (
            db.query(HealthMetric)
            .filter(
                HealthMetric.metric_name == "step_count",
                HealthMetric.date == date.today(),
            )
            .all()
        )
        assert len(rows) == 1
        assert rows[0].qty == 9999.0


# ---------------------------------------------------------------------------
# 4. Workout upsert
# ---------------------------------------------------------------------------


class TestWorkoutUpsert:
    URL = "/api/v1/import/data"

    def _post_workout(self, client, auth_headers, **kw):
        payload = {"data": {"metrics": [], "workouts": [_workout_entry(**kw)]}}
        return client.post(self.URL, json=payload, headers=auth_headers)

    def test_nested_qty_scalars_unwrapped_to_columns(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Nested {qty,units} wrappers are unwrapped into dedicated scalar columns."""
        resp = self._post_workout(
            client, auth_headers,
            ext_id="W-SCALARS",
            distance_qty=10.5,
            active_energy_qty=600.0,
            avg_hr=148.0,
            max_hr=180.0,
            duration=3600.0,
        )
        assert resp.status_code == 200
        assert resp.json()["workouts_imported"] == 1

        row = db.query(HealthWorkout).filter(
            HealthWorkout.external_id == "W-SCALARS"
        ).one()
        assert row.distance_km == 10.5
        assert row.active_energy_kj == 600.0
        assert row.avg_heart_rate == 148.0
        assert row.max_heart_rate == 180.0
        assert row.duration_seconds == 3600.0

    def test_reimport_same_id_no_duplicate_row(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Re-importing a workout with the same UUID upserts — no second row."""
        payload = {"data": {"metrics": [], "workouts": [_workout_entry(ext_id="W-DEDUP")]}}

        client.post(self.URL, json=payload, headers=auth_headers)
        client.post(self.URL, json=payload, headers=auth_headers)

        count = db.query(HealthWorkout).filter(
            HealthWorkout.external_id == "W-DEDUP"
        ).count()
        assert count == 1

    def test_list_valued_fields_not_stored_as_lists(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """List-valued fields (heartRateData, route) are stripped from the stored
        JSON blob — only scalar-safe fields are kept."""
        payload = {"data": {"metrics": [], "workouts": [_workout_entry(ext_id="W-LISTS")]}}
        client.post(self.URL, json=payload, headers=auth_headers)

        row = db.query(HealthWorkout).filter(
            HealthWorkout.external_id == "W-LISTS"
        ).one()
        stored = json.loads(row.data)
        for key in ("heartRateData", "route"):
            assert not isinstance(stored.get(key), list), (
                f"{key!r} must not be stored as a list in workout data"
            )


# ---------------------------------------------------------------------------
# 5. Insights endpoint
# ---------------------------------------------------------------------------


class TestInsightsEndpoint:
    IMPORT_URL = "/api/v1/import/data"
    INSIGHTS_URL = "/api/v1/import/insights"

    def test_active_energy_converted_kj_to_kcal(
        self, client: TestClient, auth_headers: dict
    ):
        """active_energy is stored in kJ and returned by insights as kcal
        (divided by 4.184, rounded to 2 decimal places)."""
        kj = 800.0
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("active_energy", "kJ", [_scalar_point(0, kj)])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        assert resp.status_code == 200
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        assert "active_energy" in series_by_metric
        returned_value = series_by_metric["active_energy"]["points"][0]["value"]
        assert returned_value == round(kj / 4.184, 2)

    def test_metrics_without_data_absent_from_series(
        self, client: TestClient, auth_headers: dict
    ):
        """Only curated metrics that have imported rows appear in the series;
        the rest are silently omitted."""
        # Import only step_count; no other curated metric has data
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [_scalar_point(0, 10000)])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        returned = {s["metric"] for s in resp.json()["series"]}
        assert "step_count" in returned
        for absent in (
            "resting_heart_rate", "vo2_max",
            "sleep_analysis", "active_energy", "apple_exercise_time",
        ):
            assert absent not in returned

    def test_points_ordered_ascending(
        self, client: TestClient, auth_headers: dict
    ):
        """Points within a series are chronologically ascending regardless of
        import order."""
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [
                _scalar_point(2, 6000),
                _scalar_point(0, 8000),
                _scalar_point(1, 7000),
            ])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        dates = [p["date"] for p in series_by_metric["step_count"]["points"]]
        assert dates == sorted(dates)

    def test_days_window_excludes_older_points(
        self, client: TestClient, auth_headers: dict
    ):
        """Points older than the requested `days` window are excluded;
        recent points appear."""
        old_date = date.today() - timedelta(days=200)
        old_date_str = old_date.strftime(_FMT)

        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [
                {"date": old_date_str, "qty": 1111, "source": "iPhone"},
                {"date": _date_str(0), "qty": 9999, "source": "iPhone"},
            ])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL + "?days=30", headers=auth_headers)
        assert resp.status_code == 200
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        assert "step_count" in series_by_metric
        point_dates = {p["date"] for p in series_by_metric["step_count"]["points"]}
        assert old_date.isoformat() not in point_dates
        assert date.today().isoformat() in point_dates


# ---------------------------------------------------------------------------
# 6. Heart Rate range band in /insights
# ---------------------------------------------------------------------------


class TestInsightsHeartRateBand:
    IMPORT_URL = "/api/v1/import/data"
    INSIGHTS_URL = "/api/v1/import/insights"

    def test_series_present_with_correct_value_min_max(
        self, client: TestClient, auth_headers: dict
    ):
        """heart_rate series carries value=Avg, min/max from stored data JSON."""
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("heart_rate", "bpm", [
                _hr_point(0, avg=72.0, min_bpm=45.0, max_bpm=160.0),
            ])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        assert resp.status_code == 200
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        assert "heart_rate" in series_by_metric
        pt = series_by_metric["heart_rate"]["points"][0]
        assert pt["value"] == 72.0
        assert pt["min"] == 45.0
        assert pt["max"] == 160.0

    def test_series_label_and_unit(
        self, client: TestClient, auth_headers: dict
    ):
        """heart_rate series carries label='Heart Rate' and unit='bpm'."""
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("heart_rate", "bpm", [_hr_point(0, avg=68.0)])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        hr = series_by_metric["heart_rate"]
        assert hr["label"] == "Heart Rate"
        assert hr["unit"] == "bpm"

    def test_min_max_null_when_point_has_no_min_max_keys(
        self, client: TestClient, auth_headers: dict
    ):
        """If the stored data JSON has no Min/Max fields, both come back as null."""
        # Craft a point with only Avg — no Min, no Max.
        bare_point = {"date": _date_str(0), "Avg": 68.0, "source": "Apple Watch"}
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("heart_rate", "bpm", [bare_point])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        assert "heart_rate" in series_by_metric
        pt = series_by_metric["heart_rate"]["points"][0]
        assert pt["min"] is None
        assert pt["max"] is None

    def test_scalar_series_points_have_null_min_max(
        self, client: TestClient, auth_headers: dict
    ):
        """Non-range series (e.g. step_count) expose min=null and max=null on
        every point — they are not range bands."""
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [_scalar_point(0, 9000)])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        pt = series_by_metric["step_count"]["points"][0]
        assert pt["min"] is None
        assert pt["max"] is None

    def test_heart_rate_series_absent_when_no_heart_rate_rows(
        self, client: TestClient, auth_headers: dict
    ):
        """heart_rate series is omitted when there are no heart_rate rows in
        the DB — only series with data are returned."""
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [_scalar_point(0, 9000)])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        returned = {s["metric"] for s in resp.json()["series"]}
        assert "heart_rate" not in returned
        assert "step_count" in returned

    def test_days_window_excludes_old_heart_rate_rows(
        self, client: TestClient, auth_headers: dict
    ):
        """HR points outside the days window are excluded; points inside appear."""
        old_date = date.today() - timedelta(days=200)
        old_point = {
            "date": old_date.strftime(_FMT),
            "Avg": 75.0, "Min": 50.0, "Max": 170.0,
            "source": "Apple Watch",
        }
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("heart_rate", "bpm", [
                old_point,
                _hr_point(0, avg=72.0, min_bpm=45.0, max_bpm=160.0),
            ])),
            headers=auth_headers,
        )

        resp = client.get(self.INSIGHTS_URL + "?days=30", headers=auth_headers)
        assert resp.status_code == 200
        series_by_metric = {s["metric"]: s for s in resp.json()["series"]}
        assert "heart_rate" in series_by_metric
        point_dates = {p["date"] for p in series_by_metric["heart_rate"]["points"]}
        assert old_date.isoformat() not in point_dates
        assert date.today().isoformat() in point_dates


# ---------------------------------------------------------------------------
# 7. Workout summaries endpoint
# ---------------------------------------------------------------------------


class TestHealthWorkoutsEndpoint:
    IMPORT_URL = "/api/v1/import/data"
    WORKOUTS_URL = "/api/v1/import/workouts"

    def _import(self, client, auth_headers, entry: dict):
        payload = {"data": {"metrics": [], "workouts": [entry]}}
        resp = client.post(self.IMPORT_URL, json=payload, headers=auth_headers)
        assert resp.status_code == 200
        return resp

    def test_empty_db_returns_empty_list(
        self, client: TestClient, auth_headers: dict
    ):
        """No workouts imported → response body is {"workouts": []}."""
        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == {"workouts": []}

    def test_happy_path_field_mapping(
        self, client: TestClient, auth_headers: dict
    ):
        """All summary fields map correctly from the imported workout row."""
        entry = {
            "id": "W-HAPPY",
            "name": "Cycling",
            "start": _date_str(1),
            "end": _date_str(0),
            "duration": 3000.0,                                    # → 50.0 min
            "distance": {"qty": 25.0, "units": "km"},
            "activeEnergyBurned": {"qty": 1600.0, "units": "kJ"},  # → 382.4 kcal
            "avgHeartRate": {"qty": 140.0, "units": "bpm"},
            "maxHeartRate": {"qty": 175.0, "units": "bpm"},
        }
        self._import(client, auth_headers, entry)

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        assert resp.status_code == 200
        workouts = resp.json()["workouts"]
        assert len(workouts) == 1
        w = workouts[0]
        assert w["date"] == (date.today() - timedelta(days=1)).isoformat()
        assert w["name"] == "Cycling"
        assert w["duration_min"] == 50.0
        assert w["distance_km"] == 25.0
        assert w["energy_kcal"] == 382.4
        assert w["avg_hr"] == 140.0
        assert w["max_hr"] == 175.0

    def test_duration_seconds_to_minutes_rounded_one_dp(
        self, client: TestClient, auth_headers: dict
    ):
        """duration_min = round(duration_seconds / 60, 1); fractional seconds
        are preserved to one decimal place."""
        entry = {
            "id": "W-DUR",
            "name": "Yoga",
            "start": _date_str(0),
            "end": _date_str(0),
            "duration": 2567.0,  # 2567 / 60 = 42.783... → 42.8
        }
        self._import(client, auth_headers, entry)

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        w = resp.json()["workouts"][0]
        assert w["duration_min"] == round(2567.0 / 60, 1)  # 42.8

    def test_kj_to_kcal_conversion(
        self, client: TestClient, auth_headers: dict
    ):
        """1600 kJ stored with units='kJ' → energy_kcal = round(1600/4.184, 1) = 382.4."""
        entry = {
            "id": "W-KJ",
            "name": "Run",
            "start": _date_str(0),
            "end": _date_str(0),
            "duration": 1800.0,
            "activeEnergyBurned": {"qty": 1600.0, "units": "kJ"},
        }
        self._import(client, auth_headers, entry)

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        w = resp.json()["workouts"][0]
        assert w["energy_kcal"] == 382.4

    def test_kcal_passthrough(
        self, client: TestClient, auth_headers: dict
    ):
        """500 kcal with units='kcal' is returned as 500.0 — no conversion applied."""
        entry = {
            "id": "W-KCAL",
            "name": "Walk",
            "start": _date_str(0),
            "end": _date_str(0),
            "duration": 1800.0,
            "activeEnergyBurned": {"qty": 500.0, "units": "kcal"},
        }
        self._import(client, auth_headers, entry)

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        w = resp.json()["workouts"][0]
        assert w["energy_kcal"] == 500.0

    def test_missing_scalars_returned_as_null(
        self, client: TestClient, auth_headers: dict
    ):
        """Workout without distance/energy/hr fields returns null for those columns."""
        entry = {
            "id": "W-NULLS",
            "name": "Meditation",
            "start": _date_str(0),
            "end": _date_str(0),
            "duration": 600.0,
            # no distance, no energy, no hr fields
        }
        self._import(client, auth_headers, entry)

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        w = resp.json()["workouts"][0]
        assert w["distance_km"] is None
        assert w["energy_kcal"] is None
        assert w["avg_hr"] is None
        assert w["max_hr"] is None

    def test_ordered_by_start_ascending(
        self, client: TestClient, auth_headers: dict
    ):
        """Workouts are returned oldest-first regardless of import order."""
        # Import in non-ascending order: 3-ago, 5-ago, 1-ago
        for ext_id, days_ago in [("W-MID", 3), ("W-OLD", 5), ("W-NEW", 1)]:
            self._import(client, auth_headers, {
                "id": ext_id,
                "name": ext_id,
                "start": _date_str(days_ago),
                "end": _date_str(days_ago),
                "duration": 1200.0,
            })

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        dates = [w["date"] for w in resp.json()["workouts"]]
        assert dates == sorted(dates), f"Expected ascending order, got {dates}"

    def test_days_window_excludes_old_workouts(
        self, client: TestClient, auth_headers: dict
    ):
        """Workouts started before the days window are not returned."""
        old_date = date.today() - timedelta(days=200)
        self._import(client, auth_headers, {
            "id": "W-OLD",
            "name": "OldRun",
            "start": old_date.strftime(_FMT),
            "end": old_date.strftime(_FMT),
            "duration": 1800.0,
        })
        self._import(client, auth_headers, {
            "id": "W-RECENT",
            "name": "RecentRun",
            "start": _date_str(1),
            "end": _date_str(0),
            "duration": 1800.0,
        })

        resp = client.get(self.WORKOUTS_URL + "?days=30", headers=auth_headers)
        assert resp.status_code == 200
        returned_names = {w["name"] for w in resp.json()["workouts"]}
        assert "OldRun" not in returned_names
        assert "RecentRun" in returned_names

    def test_null_start_workout_excluded(
        self, client: TestClient, auth_headers: dict
    ):
        """Workout entries with no parseable start date are excluded from results."""
        # No "start" key → _parse_dt(None) → start=NULL → filtered by endpoint
        self._import(client, auth_headers, {
            "id": "W-NOSTART",
            "name": "UnstartedWorkout",
            "duration": 1200.0,
        })
        # A valid workout for contrast
        self._import(client, auth_headers, {
            "id": "W-WITHSTART",
            "name": "StartedWorkout",
            "start": _date_str(0),
            "end": _date_str(0),
            "duration": 1200.0,
        })

        resp = client.get(self.WORKOUTS_URL, headers=auth_headers)
        names = {w["name"] for w in resp.json()["workouts"]}
        assert "UnstartedWorkout" not in names
        assert "StartedWorkout" in names


# ---------------------------------------------------------------------------
# Sleep-stage breakdown in insights
# ---------------------------------------------------------------------------


def _staged_sleep_point(days_ago: int, deep: float, core: float, rem: float, awake: float) -> dict:
    return {
        "date": _date_str(days_ago),
        "totalSleep": round(deep + core + rem, 2),
        "deep": deep, "core": core, "rem": rem, "awake": awake,
        "source": "Apple Watch",
    }


class TestInsightsSleepStages:
    IMPORT_URL = "/api/v1/import/data"
    INSIGHTS_URL = "/api/v1/import/insights"

    def _sleep_series(self, client, auth_headers, *points):
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("sleep_analysis", "hr", list(points))),
            headers=auth_headers,
        )
        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        assert resp.status_code == 200
        return {s["metric"]: s for s in resp.json()["series"]}["sleep_analysis"]

    def test_staged_point_round_trips_stage_hours(
        self, client: TestClient, auth_headers: dict
    ):
        """A point with a stage breakdown returns deep/core/rem/awake."""
        series = self._sleep_series(
            client, auth_headers, _staged_sleep_point(0, deep=1.1, core=4.5, rem=1.6, awake=0.3)
        )
        pt = series["points"][0]
        assert pt["stages"] == {"deep": 1.1, "core": 4.5, "rem": 1.6, "awake": 0.3}
        assert pt["value"] == 7.2  # totalSleep = deep + core + rem

    def test_totals_only_point_has_null_stages(
        self, client: TestClient, auth_headers: dict
    ):
        """iPhone-only sources report just totalSleep — stages stays null."""
        series = self._sleep_series(client, auth_headers, _sleep_point(0, total_sleep=7.25))
        assert series["points"][0]["stages"] is None

    def test_partial_stages_keep_missing_fields_null(
        self, client: TestClient, auth_headers: dict
    ):
        """A numeric core with the other stages absent still yields a stages
        object (nulls for the missing fields)."""
        point = {"date": _date_str(0), "totalSleep": 6.0, "core": 6.0}
        series = self._sleep_series(client, auth_headers, point)
        assert series["points"][0]["stages"] == {"deep": None, "core": 6.0, "rem": None, "awake": None}

    def test_awake_only_point_has_null_stages(
        self, client: TestClient, auth_headers: dict
    ):
        """awake alone is not a sleep breakdown — stages stays null."""
        point = {"date": _date_str(0), "totalSleep": 6.0, "awake": 0.4}
        series = self._sleep_series(client, auth_headers, point)
        assert series["points"][0]["stages"] is None

    def test_non_numeric_stage_values_treated_as_missing(
        self, client: TestClient, auth_headers: dict
    ):
        """String stage values don't crash the endpoint or leak through."""
        point = {"date": _date_str(0), "totalSleep": 6.0, "deep": "n/a", "core": 4.0}
        series = self._sleep_series(client, auth_headers, point)
        assert series["points"][0]["stages"] == {"deep": None, "core": 4.0, "rem": None, "awake": None}

    def test_scalar_series_points_have_null_stages(
        self, client: TestClient, auth_headers: dict
    ):
        """Non-sleep metrics always return stages: null."""
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [_scalar_point(0, 9000)])),
            headers=auth_headers,
        )
        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        steps = {s["metric"]: s for s in resp.json()["series"]}["step_count"]
        assert steps["points"][0]["stages"] is None


# ---------------------------------------------------------------------------
# Aggregated-format fallback: {Min, Max, Avg} points without a plain qty
# ---------------------------------------------------------------------------


class TestAggregatedAvgFallback:
    IMPORT_URL = "/api/v1/import/data"
    INSIGHTS_URL = "/api/v1/import/insights"

    def test_avg_only_point_stored_and_served(
        self, client: TestClient, auth_headers: dict
    ):
        """Health Auto Export's aggregated format has no qty for any metric.
        The Avg field must be used so imports don't silently store NULL and
        leave every insight series empty."""
        point = {"date": _date_str(0), "Avg": 52.4, "Min": 48.0, "Max": 58.0}
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("resting_heart_rate", "bpm", [point])),
            headers=auth_headers,
        )
        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series = {s["metric"]: s for s in resp.json()["series"]}
        assert "resting_heart_rate" in series
        assert series["resting_heart_rate"]["points"][0]["value"] == 52.4

    def test_plain_qty_still_wins_over_avg(
        self, client: TestClient, auth_headers: dict
    ):
        """When both qty and Avg exist, qty is authoritative."""
        point = {"date": _date_str(0), "qty": 51.0, "Avg": 99.0}
        client.post(
            self.IMPORT_URL,
            json=_payload(_metric("resting_heart_rate", "bpm", [point])),
            headers=auth_headers,
        )
        resp = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series = {s["metric"]: s for s in resp.json()["series"]}
        assert series["resting_heart_rate"]["points"][0]["value"] == 51.0



# ---------------------------------------------------------------------------
# 8. Same-day point merging
# ---------------------------------------------------------------------------


def _point_at_hour(days_ago: int, hour: int, qty: float) -> dict:
    """Scalar point at an explicit hour on the given calendar day (UTC)."""
    d = date.today() - timedelta(days=days_ago)
    return {"date": f"{d.strftime('%Y-%m-%d')} {hour:02d}:00:00 +0000", "qty": qty, "source": "iPhone"}


def _hr_point_at_hour(
    days_ago: int, hour: int, avg: float, min_bpm: float = 45.0, max_bpm: float = 160.0
) -> dict:
    """heart_rate point at an explicit hour on the given calendar day (UTC)."""
    d = date.today() - timedelta(days=days_ago)
    return {
        "date": f"{d.strftime('%Y-%m-%d')} {hour:02d}:00:00 +0000",
        "Avg": avg, "Min": min_bpm, "Max": max_bpm, "source": "Apple Watch",
    }


def _staged_sleep_point_at_hour(
    days_ago: int, hour: int, deep: float, core: float, rem: float, awake: float
) -> dict:
    """sleep_analysis point with stage breakdown at an explicit hour."""
    d = date.today() - timedelta(days=days_ago)
    total = round(deep + core + rem, 4)
    return {
        "date": f"{d.strftime('%Y-%m-%d')} {hour:02d}:00:00 +0000",
        "totalSleep": total, "deep": deep, "core": core, "rem": rem, "awake": awake,
        "source": "Apple Watch",
    }


class TestSameDayPointMerging:
    """POST /api/v1/import/data collapses multiple same-day points per metric:
    cumulative metrics sum; gauge metrics average; heart_rate keeps min/max;
    sleep fragments sum stage keys; re-posting the same payload is idempotent."""

    IMPORT_URL = "/api/v1/import/data"
    INSIGHTS_URL = "/api/v1/import/insights"

    def test_step_count_hourly_points_sum(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Three hourly step_count points on the same day collapse to their sum."""
        pts = [
            _point_at_hour(0, 8, 500.0),
            _point_at_hour(0, 12, 1200.0),
            _point_at_hour(0, 16, 800.0),
        ]
        resp = client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", pts)),
            headers=auth_headers,
        )
        assert resp.status_code == 200

        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "step_count").all()
        assert len(rows) == 1
        assert rows[0].qty == 2500.0

    def test_active_energy_hourly_points_sum_and_visible_in_insights(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Hourly active_energy points sum to one DB row AND appear in /insights.

        Regression: the original last-write-wins logic stored only the last
        interval (e.g. 150 kJ of a 450 kJ day), so the series appeared empty
        to the frontend unless the final hourly chunk was unusually large.
        """
        pts = [
            _point_at_hour(0, 8, 100.0),
            _point_at_hour(0, 12, 200.0),
            _point_at_hour(0, 16, 150.0),
        ]
        resp = client.post(
            self.IMPORT_URL,
            json=_payload(_metric("active_energy", "kJ", pts)),
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # One row with full daily total, not just the last interval
        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "active_energy").all()
        assert len(rows) == 1
        assert rows[0].qty == 450.0

        # /insights surfaces the metric (kJ → kcal conversion applied)
        resp_i = client.get(self.INSIGHTS_URL, headers=auth_headers)
        assert resp_i.status_code == 200
        series = {s["metric"]: s for s in resp_i.json()["series"]}
        assert "active_energy" in series
        pt = series["active_energy"]["points"][0]
        assert pt["value"] == round(450.0 / 4.184, 2)

    def test_gauge_metric_averages_on_same_day(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Same-day respiratory_rate points (a gauge, not cumulative) collapse
        to their mean, not their sum."""
        pts = [
            _point_at_hour(0, 8, 15.0),
            _point_at_hour(0, 12, 17.0),
            _point_at_hour(0, 16, 19.0),
        ]
        resp = client.post(
            self.IMPORT_URL,
            json=_payload(_metric("respiratory_rate", "breaths/min", pts)),
            headers=auth_headers,
        )
        assert resp.status_code == 200

        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "respiratory_rate").all()
        assert len(rows) == 1
        assert rows[0].qty == 17.0  # (15 + 17 + 19) / 3

    def test_heart_rate_multi_point_merge_min_max_avg_in_insights(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Two heart_rate points on the same day: stored qty = mean(Avg);
        stored data JSON gets Min = min(Mins), Max = max(Maxes);
        /insights band point correctly surfaces all three."""
        pts = [
            _hr_point_at_hour(0, 8,  avg=70.0, min_bpm=45.0, max_bpm=130.0),
            _hr_point_at_hour(0, 16, avg=90.0, min_bpm=55.0, max_bpm=180.0),
        ]
        resp = client.post(
            self.IMPORT_URL,
            json=_payload(_metric("heart_rate", "bpm", pts)),
            headers=auth_headers,
        )
        assert resp.status_code == 200

        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "heart_rate").all()
        assert len(rows) == 1
        assert rows[0].qty == 80.0  # (70 + 90) / 2

        stored = json.loads(rows[0].data)
        assert stored["Min"] == 45.0    # min of [45, 55]
        assert stored["Max"] == 180.0   # max of [130, 180]
        assert stored["Avg"] == 80.0

        # /insights heart_rate band reflects merged values
        resp_i = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series = {s["metric"]: s for s in resp_i.json()["series"]}
        assert "heart_rate" in series
        pt = series["heart_rate"]["points"][0]
        assert pt["value"] == 80.0
        assert pt["min"] == 45.0
        assert pt["max"] == 180.0

    def test_sleep_fragments_sum_including_stages(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Two sleep_analysis fragments for the same night: totalSleep sums;
        each stage key (deep/core/rem/awake) also sums; /insights reflects both."""
        # Fragment 1: totalSleep = 0.5 + 2.0 + 0.5 = 3.0
        # Fragment 2: totalSleep = 1.0 + 2.5 + 0.5 = 4.0
        pts = [
            _staged_sleep_point_at_hour(0, 0, deep=0.5, core=2.0, rem=0.5, awake=0.2),
            _staged_sleep_point_at_hour(0, 4, deep=1.0, core=2.5, rem=0.5, awake=0.3),
        ]
        resp = client.post(
            self.IMPORT_URL,
            json=_payload(_metric("sleep_analysis", "hr", pts)),
            headers=auth_headers,
        )
        assert resp.status_code == 200

        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "sleep_analysis").all()
        assert len(rows) == 1
        assert rows[0].qty == 7.0  # 3.0 + 4.0

        # /insights exposes summed stages
        resp_i = client.get(self.INSIGHTS_URL, headers=auth_headers)
        series = {s["metric"]: s for s in resp_i.json()["series"]}
        assert "sleep_analysis" in series
        pt = series["sleep_analysis"]["points"][0]
        assert pt["value"] == 7.0
        stages = pt["stages"]
        assert stages is not None
        assert stages["deep"] == 1.5   # 0.5 + 1.0
        assert stages["core"] == 4.5   # 2.0 + 2.5
        assert stages["rem"] == 1.0    # 0.5 + 0.5

    def test_repost_same_multi_point_payload_yields_same_stored_qty(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """Re-posting the identical multi-point payload produces the same
        aggregated qty — the upsert overwrites with an equal sum, never doubles."""
        pts = [
            _point_at_hour(0, 8, 500.0),
            _point_at_hour(0, 12, 1200.0),
            _point_at_hour(0, 16, 800.0),
        ]
        payload = _payload(_metric("step_count", "count", pts))

        client.post(self.IMPORT_URL, json=payload, headers=auth_headers)
        client.post(self.IMPORT_URL, json=payload, headers=auth_headers)

        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "step_count").all()
        assert len(rows) == 1
        assert rows[0].qty == 2500.0  # not 5000.0

    def test_single_point_per_day_is_identity(
        self, client: TestClient, auth_headers: dict, db: Session
    ):
        """A single point per day takes the fast-path and passes through untouched."""
        resp = client.post(
            self.IMPORT_URL,
            json=_payload(_metric("step_count", "count", [_scalar_point(0, 5000.0)])),
            headers=auth_headers,
        )
        assert resp.status_code == 200

        rows = db.query(HealthMetric).filter(HealthMetric.metric_name == "step_count").all()
        assert len(rows) == 1
        assert rows[0].qty == 5000.0

# ---------------------------------------------------------------------------
# 6. Auth
# ---------------------------------------------------------------------------


class TestAuth:
    URL = "/api/v1/import/data"

    def test_post_without_auth_returns_401(self, client: TestClient):
        """Unauthenticated POST is rejected before any data is processed."""
        payload = _payload(_metric("step_count", "count", [_scalar_point(0, 5000)]))
        resp = client.post(self.URL, json=payload)
        assert resp.status_code == 401
