import { Installment, Patient, PaymentRecord } from '../types/dental';
import {
  PERSIAN_MONTHS,
  comparePersianDates,
  getCurrentPersianDate,
  parsePersianDate,
  toEnglishDigits,
  toPersianDigits
} from './jalali';

export type PaymentBreakdownMethodKey = 'cash' | 'pos' | 'check' | 'card_to_card';

export interface MonthlyRevenueForecastPoint {
  monthKey: string; // e.g., "1405-08"
  year: number;
  month: number;
  monthLabel: string; // e.g., "آبان ۱۴۰۵"
  shortMonthLabel: string; // e.g., "آبان"
  realizedIncome: number; // درآمد ماهانه وصول‌شده از payments
  projectedInstallments: number; // درآمد پیش‌بینی‌شده از installments (pending + overdue)
  overdueInstallments: number;
  pendingInstallments: number;
  totalExpected: number;
  paymentsCount: number;
  installmentsCount: number;
}

export interface PaymentMethodBreakdownItem {
  method: PaymentBreakdownMethodKey;
  label: string;
  shortLabel: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface UpcomingInstallmentForecastRow {
  id: string;
  patientId: string;
  patientName: string;
  treatmentName: string;
  dueDate: string;
  amount: number;
  status: Installment['status'];
  paymentMethod: PaymentBreakdownMethodKey;
  paymentMethodLabel: string;
}

export interface FinancialReportsSummary {
  totalRealizedIncome: number;
  totalProjectedInstallments: number;
  totalOverdueInstallments: number;
  totalExpectedRevenue: number;
  realizationRatePercent: number;
  totalPaymentsCount: number;
  unpaidInstallmentsCount: number;
  paidInstallmentsCount: number;
  monthlySeries: MonthlyRevenueForecastPoint[];
  paymentMethodsRealized: PaymentMethodBreakdownItem[];
  paymentMethodsCombined: PaymentMethodBreakdownItem[];
  upcomingInstallments: UpcomingInstallmentForecastRow[];
}

export const PAYMENT_METHOD_META: Record<
  PaymentBreakdownMethodKey,
  { label: string; shortLabel: string; color: string }
> = {
  cash: { label: 'پرداخت نقدی', shortLabel: 'نقد', color: '#10b981' },
  pos: { label: 'کارت‌خوان (POS)', shortLabel: 'پوز', color: '#0284c7' },
  check: { label: 'چک صیادی / قسطی', shortLabel: 'چک', color: '#8b5cf6' },
  card_to_card: { label: 'کارت‌به‌کارت', shortLabel: 'کارت‌به‌کارت', color: '#f59e0b' }
};

function parseSafeJalaliYearMonth(dateStr?: string): { year: number; month: number } {
  const fallback = parsePersianDate(getCurrentPersianDate());
  if (!dateStr || typeof dateStr !== 'string') {
    return { year: fallback.year, month: fallback.month };
  }
  const cleanEn = toEnglishDigits(dateStr).trim();
  const match = cleanEn.match(/^(\d{4})[/-](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (Number.isFinite(year) && year >= 1390 && year <= 1450 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  const parsed = parsePersianDate(dateStr);
  if (Number.isFinite(parsed.year) && parsed.month >= 1 && parsed.month <= 12) {
    return { year: parsed.year, month: parsed.month };
  }
  return { year: fallback.year, month: fallback.month };
}

function normalizeMethodKey(method?: string | null): PaymentBreakdownMethodKey {
  if (method === 'cash') return 'cash';
  if (method === 'check') return 'check';
  if (method === 'card_to_card') return 'card_to_card';
  return 'pos';
}

function finalizeMethodBreakdown(
  buckets: Record<PaymentBreakdownMethodKey, { amount: number; count: number }>
): PaymentMethodBreakdownItem[] {
  const keys: PaymentBreakdownMethodKey[] = ['pos', 'cash', 'check', 'card_to_card'];
  const grandTotal = keys.reduce((sum, k) => sum + Math.max(0, buckets[k].amount), 0);

  return keys.map((method) => {
    const amount = Math.max(0, Math.round(buckets[method].amount));
    const count = buckets[method].count;
    const percentage = grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0;
    return {
      method,
      label: PAYMENT_METHOD_META[method].label,
      shortLabel: PAYMENT_METHOD_META[method].shortLabel,
      color: PAYMENT_METHOD_META[method].color,
      amount,
      count,
      percentage
    };
  });
}

/**
 * Aggregates patient `payments` and `installments` into monthly realized vs. projected Bar Chart data,
 * Payment Method Pie Chart slices (نقد، پوز، چک، کارت‌به‌کارت), and actionable forecast rows.
 */
export function buildFinancialReportsDataset(patients: Patient[]): FinancialReportsSummary {
  const allPayments: PaymentRecord[] = [];
  const allInstallments: Installment[] = [];

  for (const patient of patients) {
    if (Array.isArray(patient.payments)) {
      allPayments.push(...patient.payments);
    }
    if (Array.isArray(patient.installments)) {
      allInstallments.push(...patient.installments);
    }
  }

  const monthMap = new Map<string, MonthlyRevenueForecastPoint>();
  const ensureMonthBucket = (year: number, month: number): MonthlyRevenueForecastPoint => {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const existing = monthMap.get(monthKey);
    if (existing) return existing;
    const shortMonthLabel = PERSIAN_MONTHS[month - 1] || `ماه ${toPersianDigits(month)}`;
    const point: MonthlyRevenueForecastPoint = {
      monthKey,
      year,
      month,
      monthLabel: `${shortMonthLabel} ${toPersianDigits(year)}`,
      shortMonthLabel,
      realizedIncome: 0,
      projectedInstallments: 0,
      overdueInstallments: 0,
      pendingInstallments: 0,
      totalExpected: 0,
      paymentsCount: 0,
      installmentsCount: 0
    };
    monthMap.set(monthKey, point);
    return point;
  };

  const realizedMethodBuckets: Record<PaymentBreakdownMethodKey, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    pos: { amount: 0, count: 0 },
    check: { amount: 0, count: 0 },
    card_to_card: { amount: 0, count: 0 }
  };

  const combinedMethodBuckets: Record<PaymentBreakdownMethodKey, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    pos: { amount: 0, count: 0 },
    check: { amount: 0, count: 0 },
    card_to_card: { amount: 0, count: 0 }
  };

  let totalRealizedIncome = 0;
  let totalPaymentsCount = 0;

  for (const pay of allPayments) {
    const rawAmount = Number(pay.amount) || 0;
    const { year, month } = parseSafeJalaliYearMonth(pay.date);
    const bucket = ensureMonthBucket(year, month);
    const methodKey = normalizeMethodKey(pay.method);

    if (pay.isRefund || rawAmount < 0) {
      const absRefund = Math.abs(rawAmount);
      bucket.realizedIncome = Math.max(0, bucket.realizedIncome - absRefund);
      totalRealizedIncome = Math.max(0, totalRealizedIncome - absRefund);
      continue;
    }

    bucket.realizedIncome += rawAmount;
    bucket.paymentsCount += 1;
    totalRealizedIncome += rawAmount;
    totalPaymentsCount += 1;

    realizedMethodBuckets[methodKey].amount += rawAmount;
    realizedMethodBuckets[methodKey].count += 1;

    combinedMethodBuckets[methodKey].amount += rawAmount;
    combinedMethodBuckets[methodKey].count += 1;
  }

  let totalProjectedInstallments = 0;
  let totalOverdueInstallments = 0;
  let unpaidInstallmentsCount = 0;
  let paidInstallmentsCount = 0;
  const upcomingInstallments: UpcomingInstallmentForecastRow[] = [];

  for (const inst of allInstallments) {
    const amount = Math.max(0, Number(inst.amount) || 0);
    if (inst.status === 'paid') {
      paidInstallmentsCount += 1;
      continue;
    }

    unpaidInstallmentsCount += 1;
    const { year, month } = parseSafeJalaliYearMonth(inst.dueDate);
    const bucket = ensureMonthBucket(year, month);
    bucket.projectedInstallments += amount;
    bucket.installmentsCount += 1;

    if (inst.status === 'overdue') {
      bucket.overdueInstallments += amount;
      totalOverdueInstallments += amount;
    } else {
      bucket.pendingInstallments += amount;
    }

    totalProjectedInstallments += amount;

    const methodKey = normalizeMethodKey(inst.paymentMethod);
    combinedMethodBuckets[methodKey].amount += amount;
    combinedMethodBuckets[methodKey].count += 1;

    upcomingInstallments.push({
      id: inst.id,
      patientId: inst.patientId,
      patientName: inst.patientName,
      treatmentName: inst.treatmentName || 'درمان اقساطی',
      dueDate: inst.dueDate,
      amount,
      status: inst.status,
      paymentMethod: methodKey,
      paymentMethodLabel: PAYMENT_METHOD_META[methodKey].shortLabel
    });
  }

  // Ensure current month exists if both payments and installments are empty
  if (monthMap.size === 0) {
    const cur = parsePersianDate(getCurrentPersianDate());
    ensureMonthBucket(cur.year, cur.month);
  }

  const monthlySeries = Array.from(monthMap.values())
    .map((m) => ({
      ...m,
      totalExpected: m.realizedIncome + m.projectedInstallments
    }))
    .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));

