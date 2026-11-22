/**
 * Global Unified Design System for Module Headers & Multi-Color Non-Repeating Chip Bars
 * Single-elevation surfaces, hairline precision, >=40px tap targets, tabular numerals.
 */

export type ModuleThemeKey =
  | 'emerald'
  | 'sky'
  | 'cyan'
  | 'purple'
  | 'amber'
  | 'teal'
  | 'rose'
  | 'pink'
  | 'indigo'
  | 'blue';

interface ChipPalette {
  active: string;
  inactive: string;
  badgeActive: string;
  badgeInactive: string;
}

const CHIP_PALETTES: ChipPalette[] = [
  // 0: Emerald
  {
    active: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-700 shadow-xs',
    inactive: 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 border border-emerald-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-emerald-200/80 text-emerald-950'
  },
  // 1: Cyan / Sky
  {
    active: 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white border border-cyan-700 shadow-xs',
    inactive: 'bg-cyan-50/90 hover:bg-cyan-100 text-cyan-950 border border-cyan-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-cyan-200/80 text-cyan-950'
  },
  // 2: Purple / Violet
  {
    active: 'bg-gradient-to-r from-purple-600 to-violet-600 text-white border border-purple-700 shadow-xs',
    inactive: 'bg-purple-50/90 hover:bg-purple-100 text-purple-950 border border-purple-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-purple-200/80 text-purple-950'
  },
  // 3: Amber / Gold
  {
    active: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border border-amber-700 shadow-xs',
    inactive: 'bg-amber-50/90 hover:bg-amber-100 text-amber-950 border border-amber-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-amber-200/80 text-amber-950'
  },
  // 4: Rose / Pink
  {
    active: 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border border-rose-700 shadow-xs',
    inactive: 'bg-rose-50/90 hover:bg-rose-100 text-rose-950 border border-rose-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-rose-200/80 text-rose-950'
  },
  // 5: Indigo / Blue
  {
    active: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-700 shadow-xs',
    inactive: 'bg-indigo-50/90 hover:bg-indigo-100 text-indigo-950 border border-indigo-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-indigo-200/80 text-indigo-950'
  },
  // 6: Teal
  {
    active: 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border border-teal-700 shadow-xs',
    inactive: 'bg-teal-50/90 hover:bg-teal-100 text-teal-950 border border-teal-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-teal-200/80 text-teal-950'
  },
  // 7: Fuchsia / Magenta
  {
    active: 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border border-fuchsia-700 shadow-xs',
    inactive: 'bg-fuchsia-50/90 hover:bg-fuchsia-100 text-fuchsia-950 border border-fuchsia-200',
    badgeActive: 'bg-white/25 text-white',
    badgeInactive: 'bg-fuchsia-200/80 text-fuchsia-950'
  }
];

/**
 * Returns unified non-repeating colorful classes for a chip at `index`
 * Minimum 38-40px touch height, zero clipping scale jumps, tabular figures.
 */
export function getUnifiedChipClasses(index: number, isActive: boolean): string {
  const palette = CHIP_PALETTES[index % CHIP_PALETTES.length];
  const base =
    'module-chip-item min-h-[38px] px-3 py-1.5 rounded-[12px] text-[11.5px] sm:text-[12px] font-bold leading-[1.6] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors duration-150 cursor-pointer active:scale-[0.97] select-none tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
  return `${base} ${isActive ? palette.active : palette.inactive}`;
}

export function getUnifiedChipBadgeClasses(index: number, isActive: boolean): string {
  const palette = CHIP_PALETTES[index % CHIP_PALETTES.length];
  return `text-[10.5px] px-1.5 py-0.5 rounded-full font-mono font-bold tabular-nums leading-none ${
    isActive ? palette.badgeActive : palette.badgeInactive
  }`;
}

/**
 * Single-elevation Module Command Header with crisp hairline border (no thick 5px retro bottom border).
 */
export function getModuleHeaderCardClasses(theme: ModuleThemeKey): string {
  const base =
    'w-full max-w-full min-w-0 overflow-hidden rounded-[20px] p-2.5 sm:p-3.5 space-y-1.5 backdrop-blur-xl shadow-[var(--shadow-card)] border mb-1.5 transition-colors [&>div:first-child]:flex-wrap [&>div:first-child]:gap-1.5 [&>div:first-child]:min-w-0 [&_h2]:text-sm sm:[&_h2]:text-base [&_h2]:font-black [&_h3]:text-sm sm:[&_h3]:text-base [&_h3]:font-black';
  switch (theme) {
    case 'emerald':
      return `${base} bg-gradient-to-b from-emerald-50/95 via-white/95 to-white border-emerald-200/90`;
    case 'sky':
      return `${base} bg-gradient-to-b from-sky-50/95 via-white/95 to-white border-sky-200/90`;
    case 'cyan':
      return `${base} bg-gradient-to-b from-cyan-50/95 via-white/95 to-white border-cyan-200/90`;
    case 'purple':
      return `${base} bg-gradient-to-b from-purple-50/95 via-white/95 to-white border-purple-200/90`;
    case 'amber':
      return `${base} bg-gradient-to-b from-amber-50/95 via-white/95 to-white border-amber-200/90`;
    case 'teal':
      return `${base} bg-gradient-to-b from-teal-50/95 via-white/95 to-white border-teal-200/90`;
    case 'rose':
      return `${base} bg-gradient-to-b from-rose-50/95 via-white/95 to-white border-rose-200/90`;
    case 'pink':
      return `${base} bg-gradient-to-b from-pink-50/95 via-white/95 to-white border-pink-200/90`;
    case 'indigo':
      return `${base} bg-gradient-to-b from-indigo-50/95 via-white/95 to-white border-indigo-200/90`;
    case 'blue':
    default:
      return `${base} bg-gradient-to-b from-blue-50/95 via-white/95 to-white border-blue-200/90`;
  }
}
