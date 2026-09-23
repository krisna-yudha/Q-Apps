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
  FolderOpen,
  Filter,
  Search,
  RotateCcw,
  Layers,
  Users,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CustomSelect } from '../components/common/CustomSelect';

export const AnevRanking = () => {
  const { user } = useAuth();
  const role = user?.role || 'supervisor';
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';
  const isTL = role === 'team_leader' || role === 'tl';
  const isQA = role === 'quality_assurance' || role === 'qa';
  const isTrainer = role === 'trainer';

  const now = new Date();
  const currentRunningPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filter States (Restored & Enhanced)
  const [selectedPeriod, setSelectedPeriod] = useState(currentRunningPeriod);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedTl, setSelectedTl] = useState('all');
  const [selectedTrainer, setSelectedTrainer] = useState('all');
  const [selectedLimit, setSelectedLimit] = useState('5');
  const [search, setSearch] = useState('');

  const loadAnev = async (silent = false) => {
    if (!silent && !data) setLoading(true);
    try {
      const activeTlId = isTL && user?.team_leader_id ? user.team_leader_id : (selectedTl !== 'all' ? selectedTl : undefined);
      const activeTrnId = isTrainer && user?.trainer_id ? user.trainer_id : (selectedTrainer !== 'all' ? selectedTrainer : undefined);
      const res = await api.getAnevData(
        selectedPeriod,
        activeTlId,
        activeTrnId,
        role,
        user?.name,
        selectedChannel !== 'all' ? selectedChannel : undefined,
        parseInt(selectedLimit, 10) || 5,
        undefined,
        search || undefined
      );
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAnev();
  }, [selectedPeriod, selectedChannel, selectedTl, selectedTrainer, selectedLimit, search, isTL, isTrainer, user?.team_leader_id, user?.trainer_id, user?.name, role]);

  // Live Auto-Refresh Listener (Silent in-place update)
  useEffect(() => {
    const handleSync = () => loadAnev(true);
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedPeriod, selectedChannel, selectedTl, selectedTrainer, selectedLimit, search, isTL, isTrainer, user?.team_leader_id, user?.trainer_id, user?.name, role]);

  const handleResetFilters = () => {
    setSelectedChannel('all');
    setSelectedTl('all');
    setSelectedTrainer('all');
    setSelectedLimit('5');
    setSearch('');
  };

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

  const channelOptions = data?.filterOptions?.channels && data.filterOptions.channels.length > 0
    ? data.filterOptions.channels
    : [
        { value: 'all', label: 'Semua Kanal' },
        { value: 'Inbound', label: 'Inbound Call' },
        { value: 'Digilive', label: 'Digilive Chat' },
        { value: 'Socmed', label: 'Social Media' },
        { value: 'Email', label: 'Email Inbound' },
        { value: 'Email Outbound', label: 'Email Outbound' },
        { value: 'Outbound Call', label: 'Outbound Call' },
        { value: 'Back Office', label: 'Back Office' }
      ];

  const tlOptions = [
    { value: 'all', label: 'Semua Team Leader' },
    ...(data?.filterOptions?.teamLeaders || [])
  ];

  const trnOptions = [
    { value: 'all', label: 'Semua Trainer' },
    ...(data?.filterOptions?.trainers || [])
  ];

  const limitOptions = [
    { value: '5', label: 'Top / Bottom 5' },
    { value: '10', label: 'Top / Bottom 10' },
    { value: '20', label: 'Top / Bottom 20' }
  ];

  const hasActiveFilters = selectedChannel !== 'all' || selectedTl !== 'all' || selectedTrainer !== 'all' || selectedLimit !== '5' || search !== '';
  const hasData = data?.hasData && (data?.top5?.length > 0 || data?.bottom5?.length > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="corp-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200">
              MODUL 2
            </span>
            {isSupervisor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-900 border border-purple-200">
                Supervisor QA
              </span>
            )}
            {isTL && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200">
                Team Leader
              </span>
            )}
            {isQA && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-900 border border-blue-200">
                QA Evaluator
              </span>
            )}
          </div>
          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
            QA Analytics (Analisis & Evaluasi Ranking)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Evaluasi pemeringkatan skor Customer Accuracy (CA) & FCR agen per kanal layanan
          </p>
        </div>

        {/* Period Selector */}
        <div className="w-full sm:w-52">
          <CustomSelect
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={periodOptions}
            icon={Calendar}
          />
        </div>
      </div>

      {/* Corporate Filter Toolbar (Item 2) */}
      <div className="corp-card p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Filter Parameter QA Analytics
            </h3>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari agent, NIK, skor..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
          </div>

          {/* Kanal / Layanan Filter */}
          <CustomSelect
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            options={channelOptions}
            icon={Layers}
            placeholder="Pilih Kanal..."
          />

          {/* Team Leader Filter */}
          {!isTL && (
            <CustomSelect
              value={selectedTl}
              onChange={(e) => setSelectedTl(e.target.value)}
              options={tlOptions}
              icon={Users}
              placeholder="Pilih Team Leader..."
            />
          )}

          {/* Trainer Filter */}
          {!isTrainer && (
            <CustomSelect
              value={selectedTrainer}
              onChange={(e) => setSelectedTrainer(e.target.value)}
              options={trnOptions}
              icon={UserCheck}
              placeholder="Pilih Trainer..."
            />
          )}

          {/* Limit Filter */}
          <CustomSelect
            value={selectedLimit}
            onChange={(e) => setSelectedLimit(e.target.value)}
            options={limitOptions}
            icon={TrendingUp}
            placeholder="Jumlah Ranking..."
          />
        </div>
      </div>

      {/* Team Leader Under-Team Notice Banner */}
      {isTL && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              TL
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-xs">
                Monitoring Under-Team: {user?.team_leader_name || user?.name || 'Team Leader CC'}
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
            Scope: Under-Team
          </span>
        </div>
      )}

      {!hasData && !loading && (
        <div className="corp-card p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-2.5">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">
            Belum Ada Data Ranking Periode {currentPeriodLabel}
          </h3>
          <p className="text-xs text-slate-600 max-w-md">
            Data penilaian Top 5 &amp; Bottom 5 akan otomatis dihitung setelah data diimpor melalui menu Input &amp; Setting.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {data?.latestPeriod && data.latestPeriod.value !== selectedPeriod && (
              <button
                onClick={() => setSelectedPeriod(data.latestPeriod.value)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition active:scale-95 shadow-sm"
              >
                Tampilkan Periode {data.latestPeriod.label}
              </button>
            )}
            <Link to="/settings?tab=import" className="btn-primary">
              <Upload className="w-3.5 h-3.5" /> Import Data
            </Link>
          </div>
        </div>
      )}

      {/* Main Grid: Top 5 & Bottom 5 */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Performers */}
          <div className="corp-card p-5 border-t-4 border-t-emerald-600">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    AGEN TERBAIK (TOP {data?.top5?.length || selectedLimit} CA)
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
                  key={agent.id || index}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-600 w-6">
                        #{index + 1}
                      </span>
                      <div className="w-7 h-7 rounded-md bg-[#0F2744] text-white flex items-center justify-center font-bold text-xs">
                        {agent.name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-slate-900">{agent.name}</h4>
                          {agent.channel && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {agent.channel}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {agent.tl || 'TL Umum'} • {agent.trainer || 'TRN Umum'}
                          {agent.evaluations ? ` • ${agent.evaluations} Evaluasi` : ''}
                        </p>
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

          {/* Bottom Performers */}
          <div className="corp-card p-5 border-t-4 border-t-red-600">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-50 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    AGEN TERENDAH (BOTTOM {data?.bottom5?.length || selectedLimit} CA)
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
                  key={agent.id || index}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-red-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-red-700 w-6">
                        #{index + 1}
                      </span>
                      <div className="w-7 h-7 rounded-md bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                        {agent.name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-slate-900">{agent.name}</h4>
                          {agent.channel && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {agent.channel}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {agent.tl || 'TL Umum'} • {agent.trainer || 'TRN Umum'}
                          {agent.evaluations ? ` • ${agent.evaluations} Evaluasi` : ''}
                        </p>
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

      {/* Dynamic Role Personnel Status Monitoring */}
      <div className="corp-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-700" />
              {data?.personnelTitle || (isSupervisor ? 'Status Personel Evaluator QA (Live Shift)' : isTL ? 'Status Anggota Tim Binaan (Under-Team)' : isQA ? 'Status Personel Tim QA Evaluator' : 'Status Personel Tim')}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {data?.personnelSubtitle || (isSupervisor ? 'Monitoring ketersediaan tim evaluator QA saat proses observasi interaksi agen berlangsung.' : isTL ? 'Daftar anggota agen pelayanan aktif di bawah koordinasi Team Leader.' : 'Ketersediaan anggota tim operasional.')}
            </p>
          </div>
          {(data?.personnelStatus?.length > 0 || data?.evaluatorsStatus?.length > 0) && (
            <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {(data?.personnelStatus || data?.evaluatorsStatus).length} Personel
            </span>
          )}
        </div>

        {(!data?.personnelStatus && !data?.evaluatorsStatus) || ((data?.personnelStatus || data?.evaluatorsStatus).length === 0) ? (
          <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5 font-medium">
            <FolderOpen className="w-5 h-5 text-slate-400" />
            <span>
              {isSupervisor 
                ? 'Belum ada akun personel QA Evaluator terdaftar pada database.'
                : isTL
                ? 'Belum ada anggota tim agen binaan yang di-plotting ke Team Leader ini.'
                : isTrainer
                ? 'Belum ada anggota tim agen binaan yang di-plotting ke Trainer ini.'
                : 'Belum ada data personel terdaftar pada database.'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(data?.personnelStatus || data?.evaluatorsStatus)?.map((ev, index) => {
              const statusStr = String(ev.status || '').toUpperCase();
              const isOnDuty = ev.is_on_duty || statusStr === 'ON DUTY' || statusStr === 'AKTIF' || statusStr === 'ACTIVE' || statusStr === 'ON TRACK' || statusStr === 'ACHIEVED';
              const isOffDay = statusStr === 'OFF DAY' || statusStr === 'OFF_DAY' || statusStr === 'CUTI' || statusStr === 'SAKIT';

              const badgeColor = isOnDuty 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : isOffDay 
                ? 'bg-rose-50 text-rose-800 border-rose-200' 
                : 'bg-amber-50 text-amber-800 border-amber-200';

              const dotColor = isOnDuty ? 'bg-emerald-500' : isOffDay ? 'bg-rose-400' : 'bg-amber-400';

              return (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-slate-600 font-bold truncate max-w-[100px]">{ev.role}</span>
                      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 leading-tight truncate" title={ev.name}>{ev.name}</h4>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-200">
                    <span className="text-[9px] text-slate-500">Status:</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badgeColor}`}>
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
