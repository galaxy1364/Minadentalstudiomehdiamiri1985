import {
  Appointment,
  ClinicScheduleSettings,
  ClinicUnitDefinition,
  Patient,
  WaitlistEntry
} from '../types/dental';
import {
  addDaysToPersianDate,
  addMonthsToPersianDate,
  formatPersianDateString,
  formatToman,
  getDaysInPersianMonth,
  getGregorianDateInfo,
  getIslamicHijriDateInfo,
  getPersianWeekdayIndex,
  getPersianWeekdayName,
  GregorianDateInfo,
  IslamicHijriDateInfo,
  isSamePersianDate,
  parsePersianDate,
  parseTimeMinutes,
  toEnglishDigits,
  toPersianDigits
} from './jalali';
import { ALL_CLINIC_TIME_SLOTS } from '../components/WheelTimePicker';

export const DEFAULT_CLINIC_UNITS: ClinicUnitDefinition[] = [
  {
    id: 'یونیت آبی',
    name: 'یونیت آبی',
    doctor: 'دکتر مهدی امیری (پزشک معالج)',
    accent: '#0284c7',
    colorTone: 'blue',
    borderActive: 'border-sky-500 bg-sky-50/90 text-sky-900',
    dropActive: 'border-sky-400 bg-sky-100/90 shadow-md ring-2 ring-sky-300'
  },
  {
    id: 'یونیت زرد',
    name: 'یونیت زرد',
    doctor: 'دکتر مریم رضایی (اندودنتیست)',
    accent: '#eab308',
    colorTone: 'yellow',
    borderActive: 'border-amber-400 bg-amber-50/90 text-amber-950',
    dropActive: 'border-amber-400 bg-amber-100/90 shadow-md ring-2 ring-amber-300'
  },
  {
    id: 'یونیت جراحی',
    name: 'یونیت جراحی',
    doctor: 'تیم جراحی فک و ایمپلنت',
    accent: '#7c3aed',
    colorTone: 'purple',
    borderActive: 'border-purple-500 bg-purple-50/90 text-purple-900',
    dropActive: 'border-purple-400 bg-purple-100/90 shadow-md ring-2 ring-purple-300'
  }
];

const CUSTOM_UNITS_STORAGE_KEY = 'minadental_clinic_units_v1';
const SCHEDULE_SETTINGS_STORAGE_KEY = 'minadental_schedule_settings_v1';
const WAITLIST_STORAGE_KEY = 'minadental_appointment_waitlist_v1';

export const DEFAULT_CLINIC_SCHEDULE_SETTINGS: ClinicScheduleSettings = {
  openTime: '۰۸:۳۰',
  closeTime: '۲۲:۰۰',
  breakEnabled: true,
  breakStart: '۱۳:۳۰',
  breakEnd: '۱۵:۰۰',
  blockOfficialHolidays: true,
  doctorOffWeekdays: {
    'دکتر مهدی امیری': [6],
    'دکتر مریم رضایی': [5, 6]
  },
  customHolidays: [],
  customHolidayDates: []
};

export const DEFAULT_SCHEDULE_SETTINGS = DEFAULT_CLINIC_SCHEDULE_SETTINGS;

export function normalizeClinicUnitName(rawUnit?: string | null): string {
  const clean = (rawUnit || '').trim();
  if (!clean) return 'یونیت آبی';
  if (
    clean === 'یونیت آبی' ||
    clean === 'یونیت ۱' ||
    clean === 'یونیت 1' ||
    clean.includes('یونیت ۱') ||
    clean.includes('آبی')
  ) {
    return 'یونیت آبی';
  }
  if (
    clean === 'یونیت زرد' ||
    clean === 'یونیت ۲' ||
    clean === 'یونیت 2' ||
    clean.includes('یونیت ۲') ||
    clean.includes('زرد')
  ) {
    return 'یونیت زرد';
  }
  if (
    clean === 'یونیت جراحی' ||
    clean === 'اتاق جراحی' ||
    clean === 'یونیت ۳' ||
    clean === 'یونیت ۳ (جراحی)' ||
    clean.includes('جراحی')
  ) {
    return 'یونیت جراحی';
  }
  return clean;
}

