import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  TrendingUp,
  BarChart3,
  Users,
  Award,
  BookOpen,
  ChevronRight,
  ShieldAlert,
  X,
  Server
} from 'lucide-react';

export const navItems = [
  {
    number: '1',
    name: 'Dashboard Global',
    subtitle: 'CA & FCR Metrics',
    path: '/dashboard-global',
    icon: TrendingUp,
  },
  {
    number: '2',
    name: 'Analisis & Evaluasi (Anev)',
    subtitle: 'Top & Bottom Performer',
    path: '/anev',
    icon: BarChart3,
  },
  {
    number: '3',
    name: 'Rekap Nilai Agent',
    subtitle: 'Score Recap & Excel Import',
    path: '/rekap-agent',
    icon: Users,
  },
  {
    number: '4',
    name: 'Pencapaian Tim QA',
    subtitle: 'Sampling Progress & Quota',
    path: '/pencapaian-qa',
    icon: Award,
  },
  {
    number: '5',
    name: 'Hasil Diskusi Kebijakan',
    subtitle: 'Knowledge Base & SOP',
    path: '/hasil-diskusi',
    icon: BookOpen,
  },
  {
    number: '6',
    name: 'Input & Import Supervisor',
    subtitle: 'Satu Pintu NAKER & 7 QSF',
    path: '/input-supervisor',
    icon: ShieldAlert,
  },
];

// Daftar rute yang sudah tersedia di bottom navigation mobile
export const BOTTOM_NAV_PATHS = [
  '/',
  '/dashboard-global',
  '/anev',
  '/rekap-agent',
  '/pencapaian-qa',
  '/hasil-diskusi',
];

export const Sidebar = ({ mobileOpen, closeMobileSidebar }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out shadow-sm lg:top-[57px] lg:z-20 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Menu Tambahan & Pengaturan
          </span>
          <button
            onClick={closeMobileSidebar}
            className="p-1 rounded bg-slate-100 text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Main Link (Hidden on Mobile because 'Hub' is in bottom navigation) */}
        <div className="px-3 pt-3 hidden lg:block">
          <NavLink
            to="/"
            end
            onClick={closeMobileSidebar}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-colors duration-150 ${isActive
                ? 'bg-blue-50 text-[#0F2744] font-bold border-l-4 border-[#0F2744]'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            <LayoutGrid className="w-4 h-4 text-[#0F2744]" />
            <span>Dashboard Utama</span>
          </NavLink>
        </div>

        {/* Section Heading */}
        <div className="px-4 pt-4 pb-1.5">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden lg:block">
            Modul Quality Assurance
          </p>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider lg:hidden">
            Modul Supervisor & Kontrol
          </p>
        </div>

        {/* Navigation Items (Duplicates hidden on mobile, full on desktop) */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDuplicateOnMobile = BOTTOM_NAV_PATHS.includes(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  `${isDuplicateOnMobile ? 'hidden lg:flex' : 'flex'} group items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-150 text-xs ${isActive
                    ? 'bg-blue-50/80 text-[#0F2744] font-bold border-l-4 border-[#0F2744] shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-700 flex-shrink-0 group-hover:bg-slate-200">
                    {item.number}
                  </div>
                  <Icon className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition flex-shrink-0" />
                  <div className="truncate text-left">
                    <div className="truncate font-semibold">{item.name}</div>
                    <div className="text-[10px] text-slate-500 font-normal truncate">{item.subtitle}</div>
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition" />
              </NavLink>
            );
          })}

          {/* Helpful Information in Mobile Drawer */}
          <div className="lg:hidden p-3 mt-4 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" /> Navigasi Cepat Bawah Aktif
            </span>
            <p className="text-[10px] text-slate-500 leading-tight">
              Menu utama (Hub, Global, Anev, Rekap, Tim QA, Kebijakan) dapat diakses langsung melalui tombol navigasi di bagian bawah layar.
            </p>
          </div>
        </nav>

        {/* Database Status Box */}
        <div className="p-3 m-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
              <Server className="w-3.5 h-3.5 text-blue-600" /> Database Status
            </span>
            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">MySQL Live</span>
          </div>
          <p className="text-[10px] text-slate-600 font-mono">
            DB: <span className="font-bold text-slate-800">qa_db</span> (Port 3306)
          </p>
        </div>
      </aside>
    </>
  );
};
