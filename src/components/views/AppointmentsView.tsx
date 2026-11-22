import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, Clock, User, Phone,
  Plus, CheckCircle2, ChevronLeft, ChevronRight,
  Stethoscope, AlertCircle, Search, Send,
  XCircle, CalendarDays, Check, Sparkles,
  GripVertical, ArrowRightLeft, Columns3,
  X, Globe, Edit3, Trash2, ChevronDown, ChevronUp,
  BellRing, Smartphone, Wallet, ClipboardList,
  Printer, Timer, UserPlus, MessageCircle, MessageSquare, Settings2,
  Hourglass, Ban, Download, Zap, ShieldAlert, BarChart3
} from 'lucide-react';
import * as d3 from 'd3';
import {
  Appointment,
  ClinicScheduleSettings,
  ClinicUnitDefinition,
  Patient,
  ReminderConfig,
  UserAccount,
  WaitlistEntry
} from '../../types/dental';
import {
  toPersianDigits, toEnglishDigits, formatToman, PERSIAN_MONTHS,
  getPersianDateParts, getDaysInPersianMonth, formatPersianDateString, isSamePersianDate,
  parseTimeMinutes, isPastPersianDateTime, getCurrentPersianDate, comparePersianDates,
  getPersianWeekdayName, getPersianWeekdayShortName, getPersianMonthStartWeekdayIndex,
  addDaysToPersianDate, addMonthsToPersianDate
} from '../../utils/jalali';
import { triggerHaptic } from '../../utils/haptics';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { clinicalSmsService } from '../../services/smsService';
import { useActionFeedback, actionFeedback } from '../../utils/actionFeedback';
import { ArmedActionButton, CardMutationBadge } from '../ArmedActionButton';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { TrackableIdBadge } from '../TrackableIdBadge';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { WheelTimePicker, ALL_CLINIC_TIME_SLOTS } from '../WheelTimePicker';
import { ReminderOptionPicker } from '../ReminderOptionPicker';
import { JalaliMiniDatePicker } from '../JalaliMiniDatePicker';
import { IranianFullCalendarPanel } from '../IranianFullCalendarPanel';
import {
  DEFAULT_CLINIC_UNITS,
  normalizeClinicUnitName,
  getClinicUnitsCatalog,
  saveClinicUnitsCatalog,
  getClinicScheduleSettings,
  saveClinicScheduleSettings,
  getWaitlistEntries,
  saveWaitlistEntries,
  appointmentsOverlap,
  isAppointmentActive,
  isValidPersianDateStr,
  isOfficialIranianHoliday,
  isDoctorOffOnDate,
  findNextWorkingDate,
  calculateUnitCapacityStats,
  buildRecurringSessionDates,
  generateAppointmentsCsvContent,
  buildOccupiedSlotsMap,
  buildBlockedScheduleSlotsMap,
  suggestTreatmentSchedule,
  shiftPersianTimeMinutes,
  formatElapsedChairMinutes,
  formatWhatsAppReminderUrl,
  predictAppointmentNoShowRisk
} from '../../utils/appointmentScheduling';
import {
  getDefaultReminderConfig,
  getPresetLabelFa,
  getPhoneNotificationPermission,
  requestPhoneNotificationPermission,
  sendPhoneNotification
} from '../../services/reminderNotificationService';

export interface AppointmentPrefillDraft {
  patientName?: string;
  phone?: string;
  treatment?: string;
  unit?: string;
  time?: string;
  date?: string;
}

