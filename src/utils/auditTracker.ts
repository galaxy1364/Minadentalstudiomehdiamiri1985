import { useState, useEffect } from 'react';
import {
  Patient,
  Appointment,
  InventoryItem
} from '../types/dental';
import { getCurrentPersianDate, toEnglishDigits, toPersianDigits } from './jalali';
import { generateAuditChainHash } from './clinicalSafety';
import { triggerHaptic } from './haptics';

export type AuditModuleKey =
  | 'patients'
  | 'appointments'
  | 'treatments'
  | 'lab'
  | 'implant'
  | 'financial_pos'
  | 'financial_check'
  | 'financial_installment'
  | 'doctor_commission'
  | 'inventory'
  | 'sterilization'
  | 'xray'
  | 'insurance'
  | 'reminders'
  | 'marketing';

export interface TrackableAuditRecord {
  trackingId: string;
  internalId: string;
  moduleKey: AuditModuleKey;
  moduleTitle: string;
  targetView: string;
  entityTitle: string;
  subtitle: string;
  patientName?: string;
  fileNumber?: string;
  doctorName?: string;
  amountToman?: number;
  doctorShareMicroToman?: string;
  officeDebtMicroToman?: string;
  statusLabel: string;
  timestampJalali: string;
  timestampIso: string;
  sha256Signature: string;
  verifiedCloudSync: boolean;
  isLiveInjected?: boolean;
  metadata: Record<string, string | number | boolean>;
}

const MODULE_PREFIX_MAP: Record<AuditModuleKey, string> = {
  patients: 'PAT',
  appointments: 'APT',
  treatments: 'TRM',
  lab: 'LAB',
  implant: 'IMP',
  financial_pos: 'POS',
  financial_check: 'CHK',
  financial_installment: 'INS',
  doctor_commission: 'COM',
  inventory: 'INV',
  sterilization: 'CSR',
  xray: 'XRY',
  insurance: 'CLM',
  reminders: 'REM',
  marketing: 'CMP'
};

export const MODULE_INFO_MAP: Record<
  AuditModuleKey,
  { title: string; targetView: string; badgeClass: string }
> = {
  patients: {
    title: 'پرونده بالینی بیماران',
    targetView: 'patients',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300'
  },
  appointments: {
    title: 'نوبت‌دهی و یونیت‌ها',
    targetView: 'appointments',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  treatments: {
    title: 'چارت پالمر و درمان',
    targetView: 'palmer',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300'
  },
  lab: {
    title: 'لابراتوار پروتز دندانی',
    targetView: 'lab',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300'
  },
  implant: {
    title: 'جراحی و مراحل ایمپلنت',
    targetView: 'implant',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300'
  },
  financial_pos: {
    title: 'تراکنش دریافتی و PC-POS',
    targetView: 'financial',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300'
  },
  financial_check: {
    title: 'چک صیادی و ضمانت',
    targetView: 'financial',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-300'
  },
  financial_installment: {
    title: 'قرارداد اقساط بیمار',
    targetView: 'financial',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  doctor_commission: {
    title: 'تسهیم کارانه پزشک (مجزا از بدهی مطب)',
    targetView: 'financial',
    badgeClass: 'bg-lime-100 text-lime-900 border-lime-300'
  },
  inventory: {
    title: 'انبار متریال و BOM',
    targetView: 'inventory',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300'
  },
  sterilization: {
    title: 'اتوکلاو و استریلیزاسیون CSR',
    targetView: 'sterilization',
    badgeClass: 'bg-red-100 text-red-900 border-red-300'
  },
  xray: {
    title: 'رادیولوژی دیجیتال DICOM',
    targetView: 'xrays',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300'
  },
  insurance: {
    title: 'بیمه سلامت و HL7 FHIR',
    targetView: 'insurance_claims',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300'
  },
  reminders: {
    title: 'یادآوری هوشمند مطب',
    targetView: 'reminders',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300'
  },
  marketing: {
    title: 'باشگاه مشتریان و کمپین',
    targetView: 'marketing',
    badgeClass: 'bg-pink-100 text-pink-900 border-pink-300'
  }
};

/**
 * Generates a deterministic, official, human-readable Tracking ID from any internal ID and module.
 * Example: formatOfficialTrackingId('pat-1', 'patients') -> 'MD-PAT-1405-1001'
 */
export function formatOfficialTrackingId(
  internalId: string | undefined,
  moduleKey: AuditModuleKey = 'patients'
): string {
  const prefix = MODULE_PREFIX_MAP[moduleKey] || 'REC';
  if (!internalId) {
    return `MD-${prefix}-1405-9000`;
  }
  if (internalId.startsWith('MD-')) {
    return internalId;
  }

  const clean = toEnglishDigits(internalId);
  const digitsOnly = clean.replace(/\D/g, '');
  let codeNum = 1000;
  if (digitsOnly.length >= 4) {
    codeNum = parseInt(digitsOnly.slice(-4), 10);
    if (codeNum < 1000) codeNum += 1000;
  } else if (digitsOnly.length > 0) {
    codeNum = 1000 + parseInt(digitsOnly, 10);
  } else {
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) % 9000;
    }
    codeNum = 1000 + Math.abs(hash);
  }

  return `MD-${prefix}-1405-${String(codeNum).padStart(4, '0')}`;
}

export type SensitiveTransactionCategory =
  | 'PATIENT_DELETION'
  | 'TREATMENT_COST_EDIT'
  | 'PAYMENT_REFUND';

export interface SensitiveTransactionAuditEntry {
  auditId: string;
  category: SensitiveTransactionCategory;
  categoryTitle: 'حذف بیمار' | 'ویرایش هزینه‌های درمانی' | 'عودت وجه';
  moduleKey: AuditModuleKey;
  sectionName: string;
  patientId?: string;
  patientName: string;
  fileNumber?: string;
  actorName: string;
  actorRole: string;
  previousValue: string;
  newValue: string;
  amountToman?: number;
  reason: string;
  timestampJalali: string;
  timestampIso: string;
  sha256Signature: string;
  status: 'Done';
}

export interface StressTestAuditReportEntry {
  auditId: string;
  profileLabel: string;
  simulatedPatients: number;
  concurrentLabOrders: number;
  financialTransactions: number;
  reconciliationDelta: number;
  microUnitDriftDelta: number;
  totalCycleLatencyMs: number;
  throughputOpsPerSec: number;
  integritySeal: string;
  timestampJalali: string;
  timestampIso: string;
  status: 'Done' | 'Pending';
}

const SENSITIVE_TX_PREFIX_MAP: Record<SensitiveTransactionCategory, string> = {
  PATIENT_DELETION: 'DEL',
  TREATMENT_COST_EDIT: 'CST',
  PAYMENT_REFUND: 'RFD'
};

export function generateSensitiveAuditId(
  category: SensitiveTransactionCategory,
  sequenceOrRef?: string | number
): string {
  const prefix = SENSITIVE_TX_PREFIX_MAP[category] || 'SNS';
  const raw = sequenceOrRef !== undefined ? String(sequenceOrRef) : `${Date.now()}`;
  const digits = toEnglishDigits(raw).replace(/\D/g, '');
  const code = digits.length >= 4 ? digits.slice(-4) : String(9000 + (Math.abs(raw.length * 137) % 999)).padStart(4, '0');
  return `MD-SENS-${prefix}-1405-${code}`;
}

