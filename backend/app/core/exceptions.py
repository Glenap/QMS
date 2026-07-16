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


class AccountDeactivatedError(HTTPException):
    """The account was offboarded by an org admin — distinct from a not-yet-
    verified account so it can't be reactivated through the OTP flow."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your administrator.",
        )


class PermissionDeniedError(HTTPException):
    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class EmailNotVerifiedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Enter the code we emailed you to activate your account.",
        )


class InvalidOtpError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )


class EmailAlreadyVerifiedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified. Please log in.",
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


class DeliveryNotAcceptedError(HTTPException):
    """A pour was raised from a delivery that hasn't been accepted yet — the pour
    records an accepted (QE-signed-off) delivery, and its volume is that of the
    truck, so the delivery must be ACCEPTED first."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pour can only be recorded from an accepted delivery.",
        )


class PourAlreadyExistsError(HTTPException):
    """A pour was raised from a delivery that already has one — one delivery
    yields at most one pour."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pour has already been recorded for this delivery.",
        )


class GradeNotApprovedError(HTTPException):
    """A dispatch was raised for a grade that has no APPROVED mix design on the
    project — only grades with an approved mix may be dispatched/poured."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This grade has no approved mix design on the project. "
            "Get a mix design approved before dispatching concrete for it.",
        )


class GradeMismatchWarning(HTTPException):
    def __init__(self, ordered: str, received: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Grade mismatch: ordered {ordered}, received {received}",
        )


class TruckStateError(HTTPException):
    """A truck-dispatch action was attempted from a status that doesn't allow it
    (e.g. filling a truck that's already been reviewed, or accepting one that
    hasn't reached the gate yet)."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class DateIntegrityError(HTTPException):
    """A record was submitted with dates that can't occur in that order
    (e.g. a cube cast before its pour, or a project ending before it starts)."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class EntityBlockedError(HTTPException):
    """A blocked RMC supplier or testing lab was used for new work (dispatch,
    mix-design request, or cube dispatch). Unblock it first."""

    def __init__(self, kind: str, reason: str | None = None):
        detail = f"This {kind} is blocked and can't be used for new work."
        if reason:
            detail += f" Reason: {reason}"
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class EntityNotApprovedError(HTTPException):
    """A client-registered RMC supplier or testing lab was used before the
    contractor accepted it. It must be accepted first."""

    def __init__(self, kind: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This {kind} is awaiting the contractor's approval and can't "
            "be used yet.",
        )


class NoAcceptedContractorError(HTTPException):
    """The client tried to register an RMC/lab (client-registration mode) with no
    accepted contractor on the project to approve and work with it."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bring a contractor onto the project (and have them accept) "
            "before registering RMC suppliers or labs as the client.",
        )


class MemberNotInOrgError(HTTPException):
    """A project assignment named someone who isn't a team member yet — only
    existing (accepted) org members can be assigned to a project."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This person isn't in your team yet. Invite them to the team "
            "first, then assign them to the project once they've accepted.",
        )


class MemberBusyError(HTTPException):
    """A team member can be on only one active project at a time; they're freed
    for reassignment once their current project is completed."""

    def __init__(self, project_name: str | None = None):
        where = f" ({project_name})" if project_name else ""
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This member is already assigned to an active project{where}. "
            "They can be reassigned once that project is completed.",
        )


class NCRStateError(HTTPException):
    """An NCR action was attempted that the current status doesn't allow — an
    illegal status transition, closing without a root cause or with corrective
    actions still outstanding, or mutating a closed NCR."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class LabReportStateError(HTTPException):
    """A lab cube-report action was attempted out of order — submitting a report
    before the testing day is established, re-submitting a milestone that's
    already in, or using an unknown/invalid report milestone age."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


# ---------------------------------------------------------------------------
# File-upload exceptions
# ---------------------------------------------------------------------------

class FileTooLargeError(HTTPException):
    def __init__(self, max_bytes: int):
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum upload size of {max_bytes // (1024 * 1024)} MB",
        )


class UnsupportedFileTypeError(HTTPException):
    def __init__(self, what: str):
        super().__init__(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {what}",
        )