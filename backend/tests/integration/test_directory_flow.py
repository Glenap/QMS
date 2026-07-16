"""Integration tests for the org-wide RMC / lab directories.

``GET /directory/suppliers`` and ``/directory/labs`` roll every RMC / lab up
across the caller's projects — a client org sees all entities on its projects
(with the project + contractor each is attached to); a contractor org sees the
ones it holds.
"""

from tests.helpers import API, bearer, register_and_token
from tests.integration.test_client_registration_flow import (
    _client_project_with_contractor,
)

_SUP = {"supplier_name": "UltraTech RMC", "contact_email": "plant@ultratech.example"}
_LAB = {"lab_name": "Sigma Test Labs", "contact_email": "lab@sigma.example"}


class TestDirectory:
    async def test_client_and_contractor_see_registered_entities(self, client, db_session):
        client_token, contractor_token, pid = await _client_project_with_contractor(
            client, db_session
        )
        # Client registers an RMC + a lab (CLIENT mode → attached to the contractor).
        sup = await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
        )
        assert sup.status_code == 201, sup.text
        lab = await client.post(
            f"{API}/projects/{pid}/labs", json=_LAB, headers=bearer(client_token)
        )
        assert lab.status_code == 201, lab.text

        # Client directory: sees the RMC with its project + contractor filled in.
        dir_sup = await client.get(f"{API}/directory/suppliers", headers=bearer(client_token))
        assert dir_sup.status_code == 200, dir_sup.text
        rows = dir_sup.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["supplier_name"] == _SUP["supplier_name"]
        assert row["project_id"] == pid
        assert row["project_name"]  # project name resolved
        assert row["contractor_org_name"] == "L&T Construction"
        assert row["registered_by"] == "CLIENT"

        dir_lab = await client.get(f"{API}/directory/labs", headers=bearer(client_token))
        assert dir_lab.status_code == 200, dir_lab.text
        labs = dir_lab.json()
        assert len(labs) == 1
        assert labs[0]["lab_name"] == _LAB["lab_name"]
        assert labs[0]["project_id"] == pid

        # The contractor that holds them sees them too (scoped by contractor_org_id).
        c_sup = await client.get(f"{API}/directory/suppliers", headers=bearer(contractor_token))
        assert c_sup.status_code == 200
        assert [r["supplier_id"] for r in c_sup.json()] == [row["supplier_id"]]
        c_lab = await client.get(f"{API}/directory/labs", headers=bearer(contractor_token))
        assert c_lab.status_code == 200
        assert len(c_lab.json()) == 1

    async def test_directory_is_org_scoped(self, client, db_session):
        # An unrelated client org sees none of the first client's entities.
        client_token, _, pid = await _client_project_with_contractor(client, db_session)
        await client.post(
            f"{API}/projects/{pid}/suppliers", json=_SUP, headers=bearer(client_token)
        )
        other_token, _ = await register_and_token(
            client,
            org_name="Prestige Estates",
            email="other.client@example.com",
            full_name="Other Client",
        )
        # New org, no projects → empty directory (no visibility of the first org's RMC).
        other = await client.get(f"{API}/directory/suppliers", headers=bearer(other_token))
        assert other.status_code == 200
        assert other.json() == []
