"""
Integration tests for Phase 1 master data:

  - reference catalogs (grades, components)
  - tower floors (single + bulk generate)
  - mix designs (per project, per supplier+grade)
  - the supplier/lab confirmation handshake (passwordless, token-based)
"""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from app.models.master import Supplier, Tower
from tests.helpers import (
    API,
    accept_and_verify,
    approve_mix_design,
    assign_member,
    bearer,
    onboard_member,
    register_and_token,
    sample_project_payload,
)


async def _client_with_project(client) -> tuple[str, int]:
    token, _ = await register_and_token(client)
    proj = await client.post(
        f"{API}/projects", json=sample_project_payload(), headers=bearer(token)
    )
    return token, proj.json()["project_id"]


async def _contractor_on_project(client, db_session) -> tuple[str, str, int]:
    """Full client→contractor→accept flow.

    Returns (client_token, contractor_token, project_id).
    """
    client_token, project_id = await _client_with_project(client)
    contractor_email = "contractor.admin@example.com"
    await client.post(
        f"{API}/projects/{project_id}/contractors",
        json={"org_name": "L&T Construction", "contact_email": contractor_email},
        headers=bearer(client_token),
    )
    inv = (
        await db_session.execute(
            select(OrgInvitation).where(
                OrgInvitation.invited_email == contractor_email
            )
        )
    ).scalar_one()
    contractor_token, _ = await accept_and_verify(
        client, token=inv.token, email=contractor_email, full_name="Ravi Contractor"
    )
    assigned = await client.get(
        f"{API}/projects/assigned", headers=bearer(contractor_token)
    )
    pc_id = assigned.json()[0]["pc_id"]
    await client.post(
        f"{API}/projects/assigned/{pc_id}/accept", headers=bearer(contractor_token)
    )
    return client_token, contractor_token, project_id


async def _project_with_qe(client, db_session) -> tuple[str, str, int]:
    """Returns (contractor_token, qe_token, project_id) with a QE assigned.

    Team-building is up front now: the contractor admin adds the person to the
    org team (as a generic CONTRACTOR_USER), then assigns them the QE designation
    on the project. Lives here (not with the pour tests) because pours depend on
    deliveries — importing this from Phase 3 would cycle with the pour tests."""
    _, contractor_token, project_id = await _contractor_on_project(client, db_session)
    qe_token = await onboard_member(
        client, db_session, admin_token=contractor_token,
        email="qe@example.com", full_name="Quala Engineer",
    )
    await assign_member(
        client, admin_token=contractor_token, project_id=project_id,
        email="qe@example.com", project_role="QUALITY_ENGINEER",
    )
    return contractor_token, qe_token, project_id


class TestCatalogs:
    async def test_grades_seeded_and_sorted(self, client):
        token, _ = await register_and_token(client)
        resp = await client.get(f"{API}/grades", headers=bearer(token))
        assert resp.status_code == 200, resp.text
        names = [g["grade_name"] for g in resp.json()]
        assert "M25" in names and "M40" in names
        strengths = [g["min_strength_mpa"] for g in resp.json()]
        assert strengths == sorted(strengths)

    async def test_components_seeded(self, client):
        token, _ = await register_and_token(client)
        resp = await client.get(f"{API}/components", headers=bearer(token))
        assert resp.status_code == 200
        types = [c["component_type"] for c in resp.json()]
        assert "SLAB" in types and "COLUMN" in types

    async def test_catalog_requires_auth(self, client):
        assert (await client.get(f"{API}/grades")).status_code in (401, 403)


