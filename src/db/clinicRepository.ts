import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  clinicAppointments,
  clinicAuditLogs,
  clinicBackups,
  clinicInventory,
  clinicPatients,
  clinicWorkspaces,
} from './schema.ts';
import type { ClinicDataMode } from '../utils/eccSchemas.ts';

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

export function buildUserWorkspaceKey(ownerUid: string): string {
  return `clinic_${ownerUid}`;
}

export async function getOrCreateClinicWorkspace(
  ownerUserId: number,
  workspaceKey: string
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

    if (inserted[0]) return inserted[0];

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
    return existing[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateClinicWorkspace:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function loadClinicStoreFromSql(
  ownerUserId: number,
  workspaceKey: string
): Promise<{ workspaceId: number; ownerUserId: number; store: SqlClinicStoreSnapshot }> {
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

      // Upsert patients scoped to workspaceId & remove deleted rows
      const patientIds: string[] = [];
      for (const p of store.patients) {
        const rawId = typeof p.id === 'string' ? p.id : '';
        if (!rawId) continue;
        const scopedId = rawId.startsWith(`ws${workspaceId}:`) ? rawId : `ws${workspaceId}:${rawId}`;
        patientIds.push(scopedId);
        const totalCost = Math.round(Number(p.totalCost) || 0);
        const paidAmount = Math.round(Number(p.paidAmount) || 0);
        const balance = paidAmount - totalCost;
        await tx
          .insert(clinicPatients)
          .values({
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
          })
          .onConflictDoUpdate({
            target: clinicPatients.id,
            set: {
              fileNumber: typeof p.fileNumber === 'string' ? p.fileNumber : '',
              fullName: typeof p.fullName === 'string' ? p.fullName : '',
              phone: typeof p.phone === 'string' ? p.phone : '',
              totalCost,
              paidAmount,
              balance,
              payload: p,
              updatedAt: now,
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

      // Upsert appointments scoped to workspaceId & remove deleted rows
      const appointmentIds: string[] = [];
      for (const a of store.appointments) {
        const rawId = typeof a.id === 'string' ? a.id : '';
        if (!rawId) continue;
        const scopedId = rawId.startsWith(`ws${workspaceId}:`) ? rawId : `ws${workspaceId}:${rawId}`;
        appointmentIds.push(scopedId);
        await tx
          .insert(clinicAppointments)
          .values({
            id: scopedId,
            workspaceId,
            patientId: typeof a.patientId === 'string' ? a.patientId : '',
            date: typeof a.date === 'string' ? a.date : '',
            time: typeof a.time === 'string' ? a.time : '',
            status: typeof a.status === 'string' ? a.status : 'scheduled',
            payload: a,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: clinicAppointments.id,
            set: {
              patientId: typeof a.patientId === 'string' ? a.patientId : '',
              date: typeof a.date === 'string' ? a.date : '',
              time: typeof a.time === 'string' ? a.time : '',
              status: typeof a.status === 'string' ? a.status : 'scheduled',
              payload: a,
              updatedAt: now,
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

      // Upsert inventory scoped to workspaceId & remove deleted rows
      const inventoryIds: string[] = [];
      for (const item of store.inventory) {
        const rawId = typeof item.id === 'string' ? item.id : '';
        if (!rawId) continue;
        const scopedId = rawId.startsWith(`ws${workspaceId}:`) ? rawId : `ws${workspaceId}:${rawId}`;
        inventoryIds.push(scopedId);
        await tx
          .insert(clinicInventory)
          .values({
            id: scopedId,
            workspaceId,
            name: typeof item.name === 'string' ? item.name : '',
            stock: Math.round(Number(item.stock) || 0),
            minAlert: Math.round(Number(item.minAlert) || 0),
            payload: item,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: clinicInventory.id,
            set: {
              name: typeof item.name === 'string' ? item.name : '',
              stock: Math.round(Number(item.stock) || 0),
              minAlert: Math.round(Number(item.minAlert) || 0),
              payload: item,
              updatedAt: now,
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
