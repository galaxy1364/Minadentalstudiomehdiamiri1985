import React, { useState } from 'react';
import { 
  FileCheck2, Shield, RefreshCw, Plus, ChevronLeft, 
  CreditCard, AlertOctagon, CheckCircle2, ArrowRightLeft,
  FileSearch, Smartphone, Ban, Calculator, Award,
  Sliders, UserCheck, Layers, Receipt, Send, Check,
  Search, ShieldAlert, Sparkles, AlertTriangle, Printer, BarChart3, X,
  ChevronDown, ChevronUp, Stethoscope, Edit3, Trash2, RotateCcw, Wallet, ShieldCheck, Phone, MessageSquare, Lock
} from 'lucide-react';
import * as d3 from 'd3';
import { SayadCheck, Installment, Patient, PaymentRecord } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, getCurrentPersianDate, diffPersianDays, getPersianTreatmentName } from '../../utils/jalali';
import { FinancialWeeklyAnalytics } from '../FinancialWeeklyAnalytics';
import { FinancialPerformanceChart } from '../FinancialPerformanceChart';
import { FinancialReportsDashboard } from '../FinancialReportsDashboard';
import { InstallmentPlanModal } from '../InstallmentPlanModal';
import { triggerHaptic } from '../../utils/haptics';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import {
  queryMaterializedOfficeDebtLedger,
  queryMaterializedDoctorCommissionLedger,
  refreshMaterializedFinancialViewsConcurrently,
  getMaterializedViewTelemetry,
  formatExactMicroToman
} from '../../utils/accountingEngine';
import { supabaseService } from '../../services/supabaseService';
import { actionFeedback } from '../../utils/actionFeedback';
import { clinicalSmsService } from '../../services/smsService';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { TrackableIdBadge } from '../TrackableIdBadge';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { evaluateMultiFieldFuzzySearch } from './PatientsListView';

export type FinancialSegment = 'debtors' | 'unified_hub' | 'commissions' | 'sayad' | 'guarantee' | 'installments' | 'receipts' | 'z_report' | 'analytics' | 'reports';

interface FinancialViewProps {
  patients: Patient[];
  initialSegment?: FinancialSegment;
  onOpenCheckModal: (patientId?: string) => void;
  onOpenPatientFile: (patient: Patient) => void;
  onOpenPaymentModal?: (patientId?: string) => void;
  onOpenInvoice?: (patient: Patient) => void;
  onOpenCommissionModal?: () => void;
  onSaveInstallmentPlan?: (patientId: string, installments: Installment[], checks: SayadCheck[], downPaymentAmount: number) => void;
  onPayInstallment?: (installment: Installment) => void;
  onUpdateCheckStatus?: (check: SayadCheck, status: SayadCheck['status']) => void;
  onEditCheck?: (checkId: string, updatedFields: Partial<SayadCheck>) => void;
  onDeleteCheck?: (checkId: string) => void;
  onEditInstallment?: (instId: string, updatedFields: Partial<Installment>) => void;
  onEditOrRefundPayment?: (paymentId: string, action: 'refund' | 'edit', newAmount?: number, newNote?: string) => void;
  isManager?: boolean;
}

