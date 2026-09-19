import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Paperclip,
  Eye,
  Trash2,
  Calendar,
  Tag,
  X,
  Download,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Phone,
  MessageCircle,
  Instagram,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  FileText,
  Clock,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';

export const PolicyRepository = () => {
  const { triggerDataUpdate } = useSync();
  const { showConfirm, showAlert, showToast } = useDialog();
  
  const [policies, setPolicies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & Navigation
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // Modals & Popups
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form State (QA Manual Input - Free Text Category)
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    target_channel: 'UNTUK SEMUA',
    discussion_date: new Date().toISOString().split('T')[0],
    summary: '',
    details: '',
    attachment_name: '', // Kode Berkas Lampiran
    status: 'active',
    author: 'Tim QA Operasional'
  });

  const formatDateIndonesian = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${day} ${monthNames[month - 1] || parts[1]} ${year}`;
  };

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await api.getPolicyDiscussions({
        status: statusFilter,
        category: selectedCategory,
        search
      });
      if (res.success) {
        setPolicies(res.data || []);
        setCategories(res.categories || []);
        setCounts(res.counts || { all: 0, active: 0, expired: 0 });
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [statusFilter, selectedCategory, search]);

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => fetchPolicies();
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [statusFilter, selectedCategory, search]);

  const handleToggleStatus = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.togglePolicyStatus(id);
      triggerDataUpdate();
      fetchPolicies();
      showToast('Status kebijakan berhasil diperbarui!');
    } catch (err) {
      showAlert({
        title: 'Gagal Mengubah Status',
        message: 'Gagal mengubah status kebijakan: ' + err.message,
        type: 'error'
      });
    }
  };

  const handleDelete = async (id, title, e) => {
    if (e) e.stopPropagation();
    const ok = await showConfirm({
      title: 'Hapus Kebijakan QA',
      message: `Apakah Anda yakin ingin menghapus kebijakan:\n"${title}"?\n\nDokumen yang dihapus tidak dapat dipulihkan kembali.`,
      type: 'danger',
      confirmText: 'Ya, Hapus Kebijakan',
    });
    if (!ok) return;

    try {
      await api.deletePolicyDiscussion(id);
      triggerDataUpdate();
      fetchPolicies();
      showToast('Arsip kebijakan berhasil dihapus!');
      if (selectedDoc?.id === id) {
        setShowDetailModal(false);
        setShowSourceModal(false);
      }
    } catch (err) {
      showAlert({
        title: 'Gagal Menghapus',
        message: 'Gagal menghapus arsip kebijakan: ' + err.message,
        type: 'error'
      });
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.summary.trim()) {
      showAlert({
        title: 'Data Belum Lengkap',
        message: 'Mohon isi judul dan ringkasan isi kebijakan sebelum menyimpan.',
        type: 'warning'
      });
      return;
    }

    const categoryValue = formData.category.trim() || 'PROMO';

    try {
      await api.addPolicyDiscussion({
        ...formData,
        category: categoryValue.toUpperCase(),
        attachment_name: formData.attachment_name.trim() || `SK-DIR-ICON-${Date.now().toString().slice(-4)}`
      });
      triggerDataUpdate();
      setShowAddModal(false);
      setFormData({
        title: '',
        category: '',
        target_channel: 'UNTUK SEMUA',
        discussion_date: new Date().toISOString().split('T')[0],
        summary: '',
        details: '',
        attachment_name: '',
        status: 'active',
        author: 'Tim QA Operasional'
      });
      fetchPolicies();
      showToast('Kebijakan QA baru berhasil diterbitkan!');
    } catch (err) {
      showAlert({
        title: 'Gagal Menyimpan',
        message: 'Gagal menyimpan kebijakan: ' + err.message,
        type: 'error'
      });
    }
  };

  const copyAttachmentCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    showToast(`Kode berkas lampiran "${code}" disalin ke clipboard!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const downloadDummyFile = (code, title) => {
    const filename = `${code || 'KODE_BERKAS_LAMPIRAN'}.txt`;
    const content = `DOKUMEN RESMI KEBIJAKAN & SOP MUTU CONTACT CENTER ICONNET\n` +
      `============================================================\n` +
      `Kode Berkas Lampiran : ${code || 'N/A'}\n` +
      `Judul Kebijakan      : ${title || 'N/A'}\n` +
      `Tanggal Efektif      : ${new Date().toLocaleDateString('id-ID')}\n` +
      `Status Dokumen       : RESMI / BERLAKU\n` +
      `Penerbit             : Divisi Quality Assurance & Operasional Contact Center PLN\n` +
      `------------------------------------------------------------\n` +
      `Dokumen ini merupakan acuan resmi kalibrasi mutu dan penanganan interaksi pelanggan.`;

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast(`Mengunduh berkas lampiran (${filename})...`);
  };

  // Filter Categories for Sidebar
  const filteredCategories = categories.filter(c => 
    c.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. MAIN TOOLBAR & ACTIONS */}

      <div className="corp-card p-3 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Toggle Sidebar & Search Bar */}
        <div className="flex items-center gap-2.5 flex-1">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
            title={showSidebar ? 'Sembunyikan panel klasifikasi' : 'Tampilkan panel klasifikasi'}
          >
            <Layers className="w-3.5 h-3.5 text-blue-700" />
            <span>{showSidebar ? 'Sembunyikan Klasifikasi' : 'Tampilkan Klasifikasi'}</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showSidebar ? 'rotate-90' : ''}`} />
          </button>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, subject, kode berkas lampiran, atau isi..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
            />
          </div>
        </div>

        {/* Status Pills & Action Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Berlaku ({counts.active})
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 cursor-pointer ${
                statusFilter === 'expired'
                  ? 'bg-red-50 text-red-800 border border-red-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Expired ({counts.expired})
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kebijakan</span>
          </button>

          <button
            onClick={fetchPolicies}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 transition shadow-2xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. MAIN BODY (Sidebar Klasifikasi + Policy Cards Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Left Sidebar: KLASIFIKASI (Reference Screenshot Layout) */}
        {showSidebar && (
          <div className="lg:col-span-3 corp-card p-4 space-y-3.5 self-start sticky top-20 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-700" />
                KLASIFIKASI
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                {categories.length} Tipe
              </span>
            </div>

            {/* Category Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Cari klasifikasi..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Category Pills List */}
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {/* "Semua" Category Pill */}
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                <span>Semua</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {counts.all}
                </span>
              </button>

              {/* Dynamic Categories entered by QA */}
              {filteredCategories.map((cat, idx) => {
                const isSelected = selectedCategory === cat;
                const catCount = policies.filter(p => p.category === cat).length;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
                    }`}
                  >
                    <span className="truncate uppercase max-w-[160px]">{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {catCount}
                    </span>
                  </button>
                );
              })}

              {filteredCategories.length === 0 && (
                <div className="py-4 text-center text-slate-400 text-xs italic">
                  Klasifikasi tidak ditemukan.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Policy Cards Feed (Matching Screenshot Layout Exactly) */}
        <div className={`${showSidebar ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-4`}>
          {loading ? (
            <div className="corp-card py-16 text-center text-slate-600 flex flex-col items-center justify-center gap-2.5">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-xs font-bold">Memuat repository kebijakan QA...</span>
            </div>
          ) : policies.length === 0 ? (
            <div className="corp-card py-16 px-6 text-center space-y-3.5 bg-white border border-dashed border-slate-300">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center mx-auto shadow-2xs">
                <BookOpen className="w-7 h-7 text-blue-700" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Repository Kebijakan QA Masih Kosong</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Belum ada dokumen kebijakan atau SOP yang ditambahkan. Silakan klik tombol di bawah untuk mulai menginput data kebijakan secara mandiri.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kebijakan Baru</span>
              </button>
            </div>
          ) : (
            policies.map((p) => {
              const isBerlaku = p.status === 'active';

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-300/80 p-5 sm:p-6 shadow-xs hover:border-slate-400 hover:shadow-md transition-all duration-150 space-y-3 relative group"
                >
                  {/* Card Title (Bold Black Uppercase - Exact Reference) */}
                  <h2
                    onClick={() => {
                      setSelectedDoc(p);
                      setShowDetailModal(true);
                    }}
                    className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight leading-snug hover:text-blue-700 cursor-pointer transition-colors"
                  >
                    {p.title}
                  </h2>

                  {/* Metadata Row: Date, UNTUK SEMUA, BERLAKU (Exact Reference Layout) */}
                  <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500 font-medium">
                    <span className="text-slate-600 font-medium">{formatDateIndonesian(p.date)}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300 uppercase tracking-wider">
                      UNTUK SEMUA
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isBerlaku
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {isBerlaku ? 'BERLAKU' : 'EXPIRED'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-[11px] font-bold text-slate-700 uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                      {p.category}
                    </span>
                  </div>

                  {/* Card Summary Body */}
                  <p className="text-xs text-slate-700 leading-relaxed font-normal pt-1">
                    {p.summary}
                  </p>

                  {/* Action Buttons (Exact Red & Orange Pill Buttons from Reference Screenshot) */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2.5">
                      {/* Red Button: "Selengkapnya" -> Opens Pop-up Drop Modal */}
                      <button
                        onClick={() => {
                          setSelectedDoc(p);
                          setShowDetailModal(true);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                        title="Buka popup selengkapnya"
                      >
                        Selengkapnya
                      </button>

                      {/* Orange Button: "Source" -> Opens Kode Berkas Lampiran Modal */}
                      <button
                        onClick={() => {
                          setSelectedDoc(p);
                          setShowSourceModal(true);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                        title="Lihat kode berkas lampiran"
                      >
                        Source
                      </button>
                    </div>

                    {/* Quick Tools on Hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleToggleStatus(p.id, e)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                      >
                        {isBerlaku ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        onClick={(e) => handleDelete(p.id, p.title, e)}
                        className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        title="Hapus Kebijakan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. MODAL POP-UP DROP: SELENGKAPNYA (Authentic Detailed SOP Pop-Up) */}
      {showDetailModal && selectedDoc && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl shadow-2xl p-5 sm:p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-xs space-y-4">
            {/* Close Button */}
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header with Title & Badges */}
            <div className="pr-8 space-y-2 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-800 border border-blue-200">
                  {selectedDoc.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  UNTUK SEMUA
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  selectedDoc.status === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {selectedDoc.status === 'active' ? 'BERLAKU' : 'EXPIRED'}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight leading-snug">
                {selectedDoc.title}
              </h2>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Tanggal Efektif: <strong className="text-slate-800">{formatDateIndonesian(selectedDoc.date)}</strong>
                </span>
                <span>•</span>
                <span>Penerbit: <strong className="text-slate-800">{selectedDoc.author || 'Tim QA Operasional & Mutu'}</strong></span>
              </div>
            </div>

            {/* Highlight: Kode Berkas Lampiran Section */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Kode Berkas Lampiran
                </span>
                <span className="font-extrabold text-blue-900 font-mono text-sm tracking-wide select-all">
                  {selectedDoc.attachment || 'SK-DIR-ICON-2026'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyAttachmentCode(selectedDoc.attachment)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="Salin kode lampiran"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{copiedCode ? 'Tersalin' : 'Salin Kode'}</span>
                </button>

                <button
                  onClick={() => downloadDummyFile(selectedDoc.attachment, selectedDoc.title)}
                  className="px-3 py-1.5 rounded-xl bg-[#0F2744] hover:bg-[#162E4D] text-white font-bold text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Dokumen</span>
                </button>
              </div>
            </div>

            {/* Summary & Petunjuk Teknis Detail Content */}
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                  <span>Ringkasan Ketentuan:</span>
                </h4>
                <p className="text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 text-xs">
                  {selectedDoc.summary}
                </p>
              </div>

              {selectedDoc.details && (
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-700" />
                    <span>Petunjuk Teknis & Standar Acuan Audit Mutu:</span>
                  </h4>
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 whitespace-pre-line leading-relaxed text-xs">
                    {selectedDoc.details}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={(e) => handleToggleStatus(selectedDoc.id, e)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Ubah Status Menjadi {selectedDoc.status === 'active' ? 'Expired' : 'Berlaku'}
              </button>

              <button
                onClick={() => setShowDetailModal(false)}
                className="btn-secondary"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. MODAL POP-UP SOURCE (Kode Berkas Lampiran Quick View) */}
      {showSourceModal && selectedDoc && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-5 relative animate-in fade-in zoom-in-95 duration-150 text-xs space-y-3.5">
            <button
              onClick={() => setShowSourceModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Paperclip className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Kode Berkas Lampiran</h3>
                <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{selectedDoc.title}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2 text-center">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                Kode Referensi Resmi:
              </span>
              <span className="font-extrabold text-slate-900 font-mono text-base block select-all">
                {selectedDoc.attachment || 'SK-DIR-ICON-0926'}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => copyAttachmentCode(selectedDoc.attachment)}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-300 transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copiedCode ? 'Tersalin' : 'Salin Kode'}</span>
              </button>

              <button
                onClick={() => {
                  downloadDummyFile(selectedDoc.attachment, selectedDoc.title);
                  setShowSourceModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6. MODAL: TAMBAH KEBIJAKAN BARU (QA Input Manual) */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl p-5 sm:p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-xs space-y-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Tambah Dokumen Kebijakan QA
                </h3>
                <p className="text-xs text-slate-500">
                  Kategori dan kode berkas dapat diisi bebas secara manual oleh QA
                </p>
              </div>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-3.5">
              {/* Judul Kebijakan */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Judul Kebijakan / SOP <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: ICONNET UPGRADE HARGA KHUSUS (CUSTOMER LOYALTY)"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                  required
                />
              </div>

              {/* Kategori Kebijakan (MANUAL INPUT BY QA - NO LOCKED TEMPLATE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Kategori Kebijakan <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ketik kategori manual (PROMO, NEWS, BO, dll)..."
                    list="category-datalist"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium uppercase"
                    required
                  />
                  <datalist id="category-datalist">
                    {categories.map((c, i) => (
                      <option key={i} value={c} />
                    ))}
                    <option value="PROMO" />
                    <option value="NEWS" />
                    <option value="BACK OFFICE" />
                    <option value="OUTBOUND" />
                    <option value="INTERNET" />
                    <option value="PEMASANGAN" />
                    <option value="BILLING" />
                    <option value="ISOLIR" />
                  </datalist>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Bebas ketik kategori baru atau pilih saran yang tersedia.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Tanggal Berlaku <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.discussion_date}
                    onChange={(e) => setFormData({ ...formData, discussion_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Ringkasan Kebijakan */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Ringkasan Hasil / Keputusan <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows="2"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Tuliskan ringkasan syarat atau inti keputusan kebijakan..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              {/* Petunjuk Teknis / Details */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Rincian & Ketentuan Lengkap
                </label>
                <textarea
                  rows="3"
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Tuliskan butir-butir standar audit atau alur langkah..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-[11px]"
                />
              </div>

              {/* Kode Berkas Lampiran & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Kode Berkas Lampiran
                  </label>
                  <input
                    type="text"
                    value={formData.attachment_name}
                    onChange={(e) => setFormData({ ...formData, attachment_name: e.target.value })}
                    placeholder="Contoh: SK-DIR-ICON-0926-01"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Status Kebijakan
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="active">Masih Berlaku (Active)</option>
                    <option value="expired">Tidak Berlaku (Expired)</option>
                  </select>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Simpan Kebijakan Baru
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
