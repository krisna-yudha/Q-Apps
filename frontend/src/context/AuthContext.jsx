import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import {
  getStoredToken,
  getStoredUser,
  saveAuthSession,
  clearAuthSession
} from '../utils/cookie';

const AuthContext = createContext(null);

// Inactivity timeout: 20 minutes
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
// Heartbeat interval: 60 seconds
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [logoutReason, setLogoutReason] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('digiqa_logout_reason') || '' : '';
    } catch {
      return '';
    }
  });

  const lastActivityRef = useRef(Date.now());
  const throttleActivityRef = useRef(0);

  // Helper to record user activity locally & across tabs
  const recordUserActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    // Throttle writing to localStorage to once every 5 seconds
    if (now - throttleActivityRef.current > 5000) {
      throttleActivityRef.current = now;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('digiqa_last_activity', now.toString());
        }
      } catch (e) {
        // Ignore storage quotas
      }
    }
  }, []);

  // Multi-tab synchronization & Session Expiry Listeners
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key || e.key === 'digiqa_token' || e.key === 'digiqa_user' || e.key === 'digiqa_auth_sync') {
        const currentToken = getStoredToken();
        const currentUser = getStoredUser();
        setToken(currentToken);
        setUser(currentUser);
      }
    };

    const handleAuthExpired = (e) => {
      const reasonMsg = e?.detail?.message || sessionStorage.getItem('digiqa_logout_reason') || 'Sesi Anda telah berakhir.';
      setLogoutReason(reasonMsg);
      clearAuthSession();
      setUser(null);
      setToken(null);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('digiqa:auth_expired', handleAuthExpired);

    // Initial Token & User Verification on Mount (Eliminates zombie/stuck sessions)
    const verifyInitialSession = async () => {
      const initialToken = getStoredToken();
      const initialUser = getStoredUser();

      if (initialToken) {
        try {
          const res = await api.getMe();
          if (res?.success && res.user) {
            setUser(res.user);
            setToken(initialToken);
            saveAuthSession(initialToken, res.user, localStorage.getItem('digiqa_remember') === '1');
          } else {
            clearAuthSession();
            setUser(null);
            setToken(null);
          }
        } catch (err) {
          if (err.status === 401 || err.response?.status === 401) {
            clearAuthSession();
            setUser(null);
            setToken(null);
          }
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setIsInitializing(false);
    };

    verifyInitialSession();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('digiqa:auth_expired', handleAuthExpired);
    };
  }, []);

  // Inactivity / Idle Auto Logout Timer & Activity Listeners
  useEffect(() => {
    if (!token || !user) return;

    // Reset last activity timer on login
    recordUserActivity();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserEvent = () => recordUserActivity();

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserEvent, { passive: true });
    });

    // Check inactivity periodically every 10 seconds
    const inactivityInterval = setInterval(() => {
      try {
        const storedActivity = Number(localStorage.getItem('digiqa_last_activity') || lastActivityRef.current);
        const idleDuration = Date.now() - storedActivity;

        if (idleDuration >= INACTIVITY_TIMEOUT_MS) {
          const reasonMsg = 'Sesi Anda telah berakhir otomatis karena tidak ada aktivitas selama 20 menit.';
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('digiqa_logout_reason', reasonMsg);
          }
          setLogoutReason(reasonMsg);
          clearAuthSession();
          setUser(null);
          setToken(null);
          window.dispatchEvent(new CustomEvent('digiqa:auth_expired', { detail: { message: reasonMsg } }));
        }
      } catch {
        // Ignore errors
      }
    }, 10000);

    // Heartbeat: keep server presence & last_seen updated while active
    const heartbeatInterval = setInterval(() => {
      const storedActivity = Number(localStorage.getItem('digiqa_last_activity') || lastActivityRef.current);
      const idleDuration = Date.now() - storedActivity;

      // Only send heartbeat if active within the last 5 minutes
      if (idleDuration < 5 * 60 * 1000) {
        api.sendHeartbeat().catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserEvent);
      });
      clearInterval(inactivityInterval);
      clearInterval(heartbeatInterval);
    };
  }, [token, user, recordUserActivity]);

  const login = async (username, password, rememberMe = true) => {
    setLoading(true);
    setLogoutReason('');
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('digiqa_logout_reason');
      }
      const res = await api.login(username, password);
      setUser(res.user);
      setToken(res.token);
      saveAuthSession(res.token, res.user, rememberMe);
      recordUserActivity();
      return res;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    saveAuthSession(token, updatedUser, localStorage.getItem('digiqa_remember') === '1');
  };

  const logout = async (reason = '') => {
    if (reason && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('digiqa_logout_reason', reason);
      setLogoutReason(reason);
    }
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

  const clearLogoutReason = () => {
    setLogoutReason('');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('digiqa_logout_reason');
    }
  };

  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated,
      loading,
      isInitializing,
      logoutReason,
      clearLogoutReason,
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


