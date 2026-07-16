"""Integration tests for the team-first model.

Team-building and projects are independent: an org admin invites people to the
org team (designation-less), then assigns existing members to a project with a
per-project designation. A member is on one active project at a time and is freed
for reassignment once that project is completed.
"""

from tests.helpers import (
    API,
    assign_member,
    bearer,
    onboard_member,
    register_and_token,
    sample_project_payload,
)


async def _project(client, token, **over) -> int:
    proj = await client.post(
        f"{API}/projects",
        json=sample_project_payload(towers=[], **over),
        headers=bearer(token),
    )
    assert proj.status_code == 201, proj.text
    return proj.json()["project_id"]


class TestExclusivityAndFreeing:
    async def test_member_is_on_one_active_project_at_a_time(self, client, db_session):
        owner, _ = await register_and_token(client)
        p1 = await _project(client, owner, project_code="P-AAA-1")
        p2 = await _project(client, owner, project_code="P-BBB-2")
        await onboard_member(
            client, db_session, admin_token=owner,
            email="lead@example.com", full_name="Lea Lead", org_role="CLIENT_USER",
        )

        a = await assign_member(
            client, admin_token=owner, project_id=p1,
            email="lead@example.com", project_role="CLIENT_LEAD",
        )
        assert a.status_code == 201, a.text

        # Busy on P1 → can't be added to P2.
        b = await assign_member(
            client, admin_token=owner, project_id=p2,
            email="lead@example.com", project_role="CLIENT_LEAD",
        )
        assert b.status_code == 409, b.text

        # Completing P1 frees them for P2.
        done = await client.patch(
            f"{API}/projects/{p1}/status",
            json={"status": "COMPLETED"}, headers=bearer(owner),
        )
        assert done.status_code == 200, done.text
        c = await assign_member(
            client, admin_token=owner, project_id=p2,
            email="lead@example.com", project_role="CLIENT_LEAD",
        )
        assert c.status_code == 201, c.text


class TestTeamRosterAvailability:
    async def test_roster_shows_active_project(self, client, db_session):
        owner, _ = await register_and_token(client)
        p1 = await _project(client, owner)
        await onboard_member(
            client, db_session, admin_token=owner,
            email="lead@example.com", full_name="Lea Lead", org_role="CLIENT_USER",
        )
        # Before assignment: on the team, free.
        team = (await client.get(f"{API}/auth/team", headers=bearer(owner))).json()
        row = next(m for m in team if m["email"] == "lead@example.com")
        assert row["active_project_id"] is None

        await assign_member(
            client, admin_token=owner, project_id=p1,
            email="lead@example.com", project_role="CLIENT_LEAD",
        )
        team = (await client.get(f"{API}/auth/team", headers=bearer(owner))).json()
        row = next(m for m in team if m["email"] == "lead@example.com")
        assert row["active_project_id"] == p1
        assert row["active_project_name"]


class TestProjectStatus:
    async def test_only_owner_can_change_status(self, client, db_session):
        owner, _ = await register_and_token(client)
        p1 = await _project(client, owner)
        other, _ = await register_and_token(
            client, org_name="Other Co", email="other.admin@example.com"
        )
        # A different org's admin can't finish someone else's project.
        resp = await client.patch(
            f"{API}/projects/{p1}/status",
            json={"status": "COMPLETED"}, headers=bearer(other),
        )
        assert resp.status_code in (403, 404)

        ok = await client.patch(
            f"{API}/projects/{p1}/status",
            json={"status": "ON_HOLD"}, headers=bearer(owner),
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["status"] == "ON_HOLD"
