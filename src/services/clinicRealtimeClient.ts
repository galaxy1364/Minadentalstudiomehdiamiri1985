/**
 * MinaDental Multi-Device Real-Time Sync Client (HTTP + Server-Sent Events)
 * Connects every open clinic device (iPhone, Android, Unit iPad, Reception PC)
 * to the authoritative Express server state with zero manual configuration.
 * Prevents sync loops via per-tab clientId echo filtering and auto-reconnects after drops.
 */

import type { Patient, Appointment, InventoryItem } from '../types/dental';
import type { ClinicDataMode } from '../utils/eccSchemas';
import { eccLogger } from '../utils/eccLogger';
import { getCurrentFirebaseIdToken } from '../lib/firebase';

export interface LiveSyncSnapshot {
  initialized: boolean;
  revision: number;
  mode: ClinicDataMode;
  updatedAt: string;
  updatedBy: string;
  connectedClients: number;
  mergedConflict?: boolean;
  patients: Patient[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  users?: Record<string, unknown>[];
  clinicConfig?: Record<string, unknown>;
}

export interface LiveSyncStatusMeta {
  connectionState: 'connected' | 'connecting' | 'offline';
  revision: number;
  connectedClients: number;
  mode: ClinicDataMode;
  lastSyncedAt: string;
  lastConflictMergedAt?: string;
}

export interface ServerBackupMeta {
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

export interface IncomingCallPushEvent {
  id: string;
  phoneNumber: string;
  lineName?: string;
  timestamp: string;
  matchedPatient?: Patient | null;
}

export interface ServerAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  category: 'sync' | 'security' | 'backup' | 'clinical' | 'financial' | 'telephony' | 'sms';
  action: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ServerClinicSummaryReport {
  generatedAt: string;
  mode: ClinicDataMode;
  revision: number;
  connectedClients: number;
  totalPatients: number;
  totalAppointments: number;
  totalGrossCost: number;
  totalPaidAmount: number;
  totalOutstandingBalance: number;
  pendingChecksCount: number;
  bouncedChecksCount: number;
  activeLabOrdersCount: number;
  activeImplantCasesCount: number;
  lowStockInventoryCount: number;
  serverBackupsCount: number;
  auditEventsCount: number;
}

export type CloudMemberRole = 'manager' | 'doctor' | 'secretary' | 'assistant';

export interface CloudClinicMember {
  id: number;
  workspaceId: number;
  email: string;
  userId: number | null;
  displayName: string;
  role: CloudMemberRole;
  canEditPrices: boolean;
  isActive: boolean;
  isOwner: boolean;
  invitedBy: string;
  createdAt: string;
}

export interface CloudClinicMembersResponse {
  workspaceId: number;
  clinicName: string;
  currentUserAccess: {
    email: string;
    role: CloudMemberRole;
    canEditPrices: boolean;
    isManager: boolean;
    isOwner: boolean;
  };
  members: CloudClinicMember[];
}

type SyncListener = (snapshot: LiveSyncSnapshot) => void;
type StatusListener = (meta: LiveSyncStatusMeta) => void;
type IncomingCallListener = (call: IncomingCallPushEvent) => void;

class ClinicRealtimeClient {
  private readonly clientId: string;
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private activeStreamOpener: (() => void) | null = null;
  private syncListeners = new Set<SyncListener>();
  private statusListeners = new Set<StatusListener>();
  private incomingCallListeners = new Set<IncomingCallListener>();
  private meta: LiveSyncStatusMeta = {
    connectionState: 'connecting',
    revision: 0,
    connectedClients: 1,
    mode: 'demo_seeded',
    lastSyncedAt: '',
  };

