import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Patient, LabOrder, ReminderConfig } from '../types/dental';
import { formatToman, getCurrentPersianDate, getPersianDateParts, toEnglishDigits } from '../utils/jalali';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { ReminderOptionPicker } from './ReminderOptionPicker';
import { getDefaultReminderConfig } from '../services/reminderNotificationService';

interface AddLabOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onAddOrder: (order: LabOrder) => void;
  initialPatientId?: string;
  initialToothNumber?: string;
  initialWorkType?: string;
}

export const AddLabOrderModal: React.FC<AddLabOrderModalProps> = ({
  isOpen,
  onClose,
  patients,
  onAddOrder,
  initialPatientId,
  initialToothNumber,
  initialWorkType
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || patients[0]?.id || '');
  useEscapeKey(isOpen, onClose);
  const [workType, setWorkType] = useState('روکش تمام زیرکونیا');
  const [toothNumber, setToothNumber] = useState('دندان ۶ بالا راست (UR6)');
  const [labName, setLabName] = useState('لابراتوار دیجیتال پیشرو (دکتر کمالی)');
  const [partnerLabOptions, setPartnerLabOptions] = useState<string[]>([
    'لابراتوار دیجیتال پیشرو (دکتر کمالی)',
    'لابراتوار پروتز پویا (تخصصی متحرک)',
    'لابراتوار زیبایی آریا E-Max'
  ]);
  const [shade, setShade] = useState('A2');
  const [useLayeredShade, setUseLayeredShade] = useState(false);
  const [incisalShade, setIncisalShade] = useState('A1');
  const [bodyShade, setBodyShade] = useState('A2');
  const [cervicalShade, setCervicalShade] = useState('A3');
  const [stumpShade, setStumpShade] = useState('ND2');
  const [marginType, setMarginType] = useState('Deep Chamfer');
  const [instructions, setInstructions] = useState('');
  const [sendDate] = useState(() => getCurrentPersianDate());
  const [deliveryDate, setDeliveryDate] = useState(() => getPersianDateParts(new Date(Date.now() + 7 * 86400000)).formatted);
  const [appointmentDate, setAppointmentDate] = useState(() => getPersianDateParts(new Date(Date.now() + 8 * 86400000)).formatted);
  const [cost, setCost] = useState(2500000);
  const [courierName, setCourierName] = useState('');
  const [trackingSlipCode, setTrackingSlipCode] = useState(() => `SLIP-${toEnglishDigits(Date.now().toString().slice(-5))}`);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('1d_before'));
  const [confirmStep, setConfirmStep] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialPatientId) {
        setSelectedPatientId(initialPatientId);
      } else if (!selectedPatientId && patients[0]) {
        setSelectedPatientId(patients[0].id);
      }
      if (initialToothNumber) {
        setToothNumber(initialToothNumber);
      }
      if (initialWorkType) {
        setWorkType(initialWorkType);
      }
      setTrackingSlipCode(`SLIP-${toEnglishDigits(Date.now().toString().slice(-5))}`);
      setConfirmStep(false);
      try {
        const savedLabs = localStorage.getItem('minadental_partner_labs_v1');
        if (savedLabs) {
          const parsed = JSON.parse(savedLabs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const names = parsed.map((l: any) => l.name).filter(Boolean);
            if (names.length > 0) {
              setPartnerLabOptions(names);
              if (!names.includes(labName)) {
                setLabName(names[0]);
              }
            }
          }
        }
      } catch {}
    }
  }, [isOpen, initialPatientId, initialToothNumber, initialWorkType, patients]);

  if (!isOpen) return null;

  const updateLayeredShade = (inc: string, bod: string, cerv: string, stump = stumpShade) => {
    setIncisalShade(inc);
    setBodyShade(bod);
    setCervicalShade(cerv);
    setStumpShade(stump);
    setShade(`I:${inc} / B:${bod} / C:${cerv} (Stump:${stump})`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    const courierNote = courierName.trim() ? ` · پیک/رسید: ${courierName.trim()}` : '';
    const newOrder: LabOrder = {
      id: `lab-${Date.now()}`,
      patientId: selectedPatientId,
      patientName: patient.fullName,
      toothNumber,
      workType,
      labName,
      shade,
      stumpShade,
      marginType,
      instructions: instructions.trim() || undefined,
      sendDate,
      deliveryDate,
      appointmentDate,
      status: 'sent',
      cost,
      courierName: courierName.trim() || undefined,
      trackingSlipCode: trackingSlipCode.trim() || undefined,
      reminderConfig,
      reminderNotice: `کار با کد قبض ${trackingSlipCode} در تاریخ ${deliveryDate} آماده و قبل از نوبت بیمار پیگیری شود.${courierNote}`
    };

    onAddOrder(newOrder);
    setConfirmStep(false);
    onClose();
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ثبت سفارش جدید لابراتوار پروتز"
        className="fixed inset-0 z-[100] bg-purple-950/45 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        onClick={onClose}
      >
        <form
          dir="rtl"
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-purple-50/95 via-white to-fuchsia-50/40 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-purple-200/90 shadow-2xl flex flex-col overflow-hidden text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3 border-b border-purple-200/80 bg-white/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-purple-300/80 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ثبت سفارش لابراتوار جدید</h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                aria-label="بستن سفارش لابراتوار"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-3 text-[11px]">
            {/* Row 1: انتخاب بیمار + نوع کار پروتزی */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-700 font-bold block mb-1">انتخاب بیمار</label>
                <select aria-label="انتخاب بیمار"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">نوع کار پروتزی</label>
                <select aria-label="نوع کار پروتزی"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                >
                  <option value="روکش تمام زیرکونیا">روکش تمام زیرکونیا</option>
                  <option value="روکش متال‌سرامیک (PFM)">روکش متال‌سرامیک (PFM)</option>
                  <option value="لمینت E-Max">لمینت E-Max</option>
                  <option value="اباتمنت و کرون ایمپلنت">اباتمنت و کرون ایمپلنت</option>
                  <option value="پروتز متحرک کامل">پروتز متحرک کامل</option>
                  <option value="پلاک شفاف ارتودنسی">پلاک شفاف ارتودنسی</option>
                </select>
              </div>
            </div>

            {/* Row 2: دندان + شید و رنگ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-700 font-bold block mb-1">دندان / موقعیت (پالمر)</label>
                <input aria-label="دندان / موقعیت (پالمر)"
                  type="text"
                  value={toothNumber}
                  onChange={(e) => setToothNumber(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">شید و رنگ دندان</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !useLayeredShade;
                      setUseLayeredShade(next);
                      if (next) updateLayeredShade(incisalShade, bodyShade, cervicalShade);
                      else setShade(bodyShade);
                    }}
                    className="text-[9.5px] font-black text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                  >
                    {useLayeredShade ? 'تک‌رنگی' : '۳ ناحیه‌ای'}
                  </button>
                </div>
                <input
                  type="text"
                  value={shade}
                  onChange={(e) => setShade(e.target.value)}
                  placeholder="A2, BL2, ..."
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Quick Vita & Bleach Shade Chips + 3-Zone Tooth Map */}
            <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                {['BL1', 'BL2', 'BL3', 'A1', 'A2', 'A3', 'A3.5', 'B1', 'B2', 'C2', 'D2'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setUseLayeredShade(false);
                      setBodyShade(s);
                      setShade(s);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shrink-0 transition-all cursor-pointer ${
                      shade === s
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-purple-100 border border-purple-200/70'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {useLayeredShade && (
                <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-purple-200/60 text-[10px]">
                  <div>
                    <label className="text-purple-900 font-bold block mb-0.5">لبه (Incisal)</label>
                    <select aria-label="لبه (Incisal)"
                      value={incisalShade}
                      onChange={(e) => updateLayeredShade(e.target.value, bodyShade, cervicalShade)}
                      className="w-full bg-white border border-purple-200 rounded-lg px-1.5 py-1 font-mono font-bold text-slate-800"
                    >
                      {['BL1', 'BL2', 'A1', 'A2', 'B1', 'Trans'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-900 font-bold block mb-0.5">میانی (Body)</label>
                    <select aria-label="میانی (Body)"
                      value={bodyShade}
                      onChange={(e) => updateLayeredShade(incisalShade, e.target.value, cervicalShade)}
                      className="w-full bg-white border border-purple-200 rounded-lg px-1.5 py-1 font-mono font-bold text-slate-800"
                    >
                      {['BL2', 'BL3', 'A1', 'A2', 'A3', 'B1', 'B2'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-900 font-bold block mb-0.5">طوق (Cervical)</label>
                    <select aria-label="طوق (Cervical)"
                      value={cervicalShade}
                      onChange={(e) => updateLayeredShade(incisalShade, bodyShade, e.target.value, stumpShade)}
                      className="w-full bg-white border border-purple-200 rounded-lg px-1.5 py-1 font-mono font-bold text-slate-800"
                    >
                      {['A2', 'A3', 'A3.5', 'B2', 'C2', 'D3'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-purple-200/60 text-[10px]">
                <span className="text-purple-950 font-bold shrink-0">رنگ استامپ پایه (Stump):</span>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {['ND1', 'ND2', 'ND3', 'ND4', 'ND6', 'ND8'].map(nd => (
                    <button
                      key={nd}
                      type="button"
                      onClick={() => {
                        setStumpShade(nd);
                        if (useLayeredShade) updateLayeredShade(incisalShade, bodyShade, cervicalShade, nd);
                        else setShade(`${bodyShade} (Stump:${nd})`);
                      }}
                      className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold cursor-pointer transition-all ${
                        stumpShade === nd
                          ? 'bg-purple-800 text-white'
                          : 'bg-white text-purple-900 border border-purple-200'
                      }`}
                    >
                      {nd}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: لابراتوار همکار + تاریخ تحویل + هزینه لابراتوار */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <label className="text-slate-700 font-bold block mb-1">لابراتوار همکار</label>
                <select aria-label="لابراتوار همکار"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                >
                  {partnerLabOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-slate-700 font-bold block mb-1">موعد تحویل</label>
                <input aria-label="موعد تحویل"
                  type="text"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-center text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-slate-700 font-bold block mb-1">هزینه ({formatToman(cost)})</label>
                <input aria-label="هزینه لابراتوار"
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Row 4: Standalone Clinic Slip Code & Courier Name (برای لابراتوارهایی که برنامه را نصب ندارند) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-700 font-bold block mb-1">کد قبض ارسال مطب (اختصاصی)</label>
                <input
                  aria-label="کد قبض ارسال لابراتوار"
                  type="text"
                  value={trackingSlipCode}
                  onChange={(e) => setTrackingSlipCode(e.target.value)}
                  placeholder="SLIP-12345"
                  dir="ltr"
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-purple-900 font-mono font-black text-xs text-center focus:outline-none focus:border-purple-500 shadow-2xs"
                />
              </div>
              <div>
                <label className="text-slate-700 font-bold block mb-1">نام پیک / تحویل‌گیرنده لابراتوار</label>
                <input
                  aria-label="نام پیک لابراتوار"
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="مثلاً: آقای حسینی (پیک) یا حضوری..."
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Row 5: مارجین تراش + نوبت تحویل به بیمار + دستورات تکنیکی */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-700 font-bold block mb-1">نوع تراش مارجین (Margin)</label>
                <select
                  aria-label="نوع تراش مارجین"
                  value={marginType}
                  onChange={(e) => setMarginType(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                >
                  <option value="Deep Chamfer">Deep Chamfer (0.8mm)</option>
                  <option value="Radial Shoulder">Radial Shoulder (1.0mm)</option>
                  <option value="Feather / Knife Edge">Feather / Knife Edge (زیرکونیا)</option>
                  <option value="Ti-Base Implant Abutment">Ti-Base Implant (سکریو رتین)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-700 font-bold block mb-1">تاریخ نوبت تحویل به بیمار</label>
                <input
                  aria-label="تاریخ نوبت تحویل به بیمار"
                  type="text"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-center text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">دستورات و الزامات تکنیکی پزشک (اختیاری)</label>
              <input
                aria-label="دستورات تکنیکی لابراتوار"
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="مثال: کنتاکت پروگزیمال محکم، فضای پونتیک بهداشتی، اوپک کردن پایه فلزی..."
                className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
              />
            </div>

            {/* Inline Phone Notification & Reminder Picker */}
            <ReminderOptionPicker
              value={reminderConfig}
              onChange={setReminderConfig}
              targetDate={deliveryDate}
              theme="purple"
              title="یادآوری پیگیری و تحویل لابراتوار (نوتیف گوشی)"
            />
          </div>

          {/* Fixed Bottom Footer with 2-Step Mistake-Proof Confirmation */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-purple-200/80 bg-white/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20">
            {confirmStep ? (
              <div className="p-2.5 rounded-2xl bg-purple-50 border-2 border-purple-400 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-xs font-black text-purple-950">
                  <span>تایید ارسال «{workType}» به {labName}</span>
                  <span className="font-mono text-purple-800 bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                    {formatToman(cost)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(false)}
                    className="w-1/3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer"
                  >
                    بازگشت و اصلاح
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
                  >
                    تایید و ثبت قطعی سفارش ✓
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmStep(true)}
                  className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  مرحله ۱: بررسی و ارسال به لابراتوار
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </ViewportModalPortal>
  );
};

