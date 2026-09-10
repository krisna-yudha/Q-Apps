import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Check,
  X,
  Copy,
  TrendingUp,
  Award,
  Sparkles,
  RefreshCw,
  UserCheck,
  Send,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  CheckSquare,
  CheckCheck,
  Activity,
  LayoutGrid,
  Users,
  Eye,
  ArrowRightLeft,
  ChevronRight,
  Filter,
  BarChart3,
  Layers,
  Inbox,
  AlertCircle,
  Calendar,
  CalendarDays,
  Flame,
  ShieldAlert,
  HelpCircle,
  Pause,
  Save,
  AlertOctagon,
  SkipForward
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { CustomSelect } from '../components/common/CustomSelect';

// Official Master CA Parameters Per Channel (CC ICONNET Standard)
const OFFICIAL_PARAMETERS = {
  DIGILIVE: [
    { code: '1.1', name: 'Menggunakan Salam Pembuka Sesuai Standar', weight: 5 },
    { code: '2.1', name: 'Pemilihan Kata', weight: 5 },
    { code: '2.2', name: 'Pemilihan Kalimat', weight: 5 },
    { code: '2.3', name: 'Penggunaan Tanda Baca', weight: 5 },
    { code: '3.1', name: 'Konfirmasi Kejelasan Informasi & Menawarkan Bantuan Berikutnya Secara Terstruktur', weight: 5 },
    { code: '4.1', name: 'Menggunakan Salam Penutup Sesuai Standar', weight: 5 },
    { code: '5.1', name: 'Cepat dan Tanggap Menangani Pelanggan', weight: 5 },
    { code: '5.2', name: 'Proses Hold Sesuai Ketentuan', weight: 5 },
    { code: '5.3', name: 'Alur Transaksi Sesuai Ketentuan', weight: 5 },
    { code: '6.1', name: 'Menunjukan Empati atau Apresiasi', weight: 5 },
    { code: '6.2', name: 'Etika Pelayanan', weight: 5 },
    { code: '7.1', name: 'Aktif Menyebutkan Nama Pelapor', weight: 5 },
    { code: '8.1', name: 'Menanyakan Permasalahan Pelanggan, Data Inti dan/atau Data Pendukung', weight: 10 },
    { code: '8.2', name: 'Menanyakan Secara Terstruktur', weight: 5 },
    { code: '9.1', name: 'Verifikasi Data Sesuai Dengan Tahapan dan Ketentuan serta Menjaga Kerahasian Data', weight: 10 },
    { code: '9.2', name: 'Akad Transaksi', weight: 5 },
    { code: '10.1', name: 'Ketepatan Informasi/Solusi', weight: 5 },
    { code: '10.2', name: 'Kesesuaian Pencatatan', weight: 5 }
  ],
  INBOUND: [
    { code: '1', name: 'Salam Pembuka', weight: 5 },
    { code: '2', name: 'Verifikasi Data Pelanggan/ Konfirmasi Data Non Pelanggan', weight: 10 },
    { code: '3', name: 'Menyimak Permintaan Pelanggan atau Non Pelanggan', weight: 5 },
    { code: '4', name: 'Probing', weight: 10 },
    { code: '5', name: 'Intonasi, Volume, Kejelasan Ucapan & Kecepatan Berbicara', weight: 10 },
    { code: '6', name: 'Penggunaan Kata & Kalimat', weight: 5 },
    { code: '7', name: 'Magic Word', weight: 5 },
    { code: '8', name: 'Akurasi Informasi / Solusi', weight: 15 },
    { code: '9', name: 'Menyebut Nama Pelanggan atau Non Pelanggan', weight: 5 },
    { code: '10', name: 'Akad Transaksi', weight: 5 },
    { code: '11', name: 'Konfirmasi Kejelasan Informasi & Menawarkan Bantuan Berikutnya', weight: 5 },
    { code: '12', name: 'Etika Berkomunikasi', weight: 5 },
    { code: '13', name: 'Pencatatan CRM', weight: 10 },
    { code: '14', name: 'Salam Penutup', weight: 5 }
  ],
  EMAIL: [
    { code: '1', name: 'Sapa nama pelanggan', weight: 5 },
    { code: '2', name: 'Salam Pembuka', weight: 5 },
    { code: '3', name: 'Konfirmasi Email', weight: 5 },
    { code: '4', name: 'Identifikasi Email (Nomor/ ID Tiket)', weight: 5 },
    { code: '5', name: 'Penggunaan Bahasa yang Sesuai', weight: 5 },
    { code: '6', name: 'Cara penulisan CSO dalam membalas e-mail', weight: 10 },
    { code: '7', name: 'Informasi kanal lain', weight: 5 },
    { code: '8', name: 'Salam penutup email', weight: 5 },
    { code: '9', name: 'Emphaty/ Apreciation', weight: 5 },
    { code: '10', name: 'Etika/kesopanan', weight: 5 },
    { code: '11', name: 'Validasi data pelanggan', weight: 10 },
    { code: '12', name: 'Akad Transaksi', weight: 5 },
    { code: '13', name: 'Kemampuan Probing', weight: 10 },
    { code: '14', name: 'Informasi/Solusi', weight: 15 },
    { code: '15', name: 'Kesesuaian Pencatatan CRM', weight: 10 }
  ],
  SOSMED: [
    { code: '1', name: 'Sapa Nama Pemilik Akun', weight: 10 },
    { code: '2', name: 'Kreatifitas Kalimat', weight: 10 },
    { code: '3', name: 'Kemampuan Menyimak', weight: 15 },
    { code: '4', name: 'Memberikan Solusi Lengkap dan Akurat', weight: 20 },
    { code: '5', name: 'Empati atau Apresiasi', weight: 15 },
    { code: '6', name: 'Kemampuan Menulis', weight: 10 },
    { code: '7', name: 'Melakukan Pencatatan CRM', weight: 10 },
    { code: '8', name: 'Kesesuaian Pencatatan CRM', weight: 10 }
  ],
  OUTBOUND_CALL: [
    { code: '1', name: 'Salam Pembuka', weight: 5 },
    { code: '2', name: 'Verifikasi Data Pelanggan/ Konfirmasi Data Non Pelanggan', weight: 10 },
    { code: '3', name: 'Menyimak Informasi Pelanggan', weight: 5 },
    { code: '4', name: 'Kemampuan Negosiasi atau Cara Konfirmasi', weight: 10 },
    { code: '5', name: 'Intonasi, Volume, Kejelasan Ucapan & Kecepatan Berbicara', weight: 10 },
    { code: '6', name: 'Penggunaan Kata & Kalimat', weight: 5 },
    { code: '7', name: 'Etika Komunikasi', weight: 5 },
    { code: '8', name: 'Kelengkapan Informasi', weight: 15 },
    { code: '9', name: 'Menyebut Nama Pelanggan atau Non Pelanggan', weight: 5 },
    { code: '10', name: 'Konfirmasi Kejelasan Informasi', weight: 5 },
    { code: '11', name: 'Pencatatan CRM', weight: 15 },
    { code: '12', name: 'Salam Penutup', weight: 5 }
  ],
  EMAIL_OUTBOUND: [
    { code: '1', name: 'Ketidaksesuaian prosedur Outbound (CSO sudah menghubungi pelanggan sebanyak 3 kali melalui telepon)', weight: 10 },
    { code: '2', name: 'Sapa nama pelanggan', weight: 5 },
    { code: '3', name: 'Salam Pembuka', weight: 5 },
    { code: '4', name: 'Konfirmasi Laporan', weight: 5 },
    { code: '5', name: 'Identifikasi Email (Nomor/ ID Tiket)', weight: 5 },
    { code: '6', name: 'Penggunaan Bahasa yang Sesuai', weight: 5 },
    { code: '7', name: 'Cara penulisan CSO', weight: 10 },
    { code: '8', name: 'Informasi kanal lain', weight: 5 },
    { code: '9', name: 'Salam penutup email', weight: 5 },
    { code: '10', name: 'Emphaty/ Apreciation', weight: 5 },
    { code: '11', name: 'Etika/ Kesopanan', weight: 5 },
    { code: '12', name: 'Validasi data pelanggan', weight: 10 },
    { code: '13', name: 'Kelengkapan Informasi/Solusi', weight: 10 },
    { code: '14', name: 'Pencatatan CRM', weight: 10 },
    { code: '15', name: 'Kesesuaian pengisian CRM', weight: 5 }
  ],
  BACK_OFFICE: [
    { code: '1', name: 'Kesesuaian Analisa', weight: 40 },
    { code: '2', name: 'Kesesuaian Pencatatan dan Ketepatan Bidang Eskalasi', weight: 40 },
    { code: '3', name: 'Penggunaan Kalimat', weight: 20 }
  ]
};