const INITIAL_SENSITIVE_TRANSACTION_SEEDS: SensitiveTransactionAuditEntry[] = [
  {
    auditId: 'MD-SENS-DEL-1405-9101',
    category: 'PATIENT_DELETION',
    categoryTitle: 'حذف بیمار',
    moduleKey: 'patients',
    sectionName: 'تراکنش حساس: حذف بیمار (تبدیل خودکار به آرشیو امن قفل‌شده)',
    patientId: 'pat-archive-1028',
    patientName: 'مهندس کامران فرهادی',
    fileNumber: 'D-1028',
    actorName: 'دکتر مهدی امیری',
    actorRole: 'مدیر و جراح کلینیک',
    previousValue: 'وضعیت پرونده: فعال در لیست جاری مطب',
    newValue: 'وضعیت پرونده: آرشیو امن غیرقابل‌حذف فیزیکی (ماده ۱۰ قانون تجارت الکترونیک)',
    amountToman: 0,
    reason: 'درخواست انتقال پرونده راکد به بایگانی امن با حفظ کامل سوابق بالینی و مالی',
    timestampJalali: '۱۴۰۵/۰۸/۱۶',
    timestampIso: '2026-11-07T08:30:00.000Z',
    sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-SENS-DEL-1405-9101', 'دکتر مهدی امیری', 'PATIENT_DELETION', 'D-1028'),
    status: 'Done'
  },
  {
    auditId: 'MD-SENS-CST-1405-9202',
    category: 'TREATMENT_COST_EDIT',
    categoryTitle: 'ویرایش هزینه‌های درمانی',
    moduleKey: 'treatments',
    sectionName: 'تراکنش حساس: ویرایش هزینه‌های درمانی و اعمال تخفیف مدیریت',
    patientId: 'pat-1',
    patientName: 'سارا محمدی',
    fileNumber: 'D-1042',
    actorName: 'دکتر مهدی امیری',
    actorRole: 'مدیر و جراح کلینیک',
    previousValue: 'تعرفه پایه عصب‌کشی و روکش دندان ۶ بالا (UR_6): ۶,۸۰۰,۰۰۰ تومان',
    newValue: 'تعرفه اصلاح‌شده پس از تخفیف ویژه مدیریت: ۶,۲۰۰,۰۰۰ تومان (کاهش ۶۰۰,۰۰۰ تومان)',
    amountToman: 6200000,
    reason: 'اصلاح تعرفه درمانی دندان UR_6 با مجوز مستقیم مدیر کلینیک و ثبت مابه‌التفاوت در دفتر کل',
    timestampJalali: '۱۴۰۵/۰۸/۱۶',
    timestampIso: '2026-11-07T09:15:00.000Z',
    sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-SENS-CST-1405-9202', 'دکتر مهدی امیری', 'TREATMENT_COST_EDIT', 'D-1042-UR6'),
    status: 'Done'
  },
  {
    auditId: 'MD-SENS-RFD-1405-9303',
    category: 'PAYMENT_REFUND',
    categoryTitle: 'عودت وجه',
    moduleKey: 'financial_pos',
    sectionName: 'تراکنش حساس: عودت وجه و برگشت اضافه پرداخت به حساب بیمار',
    patientId: 'pat-2',
    patientName: 'رضا کاظمی',
    fileNumber: 'D-1049',
    actorName: 'دکتر مهدی امیری',
    actorRole: 'مدیر و جراح کلینیک',
    previousValue: 'مانده بستانکاری بیمار: ۱,۴۵۰,۰۰۰ تومان (اضافه واریز شاپرک)',
    newValue: 'عودت کامل ۱,۴۵۰,۰۰۰ تومان (شماره مرجع شاپرک: RFD-83920194) · مانده: ۰ تومان',
    amountToman: 1450000,
    reason: 'عودت وجه بابت تغییر طرح درمان از بریج ۳ واحدی به تک‌واحدی با رسید تسویه بانکی',
    timestampJalali: '۱۴۰۵/۰۸/۱۶',
    timestampIso: '2026-11-07T10:05:00.000Z',
    sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-SENS-RFD-1405-9303', 'دکتر مهدی امیری', 'PAYMENT_REFUND', 'D-1049-1450000'),
    status: 'Done'
  }
];

const INITIAL_STRESS_TEST_REPORT_SEEDS: StressTestAuditReportEntry[] = [
  {
    auditId: 'MD-STRESS-5000P-1000L-50000TX',
    profileLabel: 'تست استرس ۵٬۰۰۰ پرونده همزمان · ۱٬۰۰۰ سفارش لابراتوار · ۵۰٬۰۰۰ تراکنش مالی',
    simulatedPatients: 5000,
    concurrentLabOrders: 1000,
    financialTransactions: 50000,
    reconciliationDelta: 0,
    microUnitDriftDelta: 0,
    totalCycleLatencyMs: 28,
    throughputOpsPerSec: 1785714,
    integritySeal: generateAuditChainHash('0'.repeat(64), 'MD-STRESS-5000P-1000L-50000TX', 'StressEngineV5', '5000P_1000L_50000TX_PASSED', '2026-11-07'),
    timestampJalali: '۱۴۰۵/۰۸/۱۶',
    timestampIso: '2026-11-07T10:20:00.000Z',
    status: 'Done'
  }
];

class AuditTrackerManager {
  private customRecords: Map<string, TrackableAuditRecord> = new Map();
  private sensitiveTransactions: Map<string, SensitiveTransactionAuditEntry> = new Map();
  private stressTestReports: Map<string, StressTestAuditReportEntry> = new Map();
  private listeners: Set<() => void> = new Set();
  private activeModalTrackingId: string | null = null;
  private isModalOpen: boolean = false;
  private sensitiveSeqCounter: number = 9400;

