import React, { useState, useEffect } from 'react';
import {
  Bell, Cloud, RefreshCw, WifiOff, ChevronRight,
  Search, User, PhoneIncoming
} from 'lucide-react';
import { UserAccount } from '../types/dental';
import { toPersianDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { Logo3DMainDentalTooth } from './ThreeDimensionalLogos';
import { stateSyncQueue } from '../utils/syncQueue';
import { PWAInstallButton } from './PWAInstallButton';
import type { LiveSyncStatusMeta } from '../services/clinicRealtimeClient';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  currentUser?: UserAccount;
  unreadRemindersCount?: number;
  liveSyncMeta?: LiveSyncStatusMeta;
  onBack?: () => void;
  onOpenProfile?: () => void;
  onOpenReminders?: () => void;
  onTriggerSync?: () => Promise<boolean>;
  onOpenSupabaseTest?: () => void;
  onSimulateIncomingCall?: () => void;
  onOpenAccessibility?: () => void;
  onOpenClinicalHud?: () => void;
  onOpenSearch?: () => void;
  onOpenPhaseAudit?: () => void;
  onOpenRealClinicTest?: () => void;
  onOpenProjectDownload?: () => void;
}

function formatCurrentPersianClock(): string {
  try {
    return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  currentUser,
  unreadRemindersCount = 2,
  liveSyncMeta,
  onBack,
  onOpenProfile,
  onOpenReminders,
  onTriggerSync,
  onOpenSearch,
  onSimulateIncomingCall
}) => {
  const {
    impactLight,
    impactMedium,
    selection,
    success: triggerSuccessHaptic,
    error: triggerErrorHaptic
  } = useHapticFeedback();

  const [currentTime, setCurrentTime] = useState<string>(() => formatCurrentPersianClock());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'success' | 'error' | 'idle'>('idle');
  const [lastCommitTime, setLastCommitTime] = useState<string>(
    () => stateSyncQueue.getLastCommitFormatted() || ''
  );

  useEffect(() => {
    const unsubscribeSync = stateSyncQueue.onCommit((ts: number) => {
      const formatted = new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      setLastCommitTime(formatted);
    });

    const handleCustomCommit = (e: CustomEvent<{ timestamp?: number | string }>) => {
      if (e.detail?.timestamp) {
        const formatted =
          typeof e.detail.timestamp === 'number'
            ? new Date(e.detail.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
            : String(e.detail.timestamp);
        setLastCommitTime(formatted);
      }
    };
    window.addEventListener('minadental:cloud-commit-success', handleCustomCommit as EventListener);

    const updateClock = () => setCurrentTime(formatCurrentPersianClock());
    updateClock();
    const clockTimer = setInterval(updateClock, 15000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeSync();
      window.removeEventListener('minadental:cloud-commit-success', handleCustomCommit as EventListener);
      clearInterval(clockTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      if (!isOnline) {
        throw new Error('offline');
      }

      const isSynced = onTriggerSync ? await onTriggerSync() : true;
      if (isSynced) {
        setSyncStatus('success');
        triggerSuccessHaptic();
      } else {
        setSyncStatus('error');
        triggerErrorHaptic();
      }
    } catch {
      setSyncStatus('error');
      triggerErrorHaptic();
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3500);
    }
  };

  const syncTooltip = !isOnline
    ? 'حالت آفلاین · ذخیره در حافظه محلی'
    : liveSyncMeta?.connectionState === 'connected'
    ? `همگام‌سازی زنده SSE متصل · ${toPersianDigits(liveSyncMeta.connectedClients)} دستگاه فعال · نسخه #${toPersianDigits(liveSyncMeta.revision)}`
    : lastCommitTime
    ? `همگام‌سازی ابری متصل · آخرین ثبت: ${toPersianDigits(lastCommitTime)}`
    : 'همگام‌سازی ابری متصل';

  return (
    <header className="AppHeader sticky top-0 z-30 w-full max-w-full min-w-0 overflow-hidden h-[52px] sm:h-[56px] px-2 sm:px-3.5 flex items-center justify-between gap-1.5 sm:gap-2 select-none border-b border-slate-200/80 bg-white/92 backdrop-blur-xl text-slate-900 shrink-0">
      {/* Right Side (RTL Start): Back + Logo + Brand Title + User Profile */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {showBack && (
          <button
            type="button"
            onClick={() => {
              impactLight();
              onBack?.();
            }}
            className="min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95 shrink-0 cursor-pointer"
            aria-label="بازگشت به داشبورد"
            title="بازگشت به داشبورد"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center justify-center shrink-0">
          <Logo3DMainDentalTooth size={32} />
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[14.5px] sm:text-[16.5px] font-black bg-gradient-to-l from-violet-700 via-purple-700 to-slate-900 bg-clip-text text-transparent tracking-tight truncate">
            مینادنتال
          </span>
          {!title && (
            <span className="text-[9px] font-bold text-slate-500 hidden md:block truncate">
              مدیریت هوشمند کلینیک دندانپزشکی
            </span>
          )}
        </div>

        {title && (
          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/70 truncate max-w-[110px] hidden sm:inline">
            {title}
          </span>
        )}
      </div>

      {/* Left Side (RTL End): User Switcher + Search + Clock + Cloud Sync + Swinging Bell */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {currentUser && (
          <button
            type="button"
            onClick={() => {
              selection();
              onOpenProfile?.();
            }}
            className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center gap-1.5 px-1.5 sm:px-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-purple-950 active:scale-95 transition-colors shrink-0 cursor-pointer"
            title={`کاربر: ${currentUser.fullName} (${currentUser.role}) · کلیک برای پروفایل، سوئیچ یا خروج`}
            aria-label={`حساب کاربری ${currentUser.fullName}`}
          >
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 stroke-[2.4]" />
            </span>
            <span className="text-[11px] font-bold truncate max-w-[68px] hidden sm:inline">
              {currentUser.fullName.split(' ')[0]}
            </span>
          </button>
        )}

          <PWAInstallButton compact />

          {onSimulateIncomingCall && (
            <button
              type="button"
              onClick={() => {
                impactLight();
                onSimulateIncomingCall();
              }}
              className="hidden sm:flex min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-700 items-center justify-center transition-colors active:scale-95 shrink-0 cursor-pointer"
              title="کالرآیدی هوشمند و تست تماس ورودی"
              aria-label="کالرآیدی و تماس ورودی"
            >
              <PhoneIncoming className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              impactLight();
              if (onOpenSearch) onOpenSearch();
              else window.dispatchEvent(new CustomEvent('minadental:focus-patient-search'));
            }}
          className="min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-slate-100/90 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 flex items-center justify-center transition-colors active:scale-95 shrink-0 cursor-pointer"
          title="جستجوی سریع پرونده بیمار"
          aria-label="جستجوی بیمار"
        >
          <Search className="w-4 h-4 stroke-[2.2]" />
        </button>

        <div
          className="hidden sm:flex items-center text-[11.5px] font-bold text-slate-700 font-mono tabular-nums px-2 py-1 rounded-lg bg-slate-100/80 border border-slate-200/70 shrink-0"
          aria-label="ساعت فعلی"
        >
          {currentTime}
        </div>

        <button
          type="button"
          onClick={() => {
            impactMedium();
            handleManualSync();
          }}
          disabled={isSyncing}
          className={`relative min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl border flex items-center justify-center transition-colors active:scale-95 shrink-0 cursor-pointer ${
            syncStatus === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-600'
              : syncStatus === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-slate-100/90 border-slate-200/80 hover:border-slate-300 text-slate-700'
          }`}
          title={syncTooltip}
          aria-label={syncTooltip}
        >
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : isOnline ? (
            <Cloud className="w-4 h-4 text-emerald-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-rose-600" />
          )}
          {isOnline && liveSyncMeta?.connectionState === 'connected' && !isSyncing && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"
              aria-hidden="true"
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            impactLight();
            onOpenReminders?.();
          }}
          className="relative min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[1.5px] hover:brightness-105 active:scale-95 transition-transform shrink-0 cursor-pointer"
          title="یادآوری‌ها و اعلان‌ها"
          aria-label={`یادآوری‌ها و اعلان‌ها (${toPersianDigits(unreadRemindersCount)} مورد)`}
        >
          <span className="w-full h-full rounded-[10px] bg-gradient-to-br from-violet-700 to-purple-900 flex items-center justify-center text-amber-300 px-1.5 sm:px-2">
            <Bell
              className={`w-4 h-4 stroke-[2.3] text-amber-300 ${
                unreadRemindersCount > 0 ? 'animate-bell-ring' : ''
              }`}
            />
          </span>
          {unreadRemindersCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white font-extrabold text-[9.5px] rounded-full flex items-center justify-center border-2 border-white font-mono tabular-nums shadow-xs">
              {toPersianDigits(unreadRemindersCount)}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
