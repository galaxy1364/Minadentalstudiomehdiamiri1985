import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  jalaliToGregorian,
  gregorianToJalali,
  getPersianWeekdayIndex,
  getPersianWeekdayName,
  getPersianWeekdayShortName,
  getPersianMonthStartWeekdayIndex,
  getDaysInPersianMonth,
  isPersianLeapYear,
  comparePersianDates,
  diffPersianDays,
  addDaysToPersianDate,
  isPastPersianDateTime,
  getCurrentPersianDate,
  getRelativePersianDate,
  parseTimeMinutes,
  toPersianDigits,
  getGregorianDateInfo,
  getIslamicHijriDateInfo,
  gregorianToIslamicCivil,
  getPersianSeasonInfo,
  getDaysUntilNowruz,
  getWeekDatesStartingSaturday,
  convertGregorianInputToCalendarInfo,
  computeClinicalTargetDate
} from '../utils/jalali';
import {
  buildClinicTreatmentQueue,
  buildPhasedTreatmentRoadmap,
  evaluateEndodonticDiagnosis,
  evaluatePatientTreatmentSafety,
  evaluatePeriodontalRisk,
  getTreatmentClinicalProtocol
} from '../utils/treatmentIntelligence';
import { INITIAL_APPOINTMENTS, INITIAL_INVENTORY, INITIAL_PATIENTS } from '../data/mockData';
import {
  assignReminderToStaff,
  batchMarkRemindersDone,
  batchSnoozeReminders,
  computeReminderTriggerDateTime,
  evaluateAndDispatchDuePhoneNotifications,
  generateDailyClinicDigestText,
  generateRemindersCsvContent,
  getAppointmentConfirmationsMap,
  getCustomReminders,
  getPatientActiveReminders,
  getPresetLabelFa,
  getReminderAnalyticsSummary,
  getReminderAssignmentsMap,
  getReminderSettings,
  isReminderCurrentlySnoozed,
  isWithinQuietHours,
  markReminderDone,
  playCriticalAlarmChime,
  reopenReminder,
  saveReminderSettings,
  scheduleEntityReminder,
  setAppointmentConfirmationStatus,
  snoozeReminder,
  synthesizeUnifiedClinicReminders,
  unsnoozeReminder
} from '../services/reminderNotificationService';
import { AppointmentsView } from '../components/views/AppointmentsView';
import { RemindersView } from '../components/views/RemindersView';
import { buildLiveClinicalNotifications } from '../components/NotificationDrawer';
import {
  DEFAULT_CLINIC_UNITS,
  normalizeClinicUnitName,
  buildOccupiedSlotsMap,
  isValidPersianDateStr,
  isOfficialIranianHoliday,
  isDoctorOffOnDate,
  isTimeSlotBlockedBySchedule,
  suggestTreatmentSchedule,
  shiftPersianTimeMinutes,
  formatWhatsAppReminderUrl,
  findNextWorkingDate,
  calculateUnitCapacityStats,
  buildRecurringSessionDates,
  generateAppointmentsCsvContent,
  getIranianDateOccasions,
  getMonthIranianOccasions,
  DEFAULT_SCHEDULE_SETTINGS,
  predictAppointmentNoShowRisk
} from '../utils/appointmentScheduling';
import {
  buildFinancialReportsDataset,
  generateFinancialReportsCsvContent
} from '../utils/financialReports';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

describe('MinaDental Jalali Calendar & Weekday Mathematics', () => {
  it('performs exact round-trip conversion between Jalali and Gregorian dates including leap years', () => {
    const sampleJalaliDates: Array<[number, number, number]> = [
      [1399, 1, 1],
      [1399, 12, 30], // Leap year Esfand 30
      [1400, 1, 1],
      [1403, 12, 30], // Leap year Esfand 30
      [1404, 1, 1],
      [1404, 12, 29],
      [1405, 1, 1],
      [1405, 6, 31],
      [1405, 8, 24],
      [1405, 12, 29]
    ];

    for (const [jy, jm, jd] of sampleJalaliDates) {
      const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
      const [jyBack, jmBack, jdBack] = gregorianToJalali(gy, gm, gd);
      expect([jyBack, jmBack, jdBack]).toEqual([jy, jm, jd]);
    }
  });

  it('computes accurate Persian weekdays (0=شنبه ... 6=جمعه) and month start offsets', () => {
    // 1403/01/01 == 2024-03-20 (Wednesday -> چهارشنبه -> index 4)
    expect(getPersianWeekdayIndex(1403, 1, 1)).toBe(4);
    expect(getPersianWeekdayName(1403, 1, 1)).toBe('چهارشنبه');
    expect(getPersianWeekdayShortName(1403, 1, 1)).toBe('۴شنبه');
    expect(getPersianMonthStartWeekdayIndex(1403, 1)).toBe(4);

    // 1405/01/01 == 2026-03-21 (Saturday -> شنبه -> index 0)
    expect(getPersianWeekdayIndex(1405, 1, 1)).toBe(0);
    expect(getPersianWeekdayName(1405, 1, 1)).toBe('شنبه');
    expect(getPersianMonthStartWeekdayIndex(1405, 1)).toBe(0);

    // String parsing parity with Persian digits
    expect(getPersianWeekdayIndex('۱۴۰۵/۰۱/۰۱')).toBe(0);
    expect(getPersianWeekdayName('۱۴۰۵/۰۱/۰۱')).toBe('شنبه');

    // Every Gregorian calendar day increments Persian weekday index cleanly modulo 7
    const startIdx = getPersianWeekdayIndex(1405, 8, 1);
    for (let d = 1; d <= 14; d++) {
      const idx = getPersianWeekdayIndex(1405, 8, d);
      expect(idx).toBe((startIdx + d - 1) % 7);
    }
  });

  it('handles Jalali leap-year month lengths, date diffs, additions, and past-time checks accurately', () => {
    expect(isPersianLeapYear(1403)).toBe(true);
    expect(getDaysInPersianMonth(12, 1403)).toBe(30);
    expect(isPersianLeapYear(1405)).toBe(false);
    expect(getDaysInPersianMonth(12, 1405)).toBe(29);

    expect(comparePersianDates('۱۴۰۵/۰۸/۰۱', '۱۴۰۵/۰۸/۰۲')).toBe(-1);
    expect(comparePersianDates('۱۴۰۵/۰۸/۰۲', '۱۴۰۵/۰۸/۰۲')).toBe(0);
    expect(comparePersianDates('۱۴۰۵/۰۸/۰۵', '۱۴۰۵/۰۸/۰۲')).toBe(1);

    expect(diffPersianDays('۱۴۰۵/۰۸/۱۰', '۱۴۰۵/۰۸/۱۵')).toBe(5);
    expect(diffPersianDays('۱۴۰۵/۰۸/۱۵', '۱۴۰۵/۰۸/۱۰')).toBe(-5);
    expect(addDaysToPersianDate('۱۴۰۵/۰۶/۳۰', 2)).toBe('۱۴۰۵/۰۷/۰۱');

    const yesterday = getRelativePersianDate(-1);
    const tomorrow = getRelativePersianDate(1);
    expect(isPastPersianDateTime(yesterday, '۲۳:۵۹')).toBe(true);
    expect(isPastPersianDateTime(tomorrow, '۰۰:۰۰')).toBe(false);
  });

  it('computes tri-calendar Gregorian & Islamic Hijri dates, Iranian occasions, seasons, and Saturday-anchored weeks', () => {
    // 1405/01/01 == 2026-03-21 (Saturday)
    const greg = getGregorianDateInfo('۱۴۰۵/۰۱/۰۱');
    expect(greg.year).toBe(2026);
    expect(greg.month).toBe(3);
    expect(greg.day).toBe(21);
    expect(greg.formattedEn).toBe('2026/03/21');

    const hijri = getIslamicHijriDateInfo('۱۴۰۵/۰۱/۰۱');
    expect(hijri.year).toBeGreaterThanOrEqual(1447);
    expect(hijri.month).toBeGreaterThanOrEqual(1);
    expect(hijri.month).toBeLessThanOrEqual(12);
    expect(hijri.monthNameFa.length).toBeGreaterThan(2);

    const [cy, cm, cd] = gregorianToIslamicCivil(2026, 3, 21);
    expect(cy).toBeGreaterThanOrEqual(1447);
    expect(cm).toBeGreaterThanOrEqual(1);
    expect(cd).toBeGreaterThanOrEqual(1);

    expect(getPersianSeasonInfo(1).name).toBe('بهار');
    expect(getPersianSeasonInfo(8).name).toBe('پاییز');
    expect(getDaysUntilNowruz('۱۴۰۵/۰۱/۰۱')).toBe(0);
    expect(getDaysUntilNowruz('۱۴۰۵/۱۲/۲۸')).toBe(2);
    expect(getDaysUntilNowruz('۱۴۰۵/۱۲/۲۹')).toBe(1);

    // Iranian week starting Saturday
    const week = getWeekDatesStartingSaturday('۱۴۰۵/۰۱/۰۴'); // Tuesday -> starts 01/01 Saturday
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('۱۴۰۵/۰۱/۰۱');
    expect(week[6]).toBe('۱۴۰۵/۰۱/۰۷');

    // Dentist day (Farvardin 23) & Yalda night (Azar 30) occasions
    const dentistDay = getIranianDateOccasions('۱۴۰۵/۰۱/۲۳', DEFAULT_SCHEDULE_SETTINGS);
    expect(dentistDay.occasions.some(o => o.title.includes('دندانپزشک'))).toBe(true);
    const yalda = getIranianDateOccasions('۱۴۰۵/۰۹/۳۰', DEFAULT_SCHEDULE_SETTINGS);
    expect(yalda.occasions.some(o => o.title.includes('یلدا'))).toBe(true);

    // Gregorian -> Tri-Calendar converter (2026-03-21 == ۱۴۰۵/۰۱/۰۱ شنبه)
    const converted = convertGregorianInputToCalendarInfo('2026-03-21');
    expect(converted).not.toBeNull();
    expect(converted!.jalali).toBe('۱۴۰۵/۰۱/۰۱');
    expect(converted!.weekdayName).toBe('شنبه');
    expect(converted!.gregorian.formattedEn).toBe('2026/03/21');
    expect(converted!.hijri.year).toBeGreaterThanOrEqual(1447);
    expect(convertGregorianInputToCalendarInfo('invalid-date')).toBeNull();

    // Clinical follow-up target calculator (+days / +months)
    const sutureCheck = computeClinicalTargetDate('۱۴۰۵/۰۱/۰۱', 14, 'days');
    expect(sutureCheck.jalali).toBe('۱۴۰۵/۰۱/۱۵');
    const implantHealing = computeClinicalTargetDate('۱۴۰۵/۰۱/۱۰', 3, 'months');
    expect(implantHealing.jalali).toBe('۱۴۰۵/۰۴/۱۰');
    const leapEndMonth = computeClinicalTargetDate('۱۴۰۳/۱۱/۳۰', 1, 'months');
    expect(leapEndMonth.jalali).toBe('۱۴۰۳/۱۲/۳۰');

    // Monthly Iranian occasions & holidays digest
    const farvardinDigest = getMonthIranianOccasions(1405, 1, DEFAULT_SCHEDULE_SETTINGS);
    expect(farvardinDigest.some(item => item.day === 1 && item.isHoliday)).toBe(true);
    expect(farvardinDigest.some(item => item.day === 23 && item.occasions.some(o => o.title.includes('دندانپزشک')))).toBe(true);
    const esfandDigest = getMonthIranianOccasions(1405, 12, DEFAULT_SCHEDULE_SETTINGS);
    expect(esfandDigest.some(item => item.day === 29 && item.isHoliday && item.occasions.some(o => o.title.includes('صنعت نفت')))).toBe(true);
  });
});

