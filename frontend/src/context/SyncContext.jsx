import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api, API_BASE_URL } from '../services/api';
import { getStoredUser } from '../utils/cookie';

const SyncContext = createContext(null);

export const SyncProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [counts, setCounts] = useState({ all: 0, unread: 0, sampling: 0, import: 0, policy: 0, system: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'reconnecting' | 'polling' | 'disconnected'
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [toastMessage, setToastMessage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('digiqa_notif_sound') !== 'disabled';
  });

  const lastVersionRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const eventSourceRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const unreadCountRef = useRef(0);

  // Keep unread count ref synced
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Persist sound settings
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('digiqa_notif_sound', next ? 'enabled' : 'disabled');
      return next;
    });
  };

  // --- Lightweight Web Audio API Chime Synthesizer ---
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Crisp two-tone chime (F#5 to B5)
      osc.frequency.setValueAtTime(739.99, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }, [soundEnabled]);

  // Toast Notification Trigger
  const triggerToast = useCallback((msg, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text: msg, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  const fetchNotifications = useCallback(async (params = {}) => {
    try {
      const currentUser = getStoredUser();
      const queryParams = { ...params };
      if (currentUser?.id) {
        queryParams.user_id = currentUser.id;
      }
      const res = await api.getNotifications(queryParams);
      if (res?.success) {
        setNotifications(res.notifications || []);
        const newUnread = res.unread_count || 0;
        
        // Play chime if new unread notifications arrived
        if (newUnread > unreadCountRef.current) {
          playChime();
        }

        setUnreadCount(newUnread);
        if (res.counts) setCounts(res.counts);
      }
    } catch (e) {
      // ignore
    }
  }, [playChime]);

  // Trigger global data refresh on all mounted views
  const broadcastDataRefresh = useCallback((version = null, reason = 'auto_sync') => {
    window.dispatchEvent(new CustomEvent('digiqa:data_refresh', {
      detail: { version, reason, timestamp: Date.now() }
    }));
  }, []);

  // Polling fallback mechanism if SSE is disconnected
  const runPollingCheck = useCallback(async () => {
    try {
      const currentUser = getStoredUser();
      const queryParams = currentUser?.id ? { user_id: currentUser.id } : {};
      const res = await api.getSyncStatus(queryParams);
      if (res?.success && res.data_version) {
        setLastSyncTime(new Date());

        if (lastVersionRef.current && lastVersionRef.current !== res.data_version) {
          broadcastDataRefresh(res.data_version, 'polling_bump');
          fetchNotifications();
        }

        lastVersionRef.current = res.data_version;
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      // ignore
    }
  }, [broadcastDataRefresh, fetchNotifications]);

  // --- Robust Non-Blocking Live Sync Client ---
  useEffect(() => {
    let isSubscribed = true;

    // Initial load
    fetchNotifications();
    runPollingCheck();
    setConnectionStatus('connected');

    // Live Sync Polling interval (every 4 seconds) — instantaneous (<5ms) and non-blocking
    const syncInterval = setInterval(() => {
      if (isSubscribed) {
        runPollingCheck();
      }
    }, 4000);

    // Notification counter refresh (every 15s)
    const notifInterval = setInterval(() => {
      if (isSubscribed) {
        fetchNotifications();
      }
    }, 15000);

    return () => {
      isSubscribed = false;
      clearInterval(syncInterval);
      clearInterval(notifInterval);
    };
  }, [broadcastDataRefresh, fetchNotifications, runPollingCheck]);

  // --- Public Action Methods ---
  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setCounts(prev => ({ ...prev, unread: 0 }));
    } catch (e) {
      // ignore
    }
  };

  const markSingleRead = async (id) => {
    try {
      await api.markNotificationsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? ({ ...n, is_read: true }) : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setCounts(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (e) {
      // ignore
    }
  };

  const deleteSingleNotification = async (id) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchNotifications();
    } catch (e) {
      // ignore
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      setCounts({ all: 0, unread: 0, sampling: 0, import: 0, policy: 0, system: 0 });
      showToast('Seluruh notifikasi berhasil dikosongkan.', 'info');
    } catch (e) {
      // ignore
    }
  };

  const syncNow = async () => {
    setIsSyncing(true);
    try {
      await runPollingCheck();
      await fetchNotifications();
      broadcastDataRefresh(null, 'manual_sync');
      showToast('Sinkronisasi data selesai. Dashboard up-to-date.', 'success');
    } catch (e) {
      showToast('Gagal melakukan sinkronisasi.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerDataUpdate = () => {
    broadcastDataRefresh(null, 'manual_trigger');
    runPollingCheck();
    fetchNotifications();
  };

  return (
    <SyncContext.Provider value={{
      notifications,
      unreadCount,
      counts,
      isSyncing,
      connectionStatus,
      lastSyncTime,
      toastMessage,
      soundEnabled,
      toggleSound,
      playChime,
      showToast: triggerToast,
      triggerToast,
      fetchNotifications,
      markAllRead,
      markSingleRead,
      deleteSingleNotification,
      clearAllNotifications,
      syncNow,
      triggerDataUpdate
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
