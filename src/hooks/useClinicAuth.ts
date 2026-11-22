import { useState, useEffect, useCallback } from 'react';
import { UserAccount, PlatformDevice } from '../types/dental';
import { INITIAL_USERS, INITIAL_PLATFORMS, syncEngine } from '../services/syncEngine';
import { sanitizeUsersList, sanitizeUserAccount, verifyPasswordCredential } from '../utils/authCrypto';
import { verifyManagerDeletion, archiveToTrashVault, appendSecurityAuditLog } from '../utils/dataProtection';
import { undoManager } from '../utils/undoManager';

const USERS_STORAGE_KEY = 'minadental_clinic_users_v2';
const PLATFORMS_STORAGE_KEY = 'minadental_clinic_platforms_v2';
const SESSION_LOCK_KEY = 'minadental_session_locked_v1';

export function useClinicAuth() {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeUsersList(parsed);
        }
      }
    } catch {}
    return sanitizeUsersList(INITIAL_USERS);
  });

  const [platforms, setPlatforms] = useState<PlatformDevice[]>(() => {
    try {
      const saved = localStorage.getItem(PLATFORMS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PLATFORMS;
  });

  const [currentUser, setCurrentUser] = useState<UserAccount>(() => users[2] || INITIAL_USERS[2]);

  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SESSION_LOCK_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Persist sanitized users and listen for cross-tab/cross-role updates from SettingsView & Manager
  useEffect(() => {
    const syncUsersFromStorage = () => {
      try {
        const saved = localStorage.getItem(USERS_STORAGE_KEY);
        if (saved) {
          const parsed: UserAccount[] = sanitizeUsersList(JSON.parse(saved));
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsers(parsed);
            setCurrentUser(prev => parsed.find(u => u.id === prev.id) || prev);
          }
        }
        const savedPlatforms = localStorage.getItem(PLATFORMS_STORAGE_KEY);
        if (savedPlatforms) {
          const parsedPlat: PlatformDevice[] = JSON.parse(savedPlatforms);
          if (Array.isArray(parsedPlat) && parsedPlat.length > 0) {
            setPlatforms(parsedPlat);
          }
        }
      } catch {}
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === USERS_STORAGE_KEY || e.key === PLATFORMS_STORAGE_KEY) {
        syncUsersFromStorage();
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('minadental_staff_auth_sync_v1');
        bc.onmessage = () => syncUsersFromStorage();
      } catch {}
    }

    window.addEventListener('minadental:staff-users-updated', syncUsersFromStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('minadental:staff-users-updated', syncUsersFromStorage);
      window.removeEventListener('storage', handleStorage);
      try {
        bc?.close();
      } catch {}
    };
  }, []);

  const persistUsers = useCallback((nextUsers: UserAccount[]) => {
    const sanitized = sanitizeUsersList(nextUsers);
    setUsers(sanitized);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitized));
      window.dispatchEvent(new CustomEvent('minadental:staff-users-updated'));
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('minadental_staff_auth_sync_v1');
        bc.postMessage({ type: 'STAFF_SYNC', updatedAt: Date.now() });
        bc.close();
      }
    } catch {}
    return sanitized;
  }, []);

  const lockSession = useCallback(() => {
    setIsSessionLocked(true);
    try {
      localStorage.setItem(SESSION_LOCK_KEY, '1');
    } catch {}
    appendSecurityAuditLog({
      actor: currentUser.fullName,
      role: currentUser.role,
      action: 'قفل امنیتی شیفت کلینیک فعال شد',
      details: 'دسترسی تا زمان احراز هویت مجدد با کلمه عبور مسدود گردید.',
      severity: 'info'
    });
  }, [currentUser]);

  const unlockWithCredentials = useCallback(
    (emailOrUsername: string, password: string): { ok: boolean; error?: string; user?: UserAccount } => {
      const idTrim = emailOrUsername.trim().toLowerCase();
      const passTrim = password.trim();
      if (!idTrim || !passTrim) {
        return { ok: false, error: 'لطفاً ایمیل/نام کاربری و کلمه عبور را وارد کنید.' };
      }

      const matched = users.find(
        u =>
          (u.email && u.email.toLowerCase() === idTrim) ||
          (u.username && u.username.toLowerCase() === idTrim)
      );

      if (!matched) {
        return { ok: false, error: 'کاربری با این مشخصات یافت نشد.' };
      }
      if (matched.isActive === false) {
        return { ok: false, error: 'این حساب کاربری توسط مدیر کلینیک معلق شده است.' };
      }
      if (!verifyPasswordCredential(passTrim, matched)) {
        appendSecurityAuditLog({
          actor: matched.fullName,
          role: matched.role,
          action: `تلاش ناموفق بازگشایی قفل شیفت (${matched.username})`,
          details: 'کلمه عبور اشتباه در صفحه قفل وارد شد.',
          severity: 'warning'
        });
        return { ok: false, error: 'کلمه عبور وارد شده نادرست است.' };
      }

      setCurrentUser(matched);
      setIsSessionLocked(false);
      try {
        localStorage.setItem(SESSION_LOCK_KEY, '0');
      } catch {}
      appendSecurityAuditLog({
        actor: matched.fullName,
        role: matched.role,
        action: 'بازگشایی قفل شیفت با کلمه عبور',
        details: `ورود موفق به پلتفرم ${matched.assignedPlatform}`,
        severity: 'info'
      });
      return { ok: true, user: matched };
    },
    [users]
  );

  const handleAddNewUser = useCallback(
    (newUser: UserAccount) => {
      const sanitized = sanitizeUserAccount(newUser);
      setUsers(prev => {
        const next = [...prev, sanitized];
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new CustomEvent('minadental:staff-users-updated'));
        } catch {}
        return next;
      });
      syncEngine.broadcast({
        type: 'CLOUD_BACKUP_SAVED',
        performedBy: currentUser.username,
        role: currentUser.role,
        platform: currentUser.assignedPlatform,
        title: `عضو جدید ${sanitized.fullName} به کلینیک اضافه شد`,
        description: `نقش ${sanitized.role} با ایمیل ${sanitized.email} و رمز عبور هش‌شده ایجاد گردید.`
      });
    },
    [currentUser]
  );

  const handleEditUser = useCallback(
    (updatedUser: UserAccount) => {
      const sanitized = sanitizeUserAccount(updatedUser);
      const prevUsers = users;
      const next = persistUsers(users.map(u => (u.id === sanitized.id ? sanitized : u)));
      if (currentUser.id === sanitized.id) {
        setCurrentUser(sanitized);
      }
      undoManager.register({
        title: `مشخصات کاربری ${sanitized.fullName} ویرایش شد`,
        description: `نقش: ${sanitized.role} · پلتفرم: ${sanitized.assignedPlatform}`,
        undo: () => {
          persistUsers(prevUsers);
        }
      });
      return next;
    },
    [users, currentUser.id, persistUsers]
  );

  const handleDeleteUser = useCallback(
    (userId: string) => {
      if (!verifyManagerDeletion(currentUser, 'حذف حساب پرسنل', userId)) {
        return;
      }
      const target = users.find(u => u.id === userId);
      if (!target || target.role === 'admin') return;

      archiveToTrashVault({
        entityType: 'staff_user',
        entityId: userId,
        title: `حساب کاربری ${target.fullName}`,
        subtitle: `${target.role} · ${target.email || target.username}`,
        payload: target,
        deletedByUser: currentUser
      });

      const prevUsers = users;
      persistUsers(users.filter(u => u.id !== userId));

      undoManager.register({
        title: `حساب کاربری ${target.fullName} بایگانی شد`,
        description: target.email || target.username,
        undo: () => {
          persistUsers(prevUsers);
        }
      });
    },
    [currentUser, users, persistUsers]
  );

  const handleAddPlatform = useCallback(
    (platform: PlatformDevice) => {
      setPlatforms(prev => {
        const next = [...prev, platform];
        try {
          localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  return {
    users,
    setUsers,
    platforms,
    currentUser,
    setCurrentUser,
    isSessionLocked,
    lockSession,
    unlockWithCredentials,
    handleAddNewUser,
    handleEditUser,
    handleDeleteUser,
    handleAddPlatform
  };
}
