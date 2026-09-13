import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Clock, 
  Upload, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight, 
  RefreshCw, 
  X, 
  ShieldAlert,
  Users,
  Database
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const SupervisorImportReminder = ({ compact = false, onOpenImport = null, className = '' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Only render for Supervisor role or relevant roles
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin';

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getImportReadinessStatus();
      if (res?.success) {
        setStatusData(res);
      }
    } catch (e) {
      console.error('Failed to load import readiness status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupervisor) return;
    fetchStatus();

    const handleRefresh = () => fetchStatus();
    window.addEventListener('digiqa:data_refresh', handleRefresh);
    const interval = setInterval(fetchStatus, 45000); // Poll every 45s

    return () => {
      window.removeEventListener('digiqa:data_refresh', handleRefresh);
      clearInterval(interval);
    };
  }, [isSupervisor]);

  if (!isSupervisor || dismissed || !statusData) {
    return null;
  }

  const {
    imported_today,
    today_imported_count,
    ready_qas_count,
    unassigned_ready_count,
    is_before_7am,
    server_time,
    reminder
  } = statusData;

  const handleAction = () => {
    if (onOpenImport) {
      onOpenImport();
    } else {
      navigate('/input-supervisor');
    }
  };

  // 1. If today's raw data has ALREADY been imported
  if (imported_today) {
    if (compact) {
      return (
        <div className={`px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs ${className}`}>
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Tarikan Hari Ini Siap ({today_imported_count} tiket)</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-mono">
            {ready_qas_count} QA Ready On Duty
          </span>
        </div>
      );
    }

    return (
      <div className={`corp-card p-3 sm:p-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white border border-emerald-200/90 rounded-2xl shadow-2xs transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                TARIKAN TIKET AKTIF
              </span>
              <span className="text-xs font-bold text-slate-900">
                Data Transaksi Hari Ini Telah Ter-import
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Sebanyak <strong className="text-emerald-800 font-mono">{today_imported_count} tiket</strong> berhasil dimasukkan ke pool & otomatis didistribusikan ke <strong className="text-slate-800 font-mono">{ready_qas_count} QA Ready</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleAction}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Tambah Tarikan Data</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Tutup banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. If today's raw data has NOT been imported yet (REMINDER / ALERT)
  const isUrgent = is_before_7am || unassigned_ready_count > 0;

  if (compact) {
    return (
      <div 
        onClick={handleAction}
        className={`px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs cursor-pointer active:scale-95 transition ${className}`}
        title="Klik untuk import tarikan data hari ini"
      >
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 animate-pulse text-slate-950" />
          <span>Pengingat: Tarikan Belum Di-import</span>
        </div>
        <span className="text-[10px] bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
          Target &lt; 07:00
        </span>
      </div>
    );
  }

  return (
    <div className={`corp-card relative overflow-hidden p-4 sm:p-5 rounded-2xl border ${
      isUrgent 
        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/90 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400/40' 
        : 'bg-gradient-to-r from-amber-50 via-orange-50 to-white text-slate-900 border-amber-300 shadow-2xs'
    } transition-all duration-300 ${className}`}>
      
      {/* Background Accent Glow */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/20 blur-xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs font-black ${
            isUrgent ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
          }`}>
            <Clock className="w-5 h-5 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
                isUrgent ? 'bg-slate-950 text-amber-300 border border-slate-900' : 'bg-amber-200 text-amber-900 border border-amber-400'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                PENGINGAT SUPERVISOR
              </span>

              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                isUrgent ? 'bg-black/20 text-slate-950' : 'bg-slate-100 text-slate-700'
              }`}>
                Target Sebelum Pukul 07:00 WIB
              </span>
            </div>

            <h4 className={`text-sm font-black ${isUrgent ? 'text-slate-950' : 'text-slate-900'}`}>
              Tarikan Data Sampling Harian Belum Di-import
            </h4>

            <p className={`text-xs font-medium max-w-2xl leading-relaxed ${
              isUrgent ? 'text-slate-900 font-semibold' : 'text-slate-600'
            }`}>
              {reminder?.message || `Harap lakukan upload tarikan data tiket transaksi (CRM/SIP/QSF) sebelum jam 07:00 WIB. Begitu file selesai di-import, engine akan langsung otomatis membagikan 20 tiket ke seluruh QA yang berstatus Ready/On Duty.`}
            </p>

            {ready_qas_count > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-bold pt-0.5">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {ready_qas_count} QA saat ini sudah berstatus <strong>Ready</strong> & menunggu kuota harian.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={handleAction}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 ${
              isUrgent
                ? 'bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-white border border-slate-900'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Tarikan Sekarang</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-2 rounded-xl bg-black/10 hover:bg-black/20 text-slate-800 transition cursor-pointer"
            title="Sembunyikan pengingat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
