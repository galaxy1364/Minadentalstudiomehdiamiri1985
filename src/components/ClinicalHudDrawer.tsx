import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, AlertTriangle, HeartPulse, Activity, CreditCard, 
  FileText, Layers, FlaskConical, ShieldAlert,
  CheckCircle2, Clock, Sparkles
} from 'lucide-react';
import { Appointment, Patient, TreatmentType } from '../types/dental';
import { toPersianDigits, formatToman, toEnglishDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import {
  predictClinicalAppointmentDuration,
  inferTreatmentTypeFromLabel,
  analyzeAppointmentDurationWithAi
} from '../utils/treatmentIntelligence';

interface ClinicalHudDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  patients: Patient[];
  appointments?: Appointment[];
  onSelectPatient: (p: Patient) => void;
  onOpenPatientFile: (p: Patient) => void;
  onOpenPalmerChart: (p: Patient) => void;
  onOpenPaymentModal: (p: Patient) => void;
  onOpenAppointmentModal?: (p: Patient) => void;
}

const PREDICTOR_TREATMENT_OPTIONS: Array<{ value: TreatmentType; label: string }> = [
  { value: 'composite', label: 'ترمیم کامپوزیت' },
  { value: 'endo', label: 'عصب‌کشی تخصصی (اندو)' },
  { value: 'implant', label: 'جراحی کاشت ایمپلنت' },
  { value: 'crown_zirconia', label: 'قالب‌گیری و تحویل روکش زیرکونیا' },
  { value: 'crown_pfm', label: 'روکش PFM' },
  { value: 'laminate', label: 'لمینت سرامیکی E-Max' },
  { value: 'extraction', label: 'کشیدن دندان / جراحی' },
  { value: 'scaling', label: 'جرم‌گیری و بروساژ' },
  { value: 'pulpotomy', label: 'پالپوتومی اطفال' }
];

