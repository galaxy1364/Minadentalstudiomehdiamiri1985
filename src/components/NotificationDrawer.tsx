import React, { useState, useRef, useMemo } from 'react';
import {
  X, Bell, CheckCheck, CalendarDays,
  FolderOpen, Sparkles, Send, CheckCircle2, ChevronLeft, Smartphone, AlarmClock, Check
} from 'lucide-react';
import { toPersianDigits, formatToman, getCurrentPersianDate, isSamePersianDate, comparePersianDates, diffPersianDays } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { otaUpdateService } from '../services/otaUpdateService';
import { syncEngine } from '../services/syncEngine';
import { clinicalSmsService, SmsLogItem } from '../services/smsService';
import {
  broadcastReminderMeshSync,
  getCustomReminders,
  getPhoneNotificationPermission,
  getReminderAssignmentsMap,
  getSnoozedMap,
  markReminderDone,
  PhoneNotificationPermissionState,
  requestPhoneNotificationPermission,
  sendPhoneNotification,
  snoozeReminder
} from '../services/reminderNotificationService';

import { Patient, Appointment, InventoryItem } from '../types/dental';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patients?: Patient[];
  appointments?: Appointment[];
  inventory?: InventoryItem[];
  onNavigateToModule?: (viewId: string) => void;
  onOpenPatientFile?: (patient: Patient, tab?: 'treatments' | 'financial' | 'lab' | 'implant') => void;
  onScheduleSmartAppointment?: (draft: { patientName: string; phone: string; treatment: string; unit?: string }) => void;
  onUnreadCountChange?: (count: number) => void;
}

export interface NotificationItem {
  id: string;
  category: 'urgent' | 'lab' | 'financial' | 'implant' | 'inventory' | 'sync';
  title: string;
  description: string;
  time: string;
  isRead: boolean;
  actionLabel?: string;
  actionModule?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  patientTab?: 'treatments' | 'financial' | 'lab' | 'implant';
  smsPattern?: SmsLogItem['patternType'];
  smsTokens?: Record<string, string>;
  suggestedTreatment?: string;
}

const READ_STORAGE_KEY = 'minadental_read_notif_ids_v1';

