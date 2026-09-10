import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  BarChart3,
  Users,
  Award,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  ShieldAlert,
  Zap,
  ClipboardCheck
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

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';

  const allMenuItems = [
    {
      id: 1,
      title: 'Dashboard Pencapaian Global',
      subtitle: 'Global Customer Accuracy (CA) & First Call Resolution (FCR)',
      description: 'Monitoring performa makro mutu layanan (data matang), tren bulanan Jan-Des, dan perbandingan kanal interaksi.',
      path: '/dashboard-global',
      icon: TrendingUp,
      stat: kpi.hasData ? `${kpi.avgCA}% CA` : '0.0% CA',
      statLabel: 'Benchmark 90.0%',
      iconBg: 'bg-blue-50 text-blue-700',
      badge: 'Modul 1',
      supervisorOnly: false
    },
    {
      id: 2,
      title: 'Analisis & Evaluasi (Anev)',
      subtitle: 'Ranking Top 5 & Bottom 5 Performer Agent',
      description: 'Identifikasi agen dengan skor akurasi tertinggi serta agen prioritas pembinaan mutu dari data matang.',
      path: '/anev',
      icon: BarChart3,
      stat: kpi.hasData ? 'Ranking Aktif' : '0 Agent',
      statLabel: 'Top & Bottom CA',
      iconBg: 'bg-indigo-50 text-indigo-700',
      badge: 'Modul 2',
      supervisorOnly: false
    },
    {
      id: 3,
      title: 'Rekap Rata-Rata Nilai Agent',
      subtitle: 'Data Penilaian Lengkap & Excel Import/Export',
      description: 'Tabel rekapitulasi penilaian komprehensif, filter TL/Trainer, rincian parameter, serta export PDF/XLSX.',
      path: '/rekap-agent',
      icon: Users,
      stat: `${kpi.totalAgents} Agent`,
      statLabel: 'Excel / PDF Ready',
      iconBg: 'bg-slate-100 text-slate-800',
      badge: 'Modul 3',
      supervisorOnly: false
    },
    {
      id: 4,
      title: 'Pencapaian Tim QA & Trainer',
      subtitle: 'Sampling Progress & Kuota Bulanan',
      description: 'Tracking produktivitas kuota observasi evaluator per bulan dan persentase realisasi sampling.',
      path: '/pencapaian-qa',
      icon: Award,
      stat: 'Monitoring',
      statLabel: 'Evaluator Sampling',
      iconBg: 'bg-amber-50 text-amber-700',
      badge: 'Modul 4',
      supervisorOnly: false
    },
    {
      id: 5,
      title: 'Lembar Sampling QA',
      subtitle: 'Pengerjaan & Monitoring Penilaian Mutu',
      description: 'Pengerjaan observasi mutu sampling yang dialokasikan dari data mentah Auto Distribution dengan matriks parameter SOP.',
      path: '/evaluasi-sampling',
      icon: ClipboardCheck,
      stat: 'Antrean QA',
      statLabel: 'Pengerjaan CA & FCR',
      iconBg: 'bg-emerald-50 text-emerald-700',
      badge: 'Modul 5',
      supervisorOnly: false
    },
    {
      id: 6,
      title: 'Auto Distribution QA',
      subtitle: 'Distribusi Data Mentah Sampling',
      description: 'Engine pembagian data mentah tiket transaksi pelanggan secara proporsional dan anti-collision ke 8 QA bucket.',
      path: '/auto-distribution',
      icon: Zap,
      stat: 'Data Mentah',
      statLabel: 'Distribusi Sampling',
      iconBg: 'bg-blue-50 text-blue-700',
      badge: 'Modul 6',
      supervisorOnly: true
    },
    {
      id: 7,
      title: 'Input, Import & Setting',
      subtitle: 'Import Data Matang & Master NAKER',
      description: 'Pusat import data olahan matang (QSF bulanan) per awal bulan untuk dashboard 1-4, serta Master NAKER dan SOP.',
      path: '/settings',
      icon: ShieldAlert,
      stat: 'Data Matang',
      statLabel: 'Import Per Awal Bulan',
      iconBg: 'bg-rose-50 text-rose-700',
      badge: 'Modul 7',
      supervisorOnly: true
    },
    {
      id: 8,
      title: 'Kelola Akun Pengguna',
      subtitle: 'Injeksi Akun Master NAKER',
      description: 'Pusat manajemen akun login, hak akses pengguna, reset password, dan sinkronisasi akun master NAKER.',
      path: '/kelola-akun',
      icon: Users,
      stat: 'Manajemen Akun',
      statLabel: 'Injeksi NAKER',
      iconBg: 'bg-purple-50 text-purple-700',
      badge: 'Modul 8',
      supervisorOnly: true
    }
  ];

  const menuItems = allMenuItems.filter(item => !item.supervisorOnly || isSupervisor);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header Card (Clean Corporate Minimal) */}
      <div className="corp-card p-4 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>Pusat Kendali Mutu & Analisis Data</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">
            Selamat Datang, {user?.name || 'User'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pusat navigasi terpadu untuk monitoring kualitas layanan contact center, evaluasi kinerja agen, dan pengelolaan repositori kebijakan QA.
          </p>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full md:w-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left sm:text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Global CA</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{kpi.avgCA}%</div>
            <div className="text-[10px] sm:text-[11px] text-slate-600 font-medium mt-0.5 truncate">
              {kpi.hasData ? 'Terdata' : 'Belum Ada Data'}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left sm:text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Sesi</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{kpi.totalEvaluations.toLocaleString('id-ID')}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-600 font-medium mt-0.5 truncate">
              Interaksi Dinilai
            </div>
          </div>
        </div>
      </div>

      {/* 7 Main Module Cards */}
      <div>
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            7 Modul Navigasi Utama
          </h2>
          <p className="text-xs text-slate-500">Pilih modul kerja untuk menampilkan laporan dan analisis terperinci</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isWide = index === 0;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`corp-card corp-card-hover p-5 flex flex-col justify-between group ${isWide ? 'md:col-span-2 lg:col-span-2' : ''
                  }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${item.iconBg} flex items-center justify-center font-bold flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.badge}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors mt-0.5">
                          {item.title}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">{item.stat}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{item.statLabel}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 font-semibold mb-1">
                    {item.subtitle}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-700 group-hover:text-blue-800">
                  <span>Buka Modul</span>
                  <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-[#0F2744] group-hover:text-white transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
