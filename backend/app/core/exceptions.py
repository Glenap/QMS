"""
exceptions.py
-------------
All custom HTTP exceptions for the application.
Centralised here so routers never import from fastapi directly for errors.
"""

from fastapi import HTTPException, status


# ---------------------------------------------------------------------------
# Auth exceptions
# ---------------------------------------------------------------------------

class InvalidCredentialsError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )


class InvalidTokenError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )


class TokenBlacklistedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )


class InactiveUserError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )


class PermissionDeniedError(HTTPException):
    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


# ---------------------------------------------------------------------------
# Resource exceptions
# ---------------------------------------------------------------------------

class NotFoundError(HTTPException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found",
        )


class AlreadyExistsError(HTTPException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{resource} already exists",
        )


class InvalidInvitationError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation is invalid or has expired",
        )


class InvitationAlreadyUsedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has already been accepted",
        )


# ---------------------------------------------------------------------------
# Business logic exceptions
# ---------------------------------------------------------------------------

class InsufficientVolumeError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Received volume exceeds ordered volume",
        )


class PourAlreadyCompletedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pour has already been completed",
        )


class GradeMismatchWarning(HTTPException):
    def __init__(self, ordered: str, received: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Grade mismatch: ordered {ordered}, received {received}",
        )