export function getClinicUnitsCatalog(): ClinicUnitDefinition[] {
  if (typeof window === 'undefined') return DEFAULT_CLINIC_UNITS;
  try {
    const raw = window.localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
    if (!raw) return DEFAULT_CLINIC_UNITS;
    const parsed = JSON.parse(raw) as ClinicUnitDefinition[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_CLINIC_UNITS;
}

export function saveClinicUnitsCatalog(units: ClinicUnitDefinition[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(units));
  } catch {
    // Ignore storage error
  }
}

export function getClinicScheduleSettings(): ClinicScheduleSettings {
  if (typeof window === 'undefined') return DEFAULT_CLINIC_SCHEDULE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SCHEDULE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CLINIC_SCHEDULE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ClinicScheduleSettings>;
    const legacyDates = Array.isArray(parsed.customHolidayDates)
      ? parsed.customHolidayDates.map(d => ({ date: d, reason: 'تعطیلی ثبت‌شده مطب' }))
      : [];
    const customHolidays = Array.isArray(parsed.customHolidays) ? parsed.customHolidays : legacyDates;
    return {
      ...DEFAULT_CLINIC_SCHEDULE_SETTINGS,
      ...parsed,
      blockOfficialHolidays: parsed.blockOfficialHolidays ?? true,
      doctorOffWeekdays: parsed.doctorOffWeekdays || DEFAULT_CLINIC_SCHEDULE_SETTINGS.doctorOffWeekdays,
      customHolidays,
      customHolidayDates: customHolidays.map(h => h.date)
    };
  } catch {
    return DEFAULT_CLINIC_SCHEDULE_SETTINGS;
  }
}

export function saveClinicScheduleSettings(settings: ClinicScheduleSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SCHEDULE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage error
  }
}

export function getWaitlistEntries(): WaitlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WAITLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaitlistEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWaitlistEntries(entries: WaitlistEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage error
  }
}

export function appointmentsOverlap(
  aTime: string,
  aDuration: number,
  bTime: string,
  bDuration: number
): boolean {
  const s1 = parseTimeMinutes(aTime);
  const e1 = s1 + Math.max(15, aDuration || 45);
  const s2 = parseTimeMinutes(bTime);
  const e2 = s2 + Math.max(15, bDuration || 45);
  return s1 < e2 && s2 < e1;
}

export function isAppointmentActive(status: Appointment['status']): boolean {
  return status !== 'cancelled' && status !== 'completed' && status !== 'no_show';
}

/**
 * Validate Jalali date string ("YYYY/MM/DD" in Persian or English digits) strictly against month lengths & leap years.
 */
export function isValidPersianDateStr(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const en = toEnglishDigits(dateStr.trim());
  const match = en.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1390 || year > 1450) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = getDaysInPersianMonth(month, year);
  return day >= 1 && day <= maxDay;
}

const FIXED_IRANIAN_HOLIDAYS: Record<string, string> = {
  '01/01': 'آغاز نوروز (تعطیل رسمی)',
  '01/02': 'عید نوروز (تعطیل رسمی)',
  '01/03': 'عید نوروز (تعطیل رسمی)',
  '01/04': 'عید نوروز (تعطیل رسمی)',
  '01/12': 'روز جمهوری اسلامی (تعطیل رسمی)',
  '01/13': 'روز طبیعت / سیزده‌بدر (تعطیل رسمی)',
  '03/14': 'رحلت امام خمینی (تعطیل رسمی)',
  '03/15': 'قیام ۱۵ خرداد (تعطیل رسمی)',
  '11/22': 'پیروزی انقلاب اسلامی (تعطیل رسمی)',
  '12/29': 'روز ملی شدن صنعت نفت (تعطیل رسمی)'
};

