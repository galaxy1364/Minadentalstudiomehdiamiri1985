import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  FlaskConical,
  HeartPulse,
  Layers,
  Microscope,
  Play,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  X,
  Box,
  Bell,
  BarChart3
} from 'lucide-react';
import * as d3 from 'd3';
import { Appointment, Patient, ToothCondition, TreatmentType } from '../../types/dental';
import { formatToman, toPersianDigits } from '../../utils/jalali';
import { getModuleHeaderCardClasses, getUnifiedChipBadgeClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { copyTextSafely } from '../../utils/clipboard';
import { evaluateAntesLaw } from '../../utils/clinicalSafety';
import {
  buildClinicTreatmentQueue,
  buildPhasedTreatmentRoadmap,
  evaluateEndodonticDiagnosis,
  evaluatePatientTreatmentSafety,
  evaluatePeriodontalRisk,
  getTreatmentClinicalProtocol,
  TREATMENT_LABELS_FA
} from '../../utils/treatmentIntelligence';
import { evaluateMultiFieldFuzzySearch } from './PatientsListView';
import { Lab3DModelViewerD3 } from '../Lab3DModelViewerD3';
import { Implant3DSurgicalPlannerD3 } from '../Implant3DSurgicalPlannerD3';
import { scheduleEntityReminder } from '../../services/reminderNotificationService';
import { getCurrentPersianDate } from '../../utils/jalali';

export interface TreatmentsViewProps {
  patients: Patient[];
  appointments?: Appointment[];
  selectedPatientId?: string;
  onSelectPatientId?: (patientId: string) => void;
  onOpenPalmerChart: (
    patient?: Patient,
    tooth?: { quadrant: 'UR' | 'UL' | 'LL' | 'LR'; toothNumber: number }
  ) => void;
  onOpenPatientFile: (
    patient: Patient,
    tab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai'
  ) => void;
  onUpdateTreatmentStatus?: (
    patientId: string,
    toothKey: string,
    status: ToothCondition['status']
  ) => void;
  onScheduleAppointment?: (patient: Patient, suggestedTreatment?: string) => void;
  onLaunchLabFromTreatment?: (prefill: {
    patientId?: string;
    toothNumber: string;
    workType: string;
  }) => void;
  isManager?: boolean;
}

type TreatmentChipTab = 'roadmap' | 'clinical3d' | 'cdss' | 'queue' | 'protocols';
type QueueFilter = 'all' | 'alerts' | 'in_progress' | 'planned' | 'completed';

const STATUS_BADGE_MAP: Record<
  ToothCondition['status'],
  { label: string; badgeClass: string; toothClass: string }
> = {
  planned: {
    label: 'طرح درمان',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    toothClass: 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100'
  },
  in_progress: {
    label: 'در حال درمان',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    toothClass: 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
  },
  completed: {
    label: 'تکمیل‌شده',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    toothClass: 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
  }
};

const TREATMENT_SHORT_LABELS: Record<TreatmentType, string> = {
  composite: 'کامپو',
  amalgam: 'آمالگ',
  endo: 'اندو',
  crown_zirconia: 'زیرکون',
  crown_pfm: 'PFM',
  implant: 'ایمپلنت',
  extraction: 'کشیدن',
  scaling: 'جرم',
  bleaching: 'بلیچ',
  laminate: 'لمینت',
  pulpotomy: 'پالپو',
  pulpectomy: 'پالپک',
  ss_crown: 'SSC',
  fissure_sealant: 'سیلنت',
  fluoride: 'فلوراید',
  space_maintainer: 'فضا'
};

const resolveConditionForTooth = (
  conditions: Record<string, ToothCondition> | undefined,
  quadrant: 'UR' | 'UL' | 'LL' | 'LR',
  toothNumber: number
): { key: string; cond?: ToothCondition } => {
  const map = conditions || {};
  const k1 = `${quadrant}_${toothNumber}`;
  if (map[k1]) return { key: k1, cond: map[k1] };
  const k2 = `${quadrant}-${toothNumber}`;
  if (map[k2]) return { key: k2, cond: map[k2] };
  const k3 = `${quadrant}${toothNumber}`;
  if (map[k3]) return { key: k3, cond: map[k3] };
  return { key: k1, cond: undefined };
};

export const TreatmentsView: React.FC<TreatmentsViewProps> = ({
  patients,
  selectedPatientId,
  onSelectPatientId,
  onOpenPalmerChart,
  onOpenPatientFile,
  onUpdateTreatmentStatus,
  onScheduleAppointment,
  onLaunchLabFromTreatment
}) => {
  const { selection, impactLight, success } = useHapticFeedback();

  const [activeChip, setActiveChip] = useState<TreatmentChipTab>('roadmap');
  const [internalPatientId, setInternalPatientId] = useState<string>(patients[0]?.id || '');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab 2 Interactive CDSS Simulator State
  const [simWeightKg, setSimWeightKg] = useState<number>(70);
  const [simColdTest, setSimColdTest] = useState<
    'نرمال' | 'پالپیت برگشت‌پذیر' | 'پالپیت غیرقابل‌برگشت' | 'نکروز (بدون پاسخ)'
  >('پالپیت غیرقابل‌برگشت');
  const [simPercussion, setSimPercussion] = useState<'منفی (-)' | 'مثبت (+)'>('مثبت (+)');
  const [simPalpation, setSimPalpation] = useState<'منفی (-)' | 'مثبت (+)'>('منفی (-)');
  const [simCandidateTreatment, setSimCandidateTreatment] = useState<TreatmentType>('composite');
  const [simPocketDepth, setSimPocketDepth] = useState<number>(5);
  const [simMobility, setSimMobility] = useState<'0' | 'I' | 'II' | 'III'>('I');
  const [simBop, setSimBop] = useState<boolean>(true);
  const [simAbutmentArea, setSimAbutmentArea] = useState<number>(430);
  const [simPonticArea, setSimPonticArea] = useState<number>(360);

  // Tab 4 Selected Clinical Protocol
  const [selectedProtocolType, setSelectedProtocolType] = useState<TreatmentType>('endo');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setToastMessage((cur) => (cur === msg ? null : cur));
      }, 3400);
    }
  };

  const activePatient = useMemo(() => {
    if (selectedPatientId) {
      const matched = patients.find((p) => p.id === selectedPatientId);
      if (matched) return matched;
    }
    const localMatched = patients.find((p) => p.id === internalPatientId);
    return localMatched || patients[0] || null;
  }, [patients, selectedPatientId, internalPatientId]);

  const roadmap = useMemo(() => buildPhasedTreatmentRoadmap(activePatient), [activePatient]);
  const clinicQueue = useMemo(() => buildClinicTreatmentQueue(patients), [patients]);

  const clinicMetrics = useMemo(() => {
    const activeCount = clinicQueue.filter((q) => q.status !== 'completed').length;
    const completedCount = clinicQueue.filter((q) => q.status === 'completed').length;
    const totalAlerts = clinicQueue.filter((q) => q.hasClinicalAlert || q.priorityLevel === 'urgent_pain').length;
    return {
      activeCount,
      completedCount,
      totalAlerts,
      activePlanCost: roadmap.pendingCost
    };
  }, [clinicQueue, roadmap.pendingCost]);

  const filteredQueue = useMemo(() => {
    return clinicQueue.filter((item) => {
      if (queueFilter === 'alerts' && !item.hasClinicalAlert && item.priorityLevel !== 'urgent_pain') {
        return false;
      }
      if (queueFilter === 'in_progress' && item.status !== 'in_progress') return false;
      if (queueFilter === 'planned' && item.status !== 'planned') return false;
      if (queueFilter === 'completed' && item.status !== 'completed') return false;

      if (searchQuery.trim()) {
        const fuzzy = evaluateMultiFieldFuzzySearch(searchQuery, [
          { value: item.patientName, label: 'نام بیمار' },
          { value: item.patientFileNumber, label: 'شماره پرونده', maxTypos: 1 },
          { value: item.treatmentLabel, label: 'نوع درمان' },
          { value: item.doctorName, label: 'نام پزشک' },
          { value: `${item.quadrant}${item.toothNumber}`, label: 'کد دندان', maxTypos: 1 },
          { value: item.notes || '', label: 'یادداشت' }
        ]);
        return fuzzy.matched;
      }
      return true;
    });
  }, [clinicQueue, queueFilter, searchQuery]);

  const cdssSafety = useMemo(
    () =>
      evaluatePatientTreatmentSafety({
        patient: activePatient,
        weightKg: simWeightKg,
        plannedTreatment: simCandidateTreatment
      }),
    [activePatient, simWeightKg, simCandidateTreatment]
  );

  const cdssEndo = useMemo(
    () =>
      evaluateEndodonticDiagnosis({
        coldTest: simColdTest,
        percussion: simPercussion,
        palpation: simPalpation,
        selectedTreatment: simCandidateTreatment
      }),
    [simColdTest, simPercussion, simPalpation, simCandidateTreatment]
  );

  const cdssPerio = useMemo(
    () =>
      evaluatePeriodontalRisk({
        pockets: {
          MB: Math.max(2, simPocketDepth - 1),
          B: simPocketDepth,
          DB: simPocketDepth,
          ML: Math.max(2, simPocketDepth - 1),
          L: 3,
          DL: simPocketDepth
        },
        mobility: simMobility,
        bop: simBop,
        plannedTreatment: simCandidateTreatment
      }),
    [simPocketDepth, simMobility, simBop, simCandidateTreatment]
  );

  const antesEval = useMemo(
    () => evaluateAntesLaw(simAbutmentArea, simPonticArea),
    [simAbutmentArea, simPonticArea]
  );

  const activeProtocolSpec = useMemo(
    () => getTreatmentClinicalProtocol(selectedProtocolType, 6, ['occlusal', 'mesial']),
    [selectedProtocolType]
  );

  const d3PhaseBreakdown = useMemo(() => {
    const colorMap: Record<string, string> = {
      rose: '#e11d48',
      amber: '#d97706',
      teal: '#0d9488',
      sky: '#0284c7'
    };
    const rows = roadmap.phases.map((ph, idx) => ({
      phaseId: String(ph.phaseId),
      shortTitle: `فاز ${toPersianDigits(idx + 1)}`,
      fullTitle: ph.title,
      costMillion: Math.round((ph.totalCost / 1_000_000) * 10) / 10,
      rawCost: ph.totalCost,
      itemsCount: ph.items.length,
      minutes: ph.totalMinutes,
      color: colorMap[ph.badgeColor] || '#0d9488'
    }));
    const width = 440;
    const height = 114;
    const margin = { top: 14, right: 12, bottom: 26, left: 26 };
    const maxVal = Math.max(1, d3.max(rows, r => r.costMillion) || 1);
    const xScale = d3
      .scaleBand<string>()
      .domain(rows.map(r => r.phaseId))
      .range([margin.left, width - margin.right])
      .padding(0.32);
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
      maxVal,
      ticks: yScale.ticks(3),
      bars: rows.map(r => {
        const x = xScale(r.phaseId) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(r.costMillion);
        const h = Math.max(r.costMillion > 0 ? 6 : 2, baselineY - y);
        return {
          ...r,
          x,
          y: baselineY - h,
          barW,
          h
        };
      })
    };
  }, [roadmap.phases]);

  const handleCopyTreatmentPlan = async () => {
    if (!activePatient) return;
    selection();
    const lines = [
      `🦷 طرح درمان جامع کلینیک مینادنتال`,
      `بیمار: ${activePatient.fullName} (پرونده ${toPersianDigits(activePatient.fileNumber)})`,
      `پیشرفت طرح درمان: ${toPersianDigits(roadmap.completionPercent)}٪ · ارزش کل: ${formatToman(roadmap.totalPlannedCost)}`,
      `زمان تخمینی صندلی باقیمانده: ${toPersianDigits(roadmap.totalChairMinutes)} دقیقه (${toPersianDigits(roadmap.estimatedVisits)} جلسه)`,
      ...roadmap.phases
        .filter((ph) => ph.items.length > 0)
        .map(
          (ph) =>
            `\n• ${ph.title}:\n` +
            ph.items
              .map(
                (it) =>
                  `  - دندان ${it.quadrant}${toPersianDigits(it.toothNumber)}: ${it.treatmentLabel} (${STATUS_BADGE_MAP[it.status].label}) — ${formatToman(it.cost)}`
              )
              .join('\n')
        )
    ];
    await copyTextSafely(lines.join('\n'));
    success();
    showToast(`خلاصه طرح درمان ۴ فازی ${activePatient.fullName} با موفقیت کپی شد.`);
  };

  const handleCopyProtocolChecklist = async () => {
    selection();
    const txt = [
      `📘 پروتکل بالینی استاندارد: ${activeProtocolSpec.label}`,
      `ایزولاسیون: ${activeProtocolSpec.isolationRequired}`,
      `زمان صندلی: ${toPersianDigits(activeProtocolSpec.chairMinutes)} دقیقه (${toPersianDigits(activeProtocolSpec.recommendedSessions)} جلسه)`,
      `بی‌حسی: ${activeProtocolSpec.anesthesiaProtocol}`,
      `متریال: ${activeProtocolSpec.biomaterialSpec}`,
      `مراحل اجرایی:`,
      ...activeProtocolSpec.chairsideChecklist.map((s, idx) => `${toPersianDigits(idx + 1)}. ${s}`)
    ].join('\n');
    await copyTextSafely(txt);
    success();
    showToast(`چک‌لیست پروتکل «${activeProtocolSpec.label}» کپی شد.`);
  };

  const chipTabs: Array<{
    id: TreatmentChipTab;
    label: string;
    badge?: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'roadmap',
      label: 'میز کار و طرح درمان',
      badge: toPersianDigits(roadmap.allItems.length),
      icon: <Layers className="w-3.5 h-3.5" />
    },
    {
      id: 'clinical3d',
      label: 'نمای سه‌بعدی پروتز و ایمپلنت (3D)',
      badge: toPersianDigits((activePatient?.labOrders?.length || 0) + (activePatient?.implantCases?.length || 0)),
      icon: <Box className="w-3.5 h-3.5" />
    },
    {
      id: 'cdss',
      label: 'هوش بالینی و ایمنی (CDSS)',
      badge: toPersianDigits(roadmap.sequencingAlerts.length + cdssSafety.systemicAlerts.length),
      icon: <ShieldCheck className="w-3.5 h-3.5" />
    },
    {
      id: 'queue',
      label: 'صف درمان کلینیک',
      badge: toPersianDigits(clinicMetrics.activeCount),
      icon: <Activity className="w-3.5 h-3.5" />
    },
    {
      id: 'protocols',
      label: 'پروتکل‌ها و متریال',
      badge: toPersianDigits(Object.keys(TREATMENT_LABELS_FA).length),
      icon: <Microscope className="w-3.5 h-3.5" />
    }
  ];

  const renderArchQuadrant = (
    quadrant: 'UR' | 'UL' | 'LR' | 'LL',
    teethOrder: number[],
    title: string
  ) => (
    <div className="bg-slate-50/85 rounded-2xl p-2 border border-slate-200/80 min-w-0">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] font-black text-slate-600">{title}</span>
        <span className="text-[9.5px] font-mono font-black text-teal-700">{quadrant}</span>
      </div>
      <div className="grid grid-cols-8 gap-1" dir="ltr">
        {teethOrder.map((num) => {
          const { key, cond } = resolveConditionForTooth(activePatient?.teethConditions, quadrant, num);
          const hasAlert = roadmap.sequencingAlerts.some((al) => al.toothKey === key);
          const stClass = cond
            ? STATUS_BADGE_MAP[cond.status].toothClass
            : 'bg-white border-slate-200/90 text-slate-600 hover:bg-teal-50 hover:border-teal-300';

          return (
            <button
              key={`${quadrant}-${num}`}
              type="button"
              onClick={() => {
                impactLight();
                onOpenPalmerChart(activePatient || undefined, { quadrant, toothNumber: num });
              }}
              title={
                cond
                  ? `${quadrant}${num}: ${TREATMENT_LABELS_FA[cond.treatment] || cond.treatment}`
                  : `ثبت درمان برای دندان ${quadrant}${num}`
              }
              className={`relative min-h-[42px] rounded-xl border text-center transition-all cursor-pointer active:scale-95 flex flex-col items-center justify-center p-0.5 ${stClass}`}
            >
              {hasAlert && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
              <span className="font-mono font-black text-[11px] leading-none">
                {toPersianDigits(num)}
              </span>
              {cond && (
                <span className="text-[7.5px] font-black truncate max-w-full mt-0.5 leading-none opacity-90">
                  {TREATMENT_SHORT_LABELS[cond.treatment] || '●'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      dir="rtl"
      className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-2.5 select-none"
    >
      {/* Inline Action Feedback Banner */}
      {toastMessage && (
        <div
          role="status"
          className="mx-1 rounded-2xl bg-teal-600 text-white px-3.5 py-2.5 text-xs font-bold flex items-center justify-between gap-2 shadow-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-white/20 cursor-pointer shrink-0"
            aria-label="بستن اعلان"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* UNIFIED COMMAND HEADER CARD */}
      <div className={getModuleHeaderCardClasses('teal')}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Stethoscope className="w-4 h-4" />
            </div>
            <h2 className="text-slate-900 truncate font-black text-sm">مرکز فوق‌هوشمند درمان و طرح درمان</h2>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto min-w-0">
            {patients.length > 0 && (
              <div className="flex items-center gap-1 bg-white/95 border border-teal-200 rounded-xl px-2 py-1 min-w-0 flex-1 sm:flex-initial">
                <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <select
                  aria-label="انتخاب بیمار برای مدیریت درمان"
                  value={activePatient?.id || ''}
                  onChange={(e) => {
                    selection();
                    setInternalPatientId(e.target.value);
                    onSelectPatientId?.(e.target.value);
                  }}
                  className="w-full min-w-0 bg-transparent text-xs font-black text-slate-900 focus:outline-none sm:max-w-[165px] truncate cursor-pointer"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({toPersianDigits(p.fileNumber)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                selection();
                setSearchOpen((prev) => !prev);
              }}
              aria-label="جستجو در درمان‌ها"
              className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                searchOpen
                  ? 'bg-teal-600 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-teal-200 hover:bg-teal-50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Animated Collapsible Fuzzy Search Box */}
        {searchOpen && (
          <div className="pt-1 animate-in fade-in duration-150">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-teal-600 absolute right-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="جستجو در صف درمان و طرح‌های درمانی"
                placeholder="جستجوی بیمار، دندان (UR6)، پزشک یا درمان..."
                className="w-full pr-9 pl-8 py-2 rounded-xl bg-white border border-teal-200 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="پاک کردن جستجو"
                  className="absolute left-2.5 p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* COMPACT 4-COLUMN KPI PILLS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <div className="bg-white/95 rounded-xl px-2.5 py-1.5 border border-teal-100 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-bold text-slate-500 block">فعال کلینیک</span>
              <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-teal-900">
                {toPersianDigits(clinicMetrics.activeCount)}
              </span>
            </div>
            <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          </div>

          <div className="bg-white/95 rounded-xl px-2.5 py-1.5 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-bold text-slate-500 block">تکمیل‌شده</span>
              <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-emerald-800">
                {toPersianDigits(clinicMetrics.completedCount)}
              </span>
            </div>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          </div>

          <div className="bg-white/95 rounded-xl px-2.5 py-1.5 border border-amber-100 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-bold text-slate-500 block">طرح درمان بیمار</span>
              <span className="text-xs font-black font-mono tabular-nums text-amber-900">
                {formatToman(roadmap.totalPlannedCost)}
              </span>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>

          <div className="bg-white/95 rounded-xl px-2.5 py-1.5 border border-rose-100 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-bold text-slate-500 block">هشدار CDSS</span>
              <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-rose-700">
                {toPersianDigits(clinicMetrics.totalAlerts)}
              </span>
            </div>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          </div>
        </div>

        {/* HORIZONTAL MULTI-COLOR CHIP BAR + PINNED + PALMER CTA */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div
            role="tablist"
            aria-label="بخش‌های مرکز درمان"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1"
          >
            {chipTabs.map((tab, idx) => {
              const isActive = activeChip === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    selection();
                    setActiveChip(tab.id);
                  }}
                  className={getUnifiedChipClasses(idx, isActive)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={getUnifiedChipBadgeClasses(idx, isActive)}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              impactLight();
              onOpenPalmerChart(activePatient || undefined);
            }}
            className="min-h-[36px] px-3 py-1.5 rounded-[12px] bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-xs shrink-0 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ چارت پالمر</span>
          </button>
        </div>
      </div>

      {/* TAB 1: WORKSPACE & 4-PHASE ADA TREATMENT ROADMAP */}
      {activeChip === 'roadmap' && (
        <div className="space-y-2.5">
          {/* Interactive 32-Tooth Palmer Quick Launch Map */}
          <div className="bg-white rounded-[20px] p-3 border border-teal-200/80 shadow-[var(--shadow-card)] space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-slate-900">
                  چارت ۳۲ دندانی پالمر
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                  {toPersianDigits(roadmap.completionPercent)}٪ تکمیل · {toPersianDigits(roadmap.estimatedVisits)} جلسه
                </span>
                <div className="hidden sm:flex items-center gap-2 text-[9.5px] font-bold text-slate-500 mr-1">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />طرح</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />اجرا</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />تکمیل</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />CDSS</span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyTreatmentPlan}
                  className="px-2 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-teal-600" />
                  <span>کپی</span>
                </button>
                {activePatient && (
                  <button
                    type="button"
                    onClick={() => onOpenPatientFile(activePatient, 'treatments')}
                    className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3 h-3 text-sky-600" />
                    <span>پرونده بیمار</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {renderArchQuadrant('UR', [8, 7, 6, 5, 4, 3, 2, 1], 'بالا راست')}
              {renderArchQuadrant('UL', [1, 2, 3, 4, 5, 6, 7, 8], 'بالا چپ')}
              {renderArchQuadrant('LR', [8, 7, 6, 5, 4, 3, 2, 1], 'پایین راست')}
              {renderArchQuadrant('LL', [1, 2, 3, 4, 5, 6, 7, 8], 'پایین چپ')}
            </div>
          </div>

          {/* Clinical Sequencing & Safety Alerts */}
          {roadmap.sequencingAlerts.length > 0 && (
            <div className="bg-white rounded-[20px] p-3 border border-rose-200 shadow-[var(--shadow-card)] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-black text-rose-950">
                    هشدار توالی درمان ({toPersianDigits(roadmap.sequencingAlerts.length)})
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {roadmap.sequencingAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-2xl px-3 py-2 border text-xs flex items-center justify-between gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                        : alert.severity === 'warning'
                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                        : 'bg-sky-50/90 border-sky-200 text-sky-950'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-black text-[11.5px] block truncate">{alert.title}</span>
                      <span className="text-[10px] font-bold opacity-85 block truncate">{alert.actionHint}</span>
                    </div>
                    {alert.toothKey && activePatient && (
                      <button
                        type="button"
                        onClick={() => {
                          const match = alert.toothKey?.match(/^(UR|UL|LL|LR)[_-]?(\d)$/i);
                          if (match) {
                            onOpenPalmerChart(activePatient, {
                              quadrant: match[1].toUpperCase() as 'UR' | 'UL' | 'LL' | 'LR',
                              toothNumber: Number(match[2])
                            });
                          } else {
                            onOpenPalmerChart(activePatient);
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white border border-current/20 text-[10px] font-black shrink-0 cursor-pointer hover:bg-slate-50"
                      >
                        اصلاح در پالمر
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* D3.js 4-Phase ADA Cost & Chair-Time Breakdown */}
          <div
            data-testid="treatments-d3-phases-panel"
            className="bg-white rounded-[20px] p-3 border border-teal-200/80 shadow-[var(--shadow-card)] space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-black text-slate-900">
                  تراز هزینه و زمان صندلی ۴ فاز طرح درمان (D3.js · میلیون تومان)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 tabular-nums">
                مجموع: {formatToman(roadmap.totalPlannedCost)} · {toPersianDigits(roadmap.totalChairMinutes)} دقیقه
              </span>
            </div>

            <svg
              data-testid="treatments-d3-phases-svg"
              viewBox={`0 0 ${d3PhaseBreakdown.width} ${d3PhaseBreakdown.height}`}
              className="w-full h-[110px] overflow-visible select-none"
              role="img"
              aria-label="نمودار ۴ فاز طرح درمان بر اساس هزینه و تعداد دندان"
            >
              <line
                x1={d3PhaseBreakdown.margin.left}
                x2={d3PhaseBreakdown.width - d3PhaseBreakdown.margin.right}
                y1={d3PhaseBreakdown.baselineY}
                y2={d3PhaseBreakdown.baselineY}
                stroke="#cbd5e1"
                strokeWidth={1.2}
              />
              {d3PhaseBreakdown.bars.map(bar => (
                <g
                  key={bar.phaseId}
                  onClick={() => {
                    impactLight();
                    onOpenPalmerChart(activePatient || undefined);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={bar.x}
                    y={bar.y}
                    width={bar.barW}
                    height={bar.h}
                    rx={6}
                    fill={bar.color}
                    opacity={bar.itemsCount > 0 ? 0.9 : 0.35}
                  />
                  <text
                    x={bar.x + bar.barW / 2}
                    y={Math.max(10, bar.y - 3)}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={900}
                    fill="#0f172a"
                  >
                    {toPersianDigits(bar.costMillion)}م ({toPersianDigits(bar.itemsCount)})
                  </text>
                  <text
                    x={bar.x + bar.barW / 2}
                    y={d3PhaseBreakdown.height - 6}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={800}
                    fill="#334155"
                  >
                    {bar.shortTitle}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* 4-Phase Treatment Roadmap (Active phases expanded cleanly, empty phases minimal strip) */}
          <div className="space-y-2">
            {roadmap.phases.map((phase) => {
              const borderStyle =
                phase.badgeColor === 'rose'
                  ? 'border-r-rose-500 border-rose-200/80'
                  : phase.badgeColor === 'amber'
                  ? 'border-r-amber-500 border-amber-200/80'
                  : phase.badgeColor === 'teal'
                  ? 'border-r-teal-500 border-teal-200/80'
                  : 'border-r-sky-500 border-sky-200/80';

              if (phase.items.length === 0) {
                return (
                  <div
                    key={phase.phaseId}
                    className="bg-white/80 rounded-2xl px-3 py-2 border border-slate-200/80 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="font-black text-slate-600 truncate">{phase.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-slate-400">۰</span>
                      <button
                        type="button"
                        onClick={() => onOpenPalmerChart(activePatient || undefined)}
                        className="px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-black text-[10px] cursor-pointer"
                      >
                        + افزودن
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={phase.phaseId}
                  className={`bg-white rounded-[20px] p-3 border border-r-[3px] ${borderStyle} shadow-[var(--shadow-card)] space-y-2`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black text-slate-900">{phase.title}</h3>
                    <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-black tabular-nums">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                        {toPersianDigits(phase.items.length)} دندان · {toPersianDigits(phase.totalMinutes)}د
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {formatToman(phase.totalCost)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {phase.items.map((item) => {
                      const stInfo = STATUS_BADGE_MAP[item.status];
                      const needsLab =
                        item.treatment === 'crown_zirconia' ||
                        item.treatment === 'crown_pfm' ||
                        item.treatment === 'laminate';

                      return (
                        <div
                          key={item.toothKey}
                          className="rounded-2xl bg-slate-50/75 border border-slate-200/90 p-2.5 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-white border border-slate-300 text-slate-900">
                                  {item.quadrant}{toPersianDigits(item.toothNumber)}
                                </span>
                                <span className="text-xs font-black text-slate-900 truncate">
                                  {item.treatmentLabel}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                                {item.doctorName} · {toPersianDigits(item.chairMinutes)} دقیقه
                              </span>
                            </div>
                            <div className="text-left shrink-0">
                              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border block text-center ${stInfo.badgeClass}`}>
                                {stInfo.label}
                              </span>
                              <span className="text-[11px] font-mono font-black text-emerald-800 block mt-1 tabular-nums">
                                {formatToman(item.cost)}
                              </span>
                            </div>
                          </div>

                          {item.notes && (
                            <p className="text-[10px] font-medium text-slate-600 bg-white rounded-xl px-2 py-1 border border-slate-100 truncate">
                              {item.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-1.5 flex-wrap pt-0.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {activePatient && onUpdateTreatmentStatus && item.status !== 'in_progress' && item.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    selection();
                                    onUpdateTreatmentStatus(activePatient.id, item.toothKey, 'in_progress');
                                    showToast(`درمان دندان ${item.quadrant}${item.toothNumber} وارد فاز اجرا شد.`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>شروع</span>
                                </button>
                              )}
                              {activePatient && onUpdateTreatmentStatus && item.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    success();
                                    onUpdateTreatmentStatus(activePatient.id, item.toothKey, 'completed');
                                    showToast(`درمان دندان ${item.quadrant}${item.toothNumber} تکمیل شد.`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>تکمیل</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 flex-wrap">
                              {activePatient && needsLab && onLaunchLabFromTreatment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onLaunchLabFromTreatment({
                                      patientId: activePatient.id,
                                      toothNumber: `${item.quadrant}${item.toothNumber}`,
                                      workType: item.treatmentLabel
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <FlaskConical className="w-3 h-3" />
                                  <span>لابراتوار</span>
                                </button>
                              )}
                              {activePatient && onScheduleAppointment && (
                                <button
                                  type="button"
                                  onClick={() => onScheduleAppointment(activePatient, item.treatmentLabel)}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>نوبت</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  selection();
                                  setActiveChip('clinical3d');
                                }}
                                className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                                title="بازرسی سه‌بعدی اسکن روکش و فیکسچر ایمپلنت"
                              >
                                <Box className="w-3 h-3 text-purple-700" />
                                <span>3D</span>
                              </button>
                              {activePatient && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    selection();
                                    scheduleEntityReminder({
                                      sourceType: 'treatment',
                                      sourceId: `${activePatient.id}_${item.toothKey}`,
                                      patientId: activePatient.id,
                                      patientName: activePatient.fullName,
                                      patientPhone: activePatient.phone,
                                      title: `پیگیری درمان ${item.treatmentLabel} دندان ${item.quadrant}${item.toothNumber}`,
                                      description: `پزشک: ${item.doctorName} · هزینه: ${formatToman(item.cost)}`,
                                      targetDate: getCurrentPersianDate(),
                                      targetView: 'treatments',
                                      config: {
                                        enabled: true,
                                        preset: '1d_before',
                                        channels: ['phone_push', 'in_app']
                                      }
                                    });
                                    showToast(`یادآور پیگیری درمان دندان ${item.quadrant}${item.toothNumber} در مرکز یادآوری ثبت شد.`);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                                  title="ثبت یادآور هوشمند پیگیری درمان"
                                >
                                  <Bell className="w-3 h-3 text-amber-600" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenPalmerChart(activePatient || undefined, {
                                    quadrant: item.quadrant,
                                    toothNumber: item.toothNumber
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-teal-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                              >
                                <span>چارت</span>
                                <ArrowUpLeft className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1B: 3D PROSTHETIC CAD/CAM & 3D IMPLANT SURGICAL STUDIO FOR SELECTED PATIENT */}
      {activeChip === 'clinical3d' && (
        <div data-testid="treatments-3d-clinical-studio" className="space-y-3">
          <Lab3DModelViewerD3
            orders={
              activePatient?.labOrders?.length
                ? activePatient.labOrders
                : patients.flatMap((p) => p.labOrders || [])
            }
            patients={patients}
            onOpenPalmerChart={(pat) => onOpenPalmerChart(pat)}
          />
          <Implant3DSurgicalPlannerD3
            implantCases={
              activePatient?.implantCases?.length
                ? activePatient.implantCases
                : patients.flatMap((p) => p.implantCases || [])
            }
            patients={patients}
            onOpenPalmerChart={(pat) => onOpenPalmerChart(pat)}
          />
        </div>
      )}

      {/* TAB 2: CLINICAL DECISION SUPPORT SYSTEM (CDSS SIMULATOR & SAFETY) */}
      {activeChip === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* 1. Systemic & Local Anesthetic Max Dose Guard */}
          <div className="bg-white rounded-[20px] p-3.5 border border-rose-200/80 border-r-[3px] border-r-rose-500 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  سپر ایمنی سیستمیک و دوز حداکثر بی‌حسی (MRD)
                </h3>
              </div>
              <span className="text-[10.5px] font-mono font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                {cdssSafety.asaClass}
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <label htmlFor="cdss-weight-slider" className="text-slate-700">
                  وزن بیمار جهت محاسبه سقف کارپول لیدوکائین ۲٪:
                </label>
                <span className="font-mono font-black text-teal-800 bg-white px-2 py-0.5 rounded-lg border border-teal-200 tabular-nums">
                  {toPersianDigits(simWeightKg)} کیلوگرم
                </span>
              </div>
              <input
                id="cdss-weight-slider"
                type="range"
                aria-label="وزن بیمار جهت محاسبه سقف کارپول بی‌حسی"
                min={18}
                max={120}
                value={simWeightKg}
                onChange={(e) => setSimWeightKg(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white rounded-xl p-2 border border-teal-100">
                  <span className="text-[10px] font-bold text-slate-500 block">سقف مجاز کارپول</span>
                  <span className="text-base font-black font-mono text-teal-800 tabular-nums">
                    {toPersianDigits(cdssSafety.anestheticLimit.maxCarpules)} کارپول
                  </span>
                </div>
                <div className="bg-white rounded-xl p-2 border border-sky-100">
                  <span className="text-[10px] font-bold text-slate-500 block">دوز بیشینه لیدوکائین</span>
                  <span className="text-base font-black font-mono text-sky-900 tabular-nums">
                    {toPersianDigits(cdssSafety.anestheticLimit.maxLidocaineMg)} mg
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <span className="font-black text-emerald-950 block mb-0.5">بی‌حسی پیشنهادی:</span>
                <p className="text-[11px] font-bold text-emerald-900">{cdssSafety.anesthesiaChoice}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50/80 border border-sky-200">
                <span className="font-black text-sky-950 block mb-0.5">مسکن و آنتی‌بیوتیک ایمن بیمار:</span>
                <p className="text-[11px] font-bold text-sky-900">• مسکن: {cdssSafety.safeAnalgesic}</p>
                <p className="text-[11px] font-bold text-sky-900 mt-0.5">• آنتی‌بیوتیک: {cdssSafety.safeAntibiotic}</p>
              </div>
            </div>

            {cdssSafety.systemicAlerts.length > 0 && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1 text-[11px] font-bold text-rose-900">
                {cdssSafety.systemicAlerts.map((msg, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Live AAE Endodontic + AAP Perio + Ante's Law Clinical Simulator */}
          <div className="bg-white rounded-[20px] p-3.5 border border-sky-200/80 border-r-[3px] border-r-sky-500 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  موتور تشخیص افتراقی AAE اندو، پریو و قانون Ante
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                ارزیابی آنلاین صندلی
              </span>
            </div>

            {/* Pulp & Cold Test Selector */}
            <div className="bg-sky-50/60 rounded-2xl p-2.5 border border-sky-200/80 space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-black text-slate-800">پاسخ تست سرما و طرح درمان انتخابی:</span>
                <select
                  aria-label="نوع درمان کاندید در شبیه‌ساز CDSS"
                  value={simCandidateTreatment}
                  onChange={(e) => setSimCandidateTreatment(e.target.value as TreatmentType)}
                  className="bg-white border border-sky-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-900"
                >
                  {Object.entries(TREATMENT_LABELS_FA).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {(['نرمال', 'پالپیت برگشت‌پذیر', 'پالپیت غیرقابل‌برگشت', 'نکروز (بدون پاسخ)'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSimColdTest(c)}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black cursor-pointer border transition-all ${
                      simColdTest === c
                        ? 'bg-sky-600 text-white border-sky-700'
                        : 'bg-white text-slate-700 border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimPercussion(simPercussion === 'منفی (-)' ? 'مثبت (+)' : 'منفی (-)')}
                  className={`py-1.5 px-2 rounded-xl text-[10.5px] font-black border cursor-pointer ${
                    simPercussion === 'مثبت (+)'
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'bg-white text-emerald-800 border-emerald-200'
                  }`}
                >
                  تست دق (Percussion): {simPercussion}
                </button>
                <button
                  type="button"
                  onClick={() => setSimPalpation(simPalpation === 'منفی (-)' ? 'مثبت (+)' : 'منفی (-)')}
                  className={`py-1.5 px-2 rounded-xl text-[10.5px] font-black border cursor-pointer ${
                    simPalpation === 'مثبت (+)'
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'bg-white text-emerald-800 border-emerald-200'
                  }`}
                >
                  لمس اپیکال: {simPalpation}
                </button>
              </div>

              <div
                className={`p-2 rounded-xl border ${
                  cdssEndo.clinicalWarning
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-white border-sky-200 text-slate-800'
                }`}
              >
                <span className="font-black block text-xs">تشخیص AAE: {cdssEndo.aaeDiagnosis}</span>
                <span className="text-[10.5px] font-bold block text-slate-600 mt-0.5">{cdssEndo.apicalDiagnosis}</span>
                <p className="text-[10.5px] font-bold mt-1">{cdssEndo.recommendedProtocol}</p>
                {cdssEndo.clinicalWarning && (
                  <p className="text-[10.5px] font-black text-rose-700 mt-1">{cdssEndo.clinicalWarning}</p>
                )}
              </div>
            </div>

            {/* AAP Perio + Ante's Law Quick Evaluator */}
            <div className="bg-amber-50/60 rounded-2xl p-2.5 border border-amber-200/80 space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-black text-slate-900">ریسک پریو-پروتز (پاکت پروبینگ) و قانون Ante:</span>
                <span className="font-mono font-black text-amber-900">
                  {cdssPerio.stageLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white rounded-xl p-1.5 border border-amber-200 text-center">
                  <span className="text-[9.5px] font-bold text-slate-500 block">عمق پاکت (mm)</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setSimPocketDepth((d) => Math.max(1, d - 1))}
                      className="w-5 h-5 rounded bg-slate-100 font-black cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-xs px-1">{toPersianDigits(simPocketDepth)}</span>
                    <button
                      type="button"
                      onClick={() => setSimPocketDepth((d) => Math.min(10, d + 1))}
                      className="w-5 h-5 rounded bg-slate-100 font-black cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-1.5 border border-amber-200 text-center">
                  <span className="text-[9.5px] font-bold text-slate-500 block">لقی (Mobility)</span>
                  <select
                    aria-label="درجه لقی دندان"
                    value={simMobility}
                    onChange={(e) => setSimMobility(e.target.value as '0' | 'I' | 'II' | 'III')}
                    className="w-full text-center font-mono font-black text-xs bg-transparent mt-0.5 focus:outline-none"
                  >
                    <option value="0">نرمال</option>
                    <option value="I">Grade I</option>
                    <option value="II">Grade II</option>
                    <option value="III">Grade III</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setSimBop((b) => !b)}
                  className={`rounded-xl p-1.5 border text-[10px] font-black cursor-pointer ${
                    simBop ? 'bg-rose-600 text-white border-rose-700' : 'bg-white text-emerald-800 border-emerald-200'
                  }`}
                >
                  {simBop ? 'BOP: مثبت (+)' : 'BOP: منفی (-)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full min-w-0">
                <label className="bg-white rounded-xl p-1.5 border border-amber-200 flex items-center justify-between gap-2 text-[10px] font-bold min-w-0">
                  <span className="truncate">مساحت ریشه پایه (mm²):</span>
                  <input
                    type="number"
                    size={5}
                    aria-label="مساحت ریشه پایه بر حسب میلی‌متر مربع"
                    min={100}
                    max={1500}
                    value={simAbutmentArea}
                    onChange={(e) => setSimAbutmentArea(Number(e.target.value) || 0)}
                    className="w-16 shrink-0 text-center font-mono font-black border border-slate-200 rounded px-1 py-0.5"
                    dir="ltr"
                  />
                </label>
                <label className="bg-white rounded-xl p-1.5 border border-amber-200 flex items-center justify-between gap-2 text-[10px] font-bold min-w-0">
                  <span className="truncate">مساحت پونتیک (mm²):</span>
                  <input
                    type="number"
                    size={5}
                    aria-label="مساحت پونتیک بر حسب میلی‌متر مربع"
                    min={0}
                    max={1500}
                    value={simPonticArea}
                    onChange={(e) => setSimPonticArea(Number(e.target.value) || 0)}
                    className="w-16 shrink-0 text-center font-mono font-black border border-slate-200 rounded px-1 py-0.5"
                    dir="ltr"
                  />
                </label>
              </div>

              <p
                className={`text-[10.5px] font-bold p-2 rounded-xl border ${
                  antesEval.passed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {antesEval.message}
              </p>
              {cdssPerio.prostheticWarning && (
                <p className="text-[10.5px] font-black text-rose-700">{cdssPerio.prostheticWarning}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLINIC-WIDE ACTIVE TREATMENT QUEUE */}
      {activeChip === 'queue' && (
        <div className="bg-white rounded-[20px] p-3.5 border border-teal-200/80 shadow-[var(--shadow-card)] space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              صف تریاژ درمان کل بیماران مطب ({toPersianDigits(filteredQueue.length)} مورد)
            </h3>

            <div className="flex items-center gap-1 flex-wrap">
              {([
                { id: 'all', label: 'همه' },
                { id: 'alerts', label: 'اولویت اورژانس / CDSS' },
                { id: 'in_progress', label: 'در حال اجرا' },
                { id: 'planned', label: 'طرح درمان' },
                { id: 'completed', label: 'تکمیل‌شده' }
              ] as const).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setQueueFilter(f.id);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                    queueFilter === f.id
                      ? 'bg-teal-600 text-white border-teal-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-500">
              موردی با فیلتر یا جستجوی فعلی یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredQueue.map((item) => {
                const ownerPatient = patients.find((p) => p.id === item.patientId);
                const priorityStyle =
                  item.priorityLevel === 'urgent_pain' || item.priorityLevel === 'sequencing_block'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : item.priorityLevel === 'in_progress'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : item.priorityLevel === 'completed'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200';

                return (
                  <div
                    key={`${item.patientId}-${item.toothKey}`}
                    className="rounded-2xl bg-slate-50/70 border border-slate-200 p-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 truncate">{item.patientName}</span>
                          <span className="font-mono font-black text-[10.5px] px-1.5 py-0.5 rounded-md bg-white border border-slate-300">
                            {item.quadrant}
                            {toPersianDigits(item.toothNumber)}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-teal-800 block mt-0.5">
                          {item.treatmentLabel} · {item.doctorName}
                        </span>
                      </div>
                      <div className="text-left shrink-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border block ${priorityStyle}`}>
                          {item.priorityLabel}
                        </span>
                        <span className="text-[11px] font-mono font-black text-emerald-800 block mt-1 tabular-nums">
                          {formatToman(item.cost)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>~{toPersianDigits(item.chairMinutes)} دقیقه صندلی</span>
                      </span>

                      <div className="flex items-center gap-1 flex-wrap">
                        {onUpdateTreatmentStatus && item.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              success();
                              onUpdateTreatmentStatus(item.patientId, item.toothKey, 'completed');
                              showToast(`درمان دندان ${item.quadrant}${item.toothNumber} برای ${item.patientName} تکمیل شد.`);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>تکمیل</span>
                          </button>
                        )}
                        {ownerPatient && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPalmerChart(ownerPatient, {
                                quadrant: item.quadrant,
                                toothNumber: item.toothNumber
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-teal-200 text-[10.5px] font-black cursor-pointer"
                          >
                            باز کردن در چارت پالمر
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EVIDENCE-BASED CLINICAL PROTOCOLS & BIOMATERIALS */}
      {activeChip === 'protocols' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
          <div className="bg-white rounded-[20px] p-3 border border-teal-200/80 shadow-[var(--shadow-card)] space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 px-1 mb-2">
              انتخاب پروتکل استاندارد درمان (۱۶ پروسیجر)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1 max-h-[420px] overflow-y-auto">
              {(Object.keys(TREATMENT_LABELS_FA) as TreatmentType[]).map((tKey) => {
                const isSelected = selectedProtocolType === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => {
                      selection();
                      setSelectedProtocolType(tKey);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-right text-[11px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-teal-50'
                    }`}
                  >
                    {TREATMENT_LABELS_FA[tKey]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-[20px] p-4 border border-sky-200/80 border-r-[3px] border-r-teal-600 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-black text-slate-900">{activeProtocolSpec.label}</h3>
                <span className="text-[11px] font-bold text-teal-800">
                  ایزولاسیون: {activeProtocolSpec.isolationRequired} · ریکال بعدی: {toPersianDigits(activeProtocolSpec.recommendedRecallMonths)} ماهه
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyProtocolChecklist}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>کپی پروتکل بالینی</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-teal-50/70 rounded-xl p-2.5 border border-teal-200">
                <span className="text-[10px] font-bold text-slate-500 block">زمان صندلی استاندارد</span>
                <span className="font-mono font-black text-teal-900">
                  {toPersianDigits(activeProtocolSpec.chairMinutes)} دقیقه ({toPersianDigits(activeProtocolSpec.recommendedSessions)} جلسه)
                </span>
              </div>
              <div className="bg-sky-50/70 rounded-xl p-2.5 border border-sky-200">
                <span className="text-[10px] font-bold text-slate-500 block">فالوآپ اولیه پس از درمان</span>
                <span className="font-mono font-black text-sky-900">
                  {toPersianDigits(activeProtocolSpec.followUpDays)} روز بعد
                </span>
              </div>
              <div className="bg-amber-50/70 rounded-xl p-2.5 border border-amber-200">
                <span className="text-[10px] font-bold text-slate-500 block">الزامات استریل و فیلد</span>
                <span className="font-black text-amber-950">{activeProtocolSpec.isolationRequired}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-black text-slate-900 block mb-0.5">پروتکل بی‌حسی موضعی:</span>
                <p className="text-slate-700 font-bold leading-relaxed">{activeProtocolSpec.anesthesiaProtocol}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-black text-slate-900 block mb-0.5">بیومتریال و تجهیزات استاندارد:</span>
                <p className="text-slate-700 font-bold leading-relaxed">{activeProtocolSpec.biomaterialSpec}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                <span className="font-black text-emerald-950 block">چک‌لیست مرحله‌به‌مرحله بالینی صندلی:</span>
                {activeProtocolSpec.chairsideChecklist.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11.5px] font-bold text-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-mono font-black flex items-center justify-center shrink-0 mt-0.5">
                      {toPersianDigits(i + 1)}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
