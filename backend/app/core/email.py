"""
email.py
--------
Async email sender using fastapi-mail + Jinja2 templates.

Every email in the system goes through one of these functions:
  send_invitation_email()     → OrgInvitation flow
  send_truck_dispatch_email() → RMC supplier truck form link
  send_truck_result_email()   → Accepted/rejected notification to supplier
  send_lab_reminder_email()   → Lab pending result reminder
"""

from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from jinja2 import Environment, FileSystemLoader

from app.config import settings

# ---------------------------------------------------------------------------
# Mail connection config
# ---------------------------------------------------------------------------

mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

fastmail = FastMail(mail_config)

# Jinja2 environment for email templates
TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=True,
)


def _render_template(template_name: str, context: dict) -> str:
    """Renders a Jinja2 HTML template with the given context."""
    template = jinja_env.get_template(template_name)
    return template.render(**context)


# ---------------------------------------------------------------------------
# Email senders
# ---------------------------------------------------------------------------

async def send_invitation_email(
    invited_email: str,
    invited_by_name: str,
    org_name: str,
    role: str,
    token: str,
) -> None:
    """
    Sent when a user is invited to join an organisation.
    Link goes to: {FRONTEND_URL}/auth/accept-invitation?token={token}
    """
    accept_url = f"{settings.FRONTEND_URL}/auth/accept-invitation?token={token}"

    html_body = _render_template("invitation.html", {
        "invited_by_name": invited_by_name,
        "org_name": org_name,
        "role": role.replace("_", " ").title(),
        "accept_url": accept_url,
        "expires_hours": 48,
    })

    message = MessageSchema(
        subject=f"You have been invited to join {org_name} on Strata",
        recipients=[invited_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


async def send_otp_email(
    email: str,
    code: str,
    full_name: str | None = None,
) -> None:
    """
    Sent during account activation (signup / invite-accept) with a one-time
    verification code. Built inline (no template file) to keep it self-contained.
    """
    greeting = f"Hi {full_name}," if full_name else "Hi,"
    html_body = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e293b">Verify your email</h2>
      <p>{greeting}</p>
      <p>Use this code to activate your Strata account:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb">{code}</p>
      <p style="color:#64748b;font-size:13px">This code expires in 10 minutes.
      If you didn't request it, you can ignore this email.</p>
    </div>
    """

    message = MessageSchema(
        subject="Your Strata verification code",
        recipients=[email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


async def _send_confirmation_email(
    *,
    recipient: str,
    party_name: str,
    party_kind: str,  # "supplier" | "lab"
    role_label: str,  # "RMC plant" | "testing lab"
    registered_by: str,
    project_name: str,
    confirm_url: str,
) -> None:
    """Shared body for the supplier/lab confirmation handshake email."""
    html_body = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1e293b">Confirm your details on Strata</h2>
      <p>Hi {party_name},</p>
      <p><strong>{registered_by}</strong> has registered your {role_label} on
      <strong>Strata</strong> for the project <strong>{project_name}</strong>.</p>
      <p>Please confirm your contact details so you can start receiving
      requests. No account or password is needed.</p>
      <p style="margin:24px 0">
        <a href="{confirm_url}"
           style="background:#1A56DB;color:#fff;text-decoration:none;
                  padding:12px 24px;border-radius:8px;font-weight:600">
          Review &amp; confirm
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">If this wasn't meant for you, you
      can decline on that page. This link is unique to you — please don't share it.</p>
    </div>
    """
    message = MessageSchema(
        subject=f"Confirm your {role_label} for {project_name} — Strata",
        recipients=[recipient],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


async def send_supplier_confirmation_email(
    supplier_email: str,
    supplier_name: str,
    project_name: str,
    registered_by: str,
    token: str,
) -> None:
    """Sent when a contractor registers an RMC supplier — confirmation handshake.
    Link goes to: {FRONTEND_URL}/external/confirm/supplier?token={token}
    """
    confirm_url = f"{settings.FRONTEND_URL}/external/confirm/supplier?token={token}"
    await _send_confirmation_email(
        recipient=supplier_email,
        party_name=supplier_name,
        party_kind="supplier",
        role_label="RMC plant",
        registered_by=registered_by,
        project_name=project_name,
        confirm_url=confirm_url,
    )


async def send_lab_confirmation_email(
    lab_email: str,
    lab_name: str,
    project_name: str,
    registered_by: str,
    token: str,
) -> None:
    """Sent when a contractor registers a testing lab — confirmation handshake.
    Link goes to: {FRONTEND_URL}/external/confirm/lab?token={token}
    """
    confirm_url = f"{settings.FRONTEND_URL}/external/confirm/lab?token={token}"
    await _send_confirmation_email(
        recipient=lab_email,
        party_name=lab_name,
        party_kind="lab",
        role_label="testing lab",
        registered_by=registered_by,
        project_name=project_name,
        confirm_url=confirm_url,
    )


async def send_truck_dispatch_email(
    supplier_email: str,
    supplier_name: str,
    project_name: str,
    grade: str,
    volume_ordered: float,
    token: str,
) -> None:
    """
    Sent to RMC supplier when QE creates a dispatch.
    Supplier fills truck details via this link — NO login needed.
    Link goes to: {FRONTEND_URL}/dispatch/fill?token={token}
    """
    form_url = f"{settings.FRONTEND_URL}/dispatch/fill?token={token}"

    html_body = _render_template("truck_dispatch.html", {
        "supplier_name": supplier_name,
        "project_name": project_name,
        "grade": grade,
        "volume_ordered": volume_ordered,
        "form_url": form_url,
        "expires_hours": 24,
    })

    message = MessageSchema(
        subject=f"Concrete dispatch request — {project_name} — {grade}",
        recipients=[supplier_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


async def send_truck_result_email(
    supplier_email: str,
    supplier_name: str,
    project_name: str,
    vehicle_number: str,
    status: str,
    rejection_reason: str | None = None,
) -> None:
    """
    Sent to RMC supplier after QE accepts or rejects a truck.
    """
    subject = (
        f"Delivery ACCEPTED — {project_name}"
        if status == "ACCEPTED"
        else f"Delivery REJECTED — {project_name}"
    )

    html_body = _render_template("truck_result.html", {
        "supplier_name": supplier_name,
        "project_name": project_name,
        "vehicle_number": vehicle_number,
        "status": status,
        "rejection_reason": rejection_reason,
    })

    message = MessageSchema(
        subject=subject,
        recipients=[supplier_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


async def send_lab_reminder_email(
    lab_email: str,
    lab_name: str,
    project_name: str,
    sample_reference: str,
    expected_result_date: str,
    test_age_days: int,
) -> None:
    """
    Sent to lab when cube test results are overdue.
    Triggered by background task checking expected_result_date.
    """
    html_body = _render_template("lab_reminder.html", {
        "lab_name": lab_name,
        "project_name": project_name,
        "sample_reference": sample_reference,
        "expected_result_date": expected_result_date,
        "test_age_days": test_age_days,
    })

    message = MessageSchema(
        subject=f"Pending cube test results — {sample_reference} — {project_name}",
        recipients=[lab_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)