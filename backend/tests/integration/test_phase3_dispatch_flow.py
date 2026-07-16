"""
Integration tests for Phase 3 — RMC dispatch + gate scan (truck token flow):

  QE raises a dispatch (grade + supplier + volume, no pour yet) → supplier fills
  the truck via a public token link → the site Supervisor scans it in at the gate
  and admits it (provisional) → the QE signs off the in-situ slump test.

Plus RBAC (QE raises, Supervisor gates), the truck state machine, dispatch-level
volume accounting, and the 90-minute placement window. The pour is recorded from
the accepted delivery afterwards (see Phase 2).
"""

from datetime import UTC, datetime, timedelta

from app.models.transaction import RMCDispatch
from tests.helpers import (
    API,
    approve_mix_design,
    assign_member,
    bearer,
    onboard_member,
)
from tests.integration.test_phase1_master_flow import _project_with_qe


async def _project_with_qe_and_supervisor(client, db_session):
    """(contractor_token, qe_token, supervisor_token, project_id)."""
    contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
    sup_token = await onboard_member(
        client, db_session, admin_token=contractor_token,
        email="supervisor@example.com", full_name="Sam Supervisor",
    )
    await assign_member(
        client, admin_token=contractor_token, project_id=project_id,
        email="supervisor@example.com", project_role="SUPERVISOR",
    )
    return contractor_token, qe_token, sup_token, project_id


