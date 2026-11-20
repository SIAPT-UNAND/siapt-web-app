import { useCallback, useEffect, useState } from 'react';
import * as authService from '../services/authService.js';

export default function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let batal = false;
    authService
      .getSession()
      .then((data) => {
        if (!batal) setUser(data.user);
      })
      .catch(() => {
        // belum login: biarkan user = null
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });
    return () => {
      batal = true;
    };
  }, []);

  const login = useCallback(async (pengenal, kataSandi) => {
    const data = await authService.login(pengenal, kataSandi);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return { user, loading, login, logout };
}