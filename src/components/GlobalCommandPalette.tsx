import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, X, User, Calendar, 
  CreditCard, FlaskConical, Activity, 
  Settings, Camera, ShieldCheck, FileCheck2,
  Package, BellRing, CornerDownLeft, QrCode, Sparkles, Stethoscope
} from 'lucide-react';
import { Patient, Appointment, InventoryItem } from '../types/dental';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { normalizeClinicalQuery, searchClinicUniversal, UniversalSearchHit } from '../utils/clinicalIntelligence';
import { ViewportModalPortal } from './ViewportModalPortal';

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  appointments?: Appointment[];
  inventory?: InventoryItem[];
  onSelectPatient: (
    p: Patient,
    tab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai'
  ) => void;
  onOpenPalmerChart: (p: Patient) => void;
  onNavigate: (viewId: string) => void;
  onQuickAdmission: () => void;
  onOpenPaymentModal: () => void;
  onOpenClinicalHud: () => void;
  onOpenAccessibility: () => void;
  onOpenUniversalScanner?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'بیمار' | 'چک صیادی' | 'لابراتوار' | 'ایمپلنت' | 'نوبت' | 'انبار' | 'ماژول' | 'عملیات بالینی';
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  secondaryLabel?: string;
  secondaryAction?: () => void;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
  patients,
  appointments = [],
  inventory = [],
  onSelectPatient,
  onOpenPalmerChart,
  onNavigate,
  onQuickAdmission,
  onOpenPaymentModal,
  onOpenClinicalHud,
  onOpenAccessibility,
  onOpenUniversalScanner
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { selection, impactLight } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);

  // Reset query and focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Static module items
  const moduleItems: CommandItem[] = useMemo(() => [
    ...(onOpenUniversalScanner ? [{
      id: 'cmd-universal-scanner',
      title: 'اسکنر دوربین هوشمند QR و بارکد سراسری',
      category: 'عملیات بالینی' as const,
      subtitle: 'اسکن پاکت لابراتوار، چک صیادی، کارت بیمار، پک استریل و انبار',
      icon: <QrCode className="w-4 h-4 text-violet-600" />,
      action: onOpenUniversalScanner
    }] : []),
    ...(patients[0] ? [{
      id: 'cmd-palmer',
      title: 'باز کردن چارت دندانی پالمر',
      category: 'عملیات بالینی' as const,
      subtitle: `ثبت سریع درمان و وضعیت دندان (${patients[0].fullName})`,
      icon: <Stethoscope className="w-4 h-4 text-teal-600" />,
      action: () => onOpenPalmerChart(patients[0])
    }] : []),
    {
      id: 'cmd-hud',
      title: 'کنسول بالینی شناور (Clinical HUD)',
      category: 'عملیات بالینی',
      subtitle: 'تلمتری آلرژی، درمان و کارهای لابراتوار',
      icon: <Activity className="w-4 h-4 text-teal-600" />,
      action: onOpenClinicalHud
    },
    {
      id: 'cmd-admission',
      title: 'پذیرش فوری و تشکیل پرونده',
      category: 'عملیات بالینی',
      subtitle: 'ثبت سریع اطلاعات بیمار و کاردکس',
      icon: <User className="w-4 h-4 text-sky-600" />,
      action: onQuickAdmission
    },
    {
      id: 'cmd-payment',
      title: 'ثبت دریافت وجه و فیش POS',
      category: 'عملیات بالینی',
      subtitle: 'دستگاه کارتخوان و تسویه درمان',
      icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
      action: onOpenPaymentModal
    },
    {
      id: 'cmd-ai',
      title: 'هوش مصنوعی و دستیار بالینی',
      category: 'ماژول',
      subtitle: 'مشاوره جراحی، دوز کارپول، پروتکل دارو و طرح درمان',
      icon: <Sparkles className="w-4 h-4 text-fuchsia-600" />,
      action: () => onNavigate('ai_assistant')
    },
    {
      id: 'cmd-implant',
      title: 'ماژول کاشت ایمپلنت',
      category: 'ماژول',
      subtitle: 'مراحل جراحی، فیکسچر، هیلینگ و اباتمنت',
      icon: <Activity className="w-4 h-4 text-cyan-600" />,
      action: () => onNavigate('implant')
    },
    {
      id: 'cmd-lab',
      title: 'لابراتوار پروتز و روکش',
      category: 'ماژول',
      subtitle: 'ارسال قالب، زیرکونیا، PFM و تحویل',
      icon: <FlaskConical className="w-4 h-4 text-purple-600" />,
      action: () => onNavigate('lab')
    },
    {
      id: 'cmd-sterilization',
      title: 'استریلیزاسیون و اتوکلاو',
      category: 'ماژول',
      subtitle: 'پک‌های استریل، لاگ سیکل و بارکد چسبی',
      icon: <ShieldCheck className="w-4 h-4 text-teal-600" />,
      action: () => onNavigate('sterilization')
    },
    {
      id: 'cmd-insurance',
      title: 'بیمه پایه و تعرفه‌های درمانی',
      category: 'ماژول',
      subtitle: 'تامین اجتماعی، سلامت، بیمه تکمیلی',
      icon: <FileCheck2 className="w-4 h-4 text-blue-600" />,
      action: () => onNavigate('insurance_claims')
    },
    {
      id: 'cmd-xrays',
      title: 'رادیولوژی و تصاویر OPG / PA',
      category: 'ماژول',
      subtitle: 'آرشیو تصاویر فک و دندان و هوش مصنوعی',
      icon: <Camera className="w-4 h-4 text-cyan-600" />,
      action: () => onNavigate('xrays')
    },
    {
      id: 'cmd-financial',
      title: 'مدیریت مالی، چک صیادی و اقساط',
      category: 'ماژول',
      subtitle: 'ثبت چک، استعلام، سررسید و تسویه',
      icon: <CreditCard className="w-4 h-4 text-pink-600" />,
      action: () => onNavigate('financial')
    },
    {
      id: 'cmd-appointments',
      title: 'نوبت‌دهی تقویم ایرانی',
      category: 'ماژول',
      subtitle: 'مدیریت یونیت‌ها، پزشکان و نوبت بیماران',
      icon: <Calendar className="w-4 h-4 text-blue-600" />,
      action: () => onNavigate('appointments')
    },
    {
      id: 'cmd-inventory',
      title: 'انبارداری و کنترل متریال',
      category: 'ماژول',
      subtitle: 'کنترل موجودی، هشدار کسری و بارکدخوان',
      icon: <Package className="w-4 h-4 text-emerald-600" />,
      action: () => onNavigate('inventory')
    },
    {
      id: 'cmd-reminders',
      title: 'سامانه پیامک و یادآوری',
      category: 'ماژول',
      subtitle: 'ارسال خودکار پیامک نوبت، چک و تبریک',
      icon: <BellRing className="w-4 h-4 text-rose-600" />,
      action: () => onNavigate('reminders')
    },
    {
      id: 'cmd-settings',
      title: 'تنظیمات کلینیک، تعرفه‌ها و پشتیبان‌گیری',
      category: 'ماژول',
      subtitle: 'تعرفه خدمات، پرسنل، بکاپ ابری و گوگل درایو',
      icon: <Settings className="w-4 h-4 text-slate-600" />,
      action: () => onNavigate('settings')
    },
    {
      id: 'cmd-accessibility',
      title: 'دسترسی‌پذیری، کنتراست چراغ و سایز قلم',
      category: 'عملیات بالینی',
      subtitle: 'حالت دستکش جراحی، بزرگ‌نمایی و کنتراست بالا',
      icon: <Settings className="w-4 h-4 text-amber-600" />,
      action: onOpenAccessibility
    }
  ], [onOpenUniversalScanner, patients, onOpenPalmerChart, onOpenClinicalHud, onQuickAdmission, onOpenPaymentModal, onNavigate, onOpenAccessibility]);

  // Universal search across Patients, Sayad Checks, Lab Orders, Implants, Appointments, Inventory, and Modules
  const filteredItems = useMemo(() => {
    const q = normalizeClinicalQuery(query);
    if (!q) {
      return moduleItems.slice(0, 8);
    }

    const universalHits = searchClinicUniversal(query, patients, appointments, inventory);
    const iconByCategory: Record<UniversalSearchHit['category'], React.ReactNode> = {
      'بیمار': <User className="w-4 h-4 text-emerald-600" />,
      'چک صیادی': <CreditCard className="w-4 h-4 text-pink-600" />,
      'لابراتوار': <FlaskConical className="w-4 h-4 text-purple-600" />,
      'ایمپلنت': <Activity className="w-4 h-4 text-cyan-600" />,
      'نوبت': <Calendar className="w-4 h-4 text-sky-600" />,
      'انبار': <Package className="w-4 h-4 text-amber-600" />
    };
    const dynamicItems: CommandItem[] = universalHits.map((hit) => {
      const matchedPatient = hit.patientId ? patients.find((p) => p.id === hit.patientId) : undefined;
      return {
        id: hit.id,
        title: hit.title,
        category: hit.category,
        subtitle: hit.subtitle,
        icon: iconByCategory[hit.category],
        action: () => {
          if (matchedPatient) {
            onSelectPatient(matchedPatient, hit.patientTab || 'treatments');
          } else if (hit.targetView) {
            onNavigate(hit.targetView);
          }
        },
        secondaryLabel: matchedPatient && hit.category === 'بیمار' ? 'چارت پالمر' : undefined,
        secondaryAction: matchedPatient && hit.category === 'بیمار' ? () => onOpenPalmerChart(matchedPatient) : undefined
      };
    });

    const actionMatches = moduleItems.filter((m) => {
      const nTitle = normalizeClinicalQuery(m.title);
      const nSub = normalizeClinicalQuery(m.subtitle || '');
      return nTitle.includes(q) || nSub.includes(q);
    });

    return [...dynamicItems, ...actionMatches];
  }, [query, patients, appointments, inventory, moduleItems, onSelectPatient, onOpenPalmerChart, onNavigate]);

  const safeSelectedIndex = filteredItems.length > 0 ? Math.min(selectedIndex, filteredItems.length - 1) : 0;

  // Keyboard navigation inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      selection();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      selection();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[safeSelectedIndex]) {
        impactLight();
        filteredItems[safeSelectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        className="fixed inset-0 z-[120] flex items-start justify-center pt-12 sm:pt-16 px-3 sm:px-4 bg-purple-950/35 backdrop-blur-md select-none animate-in fade-in duration-150"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="فرمان صوتی و جستجوی جامع مینادنتال"
      >
        <div
          className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-purple-200/90 rounded-[28px] shadow-[0_24px_64px_rgba(88,28,135,0.22)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Search Input Bar */}
          <div className="relative flex items-center px-4 py-3.5 border-b border-purple-100 bg-gradient-to-l from-purple-50/70 via-white to-emerald-50/40">
            <Search className="w-5 h-5 text-purple-600 ml-2.5 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              aria-label="جستجوی جامع کلینیک"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="جستجوی همه‌جانبه بیمار، ماژول، درمان، یا فرمان (مثلاً: محمدی، ایمپلنت، چک)..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-bold"
            />
            {query && (
              <button
                type="button"
                aria-label="پاک کردن عبارت جستجو"
                onClick={() => {
                  impactLight();
                  setQuery('');
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="p-1.5 rounded-lg hover:bg-purple-100 text-slate-500 mr-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن جستجوی سریع"
              className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200 font-mono font-bold shrink-0 mr-1 cursor-pointer"
            >
              ESC
            </button>
          </div>

          {/* Results List */}
          <div role="listbox" aria-label="نتایج جستجوی فرمان بالینی" className="max-h-80 overflow-y-auto p-2 space-y-1 bg-slate-50/40">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-bold">
                موردی مطابق با «{query}» یافت نشد.
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = idx === safeSelectedIndex;
                return (
                  <div
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      impactLight();
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-2xl flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-50/95 border border-purple-300 shadow-xs text-slate-950'
                        : 'bg-white/80 hover:bg-purple-50/50 text-slate-800 border border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected ? 'bg-white border-purple-300 shadow-2xs' : 'bg-slate-50 border-slate-200'
                      }`}>
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black truncate">{item.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100/80 text-purple-800 font-bold shrink-0">
                            {item.category}
                          </span>
                        </div>
                        {item.subtitle && (
                          <span className="text-[10.5px] text-slate-500 font-medium block truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.secondaryLabel && item.secondaryAction && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            impactLight();
                            item.secondaryAction?.();
                            onClose();
                          }}
                          className="px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-black cursor-pointer"
                        >
                          {item.secondaryLabel}
                        </button>
                      )}
                      {isSelected && (
                        <span className="text-[10px] text-purple-700 flex items-center gap-0.5 font-black">
                          <span>اجرا</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer shortcuts info */}
          <div className="px-4 py-2 bg-purple-50/60 border-t border-purple-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
            <div className="flex items-center gap-3">
              <span>↑↓ جابجایی</span>
              <span>↵ باز کردن</span>
            </div>
            <span className="font-mono text-purple-700">Cmd + K / Ctrl + K</span>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
