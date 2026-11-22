import React, { useState } from 'react';
import { 
  X, Calculator, Calendar, DollarSign, CheckCircle2, 
  CreditCard, FileCheck2, User, ChevronLeft, ArrowDown,
  Sparkles, ShieldCheck
} from 'lucide-react';
import { Patient, Installment, SayadCheck, ReminderConfig } from '../types/dental';
import { toPersianDigits, formatToman, getPersianDateParts, PERSIAN_MONTHS } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { ReminderOptionPicker } from './ReminderOptionPicker';
import { getDefaultReminderConfig } from '../services/reminderNotificationService';

interface InstallmentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  defaultPatientId?: string;
  onSaveInstallmentPlan: (patientId: string, installments: Installment[], checks: SayadCheck[], downPaymentAmount: number) => void;
}

export const InstallmentPlanModal: React.FC<InstallmentPlanModalProps> = ({
  isOpen,
  onClose,
  patients,
  defaultPatientId,
  onSaveInstallmentPlan
}) => {
  const { impactLight, impactHeavy, success } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    defaultPatientId || patients[0]?.id || ''
  );

  const activePatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  const curDate = getPersianDateParts();
  const currentYear = curDate.year;

  const [treatmentName, setTreatmentName] = useState<string>('کاشت ایمپلنت و پروتز زیرکونیا');
  const [totalCost, setTotalCost] = useState<number>(36000000);
  const [downPayment, setDownPayment] = useState<number>(12000000);
  const [numInstallments, setNumInstallments] = useState<number>(4);
  const [startMonth, setStartMonth] = useState<number>(curDate.month);
  const [startDay, setStartDay] = useState<number>(Math.min(25, curDate.day));
  const [useSayadChecks, setUseSayadChecks] = useState<boolean>(true);
  const [collateralMode, setCollateralMode] = useState<'sayad_per_installment' | 'single_guarantee' | 'no_check'>('sayad_per_installment');
  const [bankName, setBankName] = useState<string>('بانک ملی');
  const [guaranteeSayadId, setGuaranteeSayadId] = useState<string>('۷۴۰۱۹۹۸۸۷۷۶۶۵۵۴۴');

  // Sayad check IDs state per installment
  const [sayadIds, setSayadIds] = useState<Record<number, string>>({
    1: '۷۴۰۱۲۳۹۸۴۵۲۱۱۰۹۱',
    2: '۷۴۰۱۲۳۹۸۴۵۲۱۱۰۹۲',
    3: '۷۴۰۱۲۳۹۸۴۵۲۱۱۰۹۳',
    4: '۷۴۰۱۲۳۹۸۴۵۲۱۱۰۹۴'
  });
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('2d_before'));
  const [planError, setPlanError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPlanError(null);
      if (defaultPatientId) {
        setSelectedPatientId(defaultPatientId);
      } else if (!selectedPatientId && patients[0]) {
        setSelectedPatientId(patients[0].id);
      }
    }
  }, [isOpen, defaultPatientId, patients]);

  if (!isOpen) return null;

  const remainingAmount = Math.max(0, totalCost - downPayment);
  const installmentAmount = numInstallments > 0 ? Math.floor(remainingAmount / numInstallments) : 0;

  const syncFromPatientFile = (pat: Patient | undefined) => {
    if (!pat) return;
    impactLight();
    const teethList = Object.values(pat.teethConditions || {});
    const teethSum = teethList.reduce((s, c) => s + (c.cost || 0), 0);
    const computedTotal = Math.max(teethSum, pat.totalCost || 0, 15000000);
    const computedPaid = (pat.payments || []).reduce((s, p) => s + p.amount, 0) || pat.paidAmount || 0;
    setTotalCost(computedTotal);
    setDownPayment(Math.min(computedTotal, computedPaid > 0 ? computedPaid : Math.round(computedTotal * 0.3)));
    const firstProc = teethList.find(c => c.notes)?.notes;
    if (firstProc && firstProc.trim()) {
      setTreatmentName(firstProc);
    }
  };

  // Generate installments preview with exact remainder adjustment on final installment & safe Esfand day clamping
  const generatedPlan = Array.from({ length: numInstallments }, (_, idx) => {
    const instNum = idx + 1;
    const startYearOffset = startMonth < curDate.month ? 1 : 0;
    const totalMonthIdx = (startMonth - 1) + idx;
    const monthNum = (totalMonthIdx % 12) + 1;
    const yearOffset = startYearOffset + Math.floor(totalMonthIdx / 12);
    const year = currentYear + yearOffset;
    const safeDay = monthNum === 12 ? Math.min(startDay, 29) : startDay;
    const formattedMonth = monthNum < 10 ? `۰${monthNum}` : `${monthNum}`;
    const formattedDay = safeDay < 10 ? `۰${safeDay}` : `${safeDay}`;
    const dueDate = `${toPersianDigits(year)}/${toPersianDigits(formattedMonth)}/${toPersianDigits(formattedDay)}`;
    const exactAmount =
      idx === numInstallments - 1
        ? Math.max(0, remainingAmount - installmentAmount * (numInstallments - 1))
        : installmentAmount;

    return {
      installmentNumber: instNum,
      amount: exactAmount,
      dueDate,
      sayadId: sayadIds[instNum] || `۷۴۰۱۸۸${instNum}۹۹${Date.now().toString().slice(-6)}`
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    if (remainingAmount <= 0) {
      impactHeavy();
      setPlanError('مبلغ باقیمانده جهت تقسیط باید بیشتر از صفر باشد (پیش‌پرداخت نمی‌تواند مساوی یا بیشتر از هزینه کل باشد).');
      return;
    }
    setPlanError(null);
    impactHeavy();

    const createdInstallments: Installment[] = generatedPlan.map(item => ({
      id: `inst-${Date.now()}-${item.installmentNumber}`,
      patientId: activePatient.id,
      patientName: activePatient.fullName,
      treatmentName,
      installmentNumber: item.installmentNumber,
      totalInstallments: numInstallments,
      amount: item.amount,
      dueDate: item.dueDate,
      status: 'pending',
      paymentMethod: collateralMode === 'sayad_per_installment' && useSayadChecks ? 'check' : 'pos',
      reminderConfig
    }));

    const createdChecks: SayadCheck[] =
      collateralMode === 'sayad_per_installment' && useSayadChecks
        ? generatedPlan.map(item => ({
            id: `chk-${Date.now()}-${item.installmentNumber}`,
            patientId: activePatient.id,
            patientName: activePatient.fullName,
            sayadId: item.sayadId,
            bankName,
            amount: item.amount,
            dueDate: item.dueDate,
            drawerName: activePatient.fullName,
            status: 'in_collection',
            isGuarantee: false,
            description: `قسط شماره ${toPersianDigits(item.installmentNumber)} بابت ${treatmentName}`,
            reminderConfig
          }))
        : collateralMode === 'single_guarantee'
          ? [
              {
                id: `chk-guar-${Date.now()}`,
                patientId: activePatient.id,
                patientName: activePatient.fullName,
                sayadId: guaranteeSayadId || '۷۴۰۱۹۹۸۸۷۷۶۶۵۵۴۴',
                bankName,
                amount: remainingAmount,
                dueDate: generatedPlan[generatedPlan.length - 1]?.dueDate || generatedPlan[0]?.dueDate || '',
                drawerName: activePatient.fullName,
                status: 'in_collection',
                isGuarantee: true,
                description: `چک ضمانت امانی کل اقساط (${toPersianDigits(numInstallments)} قسط) بابت ${treatmentName}`,
                reminderConfig
              }
            ]
          : [];

    onSaveInstallmentPlan(activePatient.id, createdInstallments, createdChecks, downPayment);
    success();
    onClose();
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="تنظیم طرح اقساط و چک صیادی بیمار"
        className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        onClick={onClose}
      >
        <form
          dir="rtl"
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-full min-w-0 sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-white border-b border-amber-200/80 shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-amber-300/80 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs shrink-0">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">صدور برنامه اقساط درمانی</h3>
                  <span className="text-[9.5px] font-bold text-amber-700 block truncate">محاسبه خودکار اقساط، پیش‌پرداخت و چک صیادی</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="بستن محاسبه‌گر اقساط"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body Content */}
          <div className="p-3.5 sm:p-4 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain space-y-3 text-xs font-sans min-w-0">
            {/* Patient Selection & Treatment Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1 gap-1">
                  <label className="text-slate-700 font-bold">بیمار متقاضی تقسیط</label>
                  <button
                    type="button"
                    onClick={() => syncFromPatientFile(activePatient)}
                    className="text-[9.5px] font-black text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg cursor-pointer"
                  >
                    فراخوانی تعرفه پرونده
                  </button>
                </div>
                <select
                  aria-label="بیمار متقاضی تقسیط"
                  value={selectedPatientId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedPatientId(nextId);
                    const found = patients.find(p => p.id === nextId);
                    if (found) syncFromPatientFile(found);
                  }}
                  className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} (پرونده: {p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="text-slate-700 font-bold block mb-1">عنوان درمان</label>
                <input
                  type="text"
                  value={treatmentName}
                  onChange={(e) => setTreatmentName(e.target.value)}
                  className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  placeholder="مثلاً کاشت ۳ واحد ایمپلنت"
                />
              </div>
            </div>

            {/* Cost & Down payment calculation */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                <div className="min-w-0">
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">هزینه کل درمان (تومان)</label>
                  <input
                    aria-label="هزینه کل درمان (تومان)"
                    type="number"
                    step="500000"
                    value={totalCost}
                    onChange={(e) => setTotalCost(Number(e.target.value))}
                    className="w-full min-w-0 bg-white border border-slate-300 rounded-lg p-1.5 font-mono font-bold text-slate-900 text-xs"
                  />
                  <span className="text-[9.5px] text-slate-400 mt-0.5 block truncate">{formatToman(totalCost)}</span>
                </div>

                <div className="min-w-0">
                  <label className="text-[10px] text-emerald-700 font-bold block mb-1">پیش‌پرداخت نقدی / POS</label>
                  <input
                    aria-label="پیش‌پرداخت نقدی / POS"
                    type="number"
                    step="500000"
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    className="w-full min-w-0 bg-white border border-emerald-300 rounded-lg p-1.5 font-mono font-bold text-emerald-800 text-xs"
                  />
                  <span className="text-[9.5px] text-emerald-600 mt-0.5 block truncate">{formatToman(downPayment)}</span>
                </div>

                <div className="min-w-0">
                  <label className="text-[10px] text-amber-700 font-bold block mb-1">مبلغ باقیمانده اقساط</label>
                  <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200 font-mono font-black text-amber-900 text-xs truncate">
                    {formatToman(remainingAmount)}
                  </div>
                  <span className="text-[9.5px] text-amber-700 mt-0.5 block">تقسیم به اقساط</span>
                </div>
              </div>

              {/* 1-Tap Down-Payment Percentage Presets */}
              <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-200/80 text-[10px]">
                <span className="font-bold text-slate-500">تنظیم سریع پیش‌پرداخت:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { pct: 0, label: 'بدون پیش‌پرداخت' },
                    { pct: 20, label: '۲۰٪' },
                    { pct: 30, label: '۳۰٪ استاندارد' },
                    { pct: 50, label: '۵۰٪ نصف' }
                  ].map(preset => (
                    <button
                      key={preset.pct}
                      type="button"
                      onClick={() => {
                        impactLight();
                        setDownPayment(Math.round((totalCost * preset.pct) / 100));
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 font-black cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Installments count and start date */}
            <div className="grid grid-cols-3 gap-2 min-w-0">
              <div className="min-w-0">
                <label className="text-slate-700 font-bold block mb-1 truncate">تعداد اقساط ماهانه</label>
                <select
                  aria-label="تعداد اقساط ماهانه"
                  value={numInstallments}
                  onChange={(e) => setNumInstallments(Number(e.target.value))}
                  className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value={2}>۲ قسط (۲ ماهه)</option>
                  <option value={3}>۳ قسط (۳ ماهه)</option>
                  <option value={4}>۴ قسط (۴ ماهه)</option>
                  <option value={5}>۵ قسط (۵ ماهه)</option>
                  <option value={6}>۶ قسط (۶ ماهه)</option>
                  <option value={8}>۸ قسط (۸ ماهه)</option>
                  <option value={10}>۱۰ قسط (۱۰ ماهه)</option>
                  <option value={12}>۱۲ قسط (۱ ساله)</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="text-slate-700 font-bold block mb-1 truncate">ماه اولین سررسید</label>
                <select
                  aria-label="ماه اولین سررسید"
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                  className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 text-xs"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const mIndex = (curDate.month - 1 + i) % 12;
                    const yOffset = Math.floor((curDate.month - 1 + i) / 12);
                    const optYear = currentYear + yOffset;
                    return (
                      <option key={i} value={mIndex + 1}>
                        {PERSIAN_MONTHS[mIndex]} {toPersianDigits(optYear)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="min-w-0">
                <label className="text-slate-700 font-bold block mb-1 truncate">روز سررسید هر ماه</label>
                <select
                  aria-label="روز سررسید هر ماه"
                  value={startDay}
                  onChange={(e) => setStartDay(Number(e.target.value))}
                  className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value={1}>یکم هر ماه</option>
                  <option value={5}>پنجم هر ماه</option>
                  <option value={10}>دهم هر ماه</option>
                  <option value={15}>پانزدهم هر ماه</option>
                  <option value={20}>بیستم هر ماه</option>
                  <option value={25}>بیست و پنجم هر ماه</option>
                  <option value={30}>آخر هر ماه</option>
                </select>
              </div>
            </div>

            {/* Unified 3-Mode Collateral & Guarantee Selector */}
            <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-2.5 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-black text-xs text-purple-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>مدل یکپارچه چک صیادی و ضمانت اقساط:</span>
                </span>
                {collateralMode !== 'no_check' && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-purple-800 font-medium">بانک صادرکننده:</span>
                    <input
                      aria-label="بانک صادرکننده"
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-24 bg-white border border-purple-300 rounded px-1.5 py-0.5 text-slate-800 text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] font-black min-w-0">
                {[
                  { id: 'sayad_per_installment', label: 'چک صیادی برای هر قسط', desc: 'صدور چک مجزا بابت هر موعد' },
                  { id: 'single_guarantee', label: 'چک ضمانت امانی کل اقساط', desc: '۱ فقره چک ضمانت کل مانده' },
                  { id: 'no_check', label: 'بدون چک (تعهد پرونده)', desc: 'پرداخت ماهانه پوز / کارت' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      impactLight();
                      setCollateralMode(opt.id as any);
                      setUseSayadChecks(opt.id === 'sayad_per_installment');
                    }}
                    className={`p-2 rounded-xl border text-right transition-all cursor-pointer min-w-0 ${
                      collateralMode === opt.id
                        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-purple-200/80 hover:bg-purple-50'
                    }`}
                  >
                    <span className="block truncate">{opt.label}</span>
                    <span className={`text-[9px] font-bold block mt-0.5 truncate ${collateralMode === opt.id ? 'text-purple-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>

              {collateralMode === 'single_guarantee' && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/90 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                  <div className="min-w-0">
                    <span className="font-black text-amber-950 block">شناسه ۱۶ رقمی چک ضمانت امانی (گاوصندوق مطب):</span>
                    <span className="text-[9.5px] text-amber-800 block">
                      مبلغ چک ضمانت: <strong className="font-mono">{formatToman(remainingAmount)}</strong> (عودت خودکار پس از تسویه قسط {toPersianDigits(numInstallments)})
                    </span>
                  </div>
                  <input
                    type="text"
                    aria-label="شناسه ۱۶ رقمی چک ضمانت"
                    value={guaranteeSayadId}
                    onChange={(e) => setGuaranteeSayadId(e.target.value)}
                    placeholder="شناسه ۱۶ رقمی صیاد ضمانت"
                    className="w-36 bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono font-bold text-slate-900 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Generated Plan Table */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1 px-1">
                <span className="font-black text-slate-800 text-xs">جدول زمان‌بندی اقساط محاسبه‌شده:</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  مبلغ هر قسط: <strong className="text-slate-900">{formatToman(installmentAmount)}</strong>
                </span>
              </div>

              <div className="space-y-1.5 min-w-0">
                {generatedPlan.map(item => (
                  <div
                    key={item.installmentNumber}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-900 font-black text-xs flex items-center justify-center font-mono shrink-0">
                        {toPersianDigits(item.installmentNumber)}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block">قسط {toPersianDigits(item.installmentNumber)}</span>
                        <span className="text-[10px] text-slate-500 font-mono">موعد: {item.dueDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {collateralMode === 'sayad_per_installment' && useSayadChecks && (
                        <div className="flex items-center gap-1">
                          <FileCheck2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <input
                            type="text"
                            value={sayadIds[item.installmentNumber] || ''}
                            onChange={(e) => setSayadIds({ ...sayadIds, [item.installmentNumber]: e.target.value })}
                            placeholder="شناسه ۱۶ رقمی صیاد"
                            className="w-28 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-800"
                          />
                        </div>
                      )}
                      {collateralMode === 'single_guarantee' && (
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                          تحت پوشش چک ضمانت
                        </span>
                      )}

                      <span className="font-black font-mono text-slate-900">
                        {formatToman(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ReminderOptionPicker
              value={reminderConfig}
              onChange={setReminderConfig}
              targetDate={generatedPlan[0]?.dueDate}
              theme="amber"
              title="یادآوری خودکار سررسید تمام اقساط و چک‌ها (نوتیف گوشی و پیامک)"
            />

            {/* Unified 5-Pillar Integration Summary Banner */}
            <div className="p-2.5 rounded-2xl bg-gradient-to-l from-emerald-50 via-amber-50/70 to-purple-50/70 border border-emerald-200/80 text-[10px] space-y-1">
              <div className="font-black text-slate-900 flex items-center justify-between flex-wrap gap-1">
                <span>ثبت یکپارچه در ۵ بخش مالی کلینیک:</span>
                <span className="text-emerald-800 font-mono">همگام‌سازی خودکار ✓</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[9.5px] font-bold text-slate-700">
                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">۱. دفتر بدهکاران و صندوق</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-900">۲. {toPersianDigits(numInstallments)} قسط درمانی</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-900">
                  ۳. {collateralMode === 'sayad_per_installment' ? `${toPersianDigits(numInstallments)} چک صیادی` : collateralMode === 'single_guarantee' ? '۱ چک ضمانت امانی' : 'تعهد بدون چک'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-sky-200 text-sky-900">
                  ۴. {reminderConfig.enabled ? 'یادآوری هوشمند فعال 🔔' : 'یادآوری غیرفعال'}
                </span>
              </div>
            </div>

            {planError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-bold">
                {planError}
              </div>
            )}
          </div>

          {/* Fixed Bottom Footer */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-20">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              className="w-2/3 py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>تایید و ثبت برنامه اقساط در پرونده</span>
            </button>
          </div>
        </form>
      </div>
    </ViewportModalPortal>
  );
};