describe('MinaDental Multi-Day Appointments, Canonical Units & Smart Scheduling Engine', () => {
  it('uses canonical unit names (یونیت آبی، یونیت زرد، یونیت جراحی) and normalizes legacy aliases', () => {
    expect(DEFAULT_CLINIC_UNITS.map((u) => u.name)).toEqual([
      'یونیت آبی',
      'یونیت زرد',
      'یونیت جراحی'
    ]);
    expect(normalizeClinicUnitName('یونیت ۱')).toBe('یونیت آبی');
    expect(normalizeClinicUnitName('یونیت ۲')).toBe('یونیت زرد');
    expect(normalizeClinicUnitName('اتاق جراحی')).toBe('یونیت جراحی');
    expect(normalizeClinicUnitName('یونیت جراحی')).toBe('یونیت جراحی');

    const unitSet = new Set(INITIAL_APPOINTMENTS.map((a) => a.unit));
    expect(unitSet.has('یونیت آبی')).toBe(true);
    expect(unitSet.has('یونیت زرد')).toBe(true);
    expect(unitSet.has('یونیت جراحی')).toBe(true);
    expect(unitSet.has('یونیت ۱')).toBe(false);
    expect(unitSet.has('یونیت ۲')).toBe(false);
    expect(unitSet.has('اتاق جراحی')).toBe(false);
  });

  it('validates Jalali dates, Iranian holidays, lunch breaks, full-interval occupancy, and treatment suggestions', () => {
    expect(isValidPersianDateStr('۱۴۰۵/۰۱/۰۱')).toBe(true);
    expect(isValidPersianDateStr('۱۴۰۵/۱۲/۲۹')).toBe(true);
    expect(isValidPersianDateStr('۱۴۰۵/۱۲/۳۰')).toBe(false); // 1405 is not leap
    expect(isValidPersianDateStr('۱۴۰۳/۱۲/۳۰')).toBe(true);  // 1403 is leap
    expect(isValidPersianDateStr('۱۴۰۵/۱۳/۰۱')).toBe(false);

    // Nowruz & Friday holidays
    expect(isOfficialIranianHoliday('۱۴۰۵/۰۱/۰۱', DEFAULT_SCHEDULE_SETTINGS).isHoliday).toBe(true);
    // 1405/01/07 is Friday
    expect(isOfficialIranianHoliday('۱۴۰۵/۰۱/۰۷', DEFAULT_SCHEDULE_SETTINGS).isHoliday).toBe(true);

    // Lunch break blocking (13:30 - 15:00)
    const lunchReason = isTimeSlotBlockedBySchedule('۱۴۰۵/۰۸/۰۵', '۱۴:۰۰', 'دکتر مهدی امیری', DEFAULT_SCHEDULE_SETTINGS);
    expect(lunchReason).toBe('استراحت نیمروز');

    // Full-interval occupancy blocking across 90-min implant slot
    const sampleApts = [
      {
        ...INITIAL_APPOINTMENTS[0],
        id: 'apt-interval-1',
        date: '۱۴۰۵/۰۸/۱۰',
        time: '۱۷:۰۰',
        durationMinutes: 90,
        unit: 'یونیت جراحی',
        doctor: 'دکتر مهدی امیری',
        status: 'scheduled' as const
      }
    ];
    const occupied = buildOccupiedSlotsMap(sampleApts, {
      dateStr: '۱۴۰۵/۰۸/۱۰',
      unitId: 'یونیت جراحی',
      doctorName: 'دکتر مهدی امیری',
      candidateDuration: 30
    });
    expect(occupied['۱۷:۰۰']).toBeDefined();
    expect(occupied['۱۷:۳۰']).toBeDefined();
    expect(occupied['۱۸:۰۰']).toBeDefined();
    expect(occupied['۱۸:۳۰']).toBeUndefined();

    // Treatment inference & time shift & WhatsApp reminder URL
    expect(suggestTreatmentSchedule('ایمپلنت دندان ۶')).toEqual({
      durationMinutes: 90,
      suggestedUnit: 'یونیت جراحی',
      matched: true
    });
    expect(suggestTreatmentSchedule('عصب‌کشی مولر')).toEqual({
      durationMinutes: 60,
      suggestedUnit: 'یونیت زرد',
      matched: true
    });
    expect(shiftPersianTimeMinutes('۱۷:۳۰', 45)).toBe('۱۸:۱۵');

    const waUrl = formatWhatsAppReminderUrl({
      ...INITIAL_APPOINTMENTS[0],
      patientName: 'علی مرادی',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      date: '۱۴۰۵/۰۸/۲۰',
      time: '۱۷:۰۰',
      doctor: 'دکتر مهدی امیری',
      unit: 'یونیت آبی'
    });
    expect(waUrl).toContain('https://wa.me/989123456789');

    // Next working day skips Nowruz 1..4 holidays -> 1405/01/05
    expect(findNextWorkingDate('۱۴۰۵/۰۱/۰۱', 'دکتر مهدی امیری', DEFAULT_SCHEDULE_SETTINGS)).toBe('۱۴۰۵/۰۱/۰۵');
    // Doctor off day: دکتر مریم رضایی is off Thu(5) & Fri(6); 1405/08/15 is Friday(6) -> skips to Saturday 1405/08/16
    expect(isDoctorOffOnDate('۱۴۰۵/۰۱/۰۷', 'دکتر مهدی امیری', DEFAULT_SCHEDULE_SETTINGS)).toBe(true);

    // Unit capacity utilization calculation
    const capStats = calculateUnitCapacityStats('یونیت جراحی', '۱۴۰۵/۰۸/۱۰', sampleApts, DEFAULT_SCHEDULE_SETTINGS);
    expect(capStats.activeCount).toBe(1);
    expect(capStats.bookedMinutes).toBe(90);
    expect(capStats.utilizationPercent).toBeGreaterThan(0);

    // Multi-session recurrence generation
    expect(buildRecurringSessionDates('۱۴۰۵/۰۸/۱۰', 'weekly', 3)).toEqual([
      '۱۴۰۵/۰۸/۱۰',
      '۱۴۰۵/۰۸/۱۷',
      '۱۴۰۵/۰۸/۲۴'
    ]);
    expect(buildRecurringSessionDates('۱۴۰۵/۰۸/۱۰', 'monthly', 2)).toEqual([
      '۱۴۰۵/۰۸/۱۰',
      '۱۴۰۵/۰۹/۱۰'
    ]);

    // UTF-8 BOM CSV schedule export
    const csv = generateAppointmentsCsvContent('۱۴۰۵/۰۸/۱۰', sampleApts);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('یونیت جراحی');
    expect(csv).toContain('دکتر مهدی امیری');
  });

  it('spans yesterday, today, tomorrow, and inTwoDays with zero unit or doctor time overlaps', () => {
    const yesterday = getRelativePersianDate(-1);
    const today = getCurrentPersianDate();
    const tomorrow = getRelativePersianDate(1);
    const inTwoDays = getRelativePersianDate(2);

    const hasDate = (target: string) =>
      INITIAL_APPOINTMENTS.some((a) => a.date === target);

    expect(hasDate(yesterday)).toBe(true);
    expect(hasDate(today)).toBe(true);
    expect(hasDate(tomorrow)).toBe(true);
    expect(hasDate(inTwoDays)).toBe(true);

    // Every appointment references an existing patient record and valid duration
    for (const apt of INITIAL_APPOINTMENTS) {
      const matched = INITIAL_PATIENTS.find(
        (p) => p.id === apt.patientId || p.fullName === apt.patientName
      );
      expect(matched, `Missing patient link for ${apt.id}`).toBeDefined();
      expect(apt.durationMinutes).toBeGreaterThanOrEqual(15);

      if (apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'no_show') {
        expect(apt.reminderConfig?.enabled).toBe(true);
        expect(apt.reminderConfig?.channels.length).toBeGreaterThan(0);
      }
    }

    // Zero time overlap on same date for same unit OR same doctor
    for (let i = 0; i < INITIAL_APPOINTMENTS.length; i++) {
      for (let j = i + 1; j < INITIAL_APPOINTMENTS.length; j++) {
        const a = INITIAL_APPOINTMENTS[i];
        const b = INITIAL_APPOINTMENTS[j];
        if (a.date !== b.date) continue;
        if (a.status === 'cancelled' || b.status === 'cancelled' || a.status === 'no_show' || b.status === 'no_show') continue;

        const s1 = parseTimeMinutes(a.time);
        const e1 = s1 + (a.durationMinutes || 45);
        const s2 = parseTimeMinutes(b.time);
        const e2 = s2 + (b.durationMinutes || 45);
        const overlaps = s1 < e2 && s2 < e1;

        if (overlaps) {
          expect(a.unit).not.toBe(b.unit);
          expect(a.doctor).not.toBe(b.doctor);
        }
      }
    }
  });
});

