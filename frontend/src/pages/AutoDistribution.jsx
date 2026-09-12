import React, { useState, useEffect, useRef } from 'react';
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
  ChevronsRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { CustomSelect } from '../components/common/CustomSelect';

export const AutoDistribution = () => {
  const { user } = useAuth();
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

  // Import State in Modul 7
  const [importModalOpen, setImportModalOpen] = useState(false);
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
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

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

  const dailyTotalPerQa = (Number(dailyComposition.INFORMASI) || 0) + 
                          (Number(dailyComposition.GANGGUAN) || 0) + 
                          (Number(dailyComposition.KELUHAN) || 0) + 
                          (Number(dailyComposition.PERMOHONAN) || 0);
  const dailyTotalSite = dailyTotalPerQa * 8;

  const [showExtraQuotaModal, setShowExtraQuotaModal] = useState(false);
  const [extraQuotaActiveTab, setExtraQuotaActiveTab] = useState('requests'); // 'requests' | 'manual'
  const [extraQuotaTargetQa, setExtraQuotaTargetQa] = useState('ALMIRA PARAMITHA');
  const [extraQuotaCount, setExtraQuotaCount] = useState(10);
  const [extraQuotaReason, setExtraQuotaReason] = useState('Penambahan kuota sampling harian / mitigasi backlog');
  const [pendingQuotaRequests, setPendingQuotaRequests] = useState([]);
  const [loadingQuotaRequests, setLoadingQuotaRequests] = useState(false);
  const [grantingQuota, setGrantingQuota] = useState(false);

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
        showToast(res.message || 'Simulasi SLA berhasil dijalankan!');
        fetchMonitoringData(true);
        fetchBucketTickets(bucketPage, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menjalankan simulasi SLA', 'error');
      }
    } catch (e) {
      showToast('Gagal menjalankan simulasi SLA', 'error');
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
        showToast(res.message || `Tiket #${ticket.ticket_id} berhasil di-reopen.`);
        fetchMonitoringData(true);
        fetchBucketTickets(bucketPage, true);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal me-reopen tiket', 'error');
      }
    } catch (e) {
      showToast('Gagal me-reopen tiket', 'error');
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
        showToast(res.message || 'Auto Distribution 370 kuota berhasil dijalankan!');
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menjalankan auto-distribution', 'error');
      }
    } catch (e) {
      showToast('Gagal menjalankan auto-distribution', 'error');
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
        showToast(res.message || `Distribusi harian (${dailyTotalPerQa} tiket/QA) berhasil dijalankan!`);
        setShowDailyDistModal(false);
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menjalankan distribusi harian', 'error');
      }
    } catch (err) {
      showToast('Gagal menjalankan distribusi harian: ' + (err.response?.data?.message || err.message), 'error');
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
        showToast(`✓ Tambahan ${extraQuotaCount} tiket untuk ${extraQuotaTargetQa} berhasil diberikan (Batas Waktu: 24 Jam)!`);
        setShowExtraQuotaModal(false);
        fetchBucketTickets(1);
        fetchPendingQuotaRequests();
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal memberikan tambahan kuota', 'error');
      }
    } catch (e) {
      showToast('Gagal memberikan tambahan kuota', 'error');
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
        showToast(`✓ Permintaan kuota QA ${req.evaluator_name} (+${req.requested_count} tiket) telah disetujui (Valid 24 Jam)!`);
        fetchPendingQuotaRequests();
        fetchBucketTickets(1);
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menyetujui permintaan kuota', 'error');
      }
    } catch (e) {
      showToast('Gagal menyetujui permintaan kuota', 'error');
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
        showToast(res.message || 'Data antrean berhasil ditarik / dihapus.');
        setRecallModalOpen(false);
        setSelectedTicketIds([]);
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal menarik data antrean', 'error');
      }
    } catch (e) {
      showToast('Gagal menarik data antrean', 'error');
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
        showToast(res.message || `Berkas ${batch.file_name} berhasil di-rollback.`);
        fetchImportBatches();
        fetchBucketTickets(1);
        if (activeTab === 'target_breakdown') {
          fetchSiteSummary();
          fetchCsoTargets();
        }
        window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));
      } else {
        showToast(res?.message || 'Gagal me-rollback berkas', 'error');
      }
    } catch (e) {
      showToast('Gagal me-rollback berkas', 'error');
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
    if (lower.includes('socmed') || lower.includes('sosmed') || lower.includes('social') || lower.includes('instagram') || lower.includes('twitter') || lower.includes('facebook')) {
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
      if ('ID SIP' in r || 'ID_SIP' in r || 'TEAM TL' in r || ('NAMA' in r && 'JK' in r)) return 'NAKER';
      const ca = (r['CA'] || r['Layanan'] || r['Saluran'] || '').toString().toLowerCase();
      if (ca.includes('email outbound') || ca.includes('email outbond')) return 'Email Outbound';
      if (ca.includes('outbound call') || ca.includes('outbond call') || ca.includes('outbound')) return 'Outbound Call';
      if (ca.includes('email')) return 'Email';
      if (ca.includes('back office') || ca.includes('backoffice') || ca.includes('eskalasi') || ca.includes('bo')) return 'Back Office';
      if (ca.includes('digilive') || ca.includes('chat')) return 'Digilive';
      if (ca.includes('socmed') || ca.includes('sosmed')) return 'Socmed';
      if (ca.includes('inbound') || ca.includes('inbond') || ca.includes('voice') || ca.includes('call')) return 'Inbound';
    }

    return 'Auto';
  };

  const processExcelFile = (file) => {
    if (!file) return;

    setImportFile(file);
    setImportFileName(file.name);
    setImportFileSizeText(`${(file.size / 1024).toFixed(1)} KB`);
    setImportStatus({ type: '', message: '' });
    setPreviewLoading(true);

    const initialAuto = detectChannelFromFileName(file.name);
    if (initialAuto) {
      setDetectedChannel(initialAuto === 'Auto' ? 'Auto (Multi-Channel CRM)' : initialAuto);
      setSelectedChannel(initialAuto);
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        let wb;
        try {
          wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, raw: false });
        } catch (e1) {
          try {
            const text16 = new TextDecoder('utf-16le').decode(buffer);
            wb = XLSX.read(text16, { type: 'string', cellDates: true, raw: false });
          } catch (e2) {
            try {
              const text8 = new TextDecoder('utf-8').decode(buffer);
              wb = XLSX.read(text8, { type: 'string', cellDates: true, raw: false });
            } catch (e3) {
              const binary = new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '');
              wb = XLSX.read(binary, { type: 'binary', cellDates: true, raw: false });
            }
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

        // Priority 1: NAKER sheet PLOTTING
        if (wb.SheetNames.includes('PLOTTING')) {
          chosenSheet = 'PLOTTING';
          data = XLSX.utils.sheet_to_json(wb.Sheets['PLOTTING'], { defval: '', raw: false });
        }

        // Priority 2: Loop all sheets looking for QSF 3-row header or standard tables
        if (!data || data.length === 0) {
          for (const sName of wb.SheetNames) {
            const ws = wb.Sheets[sName];
            if (!ws) continue;

            const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
            if (!matrix || matrix.length < 2) continue;

            const isQsfTitleBanner = (row) => {
              if (!Array.isArray(row)) return false;
              const firstCell = String(row[0] || '').toLowerCase();
              return (firstCell.includes('report') || firstCell.includes('qsf') || firstCell.includes('periode')) &&
                     firstCell.length > 20;
            };

            const isQsfHeaderRow = (row) => {
              if (!Array.isArray(row)) return false;
              const cells = row.map(c => String(c || '').toLowerCase());
              const standardQsfCols = ['no','site','idca','id tiket','ca','layanan','agent','qa','fcr','attribute','score ca'];
              const found = standardQsfCols.filter(col => cells.some(c => c.trim() === col));
              return found.length >= 5;
            };

            let qsfHeaderRowIdx = -1;
            for (let r = 0; r < Math.min(matrix.length, 5); r++) {
              if (isQsfTitleBanner(matrix[r]) && r + 1 < matrix.length && isQsfHeaderRow(matrix[r + 1])) {
                qsfHeaderRowIdx = r + 1;
                break;
              }
              if (isQsfHeaderRow(matrix[r])) {
                qsfHeaderRowIdx = r;
                break;
              }
            }

            if (qsfHeaderRowIdx !== -1) {
              const colNameRow = matrix[qsfHeaderRowIdx];
              const paramCodeRow = matrix[qsfHeaderRowIdx + 1];
              const dataStartRow = qsfHeaderRowIdx + 2;

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

              const extracted = [];
              for (let r = dataStartRow; r < matrix.length; r++) {
                const row = matrix[r];
                if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

                const firstCell = String(row[0] || '').toLowerCase().trim();
                if (firstCell === 'no') continue;
                if (firstCell.includes('rata') || firstCell.includes('average') || firstCell.includes('total')) continue;
                if (firstCell.includes('report') || firstCell.includes('periode')) continue;
                const agentColIdx = finalHeaders.findIndex(h => h === 'Agent');
                const idcaColIdx  = finalHeaders.findIndex(h => h === 'IDCA');
                const agentVal = agentColIdx !== -1 ? String(row[agentColIdx] || '').trim() : '';
                const idcaVal  = idcaColIdx  !== -1 ? String(row[idcaColIdx]  || '').trim() : '';
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

            const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
            if (rows && rows.length > 0) {
              const keys = Object.keys(rows[0] || {});
              if (keys.length >= 2) {
                chosenSheet = sName;
                data = rows;
                break;
              }
            }
          }
        }

        if (!data || data.length === 0) {
          setImportStatus({
            type: 'error',
            message: 'File Excel kosong atau format kolom tidak dikenali. Pastikan file memiliki baris data dan judul kolom yang tepat.'
          });
          setParsedRows([]);
          setPreviewLoading(false);
          return;
        }

        const autoChannel = detectChannelFromFileName(file.name, data) || initialAuto || selectedChannel;
        const isAuto = autoChannel === 'Auto' || selectedChannel === 'Auto';
        setDetectedChannel(isAuto ? 'Auto (Multi-Channel CRM)' : autoChannel);
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

        if (previewRes?.success) {
          if (previewRes.service?.name && !isAuto && autoChannel !== 'Auto') {
            setSelectedChannel(previewRes.service.name);
            setDetectedChannel(previewRes.service.name);
          } else if (isAuto || autoChannel === 'Auto') {
            setSelectedChannel('Auto');
            setDetectedChannel('Auto (Multi-Channel CRM)');
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
        } else {
          setImportStatus({ type: 'error', message: previewRes?.message || 'Gagal memproses pratinjau audit.' });
        }
      } catch (err) {
        setImportStatus({ type: 'error', message: 'Gagal membaca format Excel: ' + (err.response?.data?.message || err.message) });
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processExcelFile(file);
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

  const submitImport = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      setImportStatus({ type: 'error', message: 'Pilih file Excel yang memiliki data valid terlebih dahulu.' });
      return;
    }

    setImporting(true);
    setImportStatus({ type: '', message: '' });

    // Batch size 200 baris per request: payload ringan (~300KB), respon cepat (<0.5s), anti-timeout
    const BATCH_SIZE = 200;
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
          statusText: `Menginjeksi Batch ${b + 1} dari ${totalChunks} (${currentChunk.length} baris data)...`
        });

        const payload = {
          import_type: isNaker ? 'NAKER' : 'QSF',
          profile_code: isNaker ? 'NAKER_AUGUST_2026' : undefined,
          rows: currentChunk,
          file_name: importFileName || importFile?.name || 'Import.xlsx',
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

        if (!res?.success) {
          throw new Error(res?.message || `Gagal pada Batch ${b + 1}`);
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
          statusText: isLast
            ? `Finalisasi auto-distribusi tiket sampling dan perataan beban QA...`
            : `Batch ${b + 1} selesai (${updatedProcessed}/${parsedRows.length} data)`
        });
      }

      setImportStatus({
        type: 'success',
        message: `Berhasil mengimpor ${parsedRows.length} baris data tiket! Auto-distribution otomatis diperbarui.`
      });

      showToast(`Import ${parsedRows.length} tiket berhasil & langsung didistribusikan!`);
      
      // Auto-Refresh Bucket & Site Target
      fetchBucketTickets(1);
      fetchSiteSummary();
      fetchCsoTargets();
      window.dispatchEvent(new CustomEvent('digiqa:data_refresh'));

      setTimeout(() => {
        setImportModalOpen(false);
        setImportFile(null);
        setParsedRows([]);
        setPreviewResult(null);
        setImportProgress(null);
        setImportStatus({ type: '', message: '' });
      }, 2000);

    } catch (err) {
      setImportStatus({
        type: 'error',
        message: 'Terjadi kesalahan pada proses import: ' + (err.response?.data?.message || err.message)
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportFileName('');
    setImportFileSizeText('');
    setSelectedChannel('Auto');
    setDetectedChannel('');
    setParsedRows([]);
    setPreviewResult(null);
    setImportProgress(null);
    setImportStatus({ type: '', message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -------------------------------------------------------------------------
  // Lifecycle Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Selalu sinkronkan summary monitoring & abandoned agar badge tab selalu realtime
    if (isSupervisor) {
      fetchMonitoringData(true);
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
    }
  }, [selectedMonth, activeTab, isSupervisor]);

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

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => {
      if (isSupervisor) {
        fetchMonitoringData(true);
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
      }
    };
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [selectedMonth, activeTab, bucketPage, isSupervisor]);

  // Evaluator List options for Dropdowns
  const qaEvaluatorOptions = [
    { value: 'all', label: 'Semua Evaluator QA' },
    { value: 'ALMIRA PARAMITHA', label: 'ALMIRA PARAMITHA' },
    { value: 'DEWI RIKA IRAWATI', label: 'DEWI RIKA IRAWATI' },
    { value: 'DHITA KHARISMA', label: 'DHITA KHARISMA' },
    { value: 'DIAN WAHYU WIBOWO', label: 'DIAN WAHYU WIBOWO' },
    { value: 'FINA ANDRIYANI', label: 'FINA ANDRIYANI' },
    { value: 'HANI DWI SURYO', label: 'HANI DWI SURYO' },
    { value: 'IIN SUGIARTI', label: 'IIN SUGIARTI' },
    { value: 'TIARA RAMADHANI', label: 'TIARA RAMADHANI' },
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
    <div className="w-full max-w-full overflow-x-hidden space-y-4 pb-8">

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
          <p className="text-xs text-slate-600 leading-relaxed">
            {isSupervisor && 'Mesin continuous sampling otomatis untuk file transaksi mentah CRM (Excel 62 kolom) dengan penyeimbangan beban kerja 2 sampel/CSO dan kuota harian merata.'}
            {isQA && 'Antrean penugasan evaluasi mutu harian yang telah terdistribusi secara seimbang. Kerjakan lembar penilaian mutu CA & FCR atau tandai skip.'}
            {isTL && `Pemantauan antrean dan progres sampling anggota tim under-team ${user?.team_leader_name ? `(${user.team_leader_name})` : ''} dari Master NAKER (Mode Read-Only).`}
          </p>
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

      {/* 2. Symmetrical 2-Panel Command Center (For Supervisor) */}
      {isSupervisor && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Panel 1: Manajemen Berkas CRM (Raw Data) */}
          <div className="corp-card p-4 flex flex-col justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0F2744] shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#0F2744]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Manajemen Berkas CRM</h3>
                  <p className="text-[11px] text-slate-500">File transaksi mentah CRM</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                Excel 62 Kolom
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
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
                onClick={handleDownloadRetailTemplate}
                className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                title="Download Template Excel Kosong 62 Kolom"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Template</span>
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
          <div className="corp-card p-4 flex flex-col justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Operasional Distribusi</h3>
                  <p className="text-[11px] text-slate-500">
                    {dailyComposition.INFORMASI} Info • {dailyComposition.GANGGUAN} Ggn • {dailyComposition.KELUHAN} Kel • {dailyComposition.PERMOHONAN} Perm
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0F2744] border border-blue-200">
                  {dailyTotalSite} Tiket / Hari
                </span>
                {(bucketData?.stats?.total_bucket || 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBucket}
                    className="p-1 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                    title="Reset Seluruh Antrean"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDailyDistModal(true)}
                disabled={distributingDaily}
                className="px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                title={`Kustomisasi & Jalankan Distribusi Harian (${dailyTotalPerQa} Tiket/QA: ${dailyComposition.INFORMASI} Info, ${dailyComposition.GANGGUAN} Ggn, ${dailyComposition.KELUHAN} Kel, ${dailyComposition.PERMOHONAN} Perm)`}
              >
                <Play className={`w-3.5 h-3.5 text-white fill-white ${distributingDaily ? 'animate-spin' : ''}`} />
                <span>{distributingDaily ? 'Membagi...' : `Distribusi (${dailyTotalPerQa}/QA)`}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fetchPendingQuotaRequests();
                  setShowExtraQuotaModal(true);
                }}
                className="px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer relative"
                title="Akses Tambah Tiket SPV (Batas Waktu 1 Hari)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>+ Kuota SPV</span>
                {pendingQuotaRequests.filter(r => r.status === 'PENDING').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                )}
              </button>

              <button
                type="button"
                onClick={handleRunAutoDistribution}
                disabled={distributing}
                className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                title="Auto Distribusi Penuh (Target 370)"
              >
                <Zap className={`w-3.5 h-3.5 text-slate-500 ${distributing ? 'animate-bounce' : ''}`} />
                <span>Distribusi Penuh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sleek Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 pt-2 rounded-t-xl overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('qa_bucket')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'qa_bucket'
              ? 'border-[#0F2744] text-[#0F2744]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Antrean Kerja QA</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
            activeTab === 'qa_bucket'
              ? 'bg-blue-50 text-[#0F2744] border border-blue-200'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {bucketData?.pagination?.total || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('target_breakdown')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'target_breakdown'
              ? 'border-[#0F2744] text-[#0F2744]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Target Site & CSO</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
            activeTab === 'target_breakdown'
              ? 'bg-blue-50 text-[#0F2744] border border-blue-200'
              : 'bg-slate-100 text-slate-600'
          }`}>
            5.920
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reassign_logs')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'reassign_logs'
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
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'audit_abandoned'
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

          {/* Compact Enterprise KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
              <div className="px-2 py-1">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Target Bulanan</span>
                <span className="text-base font-bold text-slate-900 font-mono">{bucketData?.stats?.target_quota || 370}</span>
                <span className="text-[10px] text-slate-400 block">{selectedBucketQa === 'all' ? 'Site (2.960)' : 'Sesi/QA'}</span>
              </div>
              <div className="px-2 py-1 bg-indigo-50/30">
                <span className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider block">Kuota Harian</span>
                <span className="text-base font-bold text-indigo-950 font-mono">{bucketData?.stats?.daily_target || (selectedBucketQa === 'all' ? 160 : 20)}</span>
                <span className="text-[10px] text-indigo-600 block">Masuk: {bucketData?.stats?.today_assigned || 0} Tiket</span>
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
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isCompleted
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.sample_type === 'MANDATORY'
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isCompleted
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
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                              isActive
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              achievementPct >= 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {achievementPct}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-slate-800">
                            {avgCaText}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              statusText === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
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
          <div className="corp-card p-4 sm:p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-[#0F2744] text-white rounded-2xl border border-rose-900/40 shadow-md">
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

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSimulateExpireStale}
                  disabled={simulatingAbandon}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
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
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
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
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                        hasAbandon
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
      {/* MODALS - OPTIMIZED FOR ANDROID WEBVIEW / MOBILE TOUCH */}
      {/* =================================================================== */}

      {/* 1. Modal Import Excel Berkas Tiket */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Setor Tarikan Tiket Harian CRM Retail
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Format: ListTicketingRetail (Excel 62 Kolom) / Tarikan CRM Harian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="text-slate-700 font-medium">
                    Mendukung berkas <strong>ListTicketingRetail (62 Kolom CRM)</strong> & format QSF.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadRetailTemplate}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template 62 Kolom</span>
                </button>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
                    : importFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onClick={(e) => { e.target.value = null; }}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {importFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-emerald-100 text-emerald-700">
                      <FileCheck2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-slate-900">{importFileName}</p>
                      <p className="text-[11px] text-slate-500">{importFileSizeText} • {parsedRows.length} baris terdeteksi</p>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full mt-1">
                      Klik untuk mengganti berkas
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                      <Upload className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-slate-800">
                        Pilih berkas Excel tarikan tiket atau <span className="text-emerald-700 underline">Cari Berkas</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Mendukung format .xlsx, .xls, dan .csv (ListTicketingRetail)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Channel and Mode Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Saluran Pelayanan (Channel Routing):
                    </label>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ⚡ Rekomendasi: Auto
                    </span>
                  </div>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none transition shadow-xs cursor-pointer"
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
                  <p className="text-[10.5px] leading-tight text-slate-500">
                    {selectedChannel === 'Auto' ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ <strong>Mode Auto:</strong> Mengambil & membagi seluruh tiket CRM lintas saluran (Inbound, Chat, Socmed, Email, BO) otomatis per baris data.
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        ⚠️ <strong>Manual Override:</strong> Seluruh baris tiket akan dipaksa masuk ke saluran <strong>{selectedChannel}</strong>.
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
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
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    {importMode === 'upsert'
                      ? 'Memperbarui data jika ID Tiket/IDCA sudah ada, atau menambah baru jika belum ada.'
                      : 'Menambahkan semua baris tiket sebagai data baru.'}
                  </p>
                </div>
              </div>

              {/* Preview Section */}
              {previewLoading ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Membaca dan memvalidasi sampel berkas...</span>
                </div>
              ) : parsedRows.length > 0 ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800">
                      Pratinjau ({parsedRows.length} baris siap diimpor):
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                      Target: 370 Sesi
                    </span>
                  </div>
                  <div className="max-h-32 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 font-bold">
                        <tr>
                          {Object.keys(parsedRows[0] || {}).slice(0, 5).map((col) => (
                            <th key={col} className="p-1.5 whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.slice(0, 3).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {Object.keys(row).slice(0, 5).map((col) => (
                              <td key={col} className="p-1.5 whitespace-nowrap text-slate-700 font-mono">
                                {String(row[col] || '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Progress Bar during Batch Ingestion */}
              {importing && importProgress && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Injeksi Batch ({importProgress.currentBatch}/{importProgress.totalBatches})</span>
                    </span>
                    <span className="text-emerald-400 font-mono">{importProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress.percent}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {importProgress.statusText}
                  </p>
                </div>
              )}

              {/* Status Alert */}
              {importStatus.message && (
                <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
                  importStatus.type === 'error'
                    ? 'bg-rose-50 text-rose-900 border-rose-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}>
                  {importStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>

            {/* Modal Actions (Sticky Footer) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={submitImport}
                disabled={importing || parsedRows.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Injeksi...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4" />
                    <span>Mulai Impor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Selesaikan Penilaian (Complete Modal) */}
      {actionModal?.type === 'complete' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      completeForm.fcr === 'YA'
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
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      completeForm.fcr === 'TIDAK'
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
        </div>
      )}

      {/* 3. Modal Skip Tiket */}
      {actionModal?.type === 'skip' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      skipReason === reason
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
        </div>
      )}

      {/* 4. Modal Reassign Tiket */}
      {actionModal?.type === 'reassign' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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
        </div>
      )}

      {/* 5. Modal Penarikan & Rollback Data (Recall & Rollback Modal - Supervisor Only) */}
      {recallModalOpen && isSupervisor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  recallActiveTab === 'recall_queue'
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
                className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  recallActiveTab === 'import_batches'
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
                        className={`block p-3 rounded-2xl border transition cursor-pointer ${
                          recallMode === 'assigned_only'
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
                        className={`block p-3 rounded-2xl border transition cursor-pointer ${
                          recallMode === 'all_sampling'
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
                        className={`block p-3 rounded-2xl border transition cursor-pointer ${
                          recallMode === 'wipe_imported_data'
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
        </div>
      )}

      {/* 5. MODAL TAMBAH TIKET SPV (RULE 1 & RULE 3: BATAS WAKTU 1 HARI) */}
      {showExtraQuotaModal && isSupervisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  extraQuotaActiveTab === 'requests'
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
                className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  extraQuotaActiveTab === 'manual'
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === 'APPROVED'
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
                          className={`py-1.5 rounded-lg font-mono font-bold text-xs border transition cursor-pointer ${
                            extraQuotaCount === num
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
        </div>
      )}
      {/* 6. MODAL DISTRIBUSI HARIAN & KUSTOMISASI KOMPOSISI PER BULAN */}
      {showDailyDistModal && isSupervisor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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

              {/* Total Summary Row */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-500 text-[11px] block">Total Kuota Per Hari:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-black text-slate-900 font-mono">
                      {dailyTotalPerQa} Tiket / QA
                    </strong>
                    <span className="text-slate-400">•</span>
                    <strong className="text-xs font-bold text-blue-700 font-mono">
                      {dailyTotalSite} Tiket Site (8 QA)
                    </strong>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <span>Tersimpan otomatis per periode <strong>{selectedMonth}</strong></span>
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
                    onChange={(e) => setDailyTargetDate(e.target.value)}
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
        </div>
      )}
    </div>
  );
};
