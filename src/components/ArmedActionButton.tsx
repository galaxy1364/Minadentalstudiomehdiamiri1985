import React, { useState, useEffect, useRef } from 'react';
import { Check, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { useActionFeedback, actionFeedback } from '../utils/actionFeedback';

interface ArmedActionButtonProps {
  onConfirm: () => void;
  label: string;
  confirmLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  armedClassName?: string;
  requireArming?: boolean;
  title?: string;
  disabled?: boolean;
}

export const ArmedActionButton: React.FC<ArmedActionButtonProps> = ({
  onConfirm,
  label,
  confirmLabel = 'تایید؟ دوباره بزنید ✓',
  icon,
  className = '',
  armedClassName = 'bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500 ring-2 ring-amber-300/70 shadow-md scale-[1.02]',
  requireArming = true,
  title,
  disabled = false
}) => {
  const [armed, setArmed] = useState(false);
  const [justExecuted, setJustExecuted] = useState(false);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || lockRef.current) return;

    const shouldArm = requireArming && actionFeedback.isSafetyLockEnabled();

    if (shouldArm && !armed) {
      triggerHaptic('warning');
      setArmed(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setArmed(false);
      }, 3500);
      return;
    }

    // Execute confirmed action with double-click lock
    if (timerRef.current) clearTimeout(timerRef.current);
    setArmed(false);
    lockRef.current = true;
    setJustExecuted(true);
    triggerHaptic('success');
    onConfirm();

    setTimeout(() => {
      lockRef.current = false;
      setJustExecuted(false);
    }, 900);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title={armed ? 'برای ثبت قطعی یک بار دیگر کلیک کنید' : title}
      className={`transition-all duration-200 cursor-pointer select-none flex items-center justify-center gap-1 active:scale-95 ${
        justExecuted
          ? 'bg-emerald-600 text-white border border-emerald-500 px-2.5 py-1 rounded-lg font-black text-[10.5px] shadow-xs'
          : armed
            ? `px-2.5 py-1 rounded-lg font-black text-[10.5px] animate-pulse ${armedClassName}`
            : className
      }`}
    >
      {justExecuted ? (
        <>
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>ثبت شد ✓</span>
        </>
      ) : armed ? (
        <>
          <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
          <span>{confirmLabel}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

export const CardMutationBadge: React.FC<{ recordId?: string }> = ({ recordId }) => {
  const { getCardFeedbackBadge } = useActionFeedback();
  const badge = getCardFeedbackBadge(recordId);

  if (!badge) return null;

  const isConflict = badge.type === 'conflict' || badge.type === 'error';

  return (
    <div
      className={`mt-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-black flex items-center justify-between gap-2 border animate-in fade-in zoom-in-95 duration-200 ${
        isConflict
          ? 'bg-rose-50 border-rose-300 text-rose-800'
          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {isConflict ? (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        )}
        <span className="truncate">{badge.badgeText}</span>
      </div>
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
          isConflict ? 'bg-rose-200/80 text-rose-900' : 'bg-emerald-200/80 text-emerald-950'
        }`}
      >
        {isConflict ? 'تداخل/خطا' : 'همین الان ✓'}
      </span>
    </div>
  );
};
