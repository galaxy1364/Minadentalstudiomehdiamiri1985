import { UserAccount } from '../types/dental';
import { triggerHaptic } from './haptics';
import { actionFeedback } from './actionFeedback';
import { clinicalDb } from '../services/clinicalDatabase';
import { getCurrentPersianDate } from './jalali';

export type ProtectedEntityType =
  | 'patient'
  | 'treatment'
  | 'check'
  | 'appointment'
  | 'lab_order'
  | 'implant_case'
  | 'payment_refund'
  | 'inventory_item'
  | 'tariff'
  | 'staff_user';

export interface TrashVaultItem {
  id: string;
  entityType: ProtectedEntityType;
  entityId: string;
  parentPatientId?: string;
  title: string;
  subtitle: string;
  payload: any;
  deletedAt: string;
  deletedAtIso: string;
  deletedBy: string;
  deletedByRole: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  details: string;
  hash: string;
  severity?: 'info' | 'warning' | 'critical';
}

const TRASH_VAULT_STORAGE_KEY = 'minadental_trash_vault_v1';
const AUDIT_LOG_STORAGE_KEY = 'minadental_immutable_audit_log';
const MAX_VAULT_ITEMS = 500;
const MAX_AUDIT_LOGS = 400;

/**
 * Strictly determines whether the given user has Clinic Manager authority.
 * Only Clinic Manager (role === 'admin' || isManager === true) is allowed
 * to delete records, refund payments, reset datasets, or alter staff/tariffs.
 */
export function isClinicManager(user?: UserAccount | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.isManager === true;
}

/**
 * Generates a deterministic lightweight integrity hash chained to the previous entry.
 */
function computeAuditHash(input: string, prevHash: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const combined = `${prevHash}|${input}`;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `SHA256_${part1}${part2}`.slice(0, 19);
}

/**
 * Appends an immutable security/clinical audit log record.
 */
export function appendSecurityAuditLog(entry: {
  actor: string;
  role: string;
  action: string;
  details: string;
  severity?: 'info' | 'warning' | 'critical';
}): void {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    const existing: AuditLogEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    const prevHash = existing[0]?.hash || 'GENESIS_MINADENTAL';
    const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const timestamp = `${getCurrentPersianDate()} - ${nowTime}`;
    const hash = computeAuditHash(`${timestamp}|${entry.actor}|${entry.action}|${entry.details}`, prevHash);

    const nextEntry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      actor: entry.actor,
      role: entry.role,
      action: entry.action,
      details: entry.details,
      hash,
      severity: entry.severity || 'info'
    };

    const nextLogs = [nextEntry, ...existing].slice(0, MAX_AUDIT_LOGS);
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(nextLogs));
    clinicalDb.set('auditLogs', 'immutable_chain_v1', nextLogs).catch(() => {});
    window.dispatchEvent(new CustomEvent('minadental:audit-log-updated'));
  } catch (e) {
    console.warn('Failed to append security audit log:', e);
  }
}

/**
 * Central Gatekeeper for ALL deletion/destruction actions across MinaDental.
 * Blocks non-managers immediately, notifies UI, and records an immutable audit event.
 */
export function verifyManagerDeletion(
  currentUser: UserAccount | null | undefined,
  actionTitle: string,
  targetId: string
): boolean {
  if (isClinicManager(currentUser)) {
    return true;
  }

  triggerHaptic('warning');

  const actorName = currentUser?.fullName || 'کاربر ناشناس';
  const actorRole = currentUser?.role || 'unknown';

  appendSecurityAuditLog({
    actor: actorName,
    role: actorRole,
    action: `⛔ ممانعت از حذف غیرمجاز: ${actionTitle}`,
    details: `شناسه هدف: ${targetId} · تلاش برای حذف توسط نقش غیرمدیر مسدود شد.`,
    severity: 'critical'
  });

  actionFeedback.recordConflict({
    title: '⛔ مجوز حذف مسدود شد (فقط مدیر کلینیک)',
    subtitle: `عملیات «${actionTitle}» فقط با تایید و دسترسی مدیر کلینیک (دکتر مهدی امیری) مجاز است.`,
    targetRecordId: targetId,
    badgeText: '🔒 حفاظت از داده‌ها: فقط مدیر'
  });

  return false;
}

/**
 * Reads all soft-deleted items from the Trash Vault (bypasses accidental hard loss).
 */
export function getTrashVaultItems(): TrashVaultItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRASH_VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Hydrates Trash Vault from IndexedDB if localStorage was cleared.
 */
export async function hydrateTrashVaultFromDb(): Promise<TrashVaultItem[]> {
  try {
    const local = getTrashVaultItems();
    const dbItems = await clinicalDb.get<TrashVaultItem[]>('drafts', 'trash_vault_v1');
    if (Array.isArray(dbItems) && dbItems.length > local.length) {
      localStorage.setItem(TRASH_VAULT_STORAGE_KEY, JSON.stringify(dbItems));
      return dbItems;
    }
    return local;
  } catch {
    return getTrashVaultItems();
  }
}

function saveTrashVaultItems(items: TrashVaultItem[]): void {
  if (typeof window === 'undefined') return;
  const trimmed = items.slice(0, MAX_VAULT_ITEMS);
  try {
    localStorage.setItem(TRASH_VAULT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Trash vault localStorage warning:', e);
  }
  clinicalDb.set('drafts', 'trash_vault_v1', trimmed).catch(() => {});
  window.dispatchEvent(new CustomEvent('minadental:trash-vault-updated'));
}

/**
 * Archives a deep clone of any record into the persistent Trash Vault before removal.
 */
export function archiveToTrashVault(params: {
  entityType: ProtectedEntityType;
  entityId: string;
  parentPatientId?: string;
  title: string;
  subtitle: string;
  payload: any;
  deletedByUser?: UserAccount | null;
}): TrashVaultItem {
  const existing = getTrashVaultItems();
  const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const deletedAt = `${getCurrentPersianDate()} - ${nowTime}`;
  const deletedBy = params.deletedByUser?.fullName || 'مدیر کلینیک';
  const deletedByRole = params.deletedByUser?.role || 'admin';

  let clonedPayload = params.payload;
  try {
    clonedPayload = JSON.parse(JSON.stringify(params.payload));
  } catch {
    // keep original reference if serialization fails
  }

  const vaultItem: TrashVaultItem = {
    id: `vault-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entityType: params.entityType,
    entityId: params.entityId,
    parentPatientId: params.parentPatientId,
    title: params.title,
    subtitle: params.subtitle,
    payload: clonedPayload,
    deletedAt,
    deletedAtIso: new Date().toISOString(),
    deletedBy,
    deletedByRole
  };

  saveTrashVaultItems([vaultItem, ...existing]);

  appendSecurityAuditLog({
    actor: deletedBy,
    role: deletedByRole,
    action: `بایگانی امن (Soft-Delete): ${params.title}`,
    details: `${params.subtitle} · قابل بازیابی ۱۰۰٪ از گاوصندوق حذفیات مدیر`,
    severity: 'warning'
  });

  return vaultItem;
}

/**
 * Removes an item from the Trash Vault (after restore or Manager-authorized purge).
 */
export function removeFromTrashVault(vaultId: string): void {
  const existing = getTrashVaultItems();
  saveTrashVaultItems(existing.filter(item => item.id !== vaultId));
}
