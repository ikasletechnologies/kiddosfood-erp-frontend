"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, setupApi } from '@/lib/api';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  franchiseId?: string;
}

interface SetupStatus {
  initialized: boolean;
  hqConfigured: boolean;
  hqWarehouseConfigured: boolean;
  hq: { id: string; name: string } | null;
  warehouse: { id: string; name: string } | null;
  nextWarehouseCode?: string | null;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setupStatus: SetupStatus | null;
  setupStatusLoading: boolean;
  refreshSetupStatus: () => Promise<void>;
}

const isSuperAdmin = (user: User | null) =>
  ((user as any)?.role?.name || user?.role || '').toUpperCase() === 'SUPER_ADMIN';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStatusLoading, setSetupStatusLoading] = useState(false);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setSetupStatus(null);
    router.push('/login');
  }, [router]);

  // Only SUPER_ADMIN acts on setup status, so no other role ever pays for
  // this fetch on login. One-time per session (context state, not
  // re-derived per route) — see refreshSetupStatus for the one place it's
  // deliberately re-fetched (right after the wizard completes a step).
  const refreshSetupStatus = useCallback(async (forUser?: User | null) => {
    const target = forUser !== undefined ? forUser : user;
    if (!isSuperAdmin(target)) return;
    setSetupStatusLoading(true);
    try {
      const response = await setupApi.getStatus();
      setSetupStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch setup status:', error);
    } finally {
      setSetupStatusLoading(false);
    }
  }, [user]);

  const login = useCallback((accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    if (isSuperAdmin(userData)) refreshSetupStatus(userData);
  }, [refreshSetupStatus]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.me();
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      // If unauthorized, logout
      if ((error as any).response?.status === 401) {
        logout();
      }
    }
  }, [logout]);

  useEffect(() => {
    const initializeAuth = () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');

      if (storedUser && token) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          if (isSuperAdmin(parsedUser)) refreshSetupStatus(parsedUser);
        } catch (e) {
          console.error("Failed to parse stored user", e);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout]);

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    setupStatus,
    setupStatusLoading,
    refreshSetupStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
