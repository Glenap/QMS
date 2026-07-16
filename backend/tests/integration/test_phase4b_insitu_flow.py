"""
Integration tests for Phase 4B — mismatch action items + the QE in-situ slump
gate on every delivery:

  supervisor admits a truck (→ PENDING_QE, provisional, not credited) → it waits
  in the QE inbox → the QE runs the in-situ slump-cone test and either accepts
  (slump must PASS → ACCEPTED + pour credited) or rejects (→ RMC notified). The
  supervisor can also flag a mismatch (action-required) into the inbox.
"""

from tests.helpers import API, approve_mix_design, bearer
from tests.integration.test_phase3_dispatch_flow import (
    _create_pour,
    _dispatch_refs,
    _fill_truck,
    _project_with_qe_and_supervisor,
    _raise_dispatch,
)


async def _dispatch_view(client, qe_token, pid, dispatch_id):
    return (
        await client.get(
            f"{API}/projects/{pid}/dispatches/{dispatch_id}", headers=bearer(qe_token)
        )
    ).json()


async def _arrive_and_admit(client, sup_token, pid, token):
    await client.post(
        f"{API}/projects/{pid}/gate/{token}/arrive", json={}, headers=bearer(sup_token)
    )
    return await client.post(
        f"{API}/projects/{pid}/gate/{token}/accept", headers=bearer(sup_token)
    )


async def _setup(client, db_session, *, ordered=30.0, delivered=30.0):
    contractor_token, qe_token, sup_token, pid = (
        await _project_with_qe_and_supervisor(client, db_session)
    )
    refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
    created = (
        await _raise_dispatch(client, qe_token, pid, refs, volume_ordered=ordered)
    ).json()
    did, token = created["dispatch_id"], created["truck"]["token"]
    await _fill_truck(client, token, volume_cum=delivered)
    return contractor_token, qe_token, sup_token, pid, refs, did, token


class TestProvisionalAcceptance:
    async def test_supervisor_accept_is_provisional(self, client, db_session):
        _, qe_token, sup_token, pid, refs, did, token = await _setup(client, db_session)
        admitted = await _arrive_and_admit(client, sup_token, pid, token)
        assert admitted.json()["truck"]["status"] == "PENDING_QE"

        # Shows in the QE inbox; nothing credited to the pour yet.
        inbox = (
            await client.get(f"{API}/projects/{pid}/qe-inbox", headers=bearer(qe_token))
        ).json()
        assert [i["dispatch_id"] for i in inbox] == [did]
        count = (
            await client.get(
                f"{API}/projects/{pid}/qe-inbox/count", headers=bearer(qe_token)
            )
        ).json()
        assert count["count"] == 1
        # Nothing is credited to the dispatch until the QE signs off.
        dispatch = await _dispatch_view(client, qe_token, pid, did)
        assert dispatch["volume_received_cum"] in (None, 0, 0.0)


