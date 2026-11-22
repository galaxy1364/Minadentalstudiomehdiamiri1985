import { SyncEvent, UserAccount, PlatformDevice, ClinicBackupData, Patient, Appointment, InventoryItem } from '../types/dental';
import { indexedDbService, OfflineSyncOutboxItem } from './indexedDbService';

const SYNC_CHANNEL_NAME = 'minadental_mesh_sync_v1';
const SYNC_PULSE_KEY = 'minadental_sync_pulse_v1';

// Initial pre-configured accounts created by Clinic Admin
// Initial pre-configured accounts created by Clinic Admin
export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user-manager-amiri',
    username: 'dr_amiri',
    fullName: 'دکتر مهدی امیری (مدیر کلینیک و دندانپزشک معالج)',
    role: 'admin',
    assignedPlatform: 'پنل مدیریت کلینیک و یونیت آبی',
    avatarColor: '#c8ff00',
    email: 'mehdi.amiri19851364@gmail.com',
    passwordHash: 'sha256$amiri_v27$b7e111418a6541333887f4a851e4c98e2f3382a54358c30452d72ed6ffbde812',
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
    medicalLicense: '۱۸۴۹۲-م',
    isActive: true,
    isManager: true,
    isDoctor: true,
    isManagerAndDoctor: true,
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: true,
      canCollectPayments: true,
      canManageChecks: true,
      canAccessSettingsAndUsers: true,
      canBackupAndRestore: true,
      canEditPrices: true,
      canDeleteRecords: true,
      canManageStaff: true,
      canViewReports: true,
      canAccessLabPortal: true,
    }
  },
  {
    id: 'user-doc-rezvani',
    username: 'dr_rezvani',
    fullName: 'دکتر سارا رضوانی (متخصص ارتودنسی)',
    role: 'doctor',
    assignedPlatform: 'یونیت زرد دندانپزشکی',
    avatarColor: '#06b6d4',
    email: 'sara.rezvani@minadental.com',
    passwordHash: 'sha256$sara_v27$047a4865ca8dcf66436c12723c85f976da9b60326ca1db7a95c14c5ce2ebad04',
    phone: '۰۹۱۲۵۵۵۴۴۳۳',
    medicalLicense: '۲۴۹۱۰-م',
    isActive: true,
    isManager: false,
    isDoctor: true,
    isManagerAndDoctor: false,
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: true,
      canCollectPayments: false,
      canManageChecks: false,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: false,
      canEditPrices: false,
      canDeleteRecords: false,
      canManageStaff: false,
      canViewReports: false,
      canAccessLabPortal: true,
    }
  },
  {
    id: 'user-secretary',
    username: 'monshi',
    fullName: 'مریم کاظمی (منشی و پذیرش)',
    role: 'secretary',
    assignedPlatform: 'کانتر پذیرش و صندوق',
    avatarColor: '#f59e0b',
    email: 'secretary@minadental.com',
    passwordHash: 'sha256$monshi_v27$2caf46ebbcba7b6fa1fb20fe028857a42f1704101efe6a911e816a9861268205',
    phone: '۰۹۱۹۱۱۱۲۲۳۳',
    isActive: true,
    isManager: false,
    isDoctor: false,
    isManagerAndDoctor: false,
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: false,
      canCollectPayments: true,
      canManageChecks: true,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: true,
      canEditPrices: false, // منشی حق ویرایش تعرفه یا تخفیف ندارد مگر تایید مدیر
      canDeleteRecords: false, // منشی حق حذف سوابق ندارد
      canManageStaff: false,
      canViewReports: false,
      canAccessLabPortal: true,
    }
  },
  {
    id: 'user-assistant',
    username: 'dastyar',
    fullName: 'پریسا نوری (دستیار جراحی و استریلیزاسیون CSR)',
    role: 'assistant',
    assignedPlatform: 'یونیت جراحی و استریل',
    avatarColor: '#10b981',
    email: 'assistant@minadental.com',
    passwordHash: 'sha256$parisa_v27$ff17a66b23fb091ffbe8e8d04a0c66e6ae54281fcb046a6771467a3337e49720',
    phone: '۰۹۳۵۴۴۴۳۳۲۲',
    isActive: true,
    isManager: false,
    isDoctor: false,
    isManagerAndDoctor: false,
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: false,
      canCollectPayments: false,
      canManageChecks: false,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: false,
      canEditPrices: false,
      canDeleteRecords: false,
      canManageStaff: false,
      canViewReports: false,
      canAccessLabPortal: true,
    }
  },
  {
    id: 'user-accountant',
    username: 'hesabdar',
    fullName: 'امیر حسینی (حسابدار کلینیک و امور صیاد)',
    role: 'accountant',
    assignedPlatform: 'اتاق مالی و حسابداری',
    avatarColor: '#8b5cf6',
    email: 'finance@minadental.com',
    passwordHash: 'sha256$hesab_v27$b0e49b83fee5ceece91f771f43a414edcd7c79d5d92585ff972a9ff525595bf',
    phone: '۰۹۱۲۹۹۹۸۸۷۷',
    isActive: true,
    isManager: false,
    isDoctor: false,
    isManagerAndDoctor: false,
    permissions: {
      canManageAppointments: false,
      canRegisterTreatments: false,
      canCollectPayments: true,
      canManageChecks: true,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: true,
      canEditPrices: false,
      canDeleteRecords: false,
      canManageStaff: false,
      canViewReports: true,
      canAccessLabPortal: false,
    }
  }
];

