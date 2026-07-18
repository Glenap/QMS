"""Integration tests for Phase 6 — the analytics metrics layer:

  An empty project reports zero KPIs; a pour + a passing test rolls up into the
  overview bundle; a failing test raises an NCR that the overview counts as open;
  the quality endpoint returns the grade trend + strength distribution; the
  supplier scorecard aggregates pours and pass rate per supplier.

All numbers come from AnalyticsService — these tests pin the metric maths and
the project scoping (any project viewer reads; no token → 401).
"""

from tests.helpers import API, bearer
from tests.integration.test_phase1_master_flow import _project_with_qe
from tests.integration.test_phase4_cube_flow import (
    _cast_sample,
    _qe_pour,
    _record_test,
)


async def _overview(client, token, pid):
    return await client.get(
        f"{API}/projects/{pid}/analytics/overview", headers=bearer(token)
    )


class TestOverviewKpis:
    async def test_empty_project_reports_zero(self, client, db_session):
        _, qe_token, pid = await _project_with_qe(client, db_session)
        body = (await _overview(client, qe_token, pid)).json()
        assert body["pour_count"] == 0
        assert body["pour_volume_cum"] == 0.0
        assert body["test_count"] == 0
        assert body["pass_rate_pct"] is None
        assert body["ncr_open"] == 0

    async def test_pour_and_passing_test_roll_up(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # M30, 28-day → required 30.0; observed 32.0 → PASS.
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=32.0)

        body = (await _overview(client, qe_token, pid)).json()
        assert body["pour_count"] == 1
        assert body["pour_volume_cum"] == 30.0
        assert body["test_count"] == 1
        assert body["pass_count"] == 1
        assert body["pass_rate_pct"] == 100.0
        assert body["avg_strength_mpa"] == 32.0
        assert body["ncr_open"] == 0

    async def test_failing_test_counts_as_open_ncr(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # observed 20.0 < 85% of 30 (25.5) → CRITICAL_FAILURE → auto-NCR.
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=20.0)

        body = (await _overview(client, qe_token, pid)).json()
        assert body["critical_count"] == 1
        assert body["fail_count"] == 0
        assert body["pass_rate_pct"] == 0.0
        assert body["ncr_open"] == 1

    async def test_pass_rate_uses_final_test_per_sample(self, client, db_session):
        # One cube, two tests: an interim 7-day FAIL then the 28-day acceptance
        # PASS. The acceptance basis counts only the final (28-day) result, so the
        # cube reads as a single PASS — the early-age FAIL doesn't sink the rate.
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # M30, 7-day → required 19.5; observed 17.0 (>= 85% of 19.5) → FAIL.
        await _record_test(
            client, db_session, qe_token, pid, sample_id,
            test_age_days=7, test_date="2026-07-22", observed_strength_mpa=17.0,
        )
        # M30, 28-day → required 30.0; observed 32.0 → PASS.
        await _record_test(
            client, db_session, qe_token, pid, sample_id,
            test_age_days=28, test_date="2026-08-12", observed_strength_mpa=32.0,
        )

        body = (await _overview(client, qe_token, pid)).json()
        assert body["test_count"] == 1
        assert body["pass_count"] == 1
        assert body["fail_count"] == 0
        assert body["pass_rate_pct"] == 100.0
        assert body["avg_strength_mpa"] == 32.0


class TestQualityAnalytics:
    async def test_grade_trend_and_distribution(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(
            client, db_session, qe_token, pid, sample_id,
            test_date="2026-08-12", observed_strength_mpa=32.0,
        )

        body = (
            await client.get(
                f"{API}/projects/{pid}/analytics/quality", headers=bearer(qe_token)
            )
        ).json()
        trend = body["grade_trend"]
        assert len(trend) == 1
        assert trend[0]["period"] == "2026-08"
        assert trend[0]["grade_name"] == "M30"
        assert trend[0]["pass_rate_pct"] == 100.0

        # Buckets are derived from the data's own range, not a fixed 35 MPa
        # floor (which put every M25/M30 result into one bar). A single 32.0 MPa
        # result therefore yields one bucket that contains it.
        dist = {b["label"]: b["count"] for b in body["strength_distribution"]}
        assert sum(dist.values()) == 1
        (label,) = dist
        lo, hi = (float(x) for x in label.split("-"))
        assert lo <= 32.0 <= hi

    async def test_quality_date_filter_excludes_out_of_range(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(client, db_session, qe_token, pid, sample_id, test_date="2026-08-12")

        body = (
            await client.get(
                f"{API}/projects/{pid}/analytics/quality?date_from=2026-09-01",
                headers=bearer(qe_token),
            )
        ).json()
        assert body["grade_trend"] == []
        assert body["strength_distribution"] == []


class TestSupplierScorecard:
    async def test_scorecard_aggregates_supplier(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=32.0)

        rows = (
            await client.get(
                f"{API}/projects/{pid}/analytics/suppliers", headers=bearer(qe_token)
            )
        ).json()
        assert len(rows) == 1
        score = rows[0]
        assert score["supplier_name"] == "UltraTech RMC"
        assert score["pour_count"] == 1
        assert score["pour_volume_cum"] == 30.0
        assert score["test_count"] == 1
        assert score["pass_rate_pct"] == 100.0

    async def test_scorecard_honours_date_filter(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=32.0)
        # A future date-from filters out the supplier's pours entirely.
        rows = (
            await client.get(
                f"{API}/projects/{pid}/analytics/suppliers?date_from=2099-01-01",
                headers=bearer(qe_token),
            )
        ).json()
        assert rows == []


class TestNcrsBySupplier:
    async def test_groups_open_and_critical_ncrs_by_supplier(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # observed 20.0 → CRITICAL_FAILURE → auto-NCR (open + critical).
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=20.0)

        rows = (
            await client.get(
                f"{API}/projects/{pid}/analytics/ncrs-by-supplier", headers=bearer(qe_token)
            )
        ).json()
        assert len(rows) == 1
        row = rows[0]
        assert row["supplier_name"] == "UltraTech RMC"
        assert row["total"] == 1
        assert row["open_count"] == 1
        assert row["closed_count"] == 0
        assert row["critical_count"] == 1

    async def test_ncrs_by_supplier_honours_grade_filter(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=20.0)
        # Filtering to a grade that never poured leaves no NCRs.
        rows = (
            await client.get(
                f"{API}/projects/{pid}/analytics/ncrs-by-supplier?grade_id=999999",
                headers=bearer(qe_token),
            )
        ).json()
        assert rows == []


class TestAnalyticsAccess:
    async def test_overview_requires_auth(self, client, db_session):
        _, qe_token, pid = await _project_with_qe(client, db_session)
        resp = await client.get(f"{API}/projects/{pid}/analytics/overview")
        assert resp.status_code == 403  # HTTPBearer rejects a missing token
