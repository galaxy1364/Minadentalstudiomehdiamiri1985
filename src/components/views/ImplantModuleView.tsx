import React, { useState } from 'react';
import { 
  Activity, Plus, Clock, CheckCircle2, 
  AlertCircle, ShieldCheck, ChevronRight, Layers,
  Calendar, Stethoscope, Search, Sparkles, Check,
  Send, Award, ChevronDown, ChevronUp, Bell,
  SlidersHorizontal, Smartphone, FlaskConical, FileText,
  X, CheckSquare, Zap, Info, Edit3, Trash2, RotateCcw, Phone, MessageSquare, DollarSign, Box
} from 'lucide-react';
import { ImplantCase, ImplantStage, InventoryItem, LabOrder, Patient, ReminderConfig, UserAccount } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, getCurrentPersianDate, getRelativePersianDate, diffPersianDays } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { useActionFeedback } from '../../utils/actionFeedback';
import { ArmedActionButton, CardMutationBadge } from '../ArmedActionButton';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { TrackableIdBadge } from '../TrackableIdBadge';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { ReminderOptionPicker } from '../ReminderOptionPicker';
import { getDefaultReminderConfig, scheduleEntityReminder } from '../../services/reminderNotificationService';
import { clinicalSmsService } from '../../services/smsService';
import { evaluateMultiFieldFuzzySearch } from './PatientsListView';
import { Implant3DSurgicalPlannerD3 } from '../Implant3DSurgicalPlannerD3';

interface ImplantModuleViewProps {
  patients: Patient[];
  users?: UserAccount[];
  inventory?: InventoryItem[];
  onOpenPatientFile: (patient: Patient, initialTab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai') => void;
  onOpenPalmerChart?: (patient: Patient, toothText?: string) => void;
  onOpenPaymentModal?: (patient: Patient) => void;
  onOpenCheckModal?: (patient: Patient) => void;
  onNavigateToModule?: (targetView: string) => void;
  onAdvanceStage: (caseId: string, nextStage: ImplantStage) => void;
  onEditImplantCase?: (caseId: string, updatedFields: Partial<ImplantCase>) => void;
  onDeleteImplantCase?: (caseId: string) => void;
  onAddImplantCase?: (newCase: any) => void;
  onScheduleImplantFollowUp?: (patient: Patient, implantCase: ImplantCase) => void;
  onCreateLabOrderFromImplant?: (patient: Patient, implantCase: ImplantCase) => void;
  isManager?: boolean;
}

interface ImplantBrandSpec {
  brand: string;
  country: string;
  connection: string;
  hexType: string;
  recommendedTorque: string;
  healingPeriodMonths: number;
  color: string;
}

const BRAND_SPECS: ImplantBrandSpec[] = [
  {
    brand: 'اشترومن Straumann (BLX/SLA)',
    country: 'سوئیس',
    connection: 'Internal TorcFit / SynOcta',
    hexType: 'Conical Matrix',
    recommendedTorque: '۳۵ تا ۴۵ N/cm',
    healingPeriodMonths: 2,
    color: 'from-amber-500 to-amber-700'
  },
  {
    brand: 'اوستم Osstem (TSIII SA)',
    country: 'کره جنوبی',
    connection: 'Internal Hex 11° Morph',
    hexType: '1.2mm Hex Drive',
    recommendedTorque: '۳۰ تا ۴۰ N/cm',
    healingPeriodMonths: 3,
    color: 'from-blue-600 to-sky-700'
  },
  {
    brand: 'دنتیوم Dentium (SuperLine)',
    country: 'کره جنوبی',
    connection: 'Internal Hex 11° Conical',
    hexType: '1.27mm Hex Drive',
    recommendedTorque: '۳۰ تا ۳۵ N/cm',
    healingPeriodMonths: 3,
    color: 'from-emerald-600 to-teal-700'
  },
  {
    brand: 'مگاژن Megagen (AnyRidge)',
    country: 'کره جنوبی',
    connection: 'Knife Thread / 5° Morse Taper',
    hexType: '1.2mm Hex Drive',
    recommendedTorque: '۴۰ تا ۵۰ N/cm',
    healingPeriodMonths: 2.5,
    color: 'from-purple-600 to-indigo-700'
  },
  {
    brand: 'نئودنت Neodent (Grand Morse)',
    country: 'برزیل / سوئیس',
    connection: 'Grand Morse 16° Cone',
    hexType: 'Neo Hex Drive',
    recommendedTorque: '۳۵ تا ۴۵ N/cm',
    healingPeriodMonths: 2,
    color: 'from-rose-600 to-red-700'
  },
  {
    brand: 'دیو DIO (SM/UFII)',
    country: 'کره جنوبی',
    connection: 'Internal Hex 11° Conical',
    hexType: '1.2mm Hex Drive',
    recommendedTorque: '۳۰ تا ۴۰ N/cm',
    healingPeriodMonths: 3,
    color: 'from-cyan-600 to-blue-700'
  }
];

export const ImplantModuleView: React.FC<ImplantModuleViewProps> = ({
  patients,
  users = [],
  inventory = [],
  onOpenPatientFile,
  onOpenPalmerChart,
  onOpenPaymentModal,
  onOpenCheckModal,
  onNavigateToModule,
  onAdvanceStage,
  onEditImplantCase,
  onDeleteImplantCase,
  onAddImplantCase,
  onScheduleImplantFollowUp,
  onCreateLabOrderFromImplant,
  isManager = false
}) => {
  const { impactLight, impactHeavy, success, selection } = useHapticFeedback();
  const { getCardFeedbackClasses } = useActionFeedback();
  const surgeonSuggestions = React.useMemo(() => {
    const fromUsers = users
      .filter((u) => u.role === 'doctor' || u.role === 'admin' || u.fullName.includes('دکتر'))
      .map((u) => u.fullName);
    const defaults = ['دکتر مهدی امیری', 'دکتر سارا نوری', 'دکتر کاوه راد'];
    defaults.forEach((d) => {
      if (!fromUsers.includes(d)) fromUsers.push(d);
    });
    return fromUsers;
  }, [users]);

  // Top Chip Navigation: cases | surgical3d | reminders | prosthetics | catalog | biomechanics
  const [activeChip, setActiveChip] = useState<'cases' | 'surgical3d' | 'reminders' | 'prosthetics' | 'catalog' | 'biomechanics'>('cases');
  const [selectedCaseIdFor3D, setSelectedCaseIdFor3D] = useState<string | null>(null);

  // Search State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('همه');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Biomechanics Engine States (All-on-4 / All-on-6, A-P Spread, Misch Cantilever)
  const [bioArch, setBioArch] = useState<'mandible' | 'maxilla'>('mandible');
  const [bioConfig, setBioConfig] = useState<'all_on_4' | 'all_on_6'>('all_on_4');
  const [apSpreadMm, setApSpreadMm] = useState<number>(14);
  const [plannedCantileverMm, setPlannedCantileverMm] = useState<number>(16);
  const [bioTorques, setBioTorques] = useState<number[]>([45, 40, 45, 50]);

  // Collapsed state for cards: Set of collapsed implant IDs
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Modals & Feedback
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedWarrantyCase, setSelectedWarrantyCase] = useState<ImplantCase | null>(null);
  const [pendingStageChange, setPendingStageChange] = useState<{ caseId: string; stage: ImplantStage; label: string } | null>(null);
  const [confirmCreateStep, setConfirmCreateStep] = useState(false);

  // Full Edit Implant Case Modal states
  const [editingImplantCase, setEditingImplantCase] = useState<ImplantCase | null>(null);
  const [editImpBrand, setEditImpBrand] = useState('');
  const [editImpTooth, setEditImpTooth] = useState('');
  const [editImpDiameter, setEditImpDiameter] = useState('4.1');
  const [editImpLength, setEditImpLength] = useState('10');
  const [editImpTorque, setEditImpTorque] = useState(35);
  const [editImpSurgeryDate, setEditImpSurgeryDate] = useState('');
  const [editImpHealingDueDate, setEditImpHealingDueDate] = useState('');
  const [editImpBoneGraft, setEditImpBoneGraft] = useState(false);
  const [editImpMembrane, setEditImpMembrane] = useState(false);
  const [editImpReminderConfig, setEditImpReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('2d_before'));

  useEscapeKey(Boolean(selectedWarrantyCase), () => setSelectedWarrantyCase(null));
  useEscapeKey(showAddModal, () => {
    setConfirmCreateStep(false);
    setShowAddModal(false);
  });
  useEscapeKey(Boolean(editingImplantCase), () => setEditingImplantCase(null));

  const openEditImplantModal = (imp: ImplantCase) => {
    selection();
    setEditingImplantCase(imp);
    setEditImpBrand(imp.brand);
    setEditImpTooth(imp.toothNumber);
    setEditImpDiameter(imp.diameter || '4.1');
    setEditImpLength(imp.length || '10');
    setEditImpTorque(imp.torque || 35);
    setEditImpSurgeryDate(imp.surgeryDate || getCurrentPersianDate());
    setEditImpHealingDueDate(imp.healingDueDate || getRelativePersianDate(60));
    setEditImpBoneGraft(Boolean(imp.boneGraft));
    setEditImpMembrane(Boolean(imp.membrane));
    setEditImpReminderConfig(imp.reminderConfig || getDefaultReminderConfig('2d_before'));
  };

  const getPreviousImplantStage = (current: ImplantStage): ImplantStage | null => {
    switch (current) {
      case 'crown_delivered': return 'abutment_framework';
      case 'abutment_framework': return 'impression';
      case 'impression': return 'healing_cap';
      case 'healing_cap': return 'fixture_placed';
      case 'fixture_placed': return null;
    }
  };

