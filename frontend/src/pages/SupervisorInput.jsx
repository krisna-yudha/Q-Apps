import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ShieldCheck,
    ShieldAlert,
    Upload,
    FileSpreadsheet,
    PlusCircle,
    FileUp,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    X,
    Download,
    RotateCcw,
    Trash2,
    Layers,
    Database,
    Search,
    Sparkles,
    GraduationCap,
    Check,
    Building2,
    Mail,
    MessageSquare,
    Zap,
    PhoneCall,
    UserCheck,
    Users,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import { CustomSelect } from '../components/common/CustomSelect';

const IMPORT_TYPES = [
    { id: 'NAKER', type: 'NAKER', name: 'Database NAKER', label: 'DATABASE NAKER (Plotting)', icon: UserCheck, color: 'blue', fileMatch: 'naker' },
    { id: 'Inbound', type: 'QSF', name: 'Inbound', label: 'QSF - Inbound Call', icon: PhoneCall, color: 'indigo', fileMatch: 'inbound' },
    { id: 'Digilive', type: 'QSF', name: 'Digilive', label: 'QSF - Digilive (Live Chat)', icon: Zap, color: 'emerald', fileMatch: 'digilive' },
    { id: 'Socmed', type: 'QSF', name: 'Socmed', label: 'QSF - Social Media', icon: MessageSquare, color: 'purple', fileMatch: 'socmed' },
    { id: 'Email', type: 'QSF', name: 'Email', label: 'QSF - Email', icon: Mail, color: 'sky', fileMatch: 'email' },
    { id: 'Email Outbound', type: 'QSF', name: 'Email Outbound', label: 'QSF - Email Outbound', icon: Mail, color: 'amber', fileMatch: 'email outbound' },
    { id: 'Outbound Call', type: 'QSF', name: 'Outbound Call', label: 'QSF - Outbound Call', icon: PhoneCall, color: 'orange', fileMatch: 'outbound call' },
    { id: 'Back Office', type: 'QSF', name: 'Back Office', label: 'QSF - Back Office (Eskalasi BO)', icon: Building2, color: 'rose', fileMatch: 'back office' },
];