describe('MinaDental Reminder Scheduling, Snooze & Phone Notification Engine', () => {
  const origWindow = globalThis.window;

  beforeEach(() => {
    const storage = createMemoryStorage();
    const dispatchedNotifs: Array<{ title: string; options?: NotificationOptions }> = [];

    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
      constructor(title: string, options?: NotificationOptions) {
        dispatchedNotifs.push({ title, options });
      }
    }

    const fakeWindow: Record<string, unknown> = {
      localStorage: storage,
      Notification: MockNotification,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      __dispatchedNotifs: dispatchedNotifs
    };
    (globalThis as unknown as { window: unknown }).window = fakeWindow;
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = origWindow;
    vi.restoreAllMocks();
  });

  it('computes accurate reminder trigger date & time across presets', () => {
    expect(
      computeReminderTriggerDateTime('۱۴۰۵/۰۸/۲۰', '۱۷:۰۰', {
        enabled: true,
        preset: 'at_time',
        channels: ['phone_push']
      })
    ).toEqual({ triggerDate: '۱۴۰۵/۰۸/۲۰', triggerTime: '۱۷:۰۰' });

    expect(
      computeReminderTriggerDateTime('۱۴۰۵/۰۸/۲۰', '۱۷:۰۰', {
        enabled: true,
        preset: '30m_before',
        channels: ['phone_push']
      })
    ).toEqual({ triggerDate: '۱۴۰۵/۰۸/۲۰', triggerTime: '۱۶:۳۰' });

    expect(
      computeReminderTriggerDateTime('۱۴۰۵/۰۸/۲۰', '۱۷:۰۰', {
        enabled: true,
        preset: '2h_before',
        channels: ['phone_push']
      })
    ).toEqual({ triggerDate: '۱۴۰۵/۰۸/۲۰', triggerTime: '۱۵:۰۰' });

    expect(
      computeReminderTriggerDateTime('۱۴۰۵/۰۸/۲۰', '۱۷:۰۰', {
        enabled: true,
        preset: '1d_before',
        channels: ['phone_push']
      })
    ).toEqual({ triggerDate: '۱۴۰۵/۰۸/۱۹', triggerTime: '۱۷:۰۰' });

    expect(
      computeReminderTriggerDateTime('۱۴۰۵/۰۸/۲۰', '۱۷:۰۰', {
        enabled: true,
        preset: '2d_before',
        channels: ['phone_push']
      })
    ).toEqual({ triggerDate: '۱۴۰۵/۰۸/۱۸', triggerTime: '۱۷:۰۰' });

    expect(
      computeReminderTriggerDateTime('۱۴۰۵/۰۸/۲۰', '۱۷:۰۰', {
        enabled: true,
        preset: 'custom',
        customDate: '۱۴۰۵/۰۸/۱۷',
        customTime: '۱۰:۱۵',
        channels: ['phone_push', 'sms']
      })
    ).toEqual({ triggerDate: '۱۴۰۵/۰۸/۱۷', triggerTime: '۱۰:۱۵' });

    expect(getPresetLabelFa('2h_before')).toBe('۲ ساعت قبل');
  });

  it('schedules entity reminders, excludes no_show appointments, handles snooze/done states, and deduplicates phone notifications', async () => {
    const today = getCurrentPersianDate();

    // Ensure no_show appointment does not trigger phone push notifications
    const noShowCount = await evaluateAndDispatchDuePhoneNotifications({
      patients: [],
      appointments: [
        {
          id: 'apt-noshow-1',
          patientId: 'pat-1',
          patientName: 'بیمار آزمایشی',
          phone: '۰۹۱۲۰۰۰۰۰۰۰',
          doctor: 'دکتر مهدی امیری',
          unit: 'یونیت آبی',
          treatment: 'معاینه',
          date: getRelativePersianDate(-1),
          time: '۰۹:۰۰',
          durationMinutes: 30,
          status: 'no_show',
          reminderConfig: {
            enabled: true,
            preset: 'at_time',
            channels: ['phone_push']
          }
        }
      ]
    });
    expect(noShowCount).toBe(0);

    const created = scheduleEntityReminder({
      sourceType: 'appointment',
      sourceId: 'apt-test-900',
      patientId: 'pat-1',
      patientName: 'علی مرادی',
      patientPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      title: 'نوبت تحویل روکش',
      description: 'روکش زیرکونیا دندان ۵ بالا راست',
      targetDate: today,
      targetTime: '۰۰:۰۵',
      targetView: 'appointments',
      config: {
        enabled: true,
        preset: 'at_time',
        channels: ['phone_push', 'in_app']
      }
    });

    expect(created).not.toBeNull();
    expect(getCustomReminders().some((r) => r.sourceId === 'apt-test-900')).toBe(true);

    // Snooze check
    snoozeReminder('rem-appointment-apt-test-900', 60);
    expect(isReminderCurrentlySnoozed('rem-appointment-apt-test-900')).toBe(true);

    // Due phone notification evaluation on a separate non-snoozed item + deduplication check
    scheduleEntityReminder({
      sourceType: 'appointment',
      sourceId: 'apt-test-901',
      patientId: 'pat-2',
      patientName: 'سارا علیزاده',
      title: 'نوبت معاینه فوری',
      description: 'ویزیت اورژانسی',
      targetDate: getRelativePersianDate(-1),
      targetTime: '۰۸:۰۰',
      targetView: 'appointments',
      config: {
        enabled: true,
        preset: 'at_time',
        channels: ['phone_push']
      }
    });

    const firstDispatchCount = await evaluateAndDispatchDuePhoneNotifications({
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS
    });
    expect(firstDispatchCount).toBeGreaterThanOrEqual(1);

    // Second run on the same day must deduplicate already-fired reminders
    const secondDispatchCount = await evaluateAndDispatchDuePhoneNotifications({
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS
    });
    expect(secondDispatchCount).toBe(0);

    markReminderDone('rem-appointment-apt-test-901');
    const updated = getCustomReminders().find((r) => r.id === 'rem-appointment-apt-test-901');
    expect(updated?.status).toBe('done');

    // Reopen & unsnooze checks
    reopenReminder('rem-appointment-apt-test-901');
    expect(getCustomReminders().find((r) => r.id === 'rem-appointment-apt-test-901')?.status).toBe('pending');

    unsnoozeReminder('rem-appointment-apt-test-900');
    expect(isReminderCurrentlySnoozed('rem-appointment-apt-test-900')).toBe(false);
  });

  it('synthesizes all 9 clinic reminder pillars sorted by priorityScore, computes analytics, exports UTF-8 CSV, and enforces quiet hours on SMS', async () => {
    const today = getCurrentPersianDate();
    const yesterday = getRelativePersianDate(-1);
    const soonDate = getRelativePersianDate(2);

    const testPatients = [
      {
        ...INITIAL_PATIENTS[0],
        nextRecallDate: today,
        recallMonths: 6,
        sayadChecks: [
          {
            id: 'chk-u-1',
            patientId: INITIAL_PATIENTS[0].id,
            patientName: INITIAL_PATIENTS[0].fullName,
            sayadId: '1111222233334444',
            bankName: 'بانک ملت',
            amount: 15000000,
            dueDate: yesterday,
            drawerName: INITIAL_PATIENTS[0].fullName,
            status: 'bounced' as const,
            isGuarantee: false
          }
        ],
        installments: [
          {
            id: 'inst-u-1',
            patientId: INITIAL_PATIENTS[0].id,
            patientName: INITIAL_PATIENTS[0].fullName,
            treatmentName: 'ایمپلنت کره ای',
            installmentNumber: 2,
            totalInstallments: 4,
            amount: 8000000,
            dueDate: today,
            status: 'pending' as const
          }
        ],
        labOrders: [
          {
            id: 'lab-u-1',
            patientId: INITIAL_PATIENTS[0].id,
            patientName: INITIAL_PATIENTS[0].fullName,
            toothNumber: 'UR6',
            workType: 'روکش زیرکونیا',
            labName: 'لابراتوار پارس',
            shade: 'A2',
            sendDate: yesterday,
            deliveryDate: today,
            appointmentDate: soonDate,
            status: 'ready_for_clinic' as const,
            cost: 3000000,
            reminderNotice: ''
          }
        ],
        implantCases: [
          {
            id: 'imp-u-1',
            patientId: INITIAL_PATIENTS[0].id,
            patientName: INITIAL_PATIENTS[0].fullName,
            toothNumber: 'LR6',
            brand: 'Osstem',
            diameter: '4.5 mm',
            length: '10 mm',
            torque: 45,
            boneGraft: false,
            membrane: false,
            surgeryDate: yesterday,
            healingDueDate: soonDate,
            currentStage: 'fixture_placed' as const,
            notes: 'کنترل ۴۸ ساعته'
          }
        ]
      },
      ...INITIAL_PATIENTS.slice(1)
    ];

    const testInventory = [
      ...INITIAL_INVENTORY,
      {
        id: 'inv-fefo-1',
        name: 'ماده قالب‌گیری سیلیکونی تست',
        category: 'مواد ترمیمی و قالب‌گیری',
        stock: 0,
        minAlert: 3,
        unit: 'بسته',
        pricePerUnit: 1800000,
        expiryDate: soonDate,
        location: 'قفسه A2'
      }
    ];

    const synthesized = synthesizeUnifiedClinicReminders({
      patients: testPatients,
      appointments: INITIAL_APPOINTMENTS,
      inventory: testInventory
    });

    const pillars = new Set(synthesized.map((r) => r.pillar));
    expect(pillars.has('check')).toBe(true);
    expect(pillars.has('installment')).toBe(true);
    expect(pillars.has('lab')).toBe(true);
    expect(pillars.has('implant')).toBe(true);
    expect(pillars.has('recall')).toBe(true);
    expect(pillars.has('appointment')).toBe(true);
    expect(pillars.has('inventory')).toBe(true);

    // Ensure descending priorityScore order
    for (let i = 1; i < synthesized.length; i++) {
      expect(synthesized[i - 1].priorityScore).toBeGreaterThanOrEqual(synthesized[i].priorityScore);
    }

    const summary = getReminderAnalyticsSummary(synthesized);
    expect(summary.totalActive).toBe(synthesized.length);
    expect(summary.criticalCount).toBeGreaterThanOrEqual(2);
    expect(summary.inventoryCount).toBeGreaterThanOrEqual(1);
    expect(summary.recallCount).toBeGreaterThanOrEqual(1);
    expect(summary.financialAtRiskToman).toBeGreaterThanOrEqual(23000000);

    const csv = generateRemindersCsvContent(synthesized);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('اولویت');
    expect(csv).toContain('ماده قالب‌گیری سیلیکونی تست');

    // Overnight quiet hours check (22:00 -> 08:00)
    const savedSettings = saveReminderSettings({
      quietHoursStart: '۲۲:۰۰',
      quietHoursEnd: '۰۸:۰۰',
      respectQuietHours: true
    });
    expect(isWithinQuietHours(savedSettings, new Date(2026, 2, 21, 23, 30, 0))).toBe(true);
    expect(isWithinQuietHours(savedSettings, new Date(2026, 2, 21, 12, 0, 0))).toBe(false);

    // Block auto SMS during active quiet hours while allowing push notification
    const { clinicalSmsService } = await import('../services/smsService');
    const smsSpy = vi.spyOn(clinicalSmsService, 'sendPatternSms');
    saveReminderSettings({
      quietHoursStart: '۰۰:۰۰',
      quietHoursEnd: '۲۳:۵۹',
      respectQuietHours: true
    });
    scheduleEntityReminder({
      sourceType: 'custom',
      sourceId: 'quiet-sms-guard',
      patientId: INITIAL_PATIENTS[0].id,
      patientName: INITIAL_PATIENTS[0].fullName,
      patientPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      title: 'تست سکوت شبانه',
      description: 'نباید پیامک خودکار در ساعت سکوت ارسال شود',
      targetDate: yesterday,
      targetTime: '۱۰:۰۰',
      targetView: 'reminders',
      config: {
        enabled: true,
        preset: 'at_time',
        channels: ['phone_push', 'sms']
      }
    });
    await evaluateAndDispatchDuePhoneNotifications({
      patients: [],
      appointments: []
    });
    expect(smsSpy).not.toHaveBeenCalled();
  });

  it('supports recurring weekly reminders, 11-pillar synthesis (insurance & CSSD), manager escalation, batch triage, patient scoping, and morning digest', () => {
    const today = getCurrentPersianDate();
    const threeDaysAgo = getRelativePersianDate(-3);

    // 1. Recurring weekly custom reminder automatically spawns +7d occurrence on completion
    const recurring = scheduleEntityReminder({
      sourceType: 'custom',
      sourceId: 'rec-weekly-1',
      patientId: INITIAL_PATIENTS[0].id,
      patientName: INITIAL_PATIENTS[0].fullName,
      patientPhone: INITIAL_PATIENTS[0].phone,
      title: 'چک هفتگی بهداشت ایمپلنت',
      description: 'یادآوری تکرارشونده هفتگی',
      targetDate: today,
      targetTime: '۱۱:۰۰',
      targetView: 'reminders',
      config: {
        enabled: true,
        preset: 'at_time',
        channels: ['in_app']
      }
    });
    expect(recurring).not.toBeNull();
    // Persist weekly recurrence on that record
    const currentList = getCustomReminders().map((r) =>
      r.id === recurring!.id ? { ...r, recurrence: 'weekly' as const } : r
    );
    window.localStorage.setItem('minadental_custom_reminders_v1', JSON.stringify(currentList));

    markReminderDone(recurring!.id);
    const afterDone = getCustomReminders();
    expect(afterDone.find((r) => r.id === recurring!.id)?.status).toBe('done');
    const spawned = afterDone.find((r) => r.id !== recurring!.id && r.title === 'چک هفتگی بهداشت ایمپلنت');
    expect(spawned).toBeTruthy();
    expect(spawned?.triggerDate).toBe(addDaysToPersianDate(today, 7));
    expect(spawned?.status).toBe('pending');
    expect(spawned?.recurrence).toBe('weekly');

    // 2. Insurance & CSSD Sterilization pillars + manager_escalation
    window.localStorage.setItem(
      'minadental_insurance_claims_v1',
      JSON.stringify([
        {
          id: 'ins-t-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          insurerName: 'بیمه آسیا',
          serviceName: 'روکش زیرکونیا',
          trackingCode: 'ASIA-9911',
          status: 'pending_review',
          insuranceShare: 4500000,
          date: threeDaysAgo
        }
      ])
    );
    window.localStorage.setItem(
      'minadental_cssd_cycles_v1',
      JSON.stringify([
        {
          id: 'cssd-fail-1',
          autoclaveDevice: 'اتوکلاو کلاس B شماره ۱',
          cycleCode: 'C-405',
          date: today,
          time: '۰۹:۱۵',
          bowieDickResult: 'fail',
          biologicalSporeTest: 'pending_24h'
        }
      ])
    );

    const unified11 = synthesizeUnifiedClinicReminders({
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS,
      inventory: INITIAL_INVENTORY
    });
    const pillarSet = new Set(unified11.map((r) => r.pillar));
    expect(pillarSet.has('insurance')).toBe(true);
    expect(pillarSet.has('sterilization')).toBe(true);

    const cssdItem = unified11.find((r) => r.pillar === 'sterilization');
    expect(cssdItem?.urgency).toBe('critical');
    expect(cssdItem?.escalationLevel).toBe('manager_escalation');

    // 3. Per-patient scoping & morning digest
    const patOnly = getPatientActiveReminders(INITIAL_PATIENTS[0].id, {
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS,
      inventory: INITIAL_INVENTORY
    });
    expect(patOnly.length).toBeGreaterThan(0);
    expect(patOnly.every((r) => r.patientId === INITIAL_PATIENTS[0].id)).toBe(true);

    const digest = generateDailyClinicDigestText(unified11);
    expect(digest).toContain('گزارش صبحگاهی');
    expect(digest).toContain('کنترل عفونت CSSD');

    // 4. Batch snooze & batch mark done
    const idsToBatch = unified11.slice(0, 2).map((r) => r.id);
    batchSnoozeReminders(idsToBatch, 30);
    expect(isReminderCurrentlySnoozed(idsToBatch[0])).toBe(true);
    expect(isReminderCurrentlySnoozed(idsToBatch[1])).toBe(true);

    batchMarkRemindersDone([spawned!.id]);
    expect(getCustomReminders().find((r) => r.id === spawned!.id)?.status).toBe('done');
  });

  it('dispatches phone push notifications for due recall, insurance, and failed CSSD sterilization, respects automationRules, and syncs NotificationDrawer with dismissed state', async () => {
    const today = getCurrentPersianDate();

    window.localStorage.setItem(
      'minadental_insurance_claims_v1',
      JSON.stringify([
        {
          id: 'ins-push-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          insurerName: 'بیمه دانا',
          serviceName: 'جراحی ایمپلنت',
          insuranceShare: 12000000,
          trackingCode: 'DANA-5501',
          date: today,
          status: 'pending_review'
        }
      ])
    );

    window.localStorage.setItem(
      'minadental_cssd_cycles_v1',
      JSON.stringify([
        {
          id: 'cssd-push-1',
          cycleCode: 'AUT-1405-9999',
          autoclaveDevice: 'اتوکلاو کلاس B یوروندا',
          bowieDickResult: 'fail',
          biologicalSporeTest: 'pending_24h',
          date: today,
          time: '۰۸:۰۰'
        }
      ])
    );

    const recallPat = {
      ...INITIAL_PATIENTS[0],
      nextRecallDate: today
    };

    const drawerItemsBefore = buildLiveClinicalNotifications([recallPat], [], new Set(), '27.5.0', []);
    expect(drawerItemsBefore.some((i) => i.id === 'live-ins-ins-push-1')).toBe(true);
    expect(drawerItemsBefore.some((i) => i.id === 'live-cssd-cssd-push-1')).toBe(true);
    expect(drawerItemsBefore.some((i) => i.id === `live-recall-${recallPat.id}`)).toBe(true);

    const dispatched = await evaluateAndDispatchDuePhoneNotifications({
      patients: [recallPat],
      appointments: [],
      inventory: []
    });
    expect(dispatched).toBeGreaterThanOrEqual(3);

    const firedNotifs = (window as unknown as { __dispatchedNotifs: Array<{ title: string }> }).__dispatchedNotifs;
    expect(firedNotifs.some((n) => n.title.includes('قرنطینه فوری اتوکلاو'))).toBe(true);
    expect(firedNotifs.some((n) => n.title.includes('پرونده بیمه'))).toBe(true);
    expect(firedNotifs.some((n) => n.title.includes('فراخوان چکاپ دوره‌ای'))).toBe(true);

    // Dismissing hides item from NotificationDrawer as well
    window.localStorage.setItem(
      'minadental_dismissed_reminders_v1',
      JSON.stringify({ 'live-ins-ins-push-1': true })
    );
    const drawerAfterDismiss = buildLiveClinicalNotifications([recallPat], [], new Set(), '27.5.0', []);
    expect(drawerAfterDismiss.some((i) => i.id === 'live-ins-ins-push-1')).toBe(false);

    // Toggling automation rule off disables auto recall synthesis
    saveReminderSettings({
      automationRules: {
        autoAptConfirm24h: true,
        autoImplantPostOp: true,
        autoCheckAndInstallmentEscalation: true,
        autoCssdQuarantineAlert: true,
        autoRecallInvite: false
      }
    });
    const withoutAutoRecall = synthesizeUnifiedClinicReminders({
      patients: [recallPat],
      appointments: [],
      inventory: []
    });
    expect(withoutAutoRecall.some((r) => r.id === `live-recall-${recallPat.id}`)).toBe(false);
  });

  it('computes predictive no-show risk AI, supports staff assignment, 2-way appointment confirmation, full rule gating (24h & implant), sound alarm persistence, and SMS confirm links', async () => {
    const today = getCurrentPersianDate();
    const tomorrow = getRelativePersianDate(1);

    const riskPat = {
      ...INITIAL_PATIENTS[0],
      balance: -12000000,
      installments: [
        {
          id: 'inst-risk-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          treatmentName: 'ایمپلنت فک پایین',
          installmentNumber: 1,
          totalInstallments: 3,
          amount: 5000000,
          dueDate: today,
          status: 'overdue' as const
        }
      ],
      implantCases: [
        {
          id: 'imp-gate-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          toothNumber: 'LL6',
          brand: 'Straumann',
          diameter: '4.1 mm',
          length: '10 mm',
          torque: 40,
          boneGraft: false,
          membrane: false,
          surgeryDate: today,
          healingDueDate: tomorrow,
          currentStage: 'fixture_placed' as const,
          notes: 'فاز جراحی'
        }
      ]
    };

    const historyApts = [
      {
        ...INITIAL_APPOINTMENTS[0],
        id: 'apt-hist-noshow',
        patientId: riskPat.id,
        patientName: riskPat.fullName,
        date: getRelativePersianDate(-5),
        time: '۱۱:۰۰',
        status: 'no_show' as const
      },
      {
        ...INITIAL_APPOINTMENTS[0],
        id: 'apt-future-auto',
        patientId: riskPat.id,
        patientName: riskPat.fullName,
        date: tomorrow,
        time: '۱۷:۰۰',
        status: 'scheduled' as const,
        reminderConfig: undefined
      }
    ];

    // 1. Predictive No-Show Risk >= 50% + Staff Assignment + 2-Way Confirmation
    assignReminderToStaff('live-apt-apt-future-auto', 'منشی پذیرش');
    expect(getReminderAssignmentsMap()['live-apt-apt-future-auto']).toBe('منشی پذیرش');

    setAppointmentConfirmationStatus('apt-future-auto', 'reschedule_requested');
    expect(getAppointmentConfirmationsMap()['live-apt-apt-future-auto']).toBe('reschedule_requested');

    const withRisk = synthesizeUnifiedClinicReminders({
      patients: [riskPat],
      appointments: historyApts,
      inventory: []
    });
    const futureAptRem = withRisk.find((r) => r.id === 'live-apt-apt-future-auto');
    expect(futureAptRem).toBeTruthy();
    expect(futureAptRem!.assignedTo).toBe('منشی پذیرش');
    expect(futureAptRem!.confirmationStatus).toBe('reschedule_requested');
    expect(futureAptRem!.noShowRiskPercent).toBeGreaterThanOrEqual(60);
    expect(futureAptRem!.riskHint).toContain('تغییر زمان');

    // Clear assignment and mark confirmed_by_patient
    assignReminderToStaff('live-apt-apt-future-auto', undefined);
    setAppointmentConfirmationStatus('live-apt-apt-future-auto', 'confirmed_by_patient');
    const afterConfirmed = synthesizeUnifiedClinicReminders({
      patients: [riskPat],
      appointments: historyApts,
      inventory: []
    }).find((r) => r.id === 'live-apt-apt-future-auto');
    expect(afterConfirmed?.assignedTo).toBeUndefined();
    expect(afterConfirmed?.confirmationStatus).toBe('confirmed_by_patient');

    // 2. Full Automation Rules Gating: disabling autoAptConfirm24h & autoImplantPostOp suppresses both
    saveReminderSettings({
      automationRules: {
        autoAptConfirm24h: false,
        autoImplantPostOp: false,
        autoCheckAndInstallmentEscalation: true,
        autoCssdQuarantineAlert: true,
        autoRecallInvite: true
      }
    });
    const gatedList = synthesizeUnifiedClinicReminders({
      patients: [riskPat],
      appointments: historyApts,
      inventory: []
    });
    expect(gatedList.some((r) => r.id === 'live-apt-apt-future-auto')).toBe(false);
    expect(gatedList.some((r) => r.id === 'live-imp-imp-gate-1')).toBe(false);

    // 3. Sound alarm setting + safe Web Audio fallback in non-AudioContext test runtime
    const savedOff = saveReminderSettings({ enableSoundAlarm: false });
    expect(savedOff.enableSoundAlarm).toBe(false);
    expect(playCriticalAlarmChime('critical')).toBe(false);
    expect(getReminderSettings().enableSoundAlarm).toBe(false);

    // 4. SMS pattern confirmation link + delivery receipt
    const { clinicalSmsService } = await import('../services/smsService');
    const smsResult = await clinicalSmsService.sendPatternSms(
      '۰۹۱۲۳۴۵۶۷۸۹',
      'علی مرادی',
      'appointment_reminder',
      { date: tomorrow, time: '۱۷:۰۰', confirmCode: 'MD-6789' }
    );
    expect(smsResult.success).toBe(true);
    expect(smsResult.deliveryReceipt).toContain('تحویل');
    expect(clinicalSmsService.getLogs()[0].messageText).toContain('minadental.ir/c/MD-6789');
    expect(clinicalSmsService.getDeliveryStats().deliveredCount).toBeGreaterThan(0);
  });
});

