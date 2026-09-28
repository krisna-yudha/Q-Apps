import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('digiqa_desktop_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('digiqa_desktop_sidebar_open', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle desktop sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleDesktopSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-800 flex flex-col font-sans antialiased w-full">
      {/* Top Header */}
      <Navbar
        toggleMobileSidebar={() => setMobileOpen(!mobileOpen)}
        desktopSidebarOpen={desktopSidebarOpen}
        toggleDesktopSidebar={toggleDesktopSidebar}
      />

      <div className="flex-1 flex w-full relative overflow-x-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          mobileOpen={mobileOpen}
          closeMobileSidebar={() => setMobileOpen(false)}
          desktopSidebarOpen={desktopSidebarOpen}
          toggleDesktopSidebar={toggleDesktopSidebar}
        />

        {/* Main Content Area */}
        <main
          className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${
            desktopSidebarOpen ? 'lg:pl-64' : 'lg:pl-[68px]'
          } w-full flex flex-col items-center`}
        >
          <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-36 lg:pb-8 transition-all duration-300">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom Nav for Mobile */}
      <MobileNav />
    </div>
  );
};

