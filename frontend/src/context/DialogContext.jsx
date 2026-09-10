import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Info,
  Trash2,
  X
} from 'lucide-react';

const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
  // Modal state (for Confirm & Alert)
  const [dialogState, setDialogState] = useState(null);
  const dialogResolverRef = useRef(null);

  // Toast state (Centered toast notification)
  const [toastState, setToastState] = useState(null);
  const toastTimeoutRef = useRef(null);

  // --- Show Confirmation Dialog (returns Promise<boolean>) ---
  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;
      if (typeof options === 'string') {
        setDialogState({
          mode: 'confirm',
          title: 'Konfirmasi Tindakan',
          message: options,
          type: 'warning',
          confirmText: 'Ya, Lanjutkan',
          cancelText: 'Batal',
        });
      } else {
        setDialogState({
          mode: 'confirm',
          title: options.title || 'Konfirmasi Tindakan',
          message: options.message || '',
          type: options.type || 'warning', // 'warning', 'danger', 'info', 'question', 'success'
          confirmText: options.confirmText || 'Ya, Lanjutkan',
          cancelText: options.cancelText || 'Batal',
          details: options.details || null,
        });
      }
    });
  }, []);

  // --- Show Alert Dialog (returns Promise<void>) ---
  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;
      if (typeof options === 'string') {
        setDialogState({
          mode: 'alert',
          title: 'Informasi Sistem',
          message: options,
          type: 'info',
          okText: 'Mengerti',
        });
      } else {
        setDialogState({
          mode: 'alert',
          title: options.title || 'Informasi Sistem',
          message: options.message || '',
          type: options.type || 'info', // 'info', 'error', 'warning', 'success'
          okText: options.okText || 'Mengerti',
          details: options.details || null,
        });
      }
    });
  }, []);

  // --- Show Centered Toast Notification ---
  const showToast = useCallback((msg, type = 'success', duration = 3500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const text = typeof msg === 'string' ? msg : (msg?.text || msg?.message || 'Notifikasi');
    const toastType = typeof msg === 'object' && msg?.type ? msg.type : type;

    setToastState({ text, type: toastType });
    toastTimeoutRef.current = setTimeout(() => {
      setToastState(null);
    }, duration);
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastState(null);
  }, []);

  // Handlers for Modal
  const handleConfirm = () => {
    if (dialogResolverRef.current) {
      dialogResolverRef.current(true);
      dialogResolverRef.current = null;
    }
    setDialogState(null);
  };

  const handleCancel = () => {
    if (dialogResolverRef.current) {
      dialogResolverRef.current(false);
      dialogResolverRef.current = null;
    }
    setDialogState(null);
  };

  // Keyboard accessibility (Escape = cancel, Enter = confirm)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!dialogState) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  // Determine icon & color theme for dialog
  const getDialogTheme = (type) => {
    switch (type) {
      case 'danger':
      case 'error':
        return {
          icon: Trash2,
          iconBg: 'bg-red-50 text-red-600 border-red-200 ring-4 ring-red-50',
          btnConfirm: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 focus:ring-red-500',
          titleColor: 'text-slate-900',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-amber-50 text-amber-600 border-amber-200 ring-4 ring-amber-50',
          btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 focus:ring-amber-500',
          titleColor: 'text-slate-900',
        };
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-4 ring-emerald-50',
          btnConfirm: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 focus:ring-emerald-500',
          titleColor: 'text-slate-900',
        };
      case 'question':
        return {
          icon: HelpCircle,
          iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200 ring-4 ring-indigo-50',
          btnConfirm: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 focus:ring-indigo-500',
          titleColor: 'text-slate-900',
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconBg: 'bg-blue-50 text-blue-600 border-blue-200 ring-4 ring-blue-50',
          btnConfirm: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 focus:ring-blue-500',
          titleColor: 'text-slate-900',
        };
    }
  };

  const currentTheme = dialogState ? getDialogTheme(dialogState.type) : null;
  const DialogIcon = currentTheme?.icon || Info;

  return (
    <DialogContext.Provider
      value={{
        showConfirm,
        showAlert,
        showToast,
        confirm: showConfirm,
        alert: showAlert,
        toast: showToast,
      }}
    >
      {children}

      {/* --- CENTERED TOAST NOTIFICATION --- */}
      {toastState && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-md border border-slate-700 text-xs sm:text-sm font-medium">
            {toastState.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            ) : toastState.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            ) : toastState.type === 'info' ? (
              <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            )}
            <span className="flex-1 leading-snug break-words">{toastState.text}</span>
            <button
              onClick={closeToast}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- CENTERED MODAL DIALOG (CONFIRM / ALERT) --- */}
      {dialogState && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-150 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Body */}
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                {/* Type Icon */}
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 ${currentTheme.iconBg}`}>
                  <DialogIcon className="w-6 h-6" />
                </div>

                {/* Title & Message */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className={`text-base sm:text-lg font-bold ${currentTheme.titleColor}`}>
                    {dialogState.title}
                  </h3>
                  <div className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line break-words">
                    {dialogState.message}
                  </div>

                  {/* Optional Details Box */}
                  {dialogState.details && (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 max-h-32 overflow-y-auto">
                      {dialogState.details}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {dialogState.mode === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs sm:text-sm transition shadow-2xs"
                  >
                    {dialogState.cancelText}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={handleConfirm}
                    className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition ${currentTheme.btnConfirm}`}
                  >
                    {dialogState.confirmText}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirm}
                  className={`px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition ${currentTheme.btnConfirm}`}
                >
                  {dialogState.okText || 'Mengerti'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
