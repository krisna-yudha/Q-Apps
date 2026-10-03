import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  Layers,
  Calendar,
  Lock,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MainHub = () => {
  const { user } = useAuth();

  const getRoleLabel = (role) => {
    switch (role) {
      case 'supervisor':
      case 'admin':
      case 'superadmin':
        return 'Supervisor QA';
      case 'quality_assurance':
      case 'qa':
        return 'Quality Assurance';
      case 'team_leader':
      case 'tl':
        return 'Team Leader';
      case 'trainer':
        return 'Trainer';
      default:
        return 'User';
    }
  };

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="w-full min-h-[calc(100vh-140px)] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="max-w-2xl w-full corp-card p-8 sm:p-12 text-center relative overflow-hidden shadow-xl border border-slate-200/90 rounded-3xl bg-white/95 backdrop-blur-sm">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-bold tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>digiQA Enterprise Platform</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
            {getRoleLabel(user?.role)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live System</span>
          </span>
        </div>

        {/* Icon & Welcome Title */}
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#0F2744] to-[#1E3A8A] text-white flex items-center justify-center shadow-lg shadow-blue-900/20 mb-5">
          <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-blue-200" />
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-3">
          Selamat Datang, <span className="text-[#0F2744]">{user?.name || 'User'}</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg mx-auto mb-8 font-normal">
          Pusat kendali dan monitoring terpadu kualitas layanan contact center, evaluasi kinerja agen, dan pengelolaan repositori kebijakan QA.
        </p>

        {/* Info Grid / Sub-card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mb-8 text-left">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Hari / Tanggal</span>
            </div>
            <div className="text-xs font-bold text-slate-800 truncate">
              {todayFormatted}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Otorisasi Akses</span>
            </div>
            <div className="text-xs font-bold text-slate-800 truncate">
              {getRoleLabel(user?.role)}
            </div>
          </div>
        </div>

        {/* Bottom Callout Guide */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Compass className="w-4 h-4 text-blue-600" />
          <span>Silakan pilih menu modul pada <strong>Sidebar Navigasi</strong> di sebelah kiri untuk memulai.</span>
        </div>
      </div>
    </div>
  );
};
