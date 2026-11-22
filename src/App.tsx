import React, { useState, useEffect, Suspense } from 'react';
import { AppHeader } from './components/AppHeader';
import { BottomDock, NavTab } from './components/BottomDock';
import { ServicesSheet } from './components/ServicesSheet';
import { PalmerChartModal } from './components/PalmerChartModal';
import { PatientFileModal } from './components/PatientFileModal';
import { AddCheckModal } from './components/AddCheckModal';
import { AddLabOrderModal } from './components/AddLabOrderModal';
import { AddPaymentModal } from './components/AddPaymentModal';
import { SyncNotificationToast } from './components/SyncNotificationToast';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { BackupModal } from './components/BackupModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TreatmentInvoiceModal } from './components/TreatmentInvoiceModal';
import { DoctorCommissionModal } from './components/DoctorCommissionModal';
import { IncomingCallBanner } from './components/IncomingCallBanner';
import { LabPrescriptionModal } from './components/LabPrescriptionModal';
import { ClinicalHudDrawer } from './components/ClinicalHudDrawer';
import { AccessibilityControlsModal, DisplayTheme, FontScale } from './components/AccessibilityControlsModal';
import { OneHandedActionSheet } from './components/OneHandedActionSheet';
import { GlobalUndoToast } from './components/GlobalUndoToast';
import { ActionVerificationHud } from './components/ActionVerificationHud';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import { ClinicSessionLockOverlay } from './components/ClinicSessionLockOverlay';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { GlobalAuditTrackerModal } from './components/GlobalAuditTrackerModal';
import { LiveSyncSimulatorModal } from './components/LiveSyncSimulatorModal';
import { SupabaseTestModal } from './components/SupabaseTestModal';
import { DigitalLabPortalModal } from './components/DigitalLabPortalModal';
import { PatientBookingPortalModal } from './components/PatientBookingPortalModal';
import { SmsGatewaySettingsModal } from './components/SmsGatewaySettingsModal';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { flushSync } from 'react-dom';
import { undoManager } from './utils/undoManager';
import { actionFeedback } from './utils/actionFeedback';
import { auditTracker, MASTER_SUPER_AUDIT_TRACKING_ID } from './utils/auditTracker';
import { autoSaveManager } from './utils/autoSaveManager';
import { supabaseService } from './services/supabaseService';
import { clinicalDb } from './services/clinicalDatabase';
import { indexedDbService } from './services/indexedDbService';
import { stateSyncQueue } from './utils/syncQueue';
import { triggerHaptic } from './utils/haptics';
import { hardwareBridgeService } from './services/hardwareBridgeService';
import { clinicRealtimeClient } from './services/clinicRealtimeClient';
import { otaUpdateService } from './services/otaUpdateService';
import { useClinicPersistence } from './hooks/useClinicPersistence';
import { useClinicAuth } from './hooks/useClinicAuth';
import { useGoogleDriveAutoBackup } from './hooks/useGoogleDriveAutoBackup';
import { normalizePhoneLast7 } from './utils/patientIndex';
import { useEscapeKey } from './hooks/useDialogA11y';
import { ViewportModalPortal } from './components/ViewportModalPortal';

// Primary Views (Eager)
import { DashboardView } from './components/views/DashboardView';
import { FinancialView, FinancialSegment } from './components/views/FinancialView';
import { AppointmentsView, AppointmentPrefillDraft } from './components/views/AppointmentsView';
import { LabModuleView } from './components/views/LabModuleView';
import { ImplantModuleView } from './components/views/ImplantModuleView';
import { PatientsListView } from './components/views/PatientsListView';
import { TreatmentsView } from './components/views/TreatmentsView';
import { AnimatedGeminiBackground } from './components/AnimatedGeminiBackground';
import { DentalSkeletonLoader } from './components/DentalSkeletonLoader';

// Secondary Views & QA / Diagnostic Modals (Code-Split Lazy Chunks with Automatic Retry)
const AiAssistantView = lazyWithRetry(() => import('./components/views/AiAssistantView').then(m => ({ default: m.AiAssistantView })));
const InventoryView = lazyWithRetry(() => import('./components/views/InventoryView').then(m => ({ default: m.InventoryView })));
const RemindersView = lazyWithRetry(() => import('./components/views/RemindersView').then(m => ({ default: m.RemindersView })));
const SettingsView = lazyWithRetry(() => import('./components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const XRayModuleView = lazyWithRetry(() => import('./components/views/XRayModuleView').then(m => ({ default: m.XRayModuleView })));
const MarketingCampaignsView = lazyWithRetry(() => import('./components/views/MarketingCampaignsView').then(m => ({ default: m.MarketingCampaignsView })));
const SterilizationModuleView = lazyWithRetry(() => import('./components/views/SterilizationModuleView').then(m => ({ default: m.SterilizationModuleView })));
const InsuranceClaimsView = lazyWithRetry(() => import('./components/views/InsuranceClaimsView').then(m => ({ default: m.InsuranceClaimsView })));

const PhaseAuditSuiteModal = lazyWithRetry(() => import('./components/PhaseAuditSuiteModal').then(m => ({ default: m.PhaseAuditSuiteModal })));
const ProjectDownloadModal = lazyWithRetry(() => import('./components/ProjectDownloadModal').then(m => ({ default: m.ProjectDownloadModal })));
const RealWorldClinicTestConsole = lazyWithRetry(() => import('./components/RealWorldClinicTestConsole').then(m => ({ default: m.RealWorldClinicTestConsole })));
const UniversalClinicScannerModal = lazyWithRetry(() => import('./components/UniversalClinicScannerModal').then(m => ({ default: m.UniversalClinicScannerModal })));

// Mock Data, Types & Realtime Engine
import { INITIAL_INVENTORY } from './data/mockData';
import { 
  Patient, Appointment, InventoryItem, SayadCheck, Installment,
  LabOrder, PaymentRecord, ImplantStage, ImplantCase, ToothSurface, 
  TreatmentType, ToothCondition, UserAccount, PlatformDevice, 
  SyncEvent, DentalPrescription, IncomingCallEvent, PatientConsent,
  ReminderConfig
} from './types/dental';
import { syncEngine } from './services/syncEngine';
import { DollarSign, Bell, X } from 'lucide-react';
import { comparePersianDates, formatToman, getCurrentPersianDate, getRelativePersianDate, toEnglishDigits, toPersianDigits } from './utils/jalali';
import { normalizeClinicUnitName } from './utils/appointmentScheduling';
import {
  evaluateAndDispatchDuePhoneNotifications,
  markReminderDone,
  scheduleEntityReminder,
  sendPhoneNotification
} from './services/reminderNotificationService';
import { getLatestFileNumber, getNextFileNumber, recordLastFileNumber } from './utils/fileNumber';
import { inventoryConsumptionService } from './services/inventoryConsumptionService';
import {
  isClinicManager,
  verifyManagerDeletion,
  archiveToTrashVault,
  getTrashVaultItems,
  removeFromTrashVault,
  appendSecurityAuditLog,
  TrashVaultItem
} from './utils/dataProtection';

const LiveChairsideBanner = React.memo(({
  activeChairApt,
  onOpenPalmer,
  onFinishAndPay
}: {
  activeChairApt?: Appointment;
  onOpenPalmer: () => void;
  onFinishAndPay: () => void;
}) => {
  const [elapsed, setElapsed] = useState<number>(845);
  useEffect(() => {
    if (!activeChairApt) return;
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeChairApt?.id]);

  if (!activeChairApt) return null;
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');

  return (
    <div dir="rtl" className="mx-2 mt-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white shadow-md border border-emerald-500/50 flex items-center justify-between gap-2 z-20 will-change-transform">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[#c8ff00] shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-black text-[#c8ff00] shrink-0">{activeChairApt.unit}:</span>
        <span className="text-[11px] font-extrabold text-white truncate">{activeChairApt.patientName}</span>
        <span className="text-[10px] text-emerald-200 truncate hidden xs:inline">({activeChairApt.treatment})</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-[10.5px] font-black bg-black/40 text-[#c8ff00] px-2 py-0.5 rounded-full border border-[#c8ff00]/30">
          {mins}:{secs}
        </span>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onOpenPalmer();
          }}
          className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold cursor-pointer active:scale-95 transition-all"
        >
          پالمر
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('success');
            onFinishAndPay();
          }}
          className="px-2.5 py-0.5 rounded-full bg-[#c8ff00] text-slate-950 text-[10px] font-black cursor-pointer active:scale-95 transition-all"
        >
          اتمام و صندوق
        </button>
      </div>
    </div>
  );
});

