"""project_service.py — business logic for projects.

A project is owned by the CLIENT organisation that creates it. Listing is
project-scoped: client admins see all of their org's projects; contractor admins
see projects their org has accepted; everyone else sees projects they're a
member of.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.project_access import (
    can_manage_client_side,
    can_manage_contractor_side,
    is_contractor_admin_for,
)
from app.models.auth import User, UserRole
from app.models.master import Project, ProjectContractor, Tower
from app.repositories.auth_repo import AuthRepository
from app.repositories.project_repo import ProjectRepository
from app.schemas.master import (
    ProjectAccess,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    TowerResponse,
)

CLIENT_SIDE_ROLES = {UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER}


class ProjectService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ProjectRepository(session)
        self.auth = AuthRepository(session)

    async def create(self, data: ProjectCreate, user: User) -> ProjectResponse:
        project = Project(
            org_id=user.org_id,
            **data.model_dump(exclude={"towers"}),
        )
        project = await self.repo.add(project)

        for tower_data in data.towers:
            await self.repo.add_tower(
                Tower(project_id=project.project_id, **tower_data.model_dump())
            )

        return ProjectResponse.model_validate(project)

    async def list_visible(self, user: User) -> list[ProjectResponse]:
        """Projects the user may see, scoped by role + project membership."""
        if user.role == UserRole.CLIENT_ADMIN:
            projects = await self.repo.list_by(
                Project.org_id == user.org_id,
                order_by=Project.created_at.desc(),
            )
        elif user.role == UserRole.CONTRACTOR_ADMIN:
            res = await self.session.execute(
                select(ProjectContractor.project_id).where(
                    ProjectContractor.contractor_org_id == user.org_id,
                    ProjectContractor.status == "ACCEPTED",
                )
            )
            ids = list(res.scalars().all())
            projects = (
                await self.repo.list_by(
                    Project.project_id.in_(ids), order_by=Project.created_at.desc()
                )
                if ids
                else []
            )
        else:
            ids = await self.auth.list_projects_for_user(user.user_id)
            projects = (
                await self.repo.list_by(
                    Project.project_id.in_(ids), order_by=Project.created_at.desc()
                )
                if ids
                else []
            )

        responses = [ProjectResponse.model_validate(p) for p in projects]
        # Contractor-side viewers see their allotted towers, not the project-wide
        # tower count, so the list reflects what they actually work on.
        if projects and user.role not in CLIENT_SIDE_ROLES:
            res = await self.session.execute(
                select(ProjectContractor.project_id, ProjectContractor.scope).where(
                    ProjectContractor.contractor_org_id == user.org_id,
                    ProjectContractor.project_id.in_([p.project_id for p in projects]),
                )
            )
            scope_by_pid = {pid: scope for pid, scope in res.all()}
            for r in responses:
                r.assigned_scope = scope_by_pid.get(r.project_id)
        return responses

    async def list_towers(self, project: Project) -> list[TowerResponse]:
        towers = await self.repo.list_towers(project.project_id)
        return [TowerResponse.model_validate(t) for t in towers]

    async def get_detail(self, project: Project, user: User) -> ProjectDetailResponse:
        base = ProjectResponse.model_validate(project)
        side = "CLIENT" if user.role in CLIENT_SIDE_ROLES else "CONTRACTOR"
        # Contractor-side viewers carry their allotted-tower scope so the UI can
        # restrict tower pickers (e.g. raising a pour) to towers they work on.
        if user.role not in CLIENT_SIDE_ROLES:
            res = await self.session.execute(
                select(ProjectContractor.scope).where(
                    ProjectContractor.contractor_org_id == user.org_id,
                    ProjectContractor.project_id == project.project_id,
                )
            )
            base.assigned_scope = res.scalar_one_or_none()
        access = ProjectAccess(
            side=side,
            can_manage_client_side=await can_manage_client_side(
                self.session, user, project
            ),
            can_manage_contractor_side=await can_manage_contractor_side(
                self.session, user, project
            ),
            is_contractor_admin=await is_contractor_admin_for(
                self.session, user, project
            ),
        )
        return ProjectDetailResponse(**base.model_dump(), access=access)