describe('MinaDental Live SSR Rendering of AppointmentsView & RemindersView', () => {
  it('renders AppointmentsView cleanly with named units, smart tabs, weekday offsets, filters, clinical alerts, lab readiness, and reminders', () => {
    const html = renderToStaticMarkup(
      React.createElement(AppointmentsView, {
        appointments: INITIAL_APPOINTMENTS,
        patients: INITIAL_PATIENTS,
        onAddAppointment: () => {},
        onUpdateStatus: () => {}
      })
    );

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).toContain('یونیت آبی');
    expect(html).toContain('یونیت زرد');
    expect(html).toContain('یونیت جراحی');
    expect(html).toContain('لیست انتظار');
    expect(html).toContain('شیفت و تعطیلات');
    expect(html).toContain('چاپ روز');
    expect(html).toContain('عدم حضور');
    expect(html).toContain('فیلتر پزشک معالج');
    expect(html).toContain('فیلتر وضعیت نوبت');
    expect(html).toContain('آمار روز:');
    expect(html).toContain('علی مرادی');
    // Clinical history alert & ready lab badge on pat-1 appointment card
    expect(html).toContain('دیابت کنترل شده');
    expect(html).toContain('پروتز آماده مطب');
    // Weekday headers and horizontal strip weekday labels
    expect(html).toContain('شنبه');
    expect(html).toContain('جمعه');
    // Preset reminder badge rendered for appointment
    expect(html).toContain(toPersianDigits('2 ساعت قبل').replace('2', '۲'));
  });

  it('renders RemindersView cleanly with appointment triggers, preset labels, and 1-tap phone notification button', () => {
    const html = renderToStaticMarkup(
      React.createElement(RemindersView, {
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        onOpenAppointments: () => {}
      })
    );

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).toContain('یادآوری نوبت');
    expect(html).toContain('اعلان گوشی');
    expect(html).toContain('علی مرادی');
    expect(html).toContain('امروز');
  });
});

