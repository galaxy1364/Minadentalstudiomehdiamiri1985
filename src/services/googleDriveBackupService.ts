import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import { getFirebaseClient, WORKSPACE_SCOPES } from '../lib/firebase';
import { parseAndValidateClinicBackup } from '../utils/eccSchemas';
import { getCurrentPersianDate, toEnglishDigits } from '../utils/jalali';

export const SCOPES = WORKSPACE_SCOPES;

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FOLDER_NAME = 'MinaDental Backups';
const DRIVE_SCHEDULE_STORAGE_KEY = 'minadental_gdrive_auto_backup_v1';

export interface GoogleDriveBackupFile {
  id: string;
  name: string;
  size: number;
  modifiedTime: string;
  webViewLink?: string;
}

export interface GoogleDriveScheduleConfig {
  enabled: boolean;
  dailyTime: string; // HH:mm
  backupOnChange: boolean;
  lastBackupAt: string | null;
  lastAutoBackupDate: string | null; // YYYY-MM-DD
  lastBackupFileName: string | null;
  lastConnectedEmail: string | null;
}

export interface GoogleDriveAuthSnapshot {
  user: User | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  hasAccessToken: boolean;
  needsAuth: boolean;
  isSigningIn: boolean;
}

const DEFAULT_SCHEDULE: GoogleDriveScheduleConfig = {
  enabled: true,
  dailyTime: '22:30',
  backupOnChange: true,
  lastBackupAt: null,
  lastAutoBackupDate: null,
  lastBackupFileName: null,
  lastConnectedEmail: null,
};

// Strictly in-memory OAuth access token cache (NEVER persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let cachedFolderId: string | null = null;
let isSigningInFlag = false;
let authListenerUnsubscribe: (() => void) | null = null;

const authListeners = new Set<(snapshot: GoogleDriveAuthSnapshot) => void>();
const scheduleListeners = new Set<(config: GoogleDriveScheduleConfig) => void>();

function ensureFirebaseAuth(): { auth: Auth; provider: GoogleAuthProvider } | null {
  const client = getFirebaseClient();
  if (!client) return null;
  return { auth: client.auth, provider: client.googleAuthProvider };
}

export function getGoogleDriveAuthSnapshot(): GoogleDriveAuthSnapshot {
  const hasToken = Boolean(cachedAccessToken && cachedUser);
  return {
    user: cachedUser,
    email: cachedUser?.email ?? null,
    displayName: cachedUser?.displayName ?? null,
    photoURL: cachedUser?.photoURL ?? null,
    hasAccessToken: hasToken,
    needsAuth: !hasToken,
    isSigningIn: isSigningInFlag,
  };
}

function notifyAuthListeners(): void {
  const snapshot = getGoogleDriveAuthSnapshot();
  for (const listener of authListeners) {
    try {
      listener(snapshot);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function initGoogleDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
): () => void {
  const pair = ensureFirebaseAuth();
  if (!pair) {
    onAuthFailure?.();
    return () => {};
  }

  if (!authListenerUnsubscribe) {
    authListenerUnsubscribe = onAuthStateChanged(pair.auth, (user: User | null) => {
      cachedUser = user;
      if (user) {
        if (cachedAccessToken) {
          onAuthSuccess?.(user, cachedAccessToken);
        } else if (!isSigningInFlag) {
          cachedAccessToken = null;
          cachedFolderId = null;
          onAuthFailure?.();
        }
      } else {
        cachedAccessToken = null;
        cachedFolderId = null;
        onAuthFailure?.();
      }
      notifyAuthListeners();
    });
  } else {
    if (cachedUser && cachedAccessToken) {
      onAuthSuccess?.(cachedUser, cachedAccessToken);
    } else if (!isSigningInFlag) {
      onAuthFailure?.();
    }
  }

  return () => {
    // Keep singleton listener active while app lives; component subscriptions use subscribeGoogleDriveAuth
  };
}

export function subscribeGoogleDriveAuth(
  listener: (snapshot: GoogleDriveAuthSnapshot) => void
): () => void {
  initGoogleDriveAuth();
  authListeners.add(listener);
  listener(getGoogleDriveAuthSnapshot());
  return () => {
    authListeners.delete(listener);
  };
}

export async function signInWithGoogleForDrive(): Promise<{
  user: User;
  accessToken: string;
}> {
  const pair = ensureFirebaseAuth();
  if (!pair) {
    throw new Error('سرویس احراز هویت گوگل در این محیط در دسترس نیست.');
  }

  isSigningInFlag = true;
  notifyAuthListeners();

  try {
    const result = await signInWithPopup(pair.auth, pair.provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('دسترسی گوگل درایو تایید نشد. لطفاً مجدداً تلاش کنید.');
    }

    cachedUser = result.user;
    cachedAccessToken = credential.accessToken;
    cachedFolderId = null;

    if (result.user.email) {
      updateGoogleDriveSchedule({ lastConnectedEmail: result.user.email });
    }

    notifyAuthListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningInFlag = false;
    notifyAuthListeners();
  }
}

export async function signOutGoogleDrive(): Promise<void> {
  const pair = ensureFirebaseAuth();
  cachedAccessToken = null;
  cachedUser = null;
  cachedFolderId = null;
  if (pair) {
    try {
      await pair.auth.signOut();
    } catch {
      // ignore signOut failure
    }
  }
  notifyAuthListeners();
}

export function getGoogleDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function getGoogleDriveSchedule(): GoogleDriveScheduleConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_SCHEDULE };
  try {
    const raw = localStorage.getItem(DRIVE_SCHEDULE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GoogleDriveScheduleConfig>;
      return {
        enabled: parsed.enabled !== false,
        dailyTime: typeof parsed.dailyTime === 'string' && parsed.dailyTime ? parsed.dailyTime : DEFAULT_SCHEDULE.dailyTime,
        backupOnChange: parsed.backupOnChange !== false,
        lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
        lastAutoBackupDate: typeof parsed.lastAutoBackupDate === 'string' ? parsed.lastAutoBackupDate : null,
        lastBackupFileName: typeof parsed.lastBackupFileName === 'string' ? parsed.lastBackupFileName : null,
        lastConnectedEmail: typeof parsed.lastConnectedEmail === 'string' ? parsed.lastConnectedEmail : null,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_SCHEDULE };
}

export function updateGoogleDriveSchedule(
  patch: Partial<GoogleDriveScheduleConfig>
): GoogleDriveScheduleConfig {
  const next: GoogleDriveScheduleConfig = {
    ...getGoogleDriveSchedule(),
    ...patch,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DRIVE_SCHEDULE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }
  for (const listener of scheduleListeners) {
    try {
      listener(next);
    } catch {
      // ignore subscriber errors
    }
  }
  return next;
}

export function subscribeGoogleDriveSchedule(
  listener: (config: GoogleDriveScheduleConfig) => void
): () => void {
  scheduleListeners.add(listener);
  listener(getGoogleDriveSchedule());
  return () => {
    scheduleListeners.delete(listener);
  };
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getGoogleDriveAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    cachedAccessToken = null;
    cachedFolderId = null;
    notifyAuthListeners();
    throw new Error('AUTH_EXPIRED');
  }

  return response;
}

async function ensureBackupFolderId(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${BACKUP_FOLDER_NAME}' and trashed=false`
  );
  const searchRes = await driveFetch(
    `${DRIVE_API_BASE}/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`
  );
  if (!searchRes.ok) {
    throw new Error(`خطا در جستجوی پوشه گوگل درایو (${searchRes.status})`);
  }
  const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
  if (searchData.files && searchData.files.length > 0 && searchData.files[0].id) {
    cachedFolderId = searchData.files[0].id;
    return cachedFolderId;
  }

  const createRes = await driveFetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        app: 'minadental',
        kind: 'backup_folder',
      },
    }),
  });
  if (!createRes.ok) {
    throw new Error(`خطا در ایجاد پوشه پشتیبان گوگل درایو (${createRes.status})`);
  }
  const created = (await createRes.json()) as { id: string };
  cachedFolderId = created.id;
  return created.id;
}

