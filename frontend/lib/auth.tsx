'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiException, Me, Permission } from './api';

interface AuthState {
  me: Me | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  can: (feature: string, action: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await api.get<Me>('/auth/me');
      setMe(data);
    } catch (e) {
      if (e instanceof ApiException && e.status === 401) setMe(null);
      else setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setMe(null);
    }
  }, []);

  const can = useCallback(
    (feature: string, action: string) =>
      !!me?.permissions?.some((p: Permission) => p.feature === feature && p.action === action),
    [me],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <AuthContext.Provider value={{ me, loading, reload, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
