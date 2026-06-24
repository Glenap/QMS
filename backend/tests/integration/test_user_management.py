"""
Integration tests for team offboarding + profile pictures.

  - An org admin can deactivate a member of their org → all access is revoked
    and (crucially) the account can't be reactivated through the OTP flow.
  - Reactivation restores access.
  - RBAC: only an org admin, never yourself or another admin.
  - Any user can set/clear their own avatar; junk data URLs are rejected.
"""

from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests.helpers import API, accept_and_verify, bearer, register_and_token

PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


async def _admin_and_client_user(client, db_session):
    """(admin_token, admin_id, user_token, user_id) — admin + one CLIENT_USER."""
    admin_token, admin_body = await register_and_token(client)
    admin_id = admin_body["user"]["user_id"]

    email = "client.user@example.com"
    await client.post(
        f"{API}/auth/invite",
        json={"invited_email": email, "role": "CLIENT_USER"},
        headers=bearer(admin_token),
    )
    inv = (
        await db_session.execute(
            select(OrgInvitation).where(OrgInvitation.invited_email == email)
        )
    ).scalar_one()
    user_token, user_body = await accept_and_verify(
        client, token=inv.token, email=email, full_name="Una User"
    )
    return admin_token, admin_id, user_token, user_body["user"]["user_id"]


class TestOffboarding:
    async def test_deactivate_revokes_access_then_reactivate_restores(self, client, db_session):
        admin_token, _, user_token, user_id = await _admin_and_client_user(client, db_session)

        # The user can use the app to begin with.
        assert (await client.get(f"{API}/auth/me", headers=bearer(user_token))).status_code == 200

        deact = await client.post(
            f"{API}/auth/users/{user_id}/deactivate", headers=bearer(admin_token)
        )
        assert deact.status_code == 200, deact.text
        assert deact.json()["is_offboarded"] is True

        # Existing token is now rejected, and they can't log back in.
        assert (await client.get(f"{API}/auth/me", headers=bearer(user_token))).status_code == 403
        relog = await client.post(
            f"{API}/auth/login",
            json={"email": "client.user@example.com", "password": "Password123!"},
        )
        assert relog.status_code == 403

        # Reactivate → login works again.
        react = await client.post(
            f"{API}/auth/users/{user_id}/reactivate", headers=bearer(admin_token)
        )
        assert react.status_code == 200
        assert react.json()["is_offboarded"] is False
        relog2 = await client.post(
            f"{API}/auth/login",
            json={"email": "client.user@example.com", "password": "Password123!"},
        )
        assert relog2.status_code == 200

    async def test_deactivated_user_cannot_reverify_via_otp(self, client, db_session):
        admin_token, _, _, user_id = await _admin_and_client_user(client, db_session)
        await client.post(f"{API}/auth/users/{user_id}/deactivate", headers=bearer(admin_token))

        # The OTP path must not become a back door to reactivation.
        resp = await client.post(
            f"{API}/auth/verify-otp",
            json={"email": "client.user@example.com", "code": "000000"},
        )
        assert resp.status_code == 403

    async def test_non_admin_cannot_deactivate(self, client, db_session):
        admin_token, admin_id, user_token, _ = await _admin_and_client_user(client, db_session)
        resp = await client.post(
            f"{API}/auth/users/{admin_id}/deactivate", headers=bearer(user_token)
        )
        assert resp.status_code == 403

    async def test_admin_cannot_deactivate_self(self, client, db_session):
        admin_token, admin_id, _, _ = await _admin_and_client_user(client, db_session)
        resp = await client.post(
            f"{API}/auth/users/{admin_id}/deactivate", headers=bearer(admin_token)
        )
        assert resp.status_code == 403

    async def test_member_list_shows_deactivated(self, client, db_session):
        # Offboarding shows up as a DEACTIVATED status in the team directory.
        admin_token, _, _, user_id = await _admin_and_client_user(client, db_session)
        await client.post(f"{API}/auth/users/{user_id}/deactivate", headers=bearer(admin_token))
        team = (await client.get(f"{API}/auth/team", headers=bearer(admin_token))).json()
        row = next(r for r in team if r["email"] == "client.user@example.com")
        assert row["status"] == "DEACTIVATED"


class TestAvatar:
    async def test_set_and_clear_avatar(self, client, db_session):
        admin_token, _ = await register_and_token(client)

        set_resp = await client.put(
            f"{API}/auth/me/avatar", json={"avatar_url": PNG}, headers=bearer(admin_token)
        )
        assert set_resp.status_code == 200, set_resp.text
        assert set_resp.json()["avatar_url"] == PNG

        me = (await client.get(f"{API}/auth/me", headers=bearer(admin_token))).json()
        assert me["user"]["avatar_url"] == PNG

        clear = await client.put(
            f"{API}/auth/me/avatar", json={"avatar_url": None}, headers=bearer(admin_token)
        )
        assert clear.status_code == 200
        assert clear.json()["avatar_url"] is None

    async def test_invalid_avatar_rejected(self, client, db_session):
        admin_token, _ = await register_and_token(client)
        resp = await client.put(
            f"{API}/auth/me/avatar",
            json={"avatar_url": "https://example.com/me.png"},
            headers=bearer(admin_token),
        )
        assert resp.status_code == 422
