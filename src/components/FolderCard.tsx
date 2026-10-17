import React, { useRef, useState, useEffect, useId } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export type CardTheme = 
  | 'cyan'      // آبی آسمانی (کاشت ایمپلنت)
  | 'purple'    // بنفش رویایی (لابراتوار پروتز)
  | 'pink'      // صورتی متالیک (چک صیادی)
  | 'amber'     // طلایی / کهربایی (اقساط)
  | 'gemini'    // هاله نیلگون جمنای (هوش مصنوعی)
  | 'emerald'   // سبز زمردی (انبار و متریال)
  | 'rose'      // رز و مرجانی (پیامک و یادآوری)
  | 'teal';     // فیروزه‌ای نئونی (رادیولوژی)

interface FolderCardProps {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
  theme?: CardTheme;
  subtitle?: string;
  className?: string;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  title,
  icon,
  badge,
  onClick,
  theme = 'cyan',
  subtitle,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 175, height: 84 });
  const uniqueId = useId().replace(/:/g, '_');
  const { impactLight } = useHapticFeedback();

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDims({
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      }
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Theme color mapping matching Q-Bank / Blu: Fluid gradients, dark squircle boxes & vibrant accents
  const getThemeStyles = () => {
    switch (theme) {
      case 'purple':
        return {
          gradStart: '#ffffff',
          gradMid: '#faf5ff',
          gradEnd: '#f3e8ff',
          borderColor: 'rgba(216, 180, 254, 0.95)',
          fluidGlow: 'bg-radial from-purple-400/25 via-violet-300/15 to-transparent',
          iconBox: 'bg-purple-100 border-purple-300 text-purple-700 shadow-xs',
          badgeStyle: 'bg-purple-100 text-purple-900 border-purple-300',
          btnHover: 'group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600',
          arrowColor: 'text-purple-600'
        };
      case 'pink':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff1f2',
          gradEnd: '#fce7f3',
          borderColor: 'rgba(251, 207, 232, 0.95)',
          fluidGlow: 'bg-radial from-pink-400/25 via-rose-300/15 to-transparent',
          iconBox: 'bg-pink-100 border-pink-300 text-pink-700 shadow-xs',
          badgeStyle: 'bg-pink-100 text-pink-900 border-pink-300',
          btnHover: 'group-hover:bg-pink-600 group-hover:text-white group-hover:border-pink-600',
          arrowColor: 'text-pink-600'
        };
      case 'amber':
        return {
          gradStart: '#ffffff',
          gradMid: '#fffbeb',
          gradEnd: '#fef3c7',
          borderColor: 'rgba(253, 230, 138, 0.95)',
          fluidGlow: 'bg-radial from-amber-400/25 via-yellow-300/15 to-transparent',
          iconBox: 'bg-amber-100 border-amber-300 text-amber-700 shadow-xs',
          badgeStyle: 'bg-amber-100 text-amber-900 border-amber-300',
          btnHover: 'group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500',
          arrowColor: 'text-amber-600'
        };
      case 'gemini':
        return {
          gradStart: '#ffffff',
          gradMid: '#f0f9ff',
          gradEnd: '#fdf4ff',
          borderColor: 'rgba(186, 230, 253, 0.95)',
          fluidGlow: 'bg-radial from-indigo-400/30 via-pink-300/20 to-transparent animate-pulse',
          iconBox: 'bg-indigo-100 border-indigo-300 text-indigo-700 shadow-xs',
          badgeStyle: 'bg-cyan-100 text-cyan-900 border-cyan-300',
          btnHover: 'group-hover:bg-cyan-500 group-hover:text-black group-hover:border-cyan-500',
          arrowColor: 'text-cyan-600'
        };
      case 'emerald':
        return {
          gradStart: '#ffffff',
          gradMid: '#f0fdf4',
          gradEnd: '#dcfce7',
          borderColor: 'rgba(187, 247, 208, 0.95)',
          fluidGlow: 'bg-radial from-emerald-400/25 via-green-300/15 to-transparent',
          iconBox: 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-xs',
          badgeStyle: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          btnHover: 'group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600',
          arrowColor: 'text-emerald-600'
        };
      case 'rose':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff1f2',
          gradEnd: '#ffe4e6',
          borderColor: 'rgba(254, 205, 211, 0.95)',
          fluidGlow: 'bg-radial from-rose-400/25 via-orange-300/15 to-transparent',
          iconBox: 'bg-rose-100 border-rose-300 text-rose-700 shadow-xs',
          badgeStyle: 'bg-rose-100 text-rose-900 border-rose-300',
          btnHover: 'group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600',
          arrowColor: 'text-rose-600'
        };
      case 'teal':
        return {
          gradStart: '#ffffff',
          gradMid: '#f0fdfa',
          gradEnd: '#ccfbf1',
          borderColor: 'rgba(153, 246, 228, 0.95)',
          fluidGlow: 'bg-radial from-teal-400/25 via-emerald-300/15 to-transparent',
          iconBox: 'bg-teal-100 border-teal-300 text-teal-700 shadow-xs',
          badgeStyle: 'bg-teal-100 text-teal-900 border-teal-300',
          btnHover: 'group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600',
          arrowColor: 'text-teal-600'
        };
      case 'cyan':
      default:
        return {
          gradStart: '#ffffff',
          gradMid: '#f0f9ff',
          gradEnd: '#e0f2fe',
          borderColor: 'rgba(186, 230, 253, 0.95)',
          fluidGlow: 'bg-radial from-sky-400/25 via-cyan-300/15 to-transparent',
          iconBox: 'bg-sky-100 border-sky-300 text-sky-700 shadow-xs',
          badgeStyle: 'bg-sky-100 text-sky-900 border-sky-300',
          btnHover: 'group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600',
          arrowColor: 'text-sky-600'
        };
    }
  };

  const style = getThemeStyles();

  // Precise Q-Bank curved notch geometry:
  // W = card width, H = card height
  // R = outer corner radii (20px)
  // notchW = notch horizontal span (42px)
  // notchH = notch vertical span (42px)
  const W = Math.max(dims.width, 140);
  const H = Math.max(dims.height, 78);
  const R = 20;
  const notchW = 42;
  const notchH = 42;

  // Continuous mathematical path with organic tangent curvature (Q-Bank authentic one-sided curve):
  // Curves smoothly from the bottom border inward, cradling the circular button,
  // and flows into the left border without any sharp 90-degree cusps.
  const svgPath = `
    M ${notchW} ${H}
    C ${notchW - 18} ${H}, 0 ${H - 18}, 0 ${H - notchH}
    L 0 ${R}
    A ${R} ${R} 0 0 1 ${R} 0
    L ${W - R} 0
    A ${R} ${R} 0 0 1 ${W} ${R}
    L ${W} ${H - R}
    A ${R} ${R} 0 0 1 ${W - R} ${H}
    L ${notchW} ${H}
    Z
  `.trim().replace(/\s+/g, ' ');

  return (
    <div
      ref={containerRef}
      onClick={() => {
        impactLight();
        onClick();
      }}
      className={`tile relative cursor-pointer group active:scale-[0.98] transition-all select-none w-full ${className}`}
      style={{ filter: 'drop-shadow(0 3px 10px rgba(0, 0, 0, 0.16))' }}
    >
      {/* 
        High-Precision Vector Chassis (Q-Bank authentic one-sided curvature):
        Continuous vector path with unified fluid gradient and flawless 1.2px border arc.
      */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox={`0 0 ${W} ${H}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`grad_${uniqueId}`} x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={style.gradStart} />
            <stop offset="50%" stopColor={style.gradMid} />
            <stop offset="100%" stopColor={style.gradEnd} />
          </linearGradient>
        </defs>
        <path
          d={svgPath}
          fill={`url(#grad_${uniqueId})`}
          stroke={style.borderColor}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Card Contents Container */}
      <div className="relative z-10 p-2.5 flex flex-col justify-between h-[82px] sm:h-[86px]">
        {/* Animated Fluid Water/Gemini Ambient Glow */}
        <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-xl pointer-events-none opacity-60 ${style.fluidGlow}`} />

        {/* 
          Top Row: 
          - Right: Title + Subtitle in a dedicated column with flex-1 min-w-0
          - Left: Large squircle logo container (w-10 h-10)
          This strictly guarantees text NEVER wraps or goes under the icon!
        */}
        <div className="relative z-10 flex items-start justify-between gap-1.5">
          {/* Title & Subtitle column */}
          <div className="flex flex-col text-right flex-1 min-w-0 pr-0.5">
            <span className="text-[12px] sm:text-[13px] font-black text-slate-900 tracking-tight leading-snug group-hover:text-black truncate">
              {title}
            </span>
            {subtitle && (
              <span className="text-[9px] sm:text-[9.5px] text-slate-500 font-medium leading-tight mt-0.5 truncate">
                {subtitle}
              </span>
            )}
          </div>

          {/* Squircle logo container: Prestigious size (w-9.5 to w-10) */}
          <div className={`w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-[12px] sm:rounded-[13px] flex items-center justify-center shrink-0 border group-hover:scale-105 transition-transform ${style.iconBox}`}>
            {icon}
          </div>
        </div>

        {/* 
          Bottom Row: 
          - Left: pl-10 leaves empty clearance for the circular button in the scooped cove
          - Right: Status Badge cleanly positioned on the right
          This guarantees text NEVER goes under the circular arrow button!
        */}
        <div className="relative z-10 flex items-center justify-between mt-auto pt-1 pl-10 pr-0.5">
          <div className="w-6 shrink-0" aria-hidden="true" /> {/* Spacer clearing the notch */}
          {badge && (
            <span className={`text-[8.5px] sm:text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-2xs leading-none ${style.badgeStyle}`}>
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* 
        Circular Action Button:
        Nestled with precision directly inside the scooped cove at bottom-left corner.
      */}
      <div className="absolute bottom-1.5 left-1.5 z-20">
        <div 
          className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white/95 ${style.btnHover} ${style.arrowColor} flex items-center justify-center transition-all duration-200 ease-out shadow-xs active:scale-90 border border-slate-200 group-hover:scale-110`}
        >
          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
};
