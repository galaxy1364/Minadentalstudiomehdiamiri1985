import React, { useState } from 'react';
import { Bell, Smartphone, MessageSquare, Clock, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { ReminderChannel, ReminderConfig, ReminderTimingPreset } from '../types/dental';
import {
  computeReminderTriggerDateTime,
  getPhoneNotificationPermission,
  getPresetLabelFa,
  requestPhoneNotificationPermission
} from '../services/reminderNotificationService';
import { getCurrentPersianDate } from '../utils/jalali';

interface ReminderOptionPickerProps {
  value: ReminderConfig;
  onChange: (next: ReminderConfig) => void;
  targetDate?: string;
  targetTime?: string;
  theme?: 'sky' | 'emerald' | 'purple' | 'cyan' | 'amber' | 'rose';
  defaultExpanded?: boolean;
  title?: string;
}

const PRESET_OPTIONS: Array<{ id: ReminderTimingPreset; label: string }> = [
  { id: 'at_time', label: 'همان زمان' },
  { id: '30m_before', label: '۳۰ دقیقه قبل' },
  { id: '2h_before', label: '۲ ساعت قبل' },
  { id: '1d_before', label: '۱ روز قبل' },
  { id: '2d_before', label: '۲ روز قبل' },
  { id: '3d_before', label: '۳ روز قبل' },
  { id: '1w_before', label: '۱ هفته قبل' },
  { id: 'custom', label: 'تاریخ دلخواه' }
];

const THEME_CLASSES: Record<
  NonNullable<ReminderOptionPickerProps['theme']>,
  {
    wrapper: string;
    badge: string;
    activeChip: string;
    switchOn: string;
  }
> = {
  sky: {
    wrapper: 'bg-sky-50/75 border-sky-200/80',
    badge: 'bg-sky-100 text-sky-700',
    activeChip: 'bg-sky-600 text-white border-sky-600',
    switchOn: 'bg-sky-600'
  },
  emerald: {
    wrapper: 'bg-emerald-50/75 border-emerald-200/80',
    badge: 'bg-emerald-100 text-emerald-700',
    activeChip: 'bg-emerald-600 text-white border-emerald-600',
    switchOn: 'bg-emerald-600'
  },
  purple: {
    wrapper: 'bg-purple-50/75 border-purple-200/80',
    badge: 'bg-purple-100 text-purple-700',
    activeChip: 'bg-purple-600 text-white border-purple-600',
    switchOn: 'bg-purple-600'
  },
  cyan: {
    wrapper: 'bg-cyan-50/75 border-cyan-200/80',
    badge: 'bg-cyan-100 text-cyan-700',
    activeChip: 'bg-cyan-600 text-white border-cyan-600',
    switchOn: 'bg-cyan-600'
  },
  amber: {
    wrapper: 'bg-amber-50/75 border-amber-200/80',
    badge: 'bg-amber-100 text-amber-800',
    activeChip: 'bg-amber-600 text-white border-amber-600',
    switchOn: 'bg-amber-600'
  },
  rose: {
    wrapper: 'bg-rose-50/75 border-rose-200/80',
    badge: 'bg-rose-100 text-rose-700',
    activeChip: 'bg-rose-600 text-white border-rose-600',
    switchOn: 'bg-rose-600'
  }
};

export const ReminderOptionPicker: React.FC<ReminderOptionPickerProps> = ({
  value,
  onChange,
  targetDate,
  targetTime,
  theme = 'sky',
  defaultExpanded = false,
  title = 'تنظیم یادآوری و نوتیفیکیشن گوشی'
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [permState, setPermState] = useState(() => getPhoneNotificationPermission());
  const styles = THEME_CLASSES[theme];

  const effectiveTargetDate = targetDate || getCurrentPersianDate();
  const computed = computeReminderTriggerDateTime(effectiveTargetDate, targetTime || '۰۹:۰۰', value);

  const toggleEnabled = () => {
    const nextEnabled = !value.enabled;
    onChange({
      ...value,
      enabled: nextEnabled,
      channels: value.channels?.length ? value.channels : ['phone_push', 'in_app']
    });
    if (nextEnabled) setExpanded(true);
  };

  const toggleChannel = async (ch: ReminderChannel) => {
    const current = value.channels || ['phone_push', 'in_app'];
    const exists = current.includes(ch);
    const nextChannels = exists
      ? current.filter(c => c !== ch)
      : [...current, ch];
    if (nextChannels.length === 0) return;

    if (!exists && ch === 'phone_push' && permState === 'default') {
      const nextPerm = await requestPhoneNotificationPermission();
      setPermState(nextPerm);
    }

    onChange({
      ...value,
      enabled: true,
      channels: nextChannels
    });
  };

  const handleRequestPerm = async () => {
    const res = await requestPhoneNotificationPermission();
    setPermState(res);
  };

  return (
    <div dir="rtl" className={`rounded-[18px] border p-3 transition-all ${styles.wrapper}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex-1 flex items-center gap-2 text-right min-w-0 cursor-pointer"
          aria-expanded={expanded}
        >
          <span className={`w-8 h-8 rounded-[11px] flex items-center justify-center shrink-0 ${styles.badge}`}>
            <Bell className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-black text-slate-900 truncate flex items-center gap-1.5">
              <span>{title}</span>
              {value.enabled && (
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-slate-700 border border-slate-200/80">
                  {getPresetLabelFa(value.preset)}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
              {value.enabled
                ? `ارسال در ${computed.triggerDate} ساعت ${computed.triggerTime} · ${
                    value.channels.includes('phone_push') ? 'نوتیفیکیشن گوشی ' : ''
                  }${value.channels.includes('in_app') ? '• برنامه ' : ''}${
                    value.channels.includes('sms') ? '• پیامک' : ''
                  }`
                : 'یادآوری برای این مورد غیرفعال است (برای فعال‌سازی کلیک کنید)'}
            </p>
          </div>
          <span className="w-7 h-7 rounded-lg bg-white/80 text-slate-500 flex items-center justify-center shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleEnabled}
          aria-label={value.enabled ? 'غیرفعال کردن یادآوری' : 'فعال کردن یادآوری'}
          className={`min-w-[46px] h-[28px] px-1 rounded-full transition-colors flex items-center shrink-0 cursor-pointer ${
            value.enabled ? `${styles.switchOn} justify-start` : 'bg-slate-300 justify-end'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
        </button>
      </div>

      {expanded && value.enabled && (
        <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-2.5">
          {/* Timing Presets */}
          <div>
            <span className="text-[10px] font-black text-slate-600 mb-1.5 block flex items-center gap-1">
              <Clock className="w-3 h-3" /> زمان اعلام یادآوری:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_OPTIONS.map(opt => {
                const isSelected = value.preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        preset: opt.id,
                        customDate:
                          opt.id === 'custom'
                            ? value.customDate || effectiveTargetDate
                            : value.customDate,
                        customTime:
                          opt.id === 'custom'
                            ? value.customTime || targetTime || '۰۹:۰۰'
                            : value.customTime
                      })
                    }
                    className={`min-h-[34px] px-2.5 py-1 rounded-[10px] text-[10.5px] font-black border transition-all cursor-pointer ${
                      isSelected
                        ? styles.activeChip
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date/Time Inputs */}
          {value.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">تاریخ یادآوری (شمسی)</label>
                <input
                  type="text"
                  value={value.customDate || effectiveTargetDate}
                  onChange={e => onChange({ ...value, customDate: e.target.value })}
                  placeholder="۱۴۰۵/۰۸/۰۵"
                  aria-label="تاریخ دلخواه یادآوری"
                  dir="ltr"
                  className="w-full h-9 px-2.5 rounded-xl bg-white border border-slate-200 text-[11px] font-mono font-bold text-slate-800 text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">ساعت هشدار</label>
                <input
                  type="text"
                  value={value.customTime || targetTime || '۰۹:۰۰'}
                  onChange={e => onChange({ ...value, customTime: e.target.value })}
                  placeholder="۰۹:۰۰"
                  aria-label="ساعت دلخواه یادآوری"
                  dir="ltr"
                  className="w-full h-9 px-2.5 rounded-xl bg-white border border-slate-200 text-[11px] font-mono font-bold text-slate-800 text-center"
                />
              </div>
            </div>
          )}

          {/* Delivery Channels */}
          <div>
            <span className="text-[10px] font-black text-slate-600 mb-1.5 block">کانال‌های ارسال هشدار:</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => toggleChannel('phone_push')}
                className={`min-h-[38px] px-2 py-1.5 rounded-[11px] text-[10px] font-black border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                  value.channels.includes('phone_push')
                    ? styles.activeChip
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>نوتیف گوشی</span>
              </button>
              <button
                type="button"
                onClick={() => toggleChannel('in_app')}
                className={`min-h-[38px] px-2 py-1.5 rounded-[11px] text-[10px] font-black border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                  value.channels.includes('in_app')
                    ? styles.activeChip
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>داخل برنامه</span>
              </button>
              <button
                type="button"
                onClick={() => toggleChannel('sms')}
                className={`min-h-[38px] px-2 py-1.5 rounded-[11px] text-[10px] font-black border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                  value.channels.includes('sms')
                    ? styles.activeChip
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>پیامک SMS</span>
              </button>
            </div>
          </div>

          {value.channels.includes('phone_push') && permState !== 'granted' && permState !== 'unsupported' && (
            <div className="rounded-xl bg-amber-100/80 border border-amber-300/80 px-2.5 py-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-amber-900">
                {permState === 'denied'
                  ? 'دسترسی نوتیفیکیشن در مرورگر مسدود شده است (از تنظیمات مرورگر Allow کنید).'
                  : 'برای نمایش هشدار روی صفحه قفل گوشی، مجوز نوتیفیکیشن را تایید کنید.'}
              </span>
              {permState === 'default' && (
                <button
                  type="button"
                  onClick={handleRequestPerm}
                  className="shrink-0 min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-black cursor-pointer"
                >
                  تایید گوشی
                </button>
              )}
            </div>
          )}

          {/* Optional note */}
          <input
            type="text"
            value={value.note || ''}
            onChange={e => onChange({ ...value, note: e.target.value })}
            placeholder="یادداشت اختصاصی برای آلارم یادآوری (اختیاری)..."
            aria-label="یادداشت اختصاصی یادآوری"
            className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-800 placeholder:text-slate-400"
          />
        </div>
      )}
    </div>
  );
};