  upcomingInstallments.sort((a, b) => comparePersianDates(a.dueDate, b.dueDate));

  const totalExpectedRevenue = totalRealizedIncome + totalProjectedInstallments;
  const realizationRatePercent =
    totalExpectedRevenue > 0 ? Math.round((totalRealizedIncome / totalExpectedRevenue) * 100) : 0;

  return {
    totalRealizedIncome,
    totalProjectedInstallments,
    totalOverdueInstallments,
    totalExpectedRevenue,
    realizationRatePercent,
    totalPaymentsCount,
    unpaidInstallmentsCount,
    paidInstallmentsCount,
    monthlySeries,
    paymentMethodsRealized: finalizeMethodBreakdown(realizedMethodBuckets),
    paymentMethodsCombined: finalizeMethodBreakdown(combinedMethodBuckets),
    upcomingInstallments
  };
}

export function generateFinancialReportsCsvContent(summary: FinancialReportsSummary): string {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['ماه', 'درآمد وصول‌شده (تومان)', 'درآمد پیش‌بینی اقساط (تومان)', 'اقساط معوق (تومان)', 'مجموع کل (تومان)']
    .map(esc)
    .join(',');
  const rows = summary.monthlySeries.map((m) =>
    [
      m.monthLabel,
      toPersianDigits(m.realizedIncome),
      toPersianDigits(m.projectedInstallments),
      toPersianDigits(m.overdueInstallments),
      toPersianDigits(m.totalExpected)
    ]
      .map(esc)
      .join(',')
  );
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}
