"""alerts.py router — IS-456/10262 quality alert feed for the QE + project manager.

Alerts are raised automatically when a 28-day cube result fails the individual
criterion or drags the moving average below the acceptance floor. The QE/PM read
the feed (a bell count + list) and acknowledge each.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project_role
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.alert import AlertCount, AlertResponse
from app.services.alert_service import AlertService

router = APIRouter(prefix="/projects", tags=["alerts"])


@router.get("/{project_id}/alerts", response_model=list[AlertResponse])
async def list_alerts(
    project: Project = Depends(
        require_project_role(ProjectRole.QUALITY_ENGINEER, ProjectRole.PROJECT_MANAGER)
    ),
    db: AsyncSession = Depends(get_db),
):
    return await AlertService(db).list_open(project)


@router.get("/{project_id}/alerts/count", response_model=AlertCount)
async def alerts_count(
    project: Project = Depends(
        require_project_role(ProjectRole.QUALITY_ENGINEER, ProjectRole.PROJECT_MANAGER)
    ),
    db: AsyncSession = Depends(get_db),
):
    return AlertCount(count=await AlertService(db).count_open(project))


@router.post("/{project_id}/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    project: Project = Depends(
        require_project_role(ProjectRole.QUALITY_ENGINEER, ProjectRole.PROJECT_MANAGER)
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await AlertService(db).acknowledge(project, alert_id, current_user)
