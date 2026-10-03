import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Filter,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Target,
  BarChart2,
  Users,
  RefreshCw,
  FolderOpen,
  AlignLeft,
  ArrowRight,
  Inbox,
  Layers,
  Play,
  Check,
  CheckCheck,
  XCircle,
  ArrowRightLeft,
  Search,
  AlertCircle,
  Info,
  ShieldCheck,
  ShieldAlert,
  Database,
  FileSpreadsheet,
  Clock,
  Sliders,
  ChevronRight,
  Sparkles,
  ExternalLink,
  History,
  X,
  PhoneCall,
  Mail,
  MessageSquare,
  Building2,
  Edit3,
  Upload,
  Download,
  Copy,
  FileUp,
  FileCheck2,
  Radio,
  SlidersHorizontal,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  UserCheck,
  UserX,
  CalendarDays,
  ToggleLeft,
  ToggleRight,
  Sun,
  Moon,
  Star,
  Save,
  Link2,
  GitCompare,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { CustomSelect } from '../components/common/CustomSelect';
import { SupervisorImportReminder } from '../components/common/SupervisorImportReminder';

export const AutoDistribution = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { showConfirm, showAlert, showToast } = useDialog();
  const role = user?.role || 'supervisor';
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';
  const isQA = role === 'quality_assurance' || role === 'qa';
  const isTL = role === 'team_leader' || role === 'tl';

  // Navigation & Sub-Tabs State
  const now = new Date();
  const currentRunningPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState('qa_bucket'); // 'qa_bucket' | 'target_breakdown' | 'reassign_logs'
  const [selectedMonth, setSelectedMonth] = useState(currentRunningPeriod);
  const [copiedId, setCopiedId] = useState(null);

  // Tab 1: QA Bucket & Auto Distribution State
  const [bucketData, setBucketData] = useState(null);
  const [loadingBucket, setLoadingBucket] = useState(false);
  const [selectedBucketQa, setSelectedBucketQa] = useState('all');
  const [bucketStatusFilter, setBucketStatusFilter] = useState('all');
  const [bucketTypeFilter, setBucketTypeFilter] = useState('all');
  const [bucketChannelFilter, setBucketChannelFilter] = useState('all');
  const [bucketSearch, setBucketSearch] = useState('');
  const [bucketPage, setBucketPage] = useState(1);
  const [distributing, setDistributing] = useState(false);

  // Tab 2: Site Target Breakdown State
  const [siteSummary, setSiteSummary] = useState(null);
  const [loadingSite, setLoadingSite] = useState(false);
  const [csoMatrix, setCsoMatrix] = useState([]);
  const [loadingCso, setLoadingCso] = useState(false);
  const [csoSearch, setCsoSearch] = useState('');
  const [csoQaFilter, setCsoQaFilter] = useState('all');
  const [csoChannelFilter, setCsoChannelFilter] = useState('all');
  const [generatingTarget, setGeneratingTarget] = useState(false);
  const [csoPage, setCsoPage] = useState(1);
  const [csoPerPage, setCsoPerPage] = useState(25);

  // Tab 3: Reassignment Logs State
  const [reassignmentLogs, setReassignmentLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Tab 4: Audit & Abandoned Tickets (> 7 Hari SLA) State
  const [monitoringData, setMonitoringData] = useState(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [abandonedSearch, setAbandonedSearch] = useState('');
  const [abandonedQaFilter, setAbandonedQaFilter] = useState('all');
  const [abandonedChannelFilter, setAbandonedChannelFilter] = useState('all');
  const [simulatingAbandon, setSimulatingAbandon] = useState(false);
  const [reopeningId, setReopeningId] = useState(null);

  // Modals & Action State
  const [actionModal, setActionModal] = useState(null); // { type: 'complete' | 'skip' | 'reassign' | 'import', ticket: obj }
  const [completeForm, setCompleteForm] = useState({ score_ca: 85, fcr: 'YA', notes: '' });
  const [skipReason, setSkipReason] = useState('Recording Kosong / Silent Call');
  const [customSkipReason, setCustomSkipReason] = useState('');
  const [reassignForm, setReassignForm] = useState({ to_evaluator: '', reason: '', reassigned_by: 'Supervisor QA' });
  const [submittingAction, setSubmittingAction] = useState(false);

  // Import & Dual-Matching State in Modul 7
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  // Slot 1: Tarikan iCRM (ListTicketingRetail 62 Kolom)
  const [icrmFile, setIcrmFile] = useState(null);
  const [icrmFileName, setIcrmFileName] = useState('');
  const [icrmFileSizeText, setIcrmFileSizeText] = useState('');
  const [icrmRows, setIcrmRows] = useState([]);

  // Slot 2: Tarikan Omni (Ticket Summary Iconnet IconPlus)
  const [omniFile, setOmniFile] = useState(null);
  const [omniFileName, setOmniFileName] = useState('');
  const [omniFileSizeText, setOmniFileSizeText] = useState('');
  const [omniRows, setOmniRows] = useState([]);

  // Dual Matching Result & Stats
  const [matchingResult, setMatchingResult] = useState({
    matched: [],
    unmatchedSmg: [],
    nonSmgRows: [],
    nonSmgCount: 0,
    noResponseRows: [],
    noResponseCount: 0,
    totalIcrm: 0,
    totalOmni: 0,
    totalOmniSmg: 0,
  });
  const [previewFilterTab, setPreviewFilterTab] = useState('matched'); // 'matched' | 'unmatched' | 'non_smg' | 'no_response' | 'all'
  const [previewSearchTerm, setPreviewSearchTerm] = useState('');
  const [injectSelection, setInjectSelection] = useState('matched_only'); // 'matched_only' | 'all_smg'

  const [importFile, setImportFile] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [importFileSizeText, setImportFileSizeText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('Auto');
  const [detectedChannel, setDetectedChannel] = useState('');
  const [importMode, setImportMode] = useState('upsert');
  const [parsedRows, setParsedRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingIcrm, setIsDraggingIcrm] = useState(false);
  const [isDraggingOmni, setIsDraggingOmni] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });
  const [injectLimitMode, setInjectLimitMode] = useState('custom'); // 'auto_need' | 'custom' | 'all'
  const [customInjectLimit, setCustomInjectLimit] = useState(1500);
  const [bufferReserveCount, setBufferReserveCount] = useState(50);
  const fileInputRef = useRef(null);
  const icrmFileInputRef = useRef(null);
  const omniFileInputRef = useRef(null);

  // Recall, Delete & Rollback State (Supervisor Only)
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [recallModalOpen, setRecallModalOpen] = useState(false);
  const [recallActiveTab, setRecallActiveTab] = useState('recall_queue'); // 'recall_queue' | 'import_batches'
  const [recallMode, setRecallMode] = useState('assigned_only'); // 'assigned_only' | 'all_sampling' | 'wipe_imported_data'
  const [recallChannel, setRecallChannel] = useState('all');
  const [recallEvaluator, setRecallEvaluator] = useState('all');
  const [importBatchesList, setImportBatchesList] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [recallingQueue, setRecallingQueue] = useState(false);
  const [rollingBackBatchId, setRollingBackBatchId] = useState(null);
  const [deletingTicketId, setDeletingTicketId] = useState(null);

  // Extra Quota & Daily Distribution State (Rule 1, Rule 2, Rule 3)
  const [distributingDaily, setDistributingDaily] = useState(false);
  const [showDailyDistModal, setShowDailyDistModal] = useState(false);
  const [dailyComposition, setDailyComposition] = useState({
    INFORMASI: 6,
    GANGGUAN: 7,
    KELUHAN: 6,
    PERMOHONAN: 1
  });
  const [dailyTargetDate, setDailyTargetDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dailyClearExisting, setDailyClearExisting] = useState(false);

  // Tab 5: QA Daily Readiness & Work Day Roster Tracking State (Rule 2)
  const [qaRosterData, setQaRosterData] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [togglingQaReadiness, setTogglingQaReadiness] = useState(null);
  const [rosterViewMode, setRosterViewMode] = useState('matrix'); // 'matrix' | 'cards'
  const [rosterSelectedDate, setRosterSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const dailyTotalPerQa = (Number(dailyComposition.INFORMASI) || 0) +
    (Number(dailyComposition.GANGGUAN) || 0) +
    (Number(dailyComposition.KELUHAN) || 0) +
    (Number(dailyComposition.PERMOHONAN) || 0);
  const activeDutyCount = qaRosterData?.summary?.active_duty_qas_count !== undefined
    ? qaRosterData.summary.active_duty_qas_count
    : 0;
  const dailyTotalSite = dailyTotalPerQa * activeDutyCount;

  const [showExtraQuotaModal, setShowExtraQuotaModal] = useState(false);
  const [extraQuotaActiveTab, setExtraQuotaActiveTab] = useState('requests'); // 'requests' | 'manual'

  // Bad Rating Distribution State (Revision Item 8)
  const [showBadRatingModal, setShowBadRatingModal] = useState(false);
  const [badRatingFile, setBadRatingFile] = useState(null);
  const [badRatingFileName, setBadRatingFileName] = useState('');
  const [badRatingUploading, setBadRatingUploading] = useState(false);
  const [badRatingPriority, setBadRatingPriority] = useState('HIGH');
  const [badRatingFilter, setBadRatingFilter] = useState('low_only'); // 'low_only' | 'all'
  const [badRatingAutoDistribute, setBadRatingAutoDistribute] = useState(true);
  const [badRatingParsedRows, setBadRatingParsedRows] = useState([]);
  const [badRatingStats, setBadRatingStats] = useState({ total: 0, bad: 0, neutral: 0, good: 0, channels: {} });
  const badRatingFileInputRef = useRef(null);

  // Dynamic Weekly Quota Targets State (Revision Item 5)
  const [showWeeklyTargetsModal, setShowWeeklyTargetsModal] = useState(false);
  const [weeklyTargets, setWeeklyTargets] = useState({
    w1: 90,
    w2: 90,
    w3: 95,
    w4: 95,
    w5: 0
  });
  const [loadingWeeklyTargets, setLoadingWeeklyTargets] = useState(false);
  const [savingWeeklyTargets, setSavingWeeklyTargets] = useState(false);
  const [extraQuotaTargetQa, setExtraQuotaTargetQa] = useState('');
  const [extraQuotaCount, setExtraQuotaCount] = useState(10);
  const [extraQuotaReason, setExtraQuotaReason] = useState('Penambahan kuota sampling harian / mitigasi backlog');
  const [pendingQuotaRequests, setPendingQuotaRequests] = useState([]);
  const [loadingQuotaRequests, setLoadingQuotaRequests] = useState(false);
  const [grantingQuota, setGrantingQuota] = useState(false);

  // Body overflow lock when any modal is active
  const isAnyModalOpen = importModalOpen || Boolean(actionModal) || recallModalOpen || showExtraQuotaModal || showDailyDistModal;

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyModalOpen]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`ID Tiket #${text} berhasil disalin!`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // -------------------------------------------------------------------------
  // Fetch Functions
  // -------------------------------------------------------------------------

  // Fetch Tab 1: QA Bucket
  const fetchBucketTickets = async (page = 1, silent = false) => {
    if (!silent && (!bucketData?.data || bucketData.data.length === 0)) {
      setLoadingBucket(true);
    }
    try {
      const res = await api.getSamplingBucketTickets({
        period: selectedMonth,
        evaluator: selectedBucketQa === 'all' ? '' : selectedBucketQa,
        status: bucketStatusFilter === 'all' ? '' : bucketStatusFilter,
        type: bucketTypeFilter === 'all' ? '' : bucketTypeFilter,
        channel: bucketChannelFilter === 'all' ? '' : bucketChannelFilter,
        search: bucketSearch,
        team_leader_id: (isTL && user?.team_leader_id) ? user.team_leader_id : undefined,
        page: page,
        per_page: 25
      });
      if (res?.success) {
        setBucketData(res);
        setBucketPage(page);
        if (res.daily_composition) {
          setDailyComposition({
            INFORMASI: Number(res.daily_composition.INFORMASI) ?? 6,
            GANGGUAN: Number(res.daily_composition.GANGGUAN) ?? 7,
            KELUHAN: Number(res.daily_composition.KELUHAN) ?? 6,
            PERMOHONAN: Number(res.daily_composition.PERMOHONAN) ?? 1,
          });
        }
      }
    } catch (e) {
      console.error('Error fetching bucket tickets:', e);
    } finally {
      if (!silent) setLoadingBucket(false);
    }
  };

  // Fetch Tab 2: Target Breakdown
  const fetchSiteSummary = async (silent = false) => {
    if (!silent && !siteSummary) {
      setLoadingSite(true);
    }
    try {
      const res = await api.getSamplingSiteSummary(selectedMonth);
      if (res?.success) {
        setSiteSummary(res.data);
      }
    } catch (e) {
      console.error('Error fetching site summary:', e);
    } finally {
      if (!silent) setLoadingSite(false);
    }
  };

  const fetchCsoTargets = async (silent = false) => {
    if (!silent && (!csoMatrix || csoMatrix.length === 0)) {
      setLoadingCso(true);
    }
    try {
      const res = await api.getSamplingCsoTargets(selectedMonth, csoQaFilter === 'all' ? '' : csoQaFilter);
      if (res?.success) {
        setCsoMatrix(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching CSO targets:', e);
    } finally {
      if (!silent) setLoadingCso(false);
    }
  };

  // Fetch Tab 3: Logs
  const fetchReassignmentLogs = async (silent = false) => {
    if (!silent && (!reassignmentLogs || reassignmentLogs.length === 0)) {
      setLoadingLogs(true);
    }
    try {
      const res = await api.getSamplingReassignmentLogs(selectedMonth);
      if (res?.success) {
        setReassignmentLogs(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching logs:', e);
    } finally {
      if (!silent) setLoadingLogs(false);
    }
  };

  // Fetch Tab 4: QA Monitoring & Abandoned Tickets (> 7 Hari)
  const fetchMonitoringData = async (silent = false) => {
    if (!silent && !monitoringData) {
      setLoadingMonitoring(true);
    }
    try {
      const res = await api.getSamplingQaMonitoring(selectedMonth);
      if (res?.success) {
        setMonitoringData(res);
      }
    } catch (e) {
      console.error('Error fetching QA monitoring data:', e);
    } finally {
      if (!silent) setLoadingMonitoring(false);
    }
  };

  // Fetch Tab 5 & Modal: QA Attendance & Readiness Roster (Rule 2)
  const fetchQaRoster = async (targetDate = null, silent = false) => {
    if (!silent && !qaRosterData) {
      setLoadingRoster(true);
    }
    try {
      const res = await api.getSamplingQaRoster(selectedMonth, targetDate || dailyTargetDate);
      if (res?.success) {
        setQaRosterData(res.data);
      }
    } catch (e) {
      console.error('Error fetching QA roster:', e);
    } finally {
      if (!silent) setLoadingRoster(false);
    }
  };

  const handleToggleQaReadiness = async (evaluatorName, currentStatus, targetDate = null) => {
    let nextStatus = 'ON_DUTY';
    if (currentStatus === 'ON_DUTY') {
      nextStatus = 'END_SHIFT';
    } else if (currentStatus === 'END_SHIFT') {
      nextStatus = 'OFF_DAY';
    } else {
      nextStatus = 'ON_DUTY';
    }
    setTogglingQaReadiness(evaluatorName);
    try {
      const isDuty = nextStatus === 'ON_DUTY';
      const res = await api.setSamplingQaReadiness({
        period: selectedMonth,
        evaluator_name: evaluatorName,
        date: targetDate || rosterSelectedDate || dailyTargetDate,
        status: nextStatus,
        is_ready: isDuty,
        pull_tickets: isDuty,
        notes: isDuty ? 'Bertugas / Siap (JIT Auto-Pull)' : (nextStatus === 'END_SHIFT' ? 'Shift Selesai (End Shift)' : 'Off Day / Libur')
      });
      if (res?.success) {
        if (isDuty && res.pulled_count > 0) {
          showToast(`🟢 ${evaluatorName}: ON DUTY (${res.pulled_count} tiket dialokasikan).`);
        } else if (nextStatus === 'END_SHIFT') {
          showToast(`🏁 ${evaluatorName}: END SHIFT.`);
        } else if (!isDuty && res.released_count > 0) {
          showToast(`⚪ ${evaluatorName}: OFF DAY (${res.released_count} tiket dilepas).`);
        } else {
          showToast(`${evaluatorName}: Status ${nextStatus}.`);
        }
        await fetchQaRoster(targetDate || rosterSelectedDate || dailyTargetDate, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal update status QA.', 'error');
    } finally {
      setTogglingQaReadiness(null);
    }
  };

  const handleSetSpecificQaStatus = async (evaluatorName, status, targetDate = null, notes = '', shift = null) => {
    setTogglingQaReadiness(evaluatorName);
    try {
      const isDuty = status === 'ON_DUTY';
      const res = await api.setSamplingQaReadiness({
        period: selectedMonth,
        evaluator_name: evaluatorName,
        date: targetDate || rosterSelectedDate || dailyTargetDate,
        status: status,
        is_ready: isDuty,
        pull_tickets: isDuty,
        shift: shift || undefined,
        notes: notes || (isDuty ? 'Bertugas / Siap (JIT Auto-Pull)' : (status === 'END_SHIFT' ? 'Shift Selesai (End Shift)' : `Status: ${status}`))
      });
      if (res?.success) {
        let msg = `${evaluatorName}: Status ${status}`;
        if (res.pulled_count > 0) msg += ` (${res.pulled_count} tiket dialokasikan)`;
        if (res.released_count > 0) msg += ` (${res.released_count} tiket dilepas)`;
        showToast(msg);
        await fetchQaRoster(targetDate || rosterSelectedDate || dailyTargetDate, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal update status QA.', 'error');
    } finally {
      setTogglingQaReadiness(null);
    }
  };

  const handleBulkSetAllDuty = async (isDuty = true) => {
    const status = isDuty ? 'ON_DUTY' : 'OFF_DAY';
    const targetDate = rosterSelectedDate || dailyTargetDate;
    const entries = (qaRosterData?.evaluators || []).map(evaluator => ({
      evaluator_name: evaluator.evaluator_name,
      date: targetDate,
      status: status,
      notes: isDuty ? 'Set Masuk Kerja Bersama (JIT Auto-Pull)' : 'Set Libur Bersama'
    }));
    setLoadingRoster(true);
    try {
      const res = await api.bulkUpdateSamplingQaRoster(selectedMonth, entries);
      if (res?.success) {
        showToast(res.message || `Semua QA di-set ${isDuty ? 'ON DUTY' : 'OFF DAY'}.`);
        await fetchQaRoster(targetDate, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal update roster massal.', 'error');
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleExecuteCutoffSweep = async (shift = null) => {
    const shiftLabel = shift ? (shift === 'Pagi' ? 'Shift Pagi (07:00 - 15:00)' : shift === 'Siang' ? 'Shift Siang (13:00 - 21:00)' : shift) : 'Semua Shift';
    const targetDate = rosterSelectedDate || dailyTargetDate;
    const ok = await showConfirm({
      title: `⚡ Eksekusi Cutoff Shift Protection (${shiftLabel})`,
      message: `Jalankan sapuan batas waktu cutoff shift untuk tanggal ${targetDate}?\n\n` +
        `• QA yang masih berstatus STANDBY / Belum Ready pada jadwal ini akan otomatis ditandai sebagai OFF DAY (Libur) / CUTI.\n` +
        `• Antrean mereka tetap BERSIH (0 tiket) sehingga TIDAK TERTRACK sebagai beban mangkrak atau terkena penalti SLA Abandoned.\n` +
        `• Tiket di pool database tetap aman dan dapat dialokasikan ke QA yang bertugas.\n` +
        `• Perubahan akan langsung disinkronkan secara real-time.`,
      type: 'warning',
      confirmText: 'Eksekusi Cutoff Shift',
    });
    if (!ok) return;

    setLoadingRoster(true);
    try {
      const res = await api.executeShiftCutoffSweep({
        period: selectedMonth,
        date: targetDate,
        shift: shift || null,
        target_status: 'OFF_DAY',
        notes: `Cutoff Sweep ${shiftLabel} otomatis oleh Supervisor`
      });

      if (res?.success) {
        showToast(res.message || `Cutoff: ${res.swept_count || 0} QA ditandai OFF DAY.`);
        await fetchQaRoster(targetDate, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal cutoff sweep.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal cutoff sweep.', 'error');
    } finally {
      setLoadingRoster(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers for Weekly Targets & Bad Rating Upload (Revision Items 5 & 8)
  // -------------------------------------------------------------------------
  const fetchWeeklyTargets = async () => {
    try {
      setLoadingWeeklyTargets(true);
      const res = await api.getWeeklyQuotaTargets(selectedMonth);
      const targets = res?.weekly_quota_targets || res?.weekly_targets || res?.data?.weekly_quota_targets || res?.data?.weekly_targets;
      if (targets) {
        setWeeklyTargets({
          w1: targets.w1 !== undefined ? targets.w1 : 90,
          w2: targets.w2 !== undefined ? targets.w2 : 90,
          w3: targets.w3 !== undefined ? targets.w3 : 95,
          w4: targets.w4 !== undefined ? targets.w4 : 95,
          w5: targets.w5 !== undefined ? targets.w5 : 0,
        });
      }
    } catch (err) {
      console.error('Error fetching weekly targets:', err);
    } finally {
      setLoadingWeeklyTargets(false);
    }
  };

  const handleSaveWeeklyTargets = async (e) => {
    e.preventDefault();
    try {
      setSavingWeeklyTargets(true);
      const payload = {
        period: selectedMonth,
        w1: Number(weeklyTargets.w1) || 0,
        w2: Number(weeklyTargets.w2) || 0,
        w3: Number(weeklyTargets.w3) || 0,
        w4: Number(weeklyTargets.w4) || 0,
        w5: Number(weeklyTargets.w5) || 0,
        weekly_quota_targets: weeklyTargets
      };
      const res = await api.saveWeeklyQuotaTargets(payload);
      if (res && res.success) {
        showToast('✓ Setting target kuota mingguan (W1-W5) berhasil diperbarui!');
        setShowWeeklyTargetsModal(false);
        fetchBucketTickets(bucketPage, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showAlert({ title: 'Gagal Menyimpan', message: res?.message || 'Gagal menyimpan target mingguan', type: 'error' });
      }
    } catch (err) {
      showAlert({ title: 'Gagal Menyimpan', message: err.response?.data?.message || err.message, type: 'error' });
    } finally {
      setSavingWeeklyTargets(false);
    }
  };

  // Download Template Bad Rating Excel (Matched to DATA BADRATTING template)
  const handleDownloadBadRatingTemplate = () => {
    try {
      const templateHeaders = [
        'User',
        'Agent',
        'Rating',
        'Channel',
        'Advice',
        'Ticket Number',
        'Date'
      ];

      const sampleData = [
        templateHeaders,
        ['211100254328-Seno Prayudi', 'SMG ANOM WIDODO', 1, 'Webhook', 'Pelayanan lambat dan kurang ramah', 8243057, '22-09-2026 23:42:49'],
        ['Rahmawati', 'SMG MUHAMMAD ABDULHAFIZH AL MUTASHIM', 2, 'Official Account Whatsapp Coster', 'Penjelasan informasi agent kurang jelas', 8242988, '22-09-2026 23:09:07'],
        ['111001025678 Setiyo Setiyo', 'Smg Sugeng Riyadi', 1, 'Instagram Direct Message', 'Masalah kendala tagihan belum terselesaikan', 8242979, '22-09-2026 22:52:33'],
        ['Ell', 'SMG AFI FACHMI NOOR ZEIN', 2, 'Official Account Whatsapp Coster', 'Respon chat sangat lambat', 8242963, '22-09-2026 22:52:31'],
        ['Budi Santoso', 'SMG DWI CAHYONO', 3, 'Official Account Whatsapp Coster', 'Cukup ramah tapi solusi agak berbelit', 8242950, '22-09-2026 21:15:00'],
        ['Siti Rahayu', 'SMG ANOM WIDODO', 5, 'Webhook', 'Pelayanan sangat cepat dan solutif', 8242940, '22-09-2026 20:45:10']
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      ws['!cols'] = [
        { wch: 32 }, // User
        { wch: 38 }, // Agent
        { wch: 10 }, // Rating
        { wch: 34 }, // Channel
        { wch: 48 }, // Advice
        { wch: 18 }, // Ticket Number
        { wch: 22 }, // Date
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Bad Rating');
      XLSX.writeFile(wb, `Template_Data_Bad_Rating_${selectedMonth || '2026-09'}.xlsx`);
      showToast('✓ Template data bad rating (.xlsx) berhasil diunduh!');
    } catch (err) {
      showAlert({ title: 'Gagal Unduh Template', message: err.message, type: 'error' });
    }
  };

  const handleBadRatingFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBadRatingFile(file);
    setBadRatingFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData && rawData.length > 0) {
          let badCount = 0;
          let neutralCount = 0;
          let goodCount = 0;
          const channelMap = {};

          const parsed = rawData.map((r, idx) => {
            const user = String(r['User'] || r['user'] || r['Pelanggan'] || r['Nama Pelanggan'] || r['customer_name'] || '').trim();
            const agent = String(r['Agent'] || r['agent'] || r['Nama Agent'] || r['cso'] || r['agent_name'] || '').trim();
            const ratingRaw = r['Rating'] !== undefined ? r['Rating'] : (r['rating'] !== undefined ? r['rating'] : (r['CSAT'] || r['csat_rating'] || 1));
            const rating = Number(ratingRaw) || 1;
            const channel = String(r['Channel'] || r['channel'] || r['Layanan'] || r['Kanal'] || 'Inbound').trim();
            const advice = String(r['Advice'] || r['advice'] || r['Alasan'] || r['Keluhan'] || r['bad_rating_reason'] || r['Saran'] || '').trim();
            const ticketNumber = String(r['Ticket Number'] || r['ticket_number'] || r['ID Tiket'] || r['ticket_id'] || r['No Tiket'] || `BR-${idx + 1}`).trim();
            const date = String(r['Date'] || r['date'] || r['Tanggal'] || r['Tgl Transaksi'] || r['transaction_at'] || '').trim();

            if (rating <= 2) badCount++;
            else if (rating === 3) neutralCount++;
            else goodCount++;

            channelMap[channel] = (channelMap[channel] || 0) + 1;

            return {
              'User': user || 'Pelanggan',
              'Agent': agent || 'Agent CSO',
              'Rating': rating,
              'Channel': channel,
              'Advice': advice,
              'Ticket Number': ticketNumber,
              'Date': date,
              ticket_id: ticketNumber,
              customer_name: user,
              agent_name: agent,
              csat_rating: rating,
              channel: channel,
              bad_rating_reason: advice,
              transaction_at: date
            };
          }).filter(r => r.ticket_id && r.agent_name);

          setBadRatingParsedRows(parsed);
          setBadRatingStats({
            total: parsed.length,
            bad: badCount,
            neutral: neutralCount,
            good: goodCount,
            channels: channelMap
          });
        } else {
          setBadRatingParsedRows([]);
          setBadRatingStats({ total: 0, bad: 0, neutral: 0, good: 0, channels: {} });
          showAlert({ title: 'File Kosong', message: 'File Excel tidak berisi data baris transaksi.', type: 'warning' });
        }
      } catch (err) {
        console.error('Error reading bad rating preview:', err);
        showAlert({ title: 'Gagal Membaca File', message: 'Pastikan file memiliki format Excel/CSV yang valid.', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUploadBadRatingSubmit = async (e) => {
    e.preventDefault();
    if (!badRatingParsedRows || badRatingParsedRows.length === 0) {
      showAlert({ title: 'File Belum Dipilih', message: 'Silakan pilih file Excel data bad rating terlebih dahulu.', type: 'warning' });
      return;
    }

    const rowsToSubmit = badRatingFilter === 'low_only'
      ? badRatingParsedRows.filter(r => r.csat_rating <= 3)
      : badRatingParsedRows;

    if (rowsToSubmit.length === 0) {
      showAlert({ title: 'Tidak Ada Data Terpilih', message: 'Tidak ada baris dengan Rating 1-3 pada file ini untuk diimpor.', type: 'warning' });
      return;
    }

    try {
      setBadRatingUploading(true);
      const res = await api.uploadBadRatingData({
        rows: rowsToSubmit,
        period: selectedMonth,
        auto_distribute: badRatingAutoDistribute,
        priority: badRatingPriority
      });

      if (res && res.success) {
        showToast(res.message || `✓ ${res.imported_count || rowsToSubmit.length} data bad rating berhasil diunggah & dialokasikan ke antrean QA!`);
        setShowBadRatingModal(false);
        setBadRatingFile(null);
        setBadRatingFileName('');
        setBadRatingParsedRows([]);
        setBadRatingStats({ total: 0, bad: 0, neutral: 0, good: 0, channels: {} });
        fetchBucketTickets(bucketPage, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showAlert({ title: 'Gagal Upload Bad Rating', message: res?.message || 'Gagal memproses file', type: 'error' });
      }
    } catch (err) {
      showAlert({ title: 'Gagal Upload Bad Rating', message: err.response?.data?.message || err.message, type: 'error' });
    } finally {
      setBadRatingUploading(false);
    }
  };

  const handleSimulateExpireStale = async () => {
    const ok = await showConfirm({
      title: '⚡ Simulasikan Kedaluwarsa SLA (> 7 Hari)',
      message: `Jalankan simulasi otomatis untuk tiket yang belum dikerjakan lebih dari 7 hari (1 minggu)?\n\nTiket yang melewati batas waktu 7 hari akan otomatis beralih status ke ABANDONED, tersimpan di histori pengerjaan QA, dan masuk ke radar monitoring kedisiplinan Supervisor.`,
      type: 'warning',
      confirmText: 'Jalankan Simulasi Sekarang',
    });
    if (!ok) return;

    setSimulatingAbandon(true);
    try {
      const res = await api.simulateExpireStale({
        period: selectedMonth,
        force_simulate: true,
        days_ago: 8,
        limit: 20
      });
      if (res?.success) {
        showToast(res.message || 'Simulasi SLA selesai.');
        fetchMonitoringData(true);
        fetchBucketTickets(bucketPage, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal simulasi SLA.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal simulasi SLA.', 'error');
    } finally {
      setSimulatingAbandon(false);
    }
  };

  const handleReopenAbandoned = async (ticket) => {
    const ok = await showConfirm({
      title: 'Reopen Tiket Abandoned',
      message: `Buka kembali tiket #${ticket.ticket_id} (CSO: ${ticket.agent_name}) ke antrean aktif QA Evaluator ${ticket.evaluator_name}?`,
      type: 'info',
      confirmText: 'Ya, Reopen Tiket',
    });
    if (!ok) return;

    setReopeningId(ticket.id);
    try {
      const res = await api.reopenSamplingAssignment(ticket.id, 'Reopen tiket abandoned oleh Supervisor');
      if (res?.success) {
        showToast(res.message || `Tiket #${ticket.ticket_id} di-reopen.`);
        fetchMonitoringData(true);
        fetchBucketTickets(bucketPage, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal me-reopen tiket.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal me-reopen tiket.', 'error');
    } finally {
      setReopeningId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers & Actions
  // -------------------------------------------------------------------------

  const handleRunAutoDistribution = async () => {
    setDistributing(true);
    try {
      const res = await api.distributeSamplingTickets(selectedMonth);
      if (res?.success) {
        showToast(res.message || 'Distribusi sampling berhasil.');
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal distribusi sampling.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal distribusi sampling.', 'error');
    } finally {
      setDistributing(false);
    }
  };

  // Kustomisasi Komposisi & Auto-Distribusi Harian
  const handleCompositionChange = (category, value) => {
    const val = Math.max(0, parseInt(value, 10) || 0);
    setDailyComposition(prev => ({
      ...prev,
      [category]: val
    }));
  };

  const handleStepComposition = (category, delta) => {
    setDailyComposition(prev => ({
      ...prev,
      [category]: Math.max(0, (Number(prev[category]) || 0) + delta)
    }));
  };

  const handleResetCompositionToDefault = () => {
    setDailyComposition({
      INFORMASI: 6,
      GANGGUAN: 7,
      KELUHAN: 6,
      PERMOHONAN: 1
    });
    showToast('Komposisi harian dikembalikan ke standar (6 Info, 7 Ggn, 6 Kel, 1 Perm = 20 Tiket).');
  };

  const handleExecuteDailyDistribution = async (e) => {
    if (e) e.preventDefault();
    if (dailyTotalPerQa <= 0) {
      showToast('Total kuota harian per QA harus minimal 1 tiket', 'error');
      return;
    }

    setDistributingDaily(true);
    try {
      const res = await api.distributeDailySampling(selectedMonth, {
        target_date: dailyTargetDate,
        clear_existing: dailyClearExisting,
        category_targets: dailyComposition,
      });
      if (res?.success) {
        showToast(res.message || `Distribusi harian (${dailyTotalPerQa} tiket/QA) berhasil.`);
        setShowDailyDistModal(false);
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Distribusi harian gagal.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Distribusi harian gagal.', 'error');
    } finally {
      setDistributingDaily(false);
    }
  };

  // Fetch Quota Requests from QA
  const fetchPendingQuotaRequests = async () => {
    setLoadingQuotaRequests(true);
    try {
      const res = await api.getSamplingQuotaRequests(selectedMonth);
      if (res?.success) {
        setPendingQuotaRequests(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching quota requests:', e);
    } finally {
      setLoadingQuotaRequests(false);
    }
  };

  // Grant Extra Quota (SPV Access - 1 Day Expiration)
  const handleGrantExtraQuotaSubmit = async (e) => {
    if (e) e.preventDefault();
    setGrantingQuota(true);
    try {
      const res = await api.grantExtraQuota({
        period: selectedMonth,
        evaluator_name: extraQuotaTargetQa,
        extra_count: parseInt(extraQuotaCount, 10) || 10,
        reason: extraQuotaReason
      });
      if (res?.success) {
        showToast(`+${extraQuotaCount} tiket untuk ${extraQuotaTargetQa} berhasil ditambahkan.`);
        setShowExtraQuotaModal(false);
        fetchBucketTickets(1);
        fetchPendingQuotaRequests();
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menambah kuota.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal menambah kuota.', 'error');
    } finally {
      setGrantingQuota(false);
    }
  };

  // Approve Quota Request from QA
  const handleApproveQuotaRequest = async (req) => {
    setGrantingQuota(true);
    try {
      const res = await api.grantExtraQuota({
        period: selectedMonth,
        evaluator_name: req.evaluator_name,
        extra_count: req.requested_count || 10,
        reason: req.reason || 'Persetujuan SPV atas permintaan kuota QA',
        quota_request_id: req.id
      });
      if (res?.success) {
        showToast(`Kuota QA ${req.evaluator_name} (+${req.requested_count} tiket) disetujui.`);
        fetchPendingQuotaRequests();
        fetchBucketTickets(1);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menyetujui kuota.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal menyetujui kuota.', 'error');
    } finally {
      setGrantingQuota(false);
    }
  };

  // Selection Handlers (Multi-Select Recall)
  const toggleSelectAll = (checked) => {
    if (checked && bucketData?.data) {
      setSelectedTicketIds(bucketData.data.map(t => t.id));
    } else {
      setSelectedTicketIds([]);
    }
  };

  const toggleSelectTicket = (id) => {
    setSelectedTicketIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingleTicket = async (ticket) => {
    const ok = await showConfirm({
      title: 'Tarik Tiket Sampling',
      message: `Tarik / Hapus tiket #${ticket.ticket_id || ticket.id} dari antrean sampling QA?`,
      type: 'warning',
      confirmText: 'Ya, Tarik Tiket',
    });
    if (!ok) return;
    setDeletingTicketId(ticket.id);
    try {
      const res = await api.deleteSamplingAssignment(ticket.id);
      if (res?.success) {
        showToast(res.message || `Tiket #${ticket.ticket_id} berhasil ditarik.`);
        setSelectedTicketIds(prev => prev.filter(id => id !== ticket.id));
        fetchBucketTickets(bucketPage);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menarik tiket', 'error');
      }
    } catch (e) {
      showToast('Gagal menarik tiket', 'error');
    } finally {
      setDeletingTicketId(null);
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedTicketIds.length === 0) return;
    const ok = await showConfirm({
      title: 'Tarik Tiket Terpilih',
      message: `Yakin ingin menarik / menghapus ${selectedTicketIds.length} tiket terpilih dari antrean sampling?`,
      type: 'warning',
      confirmText: `Tarik ${selectedTicketIds.length} Tiket`,
    });
    if (!ok) return;
    setSubmittingAction(true);
    try {
      const res = await api.bulkDeleteSamplingAssignments(selectedTicketIds);
      if (res?.success) {
        showToast(res.message || `${selectedTicketIds.length} tiket terpilih berhasil ditarik.`);
        setSelectedTicketIds([]);
        fetchBucketTickets(bucketPage);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menarik tiket terpilih', 'error');
      }
    } catch (e) {
      showToast('Gagal menarik tiket terpilih', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const fetchImportBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await api.getSamplingImportBatches(selectedMonth);
      if (res?.success) {
        setImportBatchesList(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching import batches:', e);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleRecallQueueSubmit = async (e) => {
    e.preventDefault();
    let confirmTitle = 'Konfirmasi Penarikan Tiket';
    let confirmMsg = 'Konfirmasi penarikan tiket sampling?';
    let confirmType = 'warning';
    if (recallMode === 'assigned_only') {
      confirmMsg = 'Tarik seluruh tiket yang belum dinilai (ASSIGNED / IN PROGRESS) dari antrean QA?';
    } else if (recallMode === 'all_sampling') {
      confirmMsg = `Kosongkan SELURUH antrean sampling periode ${selectedMonth}?`;
      confirmType = 'danger';
    } else if (recallMode === 'wipe_imported_data') {
      confirmTitle = 'Peringatan Penghapusan Data';
      confirmMsg = `PERINGATAN: Tarik antrean dan HAPUS SELURUH data tarikan asesmen yang diimpor pada periode ${selectedMonth}? Tindakan ini tidak dapat dibatalkan.`;
      confirmType = 'danger';
    }
    const ok = await showConfirm({
      title: confirmTitle,
      message: confirmMsg,
      type: confirmType,
      confirmText: 'Ya, Lanjutkan',
    });
    if (!ok) return;

    setRecallingQueue(true);
    try {
      const res = await api.recallSamplingBucket({
        period: selectedMonth,
        mode: recallMode,
        channel: recallChannel,
        evaluator: recallEvaluator
      });
      if (res?.success) {
        showToast(res.message || 'Data antrean berhasil ditarik.');
        setRecallModalOpen(false);
        setSelectedTicketIds([]);
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menarik antrean.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal menarik antrean.', 'error');
    } finally {
      setRecallingQueue(false);
    }
  };

  const handleRollbackBatch = async (batch) => {
    const ok = await showConfirm({
      title: 'Rollback Berkas Impor',
      message: `Yakin ingin menarik / me-rollback berkas "${batch.file_name}"?\n\nSeluruh data raw asesmen dan penugasan tiket sampling (${batch.assessment_count || 0} asesmen) yang berasal dari berkas ini akan dihapus bersih.`,
      type: 'danger',
      confirmText: 'Rollback & Hapus Data',
    });
    if (!ok) return;
    setRollingBackBatchId(batch.id);
    try {
      const res = await api.rollbackSamplingBatch(batch.id, selectedMonth);
      if (res?.success) {
        showToast(res.message || `Berkas ${batch.file_name} di-rollback.`);
        fetchImportBatches();
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal rollback berkas.', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Gagal rollback berkas.', 'error');
    } finally {
      setRollingBackBatchId(null);
    }
  };

  const handleClearBucket = async () => {
    const ok = await showConfirm({
      title: 'Kosongkan Antrian Sampling',
      message: 'Kosongkan semua antrian tiket sampling di bucket?\n\nStatus antrian akan kembali bersih (0 tiket).',
      type: 'danger',
      confirmText: 'Kosongkan Antrian',
    });
    if (!ok) return;
    try {
      const res = await api.clearSamplingBucket(selectedMonth);
      if (res?.success) {
        showToast(res.message || 'Antrian tiket sampling berhasil dikosongkan!');
        setSelectedTicketIds([]);
        fetchBucketTickets(1);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal mengosongkan antrian', 'error');
      }
    } catch (e) {
      showToast('Gagal mengosongkan antrian', 'error');
    }
  };

  const handleGenerateTargets = async () => {
    setGeneratingTarget(true);
    try {
      const res = await api.generateSamplingTargets(selectedMonth);
      if (res?.success) {
        showToast(res.message || 'Snapshot target berhasil diperbarui!');
        fetchSiteSummary();
        fetchCsoTargets();
      }
    } catch (e) {
      showToast('Gagal men-generate snapshot target', 'error');
    } finally {
      setGeneratingTarget(false);
    }
  };

  const handleStartTicket = async (ticketId) => {
    try {
      const res = await api.startSamplingAssignment(ticketId);
      if (res?.success) {
        showToast(`Tiket #${res.data?.ticket_id || ticketId} mulai dinilai.`);
        fetchBucketTickets(bucketPage);
      }
    } catch (e) {
      showToast('Gagal memulai penilaian tiket', 'error');
    }
  };

  const handleOpenCompleteModal = (ticket) => {
    setCompleteForm({
      score_ca: ticket.score_ca !== null && ticket.score_ca !== undefined ? ticket.score_ca : 85,
      fcr: ticket.fcr || 'YA',
      notes: ''
    });
    setActionModal({ type: 'complete', ticket });
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal?.ticket) return;
    setSubmittingAction(true);
    try {
      const res = await api.completeSamplingAssignment(actionModal.ticket.id, completeForm);
      if (res?.success) {
        showToast(`Penilaian tiket #${actionModal.ticket.ticket_id} berhasil diselesaikan!`);
        setActionModal(null);
        fetchBucketTickets(bucketPage);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menyimpan penilaian tiket', 'error');
      }
    } catch (e) {
      showToast('Gagal menyimpan penilaian tiket', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSkipSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal?.ticket) return;
    const finalReason = skipReason === 'Lainnya' ? customSkipReason : skipReason;
    if (!finalReason) {
      showToast('Harap pilih atau masukkan alasan skip', 'error');
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await api.skipSamplingAssignment(actionModal.ticket.id, finalReason);
      if (res?.success) {
        showToast(`Tiket #${actionModal.ticket.ticket_id} telah dilewati (SKIPPED).`);
        setActionModal(null);
        fetchBucketTickets(bucketPage);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal melewati tiket', 'error');
      }
    } catch (e) {
      showToast('Gagal melewati tiket', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal?.ticket) return;
    if (!reassignForm.to_evaluator) {
      showToast('Pilih evaluator tujuan', 'error');
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await api.reassignSamplingAssignment(actionModal.ticket.id, reassignForm);
      if (res?.success) {
        showToast(`Tiket #${actionModal.ticket.ticket_id} berhasil dipindahkan ke ${reassignForm.to_evaluator}`);
        setActionModal(null);
        fetchBucketTickets(bucketPage);
        fetchReassignmentLogs();
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal memindahkan tiket', 'error');
      }
    } catch (e) {
      showToast('Gagal memindahkan tiket', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // -------------------------------------------------------------------------
  // Excel File Parsing & Direct Import Logic (Supports QSF & ListTicketingRetail)
  // -------------------------------------------------------------------------

  const RETAIL_TICKET_HEADERS = [
    'idtiket', 'idpelanggan', 'idinsiden', 'namapelanggan', 'sidbaru', 'sidlama', 'idpln',
    'namakelompok', 'namakondisi', 'namasbu', 'namakp', 'telepon', 'namapelapor', 'isilaporan',
    'tanggapan', 'status', 'waktugangguan', 'penerimalaporan', 'produk', 'posisitiket', 'idolt',
    'brandolt', 'idsplitter', 'penyebab', 'penyebabdetail', 'namamitra', 'petugaslapangan',
    'tipetiket', 'laporanberulang', 'gangguanke', 'namasumber', 'segmenicon', 'waktulapor',
    'waktulaporanselesai', 'durasilaporan', 'durasilaporanmenit', 'waktugangguan',
    'waktugangguanselesai', 'durasigangguan', 'durasigangguanmenit', 'durasistopclock',
    'durasigangguaminusstopclock', 'endcustomer', 'durasistopclockpelanggan',
    'durasigangguanminusstopclockpelanggan', 'keteranganclose', 'segmenpelanggan', 'bandwidth',
    'lastkomen', 'latlongpelanggan', 'provinsipelanggan', 'kabupatenpelanggan',
    'kecamatanpelanggan', 'kelurahanpelanggan', 'latlongsplitter', 'provinsisplitter',
    'kabupatensplitter', 'kecamatansplitter', 'kelurahansplitter', 'vip', 'tanggalinsiden',
    'tanggalsendnoc'
  ];

  const handleDownloadRetailTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([RETAIL_TICKET_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ListTicketingRetail');
    XLSX.writeFile(wb, 'Template_ListTicketingRetail_Kosong_62_Kolom.xlsx');
    showToast('Template Excel Kosong (62 Kolom CRM Ticketing Retail) berhasil diunduh!');
  };

  const handleExportQABucketExcel = async () => {
    try {
      showToast('Menyiapkan berkas ekspor antrean sampling QA...');
      const res = await api.getSamplingBucketTickets({
        period: selectedMonth,
        evaluator: selectedBucketQa === 'all' ? '' : selectedBucketQa,
        status: bucketStatusFilter === 'all' ? '' : bucketStatusFilter,
        type: bucketTypeFilter === 'all' ? '' : bucketTypeFilter,
        channel: bucketChannelFilter === 'all' ? '' : bucketChannelFilter,
        search: bucketSearch,
        per_page: 5000
      });

      const ticketsToExport = res?.data || bucketData?.data || [];
      if (ticketsToExport.length === 0) {
        showAlert({ title: 'Tidak Ada Data', message: 'Tidak ada tiket dalam antrean untuk diekspor.', type: 'warning' });
        return;
      }

      const rows = ticketsToExport.map((t, idx) => ({
        'No': idx + 1,
        'ID Tiket Omni': t.ticket_id || '-',
        'ID Tiket iCRM': t.source_ca || t.idca || '-',
        'Tgl Omni': t.transaction_at || '-',
        'Kanal / Saluran': t.channel || '-',
        'Nama CSO': t.agent_name || '-',
        'NIK CSO': t.agent_nik || '-',
        'Site': t.site_name || 'Semarang',
        'Kategori': t.category_name || '-',
        'Sub Kategori': t.sub_category_name || '-',
        'Pelanggan': t.customer_name || '-',
        'QA Evaluator': t.evaluator_name || '-',
        'Jenis Kuota': t.assignment_type === 'MANDATORY' ? 'Wajib (Mandatory)' : 'Tambahan (Additional)',
        'Status': t.status_label || t.status || 'BELUM DICEK',
        'Tgl Ditugaskan': t.assigned_date_formatted || t.assigned_at || '-',
        'SLA Berlaku': t.sla_remaining_days || 'Aktif',
        'Skor CA': t.score_ca !== null && t.score_ca !== undefined ? t.score_ca : '-',
        'FCR': t.fcr || '-',
        'Catatan / Note': t.summary || t.notes || '-'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
        { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 20 },
        { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
        { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 35 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Antrean_Sampling_QA');

      const fileName = `DigiQA_Antrean_Sampling_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`✓ Berhasil mengunduh ${rows.length} tiket sampling ke Excel!`);
    } catch (e) {
      console.error('Export error:', e);
      showToast('Gagal mengekspor data ke Excel', 'error');
    }
  };

  const handleExportCsoMatrixExcel = () => {
    try {
      const dataToExport = filteredCsoMatrix.length > 0 ? filteredCsoMatrix : csoMatrix;
      if (!dataToExport || dataToExport.length === 0) {
        showAlert({ title: 'Tidak Ada Data', message: 'Tidak ada data matriks CSO untuk diekspor.', type: 'warning' });
        return;
      }

      const rows = dataToExport.map((cso, idx) => {
        const targetSessions = cso.target_sessions ?? cso.target_sampling ?? 2;
        const completedSessions = cso.completed_sessions ?? cso.actual_sampling ?? 0;
        const achievementPct = targetSessions > 0
          ? Math.round((completedSessions / targetSessions) * 100)
          : (cso.achievement_pct ? Math.round(cso.achievement_pct) : 0);
        const avgCaText = (cso.avg_score_ca !== null && cso.avg_score_ca !== undefined)
          ? cso.avg_score_ca
          : (cso.avg_ca !== null && cso.avg_ca !== undefined ? cso.avg_ca : '-');
        const statusText = cso.status || (completedSessions >= targetSessions ? 'COMPLETED' : 'IN PROGRESS');

        return {
          'No': idx + 1,
          'Nama CSO': cso.agent_name || '-',
          'NIK CSO': cso.nik || '-',
          'Kanal / Saluran': cso.channel || 'Inbound',
          'Target Sampling (Sesi)': targetSessions,
          'Realisasi Selesai (Sesi)': completedSessions,
          'Pencapaian (%)': `${achievementPct}%`,
          'Rata-Rata CA (%)': avgCaText,
          'Status Sampling': statusText,
          'Periode': selectedMonth
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 }, { wch: 28 }, { wch: 18 }, { wch: 16 },
        { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
        { wch: 18 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Matriks_Sampling_CSO');
      const fileName = `DigiQA_Matriks_Sampling_CSO_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`✓ Berhasil mengunduh ${rows.length} data Matriks CSO ke Excel!`);
    } catch (e) {
      console.error('Export CSO matrix error:', e);
      showToast('Gagal mengekspor Matriks CSO ke Excel', 'error');
    }
  };

  const handleExportAbandonedExcel = () => {
    try {
      const tickets = monitoringData?.abandoned_tickets || [];
      if (tickets.length === 0) {
        showAlert({ title: 'Tidak Ada Data', message: 'Tidak ada tiket abandoned pada periode ini.', type: 'info' });
        return;
      }

      const rows = tickets.map((t, idx) => ({
        'No': idx + 1,
        'ID Tiket': t.ticket_id || '-',
        'QA Evaluator': t.evaluator_name || '-',
        'Nama CSO': t.agent_name || '-',
        'NIK CSO': t.agent_nik || '-',
        'Site': t.agent_site || 'Semarang',
        'Saluran': t.channel || 'Inbound',
        'Kategori': t.category_name || '-',
        'Tgl Ditugaskan': t.assigned_date_formatted || t.assigned_at || '-',
        'Tgl Abandoned': t.abandoned_time_display || t.abandoned_at || '-',
        'Hari Terbengkalai': `${t.days_unhandled || 7} hari`,
        'Alasan / Catatan': t.skip_reason || t.notes || 'Melewati batas waktu pengerjaan 7 hari SLA'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 }, { wch: 18 }, { wch: 24 }, { wch: 28 },
        { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
        { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 45 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Audit_Tiket_Abandoned');
      const fileName = `DigiQA_Audit_Tiket_Abandoned_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`✓ Berhasil mengunduh ${rows.length} data tiket abandoned ke Excel!`);
    } catch (e) {
      console.error('Export abandoned error:', e);
      showToast('Gagal mengekspor data tiket abandoned ke Excel', 'error');
    }
  };

  const handleExportRosterExcel = () => {
    try {
      const rosterList = qaRosterData?.evaluators || [];
      if (rosterList.length === 0) {
        showAlert({ title: 'Tidak Ada Data', message: 'Tidak ada data jadwal/roster untuk diekspor.', type: 'info' });
        return;
      }

      const rows = rosterList.map((ev, idx) => ({
        'No': idx + 1,
        'Nama QA Evaluator': ev.evaluator_name || '-',
        'Shift Kerja': ev.shift || 'Normal',
        'Status Kesiapan': ev.duty_status_label || ev.duty_status || (ev.is_on_duty ? 'ON DUTY' : 'OFF DAY'),
        'Jam Ready': ev.ready_time ? `${ev.ready_time} WIB` : '-',
        'Jam End Shift': ev.end_shift_time ? `${ev.end_shift_time} WIB` : '-',
        'Tiket Ditugaskan Hari Ini': ev.today_assigned || 0,
        'Tiket Selesai Hari Ini': ev.today_completed || 0,
        'Total Tiket Bulan Ini': ev.total_distributed || 0,
        'Hari Kerja Bulan Ini': ev.total_duty_days || 0,
        'Penyelesaian Bulan Ini': `${ev.total_completed || 0} (${ev.completion_rate_pct || 0}%)`,
        'Catatan': ev.notes || '-'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 20 },
        { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 22 },
        { wch: 22 }, { wch: 20 }, { wch: 24 }, { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Jadwal_Kesiapan_QA');
      const fileName = `DigiQA_Jadwal_Kesiapan_QA_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`✓ Berhasil mengunduh ${rows.length} data jadwal kesiapan QA ke Excel!`);
    } catch (e) {
      console.error('Export roster error:', e);
      showToast('Gagal mengekspor data roster ke Excel', 'error');
    }
  };

  const detectChannelFromFileName = (name = '', rows = null) => {
    const lower = name.toLowerCase();
    if (lower.includes('naker') || lower.includes('plotting') || lower.includes('database all naker') || lower.includes('databased all naker')) {
      return 'NAKER';
    }
    if (lower.includes('listticketing') || lower.includes('ticketingretail') || lower.includes('retail') || lower.includes('tarikan') || lower.includes('crm')) {
      return 'Auto';
    }
    if (lower.includes('email out') || lower.includes('email_out') || lower.includes('outbound email')) {
      return 'Email Outbound';
    }
    if (lower.includes('email') || lower.includes('em_') || lower.includes('mail')) {
      return 'Email';
    }
    if (lower.includes('digilive') || lower.includes('chat') || lower.includes('livechat')) {
      return 'Digilive';
    }
    if (lower.includes('socmed') || lower.includes('sosmed') || lower.includes('social') || lower.includes('instagram') || lower.includes('twitter') || lower.includes('facebook') || lower.includes('whatsapp') || lower.includes('google play')) {
      return 'Socmed';
    }
    if (lower.includes('outbound call') || lower.includes('outbond call') || lower.includes('obc') || lower.includes('outbound') || lower.includes('outbond')) {
      return 'Outbound Call';
    }
    if (lower.includes('backoffice') || lower.includes('back office') || lower.includes('bo') || lower.includes('eskalasi')) {
      return 'Back Office';
    }
    if (lower.includes('inbound') || lower.includes('inbond') || lower.includes('voice') || lower.includes('call')) {
      return 'Inbound';
    }

    if (rows && rows.length > 0) {
      const r = rows[0];
      if ('idtiket' in r || 'penerimalaporan' in r || 'namasumber' in r) {
        return 'Auto';
      }
      if ('Ticket' in r && 'Handling' in r) {
        return 'Auto';
      }
      if ('ID SIP' in r || 'ID_SIP' in r || 'TEAM TL' in r || ('NAMA' in r && 'JK' in r)) return 'NAKER';
      const ca = (r['CA'] || r['Layanan'] || r['Saluran'] || '').toString().toLowerCase();
      if (ca.includes('email outbound') || ca.includes('email outbond')) return 'Email Outbound';
      if (ca.includes('outbound call') || ca.includes('outbond call') || ca.includes('outbound')) return 'Outbound Call';
      if (ca.includes('email')) return 'Email';
      if (ca.includes('back office') || ca.includes('backoffice') || ca.includes('eskalasi') || ca.includes('bo')) return 'Back Office';
      if (ca.includes('digilive') || ca.includes('chat') || ca.includes('webhook')) return 'Digilive';
      if (ca.includes('socmed') || ca.includes('sosmed') || ca.includes('social') || ca.includes('whatsapp') || ca.includes('play')) return 'Socmed';
      if (ca.includes('inbound') || ca.includes('voice') || ca.includes('call')) return 'Inbound';
    }

    return 'Auto';
  };

  // Helper fleksibel untuk mengambil nilai kolom objek tanpa terpengaruh huruf besar/kecil atau karakter BOM
  const getRowVal = (row, candidates = []) => {
    if (!row) return '';
    // 1. Direct key match
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
        return String(row[c]).trim();
      }
    }
    // 2. Case-insensitive and normalized key match
    const rowKeys = Object.keys(row);
    for (const c of candidates) {
      const cleanC = c.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const foundKey = rowKeys.find(k => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanC);
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  // Helper untuk membersihkan prefix SMG dari nama Agent (Secondary Rule)
  const cleanSmgAgentName = (rawName = '') => {
    if (!rawName) return '';
    return String(rawName)
      .replace(/^(?:SMG|Smg|smg)[\s\.\-_0-9]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper deteksi kondisi tiket 'TIDAK ADA RESPON'
  const isNoResponseCondition = (val = '') => {
    if (!val) return false;
    const str = String(val).toUpperCase().trim();
    return str === 'TIDAK ADA RESPON'
      || str.includes('TIDAK ADA RESPON')
      || str.includes('NO RESPONSE')
      || str.includes('NO RESPON')
      || str.includes('TIDAK RESPON')
      || str.includes('TIDAK DIRESPON')
      || str.includes('TIDAK_ADA_RESPON')
      || str.includes('UNRESPONSIVE');
  };

  // Helper untuk mengekstrak kandidat nomor tiket iCRM dari kolom Note Omni (Tertiary Rule)
  const extractIcrmTicketFromNote = (note = '') => {
    if (!note) return null;
    const str = String(note).trim();
    // Cari token alfanumerik 6-20 karakter (seperti RULQPUVA, RULQPYF7, RULQDQH2, RY83JFBD)
    const matches = str.match(/[A-Za-z0-9]{6,20}/g);
    if (!matches) return null;
    // Filter token bukan keyword sistem seperti UNCOMPLETED, COMPLETED, dll
    const filtered = matches.filter(m => !/^UNCOMPL|^COMPL|^TICKET|^NOTES|^TANGGAL/i.test(m));
    return filtered.length > 0 ? filtered[0].toUpperCase() : null;
  };

  // Helper parser Excel / TSV fleksibel dengan deteksi baris Header otomatis
  const parseExcelBufferToRows = (buffer, fileName = '') => {
    // 1. Cek format TSV / UTF-16LE text (ListTicketingRetail iCRM)
    try {
      const decoder = new TextDecoder('utf-16le');
      const decodedText = decoder.decode(buffer);
      if (decodedText.includes('\t') && (decodedText.toLowerCase().includes('idtiket') || decodedText.toLowerCase().includes('penerimalaporan') || decodedText.toLowerCase().includes('namapelanggan'))) {
        const lines = decodedText.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length > 1) {
          const headers = lines[0].split('\t').map(h => h.trim().replace(/^[\uFEFF\xEF\xBB\xBF]+/, ''));
          const rows = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split('\t');
            if (cols.length >= 2) {
              const rowObj = {};
              headers.forEach((h, idx) => {
                if (h) {
                  rowObj[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
                }
              });
              rows.push(rowObj);
            }
          }
          if (rows.length > 0) return rows;
        }
      }
    } catch (e) {
      // Fallback ke xlsx
    }

    // 2. Parser SheetJS dengan Smart Header Detection (mendukung file dengan banner baris 1 seperti Botika)
    const wb = XLSX.read(buffer, { type: 'array' });
    let bestRows = [];

    for (const sName of wb.SheetNames) {
      const ws = wb.Sheets[sName];
      if (!ws || !ws['!ref']) continue;

      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      if (!matrix || matrix.length === 0) continue;

      // Cari baris header sebenarnya (scan 10 baris pertama)
      let headerIdx = -1;
      for (let r = 0; r < Math.min(matrix.length, 10); r++) {
        const rowCells = matrix[r].map(c => String(c || '').toLowerCase().trim().replace(/^[\uFEFF\xEF\xBB\xBF]+/, ''));
        const isHeader = rowCells.some(c => 
          c === 'ticket' || c === 'idtiket' || c === 'id tiket' || c === 'no tiket' ||
          c === 'handling' || c === 'agent' || c === 'penerimalaporan' || 
          c === 'namapelanggan' || c === 'idca'
        );
        if (isHeader) {
          headerIdx = r;
          break;
        }
      }

      if (headerIdx !== -1) {
        const headers = matrix[headerIdx].map(h => String(h || '').trim().replace(/^[\uFEFF\xEF\xBB\xBF]+/, ''));
        const extracted = [];
        for (let r = headerIdx + 1; r < matrix.length; r++) {
          const row = matrix[r];
          if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
          const item = {};
          headers.forEach((h, col) => {
            if (h) item[h] = row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : '';
          });
          if (Object.keys(item).length >= 2) extracted.push(item);
        }
        if (extracted.length > bestRows.length) {
          bestRows = extracted;
        }
      } else {
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (rows && rows.length > bestRows.length) {
          bestRows = rows;
        }
      }
    }
    return bestRows;
  };

  // Deteksi peran file (iCRM vs Omni vs NAKER)
  const detectFileRole = (fileName = '', rows = []) => {
    const fLower = fileName.toLowerCase();
    if (fLower.includes('naker') || fLower.includes('plotting') || fLower.includes('database all naker')) return 'naker';
    if (fLower.includes('listticketing') || fLower.includes('retail') || fLower.includes('icrm')) return 'icrm';
    if (fLower.includes('ticket_summary') || fLower.includes('tickets_summary') || fLower.includes('omni') || fLower.includes('summary_iconnet') || fLower.includes('ntjpqhu5') || fLower.includes('botika')) return 'omni';

    if (rows && rows.length > 0) {
      const first = rows[0];
      const keys = Object.keys(first).map(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
      if (keys.includes('idtiket') || keys.includes('namapelanggan') || keys.includes('penerimalaporan') || keys.includes('namakelompok') || keys.includes('namakondisi')) return 'icrm';
      if (keys.includes('ticket') && (keys.includes('handling') || keys.includes('subject') || keys.includes('channel') || keys.includes('note'))) return 'omni';
      if (keys.includes('agent') && keys.includes('idca')) return 'qsf';
    }
    return 'unknown';
  };

  // Core Dual Matching Engine (iCRM + Omni Summary)
  const executeDualMatching = (icrmData = [], omniData = []) => {
    // Bangun index lookup map dari iCRM berdasarkan idtiket
    const icrmMap = new Map();
    if (icrmData && icrmData.length > 0) {
      for (const row of icrmData) {
        const idTiket = getRowVal(row, ['idTiket', 'idtiket', 'ID_Tiket', 'ID Tiket', 'Ticket', 'ticket', 'id_tiket', 'No Tiket', 'idca', 'IDCA']);
        if (idTiket) {
          const uId = idTiket.toUpperCase();
          icrmMap.set(uId, row);
          // Simpan juga versi bersih dari karakter non-alfanumerik
          const cleanId = uId.replace(/[^A-Za-z0-9]/g, '');
          if (cleanId) icrmMap.set(cleanId, row);
        }
      }
    }

    if (!omniData || omniData.length === 0) {
      // Jika hanya file iCRM yang diunggah
      if (icrmData && icrmData.length > 0) {
        const validIcrm = [];
        const noRespIcrm = [];

        for (const r of icrmData) {
          const rawKondisi = getRowVal(r, ['namaKondisi', 'namakondisi', 'nama_kondisi', 'Nama Kondisi', 'Kondisi', 'kondisi', 'Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'Sub Kategori Gangguan', 'Klasifikasi', 'klasifikasi', 'Subject', 'subject']);
          const item = {
            ...r,
            ticket_id: getRowVal(r, ['idTiket', 'idtiket', 'ID_Tiket', 'ID Tiket', 'Ticket', 'ticket']),
            agent_name: getRowVal(r, ['penerimaLaporan', 'penerimalaporan', 'Agent', 'agent']),
            source_ca: getRowVal(r, ['idTiket', 'idtiket', 'ID_Tiket']),
            channel: getRowVal(r, ['namaSumber', 'namasumber']) || 'Inbound',
            sub_category: rawKondisi,
            is_matched: true,
          };

          if (isNoResponseCondition(rawKondisi)) {
            noRespIcrm.push({
              ...item,
              is_matched: false,
              reason: 'Kondisi: TIDAK ADA RESPON (Disaring, tidak perlu disampling)'
            });
          } else {
            validIcrm.push(item);
          }
        }

        setParsedRows(validIcrm);
        setMatchingResult({
          matched: validIcrm,
          unmatchedSmg: [],
          nonSmgRows: [],
          nonSmgCount: 0,
          noResponseRows: noRespIcrm,
          noResponseCount: noRespIcrm.length,
          totalIcrm: icrmData.length,
          totalOmni: 0,
          totalOmniSmg: 0,
        });
      }
      return;
    }

    const matchedList = [];
    const unmatchedSmgList = [];
    const nonSmgList = [];
    const noResponseList = [];

    for (const omniRow of omniData) {
      const rawHandling = getRowVal(omniRow, ['Handling', 'handling', 'Agent', 'agent', 'penerimalaporan', 'PenerimaLaporan']);
      const omniTicket = getRowVal(omniRow, ['Ticket', 'ticket', 'ticket_id', 'Ticket ID', 'idtiket', 'ID Tiket']);
      const omniNote = getRowVal(omniRow, ['Note', 'note', 'Notes', 'notes', 'isiLaporan', 'keterangan']);
      const omniChannel = getRowVal(omniRow, ['Channel', 'channel', 'Source', 'source', 'namaSumber', 'namasumber']) || 'Digilive';
      const omniCategory = getRowVal(omniRow, ['Category', 'category', 'namaKelompok', 'namakelompok']) || 'GANGGUAN';
      const omniDate = getRowVal(omniRow, ['Date', 'date', 'waktuLapor', 'waktuGangguan', 'waktubuat', 'Interaction Date']);
      const omniUser = getRowVal(omniRow, ['Name', 'name', 'User', 'user', 'namaPelanggan', 'Customer Name']);
      const omniPhone = getRowVal(omniRow, ['Phone', 'phone', 'telppelanggan', 'Customer Phone']);

      // Rule 2: Filter hanya untuk kode SMG (Semarang)
      const isSmgAgent = /\bSMG\b|^SMG/i.test(rawHandling);
      if (!isSmgAgent) {
        nonSmgList.push({
          ...omniRow,
          ticket_id: omniTicket,
          agent_name: rawHandling,
          raw_handling: rawHandling,
          channel: omniChannel,
          category: omniCategory,
          notes: omniNote,
          is_matched: false,
          reason: 'Non-SMG Agent (Disaring)'
        });
        continue;
      }

      // Bersihkan nama agent SMG (Secondary Rule)
      const cleanAgent = cleanSmgAgentName(rawHandling);

      // Rule 3: Matching tiket iCRM dari kolom Note Omni
      let matchedIcrmTicket = null;
      let matchedIcrmRow = null;

      // Ekstrak semua token kandidat tiket dari kolom Note (6-20 karakter alfanumerik)
      const noteTokens = omniNote.match(/[A-Za-z0-9]{6,20}/g) || [];
      for (const tok of noteTokens) {
        const tokUpper = tok.toUpperCase();
        if (icrmMap.has(tokUpper)) {
          matchedIcrmTicket = tokUpper;
          matchedIcrmRow = icrmMap.get(tokUpper);
          break;
        }
        const cleanTok = tokUpper.replace(/[^A-Z0-9]/g, '');
        if (icrmMap.has(cleanTok)) {
          matchedIcrmTicket = cleanTok;
          matchedIcrmRow = icrmMap.get(cleanTok);
          break;
        }
      }

      // Jika belum match ke map iCRM, tapi file Note memiliki token tiket, tetap simpan token tersebut sebagai referensi
      const fallbackToken = noteTokens.find(t => !/^UNCOMPL|^COMPL|^TICKET/i.test(t));
      const effectiveIcrmCode = matchedIcrmTicket || (fallbackToken ? fallbackToken.toUpperCase() : null);

      // Ambil namaKondisi dari iCRM match atau kolom Omni/Botika
      const rawKondisi = getRowVal(matchedIcrmRow, ['namaKondisi', 'namakondisi', 'nama_kondisi', 'Nama Kondisi', 'Kondisi', 'kondisi', 'Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'Sub Kategori Gangguan', 'Klasifikasi', 'klasifikasi', 'Subject', 'subject'])
        || getRowVal(omniRow, ['namaKondisi', 'namakondisi', 'nama_kondisi', 'Nama Kondisi', 'Kondisi', 'kondisi', 'Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'Sub Kategori Gangguan', 'Klasifikasi', 'klasifikasi', 'Subject', 'subject'])
        || '';

      // Normalisasi channel
      let resolvedChannel = omniChannel;
      const cUpper = omniChannel.toUpperCase();
      if (cUpper.includes('WEBHOOK') || cUpper.includes('CHAT') || cUpper.includes('DIGILIVE') || cUpper.includes('MY ICON')) {
        resolvedChannel = 'Digilive';
      } else if (cUpper.includes('WHATSAPP') || cUpper.includes('SOCMED') || cUpper.includes('GOOGLE PLAY') || cUpper.includes('INSTAGRAM') || cUpper.includes('COSTER')) {
        resolvedChannel = 'Socmed';
      } else if (cUpper.includes('PHONE') || cUpper.includes('VOICE') || cUpper.includes('CALL')) {
        resolvedChannel = 'Inbound';
      } else if (cUpper.includes('EMAIL')) {
        resolvedChannel = 'Email';
      }

      // Normalisasi category
      let resolvedCategory = 'GANGGUAN';
      const catUpper = (omniCategory || getRowVal(matchedIcrmRow, ['namaKelompok', 'namakelompok']) || '').toUpperCase();
      if (catUpper.includes('INFO')) resolvedCategory = 'INFORMASI';
      else if (catUpper.includes('GGN') || catUpper.includes('GANGGUAN') || catUpper.includes('INCIDENT')) resolvedCategory = 'GANGGUAN';
      else if (catUpper.includes('KELUHAN') || catUpper.includes('KOMPLAIN') || catUpper.includes('COMPLAINT')) resolvedCategory = 'KELUHAN';
      else if (catUpper.includes('PERMOHONAN') || catUpper.includes('REQUEST') || catUpper.includes('REGISTRASI')) resolvedCategory = 'PERMOHONAN';

      // Buat item gabungan terstandarisasi (Prioritas Primary: Omni Ticket)
      const isFullyMatched = Boolean(matchedIcrmTicket) || (icrmData.length === 0 && Boolean(effectiveIcrmCode));

      const customerNameVal = omniUser || getRowVal(matchedIcrmRow, ['namaPelanggan', 'namapelanggan']) || '';
      const customerPhoneVal = omniPhone || getRowVal(matchedIcrmRow, ['telppelanggan', 'telpPelanggan', 'noTelp']) || '';
      const issueDescVal = getRowVal(matchedIcrmRow, ['isiLaporan', 'keluhan', 'tanggapan']) || omniNote || omniCategory || '';
      const interactionDateVal = omniDate || getRowVal(matchedIcrmRow, ['waktuLapor', 'waktubuat', 'waktuGangguan']) || '';

      const unifiedItem = {
        // Primary Rule 1: Omni Ticket
        ticket_id: omniTicket,
        // Secondary Rule 2: Clean SMG Agent
        agent_name: cleanAgent,
        // Tertiary Rule 3: Matched iCRM Ticket (Note)
        source_ca: effectiveIcrmCode,
        channel: resolvedChannel,
        interaction_date: interactionDateVal,
        transaction_at: interactionDateVal,
        Date: interactionDateVal,
        date: interactionDateVal,
        customer_name: customerNameVal,
        customer_phone: customerPhoneVal,
        category: resolvedCategory,
        sub_category: rawKondisi || omniCategory || '',
        notes: omniNote,
        issue_description: issueDescVal,
        raw_handling: rawHandling,
        is_matched: isFullyMatched,
        icrm_matched: Boolean(matchedIcrmTicket),
      };

      // Rule 4: Filter TIDAK ADA RESPON (tidak perlu disampling)
      if (isNoResponseCondition(rawKondisi)) {
        noResponseList.push({
          ...unifiedItem,
          is_matched: false,
          reason: 'Kondisi: TIDAK ADA RESPON (Disaring, tidak perlu disampling)'
        });
        continue;
      }

      if (isFullyMatched) {
        matchedList.push(unifiedItem);
      } else {
        unmatchedSmgList.push(unifiedItem);
      }
    }

    const totalOmniSmg = matchedList.length + unmatchedSmgList.length + noResponseList.length;
    const matchingSummary = {
      matched: matchedList,
      unmatchedSmg: unmatchedSmgList,
      nonSmgRows: nonSmgList,
      nonSmgCount: nonSmgList.length,
      noResponseRows: noResponseList,
      noResponseCount: noResponseList.length,
      totalIcrm: icrmData.length,
      totalOmni: omniData.length,
      totalOmniSmg: totalOmniSmg,
    };

    setMatchingResult(matchingSummary);

    // Tentukan rows yang akan diinjeksi berdasarkan injectSelection
    const rowsToUse = injectSelection === 'all_smg' ? [...matchedList, ...unmatchedSmgList] : (matchedList.length > 0 ? matchedList : [...matchedList, ...unmatchedSmgList]);
    setParsedRows(rowsToUse);

    if (rowsToUse.length > 0) {
      if (rowsToUse.length < 1500) {
        setCustomInjectLimit(rowsToUse.length);
      } else {
        setCustomInjectLimit(1500);
      }
    }

    // Trigger preview payload audit
    const sampleRows = rowsToUse.slice(0, 50);
    const payload = {
      import_type: 'CRM_RAW',
      rows: sampleRows,
      file_name: omniFileName || icrmFileName || 'Matched_Omni_iCRM.xlsx',
      channel: 'Auto',
    };

    api.previewImport(payload).then(res => {
      if (res?.success) {
        setPreviewResult({
          ...res,
          summary: {
            ...res.summary,
            total_rows: rowsToUse.length,
            valid_count: rowsToUse.length,
            new_count: rowsToUse.length,
          }
        });
      }
    }).catch(err => {
      console.warn('Preview import audit notice:', err);
    });
  };

  // Handler Upload Slot 1: iCRM
  const handleIcrmFile = (file) => {
    if (!file) return;
    setPreviewLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const rows = parseExcelBufferToRows(buffer, file.name);
        const role = detectFileRole(file.name, rows);

        // Jika user mengunggah file Omni ke Slot 1 dan Slot 2 masih kosong
        if (role === 'omni' && (!omniFile || omniRows.length === 0)) {
          setOmniFile(file);
          setOmniFileName(file.name);
          setOmniFileSizeText((file.size / (1024 * 1024)).toFixed(2) + ' MB');
          setOmniRows(rows);
          showToast(`ℹ️ Berkas terdeteksi sebagai Tarikan Omni (${rows.length.toLocaleString('id-ID')} tiket) dan dialihkan ke Slot 2.`);
          executeDualMatching(icrmRows, rows);
          return;
        }

        setIcrmFile(file);
        setIcrmFileName(file.name);
        setIcrmFileSizeText((file.size / (1024 * 1024)).toFixed(2) + ' MB');
        setIcrmRows(rows);
        
        if (role === 'omni') {
          showToast(`⚠️ Perhatian: Berkas ini memiliki format kolom Omni (bukan ListTicketingRetail). Harap pastikan berkas Slot 1 adalah tarikan 62 kolom iCRM.`);
        } else {
          showToast(`Berkas iCRM (${rows.length.toLocaleString('id-ID')} baris) berhasil dimuat.`);
        }

        // Jalankan matching dengan file Omni
        executeDualMatching(rows, omniRows);
      } catch (err) {
        setImportStatus({ type: 'error', message: 'Gagal membaca berkas iCRM: ' + err.message });
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handler Upload Slot 2: Omni
  const handleOmniFile = (file) => {
    if (!file) return;
    setPreviewLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const rows = parseExcelBufferToRows(buffer, file.name);
        const role = detectFileRole(file.name, rows);

        // Jika user mengunggah file iCRM ke Slot 2 dan Slot 1 masih kosong
        if (role === 'icrm' && (!icrmFile || icrmRows.length === 0)) {
          setIcrmFile(file);
          setIcrmFileName(file.name);
          setIcrmFileSizeText((file.size / (1024 * 1024)).toFixed(2) + ' MB');
          setIcrmRows(rows);
          showToast(`ℹ️ Berkas terdeteksi sebagai ListTicketingRetail (${rows.length.toLocaleString('id-ID')} baris) dan dialihkan ke Slot 1.`);
          executeDualMatching(rows, omniRows);
          return;
        }

        setOmniFile(file);
        setOmniFileName(file.name);
        setOmniFileSizeText((file.size / (1024 * 1024)).toFixed(2) + ' MB');
        setOmniRows(rows);
        showToast(`Berkas Omni (${rows.length.toLocaleString('id-ID')} baris) berhasil dimuat.`);
        
        // Jalankan matching dengan file iCRM
        executeDualMatching(icrmRows, rows);
      } catch (err) {
        setImportStatus({ type: 'error', message: 'Gagal membaca berkas Omni: ' + err.message });
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Multi-File Drop Handler (Auto detect iCRM vs Omni)
  const handleMultiFileDrop = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rows = parseExcelBufferToRows(e.target.result, file.name);
        const detected = detectFileRole(file.name, rows);
        if (detected === 'omni') {
          setOmniFile(file);
          setOmniFileName(file.name);
          setOmniFileSizeText((file.size / (1024 * 1024)).toFixed(2) + ' MB');
          setOmniRows(rows);
          executeDualMatching(icrmRows, rows);
        } else {
          setIcrmFile(file);
          setIcrmFileName(file.name);
          setIcrmFileSizeText((file.size / (1024 * 1024)).toFixed(2) + ' MB');
          setIcrmRows(rows);
          executeDualMatching(rows, omniRows);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleMultiFileDrop([file]);
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultiFileDrop(e.dataTransfer.files);
    }
  };

  const submitImport = async () => {
    // Tentukan rows yang akan diinjeksi
    let sourceRows = parsedRows;
    if (matchingResult.matched.length > 0) {
      if (injectSelection === 'matched_only') {
        sourceRows = matchingResult.matched;
      } else if (injectSelection === 'all_smg') {
        sourceRows = [...matchingResult.matched, ...matchingResult.unmatchedSmg];
      }
    }

    if (!sourceRows || sourceRows.length === 0) {
      setImportStatus({ type: 'error', message: 'Pilih dan lakukan matching berkas Excel tarikan CRM/Omni terlebih dahulu.' });
      return;
    }

    // Hitung limit efektif berdasarkan mode yang dipilih
    let effectiveLimit = sourceRows.length;
    if (injectLimitMode === 'auto_need') {
      const calculatedNeed = ((activeDutyCount || 8) * (dailyTotalPerQa || 20)) + (Number(bufferReserveCount) || 0);
      effectiveLimit = Math.min(sourceRows.length, Math.max(1, calculatedNeed));
    } else if (injectLimitMode === 'custom') {
      effectiveLimit = Math.min(sourceRows.length, Math.max(1, Number(customInjectLimit) || 1));
    } else {
      effectiveLimit = sourceRows.length;
    }

    const rowsToInject = sourceRows.slice(0, effectiveLimit);

    setImporting(true);
    setImportStatus({ type: '', message: '' });

    // Batch size 100 baris per request
    const BATCH_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < rowsToInject.length; i += BATCH_SIZE) {
      chunks.push(rowsToInject.slice(i, i + BATCH_SIZE));
    }
    const totalChunks = chunks.length;

    setImportProgress({
      currentBatch: 1,
      totalBatches: totalChunks,
      processedRows: 0,
      totalRows: rowsToInject.length,
      percent: 0,
      statusText: `Mempersiapkan injeksi batch (Total ${totalChunks} batch, ${rowsToInject.length.toLocaleString('id-ID')} tiket ter-match)...`
    });

    try {
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
          totalRows: rowsToInject.length,
          percent: Math.round((b / totalChunks) * 100),
          statusText: `Menginjeksi Batch ${b + 1} dari ${totalChunks} (${currentChunk.length} baris tiket CRM Matched)...`
        });

        const payload = {
          import_type: 'CRM_RAW',
          rows: currentChunk,
          file_name: omniFileName || icrmFileName || 'Matched_Omni_iCRM.xlsx',
          channel: selectedChannel,
          import_mode: importMode,
          is_first_batch: isFirst,
          is_last_batch: isLast,
          batch_index: b + 1,
          total_batches: totalChunks,
          import_id: activeImportId,
          batch_id: activeBatchId,
          total_expected_rows: rowsToInject.length
        };

        let res = null;
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            res = await api.processImport(payload);
            if (res?.success) break;
            throw new Error(res?.message || `Gagal pada Batch ${b + 1}`);
          } catch (err) {
            lastError = err;
            if (attempt < 2) {
              setImportProgress(prev => ({
                ...prev,
                statusText: `Mencoba ulang Batch ${b + 1}... (${err.message})`
              }));
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }

        if (!res?.success) {
          throw new Error(lastError?.response?.data?.message || lastError?.message || `Gagal pada Batch ${b + 1}`);
        }

        if (res.import_id) activeImportId = res.import_id;
        if (res.batch_id) activeBatchId = res.batch_id;
        if (res.batch_success_rows !== undefined) totalSuccess += res.batch_success_rows;
        if (res.batch_failed_rows !== undefined) totalFailed += res.batch_failed_rows;

        const updatedProcessed = Math.min((b + 1) * BATCH_SIZE, rowsToInject.length);
        setImportProgress({
          currentBatch: b + 1,
          totalBatches: totalChunks,
          processedRows: updatedProcessed,
          totalRows: rowsToInject.length,
          percent: Math.round(((b + 1) / totalChunks) * 100),
          statusText: isLast
            ? `Finalisasi penyimpanan data tiket matched ke pool cadangan...`
            : `Batch ${b + 1} selesai (${updatedProcessed.toLocaleString('id-ID')}/${rowsToInject.length.toLocaleString('id-ID')} data)`
        });
      }

      setImportStatus({
        type: 'success',
        message: `Berhasil menginjeksi ${rowsToInject.length.toLocaleString('id-ID')} tiket CRM (Primary: Omni Ticket, Secondary: SMG Agent, Tertiary: iCRM Ticket)! Data siap didistribusikan.`
      });

      showToast(`Injeksi ${rowsToInject.length.toLocaleString('id-ID')} tiket hasil matching berhasil!`);

      // Auto-Refresh Bucket & Site Target
      fetchBucketTickets(1);
      fetchSiteSummary();
      fetchCsoTargets();
      window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));

      setTimeout(() => {
        setImportModalOpen(false);
        resetImport();
      }, 2500);

    } catch (err) {
      setImportStatus({
        type: 'error',
        message: 'Terjadi kesalahan pada proses injeksi data: ' + (err.response?.data?.message || err.message)
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setIcrmFile(null);
    setIcrmFileName('');
    setIcrmFileSizeText('');
    setIcrmRows([]);
    setOmniFile(null);
    setOmniFileName('');
    setOmniFileSizeText('');
    setOmniRows([]);
    setMatchingResult({
      matched: [],
      unmatchedSmg: [],
      nonSmgRows: [],
      nonSmgCount: 0,
      noResponseRows: [],
      noResponseCount: 0,
      totalIcrm: 0,
      totalOmni: 0,
      totalOmniSmg: 0,
    });
    setPreviewFilterTab('matched');
    setPreviewSearchTerm('');
    setInjectSelection('matched_only');
    setImportFile(null);
    setImportFileName('');
    setImportFileSizeText('');
    setSelectedChannel('Auto');
    setDetectedChannel('');
    setParsedRows([]);
    setPreviewResult(null);
    setImportProgress(null);
    setImportStatus({ type: '', message: '' });
    setInjectLimitMode('custom');
    setCustomInjectLimit(1500);
    setBufferReserveCount(50);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (icrmFileInputRef.current) icrmFileInputRef.current.value = '';
    if (omniFileInputRef.current) omniFileInputRef.current.value = '';
  };
  // -------------------------------------------------------------------------
  // Lifecycle Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Selalu sinkronkan summary monitoring & roster agar badge selalu realtime
    if (isSupervisor) {
      fetchMonitoringData(true);
      fetchQaRoster(dailyTargetDate, true);
    }

    if (activeTab === 'qa_bucket') {
      fetchBucketTickets(1);
    } else if (activeTab === 'target_breakdown') {
      fetchSiteSummary();
      fetchCsoTargets();
    } else if (activeTab === 'reassign_logs') {
      fetchReassignmentLogs();
    } else if (activeTab === 'audit_abandoned') {
      fetchMonitoringData();
    } else if (activeTab === 'qa_roster') {
      fetchQaRoster(rosterSelectedDate);
    }
  }, [selectedMonth, activeTab, isSupervisor, dailyTargetDate, rosterSelectedDate]);

  useEffect(() => {
    if (activeTab === 'qa_bucket') {
      fetchBucketTickets(1);
    }
  }, [selectedBucketQa, bucketStatusFilter, bucketTypeFilter, bucketChannelFilter]);

  useEffect(() => {
    if (activeTab === 'target_breakdown') {
      fetchCsoTargets();
    }
  }, [csoQaFilter]);

  useEffect(() => {
    setCsoPage(1);
  }, [csoSearch, csoQaFilter, csoChannelFilter, selectedMonth, csoPerPage]);

  // Deep-Link & Notification Query Params Listener
  useEffect(() => {
    if (searchParams.get('open_quota_modal') === '1' || searchParams.get('tab') === 'quota_requests') {
      setExtraQuotaActiveTab('requests');
      fetchPendingQuotaRequests();
      setShowExtraQuotaModal(true);
    }
    if (searchParams.get('tab') === 'audit_abandoned') {
      setActiveTab('audit_abandoned');
      fetchMonitoringData();
    }
  }, [searchParams]);

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => {
      if (isSupervisor) {
        fetchMonitoringData(true);
        fetchQaRoster(dailyTargetDate, true);
      }
      if (activeTab === 'qa_bucket') {
        fetchBucketTickets(bucketPage, true);
      } else if (activeTab === 'target_breakdown') {
        fetchSiteSummary(true);
        fetchCsoTargets(true);
      } else if (activeTab === 'reassign_logs') {
        fetchReassignmentLogs(true);
      } else if (activeTab === 'audit_abandoned') {
        fetchMonitoringData(true);
      } else if (activeTab === 'qa_roster') {
        fetchQaRoster(rosterSelectedDate, true);
      }
    };
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedMonth, activeTab, bucketPage, isSupervisor, dailyTargetDate, rosterSelectedDate]);

  // Evaluator List options for Dropdowns
  const qaEvaluatorOptions = [
    { value: 'all', label: 'Semua Evaluator QA' },
    ...((monitoringData?.evaluators || qaRosterData?.evaluators || []).map(q => ({
      value: q.evaluator_name,
      label: q.evaluator_name
    })))
  ];

  // Helper for Channel Icons & Colors
  const getChannelBadge = (channelName = '') => {
    const c = String(channelName).toLowerCase();
    if (c.includes('email')) {
      return {
        icon: Mail,
        label: 'Email Inbound',
        bg: 'bg-indigo-50/90 text-indigo-800 border-indigo-200/80',
        dot: 'bg-indigo-500'
      };
    }
    if (c.includes('digilive') || c.includes('chat')) {
      return {
        icon: Zap,
        label: 'Digilive Chat',
        bg: 'bg-amber-50/90 text-amber-900 border-amber-300/80',
        dot: 'bg-amber-500'
      };
    }
    if (c.includes('socmed') || c.includes('sosmed') || c.includes('social')) {
      return {
        icon: MessageSquare,
        label: 'Social Media',
        bg: 'bg-sky-50/90 text-sky-900 border-sky-300/80',
        dot: 'bg-sky-500'
      };
    }
    if (c.includes('back office') || c.includes('backoffice') || c.includes('bo')) {
      return {
        icon: Building2,
        label: 'Back Office',
        bg: 'bg-purple-50/90 text-purple-900 border-purple-300/80',
        dot: 'bg-purple-500'
      };
    }
    if (c.includes('outbound') || c.includes('obc')) {
      return {
        icon: PhoneCall,
        label: 'Outbound Call',
        bg: 'bg-blue-50/90 text-blue-900 border-blue-300/80',
        dot: 'bg-blue-500'
      };
    }
    return {
      icon: PhoneCall,
      label: channelName || 'Inbound Call',
      bg: 'bg-emerald-50/90 text-emerald-900 border-emerald-300/80',
      dot: 'bg-emerald-500'
    };
  };

  // Filtered CSO Matrix for Tab 2
  const filteredCsoMatrix = csoMatrix.filter(cso => {
    const matchSearch = csoSearch === '' ||
      (cso.agent_name && cso.agent_name.toLowerCase().includes(csoSearch.toLowerCase())) ||
      (cso.nik && cso.nik.toLowerCase().includes(csoSearch.toLowerCase()));
    const matchChannel = csoChannelFilter === 'all' ||
      (cso.channel && cso.channel.toLowerCase().includes(csoChannelFilter.toLowerCase()));
    return matchSearch && matchChannel;
  });

  // CSO Matrix Pagination calculations
  const totalCsoCount = filteredCsoMatrix.length;
  const isCsoAll = csoPerPage === 'all';
  const effectiveCsoPerPage = isCsoAll ? totalCsoCount : Number(csoPerPage);
  const totalCsoPages = isCsoAll ? 1 : Math.max(1, Math.ceil(totalCsoCount / effectiveCsoPerPage));
  const validCsoPage = Math.min(Math.max(1, csoPage), totalCsoPages);
  const csoStartIndex = totalCsoCount === 0 ? 0 : (validCsoPage - 1) * effectiveCsoPerPage + 1;
  const csoEndIndex = isCsoAll ? totalCsoCount : Math.min(validCsoPage * effectiveCsoPerPage, totalCsoCount);
  const paginatedCsoMatrix = isCsoAll
    ? filteredCsoMatrix
    : filteredCsoMatrix.slice((validCsoPage - 1) * effectiveCsoPerPage, validCsoPage * effectiveCsoPerPage);

  // Mobile View Switcher (Auto switches to Card View on mobile devices / WebViews, Table on Desktop)
  const [mobileViewMode, setMobileViewMode] = useState('cards'); // 'cards' | 'table'

  return (
    <div className="w-full max-w-full space-y-4 pb-28 sm:pb-12">

      {/* 1. Pure Corporate Executive Header Card */}
      <div className="corp-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/90 shadow-xs">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 text-[#0F2744] border border-blue-200 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2744]" />
              Modul 6 • Auto Distribution
            </span>
            {isSupervisor && (
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-purple-50 text-purple-900 border border-purple-200 uppercase">
                Supervisor Hub
              </span>
            )}
            {isQA && (
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 text-blue-900 border border-blue-200 uppercase">
                QA Evaluator
              </span>
            )}
            {isTL && (
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200 uppercase">
                Team Leader
              </span>
            )}
            <span className="text-slate-300 font-bold hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-slate-600 hidden sm:inline-flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-blue-600" />
              Target: <strong className="text-slate-900">370 Sesi/Bulan</strong> (CA ≥ 85% • FCR 100%)
            </span>
          </div>
          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
            Distribusi Sampling Mutu & Kuota Otomatis
          </h1>
        </div>

        {/* Period Selector & Refresh Controls */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0 w-full sm:w-auto">
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

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'qa_bucket') fetchBucketTickets(bucketPage);
              else if (activeTab === 'target_breakdown') { fetchSiteSummary(); fetchCsoTargets(); }
              else if (activeTab === 'reassign_logs') fetchReassignmentLogs();
            }}
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 transition shadow-2xs flex items-center justify-center cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${(loadingBucket || loadingSite || loadingLogs) ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* SUPERVISOR DAILY IMPORT & READINESS REMINDER BANNER */}
      {isSupervisor && <SupervisorImportReminder period={selectedMonth} />}

      {/* 2. Symmetrical 2-Panel Command Center (For Supervisor) */}
      {isSupervisor && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Panel 1: Manajemen Berkas CRM (Raw Data) */}
          <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0F2744] shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#0F2744]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">Manajemen Berkas CRM</h3>
                  <p className="text-[11px] text-slate-500 truncate">File transaksi mentah CRM</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0F2744] border border-blue-200">
                  {(bucketData?.stats?.raw_total_imported || 0).toLocaleString('id-ID')} Mentah
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline">
                  Excel 62 Kolom
                </span>
              </div>
            </div>

            {/* Sisa Tiket Mentah Indicator Bar */}
            <div className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200 flex items-center justify-between gap-1.5 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span className="text-[11px] text-slate-600 font-medium">Sisa Pool Mentah:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                  {(bucketData?.stats?.raw_buffer_remaining || 0).toLocaleString('id-ID')} Tiket
                </span>
                <span className="text-[10px] text-slate-400">
                  (Terbagi: {(bucketData?.stats?.raw_assigned_total || bucketData?.stats?.total_bucket || 0).toLocaleString('id-ID')})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetImport();
                  setImportModalOpen(true);
                }}
                className="px-2.5 py-2 rounded-xl bg-[#0F2744] hover:bg-[#1A365D] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                title="Setor & Unggah File Raw CRM (Excel 62 Kolom)"
              >
                <Upload className="w-3.5 h-3.5 text-blue-300" />
                <span>Setor Berkas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecallActiveTab('recall_queue');
                  fetchImportBatches();
                  setRecallModalOpen(true);
                }}
                className="px-2.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs border border-rose-200 flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                title="Tarik Antrean & Rollback Data Impor"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Tarik Data</span>
              </button>
            </div>
          </div>

          {/* Panel 2: Operasional Auto-Distribusi (Sampling Engine) */}
          <div className="corp-card p-3.5 sm:p-4 flex flex-col justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">Operasional Distribusi</h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {dailyComposition.INFORMASI} Info • {dailyComposition.GANGGUAN} Ggn • {dailyComposition.KELUHAN} Kel • {dailyComposition.PERMOHONAN} Perm
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0F2744] border border-blue-200">
                  {bucketData?.stats?.daily_needed_total || dailyTotalSite || 160} Tiket/Hari
                </span>
              </div>
            </div>

            {/* Daily Requirement vs Buffer Pool Indicator */}
            <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between gap-1.5 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <span className="text-[11px] text-indigo-950 font-semibold">Kebutuhan: <strong>160 Tiket</strong> (20/QA)</span>
              </div>
              <span className="text-[11px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                Cadangan: {(bucketData?.stats?.raw_buffer_remaining || 0).toLocaleString('id-ID')} Siap
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              {/* Row 1: Primary Distribution Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowDailyDistModal(true)}
                  disabled={distributingDaily}
                  className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                  title={`Kustomisasi & Jalankan Distribusi Harian (${dailyTotalPerQa} Tiket/QA)`}
                >
                  <Play className={`w-3.5 h-3.5 text-white fill-white ${distributingDaily ? 'animate-spin' : ''}`} />
                  <span className="truncate">{distributingDaily ? 'Membagi...' : `Distribusi Harian (${dailyTotalPerQa}/QA)`}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunAutoDistribution}
                  disabled={distributing}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                  title="Auto Distribusi Penuh (Target 370 Tiket)"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-300 ${distributing ? 'animate-bounce' : ''}`} />
                  <span className="truncate">{distributing ? 'Memproses...' : 'Distribusi Penuh (370)'}</span>
                </button>
              </div>

              {/* Row 2: Secondary / Target & Setting Utilities */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShowBadRatingModal(true)}
                  className="px-2 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Upload data komplain / Low CSAT (Bad Rating) untuk didistribusikan ke QA"
                >
                  <Star className="w-3.5 h-3.5 text-rose-600 fill-rose-600 shrink-0" />
                  <span>Bad Rating</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchWeeklyTargets();
                    setShowWeeklyTargetsModal(true);
                  }}
                  className="px-2 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Setting target kuota tiket mingguan (W1-W5) agar tim achieve target 370"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Target W1–W5</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchPendingQuotaRequests();
                    setShowExtraQuotaModal(true);
                  }}
                  className="px-2 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs relative whitespace-nowrap"
                  title="Akses Tambah Tiket SPV (Batas Waktu 1 Hari)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>+ Kuota SPV</span>
                  {pendingQuotaRequests.filter(r => r.status === 'PENDING').length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse absolute -top-0.5 -right-0.5"></span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sleek Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 pt-2 rounded-t-xl overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('qa_bucket')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'qa_bucket'
            ? 'border-[#0F2744] text-[#0F2744]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Antrean Kerja QA</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${activeTab === 'qa_bucket'
            ? 'bg-blue-50 text-[#0F2744] border border-blue-200'
            : 'bg-slate-100 text-slate-600'
            }`}>
            {bucketData?.pagination?.total || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('qa_roster');
            fetchQaRoster(rosterSelectedDate);
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'qa_roster'
            ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
          <span>Jadwal & Kesiapan QA</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${(qaRosterData?.summary?.active_duty_qas_count ?? 8) === 8
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            : 'bg-amber-100 text-amber-900 border border-amber-200'
            }`}>
            {qaRosterData?.summary?.active_duty_qas_count !== undefined ? `${qaRosterData.summary.active_duty_qas_count}/8 Duty` : '8/8 Duty'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('target_breakdown')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'target_breakdown'
            ? 'border-[#0F2744] text-[#0F2744]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Target Site & CSO</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${activeTab === 'target_breakdown'
            ? 'bg-blue-50 text-[#0F2744] border border-blue-200'
            : 'bg-slate-100 text-slate-600'
            }`}>
            5.920
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reassign_logs')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'reassign_logs'
            ? 'border-[#0F2744] text-[#0F2744]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Log Reassignment</span>
        </button>

        {isSupervisor && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('audit_abandoned');
              fetchMonitoringData();
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'audit_abandoned'
              ? 'border-rose-600 text-rose-700 bg-rose-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Audit & Tiket Abandoned (&gt; 7 Hari)</span>
            {(monitoringData?.summary?.total_abandoned_tickets || 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                {monitoringData.summary.total_abandoned_tickets}
              </span>
            )}
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: QA WORK BUCKET */}
      {/* =================================================================== */}
      {activeTab === 'qa_bucket' && (
        <div className="space-y-3">

          {/* SUPERVISOR RAW TICKET BUFFER & EXTRA QUOTA BANNER */}
          {isSupervisor && (
            <div className="corp-card p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
              {/* Header: Title & Action */}
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0F2744] shrink-0 shadow-2xs">
                    <Database className="w-4 h-4 text-[#0F2744]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider bg-blue-50 text-[#0F2744] border border-blue-200 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        STATUS POOL TIKET MENTAH
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                        Tersedia untuk Alokasi Cadangan & Distribusi Harian
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsive 4-Card Metric Strip (2 cols on mobile, 4 cols on desktop) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                <div className="p-2 sm:p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block truncate">Total Tarikan Mentah</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                      {(bucketData?.stats?.raw_total_imported || 0).toLocaleString('id-ID')}
                    </strong>
                    <span className="text-[10px] text-slate-400">Tiket</span>
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  <span className="text-[10px] uppercase font-semibold text-indigo-800 block truncate">Kebutuhan Harian</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong className="text-sm sm:text-base font-bold text-indigo-950 font-mono">
                      {bucketData?.stats?.daily_needed_total || 160}
                    </strong>
                    <span className="text-[10px] text-indigo-600">8 QA × 20</span>
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block truncate">Sudah Dialokasikan</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong className="text-sm sm:text-base font-bold text-slate-800 font-mono">
                      {(bucketData?.stats?.raw_assigned_total || bucketData?.stats?.total_bucket || 0).toLocaleString('id-ID')}
                    </strong>
                    <span className="text-[10px] text-slate-400">Tiket</span>
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 bg-emerald-50/90 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block truncate">Sisa Cadangan Pool</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong className="text-sm sm:text-base font-black text-emerald-900 font-mono">
                      {(bucketData?.stats?.raw_buffer_remaining || 0).toLocaleString('id-ID')}
                    </strong>
                    <span className="text-[10px] text-emerald-700 font-semibold">Tersedia</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compact Enterprise KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
              <div className="px-2 py-1">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Target Bulanan</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {selectedBucketQa === 'all'
                    ? (bucketData?.stats?.target_quota || 0).toLocaleString('id-ID')
                    : '370'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {selectedBucketQa === 'all'
                    ? `Total Site (${(monitoringData?.evaluators?.length || qaRosterData?.evaluators?.length || 0)} QA)`
                    : 'Sesi / QA'}
                </span>
              </div>
              <div className="px-2 py-1 bg-indigo-50/30">
                <span className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider block">Kuota Harian</span>
                <span className="text-base font-bold text-indigo-950 font-mono">
                  {selectedBucketQa === 'all'
                    ? (bucketData?.stats?.daily_target || 0).toLocaleString('id-ID')
                    : '20'}
                </span>
                <span className="text-[10px] text-indigo-600 block">
                  {selectedBucketQa === 'all'
                    ? `Total Site (${(monitoringData?.evaluators?.length || qaRosterData?.evaluators?.length || 0)} QA)`
                    : `Masuk: ${bucketData?.stats?.today_assigned || 0} Tiket`}
                </span>
              </div>
              <div className="px-2 py-1 bg-emerald-50/30">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">Selesai Hari Ini</span>
                <span className="text-base font-bold text-emerald-800 font-mono">{bucketData?.stats?.today_completed || 0}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block">{bucketData?.stats?.today_achievement_pct || 0}% Target</span>
              </div>
              <div className={`px-2 py-1 ${(bucketData?.stats?.backlog_count || 0) > 0 ? 'bg-amber-50/60' : ''}`}>
                <span className={`text-[10px] uppercase tracking-wider block ${(bucketData?.stats?.backlog_count || 0) > 0 ? 'text-amber-900 font-bold' : 'text-slate-500'}`}>
                  Tiket Menumpuk
                </span>
                <span className={`text-base font-bold font-mono ${(bucketData?.stats?.backlog_count || 0) > 0 ? 'text-amber-950' : 'text-slate-700'}`}>
                  {bucketData?.stats?.backlog_count || 0}
                </span>
                <span className={`text-[10px] block ${(bucketData?.stats?.backlog_count || 0) > 0 ? 'text-amber-800 font-medium' : 'text-slate-400'}`}>
                  {(bucketData?.stats?.backlog_count || 0) > 0 ? '⚠️ Sisa Kemarin' : '✓ 0 Backlog'}
                </span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] font-medium text-teal-700 uppercase tracking-wider block">Sudah Dicek (Total)</span>
                <span className="text-base font-bold text-teal-700 font-mono">{bucketData?.stats?.completed || 0}</span>
                <span className="text-[10px] text-teal-700 font-semibold block">{bucketData?.stats?.achievement_pct || 0}%</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wider block">On Cek / Dinilai</span>
                <span className="text-base font-bold text-amber-700 font-mono">{bucketData?.stats?.in_progress || 0}</span>
                <span className="text-[10px] text-slate-400 block">Sedang Dinilai</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Sisa Antrean</span>
                <span className="text-base font-bold text-slate-800 font-mono">{bucketData?.stats?.unchecked_count || 0}</span>
                <span className="text-[10px] text-slate-400 block">Belum Selesai</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] font-medium text-rose-600 uppercase tracking-wider block">Abandoned / Skip</span>
                <span className="text-base font-bold text-rose-600 font-mono">{bucketData?.stats?.skipped || 0}</span>
                <span className="text-[10px] text-slate-400 block">Riwayat 1 Bulan</span>
              </div>
            </div>
          </div>

          {/* Ticket Listing & Integrated Filters */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Filter Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari ID / CSO / NIK..."
                    value={bucketSearch}
                    onChange={(e) => setBucketSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchBucketTickets(1)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-800 focus:outline-none"
                  />
                </div>

                <CustomSelect
                  value={selectedBucketQa}
                  onChange={(e) => setSelectedBucketQa(e.target.value)}
                  options={qaEvaluatorOptions}
                  icon={Users}
                />

                <CustomSelect
                  value={bucketStatusFilter}
                  onChange={(e) => setBucketStatusFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'Semua Status' },
                    { value: 'backlog', label: `⚠️ Tiket Menumpuk (${bucketData?.stats?.backlog_count || 0})` },
                    { value: 'today', label: `✨ Masuk Hari Ini (${bucketData?.stats?.today_assigned || 0})` },
                    { value: 'IN_PROGRESS', label: '⚡ ON CEK (Sedang Dinilai)' },
                    { value: 'PENDING', label: '⏳ PENDING (Ditunda)' },
                    { value: 'ABANDONED', label: '✕ ABANDONED (Sesi Terputus)' },
                    { value: 'COMPLETED', label: '✓ SUDAH DICEK (Selesai)' },
                    { value: 'ASSIGNED', label: 'BELUM DICEK (Antrean)' },
                    { value: 'SKIPPED', label: 'SKIPPED (Dilewati)' }
                  ]}
                  icon={Filter}
                />

                <CustomSelect
                  value={bucketChannelFilter}
                  onChange={(e) => setBucketChannelFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'Semua Saluran' },
                    { value: 'Inbound', label: 'Inbound' },
                    { value: 'Digilive', label: 'Digilive' },
                    { value: 'Socmed', label: 'Socmed' },
                    { value: 'Email', label: 'Email' },
                    { value: 'Outbound', label: 'Outbound' },
                    { value: 'Back Office', label: 'Back Office' }
                  ]}
                  icon={Sliders}
                />
              </div>

              {/* View Switcher & Progress */}
              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                {/* Mobile View Switcher */}
                <div className="flex sm:hidden items-center bg-slate-200 p-0.5 rounded-lg text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('cards')}
                    className={`px-2 py-1 rounded transition ${mobileViewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('table')}
                    className={`px-2 py-1 rounded transition ${mobileViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    Tabel
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Selesai: <strong className="text-emerald-700 font-mono">{bucketData?.stats?.achievement_pct || 0}%</strong>
                  </span>
                  <div className="w-16 sm:w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(bucketData?.stats?.achievement_pct || 0, 100)}%` }}
                    ></div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportQABucketExcel}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0"
                    title="Ekspor seluruh antrean sampling ke Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">Ekspor Excel</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Floating Bulk Action Bar for Supervisor */}
            {selectedTicketIds.length > 0 && isSupervisor && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 max-w-[92vw]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-bold whitespace-nowrap">{selectedTicketIds.length} Tiket Terpilih</span>
                </div>
                <div className="h-4 w-px bg-slate-700"></div>
                <button
                  type="button"
                  onClick={() => setSelectedTicketIds([])}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  disabled={submittingAction}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition disabled:opacity-50 whitespace-nowrap"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Tarik {selectedTicketIds.length} Tiket</span>
                </button>
              </div>
            )}

            {/* Mobile Cards View */}
            <div className={`p-3 space-y-2 sm:hidden ${mobileViewMode === 'table' ? 'hidden' : 'block'}`}>
              {loadingBucket && (!bucketData?.data || bucketData.data.length === 0) ? (
                <div className="py-8 text-center text-slate-500 space-y-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs">Memuat antrean...</p>
                </div>
              ) : bucketData?.data?.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <Inbox className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="font-semibold text-xs text-slate-600">Tidak ada tiket di antrean</p>
                  <p className="text-[11px] text-slate-400">Setor berkas Excel atau jalankan auto-distribusi.</p>
                </div>
              ) : (
                bucketData?.data?.map((item) => {
                  const isCompleted = item.status === 'COMPLETED' || item.is_checked;
                  const isInProgress = item.status === 'IN_PROGRESS' || item.status === 'ON_CEK';
                  const isPending = item.status === 'PENDING';
                  const isAbandoned = item.status === 'ABANDONED';
                  const isSkipped = item.status === 'SKIPPED';
                  const isAssigned = item.status === 'ASSIGNED' || !item.status;
                  const channelStyle = getChannelBadge(item.channel);
                  const ChannelIcon = channelStyle.icon;
                  const fullTicketId = item.ticket_id || '';
                  const isSelected = selectedTicketIds.includes(item.id);

                  return (
                    <div key={item.id} className={`p-3 bg-white border rounded-xl shadow-2xs space-y-2 transition ${isSelected ? 'border-blue-400 bg-blue-50/20 ring-1 ring-blue-400/30' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isSupervisor && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTicket(item.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer mr-0.5"
                            />
                          )}
                          <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
                            #{fullTicketId}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(fullTicketId, item.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 bg-slate-50 border border-slate-200 cursor-pointer"
                          >
                            {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {item.source_ca && (
                            <span className="font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1" title={`Matched iCRM Ticket: ${item.source_ca}`}>
                              <Link2 className="w-2.5 h-2.5 text-blue-600" />
                              <span>iCRM: {item.source_ca}</span>
                            </span>
                          )}
                          {item.is_backlog && !isCompleted && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5 animate-pulse">
                              <Layers className="w-2.5 h-2.5 text-amber-700" />
                              Menumpuk ({item.backlog_days ? `${item.backlog_days}h` : item.assigned_date_formatted})
                            </span>
                          )}
                          {item.is_today && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-sky-600" />
                              Hari Ini
                            </span>
                          )}
                          {item.is_extra_quota && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              Extra SPV (1 Hari)
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${isCompleted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : isInProgress
                            ? 'bg-blue-50 text-blue-800 border-blue-300 animate-pulse'
                            : isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : isAbandoned
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : isSkipped
                                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                          {isCompleted ? 'Sudah Dicek' : isInProgress ? 'On Cek' : isPending ? 'Pending' : isAbandoned ? 'Abandoned' : isSkipped ? 'Dilewati' : 'Belum Dicek'}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-2 text-xs">
                        <div>
                          <strong className="text-slate-900 block font-semibold">{item.agent_name}</strong>
                          <span className="text-[10px] text-slate-500 font-mono">NIK: {item.agent_nik || '-'}</span>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${channelStyle.bg}`}>
                            <ChannelIcon className="w-2.5 h-2.5" />
                            <span>{item.channel || 'Inbound'}</span>
                          </span>
                          <div className="text-[10px] text-slate-500">QA: <strong>{item.evaluator_name}</strong></div>
                        </div>
                      </div>

                      {/* Result Details */}
                      {isCompleted && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                          <span className="text-emerald-700 font-bold font-mono">CA: {item.score_ca}%</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-blue-700 font-semibold font-mono">FCR: {item.fcr}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                        {isTL ? (
                          <span className="text-[10px] font-semibold text-slate-400">Read-Only</span>
                        ) : (
                          <>
                            {(isAssigned || isInProgress) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(item)}
                                  className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Nilai</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSkipReason('Recording Kosong / Silent Call');
                                    setCustomSkipReason('');
                                    setActionModal({ type: 'skip', ticket: item });
                                  }}
                                  className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                                >
                                  Skip
                                </button>
                              </>
                            )}
                            {isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleOpenCompleteModal(item)}
                                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer border border-slate-200"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}
                            {isSupervisor && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReassignForm({ to_evaluator: '', reason: '', reassigned_by: user?.name || 'Supervisor QA' });
                                    setActionModal({ type: 'reassign', ticket: item });
                                  }}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-50 cursor-pointer"
                                  title="Pindahkan Tiket"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleTicket(item)}
                                  disabled={deletingTicketId === item.id}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Tarik / Hapus Tiket Ini Dari Antrean"
                                >
                                  {deletingTicketId === item.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className={`overflow-x-auto ${mobileViewMode === 'cards' ? 'hidden sm:block' : 'block'}`}>
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider font-bold text-[10px] sticky top-0">
                    {isSupervisor && (
                      <th className="py-2.5 px-3 text-center w-8">
                        <input
                          type="checkbox"
                          checked={bucketData?.data?.length > 0 && selectedTicketIds.length === bucketData?.data?.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-2.5 px-3.5">ID Tiket</th>
                    <th className="py-2.5 px-3.5">Nama CSO & NIK</th>
                    <th className="py-2.5 px-3.5">Saluran</th>
                    <th className="py-2.5 px-3.5">Tipe</th>
                    <th className="py-2.5 px-3.5">QA Evaluator</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-center">Hasil Observasi</th>
                    <th className="py-2.5 px-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingBucket && (!bucketData?.data || bucketData.data.length === 0) ? (
                    <tr>
                      <td colSpan={isSupervisor ? 9 : 8} className="py-10 text-center text-slate-500">
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin mx-auto mb-1" />
                        <span className="font-semibold text-xs">Memuat antrean sampling...</span>
                      </td>
                    </tr>
                  ) : bucketData?.data?.length === 0 ? (
                    <tr>
                      <td colSpan={isSupervisor ? 9 : 8} className="py-10 text-center text-slate-400">
                        <Inbox className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <span className="text-xs">Tidak ada tiket dalam antrean</span>
                      </td>
                    </tr>
                  ) : (
                    bucketData?.data?.map((item) => {
                      const isCompleted = item.status === 'COMPLETED' || item.is_checked;
                      const isInProgress = item.status === 'IN_PROGRESS' || item.status === 'ON_CEK';
                      const isPending = item.status === 'PENDING';
                      const isAbandoned = item.status === 'ABANDONED';
                      const isSkipped = item.status === 'SKIPPED';
                      const isAssigned = item.status === 'ASSIGNED' || !item.status;
                      const channelStyle = getChannelBadge(item.channel);
                      const ChannelIcon = channelStyle.icon;
                      const fullTicketId = item.ticket_id || '';
                      const isSelected = selectedTicketIds.includes(item.id);

                      return (
                        <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                          {isSupervisor && (
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectTicket(item.id)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                            </td>
                          )}

                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                                #{fullTicketId}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(fullTicketId, item.id)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Salin ID Tiket"
                              >
                                {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                              {item.source_ca && (
                                <span className="font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1" title={`Matched iCRM Ticket: ${item.source_ca}`}>
                                  <Link2 className="w-2.5 h-2.5 text-blue-600" />
                                  <span>iCRM: {item.source_ca}</span>
                                </span>
                              )}
                              {item.is_backlog && !isCompleted && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5 animate-pulse">
                                  <Layers className="w-2.5 h-2.5 text-amber-700" />
                                  Menumpuk ({item.backlog_days ? `${item.backlog_days}h` : item.assigned_date_formatted})
                                </span>
                              )}
                              {item.is_today && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5 text-sky-600" />
                                  Hari Ini
                                </span>
                              )}
                              {item.is_extra_quota && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                  Extra SPV (1 Hari)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900">{item.agent_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">NIK: {item.agent_nik || '-'}</div>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${channelStyle.bg}`}>
                              <ChannelIcon className="w-2.5 h-2.5" />
                              <span>{item.channel || 'Inbound'}</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.sample_type === 'MANDATORY'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-purple-50 text-purple-700'
                              }`}>
                              {item.sample_type || 'MANDATORY'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5 font-semibold text-slate-800">
                            {item.evaluator_name}
                          </td>

                          <td className="py-2.5 px-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isInProgress
                                ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                                : isPending
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : isAbandoned
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                    : isSkipped
                                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                              {isCompleted ? 'Sudah Dicek' : isInProgress ? 'On Cek' : isPending ? 'Pending' : isAbandoned ? 'Abandoned' : isSkipped ? 'Dilewati' : 'Belum Dicek'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5 text-center">
                            {isCompleted ? (
                              <div className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
                                <span className="font-bold text-emerald-700">CA: {item.score_ca}%</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-slate-600">FCR: {item.fcr}</span>
                              </div>
                            ) : isSkipped ? (
                              <span className="text-[10px] text-slate-400 italic">
                                Skip: {item.skip_reason}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">- Belum Dinilai -</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isTL ? (
                                <span className="text-[10px] font-medium text-slate-400">Read-Only</span>
                              ) : isSupervisor ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReassignForm({ to_evaluator: '', reason: '', reassigned_by: user?.name || 'Supervisor QA' });
                                      setActionModal({ type: 'reassign', ticket: item });
                                    }}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 cursor-pointer transition border border-transparent hover:border-purple-200"
                                    title="Pindahkan Tiket ke QA Lain"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingleTicket(item)}
                                    disabled={deletingTicketId === item.id}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition border border-transparent hover:border-rose-200"
                                    title="Tarik / Hapus Tiket Ini Dari Antrean"
                                  >
                                    {deletingTicketId === item.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {(isAssigned || isInProgress) && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCompleteModal(item)}
                                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Nilai</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSkipReason('Recording Kosong / Silent Call');
                                          setCustomSkipReason('');
                                          setActionModal({ type: 'skip', ticket: item });
                                        }}
                                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer transition"
                                      >
                                        Skip
                                      </button>
                                    </>
                                  )}

                                  {isCompleted && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCompleteModal(item)}
                                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] flex items-center gap-1 cursor-pointer border border-slate-200"
                                    >
                                      <Edit3 className="w-3 h-3 text-slate-500" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  {isSkipped && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCompleteModal(item)}
                                      className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[10px] cursor-pointer"
                                    >
                                      Nilai Ulang
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {bucketData?.pagination?.last_page > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">
                  Halaman <strong>{bucketData.pagination.current_page}</strong> dari <strong>{bucketData.pagination.last_page}</strong> ({bucketData.pagination.total} Tiket)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={bucketPage <= 1}
                    onClick={() => fetchBucketTickets(bucketPage - 1)}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50 text-xs"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={bucketPage >= bucketData.pagination.last_page}
                    onClick={() => fetchBucketTickets(bucketPage + 1)}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50 text-xs"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: TARGET SITE & CSO */}
      {/* =================================================================== */}
      {activeTab === 'target_breakdown' && (
        <div className="space-y-3">
          {/* Macro Overview Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    SITE {siteSummary?.site_name || 'SEMARANG (SMG)'}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">Periode: <strong>{selectedMonth}</strong></span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target Mutu: CA {siteSummary?.target_ca || 85}% | FCR {siteSummary?.target_fcr || 100}%
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateTargets}
                disabled={generatingTarget}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingTarget ? 'animate-spin' : ''}`} />
                <span>{generatingTarget ? 'Generating...' : 'Generate Snapshot'}</span>
              </button>
            </div>

            {/* 6 Macro Numbers */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
              <div className="px-2 py-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Total Target Site</span>
                <span className="text-base font-bold text-slate-900 font-mono">{siteSummary?.total_site_quota || 5920}</span>
                <span className="text-[10px] text-slate-400 block">16 QA × 370</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Target QA Utama</span>
                <span className="text-base font-bold text-slate-900 font-mono">{siteSummary?.total_qa_quota || 2960}</span>
                <span className="text-[10px] text-slate-400 block">8 QA × 370 Sesi</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Populasi CSO</span>
                <span className="text-base font-bold text-slate-900 font-mono">{siteSummary?.total_cso || 173}</span>
                <span className="text-[10px] text-slate-400 block">Plotting NAKER</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Mandatory / QA</span>
                <span className="text-base font-bold text-slate-900 font-mono">{siteSummary?.mandatory_per_qa || 346}</span>
                <span className="text-[10px] text-slate-400 block">173 CSO × 2</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Buffer Kuota / QA</span>
                <span className="text-base font-bold text-slate-900 font-mono">{siteSummary?.additional_per_qa || 24}</span>
                <span className="text-[10px] text-slate-400 block">370 - 346</span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Kepadatan CSO</span>
                <span className="text-base font-bold text-slate-900 font-mono">{siteSummary?.sampling_density_per_cso || 16}</span>
                <span className="text-[10px] text-slate-400 block">Sesi/CSO/Bulan</span>
              </div>
            </div>
          </div>

          {/* CSO Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Top Toolbar 1: Title, CSO Badge, Evaluator Filter & Search */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-slate-900">
                  Matriks Sampling CSO
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 text-slate-700">
                  {totalCsoCount} CSO Terdaftar
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="w-full sm:w-44">
                  <CustomSelect
                    value={csoQaFilter}
                    onChange={(e) => setCsoQaFilter(e.target.value)}
                    options={qaEvaluatorOptions}
                    icon={Users}
                  />
                </div>
                <div className="w-full sm:w-48 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari CSO / NIK..."
                    value={csoSearch}
                    onChange={(e) => setCsoSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportCsoMatrixExcel}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0"
                  title="Ekspor Matriks Sampling CSO ke Excel"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Ekspor Excel</span>
                </button>
              </div>
            </div>

            {/* Top Toolbar 2: Pagination Controls (Di Atas Tabel) */}
            {totalCsoCount > 0 && (
              <div className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-medium">
                    Menampilkan <strong className="text-slate-800">{csoStartIndex} - {csoEndIndex}</strong> dari <strong className="text-slate-800">{totalCsoCount}</strong> CSO
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px] font-medium">Baris:</span>
                    <div className="relative inline-flex items-center">
                      <select
                        value={String(csoPerPage)}
                        onChange={(e) => {
                          const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                          setCsoPerPage(val);
                          setCsoPage(1);
                        }}
                        className="appearance-none bg-white border border-slate-300 hover:border-slate-400 rounded-lg pl-2.5 pr-7 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer shadow-2xs transition"
                      >
                        <option value="15">15 / hal</option>
                        <option value="25">25 / hal</option>
                        <option value="50">50 / hal</option>
                        <option value="100">100 / hal</option>
                        <option value="200">200 / hal</option>
                        <option value="all">Semua</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {totalCsoPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={validCsoPage <= 1}
                      onClick={() => setCsoPage(1)}
                      className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition shadow-2xs cursor-pointer"
                      title="Halaman Pertama"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={validCsoPage <= 1}
                      onClick={() => setCsoPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sebelumnya</span>
                    </button>

                    <div className="flex items-center gap-1 px-0.5">
                      {Array.from({ length: Math.min(5, totalCsoPages) }, (_, i) => {
                        let pageNum;
                        if (totalCsoPages <= 5) {
                          pageNum = i + 1;
                        } else if (validCsoPage <= 3) {
                          pageNum = i + 1;
                        } else if (validCsoPage >= totalCsoPages - 2) {
                          pageNum = totalCsoPages - 4 + i;
                        } else {
                          pageNum = validCsoPage - 2 + i;
                        }
                        const isActive = validCsoPage === pageNum;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCsoPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive
                              ? 'bg-emerald-600 text-white shadow-xs'
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
                      disabled={validCsoPage >= totalCsoPages}
                      onClick={() => setCsoPage(p => Math.min(totalCsoPages, p + 1))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span className="hidden sm:inline">Berikutnya</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={validCsoPage >= totalCsoPages}
                      onClick={() => setCsoPage(totalCsoPages)}
                      className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition shadow-2xs cursor-pointer"
                      title="Halaman Terakhir"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-2.5 px-3.5">Nama CSO</th>
                    <th className="py-2.5 px-3.5">NIK</th>
                    <th className="py-2.5 px-3.5">Saluran</th>
                    <th className="py-2.5 px-3.5 text-center">Target</th>
                    <th className="py-2.5 px-3.5 text-center">Selesai</th>
                    <th className="py-2.5 px-3.5 text-center">Pencapaian</th>
                    <th className="py-2.5 px-3.5 text-center">Rata-Rata CA</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCso && (!csoMatrix || csoMatrix.length === 0) ? (
                    <tr>
                      <td colSpan="8" className="py-10 text-center text-slate-500">
                        <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin mx-auto mb-1" />
                        <span className="text-xs">Memuat matriks CSO...</span>
                      </td>
                    </tr>
                  ) : paginatedCsoMatrix.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400 text-xs">
                        Tidak ada data CSO yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedCsoMatrix.map((cso, idx) => {
                      const targetSessions = cso.target_sessions ?? cso.target_sampling ?? 2;
                      const completedSessions = cso.completed_sessions ?? cso.actual_sampling ?? 0;
                      const achievementPct = targetSessions > 0
                        ? Math.round((completedSessions / targetSessions) * 100)
                        : (cso.achievement_pct ? Math.round(cso.achievement_pct) : 0);
                      const avgCaText = (cso.avg_score_ca !== null && cso.avg_score_ca !== undefined)
                        ? `${cso.avg_score_ca}%`
                        : (cso.avg_ca !== null && cso.avg_ca !== undefined ? `${cso.avg_ca}%` : '-');
                      const statusText = cso.status || (completedSessions >= targetSessions ? 'COMPLETED' : 'IN PROGRESS');

                      return (
                        <tr key={cso.id || cso.nik || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3.5 font-semibold text-slate-900">{cso.agent_name}</td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">{cso.nik}</td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {cso.channel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono text-slate-700">{targetSessions} Sesi</td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-emerald-700">{completedSessions} Sesi</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${achievementPct >= 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                              {achievementPct}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-slate-800">
                            {avgCaText}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusText === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                              {statusText}
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
      )}

      {/* =================================================================== */}
      {/* TAB 3: LOG REASSIGNMENT */}
      {/* =================================================================== */}
      {activeTab === 'reassign_logs' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 space-y-3">
          <div className="font-bold text-xs text-slate-900 border-b border-slate-100 pb-2">
            Histori Audit Reassignment Tiket Antar QA
          </div>

          {loadingLogs && (!reassignmentLogs || reassignmentLogs.length === 0) ? (
            <div className="py-10 text-center text-slate-500">
              <RefreshCw className="w-4 h-4 text-purple-600 animate-spin mx-auto mb-1" />
              <span className="text-xs">Memuat log...</span>
            </div>
          ) : reassignmentLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-1">
              <History className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Belum ada aktivitas pemindahan tiket</p>
              <p className="text-[11px] text-slate-400">Semua tiket masih sesuai antrean awal.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reassignmentLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="font-mono font-bold text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                      Tiket #{log.ticket_id}
                    </span>
                    <span>{log.created_at}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">{log.from_evaluator}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-mono text-[10px]">{log.to_evaluator}</span>
                    <span className="text-[10px] text-slate-400">• oleh {log.reassigned_by}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 italic">
                    "{log.reason}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: AUDIT & TIKET ABANDONED (> 7 HARI SLA TIMEOUT) */}
      {/* =================================================================== */}
      {activeTab === 'audit_abandoned' && (
        <div className="space-y-4">
          {/* 1. Header SLA Banner & Interactive Simulation Box */}
          <div className="corp-card p-4 sm:p-5 bg-gradient-to-r from-[#0F2744] via-[#162E4D] to-[#0A192F] text-white rounded-2xl border border-slate-700/80 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Siklus Hidup & Aturan SLA 7 Hari
                  </span>
                  <span className="text-slate-400 text-xs">•</span>
                  <span className="text-xs font-mono text-rose-200">Periode: <strong>{selectedMonth}</strong></span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Monitoring Tiket Abandoned & Kedisiplinan QA Evaluator
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tiket yang telah didistribusikan memiliki masa berlaku <strong>7 hari (1 minggu)</strong>. Jika tidak diselesaikan dalam 7 hari, status tiket <strong>otomatis beralih ke ABANDONED</strong>, tercatat pada riwayat pengerjaan QA, dan masuk ke monitoring penilaian disiplin Supervisor. Supervisor dapat melakukan <em>Reopen</em> atau <em>Reassign</em> tiket ke QA lain.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportAbandonedExcel}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer"
                  title="Ekspor Laporan Audit Tiket Abandoned ke Excel"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>Ekspor Abandoned</span>
                </button>
                <button
                  type="button"
                  onClick={handleSimulateExpireStale}
                  disabled={simulatingAbandon}
                  className="px-4 py-2.5 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-700/60 font-bold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  title="Simulasikan tiket yang belum di-handle > 7 hari agar beralih ke ABANDONED"
                >
                  <Sparkles className={`w-4 h-4 ${simulatingAbandon ? 'animate-spin' : ''}`} />
                  <span>{simulatingAbandon ? 'Menjalankan Simulasi...' : '⚡ Simulasikan Kedaluwarsa SLA (> 7 Hari)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. KPI Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="corp-card p-3.5 bg-white border border-rose-200 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Total Tiket Abandoned</span>
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-950 font-mono">
                {monitoringData?.summary?.total_abandoned_tickets || 0}
              </div>
              <div className="text-[11px] text-rose-700 font-semibold mt-0.5">
                Melewati batas waktu pengerjaan 7 hari
              </div>
            </div>

            <div className="corp-card p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Tingkat Abandon (% SLA)</span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-950 font-mono">
                {monitoringData?.summary?.abandon_rate_pct || 0}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Dari total {monitoringData?.summary?.total_distributed_tickets || 0} tiket terdistribusi
              </div>
            </div>

            <div className="corp-card p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">QA Perlu Perhatian</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-sm font-black text-slate-900 truncate mt-1">
                {(() => {
                  const evals = monitoringData?.evaluators || [];
                  const highest = [...evals].sort((a, b) => (b.abandoned_count || 0) - (a.abandoned_count || 0))[0];
                  return (highest && (highest.abandoned_count || 0) > 0) ? `${highest.evaluator_name} (${highest.abandoned_count} tiket)` : 'Nihil (Semua Disiplin)';
                })()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Jumlah abandon terbanyak
              </div>
            </div>

            <div className="corp-card p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status Kedisiplinan Tim</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono mt-0.5 text-emerald-700">
                {(monitoringData?.summary?.total_abandoned_tickets || 0) === 0 ? '100% DISIPLIN' : 'AUDIT AKTIF'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {(monitoringData?.summary?.total_abandoned_tickets || 0) === 0 ? 'Tidak ada tiket kadaluwarsa' : 'Terdeteksi tiket terlewat batas waktu'}
              </div>
            </div>
          </div>

          {/* 3. Evaluators Discipline & Abandon Tracking Matrix Cards */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Matriks Kedisiplinan & Penanganan Per QA Evaluator
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ringkasan kuota, penyelesaian, dan tiket yang terbengkalai (&gt; 7 hari)
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                8 Evaluator Resmi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(monitoringData?.evaluators || []).map((ev) => {
                const abandonCount = ev.abandoned_count || 0;
                const hasAbandon = abandonCount > 0;
                const isSelected = abandonedQaFilter === ev.evaluator_name;

                return (
                  <div
                    key={ev.evaluator_name}
                    onClick={() => setAbandonedQaFilter(isSelected ? 'all' : ev.evaluator_name)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${isSelected
                      ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                      : hasAbandon
                        ? 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="font-black text-xs text-slate-900 truncate" title={ev.evaluator_name}>
                        {ev.evaluator_name}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${hasAbandon
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                        {hasAbandon ? `⚠️ ${abandonCount} Abandon` : '✓ Disiplin'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200/70 mb-2">
                      <div>
                        <span className="text-slate-400 block font-medium">Antrean</span>
                        <span className="font-bold text-slate-800 font-mono">{ev.total_bucket || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Selesai</span>
                        <span className="font-bold text-emerald-700 font-mono">{ev.completed_count || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Abandon</span>
                        <span className={`font-bold font-mono ${hasAbandon ? 'text-rose-600' : 'text-slate-500'}`}>
                          {abandonCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Pencapaian Kuota:</span>
                      <strong className="text-slate-800 font-mono">{ev.achievement_pct || 0}%</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Detailed Table of Abandoned Tickets */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Filter Toolbar */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Daftar Tiket Abandoned (&gt; 7 Hari Tidak Dihandle)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                  {(() => {
                    const tickets = monitoringData?.abandoned_tickets || [];
                    const filtered = tickets.filter(t => {
                      const matchQa = abandonedQaFilter === 'all' || t.evaluator_name === abandonedQaFilter;
                      const matchCh = abandonedChannelFilter === 'all' || t.channel === abandonedChannelFilter;
                      const matchSr = !abandonedSearch || t.ticket_id.includes(abandonedSearch) || t.agent_name.toLowerCase().includes(abandonedSearch.toLowerCase()) || t.agent_nik.includes(abandonedSearch);
                      return matchQa && matchCh && matchSr;
                    });
                    return filtered.length;
                  })()} Tiket
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari ID / CSO / NIK..."
                    value={abandonedSearch}
                    onChange={(e) => setAbandonedSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <CustomSelect
                  value={abandonedQaFilter}
                  onChange={(e) => setAbandonedQaFilter(e.target.value)}
                  options={qaEvaluatorOptions}
                  icon={Users}
                />

                <CustomSelect
                  value={abandonedChannelFilter}
                  onChange={(e) => setAbandonedChannelFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'Semua Saluran' },
                    { value: 'Inbound', label: 'Inbound' },
                    { value: 'Digilive', label: 'Digilive' },
                    { value: 'Socmed', label: 'Socmed' },
                    { value: 'Email', label: 'Email' },
                    { value: 'Outbound', label: 'Outbound' },
                    { value: 'Back Office', label: 'Back Office' }
                  ]}
                  icon={Filter}
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-2.5 px-3.5">ID Tiket</th>
                    <th className="py-2.5 px-3.5">Evaluator QA</th>
                    <th className="py-2.5 px-3.5">Nama CSO & NIK</th>
                    <th className="py-2.5 px-3.5">Saluran & Kategori</th>
                    <th className="py-2.5 px-3.5">Tgl Ditugaskan</th>
                    <th className="py-2.5 px-3.5">Waktu Abandoned</th>
                    <th className="py-2.5 px-3.5">Durasi Terlewat</th>
                    <th className="py-2.5 px-3.5 text-center">Aksi Supervisor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingMonitoring && (!monitoringData || !monitoringData.abandoned_tickets) ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 text-rose-600 animate-spin mx-auto mb-2" />
                        <span className="text-xs font-semibold">Memuat audit tiket abandoned...</span>
                      </td>
                    </tr>
                  ) : (() => {
                    const allAbandons = monitoringData?.abandoned_tickets || [];
                    const filtered = allAbandons.filter(t => {
                      const matchQa = abandonedQaFilter === 'all' || t.evaluator_name === abandonedQaFilter;
                      const matchCh = abandonedChannelFilter === 'all' || t.channel === abandonedChannelFilter;
                      const matchSr = !abandonedSearch || t.ticket_id.includes(abandonedSearch) || t.agent_name.toLowerCase().includes(abandonedSearch.toLowerCase()) || t.agent_nik.includes(abandonedSearch);
                      return matchQa && matchCh && matchSr;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-slate-400">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700">Tidak ada tiket abandoned yang ditemukan</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Semua tiket sampling aktif berada dalam batas waktu pengerjaan SLA 7 hari.</p>
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((t) => {
                      const channelBadge = getChannelBadge(t.channel);
                      const ChannelIcon = channelBadge.icon;

                      return (
                        <tr key={t.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                #{t.ticket_id}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(t.ticket_id, t.id)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                                title="Salin ID Tiket"
                              >
                                {copiedId === t.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {t.assignment_type || 'MANDATORY'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <div className="font-bold text-slate-900 text-xs">{t.evaluator_name}</div>
                            <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> SLA Terlewati
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900 text-xs">{t.agent_name}</div>
                            <span className="text-[10px] font-mono text-slate-500">NIK: {t.agent_nik}</span>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${channelBadge.bg}`}>
                                <ChannelIcon className="w-3 h-3" />
                                {channelBadge.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {t.category_name}
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5 text-slate-600 text-[11px] font-mono">
                            {t.assigned_date_formatted || '-'}
                          </td>

                          <td className="py-2.5 px-3.5 text-slate-700 text-[11px] font-mono">
                            {t.abandoned_time_display || '-'}
                          </td>

                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              {t.days_unhandled || 7} Hari (SLA 7 Hari)
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleReopenAbandoned(t)}
                                disabled={reopeningId === t.id}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
                                title="Buka kembali tiket ke antrean aktif QA"
                              >
                                {reopeningId === t.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                <span>Reopen</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setReassignForm({
                                    to_evaluator: '',
                                    reason: 'Reassign tiket abandoned (> 7 hari tidak dikerjakan)',
                                    reassigned_by: 'Supervisor QA'
                                  });
                                  setActionModal({ type: 'reassign', ticket: t });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer"
                                title="Alihkan tiket ke QA Evaluator lain"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Reassign</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: QA WORK READINESS & MONTHLY ROSTER TRACKING (RULE 2) */}
      {/* =================================================================== */}
      {activeTab === 'qa_roster' && (
        <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
          {/* KPI Cards Row - Sleek Responsive Executive Strip */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {/* Total QA */}
            <div className="p-2 sm:p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between text-center sm:text-left transition">
              <span className="text-[8px] sm:text-[10px] uppercase font-extrabold text-slate-500 truncate block tracking-tight">
                <span className="sm:hidden">Total</span>
                <span className="hidden sm:inline">Total Tim QA</span>
              </span>
              <div className="flex sm:items-baseline justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                <strong className="text-sm sm:text-lg font-black text-slate-900 font-mono">
                  {qaRosterData?.summary?.total_qa_evaluators || 8}
                </strong>
                <span className="hidden sm:inline text-[10.5px] sm:text-xs text-slate-500 font-medium">Evaluator</span>
              </div>
            </div>

            {/* On Duty */}
            <div className="p-2 sm:p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between text-center sm:text-left transition">
              <span className="text-[8px] sm:text-[10px] uppercase font-extrabold text-emerald-800 truncate block tracking-tight">
                <span className="sm:hidden">🟢 Duty</span>
                <span className="hidden sm:inline">🟢 On Duty (Ready)</span>
              </span>
              <div className="flex sm:items-baseline justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                <strong className="text-sm sm:text-lg font-black text-emerald-800 font-mono">
                  {qaRosterData?.summary?.active_duty_qas_count ?? 0}
                </strong>
                <span className="hidden sm:inline text-[10.5px] sm:text-xs text-emerald-700 font-medium">Aktif</span>
              </div>
            </div>

            {/* Standby */}
            <div className="p-2 sm:p-3 bg-amber-50/70 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between text-center sm:text-left transition">
              <span className="text-[8px] sm:text-[10px] uppercase font-extrabold text-amber-800 truncate block tracking-tight">
                <span className="sm:hidden">⏳ Standby</span>
                <span className="hidden sm:inline">⏳ Standby (Login)</span>
              </span>
              <div className="flex sm:items-baseline justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                <strong className="text-sm sm:text-lg font-black text-amber-800 font-mono">
                  {qaRosterData?.summary?.standby_qas_count ?? 0}
                </strong>
                <span className="hidden sm:inline text-[10.5px] sm:text-xs text-amber-700 font-medium">Belum Ready</span>
              </div>
            </div>

            {/* End Shift */}
            <div className="p-2 sm:p-3 bg-purple-50/70 rounded-xl border border-purple-200 shadow-xs flex flex-col justify-between text-center sm:text-left transition">
              <span className="text-[8px] sm:text-[10px] uppercase font-extrabold text-purple-800 truncate block tracking-tight">
                <span className="sm:hidden">🏁 End</span>
                <span className="hidden sm:inline">🏁 End Shift</span>
              </span>
              <div className="flex sm:items-baseline justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                <strong className="text-sm sm:text-lg font-black text-purple-800 font-mono">
                  {qaRosterData?.summary?.end_shift_qas_count ?? 0}
                </strong>
                <span className="hidden sm:inline text-[10.5px] sm:text-xs text-purple-700 font-medium">Selesai</span>
              </div>
            </div>

            {/* Off Day / Cuti */}
            <div className="p-2 sm:p-3 bg-slate-100/70 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between text-center sm:text-left transition">
              <span className="text-[8px] sm:text-[10px] uppercase font-extrabold text-slate-600 truncate block tracking-tight">
                <span className="sm:hidden">⚪ Off</span>
                <span className="hidden sm:inline">⚪ Off Day / Cuti</span>
              </span>
              <div className="flex sm:items-baseline justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                <strong className="text-sm sm:text-lg font-black text-slate-700 font-mono">
                  {qaRosterData?.summary?.off_duty_qas_count ?? 0}
                </strong>
                <span className="hidden sm:inline text-[10.5px] sm:text-xs text-slate-500 font-medium">Bebas SLA</span>
              </div>
            </div>
          </div>

          {/* 2. Roster Views */}
          {loadingRoster ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Memuat Jadwal & Kesiapan Roster QA...</p>
            </div>
          ) : rosterViewMode === 'matrix' ? (
            /* Matrix View (Table of Days 1..31) */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-2.5 sm:p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 shrink-0" />
                    <span className="text-[11.5px] sm:text-xs font-bold text-slate-800">
                      Matriks Hari Kerja Bulanan <span className="hidden sm:inline">(Klik tanggal untuk toggle status QA):</span>
                    </span>
                  </div>
                  {/* Mobile swipe gesture hint badge */}
                  <span className="sm:hidden text-[9px] font-mono font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded-md border border-blue-200 shrink-0 flex items-center gap-1">
                    <span>👉 Geser 1 - 31</span>
                  </span>
                </div>

                {/* Legend - Sleek horizontally scrollable on mobile */}
                <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0">
                  <button
                    type="button"
                    onClick={handleExportRosterExcel}
                    className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[10px] shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer mr-1"
                    title="Ekspor Jadwal & Kesiapan QA ke Excel"
                  >
                    <Download className="w-3 h-3 text-slate-600" />
                    <span>Ekspor Roster</span>
                  </button>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Duty (D)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Standby (ST)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-purple-600"></span> End Shift (ES)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Off (O)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Cuti (C)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Sakit (S)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Training (T)</span>
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-thin overscroll-x-contain">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] sm:text-[11px]">
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 sticky left-0 bg-slate-100 z-20 min-w-[125px] sm:min-w-[190px] shadow-[2px_0_5px_rgba(0,0,0,0.06)] border-r border-slate-200">
                        Evaluator QA & Shift
                      </th>
                      <th className="py-2 px-1 sm:py-2.5 sm:px-2 text-center min-w-[50px] sm:min-w-[75px]">Hari Kerja</th>
                      <th className="py-2 px-1 sm:py-2.5 sm:px-2 text-center min-w-[50px] sm:min-w-[70px]">Hari Libur</th>
                      {/* Day Columns */}
                      {Array.from({ length: qaRosterData?.days_in_month || 31 }, (_, i) => i + 1).map((day) => {
                        const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                        const isToday = dateStr === rosterSelectedDate;
                        return (
                          <th
                            key={day}
                            className={`py-1.5 sm:py-2 px-0.5 text-center font-mono min-w-[28px] sm:min-w-[32px] cursor-pointer hover:bg-slate-200 transition ${isToday ? 'bg-blue-100 text-blue-900 font-black ring-1 ring-blue-400' : ''
                              }`}
                            title={`Tanggal ${day} ${selectedMonth}`}
                          >
                            <span className="block text-[10px] sm:text-[11px]">{day}</span>
                          </th>
                        );
                      })}
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 text-right min-w-[75px] sm:min-w-[90px]">Tiket Masuk</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 text-right min-w-[70px] sm:min-w-[90px]">Selesai</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 text-right min-w-[70px] sm:min-w-[90px]">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px] sm:text-[11px]">
                    {(qaRosterData?.evaluators || []).map((evaluator) => (
                      <tr key={evaluator.evaluator_name} className="hover:bg-slate-50/80 transition">
                        {/* QA Name & Shift */}
                        <td className="py-2 px-2 sm:py-2.5 sm:px-3 sticky left-0 bg-white hover:bg-slate-50 z-20 border-r border-slate-200 font-bold text-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#0F2744] text-white flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0">
                              {evaluator.avatar_letter || evaluator.evaluator_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="truncate block max-w-[85px] sm:max-w-none text-[10.5px] sm:text-xs">{evaluator.evaluator_name}</span>
                              <span className="text-[8.5px] sm:text-[9px] font-semibold text-slate-400 block">
                                {evaluator.shift === 'Pagi' ? '🌅 Pagi' : evaluator.shift === 'Siang' ? '☀️ Siang' : '🏢 Normal'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Work Days & Off Days */}
                        <td className="py-2 px-1 sm:py-2.5 sm:px-2 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">
                          <span className="sm:hidden">{evaluator.total_duty_days}H</span>
                          <span className="hidden sm:inline">{evaluator.total_duty_days} Hari</span>
                        </td>
                        <td className="py-2 px-1 sm:py-2.5 sm:px-2 text-center font-mono font-bold text-slate-500 bg-slate-50/30">
                          <span className="sm:hidden">{evaluator.total_off_days}H</span>
                          <span className="hidden sm:inline">{evaluator.total_off_days} Hari</span>
                        </td>

                        {/* 1..31 Day Badges */}
                        {Array.from({ length: qaRosterData?.days_in_month || 31 }, (_, i) => i + 1).map((day) => {
                          const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                          const dayInfo = evaluator.daily_matrix?.[dateStr];
                          const status = dayInfo?.status || 'STANDBY';
                          const isUpdating = togglingQaReadiness === evaluator.evaluator_name;

                          let badgeClass = 'bg-emerald-500 text-white hover:bg-emerald-600';
                          let badgeText = 'D';
                          if (status === 'OFF_DAY') {
                            badgeClass = 'bg-slate-200 text-slate-600 hover:bg-slate-300';
                            badgeText = 'O';
                          } else if (status === 'LEAVE') {
                            badgeClass = 'bg-amber-400 text-amber-950 hover:bg-amber-500';
                            badgeText = 'C';
                          } else if (status === 'SICK') {
                            badgeClass = 'bg-rose-500 text-white hover:bg-rose-600';
                            badgeText = 'S';
                          } else if (status === 'TRAINING') {
                            badgeClass = 'bg-indigo-500 text-white hover:bg-indigo-600';
                            badgeText = 'T';
                          } else if (status === 'STANDBY') {
                            badgeClass = 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200';
                            badgeText = 'ST';
                          } else if (status === 'END_SHIFT') {
                            badgeClass = 'bg-purple-600 text-white hover:bg-purple-700';
                            badgeText = 'ES';
                          }

                          return (
                            <td key={day} className="py-1 px-0.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleQaReadiness(evaluator.evaluator_name, status, dateStr)}
                                disabled={isUpdating}
                                className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md font-mono text-[8.5px] sm:text-[9px] font-black transition cursor-pointer flex items-center justify-center mx-auto shadow-2xs ${badgeClass} ${isUpdating ? 'opacity-50' : ''
                                  }`}
                                title={`${evaluator.evaluator_name} - Tgl ${day}: ${status} (Klik untuk toggle Duty / End Shift / Off)`}
                              >
                                {badgeText}
                              </button>
                            </td>
                          );
                        })}

                        {/* Summary Metrics */}
                        <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-slate-800">
                          {evaluator.total_distributed}
                        </td>
                        <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-emerald-700">
                          {evaluator.total_completed}
                        </td>
                        <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-right">
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold ${evaluator.completion_rate_pct >= 90
                            ? 'bg-emerald-100 text-emerald-800'
                            : evaluator.completion_rate_pct >= 50
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                            }`}>
                            {evaluator.completion_rate_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View (Detail Per QA dengan Shift Lifecycle & Audit Timestamps) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(qaRosterData?.evaluators || []).map((evaluator) => {
                const selectedDayMatrix = evaluator.daily_matrix?.[rosterSelectedDate];
                const status = selectedDayMatrix?.status || evaluator.today_status || 'STANDBY';
                const isDuty = (selectedDayMatrix?.is_ready ?? evaluator.today_is_ready) && (status === 'ON_DUTY');
                const isStandby = status === 'STANDBY';
                const isEndShift = status === 'END_SHIFT';
                const isToggling = togglingQaReadiness === evaluator.evaluator_name;
                const shift = selectedDayMatrix?.shift || evaluator.shift || 'Normal';
                const dayTicketsAssigned = selectedDayMatrix?.tickets_assigned || 0;

                return (
                  <div
                    key={evaluator.evaluator_name}
                    className={`corp-card p-4 rounded-2xl border transition shadow-xs flex flex-col justify-between gap-3 ${isDuty
                      ? 'bg-white border-emerald-300 ring-1 ring-emerald-500/15'
                      : isStandby
                        ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-500/10'
                        : isEndShift
                          ? 'bg-purple-50/30 border-purple-300 ring-1 ring-purple-500/10'
                          : status === 'LEAVE'
                            ? 'bg-amber-50/40 border-amber-300'
                            : status === 'SICK'
                              ? 'bg-rose-50/40 border-rose-300'
                              : 'bg-slate-50 border-slate-300 opacity-95'
                      }`}
                  >
                    <div className="space-y-2.5">
                      {/* QA Identity & Status Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${isDuty
                            ? 'bg-emerald-700 text-white'
                            : isStandby
                              ? 'bg-amber-500 text-slate-950'
                              : isEndShift
                                ? 'bg-purple-700 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                            {evaluator.avatar_letter || evaluator.evaluator_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-900 truncate">
                              {evaluator.evaluator_name}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {/* Shift Badge */}
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                {shift === 'Pagi' ? <Sun className="w-2.5 h-2.5 text-amber-500" /> : shift === 'Siang' ? <Moon className="w-2.5 h-2.5 text-indigo-500" /> : <Clock className="w-2.5 h-2.5 text-slate-500" />}
                                <span>{shift === 'Pagi' ? 'Pagi' : shift === 'Siang' ? 'Siang' : 'Normal'}</span>
                              </span>

                              {/* Status Badge */}
                              <span className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full ${isDuty
                                ? 'bg-emerald-100 text-emerald-800'
                                : isStandby
                                  ? 'bg-amber-100 text-amber-900'
                                  : isEndShift
                                    ? 'bg-purple-100 text-purple-900'
                                    : status === 'LEAVE'
                                      ? 'bg-amber-100 text-amber-900'
                                      : status === 'SICK'
                                        ? 'bg-rose-100 text-rose-900'
                                        : 'bg-slate-200 text-slate-700'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isDuty ? 'bg-emerald-500 animate-pulse' : isStandby ? 'bg-amber-500' : isEndShift ? 'bg-purple-600' : 'bg-slate-400'}`}></span>
                                {isDuty ? 'ON DUTY' : isStandby ? 'STANDBY' : isEndShift ? 'END SHIFT' : status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Main Duty Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleQaReadiness(evaluator.evaluator_name, evaluator.today_status, rosterSelectedDate)}
                          disabled={isToggling}
                          className={`p-1.5 px-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-[10.5px] font-bold shadow-2xs active:scale-95 ${isDuty
                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                            : isEndShift
                              ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
                              : isStandby
                                ? 'bg-amber-500 text-slate-950 border-amber-600 hover:bg-amber-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            } disabled:opacity-50`}
                          title={isDuty ? 'Klik untuk End Shift' : isEndShift ? 'Klik untuk Off Day' : 'Klik untuk Ready (On Duty)'}
                        >
                          {isToggling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isDuty ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                          <span>{isDuty ? 'DUTY' : isEndShift ? 'END' : isStandby ? 'READY?' : 'OFF'}</span>
                        </button>
                      </div>

                      {/* Shift Audit Timestamps Strip for Supervisor */}
                      <div className="p-2 rounded-xl bg-slate-50/90 border border-slate-200 text-[10px] space-y-1">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>🔑</span> Login:
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {selectedDayMatrix?.login_time || evaluator.login_time ? `${selectedDayMatrix?.login_time || evaluator.login_time} WIB` : '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>🟢</span> Ready (On Duty):
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {selectedDayMatrix?.ready_time || evaluator.ready_time ? `${selectedDayMatrix?.ready_time || evaluator.ready_time} WIB` : '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>🏁</span> End Shift:
                          </span>
                          <span className="font-mono font-bold text-purple-700">
                            {selectedDayMatrix?.end_shift_time || evaluator.end_shift_time ? `${selectedDayMatrix?.end_shift_time || evaluator.end_shift_time} WIB` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Status Setter Segment (Duty / Standby / End Shift / Off / Cuti) */}
                      <div className="pt-2 border-t border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">Set Status Cepat:</span>
                        <div className="grid grid-cols-5 gap-1">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleSetSpecificQaStatus(evaluator.evaluator_name, 'ON_DUTY', rosterSelectedDate, 'On Duty Bertugas')}
                            className={`py-1 text-[9px] font-bold rounded-lg border transition text-center cursor-pointer ${isDuty ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            title="Set Ready / On Duty (JIT Auto-Pull)"
                          >
                            Duty
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleSetSpecificQaStatus(evaluator.evaluator_name, 'STANDBY', rosterSelectedDate, 'Standby Login')}
                            className={`py-1 text-[9px] font-bold rounded-lg border transition text-center cursor-pointer ${isStandby ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            title="Set Standby (Baru Login)"
                          >
                            Standby
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleSetSpecificQaStatus(evaluator.evaluator_name, 'END_SHIFT', rosterSelectedDate, 'Shift Selesai (End Shift)')}
                            className={`py-1 text-[9px] font-bold rounded-lg border transition text-center cursor-pointer ${isEndShift ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            title="Set Selesai Shift"
                          >
                            End
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleSetSpecificQaStatus(evaluator.evaluator_name, 'OFF_DAY', rosterSelectedDate, 'Libur / Off Day')}
                            className={`py-1 text-[9px] font-bold rounded-lg border transition text-center cursor-pointer ${status === 'OFF_DAY' ? 'bg-slate-700 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            title="Set Off Day"
                          >
                            Off
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleSetSpecificQaStatus(evaluator.evaluator_name, 'LEAVE', rosterSelectedDate, 'Cuti / Izin Kerja')}
                            className={`py-1 text-[9px] font-bold rounded-lg border transition text-center cursor-pointer ${status === 'LEAVE' ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            title="Set Cuti"
                          >
                            Cuti
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer Metrics */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Tiket Hari Ini ({rosterSelectedDate}):</span>
                        <strong className={`font-mono ${(selectedDayMatrix?.tickets_assigned || 0) >= 20 ? 'text-emerald-700 font-bold' : (selectedDayMatrix?.tickets_assigned || 0) > 0 ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
                          {selectedDayMatrix?.tickets_assigned || 0} / 20 Tiket
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Total Masuk (Bulan Ini):</span>
                        <strong className="text-slate-900 font-mono">{evaluator.total_distributed} Tiket</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Hari Kerja Bulanan:</span>
                        <strong className="text-slate-900 font-mono">{evaluator.total_duty_days} Hari</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Penyelesaian:</span>
                        <strong className="text-emerald-700 font-mono">{evaluator.total_completed} Selesai ({evaluator.completion_rate_pct}%)</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS - OPTIMIZED FOR ANDROID WEBVIEW / MOBILE TOUCH */}
      {/* =================================================================== */}

      {/* 1. Modal Import & Dual-File Matching (iCRM + Omni Summary) */}
      {importModalOpen && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full max-h-[94dvh] sm:max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                  <GitCompare className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Setor & Dual Matching Tarikan Tiket CRM & Omni
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Auto Distribution V2
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Penyelarasan otomatis 2 data: <strong>ListTicketingRetail (iCRM)</strong> + <strong>Ticket Summary (Omni)</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Rules Banner */}
              <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-slate-50 to-emerald-50/90 rounded-2xl border border-blue-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-700 shrink-0" />
                    <span className="font-bold text-slate-800">
                      Standar Aturan Matching 3 Tingkat (3-Tier Rule Engine):
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-blue-200 text-blue-800 shadow-2xs">
                    Site Semarang (SMG)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 bg-white/90 rounded-xl border border-blue-100 shadow-2xs">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-black">1</span>
                      Primary Key
                    </div>
                    <p className="text-slate-600 mt-0.5">Nomor Tiket Omni (kolom <strong>Ticket</strong>) sebagai ID tiket utama.</p>
                  </div>
                  <div className="p-2 bg-white/90 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] flex items-center justify-center font-black">2</span>
                      Secondary Key
                    </div>
                    <p className="text-slate-600 mt-0.5">Nama Agent (kolom <strong>Handling</strong>), difilter hanya kode <strong>SMG</strong>.</p>
                  </div>
                  <div className="p-2 bg-white/90 rounded-xl border border-purple-100 shadow-2xs">
                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[10px] flex items-center justify-center font-black">3</span>
                      Tertiary / Matching
                    </div>
                    <p className="text-slate-600 mt-0.5">Nomor Tiket iCRM (kolom <strong>Note</strong> Omni dicocokkan ke <strong>idtiket</strong> iCRM).</p>
                  </div>
                </div>
              </div>

              {/* Dual Upload Slots Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Slot 1: Tarikan iCRM (ListTicketingRetail) */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingIcrm(true); }}
                  onDragLeave={() => setIsDraggingIcrm(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingIcrm(false);
                    if (e.dataTransfer.files?.[0]) handleIcrmFile(e.dataTransfer.files[0]);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[140px] ${
                    isDraggingIcrm ? 'border-blue-500 bg-blue-50/70' :
                    icrmFile ? 'border-blue-400 bg-blue-50/30' :
                    'border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/60'
                  }`}
                >
                  <input
                    ref={icrmFileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onClick={(e) => { e.target.value = null; }}
                    onChange={(e) => e.target.files?.[0] && handleIcrmFile(e.target.files[0])}
                    className="hidden"
                  />
                  
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">1. Tarikan ListTicketing iCRM</h4>
                        <p className="text-[10px] text-slate-500">Format: ListTicketingRetail (62 Kolom)</p>
                      </div>
                    </div>
                    {icrmFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setIcrmFile(null);
                          setIcrmFileName('');
                          setIcrmFileSizeText('');
                          setIcrmRows([]);
                          executeDualMatching([], omniRows);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus Berkas iCRM"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {icrmFile ? (
                    <div className="mt-3 p-2.5 bg-white rounded-xl border border-blue-200/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">{icrmFileName}</p>
                        <p className="text-[10px] text-slate-500">{icrmFileSizeText} • <span className="text-blue-700 font-semibold">{icrmRows.length.toLocaleString('id-ID')} tiket</span></p>
                      </div>
                      <button
                        type="button"
                        onClick={() => icrmFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => icrmFileInputRef.current?.click()}
                      className="mt-3 py-3 px-2 border border-dashed border-blue-200 rounded-xl bg-white/70 hover:bg-blue-50/40 text-center cursor-pointer transition"
                    >
                      <Upload className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-800">
                        Pilih Berkas <span className="text-blue-700 underline">iCRM Retail</span>
                      </p>
                      <p className="text-[9.5px] text-slate-400 mt-0.5">Mendukung .xls, .xlsx, .csv</p>
                    </div>
                  )}
                </div>

                {/* Slot 2: Tarikan Omni (Ticket Summary) */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingOmni(true); }}
                  onDragLeave={() => setIsDraggingOmni(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOmni(false);
                    if (e.dataTransfer.files?.[0]) handleOmniFile(e.dataTransfer.files[0]);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[140px] ${
                    isDraggingOmni ? 'border-emerald-500 bg-emerald-50/70' :
                    omniFile ? 'border-emerald-400 bg-emerald-50/30' :
                    'border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50/60'
                  }`}
                >
                  <input
                    ref={omniFileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onClick={(e) => { e.target.value = null; }}
                    onChange={(e) => e.target.files?.[0] && handleOmniFile(e.target.files[0])}
                    className="hidden"
                  />
                  
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">2. Tarikan Summary Omni</h4>
                        <p className="text-[10px] text-slate-500">Format: ntjpqhu5_Ticket_Summary...</p>
                      </div>
                    </div>
                    {omniFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setOmniFile(null);
                          setOmniFileName('');
                          setOmniFileSizeText('');
                          setOmniRows([]);
                          executeDualMatching(icrmRows, []);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus Berkas Omni"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {omniFile ? (
                    <div className="mt-3 p-2.5 bg-white rounded-xl border border-emerald-200/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">{omniFileName}</p>
                        <p className="text-[10px] text-slate-500">{omniFileSizeText} • <span className="text-emerald-700 font-semibold">{omniRows.length.toLocaleString('id-ID')} tiket</span></p>
                      </div>
                      <button
                        type="button"
                        onClick={() => omniFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => omniFileInputRef.current?.click()}
                      className="mt-3 py-3 px-2 border border-dashed border-emerald-200 rounded-xl bg-white/70 hover:bg-emerald-50/40 text-center cursor-pointer transition"
                    >
                      <Upload className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-800">
                        Pilih Berkas <span className="text-emerald-700 underline">Summary Omni</span>
                      </p>
                      <p className="text-[9.5px] text-slate-400 mt-0.5">Mendukung .xlsx, .xls, .csv</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-File Dropzone Note */}
              {(!icrmFile || !omniFile) && (
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="py-2.5 px-3 bg-slate-100/70 border border-slate-200 rounded-xl text-center text-xs text-slate-600 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Tips: Anda dapat <strong>menyeret & melepas kedua file sekaligus</strong> ke area ini. Sistem akan mendeteksi tipe file secara otomatis.
                  </span>
                </div>
              )}

              {/* Matching Statistics KPI Cards */}
              {(icrmFile || omniFile) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total iCRM</span>
                    <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {matchingResult.totalIcrm.toLocaleString('id-ID')}
                    </div>
                    <span className="text-[9px] text-slate-500">Tiket Retail</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Omni</span>
                    <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {matchingResult.totalOmni.toLocaleString('id-ID')}
                    </div>
                    <span className="text-[9px] text-slate-500">Seluruh Site</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Omni SMG (Kandidat)</span>
                    <div className="text-sm font-extrabold text-emerald-700 mt-0.5 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{matchingResult.totalOmniSmg.toLocaleString('id-ID')}</span>
                    </div>
                    <span className="text-[9px] text-emerald-600">
                      {matchingResult.totalOmni > 0 ? `${Math.round((matchingResult.totalOmniSmg / matchingResult.totalOmni) * 100)}% dari Omni` : '0%'}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Non-SMG (Disaring)</span>
                    <div className="text-sm font-extrabold text-amber-700 mt-0.5 flex items-center gap-1">
                      <UserX className="w-3.5 h-3.5" />
                      <span>{matchingResult.nonSmgCount.toLocaleString('id-ID')}</span>
                    </div>
                    <span className="text-[9px] text-amber-600">Luar Site Semarang</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Tidak Ada Respon</span>
                    <div className="text-sm font-extrabold text-rose-700 mt-0.5 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" />
                      <span>{matchingResult.noResponseCount.toLocaleString('id-ID')}</span>
                    </div>
                    <span className="text-[9px] text-rose-600">Disaring (Tanpa Sampling)</span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Tiket Ter-Match</span>
                    <div className="text-base font-black text-emerald-900 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{matchingResult.matched.length.toLocaleString('id-ID')}</span>
                    </div>
                    <span className="text-[9px] font-semibold text-emerald-700">
                      {matchingResult.totalOmniSmg > 0 ? `${Math.round((matchingResult.matched.length / matchingResult.totalOmniSmg) * 100)}% Match SMG` : 'Siap Injeksi'}
                    </span>
                  </div>
                </div>
              )}

              {/* Review & Preview Tab Table */}
              {(matchingResult.matched.length > 0 || matchingResult.unmatchedSmg.length > 0 || matchingResult.nonSmgRows.length > 0 || matchingResult.noResponseRows.length > 0) && (
                <div className="space-y-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                  {/* Table Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab('matched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewFilterTab === 'matched'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Ter-Match ({matchingResult.matched.length.toLocaleString('id-ID')})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab('unmatched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewFilterTab === 'unmatched'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Unmatched SMG ({matchingResult.unmatchedSmg.length.toLocaleString('id-ID')})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab('non_smg')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewFilterTab === 'non_smg'
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Non-SMG ({matchingResult.nonSmgCount.toLocaleString('id-ID')})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab('no_response')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewFilterTab === 'no_response'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Tidak Ada Respon ({matchingResult.noResponseCount.toLocaleString('id-ID')})</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari tiket / agent..."
                        value={previewSearchTerm}
                        onChange={(e) => setPreviewSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-hidden w-full sm:w-48"
                      />
                    </div>
                  </div>

                  {/* Table Content */}
                  <div className="bg-white rounded-xl border border-slate-200 max-h-56 overflow-y-auto overflow-x-auto shadow-2xs">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-100/80 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5 text-center">No</th>
                          <th className="py-2 px-2.5">Omni Ticket (Primary)</th>
                          <th className="py-2 px-2.5">Agent Handling (SMG)</th>
                          <th className="py-2 px-2.5">iCRM Ticket (Note)</th>
                          <th className="py-2 px-2.5">Channel</th>
                          <th className="py-2 px-2.5">Kategori & Kondisi</th>
                          <th className="py-2 px-2.5">Pelanggan</th>
                          <th className="py-2 px-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {(() => {
                          let displayList = [];
                          if (previewFilterTab === 'matched') displayList = matchingResult.matched;
                          else if (previewFilterTab === 'unmatched') displayList = matchingResult.unmatchedSmg;
                          else if (previewFilterTab === 'non_smg') displayList = matchingResult.nonSmgRows;
                          else if (previewFilterTab === 'no_response') displayList = matchingResult.noResponseRows;
                          else displayList = [...matchingResult.matched, ...matchingResult.unmatchedSmg];

                          if (previewSearchTerm) {
                            const term = previewSearchTerm.toLowerCase();
                            displayList = displayList.filter(item =>
                              String(item.ticket_id || '').toLowerCase().includes(term) ||
                              String(item.agent_name || '').toLowerCase().includes(term) ||
                              String(item.source_ca || '').toLowerCase().includes(term) ||
                              String(item.sub_category || '').toLowerCase().includes(term) ||
                              String(item.customer_name || '').toLowerCase().includes(term)
                            );
                          }

                          if (displayList.length === 0) {
                            return (
                              <tr>
                                <td colSpan="8" className="py-6 text-center text-slate-400">
                                  Tidak ada data untuk filter yang dipilih.
                                </td>
                              </tr>
                            );
                          }

                          return displayList.slice(0, 100).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                              <td className="py-1.5 px-2.5 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">
                                #{row.ticket_id || '-'}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <div className="font-bold text-slate-800">{row.agent_name}</div>
                                {row.raw_handling && row.raw_handling !== row.agent_name && (
                                  <span className="text-[9.5px] text-slate-400">({row.raw_handling})</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5">
                                {row.source_ca ? (
                                  <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                    {row.source_ca}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">-</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600">{row.channel || 'Digilive'}</td>
                              <td className="py-1.5 px-2.5">
                                <div className="flex flex-col gap-0.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 w-fit">
                                    {row.category || 'GANGGUAN'}
                                  </span>
                                  {row.sub_category && (
                                    <span className={`text-[9.5px] font-medium ${isNoResponseCondition(row.sub_category) ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                      {row.sub_category}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600 truncate max-w-[120px]">
                                {row.customer_name || '-'}
                              </td>
                              <td className="py-1.5 px-2.5 text-center">
                                {row.is_matched ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ Match
                                  </span>
                                ) : row.reason?.includes('RESPON') ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={row.reason}>
                                    🚫 No Respon
                                  </span>
                                ) : row.reason ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Non-SMG
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                    Unmatched
                                  </span>
                                )}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Menampilkan hingga 100 baris pertama untuk pratinjau cepat.</span>
                    <span className="font-semibold text-slate-600">Total terfilter: {(previewFilterTab === 'matched' ? matchingResult.matched.length : previewFilterTab === 'unmatched' ? matchingResult.unmatchedSmg.length : previewFilterTab === 'non_smg' ? matchingResult.nonSmgCount : matchingResult.noResponseCount).toLocaleString('id-ID')} baris</span>
                  </div>
                </div>
              )}

              {/* Ingestion Target Selection & Configuration */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">
                    Pilihan Target Tiket yang Diinjeksi:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInjectSelection('matched_only')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        injectSelection === 'matched_only'
                          ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Hanya Tiket Ter-Match
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Hanya menginjeksi <strong>{matchingResult.matched.length.toLocaleString('id-ID')} tiket</strong> yang memiliki verifikasi lengkap (Omni + SMG + iCRM).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInjectSelection('all_smg')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        injectSelection === 'all_smg'
                          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Seluruh Tiket SMG
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                          Total SMG
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Menginjeksi seluruh <strong>{matchingResult.totalOmniSmg.toLocaleString('id-ID')} tiket</strong> agent SMG (termasuk yang belum memiliki tiket iCRM).
                      </p>
                    </button>
                  </div>
                </div>

                {/* Channel & Mode Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200">
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-800">
                      Saluran Pelayanan (Channel Routing):
                    </label>
                    <select
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="Auto">Auto (Semua Saluran CRM / Multi-Channel Detect)</option>
                      <optgroup label="── Override Manual (Paksa 1 Saluran) ──">
                        <option value="Inbound">Inbound (Voice / Telepon)</option>
                        <option value="Digilive">Digilive (Live Chat MyIcon+)</option>
                        <option value="Socmed">Socmed (Social Media DM)</option>
                        <option value="Email">Email (Email Inbound)</option>
                        <option value="Email Outbound">Email Outbound</option>
                        <option value="Outbound Call">Outbound Call</option>
                        <option value="Back Office">Back Office (Ketepatan Eskalasi BO)</option>
                      </optgroup>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-800">
                      Metode Injeksi Data:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('upsert')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          importMode === 'upsert'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Upsert (Update & Insert)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('append')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          importMode === 'append'
                            ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Append (Tambah Baru)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar during Import */}
              {importProgress && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-700" />
                      {importProgress.statusText}
                    </span>
                    <span>{importProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Status Notice */}
              {importStatus.message && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                    importStatus.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {importStatus.type === 'error' ? (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

            </div>

            {/* Modal Actions (Sticky Footer) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-2.5 shrink-0 bg-white">
              <button
                type="button"
                onClick={resetImport}
                disabled={importing || (!icrmFile && !omniFile)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-slate-100 cursor-pointer disabled:opacity-30 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Berkas</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  disabled={importing}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40 transition"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={submitImport}
                  disabled={importing || (injectSelection === 'matched_only' ? matchingResult.matched.length === 0 : matchingResult.totalOmniSmg === 0 && parsedRows.length === 0)}
                  className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menginjeksi...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-4 h-4" />
                      <span>
                        {(() => {
                          const count = injectSelection === 'matched_only'
                            ? matchingResult.matched.length
                            : (matchingResult.totalOmniSmg || parsedRows.length);
                          return count > 0
                            ? `Injeksi ${count.toLocaleString('id-ID')} Tiket (${injectSelection === 'matched_only' ? 'Matched' : 'Semua SMG'})`
                            : 'Mulai Injeksi';
                        })()}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* 2. Modal Selesaikan Penilaian (Complete Modal) */}
      {actionModal?.type === 'complete' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Input Observasi Mutu</span>
                <h3 className="font-black text-slate-900 text-sm">
                  Penilaian Tiket #{actionModal.ticket.ticket_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">CSO:</span>
                  <strong className="text-slate-900">{actionModal.ticket.agent_name} (NIK: {actionModal.ticket.agent_nik})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saluran:</span>
                  <strong className="text-slate-900">{actionModal.ticket.channel}</strong>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Skor CA (Customer Assurance):
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={completeForm.score_ca}
                      onChange={(e) => setCompleteForm({ ...completeForm, score_ca: parseFloat(e.target.value) || 0 })}
                      className="w-16 p-1 text-right font-black text-xs text-blue-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={completeForm.score_ca}
                  onChange={(e) => setCompleteForm({ ...completeForm, score_ca: parseFloat(e.target.value) || 0 })}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold mt-0.5">
                  <span>0%</span>
                  <span className="text-emerald-700 font-bold">Target Mutu: 85.0%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  First Contact Resolution (FCR) - Target: 100%
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompleteForm({ ...completeForm, fcr: 'YA' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${completeForm.fcr === 'YA'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>YA (Tuntas)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompleteForm({ ...completeForm, fcr: 'TIDAK' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${completeForm.fcr === 'TIDAK'
                      ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>TIDAK (Follow Up)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Evaluasi / Feedback Mutu (Opsional)
                </label>
                <textarea
                  rows="2"
                  placeholder="Keterangan interaksi atau area perbaikan..."
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Simpan Penilaian</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Modal Skip Tiket */}
      {actionModal?.type === 'skip' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Skip Workflow</span>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Lewati Tiket #{actionModal.ticket.ticket_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSkipSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Pilih alasan kenapa tiket ini tidak dapat dievaluasi secara valid:
              </p>

              <div className="space-y-2">
                {[
                  'Recording Kosong / Silent Call',
                  'Salah Routing Saluran Mutu / Non-Evaluable',
                  'Duplikasi Tiket / Repeated Sampling',
                  'Durasi Call < 10 Detik / Abandoned',
                  'Lainnya'
                ].map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${skipReason === reason
                      ? 'bg-amber-50 border-amber-400 text-slate-900 ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <input
                      type="radio"
                      name="skip_reason"
                      value={reason}
                      checked={skipReason === reason}
                      onChange={() => setSkipReason(reason)}
                      className="accent-amber-600"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {skipReason === 'Lainnya' && (
                <input
                  type="text"
                  placeholder="Tuliskan alasan lainnya..."
                  value={customSkipReason}
                  onChange={(e) => setCustomSkipReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Konfirmasi Skip</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Modal Reassign Tiket */}
      {actionModal?.type === 'reassign' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Supervisor Action</span>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Pindahkan Tiket #{actionModal.ticket.ticket_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Evaluator Saat Ini:</span>
                  <strong className="text-purple-900">{actionModal.ticket.evaluator_name}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Pindahkan ke Evaluator Tujuan:
                </label>
                <select
                  value={reassignForm.to_evaluator}
                  onChange={(e) => setReassignForm({ ...reassignForm, to_evaluator: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih QA Evaluator --</option>
                  {qaEvaluatorOptions.filter(o => o.value !== 'all' && o.value !== actionModal.ticket.evaluator_name).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Pemindahan / Catatan Supervisor:
                </label>
                <textarea
                  rows="2"
                  placeholder="Kelebihan beban kerja, perataan kuota, cuti..."
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  <span>Pindahkan Tiket</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 5. Modal Penarikan & Rollback Data (Recall & Rollback Modal - Supervisor Only) */}
      {recallModalOpen && isSupervisor && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Tarik Antrean & Rollback Data
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kelola penarikan tiket dari antrean QA Evaluator atau rollback berkas impor Excel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecallModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-5 shrink-0">
              <button
                type="button"
                onClick={() => setRecallActiveTab('recall_queue')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${recallActiveTab === 'recall_queue'
                  ? 'border-rose-600 text-rose-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tarik Antrean Sampling</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecallActiveTab('import_batches');
                  fetchImportBatches();
                }}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${recallActiveTab === 'import_batches'
                  ? 'border-rose-600 text-rose-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat Berkas & Rollback Batch</span>
                {importBatchesList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono">
                    {importBatchesList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {recallActiveTab === 'recall_queue' ? (
                <form onSubmit={handleRecallQueueSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      Pilih Mode Penarikan Data (Periode {selectedMonth}):
                    </label>

                    <div className="space-y-2.5">
                      {/* Option 1: Assigned Only */}
                      <label
                        className={`block p-3 rounded-2xl border transition cursor-pointer ${recallMode === 'assigned_only'
                          ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="recall_mode"
                            value="assigned_only"
                            checked={recallMode === 'assigned_only'}
                            onChange={() => setRecallMode('assigned_only')}
                            className="mt-0.5 accent-blue-600"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-xs font-bold text-slate-900">
                                Tarik Tiket Belum Dinilai Saja (ASSIGNED / IN PROGRESS)
                              </strong>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Rekomendasi
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Menarik kembali tiket yang belum selesai dinilai dari antrean QA Evaluator. Tiket yang sudah selesai dinilai (COMPLETED) <strong>tetap aman dan tersimpan</strong>.
                            </p>
                          </div>
                        </div>
                      </label>

                      {/* Option 2: All Sampling */}
                      <label
                        className={`block p-3 rounded-2xl border transition cursor-pointer ${recallMode === 'all_sampling'
                          ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="recall_mode"
                            value="all_sampling"
                            checked={recallMode === 'all_sampling'}
                            onChange={() => setRecallMode('all_sampling')}
                            className="mt-0.5 accent-amber-600"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-xs font-bold text-slate-900">
                                Kosongkan Seluruh Antrean Sampling Periode Ini
                              </strong>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Reset Antrean
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Menghapus seluruh antrean kerja sampling untuk bulan {selectedMonth}. Gunakan jika ingin mendistribusikan ulang sampling dari awal secara total.
                            </p>
                          </div>
                        </div>
                      </label>

                      {/* Option 3: Wipe Raw + Sampling */}
                      <label
                        className={`block p-3 rounded-2xl border transition cursor-pointer ${recallMode === 'wipe_imported_data'
                          ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="recall_mode"
                            value="wipe_imported_data"
                            checked={recallMode === 'wipe_imported_data'}
                            onChange={() => setRecallMode('wipe_imported_data')}
                            className="mt-0.5 accent-rose-600"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-xs font-bold text-slate-900">
                                Tarik Antrean & Hapus Seluruh Raw Assessment Impor
                              </strong>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                Full Wipe Periode
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Menghapus seluruh antrean sampling serta data raw assessment yang diimpor pada periode {selectedMonth} untuk pembersihan penuh.
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Additional Scope Filter */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Batasi Cakupan Penarikan (Opsional):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Filter Saluran:</label>
                        <select
                          value={recallChannel}
                          onChange={(e) => setRecallChannel(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                        >
                          <option value="all">Semua Saluran</option>
                          <option value="Inbound">Inbound</option>
                          <option value="Digilive">Digilive</option>
                          <option value="Socmed">Socmed</option>
                          <option value="Email">Email</option>
                          <option value="Outbound">Outbound Call</option>
                          <option value="Back Office">Back Office</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Filter QA Evaluator:</label>
                        <select
                          value={recallEvaluator}
                          onChange={(e) => setRecallEvaluator(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                        >
                          {qaEvaluatorOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setRecallModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={recallingQueue}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {recallingQueue ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>Konfirmasi Tarik Data</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 leading-relaxed">
                    Setiap berkas Excel (<em>ListTicketingRetail</em> / <em>QSF</em>) yang disetor oleh Supervisor tercatat di bawah ini. Anda dapat menarik dan menghapus satu berkas tertentu beserta tiket sampling yang dibentuk darinya.
                  </div>

                  {loadingBatches ? (
                    <div className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 text-rose-600 animate-spin mx-auto mb-2" />
                      <p className="text-xs font-semibold">Memuat riwayat berkas impor...</p>
                    </div>
                  ) : importBatchesList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Belum ada riwayat berkas impor</p>
                      <p className="text-[11px] text-slate-400">Berkas yang disetor oleh Supervisor akan muncul di sini.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {importBatchesList.map((batch) => (
                        <div
                          key={batch.id}
                          className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                              <strong className="text-xs font-bold text-slate-900 truncate">
                                {batch.file_name}
                              </strong>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {batch.channel || 'Inbound'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                              <span>Waktu: <strong>{batch.created_at}</strong></span>
                              <span>•</span>
                              <span>Uploader: <strong>{batch.uploader_name}</strong></span>
                              <span>•</span>
                              <span>Total Baris: <strong>{batch.total_rows}</strong></span>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">Asesmen: {batch.assessment_count}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRollbackBatch(batch)}
                            disabled={rollingBackBatchId === batch.id}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-50"
                            title="Tarik & Rollback Berkas Ini"
                          >
                            {rollingBackBatchId === batch.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Tarik Berkas Ini</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setRecallModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. MODAL TAMBAH TIKET SPV (RULE 1 & RULE 3: BATAS WAKTU 1 HARI) */}
      {showExtraQuotaModal && isSupervisor && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Akses Tambah Tiket Supervisor
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Batas Waktu: <strong>1 Hari (24 Jam)</strong> • Periode: <strong className="font-mono">{selectedMonth}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExtraQuotaModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tab Switcher */}
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setExtraQuotaActiveTab('requests')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${extraQuotaActiveTab === 'requests'
                  ? 'border-amber-500 text-amber-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Permintaan QA</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-900 font-mono font-bold">
                  {pendingQuotaRequests.filter(r => r.status === 'PENDING').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExtraQuotaActiveTab('manual')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${extraQuotaActiveTab === 'manual'
                  ? 'border-amber-500 text-amber-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Beri Kuota Manual</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Alert 1-Day Validity Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                <div className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>Ketentuan Masa Berlaku:</span>
                </div>
                <p className="text-[10px] text-amber-900 leading-relaxed">
                  Tiket tambahan yang diberikan memiliki masa aktif <strong>1 hari (24 Jam)</strong>. Jika tidak selesai dinilai dalam 24 jam, tiket tambahan yang berlebih akan kedaluwarsa.
                </p>
              </div>

              {/* Live Raw Pool Status in Extra Quota Modal */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-700" />
                  <span className="text-slate-700 font-medium">Sisa Tiket Mentah Cadangan (Pool):</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                    {(bucketData?.stats?.raw_buffer_remaining || 0).toLocaleString('id-ID')} Tiket
                  </span>
                  <span className="text-[10px] text-slate-400">
                    (Total: {(bucketData?.stats?.raw_total_imported || 0).toLocaleString('id-ID')})
                  </span>
                </div>
              </div>

              {extraQuotaActiveTab === 'requests' ? (
                <div className="space-y-3">
                  {loadingQuotaRequests ? (
                    <div className="py-10 text-center text-slate-500 space-y-2">
                      <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto" />
                      <p className="text-xs">Memuat daftar permintaan kuota...</p>
                    </div>
                  ) : pendingQuotaRequests.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 space-y-1">
                      <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">Tidak ada permintaan tambahan kuota</p>
                      <p className="text-[11px] text-slate-400">
                        Evaluator QA dapat mengajukan penambahan tiket dari lembar kerja sampling.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingQuotaRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{req.evaluator_name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 font-mono">
                                +{req.requested_count} Tiket
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}>
                              {req.status}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                            "{req.reason}"
                          </p>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                            <span>Diajukan: {req.created_at}</span>
                            {req.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => handleApproveQuotaRequest(req)}
                                disabled={grantingQuota}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer transition active:scale-95 disabled:opacity-50"
                              >
                                {grantingQuota ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                <span>Setujui (+{req.requested_count} Tiket)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleGrantExtraQuotaSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Pilih QA Evaluator Penerima:
                    </label>
                    <CustomSelect
                      value={extraQuotaTargetQa}
                      onChange={(e) => setExtraQuotaTargetQa(e.target.value)}
                      options={qaEvaluatorOptions.filter(o => o.value !== 'all')}
                      className="w-full"
                      buttonClassName="bg-white border-slate-300 py-2 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Jumlah Tambahan Tiket:
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[5, 10, 15, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setExtraQuotaCount(num)}
                          className={`py-1.5 rounded-lg font-mono font-bold text-xs border transition cursor-pointer ${extraQuotaCount === num
                            ? 'bg-[#0F2744] text-white border-[#0F2744]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          +{num} Tiket
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={extraQuotaCount}
                      onChange={(e) => setExtraQuotaCount(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                      placeholder="Atau ketik jumlah tiket..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Alasan Tambahan Kuota:
                    </label>
                    <textarea
                      value={extraQuotaReason}
                      onChange={(e) => setExtraQuotaReason(e.target.value)}
                      placeholder="Ketik alasan pemberian kuota sampling ekstra..."
                      rows={2}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowExtraQuotaModal(false)}
                      className="btn-secondary py-1.5 px-4 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={grantingQuota}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1.5 border border-amber-600"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{grantingQuota ? 'Memproses...' : `Beri +${extraQuotaCount} Tiket (Valid 24 Jam)`}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* 6. MODAL DISTRIBUSI HARIAN & KUSTOMISASI KOMPOSISI PER BULAN */}
      {showDailyDistModal && isSupervisor && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
                  <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Distribusi Sampling Harian ({dailyTotalPerQa} Tiket / QA)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kustomisasi komposisi kuota kategori tiket per QA • Periode <strong className="font-mono">{selectedMonth}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDailyDistModal(false)}
                disabled={distributingDaily}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleExecuteDailyDistribution} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Info Card Banner */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-blue-950 font-medium">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Komposisi kuota tiket dapat diatur bebas sesuai kebutuhan sampling setiap bulannya.</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetCompositionToDefault}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/50 text-blue-800 border border-blue-200 text-[11px] font-bold shrink-0 transition cursor-pointer shadow-2xs"
                  title="Kembalikan ke 6 Info, 7 Ggn, 6 Kel, 1 Perm (Total 20)"
                >
                  Reset Standar (20)
                </button>
              </div>

              {/* 4 Category Inputs Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Komposisi Kuota Tiket per Evaluator QA (Per Hari):
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Informasi */}
                  <div className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                        <strong className="text-xs font-bold text-slate-900">Informasi</strong>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Produk, tagihan, info</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepComposition('INFORMASI', -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={dailyComposition.INFORMASI}
                        onChange={(e) => handleCompositionChange('INFORMASI', e.target.value)}
                        className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border border-indigo-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepComposition('INFORMASI', 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 2. Gangguan */}
                  <div className="p-3 rounded-2xl border border-rose-200 bg-rose-50/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <strong className="text-xs font-bold text-slate-900">Gangguan</strong>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">LOS, lambat, teknis</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepComposition('GANGGUAN', -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={dailyComposition.GANGGUAN}
                        onChange={(e) => handleCompositionChange('GANGGUAN', e.target.value)}
                        className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border border-rose-300 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepComposition('GANGGUAN', 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 3. Keluhan */}
                  <div className="p-3 rounded-2xl border border-purple-200 bg-purple-50/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <strong className="text-xs font-bold text-slate-900">Keluhan</strong>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Komplain, SLA lambat</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepComposition('KELUHAN', -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={dailyComposition.KELUHAN}
                        onChange={(e) => handleCompositionChange('KELUHAN', e.target.value)}
                        className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border border-purple-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepComposition('KELUHAN', 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 4. Permohonan */}
                  <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <strong className="text-xs font-bold text-slate-900">Permohonan</strong>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Pasang baru, mutasi</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepComposition('PERMOHONAN', -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={dailyComposition.PERMOHONAN}
                        onChange={(e) => handleCompositionChange('PERMOHONAN', e.target.value)}
                        className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border border-emerald-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepComposition('PERMOHONAN', 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* QA Readiness Switcher Panel (Rule 2: Shift Lifecycle Tracking) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                    <label className="text-xs font-bold text-slate-900">
                      Kesiapan QA Bertugas ({dailyTargetDate}):
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {activeDutyCount} Ready (On Duty)
                    </span>
                    {(qaRosterData?.summary?.standby_qas_count ?? 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {qaRosterData.summary.standby_qas_count} Standby
                      </span>
                    )}
                    {(qaRosterData?.summary?.end_shift_qas_count ?? 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
                        {qaRosterData.summary.end_shift_qas_count} End Shift
                      </span>
                    )}
                  </div>
                </div>

                {/* 8 QA Mini Toggle Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(qaRosterData?.evaluators || []).map((evaluator) => {
                    const status = evaluator.today_status || 'STANDBY';
                    const isDuty = evaluator.today_is_ready && (status === 'ON_DUTY');
                    const isStandby = status === 'STANDBY';
                    const isEndShift = status === 'END_SHIFT';
                    const isToggling = togglingQaReadiness === evaluator.evaluator_name;

                    let statusLabel = '⚪ Off Day';
                    let labelClass = 'text-slate-400';
                    let buttonClass = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 opacity-70';

                    if (isDuty) {
                      statusLabel = '🟢 On Duty';
                      labelClass = 'text-emerald-700';
                      buttonClass = 'bg-emerald-50/90 border-emerald-300 text-emerald-950 ring-1 ring-emerald-500/20';
                    } else if (isStandby) {
                      statusLabel = '⏳ Standby';
                      labelClass = 'text-amber-700';
                      buttonClass = 'bg-amber-50/70 border-amber-300 text-amber-950 ring-1 ring-amber-500/20';
                    } else if (isEndShift) {
                      statusLabel = '🏁 End Shift';
                      labelClass = 'text-purple-700';
                      buttonClass = 'bg-purple-50/70 border-purple-300 text-purple-950 ring-1 ring-purple-500/20';
                    }

                    return (
                      <button
                        key={evaluator.evaluator_name}
                        type="button"
                        onClick={() => handleToggleQaReadiness(evaluator.evaluator_name, evaluator.today_status, dailyTargetDate)}
                        disabled={isToggling}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-1 shadow-2xs ${buttonClass}`}
                        title={`Klik untuk ubah status ${evaluator.evaluator_name}`}
                      >
                        <div className="min-w-0 pr-1">
                          <span className="text-[10px] font-bold block truncate">{evaluator.evaluator_name.split(' ')[0]}</span>
                          <span className={`text-[9px] font-semibold block ${labelClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        {isToggling ? (
                          <RefreshCw className="w-3 h-3 animate-spin shrink-0 text-slate-400" />
                        ) : isDuty ? (
                          <ToggleRight className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className={`p-2.5 rounded-xl text-[10.5px] leading-relaxed border ${activeDutyCount < (qaRosterData?.summary?.total_qa_evaluators || 8)
                  ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  }`}>
                  {activeDutyCount < (qaRosterData?.summary?.total_qa_evaluators || 8) ? (
                    <span>
                      💡 <strong>Logic JIT Aktif:</strong> Saat ini tiket HANYA dialokasikan ke <strong>{activeDutyCount} QA On Duty</strong> ({activeDutyCount} × {dailyTotalPerQa} = <strong>{dailyTotalSite} Tiket</strong>). QA yang berstatus Standby / Shift Siang <strong>tidak dipaksakan menerima tiket sekarang</strong>. Saat mereka bertugas dan On Duty di jam shift-nya, sistem otomatis mengalokasikan 20 tiket secara Just-In-Time.
                    </span>
                  ) : (
                    <span>
                      ✓ <strong>Seluruh QA On Duty ({activeDutyCount} Orang):</strong> Sebanyak <strong>{dailyTotalSite} Tiket</strong> akan dibagi rata ke semua evaluator ({dailyTotalPerQa} tiket/QA).
                    </span>
                  )}
                </div>
              </div>

              {/* Total Summary Row */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-500 text-[11px] block">Kalkulasi Alokasi Tiket Hari Ini:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-sm font-black text-slate-900 font-mono">
                      {dailyTotalPerQa} Tiket / QA
                    </strong>
                    <span className="text-slate-400">×</span>
                    <strong className="text-xs font-bold text-emerald-700 font-mono">
                      {activeDutyCount} QA On Duty
                    </strong>
                    <span className="text-slate-400">=</span>
                    <strong className="text-sm font-black text-blue-700 font-mono">
                      {dailyTotalSite} Tiket Site Hari Ini
                    </strong>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <span>Target Tanggal: <strong className="font-mono">{dailyTargetDate}</strong></span>
                </div>
              </div>

              {/* Target Date & Clear Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Target Tanggal Distribusi:
                  </label>
                  <input
                    type="date"
                    value={dailyTargetDate}
                    onChange={(e) => {
                      setDailyTargetDate(e.target.value);
                      fetchQaRoster(e.target.value);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-start gap-2 p-2 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer w-full hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={dailyClearExisting}
                      onChange={(e) => setDailyClearExisting(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 accent-blue-600"
                    />
                    <div className="text-[11px] leading-tight">
                      <strong className="text-slate-900 block font-semibold">Timpa Antrean Hari Ini</strong>
                      <span className="text-slate-500 text-[10px]">Bersihkan tiket ASSIGNED pada tanggal ini sebelum membagi.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Rolling 30 Days Rule Notice */}
              <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-2xl text-[10.5px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Aturan Distribusi Otomatis yang Diterapkan:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                  <li>Maksimal 2 kemunculan agent CSO per QA Evaluator dalam rolling 30 hari.</li>
                  <li>CSO yang sudah memenuhi target bulanan tidak akan dimasukkan kembali.</li>
                  <li>Anti-duplikasi ID Tiket per periode sampling.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDailyDistModal(false)}
                  disabled={distributingDaily}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={distributingDaily || dailyTotalPerQa <= 0}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
                >
                  {distributingDaily ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses Distribusi...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Jalankan Distribusi ({dailyTotalPerQa} Tiket/QA)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =================================================================== */}
      {/* MODAL UPLOAD BAD RATING / LOW CSAT (Revision Item 8)               */}
      {/* =================================================================== */}
      {showBadRatingModal && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="corp-card w-full max-w-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 bg-white shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 fill-rose-600 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Upload & Distribusi Data Bad Rating (Low CSAT)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Periode: <strong className="text-slate-800">{selectedMonth}</strong> • Distribusi Prioritas Tinggi ke Antrean QA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBadRatingModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Download & Column Guide Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11.5px] font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Format Acuan Template Excel:</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    Gunakan template standar dengan kolom: <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px] font-bold text-slate-800">User, Agent, Rating, Channel, Advice, Ticket Number, Date</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBadRatingTemplate}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template (.xlsx)</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[9.5px]">
                <span className="font-semibold text-slate-500">Struktur Kolom:</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">User</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Agent</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-rose-700">Rating (1-5)</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Channel</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Advice (Keluhan)</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-blue-700">Ticket Number</span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Date</span>
              </div>
            </div>

            <form onSubmit={handleUploadBadRatingSubmit} className="space-y-4 text-xs">
              {/* File Dropzone */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Pilih File Data Bad Rating:
                </label>
                <input
                  type="file"
                  ref={badRatingFileInputRef}
                  onChange={handleBadRatingFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <div
                  onClick={() => badRatingFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                    badRatingFile ? 'border-emerald-400 bg-emerald-50/20' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <Upload className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                  {badRatingFileName ? (
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 text-xs">{badRatingFileName}</p>
                      <p className="text-[10px] text-emerald-700 font-bold">✓ File terpilih dan siap dianalisis</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800 text-xs">Klik untuk memilih file Excel (.xlsx / .csv)</p>
                      <p className="text-[10px] text-slate-400">File akan otomatis dipetakan sesuai template DATA BADRATTING</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Stats Badges */}
              {badRatingStats.total > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase">Total Baris</span>
                    <strong className="text-sm font-black text-slate-800 font-mono">{badRatingStats.total}</strong>
                  </div>
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
                    <span className="text-[10px] text-rose-700 block font-semibold uppercase">Rating 1 - 2 (Bad)</span>
                    <strong className="text-sm font-black text-rose-700 font-mono">{badRatingStats.bad}</strong>
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <span className="text-[10px] text-amber-700 block font-semibold uppercase">Rating 3 (Neutral)</span>
                    <strong className="text-sm font-black text-amber-700 font-mono">{badRatingStats.neutral}</strong>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <span className="text-[10px] text-emerald-700 block font-semibold uppercase">Rating 4 - 5 (Good)</span>
                    <strong className="text-sm font-black text-emerald-700 font-mono">{badRatingStats.good}</strong>
                  </div>
                </div>
              )}

              {/* Import Options & Filtering */}
              {badRatingParsedRows.length > 0 && (
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="font-bold text-slate-800 text-[11px]">Opsi Impor &amp; Distribusi:</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${badRatingFilter === 'low_only' ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-slate-200'}`}>
                      <input
                        type="radio"
                        name="bad_rating_filter"
                        value="low_only"
                        checked={badRatingFilter === 'low_only'}
                        onChange={(e) => setBadRatingFilter(e.target.value)}
                        className="mt-0.5 text-rose-600 accent-rose-600"
                      />
                      <div className="text-[10.5px] leading-tight">
                        <strong className="text-slate-900 block font-bold">Hanya Bad Rating (Rating 1 - 3)</strong>
                        <span className="text-slate-500 text-[9.5px]">Filter otomatis hanya {badRatingStats.bad + badRatingStats.neutral} transaksi bermasalah (Rekomendasi QA).</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${badRatingFilter === 'all' ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200'}`}>
                      <input
                        type="radio"
                        name="bad_rating_filter"
                        value="all"
                        checked={badRatingFilter === 'all'}
                        onChange={(e) => setBadRatingFilter(e.target.value)}
                        className="mt-0.5 text-blue-600 accent-blue-600"
                      />
                      <div className="text-[10.5px] leading-tight">
                        <strong className="text-slate-900 block font-bold">Impor Semua ({badRatingStats.total} Baris)</strong>
                        <span className="text-slate-500 text-[9.5px]">Termasuk transaksi rating 4-5 yang ada di file.</span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={badRatingAutoDistribute}
                        onChange={(e) => setBadRatingAutoDistribute(e.target.checked)}
                        className="rounded text-rose-600 accent-rose-600"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">
                        Distribusikan otomatis secara seimbang ke antrean QA yang aktif/standby
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Rows */}
              {badRatingParsedRows.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700">Preview Data ({Math.min(5, badRatingParsedRows.length)} dari {badRatingParsedRows.length} baris):</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0">
                        <tr>
                          <th className="p-2 border-b border-slate-200">No. Tiket</th>
                          <th className="p-2 border-b border-slate-200">Pelanggan (User)</th>
                          <th className="p-2 border-b border-slate-200">Agent</th>
                          <th className="p-2 border-b border-slate-200 text-center">Rating</th>
                          <th className="p-2 border-b border-slate-200">Kanal</th>
                          <th className="p-2 border-b border-slate-200">Saran / Keluhan</th>
                          <th className="p-2 border-b border-slate-200">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {badRatingParsedRows.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            <td className="p-2 text-blue-700 font-mono font-bold">{row['Ticket Number']}</td>
                            <td className="p-2 text-slate-800 font-medium max-w-[120px] truncate">{row['User']}</td>
                            <td className="p-2 text-slate-900 font-semibold max-w-[140px] truncate">{row['Agent']}</td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                row.Rating <= 2 ? 'bg-rose-100 text-rose-700' : (row.Rating === 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')
                              }`}>
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>{row.Rating}</span>
                              </span>
                            </td>
                            <td className="p-2 text-slate-600">{row['Channel']}</td>
                            <td className="p-2 text-slate-600 max-w-[160px] truncate" title={row['Advice']}>{row['Advice'] || '-'}</td>
                            <td className="p-2 text-slate-500 font-mono text-[9px]">{row['Date']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBadRatingModal(false)}
                  className="btn-secondary py-2 px-4 text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={badRatingUploading || badRatingParsedRows.length === 0}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {badRatingUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengunggah & Mendistribusikan...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Upload & Distribusikan ({badRatingFilter === 'low_only' ? badRatingStats.bad + badRatingStats.neutral : badRatingStats.total} Tiket)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =================================================================== */}
      {/* MODAL SETTING TARGET KUOTA MINGGUAN W1-W5 (Revision Item 5)        */}
      {/* =================================================================== */}
      {showWeeklyTargetsModal && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="corp-card w-full max-w-lg p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 border border-purple-300 flex items-center justify-center flex-shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Setting Target Kuota Mingguan QA (W1 - W5)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Periode: <strong className="text-slate-800">{selectedMonth}</strong> • Target Bulanan: <strong className="text-slate-900 font-mono">370 Tiket / QA</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWeeklyTargetsModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWeeklyTargets} className="space-y-4 text-xs">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                <div className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                  <span>Fleksibilitas Target Per Week:</span>
                </div>
                <p className="text-[10px] text-purple-900 leading-relaxed">
                  Agar target tim sampling achieve (370/bulan), kuota per pekan (W1 s/d W5) dapat disesuaikan dengan jumlah hari kerja aktif, libur nasional, atau lonjakan volume transaksi.
                </p>
              </div>

              {/* W1 to W5 Inputs */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'w1', label: 'Week 1 (W1)' },
                  { key: 'w2', label: 'Week 2 (W2)' },
                  { key: 'w3', label: 'Week 3 (W3)' },
                  { key: 'w4', label: 'Week 4 (W4)' },
                  { key: 'w5', label: 'Week 5 (W5)' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1 text-center">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">
                      {key.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="370"
                      value={weeklyTargets[key] ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setWeeklyTargets(prev => ({ ...prev, [key]: val }));
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-black text-center text-slate-900 focus:bg-white focus:ring-1 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Total Calculation & Validation */}
              {(() => {
                const totalCalculated = (Number(weeklyTargets.w1) || 0) +
                  (Number(weeklyTargets.w2) || 0) +
                  (Number(weeklyTargets.w3) || 0) +
                  (Number(weeklyTargets.w4) || 0) +
                  (Number(weeklyTargets.w5) || 0);
                const isExact370 = totalCalculated === 370;

                return (
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    isExact370 ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {isExact370 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                      <span>Akumulasi Target W1-W5:</span>
                    </div>
                    <div className="font-mono text-sm">
                      <strong>{totalCalculated}</strong> / 370 Tiket
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowWeeklyTargetsModal(false)}
                  className="btn-secondary py-1.5 px-4 text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingWeeklyTargets}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingWeeklyTargets ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Target Mingguan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
