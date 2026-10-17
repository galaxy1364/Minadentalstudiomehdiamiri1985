import React, { useState } from 'react';
import { 
  FlaskConical, Activity, FileCheck2, CreditCard, 
  Package, BellRing, Sparkles, Camera,
  UserPlus, CalendarDays, Zap, Clock
} from 'lucide-react';
import { Patient } from '../../types/dental';
import { INITIAL_PATIENTS } from '../../data/mockData';
import { ClinicHeroCard } from '../ClinicHeroCard';
import { FolderCard } from '../FolderCard';
import { DashboardPatientSearch } from '../DashboardPatientSearch';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

interface DashboardViewProps {
  patients?: Patient[];
  onSelectPatient?: (patient: Patient) => void;
  onOpenPalmerForPatient?: (patient: Patient) => void;
  onOpenAppointmentForPatient?: (patient: Patient) => void;
  onNavigate: (viewId: string) => void;
  onOpenPalmerChart: () => void;
  onQuickAdmission: () => void;
  onOpenSupabaseTest?: () => void;
  todayAppointmentsCount: number;
  activeSurgeriesCount: number;
  readyLabOrdersCount: number;
  dailyRevenue: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  patients = INITIAL_PATIENTS,
  onSelectPatient,
  onOpenPalmerForPatient,
  onOpenAppointmentForPatient,
  onNavigate,
  onOpenPalmerChart,
  onQuickAdmission,
  onOpenSupabaseTest,
  todayAppointmentsCount,
  activeSurgeriesCount,
  readyLabOrdersCount,
  dailyRevenue
}) => {
  const [cardLayout, setCardLayout] = useState<'full' | 'grid'>('full');
  const { impactLight, impactHeavy, selection } = useHapticFeedback();

  return (
    <div className="dashboard-view w-full pb-16 pt-0 space-y-2.5 select-none px-1 sm:px-1.5">
      
      {/* 
        0. Persistent Search-As-You-Type Patient Filter:
        Instant search by name, file number, phone, and 1-tap quick filter chips
      */}
      <DashboardPatientSearch
        patients={patients}
        onSelectPatient={(p) => {
          if (onSelectPatient) {
            onSelectPatient(p);
          } else {
            onNavigate('patients');
          }
        }}
        onOpenPalmerChart={(p) => {
          if (onOpenPalmerForPatient) {
            onOpenPalmerForPatient(p);
          } else {
            onOpenPalmerChart();
          }
        }}
        onOpenAppointment={(p) => {
          if (onOpenAppointmentForPatient) {
            onOpenAppointmentForPatient(p);
          } else {
            onNavigate('appointments');
          }
        }}
        onQuickAdmission={onQuickAdmission}
      />
      
      {/* 
        1. 100% Practical Clinic Command Center:
        Compact height embedding live doctor unit, today revenue, 
        live clinical metrics, and instant action triggers.
      */}
      <ClinicHeroCard
        onQuickAdmission={onQuickAdmission}
        onOpenPalmerChart={onOpenPalmerChart}
        onOpenAppointments={() => onNavigate('appointments')}
        onOpenFinancial={() => onNavigate('financial')}
        onOpenSupabaseTest={onOpenSupabaseTest}
        onOpenShiftSettings={() => onNavigate('settings')}
        todayAppointmentsCount={todayAppointmentsCount}
        activeSurgeriesCount={activeSurgeriesCount}
        readyLabOrdersCount={readyLabOrdersCount}
        dailyRevenue={dailyRevenue}
      />

      {/* 
        2. بخش دسترسی سریع (Quick Access Section):
        Direct 1-tap rapid actions:
        1. نوبت‌دهی (Appointments)
        2. تشکیل پرونده (New Patient File / Admission)
        3. مالی (Financial / Invoices)
        4. لابراتوار (Dental Prosthetics Lab)
        5. ایمپلنت (Implant Operations)
        6. تقویم (Calendar / Schedule)
      */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-[20px] p-2 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between px-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="text-[11px] font-black text-slate-800 tracking-tight">دسترسی سریع</span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
          {/* 1. نوبت‌دهی */}
          <button
            onClick={() => {
              impactLight();
              onNavigate('appointments');
            }}
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[13px] bg-slate-50 hover:bg-amber-50 text-slate-800 border border-slate-200/80 group active:scale-95 transition-all shadow-2xs"
            title="نوبت‌دهی سریع بیماران"
          >
            <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Clock className="w-3 h-3 stroke-[2.4]" />
            </div>
            <span className="text-[8.5px] font-bold text-slate-700 leading-none truncate max-w-full">نوبت‌دهی</span>
          </button>

          {/* 2. تشکیل پرونده */}
          <button
            onClick={() => {
              impactHeavy();
              onQuickAdmission();
            }}
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[13px] bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 group active:scale-95 transition-all shadow-xs"
            title="تشکیل پرونده و پذیرش بیمار جدید"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <UserPlus className="w-3 h-3 stroke-[2.8]" />
            </div>
            <span className="text-[8.5px] font-black text-white leading-none truncate max-w-full">تشکیل پرونده</span>
          </button>

          {/* 3. مالی */}
          <button
            onClick={() => {
              impactLight();
              onNavigate('financial');
            }}
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[13px] bg-slate-50 hover:bg-pink-50 text-slate-800 border border-slate-200/80 group active:scale-95 transition-all shadow-2xs"
            title="امور مالی، چک صیادی و اقساط"
          >
            <div className="w-6 h-6 rounded-full bg-pink-500/15 text-pink-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <CreditCard className="w-3 h-3 stroke-[2.4]" />
            </div>
            <span className="text-[8.5px] font-bold text-slate-700 leading-none truncate max-w-full">مالی</span>
          </button>

          {/* 4. لابراتوار */}
          <button
            onClick={() => {
              impactLight();
              onNavigate('lab');
            }}
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[13px] bg-slate-50 hover:bg-purple-50 text-slate-800 border border-slate-200/80 group active:scale-95 transition-all shadow-2xs"
            title="سفارشات و وضعیت لابراتوار پروتز"
          >
            <div className="w-6 h-6 rounded-full bg-purple-500/15 text-purple-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <FlaskConical className="w-3 h-3 stroke-[2.4]" />
            </div>
            <span className="text-[8.5px] font-bold text-slate-700 leading-none truncate max-w-full">لابراتوار</span>
          </button>

          {/* 5. ایمپلنت */}
          <button
            onClick={() => {
              impactLight();
              onNavigate('implant');
            }}
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[13px] bg-slate-50 hover:bg-sky-50 text-slate-800 border border-slate-200/80 group active:scale-95 transition-all shadow-2xs"
            title="جراحی‌ها و مراحل کاشت ایمپلنت"
          >
            <div className="w-6 h-6 rounded-full bg-sky-500/15 text-sky-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Activity className="w-3 h-3 stroke-[2.4]" />
            </div>
            <span className="text-[8.5px] font-bold text-slate-700 leading-none truncate max-w-full">ایمپلنت</span>
          </button>

          {/* 6. تقویم */}
          <button
            onClick={() => {
              impactLight();
              onNavigate('appointments');
            }}
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-[13px] bg-slate-50 hover:bg-indigo-50 text-slate-800 border border-slate-200/80 group active:scale-95 transition-all shadow-2xs"
            title="تقویم شمسی و زمان‌بندی یونیت‌ها"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-3 h-3 stroke-[2.4]" />
            </div>
            <span className="text-[8.5px] font-bold text-slate-700 leading-none truncate max-w-full">تقویم</span>
          </button>
        </div>
      </div>

      {/* 
        3. Q-Bank Notched Module Cards Grid:
        - CSS Selector: .dashboard-view .grid .tile
        - Authentic Q-Bank shapes with continuous one-sided curvature and spring button
        - Old large icon size restored (w-10 h-10 container with w-5 h-5 icons)
        - Dedicated text column so text NEVER goes under the icon
        - Stretches full-width to the edges of the screen as requested
      */}
      <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-[11px] font-black text-slate-800">ماژول‌های کلینیک</span>
        </div>
        
        {/* Layout Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
          <button
            onClick={() => {
              selection();
              setCardLayout('full');
            }}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              cardLayout === 'full' 
                ? 'bg-white text-slate-900 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="کاشی‌های تمام‌عرض"
          >
            تمام‌عرض
          </button>
          <button
            onClick={() => {
              selection();
              setCardLayout('grid');
            }}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              cardLayout === 'grid' 
                ? 'bg-white text-slate-900 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="کاشی‌های ۲ ستونه"
          >
            ۲ ستونه
          </button>
        </div>
      </div>

      <div className={`grid ${cardLayout === 'full' ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-1.5 sm:gap-2'} w-full`}>
        {/* Module 1: کاشت ایمپلنت */}
        <FolderCard
          title="کاشت ایمپلنت"
          subtitle="مراحل جراحی و قطعات"
          icon={<Activity className="w-5 h-5 text-sky-400" />}
          badge={`${activeSurgeriesCount} فعال`}
          theme="cyan"
          className="tile"
          onClick={() => onNavigate('implant')}
        />

        {/* Module 2: لابراتوار پروتز */}
        <FolderCard
          title="لابراتوار پروتز"
          subtitle="ارسال و تحویل روکش"
          icon={<FlaskConical className="w-5 h-5 text-purple-400" />}
          badge={`${readyLabOrdersCount} آماده`}
          theme="purple"
          className="tile"
          onClick={() => onNavigate('lab')}
        />

        {/* Module 3: چک صیادی */}
        <FolderCard
          title="چک صیادی"
          subtitle="استعلام و ثبت صیاد"
          icon={<FileCheck2 className="w-5 h-5 text-pink-400" />}
          badge="۲ در جریان"
          theme="pink"
          className="tile"
          onClick={() => onNavigate('financial')}
        />

        {/* Module 4: اقساط و تسویه */}
        <FolderCard
          title="اقساط و تسویه"
          subtitle="سررسید ماهانه بیماران"
          icon={<CreditCard className="w-5 h-5 text-amber-400" />}
          badge="وصول به‌موقع"
          theme="amber"
          className="tile"
          onClick={() => onNavigate('financial')}
        />

        {/* Module 5: هوش مصنوعی مینادنتال */}
        <FolderCard
          title="هوش مصنوعی"
          subtitle="تحلیل OPG و طرح درمان"
          icon={<Sparkles className="w-5 h-5 text-cyan-300" />}
          badge="دستیار فعال"
          theme="gemini"
          className="tile"
          onClick={() => onNavigate('ai_assistant')}
        />

        {/* Module 6: انبار و متریال */}
        <FolderCard
          title="انبار و متریال"
          subtitle="کنترل موجودی ایمپلنت"
          icon={<Package className="w-5 h-5 text-emerald-400" />}
          badge="کنترل موجودی"
          theme="emerald"
          className="tile"
          onClick={() => onNavigate('inventory')}
        />

        {/* Module 7: پیامک و یادآوری */}
        <FolderCard
          title="پیامک و یادآوری"
          subtitle="اطلاع‌رسانی خودکار"
          icon={<BellRing className="w-5 h-5 text-rose-400" />}
          badge="ارسال خودکار"
          theme="rose"
          className="tile"
          onClick={() => onNavigate('reminders')}
        />

        {/* Module 8: رادیولوژی و تصاویر */}
        <FolderCard
          title="رادیولوژی"
          subtitle="آرشیو تصاویر فک و دندان"
          icon={<Camera className="w-5 h-5 text-teal-400" />}
          badge="PA & OPG"
          theme="teal"
          className="tile"
          onClick={() => onNavigate('xrays')}
        />
      </div>

    </div>
  );
};
