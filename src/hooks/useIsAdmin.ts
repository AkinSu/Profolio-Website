"use client";

import { useState, useEffect } from 'react';

export function useIsAdmin(): { isAdmin: boolean; isAdminResolved: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminResolved, setIsAdminResolved] = useState(false);

  useEffect(() => {
    // Check URL for ?admin=SECRET and set cookie
    const params = new URLSearchParams(window.location.search);
    const adminParam = params.get('admin');
    if (adminParam) {
      document.cookie = `admin_token=${adminParam}; path=/; SameSite=Strict`;
      // Remove the query param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState({}, '', url.toString());
    }

    // Verify the cookie against the server
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

  return { isAdmin, isAdminResolved };
}
