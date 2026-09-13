import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  TrendingUp,
  BarChart3,
  Users,
  Award,
  ClipboardCheck,
  Zap,
  Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileNav = () => {
  const { user } = useAuth();
  const isQA = user?.role === 'quality_assurance';
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';

  let items = [
    { to: '/', label: 'Hub', icon: LayoutGrid },
    { to: '/dashboard-global', label: 'Global', icon: TrendingUp },
    { to: '/anev', label: 'Anev', icon: BarChart3 },
    { to: '/rekap-agent', label: 'Rekap', icon: Users },
    { to: '/pencapaian-qa', label: 'Tim QA', icon: Award },
  ];

  if (isQA) {
    items = [
      { to: '/', label: 'Hub', icon: LayoutGrid },
      { to: '/evaluasi-sampling', label: 'Sampling', icon: ClipboardCheck },
      { to: '/dashboard-global', label: 'Global', icon: TrendingUp },
      { to: '/rekap-agent', label: 'Rekap', icon: Users },
      { to: '/pencapaian-qa', label: 'Tim QA', icon: Award },
    ];
  } else if (isSupervisor) {
    items = [
      { to: '/', label: 'Hub', icon: LayoutGrid },
      { to: '/auto-distribution', label: 'Distribusi', icon: Zap },
      { to: '/evaluasi-sampling', label: 'Monitoring', icon: ClipboardCheck },
      { to: '/dashboard-global', label: 'Global', icon: TrendingUp },
      { to: '/settings', label: 'Setting', icon: SettingsIcon },
    ];
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 h-[66px] pb-[calc(env(safe-area-inset-bottom)+6px)] flex items-center shadow-[0_-4px_20px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-center justify-between w-full max-w-md mx-auto gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 relative select-none touch-manipulation min-h-[48px] ${isActive
                  ? 'bg-[#0F2744] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 transition-all ${isActive
                        ? 'text-white stroke-[2.5]'
                        : 'text-slate-600 stroke-[2]'
                      }`}
                  />
                  <span
                    className={`text-[10px] leading-tight tracking-tight truncate ${isActive ? 'font-bold text-white' : 'font-medium text-slate-700'
                      }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
