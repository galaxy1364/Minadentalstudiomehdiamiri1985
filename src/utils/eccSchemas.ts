/**
 * MinaDental ECC Runtime Boundary Schemas (Zod v4)
 * Enforces affaan-m/ecc security-review standards at every untrusted input boundary:
 *  - Backup JSON Restore (prototype pollution stripping + structural validation)
 *  - Supabase Cloud Endpoint Config (HTTPS-only + SSRF private/metadata IP blocking)
 *  - Server-Side Gemini AI Consultation payloads
 */

import { z } from 'zod';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strips prototype-pollution keys from any parsed JSON value.
 */
export function stripDangerousObjectKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripDangerousObjectKeys(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      clean[k] = stripDangerousObjectKeys(v);
    }
    return clean as T;
  }
  return value;
}

/**
 * Checks whether a hostname targets private network, loopback, or cloud metadata SSRF ranges.
 */
function isBlockedPrivateOrMetadataHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'metadata.goog' ||
    host === '0.0.0.0' ||
    host === '::' ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return true;
  }

  // IPv4 private / link-local / carrier-grade NAT blocks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (AWS/GCP/Azure metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
    if (a === 127) return true; // 127.0.0.0/8
  }

  return false;
}

export const safeSupabaseUrlSchema = z
  .string()
  .trim()
  .min(10, 'آدرس سرور سوپابیس کوتاه و نامعتبر است.')
  .max(512, 'آدرس سرور سوپابیس بیش از حد مجاز طولانی است.')
  .superRefine((val, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(val);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'فرمت آدرس Supabase URL نامعتبر است.',
      });
      return;
    }

    const isLocalhostDev =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    if (parsed.protocol !== 'https:' && !isLocalhostDev) {
      ctx.addIssue({
        code: 'custom',
        message: 'اتصال به سرور ابری فقط از طریق پروتکل امن HTTPS مجاز است.',
      });
      return;
    }

    if (!isLocalhostDev && isBlockedPrivateOrMetadataHost(parsed.hostname)) {
      ctx.addIssue({
        code: 'custom',
        message: 'آدرس‌های شبکه داخلی یا متادیتای ابری به دلایل امنیتی مسدود هستند.',
      });
    }
  });

export const safeSupabaseConfigSchema = z.object({
  url: safeSupabaseUrlSchema,
  anonKey: z
    .string()
    .trim()
    .min(16, 'کلید عمومی Supabase Anon Key معتبر نیست.')
    .max(2048, 'طول کلید عمومی بیش از حد مجاز است.')
    .regex(/^[A-Za-z0-9._-]+$/, 'کلید عمومی حاوی کاراکترهای غیرمجاز است.'),
});

export function validateSupabaseConfigInput(
  url: string,
  anonKey: string
): { ok: true; data: { url: string; anonKey: string } } | { ok: false; error: string } {
  const res = safeSupabaseConfigSchema.safeParse({ url, anonKey });
  if (!res.success) {
    return {
      ok: false,
      error: res.error.issues[0]?.message || 'پیکربندی سوپابیس نامعتبر است.',
    };
  }
  return { ok: true, data: res.data };
}

const backupPatientSchema = z
  .object({
    id: z.string().min(1).max(120),
    fullName: z.string().min(1).max(200),
    phone: z.string().max(40).optional().default(''),
    fileNumber: z.string().max(60).optional().default('D-1000'),
    totalCost: z.number().finite().min(0).optional().default(0),
    paidAmount: z.number().finite().min(0).optional().default(0),
    balance: z.number().finite().optional().default(0),
  })
  .passthrough();

const backupAppointmentSchema = z
  .object({
    id: z.string().min(1).max(120),
    patientName: z.string().min(1).max(200),
    date: z.string().min(1).max(40),
    time: z.string().min(1).max(20),
  })
  .passthrough();

const backupInventorySchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    stock: z.number().finite().min(0),
  })
  .passthrough();

export const clinicBackupRestoreSchema = z
  .object({
    version: z.string().max(40).optional(),
    exportedAt: z.string().max(80).optional(),
    clinicName: z.string().max(200).optional(),
    patients: z.array(backupPatientSchema).max(50000),
    appointments: z.array(backupAppointmentSchema).max(100000),
    inventory: z.array(backupInventorySchema).max(20000).optional(),
    users: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(500).optional(),
    platforms: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(200).optional(),
  })
  .passthrough();

const MAX_BACKUP_JSON_BYTES = 15 * 1024 * 1024; // 15MB safety cap

