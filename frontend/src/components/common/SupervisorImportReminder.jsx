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

export const SupervisorImportReminder = ({ period = null, compact = false, onOpenImport = null, className = '' }) => {
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
      const res = await api.getImportReadinessStatus(period ? { period } : {});
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
  }, [isSupervisor, period]);

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
      navigate('/auto-distribution');
    }
  };

  const hasActiveImport = Boolean(
    imported_today &&
    Number(today_imported_count) > 0 &&
    ((statusData?.raw_buffer_remaining || 0) > 0 || (statusData?.today_assigned_count || 0) > 0)
  );

  // 1. If today's raw data has ALREADY been imported and active
  if (hasActiveImport) {
    if (compact) {
      return (
        <div 
          onClick={handleAction}
          className={`px-3 py-1.5 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 border border-emerald-300/80 text-xs font-semibold flex items-center justify-between gap-2.5 shadow-2xs cursor-pointer active:scale-95 transition ${className}`}
          title="Tarikan CRM hari ini telah di-upload"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-800">Tarikan Siap ({today_imported_count} tiket)</span>
          </div>
          <span className="text-[10px] text-emerald-800 font-mono font-bold bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-200">
            {ready_qas_count} QA Ready
          </span>
        </div>
      );
    }

    return (
      <div className={`corp-card p-4 rounded-2xl bg-white border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-2xs transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                TARIKAN AKTIF
              </span>
              <span className="text-xs font-bold text-slate-900">
                Data Transaksi Hari Ini Telah Terdistribusi
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Total <strong className="text-slate-900 font-mono">{(today_imported_count || 0).toLocaleString('id-ID')} tiket mentah</strong> diimpor. Kebutuhan tim harian: <strong className="text-slate-900 font-mono">{statusData?.daily_needed_total || 160} tiket</strong> ({ready_qas_count} QA × 20).
              {(statusData?.raw_buffer_remaining || 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                  <span>Sisa Pool Cadangan:</span>
                  <strong className="font-mono">{Number(statusData.raw_buffer_remaining).toLocaleString('id-ID')} Tiket</strong>
                </span>
              )}
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
            <span>Tambah Tarikan</span>
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
  if (compact) {
    return (
      <div 
        onClick={handleAction}
        className={`px-3 py-1.5 rounded-xl bg-amber-50/90 hover:bg-amber-100 text-amber-950 border border-amber-300/80 text-xs font-semibold flex items-center justify-between gap-2.5 shadow-2xs cursor-pointer active:scale-95 transition ${className}`}
        title="Klik untuk upload tarikan transaksi CRM hari ini"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <Clock className="w-3.5 h-3.5 text-amber-700" />
          <span className="font-bold text-slate-800">Pengingat Tarikan CRM</span>
        </div>
        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg font-mono font-bold">
          Target &lt; 07:00 WIB
        </span>
      </div>
    );
  }

  return (
    <div className={`corp-card relative overflow-hidden p-4 sm:p-4.5 rounded-2xl bg-white border border-amber-200/90 border-l-4 border-l-amber-500 shadow-xs transition-all duration-200 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 relative z-10">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Clock className="w-4 h-4 text-amber-700" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                PENGINGAT SUPERVISOR
              </span>

              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                Batas Pukul 07:00 WIB
              </span>

              {ready_qas_count > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-600" />
                  {ready_qas_count} QA Ready
                </span>
              )}
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Tarikan Transaksi CRM Belum Diunggah
            </h4>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              {reminder?.message || 'Upload file transaksi mentah CRM (Excel 62 kolom) sebelum pukul 07:00 WIB untuk auto-distribusi ke QA Ready On Duty.'}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={handleAction}
            className="px-3.5 py-2 rounded-xl bg-[#0F2744] hover:bg-[#1A365D] text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-blue-300" />
            <span>Upload Tarikan CRM</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Sembunyikan pengingat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