const LUNAR_IRANIAN_HOLIDAYS: Record<string, string> = {
  '01/09': 'تاسوعای حسینی (تعطیل رسمی)',
  '01/10': 'عاشورای حسینی (تعطیل رسمی)',
  '02/20': 'اربعین حسینی (تعطیل رسمی)',
  '02/28': 'رحلت پیامبر اکرم و شهادت امام حسن مجتبی (تعطیل رسمی)',
  '02/29': 'شهادت امام رضا علیه السلام (تعطیل رسمی)',
  '02/30': 'شهادت امام رضا علیه السلام (تعطیل رسمی)',
  '03/08': 'شهادت امام حسن عسکری (تعطیل رسمی)',
  '03/17': 'میلاد پیامبر اکرم و امام جعفر صادق (تعطیل رسمی)',
  '06/03': 'شهادت حضرت فاطمه زهرا (تعطیل رسمی)',
  '07/13': 'ولادت امام علی علیه السلام و روز پدر (تعطیل رسمی)',
  '07/27': 'مبعث حضرت رسول اکرم (تعطیل رسمی)',
  '08/15': 'ولادت حضرت مهدی و نیمه شعبان (تعطیل رسمی)',
  '09/21': 'شهادت حضرت علی علیه السلام (تعطیل رسمی)',
  '10/01': 'عید سعید فطر (تعطیل رسمی)',
  '10/02': 'تعطیل رسمی عید سعید فطر',
  '10/25': 'شهادت امام جعفر صادق (تعطیل رسمی)',
  '12/10': 'عید سعید قربان (تعطیل رسمی)',
  '12/18': 'عید سعید غدیر خم (تعطیل رسمی)'
};

const SOLAR_IRANIAN_OCCASIONS: Record<string, { title: string; type: 'medical' | 'cultural' }> = {
  '01/06': { title: 'روز امید و شادباش‌نویسی', type: 'cultural' },
  '01/23': { title: 'روز دندانپزشک (گرامیداشت جامعه دندانپزشکی)', type: 'medical' },
  '02/01': { title: 'روز بزرگداشت سعدی', type: 'cultural' },
  '02/12': { title: 'روز معلم و استاد', type: 'cultural' },
  '02/15': { title: 'روز ماما', type: 'medical' },
  '02/25': { title: 'روز بزرگداشت فردوسی', type: 'cultural' },
  '04/07': { title: 'روز قوه قضاییه', type: 'cultural' },
  '04/10': { title: 'جشن باستانی تیرگان', type: 'cultural' },
  '05/07': { title: 'جشن امردادگان', type: 'cultural' },
  '06/01': { title: 'روز پزشک (بزرگداشت بوعلی سینا)', type: 'medical' },
  '06/05': { title: 'روز داروساز', type: 'medical' },
  '07/16': { title: 'جشن مهرگان', type: 'cultural' },
  '07/20': { title: 'روز بزرگداشت حافظ', type: 'cultural' },
  '08/04': { title: 'جشن آبانگان', type: 'cultural' },
  '08/08': { title: 'روز بهداشت و سلامت دهان و دندان دانش‌آموز', type: 'medical' },
  '08/13': { title: 'روز دانش‌آموز', type: 'cultural' },
  '09/09': { title: 'جشن آذرگان', type: 'cultural' },
  '09/16': { title: 'روز دانشجو', type: 'cultural' },
  '09/30': { title: 'شب یلدا (بلندترین شب سال)', type: 'cultural' },
  '10/10': { title: 'جشن دی‌به مهر', type: 'cultural' },
  '11/10': { title: 'جشن باستانی سده', type: 'cultural' },
  '11/29': { title: 'جشن سپندارمذگان (روز عشق ایرانی)', type: 'cultural' },
  '12/05': { title: 'روز مهندس', type: 'cultural' },
  '12/29': { title: 'آستانه سال نو و چهارشنبه پایانی سال', type: 'cultural' }
};

export interface IranianDateOccasionItem {
  title: string;
  type: 'official_holiday' | 'lunar_holiday' | 'clinic_holiday' | 'friday' | 'medical' | 'cultural';
}

export interface IranianDateFullOccasions {
  isHoliday: boolean;
  isOfficialHoliday: boolean;
  isFriday: boolean;
  isCustomHoliday: boolean;
  reason?: string;
  gregorian: GregorianDateInfo;
  hijri: IslamicHijriDateInfo;
  occasions: IranianDateOccasionItem[];
}

