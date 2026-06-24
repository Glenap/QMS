// Auth API — thin typed wrappers over the backend /auth/* endpoints.
// See backend/app/routers/auth.py.

import { api } from './client';
import type {
  LoginRequest,
  OrgRegisterRequest,
  AcceptInvitationRequest,
  OtpChallengeResponse,
  VerifyOtpRequest,
  TokenResponse,
  MeResponse,
  UserResponse,
} from '../types/auth';

export const authApi = {
  login(data: LoginRequest): Promise<TokenResponse> {
    return api.post<TokenResponse>('/auth/login', data).then((r) => r.data);
  },

  // Register + accept-invitation create an inactive account and return an OTP
  // challenge; tokens are issued by verifyOtp once the code is confirmed.
  register(data: OrgRegisterRequest): Promise<OtpChallengeResponse> {
    return api.post<OtpChallengeResponse>('/auth/register', data).then((r) => r.data);
  },

  acceptInvitation(data: AcceptInvitationRequest): Promise<OtpChallengeResponse> {
    return api.post<OtpChallengeResponse>('/auth/accept-invitation', data).then((r) => r.data);
  },

  verifyOtp(data: VerifyOtpRequest): Promise<TokenResponse> {
    return api.post<TokenResponse>('/auth/verify-otp', data).then((r) => r.data);
  },

  resendOtp(email: string): Promise<OtpChallengeResponse> {
    return api.post<OtpChallengeResponse>('/auth/resend-otp', { email }).then((r) => r.data);
  },

  me(): Promise<MeResponse> {
    return api.get<MeResponse>('/auth/me').then((r) => r.data);
  },

  // Set (data: URL) or clear (null) the current user's profile picture.
  updateAvatar(avatarUrl: string | null): Promise<UserResponse> {
    return api.put<UserResponse>('/auth/me/avatar', { avatar_url: avatarUrl }).then((r) => r.data);
  },

  // Org admin only — offboard / restore a member of their org.
  deactivateUser(userId: number): Promise<UserResponse> {
    return api.post<UserResponse>(`/auth/users/${userId}/deactivate`).then((r) => r.data);
  },

  reactivateUser(userId: number): Promise<UserResponse> {
    return api.post<UserResponse>(`/auth/users/${userId}/reactivate`).then((r) => r.data);
  },

  logout(): Promise<void> {
    return api.post('/auth/logout').then(() => undefined);
  },
};