export const FinancialView: React.FC<FinancialViewProps> = ({
  patients,
  initialSegment = 'debtors',
  onOpenCheckModal,
  onOpenPatientFile,
  onOpenPaymentModal,
  onOpenInvoice,
  onOpenCommissionModal,
  onSaveInstallmentPlan,
  onPayInstallment,
  onUpdateCheckStatus,
  onEditCheck,
  onDeleteCheck,
  onEditInstallment,
  onEditOrRefundPayment,
  isManager = false
}) => {
  const [activeSegment, setActiveSegment] = useState<FinancialSegment>(initialSegment);

  React.useEffect(() => {
    if (initialSegment) {
      setActiveSegment(initialSegment);
    }
  }, [initialSegment]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [selectedInstallmentPatientId, setSelectedInstallmentPatientId] = useState<string | undefined>(undefined);
  const [inquiryModalCheck, setInquiryModalCheck] = useState<SayadCheck | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquiryResult, setInquiryResult] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shiftClosed, setShiftClosed] = useState(false);
  const [selectedDoctorSlip, setSelectedDoctorSlip] = useState<any | null>(null);
  const [expandedDebtorId, setExpandedDebtorId] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});
  const toggleRecordExpand = (id: string) => {
    triggerHaptic('selection');
    setExpandedRecords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Edit / Refund Financial Record Modal States
  const [editingCheck, setEditingCheck] = useState<SayadCheck | null>(null);
  const [editCheckBank, setEditCheckBank] = useState('');
  const [editCheckSayadId, setEditCheckSayadId] = useState('');
  const [editCheckAmount, setEditCheckAmount] = useState(0);
  const [editCheckDueDate, setEditCheckDueDate] = useState('');

  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [editInstAmount, setEditInstAmount] = useState(0);
  const [editInstDueDate, setEditInstDueDate] = useState('');

  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPayAmount, setEditPayAmount] = useState(0);
  const [editPayNote, setEditPayNote] = useState('');

  // Manager Authorization PIN Unlock & 2-Step Confirmation States
  const [managerPinUnlocked, setManagerPinUnlocked] = useState(false);
  const [managerPinInput, setManagerPinInput] = useState('');
  const [managerPinError, setManagerPinError] = useState(false);
  const [confirmDeleteCheckId, setConfirmDeleteCheckId] = useState<string | null>(null);
  const [confirmRefundPaymentId, setConfirmRefundPaymentId] = useState<string | null>(null);

  // Real Sayad Maturity Tier Filter & POS Reconciliation Roll Input
  const [sayadMaturityFilter, setSayadMaturityFilter] = useState<'all' | '7d' | '3d' | 'today' | 'overdue'>('all');
  const [debtorStatusFilter, setDebtorStatusFilter] = useState<'all' | 'active_debt' | 'has_check_or_inst' | 'settled'>('all');
  const [installmentStatusFilter, setInstallmentStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'paid'>('all');
  const [receiptMethodFilter, setReceiptMethodFilter] = useState<'all' | 'pos' | 'cash' | 'card_to_card'>('all');
  const [expandedDoctorBreakdown, setExpandedDoctorBreakdown] = useState<Record<string, boolean>>({});
  const [posBatchInput, setPosBatchInput] = useState<string>('');
  const [savedZReports, setSavedZReports] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_z_reports_v1');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) return list;
      }
    } catch {}
    return [];
  });
  const [lastZReportTime, setLastZReportTime] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('minadental_z_reports_v1');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list[0]?.closedAtLabel) return list[0].closedAtLabel;
      }
    } catch {}
    return null;
  });

  useEscapeKey(Boolean(inquiryModalCheck), () => setInquiryModalCheck(null));
  useEscapeKey(Boolean(selectedDoctorSlip), () => setSelectedDoctorSlip(null));
  useEscapeKey(Boolean(editingCheck), () => { setEditingCheck(null); setConfirmDeleteCheckId(null); });
  useEscapeKey(Boolean(editingInstallment), () => setEditingInstallment(null));
  useEscapeKey(Boolean(editingPayment), () => { setEditingPayment(null); setConfirmRefundPaymentId(null); });

  const [mvEpoch, setMvEpoch] = useState(1);
  const [isRefreshingMv, setIsRefreshingMv] = useState(false);

  // Split-Ledger Materialized View Engines (500,000+ Records O(1) Indexed Read):
  // 1. Clinic & Manager Receivables Materialized View (`mv_clinic_office_debt_summary` & `mv_patient_debt_ranking`)
  const clinicLedger = React.useMemo(() => queryMaterializedOfficeDebtLedger(patients), [patients, mvEpoch]);

  React.useEffect(() => {
    const handler = () => setMvEpoch(prev => prev + 1);
    window.addEventListener('minadental:commission-rules-updated', handler);
    return () => window.removeEventListener('minadental:commission-rules-updated', handler);
  }, []);

  // 2. Doctor Work-Only Commissions Materialized View (`mv_doctor_commission_ledger`)
  const doctorsWorkSummary = React.useMemo(() => {
    let savedRules: any[] | null = null;
    try {
      const raw = localStorage.getItem('minadental_doctor_commission_rules_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) savedRules = parsed;
      }
    } catch {}

    const configs = savedRules
      ? savedRules.map(r => ({
          doctorId: r.doctorId,
          doctorName: r.doctorName,
          specialty: r.specialty,
          isManager: Boolean(r.isManager),
          model: r.defaultModel || r.model || 'percentage',
          percentageRate: Number(r.percentageRate ?? 50),
          fixedWagePerTreatment: Number(r.fixedWagePerTreatment ?? 3000000),
          baselineHistoricalGross: Number(r.baselineHistoricalGross ?? 0),
          baselineHistoricalLab: Number(r.baselineHistoricalLab ?? 0)
        }))
      : [
          {
            doctorId: 'doc_mehdi',
            doctorName: 'دکتر مهدی امیری',
            specialty: 'مدیر کلینیک · جراح فک و ایمپلنت',
            isManager: true,
            model: 'percentage' as const,
            percentageRate: 100,
            fixedWagePerTreatment: 5000000,
            baselineHistoricalGross: 120000000,
            baselineHistoricalLab: 14000000
          },
          {
            doctorId: 'doc_sara',
            doctorName: 'دکتر سارا رضوانی',
            specialty: 'متخصص ارتودنسی و زیبایی',
            isManager: false,
            model: 'lab_split_half' as const,
            percentageRate: 50,
            fixedWagePerTreatment: 3500000,
            baselineHistoricalGross: 68000000,
            baselineHistoricalLab: 12000000
          },
          {
            doctorId: 'doc_ali',
            doctorName: 'دکتر علی مرادی',
            specialty: 'متخصص اندودانتیکس و درمان ریشه',
            isManager: false,
            model: 'fixed_wage' as const,
            percentageRate: 45,
            fixedWagePerTreatment: 2800000,
            baselineHistoricalGross: 42000000,
            baselineHistoricalLab: 0
          }
        ];
    return configs.map(cfg => queryMaterializedDoctorCommissionLedger(patients, cfg));
  }, [patients, mvEpoch]);

  const handleQuickSwitchDoctorModel = (doctorId: string, nextModel: 'lab_split_half' | 'fixed_wage' | 'percentage') => {
    triggerHaptic('selection');
    try {
      const raw = localStorage.getItem('minadental_doctor_commission_rules_v1');
      let list: any[] = raw ? JSON.parse(raw) : [
        {
          doctorId: 'doc_mehdi',
          doctorName: 'دکتر مهدی امیری',
          specialty: 'مدیر کلینیک · جراح فک و ایمپلنت',
          isManager: true,
          defaultModel: 'percentage',
          percentageRate: 100,
          fixedWagePerTreatment: 5000000,
          baselineHistoricalGross: 120000000,
          baselineHistoricalLab: 14000000
        },
        {
          doctorId: 'doc_sara',
          doctorName: 'دکتر سارا رضوانی',
          specialty: 'متخصص ارتودنسی و زیبایی',
          isManager: false,
          defaultModel: 'lab_split_half',
          percentageRate: 50,
          fixedWagePerTreatment: 3500000,
          baselineHistoricalGross: 68000000,
          baselineHistoricalLab: 12000000
        },
        {
          doctorId: 'doc_ali',
          doctorName: 'دکتر علی مرادی',
          specialty: 'متخصص اندودانتیکس و درمان ریشه',
          isManager: false,
          defaultModel: 'fixed_wage',
          percentageRate: 45,
          fixedWagePerTreatment: 2800000,
          baselineHistoricalGross: 42000000,
          baselineHistoricalLab: 0
        }
      ];
      list = list.map(item =>
        item.doctorId === doctorId
          ? { ...item, defaultModel: nextModel, model: nextModel }
          : item
      );
      localStorage.setItem('minadental_doctor_commission_rules_v1', JSON.stringify(list));
      setMvEpoch(prev => prev + 1);
      window.dispatchEvent(new CustomEvent('minadental:commission-rules-updated'));
    } catch {}
  };

  const mvTelemetry = React.useMemo(() => getMaterializedViewTelemetry(patients.length), [patients.length, mvEpoch]);

  const handleConcurrentMvRefresh = async () => {
    if (isRefreshingMv) return;
    triggerHaptic('medium');
    setIsRefreshingMv(true);
    try {
      await supabaseService.refreshFinancialMaterializedViewsConcurrently();
      const updated = refreshMaterializedFinancialViewsConcurrently(patients);
      setMvEpoch(prev => prev + 1);
      actionFeedback.recordSuccess({
        title: 'Materialized Views با موفقیت Refresh شدند',
        subtitle: 'REFRESH MATERIALIZED VIEW CONCURRENTLY بدون قفل خواندن (500,000+ رکورد)',
        diffAfter: `Epoch #${toPersianDigits(updated.refreshEpoch)} · زمان: ${toPersianDigits(updated.views[0].lastRefreshLatencyMicroSec)} µs`,
        canUndo: false
      });
    } finally {
      setIsRefreshingMv(false);
    }
  };

  // Collect all checks and installments across patients (with Fuzzy Search support)
  const allChecks = patients.flatMap(p => p.sayadChecks || []);
  const sayadChecks = allChecks.filter(c => {
    if (c.isGuarantee) return false;
    if (!searchQuery.trim()) return true;
    return evaluateMultiFieldFuzzySearch(searchQuery, [
      { value: c.patientName, label: 'نام بیمار' },
      { value: c.sayadId, label: 'شناسه صیاد', maxTypos: 1 },
      { value: c.bankName, label: 'نام بانک' },
      { value: c.drawerName, label: 'صادرکننده چک' }
    ]).matched;
  });
  const guaranteeChecks = allChecks.filter(c => {
    if (!c.isGuarantee) return false;
    if (!searchQuery.trim()) return true;
    return evaluateMultiFieldFuzzySearch(searchQuery, [
      { value: c.patientName, label: 'نام بیمار' },
      { value: c.sayadId, label: 'شناسه صیاد', maxTypos: 1 },
      { value: c.bankName, label: 'نام بانک' }
    ]).matched;
  });
  const allInstallments = patients.flatMap(p => p.installments || []).filter(inst => {
    if (!searchQuery.trim()) return true;
    return evaluateMultiFieldFuzzySearch(searchQuery, [
      { value: inst.patientName, label: 'نام بیمار' },
      { value: inst.dueDate, label: 'تاریخ سررسید', maxTypos: 1 }
    ]).matched;
  });
  const allPayments = patients.flatMap(p => p.payments || []).filter(pay => {
    if (!searchQuery.trim()) return true;
    return evaluateMultiFieldFuzzySearch(searchQuery, [
      { value: pay.patientName, label: 'نام بیمار' },
      { value: pay.referenceNumber, label: 'شماره پیگیری', maxTypos: 1 },
      { value: pay.forTreatment, label: 'شرح درمان' }
    ]).matched;
  });

  const totalSayadAmount = sayadChecks.reduce((s, c) => s + c.amount, 0);
  const totalGuaranteeAmount = guaranteeChecks.reduce((s, c) => s + c.amount, 0);
  const totalPaidCash = allPayments.reduce((s, p) => s + p.amount, 0);
  const realPosTotal = allPayments.filter(p => p.method === 'pos').reduce((s, p) => s + p.amount, 0);
  const realCashTransferTotal = allPayments.filter(p => p.method !== 'pos').reduce((s, p) => s + p.amount, 0);
  const effectivePosRoll = posBatchInput.trim() !== ''
    ? Number(toEnglishDigits(posBatchInput).replace(/[^\d]/g, '')) || 0
    : realPosTotal;
  const posReconciliationVariance = effectivePosRoll - realPosTotal;

  const todayPersian = getCurrentPersianDate();
  const getCheckMaturityBucket = (check: SayadCheck): '7d' | '3d' | 'today' | 'overdue' | 'future' | 'done' => {
    if (check.status === 'cleared' || check.status === 'returned') return 'done';
    if (check.status === 'bounced') return 'overdue';
    const diff = diffPersianDays(todayPersian, check.dueDate);
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff <= 3) return '3d';
    if (diff <= 7) return '7d';
    return 'future';
  };

  const sayadTierCounts = {
    '7d': sayadChecks.filter(c => {
      const b = getCheckMaturityBucket(c);
      return b === '7d' || b === '3d' || b === 'today';
    }).length,
    '3d': sayadChecks.filter(c => {
      const b = getCheckMaturityBucket(c);
      return b === '3d' || b === 'today';
    }).length,
    today: sayadChecks.filter(c => getCheckMaturityBucket(c) === 'today').length,
    overdue: sayadChecks.filter(c => getCheckMaturityBucket(c) === 'overdue').length
  };

  const visibleSayadChecks = sayadMaturityFilter === 'all'
    ? sayadChecks
    : sayadChecks.filter(c => {
        const b = getCheckMaturityBucket(c);
        if (sayadMaturityFilter === '7d') return b === '7d' || b === '3d' || b === 'today';
        if (sayadMaturityFilter === '3d') return b === '3d' || b === 'today';
        return b === sayadMaturityFilter;
      });

  const d3SayadMaturity = React.useMemo(() => {
    const bucketDefs: Array<{
      id: 'overdue' | 'today' | '3d' | '7d' | 'future' | 'done';
      filterKey: 'overdue' | 'today' | '3d' | '7d' | 'all';
      label: string;
      color: string;
    }> = [
      { id: 'overdue', filterKey: 'overdue', label: 'معوق', color: '#e11d48' },
      { id: 'today', filterKey: 'today', label: 'امروز', color: '#ea580c' },
      { id: '3d', filterKey: '3d', label: '۳ روزه', color: '#d97706' },
      { id: '7d', filterKey: '7d', label: '۷ روزه', color: '#0284c7' },
      { id: 'future', filterKey: 'all', label: 'آتی', color: '#7c3aed' },
      { id: 'done', filterKey: 'all', label: 'وصول‌شده', color: '#059669' }
    ];
    const rows = bucketDefs.map(def => {
      const items = sayadChecks.filter(c => getCheckMaturityBucket(c) === def.id);
      const amountM = Math.round((items.reduce((s, c) => s + (c.amount || 0), 0) / 1_000_000) * 10) / 10;
      return {
        ...def,
        count: items.length,
        amountM
      };
    });
    const width = 440;
    const height = 108;
    const margin = { top: 14, right: 12, bottom: 24, left: 24 };
    const maxVal = Math.max(1, d3.max(rows, r => r.amountM) || 1);
    const xScale = d3
      .scaleBand<string>()
      .domain(rows.map(r => r.id))
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
      bars: rows.map(r => {
        const x = xScale(r.id) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(r.amountM);
        const h = Math.max(r.amountM > 0 ? 6 : 2, baselineY - y);
        return {
          ...r,
          x,
          y: baselineY - h,
          barW,
          h
        };
      })
    };
  }, [sayadChecks, todayPersian]);

  const d3FinancialOverview = React.useMemo(() => {
    const unpaidInstAmount = allInstallments.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount || 0), 0);
    const rows = [
      { id: 'receipts' as FinancialSegment, label: 'وصولی کل', valueM: Math.round((clinicLedger.totalRealizedClinicCashflow / 1_000_000) * 10) / 10, color: '#059669' },
      { id: 'debtors' as FinancialSegment, label: 'مطالبات', valueM: Math.round((clinicLedger.totalOutstandingPatientDebtToClinic / 1_000_000) * 10) / 10, color: '#e11d48' },
      { id: 'sayad' as FinancialSegment, label: 'چک صیادی', valueM: Math.round((totalSayadAmount / 1_000_000) * 10) / 10, color: '#7c3aed' },
      { id: 'installments' as FinancialSegment, label: 'اقساط باز', valueM: Math.round((unpaidInstAmount / 1_000_000) * 10) / 10, color: '#d97706' },
      { id: 'guarantee' as FinancialSegment, label: 'ضمانت', valueM: Math.round((totalGuaranteeAmount / 1_000_000) * 10) / 10, color: '#0284c7' }
    ];
    const width = 440;
    const height = 104;
    const margin = { top: 14, right: 12, bottom: 24, left: 24 };
    const maxVal = Math.max(1, d3.max(rows, r => r.valueM) || 1);
    const xScale = d3
      .scaleBand<string>()
      .domain(rows.map(r => r.id))
      .range([margin.left, width - margin.right])
      .padding(0.3);
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
      bars: rows.map(r => {
        const x = xScale(r.id) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(r.valueM);
        const h = Math.max(r.valueM > 0 ? 6 : 2, baselineY - y);
        return {
          ...r,
          x,
          y: baselineY - h,
          barW,
          h
        };
      })
    };
  }, [clinicLedger, totalSayadAmount, totalGuaranteeAmount, allInstallments]);

  const canModifyFinancialAmount = isManager || managerPinUnlocked;

  const handleVerifyManagerPin = () => {
    let savedPin = '1234';
    try {
      const stored = localStorage.getItem('minadental_manager_pin_v1');
      if (stored && stored.trim()) savedPin = toEnglishDigits(stored.trim());
    } catch {}
    if (toEnglishDigits(managerPinInput.trim()) === savedPin) {
      triggerHaptic('success');
      setManagerPinUnlocked(true);
      setManagerPinError(false);
      setManagerPinInput('');
    } else {
      triggerHaptic('warning');
      setManagerPinError(true);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRunSayadInquiry = (check: SayadCheck) => {
    setInquiryModalCheck(check);
    setInquiryLoading(true);
    setInquiryResult(null);

    setTimeout(() => {
      setInquiryLoading(false);
      setInquiryResult({
        sayadId: check.sayadId,
        issuerName: check.drawerName || check.patientName,
        bankName: check.bankName,
        statusColor: check.status === 'bounced' ? 'orange' : 'white',
        bouncedCount: check.status === 'bounced' ? 1 : 0,
        creditScore: check.status === 'bounced' ? 'نیازمند پیگیری (رتبه B)' : 'عالی (رتبه A)',
        lastUpdated: `امروز ${getCurrentPersianDate()}`,
        isPechakVerified: true
      });
    }, 600);
  };

  const handleMarkInstallmentPaid = (installment: Installment) => {
    triggerHaptic('success');
    onPayInstallment?.(installment);
    showToast(`قسط شماره ${toPersianDigits(installment.installmentNumber)} بیمار ${installment.patientName} به مبلغ ${formatToman(installment.amount)} تسویه و در صندوق ثبت شد.`);
  };

  const handleMarkCheckCleared = (check: SayadCheck) => {
    triggerHaptic('success');
    onUpdateCheckStatus?.(check, 'cleared');
    showToast(`چک صیادی ${check.sayadId} بابت ${check.patientName} به مبلغ ${formatToman(check.amount)} وصول و از بدهی کسر گردید.`);
  };

  const handleMarkCheckBounced = (check: SayadCheck) => {
    triggerHaptic('warning');
    onUpdateCheckStatus?.(check, 'bounced');
    showToast(`وضعیت چک ${check.sayadId} بابت ${check.patientName} به «برگشت خورده» تغییر یافت و جهت پیگیری ثبت شد.`);
  };

  const handleReturnGuaranteeCheck = (check: SayadCheck) => {
    triggerHaptic('success');
    onUpdateCheckStatus?.(check, 'returned');
    showToast(`چک ضمانت شماره ${check.sayadId} به بیمار ${check.patientName} عودت داده شد و رسید تحویل ثبت گردید.`);
  };

  const handleSendReminderSms = async (
    patientId: string,
    name: string,
    kind: 'sayad_check_due' | 'installment_due',
    amount: number,
    dueDate: string,
    label: string
  ) => {
    triggerHaptic('medium');
    const matchedPatient = patients.find(p => p.id === patientId || p.fullName.trim() === name.trim());
    const phone = matchedPatient?.phone || '09120000000';
    await clinicalSmsService.sendPatternSms(phone, name, kind, {
      amount: formatToman(amount),
      dueDate
    });
    actionFeedback.recordSuccess({
      title: `پیامک ${label} برای «${name}» ارسال شد`,
      subtitle: `مبلغ: ${formatToman(amount)} · سررسید: ${toPersianDigits(dueDate)}`,
      targetRecordId: patientId,
      badgeText: `✓ پیامک ${label} ارسال شد`,
      canUndo: false
    });
    showToast(`پیامک یادآوری ${label} برای ${name} ارسال گردید.`);
  };

  const handleSendBatchCheckSms = async () => {
    triggerHaptic('heavy');
    const targetChecks = visibleSayadChecks.filter(c => c.status !== 'cleared' && c.status !== 'returned');
    let sentCount = 0;
    for (const chk of targetChecks) {
      const pat = patients.find(p => p.id === chk.patientId || p.fullName === chk.patientName);
      if (pat?.phone) {
        await clinicalSmsService.sendPatternSms(pat.phone, pat.fullName, 'sayad_check_due', {
          amount: formatToman(chk.amount),
          dueDate: chk.dueDate
        });
        sentCount += 1;
      }
    }
    actionFeedback.recordSuccess({
      title: `فراخوان گروهی سررسید چک (${toPersianDigits(sentCount)} پیامک) ارسال شد`,
      subtitle: 'ارسال الگوی استاندارد یادآوری صیاد برای چک‌های سررسید نزدیک و معوق',
      canUndo: false
    });
    showToast(`پیامک گروهی یادآوری سررسید برای ${toPersianDigits(sentCount)} چک ارسال شد.`);
  };

  const handleSendBatchDebtorSms = async () => {
    triggerHaptic('heavy');
    const activeDebtors = clinicLedger.debtorRecords.filter(d => d.exactRemainingDebtToClinic > 0);
    let sentCount = 0;
    for (const deb of activeDebtors) {
      if (deb.phone) {
        await clinicalSmsService.sendPatternSms(deb.phone, deb.patientName, 'installment_due', {
          amount: formatToman(deb.exactRemainingDebtToClinic),
          dueDate: todayPersian
        });
        sentCount += 1;
      }
    }
    actionFeedback.recordSuccess({
      title: `پیامک گروهی مطالبات (${toPersianDigits(sentCount)} بیمار بدهکار) ارسال شد`,
      subtitle: `مجموع مطالبات پیگیری‌شده: ${formatToman(clinicLedger.totalOutstandingPatientDebtToClinic)}`,
      canUndo: false
    });
    showToast(`پیامک یادآوری تسویه حساب برای ${toPersianDigits(sentCount)} پرونده بدهکار ارسال شد.`);
  };

  const handleExportDebtorsCsv = () => {
    triggerHaptic('success');
    const header = 'نام بیمار,شماره پرونده,تلفن,کل کارکرد درمان (تومان),پرداختی نقد و پوز (تومان),چک در جریان (تومان),مانده بدهی قطعی (تومان)';
    const rows = clinicLedger.debtorRecords.map(d =>
      `"${d.patientName}","${d.fileNumber}","${d.phone}",${d.totalRegisteredTreatmentsCost},${d.totalCashAndPosPaid},${d.totalPendingChecks},${d.exactRemainingDebtToClinic}`
    );
    const csv = `\uFEFF${[header, ...rows].join('\n')}`;
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MinaDental_Debtors_${toEnglishDigits(todayPersian).replace(/\//g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {}
    showToast('فایل اکسل (CSV) دفتر مطالبات و بدهکاران آماده و دانلود شد.');
  };

  const handleSendBatchInstallmentSms = async () => {
    triggerHaptic('heavy');
    const unpaid = allInstallments.filter(i => i.status !== 'paid');
    let sentCount = 0;
    for (const inst of unpaid) {
      const pat = patients.find(p => p.id === inst.patientId || p.fullName === inst.patientName);
      if (pat?.phone) {
        await clinicalSmsService.sendPatternSms(pat.phone, pat.fullName, 'installment_due', {
          amount: formatToman(inst.amount),
          dueDate: inst.dueDate
        });
        sentCount += 1;
      }
    }
    actionFeedback.recordSuccess({
      title: `یادآوری گروهی اقساط (${toPersianDigits(sentCount)} پیامک) ارسال شد`,
      subtitle: 'ارسال پیامک سررسید اقساط باز به بیماران',
      canUndo: false
    });
    showToast(`پیامک یادآوری سررسید برای ${toPersianDigits(sentCount)} قسط باز ارسال شد.`);
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-2.5 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-amber-600 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in border border-amber-400">
          <Check className="w-4 h-4 stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card - Distinct Amber/Gold Command Framing & Multi-Color Chip Bar */}
      <div className="relative z-20 mx-2 mt-2 min-w-0">
        <div className={getModuleHeaderCardClasses('amber')}>
          {/* Header Row: Title + Animated Search Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/80 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <CreditCard className="w-4.5 h-4.5 stroke-[2.25]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-black text-sm text-slate-950 leading-none truncate">امور مالی، چک و اقساط</h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black font-mono tabular-nums">
                    {toPersianDigits(clinicLedger.debtorsCount)} پرونده بدهکار
                  </span>
                </div>
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
                className={`min-w-[38px] min-h-[38px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجوی فازی در امور مالی"
                aria-label="جستجو در امور مالی"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>
            </div>
          </div>

          {/* Slim Single-Line Scrollable (Mobile) / 4-Column (Desktop) Interactive Financial KPI Triage Strip */}
          <div className="flex sm:grid sm:grid-cols-4 overflow-x-auto no-scrollbar gap-1.5 pt-0.5 [&>button]:shrink-0 [&>button]:min-w-[148px] sm:[&>button]:min-w-0 [&>button]:py-1.5 [&>button]:px-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveSegment('receipts');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeSegment === 'receipts'
                  ? 'bg-emerald-100/90 border-emerald-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-emerald-50/60 border-emerald-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">وصولی قطعی مطب</span>
                <span className="text-xs font-black text-emerald-800 font-mono tabular-nums">
                  {formatToman(clinicLedger.totalRealizedClinicCashflow)}
                </span>
              </div>
              <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveSegment('debtors');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeSegment === 'debtors'
                  ? 'bg-rose-100/90 border-rose-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-rose-50/60 border-rose-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">مطالبات و بدهکاران</span>
                <span className="text-xs font-black text-rose-800 font-mono tabular-nums">
                  {formatToman(clinicLedger.totalOutstandingPatientDebtToClinic)}
                </span>
              </div>
              <Wallet className="w-4 h-4 text-rose-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveSegment('sayad');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeSegment === 'sayad'
                  ? 'bg-purple-100/90 border-purple-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-purple-50/60 border-purple-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">چک‌های صیادی در جریان</span>
                <span className="text-xs font-black text-purple-900 font-mono tabular-nums">
                  {formatToman(totalSayadAmount)}
                </span>
              </div>
              <FileCheck2 className="w-4 h-4 text-purple-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveSegment('installments');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeSegment === 'installments'
                  ? 'bg-amber-100/90 border-amber-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-amber-50/60 border-amber-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">اقساط جاری درمانی</span>
                <span className="text-xs font-black text-amber-900 font-mono tabular-nums">
                  {toPersianDigits(allInstallments.filter(i => i.status !== 'paid').length)} قسط باز
                </span>
              </div>
              <Calculator className="w-4 h-4 text-amber-600 shrink-0" />
            </button>
          </div>

          {/* Animated Expandable Fuzzy Search Input */}
          {searchOpen && (
            <div className="relative animate-in slide-in-from-top-2 duration-150">
              <Search className="w-4 h-4 text-amber-600 absolute right-3 top-2.5" />
              <input
                type="text"
                autoFocus
                placeholder="جستجوی فازی نام بیمار (حتی با غلط تایپی)، شناسه صیاد ۱۶ رقمی، بانک یا شماره پرونده..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/90 focus:border-amber-500 rounded-2xl pr-9 pl-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="پاک کردن جستجو"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2.5 w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              )}
            </div>
          )}

          {/* Row 2: Horizontal Scrollable Chip Bar + Pinned Inline Primary CTA (ثبت چک) */}
          <div className="flex items-center gap-1.5 pt-0.5 min-w-0">
            <div role="tablist" aria-label="بخش‌های ماژول" className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'debtors', label: `بدهکاران مطب (${toPersianDigits(clinicLedger.debtorsCount)})` },
                { id: 'unified_hub', label: 'یکپارچه: اقساط، چک، ضمانت و یادآوری' },
                { id: 'commissions', label: 'سهم کارکرد پزشکان (مستقل)' },
                { id: 'sayad', label: `چک صیادی (${toPersianDigits(sayadChecks.length)})` },
                { id: 'guarantee', label: `چک ضمانت (${toPersianDigits(guaranteeChecks.length)})` },
                { id: 'installments', label: `اقساط درمانی (${toPersianDigits(allInstallments.length)})` },
                { id: 'receipts', label: 'صندوق و کارت‌خوان POS' },
                { id: 'z_report', label: 'بستن صندوق روزانه' },
                { id: 'analytics', label: 'نمودار و تراز مالی' },
                { id: 'reports', label: 'گزارش‌های مالی' }
              ].map((chip, idx) => (
                <button role="tab" aria-selected={activeSegment === chip.id}
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setActiveSegment(chip.id as any);
                  }}
                  className={getUnifiedChipClasses(idx + 3, activeSegment === chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('heavy');
                onOpenCheckModal();
              }}
              className="shrink-0 min-h-[34px] py-1.5 px-3 rounded-xl bg-[#c8ff00] hover:bg-[#d5ff33] text-black font-black text-[11px] flex items-center gap-1 border border-[#b4ea00] shadow-xs active:scale-95 transition-all cursor-pointer"
              title="ثبت چک جدید"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>ثبت چک</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action & Total Summary Card (Only on transaction segments to prevent clutter) */}
      {activeSegment !== 'analytics' && activeSegment !== 'z_report' && activeSegment !== 'reports' && (
        <div className="mx-2 min-w-0">
          <div className="w-full max-w-full min-w-0 rounded-[22px] border border-amber-200/90 bg-gradient-to-br from-amber-50/80 via-white to-yellow-50/50 p-2.5 sm:p-3.5 text-center text-slate-800 relative overflow-hidden shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-amber-100 text-xs min-w-0">
              <span className="text-slate-600 font-bold text-[11px] truncate">
                {activeSegment === 'debtors' && 'کل بدهی واقعی بیماران به مطب و مدیر:'}
                {activeSegment === 'unified_hub' && 'تراز یکپارچه اقساط، چک صیادی، ضمانت و یادآوری:'}
                {activeSegment === 'commissions' && 'مبنای محاسبه سهم پزشکان:'}
                {activeSegment === 'sayad' && 'مجموع چک‌های صیادی مطب:'}
                {activeSegment === 'guarantee' && 'مجموع چک‌های ضمانتی مطب:'}
                {activeSegment === 'installments' && 'اقساط فعال درمانی مطب:'}
                {activeSegment === 'receipts' && 'کل وصولی نقد و پوز مطب:'}
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-amber-900 tabular-nums">
                {activeSegment === 'debtors' && formatExactMicroToman(clinicLedger.totalOutstandingPatientDebtToClinic, true)}
                {activeSegment === 'unified_hub' && `${toPersianDigits(allInstallments.filter(i => i.status !== 'paid').length)} قسط باز · ${toPersianDigits(sayadChecks.length)} چک · ${toPersianDigits(guaranteeChecks.length)} ضمانت`}
                {activeSegment === 'commissions' && '۱۰۰٪ از کارکرد ثبت‌شده (مستقل از پرداخت)'}
                {activeSegment === 'sayad' && formatToman(totalSayadAmount)}
                {activeSegment === 'guarantee' && formatToman(totalGuaranteeAmount)}
                {activeSegment === 'installments' && `${toPersianDigits(allInstallments.length)} فقره قسط جاری`}
                {activeSegment === 'receipts' && formatToman(totalPaidCash)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onOpenPaymentModal?.();
                }}
                className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] transition-all cursor-pointer min-w-0"
              >
                <CreditCard className="w-3 h-3 shrink-0" />
                <span className="truncate">دریافت POS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setShowInstallmentModal(true);
                }}
                className="py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] transition-all cursor-pointer min-w-0"
              >
                <Calculator className="w-3 h-3 shrink-0" />
                <span className="truncate">قسط‌بندی هوشمند</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  if (onOpenInvoice && patients[0]) onOpenInvoice(patients[0]);
                }}
                className="py-1.5 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] transition-all cursor-pointer min-w-0"
                title="صدور و چاپ فاکتور درمان و تسویه حساب"
              >
                <Printer className="w-3 h-3 shrink-0" />
                <span className="truncate">فاکتور درمان</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onOpenCommissionModal?.();
                }}
                className="py-1.5 px-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] transition-all cursor-pointer min-w-0"
                title="محاسبه هوشمند سهم‌بندی و پورسانت پزشکان"
              >
                <Award className="w-3 h-3 shrink-0" />
                <span className="truncate">سهم‌بندی پزشک</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area based on Segment */}
      <div className="mx-2 space-y-2.5 min-w-0">
        {/* TAB 0-UNIFIED: 5-PILLAR UNIFIED FINANCIAL + INSTALLMENTS + SAYAD CHECK + GUARANTEE + REMINDER HUB */}
        {activeSegment === 'unified_hub' && (
          <div className="space-y-2.5 text-right min-w-0 animate-in fade-in duration-150">
            <div className="w-full max-w-full min-w-0 overflow-hidden p-3 rounded-[22px] bg-gradient-to-l from-amber-50 via-purple-50/70 to-emerald-50/70 border border-amber-300/90 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-black text-slate-950 truncate">
                      میز فرمان یکپارچه مالی، اقساط، چک صیادی، ضمانت و یادآوری
                    </h4>
                    <span className="text-[10px] font-bold text-slate-600 block truncate">
                      همگام‌سازی زنده ۵ ستون مالی هر بیمار با تسویه دوطرفه خودکار
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSendBatchInstallmentSms();
                      await handleSendBatchCheckSms();
                    }}
                    className="py-1 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Send className="w-3 h-3 -scale-x-100 shrink-0" />
                    <span>یادآوری یکپارچه اقساط و چک</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setShowInstallmentModal(true);
                    }}
                    className="py-1 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Calculator className="w-3 h-3 shrink-0" />
                    <span>ثبت طرح یکپارچه جدید</span>
                  </button>
                </div>
              </div>

              {/* 5-Pillar Summary Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center text-[10px] min-w-0">
                <div className="p-2 rounded-xl bg-white border border-rose-200 min-w-0 overflow-hidden">
                  <span className="text-rose-700 font-bold block text-[9px] truncate">۱. مطالبات مطب</span>
                  <span className="font-mono font-black text-rose-900 block mt-0.5 truncate">
                    {formatToman(clinicLedger.totalOutstandingPatientDebtToClinic)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-amber-200 min-w-0 overflow-hidden">
                  <span className="text-amber-800 font-bold block text-[9px] truncate">۲. اقساط جاری</span>
                  <span className="font-mono font-black text-amber-950 block mt-0.5 truncate">
                    {toPersianDigits(allInstallments.filter(i => i.status !== 'paid').length)} از {toPersianDigits(allInstallments.length)} قسط
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-purple-200 min-w-0 overflow-hidden">
                  <span className="text-purple-800 font-bold block text-[9px] truncate">۳. چک صیادی</span>
                  <span className="font-mono font-black text-purple-950 block mt-0.5 truncate">
                    {formatToman(totalSayadAmount)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-orange-200 min-w-0 overflow-hidden">
                  <span className="text-orange-800 font-bold block text-[9px] truncate">۴. چک ضمانت امانی</span>
                  <span className="font-mono font-black text-orange-950 block mt-0.5 truncate">
                    {toPersianDigits(guaranteeChecks.length)} فقره ({formatToman(totalGuaranteeAmount)})
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-2 rounded-xl bg-white border border-sky-200 min-w-0 overflow-hidden">
                  <span className="text-sky-800 font-bold block text-[9px] truncate">۵. یادآوری خودکار</span>
                  <span className="font-black text-sky-950 block mt-0.5 truncate">
                    فعال (۲ و ۳ روز قبل 🔔)
                  </span>
                </div>
              </div>
            </div>

            {/* Unified Per-Patient 5-Pillar Cards */}
            {patients
              .filter(p => {
                const hasFinancialActivity =
                  (p.totalCost || 0) > (p.paidAmount || 0) ||
                  (p.installments || []).length > 0 ||
                  (p.sayadChecks || []).length > 0;
                if (!hasFinancialActivity) return false;
                if (!searchQuery.trim()) return true;
                return evaluateMultiFieldFuzzySearch(searchQuery, [
                  { value: p.fullName, label: 'نام بیمار' },
                  { value: p.fileNumber, label: 'شماره پرونده', maxTypos: 1 },
                  { value: p.phone, label: 'تلفن', maxTypos: 1 }
                ]).matched;
              })
              .map((pat, patIdx) => {
                const debt = Math.max(0, (pat.totalCost || 0) - (pat.paidAmount || 0));
                const insts = pat.installments || [];
                const paidInsts = insts.filter(i => i.status === 'paid').length;
                const sayadList = (pat.sayadChecks || []).filter(c => !c.isGuarantee);
                const guarList = (pat.sayadChecks || []).filter(c => c.isGuarantee);
                const activeGuar = guarList.find(c => c.status !== 'returned');
                const isGuarReady = Boolean(activeGuar && debt <= 0 && (insts.length === 0 || paidInsts === insts.length));

                return (
                  <div
                    key={pat.id}
                    className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[22px] p-3 border border-amber-200/90 border-r-[3px] border-r-amber-500 shadow-[var(--shadow-card)] space-y-2.5"
                  >
                    {/* Header: Patient + Debt + Quick Unified Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 font-mono font-black text-xs flex items-center justify-center shrink-0">
                          {toPersianDigits(patIdx + 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-slate-950 truncate">{pat.fullName}</h4>
                            <span className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {toPersianDigits(pat.fileNumber)}
                            </span>
                            {isGuarReady && (
                              <span className="text-[9.5px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                                چک ضمانت آماده عودت ✓
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            کل درمان: {formatToman(pat.totalCost || 0)} · پرداختی: {formatToman(pat.paidAmount || 0)} · مانده: <strong className={debt > 0 ? 'text-rose-700' : 'text-emerald-700'}>{debt > 0 ? formatToman(debt) : 'تسویه ✓'}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('medium');
                            setSelectedInstallmentPatientId(pat.id);
                            setShowInstallmentModal(true);
                          }}
                          className="py-1 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Calculator className="w-3 h-3 text-amber-600" />
                          <span>تقسیط و ضمانت</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCheckModal(pat.id)}
                          className="py-1 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <FileCheck2 className="w-3 h-3 text-purple-600" />
                          <span>ثبت چک</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPatientFile(pat)}
                          className="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          پرونده کامل
                        </button>
                      </div>
                    </div>

                    {/* Unified 3-Column Interactive Grid: Installments | Sayad Checks | Guarantee & Reminders */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] min-w-0">
                      {/* Pillar A: Installments */}
                      <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between font-black text-amber-950">
                          <span>اقساط درمانی ({toPersianDigits(paidInsts)}/{toPersianDigits(insts.length)})</span>
                          <span className="text-[9px] text-amber-700">همگام با چک</span>
                        </div>
                        {insts.length === 0 ? (
                          <span className="text-slate-400 block text-[9.5px]">بدون قسط ثبت‌شده</span>
                        ) : (
                          insts.slice(0, 3).map(inst => (
                            <div key={inst.id} className="p-1.5 rounded-lg bg-white border border-amber-200/70 flex items-center justify-between gap-1">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">
                                  قسط {toPersianDigits(inst.installmentNumber)} · {toPersianDigits(inst.dueDate)}
                                </span>
                                <span className="font-mono text-[9.5px] text-amber-900 font-black">{formatToman(inst.amount)}</span>
                              </div>
                              {inst.status !== 'paid' ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkInstallmentPaid(inst)}
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black cursor-pointer shrink-0"
                                >
                                  تسویه ✓
                                </button>
                              ) : (
                                <span className="text-[9px] font-black text-emerald-700 shrink-0">✓ پرداخت شد</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Pillar B: Sayad Checks */}
                      <div className="p-2 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between font-black text-purple-950">
                          <span>چک‌های صیادی ({toPersianDigits(sayadList.length)})</span>
                          <span className="text-[9px] text-purple-700">همگام با قسط</span>
                        </div>
                        {sayadList.length === 0 ? (
                          <span className="text-slate-400 block text-[9.5px]">بدون چک صیادی</span>
                        ) : (
                          sayadList.slice(0, 3).map(chk => (
                            <div key={chk.id} className="p-1.5 rounded-lg bg-white border border-purple-200/70 flex items-center justify-between gap-1">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">
                                  {chk.bankName} · {toPersianDigits(chk.dueDate)}
                                </span>
                                <span className="font-mono text-[9.5px] text-purple-900 font-black">{formatToman(chk.amount)}</span>
                              </div>
                              {chk.status !== 'cleared' ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkCheckCleared(chk)}
                                  className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black cursor-pointer shrink-0"
                                >
                                  وصول چک ✓
                                </button>
                              ) : (
                                <span className="text-[9px] font-black text-emerald-700 shrink-0">✓ پاس شد</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Pillar C: Guarantee Check & Smart Reminder */}
                      <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5 min-w-0 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between font-black text-emerald-950">
                            <span>ضمانت و یادآوری هوشمند</span>
                            <span className="text-[9px] text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded">فعال 🔔</span>
                          </div>
                          {guarList.length === 0 ? (
                            <span className="text-slate-400 block text-[9.5px]">بدون چک ضمانت امانی</span>
                          ) : (
                            guarList.map(gChk => (
                              <div key={gChk.id} className="p-1.5 rounded-lg bg-white border border-emerald-200/80 flex items-center justify-between gap-1">
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-900 block truncate">
                                    ضمانت {gChk.bankName} ({formatToman(gChk.amount)})
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono block truncate">
                                    صیاد: {toPersianDigits(gChk.sayadId)}
                                  </span>
                                </div>
                                {gChk.status !== 'returned' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleReturnGuaranteeCheck(gChk)}
                                    className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black cursor-pointer shrink-0"
                                  >
                                    عودت ✓
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-black text-emerald-700 shrink-0">✓ عودت شد</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void handleSendReminderSms(
                              pat.id,
                              pat.fullName,
                              'installment_due',
                              debt > 0 ? debt : (insts[0]?.amount || 0),
                              insts.find(i => i.status !== 'paid')?.dueDate || todayPersian,
                              'یادآوری یکپارچه اقساط و چک'
                            )
                          }
                          className="w-full py-1 px-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black text-[9.5px] flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                        >
                          <Send className="w-2.5 h-2.5 -scale-x-100" />
                          <span>ارسال پیامک یادآوری یکپارچه بیمار</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 0-A: CLINIC & MANAGER PATIENT DEBTORS LEDGER (۱۰۰٪ متعلق به مطب و مدیر) */}
        {activeSegment === 'debtors' && (
          <div className="space-y-2.5 text-right min-w-0">
            {/* D3.js Financial Liquidity & Receivables Distribution */}
            <div
              data-testid="financial-d3-overview-panel"
              className="w-full max-w-full min-w-0 p-2.5 rounded-[20px] bg-white border border-amber-200/80 shadow-[var(--shadow-card)] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>تراز مالی کلینیک بر حسب ستون‌ها (D3.js · میلیون تومان — کلیک جهت پرش)</span>
                </span>
                <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 tabular-nums">
                  مطالبات: {formatToman(clinicLedger.totalOutstandingPatientDebtToClinic)}
                </span>
              </div>
              <svg
                data-testid="financial-d3-overview-svg"
                viewBox={`0 0 ${d3FinancialOverview.width} ${d3FinancialOverview.height}`}
                className="w-full h-[98px] overflow-visible select-none"
                role="img"
                aria-label="نمودار تراز مالی ستون‌های کلینیک"
              >
                <line
                  x1={d3FinancialOverview.margin.left}
                  x2={d3FinancialOverview.width - d3FinancialOverview.margin.right}
                  y1={d3FinancialOverview.baselineY}
                  y2={d3FinancialOverview.baselineY}
                  stroke="#cbd5e1"
                  strokeWidth={1.2}
                />
                {d3FinancialOverview.bars.map(bar => (
                  <g
                    key={bar.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      setActiveSegment(bar.id);
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
                      opacity={0.9}
                    />
                    <text
                      x={bar.x + bar.barW / 2}
                      y={Math.max(10, bar.y - 3)}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={900}
                      fill="#0f172a"
                    >
                      {toPersianDigits(bar.valueM)}م
                    </text>
                    <text
                      x={bar.x + bar.barW / 2}
                      y={d3FinancialOverview.height - 6}
                      textAnchor="middle"
                      fontSize={8.5}
                      fontWeight={800}
                      fill="#475569"
                    >
                      {bar.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Accounting Separation Guarantee Banner + Batch Actions */}
            <div className="w-full max-w-full min-w-0 overflow-hidden p-3 rounded-[22px] bg-gradient-to-r from-rose-50 via-amber-50 to-white border border-rose-200/90 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                <span className="text-xs font-black text-rose-950 flex items-center gap-1.5 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">دفتر مطالبات و بدهی بیماران به مطب</span>
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleSendBatchDebtorSms()}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Send className="w-2.5 h-2.5 -scale-x-100 shrink-0" />
                    <span>پیامک گروهی بدهکاران</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDebtorsCsv}
                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-rose-50 text-rose-900 border border-rose-200 text-[10px] font-black cursor-pointer active:scale-95"
                  >
                    خروجی CSV مطالبات
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10.5px] min-w-0">
                <div className="p-2 rounded-xl bg-white border border-slate-200 min-w-0 overflow-hidden">
                  <span className="text-slate-500 block text-[9px] truncate">کل کارکرد ثبت‌شده مطب</span>
                  <span className="font-mono font-black text-slate-900 block mt-0.5 text-[10px] sm:text-[11px] truncate">
                    {formatToman(clinicLedger.totalRegisteredClinicWork)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 min-w-0 overflow-hidden">
                  <span className="text-emerald-800 block text-[9px] truncate">کل وصولی قطعی مطب</span>
                  <span className="font-mono font-black text-emerald-700 block mt-0.5 text-[10px] sm:text-[11px] truncate">
                    {formatToman(clinicLedger.totalRealizedClinicCashflow)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50/90 border border-rose-300 min-w-0 overflow-hidden">
                  <span className="text-rose-800 block text-[9px] truncate">مانده بدهی واقعی به مطب</span>
                  <span className="font-mono font-black text-rose-700 block mt-0.5 text-[10px] sm:text-[11px] truncate">
                    {formatToman(clinicLedger.totalOutstandingPatientDebtToClinic)}
                  </span>
                </div>
              </div>

              {/* Smart Debtor Status Triage Filter Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[10px] font-black min-w-0">
                {[
                  { id: 'all', label: `همه پرونده‌ها (${toPersianDigits(clinicLedger.debtorRecords.length)})` },
                  { id: 'active_debt', label: `بدهکاران فعال (${toPersianDigits(clinicLedger.debtorRecords.filter(d => d.exactRemainingDebtToClinic > 0).length)})` },
                  { id: 'has_check_or_inst', label: `دارای چک/قسط (${toPersianDigits(clinicLedger.debtorRecords.filter(d => d.totalPendingChecks > 0).length)})` },
                  { id: 'settled', label: `تسویه شده (${toPersianDigits(clinicLedger.debtorRecords.filter(d => d.exactRemainingDebtToClinic <= 0).length)})` }
                ].map(pill => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setDebtorStatusFilter(pill.id as any);
                    }}
                    className={`py-1 px-2 rounded-xl border transition-all cursor-pointer truncate ${
                      debtorStatusFilter === pill.id
                        ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-rose-200/80 hover:bg-rose-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Patient Debtors Cards (Compact Collapsible by Default + Fuzzy Search) */}
            {clinicLedger.debtorRecords
              .filter(d => {
                if (debtorStatusFilter === 'active_debt' && d.exactRemainingDebtToClinic <= 0) return false;
                if (debtorStatusFilter === 'has_check_or_inst' && d.totalPendingChecks <= 0) return false;
                if (debtorStatusFilter === 'settled' && d.exactRemainingDebtToClinic > 0) return false;
                if (!searchQuery.trim()) return true;
                return evaluateMultiFieldFuzzySearch(searchQuery, [
                  { value: d.patientName, label: 'نام بیمار' },
                  { value: d.fileNumber, label: 'شماره پرونده', maxTypos: 1 },
                  { value: d.phone, label: 'شماره تماس', maxTypos: 1 }
                ]).matched;
              })
              .map((debtor, debtorIdx) => {
                const matchedPat = patients.find(p => p.id === debtor.patientId);
                const isExpanded = expandedDebtorId === debtor.patientId;
                const isDebtor = debtor.exactRemainingDebtToClinic > 0;

                return (
                  <div
                    key={debtor.patientId}
                    className={`w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] p-2.5 sm:p-3.5 shadow-[var(--shadow-card)] border space-y-2 transition-all ${
                      isDebtor
                        ? 'border-rose-200/90 border-r-[3px] border-r-rose-500 hover:border-rose-300'
                        : 'border-emerald-200/90 border-r-[3px] border-r-emerald-500'
                    }`}
                  >
                    {/* Ultra-Compact Collapsible Header (Zero Collision between Name and Debt Amount) */}
                    <div
                      onClick={() => {
                        triggerHaptic('selection');
                        setExpandedDebtorId(prev => prev === debtor.patientId ? null : debtor.patientId);
                      }}
                      className="flex items-center justify-between gap-2 cursor-pointer select-none min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Numbered Wallet Visual Badge */}
                        <div className="relative shrink-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs ${
                            isDebtor ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}>
                            <Wallet className="w-4 h-4" />
                          </div>
                          <span className={`absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full text-white font-mono text-[9.5px] font-black flex items-center justify-center shadow-2xs ${
                            isDebtor ? 'bg-rose-700' : 'bg-emerald-700'
                          }`}>
                            {toPersianDigits(debtorIdx + 1)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-[13.5px] font-black text-slate-950 leading-tight truncate">{debtor.patientName}</h4>
                            <span className="text-[10px] font-mono font-black bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-0.2 rounded-md shrink-0">
                              {toPersianDigits(debtor.fileNumber)}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-slate-500 mt-0.5 block font-bold truncate">
                            {debtor.treatmentsSummary.length > 0 ? debtor.treatmentsSummary.join(' ، ') : 'معاینه و تشکیل پرونده'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10.5px] sm:text-xs font-mono font-black px-2 py-1 rounded-xl border whitespace-nowrap tabular-nums ${
                            isDebtor
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isDebtor
                            ? formatExactMicroToman(debtor.exactRemainingDebtToClinic, false)
                            : 'تسویه ✓'}
                        </span>

                        <div
                          className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border ${
                            isExpanded
                              ? 'bg-amber-500 text-slate-950 border-amber-600'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Financial & Clinical Details */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-bold text-slate-600 px-1 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>شماره تماس بیمار: <strong className="font-mono text-slate-900 tabular-nums" dir="ltr">{toPersianDigits(debtor.phone)}</strong></span>
                            <a
                              href={`tel:${debtor.phone}`}
                              onClick={() => triggerHaptic('light')}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black flex items-center gap-1 shadow-2xs"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>تماس مستقیم</span>
                            </a>
                            <a
                              href={`sms:${debtor.phone}?body=${encodeURIComponent(`سلام ${debtor.patientName} عزیز، مانده حساب درمانی شما در کلینیک مینادنتال مبلغ ${formatToman(debtor.exactRemainingDebtToClinic)} می‌باشد.`)}`}
                              onClick={() => triggerHaptic('light')}
                              className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[9.5px] font-black flex items-center gap-1 shadow-2xs"
                            >
                              <MessageSquare className="w-2.5 h-2.5" />
                              <span>پیامک گوشی</span>
                            </a>
                          </div>
                          <span className={isDebtor ? 'text-rose-700 font-black tabular-nums' : 'text-emerald-700 font-black'}>
                            {isDebtor ? `مانده بدهی قطعی: ${formatExactMicroToman(debtor.exactRemainingDebtToClinic, true)}` : 'حساب تسویه کامل'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[10px] text-center min-w-0">
                          <div className="min-w-0 overflow-hidden">
                            <span className="text-slate-400 block text-[9px] truncate">کل کارکرد درمان</span>
                            <span className="font-mono font-bold text-slate-800 block truncate">
                              {formatToman(debtor.totalRegisteredTreatmentsCost)}
                            </span>
                          </div>
                          <div className="min-w-0 overflow-hidden">
                            <span className="text-slate-400 block text-[9px] truncate">پرداختی نقد/POS</span>
                            <span className="font-mono font-bold text-emerald-700 block truncate">
                              {formatToman(debtor.totalCashAndPosPaid)}
                            </span>
                          </div>
                          <div className="min-w-0 overflow-hidden">
                            <span className="text-slate-400 block text-[9px] truncate">چک در جریان وصول</span>
                            <span className="font-mono font-bold text-purple-700 block truncate">
                              {formatToman(debtor.totalPendingChecks)}
                            </span>
                          </div>
                        </div>

                        {/* Unified 4-Pillar Cross-Link Strip: اقساط · چک صیادی · چک ضمانت · یادآوری */}
                        {matchedPat && (() => {
                          const patInsts = matchedPat.installments || [];
                          const openInstCount = patInsts.filter(i => i.status !== 'paid').length;
                          const patSayad = (matchedPat.sayadChecks || []).filter(c => !c.isGuarantee);
                          const patGuarantee = (matchedPat.sayadChecks || []).filter(c => c.isGuarantee);
                          const activeGuarantee = patGuarantee.find(c => c.status !== 'returned');
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9.5px] font-black min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('selection');
                                  setSearchQuery(matchedPat.fullName);
                                  setActiveSegment('installments');
                                }}
                                className="p-1.5 rounded-xl bg-amber-50/90 hover:bg-amber-100 text-amber-950 border border-amber-200 flex items-center justify-between gap-1 cursor-pointer truncate"
                              >
                                <span>اقساط باز:</span>
                                <span className="font-mono">{toPersianDigits(openInstCount)}/{toPersianDigits(patInsts.length)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('selection');
                                  setSearchQuery(matchedPat.fullName);
                                  setActiveSegment('sayad');
                                }}
                                className="p-1.5 rounded-xl bg-purple-50/90 hover:bg-purple-100 text-purple-950 border border-purple-200 flex items-center justify-between gap-1 cursor-pointer truncate"
                              >
                                <span>چک صیادی:</span>
                                <span className="font-mono">{toPersianDigits(patSayad.length)} فقره</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('selection');
                                  setSearchQuery(matchedPat.fullName);
                                  setActiveSegment('guarantee');
                                }}
                                className={`p-1.5 rounded-xl border flex items-center justify-between gap-1 cursor-pointer truncate ${
                                  activeGuarantee
                                    ? debtor.exactRemainingDebtToClinic <= 0
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      : 'bg-orange-50 text-orange-950 border-orange-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                <span>چک ضمانت:</span>
                                <span>{activeGuarantee ? (debtor.exactRemainingDebtToClinic <= 0 ? 'آماده عودت ✓' : 'امانی فعال') : 'ندارد'}</span>
                              </button>
                              <div className="p-1.5 rounded-xl bg-sky-50/90 text-sky-950 border border-sky-200 flex items-center justify-between gap-1 truncate">
                                <span>یادآوری:</span>
                                <span>هوشمند فعال 🔔</span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                          {debtor.exactRemainingDebtToClinic > 0 ? (
                            <button
                              type="button"
                              onClick={async () => {
                                triggerHaptic('medium');
                                await clinicalSmsService.sendPatternSms(
                                  debtor.phone,
                                  debtor.patientName,
                                  'installment_due',
                                  {
                                    amount: formatToman(debtor.exactRemainingDebtToClinic),
                                    dueDate: getCurrentPersianDate()
                                  }
                                );
                                actionFeedback.recordSuccess({
                                  title: `پیامک یادآوری بدهی مطب برای «${debtor.patientName}» ارسال شد`,
                                  subtitle: `مبلغ بدهی به مطب: ${formatToman(debtor.exactRemainingDebtToClinic)}`,
                                  targetRecordId: debtor.patientId,
                                  badgeText: '✓ پیامک یادآوری بدهی ارسال شد',
                                  canUndo: false
                                });
                              }}
                              className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Send className="w-3 h-3 -scale-x-100" />
                              <span>ارسال پیامک یادآوری بدهی</span>
                            </button>
                          ) : (
                            <span className="py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>حساب مالی تسویه کامل است</span>
                            </span>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {matchedPat && onOpenInvoice && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  onOpenInvoice(matchedPat);
                                }}
                                className="py-1 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                                title="چاپ فاکتور رسمی بیمار"
                              >
                                <Printer className="w-3 h-3 text-sky-600" />
                                <span>فاکتور</span>
                              </button>
                            )}
                            {matchedPat && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('medium');
                                  setSelectedInstallmentPatientId(matchedPat.id);
                                  setShowInstallmentModal(true);
                                }}
                                className="py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                              >
                                <Calculator className="w-3 h-3 text-amber-600" />
                                <span>تقسیط و ضمانت</span>
                              </button>
                            )}
                            {matchedPat && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('medium');
                                  onOpenCheckModal(matchedPat.id);
                                }}
                                className="py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <FileCheck2 className="w-3 h-3 text-purple-600" />
                                <span>ثبت چک</span>
                              </button>
                            )}
                            {matchedPat && (
                              <button
                                type="button"
                                onClick={() => onOpenPatientFile(matchedPat)}
                                className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold cursor-pointer"
                              >
                                پرونده مالی
                              </button>
                            )}
                            {debtor.exactRemainingDebtToClinic > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('heavy');
                                  onOpenPaymentModal?.(matchedPat?.id);
                                }}
                                className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black cursor-pointer active:scale-95"
                              >
                                وصول به حساب مطب
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Itemized Clinical & Financial Breakdown */}
                        {matchedPat && (
                          <div className="space-y-2 min-w-0">
                            <div className="bg-slate-50/90 rounded-2xl p-2.5 border border-slate-200/80 space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-black text-slate-800 pb-1 border-b border-slate-200/70">
                                <span className="flex items-center gap-1 min-w-0">
                                  <Stethoscope className="w-3 h-3 text-teal-600 shrink-0" />
                                  <span className="truncate">ریز خدمات درمانی، شماره دندان پالمر و پزشک معالج:</span>
                                </span>
                                <span className="text-slate-500 font-mono shrink-0">
                                  {toPersianDigits(Object.keys(matchedPat.teethConditions || {}).length)} ردیف ثبت‌شده
                                </span>
                              </div>

                              {Object.entries(matchedPat.teethConditions || {}).length === 0 ? (
                                <div className="text-[10px] text-slate-500 py-1">
                                  {debtor.treatmentsSummary.join(' ، ') || 'معاینه تخصصی و تشکیل پرونده'} — پزشک: دکتر مهدی امیری
                                </div>
                              ) : (
                                Object.entries(matchedPat.teethConditions || {}).map(([tKey, cond]) => (
                                  <div
                                    key={tKey}
                                    className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 rounded-xl bg-white border border-slate-200/80 text-[10px] min-w-0"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 font-mono font-black text-[9.5px] shrink-0" dir="ltr">
                                        {cond.quadrant}{toPersianDigits(cond.toothNumber)}
                                      </span>
                                      <span className="font-black text-slate-900">{getPersianTreatmentName(cond.treatment)}</span>
                                      <span className="text-slate-500 font-bold">({cond.doctorName || 'دکتر مهدی امیری'})</span>
                                      {cond.date && (
                                        <span className="text-[9px] font-mono text-slate-400">· {toPersianDigits(cond.date)}</span>
                                      )}
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                        cond.status === 'completed'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : cond.status === 'planned'
                                            ? 'bg-sky-50 text-sky-700'
                                            : 'bg-amber-50 text-amber-800'
                                      }`}>
                                        {cond.status === 'completed' ? 'تکمیل' : cond.status === 'planned' ? 'طرح درمان' : 'جاری'}
                                      </span>
                                    </div>
                                    <div className="text-left shrink-0 font-mono font-black text-slate-900">
                                      {formatToman(cond.cost || 0)}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Payments & Checks Summary Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] min-w-0">
                              <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 min-w-0 overflow-hidden">
                                <span className="font-black text-emerald-900 block mb-1">
                                  پرداخت‌های ثبت‌شده ({toPersianDigits((matchedPat.payments || []).length)}):
                                </span>
                                {(matchedPat.payments || []).slice(0, 2).map(pm => (
                                  <div key={pm.id} className="flex items-center justify-between font-mono text-[9.5px] text-emerald-800 gap-1">
                                    <span className="truncate">{toPersianDigits(pm.date)}</span>
                                    <span className="font-bold shrink-0">+{formatToman(pm.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="p-2 rounded-xl bg-purple-50/70 border border-purple-200/80 min-w-0 overflow-hidden">
                                <span className="font-black text-purple-900 block mb-1">
                                  چک‌ها و اقساط ({toPersianDigits((matchedPat.sayadChecks || []).length + (matchedPat.installments || []).length)}):
                                </span>
                                {(matchedPat.sayadChecks || []).slice(0, 2).map(ck => (
                                  <div key={ck.id} className="flex items-center justify-between font-mono text-[9.5px] text-purple-800 gap-1">
                                    <span className="truncate">چک {ck.bankName}</span>
                                    <span className="font-bold shrink-0">{formatToman(ck.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 0-B: DOCTOR WORK-ONLY COMMISSIONS (۱۰۰٪ مستقل از پرداخت یا بدهی بیمار) */}
        {activeSegment === 'commissions' && (
          <div className="space-y-2.5 text-right min-w-0">
            <div className="w-full max-w-full min-w-0 overflow-hidden p-3 rounded-[22px] bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-300 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 min-w-0">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">دفتر سهم پزشکان از کارکرد ثبت‌شده</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenCommissionModal?.()}
                  className="py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black cursor-pointer active:scale-95"
                >
                  تنظیم فرمول و درصدها
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-1.5 rounded-xl bg-white border border-emerald-200/80 min-w-0 overflow-hidden">
                  <span className="text-slate-500 block text-[9px] truncate">مجموع کارکرد پزشکان</span>
                  <span className="font-mono font-black text-slate-900 block truncate">
                    {formatToman(doctorsWorkSummary.reduce((s, d) => s + d.totalRegisteredGrossWork, 0))}
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-rose-50/70 border border-rose-200/80 min-w-0 overflow-hidden">
                  <span className="text-rose-800 block text-[9px] truncate">کل کسر لابراتوار</span>
                  <span className="font-mono font-black text-rose-700 block truncate">
                    {formatToman(doctorsWorkSummary.reduce((s, d) => s + d.totalAssignedLabDeductions, 0))}
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-emerald-100/70 border border-emerald-300 min-w-0 overflow-hidden">
                  <span className="text-emerald-900 block text-[9px] truncate">جمع سهم قابل پرداخت</span>
                  <span className="font-mono font-black text-emerald-800 block truncate">
                    {formatToman(doctorsWorkSummary.reduce((s, d) => s + d.exactDoctorPayable, 0))}
                  </span>
                </div>
              </div>
            </div>

            {doctorsWorkSummary.map((doc, docIdx) => {
              const isBreakdownOpen = !!expandedDoctorBreakdown[doc.doctorId];
              return (
                <div
                  key={doc.doctorId}
                  className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] p-3 sm:p-3.5 shadow-[var(--shadow-card)] border border-emerald-200/90 border-r-[3px] border-r-emerald-500 space-y-2.5"
                >
                  {/* Row 1: Doctor Identity */}
                  <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black text-xs">
                          <Award className="w-4 h-4 text-emerald-700" />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-emerald-700 text-white font-mono text-[9.5px] font-black flex items-center justify-center">
                          {toPersianDigits(docIdx + 1)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-950 truncate">{doc.doctorName}</h4>
                          {doc.isManager && (
                            <span className="text-[9.5px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shrink-0">
                              مدیر کلینیک
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5 truncate">{doc.specialty}</span>
                      </div>
                    </div>
                    <TrackableIdBadge recordId={doc.doctorId} moduleKey="doctor_commission" variant="emerald" />
                  </div>

                  {/* Interactive 3-Model Commission Switcher per Doctor */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-[9.5px] font-black min-w-0">
                    {[
                      { id: 'lab_split_half', label: '(کارکرد − لابراتوار) ÷ ۲' },
                      { id: 'fixed_wage', label: 'دستمزد ثابت درمان' },
                      { id: 'percentage', label: doc.isManager ? 'سهم مدیر (۱۰۰٪)' : `درصدی (${toPersianDigits(doc.percentageRate)}٪)` }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleQuickSwitchDoctorModel(doc.doctorId, m.id as any)}
                        className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer truncate ${
                          doc.model === m.id
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-white/80'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Row 2: Dedicated Highlighted Net Payable Box */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-2 flex-wrap min-w-0">
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-900 font-black block">سهم خالص قابل پرداخت پزشک:</span>
                      <span className="text-[9.5px] font-mono text-emerald-700 block truncate">
                        فرمول: {toPersianDigits(doc.calculationAuditFormula)}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs shrink-0">
                      {formatExactMicroToman(doc.exactDoctorPayable, true)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[10px] text-center min-w-0">
                    <div className="min-w-0 overflow-hidden">
                      <span className="text-slate-400 block text-[9px] truncate">کارکرد درمانی ثبت‌شده</span>
                      <span className="font-mono font-bold text-slate-900 block truncate">
                        {formatToman(doc.totalRegisteredGrossWork)}
                      </span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="text-slate-400 block text-[9px] truncate">کسر هزینه لابراتوار</span>
                      <span className="font-mono font-bold text-rose-700 block truncate">
                        − {formatToman(doc.totalAssignedLabDeductions)}
                      </span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <span className="text-slate-400 block text-[9px] truncate">سهم مطب از این کارکرد</span>
                      <span className="font-mono font-bold text-sky-800 block truncate">
                        {formatToman(doc.exactClinicRetainedShare)}
                      </span>
                    </div>
                  </div>

                  {/* Printable Monthly Doctor Commission Settlement Slip Action + Procedure Breakdown Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setExpandedDoctorBreakdown(prev => ({ ...prev, [doc.doctorId]: !prev[doc.doctorId] }));
                      }}
                      className="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <span>ریز کارکرد ({toPersianDigits(doc.treatmentsCount)} درمان)</span>
                      {isBreakdownOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        setSelectedDoctorSlip(doc);
                      }}
                      className="py-1 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10.5px] font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>چاپ فیش تسویه حساب پزشک</span>
                    </button>
                  </div>

                  {isBreakdownOpen && (
                    <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[10px] animate-in fade-in duration-150">
                      <div className="flex items-center justify-between font-black text-slate-700 pb-1 border-b border-slate-200">
                        <span>شرح محاسبه و تفکیک کارکرد پزشک</span>
                        <span className="font-mono text-emerald-700">{toPersianDigits(doc.treatmentsCount)} خدمت ثبت‌شده</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>خالص کارکرد پس از کسر لابراتوار:</span>
                        <span className="font-mono font-bold text-slate-900">{formatToman(doc.netCommissionableBase)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>نرخ دستمزد ثابت هر درمان:</span>
                        <span className="font-mono font-bold text-slate-900">{formatToman(doc.fixedWagePerTreatment)}</span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-800 font-black pt-1 border-t border-slate-200/60">
                        <span>سهم نهایی پزشک (طبق مدل انتخابی بالا):</span>
                        <span className="font-mono">{formatExactMicroToman(doc.exactDoctorPayable, true)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 1: SAYAD CHECKS */}
        {activeSegment === 'sayad' && (
          <div className="space-y-2 min-w-0">
            {/* Real Tiered Maturity Alert Banner & Interactive Filter Chips */}
            <div className="w-full max-w-full min-w-0 overflow-hidden p-3 rounded-[20px] bg-gradient-to-l from-purple-50 via-amber-50/70 to-rose-50/70 border border-purple-200/90 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5 min-w-0">
                <span className="text-[11px] font-black text-purple-950 flex items-center gap-1.5 min-w-0 flex-wrap">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>پایش واقعی سررسید چک‌های صیادی و اقساط</span>
                  {sayadMaturityFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSayadMaturityFilter('all')}
                      className="text-[9.5px] px-2 py-0.5 rounded-full bg-purple-200 text-purple-950 font-black cursor-pointer"
                    >
                      نمایش همه ✕
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSendBatchCheckSms()}
                  className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                >
                  <Send className="w-3 h-3 -scale-x-100 shrink-0" />
                  <span>ارسال پیامک گروهی سررسید</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[9.5px] font-black min-w-0">
                <button
                  type="button"
                  onClick={() => { triggerHaptic('selection'); setSayadMaturityFilter(prev => prev === '7d' ? 'all' : '7d'); }}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer truncate ${
                    sayadMaturityFilter === '7d' ? 'bg-sky-600 text-white border-sky-700 shadow-xs' : 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
                  }`}
                >
                  ۷ روز آینده: {toPersianDigits(sayadTierCounts['7d'])} فقره
                </button>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('selection'); setSayadMaturityFilter(prev => prev === '3d' ? 'all' : '3d'); }}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer truncate ${
                    sayadMaturityFilter === '3d' ? 'bg-amber-600 text-white border-amber-700 shadow-xs' : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  ۳ روز آینده: {toPersianDigits(sayadTierCounts['3d'])} فقره
                </button>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('selection'); setSayadMaturityFilter(prev => prev === 'today' ? 'all' : 'today'); }}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer truncate ${
                    sayadMaturityFilter === 'today' ? 'bg-orange-600 text-white border-orange-700 shadow-xs' : 'bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  سررسید امروز: {toPersianDigits(sayadTierCounts.today)} فقره
                </button>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('selection'); setSayadMaturityFilter(prev => prev === 'overdue' ? 'all' : 'overdue'); }}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer truncate ${
                    sayadMaturityFilter === 'overdue' ? 'bg-rose-600 text-white border-rose-700 shadow-xs' : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  معوق/برگشتی: {toPersianDigits(sayadTierCounts.overdue)} فقره
                </button>
              </div>
            </div>

            {/* D3.js Interactive Sayad Check Maturity Distribution */}
            <div
              data-testid="financial-d3-sayad-panel"
              className="w-full max-w-full min-w-0 p-2.5 rounded-[20px] bg-white border border-purple-200/80 shadow-[var(--shadow-card)] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-black text-purple-950 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                  <span>توزیع سررسید چک‌های صیادی (D3.js · میلیون تومان — کلیک جهت فیلتر)</span>
                </span>
                <span className="text-[10px] font-mono font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 tabular-nums">
                  {toPersianDigits(visibleSayadChecks.length)} فقره نمایش‌داده‌شده
                </span>
              </div>
              <svg
                data-testid="financial-d3-sayad-svg"
                viewBox={`0 0 ${d3SayadMaturity.width} ${d3SayadMaturity.height}`}
                className="w-full h-[100px] overflow-visible select-none"
                role="img"
                aria-label="نمودار سررسید چک‌های صیادی کلینیک"
              >
                <line
                  x1={d3SayadMaturity.margin.left}
                  x2={d3SayadMaturity.width - d3SayadMaturity.margin.right}
                  y1={d3SayadMaturity.baselineY}
                  y2={d3SayadMaturity.baselineY}
                  stroke="#cbd5e1"
                  strokeWidth={1.2}
                />
                {d3SayadMaturity.bars.map(bar => {
                  const isActive = sayadMaturityFilter === bar.filterKey && bar.filterKey !== 'all';
                  return (
                    <g
                      key={bar.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSayadMaturityFilter(prev => prev === bar.filterKey ? 'all' : bar.filterKey);
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
                        opacity={sayadMaturityFilter === 'all' || isActive ? 0.9 : 0.35}
                        stroke={isActive ? '#0f172a' : 'none'}
                        strokeWidth={isActive ? 1.5 : 0}
                      />
                      <text
                        x={bar.x + bar.barW / 2}
                        y={Math.max(10, bar.y - 3)}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontWeight={900}
                        fill="#0f172a"
                      >
                        {toPersianDigits(bar.amountM)}م ({toPersianDigits(bar.count)})
                      </text>
                      <text
                        x={bar.x + bar.barW / 2}
                        y={d3SayadMaturity.height - 6}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontWeight={isActive ? 900 : 700}
                        fill={isActive ? '#6b21a8' : '#475569'}
                      >
                        {bar.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
              <span className="text-[12px] sm:text-[12.5px] font-extrabold text-slate-800">چک‌های صیادی بنفش ثبت‌شده ({toPersianDigits(visibleSayadChecks.length)})</span>
              <div className="flex items-center gap-1.5">
                {visibleSayadChecks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      const anyOpen = visibleSayadChecks.some(c => expandedRecords[c.id]);
                      if (anyOpen) {
                        setExpandedRecords({});
                      } else {
                        const next: Record<string, boolean> = {};
                        visibleSayadChecks.forEach(c => { next[c.id] = true; });
                        setExpandedRecords(next);
                      }
                    }}
                    className="px-2.5 py-0.5 rounded-xl bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-black cursor-pointer"
                  >
                    {visibleSayadChecks.some(c => expandedRecords[c.id]) ? 'جمع کردن همه' : 'باز کردن همه'}
                  </button>
                )}
                <span className="text-[10px] text-purple-800 font-bold bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">متصل به پیچک</span>
              </div>
            </div>

            {visibleSayadChecks.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 text-slate-400 text-xs">
                چک صیادی منطبق با فیلتر انتخاب‌شده وجود ندارد.
              </div>
            ) : (
              visibleSayadChecks.map((check, idx) => {
                const isExpanded = !!expandedRecords[check.id];
                const bucket = getCheckMaturityBucket(check);
                return (
                  <div
                    key={check.id}
                    className={`w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] px-3 py-2.5 shadow-[var(--shadow-card)] border border-r-[3px] transition-all space-y-2 ${
                      check.status === 'cleared'
                        ? 'border-emerald-200/90 border-r-emerald-500'
                        : check.status === 'bounced' || bucket === 'overdue'
                          ? 'border-rose-200/90 border-r-rose-500'
                          : 'border-purple-200/90 border-r-purple-600 hover:border-purple-300'
                    }`}
                  >
                    <div
                      onClick={() => toggleRecordExpand(check.id)}
                      className="flex items-center justify-between gap-2 cursor-pointer select-none min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 border border-purple-200 flex items-center justify-center">
                            <FileCheck2 className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-700 text-white text-[9.5px] font-mono font-black flex items-center justify-center border border-white">
                            #{toPersianDigits(idx + 1)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-[13px] font-black text-slate-900 truncate">{check.patientName}</h4>
                            <span className="text-[10px] font-mono bg-purple-50 text-purple-800 border border-purple-200/80 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                              {check.bankName}
                            </span>
                            <TrackableIdBadge recordId={check.id} moduleKey="financial_check" variant="purple" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 mt-0.5 block truncate">
                            سررسید: {toPersianDigits(check.dueDate)} · صیاد: {toPersianDigits(check.sayadId)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-left bg-purple-50/90 border border-purple-200 px-2 py-1 rounded-xl">
                          <span className="text-[11.5px] font-black text-purple-950 font-mono block leading-none">
                            {formatToman(check.amount)}
                          </span>
                        </div>
                        <div className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border transition-colors ${
                          isExpanded ? 'bg-purple-600 text-white border-purple-700' : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}>
                          <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Actions & Verification */}
                    {isExpanded && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 animate-in fade-in duration-150">
                        <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${
                          check.status === 'cleared' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          check.status === 'bounced' ? 'bg-red-50 text-red-800 border-red-200' :
                          bucket === 'overdue' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                          'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {check.status === 'cleared' ? 'وصول شده ✓' :
                           check.status === 'bounced' ? 'برگشت خورده ⚠️' :
                           bucket === 'overdue' ? 'سررسید گذشته (معوق)' : 'در جریان وصول'}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button type="button"
                            onClick={() => void handleSendReminderSms(check.patientId, check.patientName, 'sayad_check_due', check.amount, check.dueDate, 'سررسید چک صیادی')}
                            className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold flex items-center gap-1 border border-slate-200/80 cursor-pointer active:scale-95 transition-all"
                          >
                            <Send className="w-3 h-3 -scale-x-100" />
                            <span>پیامک سررسید</span>
                          </button>

                          {check.status !== 'cleared' && (
                            <button type="button"
                              onClick={() => handleMarkCheckCleared(check)}
                              className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>ثبت وصول چک</span>
                            </button>
                          )}

                          {check.status !== 'bounced' && (
                            <button type="button"
                              onClick={() => handleMarkCheckBounced(check)}
                              className="py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                            >
                              <AlertOctagon className="w-3 h-3" />
                              <span>برگشت چک</span>
                            </button>
                          )}

                          <button type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              setEditingCheck(check);
                              setEditCheckBank(check.bankName);
                              setEditCheckSayadId(check.sayadId);
                              setEditCheckAmount(check.amount);
                              setEditCheckDueDate(check.dueDate);
                              setConfirmDeleteCheckId(null);
                              setManagerPinError(false);
                            }}
                            className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10.5px] font-bold flex items-center gap-1 border border-amber-200/80 cursor-pointer active:scale-95 transition-all"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ویرایش</span>
                          </button>

                          <button type="button"
                            onClick={() => handleRunSayadInquiry(check)}
                            className="py-1 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>استعلام پیچک</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: GUARANTEE CHECKS (یکپارچه با وضعیت تسویه اقساط و بدهی بیمار) */}
        {activeSegment === 'guarantee' && (
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
              <span className="text-xs font-black text-slate-800">چک‌های امانی و ضمانت درمان ({toPersianDigits(guaranteeChecks.length)})</span>
              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">متصل به وضعیت تسویه اقساط</span>
            </div>

            {guaranteeChecks.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
                چک ضمانتی در سیستم ثبت نشده است.
              </div>
            ) : (
              guaranteeChecks.map((check, idx) => {
                const isExpanded = !!expandedRecords[check.id];
                const guarPat = patients.find(p => p.id === check.patientId || p.fullName === check.patientName);
                const guarInsts = guarPat?.installments || [];
                const paidInstCount = guarInsts.filter(i => i.status === 'paid').length;
                const guarDebt = guarPat ? Math.max(0, (guarPat.totalCost || 0) - (guarPat.paidAmount || 0)) : 0;
                const isReadyForReturn = check.status !== 'returned' && guarDebt <= 0 && (guarInsts.length === 0 || paidInstCount === guarInsts.length);

                return (
                  <div
                    key={check.id}
                    className={`w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] px-3 py-2.5 shadow-[var(--shadow-card)] border border-r-[3px] space-y-2 transition-all ${
                      check.status === 'returned' || isReadyForReturn
                        ? 'border-emerald-200/90 border-r-emerald-500'
                        : 'border-amber-200/90 border-r-amber-500'
                    }`}
                  >
                    <div
                      onClick={() => toggleRecordExpand(check.id)}
                      className="flex items-center justify-between gap-2 cursor-pointer select-none min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                          </div>
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[9.5px] font-mono font-black flex items-center justify-center border border-white">
                            #{toPersianDigits(idx + 1)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-[13px] font-black text-slate-900 truncate">{check.patientName}</h4>
                            <TrackableIdBadge recordId={check.id} moduleKey="financial_check" />
                            {isReadyForReturn && (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                آماده عودت به بیمار ✓
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] text-slate-500 font-mono mt-0.5 block truncate">
                            بانک: {check.bankName} · شناسه: {toPersianDigits(check.sayadId)} · اقساط: {toPersianDigits(paidInstCount)}/{toPersianDigits(guarInsts.length)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-left bg-amber-50 border border-amber-200 px-2 py-1 rounded-xl">
                          <span className="text-[11.5px] font-black text-amber-800 font-mono block leading-none">
                            {formatToman(check.amount)}
                          </span>
                        </div>
                        <div className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border transition-colors ${
                          isExpanded ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 text-[10px] animate-in fade-in duration-150">
                        <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div>
                            <span className="text-slate-400 block text-[9px]">وضعیت اقساط متصل:</span>
                            <span className="font-black text-slate-800">
                              {guarInsts.length > 0
                                ? `${toPersianDigits(paidInstCount)} از ${toPersianDigits(guarInsts.length)} قسط تسویه شده`
                                : 'بدون قسط باز'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">مانده بدهی فعلی بیمار:</span>
                            <span className={`font-mono font-black ${guarDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {guarDebt > 0 ? formatToman(guarDebt) : '۰ تومان (تسویه کامل ✓)'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className={check.status === 'returned' ? 'text-emerald-700 font-extrabold' : isReadyForReturn ? 'text-emerald-800 font-black' : 'text-slate-500'}>
                            {check.status === 'returned'
                              ? '✓ عودت داده شده به بیمار پس از تسویه'
                              : isReadyForReturn
                                ? '✓ تمامی تعهدات تسویه شده — آماده تحویل چک ضمانت به بیمار'
                                : 'وضعیت: امانت نزد کلینیک تا تسویه کامل اقساط'}
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => void handleSendReminderSms(check.patientId, check.patientName, 'sayad_check_due', check.amount, check.dueDate, 'وضعیت چک ضمانت')}
                              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Send className="w-3 h-3 -scale-x-100" />
                              <span>پیامک وضعیت ضمانت</span>
                            </button>

                            <button type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                setEditingCheck(check);
                                setEditCheckBank(check.bankName);
                                setEditCheckSayadId(check.sayadId);
                                setEditCheckAmount(check.amount);
                                setEditCheckDueDate(check.dueDate);
                              }}
                              className="py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>ویرایش</span>
                            </button>

                            {check.status !== 'returned' ? (
                              <button type="button"
                                onClick={() => handleReturnGuaranteeCheck(check)}
                                className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer active:scale-95 transition-all"
                              >
                                عودت به بیمار
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-black">
                                تحویل بیمار شد
                              </span>
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

        {/* TAB 3: TREATMENT INSTALLMENTS */}
        {activeSegment === 'installments' && (
          <div className="space-y-2 min-w-0">
            <div className="w-full max-w-full min-w-0 overflow-hidden p-3 rounded-[20px] bg-gradient-to-l from-amber-50 via-white to-emerald-50/40 border border-amber-200/90 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-black text-slate-800">برنامه اقساط درمانی ({toPersianDigits(allInstallments.length)})</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleSendBatchInstallmentSms()}
                    className="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-[10px] flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Send className="w-3 h-3 -scale-x-100 shrink-0" />
                    <span>پیامک سررسید اقساط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setShowInstallmentModal(true);
                    }}
                    className="py-1 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                    <span>قسط‌بندی جدید (ماشین‌حساب)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9.5px] font-black min-w-0">
                {[
                  { id: 'all', label: `همه اقساط (${toPersianDigits(allInstallments.length)})` },
                  { id: 'overdue', label: `معوق (${toPersianDigits(allInstallments.filter(i => i.status !== 'paid' && diffPersianDays(todayPersian, i.dueDate) < 0).length)})` },
                  { id: 'pending', label: `در انتظار (${toPersianDigits(allInstallments.filter(i => i.status !== 'paid').length)})` },
                  { id: 'paid', label: `تسویه شده (${toPersianDigits(allInstallments.filter(i => i.status === 'paid').length)})` }
                ].map(pill => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setInstallmentStatusFilter(pill.id as any);
                    }}
                    className={`py-1 px-2 rounded-xl border transition-all cursor-pointer truncate ${
                      installmentStatusFilter === pill.id
                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-amber-200/80 hover:bg-amber-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {allInstallments.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
                طرح اقساطی برای بیماران تعریف نشده است.
              </div>
            ) : (
              allInstallments
                .filter(inst => {
                  if (installmentStatusFilter === 'paid') return inst.status === 'paid';
                  if (installmentStatusFilter === 'pending') return inst.status !== 'paid';
                  if (installmentStatusFilter === 'overdue') {
                    return inst.status !== 'paid' && diffPersianDays(todayPersian, inst.dueDate) < 0;
                  }
                  return true;
                })
                .map((inst, idx) => {
                  const isExpanded = !!expandedRecords[inst.id];
                  const isPaid = inst.status === 'paid';
                  return (
                    <div
                      key={inst.id}
                      className={`w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] px-3 py-2.5 shadow-[var(--shadow-card)] border border-r-[3px] transition-all space-y-2 ${
                        isPaid
                          ? 'border-emerald-200/90 border-r-emerald-500'
                          : 'border-amber-200/90 border-r-amber-500 hover:border-amber-300'
                      }`}
                    >
                      <div
                        onClick={() => toggleRecordExpand(inst.id)}
                        className="flex items-center justify-between gap-2 cursor-pointer select-none min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono font-black text-xs ${
                              isPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-900 border-amber-200'
                            }`}>
                              {toPersianDigits(inst.installmentNumber)}/{toPersianDigits(inst.totalInstallments)}
                            </div>
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[9.5px] font-mono font-black flex items-center justify-center border border-white">
                              #{toPersianDigits(idx + 1)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 text-right">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-[13px] font-black text-slate-900 truncate">{inst.patientName}</h4>
                              <span className="text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                                قسط {toPersianDigits(inst.installmentNumber)} از {toPersianDigits(inst.totalInstallments)}
                              </span>
                              <TrackableIdBadge recordId={inst.id} moduleKey="financial_installment" variant="light" />
                            </div>
                            <span className="text-[10.5px] text-slate-500 font-mono mt-0.5 block truncate">
                              سررسید: {toPersianDigits(inst.dueDate)} · {isPaid ? 'تسویه شده ✓' : 'در انتظار پرداخت'}
                            </span>
                            {(() => {
                              const instPat = patients.find(p => p.id === inst.patientId || p.fullName === inst.patientName);
                              const linkedSayad = (instPat?.sayadChecks || []).find(
                                c => !c.isGuarantee && (c.dueDate === inst.dueDate || (c.description || '').includes(`قسط شماره ${toPersianDigits(inst.installmentNumber)}`))
                              );
                              const activeGuar = (instPat?.sayadChecks || []).find(c => c.isGuarantee && c.status !== 'returned');
                              return (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {linkedSayad && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                                      چک صیاد: {linkedSayad.bankName} ({toPersianDigits(linkedSayad.sayadId.slice(-4))})
                                    </span>
                                  )}
                                  {activeGuar && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                      تحت پوشش چک ضمانت ✓
                                    </span>
                                  )}
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                                    یادآوری فعال 🔔
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={`text-left px-2 py-1 rounded-xl border ${
                            isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-950'
                          }`}>
                            <span className="text-[11.5px] font-black font-mono block leading-none">
                              {formatToman(inst.amount)}
                            </span>
                          </div>
                          <div className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border transition-colors ${
                            isExpanded ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap animate-in fade-in duration-150">
                          <button type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              setEditingInstallment(inst);
                              setEditInstAmount(inst.amount);
                              setEditInstDueDate(inst.dueDate);
                              setManagerPinError(false);
                            }}
                            className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تمدید / ویرایش قسط</span>
                          </button>

                          <button type="button"
                            onClick={() => void handleSendReminderSms(inst.patientId, inst.patientName, 'installment_due', inst.amount, inst.dueDate, 'سررسید قسط')}
                            className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3 -scale-x-100" />
                            <span>پیامک یادآوری قسط</span>
                          </button>

                          {inst.status !== 'paid' && (
                            <button type="button"
                              onClick={() => handleMarkInstallmentPaid(inst)}
                              className="py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>ثبت وصول قسط</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* TAB 4: RECEIPTS & POS */}
        {activeSegment === 'receipts' && (
          <div className="space-y-2 min-w-0">
            <div className="w-full max-w-full min-w-0 overflow-hidden p-3 rounded-[20px] bg-gradient-to-l from-emerald-50 via-white to-teal-50/40 border border-emerald-200/90 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-black text-slate-800">تراکنش‌های صندوق و کارتخوان POS ({toPersianDigits(allPayments.length)})</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">امروز تسویه آنلاین</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9.5px] font-black min-w-0">
                {[
                  { id: 'all', label: `همه (${toPersianDigits(allPayments.length)})` },
                  { id: 'pos', label: `کارتخوان POS (${toPersianDigits(allPayments.filter(p => p.method === 'pos').length)})` },
                  { id: 'cash', label: `نقدی (${toPersianDigits(allPayments.filter(p => p.method === 'cash').length)})` },
                  { id: 'card_to_card', label: `کارت‌به‌کارت (${toPersianDigits(allPayments.filter(p => p.method === 'card_to_card').length)})` }
                ].map(pill => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setReceiptMethodFilter(pill.id as any);
                    }}
                    className={`py-1 px-2 rounded-xl border transition-all cursor-pointer truncate ${
                      receiptMethodFilter === pill.id
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-emerald-200/80 hover:bg-emerald-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {allPayments.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
                هنوز تراکنشی در صندوق ثبت نشده است.
              </div>
            ) : (
              allPayments
                .filter(pay => receiptMethodFilter === 'all' || pay.method === receiptMethodFilter)
                .map((pay, idx) => (
                  <div
                    key={pay.id}
                    className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[20px] px-3 py-2.5 shadow-[var(--shadow-card)] border border-emerald-200/90 border-r-[3px] border-r-emerald-500 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-700 text-white text-[9.5px] font-mono font-black flex items-center justify-center border border-white">
                          #{toPersianDigits(idx + 1)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 text-right">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-[13px] font-black text-slate-900 truncate">{pay.patientName}</h4>
                          <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                            {pay.method === 'pos' ? 'کارتخوان POS' : pay.method === 'cash' ? 'نقدی' : 'کارت‌به‌کارت'}
                          </span>
                          <TrackableIdBadge recordId={pay.id} moduleKey="financial_pos" variant="emerald" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate">
                          تاریخ: {toPersianDigits(pay.date)} · پیگیری: {toPersianDigits(pay.referenceNumber || '۹۸۴۷۲')}
                        </span>
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-1.5 shrink-0">
                      <div className="px-2 py-1 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[11.5px] font-black text-emerald-700 font-mono block leading-none">
                          +{formatToman(pay.amount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          setEditingPayment(pay);
                          setEditPayAmount(pay.amount);
                          setEditPayNote(pay.forTreatment || '');
                          setConfirmRefundPaymentId(null);
                          setManagerPinError(false);
                        }}
                        className="py-1 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                        title="اصلاح مبلغ رسید یا ثبت عودت وجه (Refund)"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>اصلاح</span>
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* TAB 5: DAILY Z-REPORT & POS RECONCILIATION (بستن صندوق روزانه منشی و تراز پوز) */}
        {activeSegment === 'z_report' && (
          <div className="space-y-3 animate-in fade-in duration-200 text-right min-w-0">
            <div className="w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[24px] p-3.5 sm:p-4 border border-amber-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 truncate">ترازنامه بستن صندوق روزانه و مغایرت‌گیری POS</h4>
                    <span className="text-[10px] text-slate-500 font-bold block truncate">
                      تاریخ شیفت: {toPersianDigits(getCurrentPersianDate())}{lastZReportTime ? ` · آخرین بستن: ${lastZReportTime}` : ''}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${
                  shiftClosed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {shiftClosed ? 'شیفت بسته و تایید شد' : 'شیفت باز'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 min-w-0">
                <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-emerald-700 block truncate">تراکنش‌های کارت‌خوان POS</span>
                  <span className="text-xs font-black text-emerald-950 font-mono mt-1 block truncate">
                    {formatToman(realPosTotal)}
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-sky-50/70 border border-sky-200 min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-sky-700 block truncate">دریافتی نقدی و کارت‌به‌کارت</span>
                  <span className="text-xs font-black text-sky-950 font-mono mt-1 block truncate">
                    {formatToman(realCashTransferTotal)}
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-50/70 border border-amber-200 min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-amber-800 block truncate">اسناد چک صیادی دریافتی</span>
                  <span className="text-xs font-black text-amber-950 font-mono mt-1 block truncate">
                    {formatToman(totalSayadAmount)}
                  </span>
                </div>
                <div className={`p-2.5 sm:p-3 rounded-2xl border min-w-0 overflow-hidden ${
                  posReconciliationVariance === 0
                    ? 'bg-purple-50/70 border-purple-200'
                    : 'bg-rose-50/80 border-rose-300'
                }`}>
                  <span className="text-[10px] font-bold text-purple-800 block truncate">مغایرت تراز کارت‌خوان</span>
                  <span className={`text-xs font-black font-mono mt-1 block truncate ${
                    posReconciliationVariance === 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {posReconciliationVariance === 0
                      ? '۰ تومان (تراز دقیق ✓)'
                      : `${posReconciliationVariance > 0 ? '+' : '−'}${formatToman(Math.abs(posReconciliationVariance))}`}
                  </span>
                </div>
              </div>

              {/* Physical POS Terminal Z-Roll Input */}
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs min-w-0">
                <label htmlFor="pos-roll-input" className="font-bold text-slate-700 text-[11px]">
                  جمع تجمیع رول فیزیکی کارت‌خوان POS (جهت تطبیق با سیستم):
                </label>
                <input
                  id="pos-roll-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={toPersianDigits(realPosTotal)}
                  value={posBatchInput}
                  onChange={(e) => setPosBatchInput(e.target.value)}
                  className="w-full sm:w-48 min-w-0 bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-2 flex-wrap min-w-0">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 font-bold block">جمع کل کارکرد و دریافتی ثبت‌شده در صندوق:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">{formatToman(totalPaidCash + totalSayadAmount)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('heavy');
                    const closedAtLabel = `${toPersianDigits(getCurrentPersianDate())}`;
                    const zEntry = {
                      id: `Z-${Date.now()}`,
                      closedAtLabel,
                      posSystemTotal: realPosTotal,
                      posRollTotal: effectivePosRoll,
                      variance: posReconciliationVariance,
                      cashTransferTotal: realCashTransferTotal,
                      sayadTotal: totalSayadAmount
                    };
                    try {
                      const prev = JSON.parse(localStorage.getItem('minadental_z_reports_v1') || '[]');
                      const nextList = [zEntry, ...(Array.isArray(prev) ? prev.slice(0, 29) : [])];
                      localStorage.setItem('minadental_z_reports_v1', JSON.stringify(nextList));
                      setSavedZReports(nextList);
                    } catch {}
                    setLastZReportTime(closedAtLabel);
                    setShiftClosed(true);
                    actionFeedback.recordSuccess({
                      title: 'گزارش بستن صندوق روزانه (Z-Report) ثبت شد',
                      subtitle: `POS: ${formatToman(realPosTotal)} · مغایرت: ${posReconciliationVariance === 0 ? 'صفر' : formatToman(Math.abs(posReconciliationVariance))}`,
                      canUndo: false
                    });
                    showToast('صندوق روزانه با موفقیت بسته شد و گزارش تراز برای دکتر مهدی امیری ارسال گردید.');
                  }}
                  className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  {shiftClosed ? 'بروزرسانی رسید بستن صندوق' : 'تایید و بستن صندوق روزانه'}
                </button>
              </div>

              {/* Historical Z-Reports Log */}
              {savedZReports.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10.5px] font-black text-slate-700 block">
                    تاریخچه آخرین بستن‌های صندوق ({toPersianDigits(savedZReports.length)} شیفت اخیر):
                  </span>
                  <div className="space-y-1">
                    {savedZReports.slice(0, 4).map(zr => (
                      <div
                        key={zr.id}
                        className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-xl bg-amber-50/60 border border-amber-200/70 text-[10px]"
                      >
                        <span className="font-black text-slate-800">شیفت {zr.closedAtLabel}</span>
                        <span className="font-mono text-emerald-800 font-bold">POS: {formatToman(zr.posSystemTotal || 0)}</span>
                        <span className={`font-mono font-black ${zr.variance === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {zr.variance === 0 ? 'تراز دقیق ✓' : `مغایرت: ${formatToman(Math.abs(zr.variance || 0))}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: FINANCIAL PERFORMANCE & 30-DAY REVENUE TREND */}
        {activeSegment === 'analytics' && (
          <div className="space-y-3 animate-in fade-in duration-200 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 border border-amber-200/80 rounded-2xl px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-slate-700">
                برای تحلیل درآمد ماهانه (payments)، پیش‌بینی اقساط (installments) و تفکیک نقد/پوز/چک داشبورد گزارش‌ها را باز کنید:
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveSegment('reports');
                }}
                className="shrink-0 py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>داشبورد گزارش‌های مالی</span>
              </button>
            </div>
            {/* 30-Day Revenue Trend vs Historical Average */}
            <FinancialPerformanceChart patients={patients} />

            {/* Weekly & Daily Breakdown Analysis */}
            <FinancialWeeklyAnalytics patients={patients} />
          </div>
        )}

        {/* TAB 7: NEW FINANCIAL REPORTS DASHBOARD MODULE (BAR + PIE CHARTS) */}
        {activeSegment === 'reports' && (
          <FinancialReportsDashboard patients={patients} onOpenPatientFile={onOpenPatientFile} />
        )}
      </div>

      {/* Sayad Inquiry Modal (Full Viewport Portal) */}
      {inquiryModalCheck && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[100] bg-amber-950/35 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setInquiryModalCheck(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="استعلام آنلاین چک در سامانه پیچک"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-gradient-to-b from-amber-50/95 via-white to-emerald-50/50 text-slate-900 rounded-[26px] border border-amber-200/90 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                    <Shield className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-slate-900">استعلام آنلاین چک در سامانه پیچک</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setInquiryModalCheck(null)} 
                  aria-label="بستن استعلام چک"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {inquiryLoading ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="w-7 h-7 text-amber-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-600 font-bold">در حال برقراری ارتباط با وب‌سرویس بانک مرکزی...</p>
                </div>
              ) : inquiryResult ? (
                <div className="space-y-3 text-xs">
                  {/* Status Box */}
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>وضعیت اعتباری صادرکننده: سفید (بسیار معتبر)</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 font-medium">
                      صادرکننده فاقد هرگونه سابقه چک برگشتی یا سوءاثر در سیستم بانکی کشور است.
                    </p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl font-mono text-[11px] border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">شناسه صیادی:</span>
                      <span className="text-amber-800 font-bold">{inquiryResult.sayadId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">صادرکننده:</span>
                      <span className="text-slate-800 font-bold font-sans">{inquiryResult.issuerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">بانک عامل:</span>
                      <span className="text-slate-800 font-bold font-sans">{inquiryResult.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">تعداد چک برگشتی:</span>
                      <span className="text-emerald-700 font-bold">۰ فقره</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInquiryModalCheck(null)}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md shadow-amber-600/25 active:scale-95 transition-all cursor-pointer"
                  >
                    تأیید و بازگشت
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Automated Installment Plan Calculator Modal */}
      <InstallmentPlanModal
        isOpen={showInstallmentModal}
        onClose={() => {
          setShowInstallmentModal(false);
          setSelectedInstallmentPatientId(undefined);
        }}
        patients={patients}
        defaultPatientId={selectedInstallmentPatientId}
        onSaveInstallmentPlan={(patientId, installments, checks, downPayment) => {
          if (onSaveInstallmentPlan) {
            onSaveInstallmentPlan(patientId, installments, checks, downPayment);
          }
          showToast('برنامه اقساط، چک صیادی/ضمانت و یادآوری‌ها به‌صورت یکپارچه در پرونده بیمار ثبت شد.');
        }}
      />

      {/* Printable Monthly Doctor Commission Settlement Slip Modal */}
      {selectedDoctorSlip && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setSelectedDoctorSlip(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="فیش رسمی تسویه حساب ماهانه پزشک"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-[26px] border-2 border-emerald-500 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-950">فیش رسمی تسویه حساب ماهانه پزشک</h3>
                    <span className="text-[10px] text-emerald-700 font-bold block">
                      کلینیک تخصصی مینادنتال · تاریخ صدور: {toPersianDigits(getCurrentPersianDate())}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoctorSlip(null)}
                  aria-label="بستن فیش تسویه حساب"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">نام پزشک:</span>
                    <span className="font-black text-slate-900">{selectedDoctorSlip.doctorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تخصص / سمت:</span>
                    <span className="font-bold text-slate-700">{selectedDoctorSlip.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">فرمول قرارداد:</span>
                    <span className="font-mono font-bold text-emerald-800">{toPersianDigits(selectedDoctorSlip.calculationAuditFormula)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-600">کل کارکرد ناخالص ثبت‌شده:</span>
                    <span className="font-bold text-slate-900">{formatToman(selectedDoctorSlip.totalRegisteredGrossWork)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-600">کسر هزینه لابراتوار:</span>
                    <span className="font-bold text-rose-700">− {formatToman(selectedDoctorSlip.totalAssignedLabDeductions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-600">سهم کلینیک از کارکرد:</span>
                    <span className="font-bold text-sky-800">{formatToman(selectedDoctorSlip.exactClinicRetainedShare)}</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-300 flex justify-between text-xs">
                    <span className="font-sans font-black text-emerald-950">خالص قابل پرداخت به پزشک:</span>
                    <span className="font-black text-emerald-700">{formatExactMicroToman(selectedDoctorSlip.exactDoctorPayable, true)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedDoctorSlip(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    window.print();
                  }}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ رسمی فیش تسویه</span>
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Edit / Delete Sayad or Guarantee Check Modal */}
      {editingCheck && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingCheck(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ویرایش مشخصات چک"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-purple-200 p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">ویرایش مشخصات چک ({editingCheck.patientName})</h4>
                    <span className="text-[10px] text-slate-500 font-bold">اصلاح شناسه صیاد، سررسید، بانک و مبلغ</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCheck(null)}
                  aria-label="بستن ویرایش چک"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">نام بانک صادرکننده</label>
                    <input aria-label="نام بانک صادرکننده"
                      type="text"
                      value={editCheckBank}
                      onChange={(e) => setEditCheckBank(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">شناسه ۱۶ رقمی صیاد</label>
                    <input aria-label="شناسه ۱۶ رقمی صیاد"
                      type="text"
                      value={editCheckSayadId}
                      onChange={(e) => setEditCheckSayadId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">مبلغ چک (تومان)</label>
                    <input aria-label="مبلغ چک (تومان)"
                      type="number"
                      readOnly={!canModifyFinancialAmount}
                      value={editCheckAmount}
                      onChange={(e) => canModifyFinancialAmount && setEditCheckAmount(Number(e.target.value))}
                      className={`w-full border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:outline-none ${
                        canModifyFinancialAmount ? 'bg-slate-50 focus:bg-white focus:border-purple-500' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">تاریخ سررسید</label>
                    <input aria-label="تاریخ سررسید"
                      type="text"
                      readOnly={!canModifyFinancialAmount}
                      value={editCheckDueDate}
                      onChange={(e) => canModifyFinancialAmount && setEditCheckDueDate(e.target.value)}
                      className={`w-full border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:outline-none ${
                        canModifyFinancialAmount ? 'bg-slate-50 focus:bg-white focus:border-purple-500' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {!canModifyFinancialAmount && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-[10.5px]">
                  <div className="flex items-center gap-1.5 font-black text-amber-900">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>تغییر مبلغ و سررسید اسناد مالی فقط با مجوز مدیر مجاز است</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="پین مدیر"
                      value={managerPinInput}
                      onChange={(e) => { setManagerPinInput(e.target.value); setManagerPinError(false); }}
                      className="flex-1 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyManagerPin}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-black text-[10px] cursor-pointer"
                    >
                      تایید مدیر
                    </button>
                  </div>
                  {managerPinError && <span className="text-rose-700 font-bold block">پین مدیر نامعتبر است</span>}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {onDeleteCheck && canModifyFinancialAmount ? (
                  confirmDeleteCheckId === editingCheck.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('heavy');
                        onDeleteCheck(editingCheck.id);
                        showToast(`چک «${editingCheck.patientName}» به بایگانی مدیر منتقل شد.`);
                        setConfirmDeleteCheckId(null);
                        setEditingCheck(null);
                      }}
                      className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تایید حذف قطعی ✓</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('warning');
                        setConfirmDeleteCheckId(editingCheck.id);
                      }}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف چک (مدیر)</span>
                    </button>
                  )
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">🔒 حذف چک فقط توسط مدیر</span>
                )}
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => { setEditingCheck(null); setConfirmDeleteCheckId(null); }}
                    className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={!canModifyFinancialAmount}
                    onClick={() => {
                      if (!canModifyFinancialAmount) return;
                      triggerHaptic('success');
                      if (onEditCheck) {
                        onEditCheck(editingCheck.id, {
                          bankName: editCheckBank.trim(),
                          sayadId: editCheckSayadId.trim(),
                          amount: editCheckAmount,
                          dueDate: editCheckDueDate.trim()
                        });
                      }
                      showToast(`مشخصات چک «${editingCheck.patientName}» ذخیره شد.`);
                      setEditingCheck(null);
                    }}
                    className={`py-2 px-4 rounded-xl text-white text-xs font-black shadow-sm transition-all ${
                      canModifyFinancialAmount ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer active:scale-95' : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    ذخیره تغییرات چک ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Edit / Reschedule Installment Modal */}
      {editingInstallment && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingInstallment(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="تمدید سررسید و ویرایش قسط"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-amber-200 p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">تمدید سررسید و ویرایش قسط شماره {toPersianDigits(editingInstallment.installmentNumber)}</h4>
                    <span className="text-[10px] text-slate-500 font-bold">بیمار: {editingInstallment.patientName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingInstallment(null)}
                  aria-label="بستن ویرایش قسط"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">مبلغ قسط (تومان)</label>
                  <input aria-label="مبلغ قسط (تومان)"
                    type="number"
                    readOnly={!canModifyFinancialAmount}
                    value={editInstAmount}
                    onChange={(e) => canModifyFinancialAmount && setEditInstAmount(Number(e.target.value))}
                    className={`w-full border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:outline-none ${
                      canModifyFinancialAmount ? 'bg-slate-50 focus:bg-white focus:border-amber-500' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">تاریخ سررسید جدید</label>
                  <input aria-label="تاریخ سررسید جدید"
                    type="text"
                    readOnly={!canModifyFinancialAmount}
                    value={editInstDueDate}
                    onChange={(e) => canModifyFinancialAmount && setEditInstDueDate(e.target.value)}
                    className={`w-full border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:outline-none ${
                      canModifyFinancialAmount ? 'bg-slate-50 focus:bg-white focus:border-amber-500' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              {!canModifyFinancialAmount && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-[10.5px]">
                  <div className="flex items-center gap-1.5 font-black text-amber-900">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>تمدید یا تغییر مبلغ قسط نیازمند تایید مدیر است</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="پین مدیر"
                      value={managerPinInput}
                      onChange={(e) => { setManagerPinInput(e.target.value); setManagerPinError(false); }}
                      className="flex-1 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyManagerPin}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-black text-[10px] cursor-pointer"
                    >
                      تایید مدیر
                    </button>
                  </div>
                  {managerPinError && <span className="text-rose-700 font-bold block">پین مدیر نامعتبر است</span>}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingInstallment(null)}
                  className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={!canModifyFinancialAmount}
                  onClick={() => {
                    if (!canModifyFinancialAmount) return;
                    triggerHaptic('success');
                    if (onEditInstallment) {
                      onEditInstallment(editingInstallment.id, {
                        amount: editInstAmount,
                        dueDate: editInstDueDate.trim()
                      });
                    }
                    showToast(`قسط شماره ${toPersianDigits(editingInstallment.installmentNumber)} «${editingInstallment.patientName}» ویرایش شد.`);
                    setEditingInstallment(null);
                  }}
                  className={`py-2 px-4 rounded-xl text-xs font-black shadow-sm transition-all ${
                    canModifyFinancialAmount ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  ذخیره تغییرات قسط ✓
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Edit Receipt / Refund Payment Modal */}
      {editingPayment && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingPayment(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="اصلاح رسید صندوق یا عودت وجه"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-emerald-200 p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">اصلاح رسید صندوق یا عودت وجه (Refund)</h4>
                    <span className="text-[10px] text-slate-500 font-bold">بیمار: {editingPayment.patientName} · تاریخ: {toPersianDigits(editingPayment.date)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  aria-label="بستن اصلاح رسید"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">مبلغ پرداختی (تومان)</label>
                  <input aria-label="مبلغ پرداختی (تومان)"
                    type="number"
                    readOnly={!canModifyFinancialAmount}
                    value={editPayAmount}
                    onChange={(e) => canModifyFinancialAmount && setEditPayAmount(Number(e.target.value))}
                    className={`w-full border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:outline-none ${
                      canModifyFinancialAmount ? 'bg-slate-50 focus:bg-white focus:border-emerald-500' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">شرح تراکنش / بابت درمان</label>
                  <input aria-label="شرح تراکنش / بابت درمان"
                    type="text"
                    readOnly={!canModifyFinancialAmount}
                    value={editPayNote}
                    onChange={(e) => canModifyFinancialAmount && setEditPayNote(e.target.value)}
                    className={`w-full border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:outline-none ${
                      canModifyFinancialAmount ? 'bg-slate-50 focus:bg-white focus:border-emerald-500' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              {!canModifyFinancialAmount && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-[10.5px]">
                  <div className="flex items-center gap-1.5 font-black text-amber-900">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>اصلاح مبلغ رسید صندوق یا عودت وجه فقط برای مدیر مجاز است</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="پین مدیر"
                      value={managerPinInput}
                      onChange={(e) => { setManagerPinInput(e.target.value); setManagerPinError(false); }}
                      className="flex-1 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyManagerPin}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-black text-[10px] cursor-pointer"
                    >
                      تایید مدیر
                    </button>
                  </div>
                  {managerPinError && <span className="text-rose-700 font-bold block">پین مدیر نامعتبر است</span>}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {onEditOrRefundPayment && canModifyFinancialAmount ? (
                  confirmRefundPaymentId === editingPayment.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('heavy');
                        onEditOrRefundPayment(editingPayment.id, 'refund');
                        showToast(`عودت کامل وجه (${formatToman(editingPayment.amount)}) برای «${editingPayment.patientName}» ثبت و بایگانی شد.`);
                        setConfirmRefundPaymentId(null);
                        setEditingPayment(null);
                      }}
                      className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تایید عودت قطعی ✓</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('warning');
                        setConfirmRefundPaymentId(editingPayment.id);
                      }}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>عودت وجه (مدیر)</span>
                    </button>
                  )
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">🔒 عودت وجه فقط توسط مدیر</span>
                )}
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => { setEditingPayment(null); setConfirmRefundPaymentId(null); }}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={!canModifyFinancialAmount}
                    onClick={() => {
                      if (!canModifyFinancialAmount) return;
                      triggerHaptic('success');
                      if (onEditOrRefundPayment) {
                        onEditOrRefundPayment(editingPayment.id, 'edit', editPayAmount, editPayNote.trim());
                      }
                      showToast(`مبلغ رسید «${editingPayment.patientName}» اصلاح و مانده به‌روزرسانی شد.`);
                      setEditingPayment(null);
                    }}
                    className={`py-2 px-4 rounded-xl text-white text-xs font-black shadow-sm transition-all ${
                      canModifyFinancialAmount ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95' : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    ذخیره اصلاحیه ✓
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
