"use client";

import { useState, useEffect, useCallback } from 'react';

interface UseIsAdminReturn {
  isAdmin: boolean;
  isAdminResolved: boolean;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useIsAdmin(): UseIsAdminReturn {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminResolved, setIsAdminResolved] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // Clear any legacy non-httpOnly admin_token cookie from old auth system
    document.cookie = 'admin_token=; path=/; max-age=0';

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const wantsDev = params.has('admin');

    // Clean URL params
    if (wantsDev) {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState({}, '', url.toString());
    }

    async function verify() {
      try {
        // Check existing session
        const res = await fetch('/api/admin/verify');
        const data = await res.json();
        const verified = data.isAdmin === true;
        setIsAdmin(verified);

        // If ?dev was in URL and not already authenticated, show login
        if (wantsDev && !verified) {
          setShowLogin(true);
        }
      } catch {
        setIsAdmin(false);
        if (wantsDev) setShowLogin(true);
      } finally {
        setIsAdminResolved(true);
      }
    }
    verify();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setIsAdmin(true);
        setShowLogin(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAdmin(false);
  }, []);

  return { isAdmin, isAdminResolved, showLogin, setShowLogin, login, logout };
}
