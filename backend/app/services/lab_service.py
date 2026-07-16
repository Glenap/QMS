"""lab_service.py — business logic for testing labs.

A lab is owned by the contractor organisation that registers it
(contractor_org_id = current user's org). Labs never get a portal account;
instead they confirm their details (and may complete their profile) through a
tokenised email link — the confirmation handshake.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import send_lab_confirmation_email
from app.core.exceptions import (
    NoAcceptedContractorError,
    NotFoundError,
    PermissionDeniedError,
    TruckStateError,
)
from app.core.project_access import contractor_org_ids
from app.core.security import create_invitation_token
from app.models.auth import User, UserRole
from app.models.master import Project, TestingLab
from app.repositories.auth_repo import AuthRepository
from app.repositories.lab_repo import LabRepository
from app.schemas.master import (
    ConfirmationResult,
    LabConfirmationView,
    LabConfirmSubmit,
    LabCreate,
    LabDirectoryItem,
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
        # Client-registered labs attach to the project's accepted contractor and
        # start PENDING their approval; contractor-registered ones need none.
        if project.registration_by == "CLIENT":
            contractors = await contractor_org_ids(
                self.session, project.project_id, accepted_only=True
            )
            if not contractors:
                raise NoAcceptedContractorError()
            contractor_org_id = sorted(contractors)[0]
            registered_by, approval_status = "CLIENT", "PENDING"
        else:
            contractor_org_id = user.org_id
            registered_by, approval_status = "CONTRACTOR", "NOT_REQUIRED"

        token = create_invitation_token()
        sent_at = datetime.now(UTC) if data.contact_email else None
        lab = TestingLab(
            contractor_org_id=contractor_org_id,
            project_id=project.project_id,
            registered_by=registered_by,
            approval_status=approval_status,
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

    async def list_for_org(self, user: User) -> list[LabDirectoryItem]:
        """Every testing lab visible to the caller's organisation, across
        projects. A client org sees all labs on its projects (and which
        contractor holds each); a contractor org sees the labs it holds."""
        stmt = select(TestingLab, Project.project_name).join(
            Project, Project.project_id == TestingLab.project_id, isouter=True
        )
        if user.role in (UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER):
            stmt = stmt.where(Project.org_id == user.org_id)
        else:
            stmt = stmt.where(TestingLab.contractor_org_id == user.org_id)
        rows = (
            await self.session.execute(stmt.order_by(TestingLab.created_at.desc()))
        ).all()
        return [
            LabDirectoryItem(
                lab_id=lab.lab_id,
                lab_name=lab.lab_name,
                lab_type=lab.lab_type,
                project_id=lab.project_id,
                project_name=project_name,
                contractor_org_id=lab.contractor_org_id,
                contractor_org_name=await self._org_name(lab.contractor_org_id),
                contact_email=lab.contact_email,
                city=lab.city,
                status=lab.status,
                approval_status=lab.approval_status,
                registered_by=lab.registered_by,
                is_blocked=lab.is_blocked,
            )
            for lab, project_name in rows
        ]

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

    async def set_blocked(
        self,
        project: Project,
        lab_id: int,
        user: User,
        *,
        blocked: bool,
        reason: str | None = None,
    ) -> LabResponse:
        """Block (no new cube samples / report links) or unblock a lab."""
        lab = await self.repo.get_by(TestingLab.lab_id == lab_id)
        if not lab or lab.project_id != project.project_id:
            raise NotFoundError("Lab")
        lab.is_blocked = blocked
        lab.block_reason = reason if blocked else None
        lab.blocked_by = user.user_id if blocked else None
        lab.blocked_at = datetime.now(UTC) if blocked else None
        await self.session.flush()
        return await self._to_response(lab)

    async def set_approval(
        self,
        project: Project,
        lab_id: int,
        user: User,
        *,
        accepted: bool,
        reason: str | None = None,
    ) -> LabResponse:
        """The contractor accepts / rejects a client-registered lab."""
        lab = await self.repo.get_by(TestingLab.lab_id == lab_id)
        if not lab or lab.project_id != project.project_id:
            raise NotFoundError("Lab")
        if lab.registered_by != "CLIENT":
            raise TruckStateError(
                "This lab was registered by the contractor and needs no approval"
            )
        lab.approval_status = "ACCEPTED" if accepted else "REJECTED"
        lab.approval_reason = None if accepted else reason
        await self.session.flush()
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