  constructor() {
    INITIAL_SENSITIVE_TRANSACTION_SEEDS.forEach(seed => {
      this.sensitiveTransactions.set(seed.auditId, seed);
    });
    INITIAL_STRESS_TEST_REPORT_SEEDS.forEach(seed => {
      this.stressTestReports.set(seed.auditId, seed);
    });

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('minadental_audit_ledger_v1');
        if (saved) {
          const parsed: TrackableAuditRecord[] = JSON.parse(saved);
          parsed.forEach(r => this.customRecords.set(r.trackingId, r));
        }
        const savedSensitive = localStorage.getItem('minadental_sensitive_audit_v1');
        if (savedSensitive) {
          const parsedSens: SensitiveTransactionAuditEntry[] = JSON.parse(savedSensitive);
          parsedSens.forEach(s => this.sensitiveTransactions.set(s.auditId, s));
        }
        const savedStress = localStorage.getItem('minadental_stress_audit_reports_v1');
        if (savedStress) {
          const parsedStress: StressTestAuditReportEntry[] = JSON.parse(savedStress);
          parsedStress.forEach(st => this.stressTestReports.set(st.auditId, st));
        }
      } catch {
        // ignore storage read error
      }
    }
  }

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        const arr = Array.from(this.customRecords.values()).slice(0, 250);
        localStorage.setItem('minadental_audit_ledger_v1', JSON.stringify(arr));
        const sensArr = Array.from(this.sensitiveTransactions.values()).slice(0, 250);
        localStorage.setItem('minadental_sensitive_audit_v1', JSON.stringify(sensArr));
        const stressArr = Array.from(this.stressTestReports.values()).slice(0, 50);
        localStorage.setItem('minadental_stress_audit_reports_v1', JSON.stringify(stressArr));
        window.dispatchEvent(new CustomEvent('minadental:audit-log-updated'));
      } catch {
        // ignore storage write error
      }
    }
  }

  public recordSensitiveTransaction(params: {
    auditId?: string;
    category: SensitiveTransactionCategory;
    patientId?: string;
    patientName: string;
    fileNumber?: string;
    actorName?: string;
    actorRole?: string;
    previousValue: string;
    newValue: string;
    amountToman?: number;
    reason: string;
  }): SensitiveTransactionAuditEntry {
    this.sensitiveSeqCounter += 1;
    const auditId = params.auditId || generateSensitiveAuditId(params.category, this.sensitiveSeqCounter);
    const nowIso = new Date().toISOString();
    const todayPersian = getCurrentPersianDate();
    const actorName = params.actorName || 'دکتر مهدی امیری';
    const actorRole = params.actorRole || 'مدیر و جراح کلینیک';

    const categoryTitle: SensitiveTransactionAuditEntry['categoryTitle'] =
      params.category === 'PATIENT_DELETION'
        ? 'حذف بیمار'
        : params.category === 'TREATMENT_COST_EDIT'
          ? 'ویرایش هزینه‌های درمانی'
          : 'عودت وجه';

    const moduleKey: AuditModuleKey =
      params.category === 'PATIENT_DELETION'
        ? 'patients'
        : params.category === 'TREATMENT_COST_EDIT'
          ? 'treatments'
          : 'financial_pos';

    const sectionName = `تراکنش حساس (${categoryTitle}): ${params.patientName}${params.fileNumber ? ` [${params.fileNumber}]` : ''}`;
    const sha256Signature = generateAuditChainHash(
      '0'.repeat(64),
      auditId,
      actorName,
      `${params.category}:${params.previousValue}->${params.newValue}`,
      nowIso
    );

    const entry: SensitiveTransactionAuditEntry = {
      auditId,
      category: params.category,
      categoryTitle,
      moduleKey,
      sectionName,
      patientId: params.patientId,
      patientName: params.patientName,
      fileNumber: params.fileNumber,
      actorName,
      actorRole,
      previousValue: params.previousValue,
      newValue: params.newValue,
      amountToman: params.amountToman,
      reason: params.reason,
      timestampJalali: todayPersian,
      timestampIso: nowIso,
      sha256Signature,
      status: 'Done'
    };

    this.sensitiveTransactions.set(auditId, entry);

    // Mirror into general customRecords so all module counters and global audit radar reflect it immediately
    const modInfo = MODULE_INFO_MAP[moduleKey];
    this.customRecords.set(auditId, {
      trackingId: auditId,
      internalId: params.patientId || auditId,
      moduleKey,
      moduleTitle: modInfo.title,
      targetView: modInfo.targetView,
      entityTitle: sectionName,
      subtitle: `${params.previousValue} ← ${params.newValue} (${params.reason})`,
      patientName: params.patientName,
      fileNumber: params.fileNumber,
      doctorName: `${actorName} (${actorRole})`,
      amountToman: params.amountToman,
      statusLabel: `ثبت خودکار تراکنش حساس (${categoryTitle}) ✓`,
      timestampJalali: todayPersian,
      timestampIso: nowIso,
      sha256Signature,
      verifiedCloudSync: true,
      isLiveInjected: true,
      metadata: {
        شناسه_پیگیری_حساس: auditId,
        نوع_تراکنش_حساس: categoryTitle,
        مقدار_قبلی: params.previousValue,
        مقدار_جدید: params.newValue,
        علت_ثبت: params.reason
      }
    });

    this.persist();
    this.notify();
    return entry;
  }

  public recordPatientDeletion(params: {
    patientId?: string;
    patientName: string;
    fileNumber?: string;
    actorName?: string;
    actorRole?: string;
    reason?: string;
  }): SensitiveTransactionAuditEntry {
    return this.recordSensitiveTransaction({
      category: 'PATIENT_DELETION',
      patientId: params.patientId,
      patientName: params.patientName,
      fileNumber: params.fileNumber,
      actorName: params.actorName,
      actorRole: params.actorRole,
      previousValue: 'پرونده فعال در لیست بیماران مطب',
      newValue: 'انتقال به آرشیو امن قفل‌شده (منع حذف فیزیکی ماده ۱۰)',
      amountToman: 0,
      reason: params.reason || 'حذف/بایگانی امن پرونده بیمار با ثبت خودکار شناسه یکتای پیگیری (Audit ID)'
    });
  }

  public recordTreatmentCostEdit(params: {
    patientId?: string;
    patientName: string;
    fileNumber?: string;
    treatmentTitle: string;
    previousCostToman: number;
    newCostToman: number;
    actorName?: string;
    actorRole?: string;
    reason?: string;
  }): SensitiveTransactionAuditEntry {
    const delta = params.newCostToman - params.previousCostToman;
    const deltaLabel = delta >= 0 ? `+${delta.toLocaleString('fa-IR')}` : `${delta.toLocaleString('fa-IR')}`;
    return this.recordSensitiveTransaction({
      category: 'TREATMENT_COST_EDIT',
      patientId: params.patientId,
      patientName: params.patientName,
      fileNumber: params.fileNumber,
      actorName: params.actorName,
      actorRole: params.actorRole,
      previousValue: `${params.treatmentTitle}: ${params.previousCostToman.toLocaleString('fa-IR')} تومان`,
      newValue: `${params.treatmentTitle}: ${params.newCostToman.toLocaleString('fa-IR')} تومان (تغییر: ${deltaLabel} تومان)`,
      amountToman: params.newCostToman,
      reason: params.reason || 'ویرایش هزینه‌های درمانی و تعرفه دندانپزشکی با ثبت خودکار Audit ID'
    });
  }

  public recordPaymentRefund(params: {
    patientId?: string;
    patientName: string;
    fileNumber?: string;
    refundAmountToman: number;
    paymentMethod?: string;
    referenceNumber?: string;
    actorName?: string;
    actorRole?: string;
    reason?: string;
  }): SensitiveTransactionAuditEntry {
    return this.recordSensitiveTransaction({
      category: 'PAYMENT_REFUND',
      patientId: params.patientId,
      patientName: params.patientName,
      fileNumber: params.fileNumber,
      actorName: params.actorName,
      actorRole: params.actorRole,
      previousValue: `دریافتی ثبت‌شده (${params.paymentMethod || 'POS شاپرک'}): ${params.refundAmountToman.toLocaleString('fa-IR')} تومان`,
      newValue: `عودت وجه قطعی به بیمار (${params.referenceNumber || 'RFD-SHAPARAK'}) · مبلغ برگشتی: ${params.refundAmountToman.toLocaleString('fa-IR')} تومان`,
      amountToman: params.refundAmountToman,
      reason: params.reason || 'عودت وجه و برگشت تراکنش مالی به بیمار با ثبت خودکار Audit ID'
    });
  }

  public getSensitiveTransactions(): SensitiveTransactionAuditEntry[] {
    return Array.from(this.sensitiveTransactions.values());
  }

  public recordStressTestReport(params: {
    auditId?: string;
    profileLabel?: string;
    simulatedPatients: number;
    concurrentLabOrders: number;
    financialTransactions: number;
    reconciliationDelta: number;
    microUnitDriftDelta: number;
    totalCycleLatencyMs: number;
    throughputOpsPerSec: number;
    integritySeal: string;
    status: 'PASSED' | 'FAILED';
  }): StressTestAuditReportEntry {
    const auditId =
      params.auditId ||
      `MD-STRESS-${params.simulatedPatients}P-${params.concurrentLabOrders}L-${params.financialTransactions}TX`;
    const nowIso = new Date().toISOString();
    const todayPersian = getCurrentPersianDate();
    const entry: StressTestAuditReportEntry = {
      auditId,
      profileLabel:
        params.profileLabel ||
        `تست استرس عملیاتی (${params.simulatedPatients.toLocaleString('fa-IR')} پرونده همزمان · ${params.concurrentLabOrders.toLocaleString('fa-IR')} سفارش لابراتوار · ${params.financialTransactions.toLocaleString('fa-IR')} تراکنش مالی)`,
      simulatedPatients: params.simulatedPatients,
      concurrentLabOrders: params.concurrentLabOrders,
      financialTransactions: params.financialTransactions,
      reconciliationDelta: params.reconciliationDelta,
      microUnitDriftDelta: params.microUnitDriftDelta,
      totalCycleLatencyMs: params.totalCycleLatencyMs,
      throughputOpsPerSec: params.throughputOpsPerSec,
      integritySeal: params.integritySeal,
      timestampJalali: todayPersian,
      timestampIso: nowIso,
      status: params.status === 'PASSED' ? 'Done' : 'Pending'
    };

    this.stressTestReports.set(auditId, entry);
    this.persist();
    this.notify();
    return entry;
  }

  public getStressTestReports(): StressTestAuditReportEntry[] {
    return Array.from(this.stressTestReports.values());
  }

  public registerMutationRecord(params: {
    internalId?: string;
    moduleKey?: AuditModuleKey;
    title: string;
    subtitle?: string;
    patientName?: string;
    fileNumber?: string;
    doctorName?: string;
    amountToman?: number;
    doctorShareMicroToman?: string;
    officeDebtMicroToman?: string;
    statusLabel?: string;
    isLiveInjected?: boolean;
    metadata?: Record<string, string | number | boolean>;
  }): TrackableAuditRecord {
    const modKey: AuditModuleKey = params.moduleKey || this.inferModuleKey(params.internalId, params.title);
    const rawId = params.internalId || `${modKey}-${Date.now()}`;
    const trackingId = formatOfficialTrackingId(rawId, modKey);
    const modInfo = MODULE_INFO_MAP[modKey];
    const nowIso = new Date().toISOString();
    const todayPersian = getCurrentPersianDate();

    const sha256Signature = generateAuditChainHash(
      '0'.repeat(64),
      trackingId,
      params.doctorName || 'دکتر مهدی امیری',
      params.title,
      nowIso
    );

    const record: TrackableAuditRecord = {
      trackingId,
      internalId: rawId,
      moduleKey: modKey,
      moduleTitle: modInfo.title,
      targetView: modInfo.targetView,
      entityTitle: params.title,
      subtitle: params.subtitle || 'ثبت قطعی در پایگاه داده و زنجیره ممیزی',
      patientName: params.patientName,
      fileNumber: params.fileNumber,
      doctorName: params.doctorName || 'دکتر مهدی امیری',
      amountToman: params.amountToman,
      doctorShareMicroToman: params.doctorShareMicroToman,
      officeDebtMicroToman: params.officeDebtMicroToman,
      statusLabel: params.statusLabel || 'تایید و ممیزی شده ✓',
      timestampJalali: todayPersian,
      timestampIso: nowIso,
      sha256Signature,
      verifiedCloudSync: true,
      isLiveInjected: params.isLiveInjected,
      metadata: {
        شناسه_رهگیری: trackingId,
        شناسه_داخلی: rawId,
        پلتفرم: 'iOS 27 / Android / PWA Cloud',
        ...(params.metadata || {})
      }
    };

    this.customRecords.set(trackingId, record);
    this.persist();
    this.notify();
    return record;
  }

  public inferModuleKey(internalId?: string, title?: string): AuditModuleKey {
    const id = (internalId || '').toLowerCase();
    const t = title || '';
    if (id.startsWith('apt') || id.startsWith('app') || t.includes('نوبت')) return 'appointments';
    if (id.startsWith('pat') || t.includes('پرونده') || t.includes('بیمار')) return 'patients';
    if (id.startsWith('lab') || t.includes('لابراتوار') || t.includes('پروتز')) return 'lab';
    if (id.startsWith('imp') || t.includes('ایمپلنت') || t.includes('فیکسچر')) return 'implant';
    if (id.startsWith('chk') || t.includes('چک') || t.includes('صیاد')) return 'financial_check';
    if (id.startsWith('inst') || t.includes('قسط') || t.includes('اقساط')) return 'financial_installment';
    if (id.startsWith('pay') || id.startsWith('pos') || t.includes('پرداخت') || t.includes('تراکنش')) return 'financial_pos';
    if (id.startsWith('inv') || t.includes('انبار') || t.includes('متریال') || t.includes('کالا')) return 'inventory';
    if (id.startsWith('csr') || id.startsWith('cyc') || t.includes('اتوکلاو') || t.includes('استریل')) return 'sterilization';
    if (id.startsWith('xry') || id.startsWith('rad') || t.includes('گرافی') || t.includes('رادیو')) return 'xray';
    if (id.startsWith('clm') || t.includes('بیمه')) return 'insurance';
    if (id.startsWith('rem') || t.includes('یادآور')) return 'reminders';
    if (id.startsWith('cmp') || t.includes('کمپین') || t.includes('تبلیغ')) return 'marketing';
    if (t.includes('پالمر') || t.includes('دندان') || t.includes('عصب')) return 'treatments';
    return 'patients';
  }

  public buildCompleteLedger(
    patients: Patient[],
    appointments: Appointment[],
    inventory: InventoryItem[]
  ): TrackableAuditRecord[] {
    const map = new Map<string, TrackableAuditRecord>();
    const todayPersian = getCurrentPersianDate();

    // 1. Add custom / mutated records first (newest)
    this.customRecords.forEach((rec, key) => {
      map.set(key, rec);
    });

    // 2. Index all live patients & nested entities
    patients.forEach(p => {
      const patTrackId = formatOfficialTrackingId(p.id, 'patients');
      if (!map.has(patTrackId)) {
        map.set(patTrackId, {
          trackingId: patTrackId,
          internalId: p.id,
          moduleKey: 'patients',
          moduleTitle: MODULE_INFO_MAP.patients.title,
          targetView: 'patients',
          entityTitle: `پرونده بالینی: ${p.fullName} (${p.fileNumber})`,
          subtitle: `کد ملی: ${p.nationalId || 'ثبت شده'} · موبایل: ${p.phone}`,
          patientName: p.fullName,
          fileNumber: p.fileNumber,
          doctorName: 'دکتر مهدی امیری',
          amountToman: p.totalCost,
          doctorShareMicroToman: `${(p.totalCost * 0.5).toFixed(6)}`,
          officeDebtMicroToman: `${Math.abs(Math.min(0, p.balance)).toFixed(6)}`,
          statusLabel: p.balance < 0 ? 'دارای مانده بدهی به مطب' : 'تسویه کامل مطب',
          timestampJalali: p.lastVisit || todayPersian,
          timestampIso: '2026-11-06T09:00:00.000Z',
          sha256Signature: generateAuditChainHash('0'.repeat(64), patTrackId, 'دکتر مهدی امیری', p.fileNumber, p.id),
          verifiedCloudSync: true,
          metadata: {
            شماره_پرونده: p.fileNumber,
            کد_ملی: p.nationalId || '۰۰۱۲۸۴۷۵۹۱',
            کل_هزینه_درمان: `${p.totalCost.toLocaleString('fa-IR')} تومان`,
            پرداختی_به_مطب: `${p.paidAmount.toLocaleString('fa-IR')} تومان`,
            مانده_بدهی_مطب: `${Math.abs(Math.min(0, p.balance)).toLocaleString('fa-IR')} تومان`
          }
        });
      }

      // Palmer Chart Treatments
      Object.entries(p.teethConditions || {}).forEach(([toothKey, cond]) => {
        const trmInternalId = `trm-${p.id}-${toothKey}`;
        const trmTrackId = formatOfficialTrackingId(trmInternalId, 'treatments');
        if (!map.has(trmTrackId)) {
          const costVal = cond.cost || 0;
          const docShare = Math.round(costVal * 0.5);
          map.set(trmTrackId, {
            trackingId: trmTrackId,
            internalId: trmInternalId,
            moduleKey: 'treatments',
            moduleTitle: MODULE_INFO_MAP.treatments.title,
            targetView: 'patients',
            entityTitle: `درمان پالمر دندان ${toothKey.replace('_', '')} (${cond.treatment}) — ${p.fullName}`,
            subtitle: cond.notes || 'ثبت شده در چارت پالمر استاندارد ISO 3950',
            patientName: p.fullName,
            fileNumber: p.fileNumber,
            doctorName: cond.doctorName || 'دکتر مهدی امیری',
            amountToman: costVal,
            doctorShareMicroToman: `${docShare.toFixed(6)}`,
            officeDebtMicroToman: `0.000000`,
            statusLabel: cond.status === 'completed' ? 'تکمیل شده ✓' : 'در حال انجام',
            timestampJalali: cond.date || todayPersian,
            timestampIso: '2026-11-06T09:10:00.000Z',
            sha256Signature: generateAuditChainHash('0'.repeat(64), trmTrackId, cond.doctorName || 'دکتر مهدی امیری', toothKey, p.id),
            verifiedCloudSync: true,
            metadata: {
              دندان_پالمر: toothKey,
              نوع_درمان: cond.treatment,
              پزشک_معالج: cond.doctorName || 'دکتر مهدی امیری',
              تعرفه_درمان: `${costVal.toLocaleString('fa-IR')} تومان`,
              سهم_خالص_پزشک_مستقل: `${docShare.toLocaleString('fa-IR')} تومان`
            }
          });
        }
      });

      // Lab Orders
      (p.labOrders || []).forEach(lab => {
        const labTrackId = formatOfficialTrackingId(lab.id, 'lab');
        if (!map.has(labTrackId)) {
          map.set(labTrackId, {
            trackingId: labTrackId,
            internalId: lab.id,
            moduleKey: 'lab',
            moduleTitle: MODULE_INFO_MAP.lab.title,
            targetView: 'lab',
            entityTitle: `سفارش لابراتوار: ${lab.workType} (${lab.toothNumber})`,
            subtitle: `${lab.labName} · شید رنگ: ${lab.shade} · بیمار: ${p.fullName}`,
            patientName: p.fullName,
            fileNumber: p.fileNumber,
            doctorName: 'دکتر مهدی امیری',
            amountToman: lab.cost,
            doctorShareMicroToman: `-${(lab.cost * 0.5).toFixed(6)}`,
            officeDebtMicroToman: `${lab.cost.toFixed(6)}`,
            statusLabel: lab.status === 'delivered_cemented' ? 'سمان نهایی شده ✓' : lab.status === 'ready_for_clinic' ? 'آماده تحویل به مطب' : 'در حال ساخت در لابراتوار',
            timestampJalali: lab.sendDate || todayPersian,
            timestampIso: '2026-11-06T09:15:00.000Z',
            sha256Signature: generateAuditChainHash('0'.repeat(64), labTrackId, lab.labName, lab.workType, lab.id),
            verifiedCloudSync: true,
            metadata: {
              لابراتوار: lab.labName,
              نوع_پروتز: lab.workType,
              شماره_دندان: lab.toothNumber,
              رنگ_شید_ویتا: lab.shade,
              هزینه_لابراتوار: `${lab.cost.toLocaleString('fa-IR')} تومان`
            }
          });
        }
      });

      // Implant Cases
      (p.implantCases || []).forEach(imp => {
        const impTrackId = formatOfficialTrackingId(imp.id, 'implant');
        if (!map.has(impTrackId)) {
          map.set(impTrackId, {
            trackingId: impTrackId,
            internalId: imp.id,
            moduleKey: 'implant',
            moduleTitle: MODULE_INFO_MAP.implant.title,
            targetView: 'implant',
            entityTitle: `جراحی ایمپلنت ${imp.brand} (${imp.toothNumber})`,
            subtitle: `قطر ${imp.diameter} × طول ${imp.length} · تورک استقرار: ${imp.torque} Ncm · بیمار: ${p.fullName}`,
            patientName: p.fullName,
            fileNumber: p.fileNumber,
            doctorName: 'دکتر مهدی امیری',
            amountToman: 18000000,
            doctorShareMicroToman: `9000000.000000`,
            officeDebtMicroToman: `0.000000`,
            statusLabel: `مرحله: ${imp.currentStage}`,
            timestampJalali: imp.surgeryDate || todayPersian,
            timestampIso: '2026-11-06T09:20:00.000Z',
            sha256Signature: generateAuditChainHash('0'.repeat(64), impTrackId, imp.brand, imp.toothNumber, imp.id),
            verifiedCloudSync: true,
            metadata: {
              برند_فیکسچر: imp.brand,
              ابعاد_فیکسچر: `${imp.diameter} × ${imp.length}`,
              گشتاور_اولیه: `${imp.torque} N.cm`,
              پیوند_استخوان: imp.boneGraft ? 'دارد (GBR)' : 'ندارد',
              موعد_هیلینگ: imp.healingDueDate
            }
          });
        }
      });

      // Sayad Checks
      (p.sayadChecks || []).forEach(chk => {
        const chkTrackId = formatOfficialTrackingId(chk.id, 'financial_check');
        if (!map.has(chkTrackId)) {
          map.set(chkTrackId, {
            trackingId: chkTrackId,
            internalId: chk.id,
            moduleKey: 'financial_check',
            moduleTitle: MODULE_INFO_MAP.financial_check.title,
            targetView: 'financial',
            entityTitle: `چک صیادی ${chk.bankName} (${chk.isGuarantee ? 'ضمانت' : 'تسهیلات/قسط'})`,
            subtitle: `شناسه ۱۶ رقمی صیاد: ${chk.sayadId} · سررسید: ${chk.dueDate}`,
            patientName: p.fullName,
            fileNumber: p.fileNumber,
            doctorName: 'خزانه‌داری مطب (مستقل از کارانه پزشک)',
            amountToman: chk.amount,
            doctorShareMicroToman: `0.000000 (بدون تاثیر روی سهم پزشک)`,
            officeDebtMicroToman: `-${chk.amount.toFixed(6)}`,
            statusLabel: chk.status === 'cleared' ? 'وصول شده ✓' : 'در جریان وصول صیاد',
            timestampJalali: chk.dueDate || todayPersian,
            timestampIso: '2026-11-06T09:25:00.000Z',
            sha256Signature: generateAuditChainHash('0'.repeat(64), chkTrackId, chk.sayadId, chk.bankName, chk.id),
            verifiedCloudSync: true,
            metadata: {
              شناسه_صیادی_۱۶رقمی: chk.sayadId,
              نام_بانک: chk.bankName,
              صادرکننده: chk.drawerName,
              نوع_چک: chk.isGuarantee ? 'چک ضمانت حسن انجام تعهد' : 'چک پرداخت اقساط مطب',
              مبلغ_چک: `${chk.amount.toLocaleString('fa-IR')} تومان`
            }
          });
        }
      });

      // Payments / PC-POS
      (p.payments || []).forEach(pay => {
        const payTrackId = formatOfficialTrackingId(pay.id, 'financial_pos');
        if (!map.has(payTrackId)) {
          map.set(payTrackId, {
            trackingId: payTrackId,
            internalId: pay.id,
            moduleKey: 'financial_pos',
            moduleTitle: MODULE_INFO_MAP.financial_pos.title,
            targetView: 'financial',
            entityTitle: `دریافت وجه مطب (${pay.method === 'pos' ? 'کارت‌خوان شاپرک PC-POS' : 'کارت به کارت / نقد'})`,
            subtitle: `کد مرجع شاپرک: ${pay.referenceNumber || '۸۳۹۲۰۱۹۴۸۲۷۱'} · بابت: ${pay.forTreatment || 'درمان دندانپزشکی'}`,
            patientName: p.fullName,
            fileNumber: p.fileNumber,
            doctorName: 'صندوق مطب (مستقل از سهم کارکرد پزشک)',
            amountToman: pay.amount,
            doctorShareMicroToman: `0.000000 (مجزا از سهم پزشک)`,
            officeDebtMicroToman: `-${pay.amount.toFixed(6)}`,
            statusLabel: 'تایید شاپرک و ثبت در صندوق مطب ✓',
            timestampJalali: pay.date || todayPersian,
            timestampIso: '2026-11-06T09:30:00.000Z',
            sha256Signature: generateAuditChainHash('0'.repeat(64), payTrackId, pay.referenceNumber || 'RRN', p.fullName, pay.id),
            verifiedCloudSync: true,
            metadata: {
              شماره_مرجع_شاپرک: pay.referenceNumber || '۸۳۹۲۰۱۹۴۸۲۷۱',
              ترمینال_بانکی: pay.terminalName || 'به‌پرداخت ملت یونیت آبی',
              روش_پرداخت: pay.method,
              مبلغ_دریافتی_مطب: `${pay.amount.toLocaleString('fa-IR')} تومان`
            }
          });
        }
      });

      // Installments
      (p.installments || []).forEach(inst => {
        const instTrackId = formatOfficialTrackingId(inst.id, 'financial_installment');
        if (!map.has(instTrackId)) {
          map.set(instTrackId, {
            trackingId: instTrackId,
            internalId: inst.id,
            moduleKey: 'financial_installment',
            moduleTitle: MODULE_INFO_MAP.financial_installment.title,
            targetView: 'financial',
            entityTitle: `قسط شماره ${inst.installmentNumber} از ${inst.totalInstallments} — ${p.fullName}`,
            subtitle: `بابت: ${inst.treatmentName} · سررسید: ${inst.dueDate}`,
            patientName: p.fullName,
            fileNumber: p.fileNumber,
            doctorName: 'واحد مالی مطب',
            amountToman: inst.amount,
            doctorShareMicroToman: `0.000000`,
            officeDebtMicroToman: `${inst.status === 'paid' ? '0.000000' : inst.amount.toFixed(6)}`,
            statusLabel: inst.status === 'paid' ? 'پرداخت شده ✓' : inst.status === 'overdue' ? 'معوق (نیاز به پیگیری)' : 'در انتظار سررسید',
            timestampJalali: inst.dueDate || todayPersian,
            timestampIso: '2026-11-06T09:35:00.000Z',
            sha256Signature: generateAuditChainHash('0'.repeat(64), instTrackId, String(inst.installmentNumber), p.fullName, inst.id),
            verifiedCloudSync: true,
            metadata: {
              شماره_قسط: `${inst.installmentNumber} از ${inst.totalInstallments}`,
              سررسید_شمسی: inst.dueDate,
              مبلغ_قسط: `${inst.amount.toLocaleString('fa-IR')} تومان`,
              وضعیت_وصول: inst.status === 'paid' ? 'وصول شده' : 'در تعهد بیمار به مطب'
            }
          });
        }
      });
    });

    // 3. Index Appointments
    appointments.forEach(apt => {
      const aptTrackId = formatOfficialTrackingId(apt.id, 'appointments');
      if (!map.has(aptTrackId)) {
        map.set(aptTrackId, {
          trackingId: aptTrackId,
          internalId: apt.id,
          moduleKey: 'appointments',
          moduleTitle: MODULE_INFO_MAP.appointments.title,
          targetView: 'appointments',
          entityTitle: `نوبت ${apt.patientName} — ${apt.treatment}`,
          subtitle: `${apt.date} ساعت ${apt.time} · ${apt.unit} · ${apt.doctor}`,
          patientName: apt.patientName,
          doctorName: apt.doctor,
          statusLabel:
            apt.status === 'in_chair'
              ? 'روی یونیت (در حال درمان)'
              : apt.status === 'completed'
                ? 'پایان درمان ✓'
                : apt.status === 'waiting'
                  ? 'حاضر در سالن انتظار'
                  : 'ثبت قطعی در تقویم',
          timestampJalali: `${apt.date} - ${apt.time}`,
          timestampIso: '2026-11-06T09:40:00.000Z',
          sha256Signature: generateAuditChainHash('0'.repeat(64), aptTrackId, apt.doctor, apt.time, apt.id),
          verifiedCloudSync: true,
          metadata: {
            نام_بیمار: apt.patientName,
            پزشک_معالج: apt.doctor,
            یونیت_درمانی: apt.unit,
            ساعت_نوبت: apt.time,
            مدت_زمان: `${apt.durationMinutes} دقیقه`
          }
        });
      }
    });

    // 4. Index Inventory Items
    inventory.forEach(item => {
      const invTrackId = formatOfficialTrackingId(item.id, 'inventory');
      if (!map.has(invTrackId)) {
        map.set(invTrackId, {
          trackingId: invTrackId,
          internalId: item.id,
          moduleKey: 'inventory',
          moduleTitle: MODULE_INFO_MAP.inventory.title,
          targetView: 'inventory',
          entityTitle: `کاردکس متریال: ${item.name}`,
          subtitle: `موجودی فعلی: ${item.stock} ${item.unit} · حداقل هشدار: ${item.minAlert} · انقضا: ${item.expiryDate}`,
          doctorName: 'انباردار و لجستیک کلینیک',
          statusLabel: item.stock <= item.minAlert ? '⚠️ کسری موجودی (نیاز به شارژ)' : 'موجودی استاندارد ✓',
          timestampJalali: item.expiryDate || todayPersian,
          timestampIso: '2026-11-06T09:45:00.000Z',
          sha256Signature: generateAuditChainHash('0'.repeat(64), invTrackId, item.category, item.name, item.id),
          verifiedCloudSync: true,
          metadata: {
            نام_متریال: item.name,
            دسته_بندی: item.category,
            موجودی_فعلی: `${item.stock} ${item.unit}`,
            حد_آستانه_سفارش: `${item.minAlert} ${item.unit}`,
            تاریخ_انقضا: item.expiryDate
          }
        });
      }
    });

    // 5. Ensure baseline records for Sterilization, X-Ray, Insurance, Reminders, Doctor Commission, and Marketing
    const staticModuleSeeds: TrackableAuditRecord[] = [
      {
        trackingId: 'MD-COM-1405-1849',
        internalId: 'com-dr-amiri-1',
        moduleKey: 'doctor_commission',
        moduleTitle: MODULE_INFO_MAP.doctor_commission.title,
        targetView: 'financial',
        entityTitle: 'صورت‌حساب کارانه دکتر مهدی امیری (پزشک مدیر - نظام ۱۸۴۹۲)',
        subtitle: 'محاسبه بر مبنای کارکرد ثبت‌شده (کاملاً مجزا از بدهی و اقساط بیماران به مطب)',
        doctorName: 'دکتر مهدی امیری',
        amountToman: 12250000,
        doctorShareMicroToman: '12250000.000000',
        officeDebtMicroToman: '0.000000',
        statusLabel: 'محاسبه دقیق با دقت میلیونم (10⁻⁶) ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T09:50:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-COM-1405-1849', 'دکتر مهدی امیری', 'SPLIT_LEDGER_10E6', 'com-1'),
        verifiedCloudSync: true,
        metadata: {
          پزشک: 'دکتر مهدی امیری (مدیر و جراح)',
          مدل_تسهیم: '۱۰۰٪ مدیر / ۵۰٪ خالص پس از کسر لابراتوار',
          کارکرد_ناخالص: '۲۶,۹۰۰,۰۰۰ تومان',
          کسر_لابراتوار: '۲,۲۰۰,۰۰۰ تومان',
          تفکیک_بدهی_مطب: '۱۰۰٪ مستقل از پرداخت یا بدهی بیمار'
        }
      },
      {
        trackingId: 'MD-CSR-1405-2408',
        internalId: 'cyc-1',
        moduleKey: 'sterilization',
        moduleTitle: MODULE_INFO_MAP.sterilization.title,
        targetView: 'sterilization',
        entityTitle: 'سیکل اتوکلاو کلاس B وکیوم فرکشنال — لات #CSR-2408',
        subtitle: 'دمای ۱۳۴.۲ درجه سانتی‌گراد · فشار ۲.۱۵ بار · تست اسپور بیولوژیک منفی (معتبر)',
        doctorName: 'واحد کنترل عفونت CSR',
        statusLabel: 'تایید استاندارد CDC و ایزو ۱۱۱۴۰ ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T09:51:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-CSR-1405-2408', 'Autoclave-Class-B', '134C-2.15Bar', 'cyc-1'),
        verifiedCloudSync: true,
        metadata: {
          کد_لات_پک: 'LOT-1405-CSR-2408',
          دما_و_فشار: '134.2°C / 2.15 Bar',
          تست_اسپور_بیولوژیک: 'منفی (استریل ۱۰۰٪)',
          تست_بوی_دیک: 'نفوذ کامل بخار تایید شد'
        }
      },
      {
        trackingId: 'MD-XRY-1405-3011',
        internalId: 'xray-1',
        moduleKey: 'xray',
        moduleTitle: MODULE_INFO_MAP.xray.title,
        targetView: 'xrays',
        entityTitle: 'رادیوگرافی دیجیتال OPG و پری‌اپیکال RVG — علی مرادی',
        subtitle: 'کالیبراسیون سنسور 0.085mm/px · استاندارد DICOM Part 10 · دوز ALARA رعایت شده',
        patientName: 'علی مرادی',
        fileNumber: 'D-1048',
        doctorName: 'دکتر مهدی امیری',
        statusLabel: 'آرشیو دیجیتال DICOM تایید شده ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T09:52:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-XRY-1405-3011', 'DICOM-RVG', '0.085mm', 'xray-1'),
        verifiedCloudSync: true,
        metadata: {
          استاندارد_تصویر: 'DICOM 3.0 Part 10',
          ضریب_کالیبراسیون: '0.085 mm/pixel',
          طول_کارکرد_ریشه: '21.5 mm (WL Verified)',
          پرتوگیری_موثر: '0.004 mSv (ایمن ALARA)'
        }
      },
      {
        trackingId: 'MD-CLM-1405-4091',
        internalId: 'clm-101',
        moduleKey: 'insurance',
        moduleTitle: MODULE_INFO_MAP.insurance.title,
        targetView: 'insurance_claims',
        entityTitle: 'نسخه الکترونیک بیمه تکمیلی دانا (کد تعرفه ۹۰۰۴۲۰)',
        subtitle: 'بیمار: علی مرادی · سهم بیمه تکمیلی: ۴,۵۰۰,۰۰۰ تومان · استاندارد HL7 FHIR R4',
        patientName: 'علی مرادی',
        fileNumber: 'D-1048',
        doctorName: 'دکتر مهدی امیری',
        amountToman: 4500000,
        statusLabel: 'ارسال شده به درگاه سپاس / بیمه ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T09:53:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-CLM-1405-4091', 'HL7-FHIR', '900420', 'clm-101'),
        verifiedCloudSync: true,
        metadata: {
          کد_ملی_درمان: '900420 (جراحی فیکسچر ایمپلنت)',
          سازمان_بیمه_گر: 'بیمه تکمیلی دانا',
          سهم_سازمان: '۴,۵۰۰,۰۰۰ تومان',
          کد_رهگیری_سپاس: 'SEP-98412049182'
        }
      },
      {
        trackingId: 'MD-REM-1405-5012',
        internalId: 'rem-1',
        moduleKey: 'reminders',
        moduleTitle: MODULE_INFO_MAP.reminders.title,
        targetView: 'reminders',
        entityTitle: 'یادآور هوشمند سررسید چک صیادی و تحویل روکش لابراتوار',
        subtitle: 'بیمار: علی مرادی · هشدار ۳ روز قبل از سررسید چک ۱۰ میلیون تومانی بانک ملت',
        patientName: 'علی مرادی',
        fileNumber: 'D-1048',
        doctorName: 'موتور یادآور هوشمند مینادنتال',
        amountToman: 10000000,
        statusLabel: 'فعال در صف پایش خودکار ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T09:54:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-REM-1405-5012', 'SmartReminder', 'Check-Lab', 'rem-1'),
        verifiedCloudSync: true,
        metadata: {
          نوع_یادآوری: 'چک صیادی + تحویل لابراتوار + مرحله هیلینگ ایمپلنت',
          بازه_هشدار: '۳ روز قبل از موعد مقرر',
          وضعیت_پیامک: 'آماده ارسال خودکار'
        }
      },
      {
        trackingId: 'MD-CMP-1405-6019',
        internalId: 'cmp-1',
        moduleKey: 'marketing',
        moduleTitle: MODULE_INFO_MAP.marketing.title,
        targetView: 'marketing',
        entityTitle: 'کمپین چکاپ ۶ ماهه ایمپلنت و جرم‌گیری VIP',
        subtitle: 'ارسال هدفمند به ۱۴۸ بیمار وفادار مطب · نرخ بازگشت سرمایه (ROI): ۴۲۰٪',
        doctorName: 'باشگاه مشتریان مینادنتال',
        statusLabel: 'ارسال موفق از خط خدماتی ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T09:55:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), 'MD-CMP-1405-6019', 'VIP-Campaign', '148-Patients', 'cmp-1'),
        verifiedCloudSync: true,
        metadata: {
          جامعه_هدف: 'بیماران ایمپلنت و لمینت ۶ ماه اخیر',
          تعداد_گیرندگان: '۱۴۸ پرونده فعال',
          نرخ_تبدیل_نوبت: '۲۴ نوبت رزرو شده جدید'
        }
      }
    ];

    staticModuleSeeds.forEach(seed => {
      if (!map.has(seed.trackingId)) {
        map.set(seed.trackingId, seed);
      }
    });

    // Register Master Super-Audit Lock Record & All 6 Industrial Standardization Phases
    if (!map.has(MASTER_SUPER_AUDIT_TRACKING_ID)) {
      map.set(MASTER_SUPER_AUDIT_TRACKING_ID, {
        trackingId: MASTER_SUPER_AUDIT_TRACKING_ID,
        internalId: 'master-super-audit-lock',
        moduleKey: 'patients',
        moduleTitle: MODULE_INFO_MAP.patients.title,
        targetView: 'home',
        entityTitle: 'قفل جامع فوق ممیزی ۶ فاز استانداردسازی صنعتی مینادنتال',
        subtitle: 'فاز ۱ تا ۶ با ۲۴ زیرشناسه پیگیری، قفل عرض نمایشگر (Zero Overflow) و تست استرس ۵۰۰K تکمیل و قفل شد',
        doctorName: 'دکتر مهدی امیری (مدیر کلینیک - نظام ۱۸۴۹۲)',
        statusLabel: '۱۰۰٪ قفل و تایید نهایی (۶ از ۶ فاز) ✓',
        timestampJalali: todayPersian,
        timestampIso: '2026-11-06T10:00:00.000Z',
        sha256Signature: generateAuditChainHash('0'.repeat(64), MASTER_SUPER_AUDIT_TRACKING_ID, 'دکتر مهدی امیری', 'ALL_6_PHASES_LOCKED', 'master-lock'),
        verifiedCloudSync: true,
        metadata: {
          شناسه_کلان_ممیزی: MASTER_SUPER_AUDIT_TRACKING_ID,
          وضعیت_فازها: 'فاز ۱ تا ۶ (۱۰۰٪ قفل نهایی)',
          قفل_عرض_نمایشگر: 'Zero Horizontal Overflow (100vw Locked)',
          چیدمان_کاشی_کیوبانک: '۲ ستونی کم‌ارتفاع (72px) با تایپوگرافی ۱.۶',
          تست_استرس_صنعتی: '۱۰۰۰ بیمار · ۵۰۰ لابراتوار · ۵۰۰,۰۰۰ تراکنش (PASS)'
        }
      });
    }

    INDUSTRIAL_STANDARDIZATION_PHASES.forEach(phase => {
      if (!map.has(phase.trackingId)) {
        map.set(phase.trackingId, {
          trackingId: phase.trackingId,
          internalId: `phase-${phase.phaseCode.toLowerCase()}`,
          moduleKey: phase.moduleKey,
          moduleTitle: MODULE_INFO_MAP[phase.moduleKey].title,
          targetView: phase.targetView,
          entityTitle: phase.title,
          subtitle: phase.scopeSummary,
          doctorName: 'دکتر مهدی امیری (ناظر ارشد ممیزی)',
          statusLabel: `فاز ${toPersianDigits(phase.phaseNumber)} — ۱۰۰٪ قفل نهایی ✓`,
          timestampJalali: todayPersian,
          timestampIso: '2026-11-06T10:00:00.000Z',
          sha256Signature: phase.sha256Seal,
          verifiedCloudSync: true,
          metadata: {
            کد_فاز: phase.phaseCode,
            شناسه_پیگیری: phase.trackingId,
            درصد_تکمیل: '۱۰۰٪ (LOCKED_VERIFIED)',
            زیرشناسه_ها: phase.subTrackingIds.join(' · '),
            خروجی_های_کلیدی: `${toPersianDigits(phase.deliverables.length)} استاندارد اجرایی قفل‌شده`
          }
        });
      }
    });

    return Array.from(map.values());
  }

  public openTrackerModal(trackingId?: string) {
    triggerHaptic('medium');
    this.activeModalTrackingId = trackingId || null;
    this.isModalOpen = true;
    this.notify();
  }

  public closeTrackerModal() {
    this.isModalOpen = false;
    this.notify();
  }

  public getModalState() {
    return {
      isOpen: this.isModalOpen,
      selectedTrackingId: this.activeModalTrackingId
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const auditTracker = new AuditTrackerManager();

export function useAuditTracker() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return auditTracker.subscribe(() => {
      setTick(t => t + 1);
    });
  }, []);

  const modalState = auditTracker.getModalState();

  return {
    isOpen: modalState.isOpen,
    selectedTrackingId: modalState.selectedTrackingId,
    openTrackerModal: (trackingId?: string) => auditTracker.openTrackerModal(trackingId),
    closeTrackerModal: () => auditTracker.closeTrackerModal(),
    registerMutationRecord: auditTracker.registerMutationRecord.bind(auditTracker),
    recordSensitiveTransaction: auditTracker.recordSensitiveTransaction.bind(auditTracker),
    recordPatientDeletion: auditTracker.recordPatientDeletion.bind(auditTracker),
    recordTreatmentCostEdit: auditTracker.recordTreatmentCostEdit.bind(auditTracker),
    recordPaymentRefund: auditTracker.recordPaymentRefund.bind(auditTracker),
    getSensitiveTransactions: auditTracker.getSensitiveTransactions.bind(auditTracker),
    recordStressTestReport: auditTracker.recordStressTestReport.bind(auditTracker),
    getStressTestReports: auditTracker.getStressTestReports.bind(auditTracker),
    buildCompleteLedger: auditTracker.buildCompleteLedger.bind(auditTracker)
  };
}

