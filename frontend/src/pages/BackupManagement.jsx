import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  HardDrive,
  Database,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Zap,
  FileSpreadsheet,
  Layers,
  Key,
  Trash2,
  Check,
  X,
  Upload,
  Play,
  FileText,
  SlidersHorizontal,
  History,
  ShieldCheck,
  Inbox,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Lock,
  Sparkles,
  ChevronRight,
  Info,
  Shield,
  FileJson,
  CheckSquare,
  Square,
  Unlink,
  Share2,
  UserCheck,
  HelpCircle,
  ArrowRight,
  ChevronLeft,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';

export const BackupManagement = () => {
  const { user } = useAuth();
  const { showConfirm, showToast } = useDialog();

  // Active Tab: 'credentials', 'schedule', 'logs'
  const [activeTab, setActiveTab] = useState('credentials');

  // Connection Auth Mode: 'oauth2' (Personal Drive 15GB) or 'service_account' (Shared Drive)
  const [authType, setAuthType] = useState('oauth2');

  // Per-field Visibility & Masking States
  const [hideFolderId, setHideFolderId] = useState(true);
  const [hideClientId, setHideClientId] = useState(true);
  const [hideClientSecret, setHideClientSecret] = useState(true);
  const [hideRefreshToken, setHideRefreshToken] = useState(true);
  const [hideJsonContent, setHideJsonContent] = useState(true);
  const [hideClientEmail, setHideClientEmail] = useState(true);

  // Loading States
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [resettingConfig, setResettingConfig] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [generatingOAuthUrl, setGeneratingOAuthUrl] = useState(false);
  const [exchangingCode, setExchangingCode] = useState(false);

  // Security & Authentication Lock State (Protected View vs Edit Mode)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [verifyingAuth, setVerifyingAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  // Settings State (Clean, no dummy defaults)
  const [settings, setSettings] = useState({
    configured: false,
    auth_type: 'oauth2',
    google_drive_folder_id: '',
    is_active: true,
    schedule_enabled: true,
    schedule_frequency: 'daily',
    schedule_time: '01:00',
    schedule_day_of_week: 1,
    schedule_day_of_month: 1,
    backup_items: ['database', 'qa_worksheet', 'spv_imports', 'master_data'],
    retention_days: 14,
    has_service_account: false,
    has_oauth2: false,
    client_email: null,
    project_id: null,
    oauth_client_id: null,
    oauth_user_email: null,
    last_backup_at: null,
    last_status: null,
    last_error: null,
    stats: {
      total: 0,
      success: 0,
      failed: 0,
      last_entry: null
    }
  });

  // Form Inputs
  const [folderIdInput, setFolderIdInput] = useState('');
  const [serviceAccountJsonInput, setServiceAccountJsonInput] = useState('');
  const [oauthClientIdInput, setOauthClientIdInput] = useState('');
  const [oauthClientSecretInput, setOauthClientSecretInput] = useState('');
  const [oauthRefreshTokenInput, setOauthRefreshTokenInput] = useState('');
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [jsonFileName, setJsonFileName] = useState('');

  // OAuth Helper Modal States
  const [showOAuthGuideModal, setShowOAuthGuideModal] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');

  // Schedule States
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('01:00');
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [selectedBackupItems, setSelectedBackupItems] = useState([
    'database',
    'qa_worksheet',
    'spv_imports',
    'master_data'
  ]);
  const [retentionDays, setRetentionDays] = useState(14);

  // Logs States
  const [logsList, setLogsList] = useState([]);
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  // Connection Test Result
  const [testResult, setTestResult] = useState(null);

  // Modals
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showLogDetailModal, setShowLogDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Manual Trigger Form
  const [manualPeriod, setManualPeriod] = useState('instant');
  const [manualItems, setManualItems] = useState([
    'database',
    'qa_worksheet',
    'spv_imports',
    'master_data'
  ]);
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');

  // Auto-Detect Client Email & Project ID from input JSON
  const detectedServiceAccount = useMemo(() => {
    if (!serviceAccountJsonInput || !serviceAccountJsonInput.trim()) return null;
    try {
      const parsed = JSON.parse(serviceAccountJsonInput.trim());
      return {
        client_email: parsed.client_email || null,
        project_id: parsed.project_id || null,
        private_key: parsed.private_key || null
      };
    } catch (e) {
      return null;
    }
  }, [serviceAccountJsonInput]);

  // Fetch Current Settings
  const fetchSettings = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.getBackupSettings();
      if (res && res.success && res.data) {
        const d = res.data;
        setSettings(d);
        setAuthType(d.auth_type || 'oauth2');
        setFolderIdInput(d.google_drive_folder_id || '');
        setIsActiveInput(d.is_active !== undefined ? d.is_active : true);
        setScheduleEnabled(d.schedule_enabled !== undefined ? d.schedule_enabled : true);
        setScheduleFrequency(d.schedule_frequency || 'daily');
        setScheduleTime(d.schedule_time || '01:00');
        setScheduleDayOfWeek(d.schedule_day_of_week || 1);
        setScheduleDayOfMonth(d.schedule_day_of_month || 1);
        setSelectedBackupItems(d.backup_items || ['database', 'qa_worksheet', 'spv_imports', 'master_data']);
        setRetentionDays(d.retention_days || 14);

        if (d.oauth_client_id) setOauthClientIdInput(d.oauth_client_id);
        if (d.oauth_client_secret) setOauthClientSecretInput(d.oauth_client_secret);
        if (d.oauth_refresh_token) setOauthRefreshTokenInput(d.oauth_refresh_token);

        if (d.service_account_json) {
          setServiceAccountJsonInput(typeof d.service_account_json === 'string' ? d.service_account_json : JSON.stringify(d.service_account_json, null, 2));
        } else {
          setServiceAccountJsonInput('');
        }

        // Default to locked view mode if already configured, or unlocked if not yet set up
        if (d.configured) {
          setIsUnlocked(false);
          setHideFolderId(true);
          setHideClientId(true);
          setHideClientSecret(true);
          setHideRefreshToken(true);
          setHideJsonContent(true);
        } else {
          setIsUnlocked(true);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat setting backup: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async (page = 1) => {
    setLoadingLogs(true);
    try {
      const params = { page, limit: 15 };
      if (logStatusFilter !== 'all') {
        params.status = logStatusFilter;
      }
      const res = await api.getBackupLogs(params);
      if (res && res.success) {
        setLogsList(res.data || []);
        setLogTotal(res.meta?.total || 0);
        setLogPage(res.meta?.current_page || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(1);
    }
  }, [activeTab, logStatusFilter]);

  // Handle JSON Key File Upload (For Service Account)
  const handleJsonFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      showToast('Format file wajib berekstensi .json (Google Cloud Service Account Key)', 'error');
      return;
    }

    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);
        if (!parsed.client_email || !parsed.private_key) {
          showToast('JSON tidak valid. Kunci Google Service Account harus memuat client_email dan private_key.', 'error');
          return;
        }
        setServiceAccountJsonInput(JSON.stringify(parsed, null, 2));
        showToast(`Kunci ${file.name} berhasil dimuat. Email: ${parsed.client_email}`, 'success');
      } catch (err) {
        showToast('Berkas JSON tidak dapat di-parse: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Clipboard Copy Helper
  const handleCopyToClipboard = (text, label = 'Teks') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} disalin ke clipboard.`, 'success');
    }).catch(() => {
      showToast('Gagal menyalin ke clipboard.', 'error');
    });
  };

  // Generate OAuth URL & Open Consent Screen
  const handleOpenGoogleConsent = async () => {
    if (!oauthClientIdInput.trim() || !oauthClientSecretInput.trim()) {
      showToast('Isi OAuth Client ID dan Client Secret terlebih dahulu.', 'error');
      return;
    }

    setGeneratingOAuthUrl(true);
    try {
      const redirectUri = window.location.origin + '/backup-drive';
      const res = await api.getBackupOAuthUrl({
        client_id: oauthClientIdInput.trim(),
        client_secret: oauthClientSecretInput.trim(),
        redirect_uri: redirectUri
      });

      if (res && res.success && res.auth_url) {
        window.open(res.auth_url, '_blank', 'width=600,height=700');
        showToast('Jendela persetujuan Google telah dibuka. Izinkan akses lalu salin kode verifikasinya.', 'info');
      } else {
        showToast(res.message || 'Gagal membuat URL otorisasi.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setGeneratingOAuthUrl(false);
    }
  };

  // Exchange Auth Code for Refresh Token
  const handleExchangeAuthCode = async () => {
    if (!authCodeInput.trim()) {
      showToast('Masukkan Authorization Code dari Google.', 'error');
      return;
    }

    setExchangingCode(true);
    try {
      const redirectUri = window.location.origin + '/backup-drive';
      const res = await api.exchangeBackupOAuthCode({
        client_id: oauthClientIdInput.trim(),
        client_secret: oauthClientSecretInput.trim(),
        code: authCodeInput.trim(),
        redirect_uri: redirectUri
      });

      if (res && res.success && res.refresh_token) {
        setOauthRefreshTokenInput(res.refresh_token);
        showToast(`Berhasil! Refresh Token didapatkan untuk akun ${res.user_email || 'Google'}.`, 'success');
        setShowOAuthGuideModal(false);
        setAuthCodeInput('');
      } else {
        showToast(res.message || 'Gagal menukarkan Authorization Code.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setExchangingCode(false);
    }
  };

  // Test Live Connection to Google Drive API
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const payload = {
        auth_type: authType,
      };

      if (folderIdInput.trim()) payload.google_drive_folder_id = folderIdInput.trim();

      if (authType === 'oauth2') {
        if (oauthClientIdInput.trim()) payload.oauth_client_id = oauthClientIdInput.trim();
        if (oauthClientSecretInput.trim()) payload.oauth_client_secret = oauthClientSecretInput.trim();
        if (oauthRefreshTokenInput.trim()) payload.oauth_refresh_token = oauthRefreshTokenInput.trim();
      } else {
        if (serviceAccountJsonInput.trim()) payload.service_account_json = serviceAccountJsonInput.trim();
      }

      const res = await api.testBackupConnection(payload);
      if (res && res.success) {
        setTestResult({ success: true, message: res.message, quota: res.data?.quota, email: res.data?.account_email });
        showToast('Koneksi Google Drive Terverifikasi & Aktif!', 'success');
      } else {
        setTestResult({ success: false, message: res.message || 'Koneksi gagal terhubung ke Google Drive.' });
        showToast(res.message || 'Koneksi Gagal', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // Unlock & Lock Handlers with Supervisor Password Authentication
  const handleOpenUnlockModal = () => {
    setAuthPasswordInput('');
    setAuthError('');
    setShowAuthPassword(false);
    setShowAuthModal(true);
  };

  const handleVerifySupervisorAuth = async (e) => {
    if (e) e.preventDefault();
    if (!authPasswordInput.trim()) {
      setAuthError('Masukkan kata sandi Supervisor.');
      return;
    }

    setVerifyingAuth(true);
    setAuthError('');
    try {
      const res = await api.verifyBackupAuth({ password: authPasswordInput.trim() });
      if (res && res.success) {
        setIsUnlocked(true);
        setShowAuthModal(false);
        setAuthPasswordInput('');
        showToast(res.message || 'Otorisasi Supervisor Berhasil! Mode Edit Aktif.', 'success');
      } else {
        setAuthError(res.message || 'Kata sandi Supervisor salah.');
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || err.message || 'Verifikasi kata sandi gagal.');
    } finally {
      setVerifyingAuth(false);
    }
  };

  const handleLockForm = () => {
    setIsUnlocked(false);
    setHideFolderId(true);
    setHideClientId(true);
    setHideClientSecret(true);
    setHideRefreshToken(true);
    setHideJsonContent(true);
    showToast('Formulir pengaturan dikunci kembali ke mode hanya-lihat (View Only).', 'info');
  };

  // Save Credentials (Dynamic Input from Supervisor)
  const handleSaveCredentials = async () => {
    if (!folderIdInput.trim()) {
      showToast('Google Drive Folder ID wajib diisi.', 'error');
      return;
    }

    if (authType === 'oauth2') {
      if (!settings.has_oauth2 && (!oauthClientIdInput.trim() || !oauthClientSecretInput.trim() || !oauthRefreshTokenInput.trim())) {
        showToast('Lengkapi Client ID, Client Secret, dan Refresh Token untuk autentikasi OAuth2 Personal.', 'error');
        return;
      }
    } else {
      if (!settings.has_service_account && !serviceAccountJsonInput.trim()) {
        showToast('Service Account JSON wajib diunggah atau ditempel.', 'error');
        return;
      }
    }

    setSavingConfig(true);
    try {
      const payload = {
        auth_type: authType,
        google_drive_folder_id: folderIdInput.trim(),
        is_active: isActiveInput,
        schedule_enabled: scheduleEnabled,
        schedule_frequency: scheduleFrequency,
        schedule_time: scheduleTime,
        schedule_day_of_week: scheduleDayOfWeek,
        schedule_day_of_month: scheduleDayOfMonth,
        backup_items: selectedBackupItems,
        retention_days: retentionDays
      };

      if (authType === 'oauth2') {
        if (oauthClientIdInput.trim()) payload.oauth_client_id = oauthClientIdInput.trim();
        if (oauthClientSecretInput.trim()) payload.oauth_client_secret = oauthClientSecretInput.trim();
        if (oauthRefreshTokenInput.trim()) payload.oauth_refresh_token = oauthRefreshTokenInput.trim();
      } else {
        if (serviceAccountJsonInput.trim()) payload.service_account_json = serviceAccountJsonInput.trim();
      }

      const res = await api.saveBackupSettings(payload);
      if (res && res.success) {
        showToast('Konfigurasi API Google Drive (' + authType.toUpperCase() + ') berhasil disimpan & dikunci kembali.', 'success');
        setJsonFileName('');
        setIsUnlocked(false); // Automatically lock back to secure view mode
        fetchSettings();
      } else {
        showToast(res.message || 'Gagal menyimpan pengaturan.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Reset / Disconnect Configuration
  const handleResetConfiguration = async () => {
    if (!isUnlocked && settings.configured) {
      const ok = await showConfirm({
        title: 'Buka Kunci untuk Reset?',
        message: 'Pengaturan saat ini terkunci. Anda harus membuka kunci dengan password Supervisor terlebih dahulu untuk mereset konfigurasi.',
        type: 'warning',
        confirmText: 'Buka Kunci'
      });
      if (ok) {
        handleOpenUnlockModal();
      }
      return;
    }

    const ok = await showConfirm({
      title: 'Putuskan & Reset Konfigurasi Google Drive?',
      message: 'Kredensial dan Folder ID yang tersimpan akan dihapus dari database. Anda dapat menghubungkan kredensial baru secara mandiri.',
      type: 'danger',
      confirmText: 'Ya, Reset Konfigurasi'
    });
    if (!ok) return;

    setResettingConfig(true);
    try {
      const res = await api.resetBackupSettings();
      if (res && res.success) {
        showToast('Konfigurasi Google Drive berhasil di-reset.', 'success');
        setFolderIdInput('');
        setServiceAccountJsonInput('');
        setOauthClientIdInput('');
        setOauthClientSecretInput('');
        setOauthRefreshTokenInput('');
        setJsonFileName('');
        setTestResult(null);
        setIsUnlocked(true);
        fetchSettings();
      } else {
        showToast(res?.message || 'Gagal mereset konfigurasi.', 'error');
      }
    } catch (err) {
      showToast('Gagal: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setResettingConfig(false);
    }
  };

  // Save Schedule & Data Modules
  const handleSaveSchedule = async () => {
    if (selectedBackupItems.length === 0) {
      showToast('Pilih minimal 1 kategori modul data untuk dibackup.', 'error');
      return;
    }

    setSavingConfig(true);
    try {
      const payload = {
        auth_type: authType,
        google_drive_folder_id: folderIdInput.trim() || settings.google_drive_folder_id,
        is_active: isActiveInput,
        schedule_enabled: scheduleEnabled,
        schedule_frequency: scheduleFrequency,
        schedule_time: scheduleTime,
        schedule_day_of_week: scheduleDayOfWeek,
        schedule_day_of_month: scheduleDayOfMonth,
        backup_items: selectedBackupItems,
        retention_days: retentionDays
      };

      const res = await api.saveBackupSettings(payload);
      if (res && res.success) {
        showToast('Jadwal otomatis & lingkup data berhasil diperbarui.', 'success');
        fetchSettings();
      } else {
        showToast(res.message || 'Gagal menyimpan jadwal.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Module Checkboxes
  const toggleBackupItem = (key) => {
    setSelectedBackupItems((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
  };

  const toggleManualItem = (key) => {
    setManualItems((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
  };

  // Execute Instant Manual Backup
  const handleExecuteManualBackup = async () => {
    if (manualItems.length === 0) {
      showToast('Pilih minimal 1 modul data untuk dicadangkan.', 'error');
      return;
    }

    setTriggeringBackup(true);
    try {
      const payload = {
        period: manualPeriod,
        items: manualItems,
        user_name: user?.name || 'Supervisor'
      };

      if (manualStartDate && manualEndDate) {
        payload.start_date = manualStartDate;
        payload.end_date = manualEndDate;
      }

      const res = await api.triggerManualBackup(payload);
      if (res && res.success) {
        showToast(res.message || 'Antrean backup instan berhasil dimulai.', 'success');
        setShowTriggerModal(false);
        setActiveTab('logs');
        fetchLogs(1);
        fetchSettings();
      } else {
        showToast(res.message || 'Gagal memulai proses backup.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setTriggeringBackup(false);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    const ok = await showConfirm({
      title: 'Hapus Riwayat Log Backup',
      message: 'Apakah Anda yakin ingin membersihkan riwayat log backup? Arsip file di Google Drive tidak akan terhapus.',
      type: 'danger',
      confirmText: 'Ya, Bersihkan Log'
    });
    if (!ok) return;

    try {
      const res = await api.clearBackupLogs();
      if (res && res.success) {
        showToast('Riwayat log berhasil dibersihkan.', 'success');
        fetchLogs(1);
      }
    } catch (err) {
      showToast('Gagal membersihkan log: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const isConfigured = settings.configured;

  return (
    <div className="space-y-3.5 sm:space-y-5 max-w-7xl mx-auto pb-28 sm:pb-12">
      {/* 1. CORPORATE HEADER BANNER (Native Android & Material 3 Surface Feel) */}
      <div className="corp-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200/90 shadow-2xs">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#0F2744] text-white text-[10px] font-black uppercase tracking-wider shadow-2xs">
              <Cloud className="w-3 h-3 text-cyan-300" />
              MODUL 9
            </span>
            <span className="text-slate-300 font-bold hidden sm:inline">•</span>
            <span className="text-xs font-bold text-slate-600 hidden sm:inline">
              Cloud Backup Drive
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            Integrasi Google Drive &amp; Backup Otomatis
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pencadangan database MySQL, lembar evaluasi QA, data transaksi SPV, dan master data ke Google Drive.
          </p>
        </div>

        {/* Header Action Buttons (Android Material Action Row) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto flex-shrink-0">
          <button
            onClick={() => setShowTriggerModal(true)}
            disabled={!isConfigured}
            className="col-span-2 sm:col-span-1 btn-primary py-2.5 px-4 text-xs font-bold shadow-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
            title="Jalankan backup langsung ke antrean"
          >
            <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Backup Sekarang</span>
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection || (!isConfigured && !oauthRefreshTokenInput && !serviceAccountJsonInput)}
            className="btn-secondary py-2.5 px-3.5 text-xs font-bold shadow-2xs disabled:opacity-40 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Uji koneksi API Google Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin text-[#0F2744]' : 'text-slate-600'}`} />
            <span>Uji Koneksi</span>
          </button>

          {isConfigured && (
            <button
              onClick={handleResetConfiguration}
              disabled={resettingConfig}
              className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
              title="Putuskan &amp; Reset Kredensial Google Drive"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CORPORATE SUMMARY KPI METRICS (Android Material 3 Surface Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Status Koneksi Drive */}
        <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Drive</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                {isConfigured ? 'Terhubung' : 'Belum Terhubung'}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
              {isConfigured ? (
                settings.auth_type === 'oauth2'
                  ? (settings.oauth_user_email ? `Akun: ${settings.oauth_user_email}` : 'OAuth2 Personal (15GB)')
                  : (settings.project_id ? `Project: ${settings.project_id}` : 'Google Service Account')
              ) : 'Menunggu input SPV'}
            </div>
          </div>
        </div>

        {/* Otomasi Scheduler */}
        <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jadwal Scheduler</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${scheduleEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
              {scheduleEnabled ? (
                <>
                  <span className="truncate">{settings.schedule_frequency?.toUpperCase() || 'DAILY'} • {settings.schedule_time || '01:00'} WIB</span>
                </>
              ) : (
                <span className="text-slate-400">Non-Aktif</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Retensi: {settings.retention_days || 14} Hari di Cloud
            </div>
          </div>
        </div>

        {/* Terakhir Backup */}
        <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terakhir Backup</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-xs sm:text-base font-black text-slate-900 tracking-tight leading-none truncate">
              {settings.last_backup_at
                ? new Date(settings.last_backup_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                : 'Belum pernah'}
            </div>
            <div className="text-[11px] font-semibold mt-1 flex items-center gap-1">
              {settings.last_status === 'success' ? (
                <span className="text-emerald-700 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Berhasil</span>
              ) : settings.last_status === 'failed' ? (
                <span className="text-rose-700 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Gagal</span>
              ) : (
                <span className="text-slate-400">Siap dieksekusi</span>
              )}
            </div>
          </div>
        </div>

        {/* Total Arsip Log */}
        <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arsip Riwayat</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-sm sm:text-lg font-black text-slate-900 tracking-tight leading-none">
              {settings.stats?.total || logTotal || 0} Arsip
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
              {settings.stats?.success || 0} Sukses • {settings.stats?.failed || 0} Gagal
            </div>
          </div>
        </div>
      </div>

      {/* Connection Test Banner Alert */}
      {testResult && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs transition-all shadow-2xs ${testResult.success
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
            : 'bg-rose-50/90 border-rose-200 text-rose-950'
          }`}>
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <div className="font-bold text-sm">
              {testResult.success ? 'Koneksi API Google Drive Berhasil & Terverifikasi' : 'Koneksi API Google Drive Gagal'}
            </div>
            <p className="leading-relaxed opacity-90">{testResult.message}</p>
            {testResult.quota && (
              <div className="pt-1 flex items-center gap-3 text-[11px] font-mono text-emerald-800 font-semibold flex-wrap">
                <span>Kuota Terpakai: {testResult.quota.usage_gb} GB</span>
                <span>•</span>
                <span>Total Kapasitas: {testResult.quota.limit_gb} GB</span>
                {testResult.quota.free_gb !== null && (
                  <>
                    <span>•</span>
                    <span>Sisa: {testResult.quota.free_gb} GB</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. SUB-NAVIGATION TABS (Clean Android Segmented Pill Bar - No Ugly Ellipsis) */}
      <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto gap-1 scrollbar-none shadow-2xs">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`flex-1 min-w-0 py-2.5 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 touch-manipulation select-none active:scale-[0.98] ${activeTab === 'credentials'
              ? 'bg-white text-[#0F2744] shadow-xs border border-slate-200/70 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          <Key className="w-3.5 h-3.5 text-[#0F2744] shrink-0" />
          <span className="whitespace-nowrap">Kredensial</span>
          <span className="hidden sm:inline whitespace-nowrap">&amp; Drive</span>
          {isConfigured && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 min-w-0 py-2.5 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 touch-manipulation select-none active:scale-[0.98] ${activeTab === 'schedule'
              ? 'bg-white text-[#0F2744] shadow-xs border border-slate-200/70 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#0F2744] shrink-0" />
          <span className="whitespace-nowrap">Jadwal</span>
          <span className="hidden sm:inline whitespace-nowrap">&amp; Lingkup</span>
          {scheduleEnabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 min-w-0 py-2.5 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 touch-manipulation select-none active:scale-[0.98] ${activeTab === 'logs'
              ? 'bg-white text-[#0F2744] shadow-xs border border-slate-200/70 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          <History className="w-3.5 h-3.5 text-[#0F2744] shrink-0" />
          <span className="whitespace-nowrap">Riwayat Log</span>
          {logTotal > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shrink-0">
              {logTotal}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: KREDENSIAL API GOOGLE DRIVE */}
      {activeTab === 'credentials' && (
        <div className="corp-card p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Pengaturan API &amp; Kredensial Google Drive</span>
                {!isUnlocked && settings.configured && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Terkunci
                  </span>
                )}
                {isUnlocked && settings.configured && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Mode Edit
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Koneksikan Google Drive API secara mandiri. Pilih metode koneksi sesuai akun Google yang Anda miliki.
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
              {!isUnlocked && settings.configured && (
                <button
                  type="button"
                  onClick={handleOpenUnlockModal}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
                >
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Buka Kunci</span>
                </button>
              )}
              {isUnlocked && settings.configured && (
                <button
                  type="button"
                  onClick={handleLockForm}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kunci Kembali</span>
                </button>
              )}

              {/* Android Material Switch for Integrasi Aktif */}
              <div className="flex items-center gap-2.5 select-none">
                <span className="text-xs font-bold text-slate-700">Integrasi:</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActiveInput}
                  disabled={!isUnlocked}
                  onClick={() => isUnlocked && setIsActiveInput(!isActiveInput)}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-95 shadow-inner ${!isUnlocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                    } ${isActiveInput ? 'bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'}`}
                >
                  <span className="sr-only">Toggle Integrasi</span>
                  <span
                    className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${isActiveInput ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  >
                    {isActiveInput ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-400 stroke-[3]" />
                    )}
                  </span>
                </button>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isActiveInput ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                  {isActiveInput ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
            </div>
          </div>

          {/* AUTH TYPE SELECTOR PILLS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Pilih Metode Koneksi Google Drive:
              </label>
              {!isUnlocked && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Terkunci
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: OAuth2 Personal (Recommended for @gmail.com) */}
              <div
                onClick={() => {
                  if (!isUnlocked) {
                    handleOpenUnlockModal();
                    return;
                  }
                  setAuthType('oauth2');
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.99] ${authType === 'oauth2'
                    ? 'border-[#0F2744] bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-[#0F2744] shrink-0 mt-0.5 sm:mt-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>OAuth2 Akun Personal</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Rekomendasi @gmail.com</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Langsung menggunakan kuota 15 GB akun Gmail pribadi Anda.
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${authType === 'oauth2' ? 'border-[#0F2744] bg-[#0F2744]' : 'border-slate-300'
                    }`}>
                    {authType === 'oauth2' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </div>

              {/* Option 2: Service Account (For Workspace / Shared Drive) */}
              <div
                onClick={() => {
                  if (!isUnlocked) {
                    handleOpenUnlockModal();
                    return;
                  }
                  setAuthType('service_account');
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.99] ${authType === 'service_account'
                    ? 'border-[#0F2744] bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 mt-0.5 sm:mt-0">
                      <FileJson className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>Service Account Key (JSON)</span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Google Workspace</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Khusus Google Workspace <strong>Shared Drive (Drive Bersama)</strong>.
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${authType === 'service_account' ? 'border-[#0F2744] bg-[#0F2744]' : 'border-slate-300'
                    }`}>
                    {authType === 'service_account' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PARAMETER 1: Google Drive Folder ID Input (Safe from Browser Password Prompts) */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <span>1. Google Drive Folder ID</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isUnlocked) {
                      handleOpenUnlockModal();
                      return;
                    }
                    setHideFolderId(!hideFolderId);
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {(!isUnlocked || hideFolderId) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{(!isUnlocked || hideFolderId) ? 'Tampilkan' : 'Sembunyikan'}</span>
                </button>
                {folderIdInput && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        handleOpenUnlockModal();
                        return;
                      }
                      handleCopyToClipboard(folderIdInput, 'Folder ID');
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                name="gdrive_folder_id_param"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                disabled={!isUnlocked}
                value={folderIdInput}
                style={{
                  WebkitTextSecurity: (!isUnlocked || hideFolderId) && folderIdInput ? 'disc' : 'none'
                }}
                onChange={(e) => {
                  let val = e.target.value;
                  const match = val.match(/\/folders\/([a-zA-Z0-9_-]+)/);
                  if (match) {
                    val = match[1];
                    showToast('Folder ID otomatis diekstrak dari URL Google Drive.', 'success');
                  }
                  setFolderIdInput(val);
                }}
                placeholder="Contoh: 1Nyipxn60T0SY6lnhXloLZmHEKXl5s8FF (atau tempel link URL folder)"
                className={`w-full px-3.5 py-2.5 rounded-xl border ${folderIdInput && (folderIdInput.includes('@') || folderIdInput.endsWith('.iam.gserviceaccount.com'))
                    ? 'border-rose-400 bg-rose-50/50'
                    : !isUnlocked
                      ? 'border-slate-200 bg-slate-50/80 text-slate-800 cursor-not-allowed'
                      : 'border-slate-300 bg-white text-slate-900'
                  } text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${(!isUnlocked || hideFolderId) && folderIdInput ? 'filter blur-[4px] select-none' : ''
                  }`}
              />
            </div>

            {folderIdInput && (folderIdInput.includes('@') || folderIdInput.endsWith('.iam.gserviceaccount.com')) && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Peringatan: Anda memasukkan Alamat Email, bukan Folder ID.</span>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    Masukkan <strong>Folder ID</strong> dari URL Google Drive Anda (karakter setelah <code>drive.google.com/drive/folders/<strong>ID_FOLDER</strong></code>).
                  </p>
                </div>
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              Folder di Google Drive tempat seluruh arsip backup otomatis (Database Dump, Excel QA, dsb.) akan disimpan.
            </div>
          </div>

          {/* METHOD A: OAUTH2 PERSONAL DRIVE INPUTS (Safe from Browser Password Prompts) */}
          {authType === 'oauth2' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Kredensial OAuth2 Personal Google
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0F2744] text-[10px] font-bold">
                    Menggunakan Kuota 15 GB Akun Anda
                  </span>
                </div>
                {isUnlocked && (
                  <button
                    type="button"
                    onClick={() => setShowOAuthGuideModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 self-start sm:self-auto"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Panduan Dapatkan Refresh Token (4 Langkah)</span>
                  </button>
                )}
              </div>

              {/* OAuth Client ID */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase block">
                    OAuth Client ID <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        handleOpenUnlockModal();
                        return;
                      }
                      setHideClientId(!hideClientId);
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {(!isUnlocked || hideClientId) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-blue-600" />}
                    <span>{(!isUnlocked || hideClientId) ? 'Buka Sensor' : 'Sensor'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    name="oauth_client_id_param"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    disabled={!isUnlocked}
                    value={oauthClientIdInput}
                    style={{
                      WebkitTextSecurity: (!isUnlocked || hideClientId) && oauthClientIdInput ? 'disc' : 'none'
                    }}
                    onChange={(e) => setOauthClientIdInput(e.target.value)}
                    placeholder="Contoh: 101551315120-xxxxxxxx.apps.googleusercontent.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${!isUnlocked ? 'border-slate-200 bg-slate-50/80 text-slate-800 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-900'
                      } text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none`}
                  />
                </div>
              </div>

              {/* OAuth Client Secret */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase block">
                    OAuth Client Secret <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        handleOpenUnlockModal();
                        return;
                      }
                      setHideClientSecret(!hideClientSecret);
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {(!isUnlocked || hideClientSecret) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-blue-600" />}
                    <span>{(!isUnlocked || hideClientSecret) ? 'Buka Sensor' : 'Sensor'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  name="oauth_client_secret_param"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  disabled={!isUnlocked}
                  value={oauthClientSecretInput}
                  style={{
                    WebkitTextSecurity: (!isUnlocked || hideClientSecret) && oauthClientSecretInput ? 'disc' : 'none'
                  }}
                  onChange={(e) => setOauthClientSecretInput(e.target.value)}
                  placeholder="Contoh: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${!isUnlocked ? 'border-slate-200 bg-slate-50/80 text-slate-800 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-900'
                    } text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none`}
                />
              </div>

              {/* OAuth Refresh Token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase block">
                    OAuth Refresh Token <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        handleOpenUnlockModal();
                        return;
                      }
                      setHideRefreshToken(!hideRefreshToken);
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {(!isUnlocked || hideRefreshToken) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-blue-600" />}
                    <span>{(!isUnlocked || hideRefreshToken) ? 'Buka Sensor' : 'Sensor'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  name="oauth_refresh_token_param"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  disabled={!isUnlocked}
                  value={oauthRefreshTokenInput}
                  style={{
                    WebkitTextSecurity: (!isUnlocked || hideRefreshToken) && oauthRefreshTokenInput ? 'disc' : 'none'
                  }}
                  onChange={(e) => setOauthRefreshTokenInput(e.target.value)}
                  placeholder="Contoh: 1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${!isUnlocked ? 'border-slate-200 bg-slate-50/80 text-slate-800 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-900'
                    } text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none`}
                />
              </div>

              {/* Quick 1-Click Generator Trigger */}
              {isUnlocked && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900">Belum memiliki Refresh Token?</span>
                    <p className="text-[11px] text-slate-500">
                      Buka jendela otorisasi Google untuk mendapatkan kode akses resmi secara instan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOAuthGuideModal(true)}
                    className="btn-secondary py-2 px-3 text-xs whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dapatkan Refresh Token</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* METHOD B: SERVICE ACCOUNT KEY INPUTS */}
          {authType === 'service_account' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <span>2. Service Account Key (.json)</span>
                  {!settings.has_service_account && <span className="text-rose-500 font-bold">*</span>}
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        handleOpenUnlockModal();
                        return;
                      }
                      setHideJsonContent(!hideJsonContent);
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {(!isUnlocked || hideJsonContent) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-blue-600" />}
                    <span>{(!isUnlocked || hideJsonContent) ? 'Buka Sensor JSON' : 'Sensor JSON'}</span>
                  </button>
                  {serviceAccountJsonInput && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isUnlocked) {
                          handleOpenUnlockModal();
                          return;
                        }
                        handleCopyToClipboard(serviceAccountJsonInput, 'Kunci JSON');
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin JSON</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              {isUnlocked && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="px-4 py-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 transition-all shadow-2xs">
                    <Upload className="w-4 h-4 text-[#0F2744]" />
                    <span>{jsonFileName ? jsonFileName : 'Pilih / Unggah Berkas Kunci .json'}</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleJsonFileUpload}
                      className="hidden"
                    />
                  </label>

                  {jsonFileName && (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                      <Check className="w-3.5 h-3.5" /> Berkas siap disimpan
                    </span>
                  )}
                </div>
              )}

              {/* JSON Editor Area */}
              <div className="relative">
                <textarea
                  rows={5}
                  disabled={!isUnlocked}
                  value={serviceAccountJsonInput}
                  onChange={(e) => setServiceAccountJsonInput(e.target.value)}
                  placeholder="Isi konten dari file .json hasil generate di Google Cloud IAM..."
                  className={`w-full p-3 rounded-xl border ${!isUnlocked ? 'border-slate-200 bg-slate-50/80 text-slate-800 cursor-not-allowed select-none' : 'border-slate-300 bg-slate-50/70 text-slate-900'
                    } text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${(!isUnlocked || hideJsonContent) && serviceAccountJsonInput ? 'filter blur-[5px] select-none pointer-events-none' : ''
                    }`}
                />
              </div>

              {/* Share Callout */}
              {(detectedServiceAccount?.client_email || settings.client_email) && (
                <div className="p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs uppercase tracking-wider">
                      <Share2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Bagikan (Share) Shared Drive ke Email Service Account:</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-600">Email:</span>
                      <code className="font-mono font-bold text-[#0F2744] bg-white px-2 py-0.5 rounded border border-blue-200 truncate select-all">
                        {detectedServiceAccount?.client_email || settings.client_email}
                      </code>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyToClipboard(detectedServiceAccount?.client_email || settings.client_email, 'Email Service Account')}
                    className="btn-primary py-2 px-3 text-xs shrink-0 self-start sm:self-auto flex items-center gap-1.5 shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Email</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="pt-4 border-t border-slate-100">
            {!isUnlocked ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Pengaturan dilindungi dalam mode hanya-lihat. Buka kunci dengan password Supervisor untuk mengubah.</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenUnlockModal}
                  className="btn-primary py-2.5 px-5 text-xs shadow-sm flex items-center gap-2 whitespace-nowrap justify-center active:scale-95 transition-all"
                >
                  <Key className="w-4 h-4 text-amber-300" />
                  <span>Buka Kunci untuk Edit</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleLockForm}
                  className="btn-secondary py-2.5 px-4 text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kunci Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  disabled={savingConfig}
                  className="btn-primary py-2.5 px-5 text-xs shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Simpan &amp; Enkripsi Kredensial</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL & LINGKUP DATA (PROMINENT SCHEDULER ACTIVE SWITCH & MATERIAL DESIGN) */}
      {activeTab === 'schedule' && (
        <div className="corp-card p-4 sm:p-6 space-y-5 sm:space-y-6 border border-slate-200/90 shadow-2xs">
          {/* Header section with description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0F2744]" />
                <span>Jadwal Backup Otomatis &amp; Lingkup Data</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasikan frekuensi scheduler background worker dan modul data yang akan dicadangkan.
              </p>
            </div>
          </div>

          {/* STANDOUT ANDROID MATERIAL 3 MASTER SWITCH TILE FOR SCHEDULER */}
          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${scheduleEnabled
              ? 'bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-slate-50 border-emerald-500 shadow-sm'
              : 'bg-slate-50/90 border-slate-300 text-slate-500'
            }`}>
            <div className="flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 ${scheduleEnabled
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-200 text-slate-500'
                }`}>
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm sm:text-base text-slate-900 tracking-tight">
                    Otomasi Scheduler Background Worker
                  </span>
                  {scheduleEnabled ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      AKTIF
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-600">
                      NON-AKTIF
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {scheduleEnabled
                    ? `Worker aktif berjalan otomatis setiap ${scheduleFrequency === 'daily' ? 'Hari (Daily)' : scheduleFrequency === 'weekly' ? 'Minggu' : 'Bulan'} pada pukul ${scheduleTime} WIB.`
                    : 'Scheduler dinonaktifkan. Seluruh backup otomatis dihentikan dan hanya dapat dipicu manual oleh Supervisor.'}
                </p>
              </div>
            </div>

            {/* BOLD & PROMINENT ANDROID MATERIAL 3 TOGGLE SWITCH */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/80 shrink-0">
              <span className="text-xs font-bold text-slate-700 sm:hidden">Sakelar Scheduler:</span>
              <button
                type="button"
                role="switch"
                aria-checked={scheduleEnabled}
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-95 shadow-inner ${scheduleEnabled ? 'bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                title={scheduleEnabled ? 'Klik untuk mematikan scheduler' : 'Klik untuk mengaktifkan scheduler'}
              >
                <span className="sr-only">Status Scheduler</span>
                <span
                  className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${scheduleEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                >
                  {scheduleEnabled ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 stroke-[3]" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Form Scheduler Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Frekuensi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Frekuensi Backup
              </label>
              <select
                value={scheduleFrequency}
                onChange={(e) => setScheduleFrequency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
              >
                <option value="daily">Harian (Daily)</option>
                <option value="weekly">Mingguan (Weekly)</option>
                <option value="monthly">Bulanan (Monthly)</option>
              </select>
            </div>

            {/* Waktu Eksekusi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Waktu Eksekusi (WIB)
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
              />
            </div>

            {/* Retensi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Retensi Arsip (Hari)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
              />
            </div>
          </div>

          {/* Module Scope Selection (Material Checkable Cards) */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Modul Data yang Dicadangkan:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'database', label: 'Database SQL', badge: 'SQL.GZ', desc: 'Dump tabel & relasi DB', icon: Database },
                { id: 'qa_worksheet', label: 'Lembar Sampling QA', badge: 'EXCEL', desc: 'Rekap asesmen CA & FCR', icon: FileSpreadsheet },
                { id: 'spv_imports', label: 'Data Mentah SPV', badge: 'EXCEL', desc: 'Tarikan CRM/CSC SPV', icon: Inbox },
                { id: 'master_data', label: 'Master NAKER & SOP', badge: 'EXCEL', desc: 'Plotting Tenaga Kerja', icon: Layers },
              ].map((m) => {
                const checked = selectedBackupItems.includes(m.id);
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleBackupItem(m.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all select-none active:scale-[0.98] ${checked
                        ? 'border-[#0F2744] bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${checked ? 'bg-[#0F2744] text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${checked ? 'bg-[#0F2744] text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {m.badge}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                        <span>{m.label}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-[#0F2744]" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingConfig}
              className="btn-primary py-2.5 px-6 text-xs shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto active:scale-95 transition-all"
            >
              {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Simpan Jadwal &amp; Lingkup</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT LOG & AUDIT (DESKTOP TABLE + NATIVE ANDROID MOBILE CARDS) */}
      {activeTab === 'logs' && (
        <div className="corp-card p-4 sm:p-6 space-y-4 border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[#0F2744]" />
                <span>Riwayat Log &amp; Audit Eksekusi Backup</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail seluruh proses backup otomatis scheduler dan pemicu manual.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold outline-none shadow-2xs"
              >
                <option value="all">Semua Status</option>
                <option value="success">Sukses</option>
                <option value="failed">Gagal</option>
              </select>

              {logsList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bersihkan</span>
                </button>
              )}
            </div>
          </div>

          {loadingLogs ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0F2744]" />
              <span className="text-xs font-medium">Memuat riwayat log backup...</span>
            </div>
          ) : logsList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600">Belum ada riwayat eksekusi backup tercatat.</p>
              <p className="text-[11px] text-slate-400">Jalankan "Backup Sekarang" atau tunggu jadwal scheduler.</p>
            </div>
          ) : (
            <>
              {/* 1. MOBILE VIEW: NATIVE ANDROID MATERIAL 3 LIST CARDS (< md) */}
              <div className="block md:hidden space-y-2.5">
                {logsList.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => {
                      setSelectedLog(log);
                      setShowLogDetailModal(true);
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all cursor-pointer shadow-2xs active:scale-[0.99] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                          {log.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          <span className="capitalize">{log.status}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                          {log.backup_type}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {log.duration_seconds ? `${log.duration_seconds}s` : '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-xs font-bold text-slate-800 capitalize">
                          {log.user_name || log.trigger_type || 'Scheduler Worker'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {log.created_at ? new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                          {log.files_count || 0} berkas
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. DESKTOP VIEW: FULL AUDIT TABLE (>= md) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5">Waktu Eksekusi</th>
                      <th className="py-3 px-3.5">Pemicu</th>
                      <th className="py-3 px-3.5">Tipe</th>
                      <th className="py-3 px-3.5">Berkas</th>
                      <th className="py-3 px-3.5">Durasi</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logsList.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-slate-800 capitalize">
                          {log.user_name || log.trigger_type}
                        </td>
                        <td className="py-3 px-3.5 uppercase text-[10px] font-bold text-slate-600">
                          {log.backup_type}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-slate-700">
                          {log.files_count || 0} berkas
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">
                          {log.duration_seconds ? `${log.duration_seconds}s` : '-'}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                            {log.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            <span className="capitalize">{log.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLog(log);
                              setShowLogDetailModal(true);
                            }}
                            className="btn-secondary py-1 px-3 text-[11px] font-bold"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL: OAUTH2 HELPER & QUICK GENERATOR (Centered Modal) */}
      {showOAuthGuideModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0F2744] text-white shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Panduan Dapatkan Refresh Token (OAuth2 Personal)</h3>
              </div>
              <button
                onClick={() => setShowOAuthGuideModal(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-slate-700 leading-relaxed">
                <strong className="text-[#0F2744]">Mengapa Menggunakan OAuth2 Personal?</strong> Google Drive API memberikan kuota penyimpanan <strong>15 GB asli</strong> dari akun Google Anda, sehingga file cadangan DigiQA tersimpan langsung di Drive Anda.
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-[#0F2744] text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Buat OAuth Client ID &amp; Aktifkan Drive API di Google Cloud</span>
                  </div>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0"
                  >
                    <span>Buka GCP</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Buka menu <strong>APIs &amp; Services &gt; Credentials</strong> &gt; Klik <strong>Create Credentials &gt; OAuth client ID</strong>. Pilih tipe <em>Web Application</em> dan pada <strong>Authorized redirect URIs</strong> tambahkan URL berikut:
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-white p-2 rounded border border-slate-300 font-mono text-[10px] flex-1 truncate select-all">
                    https://developers.google.com/oauthplayground
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyToClipboard('https://developers.google.com/oauthplayground', 'Redirect URI')}
                    className="btn-secondary py-1.5 px-3 text-[10px] flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Wajib Daftarkan Email ke "Test Users"</span>
                  </div>
                  <a
                    href="https://console.cloud.google.com/apis/credentials/consent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 shrink-0"
                  >
                    <span>Consent Screen</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Pada menu <strong>Audience</strong> / <strong>OAuth consent screen</strong> di Google Cloud, klik <strong>+ ADD USERS</strong> dan daftarkan email login Google Anda:
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-600 font-semibold">Email Login Google:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono text-[11px] text-slate-900 font-bold">
                    {settings?.oauth_user_email || 'email-google-anda@gmail.com'}
                  </code>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-[#0F2744] text-white flex items-center justify-center text-[10px]">3</span>
                    <span>Buka OAuth Playground &amp; Pasang Kredensial Sendiri (Icon ⚙️)</span>
                  </div>
                  <a
                    href="https://developers.google.com/oauthplayground"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0"
                  >
                    <span>OAuth Playground</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Buka OAuth Playground &gt; Klik ikon <strong>Gear ⚙️</strong> di pojok kanan atas &gt; Centang ☑️ <strong>"Use your own OAuth credentials"</strong> &gt; Masukkan <strong>OAuth Client ID</strong> &amp; <strong>Secret</strong> Anda.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">4</span>
                  <span>Pilih Drive Scope &amp; Salin Refresh Token</span>
                </div>
                <p className="text-[11px] text-blue-950 leading-relaxed">
                  Pada <strong>Step 1</strong>, centang scope <code>https://www.googleapis.com/auth/drive</code> &gt; klik <strong>Authorize APIs</strong>. Lalu di <strong>Step 2</strong> klik <strong>Exchange authorization code for tokens</strong> &gt; Salin <strong>Refresh token</strong> ke form DigiQA.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowOAuthGuideModal(false)}
                className="btn-primary py-2 px-6 text-xs w-full sm:w-auto active:scale-95"
              >
                Saya Mengerti, Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: INSTANT MANUAL BACKUP TRIGGER (Centered Modal) */}
      {showTriggerModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[88vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0F2744] text-white shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Eksekusi Pencadangan Instan</h3>
              </div>
              <button
                onClick={() => setShowTriggerModal(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="font-bold text-slate-700 uppercase block text-[11px]">
                  Pilih Modul Data yang Dicadangkan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'database', label: 'Database SQL' },
                    { id: 'qa_worksheet', label: 'Sampling QA' },
                    { id: 'spv_imports', label: 'Data Mentah SPV' },
                    { id: 'master_data', label: 'Master NAKER' },
                  ].map((m) => {
                    const checked = manualItems.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleManualItem(m.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-2.5 select-none active:scale-95 ${checked
                            ? 'border-[#0F2744] bg-blue-50/50 font-bold text-[#0F2744]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-[#0F2744] border-[#0F2744] text-white' : 'border-slate-300'
                          }`}>
                          {checked && <Check className="w-3 h-3" />}
                        </div>
                        <span className="truncate text-xs">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowTriggerModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-bold active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteManualBackup}
                disabled={triggeringBackup || manualItems.length === 0}
                className="btn-primary py-2 px-5 text-xs font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {triggeringBackup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Mulai Backup</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: DETAIL AUDIT LOG (Centered Modal) */}
      {showLogDetailModal && selectedLog && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0F2744] text-white shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-300" />
                <h3 className="font-bold text-sm">Audit Trail Log #{selectedLog.id}</h3>
              </div>
              <button
                onClick={() => setShowLogDetailModal(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto text-xs flex-1">
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Pemicu</span>
                  <span className="font-bold text-slate-800 capitalize truncate block mt-0.5">{selectedLog.user_name || 'System'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Durasi</span>
                  <span className="font-bold text-slate-800 font-mono block mt-0.5">{selectedLog.duration_seconds || 0}s</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className={`font-bold capitalize block mt-0.5 ${selectedLog.status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedLog.status}
                  </span>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <span className="font-bold block">Pesan Error / Diagnostik:</span>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed">{selectedLog.error_message}</pre>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <span className="font-bold text-slate-700 uppercase text-[11px] block">Daftar Berkas Terunggah ke Google Drive:</span>
                {Array.isArray(selectedLog.details) && selectedLog.details.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedLog.details.map((f, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono font-bold text-slate-800 truncate">{f.name}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                          {f.status || 'Tersimpan'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-slate-200">
                    Tidak ada rincian berkas tercatat.
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowLogDetailModal(false)}
                className="btn-primary py-2 px-5 text-xs w-full sm:w-auto active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: OTORISASI SUPERVISOR / BUKA KUNCI SETTING (Centered Modal in the Middle) */}
      {showAuthModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[88vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0F2744] text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Otorisasi Supervisor Diperlukan</h3>
                  <p className="text-[11px] text-white/70">Keamanan Kredensial Google Drive</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthPasswordInput('');
                  setAuthError('');
                }}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body & Form */}
            <form onSubmit={handleVerifySupervisorAuth} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Untuk melindungi konfigurasi API dan data cadangan perusahaan, silakan masukkan <strong>kata sandi akun Supervisor / Admin</strong> Anda untuk membuka mode edit.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      Kata Sandi Supervisor <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      {showAuthPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showAuthPassword ? 'Sembunyikan' : 'Tampilkan'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      autoFocus
                      name="supervisor_unlock_security_key"
                      autoComplete="current-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={authPasswordInput}
                      onChange={(e) => {
                        setAuthPasswordInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      placeholder="Masukkan kata sandi login Anda..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-medium">{authError}</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    setAuthPasswordInput('');
                    setAuthError('');
                  }}
                  className="btn-secondary py-2 px-4 text-xs font-semibold active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={verifyingAuth || !authPasswordInput.trim()}
                  className="btn-primary py-2 px-5 text-xs font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  {verifyingAuth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Verifikasi &amp; Buka Kunci</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default BackupManagement;
