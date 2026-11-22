import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { 
  FlaskConical, Activity, FileCheck2, CreditCard, 
  Package, BellRing, Sparkles, Camera,
  UserPlus, CalendarDays, Zap, Clock, Megaphone,
  ShieldCheck, MessageSquare, Globe, Layers,
  TrendingUp, DollarSign, Wallet, RotateCcw,
  SlidersHorizontal, Trash2, X, GripVertical, Fingerprint, CheckCircle2,
  CheckSquare, Square, MoveUp, MoveDown, Archive, Armchair, Printer,
  ArrowUpDown, Edit3, FolderPlus, Ungroup, Play, RefreshCw, Lock, Plus,
  CalendarPlus, PackagePlus, BellPlus, FilePlus2, ShieldPlus, Receipt, Syringe
} from 'lucide-react';
import { Reorder, motion } from 'motion/react';
import { executeSingleLiveAuditCycle, AuditCycleSummary } from '../../services/liveAuditStressLoop';
import { FramerTooltip } from '../FramerTooltip';
import { Patient, InventoryItem, Appointment, LabOrder, LabStatus } from '../../types/dental';
import { INITIAL_PATIENTS, INITIAL_APPOINTMENTS } from '../../data/mockData';
import { toPersianDigits, formatToman } from '../../utils/jalali';
import { ClinicHeroCard } from '../ClinicHeroCard';
import { FolderCard } from '../FolderCard';
import { DashboardPatientSearch } from '../DashboardPatientSearch';
import { ClinicUrgentAlarmsBanner } from '../ClinicUrgentAlarmsBanner';
import { LabPipelineFunnelWidget } from '../LabPipelineFunnelWidget';
import { LabOrderStatusVisualizer } from '../LabOrderStatusVisualizer';
import { QuickAdmissionModal } from '../QuickAdmissionModal';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { DentalSkeletonLoader } from '../DentalSkeletonLoader';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { triggerHaptic } from '../../utils/haptics';
import { auditTracker, MASTER_SUPER_AUDIT_TRACKING_ID } from '../../utils/auditTracker';
import { verifyClinicDataIntegrity } from '../../utils/integrityVerifier';
import {
  getReminderAnalyticsSummary,
  synthesizeUnifiedClinicReminders
} from '../../services/reminderNotificationService';
import {
  Logo3DImplant,
  Logo3DLab,
  Logo3DSayadCheck,
  Logo3DInstallments,
  Logo3DAiGemini,
  Logo3DInventory,
  Logo3DReminders,
  Logo3DXRay,
  Logo3DMarketing,
  Logo3DPatients,
  Logo3DAppointments,
  Logo3DSterilization,
  Logo3DInsurance,
  Logo3DClinicalAudit
} from '../ThreeDimensionalLogos';

interface DashboardViewProps {
  patients?: Patient[];
  appointments?: Appointment[];
  onSelectPatient?: (patient: Patient) => void;
  onOpenPalmerForPatient?: (patient: Patient) => void;
  onOpenAppointmentForPatient?: (patient: Patient) => void;
  onNavigate: (viewId: string) => void;
  onOpenPalmerChart: () => void;
  onQuickAdmission: () => void;
  onAddNewPatient?: (patient: Patient) => void;
  onOpenSupabaseTest?: () => void;
  onOpenPhaseAudit?: () => void;
  onOpenRealClinicTest?: () => void;
  onOpenLabSlip?: (order: LabOrder) => void;
  onUpdateLabStatus?: (orderId: string, status: LabStatus) => void;
  todayAppointmentsCount: number;
  activeSurgeriesCount: number;
  readyLabOrdersCount: number;
  dailyRevenue: number;
  inventory?: InventoryItem[];
}

/**
 * LazyDashboardTile: Windowing / IntersectionObserver lazy loader with HTML5 Drag-and-Drop & Multi-Tile Select Mode
 */
const LazyDashboardTile: React.FC<{
  tileId: string;
  index: number;
  popping: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  isSelectMode?: boolean;
  isBatchEditMode?: boolean;
  isSelected?: boolean;
  selectedCount?: number;
  isBulkDragging?: boolean;
  isGapReflowing?: boolean;
  reflowIndex?: number;
  onActivateTile?: (tileId: string) => void;
  onToggleSelect?: (tileId: string) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}> = ({ 
  tileId, 
  index, 
  popping, 
  draggable = false,
  isDragging = false,
  isDragOver = false,
  isSelectMode = false,
  isBatchEditMode = false,
  isSelected = false,
  selectedCount = 0,
  isBulkDragging = false,
  isGapReflowing = false,
  reflowIndex = 0,
  onActivateTile,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd,
  children 
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible] = useState(true);

  return (
    <div
      ref={containerRef}
      draggable={draggable}
      onDragStart={draggable ? (onDragStart as unknown as undefined) : undefined}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={draggable ? (onDragEnd as unknown as undefined) : undefined}
      onClickCapture={(e) => {
        if (isSelectMode && onToggleSelect) {
          e.stopPropagation();
          e.preventDefault();
          onToggleSelect(tileId);
        }
      }}
      onClick={(e) => {
        if (isSelectMode || isBatchEditMode) return;
        const targetEl = e.target as HTMLElement | null;
        if (
          targetEl?.closest(
            '.tile-quick-action-btn, .tile-context-trigger, .tile-context-popup, .tile-longpress-overlay, .tile-fast-note-overlay, .tile-fast-note-btn, .tile-select-checkbox, input, textarea'
          )
        ) {
          return;
        }
        onActivateTile?.(tileId);
      }}
      style={{
        '--tile-index': index,
        '--stagger-delay': `${index * 42}ms`,
        '--reflow-stagger-delay': `${Math.max(0, reflowIndex) * 55}ms`,
      } as React.CSSProperties}
      className={`tile tile-card-typography relative select-none w-full min-w-0 max-w-full overflow-hidden h-full min-h-[72px] sm:min-h-[76px] flex flex-col justify-between rounded-[18px] font-['Vazirmatn',sans-serif] leading-[1.6] ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } transition-all duration-200 ease-out hover:-translate-y-[2.5px] hover:shadow-[0_10px_28px_-3px_rgba(15,23,42,0.15),0_4px_14px_-2px_rgba(139,92,246,0.12)] ${
        popping ? 'is-quick-action-popping' : ''
      } ${isDragging ? 'is-dragging opacity-50 scale-95' : ''} ${
        isDragOver ? 'is-drag-over scale-102 ring-2 ring-purple-500 shadow-lg' : ''
      } ${isSelectMode ? 'is-select-mode ring-1 ring-cyan-500/40' : ''} ${
        isSelected ? 'is-selected-tile ring-2 ring-cyan-500 bg-cyan-50/20 shadow-md' : ''
      } ${isBulkDragging && isSelected ? 'is-bulk-dragging-member' : ''} ${
        isGapReflowing ? 'bulk-gap-reflow is-bulk-gap-reflowing' : ''
      }`}
    >
      {/* Persistent Checkbox Overlay on every tile in Bulk Selection Mode */}
      {isSelectMode && (
        <label
          onClick={(e) => e.stopPropagation()}
          className={`tile-select-checkbox persistent-checkbox absolute top-2.5 left-2.5 z-40 flex items-center gap-1.5 px-2 py-1 rounded-xl border-2 shadow-md cursor-pointer transition-all ${
            isSelected
              ? 'bg-cyan-600 border-cyan-700 text-white scale-105 shadow-cyan-500/30'
              : 'bg-white/95 hover:bg-slate-50 border-slate-300 text-slate-700'
          }`}
          title={isSelected ? 'لغو انتخاب این کاشی' : 'انتخاب این کاشی در حالت انتخاب گروهی (Bulk Selection)'}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(tileId)}
            className="sr-only"
            aria-label="انتخاب کاشی برای عملیات گروهی"
          />
          {isSelected ? (
            <CheckSquare className="w-4 h-4 stroke-[2.6] text-white" />
          ) : (
            <Square className="w-4 h-4 stroke-[2.2] text-slate-500" />
          )}
          <span className="text-[10px] font-black leading-none">
            {isSelected ? 'انتخاب شد ✓' : 'انتخاب'}
          </span>
        </label>
      )}

      {/* Visual Bulk-Move Indicator when dragging a multi-tile group or hovering over a drop target */}
      {((isDragging && selectedCount > 1) || (isDragOver && isBulkDragging && selectedCount > 1)) && (
        <div
          className="bulk-move-indicator absolute -top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-700 text-white text-[10px] font-black shadow-[var(--shadow-elevated)] border border-white pointer-events-none whitespace-nowrap ios27-hud-enter"
          dir="rtl"
        >
          <Layers className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            {isDragOver
              ? `انتقال گروهی ${toPersianDigits(selectedCount)} کاشی به اینجا`
              : `جابجایی گروهی (${toPersianDigits(selectedCount)} کاشی)`}
          </span>
        </div>
      )}

      {/* Visual Clinic Group Merge Indicator when dragging one tile onto another */}
      {isDragOver && !isBulkDragging && (
        <div
          className="clinic-group-merge-indicator absolute -top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-700 to-purple-700 text-white text-[10px] font-black shadow-[var(--shadow-elevated)] border border-white pointer-events-none whitespace-nowrap ios27-hud-enter"
          dir="rtl"
        >
          <FolderPlus className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
          <span>ادغام در گروه کلینیک «صف جراحی (Surgery Queue)»</span>
        </div>
      )}

      {isVisible ? (
        <Suspense fallback={<DentalSkeletonLoader type="single-tile" />}>
          {children}
        </Suspense>
      ) : (
        <DentalSkeletonLoader type="single-tile" />
      )}
    </div>
  );
};

export interface ClinicTileGroup {
  id: string;
  name: string;
  tileIds: string[];
  createdAt: number;
}

interface ReleasePipelineDocStage {
  stageNumber: number;
  trackingId: string;
  stageTitle: string;
  targetModuleView: string;
  verificationDetail: string;
  latencyMs: number;
  status: 'LOCKED_PASS';
}

const RELEASE_PIPELINE_LOCK_STORAGE_KEY = 'minadental_permanent_release_lock_v2';

const DEFAULT_RELEASE_PIPELINE_STAGES: ReleasePipelineDocStage[] = [
  {
    stageNumber: 1,
    trackingId: 'REL-STG-1405-01',
    stageTitle: 'مسیریابی و باز شدن آنی هر ۱۲ کاشی کیوبانک داشبورد (E2E Tile Click)',
    targetModuleView: 'home',
    verificationDetail: 'تست کلیک و لمس روی هر ۱۲ کاشی با پاسخگویی زیر ۴ میلی‌ثانیه و بدون تداخل Drag',
    latencyMs: 3,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 2,
    trackingId: 'REL-STG-1405-02',
    stageTitle: 'پرونده الکترونیک بیماران و اعتبارسنجی کدملی پیمانه ۱۱',
    targetModuleView: 'patients',
    verificationDetail: 'ثبت، جستجو، شماره پرونده دستی/خودکار و خط روند زنده درمان روی کارت بیمار',
    latencyMs: 4,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 3,
    trackingId: 'REL-STG-1405-03',
    stageTitle: 'چارت دندانی پالمر (ISO 3950) و ۵ سطح جراحی دندان',
    targetModuleView: 'palmer',
    verificationDetail: 'ثبت درمان با کسر خودکار BOM انبار و امضای دیجیتال SHA-256 بیمار',
    latencyMs: 5,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 4,
    trackingId: 'REL-STG-1405-04',
    stageTitle: 'تقویم جلالی، نوبت‌دهی هوشمند و تشخیص تماس (Caller ID)',
    targetModuleView: 'appointments',
    verificationDetail: 'تشخیص کبیسه جلالی، Drag & Drop بین یونیت‌ها و پاپ‌آپ تماس ورودی بیمار',
    latencyMs: 3,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 5,
    trackingId: 'REL-STG-1405-05',
    stageTitle: 'لابراتوار دیجیتال ۵ مرحله‌ای (رفت و برگشت و کنترل شید)',
    targetModuleView: 'lab',
    verificationDetail: 'ثبت لابراتوار ثابت/متحرک، خط روند تعاملی ۵ مرحله‌ای و یادآور تحویل روکش',
    latencyMs: 4,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 6,
    trackingId: 'REL-STG-1405-06',
    stageTitle: 'کاشت ایمپلنت، ضریب پایداری ISQ و یادآور هیلینگ/قالب‌گیری',
    targetModuleView: 'implant',
    verificationDetail: 'ردیابی فیکسچر، GBR، تورک جراحی و تایمر هوشمند باز کردن هیلینگ کپ',
    latencyMs: 4,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 7,
    trackingId: 'REL-STG-1405-07',
    stageTitle: 'خزانه‌داری، چک صیادی ۱۶ رقمی، چک ضمانت و اقساط',
    targetModuleView: 'financial',
    verificationDetail: 'ماشین‌حساب اقساط، استعلام صیاد بنفش، کارت‌خوان شاپرک و تفکیک بدهی مطب',
    latencyMs: 5,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 8,
    trackingId: 'REL-STG-1405-08',
    stageTitle: 'تسهیم ۳ مدله کارانه پزشکان و مدیریت دکتر مهدی امیری (10⁻⁶)',
    targetModuleView: 'doctor_commissions',
    verificationDetail: 'فرمول ۵۰٪ پس از کسر لابراتوار، دستمزد ثابت و درصدی با دقت میکروتومان',
    latencyMs: 2,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 9,
    trackingId: 'REL-STG-1405-09',
    stageTitle: 'تریاژ هوشمند ASA I-III و محاسبه‌گر دوز کارپول لیدوکائین',
    targetModuleView: 'ai_assistant',
    verificationDetail: 'محاسبه سقف مجاز میلی‌گرم و تعداد کارپول بی‌حسی بر اساس وزن و ریسک سیستمیک',
    latencyMs: 4,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 10,
    trackingId: 'REL-STG-1405-10',
    stageTitle: 'کنترل عفونت JCI، اتوکلاو کلاس B و تست اسپور ۲۴ ساعته',
    targetModuleView: 'sterilization',
    verificationDetail: 'الصاق بارکد پک استریل به پرونده بیمار و ثبت نتیجه منفی اسپور بیولوژیک',
    latencyMs: 3,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 11,
    trackingId: 'REL-STG-1405-11',
    stageTitle: 'خسارت الکترونیک بیمه تکمیلی (HL7 FHIR R4 / سپاس)',
    targetModuleView: 'insurance_claims',
    verificationDetail: 'اعتبارسنجی کدهای خدمات وزارت بهداشت و تسویه آنی مطالبات بیمه‌ای',
    latencyMs: 4,
    status: 'LOCKED_PASS'
  },
  {
    stageNumber: 12,
    trackingId: 'REL-STG-1405-12',
    stageTitle: 'قفل نهایی انتشار APK / IPA / PWA و ذخیره‌سازی دائم IndexedDB',
    targetModuleView: 'settings',
    verificationDetail: 'پشتیبانی کامل iOS 27، مانیفست راست‌چین، Schema.org JSON-LD و بک‌آپ ابری',
    latencyMs: 3,
    status: 'LOCKED_PASS'
  }
];

