import React from 'react';
import { 
  Home, 
  Users, 
  Layers, 
  FileCheck2, 
  Calendar, 
  LayoutGrid 
} from 'lucide-react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export type NavTab = 'home' | 'patients' | 'treatments' | 'financial' | 'appointments';

interface BottomDockProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenServicesMenu: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  onOpenServicesMenu
}) => {
  const { selection, impactMedium } = useHapticFeedback();

  const handleTab = (tab: NavTab) => {
    selection();
    onTabChange(tab);
  };

  return (
    <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-[0_12px_36px_rgba(0,0,0,0.12)] max-w-md w-full justify-between">
        
        {/* Left side: Grid All Services Button */}
        <button
          onClick={() => {
            impactMedium();
            onOpenServicesMenu();
          }}
          className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-xs border border-slate-200 group"
          title="منوی کلیه خدمات"
          aria-label="کلیه خدمات کلینیک"
        >
          <LayoutGrid className="w-5 h-5 group-hover:rotate-12 transition-transform text-slate-800" />
        </button>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 flex-1 justify-around">
          {/* Dashboard Tab */}
          <button
            onClick={() => handleTab('home')}
            className={`transition-all duration-200 active:scale-95 ${
              activeTab === 'home'
                ? 'bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-emerald-600/30'
                : 'w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-full'
            }`}
            title="داشبورد"
          >
            <Home className="w-4 h-4" />
            {activeTab === 'home' && <span className="text-xs">داشبورد</span>}
          </button>

          {/* Patients Tab */}
          <button
            onClick={() => handleTab('patients')}
            className={`transition-all duration-200 active:scale-95 ${
              activeTab === 'patients'
                ? 'bg-sky-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-sky-600/30'
                : 'w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-full'
            }`}
            title="پرونده بیماران"
          >
            <Users className="w-4 h-4" />
            {activeTab === 'patients' && <span className="text-xs">بیماران</span>}
          </button>

          {/* Treatments / Palmer Chart Tab */}
          <button
            onClick={() => handleTab('treatments')}
            className={`transition-all duration-200 active:scale-95 ${
              activeTab === 'treatments'
                ? 'bg-teal-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-teal-600/30'
                : 'w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-full'
            }`}
            title="درمان و چارت"
          >
            <Layers className="w-4 h-4" />
            {activeTab === 'treatments' && <span className="text-xs">درمان</span>}
          </button>

          {/* Financial / Checks Tab */}
          <button
            onClick={() => handleTab('financial')}
            className={`transition-all duration-200 active:scale-95 ${
              activeTab === 'financial'
                ? 'bg-amber-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-amber-600/30'
                : 'w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-full'
            }`}
            title="مالی و چک"
          >
            <FileCheck2 className="w-4 h-4" />
            {activeTab === 'financial' && <span className="text-xs">مالی</span>}
          </button>

          {/* Appointments / Calendar Tab */}
          <button
            onClick={() => handleTab('appointments')}
            className={`transition-all duration-200 active:scale-95 ${
              activeTab === 'appointments'
                ? 'bg-blue-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-blue-600/30'
                : 'w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-full'
            }`}
            title="نوبت‌دهی تقویم"
          >
            <Calendar className="w-4 h-4" />
            {activeTab === 'appointments' && <span className="text-xs">نوبت‌ها</span>}
          </button>
        </div>

      </div>
    </div>
  );
};
