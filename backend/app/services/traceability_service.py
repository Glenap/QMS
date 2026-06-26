"""traceability_service.py — Phase 6 lineage walk (kept separate from analytics).

Traceability is point lookups + bounded foreign-key traversal, not wide
aggregation — so it lives in its own service and scales on the OLTP tables with
indexes alone (no rollups). Two operations:

  search(project, q)  → find cube samples by any reference, return summaries
  trace_detail(...)   → walk one sample's full chain (pour → trucks → tests/NCR)

The search fans out across the reference columns a user might paste (sample,
pour, NCR, challan, vehicle), unions the matching sample ids, then resolves a
bounded set of summaries. Detail resolves a single sample with a handful of
one-off lookups (bounded — a sample has a few tests / trucks).
"""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.master import Component, Floor, Grade, Project, Supplier, TestingLab, Tower
from app.models.quality import NCR, CubeTest, ResultStatus
from app.models.transaction import (
    CubeSample,
    Pour,
    PourDispatchLink,
    RMCDispatch,
    TruckDispatch,
)
from app.schemas.traceability import TraceDetail, TraceRecord, TraceTest, TraceTruck

_SEARCH_LIMIT = 50

# Worst-wins ranking when a sample has several tests of differing outcome.
_STATUS_RANK = {
    ResultStatus.PENDING: 0,
    ResultStatus.PASS: 1,
    ResultStatus.FAIL: 2,
    ResultStatus.CRITICAL_FAILURE: 3,
}