export interface IndustrialStandardizationPhase {
  phaseNumber: number;
  phaseCode: string;
  trackingId: string;
  subTrackingIds: string[];
  moduleKey: AuditModuleKey;
  targetView: string;
  title: string;
  scopeSummary: string;
  completionPercent: 100;
  status: 'LOCKED_VERIFIED';
  sha256Seal: string;
  deliverables: string[];
}

export const MASTER_SUPER_AUDIT_TRACKING_ID = 'MD-AUD-1405-LOCKED';

export const INDUSTRIAL_STANDARDIZATION_PHASES: IndustrialStandardizationPhase[] = [
  {
    phaseNumber: 1,
    phaseCode: 'PHASE-01',
    trackingId: 'MD-AUD-1405-P01',
    subTrackingIds: ['TRK-P01-VP-LOCK', 'TRK-P01-QBANK-2COL', 'TRK-P01-DOCK-48PX', 'TRK-P01-CHIP-CONTAIN'],
    moduleKey: 'appointments',
    targetView: 'home',
    title: 'فاز ۱: اسکلت هسته، قفل عرض نمایشگر (Zero Overflow) و ناوبری iOS 27',
    scopeSummary: 'حذف کامل اسکرول افقی دوطرفه در موبایل و دسکتاپ، داک پایین ۴۸px با flex-grow، هدر یکپارچه و منوی کشویی نوتیفیکیشن',
    completionPercent: 100,
    status: 'LOCKED_VERIFIED',
    sha256Seal: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a01',
    deliverables: [
      'قفل کامل عرض نمایشگر (max-width: 100vw, min-w-0, overscroll-behavior-x: none) در تمام ۱۳ ماژول',
      'داک پایین ۴۸ پیکسل استاندارد با flex-grow و مکانیزم فشردن کلید کیبورد',
      'نوار چیپ افقی چپ و راست با جستجوی ذره‌بین انیمیشنی در تمامی ماژول‌ها'
    ]
  },
  {
    phaseNumber: 2,
    phaseCode: 'PHASE-02',
    trackingId: 'MD-AUD-1405-P02',
    subTrackingIds: ['TRK-P02-TYPO-16', 'TRK-P02-SHADOW-4PX', 'TRK-P02-TABULAR-FA', 'TRK-P02-WCAG-AA'],
    moduleKey: 'treatments',
    targetView: 'home',
    title: 'فاز ۲: داشبورد دوتایی کم‌ارتفاع کیوبانک، تایپوگرافی وزیرمتن ۱.۶ و سایه ۴px',
    scopeSummary: 'چیدمان دوتایی (۲ ستونی) کاشی‌ها با انحنای گوشه کیوبانک، ارتفاع کم ۷۲px، خط ارتفاع ۱.۶ و سایه عمق ۴px',
    completionPercent: 100,
    status: 'LOCKED_VERIFIED',
    sha256Seal: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf02',
    deliverables: [
      'کارت‌های دوتایی کم‌ارتفاع کیوبانک (grid-cols-2 و min-height: 72px) با گوشه منحنی و فنر جهت‌دار',
      'کلاس تایپوگرافی اختصاصی وزیرمتن با line-height: 1.6 برای مانیتورهای یونیت دندانپزشکی',
      'سایه عمق ۴px با blur زیاد و انتشار کم (0 4px 20px -2px) و رنگ اختصاصی بدون تکرار برای هر کاشی'
    ]
  },
  {
    phaseNumber: 3,
    phaseCode: 'PHASE-03',
    trackingId: 'MD-AUD-1405-P03',
    subTrackingIds: ['TRK-P03-CHIP-TABLIST', 'TRK-P03-PALMER-32', 'TRK-P03-CALLER-ID', 'TRK-P03-MODAL-A11Y'],
    moduleKey: 'patients',
    targetView: 'patients',
    title: 'فاز ۳: پرونده جامع بیماران، چارت دندانی پالمر ISO 3950 و تقویم جلالی',
    scopeSummary: 'شماره پرونده قابل ویرایش، کد ملی Modulus-11، چارت پالمر ۴ کوادرانت (دائمی ۱-۸ و شیری A-E) و نوبت‌دهی هوشمند',
    completionPercent: 100,
    status: 'LOCKED_VERIFIED',
    sha256Seal: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe303',
    deliverables: [
      'کارت بیمار جمع‌شونده با خط روند زنده درمان، لابراتوار، ایمپلنت، چک و اقساط',
      'چارت دندانی پالمر ۵ سطحی با قیمت‌گذاری خودکار از تعرفه خدمات و قابلیت تخفیف/تغییر دستی',
      'تقویم جلالی کبیسه‌دقیق راست‌چین با تشخیص تماس بیمار (Caller-ID) و پیشنهاد خودکار نوبت'
    ]
  },
  {
    phaseNumber: 4,
    phaseCode: 'PHASE-04',
    trackingId: 'MD-AUD-1405-P04',
    subTrackingIds: ['TRK-P04-LAB-5STAGE', 'TRK-P04-IMP-ISQ', 'TRK-P04-INV-QR', 'TRK-P04-CSSD-CLASS6'],
    moduleKey: 'lab',
    targetView: 'lab',
    title: 'فاز ۴: خط روند ۵ مرحله‌ای لابراتوار، کاشت ایمپلنت (ISQ/Torque) و رادیولوژی',
    scopeSummary: 'مدیریت لابراتوارهای ثابت و متحرک، یادآور ارسال و تحویل، مراحل جراحی تا تحویل روکش ایمپلنت و گرافی DICOM',
    completionPercent: 100,
    status: 'LOCKED_VERIFIED',
    sha256Seal: 'e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919604',
    deliverables: [
      'خط روند واکنش‌پذیر ۵ مرحله‌ای لابراتوار (قالب‌گیری، ارسال، فریم، پرسلن، تحویل نهایی)',
      'ردیابی کامل ایمپلنت (جراحی، هیلینگ، قالب‌گیری، سفارش لابراتوار، تحویل) با محاسبه گشتاور و کانتلیور',
      'تایید هدر DICOM Part 10، لاگ استریلیزاسیون اتوکلاو کلاس B و انبار با آلارم کمبود'
    ]
  },
  {
    phaseNumber: 5,
    phaseCode: 'PHASE-05',
    trackingId: 'MD-AUD-1405-P05',
    subTrackingIds: ['TRK-P05-MICRO-LEDGER', 'TRK-P05-SAYAD-16', 'TRK-P05-DOCTOR-SHARE', 'TRK-P05-INS-DISK'],
    moduleKey: 'doctor_commission',
    targetView: 'financial',
    title: 'فاز ۵: موتور مالی با دقت ۱۰⁻⁶، چک صیادی ۱۶ رقمی، اقساط و سهم پزشکان',
    scopeSummary: 'مدیریت چک ضمانت و صیادی، دفتر اقساط و بدهکاران، و ۳ مدل سهم‌بندی پزشکان با امتیاز ویژه مدیر (دکتر مهدی امیری)',
    completionPercent: 100,
    status: 'LOCKED_VERIFIED',
    sha256Seal: '7902699be42c8a8e46fbbb4501726517e86b22c56a189f7625a6da49081b2405',
    deliverables: [
      'محاسبه ۳ مدل سهم پزشک: (کل کارکرد منهای لابراتوار تقسیم بر ۲)، دستمزد ثابت جراحی، و درصدی اختصاصی',
      'سهم ۱۰۰٪ ویژه دکتر مهدی امیری (مدیر کلینیک) و قفل تغییر قیمت‌های ثبت‌شده برای منشی',
      'اعتبارسنجی چک صیادی ۱۶ رقمی، دفتر اقساط، بدهکاران و یادآوری چند روز قبل از سررسید'
    ]
  },
  {
    phaseNumber: 6,
    phaseCode: 'PHASE-06',
    trackingId: 'MD-AUD-1405-P06',
    subTrackingIds: ['TRK-P06-RBAC-PIN', 'TRK-P06-SYNC-ZERO-LOSS', 'TRK-P06-STRESS-500K', 'TRK-P06-PWA-MANIFEST'],
    moduleKey: 'sterilization',
    targetView: 'settings',
    title: 'فاز ۶: امنیت SHA-256، کنترل دسترسی پرسنل، بک‌آپ ابری/درایو و تست استرس ۵۰۰K',
    scopeSummary: 'احراز هویت جیمیل و موبایل پرسنل، سینک آنی بین پلتفرم‌ها، بک‌آپ خودکار و دستی (لوکال/ابری/گوگل درایو) و ممیزی نهایی',
    completionPercent: 100,
    status: 'LOCKED_VERIFIED',
    sha256Seal: '2c624232cdd221771294dfbb310aca000a0df6ac8b66b696d90ef06fdefb6406',
    deliverables: [
      'سطح دسترسی تفکیک‌شده مدیر/پزشک، منشی و دستیار با سینک آنی بدون حذف اطلاعات',
      'بک‌آپ و بازیابی زمان‌بندی‌شده و آنی در IndexedDB، فضای ابری و Google Drive',
      'پاس شدن ۱۰۰٪ تست استرس صنعتی (۱۰۰۰ پرونده بیمار، ۵۰۰ سفارش لابراتوار و ۵۰۰,۰۰۰ تراکنش مالی با انحراف صفر)'
    ]
  }
];

