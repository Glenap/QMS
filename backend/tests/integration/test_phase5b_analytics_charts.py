"""
Integration tests for Phase 5B — the four IS-456/10262 statistical charts:
run chart, normal distribution, target-mean bar, strength-vs-age. Each reuses
the analytics filter machinery and the quality engine's target-mean math.
"""

from tests.helpers import API, approve_mix_design, bearer
from tests.integration.test_phase4_cube_flow import _cast_sample, _qe_pour, _record_test


async def _pour_with_result(client, db_session, observed=34.0):
    _, qe_token, pid, pour_id = await _qe_pour(client, db_session)  # M30, 2026-07-15
    sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
    await _record_test(
        client, db_session, qe_token, pid, sample_id, observed_strength_mpa=observed
    )
    pour = (
        await client.get(f"{API}/projects/{pid}/pours/{pour_id}", headers=bearer(qe_token))
    ).json()
    return qe_token, pid, pour


class TestStatisticalCharts:
    async def test_run_chart_control_lines(self, client, db_session):
        qe_token, pid, pour = await _pour_with_result(client, db_session, observed=34.0)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/run-chart",
            params={"grade_id": pour["grade_id"]},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert [p["observed_mpa"] for p in body["points"]] == [34.0]
        assert body["fck"] == 30.0  # M30
        assert body["individual_min"] == 27.0  # fck − 3
        assert body["target_mean"] == 38.25  # fck + 1.65·σ (IS-10262 assumed σ=5)

    async def test_distribution_reports_fck_and_count(self, client, db_session):
        qe_token, pid, pour = await _pour_with_result(client, db_session, observed=34.0)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/distribution",
            params={"grade_id": pour["grade_id"]},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["sample_count"] == 1
        assert body["fck"] == 30.0
        # Target mean is surfaced (RMC design target, else IS-10262 fck+1.65σ) and
        # sits above fck.
        assert body["target_mean"] is not None and body["target_mean"] > 30.0

    async def test_graphical_summary_descriptive_report(self, client, db_session):
        # Two results on one M30 pour → the descriptive summary populates.
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        for obs in (30.0, 40.0):
            sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
            await _record_test(
                client, db_session, qe_token, pid, sample_id, observed_strength_mpa=obs
            )
        pour = (
            await client.get(f"{API}/projects/{pid}/pours/{pour_id}", headers=bearer(qe_token))
        ).json()
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/graphical-summary",
            params={"grade_id": pour["grade_id"]},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["sample_count"] == 2
        assert body["fck"] == 30.0
        assert body["grade_name"] == "M30"
        assert body["mean"] == 35.0
        assert body["minimum"] == 30.0 and body["maximum"] == 40.0
        assert body["ci_mean_low"] < 35.0 < body["ci_mean_high"]
        assert len(body["fit_curve"]) == 61
        assert len(body["prob_points"]) == 2
        assert sum(bar["count"] for bar in body["histogram"]) == 2

    async def test_outliers_flags_a_fabricated_spike(self, client, db_session):
        # Four identical results + one far-off value → the odd one is flagged.
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        for obs in (30.0, 30.0, 30.0, 30.0, 60.0):
            sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
            await _record_test(
                client, db_session, qe_token, pid, sample_id, observed_strength_mpa=obs
            )
        pour = (
            await client.get(f"{API}/projects/{pid}/pours/{pour_id}", headers=bearer(qe_token))
        ).json()
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/outliers",
            params={"grade_id": pour["grade_id"]},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["sample_count"] == 5
        assert body["outlier_count"] == 1
        assert body["outliers"] == [60.0]
        assert body["clean_std_dev"] < body["std_dev"]
        assert len(body["points"]) == 5
        assert [p for p in body["points"] if p["is_outlier"]][0]["value"] == 60.0

    async def test_graphical_summary_empty_when_no_results(self, client, db_session):
        # No cube results yet → 200 with an empty summary (stats are None).
        _, qe_token, pid, _pour_id = await _qe_pour(client, db_session)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/graphical-summary", headers=bearer(qe_token)
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["sample_count"] == 0
        assert body["mean"] is None
        assert body["fit_curve"] == []

    async def test_target_mean_bar(self, client, db_session):
        qe_token, pid, _pour = await _pour_with_result(client, db_session, observed=34.0)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/target-mean", headers=bearer(qe_token)
        )
        assert resp.status_code == 200, resp.text
        m30 = next(r for r in resp.json()["rows"] if r["grade_name"] == "M30")
        assert m30["fck"] == 30.0
        assert m30["target_mean"] == 38.25
        assert m30["actual_mean"] == 34.0

    async def test_strength_vs_age(self, client, db_session):
        qe_token, pid, pour = await _pour_with_result(client, db_session, observed=34.0)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/strength-vs-age",
            params={"tower_id": pour["tower_id"]},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        points = resp.json()["points"]
        assert any(p["test_age_days"] == 28 for p in points)
        assert points[0]["observed_mpa"] == 34.0

    async def test_target_mean_uses_rmc_design_value(self, client, db_session):
        contractor_token, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=34.0)
        pour = (
            await client.get(f"{API}/projects/{pid}/pours/{pour_id}", headers=bearer(qe_token))
        ).json()
        # The RMC states a design target mean of 40 MPa → the chart uses it, not fck+1.65σ.
        await approve_mix_design(
            client,
            contractor_token=contractor_token,
            qe_token=qe_token,
            project_id=pid,
            supplier_id=pour["supplier_horizontal_id"],
            grade_id=pour["grade_id"],
            target_mean_strength_mpa=40.0,
        )
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/target-mean", headers=bearer(qe_token)
        )
        m30 = next(r for r in resp.json()["rows"] if r["grade_name"] == "M30")
        assert m30["target_mean"] == 40.0

    async def test_strength_vs_age_pins_one_batch(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample = (
            await _cast_sample(client, qe_token, pid, pour_id, sample_reference="CUBE011")
        ).json()
        await _record_test(
            client, db_session, qe_token, pid, sample["sample_id"], observed_strength_mpa=34.0
        )
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/strength-vs-age",
            params={"sample_id": sample["sample_id"]},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["reference"] == "CUBE011"
        assert resp.json()["points"][0]["observed_mpa"] == 34.0

    async def test_run_chart_points_carry_cube_reference(self, client, db_session):
        # Each run-chart point is identified by its cube number (sample_reference)
        # + sample_id, so the UI can label it and deep-link to traceability.
        qe_token, pid, pour = await _pour_with_result(client, db_session, observed=34.0)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/run-chart",
            params={"grade_id": pour["grade_id"]},
            headers=bearer(qe_token),
        )
        pt = resp.json()["points"][0]
        assert pt["sample_reference"] == "CS-001"
        assert isinstance(pt["sample_id"], int)


