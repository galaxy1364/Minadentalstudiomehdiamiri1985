import {
  Appointment,
  InventoryItem,
  Patient,
  ReminderChannel,
  ReminderConfig,
  ReminderRecurrence,
  ReminderTimingPreset,
  UnifiedReminderRecord,
  UnifiedReminderSourceType
} from '../types/dental';
import {
  addDaysToPersianDate,
  comparePersianDates,
  diffPersianDays,
  formatToman,
  getCurrentPersianDate,
  isSamePersianDate,
  parseTimeMinutes,
  toEnglishDigits,
  toPersianDigits
} from '../utils/jalali';
import {
  computeClinicReceivablesLedger,
  formatExactMicroToman
} from '../utils/accountingEngine';
import { clinicalSmsService } from './smsService';

export interface ReminderAutomationRules {
  autoAptConfirm24h: boolean;
  autoImplantPostOp: boolean;
  autoCheckAndInstallmentEscalation: boolean;
  autoCssdQuarantineAlert: boolean;
  autoRecallInvite: boolean;
}

export const DEFAULT_AUTOMATION_RULES: ReminderAutomationRules = {
  autoAptConfirm24h: true,
  autoImplantPostOp: true,
  autoCheckAndInstallmentEscalation: true,
  autoCssdQuarantineAlert: true,
  autoRecallInvite: true
};

export interface ClinicReminderSettings {
  checkAdvanceDays: number;
  guaranteeCheckAdvanceDays: number;
  installmentAdvanceDays: number;
  debtorMinAlertToman: number;
  appointmentAdvanceHours: number;
  postOpFollowupDays: number;
  labDeliveryAdvanceDays: number;
  periodicRecallMonths: number;
  inventoryExpiryAdvanceDays: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  respectQuietHours: boolean;
  autoSendSmsForCritical: boolean;
  enableSoundAlarm?: boolean;
  automationRules?: ReminderAutomationRules;
}

const REMINDER_POLICY_STORAGE_KEY = 'minadental_reminder_policy_v2';
const CUSTOM_REMINDERS_STORAGE_KEY = 'minadental_custom_reminders_v1';
const FIRED_NOTIFS_STORAGE_KEY = 'minadental_fired_notifs_v1';
const SNOOZED_REMINDERS_STORAGE_KEY = 'minadental_snoozed_reminders_v1';
const REMINDER_ASSIGNMENTS_STORAGE_KEY = 'minadental_reminder_assignments_v1';
const APT_CONFIRMATIONS_STORAGE_KEY = 'minadental_apt_confirmations_v1';
const REMINDER_MESH_CHANNEL_NAME = 'minadental_reminders_mesh_v1';
const REMINDER_MESH_PULSE_KEY = 'minadental_reminders_mesh_pulse_v1';

export const CLINIC_STAFF_ASSIGNMENT_ROLES = [
  'منشی پذیرش',
  'دستیار جراحی',
  'حسابدار صیاد',
  'دکتر مهدی امیری'
] as const;

export type AppointmentConfirmationState = 'unconfirmed' | 'confirmed_by_patient' | 'reschedule_requested';

export type PhoneNotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export type SmartUrgencyTier = 'critical' | 'high' | 'medium' | 'upcoming';

export type SmartEscalationLevel = 'standard' | 'sms_queued' | 'manager_escalation';

export type UnifiedReminderPillar =
  | 'custom'
  | 'appointment'
  | 'check'
  | 'installment'
  | 'debtor'
  | 'lab'
  | 'implant'
  | 'recall'
  | 'inventory'
  | 'insurance'
  | 'sterilization';

export interface SynthesizedClinicReminder {
  id: string;
  pillar: UnifiedReminderPillar;
  legacyType: 'lab' | 'financial' | 'post_op' | 'implant' | 'custom';
  title: string;
  subtitle: string;
  time: string;
  actionText: string;
  patientId?: string;
  patientName: string;
  phone: string;
  status: string;
  urgency: SmartUrgencyTier;
  escalationLevel?: SmartEscalationLevel;
  priorityScore: number;
  daysRemaining: number;
  exactAmountToman?: number;
  exactAmountMicro?: string;
  isCustomRecord?: boolean;
  recurrence?: ReminderRecurrence;
  isSnoozed: boolean;
  snoozedUntilMs?: number;
  sourceType?: UnifiedReminderSourceType;
  targetView:
    | 'appointments'
    | 'patients'
    | 'financial'
    | 'lab'
    | 'implant'
    | 'inventory'
    | 'insurance_claims'
    | 'sterilization'
    | 'reminders';
  targetSubModule?: 'sayad_checks' | 'guarantee_checks' | 'installments' | 'debtors';
  sourceEntityId?: string;
  isGuaranteeCheck?: boolean;
  isGuaranteeReadyForReturn?: boolean;
  patientTab?: 'treatments' | 'financial' | 'lab' | 'implant';
  triggerMeta?: string;
  channelsLabel?: string;
  reminderPresetLabel?: string;
  aptDate?: string;
  aptTime?: string;
  medicalAlert?: string;
  suggestedAppointmentTreatment?: string;
  suggestedAppointmentUnit?: string;
  assignedTo?: string;
  confirmationStatus?: AppointmentConfirmationState;
  noShowRiskPercent?: number;
  riskHint?: string;
}

export interface ReminderAnalyticsSummary {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  todayTomorrowCount: number;
  financialCount: number;
  financialAtRiskToman: number;
  sayadChecksCount: number;
  guaranteeChecksCount: number;
  guaranteeReadyCount: number;
  installmentsCount: number;
  debtorsCount: number;
  labImplantCount: number;
  inventoryCount: number;
  recallCount: number;
  appointmentsCount: number;
  insuranceCount: number;
  sterilizationCount: number;
  byPillar: Record<UnifiedReminderPillar, number>;
}

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

const REMINDER_TAB_ID = `tab-${Math.random().toString(36).slice(2, 9)}`;
let reminderMeshChannel: BroadcastChannel | null = null;
let reminderMeshInitialized = false;

function initReminderMeshListener(): void {
  if (reminderMeshInitialized || typeof window === 'undefined') return;
  reminderMeshInitialized = true;

  const handleIncoming = (payload: { sourceTab?: string } | null) => {
    if (!payload || payload.sourceTab === REMINDER_TAB_ID) return;
    try {
      window.dispatchEvent(new CustomEvent('minadental:reminders-updated'));
    } catch {
      // Ignore dispatch error
    }
  };

  try {
    if ('BroadcastChannel' in window) {
      reminderMeshChannel = new BroadcastChannel(REMINDER_MESH_CHANNEL_NAME);
      reminderMeshChannel.onmessage = (evt) => {
        if (evt?.data && typeof evt.data === 'object') {
          handleIncoming(evt.data as { sourceTab?: string });
        }
      };
    }
  } catch {
    // Ignore restricted WebView BroadcastChannel errors
  }

  try {
    window.addEventListener('storage', (evt) => {
      if (evt.key === REMINDER_MESH_PULSE_KEY && evt.newValue) {
        try {
          handleIncoming(JSON.parse(evt.newValue) as { sourceTab?: string });
        } catch {
          // Ignore malformed pulse
        }
      }
    });
  } catch {
    // Ignore mocked windows without full addEventListener
  }
}

export function broadcastReminderMeshSync(action: string, entityId?: string): void {
  if (typeof window === 'undefined') return;
  initReminderMeshListener();
  const payload = {
    action,
    entityId,
    sourceTab: REMINDER_TAB_ID,
    ts: Date.now()
  };
  try {
    reminderMeshChannel?.postMessage(payload);
  } catch {
    // Ignore postMessage failure
  }
  safeWriteJson(REMINDER_MESH_PULSE_KEY, payload);
}

function dispatchRemindersUpdatedEvent(meshAction?: string, entityId?: string): void {
  if (typeof window === 'undefined') return;
  initReminderMeshListener();
  if (meshAction) {
    broadcastReminderMeshSync(meshAction, entityId);
  }
  try {
    window.dispatchEvent(new CustomEvent('minadental:reminders-updated'));
  } catch {
    // Ignore SSR or restricted window errors
  }
}

export function getReminderSettings(): ClinicReminderSettings {
  const readNum = (key: string, fallback: number): number => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // Ignore storage access errors
    }
    return fallback;
  };

  const policy = safeReadJson<Partial<ClinicReminderSettings>>(REMINDER_POLICY_STORAGE_KEY, {});

  return {
    checkAdvanceDays: readNum('minadental_check_advance_days', 3),
    guaranteeCheckAdvanceDays:
      typeof policy.guaranteeCheckAdvanceDays === 'number' && policy.guaranteeCheckAdvanceDays >= 0
        ? policy.guaranteeCheckAdvanceDays
        : readNum('minadental_guarantee_advance_days', 5),
    installmentAdvanceDays: readNum('minadental_installment_advance_days', 2),
    debtorMinAlertToman:
      typeof policy.debtorMinAlertToman === 'number' && policy.debtorMinAlertToman >= 0
        ? policy.debtorMinAlertToman
        : readNum('minadental_debtor_min_alert_toman', 0),
    appointmentAdvanceHours: readNum('minadental_appointment_advance_hours', 24),
    postOpFollowupDays: readNum('minadental_postop_advance_days', 2),
    labDeliveryAdvanceDays: readNum('minadental_lab_advance_days', 2),
    periodicRecallMonths: readNum('minadental_periodic_recall_months', 6),
    inventoryExpiryAdvanceDays:
      typeof policy.inventoryExpiryAdvanceDays === 'number' && policy.inventoryExpiryAdvanceDays >= 0
        ? policy.inventoryExpiryAdvanceDays
        : readNum('minadental_inventory_expiry_days', 30),
    quietHoursStart: policy.quietHoursStart || '۲۲:۰۰',
    quietHoursEnd: policy.quietHoursEnd || '۰۸:۰۰',
    respectQuietHours: policy.respectQuietHours !== undefined ? Boolean(policy.respectQuietHours) : true,
    autoSendSmsForCritical: Boolean(policy.autoSendSmsForCritical),
    enableSoundAlarm: policy.enableSoundAlarm !== undefined ? Boolean(policy.enableSoundAlarm) : true,
    automationRules: {
      ...DEFAULT_AUTOMATION_RULES,
      ...(policy.automationRules || {})
    }
  };
}

export function saveReminderSettings(partial: Partial<ClinicReminderSettings>): ClinicReminderSettings {
  const current = getReminderSettings();
  const next: ClinicReminderSettings = {
    ...current,
    ...partial,
    automationRules: {
      ...DEFAULT_AUTOMATION_RULES,
      ...(current.automationRules || {}),
      ...(partial.automationRules || {})
    }
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('minadental_check_advance_days', String(next.checkAdvanceDays));
      window.localStorage.setItem('minadental_guarantee_advance_days', String(next.guaranteeCheckAdvanceDays));
      window.localStorage.setItem('minadental_installment_advance_days', String(next.installmentAdvanceDays));
      window.localStorage.setItem('minadental_debtor_min_alert_toman', String(next.debtorMinAlertToman));
      window.localStorage.setItem('minadental_appointment_advance_hours', String(next.appointmentAdvanceHours));
      window.localStorage.setItem('minadental_postop_advance_days', String(next.postOpFollowupDays));
      window.localStorage.setItem('minadental_lab_advance_days', String(next.labDeliveryAdvanceDays));
      window.localStorage.setItem('minadental_periodic_recall_months', String(next.periodicRecallMonths));
      window.localStorage.setItem('minadental_inventory_expiry_days', String(next.inventoryExpiryAdvanceDays));
    } catch {
      // Ignore quota errors
    }
  }
  safeWriteJson(REMINDER_POLICY_STORAGE_KEY, {
    guaranteeCheckAdvanceDays: next.guaranteeCheckAdvanceDays,
    debtorMinAlertToman: next.debtorMinAlertToman,
    inventoryExpiryAdvanceDays: next.inventoryExpiryAdvanceDays,
    quietHoursStart: next.quietHoursStart,
    quietHoursEnd: next.quietHoursEnd,
    respectQuietHours: next.respectQuietHours,
    autoSendSmsForCritical: next.autoSendSmsForCritical,
    enableSoundAlarm: next.enableSoundAlarm,
    automationRules: next.automationRules
  });
  dispatchRemindersUpdatedEvent('settings');
  return next;
}

