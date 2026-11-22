import React from 'react';
import {
  Logo3DHome,
  Logo3DPatients,
  Logo3DTreatments,
  Logo3DFinancial,
  Logo3DAppointments,
  Logo3DGridServices,
  Logo3DThumbZap
} from './ThreeDimensionalLogos';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export type NavTab = 'home' | 'patients' | 'treatments' | 'financial' | 'appointments';

interface BottomDockProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenServicesMenu: () => void;
  onOpenThumbZone?: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  onOpenServicesMenu,
  onOpenThumbZone
}) => {
  const { selection, impactMedium } = useHapticFeedback();

  const handleTab = (tab: NavTab) => {
    selection();
    onTabChange(tab);
  };

  const navItems: {
    id: NavTab;
    label: string;
    title: string;
    activeClass: string;
    activeText: string;
    icon: (isActive: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'home',
      label: 'خانه',
      title: 'داشبورد کلینیک',
      activeClass: 'bg-emerald-50 text-emerald-950 border border-emerald-300/90',
      activeText: 'text-emerald-950 font-black',
      icon: (isActive) => (
        <Logo3DHome
          size={22}
          className={`w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] shrink-0 transition-transform drop-shadow-[0_2px_3px_rgba(16,185,129,0.22)] ${
            isActive ? 'scale-110' : 'opacity-95'
          }`}
        />
      )
    },
    {
      id: 'patients',
      label: 'بیماران',
      title: 'پرونده بیماران',
      activeClass: 'bg-sky-50 text-sky-950 border border-sky-300/90',
      activeText: 'text-sky-950 font-black',
      icon: (isActive) => (
        <Logo3DPatients
          size={22}
          className={`w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] shrink-0 transition-transform drop-shadow-[0_2px_3px_rgba(14,165,233,0.22)] ${
            isActive ? 'scale-110' : 'opacity-95'
          }`}
        />
      )
    },
    {
      id: 'treatments',
      label: 'درمان',
      title: 'درمان و چارت پالمر',
      activeClass: 'bg-teal-50 text-teal-950 border border-teal-300/90',
      activeText: 'text-teal-950 font-black',
      icon: (isActive) => (
        <Logo3DTreatments
          size={22}
          className={`w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] shrink-0 transition-transform drop-shadow-[0_2px_3px_rgba(20,184,166,0.22)] ${
            isActive ? 'scale-110' : 'opacity-95'
          }`}
        />
      )
    },
    {
      id: 'financial',
      label: 'مالی',
      title: 'امور مالی و چک صیادی',
      activeClass: 'bg-amber-50 text-amber-950 border border-amber-300/90',
      activeText: 'text-amber-950 font-black',
      icon: (isActive) => (
        <Logo3DFinancial
          size={22}
          className={`w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] shrink-0 transition-transform drop-shadow-[0_2px_3px_rgba(245,158,11,0.25)] ${
            isActive ? 'scale-110' : 'opacity-95'
          }`}
        />
      )
    },
    {
      id: 'appointments',
      label: 'نوبت‌ها',
      title: 'نوبت‌دهی و تقویم ایرانی',
      activeClass: 'bg-blue-50 text-blue-950 border border-blue-300/90',
      activeText: 'text-blue-950 font-black',
      icon: (isActive) => (
        <Logo3DAppointments
          size={22}
          className={`w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] shrink-0 transition-transform drop-shadow-[0_2px_3px_rgba(37,99,235,0.22)] ${
            isActive ? 'scale-110' : 'opacity-95'
          }`}
        />
      )
    }
  ];

  return (
    <nav
      aria-label="ناوبری اصلی داک مینادنتال"
      className="BottomDock fixed inset-x-0 z-50 flex justify-center w-full max-w-full overflow-hidden h-[48px] sm:h-[56px] px-2 sm:px-3 pointer-events-none"
      style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 sm:gap-2 max-w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl w-full h-[48px] sm:h-[56px] min-w-0"
        dir="rtl"
      >
        {/* Detached Services Launcher (48px mobile / 56px desktop) */}
        <button
          type="button"
          onClick={() => {
            impactMedium();
            onOpenServicesMenu();
          }}
          className="ios27-dock-key relative flex flex-col items-center justify-center w-[48px] h-[48px] sm:w-[56px] sm:h-[56px] rounded-full bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[var(--shadow-dock)] hover:border-purple-300 text-slate-800 hover:text-purple-700 shrink-0 group cursor-pointer touch-manipulation"
          title="منوی کلیه ماژول‌ها و خدمات کلینیک"
          aria-label="کلیه خدمات کلینیک"
        >
          <span className="dock-icon-slot flex items-center justify-center grow">
            <Logo3DGridServices
              size={22}
              className="w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] group-hover:scale-110 transition-transform shrink-0 grow drop-shadow-[0_2px_3px_rgba(124,58,237,0.25)]"
            />
          </span>
          <span className="text-[9.5px] sm:text-[10.5px] font-bold text-slate-800 group-hover:text-purple-700 pb-1 leading-none select-none whitespace-nowrap">
            خدمات
          </span>
        </button>

        {/* Main Floating Capsule Dock: 48px mobile height with flex-grow on keys & icons to prevent touch overlap */}
        <div className="dock-capsule flex-1 grow flex items-center justify-between gap-1 sm:gap-1.5 px-1.5 sm:px-2 h-[48px] sm:h-[56px] rounded-full bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[var(--shadow-dock)] min-w-0 overflow-hidden">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`ios27-dock-key flex-1 grow basis-0 flex flex-col sm:flex-row items-center justify-center sm:gap-1.5 h-[40px] sm:h-[44px] px-1 sm:px-2 rounded-full transition-colors duration-150 cursor-pointer touch-manipulation min-w-0 ${
                  isActive
                    ? item.activeClass
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80 border border-transparent font-bold'
                }`}
                title={item.title}
              >
                <span className="dock-icon-slot flex items-center justify-center grow sm:grow-0">
                  {item.icon(isActive)}
                </span>
                <span
                  className={`text-[9.5px] sm:text-[12px] mt-0.5 sm:mt-0 leading-none select-none whitespace-nowrap truncate max-w-full ${
                    isActive ? item.activeText : 'text-slate-700 font-bold'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {onOpenThumbZone && (
            <button
              type="button"
              onClick={() => {
                impactMedium();
                onOpenThumbZone();
              }}
              className="ios27-dock-key flex-1 grow basis-0 flex flex-col sm:flex-row items-center justify-center sm:gap-1.5 h-[40px] sm:h-[44px] px-1 sm:px-2 rounded-full border border-transparent hover:bg-lime-50 text-slate-700 hover:text-lime-900 group cursor-pointer touch-manipulation min-w-0"
              title="فرمان‌های سریع با یک دست"
              aria-label="فرمان‌های سریع"
            >
              <span className="dock-icon-slot flex items-center justify-center grow sm:grow-0">
                <Logo3DThumbZap
                  size={21}
                  className="w-[20px] h-[20px] sm:w-[23px] sm:h-[23px] group-hover:scale-110 transition-transform shrink-0 grow drop-shadow-[0_2px_3px_rgba(132,204,22,0.25)]"
                />
              </span>
              <span className="text-[9.5px] sm:text-[11.5px] font-bold text-slate-700 group-hover:text-lime-900 mt-0.5 sm:mt-0 leading-none select-none whitespace-nowrap truncate max-w-full">
                سریع
              </span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
