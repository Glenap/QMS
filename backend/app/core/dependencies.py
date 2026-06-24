"""
dependencies.py
---------------
FastAPI dependencies for authentication and authorisation.

Usage in routers:
    # Any authenticated user
    @router.get("/me")
    async def get_me(user: User = Depends(get_current_user)):
        ...

    # Specific role only
    @router.post("/projects")
    async def create_project(
        user: User = Depends(require_role(UserRole.CLIENT_ADMIN))
    ):
        ...

    # Multiple roles allowed
    @router.post("/pours")
    async def create_pour(
        user: User = Depends(require_any_role(
            UserRole.QUALITY_ENGINEER, UserRole.SUPERVISOR
        ))
    ):
        ...
"""

from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AccountDeactivatedError,
    InactiveUserError,
    InvalidTokenError,
    PermissionDeniedError,
    TokenBlacklistedError,
)
from app.core.security import decode_token
from app.database.session import get_db
from app.models.auth import User, UserRole

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates the Bearer token and returns the current user.

    Steps:
    1. Decode token — check signature and expiry
    2. Check token is not blacklisted (revoked on logout)
    3. Fetch user from DB
    4. Check user is active
    """
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise InvalidTokenError()

    if token_data.token_type != "access":
        raise InvalidTokenError()

    # Check blacklist — token revoked on logout
    from app.models.auth import TokenBlacklist
    blacklisted = await db.execute(
        select(TokenBlacklist).where(TokenBlacklist.jti == token_data.jti)
    )
    if blacklisted.scalar_one_or_none():
        raise TokenBlacklistedError()

    # Fetch user
    result = await db.execute(
        select(User).where(User.user_id == token_data.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise InvalidTokenError()

    if user.is_offboarded:
        raise AccountDeactivatedError()

    if not user.is_active:
        raise InactiveUserError()

    return user


def require_role(*allowed_roles: UserRole) -> Callable:
    """
    Dependency factory that requires the user to have one of the allowed roles.

    Usage:
        Depends(require_role(UserRole.CLIENT_ADMIN))
        Depends(require_role(UserRole.QUALITY_ENGINEER, UserRole.SUPERVISOR))
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            role_names = ", ".join(r.value for r in allowed_roles)
            raise PermissionDeniedError(
                f"This action requires one of these roles: {role_names}"
            )
        return current_user
    return role_checker


def require_org_admin() -> Callable:
    """
    Requires the user to be an org admin.
    Used for inviting team members.
    """
    async def admin_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not current_user.is_org_admin:
            raise PermissionDeniedError(
                "This action requires organisation admin access"
            )
        return current_user
    return admin_checker