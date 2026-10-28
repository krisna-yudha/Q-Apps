import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  PlusCircle,
  Search,
  Filter,
  Calendar,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  RefreshCw,
  Download,
  Trash2,
  Edit3,
  ShieldCheck,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Ban
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import * as XLSX from 'xlsx';

const SERVICES_LIST = [
  'Inbound',
  'Digilive',
  'Socmed',
  'Email',
  'Email Outbound',
  'OBC',
  'BO'
];

export const RealMonitoring = () => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';
  const isQA = user?.role === 'quality_assurance' || user?.role === 'qa';

  // Navigation tab state: For SPV default to 'history' (monitoring only), for QA default to 'form'
  const [activeTab, setActiveTab] = useState(isSupervisor ? 'history' : 'form');

  // Enforce SPV access: Supervisor does not input data, only monitors
  useEffect(() => {
    if (isSupervisor && activeTab === 'form') {
      setActiveTab('history');
    }
  }, [isSupervisor, activeTab]);

  // Active Agents for dropdown
  const [agentList, setAgentList] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    no_icrm: '',
    no_transaksi: '',
    no_omni: '',
    no_ichat: '',
    nama_agent: '',
    layanan: 'Inbound',
    notes: '',
    monitoring_date: new Date().toISOString().slice(0, 10),
    monitoring_time: new Date().toTimeString().slice(0, 8),
  });

  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState(null);

  // Monitoring records & KPI stats
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [stats, setStats] = useState({
    total_today: 0,
    total_yesterday: 0,
    total_month: 0,
    total_eliminated: 0,
    by_channel: {},
    by_qa: {},
    by_qa_today: {},
  });

  // Table filters
  const [filterDateScope, setFilterDateScope] = useState('today'); // 'today', 'yesterday', 'month', 'all'
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterQa, setFilterQa] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);

  // Load Active Agents & Scoped Records
  useEffect(() => {
    loadAgents();
    loadStats();
    loadRecords(1);
  }, [user?.id]);

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await api.getRealMonitoringAgents();
      if (res?.success && Array.isArray(res.agents)) {
        setAgentList(res.agents);
      }
    } catch (err) {
      console.warn('Gagal memuat data agen master:', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = {};
      if (user?.id) params.current_user_id = user.id;
      const res = await api.getRealMonitoringStats(params);
      if (res?.success && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.warn('Gagal memuat statistik:', err);
    }
  };

  const loadRecords = async (page = 1) => {
    setLoadingRecords(true);
    try {
      const params = {
        page,
        per_page: 20,
      };
      if (user?.id) params.current_user_id = user.id;

      if (filterDateScope === 'today') {
        params.date = new Date().toISOString().slice(0, 10);
      } else if (filterDateScope === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        params.date = y.toISOString().slice(0, 10);
      } else if (filterDateScope === 'month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const end = now.toISOString().slice(0, 10);
        params.date_from = start;
        params.date_to = end;
      }

      if (filterChannel !== 'ALL') params.layanan = filterChannel;
      if (filterQa !== 'ALL') params.qa_name = filterQa;
      if (filterSearch.trim()) params.search = filterSearch.trim();

      const res = await api.getRealMonitoring(params);
      if (res?.success) {
        setRecords(res.data || []);
        setCurrentPage(res.current_page || 1);
        setTotalPages(res.last_page || 1);
        setTotalRecordsCount(res.total || 0);
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat monitoring:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Re-fetch records on filter changes
  useEffect(() => {
    loadRecords(1);
  }, [filterDateScope, filterChannel, filterQa]);

  // Filtered agent candidates for dropdown autocomplete
  const filteredAgentCandidates = useMemo(() => {
    if (!agentSearchQuery.trim()) return agentList.slice(0, 20);
    const q = agentSearchQuery.toLowerCase();
    return agentList.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.nik && a.nik.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [agentList, agentSearchQuery]);

  // Handle Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormAlert(null);

    if (!formData.no_icrm.trim()) {
      setFormAlert({ type: 'error', message: 'Nomor Tiket iCRM wajib diisi.' });
      return;
    }
    if (!formData.nama_agent.trim()) {
      setFormAlert({ type: 'error', message: 'Nama Agent on-duty wajib dipilih atau diisi.' });
      return;
    }
    if (!formData.layanan.trim()) {
      setFormAlert({ type: 'error', message: 'Saluran layanan wajib dipilih.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        no_icrm: formData.no_icrm.trim(),
        no_transaksi: formData.no_transaksi.trim() || null,
        no_omni: formData.no_omni.trim() || null,
        no_ichat: formData.no_ichat.trim() || null,
        nama_agent: formData.nama_agent.trim(),
        notes: formData.notes.trim() || null,
        qa_name: user?.name || 'QA Evaluator',
      };

      const res = await api.storeRealMonitoring(payload);
      if (res?.success) {
        setFormAlert({
          type: 'success',
          message: res.is_update
            ? 'Data pemantauan berhasil diperbarui (tiket iCRM telah terdaftar).'
            : 'Pencatatan Real Monitoring berhasil disimpan. Tiket ini akan tereliminasi otomatis pada tarikan auto distribute berikutnya.'
        });

        // Reset inputs except date and service
        setFormData((prev) => ({
          ...prev,
          no_icrm: '',
          no_transaksi: '',
          no_omni: '',
          no_ichat: '',
          nama_agent: '',
          notes: '',
          monitoring_time: new Date().toTimeString().slice(0, 8),
        }));
        setAgentSearchQuery('');

        loadStats();
        loadRecords(1);
      } else {
        setFormAlert({ type: 'error', message: res?.message || 'Gagal menyimpan data pemantauan.' });
      }
    } catch (err) {
      setFormAlert({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Terjadi kesalahan sistem.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Record (Supervisor or Admin only)
  const handleDeleteRecord = async (id, noIcrm) => {
    if (!window.confirm(`Konfirmasi: Hapus data pemantauan untuk tiket ${noIcrm}?`)) return;

    try {
      const res = await api.deleteRealMonitoring(id);
      if (res?.success) {
        loadStats();
        loadRecords(currentPage);
      }
    } catch (err) {
      alert('Gagal menghapus data: ' + (err.response?.data?.message || err.message));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (records.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const exportRows = records.map((r, idx) => ({
      No: idx + 1,
      'Tanggal Pemantauan': r.monitoring_date,
      'Waktu Pemantauan': r.monitoring_time || '-',
      'No Tiket iCRM': r.no_icrm,
      'No Transaksi': r.no_transaksi || '-',
      'No Omni': r.no_omni || '-',
      'No iChat': r.no_ichat || '-',
      'Nama Agent': r.nama_agent,
      Layanan: r.layanan,
      'QA Pemantau': r.qa_name || '-',
      'Status Eliminasi': r.is_eliminated ? 'Tereliminasi di Auto Distribute' : 'Tercatat',
      'Catatan / Temuan QA': r.notes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Real_Monitoring');
    XLSX.writeFile(wb, `Real_Monitoring_DigiQA_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header (Matching DigiQA Standard Layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Real Monitoring & Observasi On-Duty
            </h1>
            {isSupervisor ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Mode: Supervisor (Monitoring Global Seluruh QA)
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0F2744] border border-blue-200">
                Mode: QA Evaluator (Riwayat Observasi Pribadi)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isSupervisor
              ? 'Memantau seluruh transaksi observasi langsung yang dicatat oleh semua QA Evaluator di site.'
              : 'Pencatatan langsung transaksi agent saat berdinas untuk acuan eliminasi tiket pada Auto Distribution hari berikutnya.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              loadStats();
              loadRecords(1);
            }}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Symmetrical 2-Panel Command Center (Matching AutoDistribution Top Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Panel 1: Status Observasi On-Duty (Role-Aware: SPV Monitoring vs QA Input) */}
        <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0F2744] shrink-0">
                {isSupervisor ? <Users className="w-4 h-4 text-[#0F2744]" /> : <Activity className="w-4 h-4 text-[#0F2744]" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                  {isSupervisor ? 'Monitoring Mutu Evaluator QA' : 'Manajemen Observasi On-Duty'}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {isSupervisor
                    ? 'Pemantauan & audit real-time transaksi yang diobservasi oleh seluruh tim QA'
                    : 'Pencatatan mutu langsung di meja kerja agen on-duty'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0F2744] border border-blue-200">
                {stats.total_today.toLocaleString('id-ID')} Hari Ini {isSupervisor ? '(Semua QA)' : ''}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline">
                Site SMG
              </span>
            </div>
          </div>

          {/* Sisa & Status Observasi Bar */}
          <div className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200 flex items-center justify-between gap-1.5 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              {isSupervisor ? (
                <>
                  <Users className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="text-[11px] text-slate-600 font-medium">Evaluator QA Aktif:</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="text-[11px] text-slate-600 font-medium">Observasi Berjalan:</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                {isSupervisor
                  ? `${Object.keys(stats.by_qa || {}).length} Evaluator Tercatat`
                  : `${stats.total_today.toLocaleString('id-ID')} Tiket Dicatat`}
              </span>
              <span className="text-[10px] text-slate-400">
                (Total Bulan Ini: {stats.total_month.toLocaleString('id-ID')})
              </span>
            </div>
          </div>

          {/* Panel 1 Bottom buttons (SPV: Monitoring Only, QA: Input & Riwayat) */}
          {isSupervisor ? (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  loadRecords(1);
                }}
                className={`px-2.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[#0F2744] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Semua Riwayat Tim</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('qa_summary')}
                className={`px-2.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                  activeTab === 'qa_summary'
                    ? 'bg-[#0F2744] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Rekap Evaluator QA</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-2.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-[#0F2744] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Input Observasi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  loadRecords(1);
                }}
                className={`px-2.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[#0F2744] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Riwayat Saya</span>
              </button>
            </div>
          )}
        </div>

        {/* Panel 2: Operasional Integrasi Eliminasi Auto-Distribute */}
        <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                  Operasional Eliminasi Mutu
                </h3>
                <p className="text-[11px] text-slate-500 truncate">Pencegahan sampling ganda pada Auto Distribution</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Auto-Check Aktif
              </span>
            </div>
          </div>

          {/* Eliminasi Status Indicator */}
          <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between gap-1.5 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span className="text-[11px] text-indigo-950 font-semibold">
                Acuan Kemarin: <strong>{stats.total_yesterday.toLocaleString('id-ID')} Tiket</strong>
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
              {stats.total_eliminated.toLocaleString('id-ID')} Tereliminasi
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                loadStats();
                loadRecords(1);
              }}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
              <span>Sinkron Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Status Real Monitoring Card (Matching STATUS POOL TIKET MENTAH in Screenshot 1) */}
      <div className="corp-card p-3.5 sm:p-4 bg-white border border-slate-200 shadow-xs rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
            STATUS OBSERVASI & ELIMINASI
          </span>
          <span className="text-xs text-slate-500">
            Tersedia untuk acuan eliminasi sampling harian di Auto Distribution
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isSupervisor ? 'Pemantauan Tim Hari Ini' : 'Observasi Saya Hari Ini'}
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.total_today.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">Tiket</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isSupervisor ? 'Acuan Eliminasi Tim Kemarin' : 'Observasi Saya Kemarin'}
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.total_yesterday.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">Tiket</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isSupervisor ? 'Total Tim Bulan Ini' : 'Observasi Saya Bulan Ini'}
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.total_month.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">Akumulasi</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Tiket Tereliminasi
            </span>
            <div className="text-xl font-bold text-emerald-950 mt-0.5">
              {stats.total_eliminated.toLocaleString('id-ID')} <span className="text-xs font-semibold text-emerald-700">Telah Dieliminasi</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation (Role-Aware: SPV gets Global History & QA Summary, QA gets Form & Personal History) */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {/* Only QA Evaluators see and use the Form tab (SPV does NOT input data) */}
        {!isSupervisor && (
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'form'
                ? 'border-[#0F2744] text-[#0F2744]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Formulir Observasi Agent On-Duty</span>
          </button>
        )}

        {/* Riwayat Pemantauan Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            loadRecords(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'history'
              ? 'border-[#0F2744] text-[#0F2744]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isSupervisor ? 'Data & Riwayat Pemantauan Seluruh Tim' : 'Data & Riwayat Pemantauan Saya'}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
            activeTab === 'history'
              ? 'bg-blue-50 text-[#0F2744] border border-blue-200'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {totalRecordsCount || stats.total_month || 0}
          </span>
        </button>

        {/* Exclusive Supervisor Tab: Rekap Kontribusi Evaluator QA */}
        {isSupervisor && (
          <button
            type="button"
            onClick={() => setActiveTab('qa_summary')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'qa_summary'
                ? 'border-[#0F2744] text-[#0F2744]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Rekap Evaluator QA</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              activeTab === 'qa_summary'
                ? 'bg-blue-50 text-[#0F2744] border border-blue-200'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {Object.keys(stats.by_qa || {}).length} QA
            </span>
          </button>
        )}
      </div>

      {/* TAB 1: FORMULIR INPUT PEMANTAUAN LANGSUNG (QA ONLY) */}
      {!isSupervisor && activeTab === 'form' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Form Card (2 Columns on Large Screens) */}
          <div className="lg:col-span-2 corp-card bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0F2744]">
                  <Activity className="w-4 h-4 text-[#0F2744]" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Pencatatan Observasi Agent On-Duty
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    QA mendatangi meja kerja agent on-duty dan mencatat detail transaksi yang sedang berlangsung.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Pencatat: {user?.name || 'QA Evaluator'}
              </span>
            </div>

            {/* Alert banner */}
            {formAlert && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                  formAlert.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {formAlert.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{formAlert.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* No Tiket iCRM (Wajib) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Nomor Tiket iCRM <span className="text-rose-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TCK-20261026-00123"
                    value={formData.no_icrm}
                    onChange={(e) => setFormData({ ...formData, no_icrm: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden font-mono text-xs transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Nomor referensi tiket global di sistem iCRM Retail.</p>
                </div>

                {/* No Transaksi (Acuan Kunci Eliminasi) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Nomor Transaksi <span className="text-blue-700 font-bold">(Kunci Eliminasi Auto Distribute)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: TXN-89421890 / ID Transaksi"
                    value={formData.no_transaksi}
                    onChange={(e) => setFormData({ ...formData, no_transaksi: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden font-mono text-xs transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Nomor transaksi yang dicek agar tidak masuk antrean sampling esok hari.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* No Tiket Omni */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Nomor Tiket / Sesi Omni <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: OMNI-44218"
                    value={formData.no_omni}
                    onChange={(e) => setFormData({ ...formData, no_omni: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden font-mono text-xs transition"
                  />
                </div>

                {/* No Tiket iChat */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Nomor Sesi iChat (Live Chat) <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: ICHAT-99120"
                    value={formData.no_ichat}
                    onChange={(e) => setFormData({ ...formData, no_ichat: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden font-mono text-xs transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Agent On-Duty (Wajib) with Autocomplete */}
                <div className="relative">
                  <label className="block text-slate-700 font-bold mb-1">
                    Nama Agent On-Duty <span className="text-rose-500 font-black">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ketik atau pilih nama agent..."
                      value={formData.nama_agent || agentSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAgentSearchQuery(val);
                        setFormData({ ...formData, nama_agent: val });
                        setShowAgentDropdown(true);
                      }}
                      onFocus={() => setShowAgentDropdown(true)}
                      className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden text-xs transition pr-8"
                    />
                    {formData.nama_agent && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, nama_agent: '' });
                          setAgentSearchQuery('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Pilih dari Master Tenaga Kerja / Agent aktif site SMG.</p>

                  {/* Autocomplete Dropdown */}
                  {showAgentDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAgentDropdown(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {loadingAgents ? (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            Memuat daftar agen...
                          </div>
                        ) : filteredAgentCandidates.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            Tidak ditemukan nama agen "{agentSearchQuery}".
                          </div>
                        ) : (
                          filteredAgentCandidates.map((agent) => (
                            <button
                              key={agent.id || agent.name}
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  nama_agent: agent.name,
                                  layanan: agent.layanan || formData.layanan,
                                });
                                setAgentSearchQuery(agent.name);
                                setShowAgentDropdown(false);
                              }}
                              className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer transition"
                            >
                              <div>
                                <span className="font-bold text-slate-800">{agent.name}</span>
                                {agent.nik && (
                                  <span className="text-[10px] text-slate-400 font-mono ml-2">
                                    ({agent.nik})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                {agent.layanan || 'Agent'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Saluran Layanan (Wajib) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Saluran Layanan <span className="text-rose-500 font-black">*</span>
                  </label>
                  <select
                    value={formData.layanan}
                    onChange={(e) => setFormData({ ...formData, layanan: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden text-xs font-semibold cursor-pointer transition"
                  >
                    {SERVICES_LIST.map((srv) => (
                      <option key={srv} value={srv}>
                        {srv}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">Pilih saluran transaksi yang diobservasi.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal Pemantauan */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tanggal Pemantauan</label>
                  <input
                    type="date"
                    required
                    value={formData.monitoring_date}
                    onChange={(e) => setFormData({ ...formData, monitoring_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden text-xs transition"
                  />
                </div>

                {/* Waktu Pemantauan */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Waktu Pemantauan</label>
                  <input
                    type="time"
                    step="1"
                    value={formData.monitoring_time}
                    onChange={(e) => setFormData({ ...formData, monitoring_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden text-xs transition"
                  />
                </div>
              </div>

              {/* Catatan / Temuan QA */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Catatan Observasi / Temuan Langsung QA <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="Tuliskan temuan mutu, parameter yang diobservasi, respon agent, atau kendala transaksi saat visit langsung..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:outline-hidden text-xs transition"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      no_icrm: '',
                      no_transaksi: '',
                      no_omni: '',
                      no_ichat: '',
                      nama_agent: '',
                      layanan: 'Inbound',
                      notes: '',
                      monitoring_date: new Date().toISOString().slice(0, 10),
                      monitoring_time: new Date().toTimeString().slice(0, 8),
                    });
                    setAgentSearchQuery('');
                    setFormAlert(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold cursor-pointer transition text-xs"
                >
                  Reset Formulir
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#0F2744] hover:bg-[#1A365D] text-white rounded-xl font-bold cursor-pointer transition shadow-xs flex items-center gap-2 disabled:opacity-50 text-xs"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Simpan Pemantauan Real
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: SOP Rule Card & Quick Summary */}
          <div className="space-y-4">
            <div className="corp-card p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-[#0F2744]" />
                <span className="uppercase tracking-wider text-xs">Mekanisme Eliminasi Otomatis</span>
              </div>
              <ul className="space-y-2.5 text-slate-600 leading-relaxed text-[11px]">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <span>
                    QA Evaluator mendatangi meja kerja agent on-duty secara langsung di site untuk mengamati transaksi.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <span>
                    Ketika tarikan tiket global iCRM disetor besok, mesin <strong>Auto Distribute</strong> otomatis memeriksa daftar transaksi Real Monitoring.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <span>
                    Tiket yang nomor transaksinya cocok dengan data pemantauan kemarin akan <strong>langsung dieliminasi</strong> dari sampling pool harian.
                  </span>
                </li>
              </ul>
            </div>

            {/* Quick Summary of Recent Input Today */}
            <div className="corp-card bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Observasi Terakhir Hari Ini
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Real-time</span>
              </div>
              {records.slice(0, 5).length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Belum ada transaksi yang dicatat hari ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {records.slice(0, 5).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold font-mono text-slate-900 text-[11px]">
                          {rec.no_icrm}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                          {rec.layanan}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Agent: <strong className="text-slate-800">{rec.nama_agent}</strong></span>
                        <span>{rec.monitoring_time || rec.monitoring_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATA & RIWAYAT PEMANTAUAN (AUDIT & MONITORING SPV) */}
      {activeTab === 'history' && (
        <div className="corp-card bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
          {/* Toolbar & Filters (Matching AutoDistribution Filter Bar) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              {[
                { key: 'today', label: 'Hari Ini' },
                { key: 'yesterday', label: 'Kemarin (Acuan Eliminasi)' },
                { key: 'month', label: 'Bulan Ini' },
                { key: 'all', label: 'Semua Riwayat' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterDateScope(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filterDateScope === f.key
                      ? 'bg-[#0F2744] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Service filter select */}
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">Semua Layanan</option>
                {SERVICES_LIST.map((srv) => (
                  <option key={srv} value={srv}>
                    {srv}
                  </option>
                ))}
              </select>

              {/* QA Evaluator Filter - Only for Supervisor */}
              {isSupervisor && (
                <select
                  value={filterQa}
                  onChange={(e) => setFilterQa(e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
                >
                  <option value="ALL">Semua Evaluator QA</option>
                  {Object.keys(stats.by_qa || {}).map((qaName) => (
                    <option key={qaName} value={qaName}>
                      {qaName}
                    </option>
                  ))}
                </select>
              )}

              {isQA && (
                <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-[#0F2744] border border-blue-200 text-xs font-bold">
                  Inputan Saya: {user?.name || 'QA'}
                </span>
              )}
            </div>

            {/* Search and Export */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari No iCRM, Transaksi, Agent..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadRecords(1)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-400 focus:outline-hidden w-full sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={() => loadRecords(1)}
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition"
                title="Refresh Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl bg-[#0F2744] hover:bg-[#1A365D] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 text-center w-12">No</th>
                  <th className="py-2.5 px-3.5">Tanggal & Waktu</th>
                  <th className="py-2.5 px-3.5">No Tiket iCRM</th>
                  <th className="py-2.5 px-3.5">No Transaksi (Eliminasi)</th>
                  <th className="py-2.5 px-3.5">Omni / iChat</th>
                  <th className="py-2.5 px-3.5">Nama Agent</th>
                  <th className="py-2.5 px-3.5">Layanan</th>
                  <th className="py-2.5 px-3.5">QA Pemantau</th>
                  <th className="py-2.5 px-3.5">Status Eliminasi</th>
                  <th className="py-2.5 px-3.5 min-w-[200px]">Catatan / Temuan</th>
                  {isSupervisor && <th className="py-2.5 px-3.5 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingRecords ? (
                  <tr>
                    <td colSpan={isSupervisor ? 11 : 10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                      Memuat data pemantauan real-time...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={isSupervisor ? 11 : 10} className="py-12 text-center text-slate-400">
                      Tidak ditemukan rekaman pemantauan sesuai filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * 20 + idx + 1}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{r.monitoring_date}</div>
                        <div className="text-[10px] text-slate-400">{r.monitoring_time || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.no_icrm}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                        {r.no_transaksi ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {r.no_transaksi}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div>Omni: {r.no_omni || '-'}</div>
                        <div>iChat: {r.no_ichat || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                        {r.nama_agent}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium text-[11px]">
                          {r.layanan}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap font-medium">
                        {r.qa_name || 'QA Evaluator'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {r.is_eliminated ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Tereliminasi
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium text-[10px] flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Tercatat
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 text-[11px] max-w-xs truncate">
                        {r.notes || '-'}
                      </td>
                      {isSupervisor && (
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(r.id, r.no_icrm)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                            title="Hapus Pemantauan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
              <span>
                Menampilkan halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({totalRecordsCount} data)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => loadRecords(currentPage - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-bold"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => loadRecords(currentPage + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-bold"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REKAP KONTRIBUSI EVALUATOR QA (KHUSUS SUPERVISOR) */}
      {isSupervisor && activeTab === 'qa_summary' && (
        <div className="corp-card bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0F2744]" />
                Rekapitulasi Observasi On-Duty Per Evaluator QA
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Monitoring kontribusi observasi transaksi langsung di meja kerja agen oleh seluruh anggota tim QA Evaluator.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                Total Bulan Ini: {stats.total_month.toLocaleString('id-ID')} Tiket
              </span>
            </div>
          </div>

          {Object.keys(stats.by_qa || {}).length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada transaksi real monitoring yang dicatat oleh tim QA pada bulan ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Object.entries(stats.by_qa || {})
                .sort((a, b) => b[1] - a[1])
                .map(([qaName, monthCount]) => {
                  const todayCount = stats.by_qa_today?.[qaName] || 0;
                  const pct = stats.total_month > 0 ? Math.round((monthCount / stats.total_month) * 100) : 0;
                  return (
                    <div
                      key={qaName}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#0F2744] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {qaName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-slate-900 truncate" title={qaName}>
                              {qaName}
                            </h4>
                            <span className="text-[10px] text-slate-400 block">QA Evaluator</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#0F2744] border border-blue-200 shrink-0">
                          {pct}% Tim
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Hari Ini:</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {todayCount} Tiket
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Bulan Ini:</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {monthCount} Tiket
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#0F2744] h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Filter by QA button */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterQa(qaName);
                          setActiveTab('history');
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <Search className="w-3 h-3 text-slate-500" />
                        <span>Filter Riwayat QA Ini</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RealMonitoring;