export function playCriticalAlarmChime(mode: 'critical' | 'chime' = 'chime'): boolean {
  if (typeof window === 'undefined') return false;
  const settings = getReminderSettings();
  if (settings.enableSoundAlarm === false) return false;
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;
    const ctx = new AudioCtx();
    const notes = mode === 'critical' ? [880, 660, 880] : [587.33, 880];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = mode === 'critical' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.14);
    });
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // Ignore context close error
      }
    }, 650);
    return true;
  } catch {
    return false;
  }
}

export function getReminderAssignmentsMap(): Record<string, string> {
  return safeReadJson<Record<string, string>>(REMINDER_ASSIGNMENTS_STORAGE_KEY, {});
}

export function assignReminderToStaff(id: string, staffLabel?: string): Record<string, string> {
  const map = { ...getReminderAssignmentsMap() };
  if (staffLabel && staffLabel.trim()) {
    map[id] = staffLabel.trim();
  } else {
    delete map[id];
  }
  safeWriteJson(REMINDER_ASSIGNMENTS_STORAGE_KEY, map);
  dispatchRemindersUpdatedEvent('assign', id);
  return map;
}

export function getAppointmentConfirmationsMap(): Record<string, AppointmentConfirmationState> {
  return safeReadJson<Record<string, AppointmentConfirmationState>>(APT_CONFIRMATIONS_STORAGE_KEY, {});
}

export function setAppointmentConfirmationStatus(
  id: string,
  status: AppointmentConfirmationState
): Record<string, AppointmentConfirmationState> {
  const map = { ...getAppointmentConfirmationsMap() };
  const canonicalId = id.startsWith('live-apt-') ? id : `live-apt-${id}`;
  map[canonicalId] = status;
  safeWriteJson(APT_CONFIRMATIONS_STORAGE_KEY, map);
  dispatchRemindersUpdatedEvent('confirm', canonicalId);
  return map;
}

export function isWithinQuietHours(settings: ClinicReminderSettings, nowDate: Date = new Date()): boolean {
  if (!settings.respectQuietHours) return false;
  const nowMins = nowDate.getHours() * 60 + nowDate.getMinutes();
  const startMins = parseTimeMinutes(settings.quietHoursStart || '22:00');
  const endMins = parseTimeMinutes(settings.quietHoursEnd || '08:00');
  if (startMins === endMins) return false;
  if (startMins > endMins) {
    // Overnight window e.g. 22:00 -> 08:00
    return nowMins >= startMins || nowMins < endMins;
  }
  return nowMins >= startMins && nowMins < endMins;
}

export function getDefaultReminderConfig(preset: ReminderTimingPreset = '1d_before'): ReminderConfig {
  return {
    enabled: true,
    preset,
    channels: ['phone_push', 'in_app']
  };
}

export function getPresetOffsetDays(preset: ReminderTimingPreset): number {
  switch (preset) {
    case '1d_before':
      return -1;
    case '2d_before':
      return -2;
    case '3d_before':
      return -3;
    case '1w_before':
      return -7;
    case 'at_time':
    case '30m_before':
    case '2h_before':
    case 'custom':
    default:
      return 0;
  }
}

export function getPresetLabelFa(preset: ReminderTimingPreset): string {
  switch (preset) {
    case 'at_time':
      return 'در همان زمان';
    case '30m_before':
      return '۳۰ دقیقه قبل';
    case '2h_before':
      return '۲ ساعت قبل';
    case '1d_before':
      return '۱ روز قبل';
    case '2d_before':
      return '۲ روز قبل';
    case '3d_before':
      return '۳ روز قبل';
    case '1w_before':
      return '۱ هفته قبل';
    case 'custom':
      return 'تاریخ و ساعت دلخواه';
  }
}

export function computeReminderTriggerDateTime(
  targetDate: string,
  targetTime?: string,
  config?: ReminderConfig
): { triggerDate: string; triggerTime: string } {
  const safeDate = targetDate || getCurrentPersianDate();
  const safeTime = targetTime || '۰۹:۰۰';
  if (!config) {
    return { triggerDate: safeDate, triggerTime: safeTime };
  }
  if (config.preset === 'custom' && config.customDate) {
    return {
      triggerDate: config.customDate,
      triggerTime: config.customTime || safeTime
    };
  }
  if (config.preset === '30m_before' || config.preset === '2h_before') {
    const mins = parseTimeMinutes(safeTime);
    const delta = config.preset === '30m_before' ? 30 : 120;
    const adjusted = Math.max(0, mins - delta);
    const hh = String(Math.floor(adjusted / 60)).padStart(2, '0');
    const mm = String(adjusted % 60).padStart(2, '0');
    return {
      triggerDate: safeDate,
      triggerTime: toPersianDigits(`${hh}:${mm}`)
    };
  }
  const offset = getPresetOffsetDays(config.preset);
  return {
    triggerDate: offset === 0 ? safeDate : addDaysToPersianDate(safeDate, offset),
    triggerTime: config.customTime || safeTime
  };
}

export function getPhoneNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPhoneNotificationPermission(): PhoneNotificationPermissionState {
  if (!getPhoneNotificationSupport()) return 'unsupported';
  try {
    return (window.Notification.permission as PhoneNotificationPermissionState) || 'default';
  } catch {
    return 'unsupported';
  }
}

export async function requestPhoneNotificationPermission(): Promise<PhoneNotificationPermissionState> {
  if (!getPhoneNotificationSupport()) return 'unsupported';
  try {
    const result = await window.Notification.requestPermission();
    dispatchRemindersUpdatedEvent();
    return result as PhoneNotificationPermissionState;
  } catch {
    return getPhoneNotificationPermission();
  }
}