class TestCusumChart:
    async def test_cusum_running_sum_by_cube(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        grade_id = (
            await client.get(f"{API}/projects/{pid}/pours/{pour_id}", headers=bearer(qe_token))
        ).json()["grade_id"]
        # M30 target mean (IS-10262 assumed σ=5) = 38.25.
        for i, mpa in enumerate([40, 38, 36]):
            sid = (
                await _cast_sample(client, qe_token, pid, pour_id, sample_reference=f"CUBE-{i}")
            ).json()["sample_id"]
            await _record_test(
                client, db_session, qe_token, pid, sid,
                observed_strength_mpa=mpa, test_date=f"2026-07-2{i}",
            )
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/cusum",
            params={"grade_id": grade_id},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["grade_name"] == "M30"
        assert body["target_mean"] == 38.25
        pts = body["points"]
        assert [p["index"] for p in pts] == [1, 2, 3]
        assert [p["observed_mpa"] for p in pts] == [40.0, 38.0, 36.0]
        # deviations +1.75, −0.25, −2.25 → running 1.75, 1.5, −0.75
        assert [p["cusum"] for p in pts] == [1.75, 1.5, -0.75]
        assert pts[0]["sample_reference"] == "CUBE-0"

    async def test_cusum_without_grade_is_empty(self, client, db_session):
        qe_token, pid, _pour = await _pour_with_result(client, db_session, observed=34.0)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/cusum", headers=bearer(qe_token)
        )
        assert resp.status_code == 200
        assert resp.json()["points"] == []
        assert resp.json()["target_mean"] is None
