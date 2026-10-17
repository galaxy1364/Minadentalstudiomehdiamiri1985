import { SyncEvent, UserAccount, PlatformDevice, ClinicBackupData, Patient, Appointment, InventoryItem } from '../types/dental';

const SYNC_CHANNEL_NAME = 'minadental_mesh_sync_v1';
const STORAGE_KEY = 'minadental_clinic_db_v1';
const USERS_STORAGE_KEY = 'minadental_clinic_users_v1';
const PLATFORMS_STORAGE_KEY = 'minadental_clinic_platforms_v1';

// Initial pre-configured accounts created by Clinic Admin
export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user-admin',
    username: 'admin',
    fullName: 'مدیر کلینیک (دسترسی ارشد)',
    role: 'admin',
    assignedPlatform: 'پنل مدیریت کلینیک',
    avatarColor: '#c8ff00',
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: true,
      canCollectPayments: true,
      canManageChecks: true,
      canAccessSettingsAndUsers: true,
      canBackupAndRestore: true,
    }
  },
  {
    id: 'user-doctor',
    username: 'dr_amiri',
    fullName: 'دکتر مهدی امیری (پزشک معالج)',
    role: 'doctor',
    assignedPlatform: 'یونیت ۱ دندانپزشکی',
    avatarColor: '#10b981',
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: true,
      canCollectPayments: false,
      canManageChecks: false,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: false,
    }
  },
  {
    id: 'user-secretary',
    username: 'monshi',
    fullName: 'مریم کاظمی (منشی و پذیرش)',
    role: 'secretary',
    assignedPlatform: 'کانتر پذیرش و صندوق',
    avatarColor: '#f59e0b',
    permissions: {
      canManageAppointments: true,
      canRegisterTreatments: false,
      canCollectPayments: true,
      canManageChecks: true,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: true,
    }
  },
  {
    id: 'user-accountant',
    username: 'hesabdar',
    fullName: 'حسابدار کلینیک (امور چک و صیاد)',
    role: 'accountant',
    assignedPlatform: 'اتاق مالی و حسابداری',
    avatarColor: '#8b5cf6',
    permissions: {
      canManageAppointments: false,
      canRegisterTreatments: false,
      canCollectPayments: true,
      canManageChecks: true,
      canAccessSettingsAndUsers: false,
      canBackupAndRestore: true,
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
    deviceName: 'تبلت یونیت ۱ (آیپد دکتر امیری)',
    deviceType: 'tablet',
    assignedRole: 'doctor',
    assignedUser: 'دکتر مهدی امیری',
    lastSyncTime: 'همین الان (آنلاین)',
    isOnline: true
  },
  {
    id: 'dev-3',
    deviceName: 'تبلت اتاق جراحی و ایمپلنت',
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

class SyncEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: ((event: SyncEvent) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
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

    // 2. Also notify local listeners
    this.notifyListeners(fullEvent);

    return fullEvent;
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
  public downloadBackupFile(jsonString: string, filename = 'qdent_clinic_backup.json') {
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
