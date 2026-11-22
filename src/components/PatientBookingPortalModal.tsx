import React, { useState } from 'react';
import { 
  X, Check, Calendar, Clock, User, Phone, 
  CreditCard, ShieldCheck, AlertCircle, Heart, 
  MapPin, QrCode, Sparkles, CheckCircle2, ChevronLeft,
  ChevronRight, Stethoscope, Share2, Printer
} from 'lucide-react';
import { Appointment, OnlineBookingRequest, UserAccount } from '../types/dental';
import {
  toPersianDigits,
  formatToman,
  PERSIAN_MONTHS,
  getPersianDateParts,
  getCurrentPersianDate,
  getCurrentPersianMonthName,
  isSamePersianDate
} from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { copyTextSafely } from '../utils/clipboard';
import { WheelTimePicker, ALL_CLINIC_TIME_SLOTS } from './WheelTimePicker';

interface PatientBookingPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingConfirmed?: (booking: OnlineBookingRequest) => void;
  appointments?: Appointment[];
  users?: UserAccount[];
}

export const PatientBookingPortalModal: React.FC<PatientBookingPortalModalProps> = ({
  isOpen,
  onClose,
  onBookingConfirmed,
  appointments = [],
  users
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  useEscapeKey(isOpen, onClose);

  // Dynamic upcoming clinical days starting from today
  const upcomingDays = React.useMemo(() => {
    return Array.from({ length: 5 }, (_, idx) => {
      const d = new Date(Date.now() + idx * 86400000);
      const parts = getPersianDateParts(d);
      return {
        day: parts.day,
        weekday: idx === 0 ? 'امروز' : parts.dayName,
        monthName: parts.monthName || PERSIAN_MONTHS[parts.monthIndex],
        dateStr: parts.formatted
      };
    });
  }, []);

  // Form states
  const [selectedService, setSelectedService] = useState('معاینه و طرح درمان تخصصی');
  const [selectedDoctor, setSelectedDoctor] = useState('دکتر مهدی امیری (جراح دندانپزشک)');
  const [selectedDate, setSelectedDate] = useState(() => {
    return getPersianDateParts(new Date()).formatted;
  });
  const [selectedTime, setSelectedTime] = useState('۱۷:۱۵');

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalCode, setNationalCode] = useState('');

  // Medical Health Questionnaire
  const [hasHighBloodPressure, setHasHighBloodPressure] = useState(false);
  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [hasHeartDisease, setHasHeartDisease] = useState(false);
  const [hasDrugAllergy, setHasDrugAllergy] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [takesBloodThinners, setTakesBloodThinners] = useState(false);

  // Dynamic clinic info synced with SettingsView general config
  const clinicMeta = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.clinicName || 'کلینیک دندانپزشکی مینادنتال',
          address: parsed.clinicAddress || 'تهران، سعادت‌آباد، میدان کاج، مجتمع پزشکی مروارید، طبقه ۴'
        };
      }
    } catch {}
    return {
      name: 'کلینیک دندانپزشکی مینادنتال',
      address: 'تهران، سعادت‌آباد، میدان کاج، مجتمع پزشکی مروارید، طبقه ۴'
    };
  }, []);

  const doctorsList = React.useMemo(() => {
    const unitNames = ['یونیت آبی', 'یونیت زرد', 'یونیت جراحی'];
    const dynamicDocs = (users || [])
      .filter(u => u.isActive !== false && (u.role === 'doctor' || u.isDoctor || u.isManagerAndDoctor))
      .map((u, idx) => ({
        id: u.id,
        name: u.fullName,
        specialty: u.assignedPlatform || 'دندانپزشک معالج',
        unit: unitNames[idx] || `یونیت ${toPersianDigits(idx + 1)}`
      }));
    if (dynamicDocs.length > 0) return dynamicDocs;
    return [
      { id: 'dr-1', name: 'دکتر مهدی امیری', specialty: 'جراح دندانپزشک و فلوشیپ ایمپلنت', unit: 'یونیت آبی' },
      { id: 'dr-2', name: 'دکتر مریم رضایی', specialty: 'متخصص درمان ریشه (اندودنتیست)', unit: 'یونیت زرد' }
    ];
  }, [users]);

  const occupiedTimesForDate = React.useMemo(() => {
    const map: Record<string, string> = {};
    appointments
      .filter(
        a =>
          isSamePersianDate(a.date, selectedDate) &&
          a.status !== 'cancelled' &&
          a.status !== 'completed' &&
          a.status !== 'no_show'
      )
      .forEach(a => {
        map[a.time] = 'تکمیل شده';
      });
    return map;
  }, [appointments, selectedDate]);

  // Completed booking confirmation & feedback
  const [confirmedBooking, setConfirmedBooking] = useState<OnlineBookingRequest | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && currentStep === 4 && confirmedBooking) {
      // Allow user to start fresh next time modal opens
      setCurrentStep(1);
      setConfirmedBooking(null);
      setFormError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const servicesList = [
    { id: '1', title: 'معاینه و طرح درمان تخصصی', duration: '۳۰ دقیقه', fee: 200000, desc: 'چکاپ کامل با دوربین داخل دهانی و چارت پالمر' },
    { id: '2', title: 'جرم‌گیری و بروساژ دو فک', duration: '۴۵ دقیقه', fee: 250000, desc: 'حذف پلاک و جرم دندانی با دستگاه اولتراسونیک' },
    { id: '3', title: 'ترمیم کامپوزیت همرنگ', duration: '۴۵ دقیقه', fee: 300000, desc: 'ترمیم پوسیدگی با کامپوزیت نانوهیبرید' },
    { id: '4', title: 'مشاوره و ارزیابی ایمپلنت', duration: '۳۰ دقیقه', fee: 200000, desc: 'بررسی تصاویر CBCT و اسکن سه‌بعدی استخوان' },
    { id: '5', title: 'درمان ریشه تخصصی (اندو)', duration: '۶۰ دقیقه', fee: 350000, desc: 'عصب‌کشی با روتاری دیجیتال و اپکس لوکیتور' },
    { id: '6', title: 'دندانپزشکی اطفال', duration: '۳۰ دقیقه', fee: 200000, desc: 'پالپوتومی، فلورایدتراپی و روکش SS' },
  ];

  const selectedServiceObj = servicesList.find(s => s.title === selectedService) || servicesList[0];
  const depositAmount = selectedServiceObj.fee;

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 2600);
  };

  const handleConfirmPaymentAndBook = () => {
    if (!patientName.trim() || !phone.trim()) {
      triggerHaptic('heavy');
      setFormError('لطفاً نام و نام خانوادگی و شماره همراه بیمار را وارد نمایید.');
      return;
    }
    setFormError(null);
    triggerHaptic('success');
    const trackingCode = `MD-${Math.floor(10000 + Math.random() * 90000)}`;
    const newBooking: OnlineBookingRequest = {
      id: `book-${Date.now()}`,
      trackingCode,
      patientName: patientName.trim(),
      phone: phone.trim(),
      nationalCode: nationalCode.trim() || '۰۰۱۸۳۷۴۶۲۱',
      serviceTitle: selectedService,
      doctorName: selectedDoctor,
      date: selectedDate,
      time: selectedTime,
      depositAmount,
      paymentRefNumber: `SHP-${Date.now().toString().slice(-8)}`,
      healthIntake: {
        hasHighBloodPressure,
        hasDiabetes,
        hasHeartDisease,
        hasDrugAllergy,
        isPregnant,
        takesBloodThinners,
        allergyDetails: hasDrugAllergy ? allergyDetails : undefined
      },
      status: 'confirmed',
      createdAt: `امروز ${getCurrentPersianDate()}`
    };

    setConfirmedBooking(newBooking);
    onBookingConfirmed?.(newBooking);
    setCurrentStep(4);
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="پورتال نوبت‌دهی آنلاین بیمار"
        className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in select-none"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white text-slate-900 rounded-none sm:rounded-[32px] border-0 sm:border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-right"
        >
          {/* Fixed Top Header */}
          <div className="px-4 pt-3 pb-3.5 border-b border-slate-100 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-white/35 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-white">پورتال نوبت‌دهی آنلاین اختصاصی بیمار</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                      رزرو آنلاین
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100 font-medium">کلینیک دندانپزشکی مینادنتال · رزرو سریع ۲۴ ساعته</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن پورتال نوبت‌دهی آنلاین"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step Indicator (Only during booking steps 1-3) */}
          {currentStep < 4 && (
            <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200/80 flex items-center justify-between text-xs shrink-0">
              {[
                { step: 1, title: 'خدمت و پزشک' },
                { step: 2, title: 'زمان نوبت' },
                { step: 3, title: 'سوابق سلامت و بیعانه' }
              ].map(item => (
                <div 
                  key={item.step} 
                  className={`flex items-center gap-1.5 font-bold ${
                    currentStep === item.step 
                      ? 'text-emerald-700 font-black' 
                      : currentStep > item.step 
                      ? 'text-slate-400' 
                      : 'text-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${
                    currentStep === item.step 
                      ? 'bg-emerald-600 text-white shadow-2xs' 
                      : currentStep > item.step 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {currentStep > item.step ? '✓' : toPersianDigits(item.step)}
                  </span>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Scrollable Modal Body */}
          <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-4 bg-slate-50/50">
          
          {/* STEP 1: SERVICE & DOCTOR SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 block">۱. انتخاب نوع خدمت درمانی:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {servicesList.map(s => {
                    const isSelected = selectedService === s.title;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedService(s.title);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected 
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-black text-slate-900">{s.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />}
                          </div>
                          <p className="text-[10.5px] text-slate-500">{s.desc}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1 font-mono text-slate-600">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            {s.duration}
                          </span>
                          <span className="font-bold text-emerald-700">بیعانه: {formatToman(s.fee)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Doctor selection */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-black text-slate-800 block">۲. انتخاب دندانپزشک معالج:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {doctorsList.map(doc => {
                    const isSelected = selectedDoctor.includes(doc.name);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedDoctor(`${doc.name} (${doc.specialty})`);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <Stethoscope className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">{doc.name}</span>
                            <span className="text-[10px] text-slate-500 block">{doc.specialty}</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-md">
                          {doc.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DATE & TIME SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-bold">{selectedService}</span>
                <span className="text-emerald-700 font-medium">{selectedDoctor.split('(')[0]}</span>
              </div>

              {/* Day selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 block">انتخاب روز ویزیت در ماه {getCurrentPersianMonthName()}:</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {upcomingDays.map(d => {
                    const isSelected = selectedDate === d.dateStr;
                    return (
                      <button type="button"
                        key={d.dateStr}
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedDate(d.dateStr);
                        }}
                        className={`p-2 rounded-2xl border transition-all flex flex-col items-center justify-center cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-[9.5px] opacity-75">{d.weekday}</span>
                        <span className="text-sm font-black font-mono mt-0.5">{toPersianDigits(d.day)}</span>
                        <span className="text-[8.5px] opacity-60">{d.monthName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hour / Time slot selection (08:00 AM to 23:00 PM Drum Wheel + Shifts) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-black text-slate-800 block">انتخاب ساعت نوبت (شیفت صبح ۸:۰۰ تا شیفت شب ۲۳:۰۰ · غلتکی):</label>
                <WheelTimePicker
                  value={selectedTime}
                  occupiedTimes={occupiedTimesForDate}
                  onChange={(t) => setSelectedTime(t)}
                />
              </div>
            </div>
          )}

          {/* STEP 3: PATIENT CONTACT & MEDICAL HEALTH QUESTIONNAIRE */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in text-xs">
              {/* Contact Inputs */}
              <div className="space-y-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="font-black text-slate-900 block text-xs">مشخصات هویتی و تماس بیمار:</span>
                
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">نام و نام خانوادگی بیمار *</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="مثال: کیان رادفر"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">شماره همراه (جهت پیامک نوبت) *</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">کد ملی (جهت پرونده بیمه)</label>
                    <input
                      type="text"
                      value={nationalCode}
                      onChange={(e) => setNationalCode(e.target.value)}
                      placeholder="۰۰۱۲۳۴۵۶۷۸"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Health Self-Declaration Questionnaire */}
              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-black">
                  <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
                  <span>پرسشنامه خوداظهاری سلامت عمومی (الزام پزشکی قبل از درمان):</span>
                </div>

                <p className="text-[10.5px] text-amber-800 leading-relaxed">
                  لطفاً در صورت داشتن هر یک از موارد زیر حتماً علامت بزنید تا تمهیدات لازم حین بی‌حسی و درمان اتخاذ شود:
                </p>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHighBloodPressure}
                      onChange={(e) => setHasHighBloodPressure(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">سابقه فشار خون بالا (Hypertension)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDiabetes}
                      onChange={(e) => setHasDiabetes(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">ابتلا به دیابت یا مصرف انسولین</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHeartDisease}
                      onChange={(e) => setHasHeartDisease(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">بیماری قلبی، آنژیوپلاستی یا سابقه فنر عروق</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={takesBloodThinners}
                      onChange={(e) => setTakesBloodThinners(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">مصرف داروهای رقیق‌کننده خون (وارفارین، آسپیرین، پلاویکس)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPregnant}
                      onChange={(e) => setIsPregnant(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">بارداری یا دوران شیردهی (جهت تنظیم بی‌حسی و رادیوگرافی)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDrugAllergy}
                      onChange={(e) => setHasDrugAllergy(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                    <span className="font-bold text-rose-700">حساسیت به دارو (پنی‌سیلین، لیدوکائین بی‌حسی، ایبوپروفن)</span>
                  </label>

                  {hasDrugAllergy && (
                    <input
                      type="text"
                      aria-label="نام دقیق داروی حساسیت‌زا"
                      value={allergyDetails}
                      onChange={(e) => setAllergyDetails(e.target.value)}
                      placeholder="نام دقیق داروی حساسیت‌زا را بنویسید..."
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-1.5 text-xs text-rose-900 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Deposit Payment Box */}
              <div className="p-3 bg-emerald-50 text-emerald-950 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-700 font-bold block">مبلغ بیعانه ثبت قطعی ({selectedServiceObj.title}):</span>
                  <span className="text-sm font-black text-emerald-800 font-mono">{formatToman(depositAmount)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>درگاه امن بانکی شاپرک</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRMED BOOKING SLIP & QR BARCODE */}
          {currentStep === 4 && confirmedBooking && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200 text-slate-900">
              {/* Success Badge */}
              <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-300 text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="font-black text-sm text-emerald-950 mt-1">نوبت شما با موفقیت رزرو و تایید گردید!</h4>
                <p className="text-[11px] text-emerald-800 font-medium">
                  پیامک تایید حاوی لینک نقشه کلینیک به شماره {toPersianDigits(confirmedBooking.phone)} ارسال شد.
                </p>
              </div>

              {/* Digital Admission Slip Card with Barcode */}
              <div className="bg-white p-4 rounded-3xl border-2 border-dashed border-emerald-300 shadow-md space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                  <div>
                    <span className="text-xs font-black text-slate-900 block">کلینیک دندانپزشکی مینادنتال</span>
                    <span className="text-[10px] text-slate-400">برگه الکترونیک پذیرش بیمار</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[10px] text-slate-400 block">کد رهگیری:</span>
                    <span className="text-xs font-black text-emerald-700">{confirmedBooking.trackingCode}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">بیمار:</span>
                    <span className="font-black text-slate-800">{confirmedBooking.patientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">پزشک معالج:</span>
                    <span className="font-bold text-slate-800">{confirmedBooking.doctorName.split('(')[0]}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">تاریخ نوبت:</span>
                    <span className="font-mono font-bold text-slate-800">{confirmedBooking.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">ساعت حضور:</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">{toPersianDigits(confirmedBooking.time)}</span>
                  </div>
                </div>

                {/* QR Code Graphic for Fast Gate Check-in */}
                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-200">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-8 h-8 text-slate-800" />
                    <div>
                      <span className="text-[11px] font-black text-slate-900 block">بارکد پذیرش سریع در کلینیک</span>
                      <span className="text-[9.5px] text-slate-500">هنگام ورود به منشی یا اسکنر کانتر نشان دهید</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold bg-white px-2.5 py-1 rounded-xl border text-slate-700">
                    {confirmedBooking.paymentRefNumber}
                  </span>
                </div>

                {/* GPS Location Buttons & Slip Print/Share */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-1.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>مسیریابی مطب در نشان و بلد:</span>
                    </span>
                    <div className="flex items-center gap-1 font-bold">
                      <button 
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          void copyTextSafely(`${clinicMeta.name} — ${clinicMeta.address}`);
                          showToast('آدرس مطب برای مسیریاب نشان کپی شد ✓');
                        }} 
                        className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 cursor-pointer"
                      >
                        مسیریاب نشان ✓
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          void copyTextSafely(`${clinicMeta.name} — ${clinicMeta.address}`);
                          showToast('آدرس مطب برای مسیریاب بلد کپی شد ✓');
                        }} 
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer"
                      >
                        مسیریاب بلد ✓
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        const txt = `برگه پذیرش آنلاین ${clinicMeta.name}\nکد رهگیری: ${confirmedBooking.trackingCode}\nبیمار: ${confirmedBooking.patientName}\nتاریخ: ${confirmedBooking.date} ساعت ${confirmedBooking.time}\nبیعانه پرداختی: ${formatToman(confirmedBooking.depositAmount)}`;
                        void copyTextSafely(txt);
                        showToast('اطلاعات و کد رهگیری نوبت کپی شد ✓');
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>کپی کد رهگیری</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        window.print();
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>چاپ برگه پذیرش</span>
                    </button>
                  </div>

                  {actionToast && (
                    <div className="p-2 rounded-xl bg-emerald-600 text-white text-[10.5px] font-bold text-center">
                      {actionToast}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

          {/* Fixed Footer Navigation Buttons */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-20">
            {currentStep === 1 && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setCurrentStep(2);
                  }}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>مرحله بعد: انتخاب روز و ساعت</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}

            {currentStep === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  بازگشت
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setCurrentStep(3);
                  }}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>مرحله بعد: سوابق سلامت و بیعانه</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}

            {currentStep === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  بازگشت
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPaymentAndBook}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>پرداخت بیعانه و ثبت نهایی نوبت</span>
                </button>
              </>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
              >
                بستن و اتمام
              </button>
            )}
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
