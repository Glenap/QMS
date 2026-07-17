"""Integration tests for the analytics t-test endpoints.

Exercises the one-sample (mean strength vs a reference) and two-sample (Welch,
compare two selections) tests over real cube-strength data. Cube tests are built
cheaply as several samples on a single pour — distinct ``test_date``s let the
two-sample test split the data into two time-window groups.
"""

from tests.helpers import API, bearer
from tests.integration.test_phase3_dispatch_flow import _accepted_delivery, _create_pour
from tests.integration.test_phase4_cube_flow import _cast_sample, _record_test


async def _pour_ctx(client, db_session):
    """(qe_token, pid, pour_id, refs) — a recorded M30 pour (fck = 30 MPa)."""
    _c, qe_token, _s, pid, refs, dispatch_id = await _accepted_delivery(client, db_session)
    pour = (await _create_pour(client, qe_token, pid, dispatch_id, refs)).json()
    return qe_token, pid, pour["pour_id"], refs


async def _strength(client, db_session, qe_token, pid, pour_id, ref, mpa, test_date):
    """Cast a sample and file its 28-day result at ``mpa`` on ``test_date``."""
    sid = (
        await _cast_sample(client, qe_token, pid, pour_id, sample_reference=ref)
    ).json()["sample_id"]
    resp = await _record_test(
        client, db_session, qe_token, pid, sid,
        observed_strength_mpa=mpa, test_date=test_date,
    )
    assert resp.status_code == 201, getattr(resp, "text", resp.json())


class TestOneSampleTTest:
    async def test_mean_significantly_above_fck(self, client, db_session):
        qe_token, pid, pour_id, refs = await _pour_ctx(client, db_session)
        for i, mpa in enumerate([34, 36, 35, 37, 33]):  # mean 35, fck 30
            await _strength(client, db_session, qe_token, pid, pour_id, f"CS-{i}", mpa, "2026-07-20")

        resp = await client.get(
            f"{API}/projects/{pid}/analytics/ttest/one-sample",
            params={"grade_id": refs["grade_id"], "basis": "fck", "alternative": "greater"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["sample_count"] == 5
        assert body["mu0"] == 30.0            # M30 characteristic strength
        assert body["mu0_basis"] == "fck"
        assert body["grade_name"] == "M30"
        assert body["mean"] == 35.0
        assert sorted(body["values"]) == [33.0, 34.0, 35.0, 36.0, 37.0]  # for plotting
        assert body["significant"] is True
        assert body["confidence"] == 0.95     # default
        assert "significantly above" in body["verdict"]

    async def test_custom_reference(self, client, db_session):
        qe_token, pid, pour_id, refs = await _pour_ctx(client, db_session)
        for i, mpa in enumerate([34, 36, 35]):
            await _strength(client, db_session, qe_token, pid, pour_id, f"CS-{i}", mpa, "2026-07-20")

        resp = await client.get(
            f"{API}/projects/{pid}/analytics/ttest/one-sample",
            params={"basis": "custom", "mu0": 50, "alternative": "less", "confidence": 0.99},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["mu0"] == 50.0
        assert body["mu0_basis"] == "custom"
        assert body["confidence"] == 0.99
        assert body["significant"] is True    # mean 35 clearly below 50
        assert "significantly below" in body["verdict"]

    async def test_fck_basis_requires_grade(self, client, db_session):
        qe_token, pid, pour_id, _refs = await _pour_ctx(client, db_session)
        await _strength(client, db_session, qe_token, pid, pour_id, "CS-0", 34, "2026-07-20")
        await _strength(client, db_session, qe_token, pid, pour_id, "CS-1", 35, "2026-07-20")

        resp = await client.get(
            f"{API}/projects/{pid}/analytics/ttest/one-sample",
            params={"basis": "fck"},  # no grade_id
            headers=bearer(qe_token),
        )
        assert resp.status_code == 400

    async def test_insufficient_data_is_400(self, client, db_session):
        qe_token, pid, pour_id, refs = await _pour_ctx(client, db_session)
        await _strength(client, db_session, qe_token, pid, pour_id, "CS-0", 34, "2026-07-20")

        resp = await client.get(
            f"{API}/projects/{pid}/analytics/ttest/one-sample",
            params={"grade_id": refs["grade_id"], "basis": "fck"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 400
        assert "at least 2" in resp.json()["detail"]

    async def test_confidence_out_of_range_is_422(self, client, db_session):
        qe_token, pid, _pour_id, refs = await _pour_ctx(client, db_session)
        resp = await client.get(
            f"{API}/projects/{pid}/analytics/ttest/one-sample",
            params={"grade_id": refs["grade_id"], "confidence": 1.5},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 422


class TestTwoSampleTTest:
    async def test_groups_differ_significantly(self, client, db_session):
        qe_token, pid, pour_id, _refs = await _pour_ctx(client, db_session)
        # Group A (July) clearly stronger than group B (August).
        for i, mpa in enumerate([40, 42, 44]):
            await _strength(client, db_session, qe_token, pid, pour_id, f"A-{i}", mpa, "2026-07-20")
        for i, mpa in enumerate([31, 32, 33]):
            await _strength(client, db_session, qe_token, pid, pour_id, f"B-{i}", mpa, "2026-08-20")

        resp = await client.post(
            f"{API}/projects/{pid}/analytics/ttest/two-sample",
            json={
                "group_a": {"date_from": "2026-07-01", "date_to": "2026-07-31", "label": "July"},
                "group_b": {"date_from": "2026-08-01", "date_to": "2026-08-31", "label": "August"},
                "alternative": "greater",
            },
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["group_a"]["label"] == "July"
        assert body["group_a"]["sample_count"] == 3
        assert sorted(body["group_a"]["values"]) == [40.0, 42.0, 44.0]
        assert body["group_b"]["sample_count"] == 3
        assert sorted(body["group_b"]["values"]) == [31.0, 32.0, 33.0]
        assert body["mean_diff"] == 10.0     # 42 − 32
        assert body["significant"] is True
        assert "significantly higher than" in body["verdict"]

    async def test_group_with_too_little_data_is_400(self, client, db_session):
        qe_token, pid, pour_id, _refs = await _pour_ctx(client, db_session)
        for i, mpa in enumerate([40, 42, 44]):
            await _strength(client, db_session, qe_token, pid, pour_id, f"A-{i}", mpa, "2026-07-20")

        resp = await client.post(
            f"{API}/projects/{pid}/analytics/ttest/two-sample",
            json={
                "group_a": {"date_from": "2026-07-01", "date_to": "2026-07-31", "label": "July"},
                "group_b": {"date_from": "2026-08-01", "date_to": "2026-08-31", "label": "August"},
            },
            headers=bearer(qe_token),
        )
        assert resp.status_code == 400
        assert "August" in resp.json()["detail"]
