import React, { useState, useEffect } from 'react';
import { 
  X, UserPlus, Phone, CreditCard, Stethoscope, 
  FileText, Check, AlertCircle, Sparkles, User, 
  Calendar, Clock, ShieldCheck, HeartPulse
} from 'lucide-react';
import { Patient } from '../types/dental';
import { toPersianDigits, getCurrentPersianDate } from '../utils/jalali';
import { getNextFileNumber, recordLastFileNumber } from '../utils/fileNumber';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';

interface QuickAdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientAdmitted: (newPatient: Patient) => void;
  onOpenPalmerChart?: (patient: Patient) => void;
}

export const QuickAdmissionModal: React.FC<QuickAdmissionModalProps> = ({
  isOpen,
  onClose,
  onPatientAdmitted,
  onOpenPalmerChart
}) => {
  const { impactLight, impactHeavy, success } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [age, setAge] = useState<string>('32');
  const [gender, setGender] = useState<'مرد' | 'زن'>('زن');
  const [fileNumber, setFileNumber] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('معاینه اولیه و چکاپ');
  const [selectedDoctor, setSelectedDoctor] = useState('دکتر مهدی امیری');
  const [priority, setPriority] = useState<'normal' | 'emergency' | 'vip'>('normal');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [allergyAlert, setAllergyAlert] = useState('');

  // Auto-generate next file number on open
  useEffect(() => {
    if (isOpen) {
      const nextNum = getNextFileNumber();
      setFileNumber(nextNum);
      setFullName('');
      setPhone('');
      setNationalId('');
      setAge('32');
      setGender('زن');
      setChiefComplaint('معاینه اولیه و چکاپ');
      setMedicalNotes('');
      setAllergyAlert('');
      setPriority('normal');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (openPalmerAfter: boolean = false) => {
    if (!fullName.trim()) return;
    impactHeavy();

    const cleanFileNumber = fileNumber.trim() || getNextFileNumber();
    recordLastFileNumber(cleanFileNumber);
    const priorityTag = priority === 'emergency' ? 'اورژانس فوری' : priority === 'vip' ? 'مراجع VIP' : '';
    const parsedAge = Math.max(1, Math.min(115, Number(age) || 32));
    const historyItems = [allergyAlert.trim(), priorityTag, medicalNotes.trim()].filter(Boolean);

    const newPatient: Patient = {
      id: `pat-${Date.now()}`,
      fileNumber: cleanFileNumber,
      fullName: fullName.trim(),
      phone: phone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
      nationalId: nationalId.trim() || '۰۰۰۰۰۰۰۰۰۰',
      medicalHistory: historyItems,
      teethConditions: {},
      treatments: [
        {
          id: `trt-adm-${Date.now()}`,
          tooth: 'فک کامل',
          treatment: chiefComplaint || 'پذیرش سریع و تشکیل پرونده',
          cost: 0,
          date: getCurrentPersianDate(),
          status: 'planned',
          doctorName: selectedDoctor
        }
      ],
      age: parsedAge,
      gender,
      totalCost: 0,
      paidAmount: 0,
      balance: 0,
      activeTreatmentsCount: 1,
      lastVisit: getCurrentPersianDate(),
      notes: [priorityTag ? `[${priorityTag}]` : '', medicalNotes.trim() || 'پذیرش سریع کلینیک'].filter(Boolean).join(' · '),
      sayadChecks: [],
      installments: [],
      payments: [],
      labOrders: [],
      implantCases: [],
      prescriptions: [],
      consents: [],
      createdAt: getCurrentPersianDate()
    };

    onPatientAdmitted(newPatient);
    success();

    if (openPalmerAfter && onOpenPalmerChart) {
      onClose();
      onOpenPalmerChart(newPatient);
    } else {
      onClose();
    }
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="پذیرش سریع بیمار"
        className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[28px] border-0 sm:border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3.5 sm:p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shrink-0 sticky top-0 z-20 shadow-xs">
            <div className="w-10 h-1 rounded-full bg-white/35 mx-auto mb-2.5 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-md">
                  <UserPlus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black">پذیرش سریع بیمار</h3>
                  <span className="text-[10px] text-emerald-100 font-bold block">تشکیل آنی پرونده بدون نیاز به اسکرول صفحه</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  impactLight();
                  onClose();
                }}
                aria-label="بستن پذیرش سریع"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto overscroll-contain space-y-3.5 text-xs">
          
          {/* File Number & Priority Banner */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-bold">شماره پرونده سیستمی:</span>
              <input aria-label="شماره پرونده سیستمی"
                type="text"
                value={fileNumber}
                onChange={(e) => setFileNumber(e.target.value)}
                className="w-24 text-center font-mono font-black text-emerald-800 bg-white border border-emerald-300 rounded-lg py-1 px-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
              />
            </div>

            {/* Priority Selector */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-emerald-200 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setPriority('normal')}
                className={`px-2 py-1 rounded-lg transition-all ${priority === 'normal' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
              >
                عادی
              </button>
              <button
                type="button"
                onClick={() => setPriority('emergency')}
                className={`px-2 py-1 rounded-lg transition-all ${priority === 'emergency' ? 'bg-rose-600 text-white font-black' : 'text-rose-600'}`}
              >
                اورژانس
              </button>
              <button
                type="button"
                onClick={() => setPriority('vip')}
                className={`px-2 py-1 rounded-lg transition-all ${priority === 'vip' ? 'bg-amber-500 text-white font-black' : 'text-amber-600'}`}
              >
                VIP
              </button>
            </div>
          </div>

          {/* Name & Phone (Primary Fields) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 font-bold block mb-1">
                نام و نام خانوادگی بیمار <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="مثال: مریم کریمی"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">شماره همراه بیمار</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="tel"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* National Code, Age, Gender & Attending Doctor */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-4">
              <label className="text-slate-700 font-bold block mb-1">کد ملی (بیمه و صیاد)</label>
              <input
                type="text"
                aria-label="کد ملی بیمار"
                placeholder="۰۰۱۸۳۷۴۶۲۱"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-left"
                dir="ltr"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-700 font-bold block mb-1">سن</label>
              <input
                type="number"
                aria-label="سن بیمار"
                min={1}
                max={115}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-700 font-bold block mb-1">جنسیت</label>
              <select
                aria-label="جنسیت بیمار"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'مرد' | 'زن')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="زن">زن</option>
                <option value="مرد">مرد</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="text-slate-700 font-bold block mb-1">پزشک معالج انتخابی</label>
              <select aria-label="پزشک معالج انتخابی"
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
              >
                <option value="دکتر مهدی امیری">دکتر مهدی امیری (مدیر · جراح فک و ایمپلنت)</option>
                <option value="دکتر سارا رضوانی">دکتر سارا رضوانی (ارتودنسی و زیبایی)</option>
                <option value="دکتر علی مرادی">دکتر علی مرادی (درمان ریشه اندو)</option>
              </select>
            </div>
          </div>

          {/* Chief Complaint / Treatment */}
          <div>
            <label className="text-slate-700 font-bold block mb-1">علت مراجعه / خدمت درخواستی</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
              {[
                'معاینه اولیه و چکاپ',
                'دندان‌درد حاد / عصب‌کشی',
                'مشاوره کاشت ایمپلنت',
                'ترمیم و جرم‌گیری'
              ].map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setChiefComplaint(opt)}
                  className={`py-1.5 px-2 rounded-xl text-[10.5px] font-bold text-center transition-all ${
                    chiefComplaint === opt
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="یا به صورت دستی وارد کنید..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Allergy / Medical Alert */}
          <div>
            <label className="text-slate-700 font-bold block mb-1 flex items-center justify-between">
              <span>هشدار پزشکی / آلرژی دارویی</span>
              <span className="text-[10px] text-amber-600 font-normal">اختیاری</span>
            </label>
            <input
              type="text"
              placeholder="مثال: حساسیت به پنی‌سیلین، فشار خون بالا، مصرف آسپرین..."
              value={allergyAlert}
              onChange={(e) => setAllergyAlert(e.target.value)}
              className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            />
          </div>

        </div>

          {/* Fixed Footer Actions */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2 shrink-0 sticky bottom-0 z-20">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={!fullName.trim()}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              <span>ثبت و باز کردن چارت پالمر</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={!fullName.trim()}
              className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>ثبت آنی و تشکیل پرونده</span>
            </button>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
