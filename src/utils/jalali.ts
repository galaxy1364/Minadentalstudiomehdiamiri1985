/**
 * Jalali Persian Date & Number Formatting Utilities
 */

export function toPersianDigits(n: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (w) => persianDigits[+w]);
}

export function formatToman(amount: number): string {
  return toPersianDigits(amount.toLocaleString('fa-IR')) + ' تومان';
}

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

export const PERSIAN_WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

// Helper to get formatted current Persian date string
export function getCurrentPersianDate(): string {
  return '۱۴۰۳/۰۸/۱۵';
}

export function getCurrentPersianDayName(): string {
  return 'سه‌شنبه';
}
