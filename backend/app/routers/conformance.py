"""conformance.py router — Conformance Analyser defect findings.

Project-scoped under /projects/{id}/conformance. Any project member may read the
findings; only the QE / PM may classify (upsert) or delete one. Photos themselves
are uploaded through the documents router (tagged CONFORMANCE_POST / _RCC).
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project, require_project_role
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.conformance import ConformanceFindingResponse, ConformanceFindingUpsert
from app.services.conformance_service import ConformanceService

router = APIRouter(prefix="/projects", tags=["conformance"])

_QE_OR_PM = require_project_role(ProjectRole.QUALITY_ENGINEER, ProjectRole.PROJECT_MANAGER)


@router.get("/{project_id}/conformance/findings", response_model=list[ConformanceFindingResponse])
async def list_findings(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await ConformanceService(db).list_for_project(project)


@router.put("/{project_id}/conformance/findings", response_model=ConformanceFindingResponse)
async def upsert_finding(
    data: ConformanceFindingUpsert,
    project: Project = Depends(_QE_OR_PM),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Classify a conformance photo (creates or replaces its finding)."""
    return await ConformanceService(db).upsert(project, data, current_user)


@router.delete(
    "/{project_id}/conformance/findings/{finding_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_finding(
    finding_id: int,
    project: Project = Depends(_QE_OR_PM),
    db: AsyncSession = Depends(get_db),
):
    await ConformanceService(db).delete(project, finding_id)
