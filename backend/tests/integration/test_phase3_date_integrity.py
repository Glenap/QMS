"""
Integration tests for the Phase 3 date/time-integrity rules: impossible
timelines are rejected with HTTP 400 (DateIntegrityError) across the entities
that carry dates — project, mix design, pour, cube sample, and the lab flow.

The fixture project carries start_date 2026-07-01 / end_date 2028-12-31 (see
``sample_project_payload``), and the standard pour/cast dates are 2026-07-15, so
these tests poke just outside those bounds. Valid same-day/in-window dates are
covered by the existing phase-2/3/4 suites.
"""

import json

from tests.helpers import (
    API,
    DEMO_PDF,
    bearer,
    register_and_token,
    sample_project_payload,
)
from tests.integration.test_phase1_master_flow import _project_with_qe
from tests.integration.test_phase3_dispatch_flow import (
    _accepted_delivery,
    _create_pour,
    _dispatch_refs,
)
from tests.integration.test_phase4_cube_flow import (
    _PDF,
    _cast_sample,
    _qe_pour,
    _report_token,
)


async def _start(client, token, **fields):
    return await client.post(
        f"{API}/external/lab-report/start?token={token}", json=fields
    )


class TestProjectDateIntegrity:
    async def test_end_before_start_is_rejected(self, client):
        token, _ = await register_and_token(client)
        payload = sample_project_payload(start_date="2026-07-01", end_date="2026-06-01")
        resp = await client.post(f"{API}/projects", json=payload, headers=bearer(token))
        assert resp.status_code == 400, resp.text
        assert "project end date" in resp.json()["detail"].lower()


class TestPourDateIntegrity:
    async def test_pour_before_project_start_is_rejected(self, client, db_session):
        _, qe_token, _, pid, refs, dispatch_id = await _accepted_delivery(
            client, db_session
        )
        resp = await _create_pour(
            client, qe_token, pid, dispatch_id, refs, pour_date="2026-06-15"
        )
        assert resp.status_code == 400, resp.text
        assert "project start date" in resp.json()["detail"].lower()

    async def test_pour_after_project_end_is_rejected(self, client, db_session):
        _, qe_token, _, pid, refs, dispatch_id = await _accepted_delivery(
            client, db_session
        )
        resp = await _create_pour(
            client, qe_token, pid, dispatch_id, refs, pour_date="2029-01-15"
        )
        assert resp.status_code == 400, resp.text
        assert "project end date" in resp.json()["detail"].lower()


class TestMixDesignDateIntegrity:
    async def test_trial_mix_before_project_start_is_rejected(self, client, db_session):
        contractor_token, qe_token, pid = await _project_with_qe(client, db_session)
        # _dispatch_refs already requests M30 from the supplier + mints its mix link.
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        suppliers = (
            await client.get(f"{API}/projects/{pid}/suppliers", headers=bearer(contractor_token))
        ).json()
        token = next(
            s["mix_submission_token"]
            for s in suppliers
            if s["supplier_id"] == refs["supplier_id"]
        )
        # project start is 2026-07-01 — a trial mix before that is impossible.
        resp = await client.post(
            f"{API}/external/mix-design?token={token}",
            data={"payload": json.dumps({"grade_id": refs["grade_id"], "trial_mix_date": "2026-06-01"})},
            files={"file": DEMO_PDF[1]},
        )
        assert resp.status_code == 400, resp.text
        assert "trial mix date" in resp.json()["detail"].lower()


class TestCastDateIntegrity:
    async def test_cast_before_pour_is_rejected(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)  # pour 2026-07-15
        resp = await _cast_sample(client, qe_token, pid, pour_id, cast_date="2026-07-01")
        assert resp.status_code == 400, resp.text
        assert "cast date" in resp.json()["detail"].lower()

    async def test_lab_dispatch_before_cast_is_rejected(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        resp = await _cast_sample(
            client, qe_token, pid, pour_id,
            cast_date="2026-07-15", lab_dispatch_date="2026-07-10",
        )
        assert resp.status_code == 400, resp.text
        assert "lab dispatch date" in resp.json()["detail"].lower()


class TestLabTimestampIntegrity:
    async def _sample_token(self, client, db_session, qe_token, pid, pour_id):
        sample = (await _cast_sample(client, qe_token, pid, pour_id)).json()  # cast 2026-07-15
        return await _report_token(db_session, sample["sample_id"])

    async def test_testing_started_before_cast_is_rejected(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        token = await self._sample_token(client, db_session, qe_token, pid, pour_id)
        resp = await _start(client, token, testing_started_on="2026-07-10")
        assert resp.status_code == 400, resp.text
        assert "testing start date" in resp.json()["detail"].lower()

    async def test_received_after_testing_started_is_rejected(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        token = await self._sample_token(client, db_session, qe_token, pid, pour_id)
        resp = await _start(
            client, token, testing_started_on="2026-07-16", cube_received_on="2026-07-20"
        )
        assert resp.status_code == 400, resp.text
        assert "received" in resp.json()["detail"].lower()

    async def test_valid_chain_records_received_date(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        token = await self._sample_token(client, db_session, qe_token, pid, pour_id)
        resp = await _start(
            client, token, testing_started_on="2026-07-18", cube_received_on="2026-07-16"
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["cube_received_on"] == "2026-07-16"

    async def test_test_date_before_testing_started_is_rejected(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        token = await self._sample_token(client, db_session, qe_token, pid, pour_id)
        await _start(client, token, testing_started_on="2026-07-15")
        resp = await client.post(
            f"{API}/external/lab-report?token={token}",
            files=_PDF,
            data={
                "test_age_days": "7",
                "observed_strength_mpa": "20",
                "test_date": "2026-07-10",
            },
        )
        assert resp.status_code == 400, resp.text
        assert "test date" in resp.json()["detail"].lower()
