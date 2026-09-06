import React, { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

// Helper: baca token dari sessionStorage dulu, fallback ke localStorage
const getStoredToken = () =>
  sessionStorage.getItem('digiqa_token') || localStorage.getItem('digiqa_token') || null;

const getStoredUser = () => {
  const saved =
    sessionStorage.getItem('digiqa_user') || localStorage.getItem('digiqa_user');
  try { return saved ? JSON.parse(saved) : null; } catch { return null; }
};

// Simpan ke storage sesuai flag rememberMe
const saveToStorage = (token, user, rememberMe) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('digiqa_token', token);
  storage.setItem('digiqa_user', JSON.stringify(user));
};

// Hapus dari kedua storage agar tidak ada sisa
const clearStorage = () => {
  ['digiqa_token', 'digiqa_user'].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(false);

  const login = async (username, password, rememberMe = false) => {
    setLoading(true);
    try {
      const res = await api.login(username, password, rememberMe);
      setUser(res.user);
      setToken(res.token);
      saveToStorage(res.token, res.user, rememberMe);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    // Update di storage mana pun yang sedang aktif
    if (localStorage.getItem('digiqa_token')) {
      localStorage.setItem('digiqa_user', JSON.stringify(updatedUser));
    } else {
      sessionStorage.setItem('digiqa_user', JSON.stringify(updatedUser));
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    } finally {
      clearStorage();
      setUser(null);
      setToken(null);
    }
  };

  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated,
      loading,
      login,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