describe('Predictive No-Show Risk & Financial Reports Dataset Engines', () => {
  it('predicts elevated no-show risk from historical no_show/cancelled visits and patient financial/demographic traits', () => {
    const highRiskPatient = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-noshow-unit-1',
      fullName: 'بیمار پرریسک نوبت',
      phone: '09121110000',
      age: 70,
      balance: -12_000_000,
      installments: [
        {
          id: 'inst-ov-1',
          patientId: 'pat-noshow-unit-1',
          patientName: 'بیمار پرریسک نوبت',
          treatmentName: 'ایمپلنت',
          installmentNumber: 1,
          totalInstallments: 4,
          amount: 5_000_000,
          dueDate: '۱۴۰۵/۰۱/۱۰',
          status: 'overdue' as const,
          paymentMethod: 'check' as const
        }
      ],
      sayadChecks: [
        {
          id: 'chk-bounced-1',
          patientId: 'pat-noshow-unit-1',
          patientName: 'بیمار پرریسک نوبت',
          sayadId: '1234567890123456',
          amount: 5_000_000,
          dueDate: '۱۴۰۵/۰۱/۱۰',
          bankName: 'ملی',
          drawerName: 'بیمار پرریسک نوبت',
          isGuarantee: false,
          status: 'bounced' as const
        }
      ]
    };

    const historicalApts = [
      {
        id: 'apt-hist-1',
        patientId: highRiskPatient.id,
        patientName: highRiskPatient.fullName,
        phone: highRiskPatient.phone,
        doctor: 'دکتر مهدی امیری',
        unit: 'یونیت آبی',
        treatment: 'معاینه',
        date: '۱۴۰۵/۰۲/۰۱',
        time: '۱۰:۰۰',
        durationMinutes: 30,
        status: 'no_show' as const
      },
      {
        id: 'apt-hist-2',
        patientId: highRiskPatient.id,
        patientName: highRiskPatient.fullName,
        phone: highRiskPatient.phone,
        doctor: 'دکتر مهدی امیری',
        unit: 'یونیت آبی',
        treatment: 'معاینه',
        date: '۱۴۰۵/۰۳/۰۱',
        time: '۱۲:۰۰',
        durationMinutes: 30,
        status: 'cancelled' as const
      }
    ];

    const highResult = predictAppointmentNoShowRisk({
      patient: highRiskPatient,
      appointments: historicalApts,
      targetTime: '۲۰:۰۰'
    });

    expect(highResult.level).toBe('high');
    expect(highResult.probabilityPercent).toBeGreaterThanOrEqual(55);
    expect(highResult.noShowCount).toBe(1);
    expect(highResult.cancelledCount).toBe(1);
    expect(highResult.reasons.some((r) => r.includes('عدم حضور'))).toBe(true);
    expect(highResult.reasons.some((r) => r.includes('قسط درمانی معوقه'))).toBe(true);
    expect(highResult.recommendations.length).toBeGreaterThan(0);

    const lowRiskPatient = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-reliable-1',
      fullName: 'بیمار منظم',
      phone: '09123334455',
      age: 34,
      balance: 0,
      installments: [],
      sayadChecks: []
    };
    const lowResult = predictAppointmentNoShowRisk({
      patient: lowRiskPatient,
      appointments: [
        {
          id: 'apt-ok-1',
          patientId: lowRiskPatient.id,
          patientName: lowRiskPatient.fullName,
          phone: lowRiskPatient.phone,
          doctor: 'دکتر مهدی امیری',
          unit: 'یونیت آبی',
          treatment: 'جرم‌گیری',
          date: '۱۴۰۵/۰۴/۱۰',
          time: '۱۱:۰۰',
          durationMinutes: 30,
          status: 'completed' as const
        }
      ],
      targetTime: '۱۱:۰۰'
    });

    expect(lowResult.level).toBe('low');
    expect(lowResult.probabilityPercent).toBeLessThan(30);
    expect(lowResult.completedCount).toBe(1);
  });

  it('aggregates payments and installments into monthly realized/projected income and cash/pos/check breakdown without NaN', () => {
    const samplePatients = [
      {
        ...INITIAL_PATIENTS[0],
        id: 'fin-rep-pat-1',
        fullName: 'بیمار گزارش مالی',
        payments: [
          {
            id: 'p-1',
            patientId: 'fin-rep-pat-1',
            patientName: 'بیمار گزارش مالی',
            amount: 4_000_000,
            date: '۱۴۰۵/۰۵/۱۰',
            method: 'cash' as const,
            forTreatment: 'ترمیم'
          },
          {
            id: 'p-2',
            patientId: 'fin-rep-pat-1',
            patientName: 'بیمار گزارش مالی',
            amount: 6_000_000,
            date: '۱۴۰۵/۰۵/۱۲',
            method: 'pos' as const,
            forTreatment: 'عصب‌کشی'
          }
        ],
        installments: [
          {
            id: 'i-paid',
            patientId: 'fin-rep-pat-1',
            patientName: 'بیمار گزارش مالی',
            treatmentName: 'ارتودنسی',
            installmentNumber: 1,
            totalInstallments: 3,
            amount: 3_000_000,
            dueDate: '۱۴۰۵/۰۵/۰۱',
            status: 'paid' as const,
            paymentMethod: 'pos' as const
          },
          {
            id: 'i-pending',
            patientId: 'fin-rep-pat-1',
            patientName: 'بیمار گزارش مالی',
            treatmentName: 'ایمپلنت',
            installmentNumber: 2,
            totalInstallments: 3,
            amount: 5_000_000,
            dueDate: '۱۴۰۵/۰۶/۱۵',
            status: 'pending' as const,
            paymentMethod: 'check' as const
          },
          {
            id: 'i-overdue',
            patientId: 'fin-rep-pat-1',
            patientName: 'بیمار گزارش مالی',
            treatmentName: 'پروتز',
            installmentNumber: 3,
            totalInstallments: 3,
            amount: 2_000_000,
            dueDate: '۱۴۰۵/۰۵/۲۰',
            status: 'overdue' as const,
            paymentMethod: 'cash' as const
          }
        ]
      }
    ];

    const summary = buildFinancialReportsDataset(samplePatients);
    expect(summary.totalRealizedIncome).toBe(10_000_000);
    expect(summary.totalProjectedInstallments).toBe(7_000_000);
    expect(summary.totalOverdueInstallments).toBe(2_000_000);
    expect(summary.totalExpectedRevenue).toBe(17_000_000);
    expect(summary.paidInstallmentsCount).toBe(1);
    expect(summary.unpaidInstallmentsCount).toBe(2);

    const month5 = summary.monthlySeries.find((m) => m.monthKey === '1405-05');
    const month6 = summary.monthlySeries.find((m) => m.monthKey === '1405-06');
    expect(month5?.realizedIncome).toBe(10_000_000);
    expect(month5?.projectedInstallments).toBe(2_000_000);
    expect(month6?.projectedInstallments).toBe(5_000_000);

    const realizedCash = summary.paymentMethodsRealized.find((x) => x.method === 'cash');
    const realizedPos = summary.paymentMethodsRealized.find((x) => x.method === 'pos');
    const combinedCheck = summary.paymentMethodsCombined.find((x) => x.method === 'check');
    expect(realizedCash?.amount).toBe(4_000_000);
    expect(realizedPos?.amount).toBe(6_000_000);
    expect(combinedCheck?.amount).toBe(5_000_000);

    const csv = generateFinancialReportsCsvContent(summary);
    expect(csv).toContain('درآمد وصول‌شده');
    expect(csv).not.toContain('NaN');
  });

  it('evaluates live CDSS endo differential, perio risk, systemic safety, 4-phase treatment roadmap, and clinic treatment queue', () => {
    const endoMismatch = evaluateEndodonticDiagnosis({
      coldTest: 'پالپیت غیرقابل‌برگشت',
      percussion: 'مثبت (+)',
      palpation: 'منفی (-)',
      selectedTreatment: 'composite'
    });
    expect(endoMismatch.urgency).toBe('emergency');
    expect(endoMismatch.aaeDiagnosis).toContain('پالپیت غیرقابل‌برگشت');
    expect(endoMismatch.clinicalWarning).toContain('بدون درمان ریشه');

    const perioHigh = evaluatePeriodontalRisk({
      pockets: { MB: 6, B: 5, DB: 6, ML: 4, L: 3, DL: 5 },
      mobility: 'II',
      bop: true,
      plannedTreatment: 'crown_zirconia'
    });
    expect(perioHigh.riskLevel).toBe('high');
    expect(perioHigh.maxPocketMm).toBe(6);
    expect(perioHigh.prostheticWarning).toContain('پریو-پروتز');

    const cardiacAllergicPat = {
      ...INITIAL_PATIENTS[0],
      medicalHistory: ['فشار خون و سابقه قلبی', 'حساسیت به پنی‌سیلین', 'مصرف وارفارین'],
      teethConditions: {
        UR_6: {
          quadrant: 'UR' as const,
          toothNumber: 6,
          surfaces: ['occlusal' as const],
          treatment: 'crown_zirconia' as const,
          status: 'planned' as const,
          cost: 4800000,
          vitalityMetrics: {
            coldTest: 'نکروز (بدون پاسخ)' as const,
            percussion: 'مثبت (+)' as const,
            palpation: 'منفی (-)' as const,
            eptScore: '80/80'
          }
        },
        UL_1: {
          quadrant: 'UL' as const,
          toothNumber: 1,
          surfaces: ['buccal' as const],
          treatment: 'laminate' as const,
          status: 'planned' as const,
          cost: 5500000
        },
        LR_1: {
          quadrant: 'LR' as const,
          toothNumber: 1,
          surfaces: ['buccal' as const],
          treatment: 'bleaching' as const,
          status: 'in_progress' as const,
          cost: 3500000
        },
        LL_7: {
          quadrant: 'LL' as const,
          toothNumber: 7,
          surfaces: ['occlusal' as const],
          treatment: 'extraction' as const,
          status: 'planned' as const,
          cost: 1500000
        }
      }
    };

    const safety = evaluatePatientTreatmentSafety({
      patient: cardiacAllergicPat,
      weightKg: 75,
      plannedTreatment: 'extraction'
    });
    expect(safety.hasCardiacRisk).toBe(true);
    expect(safety.hasPenicillinAllergy).toBe(true);
    expect(safety.hasBleedingRisk).toBe(true);
    expect(safety.anestheticLimit.maxCarpules).toBeLessThanOrEqual(2);
    expect(safety.safeAntibiotic).toContain('کلیندامایسین');
    expect(safety.safeAnalgesic).toContain('استامینوفن');

    const roadmap = buildPhasedTreatmentRoadmap(cardiacAllergicPat);
    expect(roadmap.totalPlannedCost).toBe(15_300_000);
    expect(roadmap.sequencingAlerts.some((a) => a.id.includes('seq-endo-crown'))).toBe(true);
    expect(roadmap.sequencingAlerts.some((a) => a.id === 'seq-bleach-shade')).toBe(true);
    expect(roadmap.sequencingAlerts.some((a) => a.id === 'seq-bleeding-ext')).toBe(true);

    const queue = buildClinicTreatmentQueue([cardiacAllergicPat]);
    expect(queue.length).toBe(4);
    expect(queue[0].hasClinicalAlert || queue[0].priorityLevel === 'urgent_pain').toBe(true);

    const molarEndoProto = getTreatmentClinicalProtocol('endo', 6, ['occlusal', 'rootCanal']);
    expect(molarEndoProto.chairMinutes).toBeGreaterThanOrEqual(75);
    expect(molarEndoProto.isolationRequired).toBe('رابردم الزامی');
  });
});

