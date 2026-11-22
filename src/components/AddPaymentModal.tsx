import React, { useState } from 'react';
import { Receipt, CreditCard, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Patient, PaymentRecord, ReminderConfig } from '../types/dental';
import { formatToman, getCurrentPersianDate, getRelativePersianDate, toPersianDigits, toEnglishDigits } from '../utils/jalali';
import { hardwareBridgeService } from '../services/hardwareBridgeService';
import { clinicalSmsService } from '../services/smsService';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { ReminderOptionPicker } from './ReminderOptionPicker';
import { getDefaultReminderConfig } from '../services/reminderNotificationService';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onAddPayment: (payment: PaymentRecord) => void;
  initialPatientId?: string;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  patients,
  onAddPayment,
  initialPatientId
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || patients[0]?.id || '');
  useEscapeKey(isOpen, onClose);
  const [amount, setAmount] = useState(5000000);
  const [method, setMethod] = useState<'pos' | 'card_to_card' | 'cash'>('pos');
  const [refNumber, setRefNumber] = useState('۸۳۹۱۸۲۴۷');
  const [forTreatment, setForTreatment] = useState('تسویه قسط درمانی / بیعانه');
  const [sendReceiptSms, setSendReceiptSms] = useState(true);
  const [posState, setPosState] = useState<'idle' | 'transmitting' | 'success' | 'failed'>('idle');
  const [posMessage, setPosMessage] = useState<string>('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(() => ({
    ...getDefaultReminderConfig('3d_before'),
    enabled: false
  }));

  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setConfirmStep(false);
      setPosState('idle');
      setPosMessage('');
      setFormError(null);
      if (initialPatientId) {
        setSelectedPatientId(initialPatientId);
        const target = patients.find(p => p.id === initialPatientId);
        if (target && target.balance < 0) {
          setAmount(Math.abs(target.balance));
        }
      } else if (!selectedPatientId && patients[0]) {
        setSelectedPatientId(patients[0].id);
      }
    }
  }, [isOpen, initialPatientId, patients]);

  if (!isOpen) return null;

  const currentPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  const handleSendToPosTerminal = async () => {
    if (amount <= 0) return;
    setPosState('transmitting');
    setPosMessage('در حال ارسال مبلغ به پایانه کارتخوان متصل... بیمار کارت بکشد.');
    
    try {
      const resp = await hardwareBridgeService.sendPosTransaction({
        amount,
        patientName: currentPatient?.fullName || '',
        patientFileNumber: currentPatient?.fileNumber || '',
        description: forTreatment
      });
      if (resp.success && resp.status === 'approved') {
        setPosState('success');
        setPosMessage(`تراکنش تایید شد! مرجع RRN: ${resp.referenceNumber} (پیگیری: ${resp.traceNumber})`);
        setRefNumber(resp.referenceNumber);
      } else {
        setPosState('failed');
        setPosMessage(resp.message || 'خطا در برقراری ارتباط با پوز');
      }
    } catch {
      setPosState('failed');
      setPosMessage('عدم پاسخ از پایانه فروش');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      patientId: currentPatient.id,
      patientName: currentPatient.fullName,
      amount,
      date: getCurrentPersianDate(),
      method,
      referenceNumber: refNumber,
      terminalName: method === 'pos' ? 'کارتخوان پذیرش مطب (به‌پرداخت ملت)' : undefined,
      forTreatment,
      reminderConfig
    };

    onAddPayment(newPayment);

    if (sendReceiptSms && currentPatient.phone) {
      const nextBalance = (currentPatient.balance || 0) + amount;
      const balanceText =
        nextBalance < 0
          ? `مانده حساب: ${formatToman(Math.abs(nextBalance))}`
          : 'حساب شما تسویه کامل شد ✓';
      await clinicalSmsService.sendPatternSms(
        currentPatient.phone,
        currentPatient.fullName,
        'custom',
        {
          customText: `رسید پرداخت کلینیک مینادنتال: مبلغ ${formatToman(amount)} بابت ${forTreatment} در تاریخ ${getCurrentPersianDate()} دریافت شد (کد پیگیری: ${refNumber || 'صندوق'}). ${balanceText}`
        }
      );
    }

    setConfirmStep(false);
    onClose();
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ثبت پرداخت بیمار و پایانه کارتخوان"
        className="fixed inset-0 z-[100] bg-emerald-950/45 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        onClick={onClose}
      >
        <form
          dir="rtl"
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-emerald-50/95 via-white to-lime-50/40 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-emerald-200/90 shadow-2xl flex flex-col overflow-hidden text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3 border-b border-emerald-200/80 bg-white/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-emerald-300/80 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">ثبت پرداخت بیمار و پایانه کارتخوان</h3>
                  <span className="text-[9.5px] font-bold text-emerald-700">کسر آنی از بدهی بیمار و صدور رسید صندوق</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                aria-label="بستن ثبت پرداخت"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-3 text-[11px]">
            {/* Row 1: انتخاب بیمار + روش پرداخت */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 min-w-0">
              <div className="sm:col-span-6 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-1">
                  <label className="text-slate-700 font-bold">انتخاب بیمار</label>
                  {(() => {
                    const remDebt = currentPatient ? Math.max(0, (currentPatient.totalCost || 0) - (currentPatient.paidAmount || 0)) : 0;
                    return remDebt > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(remDebt);
                          setForTreatment('تسویه کامل مانده بدهی پرونده');
                        }}
                        className="text-[9.5px] font-black text-rose-800 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        تسویه بدهی ({formatToman(remDebt)})
                      </button>
                    ) : null;
                  })()}
                </div>
                <select aria-label="انتخاب بیمار"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full min-w-0 bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6 min-w-0">
                <label className="text-slate-700 font-bold block mb-1">روش پرداخت</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'pos', label: 'کارتخوان' },
                    { id: 'card_to_card', label: 'کارت‌به‌کارت' },
                    { id: 'cash', label: 'وجه نقد' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id as any)}
                      className={`py-2 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${
                        method === m.id ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Unified Installment, Sayad Check & Guarantee Status Bar for Selected Patient */}
            {currentPatient && (() => {
              const unpaidInsts = (currentPatient.installments || []).filter(i => i.status !== 'paid');
              const activeGuar = (currentPatient.sayadChecks || []).find(c => c.isGuarantee && c.status !== 'returned');
              const pendingSayad = (currentPatient.sayadChecks || []).filter(c => !c.isGuarantee && c.status === 'in_collection');
              if (unpaidInsts.length === 0 && !activeGuar && pendingSayad.length === 0) return null;
              return (
                <div className="p-2.5 rounded-2xl bg-gradient-to-l from-amber-50 via-white to-emerald-50/70 border border-amber-200/90 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-black text-slate-800">
                    <span>وضعیت یکپارچه اقساط، چک صیادی و ضمانت بیمار:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {pendingSayad.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 text-[9px]">
                          {toPersianDigits(pendingSayad.length)} چک صیادی در جریان
                        </span>
                      )}
                      {activeGuar && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-950 text-[9px]">
                          چک ضمانت امانی فعال ({formatToman(activeGuar.amount)})
                        </span>
                      )}
                    </div>
                  </div>

                  {unpaidInsts.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {unpaidInsts.map(inst => (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => {
                            setAmount(inst.amount);
                            setForTreatment(`تسویه قسط شماره ${toPersianDigits(inst.installmentNumber)} (${inst.treatmentName || 'درمان'})`);
                          }}
                          className="shrink-0 px-2.5 py-1 rounded-xl bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-[9.5px] font-black cursor-pointer transition-all"
                        >
                          تسویه قسط {toPersianDigits(inst.installmentNumber)} ({toPersianDigits(inst.dueDate)}) · {formatToman(inst.amount)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Row 2: مبلغ پرداختی + ارسال به پوز */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-bold">مبلغ پرداختی (تومان)</label>
                <span className="text-[10px] text-emerald-700 font-bold">معادل: {formatToman(amount)}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <input aria-label="ورودی اطلاعات بالینی"
                  type="text"
                  inputMode="numeric"
                  value={toPersianDigits(amount ? amount.toLocaleString('en-US') : '')}
                  onChange={(e) => {
                    const raw = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                    setAmount(raw ? Number(raw) : 0);
                  }}
                  className="w-full min-w-0 bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                  required
                />
                {method === 'pos' && (
                  <button
                    type="button"
                    onClick={handleSendToPosTerminal}
                    disabled={posState === 'transmitting'}
                    className="shrink-0 px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {posState === 'transmitting' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <CreditCard className="w-3.5 h-3.5" />
                    )}
                    <span>ارسال به پوز</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { val: 2000000, label: '۲ میلیون' },
                  { val: 5000000, label: '۵ میلیون' },
                  { val: 10000000, label: '۱۰ میلیون' },
                  { val: 15000000, label: '۱۵ میلیون' }
                ].map(chip => (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => {
                      setAmount(chip.val);
                      setFormError(null);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[9.5px] font-black cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {currentPatient && (
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-[10.5px]">
                  <span className="font-bold text-slate-700">تراز پرونده پس از ثبت این پرداخت:</span>
                  {(() => {
                    const projectedBalance = (currentPatient.balance || 0) + (amount || 0);
                    return (
                      <span className={`font-mono font-black ${projectedBalance < 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                        {projectedBalance < 0
                          ? `مانده بدهی: ${formatToman(Math.abs(projectedBalance))}`
                          : projectedBalance === 0
                            ? 'تسویه کامل پرونده ✓'
                            : `بستانکار: ${formatToman(projectedBalance)}`}
                      </span>
                    );
                  })()}
                </div>
              )}

              {formError && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-[10.5px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            {/* POS Feedback Banner */}
            {posMessage && (
              <div className={`p-2.5 rounded-xl text-[10.5px] font-bold flex items-center gap-2 border ${
                posState === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : posState === 'failed'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-cyan-50 border-cyan-300 text-cyan-800'
              }`}>
                {posState === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                <span>{posMessage}</span>
              </div>
            )}

            {/* Row 3: شماره پیگیری + بابت درمان */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-700 font-bold block mb-1">شماره پیگیری / ارجاع</label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="کد پیگیری رسید"
                  className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">بابت درمان</label>
                <input aria-label="بابت درمان"
                  type="text"
                  value={forTreatment}
                  onChange={(e) => setForTreatment(e.target.value)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sendReceiptSms}
                onChange={(e) => setSendReceiptSms(e.target.checked)}
                className="rounded accent-emerald-600 w-4 h-4"
              />
              <span className="text-[10.5px] font-bold">ارسال خودکار پیامک رسید پرداخت و مانده‌حساب به بیمار</span>
            </label>

            <ReminderOptionPicker
              value={reminderConfig}
              onChange={setReminderConfig}
              targetDate={getRelativePersianDate(7)}
              theme="emerald"
              title="یادآوری پیگیری مانده حساب / پرداخت بعدی (نوتیف گوشی)"
            />
          </div>

          {/* Fixed Bottom Footer (2-Step Mistake-Proof Confirmation) */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-emerald-200/80 bg-white/95 backdrop-blur-md flex items-center gap-2 shrink-0 sticky bottom-0 z-20">
            <button
              type="button"
              onClick={() => {
                if (confirmStep) {
                  setConfirmStep(false);
                } else {
                  onClose();
                }
              }}
              className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              {confirmStep ? 'بازگشت و اصلاح' : 'انصراف'}
            </button>
            {!confirmStep ? (
              <button
                type="button"
                onClick={() => {
                  if (!amount || amount <= 0) {
                    setFormError('لطفاً مبلغ پرداختی معتبر (بزرگ‌تر از صفر) وارد نمایید.');
                    return;
                  }
                  setFormError(null);
                  setConfirmStep(true);
                }}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
              >
                مرحله ۱: بررسی و ثبت دریافتی
              </button>
            ) : (
              <button
                type="submit"
                className="w-2/3 min-h-[44px] py-2.5 rounded-[12px] bg-teal-700 hover:bg-teal-800 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                تایید و ثبت قطعی در صندوق ✓
              </button>
            )}
          </div>
        </form>
      </div>
    </ViewportModalPortal>
  );
};

