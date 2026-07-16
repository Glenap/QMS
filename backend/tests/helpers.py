"""Shared helpers for the test suite — request builders and sample payloads."""

import json

from httpx import AsyncClient, Response
from sqlalchemy import select

from app.models.auth import OrgInvitation
from tests import mailbox

# A tiny valid-looking PDF blob for the mandatory mix-design / lab-report uploads.
DEMO_PDF = ("file", ("demo.pdf", b"%PDF-1.4 demo", "application/pdf"))

API = "/api/v1"
DEFAULT_PASSWORD = "Password123!"


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def register_client_account(
    client: AsyncClient,
    *,
    org_name: str = "Godrej Properties Ltd",
    email: str = "client.admin@example.com",
    full_name: str = "Asha Client",
    phone: str | None = "+919900000000",
    password: str = DEFAULT_PASSWORD,
) -> Response:
    """POST /auth/register — client self-registers org + first CLIENT_ADMIN."""
    return await client.post(
        f"{API}/auth/register",
        json={
            "org_name": org_name,
            "contact_email": email,
            "contact_phone": phone,
            "full_name": full_name,
            "password": password,
            "confirm_password": password,
        },
    )


async def verify_otp(client: AsyncClient, email: str) -> Response:
    """Submit the OTP that was 'emailed' (captured in tests.mailbox)."""
    code = mailbox.OTP_CODES[email]
    return await client.post(
        f"{API}/auth/verify-otp", json={"email": email, "code": code}
    )


async def register_and_token(client: AsyncClient, **kwargs) -> tuple[str, dict]:
    """Register a client, verify the OTP, and return (access_token, token_body)."""
    resp = await register_client_account(client, **kwargs)
    assert resp.status_code == 201, resp.text
    email = kwargs.get("email", "client.admin@example.com")
    verified = await verify_otp(client, email)
    assert verified.status_code == 200, verified.text
    body = verified.json()
    return body["access_token"], body


async def accept_and_verify(
    client: AsyncClient,
    *,
    token: str,
    email: str,
    full_name: str = "Invited User",
    password: str = DEFAULT_PASSWORD,
) -> tuple[str, dict]:
    """Accept an invitation then verify its OTP → (access_token, token_body)."""
    resp = await client.post(
        f"{API}/auth/accept-invitation",
        json={
            "token": token,
            "full_name": full_name,
            "password": password,
            "confirm_password": password,
        },
    )
    assert resp.status_code == 201, resp.text
    verified = await verify_otp(client, email)
    assert verified.status_code == 200, verified.text
    body = verified.json()
    return body["access_token"], body


async def approve_mix_design(
    client: AsyncClient,
    *,
    contractor_token: str,
    qe_token: str,
    project_id: int,
    supplier_id: int,
    grade_id: int,
    **submit_fields,
) -> int:
    """Drive the RMC mix-design flow to an APPROVED mix for (supplier, grade):
    the contractor requests the grade → the RMC submits via its token link → the
    QE approves it. Returns the mix_design_id. (Mix designs are RMC-owned now, so
    pour-enabling fixtures go through this instead of the removed contractor POST.)
    """
    await client.put(
        f"{API}/projects/{project_id}/suppliers/{supplier_id}/required-grades",
        json={"grade_ids": [grade_id]},
        headers=bearer(contractor_token),
    )
    suppliers = (
        await client.get(
            f"{API}/projects/{project_id}/suppliers", headers=bearer(contractor_token)
        )
    ).json()
    token = next(
        s["mix_submission_token"] for s in suppliers if s["supplier_id"] == supplier_id
    )
    submitted = (
        await client.post(
            f"{API}/external/mix-design?token={token}",
            data={"payload": json.dumps({"grade_id": grade_id, **submit_fields})},
            files={"file": DEMO_PDF[1]},
        )
    ).json()
    await client.patch(
        f"{API}/projects/{project_id}/mix-designs/{submitted['mix_design_id']}/review",
        json={"approval_status": "APPROVED"},
        headers=bearer(qe_token),
    )
    return submitted["mix_design_id"]


async def onboard_member(
    client: AsyncClient,
    db_session,
    *,
    admin_token: str,
    email: str,
    full_name: str,
    org_role: str = "CONTRACTOR_USER",
) -> str:
    """Add someone to the org team (designation-less) and accept+verify their
    invite → returns their access token. org_role is CLIENT_USER (client admin
    invites) or CONTRACTOR_USER (contractor admin invites)."""
    resp = await client.post(
        f"{API}/auth/invite",
        json={"invited_email": email, "role": org_role},
        headers=bearer(admin_token),
    )
    assert resp.status_code == 201, resp.text
    inv = (
        await db_session.execute(
            select(OrgInvitation)
            .where(OrgInvitation.invited_email == email)
            .order_by(OrgInvitation.created_at.desc())
        )
    ).scalars().first()
    token, _ = await accept_and_verify(
        client, token=inv.token, email=email, full_name=full_name
    )
    return token


async def assign_member(
    client: AsyncClient,
    *,
    admin_token: str,
    project_id: int,
    email: str,
    project_role: str,
) -> Response:
    """Assign an existing team member a per-project designation."""
    return await client.post(
        f"{API}/projects/{project_id}/members",
        json={"email": email, "project_role": project_role},
        headers=bearer(admin_token),
    )


def sample_project_payload(**overrides) -> dict:
    """A realistic ProjectCreate body matching the Project Master form."""
    payload = {
        "project_name": "Godrej Splendour Phase 2",
        "project_type": "RESIDENTIAL",
        "project_code": "P51700049510",
        "gst_number": "29AABCG1234A1Z5",
        "address_line1": "Survey 17, Whitefield",
        "city": "Bengaluru",
        "state": "KA",
        "pin_code": "560066",
        "start_date": "2026-07-01",
        "end_date": "2028-12-31",
        "no_of_towers": 2,
        "max_floors": 30,
        "acceptance_criteria": "IS 456:2000",
        "final_test_age_days": 28,
        "towers": [
            {"tower_name": "Tower A", "tower_type": "Residential", "floors_total": 30},
            {"tower_name": "Tower B", "tower_type": "Residential", "floors_total": 28},
        ],
    }
    payload.update(overrides)
    return payload