class TestFloors:
    async def _tower_id(self, client, db_session, project_id) -> int:
        tower = (
            await db_session.execute(
                select(Tower).where(Tower.project_id == project_id)
            )
        ).scalars().first()
        return tower.tower_id

    async def test_generate_and_list_floors(self, client, db_session):
        token, project_id = await _client_with_project(client)
        tid = await self._tower_id(client, db_session, project_id)

        gen = await client.post(
            f"{API}/projects/{project_id}/towers/{tid}/floors/generate",
            json={"count": 3},
            headers=bearer(token),
        )
        assert gen.status_code == 201, gen.text
        assert [f["floor_label"] for f in gen.json()] == ["L1", "L2", "L3"]

        listed = await client.get(
            f"{API}/projects/{project_id}/towers/{tid}/floors", headers=bearer(token)
        )
        assert len(listed.json()) == 3

    async def test_generate_skips_existing(self, client, db_session):
        token, project_id = await _client_with_project(client)
        tid = await self._tower_id(client, db_session, project_id)
        await client.post(
            f"{API}/projects/{project_id}/towers/{tid}/floors/generate",
            json={"count": 2},
            headers=bearer(token),
        )
        again = await client.post(
            f"{API}/projects/{project_id}/towers/{tid}/floors/generate",
            json={"count": 3},
            headers=bearer(token),
        )
        # L1, L2 already exist → only L3 is created.
        assert [f["floor_label"] for f in again.json()] == ["L3"]

    async def test_create_single_floor(self, client, db_session):
        token, project_id = await _client_with_project(client)
        tid = await self._tower_id(client, db_session, project_id)
        resp = await client.post(
            f"{API}/projects/{project_id}/towers/{tid}/floors",
            json={"floor_label": "Basement 1", "floor_number": -1},
            headers=bearer(token),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["floor_label"] == "Basement 1"

    async def test_list_towers(self, client):
        token, project_id = await _client_with_project(client)
        resp = await client.get(
            f"{API}/projects/{project_id}/towers", headers=bearer(token)
        )
        assert resp.status_code == 200, resp.text
        # sample project creates Tower A + Tower B; ordered by name.
        assert [t["tower_name"] for t in resp.json()] == ["Tower A", "Tower B"]

    async def test_unknown_tower_404(self, client):
        token, project_id = await _client_with_project(client)
        resp = await client.post(
            f"{API}/projects/{project_id}/towers/999999/floors/generate",
            json={"count": 1},
            headers=bearer(token),
        )
        assert resp.status_code == 404


class TestSupplierConfirmation:
    async def test_registration_starts_pending(self, client, db_session):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        resp = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "UltraTech RMC", "contact_email": "plant@ultratech.com"},
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "PENDING"
        assert body["confirmed_at"] is None

    async def test_full_handshake_with_correction(self, client, db_session):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "UltraTech RMC", "contact_email": "plant@ultratech.com"},
            headers=bearer(contractor_token),
        )
        sup = (
            await db_session.execute(
                select(Supplier).where(Supplier.supplier_name == "UltraTech RMC")
            )
        ).scalar_one()
        token = sup.confirmation_token
        assert token

        view = await client.get(
            f"{API}/external/confirm/supplier", params={"token": token}
        )
        assert view.status_code == 200, view.text
        assert view.json()["registered_by"] == "L&T Construction"
        assert view.json()["status"] == "PENDING"

        submit = await client.post(
            f"{API}/external/confirm/supplier",
            params={"token": token},
            json={"action": "CONFIRM", "contact_phone": "+919812345678"},
        )
        assert submit.status_code == 200, submit.text
        assert submit.json()["status"] == "CONFIRMED"

        listed = await client.get(
            f"{API}/projects/{project_id}/suppliers", headers=bearer(contractor_token)
        )
        row = listed.json()[0]
        assert row["status"] == "CONFIRMED"
        assert row["confirmed_at"] is not None
        assert row["contact_phone"] == "+919812345678"

    async def test_decline(self, client, db_session):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "Acme RMC", "contact_email": "x@acme.com"},
            headers=bearer(contractor_token),
        )
        sup = (
            await db_session.execute(
                select(Supplier).where(Supplier.supplier_name == "Acme RMC")
            )
        ).scalar_one()
        submit = await client.post(
            f"{API}/external/confirm/supplier",
            params={"token": sup.confirmation_token},
            json={"action": "DECLINE"},
        )
        assert submit.status_code == 200
        assert submit.json()["status"] == "DECLINED"

    async def test_invalid_token_404(self, client):
        resp = await client.get(
            f"{API}/external/confirm/supplier", params={"token": "does-not-exist"}
        )
        assert resp.status_code == 404

    async def test_resend_confirmation(self, client, db_session):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        created = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "Resend RMC", "contact_email": "r@rmc.com"},
            headers=bearer(contractor_token),
        )
        sid = created.json()["supplier_id"]
        resp = await client.post(
            f"{API}/projects/{project_id}/suppliers/{sid}/resend-confirmation",
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 200, resp.text


class TestMixDesigns:
    """Mix designs are RMC-owned now: contractor requests grades → RMC submits via
    its token link → QE approves. See test_phase4a_mix_design_flow for full coverage."""

    async def test_rmc_submits_and_qe_approves_then_lists(self, client, db_session):
        from tests.integration.test_phase2_pour_flow import _project_with_qe

        contractor_token, qe_token, project_id = await _project_with_qe(
            client, db_session
        )
        sup = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={"supplier_name": "UltraTech RMC", "contact_email": "plant@ultratech.example"},
            headers=bearer(contractor_token),
        )
        supplier_id = sup.json()["supplier_id"]
        grades = (
            await client.get(f"{API}/grades", headers=bearer(contractor_token))
        ).json()
        m30 = next(g for g in grades if g["grade_name"] == "M30")

        await approve_mix_design(
            client,
            contractor_token=contractor_token,
            qe_token=qe_token,
            project_id=project_id,
            supplier_id=supplier_id,
            grade_id=m30["grade_id"],
        )

        listed = await client.get(
            f"{API}/projects/{project_id}/mix-designs", headers=bearer(contractor_token)
        )
        body = listed.json()
        assert len(body) == 1
        assert body[0]["grade_name"] == "M30"
        assert body[0]["supplier_name"] == "UltraTech RMC"
        assert body[0]["approval_status"] == "APPROVED"

    async def test_required_grades_rejects_supplier_from_other_project(
        self, client, db_session
    ):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        grades = (
            await client.get(f"{API}/grades", headers=bearer(contractor_token))
        ).json()
        resp = await client.put(
            f"{API}/projects/{project_id}/suppliers/999999/required-grades",
            json={"grade_ids": [grades[0]["grade_id"]]},
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 404


class TestSupplierMixDesignDocument:
    """A supplier can link a mix-design PDF from the project document store."""

    async def test_supplier_links_project_document(self, client, db_session):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        doc = (
            await client.post(
                f"{API}/projects/{project_id}/documents",
                files={"file": ("mix.pdf", b"%PDF-1.4 mix", "application/pdf")},
                data={"title": "M30 Mix Design"},
                headers=bearer(contractor_token),
            )
        ).json()
        resp = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={
                "supplier_name": "UltraTech RMC",
                "contact_email": "plant@ultratech.example",
                "mix_design_document_id": doc["document_id"],
            },
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["mix_design_document_id"] == doc["document_id"]
        assert body["mix_design_document_name"] == "M30 Mix Design"

    async def test_unknown_document_is_rejected(self, client, db_session):
        _, contractor_token, project_id = await _contractor_on_project(client, db_session)
        resp = await client.post(
            f"{API}/projects/{project_id}/suppliers",
            json={
                "supplier_name": "X RMC",
                "contact_email": "x@rmc.example",
                "mix_design_document_id": 999999,
            },
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 404
