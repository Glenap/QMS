"""analytics.py router — Phase 6 read-only project analytics.

Project-scoped under /projects/{id}; any project viewer may read. All numbers
come from ``AnalyticsService`` (the single metrics chokepoint) — routers never
aggregate. Dimension filters on the quality endpoint are optional and additive.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.project_access import require_project
from app.database.session import get_db
from app.models.master import Project
from app.schemas.analytics import (
    OverviewKpis,
    QualityAnalytics,
    SupplierNcrCount,
    SupplierScore,
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
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).suppliers(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id, tower_id=tower_id
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
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).ncrs_by_supplier(
        project, date_from=date_from, date_to=date_to, grade_id=grade_id, tower_id=tower_id
    )
