"""
schemas/auth.py
---------------
Pydantic v2 request and response models for auth flows.

Rule: never return hashed_password, never return token blacklist data.
Request schemas validate input. Response schemas control output.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.models.auth import OrgType, UserRole, OrgStatus, InvitationStatus


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


class ContractorRegisterRequest(BaseModel):
    """Client registers a contractor org on portal."""
    org_name: str
    contact_email: EmailStr
    contact_phone: str | None = None


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
    created_at: datetime

    model_config = {"from_attributes": True}


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
      - Client inviting contractor admin
      - Contractor inviting PM
      - PM inviting QE/Supervisor
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