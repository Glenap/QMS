"""dispatch_service.py — business logic for RMC dispatch + the truck token flow.

Lifecycle of one truck:

    PENDING  ── supplier fills truck details (public token link) ──▶ FILLED
    FILLED   ── supervisor scans the truck in at the site gate    ──▶ ARRIVED
    ARRIVED  ── supervisor accepts the delivery                   ──▶ ACCEPTED
    ARRIVED  ── supervisor rejects the delivery (with reason)     ──▶ REJECTED

The QE raises the dispatch (which generates the token + emails the supplier);
the site SUPERVISOR works the gate end. A dispatch is 1:1 with a truck token and
carries its own ``project_id`` — it exists before any pour, and the pour that
records the delivery is created from the accepted truck.
"""

import logging
import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import send_truck_dispatch_email, send_truck_result_email
from app.core.exceptions import (
    EntityBlockedError,
    EntityNotApprovedError,
    GradeNotApprovedError,
    NotFoundError,
    PermissionDeniedError,
    TruckStateError,
)
from app.core.security import create_invitation_token
from app.models.auth import User
from app.models.master import Grade, MixApprovalStatus, MixDesign, Project, Supplier
from app.models.transaction import (
    ActionItem,
    ActionItemStatus,
    ActionResolution,
    InsituResult,
    InsituTest,
    RMCDispatch,
    TruckDispatch,
    TruckStatus,
)
from app.repositories.dispatch_repo import DispatchRepository, TruckRepository
from app.schemas.transaction import (
    ActionItemResponse,
    ActionRequired,
    DispatchCreate,
    DispatchResponse,
    GateTruckView,
    InsituSubmit,
    InsituTestInfo,
    QEReviewItem,
    TruckActionResult,
    TruckArrive,
    TruckFillSubmit,
    TruckFillView,
    TruckInfo,
    TruckReject,
)

logger = logging.getLogger(__name__)

TOKEN_TTL_HOURS = 24

