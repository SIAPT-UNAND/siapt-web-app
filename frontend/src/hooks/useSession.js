import { useCallback, useEffect, useState } from 'react';
import * as authService from '../services/authService.js';

export default function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    let batal = false;
    authService
      .getSession()
      .then((data) => {
        if (!batal) setUser(data.user);
      })
      .catch((err) => {
        // 401 = memang belum login. Galat lain: status sesi belum diketahui.
        if (!batal && err?.status !== 401) {
          setSessionError(err?.message || 'Status sesi tidak dapat diperiksa.');
        }
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });
    return () => {
      batal = true;
    };
  }, [versi]);

  const retrySession = useCallback(() => {
    setSessionError('');
    setLoading(true);
    setVersi((v) => v + 1);
  }, []);

  const login = useCallback(async (pengenal, kataSandi) => {
    const data = await authService.login(pengenal, kataSandi);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    // Jika gagal, galat diteruskan dan sesi tetap dianggap masih login
    await authService.logout();
    setUser(null);
  }, []);

  return { user, loading, sessionError, retrySession, login, logout };
}