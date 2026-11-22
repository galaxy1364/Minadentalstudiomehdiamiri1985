import React, { useRef, useState, useEffect, useId, useCallback } from 'react';
import { ChevronLeft, AlertTriangle, MoreVertical, Edit3, Armchair, Archive, Phone, FlaskConical, Activity, Check, Edit2, FileText } from 'lucide-react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { triggerHaptic } from '../utils/haptics';
import { FramerTooltip } from './FramerTooltip';
import { computeBadgeContrast } from '../utils/colorContrast';
import { toPersianDigits } from '../utils/jalali';

export type CardTheme = 
  | 'cyan'      // آبی آسمانی (کاشت ایمپلنت)
  | 'purple'    // بنفش رویایی (لابراتوار پروتز)
  | 'pink'      // صورتی متالیک (چک صیادی)
  | 'amber'     // طلایی / کهربایی (اقساط)
  | 'gemini'    // هاله نیلگون جمنای (هوش مصنوعی)
  | 'emerald'   // سبز زمردی (انبار و متریال)
  | 'rose'      // رز یاقوتی (تبلیغات و کمپین‌ها)
  | 'teal'      // فیروزه‌ای نئونی (رادیولوژی)
  | 'indigo'    // نیلی سلطنتی (پرونده بیماران)
  | 'lime'      // سبز لیمویی نئونی (نوبت‌دهی و تقویم)
  | 'orange'    // نارنجی مرجانی (پیامک و یادآوری)
  | 'fuchsia'   // ارغوانی یاقوتی (بیمه و خسارت الکترونیک)
  | 'sky'       // آبی یخی جراحی (استریل و اتوکلاو)
  | 'violet'    // بنفش یاسی (پورتال دیجیتال لابراتوار)
  | 'blue'      // آبی لاجوردی (گزارشات و آمار)
  | 'slate'     // نقره‌ای تیتانیومی (تنظیمات کلینیک)
  | 'crimson'   // زرشکی سلطنتی (چک ضمانت)
  | 'gold'      // طلایی خورشیدی (کارتخوان و POS)
  | 'mint'      // نعنایی روشن (نوبت‌دهی آنلاین)
  | 'coral'     // مرجانی گرم (طرح درمان جامع)
  | 'lavender'  // اسطوخودوسی مدرن (درگاه پیامک خدماتی)
  | 'turquoise' // فیروزه‌ای اقیانوسی (چارت پالمر)
  | 'peach'     // هلویی لطیف (سهم‌بندی پزشکان)
  | 'olive';    // زیتونی مدرن (ممیزی و پایش)