# IS-456 concrete placement window: ready-mix concrete should be placed within
# 90 minutes of batching/dispatch, before it starts its initial set. A truck that
# reaches the gate past this window is auto-rejected at the arrival scan.
PLACEMENT_WINDOW_MINUTES = 90


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

    # ── QE: raise a dispatch ────────────────────────────────────────────────

    async def create(
        self, data: DispatchCreate, project: Project, user: User
    ) -> DispatchResponse:
        pid = project.project_id

        supplier = await self.session.get(Supplier, data.supplier_id)
        if not supplier or supplier.project_id != pid:
            raise NotFoundError("Supplier")
        if supplier.is_blocked:
            raise EntityBlockedError("supplier", supplier.block_reason)
        if supplier.approval_status not in ("NOT_REQUIRED", "ACCEPTED"):
            raise EntityNotApprovedError("supplier")
        if not supplier.contact_email:
            raise PermissionDeniedError(
                "This supplier has no contact email — confirm the supplier "
                "before requesting a dispatch"
            )

        if not await self.session.get(Grade, data.grade_id):
            raise NotFoundError("Grade")
        # Only a grade with an approved mix design on the project may be
        # dispatched — the mix is the contract for what gets batched.
        await self._ensure_grade_has_approved_mix(data.grade_id, pid)

        dispatch = await self.repo.add(
            RMCDispatch(
                project_id=pid,
                supplier_id=data.supplier_id,
                grade_id=data.grade_id,
                volume_ordered_cum=data.volume_ordered_cum,
                volume_remaining_cum=data.volume_ordered_cum,
                is_complete=False,
                created_by=user.user_id,
            )
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
        return await self._dispatch_response(dispatch, pour_id=None, truck=truck)

    async def _ensure_grade_has_approved_mix(
        self, grade_id: int, project_id: int
    ) -> None:
        res = await self.session.execute(
            select(MixDesign.mix_design_id)
            .where(
                MixDesign.project_id == project_id,
                MixDesign.grade_id == grade_id,
                MixDesign.approval_status == MixApprovalStatus.APPROVED,
            )
            .limit(1)
        )
        if res.scalar_one_or_none() is None:
            raise GradeNotApprovedError()

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
        now = datetime.now(UTC)
        truck.arrived_at = now
        if data.slump_at_site_mm is not None:
            dispatch.slump_at_site_mm = data.slump_at_site_mm

        # 90-minute concrete placement window: a load that took longer than the
        # window from dispatch to the gate has likely begun setting and is
        # auto-rejected — the supervisor never gets to accept it.
        transit = self._transit_minutes(dispatch.dispatch_time, now)
        if transit is not None and transit > PLACEMENT_WINDOW_MINUTES:
            truck.status = TruckStatus.REJECTED
            truck.rejection_reason = (
                f"Auto-rejected: {transit} min from dispatch to gate exceeds the "
                f"{PLACEMENT_WINDOW_MINUTES}-minute concrete placement window."
            )
            await self.session.flush()
            await self._notify_result(project, dispatch, truck, "REJECTED")
            return await self._gate_view(project, dispatch, truck)

        truck.status = TruckStatus.ARRIVED
        await self.session.flush()
        return await self._gate_view(project, dispatch, truck)

    async def accept(
        self, project: Project, token: str, user: User
    ) -> GateTruckView:
        truck, dispatch = await self._truck_in_project(project, token)
        if truck.status != TruckStatus.ARRIVED:
            raise TruckStateError("Scan the truck in at the gate before accepting it")

        # Supervisor admission is **provisional** — the QE must sign off with an
        # in-situ slump test before the load is finally ACCEPTED and credited to
        # the pour. The truck waits in the QE's inbox as PENDING_QE.
        truck.status = TruckStatus.PENDING_QE
        truck.reviewed_by = user.user_id
        await self.session.flush()
        return await self._gate_view(project, dispatch, truck)

    async def raise_action(
        self, project: Project, token: str, data: ActionRequired, user: User
    ) -> GateTruckView:
        """Supervisor flags a mismatch on an admitted truck — moves it into the
        QE's inbox (PENDING_QE) with the mismatch reason + message."""
        truck, dispatch = await self._truck_in_project(project, token)
        if truck.status not in (TruckStatus.ARRIVED, TruckStatus.PENDING_QE):
            raise TruckStateError(
                "Only a truck scanned in at the gate can be flagged for the QE"
            )
        truck.status = TruckStatus.PENDING_QE
        truck.reviewed_by = user.user_id
        self.session.add(
            ActionItem(
                project_id=project.project_id,
                dispatch_id=dispatch.dispatch_id,
                reason=data.reason,
                message=data.message,
                status=ActionItemStatus.OPEN,
                raised_by=user.user_id,
            )
        )
        await self.session.flush()
        return await self._gate_view(project, dispatch, truck)

    async def record_insitu(
        self, project: Project, dispatch_id: int, data: InsituSubmit, user: User
    ) -> GateTruckView:
        """QE runs the in-situ slump-cone test on a PENDING_QE delivery, then
        accepts (slump must PASS) or rejects it. Acceptance is the only path that
        credits the pour; rejection notifies the RMC."""
        dispatch = await self.repo.get_in_project(dispatch_id, project.project_id)
        if not dispatch:
            raise NotFoundError("Dispatch")
        truck = await self.trucks.get_for_dispatch(dispatch_id)
        if not truck or truck.status != TruckStatus.PENDING_QE:
            raise TruckStateError("This delivery isn't awaiting a QE in-situ check")

        target = await self._target_slump(dispatch)
        result = self._grade_slump(target, data.measured_slump_mm)
        self.session.add(
            InsituTest(
                dispatch_id=dispatch_id,
                target_slump_mm=target,
                measured_slump_mm=data.measured_slump_mm,
                result=result,
                notes=data.notes,
                tested_by=user.user_id,
            )
        )
        dispatch.slump_at_site_mm = data.measured_slump_mm

        if data.decision == ActionResolution.APPROVED:
            if result == InsituResult.FAIL:
                raise TruckStateError(
                    "The in-situ slump is outside the mix design range — this "
                    "load can't be approved. Reject it instead."
                )
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
        else:
            truck.status = TruckStatus.REJECTED
            truck.rejection_reason = (
                data.rejection_reason or "Rejected by the QE after the in-situ test"
            )
            truck.reviewed_by = user.user_id
            await self.session.flush()
            await self._notify_result(project, dispatch, truck, "REJECTED")

        await self._resolve_action_items(dispatch_id, data.decision, user)
        return await self._gate_view(project, dispatch, truck)

    # ── QE inbox ───────────────────────────────────────────────────────────────

    async def qe_inbox(self, project: Project) -> list[QEReviewItem]:
        """Deliveries awaiting the QE's in-situ sign-off (PENDING_QE)."""
        dispatches = await self.repo.list_for_project(project.project_id)
        items: list[QEReviewItem] = []
        for dispatch in dispatches:
            truck = await self.trucks.get_for_dispatch(dispatch.dispatch_id)
            if not truck or truck.status != TruckStatus.PENDING_QE:
                continue
            supplier = await self.session.get(Supplier, dispatch.supplier_id)
            grade = await self.session.get(Grade, dispatch.grade_id)
            items.append(
                QEReviewItem(
                    dispatch_id=dispatch.dispatch_id,
                    token=truck.token,
                    supplier_name=supplier.supplier_name if supplier else None,
                    grade_name=grade.grade_name if grade else None,
                    target_slump_mm=await self._target_slump(dispatch),
                    slump_at_site_mm=dispatch.slump_at_site_mm,
                    volume_cum=truck.volume_cum,
                    # The pour is recorded only after acceptance, so a delivery
                    # awaiting the QE has no pour reference yet.
                    pour_reference=None,
                    action_item=await self._open_action_item(dispatch.dispatch_id),
                    created_at=truck.arrived_at or truck.filled_at or dispatch.created_at,
                )
            )
        return items

    async def qe_inbox_count(self, project: Project) -> int:
        res = await self.session.execute(
            select(TruckDispatch.dispatch_token_id)
            .join(RMCDispatch, RMCDispatch.dispatch_id == TruckDispatch.dispatch_id)
            .where(
                RMCDispatch.project_id == project.project_id,
                TruckDispatch.status == TruckStatus.PENDING_QE,
            )
        )
        return len(res.all())

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

    async def _target_slump(self, dispatch: RMCDispatch) -> str | None:
        """The slump range from the APPROVED mix design for this delivery's
        supplier + grade — the in-situ acceptance criterion."""
        res = await self.session.execute(
            select(MixDesign.slump_range_mm)
            .where(
                MixDesign.supplier_id == dispatch.supplier_id,
                MixDesign.grade_id == dispatch.grade_id,
                MixDesign.approval_status == MixApprovalStatus.APPROVED,
            )
            .limit(1)
        )
        return res.scalar_one_or_none()

    @staticmethod
    def _parse_slump_range(text: str | None) -> tuple[float, float] | None:
        if not text:
            return None
        nums = re.findall(r"\d+(?:\.\d+)?", text)
        if len(nums) >= 2:
            return float(nums[0]), float(nums[1])
        if len(nums) == 1:
            return float(nums[0]), float(nums[0])
        return None

    @classmethod
    def _grade_slump(cls, target: str | None, measured: float) -> InsituResult:
        rng = cls._parse_slump_range(target)
        if rng is None:
            return InsituResult.PASS  # no target recorded → QE's decision stands
        lo, hi = rng
        return InsituResult.PASS if lo <= measured <= hi else InsituResult.FAIL

    async def _resolve_action_items(
        self, dispatch_id: int, decision: ActionResolution, user: User
    ) -> None:
        res = await self.session.execute(
            select(ActionItem).where(
                ActionItem.dispatch_id == dispatch_id,
                ActionItem.status == ActionItemStatus.OPEN,
            )
        )
        for item in res.scalars().all():
            item.status = ActionItemStatus.RESOLVED
            item.resolution = decision
            item.resolved_by = user.user_id
            item.resolved_at = datetime.now(UTC)
        await self.session.flush()

    async def _open_action_item(self, dispatch_id: int) -> ActionItemResponse | None:
        res = await self.session.execute(
            select(ActionItem)
            .where(
                ActionItem.dispatch_id == dispatch_id,
                ActionItem.status == ActionItemStatus.OPEN,
            )
            .order_by(ActionItem.created_at.desc())
            .limit(1)
        )
        item = res.scalar_one_or_none()
        return ActionItemResponse.model_validate(item, from_attributes=True) if item else None

    async def _latest_insitu(self, dispatch_id: int) -> InsituTestInfo | None:
        res = await self.session.execute(
            select(InsituTest)
            .where(InsituTest.dispatch_id == dispatch_id)
            .order_by(InsituTest.tested_at.desc())
            .limit(1)
        )
        test = res.scalar_one_or_none()
        if not test:
            return None
        return InsituTestInfo(
            measured_slump_mm=float(test.measured_slump_mm),
            target_slump_mm=test.target_slump_mm,
            result=test.result,
            notes=test.notes,
            tested_at=test.tested_at,
        )

    @staticmethod
    def _expired(truck: TruckDispatch) -> bool:
        return truck.expires_at < datetime.now(UTC)

    @staticmethod
    def _transit_minutes(
        dispatch_time: datetime | None, reference: datetime
    ) -> int | None:
        """Whole minutes from dispatch to ``reference`` (arrival or now). ``None``
        when the load hasn't been dispatched yet (no batching time recorded)."""
        if dispatch_time is None:
            return None
        if dispatch_time.tzinfo is None:
            dispatch_time = dispatch_time.replace(tzinfo=UTC)
        return max(int((reference - dispatch_time).total_seconds() // 60), 0)

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
        dispatch = await self.session.get(RMCDispatch, dispatch_id)
        if not dispatch:
            return None
        return await self.session.get(Project, dispatch.project_id)

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
        reference = truck.arrived_at or datetime.now(UTC)
        return GateTruckView(
            dispatch_id=dispatch.dispatch_id,
            project_name=project.project_name,
            supplier_name=supplier.supplier_name if supplier else None,
            grade_name=grade.grade_name if grade else None,
            volume_ordered_cum=dispatch.volume_ordered_cum,
            slump_at_site_mm=dispatch.slump_at_site_mm,
            dispatch_time=dispatch.dispatch_time,
            transit_minutes=self._transit_minutes(dispatch.dispatch_time, reference),
            placement_window_minutes=PLACEMENT_WINDOW_MINUTES,
            target_slump_mm=await self._target_slump(dispatch),
            insitu=await self._latest_insitu(dispatch.dispatch_id),
            truck=self._truck_info(truck),
        )