// Helper: Clean CRM operational prefixes from agent names
const formatAgentName = (name = '') => {
  if (!name) return '-';
  return String(name)
    .replace(/^[A-Z0-9._-]+\//i, '')
    .replace(/^[A-Z0-9._-]+_/i, '')
    .replace(/^(OB|IB|CSO|AS|BO)[\s._0-9]+\s*/i, '')
    .replace(/^(FL|OPHAR)[\s._0-9A-Za-z-]*-\s*/i, '')
    .replace(/^[-._\s:]+/, '')
    .trim() || String(name);
};

// Helper: Normalize Channel String to Parameter Key
const normalizeChannelKey = (channelStr = '') => {
  const c = String(channelStr).toLowerCase();
  if (c.includes('digilive') || c.includes('chat') || c.includes('live')) return 'DIGILIVE';
  if (c.includes('socmed') || c.includes('sosmed') || c.includes('instagram') || c.includes('media')) return 'SOSMED';
  if (c.includes('email outbound') || c.includes('outbound email')) return 'EMAIL_OUTBOUND';
  if (c.includes('email')) return 'EMAIL';
  if (c.includes('outbound call') || c.includes('obc') || c.includes('outbound')) return 'OUTBOUND_CALL';
  if (c.includes('back office') || c.includes('bo') || c.includes('eskalasi')) return 'BACK_OFFICE';
  return 'INBOUND';
};

export const QASamplingWorksheet = () => {
  const { user } = useAuth();
  const { showAlert, showToast } = useDialog();

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';
  const currentEvaluatorName = user?.name || 'ALMIRA PARAMITHA';

  // View Mode: For supervisor default to 'monitoring', can switch to 'audit' or 'worksheet'
  const [viewMode, setViewMode] = useState(isSupervisor ? 'monitoring' : 'worksheet');

  // Selected QA Evaluator for worksheet filtering (Supervisor can choose specific QA or 'all')
  const [selectedQaEvaluator, setSelectedQaEvaluator] = useState(isSupervisor ? 'all' : currentEvaluatorName);

  // Filters & State
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Monitoring State (For Supervisor Real-Time)
  const [monitoringData, setMonitoringData] = useState({
    summary: {},
    evaluators: [],
    skipped_tickets: []
  });
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [monitoringFilter, setMonitoringFilter] = useState('all'); // 'all' | 'in_progress' | 'assigned' | 'completed'
  const [monitoringSearch, setMonitoringSearch] = useState('');

  // Audit State (For Supervisor Date / Week Tracking & Abandoned Work Audit)
  const [auditData, setAuditData] = useState({
    summary: {},
    evaluators: [],
    weekly_matrix: [],
    dates_list: [],
    skipped_tickets: []
  });
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSubTab, setAuditSubTab] = useState('weekly'); // 'weekly' | 'daily' | 'findings' | 'skipped'
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSkipReasonFilter, setAuditSkipReasonFilter] = useState('all');
  const [selectedDailyDate, setSelectedDailyDate] = useState('all');

  // Tickets & Stats (For Worksheet)
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    target_quota: 370,
    total_bucket: 0,
    completed: 0,
    in_progress: 0,
    assigned: 0,
    skipped: 0,
    achievement_pct: 0.0
  });
  const [loading, setLoading] = useState(true);

  // Active Ticket Selection & Evaluation Form
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [paramScores, setParamScores] = useState({}); // { [paramCode]: true (100) | false (0) }
  const [fcrValue, setFcrValue] = useState('YA');
  const [evaluationNotes, setEvaluationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [holding, setHolding] = useState(false);

  // Skip Modal
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('Recording Kosong / Silent Call');
  const [customSkipReason, setCustomSkipReason] = useState('');

  // Reassign Modal (Supervisor feature)
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTicketTarget, setReassignTicketTarget] = useState(null);
  const [reassignForm, setReassignForm] = useState({
    to_evaluator: '',
    reason: 'Pemerataan Beban Sampling Mutu',
    reassigned_by: user?.name || 'Supervisor QA'
  });
  const [reassigning, setReassigning] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch Functions
  // -------------------------------------------------------------------------

  // Fetch Supervisor Monitoring Data (Silent background reload option)
  const fetchMonitoringData = async (silent = false) => {
    if (!isSupervisor) return;
    try {
      if (!silent && (!monitoringData.evaluators || monitoringData.evaluators.length === 0)) {
        setLoadingMonitoring(true);
      }
      const res = await api.getSamplingQaMonitoring(selectedMonth);
      if (res && res.success) {
        setMonitoringData({
          summary: res.summary || {},
          evaluators: res.evaluators || [],
          skipped_tickets: res.skipped_tickets || []
        });
      }
    } catch (err) {
      console.error('Error fetching QA monitoring data:', err);
    } finally {
      if (!silent) setLoadingMonitoring(false);
    }
  };

  // Fetch Supervisor Audit & Date/Week Performance Data
  const fetchAuditData = async (silent = false) => {
    if (!isSupervisor) return;
    try {
      if (!silent && (!auditData.evaluators || auditData.evaluators.length === 0)) {
        setLoadingAudit(true);
      }
      const res = await api.getSamplingQaAuditPerformance(selectedMonth);
      if (res && res.success) {
        setAuditData({
          summary: res.summary || {},
          evaluators: res.evaluators || [],
          weekly_matrix: res.weekly_matrix || [],
          dates_list: res.dates_list || [],
          skipped_tickets: res.skipped_tickets || []
        });
      }
    } catch (err) {
      console.error('Error fetching QA audit data:', err);
    } finally {
      if (!silent) setLoadingAudit(false);
    }
  };

  // Fetch Assigned Tickets for Worksheet
  const fetchMyTickets = async (autoSelectId = null, silent = false) => {
    try {
      if (!silent && (!tickets || tickets.length === 0)) {
        setLoading(true);
      }

      let evaluatorParam = undefined;
      if (isSupervisor) {
        evaluatorParam = selectedQaEvaluator !== 'all' ? selectedQaEvaluator : undefined;
      } else {
        evaluatorParam = currentEvaluatorName;
      }

      const res = await api.getSamplingBucketTickets({
        period: selectedMonth,
        evaluator: evaluatorParam,
        status: statusFilter === 'all' ? undefined : statusFilter,
        channel: channelFilter !== 'all' ? channelFilter : undefined,
        search: search || undefined,
        per_page: 200
      });

      if (res && res.success) {
        const list = res.data || [];
        setTickets(list);
        if (res.stats) {
          setStats(res.stats);
        }

        // Determine which ticket should be selected
        if (autoSelectId) {
          const found = list.find(t => t.id === autoSelectId);
          if (found) {
            initTicketForm(found, false);
          }
        } else {
          // If there is an active in-progress ticket, select it
          const inProgress = list.find(t => t.status === 'IN_PROGRESS');
          if (inProgress) {
            if (!selectedTicket || selectedTicket.id !== inProgress.id) {
              initTicketForm(inProgress, false);
            } else {
              setSelectedTicket(inProgress);
            }
          } else if (selectedTicket && selectedTicket.status !== 'COMPLETED' && selectedTicket.status !== 'SKIPPED') {
            const current = list.find(t => t.id === selectedTicket.id);
            if (current) {
              setSelectedTicket(current);
            } else if (list.length > 0) {
              const nextUncompleted = list.find(t => t.status === 'ASSIGNED' || t.status === 'PENDING') || list[0];
              initTicketForm(nextUncompleted, false);
            }
          } else if (list.length > 0) {
            const nextUncompleted = list.find(t => t.status === 'ASSIGNED' || t.status === 'PENDING') || list[0];
            initTicketForm(nextUncompleted, false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching QA sampling tickets:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial and reactive data fetching
  useEffect(() => {
    if (isSupervisor) {
      fetchMonitoringData();
      fetchAuditData();
    }
  }, [selectedMonth, isSupervisor]);

  useEffect(() => {
    fetchMyTickets();
  }, [selectedMonth, selectedQaEvaluator, statusFilter, channelFilter, search]);

  // Live Auto-Refresh Listener (Silent in-place update)
  useEffect(() => {
    const handleSync = () => {
      if (isSupervisor) {
        fetchMonitoringData(true);
        fetchAuditData(true);
      }
      fetchMyTickets(null, true);
    };
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedMonth, isSupervisor, selectedQaEvaluator]);

  // Handle Switch to QA Worksheet from Monitoring Card or Audit Card
  const handleOpenQaWorksheet = (qaName) => {
    setSelectedQaEvaluator(qaName);
    setViewMode('worksheet');
    setSelectedTicket(null);
    showToast(`Membuka lembar kerja sampling QA: ${qaName}`);
  };

  // Handle Ticket Selection & Init Form
  const initTicketForm = (ticket, shouldAutoStart = true) => {
    setSelectedTicket(ticket);
    const channelKey = normalizeChannelKey(ticket.channel);
    const paramsList = OFFICIAL_PARAMETERS[channelKey] || OFFICIAL_PARAMETERS.INBOUND;

    const initScores = {};
    paramsList.forEach(p => {
      initScores[p.code] = true;
    });

    setParamScores(initScores);
    setFcrValue(ticket.fcr ? ticket.fcr.toUpperCase() : 'YA');
    setEvaluationNotes('');

    // If shouldAutoStart is true and ticket status is ASSIGNED, start it (IN_PROGRESS)
    if (shouldAutoStart && ticket.status === 'ASSIGNED') {
      setSelectedTicket(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'IN_PROGRESS' } : t));
      api.startSamplingAssignment(ticket.id).then(() => {
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }).catch(() => { });
    }
  };

  const handleSelectTicket = (ticket) => {
    // If ticket was PENDING (Ditunda), don't force auto-start immediately until QA resumes or edits
    if (ticket.status === 'PENDING') {
      initTicketForm(ticket, false);
    } else {
      initTicketForm(ticket, true);
    }
  };

  // Hold / Pause Ticket Evaluation
  const handleHoldTicket = async () => {
    if (!selectedTicket) return;
    setHolding(true);
    try {
      const res = await api.holdSamplingAssignment(selectedTicket.id);
      if (res?.success) {
        showToast(`Penilaian tiket #${selectedTicket.ticket_id} berhasil ditunda (Status: Ditunda). Anda dapat memilih tiket lain.`);
        setSelectedTicket(prev => prev ? { ...prev, status: 'PENDING' } : null);
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'PENDING' } : t));
        fetchMyTickets(selectedTicket.id, true);
        if (isSupervisor) {
          fetchMonitoringData(true);
          fetchAuditData(true);
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menunda penilaian tiket', 'error');
      }
    } catch (err) {
      showToast('Gagal menunda penilaian tiket', 'error');
    } finally {
      setHolding(false);
    }
  };

  // Resume / Start Ticket Evaluation
  const handleResumeTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await api.startSamplingAssignment(selectedTicket.id);
      if (res?.success) {
        showToast(`Melanjutkan penilaian tiket #${selectedTicket.ticket_id}`);
        setSelectedTicket(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'IN_PROGRESS' } : t));
        fetchMyTickets(selectedTicket.id, true);
        if (isSupervisor) {
          fetchMonitoringData(true);
          fetchAuditData(true);
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }
    } catch (err) {
      showToast('Gagal memulai penilaian tiket', 'error');
    }
  };

  // Toggle Parameter Score
  const handleToggleParam = (paramCode, passed) => {
    setParamScores(prev => ({
      ...prev,
      [paramCode]: passed
    }));
  };

  // Set All Parameters Sesuai (100%)
  const handleSetAllPassed = () => {
    const channelKey = normalizeChannelKey(selectedTicket?.channel);
    const paramsList = OFFICIAL_PARAMETERS[channelKey] || OFFICIAL_PARAMETERS.INBOUND;
    const allOk = {};
    paramsList.forEach(p => { allOk[p.code] = true; });
    setParamScores(allOk);
    showToast('✓ Seluruh parameter diatur SESUAI (100%)');
  };

  // Set All Parameters Deviasi (0%)
  const handleSetAllDeviasi = () => {
    const channelKey = normalizeChannelKey(selectedTicket?.channel);
    const paramsList = OFFICIAL_PARAMETERS[channelKey] || OFFICIAL_PARAMETERS.INBOUND;
    const allDeviasi = {};
    paramsList.forEach(p => { allDeviasi[p.code] = false; });
    setParamScores(allDeviasi);
    showToast('✕ Seluruh parameter diatur DEVIASI (0%)', 'warning');
  };

  // Quick Coaching Template
  const handleAddTemplateNote = (templateText) => {
    setEvaluationNotes(prev => prev ? `${prev} | ${templateText}` : templateText);
  };

  // Calculate Real-Time Score CA
  const calculateCurrentScore = () => {
    if (!selectedTicket) return 100;
    const channelKey = normalizeChannelKey(selectedTicket.channel);
    const paramsList = OFFICIAL_PARAMETERS[channelKey] || OFFICIAL_PARAMETERS.INBOUND;

    let totalWeight = 0;
    let earnedWeight = 0;

    paramsList.forEach(p => {
      totalWeight += p.weight;
      if (paramScores[p.code] !== false) {
        earnedWeight += p.weight;
      }
    });

    if (totalWeight === 0) return 100;
    return Math.round((earnedWeight / totalWeight) * 1000) / 10;
  };

  const calculatedScore = calculateCurrentScore();

  // Submit Evaluation (Complete)
  const handleSubmitEvaluation = async () => {
    if (!selectedTicket) return;
    const currentTicketId = selectedTicket.ticket_id;
    const currentId = selectedTicket.id;

    try {
      setSubmitting(true);
      const res = await api.completeSamplingAssignment(selectedTicket.id, {
        score_ca: calculatedScore,
        fcr: fcrValue,
        notes: evaluationNotes || 'Penilaian sampling selesai sesuai SOP.'
      });

      if (res.success) {
        // Find next uncompleted ticket in the queue
        const currentIndex = tickets.findIndex(t => t.id === currentId);
        const remainingTickets = tickets.filter(t => t.id !== currentId && t.status !== 'COMPLETED' && t.status !== 'SKIPPED');
        
        let nextTicket = null;
        if (currentIndex !== -1) {
          nextTicket = tickets.find((t, idx) => idx > currentIndex && t.id !== currentId && t.status !== 'COMPLETED' && t.status !== 'SKIPPED');
        }
        if (!nextTicket && remainingTickets.length > 0) {
          nextTicket = remainingTickets[0];
        }

        // Update local ticket item status immediately
        setTickets(prev => prev.map(t => t.id === currentId ? {
          ...t,
          status: 'COMPLETED',
          score_ca: calculatedScore,
          fcr: fcrValue
        } : t));

        if (nextTicket) {
          initTicketForm(nextTicket, true);
          showToast(`✓ Nilai tiket #${currentTicketId} (${calculatedScore}% CA) disimpan. Melanjutkan ke tiket #${nextTicket.ticket_id}`);
          fetchMyTickets(nextTicket.id, true);
        } else {
          setSelectedTicket(null);
          showToast(`✓ Nilai tiket #${currentTicketId} (${calculatedScore}% CA) disimpan. Seluruh tiket kuota telah selesai dinilai!`);
          fetchMyTickets(null, true);
        }

        if (isSupervisor) {
          fetchMonitoringData(true);
          fetchAuditData(true);
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Menyimpan Penilaian',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Skip Ticket
  const handleSkipTicket = async () => {
    if (!selectedTicket) return;
    const currentTicketId = selectedTicket.ticket_id;
    const currentId = selectedTicket.id;
    const finalReason = skipReason === 'Lainnya' ? customSkipReason : skipReason;
    if (!finalReason) {
      showAlert({ title: 'Alasan Wajib Diisi', message: 'Silakan tentukan alasan lewati tiket.', type: 'warning' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.skipSamplingAssignment(selectedTicket.id, finalReason);
      if (res.success) {
        setShowSkipModal(false);

        // Find next uncompleted ticket
        const currentIndex = tickets.findIndex(t => t.id === currentId);
        const remainingTickets = tickets.filter(t => t.id !== currentId && t.status !== 'COMPLETED' && t.status !== 'SKIPPED');
        
        let nextTicket = null;
        if (currentIndex !== -1) {
          nextTicket = tickets.find((t, idx) => idx > currentIndex && t.id !== currentId && t.status !== 'COMPLETED' && t.status !== 'SKIPPED');
        }
        if (!nextTicket && remainingTickets.length > 0) {
          nextTicket = remainingTickets[0];
        }

        setTickets(prev => prev.map(t => t.id === currentId ? { ...t, status: 'SKIPPED' } : t));

        if (nextTicket) {
          initTicketForm(nextTicket, true);
          showToast(`Tiket #${currentTicketId} dilewati (SKIPPED). Membuka tiket #${nextTicket.ticket_id}`);
          fetchMyTickets(nextTicket.id, true);
        } else {
          setSelectedTicket(null);
          showToast(`Tiket #${currentTicketId} dilewati (SKIPPED).`);
          fetchMyTickets(null, true);
        }

        if (isSupervisor) {
          fetchMonitoringData(true);
          fetchAuditData(true);
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Melewati Tiket',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reassign Ticket (Supervisor Feature)
  const handleOpenReassignModal = (ticket) => {
    setReassignTicketTarget(ticket);
    const availableQas = monitoringData.evaluators
      .map(e => e.evaluator_name)
      .filter(name => name !== (ticket.evaluator_name || selectedQaEvaluator));

    setReassignForm({
      to_evaluator: availableQas[0] || 'DEWI RIKA IRAWATI',
      reason: 'Pemerataan Beban Kerja Sampling Mutu',
      reassigned_by: user?.name || 'Supervisor QA'
    });
    setShowReassignModal(true);
  };

  const handleConfirmReassign = async () => {
    if (!reassignTicketTarget || !reassignForm.to_evaluator) return;
    try {
      setReassigning(true);
      const res = await api.reassignSamplingAssignment(reassignTicketTarget.id, reassignForm);
      if (res && res.success) {
        showToast(`✓ Tiket #${reassignTicketTarget.ticket_id} berhasil dipindahkan ke ${reassignForm.to_evaluator}`);
        setShowReassignModal(false);
        fetchMyTickets(null, true);
        fetchMonitoringData(true);
        fetchAuditData(true);
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Memindahkan Tiket',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setReassigning(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Tersalin ke clipboard: ${text}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeChannelKey = selectedTicket ? normalizeChannelKey(selectedTicket.channel) : 'INBOUND';
  const activeParameters = OFFICIAL_PARAMETERS[activeChannelKey] || OFFICIAL_PARAMETERS.INBOUND;

  // Filtered QA Evaluators for Monitoring Tab
  const filteredEvaluators = monitoringData.evaluators.filter((qa) => {
    const matchSearch = !monitoringSearch || qa.evaluator_name.toLowerCase().includes(monitoringSearch.toLowerCase());
    if (!matchSearch) return false;

    if (monitoringFilter === 'in_progress') return qa.in_progress_count > 0;
    if (monitoringFilter === 'assigned') return qa.assigned_count > 0;
    if (monitoringFilter === 'skipped') return (qa.skipped_count || 0) > 0;
    if (monitoringFilter === 'completed') return qa.completed_count >= qa.target_quota && qa.target_quota > 0;
    return true;
  });

  // Skipped tickets source (from monitoringData or auditData fallback)
  const allSkippedTickets = (monitoringData.skipped_tickets && monitoringData.skipped_tickets.length > 0)
    ? monitoringData.skipped_tickets
    : (auditData.skipped_tickets || []);

  const filteredMonitoringSkippedTickets = allSkippedTickets.filter((item) => {
    const q = (monitoringSearch || '').toLowerCase();
    const matchSearch = !q ||
      item.ticket_id?.toLowerCase().includes(q) ||
      item.evaluator_name?.toLowerCase().includes(q) ||
      item.agent_name?.toLowerCase().includes(q) ||
      item.agent_nik?.toLowerCase().includes(q) ||
      item.skip_reason?.toLowerCase().includes(q) ||
      item.channel?.toLowerCase().includes(q);

    return matchSearch;
  });
  const filteredAuditEvaluators = auditData.evaluators.filter((qa) => {
    const matchSearch = !auditSearch || qa.evaluator_name.toLowerCase().includes(auditSearch.toLowerCase());
    return matchSearch;
  });

  // Filtered Skipped Tickets for Audit Tab
  const filteredSkippedTickets = (auditData.skipped_tickets || []).filter((item) => {
    const q = auditSearch.toLowerCase();
    const matchSearch = !q ||
      item.ticket_id?.toLowerCase().includes(q) ||
      item.evaluator_name?.toLowerCase().includes(q) ||
      item.agent_name?.toLowerCase().includes(q) ||
      item.agent_nik?.toLowerCase().includes(q) ||
      item.skip_reason?.toLowerCase().includes(q) ||
      item.channel?.toLowerCase().includes(q);

    const matchReason = auditSkipReasonFilter === 'all' || item.skip_reason === auditSkipReasonFilter;

    return matchSearch && matchReason;
  });

  // QA list for select dropdown
  const qaSelectOptions = [
    { value: 'all', label: 'Semua QA Evaluator (Site Semarang)' },
    ...(monitoringData.evaluators.length > 0
      ? monitoringData.evaluators.map(qa => ({
        value: qa.evaluator_name,
        label: `${qa.evaluator_name} (${qa.in_progress_count > 0 ? '⚡ Sedang Menilai' : `${qa.completed_count}/${qa.target_quota}`})`
      }))
      : [
        { value: 'ALMIRA PARAMITHA', label: 'ALMIRA PARAMITHA' },
        { value: 'DEWI RIKA IRAWATI', label: 'DEWI RIKA IRAWATI' },
        { value: 'DHITA KHARISMA', label: 'DHITA KHARISMA' },
        { value: 'DIAN WAHYU WIBOWO', label: 'DIAN WAHYU WIBOWO' },
        { value: 'FINA ANDRIYANI', label: 'FINA ANDRIYANI' },
        { value: 'HANI DWI SURYO', label: 'HANI DWI SURYO' },
        { value: 'IIN SUGIARTI', label: 'IIN SUGIARTI' },
        { value: 'TIARA RAMADHANI', label: 'TIARA RAMADHANI' }
      ]
    )
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-10">
      {/* 1. CORPORATE HEADER & VIEW SWITCHER BANNER */}
      <div className="corp-card p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#0F2744] text-white text-[10px] font-black uppercase tracking-wider">
              <ClipboardCheck className="w-3.5 h-3.5 text-white" />
              Lembar Sampling & Penilaian Mutu
            </span>
            {isSupervisor && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-800 text-[10px] font-black border border-amber-300 uppercase">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                Mode Supervisor / Audit Hub
              </span>
            )}
            <span className="text-slate-300 font-bold hidden sm:inline">•</span>
            <span className="text-xs font-bold text-slate-700 hidden sm:inline-flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              {isSupervisor ? (selectedQaEvaluator === 'all' ? 'Monitoring Seluruh QA' : selectedQaEvaluator) : currentEvaluatorName}
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
            {isSupervisor && viewMode === 'monitoring'
              ? 'Monitoring Auto Distribution & Handling QA'
              : isSupervisor && viewMode === 'audit'
                ? 'Audit Kinerja QA & Pelacakan Tanggal / Minggu'
                : 'Antrean Kerja & Lembar Evaluasi CA'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {isSupervisor && viewMode === 'audit'
              ? 'Pantau konsistensi pengerjaan harian & mingguan (W1-W5), deteksi tiket menggantung yang ditinggalkan pengerjaannya, dan audit disiplin kerja tim QA.'
              : isSupervisor && viewMode === 'monitoring'
                ? 'Pantau progres pengerjaan tiket sampling auto distribution yang sedang di-handling oleh para QA Evaluator secara real-time, periksa antrean, dan review lembar penilaian.'
                : 'Pengerjaan observasi mutu sampling yang dialokasikan dari engine Auto Distribution. Lakukan penilaian parameter, cek FCR, dan submit nilai secara real-time.'}
          </p>
        </div>

        {/* Action Controls: View Switcher (Supervisor), Period Selector & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto flex-shrink-0">
          {/* Mode Switcher for Supervisor */}
          {isSupervisor && (
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-2xs flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode('monitoring')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'monitoring'
                  ? 'bg-[#0F2744] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Monitoring Real-Time</span>
                {monitoringData.summary?.active_evaluating_qas > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'audit'
                  ? 'bg-[#0F2744] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Audit Kinerja (Tgl / Week)</span>
                {auditData.summary?.total_stalled_tickets > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
                    {auditData.summary?.total_stalled_tickets}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('worksheet')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'worksheet'
                  ? 'bg-[#0F2744] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Lembar Sampling</span>
              </button>
            </div>
          )}

          <CustomSelect
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={[
              { value: '2026-08', label: 'Agustus 2026' },
              { value: '2026-09', label: 'September 2026' },
              { value: '2026-07', label: 'Juli 2026' }
            ]}
            className="w-36"
            buttonClassName="bg-white border-slate-300 py-1.5 text-slate-800 text-xs shadow-2xs font-bold"
          />

          <button
            type="button"
            onClick={() => {
              if (isSupervisor) {
                fetchMonitoringData(true);
                fetchAuditData(true);
              }
              fetchMyTickets(null, true);
              showToast('Data diperbarui dari server.');
            }}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs cursor-pointer active:scale-95"
            title="Segarkan antrean & monitoring"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingMonitoring || loadingAudit ? 'animate-spin text-[#0F2744]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: SUPERVISOR LIVE REAL-TIME MONITORING VIEW                     */}
      {/* ========================================================================= */}
      {isSupervisor && viewMode === 'monitoring' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* A1. MACRO KPI MONITORING BANNER */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Total QA Active */}
            <div className="corp-card p-4 flex flex-col justify-between border-blue-200 bg-blue-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">QA Evaluator</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-blue-900 tracking-tight leading-none">
                  {monitoringData.summary?.total_qa_evaluators || 8}
                </div>
                <div className="text-[11px] text-blue-700 font-medium mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <strong>{monitoringData.summary?.active_evaluating_qas || 0} QA</strong> Aktif Menilai
                </div>
              </div>
            </div>

            {/* Total Sampling Distributed */}
            <div className="corp-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Terdistribusi</span>
                <Layers className="w-4 h-4 text-[#0F2744]" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {monitoringData.summary?.total_distributed_tickets || 370}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Kuota Site SMG</div>
              </div>
            </div>

            {/* Sedang Di-handling Real-time */}
            <div className="corp-card p-4 flex flex-col justify-between border-amber-200 bg-amber-50/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Sedang Dinilai</span>
                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-amber-900 tracking-tight leading-none">
                  {monitoringData.summary?.total_in_progress_tickets || 0}
                </div>
                <div className="text-[11px] text-amber-700 font-bold mt-1">
                  Pengerjaan Real-Time
                </div>
              </div>
            </div>

            {/* Antrean Menunggu */}
            <div className="corp-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Antrean Siap</span>
                <Play className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {monitoringData.summary?.total_assigned_tickets || 0}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Menunggu Pengerjaan</div>
              </div>
            </div>

            {/* Dilewati / Skip / Salah / Abandon */}
            <div
              onClick={() => setMonitoringFilter(monitoringFilter === 'skipped' ? 'all' : 'skipped')}
              className={`corp-card p-4 flex flex-col justify-between cursor-pointer transition hover:border-rose-400 active:scale-95 ${monitoringFilter === 'skipped'
                ? 'border-2 border-rose-500 bg-rose-50/50 ring-2 ring-rose-200 shadow-sm'
                : 'border-rose-200 bg-rose-50/30'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Dilewati / Skip</span>
                <AlertOctagon className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-rose-900 tracking-tight leading-none font-mono">
                  {monitoringData.summary?.total_skipped_tickets || allSkippedTickets.length || 0}
                </div>
                <div className="text-[11px] text-rose-700 font-bold mt-1 flex items-center justify-between">
                  <span>Abandon / Silent Call</span>
                  <span className="text-[10px] font-bold underline">
                    {monitoringFilter === 'skipped' ? 'Tutup ×' : 'Lihat Tiket →'}
                  </span>
                </div>
              </div>
            </div>

            {/* Realisasi Selesai */}
            <div className="corp-card p-4 flex flex-col justify-between border-emerald-200 bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Selesai Dinilai</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-emerald-900 tracking-tight leading-none">
                  {monitoringData.summary?.total_completed_tickets || 0}
                </div>
                <div className="text-[11px] text-emerald-700 font-bold mt-1">
                  {monitoringData.summary?.site_achievement_pct || 0}% • Rata {monitoringData.summary?.team_avg_score || 0}% CA
                </div>
              </div>
            </div>
          </div>

          {/* A2. FILTER & SEARCH CONTROLS FOR MONITORING */}
          <div className="corp-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setMonitoringFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${monitoringFilter === 'all'
                  ? 'bg-[#0F2744] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
              >
                Semua QA ({monitoringData.evaluators.length})
              </button>
              <button
                type="button"
                onClick={() => setMonitoringFilter('in_progress')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${monitoringFilter === 'in_progress'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                Sedang Menilai ({monitoringData.evaluators.filter(q => q.in_progress_count > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setMonitoringFilter('assigned')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${monitoringFilter === 'assigned'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
              >
                Antrean Siap ({monitoringData.evaluators.filter(q => q.assigned_count > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setMonitoringFilter('skipped')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${monitoringFilter === 'skipped'
                  ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-300'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Dilewati / Skip ({allSkippedTickets.length || monitoringData.summary?.total_skipped_tickets || 0})
              </button>
              <button
                type="button"
                onClick={() => setMonitoringFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${monitoringFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
              >
                Selesai Kuota ({monitoringData.evaluators.filter(q => q.completed_count >= q.target_quota && q.target_quota > 0).length})
              </button>
            </div>

            {/* QA Name / Skipped Ticket Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={monitoringSearch}
                onChange={(e) => setMonitoringSearch(e.target.value)}
                placeholder={monitoringFilter === 'skipped' ? "Cari ID tiket, CSO, QA, alasan..." : "Cari nama QA Evaluator..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744]"
              />
            </div>
          </div>

          {/* A3. MAIN CONTENT: QA EVALUATORS GRID OR SKIPPED TICKETS TABLE */}
          {monitoringFilter === 'skipped' ? (
            <div className="space-y-4">
              {/* Header Card for Skipped Tickets */}
              <div className="corp-card p-4 bg-rose-50/50 border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center flex-shrink-0">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-rose-950 uppercase flex items-center gap-2">
                      <span>Daftar Tiket Sampling Dilewati / Skip</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-200 text-rose-900">
                        {allSkippedTickets.length} Tiket Terdata
                      </span>
                    </h3>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      Transparansi data operasional: Memantau tiket sampling yang dilewati (SKIPPED) beserta alasan dan QA evaluator terkait.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setMonitoringFilter('all')}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>← Kembali ke Semua QA</span>
                  </button>
                </div>
              </div>

              {/* Skipped Tickets Table */}
              <div className="corp-card overflow-hidden divide-y divide-slate-200 shadow-sm">
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-rose-600" />
                      Rincian Tiket Dilewati QA (Periode {selectedMonth})
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Menampilkan {filteredMonitoringSkippedTickets.length} dari total {allSkippedTickets.length} tiket yang di-skip.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 text-center">No</th>
                        <th className="py-3 px-4">ID Tiket</th>
                        <th className="py-3 px-3">Kanal</th>
                        <th className="py-3 px-4">Petugas CSO & NIK</th>
                        <th className="py-3 px-4">QA Evaluator</th>
                        <th className="py-3 px-4">Alasan Dilewati (Skip)</th>
                        <th className="py-3 px-3">Waktu Skip</th>
                        <th className="py-3 px-4 text-right">Aksi Supervisor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingMonitoring && allSkippedTickets.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0F2744]" />
                            Memuat data tiket yang dilewati...
                          </td>
                        </tr>
                      ) : filteredMonitoringSkippedTickets.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">Tidak Ada Tiket Dilewati</div>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                              {monitoringSearch
                                ? 'Tidak ada tiket dilewati yang cocok dengan pencarian Anda.'
                                : 'Seluruh tiket sampling yang dikerjakan QA dinilai secara valid tanpa ada yang di-skip.'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredMonitoringSkippedTickets.map((st, idx) => {
                          return (
                            <tr key={st.id || idx} className="hover:bg-rose-50/20 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-black text-slate-900">
                                    #{st.ticket_id}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(st.ticket_id, `mon-skip-${st.id}`)}
                                    title="Salin ID Tiket"
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                  >
                                    {copiedId === `mon-skip-${st.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Kategori: {st.category_name}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono">
                                  {st.channel}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 text-xs">
                                  {formatAgentName(st.agent_name)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                                  <span>NIK: {st.agent_nik}</span>
                                  <span>•</span>
                                  <span className="text-slate-600">{st.agent_site || 'Semarang'}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-[#0F2744] text-white flex items-center justify-center font-bold text-[10px]">
                                    {(st.evaluator_name || 'Q').charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">
                                      {st.evaluator_name}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      QA Evaluator
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-200 inline-flex items-center gap-1.5">
                                  <AlertOctagon className="w-3 h-3 text-rose-600 flex-shrink-0" />
                                  <span>{st.skip_reason}</span>
                                </span>
                                {st.notes && st.notes !== st.skip_reason && (
                                  <div className="text-[10px] text-slate-500 italic mt-1">
                                    Catatan: "{st.notes}"
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{st.skipped_time_display}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQaWorksheet(st.evaluator_name)}
                                    className="px-2.5 py-1 rounded-lg bg-[#0F2744] hover:bg-[#1A365D] text-white text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs inline-flex items-center gap-1"
                                    title="Periksa lembar kerja QA"
                                  >
                                    <span>Buka Lembar</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReassignModal({
                                      id: st.id,
                                      ticket_id: st.ticket_id,
                                      agent_name: st.agent_name,
                                      agent_nik: st.agent_nik,
                                      evaluator_name: st.evaluator_name
                                    })}
                                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                    title="Pindahkan tiket ini ke QA lain agar dinilai ulang"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>Reassign</span>
                                  </button>
                                </div>
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
          ) : (
            /* Live QA Grid for all other filters */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {loadingMonitoring && (!monitoringData.evaluators || monitoringData.evaluators.length === 0) ? (
                <div className="col-span-full corp-card p-12 text-center text-slate-500 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0F2744]" />
                  <p className="text-xs font-bold text-slate-700">Memuat status pengerjaan QA Evaluator...</p>
                </div>
              ) : filteredEvaluators.length === 0 ? (
                <div className="col-span-full corp-card p-12 text-center text-slate-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">Tidak ada data QA yang sesuai dengan filter.</p>
                </div>
              ) : (
                filteredEvaluators.map((qa) => {
                  const isEvaluating = qa.in_progress_count > 0;
                  const isAchieved = qa.completed_count >= qa.target_quota && qa.target_quota > 0;
                  const activeTicket = qa.active_ticket_primary;

                  return (
                    <div
                      key={qa.evaluator_name}
                      className={`corp-card p-4 space-y-3 flex flex-col justify-between transition-all duration-200 ${isEvaluating
                        ? 'border-amber-300 bg-amber-50/10 shadow-sm ring-1 ring-amber-300'
                        : isAchieved
                          ? 'border-emerald-300 bg-emerald-50/10'
                          : 'hover:border-slate-300'
                        }`}
                    >
                      <div>
                        {/* Top QA Identity & Status Pill */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${isEvaluating
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isAchieved
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                              {qa.evaluator_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-black text-slate-900 truncate leading-tight">
                                {qa.evaluator_name}
                              </h3>
                              <span className="text-[10px] text-slate-500 font-medium">QA Evaluator • SMG</span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          {isEvaluating ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1 animate-pulse flex-shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Sedang Menilai
                            </span>
                          ) : isAchieved ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 flex-shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              Kuota Tercapai
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-2.5 h-2.5 text-blue-500" />
                              Antrean Siap
                            </span>
                          )}
                        </div>

                        {/* Progress Bar & Percentage */}
                        <div className="space-y-1 my-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">
                              Progres: <strong className="text-slate-900">{qa.completed_count}</strong> / {qa.target_quota} Tiket
                            </span>
                            <span className="font-mono font-black text-slate-900">
                              {qa.achievement_pct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isAchieved
                                ? 'bg-emerald-500'
                                : qa.achievement_pct > 50
                                  ? 'bg-blue-600'
                                  : 'bg-[#0F2744]'
                                }`}
                              style={{ width: `${Math.min(100, Math.max(3, qa.achievement_pct))}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* CURRENT ACTIVE HANDLING HIGHLIGHT BOX */}
                        <div className={`p-2.5 rounded-xl border text-xs my-2.5 ${isEvaluating
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-slate-50/80 border-slate-200 text-slate-600'
                          }`}>
                          {isEvaluating && activeTicket ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-800">
                                <span className="inline-flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-amber-600 animate-spin" />
                                  Tiket Sedang Dinilai
                                </span>
                                <span className="font-mono text-slate-500">{activeTicket.time_display || 'Saat ini'}</span>
                              </div>
                              <div className="font-mono font-black text-xs text-slate-900">
                                #{activeTicket.ticket_id} • <span className="text-amber-800 uppercase">{activeTicket.channel}</span>
                              </div>
                              <div className="text-[11px] font-bold text-slate-800 truncate">
                                CSO: {activeTicket.agent_name}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 py-0.5 text-slate-500">
                              <Inbox className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-[11px] leading-tight">
                                Menunggu pengerjaan ({qa.assigned_count} tiket siap dinilai)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Stats Mini Grid */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-1">
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                            <span className="text-slate-500 block">Antrean</span>
                            <strong className="font-mono text-slate-800 text-xs">{qa.assigned_count}</strong>
                          </div>
                          <div className="bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-200/60">
                            <span className="text-emerald-700 block">Selesai</span>
                            <strong className="font-mono text-emerald-900 text-xs">{qa.completed_count}</strong>
                          </div>
                          <div className={`p-1.5 rounded-lg border ${qa.skipped_count > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50/60 border-slate-200/60'}`}>
                            <span className={`${qa.skipped_count > 0 ? 'text-rose-700' : 'text-slate-500'} block`}>Skip</span>
                            <strong className={`font-mono text-xs ${qa.skipped_count > 0 ? 'text-rose-900 font-black' : 'text-slate-800'}`}>
                              {qa.skipped_count || 0}
                            </strong>
                          </div>
                          <div className="bg-blue-50/60 p-1.5 rounded-lg border border-blue-200/60">
                            <span className="text-blue-700 block">Rata CA</span>
                            <strong className="font-mono text-blue-900 text-xs">
                              {qa.avg_score ? `${qa.avg_score}%` : '-'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Jump to Worksheet */}
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenQaWorksheet(qa.evaluator_name)}
                          className="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Buka Lembar Kerja</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: SUPERVISOR AUDIT KINERJA & PELACAKAN TANGGAL / MINGGU          */}
      {/* ========================================================================= */}
      {isSupervisor && viewMode === 'audit' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* B1. AUDIT KPI SUMMARY BANNER */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Tiket Menggantung / Abandoned */}
            <div className={`corp-card p-4 flex flex-col justify-between border-2 ${(auditData.summary?.total_stalled_tickets || 0) > 0
              ? 'border-rose-300 bg-rose-50/30 ring-2 ring-rose-200'
              : 'border-emerald-200 bg-emerald-50/20'
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-900">
                  Tiket Menggantung
                </span>
                <ShieldAlert className={`w-4 h-4 ${(auditData.summary?.total_stalled_tickets || 0) > 0 ? 'text-rose-600 animate-bounce' : 'text-emerald-600'
                  }`} />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-rose-900 tracking-tight leading-none">
                  {auditData.summary?.total_stalled_tickets || 0} <span className="text-xs font-bold text-rose-700">Kasus</span>
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-1">
                  {(auditData.summary?.qas_with_stalled_tickets || 0) > 0
                    ? `${auditData.summary?.qas_with_stalled_tickets} QA belum menyelesaikan tiket aktif`
                    : 'Tidak ada tiket terbengkalai'}
                </div>
              </div>
            </div>

            {/* Tiket Dilewati / Skip */}
            <div
              onClick={() => setAuditSubTab('skipped')}
              className={`corp-card p-4 flex flex-col justify-between cursor-pointer transition hover:border-purple-300 ${(auditData.skipped_tickets?.length || auditData.summary?.total_skipped_tickets || 0) > 0
                ? 'border-purple-200 bg-purple-50/20 hover:bg-purple-50/40'
                : 'border-slate-200'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">Tiket Dilewati / Skip</span>
                <SkipForward className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-purple-950 tracking-tight leading-none font-mono">
                  {auditData.skipped_tickets?.length || auditData.summary?.total_skipped_tickets || 0} <span className="text-xs font-bold text-purple-700">Tiket</span>
                </div>
                <div className="text-[11px] text-purple-700 font-medium mt-1 flex items-center justify-between">
                  <span>Alasan tidak valid / skip</span>
                  <span className="text-[10px] font-bold underline">Lihat →</span>
                </div>
              </div>
            </div>

            {/* QA Temuan Audit */}
            <div className="corp-card p-4 flex flex-col justify-between border-amber-200 bg-amber-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">QA Temuan Audit</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-amber-900 tracking-tight leading-none">
                  {(auditData.evaluators || []).filter(q => q.discipline_status === 'SERING_MENINGGALKAN_PEKERJAAN').length} <span className="text-xs font-bold text-amber-700">QA</span>
                </div>
                <div className="text-[11px] text-amber-700 font-medium mt-1">
                  Status: Sering Menggantung
                </div>
              </div>
            </div>

            {/* Total Hari Stagnan */}
            <div className="corp-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Hari Stagnan</span>
                <Calendar className="w-4 h-4 text-[#0F2744]" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {auditData.summary?.total_stagnant_days || 0} <span className="text-xs font-bold text-slate-500">Hari Kerja</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Ada antrean namun 0 pengerjaan
                </div>
              </div>
            </div>

            {/* Skor Disiplin Tim */}
            <div className="corp-card p-4 flex flex-col justify-between border-blue-200 bg-blue-50/20 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Skor Disiplin Tim</span>
                <Award className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-blue-900 tracking-tight leading-none font-mono">
                  {auditData.summary?.team_audit_score || 100}%
                </div>
                <div className="text-[11px] text-blue-700 font-medium mt-1">
                  Audit Disiplin & SLA
                </div>
              </div>
            </div>
          </div>

          {/* B2. AUDIT SUB-TABS SELECTOR & SEARCH */}
          <div className="corp-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAuditSubTab('weekly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${auditSubTab === 'weekly'
                  ? 'bg-[#0F2744] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Pelacakan Mingguan (W1 - W5)</span>
              </button>

              <button
                type="button"
                onClick={() => setAuditSubTab('daily')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${auditSubTab === 'daily'
                  ? 'bg-[#0F2744] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Pelacakan Harian (Per Tanggal)</span>
              </button>

              <button
                type="button"
                onClick={() => setAuditSubTab('findings')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${auditSubTab === 'findings'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Temuan Tiket Menggantung ({auditData.summary?.total_stalled_tickets || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setAuditSubTab('skipped')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${auditSubTab === 'skipped'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
                  }`}
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Tiket Dilewati / Skip ({auditData.skipped_tickets?.length || auditData.summary?.total_skipped_tickets || 0})</span>
              </button>
            </div>

            {/* QA Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Cari nama QA untuk audit..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744]"
              />
            </div>
          </div>

          {/* B3. SUB-VIEW 1: PELACAKAN MINGGUAN (W1 - W5) */}
          {auditSubTab === 'weekly' && (
            <div className="corp-card overflow-hidden divide-y divide-slate-200 shadow-sm">
              <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-[#0F2744]" />
                    Matriks Progres Mingguan QA (Periode {selectedMonth})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Target mingguan ideal: <strong>~11.5 tiket / minggu</strong> per QA Evaluator (Pace 46-47 Kuota).
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nama QA Evaluator</th>
                      <th className="py-3 px-3 text-center">Target Kuota</th>
                      <th className="py-3 px-3 text-center bg-blue-50/50">W1 (Tgl 1-7)</th>
                      <th className="py-3 px-3 text-center bg-blue-50/50">W2 (Tgl 8-14)</th>
                      <th className="py-3 px-3 text-center bg-blue-50/50">W3 (Tgl 15-21)</th>
                      <th className="py-3 px-3 text-center bg-blue-50/50">W4 (Tgl 22-28)</th>
                      <th className="py-3 px-3 text-center bg-blue-50/50">W5 (Tgl 29-31)</th>
                      <th className="py-3 px-3 text-center">Total Selesai</th>
                      <th className="py-3 px-3 text-center">Skor Disiplin</th>
                      <th className="py-3 px-3 text-center">Status Audit</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingAudit && (!auditData.evaluators || auditData.evaluators.length === 0) ? (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0F2744]" />
                          Memuat audit mingguan QA...
                        </td>
                      </tr>
                    ) : filteredAuditEvaluators.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500">
                          Tidak ada data audit yang ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredAuditEvaluators.map((qa) => {
                        const isViolator = qa.discipline_status === 'SERING_MENINGGALKAN_PEKERJAAN';
                        const isWarning = qa.discipline_status === 'PERLU_PERHATIAN';

                        return (
                          <tr
                            key={qa.evaluator_name}
                            className={`hover:bg-slate-50/80 transition-colors ${isViolator ? 'bg-rose-50/30' : isWarning ? 'bg-amber-50/20' : ''
                              }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{qa.evaluator_name}</div>
                              <div className="text-[10px] text-slate-500">
                                {qa.stalled_tickets_count > 0 ? (
                                  <span className="text-rose-700 font-bold">⚠️ {qa.stalled_tickets_count} tiket menggantung</span>
                                ) : (
                                  `${qa.active_days_count} hari aktif`
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                              {qa.target_quota}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/30">
                              {qa.weekly_progress?.W1?.completed || 0}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/30">
                              {qa.weekly_progress?.W2?.completed || 0}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/30">
                              {qa.weekly_progress?.W3?.completed || 0}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/30">
                              {qa.weekly_progress?.W4?.completed || 0}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-blue-900 bg-blue-50/30">
                              {qa.weekly_progress?.W5?.completed || 0}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-emerald-900">
                              {qa.completed_count} <span className="text-[10px] font-normal text-slate-500">({qa.achievement_pct}%)</span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${qa.audit_score >= 85
                                ? 'bg-emerald-100 text-emerald-800'
                                : qa.audit_score >= 70
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300 font-black'
                                }`}>
                                {qa.audit_score}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isViolator ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                  <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                                  Sering Menggantung
                                </span>
                              ) : isWarning ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  Perlu Perhatian
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  Disiplin Tinggi
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenQaWorksheet(qa.evaluator_name)}
                                className="px-2.5 py-1 rounded-lg bg-[#0F2744] hover:bg-[#1A365D] text-white text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs inline-flex items-center gap-1"
                              >
                                <span>Buka Lembar</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* B4. SUB-VIEW 2: PELACAKAN HARIAN (PER TANGGAL) */}
          {auditSubTab === 'daily' && (
            <div className="corp-card p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#0F2744]" />
                    Aktivitas Pengerjaan Harian QA (Heatmap & Konsistensi)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Memantau tanggal aktif dan mendeteksi hari di mana QA tidak mengerjakan tiket sama sekali (Stagnan).
                  </p>
                </div>
              </div>

              {/* Daily Matrix Table */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 bg-slate-100">Nama QA Evaluator</th>
                      {(auditData.dates_list || []).map((dt) => {
                        const dayNum = dt.split('-')[2];
                        return (
                          <th key={dt} className="py-2 px-1 text-center font-mono text-[10px] min-w-[32px]">
                            {dayNum}
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-3 text-center bg-slate-100">Total Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredAuditEvaluators.map((qa) => {
                      return (
                        <tr key={qa.evaluator_name} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {qa.evaluator_name}
                          </td>
                          {(auditData.dates_list || []).map((dt) => {
                            const count = qa.daily_activity ? (qa.daily_activity[dt] || 0) : 0;
                            const isStagnant = qa.stagnant_dates && qa.stagnant_dates.includes(dt);

                            return (
                              <td key={dt} className="py-1 px-1 text-center">
                                {count > 0 ? (
                                  <span
                                    title={`Tgl ${dt}: ${count} tiket selesai`}
                                    className={`w-6 h-6 rounded-md inline-flex items-center justify-center font-mono font-bold text-[10px] ${count >= 5
                                      ? 'bg-emerald-600 text-white font-black'
                                      : count >= 2
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-blue-100 text-blue-900'
                                      }`}
                                  >
                                    {count}
                                  </span>
                                ) : isStagnant ? (
                                  <span
                                    title={`Tgl ${dt}: 0 pengerjaan (Hari Kerja Stagnan)`}
                                    className="w-6 h-6 rounded-md inline-flex items-center justify-center font-mono text-[10px] bg-rose-50 text-rose-600 border border-rose-200"
                                  >
                                    0
                                  </span>
                                ) : (
                                  <span className="w-6 h-6 rounded-md inline-flex items-center justify-center font-mono text-[10px] text-slate-300">
                                    -
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-900">
                            {qa.completed_count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex-wrap">
                <span className="font-bold text-slate-800">Keterangan:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-emerald-600 inline-block"></span>
                  <span>Produktif Tinggi (&gt;= 5 Tiket)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 inline-block"></span>
                  <span>Produktif (2 - 4 Tiket)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-rose-50 border border-rose-300 inline-block"></span>
                  <span>Hari Kerja Stagnan (0 Pengerjaan)</span>
                </div>
              </div>
            </div>
          )}

          {/* B5. SUB-VIEW 3: DAFTAR TEMUAN AUDIT (TIKET MENGGANTUNG & DISIPLIN) */}
          {auditSubTab === 'findings' && (
            <div className="space-y-4">
              <div className="corp-card p-4 bg-rose-50/50 border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-rose-900 uppercase">
                      Laporan Audit: Indikasi Meninggalkan Pekerjaan & Tiket Menggantung
                    </h3>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      Sistem mencatat tiket yang telah berstatus <strong>IN_PROGRESS</strong> namun tidak diselesaikan dalam batas wajar (&gt; 30 menit atau terbengkalai dari jam/hari sebelumnya).
                    </p>
                  </div>
                </div>

                <div className="text-xs text-rose-900 font-bold bg-white px-3 py-1.5 rounded-xl border border-rose-200 self-start sm:self-auto shadow-2xs">
                  Total Temuan: {auditData.summary?.total_stalled_tickets || 0} Tiket Terbengkalai
                </div>
              </div>

              {/* Cards Grid per QA with Audited Findings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAuditEvaluators.map((qa) => {
                  const hasStalled = qa.stalled_tickets_count > 0;
                  const isViolator = qa.discipline_status === 'SERING_MENINGGALKAN_PEKERJAAN';

                  return (
                    <div
                      key={qa.evaluator_name}
                      className={`corp-card p-5 space-y-3.5 transition-all ${hasStalled
                        ? 'border-2 border-rose-300 bg-rose-50/10 shadow-sm'
                        : 'border-slate-200'
                        }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${hasStalled ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-slate-100 text-slate-800'
                            }`}>
                            {(qa.evaluator_name || 'Q').charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900">{qa.evaluator_name}</h4>
                            <span className="text-[10px] text-slate-500">QA Evaluator Site Semarang</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-500 uppercase">Skor Disiplin</div>
                          <div className={`font-mono text-base font-black ${qa.audit_score >= 85 ? 'text-emerald-700' : qa.audit_score >= 70 ? 'text-amber-700' : 'text-rose-600'
                            }`}>
                            {qa.audit_score}%
                          </div>
                        </div>
                      </div>

                      {/* Stalled Tickets List */}
                      {hasStalled ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-black text-rose-900 uppercase">
                            <span className="inline-flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                              Tiket Menggantung / Ditinggalkan ({qa.stalled_tickets_count} Kasus):
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(qa.stalled_tickets || []).map((st) => (
                              <div
                                key={st.id}
                                className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs font-black text-slate-900">
                                    #{st.ticket_id}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white animate-pulse">
                                    Menggantung: {st.duration_text}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-800">
                                  CSO: <strong>{st.agent_name}</strong> ({st.agent_nik}) • Kanal: <strong className="uppercase">{st.channel}</strong>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Mulai dikerjakan: <strong>{st.started_time_display}</strong> (belum disimpan/diselesaikan)
                                </div>

                                {/* Reassign Button directly from audit */}
                                <div className="pt-1.5 flex items-center justify-end gap-2 border-t border-rose-200/60">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReassignModal({
                                      id: st.id,
                                      ticket_id: st.ticket_id,
                                      agent_name: st.agent_name,
                                      agent_nik: st.agent_nik,
                                      evaluator_name: qa.evaluator_name
                                    })}
                                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>Pindahkan (Reassign)</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>Tidak ada tiket menggantung. Pengerjaan tertib dan selesai tepat waktu.</span>
                        </div>
                      )}

                      {/* Stagnant Days Warning */}
                      {qa.stagnant_days_count > 0 && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                          <span>Hari Kerja Tanpa Pengerjaan (Stagnan):</span>
                          <strong className="text-amber-800 font-mono">{qa.stagnant_days_count} Hari</strong>
                        </div>
                      )}

                      {/* Card Bottom Footer */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-500">
                          Realisasi: <strong className="text-slate-800">{qa.completed_count}</strong> / {qa.target_quota} Selesai
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenQaWorksheet(qa.evaluator_name)}
                          className="btn-secondary py-1.5 px-3 text-xs font-bold text-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Periksa Lembar Kerja</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* B6. SUB-VIEW 4: AUDIT TIKET DILEWATI / SKIP (ABANDON / INVALID) */}
          {auditSubTab === 'skipped' && (
            <div className="space-y-4">
              {/* Header Card & Reason Breakdown */}
              <div className="corp-card p-4 bg-purple-50/50 border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 border border-purple-300 flex items-center justify-center flex-shrink-0">
                    <SkipForward className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-purple-950 uppercase flex items-center gap-2">
                      <span>Audit Tiket Dilewati / Skip (Abandon & Invalid Data)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-200 text-purple-900">
                        {auditData.skipped_tickets?.length || 0} Tiket
                      </span>
                    </h3>
                    <p className="text-[11px] text-purple-800 mt-0.5">
                      Transparansi penuh data operasional: Memantau seluruh tiket yang dilewati oleh QA Evaluator dengan alasan rekaman kosong, salah routing, kontak tidak valid, dsb.
                    </p>
                  </div>
                </div>

                {/* Filter Reason Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'Semua Alasan' },
                    { id: 'Recording Kosong / Silent Call', label: 'Recording Kosong' },
                    { id: 'Salah Routing Kanal / Unit', label: 'Salah Kanal' },
                    { id: 'Salah Nomor / Kontak Tidak Valid', label: 'Salah Nomor' },
                    { id: 'Informasi Belum Terverifikasi / Kurang', label: 'Info Kurang' },
                  ].map(cat => {
                    const count = cat.id === 'all'
                      ? (auditData.skipped_tickets?.length || 0)
                      : (auditData.skipped_tickets || []).filter(s => s.skip_reason === cat.id).length;

                    const isSelected = auditSkipReasonFilter === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setAuditSkipReasonFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${isSelected
                          ? 'bg-purple-800 text-white shadow-2xs'
                          : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100/60'
                          }`}
                      >
                        <span>{cat.label}</span>
                        <span className={`px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-purple-900 text-purple-100' : 'bg-purple-100 text-purple-800'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skipped Tickets Table */}
              <div className="corp-card overflow-hidden divide-y divide-slate-200 shadow-sm">
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SkipForward className="w-4 h-4 text-purple-700" />
                      Daftar Tiket Dilewati QA (Periode {selectedMonth})
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Menampilkan {filteredSkippedTickets.length} dari total {auditData.skipped_tickets?.length || 0} tiket yang dilewati.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 text-center">No</th>
                        <th className="py-3 px-4">ID Tiket</th>
                        <th className="py-3 px-3">Kanal</th>
                        <th className="py-3 px-4">Petugas CSO & NIK</th>
                        <th className="py-3 px-4">QA Evaluator</th>
                        <th className="py-3 px-4">Alasan Dilewati (Skip)</th>
                        <th className="py-3 px-3">Waktu Skip</th>
                        <th className="py-3 px-4 text-right">Aksi Supervisor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingAudit && (!auditData.skipped_tickets || auditData.skipped_tickets.length === 0) ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0F2744]" />
                            Memuat data audit tiket yang dilewati...
                          </td>
                        </tr>
                      ) : filteredSkippedTickets.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">Tidak Ada Tiket Dilewati</div>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                              {auditSearch || auditSkipReasonFilter !== 'all'
                                ? 'Tidak ada tiket dilewati yang cocok dengan filter atau pencarian Anda.'
                                : 'Seluruh tiket sampling yang dikerjakan QA dinilai secara valid tanpa ada yang di-skip.'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredSkippedTickets.map((st, idx) => {
                          return (
                            <tr key={st.id || idx} className="hover:bg-purple-50/20 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-black text-slate-900">
                                    #{st.ticket_id}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(st.ticket_id, `skip-${st.id}`)}
                                    title="Salin ID Tiket"
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                  >
                                    {copiedId === `skip-${st.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Kategori: {st.category_name}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono">
                                  {st.channel}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 text-xs">
                                  {formatAgentName(st.agent_name)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                                  <span>NIK: {st.agent_nik}</span>
                                  <span>•</span>
                                  <span className="text-slate-600">{st.agent_site || 'Semarang'}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-[#0F2744] text-white flex items-center justify-center font-bold text-[10px]">
                                    {(st.evaluator_name || 'Q').charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">
                                      {st.evaluator_name}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      QA Evaluator
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200 inline-flex items-center gap-1.5">
                                  <SkipForward className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                  <span>{st.skip_reason}</span>
                                </span>
                                {st.notes && st.notes !== st.skip_reason && (
                                  <div className="text-[10px] text-slate-500 italic mt-1">
                                    Catatan: "{st.notes}"
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{st.skipped_time_display}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQaWorksheet(st.evaluator_name)}
                                    className="px-2.5 py-1 rounded-lg bg-[#0F2744] hover:bg-[#1A365D] text-white text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs inline-flex items-center gap-1"
                                    title="Periksa lembar kerja QA"
                                  >
                                    <span>Buka Lembar</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReassignModal({
                                      id: st.id,
                                      ticket_id: st.ticket_id,
                                      agent_name: st.agent_name,
                                      agent_nik: st.agent_nik,
                                      evaluator_name: st.evaluator_name
                                    })}
                                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                    title="Pindahkan tiket ini ke QA lain agar dinilai ulang"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>Reassign</span>
                                  </button>
                                </div>
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
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C: QA WORKSHEET & SCORING VIEW (Dual-Pane Interactive Sheet)      */}
      {/* ========================================================================= */}
      {(!isSupervisor || viewMode === 'worksheet') && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* SUPERVISOR AUDIT BANNER & QA SELECTOR */}
          {isSupervisor && (
            <div className="corp-card p-3.5 sm:p-4 bg-gradient-to-r from-blue-50/80 via-white to-slate-50 border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewMode('monitoring')}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-[#0F2744]" />
                  <span>← Monitoring Tim</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('audit')}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Audit Kinerja QA</span>
                </button>

                <span className="text-slate-300 font-bold hidden sm:inline">|</span>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Filter Lembar Kerja QA:</span>
                  <CustomSelect
                    value={selectedQaEvaluator}
                    onChange={(e) => {
                      setSelectedQaEvaluator(e.target.value);
                      setSelectedTicket(null);
                    }}
                    options={qaSelectOptions}
                    className="w-64"
                    buttonClassName="bg-white border-blue-300 py-1.5 text-slate-900 text-xs font-bold shadow-2xs"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-600 font-medium self-end sm:self-auto">
                Total Antrean Termuat: <strong className="text-slate-900 font-bold">{tickets.length} Tiket</strong>
              </div>
            </div>
          )}

          {/* 2. KPI TARGET & WORK PROGRESS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Target Kuota */}
            <div className="corp-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Kuota</span>
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {stats.target_quota || stats.total_bucket || 47}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {selectedQaEvaluator === 'all' ? 'Total Alokasi Site' : 'Sesi / Kuota QA'}
                </div>
              </div>
            </div>

            {/* Realisasi Selesai */}
            <div className="corp-card p-4 flex flex-col justify-between border-emerald-200 bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Selesai Dinilai</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-emerald-900 tracking-tight leading-none">
                  {stats.completed || 0}
                </div>
                <div className="text-[11px] text-emerald-700 font-bold mt-1">
                  {stats.achievement_pct || 0}% Tercapai
                </div>
              </div>
            </div>

            {/* Sedang Dikerjakan */}
            <div className="corp-card p-4 flex flex-col justify-between border-amber-200 bg-amber-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Sedang Dinilai</span>
                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-amber-900 tracking-tight leading-none">
                  {stats.in_progress || 0}
                </div>
                <div className="text-[11px] text-amber-700 font-medium mt-1">Dalam Proses</div>
              </div>
            </div>

            {/* Antrean Menunggu */}
            <div className="corp-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Menunggu (Antrean)</span>
                <Play className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {stats.assigned || 0}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Siap Dinilai</div>
              </div>
            </div>

            {/* Dilewati / Skip / Abandon */}
            <div className="corp-card p-4 flex flex-col justify-between border-rose-200 bg-rose-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Dilewati (Skip)</span>
                <AlertOctagon className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-rose-900 tracking-tight leading-none">
                  {stats.skipped || 0}
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-1">
                  Abandon / Salah
                </div>
              </div>
            </div>

            {/* Total Terdistribusi */}
            <div className="corp-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Tiket</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {stats.total_bucket || tickets.length}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Total Bucket</div>
              </div>
            </div>
          </div>

          {/* 3. TWO-PANE INTERACTIVE WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* LEFT PANE: TICKET WORKLIST (5 COLS) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="corp-card p-4 space-y-3">
                {/* Search & Channel Filter */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari ID Tiket, NIK, atau Nama Agen..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] transition"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={[
                      { value: 'all', label: 'Semua Status' },
                      { value: 'in_progress', label: 'Sedang Dinilai (In Progress)' },
                      { value: 'pending', label: 'Ditunda / Jeda (Hold)' },
                      { value: 'assigned', label: 'Siap Dinilai (Assigned)' },
                      { value: 'completed', label: 'Selesai (Completed)' },
                      { value: 'skipped', label: 'Dilewati (Skipped)' }
                    ]}
                    className="w-1/2"
                    buttonClassName="bg-white border-slate-300 py-1.5 text-slate-800 text-[11px]"
                  />

                  <CustomSelect
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    options={[
                      { value: 'all', label: 'Semua Saluran' },
                      { value: 'Inbound', label: 'Inbound Call' },
                      { value: 'Digilive', label: 'Digilive (Chat)' },
                      { value: 'Socmed', label: 'Social Media' },
                      { value: 'Email', label: 'Email Inbound' },
                      { value: 'Email Outbound', label: 'Email Outbound' },
                      { value: 'Outbound Call', label: 'Outbound Call' },
                      { value: 'Back Office', label: 'Back Office' }
                    ]}
                    className="w-1/2"
                    buttonClassName="bg-white border-slate-300 py-1.5 text-slate-800 text-[11px]"
                  />
                </div>
              </div>

              {/* Ticket Items List */}
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
                {loading && (!tickets || tickets.length === 0) ? (
                  <div className="corp-card p-10 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0F2744]" />
                    <span className="text-xs font-medium">Memuat antrean tiket sampling...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="corp-card p-8 text-center text-slate-500 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-slate-800 text-xs">Tidak Ada Tiket Ditemukan</p>
                    <p className="text-[11px] text-slate-500">
                      Semua tiket telah selesai dinilai atau sesuaikan filter pencarian.
                    </p>
                  </div>
                ) : (
                  tickets.map((t) => {
                    const isSelected = selectedTicket?.id === t.id;
                    const isCompleted = t.status === 'COMPLETED';
                    const isInProgress = t.status === 'IN_PROGRESS';
                    const isPending = t.status === 'PENDING';
                    const isSkipped = t.status === 'SKIPPED';

                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTicket(t)}
                        className={`corp-card p-3.5 cursor-pointer transition-all duration-150 relative ${isSelected
                          ? 'border-[#0F2744] bg-blue-50/40 shadow-sm ring-2 ring-[#0F2744]'
                          : 'hover:border-slate-300 hover:bg-slate-50/60'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="font-mono text-xs font-black text-slate-900 tracking-tight">
                                #{t.ticket_id}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                {t.channel}
                              </span>
                              {t.evaluator_name && isSupervisor && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  {t.evaluator_name?.split(' ')[0] || t.evaluator_name}
                                </span>
                              )}
                              {t.assignment_type === 'MANDATORY' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-[#0F2744]">
                                  Wajib
                                </span>
                              )}
                              {t.is_naker_verified && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5">
                                  <CheckCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  NAKER
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-bold text-slate-800 truncate">
                              {formatAgentName(t.agent_name)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              NIK: {t.agent_nik} • {t.category_name}
                            </div>
                          </div>

                          {/* Status / Score Column */}
                          <div className="text-right flex-shrink-0">
                            {isCompleted ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block">
                                  {t.score_ca}% CA
                                </span>
                                <div className="text-[9px] font-bold text-emerald-700">
                                  FCR {t.fcr || 'YA'}
                                </div>
                              </div>
                            ) : isInProgress ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                Sedang Dinilai
                              </span>
                            ) : isPending ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-amber-700" />
                                Ditunda
                              </span>
                            ) : isSkipped ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-block">
                                Dilewati
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                                Menunggu
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANE: INTERACTIVE SCORING & EVALUATION SHEET (7 COLS) */}
            <div className="lg:col-span-7">
              {!selectedTicket ? (
                <div className="corp-card p-12 text-center text-slate-500 space-y-3 min-h-[500px] flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <ClipboardCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-black text-slate-800">Pilih Tiket untuk Memulai Sampling</h3>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    Klik salah satu tiket dari antrean di sebelah kiri untuk membuka lembar penilaian mutu, mengecek parameter sesuai saluran, dan melakukan input skor CA.
                  </p>
                </div>
              ) : (
                <div className="corp-card overflow-hidden divide-y divide-slate-200/90 shadow-sm">
                  {/* STICKY TOP HEADER BANNER */}
                  <div className="p-4 sm:p-5 bg-white border-b border-slate-200 sticky top-[57px] z-20 backdrop-blur-md bg-white/95 space-y-3.5">
                    {/* Top Row: Ticket ID, Badges & CA Score */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-slate-100/90 px-2.5 py-1 rounded-xl border border-slate-200">
                          <span className="font-mono text-sm sm:text-base font-black text-slate-900 tracking-tight">
                            #{selectedTicket.ticket_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedTicket.ticket_id, selectedTicket.id)}
                            className="p-1 rounded hover:bg-white text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            title="Salin ID Tiket"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0F2744] text-white uppercase tracking-wide">
                          {selectedTicket.channel}
                        </span>

                        <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Site Semarang
                        </span>

                        {/* Status Badge */}
                        {selectedTicket.status === 'COMPLETED' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Selesai Dinilai
                          </span>
                        ) : selectedTicket.status === 'IN_PROGRESS' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-300 inline-flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            Sedang Dinilai
                          </span>
                        ) : selectedTicket.status === 'PENDING' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Ditunda (Hold)
                          </span>
                        ) : selectedTicket.status === 'SKIPPED' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            Dilewati
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            Menunggu Dinilai
                          </span>
                        )}
                      </div>

                      {/* Live Score Display */}
                      <div className="flex items-center gap-3 bg-slate-50/80 px-3.5 py-1.5 rounded-xl border border-slate-200/90 self-start sm:self-auto">
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Skor CA</div>
                          <div className="text-[10px] text-slate-400 font-medium">Standar &ge; 85%</div>
                        </div>
                        <div className={`text-2xl font-black font-mono leading-none ${calculatedScore >= 85 ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                          {calculatedScore}%
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Agent Details & Verified Tags */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2 flex-wrap text-slate-700">
                        <span>Petugas CSO: <strong className="text-slate-900 font-bold">{formatAgentName(selectedTicket.agent_name)}</strong></span>
                        <span className="text-slate-400 font-mono text-[11px]">({selectedTicket.agent_nik})</span>
                        {selectedTicket.evaluator_name && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            QA: {selectedTicket.evaluator_name}
                          </span>
                        )}
                        {selectedTicket.assignment_type === 'MANDATORY' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-[#0F2744]">
                            Wajib (Mandatory)
                          </span>
                        )}
                        {selectedTicket.is_naker_verified && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Terverifikasi NAKER
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Primary Submit Button */}
                        <button
                          type="button"
                          onClick={handleSubmitEvaluation}
                          disabled={submitting}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{submitting ? 'Menyimpan...' : 'Simpan & Lanjut Tiket'}</span>
                        </button>

                        {/* Hold / Pause Button: Change status to PENDING/HOLD */}
                        {selectedTicket.status === 'IN_PROGRESS' ? (
                          <button
                            type="button"
                            onClick={handleHoldTicket}
                            disabled={holding}
                            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                            title="Tunda pengerjaan tiket ini untuk mengerjakan tiket lain"
                          >
                            <Pause className="w-3.5 h-3.5 text-amber-700" />
                            <span>{holding ? 'Menunda...' : 'Tunda Penilaian'}</span>
                          </button>
                        ) : (selectedTicket.status === 'PENDING' || selectedTicket.status === 'ASSIGNED') ? (
                          <button
                            type="button"
                            onClick={handleResumeTicket}
                            className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                            title="Mulai atau lanjutkan penilaian tiket ini"
                          >
                            <Play className="w-3.5 h-3.5 text-blue-700 fill-blue-700" />
                            <span>Mulai / Lanjutkan Dinilai</span>
                          </button>
                        ) : null}

                        {/* Skip Button */}
                        <button
                          type="button"
                          onClick={() => setShowSkipModal(true)}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-300 hover:border-rose-200 font-bold text-xs transition cursor-pointer active:scale-95"
                        >
                          Lewati (Skip)
                        </button>
                      </div>

                      {/* Supervisor Reassign */}
                      {isSupervisor && (
                        <button
                          type="button"
                          onClick={() => handleOpenReassignModal(selectedTicket)}
                          className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95 transition"
                          title="Pindahkan tiket ke QA lain"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Pindahkan (Reassign)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Parameter Scoring List */}
                  <div className="p-4 sm:p-5 space-y-4 max-h-[620px] overflow-y-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#0F2744]" />
                          Matriks Parameter Mutu ({activeParameters.length} Item - {selectedTicket.channel})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Tentukan kesesuaian SOP untuk setiap parameter di bawah ini:
                        </p>
                      </div>

                      {/* Bulk toggle buttons */}
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={handleSetAllPassed}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          Set Semua Sesuai (100%)
                        </button>
                        <button
                          type="button"
                          onClick={handleSetAllDeviasi}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200 transition cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <X className="w-3 h-3 text-rose-600" />
                          Semua Deviasi (0%)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {activeParameters.map((param) => {
                        const isPassed = paramScores[param.code] !== false;

                        return (
                          <div
                            key={param.code}
                            onClick={() => handleToggleParam(param.code, !isPassed)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${isPassed
                              ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                              : 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-200'
                              }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black flex-shrink-0 ${isPassed
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-rose-100 text-rose-800'
                                }`}>
                                {param.code}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-800 leading-snug">
                                  {param.name}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                  <span>Bobot Penilaian: <strong className="text-slate-700">{param.weight}%</strong></span>
                                  <span>•</span>
                                  <span className={`font-bold ${isPassed ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    {isPassed ? `Poin: +${param.weight}%` : 'Poin: 0% (Deviasi)'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Pass / Fail Toggle Buttons */}
                            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleParam(param.code, true)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${isPassed
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                                  }`}
                              >
                                <Check className="w-3.5 h-3.5" /> Sesuai
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleParam(param.code, false)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${!isPassed
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-400'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                                  }`}
                              >
                                <X className="w-3.5 h-3.5" /> Deviasi
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* FCR & Feedback Section */}
                    <div className="pt-4 border-t border-slate-200 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                            First Contact Resolution (FCR):
                          </label>
                          <span className="text-[11px] text-slate-500">Apakah kendala pelanggan terselesaikan tuntas pada kontak pertama?</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFcrValue('YA')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${fcrValue === 'YA'
                              ? 'bg-[#0F2744] text-white shadow-sm ring-2 ring-blue-300'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                              }`}
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>YA (FCR Tercapai)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFcrValue('TIDAK')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${fcrValue === 'TIDAK'
                              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                              }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>TIDAK (Perlu Eskalasi)</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-800">
                            Catatan Evaluasi & Rekomendasi Coaching untuk Agen:
                          </label>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleAddTemplateNote('SOP & greeting sesuai')}
                              className="px-2 py-0.5 text-[10px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                            >
                              + SOP Sesuai
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddTemplateNote('Perlu peningkatan probing')}
                              className="px-2 py-0.5 text-[10px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                            >
                              + Probing
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddTemplateNote('Pencatatan CRM perlu dilengkapi')}
                              className="px-2 py-0.5 text-[10px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                            >
                              + CRM Lengkap
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={evaluationNotes}
                          onChange={(e) => setEvaluationNotes(e.target.value)}
                          placeholder="Tuliskan temuan mutu, poin apresiasi, atau rekomendasi perbaikan untuk agen..."
                          rows={3}
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="p-4 sm:p-5 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200">
                    <div className="text-xs text-slate-700">
                      Hasil Nilai: <strong className={`font-mono text-base font-black ${calculatedScore >= 85 ? 'text-emerald-700' : 'text-rose-600'}`}>{calculatedScore}% CA</strong> • FCR: <strong className="text-[#0F2744]">{fcrValue}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSubmitEvaluation}
                        disabled={submitting}
                        className="btn-primary py-2 px-5 text-xs shadow-sm font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submitting ? 'Menyimpan...' : 'Simpan & Lanjut Tiket Berikutnya'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS (SKIP & REASSIGN)                                              */}
      {/* ========================================================================= */}

      {/* MODAL SKIP TICKET */}
      {showSkipModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="corp-card w-full max-w-md p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                Lewati Penilaian Tiket #{selectedTicket.ticket_id}
              </h3>
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Pilih alasan mengapa tiket ini tidak dapat dilakukan penilaian sampling:
              </p>

              <CustomSelect
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                options={[
                  { value: 'Recording Kosong / Silent Call', label: 'Recording Kosong / Silent Call' },
                  { value: 'Salah Routing Kanal / Unit', label: 'Salah Routing Kanal / Unit' },
                  { value: 'Kendala Audio / Rekaman Terputus', label: 'Kendala Audio / Rekaman Terputus' },
                  { value: 'Data Tiket Tidak Lengkap di CRM', label: 'Data Tiket Tidak Lengkap di CRM' },
                  { value: 'Lainnya', label: 'Alasan Lainnya (Input Manual)' }
                ]}
                className="w-full"
                buttonClassName="bg-white border-slate-300 py-2 text-xs"
              />

              {skipReason === 'Lainnya' && (
                <input
                  type="text"
                  value={customSkipReason}
                  onChange={(e) => setCustomSkipReason(e.target.value)}
                  placeholder="Ketik alasan spesifik..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                className="btn-secondary py-1.5 px-4 text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSkipTicket}
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer active:scale-95"
              >
                {submitting ? 'Memproses...' : 'Konfirmasi Lewati'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REASSIGN TICKET (SUPERVISOR ONLY) */}
      {showReassignModal && reassignTicketTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="corp-card w-full max-w-md p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Pindahkan Tiket #{reassignTicketTarget.ticket_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1">
                <div className="text-slate-600">
                  CSO: <strong className="text-slate-900">{formatAgentName(reassignTicketTarget.agent_name)}</strong> ({reassignTicketTarget.agent_nik})
                </div>
                <div className="text-slate-600">
                  Evaluator Asal: <strong className="text-purple-900">{reassignTicketTarget.evaluator_name || selectedQaEvaluator}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Pindahkan ke QA Evaluator Tujuan:
                </label>
                <CustomSelect
                  value={reassignForm.to_evaluator}
                  onChange={(e) => setReassignForm(prev => ({ ...prev, to_evaluator: e.target.value }))}
                  options={
                    monitoringData.evaluators.length > 0
                      ? monitoringData.evaluators
                        .filter(q => q.evaluator_name !== (reassignTicketTarget.evaluator_name || selectedQaEvaluator))
                        .map(q => ({
                          value: q.evaluator_name,
                          label: `${q.evaluator_name} (${q.completed_count}/${q.target_quota} Selesai)`
                        }))
                      : [
                        { value: 'ALMIRA PARAMITHA', label: 'ALMIRA PARAMITHA' },
                        { value: 'DEWI RIKA IRAWATI', label: 'DEWI RIKA IRAWATI' },
                        { value: 'DHITA KHARISMA', label: 'DHITA KHARISMA' },
                        { value: 'DIAN WAHYU WIBOWO', label: 'DIAN WAHYU WIBOWO' },
                        { value: 'FINA ANDRIYANI', label: 'FINA ANDRIYANI' },
                        { value: 'HANI DWI SURYO', label: 'HANI DWI SURYO' },
                        { value: 'IIN SUGIARTI', label: 'IIN SUGIARTI' },
                        { value: 'TIARA RAMADHANI', label: 'TIARA RAMADHANI' }
                      ]
                  }
                  className="w-full"
                  buttonClassName="bg-white border-slate-300 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Alasan Reassign / Catatan Audit:
                </label>
                <textarea
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ketik alasan pemindahan penugasan sampling..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="btn-secondary py-1.5 px-4 text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                disabled={reassigning || !reassignForm.to_evaluator}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
              >
                {reassigning ? 'Memindahkan...' : 'Konfirmasi Pindahkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QASamplingWorksheet;
