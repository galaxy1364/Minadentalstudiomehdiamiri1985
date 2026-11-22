import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  X,
  Lock,
  Unlock
} from 'lucide-react';
import { useActionFeedback, actionFeedback } from '../utils/actionFeedback';
import { undoManager } from '../utils/undoManager';
import { triggerHaptic } from '../utils/haptics';

export const ActionVerificationHud: React.FC = () => {
  const { activeEvent, safetyLockEnabled, setSafetyLockEnabled, dismiss } = useActionFeedback();

  if (!activeEvent) return null;

  const isConflict = activeEvent.status === 'conflict';
  const isError = activeEvent.status === 'error';
  const isVerified = activeEvent.status === 'verified';

  const handleQuickUndo = async () => {
    triggerHaptic('warning');
    const ok = await undoManager.executeUndo();
    if (ok) {
      actionFeedback.recordSuccess({
        title: 'تغییر با موفقیت بازگردانی شد',
        subtitle: 'وضعیت به حالت قبل از کلیک بازگشت',
        canUndo: false
      });
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed top-13 inset-x-2.5 z-[60] flex justify-center pointer-events-none"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`pointer-events-auto w-full max-w-[460px] rounded-[22px] p-3 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl border-2 transition-all duration-300 ${
          isConflict
            ? 'bg-gradient-to-r from-amber-50/98 via-white to-orange-50/98 border-amber-400 text-slate-900 ios27-conflict-shake'
            : isError
              ? 'bg-gradient-to-r from-rose-50/98 via-white to-red-50/98 border-rose-400 text-slate-900 ios27-conflict-shake'
              : 'bg-gradient-to-r from-emerald-50/98 via-white to-teal-50/98 border-emerald-400 text-slate-900 ios27-hud-enter'
        }`}
      >
        {/* Top Row: Status Icon + Title + Close */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${
                isConflict
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : isError
                    ? 'bg-rose-100 border-rose-300 text-rose-700'
                    : 'bg-emerald-100 border-emerald-300 text-emerald-700'
              }`}
            >
              {isConflict ? (
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              ) : isError ? (
                <XCircle className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <CheckCircle2 className="w-5 h-5 stroke-[2.6]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isConflict
                      ? 'bg-amber-200 text-amber-950'
                      : isError
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white'
                  }`}
                >
                  {isConflict ? (
                    <span>⚠️ هشدار تداخل</span>
                  ) : isError ? (
                    <span>⛔ خطای ثبت</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                      <span>ثبت قطعی و تایید شده</span>
                    </>
                  )}
                </span>
              </div>

              <h4 className="text-xs font-black text-slate-900 mt-1 leading-snug">
                {activeEvent.title}
              </h4>

              {activeEvent.subtitle && (
                <p className="text-[11px] text-slate-600 font-bold mt-0.5 leading-relaxed">
                  {activeEvent.subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              dismiss();
            }}
            className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-all"
            aria-label="بستن اعلان تایید"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Before -> After Visual Diff Strip */}
        {(activeEvent.diffBefore || activeEvent.diffAfter) && (
          <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-white/90 border border-slate-200/90 flex items-center justify-between gap-2 text-[10.5px]">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {activeEvent.diffBefore && (
                <>
                  <span className="text-slate-400 line-through truncate">
                    {activeEvent.diffBefore}
                  </span>
                  <ArrowLeft className="w-3 h-3 text-emerald-600 shrink-0" />
                </>
              )}
              {activeEvent.diffAfter && (
                <span className="font-black text-emerald-800 truncate">
                  {activeEvent.diffAfter}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Bar: Instant Undo / Accidental Click Guard Toggle */}
        <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setSafetyLockEnabled(!safetyLockEnabled);
            }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border transition-all cursor-pointer ${
              safetyLockEnabled
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
            title="فعال/غیرفعال‌سازی محافظ دو مرحله‌ای ضد کلیک اشتباهی"
          >
            {safetyLockEnabled ? (
              <>
                <Lock className="w-3 h-3 text-emerald-700" />
                <span>محافظ ۲ مرحله‌ای ضدخطا: فعال</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-slate-500" />
                <span>محافظ ۲ مرحله‌ای: غیرفعال</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            {activeEvent.resolutionAction && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  activeEvent.resolutionAction?.onClick();
                  dismiss();
                }}
                className="py-1 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <span>{activeEvent.resolutionAction.label}</span>
                <ArrowLeft className="w-3 h-3" />
              </button>
            )}

            {isVerified && activeEvent.canUndo && (
              <button
                type="button"
                onClick={handleQuickUndo}
                className="py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs"
                title="اگر اشتباهی کلیک کردید با یک لمس به حالت قبل برگردانید"
              >
                <RotateCcw className="w-3 h-3" />
                <span>واگرد سریع</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