interface FolderCardProps {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  badgeAlert?: boolean;
  alertDot?: boolean;
  badgeBgColor?: string;
  onClick: () => void;
  theme?: CardTheme;
  subtitle?: string;
  className?: string;
  summaryWidget?: React.ReactNode;
  extraAction?: React.ReactNode;
  actionTooltip?: string;
  patientStatus?: 'in-chair' | 'lab-pending' | 'admitted' | 'urgent' | 'completed' | string;
  patientStatusLabel?: string;
  notificationCount?: number;
  notificationVariant?: 'new' | 'urgent';
  isBatchEditMode?: boolean;
  lastInteractionLabel?: string;
  onSaveNote?: (note: string) => void;
  onSaveBadge?: (badgeText: string) => void;
  onAddPatientClinicalNote?: (note: string) => void;
  onQuickCall?: () => void;
  onViewLab?: () => void;
  onUpdateTreatment?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEditDetails?: () => void;
  onMoveToChair?: () => void;
  onArchivePatient?: () => void;
  quickActionIcon?: React.ReactNode;
  quickActionLabel?: string;
  onQuickAction?: () => void;
  brandPurpleSurface?: boolean;
  children?: React.ReactNode;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  title,
  icon,
  badge,
  badgeAlert = false,
  alertDot,
  badgeBgColor,
  onClick,
  theme = 'cyan',
  subtitle,
  className = '',
  summaryWidget,
  extraAction,
  actionTooltip,
  patientStatus,
  patientStatusLabel,
  notificationCount,
  notificationVariant = 'urgent',
  isBatchEditMode = false,
  lastInteractionLabel,
  onSaveNote,
  onSaveBadge,
  onAddPatientClinicalNote,
  onQuickCall,
  onViewLab,
  onUpdateTreatment,
  onContextMenu,
  onEditDetails,
  onMoveToChair,
  onArchivePatient,
  quickActionIcon,
  quickActionLabel,
  onQuickAction,
  brandPurpleSurface = false,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 180, height: 74 });
  const [isPressing, setIsPressing] = useState(false);
  const [isDragHint, setIsDragHint] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showLongPressOverlay, setShowLongPressOverlay] = useState(false);
  const [showFastNoteOverlay, setShowFastNoteOverlay] = useState(false);
  const [fastNoteText, setFastNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(subtitle || '');
  const [badgeValue, setBadgeValue] = useState(badge || '');

  useEffect(() => {
    if (!isEditingNote && !isBatchEditMode) {
      setNoteValue(subtitle || '');
    }
  }, [subtitle, isEditingNote, isBatchEditMode]);

  useEffect(() => {
    if (!isBatchEditMode) {
      setBadgeValue(badge || '');
    }
  }, [badge, isBatchEditMode]);
  const lastHapticTime = useRef<number>(0);
  const lastActivatedAtRef = useRef<number>(0);
  const pointerDownInfoRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const dragHintTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef<boolean>(false);
  const uniqueId = useId().replace(/:/g, '_');
  const { selection, impactLight, impactMedium } = useHapticFeedback();

  const triggerCardActivate = useCallback(() => {
    if (isBatchEditMode || isEditingNote) return;
    const now = Date.now();
    if (now - lastActivatedAtRef.current < 280) return;
    lastActivatedAtRef.current = now;
    impactMedium();
    onClick();
  }, [isBatchEditMode, isEditingNote, impactMedium, onClick]);

  // Tactile press-down feedback for touch-first dental terminals
  const triggerPressDownHaptic = useCallback(() => {
    const now = performance.now();
    if (now - lastHapticTime.current > 80) {
      lastHapticTime.current = now;
      selection();
    }
  }, [selection]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerDownInfoRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    setIsPressing(true);
    triggerPressDownHaptic();

    // 1. Drag-hint animation trigger: held for > 450ms tilts and scale-increases
    if (dragHintTimer.current) clearTimeout(dragHintTimer.current);
    dragHintTimer.current = setTimeout(() => {
      setIsDragHint(true);
      triggerHaptic('gesture');
    }, 450);

    // 2. Start long-press detection for touch-screen clinical terminals (750ms threshold so normal clicks never get swallowed)
    isLongPressTriggered.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      triggerHaptic('heavy');
      setShowLongPressOverlay(true);
      if (onContextMenu) {
        const synthEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: e.clientX,
          clientY: e.clientY
        } as unknown as React.MouseEvent<HTMLDivElement>;
        onContextMenu(synthEvent);
      }
    }, 750);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPressing(false);
    setIsDragHint(false);
    if (dragHintTimer.current) {
      clearTimeout(dragHintTimer.current);
      dragHintTimer.current = null;
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Fallback tap activation if native click is suppressed by parent draggable/layout container
    const down = pointerDownInfoRef.current;
    pointerDownInfoRef.current = null;
    if (
      down &&
      !isLongPressTriggered.current &&
      !isBatchEditMode &&
      !isEditingNote &&
      !showContextMenu &&
      !showLongPressOverlay &&
      !showFastNoteOverlay
    ) {
      const targetEl = e.target as HTMLElement | null;
      const isInteractiveChild = targetEl?.closest(
        'button, input, textarea, .tile-quick-action-btn, .tile-context-trigger, .tile-context-popup, .tile-longpress-overlay, .tile-fast-note-overlay, .tile-fast-note-btn, .tile-select-checkbox'
      );
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const elapsed = Date.now() - down.time;
      if (!isInteractiveChild && dist < 16 && elapsed < 700) {
        setTimeout(() => {
          triggerCardActivate();
        }, 25);
      }
    }
  };

  const handlePointerCancel = () => {
    setIsPressing(false);
    setIsDragHint(false);
    if (dragHintTimer.current) {
      clearTimeout(dragHintTimer.current);
      dragHintTimer.current = null;
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerLeave = () => {
    setIsPressing(false);
    setIsDragHint(false);
    if (dragHintTimer.current) {
      clearTimeout(dragHintTimer.current);
      dragHintTimer.current = null;
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onContextMenu) {
      // Direct heavy haptic feedback when Quick Action is activated via context-menu
      triggerHaptic('heavy');
      onContextMenu(e);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const newW = Math.round(rect.width);
          const newH = Math.round(rect.height);
          setDims(prev => {
            if (prev.width === newW && prev.height === newH) return prev;
            return { width: newW, height: newH };
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

  // Theme color accents: Softened pastel iOS 27 & Material 3 living gradients with gentle borders and harmonic buttons
  const getThemeStyles = () => {
    switch (theme) {
      case 'purple':
        return {
          gradStart: '#ffffff',
          gradMid: '#faf5ff',
          gradEnd: '#f3e8ff',
          borderColor: '#e2d5fc',
          fluidGlow: 'bg-radial from-purple-300/25 via-violet-200/15 to-transparent',
          metaColor: 'text-purple-800',
          badgeBg: '#f3e8ff',
          badgeBorder: 'border-purple-200/70',
          badgeStyle: 'bg-purple-100/70 text-purple-900 border border-purple-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-purple-50 text-purple-600/90 border-purple-200/70 shadow-[0_1px_3px_rgba(168,85,247,0.08)]',
        };
      case 'pink':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff1f2',
          gradEnd: '#ffe4e6',
          borderColor: '#fbcfe8',
          fluidGlow: 'bg-radial from-pink-300/25 via-rose-200/15 to-transparent',
          metaColor: 'text-pink-800',
          badgeBg: '#ffe4e6',
          badgeBorder: 'border-pink-200/70',
          badgeStyle: 'bg-pink-100/70 text-pink-900 border border-pink-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-pink-50 text-pink-600/90 border-pink-200/70 shadow-[0_1px_3px_rgba(244,114,182,0.08)]',
        };
      case 'amber':
        return {
          gradStart: '#ffffff',
          gradMid: '#fffbeb',
          gradEnd: '#fef3c7',
          borderColor: '#fde68a',
          fluidGlow: 'bg-radial from-amber-300/25 via-yellow-200/15 to-transparent',
          metaColor: 'text-amber-800',
          badgeBg: '#fef3c7',
          badgeBorder: 'border-amber-200/70',
          badgeStyle: 'bg-amber-100/70 text-amber-900 border border-amber-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-amber-50 text-amber-600/90 border-amber-200/70 shadow-[0_1px_3px_rgba(245,158,11,0.08)]',
        };
      case 'emerald':
        return {
          gradStart: '#ffffff',
          gradMid: '#f0fdf4',
          gradEnd: '#dcfce7',
          borderColor: '#a7f3d0',
          fluidGlow: 'bg-radial from-emerald-300/25 via-teal-200/15 to-transparent',
          metaColor: 'text-emerald-800',
          badgeBg: '#dcfce7',
          badgeBorder: 'border-emerald-200/70',
          badgeStyle: 'bg-emerald-100/70 text-emerald-900 border border-emerald-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-emerald-50 text-emerald-600/90 border-emerald-200/70 shadow-[0_1px_3px_rgba(16,185,129,0.08)]',
        };
      case 'gemini':
        return {
          gradStart: '#ffffff',
          gradMid: '#eef2ff',
          gradEnd: '#e0e7ff',
          borderColor: '#c7d2fe',
          fluidGlow: 'bg-radial from-indigo-300/25 via-cyan-200/15 to-transparent',
          metaColor: 'text-indigo-800',
          badgeBg: '#e0e7ff',
          badgeBorder: 'border-indigo-200/70',
          badgeStyle: 'bg-indigo-100/70 text-indigo-900 border border-indigo-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-indigo-50 text-indigo-600/90 border-indigo-200/70 shadow-[0_1px_3px_rgba(99,102,241,0.08)]',
        };
      case 'rose':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff1f2',
          gradEnd: '#ffe4e6',
          borderColor: '#fecdd3',
          fluidGlow: 'bg-radial from-rose-300/25 via-orange-200/15 to-transparent',
          metaColor: 'text-rose-800',
          badgeBg: '#ffe4e6',
          badgeBorder: 'border-rose-200/70',
          badgeStyle: 'bg-rose-100/70 text-rose-900 border border-rose-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-rose-50 text-rose-600/90 border-rose-200/70 shadow-[0_1px_3px_rgba(244,63,94,0.08)]',
        };
      case 'teal':
        return {
          gradStart: '#ffffff',
          gradMid: '#f0fdfa',
          gradEnd: '#ccfbf1',
          borderColor: '#99f6e4',
          fluidGlow: 'bg-radial from-teal-300/25 via-emerald-200/15 to-transparent',
          metaColor: 'text-teal-800',
          badgeBg: '#ccfbf1',
          badgeBorder: 'border-teal-200/70',
          badgeStyle: 'bg-teal-100/70 text-teal-900 border border-teal-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-teal-50 text-teal-600/90 border-teal-200/70 shadow-[0_1px_3px_rgba(20,184,166,0.08)]',
        };
      case 'indigo':
        return {
          gradStart: '#ffffff',
          gradMid: '#eff6ff',
          gradEnd: '#dbeafe',
          borderColor: '#bfdbfe',
          fluidGlow: 'bg-radial from-blue-300/25 via-indigo-200/15 to-transparent',
          metaColor: 'text-blue-800',
          badgeBg: '#dbeafe',
          badgeBorder: 'border-blue-200/70',
          badgeStyle: 'bg-blue-100/70 text-blue-900 border border-blue-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-blue-50 text-blue-600/90 border-blue-200/70 shadow-[0_1px_3px_rgba(59,130,246,0.08)]',
        };
      case 'lime':
        return {
          gradStart: '#ffffff',
          gradMid: '#f7fee7',
          gradEnd: '#ecfccb',
          borderColor: '#d9f99d',
          fluidGlow: 'bg-radial from-lime-300/25 via-emerald-200/15 to-transparent',
          metaColor: 'text-lime-800',
          badgeBg: '#ecfccb',
          badgeBorder: 'border-lime-200/70',
          badgeStyle: 'bg-lime-100/70 text-lime-900 border border-lime-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-lime-50 text-lime-700/90 border-lime-200/70 shadow-[0_1px_3px_rgba(132,204,22,0.08)]',
        };
      case 'orange':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff7ed',
          gradEnd: '#ffedd5',
          borderColor: '#fed7aa',
          fluidGlow: 'bg-radial from-orange-300/25 via-amber-200/15 to-transparent',
          metaColor: 'text-orange-800',
          badgeBg: '#ffedd5',
          badgeBorder: 'border-orange-200/70',
          badgeStyle: 'bg-orange-100/70 text-orange-900 border border-orange-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-orange-50 text-orange-600/90 border-orange-200/70 shadow-[0_1px_3px_rgba(249,115,22,0.08)]',
        };
      case 'fuchsia':
        return {
          gradStart: '#ffffff',
          gradMid: '#fdf4ff',
          gradEnd: '#fae8ff',
          borderColor: '#f5d0fe',
          fluidGlow: 'bg-radial from-fuchsia-300/25 via-purple-200/15 to-transparent',
          metaColor: 'text-fuchsia-800',
          badgeBg: '#fae8ff',
          badgeBorder: 'border-fuchsia-200/70',
          badgeStyle: 'bg-fuchsia-100/70 text-fuchsia-900 border border-fuchsia-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-fuchsia-50 text-fuchsia-600/90 border-fuchsia-200/70 shadow-[0_1px_3px_rgba(217,70,239,0.08)]',
        };
      case 'sky':
        return {
          gradStart: '#ffffff',
          gradMid: '#ecfeff',
          gradEnd: '#cffafe',
          borderColor: '#a5f3fc',
          fluidGlow: 'bg-radial from-cyan-300/25 via-sky-200/15 to-transparent',
          metaColor: 'text-cyan-800',
          badgeBg: '#cffafe',
          badgeBorder: 'border-cyan-200/70',
          badgeStyle: 'bg-cyan-100/70 text-cyan-900 border border-cyan-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-sky-50 text-sky-600/90 border-sky-200/70 shadow-[0_1px_3px_rgba(6,182,212,0.08)]',
        };
      case 'violet':
        return {
          gradStart: '#ffffff',
          gradMid: '#f5f3ff',
          gradEnd: '#ede9fe',
          borderColor: '#ddd6fe',
          fluidGlow: 'bg-radial from-violet-300/25 via-purple-200/15 to-transparent',
          metaColor: 'text-violet-800',
          badgeBg: '#ede9fe',
          badgeBorder: 'border-violet-200/70',
          badgeStyle: 'bg-violet-100/70 text-violet-900 border border-violet-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-violet-50 text-violet-600/90 border-violet-200/70 shadow-[0_1px_3px_rgba(139,92,246,0.08)]',
        };
      case 'blue':
        return {
          gradStart: '#ffffff',
          gradMid: '#eff6ff',
          gradEnd: '#bfdbfe',
          borderColor: '#bfdbfe',
          fluidGlow: 'bg-radial from-blue-300/25 via-sky-200/15 to-transparent',
          metaColor: 'text-blue-900',
          badgeBg: '#dbeafe',
          badgeBorder: 'border-blue-200/70',
          badgeStyle: 'bg-blue-100/70 text-blue-900 border border-blue-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-blue-50 text-blue-600/90 border-blue-200/70 shadow-[0_1px_3px_rgba(37,99,235,0.08)]',
        };
      case 'slate':
        return {
          gradStart: '#ffffff',
          gradMid: '#f8fafc',
          gradEnd: '#e2e8f0',
          borderColor: '#e2e8f0',
          fluidGlow: 'bg-radial from-slate-300/25 via-zinc-200/15 to-transparent',
          metaColor: 'text-slate-800',
          badgeBg: '#e2e8f0',
          badgeBorder: 'border-slate-200/70',
          badgeStyle: 'bg-slate-100/70 text-slate-900 border border-slate-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-slate-50 text-slate-600/90 border-slate-200/70 shadow-[0_1px_3px_rgba(71,85,105,0.08)]',
        };
      case 'crimson':
        return {
          gradStart: '#ffffff',
          gradMid: '#fef2f2',
          gradEnd: '#fecdd3',
          borderColor: '#fecdd3',
          fluidGlow: 'bg-radial from-red-300/25 via-rose-200/15 to-transparent',
          metaColor: 'text-red-800',
          badgeBg: '#fee2e2',
          badgeBorder: 'border-red-200/70',
          badgeStyle: 'bg-red-100/70 text-red-900 border border-red-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-red-50 text-red-600/90 border-red-200/70 shadow-[0_1px_3px_rgba(239,68,68,0.08)]',
        };
      case 'gold':
        return {
          gradStart: '#ffffff',
          gradMid: '#fefce8',
          gradEnd: '#fef08a',
          borderColor: '#fef08a',
          fluidGlow: 'bg-radial from-yellow-300/25 via-amber-200/15 to-transparent',
          metaColor: 'text-yellow-900',
          badgeBg: '#fef9c3',
          badgeBorder: 'border-yellow-200/70',
          badgeStyle: 'bg-yellow-100/70 text-yellow-900 border border-yellow-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-yellow-50 text-yellow-700/90 border-yellow-200/70 shadow-[0_1px_3px_rgba(234,179,8,0.08)]',
        };
      case 'mint':
        return {
          gradStart: '#ffffff',
          gradMid: '#ecfdf5',
          gradEnd: '#a7f3d0',
          borderColor: '#a7f3d0',
          fluidGlow: 'bg-radial from-emerald-300/25 via-green-200/15 to-transparent',
          metaColor: 'text-emerald-900',
          badgeBg: '#d1fae5',
          badgeBorder: 'border-emerald-200/70',
          badgeStyle: 'bg-emerald-100/70 text-emerald-900 border border-emerald-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-emerald-50 text-emerald-600/90 border-emerald-200/70 shadow-[0_1px_3px_rgba(16,185,129,0.08)]',
        };
      case 'coral':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff7ed',
          gradEnd: '#fed7aa',
          borderColor: '#fed7aa',
          fluidGlow: 'bg-radial from-orange-300/25 via-rose-200/15 to-transparent',
          metaColor: 'text-orange-900',
          badgeBg: '#ffedd5',
          badgeBorder: 'border-orange-200/70',
          badgeStyle: 'bg-orange-100/70 text-orange-900 border border-orange-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-orange-50 text-orange-600/90 border-orange-200/70 shadow-[0_1px_3px_rgba(249,115,22,0.08)]',
        };
      case 'lavender':
        return {
          gradStart: '#ffffff',
          gradMid: '#f5f3ff',
          gradEnd: '#ddd6fe',
          borderColor: '#ddd6fe',
          fluidGlow: 'bg-radial from-purple-300/25 via-indigo-200/15 to-transparent',
          metaColor: 'text-purple-900',
          badgeBg: '#ede9fe',
          badgeBorder: 'border-purple-200/70',
          badgeStyle: 'bg-purple-100/70 text-purple-900 border border-purple-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-purple-50 text-purple-600/90 border-purple-200/70 shadow-[0_1px_3px_rgba(139,92,246,0.08)]',
        };
      case 'turquoise':
        return {
          gradStart: '#ffffff',
          gradMid: '#f0fdfa',
          gradEnd: '#99f6e4',
          borderColor: '#99f6e4',
          fluidGlow: 'bg-radial from-teal-300/25 via-cyan-200/15 to-transparent',
          metaColor: 'text-teal-900',
          badgeBg: '#ccfbf1',
          badgeBorder: 'border-teal-200/70',
          badgeStyle: 'bg-teal-100/70 text-teal-900 border border-teal-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-teal-50 text-teal-600/90 border-teal-200/70 shadow-[0_1px_3px_rgba(20,184,166,0.08)]',
        };
      case 'peach':
        return {
          gradStart: '#ffffff',
          gradMid: '#fff1f2',
          gradEnd: '#fecdd3',
          borderColor: '#fecdd3',
          fluidGlow: 'bg-radial from-rose-200/25 via-amber-200/15 to-transparent',
          metaColor: 'text-rose-900',
          badgeBg: '#ffe4e6',
          badgeBorder: 'border-rose-200/70',
          badgeStyle: 'bg-rose-100/70 text-rose-900 border border-rose-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-rose-50 text-rose-600/90 border-rose-200/70 shadow-[0_1px_3px_rgba(251,113,133,0.08)]',
        };
      case 'olive':
        return {
          gradStart: '#ffffff',
          gradMid: '#f7fee7',
          gradEnd: '#d9f99d',
          borderColor: '#d9f99d',
          fluidGlow: 'bg-radial from-lime-300/25 via-green-200/15 to-transparent',
          metaColor: 'text-lime-900',
          badgeBg: '#ecfccb',
          badgeBorder: 'border-lime-200/70',
          badgeStyle: 'bg-lime-100/70 text-lime-900 border border-lime-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-lime-50 text-lime-700/90 border-lime-200/70 shadow-[0_1px_3px_rgba(101,163,13,0.08)]',
        };
      case 'cyan':
      default:
        return {
          gradStart: '#ffffff',
          gradMid: '#f0f9ff',
          gradEnd: '#e0f2fe',
          borderColor: '#bae6fd',
          fluidGlow: 'bg-radial from-sky-300/25 via-cyan-200/15 to-transparent',
          metaColor: 'text-sky-800',
          badgeBg: '#e0f2fe',
          badgeBorder: 'border-sky-200/70',
          badgeStyle: 'bg-sky-100/70 text-sky-900 border border-sky-200/80 font-medium',
          actionBtnClass: 'bg-white/85 hover:bg-sky-50 text-sky-600/90 border-sky-200/70 shadow-[0_1px_3px_rgba(14,165,233,0.08)]',
        };
    }
  };

  const style = getThemeStyles();

  // Dynamically compute the contrast ratio for the tile's primary status badge
  const badgeColorResolved = badgeAlert ? '#f43f5e' : (badgeBgColor || style.badgeBg || '#e0f2fe');
  const badgeContrast = computeBadgeContrast(badgeColorResolved);

  // Authentic Q-Bank Curvature & Sleek Low-Height Proportions:
  // Compact low-profile height harmonized with Persian typography and frameless 3D logos,
  // with a smooth organic S-curve cutout pocket at the bottom-left for the '<' key button.
  const W = Math.max(dims.width, 140);
  const H = Math.max(dims.height, 74);
  const R = 16;    // Smooth outer corner radius
  const cutW = 34; // Width of bottom-left pocket
  const cutH = 22; // Height of bottom-left pocket
  const cR = 8;    // Inner pocket smoothing radius (zero sharp corners)

  const svgPath = `
    M 0 ${R}
    A ${R} ${R} 0 0 1 ${R} 0
    L ${W - R} 0
    A ${R} ${R} 0 0 1 ${W} ${R}
    L ${W} ${H - R}
    A ${R} ${R} 0 0 1 ${W - R} ${H}
    L ${cutW + cR} ${H}
    Q ${cutW} ${H} ${cutW} ${H - cR}
    L ${cutW} ${H - cutH + cR}
    Q ${cutW} ${H - cutH} ${cutW - cR} ${H - cutH}
    L ${cR} ${H - cutH}
    Q 0 ${H - cutH} 0 ${H - cutH - cR}
    Z
  `.trim().replace(/\s+/g, ' ');

  const cardGradStart = brandPurpleSurface ? '#faf5ff' : style.gradStart;
  const cardGradMid = brandPurpleSurface ? '#efe4ff' : style.gradMid;
  const cardGradEnd = brandPurpleSurface ? '#d8b4fe' : style.gradEnd;
  const cardBorderColor = brandPurpleSurface ? '#d4b5fc' : style.borderColor;
  const hasTopRightQuickAction = Boolean(quickActionIcon && onQuickAction && !isBatchEditMode);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      onClick={(e) => {
        const targetEl = e.target as HTMLElement | null;
        if (
          targetEl?.closest(
            '.tile-quick-action-btn, .tile-context-trigger, .tile-context-popup, .tile-longpress-overlay, .tile-fast-note-overlay, .tile-fast-note-btn, .tile-select-checkbox, input, textarea'
          )
        ) {
          return;
        }
        if (isLongPressTriggered.current) {
          isLongPressTriggered.current = false;
          return;
        }
        triggerCardActivate();
      }}
      className={`tile tile-card-typography relative z-10 cursor-pointer group select-none w-full h-full min-w-0 max-w-full min-h-[72px] sm:min-h-[76px] flex flex-col justify-between overflow-hidden rounded-[20px] font-['Vazirmatn',sans-serif] leading-[1.6] shadow-[0_4px_20px_-4px_rgba(109,40,217,0.14),0_2px_8px_-2px_rgba(139,92,246,0.10)] hover:shadow-[0_16px_34px_-8px_rgba(124,58,237,0.26),0_8px_18px_-6px_rgba(168,85,247,0.18)] transition-all duration-300 ease-out ${isPressing ? 'is-pressing tile-physical-active' : 'hover:-translate-y-[3px] hover:scale-[1.02]'} ${isDragHint ? 'is-drag-hint' : ''} ${className}`}
    >
      {/* Passive pointer-events wrapper around .tile */}
      <div 
        className="tile-touch-target absolute inset-0 rounded-[20px] pointer-events-none z-0" 
        aria-hidden="true" 
      />

      {/* High-Precision Q-Bank Vector Chassis with Modern Purple Gradient & Smooth Hover Cross-Fade */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0 transition-transform duration-300"
        viewBox={`0 0 ${W} ${H}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`grad_${uniqueId}`} x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={cardGradStart} />
            <stop offset="48%" stopColor={cardGradMid} />
            <stop offset="100%" stopColor={cardGradEnd} />
          </linearGradient>
          {brandPurpleSurface && (
            <linearGradient id={`grad_hover_${uniqueId}`} x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f5eeff" />
              <stop offset="46%" stopColor="#e9d5ff" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          )}
        </defs>
        <path
          d={svgPath}
          fill={`url(#grad_${uniqueId})`}
          stroke={cardBorderColor}
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
          className="transition-all duration-300"
        />
        {brandPurpleSurface && (
          <path
            d={svgPath}
            fill={`url(#grad_hover_${uniqueId})`}
            stroke="#c084fc"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"
          />
        )}
      </svg>

      {/* Top-Right Corner Quick-Action Icon Button (Tailwind corner placement, zero overlap with 3D logo) */}
      {hasTopRightQuickAction && (
        <div className="absolute top-2 right-2 z-25 pointer-events-auto">
          <FramerTooltip content={quickActionLabel || `عملیات سریع ${title}`} position="top">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                impactMedium();
                onQuickAction?.();
              }}
              aria-label={quickActionLabel || `عملیات سریع ${title}`}
              title={quickActionLabel || `عملیات سریع ${title}`}
              className="tile-quick-action-btn w-6 h-6 sm:w-7 sm:h-7 rounded-[9px] bg-white/90 backdrop-blur-xs hover:bg-gradient-to-br hover:from-purple-600 hover:via-violet-600 hover:to-fuchsia-600 text-purple-700 hover:text-white border border-purple-300/80 hover:border-purple-500 shadow-[0_2px_6px_rgba(124,58,237,0.16)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.34)] flex items-center justify-center transition-all duration-200 ease-out hover:scale-105 active:scale-95 active:translate-y-[1px] cursor-pointer"
            >
              {quickActionIcon}
            </button>
          </FramerTooltip>
        </div>
      )}

      {/* Contextual Floating Overlay on Long-Press */}
      {showLongPressOverlay && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-xs animate-in fade-in duration-150" 
            onClick={(e) => {
              e.stopPropagation();
              setShowLongPressOverlay(false);
            }} 
          />
          <div 
            className="tile-longpress-overlay absolute inset-x-1 -top-2 z-50 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-purple-400/90 p-2 space-y-1.5 text-right animate-in fade-in zoom-in-95 duration-150"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-100">
              <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                <span className="inline-flex rounded-full h-2 w-2 bg-purple-600 shrink-0" />
                عملیات فوری ({title})
              </span>
              <button
                type="button"
                onClick={() => setShowLongPressOverlay(false)}
                aria-label="بستن منوی فوری کاشی"
                className="min-w-[32px] min-h-[32px] rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1 pt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('heavy');
                  setShowLongPressOverlay(false);
                  if (onQuickCall) onQuickCall();
                  else onClick();
                }}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-slate-50/70 border border-slate-100 hover:border-emerald-200"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <Phone className="w-3.5 h-3.5 stroke-[2.4]" />
                  </div>
                  <span>تماس سریع</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-medium">شماره‌گیری</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('heavy');
                  setShowLongPressOverlay(false);
                  if (onViewLab) onViewLab();
                  else onClick();
                }}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-purple-50 text-slate-800 hover:text-purple-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-slate-50/70 border border-slate-100 hover:border-purple-200"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <FlaskConical className="w-3.5 h-3.5 stroke-[2.4]" />
                  </div>
                  <span>وضعیت لابراتوار</span>
                </div>
                <span className="text-[10px] text-purple-600 font-medium">کارتابل</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('heavy');
                  setShowLongPressOverlay(false);
                  if (onUpdateTreatment) onUpdateTreatment();
                  else onClick();
                }}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-cyan-50 text-slate-800 hover:text-cyan-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-slate-50/70 border border-slate-100 hover:border-cyan-200"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <Activity className="w-3.5 h-3.5 stroke-[2.4]" />
                  </div>
                  <span>ثبت درمان</span>
                </div>
                <span className="text-[10px] text-cyan-600 font-medium">چارت</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 
        Clean Q-Bank Card Interior:
        - Top row: Unobstructed 3D Icon on the right + single clean status pill on the left (NEVER overlapping the logo!)
        - Bottom row: Crisp Title + Subtitle on the right with generous left clearance (pl-11) for the bottom-left '<' cutout button
      */}
      <div 
        className="tile-contents tile-card-typography relative z-10 flex flex-1 flex-col justify-between gap-1.5 w-full min-w-0 max-w-full p-0.5 overflow-hidden rounded-[16px] min-h-[52px] font-['Vazirmatn',sans-serif] leading-[1.6]"
        dir="rtl"
      >
        {/* Living Water & Brand-Purple Ambient Glow Shimmer */}
        <div
          className={`absolute -top-5 -right-5 w-16 h-16 rounded-full blur-xl pointer-events-none transition-opacity duration-300 ${
            brandPurpleSurface ? 'opacity-45 group-hover:opacity-80 bg-radial from-purple-300/35 via-fuchsia-200/20 to-transparent' : `opacity-35 ${style.fluidGlow}`
          }`}
        />
        {brandPurpleSurface && (
          <div
            className="absolute -bottom-6 -left-4 w-20 h-20 rounded-full blur-2xl pointer-events-none opacity-30 group-hover:opacity-70 transition-opacity duration-300 bg-radial from-violet-400/30 via-purple-200/20 to-transparent"
            aria-hidden="true"
          />
        )}

        {/* Top Row: Unobstructed 3D Icon (Right, offset cleanly past top-right quick-action corner button) & Status Pill (Left) */}
        <div className={`flex items-center justify-between gap-1.5 w-full min-w-0 ${hasTopRightQuickAction ? 'pr-6 sm:pr-7' : ''}`}>
          {/* 3D Icon Box — Volumetric Sculpted 3D Logo, Unobstructed, Zero Overlapping Badges */}
          <div 
            className="tile-icon-box shrink-0 relative w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center group-hover:scale-110 group-hover:-translate-y-0.5 transition-all duration-200 [&_svg]:w-8 [&_svg]:h-8 sm:[&_svg]:w-10 sm:[&_svg]:h-10 [&_svg]:drop-shadow-[0_3px_5px_rgba(15,23,42,0.16)]"
          >
            {icon}
          </div>

          {/* Top-Left Status Badge & Extra Action (Clean, Non-Overlapping) */}
          <div className="flex items-center gap-1 min-w-0 max-w-[74%] justify-end">
            {isBatchEditMode ? (
              <div
                className="pointer-events-auto z-20 flex items-center min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={badgeValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBadgeValue(val);
                    onSaveBadge?.(val);
                  }}
                  placeholder="وضعیت..."
                  aria-label={`ویرایش نشان وضعیت ${title}`}
                  className="tile-batch-edit-badge-input w-20 bg-amber-50/95 text-slate-950 border border-amber-500 rounded-full px-2 py-0.5 text-[10px] font-black leading-[1.6] outline-none"
                />
              </div>
            ) : (badgeValue || badge) ? (
              <span 
                style={{
                  backgroundColor: badgeAlert ? '#f43f5e' : (badgeBgColor || style.badgeBg),
                  color: badgeContrast.textColor,
                  textShadow: badgeContrast.textShadowStyle
                }}
                className={`card-metadata tile-badge-meta tile-card-typography ${badgeContrast.textClass} ${badgeContrast.outlineClass} text-[9px] sm:text-[10.5px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full shadow-2xs leading-[1.6] flex items-center gap-1 min-w-0 max-w-full border ${
                  badgeAlert 
                    ? 'border-rose-600 shadow-xs shadow-rose-500/20' 
                    : `${style.badgeBorder}`
                }`}
              >
                {badgeAlert && <AlertTriangle className="w-2.5 h-2.5 shrink-0 stroke-[2.8]" style={{ color: badgeContrast.textColor }} />}
                <span className="leading-[1.6] font-bold truncate" style={{ color: badgeContrast.textColor, textShadow: badgeContrast.textShadowStyle }}>{badgeValue || badge}</span>
              </span>
            ) : null}

            {extraAction && (
              <div
                className="shrink-0 flex items-center pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  impactLight();
                }}
              >
                {extraAction}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Text Zone: Title + Subtitle with mobile clearance so it NEVER collides with bottom-left '<' cutout */}
        <div className="tile-title-group tile-card-typography flex flex-col text-right w-full min-w-0 max-w-full overflow-hidden pr-0.5 pl-[31px] sm:pl-10 mt-0.5 mb-0 font-['Vazirmatn',sans-serif] leading-[1.6]" dir="rtl">
          <div className="flex items-center gap-1 justify-start min-w-0">
            {(alertDot ?? badgeAlert) && (
              <span className="inline-flex rounded-full h-1.5 w-1.5 bg-rose-600 shrink-0" aria-label="هشدار" />
            )}
            <span className="tile-card-title tile-card-typography text-[12px] sm:text-[13.5px] font-extrabold text-slate-950 tracking-tight font-['Vazirmatn',sans-serif] leading-[1.6] group-hover:text-black truncate">
              {title}
            </span>
          </div>

          {(isEditingNote || isBatchEditMode) ? (
            <div 
              className="mt-0.5 w-full flex items-center gap-1 pointer-events-auto z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={noteValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setNoteValue(val);
                  if (isBatchEditMode) {
                    onSaveNote?.(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsEditingNote(false);
                    triggerHaptic('selection');
                    onSaveNote?.(noteValue);
                  } else if (e.key === 'Escape' && !isBatchEditMode) {
                    setIsEditingNote(false);
                    setNoteValue(subtitle || '');
                  }
                }}
                autoFocus={isEditingNote && !isBatchEditMode}
                placeholder="توضیحات زیرعنوان..."
                aria-label={`ویرایش متادیتای ${title}`}
                className="tile-quick-edit-input tile-batch-edit-metadata-input w-full bg-white/95 text-slate-900 border border-purple-400 focus:border-purple-600 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-[1.6] outline-none shadow-inner"
              />
            </div>
          ) : (
            (noteValue || subtitle) && (
              <span className={`card-metadata tile-metadata tile-card-text tile-card-typography text-[10px] sm:text-[10.5px] ${style.metaColor} font-bold font-['Vazirmatn',sans-serif] leading-[1.6] truncate`}>
                {noteValue || subtitle}
              </span>
            )
          )}
        </div>

        {children}
      </div>

      {/* 
        Q-Bank Authentic Squircle Action Button nestled in the bottom-left cutout pocket:
      */}
      <div className="absolute bottom-0.5 left-0.5 z-20">
        <FramerTooltip 
          content={actionTooltip || `ورود به بخش ${title}`} 
          position="top"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerCardActivate();
            }}
            className={`tile-action-button w-[29px] h-[20px] rounded-[8px] ${style.actionBtnClass} flex items-center justify-center transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] border ${
              isPressing
                ? 'translate-y-[1.5px] scale-[0.93] !shadow-inner brightness-95'
                : 'group-hover:brightness-105 active:translate-y-[1.5px] active:scale-[0.93] active:!shadow-inner'
            } cursor-pointer`}
            aria-label={actionTooltip || `ورود به بخش ${title}`}
          >
            <ChevronLeft className="w-3 h-3 stroke-[2.2]" />
          </button>
        </FramerTooltip>
      </div>
    </div>
  );
};