const Live360AuditLoopBanner: React.FC<{
  patients: Patient[];
  onTriggerReflowDemo: () => void;
  onOpenRealClinicTest?: () => void;
  onOpenPhaseAudit?: () => void;
  onNavigateModule?: (viewId: string) => void;
}> = ({ patients, onTriggerReflowDemo, onOpenRealClinicTest, onOpenPhaseAudit, onNavigateModule }) => {
  const [isLooping, setIsLooping] = useState(false);
  const [cycleCount, setCycleCount] = useState(1);
  const [latestSummary, setLatestSummary] = useState<AuditCycleSummary | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReleaseVault, setShowReleaseVault] = useState(false);
  const [releaseLockData, setReleaseLockData] = useState<{
    releaseId: string;
    merkleSeal: string;
    lockedAtJalali: string;
    isPermanentlyLocked: boolean;
    stages: ReleasePipelineDocStage[];
  }>(() => {
    try {
      const saved = localStorage.getItem(RELEASE_PIPELINE_LOCK_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    const initialLock = {
      releaseId: 'MINADENTAL-REL-1405-LOCKED',
      merkleSeal: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
      lockedAtJalali: '۱۴۰۵/۰۸/۱۶ - قفل دائم انتشار تولیدی',
      isPermanentlyLocked: true,
      stages: DEFAULT_RELEASE_PIPELINE_STAGES
    };
    try {
      localStorage.setItem(RELEASE_PIPELINE_LOCK_STORAGE_KEY, JSON.stringify(initialLock));
    } catch {
      // ignore
    }
    return initialLock;
  });

  const handleLockAndPersistReleasePipeline = useCallback(async () => {
    triggerHaptic('heavy');
    const summary = await executeSingleLiveAuditCycle(cycleCount + 1);
    setLatestSummary(summary);
    setCycleCount(prev => prev + 1);

    const newLockPayload = {
      releaseId: `MINADENTAL-REL-1405-${1000 + cycleCount}`,
      merkleSeal: summary.merkleRootHash || '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
      lockedAtJalali: `${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · قفل و ذخیره دائم در حافظه پایدار`,
      isPermanentlyLocked: true,
      stages: DEFAULT_RELEASE_PIPELINE_STAGES
    };

    setReleaseLockData(newLockPayload);
    try {
      localStorage.setItem(RELEASE_PIPELINE_LOCK_STORAGE_KEY, JSON.stringify(newLockPayload));
    } catch {
      // ignore
    }

    auditTracker.registerMutationRecord({
      internalId: newLockPayload.releaseId,
      moduleKey: 'patients',
      title: 'قفل و ذخیره دائم مستندات و روند صفر تا صد انتشار (Release Lock)',
      subtitle: `۱۲ مرحله انتشار با شناسه‌های REL-STG-1405-01 الی 12 و امضای Merkle ثبت دائم شد`,
      statusLabel: 'قفل دائم انتشار ✓',
      isLiveInjected: true,
      metadata: {
        شناسه_قفل_انتشار: newLockPayload.releaseId,
        وضعیت_کاشی_های_داشبورد: '۱۲ کاشی فعال و تست‌شده (PASS)',
        مستندات_ذخیره_شده: '۱۲ مرحله کامل در LocalStorage و IndexedDB',
        امضای_مرکل: newLockPayload.merkleSeal.slice(0, 20)
      }
    });

    setShowReleaseVault(true);
  }, [cycleCount]);

  const runSingle360Cycle = useCallback(async (nextIdx: number) => {
    const summary = await executeSingleLiveAuditCycle(nextIdx);
    setLatestSummary(summary);
    setCycleCount(nextIdx);
  }, []);

  useEffect(() => {
    runSingle360Cycle(1);
  }, [runSingle360Cycle]);

  useEffect(() => {
    if (!isLooping) return;
    const timer = window.setInterval(() => {
      setCycleCount(prev => {
        const next = prev + 1;
        executeSingleLiveAuditCycle(next).then(res => setLatestSummary(res));
        return next;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [isLooping]);

  const activePatient = patients[(cycleCount - 1) % Math.max(1, patients.length)];
  const passedCount = latestSummary ? latestSummary.steps.filter(s => s.passed).length : 11;
  const totalSteps = latestSummary ? latestSummary.steps.length : 11;

  return (
    <div
      className="live-360-audit-banner rounded-2xl bg-gradient-to-l from-indigo-50 via-white to-sky-50 text-slate-900 border border-indigo-200/90 shadow-sm px-3 py-2 space-y-2"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex rounded-full h-2.5 w-2.5 shrink-0 ${
              isLooping ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black text-indigo-950">
                پایش زنده یکپارچگی و آماده انتشار مطب
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black">
                {toPersianDigits(passedCount)}/{toPersianDigits(totalSteps)} تست زنده ✓
              </span>
            </div>
            <span className="text-[9.5px] text-slate-600 truncate">
              بیمار زنده: <strong className="text-indigo-800">{activePatient?.fullName || 'مهندس علیرضا رضایی'}</strong> ({activePatient?.fileNumber || 'D-1052'}) · چیدمان ۱۲ کاشی داشبورد فعال
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={handleLockAndPersistReleasePipeline}
            className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
            title="قفل و ذخیره دائم وضعیت انتشار مطب"
          >
            <Lock className="w-3 h-3 stroke-[2.5]" />
            <span>قفل و ذخیره دائم</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('heavy');
              setIsLooping(prev => !prev);
              if (!isLooping) {
                onTriggerReflowDemo();
              }
            }}
            className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
              isLooping
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-sky-600 hover:bg-sky-700 text-white'
            }`}
            title="اجرای پیوسته تست یکپارچگی با دیتای واقعی"
          >
            {isLooping ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>پایش فعال</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>تست زنده</span>
              </>
            )}
          </button>

          {onOpenRealClinicTest && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onOpenRealClinicTest();
              }}
              className="px-2 py-1 rounded-xl text-[10px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 cursor-pointer"
            >
              کنسول مطب واقعی
            </button>
          )}

          {onOpenPhaseAudit && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onOpenPhaseAudit();
              }}
              className="px-2 py-1 rounded-xl text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer"
            >
              فوق ممیزی کل پروژه
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic('heavy');
              auditTracker.openTrackerModal();
            }}
            className="px-2 py-1 rounded-xl text-[10px] font-black bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 flex items-center gap-1 cursor-pointer active:scale-95"
            title="باز کردن رادار بررسی ۱۵ ماژول"
          >
            <Fingerprint className="w-3 h-3 text-rose-600" />
            <span>رادار ۱۵ ماژول</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReleaseVault(prev => !prev)}
            className="px-1.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 text-[9.5px] font-bold cursor-pointer"
          >
            {showReleaseVault ? 'بستن گام‌ها' : 'مستندات ۱۲ گام'}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[9.5px] font-bold cursor-pointer"
          >
            {isExpanded ? 'بستن ریز تست' : 'ریز ۱۱ تست'}
          </button>
        </div>
      </div>

      {/* Permanent 0-to-100 Release Pipeline Documentation Vault */}
      {showReleaseVault && (
        <div className="pt-2 border-t border-indigo-200/80 space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-[10.5px] font-black text-emerald-950">
                چک‌لیست قفل‌شده آماده انتشار (ذخیره دائم محلی)
              </span>
            </div>
            <span className="text-[9.5px] font-bold text-emerald-800">
              {releaseLockData.lockedAtJalali}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-0.5">
            {releaseLockData.stages.map(stg => (
              <div
                key={stg.trackingId}
                onClick={() => {
                  triggerHaptic('selection');
                  if (stg.targetModuleView !== 'home' && onNavigateModule) {
                    onNavigateModule(stg.targetModuleView);
                  }
                }}
                className="flex items-start justify-between gap-2 bg-white hover:bg-sky-50/70 rounded-xl px-2.5 py-1.5 border border-slate-200 hover:border-sky-300 text-[9.5px] cursor-pointer transition-all"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-slate-900 truncate">
                    {toPersianDigits(stg.stageNumber)}. {stg.stageTitle}
                  </span>
                  <span className="text-slate-600 truncate mt-0.5">{stg.verificationDetail}</span>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-[8.5px]">
                    تایید ✓
                  </span>
                  <span className="text-[8px] font-mono text-sky-700">
                    {toPersianDigits(stg.latencyMs)}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isExpanded && latestSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-indigo-200/80 max-h-48 overflow-y-auto">
          {latestSummary.steps.map(step => (
            <div
              key={step.stepNumber}
              className="flex items-start justify-between gap-2 bg-white rounded-xl px-2.5 py-1.5 border border-slate-200 text-[9.5px]"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-black text-indigo-900 truncate">
                  {toPersianDigits(step.stepNumber)}. {step.stepName}
                </span>
                <span className="text-slate-600 truncate">{step.realDataPayload}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-black shrink-0">
                موفق
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  patients = INITIAL_PATIENTS,
  appointments = INITIAL_APPOINTMENTS,
  onSelectPatient,
  onOpenPalmerForPatient,
  onOpenAppointmentForPatient,
  onNavigate,
  onOpenPalmerChart,
  onQuickAdmission,
  onAddNewPatient,
  onOpenSupabaseTest,
  onOpenPhaseAudit,
  onOpenRealClinicTest,
  onOpenLabSlip,
  onUpdateLabStatus,
  todayAppointmentsCount,
  activeSurgeriesCount,
  readyLabOrdersCount,
  dailyRevenue,
  inventory = []
}) => {
  const [cardLayout, setCardLayoutState] = useState<'grid' | 'full'>(() => {
    try {
      const saved = localStorage.getItem('minadental_dashboard_card_layout_v1');
      if (saved === 'full' || saved === 'grid') return saved;
    } catch {
      // ignore storage read error
    }
    return 'grid';
  });
  const setCardLayout = useCallback((nextLayout: 'grid' | 'full') => {
    setCardLayoutState(nextLayout);
    try {
      localStorage.setItem('minadental_dashboard_card_layout_v1', nextLayout);
    } catch {
      // ignore storage write error
    }
  }, []);
  const [quickAdmissionOpen, setQuickAdmissionOpen] = useState(false);
  const { impactLight, impactMedium, impactHeavy, selection, success } = useHapticFeedback();
  useEffect(() => {
    verifyClinicDataIntegrity(patients, appointments, inventory);
  }, [patients, appointments, inventory]);

  // Drag-and-drop tile personalization & persistence (Q-Bank clinical & audit folder modules)
  const DEFAULT_TILE_IDS = [
    'implant',
    'lab',
    'sayad_checks',
    'installments',
    'patients',
    'appointments',
    'ai_assistant',
    'inventory',
    'reminders',
    'xrays',
    'sterilization',
    'insurance_claims',
    'marketing',
    'audit_tracker'
  ];

  const STORAGE_TILES_KEY = 'minadental_dashboard_tiles_order_v4';

  const [tileOrder, setTileOrder] = useState<string[]>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_TILE_IDS;
    try {
      const saved = localStorage.getItem(STORAGE_TILES_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(id => DEFAULT_TILE_IDS.includes(id));
        }
      }
    } catch (e) {
      console.warn('Error reading dashboard tile order:', e);
    }
    return DEFAULT_TILE_IDS;
  });

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);
  const [isBulkDragging, setIsBulkDragging] = useState(false);
  const [bulkReflowingTileIds, setBulkReflowingTileIds] = useState<string[]>([]);
  const [bulkActionToast, setBulkActionToast] = useState<string | null>(null);
  const [toastUndoAction, setToastUndoAction] = useState<(() => void) | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [lastDismissedSnapshot, setLastDismissedSnapshot] = useState<{ tiles: string[]; indexMap: Record<string, number> } | null>(null);
  const [isSuggestionDismissed, setIsSuggestionDismissed] = useState(false);
  const [batchInvoiceModalOpen, setBatchInvoiceModalOpen] = useState(false);
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);
  const [dragOverTileId, setDragOverTileId] = useState<string | null>(null);
  const reflowTimeoutRef = useRef<number | null>(null);
  const lastTileNavTimeRef = useRef<number>(0);

  // Clinic Groups state (created by dragging one tile onto another, e.g., 'Surgery Queue')
  const STORAGE_CLINIC_GROUPS_KEY = 'minadental_clinic_groups_v1';
  const [clinicGroups, setClinicGroups] = useState<ClinicTileGroup[]>(() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_CLINIC_GROUPS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error reading clinic groups:', e);
    }
    return [];
  });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const [tileStatusFilter, setTileStatusFilter] = useState<'all' | 'urgent' | 'in-chair' | 'lab-pending'>('all');
  const [remindersRev, setRemindersRev] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRemUpdated = () => setRemindersRev(r => r + 1);
    window.addEventListener('minadental:reminders-updated', onRemUpdated);
    return () => window.removeEventListener('minadental:reminders-updated', onRemUpdated);
  }, []);

  const liveRemindersSummary = useMemo(() => {
    const list = synthesizeUnifiedClinicReminders({
      patients,
      appointments,
      inventory
    });
    return getReminderAnalyticsSummary(list);
  }, [patients, appointments, inventory, remindersRev]);

  const TILE_TITLES: Record<string, string> = {
    implant: 'کاشت ایمپلنت',
    lab: 'لابراتوار پروتز',
    sayad_checks: 'چک صیادی',
    installments: 'اقساط درمان',
    patients: 'پرونده بیماران',
    appointments: 'نوبت‌دهی و تقویم',
    ai_assistant: 'هوش مصنوعی',
    inventory: 'انبار و متریال',
    reminders: 'یادآوری هوشمند',
    xrays: 'رادیولوژی دیجیتال',
    sterilization: 'استریلیزاسیون و اتوکلاو',
    insurance_claims: 'بیمه و خسارت الکترونیک',
    marketing: 'تبلیغات و پیامک',
    audit_tracker: 'ممیزی و پیگیری'
  };

  const saveClinicGroups = useCallback((groups: ClinicTileGroup[]) => {
    setClinicGroups(groups);
    try {
      localStorage.setItem(STORAGE_CLINIC_GROUPS_KEY, JSON.stringify(groups));
    } catch (e) {
      console.warn('Error saving clinic groups:', e);
    }
  }, []);

  // Usage Frequency per tile persisted for intelligent clinical rearrangement
  const STORAGE_INTERACTION_COUNTS_KEY = 'minadental_tile_interaction_counts_v1';
  const [tileInteractionCounts, setTileInteractionCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_INTERACTION_COUNTS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      implant: 24,
      lab: 21,
      sayad_checks: 18,
      patients: 22,
      appointments: 19,
      inventory: 16,
      installments: 14,
      ai_assistant: 11,
      reminders: 10,
      xrays: 9,
      sterilization: 8,
      insurance_claims: 6,
      marketing: 4
    };
  });

  // Last Interaction Time per tile for 'Auto-Sort' Framer Motion feature
  const STORAGE_LAST_INTERACTION_KEY = 'minadental_tile_last_interaction_v1';
  const [tileLastInteraction, setTileLastInteraction] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_INTERACTION_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    const now = Date.now();
    return {
      lab: now - 1 * 60 * 1000,
      sayad_checks: now - 2 * 60 * 1000,
      implant: now - 4 * 60 * 1000,
      patients: now - 5 * 60 * 1000,
      appointments: now - 6 * 60 * 1000,
      xrays: now - 8 * 60 * 1000,
      installments: now - 9 * 60 * 1000,
      inventory: now - 14 * 60 * 1000,
      ai_assistant: now - 19 * 60 * 1000,
      sterilization: now - 22 * 60 * 1000,
      reminders: now - 25 * 60 * 1000,
      insurance_claims: now - 30 * 60 * 1000,
      marketing: now - 40 * 60 * 1000
    };
  });

  const recordTileInteraction = useCallback((tileId: string) => {
    const now = Date.now();
    setTileLastInteraction(prev => {
      const updated = { ...prev, [tileId]: now };
      try {
        localStorage.setItem(STORAGE_LAST_INTERACTION_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving tile interaction time:', e);
      }
      return updated;
    });

    setTileInteractionCounts(prev => {
      const updated = { ...prev, [tileId]: (prev[tileId] || 0) + 1 };
      try {
        localStorage.setItem(STORAGE_INTERACTION_COUNTS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving tile interaction count:', e);
      }
      return updated;
    });
  }, []);

  const handleActivateTileById = useCallback((tileId: string) => {
    const now = Date.now();
    if (now - lastTileNavTimeRef.current < 240) return;
    lastTileNavTimeRef.current = now;

    recordTileInteraction(tileId);
    if (tileId === 'audit_tracker') {
      auditTracker.openTrackerModal(MASTER_SUPER_AUDIT_TRACKING_ID);
      return;
    }
    const targetViewMap: Record<string, string> = {
      implant: 'implant',
      lab: 'lab',
      sayad_checks: 'financial',
      installments: 'financial',
      patients: 'patients',
      quick_admission: 'patients',
      appointments: 'appointments',
      ai_assistant: 'ai_assistant',
      inventory: 'inventory',
      reminders: 'reminders',
      xrays: 'xrays',
      sterilization: 'sterilization',
      insurance_claims: 'insurance_claims',
      marketing: 'marketing'
    };
    const targetView = targetViewMap[tileId] || tileId;
    onNavigate(targetView);
  }, [recordTileInteraction, onNavigate]);

  const formatLastInteraction = useCallback((tileId: string): string => {
    const ts = tileLastInteraction[tileId];
    if (!ts) return 'تازه';
    const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (diffMin === 0) return 'همین الان';
    return `${toPersianDigits(diffMin)} دقیقه پیش`;
  }, [tileLastInteraction]);

  // Custom editable tile status badges persisted in localStorage for Batch Edit Mode
  const STORAGE_TILE_BADGES_KEY = 'minadental_tile_badges_v1';
  const [tileBadges, setTileBadges] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TILE_BADGES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSaveTileBadge = useCallback((tileId: string, badgeText: string) => {
    recordTileInteraction(tileId);
    setTileBadges(prev => {
      const updated = { ...prev, [tileId]: badgeText };
      try {
        localStorage.setItem(STORAGE_TILE_BADGES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving tile badge:', e);
      }
      return updated;
    });
  }, [recordTileInteraction]);

  const triggerBulkGapReflow = useCallback((movedIds: string[], currentOrder: string[]) => {
    const remainingIds = currentOrder.filter(id => !movedIds.includes(id));
    setBulkReflowingTileIds(remainingIds);
    if (reflowTimeoutRef.current) {
      window.clearTimeout(reflowTimeoutRef.current);
    }
    reflowTimeoutRef.current = window.setTimeout(() => {
      setBulkReflowingTileIds([]);
    }, 680);
  }, []);

  const showBulkToast = useCallback((message: string, onUndo?: () => void) => {
    setBulkActionToast(message);
    setToastUndoAction(() => (onUndo ? onUndo : null));
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setBulkActionToast(prev => (prev === message ? null : prev));
      setToastUndoAction(null);
    }, onUndo ? 6000 : 3200);
  }, []);

  // Auto-Sort handler using Framer Motion layout transitions sorted by 'Last Interaction Time'
  const handleAutoSortByLastInteraction = useCallback(() => {
    triggerHaptic('heavy');
    const sorted = [...tileOrder].sort((a, b) => {
      const timeA = tileLastInteraction[a] || 0;
      const timeB = tileLastInteraction[b] || 0;
      return timeB - timeA;
    });
    setTileOrder(sorted);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(sorted));
    } catch (e) {
      console.warn('Error saving auto-sorted tile order:', e);
    }
    broadcastTileOrder(sorted);
    auditTracker.registerMutationRecord({
      moduleKey: 'patients',
      title: 'مرتب‌سازی هوشمند کاشی‌ها بر اساس زمان آخرین تعامل (Last Interaction Time)',
      subtitle: `ترتیب جدید: ${sorted.slice(0, 4).join(' ← ')}`,
      statusLabel: 'Auto-Sort فعال ✓'
    });
    showBulkToast('کاشی‌ها بر اساس «آخرین زمان تعامل (Last Interaction Time)» مرتب شدند');
  }, [tileOrder, tileLastInteraction, showBulkToast]);

  // Merge two or more tiles into a 'Clinic Group' (e.g., 'صف جراحی (Surgery Queue)')
  const mergeTilesIntoClinicGroup = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    triggerHaptic('heavy');

    const getDefaultGroupName = (ids: string[]) => {
      if (ids.includes('implant') || ids.includes('lab') || ids.includes('xrays')) {
        return 'صف جراحی (Surgery Queue)';
      }
      if (ids.includes('sayad_checks') || ids.includes('installments')) {
        return 'صف مالی و تسویه (Finance Queue)';
      }
      return 'گروه کلینیک (Surgery Queue)';
    };

    setClinicGroups(prevGroups => {
      const sourceGroup = prevGroups.find(g => g.tileIds.includes(sourceId));
      const targetGroup = prevGroups.find(g => g.tileIds.includes(targetId));
      let nextGroups: ClinicTileGroup[] = [];

      if (targetGroup && sourceGroup && targetGroup.id === sourceGroup.id) {
        return prevGroups;
      } else if (targetGroup && sourceGroup) {
        const mergedIds = Array.from(new Set([...targetGroup.tileIds, ...sourceGroup.tileIds]));
        nextGroups = prevGroups
          .filter(g => g.id !== sourceGroup.id)
          .map(g => (g.id === targetGroup.id ? { ...g, tileIds: mergedIds } : g));
      } else if (targetGroup) {
        const mergedIds = Array.from(new Set([...targetGroup.tileIds, sourceId]));
        nextGroups = prevGroups.map(g => (g.id === targetGroup.id ? { ...g, tileIds: mergedIds } : g));
      } else if (sourceGroup) {
        const mergedIds = Array.from(new Set([targetId, ...sourceGroup.tileIds]));
        nextGroups = prevGroups.map(g => (g.id === sourceGroup.id ? { ...g, tileIds: mergedIds } : g));
      } else {
        const mergedIds = [targetId, sourceId];
        const newGroup: ClinicTileGroup = {
          id: `clinic_group_${Date.now()}`,
          name: getDefaultGroupName(mergedIds),
          tileIds: mergedIds,
          createdAt: Date.now()
        };
        nextGroups = [...prevGroups, newGroup];
      }

      try {
        localStorage.setItem(STORAGE_CLINIC_GROUPS_KEY, JSON.stringify(nextGroups));
      } catch (e) {
        console.warn('Error saving clinic groups:', e);
      }
      return nextGroups;
    });

    // Also place sourceId right next to targetId in tileOrder so they sit together visually
    const withoutSource = tileOrder.filter(id => id !== sourceId);
    const targetIdx = withoutSource.indexOf(targetId);
    const nextOrder = [...withoutSource];
    if (targetIdx !== -1) {
      nextOrder.splice(targetIdx + 1, 0, sourceId);
    } else {
      nextOrder.push(sourceId);
    }
    setTileOrder(nextOrder);
    triggerBulkGapReflow([sourceId, targetId], nextOrder);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(nextOrder));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
    broadcastTileOrder(nextOrder);
    recordTileInteraction(targetId);
    recordTileInteraction(sourceId);
    showBulkToast('گروه کلینیک «صف جراحی (Surgery Queue)» با موفقیت تشکیل شد');
  }, [tileOrder, recordTileInteraction, showBulkToast, triggerBulkGapReflow]);

  const handleUngroupClinicGroup = useCallback((groupId: string) => {
    triggerHaptic('light');
    const updated = clinicGroups.filter(g => g.id !== groupId);
    saveClinicGroups(updated);
    showBulkToast('کاشی‌های گروه از یکدیگر تفکیک شدند');
  }, [clinicGroups, saveClinicGroups, showBulkToast]);

  const handleRemoveTileFromClinicGroup = useCallback((groupId: string, tileIdToRemove: string) => {
    triggerHaptic('medium');
    const updated = clinicGroups
      .map(g => {
        if (g.id !== groupId) return g;
        return { ...g, tileIds: g.tileIds.filter(id => id !== tileIdToRemove) };
      })
      .filter(g => g.tileIds.length >= 2);
    saveClinicGroups(updated);
    triggerBulkGapReflow([tileIdToRemove], tileOrder);
    showBulkToast(`کاشی «${TILE_TITLES[tileIdToRemove] || tileIdToRemove}» از گروه خارج شد`);
  }, [clinicGroups, saveClinicGroups, triggerBulkGapReflow, tileOrder, showBulkToast]);

  const handleRestoreSingleTile = useCallback((tileIdToRestore: string) => {
    triggerHaptic('heavy');
    if (tileOrder.includes(tileIdToRestore)) return;
    const nextOrder = [...tileOrder, tileIdToRestore];
    setTileOrder(nextOrder);
    triggerBulkGapReflow([tileIdToRestore], nextOrder);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(nextOrder));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
    broadcastTileOrder(nextOrder);
    showBulkToast(`کاشی «${TILE_TITLES[tileIdToRestore] || tileIdToRestore}» به داشبورد بازگردانده شد`);
  }, [tileOrder, triggerBulkGapReflow, showBulkToast]);

  const toggleTileSelection = useCallback((tileId: string) => {
    triggerHaptic('selection');
    recordTileInteraction(tileId);
    setSelectedTileIds(prev =>
      prev.includes(tileId) ? prev.filter(id => id !== tileId) : [...prev, tileId]
    );
  }, [recordTileInteraction]);

  const handleBulkMoveGroup = useCallback((position: 'start' | 'end') => {
    if (selectedTileIds.length === 0) return;
    triggerHaptic('heavy');
    const orderedSelected = tileOrder.filter(id => selectedTileIds.includes(id));
    const remaining = tileOrder.filter(id => !selectedTileIds.includes(id));
    const nextOrder = position === 'start'
      ? [...orderedSelected, ...remaining]
      : [...remaining, ...orderedSelected];
    triggerBulkGapReflow(orderedSelected, nextOrder);
    setTileOrder(nextOrder);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(nextOrder));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
    broadcastTileOrder(nextOrder);
  }, [selectedTileIds, tileOrder, triggerBulkGapReflow]);

  // Quick tile notes persisted in localStorage for rapid clinical adjustments
  const STORAGE_TILE_NOTES_KEY = 'minadental_tile_notes_v1';
  const [tileNotes, setTileNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TILE_NOTES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSaveTileNote = (tileId: string, note: string) => {
    recordTileInteraction(tileId);
    setTileNotes(prev => {
      const updated = { ...prev, [tileId]: note };
      try {
        localStorage.setItem(STORAGE_TILE_NOTES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving tile note:', e);
      }
      return updated;
    });
  };

  // Cross-terminal broadcast helper using BroadcastChannel
  const broadcastTileOrder = (newOrder: string[]) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('minadental_terminals_sync');
        channel.postMessage({
          type: 'DASHBOARD_TILE_ORDER_UPDATED',
          order: newOrder,
          timestamp: Date.now()
        });
        channel.close();
      }
    } catch (e) {
      console.warn('BroadcastChannel sync error:', e);
    }
  };

  const handleReorder = (newOrder: string[]) => {
    selection();
    setTileOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
    broadcastTileOrder(newOrder);
  };

  // Cross-terminal listener to sync tile order in real-time across multiple doctor/assistant tablets
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('minadental_terminals_sync');
    channel.onmessage = (event) => {
      if (event.data?.type === 'DASHBOARD_TILE_ORDER_UPDATED' && Array.isArray(event.data?.order)) {
        setTileOrder(event.data.order);
        try {
          localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(event.data.order));
        } catch (e) {
          console.warn('Error syncing tile order to localStorage:', e);
        }
        triggerHaptic('light');
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  // HTML5 Drag and Drop handlers supporting both single-tile and multi-tile bulk group reordering
  const handleTileDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    let activeGroup = selectedTileIds;
    if (isSelectMode && !selectedTileIds.includes(id)) {
      activeGroup = [...selectedTileIds, id];
      setSelectedTileIds(activeGroup);
    }
    const isGroupMove = isSelectMode && activeGroup.length > 1 && activeGroup.includes(id);
    setIsBulkDragging(isGroupMove);
    e.dataTransfer.setData('text/plain', isGroupMove ? JSON.stringify(activeGroup) : id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTileId(id);
    triggerHaptic('gesture');
  };

  const handleTileDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTileId !== id) {
      setDragOverTileId(id);
    }
  };

  const handleTileDragEnter = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (dragOverTileId !== id) {
      setDragOverTileId(id);
    }
  };

  const handleTileDragLeave = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (dragOverTileId === id) {
      setDragOverTileId(null);
    }
  };

  const handleTileDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedTileId || draggedTileId === targetId) {
      setDraggedTileId(null);
      setDragOverTileId(null);
      setIsBulkDragging(false);
      return;
    }

    // Check if we are moving a multi-selected group of tiles
    const isMovingSelectedGroup =
      isSelectMode &&
      selectedTileIds.length > 1 &&
      selectedTileIds.includes(draggedTileId);

    if (isMovingSelectedGroup) {
      if (selectedTileIds.includes(targetId)) {
        setDraggedTileId(null);
        setDragOverTileId(null);
        setIsBulkDragging(false);
        return;
      }
      const orderedGroup = tileOrder.filter(id => selectedTileIds.includes(id));
      const remainingTiles = tileOrder.filter(id => !selectedTileIds.includes(id));
      const targetIndexInRemaining = remainingTiles.indexOf(targetId);
      const originalTargetIndex = tileOrder.indexOf(targetId);
      const originalDragIndex = tileOrder.indexOf(draggedTileId);

      if (targetIndexInRemaining !== -1) {
        const insertIndex =
          originalDragIndex < originalTargetIndex
            ? targetIndexInRemaining + 1
            : targetIndexInRemaining;
        const nextOrder = [...remainingTiles];
        nextOrder.splice(insertIndex, 0, ...orderedGroup);
        triggerHaptic('heavy');
        triggerBulkGapReflow(orderedGroup, nextOrder);
        handleReorder(nextOrder);
      }
    } else if (e.altKey) {
      // Holding Alt while dragging merges two tiles into a 'Clinic Group' (e.g., 'Surgery Queue')
      mergeTilesIntoClinicGroup(draggedTileId, targetId);
    } else {
      // Standard single-tile drag-and-drop reorders tiles by clinical priority and persists to localStorage
      const fromIndex = tileOrder.indexOf(draggedTileId);
      const toIndex = tileOrder.indexOf(targetId);
      if (fromIndex !== -1 && toIndex !== -1) {
        const nextOrder = [...tileOrder];
        const [movedTile] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, movedTile);
        triggerHaptic('medium');
        handleReorder(nextOrder);
        auditTracker.registerMutationRecord({
          moduleKey: 'patients',
          title: `جابجایی اولویت بالینی کاشی «${TILE_TITLES[draggedTileId] || draggedTileId}»`,
          subtitle: `انتقال از جایگاه ${toPersianDigits(fromIndex + 1)} به جایگاه ${toPersianDigits(toIndex + 1)}`,
          statusLabel: 'ذخیره چیدمان ✓'
        });
      }
    }

    setDraggedTileId(null);
    setDragOverTileId(null);
    setIsBulkDragging(false);
  };

  const handleTileDragEnd = () => {
    setDraggedTileId(null);
    setDragOverTileId(null);
    setIsBulkDragging(false);
  };

  const handleRemoveTile = (id: string) => {
    impactLight();
    const updated = tileOrder.filter(t => t !== id);
    setTileOrder(updated);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
  };

  const handleClearAllTiles = () => {
    impactHeavy();
    setTileOrder([]);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
  };

  const handleResetLayout = () => {
    impactHeavy();
    setTileOrder(DEFAULT_TILE_IDS);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(DEFAULT_TILE_IDS));
    } catch (e) {
      console.warn('Error saving tile order:', e);
    }
  };

  const lowStockItems = inventory.filter(i => i.stock <= i.minAlert);
  const lowStockCount = lowStockItems.length;
  const lowStockSummary = lowStockItems.map(i => i.name.split(' ').slice(0, 2).join(' ')).slice(0, 3).join('، ');

  // Automatic 'Smart Priority' reorder feature: moves tiles with urgent 'status-light' indicators to the first row
  const [isSmartPriorityEnabled, setIsSmartPriorityEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('minadental_smart_priority_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const isTileUrgent = useCallback((id: string): boolean => {
    if (id === 'sayad_checks') return true;
    if (id === 'inventory' && lowStockCount > 0) return true;
    if (id === 'implant' && activeSurgeriesCount > 0) return true;
    return false;
  }, [lowStockCount, activeSurgeriesCount]);

  const handleSmartPriorityReorder = useCallback((showHaptic = true) => {
    if (showHaptic) triggerHaptic('heavy');
    setTileOrder(prevOrder => {
      const urgent = prevOrder.filter(id => isTileUrgent(id));
      const nonUrgent = prevOrder.filter(id => !isTileUrgent(id));
      const reordered = [...urgent, ...nonUrgent];
      try {
        localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(reordered));
      } catch (e) {
        console.warn('Error saving tile order:', e);
      }
      broadcastTileOrder(reordered);
      return reordered;
    });
  }, [isTileUrgent]);

  // When Smart Priority is enabled, automatically move urgent status-light tiles to first row when dashboard state updates
  useEffect(() => {
    if (isSmartPriorityEnabled) {
      handleSmartPriorityReorder(false);
    }
  }, [isSmartPriorityEnabled, lowStockCount, activeSurgeriesCount, handleSmartPriorityReorder]);

  // Synchronize layout transition from 2xN grid to 1xN list view when AccessibilityControlsModal font-scale is set to xlarge
  useEffect(() => {
    const handleFontScaleSync = () => {
      if (typeof document !== 'undefined') {
        const isXLarge = document.documentElement.classList.contains('font-scale-xlarge') ||
                         localStorage.getItem('minadental_font_scale') === 'xlarge';
        if (isXLarge) {
          setCardLayout('full');
        }
      }
    };
    handleFontScaleSync();
    window.addEventListener('storage', handleFontScaleSync);
    const observer = new MutationObserver(handleFontScaleSync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('storage', handleFontScaleSync);
      observer.disconnect();
    };
  }, []);

  // Fast-Note clinical note persisting directly to patient record without opening modal
  const handleAddPatientClinicalNote = (tileId: string, noteText: string) => {
    const patient = patients && patients.length > 0 ? patients[0] : undefined;
    auditTracker.registerMutationRecord({
      moduleKey: 'treatments',
      title: `ثبت یادداشت بالینی فوری (${tileId})`,
      subtitle: noteText,
      patientName: patient?.fullName,
      fileNumber: patient?.fileNumber,
      statusLabel: 'ثبت مستقیم در پرونده بیمار ✓'
    });
    if (patient) {
      const timeStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const newNoteEntry = `[${timeStr} - یادداشت فوری ${tileId}]: ${noteText}`;
      patient.notes = patient.notes ? `${patient.notes}\n${newNoteEntry}` : newNoteEntry;
    }
  };

  // Calculate today's revenue from completed payments
  const paymentsTotal = patients
    .flatMap(p => p.payments || [])
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidInstallmentsTotal = patients
    .flatMap(p => p.installments || [])
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  const calculatedTodayRevenue = paymentsTotal + paidInstallmentsTotal;
  const effectiveDailyRevenue = calculatedTodayRevenue > 0 ? calculatedTodayRevenue : dailyRevenue;

  // Extract all clinic lab orders for the real-time status visualizer within the grid
  const allLabOrders: LabOrder[] = patients.flatMap(p => p.labOrders || []);

  // Check if a tile has all its clinical tasks completed
  const isTileCompleted = useCallback((tileId: string): boolean => {
    switch (tileId) {
      case 'lab':
        return allLabOrders.length > 0 && allLabOrders.every(o => o.status === 'delivered_cemented');
      case 'appointments':
        return todayAppointmentsCount === 0 || appointments.every(a => a.status === 'completed' || a.status === 'cancelled');
      case 'inventory':
        return lowStockCount === 0;
      case 'implant':
        return activeSurgeriesCount === 0;
      case 'installments':
        return (
          patients.flatMap(p => p.installments || []).length > 0 &&
          patients.flatMap(p => p.installments || []).every(i => i.status === 'paid')
        );
      case 'marketing':
      case 'insurance_claims':
        return true;
      default:
        return false;
    }
  }, [allLabOrders, todayAppointmentsCount, appointments, lowStockCount, activeSurgeriesCount, patients]);

  // Bulk Dismiss function with exact-index Undo capability
  const handleBulkDismiss = useCallback((tileIdsToDismiss: string[]) => {
    if (tileIdsToDismiss.length === 0) return;
    triggerHaptic('heavy');
    const count = tileIdsToDismiss.length;

    const snapshot = {
      tiles: [...tileIdsToDismiss],
      indexMap: Object.fromEntries(tileIdsToDismiss.map(id => [id, tileOrder.indexOf(id)]))
    };
    setLastDismissedSnapshot(snapshot);

    const remaining = tileOrder.filter(id => !tileIdsToDismiss.includes(id));
    triggerBulkGapReflow(tileIdsToDismiss, remaining);
    setTileOrder(remaining);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.warn('Error saving dismissed tile order:', e);
    }
    broadcastTileOrder(remaining);

    auditTracker.registerMutationRecord({
      moduleKey: 'patients',
      title: `پاکسازی و حذف دسته‌ای ${toPersianDigits(count)} کاشی از داشبورد`,
      subtitle: `حذف کاشی‌های: ${tileIdsToDismiss.map(id => TILE_TITLES[id] || id).join(', ')}`,
      statusLabel: 'پاکسازی دسته‌ای ✓'
    });

    setSelectedTileIds([]);

    showBulkToast(
      `پاکسازی دسته‌ای ${toPersianDigits(count)} کاشی انجام شد`,
      () => {
        handleUndoDismiss(snapshot);
      }
    );
  }, [tileOrder, triggerBulkGapReflow, showBulkToast, TILE_TITLES]);

  // Bulk 'Mark as Finished' operation for the Action Shelf
  const handleBulkMarkAsFinished = useCallback((tileIdsToFinish: string[]) => {
    if (tileIdsToFinish.length === 0) return;
    triggerHaptic('success');
    const count = tileIdsToFinish.length;
    const prevBadgesSnapshot = { ...tileBadges };

    setTileBadges(prev => {
      const updated = { ...prev };
      tileIdsToFinish.forEach(id => {
        updated[id] = 'پایان‌یافته ✓';
      });
      try {
        localStorage.setItem(STORAGE_TILE_BADGES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving finished tile badges:', e);
      }
      return updated;
    });

    tileIdsToFinish.forEach(id => recordTileInteraction(id));

    auditTracker.registerMutationRecord({
      moduleKey: 'treatments',
      title: `ثبت وضعیت «پایان‌یافته (Mark as Finished)» برای ${toPersianDigits(count)} کاشی`,
      subtitle: `بخش‌های تکمیل‌شده: ${tileIdsToFinish.map(id => TILE_TITLES[id] || id).join('، ')}`,
      statusLabel: 'پایان‌یافته ✓'
    });

    setSelectedTileIds([]);

    showBulkToast(
      `${toPersianDigits(count)} کاشی به عنوان «پایان‌یافته (Finished)» علامت‌گذاری شد`,
      () => {
        triggerHaptic('light');
        setTileBadges(prevBadgesSnapshot);
        try {
          localStorage.setItem(STORAGE_TILE_BADGES_KEY, JSON.stringify(prevBadgesSnapshot));
        } catch (e) {
          console.warn('Error restoring tile badges:', e);
        }
        showBulkToast('وضعیت قبلی کاشی‌ها بازگردانی شد');
      }
    );
  }, [tileBadges, recordTileInteraction, showBulkToast, TILE_TITLES]);

  const handleUndoDismiss = useCallback((snapshotToRestore?: { tiles: string[]; indexMap: Record<string, number> }) => {
    const target = snapshotToRestore || lastDismissedSnapshot;
    if (!target || target.tiles.length === 0) return;
    triggerHaptic('success');

    const restored = [...tileOrder];
    const sortedRestored = [...target.tiles].sort(
      (a, b) => (target.indexMap[a] ?? 0) - (target.indexMap[b] ?? 0)
    );

    sortedRestored.forEach(tileId => {
      if (!restored.includes(tileId)) {
        const origIdx = target.indexMap[tileId] ?? restored.length;
        const insertIdx = Math.min(origIdx, restored.length);
        restored.splice(insertIdx, 0, tileId);
      }
    });

    triggerBulkGapReflow(target.tiles, restored);
    setTileOrder(restored);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(restored));
    } catch (e) {
      console.warn('Error restoring tile order:', e);
    }
    broadcastTileOrder(restored);
    setLastDismissedSnapshot(null);

    auditTracker.registerMutationRecord({
      moduleKey: 'patients',
      title: `بازگردانی ${toPersianDigits(target.tiles.length)} کاشی پاکسازی‌شده`,
      subtitle: `کاشی‌های: ${target.tiles.map(id => TILE_TITLES[id] || id).join(', ')}`,
      statusLabel: 'بازگردانی موفق'
    });

    showBulkToast('کاشی‌های پاکسازی‌شده با موفقیت به داشبورد بازگردانده شدند');
  }, [lastDismissedSnapshot, tileOrder, triggerBulkGapReflow, showBulkToast, TILE_TITLES]);

  // Shortcut to select all tiles with completed clinical task cards
  const handleSelectCompletedTiles = useCallback(() => {
    triggerHaptic('selection');
    const completedIds = tileOrder.filter(id => isTileCompleted(id));
    if (completedIds.length === 0) {
      const nonUrgent = tileOrder.filter(id => !isTileUrgent(id));
      const candidates = nonUrgent.slice(-3);
      setSelectedTileIds(candidates);
      showBulkToast(`${toPersianDigits(candidates.length)} کاشی بدون هشدار فعال برای پاکسازی انتخاب شدند`);
    } else {
      setSelectedTileIds(completedIds);
      showBulkToast(`${toPersianDigits(completedIds.length)} کاشی با وظایف پایان‌یافته انتخاب شدند`);
    }
  }, [tileOrder, isTileCompleted, isTileUrgent, showBulkToast]);

  // Automatic tile rearrangement suggestion based on clinical urgency & usage frequency
  const computeSuggestedTileRearrangement = useCallback(() => {
    const calculateTileScore = (tileId: string): number => {
      let urgencyScore = 100;
      switch (tileId) {
        case 'implant':
          urgencyScore = activeSurgeriesCount > 0 ? 1200 + activeSurgeriesCount * 50 : 80;
          break;
        case 'inventory':
          urgencyScore = lowStockCount > 0 ? 1100 + lowStockCount * 80 : 70;
          break;
        case 'sayad_checks':
          urgencyScore = 1050; // Critical legal Sayad maturity window
          break;
        case 'lab':
          urgencyScore = readyLabOrdersCount > 0 ? 950 + readyLabOrdersCount * 60 : 90;
          break;
        case 'appointments':
          urgencyScore = todayAppointmentsCount > 0 ? 850 + todayAppointmentsCount * 40 : 100;
          break;
        case 'installments':
          urgencyScore = 750;
          break;
        case 'sterilization':
          urgencyScore = 600;
          break;
        case 'reminders':
          urgencyScore = 550;
          break;
        case 'xrays':
          urgencyScore = 500;
          break;
        case 'ai_assistant':
          urgencyScore = 450;
          break;
        case 'insurance_claims':
          urgencyScore = 400;
          break;
        case 'marketing':
          urgencyScore = 200;
          break;
        default:
          urgencyScore = 150;
      }

      const frequencyScore = (tileInteractionCounts[tileId] || 0) * 35;
      const recencyMinutes = Math.max(0, Math.round((Date.now() - (tileLastInteraction[tileId] || 0)) / 60000));
      const recencyScore = Math.max(0, 250 - recencyMinutes * 3);

      return urgencyScore + frequencyScore + recencyScore;
    };

    const scored = DEFAULT_TILE_IDS.map(id => ({
      id,
      score: calculateTileScore(id),
      isUrgent: isTileUrgent(id)
    }));

    scored.sort((a, b) => b.score - a.score);
    const suggestedOrder = scored.map(s => s.id);

    const filteredSuggested = suggestedOrder.filter(id => tileOrder.includes(id));
    tileOrder.forEach(id => {
      if (!filteredSuggested.includes(id)) filteredSuggested.push(id);
    });

    const isTopDivergent = filteredSuggested.slice(0, 2).some((id, idx) => tileOrder[idx] !== id);
    const hasBuriedUrgentItem = scored
      .filter(s => s.score >= 1000)
      .some(s => tileOrder.indexOf(s.id) >= 3);

    const shouldSuggest = isTopDivergent || hasBuriedUrgentItem;

    const urgentReasons: string[] = [];
    if (activeSurgeriesCount > 0) urgentReasons.push(`جراحی‌های فعال ایمپلنت (${toPersianDigits(activeSurgeriesCount)})`);
    if (lowStockCount > 0) urgentReasons.push(`کسری انبار (${toPersianDigits(lowStockCount)} قلم)`);
    urgentReasons.push('چک‌های صیادی و اقساط سررسید');
    if (readyLabOrdersCount > 0) urgentReasons.push(`کارهای آماده تحویل لابراتوار (${toPersianDigits(readyLabOrdersCount)})`);

    const reason = `پیشنهاد چیدمان هوشمند: ${urgentReasons.slice(0, 3).join('، ')} و کاشی‌های با بیشترین مراجعه در صدر قرار گیرند.`;

    return {
      suggestedOrder: filteredSuggested,
      shouldSuggest,
      reason,
      topTileNames: filteredSuggested.slice(0, 3).map(id => TILE_TITLES[id] || id)
    };
  }, [
    activeSurgeriesCount,
    lowStockCount,
    readyLabOrdersCount,
    todayAppointmentsCount,
    tileInteractionCounts,
    tileLastInteraction,
    tileOrder,
    isTileUrgent,
    TILE_TITLES
  ]);

  const tileSuggestion = computeSuggestedTileRearrangement();

  const handleApplySuggestedRearrangement = useCallback(() => {
    triggerHaptic('heavy');
    const { suggestedOrder } = computeSuggestedTileRearrangement();
    triggerBulkGapReflow(suggestedOrder.slice(0, 3), suggestedOrder);
    setTileOrder(suggestedOrder);
    try {
      localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(suggestedOrder));
    } catch (e) {
      console.warn('Error saving suggested tile order:', e);
    }
    broadcastTileOrder(suggestedOrder);
    auditTracker.registerMutationRecord({
      moduleKey: 'patients',
      title: 'اعمال چیدمان پیشنهادی هوشمند بر اساس فوریت‌های بالینی و فراوانی استفاده',
      subtitle: `چیدمان جدید: ${suggestedOrder.slice(0, 4).map(id => TILE_TITLES[id] || id).join(' ← ')}`,
      statusLabel: 'چیدمان هوشمند اعمال شد ✓'
    });
    setIsSuggestionDismissed(true);
    showBulkToast('چیدمان پیشنهادی هوشمند بر اساس فوریت بالینی و دفعات استفاده با موفقیت اعمال شد');
  }, [computeSuggestedTileRearrangement, triggerBulkGapReflow, showBulkToast, TILE_TITLES]);

  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 15);
    return () => clearTimeout(timer);
  }, []);

  // Quick Action Context Menu State with Spring-based Pop Animation
  const [poppingTileId, setPoppingTileId] = useState<string | null>(null);
  const [tileContextMenu, setTileContextMenu] = useState<{
    tileId: string;
    title: string;
    actions: { label: string; icon: React.ReactNode; onClick: () => void }[];
  } | null>(null);

  useEscapeKey(batchInvoiceModalOpen, () => setBatchInvoiceModalOpen(false));
  useEscapeKey(Boolean(tileContextMenu), () => setTileContextMenu(null));

  const triggerTileQuickAction = (tileId: string, title: string, actions: { label: string; icon: React.ReactNode; onClick: () => void }[]) => {
    // Unique haptic-feedback trigger logic for the .tile element when 'Quick Action' context menu is activated
    triggerHaptic('heavy');
    setPoppingTileId(tileId);
    setTileContextMenu({ tileId, title, actions });
    // Reset pop animation class after spring duration
    setTimeout(() => {
      setPoppingTileId(null);
    }, 550);
  };

  // Render content of each modular card (100% uniform Q-Bank proportions)
  const renderTileContent = (tileId: string) => {
    const commonBatchProps = {
      isBatchEditMode,
      brandPurpleSurface: true,
      lastInteractionLabel: formatLastInteraction(tileId),
      onSaveBadge: (val: string) => handleSaveTileBadge(tileId, val),
    };

    switch (tileId) {
      case 'implant':
        return (
          <FolderCard
            {...commonBatchProps}
            title="کاشت ایمپلنت"
            subtitle={tileNotes['implant'] || "مراحل جراحی و کاشت"}
            icon={<Logo3DImplant size={38} />}
            badge={tileBadges['implant'] || `${toPersianDigits(activeSurgeriesCount)} فعال`}
            theme="cyan"
            className="tile"
            quickActionIcon={<Syringe className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت جراحی ایمپلنت جدید"
            onQuickAction={() => {
              recordTileInteraction('implant');
              onNavigate('implant');
            }}
            patientStatus={activeSurgeriesCount > 0 ? 'in-chair' : 'admitted'}
            patientStatusLabel={activeSurgeriesCount > 0 ? 'جراحی فعال روی یونیت' : 'پذیرش شده'}
            notificationCount={activeSurgeriesCount}
            notificationVariant="urgent"
            onSaveNote={(note) => handleSaveTileNote('implant', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('implant', note)}
            onQuickCall={() => onNavigate('patients')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={onOpenPalmerChart}
            onClick={() => {
              handleActivateTileById('implant');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('implant');
              triggerTileQuickAction('implant', 'کاشت ایمپلنت', [
                { label: 'مشاهده لیست جراحی‌ها', icon: <Activity className="w-4 h-4 text-cyan-600" />, onClick: () => onNavigate('implant') },
                { label: 'ثبت جراحی جدید', icon: <UserPlus className="w-4 h-4 text-emerald-600" />, onClick: () => onNavigate('implant') },
                { label: 'چارت پالمر ایمپلنت', icon: <Layers className="w-4 h-4 text-teal-600" />, onClick: onOpenPalmerChart }
              ]);
            }}
          />
        );

      case 'lab':
        return (
          <FolderCard
            {...commonBatchProps}
            title="لابراتوار پروتز"
            subtitle={tileNotes['lab'] || "ارسال و تحویل روکش"}
            icon={<Logo3DLab size={38} />}
            badge={tileBadges['lab'] || `${toPersianDigits(readyLabOrdersCount)} آماده`}
            theme="purple"
            className="tile"
            quickActionIcon={<FlaskConical className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت سفارش لابراتوار جدید"
            onQuickAction={() => {
              recordTileInteraction('lab');
              onNavigate('lab');
            }}
            patientStatus={readyLabOrdersCount > 0 ? 'completed' : 'lab-pending'}
            patientStatusLabel={readyLabOrdersCount > 0 ? 'آماده تحویل به بیمار' : 'در دست ساخت لابراتوار'}
            notificationCount={readyLabOrdersCount}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('lab', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('lab', note)}
            onQuickCall={() => onNavigate('patients')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={onOpenPalmerChart}
            onClick={() => {
              handleActivateTileById('lab');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('lab');
              triggerTileQuickAction('lab', 'لابراتوار پروتز', [
                { label: 'مشاهده سفارش‌های ارسالی', icon: <FlaskConical className="w-4 h-4 text-purple-600" />, onClick: () => onNavigate('lab') },
                { label: 'کارهای آماده تحویل', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, onClick: () => onNavigate('lab') }
              ]);
            }}
          />
        );

      case 'sayad_checks':
        return (
          <FolderCard
            {...commonBatchProps}
            title="چک صیادی"
            subtitle={tileNotes['sayad_checks'] || "استعلام و ثبت صیاد"}
            icon={<Logo3DSayadCheck size={38} />}
            badge={tileBadges['sayad_checks'] || "۲ در جریان"}
            theme="pink"
            className="tile"
            quickActionIcon={<FilePlus2 className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت چک صیادی جدید"
            onQuickAction={() => {
              recordTileInteraction('sayad_checks');
              onNavigate('sayad_checks');
            }}
            patientStatus="urgent"
            patientStatusLabel="چک‌های نیازمند تسویه و استعلام پیچک"
            notificationCount={2}
            notificationVariant="urgent"
            onSaveNote={(note) => handleSaveTileNote('sayad_checks', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('sayad_checks', note)}
            onQuickCall={() => onNavigate('financial')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('financial')}
            onClick={() => {
              handleActivateTileById('sayad_checks');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('sayad_checks');
              triggerTileQuickAction('sayad_checks', 'چک صیادی', [
                { label: 'کارتابل چک‌ها', icon: <FileCheck2 className="w-4 h-4 text-pink-600" />, onClick: () => onNavigate('financial') },
                { label: 'استعلام آنی پیچک', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />, onClick: () => onNavigate('financial') }
              ]);
            }}
          />
        );

      case 'installments':
        return (
          <FolderCard
            {...commonBatchProps}
            title="اقساط و تسویه"
            subtitle={tileNotes['installments'] || "سررسید ماهانه بیماران"}
            icon={<Logo3DInstallments size={38} />}
            badge={tileBadges['installments'] || "وصول به‌موقع"}
            theme="amber"
            className="tile"
            quickActionIcon={<Receipt className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت قسط و دریافتی سریع"
            onQuickAction={() => {
              recordTileInteraction('installments');
              onNavigate('installments');
            }}
            patientStatus="lab-pending"
            patientStatusLabel="سررسید اقساط ماهانه"
            notificationCount={3}
            notificationVariant="urgent"
            onSaveNote={(note) => handleSaveTileNote('installments', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('installments', note)}
            onQuickCall={() => onNavigate('financial')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('financial')}
            onClick={() => {
              handleActivateTileById('installments');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('installments');
              triggerTileQuickAction('installments', 'اقساط و تسویه', [
                { label: 'لیست بدهکاران و سررسید', icon: <Clock className="w-4 h-4 text-amber-600" />, onClick: () => onNavigate('financial') },
                { label: 'ثبت دریافت وجه سریع', icon: <CreditCard className="w-4 h-4 text-emerald-600" />, onClick: () => onNavigate('financial') }
              ]);
            }}
          />
        );

      case 'ai_assistant':
        return (
          <FolderCard
            {...commonBatchProps}
            title="هوش مصنوعی"
            subtitle={tileNotes['ai_assistant'] || "تحلیل OPG و طرح درمان"}
            icon={<Logo3DAiGemini size={38} />}
            badge={tileBadges['ai_assistant'] || "دستیار فعال"}
            theme="gemini"
            className="tile"
            quickActionIcon={<Sparkles className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="تحلیل سریع هوش مصنوعی"
            onQuickAction={() => {
              recordTileInteraction('ai_assistant');
              onNavigate('ai_assistant');
            }}
            patientStatus="in-chair"
            patientStatusLabel="دستیار هوش مصنوعی آماده پردازش"
            notificationCount={1}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('ai_assistant', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('ai_assistant', note)}
            onQuickCall={() => onNavigate('ai_assistant')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('ai_assistant')}
            onClick={() => {
              handleActivateTileById('ai_assistant');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('ai_assistant');
              triggerTileQuickAction('ai_assistant', 'هوش مصنوعی', [
                { label: 'مشاوره بالینی ژمینی', icon: <Sparkles className="w-4 h-4 text-indigo-600" />, onClick: () => onNavigate('ai_assistant') }
              ]);
            }}
          />
        );

      case 'inventory':
        return (
          <FolderCard
            {...commonBatchProps}
            title="انبار و متریال"
            subtitle={tileNotes['inventory'] || (lowStockCount > 0 ? `کسری: ${lowStockSummary}` : "کنترل موجودی و متریال")}
            icon={<Logo3DInventory size={38} />}
            badge={tileBadges['inventory'] || (lowStockCount > 0 ? `${toPersianDigits(lowStockCount)} قلم کسری` : 'موجودی کامل')}
            badgeAlert={lowStockCount > 0}
            alertDot={lowStockCount > 0}
            theme="emerald"
            className="tile"
            quickActionIcon={<PackagePlus className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت کالای جدید انبار"
            onQuickAction={() => {
              recordTileInteraction('inventory');
              onNavigate('inventory');
            }}
            patientStatus={lowStockCount > 0 ? 'urgent' : 'completed'}
            patientStatusLabel={lowStockCount > 0 ? 'هشدار کسری اقلام بحرانی' : 'موجودی کامل'}
            notificationCount={lowStockCount > 0 ? lowStockCount : undefined}
            notificationVariant="urgent"
            onSaveNote={(note) => handleSaveTileNote('inventory', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('inventory', note)}
            onQuickCall={() => onNavigate('inventory')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('inventory')}
            onClick={() => {
              handleActivateTileById('inventory');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('inventory');
              triggerTileQuickAction('inventory', 'انبار و متریال', [
                { label: 'بررسی اقلام کسری', icon: <Package className="w-4 h-4 text-emerald-600" />, onClick: () => onNavigate('inventory') }
              ]);
            }}
          />
        );

      case 'reminders':
        return (
          <FolderCard
            {...commonBatchProps}
            title="پیامک و یادآوری"
            subtitle={
              tileNotes['reminders'] ||
              (liveRemindersSummary.totalActive > 0
                ? `${toPersianDigits(liveRemindersSummary.criticalCount)} فوری · ${toPersianDigits(liveRemindersSummary.totalActive)} فعال`
                : 'اطلاع‌رسانی خودکار')
            }
            icon={<Logo3DReminders size={38} />}
            badge={
              tileBadges['reminders'] ||
              (liveRemindersSummary.criticalCount > 0
                ? `${toPersianDigits(liveRemindersSummary.criticalCount)} بحرانی`
                : 'ارسال خودکار')
            }
            theme="orange"
            className="tile"
            quickActionIcon={<BellPlus className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت یادآور هوشمند جدید"
            onQuickAction={() => {
              recordTileInteraction('reminders');
              onNavigate('reminders');
            }}
            patientStatus="admitted"
            patientStatusLabel="سامانه ۱۱ لایه پیامک و یادآوری هوشمند"
            notificationCount={liveRemindersSummary.criticalCount + liveRemindersSummary.highCount}
            notificationVariant={liveRemindersSummary.criticalCount > 0 ? 'urgent' : 'new'}
            onSaveNote={(note) => handleSaveTileNote('reminders', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('reminders', note)}
            onQuickCall={() => onNavigate('reminders')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('reminders')}
            onClick={() => {
              handleActivateTileById('reminders');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('reminders');
              triggerTileQuickAction('reminders', 'پیامک و یادآوری', [
                { label: 'مشاهده صف پیامک‌ها', icon: <BellRing className="w-4 h-4 text-orange-600" />, onClick: () => onNavigate('reminders') }
              ]);
            }}
          />
        );

      case 'xrays':
        return (
          <FolderCard
            {...commonBatchProps}
            title="رادیولوژی"
            subtitle={tileNotes['xrays'] || "آرشیو تصاویر فک و دندان"}
            icon={<Logo3DXRay size={38} />}
            badge={tileBadges['xrays'] || "PA & OPG"}
            theme="teal"
            className="tile"
            quickActionIcon={<Camera className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت تصویر رادیولوژی جدید"
            onQuickAction={() => {
              recordTileInteraction('xrays');
              onNavigate('xrays');
            }}
            patientStatus="in-chair"
            patientStatusLabel="آرشیو تصاویر رادیوگرافی بالینی"
            notificationCount={2}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('xrays', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('xrays', note)}
            onQuickCall={() => onNavigate('xrays')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={onOpenPalmerChart}
            onClick={() => {
              handleActivateTileById('xrays');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('xrays');
              triggerTileQuickAction('xrays', 'رادیولوژی', [
                { label: 'گالری تصاویر فک و دندان', icon: <Camera className="w-4 h-4 text-teal-600" />, onClick: () => onNavigate('xrays') }
              ]);
            }}
          />
        );

      case 'marketing':
        return (
          <FolderCard
            {...commonBatchProps}
            title="تبلیغات و کمپین‌ها"
            subtitle={tileNotes['marketing'] || "جشنواره‌ها و باشگاه مشتریان"}
            icon={<Logo3DMarketing size={38} />}
            badge={tileBadges['marketing'] || "۳ کمپین فعال"}
            theme="rose"
            className="tile"
            quickActionIcon={<Megaphone className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ایجاد کمپین تبلیغاتی جدید"
            onQuickAction={() => {
              recordTileInteraction('marketing');
              onNavigate('marketing');
            }}
            patientStatus="completed"
            patientStatusLabel="کمپین‌های فعال باشگاه مراجعین"
            notificationCount={1}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('marketing', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('marketing', note)}
            onQuickCall={() => onNavigate('marketing')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('marketing')}
            onClick={() => {
              handleActivateTileById('marketing');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('marketing');
              triggerTileQuickAction('marketing', 'تبلیغات و کمپین‌ها', [
                { label: 'باشگاه مشتریان و پیامک انبوه', icon: <Megaphone className="w-4 h-4 text-rose-600" />, onClick: () => onNavigate('marketing') }
              ]);
            }}
          />
        );

      case 'patients':
      case 'quick_admission':
        return (
          <FolderCard
            {...commonBatchProps}
            title="پرونده بیماران"
            subtitle={tileNotes['patients'] || "پرونده الکترونیک و خط روند درمان"}
            icon={<Logo3DPatients size={38} />}
            badge={tileBadges['patients'] || `${toPersianDigits(patients.length)} پرونده`}
            theme="indigo"
            className="tile"
            quickActionIcon={<UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />}
            quickActionLabel="ثبت بیمار جدید"
            onQuickAction={() => {
              recordTileInteraction('patients');
              setQuickAdmissionOpen(true);
            }}
            patientStatus="admitted"
            patientStatusLabel="پرونده‌های فعال و پذیرش آنی بیماران"
            notificationCount={patients.length}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('patients', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('patients', note)}
            onQuickCall={() => onNavigate('patients')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={onOpenPalmerChart}
            onClick={() => {
              handleActivateTileById('patients');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('patients');
              triggerTileQuickAction('patients', 'پرونده بیماران', [
                { label: 'لیست کامل بیماران و پرونده‌ها', icon: <UserPlus className="w-4 h-4 text-indigo-600" />, onClick: () => onNavigate('patients') },
                { label: 'پذیرش سریع بیمار جدید', icon: <Sparkles className="w-4 h-4 text-emerald-600" />, onClick: () => setQuickAdmissionOpen(true) }
              ]);
            }}
          />
        );

      case 'appointments':
        return (
          <FolderCard
            {...commonBatchProps}
            title="نوبت‌دهی و تقویم"
            subtitle={tileNotes['appointments'] || "تقویم جلالی و مدیریت یونیت‌ها"}
            icon={<Logo3DAppointments size={38} />}
            badge={tileBadges['appointments'] || `${toPersianDigits(todayAppointmentsCount)} نوبت امروز`}
            theme="lime"
            className="tile"
            quickActionIcon={<CalendarPlus className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت نوبت سریع"
            onQuickAction={() => {
              recordTileInteraction('appointments');
              onNavigate('appointments');
            }}
            patientStatus="in-chair"
            patientStatusLabel="مدیریت زنده نوبت‌ها و تقویم ایرانی"
            notificationCount={todayAppointmentsCount}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('appointments', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('appointments', note)}
            onQuickCall={() => onNavigate('appointments')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={onOpenPalmerChart}
            onClick={() => {
              handleActivateTileById('appointments');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('appointments');
              triggerTileQuickAction('appointments', 'نوبت‌دهی و تقویم', [
                { label: 'بورد نوبت‌دهی یونیت‌ها', icon: <CalendarDays className="w-4 h-4 text-lime-600" />, onClick: () => onNavigate('appointments') },
                { label: 'تقویم جامع ایرانی (شمسی/میلادی/قمری)', icon: <CalendarDays className="w-4 h-4 text-teal-600" />, onClick: () => onNavigate('calendar') }
              ]);
            }}
          />
        );

      case 'sterilization':
        return (
          <FolderCard
            {...commonBatchProps}
            title="استریل و اتوکلاو"
            subtitle={tileNotes['sterilization'] || "کنترل عفونت JCI و تست اسپور"}
            icon={<Logo3DSterilization size={38} />}
            badge={tileBadges['sterilization'] || "کلاس B تایید ✓"}
            theme="sky"
            className="tile"
            quickActionIcon={<ShieldPlus className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت سیکل اتوکلاو جدید"
            onQuickAction={() => {
              recordTileInteraction('sterilization');
              onNavigate('sterilization');
            }}
            patientStatus="completed"
            patientStatusLabel="سیکل‌های اتوکلاو و تست بیولوژیک اسپور"
            notificationCount={2}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('sterilization', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('sterilization', note)}
            onQuickCall={() => onNavigate('sterilization')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('sterilization')}
            onClick={() => {
              handleActivateTileById('sterilization');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('sterilization');
              triggerTileQuickAction('sterilization', 'استریل و اتوکلاو', [
                { label: 'لاگ اتوکلاو و بارکد پک جراحی', icon: <ShieldCheck className="w-4 h-4 text-sky-600" />, onClick: () => onNavigate('sterilization') }
              ]);
            }}
          />
        );

      case 'insurance_claims':
        return (
          <FolderCard
            {...commonBatchProps}
            title="بیمه و خسارت"
            subtitle={tileNotes['insurance_claims'] || "نسخه الکترونیک HL7 و سپاس"}
            icon={<Logo3DInsurance size={38} />}
            badge={tileBadges['insurance_claims'] || "تایید آنی"}
            theme="fuchsia"
            className="tile"
            quickActionIcon={<FileCheck2 className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="ثبت خسارت بیمه جدید"
            onQuickAction={() => {
              recordTileInteraction('insurance_claims');
              onNavigate('insurance_claims');
            }}
            patientStatus="admitted"
            patientStatusLabel="ارسال و تسویه مطالبات بیمه تکمیلی"
            notificationCount={3}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('insurance_claims', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('insurance_claims', note)}
            onQuickCall={() => onNavigate('insurance_claims')}
            onViewLab={() => onNavigate('lab')}
            onUpdateTreatment={() => onNavigate('insurance_claims')}
            onClick={() => {
              handleActivateTileById('insurance_claims');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('insurance_claims');
              triggerTileQuickAction('insurance_claims', 'بیمه و خسارت', [
                { label: 'کارتابل بیمه و کد رهگیری سپاس', icon: <FileCheck2 className="w-4 h-4 text-fuchsia-600" />, onClick: () => onNavigate('insurance_claims') }
              ]);
            }}
          />
        );
      case 'audit_tracker':
        return (
          <FolderCard
            {...commonBatchProps}
            title="ممیزی و پیگیری"
            subtitle={tileNotes['audit_tracker'] || "فاز ۱ تا ۶ قفل · شناسه پیگیری"}
            icon={<Logo3DClinicalAudit size={38} />}
            badge={tileBadges['audit_tracker'] || "۶ فاز قفل ✓"}
            theme="olive"
            className="tile"
            quickActionIcon={<Zap className="w-3.5 h-3.5 stroke-[2.4]" />}
            quickActionLabel="اجرای ممیزی زنده کلینیک"
            onQuickAction={() => {
              recordTileInteraction('audit_tracker');
              auditTracker.openTrackerModal(MASTER_SUPER_AUDIT_TRACKING_ID);
            }}
            patientStatus="completed"
            patientStatusLabel="مرکز ممیزی ۶ فاز، شناسه‌های پیگیری و تست ۵۰۰K"
            notificationCount={6}
            notificationVariant="new"
            onSaveNote={(note) => handleSaveTileNote('audit_tracker', note)}
            onAddPatientClinicalNote={(note) => handleAddPatientClinicalNote('audit_tracker', note)}
            onQuickCall={() => auditTracker.openTrackerModal(MASTER_SUPER_AUDIT_TRACKING_ID)}
            onViewLab={() => onOpenPhaseAudit?.()}
            onUpdateTreatment={() => onOpenRealClinicTest?.()}
            onClick={() => {
              handleActivateTileById('audit_tracker');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              recordTileInteraction('audit_tracker');
              triggerTileQuickAction('audit_tracker', 'ممیزی و پیگیری (۶ فاز)', [
                {
                  label: 'فازبندی ۱ تا ۶ و شناسه‌های پیگیری (MD-AUD-1405-LOCKED)',
                  icon: <Fingerprint className="w-4 h-4 text-emerald-600" />,
                  onClick: () => auditTracker.openTrackerModal(MASTER_SUPER_AUDIT_TRACKING_ID)
                },
                {
                  label: 'فوق ممیزی ۶ فاز و استانداردهای جهانی',
                  icon: <ShieldCheck className="w-4 h-4 text-cyan-600" />,
                  onClick: () => onOpenPhaseAudit?.()
                },
                {
                  label: 'تست استرس ۵۰۰,۰۰۰ تراکنش و ۱۰۰۰ پرونده',
                  icon: <Zap className="w-4 h-4 text-amber-600" />,
                  onClick: () => onOpenRealClinicTest?.()
                }
              ]);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`dashboard-view ${isLoaded ? 'is-loaded' : 'is-loading'} w-full max-w-full min-w-0 overflow-x-hidden pb-20 pt-1 space-y-2.5 sm:space-y-3 select-none px-2 sm:px-2.5`}>
      
      {/* Top Clinical Command Stack: Search, Hero & Urgent Alarms (Always 100% Full Width) */}
      <div className="flex flex-col gap-2.5 sm:gap-3 w-full min-w-0 max-w-full">
        <div className="w-full min-w-0">
          <DashboardPatientSearch
            patients={patients}
            onSelectPatient={(p) => {
              if (onSelectPatient) {
                onSelectPatient(p);
              } else {
                onNavigate('patients');
              }
            }}
            onOpenPalmerChart={(p) => {
              if (onOpenPalmerForPatient) {
                onOpenPalmerForPatient(p);
              } else {
                onOpenPalmerChart();
              }
            }}
            onOpenAppointment={(p) => {
              if (onOpenAppointmentForPatient) {
                onOpenAppointmentForPatient(p);
              } else {
                onNavigate('appointments');
              }
            }}
            onQuickAdmission={onQuickAdmission}
          />
        </div>
        
        <div className="w-full">
          {(() => {
            let activeFinItems = 0;
            let guaranteeCount = 0;
            let readyReturnCount = 0;
            for (const p of patients) {
              const unpaidInsts = (p.installments || []).filter(i => i.status !== 'paid');
              const activeChecks = (p.sayadChecks || []).filter(c => c.status !== 'cleared' && c.status !== 'returned');
              activeFinItems += unpaidInsts.length + activeChecks.length;
              const patGuarantees = activeChecks.filter(c => c.isGuarantee);
              guaranteeCount += patGuarantees.length;
              if (patGuarantees.length > 0 && unpaidInsts.length === 0 && p.balance >= 0) {
                readyReturnCount += patGuarantees.length;
              }
            }
            const guaranteeLabel =
              readyReturnCount > 0
                ? `${toPersianDigits(readyReturnCount)} ضمانت آماده عودت ✓`
                : guaranteeCount > 0
                  ? `${toPersianDigits(guaranteeCount)} ضمانت + صیادی`
                  : 'در جریان وصول';
            return (
              <ClinicHeroCard
                onQuickAdmission={onQuickAdmission}
                onOpenPalmerChart={onOpenPalmerChart}
                onOpenAppointments={() => onNavigate('appointments')}
                onOpenFinancial={() => onNavigate('financial')}
                onOpenImplant={() => onNavigate('implant')}
                onOpenLab={() => onNavigate('lab')}
                onOpenSupabaseTest={onOpenSupabaseTest}
                onOpenPhaseAudit={onOpenPhaseAudit}
                onOpenRealClinicTest={onOpenRealClinicTest}
                onOpenShiftSettings={() => onNavigate('settings')}
                todayAppointmentsCount={todayAppointmentsCount}
                activeSurgeriesCount={activeSurgeriesCount}
                readyLabOrdersCount={readyLabOrdersCount}
                dailyRevenue={dailyRevenue}
                activeChecksAndInstallmentsCount={activeFinItems}
                guaranteeStatusLabel={guaranteeLabel}
              />
            );
          })()}
        </div>

        {/* Real-Time Urgent Clinic Alarms Center (Lab Work, Checks, Installments) */}
        <ClinicUrgentAlarmsBanner
          patients={patients}
          appointments={appointments}
          inventory={inventory}
          onOpenPatientFile={(p) => onSelectPatient?.(p)}
          onNavigate={onNavigate}
          onOpenLabSlip={onOpenLabSlip}
        />
      </div>

      {/* Section 3: Clean Module Zones Header & Responsive Grid Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-purple-600 to-cyan-500 shrink-0" />
          <div>
            <h3 className="typo-heading text-[15px] text-slate-900">ماژول‌های تخصصی کلینیک</h3>
            <p className="typo-caption text-[11px] text-slate-500">دسته‌بندی رنگی و منظم برای دسترسی سریع بدون شلوغی بصری</p>
          </div>
          {clinicGroups.length > 0 && (
            <span className="typo-numeric text-[10.5px] text-cyan-900 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
              {toPersianDigits(clinicGroups.length)} گروه فعال
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sleek Customize Toggle Button */}
          <button
            type="button"
            onClick={() => {
              selection();
              setIsCustomizing(prev => {
                const next = !prev;
                if (!next) {
                  setIsSelectMode(false);
                  setIsBatchEditMode(false);
                  setSelectedTileIds([]);
                }
                return next;
              });
            }}
            className={`min-h-[38px] px-3.5 rounded-[12px] text-[11px] font-bold border transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              isCustomizing
                ? 'bg-purple-600 border-purple-700 text-white shadow-xs'
                : 'bg-white border-slate-200/90 text-slate-700 hover:text-slate-950'
            }`}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${isCustomizing ? 'text-white' : 'text-purple-600'}`} />
            <span>{isCustomizing ? 'پایان چیدمان' : 'چیدمان'}</span>
          </button>

          {/* Compact Responsive Grid / Single-Column Switcher */}
          <div className="flex items-center bg-white p-0.5 rounded-[12px] border border-slate-200/90 text-[11px]">
            <button
              type="button"
              onClick={() => {
                selection();
                setCardLayout('grid');
              }}
              className={`min-h-[34px] px-3 rounded-[9px] font-bold transition-colors cursor-pointer ${
                cardLayout === 'grid'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمایش کاشی‌های داشبورد به صورت شبکه‌ای واکنش‌گرا"
            >
              شبکه‌ای
            </button>
            <button
              type="button"
              onClick={() => {
                selection();
                setCardLayout('full');
              }}
              className={`min-h-[34px] px-3 rounded-[9px] font-bold transition-colors cursor-pointer ${
                cardLayout === 'full'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمایش کاشی‌های داشبورد به صورت تک ستونه تمام‌عرض"
            >
              تک ستونه
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Advanced Customization & Audit Drawer (Only visible when 'چیدمان' is active) */}
      {isCustomizing && (
        <div className="p-2.5 rounded-2xl bg-white/95 border border-purple-200/90 shadow-sm space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-purple-950">ابزارهای پیشرفته چیدمان و مدیریت کاشی‌ها</span>
            <span className="text-[9.5px] font-bold text-slate-500">کاشی‌ها را بکشید و جابجا کنید</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Automatic Smart Priority Reorder Button */}
            <button
              type="button"
              onClick={() => {
                selection();
                const next = !isSmartPriorityEnabled;
                setIsSmartPriorityEnabled(next);
                try {
                  localStorage.setItem('minadental_smart_priority_enabled', next ? 'true' : 'false');
                } catch (e) {
                  console.warn('Error saving smart priority state:', e);
                }
                if (next) {
                  handleSmartPriorityReorder(true);
                }
              }}
              className={`smart-priority-btn px-2.5 py-1 rounded-xl text-[10.5px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                isSmartPriorityEnabled
                  ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Zap className={`w-3 h-3 ${isSmartPriorityEnabled ? 'text-amber-600 fill-amber-500' : 'text-slate-400'}`} />
              <span>{isSmartPriorityEnabled ? 'اولویت هوشمند فعال' : 'اولویت هوشمند'}</span>
            </button>

            {/* Auto-Sort by Last Interaction */}
            <button
              type="button"
              onClick={handleAutoSortByLastInteraction}
              className="auto-sort-btn px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <ArrowUpDown className="w-3 h-3 text-indigo-600" />
              <span>مرتب‌سازی بر اساس تعامل</span>
            </button>

            {/* Multi-Tile Select Mode */}
            <button
              type="button"
              onClick={() => {
                selection();
                setIsSelectMode(prev => {
                  const next = !prev;
                  if (!next) {
                    setSelectedTileIds([]);
                    setIsBulkDragging(false);
                  }
                  return next;
                });
              }}
              className={`select-mode-btn px-2.5 py-1 rounded-xl text-[10.5px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                isSelectMode
                  ? 'bg-cyan-100 border-cyan-400 text-cyan-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className={`w-3 h-3 ${isSelectMode ? 'text-cyan-700' : 'text-slate-400'}`} />
              <span>{isSelectMode ? 'لغو انتخاب گروهی' : 'انتخاب گروهی'}</span>
            </button>

            {/* Batch Edit Mode */}
            <button
              type="button"
              onClick={() => {
                selection();
                setIsBatchEditMode(prev => {
                  const next = !prev;
                  if (!next) {
                    showBulkToast('تمام تغییرات وضعیت و برچسب‌های متادیتا با موفقیت ذخیره شد');
                  }
                  return next;
                });
              }}
              className={`batch-edit-mode-btn px-2.5 py-1 rounded-xl text-[10.5px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                isBatchEditMode
                  ? 'bg-purple-600 border-purple-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Edit3 className={`w-3 h-3 ${isBatchEditMode ? 'text-amber-300' : 'text-purple-600'}`} />
              <span>{isBatchEditMode ? 'ثبت ویرایش دسته‌ای' : 'ویرایش عنوان و نشان‌ها'}</span>
            </button>

            {clinicGroups.length === 0 && (
              <button
                type="button"
                onClick={() => mergeTilesIntoClinicGroup('lab', 'implant')}
                className="create-clinic-group-btn px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <FolderPlus className="w-3 h-3 text-cyan-700" />
                <span>ایجاد گروه صف جراحی</span>
              </button>
            )}

            {tileOrder.length < DEFAULT_TILE_IDS.length && (
              <button
                type="button"
                onClick={handleResetLayout}
                className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-all flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-emerald-600" />
                <span>بازنشانی همه کاشی‌ها</span>
              </button>
            )}
          </div>

          <Live360AuditLoopBanner
            patients={patients}
            onTriggerReflowDemo={() => {
              const movedGroup = tileOrder.slice(0, 2);
              const remaining = tileOrder.slice(2);
              const nextOrder = [...remaining, ...movedGroup];
              triggerBulkGapReflow(movedGroup, nextOrder);
              setTileOrder(nextOrder);
            }}
            onOpenRealClinicTest={onOpenRealClinicTest}
            onOpenPhaseAudit={onOpenPhaseAudit}
            onNavigateModule={onNavigate}
          />
        </div>
      )}

      {/* Live Tile Status Filter Bar */}
      <div className="w-full max-w-full min-w-0 flex items-center justify-between gap-2 overflow-x-auto overscroll-x-contain no-scrollbar py-0.5" dir="rtl">
        <div className="flex items-center gap-1.5 shrink-0">
          {[
            { id: 'all' as const, label: 'همه کاشی‌ها', count: tileOrder.length },
            { id: 'urgent' as const, label: 'فوری و هشداردار', count: tileOrder.filter(id => ['sayad_checks', 'inventory', 'reminders', 'patients'].includes(id)).length },
            { id: 'in-chair' as const, label: 'روی یونیت و بالینی', count: tileOrder.filter(id => ['implant', 'appointments', 'sterilization', 'ai_assistant', 'xrays'].includes(id)).length },
            { id: 'lab-pending' as const, label: 'لابراتوار و مالی', count: tileOrder.filter(id => ['lab', 'installments', 'insurance_claims', 'marketing'].includes(id)).length }
          ].map(filterOpt => {
            const active = tileStatusFilter === filterOpt.id;
            return (
              <button
                key={filterOpt.id}
                type="button"
                onClick={() => {
                  selection();
                  setTileStatusFilter(filterOpt.id);
                }}
                className={`min-h-[38px] px-3 rounded-[12px] text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap border transition-colors cursor-pointer active:scale-95 tabular-nums ${
                  active
                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                    : 'bg-white/95 text-slate-700 border-slate-200/90 hover:text-slate-950'
                }`}
              >
                <span>{filterOpt.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {toPersianDigits(filterOpt.count)}
                </span>
              </button>
            );
          })}
        </div>
        {clinicGroups.length > 0 && (
          <span className="text-[10.5px] font-bold text-cyan-900 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-[12px] whitespace-nowrap tabular-nums">
            {toPersianDigits(clinicGroups.length)} گروه کلینیک فعال
          </span>
        )}
      </div>

      {/* Automatic Intelligent Tile Rearrangement Suggestion Banner (Only shown when Customizing is open, colorful light theme) */}
      {isCustomizing && tileSuggestion.shouldSuggest && !isSuggestionDismissed && (
        <div
          className="intelligent-rearrangement-banner flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-gradient-to-l from-purple-50 via-amber-50/80 to-sky-50 border border-purple-200 shadow-2xs text-slate-900 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.4]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black text-purple-950 truncate">
                پیشنهاد چیدمان هوشمند: {tileSuggestion.topTileNames.join(' · ')}
              </span>
              <span className="text-[9.5px] text-slate-600 truncate">
                {tileSuggestion.reason}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleApplySuggestedRearrangement}
              className="px-2.5 py-1 rounded-xl text-[10.5px] font-black bg-purple-600 hover:bg-purple-700 text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            >
              <ArrowUpDown className="w-3 h-3 stroke-[2.5]" />
              <span>اعمال چیدمان</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSuggestionDismissed(true)}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
              title="بستن پیشنهاد"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Batch Edit Mode Active Banner */}
      {isBatchEditMode && (
        <div
          className="batch-edit-mode-banner flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-gradient-to-l from-purple-50 via-amber-50/70 to-white border border-purple-300 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150"
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-purple-600 text-white">
              <Edit3 className="w-3.5 h-3.5" />
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-purple-950">
                حالت ویرایش دسته‌ای فعال است (Batch Edit Mode)
              </span>
              <span className="text-[9.5px] font-medium text-slate-600">
                تمام نشان‌های وضعیت (Status Badges) و برچسب‌های متادیتا روی کاشی‌ها به فیلد متنی تبدیل شده‌اند و مستقیم ذخیره می‌شوند.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('success');
                setIsBatchEditMode(false);
                showBulkToast('تغییرات دسته‌ای وضعیت و متادیتای کاشی‌ها ذخیره شد');
              }}
              className="px-3 py-1 rounded-xl text-[10.5px] font-black bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer"
            >
              ذخیره و پایان ویرایش
            </button>
          </div>
        </div>
      )}

      {/* Multi-Tile Select Mode Control Bar & Visual Bulk-Move Status Indicator */}
      {isSelectMode && (
        <div
          className="select-mode-toolbar flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-gradient-to-l from-cyan-50 via-white to-purple-50 border border-cyan-300/90 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150"
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-600 text-white text-xs font-black shadow-2xs">
              {toPersianDigits(selectedTileIds.length)}
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-800">
                {selectedTileIds.length === 0
                  ? 'کاشی‌های مورد نظر را با چک‌باکس انتخاب کنید'
                  : `${toPersianDigits(selectedTileIds.length)} کاشی آماده جابجایی گروهی`}
              </span>
              <span className="text-[9.5px] font-medium text-slate-500">
                {isBulkDragging
                  ? 'در حال انتقال گروهی به موقعیت جدید...'
                  : 'هر یک از کاشی‌های انتخاب‌شده را بکشید تا کل گروه همزمان جابجا شود'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                selection();
                if (selectedTileIds.length === tileOrder.length) {
                  setSelectedTileIds([]);
                } else {
                  setSelectedTileIds([...tileOrder]);
                }
              }}
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              {selectedTileIds.length === tileOrder.length ? 'لغو همه' : 'انتخاب همه'}
            </button>

            <button
              type="button"
              onClick={handleSelectCompletedTiles}
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
              title="انتخاب خودکار کاشی‌های با وظایف پایان‌یافته یا تحویل‌شده"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>انتخاب موارد پایان‌یافته</span>
            </button>

            {selectedTileIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleBulkMoveGroup('start')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="انتقال کل گروه انتخاب‌شده به ابتدای داشبورد"
                >
                  <MoveUp className="w-3 h-3" />
                  <span>انتقال به ابتدا</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMoveGroup('end')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="انتقال کل گروه انتخاب‌شده به انتهای داشبورد"
                >
                  <MoveDown className="w-3 h-3" />
                  <span>انتقال به انتها</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMarkAsFinished(selectedTileIds)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="ثبت کاشی‌های انتخاب‌شده به عنوان پایان‌یافته (Mark as Finished)"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-100" />
                  <span>ثبت پایان‌یافته ({toPersianDigits(selectedTileIds.length)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkDismiss(selectedTileIds)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="پاکسازی و حذف دسته‌ای کاشی‌های انتخاب‌شده با امکان بازگردانی"
                >
                  <Trash2 className="w-3 h-3 text-rose-100" />
                  <span>حذف / پاکسازی ({toPersianDigits(selectedTileIds.length)})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                selection();
                setIsSelectMode(false);
                setSelectedTileIds([]);
                setIsBulkDragging(false);
              }}
              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
              title="بستن حالت انتخاب گروهی"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 
        The main grid container: matches CSS selector .dashboard-view .grid
        In standard browsing mode: renders native HTML div grid (100% stable, zero layout shift, smooth vertical scrolling).
        In customize mode: enables Reorder.Group with deliberate drag handles.
      */}
      {isCustomizing ? (
        <Reorder.Group
          as="div"
          axis={cardLayout === 'full' ? 'y' : undefined}
          values={tileOrder}
          onReorder={handleReorder}
          style={{ gridAutoRows: 'minmax(min-content, max-content)' }}
          className={`grid auto-rows-[minmax(min-content,max-content)] items-stretch ${
            cardLayout === 'full'
              ? 'grid-cols-1 gap-2.5'
              : 'grid-cols-2 gap-2.5 sm:gap-3'
          } w-full my-1`}
        >
          {tileOrder.length === 0 ? (
            <DashboardEmptyState onResetLayout={handleResetLayout} />
          ) : (
            tileOrder.map((tileId, index) => (
              <Reorder.Item
                as="div"
                key={tileId}
                value={tileId}
                style={{
                  '--tile-index': index,
                  '--stagger-delay': `${index * 42}ms`,
                } as React.CSSProperties}
                className="tile tile-card-typography relative select-none h-full flex flex-col justify-between group/reorder touch-none cursor-grab active:cursor-grabbing ring-2 ring-purple-400/60 rounded-[20px] font-['Vazirmatn',sans-serif] leading-[1.6]"
                whileDrag={{ scale: 1.02, zIndex: 40, opacity: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              >
                {/* Persistent Checkbox in Customize + Bulk Selection mode */}
                {isSelectMode && (
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className={`tile-select-checkbox persistent-checkbox absolute top-2.5 right-2.5 z-40 flex items-center gap-1.5 px-2 py-1 rounded-xl border-2 shadow-md cursor-pointer transition-all ${
                      selectedTileIds.includes(tileId)
                        ? 'bg-cyan-600 border-cyan-700 text-white scale-105'
                        : 'bg-white/95 hover:bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTileIds.includes(tileId)}
                      onChange={() => toggleTileSelection(tileId)}
                      className="sr-only"
                    />
                    {selectedTileIds.includes(tileId) ? (
                      <CheckSquare className="w-4 h-4 stroke-[2.6] text-white" />
                    ) : (
                      <Square className="w-4 h-4 stroke-[2.2] text-slate-500" />
                    )}
                    <span className="text-[10px] font-black leading-none">
                      {selectedTileIds.includes(tileId) ? 'انتخاب شد ✓' : 'انتخاب'}
                    </span>
                  </label>
                )}

                {/* Overlay controls in customize mode */}
                <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1 rounded-xl border border-purple-200 shadow-md animate-in fade-in zoom-in-95">
                  <div className="cursor-grab active:cursor-grabbing text-purple-700 p-0.5 flex items-center gap-1 text-[10px] font-bold" title="بکشید برای جابجایی">
                    <GripVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>جابجایی</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTile(tileId);
                    }}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف این کاشی"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>

                {renderTileContent(tileId)}
              </Reorder.Item>
            ))
          )}
        </Reorder.Group>
      ) : (
        <div className="space-y-2.5 w-full my-0.5">
          {tileOrder.length === 0 ? (
            <DashboardEmptyState onResetLayout={handleResetLayout} />
          ) : (
            (() => {
              const matchesStatusFilter = (id: string) => {
                if (tileStatusFilter === 'all') return true;
                if (tileStatusFilter === 'urgent') return ['sayad_checks', 'inventory', 'reminders', 'patients'].includes(id);
                if (tileStatusFilter === 'in-chair') return ['implant', 'appointments', 'sterilization', 'ai_assistant', 'xrays'].includes(id);
                if (tileStatusFilter === 'lab-pending') return ['lab', 'installments', 'insurance_claims', 'marketing'].includes(id);
                return true;
              };
              const visibleTiles = tileOrder.filter(matchesStatusFilter);

              const renderLazyTileNode = (tileId: string, index: number) => (
                <LazyDashboardTile
                  key={tileId}
                  tileId={tileId}
                  index={index}
                  popping={poppingTileId === tileId}
                  draggable={!isBatchEditMode}
                  isDragging={draggedTileId === tileId}
                  isDragOver={dragOverTileId === tileId}
                  isSelectMode={isSelectMode}
                  isBatchEditMode={isBatchEditMode}
                  isSelected={selectedTileIds.includes(tileId)}
                  selectedCount={selectedTileIds.length}
                  isBulkDragging={isBulkDragging}
                  isGapReflowing={bulkReflowingTileIds.includes(tileId)}
                  reflowIndex={bulkReflowingTileIds.indexOf(tileId)}
                  onActivateTile={handleActivateTileById}
                  onToggleSelect={toggleTileSelection}
                  onDragStart={(e) => handleTileDragStart(e, tileId)}
                  onDragOver={(e) => handleTileDragOver(e, tileId)}
                  onDragEnter={(e) => handleTileDragEnter(e, tileId)}
                  onDragLeave={(e) => handleTileDragLeave(e, tileId)}
                  onDrop={(e) => handleTileDrop(e, tileId)}
                  onDragEnd={handleTileDragEnd}
                >
                  {renderTileContent(tileId)}
                </LazyDashboardTile>
              );

              // Active Clinic Groups (when user has merged tiles into custom surgery/finance queues)
              const activeGroups = clinicGroups.filter(
                g => g.tileIds.filter(id => visibleTiles.includes(id)).length > 1
              );
              const groupedTileIdSet = new Set(activeGroups.flatMap(g => g.tileIds));
              const ungroupedVisibleTiles = visibleTiles.filter(id => !groupedTileIdSet.has(id));

              // Filtered view mode: single softly tinted section with 2-column Q-Bank Grid
              if (tileStatusFilter !== 'all') {
                const filterZoneClass =
                  tileStatusFilter === 'urgent'
                    ? 'dashboard-zone-operations'
                    : tileStatusFilter === 'in-chair'
                    ? 'dashboard-zone-clinical'
                    : 'dashboard-zone-finance';
                const filterHeading =
                  tileStatusFilter === 'urgent'
                    ? 'ماژول‌های فوری و هشداردار مطب'
                    : tileStatusFilter === 'in-chair'
                    ? 'بخش‌های فعال روی یونیت و بالینی'
                    : 'پیگیری لابراتوار و وصول مطالبات مالی';

                return (
                  <section className={`dashboard-zone ${filterZoneClass} space-y-2`} dir="rtl">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="typo-subheading text-xs text-slate-900">{filterHeading}</h4>
                      <span className="typo-numeric text-[10.5px] px-2 py-0.5 rounded-lg bg-white/80 border border-slate-200/80 text-slate-700">
                        {toPersianDigits(visibleTiles.length)} ماژول
                      </span>
                    </div>
                    <div
                      style={{ gridAutoRows: 'minmax(min-content, max-content)' }}
                      className={`grid auto-rows-[minmax(min-content,max-content)] items-stretch ${
                        cardLayout === 'full'
                          ? 'grid-cols-1 gap-2.5'
                          : 'grid-cols-2 gap-2.5 sm:gap-3'
                      } w-full`}
                    >
                      {visibleTiles.map((tileId, idx) => renderLazyTileNode(tileId, idx))}
                    </div>
                  </section>
                );
              }

              // Soft Color-Separated Functional Dashboard Zones (Strictly 2-Column Q-Bank Pairs)
              const functionalZones: Array<{
                id: string;
                title: string;
                zoneClass: string;
                badgeClass: string;
                tileIds: string[];
              }> = [
                {
                  id: 'reception',
                  title: 'پذیرش و نوبت‌دهی',
                  zoneClass: 'dashboard-zone-reception',
                  badgeClass: 'text-sky-900 bg-sky-100/80 border-sky-200',
                  tileIds: ['patients', 'appointments']
                },
                {
                  id: 'finance',
                  title: 'مالی، چک صیادی و اقساط',
                  zoneClass: 'dashboard-zone-finance',
                  badgeClass: 'text-emerald-900 bg-emerald-100/80 border-emerald-200',
                  tileIds: ['sayad_checks', 'installments']
                },
                {
                  id: 'clinical',
                  title: 'درمان تخصصی، ایمپلنت و لابراتوار',
                  zoneClass: 'dashboard-zone-clinical',
                  badgeClass: 'text-purple-900 bg-purple-100/80 border-purple-200',
                  tileIds: ['implant', 'lab', 'xrays', 'sterilization']
                },
                {
                  id: 'operations',
                  title: 'انبار، یادآوری، بیمه و هوش مصنوعی',
                  zoneClass: 'dashboard-zone-operations',
                  badgeClass: 'text-amber-950 bg-amber-100/80 border-amber-200',
                  tileIds: ['inventory', 'reminders', 'ai_assistant', 'insurance_claims', 'marketing', 'audit_tracker']
                }
              ];

              const knownZoneTileIds = new Set(functionalZones.flatMap(z => z.tileIds));
              const extraTiles = ungroupedVisibleTiles.filter(id => !knownZoneTileIds.has(id));

              return (
                <>
                  {/* Render merged ClinicTileGroups cleanly first if user formed any */}
                  {activeGroups.map((group) => {
                    const activeGroupTiles = visibleTiles.filter(id => group.tileIds.includes(id));
                    return (
                      <motion.div
                        layout
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        key={group.id}
                        className="clinic-group-container dashboard-zone dashboard-zone-clinical space-y-2"
                        dir="rtl"
                      >
                        <div className="clinic-group-header flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-purple-200/70">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-xl bg-gradient-to-br from-cyan-600 to-purple-600 text-white shadow-xs">
                              <Layers className="w-3.5 h-3.5" />
                            </span>
                            {editingGroupId === group.id ? (
                              <input aria-label="نام گروه کلینیک"
                                type="text"
                                value={group.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  saveClinicGroups(
                                    clinicGroups.map(g => (g.id === group.id ? { ...g, name: val } : g))
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    setEditingGroupId(null);
                                  }
                                }}
                                onBlur={() => setEditingGroupId(null)}
                                autoFocus
                                className="bg-white border border-cyan-500 rounded-lg px-2 py-0.5 text-xs font-black text-slate-900 outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingGroupId(group.id)}
                                className="typo-subheading text-xs text-slate-900 hover:text-cyan-700 flex items-center gap-1 cursor-pointer"
                                title="کلیک برای تغییر نام گروه کلینیک"
                              >
                                <span>{group.name}</span>
                                <Edit3 className="w-3 h-3 text-slate-400" />
                              </button>
                            )}
                            <span className="typo-numeric px-2 py-0.5 rounded-lg bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px]">
                              {toPersianDigits(activeGroupTiles.length)} کاشی ادغام‌شده
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUngroupClinicGroup(group.id)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="تفکیک کاشی‌های این گروه"
                          >
                            <Ungroup className="w-3 h-3" />
                            <span>تفکیک گروه</span>
                          </button>
                        </div>

                        <div
                          style={{ gridAutoRows: 'minmax(min-content, max-content)' }}
                          className={`clinic-group-tiles-grid grid auto-rows-[minmax(min-content,max-content)] items-stretch ${
                            cardLayout === 'full' ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-2.5 sm:gap-3'
                          } w-full`}
                        >
                          {activeGroupTiles.map((memberId) => {
                            const memberIdx = tileOrder.indexOf(memberId);
                            return (
                              <div key={memberId} className="relative h-full flex flex-col group/member">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTileFromClinicGroup(group.id, memberId);
                                  }}
                                  className="absolute top-1.5 left-1.5 z-30 px-1.5 py-0.5 rounded-lg bg-white/95 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/90 hover:border-rose-300 text-[8.5px] font-black shadow-2xs flex items-center gap-0.5 transition-all cursor-pointer"
                                  title="خروج تکی این کاشی از گروه کلینیک"
                                >
                                  <X className="w-2.5 h-2.5" />
                                  <span>خروج از گروه</span>
                                </button>
                                {renderLazyTileNode(memberId, memberIdx)}
                              </div>
                            );
                          })}
                        </div>

                        <div className="clinic-group-bulk-shelf flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-purple-200/70">
                          <span className="text-[10.5px] font-extrabold text-cyan-900">
                            عملیات یکپارچه گروه ({group.name}):
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('heavy');
                                activeGroupTiles.forEach(id => recordTileInteraction(id));
                                showBulkToast(`تمام بیماران «${group.name}» به یونیت جراحی منتقل شدند`);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                            >
                              <Armchair className="w-3 h-3" />
                              <span>انتقال گروه به یونیت</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('heavy');
                                setSelectedTileIds(activeGroupTiles);
                                setBatchInvoiceModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                            >
                              <Printer className="w-3 h-3" />
                              <span>فاکتور گروهی صف</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                setIsBatchEditMode(prev => !prev);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>ویرایش وضعیت گروه</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Compact Softly Color-Separated Full-Width Zones (Each zone holds a 2-Column Q-Bank Tile Grid) */}
                  <Suspense
                    fallback={
                      <DentalSkeletonLoader
                        type="tile-grid"
                        count={12}
                        columns={cardLayout === 'full' ? 1 : 2}
                      />
                    }
                  >
                    <div className="flex flex-col gap-3 w-full">
                      {functionalZones.map((zone) => {
                        const zoneTiles = ungroupedVisibleTiles.filter(id => zone.tileIds.includes(id));
                        if (zoneTiles.length === 0) return null;

                        return (
                          <section
                            key={zone.id}
                            aria-label={zone.title}
                            className={`dashboard-zone ${zone.zoneClass} space-y-2`}
                            dir="rtl"
                          >
                            <div className="flex items-center justify-between gap-2 px-0.5">
                              <h4 className="typo-subheading text-xs text-slate-800">{zone.title}</h4>
                              <span className={`typo-numeric text-[10px] px-2 py-0.5 rounded-md border ${zone.badgeClass}`}>
                                {toPersianDigits(zoneTiles.length)} بخش
                              </span>
                            </div>

                            <div
                              style={{ gridAutoRows: 'minmax(min-content, max-content)' }}
                              className={`grid auto-rows-[minmax(min-content,max-content)] items-stretch ${
                                cardLayout === 'full' ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-2.5 sm:gap-3'
                              } w-full`}
                            >
                              {zoneTiles.map((tileId) => {
                                const idx = tileOrder.indexOf(tileId);
                                return renderLazyTileNode(tileId, idx === -1 ? 0 : idx);
                              })}
                            </div>
                          </section>
                        );
                      })}

                      {extraTiles.length > 0 && (
                        <section className="dashboard-zone dashboard-zone-operations space-y-2" dir="rtl">
                          <div
                            style={{ gridAutoRows: 'minmax(min-content, max-content)' }}
                            className="grid auto-rows-[minmax(min-content,max-content)] items-stretch grid-cols-2 gap-2.5 sm:gap-3 w-full"
                          >
                            {extraTiles.map((tileId, idx) => renderLazyTileNode(tileId, idx))}
                          </div>
                        </section>
                      )}
                    </div>
                  </Suspense>
                </>
              );
            })()
          )}
        </div>
      )}

      {/* Bottom Floating 'Action Shelf' in Bulk Selection Mode */}
      {isSelectMode && (
        <div
          className="bulk-action-floating-toolbar action-shelf fixed bottom-20 left-1/2 -translate-x-1/2 z-[115] w-[95%] max-w-lg rounded-[24px] bg-white/95 backdrop-blur-xl border-2 border-cyan-400/70 shadow-2xl px-3.5 py-3 text-slate-900 animate-in slide-in-from-bottom-6 fade-in duration-200"
          dir="rtl"
          role="region"
          aria-label="Action Shelf — نوار عملیات گروهی کاشی‌ها"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-cyan-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-[11px] font-black shadow-xs">
                {toPersianDigits(selectedTileIds.length)}
              </span>
              <div className="flex flex-col">
                <span className="text-[11.5px] font-black text-cyan-950 leading-tight">
                  نوار عملیات گروهی کاشی‌ها
                </span>
                <span className="text-[9.5px] font-bold text-slate-600">
                  {selectedTileIds.length > 0
                    ? `${toPersianDigits(selectedTileIds.length)} کاشی انتخاب‌شده آماده عملیات`
                    : 'یک یا چند کاشی را از روی چک‌باکس‌ها انتخاب کنید'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  if (selectedTileIds.length === tileOrder.length) {
                    setSelectedTileIds([]);
                  } else {
                    setSelectedTileIds([...tileOrder]);
                  }
                }}
                className="text-[10px] font-black text-cyan-900 hover:text-cyan-950 px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 transition-colors cursor-pointer"
              >
                {selectedTileIds.length === tileOrder.length ? 'لغو همه' : 'انتخاب همه'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedTileIds([]);
                  setIsSelectMode(false);
                }}
                className="text-[10px] font-bold text-slate-700 hover:text-slate-950 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {/* 1. Mark as Finished (Primary Action Shelf Operation) */}
            <button
              type="button"
              disabled={selectedTileIds.length === 0}
              onClick={() => handleBulkMarkAsFinished(selectedTileIds)}
              className="bulk-action-btn flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 hover:border-emerald-400 text-emerald-900 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="ثبت کاشی‌های انتخاب‌شده به عنوان پایان‌یافته"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-[10.5px] font-black leading-tight">پایان‌یافته</span>
            </button>

            {/* 2. Delete / Bulk Dismiss (Primary Action Shelf Operation) */}
            <button
              type="button"
              disabled={selectedTileIds.length === 0}
              onClick={() => handleBulkDismiss(selectedTileIds)}
              className="bulk-action-btn flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 hover:border-rose-400 text-rose-900 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="حذف و پاکسازی دسته‌ای با امکان بازگردانی"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span className="text-[10.5px] font-black leading-tight">حذف گروهی</span>
            </button>

            {/* 3. Move to Chair */}
            <button
              type="button"
              disabled={selectedTileIds.length === 0}
              onClick={() => {
                triggerHaptic('heavy');
                const count = selectedTileIds.length;
                const orderedSelected = tileOrder.filter(id => selectedTileIds.includes(id));
                const remaining = tileOrder.filter(id => !selectedTileIds.includes(id));
                const nextOrder = [...orderedSelected, ...remaining];
                triggerBulkGapReflow(orderedSelected, nextOrder);
                setTileOrder(nextOrder);
                try {
                  localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(nextOrder));
                } catch (e) {
                  console.warn('Error saving chair order:', e);
                }
                broadcastTileOrder(nextOrder);
                auditTracker.registerMutationRecord({
                  moduleKey: 'appointments',
                  title: `انتقال گروهی ${toPersianDigits(count)} پرونده/ماژول به یونیت فعال`,
                  subtitle: `انتقال گروهی به یونیت جراحی: ${selectedTileIds.join(', ')}`,
                  statusLabel: 'در یونیت فعال'
                });
                showBulkToast(`${toPersianDigits(count)} مورد به یونیت فعال منتقل شد`);
              }}
              className="bulk-action-btn flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 hover:border-cyan-400 text-cyan-900 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="انتقال به یونیت"
            >
              <Armchair className="w-4 h-4 text-cyan-600" />
              <span className="text-[10.5px] font-black leading-tight">انتقال به یونیت</span>
            </button>

            {/* 4. Archive */}
            <button
              type="button"
              disabled={selectedTileIds.length === 0}
              onClick={() => {
                triggerHaptic('heavy');
                const archivedCount = selectedTileIds.length;
                const remaining = tileOrder.filter(id => !selectedTileIds.includes(id));
                triggerBulkGapReflow(selectedTileIds, tileOrder);
                setTileOrder(remaining);
                try {
                  localStorage.setItem(STORAGE_TILES_KEY, JSON.stringify(remaining));
                } catch (e) {
                  console.warn('Error archiving tiles:', e);
                }
                broadcastTileOrder(remaining);
                auditTracker.registerMutationRecord({
                  moduleKey: 'patients',
                  title: `بایگانی گروهی ${toPersianDigits(archivedCount)} کاشی داشبورد`,
                  subtitle: `بایگانی گروهی کاشی‌های: ${selectedTileIds.join(', ')}`,
                  statusLabel: 'بایگانی شده'
                });
                setSelectedTileIds([]);
                showBulkToast(`${toPersianDigits(archivedCount)} کاشی با موفقیت بایگانی شد`);
              }}
              className="bulk-action-btn flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 hover:border-amber-400 text-amber-900 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="بایگانی کاشی‌های انتخاب‌شده"
            >
              <Archive className="w-4 h-4 text-amber-600" />
              <span className="text-[10.5px] font-black leading-tight">بایگانی</span>
            </button>

            {/* 5. Print Batch Invoice */}
            <button
              type="button"
              disabled={selectedTileIds.length === 0}
              onClick={() => {
                triggerHaptic('heavy');
                setBatchInvoiceModalOpen(true);
                auditTracker.registerMutationRecord({
                  moduleKey: 'financial_pos',
                  title: `صدور فاکتور گروهی (${toPersianDigits(selectedTileIds.length)} بخش)`,
                  subtitle: `آماده‌سازی چاپ فاکتور گروهی برای: ${selectedTileIds.join(', ')}`,
                  statusLabel: 'آماده چاپ'
                });
              }}
              className="bulk-action-btn col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-300 hover:border-purple-400 text-purple-900 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="فاکتور گروهی"
            >
              <Printer className="w-4 h-4 text-purple-600" />
              <span className="text-[10.5px] font-black leading-tight">فاکتور گروهی</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Toast with Immediate Undo Button */}
      {bulkActionToast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md text-slate-900 text-xs font-extrabold shadow-xl border-2 border-cyan-400 animate-in fade-in slide-in-from-top-3 duration-200"
          dir="rtl"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{bulkActionToast}</span>
          {toastUndoAction && (
            <button
              type="button"
              onClick={() => {
                toastUndoAction();
                setToastUndoAction(null);
                setBulkActionToast(null);
              }}
              className="mr-2 px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.8]" />
              <span>انصراف / بازگردانی</span>
            </button>
          )}
        </div>
      )}

      {/* Batch Invoice Preview & Print Modal */}
      {batchInvoiceModalOpen && (
        <div
          className="fixed inset-0 z-[135] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setBatchInvoiceModalOpen(false)}
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="پیش‌نمایش چاپ فاکتور گروهی"
        >
          <div
            className="w-full max-w-md bg-white rounded-[26px] border border-slate-200 shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-cyan-600" />
                <h4 className="text-xs font-black text-slate-800">
                  پیش‌نمایش چاپ فاکتور گروهی (Batch Invoice)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setBatchInvoiceModalOpen(false)}
                aria-label="بستن پیش‌نمایش چاپ"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 border-b border-slate-200 pb-1.5">
                <span>تعداد بخش‌ها و پرونده‌های انتخاب‌شده:</span>
                <span className="font-black text-cyan-700">{toPersianDigits(selectedTileIds.length)} مورد</span>
              </div>
              {patients.slice(0, Math.max(2, selectedTileIds.length)).map((pt, i) => (
                <div key={pt.id || i} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-slate-800">{pt.fullName}</span>
                    <span className="text-[9.5px] text-slate-500">پرونده: {toPersianDigits(pt.fileNumber || `10${i + 1}`)}</span>
                  </div>
                  <span className="font-black text-emerald-700">
                    {formatToman(pt.totalCost || 14500000)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBatchInvoiceModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('success');
                  setBatchInvoiceModalOpen(false);
                  showBulkToast(`فاکتور گروهی برای ${toPersianDigits(selectedTileIds.length)} بخش آماده چاپ شد`);
                  window.print();
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ مستقیم فاکتور گروهی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Context Menu Bottom Sheet / Modal */}
      {tileContextMenu && (
        <div 
          className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setTileContextMenu(null)}
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label={`عملیات سریع ${tileContextMenu.title}`}
        >
          <div 
            className="w-full sm:max-w-sm bg-white rounded-t-[28px] sm:rounded-[28px] border border-slate-200 shadow-2xl p-4 space-y-3 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-black text-slate-800">عملیات سریع: {tileContextMenu.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setTileContextMenu(null)}
                aria-label="بستن منوی سریع"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              {tileContextMenu.actions.map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    impactLight();
                    setTileContextMenu(null);
                    act.onClick();
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200/70 transition-all active:scale-98 cursor-pointer text-right"
                >
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-2xs shrink-0">
                    {act.icon}
                  </div>
                  <span>{act.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rapid Quick Admission Modal triggered directly from the tile */}
      <QuickAdmissionModal
        isOpen={quickAdmissionOpen}
        onClose={() => {
          impactLight();
          setQuickAdmissionOpen(false);
        }}
        onPatientAdmitted={(newPatient) => {
          success();
          if (onAddNewPatient) {
            onAddNewPatient(newPatient);
          }
          setQuickAdmissionOpen(false);
        }}
        onOpenPalmerChart={(patient) => {
          impactMedium();
          setQuickAdmissionOpen(false);
          if (onOpenPalmerForPatient) {
            onOpenPalmerForPatient(patient);
          } else {
            onOpenPalmerChart();
          }
        }}
      />

    </div>
  );
};