export async function uploadBackupToGoogleDrive(
  backupJson: string,
  options?: { tag?: 'manual' | 'auto_daily' | 'auto_change' }
): Promise<GoogleDriveBackupFile> {
  const folderId = await ensureBackupFolderId();
  const dateSlug = toEnglishDigits(getCurrentPersianDate()).replace(/\//g, '-');
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const tagPrefix =
    options?.tag === 'auto_daily'
      ? 'AutoDaily'
      : options?.tag === 'auto_change'
      ? 'AutoSync'
      : 'Manual';
  const fileName = `MinaDental-${tagPrefix}-${dateSlug}_${hh}-${mm}-${ss}.json`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    appProperties: {
      app: 'minadental',
      kind: 'clinic_backup',
      trigger: options?.tag || 'manual',
    },
  };

  const boundary = `minadental_drive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    backupJson,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveFetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,size,modifiedTime,webViewLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`خطا در آپلود نسخه پشتیبان به گوگل درایو (${res.status}): ${errText.slice(0, 120)}`);
  }

  const uploaded = (await res.json()) as {
    id: string;
    name: string;
    size?: string | number;
    modifiedTime?: string;
    webViewLink?: string;
  };

  const todayIso = now.toISOString().slice(0, 10);
  updateGoogleDriveSchedule({
    lastBackupAt: uploaded.modifiedTime || now.toISOString(),
    lastBackupFileName: uploaded.name,
    ...(options?.tag === 'auto_daily' ? { lastAutoBackupDate: todayIso } : {}),
  });

  return {
    id: uploaded.id,
    name: uploaded.name,
    size: Number(uploaded.size) || backupJson.length,
    modifiedTime: uploaded.modifiedTime || now.toISOString(),
    webViewLink: uploaded.webViewLink,
  };
}

export async function listGoogleDriveBackups(): Promise<GoogleDriveBackupFile[]> {
  const folderId = await ensureBackupFolderId();
  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/json' and trashed=false`
  );
  const res = await driveFetch(
    `${DRIVE_API_BASE}/files?q=${query}&spaces=drive&orderBy=modifiedTime desc&pageSize=20&fields=files(id,name,size,modifiedTime,webViewLink)`
  );
  if (!res.ok) {
    throw new Error(`خطا در دریافت لیست بکاپ‌های گوگل درایو (${res.status})`);
  }
  const data = (await res.json()) as {
    files?: Array<{
      id: string;
      name: string;
      size?: string | number;
      modifiedTime?: string;
      webViewLink?: string;
    }>;
  };
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size) || 0,
    modifiedTime: f.modifiedTime || '',
    webViewLink: f.webViewLink,
  }));
}

export async function downloadAndValidateDriveBackup(fileId: string) {
  const res = await driveFetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!res.ok) {
    throw new Error(`خطا در دانلود فایل پشتیبان از گوگل درایو (${res.status})`);
  }
  const rawText = await res.text();
  return parseAndValidateClinicBackup(rawText);
}

export async function deleteGoogleDriveBackupFile(fileId: string): Promise<void> {
  const res = await driveFetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`خطا در حذف فایل از گوگل درایو (${res.status})`);
  }
}
