"""
auth_repo.py
------------
Database queries for auth — users, organisations, invitations, blacklist.
No business logic here. Only SQLAlchemy queries.
"""

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import (
    EmailOtp,
    InvitationStatus,
    Organisation,
    OrgInvitation,
    OrgStatus,
    OrgType,
    ProjectMember,
    TokenBlacklist,
    User,
)
from app.models.master import Project, ProjectStatus


class AuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Organisation ────────────────────────────────────────────────────────

    async def get_org_by_id(self, org_id: int) -> Organisation | None:
        result = await self.session.execute(
            select(Organisation).where(Organisation.org_id == org_id)
        )
        return result.scalar_one_or_none()

    async def get_org_by_email(self, email: str) -> Organisation | None:
        result = await self.session.execute(
            select(Organisation).where(Organisation.contact_email == email)
        )
        return result.scalar_one_or_none()

    async def create_org(
        self,
        org_name: str,
        org_type: OrgType,
        contact_email: str,
        contact_phone: str | None = None,
        registered_by_org_id: int | None = None,
    ) -> Organisation:
        org = Organisation(
            org_name=org_name,
            org_type=org_type,
            status=OrgStatus.ACTIVE,
            contact_email=contact_email,
            contact_phone=contact_phone,
            registered_by_org_id=registered_by_org_id,
        )
        self.session.add(org)
        await self.session.flush()
        await self.session.refresh(org)
        return org

    # ── User ────────────────────────────────────────────────────────────────

    async def get_user_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(
            select(User).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def create_user(
        self,
        org_id: int,
        email: str,
        hashed_password: str,
        full_name: str,
        role,
        is_org_admin: bool = False,
        is_active: bool = True,
    ) -> User:
        user = User(
            org_id=org_id,
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            is_org_admin=is_org_admin,
            is_active=is_active,
        )
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def activate_user(self, user_id: int) -> None:
        await self.session.execute(
            update(User).where(User.user_id == user_id).values(is_active=True)
        )

    async def set_offboarded(self, user_id: int, offboarded: bool) -> None:
        await self.session.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(is_offboarded=offboarded)
        )

    async def update_avatar(self, user_id: int, avatar_url: str | None) -> None:
        await self.session.execute(
            update(User).where(User.user_id == user_id).values(avatar_url=avatar_url)
        )

    async def email_exists(self, email: str) -> bool:
        result = await self.session.execute(
            select(User.user_id).where(User.email == email)
        )
        return result.scalar_one_or_none() is not None

    # ── OrgInvitation ────────────────────────────────────────────────────────

    async def get_invitation_by_token(self, token: str) -> OrgInvitation | None:
        result = await self.session.execute(
            select(OrgInvitation).where(OrgInvitation.token == token)
        )
        return result.scalar_one_or_none()

    async def create_invitation(
        self,
        org_id: int,
        invited_email: str,
        role,
        invited_by: int,
        token: str,
        expires_at: datetime,
        project_id: int | None = None,
        project_role: str | None = None,
    ) -> OrgInvitation:
        inv = OrgInvitation(
            org_id=org_id,
            invited_email=invited_email,
            role=role,
            invited_by=invited_by,
            token=token,
            status=InvitationStatus.PENDING,
            expires_at=expires_at,
            project_id=project_id,
            project_role=project_role,
        )
        self.session.add(inv)
        await self.session.flush()
        await self.session.refresh(inv)
        return inv

    async def mark_invitation_accepted(self, invitation_id: int) -> None:
        await self.session.execute(
            update(OrgInvitation)
            .where(OrgInvitation.invitation_id == invitation_id)
            .values(status=InvitationStatus.ACCEPTED)
        )

    # ── Email OTP ────────────────────────────────────────────────────────────

    async def create_otp(
        self,
        user_id: int,
        email: str,
        code_hash: str,
        purpose: str,
        expires_at: datetime,
    ) -> EmailOtp:
        otp = EmailOtp(
            user_id=user_id,
            email=email,
            code_hash=code_hash,
            purpose=purpose,
            expires_at=expires_at,
        )
        self.session.add(otp)
        await self.session.flush()
        await self.session.refresh(otp)
        return otp

    async def get_latest_active_otp(self, email: str) -> EmailOtp | None:
        """Most recent unconsumed OTP for an email (may still be expired)."""
        result = await self.session.execute(
            select(EmailOtp)
            .where(EmailOtp.email == email, EmailOtp.consumed_at.is_(None))
            .order_by(EmailOtp.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def mark_otp_consumed(self, otp_id: int) -> None:
        await self.session.execute(
            update(EmailOtp)
            .where(EmailOtp.otp_id == otp_id)
            .values(consumed_at=datetime.now(UTC))
        )

    # ── Token blacklist ──────────────────────────────────────────────────────

    async def blacklist_token(
        self,
        jti: str,
        user_id: int,
        expires_at: datetime,
    ) -> None:
        """Adds a token JTI to the blacklist (called on logout)."""
        entry = TokenBlacklist(
            jti=jti,
            user_id=user_id,
            expires_at=expires_at,
        )
        self.session.add(entry)
        await self.session.flush()

    async def is_token_blacklisted(self, jti: str) -> bool:
        result = await self.session.execute(
            select(TokenBlacklist.id).where(TokenBlacklist.jti == jti)
        )
        return result.scalar_one_or_none() is not None

    async def clean_expired_blacklist_entries(self) -> int:
        """
        Deletes expired blacklist entries.
        Called by a periodic background task — no point keeping
        tokens in the blacklist after they've expired anyway.
        """
        from sqlalchemy import delete
        result = await self.session.execute(
            delete(TokenBlacklist).where(
                TokenBlacklist.expires_at < datetime.now(UTC)
            )
        )
        return result.rowcount

    async def get_users_by_org(self, org_id: int) -> list:
        result = await self.session.execute(
            select(User).where(User.org_id == org_id).order_by(User.created_at)
        )
        return list(result.scalars().all())

    async def get_users_by_ids(self, user_ids: list[int]) -> list[User]:
        if not user_ids:
            return []
        result = await self.session.execute(
            select(User).where(User.user_id.in_(user_ids))
        )
        return list(result.scalars().all())

    # ── Project members ────────────────────────────────────────────────────────

    async def create_project_member(
        self,
        project_id: int,
        user_id: int,
        org_id: int,
        project_role: str,
        assigned_by: int,
    ) -> ProjectMember:
        member = ProjectMember(
            project_id=project_id,
            user_id=user_id,
            org_id=org_id,
            project_role=project_role,
            assigned_by=assigned_by,
        )
        self.session.add(member)
        await self.session.flush()
        await self.session.refresh(member)
        return member

    async def get_project_member(
        self, project_id: int, user_id: int
    ) -> ProjectMember | None:
        result = await self.session.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_project_members(self, project_id: int) -> list[ProjectMember]:
        result = await self.session.execute(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.assigned_at)
        )
        return list(result.scalars().all())

    async def list_projects_for_user(self, user_id: int) -> list[int]:
        result = await self.session.execute(
            select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
        )
        return list(result.scalars().all())

    async def active_project_for_user(
        self, user_id: int
    ) -> tuple[int, str] | None:
        """The (project_id, project_name) the user is currently assigned to on an
        active project (status ACTIVE or ON_HOLD), or None if free. A member is on
        at most one active project at a time; completing a project frees them."""
        result = await self.session.execute(
            select(Project.project_id, Project.project_name)
            .join(ProjectMember, ProjectMember.project_id == Project.project_id)
            .where(
                ProjectMember.user_id == user_id,
                Project.status.in_([ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD]),
            )
            .limit(1)
        )
        row = result.first()
        return (row[0], row[1]) if row else None

    async def get_pending_invitations_by_project(self, project_id: int) -> list:
        result = await self.session.execute(
            select(OrgInvitation).where(
                OrgInvitation.project_id == project_id,
                OrgInvitation.status == InvitationStatus.PENDING,
            )
        )
        return list(result.scalars().all())

    async def get_pending_invitations_by_org(self, org_id: int) -> list:
        """Pending (not-yet-accepted) invitations for an org, newest first."""
        result = await self.session.execute(
            select(OrgInvitation)
            .where(
                OrgInvitation.org_id == org_id,
                OrgInvitation.status == InvitationStatus.PENDING,
            )
            .order_by(OrgInvitation.created_at.desc())
        )
        return list(result.scalars().all())