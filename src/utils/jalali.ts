/**
 * Jalali Persian Date & Number Formatting Utilities
 * Fully dynamic system date integration via Intl.DateTimeFormat('fa-IR-u-ca-persian')
 * Zero hardcoding: Dynamically computes Persian year, month, day, weekday, and month lengths.
 */

const PERSIAN_DIGITS_ARR = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const DIGIT_CHAR_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

export function toPersianDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (w) => PERSIAN_DIGITS_ARR[+w]);
}

export function toEnglishDigits(str: string): string {
  return String(str).replace(/[۰-۹٠-٩]/g, (ch) => DIGIT_CHAR_MAP[ch] ?? ch);
}

export function formatToman(amount: number | string): string {
  const numeric = typeof amount === 'string'
    ? Number(toEnglishDigits(amount).replace(/,/g, ''))
    : Number(amount);
  const safe = isNaN(numeric) ? 0 : Math.round(numeric);
  return toPersianDigits(safe.toLocaleString('en-US')) + ' تومان';
}

export const PERSIAN_TREATMENT_MAP: Record<string, string> = {
  composite: 'ترمیم کامپوزیت',
  amalgam: 'ترمیم آمالگام',
  endo: 'عصب‌کشی (اندو)',
  crown_zirconia: 'روکش زیرکونیا',
  crown_pfm: 'روکش PFM',
  laminate: 'لمینت سرامیکی',
  implant: 'کاشت ایمپلنت',
  extraction: 'کشیدن دندان',
  scaling: 'جرم‌گیری دو فک',
  bleaching: 'بلیچینگ دندان',
  pulpotomy: 'پالپوتومی اطفال',
  pulpectomy: 'پالپکتومی ریشه',
  ss_crown: 'روکش استیل اطفال',
  fissure_sealant: 'فیشورسیلنت',
  fluoride: 'فلورایدتراپی',
  space_maintainer: 'فضا نگهدارنده'
};

export function getPersianTreatmentName(rawTreatment?: string | null): string {
  if (!rawTreatment) return 'درمان دندانپزشکی';
  const trimmed = rawTreatment.trim();
  if (PERSIAN_TREATMENT_MAP[trimmed]) {
    return PERSIAN_TREATMENT_MAP[trimmed];
  }
  let translated = trimmed;
  for (const [enKey, faLabel] of Object.entries(PERSIAN_TREATMENT_MAP)) {
    translated = translated.replace(new RegExp(`\\b${enKey}\\b`, 'gi'), faLabel);
  }
  return toPersianDigits(translated);
}

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
] as const;

export const PERSIAN_WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
] as const;

export interface PersianDateInfo {
  year: number;
  month: number; // 1-12
  monthIndex: number; // 0-11
  day: number; // 1-31
  dayName: string;
  monthName: string;
  formatted: string; // e.g. "۱۴۰۵/۰۷/۳۰"
  formattedEn: string; // e.g. "1405/07/30"
}

/**
 * Mathematical algorithm to convert Gregorian date to Jalali date
 * Used as high-reliability dynamic fallback when Intl returns non-standard formats
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

/**
 * Inverse algorithm: Convert Jalali (Iranian) date to Gregorian [year, month, day].
 * Exact 33-year / 2820-compatible civil arithmetic inverse matching gregorianToJalali across 1300-1500.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const gMonths = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > gMonths[gm]; gm++) {
    gd -= gMonths[gm];
  }
  return [gy, gm, gd];
}

export const PERSIAN_WEEKDAYS_SHORT = [
  'شنبه',
  '۱شنبه',
  '۲شنبه',
  '۳شنبه',
  '۴شنبه',
  '۵شنبه',
  'جمعه'
] as const;

/**
 * Resolve exact Persian weekday index (0 = شنبه ... 6 = جمعه)
 * Accepts either a Jalali date string ("۱۴۰۵/۰۸/۲۴") or numeric (year, month1Indexed, day).
 */
export function getPersianWeekdayIndex(
  yearOrDateStr: number | string,
  month?: number,
  day?: number
): number {
  let jy: number;
  let jm: number;
  let jd: number;
  if (typeof yearOrDateStr === 'string') {
    const parsed = parsePersianDate(yearOrDateStr);
    jy = parsed.year;
    jm = parsed.month;
    jd = parsed.day;
  } else {
    jy = yearOrDateStr;
    jm = month ?? 1;
    jd = day ?? 1;
  }
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const gDate = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
  return (gDate.getUTCDay() + 1) % 7;
}

export function getPersianWeekdayName(
  yearOrDateStr: number | string,
  month?: number,
  day?: number
): string {
  return PERSIAN_WEEKDAYS[getPersianWeekdayIndex(yearOrDateStr, month, day)];
}

export function getPersianWeekdayShortName(
  yearOrDateStr: number | string,
  month?: number,
  day?: number
): string {
  return PERSIAN_WEEKDAYS_SHORT[getPersianWeekdayIndex(yearOrDateStr, month, day)];
}

/**
 * Weekday index (0 = شنبه ... 6 = جمعه) of day 1 of a Jalali month (month1Indexed: 1..12).
 */
export function getPersianMonthStartWeekdayIndex(year: number, month1Indexed: number): number {
  return getPersianWeekdayIndex(year, month1Indexed, 1);
}

/**
 * Checks if a Persian year is a leap year (30 days in Esfand)
 */
export function isPersianLeapYear(year: number): boolean {
  // Traditional 33-year leap cycle algorithm
  const rem = year % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(rem);
}

/**
 * Return number of days in a given Persian month (1-indexed: 1 = Farvardin, 12 = Esfand)
 * Defaults dynamically to current Persian year.
 */
export function getDaysInPersianMonth(monthOrYear: number, yearOrMonth?: number): number {
  const isFirstYear = monthOrYear > 100;
  const month = isFirstYear ? (yearOrMonth ?? 1) : monthOrYear;
  const targetYear = isFirstYear ? monthOrYear : (yearOrMonth || getPersianDateParts().year);
  if (month >= 1 && month <= 6) {
    return 31;
  }
  if (month >= 7 && month <= 11) {
    return 30;
  }
  if (month === 12) {
    return isPersianLeapYear(targetYear) ? 30 : 29;
  }
  return 30;
}

let PERSIAN_DATE_FORMATTER: Intl.DateTimeFormat | null | undefined;
function getPersianFormatter(): Intl.DateTimeFormat | null {
  if (PERSIAN_DATE_FORMATTER !== undefined) return PERSIAN_DATE_FORMATTER;
  try {
    PERSIAN_DATE_FORMATTER = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'long'
    });
  } catch {
    PERSIAN_DATE_FORMATTER = null;
  }
  return PERSIAN_DATE_FORMATTER;
}

/**
 * Extract Persian date parts dynamically using native Intl.DateTimeFormat('fa-IR-u-ca-persian')
 */
export function getPersianDateParts(date: Date = new Date()): PersianDateInfo {
  try {
    const formatter = getPersianFormatter();
    if (!formatter) throw new Error('Intl unavailable');

    const parts = formatter.formatToParts(date);
    let yearStr = '';
    let monthStr = '';
    let dayStr = '';
    let weekdayStr = '';

    for (const part of parts) {
      if (part.type === 'year') {
        yearStr = toEnglishDigits(part.value).replace(/[^\d]/g, '');
      } else if (part.type === 'month') {
        monthStr = toEnglishDigits(part.value).replace(/[^\d]/g, '');
      } else if (part.type === 'day') {
        dayStr = toEnglishDigits(part.value).replace(/[^\d]/g, '');
      } else if (part.type === 'weekday') {
        weekdayStr = part.value.trim();
      }
    }

    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    let day = parseInt(dayStr, 10);

    // Guard for Android 9 / Galaxy Note 8 older WebViews where Intl ignores `-u-ca-persian` and returns Gregorian 202x
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      year < 1300 ||
      year > 1500 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
      year = jy;
      month = jm;
      day = jd;
    }

    const monthIndex = Math.max(0, Math.min(11, month - 1));
    const monthName = PERSIAN_MONTHS[monthIndex];

    const mmEn = String(month).padStart(2, '0');
    const ddEn = String(day).padStart(2, '0');
    const formattedEn = `${year}/${mmEn}/${ddEn}`;
    const formatted = toPersianDigits(formattedEn);

    return {
      year,
      month,
      monthIndex,
      day,
      dayName: weekdayStr || PERSIAN_WEEKDAYS[(date.getDay() + 1) % 7],
      monthName,
      formatted,
      formattedEn
    };
  } catch {
    // Dynamic mathematical fallback
    const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const monthIndex = Math.max(0, Math.min(11, jm - 1));
    const mmEn = String(jm).padStart(2, '0');
    const ddEn = String(jd).padStart(2, '0');
    const formattedEn = `${jy}/${mmEn}/${ddEn}`;
    return {
      year: jy,
      month: jm,
      monthIndex,
      day: jd,
      dayName: PERSIAN_WEEKDAYS[(date.getDay() + 1) % 7],
      monthName: PERSIAN_MONTHS[monthIndex],
      formatted: toPersianDigits(formattedEn),
      formattedEn
    };
  }
}