export const SupervisorInput = () => {
    const { user } = useAuth();
    const { triggerDataUpdate } = useSync();
    const { showConfirm, showAlert, showToast } = useDialog();

    // Active Main View Tab
    const [activeTab, setActiveTab] = useState('import'); // 'import', 'manual', 'data', 'history'
    const [selectedChannel, setSelectedChannel] = useState('Back Office');
    const [selectedPeriod, setSelectedPeriod] = useState('2026-08');

    // Channel Summary Cards
    const [channelSummaries, setChannelSummaries] = useState([]);
    const [totalAgentsCount, setTotalAgentsCount] = useState(0);
    const [loadingSummary, setLoadingSummary] = useState(true);

    // Excel Import & Redundancy Audit States
    const [importStep, setImportStep] = useState(1); // 1 = Upload, 2 = Preview Audit, 3 = Finished
    const [parsedRows, setParsedRows] = useState([]);
    const [previewResult, setPreviewResult] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [fileName, setFileName] = useState('');
    const [fileSizeText, setFileSizeText] = useState('');
    const [detectedChannel, setDetectedChannel] = useState(null);
    const [activePreviewTab, setActivePreviewTab] = useState('all');
    const [importMode, setImportMode] = useState('upsert');
    const [importing, setImporting] = useState(false);
    const [importStatus, setImportStatus] = useState({ type: '', message: '' });
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Batch Import States (Anti-Crash)
    const [importProgress, setImportProgress] = useState({
        currentBatch: 0,
        totalBatches: 0,
        processedRows: 0,
        totalRows: 0,
        percent: 0,
        currentBatchRows: 0,
        statusText: ''
    });

    // Import History States
    const [importHistory, setImportHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Manual Form States
    const [manualForm, setManualForm] = useState({
        name: '',
        nik: '',
        channel: 'Back Office',
        ca_score: 95.0,
        fcr_score: 90.0,
        team_leader_name: '',
        trainer_name: '',
        evaluation_count: 40,
        period_month: '2026-08'
    });
    const [manualSaving, setManualSaving] = useState(false);
    const [manualStatus, setManualStatus] = useState({ type: '', message: '' });

    // Data List in Supervisor Hub
    const [agentsList, setAgentsList] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterChannel, setFilterChannel] = useState('all');

    // NAKER Master States & Pagination
    const [nakerList, setNakerList] = useState([]);
    const [nakerSummary, setNakerSummary] = useState({ total_naker: 0, pria: 0, wanita: 0, service_distribution: [] });
    const [loadingNaker, setLoadingNaker] = useState(false);
    const [searchNaker, setSearchNaker] = useState('');
    const [filterNakerService, setFilterNakerService] = useState('all');
    const [filterNakerGender, setFilterNakerGender] = useState('all');
    const [nakerPage, setNakerPage] = useState(1);
    const [nakerPerPage, setNakerPerPage] = useState(15);

    // NAKER Pagination calculations
    const totalNakerItems = nakerList.length;
    const pageSize = nakerPerPage === 'all' ? totalNakerItems : (parseInt(nakerPerPage, 10) || 15);
    const totalNakerPages = nakerPerPage === 'all' ? 1 : Math.max(1, Math.ceil(totalNakerItems / (pageSize || 1)));
    const validNakerPage = Math.max(1, Math.min(nakerPage, totalNakerPages));

    const paginatedNakerList = nakerPerPage === 'all'
        ? nakerList
        : nakerList.slice((validNakerPage - 1) * pageSize, validNakerPage * pageSize);

    const nakerStartIndex = totalNakerItems === 0 ? 0 : (validNakerPage - 1) * (nakerPerPage === 'all' ? totalNakerItems : pageSize) + 1;
    const nakerEndIndex = nakerPerPage === 'all' ? totalNakerItems : Math.min(validNakerPage * pageSize, totalNakerItems);

    // Fetch summary of channels
    const fetchSummary = async () => {
        setLoadingSummary(true);
        try {
            const res = await api.getSupervisorChannelSummary();
            if (res.success) {
                setChannelSummaries(res.channels || []);
                setTotalAgentsCount(res.total_all_agents || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSummary(false);
        }
    };

    // Fetch Master Data NAKER
    const fetchNakerData = async () => {
        setLoadingNaker(true);
        try {
            const res = await api.getEmployees({
                search: searchNaker || undefined,
                service: filterNakerService !== 'all' ? filterNakerService : undefined,
                gender: filterNakerGender !== 'all' ? filterNakerGender : undefined,
                per_page: 'all'
            });
            if (res.success) {
                const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
                setNakerList(list);
                if (res.summary) setNakerSummary(res.summary);
            }
        } catch (e) {
            console.error(e);
            setNakerList([]);
        } finally {
            setLoadingNaker(false);
        }
    };

    // Export Master NAKER to Excel — mengambil data dari backend (employees + employee_assignments)
    const exportNakerToExcel = async () => {
        if (loadingNaker) return;
        try {
            const res = await api.exportNaker({
                search: searchNaker || undefined,
                service: filterNakerService !== 'all' ? filterNakerService : undefined,
                gender: filterNakerGender !== 'all' ? filterNakerGender : undefined,
            });
            if (!res.success || !res.rows || res.rows.length === 0) {
                showAlert({
                    title: 'Ekspor Excel NAKER',
                    message: 'Tidak ada data NAKER untuk diekspor.',
                    type: 'info'
                });
                return;
            }
            const ws = XLSX.utils.json_to_sheet(res.rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PLOTTING');
            XLSX.writeFile(wb, `DATABASE ALL NAKER - ${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            // Fallback ke client-side jika API gagal
            if (!nakerList || nakerList.length === 0) return;
            const rows = nakerList.map((emp, idx) => ({
                'NO': idx + 1,
                'NAMA': emp.name,
                'JK': emp.gender === 'PRIA' ? 'L' : (emp.gender === 'WANITA' ? 'P' : ''),
                'LAYANAN': emp.current_assignment?.service?.name || '',
                'TEAM TL': emp.current_assignment?.team_leader?.name || '',
                'TRAINER': emp.current_assignment?.trainer?.name || '',
                'SITE': emp.current_assignment?.site?.code || 'SMG',
                'ID SIP': emp.sip_id,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PLOTTING');
            XLSX.writeFile(wb, `DATABASE ALL NAKER - ${new Date().toISOString().slice(0, 10)}.xlsx`);
        }
    };

    // Export Assessment QSF per channel dari database
    const exportQsfToExcel = async (channelName) => {
        if (!channelName || channelName === 'NAKER') return;
        try {
            const res = await api.exportQsf(channelName, null);
            if (!res.success || !res.rows || res.rows.length === 0) {
                showAlert({
                    title: `Ekspor QSF ${channelName}`,
                    message: `Tidak ada data assessment ${channelName} untuk diekspor.`,
                    type: 'info'
                });
                return;
            }
            const ws = XLSX.utils.json_to_sheet(res.rows);
            const wb = XLSX.utils.book_new();
            const sheetName = `QSF ${channelName}`.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `Report CA FCR Detail QSF - ${channelName.toUpperCase()} - ${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            showAlert({
                title: 'Gagal Ekspor Data',
                message: 'Gagal mengekspor data: ' + err.message,
                type: 'error'
            });
        }
    };



    // Fetch Import History
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.getImportHistory();
            if (res.success) {
                setImportHistory(res.data?.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Fetch all agents
    const fetchAgentsData = async () => {
        setLoadingData(true);
        try {
            const res = await api.getAgentRecap({
                channel: filterChannel !== 'all' ? filterChannel : undefined,
                search: searchQuery || undefined
            });
            setAgentsList(res.data || []);
        } catch (e) {
            setAgentsList([]);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchSummary();
        fetchNakerData();
    }, []);

    useEffect(() => {
        if (activeTab === 'data') {
            fetchAgentsData();
        } else if (activeTab === 'history') {
            fetchHistory();
        } else if (activeTab === 'naker') {
            fetchNakerData();
        }
    }, [activeTab, filterChannel, searchQuery, searchNaker, filterNakerService, filterNakerGender]);

    // Live Auto-Refresh Listener
    useEffect(() => {
        const handleSync = () => {
            fetchSummary();
            fetchNakerData();
            if (activeTab === 'data') fetchAgentsData();
            if (activeTab === 'history') fetchHistory();
        };
        window.addEventListener('digiqa:data_refresh', handleSync);
        return () => window.removeEventListener('digiqa:data_refresh', handleSync);
    }, [activeTab]);

    // Auto-Detect Channel from File Name and Content (NAKER + 7 QSF Channels)
    const detectChannelFromFileName = (name, rows = []) => {
        const lower = (name || '').toLowerCase();

        // 0. Check NAKER
        if (lower.includes('naker') || lower.includes('tenaga kerja') || lower.includes('plotting')) return 'NAKER';

        // 1. Email Outbound (Email Outbond)
        if (
            lower.includes('email outbound') || lower.includes('email outbond') ||
            lower.includes('email_outbound') || lower.includes('email_outbond') ||
            lower.includes('outbound reguler') || lower.includes('outbond reguler')
        ) {
            return 'Email Outbound';
        }

        // 2. Outbound Call (Outbond Call)
        if (
            lower.includes('outbound call') || lower.includes('outbond call') ||
            lower.includes('outbound_call') || lower.includes('outbond_call') ||
            lower.includes('outbound') || lower.includes('outbond')
        ) {
            return 'Outbound Call';
        }

        // 3. Email (QSF - EMAIL.xlsx)
        if (lower.includes('email')) return 'Email';

        // 4. Back Office
        if (
            lower.includes('back office') || lower.includes('backoffice') ||
            lower.includes('eskalasi bo') || lower.includes('eskalasi_bo') ||
            lower.includes('back_office') || lower === 'bo' || lower.includes('eskalasi')
        ) {
            return 'Back Office';
        }

        // 5. Digilive (Live Chat)
        if (
            lower.includes('digilive') || lower.includes('live chat') ||
            lower.includes('livechat') || lower.includes('chat')
        ) {
            return 'Digilive';
        }

        // 6. Socmed
        if (
            lower.includes('socmed') || lower.includes('sosmed') ||
            lower.includes('social') || lower.includes('instagram') ||
            lower.includes('whatsapp') || lower.includes('twitter') || lower.includes('facebook')
        ) {
            return 'Socmed';
        }

        // 7. Inbound Call
        if (
            lower.includes('inbound') || lower.includes('inbond') ||
            lower.includes('voice') || lower.includes('call')
        ) {
            return 'Inbound';
        }

        // Check rows content if available
        if (rows && rows.length > 0) {
            const r = rows[0];
            if ('ID SIP' in r || 'ID_SIP' in r || 'TEAM TL' in r || ('NAMA' in r && 'JK' in r)) return 'NAKER';
            const ca = (r['CA'] || r['Layanan'] || r['Saluran'] || '').toString().toLowerCase();
            if (ca.includes('email outbound') || ca.includes('email outbond') || ca.includes('outbound reguler') || ca.includes('outbond reguler')) return 'Email Outbound';
            if (ca.includes('outbound call') || ca.includes('outbond call') || ca.includes('outbound') || ca.includes('outbond')) return 'Outbound Call';
            if (ca.includes('email')) return 'Email';
            if (ca.includes('back office') || ca.includes('backoffice') || ca.includes('eskalasi') || ca.includes('bo')) return 'Back Office';
            if (ca.includes('digilive') || ca.includes('chat')) return 'Digilive';
            if (ca.includes('socmed') || ca.includes('sosmed')) return 'Socmed';
            if (ca.includes('inbound') || ca.includes('inbond') || ca.includes('voice') || ca.includes('call')) return 'Inbound';

            if ('1.1' in r || '10.2' in r) return 'Digilive';
            if ('A.1' in r || 'C.2' in r) return 'Socmed';
            if ('A1' in r || 'E14' in r) return 'Email Outbound';
            if ('15' in r) return 'Email';
            if ('14' in r) return 'Inbound';
            if ('12' in r && !('13' in r)) return 'Outbound Call';
            if ('3' in r && !('4' in r)) return 'Back Office';
        }

        return null;
    };

    // Download Sample Template untuk channel tertentu / NAKER — sesuai Roadmap V2
    const downloadChannelTemplate = (channelName) => {
        // === TEMPLATE NAKER (Roadmap §28) ===
        if (channelName === 'NAKER') {
            const rows = [
                {
                    'NO': 1,
                    'NAMA': 'AFIFUDIN NURCAHYO',
                    'JK': 'L',
                    'LAYANAN': 'CSO DIGILIVE CHAT - MY ICON+',
                    'TEAM TL': '',
                    'TRAINER': '',
                    'SITE': 'SMG',
                    'ID SIP': 'AFIFUDIN.NURCAHYO',
                },
                {
                    'NO': 2,
                    'NAMA': 'ALMIRA PARAMITHA',
                    'JK': 'P',
                    'LAYANAN': 'NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE',
                    'TEAM TL': '',
                    'TRAINER': '',
                    'SITE': 'SMG',
                    'ID SIP': 'ALMIRA.PARAMITHA',
                },
            ];
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PLOTTING');
            XLSX.writeFile(wb, 'DATABASED ALL NAKER AGUSTUS 2026.xlsx');
            return;
        }

        // === TEMPLATE QSF — field umum sesuai Roadmap §29.1 ===
        // Definisi parameter per service (Roadmap §22)
        // Parameter codes per channel — sesuai sample Excel aktual (Row 3 = kode param)
        const QSF_PARAMS = {
            'Inbound': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],                                               // 14 params
            'Digilive': ['1.1', '2.1', '2.2', '2.3', '3.1', '4.1', '5.1', '5.2', '5.3', '6.1', '6.2', '7.1', '8.1', '8.2', '9.1', '9.2', '10.1', '10.2'], // 18 params
            'Socmed': ['A.1', 'A.2', 'B.1', 'B.2', 'B.3', 'B.4', 'C.1', 'C.2'],                                                          // 8 params
            'Email': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],                                         // 15 params
            'Email Outbound': ['A1', 'B1', 'B2', 'C3', 'C4', 'C5', 'D6', 'D7', 'D8', 'D9', 'D10', 'E11', 'E12', 'E13', 'E14'],                           // 15 params
            'Outbound Call': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],                                                        // 12 params
            'Back Office': ['1', '2', '3'],                                                                                               // 3 params
        };

        // Nilai CA dan Layanan source per service (Roadmap §54A.1)
        const CA_LABELS = {
            'Inbound': { ca: 'Inbound', layanan: 'Inbound' },
            'Digilive': { ca: 'Digilive', layanan: 'Digilive' },
            'Socmed': { ca: 'Socmed', layanan: 'SOSMED' },
            'Email': { ca: 'Email_Inbound', layanan: 'Email' },
            'Email Outbound': { ca: 'Email_Outbound', layanan: 'Outbound Reguler' },
            'Outbound Call': { ca: 'Outbound Call', layanan: 'Outbound Reguler' },
            'Back Office': { ca: 'Ketepatan Eskalasi BO', layanan: 'Ketepatan Eskalasi BO' },
        };

        const hasPlatform = channelName === 'Digilive' || channelName === 'Socmed';
        const params = QSF_PARAMS[channelName] || [];
        const caLabel = CA_LABELS[channelName] || { ca: channelName, layanan: channelName };

        // Platform contoh
        const platformSample = {
            'Digilive': 'LIVE CHAT MYICON+',
            'Socmed': 'DM INSTAGRAM',
        };

        // Nilai contoh parameter (sesuai bobot umum)
        const paramSampleValue = {
            'Inbound': 7.1,
            'Digilive': 5.5,
            'Socmed': 12.5,
            'Email': 6.6,
            'Email Outbound': 6.6,
            'Outbound Call': 8.3,
            'Back Office': 33.3,
        };
        const sampleScore = paramSampleValue[channelName] ?? 5.0;

        // ================================================================
        // Generate file dengan format 3-row header PERSIS seperti sample:
        // Row 1: Title banner periode
        // Row 2: Nama kolom (No, Site, IDCA, ..., Attribute, ..., Score CA, ...)
        // Row 3: Kode parameter (di kolom Attribute dst)
        // Row 4: Contoh data
        // ================================================================

        // Bangun daftar kolom standar
        const standardCols = ['No', 'Site', 'IDCA', 'ID Tiket', 'CA', 'Layanan', 'Kategori', 'Sub Kategori', 'Pelanggan', 'Agent',
            'Tgl Transaksi', 'Durasi Transaksi', 'Durasi Sampling', 'QA', 'Tgl Ukur'];
        if (hasPlatform) standardCols.push('Platform');
        standardCols.push('FCR', 'Hashtag', 'Ket FCR', 'Attribute');
        // Kolom parameter (setelah Attribute, sebelum Score CA)
        for (let i = 1; i < params.length; i++) standardCols.push('');
        standardCols.push('Score CA', 'Ket Summary', 'Rekomendasi', 'Ket Rekomendasi', 'Pernah Diubah');

        // Row 1: Title
        const titleRow = Array(standardCols.length).fill('');
        titleRow[0] = `Report CA FCR Detail QSF - ${caLabel.layanan} || Periode : 2026-09-01 sd 2026-09-30`;

        // Row 2: Nama kolom
        const headerRow = [...standardCols];

        // Row 3: Kode parameter (di posisi Attribute+)
        const paramRow = Array(standardCols.length).fill('');
        const attrColIdx = standardCols.indexOf('Attribute');
        params.forEach((code, i) => {
            if (attrColIdx + i < paramRow.length) paramRow[attrColIdx + i] = code;
        });

        // Row 4: Contoh data
        const dataRow = Array(standardCols.length).fill('');
        const standardVals = [
            1,
            'SMG',
            `CA_${channelName.substring(0, 3).toUpperCase()}-20260901103000`,
            'TKT-99881',
            caLabel.ca,
            caLabel.layanan,
            'GANGGUAN',
            'Koneksi Lambat',
            'Budi Santoso',
            'SITI.NURHALIZA',
            '2026-09-01 10:15:00',
            '00:03:45',
            '00:08:20',
            'ALMIRA.PARAMITHA',
            '2026-09-01 14:00:00',
        ];
        let colOffset = 0;
        standardVals.forEach((v, i) => { dataRow[i] = v; colOffset = i + 1; });
        if (hasPlatform) { dataRow[colOffset] = platformSample[channelName] || 'WHATSAPP'; colOffset++; }
        dataRow[colOffset] = 'YA';      // FCR
        dataRow[colOffset + 1] = '#GANGGUAN #KONEKSI'; // Hashtag
        dataRow[colOffset + 2] = '';    // Ket FCR
        // Parameter values di posisi attrColIdx
        params.forEach((_, i) => {
            if (attrColIdx + i < dataRow.length) dataRow[attrColIdx + i] = sampleScore;
        });
        // Score CA, Ket Summary, Rekomendasi, Ket Rekomendasi, Pernah Diubah
        const scoreIdx = standardCols.indexOf('Score CA');
        dataRow[scoreIdx] = 96.5;
        dataRow[scoreIdx + 1] = 'Agent memberikan penjelasan yang sangat jelas dan solutif.';
        dataRow[scoreIdx + 2] = 'Positive Feedback';
        dataRow[scoreIdx + 3] = 'SESUAI';
        dataRow[scoreIdx + 4] = 'TIDAK';

        // Build worksheet dari array of arrays
        const wsData = [titleRow, headerRow, paramRow, dataRow];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        const sheetName = `QSF ${channelName}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `QSF - ${channelName.toUpperCase()}.xlsx`);
    };


    // Process & Parse Excel/CSV File & Trigger Audit (Supports .xls, .xlsx, .csv, html-xls)
    const processExcelFile = (file) => {
        if (!file) return;

        setFileName(file.name);
        setFileSizeText(`${(file.size / 1024).toFixed(1)} KB`);
        setImportStatus({ type: '', message: '' });
        setPreviewLoading(true);

        const initialAuto = detectChannelFromFileName(file.name);
        if (initialAuto) {
            setDetectedChannel(initialAuto);
            setSelectedChannel(initialAuto);
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const buffer = evt.target.result;
                let wb;

                // 1. Try reading as ArrayBuffer (standard for xlsx/xls)
                try {
                    wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, raw: false });
                } catch (e1) {
                    // 2. Fallback to string for HTML-exported .xls or CSV
                    try {
                        const text = new TextDecoder('utf-8').decode(buffer);
                        wb = XLSX.read(text, { type: 'string', cellDates: true, raw: false });
                    } catch (e2) {
                        // 3. Fallback binary string
                        const binary = new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '');
                        wb = XLSX.read(binary, { type: 'binary', cellDates: true, raw: false });
                    }
                }

                if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
                    setImportStatus({ type: 'error', message: 'Berkas Excel tidak memiliki sheet yang dapat dibaca.' });
                    setParsedRows([]);
                    setPreviewLoading(false);
                    return;
                }

                let chosenSheet = wb.SheetNames[0];
                let data = [];

                // ── Prioritas 1: NAKER sheet PLOTTING ──────────────────────────────
                if (wb.SheetNames.includes('PLOTTING')) {
                    chosenSheet = 'PLOTTING';
                    data = XLSX.utils.sheet_to_json(wb.Sheets['PLOTTING'], { defval: '', raw: false });
                }

                // ── Prioritas 2: Loop semua sheet ──────────────────────────────────
                if (!data || data.length === 0) {
                    for (const sName of wb.SheetNames) {
                        const ws = wb.Sheets[sName];
                        if (!ws) continue;

                        // Baca sebagai matrix (array of arrays) untuk bisa handle multi-row header
                        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
                        if (!matrix || matrix.length < 2) continue;

                        // ── Deteksi format QSF 3-row header ────────────────────────────
                        const isQsfTitleBanner = (row) => {
                            if (!Array.isArray(row)) return false;
                            const firstCell = String(row[0] || '').toLowerCase();
                            return (firstCell.includes('report') || firstCell.includes('qsf') || firstCell.includes('periode')) &&
                                firstCell.length > 20;
                        };

                        const isQsfHeaderRow = (row) => {
                            if (!Array.isArray(row)) return false;
                            const cells = row.map(c => String(c || '').toLowerCase());
                            const standardQsfCols = ['no', 'site', 'idca', 'id tiket', 'ca', 'layanan', 'agent', 'qa', 'fcr', 'attribute', 'score ca'];
                            const found = standardQsfCols.filter(col => cells.some(c => c.trim() === col));
                            return found.length >= 5;
                        };

                        // Cari apakah ada pola 3-row header QSF
                        let qsfHeaderRowIdx = -1;
                        for (let r = 0; r < Math.min(matrix.length, 5); r++) {
                            if (isQsfTitleBanner(matrix[r]) && r + 1 < matrix.length && isQsfHeaderRow(matrix[r + 1])) {
                                qsfHeaderRowIdx = r + 1; // Baris header kolom
                                break;
                            }
                            if (isQsfHeaderRow(matrix[r])) {
                                qsfHeaderRowIdx = r;
                                break;
                            }
                        }

                        if (qsfHeaderRowIdx !== -1) {
                            // ── Parse format QSF 3-row header ────────────────────────────
                            const colNameRow = matrix[qsfHeaderRowIdx];   // Row nama kolom
                            const paramCodeRow = matrix[qsfHeaderRowIdx + 1]; // Row kode parameter
                            const dataStartRow = qsfHeaderRowIdx + 2;     // Data mulai dari sini

                            const attrColStart = colNameRow.findIndex(h => String(h || '').trim() === 'Attribute');
                            const scoreCaColIdx = colNameRow.findIndex(h => String(h || '').trim() === 'Score CA');

                            const finalHeaders = colNameRow.map((h, idx) => {
                                const hStr = String(h || '').trim();
                                if (attrColStart !== -1 && scoreCaColIdx !== -1 &&
                                    idx >= attrColStart && idx < scoreCaColIdx) {
                                    const paramCode = paramCodeRow && paramCodeRow[idx] !== undefined && paramCodeRow[idx] !== null
                                        ? String(paramCodeRow[idx]).trim()
                                        : '';
                                    return paramCode || hStr;
                                }
                                return hStr;
                            });

                            // Build data rows — filter baris tidak valid
                            const extracted = [];
                            for (let r = dataStartRow; r < matrix.length; r++) {
                                const row = matrix[r];
                                if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

                                const firstCell = String(row[0] || '').toLowerCase().trim();
                                if (firstCell === 'no') continue;
                                if (firstCell.includes('rata') || firstCell.includes('average') || firstCell.includes('total')) continue;
                                if (firstCell.includes('report') || firstCell.includes('periode')) continue;
                                const agentColIdx = finalHeaders.findIndex(h => h === 'Agent');
                                const idcaColIdx = finalHeaders.findIndex(h => h === 'IDCA');
                                const agentVal = agentColIdx !== -1 ? String(row[agentColIdx] || '').trim() : '';
                                const idcaVal = idcaColIdx !== -1 ? String(row[idcaColIdx] || '').trim() : '';
                                if (agentVal.toLowerCase() === 'agent') continue;
                                if (!agentVal && !idcaVal && /^\d+$/.test(firstCell)) continue;

                                const item = {};
                                finalHeaders.forEach((h, col) => {
                                    if (h) item[h] = row[col] !== undefined && row[col] !== null ? row[col] : '';
                                });
                                if (Object.keys(item).length > 2) extracted.push(item);
                            }

                            if (extracted.length > 0) {
                                chosenSheet = sName;
                                data = extracted;
                                break;
                            }
                        }

                        // ── Fallback: format 1-row header biasa (NAKER / flat QSF) ────
                        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
                        if (rows && rows.length > 0) {
                            const keys = Object.keys(rows[0] || {});
                            if (keys.length >= 2) {
                                chosenSheet = sName;
                                data = rows;
                                break;
                            }
                        }

                        // ── Fallback: header auto-detection dengan heuristik ──────────
                        let headerIdx = -1;
                        for (let r = 0; r < Math.min(matrix.length, 8); r++) {
                            const row = matrix[r];
                            if (Array.isArray(row) && row.some(c => {
                                const s = String(c || '').toLowerCase();
                                return s.includes('agent') || s.includes('nama') || s.includes('ca') ||
                                    s.includes('nik') || s.includes('tiket') || s.includes('no') || s.includes('score');
                            })) {
                                headerIdx = r;
                                break;
                            }
                        }

                        if (headerIdx !== -1) {
                            const headers = matrix[headerIdx].map(h => String(h || '').trim());
                            const extracted = [];
                            for (let r = headerIdx + 1; r < matrix.length; r++) {
                                const row = matrix[r];
                                if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
                                const item = {};
                                headers.forEach((h, col) => {
                                    if (h) item[h] = row[col] !== undefined ? row[col] : '';
                                });
                                if (Object.keys(item).length > 0) extracted.push(item);
                            }
                            if (extracted.length > 0) {
                                chosenSheet = sName;
                                data = extracted;
                                break;
                            }
                        }
                    }
                }

                if (!data || data.length === 0) {
                    setImportStatus({
                        type: 'error',
                        message: 'File Excel kosong atau format kolom tidak dikenali. Pastikan file memiliki baris data dan judul kolom.'
                    });
                    setParsedRows([]);
                    setPreviewLoading(false);
                    return;
                }

                const autoChannel = detectChannelFromFileName(file.name, data) || initialAuto || selectedChannel;
                setDetectedChannel(autoChannel);
                setSelectedChannel(autoChannel);
                setParsedRows(data);

                const isNaker = autoChannel === 'NAKER';
                // Hanya kirim 50 baris pertama untuk preview cepat (payload < 50KB vs 17MB) agar koneksi lancar & anti-crash
                const sampleRows = data.slice(0, 50);
                const payload = {
                    import_type: isNaker ? 'NAKER' : 'QSF',
                    profile_code: isNaker ? 'NAKER_AUGUST_2026' : undefined,
                    rows: sampleRows,
                    file_name: file.name,
                    channel: autoChannel,
                };

                const previewRes = await api.previewImport(payload);

                if (previewRes.success) {
                    if (previewRes.service?.name) {
                        setSelectedChannel(previewRes.service.name);
                        setDetectedChannel(previewRes.service.name);
                    }
                    // Pertahankan total jumlah baris asli dari file Excel untuk summary
                    setPreviewResult({
                        ...previewRes,
                        summary: {
                            ...previewRes.summary,
                            total_rows: data.length,
                            valid_count: data.length,
                        }
                    });
                    setImportStep(2); // Show preview
                } else {
                    setImportStatus({ type: 'error', message: previewRes.message || 'Gagal memproses pratinjau audit.' });
                }
            } catch (err) {
                setImportStatus({ type: 'error', message: 'Gagal membaca format Excel: ' + (err.response?.data?.message || err.message) });
            } finally {
                setPreviewLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Handle File Input Change (Click Picker)
    const handleFileChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            processExcelFile(file);
        }
    };

    // Drag and Drop Event Handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            const validExts = ['.xlsx', '.xls', '.csv'];
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (!validExts.includes(ext) && !file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.csv')) {
                setImportStatus({
                    type: 'error',
                    message: 'Format berkas tidak didukung. Harap seret atau pilih berkas berekstensi .xlsx, .xls, atau .csv.'
                });
                return;
            }
            processExcelFile(file);
        }
    };

    // Submit Final Import to Database (Chunked Batch Injection Anti-Crash)
    const submitImport = async () => {
        if (!parsedRows || parsedRows.length === 0) {
            showAlert({
                title: 'Berkas Tidak Valid',
                message: 'Pilih file Excel yang valid sebelum melakukan impor data.',
                type: 'warning'
            });
            return;
        }

        setImporting(true);
        setImportStatus({ type: '', message: '' });

        const BATCH_SIZE = 200; // Ukuran batch per request (200 baris) agar memory ringan, respon cepat, dan anti-crash
        const chunks = [];
        for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
            chunks.push(parsedRows.slice(i, i + BATCH_SIZE));
        }
        const totalChunks = chunks.length;

        setImportProgress({
            currentBatch: 1,
            totalBatches: totalChunks,
            processedRows: 0,
            totalRows: parsedRows.length,
            percent: 0,
            currentBatchRows: chunks[0].length,
            statusText: `Mempersiapkan injeksi batch (Total ${totalChunks} batch, ${parsedRows.length} baris)...`
        });

        try {
            const isNaker = (previewResult?.import_type === 'NAKER') || (selectedChannel === 'NAKER');
            let activeImportId = null;
            let activeBatchId = null;
            let totalSuccess = 0;
            let totalFailed = 0;

            for (let b = 0; b < totalChunks; b++) {
                const currentChunk = chunks[b];
                const isFirst = (b === 0);
                const isLast = (b === totalChunks - 1);

                setImportProgress({
                    currentBatch: b + 1,
                    totalBatches: totalChunks,
                    processedRows: b * BATCH_SIZE,
                    totalRows: parsedRows.length,
                    percent: Math.round((b / totalChunks) * 100),
                    currentBatchRows: currentChunk.length,
                    statusText: `Menginjeksi Batch ${b + 1} dari ${totalChunks} (${currentChunk.length} baris)...`
                });

                const payload = {
                    import_type: isNaker ? 'NAKER' : 'QSF',
                    profile_code: isNaker ? 'NAKER_AUGUST_2026' : undefined,
                    rows: currentChunk,
                    file_name: fileName,
                    channel: selectedChannel,
                    import_mode: importMode,
                    is_first_batch: isFirst,
                    is_last_batch: isLast,
                    batch_index: b + 1,
                    total_batches: totalChunks,
                    import_id: activeImportId,
                    batch_id: activeBatchId,
                    total_expected_rows: parsedRows.length
                };

                const res = await api.processImport(payload);

                if (!res.success) {
                    throw new Error(res.message || `Gagal pada Batch ${b + 1}`);
                }

                if (res.import_id) activeImportId = res.import_id;
                if (res.batch_id) activeBatchId = res.batch_id;
                if (res.batch_success_rows !== undefined) totalSuccess += res.batch_success_rows;
                if (res.batch_failed_rows !== undefined) totalFailed += res.batch_failed_rows;

                const updatedProcessed = Math.min((b + 1) * BATCH_SIZE, parsedRows.length);
                setImportProgress({
                    currentBatch: b + 1,
                    totalBatches: totalChunks,
                    processedRows: updatedProcessed,
                    totalRows: parsedRows.length,
                    percent: Math.round(((b + 1) / totalChunks) * 100),
                    currentBatchRows: currentChunk.length,
                    statusText: isLast
                        ? `Finalisasi perhitungan agregasi dan tren...`
                        : `Batch ${b + 1} selesai (${updatedProcessed}/${parsedRows.length} data)`
                });
            }

            setImportStatus({
                type: 'success',
                message: `Berhasil menginjeksi seluruh ${totalChunks} batch data (${parsedRows.length} baris) ke database relasional tanpa crash!`
            });
            setImportStep(3); // Finished view
            triggerDataUpdate(); // Broadcast refresh across all app tabs
            fetchSummary();
            if (activeTab === 'history') fetchHistory();
        } catch (err) {
            setImportStatus({
                type: 'error',
                message: 'Terjadi kesalahan pada injeksi batch: ' + (err.response?.data?.message || err.message)
            });
        } finally {
            setImporting(false);
        }
    };

    // Handle Manual Form Submission
    const handleManualSubmit = async (e) => {
        e?.preventDefault();
        if (!manualForm.name || !manualForm.nik) {
            setManualStatus({ type: 'error', message: 'Nama dan NIK wajib diisi.' });
            return;
        }

        setManualSaving(true);
        setManualStatus({ type: '', message: '' });

        try {
            const supervisorName = user?.name || 'Supervisor';
            const res = await api.storeManualAgent({
                ...manualForm,
                imported_by: supervisorName
            });

            setManualStatus({
                type: 'success',
                message: res.message || 'Data agen berhasil disimpan!'
            });

            triggerDataUpdate();
            fetchSummary();

            // Reset form fields except channel
            setManualForm(prev => ({
                ...prev,
                name: '',
                nik: '',
                ca_score: 95.0,
                fcr_score: 90.0,
            }));
        } catch (err) {
            setManualStatus({
                type: 'error',
                message: err.response?.data?.message || 'Gagal menyimpan data formulir.'
            });
        } finally {
            setManualSaving(false);
        }
    };

    // Empty Database Entirely
    const handleResetDatabase = async () => {
        const ok = await showConfirm({
            title: 'Kosongkan Seluruh Data Penilaian',
            message: 'PERINGATAN: Apakah Anda yakin ingin mengosongkan SELURUH data nilai penilaian agen di database MySQL?\n\nTindakan ini akan menghapus riwayat penilaian dan data audit.',
            type: 'danger',
            confirmText: 'Ya, Kosongkan Data',
        });
        if (!ok) return;

        try {
            await api.resetSystemData();
            triggerDataUpdate();
            fetchSummary();
            if (activeTab === 'data') fetchAgentsData();
            showAlert({
                title: 'Data Dikosongkan',
                message: 'Seluruh data penilaian agen di database berhasil dikosongkan!',
                type: 'success'
            });
        } catch (err) {
            showAlert({
                title: 'Gagal Mereset Data',
                message: 'Gagal mereset data: ' + err.message,
                type: 'error'
            });
        }
    };

    // Filter items in Preview Audit Table
    const filteredPreviewItems = previewResult?.items?.filter(item => {
        if (activePreviewTab === 'all') return true;
        return item.row_type === activePreviewTab;
    }) || [];

    // Team Leader Restriction Guard
    if (user?.role === 'team_leader' || user?.role === 'tl') {
        return (
            <div className="space-y-4 max-w-2xl mx-auto py-12 text-center">
                <div className="corp-card p-8 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                        <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Akses Dikhususkan untuk Role Supervisor</h2>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-lg mx-auto">
                            Modul 6 (Input & Import Supervisor) hanya dapat diakses oleh Role <strong>Supervisor QA</strong> untuk setor data tarikan harian dan manajemen database Master NAKER.
                        </p>
                        <p className="text-xs text-emerald-800 font-semibold mt-2">
                            Sebagai <strong>Team Leader</strong>, Anda dapat memantau data performa dan grafik anggota tim Anda melalui Dashboard Global dan Rekap Nilai Agent (Mode Read-Only).
                        </p>
                    </div>
                    <div className="pt-2 flex justify-center gap-3">
                        <Link to="/rekap-agent" className="btn-primary">
                            Lihat Rekap Under-Team
                        </Link>
                        <Link to="/dashboard-global" className="btn-secondary">
                            Buka Dashboard Global
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header & Role Supervisor Badge */}
            <div className="corp-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            SUPERVISOR CONTROL HUB
                        </span>
                        <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                            Pusat Import & Input Satu Pintu (NAKER & 7 Saluran QSF)
                        </h1>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Pusat unggah berkas satu pintu untuk Master Data NAKER & 7 Saluran Laporan QSF. Seluruh data yang diimpor otomatis mengalir dan ditampilkan di Dashboard Global, Analisis & Evaluasi (Anev), Rekap Nilai Agent, dan Pencapaian QA.
                    </p>
                </div>

                {/* Global Reset Database Action */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <button
                        onClick={handleResetDatabase}
                        className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                        title="Kosongkan seluruh data penilaian di database"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Kosongkan Seluruh Data</span>
                    </button>
                </div>
            </div>

            {/* Channel Summary & NAKER Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5">
                {IMPORT_TYPES.map(ch => {
                    const Icon = ch.icon;
                    const summary = channelSummaries.find(s => s.channel === ch.id);
                    const hasData = summary && summary.agent_count > 0;
                    const isNakerCard = ch.id === 'NAKER';

                    return (
                        <div
                            key={ch.id}
                            onClick={() => {
                                if (isNakerCard) {
                                    setActiveTab('naker');
                                    setSelectedChannel('NAKER');
                                } else {
                                    setSelectedChannel(ch.id);
                                    setManualForm(f => ({ ...f, channel: ch.id }));
                                }
                            }}
                            className={`p-3 rounded-2xl border transition cursor-pointer relative overflow-hidden flex flex-col justify-between active:scale-95 select-none ${(selectedChannel === ch.id || (isNakerCard && activeTab === 'naker'))
                                    ? 'bg-blue-50/40 border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                                }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${ch.color === 'blue' ? 'bg-blue-50 text-blue-700' :
                                            ch.color === 'indigo' ? 'bg-indigo-50 text-indigo-700' :
                                                ch.color === 'amber' ? 'bg-amber-50 text-amber-700' :
                                                    ch.color === 'purple' ? 'bg-purple-50 text-purple-700' :
                                                        ch.color === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                                                            ch.color === 'sky' ? 'bg-sky-50 text-sky-700' :
                                                                ch.color === 'orange' ? 'bg-orange-50 text-orange-700' :
                                                                    'bg-rose-50 text-rose-700'
                                        }`}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`px-1.5 py-0.2 text-[8px] font-bold rounded ${isNakerCard ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                            hasData ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {isNakerCard ? `${nakerSummary.total_naker || nakerList.length} Naker` : (hasData ? `${summary.agent_count}` : '0')}
                                    </span>
                                </div>

                                <h4 className="text-[11px] font-bold text-slate-900 leading-tight truncate">
                                    {ch.name}
                                </h4>
                            </div>

                            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                                <span className="truncate">{ch.type}</span>
                                <span className="font-bold text-slate-800">{isNakerCard ? 'MASTER' : (hasData ? `${summary.avg_ca}%` : '-')}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scroll-smooth">
                <button
                    onClick={() => setActiveTab('import')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-2xs ${activeTab === 'import'
                            ? 'bg-[#0F2744] text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Data (NAKER & QSF)</span>
                </button>

                <button
                    onClick={() => {
                        setActiveTab('naker');
                        fetchNakerData();
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-2xs ${activeTab === 'naker'
                            ? 'bg-[#0F2744] text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                >
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Master Data NAKER ({nakerSummary.total_naker || nakerList.length})</span>
                </button>

                <Link
                    to="/kelola-akun"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-2xs bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200"
                >
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <span>Kelola Akun (Injeksi NAKER)</span>
                </Link>

                <button
                    onClick={() => setActiveTab('data')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-2xs ${activeTab === 'data'
                            ? 'bg-[#0F2744] text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Daftar Nilai Saluran ({totalAgentsCount})</span>
                </button>

                <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'manual'
                            ? 'bg-[#0F2744] text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Input Manual Per Agen</span>
                </button>

                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'history'
                            ? 'bg-[#0F2744] text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Riwayat Sesi Import</span>
                </button>
            </div>

            {/* TAB 1: IMPORT BERKAS EXCEL NAKER & QSF */}
            {activeTab === 'import' && (
                <div className="corp-card p-6 space-y-5">
                    {importStep === 1 ? (
                        <>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-purple-700" />
                                        Unggah Berkas Excel (NAKER / Laporan QSF)
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Sistem otomatis mendeteksi tipe berkas (Database NAKER sheet <em>PLOTTING</em> atau 7 jenis laporan QSF) dan menjalankan audit redundansi.
                                    </p>
                                </div>

                                {/* Target Channel Selector with Auto-Detect Feedback */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-xs font-semibold text-slate-700">Tipe Import:</span>
                                        {detectedChannel && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 shadow-2xs">
                                                <Sparkles className="w-3 h-3 text-purple-600 animate-spin" />
                                                Auto-Detect: {detectedChannel}
                                            </span>
                                        )}
                                    </div>
                                    <CustomSelect
                                        value={selectedChannel}
                                        onChange={(e) => {
                                            setSelectedChannel(e.target.value);
                                            setDetectedChannel(e.target.value);
                                        }}
                                        options={IMPORT_TYPES.map(ch => ({ value: ch.id, label: ch.label }))}
                                        className="w-full sm:w-64"
                                        buttonClassName="bg-white border-purple-300 ring-2 ring-purple-100 py-2 text-slate-900 focus:ring-purple-600 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Template Download Row */}
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                    <h5 className="font-bold text-slate-800">Unduh Format Template Standar:</h5>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Template tersedia untuk Database NAKER dan 7 saluran QSF
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {IMPORT_TYPES.map(ch => (
                                        <button
                                            key={ch.id}
                                            type="button"
                                            onClick={() => downloadChannelTemplate(ch.id)}
                                            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-semibold text-slate-700 flex items-center gap-1 shadow-2xs transition"
                                        >
                                            <Download className="w-3 h-3" />
                                            <span>{ch.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Drag & Drop Upload Zone */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 select-none ${previewLoading
                                        ? 'border-purple-400 bg-purple-50/50 pointer-events-none'
                                        : isDragging
                                            ? 'border-purple-600 bg-purple-100/70 ring-4 ring-purple-600/20 scale-[1.01]'
                                            : 'border-slate-300 hover:border-purple-600 bg-slate-50/70 hover:bg-purple-50/30'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                {previewLoading ? (
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                                        <p className="text-xs font-bold text-slate-800">
                                            Membaca Berkas & Melakukan Audit Validasi Data...
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            Menganalisis NIK / ID SIP, parameter mutu, serta memeriksa integritas relasi database
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${isDragging ? 'bg-purple-600 text-white shadow-md scale-110' : 'bg-purple-100 text-purple-700'
                                            }`}>
                                            <FileUp className="w-6 h-6" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-900">
                                            {isDragging
                                                ? '👉 Lepaskan berkas Excel di sini untuk memproses'
                                                : fileName
                                                    ? `Berkas Terpilih: ${fileName} (${fileSizeText})`
                                                    : 'Klik untuk memilih berkas Excel atau seret berkas ke sini'}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            Mendukung format Microsoft Excel (.xls, .xlsx) dan CSV
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Status Message */}
                            {importStatus.message && (
                                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${importStatus.type === 'error'
                                        ? 'bg-red-50 border border-red-200 text-red-800 font-semibold'
                                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold'
                                    }`}>
                                    {importStatus.type === 'error' ? (
                                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                                    )}
                                    <span>{importStatus.message}</span>
                                </div>
                            )}
                        </>
                    ) : importStep === 2 && previewResult ? (
                        /* STEP 2: PREVIEW AUDIT (NAKER / QSF) */
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-purple-700" />
                                        Hasil Audit Validasi & Pratinjau Berkas
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Berkas: <strong className="text-slate-800 font-mono">{fileName}</strong> ({fileSizeText}) • Tipe: <strong className="text-purple-700">{previewResult.import_type || 'QSF'}</strong>
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        setImportStep(1);
                                        setPreviewResult(null);
                                        setParsedRows([]);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5 w-fit"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Ganti Berkas
                                </button>
                            </div>

                            {/* Summary Metrics Banner */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <span className="text-slate-500 text-[10px] block">Total Baris</span>
                                    <span className="text-base font-bold text-slate-900">{previewResult.summary.total_rows}</span>
                                </div>
                                {previewResult.import_type === 'NAKER' ? (
                                    <>
                                        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                                            <span className="text-purple-700 text-[10px] font-bold block">Akun QA (Middle Mgmt)</span>
                                            <span className="text-base font-bold text-purple-900">
                                                {previewResult.summary.qa_count ?? 0}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                            <span className="text-amber-700 text-[10px] font-bold block">Akun TL (Team Leader)</span>
                                            <span className="text-base font-bold text-amber-900">
                                                {previewResult.summary.tl_count ?? 0}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200">
                                            <span className="text-cyan-700 text-[10px] font-bold block">Akun Trainer (Pengampu)</span>
                                            <span className="text-base font-bold text-cyan-900">
                                                {previewResult.summary.trainer_count ?? 0}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                                            <span className="text-blue-700 text-[10px] font-bold block">CSO Agent Operasional</span>
                                            <span className="text-base font-bold text-blue-900">
                                                {previewResult.summary.cso_count ?? 0}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                                        <span className="text-purple-700 text-[10px] block">Redundan di Berkas</span>
                                        <span className="text-base font-bold text-purple-800">
                                            {previewResult.summary.file_duplicate_count ?? previewResult.summary.warning_count ?? 0}
                                        </span>
                                    </div>
                                )}
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <span className="text-emerald-700 text-[10px] block">Valid / Siap Tambah</span>
                                    <span className="text-base font-bold text-emerald-800">
                                        {previewResult.summary.new_count ?? previewResult.summary.valid_count ?? 0}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <span className="text-amber-700 text-[10px] block">Duplikat / Update</span>
                                    <span className="text-base font-bold text-amber-800">
                                        {previewResult.summary.update_count ?? previewResult.summary.duplicate_count ?? 0}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                                    <span className="text-red-700 text-[10px] block">Format Tidak Valid</span>
                                    <span className="text-base font-bold text-red-800">
                                        {previewResult.summary.invalid_count ?? previewResult.summary.error_count ?? 0}
                                    </span>
                                </div>
                            </div>

                            {/* Table Preview */}
                            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 text-xs shadow-inner">
                                {previewResult.import_type === 'NAKER' ? (
                                    /* NAKER PREVIEW TABLE */
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 uppercase tracking-wider text-[10px] border-b border-slate-200">
                                            <tr>
                                                <th className="p-2.5 w-10">#</th>
                                                <th className="p-2.5">Status Audit</th>
                                                <th className="p-2.5">Klasifikasi & Akun</th>
                                                <th className="p-2.5">Nama Personel</th>
                                                <th className="p-2.5">ID SIP</th>
                                                <th className="p-2.5 text-center">JK</th>
                                                <th className="p-2.5">Layanan</th>
                                                <th className="p-2.5">Team Leader</th>
                                                <th className="p-2.5">Trainer</th>
                                                <th className="p-2.5 text-center">Site</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewResult.items?.map((item) => (
                                                <tr key={item.row_index} className={`hover:bg-slate-50/80 transition-colors ${item.is_qa ? 'bg-purple-50/30' : item.is_tl ? 'bg-amber-50/30' : item.is_trainer ? 'bg-cyan-50/30' : ''}`}>
                                                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">{item.row_index}</td>
                                                    <td className="p-2.5">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${item.status === 'valid' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                                                item.status === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                                                    item.status === 'duplicate' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                                                                        'bg-red-50 text-red-800 border-red-300'
                                                            }`}>
                                                            {item.status.toUpperCase()}
                                                        </span>
                                                        {item.warning_message && (
                                                            <div className="text-[9px] text-amber-700 font-semibold mt-0.5">{item.warning_message}</div>
                                                        )}
                                                        {item.error_message && (
                                                            <div className="text-[9px] text-red-700 font-semibold mt-0.5">{item.error_message}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5">
                                                        {item.is_qa ? (
                                                            <div className="space-y-0.5">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                                                                    <Sparkles className="w-2.5 h-2.5 text-purple-700" />
                                                                    Akun QA Evaluator
                                                                </span>
                                                                <div className="text-[10px] text-purple-800 font-mono">
                                                                    {item.account_email || `${item.sip_id}@digiqa.id`}
                                                                </div>
                                                            </div>
                                                        ) : item.is_tl ? (
                                                            <div className="space-y-0.5">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                    <Users className="w-2.5 h-2.5 text-amber-700" />
                                                                    Akun TL (Team Leader)
                                                                </span>
                                                                <div className="text-[10px] text-amber-800 font-mono">
                                                                    {item.account_email || `${item.sip_id}@digiqa.id`}
                                                                </div>
                                                            </div>
                                                        ) : item.is_trainer ? (
                                                            <div className="space-y-0.5">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300">
                                                                    <GraduationCap className="w-2.5 h-2.5 text-cyan-700" />
                                                                    Akun Trainer (Pengampu)
                                                                </span>
                                                                <div className="text-[10px] text-cyan-800 font-mono">
                                                                    {item.account_email || `${item.sip_id}@digiqa.id`}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                                                CSO Agent
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                                                    <td className="p-2.5 font-mono text-[11px] text-purple-800 font-bold">{item.sip_id}</td>
                                                    <td className="p-2.5 text-center">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${item.gender === 'PRIA' ? 'bg-blue-50 text-blue-800' : 'bg-pink-50 text-pink-800'
                                                            }`}>
                                                            {item.gender}
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 font-medium text-slate-700">
                                                        {item.is_qa ? (
                                                            <span className="text-purple-900 font-semibold">{item.layanan}</span>
                                                        ) : item.is_tl ? (
                                                            <span className="text-amber-900 font-semibold">{item.layanan}</span>
                                                        ) : item.is_trainer ? (
                                                            <span className="text-cyan-900 font-semibold">{item.layanan}</span>
                                                        ) : (
                                                            item.layanan
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 text-slate-600">
                                                        {item.is_qa ? (
                                                            <span className="text-slate-400 italic">Non-TL (QA)</span>
                                                        ) : item.is_tl ? (
                                                            <span className="text-amber-800 font-semibold italic">Team Leader (Self)</span>
                                                        ) : item.is_trainer ? (
                                                            <span className="text-slate-400 italic">Non-TL (Trainer)</span>
                                                        ) : (
                                                            item.team_tl
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 text-slate-600">
                                                        {item.is_qa || item.is_tl ? (
                                                            <span className="text-slate-400 italic">Non-Trainer</span>
                                                        ) : item.is_trainer ? (
                                                            <span className="text-cyan-800 font-semibold italic">Trainer (Self)</span>
                                                        ) : (
                                                            item.trainer
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 text-center font-bold">{item.site}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (

                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 uppercase tracking-wider text-[10px] border-b border-slate-200">
                                            <tr>
                                                <th className="p-2.5 w-10">#</th>
                                                <th className="p-2.5">Status Audit</th>
                                                <th className="p-2.5">IDCA</th>
                                                <th className="p-2.5">Agent</th>
                                                <th className="p-2.5">Saluran</th>
                                                <th className="p-2.5">QA</th>
                                                <th className="p-2.5">Nilai CA (%)</th>
                                                <th className="p-2.5">FCR</th>
                                                <th className="p-2.5">Site</th>
                                                <th className="p-2.5 text-center">Status Mutu</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewResult.items?.map((item) => (
                                                <tr key={item.row_index} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">{item.row_index}</td>
                                                    <td className="p-2.5">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${item.row_type === 'update' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                                                item.row_type === 'file_duplicate' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                                                                    item.row_type === 'invalid' ? 'bg-red-50 text-red-800 border-red-300' :
                                                                        'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                            }`}>
                                                            {item.row_type ? item.row_type.replace('_', ' ').toUpperCase() : 'NEW'}
                                                        </span>
                                                        {item.error_message && (
                                                            <div className="text-[10px] text-red-700 font-semibold mt-0.5">{item.error_message}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 font-mono text-[11px] text-purple-800 font-bold">
                                                        {item.idca || '-'}
                                                    </td>
                                                    <td className="p-2.5">
                                                        <div className="font-bold text-slate-900">{item.name || item.agent_name || '(Tanpa Nama)'}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{item.nik || ''}</div>
                                                    </td>
                                                    <td className="p-2.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                            {item.channel || item.service_name || selectedChannel}
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 text-slate-700 text-[11px]">
                                                        {item.qa_name || '-'}
                                                    </td>
                                                    <td className="p-2.5 font-bold">
                                                        <span className={(item.ca ?? item.score_ca) >= 90 ? 'text-emerald-700' : 'text-red-700'}>
                                                            {item.ca ?? item.score_ca ?? 0}%
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 font-bold">
                                                        <span className={item.fcr === 'YA' ? 'text-emerald-700 font-black' : 'text-red-600 font-bold'}>
                                                            {item.fcr || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                                                        {item.site || 'SMG'}
                                                    </td>
                                                    <td className="p-2.5 text-center">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${(item.ca ?? item.score_ca) >= 96 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                                                (item.ca ?? item.score_ca) >= 85 ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                                                    'bg-red-50 text-red-800 border border-red-200'
                                                            }`}>
                                                            {item.status || ((item.ca ?? item.score_ca) >= 96 ? 'Exceed Target' : ((item.ca ?? item.score_ca) < 85 ? 'Need Coaching' : 'Meet Target'))}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Live Batch Progress Indicator (Anti-Crash Mode) */}
                            {importing && (
                                <div className="p-4 rounded-xl bg-blue-50/90 border border-blue-200 text-xs space-y-2.5 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between text-blue-900">
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 text-blue-700 animate-spin flex-shrink-0" />
                                            <span className="font-bold">
                                                Menginjeksi Data per Batch (Anti-Crash Mode): Batch {importProgress.currentBatch} dari {importProgress.totalBatches}
                                            </span>
                                        </div>
                                        <span className="font-black text-blue-900 font-mono text-sm">
                                            {importProgress.percent}%
                                        </span>
                                    </div>

                                    {/* Animated Progress Bar */}
                                    <div className="w-full bg-blue-200/80 h-3 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${Math.max(4, importProgress.percent)}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-blue-800 font-medium">
                                        <span>{importProgress.statusText}</span>
                                        <span className="font-bold">{importProgress.processedRows} / {importProgress.totalRows} baris</span>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                                <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5 font-medium">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Injeksi batch terisolasi (50 baris per transaksi) untuk mencegah crash dan overload.</span>
                                </div>

                                <div className="flex items-center gap-2.5 ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImportStep(1);
                                            setPreviewResult(null);
                                            setParsedRows([]);
                                        }}
                                        disabled={importing}
                                        className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                                    >
                                        Batal
                                    </button>

                                    <button
                                        type="button"
                                        onClick={submitImport}
                                        disabled={importing}
                                        className="btn-primary py-2 px-5 flex items-center gap-2"
                                    >
                                        {importing ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Memproses Batch ({importProgress.currentBatch}/{importProgress.totalBatches})...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>
                                                    Konfirmasi & Injeksi Data {previewResult.import_type || 'QSF'} ({previewResult.summary.total_rows} Baris)
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* STEP 3: FINISHED INJECTION VIEW */
                        <div className="p-8 text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Injeksi Data Berhasil!</h3>
                            <p className="text-xs text-slate-600 max-w-md mx-auto">
                                {importStatus.message}
                            </p>
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setImportStep(1);
                                        setParsedRows([]);
                                        setPreviewResult(null);
                                        setFileName('');
                                        setImportStatus({ type: '', message: '' });
                                    }}
                                    className="btn-primary"
                                >
                                    <Upload className="w-3.5 h-3.5" /> Import Berkas Lainnya
                                </button>
                                <button
                                    onClick={() => setActiveTab('data')}
                                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                                >
                                    Lihat Daftar Data Agen
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: FORMULIR INPUT MANUAL PER AGEN */}
            {activeTab === 'manual' && (
                <div className="corp-card p-6">
                    <div className="pb-4 border-b border-slate-100 mb-5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <PlusCircle className="w-4 h-4 text-purple-700" />
                            Entri Penilaian Agen Langsung (Direct Input)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Input data individu agen satu per satu dengan atribusi otomatis Role Supervisor.
                        </p>
                    </div>

                    <form onSubmit={handleManualSubmit} className="space-y-4 max-w-2xl text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Nama Lengkap Agent <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={manualForm.name}
                                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                                    placeholder="Contoh: Siti Nurhaliza"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    NIK / ID Agent <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={manualForm.nik}
                                    onChange={(e) => setManualForm({ ...manualForm, nik: e.target.value })}
                                    placeholder="Contoh: AGT-001"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Saluran / Channel QSF <span className="text-red-500">*</span>
                                </label>
                                <CustomSelect
                                    value={manualForm.channel}
                                    onChange={(e) => setManualForm({ ...manualForm, channel: e.target.value })}
                                    options={IMPORT_TYPES.filter(t => t.type === 'QSF').map(ch => ({ value: ch.id, label: ch.label }))}
                                    className="w-full"
                                    buttonClassName="bg-white border-slate-300 py-2 text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Nilai CA (%) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={manualForm.ca_score}
                                    onChange={(e) => setManualForm({ ...manualForm, ca_score: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Nilai FCR (%) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={manualForm.fcr_score}
                                    onChange={(e) => setManualForm({ ...manualForm, fcr_score: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Team Leader (TL)
                                </label>
                                <input
                                    type="text"
                                    value={manualForm.team_leader_name}
                                    onChange={(e) => setManualForm({ ...manualForm, team_leader_name: e.target.value })}
                                    placeholder="Contoh: Nama Team Leader (opsional)"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Trainer Pengampu
                                </label>
                                <input
                                    type="text"
                                    value={manualForm.trainer_name}
                                    onChange={(e) => setManualForm({ ...manualForm, trainer_name: e.target.value })}
                                    placeholder="Contoh: Nama Trainer (opsional)"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Jumlah Sesi Evaluasi
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={manualForm.evaluation_count}
                                    onChange={(e) => setManualForm({ ...manualForm, evaluation_count: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Periode Bulan
                                </label>
                                <input
                                    type="text"
                                    value={manualForm.period_month}
                                    onChange={(e) => setManualForm({ ...manualForm, period_month: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>
                        </div>

                        {/* Status Message */}
                        {manualStatus.message && (
                            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${manualStatus.type === 'error'
                                    ? 'bg-red-50 border border-red-200 text-red-800 font-semibold'
                                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold'
                                }`}>
                                {manualStatus.type === 'error' ? (
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                                )}
                                <span>{manualStatus.message}</span>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="submit"
                                disabled={manualSaving}
                                className="btn-primary text-xs disabled:opacity-50"
                            >
                                {manualSaving ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Menyimpan ke Database...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Simpan Nilai Agen (Role Supervisor)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB 3: DAFTAR DATA SALURAN TERINPUT */}
            {activeTab === 'data' && (
                <div className="corp-card overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari agen, NIK, atau TL..."
                                className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                            <CustomSelect
                                value={filterChannel}
                                onChange={(e) => setFilterChannel(e.target.value)}
                                options={[
                                    { value: 'all', label: 'Semua Saluran (5 Channels)' },
                                    ...IMPORT_TYPES.filter(t => t.type === 'QSF').map(ch => ({ value: ch.id, label: ch.label }))
                                ]}
                                className="w-full sm:w-60"
                                buttonClassName="bg-white border-slate-300 py-1.5 text-slate-800"
                            />

                            <span className="text-xs text-slate-600 font-semibold">
                                Total: <strong className="text-slate-900">{agentsList.length}</strong> Agen
                            </span>

                            {/* Export QSF dari database */}
                            <div className="flex items-center gap-1.5">
                                {IMPORT_TYPES.filter(t => t.type === 'QSF').map(ch => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => exportQsfToExcel(ch.name)}
                                        title={`Ekspor data assessment ${ch.name} dari database`}
                                        className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold transition flex items-center gap-1 shadow-2xs"
                                    >
                                        <Download className="w-3 h-3" />
                                        <span>{ch.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                            <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4 w-12">#</th>
                                    <th className="py-3 px-4">Nama & NIK</th>
                                    <th className="py-3 px-4">Saluran QSF</th>
                                    <th className="py-3 px-4">CA (%)</th>
                                    <th className="py-3 px-4">FCR (%)</th>
                                    <th className="py-3 px-4">Team Leader</th>
                                    <th className="py-3 px-4">Trainer</th>
                                    <th className="py-3 px-4 text-center">Status Mutu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingData ? (
                                    <tr>
                                        <td colSpan="8" className="py-8 text-center text-slate-500">
                                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-purple-600" />
                                            Memuat data agen...
                                        </td>
                                    </tr>
                                ) : agentsList.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-10 text-center">
                                            <div className="max-w-sm mx-auto text-center space-y-1">
                                                <p className="text-xs font-bold text-slate-800">Belum Ada Data Penilaian Terinput</p>
                                                <p className="text-[11px] text-slate-500">
                                                    Gunakan Tab Import Excel atau Form Input Manual untuk mengisi data QSF.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    agentsList.map((agent, index) => (
                                        <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{index + 1}</td>
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">{agent.name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{agent.nik}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                    {agent.channel || 'Inbound'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-bold">
                                                <span className={agent.ca >= 90 ? 'text-emerald-800' : 'text-red-700'}>{agent.ca}%</span>
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-800">{agent.fcr}%</td>
                                            <td className="py-3 px-4 text-slate-700">{agent.tl}</td>
                                            <td className="py-3 px-4 text-slate-700">{agent.trainer}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${agent.status === 'Exceed Target' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                                        agent.status === 'Meet Target' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                                            'bg-red-50 text-red-800 border border-red-200'
                                                    }`}>
                                                    {agent.status}
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

            {/* TAB: MASTER DATA NAKER (TENAGA KERJA) */}
            {activeTab === 'naker' && (
                <div className="space-y-4">
                    {/* NAKER Metrics Ribbon */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total NAKER</span>
                                <span className="text-lg font-black text-slate-900 leading-none">{nakerSummary.total_naker || nakerList.length}</span>
                                <span className="text-[9px] text-slate-500 block truncate">Personel Terdaftar</span>
                            </div>
                        </div>

                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold flex-shrink-0">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider block truncate">Akun QA (Middle Mgmt)</span>
                                <span className="text-lg font-black text-purple-900 leading-none">{nakerSummary.qa_count || 0}</span>
                                <span className="text-[9px] text-purple-600 font-semibold block truncate">QA Evaluator</span>
                            </div>
                        </div>

                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
                                <Users className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block truncate">Akun TL (Team Leader)</span>
                                <span className="text-lg font-black text-amber-900 leading-none">{nakerSummary.tl_count || 0}</span>
                                <span className="text-[9px] text-amber-600 font-semibold block truncate">Team Leader</span>
                            </div>
                        </div>

                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold flex-shrink-0">
                                <GraduationCap className="w-4 h-4 text-cyan-600" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-cyan-700 uppercase tracking-wider block truncate">Akun Trainer (Pengampu)</span>
                                <span className="text-lg font-black text-cyan-900 leading-none">{nakerSummary.trainer_count || 0}</span>
                                <span className="text-[9px] text-cyan-600 font-semibold block truncate">Trainer Coaching</span>
                            </div>
                        </div>

                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block truncate">CSO Agent Operasional</span>
                                <span className="text-lg font-black text-emerald-900 leading-none">{nakerSummary.cso_count || 0}</span>
                                <span className="text-[9px] text-emerald-600 font-semibold block truncate">Agent Pelayanan</span>
                            </div>
                        </div>

                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                                <UserCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block truncate">Tenaga Kerja Pria</span>
                                <span className="text-lg font-black text-indigo-900 leading-none">{nakerSummary.pria || 0}</span>
                                <span className="text-[9px] text-slate-500 block truncate">Laki-Laki (L)</span>
                            </div>
                        </div>

                        <div className="corp-card p-3 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center font-bold flex-shrink-0">
                                <UserCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block truncate">Tenaga Kerja Wanita</span>
                                <span className="text-lg font-black text-pink-900 leading-none">{nakerSummary.wanita || 0}</span>
                                <span className="text-[9px] text-slate-500 block truncate">Perempuan (P)</span>
                            </div>
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="corp-card overflow-hidden">
                        {/* Header & Filter Controls */}
                        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                            <div className="relative w-full lg:w-80">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchNaker}
                                    onChange={(e) => setSearchNaker(e.target.value)}
                                    placeholder="Cari nama, ID SIP, TL, atau Trainer..."
                                    className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                <CustomSelect
                                    value={filterNakerService}
                                    onChange={(e) => setFilterNakerService(e.target.value)}
                                    options={[
                                        { value: 'all', label: 'Semua Layanan Penugasan' },
                                        { value: 'QUALITY_ASSURANCE', label: 'Quality Assurance (Middle Mgmt)' },
                                        { value: 'TEAM_LEADER', label: 'Team Leader (TL)' },
                                        { value: 'TRAINER', label: 'Trainer Pengampu (Coaching)' },
                                        ...IMPORT_TYPES.filter(t => t.type === 'QSF').map(ch => ({ value: ch.name, label: ch.name }))
                                    ]}
                                    className="w-full sm:w-64"
                                    buttonClassName="bg-white border-slate-300 py-2 text-slate-800 shadow-sm font-semibold"
                                />

                                <CustomSelect
                                    value={filterNakerGender}
                                    onChange={(e) => setFilterNakerGender(e.target.value)}
                                    options={[
                                        { value: 'all', label: 'Semua Gender' },
                                        { value: 'PRIA', label: 'Pria (L)' },
                                        { value: 'WANITA', label: 'Wanita (P)' }
                                    ]}
                                    className="w-full sm:w-40"
                                    buttonClassName="bg-white border-slate-300 py-2 text-slate-800 shadow-sm"
                                />

                                <Link
                                    to="/kelola-akun"
                                    className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    <span>Injeksi Akun NAKER</span>
                                </Link>

                                <button
                                    type="button"
                                    onClick={exportNakerToExcel}
                                    className="px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Ekspor Excel (.xlsx)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={fetchNakerData}
                                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
                                    title="Segarkan data NAKER"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingNaker ? 'animate-spin text-blue-600' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                                <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4 w-12 text-center">#</th>
                                        <th className="py-3 px-4">Nama Tenaga Kerja</th>
                                        <th className="py-3 px-4">ID SIP / Username</th>
                                        <th className="py-3 px-4 text-center">Jenis Kelamin</th>
                                        <th className="py-3 px-4">Layanan Penugasan</th>
                                        <th className="py-3 px-4">Team Leader (TL)</th>
                                        <th className="py-3 px-4">Trainer Pengampu</th>
                                        <th className="py-3 px-4 text-center">Site</th>
                                        <th className="py-3 px-4 text-center">Status & Akun</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingNaker ? (
                                        <tr>
                                            <td colSpan="9" className="py-12 text-center text-slate-500">
                                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                                                <span>Memuat data master NAKER dari database...</span>
                                            </td>
                                        </tr>
                                    ) : nakerList.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="py-12 text-center text-slate-500">
                                                <div className="max-w-md mx-auto space-y-2">
                                                    <Users className="w-8 h-8 mx-auto text-slate-400" />
                                                    <p className="font-bold text-slate-800">Belum Ada Data Master NAKER</p>
                                                    <p className="text-xs text-slate-500">
                                                        Silakan unggah berkas <em>DATABASED ALL NAKER AGUSTUS 2026.xlsx</em> (sheet <em>PLOTTING</em>) melalui Tab Import Data.
                                                    </p>
                                                    <button
                                                        onClick={() => setActiveTab('import')}
                                                        className="btn-primary mt-2 text-xs"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" /> Unggah Database NAKER
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedNakerList.map((emp, index) => {
                                            const rowNum = (validNakerPage - 1) * (nakerPerPage === 'all' ? 0 : (parseInt(nakerPerPage, 10) || 15)) + index + 1;
                                            const isQa = emp.current_assignment?.service?.code === 'QUALITY_ASSURANCE' ||
                                                emp.current_assignment?.service?.name === 'Quality Assurance' ||
                                                emp.current_assignment?.service?.source_layanan_label?.includes('QUALITY ASSURANCE');
                                            const isTl = emp.current_assignment?.service?.code === 'TEAM_LEADER' ||
                                                emp.current_assignment?.service?.name === 'Team Leader' ||
                                                emp.current_assignment?.service?.source_layanan_label?.includes('TEAM LEADER') ||
                                                (emp.sip_id && String(emp.sip_id).startsWith('TL-'));
                                            const isTrainer = emp.current_assignment?.service?.code === 'TRAINER' ||
                                                emp.current_assignment?.service?.name === 'Trainer' ||
                                                emp.current_assignment?.service?.source_layanan_label?.includes('TRAINER') ||
                                                (emp.sip_id && String(emp.sip_id).startsWith('TRN-'));

                                            return (
                                                <tr key={emp.id} className={`hover:bg-slate-50/80 transition-colors ${isQa ? 'bg-purple-50/25' : isTl ? 'bg-amber-50/25' : isTrainer ? 'bg-cyan-50/25' : ''}`}>
                                                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] text-center">{rowNum}</td>
                                                    <td className="py-3 px-4 font-bold text-slate-900">
                                                        <div className="flex items-center gap-1.5">
                                                            {isQa && <Sparkles className="w-3 h-3 text-purple-600 flex-shrink-0" />}
                                                            {isTl && <Users className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                                                            {isTrainer && <GraduationCap className="w-3 h-3 text-cyan-600 flex-shrink-0" />}
                                                            <span>{emp.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-[11px] text-purple-800 font-bold">
                                                        {emp.sip_id}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${emp.gender === 'PRIA'
                                                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                                                : emp.gender === 'WANITA'
                                                                    ? 'bg-pink-50 text-pink-800 border-pink-200'
                                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                                            }`}>
                                                            {emp.gender || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {isQa ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-1">
                                                                Quality Assurance (Middle Mgmt)
                                                            </span>
                                                        ) : isTl ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                                                Team Leader (TL)
                                                            </span>
                                                        ) : isTrainer ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300 inline-flex items-center gap-1">
                                                                Trainer Pengampu (Coaching)
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                                                {emp.current_assignment?.service?.name || '-'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700">
                                                        {isQa ? (
                                                            <span className="text-purple-700 font-semibold text-[11px] italic">QA Evaluator (Non-TL)</span>
                                                        ) : isTl ? (
                                                            <span className="text-amber-800 font-semibold text-[11px] italic">Team Leader Operasional</span>
                                                        ) : isTrainer ? (
                                                            <span className="text-cyan-800 font-semibold text-[11px] italic">Trainer (Non-TL)</span>
                                                        ) : (
                                                            emp.current_assignment?.team_leader?.name || (
                                                                <span className="text-slate-400 italic">Non-TL</span>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700">
                                                        {isQa || isTl ? (
                                                            <span className="text-slate-400 italic">Non-Trainer</span>
                                                        ) : isTrainer ? (
                                                            <span className="text-cyan-800 font-semibold text-[11px] italic">Trainer Operasional</span>
                                                        ) : (
                                                            emp.current_assignment?.trainer?.name || (
                                                                <span className="text-slate-400 italic">Non-Trainer</span>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                                                        {emp.current_assignment?.site?.code || 'SMG'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {isQa ? (
                                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                                                AKUN QA AKTIF
                                                            </span>
                                                        ) : isTl ? (
                                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                                AKUN TL AKTIF
                                                            </span>
                                                        ) : isTrainer ? (
                                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                                                                AKUN TRAINER AKTIF
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                {emp.status === 'active' ? 'AKTIF' : emp.status.toUpperCase()}
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

                        {/* Pagination Controls Bar */}
                        {totalNakerItems > 0 && (
                            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                {/* Left side: Info count */}
                                <div className="text-slate-600 font-semibold flex items-center gap-1">
                                    <span>Menampilkan</span>
                                    <strong className="text-slate-900">{nakerStartIndex} - {nakerEndIndex}</strong>
                                    <span>dari</span>
                                    <strong className="text-slate-900">{totalNakerItems}</strong>
                                    <span>data NAKER</span>
                                    {totalNakerPages > 1 && (
                                        <span className="text-slate-400 font-normal">
                                            • Halaman {validNakerPage} dari {totalNakerPages}
                                        </span>
                                    )}
                                </div>

                                {/* Middle: Page Size Selector */}
                                <div className="flex items-center gap-2 text-slate-600">
                                    <span className="text-[11px] font-medium whitespace-nowrap">Baris per halaman:</span>
                                    <CustomSelect
                                        value={nakerPerPage}
                                        onChange={(e) => {
                                            setNakerPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10));
                                            setNakerPage(1);
                                        }}
                                        options={[
                                            { value: 10, label: '10' },
                                            { value: 15, label: '15' },
                                            { value: 25, label: '25' },
                                            { value: 50, label: '50' },
                                            { value: 100, label: '100' },
                                            { value: 'all', label: `Semua (${totalNakerItems})` }
                                        ]}
                                        direction="up"
                                        className="w-28 sm:w-32"
                                        buttonClassName="bg-white border-slate-300 py-1 px-2.5 text-xs font-bold text-slate-800 shadow-2xs"
                                    />
                                </div>

                                {/* Right: Page Navigation Buttons */}
                                {totalNakerPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={validNakerPage <= 1}
                                            onClick={() => setNakerPage(1)}
                                            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition shadow-2xs"
                                            title="Halaman Pertama"
                                        >
                                            <ChevronsLeft className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            type="button"
                                            disabled={validNakerPage <= 1}
                                            onClick={() => setNakerPage(p => Math.max(1, p - 1))}
                                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition flex items-center gap-1 shadow-2xs"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Sebelumnya</span>
                                        </button>

                                        {/* Numeric Buttons */}
                                        <div className="flex items-center gap-1 px-0.5">
                                            {Array.from({ length: Math.min(5, totalNakerPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalNakerPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (validNakerPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (validNakerPage >= totalNakerPages - 2) {
                                                    pageNum = totalNakerPages - 4 + i;
                                                } else {
                                                    pageNum = validNakerPage - 2 + i;
                                                }

                                                const isActive = validNakerPage === pageNum;
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        type="button"
                                                        onClick={() => setNakerPage(pageNum)}
                                                        className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${isActive
                                                                ? 'bg-blue-600 text-white shadow-xs'
                                                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            disabled={validNakerPage >= totalNakerPages}
                                            onClick={() => setNakerPage(p => Math.min(totalNakerPages, p + 1))}
                                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition flex items-center gap-1 shadow-2xs"
                                        >
                                            <span className="hidden sm:inline">Berikutnya</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            type="button"
                                            disabled={validNakerPage >= totalNakerPages}
                                            onClick={() => setNakerPage(totalNakerPages)}
                                            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition shadow-2xs"
                                            title="Halaman Terakhir"
                                        >
                                            <ChevronsRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
