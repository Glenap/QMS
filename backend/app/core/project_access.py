"""
project_access.py
-----------------
Project-scoped authorisation, layered on the org-level role.

Visibility:
  - CLIENT_ADMIN of the owning org  → all of its projects
  - CONTRACTOR_ADMIN of a participating contractor org → that project (any link
    status, so they can see + accept a PENDING assignment)
  - any user with a ProjectMember row → that project

Capabilities:
  - client side  (register contractors, assign client members): CLIENT_ADMIN of
    the owning org, or a CLIENT_LEAD member
  - contractor side (register suppliers/labs, assign PM/QE/Supervisor):
    CONTRACTOR_ADMIN of an ACCEPTED contractor org, or a CONTRACTOR_LEAD member
  - accept project / assign contractor leads: CONTRACTOR_ADMIN of the
    participating org
"""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.database.session import get_db
from app.models.auth import ProjectMember, ProjectRole, User, UserRole
from app.models.master import Project, ProjectContractor

CONTRACTOR_ACCEPTED = "ACCEPTED"


# ── Low-level queries ───────────────────────────────────────────────────────

async def _get_project(db: AsyncSession, project_id: int) -> Project | None:
    res = await db.execute(select(Project).where(Project.project_id == project_id))
    return res.scalar_one_or_none()


async def get_membership(
    db: AsyncSession, project_id: int, user_id: int
) -> ProjectMember | None:
    res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    return res.scalar_one_or_none()


async def contractor_org_ids(
    db: AsyncSession, project_id: int, *, accepted_only: bool = False
) -> set[int]:
    q = select(ProjectContractor.contractor_org_id).where(
        ProjectContractor.project_id == project_id
    )
    if accepted_only:
        q = q.where(ProjectContractor.status == CONTRACTOR_ACCEPTED)
    res = await db.execute(q)
    return set(res.scalars().all())


def is_owning_client_admin(user: User, project: Project) -> bool:
    return user.role == UserRole.CLIENT_ADMIN and user.org_id == project.org_id


# ── View access ─────────────────────────────────────────────────────────────

async def can_view_project(db: AsyncSession, user: User, project: Project) -> bool:
    if is_owning_client_admin(user, project):
        return True
    if await get_membership(db, project.project_id, user.user_id):
        return True
    if user.role == UserRole.CONTRACTOR_ADMIN:
        return user.org_id in await contractor_org_ids(db, project.project_id)
    return False


async def assert_project_access(
    db: AsyncSession, user: User, project_id: int
) -> Project:
    project = await _get_project(db, project_id)
    if not project:
        raise NotFoundError("Project")
    if not await can_view_project(db, user, project):
        raise PermissionDeniedError("You don't have access to this project")
    return project


async def require_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """FastAPI dependency: returns the project if the caller may view it."""
    return await assert_project_access(db, current_user, project_id)


# ── Capabilities ────────────────────────────────────────────────────────────

async def can_manage_client_side(db: AsyncSession, user: User, project: Project) -> bool:
    if is_owning_client_admin(user, project):
        return True
    member = await get_membership(db, project.project_id, user.user_id)
    return bool(member and member.project_role == ProjectRole.CLIENT_LEAD.value)


async def can_manage_contractor_side(db: AsyncSession, user: User, project: Project) -> bool:
    if user.role == UserRole.CONTRACTOR_ADMIN:
        if user.org_id in await contractor_org_ids(
            db, project.project_id, accepted_only=True
        ):
            return True
    member = await get_membership(db, project.project_id, user.user_id)
    return bool(member and member.project_role == ProjectRole.CONTRACTOR_LEAD.value)


async def can_manage_project(db: AsyncSession, user: User, project: Project) -> bool:
    """Manage project setup (towers/floors): either side's managers qualify."""
    return await can_manage_client_side(db, user, project) or await can_manage_contractor_side(
        db, user, project
    )


async def is_contractor_admin_for(db: AsyncSession, user: User, project: Project) -> bool:
    if user.role != UserRole.CONTRACTOR_ADMIN:
        return False
    return user.org_id in await contractor_org_ids(db, project.project_id)


async def ensure_can_manage_client_side(db: AsyncSession, user: User, project: Project) -> None:
    if not await can_manage_client_side(db, user, project):
        raise PermissionDeniedError(
            "Only the client admin or an assigned client lead can do this"
        )


async def ensure_can_manage_contractor_side(db: AsyncSession, user: User, project: Project) -> None:
    if not await can_manage_contractor_side(db, user, project):
        raise PermissionDeniedError(
            "Only a contractor admin or an assigned contractor lead can do this"
        )


async def ensure_can_manage_project(db: AsyncSession, user: User, project: Project) -> None:
    if not await can_manage_project(db, user, project):
        raise PermissionDeniedError(
            "You don't have rights to manage this project's setup"
        )


async def ensure_contractor_admin_for(db: AsyncSession, user: User, project: Project) -> None:
    if not await is_contractor_admin_for(db, user, project):
        raise PermissionDeniedError("Only the contractor admin can do this")
