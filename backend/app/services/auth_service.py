"""
auth_service.py — all auth business logic
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.auth_repo import AuthRepository
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, create_invitation_token,
)
from app.core.exceptions import (
    InvalidCredentialsError, InvalidTokenError,
    InvalidInvitationError, InvitationAlreadyUsedError,
    AlreadyExistsError,
)
from app.core.email import send_invitation_email
from app.models.auth import (
    User, OrgInvitation,
    OrgType, UserRole, InvitationStatus,
)
from app.schemas.auth import (
    OrgRegisterRequest, ContractorRegisterRequest,
    LoginRequest, InviteRequest, AcceptInvitationRequest,
    TokenResponse, UserResponse, OrgResponse, MeResponse,
    AccessTokenResponse,
)
from app.config import settings


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AuthRepository(session)

    # ── Client self-registration ─────────────────────────────────────────────

    async def register_client(self, data: OrgRegisterRequest) -> TokenResponse:
        """Client creates their org and first admin user in one step."""
        if await self.repo.email_exists(data.contact_email):
            raise AlreadyExistsError("Email")

        org = await self.repo.create_org(
            org_name=data.org_name,
            org_type=OrgType.CLIENT,
            contact_email=data.contact_email,
            contact_phone=data.contact_phone,
        )

        user = await self.repo.create_user(
            org_id=org.org_id,
            email=data.contact_email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=UserRole.CLIENT_ADMIN,
            is_org_admin=True,
        )

        return self._build_token_response(user)

    # ── Login ────────────────────────────────────────────────────────────────

    async def login(self, data: LoginRequest) -> TokenResponse:
        """Validates credentials and returns access + refresh tokens."""
        user = await self.repo.get_user_by_email(data.email)

        if not user or not verify_password(data.password, user.hashed_password):
            raise InvalidCredentialsError()

        if not user.is_active:
            raise InvalidCredentialsError()

        return self._build_token_response(user)

    # ── Token refresh ────────────────────────────────────────────────────────

    async def refresh_access_token(self, refresh_token: str) -> AccessTokenResponse:
        """Validates refresh token and returns a new access token."""
        token_data = decode_token(refresh_token)

        if not token_data or token_data.token_type != "refresh":
            raise InvalidTokenError()

        if await self.repo.is_token_blacklisted(token_data.jti):
            raise InvalidTokenError()

        user = await self.repo.get_user_by_id(token_data.user_id)
        if not user or not user.is_active:
            raise InvalidTokenError()

        access_token, _ = create_access_token(
            user_id=user.user_id,
            role=user.role.value,
            org_id=user.org_id,
        )

        return AccessTokenResponse(access_token=access_token)

    # ── Logout ───────────────────────────────────────────────────────────────

    async def logout(self, access_jti: str, user_id: int) -> None:
        """Blacklists the access token JTI."""
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        await self.repo.blacklist_token(
            jti=access_jti,
            user_id=user_id,
            expires_at=expires_at,
        )

    # ── Client registers contractor ──────────────────────────────────────────

    async def register_contractor(
        self,
        data: ContractorRegisterRequest,
        client_user: User,
    ) -> OrgResponse:
        """
        Client creates a contractor org and automatically sends
        an activation email to the contractor's contact email.

        Contractor activates as CONTRACTOR_ADMIN.
        They then invite their own Project Managers.
        """
        # Create contractor org
        org = await self.repo.create_org(
            org_name=data.org_name,
            org_type=OrgType.CONTRACTOR,
            contact_email=data.contact_email,
            contact_phone=data.contact_phone,
            registered_by_org_id=client_user.org_id,
        )

        # Auto-create invitation for contractor admin
        token = create_invitation_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=72)

        await self.repo.create_invitation(
            org_id=org.org_id,
            invited_email=data.contact_email,
            role=UserRole.CONTRACTOR_ADMIN,
            invited_by=client_user.user_id,
            token=token,
            expires_at=expires_at,
        )

        # Get client org name for email
        client_org = await self.repo.get_org_by_id(client_user.org_id)

        # Send activation email automatically
        await send_invitation_email(
            invited_email=data.contact_email,
            invited_by_name=client_org.org_name,
            org_name=data.org_name,
            role="Contractor Admin",
            token=token,
        )

        return OrgResponse.model_validate(org)

    # ── Invitation flow ──────────────────────────────────────────────────────

    async def invite_user(
        self,
        data: InviteRequest,
        inviting_user: User,
    ) -> OrgInvitation:
        """
        Sends an email invitation to join the inviting user's org.

        CLIENT_ADMIN     → invites CONTRACTOR_ADMIN
        CONTRACTOR_ADMIN → invites PROJECT_MANAGER
        PROJECT_MANAGER  → invites QUALITY_ENGINEER / SUPERVISOR
        """
        token = create_invitation_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

        invitation = await self.repo.create_invitation(
            org_id=inviting_user.org_id,
            invited_email=data.invited_email,
            role=data.role,
            invited_by=inviting_user.user_id,
            token=token,
            expires_at=expires_at,
        )

        org = await self.repo.get_org_by_id(inviting_user.org_id)

        await send_invitation_email(
            invited_email=data.invited_email,
            invited_by_name=inviting_user.full_name,
            org_name=org.org_name,
            role=data.role.value,
            token=token,
        )

        return invitation

    async def accept_invitation(
        self, data: AcceptInvitationRequest
    ) -> TokenResponse:
        """User accepts invitation and creates their account."""
        invitation = await self.repo.get_invitation_by_token(data.token)

        if not invitation:
            raise InvalidInvitationError()

        if invitation.status == InvitationStatus.ACCEPTED:
            raise InvitationAlreadyUsedError()

        if invitation.expires_at < datetime.now(timezone.utc):
            raise InvalidInvitationError()

        if await self.repo.email_exists(invitation.invited_email):
            raise AlreadyExistsError("Email")

        # First user of an org is automatically org admin
        existing_org_users = await self.repo.get_users_by_org(invitation.org_id)
        is_first_user = len(existing_org_users) == 0

        user = await self.repo.create_user(
            org_id=invitation.org_id,
            email=invitation.invited_email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=invitation.role,
            is_org_admin=is_first_user,
        )

        await self.repo.mark_invitation_accepted(invitation.invitation_id)

        return self._build_token_response(user)

    # ── Me ───────────────────────────────────────────────────────────────────

    async def get_me(self, user: User) -> MeResponse:
        org = await self.repo.get_org_by_id(user.org_id)
        return MeResponse(
            user=UserResponse.model_validate(user),
            organisation=OrgResponse.model_validate(org),
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _build_token_response(self, user: User) -> TokenResponse:
        access_token, _ = create_access_token(
            user_id=user.user_id,
            role=user.role.value,
            org_id=user.org_id,
        )
        refresh_token, _ = create_refresh_token(
            user_id=user.user_id,
            role=user.role.value,
            org_id=user.org_id,
        )
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )