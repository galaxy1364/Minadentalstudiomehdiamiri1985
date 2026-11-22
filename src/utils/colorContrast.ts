/**
 * WCAG 2.1 Color Luminance and Contrast Ratio Engine
 * Calculates relative luminance, optimal text contrast, and automatic
 * anti-washout drop-shadow / text-outlines for clinical UI status badges.
 */

export function parseColorToRgb(color: string): [number, number, number] {
  if (!color) return [240, 249, 255];
  const c = color.trim().toLowerCase();
  
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    } else if (hex.length >= 6) {
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16)
      ];
    }
  }

  const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }

  return [240, 249, 255];
}

export function calculateLuminance(r: number, g: number, b: number): number {
  const [sR, sG, sB] = [r, g, b].map(val => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
}

export function calculateContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastResult {
  isDarkBackground: boolean;
  textColor: string;
  textClass: 'badge-text-white' | 'badge-text-black';
  contrastRatio: number;
  luminance: number;
  isLightBadge: boolean;
  textShadowStyle?: string;
  outlineClass: string;
}

export function computeBadgeContrast(bgColor: string): ContrastResult {
  const [r, g, b] = parseColorToRgb(bgColor);
  const lum = calculateLuminance(r, g, b);
  
  const contrastWhite = calculateContrastRatio(lum, 1.0);
  const contrastBlack = calculateContrastRatio(lum, 0.0);

  // If contrast with white is significantly higher or meets AA for dark backgrounds, use white; otherwise black
  if (contrastWhite > contrastBlack && contrastWhite >= 3.0) {
    return {
      isDarkBackground: true,
      textColor: '#ffffff',
      textClass: 'badge-text-white',
      contrastRatio: contrastWhite,
      luminance: lum,
      isLightBadge: false,
      outlineClass: 'badge-dark-clean'
    };
  } else {
    // If badge color is too light (luminance > 0.58), automatically add subtle drop-shadow & text-outline
    const isLightBadge = lum > 0.58;
    return {
      isDarkBackground: false,
      textColor: '#0f172a',
      textClass: 'badge-text-black',
      contrastRatio: contrastBlack,
      luminance: lum,
      isLightBadge,
      textShadowStyle: isLightBadge 
        ? '0 0.5px 1px rgba(0, 0, 0, 0.22), 0 0 0.5px rgba(15, 23, 42, 0.35)' 
        : undefined,
      outlineClass: isLightBadge ? 'badge-light-outline' : ''
    };
  }
}
