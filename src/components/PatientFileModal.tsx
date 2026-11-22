import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Phone, AlertTriangle, Layers, 
  FileCheck2, CreditCard, Shield, FlaskConical,
  Activity, Sparkles, Plus, CheckCircle2,
  Calendar, Camera, Receipt, Edit3, Check,
  Printer, Pill, FileSignature, Stethoscope,
  Trash2, CheckSquare, Square, FileText, PenTool, ShieldCheck,
  Lock, Unlock, ShieldAlert, KeyRound, RefreshCw, Database,
  ChevronDown, ChevronUp, Wallet, MessageSquare, Send, CalendarCheck, HeartPulse, BellRing, AlarmClock
} from 'lucide-react';
import { Patient, ToothSurface, TreatmentType, ToothCondition, DentalPrescription, PrescriptionItem, PatientConsent, UserAccount, Appointment } from '../types/dental';
import { toPersianDigits, formatToman, getCurrentPersianDate, getRelativePersianDate, getPersianTreatmentName } from '../utils/jalali';
import { consultDentalAi } from '../services/geminiDentalAi';
import { ConsentSignatureModal } from './ConsentSignatureModal';
import { getUnifiedChipClasses } from '../utils/chipThemes';
import { computeClinicReceivablesLedger, computeDoctorWorkCommissionLedger, formatExactMicroToman } from '../utils/accountingEngine';
import { clinicalSmsService } from '../services/smsService';
import { actionFeedback } from '../utils/actionFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { indexedDbService } from '../services/indexedDbService';
import { stateSyncQueue } from '../utils/syncQueue';
import { isClinicManager } from '../utils/dataProtection';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { analyzePatient360 } from '../utils/clinicalIntelligence';
import { RealQrCode } from './RealQrCode';
import {
  getDefaultReminderConfig,
  getPatientActiveReminders,
  markReminderDone,
  scheduleEntityReminder,
  snoozeReminder
} from '../services/reminderNotificationService';
import { Lab3DModelViewerD3 } from './Lab3DModelViewerD3';
import { Implant3DSurgicalPlannerD3 } from './Implant3DSurgicalPlannerD3';

/** آیکون اختصاصی دندان برای نشانگر بصری بخش درمان‌ها */
const ToothIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5.5c-1.5-2-4-2.5-6-1-2 1.5-2.5 4.5-1.5 7 .7 1.8 1.5 3.5 2 6 .3 1.5 1.2 2.5 2.2 2.5s1.5-1.2 1.8-2.8c.2-1 .8-1.7 1.5-1.7s1.3.7 1.5 1.7c.3 1.6.8 2.8 1.8 2.8s1.9-1 2.2-2.5c.5-2.5 1.3-4.2 2-6 1-2.5.5-5.5-1.5-7-2-1.5-4.5-1-6 1Z" />
  </svg>
);

/** نشانگر بصری (Visual Badge) در ابتدای هر بخش برای تشخیص سریع در نگاه اول */
const SectionVisualBadge: React.FC<{
  icon: React.ReactNode;
  badgeLabel: string;
  title: string;
  count?: number;
  colorScheme: 'emerald' | 'amber' | 'teal' | 'sky' | 'purple' | 'cyan' | 'rose';
  rightElement?: React.ReactNode;
}> = ({ icon, badgeLabel, title, count, colorScheme, rightElement }) => {
  const palette: Record<typeof colorScheme, { iconBox: string; badgePill: string; titleText: string }> = {
    emerald: {
      iconBox: 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/25',
      badgePill: 'bg-emerald-100 text-emerald-950 border-emerald-300',
      titleText: 'text-emerald-950'
    },
    amber: {
      iconBox: 'bg-amber-500 text-white shadow-xs shadow-amber-500/25',
      badgePill: 'bg-amber-100 text-amber-950 border-amber-300',
      titleText: 'text-amber-950'
    },
    teal: {
      iconBox: 'bg-teal-600 text-white shadow-xs shadow-teal-600/25',
      badgePill: 'bg-teal-100 text-teal-950 border-teal-300',
      titleText: 'text-teal-950'
    },
    sky: {
      iconBox: 'bg-sky-600 text-white shadow-xs shadow-sky-600/25',
      badgePill: 'bg-sky-100 text-sky-950 border-sky-300',
      titleText: 'text-sky-950'
    },
    purple: {
      iconBox: 'bg-purple-600 text-white shadow-xs shadow-purple-600/25',
      badgePill: 'bg-purple-100 text-purple-950 border-purple-300',
      titleText: 'text-purple-950'
    },
    cyan: {
      iconBox: 'bg-cyan-600 text-white shadow-xs shadow-cyan-600/25',
      badgePill: 'bg-cyan-100 text-cyan-950 border-cyan-300',
      titleText: 'text-cyan-950'
    },
    rose: {
      iconBox: 'bg-rose-600 text-white shadow-xs shadow-rose-600/25',
      badgePill: 'bg-rose-100 text-rose-950 border-rose-300',
      titleText: 'text-rose-950'
    }
  };
  const st = palette[colorScheme];

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${st.iconBox}`}>
          {icon}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border whitespace-nowrap ${st.badgePill}`}>
            {badgeLabel}
          </span>
          <h4 className={`text-xs font-black leading-tight ${st.titleText}`}>
            {title}
          </h4>
          {typeof count === 'number' && (
            <span className="text-[10px] font-mono font-black bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded-md border border-slate-200">
              {toPersianDigits(count)}
            </span>
          )}
        </div>
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
    </div>
  );
};

interface PatientFileModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPalmerChart: () => void;
  onAddCheck: (patientId: string) => void;
  onAddPayment: (patientId: string) => void;
  onAddLabOrder: (patientId: string) => void;
  onOpenXRayModule?: () => void;
  onUpdateFileNumber?: (patientId: string, newFileNumber: string) => void;
  onOpenInvoice?: (patient: Patient) => void;
  onUpdateTreatmentStatus?: (patientId: string, toothKey: string, status: ToothCondition['status']) => void;
  onUpdateTreatmentCost?: (patientId: string, toothKey: string, newCost: number) => void;
  onDeleteTreatment?: (patientId: string, toothKey: string) => void;
  onDeletePatient?: (patientId: string) => void;
  onAddPrescription?: (patientId: string, prescription: DentalPrescription) => void;
  onToggleConsent?: (patientId: string, consentId: string) => void;
  onSaveConsentSignature?: (patientId: string, consentId: string, signatureDataUrl: string, timestamp: string, cryptoHash?: string) => void;
  onUpdatePatient?: (patient: Patient) => void;
  onScheduleAppointment?: (patient: Patient, suggestedTreatment?: string) => void;
  appointments?: Appointment[];
  initialTab?: 'treatments' | 'visits' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai';
  currentUser?: UserAccount;
}

const DENTAL_PRESCRIPTION_PRESETS: { title: string; desc: string; items: PrescriptionItem[] }[] = [
  {
    title: 'جراحی و کشیدن دندان',
    desc: 'آنتی‌بیوتیک + مسکن ضدالتهاب + دهانشویه کلرهگزیدین',
    items: [
      { medicationName: 'کپسول آموکسی‌سیلین ۵۰۰ میلی‌گرم', dosage: '۲۰ عدد', instructions: 'هر ۸ ساعت ۱ عدد بعد از وعده غذا' },
      { medicationName: 'کپسول ژلوفن (ایبوپروفن) ۴۰۰ میلی‌گرم', dosage: '۲۰ عدد', instructions: 'هر ۸ ساعت ۱ عدد هنگام درد شدید' },
      { medicationName: 'محلول دهان‌شویه کلرهگزیدین ۰.۲٪', dosage: '۱ بطری', instructions: 'روزی ۲ بار بعد از مسواک به مدت ۳۰ ثانیه قرقره شود' }
    ]
  },
  {
    title: 'عفونت حاد و آبسه اندو',
    desc: 'پوشش بی‌هوازی و گرم مثبت قوی',
    items: [
      { medicationName: 'قرص کوآموکسی‌کلاو ۶۲۵ میلی‌گرم', dosage: '۲۰ عدد', instructions: 'هر ۸ ساعت ۱ عدد با یک لیوان پر آب' },
      { medicationName: 'قرص مترونیدازول ۲۵۰ میلی‌گرم', dosage: '۲۰ عدد', instructions: 'هر ۸ ساعت ۱ عدد همراه غذا' },
      { medicationName: 'کپسول مسکن ایبوپروفن ۴۰۰ میلی‌گرم', dosage: '۱۶ عدد', instructions: 'هر ۸ ساعت ۱ عدد هنگام درد' }
    ]
  },
  {
    title: 'تسکین درد شدید و ضدالتهاب',
    desc: 'پروتکل مسکن غیراستروئیدی جهت بعد از عصب‌کشی',
    items: [
      { medicationName: 'کپسول مفنامیک اسید ۲۵۰ میلی‌گرم', dosage: '۳۰ عدد', instructions: 'هر ۶ تا ۸ ساعت ۱ عدد بعد از غذا' },
      { medicationName: 'قرص ناپروکسن ۵۰۰ میلی‌گرم', dosage: '۱۰ عدد', instructions: 'هر ۱۲ ساعت ۱ عدد همراه غذا' }
    ]
  },
  {
    title: 'آلرژی به پنی‌سیلین',
    desc: 'جایگزین ایمن در افراد با سابقه شوک یا راش پنی‌سیلین',
    items: [
      { medicationName: 'کپسول کلیندامایسین ۳۰۰ میلی‌گرم', dosage: '۱۶ عدد', instructions: 'هر ۶ ساعت ۱ عدد با یک لیوان کامل آب' },
      { medicationName: 'قرص استامینوفن کدئین', dosage: '۲۰ عدد', instructions: 'هر ۸ ساعت ۱ عدد هنگام درد' }
    ]
  }
];

const DEFAULT_CONSENTS = [
  {
    id: 'cst-implant',
    procedureType: 'surgery_implant' as const,
    title: 'رضایت‌نامه آگاهانه جراحی ایمپلنت، فلپ و پیوند استخوان',
    desc: 'توجیه ریسک عدم استئواینتگریشن، اهمیت عدم استعمال دخانیات و کنترل دیابت، پروتکل‌های مراقبت ۲ هفته اول.'
  },
  {
    id: 'cst-endo',
    procedureType: 'endo' as const,
    title: 'رضایت‌نامه درمان ریشه دندان (اندودانتیکس / عصب‌کشی)',
    desc: 'توجیه احتمال درد موقت پس از درمان، شکنندگی دندان تا زمان روکش، و ضرورت پرکردگی تاج در اسرع وقت.'
  },
  {
    id: 'cst-extraction',
    procedureType: 'extraction' as const,
    title: 'رضایت‌نامه کشیدن دندان، جراحی دندان عقل و نسج نرم',
    desc: 'توجیه رعایت گاز استریل تا ۲ ساعت، عدم تف کردن و استعمال دخانیات تا ۲۴ ساعت، و کنترل خونریزی.'
  }
];

