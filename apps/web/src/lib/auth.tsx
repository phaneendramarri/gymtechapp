import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SessionUser, Gym, LoginRequest, MenuNode } from '@gymtech/shared';
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
  /** DB-driven menu tree, filtered by the user's role permissions. */
  menu: MenuNode[];
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
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
  const [menu, setMenu] = useState<MenuNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const [meData, menuData] = await Promise.all([api.getMe(), api.getMenu()]);
        setUser(meData.user);
        if (meData.gym) setGym(meData.gym);
        setMenu(menuData.menu ?? []);
      } catch (err) {
        // No valid session — cookie expired or absent. Stay logged out.
        setUser(null);
        setGym(null);
        setMenu([]);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    queryClient.clear();
    const res = await api.login(credentials);
    setUser(res.user);
    setGym(res.gym || null);
    // Fetch menu after login — server returns pre-filtered menu per role
    const menuData = await api.getMenu();
    setMenu(menuData.menu ?? []);
    // The server has set the httpOnly session cookie + CSRF cookie in
    // the response. JS doesn't need to (and can't) read the session JWT.
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
    setMenu([]);
    window.location.hash = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ user, gym, menu, token: user ? 'cookie' : null, isLoading, login, logout }}
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
