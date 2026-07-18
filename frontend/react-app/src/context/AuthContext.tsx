// AuthProvider — holds the current user/org, persists the session to
// localStorage, and exposes login/logout/refreshMe to the tree.

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import { tokenStorage } from '../api/tokenStorage';
import { AUTH_LOGOUT_EVENT } from '../api/client';
import { queryClient } from '../lib/queryClient';
import type {
  UserResponse,
  OrgResponse,
  OrgRegisterRequest,
  AcceptInvitationRequest,
} from '../types/auth';
import { AuthContext } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(() => tokenStorage.getUser());
  const [organisation, setOrganisation] = useState<OrgResponse | null>(null);
  // If a token exists we must validate it before rendering protected routes.
  const [isLoading, setIsLoading] = useState<boolean>(() => !!tokenStorage.getAccess());

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    // The query client is a module singleton and logout is a pure SPA
    // navigation, so nothing tears the cache down on its own. Without this the
    // next user to sign in on the same tab renders the previous user's
    // projects/NCRs/analytics until each query passes staleTime.
    queryClient.clear();
    setUser(null);
    setOrganisation(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await authApi.me();
    setUser(me.user);
    setOrganisation(me.organisation);
    tokenStorage.setUser(me.user);
  }, []);

  // Re-arm the AI analyst greeting so it blinks "ask me anything" after each
  // fresh sign-in (the widget suppresses it once shown per session).
  const armAnalystGreeting = () => {
    try { sessionStorage.removeItem('qms-analyst-greeted'); } catch { /* storage unavailable */ }
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    tokenStorage.setSession(res.access_token, res.refresh_token, res.user);
    setUser(res.user);
    armAnalystGreeting();
    // Pull org details (login response doesn't include them).
    await refreshMe();
  }, [refreshMe]);

  // register/acceptInvitation create an inactive account and return an OTP
  // challenge — they do NOT establish a session. verifyOtp does that.
  const register = useCallback(async (data: OrgRegisterRequest) => {
    return authApi.register(data);
  }, []);

  const acceptInvitation = useCallback(async (data: AcceptInvitationRequest) => {
    return authApi.acceptInvitation(data);
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const res = await authApi.verifyOtp({ email, code });
    tokenStorage.setSession(res.access_token, res.refresh_token, res.user);
    setUser(res.user);
    armAnalystGreeting();
    await refreshMe();
  }, [refreshMe]);

  const resendOtp = useCallback(async (email: string) => {
    await authApi.resendOtp(email);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort — clear locally even if the server call fails.
    }
    clearSession();
  }, [clearSession]);

  // Bootstrap: validate any stored token on first load. isLoading already
  // initialises to false when there's no stored token, so we only need to do
  // work (and flip loading off) when a token is present.
  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      return;
    }
    let cancelled = false;
    const bootstrap = async () => {
      try {
        await refreshMe();
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshMe, clearSession]);

  // Forced logout dispatched by the axios client when refresh fails.
  useEffect(() => {
    const onForcedLogout = () => clearSession();
    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organisation,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        acceptInvitation,
        verifyOtp,
        resendOtp,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