class TestInsituGate:
    async def test_insitu_pass_accepts_and_credits(self, client, db_session):
        _, qe_token, sup_token, pid, refs, did, token = await _setup(client, db_session)
        await _arrive_and_admit(client, sup_token, pid, token)

        accepted = await client.post(
            f"{API}/projects/{pid}/dispatches/{did}/insitu",
            json={"measured_slump_mm": 100, "decision": "APPROVED"},
            headers=bearer(qe_token),
        )
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["truck"]["status"] == "ACCEPTED"
        assert accepted.json()["insitu"]["result"] == "PASS"

        # The delivery is credited on the dispatch, and a pour can now be recorded
        # from it with the delivered volume.
        dispatch = await _dispatch_view(client, qe_token, pid, did)
        assert dispatch["volume_received_cum"] == 30.0
        pour = (await _create_pour(client, qe_token, pid, did, refs)).json()
        assert pour["status"] == "COMPLETED"
        assert pour["volume_cum"] == 30.0

    async def test_insitu_reject_leaves_nothing_credited(self, client, db_session):
        _, qe_token, sup_token, pid, refs, did, token = await _setup(client, db_session)
        await _arrive_and_admit(client, sup_token, pid, token)

        rejected = await client.post(
            f"{API}/projects/{pid}/dispatches/{did}/insitu",
            json={
                "measured_slump_mm": 100,
                "decision": "REJECTED",
                "rejection_reason": "Honeycombing risk on site",
            },
            headers=bearer(qe_token),
        )
        assert rejected.json()["truck"]["status"] == "REJECTED"
        dispatch = await _dispatch_view(client, qe_token, pid, did)
        assert dispatch["volume_received_cum"] in (None, 0, 0.0)
        # A rejected delivery can't be turned into a pour.
        resp = await _create_pour(client, qe_token, pid, did, refs)
        assert resp.status_code == 400

    async def test_slump_fail_blocks_approval(self, client, db_session):
        contractor_token, qe_token, sup_token, pid, refs, did, token = await _setup(
            client, db_session
        )
        # Give the approved mix a slump range so the in-situ test has a target.
        await approve_mix_design(
            client,
            contractor_token=contractor_token,
            qe_token=qe_token,
            project_id=pid,
            supplier_id=refs["supplier_id"],
            grade_id=refs["grade_id"],
            slump_range_mm="100-150",
        )
        await _arrive_and_admit(client, sup_token, pid, token)

        # 200 mm is outside 100-150 → FAIL → APPROVE is blocked.
        blocked = await client.post(
            f"{API}/projects/{pid}/dispatches/{did}/insitu",
            json={"measured_slump_mm": 200, "decision": "APPROVED"},
            headers=bearer(qe_token),
        )
        assert blocked.status_code == 400, blocked.text

        rejected = await client.post(
            f"{API}/projects/{pid}/dispatches/{did}/insitu",
            json={
                "measured_slump_mm": 200,
                "decision": "REJECTED",
                "rejection_reason": "Slump out of range",
            },
            headers=bearer(qe_token),
        )
        assert rejected.json()["truck"]["status"] == "REJECTED"
        assert rejected.json()["insitu"]["result"] == "FAIL"


class TestActionRequired:
    async def test_supervisor_flags_mismatch_into_inbox(self, client, db_session):
        _, qe_token, sup_token, pid, refs, did, token = await _setup(client, db_session)
        await client.post(
            f"{API}/projects/{pid}/gate/{token}/arrive", json={}, headers=bearer(sup_token)
        )
        flagged = await client.post(
            f"{API}/projects/{pid}/gate/{token}/action-required",
            json={"reason": "SLUMP_MISMATCH", "message": "Slump looks high on arrival"},
            headers=bearer(sup_token),
        )
        assert flagged.status_code == 200, flagged.text
        assert flagged.json()["truck"]["status"] == "PENDING_QE"

        inbox = (
            await client.get(f"{API}/projects/{pid}/qe-inbox", headers=bearer(qe_token))
        ).json()
        item = next(i for i in inbox if i["dispatch_id"] == did)
        assert item["action_item"]["reason"] == "SLUMP_MISMATCH"
        assert item["action_item"]["message"] == "Slump looks high on arrival"


class TestInsituRbac:
    async def test_non_qe_cannot_use_inbox_or_insitu(self, client, db_session):
        _, qe_token, sup_token, pid, refs, did, token = await _setup(client, db_session)
        await _arrive_and_admit(client, sup_token, pid, token)

        # Supervisor isn't a QE.
        assert (
            await client.get(f"{API}/projects/{pid}/qe-inbox", headers=bearer(sup_token))
        ).status_code == 403
        resp = await client.post(
            f"{API}/projects/{pid}/dispatches/{did}/insitu",
            json={"measured_slump_mm": 100, "decision": "APPROVED"},
            headers=bearer(sup_token),
        )
        assert resp.status_code == 403

    async def test_non_supervisor_cannot_flag_action(self, client, db_session):
        _, qe_token, sup_token, pid, refs, did, token = await _setup(client, db_session)
        await client.post(
            f"{API}/projects/{pid}/gate/{token}/arrive", json={}, headers=bearer(sup_token)
        )
        resp = await client.post(
            f"{API}/projects/{pid}/gate/{token}/action-required",
            json={"reason": "OTHER", "message": "x"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 403
