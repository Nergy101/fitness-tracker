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
# 6. Auth
# ---------------------------------------------------------------------------


class TestAuth:
    URL = "/api/v1/import/data"

    def test_post_without_auth_returns_401(self, client: TestClient):
        """Unauthenticated POST is rejected before any data is processed."""
        payload = _payload(_metric("step_count", "count", [_scalar_point(0, 5000)]))
        resp = client.post(self.URL, json=payload)
        assert resp.status_code == 401