interface AppointmentsViewProps {
  appointments: Appointment[];
  patients: Patient[];
  users?: UserAccount[];
  onAddAppointment: (appointment: Omit<Appointment, 'id'>) => void;
  onUpdateStatus: (id: string, status: Appointment['status'], reason?: string) => void;
  onMoveAppointment?: (id: string, newUnit: string, newTime?: string, newDate?: string) => void;
  onEditAppointment?: (id: string, updatedFields: Partial<Appointment>) => void;
  onBatchShiftAppointments?: (updates: Array<{ id: string; time: string }>, unitLabel?: string) => void;
  onDeleteAppointment?: (id: string) => void;
  onQuickCreatePatient?: (draft: { fullName: string; phone: string; notes?: string }) => Patient;
  onOpenBookingPortal?: () => void;
  onNavigateToModule?: (viewId: string) => void;
  onOpenLabModal?: () => void;
  onOpenCheckModal?: () => void;
  onOpenPaymentModal?: () => void;
  onOpenPalmerChart?: () => void;
  onStartClinicalFlow?: (apt: Appointment) => void;
  onOpenPaymentForPatient?: (apt: Appointment) => void;
  onOpenPatientFile?: (patient: Patient, initialTab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai') => void;
  prefillDraft?: AppointmentPrefillDraft | null;
  onConsumePrefill?: () => void;
  initialViewMode?: 'daily' | 'board' | 'timeline' | 'monthly' | 'waitlist' | 'schedule';
  isManager?: boolean;
}

export const CLINIC_UNITS = DEFAULT_CLINIC_UNITS;
export const STANDARD_TIME_SLOTS = ALL_CLINIC_TIME_SLOTS;

const UNIT_BORDER_CLASS_MAP: Record<string, string> = {
  'یونیت آبی': 'border-r-sky-500',
  'یونیت زرد': 'border-r-amber-400',
  'یونیت جراحی': 'border-r-purple-500'
};

const QUICK_TREATMENT_PRESETS = [
  { label: 'معاینه و طرح درمان (۳۰د)', treatment: 'معاینه تخصصی و طرح درمان', duration: 30, unit: 'یونیت آبی' },
  { label: 'ترمیم کامپوزیت (۴۵د)', treatment: 'ترمیم کامپوزیت همرنگ دندان', duration: 45, unit: 'یونیت آبی' },
  { label: 'عصب‌کشی اندو (۶۰د)', treatment: 'درمان ریشه تخصصی (عصب‌کشی)', duration: 60, unit: 'یونیت زرد' },
  { label: 'اسکن و روکش (۶۰د)', treatment: 'تراش و قالب‌گیری روکش زیرکونیا', duration: 60, unit: 'یونیت آبی' },
  { label: 'جراحی و ایمپلنت (۹۰د)', treatment: 'جراحی کاشت فیکسچر ایمپلنت', duration: 90, unit: 'یونیت جراحی' }
];

const WEEKDAY_NAMES_SHORT_LIST = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  appointments,
  patients,
  users,
  onAddAppointment,
  onUpdateStatus,
  onMoveAppointment,
  onEditAppointment,
  onBatchShiftAppointments,
  onDeleteAppointment,
  onQuickCreatePatient,
  onOpenBookingPortal,
  onNavigateToModule,
  onOpenLabModal,
  onOpenCheckModal,
  onOpenPaymentModal,
  onOpenPalmerChart,
  onStartClinicalFlow,
  onOpenPaymentForPatient,
  onOpenPatientFile,
  prefillDraft,
  onConsumePrefill,
  initialViewMode,
  isManager = false
}) => {
  const curDate = getPersianDateParts();
  const [viewMode, setViewMode] = useState<'daily' | 'board' | 'timeline' | 'monthly' | 'waitlist' | 'schedule'>(
    initialViewMode || 'board'
  );
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);
  const [selectedYear, setSelectedYear] = useState<number>(curDate.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(curDate.monthIndex);
  const [selectedDay, setSelectedDay] = useState<number>(curDate.day);
  const [selectedUnit, setSelectedUnit] = useState<string>('همه');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('همه');
  const [selectedStatus, setSelectedStatus] = useState<'همه' | Appointment['status']>('همه');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAllDates, setSearchAllDates] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsToast, setSmsToast] = useState<string | null>(null);
  const [completedFollowUpApt, setCompletedFollowUpApt] = useState<Appointment | null>(null);
  const [expandedHubPillar, setExpandedHubPillar] = useState<'units' | 'lab' | 'implant' | 'financial' | null>(null);
  const [showCommandHubDrawer, setShowCommandHubDrawer] = useState<boolean>(false);
  const [printSheetOpen, setPrintSheetOpen] = useState<boolean>(false);
  const [autoSmsPanelOpen, setAutoSmsPanelOpen] = useState<boolean>(false);
  const [autoSmsRules, setAutoSmsRules] = useState<{
    enabled: boolean;
    onCreate: boolean;
    onInChair: boolean;
    onCompleted: boolean;
    onNoShow: boolean;
  }>(() => {
    const defaults = { enabled: true, onCreate: true, onInChair: true, onCompleted: true, onNoShow: false };
    if (typeof localStorage === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem('minadental_auto_sms_rules_v1');
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });
  const selectedDayBtnRef = useRef<HTMLButtonElement | null>(null);

  // Dynamic Clinic Units, Shift Schedule Settings & Waitlist State
  const [clinicUnits, setClinicUnits] = useState<ClinicUnitDefinition[]>(() => getClinicUnitsCatalog());
  const [scheduleSettings, setScheduleSettings] = useState<ClinicScheduleSettings>(() => getClinicScheduleSettings());
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(() => getWaitlistEntries());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Update live chair elapsed timer every 30s
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const persistSchedule = (next: ClinicScheduleSettings) => {
    setScheduleSettings(next);
    saveClinicScheduleSettings(next);
  };

  const persistUnits = (next: ClinicUnitDefinition[]) => {
    setClinicUnits(next);
    saveClinicUnitsCatalog(next);
  };

  const persistWaitlist = (next: WaitlistEntry[]) => {
    setWaitlist(next);
    saveWaitlistEntries(next);
  };

  const clinicDoctors = useMemo(() => {
    const roster = (users || [])
      .filter(u => u.isActive !== false && (u.role === 'doctor' || u.isDoctor || u.isManagerAndDoctor))
      .map(u => u.fullName);
    const merged = Array.from(new Set([...roster, 'دکتر مهدی امیری', 'دکتر مریم رضایی']));
    return merged.length > 0 ? merged : ['دکتر مهدی امیری', 'دکتر مریم رضایی'];
  }, [users]);

  const patientLookup = useMemo(() => {
    const byId = new Map<string, Patient>();
    const byPhone = new Map<string, Patient>();
    const byName = new Map<string, Patient>();
    for (const p of patients) {
      byId.set(p.id, p);
      const digits = toEnglishDigits(p.phone || '').replace(/\D/g, '');
      if (digits.length >= 7) byPhone.set(digits.slice(-7), p);
      if (p.fullName) byName.set(p.fullName.trim(), p);
    }
    return { byId, byPhone, byName };
  }, [patients]);

  const patientNoShowCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      if (a.status !== 'no_show') continue;
      if (a.patientId) map.set(a.patientId, (map.get(a.patientId) || 0) + 1);
      const last7 = toEnglishDigits(a.phone || '').replace(/\D/g, '').slice(-7);
      if (last7.length >= 7) map.set(`ph:${last7}`, (map.get(`ph:${last7}`) || 0) + 1);
    }
    return map;
  }, [appointments]);

  const getNoShowCountForApt = (apt: Appointment): number => {
    const byId = apt.patientId ? patientNoShowCounts.get(apt.patientId) || 0 : 0;
    const last7 = toEnglishDigits(apt.phone || '').replace(/\D/g, '').slice(-7);
    const byPh = last7.length >= 7 ? patientNoShowCounts.get(`ph:${last7}`) || 0 : 0;
    return Math.max(byId, byPh);
  };

  const resolvePatientForApt = (apt: Appointment): Patient | undefined => {
    if (apt.patientId && patientLookup.byId.has(apt.patientId)) {
      return patientLookup.byId.get(apt.patientId);
    }
    const digits = toEnglishDigits(apt.phone || '').replace(/\D/g, '');
    if (digits.length >= 7) {
      const hit = patientLookup.byPhone.get(digits.slice(-7));
      if (hit) return hit;
    }
    return patientLookup.byName.get((apt.patientName || '').trim());
  };

  const getDefaultDoctorForUnit = (unitId: string): string => {
    const norm = normalizeClinicUnitName(unitId);
    if (norm === 'یونیت زرد') {
      return clinicDoctors.find(d => d.includes('رضایی') || d.includes('رضوانی')) || clinicDoctors[1] || clinicDoctors[0];
    }
    const found = clinicUnits.find(u => u.id === norm);
    if (found?.doctor) {
      const match = clinicDoctors.find(d => found.doctor.includes(d) || d.includes(found.doctor.split(' ')[1] || ''));
      if (match) return match;
    }
    return clinicDoctors.find(d => d.includes('امیری')) || clinicDoctors[0];
  };

  // Clamp selectedDay to month length when switching months & auto-scroll day strip to selectedDay (today on launch)
  const totalDaysInMonth = getDaysInPersianMonth(selectedMonth + 1, selectedYear);
  useEffect(() => {
    if (selectedDay > totalDaysInMonth) {
      setSelectedDay(totalDaysInMonth);
    }
  }, [totalDaysInMonth, selectedDay]);

  useEffect(() => {
    if (typeof window === 'undefined' || viewMode === 'monthly' || viewMode === 'waitlist' || viewMode === 'schedule') return;
    const timer = setTimeout(() => {
      try {
        selectedDayBtnRef.current?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      } catch {
        // Ignore non-scrolling test environments
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedDay, selectedMonth, selectedYear, viewMode]);

  // Drag and drop states
  const [draggedAptId, setDraggedAptId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  // Quick Move Modal (Stateful Date + Unit + Time)
  const [quickMoveModalApt, setQuickMoveModalApt] = useState<Appointment | null>(null);
  const [quickMoveUnit, setQuickMoveUnit] = useState<string>('یونیت آبی');
  const [quickMoveTime, setQuickMoveTime] = useState<string>('۱۷:۰۰');
  const [quickMoveDate, setQuickMoveDate] = useState<string>(() => getCurrentPersianDate());
  const [quickMoveShowCal, setQuickMoveShowCal] = useState<boolean>(false);

  const openQuickMoveModal = (apt: Appointment) => {
    triggerHaptic('selection');
    setQuickMoveModalApt(apt);
    setQuickMoveUnit(normalizeClinicUnitName(apt.unit));
    setQuickMoveTime(apt.time);
    setQuickMoveDate(apt.date);
    setQuickMoveShowCal(false);
  };

  // Full Edit Appointment Modal states
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [editAptName, setEditAptName] = useState('');
  const [editAptPhone, setEditAptPhone] = useState('');
  const [editAptDate, setEditAptDate] = useState('');
  const [editAptShowCal, setEditAptShowCal] = useState(false);
  const [editAptTime, setEditAptTime] = useState('');
  const [editAptDuration, setEditAptDuration] = useState<number>(45);
  const [editAptUnit, setEditAptUnit] = useState('یونیت آبی');
  const [editAptDoctor, setEditAptDoctor] = useState('دکتر مهدی امیری');
  const [editAptTreatment, setEditAptTreatment] = useState('');
  const [editAptStatus, setEditAptStatus] = useState<Appointment['status']>('scheduled');
  const [editAptReason, setEditAptReason] = useState('');
  const [editReminderConfig, setEditReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('2h_before'));

  const openEditAptModal = (apt: Appointment) => {
    triggerHaptic('selection');
    setEditingApt(apt);
    setEditAptName(apt.patientName);
    setEditAptPhone(apt.phone);
    setEditAptDate(apt.date);
    setEditAptShowCal(false);
    setEditAptTime(apt.time);
    setEditAptDuration(apt.durationMinutes || 45);
    setEditAptUnit(normalizeClinicUnitName(apt.unit));
    setEditAptDoctor(apt.doctor);
    setEditAptTreatment(apt.treatment);
    setEditAptStatus(apt.status);
    setEditAptReason(apt.cancellationReason || '');
    setEditReminderConfig(apt.reminderConfig || getDefaultReminderConfig('2h_before'));
  };

  // Add Form states
  const [formPatientId, setFormPatientId] = useState<string>('');
  const [formPatientLookupQuery, setFormPatientLookupQuery] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formUnit, setFormUnit] = useState('یونیت آبی');
  const [formDoctor, setFormDoctor] = useState('دکتر مهدی امیری');
  const [formTime, setFormTime] = useState('۱۷:۰۰');
  const [formDuration, setFormDuration] = useState<number>(45);
  const [formTreatment, setFormTreatment] = useState('معاینه و طرح درمان');
  const [formShowCal, setFormShowCal] = useState(false);
  const [autoCreatePatientFile, setAutoCreatePatientFile] = useState(true);
  const [sendSmsOnCreate, setSendSmsOnCreate] = useState(true);
  const [formReminderConfig, setFormReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('1d_before'));
  const [formRecurrenceCadence, setFormRecurrenceCadence] = useState<'single' | 'weekly' | 'biweekly' | 'monthly'>('single');
  const [formRecurrenceCount, setFormRecurrenceCount] = useState<number>(2);
  const [conflictOverrideConfirmed, setConflictOverrideConfirmed] = useState(false);
  const [confirmCreateStep, setConfirmCreateStep] = useState(false);
  const [modalShake, setModalShake] = useState(false);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [activeWaitlistFulfillId, setActiveWaitlistFulfillId] = useState<string | null>(null);

  // Waitlist Tab Form state
  const [wlName, setWlName] = useState('');
  const [wlPhone, setWlPhone] = useState('');
  const [wlUnit, setWlUnit] = useState('یونیت آبی');
  const [wlShift, setWlShift] = useState<WaitlistEntry['preferredShift']>('any');
  const [wlPriority, setWlPriority] = useState<WaitlistEntry['priority']>('normal');
  const [wlTreatment, setWlTreatment] = useState('');

  // Schedule Settings Tab Form state
  const [newHolidayDate, setNewHolidayDate] = useState(() => getCurrentPersianDate());
  const [newHolidayReason, setNewHolidayReason] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDoctor, setNewUnitDoctor] = useState('دکتر مهدی امیری');
  const [newUnitColor, setNewUnitColor] = useState('#0ea5e9');

  useEscapeKey(Boolean(quickMoveModalApt), () => setQuickMoveModalApt(null));
  useEscapeKey(showAddModal, () => {
    setShowAddModal(false);
    setFormErrorMsg(null);
    setConflictOverrideConfirmed(false);
    setConfirmCreateStep(false);
  });
  useEscapeKey(Boolean(editingApt), () => setEditingApt(null));

  React.useEffect(() => {
    if (!prefillDraft) return;
    if (prefillDraft.patientName) setFormPatientName(prefillDraft.patientName);
    if (prefillDraft.phone) setFormPhone(prefillDraft.phone);
    if (prefillDraft.treatment) setFormTreatment(prefillDraft.treatment);
    if (prefillDraft.unit) setFormUnit(normalizeClinicUnitName(prefillDraft.unit));
    if (prefillDraft.time) setFormTime(prefillDraft.time);
    if (prefillDraft.date) {
      const parts = toEnglishDigits(prefillDraft.date).split('/').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        setSelectedYear(parts[0]);
        setSelectedMonth(Math.max(0, Math.min(11, parts[1] - 1)));
        setSelectedDay(parts[2]);
      }
    } else {
      const curSelectedDate = formatPersianDateString(selectedYear, selectedMonth + 1, selectedDay);
      if (comparePersianDates(curSelectedDate, getCurrentPersianDate()) < 0) {
        const todayParts = getPersianDateParts();
        setSelectedYear(todayParts.year);
        setSelectedMonth(todayParts.monthIndex);
        setSelectedDay(todayParts.day);
      }
    }
    setFormErrorMsg(null);
    setConflictOverrideConfirmed(false);
    setConfirmCreateStep(false);
    setShowAddModal(true);
    onConsumePrefill?.();
  }, [prefillDraft, onConsumePrefill]);

  const { getCardFeedbackClasses } = useActionFeedback();
  const [expandedAptIds, setExpandedAptIds] = useState<Record<string, boolean>>({});
  const toggleAptExpand = (id: string) => {
    triggerHaptic('selection');
    setExpandedAptIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const daysInMonth = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
  const monthStartWeekdayOffset = getPersianMonthStartWeekdayIndex(selectedYear, selectedMonth + 1);
  const targetModalDate = formatPersianDateString(selectedYear, selectedMonth + 1, selectedDay);
  const selectedDayWeekdayName = getPersianWeekdayName(selectedYear, selectedMonth + 1, selectedDay);
  const todayStr = getCurrentPersianDate();
  const tomorrowStr = addDaysToPersianDate(todayStr, 1);

  const tomorrowActiveApts = useMemo(
    () => appointments.filter(a => isSamePersianDate(a.date, tomorrowStr) && isAppointmentActive(a.status)),
    [appointments, tomorrowStr]
  );

  const jumpToPersianDate = (dateStr: string) => {
    const clean = toEnglishDigits(dateStr).split('/');
    if (clean.length !== 3) return;
    const y = parseInt(clean[0], 10);
    const m = parseInt(clean[1], 10);
    const d = parseInt(clean[2], 10);
    if (y >= 1390 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      setSelectedYear(y);
      setSelectedMonth(m - 1);
      setSelectedDay(d);
    }
  };

  const dayAllAppointments = useMemo(() => {
    return appointments
      .filter(apt =>
        searchQuery.trim() && searchAllDates ? true : isSamePersianDate(apt.date, targetModalDate)
      )
      .sort((a, b) => parseTimeMinutes(a.time) - parseTimeMinutes(b.time));
  }, [appointments, targetModalDate, searchQuery, searchAllDates]);

  const dayStats = useMemo(() => {
    let waiting = 0;
    let inChair = 0;
    let completed = 0;
    let scheduled = 0;
    let noShow = 0;
    let cancelled = 0;
    for (const a of dayAllAppointments) {
      if (a.status === 'waiting') waiting++;
      else if (a.status === 'in_chair') inChair++;
      else if (a.status === 'completed') completed++;
      else if (a.status === 'scheduled') scheduled++;
      else if (a.status === 'no_show') noShow++;
      else if (a.status === 'cancelled') cancelled++;
    }
    return {
      total: dayAllAppointments.length,
      waiting,
      inChair,
      completed,
      scheduled,
      noShow,
      cancelled
    };
  }, [dayAllAppointments]);

  const d3HourlyLoad = useMemo(() => {
    const hours = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
    const rows = hours.map(hr => {
      const hrInt = Number(hr);
      const activeCount = dayAllAppointments.filter(a => {
        if (!isAppointmentActive(a.status)) return false;
        const h = Math.floor(parseTimeMinutes(a.time) / 60);
        return h === hrInt;
      }).length;
      const doneCount = dayAllAppointments.filter(a => {
        if (a.status !== 'completed') return false;
        const h = Math.floor(parseTimeMinutes(a.time) / 60);
        return h === hrInt;
      }).length;
      return {
        hourEn: hr,
        hourFa: toPersianDigits(hr),
        total: activeCount + doneCount,
        activeCount,
        doneCount
      };
    });
    const width = 460;
    const height = 104;
    const margin = { top: 14, right: 10, bottom: 22, left: 22 };
    const maxUnits = Math.max(3, clinicUnits.length, d3.max(rows, r => r.total) || 3);
    const xScale = d3
      .scaleBand<string>()
      .domain(rows.map(r => r.hourEn))
      .range([margin.left, width - margin.right])
      .padding(0.24);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxUnits])
      .nice()
      .range([height - margin.bottom, margin.top]);
    const baselineY = yScale(0);
    return {
      width,
      height,
      margin,
      baselineY,
      maxUnits,
      bars: rows.map(r => {
        const x = xScale(r.hourEn) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(r.total);
        const h = Math.max(r.total > 0 ? 6 : 3, baselineY - y);
        const ratio = r.total / Math.max(1, clinicUnits.length);
        const fill = r.total === 0 ? '#cbd5e1' : ratio >= 1 ? '#e11d48' : ratio >= 0.6 ? '#f59e0b' : '#0284c7';
        return {
          ...r,
          x,
          y: baselineY - h,
          barW,
          h,
          fill
        };
      })
    };
  }, [dayAllAppointments, clinicUnits.length]);

  const filteredAppointments = dayAllAppointments.filter(apt => {
    const normalizedAptUnit = normalizeClinicUnitName(apt.unit);
    const matchesUnit = selectedUnit === 'همه' || normalizedAptUnit === selectedUnit;
    const matchesDoctor = selectedDoctor === 'همه' || apt.doctor === selectedDoctor;
    const matchesStatus = selectedStatus === 'همه' || apt.status === selectedStatus;
    const matchesSearch =
      !searchQuery ||
      apt.patientName.includes(searchQuery) ||
      apt.phone.includes(searchQuery) ||
      apt.treatment.includes(searchQuery);
    return matchesUnit && matchesDoctor && matchesStatus && matchesSearch;
  });

  // Freed cancellation/no-show slots today for smart Waitlist backfill banner
  const freedSlotsForWaitlist = useMemo(() => {
    if (waitlist.length === 0) return [];
    return dayAllAppointments.filter(
      a =>
        (a.status === 'cancelled' || a.status === 'no_show') &&
        !isPastPersianDateTime(a.date, a.time) &&
        !appointments.some(
          other =>
            other.id !== a.id &&
            isSamePersianDate(other.date, a.date) &&
            normalizeClinicUnitName(other.unit) === normalizeClinicUnitName(a.unit) &&
            isAppointmentActive(other.status) &&
            appointmentsOverlap(other.time, other.durationMinutes || 45, a.time, a.durationMinutes || 45)
        )
    );
  }, [dayAllAppointments, appointments, waitlist.length]);

  const selectedDayHolidayInfo = useMemo(() => {
    const custom = scheduleSettings.customHolidays.find(h => isSamePersianDate(h.date, targetModalDate));
    if (custom) return { isHoliday: true, reason: custom.reason };
    const off = isOfficialIranianHoliday(targetModalDate);
    if (scheduleSettings.blockOfficialHolidays && off.isHoliday) return off;
    return { isHoliday: false, reason: '' };
  }, [targetModalDate, scheduleSettings]);

  const isSelectedSlotInPast = isPastPersianDateTime(targetModalDate, formTime);

  // Full Interval-Aware Occupied & Blocked Maps for Add Modal
  const addModalOccupiedTimes = useMemo(
    () =>
      buildOccupiedSlotsMap(appointments, {
        dateStr: targetModalDate,
        unitId: formUnit,
        doctorName: formDoctor,
        candidateDuration: formDuration
      }),
    [appointments, targetModalDate, formUnit, formDoctor, formDuration]
  );

  const addModalBlockedTimes = useMemo(
    () => buildBlockedScheduleSlotsMap(targetModalDate, formDoctor, scheduleSettings),
    [targetModalDate, formDoctor, scheduleSettings]
  );

  // Live interval + cross-unit doctor collision detection scoped to selected Jalali Date
  const conflictingUnitApt = appointments.find(
    a =>
      isSamePersianDate(a.date, targetModalDate) &&
      normalizeClinicUnitName(a.unit) === normalizeClinicUnitName(formUnit) &&
      isAppointmentActive(a.status) &&
      appointmentsOverlap(a.time, a.durationMinutes || 45, formTime, formDuration)
  );
  const conflictingDoctorApt = appointments.find(
    a =>
      isSamePersianDate(a.date, targetModalDate) &&
      a.doctor === formDoctor &&
      normalizeClinicUnitName(a.unit) !== normalizeClinicUnitName(formUnit) &&
      isAppointmentActive(a.status) &&
      appointmentsOverlap(a.time, a.durationMinutes || 45, formTime, formDuration)
  );
  const conflictingAptInModal = conflictingUnitApt || conflictingDoctorApt;

  // Quick Patient Autocomplete matches (scales cleanly to huge rosters)
  const patientAutocompleteMatches = useMemo(() => {
    const q = formPatientLookupQuery.trim();
    if (!q) return [];
    const qEng = toEnglishDigits(q).toLowerCase();
    return patients
      .filter(
        p =>
          p.fullName.toLowerCase().includes(q.toLowerCase()) ||
          toEnglishDigits(p.phone || '').includes(qEng) ||
          (p.fileNumber || '').toLowerCase().includes(qEng)
      )
      .slice(0, 8);
  }, [patients, formPatientLookupQuery]);

  // Auto-resolve matched patient live while typing Name/Phone in Add Modal
  const matchedPatientInAddForm = useMemo(() => {
    if (formPatientId) {
      const byId = patientLookup.byId.get(formPatientId);
      if (byId) return byId;
    }
    const phoneDigits = toEnglishDigits(formPhone || '').replace(/\D/g, '');
    if (phoneDigits.length >= 7) {
      const byPh = patientLookup.byPhone.get(phoneDigits.slice(-7));
      if (byPh) return byPh;
    }
    if (formPatientName.trim().length >= 3) {
      return patientLookup.byName.get(formPatientName.trim());
    }
    return undefined;
  }, [formPatientId, formPhone, formPatientName, patientLookup]);

  const sameDayActiveAptsForMatchedPatient = useMemo(() => {
    if (!formPatientName.trim() && !matchedPatientInAddForm) return [];
    const last7 = toEnglishDigits(formPhone || matchedPatientInAddForm?.phone || '').replace(/\D/g, '').slice(-7);
    return appointments.filter(a => {
      if (!isSamePersianDate(a.date, targetModalDate) || !isAppointmentActive(a.status)) return false;
      if (matchedPatientInAddForm && a.patientId === matchedPatientInAddForm.id) return true;
      if (last7.length >= 7 && toEnglishDigits(a.phone || '').replace(/\D/g, '').slice(-7) === last7) return true;
      return Boolean(formPatientName.trim()) && a.patientName.trim() === formPatientName.trim();
    });
  }, [appointments, targetModalDate, formPatientName, formPhone, matchedPatientInAddForm]);

  const matchedPatientNoShowHistoryCount = useMemo(() => {
    if (!matchedPatientInAddForm && !formPhone) return 0;
    const byId = matchedPatientInAddForm ? patientNoShowCounts.get(matchedPatientInAddForm.id) || 0 : 0;
    const last7 = toEnglishDigits(formPhone || matchedPatientInAddForm?.phone || '').replace(/\D/g, '').slice(-7);
    const byPh = last7.length >= 7 ? patientNoShowCounts.get(`ph:${last7}`) || 0 : 0;
    return Math.max(byId, byPh);
  }, [matchedPatientInAddForm, formPhone, patientNoShowCounts]);

  const addFormNoShowRisk = useMemo(() => {
    return predictAppointmentNoShowRisk({
      patient: matchedPatientInAddForm,
      phone: formPhone,
      patientName: formPatientName,
      appointments,
      targetTime: formTime,
      treatment: formTreatment
    });
  }, [matchedPatientInAddForm, formPhone, formPatientName, appointments, formTime, formTreatment]);

  const findNextAvailableSlot = (dateStr: string, unitId: string, docName: string, dur: number): string => {
    const normUnit = normalizeClinicUnitName(unitId);
    const blockedMap = buildBlockedScheduleSlotsMap(dateStr, docName, scheduleSettings);
    return (
      STANDARD_TIME_SLOTS.find(
        slot =>
          !isPastPersianDateTime(dateStr, slot) &&
          !blockedMap[slot] &&
          !appointments.some(
            a =>
              isSamePersianDate(a.date, dateStr) &&
              (normalizeClinicUnitName(a.unit) === normUnit || a.doctor === docName) &&
              isAppointmentActive(a.status) &&
              appointmentsOverlap(a.time, a.durationMinutes || 45, slot, dur)
          )
      ) || '۱۹:۳۰'
    );
  };

  const nextAvailableSlotInModal = findNextAvailableSlot(targetModalDate, formUnit, formDoctor, formDuration);

  const isFormDoctorOffDay = useMemo(
    () => isDoctorOffOnDate(targetModalDate, formDoctor, scheduleSettings),
    [targetModalDate, formDoctor, scheduleSettings]
  );

  const nextWorkingDateForFormDoctor = useMemo(
    () => findNextWorkingDate(targetModalDate, formDoctor, scheduleSettings),
    [targetModalDate, formDoctor, scheduleSettings]
  );

  const recurringTargetDates = useMemo(
    () => buildRecurringSessionDates(targetModalDate, formRecurrenceCadence, formRecurrenceCount),
    [targetModalDate, formRecurrenceCadence, formRecurrenceCount]
  );

  // QuickMove Modal Live Occupied & Blocked Maps
  const quickMoveOccupiedTimes = useMemo(() => {
    if (!quickMoveModalApt) return {};
    return buildOccupiedSlotsMap(appointments, {
      dateStr: quickMoveDate,
      unitId: quickMoveUnit,
      doctorName: quickMoveModalApt.doctor,
      candidateDuration: quickMoveModalApt.durationMinutes || 45,
      excludeAppointmentId: quickMoveModalApt.id
    });
  }, [appointments, quickMoveModalApt, quickMoveDate, quickMoveUnit]);

  const quickMoveBlockedTimes = useMemo(() => {
    if (!quickMoveModalApt) return {};
    return buildBlockedScheduleSlotsMap(quickMoveDate, quickMoveModalApt.doctor, scheduleSettings);
  }, [quickMoveDate, quickMoveModalApt, scheduleSettings]);

  // Edit Modal Live Occupied & Blocked Maps
  const editModalOccupiedTimes = useMemo(() => {
    if (!editingApt) return {};
    return buildOccupiedSlotsMap(appointments, {
      dateStr: editAptDate,
      unitId: editAptUnit,
      doctorName: editAptDoctor,
      candidateDuration: editAptDuration,
      excludeAppointmentId: editingApt.id
    });
  }, [appointments, editingApt, editAptDate, editAptUnit, editAptDoctor, editAptDuration]);

  const editModalBlockedTimes = useMemo(
    () => (editingApt ? buildBlockedScheduleSlotsMap(editAptDate, editAptDoctor, scheduleSettings) : {}),
    [editingApt, editAptDate, editAptDoctor, scheduleSettings]
  );

  const openAddModalSmart = (
    unitOverride?: string,
    timeOverride?: string,
    opts?: { dateStr?: string; patient?: Patient; waitlistEntry?: WaitlistEntry }
  ) => {
    triggerHaptic('medium');
    const chosenUnit = normalizeClinicUnitName(
      unitOverride || opts?.waitlistEntry?.preferredUnit || (selectedUnit !== 'همه' ? selectedUnit : clinicUnits[0]?.id || 'یونیت آبی')
    );
    const chosenDoctor = getDefaultDoctorForUnit(chosenUnit);
    let effectiveDate = opts?.dateStr || targetModalDate;
    if (comparePersianDates(effectiveDate, todayStr) < 0) {
      effectiveDate = todayStr;
    }
    jumpToPersianDate(effectiveDate);
    const chosenTime = timeOverride || findNextAvailableSlot(effectiveDate, chosenUnit, chosenDoctor, formDuration);

    if (opts?.patient) {
      setFormPatientId(opts.patient.id);
      setFormPatientName(opts.patient.fullName);
      setFormPhone(opts.patient.phone);
      setFormPatientLookupQuery(`${opts.patient.fullName} (${opts.patient.fileNumber})`);
    } else if (opts?.waitlistEntry) {
      setFormPatientId('');
      setFormPatientName(opts.waitlistEntry.patientName);
      setFormPhone(opts.waitlistEntry.phone);
      setFormTreatment(opts.waitlistEntry.treatment || 'معاینه و طرح درمان');
      setFormPatientLookupQuery(opts.waitlistEntry.patientName);
      setActiveWaitlistFulfillId(opts.waitlistEntry.id);
    } else {
      setActiveWaitlistFulfillId(null);
    }

    setFormUnit(chosenUnit);
    setFormDoctor(chosenDoctor);
    setFormTime(chosenTime);
    setFormShowCal(false);
    setFormErrorMsg(null);
    setConflictOverrideConfirmed(false);
    setConfirmCreateStep(false);
    setShowAddModal(true);
  };

  const getSmartQuickSlotsForUnit = (unitId: string, unitApts: Appointment[]): string[] => {
    const isToday = isSamePersianDate(targetModalDate, todayStr);
    const futureOrCurrent = STANDARD_TIME_SLOTS.filter(slot => !isPastPersianDateTime(targetModalDate, slot));
    const pool = futureOrCurrent.length >= 4 ? futureOrCurrent : STANDARD_TIME_SLOTS.slice(-4);

    const hasMorningApt = unitApts.some(a => parseTimeMinutes(a.time) < 14 * 60);
    const orderedPool = !isToday && !hasMorningApt
      ? [...pool.filter(s => parseTimeMinutes(s) >= 16 * 60), ...pool]
      : pool;

    const occupiedSlots = orderedPool.filter(slot =>
      unitApts.some(a => isAppointmentActive(a.status) && appointmentsOverlap(a.time, a.durationMinutes || 45, slot, 45))
    );
    const freeSlots = orderedPool.filter(slot => !occupiedSlots.includes(slot));

    const combined = Array.from(new Set([...occupiedSlots.slice(0, 2), ...freeSlots.slice(0, 4)])).slice(0, 4);
    return combined.sort((a, b) => parseTimeMinutes(a) - parseTimeMinutes(b));
  };

  const quickTriggerPhoneReminder = async (apt: Appointment) => {
    triggerHaptic('medium');
    let perm = getPhoneNotificationPermission();
    if (perm === 'default') {
      perm = await requestPhoneNotificationPermission();
    }
    const sent = await sendPhoneNotification({
      id: `apt-quick-${apt.id}-${Date.now()}`,
      title: `یادآوری نوبت (${toPersianDigits(apt.time)}): ${apt.patientName}`,
      body: `${apt.treatment} · ${normalizeClinicUnitName(apt.unit)} · ${apt.doctor}`,
      view: 'appointments',
      patientId: apt.patientId,
      tag: `minadental-apt-${apt.id}`
    });
    if (sent) {
      actionFeedback.recordSuccess({
        title: `اعلان نوبت روی گوشی ارسال شد`,
        subtitle: `${apt.patientName} · ساعت ${toPersianDigits(apt.time)} (${normalizeClinicUnitName(apt.unit)})`,
        targetRecordId: apt.id,
        badgeText: '✓ نوتیف گوشی ارسال شد',
        canUndo: false
      });
      showToast(`اعلان نوبت «${apt.patientName}» به نوتیفیکیشن گوشی ارسال شد.`);
    } else {
      showToast(
        perm === 'denied'
          ? 'مجوز نوتیفیکیشن در مرورگر مسدود است؛ از تنظیمات سایت Allow کنید.'
          : `یادآور درون‌برنامه برای نوبت ${apt.patientName} (ساعت ${toPersianDigits(apt.time)}) فعال شد.`
      );
    }
  };

  const handleBatchReminderDispatch = async (targetDateLabel: string, targetList: Appointment[]) => {
    const activeTargets = targetList.filter(a => isAppointmentActive(a.status));
    if (activeTargets.length === 0) {
      showToast(`برای تاریخ ${toPersianDigits(targetDateLabel)} نوبت فعالی جهت یادآوری ثبت نشده است.`);
      return;
    }

    let dispatched = 0;
    for (const apt of activeTargets) {
      const res = await clinicalSmsService.sendPatternSms(
        apt.phone,
        apt.patientName,
        'appointment_reminder',
        { date: apt.date, time: apt.time }
      );
      if (res.success) dispatched++;
    }

    const perm = getPhoneNotificationPermission();
    if (perm === 'granted') {
      await sendPhoneNotification({
        id: `batch-rem-${Date.now()}`,
        title: `ارسال یادآور گروهی (${toPersianDigits(targetDateLabel)})`,
        body: `یادآور نوبت برای ${toPersianDigits(dispatched)} بیمار فعال ارسال و ثبت شد.`,
        tag: `minadental-batch-${targetDateLabel}`
      });
    }

    actionFeedback.recordSuccess({
      title: `یادآور گروهی ${toPersianDigits(targetDateLabel)} ارسال شد`,
      subtitle: `${toPersianDigits(dispatched)} پیامک خدماتی یادآوری نوبت با موفقیت در صف ارسال قرار گرفت.`,
      canUndo: false
    });
    showToast(`یادآور گروهی تاریخ ${toPersianDigits(targetDateLabel)} برای ${toPersianDigits(dispatched)} بیمار ارسال شد.`);
  };

  const persistAutoSmsRules = (next: typeof autoSmsRules) => {
    setAutoSmsRules(next);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('minadental_auto_sms_rules_v1', JSON.stringify(next));
      } catch {
        // Ignore storage quota issues
      }
    }
  };

  const formatNativeSmsHref = (apt: Appointment): string => {
    const clean = toEnglishDigits(apt.phone || '').replace(/\D/g, '');
    const text = `بیمار گرامی ${apt.patientName}، یادآوری نوبت کلینیک دندانپزشکی مینادنتال: تاریخ ${toPersianDigits(apt.date)} ساعت ${toPersianDigits(apt.time)} (${normalizeClinicUnitName(apt.unit)}).`;
    return `sms:${clean}?body=${encodeURIComponent(text)}`;
  };

  const quickDispatchServiceSms = async (apt: Appointment) => {
    triggerHaptic('medium');
    const res = await clinicalSmsService.sendPatternSms(
      apt.phone,
      apt.patientName,
      'appointment_reminder',
      { date: apt.date, time: apt.time, doctor: apt.doctor }
    );
    if (res.success) {
      actionFeedback.recordSuccess({
        title: `پیامک خدماتی برای ${apt.patientName} ارسال شد`,
        subtitle: `ساعت ${toPersianDigits(apt.time)} · شناسه پیگیری: ${res.refId}`,
        targetRecordId: apt.id,
        badgeText: '✓ پیامک سرویس ارسال شد',
        canUndo: false
      });
      showToast(`پیامک یادآوری نوبت برای ${apt.patientName} از طریق سرویس پیامکی ارسال شد (${res.refId}).`);
    } else {
      actionFeedback.recordError({ title: 'خطا در ارسال پیامک', subtitle: res.message });
      showToast(res.message);
    }
  };

  const handleStatusChangeWithAutoSms = async (
    apt: Appointment,
    nextStatus: Appointment['status'],
    reason?: string
  ) => {
    onUpdateStatus(apt.id, nextStatus, reason);
    if (nextStatus === 'completed') {
      setCompletedFollowUpApt(apt);
    }

    if (!autoSmsRules.enabled) return;
    const shouldFire =
      (nextStatus === 'in_chair' && autoSmsRules.onInChair) ||
      (nextStatus === 'completed' && autoSmsRules.onCompleted) ||
      (nextStatus === 'no_show' && autoSmsRules.onNoShow);

    if (!shouldFire) return;
    const res = await clinicalSmsService.sendPatternSms(
      apt.phone,
      apt.patientName,
      'appointment_reminder',
      { date: apt.date, time: apt.time, doctor: apt.doctor }
    );
    if (res.success) {
      actionFeedback.recordSuccess({
        title: `ارسال اتوماتیک پیامک برای ${apt.patientName}`,
        subtitle: `وضعیت «${renderStatusLabel(nextStatus)}» · شناسه: ${res.refId}`,
        targetRecordId: apt.id,
        badgeText: '✓ پیامک خودکار',
        canUndo: false
      });
    }
  };

  const triggerModalShake = () => {
    setModalShake(false);
    setTimeout(() => setModalShake(true), 10);
    setTimeout(() => setModalShake(false), 500);
  };

  const showToast = (msg: string) => {
    setSmsToast(msg);
    setTimeout(() => setSmsToast(null), 3500);
  };

  const jumpToToday = () => {
    triggerHaptic('selection');
    const p = getPersianDateParts();
    setSelectedYear(p.year);
    setSelectedMonth(p.monthIndex);
    setSelectedDay(p.day);
  };

  const handleCascadeShiftUnit = (unitId: string, shiftMins: number) => {
    if (!onBatchShiftAppointments) return;
    const normUnit = normalizeClinicUnitName(unitId);
    const queue = dayAllAppointments.filter(
      a =>
        normalizeClinicUnitName(a.unit) === normUnit &&
        (a.status === 'scheduled' || a.status === 'waiting')
    );
    if (queue.length === 0) {
      showToast(`نوبت فعالی در صف انتظار ${normUnit} برای شیفت وجود ندارد.`);
      return;
    }
    const updates = queue.map(a => ({
      id: a.id,
      time: shiftPersianTimeMinutes(a.time, shiftMins)
    }));
    triggerHaptic('medium');
    onBatchShiftAppointments(updates, normUnit);
    showToast(`${toPersianDigits(updates.length)} نوبت ${normUnit} به میزان ${toPersianDigits(shiftMins)} دقیقه به جلو شیفت داده شد.`);
  };

  const handleCreate = async (e?: React.FormEvent, forceOverride?: boolean) => {
    if (e) e.preventDefault();
    if (!formPatientName.trim()) {
      triggerModalShake();
      setFormErrorMsg('لطفاً نام و نام خانوادگی بیمار را وارد نمایید.');
      actionFeedback.recordError({
        title: 'نام بیمار وارد نشده است',
        subtitle: 'برای ثبت نوبت جدید وارد کردن نام بیمار الزامی است.'
      });
      return;
    }

    if (isPastPersianDateTime(targetModalDate, formTime)) {
      triggerModalShake();
      setFormErrorMsg(
        `ثبت نوبت برای تاریخ یا ساعت گذشته (${toPersianDigits(targetModalDate)} ساعت ${toPersianDigits(formTime)}) مجاز نیست.`
      );
      actionFeedback.recordError({
        title: 'امکان ثبت نوبت در زمان گذشته وجود ندارد',
        subtitle: `تاریخ ${toPersianDigits(targetModalDate)} ساعت ${toPersianDigits(formTime)} گذشته است. لطفاً امروز یا روزهای آینده را انتخاب کنید.`
      });
      return;
    }

    // Check for Unit or Cross-Unit Doctor interval overlap unless explicitly overridden
    if (conflictingAptInModal && !conflictOverrideConfirmed && !forceOverride) {
      triggerModalShake();
      const conflictReason = conflictingDoctorApt && !conflictingUnitApt
        ? `تداخل برنامه پزشک! ${formDoctor} در ساعت ${toPersianDigits(formTime)} در «${normalizeClinicUnitName(conflictingDoctorApt.unit)}» برای بیمار «${conflictingDoctorApt.patientName}» نوبت همپوشان دارد.`
        : `تداخل زمانی! در ${formUnit} بازه ساعت ${toPersianDigits(formTime)} با نوبت بیمار «${conflictingAptInModal.patientName}» (${toPersianDigits(conflictingAptInModal.time)}) همپوشانی دارد.`;
      setFormErrorMsg(conflictReason);
      actionFeedback.recordConflict({
        title: `تداخل نوبت در ${normalizeClinicUnitName(conflictingAptInModal.unit)} ساعت ${toPersianDigits(formTime)}`,
        subtitle: conflictReason,
        targetRecordId: conflictingAptInModal.id,
        badgeText: `⚠️ تداخل با نوبت جدید (${toPersianDigits(formTime)})`,
        resolutionAction: {
          label: `انتخاب ساعت خالی (${toPersianDigits(nextAvailableSlotInModal)})`,
          onClick: () => {
            setFormTime(nextAvailableSlotInModal);
            setFormErrorMsg(null);
            setConflictOverrideConfirmed(false);
          }
        }
      });
      return;
    }

    const aptDate = formatPersianDateString(selectedYear, selectedMonth + 1, selectedDay);
    let resolvedPatient = matchedPatientInAddForm;

    if (!resolvedPatient && autoCreatePatientFile && onQuickCreatePatient) {
      resolvedPatient = onQuickCreatePatient({
        fullName: formPatientName.trim(),
        phone: formPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
        notes: `پرونده ساخته‌شده همزمان با رزرو نوبت ${aptDate}`
      });
    }

    const recurringDatesToBook = buildRecurringSessionDates(aptDate, formRecurrenceCadence, formRecurrenceCount);
    let createdCount = 0;
    for (let idx = 0; idx < recurringDatesToBook.length; idx++) {
      const targetSessionDate = recurringDatesToBook[idx];
      if (idx > 0 && !conflictOverrideConfirmed && !forceOverride) {
        const hasSeriesConflict = appointments.some(
          a =>
            isSamePersianDate(a.date, targetSessionDate) &&
            (normalizeClinicUnitName(a.unit) === normalizeClinicUnitName(formUnit) || a.doctor === formDoctor) &&
            isAppointmentActive(a.status) &&
            appointmentsOverlap(a.time, a.durationMinutes || 45, formTime, formDuration)
        );
        if (hasSeriesConflict) continue;
      }
      onAddAppointment({
        patientId: resolvedPatient?.id || `pat-${Date.now()}`,
        patientName: formPatientName.trim(),
        phone: formPhone || resolvedPatient?.phone || '۰۹۱۲۰۰۰۰۰۰۰',
        unit: normalizeClinicUnitName(formUnit),
        doctor: formDoctor,
        date: targetSessionDate,
        time: formTime,
        durationMinutes: formDuration,
        treatment:
          recurringDatesToBook.length > 1
            ? `${formTreatment} (جلسه ${toPersianDigits(idx + 1)} از ${toPersianDigits(recurringDatesToBook.length)})`
            : formTreatment,
        status: 'scheduled',
        reminderConfig: formReminderConfig
      });
      createdCount++;
    }

    if (activeWaitlistFulfillId) {
      persistWaitlist(waitlist.filter(w => w.id !== activeWaitlistFulfillId));
      setActiveWaitlistFulfillId(null);
    }

    if (sendSmsOnCreate && formPhone) {
      const res = await clinicalSmsService.sendPatternSms(
        formPhone,
        formPatientName,
        'appointment_reminder',
        {
          date: aptDate,
          time: formTime,
          doctor: formDoctor
        }
      );
      if (res.success) {
        showToast(
          createdCount > 1
            ? `${toPersianDigits(createdCount)} جلسه نوبت برای ${formPatientName} ثبت و پیامک تایید ارسال شد.`
            : `پیامک تایید نوبت برای ${formPatientName} ارسال شد (شناسه: ${res.refId})`
        );
      } else {
        showToast(`نوبت ثبت شد. پیامک: ${res.message}`);
      }
    } else {
      showToast(
        createdCount > 1
          ? `${toPersianDigits(createdCount)} جلسه نوبت برای ${formPatientName} در تقویم ثبت شد.`
          : `نوبت ${formPatientName} با موفقیت در تقویم ثبت شد.`
      );
    }

    setShowAddModal(false);
    setFormPatientId('');
    setFormPatientLookupQuery('');
    setFormPatientName('');
    setFormPhone('');
    setFormRecurrenceCadence('single');
    setFormErrorMsg(null);
    setConflictOverrideConfirmed(false);
    setConfirmCreateStep(false);
  };

  const handlePatientSelectInForm = (p: Patient) => {
    setFormPatientId(p.id);
    setFormPatientName(p.fullName);
    setFormPhone(p.phone);
    setFormPatientLookupQuery(`${p.fullName} (${p.fileNumber})`);
    setFormErrorMsg(null);
  };

  // Drag and Drop event handlers
  const handleDragStart = (e: React.DragEvent, apt: Appointment) => {
    triggerHaptic('light');
    setDraggedAptId(apt.id);
    e.dataTransfer.setData('text/plain', apt.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedAptId(null);
    setDragOverZone(null);
  };

  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverZone !== targetKey) {
      setDragOverZone(targetKey);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, targetKey: string) => {
    if (dragOverZone === targetKey) {
      setDragOverZone(null);
    }
  };

  const handleDropOnUnit = (e: React.DragEvent, targetUnit: string, targetTime?: string) => {
    e.preventDefault();
    triggerHaptic('medium');
    const aptId = e.dataTransfer.getData('text/plain') || draggedAptId;
    if (!aptId) return;

    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const normTarget = normalizeClinicUnitName(targetUnit);
    if (normalizeClinicUnitName(apt.unit) === normTarget && (!targetTime || apt.time === targetTime)) {
      setDraggedAptId(null);
      setDragOverZone(null);
      return;
    }

    const effectiveTime = targetTime || apt.time;
    const effectiveDur = apt.durationMinutes || 45;
    if (isPastPersianDateTime(apt.date, effectiveTime)) {
      actionFeedback.recordError({
        title: 'امکان انتقال به زمان گذشته وجود ندارد',
        subtitle: `زمان مقصد (${toPersianDigits(apt.date)} ساعت ${toPersianDigits(effectiveTime)}) در گذشته قرار دارد.`
      });
      setDraggedAptId(null);
      setDragOverZone(null);
      return;
    }
    const collision = appointments.find(
      a =>
        a.id !== apt.id &&
        isSamePersianDate(a.date, apt.date) &&
        (normalizeClinicUnitName(a.unit) === normTarget || a.doctor === apt.doctor) &&
        isAppointmentActive(a.status) &&
        appointmentsOverlap(a.time, a.durationMinutes || 45, effectiveTime, effectiveDur)
    );

    if (collision) {
      actionFeedback.recordConflict({
        title: `تداخل انتقال به ${normTarget} ساعت ${toPersianDigits(effectiveTime)}`,
        subtitle: `بیمار «${collision.patientName}» در تاریخ ${toPersianDigits(apt.date)} بازه همپوشان دارد.`,
        targetRecordId: collision.id,
        badgeText: `⚠️ تداخل ساعت ${toPersianDigits(effectiveTime)} با ${apt.patientName}`
      });
      setDraggedAptId(null);
      setDragOverZone(null);
      return;
    }

    onMoveAppointment?.(aptId, normTarget, targetTime);
    showToast(`نوبت ${apt.patientName} با موفقیت به ${normTarget}${targetTime ? ` (ساعت ${targetTime})` : ''} منتقل شد.`);

    setDraggedAptId(null);
    setDragOverZone(null);
  };

  const handleQuickMoveConfirm = (newUnit: string, newTime: string, newDate: string) => {
    if (!quickMoveModalApt) return;

    const normNewUnit = normalizeClinicUnitName(newUnit);
    if (isPastPersianDateTime(newDate, newTime)) {
      actionFeedback.recordError({
        title: 'تاریخ یا ساعت انتخابی در گذشته قرار دارد',
        subtitle: `نمی‌توان نوبت را به زمان گذشته (${toPersianDigits(newDate)} · ${toPersianDigits(newTime)}) منتقل کرد.`
      });
      return;
    }

    const collision = appointments.find(
      a =>
        a.id !== quickMoveModalApt.id &&
        isSamePersianDate(a.date, newDate) &&
        (normalizeClinicUnitName(a.unit) === normNewUnit || a.doctor === quickMoveModalApt.doctor) &&
        isAppointmentActive(a.status) &&
        appointmentsOverlap(a.time, a.durationMinutes || 45, newTime, quickMoveModalApt.durationMinutes || 45)
    );

    if (collision) {
      actionFeedback.recordConflict({
        title: `تداخل جابجایی در ${normNewUnit} ساعت ${toPersianDigits(newTime)}`,
        subtitle: `این بازه در تاریخ ${toPersianDigits(newDate)} با نوبت «${collision.patientName}» همپوشانی دارد.`,
        targetRecordId: collision.id,
        badgeText: `⚠️ ساعت ${toPersianDigits(newTime)} توسط این بیمار پر است`
      });
      return;
    }

    triggerHaptic('medium');
    onMoveAppointment?.(quickMoveModalApt.id, normNewUnit, newTime, newDate);
    jumpToPersianDate(newDate);
    showToast(`نوبت ${quickMoveModalApt.patientName} به ${normNewUnit} (${toPersianDigits(newDate)} ساعت ${toPersianDigits(newTime)}) منتقل شد.`);
    setQuickMoveModalApt(null);
  };

  const currentlyDraggedApt = appointments.find(a => a.id === draggedAptId);

  const renderStatusLabel = (status: Appointment['status']) => {
    if (status === 'in_chair') return 'روی یونیت';
    if (status === 'waiting') return 'در سالن';
    if (status === 'completed') return 'مختومه';
    if (status === 'cancelled') return 'لغو';
    if (status === 'no_show') return 'عدم حضور';
    return 'رزرو';
  };

  const renderStatusChipClass = (status: Appointment['status']) => {
    if (status === 'in_chair') return 'bg-[#c8ff00] text-black shadow-2xs';
    if (status === 'waiting') return 'bg-amber-100 text-amber-800';
    if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
    if (status === 'cancelled' || status === 'no_show') return 'bg-rose-100 text-rose-800';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-36 sm:pb-40 space-y-3">
      {/* Real-time Sync & Action Toast Notification */}
      {smsToast && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-sky-50 border-2 border-sky-300 text-sky-950 p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-black leading-tight block text-sky-950">{smsToast}</span>
          </div>
        </div>
      )}

      {/* 1-Tap Post-Completion Clinical Recall & Settlement Bar */}
      {completedFollowUpApt && (
        <div className="mx-2 mt-2 p-3 rounded-[20px] bg-emerald-50 border-2 border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-emerald-950 truncate">
                درمان «{completedFollowUpApt.patientName}» تکمیل شد — اقدام سریع بعدی:
              </h4>
              <span className="text-[10px] font-bold text-emerald-800 block">
                رزرو نوبت پیگیری یا تسویه حساب مالی با یک لمس
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {[
              { label: 'پیگیری +۱ هفته', date: addDaysToPersianDate(completedFollowUpApt.date, 7) },
              { label: 'پیگیری +۱ ماه', date: addMonthsToPersianDate(completedFollowUpApt.date, 1) },
              { label: 'چکاپ +۶ ماه', date: addMonthsToPersianDate(completedFollowUpApt.date, 6) }
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  const matched = resolvePatientForApt(completedFollowUpApt);
                  openAddModalSmart(completedFollowUpApt.unit, undefined, {
                    dateStr: item.date,
                    patient: matched
                  });
                  setCompletedFollowUpApt(null);
                }}
                className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10.5px] font-black cursor-pointer active:scale-95"
              >
                {item.label}
              </button>
            ))}
            {onOpenPaymentForPatient && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onOpenPaymentForPatient(completedFollowUpApt);
                  setCompletedFollowUpApt(null);
                }}
                className="min-h-[36px] px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>ثبت پرداخت</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCompletedFollowUpApt(null)}
              className="min-w-[34px] min-h-[34px] rounded-xl bg-white/80 hover:bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center cursor-pointer"
              aria-label="بستن نوار پیگیری"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Jalali Calendar Bar & Header */}
      <div className="relative z-20 mx-2 mt-2 min-w-0">
        <div className={getModuleHeaderCardClasses('sky')}>
          {/* Row 1: Title on Right, Actions on Left */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-sky-200/80 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <CalendarIcon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm text-slate-950 leading-none truncate">
                  نوبت‌دهی و تقویم جلالی
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Animated Search Magnifying Glass Toggle */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-sky-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجو در نوبت‌ها"
                aria-label="جستجو در نوبت‌ها"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAutoSmsPanelOpen(prev => !prev);
                }}
                className={`min-h-[40px] py-1.5 px-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                  autoSmsRules.enabled
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
                title="تنظیم ارسال اتوماتیک از طریق سرویس پیامکی"
                aria-label="تنظیمات سرویس پیامکی خودکار"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">
                  {autoSmsRules.enabled ? 'پیامک خودکار ✓' : 'پیامک خودکار'}
                </span>
              </button>

              <ArmedActionButton
                label={
                  tomorrowActiveApts.length > 0
                    ? `یادآور فردا (${toPersianDigits(tomorrowActiveApts.length)})`
                    : 'یادآور فردا'
                }
                confirmLabel="ارسال گروهی؟ ✓"
                icon={<BellRing className="w-3.5 h-3.5" />}
                onConfirm={() => void handleBatchReminderDispatch(tomorrowStr, tomorrowActiveApts)}
                title={`ارسال پیامک و یادآور گروهی به نوبت‌های فردا (${toPersianDigits(tomorrowStr)})`}
                className="min-h-[40px] py-1.5 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-extrabold text-xs flex items-center gap-1 cursor-pointer"
              />

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setPrintSheetOpen(prev => !prev);
                }}
                className={`min-h-[40px] py-1.5 px-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                  printSheetOpen
                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                    : 'bg-white hover:bg-sky-50 text-sky-800 border-sky-200'
                }`}
                title="نمایش و چاپ برنامه روزانه مطب"
                aria-label="چاپ برنامه روز"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">چاپ روز</span>
              </button>

              {onOpenBookingPortal && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onOpenBookingPortal();
                  }}
                  className="min-h-[40px] py-1.5 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-extrabold text-xs flex items-center gap-1 border border-sky-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                  title="باز کردن پورتال رزرو آنلاین نوبت برای بیماران"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden xs:inline">رزرو آنلاین</span>
                </button>
              )}
            </div>
          </div>

          {/* Animated Search Input + Scope Toggle */}
          {searchOpen && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
              <div className="relative">
                <Search className="w-4 h-4 text-sky-600 absolute right-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  placeholder="جستجو بر اساس نام بیمار، تلفن یا نوع درمان..."
                  aria-label="جستجو در نوبت‌ها"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 focus:border-sky-500 rounded-2xl pr-9 pl-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="پاک کردن متن جستجو"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-2.5 w-5 h-5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3 h-3 stroke-[3]" />
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-500">محدوده جستجو:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSearchAllDates(false)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${!searchAllDates ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      فقط روز انتخابی
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchAllDates(true)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${searchAllDates ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      همه تاریخ‌ها
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 2: Inline New Appointment CTA + Unified Multi-Color Chip Bar */}
          <div className="flex items-center gap-1.5 pt-0.5 pb-0.5 min-w-0">
            <button
              type="button"
              onClick={() => openAddModalSmart()}
              className="min-h-[36px] py-1.5 px-3 rounded-xl bg-[#c8ff00] hover:bg-[#bbf000] text-black font-black text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0 border border-lime-400/60"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>نوبت جدید</span>
            </button>
            <div role="tablist" aria-label="بخش‌های ماژول نوبت‌دهی" className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
              {[
                { id: 'board', label: 'بورد یونیت‌ها (زنده)', icon: Columns3 },
                { id: 'timeline', label: 'جدول ساعتی یونیت‌ها', icon: CalendarDays },
                { id: 'daily', label: 'لیست نوبت‌های روزانه', icon: Clock },
                { id: 'monthly', label: 'تقویم جامع ایرانی', icon: CalendarIcon },
                { id: 'waitlist', label: `لیست انتظار${waitlist.length > 0 ? ` (${toPersianDigits(waitlist.length)})` : ''}`, icon: Hourglass },
                { id: 'schedule', label: 'شیفت و تعطیلات', icon: Settings2 }
              ].map((chip, idx) => {
                const IconComp = chip.icon;
                return (
                  <button
                    role="tab"
                    aria-selected={viewMode === chip.id}
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setViewMode(chip.id as typeof viewMode);
                    }}
                    className={getUnifiedChipClasses(idx + 1, viewMode === chip.id)}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {viewMode !== 'waitlist' && viewMode !== 'schedule' && viewMode !== 'monthly' && (
            <>
              {/* Month Selector & Today Jump Navigation */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    if (selectedMonth >= 11) {
                      setSelectedMonth(0);
                      setSelectedYear(y => y + 1);
                    } else {
                      setSelectedMonth(prev => prev + 1);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="ماه بعد"
                  aria-label="ماه بعد"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-xs font-black text-slate-800">
                    {selectedDayWeekdayName} {toPersianDigits(selectedDay)} {PERSIAN_MONTHS[selectedMonth]} {toPersianDigits(selectedYear)}
                  </span>
                  {selectedDayHolidayInfo.isHoliday && (
                    <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
                      {selectedDayHolidayInfo.reason}
                    </span>
                  )}
                  {!isSamePersianDate(targetModalDate, todayStr) && (
                    <button
                      type="button"
                      onClick={jumpToToday}
                      className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-300 text-[10px] font-black cursor-pointer whitespace-nowrap"
                    >
                      بازگشت به امروز
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    if (selectedMonth <= 0) {
                      setSelectedMonth(11);
                      setSelectedYear(y => y - 1);
                    } else {
                      setSelectedMonth(prev => prev - 1);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="ماه قبل"
                  aria-label="ماه قبل"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Horizontal Day Scroller Strip for board / timeline / daily */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {daysInMonth.map(day => {
                    const isSelected = selectedDay === day;
                    const cellDateStr = formatPersianDateString(selectedYear, selectedMonth + 1, day);
                    const isTodayCell = isSamePersianDate(cellDateStr, todayStr);
                    const isPastCell = comparePersianDates(cellDateStr, todayStr) < 0;
                    const customHol = scheduleSettings.customHolidays.find(h => isSamePersianDate(h.date, cellDateStr));
                    const officialHol = isOfficialIranianHoliday(cellDateStr);
                    const isHolidayCell = Boolean(customHol) || (scheduleSettings.blockOfficialHolidays && officialHol.isHoliday);
                    const weekdayLabel = isTodayCell ? 'امروز' : getPersianWeekdayShortName(selectedYear, selectedMonth + 1, day);
                    const dayApts = appointments.filter(
                      a => a.date && isSamePersianDate(a.date, cellDateStr)
                    );
                    return (
                      <button
                        ref={isSelected ? selectedDayBtnRef : undefined}
                        type="button"
                        key={day}
                        title={customHol?.reason || officialHol.reason || cellDateStr}
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedDay(day);
                        }}
                        className={`flex flex-col items-center justify-center min-w-[50px] min-h-[54px] py-1.5 px-1.5 rounded-2xl transition-all duration-150 shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-sm'
                            : isTodayCell
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-400'
                              : isPastCell
                                ? 'bg-slate-100/70 text-slate-400 border border-slate-100'
                                : isHolidayCell
                                  ? 'bg-rose-50/80 text-rose-700 border border-rose-200/80'
                                  : 'bg-slate-50 text-slate-700 hover:bg-sky-50 border border-slate-100'
                        }`}
                      >
                        <span className={`text-[9.5px] font-bold whitespace-nowrap ${
                          isSelected ? 'text-sky-100' : isTodayCell ? 'text-emerald-700' : isHolidayCell ? 'text-rose-600' : 'text-slate-500'
                        }`}>
                          {weekdayLabel}
                        </span>
                        <span className="text-sm font-extrabold font-mono tabular-nums mt-0.5">
                          {toPersianDigits(day)}
                        </span>
                        {dayApts.length > 0 ? (
                          <span className={`text-[8.5px] font-mono font-black leading-none mt-0.5 ${isSelected ? 'text-[#c8ff00]' : 'text-sky-600'}`}>
                            {toPersianDigits(dayApts.length)}
                          </span>
                        ) : (
                          <span className="h-[9px] mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

              {/* Unit Filter + Daily Clinical Metrics & Doctor/Status Filters */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full">
                  {['همه', ...clinicUnits.map(u => u.id)].map(unit => (
                    <button
                      type="button"
                      key={unit}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedUnit(unit);
                      }}
                      className={`flex-1 min-h-[36px] py-1.5 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedUnit === unit
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>

                {/* Clean Single-Row Operational Summary + Doctor & Status Filter */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10.5px]">
                  <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-600 font-bold flex-wrap">
                    <span className="text-slate-900 font-black">آمار روز: {toPersianDigits(dayStats.total)} نوبت</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-700">در سالن: {toPersianDigits(dayStats.waiting)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-700">روی یونیت: {toPersianDigits(dayStats.inChair)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700">مختومه: {toPersianDigits(dayStats.completed)}</span>
                    {dayStats.noShow > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-700">عدم حضور: {toPersianDigits(dayStats.noShow)}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      aria-label="فیلتر پزشک معالج"
                      value={selectedDoctor}
                      onChange={(e) => {
                        triggerHaptic('selection');
                        setSelectedDoctor(e.target.value);
                      }}
                      className="min-h-[34px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[10.5px] font-bold text-slate-700 focus:outline-none focus:border-sky-500"
                    >
                      <option value="همه">همه پزشکان</option>
                      {clinicDoctors.map(doc => (
                        <option key={doc} value={doc}>{doc}</option>
                      ))}
                    </select>

                    <select
                      aria-label="فیلتر وضعیت نوبت"
                      value={selectedStatus}
                      onChange={(e) => {
                        triggerHaptic('selection');
                        setSelectedStatus(e.target.value as 'همه' | Appointment['status']);
                      }}
                      className="min-h-[34px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[10.5px] font-bold text-slate-700 focus:outline-none focus:border-sky-500"
                    >
                      <option value="همه">همه وضعیت‌ها</option>
                      <option value="scheduled">رزرو شده</option>
                      <option value="waiting">در سالن انتظار</option>
                      <option value="in_chair">روی یونیت</option>
                      <option value="completed">مختومه</option>
                      <option value="no_show">عدم حضور</option>
                      <option value="cancelled">لغو شده</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => openAddModalSmart(undefined, nextAvailableSlotInModal)}
                      className="min-h-[34px] px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black whitespace-nowrap shrink-0 cursor-pointer active:scale-95 transition-all"
                      title={`ثبت سریع در اولین ساعت خالی (${toPersianDigits(nextAvailableSlotInModal)})`}
                    >
                      + اولین ساعت خالی ({toPersianDigits(nextAvailableSlotInModal)})
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Auto-SMS Automation Service Control Drawer */}
      {autoSmsPanelOpen && (
        <div className="mx-2 p-3.5 rounded-[22px] bg-gradient-to-l from-indigo-50/90 via-white to-emerald-50/70 border-2 border-indigo-200 shadow-sm space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-950">
                  سرویس ارسال اتوماتیک پیامک نوبت‌دهی ({clinicalSmsService.getConfig().provider === 'kavenegar' ? 'کاوه‌نگار' : clinicalSmsService.getConfig().provider === 'farazsms' ? 'فرازاس‌ام‌اس' : 'ملی‌پیامک'})
                </h4>
                <span className="text-[10px] font-bold text-slate-500">
                  ارسال خودکار پیامک خدماتی هنگام ثبت نوبت، فراخوان روی یونیت، اتمام یا عدم حضور
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => persistAutoSmsRules({ ...autoSmsRules, enabled: !autoSmsRules.enabled })}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-[10.5px] font-black cursor-pointer transition-all ${
                  autoSmsRules.enabled
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {autoSmsRules.enabled ? 'ارسال خودکار: فعال ✓' : 'ارسال خودکار: خاموش'}
              </button>
              <button
                type="button"
                onClick={() => setAutoSmsPanelOpen(false)}
                className="min-w-[34px] min-h-[34px] rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                aria-label="بستن پنل سرویس پیامک خودکار"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10.5px]">
            {[
              { key: 'onCreate' as const, label: 'تایید هنگام ثبت نوبت' },
              { key: 'onInChair' as const, label: 'اعلام فراخوان به یونیت' },
              { key: 'onCompleted' as const, label: 'پیام مراقبت پس از اتمام' },
              { key: 'onNoShow' as const, label: 'پیگیری خودکار عدم حضور' }
            ].map(item => (
              <button
                key={item.key}
                type="button"
                disabled={!autoSmsRules.enabled}
                onClick={() => persistAutoSmsRules({ ...autoSmsRules, [item.key]: !autoSmsRules[item.key] })}
                className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border font-bold text-right flex items-center justify-between gap-1 cursor-pointer transition-all ${
                  !autoSmsRules.enabled
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : autoSmsRules[item.key]
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span>{autoSmsRules[item.key] ? '✓' : '—'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline Printable Daily Schedule Sheet (Bright Clinical Card + CSV Export) */}
      {printSheetOpen && (
        <div className="mx-2 p-3.5 rounded-[22px] bg-white border-2 border-sky-300 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-sky-100 pb-2">
            <div>
              <h4 className="text-xs font-black text-slate-950">
                برگه چاپی برنامه روزانه مطب مینادنتال · {selectedDayWeekdayName} {toPersianDigits(targetModalDate)}
              </h4>
              <span className="text-[10px] text-slate-500 font-bold">
                مجموع نوبت‌های فیلتر شده: {toPersianDigits(filteredAppointments.length)} نوبت · دکتر مهدی امیری
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <ArmedActionButton
                label="یادآور گروهی این روز"
                confirmLabel="تایید ارسال گروهی؟ ✓"
                icon={<Send className="w-3.5 h-3.5" />}
                onConfirm={() => void handleBatchReminderDispatch(targetModalDate, filteredAppointments)}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  const csv = generateAppointmentsCsvContent(targetModalDate, filteredAppointments);
                  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `minadental-schedule-${toEnglishDigits(targetModalDate).replace(/\//g, '-')}.csv`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    showToast('فایل اکسل برنامه روزانه دانلود شد.');
                  }
                }}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود اکسل (CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && typeof window.print === 'function') {
                    window.print();
                  }
                }}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ / خروجی PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintSheetOpen(false)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[10.5px] font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">نوبتی برای چاپ در این روز وجود ندارد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="p-2 border border-slate-200">ساعت</th>
                    <th className="p-2 border border-slate-200">یونیت</th>
                    <th className="p-2 border border-slate-200">بیمار</th>
                    <th className="p-2 border border-slate-200">تلفن</th>
                    <th className="p-2 border border-slate-200">پزشک</th>
                    <th className="p-2 border border-slate-200">درمان</th>
                    <th className="p-2 border border-slate-200">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map(apt => (
                    <tr key={`prt-${apt.id}`} className="border-b border-slate-200">
                      <td className="p-2 border border-slate-200 font-mono font-bold tabular-nums">{toPersianDigits(apt.time)}</td>
                      <td className="p-2 border border-slate-200 font-bold">{normalizeClinicUnitName(apt.unit)}</td>
                      <td className="p-2 border border-slate-200 font-black">{apt.patientName}</td>
                      <td className="p-2 border border-slate-200 font-mono">{toPersianDigits(apt.phone)}</td>
                      <td className="p-2 border border-slate-200">{apt.doctor}</td>
                      <td className="p-2 border border-slate-200">{apt.treatment}</td>
                      <td className="p-2 border border-slate-200 font-bold">{renderStatusLabel(apt.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Smart Cancellation/No-Show Waitlist Backfill Banner */}
      {freedSlotsForWaitlist.length > 0 && waitlist.length > 0 && viewMode !== 'waitlist' && viewMode !== 'schedule' && (
        <div className="mx-2 p-2.5 rounded-[18px] bg-gradient-to-l from-amber-50 via-white to-emerald-50 border border-amber-300 shadow-xs flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Hourglass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-900 block">
                {toPersianDigits(freedSlotsForWaitlist.length)} ساعت خالی از کنسلی/عدم حضور · {toPersianDigits(waitlist.length)} بیمار در لیست انتظار
              </span>
              <span className="text-[10px] font-bold text-slate-600 block truncate">
                ساعت {toPersianDigits(freedSlotsForWaitlist[0].time)} در {normalizeClinicUnitName(freedSlotsForWaitlist[0].unit)} آزاد شده است
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const slot = freedSlotsForWaitlist[0];
                const topWait = [...waitlist].sort((a, b) => (a.priority === 'urgent' ? -1 : b.priority === 'urgent' ? 1 : 0))[0];
                openAddModalSmart(slot.unit, slot.time, { dateStr: slot.date, waitlistEntry: topWait });
              }}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black cursor-pointer active:scale-95"
            >
              پر کردن با لیست انتظار ({waitlist[0].patientName})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('waitlist')}
              className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white border border-amber-300 text-amber-900 text-[10.5px] font-black cursor-pointer"
            >
              مشاهده صف
            </button>
          </div>
        </div>
      )}

      {/* 360° Jalali Day Command Hub (Collapsible Compact Bar) */}
      {viewMode !== 'waitlist' && viewMode !== 'schedule' && (
        <div className="mx-2 p-2.5 rounded-[20px] bg-gradient-to-l from-sky-50/90 via-white to-indigo-50/80 border border-sky-200/90 border-r-[3px] border-r-sky-500 shadow-[var(--shadow-card)] space-y-2">
          <div
            onClick={() => {
              triggerHaptic('selection');
              setShowCommandHubDrawer(!showCommandHubDrawer);
            }}
            className="flex items-center justify-between flex-wrap gap-1.5 cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div>
                <span className="text-[11px] font-black text-slate-900 block">
                  هاب ۳۶۰ درجه تقویم جلالی ({toPersianDigits(selectedDay)} {PERSIAN_MONTHS[selectedMonth]} {toPersianDigits(selectedYear)})
                </span>
                <span className="text-[9.5px] font-bold text-slate-500 block">
                  {toPersianDigits(filteredAppointments.length)} نوبت یونیت · دسترسی سریع به لابراتوار، ایمپلنت و چک
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openAddModalSmart()}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[9.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>ثبت نوبت</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setShowCommandHubDrawer(!showCommandHubDrawer);
                }}
                className="px-2 py-1 rounded-lg bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
              >
                <span>{showCommandHubDrawer ? 'بستن هاب' : 'ابزارهای تقویم'}</span>
                {showCommandHubDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {showCommandHubDrawer && (
            <div className="space-y-2.5 pt-2 border-t border-sky-200/60 animate-in fade-in duration-150">
              <div className="flex items-center gap-1 flex-wrap">
                {onOpenLabModal && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onOpenLabModal();
                    }}
                    className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[9.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>ثبت لابراتوار</span>
                  </button>
                )}
                {onOpenCheckModal && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onOpenCheckModal();
                    }}
                    className="px-2 py-1 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-[9.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>ثبت چک/قسط</span>
                  </button>
                )}
                {onOpenPalmerChart && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onOpenPalmerChart();
                    }}
                    className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[9.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>ثبت درمان پالمر</span>
                  </button>
                )}
              </div>

              {/* Interactive 4-Pillar Calendar Drilldown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setExpandedHubPillar(prev => prev === 'units' ? null : 'units');
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-95 ${
                    expandedHubPillar === 'units'
                      ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                      : 'bg-white border-sky-200/80 hover:border-sky-400 text-slate-700'
                  }`}
                >
                  <span className="font-bold">نوبت‌های یونیت:</span>
                  <span className={`font-mono font-black px-1.5 py-0.5 rounded ${
                    expandedHubPillar === 'units' ? 'bg-white/20 text-white' : 'text-sky-800 bg-sky-50'
                  }`}>
                    {toPersianDigits(filteredAppointments.length)} مورد
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setExpandedHubPillar(prev => prev === 'lab' ? null : 'lab');
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-95 ${
                    expandedHubPillar === 'lab'
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                      : 'bg-white border-purple-200/80 hover:border-purple-400 text-slate-700'
                  }`}
                >
                  <span className="font-bold">تحویل لابراتوار:</span>
                  <span className={`font-mono font-black px-1.5 py-0.5 rounded ${
                    expandedHubPillar === 'lab' ? 'bg-white/20 text-white' : 'text-purple-800 bg-purple-50'
                  }`}>
                    {toPersianDigits(patients.flatMap(p => p.labOrders || []).filter(l => l.status !== 'delivered_cemented').length)} فعال
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setExpandedHubPillar(prev => prev === 'implant' ? null : 'implant');
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-95 ${
                    expandedHubPillar === 'implant'
                      ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                      : 'bg-white border-cyan-200/80 hover:border-cyan-400 text-slate-700'
                  }`}
                >
                  <span className="font-bold">فراخوان ایمپلنت:</span>
                  <span className={`font-mono font-black px-1.5 py-0.5 rounded ${
                    expandedHubPillar === 'implant' ? 'bg-white/20 text-white' : 'text-cyan-800 bg-cyan-50'
                  }`}>
                    {toPersianDigits(patients.flatMap(p => p.implantCases || []).filter(i => i.currentStage !== 'crown_delivered').length)} کیس
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setExpandedHubPillar(prev => prev === 'financial' ? null : 'financial');
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-95 ${
                    expandedHubPillar === 'financial'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                      : 'bg-white border-amber-200/80 hover:border-amber-400 text-slate-700'
                  }`}
                >
                  <span className="font-bold">سررسید چک/قسط:</span>
                  <span className={`font-mono font-black px-1.5 py-0.5 rounded ${
                    expandedHubPillar === 'financial' ? 'bg-white/40 text-slate-950' : 'text-amber-800 bg-amber-50'
                  }`}>
                    {toPersianDigits(
                      patients.flatMap(p => p.sayadChecks || []).filter(c => c.status === 'in_collection').length +
                      patients.flatMap(p => p.installments || []).filter(i => i.status !== 'paid').length
                    )} مورد
                  </span>
                </button>
              </div>

              {/* Live Expanded Drilldown Preview */}
              {expandedHubPillar && (
                <div className="p-2.5 rounded-xl bg-white/95 border border-sky-200 space-y-2 animate-in fade-in duration-150">
                  {expandedHubPillar === 'lab' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-black text-purple-900">سفارشات رفت و برگشت لابراتوار در تقویم:</span>
                        {onNavigateToModule && (
                          <button
                            type="button"
                            onClick={() => onNavigateToModule('lab')}
                            className="text-[9.5px] font-black text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200 cursor-pointer"
                          >
                            ورود به ماژول لابراتوار ←
                          </button>
                        )}
                      </div>
                      {patients.flatMap(p => p.labOrders || []).filter(l => l.status !== 'delivered_cemented').slice(0, 3).map(ord => (
                        <div key={ord.id} className="flex items-center justify-between text-[10px] p-1.5 rounded-lg bg-purple-50/50 border border-purple-100">
                          <span className="font-bold text-slate-800">{ord.patientName} · {ord.workType} (دندان {toPersianDigits(ord.toothNumber)})</span>
                          <span className="font-mono text-purple-800 font-bold">تحویل: {toPersianDigits(ord.deliveryDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedHubPillar === 'implant' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-black text-cyan-900">مراحل جراحی، هیلینگ و قالب‌گیری ایمپلنت:</span>
                        {onNavigateToModule && (
                          <button
                            type="button"
                            onClick={() => onNavigateToModule('implant')}
                            className="text-[9.5px] font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded-lg border border-cyan-200 cursor-pointer"
                          >
                            ورود به ماژول ایمپلنت ←
                          </button>
                        )}
                      </div>
                      {patients.flatMap(p => p.implantCases || []).filter(i => i.currentStage !== 'crown_delivered').slice(0, 3).map(imp => (
                        <div key={imp.id} className="flex items-center justify-between text-[10px] p-1.5 rounded-lg bg-cyan-50/50 border border-cyan-100">
                          <span className="font-bold text-slate-800">{imp.patientName} · برند {imp.brand} (دندان {toPersianDigits(imp.toothNumber)})</span>
                          <span className="font-mono text-cyan-800 font-bold">فراخوان بعدی: {toPersianDigits(imp.healingDueDate || imp.surgeryDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedHubPillar === 'financial' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-black text-amber-900">سررسید چک‌های صیادی و اقساط در تقویم:</span>
                        {onNavigateToModule && (
                          <button
                            type="button"
                            onClick={() => onNavigateToModule('sayad_checks')}
                            className="text-[9.5px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 cursor-pointer"
                          >
                            ورود به چک و اقساط ←
                          </button>
                        )}
                      </div>
                      {patients.flatMap(p => p.sayadChecks || []).filter(c => c.status === 'in_collection').slice(0, 3).map(chk => (
                        <div key={chk.id} className="flex items-center justify-between text-[10px] p-1.5 rounded-lg bg-amber-50/50 border border-amber-100">
                          <span className="font-bold text-slate-800">{chk.patientName} · {chk.bankName} ({formatToman(chk.amount)})</span>
                          <span className="font-mono text-amber-800 font-bold">سررسید: {toPersianDigits(chk.dueDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedHubPillar === 'units' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-black text-sky-900">نوبت‌های فعال یونیت‌ها در تاریخ انتخاب‌شده:</span>
                        <button
                          type="button"
                          onClick={() => openAddModalSmart()}
                          className="text-[9.5px] font-black text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-200 cursor-pointer"
                        >
                          + افزودن نوبت جدید
                        </button>
                      </div>
                      {filteredAppointments.slice(0, 3).map(apt => (
                        <div key={apt.id} className="flex items-center justify-between text-[10px] p-1.5 rounded-lg bg-sky-50/50 border border-sky-100">
                          <span className="font-bold text-slate-800">{apt.patientName} · {apt.treatment} ({normalizeClinicUnitName(apt.unit)})</span>
                          <span className="font-mono text-sky-800 font-bold">ساعت {toPersianDigits(apt.time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Direct 1-Tap Cross-Module Navigation Strip from Iranian Calendar */}
              {onNavigateToModule && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-sky-200/60">
                  <span className="text-[9.5px] font-black text-slate-500 shrink-0">پرش سریع از تقویم:</span>
                  {[
                    { id: 'patients', label: 'پرونده بیماران', cls: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100' },
                    { id: 'palmer', label: 'چارت پالمر', cls: 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100' },
                    { id: 'lab', label: 'لابراتوار', cls: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100' },
                    { id: 'implant', label: 'ایمپلنت', cls: 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100' },
                    { id: 'sayad_checks', label: 'چک صیادی', cls: 'bg-pink-50 text-pink-800 border-pink-200 hover:bg-pink-100' },
                    { id: 'installments', label: 'اقساط', cls: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' },
                    { id: 'reminders', label: 'یادآوری هوشمند', cls: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100' },
                    { id: 'inventory', label: 'انبار', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onNavigateToModule(item.id);
                      }}
                      className={`px-2 py-0.5 rounded-lg border text-[9.5px] font-black whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95 ${item.cls}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE DRAG HOVER DROP-ZONES BANNER */}
      {draggedAptId && (
        <div className="mx-2 p-3 bg-gradient-to-r from-sky-50 via-blue-50 to-cyan-50 text-slate-900 rounded-2xl border-2 border-dashed border-sky-500 shadow-lg animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-sky-200/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" aria-hidden="true" />
              <span className="text-xs font-black text-sky-950">
                در حال جابجایی نوبت: {currentlyDraggedApt?.patientName} ({normalizeClinicUnitName(currentlyDraggedApt?.unit)})
              </span>
            </div>
            <span className="text-[10px] text-sky-700 font-bold">نوبت را روی یونیت مقصد رها کنید</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {clinicUnits.map(unit => {
              const isOver = dragOverZone === `quick-${unit.id}`;
              const isCurrent = normalizeClinicUnitName(currentlyDraggedApt?.unit) === unit.id;
              return (
                <div
                  key={unit.id}
                  onDragOver={(e) => handleDragOver(e, `quick-${unit.id}`)}
                  onDragLeave={(e) => handleDragLeave(e, `quick-${unit.id}`)}
                  onDrop={(e) => handleDropOnUnit(e, unit.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                    isOver
                      ? 'bg-sky-100 border-sky-500 scale-102 ring-2 ring-sky-300'
                      : isCurrent
                        ? 'bg-slate-100 border-slate-300 text-slate-400 opacity-60'
                        : 'bg-white border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  <span className="text-xs font-black text-slate-900">{unit.name}</span>
                  <span className="text-[9px] text-slate-500 truncate max-w-full">{unit.doctor.split('(')[0]}</span>
                  {isOver && (
                    <span className="text-[9px] text-sky-700 font-bold mt-1">رها کنید برای انتقال</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 0: COMPREHENSIVE IRANIAN TRI-CALENDAR & CROSS-MODULE AGENDA */}
      {viewMode === 'monthly' && (
        <IranianFullCalendarPanel
          appointments={appointments}
          patients={patients}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          scheduleSettings={scheduleSettings}
          onSelectDate={(yr, moIdx, dy) => {
            setSelectedYear(yr);
            setSelectedMonth(moIdx);
            setSelectedDay(dy);
          }}
          onJumpToday={jumpToToday}
          onPersistSchedule={persistSchedule}
          onSwitchToBoardForSelectedDay={() => {
            triggerHaptic('selection');
            setViewMode('board');
          }}
          onOpenAddAppointmentForDate={(dateStr, patientOverride) =>
            openAddModalSmart(undefined, undefined, { dateStr, patient: patientOverride })
          }
          onStartClinicalFlow={onStartClinicalFlow}
          onOpenPatientFile={onOpenPatientFile}
          onNavigateToModule={onNavigateToModule}
          onOpenLabModal={onOpenLabModal}
          onOpenCheckModal={onOpenCheckModal}
          onOpenPaymentModal={onOpenPaymentModal}
          onShowToast={showToast}
        />
      )}

      {/* D3.js Interactive Hourly Slot Capacity & Load Distribution (Board & Timeline) */}
      {(viewMode === 'board' || viewMode === 'timeline') && (
        <div
          data-testid="appointments-d3-load-panel"
          className="mx-2 p-2.5 rounded-[20px] bg-white border border-sky-200/80 shadow-[var(--shadow-card)] space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-[11px] font-black text-slate-900">
                بار ساعتی یونیت‌ها ({toPersianDigits(targetModalDate)} · کلیک روی ساعت برای رزرو فوری)
              </span>
            </div>
            <span className="text-[10px] font-mono font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 tabular-nums">
              ظرفیت {toPersianDigits(clinicUnits.length)} یونیت همزمان
            </span>
          </div>

          <svg
            data-testid="appointments-d3-load-svg"
            viewBox={`0 0 ${d3HourlyLoad.width} ${d3HourlyLoad.height}`}
            className="w-full h-[98px] overflow-visible select-none"
            role="img"
            aria-label="نمودار توزیع ساعتی نوبت‌ها در یونیت‌های کلینیک"
          >
            <line
              x1={d3HourlyLoad.margin.left}
              x2={d3HourlyLoad.width - d3HourlyLoad.margin.right}
              y1={d3HourlyLoad.baselineY}
              y2={d3HourlyLoad.baselineY}
              stroke="#cbd5e1"
              strokeWidth={1.2}
            />
            {d3HourlyLoad.bars.map(bar => (
              <g
                key={bar.hourEn}
                onClick={() => openAddModalSmart(undefined, `${bar.hourFa}:۰۰`)}
                className="cursor-pointer"
              >
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.barW}
                  height={bar.h}
                  rx={4}
                  fill={bar.fill}
                  opacity={bar.total > 0 ? 0.9 : 0.45}
                />
                {bar.total > 0 && (
                  <text
                    x={bar.x + bar.barW / 2}
                    y={Math.max(10, bar.y - 3)}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontWeight={900}
                    fill="#0f172a"
                  >
                    {toPersianDigits(bar.total)}
                  </text>
                )}
                <text
                  x={bar.x + bar.barW / 2}
                  y={d3HourlyLoad.height - 6}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={700}
                  fill="#475569"
                >
                  {bar.hourFa}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* MODE 1: KANBAN UNIT BOARD */}
      {viewMode === 'board' && (
        <div className="mx-2 space-y-2">
          <div className={`grid grid-cols-1 ${clinicUnits.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-2.5`}>
            {clinicUnits.map(unit => {
              const unitAppointments = filteredAppointments.filter(a => normalizeClinicUnitName(a.unit) === unit.id);
              const shiftableQueueCount = unitAppointments.filter(
                a => a.status === 'scheduled' || a.status === 'waiting'
              ).length;
              const unitCap = calculateUnitCapacityStats(unit.id, targetModalDate, appointments, scheduleSettings);
              const unitNextFree = findNextAvailableSlot(targetModalDate, unit.id, getDefaultDoctorForUnit(unit.id), 45);
              const isDropActive = dragOverZone === `column-${unit.id}`;

              return (
                <div
                  key={unit.id}
                  onDragOver={(e) => handleDragOver(e, `column-${unit.id}`)}
                  onDragLeave={(e) => handleDragLeave(e, `column-${unit.id}`)}
                  onDrop={(e) => handleDropOnUnit(e, unit.id)}
                  className={`bg-slate-50/90 rounded-[22px] border transition-all p-2.5 space-y-2 flex flex-col min-h-[380px] ${
                    isDropActive
                      ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-300 shadow-md'
                      : 'border-slate-200/90 shadow-2xs'
                  }`}
                >
                  {/* Column Header + Live Capacity Utilization */}
                  <div className="pb-2 border-b border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: unit.accent }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate">{unit.name}</h4>
                          <span className="text-[9.5px] text-slate-500 truncate block max-w-[140px]">
                            {unit.doctor}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onBatchShiftAppointments && shiftableQueueCount > 0 && (
                          <ArmedActionButton
                            label="تاخیر +۱۵د"
                            confirmLabel="شیفت صف؟ ✓"
                            onConfirm={() => handleCascadeShiftUnit(unit.id, 15)}
                            className="min-h-[28px] px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[9.5px] font-black cursor-pointer"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => openAddModalSmart(unit.id, unitNextFree)}
                          className="min-h-[28px] px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9.5px] font-black cursor-pointer"
                          title={`رزرو سریع در اولین ساعت خالی ${unit.name}`}
                        >
                          + {toPersianDigits(unitNextFree)}
                        </button>
                        <span className="font-mono font-black text-[10.5px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 tabular-nums">
                          {toPersianDigits(unitAppointments.length)} نوبت
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${unitCap.utilizationPercent}%`, backgroundColor: unit.accent }}
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-slate-500 tabular-nums">
                        اشغال {toPersianDigits(unitCap.utilizationPercent)}٪
                      </span>
                    </div>
                  </div>

                  {/* Empty Drop Target */}
                  {unitAppointments.length === 0 && (
                    <div
                      className={`flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl text-center space-y-1.5 transition-all ${
                        isDropActive
                          ? 'border-sky-500 bg-sky-100/60 text-sky-800'
                          : 'border-slate-300/80 text-slate-400'
                      }`}
                    >
                      <ArrowRightLeft className="w-5 h-5 opacity-40 mx-auto" />
                      <span className="text-xs font-bold">بدون نوبت در این روز</span>
                      <span className="text-[10px] opacity-75">
                        کارت نوبت را بکشید و اینجا رها کنید
                      </span>
                    </div>
                  )}

                  {/* Appointments in this Unit */}
                  <div className="space-y-2 flex-1">
                    {unitAppointments.map((apt, idx) => {
                      const isBeingDragged = draggedAptId === apt.id;
                      const unitRightBorder = UNIT_BORDER_CLASS_MAP[unit.id] || 'border-r-sky-500';
                      const matchedPat = resolvePatientForApt(apt);
                      const readyLab = matchedPat?.labOrders?.find(l => l.status === 'ready_for_clinic');
                      const hasMedAlert = Boolean(matchedPat?.medicalHistory && matchedPat.medicalHistory.length > 0);
                      const hasDebt = Boolean(matchedPat && matchedPat.balance < 0);
                      const unpaidInstallmentsCount = (matchedPat?.installments || []).filter(i => i.status !== 'paid').length;
                      const activeGuaranteeCheck = (matchedPat?.sayadChecks || []).find(
                        c => c.isGuarantee && c.status !== 'cleared' && c.status !== 'returned'
                      );
                      const guaranteeReadyForReturn = Boolean(
                        activeGuaranteeCheck && unpaidInstallmentsCount === 0 && (matchedPat?.balance ?? 0) >= 0
                      );
                      const reminderLabel = apt.reminderConfig?.enabled ? getPresetLabelFa(apt.reminderConfig.preset) : null;
                      const noShowCount = getNoShowCountForApt(apt);
                      const chairElapsed = apt.status === 'in_chair' ? formatElapsedChairMinutes(apt.chairStartedAt, nowTick) : null;
                      const waitingElapsed = apt.status === 'waiting' && apt.waitingStartedAt ? formatElapsedChairMinutes(apt.waitingStartedAt, nowTick) : null;
                      const telHref = `tel:${toEnglishDigits(apt.phone || '').replace(/\D/g, '')}`;
                      const smsHref = formatNativeSmsHref(apt);
                      const waUrl = formatWhatsAppReminderUrl(apt);

                      return (
                        <div
                          key={apt.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, apt)}
                          onDragEnd={handleDragEnd}
                          className={`bg-white rounded-[22px] p-3 border border-r-[4px] ${unitRightBorder} transition-all cursor-grab active:cursor-grabbing select-none group shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:border-sky-300 space-y-2.5 ${
                            isBeingDragged
                              ? 'opacity-40 border-dashed border-sky-400 scale-98'
                              : 'border-slate-200/90'
                          } ${getCardFeedbackClasses(apt.id)}`}
                        >
                          {/* Tier 1: Trendy Header Capsule (Time Pill + Identity + Live Status) */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="text-slate-300 group-hover:text-sky-500 transition-colors cursor-grab shrink-0">
                                <GripVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-50 via-sky-100 to-indigo-100/80 text-sky-950 flex flex-col items-center justify-center font-mono font-black text-xs tabular-nums border border-sky-200/90 shrink-0 shadow-2xs">
                                <span className="leading-none">{toPersianDigits(apt.time)}</span>
                                <span className="text-[8.5px] text-sky-700 leading-none mt-1">#{toPersianDigits(idx + 1)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="text-[13px] font-black text-slate-950 group-hover:text-sky-700 transition-colors truncate">
                                    {apt.patientName}
                                  </h5>
                                  <TrackableIdBadge recordId={apt.id} moduleKey="appointments" />
                                </div>
                                <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 flex-wrap mt-0.5 tabular-nums">
                                  <span className="font-mono text-slate-700 font-bold">{toPersianDigits(apt.phone)}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{toPersianDigits(apt.durationMinutes || 45)}د</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate max-w-[105px]">{apt.doctor}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-[9.5px] px-2.5 py-0.5 rounded-full font-black whitespace-nowrap ${renderStatusChipClass(apt.status)}`}>
                                {renderStatusLabel(apt.status)}
                              </span>
                              {waitingElapsed !== null && waitingElapsed >= 20 && (
                                <span className="text-[9px] font-mono font-black text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full tabular-nums">
                                  انتظار {toPersianDigits(waitingElapsed)}د · SLA
                                </span>
                              )}
                              {chairElapsed !== null && (
                                <span className="text-[9px] font-mono font-black text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 tabular-nums">
                                  <Timer className="w-2.5 h-2.5" />
                                  <span>{toPersianDigits(chairElapsed)}د روی یونیت</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tier 2: Clinical Treatment Bento Box */}
                          <div className="p-2.5 rounded-2xl bg-slate-50/90 text-[11px] text-slate-700 space-y-1 border border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span className="font-bold text-slate-900 truncate">{apt.treatment}</span>
                            </div>

                            {(hasMedAlert || readyLab || hasDebt || unpaidInstallmentsCount > 0 || guaranteeReadyForReturn || reminderLabel || noShowCount > 0 || apt.cancellationReason) && (
                              <div className="text-[10px] text-slate-600 flex items-center gap-1.5 flex-wrap leading-relaxed">
                                {hasMedAlert && (
                                  <span className="text-rose-700 font-bold">
                                    هشدار پزشکی: {matchedPat!.medicalHistory.join('، ')}
                                  </span>
                                )}
                                {noShowCount > 0 && (
                                  <span className="text-rose-800 font-bold tabular-nums">
                                    {hasMedAlert ? '· ' : ''}عدم حضور: {toPersianDigits(noShowCount)} بار
                                  </span>
                                )}
                                {readyLab && (
                                  <span className="text-purple-700 font-bold">
                                    {(hasMedAlert || noShowCount > 0) ? '· ' : ''}پروتز آماده مطب ({readyLab.toothNumber})
                                  </span>
                                )}
                                {hasDebt && (
                                  <span className="text-amber-700 font-bold tabular-nums">
                                    {(hasMedAlert || noShowCount > 0 || readyLab) ? '· ' : ''}مانده: {formatToman(Math.abs(matchedPat!.balance))}
                                  </span>
                                )}
                                {unpaidInstallmentsCount > 0 && (
                                  <span className="text-indigo-700 font-bold tabular-nums">
                                    {(hasMedAlert || noShowCount > 0 || readyLab || hasDebt) ? '· ' : ''}اقساط باز: {toPersianDigits(unpaidInstallmentsCount)}
                                  </span>
                                )}
                                {guaranteeReadyForReturn && (
                                  <span className="text-emerald-700 font-black">
                                    {(hasMedAlert || noShowCount > 0 || readyLab || hasDebt || unpaidInstallmentsCount > 0) ? '· ' : ''}چک ضمانت آماده عودت ✓
                                  </span>
                                )}
                                {reminderLabel && (
                                  <span className="text-sky-700 font-semibold">
                                    {(hasMedAlert || noShowCount > 0 || readyLab || hasDebt || unpaidInstallmentsCount > 0 || guaranteeReadyForReturn) ? '· ' : ''}یادآور: {reminderLabel}
                                  </span>
                                )}
                                {apt.cancellationReason && (
                                  <span className="text-rose-700 font-semibold">
                                    · علت: {apt.cancellationReason}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Live Visual Mutation Badge */}
                          <CardMutationBadge recordId={apt.id} />

                          {/* Tier 3: Trendy Floating Direct-Connect Dock (Call + SMS + Auto-SMS Service + WhatsApp + Clinical) */}
                          <div className="p-1.5 rounded-2xl bg-gradient-to-l from-emerald-50/70 via-sky-50/70 to-indigo-50/70 border border-sky-200/70 flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center gap-1 flex-wrap">
                              <a
                                href={telHref}
                                onClick={(e) => e.stopPropagation()}
                                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                                title={`تماس تلفنی مستقیم با ${apt.patientName}`}
                              >
                                <Phone className="w-3 h-3" />
                                <span>تماس</span>
                              </a>

                              <a
                                href={smsHref}
                                onClick={(e) => e.stopPropagation()}
                                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black flex items-center gap-1 transition-transform active:scale-95"
                                title="ارسال مستقیم پیامک از سیم‌کارت گوشی"
                              >
                                <MessageSquare className="w-3 h-3 text-sky-600" />
                                <span>پیام</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => void quickDispatchServiceSms(apt)}
                                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs cursor-pointer transition-transform active:scale-95"
                                title="ارسال فوری از طریق سرویس پیامکی مطب"
                              >
                                <Send className="w-3 h-3 -scale-x-100" />
                                <span>سرویس پیامک</span>
                              </button>

                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="min-w-[34px] min-h-[34px] px-2 py-1 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                                  title="ارسال پیام در واتساپ"
                                  aria-label="واتساپ"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => void quickTriggerPhoneReminder(apt)}
                                className="min-w-[34px] min-h-[34px] px-2 py-1 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center justify-center cursor-pointer active:scale-95"
                                title="ارسال اعلان نوتیفیکیشن گوشی"
                                aria-label="اعلان گوشی"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              {onStartClinicalFlow && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('medium');
                                    onStartClinicalFlow(apt);
                                  }}
                                  className="min-h-[34px] py-1 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                  title="ورود به پرونده / چارت پالمر"
                                >
                                  <ClipboardList className="w-3 h-3" />
                                  <span>درمان</span>
                                </button>
                              )}

                              {onOpenPaymentForPatient && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('medium');
                                    onOpenPaymentForPatient(apt);
                                  }}
                                  className="min-h-[34px] py-1 px-2.5 rounded-xl bg-white hover:bg-amber-50 text-amber-800 text-[10px] font-black flex items-center gap-1 border border-amber-200 transition-all cursor-pointer active:scale-95"
                                  title="ثبت دریافتی یا مشاهده بدهی بیمار"
                                >
                                  <Wallet className="w-3 h-3" />
                                  <span>پرداخت</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Tier 4: Clean Workflow Footer (Stage Progression + Schedule Controls) */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openQuickMoveModal(apt)}
                                className="min-h-[32px] py-1 px-2 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-800 text-[10px] font-bold flex items-center gap-1 border border-slate-200 transition-colors cursor-pointer active:scale-95"
                                title="تغییر سریع تاریخ، یونیت یا ساعت"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>جابجایی</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditAptModal(apt)}
                                className="min-h-[32px] py-1 px-2 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-[10px] font-bold flex items-center gap-1 border border-slate-200 transition-colors cursor-pointer active:scale-95"
                                title="ویرایش کامل نوبت (تاریخ، ساعت، پزشک، درمان)"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>ویرایش</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1 flex-wrap">
                              {apt.status === 'scheduled' && (
                                <ArmedActionButton
                                  label="حضور"
                                  confirmLabel="در سالن ✓"
                                  onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'waiting')}
                                  className="min-h-[32px] py-1 px-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-black text-[10px]"
                                />
                              )}
                              {isAppointmentActive(apt.status) && apt.status !== 'in_chair' && (
                                <ArmedActionButton
                                  label="فراخوان"
                                  confirmLabel="تایید فراخوان ✓"
                                  onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'in_chair')}
                                  className="min-h-[32px] py-1 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px]"
                                />
                              )}
                              {apt.status === 'in_chair' && (
                                <ArmedActionButton
                                  label="اتمام"
                                  confirmLabel="تایید اتمام ✓"
                                  icon={<Check className="w-3 h-3 stroke-[3]" />}
                                  onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'completed')}
                                  className="min-h-[32px] py-1 px-2.5 rounded-xl bg-emerald-600 text-white font-black text-[10px] flex items-center gap-0.5"
                                />
                              )}
                              {isAppointmentActive(apt.status) && apt.status !== 'in_chair' && (
                                <ArmedActionButton
                                  label="عدم حضور"
                                  confirmLabel="ثبت عدم حضور؟"
                                  onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'no_show', 'بیمار مراجعه نکرد')}
                                  className="min-h-[32px] py-1 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px]"
                                />
                              )}
                              {apt.status === 'completed' && (
                                <div className="flex items-center gap-1">
                                  {[
                                    { label: '+۱هفته', date: addDaysToPersianDate(apt.date, 7) },
                                    { label: '+۱ماه', date: addMonthsToPersianDate(apt.date, 1) }
                                  ].map(f => (
                                    <button
                                      key={f.label}
                                      type="button"
                                      onClick={() =>
                                        openAddModalSmart(apt.unit, undefined, {
                                          dateStr: f.date,
                                          patient: matchedPat
                                        })
                                      }
                                      className="min-h-[30px] px-2 py-0.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9.5px] font-black cursor-pointer"
                                    >
                                      پیگیری {f.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Time Slot Chips */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="text-[9.5px] font-bold text-slate-500 block mb-1">
                      ساعت‌های پیشنهادی رزرو سریع {unit.name}:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {getSmartQuickSlotsForUnit(unit.id, unitAppointments).map(slot => {
                        const occupyingApt = unitAppointments.find(
                          a => isAppointmentActive(a.status) && appointmentsOverlap(a.time, a.durationMinutes || 45, slot, 45)
                        );
                        const isSlotOccupied = Boolean(occupyingApt);
                        const isSlotPast = isPastPersianDateTime(targetModalDate, slot);
                        const isSlotTarget = dragOverZone === `slot-${unit.id}-${slot}`;

                        return (
                          <button
                            key={slot}
                            type="button"
                            onDragOver={(e) => handleDragOver(e, `slot-${unit.id}-${slot}`)}
                            onDragLeave={(e) => handleDragLeave(e, `slot-${unit.id}-${slot}`)}
                            onDrop={(e) => handleDropOnUnit(e, unit.id, slot)}
                            onClick={() => {
                              if (isSlotPast && !occupyingApt) {
                                actionFeedback.recordError({
                                  title: 'ساعت گذشته است',
                                  subtitle: `نوبت جدید برای ساعت گذشته (${toPersianDigits(slot)}) ثبت نمی‌شود.`
                                });
                                return;
                              }
                              if (occupyingApt) {
                                actionFeedback.recordConflict({
                                  title: `ساعت ${toPersianDigits(slot)} در ${unit.name} پر است`,
                                  subtitle: `بیمار «${occupyingApt.patientName}» (${occupyingApt.treatment}) در این ساعت نوبت دارد.`,
                                  targetRecordId: occupyingApt.id,
                                  badgeText: `⚠️ رزرو شده برای ${occupyingApt.patientName}`
                                });
                              } else {
                                openAddModalSmart(unit.id, slot);
                              }
                            }}
                            className={`min-h-[34px] py-1 px-1 text-center rounded-lg text-[9.5px] font-mono font-bold tabular-nums transition-all border cursor-pointer active:scale-95 ${
                              isSlotTarget
                                ? 'bg-sky-500 text-white border-sky-600 shadow-xs ring-1 ring-sky-400'
                                : isSlotOccupied
                                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                  : isSlotPast
                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                    : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs'
                            }`}
                            title={isSlotOccupied ? `پر شده توسط ${occupyingApt?.patientName} (کلیک برای مشاهده)` : isSlotPast ? 'زمان گذشته' : `کلیک برای ثبت نوبت در ${unit.name} ساعت ${slot}`}
                          >
                            {toPersianDigits(slot)} {isSlotOccupied ? 'پُر' : isSlotPast ? '—' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 1B: HOURLY MULTI-UNIT TIMELINE GRID (جدول ساعتی یونیت‌ها) */}
      {viewMode === 'timeline' && (
        <div className="mx-2 space-y-2">
          <div className="bg-white rounded-[22px] border border-sky-200 shadow-xs overflow-hidden">
            <div className="px-3.5 py-2.5 bg-sky-50/80 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  ماتریس ساعتی یونیت‌ها — {selectedDayWeekdayName} {toPersianDigits(selectedDay)} {PERSIAN_MONTHS[selectedMonth]}
                </h4>
                <span className="text-[10px] font-bold text-slate-500">
                  روی هر خانه آزاد کلیک کنید تا همان ساعت و یونیت بلافاصله برای رزرو باز شود
                </span>
              </div>
              {selectedDayHolidayInfo.isHoliday && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                  تعطیل: {selectedDayHolidayInfo.reason}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2.5 px-3 text-[11px] font-black text-slate-700 w-20 border-l border-slate-200">
                      ساعت
                    </th>
                    {clinicUnits.map(unit => {
                      const cap = calculateUnitCapacityStats(unit.id, targetModalDate, appointments, scheduleSettings);
                      return (
                        <th key={unit.id} className="py-2.5 px-3 border-l border-slate-200 last:border-l-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: unit.accent }}
                              />
                              <span className="text-xs font-black text-slate-900 truncate">{unit.name}</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums shrink-0">
                              {toPersianDigits(cap.utilizationPercent)}٪ اشغال
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {STANDARD_TIME_SLOTS.map(slot => {
                    const slotMin = parseTimeMinutes(slot);
                    const lunchStart = parseTimeMinutes(scheduleSettings.breakStart);
                    const lunchEnd = parseTimeMinutes(scheduleSettings.breakEnd);
                    const isLunchRow =
                      scheduleSettings.breakEnabled &&
                      slotMin >= lunchStart &&
                      slotMin < lunchEnd;
                    const isPastSlot = isPastPersianDateTime(targetModalDate, slot);
                    const nowDateObj = new Date(nowTick);
                    const nowMinutes = nowDateObj.getHours() * 60 + nowDateObj.getMinutes();
                    const isCurrentTimeRow =
                      isSamePersianDate(targetModalDate, todayStr) &&
                      nowMinutes >= slotMin &&
                      nowMinutes < slotMin + 30;

                    return (
                      <tr
                        key={slot}
                        className={
                          isCurrentTimeRow
                            ? 'bg-rose-50/60 ring-1 ring-inset ring-rose-300'
                            : isLunchRow
                              ? 'bg-amber-50/40'
                              : 'hover:bg-slate-50/50'
                        }
                      >
                        <td
                          className={`py-2 px-3 font-mono font-black text-xs tabular-nums border-l border-slate-200 align-middle ${
                            isCurrentTimeRow ? 'text-rose-700 bg-rose-100/70' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{toPersianDigits(slot)}</span>
                            {isCurrentTimeRow && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-sans font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                اکنون
                              </span>
                            )}
                          </div>
                        </td>
                        {clinicUnits.map(unit => {
                          const unitDayApts = filteredAppointments.filter(
                            a => normalizeClinicUnitName(a.unit) === unit.id && isAppointmentActive(a.status)
                          );
                          const startingApt = unitDayApts.find(a => {
                            const startMin = parseTimeMinutes(a.time);
                            return startMin >= slotMin && startMin < slotMin + 30;
                          });
                          const continuingApt = !startingApt
                            ? unitDayApts.find(a => appointmentsOverlap(a.time, a.durationMinutes || 45, slot, 30))
                            : undefined;
                          const tlDropKey = `tl-${unit.id}-${slot}`;
                          const isTlDropTarget = dragOverZone === tlDropKey;

                          return (
                            <td key={`${slot}-${unit.id}`} className="p-1.5 border-l border-slate-100 last:border-l-0 align-top">
                              {startingApt ? (
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, startingApt)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => openEditAptModal(startingApt)}
                                  className="w-full min-h-[44px] p-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-right flex items-center justify-between gap-2 transition-colors cursor-grab active:cursor-grabbing"
                                  title="برای ویرایش کلیک کنید یا به ساعت/یونیت دیگر بکشید"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[11px] font-black text-slate-900 block truncate">
                                        {startingApt.patientName}
                                      </span>
                                      <span className="text-[9.5px] font-bold text-slate-600 block truncate">
                                        {startingApt.treatment} · {toPersianDigits(startingApt.durationMinutes || 45)}د
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black shrink-0 ${renderStatusChipClass(startingApt.status)}`}>
                                    {renderStatusLabel(startingApt.status)}
                                  </span>
                                </button>
                              ) : continuingApt ? (
                                <div className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-100/80 border border-dashed border-slate-300 text-[10px] font-bold text-slate-500 flex items-center">
                                  ادامه درمان «{continuingApt.patientName}»
                                </div>
                              ) : isLunchRow ? (
                                <div className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200/70 text-[10px] font-bold text-amber-800 flex items-center justify-center">
                                  استراحت بین‌روز
                                </div>
                              ) : isPastSlot ? (
                                <div className="w-full min-h-[40px] flex items-center justify-center text-[10px] text-slate-300 font-mono">
                                  —
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onDragOver={(e) => handleDragOver(e, tlDropKey)}
                                  onDragLeave={(e) => handleDragLeave(e, tlDropKey)}
                                  onDrop={(e) => handleDropOnUnit(e, unit.id, slot)}
                                  onClick={() => openAddModalSmart(unit.id, slot)}
                                  className={`w-full min-h-[44px] px-2.5 py-1.5 rounded-xl border border-dashed text-[10.5px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-98 ${
                                    isTlDropTarget
                                      ? 'bg-sky-500 text-white border-sky-600 ring-2 ring-sky-300'
                                      : 'bg-emerald-50/50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                                  }`}
                                  aria-label={`رزرو ${unit.name} ساعت ${slot}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isTlDropTarget ? `رها کنید (${toPersianDigits(slot)})` : `آزاد · رزرو ${toPersianDigits(slot)}`}</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: DAILY LIST VIEW */}
      {viewMode === 'daily' && (
        <div className="mx-2 space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-black text-slate-800">
              نوبت‌های {toPersianDigits(selectedDay)} {PERSIAN_MONTHS[selectedMonth]} ({toPersianDigits(filteredAppointments.length)} نوبت)
            </span>
            {filteredAppointments.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  const anyOpen = filteredAppointments.some(a => expandedAptIds[a.id]);
                  if (anyOpen) {
                    setExpandedAptIds({});
                  } else {
                    const next: Record<string, boolean> = {};
                    filteredAppointments.forEach(a => { next[a.id] = true; });
                    setExpandedAptIds(next);
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black cursor-pointer"
              >
                {filteredAppointments.some(a => expandedAptIds[a.id]) ? 'جمع کردن همه' : 'باز کردن همه'}
              </button>
            )}
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs space-y-2">
              <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
              <p>هیچ نوبتی برای این فیلتر در این روز ثبت نشده است.</p>
              <button
                type="button"
                onClick={() => openAddModalSmart()}
                className="min-h-[40px] py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1 mt-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>ثبت اولین نوبت</span>
              </button>
            </div>
          ) : (
            filteredAppointments.map((apt, idx) => {
              const isExpanded = !!expandedAptIds[apt.id];
              const matchedPat = resolvePatientForApt(apt);
              const readyLab = matchedPat?.labOrders?.find(l => l.status === 'ready_for_clinic');
              const reminderLabel = apt.reminderConfig?.enabled ? getPresetLabelFa(apt.reminderConfig.preset) : null;
              const normUnit = normalizeClinicUnitName(apt.unit);
              const unitRightBorder = UNIT_BORDER_CLASS_MAP[normUnit] || 'border-r-sky-500';
              const chairElapsed = apt.status === 'in_chair' ? formatElapsedChairMinutes(apt.chairStartedAt, nowTick) : null;
              const waUrl = formatWhatsAppReminderUrl(apt);
              const smsHref = formatNativeSmsHref(apt);

              return (
                <div
                  key={apt.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, apt)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white rounded-[22px] px-3.5 py-3 shadow-[var(--shadow-card)] border border-slate-200/90 border-r-[4px] ${unitRightBorder} space-y-2 hover:shadow-[var(--shadow-elevated)] transition-all cursor-grab active:cursor-grabbing ${getCardFeedbackClasses(apt.id)}`}
                >
                  <div
                    onClick={() => toggleAptExpand(apt.id)}
                    className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="text-slate-300 hover:text-sky-600 transition-colors shrink-0">
                        <GripVertical className="w-4 h-4 stroke-[2.5]" />
                      </div>

                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-100/80 text-sky-950 flex items-center justify-center font-mono font-black text-xs tabular-nums border border-sky-200 shadow-2xs">
                          <span className="leading-none">{toPersianDigits(apt.time)}</span>
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-700 text-white text-[9.5px] font-mono font-black flex items-center justify-center border border-white">
                          #{toPersianDigits(idx + 1)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 text-right">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-[13px] font-black text-slate-950 truncate">{apt.patientName}</h4>
                          <span className="text-[10px] font-bold text-sky-800">
                            {normUnit} · {apt.doctor}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-500 font-bold mt-0.5 block truncate tabular-nums">
                          {apt.treatment} · <span className="font-mono">{toPersianDigits(apt.phone)}</span> · {toPersianDigits(apt.durationMinutes || 45)} دقیقه
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:${toEnglishDigits(apt.phone || '').replace(/\D/g, '')}`}
                        className="min-w-[34px] min-h-[34px] px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center gap-1 shadow-2xs transition-transform active:scale-95"
                        title={`تماس مستقیم با ${apt.patientName}`}
                        aria-label={`تماس با ${apt.patientName}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">تماس</span>
                      </a>
                      <a
                        href={smsHref}
                        className="min-w-[34px] min-h-[34px] px-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-black flex items-center justify-center gap-1 transition-transform active:scale-95"
                        title="پیامک مستقیم گوشی"
                        aria-label={`پیام به ${apt.patientName}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">پیام</span>
                      </a>
                      {chairElapsed !== null && (
                        <span className="text-[9.5px] font-mono font-black text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-lg tabular-nums hidden md:inline">
                          {toPersianDigits(chairElapsed)}د
                        </span>
                      )}
                      <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-black ${renderStatusChipClass(apt.status)}`}>
                        {renderStatusLabel(apt.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAptExpand(apt.id)}
                        className={`min-h-[34px] px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border transition-colors cursor-pointer ${
                          isExpanded ? 'bg-sky-600 text-white border-sky-700' : 'bg-sky-50 text-sky-800 border-sky-200'
                        }`}
                      >
                        <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <CardMutationBadge recordId={apt.id} />

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                      <div className="p-2.5 rounded-2xl bg-slate-50 text-xs text-slate-700 space-y-1 border border-slate-100">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 truncate">
                            <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-bold truncate">{apt.treatment}</span>
                          </div>
                          <span className="text-slate-500 text-[11px] font-medium shrink-0">
                            {normUnit} · {apt.doctor}
                          </span>
                        </div>
                        {(matchedPat?.medicalHistory?.length || readyLab || reminderLabel || apt.reminderConfig?.note || apt.cancellationReason) && (
                          <div className="text-[10.5px] text-slate-600 flex flex-wrap items-center gap-2 pt-0.5">
                            {matchedPat?.medicalHistory && matchedPat.medicalHistory.length > 0 && (
                              <span className="text-rose-700 font-bold">
                                سابقه پزشکی: {matchedPat.medicalHistory.join('، ')}
                              </span>
                            )}
                            {readyLab && (
                              <span className="text-purple-700 font-bold">
                                پروتز لابراتوار آماده تحویل ({readyLab.toothNumber})
                              </span>
                            )}
                            {reminderLabel && (
                              <span className="text-sky-700 font-bold">
                                یادآوری: {reminderLabel} ({toPersianDigits(apt.date)} ساعت {toPersianDigits(apt.time)})
                              </span>
                            )}
                            {apt.reminderConfig?.note && (
                              <span className="text-slate-500">یادداشت: {apt.reminderConfig.note}</span>
                            )}
                            {apt.cancellationReason && (
                              <span className="text-rose-700 font-bold">علت: {apt.cancellationReason}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={`tel:${toEnglishDigits(apt.phone || '').replace(/\D/g, '')}`}
                            className="min-h-[36px] py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1"
                            title="تماس تلفنی با بیمار"
                          >
                            <Phone className="w-3 h-3" />
                            <span>تماس</span>
                          </a>

                          <a
                            href={smsHref}
                            className="min-h-[36px] py-1 px-2.5 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-[10.5px] font-black flex items-center gap-1"
                            title="پیامک مستقیم گوشی"
                          >
                            <MessageSquare className="w-3 h-3 text-sky-600" />
                            <span>پیام</span>
                          </a>

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[36px] py-1 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold flex items-center gap-1"
                              title="ارسال پیام در واتساپ"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>واتساپ</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => void quickDispatchServiceSms(apt)}
                            className="min-h-[36px] py-1 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Send className="w-3 h-3 -scale-x-100" />
                            <span>سرویس پیامک</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void quickTriggerPhoneReminder(apt)}
                            className="min-h-[36px] py-1 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Smartphone className="w-3 h-3" />
                            <span>اعلان گوشی</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openQuickMoveModal(apt)}
                            className="min-h-[36px] py-1 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10.5px] font-bold flex items-center gap-1 border border-sky-200/80 cursor-pointer active:scale-95"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>جابجایی</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditAptModal(apt)}
                            className="min-h-[36px] py-1 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10.5px] font-bold flex items-center gap-1 border border-amber-200/80 cursor-pointer active:scale-95"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ویرایش</span>
                          </button>

                          {onStartClinicalFlow && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('medium');
                                onStartClinicalFlow(apt);
                              }}
                              className="min-h-[36px] py-1 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <ClipboardList className="w-3 h-3" />
                              <span>درمان</span>
                            </button>
                          )}

                          {onOpenPaymentForPatient && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                onOpenPaymentForPatient(apt);
                              }}
                              className="min-h-[36px] py-1 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10.5px] font-bold flex items-center gap-1 border border-amber-200/80 cursor-pointer active:scale-95"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>صندوق</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {apt.status === 'scheduled' && (
                            <ArmedActionButton
                              label="حضور در سالن"
                              confirmLabel="تایید حضور؟ ✓"
                              onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'waiting')}
                              className="min-h-[36px] py-1 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10.5px]"
                            />
                          )}

                          {isAppointmentActive(apt.status) && apt.status !== 'in_chair' && (
                            <ArmedActionButton
                              label="فراخوان به یونیت"
                              confirmLabel="تایید فراخوان؟ ✓"
                              onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'in_chair')}
                              className="min-h-[36px] py-1 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10.5px] shadow-2xs"
                            />
                          )}

                          {apt.status === 'in_chair' && (
                            <ArmedActionButton
                              label="پایان درمان"
                              confirmLabel="تایید پایان درمان؟ ✓"
                              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'completed')}
                              className="min-h-[36px] py-1 px-3 rounded-xl bg-emerald-600 text-white font-bold text-[10.5px] flex items-center gap-1"
                            />
                          )}

                          {isAppointmentActive(apt.status) && apt.status !== 'in_chair' && (
                            <>
                              <ArmedActionButton
                                label="عدم حضور"
                                confirmLabel="ثبت عدم حضور؟"
                                onConfirm={() => void handleStatusChangeWithAutoSms(apt, 'no_show', 'عدم حضور در مطب')}
                                className="min-h-[36px] py-1 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10.5px]"
                              />
                              <ArmedActionButton
                                label="لغو نوبت"
                                confirmLabel="تایید لغو؟"
                                icon={<XCircle className="w-3 h-3" />}
                                onConfirm={() => onUpdateStatus(apt.id, 'cancelled', 'لغو با هماهنگی بیمار')}
                                className="min-h-[36px] py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10.5px] flex items-center gap-1"
                              />
                            </>
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

      {/* MODE 4: WAITLIST TAB (لیست انتظار کنسلی و اورژانسی) */}
      {viewMode === 'waitlist' && (
        <div className="mx-2 space-y-3">
          <div className="bg-white rounded-[22px] p-4 border border-amber-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Hourglass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">لیست انتظار هوشمند کنسلی و درد حاد</h4>
                  <span className="text-[10px] text-slate-500 font-bold">
                    بیمارانی که مایل به دریافت نوبت زودتر در صورت کنسلی سایر مراجعین هستند
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                {toPersianDigits(waitlist.length)} نفر در صف
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                placeholder="نام و نام خانوادگی بیمار *"
                aria-label="نام بیمار لیست انتظار"
                value={wlName}
                onChange={(e) => setWlName(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="شماره همراه (مثلاً ۰۹۱۲...)"
                aria-label="تلفن بیمار لیست انتظار"
                value={wlPhone}
                onChange={(e) => setWlPhone(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-amber-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="شرح نیاز درمانی (مثلاً درد شدید / روکش)"
                aria-label="شرح درمان لیست انتظار"
                value={wlTreatment}
                onChange={(e) => setWlTreatment(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <select
                aria-label="یونیت ترجیحی لیست انتظار"
                value={wlUnit}
                onChange={(e) => setWlUnit(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800"
              >
                {clinicUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select
                aria-label="شیفت ترجیحی"
                value={wlShift}
                onChange={(e) => setWlShift(e.target.value as WaitlistEntry['preferredShift'])}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800"
              >
                <option value="any">هر ساعت آزاد</option>
                <option value="morning">شیفت صبح</option>
                <option value="afternoon">شیفت عصر</option>
                <option value="evening">شیفت شب</option>
              </select>
              <select
                aria-label="اولویت لیست انتظار"
                value={wlPriority}
                onChange={(e) => setWlPriority(e.target.value as WaitlistEntry['priority'])}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800"
              >
                <option value="normal">اولویت عادی</option>
                <option value="urgent">فوری (اورژانسی / درد)</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!wlName.trim()) {
                    showToast('نام بیمار برای ثبت در لیست انتظار الزامی است.');
                    return;
                  }
                  triggerHaptic('medium');
                  const entry: WaitlistEntry = {
                    id: `wl-${Date.now()}`,
                    patientName: wlName.trim(),
                    phone: wlPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
                    preferredUnit: wlUnit,
                    preferredShift: wlShift,
                    priority: wlPriority,
                    treatment: wlTreatment.trim() || 'ویزیت اورژانسی / کنسلی',
                    createdAt: todayStr
                  };
                  persistWaitlist([entry, ...waitlist]);
                  setWlName('');
                  setWlPhone('');
                  setWlTreatment('');
                  showToast(`«${entry.patientName}» به لیست انتظار اضافه شد.`);
                }}
                className="min-h-[38px] rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer active:scale-95"
              >
                + افزودن به صف انتظار
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {waitlist.length === 0 ? (
              <div className="p-6 text-center bg-white rounded-2xl border border-slate-100 text-xs text-slate-400">
                هنوز بیماری در لیست انتظار ثبت نشده است.
              </div>
            ) : (
              [...waitlist]
                .sort((a, b) => (a.priority === 'urgent' ? -1 : b.priority === 'urgent' ? 1 : 0))
                .map(item => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-3 border shadow-2xs flex items-center justify-between gap-2 flex-wrap ${
                      item.priority === 'urgent' ? 'border-rose-300 border-r-[3px] border-r-rose-500' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-900">{item.patientName}</span>
                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-lg ${
                          item.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.priority === 'urgent' ? 'فوری / درد حاد' : 'عادی'}
                        </span>
                        <span className="text-[10px] font-bold text-sky-700">
                          {normalizeClinicUnitName(item.preferredUnit)}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono">{toPersianDigits(item.phone)}</span>
                        <span>·</span>
                        <span>{item.treatment}</span>
                        <span>·</span>
                        <span>تاریخ ثبت: {toPersianDigits(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openAddModalSmart(item.preferredUnit, undefined, { waitlistEntry: item })}
                        className="min-h-[36px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black cursor-pointer"
                      >
                        تبدیل به نوبت قطعی ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          persistWaitlist(waitlist.filter(w => w.id !== item.id));
                          showToast(`«${item.patientName}» از لیست انتظار حذف شد.`);
                        }}
                        aria-label={`حذف ${item.patientName} از لیست انتظار`}
                        className="min-h-[36px] px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10.5px] font-bold cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* MODE 5: SHIFT SCHEDULE, BREAKS, HOLIDAYS & CLINIC UNITS CONFIG */}
      {viewMode === 'schedule' && (
        <div className="mx-2 space-y-3">
          {/* Clinic Working Hours & Lunch Break */}
          <div className="bg-white rounded-[22px] p-4 border border-sky-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <h4 className="text-xs font-black text-slate-900">ساعات کاری مطب و زمان استراحت بین‌روز</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">شروع پذیرش مطب</label>
                <select
                  aria-label="ساعت شروع پذیرش"
                  value={scheduleSettings.openTime}
                  onChange={(e) => persistSchedule({ ...scheduleSettings, openTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono font-bold"
                >
                  {STANDARD_TIME_SLOTS.slice(0, 12).map(s => (
                    <option key={s} value={s}>{toPersianDigits(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">پایان پذیرش مطب</label>
                <select
                  aria-label="ساعت پایان پذیرش"
                  value={scheduleSettings.closeTime}
                  onChange={(e) => persistSchedule({ ...scheduleSettings, closeTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono font-bold"
                >
                  {STANDARD_TIME_SLOTS.slice(12).map(s => (
                    <option key={s} value={s}>{toPersianDigits(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">شروع تایم ناهار/استراحت</label>
                <select
                  aria-label="شروع استراحت"
                  value={scheduleSettings.breakStart}
                  onChange={(e) => persistSchedule({ ...scheduleSettings, breakStart: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono font-bold"
                >
                  {STANDARD_TIME_SLOTS.slice(6, 20).map(s => (
                    <option key={s} value={s}>{toPersianDigits(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">پایان تایم ناهار/استراحت</label>
                <select
                  aria-label="پایان استراحت"
                  value={scheduleSettings.breakEnd}
                  onChange={(e) => persistSchedule({ ...scheduleSettings, breakEnd: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono font-bold"
                >
                  {STANDARD_TIME_SLOTS.slice(8, 22).map(s => (
                    <option key={s} value={s}>{toPersianDigits(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={scheduleSettings.breakEnabled}
                  onChange={(e) => persistSchedule({ ...scheduleSettings, breakEnabled: e.target.checked })}
                  className="rounded accent-sky-600 w-4 h-4"
                />
                <span>بستن اسلات ناهار و استراحت در انتخابگر ساعت</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={scheduleSettings.blockOfficialHolidays}
                  onChange={(e) => persistSchedule({ ...scheduleSettings, blockOfficialHolidays: e.target.checked })}
                  className="rounded accent-rose-600 w-4 h-4"
                />
                <span>هشدار و علامت‌گذاری جمعه‌ها و تعطیلات رسمی ایران</span>
              </label>
            </div>
          </div>

          {/* Per-Doctor Weekly Off-Days */}
          <div className="bg-white rounded-[22px] p-4 border border-indigo-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Ban className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black text-slate-900">روزهای آف (عدم حضور هفتگی پزشکان)</h4>
            </div>
            <div className="space-y-2.5">
              {clinicDoctors.map(doc => {
                const offDays = scheduleSettings.doctorOffWeekdays[doc] || [];
                return (
                  <div key={doc} className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs font-black text-slate-800">{doc}</span>
                    <div className="flex items-center gap-1">
                      {WEEKDAY_NAMES_SHORT_LIST.map((wLabel, wIdx) => {
                        const isOff = offDays.includes(wIdx);
                        return (
                          <button
                            key={wIdx}
                            type="button"
                            onClick={() => {
                              const nextDays = isOff ? offDays.filter(x => x !== wIdx) : [...offDays, wIdx];
                              persistSchedule({
                                ...scheduleSettings,
                                doctorOffWeekdays: {
                                  ...scheduleSettings.doctorOffWeekdays,
                                  [doc]: nextDays
                                }
                              });
                            }}
                            className={`min-w-[32px] min-h-[32px] rounded-lg text-[10.5px] font-black cursor-pointer transition-colors ${
                              isOff
                                ? 'bg-rose-600 text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                            title={isOff ? `${doc} در این روز حضور ندارد` : 'روز کاری'}
                          >
                            {wLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Clinic Holidays */}
          <div className="bg-white rounded-[22px] p-4 border border-rose-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-900">تعطیلات اختصاصی مطب (کنفرانس، تعمیرات، مرخصی)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <JalaliMiniDatePicker
                value={newHolidayDate}
                minDate={todayStr}
                onChange={setNewHolidayDate}
              />
              <div className="space-y-2 text-xs">
                <input
                  type="text"
                  placeholder="عنوان تعطیلی (مثلاً کنگره دندانپزشکی)"
                  aria-label="عنوان تعطیلی اختصاصی"
                  value={newHolidayReason}
                  onChange={(e) => setNewHolidayReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!isValidPersianDateStr(newHolidayDate)) return;
                    const reason = newHolidayReason.trim() || 'تعطیلی ثبت‌شده مطب';
                    persistSchedule({
                      ...scheduleSettings,
                      customHolidays: [
                        ...scheduleSettings.customHolidays.filter(h => !isSamePersianDate(h.date, newHolidayDate)),
                        { date: newHolidayDate, reason }
                      ]
                    });
                    setNewHolidayReason('');
                    showToast(`تاریخ ${toPersianDigits(newHolidayDate)} به عنوان تعطیل مطب ثبت شد.`);
                  }}
                  className="w-full min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer"
                >
                  + ثبت تاریخ تعطیل ({toPersianDigits(newHolidayDate)})
                </button>
                {scheduleSettings.customHolidays.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {scheduleSettings.customHolidays.map(h => (
                      <div key={h.date} className="flex items-center justify-between p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <span className="font-bold text-rose-900">
                          {toPersianDigits(h.date)} · {h.reason}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            persistSchedule({
                              ...scheduleSettings,
                              customHolidays: scheduleSettings.customHolidays.filter(x => x.date !== h.date)
                            })
                          }
                          className="text-rose-700 font-black px-2 py-0.5 rounded-lg bg-white border border-rose-200 cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Clinic Units Catalog (یونیت آبی، یونیت زرد، یونیت جراحی + یونیت جدید) */}
          <div className="bg-white rounded-[22px] p-4 border border-emerald-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-900">مدیریت یونیت‌های درمانی کلینیک</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {clinicUnits.map((u, idx) => (
                <div key={u.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: u.accent }} />
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">{u.name}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{u.doctor}</span>
                    </div>
                  </div>
                  {idx >= 3 && (
                    <button
                      type="button"
                      onClick={() => persistUnits(clinicUnits.filter(x => x.id !== u.id))}
                      className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 cursor-pointer"
                    >
                      حذف
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-slate-100">
              <input
                type="text"
                placeholder="نام یونیت جدید (مثلاً یونیت سبز)"
                aria-label="نام یونیت جدید"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-900"
              />
              <select
                aria-label="پزشک پیش‌فرض یونیت جدید"
                value={newUnitDoctor}
                onChange={(e) => setNewUnitDoctor(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800"
              >
                {clinicDoctors.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                aria-label="رنگ یونیت جدید"
                value={newUnitColor}
                onChange={(e) => setNewUnitColor(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800"
              >
                <option value="#10b981">سبز زمردی</option>
                <option value="#ec4899">صورتی استتیک</option>
                <option value="#06b6d4">فیروزه‌ای</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const trimmed = newUnitName.trim();
                  if (!trimmed) return;
                  if (clinicUnits.some(u => u.name === trimmed)) {
                    showToast('یونیتی با این نام قبلاً ثبت شده است.');
                    return;
                  }
                  persistUnits([
                    ...clinicUnits,
                    {
                      id: trimmed,
                      name: trimmed,
                      doctor: newUnitDoctor,
                      accent: newUnitColor,
                      colorTone: 'emerald',
                      borderActive: 'border-emerald-500 bg-emerald-50/90 text-emerald-900',
                      dropActive: 'border-emerald-400 bg-emerald-100/90 shadow-md ring-2 ring-emerald-300'
                    }
                  ]);
                  setNewUnitName('');
                  showToast(`«${trimmed}» به یونیت‌های کلینیک اضافه شد.`);
                }}
                className="min-h-[38px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
              >
                + افزودن یونیت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 1: QUICK MOVE MODAL (Date + Unit + Time with Confirm Button) */}
      {quickMoveModalApt && (
        <ViewportModalPortal isOpen={Boolean(quickMoveModalApt)}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="جابجایی یونیت و زمان نوبت"
            onClick={() => setQuickMoveModalApt(null)}
            className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[28px] border-0 sm:border border-slate-200 shadow-2xl text-slate-900 flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-2.5 border-b border-slate-100 bg-white shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900">جابجایی تاریخ، یونیت و زمان نوبت</h3>
                      <span className="text-[10px] text-slate-500">
                        {quickMoveModalApt.patientName} · مدت {toPersianDigits(quickMoveModalApt.durationMinutes || 45)} دقیقه
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickMoveModalApt(null)}
                    aria-label="بستن جابجایی نوبت"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3.5 flex-1 overflow-y-auto overscroll-contain">
                {/* Date Target Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">تاریخ مقصد:</label>
                    <button
                      type="button"
                      onClick={() => setQuickMoveShowCal(prev => !prev)}
                      className="text-[10.5px] font-black text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 cursor-pointer"
                    >
                      {toPersianDigits(quickMoveDate)} · {quickMoveShowCal ? 'بستن تقویم' : 'تغییر روز'}
                    </button>
                  </div>
                  {quickMoveShowCal && (
                    <JalaliMiniDatePicker
                      value={quickMoveDate}
                      minDate={todayStr}
                      onChange={(d) => {
                        setQuickMoveDate(d);
                        setQuickMoveShowCal(false);
                      }}
                    />
                  )}
                </div>

                {/* Destination Unit Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">انتخاب یونیت مقصد:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {clinicUnits.map(unit => {
                      const isSelectedUnit = quickMoveUnit === unit.id;
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection');
                            setQuickMoveUnit(unit.id);
                          }}
                          className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                            isSelectedUnit
                              ? 'bg-sky-600 border-sky-700 text-white font-black shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          <span className="text-[11px] block">{unit.name}</span>
                          <span className={`text-[9px] block mt-0.5 truncate ${isSelectedUnit ? 'text-sky-100' : 'text-slate-400'}`}>
                            {unit.doctor.split(' ')[1] || unit.doctor}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Destination Time Slot Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">تغییر ساعت نوبت (همراه با تشخیص تداخل بازه):</label>
                  <WheelTimePicker
                    value={quickMoveTime}
                    unitName={quickMoveUnit}
                    occupiedTimes={quickMoveOccupiedTimes}
                    blockedTimes={quickMoveBlockedTimes}
                    onChange={(newSlot) => setQuickMoveTime(newSlot)}
                  />
                </div>
              </div>

              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-slate-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickMoveModalApt(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickMoveConfirm(quickMoveUnit, quickMoveTime, quickMoveDate)}
                  className="w-2/3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md shadow-sky-600/20 cursor-pointer active:scale-95 transition-all"
                >
                  انتقال قطعی نوبت ✓ ({toPersianDigits(quickMoveTime)})
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* DIALOG 2: NEW APPOINTMENT MODAL */}
      {showAddModal && (
        <ViewportModalPortal isOpen={showAddModal}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ثبت نوبت دندانپزشکی جدید"
            onClick={() => {
              setShowAddModal(false);
              setFormErrorMsg(null);
              setConflictOverrideConfirmed(false);
              setConfirmCreateStep(false);
            }}
            className="fixed inset-0 z-[100] bg-sky-950/35 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-sky-50/95 via-white to-blue-50/40 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-sky-200/90 shadow-2xl flex flex-col overflow-hidden ${
                modalShake ? 'ios27-conflict-shake border-rose-400 ring-2 ring-rose-400/50' : ''
              }`}
            >
              <div className="px-4 pt-3 pb-2.5 border-b border-sky-100 bg-white/95 shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-sky-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">ثبت نوبت دندانپزشکی جدید</h3>
                      <span className="text-[10px] font-bold text-sky-700">
                        {selectedDayWeekdayName} {toPersianDigits(targetModalDate)} · {formUnit}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormErrorMsg(null);
                      setConflictOverrideConfirmed(false);
                      setConfirmCreateStep(false);
                    }}
                    aria-label="بستن ثبت نوبت جدید"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form id="new-appointment-form" onSubmit={(e) => handleCreate(e)} className="p-4 space-y-3 text-xs flex-1 overflow-y-auto overscroll-contain">
                {/* Date Picker & Quick Follow-up Chips Inside Modal */}
                <div className="p-2.5 rounded-2xl bg-white/90 border border-sky-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-slate-700">
                      تاریخ نوبت: {toPersianDigits(targetModalDate)} ({selectedDayWeekdayName})
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormShowCal(prev => !prev)}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-[10.5px] font-black cursor-pointer"
                    >
                      {formShowCal ? 'بستن تقویم' : 'تقویم جلالی'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { label: 'امروز', date: todayStr },
                      { label: 'فردا', date: addDaysToPersianDate(todayStr, 1) },
                      { label: '+۷ روز', date: addDaysToPersianDate(todayStr, 7) },
                      { label: '+۱۴ روز', date: addDaysToPersianDate(todayStr, 14) },
                      { label: '+۱ ماه', date: addMonthsToPersianDate(todayStr, 1) },
                      { label: '+۶ ماه چکاپ', date: addMonthsToPersianDate(todayStr, 6) }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          jumpToPersianDate(preset.date);
                          setFormErrorMsg(null);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer ${
                          isSamePersianDate(targetModalDate, preset.date)
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-sky-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {formShowCal && (
                    <JalaliMiniDatePicker
                      value={targetModalDate}
                      minDate={todayStr}
                      onChange={(d) => {
                        jumpToPersianDate(d);
                        setFormShowCal(false);
                        setFormErrorMsg(null);
                      }}
                    />
                  )}
                </div>

                {/* Fast Searchable Patient Autocomplete */}
                <div className="space-y-1.5 relative">
                  <label className="text-slate-600 font-bold block text-[11px]">جستجوی سریع در پرونده بیماران (نام، تلفن یا کد پرونده)</label>
                  <input
                    type="text"
                    aria-label="جستجوی سریع بیمار در پرونده‌ها"
                    value={formPatientLookupQuery}
                    onChange={(e) => {
                      setFormPatientLookupQuery(e.target.value);
                      if (formPatientId) setFormPatientId('');
                    }}
                    placeholder="تایپ نام، ۰۹۱۲... یا شماره پرونده D-1051"
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                  />
                  {patientAutocompleteMatches.length > 0 && !formPatientId && (
                    <div className="bg-white border border-sky-200 rounded-xl shadow-md divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {patientAutocompleteMatches.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePatientSelectInForm(p)}
                          className="w-full px-3 py-2 text-right hover:bg-sky-50 flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="font-black text-slate-900 text-xs">{p.fullName}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {p.fileNumber} · {toPersianDigits(p.phone)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Patient Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[11px]">نام و نام خانوادگی بیمار *</label>
                    <input
                      type="text"
                      inputMode="text"
                      required
                      value={formPatientName}
                      onFocus={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setFormPatientName(e.target.value);
                        setFormPatientId('');
                        setFormErrorMsg(null);
                      }}
                      placeholder="مثال: رضا محمدی"
                      className="w-full bg-white border border-sky-200 rounded-xl px-2.5 py-2 text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-sky-500 shadow-2xs select-text"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[11px]">شماره همراه</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={formPhone}
                      onFocus={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setFormPhone(e.target.value);
                        setFormPatientId('');
                      }}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full bg-white border border-sky-200 rounded-xl px-2.5 py-2 text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-sky-500 shadow-2xs select-text"
                    />
                  </div>
                </div>

                {/* Matched Patient Clinical/Financial Alert OR Auto-Create File Toggle */}
                {matchedPatientInAddForm ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[10.5px] space-y-1">
                    <div className="flex items-center justify-between font-black text-emerald-950">
                      <span>پرونده متصل شد: {matchedPatientInAddForm.fullName} ({matchedPatientInAddForm.fileNumber})</span>
                      {matchedPatientInAddForm.balance < 0 && (
                        <span className="text-amber-800 font-mono tabular-nums">
                          مانده: {formatToman(Math.abs(matchedPatientInAddForm.balance))}
                        </span>
                      )}
                    </div>
                    {matchedPatientInAddForm.medicalHistory?.length > 0 && (
                      <div className="text-rose-700 font-bold">
                        هشدار پزشکی: {matchedPatientInAddForm.medicalHistory.join('، ')}
                      </div>
                    )}
                    {addFormNoShowRisk.level === 'low' && addFormNoShowRisk.completedCount >= 1 && (
                      <div className="text-emerald-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>سابقه حضور منظم ({toPersianDigits(addFormNoShowRisk.completedCount)} مراجعه تکمیل‌شده · احتمال عدم حضور: {toPersianDigits(addFormNoShowRisk.probabilityPercent)}٪)</span>
                      </div>
                    )}
                  </div>
                ) : (
                  formPatientName.trim().length >= 2 && onQuickCreatePatient && (
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50/80 border border-sky-200 cursor-pointer text-[10.5px] font-bold text-sky-950">
                      <input
                        type="checkbox"
                        checked={autoCreatePatientFile}
                        onChange={(e) => setAutoCreatePatientFile(e.target.checked)}
                        className="rounded accent-sky-600 w-3.5 h-3.5"
                      />
                      <UserPlus className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span>تشکیل خودکار پرونده جدید در لیست بیماران هنگام ثبت این نوبت</span>
                    </label>
                  )
                )}

                {/* Predictive Secretary No-Show Warning Banner (based on no_show/cancelled history & patient traits) */}
                {(matchedPatientInAddForm || formPatientName.trim().length >= 2 || toEnglishDigits(formPhone).replace(/\D/g, '').length >= 7) &&
                  (addFormNoShowRisk.level !== 'low' || addFormNoShowRisk.noShowCount > 0 || addFormNoShowRisk.cancelledCount > 0 || matchedPatientNoShowHistoryCount > 0) && (
                    <div
                      role="alert"
                      className={`p-2.5 rounded-2xl border-2 space-y-1.5 animate-in fade-in duration-150 ${
                        addFormNoShowRisk.level === 'high'
                          ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                          : 'bg-amber-50/95 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ShieldAlert className={`w-4 h-4 shrink-0 ${addFormNoShowRisk.level === 'high' ? 'text-rose-600' : 'text-amber-600'}`} />
                          <span className="text-[11px] font-black truncate">
                            هشدار منشی — احتمال عدم حضور: {toPersianDigits(addFormNoShowRisk.probabilityPercent)}٪
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-black shrink-0 ${
                          addFormNoShowRisk.level === 'high'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-slate-950'
                        }`}>
                          {addFormNoShowRisk.level === 'high' ? 'ریسک بالای لغو / غیبت' : 'ریسک متوسط'}
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden border border-black/5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            addFormNoShowRisk.level === 'high' ? 'bg-rose-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${addFormNoShowRisk.probabilityPercent}%` }}
                        />
                      </div>

                      {addFormNoShowRisk.reasons.length > 0 && (
                        <ul className="text-[10px] font-bold space-y-0.5 pr-1">
                          {addFormNoShowRisk.reasons.map((reason, rIdx) => (
                            <li key={rIdx} className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${addFormNoShowRisk.level === 'high' ? 'bg-rose-500' : 'bg-amber-600'}`} />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {addFormNoShowRisk.recommendations.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/10 flex-wrap">
                          <span className="text-[9.5px] font-extrabold opacity-90">
                            پیشنهاد: {addFormNoShowRisk.recommendations[0]}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('success');
                              setSendSmsOnCreate(true);
                              setFormReminderConfig(prev => ({
                                ...prev,
                                enabled: true,
                                preset: '2h_before',
                                channels: ['phone_push', 'sms', 'in_app']
                              }));
                            }}
                            className={`px-2 py-1 rounded-lg text-[9.5px] font-black cursor-pointer transition-all active:scale-95 ${
                              sendSmsOnCreate && formReminderConfig.enabled && formReminderConfig.channels.includes('sms')
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 shadow-2xs'
                            }`}
                          >
                            {sendSmsOnCreate && formReminderConfig.enabled && formReminderConfig.channels.includes('sms')
                              ? '✓ پیامک و یادآور تایید فعال شد'
                              : 'فعال‌سازی پیامک و یادآور تایید'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                {sameDayActiveAptsForMatchedPatient.length > 0 && (
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[10.5px] font-bold">
                    یادآوری: این بیمار در تاریخ {toPersianDigits(targetModalDate)} یک نوبت فعال در ساعت {toPersianDigits(sameDayActiveAptsForMatchedPatient[0].time)} ({normalizeClinicUnitName(sameDayActiveAptsForMatchedPatient[0].unit)}) دارد.
                  </div>
                )}

                {/* Unit + Time + Doctor */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[11px]">یونیت</label>
                    <select
                      aria-label="یونیت"
                      value={formUnit}
                      onChange={(e) => {
                        const nextUnit = e.target.value;
                        setFormUnit(nextUnit);
                        setFormDoctor(getDefaultDoctorForUnit(nextUnit));
                        setConflictOverrideConfirmed(false);
                        setFormErrorMsg(null);
                      }}
                      className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                    >
                      {clinicUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[11px]">پزشک معالج</label>
                    <select
                      aria-label="پزشک معالج"
                      value={formDoctor}
                      onChange={(e) => {
                        setFormDoctor(e.target.value);
                        setConflictOverrideConfirmed(false);
                      }}
                      className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                    >
                      {clinicDoctors.map(doc => (
                        <option key={doc} value={doc}>{doc}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[11px]">ساعت نوبت</label>
                    <input
                      aria-label="ساعت نوبت"
                      type="text"
                      inputMode="numeric"
                      value={formTime}
                      onFocus={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setFormTime(e.target.value);
                        setConflictOverrideConfirmed(false);
                        setFormErrorMsg(null);
                      }}
                      className={`w-full bg-white border rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:outline-none shadow-2xs select-text ${
                        conflictingAptInModal
                          ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-black'
                          : 'border-sky-200 focus:border-sky-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Quick Treatment Presets + Auto Unit/Duration Inference */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {QUICK_TREATMENT_PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setFormTreatment(p.treatment);
                          setFormDuration(p.duration);
                          setFormUnit(p.unit);
                          setFormDoctor(getDefaultDoctorForUnit(p.unit));
                          setConflictOverrideConfirmed(false);
                        }}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-sky-50 border border-sky-200 text-[10px] font-bold text-slate-700 whitespace-nowrap cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    inputMode="text"
                    aria-label="شرح درمان یا علت مراجعه"
                    value={formTreatment}
                    onFocus={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormTreatment(val);
                      const inferred = suggestTreatmentSchedule(val);
                      if (inferred.matched) {
                        setFormDuration(inferred.durationMinutes);
                        setFormUnit(inferred.suggestedUnit);
                      }
                    }}
                    placeholder="شرح درمان (مثلاً عصب‌کشی، ایمپلنت، روکش...)"
                    className="w-full bg-white border border-sky-200 rounded-xl px-2.5 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs select-text"
                  />
                </div>

                {/* Interactive Wheel Time Picker (Full Interval Occupied + Schedule Blocked Maps) */}
                <WheelTimePicker
                  value={formTime}
                  unitName={formUnit}
                  occupiedTimes={addModalOccupiedTimes}
                  blockedTimes={addModalBlockedTimes}
                  onChange={(slot) => {
                    setFormTime(slot);
                    setConflictOverrideConfirmed(false);
                    setConfirmCreateStep(false);
                    setFormErrorMsg(null);
                  }}
                />

                {/* Duration & Multi-Session Recurrence Selector */}
                <div className="space-y-2 bg-white/90 border border-sky-200/80 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-slate-700">مدت زمان نوبت:</span>
                    <div className="flex items-center gap-1">
                      {[30, 45, 60, 90].map(dur => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => {
                            setFormDuration(dur);
                            setConflictOverrideConfirmed(false);
                            setFormErrorMsg(null);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                            formDuration === dur
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {toPersianDigits(dur)} دقیقه
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-slate-100">
                    <span className="text-[11px] font-black text-slate-700">تکرار / جلسات زنجیره‌ای:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { id: 'single' as const, count: 1, label: 'تک‌جلسه' },
                        { id: 'weekly' as const, count: 2, label: '۲ جلسه هفتگی' },
                        { id: 'weekly' as const, count: 3, label: '۳ جلسه هفتگی' },
                        { id: 'monthly' as const, count: 2, label: '۲ جلسه ماهانه' }
                      ].map(opt => {
                        const isActive = formRecurrenceCadence === opt.id && (opt.id === 'single' || formRecurrenceCount === opt.count);
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setFormRecurrenceCadence(opt.id);
                              setFormRecurrenceCount(opt.count);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                              isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-indigo-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {recurringTargetDates.length > 1 && (
                    <div className="text-[10px] font-bold text-indigo-800 bg-indigo-50/70 rounded-lg px-2 py-1">
                      تاریخ‌های جلسات: {recurringTargetDates.map(d => toPersianDigits(d)).join(' ← ')}
                    </div>
                  )}
                </div>

                {(selectedDayHolidayInfo.isHoliday || isFormDoctorOffDay) && (
                  <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[10.5px] font-black">
                      {selectedDayHolidayInfo.isHoliday
                        ? `هشدار تقویم: تاریخ ${toPersianDigits(targetModalDate)} تعطیل (${selectedDayHolidayInfo.reason}) است.`
                        : `هشدار شیفت: ${formDoctor} در روزهای ${selectedDayWeekdayName} در مطب حضور ندارد.`}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        jumpToPersianDate(nextWorkingDateForFormDoctor);
                        setFormErrorMsg(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black cursor-pointer shrink-0"
                    >
                      انتقال به اولین روز کاری ({toPersianDigits(nextWorkingDateForFormDoctor)})
                    </button>
                  </div>
                )}

                {isSelectedSlotInPast && (
                  <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-black">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>تاریخ یا ساعت انتخابی ({toPersianDigits(targetModalDate)} · {toPersianDigits(formTime)}) گذشته است.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        jumpToToday();
                        setFormErrorMsg(null);
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                    >
                      پرش به امروز
                    </button>
                  </div>
                )}

                {(conflictingAptInModal || formErrorMsg) && (
                  <div className="p-2.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 text-[10.5px] font-bold leading-relaxed">
                        {formErrorMsg || (
                          conflictingDoctorApt && !conflictingUnitApt ? (
                            <>
                              تداخل پزشک! <strong>{formDoctor}</strong> در ساعت <strong>{toPersianDigits(formTime)}</strong> در «{normalizeClinicUnitName(conflictingDoctorApt.unit)}» نوبت بیمار <strong>«{conflictingDoctorApt.patientName}»</strong> دارد.
                            </>
                          ) : (
                            <>
                              هشدار تداخل نوبت! در <strong>{formUnit}</strong> ساعت{' '}
                              <strong>{toPersianDigits(formTime)}</strong> با نوبت بیمار{' '}
                              <strong>«{conflictingAptInModal?.patientName}»</strong> ({conflictingAptInModal?.treatment}) همپوشانی دارد.
                            </>
                          )
                        )}
                      </div>
                    </div>

                    {conflictingAptInModal && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('success');
                            setFormTime(nextAvailableSlotInModal);
                            setFormErrorMsg(null);
                            setConflictOverrideConfirmed(false);
                          }}
                          className="py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          ✓ انتخاب اولین ساعت خالی ({toPersianDigits(nextAvailableSlotInModal)})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('medium');
                            const slotMin = parseTimeMinutes(formTime);
                            const inferredShift: WaitlistEntry['preferredShift'] =
                              slotMin < 13 * 60 ? 'morning' : slotMin < 17 * 60 ? 'afternoon' : 'evening';
                            const wlEntry: WaitlistEntry = {
                              id: `wl-${Date.now()}`,
                              patientName: formPatientName.trim() || 'بیمار در انتظار نوبت',
                              phone: formPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
                              preferredUnit: formUnit,
                              preferredDoctor: formDoctor,
                              preferredDate: targetModalDate,
                              preferredShift: inferredShift,
                              priority: 'normal',
                              treatment: formTreatment || 'معاینه و طرح درمان',
                              notes: `انتقال مستقیم از تداخل ساعت ${toPersianDigits(formTime)}`,
                              createdAt: new Date().toISOString()
                            };
                            persistWaitlist([wlEntry, ...waitlist]);
                            setShowAddModal(false);
                            setFormErrorMsg(null);
                            setConflictOverrideConfirmed(false);
                            setViewMode('waitlist');
                            showToast(`«${wlEntry.patientName}» به لیست انتظار ${formUnit} منتقل شد.`);
                          }}
                          className="py-1 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black cursor-pointer active:scale-95 transition-all"
                        >
                          انتقال به لیست انتظار
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('warning');
                            setConflictOverrideConfirmed(true);
                            handleCreate(undefined, true);
                          }}
                          className="py-1 px-2.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-black cursor-pointer active:scale-95 transition-all"
                        >
                          ثبت همزمان با تایید منشی
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <ReminderOptionPicker
                  value={formReminderConfig}
                  onChange={setFormReminderConfig}
                  targetDate={targetModalDate}
                  targetTime={formTime}
                  theme="sky"
                  title="یادآوری و نوتیفیکیشن گوشی برای این نوبت"
                />

                <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSmsOnCreate}
                    onChange={(e) => setSendSmsOnCreate(e.target.checked)}
                    className="rounded accent-sky-600 w-3.5 h-3.5"
                  />
                  <span className="text-[10.5px]">ارسال خودکار پیامک تایید نوبت و نشانی مطب</span>
                </label>
              </form>

              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-sky-100 shrink-0 sticky bottom-0 z-20">
                {confirmCreateStep ? (
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                      <span>تایید نهایی ثبت نوبت «{formPatientName}»</span>
                      <span className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                        {formUnit} · ساعت {toPersianDigits(formTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmCreateStep(false)}
                        className="w-1/3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer"
                      >
                        بازگشت و اصلاح
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreate(undefined, conflictOverrideConfirmed)}
                        className="w-2/3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                      >
                        تایید و ثبت قطعی نوبت ✓
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setFormErrorMsg(null);
                        setConflictOverrideConfirmed(false);
                        setConfirmCreateStep(false);
                      }}
                      className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!formPatientName.trim()) {
                          triggerModalShake();
                          setFormErrorMsg('لطفاً نام و نام خانوادگی بیمار را وارد نمایید.');
                          return;
                        }
                        if (isPastPersianDateTime(targetModalDate, formTime)) {
                          triggerModalShake();
                          setFormErrorMsg(`ثبت نوبت برای تاریخ یا ساعت گذشته (${toPersianDigits(targetModalDate)} · ${toPersianDigits(formTime)}) مجاز نیست.`);
                          return;
                        }
                        if (conflictingAptInModal && !conflictOverrideConfirmed) {
                          triggerModalShake();
                          setFormErrorMsg(
                            `تداخل یونیت/پزشک و ساعت! در ${normalizeClinicUnitName(conflictingAptInModal.unit)} ساعت ${toPersianDigits(formTime)} بیمار «${conflictingAptInModal.patientName}» نوبت دارد.`
                          );
                          return;
                        }
                        triggerHaptic('selection');
                        setConfirmCreateStep(true);
                      }}
                      className={`w-2/3 py-2.5 rounded-xl text-white text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer ${
                        isSelectedSlotInPast
                          ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                          : conflictingAptInModal && !conflictOverrideConfirmed
                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                            : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/25'
                      }`}
                    >
                      {isSelectedSlotInPast
                        ? 'زمان در گذشته است ⚠️'
                        : conflictingAptInModal && !conflictOverrideConfirmed
                          ? 'بررسی تداخل ساعت ⚠️'
                          : 'مرحله ۱: بررسی و ثبت نوبت'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* DIALOG 3: FULL EDIT / DELETE APPOINTMENT MODAL */}
      {editingApt && (
        <ViewportModalPortal isOpen={Boolean(editingApt)}>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingApt(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ویرایش کامل نوبت بیمار"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white text-slate-900 rounded-none sm:rounded-[26px] border-0 sm:border border-amber-200 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 pt-3 pb-2.5 border-b border-slate-100 bg-white shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-amber-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">ویرایش کامل نوبت بیمار</h4>
                      <span className="text-[10px] text-slate-500 font-bold">
                        اصلاح تاریخ، ساعت، یونیت، پزشک، یادآوری گوشی یا حذف نوبت
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingApt(null)}
                    aria-label="بستن ویرایش نوبت"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2.5 text-xs flex-1 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">نام و نام خانوادگی بیمار</label>
                    <input
                      aria-label="نام و نام خانوادگی بیمار"
                      type="text"
                      value={editAptName}
                      onChange={(e) => setEditAptName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">تلفن تماس</label>
                    <input
                      aria-label="تلفن تماس"
                      type="text"
                      value={editAptPhone}
                      onChange={(e) => setEditAptPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">تاریخ شمسی نوبت</label>
                      <button
                        type="button"
                        onClick={() => setEditAptShowCal(prev => !prev)}
                        className="text-[10px] font-black text-amber-800 hover:underline cursor-pointer"
                      >
                        {editAptShowCal ? 'بستن تقویم' : 'انتخاب از تقویم'}
                      </button>
                    </div>
                    <input
                      aria-label="تاریخ شمسی نوبت"
                      type="text"
                      value={editAptDate}
                      onChange={(e) => setEditAptDate(e.target.value)}
                      placeholder="۱۴۰۵/۰۲/۲۵"
                      className={`w-full bg-slate-50 border rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none ${
                        isValidPersianDateStr(editAptDate) ? 'border-slate-200 focus:border-amber-500' : 'border-rose-400 bg-rose-50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">ساعت نوبت (۸ صبح تا ۱۱ شب)</label>
                    <select
                      aria-label="ساعت نوبت"
                      value={editAptTime}
                      onChange={(e) => setEditAptTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    >
                      {STANDARD_TIME_SLOTS.map(s => (
                        <option key={s} value={s}>{toPersianDigits(s)}</option>
                      ))}
                      {!STANDARD_TIME_SLOTS.includes(editAptTime) && (
                        <option value={editAptTime}>{toPersianDigits(editAptTime)}</option>
                      )}
                    </select>
                  </div>
                </div>

                {editAptShowCal && (
                  <JalaliMiniDatePicker
                    value={isValidPersianDateStr(editAptDate) ? editAptDate : todayStr}
                    onChange={(d) => {
                      setEditAptDate(d);
                      setEditAptShowCal(false);
                    }}
                  />
                )}

                <WheelTimePicker
                  value={editAptTime}
                  unitName={editAptUnit}
                  compact
                  occupiedTimes={editModalOccupiedTimes}
                  blockedTimes={editModalBlockedTimes}
                  onChange={(newTime) => setEditAptTime(newTime)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">یونیت درمانی</label>
                    <select
                      aria-label="یونیت درمانی"
                      value={editAptUnit}
                      onChange={(e) => setEditAptUnit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    >
                      {clinicUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">پزشک معالج</label>
                    <select
                      aria-label="پزشک معالج"
                      value={editAptDoctor}
                      onChange={(e) => setEditAptDoctor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    >
                      {clinicDoctors.map(doc => (
                        <option key={doc} value={doc}>{doc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">شرح درمان</label>
                    <input
                      aria-label="شرح درمان"
                      type="text"
                      value={editAptTreatment}
                      onChange={(e) => setEditAptTreatment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">مدت (دقیقه)</label>
                    <select
                      aria-label="مدت زمان نوبت"
                      value={editAptDuration}
                      onChange={(e) => setEditAptDuration(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    >
                      {[30, 45, 60, 90].map(dur => (
                        <option key={dur} value={dur}>{toPersianDigits(dur)} دقیقه</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">وضعیت نوبت</label>
                    <select
                      aria-label="وضعیت نوبت"
                      value={editAptStatus}
                      onChange={(e) => setEditAptStatus(e.target.value as Appointment['status'])}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="scheduled">رزرو شده</option>
                      <option value="waiting">حاضر در سالن انتظار</option>
                      <option value="in_chair">روی یونیت (در حال درمان)</option>
                      <option value="completed">درمان انجام شد (مختومه)</option>
                      <option value="no_show">عدم حضور بیمار (No-Show)</option>
                      <option value="cancelled">لغو شده</option>
                    </select>
                  </div>
                </div>

                {(editAptStatus === 'cancelled' || editAptStatus === 'no_show') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">علت لغو یا عدم حضور (اختیاری)</label>
                    <input
                      type="text"
                      aria-label="علت لغو یا عدم حضور"
                      placeholder="مثلاً تماس گرفته نشد / تعویق به هفته آینده..."
                      value={editAptReason}
                      onChange={(e) => setEditAptReason(e.target.value)}
                      className="w-full bg-rose-50/70 border border-rose-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                )}

                <ReminderOptionPicker
                  value={editReminderConfig}
                  onChange={setEditReminderConfig}
                  targetDate={editAptDate}
                  targetTime={editAptTime}
                  theme="amber"
                  title="یادآوری و نوتیفیکیشن گوشی"
                />
              </div>

              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-slate-100 shrink-0 sticky bottom-0 z-20 flex items-center justify-between gap-2 flex-wrap">
                {onDeleteAppointment && isManager ? (
                  <ArmedActionButton
                    label="حذف نوبت (مدیر)"
                    confirmLabel="تایید بایگانی؟ ✓"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onConfirm={() => {
                      onDeleteAppointment(editingApt.id);
                      showToast(`نوبت «${editingApt.patientName}» به بایگانی مدیر منتقل شد.`);
                      setEditingApt(null);
                    }}
                    className="min-h-[38px] py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">🔒 حذف نوبت فقط توسط مدیر</span>
                )}
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingApt(null)}
                    className="min-h-[38px] py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editAptName.trim()) return;
                      const normalizedDate = editAptDate.trim();
                      if (!isValidPersianDateStr(normalizedDate)) {
                        triggerHaptic('error');
                        actionFeedback.recordError({
                          title: 'فرمت تاریخ شمسی نامعتبر است',
                          subtitle: 'لطفاً تاریخ معتبر را از تقویم انتخاب کنید (مثلاً ۱۴۰۵/۰۲/۲۰).'
                        });
                        return;
                      }
                      if (isAppointmentActive(editAptStatus)) {
                        const dateOrTimeChanged =
                          !isSamePersianDate(normalizedDate, editingApt.date) ||
                          editAptTime !== editingApt.time;
                        if (dateOrTimeChanged && isPastPersianDateTime(normalizedDate, editAptTime)) {
                          triggerHaptic('error');
                          actionFeedback.recordError({
                            title: 'زمان ویرایش‌شده در گذشته است',
                            subtitle: `نوبت فعال را نمی‌توان به تاریخ/ساعت گذشته (${toPersianDigits(normalizedDate)} ${toPersianDigits(editAptTime)}) منتقل کرد.`
                          });
                          return;
                        }
                        const editCollision = appointments.find(
                          a =>
                            a.id !== editingApt.id &&
                            isSamePersianDate(a.date, normalizedDate) &&
                            (normalizeClinicUnitName(a.unit) === normalizeClinicUnitName(editAptUnit) || a.doctor === editAptDoctor) &&
                            isAppointmentActive(a.status) &&
                            appointmentsOverlap(a.time, a.durationMinutes || 45, editAptTime, editAptDuration)
                        );
                        if (editCollision) {
                          triggerHaptic('error');
                          actionFeedback.recordConflict({
                            title: `تداخل زمانی ویرایش در ${editAptUnit} ساعت ${toPersianDigits(editAptTime)}`,
                            subtitle: `بیمار «${editCollision.patientName}» در تاریخ ${toPersianDigits(normalizedDate)} بازه همپوشان دارد.`,
                            targetRecordId: editCollision.id,
                            badgeText: `⚠️ تداخل با ${editCollision.patientName}`
                          });
                          return;
                        }
                      }
                      triggerHaptic('success');
                      if (onEditAppointment) {
                        onEditAppointment(editingApt.id, {
                          patientName: editAptName.trim(),
                          phone: editAptPhone.trim(),
                          date: normalizedDate,
                          time: editAptTime,
                          durationMinutes: editAptDuration,
                          unit: normalizeClinicUnitName(editAptUnit),
                          doctor: editAptDoctor,
                          treatment: editAptTreatment.trim(),
                          status: editAptStatus,
                          cancellationReason: (editAptStatus === 'cancelled' || editAptStatus === 'no_show') ? editAptReason.trim() : undefined,
                          reminderConfig: editReminderConfig
                        });
                      }
                      showToast(`تغییرات نوبت «${editAptName}» با موفقیت ذخیره شد.`);
                      setEditingApt(null);
                    }}
                    className="min-h-[38px] py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    ذخیره تغییرات نوبت ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}
    </div>
  );
};
