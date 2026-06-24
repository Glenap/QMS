"""
Integration tests for Phase 2 — the pour lifecycle:

  QE raises a pour card → it appears in the list → QE completes it.
  Plus RBAC (only QE) and FK/scoping validation.
"""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests.helpers import API, accept_and_verify, bearer
from tests.integration.test_phase1_master_flow import _contractor_on_project


async def _project_with_qe(client, db_session) -> tuple[str, str, int]:
    """Returns (contractor_token, qe_token, project_id) with a QE assigned."""
    _, contractor_token, project_id = await _contractor_on_project(client, db_session)
    qe_email = "qe@example.com"
    await client.post(
        f"{API}/projects/{project_id}/members",
        json={"email": qe_email, "project_role": "QUALITY_ENGINEER"},
        headers=bearer(contractor_token),
    )
    inv = (
        await db_session.execute(
            select(OrgInvitation).where(OrgInvitation.invited_email == qe_email)
        )
    ).scalar_one()
    qe_token, _ = await accept_and_verify(
        client, token=inv.token, email=qe_email, full_name="Quala Engineer"
    )
    return contractor_token, qe_token, project_id


async def _pour_refs(client, db_session, contractor_token, qe_token, project_id) -> dict:
    """Set up the master data a pour references; return the id payload."""
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
            json={"supplier_name": "UltraTech RMC"},
            headers=bearer(contractor_token),
        )
    ).json()
    return {
        "tower_id": tower_id,
        "floor_id": floors[0]["floor_id"],
        "component_id": components[0]["component_id"],
        "grade_id": m30["grade_id"],
        "supplier_horizontal_id": supplier["supplier_id"],
    }


class TestPourLifecycle:
    async def test_qe_creates_pour(self, client, db_session):
        contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
        refs = await _pour_refs(client, db_session, contractor_token, qe_token, project_id)

        resp = await client.post(
            f"{API}/projects/{project_id}/pours",
            json={**refs, "pour_date": "2026-07-15", "volume_cum": 30.0, "pour_reference": "PC-001"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "PLANNED"
        assert body["grade_name"] == "M30"
        assert body["supplier_name"] == "UltraTech RMC"
        assert body["tower_name"]
        assert body["floor_label"]

    async def test_pour_appears_in_list_and_completes(self, client, db_session):
        contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
        refs = await _pour_refs(client, db_session, contractor_token, qe_token, project_id)
        created = await client.post(
            f"{API}/projects/{project_id}/pours",
            json={**refs, "pour_date": "2026-07-15", "volume_cum": 30.0},
            headers=bearer(qe_token),
        )
        pour_id = created.json()["pour_id"]

        listed = await client.get(
            f"{API}/projects/{project_id}/pours", headers=bearer(qe_token)
        )
        assert [p["pour_id"] for p in listed.json()] == [pour_id]

        done = await client.patch(
            f"{API}/projects/{project_id}/pours/{pour_id}/complete",
            json={"volume_actual_cum": 31.5, "completion_notes": "Done"},
            headers=bearer(qe_token),
        )
        assert done.status_code == 200, done.text
        assert done.json()["status"] == "COMPLETED"
        assert done.json()["completed_at"] is not None

        # Completing twice is rejected.
        again = await client.patch(
            f"{API}/projects/{project_id}/pours/{pour_id}/complete",
            json={},
            headers=bearer(qe_token),
        )
        assert again.status_code == 400

    async def test_non_qe_cannot_create_pour(self, client, db_session):
        contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
        refs = await _pour_refs(client, db_session, contractor_token, qe_token, project_id)
        # The contractor admin (not a QE) may not raise a pour card.
        resp = await client.post(
            f"{API}/projects/{project_id}/pours",
            json={**refs, "pour_date": "2026-07-15"},
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 403

    async def test_unknown_supplier_rejected(self, client, db_session):
        contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
        refs = await _pour_refs(client, db_session, contractor_token, qe_token, project_id)
        resp = await client.post(
            f"{API}/projects/{project_id}/pours",
            json={**refs, "supplier_horizontal_id": 999999, "pour_date": "2026-07-15"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 404

    async def test_floor_must_belong_to_tower(self, client, db_session):
        contractor_token, qe_token, project_id = await _project_with_qe(client, db_session)
        refs = await _pour_refs(client, db_session, contractor_token, qe_token, project_id)
        resp = await client.post(
            f"{API}/projects/{project_id}/pours",
            json={**refs, "floor_id": 999999, "pour_date": "2026-07-15"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 404
