"""Regression tests for the 2026-07-18 security audit fixes.

Each test pins a specific hole shut, so a later refactor that quietly reopens one
fails here rather than in production.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.auth import User
from app.models.master import Supplier
from app.services.auth_service import MAX_LOGIN_ATTEMPTS
from tests.helpers import API, DEFAULT_PASSWORD, bearer, register_and_token
from tests.integration.test_phase1_master_flow import _contractor_on_project

pytestmark = pytest.mark.asyncio


async def _supplier_with_token(client, db_session, contractor_token, project_id, name):
    await client.post(
        f"{API}/projects/{project_id}/suppliers",
        json={"supplier_name": name, "contact_email": "plant@example.com"},
        headers=bearer(contractor_token),
    )
    supplier = (
        await db_session.execute(select(Supplier).where(Supplier.supplier_name == name))
    ).scalar_one()
    return supplier


class TestConfirmationTokenLifetime:
    """The confirmation link is a bearer credential — it must expire and burn."""

    async def test_token_is_single_use(self, client, db_session):
        _, contractor_token, pid = await _contractor_on_project(client, db_session)
        sup = await _supplier_with_token(
            client, db_session, contractor_token, pid, "Single Use RMC"
        )
        token = sup.confirmation_token

        first = await client.post(
            f"{API}/external/confirm/supplier",
            params={"token": token},
            json={"action": "CONFIRM"},
        )
        assert first.status_code == 200, first.text

        # Replaying the same link — the exact scenario a forwarded email creates.
        replay = await client.post(
            f"{API}/external/confirm/supplier",
            params={"token": token},
            json={"action": "CONFIRM", "contact_email": "attacker@evil.com"},
        )
        assert replay.status_code in (404, 410), replay.text

        await db_session.refresh(sup)
        assert sup.contact_email != "attacker@evil.com"

    async def test_expired_token_is_refused(self, client, db_session):
        _, contractor_token, pid = await _contractor_on_project(client, db_session)
        sup = await _supplier_with_token(
            client, db_session, contractor_token, pid, "Expired RMC"
        )
        sup.confirmation_token_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await db_session.flush()

        resp = await client.get(
            f"{API}/external/confirm/supplier", params={"token": sup.confirmation_token}
        )
        assert resp.status_code == 410, resp.text

    async def test_blocking_revokes_the_token(self, client, db_session):
        _, contractor_token, pid = await _contractor_on_project(client, db_session)
        sup = await _supplier_with_token(
            client, db_session, contractor_token, pid, "Blocked RMC"
        )
        token = sup.confirmation_token

        blocked = await client.post(
            f"{API}/projects/{pid}/suppliers/{sup.supplier_id}/block",
            json={"reason": "Repeated out-of-spec loads"},
            headers=bearer(contractor_token),
        )
        assert blocked.status_code == 200, blocked.text

        # The party we just distrusted must not keep writing through a link it
        # already holds.
        resp = await client.get(
            f"{API}/external/confirm/supplier", params={"token": token}
        )
        assert resp.status_code in (404, 410), resp.text


class TestLoginThrottling:
    async def test_repeated_failures_lock_the_account(self, client, db_session):
        email = "lockme@example.com"
        token, _ = await register_and_token(client, email=email)
        assert token

        for _ in range(MAX_LOGIN_ATTEMPTS):
            bad = await client.post(
                f"{API}/auth/login", json={"email": email, "password": "WrongPass1!"}
            )
            assert bad.status_code == 401, bad.text

        # Even the *correct* password is refused while locked — otherwise the
        # cap wouldn't actually bound guessing.
        locked = await client.post(
            f"{API}/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
        )
        assert locked.status_code == 429, locked.text

        user = (
            await db_session.execute(select(User).where(User.email == email))
        ).scalar_one()
        assert user.locked_until is not None


class TestRegistrationDoesNotLeakExistence:
    async def test_unknown_email_login_is_401_not_404(self, client):
        """A missing account and a wrong password must be indistinguishable."""
        # A real-looking domain: `.test` is a reserved TLD that email-validator
        # rejects, which would 422 at the schema before login logic ran.
        resp = await client.post(
            f"{API}/auth/login",
            json={"email": "nobody@example.com", "password": "Whatever1!"},
        )
        assert resp.status_code == 401, resp.text
