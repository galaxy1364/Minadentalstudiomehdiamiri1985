import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  clinicAppointments,
  clinicAuditLogs,
  clinicBackups,
  clinicInventory,
  clinicMembers,
  clinicPatients,
  clinicWorkspaces,
} from './schema.ts';
import type { ClinicDataMode } from '../utils/eccSchemas.ts';

export type ClinicMemberRole = 'manager' | 'doctor' | 'secretary' | 'assistant';

export interface SqlClinicStoreSnapshot {
  initialized: boolean;
  revision: number;
  mode: ClinicDataMode;
  updatedAt: string;
  updatedBy: string;
  patients: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  users: Record<string, unknown>[];
  clinicConfig: Record<string, unknown>;
}

export interface SqlClinicMemberRecord {
  id: number;
  workspaceId: number;
  email: string;
  userId: number | null;
  displayName: string;
  role: ClinicMemberRole;
  canEditPrices: boolean;
  isActive: boolean;
  isOwner: boolean;
  invitedBy: string;
  createdAt: string;
}

export interface ResolvedClinicWorkspaceContext {
  workspaceId: number;
  ownerUserId: number;
  clinicName: string;
  memberRole: ClinicMemberRole;
  canEditPrices: boolean;
  isOwner: boolean;
  isManager: boolean;
  store: SqlClinicStoreSnapshot;
}

export interface SqlBackupMeta {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
  revision: number;
  mode: ClinicDataMode;
  patientsCount: number;
  appointmentsCount: number;
  inventoryCount: number;
  bytes: number;
}

export interface SqlAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  category: string;
  action: string;
  details: string;
  severity: string;
}

const VALID_ROLES = new Set<ClinicMemberRole>([
  'manager',
  'doctor',
  'secretary',
  'assistant',
]);

const UPSERT_BATCH_SIZE = 100;

