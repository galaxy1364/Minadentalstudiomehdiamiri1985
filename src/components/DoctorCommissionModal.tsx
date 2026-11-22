import React, { useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  X, Award, DollarSign, Percent, 
  FlaskConical, Stethoscope, CheckCircle2, 
  FileText, ArrowDownRight, ShieldCheck, Lock, Layers, BarChart3, Copy
} from 'lucide-react';
import { Patient, CommissionModel } from '../types/dental';
import { toPersianDigits, formatToman } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';
import {
  queryMaterializedDoctorCommissionLedger,
  queryMaterializedOfficeDebtLedger,
  formatExactMicroToman
} from '../utils/accountingEngine';
import { actionFeedback } from '../utils/actionFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { copyTextSafely } from '../utils/clipboard';

interface DoctorCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
}

interface DoctorRuleState {
  doctorId: string;
  doctorName: string;
  specialty: string;
  isManager: boolean;
  defaultModel: CommissionModel;
  percentageRate: number;
  fixedWagePerTreatment: number;
  baselineHistoricalGross: number;
  baselineHistoricalLab: number;
}

export const DoctorCommissionModal: React.FC<DoctorCommissionModalProps> = ({
  isOpen,
  onClose,
  patients
}) => {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('doc_mehdi');
  useEscapeKey(isOpen, onClose);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMicroPrecision] = useState<boolean>(true);

  // Doctors list with customizable commission rules (Strictly based on Registered Work, NEVER patient payments)
  const [doctorRules, setDoctorRules] = useState<DoctorRuleState[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_doctor_commission_rules_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        doctorId: 'doc_mehdi',
        doctorName: 'دکتر مهدی امیری',
        specialty: 'مدیر کلینیک · جراح فک و صورت و ایمپلنتولوژیست',
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
        specialty: 'متخصص ارتودنسی و ناهنجاری‌های فک و زیبایی',
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
  });

  const currentRule = doctorRules.find(d => d.doctorId === selectedDoctorId) || doctorRules[0];

  // 1. Compute Doctor Commission strictly from Registered Work via Materialized View (`mv_doctor_commission_ledger`)
  const doctorLedger = useMemo(
    () =>
      queryMaterializedDoctorCommissionLedger(patients, {
        doctorId: currentRule.doctorId,
        doctorName: currentRule.doctorName,
        specialty: currentRule.specialty,
        isManager: currentRule.isManager,
        model: currentRule.defaultModel,
        percentageRate: currentRule.percentageRate,
        fixedWagePerTreatment: currentRule.fixedWagePerTreatment,
        baselineHistoricalGross: currentRule.baselineHistoricalGross,
        baselineHistoricalLab: currentRule.baselineHistoricalLab
      }),
    [patients, currentRule]
  );

  // 2. Compute Clinic & Manager Receivables Ledger via Materialized View (`mv_clinic_office_debt_summary`)
  const clinicReceivables = useMemo(() => queryMaterializedOfficeDebtLedger(patients), [patients]);

  // 3. D3.js Interactive Doctor Earnings vs Clinic Share Comparison Chart
  const d3DoctorComparison = useMemo(() => {
    const rows = doctorRules.map((rule) => {
      const ledger = queryMaterializedDoctorCommissionLedger(patients, {
        doctorId: rule.doctorId,
        doctorName: rule.doctorName,
        specialty: rule.specialty,
        isManager: rule.isManager,
        model: rule.defaultModel,
        percentageRate: rule.percentageRate,
        fixedWagePerTreatment: rule.fixedWagePerTreatment,
        baselineHistoricalGross: rule.baselineHistoricalGross,
        baselineHistoricalLab: rule.baselineHistoricalLab
      });
      const grossM = Math.round((ledger.totalRegisteredGrossWork / 1_000_000) * 10) / 10;
      const docM = Math.round((ledger.exactDoctorPayable / 1_000_000) * 10) / 10;
      const labM = Math.round((ledger.totalAssignedLabDeductions / 1_000_000) * 10) / 10;
      const clinicM = Math.round((ledger.exactClinicRetainedShare / 1_000_000) * 10) / 10;
      return {
        doctorId: rule.doctorId,
        shortName: rule.doctorName.replace('دکتر ', ''),
        fullName: rule.doctorName,
        isManager: rule.isManager,
        grossM,
        docM,
        labM,
        clinicM,
        exactDocToman: ledger.exactDoctorPayable,
        exactGrossToman: ledger.totalRegisteredGrossWork
      };
    });

    const width = 440;
    const height = 132;
    const margin = { top: 18, right: 14, bottom: 28, left: 30 };
    const maxVal = Math.max(10, d3.max(rows, (r) => Math.max(r.grossM, r.docM + r.clinicM + r.labM)) || 10);

    const xScale = d3
      .scaleBand<string>()
      .domain(rows.map((r) => r.doctorId))
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
      ticks: yScale.ticks(3),
      bars: rows.map((r) => {
        const x = xScale(r.doctorId) ?? 0;
        const bw = xScale.bandwidth();
        const subW = Math.max(10, Math.floor((bw - 6) / 2));
        const grossH = Math.max(r.grossM > 0 ? 5 : 2, baselineY - yScale(r.grossM));
        const docH = Math.max(r.docM > 0 ? 5 : 2, baselineY - yScale(r.docM));
        const clinicH = Math.max(r.clinicM > 0 ? 4 : 0, baselineY - yScale(r.clinicM));
        return {
          ...r,
          x,
          bw,
          subW,
          grossY: baselineY - grossH,
          grossH,
          docY: baselineY - docH,
          docH,
          clinicY: Math.max(margin.top, baselineY - docH - clinicH),
          clinicH
        };
      })
    };
  }, [doctorRules, patients]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const persistRules = (nextRules: DoctorRuleState[]) => {
    setDoctorRules(nextRules);
    try {
      localStorage.setItem('minadental_doctor_commission_rules_v1', JSON.stringify(nextRules));
      window.dispatchEvent(new CustomEvent('minadental:commission-rules-updated'));
    } catch {}
  };

  const handleModelChange = (model: CommissionModel) => {
    triggerHaptic('selection');
    persistRules(
      doctorRules.map(d => (d.doctorId === selectedDoctorId ? { ...d, defaultModel: model } : d))
    );
  };

  const handlePercentageChange = (rate: number) => {
    persistRules(
      doctorRules.map(d => (d.doctorId === selectedDoctorId ? { ...d, percentageRate: rate } : d))
    );
  };

  const handleFixedWageChange = (wage: number) => {
    const safeWage = Number.isFinite(wage) ? Math.max(0, Math.floor(wage)) : 0;
    persistRules(
      doctorRules.map(d => (d.doctorId === selectedDoctorId ? { ...d, fixedWagePerTreatment: safeWage } : d))
    );
  };

  const handleSave = () => {
    triggerHaptic('success');
    persistRules(doctorRules);
    actionFeedback.recordSuccess({
      title: `سهم‌بندی کارکرد ${currentRule.doctorName} ثبت شد`,
      subtitle: `صرفاً بر مبنای کارکرد ثبت‌شده (مستقل از پرداخت بیمار)`,
      diffAfter: `سهم خالص پزشک: ${formatToman(doctorLedger.exactDoctorPayable)}`,
      canUndo: false
    });
    showToast(`تنظیمات سهم‌بندی ${currentRule.doctorName} با دقت میلیونم ثبت گردید.`);
  };

  const handleCopySettlementSummary = () => {
    triggerHaptic('selection');
    const lines = [
      `فیش تسویه کارکرد کلینیک دندانپزشکی مینادنتال`,
      `پزشک: ${doctorLedger.doctorName} (${doctorLedger.specialty})`,
      `مدل محاسبه: ${toPersianDigits(doctorLedger.calculationAuditFormula)}`,
      `کل کارکرد ثبت‌شده: ${formatToman(doctorLedger.totalRegisteredGrossWork)}`,
      `کسر هزینه لابراتوار: ${formatToman(doctorLedger.totalAssignedLabDeductions)}`,
      `سهم قطعی پزشک: ${formatExactMicroToman(doctorLedger.exactDoctorPayable, false)}`,
      !doctorLedger.isManager ? `سهم مطب: ${formatToman(doctorLedger.exactClinicRetainedShare)}` : ''
    ].filter(Boolean);
    void copyTextSafely(lines.join('\n'));
    showToast(`فیش تسویه کارکرد ${doctorLedger.doctorName} جهت ارسال در واتساپ کپی شد ✓`);
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="سهم‌بندی کارکرد پزشکان و تراز مطب"
        className="fixed inset-0 z-[100] bg-emerald-950/35 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in select-none"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[26px] border-0 sm:border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col text-right"
        >
          {/* Compact Fixed Sheet Header */}
          <div className="px-4 pt-2.5 pb-2.5 border-b border-slate-100 bg-emerald-50/95 shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-emerald-300 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950">
                    سهم‌بندی کارکرد پزشکان و تراز مطب
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 block mt-0.5">
                    محاسبه خالص کارکرد ثبت‌شده (مستقل از بدهی یا اقساط بیمار)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                aria-label="بستن سهم‌بندی پزشکان"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toast Alert */}
          {toastMessage && (
            <div className="mx-3.5 mt-2 p-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in shrink-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Scrollable Body Content (Includes Doctor Tabs so options never clip on mobile) */}
          <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 overscroll-contain space-y-3.5 text-xs">
            {/* Doctor Selector Tabs (Clean Layout Without Truncation) */}
            <div className="grid grid-cols-3 gap-1.5">
              {doctorRules.map(doc => {
                const isSelected = doc.doctorId === selectedDoctorId;
                return (
                  <button
                    key={doc.doctorId}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedDoctorId(doc.doctorId);
                    }}
                    className={`p-2.5 rounded-xl text-right transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {doc.isManager ? 'مدیر و جراح' : doc.doctorId === 'doc_sara' ? 'ارتودنسی' : 'متخصص اندو'}
                      </span>
                    </div>
                    <span className="text-[11px] font-black block leading-snug">{doc.doctorName}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Doctor Banner */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-white border border-emerald-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-emerald-700" />
                  <span className="font-black text-sm text-slate-900">{doctorLedger.doctorName}</span>
                  {doctorLedger.isManager && (
                    <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                      مدیر کلینیک
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-600 mt-0.5">{doctorLedger.specialty}</p>
                <span className="text-[9.5px] font-mono text-emerald-800 mt-1 inline-block bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  فرمول: {toPersianDigits(doctorLedger.calculationAuditFormula)}
                </span>
              </div>

              <div className="text-left bg-white px-3 py-2 rounded-xl border border-emerald-300 shadow-2xs">
                <span className="text-[9.5px] text-slate-500 block font-bold">
                  سهم قطعی پزشک (از کارکرد ثبت‌شده):
                </span>
                <span className="font-mono font-black text-sm sm:text-base text-emerald-700 block">
                  {formatExactMicroToman(doctorLedger.exactDoctorPayable, false)}
                </span>
              </div>
            </div>

            {/* 3 Calculation Models Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 block text-xs">
                  روش محاسبه سهم پزشک (۳ مدل استاندارد):
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  محاسبه خودکار ✓
                </span>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Model 1: (Gross - Lab) / 2 */}
              <div
                onClick={() => handleModelChange('lab_split_half')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  currentRule.defaultModel === 'lab_split_half'
                    ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-400/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <FlaskConical className="w-3.5 h-3.5" />
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    currentRule.defaultModel === 'lab_split_half'
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-slate-300'
                  }`}>
                    {currentRule.defaultModel === 'lab_split_half' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                </div>
                <h4 className="font-black text-xs text-slate-900">۱. نصف پس از کسر لابراتوار</h4>
                <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                  (کل کارکرد ثبت‌شده − هزینه لابراتوار) ÷ ۲
                </p>
              </div>

              {/* Model 2: Fixed Wage */}
              <div
                onClick={() => handleModelChange('fixed_wage')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  currentRule.defaultModel === 'fixed_wage'
                    ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-400/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    currentRule.defaultModel === 'fixed_wage'
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300'
                  }`}>
                    {currentRule.defaultModel === 'fixed_wage' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                </div>
                <h4 className="font-black text-xs text-slate-900">۲. دستمزد ثابت هر درمان</h4>
                <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                  مبلغ دستی ثابت به ازای هر جراحی/درمان ثبت‌شده
                </p>
              </div>

              {/* Model 3: Percentage */}
              <div
                onClick={() => handleModelChange('percentage')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  currentRule.defaultModel === 'percentage'
                    ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    currentRule.defaultModel === 'percentage'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300'
                  }`}>
                    {currentRule.defaultModel === 'percentage' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                </div>
                <h4 className="font-black text-xs text-slate-900">۳. درصدی اختصاصی</h4>
                <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                  درصد سفارشی از کارکرد خالص (ویژه هر پزشک و مدیر)
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Inputs based on active model */}
          {currentRule.defaultModel === 'percentage' && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">درصد سهم پزشک از کارکرد ثبت‌شده:</span>
                <span className="font-mono font-black text-sm text-emerald-700">
                  {toPersianDigits(currentRule.percentageRate)}٪
                </span>
              </div>
              <input aria-label="درصد سهم پزشک از کارکرد ثبت‌شده"
                type="range"
                min="10"
                max="100"
                step="1"
                value={currentRule.percentageRate}
                onChange={(e) => handlePercentageChange(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[35, 45, 50, 65, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentageChange(pct)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black cursor-pointer transition-colors ${
                      currentRule.percentageRate === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    {toPersianDigits(pct)}٪
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentRule.defaultModel === 'fixed_wage' && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700 block">
                  دستمزد ثابت هر واحد درمان ثبت‌شده:
                </label>
                <span className="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                  تعداد درمان ثبت‌شده: {toPersianDigits(doctorLedger.treatmentsCount)} مورد
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input aria-label="دستمزد ثابت هر واحد درمان"
                  type="number"
                  min="0"
                  step="250000"
                  value={currentRule.fixedWagePerTreatment}
                  onChange={(e) => handleFixedWageChange(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono text-left focus:outline-none focus:border-sky-500 font-bold"
                />
                <span className="text-[11px] text-slate-600 font-bold shrink-0">تومان</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[2000000, 3500000, 5000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleFixedWageChange(preset)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                      currentRule.fixedWagePerTreatment === preset
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-sky-50'
                    }`}
                  >
                    {formatToman(preset)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* D3.js Interactive Doctor Earnings vs Clinic Share Comparison */}
          <div
            data-testid="commission-d3-panel"
            className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50/75 via-white to-sky-50/75 border border-emerald-200/80 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-emerald-950 text-[11px] flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>نمودار مقایسه کارکرد کل، سهم پزشک و سهم مطب (D3.js · میلیون تومان)</span>
              </span>
              <div className="flex items-center gap-2 text-[9.5px] font-bold">
                <span className="flex items-center gap-1 text-slate-700">
                  <span className="w-2 h-2 rounded-xs bg-sky-500 inline-block" />
                  کارکرد کل
                </span>
                <span className="flex items-center gap-1 text-emerald-800">
                  <span className="w-2 h-2 rounded-xs bg-emerald-600 inline-block" />
                  سهم پزشک
                </span>
                <span className="flex items-center gap-1 text-amber-800">
                  <span className="w-2 h-2 rounded-xs bg-amber-400 inline-block" />
                  سهم مطب
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                data-testid="commission-d3-svg"
                viewBox={`0 0 ${d3DoctorComparison.width} ${d3DoctorComparison.height}`}
                className="w-full h-[128px] min-w-[300px] select-none"
                role="img"
                aria-label="نمودار D3 مقایسه کارکرد و سهم پزشکان"
              >
                {d3DoctorComparison.ticks.map((tick) => {
                  const ty =
                    d3DoctorComparison.baselineY -
                    (tick / Math.max(1, d3DoctorComparison.ticks[d3DoctorComparison.ticks.length - 1] || 1)) *
                      (d3DoctorComparison.baselineY - d3DoctorComparison.margin.top);
                  return (
                    <line
                      key={tick}
                      x1={d3DoctorComparison.margin.left}
                      x2={d3DoctorComparison.width - d3DoctorComparison.margin.right}
                      y1={ty}
                      y2={ty}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                  );
                })}
                <line
                  x1={d3DoctorComparison.margin.left}
                  x2={d3DoctorComparison.width - d3DoctorComparison.margin.right}
                  y1={d3DoctorComparison.baselineY}
                  y2={d3DoctorComparison.baselineY}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                {d3DoctorComparison.bars.map((bar) => {
                  const isActive = bar.doctorId === selectedDoctorId;
                  return (
                    <g
                      key={bar.doctorId}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedDoctorId(bar.doctorId);
                      }}
                      className="cursor-pointer"
                    >
                      <title>{`${bar.fullName}: کارکرد ${formatToman(bar.exactGrossToman)} · سهم پزشک ${formatToman(bar.exactDocToman)}`}</title>
                      <rect
                        x={bar.x}
                        y={bar.grossY}
                        width={bar.subW}
                        height={bar.grossH}
                        rx={5}
                        fill={isActive ? '#0284c7' : '#7dd3fc'}
                      />
                      <rect
                        x={bar.x + bar.subW + 4}
                        y={bar.docY}
                        width={bar.subW}
                        height={bar.docH}
                        rx={5}
                        fill={isActive ? '#059669' : '#34d399'}
                      />
                      {bar.clinicH > 0 && (
                        <rect
                          x={bar.x + bar.subW + 4}
                          y={bar.clinicY}
                          width={bar.subW}
                          height={bar.clinicH}
                          rx={4}
                          fill="#fbbf24"
                          opacity={0.85}
                        />
                      )}
                      <text
                        x={bar.x + bar.bw / 2}
                        y={bar.grossY - 4}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="800"
                        fill={isActive ? '#065f46' : '#475569'}
                      >
                        {`${toPersianDigits(bar.docM)}م`}
                      </text>
                      <text
                        x={bar.x + bar.bw / 2}
                        y={d3DoctorComparison.height - 9}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight={isActive ? '900' : '700'}
                        fill={isActive ? '#064e3b' : '#334155'}
                      >
                        {bar.shortName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Dual Ledger Breakdown: Doctor Registered Work vs Clinic Patient Payments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Ledger A: Doctor Work-Only Commission */}
            <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                <span className="font-black text-emerald-950 text-xs">
                  الف) دفتر کارکرد ثبت‌شده {doctorLedger.doctorName}
                </span>
                <span className="text-[9px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  مستقل از پرداخت بیمار
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-slate-600">کل کارکرد درمانی ثبت‌شده:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatToman(doctorLedger.totalRegisteredGrossWork)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-emerald-100 text-rose-700">
                  <span className="flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" />
                    کسر هزینه لابراتوار پروتز:
                  </span>
                  <span className="font-mono font-bold">
                    − {formatToman(doctorLedger.totalAssignedLabDeductions)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-slate-600">مبنای خالص کارکرد ثبت‌شده:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatToman(doctorLedger.netCommissionableBase)}
                  </span>
                </div>

                <div className="flex justify-between pt-1 font-black text-xs text-emerald-800">
                  <span>سهم قطعی پزشک:</span>
                  <span className="font-mono">
                    {formatExactMicroToman(doctorLedger.exactDoctorPayable, showMicroPrecision)}
                  </span>
                </div>

                {!doctorLedger.isManager && (
                  <div className="flex justify-between pt-1 text-[10.5px] font-bold text-sky-900 border-t border-emerald-200/60">
                    <span>سهم مطب و مدیر از این کارکرد:</span>
                    <span className="font-mono">{formatToman(doctorLedger.exactClinicRetainedShare)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ledger B: Clinic & Manager Patient Receivables (100% Separate) */}
            <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="font-black text-amber-950 text-xs">
                  ب) دفتر پرداخت‌ها و بدهی بیماران به مطب
                </span>
                <span className="text-[9px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                  ویژه مطب و مدیر
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between py-1 border-b border-amber-100">
                  <span className="text-slate-600">کل وصولی نقد و پوز مطب:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatToman(clinicReceivables.totalCollectedCashAndPos)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-amber-100">
                  <span className="text-slate-600">چک‌های صیادی در جریان وصول مطب:</span>
                  <span className="font-mono font-bold text-purple-800">
                    {formatToman(clinicReceivables.totalPendingChecksInSafe)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-amber-100">
                  <span className="text-slate-600">اقساط سررسیدنشده بیماران به مطب:</span>
                  <span className="font-mono font-bold text-amber-800">
                    {formatToman(clinicReceivables.totalPendingInstallments)}
                  </span>
                </div>

                <div className="flex justify-between pt-1 font-black text-xs text-rose-700">
                  <span>کل بدهی واقعی بیماران به مطب:</span>
                  <span className="font-mono">
                    {formatExactMicroToman(clinicReceivables.totalOutstandingPatientDebtToClinic, showMicroPrecision)}
                  </span>
                </div>
                <span className="text-[9.5px] text-amber-900 font-bold block">
                  * بدهی بیماران به مطب هیچ کسری روی سهم کارکرد پزشک ایجاد نمی‌کند.
                </span>
              </div>
            </div>
          </div>

          {/* Live Registered Treatments List for Selected Doctor */}
          {doctorLedger.workItems.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ریز درمان‌های ثبت‌شده اخیر در پرونده‌ها برای {doctorLedger.doctorName}:</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  زمان محاسبه: {toPersianDigits(doctorLedger.executionTimeMicroSec)} میکروثانیه
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                {doctorLedger.workItems.map(item => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-[10.5px]"
                  >
                    <div>
                      <span className="font-black text-slate-900">{item.patientName}</span>
                      <span className="text-slate-500 mx-1">·</span>
                      <span className="font-bold text-emerald-800">{item.treatmentTitle}</span>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-slate-500 text-[9.5px] ml-2">
                        تعرفه: {formatToman(item.grossFee)}
                      </span>
                      <span className="font-black text-emerald-700">
                        سهم: {formatToman(item.doctorCommission)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bright Pastel Separation Summary Card */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-[10.5px] font-bold text-slate-700">
                سهم پزشک صرفاً از درمان‌های ثبت‌شده محاسبه می‌شود و کلیه مطالبات بیماران متعلق به صندوق مطب است.
              </span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-white/95 flex flex-wrap items-center justify-between gap-2 shrink-0 sticky bottom-0 z-20 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('success');
                showToast(`فیش تسویه کارکرد ${doctorLedger.doctorName} برای چاپ آماده شد.`);
                try {
                  if (typeof window !== 'undefined' && typeof window.print === 'function') {
                    window.print();
                  }
                } catch {}
              }}
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>چاپ فیش کارکرد</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                const header = 'نام پزشک,تخصص,مدل سهم‌بندی,کل کارکرد ثبت‌شده (تومان),کسر لابراتوار (تومان),خالص مبنای سهم (تومان),سهم قطعی پزشک (تومان),سهم مطب (تومان)';
                const row = `"${doctorLedger.doctorName}","${doctorLedger.specialty}","${doctorLedger.calculationAuditFormula}",${doctorLedger.totalRegisteredGrossWork},${doctorLedger.totalAssignedLabDeductions},${doctorLedger.netCommissionableBase},${doctorLedger.exactDoctorPayable},${doctorLedger.exactClinicRetainedShare}`;
                const csv = `\uFEFF${header}\n${row}`;
                try {
                  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Doctor_Commission_${doctorLedger.doctorId}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                } catch {}
                showToast(`فایل اکسل (CSV) کارکرد ${doctorLedger.doctorName} آماده و دانلود شد.`);
              }}
              className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-extrabold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <span>خروجی CSV کارکرد</span>
            </button>

            <button
              type="button"
              onClick={handleCopySettlementSummary}
              className="py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-extrabold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>کپی فیش واتساپ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>ثبت و تأیید سهم‌بندی کارکرد</span>
          </button>
        </div>

      </div>
      </div>
    </ViewportModalPortal>
  );
};
