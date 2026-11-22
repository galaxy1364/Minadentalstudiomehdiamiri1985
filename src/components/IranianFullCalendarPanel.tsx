import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FlaskConical,
  BellRing,
  Plus,
  Sparkles,
  Stethoscope,
  Users,
  Wallet,
  CheckCircle2,
  Ban,
  ArrowUpRight,
  Columns3,
  AlarmClock,
  LayoutGrid,
  ArrowLeftRight,
  Download,
  RefreshCw,
  Receipt
} from 'lucide-react';
import {
  Appointment,
  ClinicScheduleSettings,
  Patient,
  UnifiedReminderRecord
} from '../types/dental';
import {
  PERSIAN_MONTHS,
  computeClinicalTargetDate,
  convertGregorianInputToCalendarInfo,
  diffPersianDays,
  formatPersianDateString,
  formatToman,
  getCurrentPersianDate,
  getDaysInPersianMonth,
  getDaysUntilNowruz,
  getGregorianDateInfo,
  getPersianDateParts,
  getPersianMonthStartWeekdayIndex,
  getPersianSeasonInfo,
  getPersianWeekdayName,
  getPersianWeekdayShortName,
  getWeekDatesStartingSaturday,
  isPersianLeapYear,
  isSamePersianDate,
  parsePersianDate,
  toPersianDigits
} from '../utils/jalali';
import {
  getIranianDateOccasions,
  getMonthIranianOccasions
} from '../utils/appointmentScheduling';
import { triggerHaptic } from '../utils/haptics';
import {
  getCustomReminders,
  markReminderDone,
  scheduleEntityReminder,
  snoozeReminder
} from '../services/reminderNotificationService';
import { actionFeedback } from '../utils/actionFeedback';

export type CalendarLayerFilter =
  | 'all'
  | 'appointments'
  | 'financial'
  | 'payments'
  | 'lab'
  | 'implant'
  | 'reminders';

export interface IranianFullCalendarPanelProps {
  appointments: Appointment[];
  patients: Patient[];
  selectedYear: number;
  selectedMonth: number; // 0-indexed (0..11)
  selectedDay: number;
  scheduleSettings: ClinicScheduleSettings;
  onSelectDate: (year: number, monthIndex: number, day: number) => void;
  onJumpToday: () => void;
  onPersistSchedule: (next: ClinicScheduleSettings) => void;
  onSwitchToBoardForSelectedDay: () => void;
  onOpenAddAppointmentForDate: (dateStr: string, patientOverride?: Patient) => void;
  onStartClinicalFlow?: (apt: Appointment) => void;
  onOpenPatientFile?: (
    patient: Patient,
    initialTab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai'
  ) => void;
  onNavigateToModule?: (viewId: string) => void;
  onOpenLabModal?: () => void;
  onOpenCheckModal?: () => void;
  onOpenPaymentModal?: () => void;
  onShowToast: (msg: string) => void;
}

interface DayModuleAggregate {
  appointments: Appointment[];
  checks: Array<{
    id: string;
    patient: Patient;
    amount: number;
    bankName: string;
    sayadId: string;
    isGuarantee: boolean;
    status: string;
  }>;
  installments: Array<{
    id: string;
    patient: Patient;
    amount: number;
    treatmentName: string;
    installmentNumber: number;
    totalInstallments: number;
    status: string;
  }>;
  payments: Array<{
    id: string;
    patient: Patient;
    amount: number;
    method: string;
    forTreatment: string;
    isRefund?: boolean;
  }>;
  labOrders: Array<{
    id: string;
    patient: Patient;
    toothNumber: string;
    workType: string;
    labName: string;
    status: string;
    eventKind: 'ارسال' | 'تحویل لابراتوار';
  }>;
  implants: Array<{
    id: string;
    patient: Patient;
    toothNumber: string;
    brand: string;
    currentStage: string;
    eventKind: 'جراحی کاشت' | 'موعد هیلینگ و پروتز';
  }>;
  recalls: Array<{
    id: string;
    patient: Patient;
    recallMonths?: number;
  }>;
  reminders: UnifiedReminderRecord[];
}

const EMPTY_AGGREGATE: DayModuleAggregate = {
  appointments: [],
  checks: [],
  installments: [],
  payments: [],
  labOrders: [],
  implants: [],
  recalls: [],
  reminders: []
};

