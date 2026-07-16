"""
Integration tests for Phase 2 — recording a pour from a delivery:

  A pour is recorded by the QE from an **accepted** truck delivery. Grade,
  supplier and volume come from the delivery; the QE supplies the placement
  location (tower→floor→component). One delivery yields exactly one pour.

Plus RBAC (only QE), the accepted-delivery precondition, and tower scope.
"""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests.helpers import (
    API,
    accept_and_verify,
    assign_member,
    bearer,
    onboard_member,
)
from tests.integration.test_phase1_master_flow import (
    _client_with_project,
    _project_with_qe,
)
from tests.integration.test_phase3_dispatch_flow import (
    _accepted_delivery,
    _create_pour,
    _deliver,
    _dispatch_refs,
    _project_with_qe_and_supervisor,
    _raise_dispatch,
)


class TestPourLifecycle:
    async def test_qe_records_pour_from_delivery(self, client, db_session):
        _, qe_token, _, pid, refs, dispatch_id = await _accepted_delivery(
            client, db_session
        )
        resp = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        # The pour is complete on record; its volume is the delivered volume.
        assert body["status"] == "COMPLETED"
        assert body["volume_cum"] == 30.0
        assert body["dispatch_id"] == dispatch_id
        assert body["grade_name"] == "M30"
        assert body["supplier_name"] == "UltraTech RMC"
        assert body["tower_name"]
        assert body["floor_label"]

    async def test_pour_appears_in_list(self, client, db_session):
        _, qe_token, _, pid, refs, dispatch_id = await _accepted_delivery(
            client, db_session
        )
        pour_id = (
            await _create_pour(client, qe_token, pid, dispatch_id, refs)
        ).json()["pour_id"]
        listed = await client.get(
            f"{API}/projects/{pid}/pours", headers=bearer(qe_token)
        )
        assert [p["pour_id"] for p in listed.json()] == [pour_id]

    async def test_pour_requires_an_accepted_delivery(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        # A dispatch that's been raised but not yet delivered/accepted.
        dispatch_id = (
            await _raise_dispatch(client, qe_token, pid, refs)
        ).json()["dispatch_id"]
        resp = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert resp.status_code == 400, resp.text

    async def test_one_pour_per_delivery(self, client, db_session):
        _, qe_token, _, pid, refs, dispatch_id = await _accepted_delivery(
            client, db_session
        )
        first = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert first.status_code == 201, first.text
        again = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert again.status_code == 409

    async def test_non_qe_cannot_record_pour(self, client, db_session):
        contractor_token, qe_token, _, pid, refs, dispatch_id = (
            await _accepted_delivery(client, db_session)
        )
        # The contractor admin (not a QE) may not record a pour card.
        resp = await _create_pour(client, contractor_token, pid, dispatch_id, refs)
        assert resp.status_code == 403

    async def test_unknown_dispatch_is_404(self, client, db_session):
        _, qe_token, _, pid, refs, _ = await _accepted_delivery(client, db_session)
        resp = await _create_pour(client, qe_token, pid, 999999, refs)
        assert resp.status_code == 404

    async def test_floor_must_belong_to_tower(self, client, db_session):
        _, qe_token, _, pid, refs, dispatch_id = await _accepted_delivery(
            client, db_session
        )
        resp = await _create_pour(
            client, qe_token, pid, dispatch_id, refs, floor_id=999999
        )
        assert resp.status_code == 404

    async def test_approved_grades_endpoint_lists_only_approved(self, client, db_session):
        contractor_token, qe_token, pid = await _project_with_qe(client, db_session)
        await _dispatch_refs(client, contractor_token, qe_token, pid)
        rows = (
            await client.get(
                f"{API}/projects/{pid}/mix-designs/approved-grades",
                headers=bearer(qe_token),
            )
        ).json()
        assert [g["grade_name"] for g in rows] == ["M30"]


class TestPourTowerScope:
    """A contractor scoped to specific towers can only record pours on those
    towers (checked when the pour is recorded, against the pour's tower)."""

    async def _scoped_setup(self, client, db_session):
        """Contractor allotted only towers[0] + QE + supervisor; returns tokens,
        project + (allowed, other) towers."""
        client_token, project_id = await _client_with_project(client)
        towers = (
            await client.get(
                f"{API}/projects/{project_id}/towers", headers=bearer(client_token)
            )
        ).json()
        allowed, other = towers[0], towers[1]

        contractor_email = "contractor.admin@example.com"
        await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={
                "org_name": "L&T Construction",
                "contact_email": contractor_email,
                "tower_ids": [allowed["tower_id"]],
            },
            headers=bearer(client_token),
        )
        inv = (
            await db_session.execute(
                select(OrgInvitation).where(OrgInvitation.invited_email == contractor_email)
            )
        ).scalar_one()
        contractor_token, _ = await accept_and_verify(
            client, token=inv.token, email=contractor_email, full_name="Ravi Contractor"
        )
        assigned = await client.get(f"{API}/projects/assigned", headers=bearer(contractor_token))
        await client.post(
            f"{API}/projects/assigned/{assigned.json()[0]['pc_id']}/accept",
            headers=bearer(contractor_token),
        )

        qe_token = await onboard_member(
            client, db_session, admin_token=contractor_token,
            email="qe@example.com", full_name="Quala Engineer",
        )
        await assign_member(
            client, admin_token=contractor_token, project_id=project_id,
            email="qe@example.com", project_role="QUALITY_ENGINEER",
        )
        sup_token = await onboard_member(
            client, db_session, admin_token=contractor_token,
            email="supervisor@example.com", full_name="Sam Supervisor",
        )
        await assign_member(
            client, admin_token=contractor_token, project_id=project_id,
            email="supervisor@example.com", project_role="SUPERVISOR",
        )
        return contractor_token, qe_token, sup_token, project_id, allowed, other

    async def _delivery_on_tower(
        self, client, contractor_token, qe_token, sup_token, pid, tower_id
    ):
        refs = await _dispatch_refs(
            client, contractor_token, qe_token, pid, tower_id=tower_id
        )
        dispatch_id = await _deliver(
            client, qe_token, sup_token, pid, refs, ordered=30.0, delivered=30.0
        )
        return dispatch_id, refs

    async def test_pour_on_allotted_tower_succeeds(self, client, db_session):
        contractor_token, qe_token, sup_token, pid, allowed, _ = (
            await self._scoped_setup(client, db_session)
        )
        dispatch_id, refs = await self._delivery_on_tower(
            client, contractor_token, qe_token, sup_token, pid, allowed["tower_id"]
        )
        resp = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert resp.status_code == 201, resp.text

    async def test_pour_on_other_tower_rejected(self, client, db_session):
        contractor_token, qe_token, sup_token, pid, _, other = (
            await self._scoped_setup(client, db_session)
        )
        dispatch_id, refs = await self._delivery_on_tower(
            client, contractor_token, qe_token, sup_token, pid, other["tower_id"]
        )
        resp = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert resp.status_code == 403, resp.text
