"""cube_tests.py router — Phase 4 cube samples + lab-dispatched strength tests.

Project-scoped under /projects/{id}. The Quality Engineer casts cube samples
from a pour and dispatches them to a lab; the lab submits the 7/14/28-day
strength reports through a tokenised link (see routers/lab_report.py), and a
failing 28-day result auto-raises an NCR. Listing (samples, tests) is open to
anyone who can view the project. The NCR lifecycle lives in ncrs.py (Phase 5).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project, require_project_role
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.lab_report import LabReportLink
from app.schemas.quality import CubeSampleCreate, CubeSampleResponse
from app.services.cube_service import CubeService

router = APIRouter(prefix="/projects", tags=["quality"])



# ── Samples ──────────────────────────────────────────────────────────────────


@router.post(
    "/{project_id}/pours/{pour_id}/samples",
    response_model=CubeSampleResponse,
    status_code=201,
)
async def cast_sample(
    pour_id: int,
    data: CubeSampleCreate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cast a cube sample from a pour. When a lab with a contact email is set,
    this also dispatches the sample — emailing the lab its report link."""
    return await CubeService(db).create_sample(project, pour_id, data, current_user)


@router.get(
    "/{project_id}/pours/{pour_id}/samples",
    response_model=list[CubeSampleResponse],
)
async def list_pour_samples(
    pour_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await CubeService(db).list_samples_for_pour(project, pour_id)


@router.get("/{project_id}/samples", response_model=list[CubeSampleResponse])
async def list_samples(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await CubeService(db).list_samples_for_project(project)


# ── Lab report dispatch (manual resend) ───────────────────────────────────────


@router.post(
    "/{project_id}/samples/{sample_id}/report-link",
    response_model=LabReportLink,
)
async def get_report_link(
    sample_id: int,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The lab's tokenised report URL for this sample, for the QE to copy/share.
    Mints a token if the sample doesn't have one yet. Does not send email."""
    return await CubeService(db).get_report_link(project, sample_id, current_user)


@router.post(
    "/{project_id}/samples/{sample_id}/resend-report-link",
    response_model=CubeSampleResponse,
)
async def resend_report_link(
    sample_id: int,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-email the lab its report link — the manual nudge when a 7/14/28-day
    milestone is due. (No automated scheduler; the link itself is long-lived.)"""
    return await CubeService(db).resend_report_link(project, sample_id, current_user)