export function getIranianDateOccasions(
  dateStr: string,
  settings?: ClinicScheduleSettings
): IranianDateFullOccasions {
  const parsed = parsePersianDate(dateStr);
  const weekdayIdx = getPersianWeekdayIndex(parsed.year, parsed.month, parsed.day);
  const isFriday = weekdayIdx === 6;
  const mmdd = `${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}`;
  const gregorian = getGregorianDateInfo(dateStr);
  const hijri = getIslamicHijriDateInfo(dateStr);

  const occasions: IranianDateOccasionItem[] = [];
  const fixedReason = FIXED_IRANIAN_HOLIDAYS[mmdd];
  if (fixedReason) {
    occasions.push({ title: fixedReason, type: 'official_holiday' });
  }
  const lunarReason = LUNAR_IRANIAN_HOLIDAYS[hijri.keyMmDd];
  if (lunarReason) {
    occasions.push({ title: lunarReason, type: 'lunar_holiday' });
  }
  const customMatch = settings?.customHolidays?.find(h => isSamePersianDate(h.date, dateStr));
  const legacyCustomMatch = !customMatch && settings?.customHolidayDates?.some(h => isSamePersianDate(h, dateStr));
  const isCustomHoliday = Boolean(customMatch || legacyCustomMatch);
  if (customMatch) {
    occasions.push({ title: customMatch.reason || 'تعطیلی ثبت‌شده مطب', type: 'clinic_holiday' });
  } else if (legacyCustomMatch) {
    occasions.push({ title: 'تعطیلی ثبت‌شده مطب', type: 'clinic_holiday' });
  }
  if (isFriday) {
    occasions.push({ title: 'تعطیل پایان هفته (جمعه)', type: 'friday' });
  }
  const culturalOccasion = SOLAR_IRANIAN_OCCASIONS[mmdd];
  if (culturalOccasion) {
    occasions.push({ title: culturalOccasion.title, type: culturalOccasion.type });
  }

  const isOfficialHoliday = Boolean(fixedReason || lunarReason);
  const primaryHoliday = occasions.find(
    o => o.type === 'clinic_holiday' || o.type === 'official_holiday' || o.type === 'lunar_holiday' || o.type === 'friday'
  );

  return {
    isHoliday: isOfficialHoliday || isCustomHoliday || isFriday,
    isOfficialHoliday,
    isFriday,
    isCustomHoliday,
    reason: primaryHoliday?.title || culturalOccasion?.title,
    gregorian,
    hijri,
    occasions
  };
}

export function isOfficialIranianHoliday(
  dateStr: string,
  settings?: ClinicScheduleSettings
): { isHoliday: boolean; isFriday: boolean; reason?: string } {
  const info = getIranianDateOccasions(dateStr, settings);
  const holidayOccasion = info.occasions.find(
    o => o.type === 'official_holiday' || o.type === 'lunar_holiday' || o.type === 'clinic_holiday' || o.type === 'friday'
  );
  return {
    isHoliday: info.isHoliday,
    isFriday: info.isFriday,
    reason: holidayOccasion?.title
  };
}

export interface MonthlyIranianOccasionDigestItem {
  day: number;
  dateStr: string;
  weekdayName: string;
  isHoliday: boolean;
  occasions: IranianDateOccasionItem[];
}

export function getMonthIranianOccasions(
  year: number,
  month1Indexed: number,
  settings?: ClinicScheduleSettings
): MonthlyIranianOccasionDigestItem[] {
  const days = getDaysInPersianMonth(month1Indexed, year);
  const result: MonthlyIranianOccasionDigestItem[] = [];
  for (let day = 1; day <= days; day++) {
    const dateStr = formatPersianDateString(year, month1Indexed, day);
    const info = getIranianDateOccasions(dateStr, settings);
    const significantOccasions = info.occasions.filter(o => o.type !== 'friday');
    if (significantOccasions.length > 0) {
      result.push({
        day,
        dateStr,
        weekdayName: getPersianWeekdayName(year, month1Indexed, day),
        isHoliday: info.isOfficialHoliday || info.isCustomHoliday || info.isFriday,
        occasions: significantOccasions
      });
    }
  }
  return result;
}

export function isDoctorOffOnDate(
  dateStr: string,
  doctorName: string,
  settings: ClinicScheduleSettings
): boolean {
  const weekdayIdx = getPersianWeekdayIndex(dateStr);
  const offDays = settings.doctorOffWeekdays?.[doctorName];
  return Array.isArray(offDays) && offDays.includes(weekdayIdx);
}

