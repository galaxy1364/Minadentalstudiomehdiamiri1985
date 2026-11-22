import { useEffect, useRef } from 'react';
import { Patient, Appointment, InventoryItem, UserAccount, PlatformDevice } from '../types/dental';
import { syncEngine } from '../services/syncEngine';
import {
  getGoogleDriveAccessToken,
  getGoogleDriveSchedule,
  uploadBackupToGoogleDrive,
} from '../services/googleDriveBackupService';

interface UseGoogleDriveAutoBackupOptions {
  clinicName: string;
  patients: Patient[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  users: UserAccount[];
  platforms: PlatformDevice[];
  onAutoBackupSaved?: (fileName: string) => void;
}

const CHANGE_BACKUP_MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes debounce for change-triggered uploads
const DAILY_CHECK_INTERVAL_MS = 60 * 1000; // check daily schedule every 60 seconds

export function useGoogleDriveAutoBackup({
  clinicName,
  patients,
  appointments,
  inventory,
  users,
  platforms,
  onAutoBackupSaved,
}: UseGoogleDriveAutoBackupOptions): void {
  const latestDataRef = useRef({
    clinicName,
    patients,
    appointments,
    inventory,
    users,
    platforms,
  });
  const onSavedRef = useRef(onAutoBackupSaved);
  const lastChangeSignatureRef = useRef<string>('');
  const lastChangeUploadAtRef = useRef<number>(0);
  const uploadInFlightRef = useRef<boolean>(false);

  latestDataRef.current = {
    clinicName,
    patients,
    appointments,
    inventory,
    users,
    platforms,
  };
  onSavedRef.current = onAutoBackupSaved;

  // 1. Scheduled Daily Auto-Backup to Google Drive (runs when user is signed in with Google)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDailySchedule = async () => {
      if (uploadInFlightRef.current) return;
      if (!getGoogleDriveAccessToken()) return;

      const schedule = getGoogleDriveSchedule();
      if (!schedule.enabled) return;

      const now = new Date();
      const todayIso = now.toISOString().slice(0, 10);
      if (schedule.lastAutoBackupDate === todayIso) return;

      const [targetHourStr, targetMinStr] = (schedule.dailyTime || '22:30').split(':');
      const targetHour = Number(targetHourStr);
      const targetMin = Number(targetMinStr);
      if (!Number.isFinite(targetHour) || !Number.isFinite(targetMin)) return;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const scheduledMinutes = targetHour * 60 + targetMin;
      if (currentMinutes < scheduledMinutes) return;

      uploadInFlightRef.current = true;
      try {
        const json = syncEngine.exportBackup(latestDataRef.current);
        const uploaded = await uploadBackupToGoogleDrive(json, { tag: 'auto_daily' });
        lastChangeUploadAtRef.current = Date.now();
        onSavedRef.current?.(uploaded.name);
      } catch {
        // Silently defer to next tick if offline or token expired
      } finally {
        uploadInFlightRef.current = false;
      }
    };

    const timerId = window.setInterval(() => {
      void checkDailySchedule();
    }, DAILY_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  // 2. Debounced Change-Driven Auto-Backup to Google Drive (protects against sudden data loss)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const signature = `${patients.length}:${appointments.length}:${inventory.length}:${patients
      .slice(0, 10)
      .map((p) => `${p.id}-${p.paidAmount}-${p.totalCost}-${(p.treatments || []).length}`)
      .join('|')}`;

    if (!lastChangeSignatureRef.current) {
      lastChangeSignatureRef.current = signature;
      return;
    }

    if (signature === lastChangeSignatureRef.current) return;
    lastChangeSignatureRef.current = signature;

    if (!getGoogleDriveAccessToken()) return;
    const schedule = getGoogleDriveSchedule();
    if (!schedule.backupOnChange) return;

    const elapsed = Date.now() - lastChangeUploadAtRef.current;
    const waitMs = elapsed >= CHANGE_BACKUP_MIN_INTERVAL_MS ? 4000 : CHANGE_BACKUP_MIN_INTERVAL_MS - elapsed;

    const timeoutId = window.setTimeout(async () => {
      if (uploadInFlightRef.current || !getGoogleDriveAccessToken()) return;
      const latestSchedule = getGoogleDriveSchedule();
      if (!latestSchedule.backupOnChange) return;

      uploadInFlightRef.current = true;
      try {
        const json = syncEngine.exportBackup(latestDataRef.current);
        const uploaded = await uploadBackupToGoogleDrive(json, { tag: 'auto_change' });
        lastChangeUploadAtRef.current = Date.now();
        onSavedRef.current?.(uploaded.name);
      } catch {
        // Non-fatal background sync error
      } finally {
        uploadInFlightRef.current = false;
      }
    }, waitMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [patients, appointments, inventory]);
}
