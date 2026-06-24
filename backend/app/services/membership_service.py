"""membership_service.py — assign / invite users to a project.

Assigning to a project either links an existing org user (same org as the
caller) via a ProjectMember row, or invites a brand-new person by email — the
invitation carries the project_id + project_role so accept_invitation can create
the ProjectMember once they verify their email.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AlreadyExistsError, PermissionDeniedError
from app.core.project_access import (
    ensure_can_manage_contractor_side,
    ensure_contractor_admin_for,
    is_owning_client_admin,
)
from app.core.security import create_invitation_token
from app.models.auth import ProjectRole, User, UserRole
from app.models.master import Project
from app.repositories.auth_repo import AuthRepository
from app.schemas.master import ProjectMemberCreate, ProjectMemberResponse
from app.services.auth_service import _try_send_invitation_email


def _member_status(user: User | None) -> str:
    """Team-row status: DEACTIVATED (offboarded) > ACTIVE (verified) > UNVERIFIED."""
    if user is None:
        return "UNVERIFIED"
    if user.is_offboarded:
        return "DEACTIVATED"
    return "ACTIVE" if user.is_active else "UNVERIFIED"


# A project role implies the org-level role a freshly-invited user gets.
PROJECT_ROLE_TO_ORG_ROLE = {
    ProjectRole.CLIENT_LEAD: UserRole.CLIENT_USER,
    ProjectRole.CONTRACTOR_LEAD: UserRole.CONTRACTOR_USER,
    ProjectRole.PROJECT_MANAGER: UserRole.PROJECT_MANAGER,
    ProjectRole.QUALITY_ENGINEER: UserRole.QUALITY_ENGINEER,
    ProjectRole.SUPERVISOR: UserRole.SUPERVISOR,
}


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

        # The member's org is the actor's org (CLIENT roles → client org;
        # CONTRACTOR roles → the actor's contractor org).
        member_org_id = actor.org_id

        existing = await self.repo.get_user_by_email(data.email)
        if existing:
            if existing.org_id != member_org_id:
                raise PermissionDeniedError(
                    "That user belongs to a different organisation"
                )
            if await self.repo.get_project_member(project.project_id, existing.user_id):
                raise AlreadyExistsError("Project member")
            member = await self.repo.create_project_member(
                project_id=project.project_id,
                user_id=existing.user_id,
                org_id=member_org_id,
                project_role=role.value,
                assigned_by=actor.user_id,
            )
            return ProjectMemberResponse(
                email=existing.email,
                full_name=existing.full_name,
                project_role=role.value,
                status="ACTIVE" if existing.is_active else "UNVERIFIED",
                user_id=existing.user_id,
                assigned_at=member.assigned_at,
            )

        # New person → invite, carrying the project assignment.
        token = create_invitation_token()
        expires_at = datetime.now(UTC) + timedelta(hours=72)
        await self.repo.create_invitation(
            org_id=member_org_id,
            invited_email=data.email,
            role=PROJECT_ROLE_TO_ORG_ROLE[role],
            invited_by=actor.user_id,
            token=token,
            expires_at=expires_at,
            project_id=project.project_id,
            project_role=role.value,
        )
        org = await self.repo.get_org_by_id(member_org_id)
        await _try_send_invitation_email(
            invited_email=data.email,
            invited_by_name=actor.full_name,
            org_name=org.org_name if org else "",
            role=role.value,
            token=token,
        )
        return ProjectMemberResponse(
            email=data.email,
            full_name=None,
            project_role=role.value,
            status="INVITED",
            user_id=None,
            assigned_at=None,
        )

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
