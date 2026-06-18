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
from fastapi_mail import FastMail, MessageSchema, MessageType, ConnectionConfig
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
        subject=f"You have been invited to join {org_name} on Construction QMS",
        recipients=[invited_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


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