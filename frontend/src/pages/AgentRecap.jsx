import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Upload,
  FileSpreadsheet,
  FileText,
  ArrowUpDown,
  Trash2,
  RefreshCw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Target,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { CustomSelect } from '../components/common/CustomSelect';

export const AgentRecap = () => {
  const { user } = useAuth();
  const { triggerDataUpdate } = useSync();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [channels, setChannels] = useState(['Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office']);
  const [selectedTL, setSelectedTL] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sortBy, setSortBy] = useState('ca');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await api.getAgentRecap({
        search,
        channel: selectedChannel || undefined,
        team_leader_id: selectedTL,
        trainer_id: selectedTrainer,
        sort_by: sortBy === 'ca' ? 'ca_score' : sortBy === 'fcr' ? 'fcr_score' : 'name',
        sort_order: sortOrder
      });
      setAgents(res.data || []);
      if (res.teamLeaders) setTeamLeaders(res.teamLeaders);
      if (res.trainers) setTrainers(res.trainers);
      if (res.channels) setChannels(res.channels);
    } catch (e) {
      console.error(e);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [search, selectedChannel, selectedTL, selectedTrainer, sortBy, sortOrder]);

  // Live Auto-Refresh Listener
  useEffect(() => {
    const handleSync = () => fetchAgents();
    window.addEventListener('digiqa:data_refresh', handleSync);
    return () => window.removeEventListener('digiqa:data_refresh', handleSync);
  }, []);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Export Data to Excel
  const exportToExcel = () => {
    if (agents.length === 0) {
      alert('Tidak ada data agent untuk diexport.');
      return;
    }

    const exportData = agents.map((agent, idx) => ({
      'No': idx + 1,
      'Nama Agent': agent.name,
      'NIK': agent.nik,
      'Saluran / Layanan': agent.channel || '-',
      'Nilai CA (%)': agent.ca,
      'Nilai FCR (%)': agent.fcr,
      'Team Leader (TL)': agent.tl || '-',
      'Trainer Pengampu': agent.trainer || '-',
      'Status Mutu': agent.status,
      'Jumlah Evaluasi': agent.evaluations || 1,
      'Periode': agent.period_month || '2026-08'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai Agen');
    XLSX.writeFile(wb, `Rekap_Nilai_Agent_digiQA_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export Data to PDF
  const exportToPDF = () => {
    if (agents.length === 0) {
      alert('Tidak ada data agent untuk diexport ke PDF.');
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('REKAP RATA-RATA NILAI PER AGENT - DIGIQA ENTERPRISE', 14, 15);
    doc.setFontSize(9);
    doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')} | Total Data: ${agents.length} Agen`, 14, 21);

    const tableColumn = ['No', 'Nama Agent', 'NIK', 'Layanan', 'CA (%)', 'FCR (%)', 'Team Leader', 'Trainer', 'Status'];
    const tableRows = agents.map((agent, idx) => [
      idx + 1,
      agent.name,
      agent.nik,
      agent.channel || '-',
      `${agent.ca}%`,
      `${agent.fcr}%`,
      agent.tl || '-',
      agent.trainer || '-',
      agent.status
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 39, 68], textColor: [255, 255, 255] }
    });

    doc.save(`Rekap_Nilai_Agent_digiQA_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Clear / Reset All Agent Data
  const handleClearData = async () => {
    if (window.confirm('PERINGATAN: Apakah Anda yakin ingin mengosongkan seluruh data penilaian agent? Tindakan ini tidak dapat dibatalkan.')) {
      try {
        await api.clearAgentsData();
        triggerDataUpdate();
        fetchAgents();
      } catch (err) {
        alert('Gagal mengosongkan data: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(agents.length / itemsPerPage) || 1;
  const currentData = agents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Main Actions */}
      <div className="corp-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0F2744] border border-blue-200">
              MODUL 3
            </span>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
              Rekap Rata-Rata Nilai Per Agent
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Data penilaian individu agen, skor Customer Accuracy (CA), First Call Resolution (FCR), dan status mutu dari import Excel.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Satu Pintu Import Button (Direct Link to Supervisor Input) */}
          <Link
            to="/input-supervisor"
            className="btn-primary flex-1 sm:flex-initial py-2 px-3.5 rounded-xl font-bold text-xs"
            title="Pusat Satu Pintu Import Excel (Database NAKER & 7 Saluran QSF)"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data</span>
          </Link>

          {/* Export Excel */}
          <button
            onClick={exportToExcel}
            className="btn-secondary flex-1 sm:flex-initial py-2 px-3 rounded-xl font-bold text-xs"
            title="Export ke Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
            <span>Export Excel</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={exportToPDF}
            className="btn-secondary flex-1 sm:flex-initial py-2 px-3 rounded-xl font-bold text-xs"
            title="Export ke Dokumen PDF"
          >
            <FileText className="w-4 h-4 text-red-700" />
            <span>PDF</span>
          </button>

          {/* Clear Data Button */}
          {agents.length > 0 && (
            <button
              onClick={handleClearData}
              className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:text-red-700 hover:bg-red-50 transition shadow-2xs"
              title="Kosongkan Data Penilaian"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="corp-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 md:max-w-md">
            <Search className="w-4 h-4 text-blue-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Cari nama agent, NIK, atau TL..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            {channels.length > 0 && (
              <CustomSelect
                value={selectedChannel}
                onChange={(e) => { setSelectedChannel(e.target.value); setCurrentPage(1); }}
                options={[
                  { value: '', label: 'Semua Saluran (7 Saluran)' },
                  ...channels.map(ch => ({ value: ch, label: ch }))
                ]}
                placeholder="Pilih Saluran..."
              />
            )}

            {teamLeaders.length > 0 && (
              <CustomSelect
                value={selectedTL}
                onChange={(e) => { setSelectedTL(e.target.value); setCurrentPage(1); }}
                options={[
                  { value: '', label: 'Semua Team Leader (TL)' },
                  ...teamLeaders.map(tl => ({ value: tl.id, label: tl.name }))
                ]}
                placeholder="Pilih Team Leader..."
              />
            )}

            {trainers.length > 0 && (
              <CustomSelect
                value={selectedTrainer}
                onChange={(e) => { setSelectedTrainer(e.target.value); setCurrentPage(1); }}
                options={[
                  { value: '', label: 'Semua Trainer' },
                  ...trainers.map(trn => ({ value: trn.id, label: trn.name }))
                ]}
                placeholder="Pilih Trainer..."
              />
            )}
          </div>
        </div>

        {/* Filter Footer Info & Reset Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            <span>Total: <strong className="text-slate-950 font-black">{agents.length}</strong> Agen Terdata</span>
          </div>

          {(search || selectedChannel || selectedTL || selectedTrainer) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedChannel('');
                setSelectedTL('');
                setSelectedTrainer('');
                setCurrentPage(1);
              }}
              className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition px-2 py-0.5 rounded-lg hover:bg-red-50"
            >
              <X className="w-3 h-3" /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Data Table & Mobile Cards */}
      <div className="corp-card overflow-hidden">
        {/* 1. Mobile Card List View (Visible only on < md screens) */}
        <div className="block md:hidden p-3 space-y-3.5 bg-slate-100/70">
          {loading ? (
            <div className="py-12 text-center text-slate-600 flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-xs font-bold text-slate-700">Memuat data penilaian agen...</span>
            </div>
          ) : currentData.length === 0 ? (
            <div className="py-10 px-4 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Belum Ada Data Penilaian</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Database nilai agen masih kosong. Silakan import berkas Excel melalui menu <strong>Input & Import Supervisor</strong>.
                </p>
                <Link to="/input-supervisor" className="btn-primary mt-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Buka Menu Input & Import</span>
                </Link>
              </div>
            </div>
          ) : (
            currentData.map((agent, index) => {
              const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
              const isHighCA = agent.ca >= 90;
              const isExceed = agent.ca >= 96;
              const isMeet = agent.ca >= 85 && agent.ca < 96;

              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-4 space-y-3.5 transition-all hover:border-blue-400 hover:shadow-md"
                >
                  {/* Kolom Header: Nomor, Nama Agent, NIK, Layanan, Status Mutu */}
                  <div className="flex items-start justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#0F2744] text-white font-mono font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                        #{globalIndex}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-tight uppercase tracking-tight truncate">
                          {agent.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            NIK: {agent.nik}
                          </span>
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                            {agent.channel || 'Inbound'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide flex-shrink-0 border shadow-2xs ${isExceed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : isMeet
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                        }`}
                    >
                      {isExceed ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : isMeet ? (
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-600" />
                      )}
                      <span>
                        {agent.status || (isExceed ? 'Exceed Target' : isMeet ? 'Meet Target' : 'Need Coaching')}
                      </span>
                    </span>
                  </div>

                  {/* Kolom Metrik Nilai Skor (Customer Accuracy & First Call Res) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Kolom Customer Accuracy */}
                    <div
                      className={`p-3 rounded-xl border-2 transition-colors ${isHighCA
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-red-50/80 border-red-200 text-red-950'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                          Customer Accuracy
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isHighCA ? 'bg-emerald-200/70 text-emerald-900' : 'bg-red-200/70 text-red-900'
                            }`}
                        >
                          Tgt: 90%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span
                          className={`text-2xl font-black tracking-tight ${isHighCA ? 'text-emerald-900' : 'text-red-700'
                            }`}
                        >
                          {agent.ca}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full ${isHighCA ? 'bg-emerald-600' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(agent.ca, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Kolom First Call Resolution */}
                    <div className="p-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                          First Call Res.
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                          Tgt: 85%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black tracking-tight text-slate-900">
                          {agent.fcr}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${Math.min(agent.fcr, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Kolom Penanggung Jawab (Team Leader & Trainer) */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>Team Leader (TL)</span>
                      </span>
                      <span className="font-extrabold text-xs text-slate-900 block mt-1 truncate">
                        {agent.tl || '-'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Award className="w-3 h-3 text-amber-500" />
                        <span>Trainer Pengampu</span>
                      </span>
                      <span className="font-extrabold text-xs text-slate-900 block mt-1 truncate">
                        {agent.trainer || '-'}
                      </span>
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
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Agent</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-4">Layanan</th>
                <th
                  onClick={() => handleSort('ca')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>CA (%)</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('fcr')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>FCR (%)</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-4">Team Leader (TL)</th>
                <th className="py-3 px-4">Trainer Pengampu</th>
                <th className="py-3 px-4 text-center">Status Mutu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-slate-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <span>Memuat data dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center space-y-2.5">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Belum Ada Data Penilaian</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Database nilai agen masih kosong. Silakan import berkas Excel (NAKER atau 7 Saluran QSF) melalui menu <strong>Input & Import Supervisor</strong>.
                      </p>
                      <Link
                        to="/input-supervisor"
                        className="btn-primary mt-2"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Buka Menu Input & Import Supervisor</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                currentData.map((agent, index) => {
                  const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr
                      key={agent.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] font-semibold">
                        {globalIndex}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {agent.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono font-medium">
                          {agent.nik}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {agent.channel || 'Inbound'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-black text-sm">
                        <span className={agent.ca >= 90 ? 'text-emerald-800' : 'text-red-700'}>
                          {agent.ca}%
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {agent.fcr}%
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {agent.tl || '-'}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {agent.trainer || '-'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${agent.ca >= 96
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : agent.ca >= 85
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                        >
                          {agent.status || (agent.ca >= 96 ? 'Exceed Target' : agent.ca >= 85 ? 'Meet Target' : 'Need Coaching')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {agents.length > itemsPerPage && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, agents.length)} dari {agents.length} agen
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
