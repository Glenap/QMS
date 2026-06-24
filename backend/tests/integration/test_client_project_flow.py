"""
Integration tests for the core client journey:

    register client  →  login  →  create project  →  register / invite contractor

Also covers organisation scoping and role-based access on /projects.
"""

from sqlalchemy import select

from app.models.auth import InvitationStatus, OrgInvitation, UserRole
from app.models.master import Tower
from tests.helpers import (
    API,
    DEFAULT_PASSWORD,
    accept_and_verify,
    bearer,
    register_and_token,
    sample_project_payload,
)


class TestCreateProject:
    async def test_client_admin_creates_project(self, client):
        token, _ = await register_and_token(client)
        resp = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["project_id"]
        assert body["project_name"] == "Godrej Splendour Phase 2"
        assert body["project_type"] == "RESIDENTIAL"
        assert body["status"] == "ACTIVE"
        assert body["org_id"]

    async def test_created_project_appears_in_list(self, client):
        token, _ = await register_and_token(client)
        await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        listed = await client.get(f"{API}/projects", headers=bearer(token))
        assert listed.status_code == 200
        names = [p["project_name"] for p in listed.json()]
        assert "Godrej Splendour Phase 2" in names

    async def test_towers_are_persisted(self, client, db_session):
        token, _ = await register_and_token(client)
        resp = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        project_id = resp.json()["project_id"]

        towers = (
            await db_session.execute(
                select(Tower).where(Tower.project_id == project_id)
            )
        ).scalars().all()
        assert {t.tower_name for t in towers} == {"Tower A", "Tower B"}

    async def test_create_project_requires_auth(self, client):
        resp = await client.post(f"{API}/projects", json=sample_project_payload())
        assert resp.status_code in (401, 403)


class TestRegisterContractor:
    async def test_add_contractor_to_project_creates_link_and_invitation(
        self, client, db_session
    ):
        token, _ = await register_and_token(client)
        proj = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        project_id = proj.json()["project_id"]

        resp = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={
                "org_name": "L&T Construction",
                "contact_email": "contractor.admin@example.com",
                "contact_phone": "+918800000000",
            },
            headers=bearer(token),
        )
        assert resp.status_code == 201, resp.text
        pc = resp.json()
        assert pc["contractor_org_name"] == "L&T Construction"
        assert pc["status"] == "PENDING"

        # A pending CONTRACTOR_ADMIN invitation should have been created.
        inv = (
            await db_session.execute(
                select(OrgInvitation).where(
                    OrgInvitation.invited_email == "contractor.admin@example.com"
                )
            )
        ).scalar_one()
        assert inv.role == UserRole.CONTRACTOR_ADMIN
        assert inv.status == InvitationStatus.PENDING

    async def test_contractor_scope_from_selected_towers(self, client):
        """Selected towers are stored as a readable scope label."""
        token, _ = await register_and_token(client)
        proj = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        project_id = proj.json()["project_id"]

        towers = (
            await client.get(
                f"{API}/projects/{project_id}/towers", headers=bearer(token)
            )
        ).json()
        names = sorted(t["tower_name"] for t in towers)

        resp = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={
                "org_name": "Tower-Scoped Co",
                "contact_email": "towerco@example.com",
                "tower_ids": [t["tower_id"] for t in towers],
            },
            headers=bearer(token),
        )
        assert resp.status_code == 201, resp.text
        # Scope joins the selected tower names (ordered by tower_id).
        assert sorted(resp.json()["scope"].split(", ")) == names

    async def test_contractor_scope_defaults_to_entire_project(self, client):
        token, _ = await register_and_token(client)
        proj = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        project_id = proj.json()["project_id"]

        resp = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={"org_name": "Whole Project Co", "contact_email": "whole@example.com"},
            headers=bearer(token),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["scope"] == "Entire project"

    async def test_contractor_rejects_tower_outside_project(self, client):
        token, _ = await register_and_token(client)
        proj = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        project_id = proj.json()["project_id"]

        resp = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={
                "org_name": "Bad Tower Co",
                "contact_email": "badtower@example.com",
                "tower_ids": [999999],
            },
            headers=bearer(token),
        )
        assert resp.status_code == 404, resp.text

    async def test_tower_cannot_be_assigned_to_two_contractors(self, client):
        """A tower allotted to one contractor is rejected for the next."""
        token, _ = await register_and_token(client)
        proj = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
        )
        project_id = proj.json()["project_id"]
        towers = (
            await client.get(
                f"{API}/projects/{project_id}/towers", headers=bearer(token)
            )
        ).json()
        first = towers[0]["tower_id"]

        r1 = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={
                "org_name": "Alpha Co",
                "contact_email": "alpha@example.com",
                "tower_ids": [first],
            },
            headers=bearer(token),
        )
        assert r1.status_code == 201, r1.text

        r2 = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={
                "org_name": "Beta Co",
                "contact_email": "beta@example.com",
                "tower_ids": [first],
            },
            headers=bearer(token),
        )
        assert r2.status_code == 403, r2.text

    async def test_add_contractor_requires_auth(self, client):
        resp = await client.post(
            f"{API}/projects/1/contractors",
            json={"org_name": "X", "contact_email": "x@example.com"},
        )
        assert resp.status_code in (401, 403)