export default function App() {
  const {
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
  } = useClinicPersistence();

  const {
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
  } = useClinicAuth();

  const patientIndexRef = React.useRef(patientIndex);
  useEffect(() => {
    patientIndexRef.current = patientIndex;
  }, [patientIndex]);

  // Navigation State (lazily initialized from URL ?view=... so PWA shortcuts & deep-links never flash or reset)
  const resolveInitialViewFromUrl = (): string => {
    if (typeof window === 'undefined') return 'home';
    const raw = new URLSearchParams(window.location.search).get('view');
    if (!raw) return 'home';
    const aliasMap: Record<string, string> = {
      ai: 'ai_assistant',
      insurance: 'insurance_claims',
      xray: 'xrays',
      cssd: 'sterilization',
      messages: 'marketing',
      sms: 'marketing',
      dashboard: 'home'
    };
    const normalized = aliasMap[raw] || raw;
    const validViews = new Set([
      'home', 'patients', 'appointments', 'treatments', 'financial', 'lab', 'implant',
      'ai_assistant', 'inventory', 'reminders', 'xrays',
      'marketing', 'settings', 'sterilization', 'insurance_claims'
    ]);
    return validViews.has(normalized) ? normalized : 'home';
  };
  const [activeView, setActiveView] = useState<string>(resolveInitialViewFromUrl);
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const v = resolveInitialViewFromUrl();
    if (v === 'patients' || v === 'appointments' || v === 'treatments' || v === 'financial') {
      return v;
    }
    return 'home';
  });
  const [appointmentsInitialViewMode, setAppointmentsInitialViewMode] = useState<'board' | 'monthly'>('board');
  const [financialInitialSegment, setFinancialInitialSegment] = useState<FinancialSegment>('debtors');

  // Modals State
  const [servicesMenuOpen, setServicesMenuOpen] = useState(false);
  const [palmerChartOpen, setPalmerChartOpen] = useState(false);
  const [palmerFocusTooth, setPalmerFocusTooth] = useState<{ quadrant: 'UR' | 'UL' | 'LL' | 'LR'; toothNumber: number } | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientFileInitialTab, setPatientFileInitialTab] = useState<'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai'>('treatments');

  const handleOpenPatientFile = (patient: Patient, tab: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai' = 'treatments') => {
    setPatientFileInitialTab(tab);
    setSelectedPatient(patient);
  };
  const [addCheckModalOpen, setAddCheckModalOpen] = useState(false);
  const [checkTargetPatientId, setCheckTargetPatientId] = useState<string | undefined>(undefined);
  const [addLabOrderModalOpen, setAddLabOrderModalOpen] = useState(false);
  const [labTargetPatientId, setLabTargetPatientId] = useState<string | undefined>(undefined);
  const [labPrefillTooth, setLabPrefillTooth] = useState<string | undefined>(undefined);
  const [labPrefillWorkType, setLabPrefillWorkType] = useState<string | undefined>(undefined);
  const [appointmentPrefillDraft, setAppointmentPrefillDraft] = useState<AppointmentPrefillDraft | null>(null);
  const [admissionPrefillPhone, setAdmissionPrefillPhone] = useState<string | null>(null);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [paymentTargetPatientId, setPaymentTargetPatientId] = useState<string | undefined>(undefined);

  const [clinicalChainPromptApt, setClinicalChainPromptApt] = useState<Appointment | null>(null);
  const [quickRegName, setQuickRegName] = useState<string>('');
  const [quickRegPhone, setQuickRegPhone] = useState<string>('');
  const [labArrivalPrompt, setLabArrivalPrompt] = useState<{ patient: Patient; order: LabOrder } | null>(null);

  useEscapeKey(Boolean(clinicalChainPromptApt), () => setClinicalChainPromptApt(null));
  useEscapeKey(Boolean(labArrivalPrompt), () => setLabArrivalPrompt(null));

  const latestClinicalDataRef = React.useRef({ patients, appointments, inventory });
  latestClinicalDataRef.current = { patients, appointments, inventory };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const runDueCheck = () => {
      void evaluateAndDispatchDuePhoneNotifications(latestClinicalDataRef.current);
    };
    const initialTimer = window.setTimeout(runDueCheck, 1500);
    const interval = window.setInterval(runDueCheck, 30000);

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg && msg.type === 'NOTIFICATION_NAVIGATE') {
        handleServicesNavigate(msg.view || 'reminders');
        if (msg.patientId) {
          const matched = patientsRef.current.find(p => p.id === msg.patientId);
          if (matched) {
            handleOpenPatientFile(matched);
          }
        }
      }
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      if ('serviceWorker' in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const scheduleAppointmentFromModule = (draft: AppointmentPrefillDraft) => {
    setAppointmentPrefillDraft(draft);
    setActiveView('appointments');
    setActiveTab('appointments');
  };
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicePatient, setInvoicePatient] = useState<Patient | null>(null);
  
  // Multi-User & Real-time Sync Modals
  const [liveSyncModalOpen, setLiveSyncModalOpen] = useState(false);
  const [roleSwitcherModalOpen, setRoleSwitcherModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [supabaseTestModalOpen, setSupabaseTestModalOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  
  // Doctor Commission and Caller ID State
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
  const [callSimulationToggle, setCallSimulationToggle] = useState(false);
  const [labSlipOrder, setLabSlipOrder] = useState<LabOrder | null>(null);

  // Global Deficiencies Features: Lab Portal, Booking Portal, SMS Gateway
  const [digitalLabModalOpen, setDigitalLabModalOpen] = useState(false);
  const [bookingPortalModalOpen, setBookingPortalModalOpen] = useState(false);
  const [smsGatewayModalOpen, setSmsGatewayModalOpen] = useState(false);

  // Clinical HUD, Accessibility, Global Command Palette & One-Handed Thumb Zone State
  const [clinicalHudOpen, setClinicalHudOpen] = useState(false);
  const [accessibilityModalOpen, setAccessibilityModalOpen] = useState(false);
  const [thumbZoneOpen, setThumbZoneOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [phaseAuditModalOpen, setPhaseAuditModalOpen] = useState(false);
  const [phaseAuditInitialTab, setPhaseAuditInitialTab] = useState<'tests' | 'live_stress_loop' | 'real_world_audit' | 'standards_matrix' | 'audit_report_table' | 'certificate'>('real_world_audit');
  const [realClinicTestModalOpen, setRealClinicTestModalOpen] = useState(false);
  const [projectDownloadModalOpen, setProjectDownloadModalOpen] = useState(false);
  const [universalScannerOpen, setUniversalScannerOpen] = useState(false);
  const [universalScannerScope, setUniversalScannerScope] = useState<'all' | 'inventory' | 'lab' | 'patient' | 'sterilization' | 'sayad_check'>('all');
  const [scannedSayadDraft, setScannedSayadDraft] = useState<{ sayadId?: string; bankName?: string } | null>(null);

  useGoogleDriveAutoBackup({
    clinicName: 'مرکز تخصصی دندانپزشکی مینادنتال',
    patients,
    appointments,
    inventory,
    users,
    platforms,
    onAutoBackupSaved: (fileName) => {
      actionFeedback.recordSuccess({
        title: 'بک‌آپ خودکار گوگل درایو ثبت شد',
        subtitle: fileName,
        badgeText: '✓ Google Drive',
      });
    },
  });

  const handleApplyRealTestData = (data: {
    patient: Patient;
    appointment: Appointment;
    deductedInventory: InventoryItem[];
  }) => {
    setPatients(prev => {
      const nextPatients = [data.patient, ...prev.filter(p => p.id !== data.patient.id)];
      try {
        localStorage.setItem('minadental_patients', JSON.stringify(nextPatients));
        indexedDbService.savePatient(data.patient);
      } catch (e) {
        console.warn('Patient storage save error:', e);
      }
      return nextPatients;
    });
    setSelectedPatient(data.patient);
    setAppointments(prev => {
      const nextAppointments = [data.appointment, ...prev.filter(a => a.id !== data.appointment.id)];
      try {
        localStorage.setItem('minadental_appointments', JSON.stringify(nextAppointments));
        indexedDbService.saveAppointment(data.appointment);
      } catch (e) {
        console.warn('Appointment storage save error:', e);
      }
      return nextAppointments;
    });
    setInventory(data.deductedInventory);
    try {
      localStorage.setItem('minadental_inventory', JSON.stringify(data.deductedInventory));
    } catch (e) {
      console.warn('Inventory storage save error:', e);
    }
  };

  const handleResetRealTestData = () => {
    if (!verifyManagerDeletion(currentUser, 'بازنشانی و پاکسازی داده‌های آزمایشی', 'reset-test-data')) {
      return;
    }
    setPatients(prev => {
      const nextPatients = prev.filter(p => !p.id.startsWith('pat-real-test-') && !p.id.startsWith('MD-PAT-'));
      try {
        localStorage.setItem('minadental_patients', JSON.stringify(nextPatients));
        indexedDbService.bulkSavePatients(nextPatients);
      } catch (e) {
        console.warn('Patient storage reset error:', e);
      }
      return nextPatients;
    });
    setAppointments(prev => {
      const nextAppointments = prev.filter(a => !a.id.startsWith('app-real-test-') && !a.id.startsWith('MD-APT-'));
      try {
        localStorage.setItem('minadental_appointments', JSON.stringify(nextAppointments));
      } catch (e) {
        console.warn('Appointment storage reset error:', e);
      }
      return nextAppointments;
    });
    setInventory(INITIAL_INVENTORY);
    try {
      localStorage.setItem('minadental_inventory', JSON.stringify(INITIAL_INVENTORY));
    } catch (e) {
      console.warn('Storage reset error:', e);
    }
  };

  // Live Multi-Device VoIP / Caller-ID SSE Subscription (auto-opens IncomingCallBanner on all clinic devices)
  useEffect(() => {
    return clinicRealtimeClient.onIncomingCall((call) => {
      const last7 = normalizePhoneLast7(call.phoneNumber);
      const localMatch =
        (last7.length >= 7
          ? patientsRef.current.find((p) => normalizePhoneLast7(p.phone) === last7)
          : undefined) ||
        call.matchedPatient ||
        null;
      setIncomingCall({
        id: call.id || `call_${Date.now()}`,
        phoneNumber: call.phoneNumber,
        timestamp: call.timestamp || 'همین الان',
        matchedPatient: localMatch,
      });
    });
  }, [patientsRef]);

  const handleSimulateIncomingCall = (forceUnknown?: boolean) => {
    const shouldBeExisting = forceUnknown === false || (forceUnknown === undefined && !callSimulationToggle);
    setCallSimulationToggle(prev => !prev);

    if (shouldBeExisting && patients.length > 0) {
      const target = patients[0];
      setIncomingCall({
        id: `call_${Date.now()}`,
        phoneNumber: target.phone,
        timestamp: 'همین الان',
        matchedPatient: target
      });
      void clinicRealtimeClient.broadcastIncomingCall(target.phone, 'تست کالرآیدی پذیرش');
    } else {
      setIncomingCall({
        id: `call_${Date.now()}`,
        phoneNumber: '۰۹۱۲۹۸۷۶۵۴۳',
        timestamp: 'همین الان',
        matchedPatient: null
      });
      void clinicRealtimeClient.broadcastIncomingCall('09129876543', 'تست کالرآیدی پذیرش');
    }
  };

  // Sync notification toast
  const [activeSyncEvent, setActiveSyncEvent] = useState<SyncEvent | null>(null);

  // Formal State Syncing Message Queue Epoch for immediate DOM refresh
  const [syncEpoch, setSyncEpoch] = useState<number>(0);

  // Doctor treatment alert for secretary
  const [doctorBillingAlert, setDoctorBillingAlert] = useState<{
    patientName: string;
    patientId: string;
    amount: number;
    treatment: string;
  } | null>(null);

  // Real-time Sync Message Queue, OTA Check & VoIP Hardware Bridge
  useEffect(() => {
    otaUpdateService.checkForUpdates();

    // 1. Formal state-syncing message queue subscriber with atomic UI updates across all active dashboard views
    const unsubscribeQueue = stateSyncQueue.subscribe((msg) => {
      const runImmediateRefresh = (fn: () => void) => {
        try {
          flushSync(fn);
        } catch {
          fn();
        }
      };

      runImmediateRefresh(() => {
        if (msg.table === 'patients') {
          if (msg.eventType === 'DELETE' && msg.record?.id) {
            // Only remove from live state if explicitly archived in Manager Trash Vault or triggered by local Manager
            const isArchivedInVault = getTrashVaultItems().some(
              v => v.entityType === 'patient' && v.entityId === msg.record.id
            );
            if (msg.source === 'local' || isArchivedInVault) {
              setPatients(prev => prev.filter(p => p.id !== msg.record.id));
              setSelectedPatient(prev => (prev?.id === msg.record.id ? null : prev));
            }
          } else if (msg.record && msg.record.id) {
            const record = msg.record as Patient;
            setPatients(prev => {
              const existingIdx = prev.findIndex(p => p.id === record.id);
              const oldPatient = existingIdx >= 0 ? prev[existingIdx] : null;

              // Detect if doctor registered or modified a treatment on this patient
              const isTreatmentAddedOrUpdated = oldPatient && (
                (record.activeTreatmentsCount || 0) > (oldPatient.activeTreatmentsCount || 0) ||
                (record.totalCost || 0) > (oldPatient.totalCost || 0) ||
                Object.keys(record.teethConditions || {}).length > Object.keys(oldPatient.teethConditions || {}).length
              );

              // Instantly trigger Secretary billing alert when doctor registers a treatment
              if (isTreatmentAddedOrUpdated || msg.source === 'local') {
                const costDiff = (record.totalCost || 0) - (oldPatient?.totalCost || 0);
                const billingCost = costDiff > 0 ? costDiff : (record.totalCost || 2500000);

                const toothEntries = Object.entries(record.teethConditions || {});
                const lastTooth = toothEntries.length > 0 ? toothEntries[toothEntries.length - 1][1] : null;
                const treatmentTitle = lastTooth?.treatment || record.notes || 'درمان در یونیت دندانپزشکی';

                // Instant Bouncing Alert Banner for Secretary Reception Desk
                setDoctorBillingAlert({
                  patientName: record.fullName || 'بیمار',
                  patientId: record.id,
                  amount: billingCost,
                  treatment: treatmentTitle
                });

                triggerHaptic('success');

                setActiveSyncEvent({
                  id: `sync-${Date.now()}`,
                  type: 'TREATMENT_REGISTERED',
                  timestamp: new Date().toLocaleTimeString('fa-IR'),
                  performedBy: record.teethConditions && Object.values(record.teethConditions)[0]?.doctorName || 'پزشک یونیت',
                  role: 'doctor',
                  platform: 'یونیت دندانپزشکی',
                  title: `درمان جدید برای ${record.fullName} ثبت شد`,
                  description: `مبلغ ${formatToman(billingCost)} به پرونده افزوده شد. آماده صدور فیش صندوق منشی.`,
                  actionRequired: 'منشی می‌تواند فوراً فیش صادر و تسویه کند',
                  payload: {
                    patientId: record.id,
                    patientName: record.fullName,
                    cost: billingCost,
                    treatment: treatmentTitle
                  }
                });
              }

              if (existingIdx >= 0) {
                const copy = [...prev];
                copy[existingIdx] = { ...copy[existingIdx], ...record };
                return copy;
              }
              return [record, ...prev];
            });

            setSelectedPatient(prev => (prev?.id === record.id ? { ...prev, ...record } : prev));
            indexedDbService.savePatient(record);
          }
        } else if (msg.table === 'appointments') {
          if (msg.eventType === 'DELETE' && msg.record?.id) {
            setAppointments(prev => prev.filter(a => a.id !== msg.record.id));
          } else if (msg.record && msg.record.id) {
            const record = msg.record as Appointment;
            setAppointments(prev => {
              const idx = prev.findIndex(a => a.id === record.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...record };
                return copy;
              }
              return [record, ...prev];
            });
            indexedDbService.saveAppointment(record);
          }
        } else if (msg.table === 'inventory') {
          if (msg.eventType === 'DELETE' && msg.record?.id) {
            setInventory(prev => prev.filter(i => i.id !== msg.record.id));
          } else if (msg.record && msg.record.id) {
            const record = msg.record as InventoryItem;
            setInventory(prev => {
              const idx = prev.findIndex(i => i.id === record.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...record };
                return copy;
              }
              return [record, ...prev];
            });
          }
        } else if (['sayad_checks', 'installments', 'lab_orders', 'implant_cases', 'payments'].includes(msg.table)) {
          const patientId = msg.record?.patientId || msg.record?.patient_id;
          if (patientId) {
            setPatients(prev => prev.map(p => {
              if (p.id !== patientId) return p;
              const copy = { ...p };
              if (msg.table === 'sayad_checks') {
                const checks = copy.sayadChecks || [];
                const idx = checks.findIndex(c => c.id === msg.record.id);
                copy.sayadChecks = idx >= 0 ? checks.map(c => c.id === msg.record.id ? { ...c, ...msg.record } : c) : [msg.record, ...checks];
              } else if (msg.table === 'installments') {
                const insts = copy.installments || [];
                const idx = insts.findIndex(i => i.id === msg.record.id);
                copy.installments = idx >= 0 ? insts.map(i => i.id === msg.record.id ? { ...i, ...msg.record } : i) : [msg.record, ...insts];
              } else if (msg.table === 'lab_orders') {
                const orders = copy.labOrders || [];
                const idx = orders.findIndex(o => o.id === msg.record.id);
                copy.labOrders = idx >= 0 ? orders.map(o => o.id === msg.record.id ? { ...o, ...msg.record } : o) : [msg.record, ...orders];
              } else if (msg.table === 'implant_cases') {
                const cases = copy.implantCases || [];
                const idx = cases.findIndex(c => c.id === msg.record.id);
                copy.implantCases = idx >= 0 ? cases.map(c => c.id === msg.record.id ? { ...c, ...msg.record } : c) : [msg.record, ...cases];
              } else if (msg.table === 'payments') {
                const payments = copy.payments || [];
                const idx = payments.findIndex(pm => pm.id === msg.record.id);
                copy.payments = idx >= 0 ? payments.map(pm => pm.id === msg.record.id ? { ...pm, ...msg.record } : pm) : [msg.record, ...payments];
              }
              return copy;
            }));
          }
        }

        // Force instant atomic UI refresh epoch across all dashboard views
        setSyncEpoch(e => e + 1);

        // Dispatch window event so embedded chart/calendar widgets update immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('minadental:state-synchronized', {
            detail: { table: msg.table, eventType: msg.eventType }
          }));
        }
      });
    });

    // 3. Supabase Realtime channel manager with automatic reconnection retries
    let realtimeUnsub: (() => void) | null = null;

    const setupSupabaseRealtime = () => {
      if (realtimeUnsub) {
        realtimeUnsub();
        realtimeUnsub = null;
      }

      realtimeUnsub = supabaseService.subscribeToChanges(
        (table, eventType, record) => {
          stateSyncQueue.enqueue(table, eventType, record, 'supabase');
          syncEngine.broadcast({
            type: 'CLOUD_BACKUP_SAVED',
            performedBy: 'Supabase Realtime',
            role: 'admin',
            platform: 'Cloud Database',
            title: `به‌روزرسانی همزمان جدول ${table}`,
            description: `تغییر ${eventType} در سرور ابری اعمال و به صورت بلادرنگ در سیستم اعمال گردید.`
          });
        },
        (status, err) => {
          if (status === 'SUBSCRIBED') {
            stateSyncQueue.setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            stateSyncQueue.reportDisconnection(`Channel ${status}: ${err?.message || ''}`);
          }
        }
      );
    };

    // Register Reconnection Handler with stateSyncQueue + Flush Offline Outbox
    stateSyncQueue.registerReconnectHandler(async () => {
      setupSupabaseRealtime();
      await syncEngine.flushOfflineOutbox(supabaseService).catch(() => {});
      // Re-hydrate any missed delta during disconnect (only from real Supabase source)
      try {
        const { data, source } = await supabaseService.getPatients();
        if (source === 'supabase' && data && data.length > 0) {
          const deletedIds = new Set(
            getTrashVaultItems()
              .filter(v => v.entityType === 'patient')
              .map(v => v.entityId)
          );
          runImmediateRefreshWrapper(() => {
            setPatients(prev => {
              const map = new Map<string, Patient>();
              prev.forEach(p => { if (!deletedIds.has(p.id)) map.set(p.id, p); });
              data.forEach(r => { if (!deletedIds.has(r.id)) map.set(r.id, { ...map.get(r.id), ...r }); });
              return Array.from(map.values());
            });
            setSyncEpoch(e => e + 1);
          });
        }
      } catch (e) {
        console.warn('Re-hydration after reconnect warning:', e);
      }
      return true;
    });

    // Initial subscription setup & flush any residual offline outbox if online
    setupSupabaseRealtime();
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      syncEngine.flushOfflineOutbox(supabaseService).catch(() => {});
    }

    const runImmediateRefreshWrapper = (fn: () => void) => {
      try {
        flushSync(fn);
      } catch {
        fn();
      }
    };

    // 4. Local mesh sync listener
    const unsubscribeMesh = syncEngine.onSyncEvent((event) => {
      setActiveSyncEvent(event);
      setTimeout(() => {
        setActiveSyncEvent((current) => (current?.id === event.id ? null : current));
      }, 5000);

      // If doctor registered a treatment, trigger instant billing notice for secretary
      if (event.type === 'TREATMENT_REGISTERED' && event.payload) {
        setDoctorBillingAlert({
          patientName: event.payload.patientName || 'بیمار',
          patientId: event.payload.patientId || 'pat-1',
          amount: event.payload.cost || 6500000,
          treatment: event.payload.treatment || 'درمان در یونیت'
        });
      }

      if (event.type === 'PAYMENT_COLLECTED') {
        setDoctorBillingAlert(null);
      }
    });

    // 5. O(1) Hardware Caller-ID listener from USB modem / VoIP
    const unsubscribeHardwareCall = hardwareBridgeService.onIncomingCall((event) => {
      const last7 = normalizePhoneLast7(event.phoneNumber);
      const match =
        (last7.length === 7 ? patientIndexRef.current.byPhoneLast7.get(last7) : undefined) ||
        patientsRef.current.find(p => normalizePhoneLast7(p.phone) === last7) ||
        null;

      setIncomingCall({
        id: `call_${Date.now()}`,
        phoneNumber: event.phoneNumber,
        timestamp: event.dateTime || 'همین الان',
        matchedPatient: match
      });
    });

    return () => {
      if (realtimeUnsub) realtimeUnsub();
      unsubscribeMesh();
      unsubscribeQueue();
      unsubscribeHardwareCall();
    };
  }, []);

  // Initialize Accessibility, Theme Modes, PWA Shortcut Deep-Linking (?view=...) & Global Shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('minadental_theme');
      if (savedTheme === 'dark') document.documentElement.classList.add('theme-dark');
      if (savedTheme === 'high-contrast') document.documentElement.classList.add('theme-high-contrast');

      document.documentElement.classList.remove('font-scale-large', 'font-scale-xlarge', 'glove-mode');
      localStorage.removeItem('minadental_font_scale');
      localStorage.removeItem('minadental_glove_mode');

      const normalizeRouteAlias = (raw: string): string => {
        const map: Record<string, string> = {
          ai: 'ai_assistant',
          insurance: 'insurance_claims',
          xray: 'xrays',
          cssd: 'sterilization',
          messages: 'marketing',
          sms: 'marketing',
          dashboard: 'home'
        };
        return map[raw] || raw;
      };

      const applyViewFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const rawRequestedView = params.get('view');
        const requestedView = rawRequestedView ? normalizeRouteAlias(rawRequestedView) : null;
        if (!requestedView || requestedView === 'home') {
          setActiveView('home');
          setActiveTab('home');
          return;
        }
        if (requestedView === 'palmer') {
          setPalmerChartOpen(true);
          return;
        }
        const validViews = new Set([
          'patients', 'appointments', 'treatments', 'financial', 'lab', 'implant',
          'ai_assistant', 'inventory', 'reminders', 'xrays',
          'marketing', 'settings', 'sterilization', 'insurance_claims'
        ]);
        if (validViews.has(requestedView)) {
          setActiveView(requestedView);
          if (requestedView === 'patients' || requestedView === 'appointments' || requestedView === 'treatments' || requestedView === 'financial') {
            setActiveTab(requestedView);
          }
        }
      };

      applyViewFromUrl();

      const handlePopState = () => {
        applyViewFromUrl();
      };

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setCommandPaletteOpen(prev => !prev);
          return;
        }
        // RTL WAI-ARIA Tablist Arrow-Key Navigation across all horizontal module chip bars
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }
        if (
          target &&
          typeof target.getAttribute === 'function' &&
          target.getAttribute('role') === 'tab' &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')
        ) {
          const tablist = target.closest('[role="tablist"]');
          if (tablist) {
            const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
            const currentIdx = tabs.indexOf(target);
            if (currentIdx !== -1 && tabs.length > 1) {
              e.preventDefault();
              let nextIdx = currentIdx;
              if (e.key === 'ArrowLeft') {
                // In RTL, ArrowLeft moves to the next tab in reading order
                nextIdx = (currentIdx + 1) % tabs.length;
              } else if (e.key === 'ArrowRight') {
                nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
              } else if (e.key === 'Home') {
                nextIdx = 0;
              } else if (e.key === 'End') {
                nextIdx = tabs.length - 1;
              }
              const nextTab = tabs[nextIdx];
              if (nextTab) {
                nextTab.focus();
                nextTab.click();
                try {
                  nextTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                } catch {
                  // Ignore in non-scrolling environments
                }
              }
            }
          }
        }
      };

      const handleGlobalTabClick = (e: MouseEvent) => {
        const rawTarget = e.target as HTMLElement | null;
        if (
          rawTarget &&
          (rawTarget.tagName === 'INPUT' ||
            rawTarget.tagName === 'TEXTAREA' ||
            rawTarget.tagName === 'SELECT' ||
            rawTarget.isContentEditable ||
            rawTarget.closest('input, textarea, select, [contenteditable="true"]'))
        ) {
          return;
        }
        const target = rawTarget?.closest?.('[role="tab"]') as HTMLElement | null;
        if (target && target.closest('[role="tablist"]')) {
          try {
            target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          } catch {
            // Ignore scrollIntoView errors
          }
        }
      };

      // Mobile & Tablet Keyboard Stabilization: ensure optimal inputMode, pointer-events, and focus stability
      const handleGlobalInputFocus = (e: FocusEvent) => {
        const el = e.target as HTMLElement | null;
        if (!el) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
          inputEl.style.userSelect = 'text';
          inputEl.style.webkitUserSelect = 'text';
          inputEl.style.pointerEvents = 'auto';
          if (!inputEl.getAttribute('inputmode')) {
            const typeAttr = (inputEl.getAttribute('type') || 'text').toLowerCase();
            const labelHint = `${inputEl.getAttribute('placeholder') || ''} ${inputEl.getAttribute('aria-label') || ''}`;
            if (typeAttr === 'tel' || /موبایل|تلفن|تماس|09|۰۹/.test(labelHint)) {
              inputEl.setAttribute('inputmode', 'tel');
            } else if (typeAttr === 'number' || /مبلغ|قیمت|هزینه|کد ملی|صیادی|تعداد|شماره/.test(labelHint)) {
              inputEl.setAttribute('inputmode', 'numeric');
            } else if (typeAttr === 'search' || /جستجو/.test(labelHint)) {
              inputEl.setAttribute('inputmode', 'search');
            } else {
              inputEl.setAttribute('inputmode', 'text');
            }
          }
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown);
      window.addEventListener('click', handleGlobalTabClick);
      window.addEventListener('focusin', handleGlobalInputFocus);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
        window.removeEventListener('click', handleGlobalTabClick);
        window.removeEventListener('focusin', handleGlobalInputFocus);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, []);

  // Synchronize Document Title, Browser URL Query (?view=...) & Mobile Status-Bar Theme-Color per Module
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const moduleMetaMap: Record<string, { title: string; color: string }> = {
      home: { title: 'مینادنتال - سیستم مدیریت یکپارچه دندانپزشکی', color: '#8b5cf6' },
      patients: { title: 'مینادنتال — پرونده بیماران و پذیرش', color: '#0ea5e9' },
      treatments: { title: 'مینادنتال — مرکز هوشمند درمان و طرح درمان', color: '#0d9488' },
      appointments: { title: 'مینادنتال — نوبت‌دهی و تقویم جلالی', color: '#6366f1' },
      financial: { title: 'مینادنتال — مدیریت مالی، چک صیادی و اقساط', color: '#10b981' },
      lab: { title: 'مینادنتال — مدیریت لابراتوار پروتز و الاینر', color: '#ec4899' },
      implant: { title: 'مینادنتال — جراحی و مراحل کاشت ایمپلنت', color: '#a855f7' },
      inventory: { title: 'مینادنتال — انبارداری هوشمند و مواد مصرفی', color: '#f59e0b' },
      reminders: { title: 'مینادنتال — یادآوری هوشمند و پیامک خدماتی', color: '#14b8a6' },
      xrays: { title: 'مینادنتال — رادیولوژی دیجیتال و OPG/RVG', color: '#06b6d4' },
      marketing: { title: 'مینادنتال — کمپین‌های تبلیغاتی و باشگاه بیماران', color: '#f43f5e' },
      sterilization: { title: 'مینادنتال — کنترل عفونت و لاگ اتوکلاو (CSSD)', color: '#0d9488' },
      insurance_claims: { title: 'مینادنتال — نسخه‌نویسی و مطالبات بیمه', color: '#3b82f6' },
      ai_assistant: { title: 'مینادنتال — دستیار هوشمند بالینی', color: '#7c3aed' },
      settings: { title: 'مینادنتال — تنظیمات کلینیک، تعرفه‌ها و پرسنل', color: '#475569' }
    };
    const meta = moduleMetaMap[activeView] || moduleMetaMap.home;
    document.title = meta.title;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', meta.color);
    }
    try {
      const url = new URL(window.location.href);
      if (activeView === 'home') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', activeView);
      }
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.pushState({ view: activeView }, '', nextUrl);
      }
    } catch {
      // Ignore history API restrictions in sandboxed environments
    }
  }, [activeView]);

  // Daily Clinic Statistics (Live-computed from real patients & appointments data)
  const todayPersian = getCurrentPersianDate();
  const todayAppointmentsCount = appointments.filter(a => {
    if (!a.date) return false;
    return a.date === todayPersian || toEnglishDigits(a.date) === toEnglishDigits(todayPersian);
  }).length;
  const activeSurgeriesCount = patients
    .flatMap(p => p.implantCases || [])
    .filter(c => c.currentStage !== 'crown_delivered').length;
  const readyLabOrdersCount = patients.flatMap(p => p.labOrders || []).filter(l => l.status === 'ready_for_clinic').length;
  const dailyRevenue = patients
    .flatMap(p => p.payments || [])
    .reduce((sum, pay) => sum + (pay.amount || 0), 0);

  // Handlers
  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'home') setActiveView('home');
    if (tab === 'patients') setActiveView('patients');
    if (tab === 'treatments') setActiveView('treatments');
    if (tab === 'financial') {
      setFinancialInitialSegment('debtors');
      setActiveView('financial');
    }
    if (tab === 'appointments') {
      setAppointmentsInitialViewMode('board');
      setActiveView('appointments');
    }
  };

  const handleServicesNavigate = (rawViewId: string) => {
    const aliasMap: Record<string, string> = {
      ai: 'ai_assistant',
      insurance: 'insurance_claims',
      xray: 'xrays',
      cssd: 'sterilization',
      messages: 'marketing',
      sms: 'marketing',
      dashboard: 'home'
    };
    const viewId = aliasMap[rawViewId] || rawViewId;
    if (viewId === 'calendar' || viewId === 'iranian_calendar') {
      setAppointmentsInitialViewMode('monthly');
      setActiveView('appointments');
      setActiveTab('appointments');
    } else if (viewId === 'palmer') {
      setPalmerFocusTooth(null);
      setPalmerChartOpen(true);
      return;
    } else if (viewId === 'treatment_plans' || viewId === 'treatments') {
      setActiveView('treatments');
      setActiveTab('treatments');
    } else if (viewId === 'doctor_commissions') {
      setCommissionModalOpen(true);
      return;
    } else if (viewId === 'incoming_call_test') {
      handleSimulateIncomingCall();
      return;
    } else if (viewId === 'digital_lab') {
      setDigitalLabModalOpen(true);
      return;
    } else if (viewId === 'online_booking') {
      setBookingPortalModalOpen(true);
      return;
    } else if (viewId === 'sms_gateway') {
      setSmsGatewayModalOpen(true);
      return;
    } else if (viewId === 'real_world_test' || viewId === 'real_clinic_test') {
      setRealClinicTestModalOpen(true);
      return;
    } else if (viewId === 'audit_tracker') {
      auditTracker.openTrackerModal(MASTER_SUPER_AUDIT_TRACKING_ID);
      return;
    } else if (viewId === 'audit_suite' || viewId === 'phase_audit') {
      setPhaseAuditModalOpen(true);
      return;
    } else if (viewId === 'live_sync' || viewId === 'live_sync_simulator') {
      setLiveSyncModalOpen(true);
      return;
    } else if (viewId === 'supabase_test' || viewId === 'cloud_db_test') {
      setSupabaseTestModalOpen(true);
      return;
    } else if (viewId === 'project_download') {
      setProjectDownloadModalOpen(true);
      return;
    } else if (['sayad_checks', 'installments', 'pos_payments', 'reports', 'guarantee_checks', 'debtors'].includes(viewId)) {
      const segmentMap: Record<string, FinancialSegment> = {
        sayad_checks: 'sayad',
        installments: 'installments',
        guarantee_checks: 'guarantee',
        debtors: 'debtors',
        pos_payments: 'receipts',
        reports: 'reports'
      };
      setFinancialInitialSegment(segmentMap[viewId] || 'debtors');
      setActiveView('financial');
      setActiveTab('financial');
    } else if (viewId === 'quick_admission') {
      setActiveView('patients');
      setActiveTab('patients');
    } else {
      const supportedViews = new Set([
        'home', 'patients', 'appointments', 'treatments', 'financial', 'lab', 'implant',
        'ai_assistant', 'inventory', 'reminders', 'xrays',
        'marketing', 'settings', 'sterilization', 'insurance_claims'
      ]);
      const safeView = supportedViews.has(viewId) ? viewId : 'home';
      if (safeView === 'financial') {
        setFinancialInitialSegment('debtors');
      }
      if (safeView === 'appointments') {
        setAppointmentsInitialViewMode('board');
      }
      setActiveView(safeView);
      if (['patients', 'appointments', 'treatments', 'financial'].includes(safeView)) {
        setActiveTab(safeView as NavTab);
      } else {
        setActiveTab('home');
      }
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Add Treatment from Palmer Chart (Broadcast to secretary instantly!)
  const handleSaveTreatment = (treatmentData: {
    patientId?: string;
    quadrant: 'UR' | 'UL' | 'LL' | 'LR';
    toothNumber: number;
    surfaces: ToothSurface[];
    treatment: TreatmentType;
    status?: ToothCondition['status'];
    cost: number;
    baseCost?: number;
    discountPercent?: number;
    notes: string;
    annotations?: string;
    doctorName?: string;
    surgicalNotes?: string;
    endoMetrics?: ToothCondition['endoMetrics'];
    perioMetrics?: ToothCondition['perioMetrics'];
    vitalityMetrics?: ToothCondition['vitalityMetrics'];
    reminderConfig?: ReminderConfig;
  }) => {
    const targetPatient =
      (treatmentData.patientId ? patients.find(p => p.id === treatmentData.patientId) : undefined) ||
      selectedPatient ||
      patients[0];
    if (!targetPatient) return;

    const toothKey = `${treatmentData.quadrant}_${treatmentData.toothNumber}`;
    const legacyDashKey = `${treatmentData.quadrant}-${treatmentData.toothNumber}`;
    const legacyBareKey = `${treatmentData.quadrant}${treatmentData.toothNumber}`;
    const previousToothCondition =
      targetPatient.teethConditions?.[toothKey] ||
      targetPatient.teethConditions?.[legacyDashKey] ||
      targetPatient.teethConditions?.[legacyBareKey];
    const previousCost = previousToothCondition?.cost || 0;
    const costDelta = treatmentData.cost - previousCost;

    const priorHistory = previousToothCondition?.history || [];
    const archivedPreviousEntry = previousToothCondition
      ? [
          {
            treatment: previousToothCondition.treatment,
            status: previousToothCondition.status,
            date: previousToothCondition.date || getCurrentPersianDate(),
            cost: previousToothCondition.cost || 0,
            doctorName: previousToothCondition.doctorName,
            notes: previousToothCondition.notes,
            surfaces: previousToothCondition.surfaces
          }
        ]
      : [];
    const mergedHistory = [...archivedPreviousEntry, ...priorHistory].slice(0, 10);

    const newCondition: ToothCondition = {
      quadrant: treatmentData.quadrant,
      toothNumber: treatmentData.toothNumber,
      surfaces: treatmentData.surfaces,
      treatment: treatmentData.treatment,
      status: treatmentData.status || 'in_progress',
      notes: treatmentData.notes,
      cost: treatmentData.cost,
      baseCost: treatmentData.baseCost,
      discountPercent: treatmentData.discountPercent,
      doctorName: treatmentData.doctorName || currentUser?.fullName || 'دکتر مهدی امیری',
      date: getCurrentPersianDate(),
      annotations: treatmentData.annotations,
      surgicalNotes: treatmentData.surgicalNotes,
      history: mergedHistory.length > 0 ? mergedHistory : undefined,
      endoMetrics: treatmentData.endoMetrics,
      perioMetrics: treatmentData.perioMetrics,
      vitalityMetrics: treatmentData.vitalityMetrics,
      reminderConfig: treatmentData.reminderConfig
    };

    if (treatmentData.reminderConfig?.enabled) {
      scheduleEntityReminder({
        sourceType: 'treatment',
        sourceId: `${targetPatient.id}-${toothKey}`,
        patientId: targetPatient.id,
        patientName: targetPatient.fullName,
        patientPhone: targetPatient.phone,
        title: `پیگیری درمان دندان ${treatmentData.quadrant}${treatmentData.toothNumber}`,
        description: treatmentData.notes || `دکتر ${newCondition.doctorName}`,
        targetDate: getRelativePersianDate(3),
        targetView: 'patients',
        config: treatmentData.reminderConfig
      });
    }

    const updatedPatients = patients.map(p => {
      if (p.id === targetPatient.id) {
        const nextTeeth: Record<string, ToothCondition> = {
          ...(p.teethConditions || {}),
          [toothKey]: newCondition
        };
        if (legacyDashKey in nextTeeth) delete nextTeeth[legacyDashKey];
        if (legacyBareKey in nextTeeth) delete nextTeeth[legacyBareKey];
        const nextActiveCount = Object.values(nextTeeth).filter((c) => c.status !== 'completed').length;
        const nextTotalCost = Math.max(0, p.totalCost + costDelta);
        return {
          ...p,
          totalCost: nextTotalCost,
          balance: p.paidAmount - nextTotalCost,
          activeTreatmentsCount: nextActiveCount,
          teethConditions: nextTeeth
        };
      }
      return p;
    });

    const prevPatients = patients;
    setPatients(updatedPatients);
    const updatedTarget = updatedPatients.find(p => p.id === targetPatient.id);
    if (selectedPatient && selectedPatient.id === targetPatient.id) {
      setSelectedPatient(updatedTarget || null);
    }

    // Persist to Supabase Cloud, IndexedDB & Offline-First Outbox Queue
    if (updatedTarget) {
      supabaseService.savePatient(updatedTarget);
      indexedDbService.savePatient(updatedTarget);
      stateSyncQueue.enqueue('patients', 'UPDATE', updatedTarget, 'local');
      syncEngine.recordOfflineOrLiveMutation({
        entity: 'patient',
        action: 'UPSERT',
        payload: updatedTarget,
        actorName: currentUser.username,
        actorRole: currentUser.role,
        platform: currentUser.assignedPlatform,
        eventType: 'TREATMENT_REGISTERED',
        title: `درمان دندان ${treatmentData.toothNumber} ثبت شد`,
        description: `پزشک درمان دندان ${treatmentData.toothNumber} (مبلغ ${formatToman(treatmentData.cost)}) را برای ${targetPatient.fullName} ثبت کرد.`
      });
    }

    // Register Undo Action & Global Visual Verification HUD
    undoManager.register({
      title: `درمان دندان ${treatmentData.toothNumber} ثبت شد`,
      description: `برای ${targetPatient.fullName} (${formatToman(treatmentData.cost)})`,
      undo: () => {
        setPatients(prevPatients);
        if (selectedPatient) {
          setSelectedPatient(prevPatients.find(p => p.id === selectedPatient.id) || null);
        }
        if (targetPatient) {
          supabaseService.savePatient(targetPatient);
        }
      }
    });

    actionFeedback.recordSuccess({
      title: `درمان دندان ${treatmentData.toothNumber} (${treatmentData.treatment}) ثبت شد`,
      subtitle: `بیمار: ${targetPatient.fullName} · مبلغ: ${formatToman(treatmentData.cost)}`,
      diffBefore: `جمع کل قبلی: ${formatToman(targetPatient.totalCost)}`,
      diffAfter: `جمع کل جدید: ${formatToman(targetPatient.totalCost + treatmentData.cost)}`,
      targetRecordId: targetPatient.id,
      badgeText: `✓ درمان دندان ${treatmentData.toothNumber} (${formatToman(treatmentData.cost)}) ثبت شد`,
      canUndo: true
    });

    // Automatic inventory consumption based on dental procedure bill-of-materials
    const consumption = inventoryConsumptionService.deductSuppliesForTreatment(
      treatmentData.treatment,
      inventory
    );
    if (consumption.deductedItems.length > 0) {
      setInventory(consumption.updatedInventory);
      if (consumption.criticalAlerts.length > 0) {
        syncEngine.broadcast({
          type: 'CLOUD_BACKUP_SAVED',
          performedBy: 'سیستم هوشمند انبار',
          role: 'admin',
          platform: currentUser?.assignedPlatform || 'Web Admin',
          title: 'هشدار کسری انبار مصرفی دندانپزشکی',
          description: `موجودی ${consumption.criticalAlerts.map(a => a.itemName).join('، ')} به حداقل مجاز رسید. پیش‌فاکتور تأمین آماده صدور است.`
        });
      }
    }
  };

  const handleUpdateToothTreatmentStatus = (
    patientId: string,
    toothKey: string,
    nextStatus: ToothCondition['status']
  ) => {
    const target = patients.find((p) => p.id === patientId);
    if (!target || !target.teethConditions?.[toothKey]) return;

    const nextTeeth: Record<string, ToothCondition> = {
      ...target.teethConditions,
      [toothKey]: {
        ...target.teethConditions[toothKey],
        status: nextStatus
      }
    };
    const updatedPat: Patient = {
      ...target,
      teethConditions: nextTeeth,
      activeTreatmentsCount: Object.values(nextTeeth).filter((c) => c.status !== 'completed').length
    };
    setPatients((prev) => prev.map((p) => (p.id === patientId ? updatedPat : p)));
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat);
    }
    supabaseService.savePatient(updatedPat);
    indexedDbService.savePatient(updatedPat);
    stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');
    actionFeedback.recordSuccess({
      title: `وضعیت درمان دندان ${toothKey} به «${nextStatus === 'completed' ? 'تکمیل‌شده' : nextStatus === 'in_progress' ? 'در حال درمان' : 'طرح درمان'}» تغییر یافت`,
      subtitle: `بیمار: ${target.fullName}`,
      diffBefore: `وضعیت قبلی: ${target.teethConditions[toothKey].status}`,
      diffAfter: `وضعیت جدید: ${nextStatus}`,
      targetRecordId: patientId,
      badgeText: nextStatus === 'completed' ? '✓ درمان تکمیل شد' : '✓ وضعیت به‌روزرسانی شد'
    });
  };

  // Add Sayad Check
  const handleAddCheck = (newCheck: SayadCheck) => {
    const updated = patients.map(p => {
      if (p.id === newCheck.patientId) {
        return {
          ...p,
          sayadChecks: [newCheck, ...p.sayadChecks]
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === newCheck.patientId);
    if (selectedPatient && selectedPatient.id === newCheck.patientId) {
      setSelectedPatient(updatedPat || null);
    }

    // Persist to Supabase Cloud
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
    }
    supabaseService.saveSayadCheck(newCheck);

    if (newCheck.reminderConfig?.enabled) {
      scheduleEntityReminder({
        sourceType: 'check',
        sourceId: newCheck.id,
        patientId: newCheck.patientId,
        patientName: newCheck.patientName,
        patientPhone: updatedPat?.phone,
        title: `سررسید چک صیادی (${formatToman(newCheck.amount)})`,
        description: `بانک ${newCheck.bankName} · شناسه ${newCheck.sayadId}`,
        targetDate: newCheck.dueDate,
        targetView: 'financial',
        config: newCheck.reminderConfig
      });
    }

    actionFeedback.recordSuccess({
      title: 'چک صیادی جدید با موفقیت ثبت شد',
      subtitle: `بیمار: ${newCheck.patientName} · مبلغ: ${formatToman(newCheck.amount)}`,
      diffAfter: `شناسه صیاد: ${newCheck.sayadId} (${newCheck.dueDate})`,
      targetRecordId: newCheck.patientId,
      badgeText: `✓ چک صیادی ${formatToman(newCheck.amount)} ثبت شد`,
      canUndo: false
    });

    void syncEngine.recordOfflineOrLiveMutation({
      entity: 'sayad_check',
      action: 'UPSERT',
      payload: newCheck,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'CHECK_REGISTERED',
      title: 'چک صیادی جدید ثبت شد',
      description: `چک ${formatToman(newCheck.amount)} بابت بیمار ${newCheck.patientName} در سامانه صیاد ثبت گردید.`
    });
  };

  // Add Lab Order
  const handleAddLabOrder = (newOrder: LabOrder) => {
    const extractToothCode = (txt?: string) => (txt || '').match(/[A-Z]{2}[1-8]/i)?.[0]?.toUpperCase() || '';
    const orderCode = extractToothCode(newOrder.toothNumber);
    const isImplantOrder = /ایمپلنت|اباتمنت|فریم|اسکن/i.test(newOrder.workType || '');

    const updated = patients.map(p => {
      if (p.id === newOrder.patientId) {
        // Auto-sync matching ImplantCase from healing_cap/impression -> abutment_framework when prosthesis order is dispatched
        const nextImplants = (p.implantCases || []).map(imp => {
          const impCode = extractToothCode(imp.toothNumber);
          const sameTooth = orderCode && impCode ? orderCode === impCode : imp.toothNumber === newOrder.toothNumber;
          if ((sameTooth || isImplantOrder) && (imp.currentStage === 'healing_cap' || imp.currentStage === 'impression')) {
            markReminderDone(`rem_implant_${imp.id}`);
            return { ...imp, currentStage: 'abutment_framework' as ImplantStage };
          }
          return imp;
        });
        return {
          ...p,
          labOrders: [newOrder, ...p.labOrders],
          implantCases: nextImplants
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === newOrder.patientId);
    if (selectedPatient && selectedPatient.id === newOrder.patientId) {
      setSelectedPatient(updatedPat || null);
    }

    // Persist to Supabase Cloud
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    supabaseService.saveLabOrder(newOrder);

    if (newOrder.reminderConfig?.enabled) {
      scheduleEntityReminder({
        sourceType: 'lab',
        sourceId: newOrder.id,
        patientId: newOrder.patientId,
        patientName: newOrder.patientName,
        patientPhone: updatedPat?.phone,
        title: `پیگیری لابراتوار: ${newOrder.workType}`,
        description: `${newOrder.toothNumber} · ${newOrder.labName}${newOrder.trackingSlipCode ? ` · قبض ${newOrder.trackingSlipCode}` : ''}`,
        targetDate: newOrder.deliveryDate,
        targetView: 'lab',
        config: newOrder.reminderConfig
      });
    }

    actionFeedback.recordSuccess({
      title: 'سفارش جدید لابراتوار ثبت و ارسال شد',
      subtitle: `${newOrder.workType} · بیمار: ${newOrder.patientName}`,
      diffAfter: `لابراتوار: ${newOrder.labName} · تحویل: ${newOrder.deliveryDate}`,
      targetRecordId: newOrder.id,
      badgeText: `✓ سفارش ${newOrder.workType} ثبت شد`,
      canUndo: false
    });

    void syncEngine.recordOfflineOrLiveMutation({
      entity: 'lab_order',
      action: 'UPSERT',
      payload: newOrder,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'LAB_DISPATCHED',
      title: 'سفارش پروتز به لابراتوار ارسال شد',
      description: `${newOrder.workType} برای ${newOrder.patientName} به ${newOrder.labName} ارسال گردید.`
    });
  };

  // Add Payment (Immediately syncs across all devices + auto-settles matching installments & Sayad checks)
  const handleAddPayment = (newPayment: PaymentRecord) => {
    const prevPatients = patients;
    const oldPat = patients.find(p => p.id === newPayment.patientId);
    const settledInstIds: string[] = [];
    const clearedChkIds: string[] = [];

    const updated = patients.map(p => {
      if (p.id === newPayment.patientId) {
        const nextBalance = p.balance + newPayment.amount;
        const clearsAll = nextBalance >= 0;
        const patInsts = p.installments || [];
        const patUnpaidInsts = patInsts.filter(inst => inst.status !== 'paid');
        const matchedInst = patUnpaidInsts.find(
          inst =>
            (newPayment.forTreatment && newPayment.forTreatment.includes(`قسط ${inst.installmentNumber}`)) ||
            inst.amount === newPayment.amount
        );
        const instIdsToSettle = clearsAll
          ? patUnpaidInsts.map(i => i.id)
          : matchedInst
            ? [matchedInst.id]
            : [];
        const settleIdSet = new Set(instIdsToSettle);
        instIdsToSettle.forEach(id => settledInstIds.push(id));

        const nextInstallments =
          settleIdSet.size > 0
            ? patInsts.map(inst =>
                settleIdSet.has(inst.id) ? { ...inst, status: 'paid' as const } : inst
              )
            : patInsts;

        const settledInsts = patUnpaidInsts.filter(i => settleIdSet.has(i.id));
        const patChecks = p.sayadChecks || [];
        const nextSayadChecks =
          settleIdSet.size > 0
            ? patChecks.map(chk => {
                if (
                  !chk.isGuarantee &&
                  chk.status === 'in_collection' &&
                  (clearsAll ||
                    settledInsts.some(
                      si => chk.id.includes(si.id) || (chk.dueDate === si.dueDate && chk.amount === si.amount)
                    ))
                ) {
                  clearedChkIds.push(chk.id);
                  return { ...chk, status: 'cleared' as const };
                }
                return chk;
              })
            : patChecks;

        return {
          ...p,
          paidAmount: p.paidAmount + newPayment.amount,
          balance: nextBalance,
          payments: [newPayment, ...p.payments],
          installments: nextInstallments,
          sayadChecks: nextSayadChecks
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === newPayment.patientId);
    if (selectedPatient && selectedPatient.id === newPayment.patientId) {
      setSelectedPatient(updatedPat || null);
    }

    // Persist patient balance & payment record to Supabase
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
    }
    supabaseService.savePayment(newPayment);

    // Mark reminders done for any auto-settled installments or Sayad checks
    settledInstIds.forEach(id => markReminderDone(`rem_installment_${id}`));
    clearedChkIds.forEach(id => markReminderDone(`rem_check_${id}`));

    if (newPayment.reminderConfig?.enabled) {
      scheduleEntityReminder({
        sourceType: 'payment',
        sourceId: newPayment.id,
        patientId: newPayment.patientId,
        patientName: newPayment.patientName,
        patientPhone: updatedPat?.phone,
        title: `پیگیری مالی / تسویه مانده (${newPayment.patientName})`,
        description: newPayment.forTreatment,
        targetDate: getRelativePersianDate(7),
        targetView: 'financial',
        config: newPayment.reminderConfig
      });
    }

    setDoctorBillingAlert(null);

    undoManager.register({
      title: `دریافت وجه ${formatToman(newPayment.amount)} ثبت شد`,
      description: `بیمار: ${newPayment.patientName}`,
      undo: () => {
        setPatients(prevPatients);
        if (oldPat) supabaseService.savePatient(oldPat);
      }
    });

    actionFeedback.recordSuccess({
      title: `دریافت وجه (${formatToman(newPayment.amount)}) در صندوق ثبت شد`,
      subtitle: `بیمار: ${newPayment.patientName} · بابت: ${newPayment.forTreatment}`,
      diffBefore: oldPat ? `مانده قبلی: ${formatToman(Math.abs(oldPat.balance))}` : undefined,
      diffAfter: updatedPat ? `مانده جدید: ${formatToman(Math.abs(updatedPat.balance))}` : undefined,
      targetRecordId: newPayment.patientId,
      badgeText: `✓ پرداخت ${formatToman(newPayment.amount)} ثبت شد`,
      canUndo: true
    });

    void syncEngine.recordOfflineOrLiveMutation({
      entity: 'payment',
      action: 'UPSERT',
      payload: newPayment,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'PAYMENT_COLLECTED',
      title: 'وجه در صندوق تسویه شد',
      description: `مبلغ ${formatToman(newPayment.amount)} از بیمار ${newPayment.patientName} دریافت و در کلینیک ثبت شد.`
    });
  };

  // Save Installment Plan from Calculator (Auto updates installments & checks)
  const handleSaveInstallmentPlan = (
    patientId: string, 
    installments: Installment[], 
    checks: SayadCheck[], 
    downPaymentAmount: number
  ) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        const nextPayments = downPaymentAmount > 0 ? [
          {
            id: `pay-${Date.now()}`,
            patientId,
            patientName: p.fullName,
            amount: downPaymentAmount,
            date: getCurrentPersianDate(),
            method: 'pos' as const,
            forTreatment: installments[0]?.treatmentName || 'پیش‌پرداخت اقساط درمان'
          },
          ...(p.payments || [])
        ] : (p.payments || []);

        return {
          ...p,
          installments: [...installments, ...(p.installments || [])],
          sayadChecks: [...checks, ...(p.sayadChecks || [])],
          paidAmount: p.paidAmount + downPaymentAmount,
          balance: p.balance + downPaymentAmount,
          payments: nextPayments
        };
      }
      return p;
    });

    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      installments.forEach(inst => {
        if (inst.reminderConfig?.enabled) {
          scheduleEntityReminder({
            sourceType: 'installment',
            sourceId: inst.id,
            patientId: updatedPat.id,
            patientName: inst.patientName,
            patientPhone: updatedPat.phone,
            title: `سررسید قسط شماره ${toPersianDigits(inst.installmentNumber)} (${formatToman(inst.amount)})`,
            description: inst.treatmentName || 'قسط درمانی',
            targetDate: inst.dueDate,
            targetView: 'financial',
            config: inst.reminderConfig
          });
        }
      });
      checks.forEach(chk => {
        if (chk.reminderConfig?.enabled) {
          scheduleEntityReminder({
            sourceType: 'check',
            sourceId: chk.id,
            patientId: updatedPat.id,
            patientName: chk.patientName,
            patientPhone: updatedPat.phone,
            title: `سررسید چک صیادی (${formatToman(chk.amount)})`,
            description: `شناسه ${chk.sayadId}`,
            targetDate: chk.dueDate,
            targetView: 'financial',
            config: chk.reminderConfig
          });
        }
      });
    }

    if (updatedPat) {
      void syncEngine.recordOfflineOrLiveMutation({
        entity: 'patient',
        action: 'UPSERT',
        payload: updatedPat,
        actorName: currentUser.username,
        actorRole: currentUser.role,
        platform: currentUser.assignedPlatform,
        eventType: 'CHECK_REGISTERED',
        title: 'برنامه اقساط و چک‌های درمانی ثبت شد',
        description: `برنامه ${installments.length} قسطی برای بیمار ثبت و در سیستم ذخیره گردید.`
      });
    }
  };

  // Mark Installment Paid (Real-time settlement with 1-tap Undo & Receipt generation + Auto Check & Reminder Sync)
  const handlePayInstallment = (inst: Installment) => {
    const prevPatients = patients;
    const oldPat = patients.find(p => p.id === inst.patientId);
    let syncedCheckId: string | null = null;

    const updated = patients.map(p => {
      if (p.id === inst.patientId) {
        const nextPayment: PaymentRecord = {
          id: `pay-inst-${Date.now()}`,
          patientId: p.id,
          patientName: p.fullName,
          amount: inst.amount,
          date: getCurrentPersianDate(),
          method: 'pos',
          forTreatment: `تسویه قسط شماره ${inst.installmentNumber} (${inst.treatmentName || 'درمان'})`
        };

        // Also clear any linked non-guarantee Sayad Check matching dueDate or installment description
        const nextChecks = (p.sayadChecks || []).map(chk => {
          if (
            !chk.isGuarantee &&
            chk.status !== 'cleared' &&
            (chk.dueDate === inst.dueDate || (chk.description || '').includes(`قسط شماره ${toPersianDigits(inst.installmentNumber)}`))
          ) {
            syncedCheckId = chk.id;
            return { ...chk, status: 'cleared' as const };
          }
          return chk;
        });

        return {
          ...p,
          paidAmount: p.paidAmount + inst.amount,
          balance: p.balance + inst.amount,
          installments: (p.installments || []).map(i =>
            i.id === inst.id ? { ...i, status: 'paid' as const, paidDate: getCurrentPersianDate() } : i
          ),
          sayadChecks: nextChecks,
          payments: [nextPayment, ...(p.payments || [])]
        };
      }
      return p;
    });

    setPatients(updated);
    const updatedPat = updated.find(p => p.id === inst.patientId);
    if (selectedPatient && selectedPatient.id === inst.patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
      markReminderDone(`rem-installment-${inst.id}`);
      if (syncedCheckId) {
        markReminderDone(`rem-check-${syncedCheckId}`);
      }
    }

    undoManager.register({
      title: `قسط شماره ${inst.installmentNumber} تسویه شد`,
      description: `بیمار: ${inst.patientName} (${formatToman(inst.amount)})`,
      undo: () => {
        setPatients(prevPatients);
        if (oldPat) supabaseService.savePatient(oldPat);
      }
    });

    const allPaidNow = updatedPat ? (updatedPat.installments || []).every(i => i.status === 'paid') : false;
    const hasActiveGuarantee = updatedPat ? (updatedPat.sayadChecks || []).some(c => c.isGuarantee && c.status !== 'returned') : false;

    actionFeedback.recordSuccess({
      title: `قسط شماره ${inst.installmentNumber} بیمار «${inst.patientName}» وصول شد`,
      subtitle: allPaidNow && hasActiveGuarantee
        ? `تمامی اقساط تسویه شد ✓ چک ضمانت امانی آماده عودت به بیمار است`
        : `مبلغ: ${formatToman(inst.amount)}${syncedCheckId ? ' · چک صیادی مرتبط نیز وصول شد' : ''}`,
      diffBefore: oldPat ? `مانده قبلی: ${formatToman(Math.abs(oldPat.balance))}` : undefined,
      diffAfter: updatedPat ? `مانده جدید: ${formatToman(Math.abs(updatedPat.balance))}` : undefined,
      targetRecordId: inst.id,
      badgeText: `✓ قسط ${formatToman(inst.amount)} تسویه شد`,
      canUndo: true
    });

    if (updatedPat) {
      void syncEngine.recordOfflineOrLiveMutation({
        entity: 'patient',
        action: 'UPSERT',
        payload: updatedPat,
        actorName: currentUser.username,
        actorRole: currentUser.role,
        platform: currentUser.assignedPlatform,
        eventType: 'PAYMENT_COLLECTED',
        title: `وصول قسط درمانی (${inst.patientName})`,
        description: `قسط شماره ${inst.installmentNumber} به مبلغ ${formatToman(inst.amount)} تسویه و در صندوق ثبت شد.`
      });
    }
  };

  // Update Sayad / Guarantee Check Status (Clear or Return with 1-tap Undo + Bidirectional Installment & Reminder Sync)
  const handleUpdateCheckStatus = (check: SayadCheck, newStatus: SayadCheck['status']) => {
    const prevPatients = patients;
    const oldPat = patients.find(p => p.id === check.patientId);
    let syncedInstallmentId: string | null = null;

    const updated = patients.map(p => {
      if (p.id === check.patientId) {
        const shouldCreditBalance = !check.isGuarantee && newStatus === 'cleared' && check.status !== 'cleared';
        const shouldReverseCredit = !check.isGuarantee && check.status === 'cleared' && newStatus !== 'cleared';
        const balanceDelta = shouldCreditBalance ? check.amount : shouldReverseCredit ? -check.amount : 0;

        // If a non-guarantee Sayad Check is cleared, also mark any matching pending installment as paid
        const nextInstallments = (p.installments || []).map(inst => {
          if (
            shouldCreditBalance &&
            inst.status !== 'paid' &&
            (inst.dueDate === check.dueDate || (inst.amount === check.amount && !syncedInstallmentId))
          ) {
            syncedInstallmentId = inst.id;
            return { ...inst, status: 'paid' as const, paidDate: getCurrentPersianDate() };
          }
          return inst;
        });

        const nextPayments = shouldCreditBalance
          ? [
              {
                id: `pay-chk-${Date.now()}`,
                patientId: p.id,
                patientName: p.fullName,
                amount: check.amount,
                date: getCurrentPersianDate(),
                method: 'card_to_card' as const,
                referenceNumber: check.sayadId,
                forTreatment: check.description || `وصول چک صیادی ${check.bankName}`
              },
              ...(p.payments || [])
            ]
          : (p.payments || []);

        return {
          ...p,
          paidAmount: Math.max(0, p.paidAmount + balanceDelta),
          balance: p.balance + balanceDelta,
          installments: nextInstallments,
          payments: nextPayments,
          sayadChecks: (p.sayadChecks || []).map(c =>
            c.id === check.id ? { ...c, status: newStatus } : c
          )
        };
      }
      return p;
    });

    setPatients(updated);
    const updatedPat = updated.find(p => p.id === check.patientId);
    if (selectedPatient && selectedPatient.id === check.patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
      if (newStatus === 'cleared' || newStatus === 'returned') {
        markReminderDone(`rem-check-${check.id}`);
      }
      if (syncedInstallmentId) {
        markReminderDone(`rem-installment-${syncedInstallmentId}`);
      }
    }

    undoManager.register({
      title: newStatus === 'returned' ? `چک ضمانت ${check.patientName} عودت شد` : `چک صیادی ${check.patientName} وصول شد`,
      description: `شناسه صیاد: ${check.sayadId} (${formatToman(check.amount)})`,
      undo: () => {
        setPatients(prevPatients);
        if (oldPat) supabaseService.savePatient(oldPat);
      }
    });

    actionFeedback.recordSuccess({
      title: newStatus === 'returned'
        ? `چک ضمانت بیمار «${check.patientName}» عودت داده شد`
        : `چک صیادی بیمار «${check.patientName}» وصول شد`,
      subtitle: `بانک ${check.bankName} · شناسه: ${check.sayadId}${syncedInstallmentId ? ' · قسط متناظر نیز تسویه شد' : ''}`,
      diffAfter: newStatus === 'returned' ? 'وضعیت: تحویل بیمار شد ✓' : `وصول قطعی (${formatToman(check.amount)})`,
      targetRecordId: check.id,
      badgeText: newStatus === 'returned' ? '✓ چک ضمانت عودت شد' : '✓ چک صیادی وصول شد',
      canUndo: true
    });
  };

  // Edit Sayad / Guarantee Check Details
  const handleEditCheck = (checkId: string, updatedFields: Partial<SayadCheck>) => {
    const prevPatients = patients;
    let targetCheck: SayadCheck | undefined;
    const updated = patients.map(p => {
      const found = (p.sayadChecks || []).find(c => c.id === checkId);
      if (found) {
        targetCheck = found;
        return {
          ...p,
          sayadChecks: (p.sayadChecks || []).map(c => c.id === checkId ? { ...c, ...updatedFields } : c)
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => (p.sayadChecks || []).some(c => c.id === checkId));
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    if (targetCheck) {
      const mergedCheck = { ...targetCheck, ...updatedFields };
      if (mergedCheck.reminderConfig?.enabled) {
        scheduleEntityReminder({
          sourceType: 'check',
          sourceId: mergedCheck.id,
          patientId: mergedCheck.patientId,
          patientName: mergedCheck.patientName,
          patientPhone: updatedPat?.phone,
          title: `سررسید چک صیادی (${formatToman(mergedCheck.amount)})`,
          description: `بانک ${mergedCheck.bankName} · شناسه ${mergedCheck.sayadId}`,
          targetDate: mergedCheck.dueDate,
          targetView: 'financial',
          config: mergedCheck.reminderConfig
        });
      }
      undoManager.register({
        title: `مشخصات چک ${targetCheck.patientName} ویرایش شد`,
        description: `شناسه صیاد: ${updatedFields.sayadId || targetCheck.sayadId}`,
        undo: () => setPatients(prevPatients)
      });
      actionFeedback.recordSuccess({
        title: `مشخصات چک «${targetCheck.patientName}» ویرایش شد`,
        subtitle: `بانک ${updatedFields.bankName || targetCheck.bankName} · سررسید: ${updatedFields.dueDate || targetCheck.dueDate}`,
        diffAfter: `مبلغ: ${formatToman(updatedFields.amount ?? targetCheck.amount)}`,
        targetRecordId: checkId,
        badgeText: '✓ مشخصات چک ویرایش شد',
        canUndo: true
      });
    }
  };

  // Delete Sayad / Guarantee Check (Manager-Only + Soft-Delete Vault + Undo)
  const handleDeleteCheck = (checkId: string) => {
    if (!verifyManagerDeletion(currentUser, 'حذف چک صیادی/ضمانت', checkId)) {
      return;
    }
    const prevPatients = patients;
    let deletedCheck: SayadCheck | undefined;
    const updated = patients.map(p => {
      const found = (p.sayadChecks || []).find(c => c.id === checkId);
      if (found) {
        deletedCheck = found;
        return {
          ...p,
          sayadChecks: (p.sayadChecks || []).filter(c => c.id !== checkId)
        };
      }
      return p;
    });
    if (!deletedCheck) return;
    archiveToTrashVault({
      entityType: 'check',
      entityId: checkId,
      parentPatientId: deletedCheck.patientId,
      title: `چک صیادی ${deletedCheck.patientName}`,
      subtitle: `شناسه: ${deletedCheck.sayadId} · مبلغ: ${formatToman(deletedCheck.amount)}`,
      payload: deletedCheck,
      deletedByUser: currentUser
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === deletedCheck?.patientId);
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    undoManager.register({
      title: `چک ${deletedCheck.patientName} حذف و بایگانی شد`,
      description: `شناسه صیاد: ${deletedCheck.sayadId}`,
      undo: () => setPatients(prevPatients)
    });
    actionFeedback.recordSuccess({
      title: `چک صیادی/ضمانت «${deletedCheck.patientName}» به بایگانی مدیر منتقل شد`,
      subtitle: `شناسه: ${deletedCheck.sayadId}`,
      diffAfter: 'انتقال به گاوصندوق حذفیات مدیر (قابل بازیابی)',
      targetRecordId: checkId,
      badgeText: '✓ چک بایگانی شد',
      canUndo: true
    });
  };

  // Edit / Reschedule Installment
  const handleEditInstallment = (instId: string, updatedFields: Partial<Installment>) => {
    const prevPatients = patients;
    let targetInst: Installment | undefined;
    const updated = patients.map(p => {
      const found = (p.installments || []).find(i => i.id === instId);
      if (found) {
        targetInst = found;
        return {
          ...p,
          installments: (p.installments || []).map(i => i.id === instId ? { ...i, ...updatedFields } : i)
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => (p.installments || []).some(i => i.id === instId));
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    if (targetInst) {
      const mergedInst = { ...targetInst, ...updatedFields };
      if (mergedInst.reminderConfig?.enabled) {
        scheduleEntityReminder({
          sourceType: 'installment',
          sourceId: mergedInst.id,
          patientId: mergedInst.patientId,
          patientName: mergedInst.patientName,
          patientPhone: updatedPat?.phone,
          title: `سررسید قسط شماره ${toPersianDigits(mergedInst.installmentNumber)} (${formatToman(mergedInst.amount)})`,
          description: mergedInst.treatmentName || 'قسط درمانی',
          targetDate: mergedInst.dueDate,
          targetView: 'financial',
          config: mergedInst.reminderConfig
        });
      }
      undoManager.register({
        title: `قسط شماره ${targetInst.installmentNumber} (${targetInst.patientName}) ویرایش شد`,
        description: `سررسید جدید: ${updatedFields.dueDate || targetInst.dueDate}`,
        undo: () => setPatients(prevPatients)
      });
      actionFeedback.recordSuccess({
        title: `قسط شماره ${targetInst.installmentNumber} «${targetInst.patientName}» تمدید/ویرایش شد`,
        subtitle: `سررسید جدید: ${updatedFields.dueDate || targetInst.dueDate}`,
        diffBefore: `مبلغ قبلی: ${formatToman(targetInst.amount)}`,
        diffAfter: `مبلغ جدید: ${formatToman(updatedFields.amount ?? targetInst.amount)}`,
        targetRecordId: instId,
        badgeText: '✓ قسط ویرایش شد',
        canUndo: true
      });
    }
  };

  // Refund or Edit POS / Cash Payment Receipt (Refunds require Clinic Manager authorization)
  const handleEditOrRefundPayment = (paymentId: string, action: 'refund' | 'edit', newAmount?: number, newNote?: string) => {
    if (action === 'refund' && !verifyManagerDeletion(currentUser, 'عودت و ابطال رسید پرداخت (Refund)', paymentId)) {
      return;
    }
    const prevPatients = patients;
    let targetPay: PaymentRecord | undefined;
    const updated = patients.map(p => {
      const found = (p.payments || []).find(pay => pay.id === paymentId);
      if (!found) return p;
      targetPay = found;
      if (action === 'refund') {
        archiveToTrashVault({
          entityType: 'payment_refund',
          entityId: found.id,
          parentPatientId: found.patientId,
          title: `عودت وجه پرداختی ${found.patientName}`,
          subtitle: `مبلغ: ${formatToman(found.amount)} · روش: ${found.method}`,
          payload: found,
          deletedByUser: currentUser
        });
        const nextPaid = Math.max(0, p.paidAmount - found.amount);
        const nextBalance = p.balance - found.amount;
        return {
          ...p,
          paidAmount: nextPaid,
          balance: nextBalance,
          payments: (p.payments || []).filter(pay => pay.id !== paymentId)
        };
      } else {
        const updatedAmt = newAmount !== undefined ? newAmount : found.amount;
        const diff = updatedAmt - found.amount;
        return {
          ...p,
          paidAmount: Math.max(0, p.paidAmount + diff),
          balance: p.balance + diff,
          payments: (p.payments || []).map(pay =>
            pay.id === paymentId
              ? { ...pay, amount: updatedAmt, forTreatment: newNote !== undefined ? newNote : pay.forTreatment }
              : pay
          )
        };
      }
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === targetPay?.patientId);
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    if (targetPay) {
      undoManager.register({
        title: action === 'refund' ? `تراکنش ${targetPay.patientName} عودت وجه (Refund) شد` : `تراکنش ${targetPay.patientName} اصلاح شد`,
        description: `مبلغ: ${formatToman(targetPay.amount)}`,
        undo: () => setPatients(prevPatients)
      });
      actionFeedback.recordSuccess({
        title: action === 'refund'
          ? `عودت وجه (Refund) برای «${targetPay.patientName}» ثبت شد`
          : `رسید پرداخت «${targetPay.patientName}» اصلاح شد`,
        subtitle: `پیگیری: ${targetPay.referenceNumber || 'صندوق'}`,
        diffBefore: `مبلغ قبلی: ${formatToman(targetPay.amount)}`,
        diffAfter: action === 'refund' ? 'عودت کامل وجه و اصلاح مانده حساب' : `مبلغ جدید: ${formatToman(newAmount ?? targetPay.amount)}`,
        targetRecordId: paymentId,
        badgeText: action === 'refund' ? '✓ عودت وجه انجام شد' : '✓ رسید اصلاح شد',
        canUndo: true
      });
    }
  };

  // Advance Implant Stage
  const handleAdvanceImplantStage = (caseId: string, nextStage: ImplantStage) => {
    const prevPatients = patients;
    const stageLabels: Record<ImplantStage, string> = {
      fixture_placed: '۱. کاشت فیکسچر',
      healing_cap: '۲. بستن هیلینگ کپ',
      impression: '۳. قالب‌گیری پروتز',
      abutment_framework: '۴. تست اباتمنت و فریم',
      crown_delivered: '۵. تحویل نهایی روکش'
    };
    const extractToothCode = (txt?: string) => (txt || '').match(/[A-Z]{2}[1-8]/i)?.[0]?.toUpperCase() || '';
    let oldStageLabel = '';
    let targetCasePatientName = '';
    let targetCaseAfter: ImplantCase | undefined;

    const updated = patients.map(p => {
      const foundCase = p.implantCases.find(c => c.id === caseId);
      if (foundCase) {
        oldStageLabel = stageLabels[foundCase.currentStage] || foundCase.currentStage;
        targetCasePatientName = foundCase.patientName;
        const impCode = extractToothCode(foundCase.toothNumber);
        const nextImplants = p.implantCases.map(c => {
          if (c.id !== caseId) return c;
          const nextObj = { ...c, currentStage: nextStage };
          targetCaseAfter = nextObj;
          return nextObj;
        });

        // If implant reaches crown_delivered, auto-complete any ready linked LabOrder and Palmer tooth condition
        const nextLabOrders =
          nextStage === 'crown_delivered'
            ? (p.labOrders || []).map(lo => {
                const loCode = extractToothCode(lo.toothNumber);
                const sameTooth = impCode && loCode ? impCode === loCode : lo.toothNumber === foundCase.toothNumber;
                if (sameTooth && lo.status !== 'delivered_cemented') {
                  markReminderDone(`rem_lab_${lo.id}`);
                  markReminderDone(`rem-lab-${lo.id}`);
                  return {
                    ...lo,
                    status: 'delivered_cemented' as const,
                    deliveredToPatientDate: getCurrentPersianDate()
                  };
                }
                return lo;
              })
            : p.labOrders;

        const nextTeethConditions = { ...(p.teethConditions || {}) };
        if (nextStage === 'crown_delivered' && impCode) {
          const palmerKey = `${impCode.slice(0, 2)}_${impCode.slice(2)}`;
          const existingCond = nextTeethConditions[palmerKey];
          if (existingCond && existingCond.status !== 'completed') {
            nextTeethConditions[palmerKey] = {
              ...existingCond,
              status: 'completed',
              notes: `${existingCond.notes ? `${existingCond.notes} · ` : ''}تحویل نهایی روکش ایمپلنت (${getCurrentPersianDate()})`,
              history: [
                {
                  treatment: existingCond.treatment,
                  surfaces: existingCond.surfaces,
                  status: existingCond.status,
                  cost: existingCond.cost || 0,
                  doctorName: existingCond.doctorName,
                  date: existingCond.date || getCurrentPersianDate(),
                  notes: existingCond.notes
                },
                ...(existingCond.history || [])
              ].slice(0, 5)
            };
          }
        }

        return {
          ...p,
          implantCases: nextImplants,
          labOrders: nextLabOrders,
          teethConditions: nextTeethConditions
        };
      }
      return p;
    });
    setPatients(updated);

    const updatedPat = updated.find(p => p.implantCases.some(c => c.id === caseId));
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);

      if (nextStage === 'crown_delivered') {
        markReminderDone(`rem_implant_${caseId}`);
      } else if (targetCaseAfter && (nextStage === 'healing_cap' || nextStage === 'impression')) {
        scheduleEntityReminder({
          sourceType: 'implant',
          sourceId: caseId,
          patientId: updatedPat.id,
          patientName: targetCaseAfter.patientName,
          patientPhone: updatedPat.phone,
          title:
            nextStage === 'healing_cap'
              ? `فراخوان قالب‌گیری ایمپلنت ${targetCaseAfter.brand} (${targetCaseAfter.toothNumber})`
              : `ارسال قالب ایمپلنت به لابراتوار (${targetCaseAfter.toothNumber})`,
          description: `مرحله جدید: ${stageLabels[nextStage]}`,
          targetDate: nextStage === 'healing_cap' ? getRelativePersianDate(14) : getRelativePersianDate(2),
          targetView: nextStage === 'impression' ? 'lab' : 'implant',
          config: targetCaseAfter.reminderConfig || { enabled: true, preset: '2d_before', channels: ['phone_push', 'in_app'] }
        });
      }
    }

    undoManager.register({
      title: `مرحله ایمپلنت ${targetCasePatientName} تغییر یافت`,
      description: `به مرحله «${stageLabels[nextStage]}»`,
      undo: () => {
        setPatients(prevPatients);
      }
    });

    actionFeedback.recordSuccess({
      title: `مرحله جراحی ایمپلنت تغییر یافت`,
      subtitle: `بیمار: ${targetCasePatientName}`,
      diffBefore: oldStageLabel,
      diffAfter: stageLabels[nextStage] || nextStage,
      targetRecordId: caseId,
      badgeText: `✓ ارتقا به: ${stageLabels[nextStage]}`,
      canUndo: true
    });

    syncEngine.broadcast({
      type: 'IMPLANT_UPDATED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'مرحله ایمپلنت تغییر یافت',
      description: `کیس ایمپلنت به مرحله ${stageLabels[nextStage]} ارتقا یافت.`
    });
  };

  // Update Lab Status (Real-time synced across clinic terminals + bidirectional Implant & Reminder sync)
  const handleUpdateLabStatus = (orderId: string, status: any) => {
    const prevPatients = patients;
    const extractToothCode = (txt?: string) => (txt || '').match(/[A-Z]{2}[1-8]/i)?.[0]?.toUpperCase() || '';
    const labStatusLabels: Record<string, string> = {
      sent: '۱. ارسال به لابراتوار',
      fabrication: '۲. در حال تراش و ساخت',
      frame_try_in: '۳. تست فریم در مطب',
      ready_for_clinic: '۴. آماده تحویل در مطب',
      delivered_cemented: '۵. سمان و تحویل نهایی'
    };
    let oldLabLabel = '';
    let orderTitle = '';
    let targetOrderAfterUpdate: LabOrder | undefined;
    const syncedImplantIdsToComplete: string[] = [];
    const todayDateStr = getCurrentPersianDate();

    const updated = patients.map(p => {
      const foundOrder = p.labOrders.find(o => o.id === orderId);
      if (foundOrder) {
        oldLabLabel = labStatusLabels[foundOrder.status] || foundOrder.status;
        orderTitle = `${foundOrder.workType} (${foundOrder.patientName})`;
        const orderToothCode = extractToothCode(foundOrder.toothNumber);
        const isImplantProsthesis = /ایمپلنت|اباتمنت|فریم/i.test(foundOrder.workType || '');

        const nextLabOrders = p.labOrders.map(o => {
          if (o.id !== orderId) return o;
          const nextOrder: LabOrder = {
            ...o,
            status,
            ...(status === 'ready_for_clinic' ? { receivedAtClinicDate: todayDateStr } : {}),
            ...(status === 'delivered_cemented' ? { deliveredToPatientDate: todayDateStr } : {})
          };
          targetOrderAfterUpdate = nextOrder;
          return nextOrder;
        });

        // Bidirectionally advance linked ImplantCase when Lab prosthesis progresses or is delivered
        const nextImplantCases = (p.implantCases || []).map(imp => {
          const impCode = extractToothCode(imp.toothNumber);
          const sameTooth = orderToothCode && impCode ? orderToothCode === impCode : imp.toothNumber === foundOrder.toothNumber;
          if (!sameTooth && !isImplantProsthesis) return imp;

          if (status === 'delivered_cemented' && imp.currentStage !== 'crown_delivered') {
            syncedImplantIdsToComplete.push(imp.id);
            return { ...imp, currentStage: 'crown_delivered' as ImplantStage };
          }
          if (
            (status === 'frame_try_in' || status === 'ready_for_clinic') &&
            (imp.currentStage === 'fixture_placed' || imp.currentStage === 'healing_cap' || imp.currentStage === 'impression')
          ) {
            return { ...imp, currentStage: 'abutment_framework' as ImplantStage };
          }
          return imp;
        });

        const nextTeethConditions = { ...(p.teethConditions || {}) };
        if (status === 'delivered_cemented' && orderToothCode) {
          const palmerKey = `${orderToothCode.slice(0, 2)}_${orderToothCode.slice(2)}`;
          const existingCond = nextTeethConditions[palmerKey];
          if (existingCond && existingCond.status !== 'completed') {
            nextTeethConditions[palmerKey] = {
              ...existingCond,
              status: 'completed',
              notes: `${existingCond.notes ? `${existingCond.notes} · ` : ''}سمان و تحویل پروتز ${foundOrder.workType} (${todayDateStr})`,
              history: [
                {
                  treatment: existingCond.treatment,
                  surfaces: existingCond.surfaces,
                  status: existingCond.status,
                  cost: existingCond.cost || 0,
                  doctorName: existingCond.doctorName,
                  date: existingCond.date || todayDateStr,
                  notes: existingCond.notes
                },
                ...(existingCond.history || [])
              ].slice(0, 5)
            };
          }
        }

        return {
          ...p,
          labOrders: nextLabOrders,
          implantCases: nextImplantCases,
          teethConditions: nextTeethConditions
        };
      }
      return p;
    });
    setPatients(updated);

    const updatedPat = updated.find(p => p.labOrders.some(o => o.id === orderId));
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);

      if (status === 'ready_for_clinic' && targetOrderAfterUpdate) {
        void sendPhoneNotification({
          id: `lab-arrived-${orderId}`,
          title: `پروتز از لابراتوار دریافت شد: ${targetOrderAfterUpdate.patientName}`,
          body: `${targetOrderAfterUpdate.workType} (${targetOrderAfterUpdate.toothNumber}) به مطب رسید. نوبت تحویل/سمان تنظیم کنید.`,
          view: 'lab',
          patientId: updatedPat.id,
          requireInteraction: true
        });
        scheduleEntityReminder({
          sourceType: 'lab',
          sourceId: orderId,
          patientId: updatedPat.id,
          patientName: targetOrderAfterUpdate.patientName,
          patientPhone: updatedPat.phone,
          title: `نوبت تحویل/سمان پروتز دریافتی: ${targetOrderAfterUpdate.workType}`,
          description: `${targetOrderAfterUpdate.toothNumber} · دریافت شده از ${targetOrderAfterUpdate.labName}`,
          targetDate: todayDateStr,
          targetView: 'lab',
          config: { enabled: true, preset: 'at_time', channels: ['phone_push', 'in_app'] }
        });
        setLabArrivalPrompt({ patient: updatedPat, order: targetOrderAfterUpdate });
      } else if (status === 'delivered_cemented') {
        markReminderDone(`rem_lab_${orderId}`);
        markReminderDone(`rem-lab-${orderId}`);
        syncedImplantIdsToComplete.forEach(impId => markReminderDone(`rem_implant_${impId}`));
      }

      undoManager.register({
        title: `وضعیت لابراتوار تغییر یافت`,
        description: `${orderTitle} ← ${labStatusLabels[status] || status}`,
        undo: () => {
          setPatients(prevPatients);
        }
      });

      actionFeedback.recordSuccess({
        title: 'وضعیت سفارش لابراتوار به‌روزرسانی شد',
        subtitle: orderTitle,
        diffBefore: oldLabLabel,
        diffAfter: labStatusLabels[status] || status,
        targetRecordId: orderId,
        badgeText: `✓ مرحله جدید: ${labStatusLabels[status] || status}`,
        canUndo: true
      });

      syncEngine.broadcast({
        type: 'LAB_DISPATCHED',
        performedBy: currentUser.username,
        role: currentUser.role,
        platform: currentUser.assignedPlatform,
        title: 'وضعیت لابراتوار به‌روزرسانی شد',
        description: `سفارش کار لابراتوار بلادرنگ ارتقا یافت.`,
        payload: { orderId, status, patientId: updatedPat.id }
      });
    }
  };

  // Edit Implant Case Details
  const handleEditImplantCase = (caseId: string, updatedFields: Partial<ImplantCase>) => {
    const prevPatients = patients;
    let targetCase: ImplantCase | undefined;
    const updated = patients.map(p => {
      const found = (p.implantCases || []).find(c => c.id === caseId);
      if (found) {
        targetCase = { ...found, ...updatedFields };
        return {
          ...p,
          implantCases: (p.implantCases || []).map(c => c.id === caseId ? { ...c, ...updatedFields } : c)
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => (p.implantCases || []).some(c => c.id === caseId));
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    if (targetCase) {
      if (targetCase.reminderConfig?.enabled) {
        scheduleEntityReminder({
          sourceType: 'implant',
          sourceId: targetCase.id,
          patientId: targetCase.patientId,
          patientName: targetCase.patientName,
          patientPhone: updatedPat?.phone,
          title: `پیگیری ایمپلنت ${targetCase.brand} (${targetCase.toothNumber})`,
          description: `موعد هیلینگ و قالب‌گیری`,
          targetDate: targetCase.healingDueDate,
          targetView: 'implant',
          config: targetCase.reminderConfig
        });
      }
      undoManager.register({
        title: `کیس ایمپلنت ${targetCase.patientName} ویرایش شد`,
        description: `${updatedFields.brand || targetCase.brand} · دندان ${updatedFields.toothNumber || targetCase.toothNumber}`,
        undo: () => setPatients(prevPatients)
      });
      actionFeedback.recordSuccess({
        title: `مشخصات جراحی ایمپلنت «${targetCase.patientName}» ویرایش شد`,
        subtitle: `برند: ${updatedFields.brand || targetCase.brand} · دندان: ${updatedFields.toothNumber || targetCase.toothNumber}`,
        diffAfter: `ابعاد Ø${updatedFields.diameter || targetCase.diameter}×${updatedFields.length || targetCase.length} · تورک ${updatedFields.torque ?? targetCase.torque} N/cm`,
        targetRecordId: caseId,
        badgeText: '✓ مشخصات فیکسچر ویرایش شد',
        canUndo: true
      });
    }
  };

  // Delete Implant Case (Manager-Only + Soft-Delete Vault + Undo)
  const handleDeleteImplantCase = (caseId: string) => {
    if (!verifyManagerDeletion(currentUser, 'حذف کیس جراحی ایمپلنت', caseId)) {
      return;
    }
    const prevPatients = patients;
    let deletedCase: ImplantCase | undefined;
    const updated = patients.map(p => {
      const found = (p.implantCases || []).find(c => c.id === caseId);
      if (found) {
        deletedCase = found;
        return {
          ...p,
          implantCases: (p.implantCases || []).filter(c => c.id !== caseId)
        };
      }
      return p;
    });
    if (!deletedCase) return;
    archiveToTrashVault({
      entityType: 'implant_case',
      entityId: caseId,
      parentPatientId: deletedCase.patientId,
      title: `کیس ایمپلنت ${deletedCase.patientName}`,
      subtitle: `${deletedCase.brand} · دندان ${deletedCase.toothNumber}`,
      payload: deletedCase,
      deletedByUser: currentUser
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === deletedCase?.patientId);
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    undoManager.register({
      title: `کیس ایمپلنت ${deletedCase.patientName} بایگانی شد`,
      description: `${deletedCase.brand} (${deletedCase.toothNumber})`,
      undo: () => setPatients(prevPatients)
    });
    actionFeedback.recordSuccess({
      title: `کیس ایمپلنت «${deletedCase.patientName}» به بایگانی مدیر منتقل شد`,
      subtitle: `دندان ${deletedCase.toothNumber}`,
      diffAfter: 'انتقال به گاوصندوق حذفیات مدیر (قابل بازیابی)',
      targetRecordId: caseId,
      badgeText: '✓ کیس ایمپلنت بایگانی شد',
      canUndo: true
    });
  };

  // Edit Lab Order Details
  const handleEditLabOrder = (orderId: string, updatedFields: Partial<LabOrder>) => {
    const prevPatients = patients;
    let targetOrder: LabOrder | undefined;
    const updated = patients.map(p => {
      const found = (p.labOrders || []).find(o => o.id === orderId);
      if (found) {
        targetOrder = found;
        return {
          ...p,
          labOrders: (p.labOrders || []).map(o => o.id === orderId ? { ...o, ...updatedFields } : o)
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => (p.labOrders || []).some(o => o.id === orderId));
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    if (targetOrder) {
      const mergedOrder = { ...targetOrder, ...updatedFields };
      if (mergedOrder.reminderConfig?.enabled) {
        scheduleEntityReminder({
          sourceType: 'lab',
          sourceId: mergedOrder.id,
          patientId: mergedOrder.patientId,
          patientName: mergedOrder.patientName,
          patientPhone: updatedPat?.phone,
          title: `پیگیری لابراتوار: ${mergedOrder.workType}`,
          description: `${mergedOrder.toothNumber} · ${mergedOrder.labName}`,
          targetDate: mergedOrder.deliveryDate,
          targetView: 'lab',
          config: mergedOrder.reminderConfig
        });
      }
      undoManager.register({
        title: `سفارش لابراتوار ${targetOrder.patientName} ویرایش شد`,
        description: `${updatedFields.workType || targetOrder.workType} · شید ${updatedFields.shade || targetOrder.shade}`,
        undo: () => setPatients(prevPatients)
      });
      actionFeedback.recordSuccess({
        title: `سفارش لابراتوار «${targetOrder.patientName}» ویرایش شد`,
        subtitle: `${updatedFields.labName || targetOrder.labName} · شید رنگ: ${updatedFields.shade || targetOrder.shade}`,
        diffAfter: `هزینه: ${formatToman(updatedFields.cost ?? targetOrder.cost ?? 0)} · تحویل: ${updatedFields.deliveryDate || targetOrder.deliveryDate}`,
        targetRecordId: orderId,
        badgeText: '✓ سفارش لابراتوار ویرایش شد',
        canUndo: true
      });
    }
  };

  // Delete Lab Order (Manager-Only + Soft-Delete Vault + Undo)
  const handleDeleteLabOrder = (orderId: string) => {
    if (!verifyManagerDeletion(currentUser, 'حذف سفارش لابراتوار', orderId)) {
      return;
    }
    const prevPatients = patients;
    let deletedOrder: LabOrder | undefined;
    const updated = patients.map(p => {
      const found = (p.labOrders || []).find(o => o.id === orderId);
      if (found) {
        deletedOrder = found;
        return {
          ...p,
          labOrders: (p.labOrders || []).filter(o => o.id !== orderId)
        };
      }
      return p;
    });
    if (!deletedOrder) return;
    archiveToTrashVault({
      entityType: 'lab_order',
      entityId: orderId,
      parentPatientId: deletedOrder.patientId,
      title: `سفارش لابراتوار ${deletedOrder.patientName}`,
      subtitle: `${deletedOrder.workType} · ${deletedOrder.labName}`,
      payload: deletedOrder,
      deletedByUser: currentUser
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === deletedOrder?.patientId);
    if (selectedPatient && updatedPat && selectedPatient.id === updatedPat.id) {
      setSelectedPatient(updatedPat);
    }
    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
    undoManager.register({
      title: `سفارش لابراتوار ${deletedOrder.patientName} بایگانی شد`,
      description: `${deletedOrder.workType}`,
      undo: () => setPatients(prevPatients)
    });
    actionFeedback.recordSuccess({
      title: `سفارش لابراتوار «${deletedOrder.patientName}» به بایگانی مدیر منتقل شد`,
      subtitle: deletedOrder.workType,
      diffAfter: 'انتقال به گاوصندوق حذفیات مدیر (قابل بازیابی)',
      targetRecordId: orderId,
      badgeText: '✓ سفارش بایگانی شد',
      canUndo: true
    });
  };

  const syncPatientNextAppointment = (
    nextApts: Appointment[],
    targetPatientId?: string,
    targetPhone?: string,
    targetName?: string
  ) => {
    const todayStr = getCurrentPersianDate();
    const last7 = normalizePhoneLast7(targetPhone || '');
    const matchedPatient =
      (targetPatientId ? patientIndex.byId.get(targetPatientId) : undefined) ||
      (last7.length >= 7 ? patients.find(p => normalizePhoneLast7(p.phone) === last7) : undefined) ||
      (targetName ? patients.find(p => p.fullName.trim() === targetName.trim()) : undefined);

    if (!matchedPatient) return;

    const futureActive = nextApts
      .filter(a => {
        if (a.status === 'cancelled' || a.status === 'completed' || a.status === 'no_show') return false;
        const aLast7 = normalizePhoneLast7(a.phone || '');
        const belongs =
          a.patientId === matchedPatient.id ||
          (last7.length >= 7 && aLast7 === last7) ||
          a.patientName.trim() === matchedPatient.fullName.trim();
        return belongs && comparePersianDates(a.date, todayStr) >= 0;
      })
      .sort((a, b) => {
        const d = comparePersianDates(a.date, b.date);
        return d !== 0 ? d : a.time.localeCompare(b.time);
      });

    const nextStr = futureActive[0] ? `${futureActive[0].date} - ساعت ${futureActive[0].time}` : undefined;
    if (matchedPatient.nextAppointment === nextStr) return;

    const updatedPat: Patient = { ...matchedPatient, nextAppointment: nextStr };
    setPatients(prev => prev.map(p => (p.id === updatedPat.id ? updatedPat : p)));
    if (selectedPatient?.id === updatedPat.id) setSelectedPatient(updatedPat);
    indexedDbService.savePatient(updatedPat).catch(() => {});
    supabaseService.savePatient(updatedPat).catch(() => {});
  };

  // Add Appointment (Instantly synced)
  const handleAddAppointment = (newAptData: Omit<Appointment, 'id'>) => {
    const newApt: Appointment = {
      ...newAptData,
      unit: normalizeClinicUnitName(newAptData.unit),
      id: `apt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    };
    const prevApts = appointments;
    const nextApts = [newApt, ...appointments];
    setAppointments(prev => [newApt, ...prev]);
    syncPatientNextAppointment(nextApts, newApt.patientId, newApt.phone, newApt.patientName);

    if (newApt.reminderConfig?.enabled) {
      scheduleEntityReminder({
        sourceType: 'appointment',
        sourceId: newApt.id,
        patientId: newApt.patientId,
        patientName: newApt.patientName,
        patientPhone: newApt.phone,
        title: `نوبت مطب (${newApt.time}): ${newApt.treatment}`,
        description: `${newApt.unit} · ${newApt.doctor}`,
        targetDate: newApt.date,
        targetTime: newApt.time,
        targetView: 'appointments',
        config: newApt.reminderConfig
      });
    }

    // Register Undo Action
    undoManager.register({
      title: 'نوبت جدید ثبت شد',
      description: `${newApt.patientName} · ساعت ${newApt.time}`,
      undo: () => {
        setAppointments(prevApts);
      }
    });

    actionFeedback.recordSuccess({
      title: `نوبت جدید برای «${newApt.patientName}» ثبت شد`,
      subtitle: `${newApt.unit} · ساعت ${newApt.time} · ${newApt.treatment}`,
      diffAfter: `رزرو قطعی در ${newApt.unit} ساعت ${newApt.time}`,
      targetRecordId: newApt.id,
      badgeText: `✓ نوبت جدید در ساعت ${newApt.time} ثبت شد`,
      canUndo: true
    });

    // Persist to Supabase Cloud, IndexedDB & Offline Outbox Queue
    supabaseService.saveAppointment(newApt);
    indexedDbService.saveAppointment(newApt);
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'appointment',
      action: 'UPSERT',
      payload: newApt,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'APPOINTMENT_SCHEDULED',
      title: 'نوبت جدید ثبت شد',
      description: `نوبت ساعت ${newApt.time} برای ${newApt.patientName} در ${newApt.unit} با موفقیت ثبت شد.`
    });
  };

  // Update Appointment Status
  const handleUpdateAppointmentStatus = (id: string, status: Appointment['status'], reason?: string) => {
    const prevApts = appointments;
    const targetApt = appointments.find(a => a.id === id);
    const updatedApts = appointments.map(a => {
      if (a.id !== id) return a;
      return {
        ...a,
        status,
        ...(status === 'waiting' ? { waitingStartedAt: a.waitingStartedAt || new Date().toISOString() } : {}),
        ...(status === 'in_chair' ? { chairStartedAt: a.chairStartedAt || new Date().toISOString() } : {}),
        ...((status === 'cancelled' || status === 'no_show') && reason !== undefined ? { cancellationReason: reason } : {})
      };
    });
    setAppointments(updatedApts);

    if (status === 'completed' || status === 'cancelled' || status === 'no_show') {
      markReminderDone(`rem-appointment-${id}`);
    }

    const statusLabels: Record<Appointment['status'], string> = {
      scheduled: 'رزرو شده',
      waiting: 'حاضر در سالن انتظار',
      in_chair: 'روی یونیت (در حال درمان)',
      completed: 'درمان انجام شد (مختومه)',
      cancelled: 'لغو شده',
      no_show: 'عدم حضور بیمار'
    };

    const updatedApt = updatedApts.find(a => a.id === id);
    if (targetApt && updatedApt) {
      supabaseService.saveAppointment(updatedApt);
      indexedDbService.saveAppointment(updatedApt);
      syncEngine.recordOfflineOrLiveMutation({
        entity: 'appointment',
        action: 'UPSERT',
        payload: updatedApt,
        actorName: currentUser.username,
        actorRole: currentUser.role,
        platform: currentUser.assignedPlatform,
        eventType: 'APPOINTMENT_SCHEDULED',
        title: `تغییر وضعیت نوبت ${targetApt.patientName}`,
        description: `وضعیت نوبت به «${statusLabels[status]}» تغییر یافت.`
      });
      syncPatientNextAppointment(updatedApts, updatedApt.patientId, updatedApt.phone, updatedApt.patientName);

      undoManager.register({
        title: 'وضعیت نوبت تغییر یافت',
        description: `${targetApt.patientName} به ${statusLabels[status]}`,
        undo: () => {
          setAppointments(prevApts);
          supabaseService.saveAppointment(targetApt);
          indexedDbService.saveAppointment(targetApt);
        }
      });

      actionFeedback.recordSuccess({
        title: `وضعیت نوبت «${targetApt.patientName}» تغییر یافت`,
        subtitle: `${targetApt.unit} · ساعت ${targetApt.time}`,
        diffBefore: statusLabels[targetApt.status],
        diffAfter: statusLabels[status],
        targetRecordId: id,
        badgeText: `✓ وضعیت جدید: ${statusLabels[status]}`,
        canUndo: true
      });
    }
  };

  // Move Appointment between units, time slots or dates seamlessly
  const handleMoveAppointment = (id: string, newUnit: string, newTime?: string, newDate?: string) => {
    const prevApts = appointments;
    const oldApt = appointments.find(a => a.id === id);
    const normalizedUnit = normalizeClinicUnitName(newUnit);
    let movedPatientName = '';
    const updated = appointments.map(a => {
      if (a.id === id) {
        movedPatientName = a.patientName;
        return {
          ...a,
          unit: normalizedUnit,
          ...(newTime ? { time: newTime } : {}),
          ...(newDate ? { date: newDate } : {})
        };
      }
      return a;
    });

    setAppointments(updated);

    const moved = updated.find(a => a.id === id);
    if (moved) {
      supabaseService.saveAppointment(moved);
      indexedDbService.saveAppointment(moved);
      syncEngine.recordOfflineOrLiveMutation({
        entity: 'appointment',
        action: 'UPSERT',
        payload: moved,
        actorName: currentUser.username,
        actorRole: currentUser.role,
        platform: currentUser.assignedPlatform,
        eventType: 'APPOINTMENT_SCHEDULED',
        title: 'جابجایی نوبت بیمار در یونیت‌ها',
        description: `نوبت ${movedPatientName || 'بیمار'} به ${normalizedUnit} (${moved.date} ساعت ${moved.time}) منتقل شد.`
      });
      syncPatientNextAppointment(updated, moved.patientId, moved.phone, moved.patientName);

      if (moved.reminderConfig?.enabled && moved.status !== 'completed' && moved.status !== 'cancelled' && moved.status !== 'no_show') {
        scheduleEntityReminder({
          sourceType: 'appointment',
          sourceId: moved.id,
          patientId: moved.patientId,
          patientName: moved.patientName,
          patientPhone: moved.phone,
          title: `نوبت مطب (${moved.time}): ${moved.treatment}`,
          description: `${moved.unit} · ${moved.doctor}`,
          targetDate: moved.date,
          targetTime: moved.time,
          targetView: 'appointments',
          config: moved.reminderConfig
        });
      }
    }

    if (oldApt) {
      undoManager.register({
        title: `نوبت ${oldApt.patientName} جابجا شد`,
        description: `${oldApt.unit} (${oldApt.time}) ← ${normalizedUnit} (${newTime || oldApt.time})`,
        undo: () => {
          setAppointments(prevApts);
          supabaseService.saveAppointment(oldApt);
          indexedDbService.saveAppointment(oldApt);
        }
      });

      actionFeedback.recordSuccess({
        title: `نوبت «${oldApt.patientName}» با موفقیت جابجا شد`,
        subtitle: `${newDate && newDate !== oldApt.date ? `تاریخ جدید: ${newDate}` : 'انتقال بین یونیت‌ها / تغییر ساعت نوبت'}`,
        diffBefore: `${oldApt.unit} · ${oldApt.date} ساعت ${oldApt.time}`,
        diffAfter: `${normalizedUnit} · ${newDate || oldApt.date} ساعت ${newTime || oldApt.time}`,
        targetRecordId: id,
        badgeText: `✓ منتقل شد به ${normalizedUnit} ساعت ${newTime || oldApt.time}`,
        canUndo: true
      });
    }
  };

  // Batch Shift Unit Appointments (Cascade Delay Handling)
  const handleBatchShiftAppointments = (updates: Array<{ id: string; time: string }>, unitLabel?: string) => {
    if (updates.length === 0) return;
    const prevApts = appointments;
    const map = new Map(updates.map(u => [u.id, u.time]));
    const updated = appointments.map(a => (map.has(a.id) ? { ...a, time: map.get(a.id)! } : a));
    setAppointments(updated);

    const changed = updated.filter(a => map.has(a.id));
    changed.forEach(apt => {
      supabaseService.saveAppointment(apt);
      indexedDbService.saveAppointment(apt);
      syncEngine.recordOfflineOrLiveMutation({
        entity: 'appointment',
        action: 'UPSERT',
        payload: apt,
        actorName: currentUser.username,
        actorRole: currentUser.role,
        platform: currentUser.assignedPlatform,
        eventType: 'APPOINTMENT_SCHEDULED',
        title: `شیفت تاخیر نوبت ${apt.patientName}`,
        description: `ساعت نوبت به ${apt.time} منتقل شد.`
      });
      if (apt.reminderConfig?.enabled) {
        scheduleEntityReminder({
          sourceType: 'appointment',
          sourceId: apt.id,
          patientId: apt.patientId,
          patientName: apt.patientName,
          patientPhone: apt.phone,
          title: `نوبت مطب (${apt.time}): ${apt.treatment}`,
          description: `${apt.unit} · ${apt.doctor}`,
          targetDate: apt.date,
          targetTime: apt.time,
          targetView: 'appointments',
          config: apt.reminderConfig
        });
      }
    });

    undoManager.register({
      title: `شیفت زمان نوبت‌های ${unitLabel || 'یونیت'}`,
      description: `${toPersianDigits(changed.length)} نوبت جابجا شد`,
      undo: () => {
        setAppointments(prevApts);
        prevApts.filter(a => map.has(a.id)).forEach(a => {
          supabaseService.saveAppointment(a);
          indexedDbService.saveAppointment(a);
        });
      }
    });

    actionFeedback.recordSuccess({
      title: `${toPersianDigits(changed.length)} نوبت ${unitLabel || ''} با موفقیت شیفت داده شد`,
      subtitle: 'به‌روزرسانی همزمان در تقویم، یادآوری و ترمینال پذیرش',
      badgeText: `✓ ${toPersianDigits(changed.length)} نوبت شیفت داده شد`,
      canUndo: true
    });
  };

  // Full Edit Appointment Details
  const handleEditAppointment = (id: string, updatedFields: Partial<Appointment>) => {
    const prevApts = appointments;
    const oldApt = appointments.find(a => a.id === id);
    if (!oldApt) return;
    const updatedApt: Appointment = {
      ...oldApt,
      ...updatedFields,
      unit: normalizeClinicUnitName(updatedFields.unit || oldApt.unit)
    };
    const nextApts = appointments.map(a => a.id === id ? updatedApt : a);
    setAppointments(nextApts);
    supabaseService.saveAppointment(updatedApt);
    indexedDbService.saveAppointment(updatedApt);
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'appointment',
      action: 'UPSERT',
      payload: updatedApt,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'APPOINTMENT_SCHEDULED',
      title: `ویرایش نوبت ${updatedApt.patientName}`,
      description: `${updatedApt.unit} · ${updatedApt.date} ساعت ${updatedApt.time}`
    });
    syncPatientNextAppointment(nextApts, updatedApt.patientId, updatedApt.phone, updatedApt.patientName);

    if (updatedApt.status === 'completed' || updatedApt.status === 'cancelled' || updatedApt.status === 'no_show') {
      markReminderDone(`rem-appointment-${updatedApt.id}`);
    } else if (updatedApt.reminderConfig?.enabled) {
      scheduleEntityReminder({
        sourceType: 'appointment',
        sourceId: updatedApt.id,
        patientId: updatedApt.patientId,
        patientName: updatedApt.patientName,
        patientPhone: updatedApt.phone,
        title: `نوبت مطب (${updatedApt.time}): ${updatedApt.treatment}`,
        description: `${updatedApt.unit} · ${updatedApt.doctor}`,
        targetDate: updatedApt.date,
        targetTime: updatedApt.time,
        targetView: 'appointments',
        config: updatedApt.reminderConfig
      });
    }

    undoManager.register({
      title: `نوبت ${updatedApt.patientName} ویرایش شد`,
      description: `${updatedApt.unit} · ساعت ${updatedApt.time}`,
      undo: () => {
        setAppointments(prevApts);
        supabaseService.saveAppointment(oldApt);
        indexedDbService.saveAppointment(oldApt);
      }
    });

    actionFeedback.recordSuccess({
      title: `مشخصات نوبت «${updatedApt.patientName}» ویرایش شد`,
      subtitle: `${updatedApt.unit} · ${updatedApt.doctor} · ${updatedApt.treatment}`,
      diffBefore: `${oldApt.date} ساعت ${oldApt.time}`,
      diffAfter: `${updatedApt.date} ساعت ${updatedApt.time}`,
      targetRecordId: id,
      badgeText: `✓ نوبت ویرایش شد (${updatedApt.time})`,
      canUndo: true
    });
  };

  // Delete Appointment (Manager-Only + Soft-Delete Vault + Undo)
  const handleDeleteAppointment = (id: string) => {
    if (!verifyManagerDeletion(currentUser, 'حذف نوبت بیمار', id)) {
      return;
    }
    const prevApts = appointments;
    const targetApt = appointments.find(a => a.id === id);
    if (!targetApt) return;

    archiveToTrashVault({
      entityType: 'appointment',
      entityId: id,
      parentPatientId: targetApt.patientId,
      title: `نوبت ${targetApt.patientName}`,
      subtitle: `${targetApt.date} ساعت ${targetApt.time} · ${targetApt.unit}`,
      payload: targetApt,
      deletedByUser: currentUser
    });

    markReminderDone(`rem-appointment-${id}`);
    const remainingApts = appointments.filter(a => a.id !== id);
    setAppointments(remainingApts);
    indexedDbService.deleteAppointmentById(id, currentUser).catch(() => {});
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'appointment',
      action: 'DELETE',
      payload: { id },
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'APPOINTMENT_SCHEDULED',
      title: `بایگانی نوبت ${targetApt.patientName}`,
      description: `نوبت ${targetApt.date} ساعت ${targetApt.time} از جدول فعال حذف و بایگانی شد.`
    });
    syncPatientNextAppointment(remainingApts, targetApt.patientId, targetApt.phone, targetApt.patientName);

    undoManager.register({
      title: `نوبت ${targetApt.patientName} بایگانی شد`,
      description: `ساعت ${targetApt.time} · ${targetApt.unit}`,
      undo: () => {
        setAppointments(prevApts);
        indexedDbService.saveAppointment(targetApt);
        supabaseService.saveAppointment(targetApt);
      }
    });

    actionFeedback.recordSuccess({
      title: `نوبت «${targetApt.patientName}» به بایگانی مدیر منتقل شد`,
      subtitle: `ساعت ${targetApt.time} · ${targetApt.unit}`,
      diffAfter: 'انتقال به گاوصندوق حذفیات مدیر (قابل بازیابی)',
      targetRecordId: id,
      badgeText: '✓ نوبت بایگانی شد',
      canUndo: true
    });
  };

  // Add New Patient (Manual file number support & auto-incrementation)
  const handleAddNewPatient = (newPat: any): Patient => {
    const prevPatients = patients;
    const finalFileNumber = newPat.fileNumber || getNextFileNumber(getLatestFileNumber(patients));
    recordLastFileNumber(finalFileNumber);

    const created: Patient = {
      ...newPat,
      id: `pat-${Date.now()}`,
      fileNumber: finalFileNumber,
      totalCost: 0,
      paidAmount: 0,
      balance: 0,
      activeTreatmentsCount: 0,
      lastVisit: getCurrentPersianDate(),
      teethConditions: {},
      sayadChecks: [],
      installments: [],
      labOrders: [],
      implantCases: [],
      payments: []
    };
    setPatients(prev => [created, ...prev]);
    setSelectedPatient(created);

    undoManager.register({
      title: `پرونده بیمار ${created.fullName} تشکیل شد`,
      description: `شماره پرونده: ${created.fileNumber}`,
      undo: () => {
        setPatients(prevPatients);
        setSelectedPatient(null);
      }
    });

    actionFeedback.recordSuccess({
      title: `پرونده بیمار جدید «${created.fullName}» ثبت شد`,
      subtitle: `تلفن: ${created.phone} · بیمه: ${newPat.insurance || 'آزاد'}`,
      diffAfter: `شماره پرونده: ${created.fileNumber}`,
      targetRecordId: created.id,
      badgeText: `✓ پرونده جدید (${created.fileNumber}) ثبت شد`,
      canUndo: true
    });

    // Persist to Supabase Cloud, IndexedDB & Offline Outbox
    supabaseService.savePatient(created);
    indexedDbService.savePatient(created);
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'patient',
      action: 'UPSERT',
      payload: created,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      platform: currentUser.assignedPlatform,
      eventType: 'TREATMENT_REGISTERED',
      title: 'پرونده بیمار جدید تشکیل شد',
      description: `بیمار ${created.fullName} با شماره پرونده ${created.fileNumber} ثبت گردید.`
    });
    return created;
  };

  // Seamless Clinical Chain: Appointment -> Auto-find Patient or Quick-Register/Skip -> Palmer Chart
  const handleStartClinicalFlowFromApt = (apt: Appointment) => {
    const normalizedLast7 = normalizePhoneLast7(apt.phone);
    const matched =
      (apt.patientId ? patientIndex.byId.get(apt.patientId) : undefined) ||
      (normalizedLast7.length >= 7
        ? patients.find(p => normalizePhoneLast7(p.phone) === normalizedLast7)
        : undefined) ||
      patients.find(p => p.fullName.trim() === apt.patientName.trim());

    if (matched) {
      setSelectedPatient(matched);
      setPalmerChartOpen(true);
    } else {
      setQuickRegName(apt.patientName || '');
      setQuickRegPhone(apt.phone || '');
      setClinicalChainPromptApt(apt);
    }
  };

  // Update Patient File Number (Manual edit, updates auto-increment baseline)
  const handleUpdatePatientFileNumber = (patientId: string, newFileNumber: string) => {
    const trimmed = newFileNumber.trim();
    if (!trimmed) return;

    // Check for duplicate file number collision
    const duplicate = patients.find(p => p.id !== patientId && p.fileNumber === trimmed);
    if (duplicate) {
      actionFeedback.recordConflict({
        title: `شماره پرونده «${trimmed}» تکراری است!`,
        subtitle: `این شماره پرونده قبلاً برای «${duplicate.fullName}» ثبت شده است.`,
        targetRecordId: duplicate.id,
        badgeText: `⚠️ شماره پرونده ${trimmed} متعلق به این بیمار است`
      });
      return;
    }

    const prevPatients = patients;
    const oldPat = patients.find(p => p.id === patientId);
    recordLastFileNumber(trimmed);

    const updated = patients.map(p => {
      if (p.id === patientId) {
        return { ...p, fileNumber: trimmed };
      }
      return p;
    });

    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient({ ...selectedPatient, fileNumber: trimmed });
    }

    if (oldPat) {
      undoManager.register({
        title: `شماره پرونده ${oldPat.fullName} تغییر یافت`,
        description: `${oldPat.fileNumber} ← ${trimmed}`,
        undo: () => {
          setPatients(prevPatients);
        }
      });

      actionFeedback.recordSuccess({
        title: `شماره پرونده «${oldPat.fullName}» ویرایش شد`,
        diffBefore: `قبلی: ${oldPat.fileNumber}`,
        diffAfter: `جدید: ${trimmed}`,
        targetRecordId: patientId,
        badgeText: `✓ شماره پرونده به ${trimmed} تغییر یافت`,
        canUndo: true
      });
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
    }

    syncEngine.broadcast({
      type: 'TREATMENT_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'شماره پرونده بیمار ویرایش شد',
      description: `شماره پرونده به ${trimmed} تغییر یافت و دنباله نوبت‌دهی خودکار از این شماره ادامه می‌یابد.`
    });
  };

  // Full Patient Record Edit (Demographics, Phone, National ID, Age, Gender, Medical Alerts, Notes, File Number)
  const handleEditPatientRecord = (patientId: string, updatedFields: Partial<Patient>) => {
    const oldPat = patients.find(p => p.id === patientId);
    if (!oldPat) return;

    if (updatedFields.fileNumber && updatedFields.fileNumber.trim() !== oldPat.fileNumber) {
      const trimmedFile = updatedFields.fileNumber.trim();
      const duplicate = patients.find(p => p.id !== patientId && p.fileNumber === trimmedFile);
      if (duplicate) {
        actionFeedback.recordConflict({
          title: `شماره پرونده «${trimmedFile}» تکراری است!`,
          subtitle: `این شماره پرونده قبلاً برای «${duplicate.fullName}» ثبت شده است.`,
          targetRecordId: duplicate.id,
          badgeText: `⚠️ شماره پرونده ${trimmedFile} تکراری است`
        });
        return;
      }
      recordLastFileNumber(trimmedFile);
    }

    const prevPatients = patients;
    const updatedPat: Patient = {
      ...oldPat,
      ...updatedFields,
      fileNumber: updatedFields.fileNumber?.trim() || oldPat.fileNumber,
      fullName: updatedFields.fullName?.trim() || oldPat.fullName,
      phone: updatedFields.phone?.trim() || oldPat.phone
    };

    const updated = patients.map(p => (p.id === patientId ? updatedPat : p));
    setPatients(updated);

    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat);
    }

    // Also update any matching appointments with the new patient name/phone
    if (updatedPat.fullName !== oldPat.fullName || updatedPat.phone !== oldPat.phone) {
      setAppointments(prev =>
        prev.map(a =>
          a.patientId === patientId || a.patientName === oldPat.fullName
            ? { ...a, patientName: updatedPat.fullName, phone: updatedPat.phone }
            : a
        )
      );
    }

    supabaseService.savePatient(updatedPat);
    indexedDbService.savePatient(updatedPat);
    stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');

    if (typeof updatedFields.totalCost === 'number' && updatedFields.totalCost !== oldPat.totalCost) {
      auditTracker.recordTreatmentCostEdit({
        patientId: oldPat.id,
        patientName: updatedPat.fullName,
        fileNumber: updatedPat.fileNumber,
        treatmentTitle: 'جمع کل طرح درمان پرونده',
        previousCostToman: oldPat.totalCost,
        newCostToman: updatedFields.totalCost,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        reason: 'ویرایش هزینه درمانی یا اعمال تخفیف در پرونده بیمار'
      });
    }

    if (typeof updatedFields.paidAmount === 'number' && updatedFields.paidAmount < oldPat.paidAmount) {
      auditTracker.recordPaymentRefund({
        patientId: oldPat.id,
        patientName: updatedPat.fullName,
        fileNumber: updatedPat.fileNumber,
        refundAmountToman: oldPat.paidAmount - updatedFields.paidAmount,
        paymentMethod: 'برگشت وجه مالی پرونده',
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        reason: 'عودت وجه ثبت‌شده به بیمار در پرونده مالی'
      });
    }

    undoManager.register({
      title: `پرونده «${updatedPat.fullName}» ویرایش شد`,
      description: `شماره پرونده: ${updatedPat.fileNumber}`,
      undo: () => {
        setPatients(prevPatients);
        if (selectedPatient && selectedPatient.id === patientId) {
          setSelectedPatient(oldPat);
        }
        supabaseService.savePatient(oldPat);
        indexedDbService.savePatient(oldPat);
      }
    });

    actionFeedback.recordSuccess({
      title: `مشخصات پرونده «${updatedPat.fullName}» با موفقیت ویرایش شد`,
      subtitle: `پرونده: ${updatedPat.fileNumber} · همراه: ${updatedPat.phone}`,
      diffBefore: `${oldPat.fullName} (${oldPat.phone})`,
      diffAfter: `${updatedPat.fullName} (${updatedPat.phone})`,
      targetRecordId: patientId,
      badgeText: `✓ مشخصات پرونده به‌روزرسانی شد`,
      canUndo: true
    });
  };

  // Delete / Archive Patient Record (Strictly Clinic Manager Only + Soft-Delete Vault + 1-Tap Undo)
  const handleDeletePatientRecord = (patientId: string) => {
    if (!verifyManagerDeletion(currentUser, 'حذف کامل پرونده بیمار', patientId)) {
      return;
    }
    const targetPat = patients.find(p => p.id === patientId);
    if (!targetPat) return;

    const sensAudit = auditTracker.recordPatientDeletion({
      patientId: targetPat.id,
      patientName: targetPat.fullName,
      fileNumber: targetPat.fileNumber,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      reason: 'حذف پرونده بیمار و انتقال خودکار به گاوصندوق آرشیو امن مدیر'
    });

    archiveToTrashVault({
      entityType: 'patient',
      entityId: patientId,
      title: `پرونده بیمار: ${targetPat.fullName}`,
      subtitle: `شماره پرونده: ${targetPat.fileNumber} · تلفن: ${targetPat.phone} · Audit ID: ${sensAudit.auditId}`,
      payload: targetPat,
      deletedByUser: currentUser
    });

    const prevPatients = patients;
    const updated = patients.filter(p => p.id !== patientId);
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(null);
    }

    indexedDbService.deletePatientById(patientId, currentUser).catch(() => {});
    supabaseService.deletePatient(patientId, true).catch(() => {});
    stateSyncQueue.enqueue('patients', 'DELETE', { id: patientId }, 'local');

    undoManager.register({
      title: `پرونده «${targetPat.fullName}» بایگانی شد`,
      description: `شماره پرونده: ${targetPat.fileNumber} · شناسه ممیزی: ${sensAudit.auditId}`,
      undo: () => {
        setPatients(prevPatients);
        supabaseService.savePatient(targetPat);
        indexedDbService.savePatient(targetPat);
      }
    });

    actionFeedback.recordSuccess({
      title: `پرونده «${targetPat.fullName}» به بایگانی مدیر منتقل شد (${sensAudit.auditId})`,
      subtitle: `امکان بازیابی ۱۰۰٪ از گاوصندوق حذفیات در تنظیمات فعال است`,
      targetRecordId: patientId,
      badgeText: '✓ پرونده بایگانی شد',
      canUndo: true
    });
  };

  // Delete a specific tooth treatment from patient record (Strictly Clinic Manager Only + Soft-Delete Vault)
  const handleDeleteTreatmentFromTooth = (patientId: string, toothKey: string) => {
    if (!verifyManagerDeletion(currentUser, `حذف درمان دندان ${toothKey}`, `${patientId}:${toothKey}`)) {
      return;
    }
    const oldPat = patients.find(p => p.id === patientId);
    if (!oldPat || !oldPat.teethConditions[toothKey]) return;

    const prevPatients = patients;
    const removedCondition = oldPat.teethConditions[toothKey];
    const removedCost = removedCondition.cost || 0;

    archiveToTrashVault({
      entityType: 'treatment',
      entityId: `${patientId}:${toothKey}`,
      parentPatientId: patientId,
      title: `درمان دندان ${removedCondition.quadrant}${removedCondition.toothNumber} (${oldPat.fullName})`,
      subtitle: `نوع درمان: ${removedCondition.treatment} · هزینه: ${formatToman(removedCost)}`,
      payload: { patientId, toothKey, condition: removedCondition },
      deletedByUser: currentUser
    });

    const nextTeeth = { ...oldPat.teethConditions };
    delete nextTeeth[toothKey];

    const updatedPat: Patient = {
      ...oldPat,
      totalCost: Math.max(0, oldPat.totalCost - removedCost),
      balance: oldPat.balance + removedCost,
      activeTreatmentsCount: Object.values(nextTeeth).filter((c) => c.status !== 'completed').length,
      teethConditions: nextTeeth
    };

    const updated = patients.map(p => (p.id === patientId ? updatedPat : p));
    setPatients(updated);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat);
    }

    supabaseService.savePatient(updatedPat);
    indexedDbService.savePatient(updatedPat);
    stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');

    undoManager.register({
      title: `درمان دندان ${removedCondition.quadrant}${removedCondition.toothNumber} بایگانی شد`,
      description: `مبلغ ${formatToman(removedCost)} از بدهی بیمار کسر گردید`,
      undo: () => {
        setPatients(prevPatients);
        if (selectedPatient && selectedPatient.id === patientId) {
          setSelectedPatient(oldPat);
        }
        supabaseService.savePatient(oldPat);
        indexedDbService.savePatient(oldPat);
      }
    });

    actionFeedback.recordSuccess({
      title: `درمان دندان ${removedCondition.quadrant}${removedCondition.toothNumber} بایگانی و مانده اصلاح شد`,
      subtitle: `بیمار: ${oldPat.fullName}`,
      diffBefore: `جمع کل قبلی: ${formatToman(oldPat.totalCost)}`,
      diffAfter: `جمع کل جدید: ${formatToman(updatedPat.totalCost)}`,
      targetRecordId: patientId,
      badgeText: `✓ درمان بایگانی شد`,
      canUndo: true
    });
  };

  // Open Official Treatment Invoice Modal
  const handleOpenInvoice = (patient: Patient) => {
    setInvoicePatient(patient);
    setInvoiceModalOpen(true);
  };

  // Update specific treatment status (planned, in_progress, completed)
  const handleUpdateTreatmentStatus = (patientId: string, toothKey: string, status: ToothCondition['status']) => {
    const updated = patients.map(p => {
      if (p.id === patientId && p.teethConditions[toothKey]) {
        const nextTeeth = {
          ...p.teethConditions,
          [toothKey]: {
            ...p.teethConditions[toothKey],
            status
          }
        };
        return {
          ...p,
          activeTreatmentsCount: Object.values(nextTeeth).filter((c) => c.status !== 'completed').length,
          teethConditions: nextTeeth
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
    }
  };

  // Update specific treatment cost (Manager / Dr. Mehdi Amiri protected)
  const handleUpdateTreatmentCost = (patientId: string, toothKey: string, newCost: number) => {
    const targetPat = patients.find(p => p.id === patientId);
    const previousCost = targetPat?.teethConditions[toothKey]?.cost || 0;
    const treatmentLabel = targetPat?.teethConditions[toothKey]
      ? `دندان ${targetPat.teethConditions[toothKey].quadrant}${targetPat.teethConditions[toothKey].toothNumber} (${targetPat.teethConditions[toothKey].treatment})`
      : `دندان ${toothKey}`;

    if (targetPat && previousCost !== newCost) {
      auditTracker.recordTreatmentCostEdit({
        patientId: targetPat.id,
        patientName: targetPat.fullName,
        fileNumber: targetPat.fileNumber,
        treatmentTitle: treatmentLabel,
        previousCostToman: previousCost,
        newCostToman: newCost,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        reason: `ویرایش تعرفه درمانی ${treatmentLabel} با مجوز مدیریت`
      });
    }

    const updated = patients.map(p => {
      if (p.id === patientId && p.teethConditions[toothKey]) {
        const oldCost = p.teethConditions[toothKey].cost || 0;
        const diff = newCost - oldCost;
        return {
          ...p,
          totalCost: Math.max(0, p.totalCost + diff),
          balance: p.balance - diff,
          teethConditions: {
            ...p.teethConditions,
            [toothKey]: {
              ...p.teethConditions[toothKey],
              cost: newCost
            }
          }
        };
      }
      return p;
    });

    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');
    }

    syncEngine.broadcast({
      type: 'TREATMENT_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'تعرفه درمان با مجوز مدیریت اصلاح شد',
      description: `تعرفه دندان در پرونده ${updatedPat?.fullName || 'بیمار'} به ${formatToman(newCost)} به‌روز شد.`
    });
  };

  // Add Dental Prescription to Patient File
  const handleAddPrescription = (patientId: string, newRx: DentalPrescription) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        return {
          ...p,
          prescriptions: [newRx, ...(p.prescriptions || [])]
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
    }
  };

  // Toggle Patient Legal Consent
  const handleToggleConsent = (patientId: string, consentId: string) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        const existing = p.consents || [];
        const found = existing.find(c => c.id === consentId);
        const nextConsents = found
          ? existing.map(c => c.id === consentId ? { ...c, isConfirmed: !c.isConfirmed } : c)
          : [...existing, { id: consentId, patientId, procedureType: 'general' as const, title: 'رضایت‌نامه درمان', signedDate: getCurrentPersianDate(), isConfirmed: true }];
        return {
          ...p,
          consents: nextConsents
        };
      }
      return p;
    });
    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }
  };

  // Save Legal Digital Signature with Cryptographic Hash & Date
  const handleSaveConsentSignature = (
    patientId: string,
    consentId: string,
    signatureDataUrl: string,
    timestamp: string,
    cryptoHash?: string
  ) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        const existing = p.consents || [];
        const found = existing.find(c => c.id === consentId);
        const consentData: PatientConsent = {
          id: consentId,
          patientId,
          procedureType: found?.procedureType || 'general',
          title: found?.title || 'رضایت‌نامه آگاهانه درمانی',
          signedDate: getCurrentPersianDate(),
          isConfirmed: true,
          signatureDataUrl,
          timestamp,
          cryptoHash
        };
        const nextConsents = found
          ? existing.map(c => c.id === consentId ? { ...c, ...consentData } : c)
          : [...existing, consentData];
        return {
          ...p,
          consents: nextConsents
        };
      }
      return p;
    });

    setPatients(updated);
    const updatedPat = updated.find(p => p.id === patientId);
    if (selectedPatient && selectedPatient.id === patientId) {
      setSelectedPatient(updatedPat || null);
    }

    if (updatedPat) {
      supabaseService.savePatient(updatedPat);
      indexedDbService.savePatient(updatedPat);
    }

    syncEngine.broadcast({
      type: 'TREATMENT_REGISTERED',
      performedBy: currentUser.username,
      role: currentUser.role,
      platform: currentUser.assignedPlatform,
      title: 'امضای الکترونیکی و قانونی بیمار ثبت شد',
      description: `رضایت‌نامه درمان بیمار ${updatedPat?.fullName || ''} با اثر انگشت/قلم لمسی و هش رمزنگاری SHA-256 ذخیره گردید.`
    });
  };

  // Staff Auth & RBAC handlers delegated to useClinicAuth() hook

  // Protected Inventory Batch Update (prevents unauthorized inventory item deletion)
  const handleProtectedInventoryBatchUpdate = (nextInventory: InventoryItem[]) => {
    const nextIds = new Set(nextInventory.map(i => i.id));
    const removedItems = inventory.filter(i => !nextIds.has(i.id));
    if (removedItems.length > 0) {
      if (!verifyManagerDeletion(currentUser, `حذف ${removedItems.length} قلم کالا از انبار`, removedItems[0].id)) {
        return;
      }
      removedItems.forEach(item => {
        archiveToTrashVault({
          entityType: 'inventory_item',
          entityId: item.id,
          title: `کالای انبار: ${item.name}`,
          subtitle: `موجودی: ${item.stock} ${item.unit}`,
          payload: item,
          deletedByUser: currentUser
        });
      });
    }
    setInventory(nextInventory);
  };

  // Manager-Only Restore from Soft-Delete Trash Vault
  const handleRestoreFromTrashVault = (item: TrashVaultItem) => {
    if (!verifyManagerDeletion(currentUser, `بازیابی از گاوصندوق حذفیات: ${item.title}`, item.entityId)) {
      return;
    }

    if (item.entityType === 'patient' && item.payload) {
      const restoredPatient = item.payload as Patient;
      setPatients(prev => [restoredPatient, ...prev.filter(p => p.id !== restoredPatient.id)]);
      indexedDbService.savePatient(restoredPatient).catch(() => {});
      supabaseService.savePatient(restoredPatient).catch(() => {});
    } else if (item.entityType === 'treatment' && item.payload?.patientId && item.payload?.toothKey) {
      const { patientId, toothKey, condition } = item.payload as {
        patientId: string;
        toothKey: string;
        condition: ToothCondition;
      };
      const addedCost = condition.cost || 0;
      setPatients(prev => prev.map(p => {
        if (p.id !== patientId) return p;
        const nextTeeth = { ...p.teethConditions, [toothKey]: condition };
        const updatedPat: Patient = {
          ...p,
          totalCost: p.totalCost + addedCost,
          balance: p.balance - addedCost,
          activeTreatmentsCount: Object.keys(nextTeeth).length,
          teethConditions: nextTeeth
        };
        indexedDbService.savePatient(updatedPat).catch(() => {});
        supabaseService.savePatient(updatedPat).catch(() => {});
        return updatedPat;
      }));
    } else if (item.entityType === 'check' && item.payload) {
      const check = item.payload as SayadCheck;
      setPatients(prev => prev.map(p => {
        if (p.id !== check.patientId) return p;
        const updatedPat = { ...p, sayadChecks: [check, ...(p.sayadChecks || []).filter(c => c.id !== check.id)] };
        indexedDbService.savePatient(updatedPat).catch(() => {});
        supabaseService.savePatient(updatedPat).catch(() => {});
        return updatedPat;
      }));
    } else if (item.entityType === 'lab_order' && item.payload) {
      const order = item.payload as LabOrder;
      setPatients(prev => prev.map(p => {
        if (p.id !== order.patientId) return p;
        const updatedPat = { ...p, labOrders: [order, ...(p.labOrders || []).filter(o => o.id !== order.id)] };
        indexedDbService.savePatient(updatedPat).catch(() => {});
        supabaseService.savePatient(updatedPat).catch(() => {});
        return updatedPat;
      }));
    } else if (item.entityType === 'implant_case' && item.payload) {
      const imp = item.payload as ImplantCase;
      setPatients(prev => prev.map(p => {
        if (p.id !== imp.patientId) return p;
        const updatedPat = { ...p, implantCases: [imp, ...(p.implantCases || []).filter(c => c.id !== imp.id)] };
        indexedDbService.savePatient(updatedPat).catch(() => {});
        supabaseService.savePatient(updatedPat).catch(() => {});
        return updatedPat;
      }));
    } else if (item.entityType === 'payment_refund' && item.payload) {
      const pay = item.payload as PaymentRecord;
      setPatients(prev => prev.map(p => {
        if (p.id !== pay.patientId) return p;
        const updatedPat = {
          ...p,
          paidAmount: p.paidAmount + pay.amount,
          balance: p.balance + pay.amount,
          payments: [pay, ...(p.payments || []).filter(pm => pm.id !== pay.id)]
        };
        indexedDbService.savePatient(updatedPat).catch(() => {});
        supabaseService.savePatient(updatedPat).catch(() => {});
        return updatedPat;
      }));
    } else if (item.entityType === 'appointment' && item.payload) {
      const apt = item.payload as Appointment;
      setAppointments(prev => [apt, ...prev.filter(a => a.id !== apt.id)]);
      indexedDbService.saveAppointment(apt).catch(() => {});
      supabaseService.saveAppointment(apt).catch(() => {});
    } else if (item.entityType === 'inventory_item' && item.payload) {
      const inv = item.payload as InventoryItem;
      setInventory(prev => [inv, ...prev.filter(i => i.id !== inv.id)]);
    } else if (item.entityType === 'staff_user' && item.payload) {
      const staff = item.payload as UserAccount;
      setUsers(prev => {
        const next = [...prev.filter(u => u.id !== staff.id), staff];
        try {
          localStorage.setItem('minadental_clinic_users_v2', JSON.stringify(next));
          window.dispatchEvent(new CustomEvent('minadental:staff-users-updated'));
        } catch {}
        return next;
      });
    }

    removeFromTrashVault(item.id);
    appendSecurityAuditLog({
      actor: currentUser.fullName,
      role: currentUser.role,
      action: `بازیابی رکورد از گاوصندوق مدیر: ${item.title}`,
      details: `${item.subtitle} با موفقیت به پایگاه‌داده فعال بازگردانده شد.`,
      severity: 'info'
    });
    actionFeedback.recordSuccess({
      title: `«${item.title}» با موفقیت بازیابی شد`,
      subtitle: item.subtitle,
      targetRecordId: item.entityId,
      badgeText: '✓ بازیابی کامل انجام شد',
      canUndo: false
    });
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] min-w-0 bg-white text-slate-900 flex flex-col justify-start overflow-x-hidden relative selection:bg-cyan-500 selection:text-black">
      {/* WCAG 2.2 AA Skip Navigation Link for Keyboard & Assistive Technology */}
      <a href="#main-content" className="skip-to-main">
        پرش به محتوای اصلی کلینیک
      </a>

      {/* Live Polite Screen-Reader Status Announcer for Module Routing & Sync Telemetry */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {activeSyncEvent
          ? `${activeSyncEvent.title} — ${activeSyncEvent.description}`
          : `نمای فعال کلینیک: ${activeView}`}
      </div>
      
      {/* Animated Gemini Multi-Color Aurora Background Tailored to Each Section */}
      <AnimatedGeminiBackground activeView={activeView} />

      {/* Main Responsive Cross-Device App Container (Android, iPhone, iPad & Laptop) */}
      <div className="w-full max-w-full min-w-0 sm:max-w-[640px] md:max-w-[880px] lg:max-w-[1140px] xl:max-w-[1280px] min-h-screen relative flex flex-col overflow-x-hidden shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:border-x border-slate-200/70 bg-white/40 z-10 mx-auto transition-all duration-300">
        
        {/* Top Header with MinaDental Logo, Persian Clock, Wifi/Antenna, Cloud Auto-Sync and Reminders Bell */}
        <AppHeader
          title={
            activeView === 'financial' ? 'مالی' :
            activeView === 'treatments' ? 'درمان' :
            activeView === 'appointments' ? 'نوبت‌ها' :
            activeView === 'patients' ? 'بیماران' :
            activeView === 'lab' ? 'لابراتوار' :
            activeView === 'implant' ? 'ایمپلنت' :
            activeView === 'ai_assistant' ? 'هوشمند' :
            activeView === 'inventory' ? 'انبار' :
            activeView === 'reminders' ? 'یادآوری' :
            activeView === 'xrays' ? 'رادیولوژی' :
            activeView === 'marketing' ? 'تبلیغات' :
            activeView === 'settings' ? 'تنظیمات' :
            activeView === 'sterilization' ? 'استریل' :
            activeView === 'insurance_claims' ? 'بیمه' : undefined
          }
          currentUser={currentUser}
          showBack={activeView !== 'home'}
          unreadRemindersCount={unreadNotificationsCount}
          onBack={() => {
            setActiveView('home');
            setActiveTab('home');
          }}
          onOpenProfile={() => setRoleSwitcherModalOpen(true)}
          onOpenReminders={() => setNotificationDrawerOpen(true)}
          onOpenSupabaseTest={() => setSupabaseTestModalOpen(true)}
          onOpenPhaseAudit={() => setPhaseAuditModalOpen(true)}
          onOpenRealClinicTest={() => setRealClinicTestModalOpen(true)}
          onOpenProjectDownload={() => setProjectDownloadModalOpen(true)}
          onSimulateIncomingCall={() => handleSimulateIncomingCall()}
          onOpenAccessibility={() => setAccessibilityModalOpen(true)}
          onOpenClinicalHud={() => setClinicalHudOpen(true)}
          liveSyncMeta={liveSyncMeta}
          onOpenSearch={() => {
            setCommandPaletteOpen(true);
            if (activeView === 'home') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('minadental:focus-patient-search'));
              }, 80);
            }
          }}
          onTriggerSync={async () => {
            // Instant real-time multi-device server push + local mesh broadcast
            await triggerLiveServerSync(currentUser.fullName || currentUser.username, currentUser.role);
            syncEngine.broadcast({
              type: 'TREATMENT_REGISTERED',
              performedBy: currentUser.username,
              role: currentUser.role,
              platform: currentUser.assignedPlatform,
              title: 'همگام‌سازی زنده چنددستگاهی مینادنتال انجام شد',
              description: 'کلیه داده‌های بیماران، نوبت‌ها، انبار و امور مالی بین تمام دستگاه‌های مطب همگام گردید.'
            });
            return true;
          }}
        />

        {/* Live Chairside Dynamic Island (Isolated 0-Lag Memoized Component) */}
        {(() => {
          const activeChairApt = appointments.find(a => a.status === 'in_chair');
          if (!activeChairApt) return null;
          const matchedPat = patients.find(p => p.id === activeChairApt.patientId || p.fullName === activeChairApt.patientName) || patients[0];
          return (
            <LiveChairsideBanner
              activeChairApt={activeChairApt}
              onOpenPalmer={() => {
                if (matchedPat) setSelectedPatient(matchedPat);
                setPalmerChartOpen(true);
              }}
              onFinishAndPay={() => {
                handleUpdateAppointmentStatus(activeChairApt.id, 'completed');
                if (matchedPat) setSelectedPatient(matchedPat);
                setAddPaymentModalOpen(true);
              }}
            />
          );
        })()}

        {/* Smart Patient Caller ID Floating Banner */}
        <IncomingCallBanner
          call={incomingCall}
          appointments={appointments}
          onClose={() => setIncomingCall(null)}
          onScheduleAppointment={(name, phone, suggestedTreatment, time, date) => {
            scheduleAppointmentFromModule({
              patientName: name,
              phone,
              treatment: suggestedTreatment,
              time,
              date
            });
          }}
          onOpenPatientFile={(p) => handleOpenPatientFile(p)}
          onQuickAdmission={(phone) => {
            if (phone) setAdmissionPrefillPhone(phone);
            setActiveView('patients');
            setActiveTab('patients');
          }}
        />

        {/* Live Synchronized Doctor Billing Alert for Secretary */}
        {doctorBillingAlert && (
          <div className="mx-4 my-2 p-3 rounded-[20px] bg-gradient-to-r from-red-950/90 to-amber-950/90 border border-amber-500/50 text-white shadow-[var(--shadow-elevated)] flex items-center justify-between gap-3 ios27-hud-enter">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold shrink-0">
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-300 block">
                    اعلام فوری پزشک در یونیت: درمان تمام شد!
                  </span>
                  <span className="text-[11px] text-white/80 mt-0.5 block">
                    بیمار {doctorBillingAlert.patientName} · {doctorBillingAlert.treatment} · {formatToman(doctorBillingAlert.amount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('heavy');
                    setAddPaymentModalOpen(true);
                  }}
                  className="min-h-[38px] py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  دریافت وجه (POS)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setDoctorBillingAlert(null);
                  }}
                  aria-label="بستن اعلان مالی پزشک"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="بستن اعلان"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Global iOS 27 Action Verification HUD (Before -> After Diff, Conflict Resolution & 1-Tap Undo) */}
          <ActionVerificationHud />

          {/* Real-time Sync Toast Notification */}
          <SyncNotificationToast
            event={activeSyncEvent}
            onDismiss={() => setActiveSyncEvent(null)}
            onActionClick={(event) => {
              if (event.type === 'TREATMENT_REGISTERED') setAddPaymentModalOpen(true);
              if (event.type === 'APPOINTMENT_SCHEDULED') setActiveView('appointments');
            }}
          />

          {/* View Routing with Fault-Isolated ErrorBoundary & Code-Split Suspense */}
          <main id="main-content" tabIndex={-1} key={activeView} className="w-full max-w-full min-w-0 overflow-x-hidden flex-1 pb-36 sm:pb-40 animate-view-enter focus:outline-none">
            <ModuleErrorBoundary
              moduleName={activeView}
              onResetToHome={() => {
                setActiveView('home');
                setActiveTab('home');
              }}
            >
              <Suspense
                fallback={
                  <div className="mx-2 my-3">
                    <DentalSkeletonLoader type="dashboard" />
                  </div>
                }
              >
            {activeView === 'home' && (
              <DashboardView
                patients={patients}
                appointments={appointments}
                onSelectPatient={(p) => setSelectedPatient(p)}
                onOpenPalmerForPatient={(p) => {
                  setSelectedPatient(p);
                  setPalmerChartOpen(true);
                }}
                onOpenAppointmentForPatient={(p) => {
                  setSelectedPatient(p);
                  setActiveView('appointments');
                  setActiveTab('appointments');
                }}
                onNavigate={handleServicesNavigate}
                onOpenPalmerChart={() => setPalmerChartOpen(true)}
                onQuickAdmission={() => setActiveView('patients')}
                onOpenSupabaseTest={() => setSupabaseTestModalOpen(true)}
                onOpenPhaseAudit={() => setPhaseAuditModalOpen(true)}
                onOpenRealClinicTest={() => setRealClinicTestModalOpen(true)}
                onOpenLabSlip={(order) => setLabSlipOrder(order)}
                onUpdateLabStatus={handleUpdateLabStatus}
                todayAppointmentsCount={todayAppointmentsCount}
                activeSurgeriesCount={activeSurgeriesCount}
                readyLabOrdersCount={readyLabOrdersCount}
                dailyRevenue={dailyRevenue}
                inventory={inventory}
                onAddNewPatient={handleAddNewPatient}
              />
            )}

            {activeView === 'treatments' && (
              <TreatmentsView
                patients={patients}
                appointments={appointments}
                selectedPatientId={selectedPatient?.id}
                onSelectPatientId={(id) => {
                  const found = patients.find((p) => p.id === id) || null;
                  setSelectedPatient(found);
                }}
                onOpenPalmerChart={(pat, tooth) => {
                  if (pat) setSelectedPatient(pat);
                  setPalmerFocusTooth(tooth || null);
                  setPalmerChartOpen(true);
                }}
                onOpenPatientFile={(p, tab) => handleOpenPatientFile(p, tab || 'treatments')}
                onUpdateTreatmentStatus={handleUpdateToothTreatmentStatus}
                onScheduleAppointment={(pat, suggestedTreatment) => {
                  scheduleAppointmentFromModule({
                    patientName: pat.fullName,
                    phone: pat.phone,
                    treatment: suggestedTreatment || 'ادامه طرح درمان تخصصی',
                    unit: 'یونیت آبی'
                  });
                }}
                onLaunchLabFromTreatment={(prefill) => {
                  setLabTargetPatientId(prefill.patientId || selectedPatient?.id);
                  setLabPrefillTooth(prefill.toothNumber);
                  setLabPrefillWorkType(prefill.workType);
                  setAddLabOrderModalOpen(true);
                }}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'financial' && (
              <FinancialView
                patients={patients}
                initialSegment={financialInitialSegment}
                onOpenCheckModal={(patientId) => {
                  setCheckTargetPatientId(patientId);
                  setAddCheckModalOpen(true);
                }}
                onOpenPatientFile={(p) => setSelectedPatient(p)}
                onOpenPaymentModal={(patientId) => {
                  setPaymentTargetPatientId(patientId);
                  setAddPaymentModalOpen(true);
                }}
                onOpenInvoice={handleOpenInvoice}
                onOpenCommissionModal={() => setCommissionModalOpen(true)}
                onSaveInstallmentPlan={handleSaveInstallmentPlan}
                onPayInstallment={handlePayInstallment}
                onUpdateCheckStatus={handleUpdateCheckStatus}
                onEditCheck={handleEditCheck}
                onDeleteCheck={handleDeleteCheck}
                onEditInstallment={handleEditInstallment}
                onEditOrRefundPayment={handleEditOrRefundPayment}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'appointments' && (
              <AppointmentsView
                appointments={appointments}
                patients={patients}
                users={users}
                onAddAppointment={handleAddAppointment}
                onUpdateStatus={handleUpdateAppointmentStatus}
                onMoveAppointment={handleMoveAppointment}
                onEditAppointment={handleEditAppointment}
                onBatchShiftAppointments={handleBatchShiftAppointments}
                onDeleteAppointment={handleDeleteAppointment}
                onQuickCreatePatient={(draft) => {
                  const finalFileNumber = getNextFileNumber(getLatestFileNumber(patients));
                  recordLastFileNumber(finalFileNumber);
                  const created: Patient = {
                    id: `pat-${Date.now()}`,
                    fileNumber: finalFileNumber,
                    fullName: draft.fullName.trim(),
                    nationalId: '',
                    phone: draft.phone.trim(),
                    age: 30,
                    gender: 'مرد',
                    medicalHistory: [],
                    totalCost: 0,
                    paidAmount: 0,
                    balance: 0,
                    activeTreatmentsCount: 0,
                    lastVisit: getCurrentPersianDate(),
                    teethConditions: {},
                    sayadChecks: [],
                    installments: [],
                    labOrders: [],
                    implantCases: [],
                    payments: [],
                    notes: draft.notes || 'تشکیل پرونده خودکار هنگام نوبت‌دهی'
                  };
                  setPatients(prev => [created, ...prev]);
                  supabaseService.savePatient(created);
                  indexedDbService.savePatient(created);
                  syncEngine.recordOfflineOrLiveMutation({
                    entity: 'patient',
                    action: 'UPSERT',
                    payload: created,
                    actorName: currentUser.username,
                    actorRole: currentUser.role,
                    platform: currentUser.assignedPlatform,
                    eventType: 'TREATMENT_REGISTERED',
                    title: 'پرونده سریع از نوبت‌دهی',
                    description: `پرونده ${created.fullName} (${created.fileNumber}) حین رزرو نوبت ساخته شد.`
                  });
                  return created;
                }}
                onOpenBookingPortal={() => setBookingPortalModalOpen(true)}
                onNavigateToModule={handleServicesNavigate}
                onOpenLabModal={() => setAddLabOrderModalOpen(true)}
                onOpenCheckModal={() => setAddCheckModalOpen(true)}
                onOpenPaymentModal={() => setAddPaymentModalOpen(true)}
                onOpenPalmerChart={() => setPalmerChartOpen(true)}
                onStartClinicalFlow={handleStartClinicalFlowFromApt}
                onOpenPatientFile={handleOpenPatientFile}
                onOpenPaymentForPatient={(apt) => {
                  const last7 = normalizePhoneLast7(apt.phone);
                  const matched =
                    (apt.patientId ? patientIndex.byId.get(apt.patientId) : undefined) ||
                    (last7.length >= 7 ? patients.find(p => normalizePhoneLast7(p.phone) === last7) : undefined) ||
                    patients.find(p => p.fullName.trim() === apt.patientName.trim());
                  setPaymentTargetPatientId(matched?.id);
                  setAddPaymentModalOpen(true);
                }}
                prefillDraft={appointmentPrefillDraft}
                onConsumePrefill={() => setAppointmentPrefillDraft(null)}
                initialViewMode={appointmentsInitialViewMode}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'lab' && (
              <LabModuleView
                patients={patients}
                onOpenPatientFile={(p, tab) => handleOpenPatientFile(p, tab || 'lab')}
                onOpenPalmerChart={(pat, toothText) => {
                  setSelectedPatient(pat);
                  const match = (toothText || '').match(/(UR|UL|LL|LR)[_\s-]?([1-8])/i);
                  if (match) {
                    const q = match[1].toUpperCase() as 'UR' | 'UL' | 'LL' | 'LR';
                    const num = Number(match[2]);
                    if (num >= 1 && num <= 8) {
                      setPalmerFocusTooth({ quadrant: q, toothNumber: num });
                    }
                  }
                  setPalmerChartOpen(true);
                }}
                onOpenPaymentModal={(pat) => {
                  setSelectedPatient(pat);
                  setPaymentTargetPatientId(pat.id);
                  setAddPaymentModalOpen(true);
                }}
                onOpenCheckModal={(pat) => {
                  setSelectedPatient(pat);
                  setCheckTargetPatientId(pat.id);
                  setAddCheckModalOpen(true);
                }}
                onNavigateToModule={handleServicesNavigate}
                onAddLabOrder={() => setAddLabOrderModalOpen(true)}
                onUpdateStatus={handleUpdateLabStatus}
                onEditLabOrder={handleEditLabOrder}
                onDeleteLabOrder={handleDeleteLabOrder}
                onOpenDigitalLabPortal={() => setDigitalLabModalOpen(true)}
                onOpenLabScanner={() => {
                  setUniversalScannerScope('lab');
                  setUniversalScannerOpen(true);
                }}
                onScheduleLabDelivery={(pat, order) => {
                  scheduleAppointmentFromModule({
                    patientName: pat.fullName,
                    phone: pat.phone,
                    treatment: `تحویل و سمان ${order.workType} (${order.toothNumber})`,
                    unit: 'یونیت آبی'
                  });
                }}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'implant' && (
              <ImplantModuleView
                patients={patients}
                users={users}
                inventory={inventory}
                onOpenPatientFile={(p, tab) => handleOpenPatientFile(p, tab || 'implant')}
                onOpenPalmerChart={(pat, toothText) => {
                  setSelectedPatient(pat);
                  const match = (toothText || '').match(/(UR|UL|LL|LR)[_\s-]?([1-8])/i);
                  if (match) {
                    const q = match[1].toUpperCase() as 'UR' | 'UL' | 'LL' | 'LR';
                    const num = Number(match[2]);
                    if (num >= 1 && num <= 8) {
                      setPalmerFocusTooth({ quadrant: q, toothNumber: num });
                    }
                  }
                  setPalmerChartOpen(true);
                }}
                onOpenPaymentModal={(pat) => {
                  setSelectedPatient(pat);
                  setPaymentTargetPatientId(pat.id);
                  setAddPaymentModalOpen(true);
                }}
                onOpenCheckModal={(pat) => {
                  setSelectedPatient(pat);
                  setCheckTargetPatientId(pat.id);
                  setAddCheckModalOpen(true);
                }}
                onNavigateToModule={handleServicesNavigate}
                onAdvanceStage={handleAdvanceImplantStage}
                onEditImplantCase={handleEditImplantCase}
                onDeleteImplantCase={handleDeleteImplantCase}
                onScheduleImplantFollowUp={(pat, imp) => {
                  scheduleAppointmentFromModule({
                    patientName: pat.fullName,
                    phone: pat.phone,
                    treatment: `ادامه مرحله ایمپلنت ${imp.brand} (${imp.toothNumber})`,
                    unit: 'یونیت جراحی'
                  });
                }}
                onCreateLabOrderFromImplant={(pat, imp) => {
                  setLabTargetPatientId(pat.id);
                  setLabPrefillTooth(imp?.toothNumber);
                  setLabPrefillWorkType('اباتمنت و کرون ایمپلنت');
                  setAddLabOrderModalOpen(true);
                }}
                onAddImplantCase={(newCase) => {
                  const prevPatients = patients;
                  const updated = patients.map(p => p.id === newCase.patientId ? {
                    ...p,
                    implantCases: [newCase, ...(p.implantCases || [])]
                  } : p);
                  setPatients(updated);
                  const updatedPat = updated.find(p => p.id === newCase.patientId);
                  if (selectedPatient && selectedPatient.id === newCase.patientId) {
                    setSelectedPatient(updatedPat || null);
                  }
                  if (updatedPat) {
                    supabaseService.savePatient(updatedPat);
                    indexedDbService.savePatient(updatedPat);
                    stateSyncQueue.enqueue('patients', 'UPDATE', updatedPat, 'local');
                  }
                  // Auto-deduct Implant Surgical BOM (Fixture, Anesthetic, Needles, Bone Graft, Collagen Membrane)
                  const surgicalConsumption = inventoryConsumptionService.deductSuppliesForImplantSurgery(
                    { brand: newCase.brand, boneGraft: newCase.boneGraft, membrane: newCase.membrane },
                    inventory
                  );
                  if (surgicalConsumption.deductedItems.length > 0) {
                    setInventory(surgicalConsumption.updatedInventory);
                    surgicalConsumption.deductedItems.forEach((d) => {
                      const invObj = surgicalConsumption.updatedInventory.find((i) => i.id === d.itemId);
                      if (invObj) {
                        supabaseService.saveInventoryItem(invObj).catch(() => {});
                      }
                    });
                    if (surgicalConsumption.criticalAlerts.length > 0) {
                      syncEngine.broadcast({
                        type: 'CLOUD_BACKUP_SAVED',
                        performedBy: 'سیستم هوشمند انبار جراحی',
                        role: 'admin',
                        platform: currentUser?.assignedPlatform || 'Web Admin',
                        title: 'هشدار کسری کیت ایمپلنت و متریال جراحی',
                        description: `موجودی ${surgicalConsumption.criticalAlerts.map(a => a.itemName).join('، ')} پس از جراحی به حداقل مجاز رسید.`
                      });
                    }
                  }
                  if (newCase.reminderConfig?.enabled) {
                    scheduleEntityReminder({
                      sourceType: 'implant',
                      sourceId: newCase.id,
                      patientId: newCase.patientId,
                      patientName: newCase.patientName,
                      patientPhone: updatedPat?.phone,
                      title: `پیگیری ایمپلنت ${newCase.brand} (${newCase.toothNumber})`,
                      description: `موعد هیلینگ و قالب‌گیری پروتز`,
                      targetDate: newCase.healingDueDate,
                      targetView: 'implant',
                      config: newCase.reminderConfig
                    });
                  }
                  syncEngine.broadcast({
                    type: 'IMPLANT_UPDATED',
                    performedBy: currentUser?.username || 'دکتر مهدی امیری',
                    role: currentUser?.role || 'admin',
                    platform: currentUser?.assignedPlatform || 'یونیت جراحی',
                    title: 'کیس جراحی ایمپلنت جدید ثبت شد',
                    description: `${newCase.patientName} · ${newCase.brand} (${newCase.toothNumber})`
                  });
                  undoManager.register({
                    title: `کیس ایمپلنت جدید ثبت شد`,
                    description: `${newCase.patientName} · ${newCase.brand}`,
                    undo: () => {
                      setPatients(prevPatients);
                    }
                  });
                  actionFeedback.recordSuccess({
                    title: `کیس جراحی ایمپلنت جدید ثبت شد`,
                    subtitle: `بیمار: ${newCase.patientName} · برند: ${newCase.brand}${surgicalConsumption.deductedItems.length > 0 ? ` · کسر ${toPersianDigits(surgicalConsumption.deductedItems.length)} قلم از انبار` : ''}`,
                    diffAfter: `${newCase.toothNumber} · تورک ${newCase.torque} N/cm`,
                    targetRecordId: newCase.id,
                    badgeText: `✓ کیس ایمپلنت ${newCase.brand} ثبت شد`,
                    canUndo: true
                  });
                }}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'patients' && (
              <PatientsListView
                patients={patients}
                appointments={appointments}
                onOpenPatientFile={handleOpenPatientFile}
                onAddNewPatient={handleAddNewPatient}
                onUpdateFileNumber={handleUpdatePatientFileNumber}
                onEditPatient={handleEditPatientRecord}
                onDeletePatient={handleDeletePatientRecord}
                onOpenInvoice={handleOpenInvoice}
                onOpenPalmerChart={(p) => {
                  setSelectedPatient(p);
                  setPalmerChartOpen(true);
                }}
                onQuickPayment={(p) => {
                  setPaymentTargetPatientId(p.id);
                  setAddPaymentModalOpen(true);
                }}
                onQuickAddAppointment={handleAddAppointment}
                onOpenPatientScanner={() => {
                  setUniversalScannerScope('patient');
                  setUniversalScannerOpen(true);
                }}
                prefillPhone={admissionPrefillPhone}
                onConsumePrefill={() => setAdmissionPrefillPhone(null)}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'ai_assistant' && (
              <AiAssistantView
                patients={patients}
                appointments={appointments}
                inventory={inventory}
                onOpenPatientFile={handleOpenPatientFile}
                onOpenPalmerChart={(p) => {
                  setSelectedPatient(p);
                  setPalmerChartOpen(true);
                }}
                onNavigate={handleServicesNavigate}
                onScheduleSmartAppointment={scheduleAppointmentFromModule}
              />
            )}

            {activeView === 'inventory' && (
              <InventoryView
                inventory={inventory}
                patients={patients}
                appointments={appointments}
                onUpdateStock={(id, newStock) => {
                  let updatedItem: InventoryItem | undefined;
                  setInventory(prev =>
                    prev.map(i => {
                      if (i.id === id) {
                        updatedItem = { ...i, stock: newStock };
                        return updatedItem;
                      }
                      return i;
                    })
                  );
                  if (updatedItem) {
                    supabaseService.saveInventoryItem(updatedItem).catch(() => {});
                    syncEngine.recordOfflineOrLiveMutation({
                      entity: 'inventory',
                      action: 'UPSERT',
                      payload: updatedItem,
                      actorName: currentUser.username,
                      actorRole: currentUser.role,
                      platform: currentUser.assignedPlatform,
                      title: `موجودی «${updatedItem.name}» به‌روزرسانی شد`,
                      description: `موجودی جدید: ${toPersianDigits(newStock)} ${updatedItem.unit}`
                    });
                  }
                }}
                onAddItem={(item) => {
                  setInventory(prev => [item, ...prev]);
                  supabaseService.saveInventoryItem(item).catch(() => {});
                  syncEngine.recordOfflineOrLiveMutation({
                    entity: 'inventory',
                    action: 'UPSERT',
                    payload: item,
                    actorName: currentUser.username,
                    actorRole: currentUser.role,
                    platform: currentUser.assignedPlatform,
                    title: `کالای جدید «${item.name}» در انبار ثبت شد`,
                    description: `بارکد: ${item.barcode || item.id} · موجودی: ${toPersianDigits(item.stock)} ${item.unit}`
                  });
                }}
                onBatchUpdate={handleProtectedInventoryBatchUpdate}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'reminders' && (
              <RemindersView
                patients={patients}
                appointments={appointments}
                inventory={inventory}
                onOpenSmsGatewaySettings={() => setSmsGatewayModalOpen(true)}
                onOpenAppointments={() => {
                  setAppointmentsInitialViewMode('board');
                  setActiveView('appointments');
                  setActiveTab('appointments');
                }}
                onNavigateToModule={handleServicesNavigate}
                onOpenPatientFile={handleOpenPatientFile}
                onScheduleSmartAppointment={scheduleAppointmentFromModule}
                onUpdateCheckStatus={handleUpdateCheckStatus}
                onPayInstallment={handlePayInstallment}
                onOpenAddPayment={(pat) => {
                  setPaymentTargetPatientId(pat.id);
                  setAddPaymentModalOpen(true);
                }}
                onOpenAddCheck={(patientId) => {
                  setCheckTargetPatientId(patientId);
                  setAddCheckModalOpen(true);
                }}
              />
            )}

            {activeView === 'xrays' && (
              <XRayModuleView
                patients={patients}
                onOpenPatientFile={(p, tab) => handleOpenPatientFile(p, tab || 'xrays')}
              />
            )}

            {activeView === 'marketing' && (
              <MarketingCampaignsView
                patients={patients}
                onOpenPatientFile={handleOpenPatientFile}
                isManager={isClinicManager(currentUser)}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView 
                currentUser={currentUser}
                patients={patients}
                appointments={appointments}
                inventory={inventory}
                users={users}
                platforms={platforms}
                onOpenSupabaseTest={() => setSupabaseTestModalOpen(true)}
                onOpenPhaseAudit={() => setPhaseAuditModalOpen(true)}
                onOpenProjectDownload={() => setProjectDownloadModalOpen(true)}
                onOpenLiveSync={() => setLiveSyncModalOpen(true)}
                onOpenBackupModal={() => setBackupModalOpen(true)}
                onOpenCommissionModal={() => setCommissionModalOpen(true)}
                onRestoreData={(restored) => {
                  if (!verifyManagerDeletion(currentUser, 'بازگردانی نسخه پشتیبان و جایگزینی داده‌ها', 'backup-restore')) {
                    return;
                  }
                  if (restored.patients) setPatients(restored.patients);
                  if (restored.appointments) setAppointments(restored.appointments);
                  if (restored.inventory) setInventory(restored.inventory);
                }}
                onRestoreVaultItem={handleRestoreFromTrashVault}
                clinicDataMode={clinicDataMode}
                liveSyncMeta={liveSyncMeta}
                onTriggerLiveServerSync={() =>
                  triggerLiveServerSync(currentUser.fullName || currentUser.username, currentUser.role)
                }
                onActivateCleanProductionMode={() =>
                  activateCleanProductionMode(
                    currentUser.fullName || currentUser.username,
                    isClinicManager(currentUser)
                  )
                }
              />
            )}

            {activeView === 'sterilization' && (
              <SterilizationModuleView 
                patients={patients}
                onOpenPatientFile={handleOpenPatientFile}
                onOpenSterileScanner={() => {
                  setUniversalScannerScope('sterilization');
                  setUniversalScannerOpen(true);
                }}
                onLinkPackToPatient={(barcode, patientId) => {
                  const targetPat = (patientId ? patientIndex.byId.get(patientId) : undefined) || selectedPatient || patients[0];
                  if (targetPat) {
                    const packNote = `پک استریل اتوکلاو (${barcode}) · ${getCurrentPersianDate()}`;
                    const updatedPat: Patient = {
                      ...targetPat,
                      notes: targetPat.notes ? `${targetPat.notes}\n${packNote}` : packNote,
                      treatments: [{
                        id: `trt-ster-${Date.now()}`,
                        tooth: 'یونیت جراحی',
                        treatment: `پک استریل الصاقی لاگ اتوکلاو (${barcode})`,
                        cost: 0,
                        date: getCurrentPersianDate(),
                        status: 'completed',
                        doctorName: currentUser.fullName
                      }, ...(targetPat.treatments || [])]
                    };
                    setPatients(prev => prev.map(p => (p.id === targetPat.id ? updatedPat : p)));
                    if (selectedPatient?.id === targetPat.id) {
                      setSelectedPatient(updatedPat);
                    }
                    indexedDbService.savePatient(updatedPat).catch(() => {});
                    supabaseService.savePatient(updatedPat).catch(() => {});
                    actionFeedback.recordSuccess({
                      title: `پک استریل (${barcode}) به پرونده «${targetPat.fullName}» الصاق شد`,
                      subtitle: `شماره پرونده: ${targetPat.fileNumber}`,
                      targetRecordId: targetPat.id,
                      badgeText: '✓ الصاق پک استریل ذخیره شد'
                    });
                  }
                }}
              />
            )}

            {activeView === 'insurance_claims' && (
              <InsuranceClaimsView
                patients={patients}
                onOpenPatientFile={handleOpenPatientFile}
                onRecordInsurancePayment={(patientId, amount, insurerName, trackingCode) => {
                  const targetPat = patientIndex.byId.get(patientId);
                  if (!targetPat) return;
                  handleAddPayment({
                    id: `pay-ins-${Date.now()}`,
                    patientId: targetPat.id,
                    patientName: targetPat.fullName,
                    amount,
                    date: getCurrentPersianDate(),
                    method: 'card_to_card',
                    referenceNumber: trackingCode,
                    terminalName: `واریز حواله ${insurerName}`,
                    forTreatment: `تسویه سهم بیمه (${insurerName} · ${trackingCode})`
                  });
                }}
              />
            )}
              </Suspense>
            </ModuleErrorBoundary>
          </main>

          {/* Bottom Dock Navigation Bar (Persistent across all screens) */}
          <BottomDock
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onOpenServicesMenu={() => setServicesMenuOpen(true)}
            onOpenThumbZone={() => setThumbZoneOpen(true)}
          />

          {/* Screenshot 1: Full Services Sheet Modal */}
          <ServicesSheet
            isOpen={servicesMenuOpen}
            onClose={() => setServicesMenuOpen(false)}
            onNavigate={handleServicesNavigate}
            lowStockCount={inventory.filter(i => i.stock <= i.minAlert).length}
          />

          {/* Comprehensive Patient Record File Modal */}
          <PatientFileModal
            patient={selectedPatient}
            isOpen={!!selectedPatient}
            onClose={() => setSelectedPatient(null)}
            initialTab={patientFileInitialTab}
            currentUser={currentUser}
            appointments={appointments}
            onScheduleAppointment={(pat, suggestedTreatment) => {
              scheduleAppointmentFromModule({
                patientName: pat.fullName,
                phone: pat.phone,
                treatment: suggestedTreatment || 'معاینه و ادامه طرح درمان',
                unit: 'یونیت آبی'
              });
            }}
            onOpenPalmerChart={() => setPalmerChartOpen(true)}
            onAddCheck={() => setAddCheckModalOpen(true)}
            onAddPayment={() => setAddPaymentModalOpen(true)}
            onAddLabOrder={() => setAddLabOrderModalOpen(true)}
            onOpenXRayModule={() => setActiveView('xrays')}
            onUpdateFileNumber={handleUpdatePatientFileNumber}
            onOpenInvoice={handleOpenInvoice}
            onUpdateTreatmentStatus={handleUpdateTreatmentStatus}
            onUpdateTreatmentCost={handleUpdateTreatmentCost}
            onDeleteTreatment={handleDeleteTreatmentFromTooth}
            onDeletePatient={handleDeletePatientRecord}
            onAddPrescription={handleAddPrescription}
            onToggleConsent={handleToggleConsent}
            onSaveConsentSignature={handleSaveConsentSignature}
            onUpdatePatient={(updated) => {
              handleEditPatientRecord(updated.id, updated);
            }}
          />

          {/* 3D Palmer Dental Chart & Surface Picker Modal (Mounted after PatientFileModal so it opens cleanly on top) */}
          <PalmerChartModal
            isOpen={palmerChartOpen}
            onClose={() => {
              setPalmerChartOpen(false);
              setPalmerFocusTooth(null);
            }}
            patientName={(selectedPatient || patients[0])?.fullName || 'بیمار جدید / پیش‌فرض'}
            patient={selectedPatient || patients[0] || null}
            patients={patients}
            onSelectPatient={(p) => setSelectedPatient(p)}
            initialQuadrant={palmerFocusTooth?.quadrant}
            initialTooth={palmerFocusTooth?.toothNumber}
            teethConditions={(selectedPatient || patients[0])?.teethConditions}
            users={users}
            isManager={currentUser?.role === 'admin' || currentUser?.role === 'doctor' || Boolean(currentUser?.isManager)}
            onDeleteToothTreatment={handleDeleteTreatmentFromTooth}
            onLaunchLabFromTreatment={(prefill) => {
              setLabTargetPatientId(prefill.patientId || selectedPatient?.id);
              setLabPrefillTooth(prefill.toothNumber);
              setLabPrefillWorkType(prefill.workType);
              setPalmerChartOpen(false);
              setAddLabOrderModalOpen(true);
            }}
            onLaunchPaymentFromTreatment={(patientId) => {
              setPaymentTargetPatientId(patientId || selectedPatient?.id);
              setPalmerChartOpen(false);
              setAddPaymentModalOpen(true);
            }}
            onLaunchImplantFromTreatment={() => {
              setPalmerChartOpen(false);
              setActiveView('implant');
              setActiveTab('home');
            }}
            onSaveTreatment={handleSaveTreatment}
          />

          {/* Printable Official Dental Clinic Invoice Modal */}
          <TreatmentInvoiceModal
            isOpen={invoiceModalOpen}
            onClose={() => setInvoiceModalOpen(false)}
            patient={invoicePatient || selectedPatient || patients[0]}
          />

          {/* Sayad & Guarantee Check Creation Modal */}
          <AddCheckModal
            isOpen={addCheckModalOpen}
            onClose={() => {
              setAddCheckModalOpen(false);
              setCheckTargetPatientId(undefined);
              setScannedSayadDraft(null);
            }}
            patients={patients}
            onAddCheck={handleAddCheck}
            initialPatientId={checkTargetPatientId || selectedPatient?.id}
            initialSayadId={scannedSayadDraft?.sayadId}
            initialBankName={scannedSayadDraft?.bankName}
          />

          {/* Lab Order Dispatch Modal */}
          <AddLabOrderModal
            isOpen={addLabOrderModalOpen}
            onClose={() => {
              setAddLabOrderModalOpen(false);
              setLabTargetPatientId(undefined);
              setLabPrefillTooth(undefined);
              setLabPrefillWorkType(undefined);
            }}
            patients={patients}
            onAddOrder={handleAddLabOrder}
            initialPatientId={labTargetPatientId || selectedPatient?.id}
            initialToothNumber={labPrefillTooth}
            initialWorkType={labPrefillWorkType}
          />

          {/* POS & Cash Payment Modal */}
          <AddPaymentModal
            isOpen={addPaymentModalOpen}
            onClose={() => {
              setAddPaymentModalOpen(false);
              setPaymentTargetPatientId(undefined);
            }}
            patients={patients}
            onAddPayment={handleAddPayment}
            initialPatientId={paymentTargetPatientId || selectedPatient?.id}
          />

          {/* Live Dual-Platform Secretary & Doctor Simulator Modal (Lazy) */}
          {liveSyncModalOpen && (
            <ModuleErrorBoundary moduleName="شبیه‌ساز همگام‌سازی زنده" onResetToHome={() => setLiveSyncModalOpen(false)}>
              <Suspense fallback={null}>
                <LiveSyncSimulatorModal
                  isOpen={liveSyncModalOpen}
                  onClose={() => setLiveSyncModalOpen(false)}
                  patients={patients}
                  appointments={appointments}
                  onSecretaryBookAppointment={(name: string, time: string) => {
                    handleAddAppointment({
                      patientId: 'pat-new',
                      patientName: name,
                      phone: '۰۹۱۲۳۴۵۶۷۸۹',
                      unit: 'یونیت آبی',
                      doctor: 'دکتر مهدی امیری',
                      date: getCurrentPersianDate(),
                      time,
                      durationMinutes: 45,
                      treatment: 'معاینه و طرح درمان',
                      status: 'scheduled'
                    });
                  }}
                  onDoctorRegisterTreatment={(patientId: string, _tooth: string, _treatmentName: string, cost: number) => {
                    const p = patientIndex.byId.get(patientId) || patients[0];
                    setSelectedPatient(p);
                    handleSaveTreatment({
                      quadrant: 'UR',
                      toothNumber: 5,
                      surfaces: ['occlusal', 'buccal'],
                      treatment: 'crown_zirconia',
                      cost,
                      notes: 'روکش تمام زیرکونیا تراش و قالب‌گیری شد'
                    });
                  }}
                  onSecretaryCollectPayment={(patientId: string, amount: number) => {
                    handleAddPayment({
                      id: `pay-${Date.now()}`,
                      patientId,
                      patientName: 'علی مرادی',
                      amount,
                      date: getCurrentPersianDate(),
                      method: 'pos',
                      referenceNumber: '۷۲۸۴۹۱۲۸',
                      terminalName: 'کارتخوان پذیرش مطب (به‌پرداخت ملت)',
                      forTreatment: 'تسویه روکش زیرکونیا'
                    });
                  }}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Role and Connected Platform Switcher Modal */}
          <RoleSwitcherModal
            isOpen={roleSwitcherModalOpen}
            onClose={() => setRoleSwitcherModalOpen(false)}
            currentUser={currentUser}
            users={users}
            platforms={platforms}
            onSwitchUser={(user) => setCurrentUser(user)}
            onAddPlatform={handleAddPlatform}
            onAddUser={handleAddNewUser}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onLockSession={lockSession}
          />

          {/* Cloud and Local Backup & Restore Modal */}
          <BackupModal
            isOpen={backupModalOpen}
            onClose={() => setBackupModalOpen(false)}
            clinicName="مرکز تخصصی دندانپزشکی مینادنتال"
            patients={patients}
            appointments={appointments}
            inventory={inventory}
            users={users}
            platforms={platforms}
            isManager={isClinicManager(currentUser)}
            onRestoreData={(restored) => {
              if (!verifyManagerDeletion(currentUser, 'بازگردانی نسخه پشتیبان و جایگزینی داده‌ها', 'backup-restore')) {
                return;
              }
              if (restored.patients) setPatients(restored.patients);
              if (restored.appointments) setAppointments(restored.appointments);
              if (restored.inventory) setInventory(restored.inventory);
            }}
          />

          {/* World-Class Slide-over Notification & Reminders Drawer */}
          <NotificationDrawer
            isOpen={notificationDrawerOpen}
            onClose={() => setNotificationDrawerOpen(false)}
            patients={patients}
            appointments={appointments}
            inventory={inventory}
            onNavigateToModule={handleServicesNavigate}
            onOpenPatientFile={handleOpenPatientFile}
            onScheduleSmartAppointment={scheduleAppointmentFromModule}
            onUnreadCountChange={setUnreadNotificationsCount}
          />

          {/* Supabase Realtime Cloud DB & Diagnostic Test Suite Modal (Lazy) */}
          {supabaseTestModalOpen && (
            <ModuleErrorBoundary moduleName="تست دیتابیس ابری" onResetToHome={() => setSupabaseTestModalOpen(false)}>
              <Suspense fallback={null}>
                <SupabaseTestModal
                  isOpen={supabaseTestModalOpen}
                  onClose={() => setSupabaseTestModalOpen(false)}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Doctor Commission & Surgical Profit-Sharing Modal */}
          <DoctorCommissionModal
            isOpen={commissionModalOpen}
            onClose={() => setCommissionModalOpen(false)}
            patients={patients}
          />

          {/* Official Printable Lab Prescription Slip Modal */}
          <LabPrescriptionModal
            isOpen={!!labSlipOrder}
            onClose={() => setLabSlipOrder(null)}
            order={labSlipOrder}
            patient={(labSlipOrder?.patientId ? patientIndex.byId.get(labSlipOrder.patientId) : undefined) || null}
          />

          {/* Digital Lab Technician Portal Modal (Lazy) */}
          {digitalLabModalOpen && (
            <ModuleErrorBoundary moduleName="پورتال لابراتوار دیجیتال" onResetToHome={() => setDigitalLabModalOpen(false)}>
              <Suspense fallback={null}>
                <DigitalLabPortalModal
                  isOpen={digitalLabModalOpen}
                  onClose={() => setDigitalLabModalOpen(false)}
                  patients={patients}
                  onUpdateOrderStatus={handleUpdateLabStatus}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Smart Patient Self-Booking Portal Modal (Lazy) */}
          {bookingPortalModalOpen && (
            <ModuleErrorBoundary moduleName="پورتال نوبت‌دهی آنلاین بیمار" onResetToHome={() => setBookingPortalModalOpen(false)}>
              <Suspense fallback={null}>
                <PatientBookingPortalModal
                  isOpen={bookingPortalModalOpen}
                  onClose={() => setBookingPortalModalOpen(false)}
                  appointments={appointments}
                  users={users}
                  onBookingConfirmed={(newBooking) => {
                    handleAddAppointment({
                      patientId: 'pat-online-' + Date.now(),
                      patientName: newBooking.patientName,
                      phone: newBooking.phone,
                      unit: 'یونیت آبی',
                      doctor: newBooking.doctorName,
                      date: newBooking.date,
                      time: newBooking.time,
                      durationMinutes: 45,
                      treatment: newBooking.serviceTitle,
                      status: 'scheduled',
                      reminderConfig: {
                        enabled: true,
                        preset: '1d_before',
                        channels: ['phone_push', 'in_app', 'sms']
                      }
                    });
                  }}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* SMS Gateway & Clinic Geo-Routing Settings Modal (Lazy) */}
          {smsGatewayModalOpen && (
            <ModuleErrorBoundary moduleName="تنظیمات درگاه پیامک" onResetToHome={() => setSmsGatewayModalOpen(false)}>
              <Suspense fallback={null}>
                <SmsGatewaySettingsModal
                  isOpen={smsGatewayModalOpen}
                  onClose={() => setSmsGatewayModalOpen(false)}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Slide-Over Clinical HUD Telemetry Drawer */}
          <ClinicalHudDrawer
            isOpen={clinicalHudOpen}
            onClose={() => setClinicalHudOpen(false)}
            patient={selectedPatient}
            patients={patients}
            appointments={appointments}
            onSelectPatient={(p) => setSelectedPatient(p)}
            onOpenPatientFile={(p) => handleOpenPatientFile(p)}
            onOpenPalmerChart={(p) => {
              setSelectedPatient(p);
              setPalmerChartOpen(true);
            }}
            onOpenPaymentModal={(p) => {
              setSelectedPatient(p);
              setAddPaymentModalOpen(true);
            }}
            onOpenAppointmentModal={(p) => {
              setSelectedPatient(p);
              setActiveView('appointments');
              setActiveTab('appointments');
            }}
          />

          {/* Surgical Accessibility, Anti-Glare High-Contrast & Glove Controls Modal */}
          <AccessibilityControlsModal
            isOpen={accessibilityModalOpen}
            onClose={() => setAccessibilityModalOpen(false)}
          />

          {/* One-Handed Thumb Zone Arc Action Sheet */}
          <OneHandedActionSheet
            isOpen={thumbZoneOpen}
            onClose={() => setThumbZoneOpen(false)}
            onQuickAdmission={() => {
              setActiveView('patients');
              setActiveTab('patients');
            }}
            onOpenAppointments={() => {
              setActiveView('appointments');
              setActiveTab('appointments');
            }}
            onOpenPaymentModal={() => setAddPaymentModalOpen(true)}
            onOpenClinicalHud={() => setClinicalHudOpen(true)}
            onOpenPalmerChart={() => setPalmerChartOpen(true)}
            onOpenLabOrders={() => {
              setActiveView('lab');
              setActiveTab('treatments');
            }}
            onOpenUniversalScanner={() => {
              setUniversalScannerScope('all');
              setUniversalScannerOpen(true);
            }}
          />

          {/* Global Command Palette (Ctrl+K / Cmd+K & Header Search Trigger) */}
          <GlobalCommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            patients={patients}
            appointments={appointments}
            inventory={inventory}
            onSelectPatient={(p, tab) => handleOpenPatientFile(p, tab)}
            onOpenPalmerChart={(p) => {
              setSelectedPatient(p);
              setPalmerChartOpen(true);
            }}
            onNavigate={handleServicesNavigate}
            onQuickAdmission={() => {
              setActiveView('patients');
              setActiveTab('patients');
            }}
            onOpenPaymentModal={() => setAddPaymentModalOpen(true)}
            onOpenClinicalHud={() => setClinicalHudOpen(true)}
            onOpenAccessibility={() => setAccessibilityModalOpen(true)}
            onOpenUniversalScanner={() => {
              setUniversalScannerScope('all');
              setUniversalScannerOpen(true);
            }}
          />

          {/* Universal Multi-Engine Clinic QR & Barcode Scanner (Lazy + ErrorBoundary) */}
          {universalScannerOpen && (
            <ModuleErrorBoundary moduleName="اسکنر هوشمند سراسری" onResetToHome={() => setUniversalScannerOpen(false)}>
              <Suspense fallback={null}>
                <UniversalClinicScannerModal
                  isOpen={universalScannerOpen}
                  onClose={() => setUniversalScannerOpen(false)}
                  scope={universalScannerScope}
                  patients={patients}
                  inventory={inventory}
                  onUpdateInventoryStock={(id, newStock) => {
                    let updatedItem: InventoryItem | undefined;
                    setInventory(prev =>
                      prev.map(i => {
                        if (i.id === id) {
                          updatedItem = { ...i, stock: newStock };
                          return updatedItem;
                        }
                        return i;
                      })
                    );
                    if (updatedItem) {
                      supabaseService.saveInventoryItem(updatedItem).catch(() => {});
                      syncEngine.recordOfflineOrLiveMutation({
                        entity: 'inventory',
                        action: 'UPSERT',
                        payload: updatedItem,
                        actorName: currentUser.username,
                        actorRole: currentUser.role,
                        platform: currentUser.assignedPlatform
                      });
                    }
                  }}
                  onRegisterScannedProduct={(newItem) => {
                    setInventory(prev => [newItem, ...prev]);
                    supabaseService.saveInventoryItem(newItem).catch(() => {});
                    syncEngine.recordOfflineOrLiveMutation({
                      entity: 'inventory',
                      action: 'UPSERT',
                      payload: newItem,
                      actorName: currentUser.username,
                      actorRole: currentUser.role,
                      platform: currentUser.assignedPlatform,
                      title: `ثبت خودکار محصول «${newItem.name}» از بارکد`,
                      description: `بارکد: ${newItem.barcode || newItem.id} · موجودی: ${toPersianDigits(newItem.stock)} ${newItem.unit}`
                    });
                  }}
                  onUpdateLabOrderStatus={handleUpdateLabStatus}
                  onScheduleLabDelivery={(pat, order) => {
                    scheduleAppointmentFromModule({
                      patientName: pat.fullName,
                      phone: pat.phone,
                      treatment: `تحویل و سمان ${order.workType} (${order.toothNumber})`,
                      unit: 'یونیت آبی'
                    });
                  }}
                  onOpenPatientFile={(p, tab) => handleOpenPatientFile(p, tab)}
                  onOpenPalmerChart={(p) => {
                    setSelectedPatient(p);
                    setPalmerChartOpen(true);
                  }}
                  onLinkSterilizedPack={(cycleCode, patientId) => {
                    const targetPat = patientIndex.byId.get(patientId) || selectedPatient || patients[0];
                    if (targetPat) {
                      const packNote = `پک استریل اتوکلاو (${cycleCode}) · ${getCurrentPersianDate()}`;
                      const updatedPat: Patient = {
                        ...targetPat,
                        notes: targetPat.notes ? `${targetPat.notes}\n${packNote}` : packNote,
                        treatments: [{
                          id: `trt-ster-${Date.now()}`,
                          tooth: 'یونیت جراحی',
                          treatment: `پک استریل الصاقی لاگ اتوکلاو (${cycleCode})`,
                          cost: 0,
                          date: getCurrentPersianDate(),
                          status: 'completed',
                          doctorName: currentUser.fullName
                        }, ...(targetPat.treatments || [])]
                      };
                      setPatients(prev => prev.map(p => (p.id === targetPat.id ? updatedPat : p)));
                      if (selectedPatient?.id === targetPat.id) setSelectedPatient(updatedPat);
                      indexedDbService.savePatient(updatedPat).catch(() => {});
                      supabaseService.savePatient(updatedPat).catch(() => {});
                    }
                  }}
                  onSayadCheckScanned={(parsed) => {
                    setScannedSayadDraft({ sayadId: parsed.sayadId, bankName: parsed.bankName });
                    setAddCheckModalOpen(true);
                  }}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Global Clinical Action Undo / Redo Toast */}
          <GlobalUndoToast />

          {/* PWA Offline Connectivity Indicator */}
          <OfflineIndicator />

          {/* Master Phased Diagnostic & Verification Test Suite Modal (Lazy) */}
          {phaseAuditModalOpen && (
            <ModuleErrorBoundary moduleName="مرکز ممیزی و تست مراحل" onResetToHome={() => setPhaseAuditModalOpen(false)}>
              <Suspense fallback={null}>
                <PhaseAuditSuiteModal
                  isOpen={phaseAuditModalOpen}
                  onClose={() => setPhaseAuditModalOpen(false)}
                  initialViewMode={phaseAuditInitialTab}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Interactive Real-World Dental Clinic Live Execution Console (Lazy) */}
          {realClinicTestModalOpen && (
            <ModuleErrorBoundary moduleName="کنسول تست واقعی مطب" onResetToHome={() => setRealClinicTestModalOpen(false)}>
              <Suspense fallback={null}>
                <RealWorldClinicTestConsole
                  isOpen={realClinicTestModalOpen}
                  onClose={() => setRealClinicTestModalOpen(false)}
                  patients={patients}
                  appointments={appointments}
                  inventory={inventory}
                  onApplyRealTestData={handleApplyRealTestData}
                  onResetRealTestData={handleResetRealTestData}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Complete Project Archive Download & Link Copier Modal (Lazy) */}
          {projectDownloadModalOpen && (
            <ModuleErrorBoundary moduleName="بسته نصب و دانلود نسخه" onResetToHome={() => setProjectDownloadModalOpen(false)}>
              <Suspense fallback={null}>
                <ProjectDownloadModal
                  isOpen={projectDownloadModalOpen}
                  onClose={() => setProjectDownloadModalOpen(false)}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}

          {/* Global Ultra-Audited Tracking ID Radar & 15-Module Live Seeder Modal */}
          <GlobalAuditTrackerModal
            patients={patients}
            appointments={appointments}
            inventory={inventory}
            onNavigateToModule={(view) => {
              if (view === 'palmer') {
                setPalmerChartOpen(true);
              } else if (view === 'audit_report_table' || view === 'audit_suite') {
                setPhaseAuditInitialTab(view === 'audit_report_table' ? 'audit_report_table' : 'real_world_audit');
                setPhaseAuditModalOpen(true);
              } else {
                handleServicesNavigate(view);
              }
            }}
            onInjectFullClinicLiveData={(payload) => {
              handleApplyRealTestData({
                patient: payload.patient,
                appointment: payload.appointment,
                deductedInventory: payload.updatedInventory
              });
            }}
          />

          {/* Shift Lock Overlay (Password Gate when staff locks tablet/PC) */}
          <ClinicSessionLockOverlay
            isLocked={isSessionLocked}
            users={users}
            onUnlock={unlockWithCredentials}
          />

          {/* Seamless Clinical Chain Prompt for Walk-In / Unregistered Appointments */}
          <ViewportModalPortal isOpen={Boolean(clinicalChainPromptApt)}>
            {clinicalChainPromptApt && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="پذیرش سریع و ورود به درمان"
                dir="rtl"
                className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
              >
                <div className="bg-white w-full max-w-md rounded-[26px] border border-sky-100 shadow-2xl overflow-hidden p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block text-[10.5px] font-black text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-lg mb-1">
                        زنجیره هوشمند نوبت ⇐ تشکیل پرونده ⇐ درمان
                      </span>
                      <h3 className="text-[16px] font-black text-slate-900">
                        پرونده‌ای برای «{clinicalChainPromptApt.patientName}» یافت نشد
                      </h3>
                      <p className="text-[12px] font-bold text-slate-500 mt-1">
                        نوبت ساعت {toPersianDigits(clinicalChainPromptApt.time)} · {clinicalChainPromptApt.treatment}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClinicalChainPromptApt(null)}
                      aria-label="بستن پنجره پذیرش سریع"
                      className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-[16px] border border-slate-200">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-600 block mb-1">نام و نام خانوادگی بیمار</label>
                      <input
                        type="text"
                        value={quickRegName}
                        onChange={(e) => setQuickRegName(e.target.value)}
                        placeholder="نام کامل بیمار"
                        aria-label="نام کامل بیمار"
                        className="w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-[12.5px] font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-600 block mb-1">شماره تماس</label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={quickRegPhone}
                        onChange={(e) => setQuickRegPhone(e.target.value)}
                        placeholder="0912..."
                        aria-label="شماره تماس بیمار"
                        className="w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-[12.5px] font-bold text-left"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        const created = handleAddNewPatient({
                          fullName: quickRegName.trim() || clinicalChainPromptApt.patientName,
                          phone: quickRegPhone.trim() || clinicalChainPromptApt.phone || '۰۹۱۲۰۰۰۰۰۰۰',
                          nationalId: '',
                          age: 30,
                          gender: 'male',
                          insurance: 'آزاد',
                          notes: 'تشکیل پرونده سریع از نوبت‌دهی'
                        });
                        setAppointments(prev =>
                          prev.map(a => a.id === clinicalChainPromptApt.id ? { ...a, patientId: created.id } : a)
                        );
                        setClinicalChainPromptApt(null);
                        setSelectedPatient(created);
                        setPalmerChartOpen(true);
                      }}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-[14px] bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-black text-[13px] shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      ثبت پرونده سریع و ورود به چارت پالمر ✓
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const created = handleAddNewPatient({
                            fullName: quickRegName.trim() || clinicalChainPromptApt.patientName,
                            phone: quickRegPhone.trim() || clinicalChainPromptApt.phone || '۰۹۱۲۰۰۰۰۰۰۰',
                            nationalId: '',
                            age: 30,
                            gender: 'male',
                            insurance: 'آزاد',
                            notes: 'پرونده موقت (اسکیپ پذیرش - تکمیل اطلاعات توسط منشی)'
                          });
                          setAppointments(prev =>
                            prev.map(a => a.id === clinicalChainPromptApt.id ? { ...a, patientId: created.id } : a)
                          );
                          setClinicalChainPromptApt(null);
                          setSelectedPatient(created);
                          setPalmerChartOpen(true);
                        }}
                        className="min-h-[42px] py-2 px-3 rounded-[12px] bg-amber-50 border border-amber-300 text-amber-900 font-black text-[11.5px] cursor-pointer active:scale-95 transition-all"
                      >
                        رد شدن (ثبت بعدی) ⇐ پالمر
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdmissionPrefillPhone(quickRegPhone || clinicalChainPromptApt.phone || null);
                          setClinicalChainPromptApt(null);
                          setActiveView('patients');
                          setActiveTab('patients');
                        }}
                        className="min-h-[42px] py-2 px-3 rounded-[12px] bg-sky-50 border border-sky-200 text-sky-800 font-black text-[11.5px] cursor-pointer active:scale-95 transition-all"
                      >
                        پذیرش کامل بیماران
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ViewportModalPortal>

          {/* Standalone Lab Arrival Prompt: Schedule Cementation Appointment immediately */}
          <ViewportModalPortal isOpen={Boolean(labArrivalPrompt)}>
            {labArrivalPrompt && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="دریافت پروتز از لابراتوار و زمان‌بندی تحویل"
                dir="rtl"
                className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
              >
                <div className="bg-white w-full max-w-md rounded-[26px] border border-emerald-200 shadow-2xl overflow-hidden p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block text-[10.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg mb-1">
                        پروتز به مطب رسید ✓
                      </span>
                      <h3 className="text-[16px] font-black text-slate-900">
                        {labArrivalPrompt.order.workType} · {labArrivalPrompt.patient.fullName}
                      </h3>
                      <p className="text-[12px] font-bold text-slate-500 mt-1">
                        {labArrivalPrompt.order.toothNumber} · {labArrivalPrompt.order.labName}
                        {labArrivalPrompt.order.trackingSlipCode ? ` · قبض ${labArrivalPrompt.order.trackingSlipCode}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLabArrivalPrompt(null)}
                      aria-label="بستن اعلان دریافت لابراتوار"
                      className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-[12px] font-bold text-slate-600 bg-emerald-50/70 border border-emerald-200 rounded-[14px] p-3">
                    اعلان روی گوشی ثبت شد و زمان پیگیری برای هماهنگی با بیمار فعال گردید. آیا مایلید همین الان نوبت تحویل / سمان بیمار را در تقویم ثبت کنید؟
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const { patient, order } = labArrivalPrompt;
                        setLabArrivalPrompt(null);
                        scheduleAppointmentFromModule({
                          patientName: patient.fullName,
                          phone: patient.phone,
                          treatment: `تحویل و سمان ${order.workType} (${order.toothNumber})`,
                          unit: 'یونیت آبی'
                        });
                      }}
                      className="min-h-[44px] py-2.5 px-3 rounded-[14px] bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-black text-[12px] shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      تنظیم نوبت سمان در تقویم
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabArrivalPrompt(null)}
                      className="min-h-[44px] py-2.5 px-3 rounded-[14px] bg-slate-100 text-slate-700 font-black text-[12px] cursor-pointer active:scale-95 transition-all"
                    >
                      فعلاً باشد ✓
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ViewportModalPortal>

        </div>
      </div>
  );
}
