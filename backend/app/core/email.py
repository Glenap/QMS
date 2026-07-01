"""
email.py
--------
Async email sender using fastapi-mail + Jinja2 templates.

Every email body lives as an HTML file under ``app/templates/email/`` and is
rendered through ``_render_template`` (autoescaped) — no HTML is built inline.
Senders: invitation, OTP, supplier/lab confirmation, mix-design request, truck
dispatch, truck result, lab-report request, lab reminder.
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
    verification code.
    """
    greeting = f"Hi {full_name}," if full_name else "Hi,"
    html_body = _render_template("otp.html", {"greeting": greeting, "code": code})

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
    html_body = _render_template("confirmation.html", {
        "party_name": party_name,
        "role_label": role_label,
        "registered_by": registered_by,
        "project_name": project_name,
        "confirm_url": confirm_url,
    })
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


async def send_mix_design_request_email(
    supplier_email: str,
    supplier_name: str,
    project_name: str,
    grades: str,
    registered_by: str,
    token: str,
) -> None:
    """Sent when a contractor asks an RMC supplier to submit mix designs for a
    set of grades. The supplier fills one mix-design form per grade through this
    tokenised link — NO login needed.
    Link goes to: {FRONTEND_URL}/external/mix-design?token={token}
    """
    submit_url = f"{settings.FRONTEND_URL}/external/mix-design?token={token}"
    html_body = _render_template("mix_design_request.html", {
        "supplier_name": supplier_name,
        "project_name": project_name,
        "grades": grades,
        "registered_by": registered_by,
        "submit_url": submit_url,
    })
    message = MessageSchema(
        subject=f"Mix designs requested — {project_name}",
        recipients=[supplier_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)


async def send_rmc_issue_email(
    supplier_email: str,
    supplier_name: str,
    project_name: str,
    subject: str,
    message: str,
    sender_name: str,
) -> None:
    """A QE/PM emails an RMC supplier about a quality issue (drifting strength,
    NCR, plant review)."""
    html_body = _render_template("rmc_issue.html", {
        "supplier_name": supplier_name,
        "project_name": project_name,
        "message": message,
        "sender_name": sender_name,
    })
    msg = MessageSchema(
        subject=f"[{project_name}] {subject}",
        recipients=[supplier_email],
        body=html_body,
        subtype=MessageType.html,
    )
    await fastmail.send_message(msg)


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


async def send_lab_report_request_email(
    lab_email: str,
    lab_name: str,
    project_name: str,
    sample_reference: str,
    grade: str,
    registered_by: str,
    token: str,
    is_reminder: bool = False,
) -> None:
    """Sent when the QE dispatches a cube sample to a lab (and on manual resend).

    The lab establishes the testing day, then submits the 7/14/28-day strength
    reports through this single tokenised link — NO login needed.
    Link goes to: {FRONTEND_URL}/external/lab-report?token={token}
    """
    report_url = f"{settings.FRONTEND_URL}/external/lab-report?token={token}"
    html_body = _render_template("lab_report_request.html", {
        "lab_name": lab_name,
        "project_name": project_name,
        "sample_reference": sample_reference,
        "grade": grade,
        "registered_by": registered_by,
        "report_url": report_url,
        "is_reminder": is_reminder,
    })
    subject = (
        f"Pending cube reports — {sample_reference} — {project_name}"
        if is_reminder
        else f"Cube sample dispatched — {sample_reference} — {project_name}"
    )
    message = MessageSchema(
        subject=subject,
        recipients=[lab_email],
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