class TestAvailableContractors:
    async def test_reusable_contractor_lists_its_other_engagement(self, client):
        """A contractor on project A shows up as available for project B, with
        project A listed as an engagement so the UI can warn before reuse."""
        token, _ = await register_and_token(client)
        proj_a = await client.post(
            f"{API}/projects",
            json=sample_project_payload(project_name="Project A", towers=[]),
            headers=bearer(token),
        )
        pa_id = proj_a.json()["project_id"]
        await client.post(
            f"{API}/projects/{pa_id}/contractors",
            json={"org_name": "Reuse Co", "contact_email": "reuse@example.com"},
            headers=bearer(token),
        )
        proj_b = await client.post(
            f"{API}/projects",
            json=sample_project_payload(project_name="Project B", towers=[]),
            headers=bearer(token),
        )
        pb_id = proj_b.json()["project_id"]

        avail = await client.get(
            f"{API}/projects/{pb_id}/available-contractors", headers=bearer(token)
        )
        assert avail.status_code == 200, avail.text
        by_name = {a["org_name"]: a for a in avail.json()}
        assert "Reuse Co" in by_name
        engagements = by_name["Reuse Co"]["engagements"]
        assert any(
            e["project_name"] == "Project A" and e["status"] == "PENDING"
            for e in engagements
        )

    async def test_excludes_contractor_already_on_this_project(self, client):
        token, _ = await register_and_token(client)
        proj = await client.post(
            f"{API}/projects",
            json=sample_project_payload(project_name="Solo", towers=[]),
            headers=bearer(token),
        )
        pid = proj.json()["project_id"]
        await client.post(
            f"{API}/projects/{pid}/contractors",
            json={"org_name": "OnHere Co", "contact_email": "onhere@example.com"},
            headers=bearer(token),
        )
        avail = await client.get(
            f"{API}/projects/{pid}/available-contractors", headers=bearer(token)
        )
        assert avail.status_code == 200, avail.text
        assert all(a["org_name"] != "OnHere Co" for a in avail.json())

    async def test_requires_auth(self, client):
        resp = await client.get(f"{API}/projects/1/available-contractors")
        assert resp.status_code in (401, 403)


