import React, { useState } from 'react';
import { 
  Users, Search, UserPlus, Phone, ChevronLeft, 
  AlertTriangle, FileCheck2, Calendar, ShieldCheck,
  Stethoscope, CreditCard, DollarSign, HeartPulse,
  Filter, Check, Clock, Edit3, X,
  FlaskConical, Activity, Layers, Printer, Pill,
  ChevronDown, ChevronUp, PenTool, CheckCircle2, Clock3,
  MoreVertical, Sparkles, ArrowUpDown, FolderOpen,
  MessageSquare, Send, CalendarCheck, PhoneIncoming, Download,
  QrCode, Lock, Unlock, BarChart3, BellRing
} from 'lucide-react';
import * as d3 from 'd3';
import { Patient, ToothCondition, Appointment } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, getCurrentPersianDate, getPersianTreatmentName, isSamePersianDate, diffPersianDays } from '../../utils/jalali';
import { getLatestFileNumber, getNextFileNumber, recordLastFileNumber } from '../../utils/fileNumber';
import { validateIranianNationalCode, validateIranianMobileNumber } from '../../utils/validators';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { autoSaveManager } from '../../utils/autoSaveManager';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { useActionFeedback, actionFeedback } from '../../utils/actionFeedback';
import { CardMutationBadge } from '../ArmedActionButton';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { TrackableIdBadge } from '../TrackableIdBadge';
import { indexedDbService } from '../../services/indexedDbService';
import { clinicalSmsService } from '../../services/smsService';
import { analyzePatient360 } from '../../utils/clinicalIntelligence';
import { RealQrCode } from '../RealQrCode';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { WheelTimePicker } from '../WheelTimePicker';
import { markReminderDone, scheduleEntityReminder } from '../../services/reminderNotificationService';

