"""supplier_service.py — business logic for RMC suppliers.

A supplier is owned by the contractor organisation that registers it
(contractor_org_id = current user's org). Suppliers never get a portal account;
instead they confirm their details through a tokenised email link (the
confirmation handshake), so the contractor has proof the supplier acknowledged
the registration.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import send_rmc_issue_email, send_supplier_confirmation_email
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.security import create_invitation_token
from app.models.auth import User
from app.models.master import Document, Project, Supplier
from app.repositories.auth_repo import AuthRepository
from app.repositories.supplier_repo import SupplierRepository
from app.schemas.alert import RmcNotify
from app.schemas.master import (
    ConfirmationResult,
    SupplierConfirmationView,
    SupplierConfirmSubmit,
    SupplierCreate,
    SupplierResponse,
)

logger = logging.getLogger(__name__)


async def _try_send_supplier_confirmation(**kwargs) -> None:
    """Best-effort confirmation email — an SMTP failure must not 500 the
    registration. On failure we log the link so local dev still works."""
    token = kwargs.get("token")
    try:
        await send_supplier_confirmation_email(**kwargs)
    except Exception as exc:  # noqa: BLE001 — best-effort email
        link = f"{settings.FRONTEND_URL}/external/confirm/supplier?token={token}"
        logger.warning(
            "Supplier confirmation email to %s failed (%s). Link: %s",
            kwargs.get("supplier_email"),
            exc,
            link,
        )


class SupplierService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SupplierRepository(session)
        self.auth = AuthRepository(session)
        self._org_names: dict[int, str | None] = {}

    async def _org_name(self, org_id: int) -> str | None:
        if org_id not in self._org_names:
            org = await self.auth.get_org_by_id(org_id)
            self._org_names[org_id] = org.org_name if org else None
        return self._org_names[org_id]

    async def _to_response(self, supplier: Supplier) -> SupplierResponse:
        resp = SupplierResponse.model_validate(supplier)
        resp.contractor_org_name = await self._org_name(supplier.contractor_org_id)
        if supplier.mix_design_document_id:
            doc = await self.session.get(Document, supplier.mix_design_document_id)
            if doc:
                resp.mix_design_document_name = doc.title or doc.original_filename
        return resp

    async def _validate_mix_design_document(
        self, document_id: int | None, project_id: int
    ) -> None:
        """A linked mix-design PDF must be a document of this project."""
        if document_id is None:
            return
        doc = await self.session.get(Document, document_id)
        if not doc or doc.project_id != project_id:
            raise NotFoundError("Document")

    async def create(
        self, data: SupplierCreate, project: Project, user: User
    ) -> SupplierResponse:
        await self._validate_mix_design_document(
            data.mix_design_document_id, project.project_id
        )
        token = create_invitation_token()
        sent_at = datetime.now(UTC) if data.contact_email else None
        supplier = Supplier(
            contractor_org_id=user.org_id,
            project_id=project.project_id,
            status="PENDING",
            confirmation_token=token,
            confirmation_sent_at=sent_at,
            **data.model_dump(),
        )
        supplier = await self.repo.add(supplier)

        if data.contact_email:
            org = await self.auth.get_org_by_id(user.org_id)
            await _try_send_supplier_confirmation(
                supplier_email=data.contact_email,
                supplier_name=supplier.supplier_name,
                project_name=project.project_name,
                registered_by=org.org_name if org else user.full_name,
                token=token,
            )
        return await self._to_response(supplier)

    async def list_for_project(self, project: Project) -> list[SupplierResponse]:
        suppliers = await self.repo.list_by(
            Supplier.project_id == project.project_id,
            order_by=Supplier.created_at.desc(),
        )
        return [await self._to_response(s) for s in suppliers]

    async def resend_confirmation(
        self, project: Project, supplier_id: int, user: User
    ) -> SupplierResponse:
        supplier = await self.repo.get_by(Supplier.supplier_id == supplier_id)
        if not supplier or supplier.project_id != project.project_id:
            raise NotFoundError("Supplier")
        if not supplier.contact_email:
            raise PermissionDeniedError("This supplier has no contact email to send to")

        if not supplier.confirmation_token:
            supplier.confirmation_token = create_invitation_token()
        supplier.confirmation_sent_at = datetime.now(UTC)
        await self.session.flush()
        await self.session.refresh(supplier)

        org = await self.auth.get_org_by_id(supplier.contractor_org_id)
        await _try_send_supplier_confirmation(
            supplier_email=supplier.contact_email,
            supplier_name=supplier.supplier_name,
            project_name=project.project_name,
            registered_by=org.org_name if org else user.full_name,
            token=supplier.confirmation_token,
        )
        return await self._to_response(supplier)

    async def notify_issue(
        self, project: Project, supplier_id: int, data: RmcNotify, user: User
    ) -> None:
        """Email an RMC supplier about a quality issue (QE/PM-composed)."""
        supplier = await self.repo.get_by(Supplier.supplier_id == supplier_id)
        if not supplier or supplier.project_id != project.project_id:
            raise NotFoundError("Supplier")
        if not supplier.contact_email:
            raise PermissionDeniedError("This supplier has no contact email to send to")
        try:
            await send_rmc_issue_email(
                supplier_email=supplier.contact_email,
                supplier_name=supplier.supplier_name,
                project_name=project.project_name,
                subject=data.subject,
                message=data.message,
                sender_name=user.full_name,
            )
        except Exception as exc:  # noqa: BLE001 — best-effort email
            logger.warning(
                "RMC issue email to %s failed (%s).", supplier.contact_email, exc
            )

    async def set_blocked(
        self,
        project: Project,
        supplier_id: int,
        user: User,
        *,
        blocked: bool,
        reason: str | None = None,
    ) -> SupplierResponse:
        """Block (no new dispatches / mix requests) or unblock a supplier."""
        supplier = await self.repo.get_by(Supplier.supplier_id == supplier_id)
        if not supplier or supplier.project_id != project.project_id:
            raise NotFoundError("Supplier")
        supplier.is_blocked = blocked
        supplier.block_reason = reason if blocked else None
        supplier.blocked_by = user.user_id if blocked else None
        supplier.blocked_at = datetime.now(UTC) if blocked else None
        await self.session.flush()
        return await self._to_response(supplier)

    # ── Public confirmation handshake (no auth — token only) ────────────────────

    async def get_confirmation(self, token: str) -> SupplierConfirmationView:
        supplier = await self._by_token(token)
        project = (
            await self.session.get(Project, supplier.project_id)
            if supplier.project_id
            else None
        )
        org = await self.auth.get_org_by_id(supplier.contractor_org_id)
        return SupplierConfirmationView(
            supplier_name=supplier.supplier_name,
            plant_name=supplier.plant_name,
            plant_location=supplier.plant_location,
            contact_email=supplier.contact_email,
            contact_phone=supplier.contact_phone,
            primary_contact_name=supplier.primary_contact_name,
            status=supplier.status,
            project_name=project.project_name if project else None,
            registered_by=org.org_name if org else None,
        )

    async def submit_confirmation(
        self, token: str, data: SupplierConfirmSubmit
    ) -> ConfirmationResult:
        supplier = await self._by_token(token)

        if data.action == "DECLINE":
            supplier.status = "DECLINED"
            supplier.confirmed_at = None
            message = "You've declined this registration. The contractor has been notified."
        else:
            # Apply any contact corrections the supplier provided.
            if data.contact_email is not None:
                supplier.contact_email = data.contact_email
            if data.contact_phone is not None:
                supplier.contact_phone = data.contact_phone
            if data.primary_contact_name is not None:
                supplier.primary_contact_name = data.primary_contact_name
            if data.plant_location is not None:
                supplier.plant_location = data.plant_location
            supplier.status = "CONFIRMED"
            supplier.confirmed_at = datetime.now(UTC)
            message = "Thanks — your details are confirmed."

        await self.session.flush()
        return ConfirmationResult(status=supplier.status, message=message)

    async def _by_token(self, token: str) -> Supplier:
        supplier = await self.repo.get_by(Supplier.confirmation_token == token)
        if not supplier:
            raise NotFoundError("Confirmation")
        return supplier