export function isTimeSlotBlockedBySchedule(
  dateStr: string,
  slotTime: string,
  doctorName: string,
  settings: ClinicScheduleSettings
): string | null {
  const holiday = isOfficialIranianHoliday(dateStr, settings);
  if (holiday.isHoliday) {
    return holiday.reason || 'تعطیل رسمی';
  }
  if (isDoctorOffOnDate(dateStr, doctorName, settings)) {
    return `عدم حضور ${doctorName}`;
  }
  const slotMins = parseTimeMinutes(slotTime);
  const openMins = parseTimeMinutes(settings.openTime);
  const closeMins = parseTimeMinutes(settings.closeTime);
  if (slotMins < openMins || slotMins >= closeMins) {
    return 'خارج از ساعت کاری';
  }
  if (settings.breakEnabled) {
    const breakStartMins = parseTimeMinutes(settings.breakStart);
    const breakEndMins = parseTimeMinutes(settings.breakEnd);
    if (slotMins >= breakStartMins && slotMins < breakEndMins) {
      return 'استراحت نیمروز';
    }
  }
  return null;
}

export interface OccupiedSlotsOptions {
  dateStr: string;
  unitId: string;
  doctorName?: string;
  excludeAptId?: string;
  excludeAppointmentId?: string;
  slotDurationMinutes?: number;
  candidateDuration?: number;
}

/**
 * Full interval-aware busy slot map across ALL 30-min clinic slots + exact appointment start times.
 * Supports both (appointments, options) and ({ appointments, ...options }) call forms.
 */
export function buildOccupiedSlotsMap(
  appointmentsOrParams:
    | Appointment[]
    | (OccupiedSlotsOptions & { appointments: Appointment[]; date?: string; candidateDurationMinutes?: number }),
  maybeOptions?: OccupiedSlotsOptions
): Record<string, string> {
  const appointments = Array.isArray(appointmentsOrParams)
    ? appointmentsOrParams
    : appointmentsOrParams.appointments;
  const opts = Array.isArray(appointmentsOrParams) ? maybeOptions! : appointmentsOrParams;
  const dateStr = opts.dateStr || (!Array.isArray(appointmentsOrParams) ? appointmentsOrParams.date : '') || '';
  const unitId = opts.unitId;
  const doctorName = opts.doctorName;
  const excludeId = opts.excludeAppointmentId || opts.excludeAptId;
  const slotDurationMinutes =
    opts.candidateDuration ??
    (!Array.isArray(appointmentsOrParams) ? appointmentsOrParams.candidateDurationMinutes : undefined) ??
    opts.slotDurationMinutes ??
    30;

  const normalizedTargetUnit = normalizeClinicUnitName(unitId);
  const map: Record<string, string> = {};

  const activeDayApts = appointments.filter(a => {
    if (excludeId && a.id === excludeId) return false;
    if (!isSamePersianDate(a.date, dateStr)) return false;
    if (!isAppointmentActive(a.status)) return false;
    const aptUnit = normalizeClinicUnitName(a.unit);
    return aptUnit === normalizedTargetUnit || (doctorName && a.doctor === doctorName);
  });

  for (const apt of activeDayApts) {
    const isSameUnit = normalizeClinicUnitName(apt.unit) === normalizedTargetUnit;
    const label = isSameUnit ? apt.patientName : `${apt.patientName} (${normalizeClinicUnitName(apt.unit)})`;
    map[toPersianDigits(apt.time)] = label;

    for (const slot of ALL_CLINIC_TIME_SLOTS) {
      if (appointmentsOverlap(apt.time, apt.durationMinutes || 45, slot, slotDurationMinutes)) {
        const key = toPersianDigits(slot);
        if (!map[key]) {
          map[key] = label;
        }
      }
    }
  }

  return map;
}

export function buildBlockedScheduleSlotsMap(
  dateStr: string,
  doctorName: string,
  settings: ClinicScheduleSettings
): Record<string, string> {
  const blocked: Record<string, string> = {};
  for (const slot of ALL_CLINIC_TIME_SLOTS) {
    const reason = isTimeSlotBlockedBySchedule(dateStr, slot, doctorName, settings);
    if (reason) {
      blocked[toPersianDigits(slot)] = reason;
    }
  }
  return blocked;
}

