"""
auth.py router — all /auth/* endpoints
"""

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import InvalidTokenError, PermissionDeniedError
from app.core.security import decode_token
from app.database.session import get_db
from app.models.auth import User, UserRole
from app.schemas.auth import (
    AcceptInvitationRequest,
    AccessTokenResponse,
    AvatarUpdate,
    InvitationResponse,
    InviteRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    OrgRegisterRequest,
    OtpChallengeResponse,
    RefreshRequest,
    ResendOtpRequest,
    TeamMemberResponse,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=OtpChallengeResponse, status_code=201)
async def register_client(
    data: OrgRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Client self-registers their company and first admin account. Returns an
    OTP challenge — the account activates only after /auth/verify-otp.
    """
    service = AuthService(db)
    return await service.register_client(data)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password. Returns access + refresh tokens."""
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange refresh token for a new access token."""
    service = AuthService(db)
    return await service.refresh_access_token(data.refresh_token)


@router.post("/accept-invitation", response_model=OtpChallengeResponse, status_code=201)
async def accept_invitation(
    data: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Accept email invitation and create your account. Token comes from the
    invitation email link. Returns an OTP challenge — the account activates
    only after /auth/verify-otp.
    """
    service = AuthService(db)
    return await service.accept_invitation(data)


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    data: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify the emailed code, activate the account, and return tokens."""
    service = AuthService(db)
    return await service.verify_otp(data)


@router.post("/resend-otp", response_model=OtpChallengeResponse)
async def resend_otp(
    data: ResendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """Re-send a verification code to a not-yet-activated account."""
    service = AuthService(db)
    return await service.resend_otp(data)


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=204)
async def logout(
    data: LogoutRequest | None = None,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blacklists the current access token, and the refresh token if sent."""
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise InvalidTokenError()
    service = AuthService(db)
    await service.logout(
        access_jti=token_data.jti,
        user_id=current_user.user_id,
        refresh_token=data.refresh_token if data else None,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns current user and their organisation details."""
    service = AuthService(db)
    return await service.get_me(current_user)


@router.get("/team", response_model=list[TeamMemberResponse])
async def get_team(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Org directory: active/unverified users + pending invitations."""
    service = AuthService(db)
    return await service.get_team(current_user)


@router.put("/me/avatar", response_model=UserResponse)
async def update_my_avatar(
    data: AvatarUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or clear the current user's profile picture (data: URL)."""
    return await AuthService(db).update_avatar(current_user, data.avatar_url)


@router.post("/users/{user_id}/deactivate", response_model=UserResponse)
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Org admin offboards a member of their org — revokes all access."""
    return await AuthService(db).set_member_offboarded(current_user, user_id, True)


@router.post("/users/{user_id}/reactivate", response_model=UserResponse)
async def reactivate_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Org admin restores a previously deactivated member."""
    return await AuthService(db).set_member_offboarded(current_user, user_id, False)


# ---------------------------------------------------------------------------
# Invite — available to CLIENT_ADMIN, CONTRACTOR_ADMIN, CONTRACTOR_USER
#
# Bringing a contractor onto a project is now project-scoped — see
# POST /projects/{id}/contractors (routers/projects.py), not an /auth endpoint.
# ---------------------------------------------------------------------------

@router.post("/invite", response_model=InvitationResponse, status_code=201)
async def invite_user(
    data: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a user to join your organisation's team (no project designation).

    Who can invite whom:
      CLIENT_ADMIN      → invites CLIENT_USER
      CONTRACTOR_ADMIN  → invites CONTRACTOR_USER

    Team members carry no functional designation until they're assigned to a
    project (POST /projects/{id}/members), where the per-project designation
    (PM / QE / Supervisor / Lead) is chosen. Bringing a contractor org onto a
    project is a separate flow — see POST /projects/{id}/contractors.

    Invited user receives an email with a registration link.
    """
    _validate_invite_permission(current_user, data.role)

    service = AuthService(db)
    invitation = await service.invite_user(data=data, inviting_user=current_user)

    return InvitationResponse.model_validate(invitation)


def _validate_invite_permission(inviting_user: User, target_role: UserRole) -> None:
    """
    Enforces who can invite whom into the org team (designation-less).

    CLIENT_ADMIN      → CLIENT_USER
    CONTRACTOR_ADMIN  → CONTRACTOR_USER

    Only org admins build their team. Functional designations (PM / QE /
    Supervisor / Lead) are not org roles anymore — they're assigned per project
    (POST /projects/{id}/members). Bringing a contractor onto a project is
    project-scoped (POST /projects/{id}/contractors), not this endpoint.
    """
    allowed_map = {
        UserRole.CLIENT_ADMIN: [UserRole.CLIENT_USER],
        UserRole.CONTRACTOR_ADMIN: [UserRole.CONTRACTOR_USER],
    }

    allowed_roles = allowed_map.get(inviting_user.role, [])

    if target_role not in allowed_roles:
        allowed_names = ", ".join(r.value for r in allowed_roles) or "none"
        raise PermissionDeniedError(
            f"{inviting_user.role.value} can only invite: {allowed_names}"
        )