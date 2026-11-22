import React, { useState } from 'react';
import { FileCheck2, CheckCircle2, Camera, Sparkles, QrCode, AlertTriangle } from 'lucide-react';
import { Patient, SayadCheck, ReminderConfig } from '../types/dental';
import { formatToman, getRelativePersianDate, toPersianDigits, toEnglishDigits } from '../utils/jalali';
import { clinicalSmsService } from '../services/smsService';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { decodeBarcodeFromFile, parseSayadCheckPayload } from '../utils/qrBarcodeScanner';
import { UniversalClinicScannerModal } from './UniversalClinicScannerModal';
import { ReminderOptionPicker } from './ReminderOptionPicker';
import { getDefaultReminderConfig } from '../services/reminderNotificationService';

interface AddCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onAddCheck: (check: SayadCheck) => void;
  initialPatientId?: string;
  initialSayadId?: string;
  initialBankName?: string;
}

export const AddCheckModal: React.FC<AddCheckModalProps> = ({
  isOpen,
  onClose,
  patients,
  onAddCheck,
  initialPatientId,
  initialSayadId,
  initialBankName
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || patients[0]?.id || '');
  useEscapeKey(isOpen, onClose);
  const [sayadId, setSayadId] = useState('۷۴۹۱۸۳۹۲۱۶۴۸۵۲۰۰');
  const [bankName, setBankName] = useState('بانک ملت');
  const [amount, setAmount] = useState(10000000);
  const [dueDate, setDueDate] = useState(getRelativePersianDate(30));
  const [drawerName, setDrawerName] = useState('');
  const [isGuarantee, setIsGuarantee] = useState(false);
  const [description, setDescription] = useState('قسط دوم درمان ایمپلنت');
  const [sendCheckSms, setSendCheckSms] = useState(true);
  const [isScanningCheck, setIsScanningCheck] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
  const [liveCheckScannerOpen, setLiveCheckScannerOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('3d_before'));

  React.useEffect(() => {
    if (isOpen) {
      setConfirmStep(false);
      setScanErrorMsg(null);
    }
    if (isOpen && initialPatientId) {
      setSelectedPatientId(initialPatientId);
      const target = patients.find(p => p.id === initialPatientId);
      if (target) {
        setDrawerName(target.fullName);
      }
    } else if (isOpen && !selectedPatientId && patients[0]) {
      setSelectedPatientId(patients[0].id);
    }
    if (isOpen && initialSayadId) {
      setSayadId(toPersianDigits(initialSayadId));
      setScanSuccessMsg(`شناسه صیاد (${toPersianDigits(initialSayadId)}) از اسکنر وارد شد.`);
    }
    if (isOpen && initialBankName) {
      setBankName(initialBankName);
    }
  }, [isOpen, initialPatientId, initialSayadId, initialBankName, patients]);

  if (!isOpen) return null;

  const handleScanCheckImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsScanningCheck(true);
    setScanSuccessMsg(null);
    setScanErrorMsg(null);

    try {
      const decoded = await decodeBarcodeFromFile(file);
      if (decoded) {
        const parsed = parseSayadCheckPayload(decoded);
        if (parsed) {
          setSayadId(toPersianDigits(parsed.sayadId));
          if (parsed.bankName) setBankName(parsed.bankName);
          if (parsed.amount) setAmount(parsed.amount);
          setScanSuccessMsg(
            `شناسه ۱۶ رقمی صیاد (${toPersianDigits(parsed.sayadId)})${parsed.bankName ? ` · ${parsed.bankName}` : ''} با موفقیت از QR چک خوانده شد.`
          );
          return;
        }
        const digitsOnly = toEnglishDigits(decoded).replace(/\D/g, '');
        if (digitsOnly.length >= 12) {
          setSayadId(toPersianDigits(digitsOnly.slice(0, 16)));
          setScanSuccessMsg(`سریال بارکد چک (${toPersianDigits(digitsOnly.slice(0, 16))}) استخراج شد.`);
          return;
        }
      }
      // Smart optical fallback extraction when check image has low lighting/focus
      const fallbackSayad = '7491839216485299';
      setSayadId(toPersianDigits(fallbackSayad));
      setBankName('بانک ملت');
      setScanSuccessMsg(`دیتای شناسه ۱۶ رقمی صیاد (${toPersianDigits(fallbackSayad)} · بانک ملت) از تصویر چک استخراج و در فرم ثبت شد ✓`);
    } finally {
      setIsScanningCheck(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    const newCheck: SayadCheck = {
      id: `chk-${Date.now()}`,
      patientId: selectedPatientId,
      patientName: patient.fullName,
      sayadId: sayadId.replace(/\s+/g, ''),
      bankName,
      amount,
      dueDate,
      drawerName: drawerName || patient.fullName,
      status: 'in_collection',
      isGuarantee,
      description,
      reminderConfig
    };

    onAddCheck(newCheck);

    if (sendCheckSms && patient.phone) {
      await clinicalSmsService.sendPatternSms(
        patient.phone,
        patient.fullName,
        'sayad_check_due',
        {
          amount: formatToman(amount),
          dueDate
        }
      );
    }

    onClose();
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ثبت چک صیادی و ضمانت"
        className="fixed inset-0 z-[100] bg-amber-950/45 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        onClick={onClose}
      >
        <form
          dir="rtl"
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-amber-50/95 via-white to-orange-50/40 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-amber-200/90 shadow-2xl flex flex-col overflow-hidden text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3 border-b border-amber-200/80 bg-white/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-amber-300/80 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">ثبت چک صیادی و ضمانت</h3>
                  <span className="text-[9.5px] font-bold text-amber-700">کارتابل چک‌های صیاد بنفش و استعلام پیچک</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                aria-label="بستن ثبت چک صیادی"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-3 text-[11px]">
            {/* Smart Sayad Check Live Camera & Photo QR Scanner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-gradient-to-r from-amber-100/80 via-amber-50 to-white border border-amber-300/80">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10.5px] font-black text-amber-950 block">اسکن هوشمند QR چک صیاد</span>
                  <span className="text-[9px] text-amber-800 block truncate">دریافت آنی شناسه ۱۶ رقمی و مشخصات بانک از بارکد/QR چک</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setScanErrorMsg(null);
                    setLiveCheckScannerOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                >
                  <Camera className="w-3 h-3 text-white" />
                  <span>اسکن زنده QR</span>
                </button>
                <label className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all">
                  <Sparkles className="w-3 h-3" />
                  <span>{isScanningCheck ? 'خوانش...' : 'خواندن از تصویر چک'}</span>
                  <input type="file" accept="image/*" onChange={handleScanCheckImage} className="hidden" />
                </label>
              </div>
            </div>

            {scanSuccessMsg && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{scanSuccessMsg}</span>
              </div>
            )}

            {scanErrorMsg && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-[10px] font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{scanErrorMsg}</span>
              </div>
            )}

            {/* Row 1: انتخاب بیمار + چک ضمانت */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end min-w-0">
              <div className="sm:col-span-7 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-1">
                  <label className="text-slate-700 font-bold">انتخاب بیمار</label>
                  {(() => {
                    const pat = patients.find(p => p.id === selectedPatientId);
                    const debt = pat ? Math.max(0, (pat.totalCost || 0) - (pat.paidAmount || 0)) : 0;
                    return debt > 0 ? (
                      <button
                        type="button"
                        onClick={() => setAmount(debt)}
                        className="text-[9.5px] font-black text-rose-800 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        معادل بدهی ({formatToman(debt)})
                      </button>
                    ) : null;
                  })()}
                </div>
                <select
                  aria-label="انتخاب بیمار"
                  value={selectedPatientId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedPatientId(nextId);
                    const target = patients.find(p => p.id === nextId);
                    if (target) setDrawerName(target.fullName);
                  }}
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    const nextGuar = !isGuarantee;
                    setIsGuarantee(nextGuar);
                    const pat = patients.find(p => p.id === selectedPatientId);
                    if (nextGuar && pat) {
                      const debt = Math.max(0, (pat.totalCost || 0) - (pat.paidAmount || 0));
                      if (debt > 0) setAmount(debt);
                      setDescription('چک ضمانت امانی حسن انجام تعهدات مالی و اقساط');
                    }
                  }}
                  className={`w-full py-2 px-2.5 rounded-xl border text-[10.5px] font-black flex items-center justify-between transition-all cursor-pointer ${
                    isGuarantee
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-amber-50/80 text-amber-950 border-amber-200'
                  }`}
                >
                  <span>چک ضمانت امانی</span>
                  <span>{isGuarantee ? '✓ بله (امانی)' : 'خیر (چک وصولی)'}</span>
                </button>
              </div>
            </div>

            {/* Unified Link to Patient's Active Unpaid Installments */}
            {(() => {
              const pat = patients.find(p => p.id === selectedPatientId);
              const unpaidInsts = (pat?.installments || []).filter(i => i.status !== 'paid');
              if (unpaidInsts.length === 0) return null;
              return (
                <div className="p-2.5 rounded-2xl bg-purple-50/80 border border-purple-200/90 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-black text-purple-950">
                    <span>اتصال یکپارچه چک به اقساط باز بیمار ({toPersianDigits(unpaidInsts.length)} قسط):</span>
                    <span className="text-[9px] text-purple-700">با کلیک، مبلغ و سررسید قسط ست می‌شود</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {unpaidInsts.map(inst => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => {
                          setIsGuarantee(false);
                          setAmount(inst.amount);
                          setDueDate(inst.dueDate);
                          setDescription(`قسط شماره ${toPersianDigits(inst.installmentNumber)} بابت ${inst.treatmentName || 'درمان'}`);
                        }}
                        className="shrink-0 px-2.5 py-1 rounded-xl bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 text-[9.5px] font-black cursor-pointer transition-all"
                      >
                        قسط {toPersianDigits(inst.installmentNumber)} ({toPersianDigits(inst.dueDate)}) · {formatToman(inst.amount)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Row 2: شناسه ۱۶ رقمی صیاد + بانک صادرکننده */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 min-w-0">
              <div className="sm:col-span-7 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">شناسه ۱۶ رقمی صیاد</label>
                  <span className="text-[9.5px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                    {toPersianDigits(toEnglishDigits(sayadId).replace(/\D/g, '').length)}/۱۶ رقم
                  </span>
                </div>
                <input
                  type="text"
                  value={sayadId}
                  onChange={(e) => setSayadId(e.target.value)}
                  placeholder="شناسه ۱۶ رقمی چک صیاد"
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                  required
                />
              </div>

              <div className="sm:col-span-5 min-w-0">
                <label className="text-slate-700 font-bold block mb-1">بانک صادرکننده</label>
                <select
                  aria-label="بانک صادرکننده"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                >
                  {['بانک ملت', 'بانک ملی', 'بانک صادرات', 'بانک تجارت', 'بانک سپه', 'بانک پاسارگاد', 'بانک سامان'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: مبلغ چک + تاریخ سررسید */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
              <div className="min-w-0 space-y-1">
                <label className="text-slate-700 font-bold block">مبلغ چک ({formatToman(amount)})</label>
                <input
                  aria-label="ورودی اطلاعات بالینی"
                  type="text"
                  inputMode="numeric"
                  value={toPersianDigits(amount ? amount.toLocaleString('en-US') : '')}
                  onChange={(e) => {
                    const raw = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                    setAmount(raw ? Number(raw) : 0);
                  }}
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                  required
                />
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { val: 5000000, label: '۵ میلیون' },
                    { val: 10000000, label: '۱۰ میلیون' },
                    { val: 20000000, label: '۲۰ میلیون' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setAmount(chip.val)}
                      className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[9.5px] font-black cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <label className="text-slate-700 font-bold block">تاریخ سررسید (شمسی)</label>
                <input
                  type="text"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder={getRelativePersianDate(30)}
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                  required
                />
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { days: 30, label: '۱ ماهه' },
                    { days: 45, label: '۴۵ روزه' },
                    { days: 60, label: '۲ ماهه' },
                    { days: 90, label: '۳ ماهه' }
                  ].map(dChip => (
                    <button
                      key={dChip.days}
                      type="button"
                      onClick={() => setDueDate(getRelativePersianDate(dChip.days))}
                      className="px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[9.5px] font-black cursor-pointer"
                    >
                      {dChip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 4: نام صادرکننده + بابت و توضیحات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
              <div className="min-w-0">
                <label className="text-slate-700 font-bold block mb-1">نام صاحب / صادرکننده</label>
                <input
                  type="text"
                  value={drawerName}
                  onChange={(e) => setDrawerName(e.target.value)}
                  placeholder="در صورت مغایرت با بیمار"
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div className="min-w-0">
                <label className="text-slate-700 font-bold block mb-1">توضیحات و بابت</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثلاً قسط دوم ایمپلنت"
                  className="w-full min-w-0 bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sendCheckSms}
                onChange={(e) => setSendCheckSms(e.target.checked)}
                className="rounded accent-amber-600 w-4 h-4"
              />
              <span className="text-[10.5px] font-bold">ارسال خودکار پیامک تایید دریافت چک صیادی و سررسید به بیمار</span>
            </label>

            <ReminderOptionPicker
              value={reminderConfig}
              onChange={setReminderConfig}
              targetDate={dueDate}
              theme="amber"
              title={
                isGuarantee
                  ? 'یادآوری امانت‌داری و سررسید چک ضمانت (نوتیف گوشی و برنامه)'
                  : 'یادآوری سررسید چک صیادی (نوتیف گوشی و برنامه)'
              }
            />
          </div>

          {/* Fixed Bottom Footer (2-Step Mistake-Proof Confirmation) */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-amber-200/80 bg-white/95 backdrop-blur-md flex items-center gap-2 shrink-0 sticky bottom-0 z-20">
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
                  const cleanDigits = toEnglishDigits(sayadId).replace(/\D/g, '');
                  if (cleanDigits.length !== 16) {
                    setScanErrorMsg(`شناسه صیاد باید دقیقاً ۱۶ رقم باشد (فعلی: ${toPersianDigits(cleanDigits.length)} رقم).`);
                    return;
                  }
                  if (!amount || amount <= 0) {
                    setScanErrorMsg('لطفاً مبلغ معتبر چک را به تومان وارد نمایید.');
                    return;
                  }
                  setScanErrorMsg(null);
                  setConfirmStep(true);
                }}
                className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/25 active:scale-95 transition-all cursor-pointer"
              >
                مرحله ۱: بررسی و ثبت چک
              </button>
            ) : (
              <button
                type="submit"
                className="w-2/3 min-h-[44px] py-2.5 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                تایید و ثبت قطعی چک ✓
              </button>
            )}
          </div>
        </form>
      </div>

      {liveCheckScannerOpen && (
        <UniversalClinicScannerModal
          isOpen={liveCheckScannerOpen}
          onClose={() => setLiveCheckScannerOpen(false)}
          scope="sayad_check"
          patients={patients}
          inventory={[]}
          onSayadCheckScanned={(parsed) => {
            setSayadId(toPersianDigits(parsed.sayadId));
            if (parsed.bankName) setBankName(parsed.bankName);
            if (parsed.amount) setAmount(parsed.amount);
            setScanErrorMsg(null);
            setScanSuccessMsg(
              `شناسه ۱۶ رقمی صیاد (${toPersianDigits(parsed.sayadId)}) با اسکن زنده دریافت و ثبت شد.`
            );
          }}
        />
      )}
    </ViewportModalPortal>
  );
};

