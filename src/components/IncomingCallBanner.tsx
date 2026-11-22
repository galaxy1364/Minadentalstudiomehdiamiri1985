import React, { useEffect, useMemo, useState } from 'react';
import { 
  PhoneIncoming, Calendar, UserPlus, 
  FileText, X, AlertCircle, FlaskConical, ShieldAlert, Clock, Copy, Check
} from 'lucide-react';
import { Patient, Appointment, IncomingCallEvent } from '../types/dental';
import { toPersianDigits, formatToman, getCurrentPersianDate, getRelativePersianDate, isSamePersianDate } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';
import { analyzePatient360 } from '../utils/clinicalIntelligence';
import { copyTextSafely } from '../utils/clipboard';

interface IncomingCallBannerProps {
  call: IncomingCallEvent | null;
  appointments?: Appointment[];
  onClose: () => void;
  onScheduleAppointment: (patientName?: string, phone?: string, suggestedTreatment?: string, time?: string, date?: string) => void;
  onOpenPatientFile: (patient: Patient) => void;
  onQuickAdmission: (phone?: string) => void;
}

export const IncomingCallBanner: React.FC<IncomingCallBannerProps> = ({
  call,
  appointments = [],
  onClose,
  onScheduleAppointment,
  onOpenPatientFile,
  onQuickAdmission
}) => {
  const [callerNameDraft, setCallerNameDraft] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  useEffect(() => {
    if (call) {
      triggerHaptic('warning');
      setCallerNameDraft('');
      setCopiedPhone(false);
    }
  }, [call?.id]);

  const patient = call?.matchedPatient;
  const summary = useMemo(() => {
    if (!patient) return null;
    return analyzePatient360(patient, appointments);
  }, [patient, appointments]);

  const todayDate = getCurrentPersianDate();
  const tomorrowDate = getRelativePersianDate(1);

  const smartSlots = useMemo(() => {
    const pickFreeSlot = (targetDate: string, candidates: string[]) => {
      const taken = new Set(
        appointments
          .filter((a) => a.status !== 'cancelled' && isSamePersianDate(a.date, targetDate))
          .map((a) => toPersianDigits(a.time))
      );
      return candidates.find((slot) => !taken.has(slot)) || candidates[0];
    };
    return {
      today: pickFreeSlot(todayDate, ['۱۷:۰۰', '۱۷:۳۰', '۱۸:۰۰', '۱۸:۳۰', '۱۹:۰۰']),
      tomorrow: pickFreeSlot(tomorrowDate, ['۱۰:۳۰', '۱۱:۰۰', '۱۱:۳۰', '۱۶:۰۰', '۱۶:۳۰'])
    };
  }, [appointments, todayDate, tomorrowDate]);

  if (!call) return null;

  const isExistingPatient = !!patient;
  const isDebtor = patient && patient.balance < 0;

  const suggestedTreatment = summary?.readyLabOrders.length
    ? `تحویل و سمان ${summary.readyLabOrders[0].workType} (${summary.readyLabOrders[0].toothNumber})`
    : summary?.activeImplants.some((i) => i.currentStage === 'healing_cap')
    ? `قالب‌گیری پروتز ایمپلنت`
    : !isExistingPatient
    ? 'معاینه و تشکیل پرونده اولیه'
    : undefined;

  const handleSchedule = (quickTime?: string, quickDate?: string) => {
    triggerHaptic('medium');
    onClose();
    if (isExistingPatient) {
      onScheduleAppointment(patient.fullName, patient.phone, suggestedTreatment, quickTime, quickDate);
    } else {
      const resolvedName = callerNameDraft.trim() || 'بیمار جدید';
      onScheduleAppointment(resolvedName, call.phoneNumber, suggestedTreatment, quickTime, quickDate);
    }
  };

  const handleOpenRecord = () => {
    triggerHaptic('medium');
    onClose();
    if (patient) {
      onOpenPatientFile(patient);
    } else {
      onQuickAdmission(call.phoneNumber);
    }
  };

  return (
    <div
      role="region"
      aria-live="assertive"
      aria-label="تماس ورودی کلینیک"
      className="fixed top-2.5 inset-x-2 sm:inset-x-auto sm:right-4 sm:w-[430px] z-50 select-none animate-in slide-in-from-top-3 duration-300"
      dir="rtl"
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-[24px] p-3.5 border-2 border-emerald-500/80 shadow-[0_12px_40px_rgba(5,150,105,0.28)] flex flex-col gap-2.5">
        
        {/* Top Header & Incoming Ringing Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Caller Avatar */}
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs ring-3 ring-emerald-200/80">
                <PhoneIncoming className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  تماس ورودی مطب (۳۶۰ درجه)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {isExistingPatient ? 'دارای پرونده فعال · پایش هوشمند' : 'شماره جدید — پیشنهاد پذیرش و نوبت فوری'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            aria-label="بستن اعلان تماس"
            className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            title="بستن اعلان تماس"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Caller Information Card */}
        {isExistingPatient && summary ? (
          /* Case A: Patient Has Existing Dental Record */
          <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                  {patient.fullName.slice(0, 1)}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">{patient.fullName}</h4>
                  <span className="text-[10px] text-slate-500 font-mono" dir="ltr">{patient.phone}</span>
                </div>
              </div>

              <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full font-mono">
                پرونده #{toPersianDigits(patient.fileNumber || patient.id.replace('p', ''))}
              </span>
            </div>

            {/* Live 360 Clinical Brief Pills */}
            {(summary.hasSystemicAlert ||
              summary.readyLabOrders.length > 0 ||
              summary.bouncedChecksCount > 0 ||
              summary.unpaidInstallmentsCount > 0 ||
              summary.guaranteeReadyForReturn ||
              summary.nextAppointment) && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {summary.hasSystemicAlert && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 text-[9.5px] font-black">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span>{summary.systemicAlertText}</span>
                  </span>
                )}
                {summary.readyLabOrders.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-200 text-[9.5px] font-black">
                    <FlaskConical className="w-3 h-3 shrink-0" />
                    <span>{toPersianDigits(summary.readyLabOrders.length)} کار لابراتوار آماده تحویل</span>
                  </span>
                )}
                {summary.bouncedChecksCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 text-[9.5px] font-black">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{toPersianDigits(summary.bouncedChecksCount)} چک برگشتی</span>
                  </span>
                )}
                {summary.unpaidInstallmentsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-200 text-[9.5px] font-black">
                    <span>
                      {toPersianDigits(summary.unpaidInstallmentsCount)} قسط باز
                      {summary.overdueInstallmentsCount > 0
                        ? ` (${toPersianDigits(summary.overdueInstallmentsCount)} معوق)`
                        : ''}
                    </span>
                  </span>
                )}
                {summary.guaranteeReadyForReturn && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9.5px] font-black">
                    <span>چک ضمانت آماده عودت ✓</span>
                  </span>
                )}
                {summary.nextAppointment && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-100 text-sky-900 border border-sky-200 text-[9.5px] font-black">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>نوبت بعدی: {toPersianDigits(summary.nextAppointment.date)} · {toPersianDigits(summary.nextAppointment.time)}</span>
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10.5px]">
              <span className="text-slate-600">وضعیت حساب مالی:</span>
              <span className={`font-mono font-bold ${isDebtor ? 'text-rose-600' : 'text-emerald-700'}`}>
                {isDebtor ? `بدهی: ${formatToman(Math.abs(patient.balance))}` : 'تسویه حساب کامل'}
              </span>
            </div>
          </div>
        ) : (
          /* Case B: Patient Does NOT Have a Record */
          <div className="p-2.5 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 font-mono" dir="ltr">
                  {call.phoneNumber}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void copyTextSafely(call.phoneNumber);
                    setCopiedPhone(true);
                    setTimeout(() => setCopiedPhone(false), 2000);
                  }}
                  aria-label="کپی شماره تماس‌گیرنده"
                  className="px-1.5 py-0.5 rounded-md bg-white border border-amber-200 text-[9.5px] font-bold text-amber-800 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                >
                  {copiedPhone ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedPhone ? 'کپی شد' : 'کپی'}</span>
                </button>
              </div>
              <span className="text-[9.5px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                بیمار جدید
              </span>
            </div>
            <p className="text-[10.5px] text-amber-800">
              این شماره فاقد سابقه پرونده قبلی در سیستم مینادنتال است.
            </p>
            <input
              type="text"
              aria-label="نام تماس‌گیرنده جدید"
              value={callerNameDraft}
              onChange={(e) => setCallerNameDraft(e.target.value)}
              placeholder="نام تماس‌گیرنده حین مکالمه (اختیاری)..."
              className="w-full bg-white border border-amber-300/80 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Quick 1-Tap Conflict-Free Suggested Appointment Slots */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-slate-500 font-bold">پیشنهاد سریع وقت خالی:</span>
          <button
            type="button"
            onClick={() => handleSchedule(smartSlots.today, todayDate)}
            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black cursor-pointer active:scale-95"
          >
            امروز {smartSlots.today}
          </button>
          <button
            type="button"
            onClick={() => handleSchedule(smartSlots.tomorrow, tomorrowDate)}
            className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-black cursor-pointer active:scale-95"
          >
            فردا {smartSlots.tomorrow}
          </button>
        </div>

        {/* Action Buttons: Suggested Scheduling & Record Inspection */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Primary Action: Suggest Schedule Appointment */}
          <button type="button"
            onClick={() => handleSchedule()}
            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{isExistingPatient && summary?.readyLabOrders.length ? 'نوبت تحویل / ادامه' : 'پیشنهاد تعیین نوبت'}</span>
          </button>

          {/* Secondary Action: Open Record or New File */}
          <button type="button"
            onClick={handleOpenRecord}
            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-slate-200 cursor-pointer"
          >
            {isExistingPatient ? (
              <>
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>مشاهده پرونده</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>تشکیل پرونده جدید</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

