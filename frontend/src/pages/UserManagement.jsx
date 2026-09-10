import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  Zap,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  Search,
  RefreshCw,
  Key,
  Edit3,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  UserCheck2,
  Tag,
  HelpCircle,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import { CustomSelect } from '../components/common/CustomSelect';

export const UserManagement = () => {
  const { user } = useAuth();
  const { triggerDataUpdate } = useSync();
  const { showConfirm, showAlert, showToast } = useDialog();

  // Users List State
  const [usersList, setUsersList] = useState([]);
  const [userSummary, setUserSummary] = useState({
    total_users: 0,
    qa_count: 0,
    tl_count: 0,
    trainer_count: 0,
    agent_count: 0,
    supervisor_count: 0,
    active_count: 0,
    inactive_count: 0
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [filterUserRole, setFilterUserRole] = useState('all');
  const [filterUserStatus, setFilterUserStatus] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(15);

  // Modals & Action States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showResetPassModal, setShowResetPassModal] = useState(false);
  const [showSelectiveInjectModal, setShowSelectiveInjectModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [syncingUsers, setSyncingUsers] = useState(false);

  // NAKER Candidates for Selective Injection
  const [nakerCandidates, setNakerCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateSummary, setCandidateSummary] = useState({
    total_naker: 0,
    qa_count: 0,
    tl_count: 0,
    trainer_count: 0,
    cso_count: 0,
    no_account_count: 0,
    has_account_count: 0
  });
  const [searchCandidate, setSearchCandidate] = useState('');
  const [filterCandidateClass, setFilterCandidateClass] = useState('all'); // 'all', 'QA', 'TL', 'Trainer', 'CSO'
  const [filterCandidateAccount, setFilterCandidateAccount] = useState('all'); // 'all', 'no', 'yes'
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set());

  // Form States
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'quality_assurance',
    department: '',
    phone: '',
    password: '',
    status: 'active',
    employee_id: null
  });

  // 1. Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getUsers({
        search: searchUser || undefined,
        role: filterUserRole !== 'all' ? filterUserRole : undefined,
        status: filterUserStatus !== 'all' ? filterUserStatus : undefined,
        per_page: 'all'
      });
      if (res.success) {
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setUsersList(list);
        if (res.summary) setUserSummary(res.summary);
      }
    } catch (e) {
      console.error(e);
      setUsersList([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 2. Fetch NAKER Candidates
  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const res = await api.getNakerCandidates({
        search: searchCandidate || undefined,
        classification: filterCandidateClass !== 'all' ? filterCandidateClass : undefined,
        has_account: filterCandidateAccount !== 'all' ? filterCandidateAccount : undefined
      });
      if (res.success) {
        setNakerCandidates(res.candidates || []);
        if (res.summary) setCandidateSummary(res.summary);
      }
    } catch (e) {
      console.error(e);
      setNakerCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchUser, filterUserRole, filterUserStatus]);

  useEffect(() => {
    if (showSelectiveInjectModal || showAddUserModal) {
      fetchCandidates();
    }
  }, [showSelectiveInjectModal, showAddUserModal, searchCandidate, filterCandidateClass, filterCandidateAccount]);

  useEffect(() => {
    const handleSync = () => {
      fetchUsers();
      if (showSelectiveInjectModal) fetchCandidates();
    };
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [showSelectiveInjectModal]);

  // Pagination calculations for Users table
  const totalUserItems = usersList.length;
  const userPageSize = userPerPage === 'all' ? totalUserItems : (parseInt(userPerPage, 10) || 15);
  const totalUserPages = userPerPage === 'all' ? 1 : Math.max(1, Math.ceil(totalUserItems / (userPageSize || 1)));
  const validUserPage = Math.max(1, Math.min(userPage, totalUserPages));
  const paginatedUsersList = userPerPage === 'all'
    ? usersList
    : usersList.slice((validUserPage - 1) * userPageSize, validUserPage * userPageSize);

  const userStartIndex = totalUserItems === 0 ? 0 : (validUserPage - 1) * (userPerPage === 'all' ? totalUserItems : userPageSize) + 1;
  const userEndIndex = userPerPage === 'all' ? totalUserItems : Math.min(validUserPage * userPageSize, totalUserItems);

  // Selective candidate toggle helpers
  const toggleSelectCandidate = (empId) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const selectAllFilteredCandidates = () => {
    const allIds = nakerCandidates.map(c => c.employee_id);
    setSelectedEmployeeIds(new Set(allIds));
  };

  const selectOnlyUnregisteredCandidates = () => {
    const unregIds = nakerCandidates.filter(c => !c.has_account).map(c => c.employee_id);
    setSelectedEmployeeIds(new Set(unregIds));
  };

  const selectByClassification = (type) => {
    const ids = nakerCandidates.filter(c => c.classification === type).map(c => c.employee_id);
    setSelectedEmployeeIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedEmployeeIds(new Set());
  };

  // Execute Selective Injection
  const handleExecuteSelectiveInjection = async () => {
    if (selectedEmployeeIds.size === 0) {
      showAlert({
        title: 'Belum Ada Pegawai Terpilih',
        message: 'Silakan centang satu atau beberapa pegawai dari tabel Master NAKER untuk dibuatkan akun.',
        type: 'warning'
      });
      return;
    }

    setSyncingUsers(true);
    try {
      const res = await api.syncUsersFromNaker({
        employee_ids: Array.from(selectedEmployeeIds),
        include_cso: true
      });
      if (res.success) {
        showToast(`Berhasil menginjeksi & memperbarui ${selectedEmployeeIds.size} akun pengguna!`);
        setShowSelectiveInjectModal(false);
        setSelectedEmployeeIds(new Set());
        fetchUsers();
        triggerDataUpdate();
      } else {
        showAlert({
          title: 'Injeksi Akun Gagal',
          message: res.message || 'Terjadi kesalahan saat memproses akun.',
          type: 'error'
        });
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Injeksi Akun',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setSyncingUsers(false);
    }
  };

  // Add Manual / From NAKER User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.username || !userForm.email) {
      showAlert({
        title: 'Form Belum Lengkap',
        message: 'Mohon isi Nama Lengkap, Username / ID SIP, dan Email.',
        type: 'warning'
      });
      return;
    }

    try {
      const res = await api.createUser(userForm);
      if (res.success) {
        showToast(`Akun ${userForm.name} berhasil ditambahkan!`);
        setShowAddUserModal(false);
        setUserForm({
          name: '',
          username: '',
          email: '',
          role: 'quality_assurance',
          department: '',
          phone: '',
          password: '',
          status: 'active',
          employee_id: null
        });
        fetchUsers();
        triggerDataUpdate();
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Menambah Akun',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    }
  };

  // Autofill form when selecting from NAKER candidate in Manual Add
  const handleSelectNakerForManualAdd = (candidate) => {
    if (!candidate) return;
    setUserForm({
      name: candidate.name,
      username: candidate.proposed_username,
      email: candidate.proposed_email,
      role: candidate.role_code,
      department: candidate.department,
      phone: '',
      password: 'password',
      status: 'active',
      employee_id: candidate.employee_id
    });
    showToast(`Data tenaga kerja ${candidate.name} terpilih & otomatis diisikan.`);
  };

  // Update User
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await api.updateUser(selectedUser.id, userForm);
      if (res.success) {
        showToast(`Akun ${userForm.name} berhasil diperbarui!`);
        setShowEditUserModal(false);
        setSelectedUser(null);
        fetchUsers();
        triggerDataUpdate();
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Memperbarui Akun',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    }
  };

  // Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await api.resetUserPassword(selectedUser.id, newPasswordInput || null);
      if (res.success) {
        showToast(`Password untuk ${selectedUser.name} berhasil direset ke: ${res.new_password}`);
        setShowResetPassModal(false);
        setSelectedUser(null);
        setNewPasswordInput('');
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Reset Password',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    }
  };

  // Toggle User Status (Active / Inactive)
  const handleToggleUserStatus = async (userItem) => {
    try {
      const res = await api.toggleUserStatus(userItem.id);
      if (res.success) {
        showToast(`Status akun ${userItem.name} diubah menjadi ${res.status.toUpperCase()}`);
        fetchUsers();
        triggerDataUpdate();
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Mengubah Status',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    }
  };

  // Delete User
  const handleDeleteUser = async (userItem) => {
    const ok = await showConfirm({
      title: 'Hapus Akun Pengguna',
      message: `Apakah Anda yakin ingin menghapus akun ${userItem.name} (${userItem.username})?\n\nPengguna tidak akan dapat login lagi ke sistem.`,
      type: 'danger',
      confirmText: 'Ya, Hapus Akun'
    });
    if (!ok) return;

    try {
      const res = await api.deleteUser(userItem.id);
      if (res.success) {
        showToast(`Akun ${userItem.name} berhasil dihapus.`);
        fetchUsers();
        triggerDataUpdate();
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Menghapus Akun',
        message: err.response?.data?.message || err.message,
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. CORPORATE HEADER BANNER */}
      <div className="corp-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#0F2744] text-white text-[10px] font-black uppercase tracking-wider">
              <Users className="w-3 h-3 text-white" />
              Kelola Akun Pengguna
            </span>
            <span className="text-slate-300 font-bold hidden sm:inline">•</span>
            <span className="text-xs font-bold text-slate-600 hidden sm:inline">
              Injeksi Akun Master NAKER
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
            Pusat Manajemen Akun & Hak Akses Pengguna
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Injeksi akun otomatis dari data master NAKER untuk <strong>Middle Management QA</strong> (kuota 370 evaluasi), <strong>Team Leader (TL)</strong>, <strong>Trainer</strong>, dan <strong>CSO Agent</strong>.
          </p>
        </div>

        {/* Corporate Header Action Buttons: Single Clean Inline Row */}
        <div className="flex items-center gap-2 flex-nowrap self-start md:self-auto flex-shrink-0">
          <button
            onClick={() => {
              setSelectedEmployeeIds(new Set());
              setShowSelectiveInjectModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs whitespace-nowrap shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Injeksi Akun dari NAKER</span>
          </button>

          <button
            onClick={() => {
              setUserForm({
                name: '',
                username: '',
                email: '',
                role: 'quality_assurance',
                department: 'Middle Management Quality Assurance',
                phone: '',
                password: '',
                status: 'active',
                employee_id: null
              });
              setShowAddUserModal(true);
            }}
            className="btn-secondary py-2 px-3 text-xs whitespace-nowrap shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-700" />
            <span>Tambah Manual</span>
          </button>

          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs active:scale-95 flex-shrink-0"
            title="Segarkan Data Akun"
          >
            <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin text-[#0F2744]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. CORPORATE SUMMARY KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Akun */}
        <div className="corp-card p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Akun</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {userSummary.total_users || usersList.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">Pengguna Terdaftar</div>
          </div>
        </div>

        {/* QA Evaluator */}
        <div className="corp-card p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">QA Evaluator</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[#0F2744]">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#0F2744] tracking-tight leading-none">
              {userSummary.qa_count || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">Middle Mgmt QA</div>
          </div>
        </div>

        {/* Team Leader */}
        <div className="corp-card p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Team Leader</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {userSummary.tl_count || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">Team Leader (TL)</div>
          </div>
        </div>

        {/* Trainer */}
        <div className="corp-card p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trainer</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {userSummary.trainer_count || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">Trainer Coaching</div>
          </div>
        </div>

        {/* CSO Agent */}
        <div className="corp-card p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CSO Agent</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {userSummary.agent_count || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">Agent Pelayanan</div>
          </div>
        </div>

        {/* Supervisor */}
        <div className="corp-card p-4 flex flex-col justify-between hover:border-slate-300 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Supervisor</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {userSummary.supervisor_count || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">Admin & Supervisor</div>
          </div>
        </div>
      </div>

      {/* 3. CORPORATE TABLE CONTAINER */}
      <div className="corp-card overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200/90 bg-white flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Cari nama, SIP ID, email, atau divisi..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] shadow-2xs transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <CustomSelect
              value={filterUserRole}
              onChange={(e) => setFilterUserRole(e.target.value)}
              options={[
                { value: 'all', label: 'Semua Role Pengguna' },
                { value: 'quality_assurance', label: 'Quality Assurance (QA)' },
                { value: 'team_leader', label: 'Team Leader (TL)' },
                { value: 'trainer', label: 'Trainer Operasional' },
                { value: 'agent', label: 'CSO Agent' },
                { value: 'supervisor', label: 'Supervisor / Admin' }
              ]}
              className="w-full sm:w-56"
              buttonClassName="bg-white border-slate-300 py-2 text-slate-800 text-xs shadow-2xs font-semibold"
            />

            <CustomSelect
              value={filterUserStatus}
              onChange={(e) => setFilterUserStatus(e.target.value)}
              options={[
                { value: 'all', label: 'Semua Status' },
                { value: 'active', label: 'Status Aktif' },
                { value: 'inactive', label: 'Status Nonaktif' }
              ]}
              className="w-full sm:w-36"
              buttonClassName="bg-white border-slate-300 py-2 text-slate-800 text-xs shadow-2xs"
            />

            <button
              type="button"
              onClick={fetchUsers}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs"
              title="Segarkan data pengguna"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin text-[#0F2744]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead className="bg-slate-50/80 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center text-slate-500">#</th>
                <th className="py-3 px-4">Pengguna / Nama Lengkap</th>
                <th className="py-3 px-4">Username (SIP ID)</th>
                <th className="py-3 px-4">Email Akun</th>
                <th className="py-3 px-4">Role Sistem</th>
                <th className="py-3 px-4">Divisi / Penugasan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingUsers ? (
                <tr>
                  <td colSpan="8" className="py-14 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0F2744]" />
                    <span className="font-medium text-xs">Memuat data akun pengguna sistem...</span>
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-14 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">Belum Ada Akun Terdaftar</p>
                      <p className="text-xs text-slate-500">
                        Pilih pegawai dari Master NAKER untuk langsung dibuatkan akun login sistem.
                      </p>
                      <button
                        onClick={() => {
                          setSelectedEmployeeIds(new Set());
                          setShowSelectiveInjectModal(true);
                        }}
                        className="btn-primary mt-1 text-xs py-2 px-5 shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5" /> Pilih & Injeksi dari Data NAKER
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsersList.map((u, index) => {
                  const rowNum = (validUserPage - 1) * (userPerPage === 'all' ? 0 : (parseInt(userPerPage, 10) || 15)) + index + 1;
                  const isQa = u.role === 'quality_assurance';
                  const isTl = u.role === 'team_leader';
                  const isTrainer = u.role === 'trainer';
                  const isSupervisor = u.role === 'supervisor' || u.role === 'admin' || u.role === 'superadmin';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] text-center">{rowNum}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                            isSupervisor ? 'bg-[#0F2744]' :
                            isQa ? 'bg-blue-800' :
                            isTl ? 'bg-slate-700' :
                            isTrainer ? 'bg-slate-600' : 'bg-slate-500'
                          }`}>
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">{u.name}</span>
                            <span className="text-[10px] text-slate-500 block truncate">{u.phone || 'Tanpa no. HP'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-800">
                        {u.username}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">
                        {isSupervisor ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0F2744] text-white inline-flex items-center gap-1 shadow-2xs">
                            <ShieldCheck className="w-3 h-3 text-white" /> Supervisor / Admin
                          </span>
                        ) : isQa ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200 inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#0F2744]" /> Quality Assurance
                          </span>
                        ) : isTl ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-600" /> Team Leader (TL)
                          </span>
                        ) : isTrainer ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 inline-flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-600" /> Trainer Coaching
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-slate-500" /> CSO Agent
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="text-[11px] font-medium">{u.department || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition active:scale-95 ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                          }`}
                          title="Klik untuk mengubah status aktif/nonaktif"
                        >
                          {u.status === 'active' ? 'AKTIF' : 'NONAKTIF'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setNewPasswordInput('');
                              setShowResetPassModal(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                            title="Reset Password Akun"
                          >
                            <Key className="w-3.5 h-3.5 text-slate-600" />
                          </button>

                          {/* Edit Akun */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setUserForm({
                                name: u.name,
                                username: u.username,
                                email: u.email,
                                role: u.role,
                                department: u.department || '',
                                phone: u.phone || '',
                                password: '',
                                status: u.status || 'active',
                                employee_id: u.employee_id
                              });
                              setShowEditUserModal(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                            title="Edit Data Akun"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                          </button>

                          {/* Hapus Akun */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-700 transition shadow-2xs"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination */}
        {totalUserItems > 0 && (
          <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">
                Menampilkan <strong className="text-slate-800">{userStartIndex} - {userEndIndex}</strong> dari <strong className="text-slate-800">{totalUserItems}</strong> akun
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px] font-medium">Baris:</span>
                <div className="relative inline-flex items-center">
                  <select
                    value={String(userPerPage)}
                    onChange={(e) => {
                      setUserPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setUserPage(1);
                    }}
                    className="appearance-none bg-white border border-slate-300 hover:border-slate-400 rounded-lg pl-2.5 pr-7 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer shadow-2xs transition"
                  >
                    <option value="15">15 / hal</option>
                    <option value="25">25 / hal</option>
                    <option value="50">50 / hal</option>
                    <option value="100">100 / hal</option>
                    <option value="all">Semua</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
                </div>
              </div>
            </div>

            {totalUserPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={validUserPage <= 1}
                  onClick={() => setUserPage(1)}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition shadow-2xs"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={validUserPage <= 1}
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition flex items-center gap-1 shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>

                <div className="flex items-center gap-1 px-0.5">
                  {Array.from({ length: Math.min(5, totalUserPages) }, (_, i) => {
                    let pageNum;
                    if (totalUserPages <= 5) {
                      pageNum = i + 1;
                    } else if (validUserPage <= 3) {
                      pageNum = i + 1;
                    } else if (validUserPage >= totalUserPages - 2) {
                      pageNum = totalUserPages - 4 + i;
                    } else {
                      pageNum = validUserPage - 2 + i;
                    }
                    const isActive = validUserPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setUserPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                          isActive
                            ? 'bg-[#0F2744] text-white shadow-xs'
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
                  disabled={validUserPage >= totalUserPages}
                  onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition flex items-center gap-1 shadow-2xs"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={validUserPage >= totalUserPages}
                  onClick={() => setUserPage(totalUserPages)}
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

      {/* =================================================================== */}
      {/* MODAL 1: SELECTIVE NAKER INJECTION (INTERACTIVE CANDIDATE PICKER)    */}
      {/* =================================================================== */}
      {showSelectiveInjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#0F2744] text-white uppercase tracking-wider">
                    Injeksi Akun
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Pilih Data Tenaga Kerja dari Master NAKER
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Centang data tenaga kerja yang ingin dibuatkan akun login sistem, atau gunakan filter cepat di bawah.
                </p>
              </div>
              <button
                onClick={() => setShowSelectiveInjectModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Filter & Search Bar */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchCandidate}
                    onChange={(e) => setSearchCandidate(e.target.value)}
                    placeholder="Cari nama, ID SIP, atau layanan..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0F2744]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <CustomSelect
                    value={filterCandidateClass}
                    onChange={(e) => setFilterCandidateClass(e.target.value)}
                    options={[
                      { value: 'all', label: 'Semua Klasifikasi' },
                      { value: 'QA', label: `QA Evaluator (${candidateSummary.qa_count})` },
                      { value: 'TL', label: `Team Leader (${candidateSummary.tl_count})` },
                      { value: 'Trainer', label: `Trainer (${candidateSummary.trainer_count})` },
                      { value: 'CSO', label: `CSO Agent (${candidateSummary.cso_count})` },
                    ]}
                    className="w-full sm:w-44"
                    buttonClassName="bg-white border-slate-300 py-1.5 text-xs text-slate-800"
                  />

                  <CustomSelect
                    value={filterCandidateAccount}
                    onChange={(e) => setFilterCandidateAccount(e.target.value)}
                    options={[
                      { value: 'all', label: 'Semua Status Akun' },
                      { value: 'no', label: `Belum Ada Akun (${candidateSummary.no_account_count})` },
                      { value: 'yes', label: `Sudah Terdaftar (${candidateSummary.has_account_count})` },
                    ]}
                    className="w-full sm:w-44"
                    buttonClassName="bg-white border-slate-300 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Quick Selection Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-slate-600 text-[11px] mr-1">Pilih Cepat:</span>
                  <button
                    type="button"
                    onClick={() => selectByClassification('QA')}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 hover:text-[#0F2744] hover:border-blue-300 border border-slate-300 font-bold text-[11px] text-slate-700 transition shadow-2xs"
                  >
                    ⭐ Seluruh QA ({candidateSummary.qa_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => selectByClassification('TL')}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 font-bold text-[11px] text-slate-700 transition shadow-2xs"
                  >
                    👥 Seluruh TL ({candidateSummary.tl_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => selectByClassification('Trainer')}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 font-bold text-[11px] text-slate-700 transition shadow-2xs"
                  >
                    🎓 Seluruh Trainer ({candidateSummary.trainer_count})
                  </button>
                  <button
                    type="button"
                    onClick={selectOnlyUnregisteredCandidates}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] transition shadow-2xs"
                  >
                    ⚡ Yang Belum Ada Akun ({candidateSummary.no_account_count})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFilteredCandidates}
                    className="text-[#0F2744] hover:underline font-bold text-[11px]"
                  >
                    Pilih Semua ({nakerCandidates.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-slate-500 hover:text-rose-600 hover:underline font-medium text-[11px]"
                  >
                    Batal Pilih
                  </button>
                </div>
              </div>
            </div>

            {/* Candidates Table (Scrollable) */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={nakerCandidates.length > 0 && selectedEmployeeIds.size === nakerCandidates.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllFilteredCandidates();
                          } else {
                            clearSelection();
                          }
                        }}
                        className="w-4 h-4 rounded text-[#0F2744] border-slate-300 focus:ring-[#0F2744]"
                      />
                    </th>
                    <th className="py-2.5 px-3">Nama Tenaga Kerja</th>
                    <th className="py-2.5 px-3">ID SIP</th>
                    <th className="py-2.5 px-3">Klasifikasi Jabatan</th>
                    <th className="py-2.5 px-3">Layanan Penugasan</th>
                    <th className="py-2.5 px-3">Proposed Username</th>
                    <th className="py-2.5 px-3 text-center">Status Akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCandidates ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#0F2744]" />
                        <span>Memuat data master NAKER...</span>
                      </td>
                    </tr>
                  ) : nakerCandidates.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-slate-500">
                        Tidak ada data tenaga kerja NAKER yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    nakerCandidates.map((cand) => {
                      const isSelected = selectedEmployeeIds.has(cand.employee_id);
                      return (
                        <tr
                          key={cand.employee_id}
                          onClick={() => toggleSelectCandidate(cand.employee_id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCandidate(cand.employee_id)}
                              className="w-4 h-4 rounded text-[#0F2744] border-slate-300 focus:ring-[#0F2744]"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {cand.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-700">
                            {cand.sip_id}
                          </td>
                          <td className="py-2.5 px-3">
                            {cand.classification === 'QA' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200">
                                Quality Assurance
                              </span>
                            ) : cand.classification === 'TL' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                                Team Leader (TL)
                              </span>
                            ) : cand.classification === 'Trainer' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                                Trainer
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                                CSO Agent
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {cand.service_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                            {cand.proposed_username}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {cand.has_account ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Sudah Aktif
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Belum Ada Akun
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

            {/* Bottom Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">
                  Terpilih: <strong className="text-[#0F2744] text-sm">{selectedEmployeeIds.size}</strong> Pegawai
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 text-[11px]">
                  Password bawaan: <code className="font-bold">password</code>
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowSelectiveInjectModal(false)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={syncingUsers || selectedEmployeeIds.size === 0}
                  onClick={handleExecuteSelectiveInjection}
                  className="btn-primary py-2 px-5 text-xs shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  {syncingUsers ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Membuat Akun...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Injeksi {selectedEmployeeIds.size} Akun Terpilih</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: TAMBAH AKUN MANUAL DENGAN PILIHAN DARI DATA MASTER NAKER  */}
      {/* =================================================================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#0F2744] flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Tambah Akun Pengguna Baru</h3>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Picker from Master NAKER */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#0F2744]" />
                Pilih dari Data Tenaga Kerja Master NAKER (Auto-Fill):
              </label>
              <CustomSelect
                value=""
                onChange={(e) => {
                  const emp = nakerCandidates.find(c => String(c.employee_id) === e.target.value);
                  if (emp) handleSelectNakerForManualAdd(emp);
                }}
                options={[
                  { value: '', label: '-- Pilih Pegawai Master NAKER untuk Mengisi Otomatis --' },
                  ...nakerCandidates.map(c => ({
                    value: String(c.employee_id),
                    label: `${c.name} (${c.sip_id}) - ${c.classification} [${c.service_name}]`
                  }))
                ]}
                className="w-full"
                buttonClassName="bg-white border-slate-300 py-1.5 text-xs text-slate-800"
              />
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Misal: REZA ADITYA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Username / ID SIP *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="Misal: qa.reza atau SIP092"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Akun *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="reza@digiqa.id"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role Akun *</label>
                  <CustomSelect
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    options={[
                      { value: 'quality_assurance', label: 'Quality Assurance (QA)' },
                      { value: 'team_leader', label: 'Team Leader (TL)' },
                      { value: 'trainer', label: 'Trainer Operasional' },
                      { value: 'agent', label: 'CSO Agent' },
                      { value: 'supervisor', label: 'Supervisor / Admin' }
                    ]}
                    className="w-full"
                    buttonClassName="bg-white border-slate-300 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Divisi / Departemen</label>
                  <input
                    type="text"
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    placeholder="Misal: Middle Management QA"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Password Awal (Opsional)</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Default: password"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Akun</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT AKUN PENGGUNA */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#0F2744] flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Akun Pengguna</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setSelectedUser(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Username / ID SIP *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Akun *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role Akun *</label>
                  <CustomSelect
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    options={[
                      { value: 'quality_assurance', label: 'Quality Assurance (QA)' },
                      { value: 'team_leader', label: 'Team Leader (TL)' },
                      { value: 'trainer', label: 'Trainer Operasional' },
                      { value: 'agent', label: 'CSO Agent' },
                      { value: 'supervisor', label: 'Supervisor / Admin' }
                    ]}
                    className="w-full"
                    buttonClassName="bg-white border-slate-300 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Divisi / Departemen</label>
                  <input
                    type="text"
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Password Baru (Kosongkan jika tidak ubah)</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Kosongkan jika tetap"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status Akun</label>
                  <CustomSelect
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                    options={[
                      { value: 'active', label: 'Aktif (Dapat Login)' },
                      { value: 'inactive', label: 'Nonaktif (Dibekukan)' }
                    ]}
                    className="w-full"
                    buttonClassName="bg-white border-slate-300 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setSelectedUser(null);
                  }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Perbarui Akun</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RESET PASSWORD */}
      {showResetPassModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#0F2744] flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Reset Password Pengguna</h3>
              </div>
              <button
                onClick={() => {
                  setShowResetPassModal(false);
                  setSelectedUser(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <p className="text-slate-600">
                Atur ulang kata sandi untuk akun <strong className="text-slate-900">{selectedUser.name}</strong> ({selectedUser.username}).
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password Baru (Opsional)</label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Kosongkan untuk mereset ke default: password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-[#0F2744] focus:border-[#0F2744] focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Jika dikosongkan, password otomatis disetel menjadi: <code className="font-bold text-slate-800">password</code>
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassModal(false);
                    setSelectedUser(null);
                  }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
