import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Patient, Appointment, InventoryItem } from '../types/dental';
import { INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY } from '../data/mockData';
import { indexedDbService } from '../services/indexedDbService';
import { clinicalDb } from '../services/clinicalDatabase';
import { supabaseService } from '../services/supabaseService';
import { clinicRealtimeClient, LiveSyncStatusMeta } from '../services/clinicRealtimeClient';
import { subscribeGoogleDriveAuth } from '../services/googleDriveBackupService';
import { archiveToTrashVault, getTrashVaultItems, hydrateTrashVaultFromDb } from '../utils/dataProtection';
import { buildPatientIndex } from '../utils/patientIndex';
import type { ClinicDataMode } from '../utils/eccSchemas';

const DATA_MODE_STORAGE_KEY = 'minadental_data_mode_v1';
const USERS_STORAGE_KEY = 'minadental_clinic_users_v2';
const TARIFFS_STORAGE_KEY = 'minadental_clinic_tariffs_v1';
const GENERAL_CFG_STORAGE_KEY = 'minadental_clinic_general_cfg_v1';

function readStoredDataMode(): ClinicDataMode {
  try {
    return localStorage.getItem(DATA_MODE_STORAGE_KEY) === 'live_production'
      ? 'live_production'
      : 'demo_seeded';
  } catch {
    return 'demo_seeded';
  }
}

function collectSyncableUsersAndConfig(): {
  users?: Record<string, unknown>[];
  clinicConfig?: Record<string, unknown>;
  deletedPatientIds: string[];
  deletedAppointmentIds: string[];
} {
  let users: Record<string, unknown>[] | undefined;
  const clinicConfig: Record<string, unknown> = {};
  try {
    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        users = parsed;
      }
    }
    const rawTariffs = localStorage.getItem(TARIFFS_STORAGE_KEY);
    if (rawTariffs) {
      clinicConfig.tariffs = JSON.parse(rawTariffs);
    }
    const rawGeneral = localStorage.getItem(GENERAL_CFG_STORAGE_KEY);
    if (rawGeneral) {
      clinicConfig.general = JSON.parse(rawGeneral);
    }
  } catch {
    // ignore malformed local config
  }
  const vault = getTrashVaultItems();
  const deletedPatientIds = vault
    .filter((v) => v.entityType === 'patient')
    .map((v) => v.entityId);
  const deletedAppointmentIds = vault
    .filter((v) => v.entityType === 'appointment')
    .map((v) => v.entityId);

  return {
    users,
    clinicConfig: Object.keys(clinicConfig).length > 0 ? clinicConfig : undefined,
    deletedPatientIds,
    deletedAppointmentIds,
  };
}

function sanitizeMedicalHistoryList(list?: string[]): string[] {
  return (list || []).filter(m => m && !['ندارد (سالم)', 'ندارد', 'سالم'].includes(m.trim()));
}

/**
 * Central Clinic Persistence, Multi-Device Live SSE Sync & O(1) Index Hook
 * Manages zero-data-loss hydration across Express Live Server (SSE) + localStorage + IndexedDB + Supabase,
 * clean production mode (empty demo records), persistent storage permission, and debounced atomic flushes.
 */