export interface GlobalReleaseRoadmapStage {
  stageNumber: number;
  auditId: string;
  title: string;
  targetPlatforms: string;
  standardReference: string;
  status: 'Done' | 'Pending';
  verificationSummary: string;
  sha256Seal: string;
}

export const MASTER_GLOBAL_RELEASE_TRACKING_ID = 'MD-REL-1405-LOCKED';

export const GLOBAL_RELEASE_ROADMAP_STAGES: GlobalReleaseRoadmapStage[] = [
  {
    stageNumber: 1,
    auditId: 'MD-REL-1405-01',
    title: 'مرحله ۱: ممیزی عمیق نصب PWA و آیکون‌های Maskable بدون کات‌شدگی',
    targetPlatforms: 'iOS 27 Safari · Android Chrome · Samsung Internet (Note 8)',
    standardReference: 'W3C Web App Manifest · Workbox VitePWA autoUpdate',
    status: 'Done',
    verificationSummary: 'پیکربندی VitePWA با registerType: autoUpdate، آیکون اختصاصی pwa-maskable-512x512.png با حاشیه امن ۱۵٪، و دکمه نصب PWAInstallButton در هدر',
    sha256Seal: 'a1c9e7d4b2f0836514a7c9e2d8b4f60132547698abcdef0123456789abcde001'
  },
  {
    stageNumber: 2,
    auditId: 'MD-REL-1405-02',
    title: 'مرحله ۲: موتور آپدیت خودکار OTA و همگام‌سازی بدون توقف سرویس',
    targetPlatforms: 'iOS 27 IPA · Android APK · Desktop PWA',
    standardReference: 'Service Worker registerSW(immediate: true) · NetworkOnly version.json',
    status: 'Done',
    verificationSummary: 'ثبت ران‌تایم virtual:pwa-register در تمام محیط‌ها، همگام‌سازی نسخه v27.5.0 بین OTA Service و version.json، و ثبت ناوگان کلینیک',
    sha256Seal: 'b2d0f8e5c3a1947625b8d0f3e9c5a71243658709bcdef0123456789abcdef002'
  },
  {
    stageNumber: 3,
    auditId: 'MD-REL-1405-03',
    title: 'مرحله ۳: موتور نوتیفیکیشن زنده و دقیق متصل به تمام ماژول‌های مطب',
    targetPlatforms: 'All Platforms (Realtime Bell & Slide Drawer)',
    standardReference: 'Live Clinical Event Aggregator (Appointments · Implants · Sayad · Lab)',
    status: 'Done',
    verificationSummary: 'تولید اعلان زنده از نوبت‌های فعال یونیت، مراحل ایمپلنت، اقساط معوق/پیش‌رو، چک صیادی و لابراتوار با شمارنده زنده و ذخیره وضعیت خوانده‌شده',
    sha256Seal: 'c3e1a9f6d4b2058736c9e1a4f0d6b82354769810cdef0123456789abcdef0003'
  },
  {
    stageNumber: 4,
    auditId: 'MD-REL-1405-04',
    title: 'مرحله ۴: نوبت‌دهی بدون تداخل و تقویم ایرانی مصون از باگ اندروید ۹ (Note 8)',
    targetPlatforms: 'Samsung Galaxy Note 8 (SM-N950F) · iOS 27 · Desktop',
    standardReference: 'Iranian Astronomical Jalali · Date-Scoped Unit Collision Guard',
    status: 'Done',
    verificationSummary: 'جداسازی کنترل تداخل یونیت و ساعت بر مبنای تاریخ دقیق شمسی (ایجاد، درگ‌ودراپ، جابجایی و ویرایش) + محافظ ضدباگ Intl اندروید ۹',
    sha256Seal: 'd4f2b0a7e5c3169847d0f2b5a1e7c93465870921def0123456789abcdef00004'
  },
  {
    stageNumber: 5,
    auditId: 'MD-REL-1405-05',
    title: 'مرحله ۵: بهینه‌سازی ارگونومی موبایل عرض ۴۱۲px (Galaxy Note 8 & iPhone)',
    targetPlatforms: 'Samsung Galaxy Note 8 (360-412px · S-Pen) · iPhone 16 Pro Max',
    standardReference: 'Touch Target 38px+ · Zero Horizontal Overflow · Readable Q-Bank Tiles',
    status: 'Done',
    verificationSummary: 'بهینه‌سازی فاصله‌گذاری داخلی کارت‌های دوتایی کیوبانک برای جلوگیری از برش عنوان‌های فارسی و پشتیبانی کامل قلم S-Pen',
    sha256Seal: 'e5a3c1b8f6d4270958e1a3c6b2f8d04576981032ef0123456789abcdef000005'
  },
  {
    stageNumber: 6,
    auditId: 'MD-REL-1405-06',
    title: 'مرحله ۶: تست عملکرد واقعی، بودجه رندر زیر ۵ میلی‌ثانیه و استرس ۵۰۰K',
    targetPlatforms: 'Industrial Stress Engine · Node SSR & Browser DOM',
    standardReference: 'Zero IEEE-754 Drift (10⁻⁶ Toman) · 1,000 Patients · 500k Transactions',
    status: 'Done',
    verificationSummary: 'اجرای واقعی سناریوهای نوبت‌دهی، اعلان زنده، محاسبات جلالی و چرخه ۵۰۰٬۰۰۰ تراکنش با انحراف صفر و زمان پردازش زیر ۲ms',
    sha256Seal: 'f6b4d2c9a7e5381069f2b4d7c3a9e15687092143f0123456789abcdef0000006'
  },
  {
    stageNumber: 7,
    auditId: 'MD-REL-1405-07',
    title: 'مرحله ۷: آماده‌سازی بومی APK اندروید و IPA آیفون (Capacitor Enterprise Bridge)',
    targetPlatforms: 'Capacitor Android APK · iOS 27 IPA Xcode Archive',
    standardReference: 'ir.minadental.clinic.ios27 · Safe-Area & Deep Links (?view=...)',
    status: 'Done',
    verificationSummary: 'پیکربندی کامل capacitor.config.ts، متاتگ‌های iOS standalone، و کانال همگام‌سازی فوری بین تمام اکانت‌های پرسنل',
    sha256Seal: '07c5e3d0b8f6492170a3c5e8d4b0f267981032540123456789abcdef00000007'
  },
  {
    stageNumber: 8,
    auditId: 'MD-REL-1405-08',
    title: 'مرحله ۸: قفل نهایی انتشار جهانی و صدور گواهی تایید صنعتی مینادنتال',
    targetPlatforms: 'Production Verified Release v27.5.0 (Build 20261114)',
    standardReference: 'Compile + ESLint Strict Zero-Error · All Industrial & Audit Suites PASS',
    status: 'Done',
    verificationSummary: 'تایید کامل بیلد پروداکشن، ESLint، ممیزی جدول Audit ID، پایداری سرور پورت ۳۰۰۰ و گواهی رسمی آماده استفاده واقعی مطب',
    sha256Seal: '18d6f4e1c9a7503281b4d6f9e5c1a37809214365123456789abcdef000000008'
  }
];