  constructor() {
    this.clientId = `md-dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getStatusMeta(): LiveSyncStatusMeta {
    return { ...this.meta };
  }

  private updateMeta(patch: Partial<LiveSyncStatusMeta>) {
    this.meta = { ...this.meta, ...patch };
    this.statusListeners.forEach((cb) => {
      try {
        cb(this.getStatusMeta());
      } catch {
        // isolate listener error
      }
    });
  }

  public onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatusMeta());
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  public onRemoteSync(cb: SyncListener): () => void {
    this.syncListeners.add(cb);
    return () => {
      this.syncListeners.delete(cb);
    };
  }

  public onIncomingCall(cb: IncomingCallListener): () => void {
    this.incomingCallListeners.add(cb);
    return () => {
      this.incomingCallListeners.delete(cb);
    };
  }

  private isUnitTestRuntime(): boolean {
    return typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  }

  private async getAuthContext(): Promise<{
    token: string | null;
    headers: Record<string, string>;
  }> {
    const token = await getCurrentFirebaseIdToken();
    if (!token) {
      return { token: null, headers: {} };
    }
    return {
      token,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  public async fetchAuthoritativeState(): Promise<LiveSyncSnapshot | null> {
    if (this.isUnitTestRuntime()) return null;
    if (typeof fetch !== 'function') return null;
    if (typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return null;
    }
    try {
      const { token, headers } = await this.getAuthContext();
      let res: Response;
      if (token) {
        res = await fetch('/api/sql/clinic/state', {
          cache: 'no-store',
          headers,
        });
        if (res.status === 503 || res.status === 401) {
          res = await fetch('/api/clinic/state', { cache: 'no-store' });
        }
      } else {
        res = await fetch('/api/clinic/state', { cache: 'no-store' });
      }
      if (!res.ok) return null;
      const json = (await res.json()) as LiveSyncSnapshot & { ok?: boolean };
      if (!json || typeof json.revision !== 'number') return null;
      this.updateMeta({
        connectionState: 'connected',
        revision: json.revision,
        connectedClients: Math.max(1, json.connectedClients || 1),
        mode: json.mode === 'live_production' ? 'live_production' : 'demo_seeded',
        lastSyncedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      });
      return json;
    } catch (err) {
      eccLogger.debug('RealtimeClient', 'Authoritative state fetch unavailable (offline/test mode):', err);
      this.updateMeta({ connectionState: 'offline' });
      return null;
    }
  }

  public async pushClinicState(payload: {
    patients: Patient[];
    appointments: Appointment[];
    inventory: InventoryItem[];
    users?: Record<string, unknown>[];
    clinicConfig?: Record<string, unknown>;
    deletedPatientIds?: string[];
    deletedAppointmentIds?: string[];
    mode?: ClinicDataMode;
    actorName?: string;
    actorRole?: string;
  }): Promise<{ ok: boolean; revision?: number; connectedClients?: number; mergedConflict?: boolean }> {
    if (this.isUnitTestRuntime()) return { ok: false };
    if (typeof fetch !== 'function') return { ok: false };
    if (typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return { ok: false };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.updateMeta({ connectionState: 'offline' });
      return { ok: false };
    }

    try {
      const bodyStr = JSON.stringify({
        clientId: this.clientId,
        actorName: payload.actorName || 'پرسنل کلینیک',
        actorRole: payload.actorRole || 'staff',
        baseRevision: this.meta.revision,
        mode: payload.mode,
        patients: payload.patients,
        appointments: payload.appointments,
        inventory: payload.inventory,
        users: payload.users,
        clinicConfig: payload.clinicConfig,
        deletedPatientIds: payload.deletedPatientIds,
        deletedAppointmentIds: payload.deletedAppointmentIds,
      });
      const { token, headers } = await this.getAuthContext();
      let res: Response;
      if (token) {
        res = await fetch('/api/sql/clinic/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: bodyStr,
        });
        if (res.status === 503 || res.status === 401) {
          res = await fetch('/api/clinic/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
          });
        }
      } else {
        res = await fetch('/api/clinic/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });
      }
      if (!res.ok) return { ok: false };
      const data = (await res.json()) as {
        ok: boolean;
        revision: number;
        mode: ClinicDataMode;
        updatedAt: string;
        connectedClients: number;
        mergedConflict?: boolean;
        patients?: Patient[];
        appointments?: Appointment[];
        inventory?: InventoryItem[];
        users?: Record<string, unknown>[];
        clinicConfig?: Record<string, unknown>;
      };
      const timeStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      this.updateMeta({
        connectionState: 'connected',
        revision: data.revision,
        mode: data.mode,
        connectedClients: Math.max(1, data.connectedClients || 1),
        lastSyncedAt: timeStr,
        ...(data.mergedConflict ? { lastConflictMergedAt: timeStr } : {}),
      });
      // If server merged a concurrent edit from another device, converge local client immediately!
      if (data.mergedConflict && Array.isArray(data.patients) && Array.isArray(data.appointments)) {
        const mergedSnapshot: LiveSyncSnapshot = {
          initialized: true,
          revision: data.revision,
          mode: data.mode,
          updatedAt: data.updatedAt,
          updatedBy: 'ادغام خودکار همزمان سرور',
          connectedClients: Math.max(1, data.connectedClients || 1),
          mergedConflict: true,
          patients: data.patients,
          appointments: data.appointments,
          inventory: data.inventory || payload.inventory,
          users: data.users,
          clinicConfig: data.clinicConfig,
        };
        this.syncListeners.forEach((cb) => {
          try {
            cb(mergedSnapshot);
          } catch {
            // isolate listener error
          }
        });
      }
      return {
        ok: true,
        revision: data.revision,
        connectedClients: data.connectedClients,
        mergedConflict: Boolean(data.mergedConflict),
      };
    } catch (err) {
      eccLogger.debug('RealtimeClient', 'Push clinic sync deferred (offline/test mode):', err);
      this.updateMeta({ connectionState: 'offline' });
      return { ok: false };
    }
  }

  public async switchClinicMode(params: {
    mode: ClinicDataMode;
    actorName: string;
    isManager: boolean;
    inventory?: InventoryItem[];
  }): Promise<{ ok: boolean; error?: string; revision?: number }> {
    if (this.isUnitTestRuntime()) return { ok: true };
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return { ok: true };
    }
    try {
      const bodyStr = JSON.stringify({
        clientId: this.clientId,
        actorName: params.actorName,
        isManager: params.isManager,
        mode: params.mode,
        preserveInventory: true,
        inventory: params.inventory,
      });
      const { token, headers } = await this.getAuthContext();
      let res = await fetch(token ? '/api/sql/clinic/mode' : '/api/clinic/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: bodyStr,
      });
      if (token && (res.status === 503 || res.status === 401)) {
        res = await fetch('/api/clinic/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });
      }
      const json = (await res.json()) as { ok?: boolean; error?: string; revision?: number };
      if (!res.ok) {
        return { ok: false, error: json.error || 'تغییر وضعیت کلینیک ناموفق بود.' };
      }
      this.updateMeta({
        connectionState: 'connected',
        mode: params.mode,
        revision: json.revision ?? this.meta.revision + 1,
        lastSyncedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      });
      return { ok: true, revision: json.revision };
    } catch {
      return { ok: true };
    }
  }

  public async listServerBackups(): Promise<ServerBackupMeta[]> {
    if (this.isUnitTestRuntime()) return [];
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return [];
    }
    try {
      const { token, headers } = await this.getAuthContext();
      let res = await fetch(token ? '/api/sql/clinic/backups' : '/api/clinic/backups', {
        cache: 'no-store',
        headers,
      });
      if (token && (res.status === 503 || res.status === 401)) {
        res = await fetch('/api/clinic/backups', { cache: 'no-store' });
      }
      if (!res.ok) return [];
      const json = (await res.json()) as { ok?: boolean; backups?: ServerBackupMeta[] };
      return Array.isArray(json.backups) ? json.backups : [];
    } catch {
      return [];
    }
  }

  public async createServerBackup(
    label: string,
    actorName: string
  ): Promise<{ ok: boolean; backup?: ServerBackupMeta; error?: string }> {
    if (this.isUnitTestRuntime()) return { ok: false };
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return { ok: false };
    }
    try {
      const bodyStr = JSON.stringify({ label, actorName });
      const { token, headers } = await this.getAuthContext();
      let res = await fetch(token ? '/api/sql/clinic/backups' : '/api/clinic/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: bodyStr,
      });
      if (token && (res.status === 503 || res.status === 401)) {
        res = await fetch('/api/clinic/backups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });
      }
      const json = (await res.json()) as { ok?: boolean; backup?: ServerBackupMeta; error?: string };
      if (!res.ok) return { ok: false, error: json.error || 'خطا در ایجاد بکاپ سرور' };
      return { ok: true, backup: json.backup };
    } catch {
      return { ok: false, error: 'سرور در دسترس نیست.' };
    }
  }

  public async restoreServerBackup(
    snapshotId: string,
    actorName: string,
    isManager: boolean
  ): Promise<{
    ok: boolean;
    error?: string;
    patients?: Patient[];
    appointments?: Appointment[];
    inventory?: InventoryItem[];
  }> {
    if (this.isUnitTestRuntime()) return { ok: false };
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return { ok: false };
    }
    try {
      const bodyStr = JSON.stringify({
        snapshotId,
        actorName,
        isManager,
        clientId: this.clientId,
      });
      const { token, headers } = await this.getAuthContext();
      let res = await fetch(
        token ? '/api/sql/clinic/backups/restore' : '/api/clinic/backups/restore',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: bodyStr,
        }
      );
      if (token && (res.status === 503 || res.status === 401)) {
        res = await fetch('/api/clinic/backups/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });
      }
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        patients?: Patient[];
        appointments?: Appointment[];
        inventory?: InventoryItem[];
      };
      if (!res.ok) return { ok: false, error: json.error || 'بازیابی نسخه سرور ناموفق بود.' };
      return {
        ok: true,
        patients: json.patients,
        appointments: json.appointments,
        inventory: json.inventory,
      };
    } catch {
      return { ok: false, error: 'خطا در اتصال به سرور برای بازیابی.' };
    }
  }

  public async broadcastIncomingCall(phone: string, lineName = 'خط پذیرش مطب'): Promise<boolean> {
    if (this.isUnitTestRuntime()) return false;
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return false;
    }
    try {
      const res = await fetch('/api/clinic/incoming-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          lineName,
          sourceClientId: this.clientId,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async fetchServerAuditLog(limit = 40): Promise<ServerAuditEntry[]> {
    if (this.isUnitTestRuntime()) return [];
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return [];
    }
    try {
      const { token, headers } = await this.getAuthContext();
      let res = await fetch(
        `${token ? '/api/sql/clinic/audit-log' : '/api/clinic/audit-log'}?limit=${encodeURIComponent(String(limit))}`,
        { cache: 'no-store', headers }
      );
      if (token && (res.status === 503 || res.status === 401)) {
        res = await fetch(`/api/clinic/audit-log?limit=${encodeURIComponent(String(limit))}`, {
          cache: 'no-store',
        });
      }
      if (!res.ok) return [];
      const json = (await res.json()) as { ok?: boolean; entries?: ServerAuditEntry[] };
      return Array.isArray(json.entries) ? json.entries : [];
    } catch {
      return [];
    }
  }

  public async appendServerAuditEvent(event: {
    actor: string;
    role?: string;
    category?: ServerAuditEntry['category'];
    action: string;
    details?: string;
    severity?: ServerAuditEntry['severity'];
  }): Promise<boolean> {
    if (this.isUnitTestRuntime()) return false;
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return false;
    }
    try {
      const bodyStr = JSON.stringify(event);
      const { token, headers } = await this.getAuthContext();
      let res = await fetch(token ? '/api/sql/clinic/audit-log' : '/api/clinic/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: bodyStr,
      });
      if (token && (res.status === 503 || res.status === 401)) {
        res = await fetch('/api/clinic/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  public async fetchServerSummaryReport(): Promise<ServerClinicSummaryReport | null> {
    if (this.isUnitTestRuntime()) return null;
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return null;
    }
    try {
      const res = await fetch('/api/clinic/report/summary', { cache: 'no-store' });
      if (!res.ok) return null;
      const json = (await res.json()) as ServerClinicSummaryReport & { ok?: boolean };
      return json && json.ok ? json : null;
    } catch {
      return null;
    }
  }

  public async listCloudClinicMembers(): Promise<CloudClinicMembersResponse | null> {
    if (this.isUnitTestRuntime()) return null;
    if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.origin?.startsWith('http')) {
      return null;
    }
    try {
      const { token, headers } = await this.getAuthContext();
      if (!token) return null;
      const res = await fetch('/api/sql/clinic/members', {
        cache: 'no-store',
        headers,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as CloudClinicMembersResponse & { ok?: boolean };
      return json && json.ok ? json : null;
    } catch {
      return null;
    }
  }

  public async upsertCloudClinicMember(input: {
    email: string;
    displayName: string;
    role: CloudMemberRole;
    canEditPrices: boolean;
  }): Promise<{ ok: boolean; member?: CloudClinicMember; error?: string }> {
    if (this.isUnitTestRuntime()) return { ok: false, error: 'Test runtime' };
    try {
      const { token, headers } = await this.getAuthContext();
      if (!token) return { ok: false, error: 'برای ثبت دسترسی پرسنل ابتدا با حساب گوگل وارد شوید.' };
      const res = await fetch('/api/sql/clinic/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as { ok?: boolean; member?: CloudClinicMember; error?: string };
      if (!res.ok) {
        return { ok: false, error: json.error || 'خطا در ثبت دسترسی پرسنل.' };
      }
      return { ok: true, member: json.member };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور کلینیک.' };
    }
  }

  public async removeCloudClinicMember(memberId: number): Promise<{ ok: boolean; error?: string }> {
    if (this.isUnitTestRuntime()) return { ok: false, error: 'Test runtime' };
    try {
      const { token, headers } = await this.getAuthContext();
      if (!token) return { ok: false, error: 'ابتدا با حساب گوگل وارد شوید.' };
      const res = await fetch(`/api/sql/clinic/members/${encodeURIComponent(String(memberId))}`, {
        method: 'DELETE',
        headers,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        return { ok: false, error: json.error || 'حذف دسترسی پرسنل ناموفق بود.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور کلینیک.' };
    }
  }

  public reconnectStream(): void {
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.activeStreamOpener?.();
  }

  public connectStream(): () => void {
    if (this.isUnitTestRuntime()) return () => {};
    if (
      typeof window === 'undefined' ||
      typeof EventSource === 'undefined' ||
      !window.location?.origin?.startsWith('http')
    ) {
      return () => {};
    }

    let disposed = false;

    const openSocket = async () => {
      if (disposed) return;
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      this.updateMeta({ connectionState: 'connecting' });
      try {
        let streamUrl = `/api/clinic/stream?clientId=${encodeURIComponent(this.clientId)}`;
        const { token, headers } = await this.getAuthContext();
        if (token && !disposed) {
          try {
            const ticketRes = await fetch('/api/sql/clinic/stream-ticket', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
            });
            if (ticketRes.ok) {
              const ticketJson = (await ticketRes.json()) as { ok?: boolean; ticket?: string };
              if (ticketJson?.ok && ticketJson.ticket) {
                streamUrl = `/api/sql/clinic/stream?ticket=${encodeURIComponent(ticketJson.ticket)}&clientId=${encodeURIComponent(this.clientId)}`;
              }
            }
          } catch {
            // fallback to local SSE stream if ticket endpoint is unreachable
          }
        }
        if (disposed) return;

        const es = new EventSource(streamUrl);
        this.eventSource = es;

        es.addEventListener('connected', (evt: MessageEvent) => {
          this.reconnectAttempt = 0;
          try {
            const data = JSON.parse(evt.data);
            this.updateMeta({
              connectionState: 'connected',
              revision: typeof data.revision === 'number' ? data.revision : this.meta.revision,
              connectedClients: Math.max(1, Number(data.connectedClients) || 1),
              mode: data.mode === 'live_production' ? 'live_production' : this.meta.mode,
            });
          } catch {
            this.updateMeta({ connectionState: 'connected' });
          }
        });

        es.addEventListener('presence', (evt: MessageEvent) => {
          try {
            const data = JSON.parse(evt.data);
            this.updateMeta({
              connectedClients: Math.max(1, Number(data.connectedClients) || 1),
            });
          } catch {
            // ignore malformed presence frame
          }
        });

        es.addEventListener('clinic-sync', (evt: MessageEvent) => {
          try {
            const data = JSON.parse(evt.data) as LiveSyncSnapshot & { sourceClientId?: string };
            if (data.sourceClientId === this.clientId) return;
            this.updateMeta({
              connectionState: 'connected',
              revision: data.revision,
              mode: data.mode === 'live_production' ? 'live_production' : 'demo_seeded',
              connectedClients: Math.max(1, Number(data.connectedClients) || 1),
              lastSyncedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
            });
            this.syncListeners.forEach((cb) => {
              try {
                cb({ ...data, initialized: true });
              } catch {
                // isolate listener error
              }
            });
          } catch {
            // ignore malformed sync frame
          }
        });

        es.addEventListener('incoming-call', (evt: MessageEvent) => {
          try {
            const call = JSON.parse(evt.data) as IncomingCallPushEvent;
            if (!call || !call.phoneNumber) return;
            this.incomingCallListeners.forEach((cb) => {
              try {
                cb(call);
              } catch {
                // isolate listener error
              }
            });
          } catch {
            // ignore malformed call frame
          }
        });

        es.onerror = () => {
          es.close();
          this.eventSource = null;
          this.updateMeta({ connectionState: 'offline' });
          if (disposed) return;
          const delay = Math.min(20000, 1500 * Math.pow(1.6, this.reconnectAttempt));
          this.reconnectAttempt++;
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            void openSocket();
          }, delay);
        };
      } catch {
        this.updateMeta({ connectionState: 'offline' });
      }
    };

    this.activeStreamOpener = () => {
      void openSocket();
    };

    void openSocket();

    const handleOnline = () => {
      this.reconnectAttempt = 0;
      void this.fetchAuthoritativeState();
      void openSocket();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      disposed = true;
      this.activeStreamOpener = null;
      window.removeEventListener('online', handleOnline);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };
  }
}

export const clinicRealtimeClient = new ClinicRealtimeClient();
