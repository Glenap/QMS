"""dispatch_service.py — business logic for RMC dispatch + the truck token flow.

Lifecycle of one truck:

    PENDING  ── supplier fills truck details (public token link) ──▶ FILLED
    FILLED   ── supervisor scans the truck in at the site gate    ──▶ ARRIVED
    ARRIVED  ── supervisor accepts the delivery                   ──▶ ACCEPTED
    ARRIVED  ── supervisor rejects the delivery (with reason)     ──▶ REJECTED

The QE raises the dispatch (which generates the token + emails the supplier);
the site SUPERVISOR works the gate end. A dispatch is 1:1 with a truck token and
is scoped to a project through its pour (PourDispatchLink → Pour).
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import send_truck_dispatch_email, send_truck_result_email
from app.core.exceptions import NotFoundError, PermissionDeniedError, TruckStateError
from app.core.security import create_invitation_token
from app.models.auth import User
from app.models.master import Grade, Project, Supplier
from app.models.transaction import (
    Pour,
    PourDispatchLink,
    RMCDispatch,
    TruckDispatch,
    TruckStatus,
)
from app.repositories.dispatch_repo import DispatchRepository, TruckRepository
from app.repositories.pour_repo import PourRepository
from app.schemas.transaction import (
    DispatchCreate,
    DispatchResponse,
    GateTruckView,
    TruckActionResult,
    TruckArrive,
    TruckFillSubmit,
    TruckFillView,
    TruckInfo,
    TruckReject,
)

logger = logging.getLogger(__name__)

TOKEN_TTL_HOURS = 24


async def _try_send(send, *, link: str, recipient: str, **kwargs) -> None:
    """Best-effort email — an SMTP/template failure must not fail the request.
    On failure we log the link so local dev still works."""
    try:
        await send(**kwargs)
    except Exception as exc:  # noqa: BLE001 — best-effort email
        logger.warning("Email to %s failed (%s). Link: %s", recipient, exc, link)


class DispatchService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = DispatchRepository(session)
        self.trucks = TruckRepository(session)
        self.pours = PourRepository(session)

    # ── QE: raise a dispatch ────────────────────────────────────────────────

    async def create(
        self, data: DispatchCreate, project: Project, user: User
    ) -> DispatchResponse:
        pid = project.project_id

        pour = await self.pours.get_in_project(data.pour_id, pid)
        if not pour:
            raise NotFoundError("Pour")

        supplier = await self.session.get(Supplier, data.supplier_id)
        if not supplier or supplier.project_id != pid:
            raise NotFoundError("Supplier")
        if not supplier.contact_email:
            raise PermissionDeniedError(
                "This supplier has no contact email — confirm the supplier "
                "before requesting a dispatch"
            )

        if not await self.session.get(Grade, data.grade_id):
            raise NotFoundError("Grade")

        dispatch = await self.repo.add(
            RMCDispatch(
                supplier_id=data.supplier_id,
                grade_id=data.grade_id,
                volume_ordered_cum=data.volume_ordered_cum,
                volume_remaining_cum=data.volume_ordered_cum,
                is_complete=False,
                created_by=user.user_id,
            )
        )
        self.session.add(
            PourDispatchLink(pour_id=pour.pour_id, dispatch_id=dispatch.dispatch_id)
        )

        token = create_invitation_token()
        truck = TruckDispatch(
            dispatch_id=dispatch.dispatch_id,
            token=token,
            supplier_email=supplier.contact_email,
            status=TruckStatus.PENDING,
            expires_at=datetime.now(UTC) + timedelta(hours=TOKEN_TTL_HOURS),
        )
        self.session.add(truck)
        await self.session.flush()

        grade = await self.session.get(Grade, data.grade_id)
        await _try_send(
            send_truck_dispatch_email,
            link=f"{settings.FRONTEND_URL}/dispatch/fill?token={token}",
            recipient=supplier.contact_email,
            supplier_email=supplier.contact_email,
            supplier_name=supplier.supplier_name,
            project_name=project.project_name,
            grade=grade.grade_name if grade else "",
            volume_ordered=data.volume_ordered_cum,
            token=token,
        )
        return await self._dispatch_response(dispatch, pour_id=pour.pour_id, truck=truck)

    async def list_for_project(
        self, project: Project, pour_id: int | None = None
    ) -> list[DispatchResponse]:
        dispatches = await self.repo.list_for_project(project.project_id, pour_id)
        return [await self._dispatch_response(d) for d in dispatches]

    async def get(self, project: Project, dispatch_id: int) -> DispatchResponse:
        dispatch = await self.repo.get_in_project(dispatch_id, project.project_id)
        if not dispatch:
            raise NotFoundError("Dispatch")
        return await self._dispatch_response(dispatch)

    async def resend(
        self, project: Project, dispatch_id: int, user: User
    ) -> DispatchResponse:
        dispatch = await self.repo.get_in_project(dispatch_id, project.project_id)
        if not dispatch:
            raise NotFoundError("Dispatch")
        truck = await self.trucks.get_for_dispatch(dispatch_id)
        if not truck:
            raise NotFoundError("Truck")
        if truck.status != TruckStatus.PENDING:
            raise TruckStateError("This truck has already been filled in")

        truck.expires_at = datetime.now(UTC) + timedelta(hours=TOKEN_TTL_HOURS)
        await self.session.flush()

        supplier = await self.session.get(Supplier, dispatch.supplier_id)
        grade = await self.session.get(Grade, dispatch.grade_id)
        await _try_send(
            send_truck_dispatch_email,
            link=f"{settings.FRONTEND_URL}/dispatch/fill?token={truck.token}",
            recipient=truck.supplier_email,
            supplier_email=truck.supplier_email,
            supplier_name=supplier.supplier_name if supplier else "",
            project_name=project.project_name,
            grade=grade.grade_name if grade else "",
            volume_ordered=dispatch.volume_ordered_cum or 0,
            token=truck.token,
        )
        return await self._dispatch_response(dispatch, truck=truck)

    # ── Public: supplier fills the truck via token ──────────────────────────

    async def get_fill_view(self, token: str) -> TruckFillView:
        truck = await self._truck_by_token(token)
        dispatch = await self.session.get(RMCDispatch, truck.dispatch_id)
        grade = await self.session.get(Grade, dispatch.grade_id) if dispatch else None
        supplier = (
            await self.session.get(Supplier, dispatch.supplier_id) if dispatch else None
        )
        project = await self._project_for_dispatch(truck.dispatch_id)
        return TruckFillView(
            project_name=project.project_name if project else None,
            supplier_name=supplier.supplier_name if supplier else None,
            grade_name=grade.grade_name if grade else None,
            volume_ordered_cum=dispatch.volume_ordered_cum if dispatch else None,
            status=truck.status,
            expires_at=truck.expires_at,
            is_editable=truck.status == TruckStatus.PENDING and not self._expired(truck),
        )

    async def submit_fill(
        self, token: str, data: TruckFillSubmit
    ) -> TruckActionResult:
        truck = await self._truck_by_token(token)
        if truck.status != TruckStatus.PENDING:
            raise TruckStateError("These truck details have already been submitted")
        if self._expired(truck):
            raise TruckStateError("This dispatch link has expired")

        truck.vehicle_number = data.vehicle_number
        truck.driver_name = data.driver_name
        truck.batch_number = data.batch_number
        truck.challan_number = data.challan_number
        truck.volume_cum = data.volume_cum
        truck.wc_ratio_actual = data.wc_ratio_actual
        truck.slump_at_plant_mm = data.slump_at_plant_mm
        truck.status = TruckStatus.FILLED
        truck.filled_at = datetime.now(UTC)

        dispatch = await self.session.get(RMCDispatch, truck.dispatch_id)
        if dispatch and dispatch.dispatch_time is None:
            dispatch.dispatch_time = truck.filled_at

        await self.session.flush()
        return TruckActionResult(
            status=truck.status, message="Truck details submitted. Drive safe!"
        )

    # ── Supervisor: the site gate ───────────────────────────────────────────

    async def gate_view(self, project: Project, token: str) -> GateTruckView:
        truck, dispatch = await self._truck_in_project(project, token)
        return await self._gate_view(project, dispatch, truck)

    async def arrive(
        self, project: Project, token: str, data: TruckArrive
    ) -> GateTruckView:
        truck, dispatch = await self._truck_in_project(project, token)
        if truck.status != TruckStatus.FILLED:
            raise TruckStateError(
                "Only a truck filled by the supplier can be scanned in at the gate"
            )
        truck.status = TruckStatus.ARRIVED
        truck.arrived_at = datetime.now(UTC)
        if data.slump_at_site_mm is not None:
            dispatch.slump_at_site_mm = data.slump_at_site_mm
        await self.session.flush()
        return await self._gate_view(project, dispatch, truck)

    async def accept(
        self, project: Project, token: str, user: User
    ) -> GateTruckView:
        truck, dispatch = await self._truck_in_project(project, token)
        if truck.status != TruckStatus.ARRIVED:
            raise TruckStateError("Scan the truck in at the gate before accepting it")

        truck.status = TruckStatus.ACCEPTED
        truck.accepted_at = datetime.now(UTC)
        truck.reviewed_by = user.user_id

        received = truck.volume_cum or 0
        dispatch.volume_received_cum = received
        ordered = dispatch.volume_ordered_cum or 0
        dispatch.volume_remaining_cum = max(ordered - received, 0)
        dispatch.is_complete = received >= ordered
        await self.session.flush()

        await self._notify_result(project, dispatch, truck, "ACCEPTED")
        return await self._gate_view(project, dispatch, truck)

    async def reject(
        self, project: Project, token: str, user: User, data: TruckReject
    ) -> GateTruckView:
        truck, dispatch = await self._truck_in_project(project, token)
        if truck.status not in (TruckStatus.FILLED, TruckStatus.ARRIVED):
            raise TruckStateError("This truck can no longer be rejected")

        truck.status = TruckStatus.REJECTED
        truck.rejection_reason = data.rejection_reason
        truck.reviewed_by = user.user_id
        await self.session.flush()

        await self._notify_result(project, dispatch, truck, "REJECTED")
        return await self._gate_view(project, dispatch, truck)

    # ── Internals ───────────────────────────────────────────────────────────

    @staticmethod
    def _expired(truck: TruckDispatch) -> bool:
        return truck.expires_at < datetime.now(UTC)

    async def _truck_by_token(self, token: str) -> TruckDispatch:
        truck = await self.trucks.get_by_token(token)
        if not truck:
            raise NotFoundError("Dispatch")
        return truck

    async def _truck_in_project(
        self, project: Project, token: str
    ) -> tuple[TruckDispatch, RMCDispatch]:
        truck = await self._truck_by_token(token)
        dispatch = await self.repo.get_in_project(truck.dispatch_id, project.project_id)
        if not dispatch:
            raise NotFoundError("Dispatch")
        return truck, dispatch

    async def _project_for_dispatch(self, dispatch_id: int) -> Project | None:
        pour_id = await self.repo.pour_id_for(dispatch_id)
        if pour_id is None:
            return None
        pour = await self.session.get(Pour, pour_id)
        if not pour:
            return None
        return await self.session.get(Project, pour.project_id)

    async def _notify_result(
        self, project: Project, dispatch: RMCDispatch, truck: TruckDispatch, status: str
    ) -> None:
        supplier = await self.session.get(Supplier, dispatch.supplier_id)
        await _try_send(
            send_truck_result_email,
            link="(no link — result notification)",
            recipient=truck.supplier_email,
            supplier_email=truck.supplier_email,
            supplier_name=supplier.supplier_name if supplier else "",
            project_name=project.project_name,
            vehicle_number=truck.vehicle_number or "—",
            status=status,
            rejection_reason=truck.rejection_reason,
        )

    def _truck_info(self, truck: TruckDispatch) -> TruckInfo:
        return TruckInfo(
            dispatch_token_id=truck.dispatch_token_id,
            token=truck.token,
            status=truck.status,
            vehicle_number=truck.vehicle_number,
            driver_name=truck.driver_name,
            batch_number=truck.batch_number,
            challan_number=truck.challan_number,
            volume_cum=truck.volume_cum,
            wc_ratio_actual=truck.wc_ratio_actual,
            slump_at_plant_mm=truck.slump_at_plant_mm,
            filled_at=truck.filled_at,
            arrived_at=truck.arrived_at,
            accepted_at=truck.accepted_at,
            rejection_reason=truck.rejection_reason,
            expires_at=truck.expires_at,
        )

    async def _dispatch_response(
        self,
        dispatch: RMCDispatch,
        *,
        pour_id: int | None = None,
        truck: TruckDispatch | None = None,
    ) -> DispatchResponse:
        if pour_id is None:
            pour_id = await self.repo.pour_id_for(dispatch.dispatch_id)
        if truck is None:
            truck = await self.trucks.get_for_dispatch(dispatch.dispatch_id)
        supplier = await self.session.get(Supplier, dispatch.supplier_id)
        grade = await self.session.get(Grade, dispatch.grade_id)
        return DispatchResponse(
            dispatch_id=dispatch.dispatch_id,
            pour_id=pour_id,
            supplier_id=dispatch.supplier_id,
            supplier_name=supplier.supplier_name if supplier else None,
            grade_id=dispatch.grade_id,
            grade_name=grade.grade_name if grade else None,
            volume_ordered_cum=dispatch.volume_ordered_cum,
            volume_received_cum=dispatch.volume_received_cum,
            volume_remaining_cum=dispatch.volume_remaining_cum,
            slump_at_site_mm=dispatch.slump_at_site_mm,
            is_complete=dispatch.is_complete,
            truck=self._truck_info(truck) if truck else None,
            created_at=dispatch.created_at,
        )

    async def _gate_view(
        self, project: Project, dispatch: RMCDispatch, truck: TruckDispatch
    ) -> GateTruckView:
        supplier = await self.session.get(Supplier, dispatch.supplier_id)
        grade = await self.session.get(Grade, dispatch.grade_id)
        return GateTruckView(
            dispatch_id=dispatch.dispatch_id,
            project_name=project.project_name,
            supplier_name=supplier.supplier_name if supplier else None,
            grade_name=grade.grade_name if grade else None,
            volume_ordered_cum=dispatch.volume_ordered_cum,
            slump_at_site_mm=dispatch.slump_at_site_mm,
            truck=self._truck_info(truck),
        )
