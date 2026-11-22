import React, { useState } from 'react';
import {
  Eye, EyeOff, Calendar, Layers, UserPlus,
  FlaskConical, Activity, CreditCard, ShieldCheck
} from 'lucide-react';
import { toPersianDigits, formatToman } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ClinicHeroCardProps {
  onQuickAdmission: () => void;
  onOpenPalmerChart: () => void;
  onOpenAppointments: () => void;
  onOpenFinancial?: () => void;
  onOpenImplant?: () => void;
  onOpenLab?: () => void;
  onOpenSupabaseTest?: () => void;
  onOpenShiftSettings?: () => void;
  onOpenPhaseAudit?: () => void;
  onOpenRealClinicTest?: () => void;
  todayAppointmentsCount?: number;
  activeSurgeriesCount?: number;
  readyLabOrdersCount?: number;
  dailyRevenue?: number;
  activeChecksAndInstallmentsCount?: number;
  guaranteeStatusLabel?: string;
}

export const ClinicHeroCard: React.FC<ClinicHeroCardProps> = ({
  onQuickAdmission,
  onOpenPalmerChart,
  onOpenAppointments,
  onOpenFinancial,
  onOpenImplant,
  onOpenLab,
  todayAppointmentsCount = 12,
  activeSurgeriesCount = 4,
  readyLabOrdersCount = 3,
  dailyRevenue = 38500000,
  activeChecksAndInstallmentsCount = 2,
  guaranteeStatusLabel = 'در جریان وصول'
}) => {
  const { impactLight, impactHeavy, selection } = useHapticFeedback();
  const [showRevenue, setShowRevenue] = useState(true);
  const [period, setPeriod] = useState<'today' | 'month'>('today');

  const currentAmount = period === 'today' ? dailyRevenue : dailyRevenue * 26;

  return (
    <section
      aria-label="مرکز فرماندهی کلینیک"
      className="w-full max-w-full min-w-0 relative select-none rounded-[18px] bg-gradient-to-br from-white via-slate-50/90 to-sky-50/50 p-2.5 sm:p-3 text-slate-900 border border-slate-200/90 shadow-[var(--shadow-card)] overflow-hidden"
    >
      {/* Top Identity Row: Clinician Credentials + Compact Revenue Control */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-[10px] bg-emerald-50 border border-emerald-200/90 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex flex-col text-right min-w-0">
            <h2 className="text-[12px] sm:text-[13.5px] font-black text-slate-950 tracking-tight truncate">
              دکتر مهدی امیری · مدیر کلینیک
            </h2>
            <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-600 leading-snug tabular-nums truncate">
              نظام پزشکی: ۱۸۴۹۲ · یونیت آبی فعال
            </span>
          </div>
        </div>

        {/* Revenue Toggle & Privacy Control */}
        <div className="flex items-center gap-1 bg-emerald-50/90 border border-emerald-200/90 p-0.5 rounded-[10px] shrink-0 max-w-full">
          <button
            type="button"
            onClick={() => {
              selection();
              setPeriod(period === 'today' ? 'month' : 'today');
            }}
            className="min-h-[28px] px-2 rounded-lg bg-white text-[10px] font-black text-emerald-950 border border-emerald-200/80 cursor-pointer transition-colors hover:bg-emerald-100/60"
            title="تغییر بازه زمانی (امروز / ماه جاری)"
          >
            {period === 'today' ? 'امروز' : 'ماه'}
          </button>

          <button
            type="button"
            onClick={() => {
              impactLight();
              onOpenFinancial?.();
            }}
            className="min-h-[28px] text-[11px] sm:text-[11.5px] font-black text-emerald-950 font-mono tabular-nums px-1.5 cursor-pointer truncate max-w-[130px] sm:max-w-none"
            title="مشاهده جزئیات مالی"
          >
            {showRevenue ? formatToman(currentAmount) : '•••••••'}
          </button>

          <button
            type="button"
            onClick={() => {
              selection();
              setShowRevenue(!showRevenue);
            }}
            className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-emerald-800 hover:bg-emerald-100/80 cursor-pointer transition-colors"
            title={showRevenue ? 'مخفی کردن مبلغ' : 'نمایش مبلغ'}
            aria-label={showRevenue ? 'مخفی کردن مبلغ' : 'نمایش مبلغ'}
          >
            {showRevenue ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-rose-600" />}
          </button>
        </div>
      </div>

      {/* Middle Vital Metrics Grid: Low-Height 2-Column Paired Cards like Q-Bank */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2 w-full min-w-0">
        <button
          type="button"
          onClick={() => {
            impactLight();
            onOpenAppointments();
          }}
          className="min-h-[52px] min-w-0 overflow-hidden flex items-center justify-between gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-[12px] bg-sky-50/85 hover:bg-sky-100/85 border border-sky-200/90 text-sky-950 active:scale-[0.98] transition-all cursor-pointer text-right"
          title="نوبت‌های فعال امروز"
        >
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold text-sky-900 truncate">
              <Calendar className="w-3 h-3 shrink-0 text-sky-600 stroke-[2.3]" />
              <span className="truncate">نوبت‌های امروز</span>
            </span>
            <span className="text-[9px] sm:text-[9.5px] font-medium text-sky-700 leading-none mt-0.5 truncate">
              فعال در تقویم
            </span>
          </div>
          <span className="text-[14px] sm:text-base font-black text-sky-950 font-mono tabular-nums leading-none shrink-0">
            {toPersianDigits(todayAppointmentsCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            impactLight();
            if (onOpenImplant) onOpenImplant();
            else onOpenPalmerChart();
          }}
          className="min-h-[52px] min-w-0 overflow-hidden flex items-center justify-between gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-[12px] bg-cyan-50/85 hover:bg-cyan-100/85 border border-cyan-200/90 text-cyan-950 active:scale-[0.98] transition-all cursor-pointer text-right"
          title="پرونده‌ها و مراحل جراحی ایمپلنت"
        >
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold text-cyan-900 truncate">
              <Activity className="w-3 h-3 shrink-0 text-cyan-600 stroke-[2.3]" />
              <span className="truncate">کاشت ایمپلنت</span>
            </span>
            <span className="text-[9px] sm:text-[9.5px] font-medium text-cyan-700 leading-none mt-0.5 truncate">
              مرحله فعال
            </span>
          </div>
          <span className="text-[14px] sm:text-base font-black text-cyan-950 font-mono tabular-nums leading-none shrink-0">
            {toPersianDigits(activeSurgeriesCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            impactLight();
            onOpenLab?.();
          }}
          className="min-h-[52px] min-w-0 overflow-hidden flex items-center justify-between gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-[12px] bg-purple-50/85 hover:bg-purple-100/85 border border-purple-200/90 text-purple-950 active:scale-[0.98] transition-all cursor-pointer text-right"
          title="سفارشات لابراتوار آماده تحویل"
        >
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold text-purple-900 truncate">
              <FlaskConical className="w-3 h-3 shrink-0 text-purple-600 stroke-[2.3]" />
              <span className="truncate">لابراتوار پروتز</span>
            </span>
            <span className="text-[9px] sm:text-[9.5px] font-medium text-purple-700 leading-none mt-0.5 truncate">
              آماده تحویل
            </span>
          </div>
          <span className="text-[14px] sm:text-base font-black text-purple-950 font-mono tabular-nums leading-none shrink-0">
            {toPersianDigits(readyLabOrdersCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            impactLight();
            onOpenFinancial?.();
          }}
          className="min-h-[52px] min-w-0 overflow-hidden flex items-center justify-between gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-[12px] bg-amber-50/85 hover:bg-amber-100/85 border border-amber-200/90 text-amber-950 active:scale-[0.98] transition-all cursor-pointer text-right"
          title="چک‌های صیادی و اقساط سررسید"
        >
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold text-amber-900 truncate">
              <CreditCard className="w-3 h-3 shrink-0 text-amber-600 stroke-[2.3]" />
              <span className="truncate">چک و اقساط</span>
            </span>
            <span className="text-[9px] sm:text-[9.5px] font-medium text-amber-700 leading-none mt-0.5 truncate">
              {guaranteeStatusLabel}
            </span>
          </div>
          <span className="text-[14px] sm:text-base font-black text-amber-950 font-mono tabular-nums leading-none shrink-0">
            {toPersianDigits(activeChecksAndInstallmentsCount)}
          </span>
        </button>
      </div>

      {/* Primary Workflow Quick Actions: >= 44px Touch Height */}
      <div className="pt-2 border-t border-slate-200/80 grid grid-cols-3 gap-1.5 sm:gap-2 w-full min-w-0">
        <button
          type="button"
          onClick={() => {
            impactHeavy();
            onQuickAdmission();
          }}
          className="min-h-[44px] min-w-0 overflow-hidden flex items-center justify-center gap-1 px-1.5 sm:px-2 rounded-[12px] bg-[#c8ff00] hover:bg-[#d5ff33] text-slate-950 text-[11px] sm:text-[12px] font-black border border-[#b4ea00] active:scale-[0.97] transition-all cursor-pointer"
          title="تشکیل پرونده و پذیرش سریع بیمار"
        >
          <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.4]" />
          <span className="truncate">پذیرش سریع</span>
        </button>

        <button
          type="button"
          onClick={() => {
            impactLight();
            onOpenPalmerChart();
          }}
          className="min-h-[44px] min-w-0 overflow-hidden flex items-center justify-center gap-1 px-1.5 sm:px-2 rounded-[12px] bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] sm:text-[12px] font-bold border border-cyan-700 active:scale-[0.97] transition-all cursor-pointer"
          title="چارت دندانی پالمر و ثبت درمان"
        >
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.2]" />
          <span className="truncate">چارت پالمر</span>
        </button>

        <button
          type="button"
          onClick={() => {
            impactLight();
            onOpenAppointments();
          }}
          className="min-h-[44px] min-w-0 overflow-hidden flex items-center justify-center gap-1 px-1.5 sm:px-2 rounded-[12px] bg-sky-50 hover:bg-sky-100 text-sky-950 text-[11px] sm:text-[12px] font-bold border border-sky-200 active:scale-[0.97] transition-all cursor-pointer"
          title="ثبت نوبت جدید در تقویم شمسی"
        >
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-sky-600 stroke-[2.2]" />
          <span className="truncate">نوبت‌دهی</span>
        </button>
      </div>
    </section>
  );
};


