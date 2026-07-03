'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '@/lib/api';
import { logger } from '@/lib/logger';
import type { AuthUser } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // restore session from stored token on mount
  useEffect(() => {
    if (!api.getToken()) {
      setLoading(false);
      return;
    }
    api
      .fetchMe()
      .then((r) => {
        setUser(r.user);
        logger.info('session restored', { user: r.user.username });
      })
      .catch((e) => {
        logger.warn('session restore failed', e);
        api.clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const { token, user } = await api.login(username, password);
    api.setToken(token);
    setUser(user);
    logger.info('logged in', { user: user.username, role: user.role });
  }

  function logout() {
    logger.info('logged out', { user: user?.username });
    api.clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
