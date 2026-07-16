"""projects.py router — /projects endpoints (project-scoped model).

- Create is CLIENT_ADMIN only.
- Listing is scoped: client admins see their org's projects, contractor admins
  see accepted ones, everyone else sees projects they're a member of.
- Per-project: detail (+ viewer capabilities), members, contractors.
- Contractor admins accept/decline assigned projects via /projects/assigned.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.auth import User, UserRole
from app.models.master import Project
from app.schemas.master import (
    AssignedProjectResponse,
    AvailableContractorResponse,
    ProjectContractorCreate,
    ProjectContractorResponse,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectStatusUpdate,
    TowerResponse,
)
from app.services.contractor_service import ContractorService
from app.services.membership_service import MembershipService
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(require_role(UserRole.CLIENT_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """CLIENT_ADMIN creates a project (and optional towers) for their org."""
    return await ProjectService(db).create(data, current_user)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Projects visible to the current user (role + membership scoped)."""
    return await ProjectService(db).list_visible(current_user)


# ── Contractor accept screen (declared before /{project_id}) ─────────────────

@router.get("/assigned", response_model=list[AssignedProjectResponse])
async def list_assigned_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Project links for the caller's contractor org (pending + responded)."""
    return await ContractorService(db).list_assigned_for_user(current_user)


@router.post("/assigned/{pc_id}/accept", response_model=ProjectContractorResponse)
async def accept_assigned_project(
    pc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ContractorService(db).respond(pc_id, accept=True, user=current_user)


@router.post("/assigned/{pc_id}/decline", response_model=ProjectContractorResponse)
async def decline_assigned_project(
    pc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ContractorService(db).respond(pc_id, accept=False, user=current_user)


# ── Per-project ──────────────────────────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProjectService(db).get_detail(project, current_user)


@router.patch("/{project_id}/status", response_model=ProjectResponse)
async def update_project_status(
    data: ProjectStatusUpdate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owning client admin sets the project's lifecycle status. Completing a
    project frees its team members for reassignment to other projects."""
    return await ProjectService(db).set_status(project, data.status, current_user)


@router.get("/{project_id}/towers", response_model=list[TowerResponse])
async def list_towers(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Towers belonging to this project (drives pour-card + floor dropdowns)."""
    return await ProjectService(db).list_towers(project)


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_members(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await MembershipService(db).list_members(project)


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=201)
async def assign_member(
    data: ProjectMemberCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await MembershipService(db).assign(project, data, current_user)


@router.get("/{project_id}/contractors", response_model=list[ProjectContractorResponse])
async def list_contractors(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await ContractorService(db).list_for_project(project)


@router.get("/{project_id}/available-contractors", response_model=list[AvailableContractorResponse])
async def list_available_contractors(
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reusable contractor orgs (not yet on this project) + their other
    engagements, so the client can knowingly assign a busy contractor."""
    return await ContractorService(db).list_available_for_project(project, current_user)


@router.post("/{project_id}/contractors", response_model=ProjectContractorResponse, status_code=201)
async def add_contractor(
    data: ProjectContractorCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ContractorService(db).add_to_project(project, data, current_user)
