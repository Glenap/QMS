// TypeScript mirrors of the backend Pydantic auth schemas
// (backend/app/schemas/auth.py). Keep these in sync with the API.

// Mirrors app.models.auth.UserRole
export type UserRole =
  | 'CLIENT_ADMIN'
  | 'CLIENT_USER'
  | 'CONTRACTOR_ADMIN'
  | 'CONTRACTOR_USER'
  | 'PROJECT_MANAGER'
  | 'QUALITY_ENGINEER'
  | 'SUPERVISOR';

// Mirrors app.models.auth.OrgType / OrgStatus
export type OrgType = 'CLIENT' | 'CONTRACTOR';
export type OrgStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

export interface UserResponse {
  user_id: number;
  org_id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_org_admin: boolean;
  is_active: boolean;
  is_offboarded: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface OrgResponse {
  org_id: number;
  org_name: string;
  org_type: OrgType;
  status: OrgStatus;
  contact_email: string;
  contact_phone: string | null;
  registered_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserResponse;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
}

export interface MeResponse {
  user: UserResponse;
  organisation: OrgResponse;
}

// ── Request payloads ──────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OrgRegisterRequest {
  org_name: string;
  contact_email: string;
  contact_phone?: string | null;
  full_name: string;
  password: string;
  confirm_password: string;
}

export interface AcceptInvitationRequest {
  token: string;
  full_name: string;
  password: string;
  confirm_password: string;
}

// Returned by register + accept-invitation: account is created but inactive
// until the emailed OTP is verified.
export interface OtpChallengeResponse {
  email: string;
  otp_required: boolean;
  message: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
}

// ── Org team (build the roster; assign to projects later) ──────────────────

export interface InviteRequest {
  invited_email: string;
  role: UserRole; // CLIENT_USER (client admin) | CONTRACTOR_USER (contractor admin)
}

export interface InvitationResponse {
  invitation_id: number;
  org_id: number;
  invited_email: string;
  role: UserRole;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface TeamMemberResponse {
  email: string;
  full_name: string | null;
  role: UserRole;
  status: string; // ACTIVE | UNVERIFIED | INVITED | DEACTIVATED
  is_org_admin: boolean;
  joined_at: string | null;
  user_id: number | null;
  // The active project this member is currently assigned to (one at a time),
  // so a project picker can grey out busy members. Null when free.
  active_project_id: number | null;
  active_project_name: string | null;
}
