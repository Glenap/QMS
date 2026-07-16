"""Integration tests for Phase 6 — traceability (lineage lookup):

  Find a cube sample by any reference it carries (its own ref, its pour's ref, or
  the NCR number a failing test produced), then walk the sample's full chain —
  pour + location + grade + supplier, and its tests with the NCR they raised.

Pins the search entry points, the worst-result roll-up on a record, the chain
walk, project scoping (unknown / other-project sample → 404), and auth.
"""

from tests.helpers import API, bearer
from tests.integration.test_phase1_master_flow import _project_with_qe
from tests.integration.test_phase4_cube_flow import (
    _cast_sample,
    _qe_pour,
    _record_test,
)


async def _search(client, token, pid, q):
    return await client.get(
        f"{API}/projects/{pid}/trace/search", params={"q": q}, headers=bearer(token)
    )


class TestTraceSearch:
    async def test_search_by_sample_reference(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        await _cast_sample(client, qe_token, pid, pour_id, sample_reference="CS-XYZ")

        rows = (await _search(client, qe_token, pid, "CS-XYZ")).json()
        assert len(rows) == 1
        rec = rows[0]
        assert rec["sample_reference"] == "CS-XYZ"
        assert rec["grade_name"] == "M30"
        assert rec["supplier_name"] == "UltraTech RMC"
        assert rec["tower_name"]

    async def test_search_by_pour_reference(self, client, db_session):
        # _qe_pour creates the pour with pour_reference "PC-001".
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        await _cast_sample(client, qe_token, pid, pour_id)

        rows = (await _search(client, qe_token, pid, "PC-001")).json()
        assert len(rows) == 1
        assert rows[0]["pour_reference"] == "PC-001"

    async def test_empty_query_returns_recent(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        await _cast_sample(client, qe_token, pid, pour_id)

        rows = (await _search(client, qe_token, pid, "")).json()
        assert len(rows) == 1

    async def test_search_by_ncr_number_with_worst_status(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # 7-day PASS then 28-day CRITICAL on the same sample → worst-wins is CRITICAL,
        # and the 28-day acceptance failure carries the auto-raised NCR.
        await _record_test(
            client, db_session, qe_token, pid, sample_id,
            test_age_days=7, observed_strength_mpa=32.0,
        )
        ncr_number = (
            await _record_test(
                client, db_session, qe_token, pid, sample_id,
                test_age_days=28, observed_strength_mpa=20.0,
            )
        ).json()["ncr_number"]
        assert ncr_number

        rows = (await _search(client, qe_token, pid, ncr_number)).json()
        assert len(rows) == 1
        assert rows[0]["ncr_number"] == ncr_number
        assert rows[0]["result_status"] == "CRITICAL_FAILURE"

    async def test_search_no_match_is_empty(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        await _cast_sample(client, qe_token, pid, pour_id)

        rows = (await _search(client, qe_token, pid, "ZZZ-nope")).json()
        assert rows == []


class TestTraceDetail:
    async def test_detail_walks_chain(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (
            await _cast_sample(client, qe_token, pid, pour_id, sample_reference="CS-1")
        ).json()["sample_id"]
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=20.0)

        detail = (
            await client.get(
                f"{API}/projects/{pid}/trace/{sample_id}", headers=bearer(qe_token)
            )
        ).json()
        assert detail["sample_reference"] == "CS-1"
        assert detail["pour_reference"] == "PC-001"
        assert detail["grade_name"] == "M30"
        assert detail["tower_name"]
        assert len(detail["tests"]) == 1
        test = detail["tests"][0]
        assert test["result_status"] == "CRITICAL_FAILURE"
        assert test["ncr_number"]

    async def test_detail_unknown_sample_is_404(self, client, db_session):
        _, qe_token, pid, _ = await _qe_pour(client, db_session)
        resp = await client.get(
            f"{API}/projects/{pid}/trace/999999", headers=bearer(qe_token)
        )
        assert resp.status_code == 404


class TestTraceAccess:
    async def test_search_requires_auth(self, client, db_session):
        _, qe_token, pid = await _project_with_qe(client, db_session)
        resp = await client.get(f"{API}/projects/{pid}/trace/search?q=x")
        assert resp.status_code == 403
