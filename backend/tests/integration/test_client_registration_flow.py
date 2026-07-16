"""Integration tests for client-registered RMC/labs + contractor approval.

When a project is set to ``registration_by = CLIENT``, the client registers RMC
suppliers + labs and the contractor accepts/rejects each; an unapproved one can't
be used. In the default CONTRACTOR mode the contractor registers them and no
approval is needed.
"""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests.helpers import (
    API,
    accept_and_verify,
    bearer,
    register_and_token,
    sample_project_payload,
)

_SUP = {"supplier_name": "UltraTech RMC", "contact_email": "plant@ultratech.example"}


async def _client_project_with_contractor(client, db_session, *, registration_by="CLIENT"):
    """(client_token, contractor_token, project_id) — a project in the given
    registration mode with one ACCEPTED contractor."""
    client_token, _ = await register_and_token(client)
    proj = await client.post(
        f"{API}/projects",
        json=sample_project_payload(towers=[], registration_by=registration_by),
        headers=bearer(client_token),
    )
    assert proj.status_code == 201, proj.text
    assert proj.json()["registration_by"] == registration_by
    pid = proj.json()["project_id"]

    contractor_email = "contractor.admin@example.com"
    await client.post(
        f"{API}/projects/{pid}/contractors",
        json={"org_name": "L&T Construction", "contact_email": contractor_email},
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
    return client_token, contractor_token, pid


class TestClientRegistration:
    async def test_client_registers_then_contractor_approves(self, client, db_session):
        client_token, contractor_token, pid = await _client_project_with_contractor(
            client, db_session
        )
        created = await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["registered_by"] == "CLIENT"
        assert body["approval_status"] == "PENDING"
        sid = body["supplier_id"]

        approved = await client.post(
            f"{API}/projects/{pid}/suppliers/{sid}/approve", headers=bearer(contractor_token)
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["approval_status"] == "ACCEPTED"

    async def test_contractor_rejects_with_reason(self, client, db_session):
        client_token, contractor_token, pid = await _client_project_with_contractor(
            client, db_session
        )
        sid = (
            await client.post(
                f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
            )
        ).json()["supplier_id"]
        rejected = await client.post(
            f"{API}/projects/{pid}/suppliers/{sid}/reject",
            json={"reason": "Not on our approved vendor list"},
            headers=bearer(contractor_token),
        )
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["approval_status"] == "REJECTED"
        assert rejected.json()["approval_reason"] == "Not on our approved vendor list"

    async def test_contractor_cannot_register_in_client_mode(self, client, db_session):
        _, contractor_token, pid = await _client_project_with_contractor(client, db_session)
        resp = await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(contractor_token)
        )
        assert resp.status_code == 403

    async def test_unapproved_supplier_cannot_take_mix_request(self, client, db_session):
        client_token, contractor_token, pid = await _client_project_with_contractor(
            client, db_session
        )
        sid = (
            await client.post(
                f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
            )
        ).json()["supplier_id"]
        grades = (await client.get(f"{API}/grades", headers=bearer(contractor_token))).json()
        gid = grades[0]["grade_id"]

        # PENDING (unapproved) → mix-grade request is blocked.
        blocked = await client.put(
            f"{API}/projects/{pid}/suppliers/{sid}/required-grades",
            json={"grade_ids": [gid]},
            headers=bearer(contractor_token),
        )
        assert blocked.status_code == 400, blocked.text

        # Approve → now usable.
        await client.post(
            f"{API}/projects/{pid}/suppliers/{sid}/approve", headers=bearer(contractor_token)
        )
        ok = await client.put(
            f"{API}/projects/{pid}/suppliers/{sid}/required-grades",
            json={"grade_ids": [gid]},
            headers=bearer(contractor_token),
        )
        assert ok.status_code < 300, ok.text

    async def test_client_registration_needs_a_contractor(self, client):
        # CLIENT mode but no contractor accepted yet → nothing to attach it to.
        client_token, _ = await register_and_token(client)
        pid = (
            await client.post(
                f"{API}/projects",
                json=sample_project_payload(towers=[], registration_by="CLIENT"),
                headers=bearer(client_token),
            )
        ).json()["project_id"]
        resp = await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
        )
        assert resp.status_code == 400, resp.text


class TestContractorRegistration:
    async def test_contractor_mode_needs_no_approval(self, client, db_session):
        client_token, contractor_token, pid = await _client_project_with_contractor(
            client, db_session, registration_by="CONTRACTOR"
        )
        created = await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(contractor_token)
        )
        assert created.status_code == 201, created.text
        assert created.json()["registered_by"] == "CONTRACTOR"
        assert created.json()["approval_status"] == "NOT_REQUIRED"

        # In contractor mode the client can't register.
        resp = await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
        )
        assert resp.status_code == 403
