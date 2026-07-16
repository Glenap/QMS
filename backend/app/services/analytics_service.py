"""analytics_service.py — Phase 6 metrics layer (the single chokepoint).

Every aggregation the app shows goes through this service: one method per
metric bundle. Today each method runs a live ``GROUP BY`` against the
transactional tables (project-scoped, indexed). The deliberate seam: when
volumes demand it, only the *insides* of these methods change to read pre-
aggregated rollup tables — the method signatures, the response DTOs, the
routers, the frontend, and the future AI query layer all stay the same.

Rule of the house: no router or page writes its own aggregation SQL. It asks
the metrics service. That keeps the numbers consistent and the seam intact.

All metrics are scoped to a single project. Facts reach the project either
directly (``Pour.project_id``) or through their pour:

    cube_test → cube_sample → pour            (quality)
    ncr       → pour                          (NCRs)
    truck     → rmc_dispatch → link → pour    (dispatch / gate)
"""

import math
from datetime import date
from statistics import mean, pstdev

from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core import quality_engine
from app.models.master import (
    Grade,
    MixApprovalStatus,
    MixDesign,
    Project,
    Supplier,
    Tower,
)
from app.models.quality import NCR, CubeTest, NCRStatus, ResultStatus
from app.models.transaction import (
    CubeSample,
    Pour,
    RMCDispatch,
    TruckDispatch,
    TruckStatus,
)
from app.schemas.analytics import (
    AgePoint,
    CurvePoint,
    DistributionCurve,
    GradeTrendPoint,
    OverviewKpis,
    QualityAnalytics,
    ResultBreakdown,
    RunChart,
    RunPoint,
    StrengthAgeChart,
    StrengthBucket,
    SupplierNcrCount,
    SupplierScore,
    TargetMeanChart,
    TargetMeanRow,
)

# Below this many results we fall back to the IS-10262 assumed σ rather than a
# noisy computed one.
_MIN_SAMPLES_FOR_STDEV = 30

# Strength-distribution buckets (MPa), in display order.
_BUCKET_ORDER = ["<35", "35-40", "40-45", "45-50", "50-55", "55+"]


def _pct(numerator: int, denominator: int) -> float | None:
    """Percentage, or None when there's nothing to divide by."""
    if not denominator:
        return None
    return round(numerator / denominator * 100, 1)


