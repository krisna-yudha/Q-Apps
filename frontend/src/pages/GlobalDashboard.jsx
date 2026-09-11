import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Filter,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  PhoneCall,
  MessageSquare,
  Mail,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  Award,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  Zap,
  Building2,
  Users,
  ShieldCheck,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CustomSelect } from '../components/common/CustomSelect';

const CHANNEL_TABS = [
  { id: 'all', label: 'Semua Saluran (Global)', icon: Layers, color: 'blue' },
  { id: 'Inbound', label: 'Inbound Call', icon: PhoneCall, color: 'indigo' },
  { id: 'Digilive', label: 'Digilive (Chat)', icon: Zap, color: 'emerald' },
  { id: 'Socmed', label: 'Social Media', icon: MessageSquare, color: 'purple' },
  { id: 'Email', label: 'Email Inbound', icon: Mail, color: 'sky' },
  { id: 'Email Outbound', label: 'Email Outbound', icon: Mail, color: 'amber' },
  { id: 'Outbound Call', label: 'Outbound Call', icon: PhoneCall, color: 'orange' },
  { id: 'Back Office', label: 'Back Office (BO)', icon: Building2, color: 'rose' },
];

export const GlobalDashboard = () => {
  const { user } = useAuth();
  const role = user?.role || 'supervisor';
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';
  const isTL = role === 'team_leader' || role === 'tl';
  const isQA = role === 'quality_assurance' || role === 'qa';

  const now = new Date();
  const currentRunningMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentRunningYear = String(now.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentRunningMonth);
  const [selectedYear, setSelectedYear] = useState(currentRunningYear);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [activeChartTab, setActiveChartTab] = useState('weekly'); // 'weekly', 'monthly', 'channel_compare', 'quality_distribution'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchDashboardData = async (silent = false) => {
    if (!silent && !data) setLoading(true);
    try {
      const period = `${selectedYear}-${selectedMonth}`;
      const activeTlId = isTL && user?.team_leader_id ? user.team_leader_id : undefined;
      const res = await api.getGlobalDashboard(period, selectedChannel, activeTlId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedYear, selectedChannel, isTL, user?.team_leader_id]);

  // Live Auto-Refresh Listener (Silent in-place update)
  useEffect(() => {
    const handleSync = () => fetchDashboardData(true);
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedMonth, selectedYear, selectedChannel, isTL, user?.team_leader_id]);

  const months = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  const currentMonthName = months.find(m => m.value === selectedMonth)?.label || months[now.getMonth()]?.label || 'Bulan Berjalan';
  const hasData = data?.hasData;

  const CustomTrendTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const caVal = payload.find(p => p.dataKey === 'ca')?.value;
      const fcrVal = payload.find(p => p.dataKey === 'fcr')?.value;
      const callsVal = payload[0]?.payload?.calls;
      const isLive = payload[0]?.payload?.isLive;
      const hasMonthData = caVal !== null && caVal !== undefined;

      return (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[200px]">
          <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between">
            <span>Periode: {label} {selectedYear}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isLive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800'
            }`}>
              {isLive ? '📍 Live Import' : '📊 Histori Tren'}
            </span>
          </p>
          {hasMonthData ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0F2744]"></span>
                  Customer Accuracy:
                </span>
                <span className="font-black text-slate-900">{caVal}%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
                  First Call Resolution:
                </span>
                <span className="font-black text-slate-900">{fcrVal !== null ? `${fcrVal}%` : '0%'}</span>
              </div>
              {callsVal > 0 && (
                <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-500">Volume Sampel:</span>
                  <span className="font-bold text-slate-800">{callsVal.toLocaleString('id-ID')} Sesi</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500 text-[11px] italic py-0.5">Belum ada file evaluasi yang diimpor</p>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[180px]">
          <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">
            Saluran: {label}
          </p>
          {payload.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                {item.name}:
              </span>
              <span className="font-black text-slate-900">{item.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Main Filter Ribbon */}
      <div className="corp-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              MODUL 1
            </span>
            {isSupervisor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-900 border border-purple-200">
                Role: Supervisor QA (Macro Dashboard)
              </span>
            )}
            {isTL && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200">
                Role: Team Leader (Under-Team Read-Only)
              </span>
            )}
            {isQA && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-900 border border-blue-200">
                Role: QA Evaluator (Monitoring Mutu Global)
              </span>
            )}
          </div>
          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
            Dashboard Pencapaian Global (CA & FCR)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            {isTL
              ? `Monitoring performa Customer Accuracy (CA) & FCR khusus untuk anggota tim under-team ${user?.team_leader_name || user?.name || ''} (Read-Only).`
              : `Monitoring performa makro Customer Accuracy (CA), First Call Resolution (FCR), dan status mutu operasional periode ${currentMonthName} ${selectedYear}.`}
          </p>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
          <div className="w-full sm:w-44">
            <CustomSelect
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={months.map(m => ({ value: m.value, label: m.label }))}
              icon={Calendar}
            />
          </div>

          <div className="w-full sm:w-32">
            <CustomSelect
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              options={[
                { value: '2026', label: '2026' },
                { value: '2025', label: '2025' }
              ]}
              icon={Filter}
            />
          </div>

          <button
            onClick={fetchDashboardData}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs flex items-center justify-center self-stretch sm:self-auto"
            title="Refresh Data Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
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
                Mode Monitoring Team Leader: {user?.team_leader_name || user?.name || 'Team Leader CC'}
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Dashboard ini menampilkan metrik CA & FCR, tren mingguan, dan sebaran mutu khusus agen <strong>under-team</strong> binaan Anda (Read-Only).
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
            {data?.kpi?.totalAgents || 0} Agen Terpantau
          </span>
        </div>
      )}

      {/* Saluran QSF Quick Switcher Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {CHANNEL_TABS.map(tab => {
          const Icon = tab.icon;
          const isSelected = selectedChannel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedChannel(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                isSelected
                  ? 'bg-[#0F2744] text-white shadow-sm ring-2 ring-blue-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-300' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* No Data Alert Banner for Periods without Imported Assessments */}
      {!hasData && !loading && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Belum Ada Data Evaluasi untuk Periode {currentMonthName} {selectedYear}</p>
              <p className="text-amber-700 text-[11px] mt-0.5">
                {data?.latestPeriod ? (
                  <>
                    Data evaluasi yang tersedia di database saat ini adalah periode <strong>{data.latestPeriod.label} ({data.latestPeriod.count.toLocaleString('id-ID')} sesi audit)</strong>. Anda dapat beralih periode atau mengimpor file QSF baru melalui Modul 7 (Input, Import & Setting).
                  </>
                ) : (
                  <>
                    Belum ada data evaluasi QSF yang diimpor ke sistem. Anda dapat mengimpor file evaluasi melalui Modul 7 (Input, Import & Setting).
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data?.latestPeriod && (
              <button
                onClick={() => {
                  setSelectedMonth(data.latestPeriod.month);
                  setSelectedYear(data.latestPeriod.year);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition active:scale-95"
              >
                Tampilkan {data.latestPeriod.label}
              </button>
            )}
            <Link
              to="/input-supervisor"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 transition active:scale-95"
            >
              Import Data
            </Link>
          </div>
        </div>
      )}

      {/* Top 4 KPI Hero Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: CA Score */}
        <div className="corp-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rata-Rata CA Global</span>
              <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {data?.kpi?.avgCA ?? 0}%
              </span>
              {hasData && (
                <span className={`text-xs font-bold flex items-center ${data?.kpi?.avgCA >= 85 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  <ArrowUpRight className="w-3.5 h-3.5" /> {data?.kpi?.caDiff >= 0 ? `+${data?.kpi?.caDiff}% vs Target` : `${data?.kpi?.caDiff}%`}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Target Mutu: <strong className="text-slate-800">85.0%</strong></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              data?.kpi?.avgCA >= 85 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {data?.kpi?.avgCA >= 85 ? 'Target Tercapai' : 'Di Bawah Target'}
            </span>
          </div>
        </div>

        {/* Card 2: FCR Score */}
        <div className="corp-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rata-Rata FCR Global</span>
              <span className="p-1.5 rounded-xl bg-amber-50 text-amber-700">
                <Target className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {data?.kpi?.avgFCR ?? 0}%
              </span>
              {hasData && (
                <span className={`text-xs font-bold flex items-center ${data?.kpi?.avgFCR >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  <ArrowUpRight className="w-3.5 h-3.5" /> {data?.kpi?.fcrDiff >= 0 ? `+${data?.kpi?.fcrDiff}% vs Target` : `${data?.kpi?.fcrDiff}%`}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Target FCR: <strong className="text-slate-800">100.0%</strong></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              data?.kpi?.avgFCR >= 100 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {data?.kpi?.avgFCR >= 100 ? 'Target Tercapai' : 'Perlu Kalibrasi'}
            </span>
          </div>
        </div>

        {/* Card 3: Total Evaluasi & Personil */}
        <div className="corp-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Sampel Evaluasi</span>
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-700">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {data?.kpi?.totalEvaluations?.toLocaleString('id-ID') ?? '0'}
              </span>
              <span className="text-xs text-slate-500 font-semibold">Sesi Audit</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Total Personel: <strong className="text-slate-800">{data?.kpi?.totalAgents ?? 0} Agen</strong></span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              Live Data
            </span>
          </div>
        </div>

        {/* Card 4: Status Kualitas Mutu */}
        <div className="corp-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Grade Mutu Operasional</span>
              <span className="p-1.5 rounded-xl bg-purple-50 text-purple-700">
                <Award className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {data?.kpi?.qualityGrade || 'Grade A (Baik Sekali)'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Standar Mutu: <strong className="text-slate-800">CA &ge; 85.0%</strong></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              (data?.kpi?.avgCA ?? 0) >= 85
                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {(data?.kpi?.avgCA ?? 0) >= 85 ? 'Sesuai Standar' : 'Perlu Pembinaan'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Analytics Hub with Multi-Tab View */}
      <div className="corp-card p-5 sm:p-6 space-y-5">
        {/* Navigation Tabs for Charts & Quick Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700" />
              Visualisasi & Analitik Performa Kualitas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis tren mingguan {currentMonthName}, histori 12 bulan {selectedYear}, dan komparasi saluran QSF.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto max-w-full scrollbar-none">
            {[
              { id: 'weekly', label: `Tren Mingguan (${currentMonthName})`, icon: Activity },
              { id: 'monthly', label: `Tren Bulanan (12 Bulan)`, icon: TrendingUp },
              { id: 'channel_compare', label: 'Komparasi 7 Saluran', icon: Layers },
              { id: 'quality_distribution', label: 'Distribusi Status Mutu', icon: PieIcon },
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeChartTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveChartTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-[#0F2744] text-white shadow-md ring-1 ring-blue-900/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-300' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Highlights Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-600 block">Rata-rata CA</span>
              <strong className="text-sm font-black text-slate-900">{data?.kpi?.avgCA ?? 0}%</strong>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Target 85%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-600 block">Rata-rata FCR</span>
              <strong className="text-sm font-black text-slate-900">{data?.kpi?.avgFCR ?? 0}%</strong>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Target 100%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Evaluasi</span>
              <strong className="text-sm font-black text-slate-900">{data?.kpi?.totalEvaluations?.toLocaleString('id-ID') ?? 0}</strong>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              Sesi Audit
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-600 block">Status Mutu</span>
              <strong className="text-xs font-black text-slate-900">{data?.kpi?.qualityGrade || 'Belum Ada'}</strong>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
              {data?.kpi?.totalAgents ?? 0} Agen
            </span>
          </div>
        </div>

        {/* TAB 1: TREN MINGGUAN BULAN AKTIF (W1 - W5) */}
        {activeChartTab === 'weekly' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 text-xs gap-2">
              <div className="flex items-center gap-4 font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#0F2744] inline-block rounded"></span>
                  <span className="text-slate-800">Customer Accuracy (CA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#D97706] inline-block rounded"></span>
                  <span className="text-slate-800">First Call Resolution (FCR)</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Pergerakan Mutu Mingguan Periode {currentMonthName} {selectedYear}
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data?.weeklyTrends || []}
                  margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="caGradWeekly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F2744" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0F2744" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="fcrGradWeekly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97706" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                  <YAxis domain={[70, 100]} stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                  <Tooltip content={<CustomTrendTooltip />} />
                  <ReferenceLine
                    y={85}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    label={{ value: 'Target CA (85%)', fill: '#047857', fontSize: 10, position: 'top', offset: 4, fontWeight: 'bold' }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="#D97706"
                    strokeDasharray="4 4"
                    label={{ value: 'Target FCR (100%)', fill: '#B45309', fontSize: 10, position: 'bottom', offset: 4, fontWeight: 'bold' }}
                  />

                  <Area
                    type="monotone"
                    dataKey="ca"
                    name="Customer Accuracy"
                    stroke="#0F2744"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0F2744', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#0F2744' }}
                    fillOpacity={1}
                    fill="url(#caGradWeekly)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="fcr"
                    name="First Call Resolution"
                    stroke="#D97706"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#D97706', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#D97706' }}
                    fillOpacity={1}
                    fill="url(#fcrGradWeekly)"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 2: TREN BULANAN (12 Bulan Jan - Des) */}
        {activeChartTab === 'monthly' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 text-xs gap-2">
              <div className="flex items-center gap-4 font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#0F2744] inline-block rounded"></span>
                  <span className="text-slate-800">Customer Accuracy (CA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#D97706] inline-block rounded"></span>
                  <span className="text-slate-800">First Call Resolution (FCR)</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Histori Performa Tahunan 12 Bulan ({selectedYear})
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data?.trends || []}
                  margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F2744" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0F2744" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="fcrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97706" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                  <YAxis domain={[60, 100]} stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                  <Tooltip content={<CustomTrendTooltip />} />
                  <ReferenceLine
                    y={85}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    label={{ value: 'Target CA (85%)', fill: '#047857', fontSize: 10, position: 'top', offset: 4, fontWeight: 'bold' }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="#D97706"
                    strokeDasharray="4 4"
                    label={{ value: 'Target FCR (100%)', fill: '#B45309', fontSize: 10, position: 'bottom', offset: 4, fontWeight: 'bold' }}
                  />

                  <Area
                    type="monotone"
                    dataKey="ca"
                    name="Customer Accuracy"
                    stroke="#0F2744"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#0F2744', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#0F2744' }}
                    fillOpacity={1}
                    fill="url(#caGradient)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="fcr"
                    name="First Call Resolution"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#D97706', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#D97706' }}
                    fillOpacity={1}
                    fill="url(#fcrGradient)"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 3: KOMPARASI 7 SALURAN (BAR CHART) */}
        {activeChartTab === 'channel_compare' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 text-xs gap-2">
              <div className="flex items-center gap-4 font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-[#0F2744] inline-block rounded"></span>
                  <span className="text-slate-800">Capaian CA (%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-[#D97706] inline-block rounded"></span>
                  <span className="text-slate-800">Capaian FCR (%)</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Performa 7 Saluran Resmi QSF Periode {currentMonthName} {selectedYear}</span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.channels || []}
                  margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                  <YAxis domain={[0, 100]} stroke="#CBD5E1" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <ReferenceLine y={85} stroke="#059669" strokeDasharray="3 3" label={{ value: 'Target CA 85%', fill: '#047857', fontSize: 10, position: 'top' }} />
                  <ReferenceLine y={100} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Target FCR 100%', fill: '#B45309', fontSize: 10, position: 'bottom' }} />
                  <Bar dataKey="ca" name="CA (%)" fill="#0F2744" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="fcr" name="FCR (%)" fill="#D97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 4: DISTRIBUSI STATUS MUTU (DONUT & METRICS) */}
        {activeChartTab === 'quality_distribution' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.qualityDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {data?.qualityDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} Orang`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="md:col-span-2 space-y-3">
              {data?.qualityDistribution?.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-md" style={{ backgroundColor: item.color }}></span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                      <p className="text-[10px] text-slate-500">{item.label}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900">{item.count} Agen</span>
                    <span className="text-[11px] text-slate-500 block font-semibold">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Middle Grid: Kategori Masalah & Parameter Fokus Coaching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kategori Masalah Tiket */}
        <div className="corp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-purple-700" />
                Distribusi Kategori Masalah Tiket
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Proporsi transaksi berdasarkan jenis Gangguan, Informasi, dan Keluhan.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700">
              {data?.kpi?.totalEvaluations?.toLocaleString('id-ID')} Tiket
            </span>
          </div>

          <div className="space-y-2.5">
            {data?.categoryDistribution?.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                    {cat.name}
                  </span>
                  <span className="text-slate-600 font-semibold">
                    {cat.count.toLocaleString('id-ID')} Sesi ({cat.percentage}%) • CA: <strong className="text-slate-900">{cat.avg_ca}%</strong>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Focus Coaching: Parameter Kepatuhan Terendah */}
        <div className="corp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Fokus Pembinaan (Parameter Nilai Terendah)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Parameter mutu yang paling membutuhkan kalibrasi & briefing supervisor.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Action Plan
            </span>
          </div>

          <div className="space-y-2">
            {data?.lowestParameters?.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Seluruh parameter memenuhi ambang batas target.</p>
            ) : (
              data?.lowestParameters?.map((param, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight">{param.name}</h4>
                      <span className="text-[10px] text-slate-500">Saluran: {param.service_name} (Kode {param.code})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-amber-700">
                      {param.achievement_pct !== undefined && param.achievement_pct !== null ? `${param.achievement_pct}%` : `${param.average_score} Poin`}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {param.average_score} {param.max_score ? `/ ${parseFloat(param.max_score)}` : ''} ({param.total_assessment} Sampel)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 7 Channel QSF Performance Matrix Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-700" />
            Matriks Performa 7 Saluran Layanan QSF
          </h3>
          <Link
            to="/input-supervisor"
            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>Buka Modul Import & Input</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data?.channels?.map((ch, idx) => (
            <div key={idx} className="corp-card p-4 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      {ch.name.includes('Call') ? <PhoneCall className="w-3.5 h-3.5" /> :
                       ch.name.includes('Chat') || ch.name.includes('Digilive') ? <Zap className="w-3.5 h-3.5 text-emerald-600" /> :
                       ch.name.includes('Email') ? <Mail className="w-3.5 h-3.5 text-sky-600" /> :
                       ch.name.includes('Socmed') ? <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> :
                       <Building2 className="w-3.5 h-3.5 text-rose-600" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 leading-tight">{ch.name}</h4>
                      <span className="text-[10px] text-slate-500">{ch.agent_count} Personel</span>
                    </div>
                  </div>

                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    ch.status === 'Exceed Target' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    ch.status === 'Meet Target' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                    ch.has_data ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {ch.status}
                  </span>
                </div>

                <div className="space-y-2 mt-3 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-700 mb-1 text-[11px]">
                      <span>Customer Accuracy:</span>
                      <span className="font-black text-slate-900">{ch.ca}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0F2744] h-full rounded-full transition-all duration-500"
                        style={{ width: `${ch.ca}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-700 mb-1 text-[11px]">
                      <span>First Call Resolution:</span>
                      <span className="font-black text-slate-900">{ch.fcr}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#D97706] h-full rounded-full transition-all duration-500"
                        style={{ width: `${ch.fcr}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Total Sampel:</span>
                <strong className="text-slate-800">{ch.count.toLocaleString('id-ID')} Sesi</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
