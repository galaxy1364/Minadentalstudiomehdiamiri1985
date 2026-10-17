import React, { useState } from 'react';
import { 
  X, Search, ChevronLeft, Headphones,
  Activity, FlaskConical, FileCheck2, CreditCard, Sparkles, 
  UserPlus, Calendar, Layers, Shield, Receipt, 
  Package, BellRing, Camera, FileText, BarChart3, Settings
} from 'lucide-react';
import { FolderCard } from './FolderCard';

interface ServicesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: any) => void;
}

interface ServiceItem {
  id: string;
  title: string;
  category: string;
  themeColor: string;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  icon: React.ReactNode;
}

export const ServicesSheet: React.FC<ServicesSheetProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // 16 Complete Modules with ZERO repeating black and 100% luminous medical color profiles
  const services: ServiceItem[] = [
    {
      id: 'implant',
      title: 'کاشت ایمپلنت',
      category: 'جراحی',
      themeColor: 'sky',
      iconBg: 'bg-sky-100 border-sky-300',
      iconColor: 'text-sky-600',
      cardBg: 'from-white via-[#f0f9ff] to-[#e0f2fe]',
      icon: <Activity className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'lab',
      title: 'لابراتوار پروتز',
      category: 'پروتز',
      themeColor: 'purple',
      iconBg: 'bg-purple-100 border-purple-300',
      iconColor: 'text-purple-600',
      cardBg: 'from-white via-[#faf5ff] to-[#f3e8ff]',
      icon: <FlaskConical className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'sayad_checks',
      title: 'چک صیادی',
      category: 'مالی',
      themeColor: 'pink',
      iconBg: 'bg-pink-100 border-pink-300',
      iconColor: 'text-pink-600',
      cardBg: 'from-white via-[#fff1f2] to-[#fce7f3]',
      icon: <FileCheck2 className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'installments',
      title: 'اقساط درمانی',
      category: 'مالی',
      themeColor: 'amber',
      iconBg: 'bg-amber-100 border-amber-300',
      iconColor: 'text-amber-600',
      cardBg: 'from-white via-[#fffbeb] to-[#fef3c7]',
      icon: <CreditCard className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'ai_assistant',
      title: 'هوش مصنوعی جمنای',
      category: 'هوشمند',
      themeColor: 'gemini',
      iconBg: 'bg-indigo-100 border-indigo-300',
      iconColor: 'text-indigo-600',
      cardBg: 'from-white via-[#f0f9ff] to-[#fdf4ff]',
      icon: <Sparkles className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'patients',
      title: 'پرونده بیماران',
      category: 'پذیرش',
      themeColor: 'indigo',
      iconBg: 'bg-blue-100 border-blue-300',
      iconColor: 'text-blue-600',
      cardBg: 'from-white via-[#eef2ff] to-[#e0e7ff]',
      icon: <UserPlus className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'appointments',
      title: 'نوبت‌دهی و تقویم',
      category: 'پذیرش',
      themeColor: 'emerald',
      iconBg: 'bg-emerald-100 border-emerald-300',
      iconColor: 'text-emerald-600',
      cardBg: 'from-white via-[#f0fdf4] to-[#dcfce7]',
      icon: <Calendar className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'palmer',
      title: 'چارت دندانی پالمر',
      category: 'درمان',
      themeColor: 'teal',
      iconBg: 'bg-teal-100 border-teal-300',
      iconColor: 'text-teal-600',
      cardBg: 'from-white via-[#f0fdfa] to-[#ccfbf1]',
      icon: <Layers className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'guarantee_checks',
      title: 'چک ضمانت',
      category: 'مالی',
      themeColor: 'rose',
      iconBg: 'bg-rose-100 border-rose-300',
      iconColor: 'text-rose-600',
      cardBg: 'from-white via-[#fff1f2] to-[#ffe4e6]',
      icon: <Shield className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'pos_payments',
      title: 'کارتخوان و POS',
      category: 'مالی',
      themeColor: 'lime',
      iconBg: 'bg-lime-100 border-lime-300',
      iconColor: 'text-lime-700',
      cardBg: 'from-white via-[#f7fee7] to-[#ecfccb]',
      icon: <Receipt className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'inventory',
      title: 'انبار و متریال',
      category: 'مدیریت',
      themeColor: 'green',
      iconBg: 'bg-emerald-100 border-emerald-300',
      iconColor: 'text-emerald-700',
      cardBg: 'from-white via-[#f0fdf4] to-[#bbf7d0]',
      icon: <Package className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'reminders',
      title: 'پیامک و یادآوری',
      category: 'ارتباطات',
      themeColor: 'orange',
      iconBg: 'bg-orange-100 border-orange-300',
      iconColor: 'text-orange-600',
      cardBg: 'from-white via-[#fff7ed] to-[#ffedd5]',
      icon: <BellRing className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'xrays',
      title: 'رادیولوژی OPG',
      category: 'تشخیص',
      themeColor: 'cyan',
      iconBg: 'bg-cyan-100 border-cyan-300',
      iconColor: 'text-cyan-600',
      cardBg: 'from-white via-[#ecfeff] to-[#cffafe]',
      icon: <Camera className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'treatment_plans',
      title: 'طرح درمان جامع',
      category: 'درمان',
      themeColor: 'magenta',
      iconBg: 'bg-fuchsia-100 border-fuchsia-300',
      iconColor: 'text-fuchsia-600',
      cardBg: 'from-white via-[#fdf4ff] to-[#fae8ff]',
      icon: <FileText className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'reports',
      title: 'گزارشات آماری',
      category: 'مدیریت',
      themeColor: 'purple',
      iconBg: 'bg-purple-100 border-purple-300',
      iconColor: 'text-purple-600',
      cardBg: 'from-white via-[#f5f3ff] to-[#ede9fe]',
      icon: <BarChart3 className="w-6 h-6 stroke-[2.2]" />
    },
    {
      id: 'settings',
      title: 'تنظیمات کلینیک',
      category: 'مدیریت',
      themeColor: 'slate',
      iconBg: 'bg-slate-100 border-slate-300',
      iconColor: 'text-slate-600',
      cardBg: 'from-white via-[#f8fafc] to-[#f1f5f9]',
      icon: <Settings className="w-6 h-6 stroke-[2.2]" />
    }
  ];

  const filteredServices = services.filter(s =>
    s.title.includes(searchQuery) || s.category.includes(searchQuery)
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between overflow-hidden animate-in fade-in duration-200 select-none">
      
      {/* Top Header - Pure Clean White with Emerald Accent */}
      <div className="relative px-5 pt-3 pb-3 flex items-center justify-between z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        {/* Right: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8 2 6 5 6 9c0 5 3 9 4.5 11 .7.9 1 .9 1.5 0C13.5 18 18 14 18 9c0-4-2-7-6-7Z" />
              <circle cx="12" cy="9" r="2.5" fill="#059669" />
            </svg>
          </div>
          <div>
            <span className="text-base font-black text-slate-800 tracking-tight block">مینادنتال</span>
            <span className="text-[10px] text-slate-500 font-medium">کلیه ماژول‌ها و خدمات تخصصی کلینیک</span>
          </div>
        </div>

        {/* Left: Close button and Headset support button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
            aria-label="بستن منو"
          >
            <X className="w-4 h-4 text-slate-700" />
          </button>
          <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Headphones className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Services Container - Light Background with Curved Cutout Tiles */}
      <div className="flex-1 bg-gradient-to-b from-slate-50 via-white to-slate-50 px-3 pt-5 pb-2 overflow-y-auto no-scrollbar">
        
        {/* 2-Column Grid of High-Precision Q-Bank Notched Cards */}
        <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto pb-6">
          {filteredServices.map((service) => (
            <FolderCard
              key={service.id}
              title={service.title}
              subtitle={service.category}
              icon={service.icon}
              theme={
                service.themeColor === 'sky' ? 'cyan' :
                service.themeColor === 'purple' ? 'purple' :
                service.themeColor === 'pink' || service.themeColor === 'magenta' ? 'pink' :
                service.themeColor === 'amber' || service.themeColor === 'yellow' ? 'amber' :
                service.themeColor === 'gemini' || service.themeColor === 'indigo' ? 'gemini' :
                service.themeColor === 'emerald' || service.themeColor === 'green' || service.themeColor === 'lime' ? 'emerald' :
                service.themeColor === 'rose' || service.themeColor === 'orange' ? 'rose' : 'teal'
              }
              onClick={() => {
                onNavigate(service.id);
                onClose();
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Bar: Search Input & Circular Back Button */}
      <div className="bg-white px-4 pb-5 pt-2 border-t border-slate-100 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          {/* Back Circular Button */}
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-all"
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-xs focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
