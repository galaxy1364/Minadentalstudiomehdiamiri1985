import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { appendSecurityAuditLog } from '../utils/dataProtection';
import { isDynamicImportError, purgeStaleModuleCaches } from '../utils/lazyWithRetry';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  onResetToHome?: () => void;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Module-scoped React ErrorBoundary preventing single-view runtime exceptions
 * from crashing the entire clinical application shell.
 */
export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: ''
    };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'خطای پیش‌بینی‌نشده در اجرای ماژول'
    };
  }

  componentDidCatch(error: Error) {
    appendSecurityAuditLog({
      actor: 'System ErrorBoundary',
      role: 'system',
      action: `خطای ایزوله‌شده در ماژول «${this.props.moduleName}»`,
      details: error?.message || 'Unknown module exception',
      severity: 'warning'
    });
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps) {
    if (prevProps.moduleName !== this.props.moduleName && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  private handleRetryModule = async () => {
    if (isDynamicImportError(this.state.errorMessage)) {
      await purgeStaleModuleCaches();
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="mx-3 my-6 p-5 rounded-[24px] bg-white/95 border-2 border-rose-200 shadow-lg text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-900">
            خطای ایمنی در بخش «{this.props.moduleName}» مهار شد
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            اطلاعات پرونده بیماران و تراکنش‌ها کاملاً سالم و ذخیره هستند. برای جلوگیری از اختلال سایر بخش‌ها، فقط این نما متوقف شد.
          </p>
          <div className="text-[10px] font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl inline-block max-w-full truncate" dir="ltr">
            {this.state.errorMessage}
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleRetryModule}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>بارگذاری مجدد بخش</span>
            </button>
            {this.props.onResetToHome && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  this.props.onResetToHome?.();
                }}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>بازگشت به داشبورد</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
