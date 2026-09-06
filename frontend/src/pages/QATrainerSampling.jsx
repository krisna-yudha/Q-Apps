import React, { useState, useEffect } from 'react';
import {
  Award,
  Filter,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Target,
  BarChart2,
  Users,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { api } from '../services/api';
import { CustomSelect } from '../components/common/CustomSelect';

export const QATrainerSampling = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [selectedType, setSelectedType] = useState('all');

  const fetchSampling = async () => {
    setLoading(true);
    try {
      const res = await api.getEvaluatorsSampling({
        period: selectedMonth,
        type: selectedType
      });
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSampling();
  }, [selectedMonth, selectedType]);

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => fetchSampling();
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedMonth, selectedType]);

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">{label}</p>
          {payload.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                {item.name}:
              </span>
              <span className="font-extrabold text-slate-900">{item.value} Sesi</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const chartData = data?.evaluators?.map(e => ({
    name: e.name ? e.name.split(' - ')[0] : 'Evaluator',
    fullName: e.name,
    target: e.quota || 0,
    actual: e.actual || 0,
    avgScore: e.avgScore || 0,
    rate: e.quota > 0 ? Math.round((e.actual / e.quota) * 100) : 0
  })) || [];

  const hasData = data?.hasData && (data?.evaluators?.length > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="corp-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200">
              MODUL 4
            </span>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
              Pencapaian Tim QA & Trainer (Sampling Progress)
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Tracking produktivitas kuota evaluasi bulanan dan rata-rata skor observasi per personel Quality Assurance & Trainer.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-44">
            <CustomSelect
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={[
                { value: '2026-01', label: 'Januari 2026' },
                { value: '2026-02', label: 'Februari 2026' },
                { value: '2026-03', label: 'Maret 2026' },
                { value: '2026-04', label: 'April 2026' },
                { value: '2026-05', label: 'Mei 2026' },
                { value: '2026-06', label: 'Juni 2026' },
                { value: '2026-07', label: 'Juli 2026' },
                { value: '2026-08', label: 'Agustus 2026' },
                { value: '2026-09', label: 'September 2026' },
                { value: '2026-10', label: 'Oktober 2026' },
                { value: '2026-11', label: 'November 2026' },
                { value: '2026-12', label: 'Desember 2026' }
              ]}
              icon={Calendar}
            />
          </div>

          <div className="w-full sm:w-48">
            <CustomSelect
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              options={[
                { value: 'all', label: 'Semua Evaluator' },
                { value: 'QA', label: 'Khusus QA Evaluator' },
                { value: 'Trainer', label: 'Khusus Trainer' }
              ]}
              icon={Filter}
            />
          </div>

          <button
            onClick={fetchSampling}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 transition shadow-2xs flex items-center justify-center self-stretch sm:self-auto"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - 2x2 on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="corp-card p-4">
          <div className="flex items-center justify-between text-slate-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Kuota Target</span>
            <Target className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {data?.summary?.totalQuota || 0} <span className="text-xs font-medium text-slate-600">Sampel</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2 font-medium">
            {hasData ? `Komitmen kuota ${data?.summary?.evaluatorCount || 0} evaluator` : 'Belum ada data target'}
          </p>
        </div>

        <div className="corp-card p-4">
          <div className="flex items-center justify-between text-slate-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pencapaian Realisasi</span>
            <Award className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {data?.summary?.totalActual || 0} <span className="text-xs font-medium text-slate-600">Sampel</span>
          </div>
          <p className="text-[11px] text-emerald-800 font-bold mt-2">
            Pencapaian: {data?.summary?.overallCompletion || 0}%
          </p>
        </div>

        <div className="corp-card p-4">
          <div className="flex items-center justify-between text-slate-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Rata-Rata Skor Audit</span>
            <TrendingUp className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {data?.summary?.avgTeamScore || 0}%
          </div>
          <p className="text-[11px] text-slate-600 mt-2 font-medium">
            {hasData ? 'Indeks kalibrasi tim evaluasi' : 'Belum ada data evaluasi'}
          </p>
        </div>

        <div className="corp-card p-4">
          <div className="flex items-center justify-between text-slate-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Evaluator Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {hasData ? '100%' : '0%'} <span className="text-xs font-medium text-slate-600">{hasData ? 'Aktif' : 'N/A'}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2 font-medium">
            {hasData ? 'Semua evaluator on schedule' : 'Belum ada personel terdaftar'}
          </p>
        </div>
      </div>

      {/* Main Dual Bar Chart (Minimal Analytics) */}
      <div className="corp-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              HASIL SAMPLING BULANAN (TARGET VS REALISASI)
            </h2>
            <p className="text-xs text-slate-600">
              Perbandingan kuota target bulanan dengan jumlah sampel evaluasi aktual per evaluator
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#0F2744] inline-block"></span>
              <span className="text-slate-800">Target Kuota</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#D97706] inline-block"></span>
              <span className="text-slate-800">Realisasi Sampling</span>
            </div>
          </div>
        </div>

        {!hasData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5">
            <FolderOpen className="w-8 h-8 text-slate-500" />
            <p className="text-xs font-bold text-slate-800">Belum Ada Data Sampling Evaluator</p>
            <p className="text-[11px] text-slate-600 max-w-sm">
              Data grafik sampling target vs realisasi akan muncul saat data evaluasi tercatat di database backend.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                <YAxis stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="target" name="Target Kuota" fill="#0F2744" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="actual" name="Realisasi Sampling" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Evaluator Breakdown Table & Mobile Cards */}
      <div className="corp-card overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-700" />
            <span>Tabel Rincian Pencapaian Personel Evaluator</span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
            Periode {selectedMonth}
          </span>
        </div>

        {/* 1. Mobile Card List View (Visible only on mobile/small screens < md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-10 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-xs font-medium">Memuat data sampling...</span>
            </div>
          ) : !hasData ? (
            <div className="py-8 text-center text-slate-500 font-medium text-xs px-4">
              Belum ada rincian data kuota sampling pada periode ini.
            </div>
          ) : (
            data?.evaluators?.map((ev) => {
              const completion = ev.quota > 0 ? Math.round((ev.actual / ev.quota) * 100) : 0;
              const isAboveQuota = ev.actual >= ev.quota;
              const diff = ev.actual - ev.quota;

              return (
                <div key={ev.id} className="p-3.5 space-y-3 hover:bg-slate-50/70 transition-colors">
                  {/* Top: Initial Avatar, Name, Role Badge, and Avg Score */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-xs flex-shrink-0 ${
                          ev.type === 'QA' ? 'bg-[#0F2744]' : 'bg-amber-600'
                        }`}
                      >
                        {ev.name ? ev.name.charAt(0).toUpperCase() : 'E'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">
                          {ev.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ev.type === 'QA'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {ev.type === 'QA' ? 'QA Evaluator' : 'Trainer'}
                          </span>
                          <span className="badge-success text-[9px] py-0.5 px-1.5">
                            {ev.status || 'Target Tercapai'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/80">
                      <div className="text-xs font-black text-slate-900 leading-none">
                        {ev.avgScore}%
                      </div>
                      <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                        Skor Mutu
                      </span>
                    </div>
                  </div>

                  {/* Middle: Progress Bar with Metrics */}
                  <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">
                        Progress Realisasi: <strong className="text-slate-900 font-bold">{completion}%</strong>
                      </span>
                      <span
                        className={`font-bold text-[10px] ${
                          isAboveQuota ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isAboveQuota
                          ? diff > 0
                            ? `+${diff} Sesi (Surplus)`
                            : 'Kuota Tercapai Tepat'
                          : `${Math.abs(diff)} Sesi Tersisa`}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          completion >= 100
                            ? 'bg-emerald-600'
                            : completion >= 80
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(completion, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Bottom: 2-Column Stat Cards (Target vs Realisasi) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-500 block font-medium">Target Kuota</span>
                      <span className="font-bold text-slate-900 font-mono text-xs mt-0.5 block">
                        {ev.quota} Sesi
                      </span>
                    </div>
                    <div className="bg-emerald-50/60 px-3 py-2 rounded-xl border border-emerald-200/70">
                      <span className="text-[10px] text-emerald-800 block font-medium">Realisasi Sampling</span>
                      <span className="font-extrabold text-emerald-900 font-mono text-xs mt-0.5 block">
                        {ev.actual} Sesi
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Table View (Visible only on md and larger screens >= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-bold text-[11px]">
                <th className="py-3 px-4">Nama Evaluator</th>
                <th className="py-3 px-4">Tipe Peran</th>
                <th className="py-3 px-4">Target Kuota</th>
                <th className="py-3 px-4">Realisasi Sampling</th>
                <th className="py-3 px-4">Progress (%)</th>
                <th className="py-3 px-4">Rata-Rata Nilai Observasi</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <span>Memuat data sampling...</span>
                    </div>
                  </td>
                </tr>
              ) : !hasData ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500 font-medium">
                    Belum ada rincian data kuota sampling pada periode ini.
                  </td>
                </tr>
              ) : (
                data?.evaluators?.map((ev) => {
                  const completion = ev.quota > 0 ? Math.round((ev.actual / ev.quota) * 100) : 0;
                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {ev.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.type === 'QA' ? 'badge-navy' : 'badge-warning'}`}>
                          {ev.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                        {ev.quota} Sesi
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                        {ev.actual} Sesi
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${completion >= 80 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                              style={{ width: `${completion}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-slate-800">{completion}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {ev.avgScore}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="badge-success">
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
