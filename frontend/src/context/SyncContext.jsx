import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const SyncContext = createContext(null);

export const SyncProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [toastMessage, setToastMessage] = useState(null);

  const lastVersionRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text: msg, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      if (res?.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      // ignore
    }
  };

  const checkSync = async () => {
    try {
      setIsSyncing(true);
      const res = await api.getSyncStatus();

      if (res?.success && res.data_version) {
        setLastSyncTime(new Date());

        // Check if data version changed
        if (lastVersionRef.current && lastVersionRef.current !== res.data_version) {
          // Trigger global refresh event for active page components
          window.dispatchEvent(new CustomEvent('digiqa:data_refresh', {
            detail: { version: res.data_version, timestamp: Date.now() }
          }));

          fetchNotifications();
          showToast('Data diperbarui secara otomatis dari backend.', 'success');
        }

        lastVersionRef.current = res.data_version;
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsSyncing(false);
    }
  };

  // Interval Konfigurasi: Auto-sync 1 jam sekali, Notifikasi tetap realtime (8 detik)
  const DATA_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 Jam (3.600.000 ms)
  const NOTIFICATION_REALTIME_MS = 8 * 1000;      // 8 Detik (Realtime Notif)

  // Initial load & Separated Timers
  useEffect(() => {
    fetchNotifications();
    checkSync();

    // 1. Polling Notifikasi Real-time
    const notifInterval = setInterval(() => {
      fetchNotifications();
    }, NOTIFICATION_REALTIME_MS);

    // 2. Auto Sync Data Berkala (1 Jam Sekali)
    const dataSyncInterval = setInterval(() => {
      checkSync();
    }, DATA_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(notifInterval);
      clearInterval(dataSyncInterval);
    };
  }, []);

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      // ignore
    }
  };

  const markSingleRead = async (id) => {
    try {
      await api.markNotificationsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? ({ ...n, is_read: true }) : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      // ignore
    }
  };

  const triggerDataUpdate = () => {
    window.dispatchEvent(new CustomEvent('digiqa:data_refresh', {
      detail: { timestamp: Date.now() }
    }));
    checkSync();
    fetchNotifications();
  };

  return (
    <SyncContext.Provider value={{
      notifications,
      unreadCount,
      isSyncing,
      lastSyncTime,
      toastMessage,
      fetchNotifications,
      markAllRead,
      markSingleRead,
      triggerDataUpdate
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