// Initial Connected Platforms
export const INITIAL_PLATFORMS: PlatformDevice[] = [
  {
    id: 'dev-1',
    deviceName: 'سیستم پذیرش و صندوق مرکزی (ویندوز)',
    deviceType: 'desktop',
    assignedRole: 'secretary',
    assignedUser: 'مریم کاظمی (منشی)',
    lastSyncTime: 'همین الان (آنلاین)',
    isOnline: true
  },
  {
    id: 'dev-2',
    deviceName: 'تبلت یونیت آبی (آیپد دکتر امیری)',
    deviceType: 'tablet',
    assignedRole: 'doctor',
    assignedUser: 'دکتر مهدی امیری',
    lastSyncTime: 'همین الان (آنلاین)',
    isOnline: true
  },
  {
    id: 'dev-3',
    deviceName: 'تبلت یونیت جراحی و ایمپلنت',
    deviceType: 'tablet',
    assignedRole: 'doctor',
    assignedUser: 'دستیار جراحی',
    lastSyncTime: '۲ دقیقه قبل',
    isOnline: true
  },
  {
    id: 'dev-4',
    deviceName: 'موبایل همراه مدیر کلینیک (PWA)',
    deviceType: 'mobile',
    assignedRole: 'admin',
    assignedUser: 'مدیر کلینیک',
    lastSyncTime: 'همین الان (آنلاین)',
    isOnline: true
  }
];

export interface OfflineFlushSink {
  savePatient?: (p: any) => Promise<any>;
  saveAppointment?: (a: any) => Promise<any>;
  saveInventoryItem?: (i: any) => Promise<any>;
  saveSayadCheck?: (c: any) => Promise<any>;
  saveLabOrder?: (l: any) => Promise<any>;
  saveImplantCase?: (im: any) => Promise<any>;
  savePayment?: (pm: any) => Promise<any>;
}

class SyncEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: ((event: SyncEvent) => void)[] = [];
  private isFlushingOutbox: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
          this.channel.onmessage = (msg) => {
            if (msg.data && typeof msg.data === 'object') {
              this.notifyListeners(msg.data as SyncEvent);
            }
          };
        } catch (err) {
          console.warn('BroadcastChannel initialization error:', err);
        }
      }

      // Cross-tab fallback pulse listener (for browsers/WebViews where BroadcastChannel is partitioned)
      window.addEventListener('storage', (e) => {
        if (e.key === SYNC_PULSE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as SyncEvent;
            if (parsed && parsed.id) {
              this.notifyListeners(parsed);
            }
          } catch {}
        }
      });
    }
  }

  // Subscribe to real-time events
  public onSyncEvent(callback: (event: SyncEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Broadcast an event across all tabs and devices
  public broadcast(event: Omit<SyncEvent, 'id' | 'timestamp'>): SyncEvent {
    const fullEvent: SyncEvent = {
      ...event,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // 1. Send via BroadcastChannel for instant multi-tab sync
    if (this.channel) {
      try {
        this.channel.postMessage(fullEvent);
      } catch (e) {
        console.warn('Channel postMessage failed:', e);
      }
    }

    // 2. Write localStorage pulse so other tabs sync even on legacy WebViews
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SYNC_PULSE_KEY, JSON.stringify(fullEvent));
      } catch {}
    }

    // 3. Also notify local listeners
    this.notifyListeners(fullEvent);

    return fullEvent;
  }

  /**
   * Record any clinic mutation: broadcasts immediately across active platforms/tabs
   * AND persists to IndexedDB `sync_queue` whenever offline (or queued for guaranteed delivery)
   * so that reconnection automatically flushes changes in chronological order.
   */
  public async recordOfflineOrLiveMutation(params: {
    entity: OfflineSyncOutboxItem['entity'];
    action?: 'UPSERT' | 'DELETE';
    payload: any;
    actorName: string;
    actorRole: string;
    platform: string;
    eventType?: SyncEvent['type'];
    title?: string;
    description?: string;
    forceOfflineQueue?: boolean;
  }): Promise<{ queuedOffline: boolean; event: SyncEvent }> {
    const isOffline =
      params.forceOfflineQueue === true ||
      (typeof navigator !== 'undefined' && navigator.onLine === false);

    if (isOffline) {
      await indexedDbService.enqueueSyncOperation({
        entity: params.entity,
        action: params.action || 'UPSERT',
        payload: params.payload,
        actorName: params.actorName,
        actorRole: params.actorRole,
        platform: params.platform
      });
    }

    const event = this.broadcast({
      type: params.eventType || 'CLOUD_BACKUP_SAVED',
      performedBy: params.actorName,
      role: (params.actorRole as any) || 'admin',
      platform: params.platform,
      title:
        params.title ||
        (isOffline ? `ذخیره آفلاین (${params.entity})` : `همگام‌سازی فوری (${params.entity})`),
      description:
        params.description ||
        (isOffline
          ? 'تغییر در صف آفلاین IndexedDB ذخیره شد و به محض اتصال اینترنت ارسال می‌گردد.'
          : 'تغییر بین پلتفرم‌های فعال پرسنل همگام‌سازی شد.')
    });

    return { queuedOffline: isOffline, event };
  }

  /**
   * Chronologically flush all queued offline operations once internet reconnects.
   */
  public async flushOfflineOutbox(sink: OfflineFlushSink): Promise<{
    flushedCount: number;
    remainingCount: number;
    flushedAt: string;
  }> {
    const nowFormatted =
      typeof window !== 'undefined'
        ? new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '12:00:00';

    if (this.isFlushingOutbox) {
      const remaining = await indexedDbService.getPendingSyncOperations();
      return { flushedCount: 0, remainingCount: remaining.length, flushedAt: nowFormatted };
    }

    this.isFlushingOutbox = true;
    let flushedCount = 0;

    try {
      const pending = await indexedDbService.getPendingSyncOperations();
      for (const op of pending) {
        try {
          if (op.entity === 'patient' && sink.savePatient) {
            await sink.savePatient(op.payload);
          } else if (op.entity === 'appointment' && sink.saveAppointment) {
            await sink.saveAppointment(op.payload);
          } else if (op.entity === 'inventory' && sink.saveInventoryItem) {
            await sink.saveInventoryItem(op.payload);
          } else if (op.entity === 'sayad_check' && sink.saveSayadCheck) {
            await sink.saveSayadCheck(op.payload);
          } else if (op.entity === 'lab_order' && sink.saveLabOrder) {
            await sink.saveLabOrder(op.payload);
          } else if (op.entity === 'implant_case' && sink.saveImplantCase) {
            await sink.saveImplantCase(op.payload);
          } else if (op.entity === 'payment' && sink.savePayment) {
            await sink.savePayment(op.payload);
          }

          await indexedDbService.removeSyncOperation(op.opId);
          flushedCount += 1;
        } catch (err) {
          console.warn('Failed to flush offline operation:', op.opId, err);
        }
      }

      const afterOps = await indexedDbService.getPendingSyncOperations();
      if (typeof window !== 'undefined' && flushedCount > 0) {
        window.dispatchEvent(
          new CustomEvent('minadental:outbox-flushed', { detail: { flushedCount, remainingCount: afterOps.length } })
        );
        window.dispatchEvent(
          new CustomEvent('minadental:cloud-commit-success', { detail: { timestamp: Date.now() } })
        );
      }

      return {
        flushedCount,
        remainingCount: afterOps.length,
        flushedAt: nowFormatted
      };
    } finally {
      this.isFlushingOutbox = false;
    }
  }

  public getSyncHealthStats() {
    return {
      pendingOutboxCount: indexedDbService.getPendingSyncCountSync(),
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
      isBroadcastChannelActive: Boolean(this.channel)
    };
  }

  private notifyListeners(event: SyncEvent) {
    this.listeners.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.error('Error in sync listener callback:', e);
      }
    });
  }

  // Export full JSON backup
  public exportBackup(data: {
    clinicName: string;
    patients: Patient[];
    appointments: Appointment[];
    inventory: InventoryItem[];
    users: UserAccount[];
    platforms: PlatformDevice[];
  }): string {
    const backup: ClinicBackupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      clinicName: data.clinicName,
      patients: data.patients,
      appointments: data.appointments,
      inventory: data.inventory,
      users: data.users,
      platforms: data.platforms
    };
    return JSON.stringify(backup, null, 2);
  }

  // Download local file
  public downloadBackupFile(jsonString: string, filename = 'minadental_clinic_backup.json') {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const syncEngine = new SyncEngine();