describe('Guarantee Check, Sayad Check & Debtor Reminder Engine', () => {
  const origWindow = globalThis.window;

  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = origWindow;
    vi.restoreAllMocks();
  });

  it('separates Guarantee Checks (ready-for-return vs safe custody), applies guaranteeCheckAdvanceDays and debtorMinAlertToman thresholds, and surfaces Debtors in NotificationDrawer', () => {
    const today = getCurrentPersianDate();

    const patReadyGuarantee = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-guar-ready',
      fullName: 'بیمار آماده عودت ضمانت',
      balance: 0,
      totalCost: 15_000_000,
      paidAmount: 15_000_000,
      installments: [
        {
          id: 'inst-paid-guar',
          patientId: 'pat-guar-ready',
          patientName: 'بیمار آماده عودت ضمانت',
          treatmentName: 'ایمپلنت کامل',
          installmentNumber: 1,
          totalInstallments: 1,
          amount: 15_000_000,
          dueDate: today,
          status: 'paid' as const,
          paymentMethod: 'check' as const
        }
      ],
      sayadChecks: [
        {
          id: 'chk-guar-1',
          patientId: 'pat-guar-ready',
          patientName: 'بیمار آماده عودت ضمانت',
          sayadId: '9988776655443322',
          bankName: 'بانک سامان',
          amount: 20_000_000,
          dueDate: addDaysToPersianDate(today, 10),
          drawerName: 'بیمار آماده عودت ضمانت',
          status: 'in_collection' as const,
          isGuarantee: true
        }
      ]
    };

    const patDebtorWithCheck = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-debt-low',
      fullName: 'بیمار بدهی کم‌مبلغ',
      balance: -800_000,
      totalCost: 2_800_000,
      paidAmount: 2_000_000,
      installments: [],
      sayadChecks: [
        {
          id: 'chk-sayad-custom',
          patientId: 'pat-debt-low',
          patientName: 'بیمار بدهی کم‌مبلغ',
          sayadId: '1122334455667788',
          bankName: 'بانک ملت',
          amount: 2_000_000,
          dueDate: addDaysToPersianDate(today, 6),
          drawerName: 'بیمار بدهی کم‌مبلغ',
          status: 'in_collection' as const,
          isGuarantee: false,
          reminderConfig: {
            enabled: true,
            preset: '1w_before' as const,
            channels: ['phone_push', 'sms'] as Array<'phone_push' | 'in_app' | 'sms'>
          }
        }
      ]
    };

    const savedSettings = saveReminderSettings({
      guaranteeCheckAdvanceDays: 7,
      debtorMinAlertToman: 0
    });
    expect(savedSettings.guaranteeCheckAdvanceDays).toBe(7);

    const unified = synthesizeUnifiedClinicReminders({
      patients: [patReadyGuarantee, patDebtorWithCheck],
      appointments: []
    });

    const guarItem = unified.find(r => r.sourceEntityId === 'chk-guar-1');
    expect(guarItem).toBeTruthy();
    expect(guarItem!.isGuaranteeCheck).toBe(true);
    expect(guarItem!.isGuaranteeReadyForReturn).toBe(true);
    expect(guarItem!.targetSubModule).toBe('guarantee_checks');

    const sayadCustom = unified.find(r => r.sourceEntityId === 'chk-sayad-custom');
    expect(sayadCustom).toBeTruthy();
    expect(sayadCustom!.isGuaranteeCheck).toBe(false);
    expect(sayadCustom!.targetSubModule).toBe('sayad_checks');
    expect(sayadCustom!.urgency).toBe('high'); // 6 days away within custom 1w_before (7d) window
    expect(sayadCustom!.channelsLabel).toContain('پیامک');

    const debtItem = unified.find(r => r.id === 'live-debt-pat-debt-low');
    expect(debtItem).toBeTruthy();
    expect(debtItem!.targetSubModule).toBe('debtors');

    const drawerBefore = buildLiveClinicalNotifications([patReadyGuarantee, patDebtorWithCheck], [], new Set());
    expect(drawerBefore.some(n => n.id === 'live-debt-pat-debt-low' && n.actionModule === 'debtors')).toBe(true);

    // Setting debtorMinAlertToman = 5,000,000 filters out 800,000 debtor in both engine & drawer
    saveReminderSettings({ debtorMinAlertToman: 5_000_000 });
    const filteredUnified = synthesizeUnifiedClinicReminders({
      patients: [patReadyGuarantee, patDebtorWithCheck],
      appointments: []
    });
    expect(filteredUnified.some(r => r.id === 'live-debt-pat-debt-low')).toBe(false);

    const drawerAfter = buildLiveClinicalNotifications([patReadyGuarantee, patDebtorWithCheck], [], new Set());
    expect(drawerAfter.some(n => n.id === 'live-debt-pat-debt-low')).toBe(false);
  });
});



