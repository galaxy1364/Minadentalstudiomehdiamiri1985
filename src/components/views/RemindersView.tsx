import React, { useMemo, useState } from 'react';
import {
  BellRing,
  Calendar,
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileCheck2,
  FolderOpen,
  HeartPulse,
  MessageCircle,
  MessageSquare,
  Moon,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Square,
  Trash2,
  UserCheck,
  Volume2,
  X,
  Zap,
  AlarmClock,
  AlertTriangle,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';
import * as d3 from 'd3';
import {
  toPersianDigits,
  toEnglishDigits,
  getRelativePersianDate,
  getCurrentPersianDate,
  addDaysToPersianDate,
  getPersianWeekdayShortName,
  formatToman
} from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { clinicalSmsService, SmsLogItem } from '../../services/smsService';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import {
  Patient,
  Appointment,
  InventoryItem,
  SayadCheck,
  Installment,
  ReminderChannel,
  ReminderRecurrence,
  UnifiedReminderRecord,
  UnifiedReminderSourceType
} from '../../types/dental';
import { normalizePhoneForWhatsApp } from '../../utils/appointmentScheduling';
import { actionFeedback } from '../../utils/actionFeedback';
import { copyTextSafely } from '../../utils/clipboard';
import {
  AppointmentConfirmationState,
  assignReminderToStaff,
  batchMarkRemindersDone,
  batchSnoozeReminders,
  broadcastReminderMeshSync,
  CLINIC_STAFF_ASSIGNMENT_ROLES,
  ClinicReminderSettings,
  DEFAULT_AUTOMATION_RULES,
  evaluateAndDispatchDuePhoneNotifications,
  generateDailyClinicDigestText,
  generateRemindersCsvContent,
  getCustomReminders,
  getPhoneNotificationPermission,
  getReminderAnalyticsSummary,
  getReminderSettings,
  markReminderDone,
  PhoneNotificationPermissionState,
  playCriticalAlarmChime,
  ReminderAutomationRules,
  reopenReminder,
  requestPhoneNotificationPermission,
  saveReminderSettings,
  sendPhoneNotification,
  setAppointmentConfirmationStatus,
  SmartUrgencyTier,
  snoozeReminder,
  SynthesizedClinicReminder,
  synthesizeUnifiedClinicReminders,
  unsnoozeReminder,
  upsertCustomReminder,
  deleteCustomReminder
} from '../../services/reminderNotificationService';

export interface RemindersViewProps {
  onOpenSmsGatewaySettings?: () => void;
  onOpenAppointments?: () => void;
  onNavigateToModule?: (viewId: string) => void;
  onOpenPatientFile?: (
    patient: Patient,
    tab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai'
  ) => void;
  onScheduleSmartAppointment?: (draft: {
    patientName: string;
    phone: string;
    treatment: string;
    unit?: string;
  }) => void;
  onUpdateCheckStatus?: (check: SayadCheck, newStatus: SayadCheck['status']) => void;
  onPayInstallment?: (inst: Installment) => void;
  onOpenAddPayment?: (patient: Patient) => void;
  onOpenAddCheck?: (patientId?: string) => void;
  patients?: Patient[];
  appointments?: Appointment[];
  inventory?: InventoryItem[];
}

type CategoryFilterType =
  | 'all'
  | 'appointment'
  | 'check_installment'
  | 'guarantee_check'
  | 'debtor'
  | 'lab'
  | 'implant'
  | 'recall'
  | 'inventory'
  | 'insurance'
  | 'sterilization'
  | 'custom';

export const RemindersView: React.FC<RemindersViewProps> = ({
  onOpenSmsGatewaySettings,
  onOpenAppointments,
  onNavigateToModule,
  onOpenPatientFile,
  onScheduleSmartAppointment,
  onUpdateCheckStatus,
  onPayInstallment,
  onOpenAddPayment,
  onOpenAddCheck,
  patients = [],
  appointments = [],
  inventory = []
}) => {
  const { impactLight, impactHeavy, success, selection } = useHapticFeedback();

  // Chip navigation: active | snoozed_done | debtors | config | composer | logs
  const [activeChip, setActiveChip] = useState<
    'active' | 'snoozed_done' | 'debtors' | 'config' | 'composer' | 'logs'
  >('active');

  // Search & filter state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sentAlert, setSentAlert] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('minadental_dismissed_reminders_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const [reminderTypeFilter, setReminderTypeFilter] = useState<CategoryFilterType>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | SmartUrgencyTier>('all');
  const [selectedRadarDay, setSelectedRadarDay] = useState<number | 'overdue' | null>(null);
  const [phonePerm, setPhonePerm] = useState<PhoneNotificationPermissionState>(() => getPhoneNotificationPermission());
  const [remindersRevision, setRemindersRevision] = useState<number>(0);
  const [smsCredit, setSmsCredit] = useState<number>(() => clinicalSmsService.getSmsCredit());
  const [confirmDeleteCustomId, setConfirmDeleteCustomId] = useState<string | null>(null);
  const [sweepingDue, setSweepingDue] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedReminderIds, setSelectedReminderIds] = useState<string[]>([]);
  const [digestPreview, setDigestPreview] = useState<string | null>(null);

  // Persistent Unified Reminder Settings
  const [reminderSettings, setReminderSettings] = useState<ClinicReminderSettings>(() => getReminderSettings());

  // Inline custom reminder creator state
  const [showCustomCreator, setShowCustomCreator] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customPatientId, setCustomPatientId] = useState<string>('');
  const [customPatientName, setCustomPatientName] = useState<string>('');
  const [customPatientPhone, setCustomPatientPhone] = useState<string>('');
  const [customSourceType, setCustomSourceType] = useState<UnifiedReminderSourceType>('custom');
  const [customRecurrence, setCustomRecurrence] = useState<ReminderRecurrence>('none');
  const [customTriggerDate, setCustomTriggerDate] = useState<string>(() => getCurrentPersianDate());
  const [customTriggerTime, setCustomTriggerTime] = useState<string>('۱۰:۰۰');
  const [customNote, setCustomNote] = useState<string>('');
  const [customChannels, setCustomChannels] = useState<ReminderChannel[]>(['phone_push', 'in_app']);

  React.useEffect(() => {
    try {
      localStorage.setItem('minadental_dismissed_reminders_v1', JSON.stringify(dismissedIds));
    } catch {}
  }, [dismissedIds]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUpdated = () => {
      setRemindersRevision(r => r + 1);
      setPhonePerm(getPhoneNotificationPermission());
    };
    const onSmsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ remainingCredit?: number }>).detail;
      if (detail && typeof detail.remainingCredit === 'number') {
        setSmsCredit(detail.remainingCredit);
      } else {
        setSmsCredit(clinicalSmsService.getSmsCredit());
      }
    };
    window.addEventListener('minadental:reminders-updated', onUpdated);
    window.addEventListener('minadental:sms-updated', onSmsUpdated);
    return () => {
      window.removeEventListener('minadental:reminders-updated', onUpdated);
      window.removeEventListener('minadental:sms-updated', onSmsUpdated);
    };
  }, []);

  const updatePolicySetting = <K extends keyof ClinicReminderSettings>(
    key: K,
    value: ClinicReminderSettings[K],
    toastMsg = 'تنظیم زمان یادآوری ذخیره شد.'
  ) => {
    selection();
    const updated = saveReminderSettings({ [key]: value });
    setReminderSettings(updated);
    setSentAlert(toastMsg);
    setTimeout(() => setSentAlert(null), 2500);
  };

  const toggleAutomationRule = (ruleKey: keyof ReminderAutomationRules, label: string) => {
    selection();
    const currentRules = { ...DEFAULT_AUTOMATION_RULES, ...(reminderSettings.automationRules || {}) };
    const nextVal = !currentRules[ruleKey];
    const updated = saveReminderSettings({
      automationRules: { ...currentRules, [ruleKey]: nextVal }
    });
    setReminderSettings(updated);
    setSentAlert(`پروتکل خودکار «${label}» ${nextVal ? 'فعال' : 'غیرفعال'} شد.`);
    setTimeout(() => setSentAlert(null), 2600);
  };

  // Custom SMS composer states
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [smsText, setSmsText] = useState(
    'سلام؛ نوبت دندانپزشکی شما فردا ساعت ۱۷:۰۰ در کلینیک دندانپزشکی مینادنتال رزرو شده است. لطفاً در صورت عدم حضور ۱۰ ساعت قبل اطلاع دهید.'
  );

  // Collapsible cards state (default collapsed for compact mobile list)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const [logs, setLogs] = useState<
    Array<{
      id: string;
      to: string;
      phone: string;
      text: string;
      time: string;
      status: string;
      deliveryReceipt?: string;
      refId?: string;
    }>
  >(() => {
    try {
      const saved = localStorage.getItem('minadental_sms_logs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'l1',
        to: 'علی مرادی',
        phone: '۰۹۱۲۳۴۵۶۷۸۹',
        text: 'روکش زیرکونیا دندان ۶ آماده تحویل در کلینیک است.',
        time: 'امروز ۱۰:۱۵',
        status: 'تحویل شده',
        deliveryReceipt: 'تحویل مخابرات ✓'
      },
      {
        id: 'l2',
        to: 'سارا رضایی',
        phone: '۰۹۱۹۸۷۶۵۴۳۲',
        text: 'یادآوری سررسید چک صیادی تاریخ ۲۵ آبان به مبلغ ۱۰ میلیون تومان.',
        time: 'دیروز ۱۸:۳۰',
        status: 'تحویل شده',
        deliveryReceipt: 'تحویل مخابرات ✓'
      },
      {
        id: 'l3',
        to: 'محمد حسینی',
        phone: '۰۹۳۵۱۱۱۱۱۱۱',
        text: 'دستورات پس از جراحی ایمپلنت: کمپرس سرد و مصرف آنتی‌بیوتیک.',
        time: getRelativePersianDate(-1),
        status: 'تحویل شده',
        deliveryReceipt: 'تحویل مخابرات ✓'
      }
    ];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('minadental_sms_logs_v1', JSON.stringify(logs));
    } catch {}
  }, [logs]);

  const patientById = useMemo(() => {
    const map = new Map<string, Patient>();
    for (const p of patients) map.set(p.id, p);
    return map;
  }, [patients]);

  // Unified Live Synthesized Reminders across all 9 clinic pillars
  const liveSynthesizedReminders = useMemo(
    () =>
      synthesizeUnifiedClinicReminders({
        patients,
        appointments,
        inventory,
        settingsOverride: reminderSettings,
        dismissedIds,
        includeSnoozed: false
      }),
    [patients, appointments, inventory, reminderSettings, dismissedIds, remindersRevision]
  );

  // Snoozed & Archived reminders for Snoozed/Done Queue chip
  const snoozedAndDoneQueue = useMemo(() => {
    const allIncludingSnoozed = synthesizeUnifiedClinicReminders({
      patients,
      appointments,
      inventory,
      settingsOverride: reminderSettings,
      dismissedIds: {},
      includeSnoozed: true
    });
    const snoozedItems = allIncludingSnoozed.filter(item => item.isSnoozed);
    const doneCustom = getCustomReminders().filter(r => r.status === 'done');
    const dismissedCount = Object.values(dismissedIds).filter(Boolean).length;
    return { snoozedItems, doneCustom, dismissedCount };
  }, [patients, appointments, inventory, reminderSettings, dismissedIds, remindersRevision]);

  const analytics = useMemo(
    () => getReminderAnalyticsSummary(liveSynthesizedReminders),
    [liveSynthesizedReminders]
  );

  const sevenDayRadar = useMemo(() => {
    const today = getCurrentPersianDate();
    const overdueItems = liveSynthesizedReminders.filter(r => r.daysRemaining < 0);
    const days = [0, 1, 2, 3, 4, 5, 6].map(offset => {
      const dateStr = addDaysToPersianDate(today, offset);
      const dayItems = liveSynthesizedReminders.filter(r => r.daysRemaining === offset);
      const criticalCount = dayItems.filter(r => r.urgency === 'critical').length;
      const label = offset === 0 ? 'امروز' : offset === 1 ? 'فردا' : getPersianWeekdayShortName(dateStr);
      const shortDate = toPersianDigits(dateStr.slice(5));
      return {
        offset,
        label,
        shortDate,
        totalCount: dayItems.length,
        criticalCount
      };
    });
    return {
      overdueCount: overdueItems.length,
      overdueCritical: overdueItems.filter(r => r.urgency === 'critical').length,
      days
    };
  }, [liveSynthesizedReminders]);

  const d3PillarDistribution = useMemo(() => {
    const rawPillars: Array<{
      id: CategoryFilterType;
      label: string;
      count: number;
      criticalCount: number;
      color: string;
    }> = [
      {
        id: 'appointment',
        label: 'نوبت',
        count: analytics.byPillar.appointment,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'appointment' && r.urgency === 'critical').length,
        color: '#0ea5e9'
      },
      {
        id: 'check_installment',
        label: 'چک و قسط',
        count: analytics.byPillar.check + analytics.byPillar.installment,
        criticalCount: liveSynthesizedReminders.filter(r => (r.pillar === 'check' || r.pillar === 'installment') && r.urgency === 'critical').length,
        color: '#f59e0b'
      },
      {
        id: 'debtor',
        label: 'بدهکار',
        count: analytics.byPillar.debtor,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'debtor' && r.urgency === 'critical').length,
        color: '#f43f5e'
      },
      {
        id: 'lab',
        label: 'لابراتوار',
        count: analytics.byPillar.lab,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'lab' && r.urgency === 'critical').length,
        color: '#ec4899'
      },
      {
        id: 'implant',
        label: 'ایمپلنت',
        count: analytics.byPillar.implant,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'implant' && r.urgency === 'critical').length,
        color: '#8b5cf6'
      },
      {
        id: 'recall',
        label: 'ریکال',
        count: analytics.byPillar.recall,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'recall' && r.urgency === 'critical').length,
        color: '#10b981'
      },
      {
        id: 'inventory',
        label: 'انبار',
        count: analytics.byPillar.inventory,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'inventory' && r.urgency === 'critical').length,
        color: '#f97316'
      },
      {
        id: 'insurance',
        label: 'بیمه',
        count: analytics.byPillar.insurance,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'insurance' && r.urgency === 'critical').length,
        color: '#3b82f6'
      },
      {
        id: 'sterilization',
        label: 'CSSD',
        count: analytics.byPillar.sterilization,
        criticalCount: liveSynthesizedReminders.filter(r => r.pillar === 'sterilization' && r.urgency === 'critical').length,
        color: '#14b8a6'
      }
    ];

    const width = 460;
    const height = 132;
    const margin = { top: 14, right: 12, bottom: 26, left: 26 };
    const maxVal = Math.max(2, d3.max(rawPillars, d => d.count) || 2);
    const xScale = d3
      .scaleBand<string>()
      .domain(rawPillars.map(d => d.id))
      .range([margin.left, width - margin.right])
      .padding(0.28);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const baselineY = yScale(0);
    const ticks = yScale.ticks(3).filter(t => Number.isInteger(t));

    return {
      width,
      height,
      margin,
      baselineY,
      ticks,
      xScale,
      yScale,
      bars: rawPillars.map(d => {
        const x = xScale(d.id) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(d.count);
        const h = Math.max(d.count > 0 ? 5 : 2, baselineY - y);
        const critH = d.criticalCount > 0 ? Math.max(3, baselineY - yScale(d.criticalCount)) : 0;
        return {
          ...d,
          x,
          barW,
          y: d.count > 0 ? y : baselineY - 2,
          h,
          critY: baselineY - critH,
          critH
        };
      })
    };
  }, [analytics, liveSynthesizedReminders]);

  const templates = [
    {
      title: 'تایید و یادآوری نوبت',
      text: 'سلام [نام] گرامی؛ نوبت ویزیت و درمان شما در کلینیک دندانپزشکی مینادنتال تاریخ [تاریخ] ساعت [ساعت] ثبت شده است. در صورت نیاز به تغییر ساعت اطلاع دهید.'
    },
    {
      title: 'مطالبه محترمانه بدهی مطب',
      text: 'بیمار گرامی [نام]؛ احتراماً مانده حساب پرونده درمانی شما در کلینیک دندانپزشکی مینادنتال [مبلغ] تومان می‌باشد. لطفاً جهت تسویه با صندوق مطب هماهنگ فرمایید.'
    },
    {
      title: 'آماده بودن روکش / لابراتوار',
      text: 'بیمار گرامی [نام]؛ روکش/پروتز دندان شما از لابراتوار واصل شده است. لطفاً جهت تحویل و سمان با کلینیک مینادنتال تماس حاصل فرمایید.'
    },
    {
      title: 'سررسید چک صیادی',
      text: 'احتراماً یادآوری می‌شود موعد سررسید چک صیادی شما در تاریخ [تاریخ] نزدیک است. با تشکر از خوش‌حسابی شما - کلینیک مینادنتال'
    },
    {
      title: 'تحویل لاشه چک ضمانت امانی',
      text: 'بیمار گرامی [نام]؛ ضمن تشکر از تسویه کامل اقساط درمانی شما، لاشه چک ضمانت امانی پرونده آماده تحویل در پذیرش کلینیک مینادنتال است.'
    },
    {
      title: 'هشدار فوری چک برگشتی صیادی',
      text: 'بیمار گرامی [نام]؛ با توجه به برگشت چک صیادی سررسید [تاریخ]، لطفاً جهت رفع سوءاثر صیادی و هماهنگی تسویه سریعاً با حسابداری مطب تماس بگیرید.'
    },
    {
      title: 'سررسید قسط درمان',
      text: 'بیمار گرامی [نام]؛ موعد پرداخت قسط درمان دندانپزشکی شما فرارسیده است. لطفاً جهت واریز یا هماهنگی اقدام فرمایید.'
    },
    {
      title: 'چکاپ دوره‌ای ۶ ماهه',
      text: 'سلام [نام] عزیز؛ ۶ ماه از آخرین چکاپ دندانپزشکی شما سپری شده است. جهت رزرو وقت معاینه دوره‌ای رایگان با ما تماس بگیرید.'
    }
  ];

  const toggleCollapse = (id: string) => {
    selection();
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSend = async (
    title: string,
    phone = '۰۹۱۲۰۰۰۰۰۰۰',
    recipient = 'بیمار',
    reminderType: string = 'appointment_reminder',
    extraMeta?: { amount?: string; time?: string; dueDate?: string; customText?: string; confirmCode?: string }
  ) => {
    impactHeavy();

    let pType: SmsLogItem['patternType'] = 'appointment_reminder';
    if (extraMeta?.customText || reminderType === 'custom_sms') pType = 'custom';
    else if (reminderType.includes('چک') || reminderType === 'check' || title.includes('چک')) pType = 'sayad_check_due';
    else if (
      reminderType.includes('قسط') ||
      reminderType === 'installment' ||
      reminderType === 'debtor' ||
      title.includes('قسط') ||
      title.includes('بدهی')
    )
      pType = 'installment_due';
    else if (reminderType.includes('لابراتوار') || reminderType === 'lab' || title.includes('روکش')) pType = 'lab_ready';
    else if (reminderType.includes('ایمپلنت') || reminderType === 'implant' || title.includes('ایمپلنت'))
      pType = 'implant_healing_recall';

    const confirmCode =
      extraMeta?.confirmCode ||
      (pType === 'appointment_reminder' ? `MD-${toEnglishDigits(phone).replace(/\D/g, '').slice(-4) || '1024'}` : '');

    const res = await clinicalSmsService.sendPatternSms(phone, recipient, pType, {
      date: extraMeta?.dueDate || getRelativePersianDate(1),
      time: extraMeta?.time || '۱۷:۰۰',
      amount: extraMeta?.amount || 'مطابق پرونده مالی',
      dueDate: extraMeta?.dueDate || getRelativePersianDate(reminderSettings.checkAdvanceDays),
      customText: extraMeta?.customText || '',
      confirmCode
    });

    setSmsCredit(res.remainingCredit);

    actionFeedback.recordSuccess({
      title: `ارسال پیامک هوشمند به ${recipient}`,
      subtitle: `${title} (${phone})`,
      diffBefore: 'در انتظار اطلاع‌رسانی',
      diffAfter: `تحویل به مخابرات (کد: ${res.refId})`,
      badgeText: `✓ پیامک مخابره شد (${res.refId})`
    });

    setSentAlert(`پیامک خدماتی (کد پیگیری: ${res.refId}) به ${recipient} (${phone}) با موفقیت مخابره شد.`);
    setTimeout(() => setSentAlert(null), 3500);

    setLogs(prev => [
      {
        id: `l-${Date.now()}`,
        to: recipient,
        phone: phone,
        text: extraMeta?.customText || title,
        time: 'هم‌اکنون',
        status: 'تحویل شده (خدماتی)',
        deliveryReceipt: res.deliveryReceipt || 'تحویل مخابرات ✓',
        refId: res.refId
      },
      ...prev
    ]);
  };

  const handleMarkDone = (id: string) => {
    impactLight();
    markReminderDone(id);
    setDismissedIds(prev => {
      const next = { ...prev, [id]: true };
      try {
        localStorage.setItem('minadental_dismissed_reminders_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    broadcastReminderMeshSync('dismiss', id);
    try {
      window.dispatchEvent(new CustomEvent('minadental:reminders-updated'));
    } catch {}
    setRemindersRevision(r => r + 1);
    setSentAlert('یادآوری با موفقیت انجام شد و از لیست هشدارهای فعال بایگانی گردید.');
    setTimeout(() => setSentAlert(null), 3000);
  };

  const handleSnoozeItem = (id: string, minutes: number, label: string) => {
    impactLight();
    snoozeReminder(id, minutes);
    setRemindersRevision(r => r + 1);
    setSentAlert(`یادآوری به مدت ${label} به تعویق افتاد (Snooze).`);
    setTimeout(() => setSentAlert(null), 2800);
  };

  const handleCreateCustomReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    success();
    const record: UnifiedReminderRecord = {
      id: `rem-custom-${Date.now()}`,
      sourceType: customSourceType,
      patientId: customPatientId || undefined,
      patientName: customPatientName.trim() || 'یادآوری مطب',
      patientPhone: customPatientPhone.trim() || undefined,
      title: customTitle.trim(),
      description: customNote.trim() || 'ثبت شده در پنل یادآوری هوشمند مینادنتال',
      targetDate: customTriggerDate.trim() || getCurrentPersianDate(),
      triggerDate: customTriggerDate.trim() || getCurrentPersianDate(),
      triggerTime: customTriggerTime.trim() || '۱۰:۰۰',
      channels: customChannels.length > 0 ? customChannels : ['phone_push', 'in_app'],
      status: 'pending',
      recurrence: customRecurrence,
      targetView:
        customSourceType === 'lab'
          ? 'lab'
          : customSourceType === 'implant'
          ? 'implant'
          : customSourceType === 'check' || customSourceType === 'installment'
          ? 'financial'
          : customSourceType === 'appointment'
          ? 'appointments'
          : customSourceType === 'insurance'
          ? 'insurance_claims'
          : customSourceType === 'sterilization'
          ? 'sterilization'
          : customSourceType === 'inventory'
          ? 'inventory'
          : 'reminders',
      createdAt: getCurrentPersianDate()
    };
    upsertCustomReminder(record);
    setRemindersRevision(r => r + 1);
    setCustomTitle('');
    setCustomPatientId('');
    setCustomPatientName('');
    setCustomPatientPhone('');
    setCustomRecurrence('none');
    setCustomNote('');
    setShowCustomCreator(false);
    setSentAlert(`یادآوری «${record.title}» با موفقیت ثبت شد.`);
    setTimeout(() => setSentAlert(null), 3200);
  };

  const handleEnablePhonePush = async () => {
    impactLight();
    const res = await requestPhoneNotificationPermission();
    setPhonePerm(res);
    if (res === 'granted') {
      await sendPhoneNotification({
        id: `test-enable-${Date.now()}`,
        title: 'نوتیفیکیشن گوشی مینادنتال فعال شد ✓',
        body: 'از این پس یادآور نوبت، چک صیادی، قسط، لابراتوار، ایمپلنت و انبار روی گوشی نمایش داده می‌شود.',
        view: 'reminders'
      });
      setSentAlert('نوتیفیکیشن گوشی با موفقیت فعال شد و پیام تست ارسال گردید.');
    } else if (res === 'denied') {
      setSentAlert('دسترسی نوتیفیکیشن توسط مرورگر مسدود است؛ از تنظیمات مرورگر Allow نمایید.');
    } else {
      setSentAlert('مرورگر فعلی از نوتیفیکیشن بومی پشتیبانی نمی‌کند؛ آلارم درون‌برنامه فعال است.');
    }
    setTimeout(() => setSentAlert(null), 4000);
  };

  const handleRunSmartSweep = async () => {
    impactHeavy();
    setSweepingDue(true);
    try {
      const dispatched = await evaluateAndDispatchDuePhoneNotifications({
        patients,
        appointments,
        inventory
      });
      setSentAlert(
        dispatched > 0
          ? `اسکن هوشمند کامل شد: ${toPersianDigits(dispatched)} اعلان سررسیدشده روی گوشی/پیامک مخابره گردید.`
          : 'اسکن هوشمند کامل شد: تمامی هشدارهای سررسید قبلاً مخابره شده‌اند یا مجوز نوتیفیکیشن مرورگر صادر نشده است.'
      );
      setTimeout(() => setSentAlert(null), 3800);
    } finally {
      setSweepingDue(false);
    }
  };

  const handleTriggerSinglePhoneNotification = async (item: SynthesizedClinicReminder) => {
    impactLight();
    let perm = getPhoneNotificationPermission();
    if (perm === 'default') {
      perm = await requestPhoneNotificationPermission();
      setPhonePerm(perm);
    }
    const targetView = item.targetView || 'reminders';
    if (perm === 'granted') {
      const ok = await sendPhoneNotification({
        id: `push-${item.id}-${Date.now()}`,
        title: `یادآوری مینادنتال: ${item.patientName}`,
        body: `${item.title} · ${item.time}`,
        view: targetView,
        patientId: item.patientId,
        requireInteraction: item.urgency === 'critical' || item.legacyType === 'financial'
      });
      setSentAlert(
        ok
          ? `اعلان گوشی برای «${item.patientName}» ارسال شد ✓`
          : `هشدار درون‌برنامه برای «${item.patientName}» ثبت شد.`
      );
    } else {
      setSentAlert(`هشدار برای «${item.patientName}» ثبت شد (برای نوتیف قفل‌صفحه، مجوز مرورگر را فعال کنید).`);
    }
    setTimeout(() => setSentAlert(null), 3200);
  };

  const handleSendCustomSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;
    const personalizedText = smsText
      .trim()
      .replace(/\[نام بیمار\]|\[نام\]/g, recipientName || 'بیمار')
      .replace(/\[تاریخ\]/g, getCurrentPersianDate())
      .replace(/\[ساعت\]/g, '۱۷:۰۰');
    handleSend(
      'پیامک اختصاصی مطب',
      recipientPhone || '۰۹۱۲۰۰۰۰۰۰۰',
      recipientName || 'بیمار',
      'custom_sms',
      { customText: personalizedText }
    );
    setRecipientName('');
    setRecipientPhone('');
  };

  const handleExportRemindersCsv = (items: SynthesizedClinicReminder[]) => {
    const csv = generateRemindersCsvContent(items);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `MinaDental-Reminders-${getCurrentPersianDate().replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        // Non-browser test env
      }
    }
    setSentAlert(`فایل اکسل یادآوری‌ها (${toPersianDigits(items.length)} ردیف) آماده شد.`);
    setTimeout(() => setSentAlert(null), 3000);
  };

  const handleExportLogsCsv = () => {
    const rows = [['مخاطب', 'تلفن', 'متن پیام', 'زمان', 'وضعیت'], ...logs.map(l => [l.to, toEnglishDigits(l.phone), l.text, l.time, l.status])];
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const csv = `\uFEFF${rows.map(r => r.map(esc).join(',')).join('\r\n')}`;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `MinaDental-SMS-Logs.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {}
    }
    setSentAlert('گزارش اکسل پیامک‌های ارسالی آماده شد.');
    setTimeout(() => setSentAlert(null), 3000);
  };

  const normalizeSearch = (v?: string) =>
    toEnglishDigits(v || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();

  const filteredReminders = useMemo(() => {
    return liveSynthesizedReminders.filter(item => {
      if (activeChip === 'debtors' && item.pillar !== 'debtor') return false;
      if (activeChip === 'active') {
        if (reminderTypeFilter === 'appointment' && item.pillar !== 'appointment') return false;
        if (reminderTypeFilter === 'check_installment' && item.pillar !== 'check' && item.pillar !== 'installment')
          return false;
        if (reminderTypeFilter === 'guarantee_check' && !item.isGuaranteeCheck) return false;
        if (reminderTypeFilter === 'debtor' && item.pillar !== 'debtor') return false;
        if (reminderTypeFilter === 'lab' && item.pillar !== 'lab') return false;
        if (reminderTypeFilter === 'implant' && item.pillar !== 'implant') return false;
        if (reminderTypeFilter === 'inventory' && item.pillar !== 'inventory') return false;
        if (reminderTypeFilter === 'recall' && item.pillar !== 'recall') return false;
        if (reminderTypeFilter === 'insurance' && item.pillar !== 'insurance') return false;
        if (reminderTypeFilter === 'sterilization' && item.pillar !== 'sterilization') return false;
        if (reminderTypeFilter === 'custom' && !item.isCustomRecord) return false;

        if (urgencyFilter !== 'all' && item.urgency !== urgencyFilter) return false;
        if (selectedRadarDay === 'overdue' && item.daysRemaining >= 0) return false;
        if (typeof selectedRadarDay === 'number' && item.daysRemaining !== selectedRadarDay) return false;
      }
      const q = normalizeSearch(searchQuery);
      if (!q) return true;
      return (
        normalizeSearch(item.title).includes(q) ||
        normalizeSearch(item.subtitle).includes(q) ||
        normalizeSearch(item.patientName).includes(q) ||
        normalizeSearch(item.phone).includes(q)
      );
    });
  }, [liveSynthesizedReminders, activeChip, reminderTypeFilter, urgencyFilter, selectedRadarDay, searchQuery]);

  const filteredLogs = useMemo(() => {
    const q = normalizeSearch(logSearchQuery);
    if (!q) return logs;
    return logs.filter(
      l => normalizeSearch(l.to).includes(q) || normalizeSearch(l.phone).includes(q) || normalizeSearch(l.text).includes(q)
    );
  }, [logs, logSearchQuery]);

  const urgencyBadgeInfo = (urgency: SmartUrgencyTier) => {
    if (urgency === 'critical') return { label: 'بحرانی و فوری', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
    if (urgency === 'high') return { label: 'نزدیک سررسید', cls: 'bg-amber-100 text-amber-900 border-amber-200' };
    if (urgency === 'medium') return { label: 'هفته جاری', cls: 'bg-sky-50 text-sky-800 border-sky-200' };
    return { label: 'آینده', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  return (
    <div dir="rtl" className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3">
      {/* Toast Alert */}
      {sentAlert && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-emerald-600 border border-emerald-500 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="w-6 h-6 rounded-full bg-white text-emerald-700 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-xs font-bold leading-tight">{sentAlert}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('amber')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <BellRing className="w-4.5 h-4.5 stroke-[2.25]" />
              </div>
              <div className="text-right min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">
                  مرکز فرماندهی یادآوری‌های هوشمند
                </h3>
                <span className="text-[10.5px] font-bold text-amber-800 mt-1 block truncate">
                  پایش ۱۱ لایه: نوبت، چک، اقساط، بدهی، لابراتوار، ایمپلنت، ریکال، انبار، بیمه و اتوکلاو
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجوی یادآوری"
                aria-label="جستجوی یادآوری"
              >
                <Search className="w-4 h-4" />
              </button>

              {onOpenSmsGatewaySettings && (
                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    onOpenSmsGatewaySettings();
                  }}
                  className="min-h-[38px] py-1 px-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  title="تنظیمات وب‌سرویس پیامک (فراز اس‌ام‌اس، کاوه‌نگار، ملی‌پیامک)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">درگاه پیامک</span>
                </button>
              )}

              <div className="flex items-center gap-1 text-[10.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-xl font-mono font-bold tabular-nums">
                <span>شارژ: {toPersianDigits(smsCredit.toLocaleString('en-US'))}</span>
              </div>
            </div>
          </div>

          {/* 4-Column Compact Urgency Triage Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 border-b border-amber-200/50">
            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('active');
                setUrgencyFilter(prev => (prev === 'critical' ? 'all' : 'critical'));
              }}
              className={`p-2 rounded-2xl border text-right transition-all cursor-pointer ${
                activeChip === 'active' && urgencyFilter === 'critical'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50/70 hover:bg-rose-100/80 border-rose-200 text-rose-950'
              }`}
            >
              <span className="text-[10px] font-bold opacity-85 block">بحرانی و فوری</span>
              <span className="text-sm font-black font-mono tabular-nums mt-0.5 block">
                {toPersianDigits(analytics.criticalCount)} مورد
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('active');
                setUrgencyFilter('all');
                setReminderTypeFilter('all');
              }}
              className="p-2 rounded-2xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-amber-950 text-right transition-all cursor-pointer"
            >
              <span className="text-[10px] font-bold text-amber-800 block">امروز و فردا</span>
              <span className="text-sm font-black font-mono tabular-nums mt-0.5 block">
                {toPersianDigits(analytics.todayTomorrowCount)} سررسید
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('active');
                setReminderTypeFilter('check_installment');
              }}
              className="p-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950 text-right transition-all cursor-pointer"
            >
              <span className="text-[10px] font-bold text-emerald-800 block">
                مالی در معرض وصول ({toPersianDigits(analytics.financialCount)})
              </span>
              <span className="text-xs sm:text-sm font-black font-mono tabular-nums mt-0.5 block truncate">
                {formatToman(analytics.financialAtRiskToman)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('snoozed_done');
              }}
              className="p-2 rounded-2xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100/80 text-sky-950 text-right transition-all cursor-pointer"
            >
              <span className="text-[10px] font-bold text-sky-800 block">تعویق‌یافته / بایگانی</span>
              <span className="text-sm font-black font-mono tabular-nums mt-0.5 block">
                {toPersianDigits(snoozedAndDoneQueue.snoozedItems.length + snoozedAndDoneQueue.doneCustom.length)} مورد
              </span>
            </button>
          </div>

          {/* Animated Search Input */}
          {searchOpen && (
            <div className="relative pt-1 animate-in fade-in slide-in-from-top-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
              <input
                type="text"
                placeholder="جستجو در هشدارها با نام بیمار، تلفن یا موضوع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border border-amber-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="پاک کردن جستجو"
                  className="absolute left-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Horizontal Scrollable Chips Navigation Bar */}
          <div role="tablist" aria-label="بخش‌های ماژول" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              role="tab"
              aria-selected={activeChip === 'active'}
              type="button"
              onClick={() => {
                selection();
                setActiveChip('active');
              }}
              className={getUnifiedChipClasses(3, activeChip === 'active')}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>آلارم‌های هوشمند ({toPersianDigits(liveSynthesizedReminders.length)})</span>
            </button>

            <button
              role="tab"
              aria-selected={activeChip === 'snoozed_done'}
              type="button"
              onClick={() => {
                selection();
                setActiveChip('snoozed_done');
              }}
              className={getUnifiedChipClasses(4, activeChip === 'snoozed_done')}
            >
              <AlarmClock className="w-3.5 h-3.5" />
              <span>
                صف تعویق و انجام‌شده (
                {toPersianDigits(snoozedAndDoneQueue.snoozedItems.length + snoozedAndDoneQueue.doneCustom.length)})
              </span>
            </button>

            <button
              role="tab"
              aria-selected={activeChip === 'debtors'}
              type="button"
              onClick={() => {
                selection();
                setActiveChip('debtors');
              }}
              className={getUnifiedChipClasses(5, activeChip === 'debtors')}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>مطالبات بدهکاران مطب ({toPersianDigits(analytics.byPillar.debtor)})</span>
            </button>

            <button
              role="tab"
              aria-selected={activeChip === 'config'}
              type="button"
              onClick={() => {
                selection();
                setActiveChip('config');
              }}
              className={getUnifiedChipClasses(2, activeChip === 'config')}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>تنظیم روزهای پیش‌فرض یادآوری</span>
            </button>

            <button
              role="tab"
              aria-selected={activeChip === 'composer'}
              type="button"
              onClick={() => {
                selection();
                setActiveChip('composer');
              }}
              className={getUnifiedChipClasses(0, activeChip === 'composer')}
            >
              <Send className="w-3.5 h-3.5 -scale-x-100" />
              <span>ارسال پیامک و الگوها</span>
            </button>

            <button
              role="tab"
              aria-selected={activeChip === 'logs'}
              type="button"
              onClick={() => {
                selection();
                setActiveChip('logs');
              }}
              className={getUnifiedChipClasses(1, activeChip === 'logs')}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>گزارش ارسال‌ها ({toPersianDigits(logs.length)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHIP 1 & DEBTORS: ACTIVE SMART ALARMS & CLINIC DEBTOR FOLLOW-UPS */}
      {(activeChip === 'active' || activeChip === 'debtors') && (
        <div className="mx-2 space-y-2.5">
          {/* Phone Push Notification Banner, Smart Sweep & Custom Reminder Creator */}
          {activeChip === 'active' && (
            <div className="rounded-[20px] p-3 bg-gradient-to-l from-emerald-50 via-white to-amber-50/70 border border-emerald-200/80 shadow-2xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      phonePerm === 'granted' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">
                      {phonePerm === 'granted'
                        ? 'نوتیفیکیشن مستقیم گوشی و PWA فعال است ✓'
                        : phonePerm === 'denied'
                        ? 'نوتیفیکیشن گوشی در مرورگر مسدود است'
                        : 'اتصال یادآوری‌ها به نوتیفیکیشن صفحه قفل گوشی'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 block truncate">
                      موتور یکپارچه نوبت، چک، اقساط، لابراتوار، ایمپلنت، ریکال و انبار
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {phonePerm !== 'granted' ? (
                    <button
                      type="button"
                      onClick={() => void handleEnablePhonePush()}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>فعال‌سازی نوتیف گوشی</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleEnablePhonePush()}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>تست اعلان گوشی</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={sweepingDue}
                    onClick={() => void handleRunSmartSweep()}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sweepingDue ? 'animate-spin' : ''}`} />
                    <span>اسکن و نوتیفای فوری</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      setShowCustomCreator(prev => !prev);
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{showCustomCreator ? 'بستن فرم' : 'یادآوری جدید'}</span>
                  </button>
                </div>
              </div>

              {showCustomCreator && (
                <form
                  onSubmit={handleCreateCustomReminder}
                  className="pt-2.5 border-t border-emerald-200/70 space-y-2 text-[11px] animate-in fade-in"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">عنوان یادآوری *</label>
                      <input
                        type="text"
                        required
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="مثلاً پیگیری جواب CBCT یا تماس تحویل دست‌دندان..."
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">بخش مرتبط</label>
                      <select
                        aria-label="بخش مرتبط یادآوری"
                        value={customSourceType}
                        onChange={(e) => setCustomSourceType(e.target.value as UnifiedReminderSourceType)}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900"
                      >
                        <option value="custom">عمومی / مطب</option>
                        <option value="appointment">نوبت‌دهی</option>
                        <option value="treatment">درمان و پالمر</option>
                        <option value="lab">لابراتوار</option>
                        <option value="implant">ایمپلنت</option>
                        <option value="check">چک صیادی</option>
                        <option value="installment">اقساط</option>
                        <option value="insurance">بیمه و مطالبات</option>
                        <option value="sterilization">اتوکلاو و CSSD</option>
                        <option value="inventory">انبار متریال</option>
                      </select>
                    </div>
                  </div>

                  {patients.length > 0 && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">اتصال سریع به پرونده بیمار (اختیاری)</label>
                      <select
                        aria-label="انتخاب سریع بیمار برای یادآوری جدید"
                        value={customPatientId}
                        onChange={(e) => {
                          const p = patientById.get(e.target.value);
                          setCustomPatientId(e.target.value);
                          if (p) {
                            setCustomPatientName(p.fullName);
                            setCustomPatientPhone(p.phone);
                          }
                        }}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900"
                      >
                        <option value="">بدون اتصال به پرونده یا انتخاب دستی...</option>
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} · {p.fileNumber} ({toPersianDigits(p.phone)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">نام بیمار</label>
                      <input
                        type="text"
                        value={customPatientName}
                        onChange={(e) => setCustomPatientName(e.target.value)}
                        placeholder="نام بیمار..."
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">موبایل</label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={customPatientPhone}
                        onChange={(e) => setCustomPatientPhone(e.target.value)}
                        placeholder="0912..."
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">تاریخ اعلام</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={customTriggerDate}
                        onChange={(e) => setCustomTriggerDate(e.target.value)}
                        placeholder="۱۴۰۵/۰۸/۰۵"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-mono text-center text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">ساعت</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={customTriggerTime}
                        onChange={(e) => setCustomTriggerTime(e.target.value)}
                        placeholder="۱۰:۰۰"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-mono text-center text-slate-900"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="font-bold text-slate-700 block mb-1">تکرار خودکار</label>
                      <select
                        aria-label="چرخه تکرار یادآوری"
                        value={customRecurrence}
                        onChange={(e) => setCustomRecurrence(e.target.value as ReminderRecurrence)}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900"
                      >
                        <option value="none">یک‌بار</option>
                        <option value="daily">روزانه</option>
                        <option value="weekly">هفتگی</option>
                        <option value="monthly">ماهانه</option>
                      </select>
                    </div>
                  </div>

                  {/* Multi-Channel Selection */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-700 ml-1">کانال‌های اعلام:</span>
                    {(
                      [
                        { id: 'phone_push', label: 'نوتیف گوشی' },
                        { id: 'in_app', label: 'بنر داخل برنامه' },
                        { id: 'sms', label: 'پیامک خدماتی' }
                      ] as const
                    ).map(ch => {
                      const active = customChannels.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() =>
                            setCustomChannels(prev =>
                              prev.includes(ch.id) ? prev.filter(c => c !== ch.id) : [...prev, ch.id]
                            )
                          }
                          className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[10.5px] font-black border cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="توضیحات تکمیلی آلارم (اختیاری)..."
                      className="flex-1 bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900"
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer shrink-0"
                    >
                      ثبت یادآوری ✓
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 7-Day Interactive Jalali Radar + D3.js Pillar Analytics + Category Filters */}
          {activeChip === 'active' && (
            <div className="space-y-1.5">
              {/* Interactive D3.js 11-Pillar Burden & Critical Load Chart */}
              <div
                data-testid="reminders-d3-pillar-panel"
                className="bg-white rounded-[20px] p-3 border border-amber-200/80 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[11px] font-black text-slate-900">
                      توزیع زنده ۱۱ لایه هشدار کلینیک (D3.js)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9.5px] font-bold">
                    <span className="flex items-center gap-1 text-slate-600">
                      <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" /> کل سررسیدها
                    </span>
                    <span className="flex items-center gap-1 text-rose-700">
                      <span className="w-2 h-2 rounded-xs bg-rose-600 inline-block" /> لایه بحرانی
                    </span>
                    {reminderTypeFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          selection();
                          setReminderTypeFilter('all');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-black cursor-pointer"
                      >
                        بازنشانی فیلتر ×
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full overflow-x-auto no-scrollbar">
                  <svg
                    data-testid="reminders-d3-pillar-svg"
                    viewBox={`0 0 ${d3PillarDistribution.width} ${d3PillarDistribution.height}`}
                    className="w-full min-w-[320px] h-32 select-none"
                    role="img"
                    aria-label="نمودار D3 توزیع ۱۱ لایه یادآوری‌های هوشمند کلینیک"
                  >
                    {d3PillarDistribution.ticks.map(tick => {
                      const ty = d3PillarDistribution.yScale(tick);
                      return (
                        <g key={`tick-${tick}`}>
                          <line
                            x1={d3PillarDistribution.margin.left}
                            x2={d3PillarDistribution.width - d3PillarDistribution.margin.right}
                            y1={ty}
                            y2={ty}
                            stroke="#e2e8f0"
                            strokeDasharray="3,3"
                          />
                          <text
                            x={d3PillarDistribution.margin.left - 5}
                            y={ty + 3}
                            textAnchor="end"
                            fontSize="8.5"
                            fill="#64748b"
                            fontWeight="700"
                          >
                            {toPersianDigits(tick)}
                          </text>
                        </g>
                      );
                    })}

                    {d3PillarDistribution.bars.map(bar => {
                      const isSelected = reminderTypeFilter === bar.id;
                      return (
                        <g
                          key={bar.id}
                          onClick={() => {
                            selection();
                            setReminderTypeFilter(prev => (prev === bar.id ? 'all' : bar.id));
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            x={bar.x}
                            y={bar.y}
                            width={bar.barW}
                            height={bar.h}
                            rx={5}
                            fill={bar.color}
                            fillOpacity={isSelected ? 1 : 0.78}
                            stroke={isSelected ? '#0f172a' : 'none'}
                            strokeWidth={isSelected ? 1.5 : 0}
                          />
                          {bar.critH > 0 && (
                            <rect
                              x={bar.x + 2}
                              y={bar.critY}
                              width={Math.max(4, bar.barW - 4)}
                              height={bar.critH}
                              rx={3}
                              fill="#e11d48"
                              fillOpacity={0.92}
                            />
                          )}
                          <text
                            x={bar.x + bar.barW / 2}
                            y={bar.y - 4}
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight="800"
                            fill="#1e293b"
                          >
                            {toPersianDigits(bar.count)}
                          </text>
                          <text
                            x={bar.x + bar.barW / 2}
                            y={d3PillarDistribution.height - 8}
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight={isSelected ? '900' : '700'}
                            fill={isSelected ? '#b45309' : '#475569'}
                          >
                            {bar.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* 7-Day Jalali Forecast Radar */}
              <div className="bg-white rounded-[20px] p-2.5 border border-amber-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[11px] font-black text-slate-900">رادار هوشمند ۷ روز آینده</span>
                  </div>
                  {selectedRadarDay !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setSelectedRadarDay(null);
                      }}
                      className="text-[10px] font-black text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg cursor-pointer"
                    >
                      نمایش همه روزها ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                    type="button"
                    aria-label={`فیلتر رادار عقب‌افتاده (${toPersianDigits(sevenDayRadar.overdueCount)} مورد)`}
                    onClick={() => {
                      selection();
                      setSelectedRadarDay(prev => (prev === 'overdue' ? null : 'overdue'));
                    }}
                    className={`min-w-[66px] p-1.5 rounded-xl border text-center shrink-0 transition-all cursor-pointer ${
                      selectedRadarDay === 'overdue'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : sevenDayRadar.overdueCount > 0
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] font-black block">عقب‌افتاده</span>
                    <span className="text-[11px] font-mono font-black block mt-0.5">
                      {toPersianDigits(sevenDayRadar.overdueCount)}
                    </span>
                  </button>

                  {sevenDayRadar.days.map(day => {
                    const isSelected = selectedRadarDay === day.offset;
                    return (
                      <button
                        type="button"
                        key={day.offset}
                        aria-label={`فیلتر رادار ${day.label} (${toPersianDigits(day.totalCount)} مورد)`}
                        onClick={() => {
                          selection();
                          setSelectedRadarDay(prev => (prev === day.offset ? null : day.offset));
                        }}
                        className={`min-w-[64px] p-1.5 rounded-xl border text-center shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                            : day.criticalCount > 0
                            ? 'bg-amber-50/90 hover:bg-amber-100 text-amber-950 border-amber-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="text-[10px] font-black block leading-tight">{day.label}</span>
                        <span className="text-[9px] font-mono opacity-80 block">{day.shortDate}</span>
                        <span className="text-[11px] font-mono font-black block mt-0.5">
                          {toPersianDigits(day.totalCount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(
                  [
                    { id: 'all', label: 'همه هشدارها', count: analytics.totalActive },
                    { id: 'custom', label: 'ثبت‌شده و زمان‌دار', count: liveSynthesizedReminders.filter(i => i.isCustomRecord).length },
                    { id: 'appointment', label: 'نوبت ویزیت', count: analytics.byPillar.appointment },
                    {
                      id: 'check_installment',
                      label: 'چک صیادی و اقساط',
                      count: analytics.byPillar.check + analytics.byPillar.installment
                    },
                    { id: 'guarantee_check', label: 'چک ضمانت امانی', count: analytics.guaranteeChecksCount },
                    { id: 'debtor', label: 'بدهکاران مطب', count: analytics.byPillar.debtor },
                    { id: 'lab', label: 'لابراتوار', count: analytics.byPillar.lab },
                    { id: 'implant', label: 'فراخوان ایمپلنت', count: analytics.byPillar.implant },
                    { id: 'recall', label: 'ریکال دوره‌ای', count: analytics.byPillar.recall },
                    { id: 'inventory', label: 'انبار و FEFO', count: analytics.byPillar.inventory },
                    { id: 'insurance', label: 'بیمه و خسارت', count: analytics.byPillar.insurance },
                    { id: 'sterilization', label: 'اتوکلاو CSSD', count: analytics.byPillar.sterilization }
                  ] as Array<{ id: CategoryFilterType; label: string; count: number }>
                ).map(cat => {
                  const isSelected = reminderTypeFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        selection();
                        setReminderTypeFilter(cat.id);
                      }}
                      className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[10.5px] font-black whitespace-nowrap flex items-center gap-1 border transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-amber-200/80 hover:bg-amber-50'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-mono tabular-nums ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {toPersianDigits(cat.count)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'all', label: 'همه اولویت‌ها' },
                    { id: 'critical', label: 'فقط بحرانی' },
                    { id: 'high', label: 'نزدیک سررسید' },
                    { id: 'medium', label: 'هفته جاری' },
                    { id: 'upcoming', label: 'آینده' }
                  ] as Array<{ id: 'all' | SmartUrgencyTier; label: string }>
                ).map(urg => (
                  <button
                    key={urg.id}
                    type="button"
                    onClick={() => {
                      selection();
                      setUrgencyFilter(urg.id);
                    }}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                      urgencyFilter === urg.id
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {urg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Batch Action, Morning Digest & Multi-Select Triage Bar */}
          {filteredReminders.length > 0 && (
            <div className="p-3 rounded-[20px] bg-gradient-to-l from-amber-50 via-white to-emerald-50/70 border border-amber-200/90 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-500 shrink-0" />
                  <div>
                    <span className="text-[11px] font-black text-slate-900 block">
                      ارسال گروهی هوشمند هشدارهای آماده ({toPersianDigits(filteredReminders.length)} مورد)
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-bold block">
                      اولویت‌بندی ۱۱ لایه: چک، اقساط، لابراتوار، ایمپلنت، ریکال، انبار، بیمه و اتوکلاو
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      setBulkSelectMode(prev => {
                        if (prev) setSelectedReminderIds([]);
                        return !prev;
                      });
                    }}
                    className={`min-h-[34px] px-2.5 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                      bulkSelectMode
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{bulkSelectMode ? 'خروج از انتخاب گروهی' : 'انتخاب گروهی'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      selection();
                      const text = generateDailyClinicDigestText(liveSynthesizedReminders);
                      setDigestPreview(text);
                      await copyTextSafely(text);
                      setSentAlert('گزارش خلاصه صبحگاهی مطب آماده و در کلیپ‌بورد کپی شد.');
                      setTimeout(() => setSentAlert(null), 3200);
                    }}
                    className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>خلاصه صبحگاهی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportRemindersCsv(filteredReminders)}
                    className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>خروجی اکسل یادآوری‌ها</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      const anyExpanded = filteredReminders.some(r => expandedItems[r.id]);
                      if (anyExpanded) {
                        setExpandedItems({});
                      } else {
                        const next: Record<string, boolean> = {};
                        filteredReminders.forEach(r => {
                          next[r.id] = true;
                        });
                        setExpandedItems(next);
                      }
                    }}
                    className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black cursor-pointer active:scale-95 transition-all"
                  >
                    {filteredReminders.some(r => expandedItems[r.id]) ? 'جمع کردن همه' : 'باز کردن همه'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      impactHeavy();
                      const sendable = filteredReminders.filter(r => Boolean(r.phone));
                      for (const rem of sendable.slice(0, 5)) {
                        await handleSend(rem.title, rem.phone, rem.patientName, rem.pillar, {
                          amount: rem.exactAmountMicro,
                          time: rem.aptTime,
                          dueDate: rem.aptDate || rem.time
                        });
                      }
                      setSentAlert(
                        `تمامی ${toPersianDigits(sendable.length)} پیامک یادآوری امروز به‌صورت گروهی به درگاه مخابرات ارسال شدند.`
                      );
                    }}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10.5px] font-black flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5 -scale-x-100" />
                    <span>ارسال گروهی همه یادآوری‌ها (۱ کلیک)</span>
                  </button>
                </div>
              </div>

              {/* Multi-Select Bulk Triage Bar */}
              {bulkSelectMode && (
                <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setSelectedReminderIds(
                          selectedReminderIds.length === filteredReminders.length
                            ? []
                            : filteredReminders.map(r => r.id)
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-black text-slate-800 cursor-pointer"
                    >
                      {selectedReminderIds.length === filteredReminders.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
                    </button>
                    <span className="font-bold text-indigo-900">
                      {toPersianDigits(selectedReminderIds.length)} مورد انتخاب شده
                    </span>
                  </div>
                  {selectedReminderIds.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          impactLight();
                          batchMarkRemindersDone(selectedReminderIds);
                          setDismissedIds(prev => {
                            const next = { ...prev };
                            selectedReminderIds.forEach(id => {
                              next[id] = true;
                            });
                            return next;
                          });
                          setSelectedReminderIds([]);
                          setRemindersRevision(r => r + 1);
                          setSentAlert('موارد انتخاب‌شده به‌صورت گروهی انجام‌شده علامت خوردند.');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer"
                      >
                        انجام شد گروهی ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          impactLight();
                          batchSnoozeReminders(selectedReminderIds, 60);
                          setSelectedReminderIds([]);
                          setRemindersRevision(r => r + 1);
                          setSentAlert('موارد انتخاب‌شده به مدت ۱ ساعت به تعویق افتادند.');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-black cursor-pointer"
                      >
                        تعویق ۱س گروهی
                      </button>
                    </div>
                  )}
                </div>
              )}

              {digestPreview && (
                <div className="pt-2 border-t border-indigo-200/70 bg-indigo-50/70 rounded-xl p-2.5 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between font-black text-indigo-950">
                    <span>پیش‌نمایش خلاصه صبحگاهی مطب (کپی شده)</span>
                    <button
                      type="button"
                      onClick={() => setDigestPreview(null)}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      بستن ✕
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[10.5px] text-slate-700 leading-relaxed">
                    {digestPreview}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Reminder Cards List */}
          {filteredReminders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
              هیچ یادآوری معوقه‌ای در این فیلتر وجود ندارد.
            </div>
          ) : (
            filteredReminders.map((item, idx) => {
              const isExpanded = !!expandedItems[item.id];
              const isSelectedBulk = selectedReminderIds.includes(item.id);
              const rightAccentClass =
                item.pillar === 'lab'
                  ? 'border-r-purple-500 border-purple-200/80'
                  : item.pillar === 'check' || item.pillar === 'installment' || item.pillar === 'debtor'
                  ? 'border-r-rose-500 border-rose-200/80'
                  : item.pillar === 'implant'
                  ? 'border-r-cyan-500 border-cyan-200/80'
                  : item.pillar === 'inventory'
                  ? 'border-r-emerald-500 border-emerald-200/80'
                  : item.pillar === 'insurance'
                  ? 'border-r-indigo-500 border-indigo-200/80'
                  : item.pillar === 'sterilization'
                  ? 'border-r-red-500 border-red-200/80'
                  : 'border-r-amber-500 border-amber-200/80';

              const urgInfo = urgencyBadgeInfo(item.urgency);
              const linkedPat = item.patientId ? patientById.get(item.patientId) : undefined;
              const cleanTel = toEnglishDigits(item.phone || '').replace(/[^\d+]/g, '');
              const waPhone = item.phone ? normalizePhoneForWhatsApp(item.phone) : '';
              const smsBodyHref = cleanTel
                ? `sms:${cleanTel}?body=${encodeURIComponent(
                    `سلام ${item.patientName} عزیز، یادآوری کلینیک مینادنتال: ${item.title} (${item.time})`
                  )}`
                : '';

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-[20px] p-3 shadow-[var(--shadow-card)] border border-r-[3px] ${rightAccentClass} space-y-2 hover:shadow-[var(--shadow-elevated)] transition-all ${
                    isSelectedBulk ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
                  }`}
                >
                  {/* Collapsible Card Header */}
                  <div
                    onClick={() => toggleCollapse(item.id)}
                    className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {bulkSelectMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selection();
                            setSelectedReminderIds(prev =>
                              prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                            );
                          }}
                          aria-label={`انتخاب ${item.title}`}
                          className="p-1 rounded-lg text-indigo-700 hover:bg-indigo-50 cursor-pointer shrink-0"
                        >
                          {isSelectedBulk ? (
                            <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                          ) : (
                            <Square className="w-4.5 h-4.5 text-slate-400" />
                          )}
                        </button>
                      )}
                      <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-700 shrink-0">
                        {item.pillar === 'lab' && <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />}
                        {(item.pillar === 'check' || item.pillar === 'installment' || item.pillar === 'debtor') && (
                          <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        {(item.pillar === 'appointment' || item.pillar === 'recall' || item.pillar === 'custom') && (
                          <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        {item.pillar === 'implant' && <Clock className="w-3.5 h-3.5 text-sky-600" />}
                        {item.pillar === 'inventory' && <Package className="w-3.5 h-3.5 text-emerald-600" />}
                        {item.pillar === 'insurance' && <Shield className="w-3.5 h-3.5 text-indigo-600" />}
                        {item.pillar === 'sterilization' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                        <span className="text-[8px] font-mono font-black leading-none mt-0.5">
                          #{toPersianDigits(idx + 1)}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 leading-snug truncate">{item.title}</h4>
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                            {item.patientName}
                          </span>
                          <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${urgInfo.cls}`}>
                            {urgInfo.label}
                          </span>
                          {item.isGuaranteeReadyForReturn && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shrink-0">
                              آماده عودت لاشه ✓
                            </span>
                          )}
                          {item.isGuaranteeCheck && !item.isGuaranteeReadyForReturn && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                              چک ضمانت امانی
                            </span>
                          )}
                          {item.escalationLevel === 'manager_escalation' && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-600 text-white shrink-0">
                              اقدام فوری مدیر
                            </span>
                          )}
                          {typeof item.noShowRiskPercent === 'number' && item.noShowRiskPercent >= 50 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 shrink-0 tabular-nums">
                              ریسک غیبت {toPersianDigits(item.noShowRiskPercent)}٪
                            </span>
                          )}
                          {item.assignedTo && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 shrink-0">
                              مسئول: {item.assignedTo}
                            </span>
                          )}
                          {item.confirmationStatus === 'confirmed_by_patient' && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
                              تایید بیمار ✓
                            </span>
                          )}
                          {item.confirmationStatus === 'reschedule_requested' && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-200 shrink-0">
                              درخواست تغییر ساعت
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-amber-800 font-bold block font-mono mt-0.5 truncate tabular-nums">
                          موعد: {toPersianDigits(item.time)}
                          {item.reminderPresetLabel ? ` · ${item.reminderPresetLabel}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleTriggerSinglePhoneNotification(item);
                        }}
                        title="ارسال فوری نوتیفیکیشن روی گوشی"
                        aria-label="اعلان گوشی"
                        className="min-h-[36px] py-1 px-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <Smartphone className="w-3 h-3 text-sky-700" />
                        <span className="hidden sm:inline">اعلان گوشی</span>
                      </button>

                      {item.phone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSend(item.title, item.phone, item.patientName, item.pillar, {
                              amount: item.exactAmountMicro,
                              time: item.aptTime,
                              dueDate: item.aptDate || item.time
                            });
                          }}
                          className="min-h-[36px] py-1 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          <Send className="w-3 h-3 -scale-x-100" />
                          <span className="hidden xs:inline">پیامک</span>
                        </button>
                      )}

                      <div
                        className={`min-h-[36px] px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border transition-colors ${
                          isExpanded
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                      >
                        <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Body (Collapsible) */}
                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 animate-in fade-in">
                      <p className="text-[11px] text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {item.subtitle}
                      </p>

                      {item.riskHint && (
                        <div className="text-[10.5px] font-bold text-amber-950 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{item.riskHint}</span>
                        </div>
                      )}

                      {item.medicalAlert && (
                        <div className="text-[10.5px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>هشدار پزشکی پرونده: {item.medicalAlert}</span>
                        </div>
                      )}

                      {item.triggerMeta && (
                        <div className="text-[10.5px] font-bold text-slate-600 px-2 flex items-center gap-1.5 flex-wrap">
                          <BellRing className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{item.triggerMeta}</span>
                          {item.channelsLabel && <span>· {item.channelsLabel}</span>}
                        </div>
                      )}

                      {/* Unified 5-Pillar Financial, Installment, Check & Guarantee Context Box */}
                      {(item.pillar === 'check' || item.pillar === 'installment' || item.pillar === 'debtor') && linkedPat && (() => {
                        const patInsts = linkedPat.installments || [];
                        const unpaidPatInsts = patInsts.filter(i => i.status !== 'paid');
                        const patChks = (linkedPat.sayadChecks || []).filter(c => !c.isGuarantee);
                        const patGuarantees = (linkedPat.sayadChecks || []).filter(c => c.isGuarantee);
                        return (
                          <div className="p-2.5 rounded-xl bg-gradient-to-l from-rose-50/80 via-indigo-50/50 to-amber-50/70 border border-rose-200/70 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10.5px] font-black text-rose-950 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>وضعیت یکپارچه مالی، اقساط، چک صیادی و ضمانت پرونده</span>
                              </span>
                              {onOpenPatientFile && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    selection();
                                    onOpenPatientFile(linkedPat, 'financial');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[9.5px] font-black cursor-pointer transition-colors"
                                >
                                  پرونده مالی و ضمانت بیمار ←
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                              <div className="p-1.5 rounded-lg bg-white/90 border border-rose-100">
                                <div className="text-[9px] font-bold text-slate-500">مانده بدهی</div>
                                <div className={`font-black dir-ltr text-right ${linkedPat.balance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {linkedPat.balance < 0 ? `${toPersianDigits(Math.abs(linkedPat.balance).toLocaleString())} ت` : 'تسویه کامل ✓'}
                                </div>
                              </div>
                              <div className="p-1.5 rounded-lg bg-white/90 border border-indigo-100">
                                <div className="text-[9px] font-bold text-slate-500">اقساط باز</div>
                                <div className="font-black text-indigo-900">
                                  {unpaidPatInsts.length > 0
                                    ? `${toPersianDigits(unpaidPatInsts.length)} از ${toPersianDigits(patInsts.length)} قسط`
                                    : patInsts.length > 0
                                      ? 'همه اقساط تسویه ✓'
                                      : 'بدون تقسیط'}
                                </div>
                              </div>
                              <div className="p-1.5 rounded-lg bg-white/90 border border-emerald-100">
                                <div className="text-[9px] font-bold text-slate-500">چک‌های صیادی</div>
                                <div className="font-black text-emerald-900">
                                  {patChks.length > 0
                                    ? `${toPersianDigits(patChks.filter(c => c.status === 'cleared').length)}/${toPersianDigits(patChks.length)} پاس‌شده`
                                    : 'بدون چک اقساط'}
                                </div>
                              </div>
                              <div className="p-1.5 rounded-lg bg-white/90 border border-amber-200">
                                <div className="text-[9px] font-bold text-slate-500">چک ضمانت امانی</div>
                                <div className="font-black text-amber-900">
                                  {patGuarantees.length > 0
                                    ? patGuarantees.every(g => g.status === 'cleared' || g.status === 'returned')
                                      ? 'عودت داده شد ✓'
                                      : unpaidPatInsts.length === 0 && linkedPat.balance >= 0
                                        ? 'آماده عودت به بیمار!'
                                        : `${toPersianDigits(patGuarantees.length)} فقره در گاوصندوق`
                                    : 'فاقد چک ضمانت'}
                                </div>
                              </div>
                            </div>

                            {/* Direct 1-Tap Check / Guarantee / Installment / Debtor Actions */}
                            {(() => {
                              const matchedCheck =
                                item.pillar === 'check' && item.sourceEntityId
                                  ? (linkedPat.sayadChecks || []).find(c => c.id === item.sourceEntityId)
                                  : undefined;
                              const matchedInst =
                                item.pillar === 'installment' && item.sourceEntityId
                                  ? patInsts.find(i => i.id === item.sourceEntityId)
                                  : undefined;
                              return (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  {matchedCheck && matchedCheck.isGuarantee && matchedCheck.status !== 'returned' && onUpdateCheckStatus && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onUpdateCheckStatus(matchedCheck, 'returned');
                                        handleMarkDone(item.id);
                                      }}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>ثبت تحویل لاشه ضمانت به بیمار ✓</span>
                                    </button>
                                  )}

                                  {matchedCheck && !matchedCheck.isGuarantee && matchedCheck.status !== 'cleared' && onUpdateCheckStatus && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateCheckStatus(matchedCheck, 'cleared');
                                          handleMarkDone(item.id);
                                        }}
                                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>ثبت وصول چک ✓</span>
                                      </button>
                                      {matchedCheck.status !== 'bounced' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onUpdateCheckStatus(matchedCheck, 'bounced');
                                            setRemindersRevision(r => r + 1);
                                            setSentAlert(`وضعیت چک صیادی «${linkedPat.fullName}» به برگشتی تغییر یافت.`);
                                          }}
                                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-[10px] font-black cursor-pointer"
                                        >
                                          ثبت برگشت چک ✕
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {matchedInst && matchedInst.status !== 'paid' && onPayInstallment && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onPayInstallment(matchedInst);
                                        handleMarkDone(item.id);
                                      }}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>ثبت وصول قسط ✓</span>
                                    </button>
                                  )}

                                  {item.pillar === 'debtor' && onOpenAddPayment && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        selection();
                                        onOpenAddPayment(linkedPat);
                                      }}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>ثبت دریافتی / تسویه بدهی ✓</span>
                                    </button>
                                  )}

                                  {item.pillar === 'debtor' && onOpenAddCheck && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        selection();
                                        onOpenAddCheck(linkedPat.id);
                                      }}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-black cursor-pointer"
                                    >
                                      ثبت چک ضمانت / صیادی +
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Cross-Device Staff Task Assignment Strip */}
                      <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <span className="font-black text-indigo-950 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>ارجاع و مسئول پیگیری تیم:</span>
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {CLINIC_STAFF_ASSIGNMENT_ROLES.map(role => {
                            const isAssigned = item.assignedTo === role;
                            return (
                              <button
                                key={role}
                                type="button"
                                aria-label={`ارجاع یادآوری به ${role}`}
                                onClick={() => {
                                  selection();
                                  assignReminderToStaff(item.id, isAssigned ? undefined : role);
                                  setRemindersRevision(r => r + 1);
                                  setSentAlert(
                                    isAssigned
                                      ? 'مسئولیت این یادآوری آزاد شد.'
                                      : `یادآوری به «${role}» ارجاع شد و روی تمامی دستگاه‌ها همگام‌سازی گردید.`
                                  );
                                  setTimeout(() => setSentAlert(null), 2600);
                                }}
                                className={`px-2 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                                  isAssigned
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                    : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                                }`}
                              >
                                {role}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2-Way Patient Appointment Confirmation Strip */}
                      {(item.pillar === 'appointment' || item.sourceType === 'appointment') && (
                        <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                          <span className="font-black text-emerald-950">تاییدیه حضور دوطرفه بیمار:</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {(
                              [
                                { id: 'unconfirmed', label: 'در انتظار تایید' },
                                { id: 'confirmed_by_patient', label: 'تایید بیمار ✓' },
                                { id: 'reschedule_requested', label: 'درخواست تغییر وقت' }
                              ] as Array<{ id: AppointmentConfirmationState; label: string }>
                            ).map(st => {
                              const active = (item.confirmationStatus || 'unconfirmed') === st.id;
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  aria-label={`تاییدیه دوطرفه: ${st.label}`}
                                  onClick={() => {
                                    selection();
                                    setAppointmentConfirmationStatus(item.id, st.id);
                                    setRemindersRevision(r => r + 1);
                                    setSentAlert(`وضعیت تاییدیه حضور به «${st.label}» تغییر یافت.`);
                                    setTimeout(() => setSentAlert(null), 2400);
                                  }}
                                  className={`px-2 py-1 rounded-lg font-black border cursor-pointer transition-all ${
                                    active
                                      ? st.id === 'confirmed_by_patient'
                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                        : st.id === 'reschedule_requested'
                                        ? 'bg-rose-600 text-white border-rose-700'
                                        : 'bg-amber-500 text-slate-950 border-amber-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {st.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Direct Communication & Cross-Module Deep Jump Strip */}
                      <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {cleanTel && (
                            <a
                              href={`tel:${cleanTel}`}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1"
                              title={`تماس مستقیم با ${item.patientName}`}
                            >
                              <Phone className="w-3 h-3" />
                              <span>تماس</span>
                            </a>
                          )}

                          {smsBodyHref && (
                            <a
                              href={smsBodyHref}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black flex items-center gap-1"
                              title="ارسال پیامک از گوشی"
                            >
                              <MessageSquare className="w-3 h-3 text-sky-600" />
                              <span>پیامک گوشی</span>
                            </a>
                          )}

                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                `سلام ${item.patientName} عزیز، یادآوری کلینیک دندانپزشکی مینادنتال: ${item.title}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>واتساپ</span>
                            </a>
                          )}

                          {linkedPat && onOpenPatientFile && (
                            <button
                              type="button"
                              onClick={() => {
                                selection();
                                onOpenPatientFile(linkedPat, item.patientTab || 'treatments');
                              }}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                            >
                              <FolderOpen className="w-3 h-3" />
                              <span>پرونده بیمار</span>
                            </button>
                          )}

                          {item.suggestedAppointmentTreatment && item.patientName && onScheduleSmartAppointment && (
                            <button
                              type="button"
                              onClick={() => {
                                selection();
                                onScheduleSmartAppointment({
                                  patientName: item.patientName,
                                  phone: item.phone,
                                  treatment: item.suggestedAppointmentTreatment!,
                                  unit: item.suggestedAppointmentUnit || 'یونیت آبی'
                                });
                              }}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-lime-100 hover:bg-lime-200 text-lime-950 border border-lime-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>رزرو نوبت پیگیری</span>
                            </button>
                          )}

                          {onNavigateToModule && item.targetView !== 'reminders' && (
                            <button
                              type="button"
                              onClick={() => {
                                selection();
                                onNavigateToModule(item.targetSubModule || item.targetView);
                              }}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowUpRight className="w-3 h-3" />
                              <span>ورود به ماژول</span>
                            </button>
                          )}

                          {onOpenAppointments && (item.pillar === 'appointment' || item.sourceType === 'appointment') && (
                            <button
                              type="button"
                              onClick={() => {
                                selection();
                                onOpenAppointments();
                              }}
                              className="min-h-[34px] py-1 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3 h-3 text-sky-700" />
                              <span>نوبت‌دهی</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Snooze, Done, Delete & SMS Action Bar */}
                      <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1.5 border-t border-slate-100">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleMarkDone(item.id)}
                            className="min-h-[36px] py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>انجام شد</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSnoozeItem(item.id, 15, '۱۵ دقیقه')}
                            className="min-h-[36px] py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <AlarmClock className="w-3 h-3" />
                            <span>۱۵د تعویق</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSnoozeItem(item.id, 60, '۱ ساعت')}
                            className="min-h-[36px] py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer"
                          >
                            ۱س تعویق
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSnoozeItem(item.id, 24 * 60, '۱ روز')}
                            className="min-h-[36px] py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer"
                          >
                            ۱ روز تعویق
                          </button>

                          {item.isCustomRecord &&
                            (confirmDeleteCustomId === item.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCustomId(null)}
                                  className="min-h-[36px] py-1 px-2 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold cursor-pointer"
                                >
                                  لغو
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    impactHeavy();
                                    deleteCustomReminder(item.id);
                                    setConfirmDeleteCustomId(null);
                                    setRemindersRevision(r => r + 1);
                                    setSentAlert('یادآوری سفارشی حذف شد.');
                                  }}
                                  className="min-h-[36px] py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black cursor-pointer animate-pulse"
                                >
                                  تایید حذف ✓
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  impactLight();
                                  setConfirmDeleteCustomId(item.id);
                                }}
                                aria-label="حذف یادآوری سفارشی"
                                className="min-h-[36px] py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف</span>
                              </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleTriggerSinglePhoneNotification(item)}
                            className="min-h-[36px] py-1.5 px-2.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-950 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <BellRing className="w-3.5 h-3.5 text-sky-700" />
                            <span>اعلان گوشی</span>
                          </button>

                          {item.phone ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSend(item.title, item.phone, item.patientName, item.pillar, {
                                  amount: item.exactAmountMicro,
                                  time: item.aptTime,
                                  dueDate: item.aptDate || item.time
                                })
                              }
                              className="min-h-[36px] py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 -scale-x-100" />
                              <span>{item.actionText}</span>
                            </button>
                          ) : (
                            onNavigateToModule && (
                              <button
                                type="button"
                                onClick={() => onNavigateToModule(item.targetView)}
                                className="min-h-[36px] py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                <span>{item.actionText}</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CHIP: SNOOZED & ARCHIVED REMINDERS QUEUE */}
      {activeChip === 'snoozed_done' && (
        <div className="mx-2 space-y-2.5">
          <div className="bg-white rounded-[22px] p-4 border border-sky-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <AlarmClock className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs font-black text-slate-900">
                  یادآوری‌های به‌تعویق‌افتاده (Snooze) و انجام‌شده
                </h4>
              </div>
              {snoozedAndDoneQueue.dismissedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setDismissedIds({});
                    setSentAlert('تمامی یادآوری‌های بسته‌شده مجدداً به صف فعال بازگشتند.');
                    setTimeout(() => setSentAlert(null), 2800);
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازگردانی بایگانی ({toPersianDigits(snoozedAndDoneQueue.dismissedCount)})</span>
                </button>
              )}
            </div>

            {snoozedAndDoneQueue.snoozedItems.length === 0 && snoozedAndDoneQueue.doneCustom.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold text-slate-400">
                در حال حاضر هیچ یادآوری در صف تعویق یا انجام‌شده وجود ندارد.
              </div>
            ) : (
              <div className="space-y-2">
                {snoozedAndDoneQueue.snoozedItems.map(item => (
                  <div
                    key={`snz-${item.id}`}
                    className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        {item.title} · {item.patientName}
                      </span>
                      <span className="text-[10.5px] font-bold text-amber-800 block mt-0.5">
                        در حالت تعویق تا:{' '}
                        {item.snoozedUntilMs
                          ? new Date(item.snoozedUntilMs).toLocaleTimeString('fa-IR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'به‌زودی'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        impactLight();
                        unsnoozeReminder(item.id);
                        setRemindersRevision(r => r + 1);
                        setSentAlert(`تعویق «${item.title}» لغو و به صف فعال بازگشت.`);
                        setTimeout(() => setSentAlert(null), 2600);
                      }}
                      className="min-h-[34px] px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>لغو تعویق</span>
                    </button>
                  </div>
                ))}

                {snoozedAndDoneQueue.doneCustom.map(done => (
                  <div
                    key={`done-${done.id}`}
                    className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        ✓ {done.title} · {done.patientName}
                      </span>
                      <span className="text-[10.5px] font-bold text-slate-600 block mt-0.5">{done.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        reopenReminder(done.id);
                        setDismissedIds(prev => {
                          const next = { ...prev };
                          delete next[done.id];
                          return next;
                        });
                        setRemindersRevision(r => r + 1);
                      }}
                      className="min-h-[34px] px-3 py-1 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>فعال‌سازی مجدد</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHIP 2: ADVANCE DAYS & SMART POLICY CONFIGURATION */}
      {activeChip === 'config' && (
        <div className="mx-2 space-y-3">
          <div className="bg-white rounded-[24px] p-4 border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-black text-slate-800">تعیین زمان‌بندی یادآوری‌های پیش‌فرض</h4>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-mono font-bold">
                تنظیم روزها قبل از سررسید
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              مشخص کنید سیستم هوشمند مینادنتال چند روز پیش از فرارسیدن موعد چک، قسط، نوبت، لابراتوار، ریکال و انبار هشدارها را ایجاد کند:
            </p>

            {/* Config Item 1: Sayad Checks */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">سررسید چک‌های صیادی</span>
                  <span className="text-[10px] text-slate-400">ارسال هشدار به پزشک و پیامک خوش‌حسابی به بیمار</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.checkAdvanceDays)} روز قبل
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 5, 7].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => updatePolicySetting('checkAdvanceDays', days)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.checkAdvanceDays === days
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(days)} روز
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 1B: Guarantee Checks Custody & Return */}
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-amber-950 block">چک‌های ضمانت امانی و عودت لاشه</span>
                  <span className="text-[10px] text-amber-800">هشدار سررسید امانت و اعلان عودت پس از تسویه اقساط</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.guaranteeCheckAdvanceDays)} روز قبل
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[3, 5, 7, 14].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => updatePolicySetting('guaranteeCheckAdvanceDays', days)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.guaranteeCheckAdvanceDays === days
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(days)} روز
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 2: Installments */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">اقساط درمانی معوقه</span>
                  <span className="text-[10px] text-slate-400">یادآوری سررسید قسط ارتودنسی، ایمپلنت و کامپوزیت</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.installmentAdvanceDays)} روز قبل
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 7].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => updatePolicySetting('installmentAdvanceDays', days)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.installmentAdvanceDays === days
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(days)} روز
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 2B: Debtor Minimum Balance Alert Threshold */}
            <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-rose-950 block">حداقل مانده بدهی برای نمایش آلارم مطب</span>
                  <span className="text-[10px] text-rose-800">فیلتر هوشمند بدهکاران کم‌مبلغ در اعلان‌ها</span>
                </div>
                <span className="text-xs font-mono font-black text-rose-800 bg-rose-100 px-2.5 py-1 rounded-lg">
                  {reminderSettings.debtorMinAlertToman === 0
                    ? 'همه بدهی‌ها'
                    : `بالای ${formatToman(reminderSettings.debtorMinAlertToman)}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[
                  { val: 0, label: 'همه بدهی‌ها' },
                  { val: 1_000_000, label: 'بالای ۱م' },
                  { val: 5_000_000, label: 'بالای ۵م' },
                  { val: 10_000_000, label: 'بالای ۱۰م' }
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.val}
                    onClick={() => updatePolicySetting('debtorMinAlertToman', opt.val)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      reminderSettings.debtorMinAlertToman === opt.val
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 3: Appointment Reminders */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">پیامک یادآوری نوبت ویزیت</span>
                  <span className="text-[10px] text-slate-400">ارسال خودکار ساعت حضور و آدرس کلینیک</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.appointmentAdvanceHours)} ساعت قبل
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[12, 24, 48].map(hours => (
                  <button
                    type="button"
                    key={hours}
                    onClick={() => updatePolicySetting('appointmentAdvanceHours', hours)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.appointmentAdvanceHours === hours
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(hours)} ساعت
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 4: Post-Op Care */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">پیگیری پس از جراحی / عصب‌کشی</span>
                  <span className="text-[10px] text-slate-400">استعلام حال عمومی بیمار و کنترل عفونت یا درد</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.postOpFollowupDays)} روز بعد
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 5].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => updatePolicySetting('postOpFollowupDays', days)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.postOpFollowupDays === days
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(days)} روز بعد
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 5: Lab Orders Delivery */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">پیگیری موعد دریافت کار لابراتوار</span>
                  <span className="text-[10px] text-slate-400">هشدار تماس با پیک یا مسئول لابراتوار</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.labDeliveryAdvanceDays)} روز قبل
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => updatePolicySetting('labDeliveryAdvanceDays', days)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.labDeliveryAdvanceDays === days
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(days)} روز قبل
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 6: Periodic Recall Months */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">فراخوان چکاپ دوره‌ای بیماران</span>
                  <span className="text-[10px] text-slate-400">دعوت خودکار معاینه و جرم‌گیری دوره‌ای</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                  هر {toPersianDigits(reminderSettings.periodicRecallMonths)} ماه
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[3, 6, 9, 12].map(months => (
                  <button
                    type="button"
                    key={months}
                    onClick={() => updatePolicySetting('periodicRecallMonths', months)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.periodicRecallMonths === months
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(months)} ماه
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 7: Inventory FEFO Expiry Window */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">آستانه هشدار انقضای متریال انبار (FEFO)</span>
                  <span className="text-[10px] text-slate-400">هشدار پیش از تاریخ انقضای مواد مصرفی کلینیک</span>
                </div>
                <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                  {toPersianDigits(reminderSettings.inventoryExpiryAdvanceDays)} روز قبل
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[15, 30, 60, 90].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => updatePolicySetting('inventoryExpiryAdvanceDays', days)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reminderSettings.inventoryExpiryAdvanceDays === days
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {toPersianDigits(days)} روز
                  </button>
                ))}
              </div>
            </div>

            {/* Config Item 8: Night Quiet Hours (ساعت سکوت ارسال پیامک) */}
            <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-indigo-950 block">ساعات سکوت شبانه ارسال پیامک خودکار</span>
                    <span className="text-[10px] text-indigo-700">
                      جلوگیری از ارسال پیامک تبلیغاتی/یادآوری به بیمار در نیمه‌شب
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updatePolicySetting(
                      'respectQuietHours',
                      !reminderSettings.respectQuietHours,
                      'سیاست ساعت سکوت شبانه به‌روزرسانی شد.'
                    )
                  }
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-[10.5px] font-black cursor-pointer ${
                    reminderSettings.respectQuietHours
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {reminderSettings.respectQuietHours ? 'فعال ✓' : 'غیرفعال'}
                </button>
              </div>
              {reminderSettings.respectQuietHours && (
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">شروع سکوت شبانه</label>
                    <input
                      type="text"
                      aria-label="ساعت شروع سکوت شبانه"
                      value={reminderSettings.quietHoursStart}
                      onChange={(e) => updatePolicySetting('quietHoursStart', e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-mono text-center font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">پایان سکوت شبانه</label>
                    <input
                      type="text"
                      aria-label="ساعت پایان سکوت شبانه"
                      value={reminderSettings.quietHoursEnd}
                      onChange={(e) => updatePolicySetting('quietHoursEnd', e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-mono text-center font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Smart Automation Rules Engine */}
            <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-emerald-200/60">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-emerald-950 block">موتور قوانین خودکار هوشمند کلینیک</span>
                    <span className="text-[10px] text-emerald-800">
                      فعال‌سازی یا توقف پایش هوشمند هر بخش در کل سامانه مینادنتال
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {(
                  [
                    {
                      key: 'autoAptConfirm24h',
                      title: 'تاییدیه خودکار نوبت و تداخل یونیت‌ها',
                      sub: 'ارسال یادآور هوشمند پیش از ویزیت و پیگیری عدم حضور (No-Show)'
                    },
                    {
                      key: 'autoImplantPostOp',
                      title: 'پایش خودکار مراحل جراحی و هیلینگ ایمپلنت',
                      sub: 'یادآوری کنترل پس از کاشت فیکسچر و موعد قالب‌گیری پروتز'
                    },
                    {
                      key: 'autoCheckAndInstallmentEscalation',
                      title: 'تشدید هشدار چک برگشتی و اقساط معوقه به مدیر',
                      sub: 'اولویت‌دهی خودکار و آماده ارسال پیامک در معوقات مالی'
                    },
                    {
                      key: 'autoCssdQuarantineAlert',
                      title: 'آژیر فوری کنترل عفونت و اتوکلاو CSSD',
                      sub: 'قرنطینه فوری پک‌ها هنگام خطای تست Bowie-Dick و اسپور'
                    },
                    {
                      key: 'autoRecallInvite',
                      title: 'فراخوان خودکار چکاپ دوره‌ای بیماران',
                      sub: 'ارسال دعوت معاینه و جرم‌گیری پس از اتمام دوره ۶ ماهه'
                    }
                  ] as Array<{ key: keyof ReminderAutomationRules; title: string; sub: string }>
                ).map(rule => {
                  const currentRules = { ...DEFAULT_AUTOMATION_RULES, ...(reminderSettings.automationRules || {}) };
                  const enabled = currentRules[rule.key];
                  return (
                    <div
                      key={rule.key}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-emerald-100"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-black text-slate-900 block truncate">{rule.title}</span>
                        <span className="text-[9.5px] text-slate-500 block truncate">{rule.sub}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAutomationRule(rule.key, rule.title)}
                        className={`min-h-[32px] px-3 py-1 rounded-xl text-[10.5px] font-black shrink-0 cursor-pointer transition-all ${
                          enabled
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {enabled ? 'فعال ✓' : 'غیرفعال'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Web Audio Critical Alarm Chime Control */}
            <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="text-xs font-black text-rose-950 block">
                    هشدار صوتی آلارم‌های بحرانی (اتوکلاو / چک برگشتی)
                  </span>
                  <span className="text-[10px] text-rose-700">
                    پخش زنگ هشدار فوری هم‌زمان با دریافت اعلان‌های قرمز در محیط کلینیک
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    const ok = playCriticalAlarmChime('critical');
                    setSentAlert(
                      ok
                        ? 'صدای زنگ هشدار بحرانی پخش شد.'
                        : 'آلارم صوتی در تنظیمات غیرفعال است یا مرورگر اجازه پخش نداد.'
                    );
                    setTimeout(() => setSentAlert(null), 2600);
                  }}
                  className="min-h-[32px] px-2.5 py-1 rounded-xl bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10.5px] font-black cursor-pointer"
                >
                  تست زنگ هشدار
                </button>
                <button
                  type="button"
                  aria-label="تغییر وضعیت آلارم صوتی"
                  onClick={() =>
                    updatePolicySetting(
                      'enableSoundAlarm',
                      reminderSettings.enableSoundAlarm === false,
                      'وضعیت زنگ هشدار صوتی کلینیک ذخیره شد.'
                    )
                  }
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-[10.5px] font-black cursor-pointer ${
                    reminderSettings.enableSoundAlarm !== false
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {reminderSettings.enableSoundAlarm !== false ? 'صدای آلارم روشن' : 'صدای آلارم خاموش'}
                </button>
              </div>
            </div>

            {/* Save & Apply Button */}
            <button
              type="button"
              onClick={() => {
                impactHeavy();
                saveReminderSettings(reminderSettings);
                setSentAlert('تنظیمات زمان‌بندی یادآوری‌های هوشمند با موفقیت ذخیره و فعال شد.');
                setTimeout(() => setSentAlert(null), 3500);
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              ذخیره و اعمال در سامانه آلارم‌های کلینیک
            </button>
          </div>
        </div>
      )}

      {/* CHIP 3: CUSTOM SMS COMPOSER */}
      {activeChip === 'composer' && (
        <div className="mx-2 space-y-2.5">
          {/* Quick template buttons */}
          <div className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2">
            <span className="text-xs font-black text-slate-800 block">الگوهای بالینی آماده و استاندارد:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {templates.map((tpl, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    selection();
                    setSmsText(tpl.text);
                  }}
                  className="text-right p-2 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200/80 text-[11px] font-bold text-slate-700 hover:text-amber-900 transition-all cursor-pointer"
                >
                  ⚡ {tpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Composer Box */}
          <div className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-3">
            <span className="text-xs font-black text-slate-800 block">متن و گیرنده پیامک:</span>

            <form onSubmit={handleSendCustomSms} className="space-y-2.5 text-xs">
              {patients.length > 0 && (
                <div>
                  <label htmlFor="quick-sms-patient-select" className="text-slate-600 font-bold block mb-1">
                    انتخاب سریع از بیماران مطب
                  </label>
                  <select
                    id="quick-sms-patient-select"
                    aria-label="انتخاب سریع بیمار برای ارسال پیامک"
                    defaultValue=""
                    onChange={(e) => {
                      const pat = patients.find(p => p.id === e.target.value);
                      if (pat) {
                        selection();
                        setRecipientName(pat.fullName);
                        setRecipientPhone(pat.phone);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="">انتخاب بیمار از پرونده‌ها (اختیاری)...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} · {toPersianDigits(p.phone)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">نام مخاطب</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="مثلاً: علی مرادی"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-bold block mb-1">شماره موبایل *</label>
                  <input
                    type="text"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1 flex items-center justify-between">
                  <span>متن پیامک</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {toPersianDigits(smsText.length)} کاراکتر (۱ پیامک فارسی)
                  </span>
                </label>
                <textarea
                  aria-label="متن پیامک ارسالی"
                  rows={4}
                  required
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4 -scale-x-100" />
                <span>ارسال فوری پیامک از طریق خط خدماتی اختصاصی</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CHIP 4: LOGS & HISTORY */}
      {activeChip === 'logs' && (
        <div className="mx-2 space-y-2.5">
          <div className="bg-white rounded-[20px] p-3 border border-slate-100 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="جستجو در گزارش ارسال پیامک‌ها..."
              aria-label="جستجو در گزارش پیامک‌ها"
              className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
            />
            <button
              type="button"
              onClick={handleExportLogsCsv}
              className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی اکسل گزارش</span>
            </button>
          </div>

          {filteredLogs.map(log => (
            <div key={log.id} className="bg-white rounded-[20px] p-3 shadow-2xs border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">{log.to}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({log.phone})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {log.deliveryReceipt && (
                    <span className="text-[9.5px] font-black text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                      {log.deliveryReceipt}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {log.status}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg">{log.text}</p>
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span>{log.refId ? `کد پیگیری: ${log.refId}` : ''}</span>
                <span>{toPersianDigits(log.time)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
