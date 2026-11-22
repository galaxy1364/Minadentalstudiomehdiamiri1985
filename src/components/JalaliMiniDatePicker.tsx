import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import {
  PERSIAN_MONTHS,
  formatPersianDateString,
  getCurrentPersianDate,
  getDaysInPersianMonth,
  getPersianDateParts,
  getPersianMonthStartWeekdayIndex,
  getPersianWeekdayName,
  isSamePersianDate,
  parsePersianDate,
  toPersianDigits,
  comparePersianDates,
  isPersianLeapYear
} from '../utils/jalali';
import { ClinicScheduleSettings } from '../types/dental';
import { getIranianDateOccasions } from '../utils/appointmentScheduling';

interface JalaliMiniDatePickerProps {
  value: string;
  onChange: (nextDatePersian: string) => void;
  minDate?: string;
  scheduleSettings?: ClinicScheduleSettings;
  compact?: boolean;
}

export const JalaliMiniDatePicker: React.FC<JalaliMiniDatePickerProps> = ({
  value,
  onChange,
  minDate,
  scheduleSettings,
  compact = false
}) => {
  const todayParts = getPersianDateParts();
  const parsed = parsePersianDate(value || todayParts.formatted);
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month); // 1..12

  useEffect(() => {
    if (!value) return;
    const p = parsePersianDate(value);
    if (p.year >= 1390 && p.month >= 1 && p.month <= 12) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  const daysCount = getDaysInPersianMonth(viewMonth, viewYear);
  const startOffset = getPersianMonthStartWeekdayIndex(viewYear, viewMonth);
  const todayStr = getCurrentPersianDate();

  const yearChoices = useMemo(() => {
    const base = Math.max(1400, Math.min(1412, todayParts.year));
    const list: number[] = [];
    for (let y = base - 3; y <= base + 6; y++) list.push(y);
    return list;
  }, [todayParts.year]);

  const activeDateStr = value || todayStr;
  const selectedOccasion = useMemo(
    () => getIranianDateOccasions(activeDateStr, scheduleSettings),
    [activeDateStr, scheduleSettings]
  );

  const handlePrevMonth = () => {
    if (viewMonth <= 1) {
      setViewMonth(12);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth >= 12) {
      setViewMonth(1);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border border-sky-200/90 bg-white ${compact ? 'p-2' : 'p-2.5'} space-y-2 shadow-2xs`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="ماه بعد در تقویم کوچک"
          className="min-w-[32px] min-h-[32px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 flex-wrap justify-center min-w-0">
          <CalendarIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <select
            aria-label="انتخاب ماه در تقویم"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 text-[11px] font-black text-slate-900 focus:outline-none focus:border-sky-500"
          >
            {PERSIAN_MONTHS.map((mName, idx) => (
              <option key={mName} value={idx + 1}>{mName}</option>
            ))}
          </select>
          <select
            aria-label="انتخاب سال در تقویم"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 text-[11px] font-mono font-black text-slate-900 focus:outline-none focus:border-sky-500"
          >
            {yearChoices.map((y) => (
              <option key={y} value={y}>{toPersianDigits(y)}</option>
            ))}
          </select>
          {isPersianLeapYear(viewYear) && (
            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
              کبیسه
            </span>
          )}
          {!isSamePersianDate(value, todayStr) && (
            <button
              type="button"
              onClick={() => onChange(todayStr)}
              className="px-1.5 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[9.5px] font-black cursor-pointer"
            >
              امروز
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="ماه قبل در تقویم کوچک"
          className="min-w-[32px] min-h-[32px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[9.5px] font-black text-slate-400">
        {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((w, idx) => (
          <span key={idx} className={idx === 6 ? 'text-rose-500' : ''}>
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }).map((_, emptyIdx) => (
          <div key={`mini-empty-${emptyIdx}`} aria-hidden="true" className="h-8" />
        ))}
        {Array.from({ length: daysCount }, (_, i) => i + 1).map(day => {
          const cellDate = formatPersianDateString(viewYear, viewMonth, day);
          const isSelected = isSamePersianDate(cellDate, value);
          const isToday = isSamePersianDate(cellDate, todayStr);
          const isBeforeMin = minDate ? comparePersianDates(cellDate, minDate) < 0 : false;
          const occasion = getIranianDateOccasions(cellDate, scheduleSettings);
          const weekdayName = getPersianWeekdayName(viewYear, viewMonth, day);

          return (
            <button
              key={day}
              type="button"
              disabled={isBeforeMin}
              title={
                occasion.reason
                  ? `${weekdayName} · ${occasion.reason} (${occasion.gregorian.formattedEn})`
                  : `${weekdayName} ${cellDate} · ${occasion.gregorian.formattedEn}`
              }
              onClick={() => onChange(cellDate)}
              className={`relative h-8 rounded-xl text-[11px] font-mono font-bold tabular-nums transition-all flex items-center justify-center ${
                isSelected
                  ? 'bg-sky-600 text-white font-black shadow-xs cursor-pointer'
                  : isBeforeMin
                  ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                  : isToday
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-400 font-black cursor-pointer hover:bg-emerald-100'
                  : occasion.isHoliday
                  ? 'bg-rose-50/80 text-rose-700 hover:bg-rose-100 cursor-pointer'
                  : 'bg-slate-50 hover:bg-sky-50 text-slate-800 cursor-pointer'
              }`}
            >
              <span>{toPersianDigits(day)}</span>
              {occasion.occasions.some(o => o.type === 'medical' || o.type === 'cultural') && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-amber-500 absolute bottom-1" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tri-Calendar & Occasion Preview Footer */}
      <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-1 text-[10px]">
        <div className="flex items-center justify-between gap-2 text-slate-600 font-bold flex-wrap">
          <span className="font-mono tabular-nums" dir="ltr">
            {selectedOccasion.gregorian.day} {selectedOccasion.gregorian.monthShortEn} {selectedOccasion.gregorian.year}
          </span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span className="text-indigo-700">{selectedOccasion.hijri.formatted}</span>
        </div>
        {selectedOccasion.reason && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-black ${
            selectedOccasion.isHoliday
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            <Sparkles className="w-3 h-3 shrink-0" />
            <span className="truncate">{selectedOccasion.reason}</span>
          </div>
        )}
      </div>
    </div>
  );
};
