"""
auth.py router — all /auth/* endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.core.security import decode_token
from app.core.exceptions import InvalidTokenError, PermissionDeniedError
from app.models.auth import User, UserRole
from app.schemas.auth import (
    OrgRegisterRequest, ContractorRegisterRequest,
    LoginRequest, RefreshRequest, InviteRequest,
    AcceptInvitationRequest, TokenResponse,
    AccessTokenResponse, OrgResponse,
    InvitationResponse, MeResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register_client(
    data: OrgRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Client self-registers their company and first admin account."""
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


@router.post("/accept-invitation", response_model=TokenResponse, status_code=201)
async def accept_invitation(
    data: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Accept email invitation and create your account.
    Token comes from the invitation email link.
    """
    service = AuthService(db)
    return await service.accept_invitation(data)


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=204)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blacklists the current access token."""
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise InvalidTokenError()
    service = AuthService(db)
    await service.logout(
        access_jti=token_data.jti,
        user_id=current_user.user_id,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns current user and their organisation details."""
    service = AuthService(db)
    return await service.get_me(current_user)


# ---------------------------------------------------------------------------
# CLIENT_ADMIN only
# ---------------------------------------------------------------------------

@router.post(
    "/register-contractor",
    response_model=OrgResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.CLIENT_ADMIN))],
)
async def register_contractor(
    data: ContractorRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    CLIENT_ADMIN registers a contractor organisation.
    Automatically sends an activation email to the contractor's contact email.
    Contractor activates as CONTRACTOR_ADMIN, then invites their own PMs.
    """
    service = AuthService(db)
    return await service.register_contractor(
        data=data,
        client_user=current_user,
    )


# ---------------------------------------------------------------------------
# Invite — available to CLIENT_ADMIN, CONTRACTOR_ADMIN, PROJECT_MANAGER
# ---------------------------------------------------------------------------

@router.post("/invite", response_model=InvitationResponse, status_code=201)
async def invite_user(
    data: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a user to join your organisation.

    Who can invite whom:
      CLIENT_ADMIN      → invites CONTRACTOR_ADMIN
      CONTRACTOR_ADMIN  → invites PROJECT_MANAGER
      PROJECT_MANAGER   → invites QUALITY_ENGINEER, SUPERVISOR

    Invited user receives an email with a registration link.
    """
    _validate_invite_permission(current_user, data.role)

    service = AuthService(db)
    invitation = await service.invite_user(data=data, inviting_user=current_user)

    return InvitationResponse.model_validate(invitation)


def _validate_invite_permission(inviting_user: User, target_role: UserRole) -> None:
    """
    Enforces who can invite whom.

    CLIENT_ADMIN      → CONTRACTOR_ADMIN only
    CONTRACTOR_ADMIN  → PROJECT_MANAGER only
    PROJECT_MANAGER   → QUALITY_ENGINEER, SUPERVISOR
    """
    allowed_map = {
        UserRole.CLIENT_ADMIN: [
            UserRole.CONTRACTOR_ADMIN,
        ],
        UserRole.CONTRACTOR_ADMIN: [
            UserRole.PROJECT_MANAGER,
        ],
        UserRole.PROJECT_MANAGER: [
            UserRole.QUALITY_ENGINEER,
            UserRole.SUPERVISOR,
        ],
    }

    allowed_roles = allowed_map.get(inviting_user.role, [])

    if target_role not in allowed_roles:
        allowed_names = ", ".join(r.value for r in allowed_roles) or "none"
        raise PermissionDeniedError(
            f"{inviting_user.role.value} can only invite: {allowed_names}"
        )