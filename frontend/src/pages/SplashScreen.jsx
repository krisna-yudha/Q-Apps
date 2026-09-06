import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  ClipboardCheck,
  Gauge
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const SplashScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Run health check in background silently
    api.checkHealth().catch(() => { });

    // Splash duration: 3.0s display + 0.4s smooth fade out
    const displayDuration = 3000;

    timerRef.current = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        if (isAuthenticated) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }, 400);
    }, displayDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, navigate]);

  return (
    <div
      className={`min-h-screen w-full bg-[#F8FAFC] text-slate-800 flex flex-col justify-between items-center px-4 py-6 sm:py-8 relative overflow-hidden select-none transition-all duration-500 ease-in-out ${fadeOut ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100 animate-in fade-in duration-700'
        }`}
    >
      {/* Subtle Radial Gradient Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background: 'radial-gradient(circle at 50% 45%, #FFFFFF 0%, #F1F5F9 55%, #E2E8F0 100%)'
        }}
      />

      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between z-10 text-[10px] xs:text-[11px] text-slate-500 font-medium px-1">
        <span className="flex items-center gap-1.5 font-semibold text-slate-700 truncate">
          <span className="w-2 h-2 rounded-full bg-[#008EA6] animate-ping flex-shrink-0" />
          <span className="truncate">Qapps Contact Center QA</span>
        </span>
        <span className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-full border border-slate-200 text-[9px] xs:text-[10px] font-bold text-slate-600 shadow-2xs flex-shrink-0 ml-2">
          v1.1 Enterprise
        </span>
      </div>

      {/* Main Center Area: Pure Clean Qapps Splash Artwork */}
      <div className="flex flex-col items-center justify-center text-center w-full max-w-xs xs:max-w-sm sm:max-w-md z-10 my-auto relative px-2">

        {/* Background Network Rings / Process Nodes (Matching Reference splash.jpg) */}
        <div className="relative w-full flex items-center justify-center my-2 sm:my-3">
          {/* Circular Orbiting Rings Background SVG */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-45">
            <svg
              viewBox="0 0 400 400"
              className="w-full max-w-[260px] xs:max-w-[300px] sm:max-w-[360px] h-auto aspect-square"
            >
              {/* Outer Loop Rings */}
              <circle cx="200" cy="75" r="46" fill="none" stroke="#CBD5E1" strokeWidth="3.5" strokeDasharray="8 6" />
              <circle cx="310" cy="138" r="46" fill="none" stroke="#CBD5E1" strokeWidth="3.5" />
              <circle cx="310" cy="262" r="46" fill="none" stroke="#CBD5E1" strokeWidth="3.5" />
              <circle cx="200" cy="325" r="46" fill="none" stroke="#CBD5E1" strokeWidth="3.5" />
              <circle cx="90" cy="262" r="46" fill="none" stroke="#CBD5E1" strokeWidth="3.5" />
              <circle cx="90" cy="138" r="46" fill="none" stroke="#CBD5E1" strokeWidth="3.5" />
              {/* Connecting Loop Lines */}
              <polygon points="200,75 310,138 310,262 200,325 90,262 90,138" fill="none" stroke="#E2E8F0" strokeWidth="5" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Central Logo & Branding Unit (Icon Squircle + 'Qapps' Typography) */}
          <div className="relative z-10 flex items-center justify-center gap-2.5 xs:gap-3.5 sm:gap-5 py-4 sm:py-6 px-2 max-w-full">
            {/* 3D App Icon Squircle */}
            <div className="relative w-14 h-14 xs:w-18 xs:h-18 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl xs:rounded-2xl sm:rounded-3xl bg-white p-2 xs:p-2.5 sm:p-3 shadow-[0_12px_28px_-6px_rgba(15,39,68,0.22),0_4px_12px_-2px_rgba(0,0,0,0.08)] border-2 border-slate-200/90 flex items-center justify-center flex-shrink-0 transition-transform duration-500 hover:scale-105">
              {/* Bevel Inner Highlight */}
              <div className="absolute inset-0.5 rounded-[10px] xs:rounded-[14px] sm:rounded-[20px] border border-white pointer-events-none" />

              {/* Icon SVG: Letter Q with Teal Signal Arcs */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* 3 Signal Arcs in Teal (#008EA6) */}
                <path d="M 6 36 A 46 46 0 0 1 48 8" fill="none" stroke="#008EA6" strokeWidth="7.5" strokeLinecap="round" />
                <path d="M 17 38 A 32 32 0 0 1 48 20" fill="none" stroke="#008EA6" strokeWidth="6.5" strokeLinecap="round" />
                <circle cx="48" cy="48" r="5.5" fill="#008EA6" />

                {/* Navy Letter Q */}
                <path
                  d="M 50 28 A 34 34 0 1 0 76 84 L 92 100 L 98 94 L 83 79 A 34 34 0 0 0 50 28 Z M 50 42 A 20 20 0 1 1 30 62 A 20 20 0 0 1 50 42 Z"
                  fill="#122448"
                  fillRule="evenodd"
                />
              </svg>
            </div>

            {/* Typography: 'Q' (Navy) + 'apps' (Teal) */}
            <div className="flex items-baseline tracking-tight font-sans min-w-0">
              <span className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-black text-[#122448] leading-none">
                Q
              </span>
              <span className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-black text-[#008EA6] leading-none -ml-0.5">
                apps
              </span>
            </div>
          </div>
        </div>

        {/* Process Indicators (Quality, Assurance, Standard) */}
        <div className="flex items-center justify-center gap-4 xs:gap-6 sm:gap-8 my-3 sm:my-4 z-10 text-[9px] xs:text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">
          <div className="flex flex-col items-center gap-1 sm:gap-1.5">
            <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-400">
              <Settings className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span>Quality</span>
          </div>

          <div className="flex flex-col items-center gap-1 sm:gap-1.5">
            <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-400">
              <ClipboardCheck className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span>Assurance</span>
          </div>

          <div className="flex flex-col items-center gap-1 sm:gap-1.5">
            <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-400">
              <Gauge className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span>Standard</span>
          </div>
        </div>

      </div>

      {/* Bottom Footer (Matching Reference splash.jpg) */}
      <div className="w-full max-w-md text-center z-10 px-2">
        <p className="text-[9px] xs:text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-500 uppercase">
          Application Branding &amp; Icon | <strong className="text-[#122448]">QAPPS</strong>
        </p>
      </div>
    </div>
  );
};
