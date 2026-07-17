"""analytics.py router — Phase 6 read-only project analytics.

Project-scoped under /projects/{id}; any project viewer may read. All numbers
come from ``AnalyticsService`` (the single metrics chokepoint) — routers never
aggregate. Dimension filters on the quality endpoint are optional and additive.
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.project_access import require_project
from app.database.session import get_db
from app.models.master import Project
from app.schemas.analytics import (
    Alternative,
    CusumChart,
    DistributionCurve,
    OneSampleTTest,
    OverviewKpis,
    QualityAnalytics,
    RunChart,
    StrengthAgeChart,
    SupplierNcrCount,
    SupplierScore,
    TargetMeanChart,
    TwoSampleRequest,
    TwoSampleTTest,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/projects", tags=["analytics"])


@router.get("/{project_id}/analytics/overview", response_model=OverviewKpis)
async def overview(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).overview(project)


@router.get("/{project_id}/analytics/quality", response_model=QualityAnalytics)
async def quality(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    supplier_id: int | None = None,
    tower_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).quality(
        project,
        date_from=date_from,
        date_to=date_to,
        grade_id=grade_id,
        supplier_id=supplier_id,
        tower_id=tower_id,
    )


@router.get("/{project_id}/analytics/suppliers", response_model=list[SupplierScore])
async def suppliers(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    contractor_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).suppliers(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id,
        tower_id=tower_id, contractor_id=contractor_id,
    )


@router.get(
    "/{project_id}/analytics/ncrs-by-supplier",
    response_model=list[SupplierNcrCount],
)
async def ncrs_by_supplier(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    contractor_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).ncrs_by_supplier(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id,
        tower_id=tower_id, contractor_id=contractor_id,
    )


# ── Phase 5B: the four IS-456/10262 statistical charts ───────────────────────


@router.get("/{project_id}/analytics/run-chart", response_model=RunChart)
async def run_chart(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    contractor_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).run_chart(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id,
        tower_id=tower_id, contractor_id=contractor_id,
    )


@router.get("/{project_id}/analytics/distribution", response_model=DistributionCurve)
async def distribution(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    contractor_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).distribution(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id,
        tower_id=tower_id, contractor_id=contractor_id,
    )


@router.get("/{project_id}/analytics/cusum", response_model=CusumChart)
async def cusum(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    contractor_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).cusum_chart(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id,
        tower_id=tower_id, contractor_id=contractor_id,
    )


@router.get("/{project_id}/analytics/target-mean", response_model=TargetMeanChart)
async def target_mean(
    date_from: date | None = None,
    date_to: date | None = None,
    tower_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).target_mean_bar(
        project, date_from=date_from, date_to=date_to, tower_id=tower_id
    )


@router.get("/{project_id}/analytics/strength-vs-age", response_model=StrengthAgeChart)
async def strength_vs_age(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    component_id: int | None = None,
    sample_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).strength_vs_age(
        project,
        date_from=date_from,
        date_to=date_to,
        grade_id=grade_id,
        tower_id=tower_id,
        component_id=component_id,
        sample_id=sample_id,
    )


# ── Statistical tests (Student's t) ──────────────────────────────────────────


@router.get("/{project_id}/analytics/ttest/one-sample", response_model=OneSampleTTest)
async def one_sample_ttest(
    date_from: date | None = None,
    date_to: date | None = None,
    grade_id: int | None = None,
    tower_id: int | None = None,
    supplier_id: int | None = None,
    contractor_id: int | None = None,
    basis: Literal["fck", "target", "custom"] = "fck",
    mu0: float | None = None,
    confidence: float = Query(default=0.95, gt=0.5, lt=1.0),
    alternative: Alternative = "two_sided",
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Is the selection's mean cube strength significantly above/below/different
    from a reference (fck, target mean, or a custom value)?"""
    return await AnalyticsService(db).one_sample_ttest(
        project,
        date_from=date_from,
        date_to=date_to,
        grade_id=grade_id,
        tower_id=tower_id,
        supplier_id=supplier_id,
        contractor_id=contractor_id,
        basis=basis,
        mu0=mu0,
        confidence=confidence,
        alternative=alternative,
    )


@router.post("/{project_id}/analytics/ttest/two-sample", response_model=TwoSampleTTest)
async def two_sample_ttest(
    body: TwoSampleRequest,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Do two selections' mean cube strengths differ significantly (Welch's t)?"""
    return await AnalyticsService(db).two_sample_ttest(project, body)
