import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, Layers, AlertCircle, Sparkles, ShieldCheck, 
  Info, Eye, Edit3, ArrowDown, Activity, Clock, DollarSign,
  PenTool, Eraser, RotateCcw, Trash2, Highlighter, Palette,
  Mic, MicOff, Volume2, Baby, User, Radio, Play, CheckCircle2, History, Plus,
  ChevronDown, ChevronUp, Stethoscope, Wallet, FlaskConical
} from 'lucide-react';
import { ToothSurface, TreatmentType, ToothCondition, Patient, UserAccount, ReminderConfig } from '../types/dental';
import { formatToman, toPersianDigits, toEnglishDigits, getCurrentPersianDate, getRelativePersianDate } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { ReminderOptionPicker } from './ReminderOptionPicker';
import { getDefaultReminderConfig } from '../services/reminderNotificationService';
import {
  evaluateEndodonticDiagnosis,
  evaluatePeriodontalRisk,
  evaluatePatientTreatmentSafety,
  getTreatmentClinicalProtocol
} from '../utils/treatmentIntelligence';

interface PalmerChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patient?: Patient | null;
  patients?: Patient[];
  onSelectPatient?: (patient: Patient) => void;
  initialQuadrant?: 'UR' | 'UL' | 'LL' | 'LR';
  initialTooth?: number;
  teethConditions?: Record<string, ToothCondition>;
  users?: UserAccount[];
  isManager?: boolean;
  onDeleteToothTreatment?: (patientId: string, toothKey: string) => void;
  onLaunchLabFromTreatment?: (prefill: { patientId?: string; toothNumber: string; workType: string }) => void;
  onLaunchPaymentFromTreatment?: (patientId?: string) => void;
  onLaunchImplantFromTreatment?: (patientId?: string, toothNumber?: string) => void;
  onSaveTreatment: (treatmentData: {
    patientId?: string;
    quadrant: 'UR' | 'UL' | 'LL' | 'LR';
    toothNumber: number;
    surfaces: ToothSurface[];
    treatment: TreatmentType;
    status?: ToothCondition['status'];
    cost: number;
    baseCost?: number;
    discountPercent?: number;
    notes: string;
    annotations?: string;
    doctorName?: string;
    surgicalNotes?: string;
    endoMetrics?: ToothCondition['endoMetrics'];
    perioMetrics?: ToothCondition['perioMetrics'];
    vitalityMetrics?: ToothCondition['vitalityMetrics'];
    reminderConfig?: ReminderConfig;
  }) => void;
}

const TOOTH_NAMES: Record<number, { farsi: string; english: string }> = {
  1: { farsi: 'ثنایای مرکزی (سانترال)', english: 'Central Incisor' },
  2: { farsi: 'ثنایای جانبی (لترال)', english: 'Lateral Incisor' },
  3: { farsi: 'نیش (کانین)', english: 'Canine' },
  4: { farsi: 'آسیای کوچک اول (پرمولار ۱)', english: '1st Premolar' },
  5: { farsi: 'آسیای کوچک دوم (پرمولار ۲)', english: '2nd Premolar' },
  6: { farsi: 'آسیای بزرگ اول (مولار ۶)', english: '1st Molar' },
  7: { farsi: 'آسیای بزرگ دوم (مولار ۷)', english: '2nd Molar' },
  8: { farsi: 'دندان عقل (مولار ۸)', english: '3rd Molar' },
};

const PEDIATRIC_TOOTH_NAMES: Record<number, { farsi: string; letter: string; english: string }> = {
  1: { farsi: 'ثنایای مرکزی شیری (سانترال A)', letter: 'A', english: 'Primary Central Incisor' },
  2: { farsi: 'ثنایای جانبی شیری (لترال B)', letter: 'B', english: 'Primary Lateral Incisor' },
  3: { farsi: 'نیش شیری (کانین C)', letter: 'C', english: 'Primary Canine' },
  4: { farsi: 'آسیای اول شیری (پرمولار/مولار ۱ D)', letter: 'D', english: 'Primary 1st Molar' },
  5: { farsi: 'آسیای دوم شیری (مولار ۲ E)', letter: 'E', english: 'Primary 2nd Molar' },
};

const TREATMENT_LABELS: Record<TreatmentType, string> = {
  composite: 'ترمیم کامپوزیت نانوهیبرید',
  amalgam: 'ترمیم آمالگام سیلور',
  endo: 'عصب‌کشی (درمان ریشه تخصصی)',
  crown_zirconia: 'روکش تمام زیرکونیا مولتی‌لیر',
  crown_pfm: 'روکش پرسلن متال PFM',
  laminate: 'لمینت سرامیکی ایمکس E-Max',
  implant: 'کاشت فیکسچر ایمپلنت',
  extraction: 'کشیدن دندان / جراحی',
  scaling: 'جرم‌گیری تخصصی فکین',
  bleaching: 'بلیچینگ مطب دو فک',
  pulpotomy: 'پالپوتومی اطفال (پالپوتومی تاجی)',
  pulpectomy: 'پالپکتومی کامل ریشه اطفال',
  ss_crown: 'روکش استیل فلزی اطفال (SS Crown)',
  fissure_sealant: 'فیشورسیلنت پیشگیرانه شیارها',
  fluoride: 'فلورایدتراپی موضعی وارنیش',
  space_maintainer: 'فضا نگهدارنده بند و لوپ اطفال'
};

const SURFACE_NAMES: Record<ToothSurface, string> = {
  occlusal: 'اوکلوزال (سطح جونده)',
  mesial: 'مزیال (سمت خط وسط)',
  distal: 'دیستال (دور از خط وسط)',
  buccal: 'باکال (سمت گونه/لب)',
  lingual: 'لینگوال (سمت زبان/کام)',
  rootCanal: 'کانال‌های ریشه (اندو)'
};

const EMPTY_CONDITIONS: Record<string, ToothCondition> = {};

const resolveToothConditionEntry = (
  conditions: Record<string, ToothCondition>,
  quadrant: 'UR' | 'UL' | 'LL' | 'LR',
  toothNumber: number
): { key: string; condition?: ToothCondition } => {
  const canonicalKey = `${quadrant}_${toothNumber}`;
  if (conditions[canonicalKey]) return { key: canonicalKey, condition: conditions[canonicalKey] };
  const dashKey = `${quadrant}-${toothNumber}`;
  if (conditions[dashKey]) return { key: dashKey, condition: conditions[dashKey] };
  const bareKey = `${quadrant}${toothNumber}`;
  if (conditions[bareKey]) return { key: bareKey, condition: conditions[bareKey] };
  return { key: canonicalKey, condition: undefined };
};