interface PatientsListViewProps {
  patients: Patient[];
  appointments?: Appointment[];
  onOpenPatientFile: (patient: Patient, tab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai') => void;
  onAddNewPatient: (patient: Omit<Patient, 'id' | 'totalCost' | 'paidAmount' | 'balance' | 'activeTreatmentsCount' | 'lastVisit' | 'teethConditions' | 'sayadChecks' | 'installments' | 'labOrders' | 'implantCases' | 'payments'>) => void;
  onUpdateFileNumber?: (patientId: string, newFileNumber: string) => void;
  onEditPatient?: (patientId: string, updatedFields: Partial<Patient>) => void;
  onDeletePatient?: (patientId: string) => void;
  onOpenInvoice?: (patient: Patient) => void;
  onOpenPalmerChart?: (patient: Patient) => void;
  onQuickPayment?: (patient: Patient) => void;
  onQuickAddAppointment?: (apt: Omit<Appointment, 'id'>) => void;
  onOpenPatientScanner?: () => void;
  prefillPhone?: string | null;
  onConsumePrefill?: () => void;
  isManager?: boolean;
}

const PATIENTS_WHEEL_LOCK_KEY = 'minadental_patients_ios27_wheel_lock_v1';

interface SavedWheelLockConfig {
  activeFilter?: 'all' | 'financial_followup' | 'with_appointment' | 'active_treatment' | 'debtors' | 'implants' | 'lab' | 'medical_alert';
  sortFilterMode?: 'newest' | 'priority_followup' | 'alphabetical' | 'unpaid_balance' | 'last_visit';
  advDebtFilter?: 'all' | 'financial_followup' | 'any_debt' | 'high_debt' | 'overdue_installment' | 'settled';
  advLastVisitFilter?: 'all' | 'upcoming' | 'recent_30d' | 'overdue_30d' | 'no_appointment';
  advTreatmentFilter?: 'all' | 'implant' | 'endo' | 'prosthesis' | 'restorative' | 'pediatric' | 'extraction_scaling';
  lockedAt?: string;
}

function readPatientsWheelLock(): SavedWheelLockConfig | null {
  try {
    const raw = localStorage.getItem(PATIENTS_WHEEL_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function resolveDynamicCardTariff(treatment: ToothCondition['treatment'], fallback: number): number {
  try {
    const raw = localStorage.getItem('minadental_tariffs_catalog_v2');
    if (!raw) return fallback;
    const catalog = JSON.parse(raw);
    if (!Array.isArray(catalog)) return fallback;
    const keywordMap: Record<string, string[]> = {
      composite: ['کامپوزیت'],
      endo: ['عصب‌کشی', 'اندو', 'روت‌کانال'],
      crown_zirconia: ['زیرکونیا'],
      implant: ['ایمپلنت', 'فیکسچر'],
      scaling: ['جرم‌گیری'],
      extraction: ['کشیدن', 'جراحی']
    };
    const keywords = keywordMap[treatment] || [];
    const matched = catalog.find((item: { name?: string; price?: number }) =>
      item && typeof item.price === 'number' && keywords.some((kw) => String(item.name || '').includes(kw))
    );
    return matched && matched.price > 0 ? matched.price : fallback;
  } catch {
    return fallback;
  }
}

function formatIranianMobileClean(rawPhone: string): string {
  const digits = toEnglishDigits(rawPhone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('98') && digits.length >= 12) return '0' + digits.slice(2);
  return digits;
}

function buildWhatsAppHref(rawPhone: string, message: string): string {
  const digits = formatIranianMobileClean(rawPhone);
  const intl = digits.startsWith('0') ? `98${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

function buildNativeSmsHref(rawPhone: string, message: string): string {
  const clean = formatIranianMobileClean(rawPhone);
  const sep = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent) ? '&' : '?';
  return `sms:${clean}${sep}body=${encodeURIComponent(message)}`;
}

function extractInsuranceFromNotes(notes?: string): string {
  if (!notes) return 'آزاد';
  const match = notes.match(/بیمه:\s*([^\n|]+)/);
  if (!match) return 'آزاد';
  const raw = match[1].trim();
  if (raw.includes('تامین')) return 'تامین اجتماعی';
  if (raw.includes('خدمات') || raw.includes('سلامت')) return 'خدمات درمانی';
  if (raw.includes('مسلح')) return 'نیروهای مسلح';
  if (raw.includes('تکمیلی')) return 'بیمه تکمیلی';
  return 'آزاد';
}

/**
 * Normalizes Persian/Arabic characters and English/Persian digits for fuzzy robust search
 */
function normalizeQuery(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    'ي': 'ی', 'ك': 'ک', 'آ': 'ا', 'إ': 'ا', 'أ': 'ا',
    'ة': 'ه', 'ئ': 'ی', 'ء': ''
  };
  return str
    .toLowerCase()
    .replace(/[۰-۹٠-٩يكآإأةئء]/g, (ch) => map[ch] ?? ch)
    .replace(/[-_/\s\u200c]/g, '')
    .trim();
}

/**
 * Phonetic normalization for Persian homophones & duplicate letters to catch common spelling typos
 */
function normalizePhoneticPersian(str: string): string {
  const phoneticMap: Record<string, string> = {
    'ط': 'ت', 'ص': 'س', 'ث': 'س',
    'ذ': 'ز', 'ض': 'ز', 'ظ': 'ز',
    'غ': 'ق', 'ح': 'ه'
  };
  return normalizeQuery(str)
    .replace(/[طصثذضظغه]/g, (ch) => phoneticMap[ch] ?? ch)
    .replace(/(.)\1+/g, '$1');
}

/**
 * Optimal String Alignment (Damerau-Levenshtein) distance supporting insertions, deletions, substitutions, and adjacent transpositions
 */
function computeDamerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[m][n];
}

export interface FuzzyMatchResult {
  matched: boolean;
  score: number;
  isFuzzyTypo: boolean;
  matchedFieldLabel?: string;
}

function evaluateFuzzyField(queryNorm: string, targetRaw: string, maxTypos: number, fieldLabel: string): FuzzyMatchResult {
  const targetNorm = normalizeQuery(targetRaw);
  if (!targetNorm || !queryNorm) return { matched: false, score: 0, isFuzzyTypo: false };

  // 1. Direct exact or substring match
  if (targetNorm === queryNorm) {
    return { matched: true, score: 100, isFuzzyTypo: false, matchedFieldLabel: fieldLabel };
  }
  if (targetNorm.includes(queryNorm)) {
    return { matched: true, score: 95, isFuzzyTypo: false, matchedFieldLabel: fieldLabel };
  }

  // 2. Phonetic Persian match (e.g. کاذمی -> کاظمی, ساراا -> سارا)
  const qPhonetic = normalizePhoneticPersian(queryNorm);
  const tPhonetic = normalizePhoneticPersian(targetRaw);
  if (qPhonetic.length >= 2 && tPhonetic.includes(qPhonetic)) {
    return { matched: true, score: 86, isFuzzyTypo: true, matchedFieldLabel: `${fieldLabel} (هم‌آوا)` };
  }

  // 3. Sliding-window Damerau-Levenshtein typo tolerance
  if (queryNorm.length >= 3 && maxTypos > 0) {
    const winSizes = [
      Math.max(2, queryNorm.length - 1),
      queryNorm.length,
      Math.min(targetNorm.length, queryNorm.length + 1)
    ];
    let bestDist = Infinity;
    for (const wSize of winSizes) {
      if (wSize > targetNorm.length) continue;
      for (let i = 0; i <= targetNorm.length - wSize; i++) {
        const sub = targetNorm.slice(i, i + wSize);
        const dist = computeDamerauLevenshtein(queryNorm, sub);
        if (dist < bestDist) bestDist = dist;
        if (bestDist === 1) break;
      }
    }
    if (bestDist <= maxTypos) {
      return {
        matched: true,
        score: Math.max(60, 84 - bestDist * 10),
        isFuzzyTypo: true,
        matchedFieldLabel: `${fieldLabel} (اصلاح تایپی)`
      };
    }
  }

  return { matched: false, score: 0, isFuzzyTypo: false };
}

export function evaluateMultiFieldFuzzySearch(
  rawQuery: string,
  fields: Array<{ value?: string; label: string; maxTypos?: number }>
): FuzzyMatchResult {
  const q = normalizeQuery(rawQuery);
  if (!q) return { matched: true, score: 100, isFuzzyTypo: false };

  const defaultMaxTypos = q.length >= 5 ? 2 : q.length >= 3 ? 1 : 0;
  const candidates = fields
    .filter((f) => Boolean(f.value))
    .map((f) => evaluateFuzzyField(q, f.value || '', f.maxTypos ?? defaultMaxTypos, f.label))
    .filter((c) => c.matched);

  if (candidates.length === 0) return { matched: false, score: 0, isFuzzyTypo: false };
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export function evaluatePatientFuzzySearch(
  patient: Patient,
  rawQuery: string,
  scope: 'all' | 'name' | 'phone' | 'file' | 'national_id' = 'all'
): FuzzyMatchResult {
  const q = normalizeQuery(rawQuery);
  if (!q) return { matched: true, score: 100, isFuzzyTypo: false };

  const allowedNameTypos = q.length >= 5 ? 2 : q.length >= 3 ? 1 : 0;
  const allowedCodeTypos = q.length >= 4 ? 1 : 0;

  if (scope === 'name') return evaluateFuzzyField(q, patient.fullName, allowedNameTypos, 'نام بیمار');
  if (scope === 'phone') return evaluateFuzzyField(q, patient.phone, allowedCodeTypos, 'شماره تماس');
  if (scope === 'file') return evaluateFuzzyField(q, patient.fileNumber, 1, 'شماره پرونده');
  if (scope === 'national_id') return evaluateFuzzyField(q, patient.nationalId || '', allowedCodeTypos, 'کد ملی');

  const candidates = [
    evaluateFuzzyField(q, patient.fullName, allowedNameTypos, 'نام بیمار'),
    evaluateFuzzyField(q, patient.phone, allowedCodeTypos, 'شماره تماس'),
    evaluateFuzzyField(q, patient.nationalId || '', allowedCodeTypos, 'کد ملی'),
    evaluateFuzzyField(q, patient.fileNumber, 1, 'شماره پرونده')
  ].filter(c => c.matched);

  if (candidates.length === 0) return { matched: false, score: 0, isFuzzyTypo: false };
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export const HIGH_DEBT_FOLLOWUP_THRESHOLD = 5_000_000; // ۵ میلیون تومان

export interface PatientFinancialVisualStatus {
  needsFollowUp: boolean;
  tier: 'financial_followup' | 'debtor' | 'settled';
  badgeLabel: string;
  reasonLabel: string;
  badgeClass: string;
  dotClass: string;
  debtAmount: number;
  overdueInstallmentsCount: number;
  bouncedChecksCount: number;
}

export function getPatientFinancialVisualStatus(
  patient: Patient,
  summary360?: ReturnType<typeof analyzePatient360>
): PatientFinancialVisualStatus {
  const debtAmount = patient.balance < 0 ? Math.abs(patient.balance) : 0;
  const overdueInstallmentsCount =
    summary360?.overdueInstallmentsCount ??
    (patient.installments || []).filter((ins) => ins.status === 'overdue').length;
  const bouncedChecksCount =
    summary360?.bouncedChecksCount ??
    (patient.sayadChecks || []).filter((chk) => chk.status === 'bounced').length;
  const isHighDebt = debtAmount >= HIGH_DEBT_FOLLOWUP_THRESHOLD;
  const needsFollowUp = isHighDebt || overdueInstallmentsCount > 0 || bouncedChecksCount > 0;

  if (needsFollowUp) {
    const reasons: string[] = [];
    if (overdueInstallmentsCount > 0) reasons.push(`${toPersianDigits(overdueInstallmentsCount)} قسط معوق`);
    if (bouncedChecksCount > 0) reasons.push('چک برگشتی');
    if (isHighDebt) reasons.push('بدهی بالا');
    return {
      needsFollowUp: true,
      tier: 'financial_followup',
      badgeLabel: 'نیازمند پیگیری مالی',
      reasonLabel: reasons.join(' · ') || 'بدهی معوق',
      badgeClass: 'bg-rose-100 text-rose-950 border-rose-300 shadow-2xs',
      dotClass: 'bg-rose-600',
      debtAmount,
      overdueInstallmentsCount,
      bouncedChecksCount
    };
  }

  if (debtAmount > 0) {
    return {
      needsFollowUp: false,
      tier: 'debtor',
      badgeLabel: 'بدهکار جاری',
      reasonLabel: formatToman(debtAmount),
      badgeClass: 'bg-amber-50 text-amber-950 border-amber-300',
      dotClass: 'bg-amber-500',
      debtAmount,
      overdueInstallmentsCount: 0,
      bouncedChecksCount: 0
    };
  }

  return {
    needsFollowUp: false,
    tier: 'settled',
    badgeLabel: 'تسویه کامل',
    reasonLabel: 'خوش‌حساب ✓',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    dotClass: 'bg-emerald-500',
    debtAmount: 0,
    overdueInstallmentsCount: 0,
    bouncedChecksCount: 0
  };
}

export const PatientsListView: React.FC<PatientsListViewProps> = ({
  patients,
  appointments = [],
  onOpenPatientFile,
  onAddNewPatient,
  onUpdateFileNumber,
  onEditPatient,
  onDeletePatient,
  onOpenInvoice,
  onOpenPalmerChart,
  onQuickPayment,
  onQuickAddAppointment,
  onOpenPatientScanner,
  prefillPhone,
  onConsumePrefill,
  isManager = false
}) => {
  const { selection, impactLight, impactHeavy, success } = useHapticFeedback();
  const { getCardFeedbackClasses } = useActionFeedback();
  const recordSuccess = (opts: { title: string; targetRecordId?: string }) => actionFeedback.recordSuccess(opts);
  const initialWheelLock = React.useMemo(() => readPatientsWheelLock(), []);
  const [isWheelLocked, setIsWheelLocked] = useState<boolean>(() => Boolean(initialWheelLock));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'financial_followup' | 'with_appointment' | 'active_treatment' | 'debtors' | 'implants' | 'lab' | 'medical_alert'>(
    () => initialWheelLock?.activeFilter || 'all'
  );
  const [sortFilterMode, setSortFilterMode] = useState<'newest' | 'priority_followup' | 'alphabetical' | 'unpaid_balance' | 'last_visit'>(
    () => initialWheelLock?.sortFilterMode || 'newest'
  );
  const [advDebtFilter, setAdvDebtFilter] = useState<'all' | 'financial_followup' | 'any_debt' | 'high_debt' | 'overdue_installment' | 'settled'>(
    () => initialWheelLock?.advDebtFilter || 'all'
  );
  const [advLastVisitFilter, setAdvLastVisitFilter] = useState<'all' | 'upcoming' | 'recent_30d' | 'overdue_30d' | 'no_appointment'>(
    () => initialWheelLock?.advLastVisitFilter || 'all'
  );
  const [advTreatmentFilter, setAdvTreatmentFilter] = useState<'all' | 'implant' | 'endo' | 'prosthesis' | 'restorative' | 'pediatric' | 'extraction_scaling'>(
    () => initialWheelLock?.advTreatmentFilter || 'all'
  );
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsSendingPatientId, setSmsSendingPatientId] = useState<string | null>(null);
  const [editingFileNumberPatientId, setEditingFileNumberPatientId] = useState<string | null>(null);
  const [tempFileNumber, setTempFileNumber] = useState('');
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [swipedPatientId, setSwipedPatientId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showQrKioskModal, setShowQrKioskModal] = useState(false);

  // Long-Press Quick Action Context Menu State
  const [contextMenuPatient, setContextMenuPatient] = useState<Patient | null>(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const longPressTriggeredRef = React.useRef<boolean>(false);

  // Quick Appointment Sheet State (Triggered from Quick Action Context Menu)
  const [quickAptPatient, setQuickAptPatient] = useState<Patient | null>(null);
  const [quickAptTime, setQuickAptTime] = useState('۱۷:۱۵');
  const [quickAptUnit, setQuickAptUnit] = useState('یونیت آبی');
  const [quickAptDoctor, setQuickAptDoctor] = useState('دکتر مهدی امیری');
  const [quickAptTreatment, setQuickAptTreatment] = useState('معاینه و طرح درمان');
  const [quickAptConfirmStep, setQuickAptConfirmStep] = useState(false);
  const [printablePalmerPatient, setPrintablePalmerPatient] = useState<Patient | null>(null);

  // Real-time Predictive Search (3+ chars, debounced IndexedDB query)
  const [predictiveResults, setPredictiveResults] = useState<Patient[] | null>(null);
  const [isSearchingIndexedDb, setIsSearchingIndexedDb] = useState(false);

  // New patient form
  const [formFileNumber, setFormFileNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAge, setFormAge] = useState<number>(32);
  const [formGender, setFormGender] = useState<'مرد' | 'زن'>('مرد');
  const [formInsurance, setFormInsurance] = useState('آزاد');
  const [formMedicalAlerts, setFormMedicalAlerts] = useState<string[]>([]);
  const [formChiefComplaint, setFormChiefComplaint] = useState('');

  // Full Edit Patient Record Modal State
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editFileNumber, setEditFileNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState<number>(30);
  const [editGender, setEditGender] = useState<'مرد' | 'زن'>('مرد');
  const [editMedicalAlerts, setEditMedicalAlerts] = useState<string[]>([]);
  const [editCustomAlertInput, setEditCustomAlertInput] = useState('');
  const [editInsurance, setEditInsurance] = useState('آزاد');
  const [editNotes, setEditNotes] = useState('');
  const [confirmDeletePatientStep, setConfirmDeletePatientStep] = useState(false);

  useEscapeKey(showAddModal, () => setShowAddModal(false));
  useEscapeKey(showQrKioskModal, () => setShowQrKioskModal(false));
  useEscapeKey(Boolean(contextMenuPatient), () => setContextMenuPatient(null));
  useEscapeKey(Boolean(editingPatient), () => setEditingPatient(null));
  useEscapeKey(Boolean(quickAptPatient), () => setQuickAptPatient(null));
  useEscapeKey(Boolean(printablePalmerPatient), () => setPrintablePalmerPatient(null));

  React.useEffect(() => {
    if (!prefillPhone) return;
    setFormPhone(prefillPhone);
    setFormFileNumber(getNextFileNumber(getLatestFileNumber(patients)));
    setShowAddModal(true);
    onConsumePrefill?.();
  }, [prefillPhone, patients, onConsumePrefill]);

  const openEditPatientModal = (pat: Patient) => {
    impactLight();
    setEditingPatient(pat);
    setEditFileNumber(pat.fileNumber || '');
    setEditName(pat.fullName || '');
    setEditNationalId(pat.nationalId || '');
    setEditPhone(pat.phone || '');
    setEditAge(pat.age || 30);
    setEditGender(pat.gender || 'مرد');
    setEditMedicalAlerts(
      (pat.medicalHistory || []).filter(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim()))
    );
    setEditCustomAlertInput('');
    setEditInsurance(extractInsuranceFromNotes(pat.notes));
    setEditNotes(pat.notes || '');
    setConfirmDeletePatientStep(false);
  };

  const handleSaveEditedPatient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPatient || !editName.trim() || !editPhone.trim()) return;
    success();
    let syncedNotes = editNotes.trim();
    if (/بیمه:\s*[^\n|]+/.test(syncedNotes)) {
      syncedNotes = syncedNotes.replace(/بیمه:\s*[^\n|]+/, `بیمه: ${editInsurance}`);
    } else if (editInsurance !== 'آزاد') {
      syncedNotes = syncedNotes ? `${syncedNotes} | بیمه: ${editInsurance}` : `بیمه: ${editInsurance}`;
    }
    onEditPatient?.(editingPatient.id, {
      fileNumber: editFileNumber.trim() || editingPatient.fileNumber,
      fullName: editName.trim(),
      nationalId: editNationalId.trim() || editingPatient.nationalId,
      phone: editPhone.trim(),
      age: Number(editAge) || 30,
      gender: editGender,
      medicalHistory: editMedicalAlerts,
      notes: syncedNotes
    });
    setEditingPatient(null);
  };

  const medicalConditionOptions = [
    'دیابت قندی',
    'فشار خون بالا',
    'بیماری‌های قلبی عروقی',
    'حساسیت به پنی‌سیلین',
    'مصرف داروی ضدانعقاد (وارفارین/آسپیرین)',
    'بارداری',
    'هپاتیت / بیماری کبدی',
    'پوکی استخوان (مصرف بیفسفونات)'
  ];

  const toggleMedicalAlert = (cond: string) => {
    selection();
    if (formMedicalAlerts.includes(cond)) {
      setFormMedicalAlerts(formMedicalAlerts.filter(c => c !== cond));
    } else {
      setFormMedicalAlerts([...formMedicalAlerts, cond]);
    }
  };

  // Stats & Cross-Module Patient 360 + Financial Status Map
  const todayJalali = getCurrentPersianDate();
  const patient360Map = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof analyzePatient360>>();
    for (const p of patients) {
      map.set(p.id, analyzePatient360(p, appointments, todayJalali));
    }
    return map;
  }, [patients, appointments, todayJalali]);

  const financialStatusMap = React.useMemo(() => {
    const map = new Map<string, PatientFinancialVisualStatus>();
    for (const p of patients) {
      map.set(p.id, getPatientFinancialVisualStatus(p, patient360Map.get(p.id)));
    }
    return map;
  }, [patients, patient360Map]);

  const totalCount = patients.length;
  const debtors = patients.filter(p => p.balance < 0);
  const financialFollowUpPatients = patients.filter(p => Boolean(financialStatusMap.get(p.id)?.needsFollowUp));
  const totalDebtAmount = debtors.reduce((sum, p) => sum + Math.abs(p.balance), 0);
  const withAppointmentPatients = patients.filter(p => Boolean(patient360Map.get(p.id)?.nextAppointment));
  const activeTreatmentsTotal = patients.filter(p => p.activeTreatmentsCount > 0).length;
  const medicalAlertsPatients = patients.filter(p =>
    (p.medicalHistory || []).some(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim()))
  );
  const activeAdvancedFilterCount =
    (advDebtFilter !== 'all' ? 1 : 0) +
    (advLastVisitFilter !== 'all' ? 1 : 0) +
    (advTreatmentFilter !== 'all' ? 1 : 0) +
    (sortFilterMode !== 'newest' ? 1 : 0);

  const d3PatientCohortChart = React.useMemo(() => {
    const cohorts: Array<{
      id: 'all' | 'financial_followup' | 'with_appointment' | 'active_treatment' | 'implants' | 'lab' | 'medical_alert';
      label: string;
      count: number;
      color: string;
    }> = [
      { id: 'all', label: 'کل پرونده', count: totalCount, color: '#059669' },
      { id: 'financial_followup', label: 'پیگیری مالی', count: financialFollowUpPatients.length, color: '#e11d48' },
      { id: 'with_appointment', label: 'نوبت‌دار', count: withAppointmentPatients.length, color: '#0284c7' },
      { id: 'active_treatment', label: 'تحت درمان', count: activeTreatmentsTotal, color: '#0d9488' },
      { id: 'implants', label: 'ایمپلنت', count: patients.filter(p => (p.implantCases || []).length > 0).length, color: '#0891b2' },
      { id: 'lab', label: 'لابراتوار', count: patients.filter(p => (p.labOrders || []).length > 0).length, color: '#9333ea' },
      { id: 'medical_alert', label: 'هشدار پزشکی', count: medicalAlertsPatients.length, color: '#d97706' }
    ];
    const width = 460;
    const height = 112;
    const margin = { top: 14, right: 12, bottom: 24, left: 24 };
    const maxVal = Math.max(2, d3.max(cohorts, d => d.count) || 2);
    const xScale = d3
      .scaleBand<string>()
      .domain(cohorts.map(c => c.id))
      .range([margin.left, width - margin.right])
      .padding(0.28);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal])
      .nice()
      .range([height - margin.bottom, margin.top]);
    const baselineY = yScale(0);
    return {
      width,
      height,
      margin,
      baselineY,
      ticks: yScale.ticks(3).filter(t => Number.isInteger(t)),
      bars: cohorts.map(c => {
        const x = xScale(c.id) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(c.count);
        const h = Math.max(c.count > 0 ? 5 : 2, baselineY - y);
        return {
          ...c,
          x,
          y: baselineY - h,
          barW,
          h
        };
      })
    };
  }, [
    totalCount,
    financialFollowUpPatients.length,
    withAppointmentPatients.length,
    activeTreatmentsTotal,
    patients,
    medicalAlertsPatients.length
  ]);

  // Duplicate phone / fileNumber detector for New Patient Modal
  const duplicateMatchedPatient = React.useMemo(() => {
    const cleanPhone = formatIranianMobileClean(formPhone);
    const cleanFile = normalizeQuery(formFileNumber);
    if (cleanPhone.length >= 9) {
      const byPhone = patients.find(p => formatIranianMobileClean(p.phone) === cleanPhone);
      if (byPhone) return { patient: byPhone, reason: 'شماره تماس مشابه' };
    }
    if (cleanFile.length >= 2) {
      const byFile = patients.find(p => normalizeQuery(p.fileNumber) === cleanFile);
      if (byFile) return { patient: byFile, reason: 'شماره پرونده تکراری' };
    }
    return null;
  }, [formPhone, formFileNumber, patients]);

  const handleDispatchPatientServiceSms = async (patient: Patient, summary?: ReturnType<typeof analyzePatient360>) => {
    if (smsSendingPatientId === patient.id) return;
    impactLight();
    setSmsSendingPatientId(patient.id);
    try {
      const isDebtor = patient.balance < 0;
      const pattern = isDebtor ? 'installment_due' : 'appointment_reminder';
      const vars: Record<string, string> = isDebtor
        ? { amount: formatToman(Math.abs(patient.balance)), dueDate: todayJalali }
        : {
            date: summary?.nextAppointment?.date || todayJalali,
            time: summary?.nextAppointment?.time || 'هماهنگی پذیرش',
            doctor: summary?.nextAppointment?.doctor || 'دکتر مهدی امیری'
          };
      const res = await clinicalSmsService.sendPatternSms(patient.phone, patient.fullName, pattern, vars);
      success();
      actionFeedback.recordSuccess({
        title: isDebtor ? `پیامک یادآوری تسویه برای ${patient.fullName} ارسال شد` : `پیامک پیگیری/نوبت برای ${patient.fullName} ارسال شد`,
        subtitle: `شماره: ${toPersianDigits(patient.phone)} · کد رهگیری: ${res.refId}`,
        targetRecordId: patient.id,
        badgeText: '✓ پیامک مخابره شد'
      });
    } finally {
      setSmsSendingPatientId(null);
    }
  };

  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'phone' | 'file' | 'national_id'>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(50);
  const [callerIdOpen, setCallerIdOpen] = useState<boolean>(false);
  const [callerIdPhone, setCallerIdPhone] = useState<string>('');
  const [recallRadarOpen, setRecallRadarOpen] = useState<boolean>(false);
  const [expandAllCards, setExpandAllCards] = useState<boolean>(false);
  const [batchSmsSending, setBatchSmsSending] = useState<boolean>(false);
  const [cardSubTabMap, setCardSubTabMap] = useState<Record<string, 'treatments' | 'lab' | 'implant' | 'financial' | 'medical'>>({});
  const [cardQuickQuad, setCardQuickQuad] = useState<'UR' | 'UL' | 'LR' | 'LL'>('UR');
  const [cardQuickTooth, setCardQuickTooth] = useState<number>(6);
  const [cardQuickTreatment, setCardQuickTreatment] = useState<ToothCondition['treatment']>('composite');
  const [cardQuickDoctor, setCardQuickDoctor] = useState<string>('دکتر مهدی امیری');
  const [cardQuickLabWork, setCardQuickLabWork] = useState<string>('روکش زیرکونیا فول آناتومیک');
  const [cardQuickLabName, setCardQuickLabName] = useState<string>('لابراتوار دیجیتال پارس (ثابت)');
  const [cardQuickLabShade, setCardQuickLabShade] = useState<string>('A2');
  const [cardQuickImplantBrand, setCardQuickImplantBrand] = useState<string>('Straumann BLT (اشترومن سوئیس)');
  const [cardQuickPayMethod, setCardQuickPayMethod] = useState<'pos' | 'cash' | 'card_to_card'>('pos');
  const [cardQuickPayAmountMap, setCardQuickPayAmountMap] = useState<Record<string, number>>({});

  const normalizedSearch = normalizeQuery(searchQuery);

  // Debounced IndexedDB Predictive + Fuzzy Search (Triggers when >= 2 characters)
  React.useEffect(() => {
    if (normalizedSearch.length < 2) {
      setPredictiveResults(null);
      setIsSearchingIndexedDb(false);
      return;
    }

    let cancelled = false;
    setIsSearchingIndexedDb(true);
    const timer = window.setTimeout(async () => {
      try {
        const dbScope = searchScope === 'national_id' ? 'all' : searchScope;
        const res = await indexedDbService.searchPatientsPredictive(
          searchQuery,
          dbScope,
          patients,
          50
        );
        if (!cancelled) {
          setPredictiveResults(res);
          setIsSearchingIndexedDb(false);
        }
      } catch {
        if (!cancelled) {
          setPredictiveResults(null);
          setIsSearchingIndexedDb(false);
        }
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, normalizedSearch, searchScope, patients]);

  const startLongPress = (patient: Patient) => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      impactHeavy();
      setContextMenuPatient(patient);
    }, 430);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Evaluate fuzzy search match map across all patients
  const fuzzySearchMap = React.useMemo(() => {
    const map = new Map<string, FuzzyMatchResult>();
    if (normalizedSearch.length === 0) return map;
    for (const p of patients) {
      map.set(p.id, evaluatePatientFuzzySearch(p, searchQuery, searchScope));
    }
    return map;
  }, [patients, searchQuery, normalizedSearch, searchScope]);

  const filtered = React.useMemo(() => {
    const list = patients.filter(p => {
      const finStatus = financialStatusMap.get(p.id) || getPatientFinancialVisualStatus(p, patient360Map.get(p.id));
      const summary = patient360Map.get(p.id);

      // 1. Fuzzy Search Filter (works from 1+ chars for exact/substring and 2+ chars for fuzzy/typo)
      if (normalizedSearch.length >= 1) {
        const fz = fuzzySearchMap.get(p.id) || evaluatePatientFuzzySearch(p, searchQuery, searchScope);
        if (!fz.matched) return false;
      }

      // 2. Quick Chip Filter
      if (activeFilter === 'financial_followup' && !finStatus.needsFollowUp) return false;
      if (activeFilter === 'with_appointment' && !summary?.nextAppointment) return false;
      if (activeFilter === 'debtors' && p.balance >= 0) return false;
      if (activeFilter === 'active_treatment' && p.activeTreatmentsCount <= 0) return false;
      if (activeFilter === 'implants' && !(p.implantCases && p.implantCases.length > 0)) return false;
      if (activeFilter === 'lab' && !(p.labOrders && p.labOrders.length > 0)) return false;
      if (activeFilter === 'medical_alert') {
        const hasAlert = (p.medicalHistory || []).some(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim()));
        if (!hasAlert) return false;
      }

      // 3. Advanced Filter Axis 1: Debt & Financial Follow-Up
      if (advDebtFilter === 'financial_followup' && !finStatus.needsFollowUp) return false;
      if (advDebtFilter === 'any_debt' && p.balance >= 0) return false;
      if (advDebtFilter === 'high_debt' && finStatus.debtAmount < HIGH_DEBT_FOLLOWUP_THRESHOLD) return false;
      if (advDebtFilter === 'overdue_installment' && finStatus.overdueInstallmentsCount === 0 && finStatus.bouncedChecksCount === 0) return false;
      if (advDebtFilter === 'settled' && (p.balance < 0 || finStatus.needsFollowUp)) return false;

      // 4. Advanced Filter Axis 2: Last Appointment / Visit Recency
      if (advLastVisitFilter !== 'all') {
        const daysSinceLastVisit = p.lastVisit ? Math.max(0, diffPersianDays(p.lastVisit, todayJalali)) : 999;
        if (advLastVisitFilter === 'upcoming' && !summary?.nextAppointment) return false;
        if (advLastVisitFilter === 'recent_30d' && daysSinceLastVisit > 30) return false;
        if (advLastVisitFilter === 'overdue_30d' && daysSinceLastVisit <= 30) return false;
        if (advLastVisitFilter === 'no_appointment' && Boolean(summary?.nextAppointment)) return false;
      }

      // 5. Advanced Filter Axis 3: Treatment Type
      if (advTreatmentFilter !== 'all') {
        const condList = Object.values(p.teethConditions || {});
        const treatmentsSet = new Set(condList.map(c => c.treatment));
        if (advTreatmentFilter === 'implant') {
          if (!treatmentsSet.has('implant') && !(p.implantCases && p.implantCases.length > 0)) return false;
        } else if (advTreatmentFilter === 'endo') {
          if (!treatmentsSet.has('endo') && !treatmentsSet.has('pulpotomy') && !treatmentsSet.has('pulpectomy')) return false;
        } else if (advTreatmentFilter === 'prosthesis') {
          const hasProsthesis =
            treatmentsSet.has('crown_zirconia') ||
            treatmentsSet.has('crown_pfm') ||
            treatmentsSet.has('laminate') ||
            treatmentsSet.has('ss_crown') ||
            Boolean(p.labOrders && p.labOrders.length > 0);
          if (!hasProsthesis) return false;
        } else if (advTreatmentFilter === 'restorative') {
          if (!treatmentsSet.has('composite') && !treatmentsSet.has('amalgam') && !treatmentsSet.has('bleaching')) return false;
        } else if (advTreatmentFilter === 'pediatric') {
          const hasPedo =
            treatmentsSet.has('pulpotomy') ||
            treatmentsSet.has('pulpectomy') ||
            treatmentsSet.has('ss_crown') ||
            treatmentsSet.has('fissure_sealant') ||
            treatmentsSet.has('fluoride') ||
            treatmentsSet.has('space_maintainer');
          if (!hasPedo) return false;
        } else if (advTreatmentFilter === 'extraction_scaling') {
          if (!treatmentsSet.has('extraction') && !treatmentsSet.has('scaling')) return false;
        }
      }

      return true;
    });

    const sorted = [...list];
    if (normalizedSearch.length >= 2) {
      sorted.sort((a, b) => {
        const scoreA = fuzzySearchMap.get(a.id)?.score ?? 0;
        const scoreB = fuzzySearchMap.get(b.id)?.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.fullName.localeCompare(b.fullName, 'fa');
      });
    } else if (sortFilterMode === 'alphabetical') {
      sorted.sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
    } else if (sortFilterMode === 'unpaid_balance') {
      sorted.sort((a, b) => a.balance - b.balance);
    } else if (sortFilterMode === 'priority_followup') {
      sorted.sort((a, b) => {
        const finA = financialStatusMap.get(a.id)?.needsFollowUp ? 1 : 0;
        const finB = financialStatusMap.get(b.id)?.needsFollowUp ? 1 : 0;
        if (finB !== finA) return finB - finA;
        const prioA = patient360Map.get(a.id)?.priorityScore ?? 0;
        const prioB = patient360Map.get(b.id)?.priorityScore ?? 0;
        if (prioB !== prioA) return prioB - prioA;
        return a.balance - b.balance;
      });
    } else if (sortFilterMode === 'last_visit') {
      sorted.sort((a, b) => {
        const dA = a.lastVisit ? diffPersianDays(a.lastVisit, todayJalali) : 9999;
        const dB = b.lastVisit ? diffPersianDays(b.lastVisit, todayJalali) : 9999;
        return dA - dB;
      });
    } else {
      // 'newest': Sort by numeric file number descending
      sorted.sort((a, b) => {
        const numA = parseInt(toEnglishDigits(a.fileNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(toEnglishDigits(b.fileNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
        return numB - numA;
      });
    }
    return sorted;
  }, [
    patients,
    normalizedSearch,
    searchQuery,
    searchScope,
    fuzzySearchMap,
    sortFilterMode,
    activeFilter,
    advDebtFilter,
    advLastVisitFilter,
    advTreatmentFilter,
    financialStatusMap,
    patient360Map,
    todayJalali
  ]);

  const callerIdClean = formatIranianMobileClean(callerIdPhone);
  const callerMatchedPatient = React.useMemo(() => {
    if (callerIdClean.length < 4) return null;
    return (
      patients.find(p => formatIranianMobileClean(p.phone) === callerIdClean) ||
      patients.find(p => formatIranianMobileClean(p.phone).endsWith(callerIdClean) || formatIranianMobileClean(p.phone).includes(callerIdClean)) ||
      null
    );
  }, [callerIdClean, patients]);

  const filteredCohortDebt = React.useMemo(
    () => filtered.reduce((sum, p) => sum + (p.balance < 0 ? Math.abs(p.balance) : 0), 0),
    [filtered]
  );

  const handleBatchCohortSms = async () => {
    if (batchSmsSending || filtered.length === 0) return;
    impactHeavy();
    setBatchSmsSending(true);
    try {
      const targetPatients = filtered.slice(0, 25);
      for (const p of targetPatients) {
        const isDebtor = p.balance < 0;
        const summary = patient360Map.get(p.id);
        await clinicalSmsService.sendPatternSms(
          p.phone,
          p.fullName,
          isDebtor ? 'installment_due' : 'appointment_reminder',
          isDebtor
            ? { amount: formatToman(Math.abs(p.balance)), dueDate: todayJalali }
            : {
                date: summary?.nextAppointment?.date || todayJalali,
                time: summary?.nextAppointment?.time || 'هماهنگی پذیرش',
                doctor: summary?.nextAppointment?.doctor || 'دکتر مهدی امیری'
              }
        );
      }
      success();
      actionFeedback.recordSuccess({
        title: `ارسال پیامک گروهی هوشمند برای ${toPersianDigits(targetPatients.length)} بیمار انجام شد`,
        subtitle: `لیست فعلی (${activeFilter === 'all' ? 'همه بیماران فیلترشده' : 'فیلتر منتخب'}) · تاریخ: ${toPersianDigits(todayJalali)}`,
        badgeText: '✓ پیامک گروهی ارسال شد'
      });
    } finally {
      setBatchSmsSending(false);
    }
  };

  const handleExportCohortCsv = () => {
    selection();
    const headers = ['شماره پرونده', 'نام و نام خانوادگی', 'کد ملی', 'شماره تماس', 'سن', 'جنسیت', 'کل هزینه (تومان)', 'پرداختی (تومان)', 'مانده حساب (تومان)', 'وضعیت مالی', 'درمان‌های فعال', 'آخرین مراجعه'];
    const rows = filtered.map(p => {
      const fin = financialStatusMap.get(p.id) || getPatientFinancialVisualStatus(p, patient360Map.get(p.id));
      return [
        p.fileNumber,
        p.fullName,
        p.nationalId,
        p.phone,
        String(p.age),
        p.gender,
        String(p.totalCost),
        String(p.paidAmount),
        String(p.balance),
        fin.badgeLabel,
        String(p.activeTreatmentsCount),
        p.lastVisit
      ].map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `minadental-patients-${toEnglishDigits(todayJalali).replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback in non-browser test environments
    }
    success();
    actionFeedback.recordSuccess({
      title: `خروجی اکسل (CSV) لیست بیماران آماده شد`,
      subtitle: `تعداد رکورد: ${toPersianDigits(filtered.length)} پرونده · کدگذاری UTF-8 فارسی`,
      badgeText: '✓ خروجی اکسل دانلود شد'
    });
  };

  const handleOpenAddModal = () => {
    impactHeavy();
    const nextNum = getNextFileNumber(getLatestFileNumber(patients));
    setFormFileNumber(nextNum);
    setShowAddModal(true);
  };

  // Auto-Save Draft Recovery on Modal Open
  React.useEffect(() => {
    if (showAddModal) {
      const draft = autoSaveManager.getDraft<{
        formName: string;
        formPhone: string;
        formNationalId: string;
        formAge: number;
        formGender: 'مرد' | 'زن';
        formInsurance: string;
        formMedicalAlerts: string[];
        formChiefComplaint: string;
      }>('new_patient_draft');
      if (draft && draft.data) {
        if (draft.data.formName && !formName) setFormName(draft.data.formName);
        if (draft.data.formPhone && !formPhone) setFormPhone(draft.data.formPhone);
        if (draft.data.formNationalId && !formNationalId) setFormNationalId(draft.data.formNationalId);
        if (draft.data.formAge) setFormAge(draft.data.formAge);
        if (draft.data.formGender) setFormGender(draft.data.formGender);
        if (draft.data.formInsurance) setFormInsurance(draft.data.formInsurance);
        if (draft.data.formMedicalAlerts) setFormMedicalAlerts(draft.data.formMedicalAlerts);
        if (draft.data.formChiefComplaint) setFormChiefComplaint(draft.data.formChiefComplaint);
      }
    }
  }, [showAddModal]);

  // Persist draft on user typing
  React.useEffect(() => {
    if (formName || formPhone || formNationalId || formChiefComplaint) {
      autoSaveManager.saveDraft('new_patient_draft', {
        formName, formPhone, formNationalId, formAge, formGender, formInsurance, formMedicalAlerts, formChiefComplaint
      }, 'پیش‌نویس پرونده بیمار جدید', 'patients');
    }
  }, [formName, formPhone, formNationalId, formAge, formGender, formInsurance, formMedicalAlerts, formChiefComplaint]);

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName || !formPhone) return;

    success();
    autoSaveManager.clearDraft('new_patient_draft');
    const finalFileNumber = formFileNumber.trim() || getNextFileNumber(getLatestFileNumber(patients));
    recordLastFileNumber(finalFileNumber);

    onAddNewPatient({
      fullName: formName,
      fileNumber: finalFileNumber,
      nationalId: formNationalId || '۰۰۱۲۳۴۵۶۷۸',
      phone: formPhone,
      age: Number(formAge) || 30,
      gender: formGender,
      medicalHistory: formMedicalAlerts,
      notes: formChiefComplaint ? `علت مراجعه: ${formChiefComplaint} | بیمه: ${formInsurance}` : `بیمه: ${formInsurance}`
    });

    setShowAddModal(false);
    setFormName('');
    setFormPhone('');
    setFormNationalId('');
    setFormMedicalAlerts([]);
    setFormChiefComplaint('');
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-2 select-none">
      {/* Ultra-Compact iOS 27 Enterprise Header with Chips, Slide-Over Drawers & Drum-Roll Wheel (غربیلکی) */}
      <div className="relative z-20 mx-2 mt-1.5 min-w-0">
        <div className={getModuleHeaderCardClasses('emerald')}>
          {/* Row 1: Compact Single-Line Title + Quick Tool Chips (Zero Multi-Row Wrapping on Mobile) */}
          <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-emerald-200/70 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <div className="w-8 h-8 rounded-[11px] bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-2xs shrink-0">
                <Users className="w-4 h-4 stroke-[2.25]" />
              </div>
              <h3 className="font-black text-xs sm:text-sm text-slate-950 leading-none truncate">پرونده بیماران</h3>
              <span className="px-1.5 py-0.5 rounded-lg bg-emerald-100/90 text-emerald-900 border border-emerald-200 text-[10px] font-mono font-black shrink-0">
                {toPersianDigits(filtered.length)}/{toPersianDigits(totalCount)}
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
              {/* Animated Search Magnifying Glass Toggle */}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[34px] min-h-[34px] px-2 rounded-[10px] flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 ${
                  searchOpen ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجوی پیش‌بینانه در بیماران"
                aria-label="جستجوی پیش‌بینانه در بیماران"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.25]" />
              </button>

              {/* iOS 27 Drum-Roll Wheel (غربیلکی) & Advanced Filter Drawer Button */}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setFilterMenuOpen(!filterMenuOpen);
                }}
                className={`min-h-[34px] px-2 rounded-[10px] font-black text-[11px] flex items-center gap-1 border transition-all active:scale-95 cursor-pointer shrink-0 ${
                  filterMenuOpen || activeAdvancedFilterCount > 0
                    ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="فیلتر پیشرفته غربیلکی بر اساس بدهکاری، آخرین نوبت و نوع درمان"
              >
                <Filter className="w-3 h-3" />
                <span>فیلتر پیشرفته</span>
                {activeAdvancedFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white text-teal-900 font-mono text-[9.5px] font-black">
                    {toPersianDigits(activeAdvancedFilterCount)}
                  </span>
                )}
              </button>

              {/* Incoming Call / Caller-ID Smart Triage Toggle */}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setCallerIdOpen(prev => !prev);
                }}
                className={`min-h-[34px] px-2 rounded-[10px] font-black text-[11px] flex items-center gap-1 border transition-all active:scale-95 cursor-pointer shrink-0 ${
                  callerIdOpen
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                }`}
                title="تشخیص هوشمند تماس ورودی بیمار و پیشنهاد خودکار نوبت‌دهی (Caller ID)"
              >
                <PhoneIncoming className="w-3 h-3" />
                <span>تماس ورودی</span>
              </button>

              {/* Waiting Room Self-Anamnesis QR Kiosk Button */}
              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setShowQrKioskModal(true);
                }}
                className="min-h-[34px] px-2 rounded-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-[11px] flex items-center gap-1 border border-emerald-200 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
                title="کیوسک دیجیتال خودپذیرش سالن انتظار"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>QR</span>
              </button>

              {onOpenPatientScanner && (
                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    onOpenPatientScanner();
                  }}
                  className="min-h-[34px] px-2 rounded-[10px] bg-violet-50 hover:bg-violet-100 text-violet-900 font-black text-[11px] flex items-center gap-1 border border-violet-200 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
                  title="اسکن مستقیم QR / بارکد کارت پذیرش یا قبض بیمار"
                >
                  <QrCode className="w-3 h-3 text-violet-600" />
                  <span>اسکن پرونده</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Inline New Patient CTA + Horizontal Scrollable Multi-Color Chip Bar */}
          <div className="flex items-center gap-1.5 pt-0.5 min-w-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="min-h-[36px] px-2.5 rounded-[11px] bg-[#c8ff00] hover:bg-[#bbf000] text-black font-black text-[11.5px] flex items-center gap-1 border border-lime-400/70 shadow-2xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="تشکیل پرونده بیمار جدید"
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>پذیرش جدید</span>
            </button>
            <div role="tablist" aria-label="بخش‌های ماژول بیماران" className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
              {[
                { id: 'all', label: `همه (${toPersianDigits(totalCount)})` },
                { id: 'financial_followup', label: `نیازمند پیگیری مالی (${toPersianDigits(financialFollowUpPatients.length)})` },
                { id: 'with_appointment', label: `نوبت‌دار (${toPersianDigits(withAppointmentPatients.length)})` },
                { id: 'active_treatment', label: `تحت درمان (${toPersianDigits(activeTreatmentsTotal)})` },
                { id: 'debtors', label: `بدهکاران (${toPersianDigits(debtors.length)})` },
                { id: 'implants', label: 'کاشت ایمپلنت' },
                { id: 'lab', label: 'لابراتوار و روکش' },
                { id: 'medical_alert', label: `هشدار پزشکی (${toPersianDigits(medicalAlertsPatients.length)})` }
              ].map((chip, idx) => (
                <button
                  role="tab"
                  aria-selected={activeFilter === chip.id}
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setActiveFilter(chip.id as any);
                  }}
                  className={getUnifiedChipClasses(idx, activeFilter === chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Ultra-Compact Single-Line Horizontal Scrollable iOS 27 Wheel KPI & Cohort Tools Rail (Zero Vertical Stacking) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap pt-0.5 tabular-nums">
            <button
              type="button"
              onClick={() => { selection(); setActiveFilter('all'); }}
              className={`px-2 py-1 rounded-xl border text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'all' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black' : 'bg-slate-50/90 border-slate-200/80 text-slate-700 font-bold hover:bg-emerald-50/50'
              }`}
            >
              <span className="text-slate-500">کل پرونده‌ها</span>
              <span className="font-mono font-black text-slate-900">{toPersianDigits(totalCount)} پرونده</span>
            </button>

            <button
              type="button"
              onClick={() => { selection(); setActiveFilter('with_appointment'); }}
              className={`px-2 py-1 rounded-xl border text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'with_appointment' ? 'bg-sky-50 border-sky-300 text-sky-950 font-black' : 'bg-slate-50/90 border-slate-200/80 text-slate-700 font-bold hover:bg-sky-50/50'
              }`}
            >
              <span className="text-slate-500">بیماران نوبت‌دار</span>
              <span className="font-mono font-black text-sky-800">{toPersianDigits(withAppointmentPatients.length)} بیمار فعال</span>
            </button>

            <button
              type="button"
              onClick={() => { selection(); setActiveFilter('financial_followup'); }}
              className={`px-2 py-1 rounded-xl border text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'financial_followup' || activeFilter === 'debtors'
                  ? 'bg-rose-50 border-rose-300 text-rose-950 font-black'
                  : 'bg-slate-50/90 border-slate-200/80 text-slate-700 font-bold hover:bg-rose-50/50'
              }`}
            >
              <span className="text-rose-800">نیازمند پیگیری مالی ({toPersianDigits(financialFollowUpPatients.length)})</span>
              <span className="font-mono font-black text-rose-700">{formatToman(totalDebtAmount)}</span>
            </button>

            <button
              type="button"
              onClick={() => { selection(); setActiveFilter('medical_alert'); }}
              className={`px-2 py-1 rounded-xl border text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'medical_alert' ? 'bg-amber-50 border-amber-300 text-amber-950 font-black' : 'bg-slate-50/90 border-slate-200/80 text-slate-700 font-bold hover:bg-amber-50/50'
              }`}
            >
              <span className="text-slate-500">هشدار سیستمیک/آلرژی</span>
              <span className="font-mono font-black text-amber-800">{toPersianDigits(medicalAlertsPatients.length)} پرونده حساس</span>
            </button>

            <span className="h-4 w-px bg-emerald-200/80 shrink-0 mx-0.5" />

            <button
              type="button"
              onClick={() => {
                selection();
                setRecallRadarOpen(prev => !prev);
              }}
              className={`px-2.5 py-1 rounded-xl border text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 ${
                recallRadarOpen
                  ? 'bg-purple-600 text-white border-purple-700'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
              }`}
              title="رادار فراخوان هوشمند بیماران نیازمند تحویل پروتز، مرحله ایمپلنت یا چکاپ دوره‌ای"
            >
              <Sparkles className="w-3 h-3" />
              <span>رادار فراخوان هوشمند</span>
            </button>

            <button
              type="button"
              disabled={batchSmsSending || filtered.length === 0}
              onClick={handleBatchCohortSms}
              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
              title="ارسال پیامک گروهی هوشمند به لیست فیلترشده"
            >
              <Send className="w-3 h-3 text-emerald-600" />
              <span>{batchSmsSending ? 'در حال مخابره...' : `پیامک گروهی (${toPersianDigits(filtered.length)})`}</span>
            </button>

            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={handleExportCohortCsv}
              className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
              title="دانلود خروجی اکسل (CSV) از لیست بیماران فیلترشده"
            >
              <Download className="w-3 h-3 text-sky-600" />
              <span>خروجی اکسل (CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setExpandAllCards(prev => !prev);
              }}
              className={`px-2.5 py-1 rounded-xl border text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 ${
                expandAllCards
                  ? 'bg-teal-600 text-white border-teal-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="باز کردن یا جمع کردن همزمان تمام کارت‌های بیماران"
            >
              {expandAllCards ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{expandAllCards ? 'جمع کردن کارت‌ها' : 'باز کردن همه کارت‌ها'}</span>
            </button>
          </div>

          {/* Live Incoming Call / Caller-ID Triage Drawer */}
          {callerIdOpen && (
            <div className="p-2.5 rounded-2xl bg-gradient-to-l from-indigo-50/90 via-white to-emerald-50/70 border border-indigo-200/90 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                  <PhoneIncoming className="w-4 h-4 text-indigo-600" />
                  <span>پاپ‌آپ هوشمند تماس ورودی (Caller-ID) و پیشنهاد خودکار نوبت‌دهی</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {patients.slice(0, 2).map((sampleP) => (
                    <button
                      key={sampleP.id}
                      type="button"
                      onClick={() => {
                        selection();
                        setCallerIdPhone(sampleP.phone);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold cursor-pointer"
                    >
                      شبیه‌سازی تماس {sampleP.fullName}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      setCallerIdPhone('۰۹۱۲۹۹۸۸۷۷۶');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold cursor-pointer"
                  >
                    شبیه‌سازی تماس بیمار جدید (بدون پرونده)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="tel"
                  dir="ltr"
                  aria-label="شماره تماس ورودی بیمار"
                  placeholder="شماره تماس ورودی را وارد کنید (مثلاً 09123456789)..."
                  value={callerIdPhone}
                  onChange={(e) => setCallerIdPhone(e.target.value)}
                  className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-500"
                />
                {callerIdPhone && (
                  <button
                    type="button"
                    onClick={() => setCallerIdPhone('')}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    پاک کردن
                  </button>
                )}
              </div>

              {callerIdClean.length >= 4 && (
                callerMatchedPatient ? (
                  (() => {
                    const matchedSummary = patient360Map.get(callerMatchedPatient.id);
                    const matchedFin = financialStatusMap.get(callerMatchedPatient.id) || getPatientFinancialVisualStatus(callerMatchedPatient, matchedSummary);
                    return (
                      <div className="p-2 rounded-xl bg-white border border-emerald-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1 text-right">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black">
                              ✓ پرونده شناسایی شد
                            </span>
                            <span className="text-xs font-black text-slate-950">{callerMatchedPatient.fullName}</span>
                            <span className="text-[10.5px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              پرونده: {callerMatchedPatient.fileNumber}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${matchedFin.badgeClass}`}>
                              {callerMatchedPatient.balance < 0
                                ? `${matchedFin.badgeLabel}: ${formatToman(Math.abs(callerMatchedPatient.balance))}`
                                : 'حساب تسویه ✓'}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-slate-600 flex items-center gap-2 flex-wrap">
                            <span>آخرین مراجعه: {toPersianDigits(callerMatchedPatient.lastVisit)}</span>
                            <span>·</span>
                            <span>
                              {matchedSummary?.nextAppointment
                                ? `نوبت فعلی: ${toPersianDigits(matchedSummary.nextAppointment.date)} ساعت ${toPersianDigits(matchedSummary.nextAppointment.time)}`
                                : 'پیشنهاد هوشمند: رزرو نوبت معاینه / ادامه طرح درمان'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              impactHeavy();
                              setQuickAptPatient(callerMatchedPatient);
                              setQuickAptTime('۱۷:۳۰');
                              setQuickAptTreatment(
                                matchedSummary?.readyLabOrders[0]
                                  ? `تحویل پروتز ${matchedSummary.readyLabOrders[0].workType}`
                                  : 'معاینه و ادامه درمان'
                              );
                              setQuickAptConfirmStep(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>پیشنهاد تعیین نوبت فوری</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenPatientFile(callerMatchedPatient, 'treatments');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-black cursor-pointer active:scale-95"
                          >
                            باز کردن پرونده
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-2 rounded-xl bg-amber-50/90 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5 text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[10px] font-black">
                          شماره جدید — بدون پرونده قبلی
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900" dir="ltr">
                          {toPersianDigits(callerIdPhone)}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-amber-900 font-bold">
                        پیشنهاد خودکار سیستم: تشکیل سریع پرونده با همین شماره و تعیین نوبت معاینه اولیه
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          impactHeavy();
                          const nextNum = getNextFileNumber(getLatestFileNumber(patients));
                          setFormFileNumber(nextNum);
                          setFormPhone(toPersianDigits(callerIdPhone));
                          setShowAddModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>تشکیل پرونده + نوبت خودکار</span>
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* iOS 27 Drum-Roll Wheel (غربیلکی) & Slide-Over Multi-Dimensional Filter Drawer */}
          {filterMenuOpen && (
            <div className="p-2.5 rounded-2xl bg-gradient-to-b from-teal-50/95 via-white to-emerald-50/80 border border-teal-300/90 space-y-2 animate-in slide-in-from-top-1 duration-150 shadow-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-black text-teal-950">
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-600" />
                  <span>انتخابگر غربیلکی و کشویی iOS 27 (بدهکاری، آخرین نوبت، نوع درمان)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeAdvancedFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setAdvDebtFilter('all');
                        setAdvLastVisitFilter('all');
                        setAdvTreatmentFilter('all');
                        setSortFilterMode('newest');
                      }}
                      className="px-2 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-[10px] font-black cursor-pointer"
                    >
                      پاک کردن فیلترها
                    </button>
                  )}
                  {isWheelLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        try {
                          localStorage.removeItem(PATIENTS_WHEEL_LOCK_KEY);
                        } catch {}
                        setIsWheelLocked(false);
                        setActiveFilter('all');
                        setSortFilterMode('newest');
                        setAdvDebtFilter('all');
                        setAdvLastVisitFilter('all');
                        setAdvTreatmentFilter('all');
                        recordSuccess({ title: 'قفل چیدمان غربیلکی iOS 27 باز و پیش‌فرض شد ✓' });
                      }}
                      className="px-2 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>باز کردن قفل</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      success();
                      try {
                        localStorage.setItem(
                          PATIENTS_WHEEL_LOCK_KEY,
                          JSON.stringify({
                            activeFilter,
                            sortFilterMode,
                            advDebtFilter,
                            advLastVisitFilter,
                            advTreatmentFilter,
                            lockedAt: new Date().toISOString()
                          })
                        );
                      } catch {}
                      setIsWheelLocked(true);
                      recordSuccess({ title: 'چیدمان و فیلتر غربیلکی در حافظه iOS 27 قفل و ذخیره شد ✓' });
                      setFilterMenuOpen(false);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Lock className="w-3 h-3" />
                    <span>{isWheelLocked ? 'بروزرسانی قفل iOS 27 ✓' : 'قفل و ذخیره iOS 27 ✓'}</span>
                  </button>
                </div>
              </div>

              {/* Compact iOS 27 Drum-Roll Wheel Rails + Accessible Selects */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                {/* Axis 1: Debt / Financial Status Filter */}
                <div className="bg-white/95 p-2 rounded-xl border border-teal-200/80 space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block">۱. غربیلکی بدهکاری و حساب:</label>
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 snap-x snap-mandatory">
                    {[
                      { v: 'all', l: 'همه' },
                      { v: 'financial_followup', l: 'پیگیری مالی' },
                      { v: 'any_debt', l: 'بدهکاران' },
                      { v: 'high_debt', l: '+۵ میلیون' },
                      { v: 'overdue_installment', l: 'قسط معوق' },
                      { v: 'settled', l: 'تسویه کامل' }
                    ].map(item => (
                      <button
                        key={item.v}
                        type="button"
                        onClick={() => { selection(); setAdvDebtFilter(item.v as any); }}
                        className={`snap-center shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer border transition-all ${
                          advDebtFilter === item.v ? 'bg-teal-600 text-white border-teal-700 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {item.l}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="فیلتر بر اساس بدهکاری"
                    value={advDebtFilter}
                    onChange={(e) => {
                      selection();
                      setAdvDebtFilter(e.target.value as any);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10.5px] font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                  >
                    <option value="all">همه وضعیت‌های مالی</option>
                    <option value="financial_followup">نیازمند پیگیری مالی (بدهی بالا / قسط معوق)</option>
                    <option value="any_debt">همه بدهکاران مطب</option>
                    <option value="high_debt">بدهکاری بالا (+۵ میلیون تومان)</option>
                    <option value="overdue_installment">دارای قسط معوق یا چک برگشتی</option>
                    <option value="settled">تسویه کامل (خوش‌حساب)</option>
                  </select>
                </div>

                {/* Axis 2: Last Appointment / Visit Recency Filter */}
                <div className="bg-white/95 p-2 rounded-xl border border-teal-200/80 space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block">۲. غربیلکی آخرین نوبت:</label>
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 snap-x snap-mandatory">
                    {[
                      { v: 'all', l: 'همه زمان‌ها' },
                      { v: 'upcoming', l: 'نوبت آینده' },
                      { v: 'recent_30d', l: 'مراجعه اخیر' },
                      { v: 'overdue_30d', l: '+۳۰ روز عدم مراجعه' },
                      { v: 'no_appointment', l: 'بدون نوبت' }
                    ].map(item => (
                      <button
                        key={item.v}
                        type="button"
                        onClick={() => { selection(); setAdvLastVisitFilter(item.v as any); }}
                        className={`snap-center shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer border transition-all ${
                          advLastVisitFilter === item.v ? 'bg-teal-600 text-white border-teal-700 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {item.l}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="فیلتر بر اساس آخرین نوبت"
                    value={advLastVisitFilter}
                    onChange={(e) => {
                      selection();
                      setAdvLastVisitFilter(e.target.value as any);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10.5px] font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                  >
                    <option value="all">همه زمان‌های مراجعه</option>
                    <option value="upcoming">دارای نوبت امروز یا آینده</option>
                    <option value="recent_30d">مراجعه اخیر (کمتر از ۳۰ روز)</option>
                    <option value="overdue_30d">عدم مراجعه طولانی (+۳۰ روز / فراخوان)</option>
                    <option value="no_appointment">بدون نوبت رزروشده آینده</option>
                  </select>
                </div>

                {/* Axis 3: Treatment Type Filter */}
                <div className="bg-white/95 p-2 rounded-xl border border-teal-200/80 space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block">۳. غربیلکی نوع درمان:</label>
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 snap-x snap-mandatory">
                    {[
                      { v: 'all', l: 'همه درمان‌ها' },
                      { v: 'implant', l: 'ایمپلنت' },
                      { v: 'endo', l: 'درمان ریشه' },
                      { v: 'prosthesis', l: 'روکش و پروتز' },
                      { v: 'restorative', l: 'ترمیم و زیبایی' },
                      { v: 'pediatric', l: 'اطفال' },
                      { v: 'extraction_scaling', l: 'جراحی/جرم‌گیری' }
                    ].map(item => (
                      <button
                        key={item.v}
                        type="button"
                        onClick={() => { selection(); setAdvTreatmentFilter(item.v as any); }}
                        className={`snap-center shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer border transition-all ${
                          advTreatmentFilter === item.v ? 'bg-teal-600 text-white border-teal-700 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {item.l}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="فیلتر بر اساس نوع درمان"
                    value={advTreatmentFilter}
                    onChange={(e) => {
                      selection();
                      setAdvTreatmentFilter(e.target.value as any);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10.5px] font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                  >
                    <option value="all">همه انواع درمان</option>
                    <option value="implant">کاشت ایمپلنت و جراحی فک</option>
                    <option value="endo">درمان ریشه (عصب‌کشی تخصصی)</option>
                    <option value="prosthesis">روکش زیرکونیا، لمینت و پروتز</option>
                    <option value="restorative">ترمیم کامپوزیت، آمالگام و بلیچینگ</option>
                    <option value="pediatric">دندانپزشکی اطفال (پالپوتومی/SSC)</option>
                    <option value="extraction_scaling">کشیدن دندان و جرم‌گیری</option>
                  </select>
                </div>
              </div>

              {/* Sort Mode Wheel Rail */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-teal-200/70">
                <span className="text-[10px] font-black text-teal-900 shrink-0">غربیلکی اولویت:</span>
                {[
                  { id: 'newest', label: 'جدیدترین پرونده‌ها' },
                  { id: 'priority_followup', label: 'اولویت پیگیری مالی/درمان' },
                  { id: 'unpaid_balance', label: `بیشترین بدهی (${toPersianDigits(debtors.length)})` },
                  { id: 'last_visit', label: 'آخرین نوبت / مراجعه' },
                  { id: 'alphabetical', label: 'حروف الفبا (آ-ی)' }
                ].map((opt) => {
                  const isActive = sortFilterMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        selection();
                        setSortFilterMode(opt.id as any);
                      }}
                      className={`py-1 px-2.5 rounded-xl text-[10px] font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-teal-100/60 border border-teal-200/70'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Animated Expandable Fuzzy & Predictive Search Bar */}
          {searchOpen && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
              <div className="relative">
                <Search className="w-4 h-4 text-emerald-600 absolute right-3 top-2" />
                <input
                  type="text"
                  autoFocus
                  aria-label="جستجوی فازی نام، شماره تماس، کد ملی یا شماره پرونده"
                  placeholder={
                    searchScope === 'name' ? 'جستجوی فازی نام بیمار (حتی با غلط تایپی، مثلاً: ساراا یا کاذمی)...' :
                    searchScope === 'phone' ? 'بخشی از شماره تماس همراه (مثلاً: ۰۹۱۲ یا ۱۲۳۴)...' :
                    searchScope === 'national_id' ? 'بخشی از کد ملی ۱۰ رقمی بیمار...' :
                    searchScope === 'file' ? 'شماره پرونده (مثلاً: ۱۰۴۸)...' :
                    'جستجوی هوشمند فازی (نام، بخشی از موبایل، کد ملی یا پرونده حتی با غلط تایپی)...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 focus:border-emerald-500 rounded-xl pr-9 pl-9 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="پاک کردن جستجو"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-2 w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5 stroke-[3]" />
                  </button>
                )}
              </div>

              {/* Filter Scopes & Fuzzy Status */}
              <div className="flex items-center justify-between gap-2 text-[10px] overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-slate-400 font-bold shrink-0">دامنه جستجوی فازی:</span>
                  {(['all', 'name', 'phone', 'national_id', 'file'] as const).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => {
                        selection();
                        setSearchScope(scope);
                      }}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        searchScope === scope ? 'bg-emerald-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {scope === 'all' ? 'همه موارد' : scope === 'name' ? 'نام' : scope === 'phone' ? 'شماره تماس' : scope === 'national_id' ? 'کد ملی' : 'پرونده'}
                    </button>
                  ))}
                </div>

                {normalizedSearch.length >= 1 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                    {isSearchingIndexedDb ? 'در حال جستجوی فازی...' : `${toPersianDigits(filtered.length)} پرونده منطبق (پشتیبانی غلط تایپی ✓)`}
                  </span>
                )}
              </div>

              {/* Real-Time Fuzzy & Predictive Suggestions Dropdown */}
              {normalizedSearch.length >= 2 && filtered.length > 0 && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-2 space-y-1.5 max-h-48 overflow-y-auto overscroll-contain shadow-inner">
                  <div className="flex items-center justify-between px-1 text-[10px] font-black text-emerald-800">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>پیشنهادهای فازی و پیش‌بینانه آنی:</span>
                    </span>
                    <span>مقاوم در برابر غلط املایی و تایپی</span>
                  </div>
                  {filtered.slice(0, 5).map(sug => {
                    const fzInfo = fuzzySearchMap.get(sug.id);
                    const sugFin = financialStatusMap.get(sug.id);
                    return (
                      <div
                        key={sug.id}
                        onClick={() => {
                          selection();
                          onOpenPatientFile(sug);
                        }}
                        className="p-2 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-100 flex items-center justify-between gap-2 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                            {sug.fullName.charAt(0)}
                          </span>
                          <div className="min-w-0 text-right">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900 truncate">{sug.fullName}</span>
                              <span className="text-[10px] font-mono text-emerald-700">({toPersianDigits(sug.fileNumber)})</span>
                              {fzInfo?.isFuzzyTypo && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-black">
                                  تطابق فازی · {fzInfo.matchedFieldLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {toPersianDigits(sug.phone)} · کدملی: {toPersianDigits(sug.nationalId)} · {sugFin?.badgeLabel}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`tel:${sug.phone}`}
                            className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                            title="تماس فوری"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              setQuickAptPatient(sug);
                              setQuickAptConfirmStep(false);
                            }}
                            className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer"
                            title="ثبت نوبت جدید"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              if (onQuickPayment) onQuickPayment(sug);
                              else onOpenPatientFile(sug, 'financial');
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                            title="ثبت دریافتی"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Smart Clinical Recall & Follow-Up Radar Drawer */}
      {recallRadarOpen && (
        <div className="mx-2 p-3 rounded-2xl bg-gradient-to-l from-purple-50/90 via-white to-cyan-50/80 border border-purple-200/90 shadow-2xs space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>لیست اولویت فراخوان هوشمند (آماده تحویل پروتز، موعد ایمپلنت یا ادامه طرح درمان بدون نوبت)</span>
            </span>
            <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
              پیشنهاد هوشمند پیگیری بالینی
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {patients
              .filter((p) => {
                const s360 = patient360Map.get(p.id);
                return (
                  (s360 && s360.readyLabOrders.length > 0) ||
                  (s360 && s360.activeImplants.length > 0) ||
                  (p.activeTreatmentsCount > 0 && !s360?.nextAppointment)
                );
              })
              .slice(0, 6)
              .map((recPat) => {
                const s360 = patient360Map.get(recPat.id);
                const recallReason = s360?.readyLabOrders[0]
                  ? `تحویل پروتز ${s360.readyLabOrders[0].workType} (${s360.readyLabOrders[0].toothNumber})`
                  : s360?.activeImplants[0]
                    ? `موعد ایمپلنت ${s360.activeImplants[0].brand} (${s360.activeImplants[0].toothNumber})`
                    : `ادامه طرح درمان فعال (${toPersianDigits(recPat.activeTreatmentsCount)} دندان)`;

                return (
                  <div
                    key={recPat.id}
                    className="p-2.5 rounded-xl bg-white border border-purple-200/80 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 text-right">
                      <span className="text-xs font-black text-slate-900 block truncate">{recPat.fullName}</span>
                      <span className="text-[10px] font-bold text-purple-800 block truncate">{recallReason}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDispatchPatientServiceSms(recPat, s360)}
                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black cursor-pointer"
                      >
                        پیامک فراخوان
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          impactLight();
                          setQuickAptPatient(recPat);
                          setQuickAptTreatment(recallReason);
                          setQuickAptConfirmStep(false);
                        }}
                        className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black cursor-pointer"
                      >
                        تعیین نوبت
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Interactive D3.js Patient Cohort & Clinical Risk Funnel */}
      <div
        data-testid="patients-d3-cohort-panel"
        className="mx-2 p-2.5 rounded-[20px] bg-white border border-emerald-200/80 shadow-[var(--shadow-card)] space-y-1.5"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-black text-slate-900">
              نمودار توزیع کوهورت پرونده‌ها (D3.js — کلیک جهت فیلتر)
            </span>
          </div>
          <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 tabular-nums">
            نمایش: {toPersianDigits(filtered.length)} از {toPersianDigits(totalCount)} پرونده
          </span>
        </div>

        <svg
          data-testid="patients-d3-cohort-svg"
          viewBox={`0 0 ${d3PatientCohortChart.width} ${d3PatientCohortChart.height}`}
          className="w-full h-[106px] overflow-visible select-none"
          role="img"
          aria-label="نمودار توزیع کوهورت بیماران کلینیک"
        >
          {d3PatientCohortChart.ticks.map(t => {
            const ty = d3PatientCohortChart.baselineY - ((t / Math.max(2, d3.max(d3PatientCohortChart.bars, b => b.count) || 2)) * (d3PatientCohortChart.baselineY - d3PatientCohortChart.margin.top));
            return (
              <line
                key={`pat-grid-${t}`}
                x1={d3PatientCohortChart.margin.left}
                x2={d3PatientCohortChart.width - d3PatientCohortChart.margin.right}
                y1={ty}
                y2={ty}
                stroke="#e2e8f0"
                strokeDasharray="2 2"
                strokeWidth={1}
              />
            );
          })}
          <line
            x1={d3PatientCohortChart.margin.left}
            x2={d3PatientCohortChart.width - d3PatientCohortChart.margin.right}
            y1={d3PatientCohortChart.baselineY}
            y2={d3PatientCohortChart.baselineY}
            stroke="#cbd5e1"
            strokeWidth={1.2}
          />
          {d3PatientCohortChart.bars.map(bar => {
            const isSelected = activeFilter === bar.id;
            return (
              <g
                key={bar.id}
                onClick={() => {
                  selection();
                  setActiveFilter(bar.id);
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
                  opacity={activeFilter === 'all' || isSelected ? 0.92 : 0.35}
                  stroke={isSelected ? '#0f172a' : 'none'}
                  strokeWidth={isSelected ? 1.5 : 0}
                />
                <text
                  x={bar.x + bar.barW / 2}
                  y={Math.max(10, bar.y - 3)}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={900}
                  fill="#0f172a"
                >
                  {toPersianDigits(bar.count)}
                </text>
                <text
                  x={bar.x + bar.barW / 2}
                  y={d3PatientCohortChart.height - 6}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={isSelected ? 900 : 700}
                  fill={isSelected ? '#047857' : '#475569'}
                >
                  {bar.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Patients List (Virtual Windowed Rendering for 500,000 Records) */}
      <div className="mx-2 grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
            بیماری با این مشخصات یافت نشد.
          </div>
        ) : (
          filtered.slice(0, visibleLimit).map((patient, cardIdx) => {
            const isExpanded = expandAllCards || expandedPatientId === patient.id;
            const activeCardSubTab = cardSubTabMap[patient.id] || 'treatments';
            const summary360 = patient360Map.get(patient.id);
            const finVisual = financialStatusMap.get(patient.id) || getPatientFinancialVisualStatus(patient, summary360);
            const fuzzyMatchInfo = normalizedSearch.length >= 2 ? fuzzySearchMap.get(patient.id) : undefined;
            const teethEntries = Object.entries(patient.teethConditions || {});
            const hasImplant = patient.implantCases && patient.implantCases.length > 0;
            const hasLab = patient.labOrders && patient.labOrders.length > 0;
            const activeImplant = hasImplant ? patient.implantCases[0] : null;
            const activeLab = hasLab ? patient.labOrders[0] : null;
            const realMedicalAlerts = (patient.medicalHistory || []).filter(
              m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim())
            );
            const smsFollowUpBody = patient.balance < 0
              ? `سلام ${patient.fullName} عزیز، یادآوری تسویه مانده حساب کلینیک مینادنتال به مبلغ ${formatToman(Math.abs(patient.balance))}.`
              : summary360?.nextAppointment
                ? `سلام ${patient.fullName} عزیز، یادآوری نوبت کلینیک مینادنتال در تاریخ ${toPersianDigits(summary360.nextAppointment.date)} ساعت ${toPersianDigits(summary360.nextAppointment.time)}.`
                : `سلام ${patient.fullName} عزیز، جهت پیگیری وضعیت درمان در کلینیک تخصصی مینادنتال در خدمتتان هستیم.`;

            // Distinct visual theme per card with crisp hairline precision + semantic right accent
            const isDebtor = patient.balance < 0;
            const cardVisualTheme = finVisual.needsFollowUp
              ? {
                  frame: 'border border-rose-300/95 border-r-[4px] border-r-rose-600 bg-gradient-to-l from-rose-50/60 via-white to-white',
                  badgeBg: 'bg-rose-600 text-white shadow-rose-500/20',
                  avatarBg: 'bg-rose-50 border-rose-200 text-rose-800',
                  statusLabel: 'نیازمند پیگیری مالی',
                  dotColor: 'bg-rose-600'
                }
              : isDebtor
              ? {
                  frame: 'border border-amber-200/90 border-r-[3px] border-r-amber-500 bg-gradient-to-l from-amber-50/40 via-white to-white',
                  badgeBg: 'bg-amber-600 text-white shadow-amber-500/20',
                  avatarBg: 'bg-amber-50 border-amber-200 text-amber-800',
                  statusLabel: 'بدهکار جاری',
                  dotColor: 'bg-amber-500'
                }
              : hasImplant || hasLab
                ? {
                    frame: 'border border-purple-200/90 border-r-[3px] border-r-purple-500 bg-gradient-to-l from-purple-50/40 via-white to-white',
                    badgeBg: 'bg-purple-600 text-white shadow-purple-500/20',
                    avatarBg: 'bg-purple-50 border-purple-200 text-purple-800',
                    statusLabel: hasImplant ? 'کاشت ایمپلنت' : 'پروتز لابراتوار',
                    dotColor: 'bg-purple-500'
                  }
                : cardIdx % 2 === 0
                  ? {
                      frame: 'border border-emerald-200/90 border-r-[3px] border-r-emerald-500 bg-gradient-to-l from-emerald-50/40 via-white to-white',
                      badgeBg: 'bg-emerald-600 text-white shadow-emerald-500/20',
                      avatarBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                      statusLabel: 'تسویه کامل',
                      dotColor: 'bg-emerald-500'
                    }
                  : {
                      frame: 'border border-sky-200/90 border-r-[3px] border-r-sky-500 bg-gradient-to-l from-sky-50/40 via-white to-white',
                      badgeBg: 'bg-sky-600 text-white shadow-sky-500/20',
                      avatarBg: 'bg-sky-50 border-sky-200 text-sky-800',
                      statusLabel: 'پرونده فعال',
                      dotColor: 'bg-sky-500'
                    };

            return (
              <div
                key={patient.id}
                dir="rtl"
                onContextMenu={(e) => {
                  e.preventDefault();
                  impactHeavy();
                  setContextMenuPatient(patient);
                }}
                onMouseDown={() => startLongPress(patient)}
                onMouseUp={clearLongPress}
                onMouseLeave={clearLongPress}
                onTouchStart={(e) => {
                  setTouchStartX(e.touches[0].clientX);
                  startLongPress(patient);
                }}
                onTouchMove={() => clearLongPress()}
                onTouchEnd={(e) => {
                  clearLongPress();
                  if (touchStartX === null) return;
                  const deltaX = e.changedTouches[0].clientX - touchStartX;
                  if (Math.abs(deltaX) > 55) {
                    selection();
                    setSwipedPatientId(prev => prev === patient.id ? null : patient.id);
                  }
                  setTouchStartX(null);
                }}
                className={`rounded-[20px] transition-all text-right relative overflow-hidden ${cardVisualTheme.frame} ${
                  isExpanded
                    ? 'p-3.5 space-y-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.14)] ring-2 ring-teal-500/40'
                    : 'px-3 py-2.5 shadow-[0_3px_10px_rgba(15,23,42,0.05)] hover:shadow-[0_6px_16px_rgba(15,23,42,0.09)]'
                } ${getCardFeedbackClasses(patient.id)}`}
              >
                {/* Swipe Quick-Actions Bar (Revealed on Horizontal Swipe) */}
                {swipedPatientId === patient.id && (
                  <div className="flex items-center justify-between gap-1.5 p-2 mb-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={`tel:${patient.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>تماس</span>
                      </a>
                      <a
                        href={buildNativeSmsHref(patient.phone, smsFollowUpBody)}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>پیام</span>
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickAptPatient(patient);
                          setQuickAptConfirmStep(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#c8ff00] text-slate-950 flex items-center gap-1 cursor-pointer"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>نوبت جدید</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onQuickPayment) onQuickPayment(patient);
                          else onOpenPatientFile(patient, 'financial');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white text-emerald-900 flex items-center gap-1 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>دریافت وجه</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSwipedPatientId(null);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-black/20 text-white text-[10px] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* =========================================================================
                    COLLAPSED DEFAULT HEADER (نمای دوسطری تمیز کیوبانک + نشانگر وضعیت بصری مانده حساب)
                    Clicking anywhere here toggles the card expansion for fast list scrolling!
                   ========================================================================= */}
                <div 
                  onClick={() => {
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false;
                      return;
                    }
                    selection();
                    setExpandedPatientId(isExpanded ? null : patient.id);
                  }}
                  className="cursor-pointer select-none space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Right Side: Visual Row Marker + Patient Full Name + File Number + Visual Balance Status Badge */}
                    <div className="flex items-center gap-2.5 text-right min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-xl border font-black text-sm flex items-center justify-center shadow-2xs ${cardVisualTheme.avatarBg}`}>
                          {patient.fullName.charAt(0)}
                        </div>
                        <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-4.5 px-1 rounded-full text-[9.5px] font-black font-mono tabular-nums flex items-center justify-center shadow-xs border border-white ${cardVisualTheme.badgeBg}`}>
                          {toPersianDigits(cardIdx + 1)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-[14.5px] sm:text-[15.5px] font-black text-slate-900 text-right leading-snug break-words">
                            {patient.fullName}
                          </h4>
                          <span className="text-[11px] font-mono tabular-nums font-black text-emerald-900">
                            #{patient.fileNumber}
                          </span>
                          {/* Visual Colored Balance Status Indicator (نیازمند پیگیری مالی / بدهکار جاری / تسویه کامل) */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${finVisual.badgeClass}`}
                            title={`${finVisual.badgeLabel} (${finVisual.reasonLabel})`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${finVisual.dotClass}`} />
                            <span>{finVisual.badgeLabel}</span>
                            {finVisual.needsFollowUp && (
                              <span className="text-[9.5px] opacity-85 font-mono">({finVisual.reasonLabel})</span>
                            )}
                          </span>
                          {fuzzyMatchInfo?.isFuzzyTypo && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-black">
                              تطابق فازی ({fuzzyMatchInfo.matchedFieldLabel})
                            </span>
                          )}
                          {realMedicalAlerts.length > 0 && (
                            <span title={`هشدار پزشکی: ${realMedicalAlerts.join('، ')}`} className="inline-flex items-center shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            </span>
                          )}
                        </div>

                        {/* Quiet Unboxed Typographic Metadata Line */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold text-slate-500 mt-0.5 tabular-nums">
                          <span className="font-mono text-slate-700" dir="ltr">{toPersianDigits(patient.phone)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{toPersianDigits(patient.age)} ساله</span>
                          <span aria-hidden="true">·</span>
                          <span className={finVisual.needsFollowUp ? 'text-rose-700 font-black font-mono' : isDebtor ? 'text-amber-800 font-black font-mono' : 'text-emerald-700 font-black'}>
                            {isDebtor ? `بدهی ${formatToman(Math.abs(patient.balance))}` : 'تسویه'}
                          </span>
                          {summary360?.nextAppointment && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-sky-700 font-black font-mono">
                                نوبت {toPersianDigits(summary360.nextAppointment.date)} {toPersianDigits(summary360.nextAppointment.time)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Left Side: Expand/Collapse Trigger + Quick File Jump */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          impactLight();
                          onOpenPatientFile(patient);
                        }}
                        className="min-h-[38px] px-2.5 py-1 rounded-[12px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/90 text-[10.5px] font-black hidden sm:flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                        title="باز کردن سریع پرونده کامل"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                        <span>پرونده</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selection();
                          setExpandedPatientId(isExpanded ? null : patient.id);
                        }}
                        className={`min-h-[38px] px-2.5 py-1 rounded-[12px] border text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                          isExpanded
                            ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                            : 'bg-slate-100/90 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border-slate-200/90'
                        }`}
                        title={isExpanded ? 'بستن جزئیات بیمار' : 'مشاهده جزئیات ضروری و بالینی بیمار'}
                      >
                        <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" /> : <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Inline Mutation / Change Confirmation Badge */}
                <CardMutationBadge recordId={patient.id} />

                {/* =========================================================================
                    EXPANDED ESSENTIAL & CLINICAL DETAILS (باز شدن جزئیات ضروری با کلیک)
                   ========================================================================= */}
                {isExpanded && (
                  <div className="pt-2.5 mt-2 border-t-2 border-dashed border-slate-200/90 space-y-2.5 animate-in fade-in duration-200">
                    
                    {/* Essential Demographics & Direct Communication Dock (تماس / پیام / سرویس پیامک / واتساپ) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2 flex-wrap tabular-nums">
                          <span className="font-mono font-black text-slate-900" dir="ltr">{toPersianDigits(patient.phone)}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span>{toPersianDigits(patient.age)} ساله ({patient.gender})</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            آخرین مراجعه: {toPersianDigits(patient.lastVisit)}
                          </span>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-black font-mono tabular-nums ${finVisual.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${finVisual.dotClass}`} />
                          <span>
                            {patient.balance < 0 ? `${finVisual.badgeLabel}: ${formatToman(Math.abs(patient.balance))}` : 'تسویه کامل ✓'}
                          </span>
                        </span>
                      </div>

                      {/* Automatic Financial Follow-Up Action Strip (For High Debt / Overdue Installments / Bounced Checks) */}
                      {finVisual.needsFollowUp && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-1.5 rounded-xl bg-rose-50/90 border border-rose-200 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 font-black text-rose-950">
                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                            <span>وضعیت حساب: نیازمند پیگیری مالی ({finVisual.reasonLabel})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDispatchPatientServiceSms(patient, summary360)}
                              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black cursor-pointer"
                            >
                              ارسال اخطار پیامکی
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (onQuickPayment) onQuickPayment(patient);
                                else onOpenPatientFile(patient, 'financial');
                              }}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black cursor-pointer"
                            >
                              تسویه / کیف پول
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 1-Tap Direct Comm Dock */}
                      <div className="grid grid-cols-4 gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${formatIranianMobileClean(patient.phone)}`}
                          className="min-h-[38px] px-2 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10.5px] font-black flex items-center justify-center gap-1 transition-colors active:scale-95"
                          title="تماس تلفنی مستقیم"
                        >
                          <Phone className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>تماس</span>
                        </a>
                        <a
                          href={buildNativeSmsHref(patient.phone, smsFollowUpBody)}
                          className="min-h-[38px] px-2 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10.5px] font-black flex items-center justify-center gap-1 transition-colors active:scale-95"
                          title="ارسال پیامک مستقیم از گوشی"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>پیام</span>
                        </a>
                        <button
                          type="button"
                          disabled={smsSendingPatientId === patient.id}
                          onClick={() => handleDispatchPatientServiceSms(patient, summary360)}
                          className="min-h-[38px] px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10.5px] font-black flex items-center justify-center gap-1 transition-colors active:scale-95 cursor-pointer disabled:opacity-60"
                          title="ارسال آنی پیامک خدماتی/پیگیری از پنل کلینیک"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{smsSendingPatientId === patient.id ? 'ارسال...' : 'سرویس پیامک'}</span>
                        </button>
                        <a
                          href={buildWhatsAppHref(patient.phone, smsFollowUpBody)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[38px] px-2 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-[10.5px] font-black flex items-center justify-center gap-1 transition-colors active:scale-95"
                          title="گفتگو در واتساپ"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>واتساپ</span>
                        </a>
                      </div>

                      {/* Cross-Module Next Appointment / Ready Prosthesis Strip */}
                      {(summary360?.nextAppointment || (summary360 && summary360.readyLabOrders.length > 0)) && (
                        <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-1.5 rounded-xl bg-indigo-50/75 border border-indigo-200/85 text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                            <CalendarCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {summary360?.nextAppointment ? (
                              <span>
                                نوبت آینده: <span className="font-mono font-black">{toPersianDigits(summary360.nextAppointment.date)} · {toPersianDigits(summary360.nextAppointment.time)}</span> ({summary360.nextAppointment.unit})
                              </span>
                            ) : (
                              <span>{toPersianDigits(summary360?.readyLabOrders.length || 0)} پروتز آماده تحویل (بدون نوبت رزروشده)</span>
                            )}
                          </div>
                          {!summary360?.nextAppointment && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickAptPatient(patient);
                                setQuickAptTreatment(`تحویل پروتز ${summary360?.readyLabOrders[0]?.workType || ''}`);
                                setQuickAptConfirmStep(false);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black cursor-pointer"
                            >
                              رزرو نوبت تحویل
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded Tier 1: File Number Inline Editor + Edit / Open Full Modal / Context Menu */}
                    <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-2 rounded-xl bg-slate-50/95 border border-slate-200/85">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {editingFileNumberPatientId === patient.id ? (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-cyan-500 shadow-xs"
                          >
                            <input aria-label="شماره پرونده بیمار"
                              type="text"
                              value={tempFileNumber}
                              onChange={(e) => setTempFileNumber(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const trimmed = tempFileNumber.trim();
                                  if (trimmed && onUpdateFileNumber) {
                                    onUpdateFileNumber(patient.id, trimmed);
                                    recordLastFileNumber(trimmed);
                                  }
                                  setEditingFileNumberPatientId(null);
                                }
                                if (e.key === 'Escape') setEditingFileNumberPatientId(null);
                              }}
                              className="w-20 px-1.5 py-0.5 text-[11px] font-mono font-bold text-cyan-900 bg-cyan-50 rounded outline-none border border-cyan-200"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const trimmed = tempFileNumber.trim();
                                if (trimmed && onUpdateFileNumber) {
                                  onUpdateFileNumber(patient.id, trimmed);
                                  recordLastFileNumber(trimmed);
                                }
                                setEditingFileNumberPatientId(null);
                              }}
                              className="p-1 rounded bg-[#c8ff00] text-black hover:opacity-90 active:scale-95 cursor-pointer"
                              title="ذخیره شماره پرونده"
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFileNumberPatientId(null);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFileNumberPatientId(patient.id);
                              setTempFileNumber(patient.fileNumber || '');
                            }}
                            className="text-[11px] text-slate-700 hover:text-cyan-700 font-mono font-bold bg-white hover:bg-cyan-50 border border-slate-200/90 hover:border-cyan-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-2xs"
                            title="ویرایش دستی شماره پرونده"
                          >
                            <span>ویرایش شماره پرونده: {patient.fileNumber}</span>
                            <Edit3 className="w-2.5 h-2.5 text-slate-400" />
                          </span>
                        )}
                        <TrackableIdBadge recordId={patient.id} moduleKey="patients" variant="emerald" />
                      </div>

                      {/* Utility Action Buttons: Open Full Modal, Edit Profile, 3-Dots Menu */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            impactLight();
                            onOpenPatientFile(patient);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                          title="باز کردن پرونده جامع بیمار"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>پرونده کامل</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPatientModal(patient);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200/90 text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                          title="ویرایش کامل مشخصات و سوابق پرونده بیمار"
                        >
                          <Edit3 className="w-3 h-3 text-cyan-700" />
                          <span>ویرایش</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            impactHeavy();
                            setContextMenuPatient(patient);
                          }}
                          aria-label={`عملیات سریع پرونده ${patient.fullName}`}
                          className="min-w-[38px] min-h-[38px] rounded-[12px] bg-white hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                          title="عملیات سریع پرونده"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Medical alert badge if real medical alert exists */}
                    {realMedicalAlerts.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-50/90 px-2.5 py-1.5 rounded-xl border border-amber-200/80 text-right">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-bold shrink-0">سوابق پزشکی:</span>
                        <span className="break-words">{realMedicalAlerts.join('، ')}</span>
                      </div>
                    )}

                    {/* 2. Streamlined Quick Action Bar (2x2 Mobile Thumb Grid / 4-Col Desktop) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {/* Primary Action 1: چارت پالمر */}
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          impactLight();
                          if (onOpenPalmerChart) onOpenPalmerChart(patient);
                          else onOpenPatientFile(patient, 'treatments');
                        }}
                        className="py-2 sm:py-1.5 px-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200/90 text-[11.5px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap min-h-[38px]"
                        title="ثبت یا مشاهده چارت دندانی پالمر"
                      >
                        <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>چارت پالمر</span>
                      </button>

                      {/* Primary Action 2: لابراتوار */}
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          impactLight();
                          onOpenPatientFile(patient, 'lab');
                        }}
                        className={`py-2 sm:py-1.5 px-2.5 rounded-xl text-[11.5px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border whitespace-nowrap min-h-[38px] ${
                          hasLab 
                            ? 'bg-purple-50 text-purple-900 border-purple-200/90' 
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200/90'
                        }`}
                      >
                        <FlaskConical className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>لابراتوار ({toPersianDigits(patient.labOrders?.length || 0)})</span>
                      </button>

                      {/* Primary Action 3: ایمپلنت */}
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          impactLight();
                          onOpenPatientFile(patient, 'implant');
                        }}
                        className={`py-2 sm:py-1.5 px-2.5 rounded-xl text-[11.5px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border whitespace-nowrap min-h-[38px] ${
                          hasImplant 
                            ? 'bg-cyan-50 text-cyan-900 border-cyan-200/90' 
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200/90'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span>ایمپلنت ({toPersianDigits(patient.implantCases?.length || 0)})</span>
                      </button>

                      {/* Primary Action 4: مالی و اقساط */}
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          impactLight();
                          onOpenPatientFile(patient, 'financial');
                        }}
                        className="py-2 sm:py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/90 text-[11.5px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap min-h-[38px]"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>مالی و اقساط</span>
                      </button>
                    </div>

                    {/* 5-Step 360° Patient Journey Pipeline (نوار روند ۵ گامی ۳۶۰ درجه روی کارت بیمار - نمایش کامل در موبایل) */}
                    <div className="patient-360-journey-bar bg-gradient-to-l from-slate-50 via-teal-50/40 to-emerald-50/40 p-2.5 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-black text-slate-800 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>مسیر ۳۶۰ درجه پرونده بیمار</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            impactLight();
                            setPrintablePalmerPatient(patient);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 text-[10.5px] font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                          title="چاپ رسمی طرح درمان و چارت پالمر A4 با مهر دکتر مهدی امیری"
                        >
                          <Printer className="w-3 h-3 text-teal-700 shrink-0" />
                          <span>چاپ پرونده A4 پالمر</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                        {[
                          {
                            step: 1,
                            label: '۱. پذیرش',
                            done: true,
                            active: false,
                            onClick: () => onOpenPatientFile(patient, 'treatments')
                          },
                          {
                            step: 2,
                            label: '۲. چارت پالمر',
                            done: teethEntries.length > 0 || patient.activeTreatmentsCount > 0,
                            active: teethEntries.length > 0 && !hasLab && !hasImplant,
                            onClick: () => (onOpenPalmerChart ? onOpenPalmerChart(patient) : onOpenPatientFile(patient, 'treatments'))
                          },
                          {
                            step: 3,
                            label: '۳. پروتز/کاشت',
                            done: hasLab || hasImplant,
                            active: hasLab || hasImplant,
                            onClick: () => onOpenPatientFile(patient, hasImplant ? 'implant' : 'lab')
                          },
                          {
                            step: 4,
                            label: '۴. تسویه مالی',
                            done: patient.balance >= 0,
                            active: patient.balance < 0,
                            onClick: () => onOpenPatientFile(patient, 'financial')
                          },
                          {
                            step: 5,
                            label: '۵. پیگیری',
                            done: patient.balance >= 0 && (teethEntries.length > 0 || hasImplant || hasLab),
                            active: false,
                            onClick: () => setQuickAptPatient(patient)
                          }
                        ].map((jStep) => (
                          <button
                            key={jStep.step}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selection();
                              jStep.onClick();
                            }}
                            className={`py-1.5 px-2 rounded-xl border text-[10.5px] sm:text-[11px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 whitespace-nowrap min-h-[34px] ${
                              jStep.active
                                ? 'bg-teal-600 text-white border-teal-700 shadow-2xs ring-1 ring-teal-300'
                                : jStep.done
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-full text-center">{jStep.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Secondary Quick Chips (Rx & Official Invoice) + Micro Dental Arch Map */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            impactLight();
                            onOpenPatientFile(patient, 'prescriptions');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/90 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Pill className="w-3 h-3 text-emerald-600" />
                          <span>نسخه دارویی</span>
                        </button>
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            impactLight();
                            if (onOpenInvoice) onOpenInvoice(patient);
                            else onOpenPatientFile(patient, 'financial');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-sky-600" />
                          <span>چاپ فاکتور رسمی</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selection();
                            scheduleEntityReminder({
                              sourceType: patient.balance < 0 ? 'payment' : 'recall',
                              sourceId: patient.id,
                              patientId: patient.id,
                              patientName: patient.fullName,
                              patientPhone: patient.phone,
                              title: patient.balance < 0
                                ? `پیگیری تسویه حساب ${patient.fullName}`
                                : `یادآور پیگیری بالینی ${patient.fullName}`,
                              description: patient.balance < 0
                                ? `مانده حساب: ${formatToman(Math.abs(patient.balance))}`
                                : `پرونده ${patient.fileNumber} · چکاپ و ادامه درمان`,
                              targetDate: todayJalali,
                              targetView: 'patients',
                              config: {
                                enabled: true,
                                preset: '1d_before',
                                channels: ['phone_push', 'in_app']
                              }
                            });
                            actionFeedback.recordSuccess({
                              title: `یادآور هوشمند برای ${patient.fullName} ثبت شد`,
                              subtitle: `در مرکز یادآوری و اعلان گوشی با ۱ لمس همگام شد`,
                              targetRecordId: patient.id,
                              badgeText: '✓ یادآور ثبت شد'
                            });
                          }}
                          className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                          title="ثبت یادآور هوشمند پیگیری پرونده"
                        >
                          <BellRing className="w-3 h-3 text-amber-600" />
                          <span>ثبت یادآور</span>
                        </button>
                      </div>

                      {teethEntries.length > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            impactLight();
                            if (onOpenPalmerChart) onOpenPalmerChart(patient);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:border-emerald-300"
                        >
                          <span className="text-[10px] font-bold text-slate-600">دندان‌ها:</span>
                          <div className="flex items-center gap-1" dir="ltr">
                            {teethEntries.map(([tKey, cond]) => (
                              <span
                                key={tKey}
                                className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-black bg-emerald-100 text-emerald-900 border border-emerald-300"
                              >
                                {cond.quadrant}{cond.toothNumber}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Live Interactive Clinical Timeline Progress Line (خط روند تعاملی و واکنش‌پذیر بیمار روی کارت) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-black text-slate-800 flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5 text-cyan-600" />
                          <span>خط روند تعاملی درمان بیمار ({toPersianDigits(patient.activeTreatmentsCount)} مورد — کلیک جهت تغییر مرحله)</span>
                        </span>
                        <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full">
                          {hasImplant ? 'پروتکل ایمپلنت' : hasLab ? 'پروتکل لابراتوار' : 'درمان‌های کلینیکی'}
                        </span>
                      </div>

                      {/* Interactive Visual Step Indicator */}
                      {hasImplant ? (
                        <div className="grid grid-cols-5 gap-1 pt-1 text-center">
                          {[
                            { label: 'کاشت فیکسچر', step: 'fixture_placed' as const },
                            { label: 'هیلینگ کپ', step: 'healing_cap' as const },
                            { label: 'قالب‌گیری', step: 'impression' as const },
                            { label: 'فریم و اباتمنت', step: 'abutment_framework' as const },
                            { label: 'تحویل روکش', step: 'crown_delivered' as const }
                          ].map((st, i) => {
                            const stages = ['fixture_placed', 'healing_cap', 'impression', 'abutment_framework', 'crown_delivered'];
                            const currentIndex = stages.indexOf(activeImplant?.currentStage || 'fixture_placed');
                            const isPastOrCurrent = i <= currentIndex;
                            const isCurrent = i === currentIndex;

                            return (
                              <button
                                key={st.step}
                                type="button"
                                onClick={() => {
                                  if (!activeImplant) return;
                                  selection();
                                  const nextCases = (patient.implantCases || []).map((ic) =>
                                    ic.id === activeImplant.id ? { ...ic, currentStage: st.step } : ic
                                  );
                                  onEditPatient?.(patient.id, { implantCases: nextCases });
                                  recordSuccess({ title: `مرحله ایمپلنت ${patient.fullName} به «${st.label}» ارتقا یافت ✓`, targetRecordId: patient.id });
                                }}
                                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
                                title={`تغییر مرحله ایمپلنت به ${st.label}`}
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-all ${
                                  isCurrent 
                                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-300 shadow-xs' 
                                    : isPastOrCurrent 
                                    ? 'bg-cyan-100 text-cyan-800 group-hover:bg-cyan-200' 
                                    : 'bg-slate-200 text-slate-500 group-hover:bg-cyan-50'
                                }`}>
                                  {isPastOrCurrent ? <Check className="w-3 h-3 stroke-[3]" /> : toPersianDigits(i + 1)}
                                </div>
                                <span className={`text-[9.5px] leading-tight font-bold ${
                                  isCurrent ? 'text-cyan-900 font-black' : isPastOrCurrent ? 'text-slate-700' : 'text-slate-500'
                                }`}>
                                  {st.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : hasLab ? (
                        <div className="grid grid-cols-4 gap-1 pt-1 text-center">
                          {[
                            { label: 'ارسال قالب', step: 'sent' as const },
                            { label: 'ساخت لابراتوار', step: 'fabrication' as const },
                            { label: 'آماده پرو/مطب', step: 'frame_try_in' as const },
                            { label: 'تحویل و سمان', step: 'delivered_cemented' as const }
                          ].map((st, i) => {
                            const stages = ['sent', 'fabrication', 'frame_try_in', 'delivered_cemented'];
                            const currentIndex = Math.max(0, stages.indexOf(activeLab?.status || 'sent'));
                            const isPastOrCurrent = i <= currentIndex;
                            const isCurrent = i === currentIndex;

                            return (
                              <button
                                key={st.step}
                                type="button"
                                onClick={() => {
                                  if (!activeLab) return;
                                  selection();
                                  const nextLabs = (patient.labOrders || []).map((lo) =>
                                    lo.id === activeLab.id ? { ...lo, status: st.step } : lo
                                  );
                                  onEditPatient?.(patient.id, { labOrders: nextLabs });
                                  recordSuccess({ title: `وضعیت سفارش لابراتوار ${patient.fullName} به «${st.label}» تغییر یافت ✓`, targetRecordId: patient.id });
                                }}
                                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
                                title={`تغییر مرحله لابراتوار به ${st.label}`}
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-all ${
                                  isCurrent 
                                    ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-xs' 
                                    : isPastOrCurrent 
                                    ? 'bg-purple-100 text-purple-800 group-hover:bg-purple-200' 
                                    : 'bg-slate-200 text-slate-500 group-hover:bg-purple-50'
                                }`}>
                                  {isPastOrCurrent ? <Check className="w-3 h-3 stroke-[3]" /> : toPersianDigits(i + 1)}
                                </div>
                                <span className={`text-[9.5px] leading-tight font-bold ${
                                  isCurrent ? 'text-purple-900 font-black' : isPastOrCurrent ? 'text-slate-700' : 'text-slate-500'
                                }`}>
                                  {st.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-1 pt-1 text-center">
                          {[
                            { label: 'پذیرش و تشکیل پرونده', done: true, tab: 'treatments' as const },
                            { label: 'معاینه و تشخیص', done: true, tab: 'treatments' as const },
                            { label: 'درمان فعال در یونیت', done: patient.activeTreatmentsCount > 0, current: patient.activeTreatmentsCount > 0, tab: 'treatments' as const },
                            { label: 'تسویه و ترخیص', done: patient.balance >= 0, tab: 'financial' as const }
                          ].map((st, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => onOpenPatientFile(patient, st.tab)}
                              className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                                st.current 
                                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-xs' 
                                  : st.done 
                                  ? 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200' 
                                  : 'bg-slate-200 text-slate-500'
                              }`}>
                                {st.done ? <Check className="w-3 h-3 stroke-[3]" /> : toPersianDigits(i + 1)}
                              </div>
                              <span className={`text-[9.5px] leading-tight font-bold ${
                                st.current ? 'text-emerald-900 font-black' : st.done ? 'text-slate-700' : 'text-slate-500'
                              }`}>
                                {st.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Live Per-Patient Cross-Module Mini-Chip Bar (دسترسی مستقیم به بخش‌های بیمار روی کارت) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="space-y-2 pt-1"
                    >
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {[
                          { id: 'treatments', label: `درمان‌ها (${toPersianDigits(teethEntries.length)})`, tone: 'bg-emerald-600 text-white border-emerald-700' },
                          { id: 'lab', label: `لابراتوار (${toPersianDigits(patient.labOrders?.length || 0)})`, tone: 'bg-purple-600 text-white border-purple-700' },
                          { id: 'implant', label: `ایمپلنت (${toPersianDigits(patient.implantCases?.length || 0)})`, tone: 'bg-cyan-600 text-white border-cyan-700' },
                          { id: 'financial', label: `چک و اقساط (${toPersianDigits((patient.sayadChecks?.length || 0) + (patient.installments?.length || 0))})`, tone: 'bg-rose-600 text-white border-rose-700' },
                          { id: 'medical', label: `پزشکی و بیمه (${toPersianDigits(realMedicalAlerts.length)})`, tone: 'bg-amber-600 text-white border-amber-700' }
                        ].map((subChip) => {
                          const isSubActive = activeCardSubTab === subChip.id;
                          return (
                            <button
                              key={subChip.id}
                              type="button"
                              onClick={() => {
                                selection();
                                setCardSubTabMap(prev => ({ ...prev, [patient.id]: subChip.id as any }));
                              }}
                              className={`px-2.5 py-1 rounded-xl border text-[10.5px] font-black whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                                isSubActive
                                  ? `${subChip.tone} shadow-2xs`
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {subChip.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* SUB-TAB 1: Treatments List on the Patient Card */}
                      {activeCardSubTab === 'treatments' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-800 px-1 flex-wrap gap-1">
                            <span>لیست درمان‌ها، شماره دندان و پزشک:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-mono">
                                کل هزینه: {formatToman(patient.totalCost)}
                              </span>
                              <button
                                type="button"
                                onClick={() => onOpenPalmerChart ? onOpenPalmerChart(patient) : onOpenPatientFile(patient, 'treatments')}
                                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black cursor-pointer"
                              >
                                + چارت پالمر
                              </button>
                            </div>
                          </div>

                          {/* Inline 1-Tap Palmer Tooth Treatment Adder directly on Patient Card */}
                          <div className="p-2 rounded-xl bg-emerald-50/75 border border-emerald-200/90 flex items-center gap-1.5 flex-wrap text-[10.5px]">
                            <select
                              aria-label={`انتخاب ربع فک پالمر برای ${patient.fullName}`}
                              value={cardQuickQuad}
                              onChange={(e) => setCardQuickQuad(e.target.value as any)}
                              className="bg-white border border-emerald-200 rounded-lg px-1.5 py-1 font-mono font-black text-slate-900 cursor-pointer"
                            >
                              <option value="UR">UR (بالا راست)</option>
                              <option value="UL">UL (بالا چپ)</option>
                              <option value="LR">LR (پایین راست)</option>
                              <option value="LL">LL (پایین چپ)</option>
                            </select>
                            <select
                              aria-label={`انتخاب شماره دندان پالمر برای ${patient.fullName}`}
                              value={cardQuickTooth}
                              onChange={(e) => setCardQuickTooth(Number(e.target.value))}
                              className="bg-white border border-emerald-200 rounded-lg px-1.5 py-1 font-mono font-black text-slate-900 cursor-pointer"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <option key={n} value={n}>دندان {toPersianDigits(n)}</option>
                              ))}
                            </select>
                            <select
                              aria-label={`انتخاب نوع درمان سریع برای ${patient.fullName}`}
                              value={cardQuickTreatment}
                              onChange={(e) => setCardQuickTreatment(e.target.value as any)}
                              className="flex-1 min-w-[115px] bg-white border border-emerald-200 rounded-lg px-1.5 py-1 font-bold text-slate-900 cursor-pointer"
                            >
                              <option value="composite">ترمیم کامپوزیت</option>
                              <option value="endo">درمان ریشه اندو</option>
                              <option value="crown_zirconia">روکش زیرکونیا</option>
                              <option value="implant">کاشت ایمپلنت</option>
                              <option value="scaling">جرم‌گیری و بروساژ</option>
                              <option value="extraction">کشیدن دندان</option>
                            </select>
                            <select
                              aria-label={`انتخاب پزشک درمان سریع برای ${patient.fullName}`}
                              value={cardQuickDoctor}
                              onChange={(e) => setCardQuickDoctor(e.target.value)}
                              className="bg-white border border-emerald-200 rounded-lg px-1.5 py-1 font-bold text-slate-900 cursor-pointer"
                            >
                              <option value="دکتر مهدی امیری">دکتر مهدی امیری</option>
                              <option value="دکتر سارا نوری">دکتر سارا نوری</option>
                              <option value="دکتر علی مرادی">دکتر علی مرادی</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const tariffTable: Record<string, number> = {
                                  composite: 2_400_000,
                                  endo: 4_800_000,
                                  crown_zirconia: 7_500_000,
                                  implant: 18_500_000,
                                  scaling: 1_800_000,
                                  extraction: 1_500_000
                                };
                                const cost = resolveDynamicCardTariff(cardQuickTreatment, tariffTable[cardQuickTreatment] || 2_400_000);
                                const tKey = `${cardQuickQuad}_${cardQuickTooth}`;
                                const legacyKey = `${cardQuickQuad}-${cardQuickTooth}`;
                                const nextTeeth: Record<string, ToothCondition> = {
                                  ...(patient.teethConditions || {}),
                                  [tKey]: {
                                    quadrant: cardQuickQuad,
                                    toothNumber: cardQuickTooth,
                                    surfaces: ['occlusal'],
                                    treatment: cardQuickTreatment,
                                    status: 'in_progress',
                                    cost,
                                    doctorName: cardQuickDoctor,
                                    date: todayJalali
                                  }
                                };
                                if (legacyKey in nextTeeth) {
                                  delete nextTeeth[legacyKey];
                                }
                                const nextTotal = Object.values(nextTeeth).reduce((s, c) => s + (c.cost || 0), 0);
                                const nextActive = Object.values(nextTeeth).filter((c) => c.status !== 'completed').length;
                                onEditPatient?.(patient.id, {
                                  teethConditions: nextTeeth,
                                  totalCost: nextTotal,
                                  balance: patient.paidAmount - nextTotal,
                                  activeTreatmentsCount: nextActive
                                });
                                recordSuccess({
                                  title: `درمان ${getPersianTreatmentName(cardQuickTreatment)} دندان ${cardQuickQuad}${cardQuickTooth} (${cardQuickDoctor}) ثبت شد ✓`,
                                  targetRecordId: patient.id
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] cursor-pointer active:scale-95 shrink-0"
                            >
                              + ثبت سریع دندان ({formatToman(resolveDynamicCardTariff(cardQuickTreatment, ({ composite: 2_400_000, endo: 4_800_000, crown_zirconia: 7_500_000, implant: 18_500_000, scaling: 1_800_000, extraction: 1_500_000 } as Record<string, number>)[cardQuickTreatment] || 2_400_000))})
                            </button>
                          </div>

                          {teethEntries.length === 0 ? (
                            <p className="text-[10px] text-slate-400 p-2 text-center bg-slate-50 rounded-xl border border-slate-100">
                              هنوز درمانی برای این بیمار ثبت نشده است.
                            </p>
                          ) : (
                            teethEntries.map(([toothKey, cond]) => {
                              const treatmentPersianName = getPersianTreatmentName(cond.treatment);

                              return (
                                <div 
                                  key={toothKey}
                                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 flex items-center justify-between text-xs transition-colors"
                                >
                                  <div className="flex items-center gap-2 text-right">
                                    {/* Tooth Quadrant and Number Badge */}
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono font-black text-[10px] flex flex-col items-center justify-center shrink-0">
                                      <span>{cond.quadrant}</span>
                                      <span>{cond.toothNumber}</span>
                                    </div>

                                    <div className="text-right">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900 text-[11px]">{treatmentPersianName}</span>
                                        {cond.annotations && (
                                          <span className="flex items-center gap-0.5 text-purple-700 bg-purple-100/90 border border-purple-300 px-1.5 py-0.2 rounded-md text-[8.5px] font-black" title="دارای ترسیم بالینی روی سطوح">
                                            <PenTool className="w-2.5 h-2.5" />
                                            <span>ترسیم بالینی</span>
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                                        <span>پزشک: {cond.doctorName || 'دکتر مهدی امیری'}</span>
                                        <span>·</span>
                                        <span>سطوح: {cond.surfaces.join(' + ').toUpperCase()}</span>
                                        {cond.date && (
                                          <>
                                            <span>·</span>
                                            <span className="font-mono">{toPersianDigits(cond.date)}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-left shrink-0 flex flex-col items-end gap-0.5">
                                    <span className="text-[11px] font-black font-mono text-slate-800 block">
                                      {formatToman(cond.cost || 2400000)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const order: Array<'planned' | 'in_progress' | 'completed'> = ['planned', 'in_progress', 'completed'];
                                        const nextSt = order[(order.indexOf(cond.status) + 1) % order.length];
                                        const nextMap = {
                                          ...patient.teethConditions,
                                          [toothKey]: { ...cond, status: nextSt }
                                        };
                                        const nextActive = Object.values(nextMap).filter((c) => c.status !== 'completed').length;
                                        onEditPatient?.(patient.id, {
                                          teethConditions: nextMap,
                                          activeTreatmentsCount: nextActive
                                        });
                                        recordSuccess({ title: `وضعیت دندان ${cond.quadrant}${cond.toothNumber} بروزرسانی شد ✓`, targetRecordId: patient.id });
                                      }}
                                      title="کلیک جهت تغییر وضعیت درمان دندان"
                                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block cursor-pointer active:scale-95 ${
                                        cond.status === 'completed'
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : cond.status === 'in_progress'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                                      }`}
                                    >
                                      {cond.status === 'completed' ? '✓ تکمیل شده' : cond.status === 'in_progress' ? '⏳ در حال انجام' : '📋 طرح درمان'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* SUB-TAB 2: Patient Lab Orders Live View */}
                      {activeCardSubTab === 'lab' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-black text-purple-950 px-1">
                            <span>سفارش‌های لابراتوار و پروتز بیمار:</span>
                            <button
                              type="button"
                              onClick={() => onOpenPatientFile(patient, 'lab')}
                              className="text-[10px] font-black text-purple-700 hover:underline cursor-pointer"
                            >
                              مدیریت کامل لابراتوار ←
                            </button>
                          </div>

                          {/* Inline 1-Tap Lab Order Dispatcher on Patient Card */}
                          <div className="p-2 rounded-xl bg-purple-50/80 border border-purple-200/90 flex items-center gap-1.5 flex-wrap text-[10.5px]">
                            <select
                              aria-label={`نوع پروتز لابراتوار برای ${patient.fullName}`}
                              value={cardQuickLabWork}
                              onChange={(e) => setCardQuickLabWork(e.target.value)}
                              className="flex-1 min-w-[125px] bg-white border border-purple-200 rounded-lg px-1.5 py-1 font-bold text-slate-900 cursor-pointer"
                            >
                              <option value="روکش زیرکونیا فول آناتومیک">روکش زیرکونیا فول آناتومیک</option>
                              <option value="لمینت سرامیکی E.max">لمینت سرامیکی E.max</option>
                              <option value="روکش PFM و فریم فلزی">روکش PFM و فریم فلزی</option>
                              <option value="اباتمنت اختصاصی و روکش ایمپلنت">اباتمنت و روکش ایمپلنت</option>
                              <option value="پروتز متحرک پارسیل / دست‌دندان">پروتز متحرک / پارسیل</option>
                            </select>
                            <select
                              aria-label={`انتخاب لابراتوار طرف قرارداد برای ${patient.fullName}`}
                              value={cardQuickLabName}
                              onChange={(e) => setCardQuickLabName(e.target.value)}
                              className="bg-white border border-purple-200 rounded-lg px-1.5 py-1 font-bold text-slate-800 cursor-pointer"
                            >
                              <option value="لابراتوار دیجیتال پارس (ثابت)">پارس دیجیتال (ثابت)</option>
                              <option value="لابراتوار تخصصی آریا (متحرک)">آریا (متحرک)</option>
                              <option value="لابراتوار مدرن کدکم">مدرن CAD/CAM</option>
                            </select>
                            <select
                              aria-label={`رنگ شید پروتز برای ${patient.fullName}`}
                              value={cardQuickLabShade}
                              onChange={(e) => setCardQuickLabShade(e.target.value)}
                              className="bg-white border border-purple-200 rounded-lg px-1.5 py-1 font-mono font-black text-purple-900 cursor-pointer"
                            >
                              {['A1', 'A2', 'A3', 'B1', 'BL2'].map((sh) => (
                                <option key={sh} value={sh}>رنگ {sh}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const newLabOrder = {
                                  id: `lab-card-${Date.now()}`,
                                  patientId: patient.id,
                                  patientName: patient.fullName,
                                  labName: cardQuickLabName,
                                  workType: cardQuickLabWork,
                                  toothNumber: `${cardQuickQuad}${cardQuickTooth}`,
                                  shade: cardQuickLabShade,
                                  sendDate: todayJalali,
                                  deliveryDate: todayJalali,
                                  appointmentDate: todayJalali,
                                  reminderNotice: 'یادآوری ۲ روز قبل از تحویل پروتز',
                                  status: 'sent' as const,
                                  cost: 2_800_000
                                };
                                onEditPatient?.(patient.id, {
                                  labOrders: [newLabOrder, ...(patient.labOrders || [])]
                                });
                                recordSuccess({
                                  title: `سفارش لابراتوار «${cardQuickLabWork}» (${cardQuickLabShade}) برای ${patient.fullName} ثبت شد ✓`,
                                  targetRecordId: patient.id
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] cursor-pointer active:scale-95 shrink-0"
                            >
                              + ارسال به لابراتوار
                            </button>
                          </div>

                          {(!patient.labOrders || patient.labOrders.length === 0) ? (
                            <p className="text-[10px] text-slate-400 p-2 text-center bg-purple-50/40 rounded-xl border border-purple-100">
                              سفارش لابراتواری برای این بیمار ثبت نشده است.
                            </p>
                          ) : (
                            patient.labOrders.map((lo) => (
                              <div key={lo.id} className="p-2 rounded-xl bg-purple-50/60 border border-purple-200/80 flex items-center justify-between gap-2 flex-wrap text-xs">
                                <div className="text-right space-y-0.5">
                                  <div className="font-black text-purple-950 text-[11px]">
                                    {lo.workType} · دندان {lo.toothNumber} (رنگ {lo.shade})
                                  </div>
                                  <div className="text-[10px] text-slate-600">
                                    {lo.labName} · ارسال: {toPersianDigits(lo.sendDate)} · تحویل: {toPersianDigits(lo.deliveryDate)}
                                  </div>
                                </div>
                                <div className="text-left shrink-0 flex items-center gap-1.5">
                                  <div>
                                    <span className="font-mono font-black text-[11px] text-purple-900 block">
                                      {formatToman(lo.cost)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-900 inline-block">
                                      {lo.status === 'frame_try_in' ? 'آماده پرو فریم/تحویل در مطب' : lo.status === 'delivered_cemented' ? 'تحویل و سمان شده ✓' : 'در حال ساخت لابراتوار'}
                                    </span>
                                  </div>
                                  {lo.status !== 'delivered_cemented' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const stOrder: Array<'sent' | 'fabrication' | 'frame_try_in' | 'delivered_cemented'> = ['sent', 'fabrication', 'frame_try_in', 'delivered_cemented'];
                                        const nextSt = stOrder[Math.min(stOrder.length - 1, stOrder.indexOf(lo.status as any) + 1)];
                                        const nextLabs = (patient.labOrders || []).map((item) =>
                                          item.id === lo.id ? { ...item, status: nextSt } : item
                                        );
                                        onEditPatient?.(patient.id, { labOrders: nextLabs });
                                        recordSuccess({ title: `مرحله سفارش لابراتوار ${lo.workType} ارتقا یافت ✓`, targetRecordId: patient.id });
                                      }}
                                      className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[9.5px] font-black cursor-pointer active:scale-95"
                                    >
                                      مرحله بعد ←
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* SUB-TAB 3: Patient Implant Cases Live View */}
                      {activeCardSubTab === 'implant' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-black text-cyan-950 px-1">
                            <span>پرونده‌های جراحی ایمپلنت و استئواینتگریشن:</span>
                            <button
                              type="button"
                              onClick={() => onOpenPatientFile(patient, 'implant')}
                              className="text-[10px] font-black text-cyan-700 hover:underline cursor-pointer"
                            >
                              مدیریت مراحل ایمپلنت ←
                            </button>
                          </div>

                          {/* Inline 1-Tap Implant Surgery Case Logger on Patient Card */}
                          <div className="p-2 rounded-xl bg-cyan-50/80 border border-cyan-200/90 flex items-center gap-1.5 flex-wrap text-[10.5px]">
                            <select
                              aria-label={`برند فیکسچر ایمپلنت برای ${patient.fullName}`}
                              value={cardQuickImplantBrand}
                              onChange={(e) => setCardQuickImplantBrand(e.target.value)}
                              className="flex-1 min-w-[140px] bg-white border border-cyan-200 rounded-lg px-1.5 py-1 font-bold text-slate-900 cursor-pointer"
                            >
                              <option value="Straumann BLT (اشترومن سوئیس)">Straumann BLT (اشترومن سوئیس)</option>
                              <option value="Osstem TSIII (اوستم کره)">Osstem TSIII (اوستم کره)</option>
                              <option value="MegaGen AnyRidge (مگاژن)">MegaGen AnyRidge (مگاژن)</option>
                              <option value="Zimmer Biomet (زیمر آمریکا)">Zimmer Biomet (زیمر آمریکا)</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const newImp = {
                                  id: `imp-card-${Date.now()}`,
                                  patientId: patient.id,
                                  patientName: patient.fullName,
                                  toothNumber: `${cardQuickQuad}${cardQuickTooth}`,
                                  brand: cardQuickImplantBrand,
                                  diameter: '4.1',
                                  length: '10',
                                  torque: 40,
                                  boneGraft: false,
                                  membrane: false,
                                  surgeryDate: todayJalali,
                                  healingDueDate: todayJalali,
                                  currentStage: 'fixture_placed' as const,
                                  notes: 'جراحی فیکسچر با ثبات اولیه عالی — یادآور هیلینگ فعال شد'
                                };
                                onEditPatient?.(patient.id, {
                                  implantCases: [newImp, ...(patient.implantCases || [])]
                                });
                                recordSuccess({
                                  title: `جراحی فیکسچر ایمپلنت ${cardQuickImplantBrand} دندان ${cardQuickQuad}${cardQuickTooth} ثبت شد ✓`,
                                  targetRecordId: patient.id
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[10px] cursor-pointer active:scale-95 shrink-0"
                            >
                              + ثبت جراحی ایمپلنت ({cardQuickQuad}{cardQuickTooth})
                            </button>
                          </div>

                          {(!patient.implantCases || patient.implantCases.length === 0) ? (
                            <p className="text-[10px] text-slate-400 p-2 text-center bg-cyan-50/40 rounded-xl border border-cyan-100">
                              مورد جراحی ایمپلنتی برای این بیمار ثبت نشده است.
                            </p>
                          ) : (
                            patient.implantCases.map((imp) => (
                              <div key={imp.id} className="p-2 rounded-xl bg-cyan-50/60 border border-cyan-200/80 flex items-center justify-between gap-2 flex-wrap text-xs">
                                <div className="text-right space-y-0.5">
                                  <div className="font-black text-cyan-950 text-[11px]">
                                    فیکسچر {imp.brand} · دندان {imp.toothNumber} (قطر {imp.diameter}×{imp.length}mm)
                                  </div>
                                  <div className="text-[10px] text-slate-600">
                                    جراحی: {toPersianDigits(imp.surgeryDate)} · موعد هیلینگ/قالب‌گیری: {toPersianDigits(imp.healingDueDate)} · تورک: {toPersianDigits(imp.torque || 35)} Ncm
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-cyan-100 text-cyan-900">
                                    {imp.currentStage === 'fixture_placed' ? 'کاشت فیکسچر' : imp.currentStage === 'healing_cap' ? 'بستن هیلینگ' : imp.currentStage === 'impression' ? 'قالب‌گیری' : imp.currentStage === 'abutment_framework' ? 'اباتمنت/فریم' : 'تحویل روکش ✓'}
                                  </span>
                                  {imp.currentStage !== 'crown_delivered' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const stOrder: Array<'fixture_placed' | 'healing_cap' | 'impression' | 'abutment_framework' | 'crown_delivered'> = ['fixture_placed', 'healing_cap', 'impression', 'abutment_framework', 'crown_delivered'];
                                        const nextSt = stOrder[Math.min(stOrder.length - 1, stOrder.indexOf(imp.currentStage as any) + 1)];
                                        const nextCases = (patient.implantCases || []).map((item) =>
                                          item.id === imp.id ? { ...item, currentStage: nextSt } : item
                                        );
                                        onEditPatient?.(patient.id, { implantCases: nextCases });
                                        recordSuccess({ title: `مرحله ایمپلنت دندان ${imp.toothNumber} ارتقا یافت ✓`, targetRecordId: patient.id });
                                      }}
                                      className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[9.5px] font-black cursor-pointer active:scale-95"
                                    >
                                      ارتقای مرحله ←
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* SUB-TAB 4: Patient Checks, Installments & Financial Summary */}
                      {activeCardSubTab === 'financial' && (() => {
                        const patInsts = patient.installments || [];
                        const unpaidInsts = patInsts.filter((i) => i.status !== 'paid');
                        const patChecks = patient.sayadChecks || [];
                        const sayadInstallmentChecks = patChecks.filter((c) => !c.isGuarantee);
                        const guaranteeChecks = patChecks.filter((c) => c.isGuarantee);
                        const pendingGuarantees = guaranteeChecks.filter((c) => c.status !== 'cleared' && c.status !== 'returned');
                        const isGuaranteeReadyForReturn =
                          pendingGuarantees.length > 0 && unpaidInsts.length === 0 && patient.balance >= 0;

                        return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-black text-rose-950 px-1 flex-wrap gap-1">
                            <span>چک‌های صیادی، اقساط و تراز مالی بیمار:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onQuickPayment ? onQuickPayment(patient) : onOpenPatientFile(patient, 'financial')}
                                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black transition-all cursor-pointer"
                              >
                                + ثبت دریافتی سریع
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenPatientFile(patient, 'financial')}
                                className="text-[10px] font-black text-rose-700 hover:underline cursor-pointer"
                              >
                                دفتر مالی و تسویه ←
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px] tabular-nums">
                            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-slate-500 block text-[9.5px]">کل کارکرد</span>
                              <span className="font-mono font-black text-slate-900">{formatToman(patient.totalCost)}</span>
                            </div>
                            <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-emerald-700 block text-[9.5px]">پرداختی</span>
                              <span className="font-mono font-black text-emerald-900">{formatToman(patient.paidAmount)}</span>
                            </div>
                            <div className="p-1.5 rounded-xl bg-rose-50 border border-rose-200">
                              <span className="text-rose-700 block text-[9.5px]">مانده بدهی</span>
                              <span className="font-mono font-black text-rose-900">{formatToman(Math.abs(patient.balance))}</span>
                            </div>
                          </div>

                          {/* Unified 5-Pillar Installment, Sayad Check, Guarantee & Reminder Status Strip */}
                          {(patInsts.length > 0 || patChecks.length > 0) && (
                            <div className="p-2 rounded-xl bg-gradient-to-l from-indigo-50/80 via-rose-50/60 to-amber-50/70 border border-indigo-200/80 flex items-center justify-between gap-2 flex-wrap text-[10px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 font-black text-indigo-900">
                                  اقساط: {toPersianDigits(patInsts.length - unpaidInsts.length)}/{toPersianDigits(patInsts.length)} تسویه
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-black text-emerald-900">
                                  چک صیادی: {toPersianDigits(sayadInstallmentChecks.filter(c => c.status === 'cleared').length)}/{toPersianDigits(sayadInstallmentChecks.length)} پاس‌شده
                                </span>
                                {guaranteeChecks.length > 0 && (
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-black border ${
                                      isGuaranteeReadyForReturn
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        : pendingGuarantees.length === 0
                                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                                          : 'bg-amber-100 text-amber-950 border-amber-300'
                                    }`}
                                  >
                                    {isGuaranteeReadyForReturn
                                      ? 'چک ضمانت آماده عودت به بیمار ✓'
                                      : pendingGuarantees.length === 0
                                        ? 'چک ضمانت عودت داده شد ✓'
                                        : `چک ضمانت امانی در گاوصندوق (${toPersianDigits(pendingGuarantees.length)})`}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9.5px] font-bold text-slate-600">
                                همگام با یادآوری پیامکی
                              </span>
                            </div>
                          )}

                          {/* Inline 1-Tap Instant Settlement & Receipt Bar on Patient Card */}
                          <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex items-center gap-1.5 flex-wrap text-[10.5px]">
                            <select
                              aria-label={`روش پرداخت سریع برای ${patient.fullName}`}
                              value={cardQuickPayMethod}
                              onChange={(e) => setCardQuickPayMethod(e.target.value as any)}
                              className="bg-white border border-emerald-200 rounded-lg px-1.5 py-1 font-bold text-slate-900 cursor-pointer"
                            >
                              <option value="pos">کارتخوان (POS)</option>
                              <option value="cash">وجه نقد</option>
                              <option value="card_to_card">کارت به کارت</option>
                            </select>
                            <input
                              type="number"
                              dir="ltr"
                              aria-label={`مبلغ دریافتی سریع برای ${patient.fullName}`}
                              value={cardQuickPayAmountMap[patient.id] ?? (patient.balance < 0 ? Math.abs(patient.balance) : 1_500_000)}
                              onChange={(e) =>
                                setCardQuickPayAmountMap((prev) => ({
                                  ...prev,
                                  [patient.id]: Number(e.target.value) || 0
                                }))
                              }
                              className="w-28 bg-white border border-emerald-200 rounded-lg px-2 py-1 font-mono font-black text-emerald-900 text-center"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const amt = cardQuickPayAmountMap[patient.id] ?? (patient.balance < 0 ? Math.abs(patient.balance) : 1_500_000);
                                if (amt <= 0) return;
                                const nextPaid = patient.paidAmount + amt;
                                const nextBal = nextPaid - patient.totalCost;
                                const clearsAll = nextBal >= 0;
                                const matchedInst = unpaidInsts.find((inst) => inst.amount === amt);
                                const settleIds = new Set(
                                  clearsAll
                                    ? unpaidInsts.map((i) => i.id)
                                    : matchedInst
                                      ? [matchedInst.id]
                                      : []
                                );
                                const nextInstallments =
                                  settleIds.size > 0
                                    ? patInsts.map((inst) =>
                                        settleIds.has(inst.id)
                                          ? { ...inst, status: 'paid' as const, paidDate: todayJalali }
                                          : inst
                                      )
                                    : patInsts;
                                settleIds.forEach((id) => markReminderDone(`rem_installment_${id}`));

                                const settledInstObjects = unpaidInsts.filter((i) => settleIds.has(i.id));
                                const nextSayadChecks =
                                  settleIds.size > 0
                                    ? patChecks.map((chk) => {
                                        if (
                                          !chk.isGuarantee &&
                                          chk.status === 'in_collection' &&
                                          (clearsAll ||
                                            settledInstObjects.some(
                                              (si) => chk.id.includes(si.id) || (chk.dueDate === si.dueDate && chk.amount === si.amount)
                                            ))
                                        ) {
                                          markReminderDone(`rem_check_${chk.id}`);
                                          return { ...chk, status: 'cleared' as const };
                                        }
                                        return chk;
                                      })
                                    : patChecks;

                                const newPayment = {
                                  id: `pay-card-${Date.now()}`,
                                  patientId: patient.id,
                                  patientName: patient.fullName,
                                  amount: amt,
                                  date: todayJalali,
                                  method: cardQuickPayMethod,
                                  forTreatment: matchedInst
                                    ? `تسویه قسط ${toPersianDigits(matchedInst.installmentNumber)} از کارت پرونده بیمار`
                                    : 'تسویه مستقیم از کارت پرونده بیمار'
                                };
                                onEditPatient?.(patient.id, {
                                  paidAmount: nextPaid,
                                  balance: nextBal,
                                  payments: [newPayment, ...(patient.payments || [])],
                                  installments: nextInstallments,
                                  sayadChecks: nextSayadChecks
                                });
                                recordSuccess({
                                  title: `مبلغ ${formatToman(amt)} (${cardQuickPayMethod === 'pos' ? 'کارتخوان' : cardQuickPayMethod === 'cash' ? 'نقد' : 'کارت به کارت'}) برای ${patient.fullName} ثبت و از بدهی کسر شد ✓`,
                                  targetRecordId: patient.id
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] cursor-pointer active:scale-95 shrink-0"
                            >
                              ثبت دریافتی و کسر از بدهی ✓
                            </button>
                          </div>

                          {patChecks.map((chk) => (
                            <div
                              key={chk.id}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${
                                chk.isGuarantee
                                  ? 'bg-indigo-50/70 border-indigo-200'
                                  : 'bg-amber-50/70 border-amber-200'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-black ${chk.isGuarantee ? 'text-indigo-950' : 'text-amber-950'}`}>
                                    {chk.isGuarantee ? `چک ضمانت امانی ${chk.bankName}` : `چک صیادی ${chk.bankName}`}
                                  </span>
                                  {chk.isGuarantee && isGuaranteeReadyForReturn && chk.status !== 'cleared' && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[9px] font-black">
                                      اقساط تسویه · آماده عودت ✓
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-600 block font-mono">
                                  شناسه: {toPersianDigits(chk.sayadId)} · سررسید: {toPersianDigits(chk.dueDate)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono font-black ${chk.isGuarantee ? 'text-indigo-950' : 'text-amber-950'}`}>
                                  {formatToman(chk.amount)}
                                </span>
                                {chk.status !== 'cleared' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextChecks = patChecks.map((c) =>
                                        c.id === chk.id ? { ...c, status: 'cleared' as const } : c
                                      );
                                      markReminderDone(`rem_check_${chk.id}`);

                                      if (chk.isGuarantee) {
                                        onEditPatient?.(patient.id, {
                                          sayadChecks: nextChecks
                                        });
                                        recordSuccess({
                                          title: `چک ضمانت امانی ${chk.bankName} به بیمار عودت داده شد ✓`,
                                          targetRecordId: patient.id
                                        });
                                      } else {
                                        const matchedInst = unpaidInsts.find(
                                          (inst) =>
                                            chk.id.includes(inst.id) ||
                                            (inst.dueDate === chk.dueDate && inst.amount === chk.amount)
                                        );
                                        const nextInsts = matchedInst
                                          ? patInsts.map((inst) =>
                                              inst.id === matchedInst.id
                                                ? { ...inst, status: 'paid' as const, paidDate: todayJalali }
                                                : inst
                                            )
                                          : patInsts;
                                        if (matchedInst) {
                                          markReminderDone(`rem_installment_${matchedInst.id}`);
                                        }
                                        const nextPaid = patient.paidAmount + chk.amount;
                                        const chkReceipt = {
                                          id: `pay-chk-${Date.now()}`,
                                          patientId: patient.id,
                                          patientName: patient.fullName,
                                          amount: chk.amount,
                                          date: todayJalali,
                                          method: 'check' as const,
                                          forTreatment: matchedInst
                                            ? `وصول چک صیادی ${chk.bankName} (تسویه قسط ${toPersianDigits(matchedInst.installmentNumber)})`
                                            : `وصول چک صیادی بانک ${chk.bankName}`
                                        };
                                        onEditPatient?.(patient.id, {
                                          sayadChecks: nextChecks,
                                          installments: nextInsts,
                                          paidAmount: nextPaid,
                                          balance: nextPaid - patient.totalCost,
                                          payments: [chkReceipt, ...(patient.payments || [])]
                                        });
                                        recordSuccess({
                                          title: matchedInst
                                            ? `چک صیادی ${chk.bankName} وصول و قسط شماره ${toPersianDigits(matchedInst.installmentNumber)} تسویه شد ✓`
                                            : `چک صیادی ${chk.bankName} وصول و از بدهی کسر شد ✓`,
                                          targetRecordId: patient.id
                                        });
                                      }
                                    }}
                                    className={`px-2 py-0.5 rounded-lg text-white text-[9.5px] font-black cursor-pointer ${
                                      chk.isGuarantee
                                        ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                  >
                                    {chk.isGuarantee ? 'عودت ضمانت ✓' : 'وصول چک ✓'}
                                  </button>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">
                                    {chk.isGuarantee ? 'عودت شده ✓' : 'وصول شده ✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {patInsts.map((inst) => {
                            const linkedChk = sayadInstallmentChecks.find(
                              (c) => c.id.includes(inst.id) || (c.dueDate === inst.dueDate && c.amount === inst.amount)
                            );
                            return (
                            <div key={inst.id} className="p-2 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between gap-2 text-[11px]">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-rose-950">قسط شماره {toPersianDigits(inst.installmentNumber)}</span>
                                  {linkedChk ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                                      چک صیادی {linkedChk.bankName}
                                    </span>
                                  ) : guaranteeChecks.length > 0 ? (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[9px] font-bold">
                                      تحت پوشش چک ضمانت
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-[10px] text-slate-600 block font-mono">سررسید: {toPersianDigits(inst.dueDate)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="text-left">
                                  <span className="font-mono font-black text-rose-900 block">{formatToman(inst.amount)}</span>
                                  <span className="text-[9.5px] font-bold text-rose-700">{inst.status === 'paid' ? 'پرداخت شده ✓' : inst.status === 'overdue' ? 'معوق' : 'در انتظار سررسید'}</span>
                                </div>
                                {inst.status !== 'paid' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextInst = patInsts.map((item) =>
                                        item.id === inst.id ? { ...item, status: 'paid' as const, paidDate: getCurrentPersianDate() } : item
                                      );
                                      markReminderDone(`rem_installment_${inst.id}`);
                                      const nextChecks = linkedChk
                                        ? patChecks.map((c) => {
                                            if (c.id === linkedChk.id) {
                                              markReminderDone(`rem_check_${c.id}`);
                                              return { ...c, status: 'cleared' as const };
                                            }
                                            return c;
                                          })
                                        : patChecks;
                                      const nextPaid = patient.paidAmount + inst.amount;
                                      const instReceipt = {
                                        id: `pay-inst-${Date.now()}`,
                                        patientId: patient.id,
                                        patientName: patient.fullName,
                                        amount: inst.amount,
                                        date: getCurrentPersianDate(),
                                        method: 'pos' as const,
                                        forTreatment: `تسویه قسط شماره ${toPersianDigits(inst.installmentNumber)}`
                                      };
                                      onEditPatient?.(patient.id, {
                                        installments: nextInst,
                                        sayadChecks: nextChecks,
                                        paidAmount: nextPaid,
                                        balance: nextPaid - patient.totalCost,
                                        payments: [instReceipt, ...(patient.payments || [])]
                                      });
                                      recordSuccess({
                                        title: linkedChk
                                          ? `قسط شماره ${toPersianDigits(inst.installmentNumber)} و چک صیادی ${linkedChk.bankName} یکپارچه تسویه شدند ✓`
                                          : `قسط شماره ${toPersianDigits(inst.installmentNumber)} تسویه شد ✓`,
                                        targetRecordId: patient.id
                                      });
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black cursor-pointer"
                                  >
                                    تسویه قسط ✓
                                  </button>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                        );
                      })()}

                      {/* SUB-TAB 5: Systemic Medical History & Insurance Notes */}
                      {activeCardSubTab === 'medical' && (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-amber-950">سوابق سیستمیک، حساسیت دارویی و توضیحات بیمه:</span>
                            <span className="font-mono text-[10px] text-slate-600">کد ملی: {toPersianDigits(patient.nationalId)}</span>
                          </div>
                          <div className="text-slate-800 font-bold">
                            {realMedicalAlerts.length > 0 ? realMedicalAlerts.join(' · ') : 'سالم — بدون سابقه بیماری سیستمیک یا حساسیت دارویی ثبت‌شده'}
                          </div>
                          {patient.notes && (
                            <div className="text-[10.5px] text-slate-600 border-t border-amber-200/60 pt-1">
                              یادداشت بالینی / بیمه: {patient.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}

        {filtered.length > visibleLimit && (
          <button
            type="button"
            onClick={() => {
              selection();
              setVisibleLimit(prev => prev + 50);
            }}
            className="w-full py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-black text-xs transition-all cursor-pointer"
          >
            نمایش ۵۰ پرونده بعدی از مجموع {toPersianDigits(filtered.length)} پرونده (رندر پنجره‌ای ۵۰۰٬۰۰۰ رکورد)
          </button>
        )}
      </div>

      {/* New Patient Registration Modal (Full-Page Mobile Sheet - Zero Page Scroll Required) */}
      {showAddModal && (
        <ViewportModalPortal isOpen={showAddModal}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="تشکیل پرونده بیمار جدید"
            className="fixed inset-0 z-[100] bg-emerald-950/35 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setShowAddModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-emerald-50/95 via-white to-teal-50/50 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-emerald-200/90 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-emerald-200/80 bg-white/95 shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-emerald-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">تشکیل پرونده بیمار جدید</h3>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)} 
                    aria-label="بستن تشکیل پرونده جدید"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <form id="new-patient-form" onSubmit={handleCreate} className="p-4 space-y-3 text-[11px] flex-1 overflow-y-auto overscroll-contain">
                {/* Smart Duplicate File / Phone Detection Warning */}
                {duplicateMatchedPatient && (
                  <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[11px] font-black text-amber-950 block truncate">
                          پرونده مشابه با {duplicateMatchedPatient.reason}: {duplicateMatchedPatient.patient.fullName}
                        </span>
                        <span className="text-[10px] text-amber-800 font-mono">
                          شماره پرونده: {duplicateMatchedPatient.patient.fileNumber}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        onOpenPatientFile(duplicateMatchedPatient.patient);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[10.5px] shrink-0 cursor-pointer"
                    >
                      باز کردن پرونده
                    </button>
                  </div>
                )}

                {/* Row 1: شماره پرونده + نام و نام خانوادگی */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <label className="text-slate-700 block mb-1 font-bold">شماره پرونده *</label>
                    <input
                      type="text"
                      required
                      value={formFileNumber}
                      onChange={(e) => setFormFileNumber(e.target.value)}
                      placeholder="D-1052"
                      className="w-full bg-white border border-emerald-300 rounded-xl px-2.5 py-2 text-emerald-800 font-mono font-black text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                  <div className="col-span-7">
                    <label className="text-slate-700 block mb-1 font-bold">نام و نام خانوادگی کامل *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="مثال: سارا ابراهیمی"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 placeholder-slate-400 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Row 2: کد ملی + شماره تماس همراه با اعتبارسنجی هوشمند */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold">کد ملی (۱۰ رقم)</label>
                      {toEnglishDigits(formNationalId).replace(/\D/g, '').length >= 8 && (
                        <span className={`text-[9.5px] font-black ${validateIranianNationalCode(formNationalId) ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {validateIranianNationalCode(formNationalId) ? 'معتبر ✓' : 'بررسی شود'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formNationalId}
                      onChange={(e) => setFormNationalId(e.target.value)}
                      placeholder="۰۰۱۲۳۴۵۶۷۸"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold">شماره تماس همراه *</label>
                      {toEnglishDigits(formPhone).replace(/\D/g, '').length >= 10 && (
                        <span className={`text-[9.5px] font-black ${validateIranianMobileNumber(formPhone) ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {validateIranianMobileNumber(formPhone) ? 'موبایل معتبر ✓' : '۱۱ رقمی ۰۹...'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Row 3: سن + جنسیت + پوشش بیمه */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="text-slate-700 block mb-1 font-bold">سن</label>
                    <input aria-label="سن"
                      type="number"
                      value={formAge}
                      onChange={(e) => setFormAge(Number(e.target.value))}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 font-mono text-center text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="text-slate-700 block mb-1 font-bold">جنسیت</label>
                    <select aria-label="جنسیت"
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value as any)}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-1.5 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    >
                      <option value="مرد">مرد</option>
                      <option value="زن">زن</option>
                    </select>
                  </div>

                  <div className="col-span-6">
                    <label className="text-slate-700 block mb-1 font-bold">پوشش بیمه</label>
                    <select aria-label="پوشش بیمه"
                      value={formInsurance}
                      onChange={(e) => setFormInsurance(e.target.value)}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    >
                      <option value="آزاد">آزاد (بدون بیمه)</option>
                      <option value="تامین اجتماعی">تامین اجتماعی</option>
                      <option value="خدمات درمانی">خدمات درمانی / سلامت</option>
                      <option value="نیروهای مسلح">نیروهای مسلح</option>
                      <option value="بیمه تکمیلی">بیمه تکمیلی</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Medical History Compact 3-Column Grid */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-700 font-bold">سوابق پزشکی و هشدارهای سلامتی:</span>
                    <span className="text-[9.5px] text-amber-600 font-bold">حیاتی جهت بیحسی و جراحی</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-xl border border-emerald-100">
                    {medicalConditionOptions.map(cond => {
                      const isChecked = formMedicalAlerts.includes(cond);
                      return (
                        <button
                          type="button"
                          key={cond}
                          onClick={() => toggleMedicalAlert(cond)}
                          className={`text-right px-2 py-1.5 rounded-lg text-[9.5px] font-bold border truncate transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '} {cond}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 5: علت اصلی مراجعه */}
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">علت اصلی مراجعه</label>
                  <input
                    type="text"
                    value={formChiefComplaint}
                    onChange={(e) => setFormChiefComplaint(e.target.value)}
                    placeholder="مثلاً دندان‌درد شبانه، شکستگی دندان جلو، کاشت ایمپلنت..."
                    className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </form>

              {/* Fixed Bottom Action Footer */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-emerald-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  form="new-patient-form"
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  تشکیل پرونده و صدور شماره
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Waiting Room Digital QR Self-Anamnesis Kiosk Modal (Full-Page Mobile Sheet) */}
      {showQrKioskModal && (
        <ViewportModalPortal isOpen={showQrKioskModal}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="کیوسک دیجیتال خودپذیرش سالن انتظار"
            className="fixed inset-0 z-[100] bg-emerald-950/35 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setShowQrKioskModal(false)}
          >
            <div
              className="w-full sm:max-w-sm h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[28px] border-0 sm:border border-emerald-200 shadow-2xl text-right flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-slate-100 bg-white shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-emerald-200 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900">کیوسک دیجیتال خودپذیرش سالن انتظار</h3>
                      <span className="text-[10px] text-emerald-700 font-bold">اسکن QR توسط بیمار و تکمیل خودکار پرونده</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQrKioskModal(false)}
                    aria-label="بستن کیوسک QR"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <div className="p-4 flex-1 overflow-y-auto overscroll-contain flex flex-col items-center justify-center">
                <div className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50/70 to-white p-5 rounded-2xl border border-emerald-100">
                  <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-2xs">
                    <RealQrCode
                      value={`MINADENTAL-KIOSK-INTAKE-${todayJalali}`}
                      size={140}
                      darkColor="#047857"
                      lightColor="#ffffff"
                      ariaLabel="کد QR خودپذیرش بیماران کلینیک مینادنتال"
                    />
                  </div>
                  <span className="text-xs font-black text-slate-800 mt-3">اسکن با دوربین موبایل بیمار در سالن انتظار</span>
                  <span className="text-[10px] text-slate-500 mt-1 text-center">فرم شرح‌حال پزشکی، حساسیت دارویی و امضای رضایت‌نامه</span>
                </div>
              </div>

              {/* Fixed Bottom Action Footer */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-slate-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowQrKioskModal(false)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  بستن
                </button>
                {onOpenPatientScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      setShowQrKioskModal(false);
                      onOpenPatientScanner();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>اسکن دوربین</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    success();
                    const nextNum = getNextFileNumber(getLatestFileNumber(patients));
                    recordLastFileNumber(nextNum);
                    onAddNewPatient({
                      fileNumber: nextNum,
                      fullName: 'سارا رادمهر',
                      nationalId: '۰۰۱۲۸۴۹۳۱۰',
                      phone: '09124458910',
                      age: 29,
                      gender: 'زن',
                      medicalHistory: ['حساسیت به پنی‌سیلین'],
                      notes: 'علت مراجعه: لمینت سرامیکی و اصلاح طرح لبخند | بیمه: تامین اجتماعی'
                    });
                    setShowQrKioskModal(false);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  دریافت آنی فرم بیمار از کیوسک
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Long-Press Quick Action Context Menu (Call, New Appointment, Payment without opening full patient file) */}
      {contextMenuPatient && (
        <ViewportModalPortal isOpen={Boolean(contextMenuPatient)}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`عملیات سریع بیمار ${contextMenuPatient.fullName}`}
            className="fixed inset-0 z-[110] bg-emerald-950/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setContextMenuPatient(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm bg-gradient-to-b from-emerald-50 via-white to-teal-50/60 rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-emerald-200 shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 text-right"
            >
              <div className="w-10 h-1 rounded-full bg-emerald-300 mx-auto sm:hidden" />

              {/* Patient Quick Summary Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                    {contextMenuPatient.fullName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{contextMenuPatient.fullName}</h4>
                    <span className="text-[11px] font-mono text-emerald-800 font-bold">
                      پرونده {toPersianDigits(contextMenuPatient.fileNumber)} · {toPersianDigits(contextMenuPatient.phone)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setContextMenuPatient(null)}
                  aria-label="بستن منوی عملیات سریع بیمار"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Quick Action Buttons */}
              <div className="space-y-2">
                {/* 1. Call Patient */}
                <a
                  href={`tel:${contextMenuPatient.phone}`}
                  onClick={() => {
                    impactLight();
                    setContextMenuPatient(null);
                  }}
                  className="w-full p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center justify-between transition-all active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-2xs">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">تماس تلفنی مستقیم با بیمار</span>
                      <span className="text-[10px] font-mono text-sky-800 font-bold">{toPersianDigits(contextMenuPatient.phone)}</span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-sky-600" />
                </a>

                {/* 2. New Appointment */}
                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    const target = contextMenuPatient;
                    setContextMenuPatient(null);
                    setQuickAptPatient(target);
                    setQuickAptConfirmStep(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 flex items-center justify-between transition-all active:scale-98 cursor-pointer text-right"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">ثبت نوبت جدید برای بیمار</span>
                      <span className="text-[10px] text-purple-800 font-bold">تعیین آنی ساعت و یونیت بدون باز کردن پرونده</span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-purple-600" />
                </button>

                {/* 3. Payment / POS */}
                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    const target = contextMenuPatient;
                    setContextMenuPatient(null);
                    if (onQuickPayment) {
                      onQuickPayment(target);
                    } else {
                      onOpenPatientFile(target, 'financial');
                    }
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-between transition-all active:scale-98 cursor-pointer text-right"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">ثبت پرداخت و پایانه کارتخوان</span>
                      <span className="text-[10px] text-emerald-800 font-bold">
                        {contextMenuPatient.balance < 0
                          ? `مانده بدهی: ${formatToman(Math.abs(contextMenuPatient.balance))}`
                          : 'حساب تسویه · ثبت دریافتی جدید'}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-emerald-600" />
                </button>

                {/* 4. Full Edit Patient Record */}
                <button
                  type="button"
                  onClick={() => {
                    const target = contextMenuPatient;
                    setContextMenuPatient(null);
                    openEditPatientModal(target);
                  }}
                  className="w-full p-3 rounded-2xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 flex items-center justify-between transition-all active:scale-98 cursor-pointer text-right"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-2xs">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">ویرایش کامل مشخصات و سوابق پرونده</span>
                      <span className="text-[10px] text-cyan-800 font-bold">
                        نام، کدملی، همراه، سن، بیمه و هشدارهای پزشکی
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-cyan-600" />
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Full Edit Patient Record Modal */}
      {editingPatient && (
        <ViewportModalPortal isOpen={Boolean(editingPatient)}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`ویرایش کامل پرونده ${editingPatient.fullName}`}
            className="fixed inset-0 z-[120] bg-emerald-950/40 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingPatient(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-cyan-50/95 via-white to-emerald-50/50 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border-2 border-cyan-200/90 shadow-2xl flex flex-col overflow-hidden text-right"
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-cyan-200/80 bg-white/95 shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-cyan-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">ویرایش کامل پرونده بیمار</h3>
                      <span className="text-[10px] font-bold text-cyan-700">
                        به‌روزرسانی آنی مشخصات هویتی، تماس و سوابق سیستمیک
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPatient(null)}
                    aria-label="بستن ویرایش پرونده بیمار"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Edit Form */}
              <form id="edit-patient-form" onSubmit={handleSaveEditedPatient} className="p-4 space-y-3 text-xs flex-1 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <label className="text-slate-700 block mb-1 font-bold">شماره پرونده *</label>
                    <input aria-label="شماره پرونده"
                      type="text"
                      required
                      value={editFileNumber}
                      onChange={(e) => setEditFileNumber(e.target.value)}
                      className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-2 text-cyan-900 font-mono font-black text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    />
                  </div>
                  <div className="col-span-7">
                    <label className="text-slate-700 block mb-1 font-bold">نام و نام خانوادگی کامل *</label>
                    <input aria-label="نام و نام خانوادگی کامل"
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 block mb-1 font-bold">کد ملی (۱۰ رقم)</label>
                    <input aria-label="کد ملی (۱۰ رقم)"
                      type="text"
                      value={editNationalId}
                      onChange={(e) => setEditNationalId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 block mb-1 font-bold">شماره تماس همراه *</label>
                    <input aria-label="شماره تماس همراه"
                      type="text"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="text-slate-700 block mb-1 font-bold">سن بیمار</label>
                    <input aria-label="سن بیمار"
                      type="number"
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-slate-900 font-mono text-center text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-slate-700 block mb-1 font-bold">جنسیت</label>
                    <select aria-label="جنسیت"
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value as 'مرد' | 'زن')}
                      className="w-full bg-white border border-slate-300 rounded-xl px-1.5 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    >
                      <option value="مرد">مرد</option>
                      <option value="زن">زن</option>
                    </select>
                  </div>
                  <div className="col-span-6">
                    <label className="text-slate-700 block mb-1 font-bold">پوشش بیمه</label>
                    <select aria-label="پوشش بیمه بیمار"
                      value={editInsurance}
                      onChange={(e) => setEditInsurance(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-cyan-600 shadow-2xs"
                    >
                      <option value="آزاد">آزاد (بدون بیمه)</option>
                      <option value="تامین اجتماعی">تامین اجتماعی</option>
                      <option value="خدمات درمانی">خدمات درمانی / سلامت</option>
                      <option value="نیروهای مسلح">نیروهای مسلح</option>
                      <option value="بیمه تکمیلی">بیمه تکمیلی</option>
                    </select>
                  </div>
                </div>

                {/* Medical History Editor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-bold">سوابق پزشکی و هشدارهای سیستمیک:</span>
                    <span className="text-[10px] text-amber-700 font-bold">کلیک برای فعال/غیرفعال‌سازی</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {medicalConditionOptions.map(cond => {
                      const isChecked = editMedicalAlerts.includes(cond);
                      return (
                        <button
                          type="button"
                          key={cond}
                          onClick={() => {
                            selection();
                            if (isChecked) {
                              setEditMedicalAlerts(editMedicalAlerts.filter(c => c !== cond));
                            } else {
                              setEditMedicalAlerts([...editMedicalAlerts, cond]);
                            }
                          }}
                          className={`text-right px-2 py-1.5 rounded-lg text-[10px] font-bold border truncate transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '} {cond}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Medical Alert Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={editCustomAlertInput}
                      onChange={(e) => setEditCustomAlertInput(e.target.value)}
                      placeholder="افزودن حساسیت یا بیماری خاص دیگر (مثلاً: لیدوکائین، آسم)..."
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = editCustomAlertInput.trim();
                        if (val && !editMedicalAlerts.includes(val)) {
                          setEditMedicalAlerts([...editMedicalAlerts, val]);
                          setEditCustomAlertInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10.5px] font-black cursor-pointer shrink-0"
                    >
                      + افزودن هشدار
                    </button>
                  </div>
                </div>

                {/* Notes & Insurance */}
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">یادداشت پرونده، بیمه و علت مراجعه</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="یادداشت‌های بالینی، نوع بیمه، توضیحات پذیرش..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-cyan-600 shadow-2xs resize-none"
                  />
                </div>

                {/* Safe 2-Step Delete / Archive Record Option (Manager Only) */}
                {onDeletePatient && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold text-slate-500">
                      {isManager
                        ? 'حذف یا بایگانی پرونده تکراری/آزمایشی (انتقال به گاوصندوق مدیر):'
                        : '🔒 حفاظت پرونده: حذف پرونده بیمار فقط با دسترسی مدیر کلینیک مجاز است.'}
                    </span>
                    {isManager && (!confirmDeletePatientStep ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePatientStep(true)}
                        className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10.5px] font-black cursor-pointer"
                      >
                        بایگانی / حذف پرونده
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeletePatient(editingPatient.id);
                            setEditingPatient(null);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black cursor-pointer shadow-xs"
                        >
                          تایید انتقال به بایگانی
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePatientStep(false)}
                          className="px-2 py-1 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold cursor-pointer"
                        >
                          لغو
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </form>

              {/* Fixed Bottom Action Footer */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-cyan-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  form="edit-patient-form"
                  className="w-2/3 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md shadow-cyan-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  ذخیره تغییرات پرونده ✓
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Quick Appointment Full-Page Sheet (Triggered from Quick Action Context Menu) */}
      {quickAptPatient && (
        <ViewportModalPortal isOpen={Boolean(quickAptPatient)}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`ثبت سریع نوبت برای ${quickAptPatient.fullName}`}
            className="fixed inset-0 z-[115] bg-purple-950/35 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setQuickAptPatient(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-purple-50/95 via-white to-indigo-50/40 rounded-none sm:rounded-[28px] border-0 sm:border border-purple-200 shadow-2xl flex flex-col overflow-hidden text-right"
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-3 border-b border-purple-200/80 bg-white/95 shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-purple-300 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">ثبت سریع نوبت دندانپزشکی</h3>
                      <span className="text-[10px] font-bold text-purple-700">
                        بیمار: {quickAptPatient.fullName} ({toPersianDigits(quickAptPatient.fileNumber)})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickAptPatient(null)}
                    aria-label="بستن ثبت سریع نوبت"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Body */}
              <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-purple-50/80 border border-purple-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-purple-700 font-bold block">شماره تماس بیمار:</span>
                    <span className="font-mono font-black text-slate-900">{toPersianDigits(quickAptPatient.phone)}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-white text-purple-800 px-2.5 py-1 rounded-xl border border-purple-200">
                    تاریخ: امروز {getCurrentPersianDate()}
                  </span>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1.5">انتخاب ساعت نوبت (۸ صبح تا ۱۱ شب · عربیلکی):</label>
                  <WheelTimePicker
                    value={quickAptTime}
                    unitName={quickAptUnit}
                    onChange={(t) => setQuickAptTime(t)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">یونیت درمانی</label>
                    <select aria-label="یونیت درمانی"
                      value={quickAptUnit}
                      onChange={(e) => setQuickAptUnit(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="یونیت آبی">یونیت آبی</option>
                      <option value="یونیت زرد">یونیت زرد</option>
                      <option value="یونیت جراحی">یونیت جراحی</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">پزشک معالج</label>
                    <select aria-label="پزشک معالج"
                      value={quickAptDoctor}
                      onChange={(e) => setQuickAptDoctor(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="دکتر مهدی امیری">دکتر مهدی امیری</option>
                      <option value="دکتر سارا رضوانی">دکتر سارا رضوانی</option>
                      <option value="دکتر علی مرادی">دکتر علی مرادی</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">شرح درمان یا علت مراجعه</label>
                  <input aria-label="شرح درمان یا علت مراجعه"
                    type="text"
                    value={quickAptTreatment}
                    onChange={(e) => setQuickAptTreatment(e.target.value)}
                    className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Fixed Bottom Footer (2-Step Mistake-Proof Confirmation) */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-purple-200/80 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (quickAptConfirmStep) setQuickAptConfirmStep(false);
                    else setQuickAptPatient(null);
                  }}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  {quickAptConfirmStep ? 'بازگشت' : 'انصراف'}
                </button>
                {!quickAptConfirmStep ? (
                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      setQuickAptConfirmStep(true);
                    }}
                    className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
                  >
                    مرحله ۱: بررسی و ثبت نوبت
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      success();
                      if (onQuickAddAppointment) {
                        onQuickAddAppointment({
                          patientId: quickAptPatient.id,
                          patientName: quickAptPatient.fullName,
                          phone: quickAptPatient.phone,
                          date: getCurrentPersianDate(),
                          time: quickAptTime,
                          durationMinutes: 45,
                          treatment: quickAptTreatment,
                          unit: quickAptUnit as any,
                          status: 'scheduled',
                          doctor: quickAptDoctor
                        });
                      }
                      setQuickAptPatient(null);
                      setQuickAptConfirmStep(false);
                    }}
                    className="w-2/3 min-h-[44px] py-2.5 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    تایید و ثبت قطعی نوبت ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Printable A4 Palmer Treatment Plan & Clinical File Modal */}
      {printablePalmerPatient && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[120] bg-emerald-950/35 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
            onClick={() => setPrintablePalmerPatient(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`فرم رسمی پرونده بالینی و چارت پالمر ${printablePalmerPatient.fullName}`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] bg-white text-slate-900 rounded-[28px] border-2 border-teal-500 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header (Bright QBank Teal-Emerald) */}
              <div className="p-4 bg-gradient-to-l from-teal-50 via-white to-emerald-50 text-slate-900 border-b border-teal-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">فرم رسمی پرونده بالینی و چارت دندانی پالمر (A4)</h3>
                    <span className="text-[10.5px] text-teal-800 font-bold block">
                      کلینیک تخصصی دندانپزشکی مینادنتال · مدیریت: دکتر مهدی امیری
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintablePalmerPatient(null)}
                  aria-label="بستن فرم چاپی پالمر"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable A4 Sheet Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs bg-slate-50/50">
                {/* Patient Identity Box */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block">نام و نام خانوادگی بیمار</span>
                    <span className="font-black text-slate-900 text-xs">{printablePalmerPatient.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">شماره پرونده</span>
                    <span className="font-mono font-black text-teal-700">{toPersianDigits(printablePalmerPatient.fileNumber)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">تلفن همراه</span>
                    <span className="font-mono font-bold text-slate-800">{toPersianDigits(printablePalmerPatient.phone)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">تاریخ صدور برگه</span>
                    <span className="font-mono font-bold text-slate-800">{toPersianDigits(getCurrentPersianDate())}</span>
                  </div>
                </div>

                {/* Official 4-Quadrant Palmer Cross Visual */}
                <div className="p-4 rounded-2xl bg-white border-2 border-slate-300 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-black text-slate-900">شماتیک ۴ ربع چارت پالمر (Palmer Notation Cross)</span>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                      استاندارد بین‌المللی FDI / Palmer
                    </span>
                  </div>

                  <div className="grid grid-cols-2 border-2 border-slate-800 rounded-xl overflow-hidden text-center font-mono text-[11px]" dir="ltr">
                    <div className="p-2.5 border-r-2 border-b-2 border-slate-800 bg-teal-50/30">
                      <div className="text-[9.5px] font-sans font-black text-slate-600 mb-1">UR (بالا راست)</div>
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {[8, 7, 6, 5, 4, 3, 2, 1].map(n => {
                          const hasCond = printablePalmerPatient.teethConditions?.[`UR_${n}`] || printablePalmerPatient.teethConditions?.[`UR-${n}`] || printablePalmerPatient.teethConditions?.[`UR${n}`];
                          return (
                            <span
                              key={`UR${n}`}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                                hasCond ? 'bg-teal-600 text-white ring-2 ring-teal-300' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-2.5 border-b-2 border-slate-800 bg-teal-50/30">
                      <div className="text-[9.5px] font-sans font-black text-slate-600 mb-1">UL (بالا چپ)</div>
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
                          const hasCond = printablePalmerPatient.teethConditions?.[`UL_${n}`] || printablePalmerPatient.teethConditions?.[`UL-${n}`] || printablePalmerPatient.teethConditions?.[`UL${n}`];
                          return (
                            <span
                              key={`UL${n}`}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                                hasCond ? 'bg-teal-600 text-white ring-2 ring-teal-300' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-2.5 border-r-2 border-slate-800 bg-cyan-50/30">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {[8, 7, 6, 5, 4, 3, 2, 1].map(n => {
                          const hasCond = printablePalmerPatient.teethConditions?.[`LR_${n}`] || printablePalmerPatient.teethConditions?.[`LR-${n}`] || printablePalmerPatient.teethConditions?.[`LR${n}`];
                          return (
                            <span
                              key={`LR${n}`}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                                hasCond ? 'bg-cyan-600 text-white ring-2 ring-cyan-300' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-[9.5px] font-sans font-black text-slate-600 mt-1">LR (پایین راست)</div>
                    </div>
                    <div className="p-2.5 bg-cyan-50/30">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
                          const hasCond = printablePalmerPatient.teethConditions?.[`LL_${n}`] || printablePalmerPatient.teethConditions?.[`LL-${n}`] || printablePalmerPatient.teethConditions?.[`LL${n}`];
                          return (
                            <span
                              key={`LL${n}`}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                                hasCond ? 'bg-cyan-600 text-white ring-2 ring-cyan-300' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-[9.5px] font-sans font-black text-slate-600 mt-1">LL (پایین چپ)</div>
                    </div>
                  </div>
                </div>

                {/* Treatments & Financial Summary Table */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
                  <h4 className="font-black text-slate-900">شرح درمان‌های ثبت‌شده و وضعیت مالی</h4>
                  <div className="divide-y divide-slate-100">
                    {Object.entries(printablePalmerPatient.teethConditions || {}).map(([key, cond]) => (
                      <div key={key} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-mono font-black text-[11px]">
                            {cond.quadrant}{cond.toothNumber}
                          </span>
                          <span className="font-bold text-slate-800">{getPersianTreatmentName(cond.treatment || cond.status)}</span>
                          <span className="text-[10px] text-slate-500">({cond.doctorName || 'دکتر مهدی امیری'})</span>
                        </div>
                        <span className="font-mono font-black text-slate-900">
                          {formatToman(cond.cost || 3500000)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-slate-50">
                      <span className="text-[10px] text-slate-500 block">جمع کل درمان</span>
                      <span className="font-mono font-black text-slate-900">{formatToman(printablePalmerPatient.totalCost)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50">
                      <span className="text-[10px] text-emerald-700 block">پرداخت شده</span>
                      <span className="font-mono font-black text-emerald-800">{formatToman(printablePalmerPatient.paidAmount)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50">
                      <span className="text-[10px] text-rose-700 block">مانده حساب</span>
                      <span className="font-mono font-black text-rose-800">{formatToman(Math.abs(printablePalmerPatient.balance))}</span>
                    </div>
                  </div>
                </div>

                {/* Official Stamp & Signature */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-l from-teal-50 to-emerald-50 border border-teal-200 flex items-center justify-between">
                  <div>
                    <span className="font-black text-teal-950 block">مهر و امضای رسمی کلینیک تخصصی مینادنتال</span>
                    <span className="text-[10.5px] text-slate-600">دکتر مهدی امیری · جراح و دندانپزشک (نظام پزشکی: ۱۲۸۴۹۰)</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl border-2 border-dashed border-teal-600 text-teal-900 font-black text-[10.5px] rotate-[-3deg]">
                    تایید اصالت پرونده ✓
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrintablePalmerPatient(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    success();
                    window.print();
                  }}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ مستقیم برگه A4</span>
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}
    </div>
  );
};