export function parseAndValidateClinicBackup(
  rawJson: string
): { ok: true; data: z.infer<typeof clinicBackupRestoreSchema> } | { ok: false; error: string } {
  if (!rawJson || typeof rawJson !== 'string') {
    return { ok: false, error: 'محتوای فایل پشتیبان خالی است.' };
  }
  if (rawJson.length > MAX_BACKUP_JSON_BYTES) {
    return { ok: false, error: 'حجم فایل پشتیبان بیش از سقف ایمن ۱۵ مگابایت است.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'ساختار JSON فایل پشتیبان نامعتبر یا آسیب‌دیده است.' };
  }

  const sanitized = stripDangerousObjectKeys(parsed);
  const validated = clinicBackupRestoreSchema.safeParse(sanitized);
  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    return {
      ok: false,
      error: `اعتبارسنجی ساختار بکاپ ناموفق بود (${firstIssue?.path?.join('.') || 'root'}): ${firstIssue?.message || 'فرمت نامعتبر'}`,
    };
  }

  return { ok: true, data: validated.data };
}

export const aiConsultRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, 'لطفاً پرسش بالینی خود را وارد کنید.')
    .max(4000, 'طول پرسش بیش از سقف مجاز ۴۰۰۰ کاراکتر است.'),
  patientContext: z
    .object({
      fullName: z.string().max(160).optional(),
      age: z.number().finite().min(0).max(130).optional(),
      medicalHistory: z.array(z.string().max(160)).max(30).optional(),
      activeTreatments: z.string().max(1000).optional(),
      activeImplants: z.string().max(1000).optional(),
      activeLabs: z.string().max(1000).optional(),
    })
    .optional(),
});

export type AiConsultRequest = z.infer<typeof aiConsultRequestSchema>;

export const clinicDataModeSchema = z.enum(['demo_seeded', 'live_production']);
export type ClinicDataMode = z.infer<typeof clinicDataModeSchema>;

export const clinicLiveSyncPayloadSchema = z.object({
  clientId: z.string().trim().min(4).max(120),
  actorName: z.string().trim().min(1).max(160).optional().default('کاربر کلینیک'),
  actorRole: z.string().trim().min(1).max(60).optional().default('staff'),
  baseRevision: z.number().int().min(0).optional(),
  mode: clinicDataModeSchema.optional(),
  patients: z.array(backupPatientSchema).max(50000).optional(),
  appointments: z.array(backupAppointmentSchema).max(100000).optional(),
  inventory: z.array(backupInventorySchema).max(20000).optional(),
  users: z.array(z.object({ id: z.string().min(1).max(120) }).passthrough()).max(500).optional(),
  clinicConfig: z.record(z.string().max(80), z.unknown()).optional(),
  deletedPatientIds: z.array(z.string().max(120)).max(5000).optional(),
  deletedAppointmentIds: z.array(z.string().max(120)).max(10000).optional(),
});

export type ClinicLiveSyncPayload = z.infer<typeof clinicLiveSyncPayloadSchema>;

export const clinicModeSwitchSchema = z.object({
  clientId: z.string().trim().min(4).max(120),
  actorName: z.string().trim().min(1).max(160),
  isManager: z.boolean(),
  mode: clinicDataModeSchema,
  preserveInventory: z.boolean().optional().default(true),
  inventory: z.array(backupInventorySchema).max(20000).optional(),
});

export const smsDispatchRequestSchema = z.object({
  provider: z.enum(['kavenegar', 'farazsms', 'melipayamak']),
  recipientMobile: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل گیرنده باید ۱۱ رقم و با ۰۹ شروع شود.'),
  recipientName: z.string().trim().min(1).max(160),
  messageText: z.string().trim().min(2).max(1000),
  patternCode: z.string().trim().max(60).optional().default('minacare'),
  senderNumber: z.string().trim().max(30).optional().default('10008585'),
  apiKey: z.string().trim().max(256).optional(),
});

export type SmsDispatchRequest = z.infer<typeof smsDispatchRequestSchema>;

export const SAFE_BACKUP_SNAPSHOT_ID_REGEX = /^snap-[a-zA-Z0-9_-]{4,64}$/;

export const serverBackupCreateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional().default('اسنپ‌شات دستی مدیر کلینیک'),
  actorName: z.string().trim().min(1).max(160).optional().default('دکتر مهدی امیری'),
});

export const serverBackupRestoreSchema = z.object({
  snapshotId: z
    .string()
    .trim()
    .regex(SAFE_BACKUP_SNAPSHOT_ID_REGEX, 'شناسه فایل پشتیبان نامعتبر است.'),
  actorName: z.string().trim().min(1).max(160),
  isManager: z.boolean(),
  clientId: z.string().trim().min(4).max(120).optional(),
});

export const incomingCallWebhookSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(7, 'شماره تماس ورودی کوتاه است.')
    .max(30, 'شماره تماس ورودی نامعتبر است.'),
  lineName: z.string().trim().max(80).optional().default('خط اصلی پذیرش مطب'),
  sourceClientId: z.string().trim().max(120).optional(),
});

export const serverAuditEventCreateSchema = z.object({
  actor: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(60).optional().default('staff'),
  category: z
    .enum(['sync', 'security', 'backup', 'clinical', 'financial', 'telephony', 'sms'])
    .optional()
    .default('security'),
  action: z.string().trim().min(2).max(200),
  details: z.string().trim().max(600).optional().default(''),
  severity: z.enum(['info', 'warning', 'critical']).optional().default('info'),
});