/**
 * Automatically infer optimal session duration & unit based on dental procedure keywords.
 */
export function suggestTreatmentSchedule(treatmentText: string): {
  durationMinutes: number;
  suggestedUnit: string;
  matched: boolean;
} {
  const txt = (treatmentText || '').trim();
  if (/ایمپلنت|فیکسچر|جراحی|سینوس|پیوند|عقل نهفته|هیلینگ/.test(txt)) {
    return { durationMinutes: 90, suggestedUnit: 'یونیت جراحی', matched: true };
  }
  if (/عصب|روت|اندو|پالپکتومی|ریشه|پست و کور|روکش|زیرکونیا|لمینت/.test(txt)) {
    return { durationMinutes: 60, suggestedUnit: 'یونیت زرد', matched: true };
  }
  if (/کامپوزیت|ونیر|بلیچینگ|جرم|ترمیم|الاینر|قالب/.test(txt)) {
    return { durationMinutes: 45, suggestedUnit: 'یونیت آبی', matched: true };
  }
  if (/معاینه|چکاپ|بخیه|مشاوره|کنترل|اسکن|فلوراید/.test(txt)) {
    return { durationMinutes: 30, suggestedUnit: 'یونیت آبی', matched: true };
  }
  return { durationMinutes: 45, suggestedUnit: 'یونیت آبی', matched: false };
}

export function shiftPersianTimeMinutes(timeStr: string, deltaMinutes: number): string {
  const total = Math.max(8 * 60, Math.min(23 * 60 + 45, parseTimeMinutes(timeStr) + deltaMinutes));
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return toPersianDigits(`${hh}:${mm}`);
}

export function formatElapsedChairMinutes(chairStartedAtIso?: string, nowMs: number = Date.now()): number {
  if (!chairStartedAtIso) return 0;
  const startedMs = new Date(chairStartedAtIso).getTime();
  if (!Number.isFinite(startedMs)) return 0;
  return Math.max(1, Math.round((nowMs - startedMs) / 60000));
}

export function normalizePhoneForWhatsApp(phone?: string): string {
  const digits = toEnglishDigits(phone || '').replace(/\D/g, '');
  if (digits.startsWith('09') && digits.length === 11) {
    return `98${digits.slice(1)}`;
  }
  if (digits.startsWith('989') && digits.length >= 12) {
    return digits;
  }
  return digits;
}

export function formatWhatsAppReminderUrl(apt: Appointment): string | null {
  const waPhone = normalizePhoneForWhatsApp(apt.phone);
  if (waPhone.length < 10) return null;
  const msg = `سلام ${apt.patientName} عزیز؛ یادآوری نوبت کلینیک دندانپزشکی مینادنتال در تاریخ ${toPersianDigits(
    apt.date
  )} ساعت ${toPersianDigits(apt.time)} (${normalizeClinicUnitName(apt.unit)} · ${apt.doctor}) بابت ${
    apt.treatment
  }. لطفاً ۱۰ دقیقه پیش از موعد حضور داشته باشید.`;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
}

/**
 * Find the earliest date >= startDateStr that is neither a clinic/official holiday nor doctor's off-day.
 */
export function findNextWorkingDate(
  startDateStr: string,
  doctorName: string,
  settings: ClinicScheduleSettings
): string {
  let cursor = startDateStr;
  for (let i = 0; i < 30; i++) {
    const hol = isOfficialIranianHoliday(cursor, settings);
    const blockedByHoliday = settings.blockOfficialHolidays !== false ? hol.isHoliday : Boolean(settings.customHolidays?.some(h => isSamePersianDate(h.date, cursor)));
    if (!blockedByHoliday && !isDoctorOffOnDate(cursor, doctorName, settings)) {
      return cursor;
    }
    cursor = addDaysToPersianDate(cursor, 1);
  }
  return startDateStr;
}

/**
 * Compute per-unit booked minutes and utilization percentage for the selected Jalali day.
 */
