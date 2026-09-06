import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  TrendingUp,
  BarChart3,
  Users,
  Award,
  BookOpen
} from 'lucide-react';

export const MobileNav = () => {
  const items = [
    { to: '/', label: 'Hub', icon: LayoutGrid },
    { to: '/dashboard-global', label: 'Global', icon: TrendingUp },
    { to: '/anev', label: 'Anev', icon: BarChart3 },
    { to: '/rekap-agent', label: 'Rekap', icon: Users },
    { to: '/pencapaian-qa', label: 'Tim QA', icon: Award },
    { to: '/hasil-diskusi', label: 'Kebijakan', icon: BookOpen },
  ];

  return (
    <nav
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999 }}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-xl border-t-2 border-slate-200/90 px-2 py-1.5 h-[74px] flex items-center shadow-[0_-6px_28px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-center justify-between w-full max-w-2xl mx-auto gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-150 relative select-none ${
                  isActive
                    ? 'text-blue-900 font-extrabold bg-blue-50/90 border border-blue-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 active:scale-95'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-[26px] h-[26px] mb-1 transition-all ${
                      isActive
                        ? 'scale-110 text-blue-700 stroke-[2.4]'
                        : 'text-slate-500 stroke-[2]'
                    }`}
                  />
                  <span className={`text-[12px] leading-none tracking-tight truncate ${isActive ? 'font-black text-blue-950' : 'font-semibold text-slate-700'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-1 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-xs"></span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
