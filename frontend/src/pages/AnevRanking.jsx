import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Award,
  AlertTriangle,
  UserCheck,
  Calendar,
  FileSpreadsheet,
  Upload,
  FolderOpen
} from 'lucide-react';
import { api } from '../services/api';
import { CustomSelect } from '../components/common/CustomSelect';

export const AnevRanking = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('2026-08');

  const loadAnev = async () => {
    setLoading(true);
    try {
      const res = await api.getAnevData(selectedPeriod);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnev();
  }, [selectedPeriod]);

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => loadAnev();
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedPeriod]);

  const DEFAULT_PERIODS = [
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
  ];

  const periodOptions = data?.periods && data.periods.length > 0 ? data.periods : DEFAULT_PERIODS;
  const currentPeriodLabel = periodOptions.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

  const topMedals = ['#1', '#2', '#3', '#4', '#5'];
  const hasData = data?.hasData && (data?.top5?.length > 0 || data?.bottom5?.length > 0);
  const hasEvaluators = data?.evaluatorsStatus && data?.evaluatorsStatus?.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="corp-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200">
              MODUL 2
            </span>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
              Analisis & Evaluasi (Anev - Ranking)
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Monitoring performa ekstrem: Top 5 High Performers & Bottom 5 Agen untuk coaching mutu layanan.
          </p>
        </div>

        {/* Period Selector */}
        <div className="w-full sm:w-48">
          <CustomSelect
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={periodOptions}
            icon={Calendar}
          />
        </div>
      </div>

      {!hasData && !loading && (
        <div className="corp-card p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-2.5">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">
            Belum Ada Data Ranking Anev Periode {currentPeriodLabel}
          </h3>
          <p className="text-xs text-slate-600 max-w-md">
            Data penilaian Top 5 &amp; Bottom 5 periode <strong>{currentPeriodLabel}</strong> akan otomatis dihitung setelah Anda mengimpor data (NAKER atau 7 Saluran QSF) melalui menu <strong>Input &amp; Import Supervisor</strong>.
          </p>
          <Link to="/input-supervisor" className="btn-primary mt-1">
            <Upload className="w-3.5 h-3.5" /> Buka Menu Input &amp; Import Supervisor
          </Link>
        </div>
      )}

      {/* Main Grid: Top 5 & Bottom 5 */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top 5 Performers */}
          <div className="corp-card p-5 border-t-4 border-t-emerald-600">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    AGEN TERBAIK (TOP 5 CA)
                  </h2>
                  <p className="text-[11px] text-emerald-800 font-semibold">Customer Accuracy Tertinggi</p>
                </div>
              </div>
              <span className="badge-success">
                High Performer
              </span>
            </div>

            <div className="space-y-3">
              {data?.top5?.map((agent, index) => (
                <div
                  key={agent.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-600 w-5">
                        {topMedals[index]}
                      </span>
                      <div className="w-7 h-7 rounded-md bg-[#0F2744] text-white flex items-center justify-center font-bold text-xs">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{agent.name}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">{agent.tl} • {agent.trainer}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-800">
                        {agent.ca}%
                      </span>
                      <span className="block text-[10px] text-slate-600 font-medium">FCR: {agent.fcr}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full"
                      style={{ width: `${agent.ca}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom 5 Performers */}
          <div className="corp-card p-5 border-t-4 border-t-red-600">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-50 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    AGEN TERENDAH (BOTTOM 5 CA)
                  </h2>
                  <p className="text-[11px] text-red-800 font-semibold">Prioritas Pembinaan & Kalibrasi</p>
                </div>
              </div>
              <span className="badge-critical">
                Need Coaching
              </span>
            </div>

            <div className="space-y-3">
              {data?.bottom5?.map((agent, index) => (
                <div
                  key={agent.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-red-700 w-5">
                        #{index + 1}
                      </span>
                      <div className="w-7 h-7 rounded-md bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{agent.name}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">{agent.tl} • {agent.trainer}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-red-700">
                        {agent.ca}%
                      </span>
                      <span className="block text-[10px] text-slate-600 font-medium">FCR: {agent.fcr}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-red-500 h-full rounded-full"
                      style={{ width: `${agent.ca}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Evaluator Status Monitoring */}
      <div className="corp-card p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-700" />
              Status Personel Evaluator QA & Trainer (Live Shift)
            </h3>
            <p className="text-xs text-slate-600">
              Monitoring ketersediaan tim pencatat mutu saat proses observasi interaksi agen berlangsung.
            </p>
          </div>
        </div>

        {!hasEvaluators ? (
          <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5 font-medium">
            <FolderOpen className="w-5 h-5 text-slate-500" />
            <span>Belum ada data personel evaluator terdaftar pada database.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {data?.evaluatorsStatus?.map((ev, index) => {
              const isActive = ev.status === 'Aktif';
              return (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-600 font-semibold">{ev.role}</span>
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 truncate">{ev.name}</h4>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-200">
                    <span>Status:</span>
                    <span className={isActive ? 'text-emerald-800 font-bold' : 'text-slate-600 font-semibold'}>
                      {ev.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Roadmap Section 35: Parameter CA yang Sering Rendah / Perlu Perhatian */}
      {data?.lowestParameters && data.lowestParameters.length > 0 && (
        <div className="corp-card p-5 border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Parameter Mutu yang Sering Rendah (Roadmap ANEV Fokus Pembinaan)
              </h3>
              <p className="text-xs text-slate-600">
                Parameter dengan rata-rata skor terendah di seluruh assessment untuk menjadi materi pelatihan/coaching prioritas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.lowestParameters.map((param, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {param.service_name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      Kode: {param.code}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {param.name || `Parameter ${param.code}`}
                  </h4>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Rata-rata Skor:</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {param.average_score} {param.max_score ? `/ ${parseFloat(param.max_score)}` : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs inline-block">
                      {param.achievement_pct !== undefined && param.achievement_pct !== null ? `${param.achievement_pct}%` : `${param.average_score}`}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{param.total_assessment} sample</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
