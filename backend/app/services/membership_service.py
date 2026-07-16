"""membership_service.py — assign existing team members to a project.

Team-building and projects are independent: an org admin invites people to the
org team (no designation) via /auth/invite; here an existing team member is
**assigned to a project** with a per-project designation (ProjectMember row).

Rules:
  * only an existing, same-org member can be assigned (no invite-new here);
  * a member can be on at most one *active* project at a time (freed once that
    project is completed);
  * the assignee is emailed that they've been given a role on the project.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_project_assignment_email
from app.core.exceptions import (
    AlreadyExistsError,
    MemberBusyError,
    MemberNotInOrgError,
    PermissionDeniedError,
)
from app.core.project_access import (
    ensure_can_manage_contractor_side,
    ensure_contractor_admin_for,
    is_owning_client_admin,
)
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.repositories.auth_repo import AuthRepository
from app.schemas.master import ProjectMemberCreate, ProjectMemberResponse

logger = logging.getLogger(__name__)


def _member_status(user: User | None) -> str:
    """Team-row status: DEACTIVATED (offboarded) > ACTIVE (verified) > UNVERIFIED."""
    if user is None:
        return "UNVERIFIED"
    if user.is_offboarded:
        return "DEACTIVATED"
    return "ACTIVE" if user.is_active else "UNVERIFIED"


class MembershipService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AuthRepository(session)

    async def _ensure_can_assign(
        self, actor: User, project: Project, role: ProjectRole
    ) -> None:
        if role == ProjectRole.CLIENT_LEAD:
            if not is_owning_client_admin(actor, project):
                raise PermissionDeniedError(
                    "Only the client admin can assign client leads"
                )
        elif role == ProjectRole.CONTRACTOR_LEAD:
            await ensure_contractor_admin_for(self.session, actor, project)
        else:  # PROJECT_MANAGER / QUALITY_ENGINEER / SUPERVISOR
            await ensure_can_manage_contractor_side(self.session, actor, project)

    async def assign(
        self, project: Project, data: ProjectMemberCreate, actor: User
    ) -> ProjectMemberResponse:
        try:
            role = ProjectRole(data.project_role)
        except ValueError as exc:
            raise PermissionDeniedError("Unknown project role") from exc

        await self._ensure_can_assign(actor, project, role)

        # Only an existing, same-org, accepted member can be assigned — team
        # onboarding happens up front via /auth/invite, not here.
        member_org_id = actor.org_id
        existing = await self.repo.get_user_by_email(data.email)
        if not existing:
            raise MemberNotInOrgError()
        if existing.org_id != member_org_id:
            raise PermissionDeniedError("That user belongs to a different organisation")
        if await self.repo.get_project_member(project.project_id, existing.user_id):
            raise AlreadyExistsError("Project member")

        # One active project at a time — freed once their current one completes.
        busy = await self.repo.active_project_for_user(existing.user_id)
        if busy is not None:
            raise MemberBusyError(busy[1])

        member = await self.repo.create_project_member(
            project_id=project.project_id,
            user_id=existing.user_id,
            org_id=member_org_id,
            project_role=role.value,
            assigned_by=actor.user_id,
        )
        await self._notify_assignment(existing, actor, project, role)
        return ProjectMemberResponse(
            email=existing.email,
            full_name=existing.full_name,
            project_role=role.value,
            status="ACTIVE" if existing.is_active else "UNVERIFIED",
            user_id=existing.user_id,
            assigned_at=member.assigned_at,
        )

    async def _notify_assignment(
        self, member: User, actor: User, project: Project, role: ProjectRole
    ) -> None:
        """Tell the member they've been given a designation on the project.
        Best-effort — an email failure must not roll back the assignment."""
        try:
            await send_project_assignment_email(
                member_email=member.email,
                member_name=member.full_name,
                assigned_by_name=actor.full_name,
                project_name=project.project_name,
                role=role.value,
            )
        except Exception as exc:  # noqa: BLE001 — best-effort notification
            logger.warning("Assignment email to %s failed: %s", member.email, exc)

    async def list_members(self, project: Project) -> list[ProjectMemberResponse]:
        members = await self.repo.list_project_members(project.project_id)
        users = {
            u.user_id: u
            for u in await self.repo.get_users_by_ids([m.user_id for m in members])
        }
        rows = [
            ProjectMemberResponse(
                email=users[m.user_id].email if m.user_id in users else "",
                full_name=users[m.user_id].full_name if m.user_id in users else None,
                project_role=m.project_role,
                status=_member_status(users.get(m.user_id)),
                user_id=m.user_id,
                assigned_at=m.assigned_at,
            )
            for m in members
        ]

        member_emails = {r.email for r in rows}
        invites = await self.repo.get_pending_invitations_by_project(project.project_id)
        rows.extend(
            ProjectMemberResponse(
                email=inv.invited_email,
                full_name=None,
                project_role=inv.project_role or "",
                status="INVITED",
                user_id=None,
                assigned_at=None,
            )
            for inv in invites
            if inv.invited_email not in member_emails
        )
        return rows
