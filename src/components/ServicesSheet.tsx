import React, { useState, useEffect } from 'react';
import { X, Search, ChevronLeft, Headphones } from 'lucide-react';
import { FolderCard, CardTheme } from './FolderCard';
import { toPersianDigits } from '../utils/jalali';
import { normalizeClinicalQuery } from '../utils/clinicalIntelligence';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import {
  Logo3DImplant,
  Logo3DLab,
  Logo3DSayadCheck,
  Logo3DInstallments,
  Logo3DAiGemini,
  Logo3DPatients,
  Logo3DTreatments,
  Logo3DAppointments,
  Logo3DInventory,
  Logo3DReminders,
  Logo3DXRay,
  Logo3DMarketing,
  Logo3DFinancial,
  Logo3DGridServices,
  Logo3DThumbZap,
  Logo3DPalmerChart,
  Logo3DGuaranteeCheck,
  Logo3DPosTerminal,
  Logo3DTreatmentPlans,
  Logo3DReports,
  Logo3DSettings,
  Logo3DCommissions,
  Logo3DInsurance,
  Logo3DSterilization,
  Logo3DOnlineBooking,
  Logo3DDigitalLabPortal,
  Logo3DSmsGateway,
  Logo3DClinicalAudit,
  Logo3DLiveSync,
  Logo3DMainDentalTooth
} from './ThreeDimensionalLogos';

interface ServicesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: any) => void;
  lowStockCount?: number;
}

interface ServiceItem {
  id: string;
  title: string;
  category: string;
  themeColor: CardTheme;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  icon: React.ReactNode;
}