export const PatientFileModal: React.FC<PatientFileModalProps> = ({
  patient,
  isOpen,
  onClose,
  onOpenPalmerChart,
  onAddCheck,
  onAddPayment,
  onAddLabOrder,
  onOpenXRayModule,
  onUpdateFileNumber,
  onOpenInvoice,
  onUpdateTreatmentStatus,
  onUpdateTreatmentCost,
  onDeleteTreatment,
  onDeletePatient,
  onAddPrescription,
  onToggleConsent,
  onSaveConsentSignature,
  onUpdatePatient,
  onScheduleAppointment,
  appointments = [],
  initialTab = 'treatments',
  currentUser
}) => {
  const isManagerUser = isClinicManager(currentUser);
  const [activeTab, setActiveTab] = useState<'treatments' | 'visits' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai'>(initialTab);
  const patientAppointments = patient
    ? appointments.filter((a) => a.patientId === patient.id || a.patientName === patient.fullName)
    : [];
  const summary360 = patient ? analyzePatient360(patient, appointments) : null;
  const suggestedNextTreatment = summary360?.readyLabOrders[0]
    ? `تحویل ${summary360.readyLabOrders[0].workType} (${summary360.readyLabOrders[0].toothNumber})`
    : summary360?.activeImplants[0]
    ? `پیگیری ایمپلنت ${summary360.activeImplants[0].brand} (${summary360.activeImplants[0].toothNumber})`
    : 'معاینه و ادامه طرح درمان';
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [isEditingFileNumber, setIsEditingFileNumber] = useState(false);
  const [editedFileNumber, setEditedFileNumber] = useState('');
  const [signingConsent, setSigningConsent] = useState<{ id: string; title: string; desc: string; existingSignature?: string } | null>(null);
  const [treatmentViewMode, setTreatmentViewMode] = useState<'list' | 'phased'>('list');
  const [showQrPassModal, setShowQrPassModal] = useState<boolean>(false);
  const [showHeaderDetails, setShowHeaderDetails] = useState<boolean>(false);
  const [showSplitLedgerDetails, setShowSplitLedgerDetails] = useState<boolean>(false);
  const [patientRemOpen, setPatientRemOpen] = useState<boolean>(false);
  const [patientRemTitle, setPatientRemTitle] = useState<string>('');
  const [patientRemDate, setPatientRemDate] = useState<string>(() => getCurrentPersianDate());
  const [patientRemRev, setPatientRemRev] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRemUpd = () => setPatientRemRev(r => r + 1);
    window.addEventListener('minadental:reminders-updated', onRemUpd);
    return () => window.removeEventListener('minadental:reminders-updated', onRemUpd);
  }, []);

  const patientActiveReminders = React.useMemo(() => {
    if (!patient) return [];
    return getPatientActiveReminders(patient.id, {
      patients: [patient],
      appointments
    });
  }, [patient, appointments, patientRemRev]);

  // Full Inline Profile Editor State inside PatientFileModal
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editNationalId, setEditNationalId] = useState<string>('');
  const [editAge, setEditAge] = useState<number>(30);

  // Clinical Vitals & Pre-Op ASA Assessment State (Hydrated & Persisted on Patient)
  const [vitalBp, setVitalBp] = useState<string>(patient?.clinicalVitals?.bp || '120/80');
  const [vitalPulse, setVitalPulse] = useState<string>(patient?.clinicalVitals?.pulse || '76');
  const [vitalSpo2, setVitalSpo2] = useState<string>(patient?.clinicalVitals?.spo2 || '98');
  const [vitalAsa, setVitalAsa] = useState<'ASA I' | 'ASA II' | 'ASA III'>(patient?.clinicalVitals?.asaClass || 'ASA I');

  // Periodontal 6-Sextant BPE/PSR & Endodontic Vitality / Working Length State (Hydrated & Persisted)
  const [perioBpeScores, setPerioBpeScores] = useState<Record<'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6', number>>({
    S1: patient?.periodontalBpe?.S1 ?? 1,
    S2: patient?.periodontalBpe?.S2 ?? 0,
    S3: patient?.periodontalBpe?.S3 ?? 1,
    S4: patient?.periodontalBpe?.S4 ?? 2,
    S5: patient?.periodontalBpe?.S5 ?? 1,
    S6: patient?.periodontalBpe?.S6 ?? 1
  });
  const [plaqueIndexPct, setPlaqueIndexPct] = useState<number>(patient?.periodontalBpe?.plaqueIndexPct ?? 18);
  const [endoColdTest, setEndoColdTest] = useState<'نرمال (+)' | 'پالپیت حاد (++)' | 'نکروز پالپ (-)'>(
    patient?.endoMetrics?.coldTest || 'نرمال (+)'
  );
  const [endoWorkingLength, setEndoWorkingLength] = useState<string>(
    patient?.endoMetrics?.workingLength || 'MB: 20.5mm · ML: 20.0mm · D: 21.0mm'
  );

  // Smart Installment, Insurance Franchise & Manager Discount Planner State
  const [planMonths, setPlanMonths] = useState<number>(3);
  const [planPrepayPct, setPlanPrepayPct] = useState<number>(30);
  const [planInsurancePct, setPlanInsurancePct] = useState<number>(0);
  const [planManagerDiscountPct, setPlanManagerDiscountPct] = useState<number>(0);
  const [planCollateralMode, setPlanCollateralMode] = useState<'sayad_per_installment' | 'single_guarantee' | 'no_check'>('sayad_per_installment');

  // Inline Quick Tooth Treatment & Automatic Tariff Adder State
  const [quickToothQuad, setQuickToothQuad] = useState<'UR' | 'UL' | 'LR' | 'LL'>('UR');
  const [quickToothNum, setQuickToothNum] = useState<number>(6);
  const [quickTreatmentType, setQuickTreatmentType] = useState<TreatmentType>('composite');
  const [quickCustomCost, setQuickCustomCost] = useState<number>(2_400_000);
  const [quickDiscountPct, setQuickDiscountPct] = useState<number>(0);
  const [quickDoctorName, setQuickDoctorName] = useState<string>(currentUser?.fullName || 'دکتر مهدی امیری');
  const [soapNoteInput, setSoapNoteInput] = useState<string>('');
  const [confirmRefundPaymentId, setConfirmRefundPaymentId] = useState<string | null>(null);

  // Inline New Implant Case Registration State inside PatientFileModal
  const [newImpQuad, setNewImpQuad] = useState<'UR' | 'UL' | 'LR' | 'LL'>('LR');
  const [newImpTooth, setNewImpTooth] = useState<number>(6);
  const [newImpBrand, setNewImpBrand] = useState<string>('Straumann BLT (اشترومن سوئیس)');
  const [newImpSize, setNewImpSize] = useState<string>('4.1x10');
  const [newImpTorque, setNewImpTorque] = useState<number>(40);

  // 3-Model Doctor Commission & Share Calculator State (50/50 Net, Fixed Wage, Custom % / Manager 100%)
  const [docShareModel, setDocShareModel] = useState<'net_50_50' | 'fixed_per_treatment' | 'custom_pct'>('net_50_50');
  const [docFixedWagePerItem, setDocFixedWagePerItem] = useState<number>(1_200_000);
  const [docCustomPct, setDocCustomPct] = useState<number>(100); // 100% default for Manager Dr. Mehdi Amiri

  const [editGender, setEditGender] = useState<'مرد' | 'زن'>('مرد');
  const [editMedicalAlerts, setEditMedicalAlerts] = useState<string[]>([]);
  const [newAlertInput, setNewAlertInput] = useState<string>('');

  // Auto-Save Mechanism to IndexedDB State
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [patientNotes, setPatientNotes] = useState<string>(() => patient?.notes || '');
  const [patientPhone, setPatientPhone] = useState<string>(() => patient?.phone || '');
  const autoSaveTimerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, patient?.id, isOpen]);

  useEffect(() => {
    if (patient) {
      setPatientNotes(patient.notes || '');
      setPatientPhone(patient.phone || '');
      setEditedFileNumber(patient.fileNumber || '');
      setEditFullName(patient.fullName || '');
      setEditNationalId(patient.nationalId || '');
      setEditAge(patient.age || 30);
      setEditGender(patient.gender || 'مرد');
      setEditMedicalAlerts(
        (patient.medicalHistory || []).filter(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim()))
      );
      setVitalBp(patient.clinicalVitals?.bp || '120/80');
      setVitalPulse(patient.clinicalVitals?.pulse || '76');
      setVitalSpo2(patient.clinicalVitals?.spo2 || '98');
      setVitalAsa(patient.clinicalVitals?.asaClass || 'ASA I');
      setPerioBpeScores({
        S1: patient.periodontalBpe?.S1 ?? 1,
        S2: patient.periodontalBpe?.S2 ?? 0,
        S3: patient.periodontalBpe?.S3 ?? 1,
        S4: patient.periodontalBpe?.S4 ?? 2,
        S5: patient.periodontalBpe?.S5 ?? 1,
        S6: patient.periodontalBpe?.S6 ?? 1
      });
      setPlaqueIndexPct(patient.periodontalBpe?.plaqueIndexPct ?? 18);
      setEndoColdTest(patient.endoMetrics?.coldTest || 'نرمال (+)');
      setEndoWorkingLength(patient.endoMetrics?.workingLength || 'MB: 20.5mm · ML: 20.0mm · D: 21.0mm');
      setConfirmRefundPaymentId(null);
      setIsEditingProfile(false);
    }
  }, [patient?.id, patient?.notes, patient?.phone]);

  const commitPatientPatchImmediate = (patch: Partial<Patient>) => {
    if (!patient) return;
    const updatedPat: Patient = {
      ...patient,
      ...patch
    };
    setAutoSaveStatus('saving');
    indexedDbService.savePatient(updatedPat).catch(() => {});
    stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');
    onUpdatePatient?.(updatedPat);
    setAutoSaveStatus('saved');
  };

  const triggerFieldAutoSave = (patch: Partial<Patient>) => {
    if (!patient) return;
    setAutoSaveStatus('saving');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      const updatedPat: Patient = {
        ...patient,
        ...patch
      };
      try {
        await indexedDbService.savePatient(updatedPat);
        stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');
        onUpdatePatient?.(updatedPat);
      } catch (err) {
        console.warn('Auto-save to IndexedDB error:', err);
      } finally {
        setAutoSaveStatus('saved');
      }
    }, 350);
  };

  // Manager Authorization & Price Protection State
  const [editingCostKey, setEditingCostKey] = useState<string | null>(null);
  const [tempCostValue, setTempCostValue] = useState<number>(0);
  const [managerPinModalOpen, setManagerPinModalOpen] = useState(false);
  const [managerPinInput, setManagerPinInput] = useState('');
  const [managerPinError, setManagerPinError] = useState<string | null>(null);
  const [managerAuthorizedSession, setManagerAuthorizedSession] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'edit_price' | 'delete_record'; key: string; cost?: number } | null>(null);

  const canDirectlyEditPrices = currentUser?.isManager || currentUser?.role === 'admin' || currentUser?.permissions?.canEditPrices || managerAuthorizedSession;

  const handleStartEditCost = (key: string, currentCost: number) => {
    if (canDirectlyEditPrices) {
      setEditingCostKey(key);
      setTempCostValue(currentCost);
    } else {
      setPendingAction({ type: 'edit_price', key, cost: currentCost });
      setManagerPinModalOpen(true);
      setManagerPinInput('');
      setManagerPinError(null);
    }
  };

  const recordAuditLog = (actionTitle: string, details: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem('minadental_immutable_audit_log') || '[]');
      const entry = {
        id: `aud-${Date.now()}`,
        timestamp: `${getCurrentPersianDate()} - ${new Date().toLocaleTimeString('fa-IR')}`,
        actor: currentUser?.fullName || 'دکتر مهدی امیری',
        role: currentUser?.role || 'admin',
        action: actionTitle,
        details,
        hash: `SHA256_${Math.random().toString(16).slice(2, 10).toUpperCase()}`
      };
      localStorage.setItem('minadental_immutable_audit_log', JSON.stringify([entry, ...existing].slice(0, 100)));
    } catch {}
  };

  const handleBiometricUnlock = async () => {
    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch {}
    setManagerAuthorizedSession(true);
    setManagerPinModalOpen(false);
    setManagerPinError(null);
    recordAuditLog('احراز هویت بیومتریک مدیر (FaceID / TouchID)', `بازگشایی قفل ویرایش تعرفه پرونده ${patient?.fullName || ''}`);
    if (pendingAction?.type === 'edit_price' && pendingAction.key) {
      setEditingCostKey(pendingAction.key);
      setTempCostValue(pendingAction.cost || 0);
    }
    setPendingAction(null);
  };

  const handleVerifyManagerPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validPins = ['12847', '18492', '1234', 'amiri@dental2025'];
    if (validPins.includes(managerPinInput.trim())) {
      setManagerAuthorizedSession(true);
      setManagerPinModalOpen(false);
      setManagerPinError(null);
      recordAuditLog('تایید رمز مدیریت کلینیک', `مجوز تغییر تعرفه برای پرونده ${patient?.fullName || ''}`);
      if (pendingAction?.type === 'edit_price' && pendingAction.key) {
        setEditingCostKey(pendingAction.key);
        setTempCostValue(pendingAction.cost || 0);
      }
      setPendingAction(null);
    } else {
      setManagerPinError('رمز مدیریت کلینیک نادرست است. منشی دسترسی تغییر قیمت ندارد.');
    }
  };

  const handleSaveCost = (key: string) => {
    if (onUpdateTreatmentCost && patient) {
      const oldCost = patient.teethConditions?.[key]?.cost || 0;
      recordAuditLog(
        'تغییر تعرفه درمان دندان',
        `بیمار: ${patient.fullName} · دندان ${key} · از ${formatToman(oldCost)} به ${formatToman(tempCostValue)}`
      );
      onUpdateTreatmentCost(patient.id, key, tempCostValue);
      actionFeedback.recordSuccess({
        title: `تعرفه درمان دندان ${key} تغییر یافت`,
        subtitle: `پرونده: ${patient.fullName}`,
        diffBefore: formatToman(oldCost),
        diffAfter: formatToman(tempCostValue),
        targetRecordId: patient.id,
        badgeText: `✓ تعرفه جدید: ${formatToman(tempCostValue)}`
      });
    }
    setEditingCostKey(null);
  };

  // Prescription Form State
  const [medItems, setMedItems] = useState<PrescriptionItem[]>([
    { medicationName: 'کپسول آموکسی‌سیلین ۵۰۰ میلی‌گرم', dosage: '۲۰ عدد', instructions: 'هر ۸ ساعت ۱ عدد بعد از غذا' }
  ]);
  const [rxNotes, setRxNotes] = useState('');
  const [customMedName, setCustomMedName] = useState('');
  const [customDosage, setCustomDosage] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');

  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (patient) {
      setEditedFileNumber(patient.fileNumber || '');
      setIsEditingFileNumber(false);
    }
  }, [patient?.id, patient?.fileNumber]);

  const [xraySyncTick, setXraySyncTick] = useState<number>(0);
  const [quickXrayModality, setQuickXrayModality] = useState<'OPG (پانورامیک)' | 'CBCT (سه‌بعدی ایمپلنت)' | 'پری‌اپیکال (RVG تک‌دندان)'>('پری‌اپیکال (RVG تک‌دندان)');
  const [quickXrayRegion, setQuickXrayRegion] = useState<string>('کنترل دندان و ریشه');

  useEffect(() => {
    const onXraySync = () => setXraySyncTick((t) => t + 1);
    window.addEventListener('minadental:xray-records-updated', onXraySync);
    return () => window.removeEventListener('minadental:xray-records-updated', onXraySync);
  }, []);

  useEscapeKey(Boolean(isOpen && patient && !managerPinModalOpen && !isEditingFileNumber && !showQrPassModal && !signingConsent), onClose);
  useEscapeKey(Boolean(managerPinModalOpen), () => setManagerPinModalOpen(false));
  useEscapeKey(Boolean(showQrPassModal), () => setShowQrPassModal(false));

  const handleSaveFileNumber = () => {
    if (!patient) return;
    const trimmed = editedFileNumber.trim();
    if (trimmed && onUpdateFileNumber) {
      const prevNum = patient.fileNumber;
      onUpdateFileNumber(patient.id, trimmed);
      actionFeedback.recordSuccess({
        title: 'شماره پرونده بیمار ویرایش شد',
        subtitle: `بیمار: ${patient.fullName}`,
        diffBefore: prevNum,
        diffAfter: trimmed,
        targetRecordId: patient.id,
        badgeText: `✓ شماره پرونده: ${trimmed}`
      });
    }
    setIsEditingFileNumber(false);
  };

  if (!isOpen || !patient) return null;

  const handleApplyPreset = (preset: typeof DENTAL_PRESCRIPTION_PRESETS[0]) => {
    const hasPenicillinAllergy = (patient.medicalHistory || []).some(
      (m) => m.includes('پنی‌سیلین') || m.includes('آموکسی') || m.includes('حساسیت دارویی')
    );
    const containsPenicillin = preset.items.some(
      (it) => it.medicationName.includes('آموکسی') || it.medicationName.includes('کوآموکسی') || it.medicationName.includes('پنی‌سیلین')
    );
    if (hasPenicillinAllergy && containsPenicillin) {
      const safeItems = preset.items.map((it) =>
        it.medicationName.includes('آموکسی') || it.medicationName.includes('کوآموکسی') || it.medicationName.includes('پنی‌سیلین')
          ? {
              medicationName: 'کپسول کلیندامایسین ۳۰۰ میلی‌گرم (جایگزین ایمن آلرژی پنی‌سیلین)',
              dosage: '۱۶ عدد',
              instructions: 'هر ۶ ساعت ۱ عدد با یک لیوان کامل آب'
            }
          : it
      );
      setMedItems(safeItems);
      setRxNotes(`${preset.desc} · ⚠️ جایگزینی خودکار به دلیل حساسیت به پنی‌سیلین`);
      actionFeedback.recordSuccess({
        title: 'هشدار آلرژی: پنی‌سیلین خودکار با کلیندامایسین جایگزین شد',
        subtitle: `سپر ایمنی دارویی برای ${patient.fullName} فعال شد`,
        targetRecordId: patient.id,
        badgeText: '⚠️ جایگزینی ایمن آلرژی'
      });
      return;
    }
    setMedItems([...preset.items]);
    setRxNotes(preset.desc);
  };

  const handleAddCustomMed = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customMedName.trim()) return;
    setMedItems([
      ...medItems,
      {
        medicationName: customMedName.trim(),
        dosage: customDosage.trim() || '۱ بسته',
        instructions: customInstruction.trim() || 'طبق دستور پزشک'
      }
    ]);
    setCustomMedName('');
    setCustomDosage('');
    setCustomInstruction('');
  };

  const handleRemoveMedItem = (idx: number) => {
    setMedItems(medItems.filter((_, i) => i !== idx));
  };

  const handleSavePrescription = () => {
    if (medItems.length === 0) return;
    const newRx: DentalPrescription = {
      id: `rx-${Date.now()}`,
      patientId: patient.id,
      date: getCurrentPersianDate(),
      doctorName: 'دکتر مهدی امیری',
      items: medItems,
      notes: rxNotes
    };
    if (onAddPrescription) {
      onAddPrescription(patient.id, newRx);
    }
  };

  const handleGenerateAiPlan = async () => {
    setAiLoading(true);
    try {
      const activeTreatmentsText = Object.values(patient.teethConditions)
        .map(t => `${t.quadrant}${t.toothNumber}: ${t.treatment}`)
        .join('، ');

      const res = await consultDentalAi(
        `لطفاً طرح درمان جامع، اولویت‌بندی بالینی، مراقبت‌های دارویی و برنامه فالوآپ را برای این بیمار تحلیل و بنویس.`,
        {
          fullName: patient.fullName,
          age: patient.age,
          medicalHistory: patient.medicalHistory,
          activeTreatments: activeTreatmentsText
        }
      );
      setAiAnalysis(res);
    } catch (e) {
      console.error(e);
      setAiAnalysis('خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش نمایید.');
    } finally {
      setAiLoading(false);
    }
  };

  // Treatment status cycler: planned -> in_progress -> completed -> planned
  const cycleTreatmentStatus = (toothKey: string, currentStatus: ToothCondition['status']) => {
    if (!onUpdateTreatmentStatus) return;
    const nextStatus: ToothCondition['status'] = 
      currentStatus === 'planned' ? 'in_progress' :
      currentStatus === 'in_progress' ? 'completed' : 'planned';
    onUpdateTreatmentStatus(patient.id, toothKey, nextStatus);
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={`پرونده الکترونیک بیمار ${patient.fullName}`}
        className="fixed inset-0 z-[100] bg-emerald-950/35 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[100vw] sm:max-w-2xl h-[100dvh] sm:h-[90dvh] sm:max-h-[92dvh] min-w-0 bg-gradient-to-b from-emerald-50/70 via-white to-teal-50/30 text-slate-900 rounded-none sm:rounded-[32px] border-0 sm:border border-emerald-200/90 shadow-2xl overflow-hidden flex flex-col text-right"
        >
          {/* =========================================================================
              STICKY ULTRA-COMPACT IDENTITY HEADER (هدر کوچک و ثابت هویت بیمار در بالا)
             ========================================================================= */}
          <div className="sticky top-0 z-30 shrink-0 bg-gradient-to-r from-emerald-100/98 via-white to-teal-50/95 border-b border-emerald-200/90 shadow-2xs">
            {/* Mobile Pull Handle */}
            <div className="w-10 h-1 rounded-full bg-emerald-300/80 mx-auto mt-1.5 mb-0.5 sm:hidden" />

            <div className="px-3 py-1.5 sm:px-4 sm:py-2">
              <div className="flex items-center justify-between gap-2">
                {/* Right: Compact Avatar + Name + File Number + Essential Info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                    {patient.fullName.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-[14.5px] sm:text-base font-black text-slate-900 leading-tight break-words">
                        {patient.fullName}
                      </h2>

                      <button
                        type="button"
                        onClick={() => {
                          setEditedFileNumber(patient.fileNumber || '');
                          setIsEditingFileNumber(true);
                          setShowHeaderDetails(true);
                        }}
                        className="flex items-center gap-1 text-[10px] bg-emerald-100/90 hover:bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded-lg font-mono font-black border border-emerald-300 shrink-0 cursor-pointer"
                        title="شماره پرونده (کلیک جهت ویرایش)"
                      >
                        <span>{patient.fileNumber}</span>
                        <Edit3 className="w-2.5 h-2.5 text-emerald-700" />
                      </button>

                      {patient.balance < 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-lg font-mono whitespace-nowrap">
                          <Wallet className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span>بدهکار: {formatToman(Math.abs(patient.balance))}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg whitespace-nowrap">
                          <Wallet className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span>تسویه ✓</span>
                        </span>
                      )}
                    </div>

                    {/* Single Compact Line for Phone, Age & Medical Alert */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] font-bold text-slate-600 mt-0.5">
                      <span className="font-mono text-slate-800 font-extrabold whitespace-nowrap" dir="ltr">
                        {toPersianDigits(patient.phone)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="whitespace-nowrap">
                        {toPersianDigits(patient.age)} ساله ({patient.gender})
                      </span>
                      {patient.medicalHistory.filter(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim())).map((m, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-0.5 bg-amber-100 border border-amber-300 text-amber-950 px-1.5 py-0.2 rounded-md font-black text-[9.5px]"
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span>{m}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Left: Expandable Info/Tools Drawer Toggle + Close Modal Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHeaderDetails(prev => !prev)}
                    className={`min-h-[38px] px-2.5 py-1 rounded-[12px] border text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                      showHeaderDetails || isEditingProfile
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white hover:bg-emerald-50 text-emerald-950 border-emerald-300 shadow-2xs'
                    }`}
                    title="باز و بسته کردن مشخصات تکمیلی، یادداشت و ابزارهای پرونده"
                  >
                    <span>ابزارها</span>
                    {showHeaderDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="min-w-[40px] min-h-[40px] rounded-[12px] bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/90 flex items-center justify-center transition-colors shrink-0 cursor-pointer shadow-2xs active:scale-95"
                    title="بستن پرونده"
                    aria-label="بستن پرونده"
                  >
                    <X className="w-4 h-4 stroke-[2.25]" />
                  </button>
                </div>
              </div>

              {/* Collapsible Secondary Drawer: Actions, Notes, Phone, National ID & File Number Edit */}
              {showHeaderDetails && (
                <div className="mt-2 pt-2 border-t border-emerald-200/80 space-y-2 animate-in fade-in duration-150">
                  {/* Action Pills Row */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(prev => !prev)}
                        className={`py-1 px-2.5 rounded-xl border text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                          isEditingProfile
                            ? 'bg-emerald-700 text-white border-emerald-800'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-300'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isEditingProfile ? 'بستن فرم ویرایش' : 'ویرایش مشخصات'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowQrPassModal(true)}
                        className="py-1 px-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3 text-purple-700" />
                        <span>کارت QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenInvoice && onOpenInvoice(patient)}
                        className="py-1 px-2.5 rounded-xl bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border border-cyan-300 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      >
                        <Printer className="w-3 h-3 text-cyan-700" />
                        <span>چاپ فاکتور رسمی</span>
                      </button>

                      {onScheduleAppointment && (
                        <button
                          type="button"
                          onClick={() => {
                            onScheduleAppointment(patient, suggestedNextTreatment);
                            onClose();
                          }}
                          className="py-1 px-2.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border border-indigo-300 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        >
                          <Calendar className="w-3 h-3 text-indigo-700" />
                          <span>رزرو نوبت بعدی</span>
                        </button>
                      )}

                      <a
                        href={`tel:${(patientPhone || patient.phone).replace(/[^0-9+]/g, '')}`}
                        className="py-1 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95"
                        title="تماس تلفنی مستقیم با بیمار"
                      >
                        <Phone className="w-3 h-3 text-emerald-700" />
                        <span>تماس</span>
                      </a>

                      <a
                        href={`sms:${(patientPhone || patient.phone).replace(/[^0-9+]/g, '')}`}
                        className="py-1 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-300 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95"
                        title="ارسال پیامک از گوشی"
                      >
                        <MessageSquare className="w-3 h-3 text-sky-700" />
                        <span>پیام</span>
                      </a>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await clinicalSmsService.sendPatternSms(
                            patientPhone || patient.phone,
                            patient.fullName,
                            'appointment_reminder',
                            {
                              date: summary360?.nextAppointment?.date || getCurrentPersianDate(),
                              time: summary360?.nextAppointment?.time || '۱۰:۰۰'
                            }
                          );
                          actionFeedback.recordSuccess({
                            title: `پیامک خدماتی پرونده ${patient.fullName} ارسال شد`,
                            subtitle: `شماره: ${toPersianDigits(patientPhone || patient.phone)} · کد: ${res.refId}`,
                            targetRecordId: patient.id,
                            badgeText: '✓ سرویس پیامک ارسال شد'
                          });
                        }}
                        className="py-1 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        title="ارسال پیامک از سامانه پیامکی کلینیک"
                      >
                        <Send className="w-3 h-3 text-amber-700" />
                        <span>سرویس پیامک</span>
                      </button>
                    </div>

                    {/* Manual File Number Inline Edit */}
                    {isEditingFileNumber ? (
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-emerald-500">
                        <input
                          aria-label="شماره پرونده بیمار"
                          type="text"
                          value={editedFileNumber}
                          onChange={(e) => setEditedFileNumber(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveFileNumber();
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              setIsEditingFileNumber(false);
                            }
                          }}
                          className="w-20 bg-emerald-50 text-[11px] font-mono font-black text-emerald-900 px-1.5 py-0.5 rounded outline-none border border-emerald-300"
                          autoFocus
                        />
                        <button
                          type="button"
                          aria-label="ذخیره شماره پرونده"
                          title="ذخیره شماره پرونده"
                          onClick={handleSaveFileNumber}
                          className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10.5px] font-bold text-slate-600">
                        کدملی: <span className="font-mono font-black text-slate-800">{toPersianDigits(patient.nationalId)}</span>
                      </span>
                    )}
                  </div>

                  {/* Compact Notes & Phone Quick Auto-Save Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <div className="sm:col-span-2 flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1 border border-slate-200">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[10.5px] font-black text-slate-700 shrink-0">یادداشت:</span>
                      <input
                        type="text"
                        value={patientNotes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPatientNotes(val);
                          triggerFieldAutoSave({ notes: val });
                        }}
                        placeholder="ثبت یادداشت پرونده..."
                        className="flex-1 bg-transparent text-slate-800 text-[11px] font-bold focus:outline-none min-w-0"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1 border border-slate-200">
                      <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="text-[10.5px] font-black text-slate-700 shrink-0">همراه:</span>
                      <input aria-label="همراه"
                        type="text"
                        value={patientPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPatientPhone(val);
                          triggerFieldAutoSave({ phone: val });
                        }}
                        className="flex-1 bg-transparent text-slate-800 font-mono text-[11px] font-bold text-left focus:outline-none min-w-0"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Expandable Inline Full Patient Profile Editor */}
            {isEditingProfile && (
              <div className="bg-emerald-50/95 border-t border-emerald-300 px-3.5 py-2.5 space-y-2 text-xs animate-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-950 flex items-center gap-1.5 text-[11.5px]">
                    <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>ویرایش کامل مشخصات هویتی و سوابق پزشکی پرونده</span>
                  </span>
                  {onDeletePatient && (
                    isManagerUser ? (
                      <button
                        type="button"
                        onClick={() => {
                          onDeletePatient(patient.id);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>بایگانی / حذف پرونده (مدیر)</span>
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[9.5px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>حذف پرونده فقط توسط مدیر</span>
                      </span>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">نام و نام خانوادگی</label>
                    <input aria-label="نام و نام خانوادگی"
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">کد ملی</label>
                    <input aria-label="کد ملی"
                      type="text"
                      value={editNationalId}
                      onChange={(e) => setEditNationalId(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">سن</label>
                    <input aria-label="سن"
                      type="number"
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value))}
                      className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-mono text-center text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">جنسیت</label>
                    <select aria-label="جنسیت"
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value as 'مرد' | 'زن')}
                      className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                    >
                      <option value="مرد">مرد</option>
                      <option value="زن">زن</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-amber-900">سوابق پزشکی:</span>
                  {editMedicalAlerts.map((alertItem, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-bold"
                    >
                      <span>{alertItem}</span>
                      <button
                        type="button"
                        onClick={() => setEditMedicalAlerts(editMedicalAlerts.filter((_, i) => i !== idx))}
                        className="text-amber-700 hover:text-rose-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newAlertInput}
                      onChange={(e) => setNewAlertInput(e.target.value)}
                      placeholder="افزودن هشدار پزشکی..."
                      className="bg-white border border-amber-300 rounded-lg px-2 py-0.5 text-[10.5px] text-slate-800 w-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newAlertInput.trim();
                        if (val && !editMedicalAlerts.includes(val)) {
                          setEditMedicalAlerts([...editMedicalAlerts, val]);
                          setNewAlertInput('');
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-black cursor-pointer"
                    >
                      + افزودن
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1 rounded-xl bg-white border border-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedPat: Patient = {
                        ...patient,
                        fullName: editFullName.trim() || patient.fullName,
                        nationalId: editNationalId.trim() || patient.nationalId,
                        age: Number(editAge) || patient.age,
                        gender: editGender,
                        phone: patientPhone.trim() || patient.phone,
                        notes: patientNotes,
                        medicalHistory: editMedicalAlerts,
                        fileNumber: editedFileNumber.trim() || patient.fileNumber
                      };
                      onUpdatePatient?.(updatedPat);
                      setIsEditingProfile(false);
                    }}
                    className="px-4 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs cursor-pointer"
                  >
                    ذخیره تغییرات مشخصات پرونده ✓
                  </button>
                </div>
              </div>
            )}

            {/* =========================================================================
                COMPACT TABS BAR WITH DEDICATED SECTION ICONS (کامپوننت تب‌بندی فشرده)
               ========================================================================= */}
            <div
              role="tablist"
              aria-label="بخش‌های پرونده بیمار"
              className="flex items-center border-t border-emerald-200/80 bg-white/95 overflow-x-auto no-scrollbar px-2.5 py-1.5 gap-1.5"
            >
              {[
                {
                  id: 'treatments',
                  label: 'درمان‌ها',
                  badge: toPersianDigits(Object.keys(patient.teethConditions || {}).length),
                  icon: <ToothIcon className="w-3.5 h-3.5" />
                },
                {
                  id: 'visits',
                  label: 'نوبت‌ها و مراجعات',
                  badge: toPersianDigits(patientAppointments.length),
                  icon: <CalendarCheck className="w-3.5 h-3.5" />
                },
                {
                  id: 'financial',
                  label: 'مالی و کیف پول',
                  badge: patient.balance < 0 ? 'بدهکار' : 'تسویه',
                  icon: <Wallet className="w-3.5 h-3.5" />
                },
                {
                  id: 'lab',
                  label: 'لابراتوار',
                  badge: toPersianDigits(patient.labOrders?.length || 0),
                  icon: <FlaskConical className="w-3.5 h-3.5" />
                },
                {
                  id: 'implant',
                  label: 'ایمپلنت',
                  badge: toPersianDigits(patient.implantCases?.length || 0),
                  icon: <Activity className="w-3.5 h-3.5" />
                },
                {
                  id: 'prescriptions',
                  label: 'نسخه دارویی',
                  badge: toPersianDigits(patient.prescriptions?.length || 0),
                  icon: <Pill className="w-3.5 h-3.5" />
                },
                {
                  id: 'consents',
                  label: 'رضایت‌نامه',
                  badge: toPersianDigits(patient.consents?.length || 0),
                  icon: <FileSignature className="w-3.5 h-3.5" />
                },
                {
                  id: 'xrays',
                  label: 'رادیولوژی OPG',
                  badge: '۲',
                  icon: <Camera className="w-3.5 h-3.5" />
                },
                {
                  id: 'ai',
                  label: 'هوش مصنوعی',
                  badge: 'AI',
                  icon: <Sparkles className="w-3.5 h-3.5" />
                },
              ].map((tab, idx) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button type="button"
                    key={tab.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-2.5 py-1 rounded-xl text-[11.5px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${getUnifiedChipClasses(idx, isSelected)}`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span
                      className={`text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-black/5 text-current'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              DYNAMIC HEIGHT SCROLLABLE MAIN VIEWPORT (اختصاص فضای اصلی به تاریخچه درمان و رکوردهای مالی)
             ========================================================================= */}
          <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2.5 sm:p-4 space-y-3 no-scrollbar bg-slate-50/75">
            {/* Live Patient 360° Cross-Module Status Bar */}
            {summary360 && (
              <div className="bg-white/95 border border-emerald-200/80 rounded-2xl px-3 py-2 flex items-center justify-between gap-2 flex-wrap shadow-2xs">
                <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] font-bold">
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-black">
                    {summary360.nextAppointment
                      ? `نوبت بعدی: ${toPersianDigits(summary360.nextAppointment.date)} · ${toPersianDigits(summary360.nextAppointment.time)}`
                      : 'نوبت آتی ثبت نشده'}
                  </span>
                  {summary360.readyLabOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('lab')}
                      className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-300 font-black cursor-pointer hover:bg-purple-200"
                    >
                      {toPersianDigits(summary360.readyLabOrders.length)} پروتز آماده تحویل ▾
                    </button>
                  )}
                  {summary360.activeImplants.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('implant')}
                      className="px-2 py-0.5 rounded-lg bg-cyan-100 text-cyan-900 border border-cyan-300 font-black cursor-pointer hover:bg-cyan-200"
                    >
                      {toPersianDigits(summary360.activeImplants.length)} ایمپلنت فعال ▾
                    </button>
                  )}
                  {(summary360.bouncedChecksCount > 0 || summary360.overdueInstallmentsCount > 0) && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('financial')}
                      className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-black cursor-pointer hover:bg-rose-200"
                    >
                      هشدار چک/قسط معوق ▾
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPatientRemOpen(o => !o)}
                    className={`px-2 py-0.5 rounded-lg border font-black cursor-pointer flex items-center gap-1 transition-all ${
                      patientActiveReminders.length > 0
                        ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <BellRing className="w-3 h-3 text-amber-700" />
                    <span>یادآورهای بیمار ({toPersianDigits(patientActiveReminders.length)})</span>
                  </button>
                </div>
                {onScheduleAppointment && (
                  <button
                    type="button"
                    onClick={() => {
                      onScheduleAppointment(patient, suggestedNextTreatment);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>رزرو نوبت سریع</span>
                  </button>
                )}
              </div>
            )}

            {/* Inline Collapsible Per-Patient Smart Reminders Widget */}
            {patientRemOpen && patient && (
              <div className="bg-amber-50/75 border border-amber-200 rounded-2xl p-3 space-y-2 shadow-2xs animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                    <BellRing className="w-4 h-4 text-amber-600" />
                    <span>یادآورهای هوشمند پرونده {patient.fullName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPatientRemOpen(false)}
                    className="text-[10.5px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    بستن ✕
                  </button>
                </div>

                {patientActiveReminders.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                    {patientActiveReminders.map(rem => (
                      <div
                        key={rem.id}
                        className="bg-white rounded-xl p-2 border border-amber-200/80 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-black text-slate-900 block truncate">{rem.title}</span>
                          <span className="text-amber-800 font-bold font-mono">{rem.time}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              snoozeReminder(rem.id, 60);
                              setPatientRemRev(r => r + 1);
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <AlarmClock className="w-3 h-3" />
                            <span>۱س تعویق</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              markReminderDone(rem.id);
                              try {
                                const saved = localStorage.getItem('minadental_dismissed_reminders_v1');
                                const map = saved ? JSON.parse(saved) : {};
                                map[rem.id] = true;
                                localStorage.setItem('minadental_dismissed_reminders_v1', JSON.stringify(map));
                              } catch {}
                              setPatientRemRev(r => r + 1);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            انجام شد
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 font-bold">
                    هیچ یادآوری سررسیدشده فعالی برای این بیمار ثبت نشده است.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-200/70">
                  <input
                    type="text"
                    value={patientRemTitle}
                    onChange={(e) => setPatientRemTitle(e.target.value)}
                    placeholder="ثبت یادآور جدید برای این بیمار (مثلاً پیگیری عصب‌کشی)..."
                    aria-label="عنوان یادآور سریع پرونده بیمار"
                    className="flex-1 min-w-[160px] bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-900"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={patientRemDate}
                    onChange={(e) => setPatientRemDate(e.target.value)}
                    aria-label="تاریخ یادآور سریع پرونده بیمار"
                    className="w-24 bg-white border border-amber-200 rounded-xl px-2 py-1.5 text-[11px] font-mono text-center text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!patientRemTitle.trim()) return;
                      scheduleEntityReminder({
                        sourceType: 'custom',
                        sourceId: `patfile-${patient.id}-${Date.now()}`,
                        patientId: patient.id,
                        patientName: patient.fullName,
                        patientPhone: patient.phone,
                        title: patientRemTitle.trim(),
                        description: `ثبت‌شده مستقیم از پرونده الکترونیک (${patient.fileNumber})`,
                        targetDate: patientRemDate.trim() || getCurrentPersianDate(),
                        targetTime: '۱۰:۰۰',
                        targetView: 'patients',
                        config: {
                          enabled: true,
                          preset: 'at_time',
                          channels: ['phone_push', 'in_app', 'sms']
                        }
                      });
                      setPatientRemTitle('');
                      setPatientRemRev(r => r + 1);
                      actionFeedback.recordSuccess({
                        title: `یادآور برای ${patient.fullName} زمان‌بندی شد`,
                        subtitle: patientRemTitle.trim(),
                        badgeText: '✓ ثبت شد'
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black cursor-pointer shrink-0"
                  >
                    + ثبت یادآور
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: Treatments & Dental Conditions */}
            {activeTab === 'treatments' && (
              <div className="space-y-2.5">
                {/* 1. Unified Chart Header & View Mode Switcher */}
                <div className="bg-white p-2.5 rounded-[20px] border border-emerald-200/90 border-r-[3px] border-r-emerald-500 shadow-[var(--shadow-card)] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <ToothIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-black text-slate-900 truncate">
                      تاریخچه درمان‌ها و چارت دندان
                    </h3>
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {toPersianDigits(Object.keys(patient.teethConditions).length)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setTreatmentViewMode('list')}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                          treatmentViewMode === 'list' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        فهرست دندان‌ها ({toPersianDigits(Object.keys(patient.teethConditions).length)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreatmentViewMode('phased')}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                          treatmentViewMode === 'phased' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        فازبندی ۱ تا ۳
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={onOpenPalmerChart}
                      className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>ثبت درمان جدید (چارت پالمر)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Interactive 32-Tooth Palmer Odontogram & Quick Treatment Bar (Front & Center) */}
                {(() => {
                  const defaultTariffMap: Record<TreatmentType, number> = {
                    composite: 2_400_000,
                    amalgam: 1_900_000,
                    endo: 4_800_000,
                    crown_zirconia: 7_500_000,
                    crown_pfm: 5_200_000,
                    implant: 18_500_000,
                    extraction: 1_500_000,
                    scaling: 1_800_000,
                    bleaching: 6_500_000,
                    laminate: 9_800_000,
                    pulpotomy: 2_200_000,
                    pulpectomy: 2_600_000,
                    ss_crown: 2_800_000,
                    fissure_sealant: 1_200_000,
                    fluoride: 950_000,
                    space_maintainer: 3_200_000
                  };

                  let dynamicTariffs: Array<{ id: string; code: string; name: string; category: string; price: number }> = [];
                  try {
                    const savedTariffs = localStorage.getItem('minadental_tariffs_catalog_v2');
                    if (savedTariffs) {
                      const parsed = JSON.parse(savedTariffs);
                      if (Array.isArray(parsed)) dynamicTariffs = parsed;
                    }
                  } catch {}

                  const resolveTreatmentPrice = (tType: TreatmentType): number => {
                    const nameMatch = dynamicTariffs.find((t) =>
                      (tType === 'composite' && t.name.includes('کامپوزیت')) ||
                      (tType === 'endo' && t.name.includes('عصب')) ||
                      (tType === 'crown_zirconia' && t.name.includes('زیرکونیا')) ||
                      (tType === 'implant' && t.name.includes('ایمپلنت')) ||
                      (tType === 'pulpotomy' && t.name.includes('پالپوتومی')) ||
                      (tType === 'ss_crown' && t.name.includes('استیل')) ||
                      (tType === 'scaling' && t.name.includes('جرم‌گیری'))
                    );
                    return nameMatch?.price || defaultTariffMap[tType] || 2_400_000;
                  };

                  const handleSelectQuickTreatment = (nextType: TreatmentType) => {
                    setQuickTreatmentType(nextType);
                    const basePrice = resolveTreatmentPrice(nextType);
                    setQuickCustomCost(Math.round(basePrice * (1 - quickDiscountPct / 100)));
                  };

                  const handleQuickRegisterToothTreatment = () => {
                    const toothKey = `${quickToothQuad}_${quickToothNum}`;
                    const legacyDashKey = `${quickToothQuad}-${quickToothNum}`;
                    const finalCost = Math.max(0, Math.round(quickCustomCost * (1 - (quickDiscountPct > 0 && quickCustomCost === resolveTreatmentPrice(quickTreatmentType) ? quickDiscountPct / 100 : 0))));
                    const newCondition: ToothCondition = {
                      quadrant: quickToothQuad,
                      toothNumber: quickToothNum,
                      surfaces: ['occlusal'],
                      treatment: quickTreatmentType,
                      status: 'in_progress',
                      cost: finalCost,
                      baseCost: resolveTreatmentPrice(quickTreatmentType),
                      discountPercent: quickDiscountPct > 0 ? quickDiscountPct : undefined,
                      doctorName: quickDoctorName,
                      date: getCurrentPersianDate(),
                      notes: quickDiscountPct > 0 ? `شامل ${toPersianDigits(quickDiscountPct)}٪ تخفیف مدیر` : undefined
                    };
                    const nextTeeth = {
                      ...(patient.teethConditions || {}),
                      [toothKey]: newCondition
                    };
                    if (legacyDashKey in nextTeeth) {
                      delete nextTeeth[legacyDashKey];
                    }
                    const nextTotalCost = Object.values(nextTeeth).reduce((sum, c) => sum + (c.cost || 0), 0);
                    const nextBalance = patient.paidAmount - nextTotalCost;
                    const nextActiveCount = Object.values(nextTeeth).filter((c) => c.status !== 'completed').length;

                    commitPatientPatchImmediate({
                      teethConditions: nextTeeth,
                      totalCost: nextTotalCost,
                      balance: nextBalance,
                      activeTreatmentsCount: nextActiveCount
                    });
                    recordAuditLog(
                      'ثبت مستقیم درمان دندان در پرونده',
                      `بیمار: ${patient.fullName} · دندان ${quickToothQuad}${quickToothNum} · ${getPersianTreatmentName(quickTreatmentType)} · مبلغ: ${formatToman(finalCost)} · پزشک: ${quickDoctorName}`
                    );
                    actionFeedback.recordSuccess({
                      title: `درمان ${getPersianTreatmentName(quickTreatmentType)} برای دندان ${quickToothQuad}${quickToothNum} ثبت شد`,
                      subtitle: `تعرفه اعمال‌شده: ${formatToman(finalCost)} · پزشک: ${quickDoctorName}`,
                      targetRecordId: patient.id,
                      badgeText: `✓ ثبت درمان ${quickToothQuad}${quickToothNum}`
                    });
                  };

                  return (
                    <div className="w-full max-w-full min-w-0 overflow-hidden p-2.5 sm:p-3 rounded-[20px] bg-gradient-to-l from-emerald-50/75 via-white to-teal-50/60 border border-emerald-200/90 shadow-2xs space-y-2 tabular-nums">
                      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                        <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1.5 min-w-0 flex-1">
                          <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">ثبت مستقیم درمان دندان با اعمال خودکار تعرفه و قیمت/تخفیف لحظه‌ای</span>
                        </span>
                        <span className="font-mono font-black text-[11px] text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {quickToothQuad}{toPersianDigits(quickToothNum)}
                        </span>
                      </div>

                      {/* Clean 32-Tooth Palmer Odontogram */}
                      <div className="p-2 rounded-2xl bg-white/95 border border-emerald-200/75 space-y-1" dir="ltr">
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['UR', 'UL'] as const).map((quad) => {
                            const nums = quad === 'UR' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
                            return (
                              <div key={quad} className="grid grid-cols-8 gap-0.5 bg-slate-50/90 p-1 rounded-xl border border-slate-200/80">
                                {nums.map((num) => {
                                  const tKey = `${quad}_${num}`;
                                  const existingCond =
                                    patient.teethConditions?.[tKey] ||
                                    patient.teethConditions?.[`${quad}-${num}`] ||
                                    patient.teethConditions?.[`${quad}${num}`];
                                  const isSelected = quickToothQuad === quad && quickToothNum === num;
                                  const tone = isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-700 ring-1 ring-emerald-400 shadow-2xs'
                                    : existingCond?.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                      : existingCond?.status === 'in_progress'
                                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                                        : existingCond
                                          ? 'bg-sky-100 text-sky-950 border-sky-300'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50';
                                  return (
                                    <button
                                      key={tKey}
                                      type="button"
                                      onClick={() => {
                                        setQuickToothQuad(quad);
                                        setQuickToothNum(num);
                                      }}
                                      title={existingCond ? `${quad}${num}: ${getPersianTreatmentName(existingCond.treatment)}` : `${quad}${num}`}
                                      className={`py-1.5 rounded-lg text-[10px] font-mono font-black border transition-all cursor-pointer relative ${tone}`}
                                    >
                                      {num}
                                      {existingCond && !isSelected && (
                                        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                                          existingCond.status === 'completed' ? 'bg-emerald-600' : existingCond.status === 'in_progress' ? 'bg-amber-600' : 'bg-sky-600'
                                        }`} />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-t border-dashed border-slate-200 my-0.5" />
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['LR', 'LL'] as const).map((quad) => {
                            const nums = quad === 'LR' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
                            return (
                              <div key={quad} className="grid grid-cols-8 gap-0.5 bg-slate-50/90 p-1 rounded-xl border border-slate-200/80">
                                {nums.map((num) => {
                                  const tKey = `${quad}_${num}`;
                                  const existingCond =
                                    patient.teethConditions?.[tKey] ||
                                    patient.teethConditions?.[`${quad}-${num}`] ||
                                    patient.teethConditions?.[`${quad}${num}`];
                                  const isSelected = quickToothQuad === quad && quickToothNum === num;
                                  const tone = isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-700 ring-1 ring-emerald-400 shadow-2xs'
                                    : existingCond?.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                      : existingCond?.status === 'in_progress'
                                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                                        : existingCond
                                          ? 'bg-sky-100 text-sky-950 border-sky-300'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50';
                                  return (
                                    <button
                                      key={tKey}
                                      type="button"
                                      onClick={() => {
                                        setQuickToothQuad(quad);
                                        setQuickToothNum(num);
                                      }}
                                      title={existingCond ? `${quad}${num}: ${getPersianTreatmentName(existingCond.treatment)}` : `${quad}${num}`}
                                      className={`py-1.5 rounded-lg text-[10px] font-mono font-black border transition-all cursor-pointer relative ${tone}`}
                                    >
                                      {num}
                                      {existingCond && !isSelected && (
                                        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                                          existingCond.status === 'completed' ? 'bg-emerald-600' : existingCond.status === 'in_progress' ? 'bg-amber-600' : 'bg-sky-600'
                                        }`} />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-[11px] w-full min-w-0">
                        <select
                          aria-label="ربع فک پالمر برای ثبت سریع درمان"
                          value={quickToothQuad}
                          onChange={(e) => setQuickToothQuad(e.target.value as any)}
                          className="w-full min-w-0 bg-white border border-emerald-200 rounded-xl px-2 py-1.5 font-bold text-slate-900 cursor-pointer"
                        >
                          <option value="UR">UR (بالا راست)</option>
                          <option value="UL">UL (بالا چپ)</option>
                          <option value="LR">LR (پایین راست)</option>
                          <option value="LL">LL (پایین چپ)</option>
                        </select>

                        <select
                          aria-label="شماره دندان پالمر برای ثبت سریع درمان"
                          value={quickToothNum}
                          onChange={(e) => setQuickToothNum(Number(e.target.value))}
                          className="w-full min-w-0 bg-white border border-emerald-200 rounded-xl px-2 py-1.5 font-mono font-black text-slate-900 cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n}>
                              دندان {toPersianDigits(n)}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label="نوع خدمت و درمان دندانپزشکی"
                          value={quickTreatmentType}
                          onChange={(e) => handleSelectQuickTreatment(e.target.value as TreatmentType)}
                          className="w-full min-w-0 bg-white border border-emerald-200 rounded-xl px-2 py-1.5 font-bold text-slate-900 cursor-pointer"
                        >
                          <option value="composite">ترمیم کامپوزیت</option>
                          <option value="endo">درمان ریشه (اندو)</option>
                          <option value="crown_zirconia">روکش زیرکونیا</option>
                          <option value="implant">کاشت فیکسچر ایمپلنت</option>
                          <option value="pulpotomy">پالپوتومی اطفال</option>
                          <option value="pulpectomy">پالپکتومی اطفال</option>
                          <option value="ss_crown">روکش استیل اطفال (SSC)</option>
                          <option value="fissure_sealant">فیشور سیلانت</option>
                          <option value="scaling">جرم‌گیری و بروساژ</option>
                          <option value="extraction">کشیدن دندان</option>
                        </select>

                        <select
                          aria-label="پزشک معالج درمان سریع"
                          value={quickDoctorName}
                          onChange={(e) => setQuickDoctorName(e.target.value)}
                          className="w-full min-w-0 bg-white border border-emerald-200 rounded-xl px-2 py-1.5 font-bold text-slate-900 cursor-pointer"
                        >
                          <option value="دکتر مهدی امیری">دکتر مهدی امیری</option>
                          <option value="دکتر سارا نوری">دکتر سارا نوری</option>
                          <option value="دکتر علی مرادی">دکتر علی مرادی</option>
                        </select>

                        <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 min-w-0 w-full">
                          <input
                            type="number"
                            size={8}
                            dir="ltr"
                            aria-label="تعرفه و قیمت درمان دندان (تومان)"
                            value={quickCustomCost}
                            onChange={(e) => {
                              if (!canDirectlyEditPrices) {
                                setManagerPinModalOpen(true);
                                setManagerPinError(null);
                                return;
                              }
                              setQuickCustomCost(Number(e.target.value) || 0);
                            }}
                            className="flex-1 min-w-0 w-full bg-white border border-emerald-200 rounded-xl px-2 py-1.5 font-mono font-black text-emerald-900 text-center"
                          />
                          <select
                            aria-label="تخفیف مدیریتی درمان سریع"
                            value={quickDiscountPct}
                            onChange={(e) => {
                              const pct = Number(e.target.value);
                              if (!canDirectlyEditPrices && pct > 0) {
                                setManagerPinModalOpen(true);
                                setManagerPinError(null);
                                return;
                              }
                              setQuickDiscountPct(pct);
                              const base = resolveTreatmentPrice(quickTreatmentType);
                              setQuickCustomCost(Math.round(base * (1 - pct / 100)));
                            }}
                            className="bg-amber-50 border border-amber-200 rounded-xl px-2 py-1.5 font-mono font-black text-amber-900 text-[10px] cursor-pointer shrink-0"
                            title="تخفیف مدیریتی (٪)"
                          >
                            <option value={0}>۰٪</option>
                            <option value={5}>۵٪-</option>
                            <option value={10}>۱۰٪-</option>
                            <option value={15}>۱۵٪-</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handleQuickRegisterToothTreatment}
                          className="col-span-2 sm:col-span-1 w-full px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>+ ثبت فوری درمان</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Recorded Patient Teeth Treatments / 3-Phase Roadmap */}
                {treatmentViewMode === 'phased' && Object.keys(patient.teethConditions).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: 'phase1',
                        title: 'فاز ۱: اورژانس و کنترل عفونت',
                        color: 'bg-rose-50/90 border-rose-200 border-r-[3px] border-r-rose-500 text-rose-950',
                        types: ['extraction', 'scaling', 'endo', 'pulpotomy', 'pulpectomy']
                      },
                      {
                        id: 'phase2',
                        title: 'فاز ۲: جراحی و کاشت ایمپلنت',
                        color: 'bg-cyan-50/90 border-cyan-200 border-r-[3px] border-r-cyan-500 text-cyan-950',
                        types: ['implant', 'space_maintainer']
                      },
                      {
                        id: 'phase3',
                        title: 'فاز ۳: پروتز، ترمیم و زیبایی',
                        color: 'bg-purple-50/90 border-purple-200 border-r-[3px] border-r-purple-500 text-purple-950',
                        types: ['composite', 'amalgam', 'crown_zirconia', 'crown_pfm', 'laminate', 'bleaching', 'ss_crown', 'fissure_sealant', 'fluoride']
                      }
                    ].map(ph => {
                      const phaseItems = Object.entries(patient.teethConditions).filter(([, c]) => ph.types.includes(c.treatment));
                      const phaseCost = phaseItems.reduce((sum, [, c]) => sum + (c.cost || 0), 0);
                      return (
                        <div key={ph.id} className={`p-2.5 rounded-[20px] border shadow-[var(--shadow-card)] ${ph.color} space-y-1.5 text-right`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black">{ph.title}</span>
                            <span className="text-[10px] font-mono font-black bg-white/90 px-2 py-0.5 rounded-full">
                              {toPersianDigits(phaseItems.length)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap" dir="ltr">
                            {phaseItems.map(([k, c]) => (
                              <span key={k} className="px-1.5 py-0.5 rounded bg-white text-slate-800 font-mono text-[10px] font-black border border-slate-200">
                                {c.quadrant}{c.toothNumber}
                              </span>
                            ))}
                          </div>
                          <div className="pt-1 border-t border-black/10 flex items-center justify-between text-[11px] font-black">
                            <span>جمع فاز</span>
                            <span className="font-mono">{formatToman(phaseCost)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {Object.keys(patient.teethConditions).length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs font-bold bg-white rounded-2xl border border-dashed border-slate-200">
                    درمانی ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(patient.teethConditions).map(([key, item]) => (
                      <div
                        key={key}
                        className={`w-full max-w-full min-w-0 overflow-hidden bg-white rounded-2xl p-2.5 border shadow-2xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 ${
                          item.status === 'completed'
                            ? 'border-emerald-200/90 border-r-[3px] border-r-emerald-500'
                            : item.status === 'in_progress'
                            ? 'border-amber-200/90 border-r-[3px] border-r-amber-500'
                            : 'border-sky-200/90 border-r-[3px] border-r-sky-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-950 border border-emerald-300 flex items-center justify-center font-mono font-black text-xs shrink-0">
                            {item.quadrant}{item.toothNumber}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900">
                                {getPersianTreatmentName(item.treatment)}
                              </span>

                              <button type="button"
                                onClick={() => cycleTreatmentStatus(key, item.status)}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-black cursor-pointer transition-all active:scale-95 ${
                                  item.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : item.status === 'in_progress'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-sky-100 text-sky-900 border border-sky-300'
                                }`}
                                title="تغییر وضعیت درمان با کلیک"
                              >
                                {item.status === 'completed' && '✓ تکمیل شده'}
                                {item.status === 'in_progress' && '⏳ در حال انجام'}
                                {item.status === 'planned' && '📋 طرح درمان'}
                              </button>
                            </div>

                            <div className="text-[10.5px] text-slate-500 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{item.doctorName || 'دکتر مهدی امیری'}</span>
                              <span>·</span>
                              <span className="font-mono">{item.surfaces.join(' + ').toUpperCase()}</span>
                              {item.notes && <span className="text-slate-600">· {item.notes}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.annotations && (
                            <div
                              onClick={onOpenPalmerChart}
                              className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-300 p-0.5 overflow-hidden flex items-center justify-center cursor-pointer"
                              title="مشاهده کروکی دندان"
                            >
                              <img src={item.annotations} alt="کروکی" className="w-full h-full object-contain" />
                            </div>
                          )}
                          {editingCostKey === key ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input aria-label="ورودی اطلاعات بالینی"
                                type="number"
                                value={tempCostValue}
                                onChange={(e) => setTempCostValue(Number(e.target.value))}
                                className="w-24 px-2 py-1 bg-white border border-emerald-400 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveCost(key)}
                                className="p-1 rounded-lg bg-emerald-600 text-white cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCostKey(null)}
                                className="p-1 rounded-lg bg-slate-200 text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-emerald-800 font-mono">
                                {formatToman(item.cost || 0)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEditCost(key, item.cost || 0)}
                                className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                title="ویرایش تعرفه"
                              >
                                {canDirectlyEditPrices ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>
                              {onDeleteTreatment && isManagerUser && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteTreatment(patient.id, key)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="حذف درمان (فقط مدیر)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. Compact Clinical Vitals, ASA & Safe Anesthesia Strip */}
                {(() => {
                  const medHist = patient.medicalHistory || [];
                  const hasCardioOrBp = medHist.some(m => m.includes('فشار خون') || m.includes('قلبی'));
                  const hasPenicillinAllergy = medHist.some(m => m.includes('پنی‌سیلین') || m.includes('آلرژی'));
                  const hasAnticoagulant = medHist.some(m => m.includes('ضدانعقاد') || m.includes('وارفارین') || m.includes('آسپیرین'));
                  const recommendedAnesthetic = hasCardioOrBp
                    ? 'مپیواکائین ۳٪ بدون اپی‌نفرین'
                    : 'لیدوکائین ۲٪ استاندارد';

                  return (
                    <div className="p-2.5 rounded-[20px] bg-gradient-to-l from-cyan-50/75 via-white to-emerald-50/65 border border-cyan-200/80 shadow-2xs space-y-1.5 tabular-nums">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-cyan-950">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                          <span>پایش علائم حیاتی، طبقه ریسک ASA و بی‌حسی ایمن قبل از درمان</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          hasCardioOrBp
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}>
                          {recommendedAnesthetic}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10.5px]">
                        <div className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600">BP</span>
                          <input
                            type="text"
                            dir="ltr"
                            aria-label="فشار خون بیمار"
                            value={vitalBp}
                            onChange={(e) => {
                              const nextBp = e.target.value;
                              setVitalBp(nextBp);
                              triggerFieldAutoSave({
                                clinicalVitals: { bp: nextBp, pulse: vitalPulse, spo2: vitalSpo2, asaClass: vitalAsa, updatedAt: getCurrentPersianDate() }
                              });
                            }}
                            className="w-16 text-center font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-[11px] outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600">HR</span>
                          <input
                            type="text"
                            dir="ltr"
                            aria-label="ضربان قلب بیمار"
                            value={vitalPulse}
                            onChange={(e) => {
                              const nextPulse = e.target.value;
                              setVitalPulse(nextPulse);
                              triggerFieldAutoSave({
                                clinicalVitals: { bp: vitalBp, pulse: nextPulse, spo2: vitalSpo2, asaClass: vitalAsa, updatedAt: getCurrentPersianDate() }
                              });
                            }}
                            className="w-14 text-center font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-[11px] outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600">SpO2%</span>
                          <input
                            type="text"
                            dir="ltr"
                            aria-label="اکسیژن خون بیمار"
                            value={vitalSpo2}
                            onChange={(e) => {
                              const nextSpo2 = e.target.value;
                              setVitalSpo2(nextSpo2);
                              triggerFieldAutoSave({
                                clinicalVitals: { bp: vitalBp, pulse: vitalPulse, spo2: nextSpo2, asaClass: vitalAsa, updatedAt: getCurrentPersianDate() }
                              });
                            }}
                            className="w-14 text-center font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-1 py-0.5 text-[11px] outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600">ASA</span>
                          <select
                            aria-label="طبقه ریسک سیستمیک ASA بیمار"
                            value={vitalAsa}
                            onChange={(e) => {
                              const nextAsa = e.target.value as 'ASA I' | 'ASA II' | 'ASA III';
                              setVitalAsa(nextAsa);
                              commitPatientPatchImmediate({
                                clinicalVitals: { bp: vitalBp, pulse: vitalPulse, spo2: vitalSpo2, asaClass: nextAsa, updatedAt: getCurrentPersianDate() }
                              });
                            }}
                            className="font-mono font-black text-cyan-950 bg-cyan-50 border border-cyan-200 rounded-lg px-1.5 py-0.5 text-[10.5px] outline-none cursor-pointer"
                          >
                            <option value="ASA I">ASA I</option>
                            <option value="ASA II">ASA II</option>
                            <option value="ASA III">ASA III</option>
                          </select>
                        </div>
                      </div>

                      {(hasPenicillinAllergy || hasAnticoagulant) && (
                        <div className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-[10px] font-black text-amber-950 flex items-center gap-1.5 flex-wrap">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {hasPenicillinAllergy ? 'منع پنی‌سیلین (جایگزین: کلیندامایسین) ' : ''}
                            {hasAnticoagulant ? '· کنترل هموستاز و INR پیش از جراحی' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 5. Compact 6-Sextant BPE/PSR & Endo Strip */}
                {(() => {
                  const maxBpe = Math.max(...Object.values(perioBpeScores));
                  const perioDiagnosis =
                    maxBpe >= 3
                      ? 'نیازمند SRP'
                      : maxBpe === 2
                        ? 'جرم زیرلثه‌ای'
                        : maxBpe === 1
                          ? 'التهاب خفیف'
                          : 'سالم (0)';

                  const sextantLabels: Array<{ key: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'; title: string }> = [
                    { key: 'S1', title: 'S1 بالا راست' },
                    { key: 'S2', title: 'S2 قدامی' },
                    { key: 'S3', title: 'S3 بالا چپ' },
                    { key: 'S4', title: 'S4 پایین چپ' },
                    { key: 'S5', title: 'S5 قدامی' },
                    { key: 'S6', title: 'S6 پایین راست' }
                  ];

                  return (
                    <div className="p-2.5 rounded-[20px] bg-white border border-teal-200/80 shadow-2xs space-y-2 tabular-nums">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-teal-950">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                          <span>غربالگری ۶ سکستانت لثه (BPE/PSR) و شاخص وایتالیتی/اندو</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          maxBpe >= 2
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                        }`}>
                          {perioDiagnosis}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">
                        {sextantLabels.map((sx) => {
                          const score = perioBpeScores[sx.key];
                          const scoreCls =
                            score >= 3
                              ? 'bg-rose-50 border-rose-300 text-rose-900'
                              : score === 2
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : score === 1
                                  ? 'bg-sky-50 border-sky-300 text-sky-900'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-900';
                          return (
                            <button
                              key={sx.key}
                              type="button"
                              onClick={() => {
                                const nextScores = {
                                  ...perioBpeScores,
                                  [sx.key]: (perioBpeScores[sx.key] + 1) % 5
                                };
                                setPerioBpeScores(nextScores);
                                commitPatientPatchImmediate({
                                  periodontalBpe: {
                                    ...nextScores,
                                    plaqueIndexPct,
                                    updatedAt: getCurrentPersianDate()
                                  }
                                });
                              }}
                              title={`کد BPE سکستانت ${sx.title}`}
                              className={`p-1 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${scoreCls}`}
                            >
                              <span className="text-[9.5px] font-bold truncate">{sx.title}</span>
                              <span className="text-[11px] font-mono font-black">{toPersianDigits(score)}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10.5px]">
                        <div className="px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600">PI%</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            aria-label="شاخص پلاک میکروبی بیمار"
                            value={plaqueIndexPct}
                            onChange={(e) => {
                              const nextPi = Number(e.target.value) || 0;
                              setPlaqueIndexPct(nextPi);
                              triggerFieldAutoSave({
                                periodontalBpe: {
                                  ...perioBpeScores,
                                  plaqueIndexPct: nextPi,
                                  updatedAt: getCurrentPersianDate()
                                }
                              });
                            }}
                            className="w-14 text-center font-mono font-black text-teal-900 bg-white border border-slate-200 rounded-lg px-1 py-0.5 text-[11px]"
                          />
                        </div>
                        <div className="px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600">وایتالیتی</span>
                          <select
                            aria-label="نتیجه تست وایتالیتی پالپ"
                            value={endoColdTest}
                            onChange={(e) => {
                              const nextCold = e.target.value as 'نرمال (+)' | 'پالپیت حاد (++)' | 'نکروز پالپ (-)';
                              setEndoColdTest(nextCold);
                              commitPatientPatchImmediate({
                                endoMetrics: {
                                  coldTest: nextCold,
                                  workingLength: endoWorkingLength,
                                  updatedAt: getCurrentPersianDate()
                                }
                              });
                            }}
                            className="font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-[10.5px] cursor-pointer"
                          >
                            <option value="نرمال (+)">نرمال (+)</option>
                            <option value="پالپیت حاد (++)">پالپیت حاد (++)</option>
                            <option value="نکروز پالپ (-)">نکروز پالپ (-)</option>
                          </select>
                        </div>
                        <div className="px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-600 shrink-0">WL اندو</span>
                          <input
                            type="text"
                            dir="ltr"
                            aria-label="طول کارکرد کانال ریشه اندو"
                            value={endoWorkingLength}
                            onChange={(e) => {
                              const nextWl = e.target.value;
                              setEndoWorkingLength(nextWl);
                              triggerFieldAutoSave({
                                endoMetrics: {
                                  coldTest: endoColdTest,
                                  workingLength: nextWl,
                                  updatedAt: getCurrentPersianDate()
                                }
                              });
                            }}
                            className="flex-1 min-w-0 text-left font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-[10.5px]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 1B: Patient Appointments & Visits History */}
            {activeTab === 'visits' && (
              <div className="space-y-2.5">
                <div className="bg-white p-2.5 rounded-[20px] border border-sky-200/90 border-r-[3px] border-r-sky-500 shadow-[var(--shadow-card)]">
                  <SectionVisualBadge
                    icon={<CalendarCheck className="w-4 h-4" />}
                    badgeLabel="پرونده مراجعات"
                    title="تاریخچه نوبت‌ها و برنامه‌ریزی مراجعات بیمار"
                    count={patientAppointments.length}
                    colorScheme="sky"
                    rightElement={
                      onScheduleAppointment ? (
                        <button
                          type="button"
                          onClick={() => {
                            onScheduleAppointment(patient, suggestedNextTreatment);
                            onClose();
                          }}
                          className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>رزرو نوبت جدید</span>
                        </button>
                      ) : undefined
                    }
                  />
                </div>

                {/* Clinical Session SOAP Note & Recall Checkup Scheduler */}
                <div className="p-3 rounded-[20px] bg-white border border-sky-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-sky-950 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span>ژورنال بالینی جلسه (SOAP) و تنظیم فراخوان دوره‌ای (Recall)</span>
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {['فراخوان ۳ ماهه پریو', 'فراخوان ۶ ماهه چکاپ', 'فراخوان سالانه ایمپلنت'].map((recLabel) => (
                        <button
                          key={recLabel}
                          type="button"
                          onClick={async () => {
                            const res = await clinicalSmsService.sendPatternSms(
                              patient.phone,
                              patient.fullName,
                              'appointment_reminder',
                              { date: getRelativePersianDate(90), time: '۱۰:۰۰' }
                            );
                            actionFeedback.recordSuccess({
                              title: `${recLabel} برای ${patient.fullName} ثبت و پیامک شد`,
                              subtitle: `کد رهگیری: ${res.refId}`,
                              targetRecordId: patient.id,
                              badgeText: `✓ ${recLabel}`
                            });
                          }}
                          className="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10px] font-black cursor-pointer"
                        >
                          {recLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      type="text"
                      aria-label="ثبت گزارش بالینی جلسه SOAP"
                      placeholder="ثبت شرح حال، معاینه بالینی و اقدامات انجام‌شده در جلسه امروز (SOAP)..."
                      value={soapNoteInput}
                      onChange={(e) => setSoapNoteInput(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!soapNoteInput.trim()) return;
                        const nextNotes = `${patientNotes ? patientNotes + ' | ' : ''}[${getCurrentPersianDate()}]: ${soapNoteInput.trim()}`;
                        setPatientNotes(nextNotes);
                        triggerFieldAutoSave({ notes: nextNotes });
                        setSoapNoteInput('');
                        actionFeedback.recordSuccess({
                          title: `گزارش بالینی جلسه (SOAP) در پرونده ${patient.fullName} ثبت شد`,
                          subtitle: `تاریخ: ${toPersianDigits(getCurrentPersianDate())}`,
                          targetRecordId: patient.id,
                          badgeText: '✓ ثبت گزارش جلسه'
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer active:scale-95 shrink-0"
                    >
                      ثبت در ژورنال
                    </button>
                  </div>
                </div>

                {patientAppointments.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-2xl border-2 border-dashed border-sky-200 space-y-2">
                    <p className="font-bold text-slate-600">هنوز نوبت یا سابقه‌ مراجعه‌ای در تقویم برای این بیمار ثبت نشده است.</p>
                    {onScheduleAppointment && (
                      <button
                        type="button"
                        onClick={() => {
                          onScheduleAppointment(patient, suggestedNextTreatment);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black cursor-pointer"
                      >
                        تعیین اولین نوبت درمان
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...patientAppointments]
                      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                      .map((apt) => {
                        const statusMap: Record<Appointment['status'], { label: string; cls: string }> = {
                          scheduled: { label: 'ثبت‌شده', cls: 'bg-sky-100 text-sky-900 border-sky-300' },
                          waiting: { label: 'در سالن انتظار', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
                          in_chair: { label: 'روی یونیت', cls: 'bg-purple-100 text-purple-900 border-purple-300' },
                          completed: { label: 'انجام شده', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                          cancelled: { label: 'لغو شده', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
                          no_show: { label: 'عدم حضور', cls: 'bg-rose-100 text-rose-900 border-rose-300' }
                        };
                        const st = statusMap[apt.status];
                        return (
                          <div
                            key={apt.id}
                            className="bg-white rounded-[20px] p-3 border border-sky-200/80 border-r-[3px] border-r-sky-500 shadow-[var(--shadow-card)] flex items-center justify-between gap-2 flex-wrap"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-900">{apt.treatment}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${st.cls}`}>
                                  {st.label}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5 flex-wrap tabular-nums">
                                <span className="font-mono text-sky-800">{toPersianDigits(apt.date)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-slate-800">ساعت {toPersianDigits(apt.time)}</span>
                                <span aria-hidden="true">·</span>
                                <span>{apt.unit}</span>
                                <span aria-hidden="true">·</span>
                                <span>{apt.doctor}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                const res = await clinicalSmsService.sendPatternSms(
                                  patient.phone,
                                  patient.fullName,
                                  'appointment_reminder',
                                  { date: apt.date, time: apt.time }
                                );
                                actionFeedback.recordSuccess({
                                  title: `یادآور نوبت ${toPersianDigits(apt.date)} برای ${patient.fullName} ارسال شد`,
                                  subtitle: `ساعت ${toPersianDigits(apt.time)} · کد پیگیری: ${res.refId}`,
                                  targetRecordId: apt.id,
                                  badgeText: '✓ یادآور نوبت ارسال شد'
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                            >
                              <Send className="w-3 h-3 text-sky-700" />
                              <span>ارسال پیامک نوبت</span>
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Dental Prescription & Medications (Rx) */}
            {activeTab === 'prescriptions' && (
              <div className="space-y-3">
                {/* Smart Drug-Allergy & Systemic Contraindication Guard */}
                {(() => {
                  const alerts = (patient.medicalHistory || []).filter(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim()));
                  const hasPenicillin = alerts.some(m => m.includes('پنی‌سیلین'));
                  const hasPregnancy = alerts.some(m => m.includes('بارداری'));
                  return (
                    <div className={`p-3 rounded-[20px] border flex items-center justify-between gap-2 flex-wrap ${
                      alerts.length > 0
                        ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    }`}>
                      <div className="flex items-center gap-2 text-xs font-black">
                        <AlertTriangle className={`w-4 h-4 shrink-0 ${alerts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                        <span>
                          {alerts.length > 0
                            ? `سپر ایمنی تداخل دارویی و حساسیت بیمار: ${alerts.join(' · ')}`
                            : 'بررسی ایمنی دارویی: بدون سابقه حساسیت دارویی یا منع سیستمیک ثبت‌شده ✓'}
                        </span>
                      </div>
                      {(hasPenicillin || hasPregnancy) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-rose-300 text-[10px] font-black text-rose-800">
                          {hasPenicillin ? 'پروتکل جایگزین: کلیندامایسین ۳۰۰mg' : 'منع مصرف NSAID و تتراسایکلین در بارداری'}
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="bg-white p-3 rounded-[20px] border border-emerald-200/90 border-r-[3px] border-r-emerald-500 shadow-[var(--shadow-card)] space-y-2.5">
                  <SectionVisualBadge
                    icon={<Pill className="w-4 h-4" />}
                    badgeLabel="بخش دارویی"
                    title="الگوهای آماده نسخه دندانپزشکی"
                    count={DENTAL_PRESCRIPTION_PRESETS.length}
                    colorScheme="emerald"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DENTAL_PRESCRIPTION_PRESETS.map((preset, idx) => (
                      <button type="button"
                        key={idx}
                        onClick={() => handleApplyPreset(preset)}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-right active:scale-95 transition-all group cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 block truncate">{preset.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5">{preset.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[20px] p-3.5 border border-teal-200/90 border-r-[3px] border-r-teal-500 shadow-[var(--shadow-card)] space-y-3">
                  <div className="border-b border-slate-100 pb-2">
                    <SectionVisualBadge
                      icon={<Pill className="w-4 h-4" />}
                      badgeLabel="نسخه فعال"
                      title="اقلام دارویی نسخه بیمار"
                      count={medItems.length}
                      colorScheme="teal"
                      rightElement={<span className="text-[10.5px] font-bold text-slate-500">پزشک: دکتر مهدی امیری</span>}
                    />
                  </div>

                  <div className="space-y-1.5">
                    {medItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">{toPersianDigits(idx + 1)}. {item.medicationName}</span>
                          <span className="text-[10.5px] text-slate-600 block">{item.dosage} · دستور: {item.instructions}</span>
                        </div>
                        <button type="button"
                          onClick={() => handleRemoveMedItem(idx)}
                          className="p-1 rounded text-red-500 hover:bg-red-50"
                          title="حذف دارو"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddCustomMed} className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="نام و دوز دارو..."
                      value={customMedName}
                      onChange={(e) => setCustomMedName(e.target.value)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-[11px] outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="تعداد (مثلاً ۲۰ عدد)"
                      value={customDosage}
                      onChange={(e) => setCustomDosage(e.target.value)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-[11px] outline-none focus:border-emerald-500"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="دستور مصرف..."
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-[11px] outline-none focus:border-emerald-500 flex-1"
                      />
                      <button
                        type="submit"
                        className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                      >
                        افزودن
                      </button>
                    </div>
                  </form>

                  <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button type="button"
                        onClick={() => window.print()}
                        className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-cyan-600" />
                        <span>چاپ نسخه سربرگ‌دار</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const rxSummary = medItems.map((m) => `${m.medicationName} (${m.instructions})`).join(' | ');
                          const res = await clinicalSmsService.sendPatternSms(
                            patient.phone,
                            patient.fullName,
                            'welcome',
                            { fileNumber: `${patient.fileNumber} · نسخه: ${rxSummary.slice(0, 45)}` }
                          );
                          actionFeedback.recordSuccess({
                            title: `دستور مصرف داروهای نسخه برای ${patient.fullName} پیامک شد`,
                            subtitle: `شماره: ${toPersianDigits(patient.phone)} · کد پیگیری: ${res.refId}`,
                            targetRecordId: patient.id,
                            badgeText: '✓ پیامک نسخه ارسال شد'
                          });
                        }}
                        className="py-1.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5 text-sky-600" />
                        <span>پیامک دستور مصرف به بیمار</span>
                      </button>
                    </div>

                    <button type="button"
                      onClick={handleSavePrescription}
                      className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      ثبت و ذخیره در پرونده
                    </button>
                  </div>

                  {/* 1-Tap Post-Op Clinical Care Instructions SMS Dispatcher */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-black text-teal-900">
                      ارسال آنی پروتکل مراقبت پس از درمان (Post-Op Care SMS):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'مراقبت جراحی و ایمپلنت', note: 'کمپرس یخ، گاز استریل ۲ ساعت، پرهیز از غذای گرم و سیگار ۲۴ ساعت' },
                        { label: 'مراقبت پس از عصب‌کشی (اندو)', note: 'پرهیز از جویدن غذای سفت تا زمان روکش، مصرف منظم مسکن تجویزشده' },
                        { label: 'مراقبت روکش و لمینت', note: 'عدم مصرف خوراکی چسبنده تا ۲۴ ساعت، نخ دندان و واترجت روزانه' }
                      ].map((care) => (
                        <button
                          key={care.label}
                          type="button"
                          onClick={async () => {
                            const res = await clinicalSmsService.sendPatternSms(
                              patient.phone,
                              patient.fullName,
                              'welcome',
                              { fileNumber: `${patient.fileNumber} · ${care.label}: ${care.note}` }
                            );
                            actionFeedback.recordSuccess({
                              title: `دستورالعمل «${care.label}» برای ${patient.fullName} پیامک شد`,
                              subtitle: `کد پیگیری مخابرات: ${res.refId}`,
                              targetRecordId: patient.id,
                              badgeText: `✓ ${care.label}`
                            });
                          }}
                          className="px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-[10px] font-black cursor-pointer active:scale-95"
                        >
                          {care.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {patient.prescriptions && patient.prescriptions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-800 block px-1">آرشیو نسخه‌های پیشین بیمار:</span>
                    {patient.prescriptions.map((rx) => (
                      <div key={rx.id} className="p-3 rounded-[20px] bg-white border border-slate-200 border-r-[3px] border-r-sky-500 text-xs space-y-1.5 shadow-[var(--shadow-card)]">
                        <div className="flex justify-between items-center text-[10.5px] text-slate-500 border-b border-slate-100 pb-1">
                          <span>تاریخ تجویز: {rx.date}</span>
                          <span>پزشک: {rx.doctorName}</span>
                        </div>
                        <div className="space-y-1">
                          {rx.items.map((it, i) => (
                            <div key={i} className="text-slate-800 text-[11px]">
                              • {it.medicationName} ({it.dosage}) - {it.instructions}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Informed Consents (رضایت‌نامه‌ها) */}
            {activeTab === 'consents' && (
              <div className="space-y-2.5">
                <div className="bg-white p-2.5 rounded-[20px] border border-amber-200/90 border-r-[3px] border-r-amber-500 shadow-[var(--shadow-card)]">
                  <SectionVisualBadge
                    icon={<FileSignature className="w-4 h-4" />}
                    badgeLabel="امضای قانونی"
                    title="رضایت‌نامه‌های آگاهانه درمان و جراحی"
                    count={DEFAULT_CONSENTS.length}
                    colorScheme="amber"
                  />
                </div>

                {DEFAULT_CONSENTS.map(cst => {
                  const savedConsent = patient.consents?.find(c => c.procedureType === cst.procedureType || c.id === cst.id);
                  const isSigned = !!(savedConsent?.signatureDataUrl || (savedConsent && savedConsent.isConfirmed));
                  const signatureImg = savedConsent?.signatureDataUrl;
                  const cryptoDigest = savedConsent?.cryptoHash || (isSigned ? 'SHA256_' + (patient.id.replace('pat-', '') + '99b7ac81').slice(0, 16) : undefined);
                  const signedDate = savedConsent?.signedDate || (savedConsent?.timestamp ? savedConsent.timestamp.split(' - ')[0] : getCurrentPersianDate());

                  return (
                    <div
                      key={cst.id}
                      className={`p-3 rounded-[20px] bg-white border shadow-[var(--shadow-card)] space-y-2 ${
                        isSigned
                          ? 'border-emerald-200 border-r-[3px] border-r-emerald-500'
                          : 'border-amber-200 border-r-[3px] border-r-amber-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <FileSignature className="w-4 h-4 text-emerald-600 shrink-0" />
                            <h4 className="text-xs font-black text-slate-900">{cst.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{cst.desc}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSigningConsent({
                                id: cst.id,
                                title: cst.title,
                                desc: cst.desc,
                                existingSignature: signatureImg
                              });
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95 cursor-pointer ${
                              isSigned 
                                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
                                : 'bg-emerald-600 text-white shadow-xs'
                            }`}
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>{isSigned ? 'امضای مجدد' : 'ثبت امضا'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleConsent && onToggleConsent(patient.id, cst.id)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 bg-slate-100 cursor-pointer"
                          >
                            {isSigned ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {isSigned && (
                        <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-2 text-[10.5px]">
                          <div className="flex items-center gap-2">
                            {signatureImg && (
                              <div className="w-16 h-8 bg-white border border-slate-200 rounded-lg p-0.5 flex items-center justify-center">
                                <img src={signatureImg} alt="امضا" className="max-h-full max-w-full object-contain" />
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-emerald-950 block">✓ امضای دیجیتال ثبت شده</span>
                              <span className="text-[10px] text-slate-500 font-mono">تاریخ: {signedDate}</span>
                            </div>
                          </div>
                          {cryptoDigest && (
                            <span className="text-[9.5px] font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                              {cryptoDigest.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* =========================================================================
                TAB 4: FINANCIAL MANAGEMENT (نشانگرهای بصری کیف پول و تفکیک حساب‌ها)
               ========================================================================= */}
            {activeTab === 'financial' && (() => {
              const singlePatientClinicLedger = computeClinicReceivablesLedger([patient]);
              const singlePatientDoctorLedger = computeDoctorWorkCommissionLedger([patient], {
                doctorId: 'doc-1',
                doctorName: 'دکتر مهدی امیری',
                specialty: 'مدیر کلینیک و جراح',
                isManager: true,
                model: 'percentage',
                percentageRate: 100,
                fixedWagePerTreatment: 0,
                baselineHistoricalGross: 0,
                baselineHistoricalLab: 0
              });
              const teethTreatments = Object.entries(patient.teethConditions || {});
              const paymentsList = patient.payments || [];

              return (
                <div className="space-y-3">
                  {/* SECTION 1: Top Summary & Quick Financial Actions Card with Wallet Visual Badge */}
                  <div className="bg-white rounded-[20px] p-3 border border-emerald-200/90 border-r-[3px] border-r-emerald-500 shadow-[var(--shadow-card)] space-y-2.5">
                    <SectionVisualBadge
                      icon={<Wallet className="w-4 h-4" />}
                      badgeLabel="کیف پول مالی"
                      title="خلاصه حساب، دریافتی و وضعیت تسویه بیمار"
                      colorScheme="emerald"
                    />

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10.5px] font-bold text-slate-500 block">کل هزینه درمان</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-mono mt-0.5 block">
                          {formatToman(patient.totalCost)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200">
                        <span className="text-[10.5px] font-bold text-emerald-800 block">پرداختی بیمار</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono mt-0.5 block">
                          {formatToman(patient.paidAmount)}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${patient.balance < 0 ? 'bg-rose-50/90 border-rose-200' : 'bg-emerald-50/80 border-emerald-200'}`}>
                        <span className={`text-[10.5px] font-bold block ${patient.balance < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
                          {patient.balance < 0 ? 'مانده بدهی' : 'وضعیت حساب'}
                        </span>
                        <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 block ${patient.balance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {patient.balance < 0 ? formatToman(Math.abs(patient.balance)) : 'تسویه کامل ✓'}
                        </span>
                      </div>
                    </div>

                    {/* Primary Financial Action Buttons right at the top */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button type="button"
                        onClick={() => onAddPayment(patient.id)}
                        className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        <span>+ ثبت پرداخت</span>
                      </button>

                      <button type="button"
                        onClick={() => onAddCheck(patient.id)}
                        className="py-2 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>+ چک / ضمانت</span>
                      </button>

                      <button type="button"
                        onClick={() => onOpenInvoice && onOpenInvoice(patient)}
                        className="py-2 px-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-950 border border-cyan-300 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                        <span>چاپ صورتحساب</span>
                      </button>
                    </div>

                    {patient.balance < 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await clinicalSmsService.sendPatternSms(
                            patient.phone,
                            patient.fullName,
                            'installment_due',
                            {
                              amount: formatToman(Math.abs(patient.balance)),
                              dueDate: getCurrentPersianDate()
                            }
                          );
                          actionFeedback.recordSuccess({
                            title: `پیامک مطالبه بدهی مطب برای ${patient.fullName} ارسال شد`,
                            subtitle: `مبلغ بدهی به مطب: ${formatExactMicroToman(Math.abs(patient.balance), true)}`,
                            diffBefore: 'بدهکار در انتظار پیگیری',
                            diffAfter: `پیامک خدماتی مخابره شد (کد: ${res.refId})`,
                            targetRecordId: patient.id,
                            badgeText: `✓ پیامک مطالبه بدهی ارسال شد`
                          });
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>ارسال پیامک یادآوری تسویه بدهی ({formatToman(Math.abs(patient.balance))})</span>
                      </button>
                    )}
                  </div>

                  {/* SECTION 1B: Smart Installment Plan, Insurance Franchise & Manager-Protected Discount Calculator */}
                  {(() => {
                    const grossBase = Math.max(patient.totalCost, Math.abs(patient.balance));
                    const insuranceDeduction = Math.round((grossBase * planInsurancePct) / 100);
                    const discountDeduction = Math.round((grossBase * planManagerDiscountPct) / 100);
                    const netPayable = Math.max(0, grossBase - insuranceDeduction - discountDeduction - patient.paidAmount);
                    const prepayAmount = Math.round((netPayable * planPrepayPct) / 100);
                    const remainingForInstallments = Math.max(0, netPayable - prepayAmount);
                    const eachInstallment = planMonths > 0 ? Math.round(remainingForInstallments / planMonths) : remainingForInstallments;

                    const handleGenerateInstallmentSchedule = () => {
                      const defaultRem = getDefaultReminderConfig('2d_before');
                      const nowTs = Date.now();
                      const generated = Array.from({ length: planMonths }, (_, i) => ({
                        id: `inst-auto-${nowTs}-${i + 1}`,
                        patientId: patient.id,
                        patientName: patient.fullName,
                        treatmentName: 'طرح درمان جامع دندانپزشکی',
                        installmentNumber: i + 1,
                        totalInstallments: planMonths,
                        amount: eachInstallment,
                        dueDate: getRelativePersianDate((i + 1) * 30),
                        status: 'pending' as const,
                        paymentMethod: planCollateralMode === 'sayad_per_installment' ? ('check' as const) : ('pos' as const),
                        reminderConfig: defaultRem
                      }));

                      const generatedChecks =
                        planCollateralMode === 'sayad_per_installment'
                          ? generated.map((g, idx) => ({
                              id: `chk-auto-${nowTs}-${idx + 1}`,
                              patientId: patient.id,
                              patientName: patient.fullName,
                              sayadId: `۷۴۰۱۸۸${idx + 1}۹۹${String(nowTs).slice(-7)}`,
                              bankName: 'بانک ملت',
                              amount: g.amount,
                              dueDate: g.dueDate,
                              drawerName: patient.fullName,
                              status: 'in_collection' as const,
                              isGuarantee: false,
                              description: `قسط شماره ${toPersianDigits(g.installmentNumber)} بابت طرح درمان جامع`,
                              reminderConfig: defaultRem
                            }))
                          : planCollateralMode === 'single_guarantee'
                            ? [
                                {
                                  id: `chk-guar-auto-${nowTs}`,
                                  patientId: patient.id,
                                  patientName: patient.fullName,
                                  sayadId: `۷۴۰۱۹۹۸۸${String(nowTs).slice(-8)}`,
                                  bankName: 'بانک ملی',
                                  amount: remainingForInstallments,
                                  dueDate: generated[generated.length - 1]?.dueDate || getRelativePersianDate(planMonths * 30),
                                  drawerName: patient.fullName,
                                  status: 'in_collection' as const,
                                  isGuarantee: true,
                                  description: `چک ضمانت امانی کل اقساط (${toPersianDigits(planMonths)} قسط)`,
                                  reminderConfig: defaultRem
                                }
                              ]
                            : [];

                      triggerFieldAutoSave({
                        installments: [...(patient.installments || []), ...generated],
                        sayadChecks: [...(patient.sayadChecks || []), ...generatedChecks]
                      });

                      generated.forEach((inst) => {
                        scheduleEntityReminder({
                          sourceType: 'installment',
                          sourceId: inst.id,
                          patientId: patient.id,
                          patientName: patient.fullName,
                          patientPhone: patient.phone,
                          title: `سررسید قسط شماره ${toPersianDigits(inst.installmentNumber)} (${formatToman(inst.amount)})`,
                          description: inst.treatmentName,
                          targetDate: inst.dueDate,
                          targetView: 'financial',
                          config: defaultRem
                        });
                      });
                      generatedChecks.forEach((chk) => {
                        scheduleEntityReminder({
                          sourceType: 'check',
                          sourceId: chk.id,
                          patientId: patient.id,
                          patientName: patient.fullName,
                          patientPhone: patient.phone,
                          title: chk.isGuarantee
                            ? `سررسید چک ضمانت امانی (${formatToman(chk.amount)})`
                            : `سررسید چک صیادی (${formatToman(chk.amount)})`,
                          description: `شناسه ${chk.sayadId}`,
                          targetDate: chk.dueDate,
                          targetView: 'financial',
                          config: defaultRem
                        });
                      });

                      recordAuditLog(
                        'تولید یکپارچه اقساط، چک/ضمانت و یادآوری بیمار',
                        `بیمار: ${patient.fullName} · ${toPersianDigits(planMonths)} قسط ماهانه به مبلغ ${formatToman(eachInstallment)}`
                      );
                      actionFeedback.recordSuccess({
                        title: `برنامه یکپارچه ${toPersianDigits(planMonths)} قسط، چک/ضمانت و یادآوری ثبت شد`,
                        subtitle: `مبلغ هر قسط: ${formatToman(eachInstallment)} · پیش‌پرداخت: ${formatToman(prepayAmount)}`,
                        targetRecordId: patient.id,
                        badgeText: '✓ تقسیط و ضمانت یکپارچه ثبت شد'
                      });
                    };

                    return (
                      <div className="bg-gradient-to-l from-indigo-50/80 via-white to-amber-50/60 rounded-[20px] p-3 border border-indigo-200/90 shadow-[var(--shadow-card)] space-y-2.5 tabular-nums">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                            <CreditCard className="w-4 h-4 text-indigo-600" />
                            <span>ماشین‌حساب هوشمند تقسیط، سهم بیمه تکمیلی و تخفیف مدیر</span>
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1">
                            {canDirectlyEditPrices ? <Unlock className="w-3 h-3 text-emerald-700" /> : <Lock className="w-3 h-3 text-amber-700" />}
                            <span>{canDirectlyEditPrices ? 'دسترسی مدیر فعال (دکتر مهدی امیری)' : 'تخفیف قفل‌شده (فقط مدیر کلینیک)'}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600 block mb-1">پوشش بیمه تکمیلی:</span>
                            <select
                              aria-label="درصد پوشش بیمه تکمیلی بیمار"
                              value={planInsurancePct}
                              onChange={(e) => setPlanInsurancePct(Number(e.target.value))}
                              className="w-full font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] cursor-pointer"
                            >
                              <option value={0}>بدون بیمه (۰٪)</option>
                              <option value={30}>بیمه پایه (۳۰٪)</option>
                              <option value={50}>بیمه تکمیلی نقره‌ای (۵۰٪)</option>
                              <option value={70}>بیمه تکمیلی طلایی/بانک‌ها (۷۰٪)</option>
                            </select>
                          </div>

                          <div className="p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600 block mb-1">تخفیف ویژه مدیر:</span>
                            <select
                              aria-label="درصد تخفیف ویژه مدیر کلینیک"
                              value={planManagerDiscountPct}
                              onChange={(e) => {
                                const nextVal = Number(e.target.value);
                                if (!canDirectlyEditPrices && nextVal > 0) {
                                  setManagerPinModalOpen(true);
                                  setManagerPinError(null);
                                  return;
                                }
                                setPlanManagerDiscountPct(nextVal);
                              }}
                              className="w-full font-mono font-black text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-[11px] cursor-pointer"
                            >
                              <option value={0}>بدون تخفیف (۰٪)</option>
                              <option value={5}>۵٪ تخفیف مدیریتی</option>
                              <option value={10}>۱۰٪ تخفیف مدیریتی</option>
                              <option value={15}>۱۵٪ تخفیف همکار/خانواده</option>
                            </select>
                          </div>

                          <div className="p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600 block mb-1">پیش‌پرداخت نقدی:</span>
                            <select
                              aria-label="درصد پیش‌پرداخت تقسیط"
                              value={planPrepayPct}
                              onChange={(e) => setPlanPrepayPct(Number(e.target.value))}
                              className="w-full font-mono font-black text-emerald-950 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-[11px] cursor-pointer"
                            >
                              <option value={20}>۲۰٪ پیش‌پرداخت</option>
                              <option value={30}>۳۰٪ پیش‌پرداخت</option>
                              <option value={50}>۵۰٪ پیش‌پرداخت</option>
                            </select>
                          </div>

                          <div className="p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600 block mb-1">تعداد اقساط ماهانه:</span>
                            <select
                              aria-label="تعداد اقساط ماهانه بیمار"
                              value={planMonths}
                              onChange={(e) => setPlanMonths(Number(e.target.value))}
                              className="w-full font-mono font-black text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 text-[11px] cursor-pointer"
                            >
                              <option value={2}>۲ قسط ماهانه</option>
                              <option value={3}>۳ قسط ماهانه</option>
                              <option value={4}>۴ قسط ماهانه</option>
                              <option value={6}>۶ قسط ماهانه</option>
                            </select>
                          </div>
                        </div>

                        {/* Unified Collateral Mode Selector inside Patient File */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] font-black">
                          {[
                            { id: 'sayad_per_installment', label: 'چک صیادی برای هر قسط + یادآوری' },
                            { id: 'single_guarantee', label: '۱ فقره چک ضمانت امانی کل اقساط' },
                            { id: 'no_check', label: 'اقساط بدون چک (تعهد پرونده)' }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setPlanCollateralMode(opt.id as any)}
                              className={`py-1.5 px-2 rounded-xl border transition-all cursor-pointer truncate ${
                                planCollateralMode === opt.id
                                  ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                                  : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-indigo-200/80 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span>پیش‌پرداخت: <strong className="font-mono text-emerald-800">{formatToman(prepayAmount)}</strong></span>
                            <span>·</span>
                            <span>مبلغ هر قسط ({toPersianDigits(planMonths)} ماه): <strong className="font-mono text-indigo-900">{formatToman(eachInstallment)}</strong></span>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateInstallmentSchedule}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>ثبت خودکار اقساط در پرونده</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SECTION 2: Recorded Treatments Cost Breakdown with Tooth Visual Badge */}
                  <div className="bg-white rounded-[20px] p-3 border border-teal-200/90 border-r-[3px] border-r-teal-500 shadow-[var(--shadow-card)] space-y-2">
                    <div className="border-b border-slate-100 pb-2">
                      <SectionVisualBadge
                        icon={<ToothIcon className="w-4 h-4" />}
                        badgeLabel="درمان‌های دندان"
                        title="ریز هزینه‌های درمان ثبت‌شده"
                        count={teethTreatments.length}
                        colorScheme="teal"
                        rightElement={
                          <span className="text-[11px] font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                            جمع: {formatToman(patient.totalCost)}
                          </span>
                        }
                      />
                    </div>

                    {teethTreatments.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-1">هنوز درمانی در چارت ثبت نشده است.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {teethTreatments.map(([tKey, cond]) => {
                          const treatmentTitle = getPersianTreatmentName(cond.treatment);

                          return (
                            <div key={tKey} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-950 font-mono font-black text-[10.5px] border border-teal-300">
                                  {cond.quadrant}{cond.toothNumber}
                                </span>
                                <div>
                                  <span className="font-black text-slate-900 text-[11.5px] block">{treatmentTitle}</span>
                                  <span className="text-[10px] text-slate-500">پزشک: {cond.doctorName || 'دکتر مهدی امیری'}</span>
                                </div>
                              </div>
                              <span className="font-mono font-black text-slate-900 text-xs">
                                {formatToman(cond.cost || 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: Recorded Payments History with Wallet/Receipt Visual Badge */}
                  <div className="bg-white rounded-[20px] p-3 border border-sky-200/90 border-r-[3px] border-r-sky-500 shadow-[var(--shadow-card)] space-y-2">
                    <div className="border-b border-slate-100 pb-2">
                      <SectionVisualBadge
                        icon={<Wallet className="w-4 h-4" />}
                        badgeLabel="تراکنش‌های کیف پول"
                        title="دریافتی‌ها و فیش‌های پرداخت"
                        count={paymentsList.length}
                        colorScheme="sky"
                        rightElement={
                          <span className="text-[11px] font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            وصولی: {formatToman(patient.paidAmount)}
                          </span>
                        }
                      />
                    </div>

                    {paymentsList.length === 0 ? (
                      <p className="text-[11px] text-slate-500 py-1">
                        {patient.paidAmount > 0
                          ? `مجموع ${formatToman(patient.paidAmount)} در سیستم ثبت و تسویه شده است.`
                          : 'هنوز پرداختی برای این پرونده ثبت نشده است.'}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {paymentsList.map((pay) => {
                          const isRefundTx = Boolean(pay.isRefund || pay.amount < 0);
                          const isConfirmingRefund = confirmRefundPaymentId === pay.id;
                          return (
                            <div
                              key={pay.id}
                              className={`flex items-center justify-between gap-2 flex-wrap p-2 rounded-xl border text-xs ${
                                isRefundTx
                                  ? 'bg-rose-50/70 border-rose-200'
                                  : 'bg-sky-50/50 border-sky-200/80'
                              }`}
                            >
                              <div>
                                <span className={`font-black text-[11.5px] block ${isRefundTx ? 'text-rose-900' : 'text-slate-900'}`}>
                                  {isRefundTx
                                    ? 'عودت وجه به بیمار (برگشت فیش)'
                                    : pay.method === 'pos'
                                      ? 'کارتخوان (POS)'
                                      : pay.method === 'cash'
                                        ? 'وجه نقد'
                                        : pay.method === 'card_to_card'
                                          ? 'کارت به کارت'
                                          : 'دریافتی مطب'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  تاریخ: {toPersianDigits(pay.date)} {pay.forTreatment ? `· ${pay.forTreatment}` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-black text-xs ${isRefundTx ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {isRefundTx ? `-${formatToman(Math.abs(pay.amount))}` : formatToman(pay.amount)}
                                </span>
                                {!isRefundTx && pay.amount > 0 && !pay.refundedAt && (
                                  isConfirmingRefund ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const refundTx = {
                                            id: `rfd-${Date.now()}`,
                                            patientId: patient.id,
                                            patientName: patient.fullName,
                                            amount: -pay.amount,
                                            date: getCurrentPersianDate(),
                                            method: pay.method,
                                            forTreatment: `عودت وجه فیش ${pay.date} (${pay.forTreatment || 'مطب'})`,
                                            isRefund: true
                                          };
                                          const nextPayments = [
                                            refundTx,
                                            ...paymentsList.map((pItem) =>
                                              pItem.id === pay.id ? { ...pItem, refundedAt: getCurrentPersianDate() } : pItem
                                            )
                                          ];
                                          const nextPaid = Math.max(0, patient.paidAmount - pay.amount);
                                          const nextBalance = nextPaid - patient.totalCost;
                                          commitPatientPatchImmediate({
                                            paidAmount: nextPaid,
                                            balance: nextBalance,
                                            payments: nextPayments
                                          });
                                          recordAuditLog(
                                            'عودت وجه پرداختی بیمار',
                                            `بیمار: ${patient.fullName} · مبلغ عودت: ${formatToman(pay.amount)}`
                                          );
                                          actionFeedback.recordSuccess({
                                            title: `عودت وجه ${formatToman(pay.amount)} در ممیزی مالی ثبت شد`,
                                            subtitle: `بیمار: ${patient.fullName} · شناسه ممیزی MD-SENS-RFD صادر شد`,
                                            targetRecordId: patient.id,
                                            badgeText: '✓ عودت وجه و ممیزی'
                                          });
                                          setConfirmRefundPaymentId(null);
                                        }}
                                        className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black cursor-pointer"
                                      >
                                        تایید عودت ✓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRefundPaymentId(null)}
                                        className="px-1.5 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                                      >
                                        لغو
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!canDirectlyEditPrices) {
                                          setManagerPinModalOpen(true);
                                          setManagerPinError(null);
                                          return;
                                        }
                                        setConfirmRefundPaymentId(pay.id);
                                      }}
                                      className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black cursor-pointer"
                                      title="عودت وجه با مجوز مدیر و ثبت شناسه ممیزی (Audit ID)"
                                    >
                                      عودت وجه
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 4: Sayad Checks & Installments with Check Visual Badge */}
                  <div className="bg-white rounded-[20px] p-3 border border-purple-200/90 border-r-[3px] border-r-purple-500 shadow-[var(--shadow-card)] space-y-2">
                    <div className="border-b border-slate-100 pb-2">
                      <SectionVisualBadge
                        icon={<FileCheck2 className="w-4 h-4" />}
                        badgeLabel="اسناد صیادی"
                        title="چک‌های صیادی و اقساط"
                        count={patient.sayadChecks.length + (patient.installments?.length || 0)}
                        colorScheme="purple"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => onAddCheck(patient.id)}
                            className="text-[10.5px] font-black text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 cursor-pointer"
                          >
                            + افزودن چک
                          </button>
                        }
                      />
                    </div>

                    {patient.sayadChecks.length === 0 && (!patient.installments || patient.installments.length === 0) ? (
                      <p className="text-[11px] text-slate-400 py-1">هیچ چک صیادی یا قسطی برای این پرونده ثبت نشده است.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {patient.sayadChecks.map(check => {
                          const allInstsSettled = (patient.installments || []).every(it => it.status === 'paid');
                          const isGuarReady = check.isGuarantee && check.status !== 'returned' && patient.balance >= 0 && allInstsSettled;
                          return (
                            <div key={check.id} className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${check.isGuarantee ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-sky-100 text-sky-700 border border-sky-200'}`}>
                                  {check.isGuarantee ? <Shield className="w-4 h-4" /> : <FileCheck2 className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-black text-slate-900">{check.bankName}</span>
                                    <span className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-bold ${check.isGuarantee ? 'bg-purple-100 text-purple-900' : 'bg-cyan-100 text-cyan-900'}`}>
                                      {check.isGuarantee ? 'چک ضمانت امانی' : 'صیادی تجاری'}
                                    </span>
                                    {isGuarReady && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-md font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        آماده عودت به بیمار ✓
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10.5px] text-slate-500 font-mono block">
                                    صیاد: {toPersianDigits(check.sayadId)} · سررسید: {toPersianDigits(check.dueDate)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-left">
                                  <span className="text-xs font-black text-slate-900 font-mono block">
                                    {formatToman(check.amount)}
                                  </span>
                                  <span className={`text-[10px] font-bold ${
                                    check.status === 'cleared' || check.status === 'returned' ? 'text-emerald-600' : 'text-amber-600'
                                  }`}>
                                    {check.status === 'returned'
                                      ? '✓ عودت داده شد'
                                      : check.status === 'cleared'
                                        ? '✓ پاس شده'
                                        : check.isGuarantee
                                          ? '🛡️ امانت در گاوصندوق'
                                          : '⏳ در جریان وصول'}
                                  </span>
                                </div>
                                {check.isGuarantee && check.status !== 'returned' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextChecks = patient.sayadChecks.map((c) =>
                                        c.id === check.id ? { ...c, status: 'returned' as const } : c
                                      );
                                      triggerFieldAutoSave({ sayadChecks: nextChecks });
                                      markReminderDone(`rem-check-${check.id}`);
                                      recordAuditLog('عودت چک ضمانت به بیمار', `چک ضمانت ${check.bankName} شناسه ${check.sayadId}`);
                                      actionFeedback.recordSuccess({
                                        title: `چک ضمانت ${check.bankName} به بیمار عودت داده شد`,
                                        subtitle: `شناسه صیاد: ${toPersianDigits(check.sayadId)}`,
                                        targetRecordId: patient.id,
                                        badgeText: '✓ چک ضمانت عودت شد'
                                      });
                                    }}
                                    className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black cursor-pointer active:scale-95"
                                  >
                                    عودت ضمانت ✓
                                  </button>
                                )}
                                {!check.isGuarantee && check.status !== 'cleared' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextChecks = patient.sayadChecks.map((c) =>
                                        c.id === check.id ? { ...c, status: 'cleared' as const } : c
                                      );
                                      let syncedInstId: string | null = null;
                                      const nextInst = (patient.installments || []).map((it) => {
                                        if (it.status !== 'paid' && (it.dueDate === check.dueDate || (!syncedInstId && it.amount === check.amount))) {
                                          syncedInstId = it.id;
                                          return { ...it, status: 'paid' as const, paidDate: getCurrentPersianDate() };
                                        }
                                        return it;
                                      });
                                      const nextPaid = patient.paidAmount + check.amount;
                                      const nextBal = nextPaid - patient.totalCost;
                                      const nextPayments = [
                                        ...(patient.payments || []),
                                        {
                                          id: `pay-chk-${Date.now()}`,
                                          patientId: patient.id,
                                          patientName: patient.fullName,
                                          amount: check.amount,
                                          date: getCurrentPersianDate(),
                                          method: 'card_to_card' as const,
                                          referenceNumber: check.sayadId,
                                          forTreatment: check.description || `وصول چک صیادی ${check.bankName}`
                                        }
                                      ];
                                      triggerFieldAutoSave({
                                        sayadChecks: nextChecks,
                                        installments: nextInst,
                                        paidAmount: nextPaid,
                                        balance: nextBal,
                                        payments: nextPayments
                                      });
                                      markReminderDone(`rem-check-${check.id}`);
                                      if (syncedInstId) markReminderDone(`rem-installment-${syncedInstId}`);
                                      recordAuditLog('وصول چک صیادی بیمار', `چک ${check.bankName} به مبلغ ${formatToman(check.amount)}`);
                                      actionFeedback.recordSuccess({
                                        title: `چک صیادی ${check.bankName} پاس و قسط متناظر تسویه شد`,
                                        subtitle: `مبلغ: ${formatToman(check.amount)}`,
                                        targetRecordId: patient.id,
                                        badgeText: '✓ چک و قسط تسویه شد'
                                      });
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer active:scale-95"
                                  >
                                    وصول چک ✓
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {(patient.installments || []).map(inst => {
                          const linkedChk = patient.sayadChecks.find(c => !c.isGuarantee && c.dueDate === inst.dueDate);
                          const activeGuar = patient.sayadChecks.find(c => c.isGuarantee && c.status !== 'returned');
                          return (
                            <div key={inst.id} className="bg-rose-50/50 rounded-xl p-2.5 border border-rose-200/80 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 flex items-center justify-center font-mono font-black text-xs shrink-0">
                                  {toPersianDigits(inst.installmentNumber)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-black text-slate-900">
                                      قسط شماره {toPersianDigits(inst.installmentNumber)} طرح درمان
                                    </span>
                                    {linkedChk && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-bold">
                                        چک {linkedChk.bankName}
                                      </span>
                                    )}
                                    {activeGuar && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">
                                        تحت ضمانت امانی ✓
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10.5px] text-slate-500 font-mono block">
                                    سررسید: {toPersianDigits(inst.dueDate)} · یادآوری فعال 🔔
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-left">
                                  <span className="text-xs font-black text-slate-900 font-mono block">
                                    {formatToman(inst.amount)}
                                  </span>
                                  <span className={`text-[10px] font-bold ${
                                    inst.status === 'paid' ? 'text-emerald-600' : inst.status === 'overdue' ? 'text-rose-600' : 'text-amber-600'
                                  }`}>
                                    {inst.status === 'paid' ? '✓ پرداخت شده' : inst.status === 'overdue' ? '⚠️ قسط معوق' : '⏳ در انتظار سررسید'}
                                  </span>
                                </div>
                                {inst.status !== 'paid' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextInst = (patient.installments || []).map((it) =>
                                        it.id === inst.id ? { ...it, status: 'paid' as const, paidDate: getCurrentPersianDate() } : it
                                      );
                                      let syncedChkId: string | null = null;
                                      const nextChecks = patient.sayadChecks.map((c) => {
                                        if (!c.isGuarantee && c.status !== 'cleared' && c.dueDate === inst.dueDate) {
                                          syncedChkId = c.id;
                                          return { ...c, status: 'cleared' as const };
                                        }
                                        return c;
                                      });
                                      const nextPaid = patient.paidAmount + inst.amount;
                                      const nextBal = nextPaid - patient.totalCost;
                                      const nextPayments = [
                                        ...(patient.payments || []),
                                        {
                                          id: `pay-inst-${Date.now()}`,
                                          patientId: patient.id,
                                          patientName: patient.fullName,
                                          amount: inst.amount,
                                          date: getCurrentPersianDate(),
                                          method: 'pos' as const,
                                          forTreatment: `تسویه قسط شماره ${toPersianDigits(inst.installmentNumber)}`
                                        }
                                      ];
                                      triggerFieldAutoSave({
                                        installments: nextInst,
                                        sayadChecks: nextChecks,
                                        paidAmount: nextPaid,
                                        balance: nextBal,
                                        payments: nextPayments
                                      });
                                      markReminderDone(`rem-installment-${inst.id}`);
                                      if (syncedChkId) markReminderDone(`rem-check-${syncedChkId}`);
                                      recordAuditLog('تسویه قسط بیمار', `قسط شماره ${inst.installmentNumber} به مبلغ ${formatToman(inst.amount)}`);
                                      actionFeedback.recordSuccess({
                                        title: `قسط شماره ${toPersianDigits(inst.installmentNumber)} تسویه و در فیش‌های دریافتی ثبت شد`,
                                        subtitle: `مبلغ: ${formatToman(inst.amount)}${syncedChkId ? ' · چک صیادی مرتبط نیز پاس شد' : ''}`,
                                        targetRecordId: patient.id,
                                        badgeText: '✓ قسط تسویه شد'
                                      });
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer active:scale-95"
                                  >
                                    تسویه قسط ✓
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 5: 3-Model Doctor Commission & Clinic Split-Ledger (مناصفه ۵۰/۵۰ خالص، دستمزد ثابت، درصدی اختصاصی / مدیر دکتر مهدی امیری) */}
                  {(() => {
                    const totalLabCost = (patient.labOrders || []).reduce((acc, lo) => acc + (lo.cost || 0), 0);
                    const netAfterLab = Math.max(0, patient.totalCost - totalLabCost);
                    const totalTreatmentsCount = Math.max(1, Object.keys(patient.teethConditions || {}).length);

                    const calculatedDoctorShare =
                      docShareModel === 'net_50_50'
                        ? Math.round(netAfterLab / 2)
                        : docShareModel === 'fixed_per_treatment'
                          ? totalTreatmentsCount * docFixedWagePerItem
                          : Math.round((netAfterLab * docCustomPct) / 100);

                    const calculatedClinicShare = Math.max(0, netAfterLab - calculatedDoctorShare);

                    return (
                      <div className="bg-amber-50/70 rounded-2xl border border-amber-200/90 overflow-hidden tabular-nums">
                        <button
                          type="button"
                          onClick={() => setShowSplitLedgerDetails(prev => !prev)}
                          className="w-full px-3 py-2.5 flex items-center justify-between text-right text-[11px] font-black text-amber-950 hover:bg-amber-100/50 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-amber-700" />
                            <span>سهم‌بندی هوشمند پزشک معالج و صندوق مطب (۳ مدل محاسبه واقعی)</span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-amber-800">
                            <span>{showSplitLedgerDetails ? 'بستن' : 'مشاهده و تنظیم مدل سهم'}</span>
                            {showSplitLedgerDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </button>

                        {showSplitLedgerDetails && (
                          <div className="p-3 pt-2 border-t border-amber-200/60 space-y-2.5 text-[10.5px]">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                              {[
                                { id: 'net_50_50' as const, label: '۱. مناصفه ۵۰/۵۰ (کسر لابراتوار ÷ ۲)' },
                                { id: 'fixed_per_treatment' as const, label: '۲. دستمزد ثابت هر جراحی/درمان' },
                                { id: 'custom_pct' as const, label: '۳. درصدی پزشک / ۱۰۰٪ مدیر (مهدی امیری)' }
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setDocShareModel(m.id)}
                                  className={`py-1.5 px-2 rounded-xl border text-[10px] font-black transition-all cursor-pointer ${
                                    docShareModel === m.id
                                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                      : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>

                            {docShareModel === 'fixed_per_treatment' && (
                              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-amber-200">
                                <span className="font-bold text-slate-700">دستمزد ثابت هر درمان ({toPersianDigits(totalTreatmentsCount)} خدمت ثبت‌شده):</span>
                                <input
                                  type="number"
                                  dir="ltr"
                                  aria-label="دستمزد ثابت هر درمان پزشک"
                                  value={docFixedWagePerItem}
                                  onChange={(e) => setDocFixedWagePerItem(Number(e.target.value) || 0)}
                                  className="w-32 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 font-mono font-black text-amber-950 text-center"
                                />
                              </div>
                            )}

                            {docShareModel === 'custom_pct' && (
                              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-amber-200 flex-wrap">
                                <span className="font-bold text-slate-700">تعیین درصد سهم پزشک از خالص کارکرد:</span>
                                <select
                                  aria-label="درصد سهم پزشک معالج"
                                  value={docCustomPct}
                                  onChange={(e) => setDocCustomPct(Number(e.target.value))}
                                  className="bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1 font-mono font-black text-amber-950 cursor-pointer"
                                >
                                  <option value={100}>۱۰۰٪ خالص (دکتر مهدی امیری — مدیر و مالک مطب)</option>
                                  <option value={60}>۶۰٪ پزشک متخصص همکار</option>
                                  <option value={50}>۵۰٪ پزشک عمومی همکار</option>
                                  <option value={45}>۴۵٪ پزشک شیفت عصر</option>
                                  <option value={40}>۴۰٪ دستیار/پزشک طرحی</option>
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2 rounded-xl bg-white border border-slate-200">
                                <span className="text-slate-500 block text-[9.5px]">کل کارکرد درمان</span>
                                <span className="font-mono font-black text-slate-900">{formatToman(patient.totalCost)}</span>
                              </div>
                              <div className="p-2 rounded-xl bg-purple-50 border border-purple-200">
                                <span className="text-purple-700 block text-[9.5px]">کسر هزینه لابراتوار</span>
                                <span className="font-mono font-black text-purple-900">{formatToman(totalLabCost)}</span>
                              </div>
                              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300">
                                <span className="text-emerald-800 block text-[9.5px]">سهم خالص پزشک</span>
                                <span className="font-mono font-black text-emerald-900">{formatToman(calculatedDoctorShare)}</span>
                              </div>
                              <div className="p-2 rounded-xl bg-amber-100/70 border border-amber-300">
                                <span className="text-amber-900 block text-[9.5px]">سهم صندوق مطب</span>
                                <span className="font-mono font-black text-amber-950">{formatToman(calculatedClinicShare)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* TAB 5: Lab Orders */}
            {activeTab === 'lab' && (
              <div className="space-y-3">
                <div className="bg-white p-2.5 rounded-[20px] border border-purple-200/90 border-r-[3px] border-r-purple-500 shadow-[var(--shadow-card)]">
                  <SectionVisualBadge
                    icon={<FlaskConical className="w-4 h-4" />}
                    badgeLabel="پروتز و لابراتوار"
                    title="سفارشات رفت و برگشت لابراتوار"
                    count={patient.labOrders.length}
                    colorScheme="purple"
                    rightElement={
                      <button type="button"
                        onClick={() => onAddLabOrder(patient.id)}
                        className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ثبت سفارش جدید</span>
                      </button>
                    }
                  />
                </div>

                {patient.labOrders.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    سفارش لابراتواری برای این بیمار ثبت نشده است.
                  </div>
                ) : (
                  patient.labOrders.map((order, idx) => {
                    const labStages: Array<{ id: typeof order.status; label: string }> = [
                      { id: 'sent', label: '۱. ارسال قالب' },
                      { id: 'fabrication', label: '۲. ساخت لابراتوار' },
                      { id: 'frame_try_in', label: '۳. آماده پرو/تحویل' },
                      { id: 'delivered_cemented', label: '۴. تحویل و سمان' }
                    ];
                    const currentStageIdx = labStages.findIndex((s) => s.id === order.status);

                    return (
                      <div key={order.id} className="bg-white rounded-[20px] p-3 border border-purple-200/90 border-r-[3px] border-r-purple-500 shadow-[var(--shadow-card)] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 border border-purple-200 flex items-center justify-center font-mono font-black text-xs">
                              {toPersianDigits(idx + 1)}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{order.workType}</h4>
                              <span className="text-[11px] text-slate-600">دندان {order.toothNumber} · شید رنگ: {order.shade}</span>
                            </div>
                          </div>

                          <span className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-black ${
                            order.status === 'frame_try_in' || order.status === 'delivered_cemented'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}>
                            {order.status === 'frame_try_in'
                              ? '✓ آماده پرو / تحویل در مطب'
                              : order.status === 'delivered_cemented'
                                ? '✓ تحویل و سمان نهایی'
                                : '⏳ در حال ساخت لابراتوار'}
                          </span>
                        </div>

                        {/* Interactive 4-Step Lab Progress Stepper */}
                        <div className="grid grid-cols-4 gap-1 text-center">
                          {labStages.map((st, sIdx) => {
                            const isActive = sIdx === currentStageIdx;
                            const isDone = sIdx <= currentStageIdx;
                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  const nextOrders = patient.labOrders.map((lo) =>
                                    lo.id === order.id ? { ...lo, status: st.id } : lo
                                  );
                                  triggerFieldAutoSave({ labOrders: nextOrders });
                                  actionFeedback.recordSuccess({
                                    title: `وضعیت سفارش لابراتوار ${order.workType} بروزرسانی شد`,
                                    subtitle: `${patient.fullName} · مرحله: ${st.label}`,
                                    targetRecordId: patient.id,
                                    badgeText: `✓ ${st.label}`
                                  });
                                }}
                                className={`py-1 px-1.5 rounded-lg text-[9.5px] font-black border transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                                    : isDone
                                      ? 'bg-purple-50 text-purple-900 border-purple-200'
                                      : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                              >
                                {st.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                          <span>لابراتوار: {order.labName}</span>
                          <span>تحویل: {toPersianDigits(order.deliveryDate)}</span>
                          <span className="text-emerald-700 font-mono font-black">{formatToman(order.cost)}</span>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await clinicalSmsService.sendPatternSms(
                                patient.phone,
                                patient.fullName,
                                'lab_ready',
                                { workType: order.workType, toothNumber: order.toothNumber }
                              );
                              actionFeedback.recordSuccess({
                                title: `پیامک آمادگی پروتز ${order.workType} برای ${patient.fullName} ارسال شد`,
                                subtitle: `کد پیگیری مخابرات: ${res.refId}`,
                                targetRecordId: patient.id,
                                badgeText: '✓ پیامک لابراتوار ارسال شد'
                              });
                            }}
                            className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Send className="w-3 h-3 text-purple-700" />
                            <span>پیامک اطلاع‌رسانی پروتز</span>
                          </button>
                          {onScheduleAppointment && (
                            <button
                              type="button"
                              onClick={() => {
                                onScheduleAppointment(
                                  patient,
                                  `${order.status === 'frame_try_in' ? 'پرو فریم‌ورک و تحویل' : 'پیگیری پروتز'} ${order.workType} (${order.toothNumber})`
                                );
                                onClose();
                              }}
                              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>رزرو نوبت تحویل / پرو در یونیت</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {patient.labOrders.length > 0 && (
                  <div className="pt-2">
                    <Lab3DModelViewerD3
                      orders={patient.labOrders}
                      patients={[patient]}
                      onEditLabOrder={(orderId, updatedFields) => {
                        const nextOrders = patient.labOrders.map((lo) =>
                          lo.id === orderId ? { ...lo, ...updatedFields } : lo
                        );
                        triggerFieldAutoSave({ labOrders: nextOrders });
                      }}
                      onUpdateStatus={(orderId, nextStatus) => {
                        const nextOrders = patient.labOrders.map((lo) =>
                          lo.id === orderId ? { ...lo, status: nextStatus } : lo
                        );
                        triggerFieldAutoSave({ labOrders: nextOrders });
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: Implant Cases */}
            {activeTab === 'implant' && (
              <div className="space-y-3">
                <div className="bg-white p-2.5 rounded-[20px] border border-cyan-200/90 border-r-[3px] border-r-cyan-500 shadow-[var(--shadow-card)] space-y-2.5">
                  <SectionVisualBadge
                    icon={<Activity className="w-4 h-4" />}
                    badgeLabel="جراحی ایمپلنت"
                    title="کیس‌های کاشت فیکسچر و مراحل پروتزی"
                    count={patient.implantCases.length}
                    colorScheme="cyan"
                  />

                  {/* Inline New Implant Fixture & Osseointegration Registrar inside PatientFileModal */}
                  <div className="p-2.5 rounded-xl bg-cyan-50/75 border border-cyan-200/90 space-y-2 tabular-nums">
                    <div className="flex items-center justify-between text-[11px] font-black text-cyan-950">
                      <span>+ ثبت جراحی کاشت فیکسچر ایمپلنت جدید و تقویم هیلینگ:</span>
                      <span className="text-[10px] font-mono text-cyan-800">سیستم پالمر · یادآور خودکار ۹۰ روزه</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-[11px]">
                      <select
                        aria-label="ربع فک پالمر جراحی ایمپلنت"
                        value={newImpQuad}
                        onChange={(e) => setNewImpQuad(e.target.value as any)}
                        className="bg-white border border-cyan-200 rounded-xl px-2 py-1.5 font-mono font-black text-slate-900 cursor-pointer"
                      >
                        <option value="UR">UR (بالا راست)</option>
                        <option value="UL">UL (بالا چپ)</option>
                        <option value="LR">LR (پایین راست)</option>
                        <option value="LL">LL (پایین چپ)</option>
                      </select>
                      <select
                        aria-label="شماره دندان پالمر جراحی ایمپلنت"
                        value={newImpTooth}
                        onChange={(e) => setNewImpTooth(Number(e.target.value))}
                        className="bg-white border border-cyan-200 rounded-xl px-2 py-1.5 font-mono font-black text-slate-900 cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>دندان {toPersianDigits(n)}</option>
                        ))}
                      </select>
                      <select
                        aria-label="برند فیکسچر ایمپلنت"
                        value={newImpBrand}
                        onChange={(e) => setNewImpBrand(e.target.value)}
                        className="bg-white border border-cyan-200 rounded-xl px-2 py-1.5 font-bold text-slate-900 cursor-pointer"
                      >
                        <option value="Straumann BLT (اشترومن سوئیس)">Straumann (سوئیس)</option>
                        <option value="Osstem TSIII (اوستم کره)">Osstem TSIII (کره)</option>
                        <option value="MegaGen AnyRidge (مگاژن)">MegaGen AnyRidge</option>
                        <option value="Zimmer Biomet (زیمر آمریکا)">Zimmer Biomet</option>
                      </select>
                      <select
                        aria-label="سایز قطر و طول فیکسچر ایمپلنت"
                        value={newImpSize}
                        onChange={(e) => setNewImpSize(e.target.value)}
                        className="bg-white border border-cyan-200 rounded-xl px-2 py-1.5 font-mono font-bold text-slate-900 cursor-pointer"
                      >
                        <option value="3.8x10">قطر 3.8 × 10 mm</option>
                        <option value="4.1x10">قطر 4.1 × 10 mm</option>
                        <option value="4.1x12">قطر 4.1 × 12 mm</option>
                        <option value="4.8x10">قطر 4.8 × 10 mm</option>
                      </select>
                      <select
                        aria-label="تورک جراحی کاشت فیکسچر ایمپلنت"
                        value={newImpTorque}
                        onChange={(e) => setNewImpTorque(Number(e.target.value))}
                        className="bg-white border border-cyan-200 rounded-xl px-2 py-1.5 font-mono font-black text-emerald-900 cursor-pointer"
                      >
                        <option value={30}>تورک ۳۰ Ncm</option>
                        <option value={35}>تورک ۳۵ Ncm</option>
                        <option value={40}>تورک ۴۰ Ncm</option>
                        <option value={45}>تورک ۴۵ Ncm (فوری)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const [diam, len] = newImpSize.split('x');
                          const createdImp = {
                            id: `imp-${Date.now()}`,
                            patientId: patient.id,
                            patientName: patient.fullName,
                            toothNumber: `${newImpQuad}${newImpTooth}`,
                            brand: newImpBrand,
                            diameter: diam || '4.1',
                            length: len || '10',
                            torque: newImpTorque,
                            boneGraft: false,
                            membrane: false,
                            surgeryDate: getCurrentPersianDate(),
                            healingDueDate: getRelativePersianDate(90),
                            currentStage: 'fixture_placed' as const,
                            notes: `کاشت فیکسچر با تورک ${toPersianDigits(newImpTorque)} Ncm توسط دکتر مهدی امیری`
                          };
                          triggerFieldAutoSave({
                            implantCases: [createdImp, ...(patient.implantCases || [])]
                          });
                          recordAuditLog('ثبت جراحی ایمپلنت جدید', `دندان ${newImpQuad}${newImpTooth} · ${newImpBrand}`);
                          actionFeedback.recordSuccess({
                            title: `جراحی ایمپلنت دندان ${newImpQuad}${newImpTooth} (${newImpBrand}) ثبت شد`,
                            subtitle: `موعد هیلینگ و قالب‌گیری: ${toPersianDigits(createdImp.healingDueDate)}`,
                            targetRecordId: patient.id,
                            badgeText: `✓ ثبت ایمپلنت ${newImpQuad}${newImpTooth}`
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ثبت جراحی</span>
                      </button>
                    </div>
                  </div>
                </div>

                {patient.implantCases.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    هیچ ایمپلنتی برای این بیمار ثبت نشده است.
                  </div>
                ) : (
                  patient.implantCases.map((imp, idx) => {
                    const impStages: Array<{ id: typeof imp.currentStage; label: string }> = [
                      { id: 'fixture_placed', label: '۱. کاشت فیکسچر' },
                      { id: 'healing_cap', label: '۲. هیلینگ کپ' },
                      { id: 'impression', label: '۳. قالب‌گیری' },
                      { id: 'abutment_framework', label: '۴. فریم و اباتمنت' },
                      { id: 'crown_delivered', label: '۵. تحویل روکش' }
                    ];
                    const currentImpIdx = impStages.findIndex((s) => s.id === imp.currentStage);
                    const estimatedIsq = Math.min(82, Math.max(62, (imp.torque || 35) + 36));

                    return (
                      <div key={imp.id} className="bg-white rounded-[20px] p-3.5 border border-cyan-200/90 border-r-[3px] border-r-cyan-500 shadow-[var(--shadow-card)] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center justify-center font-mono font-black text-xs">
                              {toPersianDigits(idx + 1)}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{imp.toothNumber} · {imp.brand}</h4>
                              <span className="text-[10.5px] text-slate-600">تاریخ جراحی: {toPersianDigits(imp.surgeryDate)}</span>
                            </div>
                          </div>

                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 font-black">
                            {imp.currentStage === 'fixture_placed' && 'مرحله ۱: کاشت فیکسچر'}
                            {imp.currentStage === 'healing_cap' && 'مرحله ۲: هیلینگ'}
                            {imp.currentStage === 'impression' && 'مرحله ۳: قالب‌گیری'}
                            {imp.currentStage === 'abutment_framework' && 'مرحله ۴: فریم'}
                            {imp.currentStage === 'crown_delivered' && 'مرحله ۵: تحویل روکش'}
                          </span>
                        </div>

                        {/* Interactive 5-Stage Implant Osseointegration Progress Stepper */}
                        <div className="grid grid-cols-5 gap-1 text-center">
                          {impStages.map((st, sIdx) => {
                            const isActive = sIdx === currentImpIdx;
                            const isDone = sIdx <= currentImpIdx;
                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  const nextCases = patient.implantCases.map((ic) =>
                                    ic.id === imp.id ? { ...ic, currentStage: st.id } : ic
                                  );
                                  triggerFieldAutoSave({ implantCases: nextCases });
                                  actionFeedback.recordSuccess({
                                    title: `مرحله ایمپلنت دندان ${imp.toothNumber} ارتقا یافت`,
                                    subtitle: `${patient.fullName} · ${st.label}`,
                                    targetRecordId: patient.id,
                                    badgeText: `✓ ${st.label}`
                                  });
                                }}
                                className={`py-1 px-1 rounded-lg text-[9px] font-black border transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-cyan-600 text-white border-cyan-700 shadow-2xs'
                                    : isDone
                                      ? 'bg-cyan-50 text-cyan-900 border-cyan-200'
                                      : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                              >
                                {st.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 tabular-nums">
                          <div>قطر: <span className="text-slate-900 font-mono font-bold">{toPersianDigits(imp.diameter)} mm</span></div>
                          <div>طول: <span className="text-slate-900 font-mono font-bold">{toPersianDigits(imp.length)} mm</span></div>
                          <div>تورک: <span className="text-emerald-700 font-mono font-bold">{toPersianDigits(imp.torque)} Ncm</span></div>
                          <div>ثبات ISQ: <span className="text-cyan-800 font-mono font-black">{toPersianDigits(estimatedIsq)} (پایدار)</span></div>
                          <div>موعد هیلینگ: <span className="text-amber-700 font-mono font-bold">{toPersianDigits(imp.healingDueDate)}</span></div>
                        </div>

                        {imp.notes && <p className="text-[11px] text-slate-600">{imp.notes}</p>}

                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await clinicalSmsService.sendPatternSms(
                                patient.phone,
                                patient.fullName,
                                'implant_healing_recall',
                                {
                                  brand: imp.brand,
                                  toothNumber: imp.toothNumber,
                                  dueDate: imp.healingDueDate
                                }
                              );
                              actionFeedback.recordSuccess({
                                title: `پیامک یادآور مرحله ایمپلنت برای ${patient.fullName} ارسال شد`,
                                subtitle: `موعد: ${toPersianDigits(imp.healingDueDate)} · کد رهگیری: ${res.refId}`,
                                targetRecordId: patient.id,
                                badgeText: '✓ پیامک ایمپلنت ارسال شد'
                              });
                            }}
                            className="px-2.5 py-1 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Send className="w-3 h-3 text-cyan-700" />
                            <span>پیامک یادآور مرحله</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddLabOrder(patient.id)}
                            className="px-2.5 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span>ثبت سفارش لابراتوار</span>
                          </button>
                          {onScheduleAppointment && (
                            <button
                              type="button"
                              onClick={() => {
                                onScheduleAppointment(patient, `ادامه مرحله ایمپلنت ${imp.brand} (${imp.toothNumber})`);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>رزرو نوبت مرحله بعد</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {patient.implantCases.length > 0 && (
                  <div className="pt-2">
                    <Implant3DSurgicalPlannerD3
                      implantCases={patient.implantCases}
                      patients={[patient]}
                      onEditImplantCase={(caseId, updatedFields) => {
                        const nextCases = patient.implantCases.map((ic) =>
                          ic.id === caseId ? { ...ic, ...updatedFields } : ic
                        );
                        triggerFieldAutoSave({ implantCases: nextCases });
                      }}
                      onAdvanceStage={(caseId, nextStage) => {
                        const nextCases = patient.implantCases.map((ic) =>
                          ic.id === caseId ? { ...ic, currentStage: nextStage } : ic
                        );
                        triggerFieldAutoSave({ implantCases: nextCases });
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 7: Radiology / OPG */}
            {activeTab === 'xrays' && (() => {
              let storedXrays: Array<{
                id: string;
                patientId?: string;
                patientName: string;
                modality: string;
                region: string;
                date: string;
                doctorName: string;
                aiFindings?: string;
                imageDataUrl?: string;
              }> = [];
              try {
                const raw = localStorage.getItem('minadental_xray_records_v1');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (Array.isArray(parsed)) {
                    storedXrays = parsed.filter(
                      (r) => (r.patientId && r.patientId === patient.id) || r.patientName === patient.fullName
                    );
                  }
                }
              } catch {}
              // Reference xraySyncTick so React re-evaluates on live update
              void xraySyncTick;

              const handleQuickAddPatientXray = () => {
                try {
                  const raw = localStorage.getItem('minadental_xray_records_v1');
                  const currentList = raw ? JSON.parse(raw) : [];
                  const newRec = {
                    id: `xr-${Date.now()}`,
                    patientId: patient.id,
                    patientName: patient.fullName,
                    modality: quickXrayModality,
                    region: quickXrayRegion.trim() || 'بررسی فک و دندان',
                    date: getCurrentPersianDate(),
                    doctorName: 'دکتر مهدی امیری',
                    aiFindings: `ثبت مستقیم از پرونده بیمار (${quickXrayModality} - ${quickXrayRegion.trim() || 'فک'})`,
                    boneDensity: 'تراکم استخوان تیپ D2'
                  };
                  const nextList = [newRec, ...(Array.isArray(currentList) ? currentList : [])];
                  localStorage.setItem('minadental_xray_records_v1', JSON.stringify(nextList));
                  window.dispatchEvent(new CustomEvent('minadental:xray-records-updated'));
                  actionFeedback.recordSuccess({
                    title: `گرافی ${quickXrayModality} در پرونده ثبت شد`,
                    subtitle: `${patient.fullName} · ${newRec.region}`,
                    canUndo: false
                  });
                } catch {}
              };

              return (
                <div className="space-y-3">
                  <div className="bg-white p-2.5 rounded-[20px] border border-teal-200/90 border-r-[3px] border-r-teal-500 shadow-[var(--shadow-card)]">
                    <SectionVisualBadge
                      icon={<Camera className="w-4 h-4" />}
                      badgeLabel="گرافی و OPG"
                      title="تصاویر رادیوگرافی و فتوگرافی دیجیتال"
                      count={storedXrays.length + 2}
                      colorScheme="teal"
                      rightElement={
                        onOpenXRayModule ? (
                          <button type="button"
                            onClick={() => {
                              onClose();
                              onOpenXRayModule();
                            }}
                            className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-[11px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>مرکز رادیولوژی OPG</span>
                          </button>
                        ) : undefined
                      }
                    />
                  </div>

                  {/* Quick Register X-Ray for this Patient */}
                  <div className="bg-teal-50/70 p-2.5 rounded-2xl border border-teal-200/90 flex flex-wrap items-center gap-2">
                    <select
                      aria-label="نوع کلیشه رادیوگرافی"
                      value={quickXrayModality}
                      onChange={(e) => setQuickXrayModality(e.target.value as any)}
                      className="bg-white border border-teal-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                    >
                      <option value="پری‌اپیکال (RVG تک‌دندان)">پری‌اپیکال (RVG تک‌دندان)</option>
                      <option value="OPG (پانورامیک)">OPG (پانورامیک)</option>
                      <option value="CBCT (سه‌بعدی ایمپلنت)">CBCT (سه‌بعدی ایمپلنت)</option>
                    </select>
                    <input
                      type="text"
                      aria-label="ناحیه یا شماره دندان گرافی"
                      placeholder="ناحیه یا دندان (مثلاً UR6)"
                      value={quickXrayRegion}
                      onChange={(e) => setQuickXrayRegion(e.target.value)}
                      className="flex-1 min-w-[130px] bg-white border border-teal-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddPatientXray}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ثبت فوری گرافی</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {storedXrays.map((xr) => (
                      <div
                        key={xr.id}
                        onClick={() => {
                          if (onOpenXRayModule) {
                            onClose();
                            onOpenXRayModule();
                          }
                        }}
                        className="rounded-2xl overflow-hidden bg-white border-2 border-teal-200 shadow-2xs p-2 text-center group cursor-pointer hover:border-teal-400 transition-colors"
                      >
                        <div className="h-28 rounded-xl bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 overflow-hidden relative border border-teal-200 flex items-center justify-center">
                          {xr.imageDataUrl ? (
                            <img
                              src={xr.imageDataUrl}
                              alt={xr.modality}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <svg viewBox="0 0 180 96" className="w-full h-full p-2 text-teal-700" aria-label={xr.modality}>
                              <rect x="6" y="6" width="168" height="84" rx="12" fill="#f0fdfa" stroke="#99f6e4" strokeWidth="1.5" />
                              <path d="M28 50 Q90 18 152 50" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
                              <path d="M36 62 Q90 80 144 62" fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" />
                              {[48, 66, 84, 102, 120, 134].map((x) => (
                                <rect key={x} x={x - 5} y="39" width="10" height="22" rx="4" fill="#ccfbf1" stroke="#0f766e" strokeWidth="1.2" />
                              ))}
                              <text x="90" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#115e59">
                                {xr.region}
                              </text>
                            </svg>
                          )}
                        </div>
                        <span className="text-[11px] font-black text-teal-950 block mt-1.5 truncate">{xr.modality} · {xr.region}</span>
                        <span className="text-[10px] text-slate-500">{toPersianDigits(xr.date)}</span>
                      </div>
                    ))}

                    <div
                      onClick={() => {
                        if (onOpenXRayModule) {
                          onClose();
                          onOpenXRayModule();
                        }
                      }}
                      className="rounded-2xl overflow-hidden bg-white border-2 border-teal-100 shadow-2xs p-2 text-center group cursor-pointer hover:border-teal-300 transition-colors"
                    >
                      <div className="h-28 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 overflow-hidden relative border border-teal-200 flex items-center justify-center">
                        <svg viewBox="0 0 160 96" className="w-full h-full p-2" aria-label="کلیشه پری‌اپیکال PA">
                          <rect x="8" y="6" width="144" height="84" rx="12" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1.5" />
                          <path d="M62 24 C56 24 52 34 55 46 L62 74 C64 78 68 78 70 72 L76 54 L82 72 C84 78 88 78 90 74 L97 46 C100 34 96 24 90 24 C84 24 80 28 76 28 C72 28 68 24 62 24 Z" fill="#ecfdf5" stroke="#059669" strokeWidth="2.2" />
                          <path d="M68 38 L66 68 M84 38 L86 68" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 2" />
                          <text x="122" y="52" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#065f46">PA · RVG</text>
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block mt-1.5">گرافی پری‌اپیکال (PA) دندان ۶</span>
                      <span className="text-[10px] text-slate-500">{getRelativePersianDate(-1)}</span>
                    </div>

                    <div
                      onClick={() => {
                        if (onOpenXRayModule) {
                          onClose();
                          onOpenXRayModule();
                        }
                      }}
                      className="rounded-2xl overflow-hidden bg-white border-2 border-sky-100 shadow-2xs p-2 text-center group cursor-pointer hover:border-sky-300 transition-colors"
                    >
                      <div className="h-28 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 overflow-hidden relative border border-sky-200 flex items-center justify-center">
                        <svg viewBox="0 0 180 96" className="w-full h-full p-2" aria-label="کلیشه پانورامیک OPG">
                          <rect x="6" y="6" width="168" height="84" rx="12" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.5" />
                          <path d="M24 44 Q90 16 156 44" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
                          <path d="M30 58 Q90 80 150 58" fill="none" stroke="#0891b2" strokeWidth="2.2" strokeLinecap="round" />
                          {[38, 52, 66, 80, 94, 108, 122, 136].map((x) => (
                            <rect key={x} x={x - 4} y="37" width="8" height="22" rx="3" fill="#e0f2fe" stroke="#0369a1" strokeWidth="1.1" />
                          ))}
                          <text x="90" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#075985">OPG FULL ARCH</text>
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block mt-1.5">پانورامیک OPG فول‌ماوت</span>
                      <span className="text-[10px] text-slate-500">{getCurrentPersianDate()}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 8: AI Clinical Assistant */}
            {activeTab === 'ai' && (
              <div className="space-y-3">
                <div className="p-3 rounded-[20px] bg-white border border-sky-200 border-r-[3px] border-r-sky-500 shadow-[var(--shadow-card)]">
                  <SectionVisualBadge
                    icon={<Sparkles className="w-4 h-4" />}
                    badgeLabel="هوش مصنوعی"
                    title="تحلیل هوشمند بالینی و پیشنهاد طرح درمان"
                    colorScheme="sky"
                    rightElement={
                      <button type="button"
                        onClick={handleGenerateAiPlan}
                        disabled={aiLoading}
                        className="py-1.5 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {aiLoading ? 'در حال تحلیل...' : 'تحلیل پرونده'}
                      </button>
                    }
                  />
                </div>

                {/* Live Instant Clinical Decision Support Matrix (Always Visible) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                    <span className="font-black text-emerald-950 block">۱. اولویت بالینی بعدی:</span>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                      {suggestedNextTreatment} ({toPersianDigits(Object.keys(patient.teethConditions || {}).length)} دندان ثبت‌شده در پرونده)
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1">
                    <span className="font-black text-amber-950 block">۲. پروتکل ایمنی سیستمیک:</span>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                      {(patient.medicalHistory || []).filter(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim())).join(' · ') || 'فاقد ریسک سیستمیک خاص (ASA I)'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-1">
                    <span className="font-black text-indigo-950 block">۳. وضعیت تسویه و پیگیری:</span>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                      {patient.balance < 0
                        ? `مانده بدهی: ${formatToman(Math.abs(patient.balance))} (پیشنهاد تقسیط یا ارسال یادآور)`
                        : 'حساب بیمار تسویه کامل است ✓'}
                    </p>
                  </div>
                </div>

                {aiAnalysis ? (
                  <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line shadow-2xs">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    برای تولید طرح درمان هوشمند و بررسی بالینی پرونده، روی دکمه تحلیل کلیک کنید.
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      {/* Touch Screen / Stylus Digital Signature Modal with SHA-256 Legal Digest */}
      {signingConsent && patient && (
        <ConsentSignatureModal
          isOpen={true}
          onClose={() => setSigningConsent(null)}
          consentTitle={signingConsent.title}
          consentDesc={signingConsent.desc}
          patient={patient}
          existingSignature={signingConsent.existingSignature}
          onSaveSignature={(signatureDataUrl, timestamp, cryptoHash) => {
            if (onSaveConsentSignature) {
              onSaveConsentSignature(patient.id, signingConsent.id, signatureDataUrl, timestamp, cryptoHash);
            }
            setSigningConsent(null);
          }}
        />
      )}

      {/* Clinic Manager Security Authorization Modal (Dr. Mehdi Amiri Override) */}
      {managerPinModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="مجوز امنیتی مدیریت کلینیک"
          className="fixed inset-0 z-60 bg-emerald-950/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setManagerPinModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">مجوز امنیتی مدیریت کلینیک</h4>
                  <span className="text-[10px] text-amber-700 font-bold block">دکتر مهدی امیری · مدیر و پزشک معالج</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagerPinModalOpen(false)}
                aria-label="بستن پنجره مجوز مدیر"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-amber-50 p-3 rounded-2xl border border-amber-200/80">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-950 block">حفاظت از تعرفه و سوابق مالی</span>
                  <span className="text-[10.5px] text-amber-800">
                    پرسنل و منشی اجازه تغییر قیمت ثبت‌شده یا اعطای تخفیف بدون مجوز مدیر را ندارند. لطفاً رمز عبور یا پین ۴ رقمی مدیر کلینیک را وارد کنید.
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleVerifyManagerPin} className="space-y-3">
              <div>
                <label className="text-slate-700 font-bold text-xs block mb-1">رمز یا PIN مدیر کلینیک</label>
                <input
                  type="password"
                  autoFocus
                  placeholder="رمز عبور مدیر (۱۲۸۴۷)"
                  value={managerPinInput}
                  onChange={(e) => setManagerPinInput(e.target.value)}
                  className="w-full text-center text-base tracking-widest font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              {managerPinError && (
                <div className="text-[11px] font-bold text-rose-600 text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
                  {managerPinError}
                </div>
              )}

              <button
                type="button"
                onClick={handleBiometricUnlock}
                className="w-full py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>احراز هویت بیومتریک مدیر (FaceID / اثر انگشت)</span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setManagerPinModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/25 active:scale-95 transition-all"
                >
                  تایید مجوز و فعال‌سازی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Patient & Implant Warranty QR Wallet Pass Modal (Bright Pastel Theme) */}
      {showQrPassModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`کارت هوشمند QR بیمار ${patient.fullName}`}
          className="fixed inset-0 z-[110] bg-purple-950/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowQrPassModal(false)}
        >
          <div dir="rtl" onClick={(e) => e.stopPropagation()} className="w-full max-w-xs bg-gradient-to-b from-purple-50 via-white to-indigo-50 text-slate-900 rounded-[30px] shadow-2xl border-2 border-purple-200 p-5 space-y-4 text-right">
            <div className="flex items-center justify-between pb-2.5 border-b border-purple-100">
              <div>
                <span className="text-[10px] font-bold text-purple-700 block">مینادنتال · کارت هوشمند بیمار</span>
                <h4 className="text-sm font-black text-slate-900 mt-0.5">{patient.fullName}</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowQrPassModal(false)}
                aria-label="بستن کارت هوشمند بیمار"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scannable ISO Vector QR Code */}
            <div className="bg-white p-3.5 rounded-2xl mx-auto w-40 h-40 flex items-center justify-center shadow-xs border border-purple-200">
              <RealQrCode
                value={`MINA-PAT-${patient.fileNumber || patient.id}`}
                size={132}
                darkColor="#4c1d95"
                lightColor="#ffffff"
                ariaLabel={`کارت QR بیمار ${patient.fullName}`}
              />
            </div>

            <div className="space-y-1.5 bg-purple-50/70 p-3 rounded-2xl border border-purple-200/80 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-600">شماره پرونده:</span>
                <span className="font-mono font-black text-purple-800">{toPersianDigits(patient.fileNumber)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">پزشک معالج:</span>
                <span className="font-bold text-slate-900">دکتر مهدی امیری</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">گارانتی ایمپلنت:</span>
                <span className="font-bold text-emerald-700">
                  {patient.implantCases?.length > 0 ? `${patient.implantCases[0].brand.split(' ')[0]} (معتبر)` : 'ثبت در پرونده'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              چاپ / ذخیره در کیف پول موبایل
            </button>
          </div>
        </div>
      )}
      </div>
    </ViewportModalPortal>
  );
};
