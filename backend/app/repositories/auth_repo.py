"""
auth_repo.py
------------
Database queries for auth — users, organisations, invitations, blacklist.
No business logic here. Only SQLAlchemy queries.
"""

from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import (
    Organisation, User, OrgInvitation,
    TokenBlacklist, InvitationStatus, OrgType, OrgStatus
)


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
    ) -> User:
        user = User(
            org_id=org_id,
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            is_org_admin=is_org_admin,
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

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
    ) -> OrgInvitation:
        inv = OrgInvitation(
            org_id=org_id,
            invited_email=invited_email,
            role=role,
            invited_by=invited_by,
            token=token,
            status=InvitationStatus.PENDING,
            expires_at=expires_at,
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
                TokenBlacklist.expires_at < datetime.now(timezone.utc)
            )
        )
        return result.rowcount

    async def get_users_by_org(self, org_id: int) -> list:
        result = await self.session.execute(
            select(User).where(User.org_id == org_id)
        )
        return list(result.scalars().all())