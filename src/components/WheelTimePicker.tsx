import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown, Sun, Sunset, Moon, Disc, SlidersHorizontal } from 'lucide-react';
import { toPersianDigits, toEnglishDigits, parseTimeMinutes } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';

export const CLINIC_HOURS_08_TO_23 = [
  '08', '09', '10', '11', '12', '13', '14', '15',
  '16', '17', '18', '19', '20', '21', '22', '23'
];

export const CLINIC_MINUTES_STEP_5 = [
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'
];

export const MORNING_SHIFT_SLOTS = [
  '۰۸:۰۰', '۰۸:۳۰', '۰۹:۰۰', '۰۹:۳۰', '۱۰:۰۰', '۱۰:۳۰',
  '۱۱:۰۰', '۱۱:۳۰', '۱۲:۰۰', '۱۲:۳۰', '۱۳:۰۰', '۱۳:۳۰'
];

export const AFTERNOON_SHIFT_SLOTS = [
  '۱۴:۰۰', '۱۴:۳۰', '۱۵:۰۰', '۱۵:۳۰', '۱۶:۰۰',
  '۱۶:۳۰', '۱۷:۰۰', '۱۷:۳۰', '۱۸:۰۰', '۱۸:۳۰'
];

export const NIGHT_SHIFT_SLOTS = [
  '۱۹:۰۰', '۱۹:۳۰', '۲۰:۰۰', '۲۰:۳۰',
  '۲۱:۰۰', '۲۱:۳۰', '۲۲:۰۰', '۲۲:۳۰', '۲۳:۰۰'
];

export const ALL_CLINIC_TIME_SLOTS = [
  ...MORNING_SHIFT_SLOTS,
  ...AFTERNOON_SHIFT_SLOTS,
  ...NIGHT_SHIFT_SLOTS
];

function parseHourMinute(rawTime: string): { hour: string; minute: string } {
  const clean = toEnglishDigits(rawTime || '17:00').trim();
  const match = clean.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return { hour: '17', minute: '00' };
  }
  const hNum = Math.min(23, Math.max(8, parseInt(match[1], 10) || 8));
  const mNum = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return {
    hour: String(hNum).padStart(2, '0'),
    minute: String(mNum).padStart(2, '0')
  };
}

function getShiftLabelForHour(hourStr: string): string {
  const h = parseInt(hourStr, 10);
  if (h < 12) return 'صبح';
  if (h < 14) return 'ظهر';
  if (h < 19) return 'عصر';
  return 'شب';
}

interface WheelTimePickerProps {
  value: string;
  onChange: (newTimePersian: string) => void;
  occupiedTimes?: Record<string, string>; // slot -> patientName
  blockedTimes?: Record<string, string>; // slot -> schedule/break reason
  unitName?: string;
  compact?: boolean;
}

