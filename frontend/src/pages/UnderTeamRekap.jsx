import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Award,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Download,
  Filter,
  Eye,
  Settings,
  ChevronRight,
  User,
  Zap,
  PhoneCall,
  Mail,
  MessageSquare,
  Sparkles,
  Layers,
  ArrowUpRight,
  ExternalLink,
  ShieldAlert,
  Calendar,
  X,
  RotateCcw,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSubServiceBadgeStyle, formatSubServiceDisplay } from './SupervisorInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { formatPct, formatNum } from '../utils/formatters';

const CHANNEL_TABS = [
  { id: 'all', label: 'Semua Saluran (Global)', icon: Layers },
  { id: 'Inbound', label: 'Inbound Call', icon: PhoneCall },
  { id: 'Digilive', label: 'Digilive (Chat)', icon: Zap },
  { id: 'Socmed', label: 'Social Media', icon: MessageSquare },
  { id: 'Email', label: 'Email Inbound', icon: Mail },
  { id: 'Email Outbound', label: 'Email Outbound', icon: Mail },
  { id: 'Outbound Call', label: 'Outbound Call', icon: PhoneCall },
  { id: 'Back Office', label: 'Back Office (BO)', icon: Building2 },
];

export const UnderTeamRekap = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || 'team_leader';
  const isTL = role === 'team_leader' || role === 'tl';
  const isTrainer = role === 'trainer';
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';

  const roleTitle = isTL ? 'Team Leader' : isTrainer ? 'Trainer Pengampu' : (isSupervisor ? 'Supervisor QA' : 'Lead Binaan');
  const leaderName = user?.name || (isTL ? user?.team_leader_name : user?.trainer_name) || 'Lead Operasional';

  // Default to 2026-09 (latest imported QSF period) or current period
  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'naker'
  const [selectedPeriod, setSelectedPeriod] = useState('2026-09');
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'pass' | 'need_coaching'

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [nakerList, setNakerList] = useState([]);
  const [nakerSummary, setNakerSummary] = useState(null);
  const [latestDataPeriod, setLatestDataPeriod] = useState(null);

  // Month options for period selector (Januari - Desember 2026)
  const periods = useMemo(() => {
    const list = [];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    for (let m = 1; m <= 12; m++) {
      const val = `2026-${String(m).padStart(2, '0')}`;
      list.push({ value: val, label: `${monthNames[m - 1]} 2026` });
    }
    return list;
  }, []);

  const channelOptions = useMemo(() => [
    { value: 'all', label: 'Semua Saluran Layanan' },
    { value: 'Inbound', label: 'Inbound Call' },
    { value: 'Digilive', label: 'Digilive (Live Chat)' },
    { value: 'Socmed', label: 'Social Media' },
    { value: 'Email', label: 'Email Inbound' },
    { value: 'Email Outbound', label: 'Email Outbound' },
    { value: 'Outbound Call', label: 'Outbound Call' },
    { value: 'Back Office', label: 'Back Office (BO)' },
  ], []);

  const statusOptions = useMemo(() => [
    { value: 'all', label: 'Semua Status Mutu' },
    { value: 'pass', label: 'Memenuhi Standar (≥85%)' },
    { value: 'need_coaching', label: 'Perlu Coaching (<85%)' },
  ], []);

  const handlePeriodChange = (e) => {
    const val = typeof e === 'object' ? (e.target?.value || e.value) : e;
    if (val) setSelectedPeriod(String(val));
  };

  const handleChannelChange = (e) => {
    const val = typeof e === 'object' ? (e.target?.value || e.value) : e;
    setSelectedChannel(val || 'all');
  };

  const handleStatusChange = (e) => {
    const val = typeof e === 'object' ? (e.target?.value || e.value) : e;
    setSelectedStatus(val || 'all');
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedChannel('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = Boolean(search || (selectedChannel && selectedChannel !== 'all') || (selectedStatus && selectedStatus !== 'all'));

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch Performance / Assessments Recap
      const recapParams = {
        period: selectedPeriod,
        search: search || undefined,
        channel: selectedChannel !== 'all' ? selectedChannel : undefined,
      };

      if (isTL) {
        if (user?.team_leader_id) recapParams.team_leader_id = user.team_leader_id;
        recapParams.team_leader_name = user?.team_leader_name || user?.name;
      } else if (isTrainer) {
        if (user?.trainer_id) recapParams.trainer_id = user.trainer_id;
        recapParams.trainer_name = user?.trainer_name || user?.name;
      }

      const recapRes = await api.getAgentRecap(recapParams);
      const rawAgents = recapRes?.data || [];

      // Filter by TL/Trainer name if present
      let filteredAgents = rawAgents;
      if (isTL && (user?.name || user?.team_leader_name)) {
        const myName = (user?.team_leader_name || user?.name || '').toLowerCase();
        filteredAgents = rawAgents.filter(a => {
          const tlName = (a.tl || a.team_leader_name || a.team_leader?.name || '').toLowerCase();
          return !tlName || tlName.includes(myName) || myName.includes(tlName) || tlName === 'tl umum';
        });
      } else if (isTrainer && (user?.name || user?.trainer_name)) {
        const myName = (user?.trainer_name || user?.name || '').toLowerCase();
        filteredAgents = rawAgents.filter(a => {
          const trnName = (a.trainer || a.trainer_name || a.trainer?.name || '').toLowerCase();
          return !trnName || trnName.includes(myName) || myName.includes(trnName) || trnName === 'trn umum';
        });
      }
      setAgents(filteredAgents.length > 0 ? filteredAgents : rawAgents);

      // 2. Fetch Master NAKER plotting
      const nakerParams = {
        per_page: 500,
        search: search || undefined,
        service: selectedChannel !== 'all' ? selectedChannel : undefined,
        period_month: selectedPeriod,
      };

      if (isTL) {
        if (user?.team_leader_id) nakerParams.team_leader_id = user.team_leader_id;
        nakerParams.team_leader_name = user?.team_leader_name || user?.name;
      } else if (isTrainer) {
        if (user?.trainer_id) nakerParams.trainer_id = user.trainer_id;
        nakerParams.trainer_name = user?.trainer_name || user?.name;
      }

      const nakerRes = await api.getEmployees(nakerParams);
      const nakerItems = nakerRes?.data?.data || (Array.isArray(nakerRes?.data) ? nakerRes.data : []);
      setNakerList(nakerItems);
      setNakerSummary(nakerRes?.summary || null);

    } catch (err) {
      console.error('Error fetching under-team data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod, selectedChannel, search, isTL, isTrainer, user?.team_leader_id, user?.trainer_id, user?.name, user?.team_leader_name, user?.trainer_name]);

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => fetchData(true);
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedPeriod, selectedChannel, search, isTL, isTrainer]);

  // Performance KPI calculations
  const performanceStats = useMemo(() => {
    const total = agents.length;
    if (total === 0) {
      return {
        totalAgents: nakerList.length,
        avgCA: '0.00',
        avgFCR: '0.00',
        passCount: 0,
        needCoachingCount: 0,
        passRate: '0.00'
      };
    }

    const totalCA = agents.reduce((sum, a) => sum + (parseFloat(a.ca_score || a.ca) || 0), 0);
    const avgCA = (totalCA / total).toFixed(2);

    const validFcrAgents = agents.filter(a => a.fcr_score !== undefined || a.fcr !== undefined);
    const totalFCR = validFcrAgents.reduce((sum, a) => sum + (parseFloat(a.fcr_score || a.fcr) || 0), 0);
    const avgFCR = validFcrAgents.length > 0 ? (totalFCR / validFcrAgents.length).toFixed(2) : '0.00';

    const passCount = agents.filter(a => (parseFloat(a.ca_score || a.ca) || 0) >= 85).length;
    const needCoachingCount = total - passCount;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(2) : '0.00';

    return {
      totalAgents: Math.max(total, nakerList.length),
      avgCA,
      avgFCR,
      passCount,
      needCoachingCount,
      passRate
    };
  }, [agents, nakerList]);

  // Filtered performance agents
  const displayAgents = useMemo(() => {
    return agents.filter(a => {
      const ca = parseFloat(a.ca_score || a.ca) || 0;
      if (selectedStatus === 'pass' && ca < 85) return false;
      if (selectedStatus === 'need_coaching' && ca >= 85) return false;
      return true;
    });
  }, [agents, selectedStatus]);

  // Export to Excel
  const handleExportExcel = () => {
    const rows = nakerList.length > 0 ? nakerList.map((emp, idx) => ({
      'No': idx + 1,
      'Nama Tenaga Kerja': emp.name,
      'ID SIP / NIK': emp.sip_id,
      'Jenis Kelamin': emp.gender,
      'Layanan Penugasan': emp.current_assignment?.service?.name || emp.current_assignment?.service?.code || '-',
      'Sub Layanan': emp.current_assignment?.sub_service || emp.sub_service || '-',
      'Team Leader (TL)': emp.current_assignment?.team_leader?.name || '-',
      'Trainer Pengampu': emp.current_assignment?.trainer?.name || '-',
      'Site': emp.current_assignment?.site?.code || 'SMG',
      'Status': emp.status?.toUpperCase() || 'AKTIF'
    })) : agents.map((a, idx) => ({
      'No': idx + 1,
      'Nama Tenaga Kerja': a.name,
      'ID SIP / NIK': a.nik || '-',
      'Kanal Layanan': a.channel || '-',
      'Nilai Mutu CA': a.ca_score || a.ca || 0,
      'FCR (%)': a.fcr_score || a.fcr || 0,
      'Team Leader': a.team_leader_name || '-',
      'Trainer': a.trainer_name || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tim_Binaan');
    XLSX.writeFile(wb, `Rekap_Tim_${leaderName.replace(/\s+/g, '_')}_${selectedPeriod}.xlsx`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Card Corporate Theme (Harmonized with Modul 1-3) */}
      <div className="corp-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-700" />
              TIM BINAAN HUB
            </span>
            {isTL && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-emerald-700" />
                Team Leader
              </span>
            )}
            {isTrainer && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-50 text-cyan-900 border border-cyan-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-700" />
                Trainer Pengampu
              </span>
            )}
            {isSupervisor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-900 border border-purple-200 flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-700" />
                Supervisor QA
              </span>
            )}
          </div>

          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight mt-1.5">
            Rekap &amp; Pemantauan Tim: <span className="text-blue-700">{leaderName}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Pemantauan performa mutu, nilai CA, tingkat penyelesaian FCR, dan data plotting Master NAKER tim binaan Anda.
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="w-full sm:w-48">
            <CustomSelect
              options={periods}
              value={selectedPeriod}
              onChange={handlePeriodChange}
              icon={Calendar}
              placeholder="Pilih Periode..."
            />
          </div>

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Perbarui Data Tim"
          >
            <RefreshCw className={`w-4 h-4 text-blue-700 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="btn-secondary py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Unduh rekap performa & master data tim dalam format Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Tim (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. Saluran QSF Quick Switcher Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {CHANNEL_TABS.map(tab => {
          const Icon = tab.icon;
          const isSelected = selectedChannel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedChannel(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer ${
                isSelected
                  ? 'bg-[#0F2744] text-white shadow-xs ring-2 ring-blue-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-300' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Period Notice Banner if current period has no evaluations */}
      {agents.length === 0 && !loading && selectedPeriod !== '2026-09' && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">Belum Ada Data Evaluasi QSF untuk Periode {selectedPeriod}</p>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Data nilai evaluasi mutu terakhir yang telah diimpor tersedia di periode <strong>September 2026 (2026-09)</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPeriod('2026-09')}
            className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition active:scale-95 shadow-2xs shrink-0 cursor-pointer"
          >
            Tampilkan September 2026
          </button>
        </div>
      )}

      {/* 3. Top Summary KPI Hero Cards (Harmonized 5-Card Corporate Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Total Anggota Tim */}
        <div className="corp-card p-4 sm:p-4.5 flex flex-col justify-between hover:shadow-xs transition duration-200">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Anggota Tim</span>
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{performanceStats.totalAgents}</span>
              <span className="text-xs font-bold text-slate-500">CSO Binaan</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Master NAKER:</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              {nakerList.length} Terdata
            </span>
          </div>
        </div>

        {/* Card 2: Rata-Rata CA */}
        <div className="corp-card p-4 sm:p-4.5 flex flex-col justify-between hover:shadow-xs transition duration-200">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rata-Rata CA</span>
              <span className={`p-1.5 rounded-xl border shadow-2xs ${
                parseFloat(performanceStats.avgCA) >= 85
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-100'
              }`}>
                <Award className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-black ${
                parseFloat(performanceStats.avgCA) >= 85 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {formatPct(performanceStats.avgCA)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Target Mutu: <strong className="text-slate-700">85.00%</strong></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              parseFloat(performanceStats.avgCA) >= 85
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {parseFloat(performanceStats.avgCA) >= 85 ? 'Tercapai' : 'Di Bawah Target'}
            </span>
          </div>
        </div>

        {/* Card 3: Tingkat FCR */}
        <div className="corp-card p-4 sm:p-4.5 flex flex-col justify-between hover:shadow-xs transition duration-200">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tingkat FCR</span>
              <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
                <Zap className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-indigo-950">
                {formatPct(performanceStats.avgFCR)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Target FCR: <strong className="text-slate-700">100.00%</strong></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              parseFloat(performanceStats.avgFCR) >= 100
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}>
              {parseFloat(performanceStats.avgFCR) >= 100 ? 'Tercapai' : 'First Contact'}
            </span>
          </div>
        </div>

        {/* Card 4: Memenuhi Standar */}
        <div className="corp-card p-4 sm:p-4.5 flex flex-col justify-between hover:shadow-xs transition duration-200">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Memenuhi Standar</span>
              <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700">{performanceStats.passCount}</span>
              <span className="text-xs font-bold text-emerald-600">({formatPct(performanceStats.passRate)})</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Skor CA &ge; 85.00%</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Good Rating
            </span>
          </div>
        </div>

        {/* Card 5: Butuh Coaching */}
        <div className="corp-card p-4 sm:p-4.5 flex flex-col justify-between hover:shadow-xs transition duration-200 col-span-2 sm:col-span-1">
          <div>
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Butuh Coaching</span>
              <span className={`p-1.5 rounded-xl border shadow-2xs ${
                performanceStats.needCoachingCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <AlertCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-black ${
                performanceStats.needCoachingCount > 0 ? 'text-amber-700' : 'text-slate-800'
              }`}>
                {performanceStats.needCoachingCount}
              </span>
              <span className="text-xs font-bold text-slate-500">CSO</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Skor CA &lt; 85.00%</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              performanceStats.needCoachingCount > 0
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {performanceStats.needCoachingCount > 0 ? 'Perlu Bimbingan' : 'Nihil'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Sub-Navigation Tabs & Search Filter Toolbar */}
      <div className="corp-card p-3.5 sm:p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left Segmented Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'performance'
                ? 'bg-white text-[#0F2744] shadow-xs ring-1 ring-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'performance' ? 'text-blue-700' : 'text-slate-500'}`} />
            <span>Matriks Performa &amp; Nilai ({displayAgents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('naker')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'naker'
                ? 'bg-white text-[#0F2744] shadow-xs ring-1 ring-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${activeTab === 'naker' ? 'text-blue-700' : 'text-slate-500'}`} />
            <span>Plotting Master NAKER ({nakerList.length})</span>
          </button>
        </div>

        {/* Right Search & Filter Tools */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search Input with Clear Button */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama agent, NIK, SIP ID..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition font-medium shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Performance Status Filter (Only in Performance Tab) */}
          {activeTab === 'performance' && (
            <div className="w-full sm:w-48">
              <CustomSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={handleStatusChange}
                icon={Filter}
                placeholder="Status Mutu..."
              />
            </div>
          )}

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 transition flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Reset semua filter pencarian"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Tab Content Area */}
      {loading ? (
        <div className="corp-card p-14 bg-white border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <RefreshCw className="w-8 h-8 text-blue-700 animate-spin" />
          <p className="text-xs font-bold text-slate-700">Memuat data tim binaan...</p>
          <p className="text-[11px] text-slate-400">Sinkronisasi data penilaian dan plotting Master NAKER</p>
        </div>
      ) : activeTab === 'performance' ? (
        /* ================= TAB 1: MATRIKS PERFORMA & SCORECARD ================= */
        <div className="corp-card bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                Matriks Nilai & Performa Mutu Anggota Tim ({displayAgents.length} Personel)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Data matang hasil evaluasi QA untuk periode <strong>{selectedPeriod}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/rekap-agent"
                className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition flex items-center gap-1 shadow-2xs"
                title="Buka Modul 3: Rekap Nilai Agent Lengkap"
              >
                <span>Buka Modul 3 (Rekap Lengkap)</span>
                <ArrowUpRight className="w-3 h-3 text-blue-600" />
              </Link>
              <Link
                to="/anev"
                className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition flex items-center gap-1 shadow-2xs"
                title="Buka Modul 2: Analisis & Evaluasi Ranking"
              >
                <span>Buka Modul 2 (Anev Ranking)</span>
                <ArrowUpRight className="w-3 h-3 text-purple-600" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Nama CSO / Agent</th>
                  <th className="py-3.5 px-4">ID SIP / NIK</th>
                  <th className="py-3.5 px-4">Kanal Layanan</th>
                  <th className="py-3.5 px-4 text-center">Nilai Mutu CA</th>
                  <th className="py-3.5 px-4 text-center">FCR (%)</th>
                  <th className="py-3.5 px-4 text-center">Predikat Mutu</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayAgents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <Users className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Belum Ada Data Nilai untuk Anggota Tim Ini</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                        Pastikan data asesmen QSF telah diimpor untuk periode <strong>{selectedPeriod}</strong> atau periksa plotting Master NAKER di tab sebelah.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('naker')}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Lihat Plotting Master NAKER</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayAgents.map((agent, idx) => {
                    const caScore = parseFloat(agent.ca_score || agent.ca) || 0;
                    const fcrScore = parseFloat(agent.fcr_score || agent.fcr) || 0;
                    const isPass = caScore >= 85;

                    return (
                      <tr key={agent.id || idx} className="hover:bg-blue-50/40 transition duration-150">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0F2744] to-blue-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                              {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">
                                {agent.name}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <UserCheck className="w-2.5 h-2.5 text-emerald-700" />
                                  <span>TL: {agent.tl || agent.team_leader_name || 'TL Umum'}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                  <Sparkles className="w-2.5 h-2.5 text-cyan-700" />
                                  <span>Trainer: {agent.trainer || agent.trainer_name || 'TRN Umum'}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-700">
                          {agent.nik || agent.sip_id || '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {agent.channel || 'Omnichannel'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black inline-block shadow-2xs ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {formatPct(caScore)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-800">
                          {fcrScore > 0 ? (
                            <span className={fcrScore >= 85 ? 'text-indigo-950 font-black' : 'text-amber-700 font-bold'}>
                              {formatPct(fcrScore)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${
                            caScore >= 95 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            caScore >= 85 ? 'bg-blue-50 text-blue-800 border-blue-300' :
                            'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {caScore >= 95 ? 'Top Performer' : caScore >= 85 ? 'Meet Target' : 'Need Coaching'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/rekap-agent?search=${encodeURIComponent(agent.name)}`}
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-slate-100 hover:bg-[#0F2744] hover:text-white text-slate-700 border border-slate-200 transition-all inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                            title="Buka Scorecard Detail Agent"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Scorecard</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= TAB 2: MASTER NAKER TIM (PLOTTING) ================= */
        <div className="corp-card bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700" />
                Database Tenaga Kerja (Master NAKER) Tim Binaan ({nakerList.length} Personel)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Data pemetaan resmi penugasan kanal layanan, site, dan supervisor dari database Master NAKER.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Nama Tenaga Kerja</th>
                  <th className="py-3.5 px-4">ID SIP / Username</th>
                  <th className="py-3.5 px-4 text-center">Gender</th>
                  <th className="py-3.5 px-4">Layanan Penugasan</th>
                  <th className="py-3.5 px-4">Sub Layanan</th>
                  <th className="py-3.5 px-4">Team Leader (TL)</th>
                  <th className="py-3.5 px-4">Trainer Pengampu</th>
                  <th className="py-3.5 px-4 text-center">Site</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nakerList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200 shadow-xs">
                        <ShieldAlert className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Belum Ada Data NAKER yang Terpetakan untuk Tim Ini</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                        Pastikan Supervisor telah mengunggah file Master NAKER dengan plotting Team Leader & Trainer yang sesuai dengan nama akun Anda.
                      </p>
                    </td>
                  </tr>
                ) : (
                  nakerList.map((emp, idx) => (
                    <tr key={emp.id || idx} className="hover:bg-slate-50/80 transition duration-150">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs shadow-2xs">
                            {emp.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{emp.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-700">
                        {emp.sip_id || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          emp.gender === 'PRIA'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-pink-50 text-pink-700 border-pink-200'
                        }`}>
                          {emp.gender || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {emp.current_assignment?.service?.name || emp.current_assignment?.service?.code || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap min-w-[130px]">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-tight border whitespace-nowrap shadow-2xs ${getSubServiceBadgeStyle(emp.current_assignment?.sub_service || emp.sub_service)}`}>
                          {formatSubServiceDisplay(emp.current_assignment?.sub_service || emp.sub_service)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {emp.current_assignment?.team_leader?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {emp.current_assignment?.trainer?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 font-mono">
                        {emp.current_assignment?.site?.code || 'SMG'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {emp.status?.toUpperCase() || 'AKTIF'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnderTeamRekap;
