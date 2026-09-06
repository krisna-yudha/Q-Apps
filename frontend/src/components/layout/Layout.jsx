import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-800 flex flex-col font-sans antialiased w-full">
      {/* Top Header */}
      <Navbar toggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />

      <div className="flex-1 flex w-full relative">
        {/* Sidebar Navigation */}
        <Sidebar
          mobileOpen={mobileOpen}
          closeMobileSidebar={() => setMobileOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 lg:ml-64 px-4 sm:px-6 lg:px-8 py-6 pb-36 lg:pb-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Bottom Nav for Mobile */}
      <MobileNav />
    </div>
  );
};
