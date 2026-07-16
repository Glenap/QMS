"""ncr_service.py — NCR lifecycle: review, root cause, corrective actions,
NDT/core retests, and RMC notifications.

Builds on the auto-NCR raised by cube_service when a strength test fails. An NCR
moves through a small state machine::

    OPEN ──▶ UNDER_REVIEW ──▶ CLOSED
              ▲     │            │
              └─────┴────────────┘  (reopen)

Closing requires a recorded root cause and every corrective action completed.
While an NCR is CLOSED its corrective actions and retests are frozen — reopen it
to change them (RMC notifications are an append-only audit log). NCRs are
project-scoped through their pour (NCR → Pour → project_id); responses carry
denormalised context so the dashboard renders without extra lookups.
"""

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_ncr_report_email
from app.core.exceptions import (
    NCRStateError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.storage import storage
from app.models.auth import User
from app.models.master import (
    Component,
    Document,
    Floor,
    Grade,
    Project,
    Supplier,
    TestingLab,
    Tower,
)
from app.models.quality import (
    NCR,
    ActionStatus,
    CorrectiveAction,
    CubeTest,
    NcrRmcNotification,
    NCRStatus,
    ResultStatus,
    Retest,
)
from app.models.transaction import CubeSample, Pour
from app.repositories.cube_repo import (
    CorrectiveActionRepository,
    NCRRepository,
    NcrRmcNotificationRepository,
    RetestRepository,
)
from app.schemas.lab_report import ACCEPTANCE_AGE_DAYS
from app.schemas.quality import (
    CorrectiveActionCreate,
    CorrectiveActionResponse,
    CorrectiveActionUpdate,
    NCRDetailResponse,
    NcrNotifyRmc,
    NcrPatternResponse,
    NCRResponse,
    NcrRmcNotificationResponse,
    NCRUpdate,
    RetestCreate,
    RetestResponse,
    RetestResultUpdate,
)

logger = logging.getLogger(__name__)

_PATTERN_WINDOW_DAYS = 90  # rolling window for recurring-failure detection

# Allowed NCR status transitions. Closing is gated further (root cause + actions).
_ALLOWED_TRANSITIONS: dict[NCRStatus, set[NCRStatus]] = {
    NCRStatus.OPEN: {NCRStatus.UNDER_REVIEW},
    NCRStatus.UNDER_REVIEW: {NCRStatus.OPEN, NCRStatus.CLOSED},
    NCRStatus.CLOSED: {NCRStatus.UNDER_REVIEW},
}


def _group_by_ncr(items: list) -> dict[int, list]:
    """Bucket corrective actions / retests by their ncr_id in one pass."""
    grouped: dict[int, list] = {}
    for item in items:
        grouped.setdefault(item.ncr_id, []).append(item)
    return grouped


class NCRService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ncrs = NCRRepository(session)
        self.actions = CorrectiveActionRepository(session)
        self.retests = RetestRepository(session)
        self.notifications = NcrRmcNotificationRepository(session)
        self._lab_names: dict[int, str | None] = {}

    # ── Reads ──────────────────────────────────────────────────────────────────

    async def list_ncrs(self, project: Project) -> list[NCRResponse]:
        ncrs = await self.ncrs.list_for_project(project.project_id)
        ids = [n.ncr_id for n in ncrs]
        actions_by = _group_by_ncr(await self.actions.list_for_ncrs(ids))
        retests_by = _group_by_ncr(await self.retests.list_for_ncrs(ids))

        # Batch-load the denormalisation context in a handful of queries rather
        # than the ~8 per-NCR session.get calls the detail path uses (avoids N+1).
        tests = await self._bulk(CubeTest, CubeTest.test_id, (n.test_id for n in ncrs))
        samples = await self._bulk(
            CubeSample, CubeSample.sample_id, (t.sample_id for t in tests.values())
        )
        pours = await self._bulk(Pour, Pour.pour_id, (n.pour_id for n in ncrs))
        towers = await self._bulk(Tower, Tower.tower_id, (p.tower_id for p in pours.values()))
        floors = await self._bulk(Floor, Floor.floor_id, (p.floor_id for p in pours.values()))
        components = await self._bulk(
            Component, Component.component_id, (p.component_id for p in pours.values())
        )
        grades = await self._bulk(Grade, Grade.grade_id, (p.grade_id for p in pours.values()))
        users = await self._bulk(User, User.user_id, (n.raised_by for n in ncrs))

        summaries: list[NCRResponse] = []
        for n in ncrs:
            test = tests.get(n.test_id)
            sample = samples.get(test.sample_id) if test else None
            pour = pours.get(n.pour_id)
            tower = towers.get(pour.tower_id) if pour else None
            floor = floors.get(pour.floor_id) if pour else None
            component = components.get(pour.component_id) if pour else None
            grade = grades.get(pour.grade_id) if pour else None
            user = users.get(n.raised_by) if n.raised_by is not None else None
            fields = self._build_fields(
                n, test=test, sample=sample, tower=tower, floor=floor,
                component=component, grade=grade,
                raised_by_name=getattr(user, "full_name", None) if user else None,
            )
            summaries.append(
                NCRResponse(
                    **fields,
                    **self._counts(
                        actions_by.get(n.ncr_id, []), retests_by.get(n.ncr_id, [])
                    ),
                )
            )
        return summaries

    async def get_ncr(self, project: Project, ncr_id: int) -> NCRDetailResponse:
        ncr = await self._require(project, ncr_id)
        return await self._detail(ncr)

    # ── NCR lifecycle ───────────────────────────────────────────────────────────

    async def update_ncr(
        self, project: Project, ncr_id: int, data: NCRUpdate, user: User
    ) -> NCRDetailResponse:
        ncr = await self._require(project, ncr_id)

        if data.root_cause is not None:
            # A closed NCR is frozen — reopen it before amending the root cause,
            # the same rule that guards corrective actions and retests.
            self._ensure_mutable(ncr)
            ncr.root_cause = data.root_cause.strip() or None

        if data.status is not None and data.status != ncr.status:
            await self._transition(ncr, data.status)

        await self.session.flush()
        return await self._detail(ncr)

    async def _transition(self, ncr: NCR, target: NCRStatus) -> None:
        if target not in _ALLOWED_TRANSITIONS.get(ncr.status, set()):
            raise NCRStateError(
                f"Cannot move an NCR from {ncr.status.value} to {target.value}"
            )
        if target == NCRStatus.CLOSED:
            if not ncr.root_cause:
                raise NCRStateError("Record a root cause before closing this NCR")
            actions = await self.actions.list_for_ncr(ncr.ncr_id)
            if any(a.status != ActionStatus.COMPLETED for a in actions):
                raise NCRStateError(
                    "All corrective actions must be completed before closing this NCR"
                )
            ncr.closed_at = datetime.now(UTC)
        else:
            # Reopening (or any non-close move) clears the closed timestamp.
            ncr.closed_at = None
        ncr.status = target

    # ── Corrective actions ───────────────────────────────────────────────────────

    async def add_corrective_action(
        self, project: Project, ncr_id: int, data: CorrectiveActionCreate, user: User
    ) -> CorrectiveActionResponse:
        ncr = await self._require(project, ncr_id)
        self._ensure_mutable(ncr)
        await self._validate_user(data.assigned_to)
        action = await self.actions.add(
            CorrectiveAction(
                ncr_id=ncr.ncr_id,
                action_description=data.action_description,
                assigned_to=data.assigned_to,
                due_date=data.due_date,
            )
        )
        return await self._action_response(action)

    async def update_corrective_action(
        self,
        project: Project,
        ncr_id: int,
        action_id: int,
        data: CorrectiveActionUpdate,
        user: User,
    ) -> CorrectiveActionResponse:
        ncr = await self._require(project, ncr_id)
        self._ensure_mutable(ncr)
        action = await self.actions.get_in_ncr(action_id, ncr.ncr_id)
        if not action:
            raise NotFoundError("Corrective action")

        if data.action_description is not None:
            action.action_description = data.action_description
        if data.assigned_to is not None:
            await self._validate_user(data.assigned_to)
            action.assigned_to = data.assigned_to
        if data.due_date is not None:
            action.due_date = data.due_date
        if data.status is not None:
            action.status = data.status

        await self.session.flush()
        return await self._action_response(action)

    # ── Retests (IS-456 in-situ verification) ────────────────────────────────────

    async def order_retest(
        self, project: Project, ncr_id: int, data: RetestCreate, user: User
    ) -> RetestResponse:
        """Order an NDT / core retest as a corrective measure on an NCR."""
        ncr = await self._require(project, ncr_id)
        self._ensure_mutable(ncr)
        retest = await self.retests.add(
            Retest(
                ncr_id=ncr.ncr_id,
                retest_type=data.retest_type,
                notes=data.notes,
                ordered_by=user.user_id,
            )
        )
        return await self._retest_response(
            retest,
            ncr_number=ncr.ncr_number,
            grade_name=await self._ncr_grade_name(ncr),
        )

    async def record_retest_result(
        self,
        project: Project,
        ncr_id: int,
        retest_id: int,
        data: RetestResultUpdate,
        user: User,
    ) -> RetestResponse:
        ncr = await self._require(project, ncr_id)
        self._ensure_mutable(ncr)
        retest = await self.retests.get_in_ncr(retest_id, ncr.ncr_id)
        if not retest:
            raise NotFoundError("Retest")

        if data.test_date is not None:
            retest.test_date = data.test_date
        if data.observed_strength_mpa is not None:
            retest.observed_strength_mpa = data.observed_strength_mpa
        if data.required_strength_mpa is not None:
            retest.required_strength_mpa = data.required_strength_mpa
        if data.lab_id is not None:
            retest.lab_id = data.lab_id
        if data.report_document_id is not None:
            retest.report_document_id = data.report_document_id
        if data.notes is not None:
            retest.notes = data.notes
        if data.result is not None:
            retest.result = data.result
            retest.performed_by = user.user_id
            retest.completed_at = datetime.now(UTC)

        await self.session.flush()
        return await self._retest_response(
            retest,
            ncr_number=ncr.ncr_number,
            grade_name=await self._ncr_grade_name(ncr),
        )

    async def list_retests(self, project: Project) -> list[RetestResponse]:
        """Every retest across the project's NCRs — powers the Retests page."""
        retests = await self.retests.list_for_project(project.project_id)
        ncrs = await self._bulk(NCR, NCR.ncr_id, (r.ncr_id for r in retests))
        pours = await self._bulk(Pour, Pour.pour_id, (n.pour_id for n in ncrs.values()))
        grades = await self._bulk(
            Grade, Grade.grade_id, (p.grade_id for p in pours.values())
        )
        out: list[RetestResponse] = []
        for r in retests:
            ncr = ncrs.get(r.ncr_id)
            pour = pours.get(ncr.pour_id) if ncr else None
            grade = grades.get(pour.grade_id) if pour else None
            out.append(
                await self._retest_response(
                    r,
                    ncr_number=ncr.ncr_number if ncr else None,
                    grade_name=grade.grade_name if grade else None,
                )
            )
        return out

    # ── RMC notification (email the plant about the NCR) ─────────────────────────

    async def notify_rmc(
        self, project: Project, ncr_id: int, data: NcrNotifyRmc, user: User
    ) -> NcrRmcNotificationResponse:
        """Email the NCR's RMC supplier a formal report (optional PDF attached)
        and log the notification. Best-effort send; the record is the audit trail."""
        ncr = await self._require(project, ncr_id)
        fields = await self._resolve_one(ncr)
        supplier = await self._ncr_supplier(ncr)
        if not supplier or not supplier.contact_email:
            raise PermissionDeniedError(
                "This NCR's RMC supplier has no contact email to send to"
            )

        subject = (data.subject or "").strip() or (
            f"NCR {ncr.ncr_number or ncr.ncr_id} raised against your supply"
        )
        message = (data.message or "").strip() or self._default_ncr_message(fields)

        attachment = None
        report_document_id = None
        if data.document_id is not None:
            doc = await self.session.get(Document, data.document_id)
            if not doc or doc.project_id != project.project_id:
                raise NotFoundError("Document")
            report_document_id = doc.document_id
            try:
                attachment = (
                    doc.original_filename,
                    storage.path_for(doc.stored_key).read_bytes(),
                )
            except OSError as exc:  # attachment unreadable — send without it
                logger.warning(
                    "NCR report attachment %s unreadable (%s).", doc.stored_key, exc
                )

        try:
            await send_ncr_report_email(
                supplier_email=supplier.contact_email,
                supplier_name=supplier.supplier_name,
                project_name=project.project_name,
                subject=subject,
                message=message,
                sender_name=user.full_name,
                ncr_number=ncr.ncr_number,
                attachment=attachment,
            )
        except Exception as exc:  # noqa: BLE001 — best-effort email
            logger.warning(
                "NCR report email to %s failed (%s).", supplier.contact_email, exc
            )

        notif = await self.notifications.add(
            NcrRmcNotification(
                ncr_id=ncr.ncr_id,
                supplier_id=supplier.supplier_id,
                subject=subject,
                message=message,
                report_document_id=report_document_id,
                sent_by=user.user_id,
            )
        )
        return await self._notification_response(
            notif, supplier_name=supplier.supplier_name
        )

    # ── AI pattern insight (deterministic, cross-NCR) ────────────────────────────

    async def ncr_pattern(self, project: Project, ncr_id: int) -> NcrPatternResponse:
        """Recurring-failure signal for this NCR's RMC + grade over a 90-day
        window — pure SQL over the project's NCRs / 28-day results, no LLM."""
        ncr = await self._require(project, ncr_id)
        pour = await self.session.get(Pour, ncr.pour_id)
        supplier = await self._ncr_supplier(ncr)
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        since = date.today() - timedelta(days=_PATTERN_WINDOW_DAYS)
        pid = project.project_id

        supplier_ncr_count = 0
        supplier_grade_ncr_count = 0
        recurring_low = 0
        if supplier is not None:
            ncr_q = (
                select(func.count(NCR.ncr_id))
                .join(Pour, Pour.pour_id == NCR.pour_id)
                .where(
                    Pour.project_id == pid,
                    Pour.supplier_horizontal_id == supplier.supplier_id,
                    NCR.raised_at >= since,
                )
            )
            supplier_ncr_count = (
                await self.session.execute(ncr_q)
            ).scalar_one()
            if grade is not None:
                supplier_grade_ncr_count = (
                    await self.session.execute(
                        ncr_q.where(Pour.grade_id == grade.grade_id)
                    )
                ).scalar_one()
            recurring_low = (
                await self.session.execute(
                    select(func.count(CubeTest.test_id))
                    .join(CubeSample, CubeSample.sample_id == CubeTest.sample_id)
                    .join(Pour, Pour.pour_id == CubeSample.pour_id)
                    .where(
                        Pour.project_id == pid,
                        Pour.supplier_horizontal_id == supplier.supplier_id,
                        CubeTest.test_age_days == ACCEPTANCE_AGE_DAYS,
                        CubeTest.result_status.in_(
                            [ResultStatus.FAIL, ResultStatus.CRITICAL_FAILURE]
                        ),
                        CubeTest.test_date >= since,
                    )
                )
            ).scalar_one()

        return NcrPatternResponse(
            supplier_name=supplier.supplier_name if supplier else None,
            grade_name=grade.grade_name if grade else None,
            window_days=_PATTERN_WINDOW_DAYS,
            supplier_grade_ncr_count=supplier_grade_ncr_count,
            supplier_ncr_count=supplier_ncr_count,
            recurring_low_28d_count=recurring_low,
            summary=self._pattern_summary(
                supplier, grade, supplier_grade_ncr_count,
                supplier_ncr_count, recurring_low,
            ),
        )

    # ── Internals ────────────────────────────────────────────────────────────────

    async def _require(self, project: Project, ncr_id: int) -> NCR:
        ncr = await self.ncrs.get_in_project(ncr_id, project.project_id)
        if not ncr:
            raise NotFoundError("NCR")
        return ncr

    @staticmethod
    def _ensure_mutable(ncr: NCR) -> None:
        """A CLOSED NCR is frozen — root cause, corrective actions and retests
        can only change after it is reopened."""
        if ncr.status == NCRStatus.CLOSED:
            raise NCRStateError("Reopen this NCR before modifying it")

    async def _validate_user(self, user_id: int | None) -> None:
        if user_id is None:
            return
        if not await self.session.get(User, user_id):
            raise NotFoundError("User")

    async def _user_name(self, user_id: int | None) -> str | None:
        if user_id is None:
            return None
        u = await self.session.get(User, user_id)
        return getattr(u, "full_name", None) if u else None

    async def _bulk(self, model, pk_col, ids) -> dict:
        """Load `model` rows for the given ids in one query, keyed by primary key.
        Powers the list path's batch denormalisation (vs per-row session.get)."""
        wanted = {i for i in ids if i is not None}
        if not wanted:
            return {}
        rows = (
            await self.session.execute(select(model).where(pk_col.in_(wanted)))
        ).scalars().all()
        key = pk_col.key
        return {getattr(r, key): r for r in rows}

    async def _resolve_one(self, ncr: NCR) -> dict:
        """Denormalised fields for a single NCR via one-off lookups — fine for
        the detail endpoint; the list endpoint batch-loads instead (see _bulk)."""
        test = await self.session.get(CubeTest, ncr.test_id)
        sample = await self.session.get(CubeSample, test.sample_id) if test else None
        pour = await self.session.get(Pour, ncr.pour_id)
        tower = await self.session.get(Tower, pour.tower_id) if pour else None
        floor = await self.session.get(Floor, pour.floor_id) if pour else None
        component = await self.session.get(Component, pour.component_id) if pour else None
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        return self._build_fields(
            ncr, test=test, sample=sample, tower=tower, floor=floor,
            component=component, grade=grade,
            raised_by_name=await self._user_name(ncr.raised_by),
        )

    @staticmethod
    def _build_fields(
        ncr: NCR, *, test, sample, tower, floor, component, grade, raised_by_name
    ) -> dict:
        """Assemble the denormalised NCRResponse fields from already-loaded rows
        (pure — no I/O), shared by the single and batch paths."""
        return dict(
            ncr_id=ncr.ncr_id,
            ncr_number=ncr.ncr_number,
            test_id=ncr.test_id,
            pour_id=ncr.pour_id,
            status=ncr.status,
            root_cause=ncr.root_cause,
            raised_by=ncr.raised_by,
            raised_by_name=raised_by_name,
            raised_at=ncr.raised_at,
            closed_at=ncr.closed_at,
            result_status=test.result_status if test else None,
            observed_strength_mpa=test.observed_strength_mpa if test else None,
            required_strength_mpa=test.required_strength_mpa if test else None,
            test_age_days=test.test_age_days if test else None,
            sample_reference=sample.sample_reference if sample else None,
            grade_name=grade.grade_name if grade else None,
            tower_name=tower.tower_name if tower else None,
            floor_label=floor.floor_label if floor else None,
            component_type=component.component_type.value if component else None,
        )

    @staticmethod
    def _counts(actions: list[CorrectiveAction], retests: list[Retest]) -> dict:
        return dict(
            corrective_action_count=len(actions),
            open_action_count=sum(
                1 for a in actions if a.status != ActionStatus.COMPLETED
            ),
            retest_count=len(retests),
            open_retest_count=sum(1 for r in retests if r.result is None),
        )

    async def _detail(self, ncr: NCR) -> NCRDetailResponse:
        actions = await self.actions.list_for_ncr(ncr.ncr_id)
        retests = await self.retests.list_for_ncr(ncr.ncr_id)
        notifications = await self.notifications.list_for_ncr(ncr.ncr_id)
        grade_name = await self._ncr_grade_name(ncr)
        supplier = await self._ncr_supplier(ncr)
        supplier_name = supplier.supplier_name if supplier else None
        return NCRDetailResponse(
            **await self._resolve_one(ncr),
            **self._counts(actions, retests),
            corrective_actions=[await self._action_response(a) for a in actions],
            retests=[
                await self._retest_response(
                    r, ncr_number=ncr.ncr_number, grade_name=grade_name
                )
                for r in retests
            ],
            rmc_notifications=[
                await self._notification_response(nf, supplier_name=supplier_name)
                for nf in notifications
            ],
        )

    async def _action_response(
        self, action: CorrectiveAction
    ) -> CorrectiveActionResponse:
        return CorrectiveActionResponse(
            action_id=action.action_id,
            ncr_id=action.ncr_id,
            action_description=action.action_description,
            assigned_to=action.assigned_to,
            assigned_to_name=await self._user_name(action.assigned_to),
            due_date=action.due_date,
            status=action.status,
            created_at=action.created_at,
        )

    async def _retest_response(
        self,
        retest: Retest,
        *,
        ncr_number: str | None = None,
        grade_name: str | None = None,
    ) -> RetestResponse:
        return RetestResponse(
            retest_id=retest.retest_id,
            ncr_id=retest.ncr_id,
            retest_type=retest.retest_type,
            result=retest.result,
            test_date=retest.test_date,
            observed_strength_mpa=(
                float(retest.observed_strength_mpa)
                if retest.observed_strength_mpa is not None
                else None
            ),
            required_strength_mpa=(
                float(retest.required_strength_mpa)
                if retest.required_strength_mpa is not None
                else None
            ),
            lab_id=retest.lab_id,
            lab_name=await self._lab_name(retest.lab_id),
            report_document_id=retest.report_document_id,
            notes=retest.notes,
            ordered_by=retest.ordered_by,
            ordered_by_name=await self._user_name(retest.ordered_by),
            created_at=retest.created_at,
            completed_at=retest.completed_at,
            ncr_number=ncr_number,
            grade_name=grade_name,
        )

    async def _notification_response(
        self, notif: NcrRmcNotification, *, supplier_name: str | None = None
    ) -> NcrRmcNotificationResponse:
        return NcrRmcNotificationResponse(
            notification_id=notif.notification_id,
            ncr_id=notif.ncr_id,
            supplier_id=notif.supplier_id,
            supplier_name=supplier_name,
            subject=notif.subject,
            message=notif.message,
            report_document_id=notif.report_document_id,
            sent_by=notif.sent_by,
            sent_by_name=await self._user_name(notif.sent_by),
            sent_at=notif.sent_at,
        )

    async def _lab_name(self, lab_id: int | None) -> str | None:
        if lab_id is None:
            return None
        if lab_id not in self._lab_names:
            lab = await self.session.get(TestingLab, lab_id)
            self._lab_names[lab_id] = lab.lab_name if lab else None
        return self._lab_names[lab_id]

    async def _ncr_supplier(self, ncr: NCR) -> Supplier | None:
        """The RMC supplier behind an NCR (NCR → Pour → supplier)."""
        pour = await self.session.get(Pour, ncr.pour_id)
        if not pour or pour.supplier_horizontal_id is None:
            return None
        return await self.session.get(Supplier, pour.supplier_horizontal_id)

    async def _ncr_grade_name(self, ncr: NCR) -> str | None:
        pour = await self.session.get(Pour, ncr.pour_id)
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        return grade.grade_name if grade else None

    @staticmethod
    def _default_ncr_message(fields: dict) -> str:
        """Auto-composed NCR notification body from the resolved context."""
        parts = [
            f"NCR {fields.get('ncr_number') or fields.get('ncr_id')} has been "
            "raised against concrete you supplied."
        ]
        if fields.get("grade_name"):
            parts.append(f"Grade: {fields['grade_name']}.")
        observed = fields.get("observed_strength_mpa")
        required = fields.get("required_strength_mpa")
        if observed is not None and required is not None:
            parts.append(
                f"The {fields.get('test_age_days') or 28}-day strength was "
                f"{observed} MPa against a required {required} MPa."
            )
        if fields.get("sample_reference"):
            parts.append(f"Sample: {fields['sample_reference']}.")
        return " ".join(parts)

    @staticmethod
    def _pattern_summary(
        supplier: Supplier | None,
        grade: Grade | None,
        sg_count: int,
        s_count: int,
        recurring_low: int,
    ) -> str:
        if supplier is None:
            return "No RMC is linked to this NCR — pattern analysis unavailable."
        name = supplier.supplier_name
        gname = grade.grade_name if grade else "this grade"
        bits: list[str] = []
        if sg_count > 1:
            bits.append(
                f"{name} has {sg_count} NCRs on {gname} in the last "
                f"{_PATTERN_WINDOW_DAYS} days"
            )
        elif s_count > 1:
            bits.append(
                f"{name} has {s_count} NCRs across grades in the last "
                f"{_PATTERN_WINDOW_DAYS} days"
            )
        if recurring_low > 1:
            bits.append(f"{recurring_low} low 28-day results from this RMC in the window")
        if not bits:
            return f"No recurring pattern — this NCR looks isolated for {name}."
        return "; ".join(bits) + "."
