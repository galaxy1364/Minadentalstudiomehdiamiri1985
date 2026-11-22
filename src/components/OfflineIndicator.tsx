import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { indexedDbService } from '../services/indexedDbService';
import { toPersianDigits } from '../utils/jalali';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(() => indexedDbService.getPendingSyncCountSync());
  const [justFlushedCount, setJustFlushedCount] = useState<number>(0);

  useEffect(() => {
    const refreshCount = () => {
      setPendingCount(indexedDbService.getPendingSyncCountSync());
    };

    const handleOutboxChanged = () => refreshCount();
    const handleFlushed = (e: Event) => {
      const detail = (e as CustomEvent<{ flushedCount?: number }>).detail;
      const count = detail?.flushedCount || 0;
      refreshCount();
      if (count > 0) {
        setJustFlushedCount(count);
        window.setTimeout(() => setJustFlushedCount(0), 4200);
      }
    };

    window.addEventListener('minadental:outbox-changed', handleOutboxChanged);
    window.addEventListener('minadental:outbox-flushed', handleFlushed);
    window.addEventListener('online', refreshCount);
    window.addEventListener('offline', refreshCount);
    return () => {
      window.removeEventListener('minadental:outbox-changed', handleOutboxChanged);
      window.removeEventListener('minadental:outbox-flushed', handleFlushed);
      window.removeEventListener('online', refreshCount);
      window.removeEventListener('offline', refreshCount);
    };
  }, []);

  if (isOnline && pendingCount === 0 && justFlushedCount === 0) return null;

  if (!isOnline) {
    return (
      <div
        dir="rtl"
        role="status"
        aria-live="polite"
        className="fixed bottom-20 left-3 z-50 flex items-center gap-2 rounded-2xl bg-amber-600 px-3 py-2 text-[11px] font-black text-white shadow-xl border border-amber-300/60"
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>
          حالت آفلاین فعال · داده‌ها در حافظه محلی ذخیره می‌شوند
          {pendingCount > 0 ? ` (${toPersianDigits(pendingCount)} تغییر در صف همگام‌سازی)` : ''}
        </span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div
        dir="rtl"
        role="status"
        aria-live="polite"
        className="fixed bottom-20 left-3 z-50 flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2 text-[11px] font-black text-white shadow-xl border border-sky-300/60"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span>در حال همگام‌سازی سریع {toPersianDigits(pendingCount)} تغییر آفلاین...</span>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-3 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-xl border border-emerald-300/60 animate-in fade-in"
    >
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      <span>{toPersianDigits(justFlushedCount)} تغییر آفلاین پس از اتصال فوراً سینک شد ✓</span>
    </div>
  );
};