async def _dispatch_refs(
    client, contractor_token, qe_token, project_id, tower_id=None
) -> dict:
    """Master data a dispatch + its later pour reference: an emailed supplier with
    an APPROVED M30 mix, plus a location (tower/floor/component) for the pour."""
    if tower_id is None:
        tower_id = (
            await client.get(
                f"{API}/projects/{project_id}/towers", headers=bearer(qe_token)
            )
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
    # A dispatch may only be raised for a grade with an APPROVED mix design —
    # drive the RMC-owned flow (request grade → RMC submits → QE approves).
    await approve_mix_design(
        client,
        contractor_token=contractor_token,
        qe_token=qe_token,
        project_id=project_id,
        supplier_id=supplier["supplier_id"],
        grade_id=m30["grade_id"],
    )
    return {
        "supplier_id": supplier["supplier_id"],
        "grade_id": m30["grade_id"],
        "tower_id": tower_id,
        "floor_id": floors[0]["floor_id"],
        "component_id": components[0]["component_id"],
    }


async def _raise_dispatch(client, qe_token, project_id, refs, volume_ordered=30.0):
    return await client.post(
        f"{API}/projects/{project_id}/dispatches",
        json={
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


async def _deliver(client, qe_token, sup_token, pid, refs, *, ordered, delivered):
    """Order a truck, fill it, scan it in, supervisor-admit (→PENDING_QE), then the
    QE signs off the in-situ slump test (→ACCEPTED). Returns the dispatch_id."""
    created = (
        await _raise_dispatch(client, qe_token, pid, refs, volume_ordered=ordered)
    ).json()
    dispatch_id, token = created["dispatch_id"], created["truck"]["token"]
    await _fill_truck(client, token, volume_cum=delivered)
    await client.post(
        f"{API}/projects/{pid}/gate/{token}/arrive", json={}, headers=bearer(sup_token)
    )
    await client.post(
        f"{API}/projects/{pid}/gate/{token}/accept", headers=bearer(sup_token)
    )
    await client.post(
        f"{API}/projects/{pid}/dispatches/{dispatch_id}/insitu",
        json={"measured_slump_mm": 100, "decision": "APPROVED"},
        headers=bearer(qe_token),
    )
    return dispatch_id


async def _create_pour(client, qe_token, pid, dispatch_id, refs, **overrides):
    """Record a pour from an accepted delivery."""
    payload = {
        "dispatch_id": dispatch_id,
        "tower_id": refs["tower_id"],
        "floor_id": refs["floor_id"],
        "component_id": refs["component_id"],
        "pour_date": "2026-07-15",
        "pour_reference": "PC-001",
    }
    payload.update(overrides)
    return await client.post(
        f"{API}/projects/{pid}/pours", json=payload, headers=bearer(qe_token)
    )


async def _accepted_delivery(client, db_session, *, ordered=30.0, delivered=30.0):
    """Full setup through an accepted delivery, before any pour is recorded.
    Returns (contractor_token, qe_token, sup_token, pid, refs, dispatch_id)."""
    contractor_token, qe_token, sup_token, pid = (
        await _project_with_qe_and_supervisor(client, db_session)
    )
    refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
    dispatch_id = await _deliver(
        client, qe_token, sup_token, pid, refs, ordered=ordered, delivered=delivered
    )
    return contractor_token, qe_token, sup_token, pid, refs, dispatch_id


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
        assert body["pour_id"] is None
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

    async def test_dispatch_grade_needs_approved_mix(self, client, db_session):
        contractor_token, qe_token, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        grades = (await client.get(f"{API}/grades", headers=bearer(qe_token))).json()
        other = next(g for g in grades if g["grade_name"] != "M30")
        # M40 has no approved mix design on the project → can't be dispatched.
        resp = await _raise_dispatch(
            client, qe_token, pid, {**refs, "grade_id": other["grade_id"]}
        )
        assert resp.status_code == 400, resp.text

    async def test_supplier_registration_requires_contact_email(self, client, db_session):
        contractor_token, _, _, pid = await _project_with_qe_and_supervisor(
            client, db_session
        )
        # A supplier interacts only via tokenised email links, so an email is
        # mandatory at registration (422 without it).
        resp = await client.post(
            f"{API}/projects/{pid}/suppliers",
            json={"supplier_name": "ACC Plant"},
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 422


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

        # Supervisor admission is provisional — the truck waits for the QE.
        provisional = await client.post(
            f"{API}/projects/{pid}/gate/{token}/accept", headers=bearer(sup_token)
        )
        assert provisional.status_code == 200, provisional.text
        assert provisional.json()["truck"]["status"] == "PENDING_QE"

        # Nothing is credited until the QE signs off the in-situ slump test.
        dispatch = (
            await client.get(
                f"{API}/projects/{pid}/dispatches/{dispatch_id}",
                headers=bearer(qe_token),
            )
        ).json()
        assert dispatch["volume_received_cum"] in (None, 0, 0.0)

        accepted = await client.post(
            f"{API}/projects/{pid}/dispatches/{dispatch_id}/insitu",
            json={"measured_slump_mm": 105, "decision": "APPROVED"},
            headers=bearer(qe_token),
        )
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["truck"]["status"] == "ACCEPTED"
        assert accepted.json()["truck"]["accepted_at"] is not None
        assert accepted.json()["insitu"]["result"] == "PASS"

        # Volume accounting lands on the dispatch only after QE acceptance.
        dispatch = (
            await client.get(
                f"{API}/projects/{pid}/dispatches/{dispatch_id}",
                headers=bearer(qe_token),
            )
        ).json()
        assert dispatch["volume_received_cum"] == 6.0
        assert dispatch["volume_remaining_cum"] == 24.0
        assert dispatch["is_complete"] is False
        assert dispatch["slump_at_site_mm"] == 105.0

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


async def _backdate_dispatch(db_session, dispatch_id, minutes):
    """Move a dispatch's batching time into the past to simulate transit elapsed.
    db_session shares the client's connection, so the next request sees it."""
    dispatch = await db_session.get(RMCDispatch, dispatch_id)
    dispatch.dispatch_time = datetime.now(UTC) - timedelta(minutes=minutes)
    await db_session.flush()


class TestPlacementWindow:
    """90-minute concrete placement window: a load reaching the gate within the
    window is admitted; one that took too long is auto-rejected at the scan."""

    async def test_arrival_within_window_is_admitted(self, client, db_session):
        contractor_token, qe_token, sup_token, pid = (
            await _project_with_qe_and_supervisor(client, db_session)
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        token = (await _raise_dispatch(client, qe_token, pid, refs)).json()["truck"]["token"]
        await _fill_truck(client, token)  # dispatch_time = now

        arrived = await client.post(
            f"{API}/projects/{pid}/gate/{token}/arrive",
            json={},
            headers=bearer(sup_token),
        )
        assert arrived.status_code == 200, arrived.text
        body = arrived.json()
        assert body["truck"]["status"] == "ARRIVED"
        assert body["placement_window_minutes"] == 90
        assert body["transit_minutes"] is not None
        assert body["transit_minutes"] <= 90

    async def test_arrival_past_window_is_auto_rejected(self, client, db_session):
        contractor_token, qe_token, sup_token, pid = (
            await _project_with_qe_and_supervisor(client, db_session)
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        created = (await _raise_dispatch(client, qe_token, pid, refs)).json()
        dispatch_id, token = created["dispatch_id"], created["truck"]["token"]
        await _fill_truck(client, token)
        await _backdate_dispatch(db_session, dispatch_id, minutes=120)

        arrived = await client.post(
            f"{API}/projects/{pid}/gate/{token}/arrive",
            json={},
            headers=bearer(sup_token),
        )
        assert arrived.status_code == 200, arrived.text
        body = arrived.json()
        assert body["truck"]["status"] == "REJECTED"
        assert "90-minute" in body["truck"]["rejection_reason"]
        assert body["transit_minutes"] > 90

    async def test_auto_rejected_load_cannot_become_a_pour(self, client, db_session):
        contractor_token, qe_token, sup_token, pid = (
            await _project_with_qe_and_supervisor(client, db_session)
        )
        refs = await _dispatch_refs(client, contractor_token, qe_token, pid)
        created = (
            await _raise_dispatch(client, qe_token, pid, refs, volume_ordered=30.0)
        ).json()
        dispatch_id, token = created["dispatch_id"], created["truck"]["token"]
        await _fill_truck(client, token, volume_cum=30.0)
        await _backdate_dispatch(db_session, dispatch_id, minutes=120)

        await client.post(
            f"{API}/projects/{pid}/gate/{token}/arrive",
            json={},
            headers=bearer(sup_token),
        )
        # The load is REJECTED, not ACCEPTED — no pour can be recorded from it.
        resp = await _create_pour(client, qe_token, pid, dispatch_id, refs)
        assert resp.status_code == 400, resp.text