/**
 * Get formatted current Persian date string in Persian digits (e.g. "۱۴۰۵/۰۷/۳۰")
 */
export function getCurrentPersianDate(date?: Date): string {
  return getPersianDateParts(date || new Date()).formatted;
}

/**
 * Get formatted English digits Persian date string (e.g. "1405/07/30")
 */
export function getCurrentPersianDateEn(date?: Date): string {
  return getPersianDateParts(date || new Date()).formattedEn;
}

/**
 * Get current Persian day of week name (e.g. "پنج‌شنبه")
 */
export function getCurrentPersianDayName(date?: Date): string {
  return getPersianDateParts(date || new Date()).dayName;
}

/**
 * Get current Persian month name (e.g. "مهر" or "آبان")
 */
export function getCurrentPersianMonthName(date?: Date): string {
  return getPersianDateParts(date || new Date()).monthName;
}

/**
 * Get current Persian year as number
 */
export function getCurrentPersianYear(date?: Date): number {
  return getPersianDateParts(date || new Date()).year;
}

/**
 * Format any year, month, day into Persian date string "YYYY/MM/DD" with Persian digits
 */
export function formatPersianDateString(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return toPersianDigits(`${year}/${mm}/${dd}`);
}

/**
 * Format any year, month, day into English-digit Persian date string "YYYY/MM/DD"
 */