export function calculateUnitCapacityStats(
  unitId: string,
  dateStr: string,
  appointments: Appointment[],
  settings: ClinicScheduleSettings
): { bookedMinutes: number; totalMinutes: number; utilizationPercent: number; activeCount: number } {
  const normUnit = normalizeClinicUnitName(unitId);
  const openMins = parseTimeMinutes(settings.openTime || '۰۸:۳۰');
  const closeMins = parseTimeMinutes(settings.closeTime || '۲۲:۰۰');
  const breakMins = settings.breakEnabled
    ? Math.max(0, parseTimeMinutes(settings.breakEnd || '۱۵:۰۰') - parseTimeMinutes(settings.breakStart || '۱۳:۳۰'))
    : 0;
  const totalMinutes = Math.max(60, closeMins - openMins - breakMins);

  const activeInUnit = appointments.filter(
    a =>
      isSamePersianDate(a.date, dateStr) &&
      normalizeClinicUnitName(a.unit) === normUnit &&
      isAppointmentActive(a.status)
  );
  const bookedMinutes = activeInUnit.reduce((sum, a) => sum + (a.durationMinutes || 45), 0);
  const utilizationPercent = Math.min(100, Math.round((bookedMinutes / totalMinutes) * 100));
  return {
    bookedMinutes,
    totalMinutes,
    utilizationPercent,
    activeCount: activeInUnit.length
  };
}

/**
 * Generate Jalali dates for recurring multi-session dental plans (weekly, biweekly, monthly).
 */
export function buildRecurringSessionDates(
  baseDateStr: string,
  cadence: 'single' | 'weekly' | 'biweekly' | 'monthly',
  count: number
): string[] {
  if (cadence === 'single' || count <= 1) return [baseDateStr];
  const dates: string[] = [baseDateStr];
  for (let idx = 1; idx < Math.min(6, count); idx++) {
    if (cadence === 'weekly') {
      dates.push(addDaysToPersianDate(baseDateStr, idx * 7));
    } else if (cadence === 'biweekly') {
      dates.push(addDaysToPersianDate(baseDateStr, idx * 14));
    } else {
      dates.push(addMonthsToPersianDate(baseDateStr, idx));
    }
  }
  return dates;
}

/**
 * Build UTF-8 BOM CSV content for Iranian Excel compatibility.
 */
