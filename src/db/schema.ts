import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const clinicWorkspaces = pgTable('clinic_workspaces', {
  id: serial('id').primaryKey(),
  workspaceKey: text('workspace_key').notNull().unique(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id)
    .notNull(),
  clinicName: text('clinic_name')
    .notNull()
    .default('مرکز تخصصی دندانپزشکی مینادنتال'),
  initialized: integer('initialized').notNull().default(0),
  mode: text('mode').notNull().default('demo_seeded'),
  revision: integer('revision').notNull().default(0),
  updatedBy: text('updated_by').notNull().default('system'),
  clinicConfig: jsonb('clinic_config')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  staffUsers: jsonb('staff_users')
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const clinicMembers = pgTable(
  'clinic_members',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => clinicWorkspaces.id, { onDelete: 'cascade' })
      .notNull(),
    email: text('email').notNull(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    displayName: text('display_name').notNull().default(''),
    role: text('role').notNull().default('secretary'),
    canEditPrices: integer('can_edit_prices').notNull().default(0),
    isActive: integer('is_active').notNull().default(1),
    invitedBy: text('invited_by').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('clinic_members_workspace_email_uq').on(
      table.workspaceId,
      table.email
    ),
    index('clinic_members_email_idx').on(table.email),
    index('clinic_members_workspace_idx').on(table.workspaceId),
  ]
);

export const clinicPatients = pgTable(
  'clinic_patients',
  {
    id: text('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => clinicWorkspaces.id, { onDelete: 'cascade' })
      .notNull(),
    fileNumber: text('file_number').notNull().default(''),
    fullName: text('full_name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    totalCost: bigint('total_cost', { mode: 'number' }).notNull().default(0),
    paidAmount: bigint('paid_amount', { mode: 'number' }).notNull().default(0),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('clinic_patients_workspace_idx').on(table.workspaceId)]
);

export const clinicAppointments = pgTable(
  'clinic_appointments',
  {
    id: text('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => clinicWorkspaces.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: text('patient_id').notNull().default(''),
    date: text('date').notNull().default(''),
    time: text('time').notNull().default(''),
    status: text('status').notNull().default('scheduled'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('clinic_appointments_workspace_idx').on(table.workspaceId)]
);

export const clinicInventory = pgTable(
  'clinic_inventory',
  {
    id: text('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => clinicWorkspaces.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull().default(''),
    stock: integer('stock').notNull().default(0),
    minAlert: integer('min_alert').notNull().default(0),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('clinic_inventory_workspace_idx').on(table.workspaceId)]
);

export const clinicBackups = pgTable(
  'clinic_backups',
  {
    id: text('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => clinicWorkspaces.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label').notNull(),
    createdBy: text('created_by').notNull(),
    revision: integer('revision').notNull().default(0),
    mode: text('mode').notNull().default('demo_seeded'),
    patientsCount: integer('patients_count').notNull().default(0),
    appointmentsCount: integer('appointments_count').notNull().default(0),
    inventoryCount: integer('inventory_count').notNull().default(0),
    bytes: integer('bytes').notNull().default(0),
    snapshotState: jsonb('snapshot_state')
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('clinic_backups_workspace_idx').on(table.workspaceId)]
);

export const clinicAuditLogs = pgTable(
  'clinic_audit_logs',
  {
    id: text('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => clinicWorkspaces.id, { onDelete: 'cascade' })
      .notNull(),
    actor: text('actor').notNull(),
    role: text('role').notNull(),
    action: text('action').notNull(),
    severity: text('severity').notNull().default('info'),
    details: text('details').notNull(),
    targetId: text('target_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('clinic_audit_logs_workspace_idx').on(table.workspaceId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(clinicWorkspaces),
  memberships: many(clinicMembers),
}));

export const clinicWorkspacesRelations = relations(
  clinicWorkspaces,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [clinicWorkspaces.ownerUserId],
      references: [users.id],
    }),
    members: many(clinicMembers),
    patients: many(clinicPatients),
    appointments: many(clinicAppointments),
    inventory: many(clinicInventory),
    backups: many(clinicBackups),
    auditLogs: many(clinicAuditLogs),
  })
);

export const clinicMembersRelations = relations(clinicMembers, ({ one }) => ({
  workspace: one(clinicWorkspaces, {
    fields: [clinicMembers.workspaceId],
    references: [clinicWorkspaces.id],
  }),
  user: one(users, {
    fields: [clinicMembers.userId],
    references: [users.id],
  }),
}));

export const clinicPatientsRelations = relations(clinicPatients, ({ one }) => ({
  workspace: one(clinicWorkspaces, {
    fields: [clinicPatients.workspaceId],
    references: [clinicWorkspaces.id],
  }),
}));

export const clinicAppointmentsRelations = relations(
  clinicAppointments,
  ({ one }) => ({
    workspace: one(clinicWorkspaces, {
      fields: [clinicAppointments.workspaceId],
      references: [clinicWorkspaces.id],
    }),
  })
);

export const clinicInventoryRelations = relations(
  clinicInventory,
  ({ one }) => ({
    workspace: one(clinicWorkspaces, {
      fields: [clinicInventory.workspaceId],
      references: [clinicWorkspaces.id],
    }),
  })
);

export const clinicBackupsRelations = relations(clinicBackups, ({ one }) => ({
  workspace: one(clinicWorkspaces, {
    fields: [clinicBackups.workspaceId],
    references: [clinicWorkspaces.id],
  }),
}));

export const clinicAuditLogsRelations = relations(
  clinicAuditLogs,
  ({ one }) => ({
    workspace: one(clinicWorkspaces, {
      fields: [clinicAuditLogs.workspaceId],
      references: [clinicWorkspaces.id],
    }),
  })
);
