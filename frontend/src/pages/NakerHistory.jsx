import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Users,
    UserCheck,
    Award,
    Zap,
    Download,
    Search,
    RefreshCw,
    X,
    Filter,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    FileSpreadsheet,
    ArrowRight,
    Archive,
    Clock,
    ShieldCheck,
    Building2,
    CheckCircle2,
    SlidersHorizontal,
    Info,
    History as HistoryIcon,
    Layers
} from 'lucide-react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { useSync } from '../context/SyncContext';
import { CustomSelect } from '../components/common/CustomSelect';
import { generateQsfTemplate } from '../utils/qsfTemplateGenerator';

// Helper format nama bulan
const formatPeriodLabel = (periodStr) => {
    if (!periodStr) return '-';
    const [year, month] = periodStr.split('-');
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
        return `${months[mIdx]} ${year}`;
    }
    return periodStr;
};

// Helper badge sublayanan korporat
const getSubServiceBadgeStyle = (sub) => {
    if (!sub || sub === '-' || sub === '') return 'bg-slate-100 text-slate-500 border-slate-200';
    const s = String(sub).toUpperCase();
    if (s.includes('SUPERVISOR') || s.includes('SPV')) return 'bg-indigo-100 text-indigo-900 border-indigo-300 font-black';
    if (s.includes('MY ICON') || s.includes('ICON+')) return 'bg-teal-50 text-teal-800 border-teal-200';
    if (s.includes('INSTAGRAM') || s.includes('DM') || s.includes('SOCMED')) return 'bg-purple-50 text-purple-800 border-purple-200';
    if (s.includes('INBOUND') || s.includes('CALL')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (s.includes('EMAIL') || s.includes('OUTBOUND')) return 'bg-amber-50 text-amber-900 border-amber-200';
    if (s.includes('BACK OFFICE') || s.includes('BO')) return 'bg-rose-50 text-rose-800 border-rose-200';
    if (s.includes('TEAM LEADER')) return 'bg-amber-100 text-amber-900 border-amber-300 font-black';
    if (s.includes('TRAINER')) return 'bg-sky-100 text-sky-900 border-sky-300 font-black';
    return 'bg-indigo-50 text-indigo-800 border-indigo-200';
};

export const NakerHistory = () => {
    const { showAlert, showToast } = useDialog();
    const { triggerDataUpdate } = useSync();

    // Available Periods & Active Selected Period
    const [availablePeriods, setAvailablePeriods] = useState(['2026-09', '2026-08']);
    const [selectedPeriod, setSelectedPeriod] = useState('2026-08');

    // Data States
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const exportDropdownRef = useRef(null);

    // Close export dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
                setShowExportDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [nakerList, setNakerList] = useState([]);
    const [nakerSummary, setNakerSummary] = useState({
        total_naker: 0,
        pria: 0,
        wanita: 0,
        qa_count: 0,
        tl_count: 0,
        trainer_count: 0,
        cso_count: 0,
        service_distribution: [],
        sub_services: [],
        team_leaders: [],
        trainers: []
    });

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterService, setFilterService] = useState('all');
    const [filterSubService, setFilterSubService] = useState('all');
    const [filterTL, setFilterTL] = useState('all');
    const [filterGender, setFilterGender] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Fetch Historical NAKER Data
    const fetchHistoricalNaker = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                period_month: selectedPeriod,
                per_page: perPage === 'all' ? 1000 : perPage,
                page: currentPage,
            };

            if (searchQuery) params.search = searchQuery;
            if (filterService !== 'all') params.service_id = filterService;
            if (filterSubService !== 'all') params.sub_service = filterSubService;
            if (filterTL !== 'all') params.team_leader_id = filterTL;
            if (filterGender !== 'all') params.gender = filterGender;

            const res = await api.getEmployees(params);

            if (res && res.success) {
                // Update Available Periods if returned
                if (res.available_periods && res.available_periods.length > 0) {
                    setAvailablePeriods(res.available_periods);
                }

                if (res.summary) {
                    setNakerSummary(res.summary);
                }

                const rawData = res.data?.data || (Array.isArray(res.data) ? res.data : []);
                setNakerList(rawData);
                setTotalItems(res.data?.total || rawData.length);
                setTotalPages(res.data?.last_page || (perPage === 'all' ? 1 : Math.ceil((res.data?.total || rawData.length) / perPage)));
            } else {
                setNakerList([]);
                setTotalItems(0);
            }
        } catch (err) {
            console.error('Failed to fetch historical naker:', err);
            showToast('Gagal memuat riwayat master NAKER: ' + (err.message || ''), 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, searchQuery, filterService, filterSubService, filterTL, filterGender, currentPage, perPage, showToast]);

    useEffect(() => {
        fetchHistoricalNaker();
    }, [fetchHistoricalNaker]);

    // Handle Reset Filter
    const handleResetFilter = () => {
        setSearchQuery('');
        setFilterService('all');
        setFilterSubService('all');
        setFilterTL('all');
        setFilterGender('all');
        setCurrentPage(1);
    };

    // Download Official NAKER Template
    const handleDownloadTemplate = () => {
        try {
            generateQsfTemplate('NAKER');
            showToast('Template resmi Master NAKER berhasil diunduh.', 'success');
        } catch (err) {
            showAlert({
                title: 'Gagal Unduh Template',
                message: err.message || 'Terjadi kendala saat mengunduh template.',
                type: 'error'
            });
        }
    };

    // Export Historical NAKER to Excel (.xlsx)
    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const res = await api.exportNaker({
                period_month: selectedPeriod,
                search: searchQuery || undefined,
                service: filterService !== 'all' ? filterService : undefined,
                sub_service: filterSubService !== 'all' ? filterSubService : undefined,
                gender: filterGender !== 'all' ? filterGender : undefined,
            });

            if (!res || !res.rows || res.rows.length === 0) {
                showAlert({
                    title: 'Tidak Ada Data',
                    message: `Tidak ditemukan data NAKER pada periode ${formatPeriodLabel(selectedPeriod)} untuk diekspor.`,
                    type: 'info'
                });
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(res.rows);

            // Set column widths
            ws['!cols'] = [
                { wch: 6 },  // NO
                { wch: 30 }, // NAMA
                { wch: 6 },  // JK
                { wch: 18 }, // LAYANAN
                { wch: 22 }, // SUB LAYANAN
                { wch: 28 }, // TEAM TL
                { wch: 28 }, // TRAINER
                { wch: 10 }, // SITE
                { wch: 20 }, // ID SIP
            ];

            const sheetName = `NAKER_${selectedPeriod.replace('-', '_')}`;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            const filename = `RIWAYAT_MASTER_NAKER_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, filename);

            showToast(`Berhasil mengekspor ${res.rows.length} data NAKER periode ${formatPeriodLabel(selectedPeriod)}.`, 'success');
        } catch (err) {
            console.error('Export error:', err);
            showAlert({
                title: 'Gagal Ekspor Excel',
                message: 'Terjadi kendala saat membuat file Excel: ' + err.message,
                type: 'error'
            });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-5 pb-16 animate-in fade-in duration-300">
            {/* TOP CORPORATE HEADER */}
            <div className="corp-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-l-4 border-l-[#0F2744]">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#0F2744] text-white flex items-center gap-1 shadow-2xs">
                            <Archive className="w-3 h-3 text-cyan-300" />
                            Arsip Plotting Historis
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Snapshot Multi-Bulan (Aman & Tidak Tertimpa)
                        </span>
                    </div>

                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
                        <span>Riwayat Master NAKER & Arsip Penugasan</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Menampilkan snapshot struktur penugasan, Team Leader (TL), Trainer, dan Saluran pada bulan-bulan lampau untuk audit dan analisis tren.
                    </p>
                </div>

                {/* PERIOD PICKER & QUICK LINK */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Period Selector Ribbon */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700">
                            <Calendar className="w-4 h-4 text-[#0F2744]" />
                            <span className="hidden sm:inline">Pilih Periode:</span>
                        </div>
                        <CustomSelect
                            value={selectedPeriod}
                            onChange={(val) => {
                                setSelectedPeriod(val);
                                setCurrentPage(1);
                            }}
                            options={availablePeriods.map(p => ({
                                value: p,
                                label: `${formatPeriodLabel(p)} (${p})`
                            }))}
                            className="w-44 sm:w-52"
                            buttonClassName="bg-white border-slate-300 py-1.5 text-xs font-black text-[#0F2744] shadow-xs"
                        />
                    </div>

                    {/* Quick Link to Current Month Data Master */}
                    <Link
                        to="/settings?tab=naker"
                        className="px-3.5 py-2 rounded-xl bg-[#0F2744] hover:bg-[#1a3a60] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                        title="Buka Database Master NAKER Bulan Berjalan"
                    >
                        <UserCheck className="w-3.5 h-3.5 text-cyan-300" />
                        <span>Database NAKER Aktif</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    </Link>
                </div>
            </div>

            {/* 8 SUMMARY METRIC CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
                {/* 1. TOTAL NAKER */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-blue-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">TOTAL NAKER</span>
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-slate-900 tracking-tight font-mono">
                            {nakerSummary.total_naker}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold truncate">Personel</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        Terdaftar di {formatPeriodLabel(selectedPeriod)}
                    </span>
                </div>

                {/* 2. AKUN SUPERVISOR */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-indigo-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">AKUN SPV</span>
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                            <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-indigo-900 tracking-tight font-mono">
                            {nakerSummary.supervisor_count || 0}
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold truncate">Supervisor</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        Supervisor & Mgmt
                    </span>
                </div>

                {/* 3. AKUN QA EVALUATOR */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-purple-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">AKUN QA</span>
                        <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                            <Award className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-purple-900 tracking-tight font-mono">
                            {nakerSummary.qa_count}
                        </span>
                        <span className="text-[10px] text-purple-700 font-bold truncate">QA Evaluator</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        Middle Management QA
                    </span>
                </div>

                {/* 4. AKUN TL (TEAM LEADER) */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-amber-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">AKUN TL</span>
                        <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                            <UserCheck className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-amber-900 tracking-tight font-mono">
                            {nakerSummary.tl_count}
                        </span>
                        <span className="text-[10px] text-amber-700 font-bold truncate">Team Leader</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        Pengampu Agen Lapangan
                    </span>
                </div>

                {/* 5. AKUN TRAINER (COACHING) */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-sky-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">AKUN TRAINER</span>
                        <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-sky-900 tracking-tight font-mono">
                            {nakerSummary.trainer_count}
                        </span>
                        <span className="text-[10px] text-sky-700 font-bold truncate">Trainer</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        Trainer & Coaching
                    </span>
                </div>

                {/* 6. CSO AGENT OPERASIONAL */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-emerald-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">CSO AGENT OP</span>
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-emerald-900 tracking-tight font-mono">
                            {nakerSummary.cso_count}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold truncate">Agent Pelayanan</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        Pelaksana 7 Layanan QSF
                    </span>
                </div>

                {/* 7. TENAGA KERJA (LAKI-LAKI) */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-indigo-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">TENAGA KERJA</span>
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-indigo-900 tracking-tight font-mono">
                            {nakerSummary.pria}
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold truncate">Laki - Laki (L)</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        {nakerSummary.total_naker > 0 ? Math.round((nakerSummary.pria / nakerSummary.total_naker) * 100) : 0}% dari Total Naker
                    </span>
                </div>

                {/* 8. TENAGA KERJA (PEREMPUAN) */}
                <div className="corp-card p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-rose-400 transition shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">TENAGA KERJA</span>
                        <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-rose-900 tracking-tight font-mono">
                            {nakerSummary.wanita}
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold truncate">Perempuan (P)</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-medium truncate">
                        {nakerSummary.total_naker > 0 ? Math.round((nakerSummary.wanita / nakerSummary.total_naker) * 100) : 0}% dari Total Naker
                    </span>
                </div>
            </div>

            {/* MAIN DATA TABLE & FILTER CARD */}
            <div className="corp-card overflow-hidden">
                {/* FILTER RIBBON (Exact match to screenshot) */}
                <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                    {/* Baris 1: Filter Dropdowns & Search */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Cari nama, ID SIP, TL, atau Trainer..."
                                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Layanan Penugasan */}
                            <CustomSelect
                                value={filterService}
                                onChange={(e) => {
                                    setFilterService(e);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { value: 'all', label: 'Semua Layanan Penugasan' },
                                    ...(nakerSummary.service_distribution && nakerSummary.service_distribution.length > 0
                                        ? nakerSummary.service_distribution.map(s => ({
                                            value: String(s.id),
                                            label: `${s.name} (${s.total_agents || 0})`
                                        }))
                                        : []
                                    )
                                ]}
                                className="w-full sm:w-48"
                                buttonClassName="bg-white border-slate-300 py-2 text-xs text-slate-800 font-semibold shadow-2xs"
                            />

                            {/* Sub Layanan */}
                            <CustomSelect
                                value={filterSubService}
                                onChange={(e) => {
                                    setFilterSubService(e);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { value: 'all', label: 'Semua Sub Layanan' },
                                    ...(nakerSummary.sub_services && nakerSummary.sub_services.length > 0
                                        ? nakerSummary.sub_services.map(sub => ({
                                            value: sub,
                                            label: sub
                                        }))
                                        : [
                                            { value: 'MY ICON+', label: 'MY ICON+' },
                                            { value: 'DM INSTAGRAM', label: 'DM INSTAGRAM' },
                                            { value: 'INBOUND CALL', label: 'INBOUND CALL' },
                                            { value: 'TEAM LEADER', label: 'TEAM LEADER' },
                                            { value: 'TRAINER', label: 'TRAINER' }
                                        ]
                                    )
                                ]}
                                className="w-full sm:w-44"
                                buttonClassName="bg-white border-slate-300 py-2 text-xs text-slate-800 font-semibold shadow-2xs"
                            />

                            {/* Team Leader (TL) */}
                            <CustomSelect
                                value={filterTL}
                                onChange={(e) => {
                                    setFilterTL(e);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { value: 'all', label: 'Semua Team Leader (TL)' },
                                    ...(nakerSummary.team_leaders && nakerSummary.team_leaders.length > 0
                                        ? nakerSummary.team_leaders.map(tl => ({
                                            value: String(tl.id),
                                            label: `${tl.name} (${tl.member_count} Anggota)`
                                        }))
                                        : []
                                    )
                                ]}
                                className="w-full sm:w-52"
                                buttonClassName="bg-white border-slate-300 py-2 text-xs text-slate-800 font-semibold shadow-2xs"
                            />

                            {/* Gender */}
                            <CustomSelect
                                value={filterGender}
                                onChange={(e) => {
                                    setFilterGender(e);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { value: 'all', label: 'Semua Gender' },
                                    { value: 'PRIA', label: 'Pria (L)' },
                                    { value: 'WANITA', label: 'Wanita (P)' }
                                ]}
                                className="w-full sm:w-36"
                                buttonClassName="bg-white border-slate-300 py-2 text-xs text-slate-800 shadow-2xs"
                            />

                            {/* Reset Filter Button */}
                            {(searchQuery || filterService !== 'all' || filterSubService !== 'all' || filterTL !== 'all' || filterGender !== 'all') && (
                                <button
                                    type="button"
                                    onClick={handleResetFilter}
                                    className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition px-3 py-2 rounded-xl hover:bg-red-50 border border-red-200 bg-white shadow-2xs"
                                >
                                    <X className="w-3.5 h-3.5" /> Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Baris 2: Action Toolbar (Unduh Template, Ekspor Excel, Injeksi, Refresh) */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70">
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                            <span>Total Data:</span>
                            <span className="font-bold text-[#0F2744] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                {totalItems} Personel ({formatPeriodLabel(selectedPeriod)})
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Dropdown Menu: Unduh Template & Ekspor Excel NAKER */}
                            <div className="relative inline-block text-left" ref={exportDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                    title="Opsi Berkas & Ekspor Data NAKER"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span>Unduh & Ekspor Excel</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showExportDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showExportDropdown && (
                                    <div className="absolute left-0 sm:right-0 sm:left-auto mt-1 w-64 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 divide-y divide-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowExportDropdown(false);
                                                handleDownloadTemplate();
                                            }}
                                            className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 text-slate-800 hover:text-blue-900 text-xs flex items-center gap-2.5 transition cursor-pointer"
                                        >
                                            <Download className="w-4 h-4 text-blue-600 shrink-0" />
                                            <div>
                                                <span className="font-bold block text-slate-900">Unduh Template NAKER (.xlsx)</span>
                                                <span className="text-[10px] text-slate-500 font-normal">Format acuan resmi untuk impor</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowExportDropdown(false);
                                                handleExportExcel();
                                            }}
                                            disabled={exporting || loading || nakerList.length === 0}
                                            className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 text-xs flex items-center gap-2.5 transition cursor-pointer disabled:opacity-50"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <div>
                                                <span className="font-bold block text-slate-900">Ekspor Snapshot NAKER (.xlsx)</span>
                                                <span className="text-[10px] text-slate-500 font-normal">Unduh data plotting periode ini</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>



                            <button
                                type="button"
                                onClick={fetchHistoricalNaker}
                                disabled={loading}
                                className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-2xs disabled:opacity-50"
                                title="Muat ulang data"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* TABLE OF NAKER (Exact Match to Screenshot Columns) */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black tracking-wider text-[10px] uppercase">
                                <th className="py-3 px-3 w-10 text-center">#</th>
                                <th className="py-3 px-3">NAMA TENAGA KERJA</th>
                                <th className="py-3 px-3">ID SIP / USERNAME</th>
                                <th className="py-3 px-3 text-center">JENIS KELAMIN</th>
                                <th className="py-3 px-3">LAYANAN PENUGASAN</th>
                                <th className="py-3 px-3 whitespace-nowrap min-w-[130px]">SUB LAYANAN</th>
                                <th className="py-3 px-3">TEAM LEADER (TL)</th>
                                <th className="py-3 px-3">TRAINER PENGAMPU</th>
                                <th className="py-3 px-3 text-center">SITE</th>
                                <th className="py-3 px-3 text-center">STATUS & AKUN</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                                        <p className="font-bold text-xs">Memuat data riwayat master NAKER periode {formatPeriodLabel(selectedPeriod)}...</p>
                                    </td>
                                </tr>
                            ) : nakerList.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400">
                                        <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="font-bold text-sm text-slate-600">Tidak ada data tenaga kerja pada periode ini</p>
                                        <p className="text-xs text-slate-400 mt-1">Silakan ubah periode bulan atau sesuaikan kata kunci pencarian.</p>
                                    </td>
                                </tr>
                            ) : (
                                nakerList.map((emp, index) => {
                                    const assignment = emp.current_assignment || emp.currentAssignment || {};
                                    const svcName = assignment.service?.name || emp.service?.name || '-';
                                    const svcCode = assignment.service?.code || '';
                                    const subService = assignment.sub_service || emp.sub_service || '-';
                                    const tlName = assignment.team_leader?.name || assignment.teamLeader?.name || (svcCode === 'TEAM_LEADER' ? 'Team Leader Operasional' : '-');
                                    const trnName = assignment.trainer?.name || (svcCode === 'TRAINER' ? 'Trainer Operasional' : '-');
                                    const siteCode = assignment.site?.code || emp.site?.code || 'SMG';

                                    const isSupervisor = svcCode === 'SUPERVISOR' || (emp.sip_id && String(emp.sip_id).startsWith('SPV-')) || svcName.toLowerCase().includes('supervisor');
                                    const isQa = svcCode === 'QUALITY_ASSURANCE' || (emp.sip_id && String(emp.sip_id).startsWith('QA-'));
                                    const isTl = svcCode === 'TEAM_LEADER' || (emp.sip_id && String(emp.sip_id).startsWith('TL-'));
                                    const isTrainer = svcCode === 'TRAINER' || (emp.sip_id && String(emp.sip_id).startsWith('TRN-'));

                                    const rowNum = (currentPage - 1) * (perPage === 'all' ? totalItems : perPage) + index + 1;

                                    return (
                                        <tr key={emp.id} className={`hover:bg-blue-50/40 transition group ${isSupervisor ? 'bg-indigo-50/20' : isQa ? 'bg-purple-50/20' : isTl ? 'bg-amber-50/20' : isTrainer ? 'bg-cyan-50/20' : ''}`}>
                                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                {rowNum}
                                            </td>

                                            {/* Nama */}
                                            <td className="py-3 px-3 font-bold text-slate-900">
                                                <div className="truncate max-w-[220px] font-black uppercase text-[11px] text-slate-900">
                                                    {emp.name}
                                                </div>
                                            </td>

                                            {/* ID SIP */}
                                            <td className="py-3 px-3 font-mono text-[11px] text-purple-700 font-bold">
                                                {emp.sip_id || '-'}
                                            </td>

                                            {/* Jenis Kelamin */}
                                            <td className="py-3 px-3 text-center">
                                                {emp.gender === 'PRIA' ? (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                                                        PRIA
                                                    </span>
                                                ) : emp.gender === 'WANITA' ? (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-pink-50 text-pink-800 border border-pink-200">
                                                        WANITA
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>

                                            {/* Layanan */}
                                            <td className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">
                                                {isSupervisor ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 whitespace-nowrap shadow-2xs">
                                                        Supervisor
                                                    </span>
                                                ) : isQa ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap shadow-2xs">
                                                        Quality Assurance
                                                    </span>
                                                ) : isTl ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
                                                        Team Leader
                                                    </span>
                                                ) : isTrainer ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 whitespace-nowrap shadow-2xs">
                                                        Trainer Pengampu
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap shadow-2xs">
                                                        {svcName}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Sub Layanan */}
                                            <td className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-tight border whitespace-nowrap shadow-2xs ${getSubServiceBadgeStyle(subService)}`}>
                                                    {subService}
                                                </span>
                                            </td>

                                            {/* Team Leader */}
                                            <td className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">
                                                <span className={`text-[11px] ${isSupervisor ? 'text-indigo-800 font-bold italic' : isTl ? 'text-amber-800 font-bold italic' : 'text-slate-700 font-medium'}`}>
                                                    {isSupervisor ? 'Supervisor (Non-TL)' : tlName}
                                                </span>
                                            </td>

                                            {/* Trainer */}
                                            <td className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">
                                                <span className={`text-[11px] ${isTrainer ? 'text-sky-800 font-bold italic' : (isSupervisor || isQa || isTl) ? 'text-slate-400 italic' : 'text-slate-700 font-medium'}`}>
                                                    {(isSupervisor || isQa || isTl) ? 'Non-Trainer' : trnName}
                                                </span>
                                            </td>

                                            {/* Site */}
                                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap min-w-[80px]">
                                                {siteCode}
                                            </td>

                                            {/* Status & Akun */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap min-w-[140px]">
                                                {isSupervisor ? (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300 whitespace-nowrap shadow-2xs">
                                                        AKUN SPV AKTIF
                                                    </span>
                                                ) : isQa ? (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 whitespace-nowrap shadow-2xs">
                                                        AKUN QA AKTIF
                                                    </span>
                                                ) : isTl ? (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap shadow-2xs">
                                                        AKUN TL AKTIF
                                                    </span>
                                                ) : isTrainer ? (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-300 whitespace-nowrap shadow-2xs">
                                                        AKUN TRAINER AKTIF
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap shadow-2xs">
                                                        AKTIF
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION FOOTER */}
                {!loading && nakerList.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Tampilkan:</span>
                            <select
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10));
                                    setCurrentPage(1);
                                }}
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                            >
                                <option value={25}>25 baris</option>
                                <option value={50}>50 baris</option>
                                <option value={100}>100 baris</option>
                                <option value="all">Semua ({totalItems})</option>
                            </select>
                            <span className="text-slate-500 ml-1">
                                Menampilkan {nakerList.length} dari {totalItems} Personel
                            </span>
                        </div>

                        {perPage !== 'all' && totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition shadow-2xs"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-3 py-1 text-xs font-bold text-slate-700">
                                    Halaman {currentPage} dari {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition shadow-2xs"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NakerHistory;
