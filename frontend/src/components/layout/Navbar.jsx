import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Menu,
  Calendar,
  Clock,
  CheckCheck,
  Upload,
  BookOpen,
  Server,
  User,
  KeyRound,
  CheckCircle2,
  Building2,
  X,
  RotateCw,
  Volume2,
  VolumeX,
  Trash2,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { ProfileModal } from '../profile/ProfileModal';

const NAKER_TEAM_LEADERS = [
  { id: 1, name: 'DIMAS BAYU FAJAR PRATAMA' },
  { id: 2, name: 'HERU SANTOSO' },
  { id: 3, name: 'JAMALI' },
  { id: 4, name: 'AGUNG FAUZI BACHTIAR' },
  { id: 5, name: 'SIGIT HIMAWAN' },
  { id: 6, name: 'SUPRAPTO' },
  { id: 7, name: 'AYU DWI PRASTIKA' },
  { id: 8, name: 'DELA ALFIANITA' },
  { id: 9, name: 'FADHILA SILDANO' },
  { id: 10, name: 'ANGGI SUHARTINI SIREGAR' },
  { id: 11, name: 'MOHAMMAD AFNAN' },
  { id: 12, name: 'MOHAMAD ARIS FEBRIANTO' },
];

export const Navbar = ({ toggleMobileSidebar }) => {
  const { user, logout, updateUser } = useAuth();
  const {
    notifications,
    unreadCount,
    counts,
    isSyncing,
    connectionStatus,
    lastSyncTime,
    toastMessage,
    soundEnabled,
    toggleSound,
    markAllRead,
    markSingleRead,
    deleteSingleNotification,
    clearAllNotifications,
    syncNow
  } = useSync();

  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleSwitchRole = (newRole, tlId = null) => {
    let updatedUser = { ...user, role: newRole };
    if (newRole === 'team_leader') {
      const targetTl = NAKER_TEAM_LEADERS.find(t => t.id === Number(tlId)) || NAKER_TEAM_LEADERS[0];
      updatedUser = {
        ...updatedUser,
        role: 'team_leader',
        name: targetTl.name,
        team_leader_id: targetTl.id,
        team_leader_name: targetTl.name,
      };
    } else if (newRole === 'quality_assurance') {
      updatedUser = {
        ...updatedUser,
        role: 'quality_assurance',
        name: 'ALMIRA PARAMITHA',
        evaluator_name: 'ALMIRA PARAMITHA'
      };
    } else {
      updatedUser = {
        ...updatedUser,
        role: 'supervisor',
        name: 'Supervisor Utama'
      };
    }
    updateUser(updatedUser);
    window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'supervisor': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'quality_assurance': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'team_leader': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'supervisor': return 'Supervisor QA';
      case 'quality_assurance': return 'Quality Assurance';
      case 'team_leader': return 'Team Leader';
      default: return 'User';
    }
  };

  const getInitial = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const getAvatarBg = (color) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-600';
      case 'emerald': return 'bg-emerald-600';
      case 'amber': return 'bg-amber-600';
      case 'purple': return 'bg-purple-600';
      case 'rose': return 'bg-rose-600';
      default: return 'bg-[#0F2744]';
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'import': return <Upload className="w-4 h-4 text-blue-700" />;
      case 'sampling':
      case 'evaluation': return <Layers className="w-4 h-4 text-amber-700" />;
      case 'policy': return <BookOpen className="w-4 h-4 text-purple-700" />;
      default: return <Server className="w-4 h-4 text-emerald-700" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (notifFilter === 'unread') return !n.is_read;
    if (notifFilter === 'sampling') return n.type === 'sampling' || n.type === 'evaluation';
    if (notifFilter === 'import') return n.type === 'import';
    if (notifFilter === 'policy') return n.type === 'policy';
    if (notifFilter === 'system') return n.type === 'system';
    return true;
  });

  const handleNotificationClick = (n) => {
    markSingleRead(n.id);
    if (n.action_url) {
      navigate(n.action_url);
      setShowNotifications(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2 sm:py-2.5 shadow-2xs min-h-[58px] flex items-center">
        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-md text-xs sm:text-sm font-medium border border-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="flex-1 leading-snug">{toastMessage.text}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 sm:gap-4 w-full">
          {/* Left: Mobile Menu & Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={toggleMobileSidebar}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition shadow-2xs border border-slate-200"
              aria-label="Toggle mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F2744] to-blue-900 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-base sm:text-lg tracking-tight text-[#0F2744]">
                    digi<span className="text-blue-600">QA</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                    ENTERPRISE
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-none hidden xs:block">
                  Contact Center QA Analytics
                </p>
              </div>
            </Link>
          </div>

          {/* Center: Live Sync Status & Shift Time */}
          <div className="hidden lg:flex items-center gap-2.5">
            {/* Live Sync Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs shadow-2xs">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse'
                    : connectionStatus === 'polling'
                    ? 'bg-blue-500 ring-2 ring-blue-200'
                    : 'bg-amber-500 ring-2 ring-amber-200 animate-ping'
                }`} />
                <span className="font-bold text-[11px] text-slate-800">
                  {connectionStatus === 'connected' ? 'Live Sync: Aktif' : connectionStatus === 'polling' ? 'Live Sync: Polling' : 'Menghubungkan...'}
                </span>
              </div>
              <span className="text-slate-300">|</span>
              <button
                onClick={syncNow}
                disabled={isSyncing}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
                title="Klik untuk menyinkronkan data manual sekarang"
              >
                <RotateCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
                <span>{isSyncing ? 'Sinkron...' : 'Sync'}</span>
              </button>
            </div>

            {/* Shift & Calendar */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-300"></div>
              <div className="flex items-center gap-1.5 font-mono text-slate-800 font-semibold">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                <span>{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB</span>
              </div>
            </div>
          </div>

          {/* Right: Notifications & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                className="relative p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition shadow-2xs"
                title="Notifikasi Sistem"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center px-1 ring-2 ring-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Backdrop for outside click dismiss on mobile & desktop */}
              {showNotifications && (
                <div
                  onClick={() => setShowNotifications(false)}
                  className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs sm:bg-transparent"
                />
              )}

              {/* Responsive Notification Modal / Dropdown */}
              {showNotifications && (
                <div className="fixed inset-x-3 top-14 sm:inset-x-auto sm:right-0 sm:top-full sm:absolute sm:mt-2 w-auto sm:w-[440px] max-h-[85vh] sm:max-h-[540px] rounded-2xl bg-white border-2 border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Header */}
                  <div className="p-3.5 sm:p-4 bg-slate-50/95 border-b border-slate-200/80 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-none">
                            Notifikasi & Live Sync
                          </h4>
                          {unreadCount > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                              {unreadCount} Baru
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200">
                              Up-to-Date
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                          Real-time stream push & sinkronisasi data
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Audio Chime Mute/Unmute */}
                      <button
                        onClick={toggleSound}
                        className={`p-1.5 rounded-lg border transition ${
                          soundEnabled 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={soundEnabled ? 'Suara Notifikasi: Aktif' : 'Suara Notifikasi: Muted'}
                      >
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>

                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[11px] font-bold text-blue-700 hover:text-blue-900 px-2 py-1 rounded-lg hover:bg-blue-50 transition flex items-center gap-1 border border-blue-200 bg-blue-50/50"
                          title="Tandai semua sebagai sudah dibaca"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">Dibaca</span>
                        </button>
                      )}

                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                          title="Kosongkan Semua Notifikasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setShowNotifications(false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition"
                        aria-label="Tutup notifikasi"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-50/80 border-b border-slate-200/70 flex-shrink-0 text-xs font-semibold overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setNotifFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] whitespace-nowrap transition ${
                        notifFilter === 'all'
                          ? 'bg-white text-[#0F2744] font-bold shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Semua ({counts?.all || notifications.length})
                    </button>
                    <button
                      onClick={() => setNotifFilter('unread')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] whitespace-nowrap transition ${
                        notifFilter === 'unread'
                          ? 'bg-white text-blue-700 font-bold shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Belum Dibaca ({unreadCount})
                    </button>
                    <button
                      onClick={() => setNotifFilter('sampling')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] whitespace-nowrap transition ${
                        notifFilter === 'sampling'
                          ? 'bg-white text-amber-700 font-bold shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Sampling QA
                    </button>
                    <button
                      onClick={() => setNotifFilter('import')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] whitespace-nowrap transition ${
                        notifFilter === 'import'
                          ? 'bg-white text-blue-700 font-bold shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Import
                    </button>
                    <button
                      onClick={() => setNotifFilter('policy')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] whitespace-nowrap transition ${
                        notifFilter === 'policy'
                          ? 'bg-white text-purple-700 font-bold shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Kebijakan
                    </button>
                  </div>

                  {/* Scrollable Notification List */}
                  <div className="p-2 sm:p-2.5 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-1.5">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">
                          {notifFilter === 'unread' ? 'Tidak Ada Notifikasi Belum Dibaca' : 'Semua Notifikasi Up-to-Date'}
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-[260px] leading-relaxed">
                          {notifFilter === 'unread'
                            ? 'Seluruh aktivitas sistem penting telah Anda pantau.'
                            : 'Setiap proses import data matang, penilaian tiket QA, dan kebijakan baru akan muncul secara real-time di sini.'}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border transition-all flex items-start gap-3 group relative ${
                            !n.is_read
                              ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-50/90 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-100'
                          }`}
                        >
                          {/* Icon Column */}
                          <div
                            onClick={() => handleNotificationClick(n)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs cursor-pointer ${
                              n.type === 'import'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : n.type === 'sampling' || n.type === 'evaluation'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : n.type === 'policy'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {getNotifIcon(n.type)}
                          </div>

                          {/* Content Column */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5" onClick={() => handleNotificationClick(n)}>
                              <h5 className="font-bold text-xs text-slate-900 leading-snug truncate cursor-pointer hover:text-blue-700 transition">
                                {n.title}
                              </h5>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!n.is_read && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200"></span>
                                )}
                              </div>
                            </div>

                            {n.message && (
                              <p 
                                onClick={() => handleNotificationClick(n)}
                                className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed font-medium cursor-pointer"
                              >
                                {n.message}
                              </p>
                            )}

                            {/* Footer & Direct Action Link */}
                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60 text-[10px]">
                              <span className="font-semibold text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {n.time_ago}
                              </span>

                              <div className="flex items-center gap-2">
                                {n.action_url && (
                                  <button
                                    onClick={() => handleNotificationClick(n)}
                                    className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1 shadow-2xs"
                                  >
                                    <span>Buka</span>
                                    <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSingleNotification(n.id);
                                  }}
                                  className="p-1 rounded text-slate-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                                  title="Hapus notifikasi"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium flex-shrink-0">
                    <span>{notifications.length} notifikasi tercatat</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="font-bold text-blue-700 hover:text-blue-900"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition shadow-sm"
              >
                <div className={`w-7 h-7 rounded-md ${getAvatarBg(user?.avatar_color)} flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                  {getInitial(user?.name)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {user?.name || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {getRoleLabel(user?.role)}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Backdrop for profile menu */}
              {showProfileMenu && (
                <div
                  onClick={() => setShowProfileMenu(false)}
                  className="fixed inset-0 z-40 bg-slate-900/30 sm:bg-transparent"
                />
              )}

              {/* Elevated Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="fixed inset-x-4 top-14 sm:inset-x-auto sm:right-0 sm:top-full sm:absolute sm:mt-2 w-auto sm:w-64 rounded-2xl bg-white border-2 border-slate-200 shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Profile Header */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl ${getAvatarBg(user?.avatar_color)} flex items-center justify-center text-white font-bold text-base shadow-sm`}>
                        {getInitial(user?.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 truncate">{user?.name}</div>
                        <div className="text-[10px] text-slate-500 truncate font-mono mt-0.5">{user?.email}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium">Role Aktif:</span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${getRoleBadge(user?.role)}`}>
                        {getRoleLabel(user?.role)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Role Switcher Box */}
                  <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 mb-2.5 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Ganti Mode Peran (Testing & Simulasi)
                    </span>
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleSwitchRole('supervisor')}
                        className={`py-1.5 px-1 rounded-lg border text-center transition cursor-pointer ${
                          user?.role === 'supervisor'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
                        }`}
                        title="Mode Supervisor: Setor Data & Tata Kelola"
                      >
                        Supervisor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchRole('quality_assurance')}
                        className={`py-1.5 px-1 rounded-lg border text-center transition cursor-pointer ${
                          user?.role === 'quality_assurance'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
                        }`}
                        title="Mode QA: Input Nilai & Sampling"
                      >
                        QA
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchRole('team_leader')}
                        className={`py-1.5 px-1 rounded-lg border text-center transition cursor-pointer ${
                          user?.role === 'team_leader'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                        }`}
                        title="Mode Team Leader: Monitoring Under-Team Read-Only"
                      >
                        Team Leader
                      </button>
                    </div>

                    {/* If Team Leader, show NAKER TL Selector */}
                    {user?.role === 'team_leader' && (
                      <div className="pt-1.5 border-t border-slate-200/80">
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">
                          Pilih Profil TL Under-Team (Master NAKER):
                        </label>
                        <select
                          value={user?.team_leader_id || 1}
                          onChange={(e) => handleSwitchRole('team_leader', e.target.value)}
                          className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-[10px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        >
                          {NAKER_TEAM_LEADERS.map((tl) => (
                            <option key={tl.id} value={tl.id}>
                              {tl.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Menu Actions */}
                  <div className="space-y-1.5 text-xs">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setProfileModalTab('profile');
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-semibold transition"
                    >
                      <User className="w-4 h-4 text-blue-700" />
                      <span>Edit Data Diri & Profil</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setProfileModalTab('password');
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-semibold transition"
                    >
                      <KeyRound className="w-4 h-4 text-amber-700" />
                      <span>Ubah Kata Sandi</span>
                    </button>
                  </div>

                  {/* Logout Button */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition"
                    >
                      <LogOut className="w-4 h-4" /> Keluar Aplikasi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Profile & Account Settings Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </>
  );
};