export function useClinicPersistence() {
  const [clinicDataMode, setClinicDataMode] = useState<ClinicDataMode>(() => readStoredDataMode());
  const [liveSyncMeta, setLiveSyncMeta] = useState<LiveSyncStatusMeta>(() =>
    clinicRealtimeClient.getStatusMeta()
  );

  const [patients, setPatients] = useState<Patient[]>(() => {
    const mode = readStoredDataMode();
    try {
      const saved = localStorage.getItem('minadental_patients');
      if (saved) {
        const parsed: Patient[] = JSON.parse(saved);
        return parsed.map(p => ({
          ...p,
          medicalHistory: sanitizeMedicalHistoryList(p.medicalHistory)
        }));
      }
    } catch (e) {
      console.error(e);
    }
    return mode === 'live_production' ? [] : INITIAL_PATIENTS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const mode = readStoredDataMode();
    try {
      const saved = localStorage.getItem('minadental_appointments');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return mode === 'live_production' ? [] : INITIAL_APPOINTMENTS;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_inventory');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_INVENTORY;
  });

  // Stable refs for WebSocket/VoIP bridges & loop-free multi-device sync
  const patientsRef = useRef<Patient[]>(patients);
  const appointmentsRef = useRef<Appointment[]>(appointments);
  const inventoryRef = useRef<InventoryItem[]>(inventory);
  const dataModeRef = useRef<ClinicDataMode>(clinicDataMode);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const hasHydratedRef = useRef<boolean>(false);

  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  useEffect(() => {
    dataModeRef.current = clinicDataMode;
    try {
      localStorage.setItem(DATA_MODE_STORAGE_KEY, clinicDataMode);
    } catch {
      // ignore storage quota errors
    }
  }, [clinicDataMode]);

  // O(1) Map-based indexes for instant lookup by ID, file number, or phone
  const patientIndex = useMemo(() => buildPatientIndex(patients), [patients]);

  // Initial zero-data-loss hydration + Authoritative Live Server SSE subscription
  useEffect(() => {
    indexedDbService.requestPersistentStorage().catch(() => {});
    hydrateTrashVaultFromDb().catch(() => {});

    const unsubStatus = clinicRealtimeClient.onStatusChange(setLiveSyncMeta);
    const disconnectStream = clinicRealtimeClient.connectStream();

    const applyRemoteSnapshot = (snapshot: {
      mode: ClinicDataMode;
      patients: Patient[];
      appointments: Appointment[];
      inventory: InventoryItem[];
      users?: Record<string, unknown>[];
      clinicConfig?: Record<string, unknown>;
    }) => {
      isApplyingRemoteRef.current = true;
      const deletedPatientIds = new Set(
        getTrashVaultItems()
          .filter(v => v.entityType === 'patient')
          .map(v => v.entityId)
      );
      const deletedAptIds = new Set(
        getTrashVaultItems()
          .filter(v => v.entityType === 'appointment')
          .map(v => v.entityId)
      );

      setClinicDataMode(snapshot.mode);
      const safePatients = (snapshot.patients || [])
        .filter(p => p && p.id && !deletedPatientIds.has(p.id))
        .map(p => ({
          ...p,
          medicalHistory: sanitizeMedicalHistoryList(p.medicalHistory)
        }));
      const safeAppointments = (snapshot.appointments || []).filter(
        a => a && a.id && !deletedAptIds.has(a.id)
      );

      setPatients(safePatients);
      setAppointments(safeAppointments);
      if (Array.isArray(snapshot.inventory) && snapshot.inventory.length > 0) {
        setInventory(snapshot.inventory);
      }

      try {
        localStorage.setItem(DATA_MODE_STORAGE_KEY, snapshot.mode);
        localStorage.setItem('minadental_data_initialized_v1', '1');
        if (safePatients.length <= 2000) {
          localStorage.setItem('minadental_patients', JSON.stringify(safePatients));
        }
        localStorage.setItem('minadental_appointments', JSON.stringify(safeAppointments));
        if (Array.isArray(snapshot.inventory) && snapshot.inventory.length > 0) {
          localStorage.setItem('minadental_inventory', JSON.stringify(snapshot.inventory));
        }
        if (Array.isArray(snapshot.users) && snapshot.users.length > 0) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(snapshot.users));
          window.dispatchEvent(new CustomEvent('minadental:staff-users-updated'));
        }
        if (snapshot.clinicConfig && typeof snapshot.clinicConfig === 'object') {
          if (snapshot.clinicConfig.tariffs) {
            localStorage.setItem(TARIFFS_STORAGE_KEY, JSON.stringify(snapshot.clinicConfig.tariffs));
          }
          if (snapshot.clinicConfig.general) {
            localStorage.setItem(GENERAL_CFG_STORAGE_KEY, JSON.stringify(snapshot.clinicConfig.general));
          }
          window.dispatchEvent(new CustomEvent('minadental:clinic-config-synced'));
        }
      } catch {
        // ignore quota errors
      }

      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 600);
    };

    const unsubRemote = clinicRealtimeClient.onRemoteSync((snapshot) => {
      applyRemoteSnapshot(snapshot);
    });

    // Fetch server-authoritative state first; if server has initialized data, hydrate immediately
    clinicRealtimeClient
      .fetchAuthoritativeState()
      .then((remote) => {
        if (remote && remote.initialized) {
          applyRemoteSnapshot(remote);
        }
      })
      .finally(() => {
        hasHydratedRef.current = true;
      });

    let lastAuthedUid: string | null = null;
    const unsubCloudAuth = subscribeGoogleDriveAuth((authSnap) => {
      const uid = authSnap.user?.uid ?? null;
      if (!uid || uid === lastAuthedUid) return;
      lastAuthedUid = uid;
      void clinicRealtimeClient.fetchAuthoritativeState().then((remote) => {
        if (remote && remote.initialized) {
          applyRemoteSnapshot(remote);
        } else if (remote && !remote.initialized) {
          void clinicRealtimeClient.pushClinicState({
            patients: patientsRef.current,
            appointments: appointmentsRef.current,
            inventory: inventoryRef.current,
            mode: dataModeRef.current,
            actorName: authSnap.displayName || authSnap.email || 'مدیر کلینیک',
            actorRole: 'admin',
          });
        }
      });
    });

    const isLiveProductionLocal = readStoredDataMode() === 'live_production';

    Promise.all([
      indexedDbService.getAllPatients(),
      clinicalDb.getAllPatients()
    ])
      .then(([idbPatients, clinicalPatients]) => {
        if (dataModeRef.current === 'live_production' || isLiveProductionLocal) {
          // In live_production mode, only hydrate non-empty real records if localStorage is missing
          if (localStorage.getItem('minadental_patients')) return;
        }
        const deletedIds = new Set(
          getTrashVaultItems()
            .filter(v => v.entityType === 'patient')
            .map(v => v.entityId)
        );
        const bestLocal =
          idbPatients && idbPatients.length > 0
            ? idbPatients
            : clinicalPatients && clinicalPatients.length > 0
              ? clinicalPatients
              : null;

        if (bestLocal && bestLocal.length > 0) {
          const filtered = bestLocal.filter(p => p && p.id && !deletedIds.has(p.id));
          if (filtered.length > 0) {
            setPatients(prev => {
              const map = new Map<string, Patient>();
              filtered.forEach(p => map.set(p.id, p));
              if (localStorage.getItem('minadental_patients')) {
                prev.forEach(p => {
                  if (!deletedIds.has(p.id) && !map.has(p.id)) {
                    map.set(p.id, p);
                  }
                });
              }
              return Array.from(map.values());
            });
            try {
              localStorage.setItem('minadental_data_initialized_v1', '1');
            } catch {}
          }
        }
      })
      .catch(() => {});

    indexedDbService
      .getAllAppointments()
      .then(storedApts => {
        if (dataModeRef.current === 'live_production' && localStorage.getItem('minadental_appointments')) {
          return;
        }
        if (storedApts && storedApts.length > 0) {
          const deletedAptIds = new Set(
            getTrashVaultItems()
              .filter(v => v.entityType === 'appointment')
              .map(v => v.entityId)
          );
          setAppointments(storedApts.filter(a => a && a.id && !deletedAptIds.has(a.id)));
        }
      })
      .catch(() => {});

    clinicalDb
      .get<InventoryItem[]>('inventory', 'clinic_inventory_v1')
      .then(storedInv => {
        if (Array.isArray(storedInv) && storedInv.length > 0) {
          setInventory(storedInv);
        }
      })
      .catch(() => {});

    // Hydrate from real Supabase ONLY (never overwrite with mock fallback)
    supabaseService
      .getPatients()
      .then(({ data, source }) => {
        if (source === 'supabase' && data && data.length > 0) {
          const deletedIds = new Set(
            getTrashVaultItems()
              .filter(v => v.entityType === 'patient')
              .map(v => v.entityId)
          );
          setPatients(prev => {
            const merged = new Map<string, Patient>();
            prev.forEach(p => {
              if (!deletedIds.has(p.id)) merged.set(p.id, p);
            });
            data.forEach(remote => {
              if (!deletedIds.has(remote.id)) {
                const existing = merged.get(remote.id);
                merged.set(remote.id, existing ? { ...existing, ...remote } : remote);
              }
            });
            const mergedList = Array.from(merged.values());
            indexedDbService.bulkSavePatients(mergedList).catch(() => {});
            return mergedList;
          });
        }
      })
      .catch(() => {});

    return () => {
      unsubStatus();
      unsubRemote();
      unsubCloudAuth();
      disconnectStream();
    };
  }, []);

  // Debounced multi-layer persistence for patients
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('minadental_data_initialized_v1', '1');
        if (patients.length <= 2000) {
          localStorage.setItem('minadental_patients', JSON.stringify(patients));
        }
      } catch (e) {
        console.warn('LocalStorage quota warning, using IndexedDB:', e);
      }
      clinicalDb.saveAllPatients(patients);
      indexedDbService.bulkSavePatients(patients).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [patients]);

  // Debounced persistence for appointments
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('minadental_appointments', JSON.stringify(appointments));
      } catch (e) {
        console.error(e);
      }
      indexedDbService.bulkSaveAppointments(appointments).catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [appointments]);

  // Debounced persistence for inventory
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('minadental_inventory', JSON.stringify(inventory));
      } catch (e) {
        console.error(e);
      }
      clinicalDb.set('inventory', 'clinic_inventory_v1', inventory).catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [inventory]);

  // Debounced authoritative multi-device push whenever local state changes
  useEffect(() => {
    if (!hasHydratedRef.current || isApplyingRemoteRef.current) return;
    const timer = setTimeout(() => {
      if (isApplyingRemoteRef.current) return;
      const extra = collectSyncableUsersAndConfig();
      void clinicRealtimeClient.pushClinicState({
        patients: patientsRef.current,
        appointments: appointmentsRef.current,
        inventory: inventoryRef.current,
        users: extra.users,
        clinicConfig: extra.clinicConfig,
        deletedPatientIds: extra.deletedPatientIds,
        deletedAppointmentIds: extra.deletedAppointmentIds,
        mode: dataModeRef.current,
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [patients, appointments, inventory, clinicDataMode]);

  // Also trigger live push when Manager updates staff accounts in Settings/RoleSwitcher
  useEffect(() => {
    const handleStaffUpdate = () => {
      if (!hasHydratedRef.current || isApplyingRemoteRef.current) return;
      const extra = collectSyncableUsersAndConfig();
      void clinicRealtimeClient.pushClinicState({
        patients: patientsRef.current,
        appointments: appointmentsRef.current,
        inventory: inventoryRef.current,
        users: extra.users,
        clinicConfig: extra.clinicConfig,
        deletedPatientIds: extra.deletedPatientIds,
        deletedAppointmentIds: extra.deletedAppointmentIds,
        mode: dataModeRef.current,
      });
    };
    window.addEventListener('minadental:staff-users-updated', handleStaffUpdate);
    return () => window.removeEventListener('minadental:staff-users-updated', handleStaffUpdate);
  }, []);

  const triggerLiveServerSync = useCallback(async (actorName?: string, actorRole?: string) => {
    const extra = collectSyncableUsersAndConfig();
    const res = await clinicRealtimeClient.pushClinicState({
      patients: patientsRef.current,
      appointments: appointmentsRef.current,
      inventory: inventoryRef.current,
      users: extra.users,
      clinicConfig: extra.clinicConfig,
      deletedPatientIds: extra.deletedPatientIds,
      deletedAppointmentIds: extra.deletedAppointmentIds,
      mode: dataModeRef.current,
      actorName,
      actorRole,
    });
    return res.ok;
  }, []);

  const activateCleanProductionMode = useCallback(
    async (actorName: string, isManager: boolean): Promise<{ ok: boolean; archivedCount: number; error?: string }> => {
      if (!isManager) {
        return {
          ok: false,
          archivedCount: 0,
          error: 'فقط مدیر کلینیک (دکتر مهدی امیری) مجاز به فعال‌سازی حالت دیتای واقعی است.'
        };
      }

      // Archive existing demo/sample records to Trash Vault for 100% zero-loss safety
      let archivedCount = 0;
      patientsRef.current.forEach((p) => {
        archiveToTrashVault({
          entityType: 'patient',
          entityId: p.id,
          title: p.fullName,
          subtitle: `بایگانی شروع دیتای واقعی مطب توسط ${actorName} · ${p.fileNumber}`,
          payload: p
        });
        archivedCount++;
      });
      appointmentsRef.current.forEach((a) => {
        archiveToTrashVault({
          entityType: 'appointment',
          entityId: a.id,
          title: a.patientName,
          subtitle: `بایگانی نوبت آزمایشی توسط ${actorName} · ${a.date} ${a.time}`,
          payload: a
        });
        archivedCount++;
      });

      isApplyingRemoteRef.current = true;
      setClinicDataMode('live_production');
      setPatients([]);
      setAppointments([]);

      try {
        localStorage.setItem(DATA_MODE_STORAGE_KEY, 'live_production');
        localStorage.setItem('minadental_data_initialized_v1', '1');
        localStorage.setItem('minadental_patients', JSON.stringify([]));
        localStorage.setItem('minadental_appointments', JSON.stringify([]));
      } catch {
        // ignore storage quota errors
      }

      clinicalDb.saveAllPatients([]);
      indexedDbService.bulkSavePatients([]).catch(() => {});
      indexedDbService.bulkSaveAppointments([]).catch(() => {});

      const serverRes = await clinicRealtimeClient.switchClinicMode({
        mode: 'live_production',
        actorName,
        isManager: true,
        inventory: inventoryRef.current,
      });

      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 600);

      return {
        ok: serverRes.ok,
        archivedCount,
        error: serverRes.error
      };
    },
    []
  );

  return {
    patients,
    setPatients,
    patientsRef,
    patientIndex,
    appointments,
    setAppointments,
    inventory,
    setInventory,
    clinicDataMode,
    liveSyncMeta,
    triggerLiveServerSync,
    activateCleanProductionMode
  };
}