export function generateAppointmentsCsvContent(dateStr: string, appointments: Appointment[]): string {
  const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
  const statusMap: Record<Appointment['status'], string> = {
    scheduled: 'رزرو شده',
    waiting: 'در سالن انتظار',
    in_chair: 'روی یونیت',
    completed: 'مختومه',
    cancelled: 'لغو شده',
    no_show: 'عدم حضور'
  };
  const header = ['تاریخ', 'ساعت', 'مدت(دقیقه)', 'یونیت', 'نام بیمار', 'تلفن', 'پزشک معالج', 'درمان', 'وضعیت']
    .map(escapeCell)
    .join(',');
  const rows = appointments.map(a =>
    [
      toPersianDigits(a.date || dateStr),
      toPersianDigits(a.time),
      toPersianDigits(a.durationMinutes || 45),
      normalizeClinicUnitName(a.unit),
      a.patientName,
      toPersianDigits(a.phone),
      a.doctor,
      a.treatment,
      statusMap[a.status] || a.status
    ]
      .map(escapeCell)
      .join(',')
  );
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export interface NoShowRiskAssessment {
  probabilityPercent: number;
  level: 'low' | 'moderate' | 'high';
  noShowCount: number;
  cancelledCount: number;
  completedCount: number;
  reasons: string[];
  recommendations: string[];
}

/**
 * Predicts appointment no-show probability from patient history (no_show, cancelled, completed)
 * and clinical/financial patient traits (overdue installments, bounced checks, high balance debt, age, time slot).
 */
export function predictAppointmentNoShowRisk(params: {
  patient?: Patient | null;
  phone?: string;
  patientName?: string;
  appointments: Appointment[];
  targetTime?: string;
  treatment?: string;
}): NoShowRiskAssessment {
  const { patient, phone, patientName, appointments, targetTime, treatment } = params;
  const effectivePhone = toEnglishDigits(phone || patient?.phone || '').replace(/\D/g, '');
  const last7 = effectivePhone.length >= 7 ? effectivePhone.slice(-7) : '';
  const cleanName = (patientName || patient?.fullName || '').trim();

  let noShowCount = 0;
  let cancelledCount = 0;
  let completedCount = 0;

  for (const apt of appointments) {
    const matchesPatient =
      (patient && apt.patientId && apt.patientId === patient.id) ||
      (last7.length >= 7 && toEnglishDigits(apt.phone || '').replace(/\D/g, '').slice(-7) === last7) ||
      (cleanName.length >= 3 && (apt.patientName || '').trim() === cleanName);

    if (!matchesPatient) continue;
    if (apt.status === 'no_show') noShowCount += 1;
    else if (apt.status === 'cancelled') cancelledCount += 1;
    else if (apt.status === 'completed') completedCount += 1;
  }

  let score = 8;
  const reasons: string[] = [];

  if (noShowCount > 0) {
    score += noShowCount * 32;
    reasons.push(`${toPersianDigits(noShowCount)} نوبت عدم حضور قبلی (No-Show) ثبت شده`);
  }

  if (cancelledCount > 0) {
    score += cancelledCount * 14;
    reasons.push(`${toPersianDigits(cancelledCount)} نوبت لغوشده در سوابق بیمار`);
  }

  if (patient) {
    const overdueCount = (patient.installments || []).filter(i => i.status === 'overdue').length;
    if (overdueCount > 0) {
      score += Math.min(24, overdueCount * 15);
      reasons.push(`دارای ${toPersianDigits(overdueCount)} قسط درمانی معوقه`);
    }

    const bouncedChecks = (patient.sayadChecks || []).filter(c => c.status === 'bounced').length;
    if (bouncedChecks > 0) {
      score += 18;
      reasons.push(`سابقه ${toPersianDigits(bouncedChecks)} فقره چک صیادی برگشتی`);
    }

    if (Number(patient.balance) < -5_000_000) {
      score += 10;
      reasons.push(`مانده بدهی ${formatToman(Math.abs(patient.balance))} در پرونده`);
    }

    if (patient.age >= 65) {
      score += 7;
      reasons.push(`بیمار سالمند (${toPersianDigits(patient.age)} سال) — نیاز به هماهنگی همراه`);
    } else if (patient.age > 0 && patient.age <= 12) {
      score += 6;
      reasons.push(`بیمار کودک (${toPersianDigits(patient.age)} سال) — نیاز به تایید والدین`);
    }
  } else if (cleanName.length >= 2 && effectivePhone.length < 10) {
    score += 12;
    reasons.push('شماره تماس معتبر برای ارسال پیامک تاییدیه ثبت نشده است');
  }

  if (targetTime) {
    const mins = parseTimeMinutes(targetTime);
    if (mins >= 19 * 60 + 30) {
      score += 8;
      if (reasons.length > 0 || noShowCount > 0 || cancelledCount > 0) {
        reasons.push(`ساعت نوبت انتهای شب (${toPersianDigits(targetTime)})`);
      }
    }
  }

  if (treatment && /جرم|معاینه|مشاوره|چکاپ/.test(treatment) && (noShowCount > 0 || cancelledCount > 0)) {
    score += 5;
  }

  if (completedCount >= 2 && noShowCount === 0 && cancelledCount === 0) {
    score -= 8;
  }

  const probabilityPercent = Math.max(5, Math.min(95, Math.round(score)));
  const level: NoShowRiskAssessment['level'] =
    probabilityPercent >= 50 ? 'high' : probabilityPercent >= 25 ? 'moderate' : 'low';

  const recommendations: string[] = [];
  if (level === 'high') {
    recommendations.push('تماس تاییدیه تلفنی ۲۴ ساعت و ۲ ساعت پیش از نوبت');
    recommendations.push('دریافت بیعانه جهت رزرو قطعی یونیت');
  } else if (level === 'moderate') {
    recommendations.push('فعال‌سازی پیامک یادآور خودکار و تاییدیه دوطرفه');
    recommendations.push('تعیین نوبت جایگزین در لیست انتظار در صورت عدم پاسخ');
  }

  return {
    probabilityPercent,
    level,
    noShowCount,
    cancelledCount,
    completedCount,
    reasons,
    recommendations
  };
}

