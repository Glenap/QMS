"""
Integration tests for Phase 3 — RMC dispatch + gate scan (truck token flow):

  QE raises a dispatch → supplier fills the truck via a public token link →
  the site Supervisor scans it in at the gate and accepts / rejects it.

Plus RBAC (QE raises, Supervisor gates), the truck state machine, and volume
accounting on accept.
"""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests.helpers import API, accept_and_verify, bearer
from tests.integration.test_phase2_pour_flow import _project_with_qe


async def _project_with_qe_and_supervisor(client, db_session):
    """(contractor_token, qe_token, supervisor_token, project_id)."""
    contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
    sup_email = "supervisor@example.com"
    await client.post(
        f"{API}/projects/{project_id}/members",
        json={"email": sup_email, "project_role": "SUPERVISOR"},
        headers=bearer(contractor_token),
    )
    inv = (
        await db_session.execute(
            select(OrgInvitation).where(OrgInvitation.invited_email == sup_email)
        )
    ).scalar_one()
    sup_token, _ = await accept_and_verify(
        client, token=inv.token, email=sup_email, full_name="Sam Supervisor"
    )
    return contractor_token, qe_token, sup_token, project_id


async def _dispatch_refs(client, contractor_token, qe_token, project_id) -> dict:
    """Create a pour + an emailed supplier the dispatch can reference."""
    tower_id = (
        await client.get(f"{API}/projects/{project_id}/towers", headers=bearer(qe_token))
    ).json()[0]["tower_id"]
    floors = (
        await client.post(
            f"{API}/projects/{project_id}/towers/{tower_id}/floors/generate",
            json={"count": 1},
            headers=bearer(contractor_token),
        )
    ).json()
    components = (await client.get(f"{API}/components", headers=bearer(qe_token))).json()
    grades = (await client.get(f"{API}/grades", headers=bearer(qe_token))).json()
    m30 = next(g for g in grades if g["grade_name"] == "M30")
    supplier = (
        await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={
                "supplier_name": "UltraTech RMC",
                "contact_email": "plant@ultratech.example",
            },
            headers=bearer(contractor_token),
        )
    ).json()
    pour = (
        await client.post(
            f"{API}/projects/{project_id}/pours",
            json={
                "tower_id": tower_id,
                "floor_id": floors[0]["floor_id"],
                "component_id": components[0]["component_id"],
                "grade_id": m30["grade_id"],
                "supplier_horizontal_id": supplier["supplier_id"],
                "pour_date": "2026-07-15",
                "volume_cum": 30.0,
            },
            headers=bearer(qe_token),
        )
    ).json()
    return {
        "pour_id": pour["pour_id"],
        "supplier_id": supplier["supplier_id"],
        "grade_id": m30["grade_id"],
    }


async def _raise_dispatch(client, qe_token, project_id, refs, volume_ordered=30.0):
    return await client.post(
        f"{API}/projects/{project_id}/dispatches",
        json={
            "pour_id": refs["pour_id"],
            "supplier_id": refs["supplier_id"],
            "grade_id": refs["grade_id"],
            "volume_ordered_cum": volume_ordered,
        },
        headers=bearer(qe_token),
    )


async def _fill_truck(client, token, **overrides):
    payload = {"vehicle_number": "KA01AB1234", "volume_cum": 6.0, "slump_at_plant_mm": 120}
    payload.update(overrides)
    return await client.post(f"{API}/external/dispatch?token={token}", json=payload)


