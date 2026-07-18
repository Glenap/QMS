"""Integration tests for the client auth flow: register, login, me, refresh, logout."""

from sqlalchemy import func, select

from app.models.auth import EmailOtp
from tests import mailbox
from tests.helpers import (
    API,
    DEFAULT_PASSWORD,
    bearer,
    register_and_token,
    register_client_account,
    verify_otp,
)


class TestRegister:
    async def test_register_returns_otp_challenge(self, client):
        resp = await register_client_account(client)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        # No tokens yet — account is pending email verification.
        assert body["otp_required"] is True
        assert body["email"] == "client.admin@example.com"
        assert "access_token" not in body

    async def test_verify_otp_activates_and_returns_tokens(self, client):
        await register_client_account(client)
        resp = await verify_otp(client, "client.admin@example.com")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["token_type"] == "bearer"
        user = body["user"]
        assert user["role"] == "CLIENT_ADMIN"
        assert user["is_org_admin"] is True
        assert user["is_active"] is True

    async def test_verify_otp_wrong_code_is_400(self, client):
        await register_client_account(client)
        resp = await client.post(
            f"{API}/auth/verify-otp",
            json={"email": "client.admin@example.com", "code": "000000"},
        )
        assert resp.status_code == 400

    async def test_verify_otp_on_active_account_issues_no_tokens(self, client):
        """Security regression: an already-active account must NOT receive tokens
        from the public verify-otp endpoint with an arbitrary code."""
        await register_and_token(client)  # registers + verifies → active account
        resp = await client.post(
            f"{API}/auth/verify-otp",
            json={"email": "client.admin@example.com", "code": "000000"},
        )
        assert resp.status_code == 400, resp.text
        assert "access_token" not in resp.json()

    async def test_register_duplicate_email_is_indistinguishable(self, client):
        """Registering an existing address must look exactly like a new one.

        A 409 "Email already exists" on an unauthenticated endpoint lets anyone
        test which addresses have accounts, so the response is deliberately
        identical; the real owner is notified by email instead.
        """
        first = await register_client_account(client)
        assert first.status_code == 201
        second = await register_client_account(client)
        assert second.status_code == 201, second.text
        assert second.json() == first.json()
        # And still no tokens — registration never authenticates.
        assert "access_token" not in second.json()

    async def test_register_password_mismatch_is_422(self, client):
        resp = await client.post(
            f"{API}/auth/register",
            json={
                "org_name": "Acme",
                "contact_email": "a@example.com",
                "full_name": "A B",
                "password": DEFAULT_PASSWORD,
                "confirm_password": "different",
            },
        )
        assert resp.status_code == 422

    async def test_register_short_password_is_422(self, client):
        resp = await client.post(
            f"{API}/auth/register",
            json={
                "org_name": "Acme",
                "contact_email": "a@example.com",
                "full_name": "A B",
                "password": "short",
                "confirm_password": "short",
            },
        )
        assert resp.status_code == 422


class TestLogin:
    async def test_login_success(self, client):
        # register_and_token completes OTP verification, activating the account.
        await register_and_token(client)
        resp = await client.post(
            f"{API}/auth/login",
            json={"email": "client.admin@example.com", "password": DEFAULT_PASSWORD},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["access_token"]
        assert body["user"]["role"] == "CLIENT_ADMIN"

    async def test_login_before_verification_is_403(self, client):
        # Account exists but hasn't completed OTP — login is blocked.
        await register_client_account(client)
        resp = await client.post(
            f"{API}/auth/login",
            json={"email": "client.admin@example.com", "password": DEFAULT_PASSWORD},
        )
        assert resp.status_code == 403

    async def test_login_wrong_password_is_401(self, client):
        await register_client_account(client)
        resp = await client.post(
            f"{API}/auth/login",
            json={"email": "client.admin@example.com", "password": "wrong-password"},
        )
        assert resp.status_code == 401

    async def test_login_unknown_email_is_401(self, client):
        resp = await client.post(
            f"{API}/auth/login",
            json={"email": "nobody@example.com", "password": DEFAULT_PASSWORD},
        )
        assert resp.status_code == 401


class TestOtpHardening:
    async def test_otp_locks_after_repeated_wrong_codes(self, client):
        """Brute-force guard: after MAX_OTP_ATTEMPTS misses the code is burned,
        so even the *correct* code no longer verifies."""
        await register_client_account(client)
        email = "client.admin@example.com"
        code = mailbox.OTP_CODES[email]
        wrong = "000000" if code != "000000" else "111111"

        for _ in range(5):
            r = await client.post(
                f"{API}/auth/verify-otp", json={"email": email, "code": wrong}
            )
            assert r.status_code == 400, r.text

        # The OTP is now burned — the real code is rejected and no tokens issue.
        r = await client.post(
            f"{API}/auth/verify-otp", json={"email": email, "code": code}
        )
        assert r.status_code == 400, r.text
        assert "access_token" not in r.json()

    async def test_resend_is_throttled_within_cooldown(self, client, db_session):
        """Email-bomb guard: an immediate resend inside the cooldown issues no
        new OTP (and still returns the same neutral response)."""
        await register_client_account(client)
        email = "client.admin@example.com"

        async def otp_count() -> int:
            return (
                await db_session.execute(
                    select(func.count())
                    .select_from(EmailOtp)
                    .where(EmailOtp.email == email)
                )
            ).scalar_one()

        before = await otp_count()
        resp = await client.post(f"{API}/auth/resend-otp", json={"email": email})
        assert resp.status_code == 200, resp.text
        assert await otp_count() == before  # cooldown blocked a new issue


class TestMe:
    async def test_me_requires_auth(self, client):
        resp = await client.get(f"{API}/auth/me")
        assert resp.status_code in (401, 403)

    async def test_me_returns_user_and_org(self, client):
        token, _ = await register_and_token(client)
        resp = await client.get(f"{API}/auth/me", headers=bearer(token))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["role"] == "CLIENT_ADMIN"
        assert body["organisation"]["org_type"] == "CLIENT"
        assert body["organisation"]["status"] == "ACTIVE"

    async def test_me_with_garbage_token_is_401(self, client):
        resp = await client.get(f"{API}/auth/me", headers=bearer("garbage.token"))
        assert resp.status_code == 401


class TestRefreshAndLogout:
    async def test_refresh_issues_working_access_token(self, client):
        _, body = await register_and_token(client)
        refresh = body["refresh_token"]

        refreshed = await client.post(
            f"{API}/auth/refresh", json={"refresh_token": refresh}
        )
        assert refreshed.status_code == 200, refreshed.text
        new_access = refreshed.json()["access_token"]

        me = await client.get(f"{API}/auth/me", headers=bearer(new_access))
        assert me.status_code == 200

    async def test_logout_blacklists_access_token(self, client):
        token, _ = await register_and_token(client)

        # Token works before logout.
        assert (await client.get(f"{API}/auth/me", headers=bearer(token))).status_code == 200

        logout = await client.post(f"{API}/auth/logout", headers=bearer(token))
        assert logout.status_code == 204

        # Same token is rejected after logout (blacklisted).
        after = await client.get(f"{API}/auth/me", headers=bearer(token))
        assert after.status_code == 401
