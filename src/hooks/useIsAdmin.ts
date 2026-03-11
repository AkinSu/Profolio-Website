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
    async function verify() {
      try {
        const res = await fetch('/api/admin/verify');
        const data = await res.json();
        setIsAdmin(data.isAdmin === true);
      } catch {
        setIsAdmin(false);
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
