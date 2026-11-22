import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  TrendingUp,
  CalendarClock,
  Wallet,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  FileSpreadsheet
} from 'lucide-react';
import { Patient } from '../types/dental';
import { formatToman, toPersianDigits } from '../utils/jalali';
import {
  buildFinancialReportsDataset,
  generateFinancialReportsCsvContent,
  MonthlyRevenueForecastPoint,
  PaymentMethodBreakdownItem
} from '../utils/financialReports';
import { triggerHaptic } from '../utils/haptics';

interface FinancialReportsDashboardProps {
  patients: Patient[];
  onOpenPatientFile?: (patient: Patient) => void;
}

export const FinancialReportsDashboard: React.FC<FinancialReportsDashboardProps> = ({
  patients,
  onOpenPatientFile
}) => {
  const [monthWindow, setMonthWindow] = useState<'all' | '6' | '3'>('all');
  const [methodScope, setMethodScope] = useState<'combined' | 'realized'>('combined');
  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(null);

  const summary = useMemo(() => buildFinancialReportsDataset(patients), [patients]);

  const visibleMonthlySeries = useMemo(() => {
    if (monthWindow === '3') return summary.monthlySeries.slice(-3);
    if (monthWindow === '6') return summary.monthlySeries.slice(-6);
    return summary.monthlySeries;
  }, [summary.monthlySeries, monthWindow]);

  const activeMethodBreakdown: PaymentMethodBreakdownItem[] = useMemo(() => {
    return methodScope === 'realized'
      ? summary.paymentMethodsRealized
      : summary.paymentMethodsCombined;
  }, [methodScope, summary.paymentMethodsRealized, summary.paymentMethodsCombined]);

  const pieChartSlices = useMemo(() => {
    const nonZero = activeMethodBreakdown.filter((item) => item.amount > 0);
    return nonZero;
  }, [activeMethodBreakdown]);

  const activeMethodsTotal = useMemo(
    () => activeMethodBreakdown.reduce((acc, item) => acc + item.amount, 0),
    [activeMethodBreakdown]
  );

  const dominantMethod = useMemo(() => {
    const sorted = [...activeMethodBreakdown].sort((a, b) => b.amount - a.amount);
    return sorted[0];
  }, [activeMethodBreakdown]);

  const handleExportCsv = () => {
    triggerHaptic('medium');
    const csv = generateFinancialReportsCsvContent(summary);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'minadental-financial-reports.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        // Fallback silently in headless environments
      }
    }
    setExportSuccessNotice('فایل گزارش مالی ماهانه و پیش‌بینی اقساط آماده شد.');
    setTimeout(() => setExportSuccessNotice(null), 3500);
  };

  const CustomMonthlyBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const row: MonthlyRevenueForecastPoint = payload[0].payload;
    return (
      <div className="bg-white/98 backdrop-blur-xl border border-amber-300 rounded-2xl p-3 shadow-xl text-slate-900 text-xs space-y-1.5 min-w-[215px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
          <span className="font-black text-slate-900">{row.monthLabel}</span>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md tabular-nums">
            {toPersianDigits(row.paymentsCount)} وصول / {toPersianDigits(row.installmentsCount)} قسط
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            درآمد وصول‌شده:
          </span>
          <span className="font-mono font-black text-emerald-700 tabular-nums">
            {formatToman(row.realizedIncome)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            پیش‌بینی اقساط:
          </span>
          <span className="font-mono font-black text-sky-700 tabular-nums">
            {formatToman(row.projectedInstallments)}
          </span>
        </div>
        {row.overdueInstallments > 0 && (
          <div className="flex items-center justify-between gap-3 text-[10.5px]">
            <span className="text-rose-600 font-bold">بخش معوق این ماه:</span>
            <span className="font-mono font-black text-rose-700 tabular-nums">
              {formatToman(row.overdueInstallments)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-700">مجموع کل مورد انتظار:</span>
          <span className="font-mono font-black text-slate-950 tabular-nums">
            {formatToman(row.totalExpected)}
          </span>
        </div>
      </div>
    );
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const slice: PaymentMethodBreakdownItem = payload[0].payload;
    return (
      <div className="bg-white/98 backdrop-blur-xl border border-slate-200 rounded-2xl p-2.5 shadow-xl text-slate-900 text-xs space-y-1 min-w-[180px]">
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <span className="font-black text-slate-900 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
            {slice.label}
          </span>
          <span className="font-mono font-black text-slate-800 tabular-nums">
            {toPersianDigits(slice.percentage)}٪
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">مبلغ کل:</span>
          <span className="font-mono font-black text-slate-900 tabular-nums">{formatToman(slice.amount)}</span>
        </div>
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-slate-500">تعداد تراکنش:</span>
          <span className="font-mono font-bold text-slate-700 tabular-nums">{toPersianDigits(slice.count)} فقره</span>
        </div>
      </div>
    );
  };

  const clinicExecutiveMetrics = useMemo(() => {
    const grossTreatments = patients.reduce((acc, p) => {
      const teethCost = Object.values(p.teethConditions || {}).reduce((s, c) => s + (c.cost || 0), 0);
      return acc + Math.max(teethCost, p.totalCost || 0);
    }, 0);
    const totalLabCost = patients.reduce((acc, p) => {
      return acc + (p.labOrders || []).reduce((s, o) => s + (o.cost || 0), 0);
    }, 0);
    const netClinicAfterLab = Math.max(0, summary.totalRealizedIncome - totalLabCost);
    return {
      grossTreatments,
      totalLabCost,
      netClinicAfterLab
    };
  }, [patients, summary.totalRealizedIncome]);

  return (
    <section
      aria-label="داشبورد گزارش‌های مالی و درآمد ماهانه"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-3 animate-in fade-in duration-200 select-none"
      dir="rtl"
    >
      {/* Top Banner & Action Controls */}
      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-[26px] border border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/70 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-amber-200/70 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <BarChart3 className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-950 truncate">
                داشبورد جامع گزارش‌های مالی و پیش‌بینی درآمد
              </h3>
              <p className="text-[10.5px] font-bold text-slate-600 truncate">
                تحلیل لحظه‌ای درآمد ماهانه وصول‌شده، پیش‌بینی اقساط آتی و تفکیک روش‌های پرداخت (نقد، پوز، چک)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto min-w-0">
            <div className="flex items-center bg-amber-100/80 p-0.5 rounded-xl border border-amber-200 text-[10px] sm:text-[10.5px] font-bold">
              {[
                { id: 'all' as const, label: 'کل ماه‌ها' },
                { id: '6' as const, label: '۶ ماه اخیر' },
                { id: '3' as const, label: '۳ ماه اخیر' }
              ].map((win) => (
                <button
                  key={win.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setMonthWindow(win.id);
                  }}
                  className={`py-1 px-2 sm:px-2.5 rounded-lg transition-all cursor-pointer ${
                    monthWindow === win.id
                      ? 'bg-amber-600 text-white font-black shadow-2xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {win.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>خروجی اکسل (CSV)</span>
            </button>
          </div>
        </div>

        {exportSuccessNotice && (
          <div
            role="status"
            className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] font-bold text-emerald-800 flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccessNotice}</span>
          </div>
        )}

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 min-w-0">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50/85 border border-emerald-200/90 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-emerald-800 truncate">کل درآمد وصول‌شده</span>
              <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
            <span className="text-xs sm:text-sm font-black font-mono text-emerald-950 block truncate tabular-nums">
              {formatToman(summary.totalRealizedIncome)}
            </span>
            <span className="text-[9.5px] font-bold text-emerald-700 block truncate tabular-nums">
              از {toPersianDigits(summary.totalPaymentsCount)} پرداخت ثبت‌شده
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-sky-50/85 border border-sky-200/90 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-sky-800 truncate">درآمد پیش‌بینی‌شده (اقساط)</span>
              <CalendarClock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            </div>
            <span className="text-xs sm:text-sm font-black font-mono text-sky-950 block truncate tabular-nums">
              {formatToman(summary.totalProjectedInstallments)}
            </span>
            <span className="text-[9.5px] font-bold text-sky-700 block truncate tabular-nums">
              {toPersianDigits(summary.unpaidInstallmentsCount)} قسط در جریان
              {summary.totalOverdueInstallments > 0
                ? ` · ${formatToman(summary.totalOverdueInstallments)} معوق`
                : ''}
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-50/85 border border-amber-200/90 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-amber-900 truncate">مجموع کل درآمد مورد انتظار</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            </div>
            <span className="text-xs sm:text-sm font-black font-mono text-amber-950 block truncate tabular-nums">
              {formatToman(summary.totalExpectedRevenue)}
            </span>
            <span className="text-[9.5px] font-bold text-amber-800 block truncate tabular-nums">
              ضریب تحقق فعلی: {toPersianDigits(summary.realizationRatePercent)}٪
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-purple-50/85 border border-purple-200/90 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-purple-900 truncate">روش پرداخت غالب</span>
              <CreditCard className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            </div>
            <span className="text-xs sm:text-sm font-black text-purple-950 block truncate">
              {dominantMethod && dominantMethod.amount > 0
                ? `${dominantMethod.shortLabel} (${toPersianDigits(dominantMethod.percentage)}٪)`
                : 'بدون تراکنش'}
            </span>
            <span className="text-[9.5px] font-mono font-bold text-purple-700 block truncate tabular-nums">
              {dominantMethod && dominantMethod.amount > 0
                ? formatToman(dominantMethod.amount)
                : '۰ تومان'}
            </span>
          </div>
        </div>

        {/* Executive Net Profit & Lab Deduction Intelligence Bar */}
        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px] min-w-0">
          <div className="p-2 rounded-xl bg-white/90 border border-slate-200/90 min-w-0 overflow-hidden">
            <span className="text-slate-500 block text-[9px] truncate">کل کارکرد درمانی ثبت‌شده</span>
            <span className="font-mono font-black text-slate-900 block mt-0.5 truncate">
              {formatToman(clinicExecutiveMetrics.grossTreatments)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50/80 border border-rose-200/90 min-w-0 overflow-hidden">
            <span className="text-rose-800 block text-[9px] truncate">کل هزینه لابراتوار پروتز</span>
            <span className="font-mono font-black text-rose-700 block mt-0.5 truncate">
              − {formatToman(clinicExecutiveMetrics.totalLabCost)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-100/75 border border-emerald-300 min-w-0 overflow-hidden">
            <span className="text-emerald-950 block text-[9px] truncate">خالص وصولی پس از لابراتوار</span>
            <span className="font-mono font-black text-emerald-800 block mt-0.5 truncate">
              {formatToman(clinicExecutiveMetrics.netClinicAfterLab)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Chart Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-w-0">
        {/* Chart 1: Monthly Realized vs. Projected Installments Bar Chart */}
        <div className="lg:col-span-7 w-full max-w-full min-w-0 overflow-hidden bg-white rounded-[26px] border border-slate-200/90 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 stroke-[2.3]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  نمودار میله‌ای درآمد ماهانه و پیش‌بینی اقساط
                </h4>
                <span className="text-[10px] text-slate-500 font-bold">
                  مقایسه وصول قطعی (payments) در برابر اقساط سررسید (installments)
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height={240} minWidth={200}>
              <BarChart
                data={visibleMonthlySeries}
                margin={{ top: 12, right: 8, left: -12, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Vazirmatn', fontWeight: 700 }}
                  stroke="#cbd5e1"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 9.5, fontFamily: 'Vazirmatn, monospace' }}
                  stroke="#cbd5e1"
                  tickLine={false}
                  tickFormatter={(v) => `${toPersianDigits(Math.round(Number(v || 0) / 1000000))} م`}
                />
                <Tooltip content={<CustomMonthlyBarTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontWeight: 700 }}
                />
                <Bar
                  dataKey="realizedIncome"
                  name="درآمد ماهانه وصول‌شده"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="projectedInstallments"
                  name="درآمد پیش‌بینی‌شده (اقساط)"
                  fill="#0284c7"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Payment Methods Pie Chart (نقد، پوز، چک، کارت‌به‌کارت) */}
        <div className="lg:col-span-5 bg-white rounded-[26px] border border-slate-200/90 p-3.5 sm:p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <PieChartIcon className="w-4 h-4 stroke-[2.3]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  تفکیک روش‌های پرداخت (نقد، پوز، چک)
                </h4>
                <span className="text-[10px] text-slate-500 font-bold">
                  سهم ریالی و درصدی ابزارهای تسویه مطب
                </span>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setMethodScope('combined');
                }}
                className={`py-1 px-2 rounded-lg transition-all cursor-pointer ${
                  methodScope === 'combined'
                    ? 'bg-white text-slate-950 font-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                وصول + اقساط
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setMethodScope('realized');
                }}
                className={`py-1 px-2 rounded-lg transition-all cursor-pointer ${
                  methodScope === 'realized'
                    ? 'bg-white text-slate-950 font-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فقط وصولی نقد/پوز
              </button>
            </div>
          </div>

          {pieChartSlices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
              <div className="w-full h-[210px]">
                <ResponsiveContainer width="100%" height={210} minWidth={160}>
                  <PieChart>
                    <Pie
                      data={pieChartSlices}
                      dataKey="amount"
                      nameKey="shortLabel"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {pieChartSlices.map((entry) => (
                        <Cell key={entry.method} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {activeMethodBreakdown.map((item) => (
                  <div
                    key={item.method}
                    className="p-2 rounded-xl bg-slate-50/90 border border-slate-200/70 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black text-slate-900 flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.shortLabel}
                      </span>
                      <span className="font-mono font-black text-slate-800 tabular-nums">
                        {toPersianDigits(item.percentage)}٪
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(item.amount > 0 ? 4 : 0, item.percentage))}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-600 tabular-nums">
                      <span>{toPersianDigits(item.count)} تراکنش</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatToman(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="pt-1 flex items-center justify-between text-[10.5px] font-bold text-slate-700 border-t border-slate-100">
                  <span>جمع سبد تفکیک:</span>
                  <span className="font-mono font-black text-slate-950 tabular-nums">
                    {formatToman(activeMethodsTotal)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Banknote className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-600">هنوز تراکنش مالی برای نمایش نمودار ثبت نشده است.</p>
            </div>
          )}
        </div>
      </div>

      {/* Projected Installment Cashflow Forecast Ledger */}
      <div className="bg-white rounded-[26px] border border-slate-200/90 p-3.5 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-sky-600" />
            <h4 className="text-xs font-black text-slate-900">
              تقویم پیش‌بینی جریان ورودی اقساط و چک‌های در انتظار ({toPersianDigits(summary.unpaidInstallmentsCount)} قسط)
            </h4>
          </div>
          {summary.totalOverdueInstallments > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black tabular-nums">
              معوق نیازمند پیگیری: {formatToman(summary.totalOverdueInstallments)}
            </span>
          )}
        </div>

        {summary.upcomingInstallments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {summary.upcomingInstallments.slice(0, 6).map((inst) => {
              const matchedPatient = patients.find((p) => p.id === inst.patientId);
              const isOverdue = inst.status === 'overdue';
              return (
                <div
                  key={inst.id}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition-colors ${
                    isOverdue
                      ? 'bg-rose-50/75 border-rose-200/90'
                      : 'bg-sky-50/45 border-sky-200/75'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {matchedPatient && onOpenPatientFile ? (
                        <button
                          type="button"
                          onClick={() => onOpenPatientFile(matchedPatient)}
                          className="text-xs font-black text-slate-900 hover:text-sky-700 underline decoration-dotted cursor-pointer truncate"
                        >
                          {inst.patientName}
                        </button>
                      ) : (
                        <span className="text-xs font-black text-slate-900 truncate">{inst.patientName}</span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black flex items-center gap-1 ${
                          isOverdue
                            ? 'bg-rose-600 text-white'
                            : 'bg-sky-100 text-sky-900 border border-sky-200'
                        }`}
                      >
                        {isOverdue ? (
                          <AlertTriangle className="w-2.5 h-2.5" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        )}
                        {isOverdue ? 'قسط معوق' : 'در انتظار وصول'}
                      </span>
                    </div>
                    <p className="text-[10.5px] font-bold text-slate-600 truncate">
                      {inst.treatmentName} · سررسید: <span className="font-mono">{toPersianDigits(inst.dueDate)}</span> · روش: {inst.paymentMethodLabel}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-xs font-black font-mono text-slate-950 tabular-nums block">
                      {formatToman(inst.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-5 text-center text-xs font-bold text-emerald-700 bg-emerald-50/60 rounded-2xl border border-emerald-200/70">
            تمامی اقساط ثبت‌شده تسویه شده‌اند و بدهی قسطی معوق وجود ندارد.
          </div>
        )}
      </div>
    </section>
  );
};
