'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import { getTokenInfo, setTokenInfo, clearTokenInfo } from '../../lib/auth';

type AuthContextType = {
  token: string | null;
  user: any | null;
  setAuth: (data: { token: string; user: any; expiresAt: string }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  setAuth: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // run once on client
  useEffect(() => {
    const tokenInfo = getTokenInfo();
    const storedUser = localStorage.getItem('user');
    if (tokenInfo) setToken(tokenInfo.token);
    if (storedUser) setUser(JSON.parse(storedUser));
    setHydrated(true);
  }, []);

  // auto refresh token
  useEffect(() => {
    if (!token) return;

    const tokenInfo = getTokenInfo();
    if (!tokenInfo) return;

    const expiryTime = new Date(tokenInfo.expiresAt).getTime();
    const refreshTime = expiryTime - 2 * 60 * 1000; // 2 minutes before expiry
    const delay = Math.max(refreshTime - Date.now(), 0);

    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.refreshToken();
        console.log(res.message);
        if (res.success && res.data) {
          setToken(res.data.token);
          setTokenInfo(res.data.token, res.data.expiresAt);
        } else {
          clearTokenInfo();
          setToken(null);
          setUser(null);
        }
      } catch {
        clearTokenInfo();
        setToken(null);
        setUser(null);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [token]);

  const setAuth = (data: { token: string; user: any; expiresAt: string }) => {
    setToken(data.token);
    setUser(data.user);
    setTokenInfo(data.token, data.expiresAt);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = async () => {
    if (!token) return; // use existing top-level token
    try {
      await apiClient.logout(token);
    } finally {
      clearTokenInfo();
      setToken(null);
      setUser(null);
    }
  };

  if (!hydrated) return null;

  return (
    <AuthContext.Provider value={{ token, user, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
