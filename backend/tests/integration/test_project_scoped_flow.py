"""Integration tests for the project-scoped model: visibility, membership
(assign/invite), contractor accept, and contractor-side supplier/lab + roles."""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests.helpers import (
    API,
    accept_and_verify,
    bearer,
    register_and_token,
    sample_project_payload,
)


async def _make_project(client, **kw) -> tuple[str, int]:
    """Register a client admin and create a project → (token, project_id)."""
    token, _ = await register_and_token(client, **kw)
    proj = await client.post(
        f"{API}/projects",
        json=sample_project_payload(towers=[]),
        headers=bearer(token),
    )
    assert proj.status_code == 201, proj.text
    return token, proj.json()["project_id"]


async def _invitation_token(db_session, email: str) -> str:
    inv = (
        await db_session.execute(
            select(OrgInvitation).where(OrgInvitation.invited_email == email)
        )
    ).scalar_one()
    return inv.token


class TestProjectVisibility:
    async def test_outsider_cannot_view_project(self, client):
        _, project_id = await _make_project(client)
        other_token, _ = await register_and_token(
            client, org_name="Other Co", email="other.admin@example.com"
        )
        resp = await client.get(
            f"{API}/projects/{project_id}", headers=bearer(other_token)
        )
        assert resp.status_code in (403, 404)

    async def test_owner_detail_has_access_block(self, client):
        owner_token, project_id = await _make_project(client)
        resp = await client.get(
            f"{API}/projects/{project_id}", headers=bearer(owner_token)
        )
        assert resp.status_code == 200, resp.text
        access = resp.json()["access"]
        assert access["side"] == "CLIENT"
        assert access["can_manage_client_side"] is True
        assert access["can_manage_contractor_side"] is False


class TestClientMembership:
    async def test_invite_new_client_user_to_project(self, client, db_session):
        owner_token, project_id = await _make_project(client)
        email = "client.user@example.com"

        resp = await client.post(
            f"{API}/projects/{project_id}/members",
            json={"email": email, "project_role": "CLIENT_LEAD"},
            headers=bearer(owner_token),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["status"] == "INVITED"

        members = await client.get(
            f"{API}/projects/{project_id}/members", headers=bearer(owner_token)
        )
        assert any(
            m["email"] == email and m["status"] == "INVITED" for m in members.json()
        )

        # Accept + verify → active member who can see + manage the project.
        token = await _invitation_token(db_session, email)
        user_token, _ = await accept_and_verify(client, token=token, email=email)

        listed = await client.get(f"{API}/projects", headers=bearer(user_token))
        assert [p["project_id"] for p in listed.json()] == [project_id]
        detail = await client.get(
            f"{API}/projects/{project_id}", headers=bearer(user_token)
        )
        assert detail.json()["access"]["can_manage_client_side"] is True


class TestContractorSide:
    async def test_contractor_accept_then_lead_registers_and_assigns(
        self, client, db_session
    ):
        owner_token, project_id = await _make_project(client)

        # Client brings on a contractor.
        c_email = "ctr.admin@example.com"
        add = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={"org_name": "BuildCo", "contact_email": c_email},
            headers=bearer(owner_token),
        )
        assert add.status_code == 201, add.text
        ctr_token, _ = await accept_and_verify(
            client, token=await _invitation_token(db_session, c_email), email=c_email
        )

        # Cannot manage contractor side until the project link is accepted.
        before = await client.post(
            f"{API}/projects/{project_id}/labs",
            json={"lab_name": "Premature Lab", "lab_type": "THIRD_PARTY"},
            headers=bearer(ctr_token),
        )
        assert before.status_code == 403

        # Accept the project.
        assigned = await client.get(
            f"{API}/projects/assigned", headers=bearer(ctr_token)
        )
        pc_id = assigned.json()[0]["pc_id"]
        await client.post(
            f"{API}/projects/assigned/{pc_id}/accept", headers=bearer(ctr_token)
        )

        # Contractor admin registers a lab.
        lab = await client.post(
            f"{API}/projects/{project_id}/labs",
            json={"lab_name": "QA Lab", "lab_type": "THIRD_PARTY"},
            headers=bearer(ctr_token),
        )
        assert lab.status_code == 201, lab.text
        assert lab.json()["project_id"] == project_id

        # Contractor admin assigns a contractor lead (invite new).
        lead_email = "lead@example.com"
        r = await client.post(
            f"{API}/projects/{project_id}/members",
            json={"email": lead_email, "project_role": "CONTRACTOR_LEAD"},
            headers=bearer(ctr_token),
        )
        assert r.status_code == 201, r.text
        lead_token, _ = await accept_and_verify(
            client, token=await _invitation_token(db_session, lead_email), email=lead_email
        )

        # The lead can assign a PM and register a supplier.
        pm = await client.post(
            f"{API}/projects/{project_id}/members",
            json={"email": "pm@example.com", "project_role": "PROJECT_MANAGER"},
            headers=bearer(lead_token),
        )
        assert pm.status_code == 201, pm.text
        sup = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "RMC X"},
            headers=bearer(lead_token),
        )
        assert sup.status_code == 201, sup.text

    async def test_client_cannot_register_supplier(self, client):
        owner_token, project_id = await _make_project(client)
        resp = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "X"},
            headers=bearer(owner_token),
        )
        assert resp.status_code == 403