export const ClinicalHudDrawer: React.FC<ClinicalHudDrawerProps> = ({
  isOpen,
  onClose,
  patient,
  patients,
  appointments = [],
  onSelectPatient,
  onOpenPatientFile,
  onOpenPalmerChart,
  onOpenPaymentModal
}) => {
  const { impactLight, selection } = useHapticFeedback();
  const [patientSelectorOpen, setPatientSelectorOpen] = useState(false);
  useEscapeKey(isOpen, onClose);

  // Active patient or default to first patient
  const activePatient = patient || patients[0] || null;

  // Match active or upcoming appointment for this patient
  const matchingAppointment = useMemo(() => {
    if (!activePatient) return null;
    const byId = appointments.find(
      (a) => a.patientId === activePatient.id && a.status !== 'completed' && a.status !== 'cancelled'
    );
    if (byId) return byId;
    return appointments.find((a) => a.patientName === activePatient.fullName) || null;
  }, [activePatient, appointments]);

  const extractDefaultStartTime = (pat: Patient | null, appt: Appointment | null): string => {
    if (appt?.time) {
      const en = toEnglishDigits(appt.time).match(/(\d{1,2}:\d{1,2})/);
      if (en) return en[1];
    }
    if (pat?.nextAppointment) {
      const en = toEnglishDigits(pat.nextAppointment).match(/(\d{1,2}:\d{1,2})/);
      if (en) return en[1];
    }
    return '16:30';
  };

  const inferDefaultTreatment = (pat: Patient | null, appt: Appointment | null): TreatmentType => {
    if (appt?.treatment) {
      return inferTreatmentTypeFromLabel(appt.treatment);
    }
    const ongoing = Object.values(pat?.teethConditions || {}).find((c) => c.status !== 'completed');
    if (ongoing?.treatment) return ongoing.treatment;
    return 'composite';
  };

  const [predictorTreatment, setPredictorTreatment] = useState<TreatmentType>(() =>
    inferDefaultTreatment(activePatient, matchingAppointment)
  );
  const [predictorStartTime, setPredictorStartTime] = useState<string>(() =>
    extractDefaultStartTime(activePatient, matchingAppointment)
  );
  const [aiAdviceText, setAiAdviceText] = useState<string | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);

  useEffect(() => {
    setPredictorTreatment(inferDefaultTreatment(activePatient, matchingAppointment));
    setPredictorStartTime(extractDefaultStartTime(activePatient, matchingAppointment));
    setAiAdviceText(null);
  }, [activePatient?.id, matchingAppointment?.id]);

  const durationPrediction = useMemo(() => {
    const ongoingTooth = Object.values(activePatient?.teethConditions || {}).find(
      (c) => c.treatment === predictorTreatment
    );
    return predictClinicalAppointmentDuration({
      patient: activePatient,
      plannedTreatment: predictorTreatment,
      toothNumber: ongoingTooth?.toothNumber || 6,
      surfaces: ongoingTooth?.surfaces || ['occlusal', 'mesial'],
      startTime: predictorStartTime,
      appointment: matchingAppointment
    });
  }, [activePatient, predictorTreatment, predictorStartTime, matchingAppointment]);

  if (!isOpen) return null;

  if (!activePatient) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="کنسول بالینی شناور"
        className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs"
      >
        <div className="w-full max-w-sm bg-white h-full p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="font-black text-sm">کنسول بالینی شناور</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن کنسول بالینی"
              className="min-w-[38px] min-h-[38px] rounded-[12px] hover:bg-slate-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-slate-500 text-xs">بیماری جهت نمایش بالینی انتخاب نشده است.</p>
        </div>
      </div>
    );
  }

  // Detect critical medical alerts
  const criticalAllergies = activePatient.medicalHistory.filter(h => 
    h.includes('حساسیت') || h.includes('آلرژی') || h.includes('پنی‌سیلین') || h.includes('لاتکس')
  );
  const systemicAlerts = activePatient.medicalHistory.filter(h => 
    !h.includes('حساسیت') && !h.includes('آلرژی') && !h.includes('پنی‌سیلین') && !h.includes('لاتکس')
  );

  // Active teeth under treatment
  const ongoingTeeth = Object.entries(activePatient.teethConditions || {}).filter(
    ([_, c]) => c.status === 'in_progress' || c.status === 'planned'
  );

  const handleRequestAiAdvice = async () => {
    selection();
    setAiAdviceLoading(true);
    try {
      const response = await analyzeAppointmentDurationWithAi(activePatient, durationPrediction);
      setAiAdviceText(response);
    } finally {
      setAiAdviceLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 select-none">
      {/* Backdrop Click Dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* Main Slide-Over HUD Drawer */}
      <div 
        className="relative w-full max-w-md bg-white text-slate-900 h-full flex flex-col shadow-2xl border-r border-slate-200 overflow-hidden animate-in slide-in-from-right duration-250"
        role="dialog"
        aria-modal="true"
        aria-label="کنسول بالینی شناور"
      >
        {/* Top Header */}
        <div className="p-3.5 bg-gradient-to-r from-teal-50 via-white to-emerald-50 border-b border-teal-200/80 text-slate-900 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">
              خلاصه وضعیت بالینی بیمار
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              impactLight();
              onClose();
            }}
            className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
            aria-label="بستن کنسول"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patient Switcher Bar */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              {activePatient.fullName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 truncate">
                  {activePatient.fullName}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  (پرونده: {toPersianDigits(activePatient.fileNumber)})
                </span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-mono">
                {toPersianDigits(activePatient.phone)}
              </span>
            </div>
          </div>

          <button type="button"
            onClick={() => {
              selection();
              setPatientSelectorOpen(!patientSelectorOpen);
            }}
            className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg border border-teal-200 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            تغییر بیمار
          </button>
        </div>

        {/* Quick Patient Selector Dropdown */}
        {patientSelectorOpen && (
          <div className="max-h-48 overflow-y-auto bg-slate-100 border-b border-slate-300 p-1.5 space-y-1">
            {patients.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  selection();
                  onSelectPatient(p);
                  setPatientSelectorOpen(false);
                }}
                className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                  p.id === activePatient.id 
                    ? 'bg-teal-600 text-white font-bold' 
                    : 'bg-white hover:bg-slate-200 text-slate-800'
                }`}
              >
                <span>{p.fullName}</span>
                <span className="text-[10px] font-mono">{toPersianDigits(p.fileNumber)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          
          {/* 1. Critical Red Medical Alerts & Allergies (Priority One) */}
          {(criticalAllergies.length > 0 || systemicAlerts.length > 0) ? (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-300/80 text-red-950 shadow-2xs space-y-2">
              <div className="flex items-center gap-1.5 text-red-700">
                <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-black">هشدار حیاتی و حساسیت‌های دارویی</span>
              </div>
              
              {criticalAllergies.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {criticalAllergies.map((allergy, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 rounded-md bg-red-600 text-white font-bold text-[10.5px] flex items-center gap-1 shadow-xs"
                    >
                      <AlertTriangle className="w-3 h-3 stroke-[3]" />
                      {allergy}
                    </span>
                  ))}
                </div>
              )}

              {systemicAlerts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {systemicAlerts.map((med, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center gap-1"
                    >
                      <HeartPulse className="w-3 h-3 text-amber-700" />
                      {med}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">بدون سابقه آلرژی یا بیماری سیستمیک ثبت‌شده</span>
            </div>
          )}

          {/* 1B. AI-Driven Treatment Duration Predictor */}
          <div
            data-testid="hud-duration-predictor"
            className="p-3 rounded-2xl bg-gradient-to-bl from-indigo-50/80 via-white to-violet-50/70 border border-indigo-200/90 shadow-2xs space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900 truncate">
                    پیش‌بینی هوشمند زمان درمان (AI)
                  </h4>
                  <span className="text-[10px] font-bold text-indigo-700 block truncate">
                    تحلیل سوابق دندانی، ریسک پزشکی و ساعت پایان نوبت
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${
                  durationPrediction.complexityLevel === 'پیشرفته و پیچیده'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : durationPrediction.complexityLevel === 'متوسط'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {durationPrediction.complexityLevel}
              </span>
            </div>

            {/* Interactive Predictor Inputs */}
            <div className="grid grid-cols-12 gap-1.5 text-[11px]">
              <div className="col-span-8">
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">درمان نوبت</label>
                <select
                  aria-label="انتخاب درمان برای پیش‌بینی زمان پایان"
                  value={predictorTreatment}
                  onChange={(e) => {
                    selection();
                    setPredictorTreatment(e.target.value as TreatmentType);
                  }}
                  className="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {PREDICTOR_TREATMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ساعت شروع</label>
                <input
                  type="text"
                  aria-label="ساعت شروع نوبت"
                  dir="ltr"
                  value={predictorStartTime}
                  onChange={(e) => setPredictorStartTime(e.target.value)}
                  placeholder="16:30"
                  className="w-full bg-white border border-indigo-200 rounded-xl px-2 py-1.5 text-center text-[11px] font-mono font-black text-slate-900 focus:outline-none focus:border-indigo-500 tabular-nums"
                />
              </div>
            </div>

            {/* Predicted Duration & End-Time Summary */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums">
              <div className="p-2 rounded-xl bg-white border border-indigo-100">
                <span className="text-[9px] text-slate-500 font-sans block">مدت صندلی تخمینی</span>
                <span className="text-xs font-black text-indigo-800">
                  {toPersianDigits(durationPrediction.estimatedMinutes)} دقیقه
                </span>
                <span className="text-[9px] text-slate-400 font-sans block">
                  بازه {toPersianDigits(durationPrediction.minMinutes)} تا {toPersianDigits(durationPrediction.maxMinutes)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-indigo-600 text-white border border-indigo-700 shadow-2xs">
                <span className="text-[9px] text-indigo-100 font-sans block">ساعت پایان نوبت</span>
                <span className="text-sm font-black block mt-0.5" data-testid="hud-predicted-end-time">
                  {durationPrediction.predictedEndTimeFa}
                </span>
                <span className="text-[9px] text-indigo-100 font-sans block">
                  شروع: {durationPrediction.startTimeFa}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-indigo-100">
                <span className="text-[9px] text-slate-500 font-sans block">دقت الگوریتم</span>
                <span className="text-xs font-black text-emerald-700">
                  {toPersianDigits(durationPrediction.confidencePercent)}٪
                </span>
                <span className="text-[9px] text-slate-400 font-sans block">
                  {toPersianDigits(durationPrediction.factors.length)} عامل بالینی
                </span>
              </div>
            </div>

            {/* Complexity Factors Breakdown */}
            <div className="space-y-1">
              {durationPrediction.factors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-xl bg-white/90 border border-slate-200/80 text-[10px]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-black text-slate-800 block truncate">{f.label}</span>
                    <span className="text-[9.5px] text-slate-500 block truncate">{f.reason}</span>
                  </div>
                  <span className="font-mono font-black text-indigo-700 shrink-0 tabular-nums">
                    {f.category === 'protocol' ? '' : '+'}{toPersianDigits(f.deltaMinutes)} دق
                  </span>
                </div>
              ))}
            </div>

            {/* Optional Deeper Gemini Consultation Button */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[9.5px] text-slate-500 font-bold leading-snug flex-1">
                {durationPrediction.clinicalSummary}
              </span>
              <button
                type="button"
                onClick={handleRequestAiAdvice}
                disabled={aiAdviceLoading}
                className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>{aiAdviceLoading ? 'در حال تحلیل...' : 'پیشنهاد جمنای'}</span>
              </button>
            </div>

            {aiAdviceText && (
              <div className="p-2 rounded-xl bg-white border border-indigo-200 text-[10.5px] text-slate-700 leading-relaxed whitespace-pre-line">
                {aiAdviceText}
              </div>
            )}
          </div>

          {/* 2. Live Financial Status & Balance */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                وضعیت مالی و مانده حساب
              </span>
              <span className={`font-black text-xs px-2 py-0.5 rounded-full ${
                activePatient.balance < 0 
                  ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {activePatient.balance < 0 ? 'بدهکار' : 'تسویه / بستانکار'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-[9px] text-slate-500 font-sans block">کل درمان</span>
                <span className="text-[11px] font-black text-slate-900">
                  {formatToman(activePatient.totalCost)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-[9px] text-slate-500 font-sans block">پرداختی</span>
                <span className="text-[11px] font-black text-emerald-700">
                  {formatToman(activePatient.paidAmount)}
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${activePatient.balance < 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                <span className="text-[9px] text-slate-500 font-sans block">مانده بدهی</span>
                <span className={`text-[11px] font-black ${activePatient.balance < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                  {formatToman(Math.abs(activePatient.balance))}
                </span>
              </div>
            </div>

            {/* Pending Sayad Checks or Installments Alert */}
            {activePatient.sayadChecks && activePatient.sayadChecks.length > 0 && (
              <div className="text-[10.5px] text-slate-600 bg-amber-50/70 p-2 rounded-xl border border-amber-200/80 flex items-center justify-between">
                <span>چک‌های صیادی در جریان:</span>
                <span className="font-bold text-amber-900">
                  {toPersianDigits(activePatient.sayadChecks.filter(c => c.status === 'in_collection').length)} فقره
                </span>
              </div>
            )}
          </div>

          {/* 3. Active Teeth Under Treatment (Mini Palmer) */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                دندان‌های در دست اقدام ({toPersianDigits(ongoingTeeth.length)})
              </span>
              <button type="button"
                onClick={() => {
                  impactLight();
                  onOpenPalmerChart(activePatient);
                }}
                className="text-[10px] text-teal-700 font-bold hover:underline cursor-pointer"
              >
                چارت کامل
              </button>
            </div>

            {ongoingTeeth.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ongoingTeeth.map(([key, cond]) => (
                  <div 
                    key={key} 
                    className="p-1.5 px-2.5 rounded-xl bg-white border border-teal-200 flex items-center gap-2 shadow-2xs"
                  >
                    <span className="text-xs font-black text-teal-900">
                      دندان {toPersianDigits(cond.toothNumber)} {cond.quadrant}
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {cond.treatment}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">درمان فعالی برای این بیمار در جریان نیست.</p>
            )}
          </div>

          {/* 4. Active Lab Orders */}
          {activePatient.labOrders && activePatient.labOrders.length > 0 && (
            <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-purple-900 font-bold">
                <span className="flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                  سفارش لابراتوار فعال
                </span>
                <span className="text-[10px] text-purple-700">
                  {toPersianDigits(activePatient.labOrders.length)} مورد
                </span>
              </div>
              {activePatient.labOrders.map(order => (
                <div key={order.id} className="p-2 rounded-xl bg-white border border-purple-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{order.workType}</span>
                    <span className="text-[10px] text-slate-500">رنگ: {order.shade} · دندان {order.toothNumber}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {order.status === 'ready_for_clinic' ? 'آماده تحویل' : 'در دست ساخت'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 5. Active Implant Cases */}
          {activePatient.implantCases && activePatient.implantCases.length > 0 && (
            <div className="p-3 rounded-2xl bg-cyan-50/70 border border-cyan-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-cyan-950 font-bold">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-700" />
                  مراحل کاشت ایمپلنت
                </span>
                <span className="text-[10px] text-cyan-700">
                  {toPersianDigits(activePatient.implantCases.length)} واحد
                </span>
              </div>
              {activePatient.implantCases.map(imp => (
                <div key={imp.id} className="p-2 rounded-xl bg-white border border-cyan-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      دندان {toPersianDigits(imp.toothNumber)} · {imp.brand}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {imp.diameter}x{imp.length}mm
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                    {imp.currentStage === 'fixture_placed' ? 'کاشت فیکسچر' : 
                     imp.currentStage === 'healing_cap' ? 'هیلینگ' : 
                     imp.currentStage === 'impression' ? 'قالب‌گیری' : 'آماده روکش'}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Bottom Quick-Action Buttons (Glove-Friendly Large Touch Targets) */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-2">
          {/* Quick Payment POS */}
          <button type="button"
            onClick={() => {
              impactLight();
              onOpenPaymentModal(activePatient);
            }}
            className="py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>ثبت دریافت</span>
          </button>

          {/* Open Palmer Chart */}
          <button type="button"
            onClick={() => {
              impactLight();
              onOpenPalmerChart(activePatient);
            }}
            className="py-2.5 px-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>چارت پالمر</span>
          </button>

          {/* Full Patient File */}
          <button type="button"
            onClick={() => {
              impactLight();
              onOpenPatientFile(activePatient);
            }}
            className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>پرونده کامل</span>
          </button>
        </div>

      </div>
    </div>
  );
};