  // Form states for new implant
  const [formPatientId, setFormPatientId] = useState(patients[0]?.id || '');
  const [formTooth, setFormTooth] = useState('دندان ۶ پایین راست (LR6)');
  const [formBrand, setFormBrand] = useState('اشترومن Straumann (BLX/SLA)');
  const [formDiameter, setFormDiameter] = useState('۴.۲');
  const [formLength, setFormLength] = useState('۱۰');
  const [formTorque, setFormTorque] = useState(45);
  const [formBoneDensity, setFormBoneDensity] = useState<'D1' | 'D2' | 'D3' | 'D4'>('D2');
  const [formBoneGraft, setFormBoneGraft] = useState(false);
  const [formMembrane, setFormMembrane] = useState(false);
  const [formSurgeryDate, setFormSurgeryDate] = useState(getCurrentPersianDate());
  const [formHealingMonths, setFormHealingMonths] = useState(3);
  const [formDoctor, setFormDoctor] = useState('دکتر مهدی امیری');
  const [formSterilePackCode, setFormSterilePackCode] = useState('');
  const [formReminderConfig, setFormReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('2d_before'));

  const allImplants = patients.flatMap(p => p.implantCases || []);
  const todayJalali = getCurrentPersianDate();
  const extractToothCode = (txt?: string) => (txt || '').match(/[A-Z]{2}[1-8]/i)?.[0]?.toUpperCase() || '';
  const findLinkedLabOrder = (imp: ImplantCase, pat?: Patient): LabOrder | undefined => {
    if (!pat?.labOrders?.length) return undefined;
    const impCode = extractToothCode(imp.toothNumber);
    return pat.labOrders.find(lo => {
      const loCode = extractToothCode(lo.toothNumber);
      if (impCode && loCode) return impCode === loCode;
      return lo.toothNumber === imp.toothNumber || /ایمپلنت|اباتمنت|فریم/i.test(lo.workType || '');
    });
  };
  const getLabStatusFa = (status: LabOrder['status']) => {
    switch (status) {
      case 'sent': return '۱. ارسال به لابراتوار';
      case 'fabrication': return '۲. در حال تراش CAD/CAM';
      case 'frame_try_in': return '۳. امتحان فریم در مطب';
      case 'ready_for_clinic': return '۴. آماده نصب در مطب ✓';
      case 'delivered_cemented': return '۵. سمان و تحویل نهایی ✓';
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const toggleCardCollapse = (id: string) => {
    selection();
    setCollapsedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getStageTitle = (stage: ImplantStage) => {
    switch (stage) {
      case 'fixture_placed': return 'مرحله ۱: کاشت فیکسچر';
      case 'healing_cap': return 'مرحله ۲: بستن هیلینگ کپ';
      case 'impression': return 'مرحله ۳: قالب‌گیری پروتز';
      case 'abutment_framework': return 'مرحله ۴: تست اباتمنت و فریم';
      case 'crown_delivered': return 'مرحله ۵: تحویل نهایی روکش';
    }
  };

  const getNextStage = (stage: ImplantStage): ImplantStage => {
    switch (stage) {
      case 'fixture_placed': return 'healing_cap';
      case 'healing_cap': return 'impression';
      case 'impression': return 'abutment_framework';
      case 'abutment_framework': return 'crown_delivered';
      case 'crown_delivered': return 'crown_delivered';
    }
  };

  const getNextStageButtonText = (stage: ImplantStage): string => {
    switch (stage) {
      case 'fixture_placed': return 'ارتقا به: بستن هیلینگ کپ';
      case 'healing_cap': return 'ارتقا به: قالب‌گیری ایمپلنت';
      case 'impression': return 'ارتقا به: تست فریم و اباتمنت';
      case 'abutment_framework': return 'ثبت تحویل نهایی روکش';
      case 'crown_delivered': return 'درمان تکمیل شد';
    }
  };

  const healingPhaseCount = allImplants.filter(
    imp => imp.currentStage === 'fixture_placed' || imp.currentStage === 'healing_cap'
  ).length;
  const prostheticPhaseCount = allImplants.filter(
    imp => imp.currentStage === 'impression' || imp.currentStage === 'abutment_framework'
  ).length;
  const crownDeliveredCount = allImplants.filter(
    imp => imp.currentStage === 'crown_delivered'
  ).length;

  const filteredImplants = allImplants.filter(imp => {
    const matchesBrand = selectedBrand === 'همه' || imp.brand.includes(selectedBrand);
    const matchesStage =
      stageFilter === 'all' ||
      (stageFilter === 'healing_phase'
        ? imp.currentStage === 'fixture_placed' || imp.currentStage === 'healing_cap'
        : stageFilter === 'prosthetic_phase'
          ? imp.currentStage === 'impression' || imp.currentStage === 'abutment_framework'
          : imp.currentStage === stageFilter);
    if (!matchesBrand || !matchesStage) return false;
    if (!searchQuery.trim()) return true;
    const matchedPatient = patients.find(p => p.id === imp.patientId || p.fullName === imp.patientName);
    const fuzzy = evaluateMultiFieldFuzzySearch(searchQuery, [
      { value: imp.patientName, label: 'نام بیمار' },
      { value: imp.toothNumber, label: 'شماره دندان', maxTypos: 1 },
      { value: imp.brand, label: 'برند ایمپلنت' },
      { value: matchedPatient?.phone, label: 'تلفن بیمار', maxTypos: 1 },
      { value: matchedPatient?.fileNumber, label: 'شماره پرونده', maxTypos: 1 }
    ]);
    return fuzzy.matched;
  });

  const handleCreateImplant = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === formPatientId);
    if (!patient) return;

    impactHeavy();

    const newCase: ImplantCase = {
      id: `imp-${Date.now()}`,
      patientId: formPatientId,
      patientName: patient.fullName,
      toothNumber: formTooth,
      brand: formBrand,
      diameter: formDiameter,
      length: formLength,
      torque: Number(formTorque),
      boneGraft: formBoneGraft,
      membrane: formMembrane,
      surgeryDate: formSurgeryDate,
      healingDueDate: getRelativePersianDate(formHealingMonths * 30),
      currentStage: 'fixture_placed',
      sterilePackCode: formSterilePackCode.trim() || undefined,
      doctorName: formDoctor.trim() || undefined,
      boneDensity: formBoneDensity,
      reminderConfig: formReminderConfig,
      notes: `جراحی توسط ${formDoctor} با گشتاور تورک ${formTorque} N/cm در استخوان تیپ ${formBoneDensity} انجام شد.${formSterilePackCode.trim() ? ` · پک استریل/لات: ${formSterilePackCode.trim()}` : ''}`
    };

    if (onAddImplantCase) {
      onAddImplantCase(newCase);
    } else {
      patient.implantCases = [newCase, ...(patient.implantCases || [])];
    }

    success();
    showToast(`کیس جراحی ایمپلنت ${newCase.brand} برای ${patient.fullName} با موفقیت ثبت شد.`);
    setFormSterilePackCode('');
    setConfirmCreateStep(false);
    setShowAddModal(false);
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-cyan-50 border-2 border-cyan-300 text-cyan-950 p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-xs font-black leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('cyan')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-200/80 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-cyan-600 to-sky-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <Activity className="w-4.5 h-4.5 stroke-[2.25]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-black text-sm text-slate-950 leading-none truncate">کاشت ایمپلنت و جراحی</h3>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 border border-cyan-200 text-[10px] font-black font-mono tabular-nums">
                    {toPersianDigits(allImplants.length)} کیس
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {/* Animated Search Toggle */}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[38px] min-h-[38px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-cyan-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجوی فازی کیس ایمپلنت"
                aria-label="جستجوی کیس ایمپلنت"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slim Single-Line Scrollable (Mobile) / 4-Column (Desktop) Interactive Clinical KPI Triage Strip */}
          <div className="flex sm:grid sm:grid-cols-4 overflow-x-auto no-scrollbar gap-1.5 pt-0.5 [&>button]:shrink-0 [&>button]:min-w-[148px] sm:[&>button]:min-w-0 [&>button]:py-1.5 [&>button]:px-2">
            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('cases');
                setStageFilter('all');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'cases' && stageFilter === 'all'
                  ? 'bg-cyan-100/90 border-cyan-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-cyan-50/60 border-cyan-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">کل کیس‌های جراحی</span>
                <span className="text-xs font-black text-cyan-950 font-mono tabular-nums">
                  {toPersianDigits(allImplants.length)} فیکسچر
                </span>
              </div>
              <Activity className="w-4 h-4 text-cyan-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('cases');
                setStageFilter('healing_phase');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'cases' && stageFilter === 'healing_phase'
                  ? 'bg-amber-100/90 border-amber-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-amber-50/60 border-amber-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">فاز استئواینتگریشن</span>
                <span className="text-xs font-black text-amber-800 font-mono tabular-nums">
                  {toPersianDigits(healingPhaseCount)} در دوره هیلینگ
                </span>
              </div>
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('cases');
                setStageFilter('prosthetic_phase');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'cases' && stageFilter === 'prosthetic_phase'
                  ? 'bg-purple-100/90 border-purple-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-purple-50/60 border-purple-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">قالب‌گیری و پروتز</span>
                <span className="text-xs font-black text-purple-900 font-mono tabular-nums">
                  {toPersianDigits(prostheticPhaseCount)} آماده روکش
                </span>
              </div>
              <FlaskConical className="w-4 h-4 text-purple-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('cases');
                setStageFilter('crown_delivered');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'cases' && stageFilter === 'crown_delivered'
                  ? 'bg-emerald-100/90 border-emerald-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-emerald-50/60 border-emerald-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">تحویل نهایی روکش</span>
                <span className="text-xs font-black text-emerald-800 font-mono tabular-nums">
                  {toPersianDigits(crownDeliveredCount)} تکمیل‌شده
                </span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>
          </div>

          {/* Animated Expandable Fuzzy Search Bar */}
          {searchOpen && (
            <div className="relative animate-in fade-in slide-in-from-top-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                aria-label="جستجوی کیس ایمپلنت"
                type="text"
                placeholder="جستجوی فازی نام بیمار (حتی با غلط تایپی)، شماره دندان یا برند ایمپلنت..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border border-cyan-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="پاک کردن عبارت جستجو"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Row 2: Scrollable Horizontal Chip Navigation Bar + Pinned Inline Primary CTA (جراحی جدید) */}
          <div className="flex items-center gap-1.5 pt-0.5 min-w-0">
            <div role="tablist" aria-label="بخش‌های ماژول" className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'cases', label: `کیس‌های جراحی و روند (${toPersianDigits(allImplants.length)})`, icon: Activity },
                { id: 'surgical3d', label: 'شبیه‌ساز سه‌بعدی جراحی (3D CBCT)', icon: Box },
                { id: 'reminders', label: 'تقویم و یادآوری مراحل', icon: Bell },
                { id: 'prosthetics', label: 'پروتز و لابراتوار روکش', icon: FlaskConical },
                { id: 'catalog', label: 'کاتالوگ سیستم‌ها و قطعات', icon: ShieldCheck },
                { id: 'biomechanics', label: 'بیومکانیک و فول‌آرک', icon: Zap }
              ].map((chip, idx) => {
                const IconComp = chip.icon;
                return (
                  <button role="tab" aria-selected={activeChip === chip.id}
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      selection();
                      setActiveChip(chip.id as any);
                    }}
                    className={getUnifiedChipClasses(idx + 1, activeChip === chip.id)}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                impactLight();
                setShowAddModal(true);
              }}
              className="shrink-0 min-h-[34px] py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>جراحی جدید</span>
            </button>
          </div>

          {/* Sub-Filters for Cases Chip */}
          {activeChip === 'cases' && (
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar pt-1.5 border-t border-cyan-200/60">
              <div className="flex items-center gap-1">
                {['همه', 'Straumann', 'Osstem', 'Dentium', 'Megagen', 'Neodent', 'DIO'].map((brand, bIdx) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => {
                      selection();
                      setSelectedBrand(brand);
                    }}
                    className={`py-1 px-2.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all cursor-pointer ${
                      selectedBrand === brand
                        ? 'bg-cyan-700 text-white shadow-2xs'
                        : bIdx % 2 === 0
                        ? 'bg-cyan-50 text-cyan-900 border border-cyan-200/80 hover:bg-cyan-100'
                        : 'bg-sky-50 text-sky-900 border border-sky-200/80 hover:bg-sky-100'
                    }`}
                  >
                    {brand === 'همه' ? 'همه برندها' : brand}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHIP 1: CASES & PROGRESS TIMELINE */}
      {activeChip === 'cases' && (
        <div className="space-y-2.5">
          {filteredImplants.length > 0 && (
            <div className="mx-2 flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-600">
                فهرست کیس‌های ایمپلنت ({toPersianDigits(filteredImplants.length)} مورد)
              </span>
              <button
                type="button"
                onClick={() => {
                  selection();
                  const anyExpanded = filteredImplants.some(i => collapsedCards[i.id]);
                  if (anyExpanded) {
                    setCollapsedCards({});
                  } else {
                    const next: Record<string, boolean> = {};
                    filteredImplants.forEach(i => { next[i.id] = true; });
                    setCollapsedCards(next);
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-cyan-50 text-cyan-900 border border-cyan-200 text-[10.5px] font-black flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>{filteredImplants.some(i => collapsedCards[i.id]) ? 'جمع کردن همه' : 'باز کردن همه'}</span>
                {filteredImplants.some(i => collapsedCards[i.id]) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          )}

          <div className="mx-2 grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
            {filteredImplants.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
                کیس ایمپلنتی با این فیلتر یا نام یافت نشد.
              </div>
            ) : (
              filteredImplants.map((imp, impIdx) => {
                const isExpanded = !!collapsedCards[imp.id];
                const patient = patients.find(p => p.id === imp.patientId);
                const borderAccentClass =
                  imp.currentStage === 'crown_delivered'
                    ? 'border-emerald-300/90 border-r-[3px] border-r-emerald-500'
                    : imp.currentStage === 'fixture_placed'
                    ? 'border-amber-200/90 border-r-[3px] border-r-amber-500'
                    : 'border-cyan-200/90 border-r-[3px] border-r-cyan-500';

                return (
                  <div
                    key={imp.id}
                    className={`bg-white rounded-[20px] p-2.5 sm:p-3 shadow-[var(--shadow-card)] border ${borderAccentClass} space-y-2 transition-all ${getCardFeedbackClasses(imp.id)}`}
                  >
                    {/* Ultra-Compact Card Header (Collapsible Toggle) */}
                    <div 
                      onClick={() => toggleCardCollapse(imp.id)}
                      className="flex items-center justify-between gap-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Numbered Visual Badge */}
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center justify-center font-black text-xs shadow-2xs">
                            <Activity className="w-4 h-4 text-cyan-700" />
                          </div>
                          <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-cyan-700 text-white font-mono text-[9.5px] font-black flex items-center justify-center shadow-2xs">
                            {toPersianDigits(impIdx + 1)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-[13px] font-black text-slate-900 leading-tight">{imp.patientName}</h4>
                            {patient?.fileNumber && (
                              <span className="text-[10px] font-mono font-black bg-cyan-50 text-cyan-900 border border-cyan-200 px-1.5 py-0.2 rounded-md">
                                {toPersianDigits(patient.fileNumber)}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md font-mono">
                              {imp.toothNumber}
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold text-slate-600 mt-0.5 block truncate">
                            {imp.brand} · <span className="font-mono text-cyan-800">Ø{imp.diameter}×{imp.length}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-300 font-black px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap">
                          {getStageTitle(imp.currentStage)}
                        </span>
                        <div className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border ${
                          isExpanded ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Deep Details & 5-Step Process Stepper (Shown when user taps جزئیات) */}
                    {isExpanded && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
                          <TrackableIdBadge recordId={imp.id} moduleKey="implant" />
                          <span className="text-slate-600 font-bold">
                            گشتاور تورک جراحی: <strong className="text-emerald-700 font-mono">{toPersianDigits(imp.torque)} N/cm</strong>
                          </span>
                        </div>

                        {/* 5-Step Interactive Process Timeline Tracker (2-Step Mistake-Proof Confirmation) */}
                        <div className="bg-cyan-50/50 p-2 rounded-xl border border-cyan-200/70 space-y-2">
                          <div className="grid grid-cols-5 gap-1 text-center text-[9.5px] font-bold">
                            {[
                              { key: 'fixture_placed' as ImplantStage, label: '۱. فیکسچر' },
                              { key: 'healing_cap' as ImplantStage, label: '۲. هیلینگ' },
                              { key: 'impression' as ImplantStage, label: '۳. قالب‌گیری' },
                              { key: 'abutment_framework' as ImplantStage, label: '۴. اباتمنت' },
                              { key: 'crown_delivered' as ImplantStage, label: '۵. روکش' }
                            ].map((stageItem, idx) => {
                              const order: ImplantStage[] = ['fixture_placed', 'healing_cap', 'impression', 'abutment_framework', 'crown_delivered'];
                              const currentIdx = order.indexOf(imp.currentStage);
                              const isCurrent = imp.currentStage === stageItem.key;
                              const isCompleted = idx < currentIdx || (stageItem.key === 'crown_delivered' && isCurrent);
                              const isPendingTarget = pendingStageChange?.caseId === imp.id && pendingStageChange?.stage === stageItem.key;
                              return (
                                <button
                                  key={stageItem.key}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (imp.currentStage === stageItem.key) return;
                                    selection();
                                    setPendingStageChange({
                                      caseId: imp.id,
                                      stage: stageItem.key,
                                      label: getStageTitle(stageItem.key)
                                    });
                                  }}
                                  className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 ${
                                    isPendingTarget
                                      ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300 font-black'
                                      : isCurrent && stageItem.key !== 'crown_delivered'
                                        ? 'bg-cyan-600 text-white shadow-2xs ring-1 ring-cyan-300 font-black'
                                        : isCompleted
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : 'bg-white border border-cyan-200 text-slate-600 hover:bg-cyan-100 hover:text-cyan-800'
                                  }`}
                                  title={`انتخاب مرحله ${stageItem.label}`}
                                >
                                  {stageItem.label}
                                </button>
                              );
                            })}
                          </div>

                          {pendingStageChange?.caseId === imp.id && (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                              <span className="text-[10.5px] font-black text-amber-950">
                                تغییر مرحله به «{pendingStageChange.label}» ثبت شود؟
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingStageChange(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                                >
                                  انصراف
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    impactHeavy();
                                    onAdvanceStage(imp.id, pendingStageChange.stage);
                                    showToast(`مرحله ایمپلنت ${imp.patientName} به «${pendingStageChange.label}» تغییر یافت.`);
                                    setPendingStageChange(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black shadow-2xs cursor-pointer"
                                >
                                  تایید نهایی ✓
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Live Osseointegration Healing Countdown & Next Stage Appointment Bar */}
                          {(() => {
                            const targetDue = imp.healingDueDate || getRelativePersianDate(60);
                            const daysRemaining = diffPersianDays(todayJalali, targetDue);
                            const countdownText =
                              daysRemaining > 0
                                ? `${toPersianDigits(daysRemaining)} روز باقی‌مانده (موعد: ${toPersianDigits(targetDue)})`
                                : daysRemaining === 0
                                ? `موعد امروز! (${toPersianDigits(targetDue)})`
                                : `${toPersianDigits(Math.abs(daysRemaining))} روز گذشته از موعد (${toPersianDigits(targetDue)})`;
                            return (
                              <div className="implant-healing-countdown-bar flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-cyan-200/70 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                                  <span className="font-bold text-slate-700">
                                    {imp.currentStage === 'fixture_placed'
                                      ? `شمارشگر استئواینتگریشن: ${countdownText}`
                                      : imp.currentStage === 'healing_cap'
                                        ? `فاز شکل‌دهی بافت لثه: ${countdownText} تا قالب‌گیری`
                                        : imp.currentStage === 'impression'
                                          ? 'آماده ارسال قالب به لابراتوار جهت ساخت اباتمنت و روکش'
                                          : imp.currentStage === 'abutment_framework'
                                            ? 'آماده پرو فریم و تحویل نهایی روکش ایمپلنت'
                                            : 'پروتکل کاشت و بارگذاری ایمپلنت تکمیل شد ✓'}
                                  </span>
                                </div>
                            {imp.currentStage !== 'crown_delivered' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  impactHeavy();
                                  const matchedPatient = patients.find((p) => p.id === imp.patientId);
                                  if (onScheduleImplantFollowUp && matchedPatient) {
                                    onScheduleImplantFollowUp(matchedPatient, imp);
                                  } else {
                                    showToast(`نوبت مرحله بعد (${getNextStageButtonText(imp.currentStage)}) و پیامک یادآوری برای «${imp.patientName}» ثبت شد.`);
                                  }
                                }}
                                className="px-2 py-0.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-black text-[9.5px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                              >
                                <Bell className="w-2.5 h-2.5" />
                                <span>ثبت نوبت و یادآوری مرحله بعد</span>
                              </button>
                            )}
                            {onCreateLabOrderFromImplant && (imp.currentStage === 'impression' || imp.currentStage === 'healing_cap') && (() => {
                              const matchedPatient = patients.find((p) => p.id === imp.patientId);
                              if (!matchedPatient) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    impactHeavy();
                                    onCreateLabOrderFromImplant(matchedPatient, imp);
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-black text-[9.5px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                                >
                                  <FlaskConical className="w-2.5 h-2.5" />
                                  <span>ارسال قالب به لابراتوار</span>
                                </button>
                              );
                            })()}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Bidirectional Linked Lab Order Status Banner */}
                        {(() => {
                          const linkedLab = findLinkedLabOrder(imp, patient);
                          if (!linkedLab) return null;
                          return (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50/90 border border-purple-200 text-[10px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-purple-700 text-white font-black text-[9px]">
                                  لابراتوار متصل
                                </span>
                                <span className="font-black text-purple-950">{linkedLab.workType}</span>
                                <span className="text-purple-800 font-bold">· {linkedLab.labName}</span>
                                {linkedLab.trackingSlipCode && (
                                  <span className="font-mono font-black px-1.5 py-0.2 rounded bg-white border border-purple-200 text-purple-900">
                                    {linkedLab.trackingSlipCode}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-purple-900 font-black">
                                  {getLabStatusFa(linkedLab.status)}
                                </span>
                                {onNavigateToModule && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onNavigateToModule('lab');
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-black cursor-pointer"
                                  >
                                    ماژول لابراتوار ←
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 360° Implant Financial Clearance, Check Guarantee, Palmer Chart, File & Smart Reminder Hub */}
                        {patient && (() => {
                          const patientDebt = patient.balance < 0 ? Math.abs(patient.balance) : 0;
                          const checksCount = (patient.sayadChecks || []).length;
                          const pendingInstallments = (patient.installments || []).filter(ins => ins.status !== 'paid').length;
                          const isNearCrownWithDebt =
                            (imp.currentStage === 'abutment_framework' || imp.currentStage === 'impression') && patientDebt > 0;

                          return (
                            <div
                              data-testid="implant-cross-module-hub"
                              className={`p-2.5 rounded-2xl border space-y-2 text-[10px] ${
                                isNearCrownWithDebt
                                  ? 'bg-rose-50/85 border-rose-300'
                                  : 'bg-gradient-to-l from-cyan-50/75 via-white to-emerald-50/50 border-cyan-200/80'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-lg bg-cyan-900 text-white font-black text-[9.5px]">
                                    میز یکپارچه مالی، چک ضمانت، پالمر و یادآوری ایمپلنت
                                  </span>
                                  {isNearCrownWithDebt ? (
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-black text-[9.5px] flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>هشدار پیش از تحویل روکش: بیمار {formatToman(patientDebt)} مانده بدهی دارد</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[9.5px]">
                                      {patientDebt === 0 ? '✓ تسویه مالی کامل ایمپلنت' : `مانده حساب بیمار: ${formatToman(patientDebt)}`}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 font-mono text-[9.5px] text-slate-700">
                                  <span>کل پرونده: <strong>{formatToman(patient.totalCost || 0)}</strong></span>
                                  <span>پرداختی: <strong className="text-emerald-700">{formatToman(patient.paidAmount || 0)}</strong></span>
                                  <span>چک صیادی/ضمانت: <strong className="text-cyan-900">{toPersianDigits(checksCount)}</strong></span>
                                  {pendingInstallments > 0 && (
                                    <span>اقساط باز: <strong className="text-amber-800">{toPersianDigits(pendingInstallments)}</strong></span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-cyan-200/60">
                                {onOpenPaymentModal && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onOpenPaymentModal(patient);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    <span>دریافت وجه / قسط (POS)</span>
                                  </button>
                                )}

                                {onOpenCheckModal && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onOpenCheckModal(patient);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>ثبت چک صیادی / ضمانت</span>
                                  </button>
                                )}

                                {onOpenPalmerChart && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onOpenPalmerChart(patient, imp.toothNumber);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>چارت پالمر ({imp.toothNumber})</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    impactLight();
                                    onOpenPatientFile(patient, 'financial');
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-cyan-50 text-cyan-950 border border-cyan-200 font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <span>پرونده مالی و اقساط</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    impactHeavy();
                                    const targetDue = imp.healingDueDate || getRelativePersianDate(60);
                                    scheduleEntityReminder({
                                      sourceType: 'implant',
                                      sourceId: imp.id,
                                      patientId: patient.id,
                                      patientName: patient.fullName,
                                      patientPhone: patient.phone,
                                      title: `پیگیری مرحله ایمپلنت ${imp.brand} (${imp.toothNumber})`,
                                      description: `مرحله فعلی: ${getStageTitle(imp.currentStage)} · مانده بیمار: ${patientDebt > 0 ? formatToman(patientDebt) : 'تسویه'}`,
                                      targetDate: targetDue,
                                      targetView: 'implant',
                                      config: imp.reminderConfig || {
                                        enabled: true,
                                        preset: '2d_before',
                                        channels: ['phone_push', 'in_app']
                                      }
                                    });
                                    showToast(`یادآور هوشمند مرحله ایمپلنت «${imp.patientName}» در مرکز جامع یادآوری‌ها ثبت شد.`);
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                >
                                  <Bell className="w-3 h-3" />
                                  <span>ثبت در مرکز یادآوری</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Surgical Details & ISQ Osstell Stability Grid */}
                        <div className="grid grid-cols-4 gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-right">
                          <div>
                            <span className="text-slate-400 block text-[9px]">ابعاد فیکسچر</span>
                            <span className="font-bold text-slate-800 font-mono">Ø{imp.diameter}×{imp.length}</span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[9px]">تورک اولیه</span>
                          <span className="font-black text-emerald-600 font-mono">{toPersianDigits(imp.torque)} N/cm</span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[9px]">پایداری ISQ</span>
                          <span className="font-black text-cyan-700 font-mono">
                            {toPersianDigits(Math.min(86, Math.max(68, imp.torque + 36)))} ISQ
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[9px]">تاریخ جراحی</span>
                          <span className="text-slate-700 font-mono">{toPersianDigits(imp.surgeryDate)}</span>
                        </div>
                      </div>

                      {/* Clinical Notes & Grafts */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] bg-cyan-50/50 p-2 rounded-xl border border-cyan-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${imp.boneGraft ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                            {imp.boneGraft ? 'پودر استخوان' : 'بدون پودر استخوان'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${imp.membrane ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                            {imp.membrane ? 'ممبرین کلاژن' : 'بدون ممبرین'}
                          </span>
                          {imp.sterilePackCode && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                              CSSD: {imp.sterilePackCode}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                          موعد هیلینگ: {toPersianDigits(imp.healingDueDate || getRelativePersianDate(60))}
                        </span>
                      </div>

                      {/* 1-Tap Direct Patient Communication Dock (تماس، پیامک گوشی، سرویس پیامک فراخوان ایمپلنت) */}
                      {patient?.phone && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span className="font-bold text-slate-700">تماس و فراخوان بیمار:</span>
                            <span className="font-mono font-black text-slate-900 tabular-nums" dir="ltr">
                              {toPersianDigits(patient.phone)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <a
                              href={`tel:${patient.phone}`}
                              onClick={() => impactLight()}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 shadow-2xs transition-all"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>تماس مستقیم</span>
                            </a>
                            <a
                              href={`sms:${patient.phone}?body=${encodeURIComponent(`سلام ${imp.patientName} عزیز، موعد پیگیری مرحله بعدی ایمپلنت دندان (${imp.toothNumber}) در کلینیک مینادنتال تاریخ ${toPersianDigits(imp.healingDueDate || getRelativePersianDate(60))} می‌باشد.`)}`}
                              onClick={() => impactLight()}
                              className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center gap-1 shadow-2xs transition-all"
                            >
                              <MessageSquare className="w-2.5 h-2.5" />
                              <span>پیامک گوشی</span>
                            </a>
                            <button
                              type="button"
                              onClick={async () => {
                                impactLight();
                                await clinicalSmsService.sendPatternSms(
                                  patient.phone,
                                  imp.patientName,
                                  'implant_healing_recall',
                                  { date: imp.healingDueDate || getRelativePersianDate(60), toothNumber: imp.toothNumber }
                                );
                                showToast(`پیامک خدماتی فراخوان مرحله ایمپلنت برای «${imp.patientName}» ارسال شد.`);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            >
                              <Send className="w-2.5 h-2.5 -scale-x-100" />
                              <span>فراخوان پیامکی</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-1 flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              selection();
                              setSelectedCaseIdFor3D(imp.id);
                              setActiveChip('surgical3d');
                            }}
                            className="py-1 px-2.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border border-cyan-300 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                            title="شبیه‌سازی سه‌بعدی محور کاشت، تراکم استخوان و فاصله از کانال عصب/سینوس"
                          >
                            <Box className="w-3.5 h-3.5 text-cyan-700" />
                            <span>شبیه‌ساز سه‌بعدی جراحی (3D)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedWarrantyCase(imp)}
                            className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            <span>شناسنامه و گارانتی</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditImplantModal(imp)}
                            className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                            title="ویرایش برند، سایز، تورک، تاریخ هیلینگ یا پیوند استخوان"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>ویرایش مشخصات فیکسچر</span>
                          </button>

                          {patient && (
                            <button
                              type="button"
                              onClick={() => onOpenPatientFile(patient)}
                              className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>پرونده کامل</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {getPreviousImplantStage(imp.currentStage) && (
                            <button
                              type="button"
                              onClick={() => {
                                const prev = getPreviousImplantStage(imp.currentStage);
                                if (prev) {
                                  impactLight();
                                  onAdvanceStage(imp.id, prev);
                                  showToast(`مرحله ایمپلنت «${imp.patientName}» به مرحله قبل بازگردانده شد.`);
                                }
                              }}
                              className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                              title="بازگشت به مرحله قبل"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>مرحله قبل</span>
                            </button>
                          )}

                          {imp.currentStage !== 'crown_delivered' ? (
                            <ArmedActionButton
                              label={getNextStageButtonText(imp.currentStage)}
                              confirmLabel="تایید ارتقای مرحله؟ ✓"
                              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              onConfirm={() => {
                                const next = getNextStage(imp.currentStage);
                                onAdvanceStage(imp.id, next);
                                showToast(`مرحله ایمپلنت با موفقیت ارتقا یافت.`);
                              }}
                              className="py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>پروتز با موفقیت تحویل شد</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline Live Mutation Confirmation Badge */}
                  <CardMutationBadge recordId={imp.id} />
                </div>
              );
            })
          )}
          </div>
        </div>
      )}

      {/* CHIP 1B: INTERACTIVE 3D IMPLANT SURGICAL PLANNER & ISQ SIMULATOR (D3.JS ENGINE) */}
      {activeChip === 'surgical3d' && (
        <Implant3DSurgicalPlannerD3
          implantCases={allImplants}
          patients={patients}
          selectedCaseId={selectedCaseIdFor3D}
          onSelectCase={(caseId) => setSelectedCaseIdFor3D(caseId)}
          onEditImplantCase={onEditImplantCase}
          onAdvanceStage={onAdvanceStage}
          onOpenPalmerChart={onOpenPalmerChart}
          onNavigateToModule={onNavigateToModule}
        />
      )}

      {/* CHIP 2: STAGES & REMINDER CALENDAR */}
      {activeChip === 'reminders' && (
        <div className="mx-2 space-y-3">
          <div className="bg-white rounded-[24px] p-4 border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-1.5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-600" />
                <h4 className="text-xs font-black text-slate-800">یادآوری‌های هوشمند دوره‌های استئواینتگریشن</h4>
              </div>
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-md font-mono font-bold">
                محاسبه زنده بر اساس تاریخ شمسی موعد هیلینگ
              </span>
            </div>

            <div className="space-y-2">
              {allImplants.map(imp => {
                const targetDue = imp.healingDueDate || getRelativePersianDate(60);
                const daysRemaining = diffPersianDays(todayJalali, targetDue);
                const matchedPat = patients.find(p => p.id === imp.patientId);
                const linkedLab = findLinkedLabOrder(imp, matchedPat);
                const isDone = imp.currentStage === 'crown_delivered';
                const isOverdue = !isDone && daysRemaining < 0;

                return (
                  <div
                    key={imp.id}
                    className={`p-3 rounded-2xl border space-y-2 ${
                      isDone
                        ? 'bg-emerald-50/50 border-emerald-200/80'
                        : isOverdue
                        ? 'bg-rose-50/70 border-rose-200'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{imp.patientName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {imp.toothNumber} · {imp.brand}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {imp.currentStage === 'fixture_placed'
                          ? 'موعد بستن هیلینگ'
                          : imp.currentStage === 'healing_cap'
                          ? 'موعد قالب‌گیری'
                          : imp.currentStage === 'impression'
                          ? 'آماده سفارش لابراتوار'
                          : imp.currentStage === 'abutment_framework'
                          ? 'در حال ساخت/تست روکش'
                          : 'تحویل نهایی روکش ✓'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-xs flex-wrap gap-1.5">
                      <span className="text-[10px] text-slate-600">
                        تاریخ موعد: <b className="font-mono text-cyan-800">{toPersianDigits(targetDue)}</b> (
                        {isDone
                          ? 'درمان تکمیل شد'
                          : isOverdue
                          ? <span className="text-rose-700 font-black">{toPersianDigits(Math.abs(daysRemaining))} روز تأخیر - پیگیری فوری</span>
                          : daysRemaining === 0
                          ? <span className="text-amber-700 font-black">موعد امروز!</span>
                          : <span>{toPersianDigits(daysRemaining)} روز دیگر</span>}
                        )
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {linkedLab && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 text-[9.5px] font-black">
                            لابراتوار: {getLabStatusFa(linkedLab.status)}
                          </span>
                        )}
                        {onCreateLabOrderFromImplant && matchedPat && !linkedLab && (imp.currentStage === 'healing_cap' || imp.currentStage === 'impression') && (
                          <button
                            type="button"
                            onClick={() => {
                              impactHeavy();
                              onCreateLabOrderFromImplant(matchedPat, imp);
                            }}
                            className="py-1 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span>ارسال قالب به لابراتوار</span>
                          </button>
                        )}
                        {onScheduleImplantFollowUp && matchedPat && !isDone && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onScheduleImplantFollowUp(matchedPat, imp);
                            }}
                            className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-cyan-50 text-cyan-900 border border-cyan-200 font-black text-[10px] cursor-pointer"
                          >
                            ثبت نوبت پیگیری
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            impactHeavy();
                            scheduleEntityReminder({
                              sourceType: 'implant',
                              sourceId: imp.id,
                              patientId: matchedPat?.id || imp.patientId,
                              patientName: imp.patientName,
                              patientPhone: matchedPat?.phone,
                              title: `موعد مرحله ایمپلنت ${imp.brand} (${imp.toothNumber})`,
                              description: `مرحله: ${getStageTitle(imp.currentStage)} · موعد ${toPersianDigits(targetDue)}`,
                              targetDate: targetDue,
                              targetView: 'implant',
                              config: imp.reminderConfig || {
                                enabled: true,
                                preset: '2d_before',
                                channels: ['phone_push', 'in_app']
                              }
                            });
                            showToast(`یادآور مرحله ایمپلنت «${imp.patientName}» در مرکز جامع یادآوری‌ها ثبت و همگام شد.`);
                          }}
                          className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          <Bell className="w-3 h-3" />
                          <span>ثبت در مرکز یادآوری</span>
                        </button>
                        {matchedPat && onOpenPalmerChart && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenPalmerChart(matchedPat, imp.toothNumber);
                            }}
                            className="py-1 px-2.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-black text-[10px] cursor-pointer"
                          >
                            چارت پالمر
                          </button>
                        )}
                        <button type="button"
                          onClick={async () => {
                            impactLight();
                            if (matchedPat?.phone) {
                              await clinicalSmsService.sendPatternSms(
                                matchedPat.phone,
                                imp.patientName,
                                'implant_healing_recall',
                                { date: targetDue, toothNumber: imp.toothNumber }
                              );
                            }
                            showToast(`پیامک یادآوری موعد هیلینگ برای ${imp.patientName} ارسال شد.`);
                          }}
                          className="py-1 px-2.5 rounded-lg bg-cyan-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs hover:bg-cyan-700 active:scale-95 transition-all cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>ارسال پیامک یادآوری</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CHIP 3: PROSTHETICS & IMPLANT LAB */}
      {activeChip === 'prosthetics' && (() => {
        const readyForLabCases = allImplants.filter(i => i.currentStage === 'healing_cap' || i.currentStage === 'impression');
        const abutmentFrameworkCases = allImplants.filter(i => i.currentStage === 'abutment_framework');
        const deliveredCases = allImplants.filter(i => i.currentStage === 'crown_delivered');
        const linkedLabPairs = allImplants
          .map(imp => {
            const pat = patients.find(p => p.id === imp.patientId);
            const labOrder = findLinkedLabOrder(imp, pat);
            return labOrder ? { imp, pat, labOrder } : null;
          })
          .filter((item): item is { imp: ImplantCase; pat: Patient | undefined; labOrder: LabOrder } => item !== null);

        return (
        <div className="mx-2 space-y-3">
          <div className="bg-white rounded-[24px] p-4 border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-cyan-600" />
                <h4 className="text-xs font-black text-slate-800">کارهای پروتزی و لابراتوار ایمپلنت</h4>
              </div>
              <span className="text-[10px] text-slate-500 font-bold">پایش زنده پرونده‌های پروتزی کلینیک</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-2xl bg-cyan-50 border border-cyan-100">
                <span className="text-[9.5px] text-cyan-800 font-bold block">آماده قالب‌گیری/اباتمنت</span>
                <span className="text-base font-black text-cyan-950 font-mono mt-0.5 block">
                  {toPersianDigits(readyForLabCases.length)} واحد
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-100">
                <span className="text-[9.5px] text-purple-800 font-bold block">در مرحله تست فریم</span>
                <span className="text-base font-black text-purple-950 font-mono mt-0.5 block">
                  {toPersianDigits(abutmentFrameworkCases.length)} واحد
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100">
                <span className="text-[9.5px] text-emerald-800 font-bold block">روکش تحویل‌شده</span>
                <span className="text-base font-black text-emerald-950 font-mono mt-0.5 block">
                  {toPersianDigits(deliveredCases.length)} واحد
                </span>
              </div>
            </div>

            {readyForLabCases.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <h5 className="text-[11px] font-black text-slate-700">کیس‌های آماده ارسال قالب به لابراتوار:</h5>
                {readyForLabCases.map(imp => {
                  const pat = patients.find(p => p.id === imp.patientId);
                  return (
                    <div key={imp.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-black text-slate-900 block truncate">{imp.patientName} · {imp.toothNumber}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{imp.brand} · Ø{imp.diameter}×{imp.length}</span>
                      </div>
                      {onCreateLabOrderFromImplant && pat && (
                        <button
                          type="button"
                          onClick={() => onCreateLabOrderFromImplant(pat, imp)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black shrink-0 cursor-pointer"
                        >
                          ارسال به لابراتوار
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {linkedLabPairs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <h5 className="text-[11px] font-black text-purple-900">سفارشات پروتز ایمپلنت در لابراتوار (سینک زنده دوطرفه با مالی و پرونده):</h5>
                {linkedLabPairs.map(({ imp, pat, labOrder }) => {
                  const patientDebt = pat && pat.balance < 0 ? Math.abs(pat.balance) : 0;
                  return (
                    <div key={`${imp.id}-${labOrder.id}`} className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900">{imp.patientName}</span>
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded bg-white border border-purple-200 text-purple-900">
                            {imp.toothNumber}
                          </span>
                          {labOrder.trackingSlipCode && (
                            <span className="text-[9.5px] font-mono font-bold text-purple-700">{labOrder.trackingSlipCode}</span>
                          )}
                          <span
                            className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md ${
                              patientDebt > 0
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {patientDebt > 0 ? `بدهی بیمار: ${formatToman(patientDebt)}` : 'تسویه کامل ✓'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-600 font-bold block mt-0.5">
                          {labOrder.workType} · {labOrder.labName} · موعد تحویل: <span className="font-mono">{toPersianDigits(labOrder.deliveryDate)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <span className="px-2 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 text-[10px] font-black">
                          {getLabStatusFa(labOrder.status)}
                        </span>
                        {pat && onOpenPaymentModal && patientDebt > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenPaymentModal(pat);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                          >
                            تسویه (POS)
                          </button>
                        )}
                        {pat && onOpenPalmerChart && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenPalmerChart(pat, imp.toothNumber);
                            }}
                            className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black cursor-pointer"
                          >
                            چارت پالمر
                          </button>
                        )}
                        {onNavigateToModule && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onNavigateToModule('lab');
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-[10px] font-black cursor-pointer"
                          >
                            ماژول لابراتوار
                          </button>
                        )}
                        {pat && (
                          <button
                            type="button"
                            onClick={() => onOpenPatientFile(pat)}
                            className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black cursor-pointer"
                          >
                            پرونده بیمار
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <h5 className="text-[11px] font-black text-slate-700">اقلام مصرفی پروتز ایمپلنت:</h5>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700">
                  اسکن بادی (Scan Body)
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700">
                  تیتانیوم بیس (Ti-Base)
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700">
                  اباتمنت زاویه‌دار ۱۵° و ۲۵°
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* CHIP 4: CATALOG & BRAND SPECS */}
      {activeChip === 'catalog' && (
        <div className="mx-2 space-y-2.5">
          {BRAND_SPECS.map(spec => (
            <div key={spec.brand} className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${spec.color}`} />
                  <h4 className="text-xs font-black text-slate-900">{spec.brand}</h4>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  ساخت {spec.country}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[9px]">نوع اتصال (Connection)</span>
                  <span className="font-bold text-slate-800">{spec.connection}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">تورک پیشنهادی</span>
                  <span className="font-bold text-emerald-600 font-mono">{spec.recommendedTorque}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">دوره هیلینگ</span>
                  <span className="font-bold text-cyan-700 font-mono">{toPersianDigits(spec.healingPeriodMonths)} ماه</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHIP 5: ALL-ON-4 / ALL-ON-6 BIOMECHANICS & MISCH CANTILEVER ENGINE */}
      {activeChip === 'biomechanics' && (() => {
        const mischMultiplier = bioArch === 'mandible' ? 1.5 : 1.0;
        const maxCantileverMm = Math.round((apSpreadMm * mischMultiplier) * 10) / 10;
        const isCantileverSafe = plannedCantileverMm <= maxCantileverMm;
        const cumulativeTorque = bioTorques.reduce((sum, t) => sum + t, 0);
        const minTorque = Math.min(...bioTorques);
        const isImmediateLoadingSafe = isCantileverSafe && cumulativeTorque >= 120 && minTorque >= 35;
        const leverRatio = Math.round((plannedCantileverMm / apSpreadMm) * 100) / 100;

        return (
          <div className="mx-2 space-y-3">
            {/* Engine Overview Card (Bright Cyan/Teal Pastel Aesthetic) */}
            <div className="bg-gradient-to-br from-cyan-50/90 via-white to-teal-50/80 rounded-[24px] p-4 text-slate-900 shadow-sm border border-cyan-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-black shadow-xs">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      موتور بیومکانیک فول‌آرک (All-on-4 / All-on-6)
                    </h4>
                  </div>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border text-center ${
                  isImmediateLoadingSafe 
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900' 
                    : 'bg-rose-100 border-rose-300 text-rose-900'
                }`}>
                  <span className="text-[9px] block font-bold">بارگذاری فوری</span>
                  <span className="text-xs font-black">
                    {isImmediateLoadingSafe ? '✓ تایید و ایمن' : '⚠️ غیرمجاز'}
                  </span>
                </div>
              </div>

              {/* Arch & Setup Toggle */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-200/70">
                <div className="bg-white p-2 rounded-xl border border-cyan-200/80">
                  <label className="text-[10px] text-cyan-800 font-bold block mb-1">فک جراحی:</label>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setBioArch('mandible');
                      }}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        bioArch === 'mandible' ? 'bg-cyan-600 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      مندیبل (×1.5)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setBioArch('maxilla');
                      }}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        bioArch === 'maxilla' ? 'bg-cyan-600 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ماگزیلا (×1.0)
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-cyan-200/80">
                  <label className="text-[10px] text-cyan-800 font-bold block mb-1">آرایش فیکسچرها:</label>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setBioConfig('all_on_4');
                        setBioTorques([45, 40, 45, 50]);
                      }}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        bioConfig === 'all_on_4' ? 'bg-cyan-600 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All-on-4
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setBioConfig('all_on_6');
                        setBioTorques([45, 40, 40, 45, 45, 50]);
                      }}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        bioConfig === 'all_on_6' ? 'bg-cyan-600 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All-on-6
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations & Sliders Card */}
            <div className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 space-y-3.5">
              <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
                <span>پارامترهای هندسی و بیومکانیک کانتلیور پروتز:</span>
              </h5>

              {/* A-P Spread Slider */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    فاصله قدامی-خلفی فیکسچرها (A-P Spread):
                  </span>
                  <span className="font-mono font-black text-sm text-teal-700">
                    {toPersianDigits(apSpreadMm)} میلی‌متر
                  </span>
                </div>
                <input aria-label="ورودی اطلاعات بالینی"
                  type="range"
                  min="8"
                  max="24"
                  step="0.5"
                  value={apSpreadMm}
                  onChange={(e) => setApSpreadMm(parseFloat(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  فاصله بین خط متصل‌کننده لبه مزیال قدامی‌ترین فیکسچر تا خط دیستال خلفی‌ترین فیکسچر
                </span>
              </div>

              {/* Planned Cantilever Slider */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    طول کانتلیور طراحی‌شده پروتز نهایی:
                  </span>
                  <span className={`font-mono font-black text-sm ${
                    isCantileverSafe ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {toPersianDigits(plannedCantileverMm)} میلی‌متر
                  </span>
                </div>
                <input aria-label="ورودی اطلاعات بالینی"
                  type="range"
                  min="6"
                  max="28"
                  step="0.5"
                  value={plannedCantileverMm}
                  onChange={(e) => setPlannedCantileverMm(parseFloat(e.target.value))}
                  className={`w-full cursor-pointer ${isCantileverSafe ? 'accent-emerald-600' : 'accent-rose-600'}`}
                />
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">
                    حداکثر طول مجاز کانتلیور طبق معیار Misch: <strong>{toPersianDigits(maxCantileverMm)} میلی‌متر</strong>
                  </span>
                  <span className={`font-bold px-2 py-0.5 rounded-full ${
                    isCantileverSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isCantileverSafe ? '✓ در محدوده ایمن Misch' : '⚠️ فراتر از حد مجاز اهرم'}
                  </span>
                </div>
              </div>

              {/* Insertion Torque Inputs */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">گشتاور استقرار فیکسچرها (تورک اولیه):</span>
                  <span className="font-mono text-xs text-slate-600">
                    مجموع گشتاور: <strong className="text-teal-800 text-sm">{toPersianDigits(cumulativeTorque)} N/cm</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bioTorques.map((t, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 block mb-1">فیکسچر #{toPersianDigits(idx + 1)}</span>
                      <div className="flex items-center justify-center gap-1 font-mono">
                        <input aria-label="ورودی اطلاعات بالینی"
                          type="text"
                          inputMode="numeric"
                          value={toPersianDigits(t)}
                          onChange={(e) => {
                            const raw = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                            const val = parseInt(raw, 10) || 0;
                            setBioTorques(prev => prev.map((old, i) => i === idx ? val : old));
                          }}
                          className="w-14 text-center font-black text-sm border border-slate-300 rounded-lg p-1 text-slate-800 focus:outline-none focus:border-teal-500"
                        />
                        <span className="text-[9px] text-slate-400">N/cm</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Biomechanical Summary Metric Cards */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-2xl bg-teal-50/80 border border-teal-200">
                  <span className="text-[9.5px] text-teal-800 block font-bold">ضریب اهرم Misch</span>
                  <span className="font-mono font-black text-sm text-teal-900 mt-0.5 block">
                    {toPersianDigits(leverRatio)}×
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-cyan-50/80 border border-cyan-200">
                  <span className="text-[9.5px] text-cyan-800 block font-bold">حد مجاز کانتلیور</span>
                  <span className="font-mono font-black text-sm text-cyan-900 mt-0.5 block">
                    {toPersianDigits(maxCantileverMm)} mm
                  </span>
                </div>
                <div className={`p-2.5 rounded-2xl border ${
                  isImmediateLoadingSafe ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <span className="text-[9.5px] block font-bold">ایمنی بارگذاری</span>
                  <span className="font-mono font-black text-sm mt-0.5 block">
                    {isImmediateLoadingSafe ? '۱۰۰٪ ایمن' : 'هشدار اهرم'}
                  </span>
                </div>
              </div>

              {/* Clinical Advisory Alert */}
              {!isCantileverSafe && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="block font-black">هشدار شکست اهرم بیومکانیکی (Misch Overhang):</strong>
                    <p className="text-[11px] leading-relaxed">
                      طول کانتلیور انتخابی ({toPersianDigits(plannedCantileverMm)} mm) فراتر از حد مجاز ({toPersianDigits(maxCantileverMm)} mm) است. این امر گشتاور چرخشی و نیروی اهرمی مخرب ایجاد کرده و احتمال شل شدن پیچ اباتمنت، شکست فریم‌ورک و تحلیل استخوان کرستال فیکسچر خلفی را به شدت بالا می‌برد.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}


      {selectedWarrantyCase && (
        <ViewportModalPortal isOpen={Boolean(selectedWarrantyCase)}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="شناسنامه و گارانتی اصالت ایمپلنت"
            className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setSelectedWarrantyCase(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-amber-300 shadow-2xl text-center relative flex flex-col overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 shrink-0" />
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-amber-100 bg-white shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-amber-300 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-right">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900">شناسنامه و گارانتی اصالت ایمپلنت</h3>
                      <p className="text-[10px] text-slate-500">کلینیک دندانپزشکی تخصصی مینادنتال</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWarrantyCase(null)}
                    aria-label="بستن شناسنامه ایمپلنت"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <div className="p-4 flex-1 overflow-y-auto overscroll-contain">
                <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100 text-right space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">نام بیمار:</span>
                    <span className="font-black text-slate-900">{selectedWarrantyCase.patientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">موقعیت دندان:</span>
                    <span className="font-bold text-slate-900 font-mono">{selectedWarrantyCase.toothNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">برند فیکسچر:</span>
                    <span className="font-bold text-slate-900">{selectedWarrantyCase.brand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">قطر و طول:</span>
                    <span className="font-mono font-bold text-slate-900">Ø {selectedWarrantyCase.diameter} × {selectedWarrantyCase.length}mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تورک اولیه:</span>
                    <span className="font-mono font-bold text-emerald-600">{toPersianDigits(selectedWarrantyCase.torque)} N/cm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تاریخ کاشت:</span>
                    <span className="font-mono font-bold text-slate-900">{toPersianDigits(selectedWarrantyCase.surgeryDate)}</span>
                  </div>
                  {selectedWarrantyCase.sterilePackCode && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">کد پک استریل / لات:</span>
                      <span className="font-mono font-black text-cyan-800">{selectedWarrantyCase.sterilePackCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">گارانتی:</span>
                    <span className="font-bold text-emerald-700">مادام‌العمر اصالت فیکسچر</span>
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Footer */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-amber-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedWarrantyCase(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast('شناسنامه به پرینتر کلینیک ارسال گردید.');
                    setSelectedWarrantyCase(null);
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  چاپ شناسنامه
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Add New Implant Surgical Case Modal (Full-Page Mobile Sheet - Zero Page Scroll Required) */}
      {showAddModal && (
        <ViewportModalPortal isOpen={showAddModal}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ثبت جراحی کاشت ایمپلنت جدید"
            className="fixed inset-0 z-[100] bg-slate-950/35 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => {
              setConfirmCreateStep(false);
              setShowAddModal(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-cyan-50/95 via-white to-slate-50 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-cyan-200/90 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-cyan-200/80 bg-white/95 shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-cyan-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-xs">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">ثبت جراحی کاشت ایمپلنت جدید</h3>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setConfirmCreateStep(false);
                      setShowAddModal(false);
                    }} 
                    aria-label="بستن ثبت جراحی ایمپلنت"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <form id="new-implant-form" onSubmit={handleCreateImplant} className="p-4 space-y-3 text-[11px] flex-1 overflow-y-auto overscroll-contain">
                {/* Row 1: بیمار + دندان هدف */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">انتخاب بیمار</label>
                    <select aria-label="انتخاب بیمار"
                      value={formPatientId}
                      onChange={(e) => setFormPatientId(e.target.value)}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">دندان هدف (سیستم پالمر)</label>
                    <input
                      aria-label="دندان هدف (سیستم پالمر)"
                      type="text"
                      value={formTooth}
                      onChange={(e) => setFormTooth(e.target.value)}
                      placeholder="مثال: LR6"
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Row 2: سیستم ایمپلنت */}
                <div>
                  <label className="text-slate-700 font-bold block mb-1">سیستم و برند ایمپلنت</label>
                  <select aria-label="سیستم و برند ایمپلنت"
                    value={formBrand}
                    onChange={(e) => {
                      const chosen = e.target.value;
                      setFormBrand(chosen);
                      const spec = BRAND_SPECS.find(b => b.brand === chosen);
                      if (spec) {
                        setFormHealingMonths(Math.round(spec.healingPeriodMonths));
                      }
                    }}
                    className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                  >
                    <option value="اشترومن Straumann (BLX/SLA)">اشترومن (Straumann BLX)</option>
                    <option value="اوستم Osstem (TSIII SA)">اوستم (Osstem TSIII)</option>
                    <option value="دنتیوم Dentium (SuperLine)">دنتیوم (Dentium SuperLine)</option>
                    <option value="مگاژن Megagen (AnyRidge)">مگاژن (Megagen AnyRidge)</option>
                    <option value="نئودنت Neodent (Grand Morse)">نئودنت (Neodent Grand Morse)</option>
                    <option value="دیو DIO (SM/UFII)">دیو (DIO SM)</option>
                  </select>
                </div>

                {/* Row 3: قطر + طول + تورک اولیه */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">قطر فیکسچر (mm)</label>
                    <input
                      aria-label="قطر فیکسچر (mm)"
                      type="text"
                      value={formDiameter}
                      onChange={(e) => setFormDiameter(e.target.value)}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                      placeholder="۴.۲"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">طول فیکسچر (mm)</label>
                    <input
                      aria-label="طول فیکسچر (mm)"
                      type="text"
                      value={formLength}
                      onChange={(e) => setFormLength(e.target.value)}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                      placeholder="۱۰"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">تورک اولیه (N/cm)</label>
                    <input aria-label="تورک اولیه (N/cm)"
                      type="text"
                      inputMode="numeric"
                      value={toPersianDigits(formTorque)}
                      onChange={(e) => {
                        const raw = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                        setFormTorque(raw ? Number(raw) : 0);
                      }}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Row 4: کیفیت استخوان + طول دوره هیلینگ */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">کیفیت استخوان (Density)</label>
                    <select aria-label="کیفیت استخوان (Density)"
                      value={formBoneDensity}
                      onChange={(e) => setFormBoneDensity(e.target.value as any)}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      <option value="D1">D1 (بسیار متراکم)</option>
                      <option value="D2">D2 (ایده‌آل - ترابکولار)</option>
                      <option value="D3">D3 (تراکم متوسط)</option>
                      <option value="D4">D4 (اسفنجی نرم)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">طول دوره هیلینگ</label>
                    <select aria-label="طول دوره هیلینگ"
                      value={formHealingMonths}
                      onChange={(e) => setFormHealingMonths(Number(e.target.value))}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      <option value={2}>۲ ماه (فوری D1-D2)</option>
                      <option value={3}>۳ ماه (استاندارد)</option>
                      <option value={4}>۴ ماه (پیوند استخوان)</option>
                      <option value={6}>۶ ماه (سینوس لیفت)</option>
                    </select>
                  </div>
                </div>

                {/* Row 5: Grafts Checkboxes + Sterile CSSD / Lot Traceability & Inventory Strip */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-cyan-200">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      aria-label="پیوند پودر استخوان"
                      type="checkbox"
                      checked={formBoneGraft}
                      onChange={(e) => setFormBoneGraft(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="font-bold text-slate-800">پیوند پودر استخوان</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      aria-label="ممبرین کلاژن"
                      type="checkbox"
                      checked={formMembrane}
                      onChange={(e) => setFormMembrane(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="font-bold text-slate-800">ممبرین کلاژن</span>
                  </label>
                </div>

                {/* Live Sterile Fixture Inventory Readiness + CSSD Autoclave Lot Input */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-black text-emerald-950">کد پک استریل اتوکلاو (CSSD) / لات فیکسچر:</span>
                    {inventory.length > 0 && (() => {
                      const fixtureItems = inventory.filter(i => i.name.includes('فیکسچر') || i.category.includes('ایمپلنت'));
                      const totalFixStock = fixtureItems.reduce((s, i) => s + i.stock, 0);
                      return (
                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border ${
                          totalFixStock > 2
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}>
                          موجودی فیکسچر انبار: {toPersianDigits(totalFixStock)} کیت (کسر خودکار)
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    aria-label="کد پک استریل اتوکلاو یا لات فیکسچر"
                    type="text"
                    value={formSterilePackCode}
                    onChange={(e) => setFormSterilePackCode(e.target.value)}
                    placeholder="مثلاً CSSD-134-A42 یا LOT-STR-882 (اختیاری)"
                    dir="ltr"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Row 6: تاریخ کاشت + جراح معالج */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">تاریخ کاشت</label>
                    <input aria-label="تاریخ کاشت"
                      type="text"
                      value={formSurgeryDate}
                      onChange={(e) => setFormSurgeryDate(e.target.value)}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">جراح معالج</label>
                    <input aria-label="جراح معالج"
                      type="text"
                      list="implant-surgeons-list"
                      value={formDoctor}
                      onChange={(e) => setFormDoctor(e.target.value)}
                      className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                    />
                    <datalist id="implant-surgeons-list">
                      {surgeonSuggestions.map((doc) => (
                        <option key={doc} value={doc} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Inline Reminder & Phone Notification Picker */}
                <ReminderOptionPicker
                  value={formReminderConfig}
                  onChange={setFormReminderConfig}
                  targetDate={getRelativePersianDate(formHealingMonths * 30)}
                  theme="cyan"
                  title="یادآوری مراحل ایمپلنت و موعد هیلینگ (نوتیف گوشی)"
                />
              </form>

              {/* Fixed Bottom Action Footer with 2-Step Confirmation */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-cyan-100 shrink-0 sticky bottom-0 z-20">
                {confirmCreateStep ? (
                  <div className="p-2.5 rounded-2xl bg-cyan-50 border-2 border-cyan-400 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between text-xs font-black text-cyan-950">
                      <span>تایید ثبت جراحی «{formBrand.split(' ')[0]}» ({formTooth})</span>
                      <span className="font-mono text-cyan-800 bg-white px-2 py-0.5 rounded-lg border border-cyan-200">
                        Ø{formDiameter}×{formLength}
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
                        type="submit"
                        form="new-implant-form"
                        className="w-2/3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md shadow-cyan-600/25 active:scale-95 transition-all cursor-pointer"
                      >
                        تایید و ثبت قطعی جراحی ✓
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmCreateStep(false);
                        setShowAddModal(false);
                      }}
                      className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setConfirmCreateStep(true);
                      }}
                      className="w-2/3 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md shadow-cyan-600/25 active:scale-95 transition-all cursor-pointer"
                    >
                      مرحله ۱: بررسی و ثبت جراحی
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Full Edit / Warranty Replace Implant Case Modal */}
      {editingImplantCase && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingImplantCase(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ویرایش مشخصات فیکسچر و جراحی ایمپلنت"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-cyan-200 p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">ویرایش مشخصات فیکسچر و جراحی ایمپلنت</h4>
                    <span className="text-[10px] text-slate-500 font-bold">
                      بیمار: {editingImplantCase.patientName} · اصلاح سایز، تورک و تاریخ هیلینگ
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingImplantCase(null)}
                  aria-label="بستن ویرایش ایمپلنت"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">برند فیکسچر</label>
                    <select aria-label="برند فیکسچر"
                      value={editImpBrand}
                      onChange={(e) => setEditImpBrand(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-cyan-500 focus:outline-none"
                    >
                      {BRAND_SPECS.map(b => (
                        <option key={b.brand} value={b.brand}>{b.brand}</option>
                      ))}
                      {!BRAND_SPECS.some(b => b.brand === editImpBrand) && (
                        <option value={editImpBrand}>{editImpBrand}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">ناحیه دندان (پالمر)</label>
                    <input aria-label="ناحیه دندان (پالمر)"
                      type="text"
                      value={editImpTooth}
                      onChange={(e) => setEditImpTooth(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">قطر (Ø mm)</label>
                    <select aria-label="قطر (Ø mm)"
                      value={editImpDiameter}
                      onChange={(e) => setEditImpDiameter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-cyan-500 focus:outline-none"
                    >
                      {['3.3', '3.5', '3.75', '4.0', '4.1', '4.3', '4.5', '4.8', '5.0'].map(d => (
                        <option key={d} value={d}>Ø{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">طول (mm)</label>
                    <select aria-label="طول (mm)"
                      value={editImpLength}
                      onChange={(e) => setEditImpLength(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-cyan-500 focus:outline-none"
                    >
                      {['8', '8.5', '10', '11.5', '12', '13', '14'].map(l => (
                        <option key={l} value={l}>{l} mm</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">تورک (N/cm)</label>
                    <input aria-label="تورک (N/cm)"
                      type="number"
                      value={editImpTorque}
                      onChange={(e) => setEditImpTorque(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">تاریخ کاشت فیکسچر</label>
                    <input aria-label="تاریخ کاشت فیکسچر"
                      type="text"
                      value={editImpSurgeryDate}
                      onChange={(e) => setEditImpSurgeryDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">موعد بستن هیلینگ</label>
                    <input aria-label="موعد بستن هیلینگ"
                      type="text"
                      value={editImpHealingDueDate}
                      onChange={(e) => setEditImpHealingDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-50/60 border border-cyan-200">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      aria-label="ویرایش پیوند پودر استخوان (GBR)"
                      type="checkbox"
                      checked={editImpBoneGraft}
                      onChange={(e) => setEditImpBoneGraft(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-600"
                    />
                    <span className="font-bold text-slate-800">پیوند پودر استخوان (GBR)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      aria-label="ویرایش ممبرین کلاژن"
                      type="checkbox"
                      checked={editImpMembrane}
                      onChange={(e) => setEditImpMembrane(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-600"
                    />
                    <span className="font-bold text-slate-800">ممبرین کلاژن</span>
                  </label>
                </div>

                <ReminderOptionPicker
                  value={editImpReminderConfig}
                  onChange={setEditImpReminderConfig}
                  targetDate={editImpHealingDueDate}
                  theme="cyan"
                  title="یادآوری موعد هیلینگ و ادامه ایمپلنت (نوتیف گوشی)"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {onDeleteImplantCase && isManager ? (
                  <ArmedActionButton
                    label="حذف کیس (مدیر)"
                    confirmLabel="تایید بایگانی؟ ✓"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onConfirm={() => {
                      onDeleteImplantCase(editingImplantCase.id);
                      showToast(`کیس ایمپلنت «${editingImplantCase.patientName}» به بایگانی مدیر منتقل شد.`);
                      setEditingImplantCase(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">🔒 حذف کیس فقط توسط مدیر</span>
                )}
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingImplantCase(null)}
                    className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      success();
                      if (onEditImplantCase) {
                        onEditImplantCase(editingImplantCase.id, {
                          brand: editImpBrand,
                          toothNumber: editImpTooth.trim(),
                          diameter: editImpDiameter,
                          length: editImpLength,
                          torque: editImpTorque,
                          surgeryDate: editImpSurgeryDate.trim(),
                          healingDueDate: editImpHealingDueDate.trim(),
                          boneGraft: editImpBoneGraft,
                          membrane: editImpMembrane,
                          reminderConfig: editImpReminderConfig
                        });
                      }
                      showToast(`مشخصات ایمپلنت «${editingImplantCase.patientName}» ذخیره شد.`);
                      setEditingImplantCase(null);
                    }}
                    className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    ذخیره مشخصات فیکسچر ✓
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
