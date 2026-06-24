"""lab_service.py — business logic for testing labs.

A lab is owned by the contractor organisation that registers it
(contractor_org_id = current user's org). Labs never get a portal account;
instead they confirm their details (and may complete their profile) through a
tokenised email link — the confirmation handshake.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import send_lab_confirmation_email
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.security import create_invitation_token
from app.models.auth import User
from app.models.master import Project, TestingLab
from app.repositories.auth_repo import AuthRepository
from app.repositories.lab_repo import LabRepository
from app.schemas.master import (
    ConfirmationResult,
    LabConfirmationView,
    LabConfirmSubmit,
    LabCreate,
    LabResponse,
)

logger = logging.getLogger(__name__)


async def _try_send_lab_confirmation(**kwargs) -> None:
    """Best-effort confirmation email — an SMTP failure must not 500 the
    registration. On failure we log the link so local dev still works."""
    token = kwargs.get("token")
    try:
        await send_lab_confirmation_email(**kwargs)
    except Exception as exc:  # noqa: BLE001 — best-effort email
        link = f"{settings.FRONTEND_URL}/external/confirm/lab?token={token}"
        logger.warning(
            "Lab confirmation email to %s failed (%s). Link: %s",
            kwargs.get("lab_email"),
            exc,
            link,
        )


class LabService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = LabRepository(session)
        self.auth = AuthRepository(session)
        self._org_names: dict[int, str | None] = {}

    async def _org_name(self, org_id: int) -> str | None:
        if org_id not in self._org_names:
            org = await self.auth.get_org_by_id(org_id)
            self._org_names[org_id] = org.org_name if org else None
        return self._org_names[org_id]

    async def _to_response(self, lab: TestingLab) -> LabResponse:
        resp = LabResponse.model_validate(lab)
        resp.contractor_org_name = await self._org_name(lab.contractor_org_id)
        return resp

    async def create(
        self, data: LabCreate, project: Project, user: User
    ) -> LabResponse:
        token = create_invitation_token()
        sent_at = datetime.now(UTC) if data.contact_email else None
        lab = TestingLab(
            contractor_org_id=user.org_id,
            project_id=project.project_id,
            status="PENDING",
            confirmation_token=token,
            confirmation_sent_at=sent_at,
            **data.model_dump(),
        )
        lab = await self.repo.add(lab)

        if data.contact_email:
            org = await self.auth.get_org_by_id(user.org_id)
            await _try_send_lab_confirmation(
                lab_email=data.contact_email,
                lab_name=lab.lab_name,
                project_name=project.project_name,
                registered_by=org.org_name if org else user.full_name,
                token=token,
            )
        return await self._to_response(lab)

    async def list_for_project(self, project: Project) -> list[LabResponse]:
        labs = await self.repo.list_by(
            TestingLab.project_id == project.project_id,
            order_by=TestingLab.created_at.desc(),
        )
        return [await self._to_response(lab) for lab in labs]

    async def resend_confirmation(
        self, project: Project, lab_id: int, user: User
    ) -> LabResponse:
        lab = await self.repo.get_by(TestingLab.lab_id == lab_id)
        if not lab or lab.project_id != project.project_id:
            raise NotFoundError("Lab")
        if not lab.contact_email:
            raise PermissionDeniedError("This lab has no contact email to send to")

        if not lab.confirmation_token:
            lab.confirmation_token = create_invitation_token()
        lab.confirmation_sent_at = datetime.now(UTC)
        await self.session.flush()
        await self.session.refresh(lab)

        org = await self.auth.get_org_by_id(lab.contractor_org_id)
        await _try_send_lab_confirmation(
            lab_email=lab.contact_email,
            lab_name=lab.lab_name,
            project_name=project.project_name,
            registered_by=org.org_name if org else user.full_name,
            token=lab.confirmation_token,
        )
        return await self._to_response(lab)

    # ── Public confirmation handshake (no auth — token only) ────────────────────

    async def get_confirmation(self, token: str) -> LabConfirmationView:
        lab = await self._by_token(token)
        project = (
            await self.session.get(Project, lab.project_id)
            if lab.project_id
            else None
        )
        org = await self.auth.get_org_by_id(lab.contractor_org_id)
        return LabConfirmationView(
            lab_name=lab.lab_name,
            lab_type=lab.lab_type,
            contact_email=lab.contact_email,
            contact_phone=lab.contact_phone,
            lab_manager_name=lab.lab_manager_name,
            city=lab.city,
            state=lab.state,
            status=lab.status,
            project_name=project.project_name if project else None,
            registered_by=org.org_name if org else None,
        )

    async def submit_confirmation(
        self, token: str, data: LabConfirmSubmit
    ) -> ConfirmationResult:
        lab = await self._by_token(token)

        if data.action == "DECLINE":
            lab.status = "DECLINED"
            lab.confirmed_at = None
            message = "You've declined this registration. The contractor has been notified."
        else:
            if data.contact_email is not None:
                lab.contact_email = data.contact_email
            if data.contact_phone is not None:
                lab.contact_phone = data.contact_phone
            if data.lab_manager_name is not None:
                lab.lab_manager_name = data.lab_manager_name
            if data.nabl_certificate_no is not None:
                lab.nabl_certificate_no = data.nabl_certificate_no
            lab.status = "CONFIRMED"
            lab.confirmed_at = datetime.now(UTC)
            message = "Thanks — your details are confirmed."

        await self.session.flush()
        return ConfirmationResult(status=lab.status, message=message)

    async def _by_token(self, token: str) -> TestingLab:
        lab = await self.repo.get_by(TestingLab.confirmation_token == token)
        if not lab:
            raise NotFoundError("Confirmation")
        return lab