export const WheelTimePicker: React.FC<WheelTimePickerProps> = ({
  value,
  onChange,
  occupiedTimes = {},
  blockedTimes = {},
  unitName,
  compact = false
}) => {
  const parsed = parseHourMinute(value);
  const initialHourNum = parseInt(parsed.hour, 10);
  const [activeShift, setActiveShift] = useState<'morning' | 'afternoon' | 'night'>(() => {
    if (initialHourNum < 14) return 'morning';
    if (initialHourNum < 19) return 'afternoon';
    return 'night';
  });
  const [pickerMode, setPickerMode] = useState<'dial_and_wheel' | 'wheel_only'>('dial_and_wheel');

  const hourWheelRef = useRef<HTMLDivElement | null>(null);
  const minuteWheelRef = useRef<HTMLDivElement | null>(null);
  const dialSvgRef = useRef<SVGSVGElement | null>(null);
  const isProgrammaticScroll = useRef(false);
  const isDraggingDial = useRef(false);

  const syncShiftWithHour = (hEng: string) => {
    const hNum = parseInt(hEng, 10);
    if (hNum < 14) setActiveShift('morning');
    else if (hNum < 19) setActiveShift('afternoon');
    else setActiveShift('night');
  };

  const emitTime = (hEng: string, mEng: string) => {
    syncShiftWithHour(hEng);
    const formatted = toPersianDigits(`${hEng}:${mEng}`);
    onChange(formatted);
  };

  // Sync wheel scroll positions when value changes externally
  useEffect(() => {
    const { hour, minute } = parseHourMinute(value);
    const hIdx = CLINIC_HOURS_08_TO_23.indexOf(hour);
    const mNearest = CLINIC_MINUTES_STEP_5.reduce((prev, curr) =>
      Math.abs(parseInt(curr, 10) - parseInt(minute, 10)) <
      Math.abs(parseInt(prev, 10) - parseInt(minute, 10))
        ? curr
        : prev
    );
    const mIdx = CLINIC_MINUTES_STEP_5.indexOf(mNearest);

    isProgrammaticScroll.current = true;
    const itemHeight = 36;
    if (hourWheelRef.current && hIdx >= 0) {
      hourWheelRef.current.scrollTop = hIdx * itemHeight;
    }
    if (minuteWheelRef.current && mIdx >= 0) {
      minuteWheelRef.current.scrollTop = mIdx * itemHeight;
    }
    const t = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 120);
    return () => clearTimeout(t);
  }, [value]);

  const stepHour = (delta: number) => {
    triggerHaptic('selection');
    const curIdx = Math.max(0, CLINIC_HOURS_08_TO_23.indexOf(parsed.hour));
    const nextIdx = (curIdx + delta + CLINIC_HOURS_08_TO_23.length) % CLINIC_HOURS_08_TO_23.length;
    const nextHour = CLINIC_HOURS_08_TO_23[nextIdx];
    emitTime(nextHour, parsed.minute);
  };

  const stepMinute = (delta: number) => {
    triggerHaptic('selection');
    const nearest = CLINIC_MINUTES_STEP_5.reduce((prev, curr) =>
      Math.abs(parseInt(curr, 10) - parseInt(parsed.minute, 10)) <
      Math.abs(parseInt(prev, 10) - parseInt(parsed.minute, 10))
        ? curr
        : prev
    );
    const curIdx = Math.max(0, CLINIC_MINUTES_STEP_5.indexOf(nearest));
    const nextIdx = (curIdx + delta + CLINIC_MINUTES_STEP_5.length) % CLINIC_MINUTES_STEP_5.length;
    emitTime(parsed.hour, CLINIC_MINUTES_STEP_5[nextIdx]);
  };

  const handleHourWheelScroll = () => {
    if (isProgrammaticScroll.current || !hourWheelRef.current) return;
    const idx = Math.round(hourWheelRef.current.scrollTop / 36);
    const clampedIdx = Math.max(0, Math.min(CLINIC_HOURS_08_TO_23.length - 1, idx));
    const targetHour = CLINIC_HOURS_08_TO_23[clampedIdx];
    if (targetHour && targetHour !== parsed.hour) {
      triggerHaptic('selection');
      emitTime(targetHour, parsed.minute);
    }
  };

  const handleMinuteWheelScroll = () => {
    if (isProgrammaticScroll.current || !minuteWheelRef.current) return;
    const idx = Math.round(minuteWheelRef.current.scrollTop / 36);
    const clampedIdx = Math.max(0, Math.min(CLINIC_MINUTES_STEP_5.length - 1, idx));
    const targetMin = CLINIC_MINUTES_STEP_5[clampedIdx];
    if (targetMin && targetMin !== parsed.minute) {
      triggerHaptic('selection');
      emitTime(parsed.hour, targetMin);
    }
  };

  // Interactive Rotary Clock Dial pointer calculation (08:00 to 23:00 arranged on 360° circle)
  const updateHourFromDialPointer = (clientX: number, clientY: number) => {
    if (!dialSvgRef.current) return;
    const rect = dialSvgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) return;
    // Angle from top (12 o'clock = 0 deg, clockwise)
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angleDeg < 0) angleDeg += 360;
    const totalHours = CLINIC_HOURS_08_TO_23.length; // 16 hours (08..23)
    const stepDeg = 360 / totalHours; // 22.5 deg per hour
    const idx = Math.round(angleDeg / stepDeg) % totalHours;
    const selectedHour = CLINIC_HOURS_08_TO_23[idx];
    if (selectedHour && selectedHour !== parsed.hour) {
      triggerHaptic('selection');
      emitTime(selectedHour, parsed.minute);
    }
  };

  const selectedHourIndex = Math.max(0, CLINIC_HOURS_08_TO_23.indexOf(parsed.hour));
  const dialRadius = 68;
  const dialCenter = 90;
  const activeAngleRad = ((selectedHourIndex * (360 / CLINIC_HOURS_08_TO_23.length) - 90) * Math.PI) / 180;
  const handTipX = dialCenter + dialRadius * Math.cos(activeAngleRad);
  const handTipY = dialCenter + dialRadius * Math.sin(activeAngleRad);

  const shiftSlots =
    activeShift === 'morning'
      ? MORNING_SHIFT_SLOTS
      : activeShift === 'afternoon'
        ? AFTERNOON_SHIFT_SLOTS
        : NIGHT_SHIFT_SLOTS;

  return (
    <div className="p-3 rounded-2xl bg-gradient-to-b from-sky-50/90 via-white to-indigo-50/50 border border-sky-200/90 space-y-3 shadow-2xs" dir="rtl">
      {/* Top Bar: Current Selected Time, Mode Toggle & Manual Input */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-2xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-black text-slate-900 block">
              کنترل چرخشی ساعت نوبت (Dial/Wheel · ۸ صبح تا ۱۱ شب)
            </span>
            <span className="text-[9.5px] font-bold text-sky-700">
              {unitName ? `${unitName} · ` : ''}ساعت انتخاب‌شده: {toPersianDigits(parsed.hour)}:{toPersianDigits(parsed.minute)} ({getShiftLabelForHour(parsed.hour)})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setPickerMode(prev => (prev === 'dial_and_wheel' ? 'wheel_only' : 'dial_and_wheel'));
            }}
            className="px-2 py-1 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-[9.5px] font-black flex items-center gap-1 transition-all cursor-pointer"
          >
            {pickerMode === 'dial_and_wheel' ? <Disc className="w-3 h-3 text-sky-700" /> : <SlidersHorizontal className="w-3 h-3 text-sky-700" />}
            <span>{pickerMode === 'dial_and_wheel' ? 'ساعت عقربه‌ای + عربیلکی' : 'نمایش ساعت عقربه‌ای'}</span>
          </button>

          <span className="text-[10px] font-bold text-slate-500">تایپ دستی:</span>
          <input
            aria-label="تایپ دستی ساعت نوبت"
            type="text"
            inputMode="numeric"
            value={value}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            onChange={(e) => onChange(e.target.value)}
            placeholder="۰۸:۳۰"
            className="w-20 bg-white border border-sky-300 rounded-xl px-2 py-1 text-center font-mono font-black text-xs text-slate-900 focus:outline-none focus:border-sky-600 shadow-2xs"
            dir="ltr"
          />
        </div>
      </div>

      {/* Rotary Clock Dial + Drum-Roller Wheel Picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        {/* 1. Interactive Visual Rotary Clock Dial (صفحه ساعت چرخشی بصری ۸ صبح تا ۱۱ شب) */}
        {pickerMode === 'dial_and_wheel' && (
          <div className="lg:col-span-4 bg-slate-950 text-white rounded-2xl p-2.5 border border-slate-800 shadow-inner flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-[9.5px] font-bold text-slate-300 mb-1 px-1">
              <span className="flex items-center gap-1 text-cyan-300">
                <Disc className="w-3 h-3" />
                دیال چرخشی (۸ تا ۲۳)
              </span>
              <span className="font-mono text-[#c8ff00] font-black">
                {toPersianDigits(parsed.hour)}:{toPersianDigits(parsed.minute)}
              </span>
            </div>

            <div className="relative flex items-center justify-center">
              <svg
                ref={dialSvgRef}
                viewBox="0 0 180 180"
                className="w-[168px] h-[168px] touch-none cursor-pointer select-none"
                onPointerDown={(e) => {
                  isDraggingDial.current = true;
                  updateHourFromDialPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!isDraggingDial.current) return;
                  updateHourFromDialPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  isDraggingDial.current = false;
                }}
                onPointerLeave={() => {
                  isDraggingDial.current = false;
                }}
              >
                {/* Outer Dial Face */}
                <circle
                  cx={dialCenter}
                  cy={dialCenter}
                  r={84}
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                {/* Inner Guide Ring */}
                <circle
                  cx={dialCenter}
                  cy={dialCenter}
                  r={dialRadius}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                {/* Rotating Clock Hand (عقربه ساعت چرخشی) */}
                <line
                  x1={dialCenter}
                  y1={dialCenter}
                  x2={handTipX}
                  y2={handTipY}
                  stroke="#c8ff00"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx={dialCenter} cy={dialCenter} r={16} fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                <text
                  x={dialCenter}
                  y={dialCenter + 4}
                  textAnchor="middle"
                  className="fill-[#c8ff00] font-mono text-[10px] font-black"
                >
                  {toPersianDigits(parsed.hour)}:{toPersianDigits(parsed.minute)}
                </text>

                {/* 16 Radial Hour Nodes (08:00 to 23:00) */}
                {CLINIC_HOURS_08_TO_23.map((h, i) => {
                  const angleRad = ((i * (360 / CLINIC_HOURS_08_TO_23.length) - 90) * Math.PI) / 180;
                  const nx = dialCenter + dialRadius * Math.cos(angleRad);
                  const ny = dialCenter + dialRadius * Math.sin(angleRad);
                  const isSel = h === parsed.hour;
                  const hNum = parseInt(h, 10);
                  const shiftDotColor =
                    hNum < 14 ? '#fbbf24' : hNum < 19 ? '#38bdf8' : '#a855f7';

                  return (
                    <g
                      key={h}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('selection');
                        emitTime(h, parsed.minute);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={nx}
                        cy={ny}
                        r={isSel ? 12 : 9.5}
                        fill={isSel ? '#c8ff00' : '#1e293b'}
                        stroke={isSel ? '#ffffff' : shiftDotColor}
                        strokeWidth={isSel ? '2' : '1.2'}
                      />
                      <text
                        x={nx}
                        y={ny + 3.5}
                        textAnchor="middle"
                        className={`font-mono text-[9.5px] font-black ${
                          isSel ? 'fill-slate-950' : 'fill-slate-100'
                        }`}
                      >
                        {toPersianDigits(h)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-center gap-2 text-[8.5px] font-bold text-slate-400 mt-0.5">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-amber-400 inline-block" /> صبح (۸-۱۳)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-sky-400 inline-block" /> عصر (۱۴-۱۸)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-purple-400 inline-block" /> شب (۱۹-۲۳)</span>
            </div>
          </div>
        )}

        {/* 2. Dual Drum Wheel (Hour 08..23 & Minute 00..55) */}
        <div className={`${pickerMode === 'dial_and_wheel' ? 'lg:col-span-4' : 'lg:col-span-5'} bg-slate-900 text-white rounded-2xl p-2.5 border border-slate-700 shadow-inner`}>
          <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-300 mb-1.5 px-1">
            <span>چرخنده عربیلکی (بکشید یا کلیک کنید)</span>
            <span className="font-mono text-[#c8ff00]">08:00 - 23:00</span>
          </div>

          <div className="grid grid-cols-2 gap-2 items-center relative" dir="ltr">
            {/* Hour Drum Column */}
            <div className="flex flex-col items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700">
              <span className="text-[9px] font-bold text-cyan-300 mb-0.5">ساعت (۸ تا ۲۳)</span>
              <button
                type="button"
                onClick={() => stepHour(-1)}
                aria-label="ساعت قبلی"
                className="w-full py-0.5 rounded-lg hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>

              <div
                ref={hourWheelRef}
                onScroll={handleHourWheelScroll}
                className="h-[108px] w-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[36px] space-y-0.5 text-center"
              >
                {CLINIC_HOURS_08_TO_23.map((h) => {
                  const isSel = h === parsed.hour;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        emitTime(h, parsed.minute);
                      }}
                      className={`h-[34px] w-full snap-center rounded-lg font-mono text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#c8ff00] text-slate-950 font-black shadow-xs scale-105'
                          : 'text-slate-300 hover:bg-slate-700/60 font-bold opacity-75'
                      }`}
                    >
                      <span>{toPersianDigits(h)}</span>
                      <span className={`text-[8.5px] font-sans ${isSel ? 'text-slate-900 font-black' : 'text-slate-400'}`}>
                        {getShiftLabelForHour(h)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => stepHour(1)}
                aria-label="ساعت بعدی"
                className="w-full py-0.5 rounded-lg hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Minute Drum Column */}
            <div className="flex flex-col items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700">
              <span className="text-[9px] font-bold text-amber-300 mb-0.5">دقیقه (۰۰ تا ۵۵)</span>
              <button
                type="button"
                onClick={() => stepMinute(-1)}
                aria-label="دقیقه قبلی"
                className="w-full py-0.5 rounded-lg hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>

              <div
                ref={minuteWheelRef}
                onScroll={handleMinuteWheelScroll}
                className="h-[108px] w-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[36px] space-y-0.5 text-center"
              >
                {CLINIC_MINUTES_STEP_5.map((m) => {
                  const isSel = m === parsed.minute;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        emitTime(parsed.hour, m);
                      }}
                      className={`h-[34px] w-full snap-center rounded-lg font-mono text-xs flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-sky-400 text-slate-950 font-black shadow-xs scale-105'
                          : 'text-slate-300 hover:bg-slate-700/60 font-bold opacity-75'
                      }`}
                    >
                      <span>:{toPersianDigits(m)}</span>
                      <span className="text-[8.5px] font-sans">دقیقه</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => stepMinute(1)}
                aria-label="دقیقه بعدی"
                className="w-full py-0.5 rounded-lg hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Minute Quarter Pills (00 / 15 / 30 / 45) */}
          <div className="grid grid-cols-4 gap-1 mt-2" dir="ltr">
            {['00', '15', '30', '45'].map((qMin) => (
              <button
                key={qMin}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  emitTime(parsed.hour, qMin);
                }}
                className={`py-1 rounded-lg font-mono text-[10px] font-black transition-all cursor-pointer ${
                  parsed.minute === qMin
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                :{toPersianDigits(qMin)}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Shift Tabs (Morning 8-13:30, Afternoon 14-18:30, Night 19-23:00) + Quick Slot Grid */}
        {!compact && (
          <div className={`${pickerMode === 'dial_and_wheel' ? 'lg:col-span-4' : 'lg:col-span-7'} space-y-2`}>
            {/* Shift Switcher Pills */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveShift('morning');
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[9.5px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeShift === 'morning'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-3 h-3 shrink-0" />
                <span className="truncate">صبح (۸ تا ۱۳:۳۰)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveShift('afternoon');
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[9.5px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeShift === 'afternoon'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sunset className="w-3 h-3 shrink-0" />
                <span className="truncate">عصر (۱۴ تا ۱۸:۳۰)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveShift('night');
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[9.5px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeShift === 'night'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3 h-3 shrink-0" />
                <span className="truncate">شب (۱۹ تا ۲۳)</span>
              </button>
            </div>

            {/* Quick Slots for Selected Shift */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {shiftSlots.map((slot) => {
                const slotKey = toPersianDigits(slot);
                const occupiedPatient = occupiedTimes[slot] || occupiedTimes[slotKey];
                const blockedReason = blockedTimes[slot] || blockedTimes[slotKey];
                const isSelected = parseTimeMinutes(value) === parseTimeMinutes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    title={
                      occupiedPatient
                        ? `رزرو توسط ${occupiedPatient}`
                        : blockedReason
                        ? blockedReason
                        : `انتخاب ساعت ${slotKey}`
                    }
                    onClick={() => {
                      triggerHaptic('selection');
                      onChange(slot);
                    }}
                    className={`py-1.5 px-1 rounded-xl font-mono text-[10.5px] font-black border transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected && occupiedPatient
                        ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                        : isSelected
                          ? 'bg-sky-600 text-white border-sky-700 ring-2 ring-sky-300 shadow-2xs'
                          : occupiedPatient
                            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            : blockedReason
                              ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/70'
                              : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <span>{slotKey}</span>
                    <span className={`text-[8px] font-sans font-bold truncate max-w-full ${
                      isSelected ? 'text-white' : occupiedPatient ? 'text-amber-700' : blockedReason ? 'text-slate-500' : 'text-emerald-700'
                    }`}>
                      {occupiedPatient ? `پُر · ${occupiedPatient.split(' ')[0]}` : blockedReason ? blockedReason : 'آزاد ✓'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