export function formatPersianDateStringEn(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}/${mm}/${dd}`;
}

/**
 * Format Persian date into full textual representation (e.g. "پنج‌شنبه، ۳۰ مهر ۱۴۰۵")
 */
export function formatPersianDateFull(date: Date = new Date()): string {
  const p = getPersianDateParts(date);
  return `${p.dayName}، ${toPersianDigits(p.day)} ${p.monthName} ${toPersianDigits(p.year)}`;
}

/**
 * Parse a Persian date string "YYYY/MM/DD" or "YYYY-MM-DD" into numeric parts
 */
export function parsePersianDate(dateStr: string): { year: number; month: number; day: number } {
  const en = toEnglishDigits(dateStr || '').trim();
  const parts = en.split(/[/-]/).map(p => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { year: parts[0], month: parts[1], day: parts[2] };
  }
  const cur = getPersianDateParts();
  return { year: cur.year, month: cur.month, day: cur.day };
}

/**
 * Get dynamic Persian date relative to today or given base date
 * e.g. offsetDays = 0 (today), 1 (tomorrow), -5 (5 days ago), 30 (next month), 90 (implant healing)
 */
export function getRelativePersianDate(offsetDays: number, baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getTime() + offsetDays * 86400000);
  return getCurrentPersianDate(target);
}

/**
 * Add days to an existing Persian date string
 */
export function addDaysToPersianDate(persianDate: string, days: number): string {
  const parsed = parsePersianDate(persianDate);
  let { year, month, day } = parsed;
  day += days;
  while (day > getDaysInPersianMonth(month, year)) {
    day -= getDaysInPersianMonth(month, year);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  while (day < 1) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    day += getDaysInPersianMonth(month, year);
  }
  return formatPersianDateString(year, month, day);
}

/**
 * Add months to an existing Persian date string
 */
export function addMonthsToPersianDate(persianDate: string, months: number): string {
  const parsed = parsePersianDate(persianDate);
  let year = parsed.year;
  let month = parsed.month + months;
  while (month > 12) {
    month -= 12;
    year++;
  }
  while (month < 1) {
    month += 12;
    year--;
  }
  const maxDays = getDaysInPersianMonth(month, year);
  const day = Math.min(parsed.day, maxDays);
  return formatPersianDateString(year, month, day);
}

/**
 * Checks if two Persian dates represent the exact same day,
 * independent of whether they use Persian or English digits, or leading zeroes.
 */
export function isSamePersianDate(d1?: string | null, d2?: string | null): boolean {
  if (!d1 || !d2) return false;
  const c1 = toEnglishDigits(d1).trim().replace(/[^\d/]/g, '');
  const c2 = toEnglishDigits(d2).trim().replace(/[^\d/]/g, '');
  if (c1 === c2) return true;
  const p1 = c1.split('/');
  const p2 = c2.split('/');
  if (p1.length >= 3 && p2.length >= 3) {
    return (
      parseInt(p1[0], 10) === parseInt(p2[0], 10) &&
      parseInt(p1[1], 10) === parseInt(p2[1], 10) &&
      parseInt(p1[2], 10) === parseInt(p2[2], 10)
    );
  }
  return false;
}

/**
 * Checks if a given Persian date matches today's date
 */
export function isPersianDateToday(dateStr?: string | null): boolean {
  return isSamePersianDate(dateStr, getCurrentPersianDate());
}

/**
 * Converts a Jalali date string to an exact monotonic day number (since 1300/01/01)
 * using calendar month lengths and leap-year rules so date arithmetic across years is exact.
 */
export function persianDateToDayNumber(dateStr: string): number {
  const { year, month, day } = parsePersianDate(dateStr);
  const clampedMonth = Math.max(1, Math.min(12, month));
  const clampedDay = Math.max(1, Math.min(getDaysInPersianMonth(clampedMonth, year), day));
  let totalDays = 0;
  if (year >= 1300) {
    for (let y = 1300; y < year; y++) {
      totalDays += isPersianLeapYear(y) ? 366 : 365;
    }
  } else {
    for (let y = year; y < 1300; y++) {
      totalDays -= isPersianLeapYear(y) ? 366 : 365;
    }
  }
  for (let m = 1; m < clampedMonth; m++) {
    totalDays += getDaysInPersianMonth(m, year);
  }
  return totalDays + (clampedDay - 1);
}

/**
 * Compares two Jalali dates: returns -1 if d1 < d2, 0 if same day, 1 if d1 > d2.
 */
export function comparePersianDates(d1: string, d2: string): -1 | 0 | 1 {
  const n1 = persianDateToDayNumber(d1);
  const n2 = persianDateToDayNumber(d2);
  if (n1 < n2) return -1;
  if (n1 > n2) return 1;
  return 0;
}

/**
 * Returns (toDate - fromDate) in exact Jalali days.
 * Positive means toDate is in the future relative to fromDate; negative means overdue/past.
 */
export function diffPersianDays(fromDate: string, toDate: string): number {
  return persianDateToDayNumber(toDate) - persianDateToDayNumber(fromDate);
}

/**
 * Parses "HH:mm" (Persian or English digits) into total minutes since midnight.
 */
export function parseTimeMinutes(timeStr?: string | null): number {
  if (!timeStr) return 9 * 60;
  const cleaned = toEnglishDigits(String(timeStr)).trim();
  const match = cleaned.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (match) {
    const h = Math.max(0, Math.min(23, parseInt(match[1], 10)));
    const m = Math.max(0, Math.min(59, parseInt(match[2], 10)));
    return h * 60 + m;
  }
  const numOnly = parseInt(cleaned.replace(/[^\d]/g, ''), 10);
  if (!isNaN(numOnly) && numOnly >= 0 && numOnly <= 23) {
    return numOnly * 60;
  }
  return 9 * 60;
}

/**
 * Checks whether a Jalali date (+ optional time string) is strictly in the past relative to now.
 */
export function isPastPersianDateTime(dateStr?: string | null, timeStr?: string | null): boolean {
  if (!dateStr) return false;
  const today = getCurrentPersianDate();
  const cmp = comparePersianDates(dateStr, today);
  if (cmp < 0) return true;
  if (cmp > 0) return false;
  if (!timeStr) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return parseTimeMinutes(timeStr) < nowMinutes;
}

export const GREGORIAN_MONTHS_FA = [
  'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'
] as const;

export const GREGORIAN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

export const ISLAMIC_MONTHS_FA = [
  'محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی',
  'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذیقعده', 'ذیحجه'
] as const;

export interface GregorianDateInfo {
  year: number;
  month: number; // 1-12
  day: number;
  monthNameFa: string;
  monthShortEn: string;
  formattedEn: string; // e.g. "2026/11/16"
  formattedIso: string; // e.g. "2026-11-16"
  formattedFa: string; // e.g. "۲۵ آبان -> ۱۶ نوامبر ۲۰۲۶"
}

export interface IslamicHijriDateInfo {
  year: number;
  month: number; // 1-12
  day: number;
  monthNameFa: string;
  keyMmDd: string; // e.g. "01/10"
  formatted: string; // e.g. "۵ جمادی‌الثانی ۱۴۴۸"
  formattedNumeric: string; // e.g. "۱۴۴۸/۰۶/۰۵"
}

/**
 * Convert a Jalali date string to full Gregorian date metadata.
 */
export function getGregorianDateInfo(jalaliDateStr: string): GregorianDateInfo {
  const parsed = parsePersianDate(jalaliDateStr);
  const [gy, gm, gd] = jalaliToGregorian(parsed.year, parsed.month, parsed.day);
  const mm = String(gm).padStart(2, '0');
  const dd = String(gd).padStart(2, '0');
  const monthNameFa = GREGORIAN_MONTHS_FA[Math.max(0, Math.min(11, gm - 1))];
  const monthShortEn = GREGORIAN_MONTHS_SHORT[Math.max(0, Math.min(11, gm - 1))];
  return {
    year: gy,
    month: gm,
    day: gd,
    monthNameFa,
    monthShortEn,
    formattedEn: `${gy}/${mm}/${dd}`,
    formattedIso: `${gy}-${mm}-${dd}`,
    formattedFa: `${toPersianDigits(gd)} ${monthNameFa} ${toPersianDigits(gy)}`
  };
}

/**
 * Tabular (Kuwaiti) algorithmic conversion from Gregorian to Islamic Hijri [year, month, day].
 * Acts as a reliable offline / legacy Android WebView fallback when Intl islamic-umalqura is missing.
 */
export function gregorianToIslamicCivil(gy: number, gm: number, gd: number): [number, number, number] {
  const a = Math.floor((14 - gm) / 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  const jdn =
    gd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  let l = jdn - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const im = Math.floor((24 * l) / 709);
  const id = l - Math.floor((709 * im) / 24);
  const iy = 30 * n + j - 30;
  return [iy, im, id];
}

let ISLAMIC_DATE_FORMATTER: Intl.DateTimeFormat | null | undefined;
function getIslamicFormatter(): Intl.DateTimeFormat | null {
  if (ISLAMIC_DATE_FORMATTER !== undefined) return ISLAMIC_DATE_FORMATTER;
  try {
    ISLAMIC_DATE_FORMATTER = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC'
    });
  } catch {
    ISLAMIC_DATE_FORMATTER = null;
  }
  return ISLAMIC_DATE_FORMATTER;
}

/**
 * Convert a Jalali date string to Lunar Islamic Hijri (قمری) metadata.
 */
export function getIslamicHijriDateInfo(jalaliDateStr: string): IslamicHijriDateInfo {
  const parsed = parsePersianDate(jalaliDateStr);
  const [gy, gm, gd] = jalaliToGregorian(parsed.year, parsed.month, parsed.day);
  let iy = 0;
  let im = 0;
  let id = 0;

  try {
    const formatter = getIslamicFormatter();
    if (formatter) {
      const utcNoon = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
      const parts = formatter.formatToParts(utcNoon);
      const yPart = parts.find(p => p.type === 'year')?.value || '';
      const mPart = parts.find(p => p.type === 'month')?.value || '';
      const dPart = parts.find(p => p.type === 'day')?.value || '';
      const candY = parseInt(toEnglishDigits(yPart).replace(/[^\d]/g, ''), 10);
      const candM = parseInt(toEnglishDigits(mPart).replace(/[^\d]/g, ''), 10);
      const candD = parseInt(toEnglishDigits(dPart).replace(/[^\d]/g, ''), 10);
      if (candY >= 1350 && candY <= 1550 && candM >= 1 && candM <= 12 && candD >= 1 && candD <= 30) {
        iy = candY;
        im = candM;
        id = candD;
      }
    }
  } catch {
    // Fallback below
  }

  if (iy < 1350 || im < 1 || im > 12 || id < 1) {
    const [cy, cm, cd] = gregorianToIslamicCivil(gy, gm, gd);
    iy = cy;
    im = Math.max(1, Math.min(12, cm));
    id = Math.max(1, Math.min(30, cd));
  }

  const mm = String(im).padStart(2, '0');
  const dd = String(id).padStart(2, '0');
  const monthNameFa = ISLAMIC_MONTHS_FA[Math.max(0, Math.min(11, im - 1))];
  return {
    year: iy,
    month: im,
    day: id,
    monthNameFa,
    keyMmDd: `${mm}/${dd}`,
    formatted: `${toPersianDigits(id)} ${monthNameFa} ${toPersianDigits(iy)}`,
    formattedNumeric: toPersianDigits(`${iy}/${mm}/${dd}`)
  };
}

/**
 * Get Iranian season & quarter metadata for a Jalali month (1..12).
 */
export function getPersianSeasonInfo(month1Indexed: number): {
  name: 'بهار' | 'تابستان' | 'پاییز' | 'زمستان';
  quarterLabel: string;
} {
  if (month1Indexed >= 1 && month1Indexed <= 3) {
    return { name: 'بهار', quarterLabel: 'فصل اول' };
  }
  if (month1Indexed >= 4 && month1Indexed <= 6) {
    return { name: 'تابستان', quarterLabel: 'فصل دوم' };
  }
  if (month1Indexed >= 7 && month1Indexed <= 9) {
    return { name: 'پاییز', quarterLabel: 'فصل سوم' };
  }
  return { name: 'زمستان', quarterLabel: 'فصل چهارم' };
}

/**
 * Exact remaining days until next Nowruz (01/01 of next Persian year).
 */
export function getDaysUntilNowruz(jalaliDateStr: string): number {
  const parsed = parsePersianDate(jalaliDateStr);
  if (parsed.month === 1 && parsed.day === 1) return 0;
  const nextNowruz = formatPersianDateString(parsed.year + 1, 1, 1);
  return Math.max(0, diffPersianDays(jalaliDateStr, nextNowruz));
}

/**
 * Returns the 7 Jalali date strings [شنبه ... جمعه] of the Iranian week containing jalaliDateStr.
 */
export function getWeekDatesStartingSaturday(jalaliDateStr: string): string[] {
  const weekdayIdx = getPersianWeekdayIndex(jalaliDateStr);
  const saturdayDate = addDaysToPersianDate(jalaliDateStr, -weekdayIdx);
  return Array.from({ length: 7 }, (_, i) => addDaysToPersianDate(saturdayDate, i));
}

export interface ConvertedTriCalendarInfo {
  jalali: string;
  jalaliEn: string;
  weekdayName: string;
  gregorian: GregorianDateInfo;
  hijri: IslamicHijriDateInfo;
}

/**
 * Convert a Gregorian date string ("YYYY-MM-DD" or "YYYY/MM/DD") to complete Tri-Calendar info.
 */
export function convertGregorianInputToCalendarInfo(gregorianStr: string): ConvertedTriCalendarInfo | null {
  const clean = toEnglishDigits(gregorianStr || '').trim();
  const m = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const gy = parseInt(m[1], 10);
  const gm = parseInt(m[2], 10);
  const gd = parseInt(m[3], 10);
  if (gy < 1900 || gy > 2150 || gm < 1 || gm > 12 || gd < 1 || gd > 31) return null;
  const check = new Date(Date.UTC(gy, gm - 1, gd));
  if (check.getUTCFullYear() !== gy || check.getUTCMonth() + 1 !== gm || check.getUTCDate() !== gd) {
    return null;
  }
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  const jalali = formatPersianDateString(jy, jm, jd);
  const jalaliEn = formatPersianDateStringEn(jy, jm, jd);
  return {
    jalali,
    jalaliEn,
    weekdayName: getPersianWeekdayName(jy, jm, jd),
    gregorian: getGregorianDateInfo(jalali),
    hijri: getIslamicHijriDateInfo(jalali)
  };
}

/**
 * Calculate target Jalali date after adding days or months (for post-op sutures, implant healing, 6m recall).
 */
export function computeClinicalTargetDate(
  baseJalaliDate: string,
  amount: number,
  unit: 'days' | 'months'
): ConvertedTriCalendarInfo {
  const targetJalali =
    unit === 'days'
      ? addDaysToPersianDate(baseJalaliDate, amount)
      : addMonthsToPersianDate(baseJalaliDate, amount);
  const parsed = parsePersianDate(targetJalali);
  return {
    jalali: targetJalali,
    jalaliEn: formatPersianDateStringEn(parsed.year, parsed.month, parsed.day),
    weekdayName: getPersianWeekdayName(parsed.year, parsed.month, parsed.day),
    gregorian: getGregorianDateInfo(targetJalali),
    hijri: getIslamicHijriDateInfo(targetJalali)
  };
}



