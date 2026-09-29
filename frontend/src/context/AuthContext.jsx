import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, registerUser, getMe } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('drm_token');
    const storedUser = localStorage.getItem('drm_user');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Re-validate the token against the server in the background.
      getMe()
        .then((res) => {
          const refreshed = { id: res.data.id, name: res.data.name, email: res.data.email, role: res.data.role };
          setUser(refreshed);
          localStorage.setItem('drm_user', JSON.stringify(refreshed));
        })
        .catch(() => {
          // The response interceptor in api.js already handles redirect-on-401.
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password, expectedRole) {
    const res = await loginUser({ email, password, expectedRole });
    localStorage.setItem('drm_token', res.data.token);
    localStorage.setItem('drm_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }

  async function register(name, email, password, confirmPassword, role) {
    const res = await registerUser({ name, email, password, confirmPassword, role });
    localStorage.setItem('drm_token', res.data.token);
    localStorage.setItem('drm_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem('drm_token');
    localStorage.removeItem('drm_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
