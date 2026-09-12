import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  getStoredToken,
  getStoredUser,
  saveAuthSession,
  clearAuthSession
} from '../utils/cookie';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(false);

  // Multi-tab synchronization: Listen to changes in localStorage/cookies across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'digiqa_token' || e.key === 'digiqa_user') {
        const currentToken = getStoredToken();
        const currentUser = getStoredUser();
        setToken(currentToken);
        setUser(currentUser);
      }
    };

    const handleAuthExpired = () => {
      clearAuthSession();
      setUser(null);
      setToken(null);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('digiqa:auth_expired', handleAuthExpired);

    // Initial sync check on mount: Ensure token & user are saved to cookies and storage
    const initialToken = getStoredToken();
    const initialUser = getStoredUser();
    if (initialToken && initialUser) {
      saveAuthSession(initialToken, initialUser);
    }
    if (initialToken && !token) setToken(initialToken);
    if (initialUser && !user) setUser(initialUser);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('digiqa:auth_expired', handleAuthExpired);
    };
  }, []);

  const login = async (username, password, rememberMe = true) => {
    setLoading(true);
    try {
      const res = await api.login(username, password, rememberMe);
      setUser(res.user);
      setToken(res.token);
      saveAuthSession(res.token, res.user);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    saveAuthSession(token, updatedUser);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore network errors on logout
    } finally {
      clearAuthSession();
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