export const PalmerChartModal: React.FC<PalmerChartModalProps> = ({
  isOpen,
  onClose,
  patientName,
  patient,
  patients = [],
  onSelectPatient,
  initialQuadrant,
  initialTooth,
  teethConditions = EMPTY_CONDITIONS,
  users = [],
  isManager = true,
  onDeleteToothTreatment,
  onLaunchLabFromTreatment,
  onLaunchPaymentFromTreatment,
  onLaunchImplantFromTreatment,
  onSaveTreatment
}) => {
  const { selection, impactLight, impactHeavy, success } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);

  const effectivePatient = patient || (patients.length > 0 ? patients[0] : null);
  const effectivePatientName = effectivePatient?.fullName || patientName;

  const [selectedQuadrant, setSelectedQuadrant] = useState<'UR' | 'UL' | 'LL' | 'LR'>('UR');
  const [selectedTooth, setSelectedTooth] = useState<number>(6);
  const [inspectedTooth, setInspectedTooth] = useState<{ quadrant: 'UR' | 'UL' | 'LL' | 'LR'; toothNumber: number } | null>(null);
  const [hoveredTooth, setHoveredTooth] = useState<{ quadrant: 'UR' | 'UL' | 'LL' | 'LR'; toothNumber: number } | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'chart' | 'timeline'>('chart');
  const [selectedSurfaces, setSelectedSurfaces] = useState<ToothSurface[]>(['occlusal', 'mesial']);
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentType>('composite');
  const [treatmentStatus, setTreatmentStatus] = useState<ToothCondition['status']>('in_progress');
  const [baseCost, setBaseCost] = useState<number>(2400000);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [manualDiscountAmount, setManualDiscountAmount] = useState<number>(0);
  const [treatmentCost, setTreatmentCost] = useState<number>(2400000);
  const [treatmentNotes, setTreatmentNotes] = useState<string>('ترمیم ۲ سطحی کامپوزیت خلفی همرنگ');
  const [surgicalNotes, setSurgicalNotes] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('دکتر مهدی امیری');
  const [confirmingSave, setConfirmingSave] = useState<boolean>(false);
  const [confirmDeleteTooth, setConfirmDeleteTooth] = useState<boolean>(false);
  const [discountUnlockedByPin, setDiscountUnlockedByPin] = useState<boolean>(false);
  const [showInlinePinBox, setShowInlinePinBox] = useState<boolean>(false);
  const [inlinePinInput, setInlinePinInput] = useState<string>('');
  const [inlinePinError, setInlinePinError] = useState<string | null>(null);
  const [showCatalogDropdown, setShowCatalogDropdown] = useState<boolean>(false);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('3d_before'));
  const [celebratingToothKey, setCelebratingToothKey] = useState<string | null>(null);
  const [celebrationSeq, setCelebrationSeq] = useState<number>(0);
  const celebrationTimerRef = useRef<number | null>(null);
  const [postSaveActionState, setPostSaveActionState] = useState<{
    patientId?: string;
    toothLabel: string;
    workType: string;
    treatment: TreatmentType;
    cost: number;
  } | null>(null);

  const canModifyPrice = isManager || discountUnlockedByPin;

  const triggerToothCompletionCelebration = (quadrant: 'UR' | 'UL' | 'LL' | 'LR', toothNumber: number) => {
    const key = `${quadrant}_${toothNumber}`;
    setCelebratingToothKey(key);
    setCelebrationSeq((s) => s + 1);
    success();
    if (typeof window !== 'undefined') {
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
      celebrationTimerRef.current = window.setTimeout(() => {
        setCelebratingToothKey((cur) => (cur === key ? null : cur));
      }, 2600);
    }
  };

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      if (initialQuadrant) setSelectedQuadrant(initialQuadrant);
      if (initialTooth && initialTooth >= 1 && initialTooth <= 8) setSelectedTooth(initialTooth);
      setPostSaveActionState(null);
      setConfirmingSave(false);
      setConfirmDeleteTooth(false);
      setDiscountUnlockedByPin(false);
      setShowInlinePinBox(false);
      setInlinePinInput('');
      setInlinePinError(null);
      setCelebratingToothKey(null);
    }
  }, [isOpen, effectivePatient?.id, initialQuadrant, initialTooth]);

  const doctorOptions = React.useMemo(() => {
    const cleanDoctorName = (raw: string) =>
      raw.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

    const extractRoleHint = (raw: string, fallbackRole: string) => {
      const m = raw.match(/\(([^)]+)\)/);
      if (m && m[1]) {
        const hint = m[1].trim();
        if (hint.includes('مدیر')) return 'مدیر و جراح';
        return hint;
      }
      return fallbackRole;
    };

    const defaults = [
      { name: 'دکتر مهدی امیری', role: 'مدیر و جراح' },
      { name: 'دکتر سارا نوری', role: 'متخصص اندو' },
      { name: 'دکتر کاوه راد', role: 'متخصص پروتز' }
    ];

    const dedupMap = new Map<string, { name: string; role: string }>();

    users
      .filter((u) => u.role === 'doctor' || u.role === 'admin' || u.fullName.includes('دکتر'))
      .forEach((u) => {
        const baseName = cleanDoctorName(u.fullName);
        if (!baseName || dedupMap.has(baseName)) return;
        const role = extractRoleHint(
          u.fullName,
          u.role === 'admin' ? 'مدیر و جراح' : 'دندانپزشک معالج'
        );
        dedupMap.set(baseName, { name: baseName, role });
      });

    defaults.forEach((d) => {
      const baseName = cleanDoctorName(d.name);
      if (!dedupMap.has(baseName)) {
        dedupMap.set(baseName, { name: baseName, role: d.role });
      }
    });

    return Array.from(dedupMap.values()).slice(0, 6);
  }, [users]);

  const clinicTariffsCatalog = React.useMemo<Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    price: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem('minadental_tariffs_catalog_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 't1', code: 'D-101', name: 'ویزیت و معاینه اولیه با چارت پالمر', category: 'restorative', price: 250000 },
      { id: 't2', code: 'D-201', name: 'ترمیم کامپوزیت قدامی زیبایی (سانترال/لترال)', category: 'restorative', price: 2400000 },
      { id: 't3', code: 'D-202', name: 'ترمیم کامپوزیت خلفی کلاس ۲ (MO / DO / MOD)', category: 'restorative', price: 1900000 },
      { id: 't4', code: 'D-203', name: 'ترمیم آمالگام سیلور دو سطحی', category: 'restorative', price: 1500000 },
      { id: 't5', code: 'D-301', name: 'عصب‌کشی تک‌کانال قدامی (اندودانتیکس)', category: 'endo', price: 2600000 },
      { id: 't6', code: 'D-302', name: 'عصب‌کشی مولار ۳ کاناله تخصصی روت‌کانال', category: 'endo', price: 4200000 },
      { id: 't8', code: 'D-401', name: 'جراحی کاشت فیکسچر ایمپلنت کره‌ای Dentium', category: 'implant', price: 12500000 },
      { id: 't9', code: 'D-402', name: 'جراحی کاشت فیکسچر ایمپلنت سوئیسی Straumann', category: 'implant', price: 24000000 },
      { id: 't11', code: 'D-501', name: 'روکش تمام زیرکونیا مولتی‌لیر CAD/CAM', category: 'prosthetics', price: 4800000 },
      { id: 't12', code: 'D-502', name: 'روکش پرسلن متال PFM', category: 'prosthetics', price: 3200000 },
      { id: 't13', code: 'D-503', name: 'لمینت سرامیکی پرسلن E-Max', category: 'prosthetics', price: 5500000 },
      { id: 't14', code: 'D-601', name: 'پالپوتومی اطفال همراه ترمیم همرنگ', category: 'pediatric', price: 1800000 },
      { id: 't15', code: 'D-602', name: 'روکش استیل ضدزنگ اطفال (SS Crown)', category: 'pediatric', price: 2100000 },
      { id: 't17', code: 'D-701', name: 'جرم‌گیری تخصصی و بروساژ کامل فک بالا و پایین', category: 'periodontics', price: 1200000 },
    ];
  }, [isOpen]);

  // Endo Working Length & Apex Log State
  const [canalMB1, setCanalMB1] = useState<string>('20.5');
  const [canalMB2, setCanalMB2] = useState<string>('19.0');
  const [canalML, setCanalML] = useState<string>('20.0');
  const [canalDP, setCanalDP] = useState<string>('21.5');
  const [masterFile, setMasterFile] = useState<string>('#25 .06');
  const [sealerType, setSealerType] = useState<string>('AH Plus + Gutta');

  // 6-Point Periodontal Pocket & Mobility State
  const [showPerioChart, setShowPerioChart] = useState<boolean>(false);
  const [perioPockets, setPerioPockets] = useState<Record<'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL', number>>({
    MB: 2, B: 2, DB: 3, ML: 2, L: 2, DL: 3
  });
  const [toothMobility, setToothMobility] = useState<'0' | 'I' | 'II' | 'III'>('0');
  const [perioBop, setPerioBop] = useState<boolean>(false);

  // Pulp Vitality & Periapical Diagnostic Matrix State
  const [showVitalityMatrix, setShowVitalityMatrix] = useState<boolean>(false);
  const [coldTest, setColdTest] = useState<'نرمال' | 'پالپیت برگشت‌پذیر' | 'پالپیت غیرقابل‌برگشت' | 'نکروز (بدون پاسخ)'>('نرمال');
  const [percussionTest, setPercussionTest] = useState<'منفی (-)' | 'مثبت (+)'>('منفی (-)');
  const [palpationTest, setPalpationTest] = useState<'منفی (-)' | 'مثبت (+)'>('منفی (-)');
  const [eptScore, setEptScore] = useState<string>('35/80');

  // Real-time Chairside CDSS Diagnostics (AAE Endo, AAP Perio, Systemic Safety & Biomaterial Protocol)
  const liveProtocol = React.useMemo(
    () => getTreatmentClinicalProtocol(selectedTreatment, selectedTooth, selectedSurfaces),
    [selectedTreatment, selectedTooth, selectedSurfaces]
  );

  const liveSafety = React.useMemo(
    () =>
      evaluatePatientTreatmentSafety({
        patient: effectivePatient,
        weightKg: effectivePatient && effectivePatient.age <= 12 ? 28 : 70,
        plannedTreatment: selectedTreatment
      }),
    [effectivePatient, selectedTreatment]
  );

  const liveEndoDx = React.useMemo(
    () =>
      evaluateEndodonticDiagnosis({
        coldTest,
        percussion: percussionTest,
        palpation: palpationTest,
        eptScore,
        selectedTreatment,
        surfaces: selectedSurfaces
      }),
    [coldTest, percussionTest, palpationTest, eptScore, selectedTreatment, selectedSurfaces]
  );

  const livePerioEval = React.useMemo(
    () =>
      evaluatePeriodontalRisk({
        pockets: perioPockets,
        mobility: toothMobility,
        bop: perioBop,
        plannedTreatment: selectedTreatment
      }),
    [perioPockets, toothMobility, perioBop, selectedTreatment]
  );

  const applyDiscount = (percent: number) => {
    if (!canModifyPrice && percent > 0) {
      setShowInlinePinBox(true);
      setInlinePinError('اعمال تخفیف نیازمند تایید پین مدیر کلینیک است.');
      return;
    }
    selection();
    setDiscountPercent(percent);
    const discounted = Math.max(0, Math.round(baseCost * (1 - percent / 100)));
    setManualDiscountAmount(Math.max(0, baseCost - discounted));
    setTreatmentCost(discounted);
  };

  const applyManualDiscountToman = (discountToman: number) => {
    if (!canModifyPrice && discountToman > 0) {
      setShowInlinePinBox(true);
      setInlinePinError('اعمال تخفیف دستی نیازمند تایید پین مدیر کلینیک است.');
      return;
    }
    const clampedDiscount = Math.max(0, Math.min(baseCost, discountToman));
    setManualDiscountAmount(clampedDiscount);
    const nextCost = Math.max(0, baseCost - clampedDiscount);
    setTreatmentCost(nextCost);
    if (baseCost > 0) {
      setDiscountPercent(Math.round((clampedDiscount / baseCost) * 100));
    } else {
      setDiscountPercent(0);
    }
  };

  // Canvas Freehand Annotation State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#ef4444'); // Default red for caries
  const [penWidth, setPenWidth] = useState<number>(3);
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);
  const [hasAnnotations, setHasAnnotations] = useState<boolean>(false);
  const [show3dSurfaceDrawer, setShow3dSurfaceDrawer] = useState<boolean>(false);
  const [showDiscountDrawer, setShowDiscountDrawer] = useState<boolean>(false);
  const [showSurgicalNotesDrawer, setShowSurgicalNotesDrawer] = useState<boolean>(false);

  // Dentition Mode: Adult (1-8) vs Pediatric (A-E / 1-5)
  const [dentitionMode, setDentitionMode] = useState<'adult' | 'pediatric'>('adult');

  // Sterile Hands-Free Voice Dictation States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Stop listening on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const parseVoiceCommands = (text: string) => {
    const lower = text.toLowerCase();
    
    // Parse Quadrant
    if (lower.includes('بالا راست') || lower.includes('ur') || lower.includes('راست بالا')) {
      setSelectedQuadrant('UR');
    } else if (lower.includes('بالا چپ') || lower.includes('ul') || lower.includes('چپ بالا')) {
      setSelectedQuadrant('UL');
    } else if (lower.includes('پایین چپ') || lower.includes('ll') || lower.includes('چپ پایین')) {
      setSelectedQuadrant('LL');
    } else if (lower.includes('پایین راست') || lower.includes('lr') || lower.includes('راست پایین')) {
      setSelectedQuadrant('LR');
    }

    // Parse Tooth Number / Letter
    if (dentitionMode === 'adult') {
      if (lower.includes('سانترال') || lower.includes('مرکزی') || lower.includes(' یک ') || lower.includes(' 1 ') || lower.includes(' ۱ ')) {
        setSelectedTooth(1);
      } else if (lower.includes('لترال') || lower.includes('جانبی') || lower.includes(' دو ') || lower.includes(' 2 ') || lower.includes(' ۲ ')) {
        setSelectedTooth(2);
      } else if (lower.includes('نیش') || lower.includes('کانین') || lower.includes(' سه ') || lower.includes(' 3 ') || lower.includes(' ۳ ')) {
        setSelectedTooth(3);
      } else if (lower.includes('پرمولار یک') || lower.includes(' چهار ') || lower.includes(' 4 ') || lower.includes(' ۴ ')) {
        setSelectedTooth(4);
      } else if (lower.includes('پرمولار دو') || lower.includes(' پنج ') || lower.includes(' 5 ') || lower.includes(' ۵ ')) {
        setSelectedTooth(5);
      } else if (lower.includes('مولار شش') || lower.includes(' شش ') || lower.includes(' 6 ') || lower.includes(' ۶ ')) {
        setSelectedTooth(6);
      } else if (lower.includes('مولار هفت') || lower.includes(' هفت ') || lower.includes(' 7 ') || lower.includes(' ۷ ')) {
        setSelectedTooth(7);
      } else if (lower.includes('عقل') || lower.includes(' هشت ') || lower.includes(' 8 ') || lower.includes(' ۸ ')) {
        setSelectedTooth(8);
      }
    } else {
      if (lower.includes('a') || lower.includes('ای') || lower.includes('سانترال شیری') || lower.includes('یک')) setSelectedTooth(1);
      else if (lower.includes('b') || lower.includes('بی') || lower.includes('لترال شیری') || lower.includes('دو')) setSelectedTooth(2);
      else if (lower.includes('c') || lower.includes('سی') || lower.includes('نیش شیری') || lower.includes('سه')) setSelectedTooth(3);
      else if (lower.includes('d') || lower.includes('دی') || lower.includes('مولار اول شیری') || lower.includes('چهار')) setSelectedTooth(4);
      else if (lower.includes('e') || lower.includes('ای') || lower.includes('مولار دوم شیری') || lower.includes('پنج')) setSelectedTooth(5);
    }

    // Parse Surfaces
    const detectedSurfaces: ToothSurface[] = [];
    if (lower.includes('اوکلوزال') || lower.includes('جونده') || lower.includes('سطح o')) detectedSurfaces.push('occlusal');
    if (lower.includes('مزیال') || lower.includes('سطح m')) detectedSurfaces.push('mesial');
    if (lower.includes('دیستال') || lower.includes('سطح d')) detectedSurfaces.push('distal');
    if (lower.includes('باکال') || lower.includes('لب') || lower.includes('گونه') || lower.includes('سطح b')) detectedSurfaces.push('buccal');
    if (lower.includes('لینگوال') || lower.includes('زبان') || lower.includes('کام') || lower.includes('سطح l')) detectedSurfaces.push('lingual');
    if (lower.includes('کانال') || lower.includes('ریشه') || lower.includes('اندو')) detectedSurfaces.push('rootCanal');
    if (lower.includes('mod') || lower.includes('ام او دی')) {
      detectedSurfaces.push('mesial', 'occlusal', 'distal');
    }
    if (detectedSurfaces.length > 0) {
      setSelectedSurfaces(Array.from(new Set(detectedSurfaces)));
    }

    // Parse Treatments
    if (lower.includes('کامپوزیت')) {
      handleTreatmentChange('composite');
    } else if (lower.includes('آمالگام')) {
      handleTreatmentChange('amalgam');
    } else if (lower.includes('عصب کشی') || lower.includes('درمان ریشه')) {
      handleTreatmentChange('endo');
    } else if (lower.includes('پالپوتومی')) {
      handleTreatmentChange('pulpotomy');
    } else if (lower.includes('پالپکتومی')) {
      handleTreatmentChange('pulpectomy');
    } else if (lower.includes('روکش استیل') || lower.includes('ss crown') || lower.includes('اس اس')) {
      handleTreatmentChange('ss_crown');
    } else if (lower.includes('فیشور') || lower.includes('سیلنت')) {
      handleTreatmentChange('fissure_sealant');
    } else if (lower.includes('فلوراید')) {
      handleTreatmentChange('fluoride');
    } else if (lower.includes('فضا نگهدارنده')) {
      handleTreatmentChange('space_maintainer');
    } else if (lower.includes('زیرکونیا')) {
      handleTreatmentChange('crown_zirconia');
    } else if (lower.includes('ایمپلنت')) {
      handleTreatmentChange('implant');
    } else if (lower.includes('کشیدن')) {
      handleTreatmentChange('extraction');
    }

    setTreatmentNotes(`دیکته صوتی استریل پزشک: ${text}`);
    setVoiceFeedback(`درمان تنظیم شد: ${text}`);
  };

  const toggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceFeedback('تشخیص گفتار در مرورگر فعال نیست. برای آزمایش دست‌آزاد، گفتار شبیه‌سازی شد.');
      parseVoiceCommands('دندان ۶ بالا راست کامپوزیت اوکلوزال و مزیال');
      setTimeout(() => setVoiceFeedback(null), 3500);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceFeedback(null);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        impactLight();
        setVoiceFeedback('دیکته صوتی فعال شد - بگویید: مثلاً «دندان ۶ بالا راست، کامپوزیت MOD»');
      };

      recognition.onresult = (event: any) => {
        let fullStr = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          fullStr += event.results[i][0].transcript;
        }
        setVoiceTranscript(fullStr);
        parseVoiceCommands(fullStr);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Sync effective teeth conditions from patient if provided
  const activeConditions = effectivePatient?.teethConditions || teethConditions || EMPTY_CONDITIONS;

  // Pre-load existing condition data if tooth has one
  useEffect(() => {
    if (!isOpen) return;
    setConfirmDeleteTooth(false);
    const { condition: existing } = resolveToothConditionEntry(activeConditions, selectedQuadrant, selectedTooth);
    if (existing) {
      if (existing.surfaces && existing.surfaces.length > 0) {
        setSelectedSurfaces(existing.surfaces);
      }
      if (existing.treatment) {
        setSelectedTreatment(existing.treatment);
      }
      setTreatmentStatus(existing.status || 'in_progress');
      const resolvedCost = existing.cost ?? 2400000;
      const resolvedBase = existing.baseCost && existing.baseCost >= resolvedCost ? existing.baseCost : resolvedCost;
      setBaseCost(resolvedBase);
      setTreatmentCost(resolvedCost);
      setDiscountPercent(existing.discountPercent ?? (resolvedBase > resolvedCost ? Math.round(((resolvedBase - resolvedCost) / resolvedBase) * 100) : 0));
      setManualDiscountAmount(Math.max(0, resolvedBase - resolvedCost));
      if (existing.doctorName) {
        setSelectedDoctor(existing.doctorName);
      }
      if (existing.notes) {
        setTreatmentNotes(existing.notes);
      }
      setSurgicalNotes(existing.surgicalNotes || '');
      if (existing.endoMetrics) {
        setCanalMB1(existing.endoMetrics.mb1 || '20.5');
        setCanalMB2(existing.endoMetrics.mb2 || '19.0');
        setCanalML(existing.endoMetrics.ml || '20.0');
        setCanalDP(existing.endoMetrics.dp || '21.5');
        if (existing.endoMetrics.masterFile) setMasterFile(existing.endoMetrics.masterFile);
        if (existing.endoMetrics.sealerType) setSealerType(existing.endoMetrics.sealerType);
      }
      if (existing.perioMetrics) {
        setShowPerioChart(true);
        setPerioPockets(existing.perioMetrics.pockets);
        setToothMobility(existing.perioMetrics.mobility);
        setPerioBop(existing.perioMetrics.bop);
      } else {
        setShowPerioChart(false);
      }
      if (existing.vitalityMetrics) {
        setShowVitalityMatrix(true);
        setColdTest(existing.vitalityMetrics.coldTest);
        setPercussionTest(existing.vitalityMetrics.percussion);
        setPalpationTest(existing.vitalityMetrics.palpation);
        setEptScore(existing.vitalityMetrics.eptScore);
      } else {
        setShowVitalityMatrix(false);
      }
    } else {
      setTreatmentStatus('in_progress');
      setSurgicalNotes('');
      setDiscountPercent(0);
      setManualDiscountAmount(0);
      setShowPerioChart(false);
      setShowVitalityMatrix(false);
      const dynPrice = getDynamicTariffPrice(selectedTreatment);
      if (dynPrice > 0) {
        setBaseCost(dynPrice);
        setTreatmentCost(dynPrice);
      }
    }
  }, [selectedQuadrant, selectedTooth, isOpen, effectivePatient?.id]);

  // Synchronize canvas drawing whenever selected tooth or modal changes
  useEffect(() => {
    if (!isOpen) return;
    const { condition: existing } = resolveToothConditionEntry(activeConditions, selectedQuadrant, selectedTooth);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasHistory([]);

    if (existing?.annotations) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasAnnotations(true);
      };
      img.src = existing.annotations;
    } else {
      setHasAnnotations(false);
    }
  }, [selectedQuadrant, selectedTooth, isOpen, effectivePatient?.id]);

  // Canvas Drawing Handlers
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const checkHasAnnotations = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let hasPixels = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 10) {
          hasPixels = true;
          break;
        }
      }
      setHasAnnotations(hasPixels);
    } catch {
      // fallback
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save snapshot for undo
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCanvasHistory(prev => [...prev.slice(-15), snapshot]);
    } catch {
      // ignore
    }

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = penWidth * 4;
    } else if (activeTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = penWidth * 3.5;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = penWidth;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasAnnotations(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    checkHasAnnotations();
  };

  const handleUndo = () => {
    impactLight();
    const canvas = canvasRef.current;
    if (!canvas || canvasHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lastState = canvasHistory[canvasHistory.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setCanvasHistory(prev => prev.slice(0, -1));
    checkHasAnnotations();
  };

  const handleClear = () => {
    impactHeavy();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCanvasHistory(prev => [...prev.slice(-15), snapshot]);
    } catch {
      // ignore
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasAnnotations(false);
  };

  const toggleSurface = (surface: ToothSurface) => {
    selection();
    if (selectedSurfaces.includes(surface)) {
      setSelectedSurfaces(selectedSurfaces.filter(s => s !== surface));
    } else {
      setSelectedSurfaces([...selectedSurfaces, surface]);
    }
  };

  const getDynamicTariffPrice = (treatmentKey: TreatmentType): number => {
    try {
      const saved = localStorage.getItem('minadental_tariffs_catalog_v2');
      if (saved) {
        const list: Array<{ code: string; name: string; price: number }> = JSON.parse(saved);
        const match = list.find(item => {
          if (treatmentKey === 'composite') return item.name.includes('کامپوزیت');
          if (treatmentKey === 'amalgam') return item.name.includes('آمالگام');
          if (treatmentKey === 'endo') return item.name.includes('عصب‌کشی') || item.name.includes('اندو');
          if (treatmentKey === 'crown_zirconia') return item.name.includes('زیرکونیا');
          if (treatmentKey === 'crown_pfm') return item.name.includes('PFM');
          if (treatmentKey === 'laminate') return item.name.includes('لمینت');
          if (treatmentKey === 'implant') return item.name.includes('ایمپلنت');
          if (treatmentKey === 'extraction') return item.name.includes('کشیدن') || item.name.includes('جراحی');
          if (treatmentKey === 'scaling') return item.name.includes('جرم‌گیری');
          if (treatmentKey === 'pulpotomy') return item.name.includes('پالپوتومی');
          if (treatmentKey === 'pulpectomy') return item.name.includes('پالپکتومی');
          if (treatmentKey === 'ss_crown') return item.name.includes('استیل') || item.name.includes('SS');
          if (treatmentKey === 'fissure_sealant') return item.name.includes('فیشور');
          if (treatmentKey === 'fluoride') return item.name.includes('فلوراید');
          return false;
        });
        if (match && match.price > 0) return match.price;
      }
    } catch {}
    return 0;
  };

  const handleTreatmentChange = (t: TreatmentType) => {
    selection();
    setSelectedTreatment(t);
    setDiscountPercent(0);
    setManualDiscountAmount(0);
    const dynamicPrice = getDynamicTariffPrice(t);
    let defaultBase = 2400000;
    let defaultNote = '';

    switch (t) {
      case 'composite': defaultBase = 2400000; defaultNote = 'ترمیم کامپوزیت نانوهیبرید'; break;
      case 'amalgam': defaultBase = 1800000; defaultNote = 'ترمیم آمالگام سیلور'; break;
      case 'endo': defaultBase = 4200000; defaultNote = 'درمان ریشه (روت‌کانال ۳ کانال)'; break;
      case 'crown_zirconia': defaultBase = 4800000; defaultNote = 'روکش تمام زیرکونیا مولتی‌لیر'; break;
      case 'crown_pfm': defaultBase = 3200000; defaultNote = 'روکش پرسلن متال PFM'; break;
      case 'laminate': defaultBase = 5500000; defaultNote = 'لمینت سرامیکی ایمکس زیبایی'; break;
      case 'implant': defaultBase = 14500000; defaultNote = 'کاشت فیکسچر ایمپلنت کره‌ای'; break;
      case 'extraction': defaultBase = 1200000; defaultNote = 'کشیدن دندان / جراحی نسج نرم'; break;
      case 'scaling': defaultBase = 1200000; defaultNote = 'جرم‌گیری کامل ۲ فک'; break;
      case 'bleaching': defaultBase = 7000000; defaultNote = 'بلیچینگ آفیس دو فک'; break;
      case 'pulpotomy': defaultBase = 1800000; defaultNote = 'پالپوتومی تاجی اطفال با فرموکروزول و ZOE'; break;
      case 'pulpectomy': defaultBase = 2400000; defaultNote = 'پالپکتومی کامل ریشه دندان شیری و پرکردن با متاپکس'; break;
      case 'ss_crown': defaultBase = 2100000; defaultNote = 'روکش استیل فلزی اطفال (Stainless Steel Crown)'; break;
      case 'fissure_sealant': defaultBase = 850000; defaultNote = 'فیشورسیلنت رزینی پیشگیرانه شیارهای عمیق'; break;
      case 'fluoride': defaultBase = 650000; defaultNote = 'وارنیش فلورایدتراپی موضعی دو فک'; break;
      case 'space_maintainer': defaultBase = 2600000; defaultNote = 'فضا نگهدارنده ثابت دندان بند و لوپ'; break;
    }

    const finalBase = dynamicPrice > 0 ? dynamicPrice : defaultBase;
    setBaseCost(finalBase);
    setTreatmentCost(finalBase);
    setTreatmentNotes(defaultNote);
  };

  const handleToothClick = (quadrant: 'UR' | 'UL' | 'LL' | 'LR', toothNumber: number) => {
    impactLight();
    setSelectedQuadrant(quadrant);
    setSelectedTooth(toothNumber);
    setInspectedTooth({ quadrant, toothNumber });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    success();
    let annotationsData: string | undefined = undefined;
    const canvas = canvasRef.current;
    if (canvas && hasAnnotations) {
      annotationsData = canvas.toDataURL('image/png');
    }
    const hasEndoData = selectedTreatment === 'endo' || selectedTreatment === 'pulpectomy' || selectedSurfaces.includes('rootCanal');
    const extraEndo = hasEndoData
      ? ` | طول کانال: MB1:${canalMB1}mm, MB2:${canalMB2}mm, ML:${canalML}mm, D/P:${canalDP}mm (${masterFile} · ${sealerType})`
      : '';
    const extraPerio = showPerioChart
      ? ` | پریو ۶ نقطه‌ای: [${perioPockets.MB}-${perioPockets.B}-${perioPockets.DB} / ${perioPockets.ML}-${perioPockets.L}-${perioPockets.DL}mm] لقی:${toothMobility}${perioBop ? ' +BOP' : ''}`
      : '';
    const extraVitality = showVitalityMatrix
      ? ` | تست پالپ: سرما(${coldTest}) · دق(${percussionTest}) · لمس(${palpationTest}) · EPT(${eptScore})`
      : '';
    const cleanBaseNote = treatmentNotes
      .split(' | طول کانال:')[0]
      .split(' | پریو ۶ نقطه‌ای:')[0]
      .split(' | تست پالپ:')[0]
      .replace(/\s*\[تخفیف اعمال‌شده:[^\]]+\]/g, '')
      .trim();
    const baseNoteWithExtras = `${cleanBaseNote}${extraEndo}${extraPerio}${extraVitality}`.trim();
    const effectiveSavedDiscount = Math.max(0, baseCost - treatmentCost);
    const finalNotes = effectiveSavedDiscount > 0
      ? `${baseNoteWithExtras} [تخفیف اعمال‌شده: ${formatToman(effectiveSavedDiscount)}${discountPercent > 0 ? ` (${toPersianDigits(discountPercent)}٪)` : ''}]`.trim()
      : baseNoteWithExtras;
    onSaveTreatment({
      patientId: effectivePatient?.id,
      quadrant: selectedQuadrant,
      toothNumber: selectedTooth,
      surfaces: selectedSurfaces,
      treatment: selectedTreatment,
      status: treatmentStatus,
      cost: treatmentCost,
      baseCost,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      notes: finalNotes,
      annotations: annotationsData,
      doctorName: selectedDoctor,
      surgicalNotes: surgicalNotes.trim() || undefined,
      endoMetrics: hasEndoData
        ? { mb1: canalMB1, mb2: canalMB2, ml: canalML, dp: canalDP, masterFile, sealerType }
        : undefined,
      perioMetrics: showPerioChart
        ? { pockets: perioPockets, mobility: toothMobility, bop: perioBop }
        : undefined,
      vitalityMetrics: showVitalityMatrix
        ? { coldTest, percussion: percussionTest, palpation: palpationTest, eptScore }
        : undefined,
      reminderConfig
    });

    if (treatmentStatus === 'completed') {
      triggerToothCompletionCelebration(selectedQuadrant, selectedTooth);
    }

    if (onLaunchLabFromTreatment || onLaunchPaymentFromTreatment || onLaunchImplantFromTreatment) {
      const workMap: Partial<Record<TreatmentType, string>> = {
        crown_zirconia: 'روکش تمام زیرکونیا',
        crown_pfm: 'روکش متال‌سرامیک (PFM)',
        laminate: 'لمینت E-Max',
        implant: 'اباتمنت و کرون ایمپلنت',
        endo: 'روکش تمام زیرکونیا',
        space_maintainer: 'پلاک شفاف ارتودنسی'
      };
      setPostSaveActionState({
        patientId: effectivePatient?.id,
        toothLabel: `${selectedQuadrant}${selectedTooth}`,
        workType: workMap[selectedTreatment] || 'روکش تمام زیرکونیا',
        treatment: selectedTreatment,
        cost: treatmentCost
      });
    } else {
      onClose();
    }
  };

  const getQuadrantLabel = (q: 'UR' | 'UL' | 'LL' | 'LR') => {
    switch (q) {
      case 'UR': return 'فک بالا راست (UR ⏌)';
      case 'UL': return 'فک بالا چپ (⎿ UL)';
      case 'LL': return 'فک پایین چپ (⎾ LL)';
      case 'LR': return 'فک پایین راست (LR ⏋)';
    }
  };

  // Currently inspected tooth details
  const inspectedResolution = inspectedTooth
    ? resolveToothConditionEntry(activeConditions, inspectedTooth.quadrant, inspectedTooth.toothNumber)
    : null;
  const inspectedKey = inspectedResolution?.key || null;
  const inspectedCondition = inspectedResolution?.condition || null;

  // Hover-state preview summary: last 3 conditions & total cumulative cost for hovered tooth
  const hoveredSummary = React.useMemo(() => {
    if (!hoveredTooth) return null;
    const { condition: cond } = resolveToothConditionEntry(
      activeConditions,
      hoveredTooth.quadrant,
      hoveredTooth.toothNumber
    );

    type HoverCondItem = {
      label: string;
      status: 'planned' | 'in_progress' | 'completed';
      date: string;
      cost: number;
      doctorName?: string;
    };

    const items: HoverCondItem[] = [];
    const seenSignatures = new Set<string>();
    const pushUnique = (entry: HoverCondItem) => {
      const sig = `${entry.label}|${entry.date}|${entry.cost}`;
      if (seenSignatures.has(sig)) return;
      seenSignatures.add(sig);
      items.push(entry);
    };

    if (cond) {
      pushUnique({
        label: TREATMENT_LABELS[cond.treatment] || cond.treatment,
        status: cond.status || 'in_progress',
        date: cond.date || effectivePatient?.lastVisit || 'ثبت جاری',
        cost: Number(cond.cost || 0),
        doctorName: cond.doctorName
      });

      if (Array.isArray(cond.history)) {
        for (const hist of cond.history) {
          pushUnique({
            label: TREATMENT_LABELS[hist.treatment] || hist.treatment,
            status: hist.status || 'completed',
            date: hist.date || 'سابقه قبلی',
            cost: Number(hist.cost || 0),
            doctorName: hist.doctorName
          });
        }
      }
    }

    // Also include matching general treatments or lab orders for this tooth if fewer than 3 entries
    const tagBare = `${hoveredTooth.quadrant}${hoveredTooth.toothNumber}`;
    const tagUnderscore = `${hoveredTooth.quadrant}_${hoveredTooth.toothNumber}`;
    (effectivePatient?.treatments || []).forEach((trt) => {
      const toothText = trt.tooth || '';
      if (toothText.includes(tagBare) || toothText.includes(tagUnderscore)) {
        pushUnique({
          label: trt.treatment,
          status: trt.status || 'completed',
          date: trt.date || '',
          cost: Number(trt.cost || 0),
          doctorName: trt.doctorName
        });
      }
    });

    const totalTreatmentCost = items.reduce((sum, entry) => sum + (Number.isFinite(entry.cost) ? entry.cost : 0), 0);
    const lastThreeConditions = items.slice(0, 3);
    const toothTitle = dentitionMode === 'pediatric'
      ? `دندان شیری ${PEDIATRIC_TOOTH_NAMES[hoveredTooth.toothNumber]?.letter || hoveredTooth.toothNumber} · ${PEDIATRIC_TOOTH_NAMES[hoveredTooth.toothNumber]?.farsi || ''}`
      : `دندان ${toPersianDigits(hoveredTooth.toothNumber)} · ${TOOTH_NAMES[hoveredTooth.toothNumber]?.farsi || ''}`;

    return {
      quadrant: hoveredTooth.quadrant,
      toothNumber: hoveredTooth.toothNumber,
      toothTitle,
      totalConditionsCount: items.length,
      lastThreeConditions,
      totalTreatmentCost
    };
  }, [hoveredTooth, activeConditions, effectivePatient, dentitionMode]);

  if (!isOpen) return null;

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={`چارت دندانی پالمر بیمار ${effectivePatientName}`}
        className="fixed inset-0 z-[100] bg-emerald-950/35 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      >
        <div className="w-full max-w-[100vw] sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] min-w-0 bg-white text-slate-900 rounded-none sm:rounded-[32px] border-0 sm:border border-emerald-200 shadow-2xl overflow-hidden flex flex-col">
          
          {/* Fixed Sheet Header - Always Visible on Mobile */}
          <div className="w-full min-w-0 px-3 pt-3 pb-2.5 border-b border-emerald-200/80 flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-50 via-white to-teal-50 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-black text-sm text-slate-900 whitespace-nowrap">چارت دندانی پالمر</h3>
                  {effectivePatient?.fileNumber && (
                    <span className="text-[9.5px] font-mono font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      #{effectivePatient.fileNumber}
                    </span>
                  )}
                </div>
                {patients.length > 0 && onSelectPatient ? (
                  <div className="mt-0.5 flex items-center gap-1.5 min-w-0 w-full">
                    <select
                      aria-label="انتخاب بیمار فعال در چارت پالمر"
                      value={effectivePatient?.id || ''}
                      onChange={(e) => {
                        const found = patients.find((p) => p.id === e.target.value);
                        if (found) {
                          selection();
                          setPostSaveActionState(null);
                          onSelectPatient(found);
                        }
                      }}
                      className="w-full max-w-full min-w-0 bg-white/95 border border-emerald-300 rounded-xl px-2 py-0.5 text-[11px] font-black text-emerald-900 cursor-pointer focus:outline-none focus:border-emerald-500 truncate"
                    >
                      {patients.map((pat) => (
                        <option key={pat.id} value={pat.id}>
                          بیمار: {pat.fullName} ({pat.fileNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-800 font-bold mt-0.5 truncate">بیمار: {effectivePatientName}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن چارت پالمر"
              className="min-w-[40px] min-h-[40px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors active:scale-90 cursor-pointer shrink-0"
              title="بستن چارت"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Top Modal Navigation: Palmer Chart vs Tooth Historical Timeline */}
          <div className="w-full min-w-0 px-3 py-1.5 bg-slate-50 border-b border-emerald-100/80 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                selection();
                setActiveModalTab('chart');
              }}
              className={`flex-1 min-w-0 py-1.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                activeModalTab === 'chart'
                  ? 'bg-white text-emerald-800 shadow-xs border border-emerald-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">چارت و ثبت درمان</span>
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveModalTab('timeline');
              }}
              className={`flex-1 min-w-0 py-1.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                activeModalTab === 'timeline'
                  ? 'bg-white text-purple-800 shadow-xs border border-purple-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="truncate">خط روند دندان</span>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-2.5 sm:p-3 flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain space-y-2.5 no-scrollbar bg-white">
            {activeModalTab === 'timeline' ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Tooth Selector for Timeline Navigation */}
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span>انتخاب دندان:</span>
                    </span>
                    <span className="text-[10.5px] font-mono font-black text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded-lg border border-purple-200">
                      {selectedQuadrant}{selectedTooth} · {getQuadrantLabel(selectedQuadrant)}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[11px]">
                    {(['UR', 'UL', 'LL', 'LR'] as const).map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          selection();
                          setSelectedQuadrant(q);
                        }}
                        className={`py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                          selectedQuadrant === q
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 justify-center pt-1" dir="ltr">
                    {(dentitionMode === 'adult' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5]).map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          selection();
                          setSelectedTooth(num);
                        }}
                        className={`flex-1 h-7 rounded-lg font-mono text-xs font-black border transition-all cursor-pointer ${
                          selectedTooth === num
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs scale-105'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {dentitionMode === 'adult' ? num : PEDIATRIC_TOOTH_NAMES[num]?.letter || num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tooth Banner */}
                <div className="bg-gradient-to-r from-purple-50 via-white to-indigo-50 p-3.5 rounded-2xl border border-purple-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-xs">
                      {selectedQuadrant}{selectedTooth}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-purple-950">
                        {dentitionMode === 'pediatric'
                          ? `دندان شیری ${PEDIATRIC_TOOTH_NAMES[selectedTooth]?.letter} (${PEDIATRIC_TOOTH_NAMES[selectedTooth]?.farsi})`
                          : `دندان ${toPersianDigits(selectedTooth)} (${TOOTH_NAMES[selectedTooth]?.farsi})`
                        }
                      </h4>
                      <span className="text-[10px] text-purple-700 font-mono block mt-0.5">
                        Palmer: {selectedQuadrant}{selectedTooth} · {TOOTH_NAMES[selectedTooth]?.english || ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      setActiveModalTab('chart');
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                    <span>ویرایش در چارت</span>
                  </button>
                </div>

                {/* Timeline Chain Cards */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-purple-600" />
                      <span>تاریخچه وضعیت‌ها و اقدامات این دندان (Timeline)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      بیمار: {effectivePatientName}
                    </span>
                  </div>

                  {(() => {
                    const timelineCond = resolveToothConditionEntry(activeConditions, selectedQuadrant, selectedTooth).condition;
                    return timelineCond ? (
                    <div className="space-y-4 relative pr-4 before:content-[''] before:absolute before:right-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-200">
                      {/* Step 1: Initial Diagnosis / Treatment Plan */}
                      <div className="relative space-y-1">
                        <span className="absolute -right-[17px] top-1 w-3 h-3 rounded-full bg-sky-500 ring-4 ring-white" />
                        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black text-sky-950">۱. معاینه بالینی و ثبت طرح درمان اولیه</span>
                            <span className="text-[9.5px] font-mono font-bold text-sky-800 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                              {timelineCond.date || getRelativePersianDate(-2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-700">
                            <span className="font-bold">پزشک معالج: {timelineCond.doctorName || 'دکتر مهدی امیری'}</span>
                            <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-black text-[10px]">
                              طرح درمان (Planned)
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-600">
                            بررسی اولیه رادیوگرافی و ثبت اندیکاسیون درمان {TREATMENT_LABELS[timelineCond.treatment] || timelineCond.treatment}.
                          </p>
                        </div>
                      </div>

                      {/* Step 2: Clinical Procedure In-Progress */}
                      <div className="relative space-y-1">
                        <span className="absolute -right-[17px] top-1 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-white" />
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black text-amber-950">۲. اجرای پروتکل درمان و تراش سطوح</span>
                            <span className="text-[9.5px] font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-200">
                              {timelineCond.date || getCurrentPersianDate()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-700">
                            <span className="font-bold">پزشک معالج: {timelineCond.doctorName || 'دکتر مهدی امیری'}</span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px]">
                              در حال انجام (In Progress)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            <span className="text-[10px] text-slate-500 font-bold">سطوح آماده‌سازی:</span>
                            {timelineCond.surfaces.map(s => (
                              <span key={s} className="px-1.5 py-0.2 rounded bg-white border border-amber-300 text-amber-900 font-bold text-[9.5px]">
                                {SURFACE_NAMES[s] || s}
                              </span>
                            ))}
                          </div>
                          {timelineCond.notes && (
                            <p className="text-[10.5px] text-slate-700 bg-white/80 p-2 rounded-lg border border-amber-200">
                              {timelineCond.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Step 3: Current State & Surgical Notes */}
                      <div className="relative space-y-1">
                        <span className={`absolute -right-[17px] top-1 w-3 h-3 rounded-full ring-4 ring-white ${timelineCond.status === 'completed' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                        <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black text-purple-950">۳. آخرین وضعیت درمان و یادداشت‌های جراحی</span>
                            <span className="text-[9.5px] font-mono font-bold text-purple-800 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                              امروز
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-700">
                            <span className="font-bold">پزشک معالج: {timelineCond.doctorName || 'دکتر مهدی امیری'}</span>
                            <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${timelineCond.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                              {timelineCond.status === 'completed' ? '✓ تکمیل شده' : timelineCond.status === 'planned' ? '📋 طرح درمان' : '⏳ در حال درمان'}
                            </span>
                          </div>

                          {timelineCond.surgicalNotes && (
                            <div className="mt-1 p-2 bg-white rounded-lg border border-purple-200">
                              <span className="text-[9.5px] font-black text-purple-900 block mb-0.5">یادداشت تکمیلی جراحی و روت‌کانال:</span>
                              <p className="text-[10.5px] text-slate-800 font-medium leading-relaxed">
                                {timelineCond.surgicalNotes}
                              </p>
                            </div>
                          )}

                          {timelineCond.cost && (
                            <div className="flex items-center justify-between pt-1 border-t border-purple-200/80 text-[11px]">
                              <span className="text-slate-600 font-bold">هزینه نهایی:</span>
                              <span className="font-mono font-black text-emerald-700">
                                {formatToman(timelineCond.cost || 0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    ) : (
                    <div className="py-6 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <History className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-black text-slate-700">سابقه درمانی ثبت نشده است</h4>
                      <button
                        type="button"
                        onClick={() => {
                          selection();
                          setActiveModalTab('chart');
                        }}
                        className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black inline-flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ثبت اولین اقدام برای دندان {selectedQuadrant}{selectedTooth}</span>
                      </button>
                    </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <>

          {/* DENTITION MODE & VOICE DICTATION COMMAND BAR */}
          <div className="w-full max-w-full min-w-0 flex items-center justify-between gap-2 flex-wrap bg-slate-50 p-2 rounded-2xl border border-slate-200">
            {/* Dentition Mode Toggle */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setDentitionMode('adult');
                  if (selectedTooth > 8) setSelectedTooth(6);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dentitionMode === 'adult'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>دائمی (۱-۸)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  selection();
                  setDentitionMode('pediatric');
                  if (selectedTooth > 5) setSelectedTooth(5);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dentitionMode === 'pediatric'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Baby className="w-3.5 h-3.5" />
                <span>شیری (A-E)</span>
              </button>
            </div>

            {/* Voice Dictation (Hands-free recording) */}
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white ring-3 ring-rose-300 shadow-rose-600/35'
                  : 'bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300'
              }`}
              title="ثبت صوتی درمان"
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>درحال ضبط...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ثبت صوتی</span>
                </>
              )}
            </button>
          </div>

          {/* Voice Feedback Banner */}
          {voiceFeedback && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-900 animate-in fade-in">
              <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <span className="font-bold block">{voiceFeedback}</span>
                {voiceTranscript && (
                  <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                    «{voiceTranscript}»
                  </span>
                )}
              </div>
            </div>
          )}

          {/* PALMER CHART CONTAINER (Clean Clinical White Screen - 2-ROW FACIAL VIEW) */}
          <div className="bg-slate-50/80 rounded-[24px] p-3 border border-slate-200 shadow-xs relative">
            
            {/* Top Orientation Bar */}
            <div className="flex items-center justify-between text-[10.5px] font-black text-slate-700 mb-2 px-1">
              <div className="flex items-center gap-1 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>راست بیمار</span>
              </div>
              {celebratingToothKey ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center gap-1 shadow-xs palmer-check-badge"
                >
                  <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
                  <span>درمان دندان {celebratingToothKey.replace('_', '')} با موفقیت تکمیل شد!</span>
                </div>
              ) : (
                <div className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-mono text-[10px] flex items-center gap-1 shadow-2xs">
                  <span>خط میانی</span>
                  <span className="text-emerald-600 font-black">┼</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-sky-700">
                <span>چپ بیمار</span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              </div>
            </div>

            {/* 2 Continuous Rows Layout - Fits 100% on Mobile Without Horizontal Clipping */}
            <div className="w-full pb-1" dir="ltr" onMouseLeave={() => setHoveredTooth(null)}>
              <div className="w-full space-y-1.5 select-none">
                
                {/* Quadrants Top Subheader */}
                <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-500">
                  <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-black">
                    ⏌ بالا راست (UR)
                  </span>
                  <span className="text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 font-black">
                    (UL) بالا چپ ⎿
                  </span>
                </div>

                {/* LINE 1: MAXILLARY ARCH (فک بالا) */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-white p-1 sm:p-1.5 rounded-xl border border-slate-200 shadow-xs">
                  {/* Left Half (UR): 8 to 1 towards midline */}
                  <div className="flex-1 flex items-center justify-end gap-0.5 sm:gap-1 min-w-0">
                    {(dentitionMode === 'adult' ? [8, 7, 6, 5, 4, 3, 2, 1] : [5, 4, 3, 2, 1]).map(num => {
                      const isSelected = selectedQuadrant === 'UR' && selectedTooth === num;
                      const isCelebrating = celebratingToothKey === `UR_${num}`;
                      const { condition: cond } = resolveToothConditionEntry(activeConditions, 'UR', num);
                      const hasCondition = Boolean(cond);
                      const isCompletedTooth = isCelebrating || cond?.status === 'completed';
                      const label = dentitionMode === 'adult' ? toPersianDigits(num) : PEDIATRIC_TOOTH_NAMES[num]?.letter;
                      return (
                        <button
                          key={`ur-${num}`}
                          type="button"
                          data-tooth-id={`UR_${num}`}
                          data-tooth-celebrating={isCelebrating ? 'true' : 'false'}
                          onMouseEnter={() => setHoveredTooth({ quadrant: 'UR', toothNumber: num })}
                          onFocus={() => setHoveredTooth({ quadrant: 'UR', toothNumber: num })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToothClick('UR', num);
                          }}
                          className={`relative flex-1 min-w-0 h-8 sm:h-10 rounded-lg text-[11px] sm:text-xs font-black transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                            isCelebrating
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md shadow-emerald-500/40 z-20 palmer-tooth-celebrating'
                              : isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400 scale-105 z-10'
                              : hasCondition
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                              : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                          }`}
                          title={dentitionMode === 'adult' ? `دندان ${toPersianDigits(num)} بالا راست - ${TOOTH_NAMES[num]?.farsi}` : `دندان شیری ${label} - ${PEDIATRIC_TOOTH_NAMES[num]?.farsi}`}
                        >
                          <span className="font-mono leading-none">{label}</span>
                          {isCelebrating && (
                            <span key={`confetti-ur-${num}-${celebrationSeq}`} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible z-30">
                              {[
                                { cx: '-22px', cy: '-24px', cr: '140deg', color: '#10b981', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '20px', cy: '-26px', cr: '-120deg', color: '#f59e0b', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-26px', cy: '4px', cr: '200deg', color: '#06b6d4', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '26px', cy: '2px', cr: '-180deg', color: '#8b5cf6', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-12px', cy: '-30px', cr: '90deg', color: '#ec4899', shape: 'rounded-full w-1 h-1' },
                                { cx: '12px', cy: '-28px', cr: '-95deg', color: '#22c55e', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-18px', cy: '20px', cr: '155deg', color: '#facc15', shape: 'rounded-full w-1 h-1' },
                                { cx: '18px', cy: '20px', cr: '-160deg', color: '#38bdf8', shape: 'rounded-full w-1 h-1' }
                              ].map((pt, pIdx) => (
                                <span
                                  key={pIdx}
                                  className={`palmer-confetti-dot ${pt.shape}`}
                                  style={{ backgroundColor: pt.color, '--cx': pt.cx, '--cy': pt.cy, '--cr': pt.cr } as React.CSSProperties}
                                />
                              ))}
                            </span>
                          )}
                          {isCelebrating ? (
                            <span
                              aria-label="تکمیل موفقیت‌آمیز درمان دندان"
                              className="palmer-check-badge absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white border border-white shadow-sm flex items-center justify-center z-30"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                            </span>
                          ) : hasCondition && (
                            <span 
                              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-white ${
                                isCompletedTooth
                                  ? 'bg-emerald-500' 
                                  : cond?.status === 'in_progress' 
                                  ? 'bg-amber-500' 
                                  : 'bg-sky-500'
                              }`}
                            />
                          )}
                          {cond?.annotations && (
                            <span 
                              className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 ring-1 ring-white shadow-xs" 
                              title="دارای ترسیم بالینی"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Vertical Midline Separator */}
                  <div className="w-[2.5px] h-8 sm:h-10 bg-slate-300 rounded-full mx-0.5 sm:mx-1 shrink-0" title="خط میانی" />

                  {/* Right Half (UL): 1 to 8 away from midline */}
                  <div className="flex-1 flex items-center justify-start gap-0.5 sm:gap-1 min-w-0">
                    {(dentitionMode === 'adult' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5]).map(num => {
                      const isSelected = selectedQuadrant === 'UL' && selectedTooth === num;
                      const isCelebrating = celebratingToothKey === `UL_${num}`;
                      const { condition: cond } = resolveToothConditionEntry(activeConditions, 'UL', num);
                      const hasCondition = Boolean(cond);
                      const isCompletedTooth = isCelebrating || cond?.status === 'completed';
                      const label = dentitionMode === 'adult' ? toPersianDigits(num) : PEDIATRIC_TOOTH_NAMES[num]?.letter;
                      return (
                        <button
                          key={`ul-${num}`}
                          type="button"
                          data-tooth-id={`UL_${num}`}
                          data-tooth-celebrating={isCelebrating ? 'true' : 'false'}
                          onMouseEnter={() => setHoveredTooth({ quadrant: 'UL', toothNumber: num })}
                          onFocus={() => setHoveredTooth({ quadrant: 'UL', toothNumber: num })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToothClick('UL', num);
                          }}
                          className={`relative flex-1 min-w-0 h-8 sm:h-10 rounded-lg text-[11px] sm:text-xs font-black transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                            isCelebrating
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md shadow-emerald-500/40 z-20 palmer-tooth-celebrating'
                              : isSelected
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-2 ring-sky-400 scale-105 z-10'
                              : hasCondition
                              ? 'bg-sky-100 text-sky-900 border border-sky-400'
                              : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                          }`}
                          title={dentitionMode === 'adult' ? `دندان ${toPersianDigits(num)} بالا چپ - ${TOOTH_NAMES[num]?.farsi}` : `دندان شیری ${label} - ${PEDIATRIC_TOOTH_NAMES[num]?.farsi}`}
                        >
                          <span className="font-mono leading-none">{label}</span>
                          {isCelebrating && (
                            <span key={`confetti-ul-${num}-${celebrationSeq}`} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible z-30">
                              {[
                                { cx: '-22px', cy: '-24px', cr: '140deg', color: '#10b981', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '20px', cy: '-26px', cr: '-120deg', color: '#f59e0b', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-26px', cy: '4px', cr: '200deg', color: '#06b6d4', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '26px', cy: '2px', cr: '-180deg', color: '#8b5cf6', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-12px', cy: '-30px', cr: '90deg', color: '#ec4899', shape: 'rounded-full w-1 h-1' },
                                { cx: '12px', cy: '-28px', cr: '-95deg', color: '#22c55e', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-18px', cy: '20px', cr: '155deg', color: '#facc15', shape: 'rounded-full w-1 h-1' },
                                { cx: '18px', cy: '20px', cr: '-160deg', color: '#38bdf8', shape: 'rounded-full w-1 h-1' }
                              ].map((pt, pIdx) => (
                                <span
                                  key={pIdx}
                                  className={`palmer-confetti-dot ${pt.shape}`}
                                  style={{ backgroundColor: pt.color, '--cx': pt.cx, '--cy': pt.cy, '--cr': pt.cr } as React.CSSProperties}
                                />
                              ))}
                            </span>
                          )}
                          {isCelebrating ? (
                            <span
                              aria-label="تکمیل موفقیت‌آمیز درمان دندان"
                              className="palmer-check-badge absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white border border-white shadow-sm flex items-center justify-center z-30"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                            </span>
                          ) : hasCondition && (
                            <span 
                              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-white ${
                                isCompletedTooth
                                  ? 'bg-emerald-500' 
                                  : cond?.status === 'in_progress' 
                                  ? 'bg-amber-500' 
                                  : 'bg-sky-500'
                              }`}
                            />
                          )}
                          {cond?.annotations && (
                            <span 
                              className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 ring-1 ring-white shadow-xs" 
                              title="دارای ترسیم بالینی"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* HORIZONTAL OCCLUSAL LINE */}
                <div className="relative my-0.5 flex items-center justify-center">
                  <div className="w-full border-t border-dashed border-slate-300" />
                  <span className="absolute px-2 py-0 bg-slate-50 text-slate-400 font-mono text-[10px] font-black rounded-full border border-slate-200">
                    ┼
                  </span>
                </div>

                {/* LINE 2: MANDIBULAR ARCH (فک پایین) */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-white p-1 sm:p-1.5 rounded-xl border border-slate-200 shadow-xs">
                  {/* Left Half (LR): 8 to 1 towards midline */}
                  <div className="flex-1 flex items-center justify-end gap-0.5 sm:gap-1 min-w-0">
                    {(dentitionMode === 'adult' ? [8, 7, 6, 5, 4, 3, 2, 1] : [5, 4, 3, 2, 1]).map(num => {
                      const isSelected = selectedQuadrant === 'LR' && selectedTooth === num;
                      const isCelebrating = celebratingToothKey === `LR_${num}`;
                      const { condition: cond } = resolveToothConditionEntry(activeConditions, 'LR', num);
                      const hasCondition = Boolean(cond);
                      const isCompletedTooth = isCelebrating || cond?.status === 'completed';
                      const label = dentitionMode === 'adult' ? toPersianDigits(num) : PEDIATRIC_TOOTH_NAMES[num]?.letter;
                      return (
                        <button
                          key={`lr-${num}`}
                          type="button"
                          data-tooth-id={`LR_${num}`}
                          data-tooth-celebrating={isCelebrating ? 'true' : 'false'}
                          onMouseEnter={() => setHoveredTooth({ quadrant: 'LR', toothNumber: num })}
                          onFocus={() => setHoveredTooth({ quadrant: 'LR', toothNumber: num })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToothClick('LR', num);
                          }}
                          className={`relative flex-1 min-w-0 h-8 sm:h-10 rounded-lg text-[11px] sm:text-xs font-black transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                            isCelebrating
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md shadow-emerald-500/40 z-20 palmer-tooth-celebrating'
                              : isSelected
                              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400 scale-105 z-10'
                              : hasCondition
                              ? 'bg-amber-100 text-amber-900 border border-amber-400'
                              : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                          }`}
                          title={dentitionMode === 'adult' ? `دندان ${toPersianDigits(num)} پایین راست - ${TOOTH_NAMES[num]?.farsi}` : `دندان شیری ${label} - ${PEDIATRIC_TOOTH_NAMES[num]?.farsi}`}
                        >
                          <span className="font-mono leading-none">{label}</span>
                          {isCelebrating && (
                            <span key={`confetti-lr-${num}-${celebrationSeq}`} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible z-30">
                              {[
                                { cx: '-22px', cy: '-24px', cr: '140deg', color: '#10b981', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '20px', cy: '-26px', cr: '-120deg', color: '#f59e0b', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-26px', cy: '4px', cr: '200deg', color: '#06b6d4', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '26px', cy: '2px', cr: '-180deg', color: '#8b5cf6', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-12px', cy: '-30px', cr: '90deg', color: '#ec4899', shape: 'rounded-full w-1 h-1' },
                                { cx: '12px', cy: '-28px', cr: '-95deg', color: '#22c55e', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-18px', cy: '20px', cr: '155deg', color: '#facc15', shape: 'rounded-full w-1 h-1' },
                                { cx: '18px', cy: '20px', cr: '-160deg', color: '#38bdf8', shape: 'rounded-full w-1 h-1' }
                              ].map((pt, pIdx) => (
                                <span
                                  key={pIdx}
                                  className={`palmer-confetti-dot ${pt.shape}`}
                                  style={{ backgroundColor: pt.color, '--cx': pt.cx, '--cy': pt.cy, '--cr': pt.cr } as React.CSSProperties}
                                />
                              ))}
                            </span>
                          )}
                          {isCelebrating ? (
                            <span
                              aria-label="تکمیل موفقیت‌آمیز درمان دندان"
                              className="palmer-check-badge absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white border border-white shadow-sm flex items-center justify-center z-30"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                            </span>
                          ) : hasCondition && (
                            <span 
                              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-white ${
                                isCompletedTooth
                                  ? 'bg-emerald-500' 
                                  : cond?.status === 'in_progress' 
                                  ? 'bg-amber-500' 
                                  : 'bg-sky-500'
                              }`}
                            />
                          )}
                          {cond?.annotations && (
                            <span 
                              className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 ring-1 ring-white shadow-xs" 
                              title="دارای ترسیم بالینی"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Vertical Midline Separator */}
                  <div className="w-[2.5px] h-8 sm:h-10 bg-slate-300 rounded-full mx-0.5 sm:mx-1 shrink-0" title="خط میانی" />

                  {/* Right Half (LL): 1 to 8 away from midline */}
                  <div className="flex-1 flex items-center justify-start gap-0.5 sm:gap-1 min-w-0">
                    {(dentitionMode === 'adult' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5]).map(num => {
                      const isSelected = selectedQuadrant === 'LL' && selectedTooth === num;
                      const isCelebrating = celebratingToothKey === `LL_${num}`;
                      const { condition: cond } = resolveToothConditionEntry(activeConditions, 'LL', num);
                      const hasCondition = Boolean(cond);
                      const isCompletedTooth = isCelebrating || cond?.status === 'completed';
                      const label = dentitionMode === 'adult' ? toPersianDigits(num) : PEDIATRIC_TOOTH_NAMES[num]?.letter;
                      return (
                        <button
                          key={`ll-${num}`}
                          type="button"
                          data-tooth-id={`LL_${num}`}
                          data-tooth-celebrating={isCelebrating ? 'true' : 'false'}
                          onMouseEnter={() => setHoveredTooth({ quadrant: 'LL', toothNumber: num })}
                          onFocus={() => setHoveredTooth({ quadrant: 'LL', toothNumber: num })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToothClick('LL', num);
                          }}
                          className={`relative flex-1 min-w-0 h-8 sm:h-10 rounded-lg text-[11px] sm:text-xs font-black transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                            isCelebrating
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md shadow-emerald-500/40 z-20 palmer-tooth-celebrating'
                              : isSelected
                              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400 scale-105 z-10'
                              : hasCondition
                              ? 'bg-purple-100 text-purple-900 border border-purple-400'
                              : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                          }`}
                          title={dentitionMode === 'adult' ? `دندان ${toPersianDigits(num)} پایین چپ - ${TOOTH_NAMES[num]?.farsi}` : `دندان شیری ${label} - ${PEDIATRIC_TOOTH_NAMES[num]?.farsi}`}
                        >
                          <span className="font-mono leading-none">{label}</span>
                          {isCelebrating && (
                            <span key={`confetti-ll-${num}-${celebrationSeq}`} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible z-30">
                              {[
                                { cx: '-22px', cy: '-24px', cr: '140deg', color: '#10b981', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '20px', cy: '-26px', cr: '-120deg', color: '#f59e0b', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-26px', cy: '4px', cr: '200deg', color: '#06b6d4', shape: 'rounded-full w-1.5 h-1.5' },
                                { cx: '26px', cy: '2px', cr: '-180deg', color: '#8b5cf6', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-12px', cy: '-30px', cr: '90deg', color: '#ec4899', shape: 'rounded-full w-1 h-1' },
                                { cx: '12px', cy: '-28px', cr: '-95deg', color: '#22c55e', shape: 'rounded-xs w-1.5 h-1' },
                                { cx: '-18px', cy: '20px', cr: '155deg', color: '#facc15', shape: 'rounded-full w-1 h-1' },
                                { cx: '18px', cy: '20px', cr: '-160deg', color: '#38bdf8', shape: 'rounded-full w-1 h-1' }
                              ].map((pt, pIdx) => (
                                <span
                                  key={pIdx}
                                  className={`palmer-confetti-dot ${pt.shape}`}
                                  style={{ backgroundColor: pt.color, '--cx': pt.cx, '--cy': pt.cy, '--cr': pt.cr } as React.CSSProperties}
                                />
                              ))}
                            </span>
                          )}
                          {isCelebrating ? (
                            <span
                              aria-label="تکمیل موفقیت‌آمیز درمان دندان"
                              className="palmer-check-badge absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white border border-white shadow-sm flex items-center justify-center z-30"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                            </span>
                          ) : hasCondition && (
                            <span 
                              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-white ${
                                isCompletedTooth
                                  ? 'bg-emerald-500' 
                                  : cond?.status === 'in_progress' 
                                  ? 'bg-amber-500' 
                                  : 'bg-sky-500'
                              }`}
                            />
                          )}
                          {cond?.annotations && (
                            <span 
                              className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 ring-1 ring-white shadow-xs" 
                              title="دارای ترسیم بالینی"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quadrants Bottom Subheader */}
                <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-500">
                  <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-black">
                    LR ⏋ پایین راست
                  </span>
                  <span className="text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 font-black">
                    ⎾ LL پایین چپ
                  </span>
                </div>

              </div>
            </div>

            {/* HOVER-STATE CLINICAL QUICK PREVIEW CARD (Last 3 Conditions + Total Tooth Cost) */}
            {hoveredSummary && (
              <div
                data-testid="palmer-hover-preview"
                role="region"
                aria-live="polite"
                aria-label="پیش‌نمایش سریع وضعیت دندان"
                className="mt-2 rounded-2xl bg-white border border-emerald-200/90 shadow-sm p-2.5 text-xs space-y-2 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-[11px] shrink-0">
                      {hoveredSummary.quadrant}{toPersianDigits(hoveredSummary.toothNumber)}
                    </span>
                    <div className="min-w-0">
                      <span className="font-black text-slate-900 text-[11.5px] block truncate">
                        {hoveredSummary.toothTitle}
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-500">
                        خلاصه سریع تا ۳ وضعیت اخیر ({toPersianDigits(hoveredSummary.lastThreeConditions.length)} مورد)
                      </span>
                    </div>
                  </div>
                  <div className="text-left shrink-0 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                    <span className="text-[9px] font-bold text-emerald-700 block">جمع کل هزینه درمان</span>
                    <span className="font-mono font-black text-[11.5px] text-emerald-900 tabular-nums">
                      {formatToman(hoveredSummary.totalTreatmentCost)}
                    </span>
                  </div>
                </div>

                {hoveredSummary.lastThreeConditions.length > 0 ? (
                  <div className="space-y-1">
                    {hoveredSummary.lastThreeConditions.map((item, idx) => (
                      <div
                        key={`${item.label}-${idx}`}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-xl bg-slate-50 border border-slate-200/70 text-[10.5px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-mono text-[9.5px] font-black text-slate-400 shrink-0">
                            #{toPersianDigits(idx + 1)}
                          </span>
                          <span className="font-black text-slate-800 truncate">{item.label}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                              item.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {item.status === 'completed' ? 'تکمیل شده' : item.status === 'in_progress' ? 'در حال درمان' : 'طرح درمان'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                          {item.date && <span className="text-[9.5px] text-slate-500">{toPersianDigits(item.date)}</span>}
                          <span className="font-black text-emerald-700">{formatToman(item.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-[10.5px] text-emerald-800 font-bold">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      دندان سالم — بدون سابقه درمان ثبت‌شده
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">آماده ثبت درمان</span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* INTERACTIVE FLOATING TOOLTIP / TOOTH STATUS INSPECTOR */}
          {inspectedTooth && (
            <div className="bg-white rounded-[24px] p-3.5 border border-slate-200 shadow-md relative animate-in zoom-in-95 fade-in duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs shadow-md ${
                    inspectedTooth.quadrant === 'UR' 
                      ? 'bg-emerald-500 text-white' 
                      : inspectedTooth.quadrant === 'UL' 
                      ? 'bg-sky-500 text-white' 
                      : inspectedTooth.quadrant === 'LR' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-purple-500 text-white'
                  }`}>
                    {inspectedTooth.quadrant}{inspectedTooth.toothNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900">
                        {dentitionMode === 'pediatric'
                          ? `دندان شیری ${PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.letter || inspectedTooth.toothNumber} ${getQuadrantLabel(inspectedTooth.quadrant)}`
                          : `دندان ${toPersianDigits(inspectedTooth.toothNumber)} ${getQuadrantLabel(inspectedTooth.quadrant)}`
                        }
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        ({dentitionMode === 'pediatric' 
                          ? PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.farsi 
                          : TOOTH_NAMES[inspectedTooth.toothNumber]?.farsi})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Palmer: {inspectedTooth.quadrant === 'UR' 
                        ? `⏌ ${dentitionMode === 'pediatric' ? PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.letter : inspectedTooth.toothNumber}` 
                        : inspectedTooth.quadrant === 'UL' 
                        ? `⎿ ${dentitionMode === 'pediatric' ? PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.letter : inspectedTooth.toothNumber}` 
                        : inspectedTooth.quadrant === 'LR' 
                        ? `LR ⏋ ${dentitionMode === 'pediatric' ? PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.letter : inspectedTooth.toothNumber}` 
                        : `⎾ ${dentitionMode === 'pediatric' ? PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.letter : inspectedTooth.toothNumber}`
                      } · {dentitionMode === 'pediatric' ? PEDIATRIC_TOOTH_NAMES[inspectedTooth.toothNumber]?.english : TOOTH_NAMES[inspectedTooth.toothNumber]?.english}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedTooth(null)}
                  aria-label="بستن پنجره بازرسی دندان"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
                  title="بستن پنجره بازرسی"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Box */}
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                {inspectedCondition ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        <span className="font-black text-xs text-emerald-700">
                          {TREATMENT_LABELS[inspectedCondition.treatment] || inspectedCondition.treatment}
                        </span>
                      </div>
                      
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        inspectedCondition.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : inspectedCondition.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-sky-100 text-sky-800 border border-sky-300'
                      }`}>
                        {inspectedCondition.status === 'completed' && '✓ تکمیل شده'}
                        {inspectedCondition.status === 'in_progress' && '⏳ در حال درمان'}
                        {inspectedCondition.status === 'planned' && '📋 طرح درمان پیشنهادی'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                      <span className="text-slate-600 font-bold">سطوح درگیر:</span>
                      {inspectedCondition.surfaces.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-300 font-bold text-[10px] shadow-xs">
                          {SURFACE_NAMES[s] || s}
                        </span>
                      ))}
                    </div>

                    {inspectedCondition.cost && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                        <span className="text-slate-600">هزینه ثبت شده:</span>
                        <span className="font-black text-emerald-700 font-mono">
                          {formatToman(inspectedCondition.cost)}
                        </span>
                      </div>
                    )}

                    {inspectedCondition.notes && (
                      <p className="text-[11px] text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                        {inspectedCondition.notes}
                      </p>
                    )}

                    {inspectedCondition.annotations && (
                      <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-white border border-purple-300 overflow-hidden flex items-center justify-center p-0.5 relative shrink-0">
                          <img
                            src={inspectedCondition.annotations}
                            alt="ترسیم بالینی دندان"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-[11px] font-black text-purple-800 flex items-center gap-1">
                          <PenTool className="w-3 h-3 text-purple-600" />
                          <span>کروکی بالینی</span>
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs text-emerald-800">دندان سالم (بدون درمان ثبت‌شده)</span>
                  </div>
                )}
              </div>

              {/* Quick Action & Manager Delete Buttons */}
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                {inspectedCondition && inspectedKey && effectivePatient && onDeleteToothTreatment ? (
                  confirmDeleteTooth ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          impactHeavy();
                          onDeleteToothTreatment(effectivePatient.id, inspectedKey);
                          setConfirmDeleteTooth(false);
                          setInspectedTooth(null);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer active:scale-95"
                      >
                        تایید حذف ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTooth(false)}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        impactLight();
                        setConfirmDeleteTooth(true);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف درمان</span>
                    </button>
                  )
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    const el = document.getElementById('palmer-surface-selector');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-slate-300"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ویرایش درمان</span>
                  <ArrowDown className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            </div>
          )}

          {/* 3D / ISOMETRIC TOOTH SURFACE SELECTOR & FREEHAND CANVAS OVERLAY */}
          <div id="palmer-surface-selector" className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] p-3 border border-emerald-200/80 border-r-[3px] border-r-emerald-500 flex flex-col shadow-[var(--shadow-card)] relative space-y-2">
            <div className="w-full flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="font-black text-slate-900">
                  ۱. سطوح دندان ({selectedQuadrant}{toPersianDigits(selectedTooth)})
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  selection();
                  setShow3dSurfaceDrawer(!show3dSurfaceDrawer);
                }}
                className={`py-1 px-2.5 rounded-xl text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer border shrink-0 ${
                  show3dSurfaceDrawer || isDrawingMode
                    ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
                }`}
              >
                <PenTool className="w-3 h-3" />
                <span>{show3dSurfaceDrawer ? 'بستن نقشه ۳ بعدی و قلم' : 'نقشه ۳ بعدی و قلم'}</span>
                {show3dSurfaceDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Compact 1-Row Quick Surface Buttons (Fits cleanly on 360px phones) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 w-full min-w-0">
              {([
                { id: 'occlusal', code: 'O', label: 'اوکلوزال' },
                { id: 'mesial', code: 'M', label: 'مزیال' },
                { id: 'distal', code: 'D', label: 'دیستال' },
                { id: 'buccal', code: 'B', label: 'باکال' },
                { id: 'lingual', code: 'L', label: 'لینگوال' },
                { id: 'rootCanal', code: 'RC', label: 'کانال ریشه' },
              ] as const).map(surf => {
                const isSelected = selectedSurfaces.includes(surf.id);
                return (
                  <button
                    key={surf.id}
                    type="button"
                    onClick={() => toggleSurface(surf.id)}
                    className={`py-1.5 px-1 rounded-xl border text-center transition-all cursor-pointer active:scale-95 flex flex-col items-center justify-center ${
                      isSelected
                        ? surf.id === 'rootCanal'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="font-mono font-black text-xs leading-none">{surf.code}</span>
                    <span className={`text-[9px] font-bold mt-0.5 truncate max-w-full ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                      {surf.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {show3dSurfaceDrawer && (
              <div className="w-full flex flex-col items-center pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-bold text-slate-600">شماتیک ۵ سطحی و بوم ترسیم:</span>
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      setIsDrawingMode(!isDrawingMode);
                    }}
                    className={`py-1 px-3 rounded-full text-[11px] font-black flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer ${
                      isDrawingMode
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                    }`}
                  >
                    <PenTool className="w-3 h-3" />
                    <span>{isDrawingMode ? 'حالت ترسیم فعال است' : 'فعال‌سازی قلم روی دندان'}</span>
                  </button>
                </div>

            {/* CLINICAL DRAWING TOOLBAR (VISIBLE WHEN DRAWING MODE IS ON) */}
            {isDrawingMode && (
              <div className="w-full mb-2 p-2.5 rounded-2xl bg-slate-50 border border-purple-200 shadow-sm space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Tool Types: Pen, Highlighter, Eraser */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => { selection(); setActiveTool('pen'); }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        activeTool === 'pen'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="قلم معمولی خطی"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>قلم</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { selection(); setActiveTool('highlighter'); }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        activeTool === 'highlighter'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="ماژیک نیمه‌شفاف"
                    >
                      <Highlighter className="w-3 h-3" />
                      <span>هایلایتر</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { selection(); setActiveTool('eraser'); }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        activeTool === 'eraser'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="پاک‌کن"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>پاک‌کن</span>
                    </button>
                  </div>

                  {/* Pen Width Selector */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[10px]">
                    {[
                      { width: 2, label: 'نازک' },
                      { width: 4, label: 'متوسط' },
                      { width: 7, label: 'ضخیم' }
                    ].map(w => (
                      <button
                        key={w.width}
                        type="button"
                        onClick={() => { selection(); setPenWidth(w.width); }}
                        className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                          penWidth === w.width
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>

                  {/* Undo & Clear */}
                  <div className="flex items-center gap-1 mr-auto">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={canvasHistory.length === 0}
                      className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 shadow-xs"
                      title="بازگشت آخرین خط (Undo)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all active:scale-95 shadow-xs"
                      title="پاک‌کردن کامل ترسیم"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clinical Color Palette (Only when not erasing) */}
                {activeTool !== 'eraser' && (
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200">
                    <span className="text-[10px] text-slate-600 font-bold">رنگ بالینی:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { color: '#ef4444', label: 'پوسیدگی / کاریس (قرمز)' },
                        { color: '#0284c7', label: 'کامپوزیت (آبی)' },
                        { color: '#d97706', label: 'آمالگام (کهربایی)' },
                        { color: '#9333ea', label: 'شکستگی یا ترک (بنفش)' },
                        { color: '#059669', label: 'سالم یا درمان‌شده (سبز)' },
                        { color: '#db2777', label: 'اکسپوز پالپ / اندو (صورتی)' },
                        { color: '#0f172a', label: 'مارکر تیره بالینی' },
                      ].map(c => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => { selection(); setPenColor(c.color); }}
                          style={{ backgroundColor: c.color }}
                          className={`w-5 h-5 rounded-full transition-transform active:scale-90 border border-slate-300 ${
                            penColor === c.color ? 'ring-2 ring-slate-800 ring-offset-2 ring-offset-white scale-110 shadow-md' : 'opacity-85 hover:opacity-100'
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Isometric / Anatomical 3D Surface Interactive Map with Canvas Overlay */}
            <div className="relative w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center my-2 select-none">
              {/* Underlying SVG Tooth Anatomy Diagram */}
              <svg className="w-full h-full drop-shadow-sm absolute inset-0 pointer-events-auto" viewBox="0 0 200 200">
                {/* Background Tooth Outline */}
                <circle cx="100" cy="100" r="88" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2.5" />

                {/* Buccal / Facial (Top Trapezoid) */}
                <polygon
                  points="24,24 176,24 134,66 66,66"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('buccal')
                      ? 'fill-emerald-500 stroke-emerald-600 stroke-2'
                      : 'fill-slate-100 hover:fill-slate-200 stroke-slate-300'
                  }`}
                  onClick={() => !isDrawingMode && toggleSurface('buccal')}
                />
                <text x="100" y="49" textAnchor="middle" className={`text-[10px] font-bold pointer-events-none ${selectedSurfaces.includes('buccal') ? 'fill-white font-black' : 'fill-slate-700'}`}>
                  باکال
                </text>

                {/* Lingual / Palatal (Bottom Trapezoid) */}
                <polygon
                  points="66,134 134,134 176,176 24,176"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('lingual')
                      ? 'fill-emerald-500 stroke-emerald-600 stroke-2'
                      : 'fill-slate-100 hover:fill-slate-200 stroke-slate-300'
                  }`}
                  onClick={() => !isDrawingMode && toggleSurface('lingual')}
                />
                <text x="100" y="159" textAnchor="middle" className={`text-[10px] font-bold pointer-events-none ${selectedSurfaces.includes('lingual') ? 'fill-white font-black' : 'fill-slate-700'}`}>
                  لینگوال
                </text>

                {/* Mesial (Left Trapezoid on tooth) */}
                <polygon
                  points="24,24 66,66 66,134 24,176"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('mesial')
                      ? 'fill-emerald-500 stroke-emerald-600 stroke-2'
                      : 'fill-slate-100 hover:fill-slate-200 stroke-slate-300'
                  }`}
                  onClick={() => !isDrawingMode && toggleSurface('mesial')}
                />
                <text x="45" y="103" textAnchor="middle" className={`text-[9.5px] font-bold pointer-events-none ${selectedSurfaces.includes('mesial') ? 'fill-white font-black' : 'fill-slate-700'}`}>
                  مزیال
                </text>

                {/* Distal (Right Trapezoid on tooth) */}
                <polygon
                  points="134,66 176,24 176,176 134,134"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('distal')
                      ? 'fill-emerald-500 stroke-emerald-600 stroke-2'
                      : 'fill-slate-100 hover:fill-slate-200 stroke-slate-300'
                  }`}
                  onClick={() => !isDrawingMode && toggleSurface('distal')}
                />
                <text x="155" y="103" textAnchor="middle" className={`text-[9.5px] font-bold pointer-events-none ${selectedSurfaces.includes('distal') ? 'fill-white font-black' : 'fill-slate-700'}`}>
                  دیستال
                </text>

                {/* Occlusal / Incisal (Center Square) */}
                <polygon
                  points="66,66 134,66 134,134 66,134"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('occlusal')
                      ? 'fill-emerald-500 stroke-emerald-600 stroke-2'
                      : 'fill-slate-200 hover:fill-slate-300 stroke-slate-300'
                  }`}
                  onClick={() => !isDrawingMode && toggleSurface('occlusal')}
                />
                <text x="100" y="104" textAnchor="middle" className={`text-[10.5px] font-black pointer-events-none ${selectedSurfaces.includes('occlusal') ? 'fill-white' : 'fill-slate-800'}`}>
                  اوکلوزال
                </text>
              </svg>

              {/* Freehand Canvas Drawing Overlay */}
              <canvas
                ref={canvasRef}
                width={320}
                height={320}
                className={`absolute inset-0 w-full h-full rounded-full z-10 touch-none transition-all ${
                  isDrawingMode
                    ? 'cursor-crosshair pointer-events-auto ring-2 ring-purple-500 shadow-md bg-purple-500/5'
                    : 'pointer-events-none'
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>

            {/* Root Canal Button */}
            <button type="button"
              onClick={() => toggleSurface('rootCanal')}
              className={`mt-2 py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                selectedSurfaces.includes('rootCanal')
                  ? 'bg-amber-100 text-amber-800 border-amber-400 shadow-xs'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>درگیری کانال‌های ریشه و اندو</span>
              {selectedSurfaces.includes('rootCanal') && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
            </button>

                {/* Active surfaces pill indicator */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center text-[10.5px]">
                  <span className="text-slate-600 font-bold">سطوح انتخاب‌شده:</span>
                  {selectedSurfaces.length === 0 ? (
                    <span className="text-red-500 font-bold">هیچ سطحی انتخاب نشده</span>
                  ) : (
                    selectedSurfaces.map(s => {
                      const persianSurfaceMap: Record<string, string> = {
                        occlusal: 'اوکلوزال',
                        buccal: 'باکال',
                        lingual: 'لینگوال',
                        mesial: 'مزیال',
                        distal: 'دیستال',
                        rootCanal: 'کانال ریشه'
                      };
                      return (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                          {persianSurfaceMap[s] || s}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* TREATMENT TYPE SELECTOR */}
          <div className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] p-3 border border-teal-200/80 border-r-[3px] border-r-teal-500 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-slate-900 truncate">
                  {dentitionMode === 'adult' ? '۲. نوع اقدام و درمان (بزرگسال)' : '۲. اقدامات تخصصی اطفال'}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${dentitionMode === 'pediatric' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-teal-100 text-teal-800 border border-teal-200'}`}>
                {dentitionMode === 'pediatric' ? 'دندان‌های شیری' : 'دندان‌های دائمی'}
              </span>
            </div>

            <div className="w-full max-w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {(dentitionMode === 'adult' ? [
                { id: 'composite', label: 'ترمیم کامپوزیت' },
                { id: 'amalgam', label: 'ترمیم آمالگام' },
                { id: 'endo', label: 'عصب‌کشی (اندو)' },
                { id: 'crown_zirconia', label: 'روکش زیرکونیا' },
                { id: 'crown_pfm', label: 'روکش PFM' },
                { id: 'laminate', label: 'لمینت سرامیکی' },
                { id: 'implant', label: 'کاشت ایمپلنت' },
                { id: 'extraction', label: 'کشیدن دندان' },
                { id: 'scaling', label: 'جرم‌گیری' },
                { id: 'bleaching', label: 'بلیچینگ آفیس' }
              ] : [
                { id: 'pulpotomy', label: 'پالپوتومی اطفال' },
                { id: 'pulpectomy', label: 'پالپکتومی ریشه' },
                { id: 'ss_crown', label: 'روکش فلزی (SS)' },
                { id: 'fissure_sealant', label: 'فیشورسیلنت' },
                { id: 'fluoride', label: 'فلورایدتراپی' },
                { id: 'space_maintainer', label: 'فضا نگهدارنده' },
                { id: 'composite', label: 'کامپوزیت اطفال' },
                { id: 'extraction', label: 'کشیدن دندان شیری' }
              ]).map(t => (
                <button type="button"
                  key={t.id}
                  onClick={() => handleTreatmentChange(t.id as TreatmentType)}
                  className={`min-h-[42px] px-3 py-2 text-center rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer ${
                    selectedTreatment === t.id
                      ? dentitionMode === 'pediatric'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                        : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Treatment Clinical Stage Selector (طرح درمان / در حال انجام / تکمیل شده) */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-black text-slate-700">وضعیت اجرای درمان:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {([
                  { id: 'planned', label: 'طرح درمان', activeClass: 'bg-sky-600 text-white shadow-xs' },
                  { id: 'in_progress', label: 'در حال درمان', activeClass: 'bg-amber-500 text-white shadow-xs' },
                  { id: 'completed', label: 'تکمیل شده', activeClass: 'bg-emerald-600 text-white shadow-xs' }
                ] as const).map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      if (st.id === 'completed') {
                        triggerToothCompletionCelebration(selectedQuadrant, selectedTooth);
                      } else {
                        selection();
                        setCelebratingToothKey(null);
                      }
                      setTreatmentStatus(st.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      treatmentStatus === st.id ? st.activeClass : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* LIVE CLINIC TARIFF CATALOG SYNC PICKER */}
            <div className="mt-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setShowCatalogDropdown(!showCatalogDropdown);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  showCatalogDropdown
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                <span>📋 جدول خدمات و تعرفه‌ها ({toPersianDigits(clinicTariffsCatalog.length)})</span>
              </button>

              {showCatalogDropdown && (
                <div className="mt-2 p-2 rounded-2xl bg-slate-50 border border-emerald-200 max-h-48 overflow-y-auto space-y-1 animate-in fade-in">
                  {clinicTariffsCatalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        selection();
                        let mappedType: TreatmentType = selectedTreatment;
                        if (item.name.includes('کامپوزیت')) mappedType = 'composite';
                        else if (item.name.includes('آمالگام')) mappedType = 'amalgam';
                        else if (item.name.includes('عصب‌کشی') || item.name.includes('اندو') || item.name.includes('ریشه')) mappedType = 'endo';
                        else if (item.name.includes('زیرکونیا')) mappedType = 'crown_zirconia';
                        else if (item.name.includes('PFM')) mappedType = 'crown_pfm';
                        else if (item.name.includes('لمینت')) mappedType = 'laminate';
                        else if (item.name.includes('ایمپلنت')) mappedType = 'implant';
                        else if (item.name.includes('کشیدن') || item.name.includes('عقل')) mappedType = 'extraction';
                        else if (item.name.includes('جرم‌گیری')) mappedType = 'scaling';
                        else if (item.name.includes('پالپوتومی')) mappedType = 'pulpotomy';
                        else if (item.name.includes('استیل') || item.name.includes('SS')) mappedType = 'ss_crown';
                        else if (item.name.includes('فیشور')) mappedType = 'fissure_sealant';

                        setSelectedTreatment(mappedType);
                        setBaseCost(item.price);
                        setTreatmentCost(item.price);
                        setDiscountPercent(0);
                        setManualDiscountAmount(0);
                        setTreatmentNotes(`${item.name} [کد خدمت: ${item.code}]`);
                        setShowCatalogDropdown(false);
                      }}
                      className="w-full p-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 flex items-center justify-between text-right transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9.5px] font-mono font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">
                          {item.code}
                        </span>
                        <span className="text-[11px] font-extrabold text-slate-900 truncate">{item.name}</span>
                      </div>
                      <span className="text-[10.5px] font-mono font-black text-emerald-700 shrink-0 mr-2">
                        {formatToman(item.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ENDO WORKING LENGTH & FILE LOG (Shown when Endo / Root Canal is active) */}
            {(selectedTreatment === 'endo' || selectedTreatment === 'pulpectomy' || selectedSurfaces.includes('rootCanal')) && (
              <div className="mt-3 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-600" />
                    <span>ثبت طول کارکرد کانال‌ها و فایل اندو (WL / MAF)</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                    Apex Locator
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10.5px]">
                  {[
                    { label: 'MB1 (mm)', val: canalMB1, set: setCanalMB1 },
                    { label: 'MB2 (mm)', val: canalMB2, set: setCanalMB2 },
                    { label: 'ML (mm)', val: canalML, set: setCanalML },
                    { label: 'D / P (mm)', val: canalDP, set: setCanalDP },
                  ].map((c, idx) => (
                    <div key={idx} className="bg-white p-1.5 rounded-xl border border-amber-200">
                      <label className="text-[9.5px] font-black text-amber-900 block mb-0.5 font-mono">{c.label}</label>
                      <input aria-label="ورودی اطلاعات بالینی"
                        type="text"
                        value={c.val}
                        onChange={(e) => c.set(e.target.value)}
                        className="w-full text-center font-mono font-black text-xs text-slate-900 bg-amber-50/60 rounded-lg py-1 border border-amber-200/80 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-amber-900 font-bold block mb-0.5">سایز فایل اصلی (MAF)</label>
                    <select aria-label="سایز فایل اصلی (MAF)"
                      value={masterFile}
                      onChange={(e) => setMasterFile(e.target.value)}
                      className="w-full bg-white border border-amber-200 rounded-xl px-2 py-1.5 font-mono font-bold text-slate-800"
                    >
                      {['#20 .04', '#25 .04', '#25 .06', '#30 .04', '#30 .06', '#35 .04', '#40 .04'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-amber-900 font-bold block mb-0.5">سیلر و متد پرکردگی</label>
                    <select aria-label="سیلر و متد پرکردگی"
                      value={sealerType}
                      onChange={(e) => setSealerType(e.target.value)}
                      className="w-full bg-white border border-amber-200 rounded-xl px-2 py-1.5 font-bold text-slate-800"
                    >
                      <option value="AH Plus + Gutta">AH Plus + گوتاپرکا</option>
                      <option value="BioCeramic + Single Cone">بیوسرامیک (Single Cone)</option>
                      <option value="MTA Fillapex">MTA Fillapex</option>
                      <option value="ZOE / Metapex">ZOE / متاپکس</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 6-POINT PERIODONTAL POCKET & MOBILITY CHART TOGGLE */}
            <div className="mt-3 pt-2.5 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowPerioChart(!showPerioChart);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    showPerioChart
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>چارت پریودنتال ۶ نقطه‌ای و درجه لقی دندان</span>
                </button>
                {showPerioChart && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    پاکت ≥ ۴ میلی‌متر هشدار قرمز
                  </span>
                )}
              </div>

              {showPerioChart && (
                <div className="mt-2.5 p-2.5 sm:p-3 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5 animate-in fade-in w-full min-w-0">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center w-full min-w-0">
                    {(['MB', 'B', 'DB', 'ML', 'L', 'DL'] as const).map(pt => {
                      const depth = perioPockets[pt];
                      const isDeep = depth >= 4;
                      return (
                        <div key={pt} className="bg-white p-1.5 rounded-xl border border-rose-200/80 min-w-0">
                          <span className="text-[9.5px] font-mono font-black text-slate-600 block">{pt}</span>
                          <input aria-label="ورودی اطلاعات بالینی"
                            type="text"
                            size={3}
                            inputMode="numeric"
                            value={toPersianDigits(depth)}
                            onChange={(e) => {
                              const raw = Number(toEnglishDigits(e.target.value).replace(/\D/g, '')) || 1;
                              setPerioPockets(prev => ({ ...prev, [pt]: Math.min(12, Math.max(1, raw)) }));
                            }}
                            className={`w-full min-w-0 text-center font-mono font-black text-xs rounded-lg py-0.5 mt-0.5 border focus:outline-none ${
                              isDeep
                                ? 'bg-rose-600 text-white border-rose-700'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-700">درجه لقی دندان:</span>
                      {(['0', 'I', 'II', 'III'] as const).map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setToothMobility(g)}
                          className={`px-2 py-0.5 rounded-lg font-mono font-black text-[10.5px] cursor-pointer ${
                            toothMobility === g
                              ? 'bg-rose-600 text-white'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {g === '0' ? 'نرمال' : `درجه ${g}`}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPerioBop(!perioBop)}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black cursor-pointer border transition-all ${
                        perioBop
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-white text-rose-700 border-rose-200'
                      }`}
                    >
                      {perioBop ? '🩸 خونریزی حین پروب دارد' : 'بدون خونریزی'}
                    </button>
                  </div>
                </div>
              )}

              {/* PULP VITALITY & PERIAPICAL DIAGNOSTIC MATRIX */}
              <div className="mt-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowVitalityMatrix(!showVitalityMatrix);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    showVitalityMatrix
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تست حیات پالپ و حساسیت اپیکال دندان</span>
                </button>

                {showVitalityMatrix && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-2.5 animate-in fade-in text-[11px]">
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">پاسخ تست سرما:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                        {(['نرمال', 'پالپیت برگشت‌پذیر', 'پالپیت غیرقابل‌برگشت', 'نکروز (بدون پاسخ)'] as const).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColdTest(c)}
                            className={`py-1 px-2 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                              coldTest === c
                                ? 'bg-sky-600 text-white shadow-2xs'
                                : 'bg-white text-slate-700 border border-sky-200/80'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <span className="font-bold text-slate-700 block mb-1 text-[10px]">تست دق:</span>
                        <button
                          type="button"
                          onClick={() => setPercussionTest(percussionTest === 'منفی (-)' ? 'مثبت (+)' : 'منفی (-)')}
                          className={`w-full py-1 rounded-lg font-black text-[10.5px] cursor-pointer border ${
                            percussionTest === 'مثبت (+)'
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-white text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {percussionTest}
                        </button>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 block mb-1 text-[10px]">لمس اپیکال:</span>
                        <button
                          type="button"
                          onClick={() => setPalpationTest(palpationTest === 'منفی (-)' ? 'مثبت (+)' : 'منفی (-)')}
                          className={`w-full py-1 rounded-lg font-black text-[10.5px] cursor-pointer border ${
                            palpationTest === 'مثبت (+)'
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-white text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {palpationTest}
                        </button>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 block mb-1 text-[10px]">تست الکتریکی:</span>
                        <input aria-label="تست الکتریکی"
                          type="text"
                          value={toPersianDigits(eptScore)}
                          onChange={(e) => setEptScore(toPersianDigits(e.target.value))}
                          className="w-full py-1 px-2 rounded-lg bg-white border border-sky-200 font-mono font-bold text-center text-slate-800 text-[10.5px]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LIVE CHAIRSIDE CLINICAL DECISION SUPPORT (CDSS) COMPACT STRIP */}
          <div
            data-testid="palmer-cdss-panel"
            className="w-full max-w-full min-w-0 overflow-hidden bg-gradient-to-br from-teal-50/90 via-white to-sky-50/80 rounded-[20px] p-2.5 sm:p-3 border border-teal-200/90 border-r-[3px] border-r-teal-600 shadow-[var(--shadow-card)] space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <div className="w-6 h-6 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-slate-900">
                  هوش بالینی هم‌زمان صندلی (CDSS)
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 font-mono whitespace-nowrap">
                  {liveSafety.asaClass} · {toPersianDigits(liveSafety.anestheticLimit.maxCarpules)} کارپول · {toPersianDigits(liveProtocol.chairMinutes)}د
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  selection();
                  const checklistText = liveProtocol.chairsideChecklist.map((s, i) => `${toPersianDigits(i + 1)}. ${s}`).join(' | ');
                  setTreatmentNotes(
                    `${liveProtocol.label} (${liveProtocol.isolationRequired}) — متریال: ${liveProtocol.biomaterialSpec}`
                  );
                  setSurgicalNotes((prev) =>
                    prev.trim() ? `${prev}\n[پروتکل CDSS]: ${checklistText}` : `[پروتکل CDSS]: ${checklistText}`
                  );
                  setShowSurgicalNotesDrawer(true);
                }}
                className="min-h-[30px] px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3" />
                <span>درج پروتکل بالینی در یادداشت</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px] w-full min-w-0">
              <div className="bg-white/95 rounded-xl px-2.5 py-1.5 border border-teal-100 font-bold text-slate-700 min-w-0 break-words">
                <strong className="text-teal-900">ایزولاسیون:</strong> {liveProtocol.isolationRequired}
              </div>
              <div className="bg-white/95 rounded-xl px-2.5 py-1.5 border border-sky-100 font-bold text-slate-700 min-w-0 break-words">
                <strong className="text-sky-900">بی‌حسی:</strong> {liveSafety.anesthesiaChoice}
              </div>
            </div>

            {(showVitalityMatrix || selectedTreatment === 'endo' || selectedTreatment === 'pulpectomy' || selectedSurfaces.includes('rootCanal')) && (
              <div
                className={`p-2 rounded-xl border text-[10.5px] space-y-1 ${
                  liveEndoDx.clinicalWarning
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-sky-50/90 border-sky-200 text-sky-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-black">تشخیص افتراقی زنده (AAE): {liveEndoDx.aaeDiagnosis}</span>
                  <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-white/90 border border-current/20">
                    {liveEndoDx.apicalDiagnosis}
                  </span>
                </div>
                {liveEndoDx.clinicalWarning && (
                  <p className="font-black text-rose-700 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{liveEndoDx.clinicalWarning}</span>
                  </p>
                )}
              </div>
            )}

            {showPerioChart && (
              <div
                className={`p-2 rounded-xl border text-[10.5px] space-y-1 ${
                  livePerioEval.prostheticWarning || livePerioEval.riskLevel === 'high'
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-amber-50/90 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-black">پریو-پروتز (AAP): {livePerioEval.stageLabel}</span>
                  <span className="font-mono font-bold text-[10px]">
                    بیشینه پاکت: {toPersianDigits(livePerioEval.maxPocketMm)}mm · میانگین: {toPersianDigits(livePerioEval.meanPocketMm)}mm
                  </span>
                </div>
                {livePerioEval.prostheticWarning && (
                  <p className="font-black text-rose-700 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{livePerioEval.prostheticWarning}</span>
                  </p>
                )}
              </div>
            )}

            {liveSafety.systemicAlerts.length > 0 && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-300 text-[10.5px] font-bold text-rose-900 space-y-0.5">
                {liveSafety.systemicAlerts.map((alertMsg, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{alertMsg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COST & CLINICAL NOTES (Compact with Collapsible Discount & Surgical Notes Drawers) */}
          <div className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] p-3 border border-amber-200/80 border-r-[3px] border-r-amber-500 shadow-[var(--shadow-card)] space-y-3">
            <div className="w-full min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center shrink-0">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <label className="text-xs font-black text-slate-900">۳. تعرفه درمان و پزشک معالج</label>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {baseCost > treatmentCost && (
                    <span className="text-[10px] text-slate-400 line-through font-mono whitespace-nowrap">
                      {toPersianDigits(baseCost.toLocaleString('en-US'))}
                    </span>
                  )}
                  <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-black font-mono whitespace-nowrap">
                    {formatToman(treatmentCost)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full min-w-0">
                <input aria-label="تعرفه و مبلغ درمان (تومان)"
                  type="text"
                  size={8}
                  inputMode="numeric"
                  readOnly={!canModifyPrice}
                  value={toPersianDigits(treatmentCost.toLocaleString('en-US'))}
                  onFocus={() => {
                    if (!canModifyPrice) {
                      setShowInlinePinBox(true);
                      setInlinePinError('ویرایش دستی قیمت فقط با مجوز و پین مدیر کلینیک مجاز است.');
                    }
                  }}
                  onChange={(e) => {
                    if (!canModifyPrice) {
                      setShowInlinePinBox(true);
                      return;
                    }
                    const numericVal = Number(toEnglishDigits(e.target.value).replace(/\D/g, '')) || 0;
                    setTreatmentCost(numericVal);
                    if (numericVal > baseCost) {
                      setBaseCost(numericVal);
                      setManualDiscountAmount(0);
                      setDiscountPercent(0);
                    } else {
                      const diff = Math.max(0, baseCost - numericVal);
                      setManualDiscountAmount(diff);
                      setDiscountPercent(baseCost > 0 ? Math.round((diff / baseCost) * 100) : 0);
                    }
                  }}
                  className={`flex-1 min-w-[120px] w-full border rounded-xl px-2.5 py-2 font-mono text-sm font-bold focus:outline-none text-left ${
                    canModifyPrice
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                      : 'bg-amber-50/50 border-amber-300 text-slate-700 cursor-not-allowed'
                  }`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    if (!canModifyPrice) {
                      setShowInlinePinBox(!showInlinePinBox);
                      setInlinePinError(null);
                    } else {
                      setShowDiscountDrawer(!showDiscountDrawer);
                    }
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border shrink-0 whitespace-nowrap cursor-pointer transition-all ${
                    showDiscountDrawer || discountPercent > 0 || manualDiscountAmount > 0
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  <span>{!canModifyPrice ? '🔒 قفل تخفیف مدیر' : discountPercent > 0 ? `تخفیف (${toPersianDigits(discountPercent)}٪)` : 'اعمال تخفیف'}</span>
                  {showDiscountDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showInlinePinBox && !canModifyPrice && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2 animate-in fade-in w-full min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[10.5px] font-black text-amber-950 flex-wrap">
                    <span>پین مدیر جهت تغییر تعرفه (پیش‌فرض: ۱۲۳۴)</span>
                    <button
                      type="button"
                      onClick={() => setShowInlinePinBox(false)}
                      className="text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded bg-white border border-amber-200 text-[10px] cursor-pointer shrink-0"
                    >
                      بستن
                    </button>
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <input
                      type="password"
                      size={6}
                      dir="ltr"
                      inputMode="numeric"
                      aria-label="پین مدیر جهت تغییر قیمت در چارت پالمر"
                      placeholder="••••"
                      value={inlinePinInput}
                      onChange={(e) => {
                        setInlinePinInput(e.target.value);
                        setInlinePinError(null);
                      }}
                      className="flex-1 min-w-0 w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-center font-mono text-xs font-black tracking-widest focus:outline-none focus:border-amber-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const storedPin = (() => {
                          try {
                            return localStorage.getItem('minadental_manager_pin_v1') || '1234';
                          } catch {
                            return '1234';
                          }
                        })();
                        if (toEnglishDigits(inlinePinInput).trim() === toEnglishDigits(storedPin)) {
                          setDiscountUnlockedByPin(true);
                          setShowInlinePinBox(false);
                          setShowDiscountDrawer(true);
                          setInlinePinInput('');
                          setInlinePinError(null);
                        } else {
                          setInlinePinError('پین مدیر نادرست است. منشی مجاز به تغییر تعرفه نیست.');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black cursor-pointer"
                    >
                      تایید مدیر
                    </button>
                  </div>
                  {inlinePinError && (
                    <p className="text-[10px] font-bold text-rose-700">{inlinePinError}</p>
                  )}
                </div>
              )}

              {/* Collapsible Quick Percentage & Manual Toman Discount Selector */}
              {showDiscountDrawer && (
                <div className="space-y-2 pt-2.5 mt-2.5 border-t border-slate-100 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-[10.5px] font-black text-slate-700">اعمال تخفیف درصدی یا مبلغی در لحظه:</span>
                    {(discountPercent > 0 || manualDiscountAmount > 0) && (
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        کسر {formatToman(Math.max(0, baseCost - treatmentCost))} ({toPersianDigits(discountPercent)}٪ تخفیف)
                      </span>
                    )}
                  </div>

                  {/* Percentage Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'بدون تخفیف (۰٪)', pct: 0 },
                      { label: '۵٪ نقدی', pct: 5 },
                      { label: '۱۰٪ همکار/بیمار', pct: 10 },
                      { label: '۱۵٪ پکیج درمانی', pct: 15 },
                      { label: '۲۰٪ تخفیف مدیر', pct: 20 },
                    ].map(d => (
                      <button
                        key={d.pct}
                        type="button"
                        onClick={() => applyDiscount(d.pct)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                          discountPercent === d.pct && (d.pct > 0 || manualDiscountAmount === 0)
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {/* Manual Toman Discount Input + Instant Preset Deductions */}
                  <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5 w-full min-w-0">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <label className="text-[10px] font-black text-amber-950">مبلغ تخفیف دستی (تومان):</label>
                      <div className="flex items-center gap-1 flex-wrap">
                        {[100000, 250000, 500000].map(step => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => {
                              selection();
                              applyManualDiscountToman(manualDiscountAmount + step);
                            }}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-mono font-black cursor-pointer active:scale-95 whitespace-nowrap"
                          >
                            +{toPersianDigits((step / 1000).toLocaleString('en-US'))}هزار
                          </button>
                        ))}
                        {manualDiscountAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              selection();
                              applyDiscount(0);
                            }}
                            className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[9.5px] font-black cursor-pointer whitespace-nowrap"
                          >
                            حذف تخفیف
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      size={8}
                      inputMode="numeric"
                      placeholder="مثلاً ۲۰۰,۰۰۰ تومان تخفیف..."
                      value={manualDiscountAmount > 0 ? toPersianDigits(manualDiscountAmount.toLocaleString('en-US')) : ''}
                      onChange={(e) => {
                        const val = Number(toEnglishDigits(e.target.value).replace(/\D/g, '')) || 0;
                        applyManualDiscountToman(val);
                      }}
                      className="w-full min-w-0 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-500 text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Attending Doctor Selector */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5 w-full min-w-0">
              <label className="text-[11px] font-bold text-slate-700 block">پزشک معالج:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 w-full min-w-0">
                {doctorOptions.map((doc) => (
                  <button
                    key={doc.name}
                    type="button"
                    onClick={() => {
                      selection();
                      setSelectedDoctor(doc.name);
                      setConfirmingSave(false);
                    }}
                    className={`p-2 rounded-xl text-right border transition-all cursor-pointer min-w-0 overflow-hidden ${
                      selectedDoctor === doc.name
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-[11px] font-black block truncate">{doc.name}</span>
                    <span className={`text-[9.5px] block truncate mt-0.5 ${selectedDoctor === doc.name ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {doc.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">یادداشت تخصصی بالینی</label>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowSurgicalNotesDrawer(!showSurgicalNotesDrawer);
                  }}
                  className="text-[10px] font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{showSurgicalNotesDrawer ? 'بستن جزئیات جراحی' : '+ افزودن شرح جراحی / فیکسچر'}</span>
                  {showSurgicalNotesDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <input
                type="text"
                value={treatmentNotes}
                onChange={(e) => setTreatmentNotes(e.target.value)}
                placeholder="توضیحات تشخیصی، وضعیت کانال‌ها یا متریال..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-none placeholder-slate-400"
              />
            </div>

            {(showSurgicalNotesDrawer || surgicalNotes) && (
              <div className="pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    یادداشت‌های تکمیلی جراحی و روت‌کانال (Surgical Notes)
                  </label>
                  <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    فیکسچر / فلپ / سوچور
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={surgicalNotes}
                  onChange={(e) => setSurgicalNotes(e.target.value)}
                  placeholder="توضیحات جراحی: تورک فیکسچر (N.cm)، نوع بیحسی، ابعاد استخوان و پیوند، نوع فلپ، سوچور و پانسمان..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-none placeholder-slate-400 resize-none leading-relaxed"
                />
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <ReminderOptionPicker
                value={reminderConfig}
                onChange={setReminderConfig}
                targetDate={getRelativePersianDate(3)}
                theme="emerald"
                title="یادآوری پیگیری درمان / کنترل بعدی (نوتیف گوشی)"
              />
            </div>
          </div>
          </>
          )}

          </div>

          {/* Sticky Bottom Action Footer with Live Summary, 2-Step Confirmation & Post-Save Clinical Chain */}
          <div className="w-full max-w-full min-w-0 overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t-2 border-emerald-200/90 bg-white/98 backdrop-blur-md shrink-0 sticky bottom-0 z-20 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
            {postSaveActionState ? (
              <div className="p-2.5 rounded-2xl bg-gradient-to-l from-emerald-50 via-white to-sky-50 border-2 border-emerald-400 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-black text-emerald-950 truncate">
                      درمان دندان {toPersianDigits(postSaveActionState.toothLabel)} در پرونده ثبت شد!
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-black text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0 whitespace-nowrap">
                    {formatToman(postSaveActionState.cost)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {onLaunchLabFromTreatment && (
                    <button
                      type="button"
                      onClick={() => {
                        const state = postSaveActionState;
                        setPostSaveActionState(null);
                        onClose();
                        onLaunchLabFromTreatment({
                          patientId: state.patientId,
                          toothNumber: state.toothLabel,
                          workType: state.workType
                        });
                      }}
                      className="min-h-[40px] px-2.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                      <span>ارسال لابراتوار</span>
                    </button>
                  )}
                  {onLaunchImplantFromTreatment && (
                    <button
                      type="button"
                      onClick={() => {
                        const state = postSaveActionState;
                        setPostSaveActionState(null);
                        onClose();
                        onLaunchImplantFromTreatment(state.patientId, state.toothLabel);
                      }}
                      className="min-h-[40px] px-2.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                      <span>ثبت ایمپلنت</span>
                    </button>
                  )}
                  {onLaunchPaymentFromTreatment && (
                    <button
                      type="button"
                      onClick={() => {
                        const state = postSaveActionState;
                        setPostSaveActionState(null);
                        onClose();
                        onLaunchPaymentFromTreatment(state.patientId);
                      }}
                      className="min-h-[40px] px-2.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5 shrink-0" />
                      <span>صندوق / چک / قسط</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPostSaveActionState(null);
                      onClose();
                    }}
                    className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black cursor-pointer"
                  >
                    بستن و اتمام
                  </button>
                </div>
              </div>
            ) : activeModalTab === 'timeline' ? (
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors active:scale-95 border border-slate-200 cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setActiveModalTab('chart');
                  }}
                  className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-white shrink-0" />
                  <span className="truncate">ثبت / اصلاح درمان دندان</span>
                </button>
              </div>
            ) : confirmingSave ? (
              <div className="p-2.5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2 text-xs font-black text-emerald-950 min-w-0">
                  <span className="truncate min-w-0 flex-1">تایید ثبت «{TREATMENT_LABELS[selectedTreatment]}» دندان {toPersianDigits(selectedTooth)}</span>
                  <span className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 whitespace-nowrap shrink-0">
                    {formatToman(treatmentCost)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingSave(false)}
                    className="w-1/3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer"
                  >
                    بازگشت و اصلاح
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingSave(false);
                      handleSubmit();
                    }}
                    className="w-2/3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5] shrink-0" />
                    <span className="truncate">تایید و ثبت قطعی در چارت ✓</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 w-full min-w-0">
                <div className="flex items-center justify-between gap-2 text-[11px] px-1 min-w-0">
                  <span className="font-black text-slate-800 truncate min-w-0 flex-1">
                    دندان {selectedQuadrant}{toPersianDigits(selectedTooth)} · {TREATMENT_LABELS[selectedTreatment]}
                  </span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0 whitespace-nowrap">
                    {formatToman(treatmentCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-1/4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors active:scale-95 border border-slate-200 cursor-pointer shrink-0"
                  >
                    انصراف
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      selection();
                      setConfirmingSave(true);
                    }}
                    className="w-3/4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer min-w-0"
                  >
                    <ShieldCheck className="w-4 h-4 text-white stroke-[2.5] shrink-0" />
                    <span className="truncate">ثبت درمان در پرونده و چارت پالمر ✓</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </ViewportModalPortal>
  );
};