export const ServicesSheet: React.FC<ServicesSheetProps> = ({
  isOpen,
  onClose,
  onNavigate,
  lowStockCount = 0
}) => {
  const { impactLight, selection } = useHapticFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<'all' | 'clinical' | 'financial' | 'reception' | 'management'>('all');
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveGroup('all');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Complete Clinical & Management Modules with 23 Distinct Non-Repeating Q-Bank Themes
  const services: ServiceItem[] = [
    {
      id: 'implant',
      title: 'کاشت ایمپلنت',
      category: 'جراحی',
      themeColor: 'cyan',
      iconBg: 'bg-sky-100 border-sky-300',
      iconColor: 'text-sky-600',
      cardBg: 'from-white via-[#f0f9ff] to-[#e0f2fe]',
      icon: <Logo3DImplant size={38} />
    },
    {
      id: 'lab',
      title: 'لابراتوار پروتز',
      category: 'پروتز',
      themeColor: 'purple',
      iconBg: 'bg-purple-100 border-purple-300',
      iconColor: 'text-purple-600',
      cardBg: 'from-white via-[#faf5ff] to-[#f3e8ff]',
      icon: <Logo3DLab size={38} />
    },
    {
      id: 'sayad_checks',
      title: 'چک صیادی',
      category: 'مالی',
      themeColor: 'pink',
      iconBg: 'bg-pink-100 border-pink-300',
      iconColor: 'text-pink-600',
      cardBg: 'from-white via-[#fff1f2] to-[#fce7f3]',
      icon: <Logo3DSayadCheck size={38} />
    },
    {
      id: 'installments',
      title: 'اقساط درمانی',
      category: 'مالی',
      themeColor: 'amber',
      iconBg: 'bg-amber-100 border-amber-300',
      iconColor: 'text-amber-600',
      cardBg: 'from-white via-[#fffbeb] to-[#fef3c7]',
      icon: <Logo3DInstallments size={38} />
    },
    {
      id: 'ai_assistant',
      title: 'هوش مصنوعی',
      category: 'هوشمند',
      themeColor: 'gemini',
      iconBg: 'bg-indigo-100 border-indigo-300',
      iconColor: 'text-indigo-600',
      cardBg: 'from-white via-[#f0f9ff] to-[#fdf4ff]',
      icon: <Logo3DAiGemini size={38} />
    },
    {
      id: 'patients',
      title: 'پرونده بیماران',
      category: 'پذیرش',
      themeColor: 'indigo',
      iconBg: 'bg-blue-100 border-blue-300',
      iconColor: 'text-blue-600',
      cardBg: 'from-white via-[#eef2ff] to-[#e0e7ff]',
      icon: <Logo3DPatients size={38} />
    },
    {
      id: 'appointments',
      title: 'نوبت‌دهی و تقویم',
      category: 'پذیرش',
      themeColor: 'lime',
      iconBg: 'bg-lime-100 border-lime-300',
      iconColor: 'text-lime-600',
      cardBg: 'from-white via-[#f7fee7] to-[#ecfccb]',
      icon: <Logo3DAppointments size={38} />
    },
    {
      id: 'palmer',
      title: 'چارت دندانی پالمر',
      category: 'درمان',
      themeColor: 'turquoise',
      iconBg: 'bg-teal-100 border-teal-300',
      iconColor: 'text-teal-600',
      cardBg: 'from-white via-[#f0fdfa] to-[#ccfbf1]',
      icon: <Logo3DPalmerChart size={38} />
    },
    {
      id: 'guarantee_checks',
      title: 'چک ضمانت',
      category: 'مالی',
      themeColor: 'crimson',
      iconBg: 'bg-red-100 border-red-300',
      iconColor: 'text-red-600',
      cardBg: 'from-white via-[#fef2f2] to-[#fecdd3]',
      icon: <Logo3DGuaranteeCheck size={38} />
    },
    {
      id: 'pos_payments',
      title: 'کارتخوان و POS',
      category: 'مالی',
      themeColor: 'gold',
      iconBg: 'bg-yellow-100 border-yellow-300',
      iconColor: 'text-yellow-700',
      cardBg: 'from-white via-[#fefce8] to-[#fef08a]',
      icon: <Logo3DPosTerminal size={38} />
    },
    {
      id: 'inventory',
      title: 'انبار و متریال',
      category: 'مدیریت',
      themeColor: 'emerald',
      iconBg: 'bg-emerald-100 border-emerald-300',
      iconColor: 'text-emerald-700',
      cardBg: 'from-white via-[#f0fdf4] to-[#bbf7d0]',
      icon: <Logo3DInventory size={38} />
    },
    {
      id: 'reminders',
      title: 'پیامک و یادآوری',
      category: 'ارتباطات',
      themeColor: 'orange',
      iconBg: 'bg-orange-100 border-orange-300',
      iconColor: 'text-orange-600',
      cardBg: 'from-white via-[#fff7ed] to-[#ffedd5]',
      icon: <Logo3DReminders size={38} />
    },
    {
      id: 'xrays',
      title: 'رادیولوژی OPG',
      category: 'تشخیص',
      themeColor: 'teal',
      iconBg: 'bg-cyan-100 border-cyan-300',
      iconColor: 'text-cyan-600',
      cardBg: 'from-white via-[#ecfeff] to-[#cffafe]',
      icon: <Logo3DXRay size={38} />
    },
    {
      id: 'treatment_plans',
      title: 'طرح درمان جامع',
      category: 'درمان',
      themeColor: 'coral',
      iconBg: 'bg-orange-100 border-orange-300',
      iconColor: 'text-orange-600',
      cardBg: 'from-white via-[#fff7ed] to-[#fed7aa]',
      icon: <Logo3DTreatmentPlans size={38} />
    },
    {
      id: 'marketing',
      title: 'تبلیغات و کمپین‌ها',
      category: 'بازاریابی',
      themeColor: 'rose',
      iconBg: 'bg-rose-100 border-rose-300',
      iconColor: 'text-rose-600',
      cardBg: 'from-white via-[#fff1f2] to-[#ffe4e6]',
      icon: <Logo3DMarketing size={38} />
    },
    {
      id: 'reports',
      title: 'گزارشات آماری',
      category: 'مدیریت',
      themeColor: 'blue',
      iconBg: 'bg-blue-100 border-blue-300',
      iconColor: 'text-blue-600',
      cardBg: 'from-white via-[#eff6ff] to-[#bfdbfe]',
      icon: <Logo3DReports size={38} />
    },
    {
      id: 'settings',
      title: 'تنظیمات کلینیک',
      category: 'مدیریت',
      themeColor: 'slate',
      iconBg: 'bg-slate-100 border-slate-300',
      iconColor: 'text-slate-600',
      cardBg: 'from-white via-[#f8fafc] to-[#f1f5f9]',
      icon: <Logo3DSettings size={38} />
    },
    {
      id: 'doctor_commissions',
      title: 'سهم‌بندی پزشکان',
      category: 'مالی',
      themeColor: 'peach',
      iconBg: 'bg-rose-100 border-rose-300',
      iconColor: 'text-rose-700',
      cardBg: 'from-white via-[#fff1f2] to-[#fecdd3]',
      icon: <Logo3DCommissions size={38} />
    },
    {
      id: 'insurance_claims',
      title: 'بیمه پایه و تکمیلی',
      category: 'مالی',
      themeColor: 'fuchsia',
      iconBg: 'bg-fuchsia-100 border-fuchsia-300',
      iconColor: 'text-fuchsia-600',
      cardBg: 'from-white via-[#fdf4ff] to-[#fae8ff]',
      icon: <Logo3DInsurance size={38} />
    },
    {
      id: 'sterilization',
      title: 'استریلیزاسیون و اتوکلاو',
      category: 'جراحی',
      themeColor: 'sky',
      iconBg: 'bg-sky-100 border-sky-300',
      iconColor: 'text-sky-600',
      cardBg: 'from-white via-[#ecfeff] to-[#cffafe]',
      icon: <Logo3DSterilization size={38} />
    },
    {
      id: 'online_booking',
      title: 'نوبت‌دهی آنلاین بیمار',
      category: 'پذیرش',
      themeColor: 'mint',
      iconBg: 'bg-emerald-100 border-emerald-300',
      iconColor: 'text-emerald-600',
      cardBg: 'from-white via-[#ecfdf5] to-[#d1fae5]',
      icon: <Logo3DOnlineBooking size={38} />
    },
    {
      id: 'digital_lab',
      title: 'پورتال همکار لابراتوار',
      category: 'پروتز',
      themeColor: 'violet',
      iconBg: 'bg-violet-100 border-violet-300',
      iconColor: 'text-violet-600',
      cardBg: 'from-white via-[#f5f3ff] to-[#ede9fe]',
      icon: <Logo3DDigitalLabPortal size={38} />
    },
    {
      id: 'sms_gateway',
      title: 'تنظیمات پیامک خدماتی',
      category: 'ارتباطات',
      themeColor: 'lavender',
      iconBg: 'bg-purple-100 border-purple-300',
      iconColor: 'text-purple-600',
      cardBg: 'from-white via-[#f5f3ff] to-[#ddd6fe]',
      icon: <Logo3DSmsGateway size={38} />
    },
    {
      id: 'audit_tracker',
      title: 'ممیزی و پیگیری',
      category: 'فاز ۱ تا ۶ قفل ✓',
      themeColor: 'olive',
      iconBg: 'bg-lime-100 border-lime-300',
      iconColor: 'text-lime-700',
      cardBg: 'from-white via-[#f7fee7] to-[#ecfccb]',
      icon: <Logo3DClinicalAudit size={38} />
    }
  ];

  const normalizedQuery = normalizeClinicalQuery(searchQuery);
  const groupCategories: Record<'clinical' | 'financial' | 'reception' | 'management', string[]> = {
    clinical: ['جراحی', 'پروتز', 'درمان', 'تشخیص', 'هوشمند'],
    financial: ['مالی'],
    reception: ['پذیرش', 'ارتباطات', 'بازاریابی'],
    management: ['مدیریت', 'فاز ۱ تا ۶ قفل ✓']
  };

  const filteredServices = services.filter((s) => {
    const matchesGroup = activeGroup === 'all' || groupCategories[activeGroup].includes(s.category);
    if (!matchesGroup) return false;
    if (!normalizedQuery) return true;
    const normTitle = normalizeClinicalQuery(s.title);
    const normCat = normalizeClinicalQuery(s.category);
    const normId = normalizeClinicalQuery(s.id.replace(/_/g, ' '));
    return normTitle.includes(normalizedQuery) || normCat.includes(normalizedQuery) || normId.includes(normalizedQuery);
  });

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="همه ماژول‌ها و خدمات کلینیک"
      onClick={() => {
        impactLight();
        onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-[6px] flex flex-col justify-end overflow-hidden select-none pt-1.5 sm:pt-3"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-1 w-full max-w-full sm:max-w-[640px] md:max-w-[880px] lg:max-w-[1140px] xl:max-w-[1280px] mx-auto bg-white rounded-t-[30px] shadow-[0_-16px_48px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-col justify-between overflow-hidden ios27-sheet-enter border-t border-white/80"
      >
        {/* iOS 27 Native Sheet Grabber Handle */}
        <div
          onClick={() => {
            impactLight();
            onClose();
          }}
          className="w-full pt-2 pb-0.5 flex items-center justify-center bg-white/95 cursor-pointer group"
          title="بستن شیت خدمات"
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300/90 group-hover:bg-slate-400 transition-colors" />
        </div>

        {/* Top Header - Pure Clean White */}
        <div className="relative px-4 pt-1.5 pb-2 flex items-center justify-between z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center shrink-0">
              <Logo3DMainDentalTooth size={40} />
            </div>
            <span className="text-[14.5px] font-black text-slate-900 tracking-tight">همه ماژول‌ها و خدمات</span>
          </div>

          {/* Left: Close button and Headset support button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                impactLight();
                onClose();
              }}
              className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
              aria-label="بستن منو"
            >
              <X className="w-4 h-4 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => {
                impactLight();
                onNavigate('ai_assistant');
                onClose();
              }}
              className="min-w-[38px] min-h-[38px] rounded-[12px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 transition-all active:scale-95 cursor-pointer"
              title="پشتیبانی هوشمند و راهنمای کلینیک"
              aria-label="پشتیبانی هوشمند"
            >
              <Headphones className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Category Strip */}
        <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'all', label: `همه (${toPersianDigits(services.length)})` },
            { id: 'clinical', label: 'درمان و جراحی' },
            { id: 'financial', label: 'مالی و بیمه' },
            { id: 'reception', label: 'پذیرش و پیامک' },
            { id: 'management', label: 'انبار و مدیریت' }
          ].map((grp) => (
            <button
              key={grp.id}
              type="button"
              onClick={() => {
                selection();
                setActiveGroup(grp.id as typeof activeGroup);
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-black shrink-0 transition-all cursor-pointer border ${
                activeGroup === grp.id
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
              }`}
            >
              {grp.label}
            </button>
          ))}
        </div>

        {/* Main Services Container - Light Background with Curved Cutout Tiles Stretched to Screen Edges */}
        <div className="flex-1 bg-gradient-to-b from-slate-50 via-white to-slate-50 px-1.5 sm:px-2.5 md:px-4 pt-3 pb-2 overflow-y-auto no-scrollbar">
          {filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center space-y-2.5">
              <p className="text-xs font-black text-slate-600">
                ماژول یا خدمتی مطابق با «{searchQuery}» یافت نشد.
              </p>
              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setSearchQuery('');
                  setActiveGroup('all');
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black cursor-pointer"
              >
                نمایش همه خدمات کلینیک
              </button>
            </div>
          ) : (
            /* 2-Column Grid on Phone, 3-Column on iPad, 4-Column on Laptop */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 w-full mx-auto pb-20">
              {filteredServices.map((service) => (
                <FolderCard
                  key={service.id}
                  title={service.title}
                  subtitle={service.category}
                  icon={service.icon}
                  badge={service.id === 'inventory' && lowStockCount > 0 ? `${toPersianDigits(lowStockCount)} قلم کسری` : undefined}
                  badgeAlert={service.id === 'inventory' && lowStockCount > 0}
                  alertDot={service.id === 'inventory' && lowStockCount > 0}
                  theme={service.themeColor}
                  onClick={() => {
                    onNavigate(service.id);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Bar: Search Input & Circular Back Button */}
        <div className="bg-white px-4 pb-5 pt-2 border-t border-slate-100 shadow-sm">
          <div className="max-w-lg mx-auto flex items-center gap-2">
            {/* Back Circular Button */}
            <button type="button"
              onClick={() => {
                impactLight();
                onClose();
              }}
              className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-all cursor-pointer"
              aria-label="بازگشت"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            {/* Pill Search Input */}
            <div className="flex-1 h-11 rounded-full bg-slate-50 border border-slate-200 flex items-center px-4 gap-2 shadow-xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="جستجو در بخش‌ها، خدمات و ابزارها..."
                value={searchQuery}
                onFocus={() => selection()}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-xs focus:outline-none"
              />
              {searchQuery && (
                <button type="button"
                  onClick={() => {
                    impactLight();
                    setSearchQuery('');
                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
