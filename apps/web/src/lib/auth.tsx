import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SessionUser, Gym, GymFeatureKey, LoginRequest, MemberLoginRequest } from '@gymtech/shared';
import { GYM_FEATURES } from '@gymtech/shared';
import { api } from './api';

interface AuthContextType {
  user: SessionUser | null;
  gym: Gym | null;
  /**
   * The session JWT is in an httpOnly cookie the JS layer cannot read.
   * This field is kept for components that previously branched on `token`
   * presence; it now reflects "is the user signed in" rather than the
   * actual token value.
   */
  token: string | null;
  /**
   * License feature flags for the current gym (from GET /api/auth/me).
   * Null until hydrated — treated as "all enabled" so first paint never
   * hides modules. Platform admins and members always see all/null.
   */
  enabledFeatures: GymFeatureKey[] | null;
  hasFeature: (key: GymFeatureKey) => boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<any>;
  memberLogin: (credentials: MemberLoginRequest) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  // The session is now an httpOnly cookie; JS can't read it. We track
  // "is the user signed in" via the `user` state, which is populated by
  // /api/auth/me on mount. localStorage is no longer the source of truth.
  const [user, setUser] = useState<SessionUser | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<GymFeatureKey[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const hasFeature = (key: GymFeatureKey): boolean => {
    if (!enabledFeatures) return false;
    return enabledFeatures.includes(key);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const meData = await api.getMe();
        setUser(meData.user);
        if (meData.gym) setGym(meData.gym);
        setEnabledFeatures(meData.enabledFeatures ?? [...GYM_FEATURES]);
      } catch (err) {
        // No valid session — cookie expired or absent. Stay logged out.
        setUser(null);
        setGym(null);
        setEnabledFeatures(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /** Rehydrate license flags after a credential change (login responses
   * carry user+gym only, so flags come from a follow-up /me). */
  const refreshFeatures = async () => {
    try {
      const meData = await api.getMe();
      setEnabledFeatures(meData.enabledFeatures ?? [...GYM_FEATURES]);
    } catch {
      setEnabledFeatures(null);
    }
  };

  const login = async (credentials: LoginRequest) => {
    queryClient.clear();
    const res = await api.login(credentials);
    setUser(res.user);
    setGym(res.gym || null);
    await refreshFeatures();
    return res;
  };

  // Member-portal sign in. The server sets the session + CSRF cookies; we
  // project the member payload onto a SessionUser so route guards
  // (ProtectedRoute allowMember) and the shell recognise the session
  // immediately. A refresh rehydrates the same shape via /api/auth/me.
  // Without this, `user` stayed null and /portal bounced back to /login.
  const memberLogin = async (credentials: MemberLoginRequest) => {
    queryClient.clear();
    const res = await api.memberLogin(credentials);
    const m: any = res.member;
    const sessionUser: SessionUser = {
      id: m.id,
      email: m.email || `${String(m.memberCode || '').toLowerCase()}@member.gymtech.app`,
      name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Member',
      role: 'MEMBER',
      gymId: m.gymId ?? (res as any).gym?.id ?? null,
      isOwner: false,
      permissions: [],
      roleId: null,
    };
    setUser(sessionUser);
    setGym((res as any).gym || null);
    await refreshFeatures();
    return res;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Even if the server call fails, clear local state and redirect.
    }
    queryClient.clear();
    setUser(null);
    setGym(null);
    setEnabledFeatures(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ user, gym, token: user ? 'cookie' : null, enabledFeatures, hasFeature, isLoading, login, memberLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