export function getCustomReminders(): UnifiedReminderRecord[] {
  const list = safeReadJson<UnifiedReminderRecord[]>(CUSTOM_REMINDERS_STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveCustomReminders(reminders: UnifiedReminderRecord[]): void {
  safeWriteJson(CUSTOM_REMINDERS_STORAGE_KEY, reminders);
  dispatchRemindersUpdatedEvent('custom');
}

export function upsertCustomReminder(record: UnifiedReminderRecord): UnifiedReminderRecord[] {
  const existing = getCustomReminders();
  const filtered = existing.filter(
    r =>
      r.id !== record.id &&
      !(record.sourceId && r.sourceType === record.sourceType && r.sourceId === record.sourceId)
  );
  const next = [record, ...filtered].slice(0, 500);
  saveCustomReminders(next);
  return next;
}

export function scheduleEntityReminder(params: {
  sourceType: UnifiedReminderSourceType;
  sourceId: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  title: string;
  description: string;
  targetDate: string;
  targetTime?: string;
  targetView: string;
  config?: ReminderConfig;
}): UnifiedReminderRecord | null {
  if (!params.config || !params.config.enabled) return null;
  const { triggerDate, triggerTime } = computeReminderTriggerDateTime(
    params.targetDate,
    params.targetTime,
    params.config
  );
  const record: UnifiedReminderRecord = {
    id: `rem-${params.sourceType}-${params.sourceId}`,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    patientId: params.patientId,
    patientName: params.patientName,
    patientPhone: params.patientPhone,
    title: params.title,
    description: params.config.note?.trim()
      ? `${params.description} — یادداشت: ${params.config.note.trim()}`
      : params.description,
    targetDate: params.targetDate,
    targetTime: params.targetTime,
    triggerDate,
    triggerTime,
    channels: params.config.channels?.length ? params.config.channels : ['phone_push', 'in_app'],
    status: 'pending',
    targetView: params.targetView,
    createdAt: getCurrentPersianDate()
  };

  upsertCustomReminder(record);

  const today = getCurrentPersianDate();
  if (
    record.channels.includes('phone_push') &&
    comparePersianDates(triggerDate, today) <= 0
  ) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (!triggerTime || parseTimeMinutes(triggerTime) <= nowMinutes || comparePersianDates(triggerDate, today) < 0) {
      void sendPhoneNotification({
        id: record.id,
        title: `یادآوری مینادنتال: ${record.title}`,
        body: `${record.patientName} · ${record.description}`,
        view: record.targetView,
        patientId: record.patientId,
        tag: `minadental-${record.id}`
      });
    }
  }

  return record;
}

function shiftDateByRecurrence(dateStr: string, recurrence: ReminderRecurrence): string {
  const days = recurrence === 'daily' ? 1 : recurrence === 'weekly' ? 7 : recurrence === 'monthly' ? 30 : 0;
  return days > 0 ? addDaysToPersianDate(dateStr || getCurrentPersianDate(), days) : dateStr;
}

export function markReminderDone(id: string): void {
  const list = getCustomReminders();
  const target = list.find(r => r.id === id);
  if (target) {
    let nextList = list.map(r => (r.id === id ? { ...r, status: 'done' as const } : r));
    if (target.recurrence && target.recurrence !== 'none') {
      const nextDate = shiftDateByRecurrence(target.triggerDate || target.targetDate, target.recurrence);
      const nextRec: UnifiedReminderRecord = {
        ...target,
        id: `rem-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        targetDate: nextDate,
        triggerDate: nextDate,
        status: 'pending',
        snoozedUntilMs: undefined,
        createdAt: getCurrentPersianDate()
      };
      nextList = [nextRec, ...nextList].slice(0, 500);
    }
    saveCustomReminders(nextList);
  } else {
    dispatchRemindersUpdatedEvent('done', id);
  }
}

export function batchMarkRemindersDone(ids: string[]): void {
  for (const id of ids) {
    markReminderDone(id);
  }
}

export function batchSnoozeReminders(ids: string[], minutes: number): void {
  const untilMs = Date.now() + Math.max(1, minutes) * 60 * 1000;
  const map = getSnoozedMap();
  for (const id of ids) {
    map[id] = untilMs;
  }
  safeWriteJson(SNOOZED_REMINDERS_STORAGE_KEY, map);

  const idSet = new Set(ids);
  const list = getCustomReminders();
  if (list.some(r => idSet.has(r.id))) {
    saveCustomReminders(
      list.map(r => (idSet.has(r.id) ? { ...r, status: 'snoozed', snoozedUntilMs: untilMs } : r))
    );
  } else {
    dispatchRemindersUpdatedEvent('batch_snooze');
  }
}

export function reopenReminder(id: string): void {
  const list = getCustomReminders();
  if (list.some(r => r.id === id)) {
    saveCustomReminders(list.map(r => (r.id === id ? { ...r, status: 'pending', snoozedUntilMs: undefined } : r)));
  }
  unsnoozeReminder(id);
}

export function deleteCustomReminder(id: string): void {
  const list = getCustomReminders();
  saveCustomReminders(list.filter(r => r.id !== id));
}

export function getSnoozedMap(): Record<string, number> {
  return safeReadJson<Record<string, number>>(SNOOZED_REMINDERS_STORAGE_KEY, {});
}

export function snoozeReminder(id: string, minutes: number): void {
  const untilMs = Date.now() + Math.max(1, minutes) * 60 * 1000;
  const map = getSnoozedMap();
  map[id] = untilMs;
  safeWriteJson(SNOOZED_REMINDERS_STORAGE_KEY, map);

  const list = getCustomReminders();
  if (list.some(r => r.id === id)) {
    saveCustomReminders(
      list.map(r => (r.id === id ? { ...r, status: 'snoozed', snoozedUntilMs: untilMs } : r))
    );
  } else {
    dispatchRemindersUpdatedEvent('snooze', id);
  }
}

export function unsnoozeReminder(id: string): void {
  const map = getSnoozedMap();
  if (id in map) {
    delete map[id];
    safeWriteJson(SNOOZED_REMINDERS_STORAGE_KEY, map);
  }
  const list = getCustomReminders();
  if (list.some(r => r.id === id && r.status === 'snoozed')) {
    saveCustomReminders(list.map(r => (r.id === id ? { ...r, status: 'pending', snoozedUntilMs: undefined } : r)));
  } else {
    dispatchRemindersUpdatedEvent('unsnooze', id);
  }
}

export function isReminderCurrentlySnoozed(id: string): boolean {
  const map = getSnoozedMap();
  const until = map[id];
  if (!until) return false;
  return Date.now() < until;
}

export function getActiveSnoozedUntil(id: string): number | undefined {
  const map = getSnoozedMap();
  const until = map[id];
  if (!until || Date.now() >= until) return undefined;
  return until;
}

function getFiredNotifsMap(): Record<string, number> {
  return safeReadJson<Record<string, number>>(FIRED_NOTIFS_STORAGE_KEY, {});
}

function markNotificationFired(dedupKey: string): void {
  const map = getFiredNotifsMap();
  map[dedupKey] = Date.now();
  const cutoff = Date.now() - 10 * 86400 * 1000;
  const cleaned: Record<string, number> = {};
  for (const [k, ts] of Object.entries(map)) {
    if (ts >= cutoff) cleaned[k] = ts;
  }
  safeWriteJson(FIRED_NOTIFS_STORAGE_KEY, cleaned);
}

export function hasNotificationFired(dedupKey: string): boolean {
  const map = getFiredNotifsMap();
  return Boolean(map[dedupKey]);
}

function scoreUrgencyFromDays(daysRemaining: number, windowDays: number, forceCritical = false): {
  urgency: SmartUrgencyTier;
  priorityScore: number;
} {
  if (forceCritical || daysRemaining < 0) {
    return { urgency: 'critical', priorityScore: 95 + Math.min(5, Math.abs(daysRemaining)) };
  }
  if (daysRemaining === 0) {
    return { urgency: 'critical', priorityScore: 92 };
  }
  if (daysRemaining <= Math.max(1, windowDays)) {
    return { urgency: 'high', priorityScore: Math.max(70, 88 - daysRemaining * 4) };
  }
  if (daysRemaining <= 7) {
    return { urgency: 'medium', priorityScore: 55 - daysRemaining * 2 };
  }
  return { urgency: 'upcoming', priorityScore: Math.max(15, 40 - Math.min(25, Math.floor(daysRemaining / 2))) };
}

function formatDayCountdownLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return `${toPersianDigits(Math.abs(daysRemaining))} روز گذشته`;
  if (daysRemaining === 0) return 'امروز';
  if (daysRemaining === 1) return 'فردا';
  return `تا ${toPersianDigits(daysRemaining)} روز دیگر`;
}

/**
 * Single Global Truth Engine: Synthesizes unified smart reminders across all 9 clinic pillars:
 * Custom/Module Reminders, Appointments, Debtors, Sayad/Guarantee Checks, Installments,
 * Lab Going/Returning, Implants/Post-Op, Periodic Recalls, and Inventory Stock/FEFO Expiry.
 */
export function synthesizeUnifiedClinicReminders(params: {
  patients: Patient[];
  appointments: Appointment[];
  inventory?: InventoryItem[];
  settingsOverride?: ClinicReminderSettings;
  dismissedIds?: Record<string, boolean>;
  includeSnoozed?: boolean;
}): SynthesizedClinicReminder[] {
  const {
    patients = [],
    appointments = [],
    inventory = [],
    settingsOverride,
    dismissedIds = {},
    includeSnoozed = false
  } = params;

  const settings = settingsOverride || getReminderSettings();
  const rules = { ...DEFAULT_AUTOMATION_RULES, ...(settings.automationRules || {}) };
  const today = getCurrentPersianDate();
  const items: SynthesizedClinicReminder[] = [];

  const assignmentsMap = getReminderAssignmentsMap();
  const confirmationsMap = getAppointmentConfirmationsMap();
  const clinicReceivables = computeClinicReceivablesLedger(patients);

  // Pre-index predictive risk signals per patient (missed appointments, overdue installments, bounced checks, balance)
  const riskSignalsByPatientKey = new Map<
    string,
    { noShowCount: number; cancelledCount: number; overdueInstCount: number; bouncedCheckCount: number; highDebt: boolean }
  >();
  const ensureRiskEntry = (key?: string) => {
    if (!key) return null;
    let cur = riskSignalsByPatientKey.get(key);
    if (!cur) {
      cur = { noShowCount: 0, cancelledCount: 0, overdueInstCount: 0, bouncedCheckCount: 0, highDebt: false };
      riskSignalsByPatientKey.set(key, cur);
    }
    return cur;
  };
  for (const aptRec of appointments) {
    if (aptRec.status === 'no_show' || aptRec.status === 'cancelled') {
      const byId = ensureRiskEntry(aptRec.patientId);
      if (byId) {
        if (aptRec.status === 'no_show') byId.noShowCount++;
        else byId.cancelledCount++;
      }
      const byName = ensureRiskEntry(`name:${aptRec.patientName}`);
      if (byName) {
        if (aptRec.status === 'no_show') byName.noShowCount++;
        else byName.cancelledCount++;
      }
    }
  }
  for (const pat of patients) {
    const entry = ensureRiskEntry(pat.id)!;
    const entryByName = ensureRiskEntry(`name:${pat.fullName}`)!;
    const ovInst = (pat.installments || []).filter(i => i.status === 'overdue').length;
    const bChk = (pat.sayadChecks || []).filter(c => c.status === 'bounced').length;
    const hDebt = pat.balance < -5_000_000;
    entry.overdueInstCount = ovInst;
    entry.bouncedCheckCount = bChk;
    entry.highDebt = hDebt;
    entryByName.overdueInstCount = Math.max(entryByName.overdueInstCount, ovInst);
    entryByName.bouncedCheckCount = Math.max(entryByName.bouncedCheckCount, bChk);
    entryByName.highDebt = entryByName.highDebt || hDebt;
  }

  // 0. Saved & Per-Module Scheduled Phone/Custom Reminders
  for (const rec of getCustomReminders()) {
    if (rec.status === 'done') continue;
    const snoozedUntilMs = getActiveSnoozedUntil(rec.id);
    const isSnoozed = Boolean(snoozedUntilMs);
    const mappedLegacyType: SynthesizedClinicReminder['legacyType'] =
      rec.sourceType === 'lab'
        ? 'lab'
        : rec.sourceType === 'implant'
        ? 'implant'
        : rec.sourceType === 'check' || rec.sourceType === 'installment' || rec.sourceType === 'payment'
        ? 'financial'
        : rec.sourceType === 'appointment' || rec.sourceType === 'treatment'
        ? 'post_op'
        : 'custom';
    const mappedPillar: UnifiedReminderPillar =
      rec.sourceType === 'lab'
        ? 'lab'
        : rec.sourceType === 'implant'
        ? 'implant'
        : rec.sourceType === 'check'
        ? 'check'
        : rec.sourceType === 'installment'
        ? 'installment'
        : rec.sourceType === 'payment'
        ? 'debtor'
        : rec.sourceType === 'appointment'
        ? 'appointment'
        : rec.sourceType === 'insurance'
        ? 'insurance'
        : rec.sourceType === 'sterilization'
        ? 'sterilization'
        : rec.sourceType === 'inventory'
        ? 'inventory'
        : rec.sourceType === 'recall'
        ? 'recall'
        : 'custom';
    const targetView: SynthesizedClinicReminder['targetView'] =
      rec.targetView === 'lab' || rec.sourceType === 'lab'
        ? 'lab'
        : rec.targetView === 'implant' || rec.sourceType === 'implant'
        ? 'implant'
        : rec.targetView === 'financial' || rec.sourceType === 'check' || rec.sourceType === 'installment'
        ? 'financial'
        : rec.targetView === 'appointments' || rec.sourceType === 'appointment'
        ? 'appointments'
        : rec.targetView === 'insurance_claims' || rec.sourceType === 'insurance'
        ? 'insurance_claims'
        : rec.targetView === 'sterilization' || rec.sourceType === 'sterilization'
        ? 'sterilization'
        : rec.targetView === 'inventory' || rec.sourceType === 'inventory'
        ? 'inventory'
        : 'reminders';

    const channelsText = rec.channels
      .map(c => (c === 'phone_push' ? 'نوتیف گوشی' : c === 'sms' ? 'پیامک' : 'برنامه'))
      .join(' · ');
    const daysRem = diffPersianDays(today, rec.triggerDate || today);
    const { urgency, priorityScore } = scoreUrgencyFromDays(daysRem, 1);
    const recurrenceBadge =
      rec.recurrence && rec.recurrence !== 'none'
        ? ` · تکرار ${rec.recurrence === 'daily' ? 'روزانه' : rec.recurrence === 'weekly' ? 'هفتگی' : 'ماهانه'}`
        : '';

    items.push({
      id: rec.id,
      pillar: mappedPillar,
      legacyType: mappedLegacyType,
      title: rec.title,
      subtitle: `${rec.description} | کانال‌ها: ${channelsText}${recurrenceBadge}`,
      time: `${toPersianDigits(rec.triggerDate)}${rec.triggerTime ? ` ساعت ${toPersianDigits(rec.triggerTime)}` : ''}`,
      actionText: 'ارسال پیامک یادآوری',
      patientId: rec.patientId,
      patientName: rec.patientName,
      phone: rec.patientPhone || '',
      status: rec.status,
      urgency,
      priorityScore,
      daysRemaining: daysRem,
      isCustomRecord: true,
      recurrence: rec.recurrence,
      isSnoozed,
      snoozedUntilMs,
      sourceType: rec.sourceType,
      targetView,
      patientTab: mappedPillar === 'lab' ? 'lab' : mappedPillar === 'implant' ? 'implant' : mappedLegacyType === 'financial' ? 'financial' : 'treatments',
      channelsLabel: channelsText,
      triggerMeta: `اعلان برنامه‌ریزی‌شده: ${toPersianDigits(rec.triggerDate)}${rec.triggerTime ? ` · ساعت ${toPersianDigits(rec.triggerTime)}` : ''}${recurrenceBadge}`,
      aptDate: rec.targetDate,
      aptTime: rec.triggerTime
    });
  }

  // 1. Live Clinic Debtor Reminders
  for (const debtor of clinicReceivables.debtorRecords) {
    if (debtor.exactRemainingDebtToClinic <= 0) continue;
    if (settings.debtorMinAlertToman > 0 && debtor.exactRemainingDebtToClinic < settings.debtorMinAlertToman) continue;
    const id = `live-debt-${debtor.patientId}`;
    const snoozedUntilMs = getActiveSnoozedUntil(id);
    const highDebt = debtor.exactRemainingDebtToClinic >= 10_000_000;
    const uncoveredNote =
      debtor.uncoveredOpenDebt > 0
        ? ` · ${formatToman(debtor.uncoveredOpenDebt)} بدون چک پشتوانه`
        : ' (تحت پوشش چک صیادی)';
    items.push({
      id,
      pillar: 'debtor',
      legacyType: 'financial',
      title: `پیگیری بدهی به مطب (${formatToman(debtor.exactRemainingDebtToClinic)})`,
      subtitle: `بیمار بابت ${toPersianDigits(debtor.treatmentsSummary.length)} خدمت ثبت‌شده مبلغ ${formatExactMicroToman(debtor.exactRemainingDebtToClinic, false)} به صندوق مطب بدهکار است${uncoveredNote}.`,
      time: debtor.uncoveredOpenDebt > 0 ? 'سررسید تسویه باز' : 'تحت پوشش چک',
      actionText: 'ارسال پیامک یادآوری بدهی',
      patientId: debtor.patientId,
      patientName: debtor.patientName,
      phone: debtor.phone,
      status: 'pending',
      urgency: highDebt ? 'high' : 'medium',
      priorityScore: highDebt ? 82 : 64,
      daysRemaining: 0,
      exactAmountToman: debtor.exactRemainingDebtToClinic,
      exactAmountMicro: formatExactMicroToman(debtor.exactRemainingDebtToClinic, false),
      isSnoozed: Boolean(snoozedUntilMs),
      snoozedUntilMs,
      sourceType: 'payment',
      sourceEntityId: debtor.patientId,
      targetView: 'financial',
      targetSubModule: 'debtors',
      patientTab: 'financial',
      suggestedAppointmentTreatment: 'تکمیل درمان و تسویه مالی',
      suggestedAppointmentUnit: 'یونیت آبی'
    });
  }

  // 2. Patients: Sayad & Guarantee Checks, Installments, Lab, Implants, Post-Op, Recalls
  for (const p of patients) {
    const medicalAlert = p.medicalHistory?.length ? p.medicalHistory.join('، ') : undefined;

    const patInsts = p.installments || [];
    const patUnpaidInstsCount = patInsts.filter(i => i.status !== 'paid').length;
    const patChecks = p.sayadChecks || [];

    // 2A. Sayad & Guarantee Checks
    for (const chk of patChecks) {
      if (chk.status !== 'in_collection' && chk.status !== 'bounced') continue;
      const id = `live-chk-${chk.id}`;
      const snoozedUntilMs = getActiveSnoozedUntil(id);
      const daysRem = diffPersianDays(today, chk.dueDate);
      const isBounced = chk.status === 'bounced';
      const isGuaranteeReadyForReturn =
        Boolean(chk.isGuarantee) && !isBounced && patUnpaidInstsCount === 0 && p.balance >= 0;

      const hasCustomChkCfg = Boolean(chk.reminderConfig?.enabled);
      const effectiveWindowDays = hasCustomChkCfg && chk.reminderConfig
        ? Math.max(1, Math.abs(getPresetOffsetDays(chk.reminderConfig.preset)))
        : chk.isGuarantee
        ? settings.guaranteeCheckAdvanceDays
        : settings.checkAdvanceDays;

      const { urgency, priorityScore } = scoreUrgencyFromDays(daysRem, effectiveWindowDays, isBounced);
      const kindLabel = chk.isGuarantee ? 'چک ضمانت امانی' : 'چک صیادی';

      const chkTrig = hasCustomChkCfg && chk.reminderConfig
        ? computeReminderTriggerDateTime(chk.dueDate, '۰۹:۰۰', chk.reminderConfig)
        : null;
      const chkChannels = hasCustomChkCfg && chk.reminderConfig?.channels?.length
        ? chk.reminderConfig.channels.map(c => (c === 'phone_push' ? 'نوتیف گوشی' : c === 'sms' ? 'پیامک' : 'برنامه')).join(' · ')
        : undefined;
      const chkPresetLabel = isGuaranteeReadyForReturn
        ? 'تسویه کامل · عودت ضمانت'
        : hasCustomChkCfg && chk.reminderConfig
        ? getPresetLabelFa(chk.reminderConfig.preset)
        : `${toPersianDigits(effectiveWindowDays)} روز قبل از سررسید`;

      items.push({
        id,
        pillar: 'check',
        legacyType: 'financial',
        title: isBounced
          ? `فوری: برگشت ${kindLabel} (${formatToman(chk.amount)}) - ${chk.bankName}`
          : isGuaranteeReadyForReturn
            ? `آماده عودت به بیمار: ${kindLabel} (${formatToman(chk.amount)}) - ${chk.bankName}`
            : `سررسید ${kindLabel} (${formatToman(chk.amount)}) - ${chk.bankName}`,
        subtitle: isGuaranteeReadyForReturn
          ? `تمام اقساط بیمار تسویه شده است؛ لاشه چک ضمانت امانی (صیاد ${toPersianDigits(chk.sayadId)}) آماده تحویل به بیمار در پذیرش است.`
          : chk.isGuarantee
            ? `چک ضمانت امانی در گاوصندوق مطب (صیاد ${toPersianDigits(chk.sayadId)}) · ${patUnpaidInstsCount > 0 ? `${toPersianDigits(patUnpaidInstsCount)} قسط باز در پرونده` : 'مانده پرونده در انتظار تسویه'} | سررسید امانت: ${toPersianDigits(chk.dueDate)} (${toPersianDigits(effectiveWindowDays)} روز قبل طبق تنظیمات · ${formatDayCountdownLabel(daysRem)}).`
            : `شناسه صیادی ۱۶ رقمی: ${toPersianDigits(chk.sayadId)} | سررسید: ${toPersianDigits(chk.dueDate)} (${toPersianDigits(effectiveWindowDays)} روز قبل طبق تنظیمات مطب · ${formatDayCountdownLabel(daysRem)}).`,
        time: `${toPersianDigits(chk.dueDate)} · ${formatDayCountdownLabel(daysRem)}`,
        actionText: isGuaranteeReadyForReturn ? 'اعلان تحویل لاشه چک ضمانت به بیمار' : 'ارسال پیامک سررسید چک صیادی',
        patientId: p.id,
        patientName: p.fullName,
        phone: p.phone,
        status: chk.status,
        urgency: isGuaranteeReadyForReturn ? 'high' : urgency,
        priorityScore: isGuaranteeReadyForReturn ? Math.max(priorityScore, 85) : priorityScore,
        daysRemaining: daysRem,
        exactAmountToman: chk.amount,
        exactAmountMicro: formatExactMicroToman(chk.amount, true),
        isSnoozed: Boolean(snoozedUntilMs),
        snoozedUntilMs,
        sourceType: 'check',
        sourceEntityId: chk.id,
        isGuaranteeCheck: Boolean(chk.isGuarantee),
        isGuaranteeReadyForReturn,
        targetView: 'financial',
        targetSubModule: chk.isGuarantee ? 'guarantee_checks' : 'sayad_checks',
        patientTab: 'financial',
        channelsLabel: chkChannels,
        triggerMeta: chkTrig
          ? `اعلام یادآور چک: ${toPersianDigits(chkTrig.triggerDate)} (${chkPresetLabel})`
          : undefined,
        reminderPresetLabel: chkPresetLabel,
        suggestedAppointmentTreatment: isGuaranteeReadyForReturn
          ? 'تحویل لاشه چک ضمانت امانی و تایید تسویه'
          : undefined,
        suggestedAppointmentUnit: isGuaranteeReadyForReturn ? 'یونیت آبی' : undefined
      });
    }

    // 2B. Installments
    for (const inst of patInsts) {
      if (inst.status === 'paid') continue;
      const id = `live-inst-${inst.id}`;
      const snoozedUntilMs = getActiveSnoozedUntil(id);
      const daysRem = diffPersianDays(today, inst.dueDate);
      const isOverdue = inst.status === 'overdue' || daysRem < 0;
      const hasCustomInstCfg = Boolean(inst.reminderConfig?.enabled);
      const effectiveInstWindow = hasCustomInstCfg && inst.reminderConfig
        ? Math.max(1, Math.abs(getPresetOffsetDays(inst.reminderConfig.preset)))
        : settings.installmentAdvanceDays;
      const { urgency, priorityScore } = scoreUrgencyFromDays(daysRem, effectiveInstWindow, isOverdue);
      const linkedSayad = patChecks.find(c => !c.isGuarantee && (c.id.includes(inst.id) || c.amount === inst.amount));
      const guaranteeChk = patChecks.find(c => c.isGuarantee);
      const collateralNote = linkedSayad
        ? `وثیقه: چک صیادی ${linkedSayad.bankName}`
        : guaranteeChk
          ? `وثیقه: چک ضمانت امانی ${guaranteeChk.bankName}`
          : 'بدون چک (تعهد پرونده)';
      const instTrig = hasCustomInstCfg && inst.reminderConfig
        ? computeReminderTriggerDateTime(inst.dueDate, '۰۹:۰۰', inst.reminderConfig)
        : null;
      const instPresetLabel = hasCustomInstCfg && inst.reminderConfig
        ? getPresetLabelFa(inst.reminderConfig.preset)
        : `${toPersianDigits(effectiveInstWindow)} روز قبل`;

      items.push({
        id,
        pillar: 'installment',
        legacyType: 'financial',
        title: isOverdue
          ? `قسط معوقه درمان ${toPersianDigits(inst.installmentNumber)} از ${toPersianDigits(inst.totalInstallments)} (${formatToman(inst.amount)})`
          : `سررسید قسط درمانی (${formatToman(inst.amount)})`,
        subtitle: `بابت «${inst.treatmentName}» | ${collateralNote} | موعد پرداخت: ${toPersianDigits(inst.dueDate)} (${toPersianDigits(effectiveInstWindow)} روز قبل طبق تنظیمات · ${formatDayCountdownLabel(daysRem)}).`,
        time: `${toPersianDigits(inst.dueDate)} · ${formatDayCountdownLabel(daysRem)}`,
        actionText: 'ارسال پیامک یادآوری قسط',
        patientId: p.id,
        patientName: p.fullName,
        phone: p.phone,
        status: inst.status,
        urgency,
        priorityScore,
        daysRemaining: daysRem,
        exactAmountToman: inst.amount,
        exactAmountMicro: formatExactMicroToman(inst.amount, true),
        isSnoozed: Boolean(snoozedUntilMs),
        snoozedUntilMs,
        sourceType: 'installment',
        sourceEntityId: inst.id,
        targetView: 'financial',
        targetSubModule: 'installments',
        patientTab: 'financial',
        triggerMeta: instTrig
          ? `اعلام یادآور قسط: ${toPersianDigits(instTrig.triggerDate)} (${instPresetLabel})`
          : undefined,
        reminderPresetLabel: instPresetLabel
      });
    }

    // 2C. Lab Orders (Going/Returning + Ready for Clinic)
    for (const lab of p.labOrders || []) {
      if (lab.status === 'delivered_cemented') continue;
      const id = `live-lab-${lab.id}`;
      const snoozedUntilMs = getActiveSnoozedUntil(id);
      const daysToDelivery = lab.deliveryDate ? diffPersianDays(today, lab.deliveryDate) : 99;
      const isReady = lab.status === 'ready_for_clinic';
      const hasCustomLabCfg = Boolean(lab.reminderConfig?.enabled);
      const effectiveLabWindow = hasCustomLabCfg && lab.reminderConfig
        ? Math.max(1, Math.abs(getPresetOffsetDays(lab.reminderConfig.preset)))
        : settings.labDeliveryAdvanceDays;
      const urgencyLabel = isReady
        ? 'آماده تحویل در مطب'
        : daysToDelivery < 0
        ? `تاخیر ${toPersianDigits(Math.abs(daysToDelivery))} روزه`
        : daysToDelivery <= effectiveLabWindow
        ? `در بازه ${toPersianDigits(effectiveLabWindow)} روزه تحویل`
        : `موعد تحویل ${toPersianDigits(lab.deliveryDate)}`;
      const { urgency, priorityScore } = scoreUrgencyFromDays(daysToDelivery, effectiveLabWindow, isReady);
      const labTrig = hasCustomLabCfg && lab.reminderConfig && lab.deliveryDate
        ? computeReminderTriggerDateTime(lab.deliveryDate, '۱۰:۰۰', lab.reminderConfig)
        : null;
      const labPresetLabel = hasCustomLabCfg && lab.reminderConfig
        ? getPresetLabelFa(lab.reminderConfig.preset)
        : `${toPersianDigits(effectiveLabWindow)} روز قبل از تحویل`;

      items.push({
        id,
        pillar: 'lab',
        legacyType: 'lab',
        title: `یادآوری لابراتوار: ${lab.workType} (${lab.toothNumber})`,
        subtitle: `${lab.labName} | وضعیت: ${
          isReady ? 'آماده تحویل در مطب' : lab.status === 'frame_try_in' ? 'آماده پرو فریم‌ورک' : 'در حال ساخت در لابراتوار'
        } | ${urgencyLabel}${lab.trackingSlipCode ? ` · کد قبض: ${toPersianDigits(lab.trackingSlipCode)}` : ''}`,
        time: `${toPersianDigits(lab.deliveryDate || lab.sendDate)} · ${urgencyLabel}`,
        actionText: isReady ? 'ارسال پیامک آماده بودن روکش' : 'پیگیری از لابراتوار',
        patientId: p.id,
        patientName: p.fullName,
        phone: p.phone,
        status: lab.status,
        urgency,
        priorityScore,
        daysRemaining: isReady ? 0 : daysToDelivery,
        isSnoozed: Boolean(snoozedUntilMs),
        snoozedUntilMs,
        sourceType: 'lab',
        sourceEntityId: lab.id,
        targetView: 'lab',
        patientTab: 'lab',
        medicalAlert,
        triggerMeta: labTrig ? `اعلام یادآور لابراتوار: ${toPersianDigits(labTrig.triggerDate)} (${labPresetLabel})` : undefined,
        reminderPresetLabel: labPresetLabel,
        suggestedAppointmentTreatment: `${isReady ? 'تحویل و سمان' : 'پرو فریم‌ورک'} ${lab.workType} (${lab.toothNumber})`,
        suggestedAppointmentUnit: 'یونیت آبی'
      });
    }

    // 2D. Implant Recalls & Post-Op Follow-ups (gated by autoImplantPostOp)
    if (rules.autoImplantPostOp) {
      for (const imp of p.implantCases || []) {
        if (imp.currentStage === 'crown_delivered') continue;
        const id = `live-imp-${imp.id}`;
        const snoozedUntilMs = getActiveSnoozedUntil(id);
        const daysToHeal = imp.healingDueDate ? diffPersianDays(today, imp.healingDueDate) : 30;
        const daysSinceSurgery = imp.surgeryDate ? diffPersianDays(imp.surgeryDate, today) : 999;
        const isPostOpCheckDue = daysSinceSurgery >= 0 && daysSinceSurgery <= settings.postOpFollowupDays + 2 && imp.currentStage === 'fixture_placed';
        const hasCustomImpCfg = Boolean(imp.reminderConfig?.enabled);
        const effectiveImpWindow = hasCustomImpCfg && imp.reminderConfig
          ? Math.max(1, Math.abs(getPresetOffsetDays(imp.reminderConfig.preset)))
          : 5;
        const { urgency, priorityScore } = scoreUrgencyFromDays(daysToHeal, effectiveImpWindow, isPostOpCheckDue && daysSinceSurgery === settings.postOpFollowupDays);
        const impTrig = hasCustomImpCfg && imp.reminderConfig && imp.healingDueDate
          ? computeReminderTriggerDateTime(imp.healingDueDate, '۱۰:۰۰', imp.reminderConfig)
          : null;

        items.push({
          id,
          pillar: 'implant',
          legacyType: 'implant',
          title: `فراخوان مرحله ایمپلنت ${imp.toothNumber} (${imp.brand})`,
          subtitle: `موعد مرحله بعدی (هیلینگ/قالب‌گیری): ${toPersianDigits(imp.healingDueDate)} (${formatDayCountdownLabel(daysToHeal)}) · کنترل جراحی ${toPersianDigits(settings.postOpFollowupDays)} روز پس از کاشت | یادداشت: ${imp.notes}`,
          time: `${toPersianDigits(imp.healingDueDate)} · کنترل ${toPersianDigits(settings.postOpFollowupDays)} روزه`,
          actionText: 'ارسال پیامک فراخوان ایمپلنت',
          patientId: p.id,
          patientName: p.fullName,
          phone: p.phone,
          status: imp.currentStage,
          urgency,
          priorityScore,
          daysRemaining: daysToHeal,
          isSnoozed: Boolean(snoozedUntilMs),
          snoozedUntilMs,
          sourceType: 'implant',
          sourceEntityId: imp.id,
          targetView: 'implant',
          patientTab: 'implant',
          medicalAlert,
          triggerMeta: impTrig ? `اعلام یادآور ایمپلنت: ${toPersianDigits(impTrig.triggerDate)}` : undefined,
          reminderPresetLabel: hasCustomImpCfg && imp.reminderConfig ? getPresetLabelFa(imp.reminderConfig.preset) : undefined,
          suggestedAppointmentTreatment: `مرحله بعدی ایمپلنت ${imp.brand} (${imp.toothNumber})`,
          suggestedAppointmentUnit: 'یونیت جراحی'
        });
      }
    }

    // 2E. Periodic Recall (via nextRecallDate OR overdue lastVisit)
    const recallDaysByNext = p.nextRecallDate ? diffPersianDays(today, p.nextRecallDate) : null;
    const daysSinceLastVisit = p.lastVisit ? diffPersianDays(p.lastVisit, today) : 0;
    const thresholdDays = (p.recallMonths || settings.periodicRecallMonths || 6) * 30;
    if (
      rules.autoRecallInvite &&
      ((recallDaysByNext !== null && recallDaysByNext <= 14) || (p.lastVisit && daysSinceLastVisit >= thresholdDays))
    ) {
      const id = `live-recall-${p.id}`;
      const snoozedUntilMs = getActiveSnoozedUntil(id);
      const effectiveDaysRem = recallDaysByNext !== null ? recallDaysByNext : Math.min(0, thresholdDays - daysSinceLastVisit);
      const { urgency, priorityScore } = scoreUrgencyFromDays(effectiveDaysRem, 7);
      items.push({
        id,
        pillar: 'recall',
        legacyType: 'post_op',
        title: `فراخوان چکاپ دوره‌ای ${toPersianDigits(p.recallMonths || settings.periodicRecallMonths)} ماهه`,
        subtitle: p.nextRecallDate
          ? `تاریخ پیشنهادی ریکال: ${toPersianDigits(p.nextRecallDate)} (${formatDayCountdownLabel(recallDaysByNext!)}) · آخرین مراجعه: ${toPersianDigits(p.lastVisit)}`
          : `آخرین مراجعه: ${toPersianDigits(p.lastVisit)} (${toPersianDigits(daysSinceLastVisit)} روز قبل · آستانه تنظیم‌شده: ${toPersianDigits(settings.periodicRecallMonths)} ماه)`,
        time: p.nextRecallDate ? `${toPersianDigits(p.nextRecallDate)} · توصیه به چکاپ دوره‌ای` : 'توصیه به چکاپ دوره‌ای',
        actionText: 'ارسال پیامک دعوت چکاپ',
        patientId: p.id,
        patientName: p.fullName,
        phone: p.phone,
        status: 'pending',
        urgency,
        priorityScore,
        daysRemaining: effectiveDaysRem,
        isSnoozed: Boolean(snoozedUntilMs),
        snoozedUntilMs,
        targetView: 'patients',
        patientTab: 'treatments',
        medicalAlert,
        suggestedAppointmentTreatment: 'معاینه دوره‌ای و جرم‌گیری ریکال',
        suggestedAppointmentUnit: 'یونیت آبی'
      });
    }
  }

  // 3. Live Scheduled & Missed (no_show) Appointments
  for (const apt of appointments) {
    if (apt.status === 'completed' || apt.status === 'cancelled') continue;
    const matchedPatient = patients.find(p => p.id === apt.patientId || p.fullName === apt.patientName);
    const id = `live-apt-${apt.id}`;
    const snoozedUntilMs = getActiveSnoozedUntil(id);
    const daysDiff = diffPersianDays(today, apt.date);
    const dayStatusLabel = formatDayCountdownLabel(daysDiff);

    if (apt.status === 'no_show') {
      items.push({
        id,
        pillar: 'appointment',
        legacyType: 'post_op',
        title: `پیگیری عدم حضور بیمار (${apt.treatment})`,
        subtitle: `نوبت تاریخ ${toPersianDigits(apt.date)} ساعت ${toPersianDigits(apt.time)} در ${apt.unit} به دلیل عدم حضور بازنشانی نشده است.`,
        time: `${toPersianDigits(apt.date)} · عدم حضور`,
        actionText: 'ارسال پیامک پیگیری نوبت مجدد',
        patientId: matchedPatient?.id || apt.patientId,
        patientName: apt.patientName,
        phone: apt.phone || matchedPatient?.phone || '',
        status: apt.status,
        urgency: 'high',
        priorityScore: 84,
        daysRemaining: daysDiff,
        isSnoozed: Boolean(snoozedUntilMs),
        snoozedUntilMs,
        sourceType: 'appointment',
        targetView: 'appointments',
        patientTab: 'treatments',
        aptDate: apt.date,
        aptTime: apt.time,
        suggestedAppointmentTreatment: apt.treatment,
        suggestedAppointmentUnit: apt.unit
      });
      continue;
    }

    const hasCustomCfg = Boolean(apt.reminderConfig?.enabled);
    if (!rules.autoAptConfirm24h && !hasCustomCfg && apt.status === 'scheduled' && daysDiff > 0) {
      continue;
    }
    const trig = hasCustomCfg ? computeReminderTriggerDateTime(apt.date, apt.time, apt.reminderConfig) : null;
    const presetLabel =
      hasCustomCfg && apt.reminderConfig
        ? getPresetLabelFa(apt.reminderConfig.preset)
        : `${toPersianDigits(settings.appointmentAdvanceHours)} ساعت قبل (پیش‌فرض مطب)`;
    const channelsArr =
      hasCustomCfg && apt.reminderConfig?.channels?.length
        ? apt.reminderConfig.channels
        : (['phone_push', 'in_app'] as const);
    const channelsText = channelsArr
      .map(c => (c === 'phone_push' ? 'نوتیف گوشی' : c === 'sms' ? 'پیامک' : 'برنامه'))
      .join(' · ');
    const triggerMetaText = trig
      ? `اعلام یادآور: ${toPersianDigits(trig.triggerDate)} ساعت ${toPersianDigits(trig.triggerTime)} (${presetLabel})`
      : `زمان‌بندی استاندارد: ${presetLabel}`;
    const customNoteSuffix = apt.reminderConfig?.note ? ` · یادداشت: ${apt.reminderConfig.note}` : '';

    const { urgency, priorityScore } = scoreUrgencyFromDays(daysDiff, Math.ceil(settings.appointmentAdvanceHours / 24), apt.status === 'waiting' || apt.status === 'in_chair');

    items.push({
      id,
      pillar: 'appointment',
      legacyType: 'post_op',
      title: `یادآوری نوبت (${apt.treatment}) · ${dayStatusLabel} ساعت ${toPersianDigits(apt.time)}`,
      subtitle: `تاریخ نوبت: ${toPersianDigits(apt.date)} (${dayStatusLabel}) · ${apt.unit} · ${apt.doctor} | ${triggerMetaText} · کانال‌ها: ${channelsText}${customNoteSuffix}`,
      time: `${toPersianDigits(apt.date)} (${dayStatusLabel}) · ساعت ${toPersianDigits(apt.time)}`,
      actionText: 'ارسال پیامک یادآوری نوبت',
      patientId: matchedPatient?.id || apt.patientId,
      patientName: apt.patientName,
      phone: apt.phone || matchedPatient?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      status: apt.status,
      urgency,
      priorityScore,
      daysRemaining: daysDiff,
      isSnoozed: Boolean(snoozedUntilMs),
      snoozedUntilMs,
      sourceType: 'appointment',
      targetView: 'appointments',
      patientTab: 'treatments',
      triggerMeta: triggerMetaText,
      channelsLabel: channelsText,
      reminderPresetLabel: presetLabel,
      aptDate: apt.date,
      aptTime: apt.time,
      medicalAlert: matchedPatient?.medicalHistory?.length ? matchedPatient.medicalHistory.join('، ') : undefined
    });
  }

  // 4. Inventory Low-Stock & FEFO Near-Expiry Alerts
  for (const inv of inventory) {
    const isLowStock = inv.stock <= inv.minAlert;
    const daysToExpiry = inv.expiryDate ? diffPersianDays(today, inv.expiryDate) : 999;
    const isNearExpiry = Boolean(inv.expiryDate) && daysToExpiry <= settings.inventoryExpiryAdvanceDays;
    if (!isLowStock && !isNearExpiry) continue;

    const id = `live-inv-${inv.id}`;
    const snoozedUntilMs = getActiveSnoozedUntil(id);
    const isOutOrExpired = inv.stock === 0 || daysToExpiry <= 0;
    const { urgency, priorityScore } = scoreUrgencyFromDays(
      isLowStock ? 0 : Math.max(0, daysToExpiry),
      7,
      isOutOrExpired
    );

    const reasonParts: string[] = [];
    if (isLowStock) {
      reasonParts.push(`کسری موجودی (${toPersianDigits(inv.stock)} از حداقل ${toPersianDigits(inv.minAlert)} ${inv.unit})`);
    }
    if (isNearExpiry) {
      reasonParts.push(
        daysToExpiry < 0
          ? `منقضی‌شده (${toPersianDigits(inv.expiryDate)})`
          : `انقضای FEFO در ${toPersianDigits(inv.expiryDate)} (${formatDayCountdownLabel(daysToExpiry)})`
      );
    }

    items.push({
      id,
      pillar: 'inventory',
      legacyType: 'custom',
      title: `هشدار انبار: ${inv.name}`,
      subtitle: `${reasonParts.join(' · ')}${inv.location ? ` · قفسه ${inv.location}` : ''}`,
      time: isNearExpiry ? `انقضا ${toPersianDigits(inv.expiryDate)}` : `موجودی ${toPersianDigits(inv.stock)} ${inv.unit}`,
      actionText: 'ثبت سفارش تامین‌کننده',
      patientName: inv.category || 'انبار کلینیک',
      phone: '',
      status: isOutOrExpired ? 'critical' : 'warning',
      urgency,
      priorityScore,
      daysRemaining: isNearExpiry ? daysToExpiry : 0,
      exactAmountToman: inv.pricePerUnit,
      isSnoozed: Boolean(snoozedUntilMs),
      snoozedUntilMs,
      targetView: 'inventory'
    });
  }

  // 5. Insurance Claims Pending / Submitted Unsettled Tracking
  const savedClaims = safeReadJson<
    Array<{
      id: string;
      patientId?: string;
      patientName: string;
      insurerName: string;
      serviceName: string;
      insuranceShare: number;
      trackingCode: string;
      date: string;
      status: 'pending_review' | 'submitted_xml' | 'paid_settled';
    }>
  >('minadental_insurance_claims_v1', []);

  for (const clm of savedClaims) {
    if (!clm || clm.status === 'paid_settled') continue;
    const daysElapsed = clm.date ? diffPersianDays(clm.date, today) : 0;
    if (clm.status === 'submitted_xml' && daysElapsed < 7) continue;
    const id = `live-ins-${clm.id}`;
    const snoozedUntilMs = getActiveSnoozedUntil(id);
    const { urgency, priorityScore } = scoreUrgencyFromDays(
      clm.status === 'pending_review' ? 0 : Math.min(0, 7 - daysElapsed),
      3,
      daysElapsed >= 14
    );
    items.push({
      id,
      pillar: 'insurance',
      legacyType: 'financial',
      title:
        clm.status === 'pending_review'
          ? `پرونده بیمه آماده ارسال XML (${clm.insurerName})`
          : `پیگیری وصول خسارت بیمه (${clm.insurerName})`,
      subtitle: `${clm.serviceName} · سهم بیمه ${formatToman(clm.insuranceShare)} · کد رهگیری ${toPersianDigits(clm.trackingCode)} (${toPersianDigits(Math.max(0, daysElapsed))} روز از ثبت)`,
      time: `${toPersianDigits(clm.date)} · ${clm.insurerName}`,
      actionText: 'بررسی پرونده بیمه',
      patientId: clm.patientId,
      patientName: clm.patientName,
      phone: '',
      status: clm.status,
      urgency,
      priorityScore,
      daysRemaining: 0,
      exactAmountToman: clm.insuranceShare,
      isSnoozed: Boolean(snoozedUntilMs),
      snoozedUntilMs,
      sourceType: 'insurance',
      targetView: 'insurance_claims',
      patientTab: 'financial'
    });
  }

  // 6. Sterilization & Autoclave CSSD Biological Spore / Bowie-Dick Alerts
  const rulesForDispatch = { ...DEFAULT_AUTOMATION_RULES, ...(settings.automationRules || {}) };
  const savedCssdCycles = safeReadJson<
    Array<{
      id: string;
      cycleCode: string;
      autoclaveDevice: string;
      bowieDickResult: 'pass' | 'fail' | 'pending';
      biologicalSporeTest: 'negative_safe' | 'pending_24h';
      date: string;
      time: string;
    }>
  >('minadental_cssd_cycles_v1', []);

  if (rulesForDispatch.autoCssdQuarantineAlert) {
    for (const cyc of savedCssdCycles) {
      if (!cyc) continue;
      const isFail = cyc.bowieDickResult === 'fail';
      const isPending = cyc.bowieDickResult === 'pending' || cyc.biologicalSporeTest === 'pending_24h';
      if (!isFail && !isPending) continue;
      const id = `live-cssd-${cyc.id}`;
      const snoozedUntilMs = getActiveSnoozedUntil(id);
      items.push({
        id,
        pillar: 'sterilization',
        legacyType: 'custom',
        title: isFail
          ? `هشدار بحرانی کنترل کیفیت اتوکلاو (${cyc.cycleCode})`
          : `جواب تست بیولوژیک اسپور / بووی‌دیک (${cyc.cycleCode})`,
        subtitle: `${cyc.autoclaveDevice} · ${
          isFail ? 'تست Bowie-Dick ناموفق — قرنطینه فوری پک‌ها' : 'در انتظار ثبت نتیجه تست اسپور ۲۴ ساعته'
        }`,
        time: `${toPersianDigits(cyc.date)} · ساعت ${toPersianDigits(cyc.time)}`,
        actionText: 'ثبت نتیجه کنترل عفونت',
        patientName: 'واحد CSSD و اتوکلاو',
        phone: '',
        status: isFail ? 'critical' : 'pending',
        urgency: isFail ? 'critical' : 'high',
        priorityScore: isFail ? 99 : 84,
        daysRemaining: 0,
        isSnoozed: Boolean(snoozedUntilMs),
        snoozedUntilMs,
        sourceType: 'sterilization',
        targetView: 'sterilization'
      });
    }
  }

  // Compute smart escalation tier, predictive risk AI, staff assignment & 2-way confirmation for every item
  const enriched = items.map(item => {
    let escalationLevel: SmartEscalationLevel = 'standard';
    const allowFinEscalation = rules.autoCheckAndInstallmentEscalation;
    if (
      item.urgency === 'critical' &&
      (item.pillar === 'sterilization' ||
        (allowFinEscalation &&
          (item.daysRemaining <= -2 || item.status === 'bounced' || item.status === 'critical')))
    ) {
      escalationLevel = 'manager_escalation';
    } else if (
      (item.urgency === 'critical' || item.urgency === 'high') &&
      (allowFinEscalation || (item.pillar !== 'check' && item.pillar !== 'installment' && item.pillar !== 'debtor'))
    ) {
      escalationLevel = 'sms_queued';
    }

    const assignedTo = assignmentsMap[item.id];
    const confirmationStatus =
      item.pillar === 'appointment' || item.sourceType === 'appointment'
        ? confirmationsMap[item.id] || 'unconfirmed'
        : undefined;

    let noShowRiskPercent: number | undefined;
    let riskHint: string | undefined;
    let priorityScore = item.priorityScore;

    if (
      item.pillar === 'appointment' ||
      item.pillar === 'check' ||
      item.pillar === 'installment' ||
      item.pillar === 'debtor' ||
      item.pillar === 'recall'
    ) {
      const sig =
        (item.patientId ? riskSignalsByPatientKey.get(item.patientId) : undefined) ||
        riskSignalsByPatientKey.get(`name:${item.patientName}`);
      let risk = 10;
      if (sig) {
        risk += sig.noShowCount * 28 + sig.cancelledCount * 14 + sig.overdueInstCount * 18 + sig.bouncedCheckCount * 25;
        if (sig.highDebt) risk += 12;
      }
      if (item.status === 'bounced' || item.status === 'overdue' || item.status === 'no_show') {
        risk += 18;
      }
      if (confirmationStatus === 'reschedule_requested') {
        risk += 24;
        priorityScore = Math.min(100, priorityScore + 6);
      } else if (confirmationStatus === 'confirmed_by_patient') {
        risk = Math.max(5, risk - 18);
      }
      noShowRiskPercent = Math.min(95, Math.max(8, risk));
      if (noShowRiskPercent >= 50) {
        priorityScore = Math.min(100, priorityScore + 10);
        riskHint =
          confirmationStatus === 'reschedule_requested'
            ? `بیمار درخواست تغییر زمان داده است (ریسک غیبت ${toPersianDigits(noShowRiskPercent)}٪) — تماس جهت جابه‌جایی یونیت توصیه می‌شود.`
            : `هوش مصنوعی ریسک غیبت/تاخیر ${toPersianDigits(noShowRiskPercent)}٪ برآورد کرده است — تماس تلفنی مستقیم به جای صرف پیامک توصیه می‌شود.`;
      }
    }

    return {
      ...item,
      priorityScore,
      escalationLevel,
      assignedTo,
      confirmationStatus,
      noShowRiskPercent,
      riskHint
    };
  });

  return enriched
    .filter(item => !dismissedIds[item.id] && (includeSnoozed || !item.isSnoozed))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.daysRemaining - b.daysRemaining);
}

export function getPatientActiveReminders(
  patientId: string,
  params: {
    patients: Patient[];
    appointments: Appointment[];
    inventory?: InventoryItem[];
  }
): SynthesizedClinicReminder[] {
  return synthesizeUnifiedClinicReminders(params).filter(r => r.patientId === patientId);
}

export function getReminderAnalyticsSummary(reminders: SynthesizedClinicReminder[]): ReminderAnalyticsSummary {
  const byPillar: Record<UnifiedReminderPillar, number> = {
    custom: 0,
    appointment: 0,
    check: 0,
    installment: 0,
    debtor: 0,
    lab: 0,
    implant: 0,
    recall: 0,
    inventory: 0,
    insurance: 0,
    sterilization: 0
  };

  let criticalCount = 0;
  let highCount = 0;
  let todayTomorrowCount = 0;
  let financialCount = 0;
  let financialAtRiskToman = 0;
  let sayadChecksCount = 0;
  let guaranteeChecksCount = 0;
  let guaranteeReadyCount = 0;
  let installmentsCount = 0;
  let debtorsCount = 0;
  let labImplantCount = 0;
  let inventoryCount = 0;
  let recallCount = 0;
  let appointmentsCount = 0;
  let insuranceCount = 0;
  let sterilizationCount = 0;

  for (const r of reminders) {
    byPillar[r.pillar] = (byPillar[r.pillar] || 0) + 1;
    if (r.urgency === 'critical') criticalCount++;
    else if (r.urgency === 'high') highCount++;
    if (r.daysRemaining >= 0 && r.daysRemaining <= 1) todayTomorrowCount++;

    if (r.pillar === 'check' || r.pillar === 'installment' || r.pillar === 'debtor') {
      financialCount++;
      financialAtRiskToman += r.exactAmountToman || 0;
      if (r.pillar === 'check') {
        if (r.isGuaranteeCheck) {
          guaranteeChecksCount++;
          if (r.isGuaranteeReadyForReturn) guaranteeReadyCount++;
        } else {
          sayadChecksCount++;
        }
      } else if (r.pillar === 'installment') {
        installmentsCount++;
      } else if (r.pillar === 'debtor') {
        debtorsCount++;
      }
    } else if (r.pillar === 'lab' || r.pillar === 'implant') {
      labImplantCount++;
    } else if (r.pillar === 'inventory') {
      inventoryCount++;
    } else if (r.pillar === 'recall') {
      recallCount++;
    } else if (r.pillar === 'appointment') {
      appointmentsCount++;
    } else if (r.pillar === 'insurance') {
      insuranceCount++;
    } else if (r.pillar === 'sterilization') {
      sterilizationCount++;
    }
  }

  return {
    totalActive: reminders.length,
    criticalCount,
    highCount,
    todayTomorrowCount,
    financialCount,
    financialAtRiskToman,
    sayadChecksCount,
    guaranteeChecksCount,
    guaranteeReadyCount,
    installmentsCount,
    debtorsCount,
    labImplantCount,
    inventoryCount,
    recallCount,
    appointmentsCount,
    insuranceCount,
    sterilizationCount,
    byPillar
  };
}

export function generateDailyClinicDigestText(reminders: SynthesizedClinicReminder[]): string {
  const summary = getReminderAnalyticsSummary(reminders);
  const today = getCurrentPersianDate();
  const topCritical = reminders.filter(r => r.urgency === 'critical').slice(0, 5);
  const lines = [
    `📋 گزارش صبحگاهی و خلاصه یادآوری‌های کلینیک مینادنتال — تاریخ ${toPersianDigits(today)}`,
    `• کل هشدارهای فعال: ${toPersianDigits(summary.totalActive)} مورد (${toPersianDigits(summary.criticalCount)} بحرانی · ${toPersianDigits(summary.highCount)} نزدیک سررسید)`,
    `• سررسید نوبت‌ها: ${toPersianDigits(summary.appointmentsCount)} | لابراتوار و ایمپلنت: ${toPersianDigits(summary.labImplantCount)} | ریکال: ${toPersianDigits(summary.recallCount)}`,
    `• پرونده‌های مالی در معرض وصول (${toPersianDigits(summary.financialCount)} مورد): ${formatToman(summary.financialAtRiskToman)}`,
    `• هشدار انبار و FEFO: ${toPersianDigits(summary.inventoryCount)} | بیمه: ${toPersianDigits(summary.insuranceCount)} | کنترل عفونت CSSD: ${toPersianDigits(summary.sterilizationCount)}`
  ];
  if (topCritical.length > 0) {
    lines.push('', '🚨 اولویت‌های فوری اقدام:');
    topCritical.forEach((item, idx) => {
      lines.push(`${toPersianDigits(idx + 1)}. ${item.title} — ${item.patientName} (${item.time})`);
    });
  }
  return lines.join('\n');
}

export function generateRemindersCsvContent(reminders: SynthesizedClinicReminder[]): string {
  const headers = ['اولویت', 'بخش', 'عنوان یادآوری', 'بیمار / واحد', 'تلفن', 'موعد', 'مبلغ (تومان)', 'شرح کامل'];
  const rows: string[][] = [headers];
  const urgencyMap: Record<SmartUrgencyTier, string> = {
    critical: 'بحرانی و فوری',
    high: 'بالا (نزدیک سررسید)',
    medium: 'متوسط',
    upcoming: 'آینده'
  };
  const pillarMap: Record<UnifiedReminderPillar, string> = {
    appointment: 'نوبت ویزیت',
    check: 'چک صیادی/ضمانت',
    installment: 'قسط درمانی',
    debtor: 'بدهی مطب',
    lab: 'لابراتوار پروتز',
    implant: 'ایمپلنت و جراحی',
    recall: 'ریکال دوره‌ای',
    inventory: 'انبار و FEFO',
    insurance: 'بیمه و خسارت',
    sterilization: 'اتوکلاو و CSSD',
    custom: 'سفارشی / پیگیری'
  };

  for (const r of reminders) {
    rows.push([
      urgencyMap[r.urgency],
      pillarMap[r.pillar],
      r.title,
      r.patientName,
      toEnglishDigits(r.phone || ''),
      r.time,
      r.exactAmountToman ? String(r.exactAmountToman) : '',
      r.subtitle
    ]);
  }
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  return `\uFEFF${rows.map(r => r.map(esc).join(',')).join('\r\n')}`;
}

export async function sendPhoneNotification(params: {
  id: string;
  title: string;
  body: string;
  view?: string;
  patientId?: string;
  tag?: string;
  requireInteraction?: boolean;
}): Promise<boolean> {
  if (getPhoneNotificationPermission() !== 'granted') return false;

  const options: NotificationOptions = {
    body: params.body,
    icon: '/logo.png',
    badge: '/icon.svg',
    dir: 'rtl',
    lang: 'fa-IR',
    tag: params.tag || `minadental-${params.id}`,
    requireInteraction: Boolean(params.requireInteraction),
    data: {
      view: params.view || 'reminders',
      patientId: params.patientId,
      reminderId: params.id
    }
  };

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 1200))
      ]);
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(params.title, options);
        return true;
      }
    }
  } catch {
    // Fallback to Notification constructor below
  }

  try {
    new window.Notification(params.title, options);
    return true;
  } catch {
    return false;
  }
}

export async function evaluateAndDispatchDuePhoneNotifications(params: {
  patients: Patient[];
  appointments: Appointment[];
  inventory?: InventoryItem[];
}): Promise<number> {
  if (typeof window === 'undefined') return 0;
  const permission = getPhoneNotificationPermission();
  const settings = getReminderSettings();
  const today = getCurrentPersianDate();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const quietNow = isWithinQuietHours(settings, now);
  let dispatched = 0;

  const candidates: Array<{
    dedupKey: string;
    id: string;
    title: string;
    body: string;
    view: string;
    patientId?: string;
    requireInteraction?: boolean;
    channels?: ReminderChannel[];
    patientName?: string;
    patientPhone?: string;
    smsPattern?: 'appointment_reminder' | 'sayad_check_due' | 'installment_due' | 'lab_ready' | 'implant_healing_recall';
    smsTokens?: Record<string, string>;
  }> = [];

  // 1. Explicit / Custom scheduled reminders
  const customList = getCustomReminders();
  for (const rem of customList) {
    if (rem.status === 'done') continue;
    if (isReminderCurrentlySnoozed(rem.id)) continue;
    if (!rem.channels.includes('phone_push') && !rem.channels.includes('sms')) continue;
    const cmp = comparePersianDates(rem.triggerDate, today);
    const timeDue = cmp < 0 || (cmp === 0 && (!rem.triggerTime || parseTimeMinutes(rem.triggerTime) <= nowMinutes));
    if (timeDue) {
      const remSmsPattern =
        rem.sourceType === 'check'
          ? 'sayad_check_due'
          : rem.sourceType === 'installment' || rem.sourceType === 'payment'
          ? 'installment_due'
          : rem.sourceType === 'lab'
          ? 'lab_ready'
          : rem.sourceType === 'implant'
          ? 'implant_healing_recall'
          : 'appointment_reminder';
      candidates.push({
        dedupKey: `custom::${rem.id}::${today}`,
        id: rem.id,
        title: `یادآوری: ${rem.title}`,
        body: `${rem.patientName} · ${rem.description}`,
        view: rem.targetView || 'reminders',
        patientId: rem.patientId,
        channels: rem.channels,
        patientName: rem.patientName,
        patientPhone: rem.patientPhone,
        smsPattern: remSmsPattern,
        smsTokens: { date: rem.targetDate || today, dueDate: rem.targetDate || today, time: rem.targetTime || rem.triggerTime || '' }
      });
    }
  }

  const rulesEval = { ...DEFAULT_AUTOMATION_RULES, ...(settings.automationRules || {}) };

  // 2. Active Appointments within appointmentAdvanceHours or today (excludes completed/cancelled/no_show)
  for (const apt of params.appointments) {
    if (apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show') continue;
    const aptRemId = `live-apt-${apt.id}`;
    if (isReminderCurrentlySnoozed(aptRemId)) continue;
    const aptMins = parseTimeMinutes(apt.time);
    const advanceMins = (settings.appointmentAdvanceHours || 2) * 60;
    const customConfig = apt.reminderConfig;
    if (!rulesEval.autoAptConfirm24h && !(customConfig && customConfig.enabled)) continue;

    let isDue = false;
    if (customConfig && customConfig.enabled) {
      if (!customConfig.channels.includes('phone_push') && !customConfig.channels.includes('sms')) continue;
      const trig = computeReminderTriggerDateTime(apt.date, apt.time, customConfig);
      const cmp = comparePersianDates(trig.triggerDate, today);
      isDue = cmp < 0 || (cmp === 0 && parseTimeMinutes(trig.triggerTime) <= nowMinutes);
    } else if (isSamePersianDate(apt.date, today)) {
      isDue = aptMins - nowMinutes <= advanceMins && aptMins >= nowMinutes - 15;
    }

    if (isDue) {
      candidates.push({
        dedupKey: `apt::${apt.id}::${today}`,
        id: aptRemId,
        title: `نوبت مطب (${apt.time}): ${apt.patientName}`,
        body: `${apt.treatment} · ${apt.unit} · ${apt.doctor}`,
        view: 'appointments',
        patientId: apt.patientId,
        channels: customConfig?.channels,
        patientName: apt.patientName,
        patientPhone: apt.phone,
        smsPattern: 'appointment_reminder',
        smsTokens: { date: apt.date, time: apt.time, doctor: apt.doctor }
      });
    }
  }

  // 3. Patient records: Sayad/Guarantee Checks, Installments, Lab, Implants
  for (const pat of params.patients) {
    for (const chk of pat.sayadChecks || []) {
      if (chk.status !== 'in_collection' && chk.status !== 'bounced') continue;
      const chkRemId = `live-chk-${chk.id}`;
      if (isReminderCurrentlySnoozed(chkRemId) || isReminderCurrentlySnoozed(`chk-${chk.id}`)) continue;
      const daysUntil = diffPersianDays(today, chk.dueDate);
      const windowDays = chk.reminderConfig?.enabled
        ? Math.max(1, Math.abs(getPresetOffsetDays(chk.reminderConfig.preset)))
        : chk.isGuarantee
        ? settings.guaranteeCheckAdvanceDays
        : settings.checkAdvanceDays;
      if (chk.status === 'bounced' || daysUntil <= windowDays) {
        candidates.push({
          dedupKey: `chk::${chk.id}::${today}`,
          id: chkRemId,
          title:
            chk.status === 'bounced'
              ? `هشدار ${chk.isGuarantee ? 'چک ضمانت' : 'چک صیادی'} برگشتی: ${pat.fullName}`
              : `سررسید ${chk.isGuarantee ? 'چک ضمانت امانی' : 'چک صیادی'}: ${pat.fullName}`,
          body: `بانک ${chk.bankName} · سررسید ${chk.dueDate}`,
          view: 'financial',
          patientId: pat.id,
          requireInteraction: chk.status === 'bounced',
          channels: chk.reminderConfig?.channels,
          patientName: pat.fullName,
          patientPhone: pat.phone,
          smsPattern: 'sayad_check_due',
          smsTokens: { amount: formatToman(chk.amount), dueDate: chk.dueDate }
        });
      }
    }

    for (const inst of pat.installments || []) {
      if (inst.status === 'paid') continue;
      const instRemId = `live-inst-${inst.id}`;
      if (isReminderCurrentlySnoozed(instRemId) || isReminderCurrentlySnoozed(`inst-${inst.id}`)) continue;
      const daysUntil = diffPersianDays(today, inst.dueDate);
      const instWindow = inst.reminderConfig?.enabled
        ? Math.max(1, Math.abs(getPresetOffsetDays(inst.reminderConfig.preset)))
        : settings.installmentAdvanceDays;
      if (inst.status === 'overdue' || daysUntil <= instWindow) {
        candidates.push({
          dedupKey: `inst::${inst.id}::${today}`,
          id: instRemId,
          title: inst.status === 'overdue' ? `قسط معوقه: ${pat.fullName}` : `سررسید قسط ${toPersianDigits(inst.installmentNumber)}: ${pat.fullName}`,
          body: `${inst.treatmentName} · تاریخ ${inst.dueDate}`,
          view: 'financial',
          patientId: pat.id,
          channels: inst.reminderConfig?.channels,
          patientName: pat.fullName,
          patientPhone: pat.phone,
          smsPattern: 'installment_due',
          smsTokens: { amount: formatToman(inst.amount), dueDate: inst.dueDate }
        });
      }
    }

    for (const lab of pat.labOrders || []) {
      if (lab.status === 'delivered_cemented') continue;
      const labRemId = `live-lab-${lab.id}`;
      if (isReminderCurrentlySnoozed(labRemId) || isReminderCurrentlySnoozed(`lab-${lab.id}`)) continue;
      const daysUntil = diffPersianDays(today, lab.deliveryDate);
      const labWindow = lab.reminderConfig?.enabled
        ? Math.max(1, Math.abs(getPresetOffsetDays(lab.reminderConfig.preset)))
        : settings.labDeliveryAdvanceDays;
      if (lab.status === 'ready_for_clinic' || daysUntil <= labWindow) {
        candidates.push({
          dedupKey: `lab::${lab.id}::${lab.status}::${today}`,
          id: labRemId,
          title:
            lab.status === 'ready_for_clinic'
              ? `پروتز آماده در مطب: ${pat.fullName}`
              : `پیگیری تحویل لابراتوار: ${pat.fullName}`,
          body: `${lab.workType} (${lab.toothNumber}) · لابراتوار ${lab.labName}`,
          view: 'lab',
          patientId: pat.id,
          channels: lab.reminderConfig?.channels,
          patientName: pat.fullName,
          patientPhone: pat.phone,
          smsPattern: 'lab_ready',
          smsTokens: { date: lab.deliveryDate || today }
        });
      }
    }

    if (rulesEval.autoImplantPostOp) {
      for (const imp of pat.implantCases || []) {
        if (imp.currentStage === 'crown_delivered') continue;
        const impRemId = `live-imp-${imp.id}`;
        if (isReminderCurrentlySnoozed(impRemId) || isReminderCurrentlySnoozed(`imp-${imp.id}`)) continue;
        const daysUntil = diffPersianDays(today, imp.healingDueDate);
        const impWindow = imp.reminderConfig?.enabled
          ? Math.max(1, Math.abs(getPresetOffsetDays(imp.reminderConfig.preset)))
          : 3;
        if (daysUntil <= impWindow) {
          candidates.push({
            dedupKey: `imp::${imp.id}::${today}`,
            id: impRemId,
            title: `پیگیری مرحله ایمپلنت: ${pat.fullName}`,
            body: `${imp.brand} (${imp.toothNumber}) · موعد ${imp.healingDueDate}`,
            view: 'implant',
            patientId: pat.id,
            channels: imp.reminderConfig?.channels,
            patientName: pat.fullName,
            patientPhone: pat.phone,
            smsPattern: 'implant_healing_recall',
            smsTokens: { date: imp.healingDueDate || today }
          });
        }
      }
    }
    if (rulesEval.autoRecallInvite && pat.nextRecallDate) {
      const recallRemId = `live-recall-${pat.id}`;
      if (!isReminderCurrentlySnoozed(recallRemId)) {
        const daysToRecall = diffPersianDays(today, pat.nextRecallDate);
        if (daysToRecall <= 3) {
          candidates.push({
            dedupKey: `recall::${pat.id}::${today}`,
            id: recallRemId,
            title: `فراخوان چکاپ دوره‌ای: ${pat.fullName}`,
            body: `موعد معاینه دوره‌ای ${toPersianDigits(pat.nextRecallDate)}`,
            view: 'patients',
            patientId: pat.id,
            patientName: pat.fullName,
            patientPhone: pat.phone
          });
        }
      }
    }
  }

  // 4. Inventory Critical Low Stock & Near-Expiry FEFO Alerts
  for (const inv of params.inventory || []) {
    const invRemId = `live-inv-${inv.id}`;
    if (isReminderCurrentlySnoozed(invRemId)) continue;
    const isLow = inv.stock <= inv.minAlert;
    const daysExp = inv.expiryDate ? diffPersianDays(today, inv.expiryDate) : 999;
    const isExp = Boolean(inv.expiryDate) && daysExp <= Math.min(7, settings.inventoryExpiryAdvanceDays);
    if (isLow || isExp) {
      candidates.push({
        dedupKey: `inv::${inv.id}::${today}`,
        id: invRemId,
        title: isLow ? `کسری بحرانی انبار: ${inv.name}` : `انقضای نزدیک کالا: ${inv.name}`,
        body: isLow ? `موجودی ${toPersianDigits(inv.stock)} ${inv.unit}` : `انقضا ${toPersianDigits(inv.expiryDate)}`,
        view: 'inventory',
        requireInteraction: inv.stock === 0 || daysExp <= 0
      });
    }
  }

  // 5. Insurance Claims Pending XML or Unsettled > 7 Days
  const savedClaims = safeReadJson<
    Array<{
      id: string;
      patientId?: string;
      patientName: string;
      insurerName: string;
      serviceName: string;
      insuranceShare: number;
      trackingCode: string;
      date: string;
      status: 'pending_review' | 'submitted_xml' | 'paid_settled';
    }>
  >('minadental_insurance_claims_v1', []);

  for (const clm of savedClaims) {
    if (!clm || clm.status === 'paid_settled') continue;
    const insRemId = `live-ins-${clm.id}`;
    if (isReminderCurrentlySnoozed(insRemId)) continue;
    const daysElapsed = clm.date ? diffPersianDays(clm.date, today) : 0;
    if (clm.status === 'pending_review' || daysElapsed >= 7) {
      candidates.push({
        dedupKey: `ins::${clm.id}::${today}`,
        id: insRemId,
        title:
          clm.status === 'pending_review'
            ? `پرونده بیمه آماده ارسال XML: ${clm.patientName}`
            : `پیگیری خسارت بیمه (${clm.insurerName})`,
        body: `${clm.serviceName} · سهم بیمه ${formatToman(clm.insuranceShare)}`,
        view: 'insurance_claims',
        patientId: clm.patientId,
        patientName: clm.patientName
      });
    }
  }

  // 6. Sterilization CSSD Failures & 24h Biological Spore Alerts
  if (rulesEval.autoCssdQuarantineAlert) {
    const savedCssd = safeReadJson<
      Array<{
        id: string;
        cycleCode: string;
        autoclaveDevice: string;
        bowieDickResult: 'pass' | 'fail' | 'pending';
        biologicalSporeTest: 'negative_safe' | 'pending_24h';
        date: string;
        time: string;
      }>
    >('minadental_cssd_cycles_v1', []);

    for (const cyc of savedCssd) {
      if (!cyc) continue;
      const isFail = cyc.bowieDickResult === 'fail';
      const isPending = cyc.bowieDickResult === 'pending' || cyc.biologicalSporeTest === 'pending_24h';
      if (!isFail && !isPending) continue;
      const cssdRemId = `live-cssd-${cyc.id}`;
      if (isReminderCurrentlySnoozed(cssdRemId)) continue;
      candidates.push({
        dedupKey: `cssd::${cyc.id}::${today}`,
        id: cssdRemId,
        title: isFail ? `قرنطینه فوری اتوکلاو (${cyc.cycleCode})` : `ثبت جواب تست اسپور اتوکلاو (${cyc.cycleCode})`,
        body: `${cyc.autoclaveDevice} · ساعت ${toPersianDigits(cyc.time)}`,
        view: 'sterilization',
        requireInteraction: isFail
      });
    }
  }

  let hasCriticalDispatched = false;
  for (const item of candidates) {
    if (hasNotificationFired(item.dedupKey)) continue;
    let sentAny = false;
    if (permission === 'granted' && (!item.channels || item.channels.includes('phone_push'))) {
      const ok = await sendPhoneNotification(item);
      if (ok) sentAny = true;
    }
    if (!quietNow && item.channels?.includes('sms') && item.patientPhone) {
      try {
        await clinicalSmsService.sendPatternSms(
          item.patientPhone,
          item.patientName || 'بیمار گرامی',
          item.smsPattern || 'appointment_reminder',
          item.smsTokens || {
            date: today,
            time: '',
            doctor: item.title
          }
        );
        sentAny = true;
      } catch {
        // Silent fallback if SMS gateway is offline
      }
    }
    if (sentAny) {
      markNotificationFired(item.dedupKey);
      dispatched++;
      if (item.requireInteraction) {
        hasCriticalDispatched = true;
      }
    }
  }

  if (hasCriticalDispatched) {
    playCriticalAlarmChime('critical');
  }

  return dispatched;
}
