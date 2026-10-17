import React, { useState, useEffect } from 'react';
import { 
  Bell, Cloud, RefreshCw, Wifi, WifiOff, ChevronRight, Database 
} from 'lucide-react';
import { UserAccount } from '../types/dental';
import { toPersianDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  currentUser?: UserAccount;
  unreadRemindersCount?: number;
  onBack?: () => void;
  onOpenProfile?: () => void;
  onOpenReminders?: () => void;
  onTriggerSync?: () => Promise<boolean>;
  onOpenSupabaseTest?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  currentUser,
  unreadRemindersCount = 2,
  onBack,
  onOpenProfile,
  onOpenReminders,
  onTriggerSync,
  onOpenSupabaseTest
}) => {
  const { impactLight, impactMedium, selection } = useHapticFeedback();

  // Live clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'success' | 'error' | 'idle'>('idle');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      setCurrentTime(timeStr);
    };

    updateClock();
    const clockTimer = setInterval(updateClock, 1000);

    // Online / Offline listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
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
        throw new Error('دستگاه به اینترنت متصل نیست');
      }

      let success = true;
      if (onTriggerSync) {
        success = await onTriggerSync();
      } else {
        await new Promise(res => setTimeout(res, 800));
      }

      if (success) {
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
    } catch {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3500);
    }
  };

  const roleLabel = 
    currentUser?.role === 'admin' ? 'مدیر' :
    currentUser?.role === 'doctor' ? 'پزشک' :
    currentUser?.role === 'secretary' ? 'منشی' : 'حسابدار';

  return (
    <div className="relative w-full px-2.5 py-2 flex items-center justify-between z-30 select-none border-b border-slate-200/70 bg-white/85 backdrop-blur-md text-slate-800">
      
      {/* Right Side (RTL Start): Logo + MinaDental Title + Compact Role Pill */}
      <div className="flex items-center gap-1.5 shrink-0">
        {showBack && (
          <button
            onClick={() => {
              impactLight();
              onBack?.();
            }}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 shrink-0"
            aria-label="بازگشت"
          >
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </button>
        )}

        {/* Dental Tooth Logo Mark */}
        <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-xs shrink-0">
          <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8 2 6 5 6 9c0 5 3 9 4.5 11 .7.9 1 .9 1.5 0C13.5 18 18 14 18 9c0-4-2-7-6-7Z" />
            <circle cx="12" cy="9" r="2" fill="#059669" />
          </svg>
        </div>

        {/* App Title */}
        <span className="text-sm font-black text-slate-900 tracking-tight shrink-0">
          مینادنتال
        </span>

        {/* Active Role Pill */}
        {currentUser && (
          <button
            onClick={() => {
              selection();
              onOpenProfile?.();
            }}
            className="text-[10px] text-emerald-950 font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300/60 active:scale-95 transition-all shadow-2xs shrink-0"
            title="تغییر کاربر و سطح دسترسی"
          >
            {roleLabel}
          </button>
        )}

        {title && (
          <span className="text-[10px] text-slate-500 font-bold truncate max-w-[80px] hidden sm:inline">
            {title}
          </span>
        )}
      </div>

      {/* Left Side: Live Persian Clock + Network Status + Cloud Auto-Sync Refresh + Bell */}
      <div className="flex items-center gap-1.5 shrink-0">
        
        {/* Live Clock */}
        <div className="text-[11px] font-bold text-slate-700 font-mono tracking-tight px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 shrink-0">
          {currentTime || '۱۲:۰۰'}
        </div>

        {/* Network Online / Offline Status */}
        <div 
          className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0"
          title={isOnline ? 'شبکه متصل و آنلاین' : 'آفلاین - عدم اتصال'}
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 stroke-[2.5] text-emerald-600" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          )}
        </div>

        {/* Cloud Sync Refresh Button */}
        <button
          onClick={() => {
            impactMedium();
            handleManualSync();
          }}
          disabled={isSyncing}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
            syncStatus === 'error'
              ? 'bg-red-50 border-red-300 text-red-600'
              : syncStatus === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
              : 'bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
          title="همگام‌سازی ابری و رفرش"
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Supabase Live Cloud DB & Test Suite Trigger */}
        <button
          onClick={() => {
            impactLight();
            onOpenSupabaseTest?.();
          }}
          className="relative w-7 h-7 rounded-full bg-emerald-50 border border-emerald-300/80 hover:border-emerald-400 text-emerald-700 flex items-center justify-center transition-all active:scale-95 shadow-2xs shrink-0"
          title="اتصال و تست زنده سوپابیس"
        >
          <Database className="w-3.5 h-3.5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
        </button>

        {/* Reminder Bell with Badge */}
        <button
          onClick={() => {
            impactLight();
            onOpenReminders?.();
          }}
          className="relative w-8 h-8 rounded-full bg-slate-100/90 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-2xs"
          title="یادآوری‌ها و هشدارها"
        >
          <Bell className={`w-4 h-4 stroke-[2.2] ${unreadRemindersCount > 0 ? 'animate-bell-ring text-emerald-700' : ''}`} />
          {unreadRemindersCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white font-extrabold text-[8.5px] rounded-full flex items-center justify-center border border-white font-mono shadow-xs">
              {toPersianDigits(unreadRemindersCount)}
            </span>
          )}
        </button>

      </div>
    </div>
  );
};
