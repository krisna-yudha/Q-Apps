import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Activity,
  Users,
  Compass,
  ArrowRight,
  Database,
  Calendar,
  Layers,
  Zap,
  BarChart3,
  Award,
  BookOpen,
  ClipboardCheck,
  UserCheck,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const MainHub = () => {
  const { user } = useAuth();

  const [kpi, setKpi] = useState({
    avgCA: 0,
    avgFCR: 0,
    totalEvaluations: 0,
    totalAgents: 0,
    hasData: false
  });

  useEffect(() => {
    const loadKpi = async () => {
      try {
        const res = await api.getGlobalDashboard();
        if (res?.kpi) {
          setKpi({
            avgCA: res.kpi.avgCA || 0,
            avgFCR: res.kpi.avgFCR || 0,
            totalEvaluations: res.kpi.totalEvaluations || 0,
            totalAgents: res.kpi.totalAgents || 0,
            hasData: res.hasData || false
          });
        }
      } catch (e) {
        // ignore
      }
    };
    loadKpi();

    const handleSync = () => loadKpi();
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, []);

  const role = user?.role || '';
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';
  const isQA = role === 'quality_assurance' || role === 'qa';
  const isTL = role === 'team_leader' || role === 'tl';
  const isTrainer = role === 'trainer';

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

  // Quick Action items tailored to user role (clean corporate shortcuts)
  const getQuickShortcuts = () => {
    if (isSupervisor) {
      return [
        {
          title: 'Sampling Ticket & Monitoring',
          subtitle: 'Lembar observasi dan audit antrean pengerjaan QA',
          path: '/evaluasi-sampling',
          icon: ClipboardCheck,
          iconBg: 'bg-emerald-50 text-emerald-700'
        },
        {
          title: 'Ticketing & Auto Distribution',
          subtitle: 'Pembagian data mentah sampling CRM secara proporsional',
          path: '/auto-distribution',
          icon: Zap,
          iconBg: 'bg-blue-50 text-blue-700'
        },
        {
          title: 'Dashboard Global & Analytics',
          subtitle: 'Monitoring performa makro CA, FCR, dan perbandingan tren',
          path: '/dashboard-global',
          icon: TrendingUp,
          iconBg: 'bg-indigo-50 text-indigo-700'
        }
      ];
    }
    if (isQA) {
      return [
        {
          title: 'Lembar Sampling QA',
          subtitle: 'Pengerjaan evaluasi scoring mutu tiket interaksi harian',
          path: '/evaluasi-sampling',
          icon: ClipboardCheck,
          iconBg: 'bg-emerald-50 text-emerald-700'
        },
        {
          title: 'Success Board',
          subtitle: 'Pencapaian target kuota observasi evaluator per bulan',
          path: '/pencapaian-qa',
          icon: Award,
          iconBg: 'bg-amber-50 text-amber-700'
        },
        {
          title: 'QA Policy Hub',
          subtitle: 'Panduan acuan SOP parameter dan notulensi kalibrasi mutu',
          path: '/kebijakan',
          icon: BookOpen,
          iconBg: 'bg-blue-50 text-blue-700'
        }
      ];
    }
    if (isTL || isTrainer) {
      return [
        {
          title: isTL ? 'Rekap Tim Binaan' : 'Rekap Kelas Bimbingan',
          subtitle: 'Monitoring performa mutu dan plotting anggota binaan',
          path: '/rekap-under-team',
          icon: UserCheck,
          iconBg: 'bg-emerald-50 text-emerald-700'
        },
        {
          title: 'Agent Scorecards',
          subtitle: 'Rincian parameter penilaian individu dan export data',
          path: '/rekap-agent',
          icon: Users,
          iconBg: 'bg-slate-100 text-slate-800'
        },
        {
          title: 'QA Analytics',
          subtitle: 'Identifikasi top performer dan prioritas pembinaan mutu',
          path: '/anev',
          icon: BarChart3,
          iconBg: 'bg-indigo-50 text-indigo-700'
        }
      ];
    }
    return [
      {
        title: 'Dashboard Global',
        subtitle: 'Monitoring metrik makro performa mutu',
        path: '/dashboard-global',
        icon: TrendingUp,
        iconBg: 'bg-blue-50 text-blue-700'
      },
      {
        title: 'QA Policy Hub',
        subtitle: 'Panduan standar SOP dan kebijakan mutu',
        path: '/kebijakan',
        icon: BookOpen,
        iconBg: 'bg-amber-50 text-amber-700'
      }
    ];
  };

  const shortcuts = getQuickShortcuts();

  return (
    <div className="space-y-6 w-full">
      {/* 1. Header: Clean Corporate Welcome Card */}
      <div className="corp-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Pusat Kendali Mutu & Analisis Data</span>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
              {getRoleLabel(user?.role)}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Selamat Datang, {user?.name || 'User'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Pusat navigasi terpadu untuk monitoring kualitas layanan contact center, evaluasi kinerja agen, dan pengelolaan repositori kebijakan QA.
          </p>
        </div>
      </div>

      {/* 2. Middle: 4 Executive KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Global CA */}
        <div className="corp-card p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Global CA
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {kpi.avgCA}%
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Benchmark Target 90.0%
            </div>
          </div>
        </div>

        {/* Metric 2: FCR */}
        <div className="corp-card p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tingkat FCR
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {kpi.avgFCR}%
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              First Contact Resolution
            </div>
          </div>
        </div>

        {/* Metric 3: Total Sesi */}
        <div className="corp-card p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Sesi
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {kpi.totalEvaluations.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Interaksi Selesai Dinilai
            </div>
          </div>
        </div>

        {/* Metric 4: Total Agen */}
        <div className="corp-card p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Agen
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {kpi.totalAgents}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Master NAKER Aktif
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lower Accent: 2-Column Corporate Hub Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column (5 Cols): System Integrity & Operations */}
        <div className="lg:col-span-5 corp-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Integritas & Operasional Sistem
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ringkasan status pipeline dan database mutu
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Periode Operasional:</span>
                <span className="font-bold text-slate-800">
                  {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Alur Data Sampling:</span>
                <span className="font-bold text-slate-800">Tarikan CRM Harian</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Alur Data Dashboard:</span>
                <span className="font-bold text-slate-800">Rekap QSF Bulanan</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Otorisasi Login:</span>
                <span className="font-bold text-blue-700">{user?.name || user?.username}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>digiQA Enterprise Platform</span>
            <span>v2.0 • Secure</span>
          </div>
        </div>

        {/* Right Column (7 Cols): Sleek Quick Shortcuts */}
        <div className="lg:col-span-7 corp-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Akses Cepat Modul Utama
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pintasan langsung ke modul kerja harian Anda
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {shortcuts.map((sc, idx) => {
                const Icon = sc.icon;
                return (
                  <Link
                    key={idx}
                    to={sc.path}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/80 transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg ${sc.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition truncate">
                          {sc.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {sc.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-400 group-hover:text-blue-700 group-hover:border-blue-300 flex items-center justify-center transition flex-shrink-0 ml-2">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Navigasi lengkap tersedia pada sidebar</span>
            <span className="font-semibold text-slate-700">Shortcut Cepat</span>
          </div>
        </div>
      </div>
    </div>
  );
};