export function normalizeMemberRole(role: unknown): ClinicMemberRole {
  if (typeof role === 'string' && VALID_ROLES.has(role as ClinicMemberRole)) {
    return role as ClinicMemberRole;
  }
  return 'secretary';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildUserWorkspaceKey(ownerUid: string): string {
  return `clinic_${ownerUid}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function getOrCreateClinicWorkspace(
  ownerUserId: number,
  workspaceKey: string,
  ownerEmail?: string,
  ownerDisplayName?: string | null
) {
  try {
    const inserted = await db
      .insert(clinicWorkspaces)
      .values({
        workspaceKey,
        ownerUserId,
        clinicName: 'مرکز تخصصی دندانپزشکی مینادنتال',
        initialized: 0,
        mode: 'demo_seeded',
        revision: 0,
        updatedBy: 'system',
        clinicConfig: {},
        staffUsers: [],
      })
      .onConflictDoNothing({ target: clinicWorkspaces.workspaceKey })
      .returning();

    let workspace = inserted[0];

    if (!workspace) {
      const existing = await db
        .select()
        .from(clinicWorkspaces)
        .where(
          and(
            eq(clinicWorkspaces.workspaceKey, workspaceKey),
            eq(clinicWorkspaces.ownerUserId, ownerUserId)
          )
        )
        .limit(1);

      if (!existing[0]) {
        throw new Error('Unauthorized workspace access or workspace not found.');
      }
      workspace = existing[0];
    }

    if (ownerEmail) {
      const normalized = normalizeEmail(ownerEmail);
      await db
        .insert(clinicMembers)
        .values({
          workspaceId: workspace.id,
          email: normalized,
          userId: ownerUserId,
          displayName: ownerDisplayName || 'مدیر کلینیک',
          role: 'manager',
          canEditPrices: 1,
          isActive: 1,
          invitedBy: 'owner',
        })
        .onConflictDoNothing({
          target: [clinicMembers.workspaceId, clinicMembers.email],
        });
    }

    return workspace;
  } catch (error) {
    console.error('Database query failed in getOrCreateClinicWorkspace:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

/**
 * Resolves the shared clinic workspace for an authenticated user:
 * 1. Checks if their verified Gmail is an active invited member in `clinic_members`
 *    (so doctors, secretaries, and assistants automatically join Dr. Mehdi Amiri's shared clinic).
 * 2. Otherwise loads or creates the user's own workspace and registers them as owner/manager.
 */
export async function resolveUserClinicWorkspace(dbUser: {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
}): Promise<ResolvedClinicWorkspaceContext> {
  try {
    const normalizedEmail = normalizeEmail(dbUser.email);

    // 1. Check active membership by verified email
    const memberships = await db
      .select()
      .from(clinicMembers)
      .where(
        and(
          eq(clinicMembers.email, normalizedEmail),
          eq(clinicMembers.isActive, 1)
        )
      )
      .orderBy(asc(clinicMembers.id))
      .limit(10);

    let workspace: typeof clinicWorkspaces.$inferSelect | undefined;
    let memberRole: ClinicMemberRole = 'manager';
    let canEditPrices = true;

    if (memberships.length > 0) {
      // Prefer a workspace where the user was invited by an existing clinic owner,
      // or their manager workspace if they own one.
      const preferred =
        memberships.find((m) => m.invitedBy !== 'owner') || memberships[0];

      const wsRows = await db
        .select()
        .from(clinicWorkspaces)
        .where(eq(clinicWorkspaces.id, preferred.workspaceId))
        .limit(1);

      if (wsRows[0]) {
        workspace = wsRows[0];
        const isOwner = workspace.ownerUserId === dbUser.id;
        memberRole = isOwner ? 'manager' : normalizeMemberRole(preferred.role);
        canEditPrices =
          isOwner || memberRole === 'manager' || preferred.canEditPrices === 1;

        if (preferred.userId !== dbUser.id) {
          await db
            .update(clinicMembers)
            .set({
              userId: dbUser.id,
              displayName:
                preferred.displayName || dbUser.displayName || normalizedEmail,
              updatedAt: new Date(),
            })
            .where(eq(clinicMembers.id, preferred.id));
        }
      }
    }

    // 2. Fallback: load existing owned workspace or create a new one
    if (!workspace) {
      const ownedRows = await db
        .select()
        .from(clinicWorkspaces)
        .where(eq(clinicWorkspaces.ownerUserId, dbUser.id))
        .orderBy(asc(clinicWorkspaces.id))
        .limit(1);

      if (ownedRows[0]) {
        workspace = ownedRows[0];
        await db
          .insert(clinicMembers)
          .values({
            workspaceId: workspace.id,
            email: normalizedEmail,
            userId: dbUser.id,
            displayName: dbUser.displayName || 'مدیر کلینیک',
            role: 'manager',
            canEditPrices: 1,
            isActive: 1,
            invitedBy: 'owner',
          })
          .onConflictDoNothing({
            target: [clinicMembers.workspaceId, clinicMembers.email],
          });
      } else {
        const workspaceKey = buildUserWorkspaceKey(dbUser.uid);
        workspace = await getOrCreateClinicWorkspace(
          dbUser.id,
          workspaceKey,
          normalizedEmail,
          dbUser.displayName
        );
      }
      memberRole = 'manager';
      canEditPrices = true;
    }

    const [patientRows, appointmentRows, inventoryRows] = await Promise.all([
      db
        .select()
        .from(clinicPatients)
        .where(eq(clinicPatients.workspaceId, workspace.id)),
      db
        .select()
        .from(clinicAppointments)
        .where(eq(clinicAppointments.workspaceId, workspace.id)),
      db
        .select()
        .from(clinicInventory)
        .where(eq(clinicInventory.workspaceId, workspace.id)),
    ]);

    const isOwner = workspace.ownerUserId === dbUser.id;
    const isManager = isOwner || memberRole === 'manager';

    return {
      workspaceId: workspace.id,
      ownerUserId: workspace.ownerUserId,
      clinicName: workspace.clinicName,
      memberRole,
      canEditPrices: isManager || canEditPrices,
      isOwner,
      isManager,
      store: {
        initialized: workspace.initialized === 1,
        revision: workspace.revision,
        mode:
          workspace.mode === 'live_production'
            ? 'live_production'
            : 'demo_seeded',
        updatedAt: workspace.updatedAt.toISOString(),
        updatedBy: workspace.updatedBy,
        patients: patientRows.map((r) => r.payload),
        appointments: appointmentRows.map((r) => r.payload),
        inventory: inventoryRows.map((r) => r.payload),
        users: Array.isArray(workspace.staffUsers) ? workspace.staffUsers : [],
        clinicConfig:
          workspace.clinicConfig && typeof workspace.clinicConfig === 'object'
            ? workspace.clinicConfig
            : {},
      },
    };
  } catch (error) {
    console.error('Database query failed in resolveUserClinicWorkspace:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function loadClinicStoreFromSql(
  ownerUserId: number,
  workspaceKey: string
): Promise<{
  workspaceId: number;
  ownerUserId: number;
  store: SqlClinicStoreSnapshot;
}> {
  try {
    const workspace = await getOrCreateClinicWorkspace(ownerUserId, workspaceKey);
    const [patientRows, appointmentRows, inventoryRows] = await Promise.all([
      db
        .select()
        .from(clinicPatients)
        .where(eq(clinicPatients.workspaceId, workspace.id)),
      db
        .select()
        .from(clinicAppointments)
        .where(eq(clinicAppointments.workspaceId, workspace.id)),
      db
        .select()
        .from(clinicInventory)
        .where(eq(clinicInventory.workspaceId, workspace.id)),
    ]);

    return {
      workspaceId: workspace.id,
      ownerUserId: workspace.ownerUserId,
      store: {
        initialized: workspace.initialized === 1,
        revision: workspace.revision,
        mode:
          workspace.mode === 'live_production'
            ? 'live_production'
            : 'demo_seeded',
        updatedAt: workspace.updatedAt.toISOString(),
        updatedBy: workspace.updatedBy,
        patients: patientRows.map((r) => r.payload),
        appointments: appointmentRows.map((r) => r.payload),
        inventory: inventoryRows.map((r) => r.payload),
        users: Array.isArray(workspace.staffUsers) ? workspace.staffUsers : [],
        clinicConfig:
          workspace.clinicConfig && typeof workspace.clinicConfig === 'object'
            ? workspace.clinicConfig
            : {},
      },
    };
  } catch (error) {
    console.error('Database query failed in loadClinicStoreFromSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function listClinicMembersInSql(
  workspaceId: number,
  ownerUserId: number
): Promise<SqlClinicMemberRecord[]> {
  try {
    const rows = await db
      .select()
      .from(clinicMembers)
      .where(eq(clinicMembers.workspaceId, workspaceId))
      .orderBy(asc(clinicMembers.id));

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      email: row.email,
      userId: row.userId ?? null,
      displayName: row.displayName,
      role: normalizeMemberRole(row.role),
      canEditPrices: row.canEditPrices === 1 || row.role === 'manager',
      isActive: row.isActive === 1,
      isOwner: row.userId === ownerUserId,
      invitedBy: row.invitedBy,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in listClinicMembersInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function upsertClinicMemberInSql(
  workspaceId: number,
  ownerUserId: number,
  input: {
    email: string;
    displayName: string;
    role: ClinicMemberRole;
    canEditPrices?: boolean;
    invitedBy: string;
  }
): Promise<SqlClinicMemberRecord> {
  try {
    const email = normalizeEmail(input.email);
    const role = normalizeMemberRole(input.role);
    const canEditPrices =
      role === 'manager' ? 1 : input.canEditPrices ? 1 : 0;
    const now = new Date();

    const rows = await db
      .insert(clinicMembers)
      .values({
        workspaceId,
        email,
        displayName: input.displayName.trim() || email,
        role,
        canEditPrices,
        isActive: 1,
        invitedBy: input.invitedBy,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [clinicMembers.workspaceId, clinicMembers.email],
        set: {
          displayName: input.displayName.trim() || email,
          role,
          canEditPrices,
          isActive: 1,
          updatedAt: now,
        },
      })
      .returning();

    const row = rows[0];
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      email: row.email,
      userId: row.userId ?? null,
      displayName: row.displayName,
      role: normalizeMemberRole(row.role),
      canEditPrices: row.canEditPrices === 1 || row.role === 'manager',
      isActive: row.isActive === 1,
      isOwner: row.userId === ownerUserId,
      invitedBy: row.invitedBy,
      createdAt: row.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in upsertClinicMemberInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function removeClinicMemberInSql(
  workspaceId: number,
  ownerUserId: number,
  memberId: number
): Promise<{ removed: boolean; reason?: string; email?: string }> {
  try {
    const existing = await db
      .select()
      .from(clinicMembers)
      .where(
        and(
          eq(clinicMembers.workspaceId, workspaceId),
          eq(clinicMembers.id, memberId)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return { removed: false, reason: 'not_found' };
    }
    if (existing[0].userId === ownerUserId) {
      return { removed: false, reason: 'cannot_remove_owner' };
    }

    await db
      .delete(clinicMembers)
      .where(
        and(
          eq(clinicMembers.workspaceId, workspaceId),
          eq(clinicMembers.id, memberId)
        )
      );

    return { removed: true, email: existing[0].email };
  } catch (error) {
    console.error('Database query failed in removeClinicMemberInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

/**
 * Server-side role & price-lock guard for Cloud SQL clinic sync.
 * Prevents non-manager / price-locked staff (e.g., secretary, assistant) from:
 * - Altering prices/discounts of already-recorded treatments
 * - Deleting existing patient records
 * - Modifying clinic tariff tables or staff account definitions
 */
export function enforceServerPriceAndRoleGuard(params: {
  existingStore: SqlClinicStoreSnapshot;
  incomingPatients: Record<string, unknown>[];
  incomingUsers?: Record<string, unknown>[];
  incomingClinicConfig?: Record<string, unknown>;
  canEditPrices: boolean;
  isManager: boolean;
}): {
  patients: Record<string, unknown>[];
  users: Record<string, unknown>[];
  clinicConfig: Record<string, unknown>;
  enforcedViolations: string[];
} {
  const {
    existingStore,
    incomingPatients,
    incomingUsers,
    incomingClinicConfig,
    canEditPrices,
    isManager,
  } = params;

  const violations: string[] = [];

  if (isManager && canEditPrices) {
    return {
      patients: incomingPatients,
      users: Array.isArray(incomingUsers) ? incomingUsers : existingStore.users,
      clinicConfig:
        incomingClinicConfig && typeof incomingClinicConfig === 'object'
          ? { ...existingStore.clinicConfig, ...incomingClinicConfig }
          : existingStore.clinicConfig,
      enforcedViolations: [],
    };
  }

  // 1. Protect staff list & clinic tariffs from non-manager edits
  const safeUsers = existingStore.users;
  if (
    Array.isArray(incomingUsers) &&
    JSON.stringify(incomingUsers) !== JSON.stringify(existingStore.users)
  ) {
    violations.push('تغییر لیست پرسنل توسط کاربر غیرمدیر مسدود شد');
  }

  let safeClinicConfig = existingStore.clinicConfig;
  if (incomingClinicConfig && typeof incomingClinicConfig === 'object') {
    const mergedCfg: Record<string, unknown> = {
      ...existingStore.clinicConfig,
      ...incomingClinicConfig,
    };
    if (
      existingStore.clinicConfig.tariffs !== undefined &&
      JSON.stringify(incomingClinicConfig.tariffs) !==
        JSON.stringify(existingStore.clinicConfig.tariffs)
    ) {
      mergedCfg.tariffs = existingStore.clinicConfig.tariffs;
      violations.push('تغییر تعرفه‌های کلینیک توسط کاربر غیرمدیر مسدود شد');
    }
    safeClinicConfig = mergedCfg;
  }

  // 2. Protect existing patients from deletion & lock existing treatment prices
  const existingById = new Map<string, Record<string, unknown>>();
  for (const p of existingStore.patients) {
    if (typeof p.id === 'string' && p.id) {
      existingById.set(p.id, p);
    }
  }

  const seenIds = new Set<string>();
  const guardedPatients: Record<string, unknown>[] = [];

  for (const inc of incomingPatients) {
    const pid = typeof inc.id === 'string' ? inc.id : '';
    if (!pid) continue;
    seenIds.add(pid);

    const prev = existingById.get(pid);
    if (!prev || canEditPrices) {
      guardedPatients.push(inc);
      continue;
    }

    // Lock already-recorded treatments' cost/price/discount fields
    const prevTreatments = Array.isArray(prev.treatments)
      ? (prev.treatments as Record<string, unknown>[])
      : [];
    const incTreatments = Array.isArray(inc.treatments)
      ? (inc.treatments as Record<string, unknown>[])
      : [];

    const prevTxById = new Map<string, Record<string, unknown>>();
    for (const tx of prevTreatments) {
      if (typeof tx.id === 'string' && tx.id) {
        prevTxById.set(tx.id, tx);
      }
    }

    let priceTampered = false;
    const lockedTreatments = incTreatments.map((tx) => {
      const txId = typeof tx.id === 'string' ? tx.id : '';
      const prevTx = txId ? prevTxById.get(txId) : undefined;
      if (!prevTx) return tx; // Newly added treatment allowed

      const guardedTx = { ...tx };
      for (const field of ['cost', 'price', 'discount', 'fee', 'basePrice']) {
        if (prevTx[field] !== undefined && tx[field] !== prevTx[field]) {
          guardedTx[field] = prevTx[field];
          priceTampered = true;
        }
      }
      return guardedTx;
    });

    // Prevent deleting previously recorded treatments
    const incTxIds = new Set(
      lockedTreatments
        .map((t) => (typeof t.id === 'string' ? t.id : ''))
        .filter(Boolean)
    );
    for (const prevTx of prevTreatments) {
      const prevTxId = typeof prevTx.id === 'string' ? prevTx.id : '';
      if (prevTxId && !incTxIds.has(prevTxId)) {
        lockedTreatments.push(prevTx);
        priceTampered = true;
      }
    }

    const prevTotalCost = Math.round(Number(prev.totalCost) || 0);
    const incTotalCost = Math.round(Number(inc.totalCost) || 0);
    let safeTotalCost = incTotalCost;
    if (priceTampered || incTotalCost < prevTotalCost) {
      safeTotalCost = Math.max(prevTotalCost, incTotalCost);
      if (incTotalCost < prevTotalCost) {
        priceTampered = true;
      }
    }

    if (priceTampered) {
      violations.push(
        `قفل قیمت روی پرونده «${String(prev.fullName || pid)}» اعمال شد`
      );
    }

    const paidAmount = Math.round(Number(inc.paidAmount) || 0);
    guardedPatients.push({
      ...inc,
      treatments: lockedTreatments,
      totalCost: safeTotalCost,
      balance: paidAmount - safeTotalCost,
    });
  }

  // Restore any existing patient omitted by a non-manager
  for (const [pid, prev] of existingById.entries()) {
    if (!seenIds.has(pid)) {
      guardedPatients.push(prev);
      violations.push(
        `حذف پرونده «${String(prev.fullName || pid)}» توسط کاربر غیرمدیر مسدود شد`
      );
    }
  }

  return {
    patients: guardedPatients,
    users: safeUsers,
    clinicConfig: safeClinicConfig,
    enforcedViolations: violations,
  };
}

/**
 * High-speed chunked multi-row batch upsert persistence for Cloud SQL PostgreSQL.
 * Eliminates N+1 query bottlenecks by writing 100 rows per SQL statement inside one transaction.
 */
export async function saveClinicStoreToSql(
  workspaceId: number,
  store: SqlClinicStoreSnapshot
): Promise<void> {
  try {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(clinicWorkspaces)
        .set({
          initialized: store.initialized ? 1 : 0,
          mode: store.mode,
          revision: store.revision,
          updatedBy: store.updatedBy,
          clinicConfig: store.clinicConfig,
          staffUsers: store.users,
          updatedAt: now,
        })
        .where(eq(clinicWorkspaces.id, workspaceId));

      // 1. Deduplicated chunked batch upsert for clinic_patients
      const patientRowMap = new Map<
        string,
        typeof clinicPatients.$inferInsert
      >();
      for (const p of store.patients) {
        const rawId = typeof p.id === 'string' ? p.id : '';
        if (!rawId) continue;
        const scopedId = rawId.startsWith(`ws${workspaceId}:`)
          ? rawId
          : `ws${workspaceId}:${rawId}`;
        const totalCost = Math.round(Number(p.totalCost) || 0);
        const paidAmount = Math.round(Number(p.paidAmount) || 0);
        const balance = paidAmount - totalCost;
        patientRowMap.set(scopedId, {
          id: scopedId,
          workspaceId,
          fileNumber: typeof p.fileNumber === 'string' ? p.fileNumber : '',
          fullName: typeof p.fullName === 'string' ? p.fullName : '',
          phone: typeof p.phone === 'string' ? p.phone : '',
          totalCost,
          paidAmount,
          balance,
          payload: p,
          updatedAt: now,
        });
      }
      const patientRows = Array.from(patientRowMap.values());
      const patientIds = Array.from(patientRowMap.keys());
      for (const batch of chunkArray(patientRows, UPSERT_BATCH_SIZE)) {
        await tx
          .insert(clinicPatients)
          .values(batch)
          .onConflictDoUpdate({
            target: clinicPatients.id,
            set: {
              fileNumber: sql`excluded.file_number`,
              fullName: sql`excluded.full_name`,
              phone: sql`excluded.phone`,
              totalCost: sql`excluded.total_cost`,
              paidAmount: sql`excluded.paid_amount`,
              balance: sql`excluded.balance`,
              payload: sql`excluded.payload`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
      if (patientIds.length === 0) {
        await tx
          .delete(clinicPatients)
          .where(eq(clinicPatients.workspaceId, workspaceId));
      } else {
        await tx
          .delete(clinicPatients)
          .where(
            and(
              eq(clinicPatients.workspaceId, workspaceId),
              notInArray(clinicPatients.id, patientIds)
            )
          );
      }

      // 2. Deduplicated chunked batch upsert for clinic_appointments
      const appointmentRowMap = new Map<
        string,
        typeof clinicAppointments.$inferInsert
      >();
      for (const a of store.appointments) {
        const rawId = typeof a.id === 'string' ? a.id : '';
        if (!rawId) continue;
        const scopedId = rawId.startsWith(`ws${workspaceId}:`)
          ? rawId
          : `ws${workspaceId}:${rawId}`;
        appointmentRowMap.set(scopedId, {
          id: scopedId,
          workspaceId,
          patientId: typeof a.patientId === 'string' ? a.patientId : '',
          date: typeof a.date === 'string' ? a.date : '',
          time: typeof a.time === 'string' ? a.time : '',
          status: typeof a.status === 'string' ? a.status : 'scheduled',
          payload: a,
          updatedAt: now,
        });
      }
      const appointmentRows = Array.from(appointmentRowMap.values());
      const appointmentIds = Array.from(appointmentRowMap.keys());
      for (const batch of chunkArray(appointmentRows, UPSERT_BATCH_SIZE)) {
        await tx
          .insert(clinicAppointments)
          .values(batch)
          .onConflictDoUpdate({
            target: clinicAppointments.id,
            set: {
              patientId: sql`excluded.patient_id`,
              date: sql`excluded.date`,
              time: sql`excluded.time`,
              status: sql`excluded.status`,
              payload: sql`excluded.payload`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
      if (appointmentIds.length === 0) {
        await tx
          .delete(clinicAppointments)
          .where(eq(clinicAppointments.workspaceId, workspaceId));
      } else {
        await tx
          .delete(clinicAppointments)
          .where(
            and(
              eq(clinicAppointments.workspaceId, workspaceId),
              notInArray(clinicAppointments.id, appointmentIds)
            )
          );
      }

      // 3. Deduplicated chunked batch upsert for clinic_inventory
      const inventoryRowMap = new Map<
        string,
        typeof clinicInventory.$inferInsert
      >();
      for (const item of store.inventory) {
        const rawId = typeof item.id === 'string' ? item.id : '';
        if (!rawId) continue;
        const scopedId = rawId.startsWith(`ws${workspaceId}:`)
          ? rawId
          : `ws${workspaceId}:${rawId}`;
        inventoryRowMap.set(scopedId, {
          id: scopedId,
          workspaceId,
          name: typeof item.name === 'string' ? item.name : '',
          stock: Math.round(Number(item.stock) || 0),
          minAlert: Math.round(Number(item.minAlert) || 0),
          payload: item,
          updatedAt: now,
        });
      }
      const inventoryRows = Array.from(inventoryRowMap.values());
      const inventoryIds = Array.from(inventoryRowMap.keys());
      for (const batch of chunkArray(inventoryRows, UPSERT_BATCH_SIZE)) {
        await tx
          .insert(clinicInventory)
          .values(batch)
          .onConflictDoUpdate({
            target: clinicInventory.id,
            set: {
              name: sql`excluded.name`,
              stock: sql`excluded.stock`,
              minAlert: sql`excluded.min_alert`,
              payload: sql`excluded.payload`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
      if (inventoryIds.length === 0) {
        await tx
          .delete(clinicInventory)
          .where(eq(clinicInventory.workspaceId, workspaceId));
      } else {
        await tx
          .delete(clinicInventory)
          .where(
            and(
              eq(clinicInventory.workspaceId, workspaceId),
              notInArray(clinicInventory.id, inventoryIds)
            )
          );
      }
    });
  } catch (error) {
    console.error('Database query failed in saveClinicStoreToSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function createBackupInSql(
  workspaceId: number,
  state: SqlClinicStoreSnapshot,
  label: string,
  createdBy: string
): Promise<SqlBackupMeta> {
  try {
    const id = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const serializedBytes = Buffer.byteLength(JSON.stringify(state), 'utf8');
    const inserted = await db
      .insert(clinicBackups)
      .values({
        id,
        workspaceId,
        label,
        createdBy,
        revision: state.revision,
        mode: state.mode,
        patientsCount: state.patients.length,
        appointmentsCount: state.appointments.length,
        inventoryCount: state.inventory.length,
        bytes: serializedBytes,
        snapshotState: state as unknown as Record<string, unknown>,
      })
      .returning();

    const allRows = await db
      .select({ id: clinicBackups.id })
      .from(clinicBackups)
      .where(eq(clinicBackups.workspaceId, workspaceId))
      .orderBy(desc(clinicBackups.createdAt));

    if (allRows.length > 30) {
      const obsoleteIds = allRows.slice(30).map((r) => r.id);
      if (obsoleteIds.length > 0) {
        await db
          .delete(clinicBackups)
          .where(
            and(
              eq(clinicBackups.workspaceId, workspaceId),
              inArray(clinicBackups.id, obsoleteIds)
            )
          );
      }
    }

    const row = inserted[0];
    return {
      id: row.id,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      revision: row.revision,
      mode: row.mode === 'live_production' ? 'live_production' : 'demo_seeded',
      patientsCount: row.patientsCount,
      appointmentsCount: row.appointmentsCount,
      inventoryCount: row.inventoryCount,
      bytes: row.bytes,
    };
  } catch (error) {
    console.error('Database query failed in createBackupInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function listBackupsInSql(
  workspaceId: number
): Promise<SqlBackupMeta[]> {
  try {
    const rows = await db
      .select({
        id: clinicBackups.id,
        label: clinicBackups.label,
        createdAt: clinicBackups.createdAt,
        createdBy: clinicBackups.createdBy,
        revision: clinicBackups.revision,
        mode: clinicBackups.mode,
        patientsCount: clinicBackups.patientsCount,
        appointmentsCount: clinicBackups.appointmentsCount,
        inventoryCount: clinicBackups.inventoryCount,
        bytes: clinicBackups.bytes,
      })
      .from(clinicBackups)
      .where(eq(clinicBackups.workspaceId, workspaceId))
      .orderBy(desc(clinicBackups.createdAt))
      .limit(30);

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      revision: row.revision,
      mode: row.mode === 'live_production' ? 'live_production' : 'demo_seeded',
      patientsCount: row.patientsCount,
      appointmentsCount: row.appointmentsCount,
      inventoryCount: row.inventoryCount,
      bytes: row.bytes,
    }));
  } catch (error) {
    console.error('Database query failed in listBackupsInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getBackupSnapshotFromSql(
  workspaceId: number,
  snapshotId: string
): Promise<{ meta: SqlBackupMeta; state: SqlClinicStoreSnapshot } | null> {
  try {
    const rows = await db
      .select()
      .from(clinicBackups)
      .where(
        and(
          eq(clinicBackups.workspaceId, workspaceId),
          eq(clinicBackups.id, snapshotId)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      meta: {
        id: row.id,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
        createdBy: row.createdBy,
        revision: row.revision,
        mode: row.mode === 'live_production' ? 'live_production' : 'demo_seeded',
        patientsCount: row.patientsCount,
        appointmentsCount: row.appointmentsCount,
        inventoryCount: row.inventoryCount,
        bytes: row.bytes,
      },
      state: row.snapshotState as unknown as SqlClinicStoreSnapshot,
    };
  } catch (error) {
    console.error('Database query failed in getBackupSnapshotFromSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function appendAuditLogInSql(
  workspaceId: number,
  entry: {
    actor: string;
    role: string;
    action: string;
    details: string;
    severity?: string;
    targetId?: string;
  }
): Promise<SqlAuditEntry> {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inserted = await db
      .insert(clinicAuditLogs)
      .values({
        id,
        workspaceId,
        actor: entry.actor,
        role: entry.role,
        action: entry.action,
        details: entry.details,
        severity: entry.severity || 'info',
        targetId: entry.targetId ?? null,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      timestamp: row.createdAt.toISOString(),
      actor: row.actor,
      role: row.role,
      category: 'sync',
      action: row.action,
      details: row.details,
      severity: row.severity,
    };
  } catch (error) {
    console.error('Database query failed in appendAuditLogInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function listAuditLogsInSql(
  workspaceId: number,
  limit: number = 40
): Promise<SqlAuditEntry[]> {
  try {
    const safeLimit = Math.min(200, Math.max(1, limit));
    const rows = await db
      .select()
      .from(clinicAuditLogs)
      .where(eq(clinicAuditLogs.workspaceId, workspaceId))
      .orderBy(desc(clinicAuditLogs.createdAt))
      .limit(safeLimit);

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.createdAt.toISOString(),
      actor: row.actor,
      role: row.role,
      category: 'sync',
      action: row.action,
      details: row.details,
      severity: row.severity,
    }));
  } catch (error) {
    console.error('Database query failed in listAuditLogsInSql:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}