class TestInviteEndpoint:
    async def test_client_admin_can_invite_client_user(self, client):
        token, _ = await register_and_token(client)
        resp = await client.post(
            f"{API}/auth/invite",
            json={"invited_email": "clientuser@example.com", "role": "CLIENT_USER"},
            headers=bearer(token),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["role"] == "CLIENT_USER"
        assert body["status"] == "PENDING"

    async def test_client_admin_cannot_invite_contractor_admin(self, client):
        # Contractors are brought on via POST /projects/{id}/contractors, not /invite.
        token, _ = await register_and_token(client)
        resp = await client.post(
            f"{API}/auth/invite",
            json={"invited_email": "newcontractor@example.com", "role": "CONTRACTOR_ADMIN"},
            headers=bearer(token),
        )
        assert resp.status_code == 403

    async def test_client_cannot_invite_project_manager(self, client):
        token, _ = await register_and_token(client)
        resp = await client.post(
            f"{API}/auth/invite",
            json={"invited_email": "pm@example.com", "role": "PROJECT_MANAGER"},
            headers=bearer(token),
        )
        assert resp.status_code == 403


class TestFullClientToContractorJourney:
    async def test_end_to_end(self, client, db_session):
        # 1. Client signs up.
        client_token, reg = await register_and_token(client)
        assert reg["user"]["role"] == "CLIENT_ADMIN"

        # 2. Client logs in (independent of the register tokens).
        login = await client.post(
            f"{API}/auth/login",
            json={"email": "client.admin@example.com", "password": DEFAULT_PASSWORD},
        )
        assert login.status_code == 200

        # 3. Client creates a project.
        proj = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(client_token)
        )
        assert proj.status_code == 201
        project_id = proj.json()["project_id"]

        # 4. Client brings a contractor onto the project (invites a new org).
        contractor_email = "contractor.admin@example.com"
        add = await client.post(
            f"{API}/projects/{project_id}/contractors",
            json={"org_name": "L&T Construction", "contact_email": contractor_email},
            headers=bearer(client_token),
        )
        assert add.status_code == 201, add.text
        assert add.json()["status"] == "PENDING"

        # 5. Contractor admin accepts the emailed invitation + verifies OTP.
        inv = (
            await db_session.execute(
                select(OrgInvitation).where(OrgInvitation.invited_email == contractor_email)
            )
        ).scalar_one()
        contractor_token, contractor_body = await accept_and_verify(
            client, token=inv.token, email=contractor_email, full_name="Ravi Contractor"
        )
        assert contractor_body["user"]["role"] == "CONTRACTOR_ADMIN"
        assert contractor_body["user"]["is_org_admin"] is True

        # 6. Before accepting the project link, the contractor sees no projects.
        assert (await client.get(f"{API}/projects", headers=bearer(contractor_token))).json() == []

        # 7. Contractor sees the pending assignment and accepts it.
        assigned = await client.get(
            f"{API}/projects/assigned", headers=bearer(contractor_token)
        )
        assert assigned.status_code == 200
        pc = assigned.json()[0]
        assert pc["status"] == "PENDING"
        accepted = await client.post(
            f"{API}/projects/assigned/{pc['pc_id']}/accept",
            headers=bearer(contractor_token),
        )
        assert accepted.status_code == 200
        assert accepted.json()["status"] == "ACCEPTED"

        # 8. Now the project shows up for the contractor.
        ctr_projects = await client.get(f"{API}/projects", headers=bearer(contractor_token))
        assert [p["project_id"] for p in ctr_projects.json()] == [project_id]

        # 9. Contractor registers an RMC supplier for the project.
        supplier = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "UltraTech RMC"},
            headers=bearer(contractor_token),
        )
        assert supplier.status_code == 201, supplier.text
        assert supplier.json()["project_id"] == project_id

        # 10. RBAC: contractor cannot create a project (CLIENT_ADMIN only).
        forbidden_project = await client.post(
            f"{API}/projects", json=sample_project_payload(), headers=bearer(contractor_token)
        )
        assert forbidden_project.status_code == 403

        # 11. Client sees the contractor link as ACCEPTED.
        ctrs = await client.get(
            f"{API}/projects/{project_id}/contractors", headers=bearer(client_token)
        )
        assert ctrs.json()[0]["status"] == "ACCEPTED"


class TestProjectOrgScoping:
    async def test_each_org_sees_only_its_projects(self, client):
        token_a, _ = await register_and_token(
            client, org_name="Org A", email="a.admin@example.com"
        )
        token_b, _ = await register_and_token(
            client, org_name="Org B", email="b.admin@example.com"
        )

        await client.post(
            f"{API}/projects",
            json=sample_project_payload(project_name="Project A", towers=[]),
            headers=bearer(token_a),
        )
        await client.post(
            f"{API}/projects",
            json=sample_project_payload(project_name="Project B", towers=[]),
            headers=bearer(token_b),
        )

        list_a = (await client.get(f"{API}/projects", headers=bearer(token_a))).json()
        list_b = (await client.get(f"{API}/projects", headers=bearer(token_b))).json()
        assert [p["project_name"] for p in list_a] == ["Project A"]
        assert [p["project_name"] for p in list_b] == ["Project B"]