class TraceabilityService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def search(self, project: Project, q: str | None) -> list[TraceRecord]:
        term = (q or "").strip()
        sample_ids = await self._matching_sample_ids(project.project_id, term)
        return await self._records(sample_ids)

    async def trace_detail(self, project: Project, sample_id: int) -> TraceDetail:
        sample = await self.session.get(CubeSample, sample_id)
        pour = await self.session.get(Pour, sample.pour_id) if sample else None
        if not sample or not pour or pour.project_id != project.project_id:
            raise NotFoundError("Trace record")

        tower = await self.session.get(Tower, pour.tower_id)
        floor = await self.session.get(Floor, pour.floor_id)
        component = await self.session.get(Component, pour.component_id)
        grade = await self.session.get(Grade, pour.grade_id)
        supplier = await self.session.get(Supplier, pour.supplier_horizontal_id)
        sample_lab = (
            await self.session.get(TestingLab, sample.lab_id) if sample.lab_id else None
        )

        return TraceDetail(
            sample_id=sample.sample_id,
            sample_reference=sample.sample_reference,
            cast_date=sample.cast_date,
            lab_name=sample_lab.lab_name if sample_lab else None,
            pour_id=pour.pour_id,
            pour_reference=pour.pour_reference,
            pour_date=pour.pour_date,
            volume_cum=pour.volume_cum,
            pour_status=pour.status.value,
            tower_name=tower.tower_name if tower else None,
            floor_label=floor.floor_label if floor else None,
            component_type=component.component_type.value if component else None,
            grade_name=grade.grade_name if grade else None,
            supplier_name=supplier.supplier_name if supplier else None,
            tests=await self._tests(sample.sample_id),
            trucks=await self._trucks(pour.pour_id),
        )

    # ── Search internals ─────────────────────────────────────────────────────

    async def _matching_sample_ids(self, pid: int, term: str) -> list[int]:
        if not term:
            # No query → the project's most recent samples, so the page isn't blank.
            rows = (
                await self.session.execute(
                    select(CubeSample.sample_id)
                    .join(Pour, Pour.pour_id == CubeSample.pour_id)
                    .where(Pour.project_id == pid)
                    .order_by(CubeSample.cast_date.desc(), CubeSample.sample_id.desc())
                    .limit(_SEARCH_LIMIT)
                )
            ).scalars().all()
            return list(rows)

        # Escape LIKE metacharacters in the user term so a literal "%" or "_"
        # matches itself instead of acting as a wildcard (e.g. "M_0" must not
        # match "M30"). The escape char is declared on each ilike() below.
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        ids: set[int] = set()

        # Sample / pour reference.
        ids.update(
            (
                await self.session.execute(
                    select(CubeSample.sample_id)
                    .join(Pour, Pour.pour_id == CubeSample.pour_id)
                    .where(
                        Pour.project_id == pid,
                        or_(
                            CubeSample.sample_reference.ilike(pattern, escape="\\"),
                            Pour.pour_reference.ilike(pattern, escape="\\"),
                        ),
                    )
                    .limit(_SEARCH_LIMIT)
                )
            ).scalars().all()
        )

        # NCR number (sample → test → ncr).
        ids.update(
            (
                await self.session.execute(
                    select(CubeSample.sample_id)
                    .join(CubeTest, CubeTest.sample_id == CubeSample.sample_id)
                    .join(NCR, NCR.test_id == CubeTest.test_id)
                    .join(Pour, Pour.pour_id == CubeSample.pour_id)
                    .where(Pour.project_id == pid, NCR.ncr_number.ilike(pattern, escape="\\"))
                    .limit(_SEARCH_LIMIT)
                )
            ).scalars().all()
        )

        # Challan / vehicle (sample → pour → link → dispatch → truck).
        ids.update(
            (
                await self.session.execute(
                    select(CubeSample.sample_id)
                    .join(Pour, Pour.pour_id == CubeSample.pour_id)
                    .join(PourDispatchLink, PourDispatchLink.pour_id == Pour.pour_id)
                    .join(
                        TruckDispatch,
                        TruckDispatch.dispatch_id == PourDispatchLink.dispatch_id,
                    )
                    .where(
                        Pour.project_id == pid,
                        or_(
                            TruckDispatch.challan_number.ilike(pattern, escape="\\"),
                            TruckDispatch.vehicle_number.ilike(pattern, escape="\\"),
                        ),
                    )
                    .limit(_SEARCH_LIMIT)
                )
            ).scalars().all()
        )

        return list(ids)[:_SEARCH_LIMIT]

    async def _records(self, sample_ids: list[int]) -> list[TraceRecord]:
        if not sample_ids:
            return []

        rows = (
            await self.session.execute(
                select(
                    CubeSample.sample_id,
                    CubeSample.sample_reference,
                    CubeSample.cast_date,
                    Pour.pour_id,
                    Pour.pour_reference,
                    Tower.tower_name,
                    Floor.floor_label,
                    Component.component_type,
                    Grade.grade_name,
                    Supplier.supplier_name,
                )
                .join(Pour, Pour.pour_id == CubeSample.pour_id)
                .join(Tower, Tower.tower_id == Pour.tower_id)
                .join(Floor, Floor.floor_id == Pour.floor_id)
                .join(Component, Component.component_id == Pour.component_id)
                .join(Grade, Grade.grade_id == Pour.grade_id)
                .join(Supplier, Supplier.supplier_id == Pour.supplier_horizontal_id)
                .where(CubeSample.sample_id.in_(sample_ids))
                .order_by(CubeSample.cast_date.desc(), CubeSample.sample_id.desc())
            )
        ).all()

        worst, ncr_by = await self._status_by_sample(sample_ids)

        return [
            TraceRecord(
                sample_id=sid,
                sample_reference=sref,
                pour_id=pour_id,
                pour_reference=pref,
                cast_date=cast_date,
                tower_name=tname,
                floor_label=flabel,
                component_type=ctype.value if ctype else None,
                grade_name=gname,
                supplier_name=sname,
                result_status=worst.get(sid),
                ncr_number=ncr_by.get(sid),
            )
            for (sid, sref, cast_date, pour_id, pref, tname, flabel, ctype, gname, sname)
            in rows
        ]

    async def _status_by_sample(
        self, sample_ids: list[int]
    ) -> tuple[dict[int, str], dict[int, str]]:
        """Worst result + first NCR number per sample, in one pass."""
        rows = (
            await self.session.execute(
                select(CubeTest.sample_id, CubeTest.result_status, NCR.ncr_number)
                .select_from(CubeTest)
                .outerjoin(NCR, NCR.test_id == CubeTest.test_id)
                .where(CubeTest.sample_id.in_(sample_ids))
            )
        ).all()
        worst_rank: dict[int, int] = {}
        worst: dict[int, str] = {}
        ncr_by: dict[int, str] = {}
        for sid, status, ncr_number in rows:
            rank = _STATUS_RANK.get(status, 0)
            if sid not in worst_rank or rank > worst_rank[sid]:
                worst_rank[sid] = rank
                worst[sid] = status.value
            if ncr_number and sid not in ncr_by:
                ncr_by[sid] = ncr_number
        return worst, ncr_by

    # ── Detail internals ─────────────────────────────────────────────────────

    async def _tests(self, sample_id: int) -> list[TraceTest]:
        rows = (
            await self.session.execute(
                select(CubeTest, NCR.ncr_id, NCR.ncr_number)
                .outerjoin(NCR, NCR.test_id == CubeTest.test_id)
                .where(CubeTest.sample_id == sample_id)
                .order_by(CubeTest.test_age_days, CubeTest.test_id)
            )
        ).all()
        tests: list[TraceTest] = []
        for ct, ncr_id, ncr_number in rows:
            lab = await self.session.get(TestingLab, ct.lab_id) if ct.lab_id else None
            tests.append(
                TraceTest(
                    test_id=ct.test_id,
                    test_age_days=ct.test_age_days,
                    test_date=ct.test_date,
                    observed_strength_mpa=ct.observed_strength_mpa,
                    required_strength_mpa=ct.required_strength_mpa,
                    result_status=ct.result_status.value,
                    lab_name=lab.lab_name if lab else None,
                    ncr_id=ncr_id,
                    ncr_number=ncr_number,
                )
            )
        return tests

    async def _trucks(self, pour_id: int) -> list[TraceTruck]:
        rows = (
            await self.session.execute(
                select(TruckDispatch, RMCDispatch.supplier_id, RMCDispatch.grade_id)
                .join(RMCDispatch, RMCDispatch.dispatch_id == TruckDispatch.dispatch_id)
                .join(
                    PourDispatchLink,
                    PourDispatchLink.dispatch_id == RMCDispatch.dispatch_id,
                )
                .where(PourDispatchLink.pour_id == pour_id)
                .order_by(TruckDispatch.dispatch_token_id)
            )
        ).all()
        trucks: list[TraceTruck] = []
        for td, supplier_id, grade_id in rows:
            supplier = (
                await self.session.get(Supplier, supplier_id) if supplier_id else None
            )
            grade = await self.session.get(Grade, grade_id) if grade_id else None
            trucks.append(
                TraceTruck(
                    dispatch_token_id=td.dispatch_token_id,
                    vehicle_number=td.vehicle_number,
                    driver_name=td.driver_name,
                    batch_number=td.batch_number,
                    challan_number=td.challan_number,
                    volume_cum=td.volume_cum,
                    slump_at_plant_mm=td.slump_at_plant_mm,
                    status=td.status.value,
                    supplier_name=supplier.supplier_name if supplier else None,
                    grade_name=grade.grade_name if grade else None,
                )
            )
        return trucks
