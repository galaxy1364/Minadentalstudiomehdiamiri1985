import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  AlarmClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  FolderOpen,
  Package,
  Send,
  ShieldAlert
} from 'lucide-react';
import { Appointment, InventoryItem, LabOrder, Patient } from '../types/dental';
import { formatToman, toPersianDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import {
  broadcastReminderMeshSync,
  markReminderDone,
  snoozeReminder,
  SynthesizedClinicReminder,
  synthesizeUnifiedClinicReminders
} from '../services/reminderNotificationService';
import { clinicalSmsService, SmsLogItem } from '../services/smsService';
import { actionFeedback } from '../utils/actionFeedback';

interface ClinicUrgentAlarmsBannerProps {
  patients: Patient[];
  appointments: Appointment[];
  inventory?: InventoryItem[];
  onOpenPatientFile: (patient: Patient, tab?: any) => void;
  onNavigate: (viewId: string) => void;
  onOpenLabSlip?: (order: LabOrder) => void;
}

export const ClinicUrgentAlarmsBanner: React.FC<ClinicUrgentAlarmsBannerProps> = ({
  patients,
  appointments,
  inventory = [],
  onOpenPatientFile,
  onNavigate
}) => {
  const { impactLight, impactHeavy, success } = useHapticFeedback();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUpdated = () => setRevision(r => r + 1);
    window.addEventListener('minadental:reminders-updated', onUpdated);
    return () => window.removeEventListener('minadental:reminders-updated', onUpdated);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const urgentItems = useMemo(() => {
    return synthesizeUnifiedClinicReminders({
      patients,
      appointments,
      inventory
    }).filter(r => r.urgency === 'critical' || r.urgency === 'high');
  }, [patients, appointments, inventory, revision]);

  const counts = useMemo(() => {
    let labImplant = 0;
    let financial = 0;
    let ops = 0;
    for (const item of urgentItems) {
      if (item.pillar === 'lab' || item.pillar === 'implant') labImplant++;
      else if (item.pillar === 'check' || item.pillar === 'installment' || item.pillar === 'debtor') financial++;
      else ops++;
    }
    return { labImplant, financial, ops };
  }, [urgentItems]);

  if (urgentItems.length === 0) return null;

  const sendRealSms = async (item: SynthesizedClinicReminder) => {
    impactHeavy();
    let pType: SmsLogItem['patternType'] = 'appointment_reminder';
    if (item.pillar === 'check') pType = 'sayad_check_due';
    else if (item.pillar === 'installment' || item.pillar === 'debtor') pType = 'installment_due';
    else if (item.pillar === 'lab') pType = 'lab_ready';
    else if (item.pillar === 'implant') pType = 'implant_healing_recall';

    const res = await clinicalSmsService.sendPatternSms(
      item.phone || '۰۹۱۲۰۰۰۰۰۰۰',
      item.patientName,
      pType,
      {
        date: item.aptDate || item.time,
        time: item.aptTime || '۱۷:۰۰',
        amount: item.exactAmountMicro || (item.exactAmountToman ? formatToman(item.exactAmountToman) : ''),
        dueDate: item.aptDate || item.time
      }
    );
    success();
    actionFeedback.recordSuccess({
      title: `ارسال پیامک یادآوری به ${item.patientName}`,
      subtitle: item.title,
      badgeText: `✓ مخابره شد (${res.refId})`
    });
    showToast(`پیامک واقعی (کد ${res.refId}) برای ${item.patientName} ارسال شد.`);
  };

  const handleQuickSnooze = (item: SynthesizedClinicReminder) => {
    impactLight();
    snoozeReminder(item.id, 60);
    setRevision(r => r + 1);
    showToast(`«${item.title}» به مدت ۱ ساعت به تعویق افتاد.`);
  };

  const handleQuickDone = (item: SynthesizedClinicReminder) => {
    impactLight();
    markReminderDone(item.id);
    try {
      const saved = localStorage.getItem('minadental_dismissed_reminders_v1');
      const map = saved ? JSON.parse(saved) : {};
      map[item.id] = true;
      localStorage.setItem('minadental_dismissed_reminders_v1', JSON.stringify(map));
    } catch {}
    broadcastReminderMeshSync('dismiss', item.id);
    setRevision(r => r + 1);
    showToast(`یادآوری «${item.patientName}» انجام‌شده علامت خورد.`);
  };

  return (
    <div className="w-full relative select-none">
      {toastMessage && (
        <div className="fixed top-14 left-4 right-4 z-50 bg-emerald-600 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="w-full bg-gradient-to-r from-rose-50/90 via-amber-50/70 to-white rounded-[20px] px-3.5 py-2 border border-rose-200/90 shadow-[var(--shadow-card)] space-y-2">
        <button
          type="button"
          onClick={() => {
            impactLight();
            setIsExpanded(!isExpanded);
          }}
          className="w-full min-h-[38px] flex items-center justify-between gap-2 cursor-pointer text-right"
        >
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 stroke-[2.3]" />

            <span className="text-[12px] font-black text-rose-950 shrink-0 tabular-nums">
              هشدارهای فوری و یادآوری زنده ({toPersianDigits(urgentItems.length)})
            </span>

            {!isExpanded && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shrink-0 tabular-nums">
                {counts.financial > 0 && (
                  <span className="text-rose-900">· {toPersianDigits(counts.financial)} چک/قسط/بدهی</span>
                )}
                {counts.labImplant > 0 && (
                  <span className="text-purple-900">· {toPersianDigits(counts.labImplant)} لابراتوار/ایمپلنت</span>
                )}
                {counts.ops > 0 && (
                  <span className="text-amber-900">· {toPersianDigits(counts.ops)} نوبت/انبار/ریکال</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-800 shrink-0">
            <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="pt-2 border-t border-rose-200/80 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2 text-[10.5px] font-bold text-slate-600 px-1">
              <span>متصل به موتور یادآوری ۱۱ لایه (اولویت‌بندی خودکار):</span>
              <button
                type="button"
                onClick={() => {
                  impactLight();
                  onNavigate('reminders');
                }}
                className="text-amber-800 hover:text-amber-950 font-black flex items-center gap-1 cursor-pointer"
              >
                <span>مرکز کامل یادآوری‌ها</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5">
              {urgentItems.slice(0, 6).map(item => {
                const matchedPat = item.patientId ? patients.find(p => p.id === item.patientId) : undefined;
                const badgeTone =
                  item.urgency === 'critical'
                    ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950';
                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-2 text-[11px] p-2.5 rounded-xl border ${badgeTone}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.pillar === 'lab' || item.pillar === 'implant' ? (
                          <FlaskConical className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        ) : item.pillar === 'inventory' ? (
                          <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : item.pillar === 'check' || item.pillar === 'installment' || item.pillar === 'debtor' ? (
                          <FileCheck2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="font-black text-slate-900">{item.title}</span>
                        <span className="text-[10px] font-bold bg-white/80 border border-slate-200/80 px-1.5 py-0.5 rounded-md">
                          {item.patientName}
                        </span>
                        {typeof item.noShowRiskPercent === 'number' && item.noShowRiskPercent >= 50 && (
                          <span className="text-[9.5px] font-black bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.5 rounded-md">
                            ریسک {toPersianDigits(item.noShowRiskPercent)}٪
                          </span>
                        )}
                        {item.assignedTo && (
                          <span className="text-[9.5px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                            {item.assignedTo}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-600 block mt-0.5 truncate">
                        {item.time}
                        {item.exactAmountToman ? ` · ${formatToman(item.exactAmountToman)}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      {matchedPat && (
                        <button
                          type="button"
                          onClick={() => {
                            impactLight();
                            onOpenPatientFile(matchedPat, item.patientTab || 'treatments');
                          }}
                          className="py-1 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen className="w-3 h-3 text-indigo-600" />
                          <span>پرونده</span>
                        </button>
                      )}

                      {item.phone && (
                        <button
                          type="button"
                          onClick={() => void sendRealSms(item)}
                          className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3 -scale-x-100" />
                          <span>پیامک</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleQuickSnooze(item)}
                        className="py-1 px-2 rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="تعویق ۱ ساعته"
                      >
                        <AlarmClock className="w-3 h-3" />
                        <span>۱س تعویق</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDone(item)}
                        className="py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                      >
                        انجام شد
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
