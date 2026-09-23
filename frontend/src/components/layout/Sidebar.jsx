import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  TrendingUp,
  BarChart3,
  Users,
  Award,
  BookOpen,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Settings,
  UserCheck,
  ClipboardCheck,
  History,
  Archive,
  X,
  LogOut,
  User
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getMobileNavItemsForRole } from './MobileNav';

export const getNavItemsForRole = (user) => {
  const role = user?.role || '';
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';
  const isQA = role === 'quality_assurance' || role === 'qa';
  const isTL = role === 'team_leader' || role === 'tl';
  const isTrainer = role === 'trainer';
  const isTLorTrainer = isTL || isTrainer;

  const baseItems = [
    {
      name: 'Dashboard Global',
      subtitle: 'CA & FCR Metrics (Data Matang)',
      path: '/dashboard-global',
      icon: TrendingUp,
    },
    {
      name: 'QA Analytics',
      subtitle: 'Top & Bottom Performer',
      path: '/anev',
      icon: BarChart3,
    },
    {
      name: 'Agent Scorecards',
      subtitle: 'Rekapitulasi Nilai & Detail',
      path: '/rekap-agent',
      icon: Users,
    },
    {
      name: 'Success Board',
      subtitle: 'Pencapaian Kuota Sampling',
      path: '/pencapaian-qa',
      icon: Award,
    },
    {
      name: 'QA Policy Hub',
      subtitle: 'SOP, Kalibrasi & Hasil Diskusi',
      path: '/kebijakan',
      icon: BookOpen,
    },
  ];

  if (isSupervisor) {
    baseItems.push(
      {
        name: 'Sampling Ticket',
        subtitle: 'Monitoring & Audit Antrean QA',
        path: '/evaluasi-sampling',
        icon: ClipboardCheck,
      },
      {
        name: 'Ticketing',
        subtitle: 'Distribusi Data Mentah Sampling',
        path: '/auto-distribution',
        icon: Zap,
      },
      {
        name: 'Data Master',
        subtitle: 'Import Data Matang & NAKER',
        path: '/settings',
        icon: Settings,
      },
      // {
      //   name: 'Riwayat NAKER',
      //   subtitle: 'Arsip Plotting Multi-Bulan',
      //   path: '/riwayat-naker',
      //   icon: History,
      // },
      {
        name: 'User Setting',
        subtitle: 'Hak Akses & Akun Master',
        path: '/kelola-akun',
        icon: UserCheck,
      }
    );
  } else if (isQA) {
    baseItems.push({
      name: 'Sampling Ticket',
      subtitle: 'Pengerjaan & Penilaian Mutu QA',
      path: '/evaluasi-sampling',
      icon: ClipboardCheck,
    });
  } else if (isTLorTrainer) {
    baseItems.push({
      name: isTL ? 'Rekap Tim Binaan' : 'Rekap Kelas Bimbingan',
      subtitle: isTL ? 'Performa & NAKER Under-Team TL' : 'Performa & NAKER Binaan Trainer',
      path: '/rekap-under-team',
      icon: UserCheck,
    });
  }

  return baseItems.map((item, index) => ({
    ...item,
    number: String(index + 1),
  }));
};

export const navItems = getNavItemsForRole({ role: 'supervisor' });

export const Sidebar = ({ mobileOpen, closeMobileSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';
  const isTLorTrainer = user?.role === 'team_leader' || user?.role === 'tl' || user?.role === 'trainer';

  const handleLogout = async () => {
    closeMobileSidebar();
    await logout();
    navigate('/login');
  };

  const visibleNavItems = getNavItemsForRole(user);
  const bottomNavItems = getMobileNavItemsForRole(user);
  const bottomNavPaths = new Set(bottomNavItems.map((item) => item.to));

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 sm:w-80 bg-white border-r border-slate-200 flex flex-col transition-transform duration-250 ease-out shadow-xl lg:top-[57px] lg:w-64 lg:z-20 lg:shadow-sm lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0F2744] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-sm tracking-tight text-[#0F2744]">
                  digi<span className="text-blue-600">QA</span>
                </span>
                <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-slate-200 text-slate-700">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Modul & Fitur Lanjutan
              </p>
            </div>
          </div>

          <button
            onClick={closeMobileSidebar}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 active:scale-95 transition shadow-2xs cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Main Link (Hidden on mobile if already in bottom nav) */}
        <div className={`${bottomNavPaths.has('/') ? 'hidden lg:block' : 'block'} px-3 pt-3`}>
          <NavLink
            to="/"
            end
            onClick={closeMobileSidebar}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all duration-150 min-h-[44px] touch-manipulation active:scale-[0.98] ${isActive
                ? 'bg-[#0F2744] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Dashboard Utama (Hub)</span>
          </NavLink>
        </div>

        {/* Section Heading */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider lg:hidden">
            Modul & Direktori Lanjutan
          </p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider hidden lg:block">
            {isSupervisor ? 'Modul Quality Assurance & Kontrol' : 'Modul Analitik & Sampling'}
          </p>
        </div>

        {/* Navigation Items (Filtered by RBAC Role & Mobile Bottom-Nav Deduplication) */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto overscroll-contain pb-3">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isAlreadyInBottom = bottomNavPaths.has(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  `${isAlreadyInBottom ? 'hidden lg:flex' : 'flex'} group items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-xs min-h-[44px] touch-manipulation active:scale-[0.98] ${isActive
                    ? 'bg-blue-50/90 text-[#0F2744] font-bold border-l-4 border-[#0F2744] shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 flex-shrink-0 group-hover:bg-slate-200">
                    {item.number}
                  </div>
                  <Icon className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition flex-shrink-0" />
                  <span className="truncate font-semibold text-left text-xs">{item.name}</span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition shrink-0" />
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile User Profile & Logout Footer */}
        <div className="lg:hidden p-3 border-t border-slate-200 bg-slate-50/90">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#0F2744] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-900 block truncate leading-tight">
                  {user?.name || 'Pengguna'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block truncate">
                  {user?.role === 'supervisor' ? 'Supervisor QA' : user?.role === 'quality_assurance' ? 'QA Evaluator' : user?.role === 'team_leader' ? 'Team Leader' : 'User'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 transition shadow-2xs cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
