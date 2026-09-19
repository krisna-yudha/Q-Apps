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
  ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CustomSelect } from '../components/common/CustomSelect';

export const UnderTeamRekap = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || 'team_leader';
  const isTL = role === 'team_leader' || role === 'tl';
  const isTrainer = role === 'trainer';

  const roleTitle = isTL ? 'Team Leader' : isTrainer ? 'Trainer Pengampu' : 'Supervisor / Lead';
  const leaderName = user?.name || (isTL ? user?.team_leader_name : user?.trainer_name) || 'Lead Operasional';

  const now = new Date();
  const currentRunningPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'naker'
  const [selectedPeriod, setSelectedPeriod] = useState(currentRunningPeriod);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'pass' | 'need_coaching'

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [nakerList, setNakerList] = useState([]);
  const [nakerSummary, setNakerSummary] = useState(null);

  // Month options
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
        else recapParams.search = search ? `${search} ${user?.name}` : user?.name;
      } else if (isTrainer) {
        if (user?.trainer_id) recapParams.trainer_id = user.trainer_id;
        else recapParams.search = search ? `${search} ${user?.name}` : user?.name;
      }

      const recapRes = await api.getAgentRecap(recapParams);
      const rawAgents = recapRes?.data || [];

      // Filter by TL/Trainer name if not filtered strictly by ID in backend
      let filteredAgents = rawAgents;
      if (isTL && user?.name) {
        filteredAgents = rawAgents.filter(a => 
          !a.team_leader_name || 
          a.team_leader_name.toLowerCase().includes(user.name.toLowerCase()) || 
          user.name.toLowerCase().includes((a.team_leader_name || '').toLowerCase())
        );
      } else if (isTrainer && user?.name) {
        filteredAgents = rawAgents.filter(a => 
          !a.trainer_name || 
          a.trainer_name.toLowerCase().includes(user.name.toLowerCase()) || 
          user.name.toLowerCase().includes((a.trainer_name || '').toLowerCase())
        );
      }
      setAgents(filteredAgents.length > 0 ? filteredAgents : rawAgents);

      // 2. Fetch Master NAKER plotting
      const nakerParams = {
        per_page: 500,
        search: search || undefined,
        service: selectedChannel !== 'all' ? selectedChannel : undefined,
      };

      if (isTL) {
        if (user?.team_leader_id) nakerParams.team_leader_id = user.team_leader_id;
        else nakerParams.team_leader_name = user?.name;
      } else if (isTrainer) {
        if (user?.trainer_id) nakerParams.trainer_id = user.trainer_id;
        else nakerParams.trainer_name = user?.name;
      }

      const nakerRes = await api.getEmployees(nakerParams);
      const nakerItems = nakerRes?.data?.data || [];
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
  }, [selectedPeriod, selectedChannel, search, isTL, isTrainer, user?.team_leader_id, user?.trainer_id, user?.name]);

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
        avgCA: 0,
        avgFCR: 0,
        passCount: 0,
        needCoachingCount: 0,
        passRate: 0
      };
    }

    const totalCA = agents.reduce((sum, a) => sum + (parseFloat(a.ca_score || a.ca) || 0), 0);
    const avgCA = (totalCA / total).toFixed(1);

    const validFcrAgents = agents.filter(a => a.fcr_score !== undefined || a.fcr !== undefined);
    const totalFCR = validFcrAgents.reduce((sum, a) => sum + (parseFloat(a.fcr_score || a.fcr) || 0), 0);
    const avgFCR = validFcrAgents.length > 0 ? (totalFCR / validFcrAgents.length).toFixed(1) : 0;

    const passCount = agents.filter(a => (parseFloat(a.ca_score || a.ca) || 0) >= 85).length;
    const needCoachingCount = total - passCount;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(0) : 0;

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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="corp-card p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-[#0F2744] to-slate-900 text-white rounded-2xl shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-blue-500/15 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                Modul 6 &bull; Tim Binaan Hub
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                isTL ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
              }`}>
                {roleTitle}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Rekap & Pemantauan Tim: <span className="text-blue-300">{leaderName}</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Pemantauan performa mutu, nilai CA, tingkat penyelesaian FCR, dan data plotting Master NAKER khusus untuk seluruh anggota tim di bawah bimbingan Anda.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-44">
              <CustomSelect
                options={periods}
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                className="bg-white/10 text-white border-white/20 text-xs"
              />
            </div>

            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Tim (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Binaan */}
        <div className="corp-card p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Anggota Tim</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{performanceStats.totalAgents}</span>
            <span className="text-[11px] font-medium text-slate-500">CSO Binaan</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Terdaftar di Master NAKER</p>
        </div>

        {/* Avg CA */}
        <div className="corp-card p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-Rata CA</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              parseFloat(performanceStats.avgCA) >= 85 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${
              parseFloat(performanceStats.avgCA) >= 85 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {performanceStats.avgCA}%
            </span>
            <span className="text-[11px] font-bold text-slate-400">/ 85%</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Target Standar Mutu</p>
        </div>

        {/* Avg FCR */}
        <div className="corp-card p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tingkat FCR</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-900">{performanceStats.avgFCR}%</span>
            <span className="text-[11px] font-bold text-slate-400">/ 100%</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">First Contact Resolution</p>
        </div>

        {/* Memenuhi Standar */}
        <div className="corp-card p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Memenuhi Standar</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{performanceStats.passCount}</span>
            <span className="text-[11px] font-medium text-emerald-600">({performanceStats.passRate}%)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Skor Mutu &ge; 85%</p>
        </div>

        {/* Butuh Coaching */}
        <div className="corp-card p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-xs transition col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Butuh Coaching</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              performanceStats.needCoachingCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'
            }`}>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${
              performanceStats.needCoachingCount > 0 ? 'text-amber-700' : 'text-slate-800'
            }`}>
              {performanceStats.needCoachingCount}
            </span>
            <span className="text-[11px] font-medium text-slate-500">CSO</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Skor Mutu &lt; 85%</p>
        </div>
      </div>

      {/* 3. Navigation Tabs & Filters Bar */}
      <div className="corp-card p-3.5 sm:p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'performance'
                ? 'bg-white text-[#0F2744] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Matriks Performa & Nilai ({agents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('naker')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'naker'
                ? 'bg-white text-[#0F2744] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Plotting Master NAKER ({nakerList.length})</span>
          </button>
        </div>

        {/* Right Search & Filter Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIK..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">Semua Saluran</option>
            <option value="Inbound">Inbound Call</option>
            <option value="Digilive">Digilive (Live Chat)</option>
            <option value="Socmed">Social Media</option>
            <option value="Email">Email</option>
            <option value="Email Outbound">Email Outbound</option>
            <option value="Outbound Call">Outbound Call</option>
            <option value="Back Office">Back Office</option>
          </select>

          {/* Performance Filter (Only in Performance tab) */}
          {activeTab === 'performance' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500 transition"
            >
              <option value="all">Semua Status Mutu</option>
              <option value="pass">Memenuhi Standar (&ge;85%)</option>
              <option value="need_coaching">Perlu Bimbingan (&lt;85%)</option>
            </select>
          )}
        </div>
      </div>

      {/* 4. Tab Content Area */}
      {loading ? (
        <div className="corp-card p-12 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs font-bold text-slate-600">Memuat data tim binaan...</p>
        </div>
      ) : activeTab === 'performance' ? (
        /* ================= TAB 1: MATRIKS PERFORMA & SCORECARD ================= */
        <div className="corp-card bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Matriks Nilai & Performa Mutu Anggota Tim ({displayAgents.length} Personel)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Data matang hasil evaluasi QA untuk periode {selectedPeriod}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/rekap-agent"
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition flex items-center gap-1"
              >
                <span>Buka Modul 3 (Rekap Lengkap)</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
              <Link
                to="/anev"
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition flex items-center gap-1"
              >
                <span>Buka Modul 2 (Anev Ranking)</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Nama CSO / Agent</th>
                  <th className="py-3 px-4">ID SIP / NIK</th>
                  <th className="py-3 px-4">Kanal Layanan</th>
                  <th className="py-3 px-4 text-center">Nilai Mutu CA</th>
                  <th className="py-3 px-4 text-center">FCR (%)</th>
                  <th className="py-3 px-4 text-center">Predikat Mutu</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayAgents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Belum ada data nilai untuk anggota tim ini</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                        Pastikan data asesmen QSF telah diimpor untuk periode {selectedPeriod} atau periksa plotting Master NAKER di tab sebelah.
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayAgents.map((agent, idx) => {
                    const caScore = parseFloat(agent.ca_score || agent.ca) || 0;
                    const fcrScore = parseFloat(agent.fcr_score || agent.fcr) || 0;
                    const isPass = caScore >= 85;

                    return (
                      <tr key={agent.id || idx} className="hover:bg-blue-50/40 transition">
                        <td className="py-3 px-4 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-[#0F2744] flex items-center justify-center font-black text-xs shrink-0">
                              {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">
                                {agent.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                TL: {agent.team_leader_name || '-'} &bull; Trainer: {agent.trainer_name || '-'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {agent.nik || agent.sip_id || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {agent.channel || 'Omnichannel'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black inline-block ${
                            isPass 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {caScore.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {fcrScore > 0 ? `${fcrScore.toFixed(0)}%` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            caScore >= 95 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            caScore >= 85 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {caScore >= 95 ? 'Top Performer' : caScore >= 85 ? 'On Target' : 'Need Coaching'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/rekap-agent?search=${encodeURIComponent(agent.name)}`}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition inline-flex items-center gap-1 active:scale-95"
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
        <div className="corp-card bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Database Tenaga Kerja (Master NAKER) Tim Binaan ({nakerList.length} Personel)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Data pemetaan resmi penugasan kanal, site, dan supervisor dari Master NAKER.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Nama Tenaga Kerja</th>
                  <th className="py-3 px-4">ID SIP / Username</th>
                  <th className="py-3 px-4 text-center">Gender</th>
                  <th className="py-3 px-4">Layanan Penugasan</th>
                  <th className="py-3 px-4">Sub Layanan</th>
                  <th className="py-3 px-4">Team Leader (TL)</th>
                  <th className="py-3 px-4">Trainer Pengampu</th>
                  <th className="py-3 px-4 text-center">Site</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nakerList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2.5 border border-amber-200">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Belum ada data NAKER yang terpetakan untuk tim ini</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                        Pastikan Supervisor telah mengunggah file Master NAKER dengan plotting TL & Trainer yang sesuai dengan nama akun Anda.
                      </p>
                    </td>
                  </tr>
                ) : (
                  nakerList.map((emp, idx) => (
                    <tr key={emp.id || idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {emp.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{emp.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {emp.sip_id || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.gender === 'PRIA' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                        }`}>
                          {emp.gender || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {emp.current_assignment?.service?.name || emp.current_assignment?.service?.code || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 inline-block">
                          {emp.current_assignment?.sub_service || emp.sub_service || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {emp.current_assignment?.team_leader?.name || '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {emp.current_assignment?.trainer?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {emp.current_assignment?.site?.code || 'SMG'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
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