const WEEKDAY_HEADERS = ['شنبه', '۱شنبه', '۲شنبه', '۳شنبه', '۴شنبه', '۵شنبه', 'جمعه'];
const WEEKDAY_MICRO = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const IranianFullCalendarPanel: React.FC<IranianFullCalendarPanelProps> = ({
  appointments,
  patients,
  selectedYear,
  selectedMonth,
  selectedDay,
  scheduleSettings,
  onSelectDate,
  onJumpToday,
  onPersistSchedule,
  onSwitchToBoardForSelectedDay,
  onOpenAddAppointmentForDate,
  onStartClinicalFlow,
  onOpenPatientFile,
  onNavigateToModule,
  onOpenLabModal,
  onOpenCheckModal,
  onOpenPaymentModal,
  onShowToast
}) => {
  const [calendarSubMode, setCalendarSubMode] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [layerFilter, setLayerFilter] = useState<CalendarLayerFilter>('all');
  const [holidayReasonInput, setHolidayReasonInput] = useState('');
  const [showCustomHolidayForm, setShowCustomHolidayForm] = useState(false);

  // Tools Panel: Tri-Calendar Converter + Follow-up Calculator + Monthly Occasions Directory
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [gregInputIso, setGregInputIso] = useState(() =>
    getGregorianDateInfo(getCurrentPersianDate()).formattedIso
  );
  const [offsetAmount, setOffsetAmount] = useState<number>(90);
  const [offsetUnit, setOffsetUnit] = useState<'days' | 'months'>('days');

  // Quick reminder creation inside selected calendar date
  const [showQuickRemForm, setShowQuickRemForm] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remPatientId, setRemPatientId] = useState('');
  const [remTime, setRemTime] = useState('۱۰:۰۰');
  const [remRevision, setRemRevision] = useState(0);

  const [customReminders, setCustomReminders] = useState<UnifiedReminderRecord[]>(() => getCustomReminders());

  useEffect(() => {
    setCustomReminders(getCustomReminders());
  }, [remRevision]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncReminders = () => setCustomReminders(getCustomReminders());
    window.addEventListener('minadental:reminders-updated', syncReminders);
    return () => window.removeEventListener('minadental:reminders-updated', syncReminders);
  }, []);

  const todayStr = getCurrentPersianDate();
  const todayParts = getPersianDateParts();
  const selectedDateStr = formatPersianDateString(selectedYear, selectedMonth + 1, selectedDay);

  const daysCount = getDaysInPersianMonth(selectedMonth + 1, selectedYear);
  const startOffset = getPersianMonthStartWeekdayIndex(selectedYear, selectedMonth + 1);
  const daysArray = useMemo(() => Array.from({ length: daysCount }, (_, i) => i + 1), [daysCount]);
  const weekDates = useMemo(() => getWeekDatesStartingSaturday(selectedDateStr), [selectedDateStr]);

  const yearChoices = useMemo(() => {
    const base = Math.max(1400, Math.min(1412, todayParts.year));
    const list: number[] = [];
    for (let y = base - 3; y <= base + 6; y++) list.push(y);
    return list;
  }, [todayParts.year]);

  const seasonInfo = getPersianSeasonInfo(selectedMonth + 1);
  const isLeap = isPersianLeapYear(selectedYear);
  const daysToNowruz = getDaysUntilNowruz(selectedDateStr);
  const diffFromToday = diffPersianDays(todayStr, selectedDateStr);
  const selectedOccasion = useMemo(
    () => getIranianDateOccasions(selectedDateStr, scheduleSettings),
    [selectedDateStr, scheduleSettings]
  );

  const monthOccasionsDigest = useMemo(
    () => getMonthIranianOccasions(selectedYear, selectedMonth + 1, scheduleSettings),
    [selectedYear, selectedMonth, scheduleSettings]
  );

  const convertedFromGregorian = useMemo(
    () => convertGregorianInputToCalendarInfo(gregInputIso),
    [gregInputIso]
  );

  const clinicalTargetPreview = useMemo(
    () => computeClinicalTargetDate(selectedDateStr, Math.max(0, offsetAmount || 0), offsetUnit),
    [selectedDateStr, offsetAmount, offsetUnit]
  );

  const patientLookupById = useMemo(() => {
    const m = new Map<string, Patient>();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  // Index ALL clinic events across dates (Appointments, Checks, Installments, Payments, Lab, Implants, Recalls, Reminders)
  const aggregateByDate = useMemo(() => {
    const map = new Map<string, DayModuleAggregate>();
    const ensure = (dStr: string): DayModuleAggregate => {
      const normalized = (() => {
        const p = parsePersianDate(dStr);
        return formatPersianDateString(p.year, p.month, p.day);
      })();
      let bucket = map.get(normalized);
      if (!bucket) {
        bucket = {
          appointments: [],
          checks: [],
          installments: [],
          payments: [],
          labOrders: [],
          implants: [],
          recalls: [],
          reminders: []
        };
        map.set(normalized, bucket);
      }
      return bucket;
    };

    for (const apt of appointments) {
      if (!apt.date) continue;
      ensure(apt.date).appointments.push(apt);
    }

    for (const p of patients) {
      for (const chk of p.sayadChecks || []) {
        if (!chk.dueDate) continue;
        ensure(chk.dueDate).checks.push({
          id: chk.id,
          patient: p,
          amount: chk.amount,
          bankName: chk.bankName,
          sayadId: chk.sayadId,
          isGuarantee: chk.isGuarantee,
          status: chk.status
        });
      }
      for (const inst of p.installments || []) {
        if (!inst.dueDate) continue;
        ensure(inst.dueDate).installments.push({
          id: inst.id,
          patient: p,
          amount: inst.amount,
          treatmentName: inst.treatmentName,
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          status: inst.status
        });
      }
      for (const pay of p.payments || []) {
        if (!pay.date) continue;
        ensure(pay.date).payments.push({
          id: pay.id,
          patient: p,
          amount: pay.amount,
          method: pay.method,
          forTreatment: pay.forTreatment,
          isRefund: pay.isRefund
        });
      }
      for (const lab of p.labOrders || []) {
        if (lab.deliveryDate) {
          ensure(lab.deliveryDate).labOrders.push({
            id: `${lab.id}-del`,
            patient: p,
            toothNumber: lab.toothNumber,
            workType: lab.workType,
            labName: lab.labName,
            status: lab.status,
            eventKind: 'تحویل لابراتوار'
          });
        }
        if (lab.sendDate && !isSamePersianDate(lab.sendDate, lab.deliveryDate)) {
          ensure(lab.sendDate).labOrders.push({
            id: `${lab.id}-send`,
            patient: p,
            toothNumber: lab.toothNumber,
            workType: lab.workType,
            labName: lab.labName,
            status: lab.status,
            eventKind: 'ارسال'
          });
        }
      }
      for (const imp of p.implantCases || []) {
        if (imp.healingDueDate) {
          ensure(imp.healingDueDate).implants.push({
            id: `${imp.id}-heal`,
            patient: p,
            toothNumber: imp.toothNumber,
            brand: imp.brand,
            currentStage: imp.currentStage,
            eventKind: 'موعد هیلینگ و پروتز'
          });
        }
        if (imp.surgeryDate && !isSamePersianDate(imp.surgeryDate, imp.healingDueDate)) {
          ensure(imp.surgeryDate).implants.push({
            id: `${imp.id}-surg`,
            patient: p,
            toothNumber: imp.toothNumber,
            brand: imp.brand,
            currentStage: imp.currentStage,
            eventKind: 'جراحی کاشت'
          });
        }
      }
      if (p.nextRecallDate) {
        ensure(p.nextRecallDate).recalls.push({
          id: `recall-${p.id}`,
          patient: p,
          recallMonths: p.recallMonths
        });
      }
    }

    for (const rem of customReminders) {
      const target = rem.targetDate || rem.triggerDate;
      if (!target) continue;
      ensure(target).reminders.push(rem);
    }

    return map;
  }, [appointments, patients, customReminders]);

  const getDayAggregate = (dateStr: string): DayModuleAggregate => {
    const p = parsePersianDate(dateStr);
    const key = formatPersianDateString(p.year, p.month, p.day);
    return aggregateByDate.get(key) || EMPTY_AGGREGATE;
  };

  const selectedDayAgg = getDayAggregate(selectedDateStr);

  // Month summary stats across all pillars
  const monthSummary = useMemo(() => {
    let apts = 0;
    let checks = 0;
    let checksTotal = 0;
    let installments = 0;
    let paymentsCount = 0;
    let paymentsTotal = 0;
    let lab = 0;
    let implants = 0;
    let recalls = 0;
    let reminders = 0;
    for (const d of daysArray) {
      const dStr = formatPersianDateString(selectedYear, selectedMonth + 1, d);
      const agg = aggregateByDate.get(dStr);
      if (!agg) continue;
      apts += agg.appointments.length;
      checks += agg.checks.length;
      checksTotal += agg.checks.reduce((s, c) => s + (c.amount || 0), 0);
      installments += agg.installments.length;
      paymentsCount += agg.payments.length;
      paymentsTotal += agg.payments.reduce((s, pay) => s + (pay.amount || 0), 0);
      lab += agg.labOrders.length;
      implants += agg.implants.length;
      recalls += agg.recalls.length;
      reminders += agg.reminders.filter(r => r.status !== 'done').length;
    }
    return { apts, checks, checksTotal, installments, paymentsCount, paymentsTotal, lab, implants, recalls, reminders };
  }, [daysArray, selectedYear, selectedMonth, aggregateByDate]);

  // 12-Month Yearly Stats (only computed when viewing yearly mode or lightweight memo)
  const yearlyMonthsStats = useMemo(() => {
    return PERSIAN_MONTHS.map((mName, mIdx) => {
      const m1 = mIdx + 1;
      const mDays = getDaysInPersianMonth(m1, selectedYear);
      const startOff = getPersianMonthStartWeekdayIndex(selectedYear, m1);
      let apts = 0;
      let financial = 0;
      let clinical = 0;
      for (let d = 1; d <= mDays; d++) {
        const dStr = formatPersianDateString(selectedYear, m1, d);
        const agg = aggregateByDate.get(dStr);
        if (!agg) continue;
        apts += agg.appointments.length;
        financial += agg.checks.length + agg.installments.length + agg.payments.length;
        clinical += agg.labOrders.length + agg.implants.length + agg.recalls.length;
      }
      return { mName, mIdx, m1, mDays, startOff, apts, financial, clinical };
    });
  }, [selectedYear, aggregateByDate]);

  const selectDateString = (dateStr: string) => {
    const p = parsePersianDate(dateStr);
    triggerHaptic('selection');
    onSelectDate(p.year, p.month - 1, p.day);
  };

  const handleToggleClinicHoliday = () => {
    const exists = scheduleSettings.customHolidays.some(h => isSamePersianDate(h.date, selectedDateStr));
    if (exists) {
      onPersistSchedule({
        ...scheduleSettings,
        customHolidays: scheduleSettings.customHolidays.filter(h => !isSamePersianDate(h.date, selectedDateStr))
      });
      onShowToast(`تعطیلی مطب در تاریخ ${toPersianDigits(selectedDateStr)} لغو شد.`);
      return;
    }
    const reason = holidayReasonInput.trim() || 'تعطیلی ثبت‌شده مطب';
    onPersistSchedule({
      ...scheduleSettings,
      customHolidays: [
        ...scheduleSettings.customHolidays,
        { date: selectedDateStr, reason }
      ]
    });
    setHolidayReasonInput('');
    setShowCustomHolidayForm(false);
    onShowToast(`تاریخ ${toPersianDigits(selectedDateStr)} به عنوان تعطیل مطب ثبت شد.`);
  };

  const handleSaveQuickReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) {
      onShowToast('لطفاً عنوان یادآوری را وارد کنید.');
      return;
    }
    const linkedPatient = remPatientId ? patientLookupById.get(remPatientId) : undefined;
    scheduleEntityReminder({
      sourceType: 'custom',
      sourceId: `cal-${Date.now()}`,
      patientId: linkedPatient?.id,
      patientName: linkedPatient?.fullName || 'یادداشت عمومی کلینیک',
      patientPhone: linkedPatient?.phone,
      title: remTitle.trim(),
      description: `ثبت‌شده از تقویم جامع ایرانی برای تاریخ ${toPersianDigits(selectedDateStr)}`,
      targetDate: selectedDateStr,
      targetTime: remTime,
      targetView: 'appointments',
      config: {
        enabled: true,
        preset: 'at_time',
        channels: ['phone_push', 'in_app']
      }
    });
    actionFeedback.recordSuccess({
      title: 'یادآوری جدید در تقویم ثبت شد',
      subtitle: `${remTitle.trim()} · ${toPersianDigits(selectedDateStr)} ساعت ${toPersianDigits(remTime)}`,
      badgeText: '✓ ثبت در تقویم و یادآوری‌ها'
    });
    setRemTitle('');
    setRemPatientId('');
    setShowQuickRemForm(false);
    setRemRevision(r => r + 1);
    onShowToast(`یادآوری «${remTitle.trim()}» برای ${toPersianDigits(selectedDateStr)} ثبت شد.`);
  };

  const handleExportMonthlyCsv = () => {
    const rows: string[][] = [['تاریخ شمسی', 'نوع رویداد', 'بیمار', 'شرح و جزئیات', 'مبلغ (تومان)']];
    for (const d of daysArray) {
      const dStr = formatPersianDateString(selectedYear, selectedMonth + 1, d);
      const agg = getDayAggregate(dStr);
      for (const a of agg.appointments) {
        rows.push([dStr, 'نوبت مطب', a.patientName, `${a.time} · ${a.unit} · ${a.treatment}`, '']);
      }
      for (const c of agg.checks) {
        rows.push([dStr, c.isGuarantee ? 'چک ضمانت' : 'چک صیادی', c.patient.fullName, `بانک ${c.bankName}`, String(c.amount)]);
      }
      for (const ins of agg.installments) {
        rows.push([dStr, 'سررسید قسط', ins.patient.fullName, `${ins.treatmentName} (${ins.installmentNumber}/${ins.totalInstallments})`, String(ins.amount)]);
      }
      for (const pay of agg.payments) {
        rows.push([dStr, pay.isRefund ? 'عودت وجه' : 'دریافتی مالی', pay.patient.fullName, pay.forTreatment, String(pay.amount)]);
      }
      for (const l of agg.labOrders) {
        rows.push([dStr, l.eventKind, l.patient.fullName, `${l.workType} (${l.labName})`, '']);
      }
      for (const imp of agg.implants) {
        rows.push([dStr, imp.eventKind, imp.patient.fullName, `${imp.brand} (${imp.toothNumber})`, '']);
      }
      for (const rec of agg.recalls) {
        rows.push([dStr, 'ریکال دوره‌ای', rec.patient.fullName, `معاینه دوره‌ای هر ${toPersianDigits(rec.recallMonths || 6)} ماه`, '']);
      }
    }
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const csv = `\uFEFF${rows.map(r => r.map(esc).join(',')).join('\r\n')}`;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `MinaDental-Calendar-${selectedYear}-${selectedMonth + 1}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        // Non-browser test env
      }
    }
    onShowToast(`خروجی اکسل دستور کار ${PERSIAN_MONTHS[selectedMonth]} ${toPersianDigits(selectedYear)} آماده شد.`);
  };

  const showApts = layerFilter === 'all' || layerFilter === 'appointments';
  const showFinancial = layerFilter === 'all' || layerFilter === 'financial';
  const showPayments = layerFilter === 'all' || layerFilter === 'payments';
  const showLab = layerFilter === 'all' || layerFilter === 'lab';
  const showImplant = layerFilter === 'all' || layerFilter === 'implant';
  const showReminders = layerFilter === 'all' || layerFilter === 'reminders';

  const selectedAgendaCount =
    (showApts ? selectedDayAgg.appointments.length : 0) +
    (showFinancial ? selectedDayAgg.checks.length + selectedDayAgg.installments.length : 0) +
    (showPayments ? selectedDayAgg.payments.length : 0) +
    (showLab ? selectedDayAgg.labOrders.length : 0) +
    (showImplant ? selectedDayAgg.implants.length : 0) +
    (showReminders ? selectedDayAgg.reminders.length + selectedDayAgg.recalls.length : 0);

  const methodFaLabel = (method: string) => {
    if (method === 'pos') return 'کارتخوان';
    if (method === 'card_to_card') return 'کارت به کارت';
    if (method === 'check') return 'چک';
    return 'نقدی';
  };

  return (
    <div dir="rtl" className="mx-2 space-y-3">
      {/* 1. Enterprise Calendar Top Controls: Year/Month/Week/Yearly Switch + Season & Leap Meta */}
      <div className="bg-white rounded-[22px] p-3.5 border border-sky-200/90 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                if (calendarSubMode === 'yearly') {
                  onSelectDate(selectedYear + 1, selectedMonth, Math.min(selectedDay, getDaysInPersianMonth(selectedMonth + 1, selectedYear + 1)));
                } else if (selectedMonth >= 11) {
                  onSelectDate(selectedYear + 1, 0, Math.min(selectedDay, getDaysInPersianMonth(1, selectedYear + 1)));
                } else {
                  onSelectDate(selectedYear, selectedMonth + 1, Math.min(selectedDay, getDaysInPersianMonth(selectedMonth + 2, selectedYear)));
                }
              }}
              aria-label="ماه بعد در تقویم جامع"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <select
              aria-label="انتخاب ماه تقویم جامع"
              value={selectedMonth}
              onChange={(e) => {
                const nextM = Number(e.target.value);
                onSelectDate(selectedYear, nextM, Math.min(selectedDay, getDaysInPersianMonth(nextM + 1, selectedYear)));
              }}
              className="min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:border-sky-500"
            >
              {PERSIAN_MONTHS.map((mName, idx) => (
                <option key={mName} value={idx}>{mName}</option>
              ))}
            </select>

            <select
              aria-label="انتخاب سال تقویم جامع"
              value={selectedYear}
              onChange={(e) => {
                const nextY = Number(e.target.value);
                onSelectDate(nextY, selectedMonth, Math.min(selectedDay, getDaysInPersianMonth(selectedMonth + 1, nextY)));
              }}
              className="min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-sky-500"
            >
              {yearChoices.map(y => (
                <option key={y} value={y}>{toPersianDigits(y)}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                if (calendarSubMode === 'yearly') {
                  onSelectDate(selectedYear - 1, selectedMonth, Math.min(selectedDay, getDaysInPersianMonth(selectedMonth + 1, selectedYear - 1)));
                } else if (selectedMonth <= 0) {
                  onSelectDate(selectedYear - 1, 11, Math.min(selectedDay, getDaysInPersianMonth(12, selectedYear - 1)));
                } else {
                  onSelectDate(selectedYear, selectedMonth - 1, Math.min(selectedDay, getDaysInPersianMonth(selectedMonth, selectedYear)));
                }
              }}
              aria-label="ماه قبل در تقویم جامع"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {!isSamePersianDate(selectedDateStr, todayStr) && (
              <button
                type="button"
                onClick={onJumpToday}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer whitespace-nowrap"
              >
                امروز ({toPersianDigits(todayStr)})
              </button>
            )}
          </div>

          {/* Monthly vs Weekly vs Yearly Switch + Tools & Export */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setCalendarSubMode('monthly');
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                  calendarSubMode === 'monthly' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>نمای ماهانه</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setCalendarSubMode('weekly');
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                  calendarSubMode === 'weekly' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>نمای هفتگی (شنبه تا جمعه)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setCalendarSubMode('yearly');
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                  calendarSubMode === 'yearly' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>نمای سالانه</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setShowToolsDrawer(prev => !prev);
              }}
              className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 border cursor-pointer transition-all ${
                showToolsDrawer
                  ? 'bg-indigo-600 text-white border-indigo-700'
                  : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>مبدل تاریخ و مناسبت‌های ماه</span>
            </button>

            <button
              type="button"
              onClick={handleExportMonthlyCsv}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی اکسل ماه</span>
            </button>
          </div>
        </div>

        {/* Clean Unboxed Season, Leap Year, Month Totals */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-bold border-t border-slate-100 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-900 font-black">{seasonInfo.name} ({seasonInfo.quarterLabel})</span>
            <span aria-hidden="true">·</span>
            <span>سال {toPersianDigits(selectedYear)}: {isLeap ? 'کبیسه (۳۶۶ روز)' : 'عادی (۳۶۵ روز)'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">مانده تا نوروز: {toPersianDigits(daysToNowruz)} روز</span>
          </div>
          <div className="flex items-center gap-2 font-mono tabular-nums flex-wrap text-[10.5px]">
            <span className="text-sky-700">نوبت ماه: {toPersianDigits(monthSummary.apts)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-purple-700">چک و قسط: {toPersianDigits(monthSummary.checks + monthSummary.installments)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700">دریافتی: {toPersianDigits(monthSummary.paymentsCount)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-700">لابراتوار: {toPersianDigits(monthSummary.lab)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700">ایمپلنت/ریکال/یادآور: {toPersianDigits(monthSummary.implants + monthSummary.recalls + monthSummary.reminders)}</span>
          </div>
        </div>

        {/* Collapsible Tools Drawer: Tri-Calendar Converter, Clinical Date Offset Calculator & Monthly Occasions Directory */}
        {showToolsDrawer && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Tool A: Gregorian <-> Solar <-> Hijri Converter */}
              <div className="bg-white rounded-2xl p-3 border border-indigo-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                  <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                  <span>تبدیل دقیق تاریخ میلادی به شمسی و قمری</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    aria-label="تاریخ میلادی برای تبدیل"
                    value={gregInputIso}
                    onChange={(e) => setGregInputIso(e.target.value)}
                    className="min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
                  />
                  {convertedFromGregorian && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => selectDateString(convertedFromGregorian.jalali)}
                        className="min-h-[36px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black cursor-pointer"
                      >
                        پرش به {convertedFromGregorian.jalali}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAddAppointmentForDate(convertedFromGregorian.jalali)}
                        className="min-h-[36px] px-3 rounded-xl bg-[#c8ff00] hover:bg-[#bbf000] text-black text-[11px] font-black cursor-pointer"
                      >
                        + نوبت این روز
                      </button>
                    </div>
                  )}
                </div>
                {convertedFromGregorian ? (
                  <div className="text-[11px] font-bold text-slate-700 space-y-0.5 pt-1">
                    <div>
                      شمسی: <span className="font-black text-slate-950">{convertedFromGregorian.weekdayName} {convertedFromGregorian.jalali}</span>
                    </div>
                    <div className="text-indigo-800">
                      قمری: {convertedFromGregorian.hijri.formatted} ({convertedFromGregorian.hijri.formattedNumeric})
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-rose-700">تاریخ میلادی معتبر وارد کنید.</p>
                )}
              </div>

              {/* Tool B: Clinical Follow-up Calculator (+Days / +Months) */}
              <div className="bg-white rounded-2xl p-3 border border-emerald-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  <span>محاسبه هوشمند موعد درمان، هیلینگ ایمپلنت و ریکال</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '+۱۴ روز (بخیه)', amt: 14, unit: 'days' as const },
                    { label: '+۴۵ روز (قالب)', amt: 45, unit: 'days' as const },
                    { label: '+۹۰ روز (ایمپلنت)', amt: 90, unit: 'days' as const },
                    { label: '+۶ ماه (ریکال)', amt: 6, unit: 'months' as const }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setOffsetAmount(preset.amt);
                        setOffsetUnit(preset.unit);
                      }}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer ${
                        offsetAmount === preset.amt && offsetUnit === preset.unit
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    max={730}
                    aria-label="تعداد روز یا ماه برای محاسبه موعد"
                    value={offsetAmount}
                    onChange={(e) => setOffsetAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 min-h-[36px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono font-bold text-center text-slate-900"
                  />
                  <select
                    aria-label="واحد محاسبه موعد درمان"
                    value={offsetUnit}
                    onChange={(e) => setOffsetUnit(e.target.value as 'days' | 'months')}
                    className="min-h-[36px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-800"
                  >
                    <option value="days">روز پس از {toPersianDigits(selectedDateStr)}</option>
                    <option value="months">ماه پس از {toPersianDigits(selectedDateStr)}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => selectDateString(clinicalTargetPreview.jalali)}
                    className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
                  >
                    پرش به {clinicalTargetPreview.jalali}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddAppointmentForDate(clinicalTargetPreview.jalali)}
                    className="min-h-[36px] px-3 rounded-xl bg-[#c8ff00] hover:bg-[#bbf000] text-black text-[11px] font-black cursor-pointer"
                  >
                    + نوبت آن روز
                  </button>
                </div>
                <div className="text-[11px] font-bold text-slate-700">
                  نتیجه دقیق: <span className="font-black text-emerald-900">{clinicalTargetPreview.weekdayName} {clinicalTargetPreview.jalali}</span>
                  {' · '}
                  <span className="font-mono" dir="ltr">{clinicalTargetPreview.gregorian.formattedEn}</span>
                  {' · '}
                  <span className="text-indigo-700">{clinicalTargetPreview.hijri.formatted}</span>
                </div>
              </div>
            </div>

            {/* Tool C: Full Iranian Occasions & Holidays Digest for Currently Viewed Month */}
            <div className="bg-white rounded-2xl p-3 border border-rose-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  <span>تقویم مناسبت‌ها و تعطیلات رسمی {PERSIAN_MONTHS[selectedMonth]} {toPersianDigits(selectedYear)}</span>
                </div>
                <span className="text-[10.5px] font-bold text-slate-500">
                  {toPersianDigits(monthOccasionsDigest.length)} روز دارای مناسبت
                </span>
              </div>
              {monthOccasionsDigest.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-500">در این ماه مناسبت رسمی خاصی ثبت نشده است (صرفاً جمعه‌ها تعطیل هستند).</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {monthOccasionsDigest.map(item => (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => selectDateString(item.dateStr)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border text-right cursor-pointer transition-all ${
                        item.isHoliday
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                      }`}
                    >
                      <span className="font-mono font-black">{toPersianDigits(item.day)} {PERSIAN_MONTHS[selectedMonth]}</span>
                      {' · '}
                      <span>{item.occasions.map(o => o.title).join(' / ')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cross-Module Layer Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'all', label: 'همه لایه‌ها' },
            { id: 'appointments', label: 'نوبت‌ها' },
            { id: 'financial', label: 'چک و اقساط' },
            { id: 'payments', label: 'دریافتی مالی' },
            { id: 'lab', label: 'لابراتوار' },
            { id: 'implant', label: 'ایمپلنت' },
            { id: 'reminders', label: 'یادآوری و ریکال' }
          ].map(item => {
            const active = layerFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setLayerFilter(item.id as CalendarLayerFilter);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-[11px] font-black whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                  active
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Calendar Matrix: Monthly vs Weekly vs 12-Month Yearly Overview */}
        {calendarSubMode === 'monthly' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-black text-slate-500">
              {WEEKDAY_HEADERS.map((w, idx) => (
                <span key={w} className={idx === 6 ? 'text-rose-600' : ''}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {Array.from({ length: startOffset }).map((_, emptyIdx) => (
                <div key={`full-empty-${emptyIdx}`} aria-hidden="true" className="min-h-[54px] sm:min-h-[68px]" />
              ))}
              {daysArray.map(day => {
                const cellDateStr = formatPersianDateString(selectedYear, selectedMonth + 1, day);
                const isSelected = day === selectedDay;
                const isToday = isSamePersianDate(cellDateStr, todayStr);
                const occasion = getIranianDateOccasions(cellDateStr, scheduleSettings);
                const agg = getDayAggregate(cellDateStr);

                const aptCount = showApts ? agg.appointments.length : 0;
                const finCount =
                  (showFinancial ? agg.checks.length + agg.installments.length : 0) +
                  (showPayments ? agg.payments.length : 0);
                const labCount = showLab ? agg.labOrders.length : 0;
                const impRemCount =
                  (showImplant ? agg.implants.length : 0) +
                  (showReminders ? agg.recalls.length + agg.reminders.filter(r => r.status !== 'done').length : 0);

                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={`روز ${toPersianDigits(day)} ${PERSIAN_MONTHS[selectedMonth]} ${toPersianDigits(selectedYear)}`}
                    title={
                      occasion.reason
                        ? `${occasion.reason} · ${occasion.gregorian.formattedEn} · ${occasion.hijri.formatted}`
                        : `${cellDateStr} · ${occasion.gregorian.formattedEn} · ${occasion.hijri.formatted}`
                    }
                    onClick={() => {
                      triggerHaptic('selection');
                      onSelectDate(selectedYear, selectedMonth, day);
                    }}
                    className={`min-h-[56px] sm:min-h-[70px] p-1 sm:p-1.5 rounded-2xl border flex flex-col justify-between items-stretch text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-700 shadow-sm ring-2 ring-sky-300'
                        : isToday
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-400 hover:bg-emerald-100/80'
                          : occasion.isHoliday
                            ? 'bg-rose-50/80 text-rose-800 border-rose-200 hover:bg-rose-100/70'
                            : 'bg-slate-50/90 text-slate-800 border-slate-200/80 hover:bg-sky-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-0.5 w-full">
                      <span className="text-xs sm:text-sm font-mono font-black tabular-nums leading-none">
                        {toPersianDigits(day)}
                      </span>
                      <span
                        className={`text-[8.5px] font-mono tabular-nums leading-none hidden sm:inline ${
                          isSelected ? 'text-sky-100' : 'text-slate-400'
                        }`}
                        dir="ltr"
                      >
                        {occasion.gregorian.day}
                      </span>
                    </div>

                    {/* Multi-Module Visual Indicators */}
                    <div className="flex flex-wrap items-center gap-0.5 mt-1">
                      {aptCount > 0 && (
                        <span
                          className={`px-1 py-0.2 rounded text-[8.5px] font-mono font-black leading-tight ${
                            isSelected ? 'bg-[#c8ff00] text-black' : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          ن:{toPersianDigits(aptCount)}
                        </span>
                      )}
                      {finCount > 0 && (
                        <span
                          className={`px-1 py-0.2 rounded text-[8.5px] font-mono font-black leading-tight ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          م:{toPersianDigits(finCount)}
                        </span>
                      )}
                      {labCount > 0 && (
                        <span
                          className={`px-1 py-0.2 rounded text-[8.5px] font-mono font-black leading-tight ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          ل:{toPersianDigits(labCount)}
                        </span>
                      )}
                      {impRemCount > 0 && (
                        <span
                          className={`px-1 py-0.2 rounded text-[8.5px] font-mono font-black leading-tight ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          ی:{toPersianDigits(impRemCount)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {calendarSubMode === 'weekly' && (
          /* 7-Day Iranian Weekly Strip (Saturday to Friday) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {weekDates.map(wDate => {
              const p = parsePersianDate(wDate);
              const isSelected = isSamePersianDate(wDate, selectedDateStr);
              const isToday = isSamePersianDate(wDate, todayStr);
              const wName = getPersianWeekdayName(wDate);
              const wShort = getPersianWeekdayShortName(wDate);
              const occ = getIranianDateOccasions(wDate, scheduleSettings);
              const agg = getDayAggregate(wDate);

              return (
                <div
                  key={wDate}
                  onClick={() => selectDateString(wDate)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectDateString(wDate);
                    }
                  }}
                  className={`rounded-2xl border p-2.5 space-y-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-50/90 border-sky-500 ring-2 ring-sky-200'
                      : isToday
                        ? 'bg-emerald-50/70 border-emerald-400'
                        : occ.isHoliday
                          ? 'bg-rose-50/70 border-rose-200'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-sky-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                    <div>
                      <div className={`text-[11px] font-black ${occ.isHoliday ? 'text-rose-700' : 'text-slate-900'}`}>
                        {wName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                        {toPersianDigits(p.day)} {PERSIAN_MONTHS[p.month - 1]}
                      </div>
                    </div>
                    <div className="text-left text-[9px] font-mono text-slate-500">
                      <div dir="ltr">{occ.gregorian.day} {occ.gregorian.monthShortEn}</div>
                      <div className="text-indigo-600 font-bold">{toPersianDigits(occ.hijri.day)} {occ.hijri.monthNameFa}</div>
                    </div>
                  </div>

                  {occ.reason && (
                    <div className={`text-[9.5px] font-black truncate ${occ.isHoliday ? 'text-rose-700' : 'text-amber-700'}`}>
                      {occ.reason}
                    </div>
                  )}

                  <div className="space-y-1 text-[10px]">
                    {showApts && agg.appointments.slice(0, 3).map(apt => (
                      <div key={apt.id} className="p-1.5 rounded-lg bg-white border border-sky-200 text-slate-900 truncate">
                        <span className="font-mono font-black text-sky-700">{toPersianDigits(apt.time)}</span>
                        {' · '}
                        <span className="font-bold">{apt.patientName}</span>
                      </div>
                    ))}
                    {showFinancial && agg.checks.map(c => (
                      <div key={c.id} className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-bold truncate">
                        چک {c.patient.fullName} · {formatToman(c.amount)}
                      </div>
                    ))}
                    {showFinancial && agg.installments.map(ins => (
                      <div key={ins.id} className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold truncate">
                        قسط {ins.patient.fullName} · {formatToman(ins.amount)}
                      </div>
                    ))}
                    {showPayments && agg.payments.slice(0, 2).map(pay => (
                      <div key={pay.id} className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold truncate">
                        پرداخت: {pay.patient.fullName}
                      </div>
                    ))}
                    {showLab && agg.labOrders.map(l => (
                      <div key={l.id} className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold truncate">
                        لاب: {l.patient.fullName} ({l.eventKind})
                      </div>
                    ))}
                    {showImplant && agg.implants.map(imp => (
                      <div key={imp.id} className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold truncate">
                        ایمپلنت: {imp.patient.fullName}
                      </div>
                    ))}
                    {showReminders && agg.recalls.map(rec => (
                      <div key={rec.id} className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold truncate">
                        ریکال: {rec.patient.fullName}
                      </div>
                    ))}
                    {showReminders && agg.reminders.map(r => (
                      <div key={r.id} className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold truncate">
                        یادآور: {r.title}
                      </div>
                    ))}
                    {agg.appointments.length === 0 &&
                      agg.checks.length === 0 &&
                      agg.installments.length === 0 &&
                      agg.payments.length === 0 &&
                      agg.labOrders.length === 0 &&
                      agg.implants.length === 0 &&
                      agg.recalls.length === 0 &&
                      agg.reminders.length === 0 && (
                        <span className="text-[10px] text-slate-400 font-bold block py-1">
                          {wShort}: بدون رویداد ثبت‌شده
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {calendarSubMode === 'yearly' && (
          /* 12-Month Full Solar Year Overview */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {yearlyMonthsStats.map(m => {
              const isCurrentMonthCard = m.mIdx === selectedMonth;
              return (
                <div
                  key={m.mName}
                  className={`rounded-2xl border p-2.5 space-y-2 transition-all ${
                    isCurrentMonthCard
                      ? 'bg-sky-50/70 border-sky-400 ring-1 ring-sky-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 border-b border-slate-200/70 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onSelectDate(selectedYear, m.mIdx, Math.min(selectedDay, m.mDays));
                        setCalendarSubMode('monthly');
                      }}
                      className="text-xs font-black text-slate-950 hover:text-sky-700 cursor-pointer"
                    >
                      {m.mName} {toPersianDigits(selectedYear)}
                    </button>
                    <div className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold">
                      {m.apts > 0 && <span className="text-sky-700">{toPersianDigits(m.apts)} نوبت</span>}
                      {m.financial > 0 && <span className="text-purple-700">{toPersianDigits(m.financial)} مالی</span>}
                      {m.clinical > 0 && <span className="text-indigo-700">{toPersianDigits(m.clinical)} بالینی</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-slate-400">
                    {WEEKDAY_MICRO.map((w, idx) => (
                      <span key={w} className={idx === 6 ? 'text-rose-500' : ''}>{w}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: m.startOff }).map((_, eIdx) => (
                      <div key={`yr-emp-${m.m1}-${eIdx}`} aria-hidden="true" className="h-6" />
                    ))}
                    {Array.from({ length: m.mDays }, (_, dIdx) => dIdx + 1).map(day => {
                      const dStr = formatPersianDateString(selectedYear, m.m1, day);
                      const isSel = isSamePersianDate(dStr, selectedDateStr);
                      const isTod = isSamePersianDate(dStr, todayStr);
                      const occ = getIranianDateOccasions(dStr, scheduleSettings);
                      const agg = getDayAggregate(dStr);
                      const hasEvents =
                        agg.appointments.length +
                          agg.checks.length +
                          agg.installments.length +
                          agg.labOrders.length +
                          agg.implants.length +
                          agg.recalls.length +
                          agg.reminders.length >
                        0;

                      return (
                        <button
                          key={day}
                          type="button"
                          title={occ.reason || dStr}
                          onClick={() => {
                            triggerHaptic('selection');
                            onSelectDate(selectedYear, m.mIdx, day);
                            setCalendarSubMode('monthly');
                          }}
                          className={`relative h-6 rounded-lg text-[10px] font-mono tabular-nums flex items-center justify-center cursor-pointer ${
                            isSel
                              ? 'bg-sky-600 text-white font-black'
                              : isTod
                                ? 'bg-emerald-100 text-emerald-950 font-black border border-emerald-400'
                                : occ.isHoliday
                                  ? 'text-rose-700 bg-rose-50/80 hover:bg-rose-100 font-bold'
                                  : 'text-slate-700 hover:bg-white'
                          }`}
                        >
                          <span>{toPersianDigits(day)}</span>
                          {hasEvents && !isSel && (
                            <span className="w-1 h-1 rounded-full bg-sky-600 absolute bottom-0.5" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Tri-Calendar Selected Day Banner + Official/Lunar Occasions + Holiday Toggle */}
      <div className="bg-white rounded-[22px] p-4 border border-indigo-200/90 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarIcon className="w-4 h-4 text-sky-600 shrink-0" />
              <h3 className="text-sm sm:text-base font-black text-slate-950">
                {getPersianWeekdayName(selectedDateStr)}، {toPersianDigits(selectedDay)} {PERSIAN_MONTHS[selectedMonth]} {toPersianDigits(selectedYear)}
              </h3>
              <span className="text-xs font-bold text-slate-500">
                {diffFromToday === 0
                  ? '(امروز)'
                  : diffFromToday > 0
                    ? `(${toPersianDigits(diffFromToday)} روز دیگر)`
                    : `(${toPersianDigits(Math.abs(diffFromToday))} روز پیش)`}
              </span>
            </div>

            {/* Clean unboxed Tri-Calendar Equivalents */}
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 flex-wrap">
              <span dir="ltr" className="font-mono tabular-nums text-sky-800">
                {selectedOccasion.gregorian.formattedEn} ({selectedOccasion.gregorian.formattedFa})
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-indigo-800">
                قمری: {selectedOccasion.hijri.formatted} ({selectedOccasion.hijri.formattedNumeric})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                if (selectedOccasion.isCustomHoliday) {
                  handleToggleClinicHoliday();
                } else {
                  setShowCustomHolidayForm(prev => !prev);
                }
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                selectedOccasion.isCustomHoliday
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{selectedOccasion.isCustomHoliday ? 'لغو تعطیلی مطب در این روز' : 'ثبت تعطیلی مطب در این روز'}</span>
            </button>

            <button
              type="button"
              onClick={onSwitchToBoardForSelectedDay}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>بورد یونیت‌های این روز</span>
            </button>
          </div>
        </div>

        {/* Iranian Solar, Lunar & Clinic Occasions List */}
        {selectedOccasion.occasions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
            {selectedOccasion.occasions.map((occ, i) => (
              <span
                key={`${occ.type}-${i}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black text-[11px] ${
                  occ.type === 'official_holiday' || occ.type === 'lunar_holiday' || occ.type === 'clinic_holiday' || occ.type === 'friday'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : occ.type === 'medical'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>{occ.title}</span>
              </span>
            ))}
          </div>
        )}

        {/* Inline Custom Clinic Holiday Input */}
        {showCustomHolidayForm && !selectedOccasion.isCustomHoliday && (
          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="دلیل تعطیلی مطب (مثلاً کنگره دندانپزشکی یا تعمیرات یونیت)"
              aria-label="دلیل تعطیلی مطب در این روز"
              value={holidayReasonInput}
              onChange={(e) => setHolidayReasonInput(e.target.value)}
              className="flex-1 min-w-[200px] min-h-[38px] bg-white border border-rose-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
            />
            <button
              type="button"
              onClick={handleToggleClinicHoliday}
              className="min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
            >
              تایید تعطیلی مطب
            </button>
          </div>
        )}

        {/* 3. Zero-to-100 Cross-Module Action Launcher Strip */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-black text-slate-500">
            ثبت و دسترسی مستقیم صفر تا صد کلینیک برای {toPersianDigits(selectedDateStr)}:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenAddAppointmentForDate(selectedDateStr)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#c8ff00] hover:bg-[#bbf000] text-black border border-lime-400 text-xs font-black flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>ثبت نوبت جدید</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setShowQuickRemForm(prev => !prev);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>ثبت یادآوری این روز</span>
            </button>
            {onOpenCheckModal && (
              <button
                type="button"
                onClick={onOpenCheckModal}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>ثبت چک صیادی</span>
              </button>
            )}
            {onOpenPaymentModal && (
              <button
                type="button"
                onClick={onOpenPaymentModal}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>ثبت دریافتی مالی</span>
              </button>
            )}
            {onOpenLabModal && (
              <button
                type="button"
                onClick={onOpenLabModal}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>سفارش لابراتوار</span>
              </button>
            )}
            {onNavigateToModule && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateToModule('patients')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>پرونده بیماران</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToModule('implant')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>ایمپلنت</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToModule('financial')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>مالی کامل</span>
                </button>
              </>
            )}
          </div>

          {/* Inline Quick Reminder Registration Form Scoped to selectedDateStr */}
          {showQuickRemForm && (
            <form
              onSubmit={handleSaveQuickReminder}
              className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2"
            >
              <div className="text-xs font-black text-amber-950">
                ثبت یادآوری جدید در تاریخ {toPersianDigits(selectedDateStr)}:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="عنوان یادآوری (مثلاً تماس پیگیری بخیه ایمپلنت)"
                  aria-label="عنوان یادآوری در تقویم"
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  className="sm:col-span-2 min-h-[38px] bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                />
                <select
                  aria-label="انتخاب بیمار برای یادآوری تقویم"
                  value={remPatientId}
                  onChange={(e) => setRemPatientId(e.target.value)}
                  className="min-h-[38px] bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="">یادداشت عمومی کلینیک</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="ساعت یادآوری تقویم"
                  value={remTime}
                  onChange={(e) => setRemTime(e.target.value)}
                  placeholder="۱۰:۰۰"
                  className="min-h-[38px] bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 text-center"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickRemForm(false)}
                  className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[36px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                >
                  ذخیره یادآوری در تقویم
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 4. Selected-Day Cross-Module Omni-Agenda */}
      <div className="bg-white rounded-[22px] p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600" />
            <h4 className="text-xs sm:text-sm font-black text-slate-950">
              دستور کار کامل روز ({toPersianDigits(selectedAgendaCount)} مورد)
            </h4>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            پوشش یکپارچه نوبت‌ها، چک و اقساط، دریافتی‌ها، لابراتوار، ایمپلنت، ریکال و یادآوری‌ها
          </span>
        </div>

        {selectedAgendaCount === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500">
              در تاریخ {toPersianDigits(selectedDateStr)} هیچ رویدادی در لایه انتخاب‌شده ثبت نشده است.
            </p>
            <button
              type="button"
              onClick={() => onOpenAddAppointmentForDate(selectedDateStr)}
              className="min-h-[38px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
            >
              + ثبت اولین نوبت در این تاریخ
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Appointments */}
            {showApts && selectedDayAgg.appointments.map(apt => {
              const matchedPatient = patientLookupById.get(apt.patientId);
              return (
                <div
                  key={apt.id}
                  className="p-3 rounded-2xl bg-sky-50/60 border border-sky-200 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-mono font-black text-sky-800">{toPersianDigits(apt.time)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-black text-slate-950">{apt.patientName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-600 font-bold">{apt.unit}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-bold">
                      {apt.treatment} · {apt.doctor}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {matchedPatient && onOpenPatientFile && (
                      <button
                        type="button"
                        onClick={() => onOpenPatientFile(matchedPatient)}
                        className="min-h-[34px] px-2.5 rounded-xl bg-white border border-sky-200 text-sky-800 text-[11px] font-black cursor-pointer hover:bg-sky-100"
                      >
                        پرونده بیمار
                      </button>
                    )}
                    {onStartClinicalFlow && (
                      <button
                        type="button"
                        onClick={() => onStartClinicalFlow(apt)}
                        className="min-h-[34px] px-2.5 rounded-xl bg-sky-600 text-white text-[11px] font-black cursor-pointer hover:bg-sky-700"
                      >
                        چارت پالمر / درمان
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Sayad Checks & Guarantee Checks */}
            {showFinancial && selectedDayAgg.checks.map(chk => {
              const patInsts = chk.patient.installments || [];
              const unpaidInstsCount = patInsts.filter(i => i.status !== 'paid').length;
              const isGuaranteeReady =
                chk.isGuarantee &&
                chk.status !== 'cleared' &&
                unpaidInstsCount === 0 &&
                chk.patient.balance >= 0;

              return (
              <div
                key={chk.id}
                className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
                  chk.isGuarantee
                    ? 'bg-indigo-50/75 border-indigo-200'
                    : 'bg-purple-50/70 border-purple-200'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <CreditCard className={`w-3.5 h-3.5 ${chk.isGuarantee ? 'text-indigo-700' : 'text-purple-700'}`} />
                    <span className={`font-black ${chk.isGuarantee ? 'text-indigo-950' : 'text-purple-950'}`}>
                      {chk.isGuarantee ? 'سررسید چک ضمانت' : 'سررسید چک صیادی'}: {chk.patient.fullName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-mono font-black tabular-nums ${chk.isGuarantee ? 'text-indigo-800' : 'text-purple-800'}`}>
                      {formatToman(chk.amount)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                        chk.status === 'cleared'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : isGuaranteeReady
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : chk.isGuarantee
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                              : 'bg-amber-100 text-amber-900 border-amber-200'
                      }`}
                    >
                      {chk.status === 'cleared'
                        ? chk.isGuarantee
                          ? 'ضمانت عودت شده ✓'
                          : 'وصول شده ✓'
                        : isGuaranteeReady
                          ? 'اقساط تسویه · آماده عودت به بیمار ✓'
                          : chk.isGuarantee
                            ? `امانی در گاوصندوق (${toPersianDigits(unpaidInstsCount)} قسط باز)`
                            : 'در جریان وصول'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    بانک {chk.bankName} · صیاد: <span className="font-mono">{toPersianDigits(chk.sayadId)}</span>
                    {patInsts.length > 0 && (
                      <span>
                        {' '}· پیشرفت اقساط: {toPersianDigits(patInsts.length - unpaidInstsCount)} از {toPersianDigits(patInsts.length)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenPatientFile && (
                    <button
                      type="button"
                      onClick={() => onOpenPatientFile(chk.patient, 'financial')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-white border border-purple-200 text-purple-800 text-[11px] font-black cursor-pointer hover:bg-purple-100"
                    >
                      امور مالی بیمار
                    </button>
                  )}
                  {onNavigateToModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToModule('financial')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-purple-600 text-white text-[11px] font-black cursor-pointer hover:bg-purple-700"
                    >
                      مدیریت چک‌ها
                    </button>
                  )}
                </div>
              </div>
              );
            })}

            {/* Installments */}
            {showFinancial && selectedDayAgg.installments.map(ins => {
              const patChecks = ins.patient.sayadChecks || [];
              const linkedSayad = patChecks.find(
                c => !c.isGuarantee && (c.id.includes(ins.id) || c.amount === ins.amount)
              );
              const guaranteeChk = patChecks.find(c => c.isGuarantee);

              return (
              <div
                key={ins.id}
                className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Wallet className="w-3.5 h-3.5 text-rose-700" />
                    <span className="font-black text-rose-950">
                      قسط {toPersianDigits(ins.installmentNumber)} از {toPersianDigits(ins.totalInstallments)}: {ins.patient.fullName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-black text-rose-800 tabular-nums">{formatToman(ins.amount)}</span>
                    {linkedSayad ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black">
                        وثیقه: چک صیادی {linkedSayad.bankName}
                      </span>
                    ) : guaranteeChk ? (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black">
                        وثیقه: چک ضمانت امانی {guaranteeChk.bankName}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    بابت {ins.treatmentName} · وضعیت: {ins.status === 'paid' ? 'پرداخت‌شده ✓' : ins.status === 'overdue' ? 'معوقه' : 'در انتظار وصول'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenPatientFile && (
                    <button
                      type="button"
                      onClick={() => onOpenPatientFile(ins.patient, 'financial')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-white border border-rose-200 text-rose-800 text-[11px] font-black cursor-pointer hover:bg-rose-100"
                    >
                      پرونده اقساط
                    </button>
                  )}
                  {onNavigateToModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToModule('financial')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-rose-600 text-white text-[11px] font-black cursor-pointer hover:bg-rose-700"
                    >
                      ثبت وصول قسط
                    </button>
                  )}
                </div>
              </div>
              );
            })}

            {/* Payments / Receipts */}
            {showPayments && selectedDayAgg.payments.map(pay => (
              <div
                key={pay.id}
                className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-black text-emerald-950">
                      {pay.isRefund ? 'عودت وجه' : 'دریافتی مالی'}: {pay.patient.fullName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-black text-emerald-800 tabular-nums">{formatToman(Math.abs(pay.amount))}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    بابت {pay.forTreatment} · روش پرداخت: {methodFaLabel(pay.method)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenPatientFile && (
                    <button
                      type="button"
                      onClick={() => onOpenPatientFile(pay.patient, 'financial')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-[11px] font-black cursor-pointer hover:bg-emerald-100"
                    >
                      رسید و پرونده مالی
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Lab Orders */}
            {showLab && selectedDayAgg.labOrders.map(lab => (
              <div
                key={lab.id}
                className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <FlaskConical className="w-3.5 h-3.5 text-indigo-700" />
                    <span className="font-black text-indigo-950">
                      {lab.eventKind}: {lab.patient.fullName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-indigo-800 font-bold">{lab.workType}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    دندان {toPersianDigits(lab.toothNumber)} · لابراتوار {lab.labName}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenPatientFile && (
                    <button
                      type="button"
                      onClick={() => onOpenPatientFile(lab.patient, 'lab')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-white border border-indigo-200 text-indigo-800 text-[11px] font-black cursor-pointer hover:bg-indigo-100"
                    >
                      سوابق لابراتوار بیمار
                    </button>
                  )}
                  {onNavigateToModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToModule('lab')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-indigo-600 text-white text-[11px] font-black cursor-pointer hover:bg-indigo-700"
                    >
                      ماژول لابراتوار
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Implant Milestones */}
            {showImplant && selectedDayAgg.implants.map(imp => (
              <div
                key={imp.id}
                className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Stethoscope className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-black text-emerald-950">
                      {imp.eventKind}: {imp.patient.fullName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-800 font-bold">برند {imp.brand}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    دندان {toPersianDigits(imp.toothNumber)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenPatientFile && (
                    <button
                      type="button"
                      onClick={() => onOpenPatientFile(imp.patient, 'implant')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-[11px] font-black cursor-pointer hover:bg-emerald-100"
                    >
                      کیس ایمپلنت بیمار
                    </button>
                  )}
                  {onNavigateToModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToModule('implant')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black cursor-pointer hover:bg-emerald-700"
                    >
                      ماژول ایمپلنت
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Periodic Recalls */}
            {showReminders && selectedDayAgg.recalls.map(rec => (
              <div
                key={rec.id}
                className="p-3 rounded-2xl bg-cyan-50/80 border border-cyan-200 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-700" />
                    <span className="font-black text-cyan-950">
                      سررسید ریکال و معاینه دوره‌ای: {rec.patient.fullName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    دوره پیگیری هر {toPersianDigits(rec.recallMonths || 6)} ماه · شماره تماس: <span className="font-mono">{toPersianDigits(rec.patient.phone)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenAddAppointmentForDate(selectedDateStr, rec.patient)}
                    className="min-h-[34px] px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-black cursor-pointer"
                  >
                    + ثبت نوبت ریکال
                  </button>
                </div>
              </div>
            ))}

            {/* Custom & Clinical Reminders */}
            {showReminders && selectedDayAgg.reminders.map(rem => (
              <div
                key={rem.id}
                className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
                  rem.status === 'done'
                    ? 'bg-slate-50 border-slate-200 opacity-75'
                    : 'bg-amber-50/80 border-amber-200'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <BellRing className="w-3.5 h-3.5 text-amber-700" />
                    <span className="font-black text-slate-950">{rem.title}</span>
                    {rem.targetTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-bold text-amber-800">{toPersianDigits(rem.targetTime)}</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 font-bold">
                    {rem.patientName} · {rem.description}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {rem.status !== 'done' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          markReminderDone(rem.id);
                          setRemRevision(r => r + 1);
                          onShowToast(`یادآوری «${rem.title}» انجام‌شده ثبت شد.`);
                        }}
                        className="min-h-[34px] px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>انجام شد</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          snoozeReminder(rem.id, 60);
                          setRemRevision(r => r + 1);
                          onShowToast(`یادآوری «${rem.title}» به مدت ۶۰ دقیقه اسنوز شد.`);
                        }}
                        className="min-h-[34px] px-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <AlarmClock className="w-3.5 h-3.5" />
                        <span>اسنوز ۶۰د</span>
                      </button>
                    </>
                  )}
                  {onNavigateToModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToModule('reminders')}
                      className="min-h-[34px] px-2.5 rounded-xl bg-amber-600 text-white text-[11px] font-black cursor-pointer hover:bg-amber-700"
                    >
                      بخش یادآوری‌ها
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