class TestDispatchCreation:
    async def test_qe_raises_dispatch_with_truck_token(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)

        resp = await _raise_dispatch(client, qe_token, pid, refs)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["supplier_name"] == "UltraTech RMC"
        assert body["grade_name"] == "M30"
        assert body["volume_remaining_cum"] == 30.0
        assert body["is_complete"] is False
        assert body["truck"]["status"] == "PENDING"
        assert body["truck"]["token"]

    async def test_non_qe_cannot_raise_dispatch(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        resp = await _raise_dispatch(client, contractor_token, pid, refs)
        assert resp.status_code == 403

    async def test_dispatch_requires_supplier_with_email(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        # A second supplier with no contact email can't be dispatched to.
        no_email = (
            await client.post(
                f"{API}/projects/{pid}/suppliers",
                json={"supplier_name": "ACC Plant"},
                headers=bearer(contractor_token),
            )
        ).json()
        resp = await _raise_dispatch(
            client, qe_token, pid, {**refs, "supplier_id": no_email["supplier_id"]}
        )
        assert resp.status_code == 403


class TestTruckFill:
    async def test_supplier_views_and_fills_truck(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        token = (await _raise_dispatch(client, qe_token, pid, refs)).json()["truck"]["token"]

        # Public — no auth header.
        view = await client.get(f"{API}/external/dispatch?token={token}")
        assert view.status_code == 200, view.text
        assert view.json()["is_editable"] is True
        assert view.json()["grade_name"] == "M30"
        assert view.json()["volume_ordered_cum"] == 30.0

        filled = await _fill_truck(client, token)
        assert filled.status_code == 200, filled.text
        assert filled.json()["status"] == "FILLED"

    async def test_filling_twice_is_rejected(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        token = (await _raise_dispatch(client, qe_token, pid, refs)).json()["truck"]["token"]
        await _fill_truck(client, token)
        again = await _fill_truck(client, token)
        assert again.status_code == 400

    async def test_unknown_token_is_404(self, client, db_session):
        await _project_with_qe_and_supervisor(client, db_session)
        resp = await client.get(f"{API}/external/dispatch?token=does-not-exist")
        assert resp.status_code == 404


class TestGate:
    async def test_full_accept_flow_accounts_volume(self, client, db_session):
        contractor_token, qe_token, sup_token, pid = (
            await _project_with_qe_and_supervisor(client, db_session)
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        created = (await _raise_dispatch(client, qe_token, pid, refs)).json()
        dispatch_id, token = created["dispatch_id"], created["truck"]["token"]
        await _fill_truck(client, token, volume_cum=6.0)

        scan = await client.get(
            f"{API}/projects/{pid}/gate/{token}", headers=bearer(sup_token)
        )
        assert scan.status_code == 200, scan.text
        assert scan.json()["truck"]["status"] == "FILLED"

        arrived = await client.post(
            f"{API}/projects/{pid}/gate/{token}/arrive",
            json={"slump_at_site_mm": 110},
            headers=bearer(sup_token),
        )
        assert arrived.json()["truck"]["status"] == "ARRIVED"

        accepted = await client.post(
            f"{API}/projects/{pid}/gate/{token}/accept", headers=bearer(sup_token)
        )
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["truck"]["status"] == "ACCEPTED"
        assert accepted.json()["truck"]["accepted_at"] is not None

        # Volume accounting lands on the dispatch.
        dispatch = (
            await client.get(
                f"{API}/projects/{pid}/dispatches/{dispatch_id}",
                headers=bearer(qe_token),
            )
        ).json()
        assert dispatch["volume_received_cum"] == 6.0
        assert dispatch["volume_remaining_cum"] == 24.0
        assert dispatch["is_complete"] is False
        assert dispatch["slump_at_site_mm"] == 110.0

    async def test_accept_before_arrive_is_rejected(self, client, db_session):
        contractor_token, qe_token, sup_token, pid = (
            await _project_with_qe_and_supervisor(client, db_session)
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        token = (await _raise_dispatch(client, qe_token, pid, refs)).json()["truck"]["token"]
        await _fill_truck(client, token)
        # Truck is FILLED but never scanned in — accept must fail.
        resp = await client.post(
            f"{API}/projects/{pid}/gate/{token}/accept", headers=bearer(sup_token)
        )
        assert resp.status_code == 400

    async def test_reject_marks_truck_and_needs_reason(self, client, db_session):
        contractor_token, qe_token, sup_token, pid = (
            await _project_with_qe_and_supervisor(client, db_session)
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        token = (await _raise_dispatch(client, qe_token, pid, refs)).json()["truck"]["token"]
        await _fill_truck(client, token)

        # Missing reason → 422 validation error.
        bad = await client.post(
            f"{API}/projects/{pid}/gate/{token}/reject",
            json={},
            headers=bearer(sup_token),
        )
        assert bad.status_code == 422

        rejected = await client.post(
            f"{API}/projects/{pid}/gate/{token}/reject",
            json={"rejection_reason": "Slump out of range on arrival"},
            headers=bearer(sup_token),
        )
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["truck"]["status"] == "REJECTED"
        assert rejected.json()["truck"]["rejection_reason"] == "Slump out of range on arrival"

    async def test_non_supervisor_cannot_work_gate(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        token = (await _raise_dispatch(client, qe_token, pid, refs)).json()["truck"]["token"]
        # The QE may raise dispatches but not work the gate.
        resp = await client.get(
            f"{API}/projects/{pid}/gate/{token}", headers=bearer(qe_token)
        )
        assert resp.status_code == 403
