import React from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50/50 rounded-2xl border border-slate-200 m-4">
          <div className="corp-card p-8 max-w-md w-full text-center space-y-4 shadow-lg border-rose-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Terjadi Kesalahan Tampilan</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Halaman mengalami gangguan sesaat saat memuat komponen data. Silakan klik tombol di bawah untuk memuat ulang data.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] font-mono text-slate-700 text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Halaman</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <Home className="w-3.5 h-3.5 text-slate-600" />
                <span>Ke Beranda</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
