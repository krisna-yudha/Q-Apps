import React, { useState, useEffect } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import { CustomSelect } from '../components/common/CustomSelect';

export const PolicyRepository = () => {
  const { triggerDataUpdate } = useSync();
  const { showConfirm, showAlert, showToast } = useDialog();
  const [policies, setPolicies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'SOP Greeting & Verification',
    discussion_date: new Date().toISOString().split('T')[0],
    summary: '',
    details: '',
    attachment_name: '',
    status: 'active'
  });

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await api.getPolicyDiscussions({
        status: statusFilter,
        category: categoryFilter,
        search
      });
      if (res.success) {
        setPolicies(res.data);
        setCategories(res.categories);
        setCounts(res.counts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
    const handleSync = () => fetchPolicies();
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, [statusFilter, categoryFilter, search]);

  const handleToggleStatus = async (id) => {
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

  const handleDelete = async (id) => {
    const ok = await showConfirm({
      title: 'Hapus Arsip Kebijakan',
      message: 'Apakah Anda yakin ingin menghapus arsip kebijakan ini?\n\nData dokumen kebijakan yang dihapus tidak dapat dipulihkan kembali.',
      type: 'danger',
      confirmText: 'Ya, Hapus Kebijakan',
    });
    if (!ok) return;

    try {
      await api.deletePolicyDiscussion(id);
      triggerDataUpdate();
      fetchPolicies();
      showToast('Arsip kebijakan berhasil dihapus!');
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
    if (!formData.title || !formData.summary) {
      showAlert({
        title: 'Data Belum Lengkap',
        message: 'Mohon isi judul dan ringkasan hasil diskusi sebelum menyimpan.',
        type: 'warning'
      });
      return;
    }

    try {
      await api.addPolicyDiscussion(formData);
      triggerDataUpdate();
      setShowAddModal(false);
      setFormData({
        title: '',
        category: 'SOP Greeting & Verification',
        discussion_date: new Date().toISOString().split('T')[0],
        summary: '',
        details: '',
        attachment_name: '',
        status: 'active'
      });
      fetchPolicies();
      showToast('Hasil diskusi kebijakan berhasil disimpan!');
    } catch (err) {
      showAlert({
        title: 'Gagal Menyimpan',
        message: 'Gagal menyimpan kebijakan: ' + err.message,
        type: 'error'
      });
    }
  };

  const downloadDummyFile = (filename) => {
    const element = document.createElement('a');
    const file = new Blob([`Dokumen Kebijakan QA Contact Center: ${filename}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename || 'kebijakan_qa.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="corp-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200">
              MODUL 5
            </span>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
              Repository Hasil Diskusi Kebijakan QA
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Knowledge base, standarisasi SOP, notulensi kalibrasi mutu, dan parameter penilaian terkini.
          </p>
        </div>

        {/* Action Buttons: Solid Primary */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Diskusi Baru</span>
          </button>

          <button
            onClick={fetchPolicies}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 transition shadow-2xs active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="corp-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-blue-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul diskusi, SOP, atau penulis..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
            />
          </div>

          <div className="w-full md:w-64">
            <CustomSelect
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Semua Kategori Kebijakan' },
                ...categories.map(c => ({ value: c, label: c }))
              ]}
              placeholder="Pilih Kategori..."
            />
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-700 mr-1 flex items-center gap-1.5 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-blue-700" /> Filter:
          </span>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-[#0F2744] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Semua</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">{counts.all}</span>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
              statusFilter === 'active'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Berlaku</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">{counts.active}</span>
          </button>

          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
              statusFilter === 'expired'
                ? 'bg-red-50 text-red-800 border-red-300 font-extrabold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Expired</span>
            <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">{counts.expired}</span>
          </button>
        </div>
      </div>

      {/* Main Documentation Table & Mobile Cards */}
      <div className="corp-card overflow-hidden">
        {/* 1. Mobile Card List View (Visible only on < md screens) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-10 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-xs font-medium">Memuat data repository kebijakan...</span>
            </div>
          ) : policies.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Belum Ada Dokumen Kebijakan / SOP</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Database repository kebijakan masih kosong. Anda dapat menambahkan SOP baru atau notulensi hasil kalibrasi pertama dengan tombol di bawah ini.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary mt-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Dokumen Kebijakan Baru</span>
                </button>
              </div>
            </div>
          ) : (
            policies.map((p, index) => {
              const isActive = p.status === 'active';
              return (
                <div key={p.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/70 transition-colors">
                  {/* Top: Index, Title, Category, and Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">
                          {p.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            <Tag className="w-2.5 h-2.5 text-blue-700" />
                            {p.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {p.author}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(p.id)}
                      title="Klik untuk ubah status"
                      className={`text-[9px] py-0.5 px-2 rounded font-bold cursor-pointer flex-shrink-0 ${
                        isActive ? 'badge-success' : 'badge-critical'
                      }`}
                    >
                      {isActive ? 'Aktif' : 'Tidak Aktif'}
                    </button>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 leading-relaxed line-clamp-3">
                    {p.summary}
                  </p>

                  {/* Bottom: Date, Attachment, Actions */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.date}</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {p.attachment && (
                        <button
                          onClick={() => downloadDummyFile(p.attachment)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200 transition"
                          title="Unduh Lampiran"
                        >
                          <Paperclip className="w-3 h-3 text-blue-700" />
                          <span className="truncate max-w-[90px]">{p.attachment}</span>
                        </button>
                      )}

                      <button
                        onClick={() => { setSelectedDoc(p); setShowDetailModal(true); }}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
                        title="Lihat Detail"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 transition"
                        title="Hapus Dokumen"
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

        {/* 2. Desktop Table View (Visible on >= md screens) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-bold text-[11px]">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4 min-w-[220px]">Judul Diskusi & Kategori</th>
                <th className="py-3 px-4">Tanggal Berlaku</th>
                <th className="py-3 px-4 min-w-[280px]">Ringkasan Hasil / Keputusan</th>
                <th className="py-3 px-4">Lampiran Berkas</th>
                <th className="py-3 px-4 text-center">Status Badge</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <span>Memuat data repository kebijakan...</span>
                    </div>
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Belum Ada Dokumen Kebijakan / SOP</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Database repository kebijakan masih kosong. Anda dapat menambahkan SOP baru atau notulensi hasil kalibrasi pertama dengan tombol di bawah ini.
                      </p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Dokumen Kebijakan Baru</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                policies.map((p, index) => {
                  const isActive = p.status === 'active';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] font-semibold">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {p.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            <Tag className="w-2.5 h-2.5 text-blue-700" />
                            {p.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Oleh: {p.author}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-mono text-[11px] font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{p.date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 leading-relaxed">
                        <p className="line-clamp-2 text-xs">{p.summary}</p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {p.attachment ? (
                          <button
                            onClick={() => downloadDummyFile(p.attachment)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-blue-800 text-xs font-bold border border-slate-300 transition"
                            title="Unduh Lampiran Dokumen"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-blue-700" />
                            <span className="truncate max-w-[120px]">{p.attachment}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Tanpa Lampiran</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(p.id)}
                          title="Klik untuk ubah status"
                          className={isActive ? 'badge-success cursor-pointer font-bold' : 'badge-critical cursor-pointer font-bold'}
                        >
                          {isActive ? 'Aktif' : 'Tidak Aktif'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setSelectedDoc(p); setShowDetailModal(true); }}
                            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded text-red-600 hover:text-red-800 hover:bg-red-50 transition"
                            title="Hapus Dokumen"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal: Tambah Diskusi Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl shadow-xl p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-xs">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0F2744] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tambah Hasil Diskusi Kebijakan QA</h3>
                <p className="text-xs text-slate-600">Dokumentasikan SOP baru atau hasil kalibrasi parameter mutu</p>
              </div>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Judul Diskusi / Nama Kebijakan <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Standar Sambutan & Empati Penanganan Gangguan Massal"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Kategori Kebijakan <span className="text-red-600">*</span>
                  </label>
                  <CustomSelect
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    options={[
                      'SOP Greeting & Verification',
                      'Complaint Escalation',
                      'Billing & Refund',
                      'Crisis Management',
                      'Calibration Guideline',
                      'Quarterly Policy'
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Tanggal Efektif <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.discussion_date}
                    onChange={(e) => setFormData({ ...formData, discussion_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Ringkasan Hasil / Keputusan <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows="3"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Tuliskan intisari perubahan atau keputusan kalibrasi mutu..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Status Kebijakan
                  </label>
                  <CustomSelect
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={[
                      { value: 'active', label: 'Masih Berlaku (Active)' },
                      { value: 'expired', label: 'Tidak Berlaku (Expired)' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nama Berkas Lampiran
                  </label>
                  <input
                    type="text"
                    value={formData.attachment_name}
                    onChange={(e) => setFormData({ ...formData, attachment_name: e.target.value })}
                    placeholder="Contoh: SOP_Baru_2026.pdf"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

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
        </div>
      )}

      {/* Modal: Detail Dokumen */}
      {showDetailModal && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg shadow-xl p-6 relative animate-in fade-in zoom-in-95 duration-150 text-xs">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className={selectedDoc.status === 'active' ? 'badge-success font-bold' : 'badge-critical font-bold'}>
                {selectedDoc.status === 'active' ? 'Masih Berlaku' : 'Tidak Berlaku / Expired'}
              </span>
              <span className="text-slate-600 font-medium">• {selectedDoc.category}</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">{selectedDoc.title}</h3>
            <p className="text-xs text-slate-600 mb-4 font-mono font-medium">
              Tanggal Efektif: {selectedDoc.date} | Penulis: {selectedDoc.author}
            </p>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 mb-4 space-y-2.5">
              <div>
                <h4 className="font-bold text-slate-800 mb-0.5">Ringkasan Keputusan:</h4>
                <p className="text-slate-700 leading-relaxed">{selectedDoc.summary}</p>
              </div>
              {selectedDoc.details && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-0.5">Detil Acuan Audit:</h4>
                  <p className="text-slate-700 leading-relaxed">{selectedDoc.details}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => downloadDummyFile(selectedDoc.attachment)}
                className="btn-primary"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Berkas ({selectedDoc.attachment})
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="btn-secondary"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