const FAST_PERSIAN_NUM_CACHE = new Map<number, string>();
function fastPersianNumber(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const cached = FAST_PERSIAN_NUM_CACHE.get(safe);
  if (cached !== undefined) return cached;
  const formatted = toPersianDigits(String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  if (FAST_PERSIAN_NUM_CACHE.size < 512) {
    FAST_PERSIAN_NUM_CACHE.set(safe, formatted);
  }
  return formatted;
}

function fastFormatToman(amount: number): string {
  return `${fastPersianNumber(amount)} تومان`;
}

let cachedDayStamp = -1;
let cachedTodayJalali = '';
function getFastTodayJalali(): string {
  const now = new Date();
  const stamp = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  if (stamp !== cachedDayStamp || !cachedTodayJalali) {
    cachedDayStamp = stamp;
    cachedTodayJalali = getCurrentPersianDate(now);
  }
  return cachedTodayJalali;
}

export function buildLiveClinicalNotifications(
  patients: Patient[] = [],
  appointments: Appointment[] = [],
  readIds: Set<string> = new Set(),
  otaVersion: string = '27.5.0',
  inventory: InventoryItem[] = []
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const todayJalali = getFastTodayJalali();
  let debtorMinThreshold = 0;
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) {
    try {
      const rawMin = window.localStorage.getItem('minadental_debtor_min_alert_toman');
      if (rawMin !== null) {
        const parsed = Number(rawMin);
        if (Number.isFinite(parsed) && parsed > 0) debtorMinThreshold = parsed;
      }
    } catch {}
  }

  // 1. Live Appointments: On Chair -> Urgent, Waiting -> Urgent, Today's Scheduled -> Urgent/Reminder
  appointments.forEach((apt) => {
    if (apt.status === 'cancelled' || apt.status === 'completed') return;
    if (apt.status === 'in_chair') {
      const id = `live-apt-chair-${apt.id}`;
      items.push({
        id,
        category: 'urgent',
        title: `بیمار روی یونیت (${apt.unit}) — ${apt.patientName}`,
        description: `درمان «${apt.treatment}» با ${apt.doctor} در حال انجام است. آماده صدور قبض و تسویه حساب در پذیرش.`,
        time: toPersianDigits(apt.time),
        isRead: readIds.has(id),
        actionLabel: 'ورود به نوبت‌دهی / تسویه',
        actionModule: 'appointments',
        patientId: apt.patientId,
        patientName: apt.patientName,
        patientPhone: apt.phone,
        patientTab: 'financial'
      });
    } else if (apt.status === 'waiting') {
      const id = `live-apt-wait-${apt.id}`;
      items.push({
        id,
        category: 'urgent',
        title: `حاضر در سالن انتظار — ${apt.patientName}`,
        description: `نوبت ساعت ${toPersianDigits(apt.time)} در ${apt.unit} (${apt.treatment}) منتظر فراخوان به یونیت است.`,
        time: toPersianDigits(apt.time),
        isRead: readIds.has(id),
        actionLabel: 'فراخوان به یونیت',
        actionModule: 'appointments',
        patientId: apt.patientId,
        patientName: apt.patientName,
        patientPhone: apt.phone,
        patientTab: 'treatments'
      });
    } else if (apt.status === 'scheduled' && isSamePersianDate(apt.date, todayJalali)) {
      const id = `live-apt-today-${apt.id}`;
      items.push({
        id,
        category: 'urgent',
        title: `نوبت امروز (${toPersianDigits(apt.time)}) — ${apt.patientName}`,
        description: `${apt.treatment} در ${apt.unit} توسط ${apt.doctor}. ارسال پیامک یادآوری تایید نوبت.`,
        time: `امروز ${toPersianDigits(apt.time)}`,
        isRead: readIds.has(id),
        actionLabel: 'ارسال پیامک یادآوری نوبت',
        actionModule: 'appointments',
        patientId: apt.patientId,
        patientName: apt.patientName,
        patientPhone: apt.phone,
        patientTab: 'treatments',
        smsPattern: 'appointment_reminder',
        smsTokens: { date: toPersianDigits(apt.date), time: toPersianDigits(apt.time) }
      });
    }
  });

  // 2. Live Patient Clinical Data: Sayad Checks, Guarantee Checks, Installments, Lab Orders, Implants
  patients.forEach((p) => {
    const patInsts = p.installments || [];
    const patUnpaidInstsCount = patInsts.filter(i => i.status !== 'paid').length;
    const patChecks = p.sayadChecks || [];

    patChecks.forEach((chk) => {
      if (chk.status === 'in_collection' || chk.status === 'bounced') {
        const id = `live-chk-${chk.id}`;
        const isGuaranteeReady =
          Boolean(chk.isGuarantee) && chk.status !== 'bounced' && patUnpaidInstsCount === 0 && p.balance >= 0;
        const amtText = fastPersianNumber(chk.amount);
        const dueText = toPersianDigits(chk.dueDate);
        items.push({
          id,
          category: 'financial',
          title:
            chk.status === 'bounced'
              ? `هشدار فوری برگشت ${chk.isGuarantee ? 'چک ضمانت امانی' : 'چک صیادی'} — ${p.fullName}`
              : isGuaranteeReady
                ? `چک ضمانت آماده عودت به بیمار — ${p.fullName}`
                : `${chk.isGuarantee ? 'چک ضمانت امانی' : 'سررسید چک صیادی'} — ${p.fullName}`,
          description: isGuaranteeReady
            ? `تمام اقساط بیمار تسویه شده است. چک ضمانت ${chk.bankName} به مبلغ ${amtText} تومان آماده تحویل به بیمار است.`
            : `چک ${chk.bankName} به مبلغ ${amtText} تومان در تاریخ ${dueText}.`,
          time: dueText,
          isRead: readIds.has(id),
          actionLabel: isGuaranteeReady
            ? 'ثبت عودت ضمانت'
            : chk.status === 'bounced'
              ? 'ارسال پیامک یادآوری چک'
              : chk.isGuarantee
                ? 'مدیریت چک ضمانت'
                : 'مشاهده چک صیادی',
          actionModule: chk.isGuarantee ? 'guarantee_checks' : 'sayad_checks',
          patientId: p.id,
          patientName: p.fullName,
          patientPhone: p.phone,
          patientTab: 'financial',
          smsPattern: 'sayad_check_due',
          smsTokens: { amount: amtText, dueDate: dueText }
        });
      }
    });

    patInsts.forEach((inst) => {
      if (inst.status === 'overdue' || inst.status === 'pending') {
        const id = `live-inst-${inst.id}`;
        const linkedSayad = patChecks.find(c => !c.isGuarantee && (c.id.includes(inst.id) || c.amount === inst.amount));
        const guaranteeChk = patChecks.find(c => c.isGuarantee);
        const collateralText = linkedSayad
          ? `چک صیادی ${linkedSayad.bankName}`
          : guaranteeChk
            ? `چک ضمانت امانی`
            : 'تعهد پرونده';
        const amtText = fastPersianNumber(inst.amount);
        const dueText = toPersianDigits(inst.dueDate);
        items.push({
          id,
          category: 'financial',
          title:
            inst.status === 'overdue'
              ? `قسط معوقه درمان — ${p.fullName}`
              : `قسط پیش‌رو (${toPersianDigits(inst.installmentNumber)} از ${toPersianDigits(inst.totalInstallments)}) — ${p.fullName}`,
          description: `بابت «${inst.treatmentName}» (${collateralText}) به مبلغ ${amtText} تومان · سررسید ${dueText}.`,
          time: dueText,
          isRead: readIds.has(id),
          actionLabel: inst.status === 'overdue' ? 'ارسال پیامک یادآوری قسط' : 'مشاهده دفتر اقساط',
          actionModule: 'installments',
          patientId: p.id,
          patientName: p.fullName,
          patientPhone: p.phone,
          patientTab: 'financial',
          smsPattern: 'installment_due',
          smsTokens: { amount: amtText, dueDate: dueText }
        });
      }
    });

    const patientDebt = Math.max(0, (p.totalCost || 0) - (p.paidAmount || 0), p.balance < 0 ? Math.abs(p.balance) : 0);
    if (patientDebt > 0 && patientDebt >= debtorMinThreshold) {
      const debtId = `live-debt-${p.id}`;
      const formattedDebt = fastFormatToman(patientDebt);
      items.push({
        id: debtId,
        category: 'financial',
        title: `بدهی پرونده مطب — ${p.fullName}`,
        description: `مانده بدهی فعلی بیمار ${formattedDebt} است. ارسال پیامک یادآوری یا ثبت دریافتی در صندوق.`,
        time: formattedDebt,
        isRead: readIds.has(debtId),
        actionLabel: 'مشاهده بدهکاران',
        actionModule: 'debtors',
        patientId: p.id,
        patientName: p.fullName,
        patientPhone: p.phone,
        patientTab: 'financial',
        smsPattern: 'installment_due',
        smsTokens: { amount: formattedDebt, dueDate: todayJalali }
      });
    }

    (p.labOrders || []).forEach((lo) => {
      if (lo.status === 'ready_for_clinic' || lo.status === 'frame_try_in') {
        const id = `live-lab-${lo.id}`;
        items.push({
          id,
          category: 'lab',
          title:
            lo.status === 'ready_for_clinic'
              ? `آماده تحویل از لابراتوار — ${p.fullName}`
              : `نوبت پرو فریم‌ورک لابراتوار — ${p.fullName}`,
          description: `${lo.workType} دندان ${toPersianDigits(lo.toothNumber)} (${lo.labName}) آماده پیگیری در مطب است.`,
          time: toPersianDigits(lo.deliveryDate || lo.sendDate || 'امروز'),
          isRead: readIds.has(id),
          actionLabel: 'ورود به ماژول لابراتوار',
          actionModule: 'lab',
          patientId: p.id,
          patientName: p.fullName,
          patientPhone: p.phone,
          patientTab: 'lab',
          suggestedTreatment: `${lo.status === 'ready_for_clinic' ? 'تحویل و سمان' : 'پرو فریم‌ورک'} ${lo.workType} (${lo.toothNumber})`
        });
      }
    });

    (p.implantCases || []).forEach((imp) => {
      if (imp.currentStage !== 'crown_delivered') {
        const id = `live-imp-${imp.id}-${imp.currentStage}`;
        items.push({
          id,
          category: 'implant',
          title: `فراخوان مرحله ایمپلنت (${imp.brand}) — ${p.fullName}`,
          description: `دندان ${toPersianDigits(imp.toothNumber)} · تاریخ جراحی ${toPersianDigits(imp.surgeryDate)} · موعد هیلینگ/قالب‌گیری: ${toPersianDigits(imp.healingDueDate || todayJalali)}.`,
          time: toPersianDigits(imp.healingDueDate || imp.surgeryDate),
          isRead: readIds.has(id),
          actionLabel: 'ثبت مرحله در ایمپلنت',
          actionModule: 'implant',
          patientId: p.id,
          patientName: p.fullName,
          patientPhone: p.phone,
          patientTab: 'implant',
          suggestedTreatment: `ادامه مرحله ایمپلنت ${imp.brand} (${imp.toothNumber})`
        });
      }
    });
    if (p.nextRecallDate && diffPersianDays(todayJalali, p.nextRecallDate) <= 7) {
      const recId = `live-recall-${p.id}`;
      items.push({
        id: recId,
        category: 'urgent',
        title: `فراخوان چکاپ دوره‌ای — ${p.fullName}`,
        description: `موعد معاینه دوره‌ای هر ${toPersianDigits(p.recallMonths || 6)} ماه (${toPersianDigits(p.nextRecallDate)}) فرا رسیده است.`,
        time: toPersianDigits(p.nextRecallDate),
        isRead: readIds.has(recId),
        actionLabel: 'رزرو نوبت ریکال',
        actionModule: 'appointments',
        patientId: p.id,
        patientName: p.fullName,
        patientPhone: p.phone,
        patientTab: 'treatments',
        suggestedTreatment: 'معاینه دوره‌ای و جرم‌گیری ریکال'
      });
    }
  });

  // 3. Low Stock & Near-Expiry FEFO Inventory Alerts
  inventory.forEach((inv) => {
    const isLow = inv.stock <= inv.minAlert;
    const daysToExp = inv.expiryDate ? diffPersianDays(todayJalali, inv.expiryDate) : 999;
    const isNearExp = Boolean(inv.expiryDate) && daysToExp <= 30;
    if (isLow || isNearExp) {
      const id = `live-inv-${inv.id}`;
      items.push({
        id,
        category: 'inventory',
        title: isLow ? `کسری موجودی انبار — ${inv.name}` : `انقضای نزدیک FEFO — ${inv.name}`,
        description: isLow
          ? `موجودی فعلی ${toPersianDigits(inv.stock)} ${inv.unit} (حداقل مجاز ${toPersianDigits(inv.minAlert)} ${inv.unit}). نیاز به ثبت سفارش خرید از تأمین‌کننده.`
          : `تاریخ انقضا ${toPersianDigits(inv.expiryDate)} (${daysToExp <= 0 ? 'منقضی‌شده' : `${toPersianDigits(daysToExp)} روز مانده`}). اولویت مصرف FEFO.`,
        time: inv.location || 'انبار مطب',
        isRead: readIds.has(id),
        actionLabel: 'سفارش از انبار',
        actionModule: 'inventory'
      });
    }
  });

  // 4. Scheduled Module & Custom Reminders (excluding snoozed/done)
  const snoozedMap = hasWindow ? getSnoozedMap() : {};
  const nowMs = Date.now();
  if (hasWindow) {
    getCustomReminders().forEach((rec) => {
      const snoozedUntil = snoozedMap[rec.id];
      if (rec.status === 'done' || (snoozedUntil && nowMs < snoozedUntil)) return;
    if (comparePersianDates(rec.triggerDate, todayJalali) > 1) return;
    const cat: NotificationItem['category'] =
      rec.sourceType === 'lab'
        ? 'lab'
        : rec.sourceType === 'implant'
        ? 'implant'
        : rec.sourceType === 'inventory'
        ? 'inventory'
        : rec.sourceType === 'check' || rec.sourceType === 'installment' || rec.sourceType === 'payment' || rec.sourceType === 'insurance'
        ? 'financial'
        : 'urgent';
    items.push({
      id: rec.id,
      category: cat,
      title: `یادآور: ${rec.title} — ${rec.patientName}`,
      description: rec.description,
      time: `${toPersianDigits(rec.triggerDate)}${rec.triggerTime ? ` (${toPersianDigits(rec.triggerTime)})` : ''}`,
      isRead: readIds.has(rec.id),
      actionLabel: rec.targetView === 'lab' ? 'باز کردن لابراتوار' : rec.targetView === 'financial' ? 'باز کردن مالی' : 'مشاهده یادآوری‌ها',
      actionModule: rec.targetView || 'reminders',
      patientId: rec.patientId,
      patientName: rec.patientName,
      patientPhone: rec.patientPhone
    });
    });
  }

  // 4B. Live Insurance Claims Pending XML / Delayed Settlement
  try {
    if (typeof window !== 'undefined') {
      const rawClaims = window.localStorage.getItem('minadental_insurance_claims_v1');
      if (rawClaims) {
        const claims = JSON.parse(rawClaims) as Array<{
          id: string;
          patientId?: string;
          patientName: string;
          insurerName: string;
          serviceName: string;
          insuranceShare: number;
          trackingCode: string;
          date: string;
          status: 'pending_review' | 'submitted_xml' | 'paid_settled';
        }>;
        if (Array.isArray(claims)) {
          claims.forEach((clm) => {
            if (!clm || clm.status === 'paid_settled') return;
            const daysElapsed = clm.date ? diffPersianDays(clm.date, todayJalali) : 0;
            if (clm.status === 'submitted_xml' && daysElapsed < 7) return;
            const id = `live-ins-${clm.id}`;
            items.push({
              id,
              category: 'financial',
              title:
                clm.status === 'pending_review'
                  ? `معرفی‌نامه بیمه آماده XML (${clm.insurerName}) — ${clm.patientName}`
                  : `پیگیری وصول خسارت بیمه (${clm.insurerName}) — ${clm.patientName}`,
              description: `${clm.serviceName} · سهم بیمه ${formatToman(clm.insuranceShare)} · کد رهگیری ${toPersianDigits(clm.trackingCode)}.`,
              time: toPersianDigits(clm.date || todayJalali),
              isRead: readIds.has(id),
              actionLabel: 'بررسی پرونده بیمه',
              actionModule: 'insurance_claims',
              patientId: clm.patientId,
              patientName: clm.patientName,
              patientTab: 'financial'
            });
          });
        }
      }
    }
  } catch {}

  // 4C. Live CSSD Sterilization Bowie-Dick & Biological Spore Alerts
  try {
    if (typeof window !== 'undefined') {
      const rawCssd = window.localStorage.getItem('minadental_cssd_cycles_v1');
      if (rawCssd) {
        const cycles = JSON.parse(rawCssd) as Array<{
          id: string;
          cycleCode: string;
          autoclaveDevice: string;
          bowieDickResult: 'pass' | 'fail' | 'pending';
          biologicalSporeTest: 'negative_safe' | 'pending_24h';
          date: string;
          time: string;
        }>;
        if (Array.isArray(cycles)) {
          cycles.forEach((cyc) => {
            if (!cyc) return;
            const isFail = cyc.bowieDickResult === 'fail';
            const isPending = cyc.bowieDickResult === 'pending' || cyc.biologicalSporeTest === 'pending_24h';
            if (!isFail && !isPending) return;
            const id = `live-cssd-${cyc.id}`;
            items.push({
              id,
              category: 'urgent',
              title: isFail
                ? `آژیر قرنطینه اتوکلاو CSSD (${cyc.cycleCode})`
                : `تست اسپور بیولوژیک در انتظار (${cyc.cycleCode})`,
              description: `${cyc.autoclaveDevice} · ${
                isFail ? 'خطای تست Bowie-Dick — پک‌ها قرنطینه شوند!' : 'نیاز به ثبت جواب تست اسپور ۲۴ ساعته.'
              }`,
              time: toPersianDigits(cyc.time || cyc.date || todayJalali),
              isRead: readIds.has(id),
              actionLabel: 'کنترل عفونت CSSD',
              actionModule: 'sterilization'
            });
          });
        }
      }
    }
  } catch {}

  // 5. Live Cloud Sync & Auto-Update OTA Status
  const syncId = `live-ota-${otaVersion}`;
  items.push({
    id: syncId,
    category: 'sync',
    title: `آپدیت خودکار OTA و همگام‌سازی ابری فعال (v${otaVersion})`,
    description: 'سرویس‌ورکر و کانال همگام‌سازی روی آیفون، اندروید و نوت ۸ متصل است و رکوردها در لحظه ذخیره می‌شوند.',
    time: 'زنده',
    isRead: readIds.has(syncId),
    actionLabel: 'وضعیت ابر و بک‌آپ',
    actionModule: 'settings'
  });

  if (!hasWindow) {
    return items;
  }

  let dismissedMap: Record<string, boolean> = {};
  try {
    const rawDis = window.localStorage.getItem('minadental_dismissed_reminders_v1');
    if (rawDis) dismissedMap = JSON.parse(rawDis) || {};
  } catch {}

  return items.filter((item) => {
    const until = snoozedMap[item.id];
    return !(until && nowMs < until) && !dismissedMap[item.id];
  });
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  patients = [],
  appointments = [],
  inventory = [],
  onNavigateToModule,
  onOpenPatientFile,
  onScheduleSmartAppointment,
  onUnreadCountChange
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'lab' | 'implant' | 'financial' | 'inventory'>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  useEscapeKey(isOpen, onClose);
  const [sentToast, setSentToast] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const touchStartX = useRef<number>(0);

  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [otaVersion, setOtaVersion] = useState<string>(() => otaUpdateService.getReleaseInfo().version);
  const [realtimeEvents, setRealtimeEvents] = useState<NotificationItem[]>([]);
  const [phonePerm, setPhonePerm] = useState<PhoneNotificationPermissionState>(() => getPhoneNotificationPermission());
  const [remindersRevision, setRemindersRevision] = useState<number>(0);

  React.useEffect(() => {
    const onRemUpdated = () => {
      setRemindersRevision(r => r + 1);
      setPhonePerm(getPhoneNotificationPermission());
    };
    window.addEventListener('minadental:reminders-updated', onRemUpdated);
    const unsubOta = otaUpdateService.subscribe((rel) => {
      setOtaVersion(rel.version);
    });
    const unsubSync = syncEngine.onSyncEvent((evt) => {
      const targetModuleMap: Record<string, string> = {
        PATIENT_CREATED: 'patients',
        TREATMENT_APPLIED: 'patients',
        PAYMENT_RECORDED: 'financial',
        CHECK_ADDED: 'financial',
        LAB_UPDATED: 'lab',
        APPOINTMENT_CREATED: 'appointments'
      };
      const targetView = targetModuleMap[evt.type];
      const id = `live-sync-evt-${evt.id}`;
      setRealtimeEvents((prev) => [
        {
          id,
          category: 'sync',
          title: evt.title,
          description: evt.description,
          time: evt.timestamp,
          isRead: false,
          actionLabel: evt.actionRequired || (targetView ? 'مشاهده رویداد' : undefined),
          actionModule: targetView
        },
        ...prev.slice(0, 7)
      ]);
    });
    return () => {
      window.removeEventListener('minadental:reminders-updated', onRemUpdated);
      unsubOta();
      unsubSync();
    };
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds));
    } catch {}
  }, [readIds]);

  const assignmentsMap = useMemo(() => getReminderAssignmentsMap(), [remindersRevision]);

  const notifications = useMemo(() => {
    const readSet = new Set(readIds);
    const liveClinical = buildLiveClinicalNotifications(patients, appointments, readSet, otaVersion, inventory);
    const combinedSync = realtimeEvents.map((ev) => ({ ...ev, isRead: readSet.has(ev.id) }));
    const seen = new Set<string>();
    return [...combinedSync, ...liveClinical].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [patients, appointments, inventory, readIds, otaVersion, realtimeEvents, remindersRevision]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const lastReportedCount = React.useRef<number>(-1);

  React.useEffect(() => {
    if (onUnreadCountChange && lastReportedCount.current !== unreadCount) {
      lastReportedCount.current = unreadCount;
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (unreadOnly && n.isRead) return false;
    if (activeTab === 'all') return true;
    return n.category === activeTab;
  });

  const tabCounts = {
    urgent: notifications.filter((n) => n.category === 'urgent').length,
    lab: notifications.filter((n) => n.category === 'lab').length,
    implant: notifications.filter((n) => n.category === 'implant').length,
    financial: notifications.filter((n) => n.category === 'financial').length,
    inventory: notifications.filter((n) => n.category === 'inventory').length
  };

  const handleMarkAllRead = () => {
    setReadIds((prev) => Array.from(new Set([...prev, ...notifications.map((n) => n.id)])));
  };

  const handleAction = async (item: NotificationItem) => {
    setReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));

    if (item.actionLabel?.includes('پیامک')) {
      if (item.patientPhone && item.smsPattern) {
        const res = await clinicalSmsService.sendPatternSms(
          item.patientPhone,
          item.patientName || 'بیمار گرامی',
          item.smsPattern,
          item.smsTokens || {}
        );
        if (res.success) {
          triggerHaptic('success');
          setSentToast(`پیامک واقعی برای ${item.patientName || 'بیمار'} ارسال شد (کد رهگیری: ${res.refId}).`);
        } else {
          setSentToast(res.message || 'خطا در ارسال پیامک؛ شماره موبایل را بررسی کنید.');
        }
      } else {
        setSentToast('پیامک یادآوری در صف ارسال قرار گرفت.');
      }
      setTimeout(() => setSentToast(null), 4000);
      return;
    }

    if (item.actionModule && onNavigateToModule) {
      onClose();
      onNavigateToModule(item.actionModule);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    if (diff > 0) {
      setDragOffset(diff);
    } else {
      setDragOffset(0);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (dragOffset > 70) {
      triggerHaptic('gesture');
      onClose();
    }
    setDragOffset(0);
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="کشوی اعلانات و یادآوری‌های کلینیک"
      className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* Blurred Backdrop - Soft Emerald Tint */}
      <div 
        onClick={() => {
          triggerHaptic('light');
          onClose();
        }}
        className="absolute inset-0 bg-emerald-950/20 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over panel from side (Right in RTL = smooth slide from right) */}
      <div 
        className="absolute inset-y-0 right-0 max-w-full flex pl-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* iOS 27 Subtle Vertical Drag Grabber Bar */}
        <div className="flex items-center justify-center pr-1.5">
          <div className="w-1.5 h-12 bg-slate-300/80 hover:bg-slate-400 rounded-full cursor-grab active:cursor-grabbing transition-colors" />
        </div>

        <div 
          style={{
            transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
            transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
          }}
          className="w-screen max-w-sm sm:max-w-md bg-white border-l border-slate-200 text-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ease-out"
        >
          
          {/* Header */}
          <div className="p-4 border-b border-purple-100 flex items-center justify-between bg-gradient-to-l from-purple-50 via-rose-50/70 to-amber-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 border border-white/60 flex items-center justify-center text-white shadow-sm">
                <Bell className={`w-4 h-4 stroke-[2.5] ${unreadCount > 0 ? 'animate-bell-ring' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">اعلانات و یادآوری‌ها</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full">
                      {toPersianDigits(unreadCount)} جدید
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    handleMarkAllRead();
                  }}
                  className="p-1.5 text-xs text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-100/60 transition-colors"
                  title="خواندن همه"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Category Filter Tabs */}
          <div className="p-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('all');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              همه ({toPersianDigits(notifications.length)})
            </button>

            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('urgent');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'urgent'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              فوری پزشک ({toPersianDigits(tabCounts.urgent)})
            </button>

            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('lab');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'lab'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              لابراتوار ({toPersianDigits(tabCounts.lab)})
            </button>

            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('implant');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'implant'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              ایمپلنت ({toPersianDigits(tabCounts.implant)})
            </button>

            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('financial');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'financial'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              مالی و چک ({toPersianDigits(tabCounts.financial)})
            </button>

            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('inventory');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              انبار ({toPersianDigits(tabCounts.inventory)})
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setUnreadOnly((v) => !v);
              }}
              aria-pressed={unreadOnly}
              className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 transition-all cursor-pointer border ${
                unreadOnly
                  ? 'bg-violet-700 text-white border-violet-700 shadow-xs'
                  : 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100'
              }`}
            >
              فقط خوانده‌نشده
            </button>
          </div>

          {/* Phone Push Activation Strip */}
          <div className="px-3 py-2 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-2 text-[10.5px]">
            <div className="flex items-center gap-1.5 text-emerald-900 font-bold min-w-0">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">
                {phonePerm === 'granted' ? 'اعلان گوشی (Push) فعال است' : 'دریافت آلارم روی صفحه قفل گوشی'}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                triggerHaptic('selection');
                const perm = await requestPhoneNotificationPermission();
                setPhonePerm(perm);
                if (perm === 'granted') {
                  await sendPhoneNotification({
                    id: `drawer-test-${Date.now()}`,
                    title: 'تست اعلان مینادنتال ✓',
                    body: 'نوتیفیکیشن گوشی برای یادآوری نوبت، لابراتوار و چک فعال است.',
                    view: 'reminders'
                  });
                  setSentToast('اعلان تست به گوشی شما ارسال شد.');
                } else {
                  setSentToast('مجوز نوتیفیکیشن توسط مرورگر صادر نشد.');
                }
                setTimeout(() => setSentToast(null), 3000);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] shrink-0 cursor-pointer"
            >
              {phonePerm === 'granted' ? 'تست اعلان' : 'فعال‌سازی گوشی'}
            </button>
          </div>

          {/* Notification Toast Message */}
          {sentToast && (
            <div className="m-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{sentToast}</span>
            </div>
          )}

          {/* Notifications Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
                <Sparkles className="w-8 h-8 mb-2 text-slate-300" />
                <span>هیچ اعلان جدیدی در این بخش وجود ندارد.</span>
              </div>
            ) : (
              filtered.map(item => {
                const categoryStyles =
                  item.category === 'urgent'
                    ? 'bg-gradient-to-br from-rose-50 via-white to-red-50/70 border-rose-200/90 text-slate-900'
                    : item.category === 'lab'
                    ? 'bg-gradient-to-br from-purple-50 via-white to-fuchsia-50/70 border-purple-200/90 text-slate-900'
                    : item.category === 'financial'
                    ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50/70 border-amber-200/90 text-slate-900'
                    : item.category === 'implant'
                    ? 'bg-gradient-to-br from-sky-50 via-white to-cyan-50/70 border-sky-200/90 text-slate-900'
                    : item.category === 'inventory'
                    ? 'bg-gradient-to-br from-orange-50 via-white to-amber-50/70 border-orange-200/90 text-slate-900'
                    : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 border-emerald-200/90 text-slate-900';

                const dotColor =
                  item.category === 'urgent'
                    ? 'bg-rose-500'
                    : item.category === 'lab'
                    ? 'bg-purple-600'
                    : item.category === 'financial'
                    ? 'bg-amber-500'
                    : item.category === 'implant'
                    ? 'bg-sky-500'
                    : item.category === 'inventory'
                    ? 'bg-orange-500'
                    : 'bg-emerald-500';

                const btnStyle =
                  item.category === 'urgent'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                    : item.category === 'lab'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-2xs'
                    : item.category === 'financial'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                    : item.category === 'implant'
                    ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-2xs'
                    : item.category === 'inventory'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-2xs'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-3 border transition-all shadow-xs ${
                      item.isRead ? 'opacity-80 bg-white border-slate-200 text-slate-600' : categoryStyles
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          item.isRead ? 'bg-slate-300' : `${dotColor} ring-2 ring-white/80`
                        }`} />
                        <h4 className="text-xs font-extrabold leading-snug">
                          {item.title}
                        </h4>
                        {assignmentsMap[item.id] && (
                          <span className="text-[9.5px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                            مسئول: {assignmentsMap[item.id]}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-500 shrink-0 font-mono tabular-nums">
                        {item.time}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed pr-4 mb-2.5">
                      {item.description}
                    </p>

                    {(item.actionLabel || (item.patientId && onOpenPatientFile) || (item.suggestedTreatment && onScheduleSmartAppointment)) && (
                      <div className="flex items-center justify-end gap-1.5 flex-wrap pt-1.5 pr-4 border-t border-slate-200/60">
                        {item.patientId && onOpenPatientFile && (() => {
                          const targetPatient = patients.find((p) => p.id === item.patientId);
                          if (!targetPatient) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                                onClose();
                                onOpenPatientFile(targetPatient, item.patientTab);
                              }}
                              className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                            >
                              <FolderOpen className="w-3 h-3 text-emerald-600" />
                              <span>پرونده</span>
                            </button>
                          );
                        })()}

                        {item.suggestedTreatment && item.patientName && onScheduleSmartAppointment && (
                          <button
                            type="button"
                            onClick={() => {
                              setReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                              onClose();
                              onScheduleSmartAppointment({
                                patientName: item.patientName!,
                                phone: item.patientPhone || '',
                                treatment: item.suggestedTreatment!,
                                unit: item.category === 'implant' ? 'یونیت جراحی' : 'یونیت آبی'
                              });
                            }}
                            className="py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-2xs"
                          >
                            <CalendarDays className="w-3 h-3" />
                            <span>رزرو نوبت</span>
                          </button>
                        )}

                        {item.actionLabel && (
                          <button type="button"
                            onClick={() => handleAction(item)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer ${btnStyle}`}
                          >
                            {item.actionLabel.includes('پیامک') ? (
                              <Send className="w-3.5 h-3.5 -scale-x-100" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5" />
                            )}
                            <span>{item.actionLabel}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            snoozeReminder(item.id, 60);
                            setRemindersRevision(r => r + 1);
                            setSentToast('اعلان برای ۱ ساعت به تعویق افتاد.');
                            setTimeout(() => setSentToast(null), 2500);
                          }}
                          className="py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                          title="تعویق ۱ ساعته اعلان"
                        >
                          <AlarmClock className="w-3 h-3" />
                          <span>۱س تعویق</span>
                        </button>

                        {!item.id.startsWith('live-ota-') && !item.id.startsWith('live-sync-evt-') && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('success');
                              markReminderDone(item.id);
                              try {
                                const raw = localStorage.getItem('minadental_dismissed_reminders_v1');
                                const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
                                map[item.id] = true;
                                localStorage.setItem('minadental_dismissed_reminders_v1', JSON.stringify(map));
                                broadcastReminderMeshSync('dismiss', item.id);
                                window.dispatchEvent(new CustomEvent('minadental:reminders-updated'));
                              } catch {}
                              setReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                              setRemindersRevision(r => r + 1);
                              setSentToast('اعلان انجام شد و در بایگانی ثبت گردید ✓');
                              setTimeout(() => setSentToast(null), 2500);
                            }}
                            className="py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                            aria-label="تکمیل و بایگانی اعلان"
                          >
                            <Check className="w-3 h-3 stroke-[2.75]" />
                            <span>انجام شد</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Bottom Status & Quick Link */}
          <div className="p-3 border-t border-slate-200 bg-white text-[10px] text-slate-500 flex items-center justify-between px-3">
            <button type="button"
              onClick={() => {
                triggerHaptic('selection');
                onClose();
                onNavigateToModule?.('reminders');
              }}
              className="text-[11px] text-emerald-700 hover:text-emerald-800 font-extrabold flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>مدیریت یادآوری‌ها</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              بروزرسانی خودکار
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};
