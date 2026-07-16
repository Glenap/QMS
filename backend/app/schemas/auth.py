"""
schemas/auth.py
---------------
Pydantic v2 request and response models for auth flows.

Rule: never return hashed_password, never return token blacklist data.
Request schemas validate input. Response schemas control output.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.models.auth import InvitationStatus, OrgStatus, OrgType, UserRole

# ---------------------------------------------------------------------------
# Organisation schemas
# ---------------------------------------------------------------------------

class OrgRegisterRequest(BaseModel):
    """Client self-registers their company."""
    org_name: str
    contact_email: EmailStr
    contact_phone: str | None = None
    # First user details
    full_name: str
    password: str
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class OrgResponse(BaseModel):
    org_id: int
    org_name: str
    org_type: OrgType
    status: OrgStatus
    contact_email: str
    contact_phone: str | None
    registered_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    user_id: int
    org_id: int
    email: str
    full_name: str
    role: UserRole
    is_org_admin: bool
    is_active: bool
    is_offboarded: bool = False
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AvatarUpdate(BaseModel):
    """Set or clear the current user's profile picture.

    avatar_url is a small `data:image/...;base64,` URL (the frontend resizes the
    image to a thumbnail before upload). null clears the picture.
    """

    avatar_url: str | None = None

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if not v.startswith("data:image/"):
            raise ValueError("avatar_url must be a data:image/… URL")
        # ~1.5 MB cap on the encoded string keeps the users row small.
        if len(v) > 1_500_000:
            raise ValueError("Image is too large — please use a smaller picture")
        return v


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Returned on login and token refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    """Returned when refreshing — only new access token."""
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Invitation schemas
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    """
    Invite a user to join an org.
    Used for:
      - Client admin inviting a client user
      - Contractor admin inviting a contractor user or team member
        (PM / Supervisor / QE)
      - Contractor user inviting team members (PM / Supervisor / QE)
    """
    invited_email: EmailStr
    role: UserRole


class InvitationResponse(BaseModel):
    invitation_id: int
    org_id: int
    invited_email: str
    role: UserRole
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AcceptInvitationRequest(BaseModel):
    """User accepts invitation and registers their account."""
    token: str
    full_name: str
    password: str
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ---------------------------------------------------------------------------
# Me schema
# ---------------------------------------------------------------------------

class MeResponse(BaseModel):
    """Current user with their organisation details."""
    user: UserResponse
    organisation: OrgResponse


# ---------------------------------------------------------------------------
# OTP (email verification — activation only)
# ---------------------------------------------------------------------------

class OtpChallengeResponse(BaseModel):
    """
    Returned by signup and accept-invitation. The account is created but
    inactive; the user must verify the emailed code via /auth/verify-otp
    before tokens are issued.
    """
    email: EmailStr
    otp_required: bool = True
    message: str = "We emailed you a verification code. Enter it to activate your account."


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


# ---------------------------------------------------------------------------
# Team directory
# ---------------------------------------------------------------------------

class TeamMemberResponse(BaseModel):
    """
    A row in the org's team directory: either an existing user or a pending
    invitation. status is ACTIVE / UNVERIFIED (user awaiting OTP) / INVITED
    (invitation sent, not yet accepted).
    """
    email: str
    full_name: str | None
    role: UserRole
    status: str
    is_org_admin: bool
    joined_at: datetime | None
    user_id: int | None = None
    # Availability: the active project this member is currently assigned to (a
    # member can be on only one at a time), so the project picker can grey out
    # busy members. None when the member is free to assign.
    active_project_id: int | None = None
    active_project_name: str | None = None