def _passes(col) -> object:
    """SUM(1) over PASS rows — used for pass-rate numerators."""
    return func.sum(case((col == ResultStatus.PASS, 1), else_=0))


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Public metric bundles ────────────────────────────────────────────────

    async def overview(self, project: Project) -> OverviewKpis:
        pid = project.project_id
        kpis = OverviewKpis()
        await self._pour_kpis(pid, kpis)
        await self._quality_kpis(pid, kpis)
        await self._ncr_kpis(pid, kpis)
        await self._dispatch_kpis(pid, kpis)
        return kpis

    async def quality(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        supplier_id: int | None = None,
        tower_id: int | None = None,
    ) -> QualityAnalytics:
        # Acceptance basis: one definitive result per cube sample (its final test).
        conds = [
            Pour.project_id == project.project_id,
            self._final_test_cond(),
            *self._dim_conds(
                CubeTest.test_date,
                date_from=date_from,
                date_to=date_to,
                grade_id=grade_id,
                supplier_id=supplier_id,
                tower_id=tower_id,
            ),
        ]

        return QualityAnalytics(
            grade_trend=await self._grade_trend(conds),
            strength_distribution=await self._strength_distribution(conds),
            result_breakdown=await self._result_breakdown(conds),
        )

    async def suppliers(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        tower_id: int | None = None,
        contractor_id: int | None = None,
    ) -> list[SupplierScore]:
        pid = project.project_id
        # Pour-side filters apply to the pour's own date; quality-side to the
        # test date — each metric is filtered by the date it actually has.
        pour_conds = self._dim_conds(
            Pour.pour_date, date_from=date_from, date_to=date_to,
            grade_id=grade_id, tower_id=tower_id, contractor_id=contractor_id,
        )
        test_conds = self._dim_conds(
            CubeTest.test_date, date_from=date_from, date_to=date_to,
            grade_id=grade_id, tower_id=tower_id, contractor_id=contractor_id,
        )
        # Pour-side aggregates (count + volume) keyed by supplier.
        pour_rows = (
            await self.session.execute(
                select(
                    Pour.supplier_horizontal_id,
                    Supplier.supplier_name,
                    func.count(Pour.pour_id),
                    func.coalesce(func.sum(Pour.volume_cum), 0),
                )
                .join(Supplier, Supplier.supplier_id == Pour.supplier_horizontal_id)
                .where(Pour.project_id == pid, *pour_conds)
                .group_by(Pour.supplier_horizontal_id, Supplier.supplier_name)
            )
        ).all()
        scores: dict[int, SupplierScore] = {
            sid: SupplierScore(
                supplier_id=sid,
                supplier_name=name,
                pour_count=pours,
                pour_volume_cum=float(vol),
            )
            for sid, name, pours, vol in pour_rows
        }

        # Quality aggregates (tests / pass / avg strength) keyed by supplier.
        test_rows = (
            await self.session.execute(
                self._ct_join(
                    Pour.supplier_horizontal_id,
                    func.count(CubeTest.test_id),
                    _passes(CubeTest.result_status),
                    func.avg(CubeTest.observed_strength_mpa),
                )
                .where(Pour.project_id == pid, self._final_test_cond(), *test_conds)
                .group_by(Pour.supplier_horizontal_id)
            )
        ).all()
        for sid, tests, passes, avg in test_rows:
            score = scores.get(sid)
            if score is None:
                continue
            score.test_count = tests
            score.pass_count = int(passes or 0)
            score.pass_rate_pct = _pct(int(passes or 0), tests)
            score.avg_strength_mpa = round(float(avg), 2) if avg is not None else None

        return sorted(scores.values(), key=lambda s: s.supplier_name)

    async def ncrs_by_supplier(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        tower_id: int | None = None,
        contractor_id: int | None = None,
    ) -> list[SupplierNcrCount]:
        """NCRs grouped by the RMC supplier of the failing pour, split by status
        (open vs closed) and severity (critical = triggering test was CRITICAL)."""
        pid = project.project_id
        conds = self._dim_conds(
            CubeTest.test_date, date_from=date_from, date_to=date_to,
            grade_id=grade_id, tower_id=tower_id, contractor_id=contractor_id,
        )
        rows = (
            await self.session.execute(
                select(
                    Pour.supplier_horizontal_id,
                    Supplier.supplier_name,
                    func.count(NCR.ncr_id),
                    func.sum(case((NCR.status == NCRStatus.CLOSED, 1), else_=0)),
                    func.sum(case((NCR.status != NCRStatus.CLOSED, 1), else_=0)),
                    func.sum(
                        case(
                            (CubeTest.result_status == ResultStatus.CRITICAL_FAILURE, 1),
                            else_=0,
                        )
                    ),
                )
                .select_from(NCR)
                .join(Pour, Pour.pour_id == NCR.pour_id)
                .join(Supplier, Supplier.supplier_id == Pour.supplier_horizontal_id)
                .join(CubeTest, CubeTest.test_id == NCR.test_id)
                .where(Pour.project_id == pid, *conds)
                .group_by(Pour.supplier_horizontal_id, Supplier.supplier_name)
            )
        ).all()
        return [
            SupplierNcrCount(
                supplier_id=sid,
                supplier_name=name,
                total=int(total or 0),
                closed_count=int(closed or 0),
                open_count=int(open_ or 0),
                critical_count=int(crit or 0),
            )
            for sid, name, total, closed, open_, crit in rows
        ]

    # ── Phase 5B: IS-456 / IS-10262 statistical charts (filter-driven) ────────

    async def run_chart(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        tower_id: int | None = None,
        contractor_id: int | None = None,
    ) -> RunChart:
        """Chronological individual (final-age) results + IS-456 control lines.
        Control lines are populated only when a single grade is filtered."""
        conds = [
            Pour.project_id == project.project_id,
            self._final_test_cond(),
            *self._dim_conds(
                CubeTest.test_date, date_from=date_from, date_to=date_to,
                grade_id=grade_id, tower_id=tower_id, contractor_id=contractor_id,
            ),
        ]
        rows = (
            await self.session.execute(
                self._ct_join(
                    CubeTest.test_date,
                    CubeTest.observed_strength_mpa,
                    Grade.grade_name,
                    Tower.tower_name,
                    Pour.pour_reference,
                )
                .join(Grade, Grade.grade_id == Pour.grade_id)
                .join(Tower, Tower.tower_id == Pour.tower_id)
                .where(*conds)
                .order_by(CubeTest.test_date, CubeTest.test_id)
            )
        ).all()
        points = [
            RunPoint(
                test_date=d.isoformat(), observed_mpa=float(o),
                grade_name=g, tower_name=t, reference=r,
            )
            for d, o, g, t, r in rows
        ]
        chart = RunChart(points=points)
        grade = await self.session.get(Grade, grade_id) if grade_id else None
        if grade:
            observed = [p.observed_mpa for p in points]
            fck = float(grade.min_strength_mpa)
            sigma = self._sigma(observed)
            chart.grade_name = grade.grade_name
            chart.fck = fck
            chart.individual_min = round(fck - 3, 2)
            chart.target_mean = await self._target_for_grade(
                project.project_id, grade_id, fck, sigma
            )
            chart.mean = round(mean(observed), 2) if observed else None
        return chart

    async def distribution(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        tower_id: int | None = None,
        contractor_id: int | None = None,
    ) -> DistributionCurve:
        """Normal distribution (mean + σ recomputed on the filtered set)."""
        conds = [
            Pour.project_id == project.project_id,
            self._final_test_cond(),
            *self._dim_conds(
                CubeTest.test_date, date_from=date_from, date_to=date_to,
                grade_id=grade_id, tower_id=tower_id, contractor_id=contractor_id,
            ),
        ]
        observed = [
            float(x)
            for x in (
                await self.session.execute(
                    self._ct_join(CubeTest.observed_strength_mpa).where(*conds)
                )
            ).scalars().all()
        ]
        curve = DistributionCurve(sample_count=len(observed))
        grade = await self.session.get(Grade, grade_id) if grade_id else None
        if grade:
            curve.fck = float(grade.min_strength_mpa)
        if len(observed) >= 2:
            mu, sigma = mean(observed), pstdev(observed)
            curve.mean, curve.std_dev = round(mu, 2), round(sigma, 2)
            if sigma > 0:
                lo, hi = mu - 4 * sigma, mu + 4 * sigma
                step = (hi - lo) / 40
                curve.curve = [
                    CurvePoint(
                        x=round(lo + i * step, 2),
                        y=round(
                            math.exp(-(((lo + i * step) - mu) ** 2) / (2 * sigma * sigma))
                            / (sigma * math.sqrt(2 * math.pi)),
                            6,
                        ),
                    )
                    for i in range(41)
                ]
        curve.histogram = await self._strength_distribution(conds)
        return curve

    async def target_mean_bar(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        tower_id: int | None = None,
    ) -> TargetMeanChart:
        """Per grade: IS-10262 target mean (fck+1.65σ) vs the actual site average."""
        conds = [
            Pour.project_id == project.project_id,
            self._final_test_cond(),
            *self._dim_conds(
                CubeTest.test_date, date_from=date_from, date_to=date_to, tower_id=tower_id
            ),
        ]
        rows = (
            await self.session.execute(
                self._ct_join(
                    Pour.grade_id,
                    Grade.grade_name,
                    Grade.min_strength_mpa,
                    CubeTest.observed_strength_mpa,
                )
                .join(Grade, Grade.grade_id == Pour.grade_id)
                .where(*conds)
            )
        ).all()
        by_grade: dict = {}
        for gid, gname, fck, obs in rows:
            entry = by_grade.setdefault(gid, {"name": gname, "fck": float(fck), "obs": []})
            entry["obs"].append(float(obs))
        out: list[TargetMeanRow] = []
        for gid, d in sorted(by_grade.items(), key=lambda kv: kv[1]["fck"]):
            # Target = the RMC's stated design target (mix design), else IS-10262.
            target = await self._target_for_grade(
                project.project_id, gid, d["fck"], self._sigma(d["obs"])
            )
            out.append(
                TargetMeanRow(
                    grade_name=d["name"],
                    fck=d["fck"],
                    target_mean=target,
                    actual_mean=round(mean(d["obs"]), 2) if d["obs"] else None,
                    sample_count=len(d["obs"]),
                )
            )
        return TargetMeanChart(rows=out)

    async def strength_vs_age(
        self,
        project: Project,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        tower_id: int | None = None,
        component_id: int | None = None,
        sample_id: int | None = None,
    ) -> StrengthAgeChart:
        """3/7/28-day results for a specific batch (cube sample) or pour/element —
        all ages, not just the final. A ``sample_id`` pins one batch by the exact
        reference the lab tested against."""
        conds = [
            Pour.project_id == project.project_id,
            *self._dim_conds(
                Pour.pour_date, date_from=date_from, date_to=date_to,
                grade_id=grade_id, tower_id=tower_id,
            ),
        ]
        if component_id is not None:
            conds.append(Pour.component_id == component_id)
        if sample_id is not None:
            conds.append(CubeTest.sample_id == sample_id)
        rows = (
            await self.session.execute(
                self._ct_join(
                    CubeTest.test_age_days,
                    CubeTest.observed_strength_mpa,
                    CubeTest.required_strength_mpa,
                    Grade.grade_name,
                    CubeSample.sample_reference,
                )
                .join(Grade, Grade.grade_id == Pour.grade_id)
                .where(*conds)
                .order_by(CubeTest.test_age_days, CubeTest.test_id)
            )
        ).all()
        points = [
            AgePoint(
                test_age_days=a,
                observed_mpa=float(o),
                required_mpa=float(r) if r is not None else None,
            )
            for a, o, r, _g, _ref in rows
        ]
        return StrengthAgeChart(
            points=points,
            grade_name=rows[0][3] if rows else None,
            reference=rows[0][4] if rows else None,
        )

    @staticmethod
    def _sigma(observed: list[float]) -> float | None:
        """Computed σ once there's enough data; else None → IS-10262 assumed σ."""
        return pstdev(observed) if len(observed) >= _MIN_SAMPLES_FOR_STDEV else None

    async def _mix_target_mean(self, project_id: int, grade_id: int) -> float | None:
        """The RMC's design target mean strength for a grade, from an approved
        mix design (the RMC states it on the mix-design form)."""
        val = (
            await self.session.execute(
                select(func.max(MixDesign.target_mean_strength_mpa)).where(
                    MixDesign.project_id == project_id,
                    MixDesign.grade_id == grade_id,
                    MixDesign.approval_status == MixApprovalStatus.APPROVED,
                    MixDesign.target_mean_strength_mpa.isnot(None),
                )
            )
        ).scalar_one_or_none()
        return float(val) if val is not None else None

    async def _target_for_grade(
        self, project_id: int, grade_id: int, fck: float, sigma: float | None
    ) -> float:
        """Prefer the RMC's stated target mean; fall back to IS-10262 fck+1.65σ."""
        mix = await self._mix_target_mean(project_id, grade_id)
        return mix if mix is not None else quality_engine.target_mean_strength(fck, sigma)

    # ── Overview helpers ─────────────────────────────────────────────────────

    async def _pour_kpis(self, pid: int, kpis: OverviewKpis) -> None:
        count, volume = (
            await self.session.execute(
                select(
                    func.count(Pour.pour_id),
                    func.coalesce(func.sum(Pour.volume_cum), 0),
                ).where(Pour.project_id == pid)
            )
        ).one()
        kpis.pour_count = count
        kpis.pour_volume_cum = float(volume)

    async def _quality_kpis(self, pid: int, kpis: OverviewKpis) -> None:
        total, passes, fails, criticals, avg = (
            await self.session.execute(
                self._ct_join(
                    func.count(CubeTest.test_id),
                    _passes(CubeTest.result_status),
                    func.sum(case((CubeTest.result_status == ResultStatus.FAIL, 1), else_=0)),
                    func.sum(
                        case((CubeTest.result_status == ResultStatus.CRITICAL_FAILURE, 1), else_=0)
                    ),
                    func.avg(CubeTest.observed_strength_mpa),
                ).where(Pour.project_id == pid, self._final_test_cond())
            )
        ).one()
        kpis.test_count = total or 0
        kpis.pass_count = int(passes or 0)
        kpis.fail_count = int(fails or 0)
        kpis.critical_count = int(criticals or 0)
        kpis.pass_rate_pct = _pct(kpis.pass_count, kpis.test_count)
        kpis.avg_strength_mpa = round(float(avg), 2) if avg is not None else None

    async def _ncr_kpis(self, pid: int, kpis: OverviewKpis) -> None:
        status_rows = (
            await self.session.execute(
                select(NCR.status, func.count(NCR.ncr_id))
                .join(Pour, Pour.pour_id == NCR.pour_id)
                .where(Pour.project_id == pid)
                .group_by(NCR.status)
            )
        ).all()
        by_status = {status: count for status, count in status_rows}
        kpis.ncr_open = by_status.get(NCRStatus.OPEN, 0)
        kpis.ncr_under_review = by_status.get(NCRStatus.UNDER_REVIEW, 0)
        kpis.ncr_closed = by_status.get(NCRStatus.CLOSED, 0)

        avg_days = (
            await self.session.execute(
                select(
                    func.avg(
                        func.extract("epoch", NCR.closed_at - NCR.raised_at) / 86400.0
                    )
                )
                .join(Pour, Pour.pour_id == NCR.pour_id)
                .where(Pour.project_id == pid, NCR.closed_at.isnot(None))
            )
        ).scalar()
        kpis.avg_days_to_close = round(float(avg_days), 1) if avg_days is not None else None

    async def _dispatch_kpis(self, pid: int, kpis: OverviewKpis) -> None:
        rows = (
            await self.session.execute(
                select(
                    TruckDispatch.status,
                    func.count(distinct(TruckDispatch.dispatch_token_id)),
                )
                .join(
                    RMCDispatch,
                    RMCDispatch.dispatch_id == TruckDispatch.dispatch_id,
                )
                .where(RMCDispatch.project_id == pid)
                .group_by(TruckDispatch.status)
            )
        ).all()
        by_status = {status: count for status, count in rows}
        kpis.truck_accepted = by_status.get(TruckStatus.ACCEPTED, 0)
        kpis.truck_rejected = by_status.get(TruckStatus.REJECTED, 0)
        kpis.truck_total = sum(by_status.values())
        # Acceptance rate = of the trucks the gate actually decided on.
        kpis.acceptance_pct = _pct(
            kpis.truck_accepted, kpis.truck_accepted + kpis.truck_rejected
        )

    # ── Quality-analytics helpers ────────────────────────────────────────────

    async def _grade_trend(self, conds: list) -> list[GradeTrendPoint]:
        period = func.to_char(CubeTest.test_date, "YYYY-MM")
        rows = (
            await self.session.execute(
                self._ct_join(
                    period.label("period"),
                    Grade.grade_name,
                    func.count(CubeTest.test_id),
                    _passes(CubeTest.result_status),
                )
                .join(Grade, Grade.grade_id == Pour.grade_id)
                .where(*conds)
                .group_by(period, Grade.grade_name)
                .order_by(period, Grade.grade_name)
            )
        ).all()
        return [
            GradeTrendPoint(
                period=p,
                grade_name=name,
                test_count=tests,
                pass_count=int(passes or 0),
                pass_rate_pct=_pct(int(passes or 0), tests),
            )
            for p, name, tests, passes in rows
        ]

    async def _strength_distribution(self, conds: list) -> list[StrengthBucket]:
        bucket = case(
            (CubeTest.observed_strength_mpa < 35, "<35"),
            (CubeTest.observed_strength_mpa < 40, "35-40"),
            (CubeTest.observed_strength_mpa < 45, "40-45"),
            (CubeTest.observed_strength_mpa < 50, "45-50"),
            (CubeTest.observed_strength_mpa < 55, "50-55"),
            else_="55+",
        )
        rows = (
            await self.session.execute(
                self._ct_join(bucket.label("bucket"), func.count(CubeTest.test_id))
                .where(*conds)
                .group_by(bucket)
            )
        ).all()
        counts = {label: count for label, count in rows}
        return [
            StrengthBucket(label=label, count=counts[label])
            for label in _BUCKET_ORDER
            if label in counts
        ]

    async def _result_breakdown(self, conds: list) -> list[ResultBreakdown]:
        rows = (
            await self.session.execute(
                self._ct_join(CubeTest.result_status, func.count(CubeTest.test_id))
                .where(*conds)
                .group_by(CubeTest.result_status)
            )
        ).all()
        return [ResultBreakdown(status=status.value, count=count) for status, count in rows]

    # ── Filters ──────────────────────────────────────────────────────────────

    @staticmethod
    def _dim_conds(
        date_col,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        grade_id: int | None = None,
        supplier_id: int | None = None,
        tower_id: int | None = None,
        contractor_id: int | None = None,
    ) -> list:
        """The dashboard dimension filters as WHERE clauses. ``date_col`` is the
        date column this metric is filtered on (a pour's pour_date, a test's
        test_date); grade / supplier / tower always live on the pour. A
        ``contractor_id`` filters to pours whose RMC supplier that contractor
        hired (pour → supplier → contractor_org_id)."""
        conds: list = []
        if date_from is not None:
            conds.append(date_col >= date_from)
        if date_to is not None:
            conds.append(date_col <= date_to)
        if grade_id is not None:
            conds.append(Pour.grade_id == grade_id)
        if supplier_id is not None:
            conds.append(Pour.supplier_horizontal_id == supplier_id)
        if tower_id is not None:
            conds.append(Pour.tower_id == tower_id)
        if contractor_id is not None:
            conds.append(
                Pour.supplier_horizontal_id.in_(
                    select(Supplier.supplier_id).where(
                        Supplier.contractor_org_id == contractor_id
                    )
                )
            )
        return conds

    # ── Acceptance basis ─────────────────────────────────────────────────────

    def _final_test_cond(self):
        """A WHERE condition that keeps only each sample's *acceptance* result —
        its final test (highest age, e.g. the 28-day over an interim 7-day),
        tie-broken by latest date / id. Pass/fail rates count one definitive
        result per cube, not every age (an early-age FAIL doesn't sink a cube
        that passes at 28 days). Demo/most data has one test per sample, so this
        is a no-op there."""
        rn = func.row_number().over(
            partition_by=CubeTest.sample_id,
            order_by=(
                CubeTest.test_age_days.desc(),
                CubeTest.test_date.desc(),
                CubeTest.test_id.desc(),
            ),
        ).label("rn")
        ranked = select(CubeTest.test_id.label("test_id"), rn).subquery()
        final_ids = select(ranked.c.test_id).where(ranked.c.rn == 1)
        return CubeTest.test_id.in_(final_ids)

    # ── Shared join ──────────────────────────────────────────────────────────

    def _ct_join(self, *columns) -> Select:
        """Select `columns` over cube_test → cube_sample → pour. The pour carries
        the project / grade / supplier / tower dimensions every quality metric
        slices by; callers add their own GROUP BY / WHERE."""
        return (
            select(*columns)
            .select_from(CubeTest)
            .join(CubeSample, CubeSample.sample_id == CubeTest.sample_id)
            .join(Pour, Pour.pour_id == CubeSample.pour_id)
        )
