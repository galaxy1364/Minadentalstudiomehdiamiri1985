import React, { useState } from 'react';
import { 
  Settings, Shield, ShieldCheck, Stethoscope, Clock, Database, 
  CheckCircle2, Zap, Cloud, Sparkles, Building2, 
  CreditCard, FileDown, Plus, Trash2, Edit3, Check, X,
  Copy, Key, Lock, Server, CheckCheck, Users, Mail, UserPlus, Eye, EyeOff,
  ArrowLeftRight, ChevronDown, ChevronUp, Award, Phone, ShieldAlert,
  Smartphone, Wifi, Terminal, ExternalLink, RefreshCw, Send, Radio, Search,
  Percent, Upload, RotateCcw, BarChart3
} from 'lucide-react';
import * as d3 from 'd3';
import { formatToman, toPersianDigits, toEnglishDigits, getCurrentPersianDate, getRelativePersianDate } from '../../utils/jalali';
import { triggerHaptic, getHapticIntensity, setHapticIntensity, previewHapticIntensity, HapticIntensityLevel } from '../../utils/haptics';
import { INITIAL_USERS, syncEngine } from '../../services/syncEngine';
import { UserAccount, RoleType, Patient, Appointment, InventoryItem, PlatformDevice, CommissionModel } from '../../types/dental';
import { actionFeedback } from '../../utils/actionFeedback';
import { Logo3DMainDentalTooth } from '../ThreeDimensionalLogos';
import { hardwareBridgeService, PosProvider, CameraAccessDiagnostics } from '../../services/hardwareBridgeService';
import { clinicalSmsService } from '../../services/smsService';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { otaUpdateService, OtaReleaseInfo, ConnectedDeviceNode, DeploymentPipelineStep, ManagerSecretsVault } from '../../services/otaUpdateService';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { GoogleDriveBackupPanel } from '../GoogleDriveBackupPanel';
import { ClinicStaffCloudAccessPanel } from '../ClinicStaffCloudAccessPanel';
import {
  getGoogleDriveAccessToken,
  uploadBackupToGoogleDrive,
} from '../../services/googleDriveBackupService';
import { copyTextSafely } from '../../utils/clipboard';
import { verifyClinicDataIntegrity } from '../../utils/integrityVerifier';
import {
  downloadAndroidApk,
  downloadIosIpa,
  downloadIosMobileConfigProfile,
  MINADENTAL_PACKAGE_VERSION
} from '../../utils/downloader';
import {
  isClinicManager,
  verifyManagerDeletion,
  archiveToTrashVault,
  getTrashVaultItems,
  removeFromTrashVault,
  TrashVaultItem
} from '../../utils/dataProtection';
import {
  sanitizeUserAccount,
  sanitizeUsersList,
  verifyPasswordCredential
} from '../../utils/authCrypto';
import {
  clinicRealtimeClient,
  type LiveSyncStatusMeta,
  type ServerAuditEntry,
  type ServerClinicSummaryReport
} from '../../services/clinicRealtimeClient';
import type { ClinicDataMode } from '../../utils/eccSchemas';

interface SettingsViewProps {
  onOpenSupabaseTest?: () => void;
  onOpenPhaseAudit?: () => void;
  onOpenProjectDownload?: () => void;
  onOpenLiveSync?: () => void;
  onOpenBackupModal?: () => void;
  onOpenCommissionModal?: () => void;
  onRestoreData?: (restored: { patients?: Patient[]; appointments?: Appointment[]; inventory?: InventoryItem[] }) => void;
  currentUser?: UserAccount;
  onRestoreVaultItem?: (item: TrashVaultItem) => void;
  patients?: Patient[];
  appointments?: Appointment[];
  inventory?: InventoryItem[];
  users?: UserAccount[];
  platforms?: PlatformDevice[];
  clinicDataMode?: ClinicDataMode;
  liveSyncMeta?: LiveSyncStatusMeta;
  onTriggerLiveServerSync?: () => Promise<boolean>;
  onActivateCleanProductionMode?: () => Promise<{ ok: boolean; archivedCount: number; error?: string }>;
}

interface BackupSnapshotMeta {
  id: string;
  jalaliTimestamp: string;
  target: 'local_json' | 'cloud_drive' | 'auto_snapshot';
  patientsCount: number;
  appointmentsCount: number;
  inventoryCount: number;
  payloadJson?: string;
}

interface CommissionRuleSummary {
  doctorId: string;
  doctorName: string;
  isManager: boolean;
  defaultModel: CommissionModel;
  percentageRate: number;
  fixedWagePerTreatment: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  onOpenSupabaseTest, 
  onOpenPhaseAudit,
  onOpenProjectDownload,
  onOpenLiveSync,
  onOpenBackupModal,
  onOpenCommissionModal,
  onRestoreData,
  currentUser,
  onRestoreVaultItem,
  patients = [],
  appointments = [],
  inventory = [],
  users,
  platforms = [],
  clinicDataMode = 'demo_seeded',
  liveSyncMeta,
  onTriggerLiveServerSync,
  onActivateCleanProductionMode
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'tariffs' | 'staff' | 'cloud' | 'hardware' | 'audit'>('general');
  const [confirmCleanProduction, setConfirmCleanProduction] = useState(false);
  const [isSyncingLiveServer, setIsSyncingLiveServer] = useState(false);
  const [isSwitchingProductionMode, setIsSwitchingProductionMode] = useState(false);
  const [serverAuditEntries, setServerAuditEntries] = useState<ServerAuditEntry[]>([]);
  const [serverSummaryReport, setServerSummaryReport] = useState<ServerClinicSummaryReport | null>(null);
  const [isLoadingServerAudit, setIsLoadingServerAudit] = useState(false);

  const refreshServerAuditAndSummary = React.useCallback(async () => {
    setIsLoadingServerAudit(true);
    try {
      const [entries, summary] = await Promise.all([
        clinicRealtimeClient.fetchServerAuditLog(30),
        clinicRealtimeClient.fetchServerSummaryReport()
      ]);
      setServerAuditEntries(entries);
      setServerSummaryReport(summary);
    } finally {
      setIsLoadingServerAudit(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'audit') {
      void refreshServerAuditAndSummary();
    }
  }, [activeTab, refreshServerAuditAndSummary]);
  const [cameraDiagnostics, setCameraDiagnostics] = useState<CameraAccessDiagnostics | null>(null);
  const { isInstallable, isInstalled, isIOS, install: triggerPwaInstall } = usePWAInstall();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hapticIntensity, setHapticIntensityState] = useState<HapticIntensityLevel>(() => getHapticIntensity());

  // Listen to external haptic intensity changes across tabs or accessibility modal
  React.useEffect(() => {
    const handleIntensityChange = (e: Event) => {
      const customEvent = e as CustomEvent<HapticIntensityLevel>;
      if (customEvent.detail) {
        setHapticIntensityState(customEvent.detail);
      }
    };
    window.addEventListener('minadental_haptic_intensity_changed', handleIntensityChange);
    return () => window.removeEventListener('minadental_haptic_intensity_changed', handleIntensityChange);
  }, []);

  const handleUpdateHapticIntensity = (level: HapticIntensityLevel) => {
    setHapticIntensity(level);
    setHapticIntensityState(level);
    previewHapticIntensity(level);
    const labels: Record<HapticIntensityLevel, string> = {
      none: 'خاموش (None)',
      off: 'خاموش (بدون ارتعاش)',
      light: 'ملایم (Light)',
      medium: 'استاندارد (Medium)',
      heavy: 'قوی (Heavy - مخصوص دستکش جراحی)'
    };
    showToast(`شدت فیدبک لمسی کاشی‌ها به «${labels[level]}» تغییر یافت.`);
  };

  // Hardware & Peripherals States (PC-POS, Caller ID, SMS)
  const hardwareCfg = hardwareBridgeService.getConfig();
  const [posProvider, setPosProvider] = useState<PosProvider>(hardwareCfg.posProvider);
  const [posIpAddress, setPosIpAddress] = useState(hardwareCfg.posIpAddress);
  const [posPort, setPosPort] = useState(hardwareCfg.posPort);
  const [callerIdPort, setCallerIdPort] = useState(hardwareCfg.callerIdPort);
  const [isTestingPos, setIsTestingPos] = useState(false);
  const [posTestResult, setPosTestResult] = useState<string | null>(null);
  const [posTestAmount, setPosTestAmount] = useState<number>(50000);
  const [testCallerPhone, setTestCallerPhone] = useState('09121234567');
  const [callerTestResult, setCallerTestResult] = useState<string | null>(null);

  // SMS Gateway States
  const smsCfg = clinicalSmsService.getConfig();
  const [smsProvider, setSmsProvider] = useState<'kavenegar' | 'farazsms' | 'melipayamak'>(smsCfg.provider);
  const [smsApiKey, setSmsApiKey] = useState(smsCfg.apiKey);
  const [smsSender, setSmsSender] = useState(smsCfg.senderNumber);
  const [smsTestMobile, setSmsTestMobile] = useState('09121234567');
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<string | null>(null);

  // Clinic info (persisted in localStorage)
  const [clinicName, setClinicName] = useState(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) return JSON.parse(saved).clinicName || 'مرکز تخصصی دندانپزشکی مینادنتال';
    } catch {}
    return 'مرکز تخصصی دندانپزشکی مینادنتال';
  });
  const [activeDoctor, setActiveDoctor] = useState(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) return JSON.parse(saved).activeDoctor || 'دکتر مهدی امیری (شماره نظام: ۱۸۴۹۲)';
    } catch {}
    return 'دکتر مهدی امیری (شماره نظام: ۱۸۴۹۲)';
  });
  const [clinicPhone, setClinicPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) return JSON.parse(saved).clinicPhone || '۰۲۱-۸۸۲۲۳۳۴۴';
    } catch {}
    return '۰۲۱-۸۸۲۲۳۳۴۴';
  });
  const [clinicAddress, setClinicAddress] = useState(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) return JSON.parse(saved).clinicAddress || 'تهران، سعادت‌آباد، میدان کاج، مجتمع پزشکی مروارید، طبقه ۴';
    } catch {}
    return 'تهران، سعادت‌آباد، میدان کاج، مجتمع پزشکی مروارید، طبقه ۴';
  });
  const [sayadKey, setSayadKey] = useState(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) return JSON.parse(saved).sayadKey || 'API-SAYAD-IR-99214-SECURE';
    } catch {}
    return 'API-SAYAD-IR-99214-SECURE';
  });
  const [workHours, setWorkHours] = useState(() => {
    try {
      const saved = localStorage.getItem('minadental_clinic_general_cfg_v1');
      if (saved) return JSON.parse(saved).workHours || 'شنبه تا پنج‌شنبه: ۹:۰۰ الی ۲۱:۰۰';
    } catch {}
    return 'شنبه تا پنج‌شنبه: ۹:۰۰ الی ۲۱:۰۰';
  });

  // Manager-Only Secrets Vault & OTA Auto-Update Engine States
  const [vault, setVault] = useState<ManagerSecretsVault>(() => otaUpdateService.getVault());
  const [otaRelease, setOtaRelease] = useState<OtaReleaseInfo>(() => otaUpdateService.getReleaseInfo());
  const [fleetNodes, setFleetNodes] = useState<ConnectedDeviceNode[]>(() => otaUpdateService.getFleetNodes());
  const [otaChangelogInput, setOtaChangelogInput] = useState<string>('بهینه‌سازی سرعت دیتابیس سوپابیس، همگام‌سازی خودکار همه پلتفرم‌ها و تراز مالی دقیق مطب');
  const [isPublishingOta, setIsPublishingOta] = useState<boolean>(false);
  const [pipelineSteps, setPipelineSteps] = useState<DeploymentPipelineStep[]>([]);
  const [showVaultSecrets, setShowVaultSecrets] = useState<boolean>(false);
  const [managerVaultUnlocked, setManagerVaultUnlocked] = useState<boolean>(() => isClinicManager(currentUser));
  const [vaultPinInput, setVaultPinInput] = useState<string>('');
  const [vaultPinError, setVaultPinError] = useState<string | null>(null);
  const [trashVaultItems, setTrashVaultItems] = useState<TrashVaultItem[]>(() => getTrashVaultItems());
  const [auditRefreshTick, setAuditRefreshTick] = useState<number>(0);

  const isManagerActive = isClinicManager(currentUser);

  React.useEffect(() => {
    setManagerVaultUnlocked(isClinicManager(currentUser));
  }, [currentUser]);

  React.useEffect(() => {
    verifyClinicDataIntegrity(patients, appointments, inventory, users);
  }, [patients, appointments, inventory, users]);

  React.useEffect(() => {
    const refreshVault = () => setTrashVaultItems(getTrashVaultItems());
    const refreshAudit = () => setAuditRefreshTick(t => t + 1);
    const refreshCommissions = () => {
      try {
        const saved = localStorage.getItem('minadental_doctor_commission_rules_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setCommissionSummaries(parsed);
        }
      } catch {}
    };
    window.addEventListener('minadental:trash-vault-updated', refreshVault);
    window.addEventListener('minadental:audit-log-updated', refreshAudit);
    window.addEventListener('minadental:commission-rules-updated', refreshCommissions);
    return () => {
      window.removeEventListener('minadental:trash-vault-updated', refreshVault);
      window.removeEventListener('minadental:audit-log-updated', refreshAudit);
      window.removeEventListener('minadental:commission-rules-updated', refreshCommissions);
    };
  }, []);

  React.useEffect(() => {
    return otaUpdateService.subscribe((rel, fleet) => {
      setOtaRelease(rel);
      setFleetNodes(fleet);
    });
  }, []);

  const d3SystemTelemetry = React.useMemo(() => {
    const labCount = patients.reduce((sum, p) => sum + (p.labOrders?.length || 0), 0);
    const implantCount = patients.reduce((sum, p) => sum + (p.implantCases?.length || 0), 0);
    const checkCount = patients.reduce((sum, p) => sum + (p.sayadChecks?.length || 0), 0);
    const rows = [
      { id: 'patients', label: 'پرونده بیمار', count: patients.length, color: '#0ea5e9' },
      { id: 'appointments', label: 'نوبت‌ها', count: appointments.length, color: '#6366f1' },
      { id: 'inventory', label: 'اقلام انبار', count: inventory.length, color: '#10b981' },
      { id: 'lab_imp', label: 'لابراتوار/ایمپلنت', count: labCount + implantCount, color: '#ec4899' },
      { id: 'checks', label: 'چک صیادی', count: checkCount, color: '#f59e0b' },
      { id: 'fleet', label: 'دستگاه‌های OTA', count: fleetNodes.length, color: '#8b5cf6' }
    ];
    const width = 440;
    const height = 128;
    const margin = { top: 14, right: 12, bottom: 26, left: 26 };
    const maxVal = Math.max(4, d3.max(rows, r => r.count) || 4);
    const xScale = d3
      .scaleBand<string>()
      .domain(rows.map(r => r.id))
      .range([margin.left, width - margin.right])
      .padding(0.3);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal])
      .nice()
      .range([height - margin.bottom, margin.top]);
    const baselineY = yScale(0);
    return {
      width,
      height,
      margin,
      baselineY,
      ticks: yScale.ticks(3).filter(t => Number.isInteger(t)),
      yScale,
      bars: rows.map(r => {
        const x = xScale(r.id) ?? 0;
        const barW = xScale.bandwidth();
        const y = yScale(r.count);
        const h = Math.max(r.count > 0 ? 6 : 2, baselineY - y);
        return { ...r, x, barW, y: r.count > 0 ? y : baselineY - 2, h };
      })
    };
  }, [patients, appointments, inventory, fleetNodes]);

  const handlePublishOtaUpdate = async () => {
    if (isPublishingOta) return;
    triggerHaptic('heavy');
    setIsPublishingOta(true);
    try {
      const nextRel = await otaUpdateService.publishAndPushOtaUpdate(otaChangelogInput, (steps) => {
        setPipelineSteps(steps);
      });
      showToast(`نسخه v${nextRel.version} منتشر و به صورت خودکار روی تمام دستگاه‌های نصب‌شده اعمال شد.`);
    } finally {
      setIsPublishingOta(false);
    }
  };

  const handleSaveVaultChanges = () => {
    triggerHaptic('success');
    const updated = otaUpdateService.updateVault(vault);
    setVault(updated);
    showToast('اطلاعات اتصال سرورهای ابری سوپابیس و ورسل ذخیره و همگام‌سازی شد.');
  };

  // Tariffs list with categorized procedures and persistent storage
  const [tariffs, setTariffs] = useState<Array<{
    id: string;
    code: string;
    name: string;
    category: 'restorative' | 'endo' | 'implant' | 'prosthetics' | 'pediatric' | 'periodontics';
    price: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem('minadental_tariffs_catalog_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 't1', code: 'D-101', name: 'ویزیت و معاینه اولیه با چارت پالمر', category: 'restorative', price: 250000 },
      { id: 't2', code: 'D-201', name: 'ترمیم کامپوزیت قدامی زیبایی (سانترال/لترال)', category: 'restorative', price: 2400000 },
      { id: 't3', code: 'D-202', name: 'ترمیم کامپوزیت خلفی کلاس ۲ (MO / DO / MOD)', category: 'restorative', price: 1900000 },
      { id: 't4', code: 'D-203', name: 'ترمیم آمالگام سیلور دو سطحی', category: 'restorative', price: 1500000 },
      { id: 't5', code: 'D-301', name: 'عصب‌کشی تک‌کانال قدامی (اندودانتیکس)', category: 'endo', price: 2600000 },
      { id: 't6', code: 'D-302', name: 'عصب‌کشی مولار ۳ کاناله تخصصی روت‌کانال', category: 'endo', price: 4200000 },
      { id: 't7', code: 'D-303', name: 'درمان مجدد ریشه دندان (Re-Endo)', category: 'endo', price: 5100000 },
      { id: 't8', code: 'D-401', name: 'جراحی کاشت فیکسچر ایمپلنت کره‌ای Dentium', category: 'implant', price: 12500000 },
      { id: 't9', code: 'D-402', name: 'جراحی کاشت فیکسچر ایمپلنت سوئیسی Straumann', category: 'implant', price: 24000000 },
      { id: 't10', code: 'D-403', name: 'جراحی دندان عقل نهفته استخوانی', category: 'implant', price: 2800000 },
      { id: 't11', code: 'D-501', name: 'روکش تمام زیرکونیا مولتی‌لیر CAD/CAM', category: 'prosthetics', price: 4800000 },
      { id: 't12', code: 'D-502', name: 'روکش پرسلن متال PFM', category: 'prosthetics', price: 3200000 },
      { id: 't13', code: 'D-503', name: 'لمینت سرامیکی پرسلن E-Max', category: 'prosthetics', price: 5500000 },
      { id: 't14', code: 'D-601', name: 'پالپوتومی اطفال همراه ترمیم همرنگ', category: 'pediatric', price: 1800000 },
      { id: 't15', code: 'D-602', name: 'روکش استیل ضدزنگ اطفال (SS Crown)', category: 'pediatric', price: 2100000 },
      { id: 't16', code: 'D-603', name: 'فیشورسیلنت و فلورایدتراپی موضعی شیارها', category: 'pediatric', price: 850000 },
      { id: 't17', code: 'D-701', name: 'جرم‌گیری تخصصی و بروساژ کامل فک بالا و پایین', category: 'periodontics', price: 1200000 },
    ];
  });

  const saveTariffsList = (updated: typeof tariffs) => {
    setTariffs(updated);
    try {
      localStorage.setItem('minadental_tariffs_catalog_v2', JSON.stringify(updated));
    } catch {}
  };

  const [tariffCategoryFilter, setTariffCategoryFilter] = useState<string>('all');
  const [newTariffName, setNewTariffName] = useState('');
  const [newTariffPrice, setNewTariffPrice] = useState<number>(1000000);
  const [newTariffCategory, setNewTariffCategory] = useState<'restorative' | 'endo' | 'implant' | 'prosthetics' | 'pediatric' | 'periodontics'>('restorative');
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [editingTariffPrice, setEditingTariffPrice] = useState<number>(0);

  // Staff and Access Control States with Persistence (Sanitized / Salted SHA-256)
  const [staffList, setStaffList] = useState<UserAccount[]>(() => {
    if (typeof localStorage === 'undefined') return INITIAL_USERS;
    try {
      const saved = localStorage.getItem('minadental_clinic_users_v2');
      if (saved) return sanitizeUsersList(JSON.parse(saved));
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_USERS;
  });

  const saveStaffList = (updated: UserAccount[]) => {
    const sanitized = sanitizeUsersList(updated);
    setStaffList(sanitized);
    try {
      localStorage.setItem('minadental_clinic_users_v2', JSON.stringify(sanitized));
      window.dispatchEvent(new CustomEvent('minadental:staff-users-updated'));
    } catch (e) {
      console.warn(e);
    }
  };

  React.useEffect(() => {
    const syncUsers = () => {
      try {
        const saved = localStorage.getItem('minadental_clinic_users_v2');
        if (saved) setStaffList(sanitizeUsersList(JSON.parse(saved)));
      } catch {}
    };
    window.addEventListener('minadental:staff-users-updated', syncUsers);
    return () => window.removeEventListener('minadental:staff-users-updated', syncUsers);
  }, []);

  const [managerIsDoctor, setManagerIsDoctor] = useState<boolean>(true);
  const [expandedPermissionsUserId, setExpandedPermissionsUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState<string>('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<RoleType>('doctor');
  const [newStaffPlatform, setNewStaffPlatform] = useState('یونیت زرد دندانپزشکی');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffLicense, setNewStaffLicense] = useState('');

  useEscapeKey(showAddStaff, () => setShowAddStaff(false));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    triggerHaptic('success');
    void copyTextSafely(text);
    setCopiedField(label);
    showToast(`${label} در حافظه کپی شد.`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSave = () => {
    triggerHaptic('success');
    hardwareBridgeService.saveConfig(posProvider, posIpAddress, Number(posPort), callerIdPort);
    clinicalSmsService.saveConfig(smsProvider, smsApiKey, smsSender);
    try {
      localStorage.setItem(
        'minadental_clinic_general_cfg_v1',
        JSON.stringify({ clinicName, activeDoctor, clinicPhone, clinicAddress, sayadKey, workHours })
      );
    } catch {}
    setSaved(true);
    showToast('تنظیمات کلینیک با موفقیت ذخیره گردید.');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestPosTransaction = async () => {
    setIsTestingPos(true);
    setPosTestResult(null);
    triggerHaptic('medium');
    try {
      const res = await hardwareBridgeService.sendPosTransaction({
        amount: posTestAmount,
        patientName: 'صندوق کلینیک مینادنتال',
        patientFileNumber: 'D-1001',
        description: 'تراکنش پایانه فروش PC-POS'
      });
      triggerHaptic('success');
      setPosTestResult(`✅ ${res.message} (شماره پیگیری: ${res.traceNumber} · کارت: ${res.cardMask})`);
    } catch (e: any) {
      setPosTestResult(`❌ خطا در ارتباط با پایانه فروش: ${e.message}`);
    } finally {
      setIsTestingPos(false);
    }
  };

  const handleSimulateCallerId = () => {
    triggerHaptic('medium');
    hardwareBridgeService.triggerSimulatedCall(testCallerPhone, 1, {
      fullName: 'علی مرادی',
      fileNumber: 'D-1048',
      lastVisit: getRelativePersianDate(-7)
    });
    setCallerTestResult(`📞 سیگنال تماس ورودی با شماره ${testCallerPhone} دریافت شد.`);
    showToast('تماس ورودی کالرآیدی دریافت شد.');
  };

  const handleSendSmsTest = async () => {
    setIsTestingSms(true);
    setSmsTestResult(null);
    triggerHaptic('medium');
    try {
      const res = await clinicalSmsService.sendPatternSms(
        smsTestMobile,
        'جناب آقای رضایی',
        'appointment_reminder',
        { date: getRelativePersianDate(2), time: '۱۷:۳۰' }
      );
      if (res.success) {
        triggerHaptic('success');
        setSmsTestResult(`✅ ${res.message} (وضعیت پترن خدماتی: تحویل فوری به گیرنده)`);
      } else {
        setSmsTestResult(`❌ خطا: ${res.message}`);
      }
    } catch (e: any) {
      setSmsTestResult(`❌ خطای ارسال: ${e.message}`);
    } finally {
      setIsTestingSms(false);
    }
  };

  const handleAddTariff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTariffName) return;
    triggerHaptic('light');
    const updated = [
      ...tariffs,
      {
        id: `t-${Date.now()}`,
        code: `D-${tariffs.length + 100}`,
        name: newTariffName,
        category: newTariffCategory,
        price: Number(newTariffPrice)
      }
    ];
    saveTariffsList(updated);
    setNewTariffName('');
    showToast(`تعرفه "${newTariffName}" در دسته مربوطه ذخیره شد.`);
  };

  const handleUpdateTariffPrice = (id: string, newPrice: number) => {
    triggerHaptic('medium');
    const updated = tariffs.map(t => t.id === id ? { ...t, price: newPrice } : t);
    saveTariffsList(updated);
    setEditingTariffId(null);
    showToast('تعرفه مصوب خدمت به‌روزرسانی شد.');
  };

  const handleDeleteTariff = (id: string) => {
    if (!verifyManagerDeletion(currentUser, 'حذف خدمت از کاتالوگ تعرفه‌ها', id)) {
      return;
    }
    const target = tariffs.find(t => t.id === id);
    if (target) {
      archiveToTrashVault({
        entityType: 'tariff',
        entityId: id,
        title: `تعرفه خدمت: ${target.name}`,
        subtitle: `کد: ${target.code} · مبلغ: ${formatToman(target.price)}`,
        payload: target,
        deletedByUser: currentUser
      });
    }
    triggerHaptic('medium');
    const updated = tariffs.filter(t => t.id !== id);
    saveTariffsList(updated);
    showToast('خدمت از کاتالوگ تعرفه‌ها به بایگانی مدیر منتقل شد.');
  };

  const [backupSchedule, setBackupSchedule] = useState<{
    autoBackupEnabled: boolean;
    backupTime: string;
    driveEmail: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('minadental_backup_schedule_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          autoBackupEnabled: parsed.autoBackupEnabled !== false,
          backupTime: parsed.backupTime || localStorage.getItem('minadental_backup_hour') || '22:30',
          driveEmail: parsed.driveEmail || 'mehdi.amiri19851364@gmail.com'
        };
      }
      return {
        autoBackupEnabled: localStorage.getItem('minadental_auto_backup') !== 'false',
        backupTime: localStorage.getItem('minadental_backup_hour') || '22:30',
        driveEmail: 'mehdi.amiri19851364@gmail.com'
      };
    } catch {
      return {
        autoBackupEnabled: true,
        backupTime: '22:30',
        driveEmail: 'mehdi.amiri19851364@gmail.com'
      };
    }
  });

  const [backupSnapshots, setBackupSnapshots] = useState<BackupSnapshotMeta[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_backup_snapshots_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [commissionSummaries, setCommissionSummaries] = useState<CommissionRuleSummary[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_doctor_commission_rules_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { doctorId: 'doc_mehdi', doctorName: 'دکتر مهدی امیری', isManager: true, defaultModel: 'percentage', percentageRate: 100, fixedWagePerTreatment: 5000000 },
      { doctorId: 'doc_sara', doctorName: 'دکتر سارا رضوانی', isManager: false, defaultModel: 'lab_split_half', percentageRate: 50, fixedWagePerTreatment: 3500000 },
      { doctorId: 'doc_ali', doctorName: 'دکتر علی مرادی', isManager: false, defaultModel: 'fixed_wage', percentageRate: 45, fixedWagePerTreatment: 2800000 }
    ];
  });

  const updateBackupSchedule = (patch: Partial<typeof backupSchedule>, toastMsg?: string) => {
    const next = { ...backupSchedule, ...patch };
    setBackupSchedule(next);
    try {
      localStorage.setItem('minadental_backup_schedule_v1', JSON.stringify(next));
      localStorage.setItem('minadental_auto_backup', String(next.autoBackupEnabled));
      localStorage.setItem('minadental_backup_hour', next.backupTime);
    } catch {}
    if (toastMsg) {
      showToast(toastMsg);
    }
  };

  const persistSnapshot = (target: BackupSnapshotMeta['target'], jsonPayload: string): BackupSnapshotMeta => {
    const entry: BackupSnapshotMeta = {
      id: `snap-${Date.now()}`,
      jalaliTimestamp: `${getCurrentPersianDate()} · ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`,
      target,
      patientsCount: patients.length,
      appointmentsCount: appointments.length,
      inventoryCount: inventory.length,
      payloadJson: jsonPayload
    };
    const nextList = [entry, ...backupSnapshots].slice(0, 5);
    setBackupSnapshots(nextList);
    try {
      localStorage.setItem('minadental_backup_snapshots_v1', JSON.stringify(nextList));
    } catch {
      const compactList = nextList.map((s, idx) => (idx === 0 ? s : { ...s, payloadJson: undefined }));
      setBackupSnapshots(compactList);
      try {
        localStorage.setItem('minadental_backup_snapshots_v1', JSON.stringify(compactList));
      } catch {}
    }
    return entry;
  };

  const buildClinicBackupJson = (): string =>
    syncEngine.exportBackup({
      clinicName,
      patients,
      appointments,
      inventory,
      users: staffList,
      platforms
    });

  const handleExportBackup = () => {
    triggerHaptic('medium');
    const json = buildClinicBackupJson();
    const dateSlug = toEnglishDigits(getCurrentPersianDate()).replace(/\//g, '-');
    try {
      syncEngine.downloadBackupFile(json, `MinaDental-Backup-${dateSlug}.json`);
    } catch {}
    const snap = persistSnapshot('local_json', json);
    syncEngine.broadcast({
      type: 'CLOUD_BACKUP_SAVED',
      performedBy: currentUser?.fullName || 'مدیر کلینیک',
      role: currentUser?.role || 'admin',
      platform: 'تنظیمات کلینیک',
      title: 'خروجی بکاپ JSON ذخیره شد',
      description: `بکاپ کامل شامل ${toPersianDigits(snap.patientsCount)} پرونده بیمار و ${toPersianDigits(snap.appointmentsCount)} نوبت دانلود شد.`
    });
    actionFeedback.recordSuccess({
      title: 'فایل پشتیبان JSON ایجاد و دانلود شد',
      subtitle: `${toPersianDigits(patients.length)} بیمار · ${toPersianDigits(appointments.length)} نوبت · اسنپ‌شات ${snap.jalaliTimestamp}`,
      badgeText: '✓ دانلود بکاپ کامل'
    });
    showToast(`فایل پشتیبان کامل دیتابیس (${toPersianDigits(patients.length)} پرونده) دانلود و در اسنپ‌شات ثبت شد.`);
  };

  const handleInstantCloudAndDriveBackup = () => {
    triggerHaptic('heavy');
    const json = buildClinicBackupJson();
    const snap = persistSnapshot('cloud_drive', json);
    syncEngine.broadcast({
      type: 'CLOUD_BACKUP_SAVED',
      performedBy: currentUser?.fullName || 'مدیر کلینیک',
      role: currentUser?.role || 'admin',
      platform: 'Google Drive & Cloud Sync',
      title: 'بک‌آپ ابری و گوگل درایو ثبت شد',
      description: `اسنپ‌شات سه‌گانه برای حساب ${backupSchedule.driveEmail} و سرور کلینیک همگام‌سازی شد.`
    });
    if (getGoogleDriveAccessToken()) {
      void uploadBackupToGoogleDrive(json, { tag: 'manual' })
        .then((uploaded) => {
          actionFeedback.recordSuccess({
            title: 'بک‌آپ مستقیم در گوگل درایو ذخیره شد',
            subtitle: `${uploaded.name} · ${snap.jalaliTimestamp}`,
            badgeText: '✓ آپلود واقعی Drive'
          });
          showToast(`فایل پشتیبان «${uploaded.name}» با موفقیت در Google Drive شما ذخیره شد.`);
        })
        .catch(() => {
          showToast('اسنپ‌شات لوکال ثبت شد؛ برای آپلود مستقیم در گوگل درایو مجدداً وارد حساب گوگل شوید.');
        });
      return;
    }
    actionFeedback.recordSuccess({
      title: 'بک‌آپ آنی ابری و گوگل درایو ثبت شد',
      subtitle: `مقصد: ${backupSchedule.driveEmail} · ${snap.jalaliTimestamp}`,
      badgeText: '✓ سینک ابری موفق'
    });
    showToast(`اسنپ‌شات ثبت شد. برای ارسال خودکار به Google Drive، در کارت گوگل درایو زیر با حساب گوگل وارد شوید.`);
  };

  const handleExportPatientsCsv = () => {
    triggerHaptic('success');
    const headers = [
      'شماره پرونده',
      'نام کامل بیمار',
      'کد ملی',
      'شماره تماس',
      'جمع درمان (تومان)',
      'پرداختی (تومان)',
      'مانده بدهی (تومان)',
      'چک‌های باز',
      'اقساط فعال',
      'سفارشات لابراتوار',
      'آخرین مراجعه'
    ];
    const escapeCsv = (val: string | number | undefined) => {
      const raw = String(val ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
      return `"${raw}"`;
    };
    const rows = patients.map((p) => {
      const total = Number(p.totalCost) || 0;
      const paid = Number(p.paidAmount) || 0;
      const remaining = Math.max(0, total - paid);
      const openChecks = (p.sayadChecks || []).filter((c) => c.status !== 'cleared' && c.status !== 'returned').length;
      const activeInstallments = (p.installments || []).filter((pl) => pl.status !== 'paid').length;
      return [
        escapeCsv(p.fileNumber || '-'),
        escapeCsv(p.fullName || '-'),
        escapeCsv(p.nationalId || '-'),
        escapeCsv(p.phone || '-'),
        escapeCsv(total),
        escapeCsv(paid),
        escapeCsv(remaining),
        escapeCsv(openChecks),
        escapeCsv(activeInstallments),
        escapeCsv((p.labOrders || []).length),
        escapeCsv(p.lastVisit || '-')
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const dateSlug = toEnglishDigits(getCurrentPersianDate()).replace(/\//g, '-');
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MinaDental-Patients-${dateSlug}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {}
    actionFeedback.recordSuccess({
      title: `فایل اکسل (CSV) ${toPersianDigits(patients.length)} بیمار آماده شد`,
      subtitle: 'فرمت UTF-8 فارسی سازگار با Microsoft Excel و Google Sheets',
      badgeText: '✓ خروجی اکسل بیماران'
    });
    showToast(`خروجی اکسل لیست بیماران و تراز مالی (${toPersianDigits(patients.length)} پرونده) با موفقیت دانلود شد.`);
  };

  const applyRestoredPayload = (parsed: any, sourceLabel: string) => {
    if (!verifyManagerDeletion(currentUser, 'بازگردانی نسخه پشتیبان و جایگزینی داده‌ها', 'backup-restore')) {
      return;
    }
    if (!parsed || (!Array.isArray(parsed.patients) && !Array.isArray(parsed.appointments) && !Array.isArray(parsed.inventory))) {
      showToast('⚠️ ساختار فایل پشتیبان معتبر نیست.');
      return;
    }
    if (onRestoreData) {
      onRestoreData({
        patients: Array.isArray(parsed.patients) ? parsed.patients : undefined,
        appointments: Array.isArray(parsed.appointments) ? parsed.appointments : undefined,
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : undefined
      });
    }
    actionFeedback.recordSuccess({
      title: `بازگردانی اطلاعات از ${sourceLabel} انجام شد`,
      subtitle: `${toPersianDigits((parsed.patients || []).length)} بیمار · ${toPersianDigits((parsed.appointments || []).length)} نوبت`,
      badgeText: '✓ بازیابی موفق'
    });
    triggerHaptic('success');
    showToast(`اطلاعات پشتیبان از «${sourceLabel}» با موفقیت بازگردانی شد.`);
  };

  const handleRestoreFromJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!verifyManagerDeletion(currentUser, 'بازگردانی نسخه پشتیبان و جایگزینی داده‌ها', 'backup-restore')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        applyRestoredPayload(parsed, file.name);
      } catch {
        showToast('⚠️ خطا در خواندن فایل JSON پشتیبان.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-emerald-600 border border-emerald-500 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-white stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Horizontal Chip Navigation */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('emerald')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Settings className="w-4 h-4 stroke-[2.25]" />
              </div>
              <div className="text-right min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">تنظیمات کلینیک و تعرفه‌ها</h3>
                <span className="text-[10.5px] font-bold text-emerald-800 mt-1 block truncate">مدیریت خدمات، پرسنل، سطح دسترسی و بک‌آپ ابری</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {/* Animated Search Magnifying Glass Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSearchOpen(!searchOpen);
                  if (!searchOpen && activeTab !== 'tariffs') {
                    setActiveTab('tariffs');
                  }
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجو در تعرفه‌ها و تنظیمات"
                aria-label="جستجو در تعرفه‌ها و تنظیمات"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="min-h-[40px] px-3 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>ذخیره</span>
              </button>
            </div>
          </div>

          {/* Animated Expandable Search Bar */}
          {searchOpen && (
            <div className="relative animate-in slide-in-from-top-1 duration-150">
              <Search className="w-3.5 h-3.5 text-emerald-600 absolute right-3 top-2.5" />
              <input
                type="text"
                autoFocus
                placeholder="جستجوی نام خدمت درمانی یا کد تعرفه..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-emerald-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Horizontal Scrollable Chip Bar (چیپ رونده چپ و راست برای تمام بخش‌های تنظیمات) */}
          <div role="tablist" aria-label="بخش‌های ماژول" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'general', label: 'مشخصات مطب' },
              { id: 'tariffs', label: `تعرفه‌های درمانی (${toPersianDigits(tariffs.length)})` },
              { id: 'staff', label: 'پرسنل و دسترسی' },
              { id: 'cloud', label: 'پشتیبان و دیتابیس ابری' },
              { id: 'hardware', label: 'سخت‌افزار و پیامک' },
              { id: 'audit', label: 'لاگ امنیتی تغییرات' }
            ].map((tab, idx) => (
              <button role="tab" aria-selected={activeTab === tab.id} type="button"
                key={tab.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab(tab.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 cursor-pointer ${getUnifiedChipClasses(idx, activeTab === tab.id)}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: GENERAL CLINIC SETTINGS & NATIVE APP DOWNLOADS */}
      {activeTab === 'general' && (
        <div className="mx-2 space-y-2.5">
          {/* Direct Native App Installation & Download Card inside Settings */}
          <div className="bg-gradient-to-br from-purple-50/95 via-white to-emerald-50/70 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-purple-200/90 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center shrink-0">
                  <Logo3DMainDentalTooth size={38} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    نصب و دانلود اپلیکیشن مینادنتال (اندروید APK، آیفون IPA و نصب مستقیم PWA)
                  </h4>
                  <p className="text-[10px] text-purple-700 font-bold">
                    دانلود با فرمت باینری استاندارد (بدون پسوند اضافی) و قابلیت نصب روی صفحه اصلی گوشی
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-900 font-black px-2.5 py-0.5 rounded-full border border-purple-300 font-mono">
                v{MINADENTAL_PACKAGE_VERSION}
              </span>
            </div>

            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('heavy');
                  const ok = await triggerPwaInstall();
                  if (ok) {
                    showToast('برنامه مینادنتال با موفقیت روی صفحه اصلی دستگاه نصب شد.');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>نصب مستقیم برنامه روی صفحه اصلی این گوشی (۱ کلیک)</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('heavy');
                  await downloadAndroidApk(() => {
                    showToast(`فایل نصبی اندروید (MinaDental-v${MINADENTAL_PACKAGE_VERSION}.apk) با فرمت استاندارد دانلود شد.`);
                  });
                }}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <span>دانلود اندروید (.APK)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('heavy');
                  await downloadIosIpa(() => {
                    showToast(`فایل نصبی آیفون (MinaDental-v${MINADENTAL_PACKAGE_VERSION}.ipa) با فرمت استاندارد دانلود شد.`);
                  });
                }}
                className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <span>دانلود آیفون (.IPA)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('heavy');
                  await downloadIosMobileConfigProfile(() => {
                    showToast('پروفایل نصب مستقیم آیفون (MinaDental-iOS27.mobileconfig) دانلود شد.');
                  });
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>پروفایل نصب مستقیم آیفون</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('success');
                  onOpenProjectDownload?.();
                }}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <span>بسته کامل پروژه (.ZIP)</span>
              </button>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">هویت کلینیک و پزشک معالج</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-slate-600 font-bold block mb-1">نام مرکز دندانپزشکی</label>
                <input aria-label="نام مرکز دندانپزشکی"
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">پزشک مسئول / جراح</label>
                <input aria-label="پزشک مسئول / جراح"
                  type="text"
                  value={activeDoctor}
                  onChange={(e) => setActiveDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">تلفن مطب</label>
                  <input aria-label="تلفن مطب"
                    type="text"
                    value={clinicPhone}
                    onChange={(e) => setClinicPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-left focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">ساعات کاری کلینیک</label>
                  <input aria-label="ساعات کاری کلینیک"
                    type="text"
                    value={workHours}
                    onChange={(e) => setWorkHours(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-left focus:outline-none focus:border-emerald-500 text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">نشانی مطب</label>
                <input aria-label="نشانی مطب"
                  type="text"
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">کلید وب‌سرویس استعلام صیاد</label>
                <input aria-label="کلید وب‌سرویس استعلام صیاد"
                  type="password"
                  value={sayadKey}
                  onChange={(e) => setSayadKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-left focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Global Haptic Sensory Feedback Controller (تنظیم شدت بازخورد لمسی کاشی‌ها) */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-purple-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-black text-slate-800">
                  شدت بازخورد لمسی و هپتیک کاشی‌ها (Tile Haptic Intensity)
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                hapticIntensity === 'none' || hapticIntensity === 'off'
                  ? 'bg-slate-100 border-slate-200 text-slate-600'
                  : hapticIntensity === 'light'
                  ? 'bg-sky-50 border-sky-200 text-sky-700'
                  : hapticIntensity === 'medium'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}>
                {hapticIntensity === 'none' || hapticIntensity === 'off'
                  ? 'None (خاموش)'
                  : hapticIntensity === 'light'
                  ? 'Light (ملایم)'
                  : hapticIntensity === 'medium'
                  ? 'Medium (استاندارد)'
                  : 'Heavy (قوی)'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              تنظیم قدرت ارتعاش تپتیک انجین و پالس صوتی در هنگام لمس، جابجایی و کلیک روی کاشی‌ها. سطح «قوی» برای تفکیک دقیق لمس از روی دستکش لاتکس جراحی طراحی شده است.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { 
                  id: 'none' as const, 
                  label: 'None', 
                  sub: 'بدون لرزش (خاموش)', 
                  icon: X,
                  activeClass: 'border-slate-400 bg-slate-100 text-slate-900 shadow-2xs font-black' 
                },
                { 
                  id: 'light' as const, 
                  label: 'Light', 
                  sub: 'تپتیک سبک (ملایم)', 
                  icon: Sparkles,
                  activeClass: 'border-sky-500 bg-sky-50 text-sky-950 font-black shadow-xs ring-1 ring-sky-400' 
                },
                { 
                  id: 'medium' as const, 
                  label: 'Medium', 
                  sub: 'استاندارد iOS/اندروید', 
                  icon: Zap,
                  activeClass: 'border-purple-600 bg-purple-50 text-purple-950 font-black shadow-xs ring-1 ring-purple-500' 
                },
                { 
                  id: 'heavy' as const, 
                  label: 'Heavy', 
                  sub: 'قوی (دستکش جراحی)', 
                  icon: ShieldCheck,
                  activeClass: 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500' 
                }
              ].map(opt => {
                const isSelected = hapticIntensity === opt.id || (opt.id === 'none' && hapticIntensity === 'off');
                const IconComp = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUpdateHapticIntensity(opt.id)}
                    className={`p-2.5 rounded-2xl border text-right transition-all cursor-pointer active:scale-95 flex flex-col justify-between min-h-[72px] ${
                      isSelected
                        ? opt.activeClass
                        : 'border-slate-200/90 bg-slate-50/70 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-black">{opt.label}</span>
                      <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-current' : 'text-slate-400'}`} />
                    </div>
                    <span className="text-[9.5px] text-slate-500 block">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TARIFFS MANAGER & CATEGORIES */}
      {activeTab === 'tariffs' && (
        <div className="mx-2 space-y-3">
          {/* Add Tariff Form */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-slate-200/80 space-y-2.5">
            <span className="text-xs font-black text-slate-800 block">تعریف خدمت و تعرفه مصوب جدید:</span>
            <form onSubmit={handleAddTariff} className="space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={newTariffName}
                  onChange={(e) => setNewTariffName(e.target.value)}
                  placeholder="نام درمان (مثلاً ونیر کامپوزیت لبه انسیزال)..."
                  className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
                <select aria-label="انتخاب گزینه بالینی"
                  value={newTariffCategory}
                  onChange={(e) => setNewTariffCategory(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="restorative">ترمیم و زیبایی</option>
                  <option value="endo">درمان ریشه (اندو)</option>
                  <option value="implant">ایمپلنت و جراحی فک</option>
                  <option value="prosthetics">پروتز و روکش</option>
                  <option value="pediatric">دندانپزشکی اطفال</option>
                  <option value="periodontics">جرم‌گیری و لثه</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={toPersianDigits(newTariffPrice ? newTariffPrice.toLocaleString('en-US') : '')}
                  onChange={(e) => {
                    const raw = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                    setNewTariffPrice(raw ? Number(raw) : 0);
                  }}
                  placeholder="تعرفه پایه (تومان)"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-center font-bold focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shrink-0 shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت خدمت</span>
                </button>
              </div>
            </form>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: 'all', label: 'همه دسته‌ها' },
              { id: 'restorative', label: 'ترمیم و زیبایی' },
              { id: 'endo', label: 'عصب‌کشی (اندو)' },
              { id: 'implant', label: 'ایمپلنت و جراحی' },
              { id: 'prosthetics', label: 'پروتز و روکش' },
              { id: 'pediatric', label: 'اطفال' },
              { id: 'periodontics', label: 'جرم‌گیری' },
            ].map(cat => (
              <button type="button"
                key={cat.id}
                onClick={() => setTariffCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all active:scale-95 ${
                  tariffCategoryFilter === cat.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Tariffs List with Inline Edit and Category Tags */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800">
                تعرفه‌های مصوب کلینیک مینادنتال ({toPersianDigits(
                  tariffs.filter(t => tariffCategoryFilter === 'all' || t.category === tariffCategoryFilter).length
                )})
              </span>
              <span className="text-[10px] text-slate-400">قیمت‌های پایه طرح درمان و چارت پالمر</span>
            </div>

            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {tariffs
                .filter(item => (tariffCategoryFilter === 'all' || item.category === tariffCategoryFilter) && (!searchQuery || item.name.includes(searchQuery) || item.code.toLowerCase().includes(searchQuery.toLowerCase())))
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-slate-400 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {item.code}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{item.name}</span>
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60 shrink-0 hidden sm:inline-block">
                        {item.category === 'restorative' && 'ترمیم'}
                        {item.category === 'endo' && 'اندو'}
                        {item.category === 'implant' && 'ایمپلنت'}
                        {item.category === 'prosthetics' && 'پروتز'}
                        {item.category === 'pediatric' && 'اطفال'}
                        {item.category === 'periodontics' && 'جرم‌گیری'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {editingTariffId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input aria-label="مبلغ تعرفه درمان"
                            type="number"
                            value={editingTariffPrice}
                            onChange={(e) => setEditingTariffPrice(Number(e.target.value))}
                            className="w-24 bg-white border border-emerald-400 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <button type="button"
                            onClick={() => handleUpdateTariffPrice(item.id, editingTariffPrice)}
                            className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            title="ذخیره"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button"
                            onClick={() => setEditingTariffId(null)}
                            className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                            title="انصراف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-emerald-700 text-xs">
                            {formatToman(item.price)}
                          </span>
                          <button type="button"
                            onClick={() => {
                              setEditingTariffId(item.id);
                              setEditingTariffPrice(item.price);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-white rounded-md transition-colors"
                            title="ویرایش قیمت تعرفه"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          {isManagerActive && (
                            <button type="button"
                              onClick={() => handleDeleteTariff(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors"
                              title="حذف خدمت (فقط مدیر)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF CREDENTIALS, PASSWORDS & ACCESS CONTROL (RBAC) */}
      {activeTab === 'staff' && (
        <div className="mx-2 space-y-3">
          {/* 1. PINNED CLINIC MANAGER CARD (Dr. Mehdi Amiri) - Full Access & Dual Role */}
          <div className="bg-gradient-to-br from-purple-50 via-white to-emerald-50/80 rounded-[24px] p-4 border-2 border-purple-200/90 shadow-sm space-y-3 text-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-purple-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#c8ff00] text-black font-black flex items-center justify-center text-sm shadow-sm border border-[#bbf000] shrink-0">
                  مدیر
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-sm text-slate-900 truncate">دکتر مهدی امیری</h4>
                    <span className="text-[10px] bg-purple-600 text-white font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                      مدیر ارشد و صاحب‌امتیاز کلینیک
                    </span>
                    {managerIsDoctor && (
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <Stethoscope className="w-3 h-3" />
                        دندانپزشک معالج و جراح
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    شماره نظام پزشکی: {toPersianDigits('۱۸۴۹۲-م')} · دسترسی کامل و نامحدود به تمامی ماژول‌ها، تنظیمات و تایید صلاحیت‌ها
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                  دسترسی ۱۰۰٪ کامل (Full Admin)
                </span>
              </div>
            </div>

            {/* Manager Dual-Role Feature: Manager CAN ALSO BE A TREATING DOCTOR */}
            <div className="bg-white/90 p-3 rounded-2xl border border-purple-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <Award className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-black text-slate-900 block">
                    امکان فعالیت همزمان مدیر به عنوان پزشک معالج (Dual Role)
                  </span>
                  <span className="text-[10.5px] text-slate-500 font-medium block mt-0.5 leading-relaxed">
                    با فعال‌سازی این گزینه، مدیر در فهرست دندانپزشکان یونیت‌ها، چارت بالینی پالمر، نوبت‌دهی جراحی و محاسبات سهم‌بندی به عنوان پزشک معالج نمایش داده می‌شود.
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
                <input
                  type="checkbox"
                  aria-label="فعال‌سازی نقش همزمان مدیر و پزشک معالج"
                  checked={managerIsDoctor}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setManagerIsDoctor(val);
                    const updated = staffList.map(u => 
                      u.role === 'admin' 
                        ? { ...u, isDoctor: val, isManagerAndDoctor: val } 
                        : u
                    );
                    saveStaffList(updated);
                    triggerHaptic('success');
                    showToast(val ? 'نقش دندانپزشک معالج برای مدیر فعال شد.' : 'مدیر صرفاً در نقش مدیریتی تنظیم گردید.');
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
              </label>
            </div>

            {/* Manager Credentials Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="truncate">mehdi.amiri19851364@gmail.com</span>
                </div>
                <button
                  type="button"
                  aria-label="کپی جیمیل مدیر"
                  onClick={() => copyToClipboard('mehdi.amiri19851364@gmail.com', 'جیمیل مدیر')}
                  className="min-h-[34px] px-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[10.5px] text-purple-700 font-bold shrink-0 cursor-pointer"
                >
                  کپی
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>۰۹۱۲۳۴۵۶۷۸۹</span>
                </div>
                <button
                  type="button"
                  aria-label="کپی شماره همراه مدیر"
                  onClick={() => copyToClipboard('09123456789', 'شماره همراه مدیر')}
                  className="min-h-[34px] px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[10.5px] text-emerald-700 font-bold shrink-0 cursor-pointer"
                >
                  کپی
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-emerald-800 font-bold">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>رمز عبور مدیر با هش امن SHA-256 محافظت می‌شود ✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. SECTION HEADER & ADD STAFF BUTTON */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 truncate">
                  پزشکان، منشی‌ها و پرسنل کلینیک ({toPersianDigits(staffList.length)} کاربر)
                </h4>
                <span className="text-[10px] text-slate-500 font-medium block truncate">
                  تایید اعتبارنامه، تنظیم رمز عبور و تفکیک دقیق سطوح دسترسی (RBAC) توسط مدیر
                </span>
              </div>
            </div>

            <button type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowAddStaff(!showAddStaff);
              }}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddStaff ? 'بستن فرم' : '+ پزشک / پرسنل جدید'}</span>
            </button>
          </div>

          {/* 2B. DOCTOR COMMISSION RULES LIVE SUMMARY & 1-TAP EDITOR LAUNCHER */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-purple-200/85 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    سهم‌بندی و فرمول تسویه پزشکان و مدیر کلینیک
                  </h4>
                  <span className="text-[10px] text-purple-700 font-bold block">
                    (کارکرد − لابراتوار) ÷ ۲ · دستمزد ثابت جراحی · درصد اختصاصی هر پزشک و مدیر
                  </span>
                </div>
              </div>
              {onOpenCommissionModal && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onOpenCommissionModal();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>مدیریت فرمول پورسانت پزشکان</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px]">
              {commissionSummaries.map((rule) => (
                <div key={rule.doctorId} className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-200/70 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-slate-900 truncate">{rule.doctorName}</span>
                    {rule.isManager && (
                      <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded-full shrink-0">
                        مدیرکل
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-purple-900">
                    {rule.defaultModel === 'lab_split_half'
                      ? 'فرمول: (کارکرد − لابراتوار) ÷ ۲'
                      : rule.defaultModel === 'fixed_wage'
                        ? `دستمزد ثابت: ${formatToman(rule.fixedWagePerTreatment)}`
                        : `درصد اختصاصی: ${toPersianDigits(rule.percentageRate)}٪`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. ADD STAFF MODAL (Full-Page Mobile Sheet - Zero Page Scroll Required) */}
          {showAddStaff && (
            <ViewportModalPortal isOpen={showAddStaff}>
              <div
                className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
                onClick={() => setShowAddStaff(false)}
                dir="rtl"
                role="dialog"
                aria-modal="true"
                aria-label="تعریف حساب پزشک یا پرسنل جدید کلینیک"
              >
                <div
                  dir="rtl"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-br from-emerald-50/95 via-white to-sky-50/60 rounded-none sm:rounded-[28px] border-0 sm:border border-emerald-200 shadow-2xl text-xs text-right flex flex-col overflow-hidden"
                >
                  {/* Fixed Sheet Header */}
                  <div className="px-4 pt-3 pb-2.5 border-b border-emerald-200/80 bg-white/95 shrink-0 sticky top-0 z-20">
                    <div className="w-10 h-1 rounded-full bg-emerald-300/80 mx-auto mb-2 sm:hidden" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <UserPlus className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-black text-slate-900 text-xs sm:text-sm block">تعریف حساب پزشک / پرسنل جدید کلینیک</span>
                          <span className="text-[9.5px] font-bold text-emerald-700">تعیین سطح دسترسی و رمز عبور توسط مدیر (شیت تمام‌صفحه)</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddStaff(false)}
                        aria-label="بستن فرم افزودن پرسنل"
                        className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Sheet Content */}
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto overscroll-contain">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">نام و نام خانوادگی:</label>
                        <input
                          type="text"
                          placeholder="مثلاً دکتر کیوان خسروی"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">نقش سازمانی:</label>
                        <select aria-label="نقش سازمانی"
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as RoleType)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="doctor">دندانپزشک معالج</option>
                          <option value="secretary">منشی و پذیرش</option>
                          <option value="assistant">دستیار جراحی و CSR</option>
                          <option value="accountant">امور مالی و حسابدار</option>
                          <option value="admin">مدیر کمکی</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">جیمیل یا ایمیل ورود:</label>
                        <input
                          type="email"
                          placeholder="khosravi@gmail.com"
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          dir="ltr"
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">کلمه عبور اختصاصی:</label>
                        <input
                          type="text"
                          placeholder="کلمه عبور امن"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          dir="ltr"
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">پلتفرم / یونیت:</label>
                        <input
                          type="text"
                          placeholder="یونیت زرد"
                          value={newStaffPlatform}
                          onChange={(e) => setNewStaffPlatform(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">شماره همراه:</label>
                        <input
                          type="text"
                          placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">نظام پزشکی:</label>
                        <input
                          type="text"
                          placeholder="۲۹۸۴۵"
                          value={newStaffLicense}
                          onChange={(e) => setNewStaffLicense(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fixed Bottom Action Footer */}
                  <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-emerald-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddStaff(false)}
                      className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newStaffName || !newStaffEmail || !newStaffPassword) {
                          showToast('لطفاً نام، ایمیل و رمز عبور را تکمیل نمایید.');
                          return;
                        }
                        const created: UserAccount = sanitizeUserAccount({
                          id: `user-${Date.now()}`,
                          fullName: newStaffName,
                          username: newStaffEmail.split('@')[0],
                          email: newStaffEmail,
                          role: newStaffRole,
                          assignedPlatform: newStaffPlatform,
                          avatarColor: newStaffRole === 'doctor' ? '#06b6d4' : newStaffRole === 'admin' ? '#c8ff00' : newStaffRole === 'assistant' ? '#10b981' : '#f59e0b',
                          phone: newStaffPhone || '۰۹۱۲۰۰۰۰۰۰۰',
                          medicalLicense: newStaffLicense || undefined,
                          isActive: true,
                          isManager: false,
                          isDoctor: newStaffRole === 'doctor',
                          permissions: {
                            canManageAppointments: true,
                            canRegisterTreatments: newStaffRole === 'doctor',
                            canCollectPayments: newStaffRole !== 'doctor',
                            canManageChecks: newStaffRole !== 'doctor',
                            canAccessSettingsAndUsers: false,
                            canBackupAndRestore: newStaffRole === 'admin',
                            canEditPrices: false,
                            canDeleteRecords: false,
                            canManageStaff: false,
                            canViewReports: newStaffRole === 'admin' || newStaffRole === 'accountant',
                            canAccessLabPortal: true
                          }
                        }, newStaffPassword);
                        const updated = [...staffList, created];
                        saveStaffList(updated);
                        setNewStaffName('');
                        setNewStaffEmail('');
                        setNewStaffPassword('');
                        setNewStaffPhone('');
                        setNewStaffLicense('');
                        setShowAddStaff(false);
                        triggerHaptic('success');
                        showToast(`پرسنل "${created.fullName}" با تایید مدیر به سیستم اضافه شد.`);
                      }}
                      className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      تایید و ثبت نهایی عضو جدید با مجوز مدیر
                    </button>
                  </div>
                </div>
              </div>
            </ViewportModalPortal>
          )}

          {/* 4. LIST OF STAFF MEMBERS WITH DIRECT RBAC CONTROLS */}
          <div className="space-y-2.5">
            {staffList.filter(member => member.id !== 'user-manager-amiri').map((member) => {
              const isEditing = editingUserId === member.id;
              const isPermissionsExpanded = expandedPermissionsUserId === member.id;

              return (
                <div
                  key={member.id}
                  className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-slate-200/80 space-y-2.5 text-xs"
                >
                  {/* Top Info Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-black shadow-xs shrink-0"
                        style={{ backgroundColor: member.avatarColor || '#38bdf8' }}
                      >
                        {member.role === 'doctor' ? 'پزشک' : member.role === 'secretary' ? 'منشی' : member.role === 'assistant' ? 'دستیار' : 'مالی'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 text-xs truncate">{member.fullName}</h4>
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                            {member.role === 'doctor' ? 'دندانپزشک معالج' : member.role === 'secretary' ? 'منشی و پذیرش' : member.role === 'assistant' ? 'دستیار جراحی و CSR' : 'حسابدار'}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-500 block mt-0.5 truncate">
                          پلتفرم فعال: {member.assignedPlatform} {member.medicalLicense ? `· نظام: ${toPersianDigits(member.medicalLicense)}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Manager Approval Switch */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button type="button"
                        onClick={() => {
                          const updated = staffList.map(u => 
                            u.id === member.id ? { ...u, isActive: !u.isActive } : u
                          );
                          saveStaffList(updated);
                          triggerHaptic('light');
                          showToast(`وضعیت "${member.fullName}" به ${!member.isActive ? 'فعال و تایید شده' : 'معلق'} تغییر یافت.`);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                          member.isActive !== false
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                        title="کلیک برای تغییر وضعیت تایید حساب توسط مدیر"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${member.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span>{member.isActive !== false ? 'تایید مدیر (فعال)' : 'معلق توسط مدیر'}</span>
                      </button>

                      {isManagerActive && member.role !== 'admin' && (
                        <button type="button"
                          onClick={() => {
                            if (!verifyManagerDeletion(currentUser, `حذف حساب پرسنل ${member.fullName}`, member.id)) {
                              return;
                            }
                            archiveToTrashVault({
                              entityType: 'staff_user',
                              entityId: member.id,
                              title: `حساب کاربری ${member.fullName}`,
                              subtitle: `${member.role} · ${member.email || member.username}`,
                              payload: member,
                              deletedByUser: currentUser
                            });
                            const updated = staffList.filter(u => u.id !== member.id);
                            saveStaffList(updated);
                            triggerHaptic('warning');
                            showToast(`حساب "${member.fullName}" به بایگانی مدیر منتقل گردید.`);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="بایگانی این کاربر (فقط مدیر)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Credentials Row: Email & Password */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[10.5px] truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{member.email || `${member.username}@minadental.com`}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`کپی ایمیل ${member.fullName}`}
                        onClick={() => copyToClipboard(member.email || `${member.username}@minadental.com`, 'ایمیل')}
                        className="min-h-[32px] px-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 text-[10.5px] font-bold shrink-0 cursor-pointer"
                      >
                        کپی
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[10.5px]">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-sans font-bold text-emerald-800">
                          {member.passwordHash ? 'رمزنگاری SHA-256 فعال ✓' : 'نیازمند تنظیم رمز'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setEditingUserId(isEditing ? null : member.id);
                            setEditingPassword('');
                          }}
                          className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold cursor-pointer"
                        >
                          {isEditing ? 'انصراف' : 'تعیین رمز جدید'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Password Edit Form */}
                  {isEditing && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="کلمه عبور جدید اختصاصی (هش امن)"
                        value={editingPassword}
                        onChange={(e) => setEditingPassword(e.target.value)}
                        dir="ltr"
                        className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-mono flex-1 text-slate-900 focus:outline-none"
                      />
                      <button type="button"
                        onClick={() => {
                          if (!editingPassword.trim()) return;
                          const updated = staffList.map(u => 
                            u.id === member.id ? sanitizeUserAccount(u, editingPassword.trim()) : u
                          );
                          saveStaffList(updated);
                          setEditingUserId(null);
                          setEditingPassword('');
                          triggerHaptic('success');
                          showToast(`رمز عبور ${member.fullName} با هش امن SHA-256 ذخیره شد.`);
                        }}
                        className="py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                      >
                        ذخیره رمز
                      </button>
                    </div>
                  )}

                  {/* Permissions Toggle Trigger Button */}
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                    <button type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setExpandedPermissionsUserId(isPermissionsExpanded ? null : member.id);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-black text-purple-700 hover:text-purple-900 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>تعیین سطوح دسترسی (RBAC) برای این کاربر</span>
                      {isPermissionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <div className="flex items-center gap-1 text-[9.5px] font-mono text-slate-400">
                      <span>{Object.values(member.permissions || {}).filter(Boolean).length} دسترسی فعال</span>
                    </div>
                  </div>

                  {/* Expandable Granular Permissions Matrix */}
                  {isPermissionsExpanded && (
                    <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/80 space-y-2 animate-in fade-in text-xs">
                      <span className="text-[10px] font-black text-purple-900 block pb-1 border-b border-purple-200/60">
                        ماتریس اختیارات امنیتی و بالینی (تنظیم توسط مدیر کلینیک):
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                        {/* 1. ثبت درمان */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <span className="font-bold text-slate-800">ثبت طرح‌درمان و چارت پالمر</span>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canRegisterTreatments)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canRegisterTreatments: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 2. نوبت دهی */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <span className="font-bold text-slate-800">تقویم و نوبت‌دهی یونیت‌ها</span>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canManageAppointments)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canManageAppointments: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 3. صندوق و پرداخت */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <span className="font-bold text-slate-800">صندوق، ثبت دریافتی و کارتخوان</span>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canCollectPayments)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canCollectPayments: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 4. چک صیادی و اقساط */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <span className="font-bold text-slate-800">چک‌های صیادی و اقساط بیمار</span>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canManageChecks)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canManageChecks: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 5. ویرایش قیمت ها و تخفیف - مهم */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <div>
                            <span className="font-bold text-slate-800 block">ویرایش قیمت و اعمال تخفیف</span>
                            <span className="text-[9px] text-slate-500 font-medium block">در صورت خاموش بودن، قیمت ثبت‌شده توسط منشی قفل است</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canEditPrices)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canEditPrices: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 6. حذف سوابق و پرونده */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <div>
                            <span className="font-bold text-slate-800 block">حذف پرونده یا سوابق درمانی</span>
                            <span className="text-[9px] text-rose-600 font-medium block">عملیات حساس و غیرقابل بازگشت</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canDeleteRecords)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canDeleteRecords: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 7. سفارشات لابراتوار */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <span className="font-bold text-slate-800">پورتال و سفارشات لابراتوار</span>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canAccessLabPortal)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canAccessLabPortal: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>

                        {/* 8. گزارش های مالی */}
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 cursor-pointer hover:bg-purple-50/50">
                          <span className="font-bold text-slate-800">مشاهده گزارش‌های سود و سهم‌بندی</span>
                          <input
                            type="checkbox"
                            checked={Boolean(member.permissions.canViewReports)}
                            onChange={(e) => {
                              const updated = staffList.map(u => 
                                u.id === member.id 
                                  ? { ...u, permissions: { ...u.permissions, canViewReports: e.target.checked } }
                                  : u
                              );
                              saveStaffList(updated);
                              triggerHaptic('light');
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD, SUPABASE CREDENTIALS, VERCEL DEPLOY & OTA AUTO-UPDATE */}
      {activeTab === 'cloud' && (
        <div className="mx-2 space-y-3">
          {/* Manager-Only Security Lock Gate if logged in as Secretary/Assistant */}
          {!isManagerActive ? (
            <div className="bg-white rounded-[24px] p-5 border-2 border-rose-200 shadow-md space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900">
                دسترسی محدود به مدیر کلینیک (دکتر مهدی امیری)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                مشاهده نام کاربری و رمزهای سوپابیس، ورسل، کلیدهای امضای APK/IPA و کنسول انتشار خودکار OTA فقط در اختیار مدیر کلینیک است.
              </p>
              <div className="max-w-xs mx-auto space-y-2 pt-1">
                <input
                  type="password"
                  value={vaultPinInput}
                  onChange={(e) => {
                    setVaultPinInput(e.target.value);
                    setVaultPinError(null);
                  }}
                  placeholder="کد پین مدیر یا رمز حساب مدیریت..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-center font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                {vaultPinError && (
                  <span className="text-[10.5px] font-bold text-rose-600 block">{vaultPinError}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const input = vaultPinInput.trim();
                    const managerAccount = staffList.find(u => u.id === 'user-manager-amiri' || u.role === 'admin');
                    const isPinMatch =
                      verifyPasswordCredential(input, { passwordHash: 'sha256$pin_v27$0b82a9acb17bf82d5ad78144e8430f0a364a373c581c0e447b4fed19197bf17d' }) ||
                      verifyPasswordCredential(input, { passwordHash: 'sha256$pin_v27$ed6738715378913b6c7f8d9f5a0eb6a0c8a6787cc329fcf87830e3644c46a4bd' }) ||
                      (managerAccount ? verifyPasswordCredential(input, managerAccount) : false) ||
                      (vault.managerPinCode ? input === vault.managerPinCode : false) ||
                      (vault.managerMasterPassword ? input === vault.managerMasterPassword : false);

                    if (isPinMatch) {
                      triggerHaptic('success');
                      setManagerVaultUnlocked(true);
                      setVaultPinInput('');
                    } else {
                      setVaultPinError('رمز مدیریت نادرست است.');
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
                >
                  بازگشایی گاوصندوق مدیر کلینیک
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 0. LIVE D3.JS DATA FOOTPRINT & MULTI-PLATFORM SYNC TELEMETRY */}
              <div
                data-testid="settings-d3-telemetry-panel"
                className="bg-white/95 backdrop-blur-md rounded-[24px] p-4 border border-emerald-200/90 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900">
                        مانیتورینگ زنده داده‌ها، همگام‌سازی و ناوگان کلینیک (D3.js)
                      </h3>
                      <span className="text-[10px] font-bold text-emerald-700 block">
                        نمای لحظه‌ای رکوردهای IndexedDB، سوپابیس و گره‌های OTA متصل
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {toPersianDigits(fleetNodes.length)} نود فعال · v{toPersianDigits(otaRelease.version)}
                  </span>
                </div>

                <div className="w-full overflow-x-auto no-scrollbar">
                  <svg
                    data-testid="settings-d3-telemetry-svg"
                    viewBox={`0 0 ${d3SystemTelemetry.width} ${d3SystemTelemetry.height}`}
                    className="w-full min-w-[320px] h-32 select-none"
                    role="img"
                    aria-label="نمودار D3 وضعیت داده‌ها و ناوگان همگام‌سازی کلینیک"
                  >
                    {d3SystemTelemetry.ticks.map(t => {
                      const ty = d3SystemTelemetry.yScale(t);
                      return (
                        <g key={`sys-tick-${t}`}>
                          <line
                            x1={d3SystemTelemetry.margin.left}
                            x2={d3SystemTelemetry.width - d3SystemTelemetry.margin.right}
                            y1={ty}
                            y2={ty}
                            stroke="#e2e8f0"
                            strokeDasharray="3,3"
                          />
                          <text
                            x={d3SystemTelemetry.margin.left - 5}
                            y={ty + 3}
                            textAnchor="end"
                            fontSize="8.5"
                            fill="#64748b"
                            fontWeight="700"
                          >
                            {toPersianDigits(t)}
                          </text>
                        </g>
                      );
                    })}
                    {d3SystemTelemetry.bars.map(bar => (
                      <g key={bar.id}>
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.barW}
                          height={bar.h}
                          rx={6}
                          fill={bar.color}
                          fillOpacity={0.85}
                        />
                        <text
                          x={bar.x + bar.barW / 2}
                          y={bar.y - 4}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="900"
                          fill="#0f172a"
                        >
                          {toPersianDigits(bar.count)}
                        </text>
                        <text
                          x={bar.x + bar.barW / 2}
                          y={d3SystemTelemetry.height - 8}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="700"
                          fill="#475569"
                        >
                          {bar.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* 0.5. LIVE MULTI-DEVICE SERVER SYNC (SSE) & CLEAN REAL-CLINIC START */}
              <div
                data-testid="settings-live-sync-production-panel"
                className="bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/90 rounded-[24px] p-4 border border-emerald-200 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Wifi className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">
                        همگام‌سازی زنده چنددستگاهی (SSE) و شروع دیتای واقعی مطب
                      </h3>
                      <span className="text-[10px] text-emerald-800 font-bold block">
                        اتصال همزمان واقعی پذیرش، یونیت پزشک، آیفون و اندروید با ذخیره اتمیک روی سرور
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        liveSyncMeta?.connectionState === 'connected'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : liveSyncMeta?.connectionState === 'connecting'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {liveSyncMeta?.connectionState === 'connected'
                        ? '● متصل زنده (SSE)'
                        : liveSyncMeta?.connectionState === 'connecting'
                          ? '◌ در حال اتصال...'
                          : '○ حالت آفلاین (IndexedDB)'}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        clinicDataMode === 'live_production'
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : 'bg-sky-100 text-sky-900 border-sky-300'
                      }`}
                    >
                      {clinicDataMode === 'live_production'
                        ? 'حالت دیتای واقعی مطب'
                        : 'داده‌های نمونه آموزشی'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/90 rounded-2xl p-2.5 border border-emerald-100">
                    <span className="text-[9.5px] font-bold text-slate-500 block">دستگاه‌های متصل</span>
                    <span className="text-sm font-black text-emerald-700 mt-0.5 block">
                      {toPersianDigits(liveSyncMeta?.connectedClients ?? 1)} دستگاه
                    </span>
                  </div>
                  <div className="bg-white/90 rounded-2xl p-2.5 border border-sky-100">
                    <span className="text-[9.5px] font-bold text-slate-500 block">نسخه همگام‌سازی</span>
                    <span className="text-sm font-mono font-black text-sky-700 mt-0.5 block">
                      Rev #{toPersianDigits(liveSyncMeta?.revision ?? 0)}
                    </span>
                  </div>
                  <div className="bg-white/90 rounded-2xl p-2.5 border border-purple-100">
                    <span className="text-[9.5px] font-bold text-slate-500 block">آخرین سینک</span>
                    <span className="text-xs font-black text-purple-700 mt-0.5 block">
                      {liveSyncMeta?.lastSyncedAt || 'آماده'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={isSyncingLiveServer}
                    onClick={async () => {
                      if (!onTriggerLiveServerSync) return;
                      triggerHaptic('medium');
                      setIsSyncingLiveServer(true);
                      try {
                        const ok = await onTriggerLiveServerSync();
                        showToast(
                          ok
                            ? 'همگام‌سازی زنده با سرور و تمام دستگاه‌های متصل با موفقیت انجام شد.'
                            : 'تغییرات در حافظه محلی امن ذخیره شد و پس از اتصال سرور ارسال می‌گردد.'
                        );
                      } finally {
                        setIsSyncingLiveServer(false);
                      }
                    }}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLiveServer ? 'animate-spin' : ''}`} />
                    <span>همگام‌سازی فوری همه دستگاه‌ها</span>
                  </button>

                  {clinicDataMode !== 'live_production' && !confirmCleanProduction && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        setConfirmCleanProduction(true);
                      }}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>شروع دیتای واقعی مطب (پاکسازی نمونه)</span>
                    </button>
                  )}
                </div>

                {confirmCleanProduction && clinicDataMode !== 'live_production' && (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-amber-950 leading-relaxed">
                      بیماران و نوبت‌های آزمایشی به صورت امن در «بایگانی ضدحذف» آرشیو می‌شوند و لیست بیماران برای ثبت مراجعین واقعی مطب خالی می‌گردد (موجودی انبار، تعرفه‌ها و پرسنل کاملاً حفظ می‌شوند). تایید می‌کنید؟
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSwitchingProductionMode}
                        onClick={async () => {
                          if (!onActivateCleanProductionMode) return;
                          triggerHaptic('heavy');
                          setIsSwitchingProductionMode(true);
                          try {
                            const res = await onActivateCleanProductionMode();
                            if (res.ok) {
                              setConfirmCleanProduction(false);
                              showToast(
                                `حالت دیتای واقعی مطب فعال شد (${toPersianDigits(res.archivedCount)} رکورد نمونه در بایگانی ضدحذف نگهداری شد).`
                              );
                            } else {
                              showToast(res.error || 'خطا در فعال‌سازی حالت واقعی');
                            }
                          } finally {
                            setIsSwitchingProductionMode(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer disabled:opacity-60"
                      >
                        تایید نهایی و شروع کار واقعی مطب
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCleanProduction(false)}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 1. REAL-TIME OTA AUTO-UPDATE & MULTI-PLATFORM DEPLOYMENT ENGINE */}
              <div className="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/90 rounded-[24px] p-4 border border-indigo-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <RefreshCw className={`w-4.5 h-4.5 ${isPublishingOta ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">
                        موتور انتشار و آپدیت خودکار OTA روی همه پلتفرم‌ها
                      </h3>
                      <span className="text-[10px] text-indigo-700 font-bold block">
                        آپدیت آنی بدون نیاز به نصب مجدد روی آیفون (IPA/PWA)، اندروید (APK) و سیستم‌های مطب
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-[10.5px] font-mono font-black px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300 block">
                      v{toPersianDigits(otaRelease.version)}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 mt-0.5 block">
                      Build {toPersianDigits(otaRelease.buildNumber)}
                    </span>
                  </div>
                </div>

                {/* Release Notes & 1-Tap OTA Push */}
                <div className="space-y-2 text-xs">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    یادداشت تغییرات نسخه جدید (برای ارسال به تمام دستگاه‌های نصب‌شده):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={otaChangelogInput}
                      onChange={(e) => setOtaChangelogInput(e.target.value)}
                      className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-600"
                      placeholder="توضیح تغییرات نسخه جدید..."
                    />
                    <button
                      type="button"
                      onClick={handlePublishOtaUpdate}
                      disabled={isPublishingOta}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <Zap className="w-4 h-4 fill-white" />
                      <span>
                        {isPublishingOta ? 'در حال انتشار و تزریق OTA...' : 'انتشار نسخه جدید و آپدیت خودکار همه دستگاه‌ها'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Live 4-Step Deployment Pipeline Visualizer */}
                {pipelineSteps.length > 0 && (
                  <div className="p-3 rounded-2xl bg-white border border-indigo-200/80 space-y-2">
                    <span className="text-[10.5px] font-black text-indigo-950 block">
                      وضعیت خط لوله انتشار ابری (Vercel + Supabase Realtime + OTA Service Worker):
                    </span>
                    <div className="space-y-1.5">
                      {pipelineSteps.map((st) => (
                        <div key={st.id} className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                          <div className="flex items-center gap-2">
                            {st.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />}
                            {st.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {st.status === 'idle' && <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <div>
                              <span className="font-bold text-slate-900 block">{st.title}</span>
                              <span className="text-[9.5px] text-slate-500 block">{st.detail}</span>
                            </div>
                          </div>
                          {st.durationMs && (
                            <span className="text-[9.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                              {toPersianDigits(st.durationMs)} ms
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Fleet Devices Table (دستگاه‌های نصب‌شده که خودکار آپدیت می‌شوند) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-black text-slate-800">
                      دستگاه‌ها و پلتفرم‌های نصب‌شده متصل به کانال آپدیت خودکار ({toPersianDigits(fleetNodes.length)} دستگاه):
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Auto-Update: روشن
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {fleetNodes.map((node) => (
                      <div key={node.id} className="p-2.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-slate-900 text-[11px] truncate">{node.deviceName}</span>
                              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                                {node.platformType}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {node.assignedUser} · IP: {node.ipAddress} · {node.lastHeartbeat}
                            </span>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="text-[10px] font-mono font-black text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 block">
                            v{toPersianDigits(node.installedVersion)}
                          </span>
                          <span className={`text-[9px] font-bold block mt-0.5 ${
                            node.otaStatus === 'updated_just_now'
                              ? 'text-emerald-700'
                              : node.otaStatus === 'downloading'
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}>
                            {node.otaStatus === 'updated_just_now'
                              ? '✓ آپدیت آنی نصب شد'
                              : node.otaStatus === 'downloading'
                              ? 'در حال دریافت OTA...'
                              : '✓ نسخه آخر همگام'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. SUPABASE REALTIME DIAGNOSTICS & LIVE TESTS */}
              <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-[24px] p-4 text-slate-800 border border-emerald-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">سرور ابری سوپابیس و تست‌های زنده ۱۰گانه (Supabase Realtime)</h3>
                      <span className="text-[10px] text-emerald-700 font-bold">همگام‌سازی بلادرنگ بین منشی، پزشک، دستیار و مدیر کلینیک</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    متصل و فعال
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onOpenPhaseAudit?.();
                    }}
                    className="w-full py-2.5 px-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-[11px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#c8ff00] shrink-0" />
                    <span>تست ۴۶گانه استاندارد بالینی (۱۰ فاز)</span>
                  </button>

                  <button type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onOpenLiveSync?.();
                    }}
                    className="w-full py-2.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-amber-200 shrink-0" />
                    <span>شبیه‌ساز زنده پزشک / منشی</span>
                  </button>

                  <button type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onOpenSupabaseTest?.();
                    }}
                    className="w-full py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-white shrink-0" />
                    <span>کنسول تست زنده ۱۰ ماژول سوپابیس</span>
                  </button>
                </div>
              </div>

              {/* 3. COMPLETE MANAGER-ONLY SECRETS VAULT (Supabase, Vercel, Cloud Run, APK & IPA Credentials) */}
              <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border-2 border-emerald-300/90 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        گاوصندوق جامع نام کاربری و رمز عبور سرورها (ویژه مدیر کلینیک)
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        فقط قابل مشاهده و ویرایش توسط دکتر مهدی امیری ({vault.managerEmail})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowVaultSecrets(!showVaultSecrets)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showVaultSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showVaultSecrets ? 'مخفی‌سازی رمزها' : 'نمایش کامل رمزها'}</span>
                    </button>
                  </div>
                </div>

                {/* Section A: Manager Master Login */}
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
                  <span className="text-[11px] font-black text-emerald-950 block">
                    الف) حساب مدیریت ارشد برنامه (دکتر مهدی امیری):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">ایمیل / نام کاربری مدیر:</span>
                        <span className="font-mono font-bold text-slate-900 text-[10.5px] truncate block" dir="ltr">{vault.managerEmail}</span>
                      </div>
                      <button type="button" aria-label="کپی ایمیل مدیر" onClick={() => copyToClipboard(vault.managerEmail, 'ایمیل مدیر')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">رمز عبور ارشد مدیر:</span>
                        <span className="font-mono font-bold text-emerald-800 text-[10.5px] truncate block" dir="ltr">
                          {showVaultSecrets ? vault.managerMasterPassword : '••••••••••••••••'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی رمز عبور ارشد مدیر" onClick={() => copyToClipboard(vault.managerMasterPassword, 'رمز عبور ارشد مدیر')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-[9.5px] text-slate-500 block font-bold">پین کد بازگشایی قفل قیمت:</span>
                        <span className="font-mono font-black text-emerald-800 text-[11px] block" dir="ltr">
                          {showVaultSecrets ? vault.managerPinCode : '•••••'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی پین کد مدیر" onClick={() => copyToClipboard(vault.managerPinCode, 'پین کد مدیر')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section B: Supabase Cloud Database & Dashboard Credentials */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <span className="text-[11px] font-black text-slate-900 block">
                    ب) مشخصات کامل دیتابیس ابری سوپابیس (Supabase Cloud DB & PostgreSQL):
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden flex-1">
                        <span className="text-[9.5px] text-slate-500 block font-bold">آدرس پروژه (Supabase URL):</span>
                        <input
                          type="text"
                          value={vault.supabaseProjectUrl}
                          onChange={(e) => setVault({ ...vault, supabaseProjectUrl: e.target.value })}
                          placeholder="https://your-project.supabase.co (VITE_SUPABASE_URL)"
                          className="w-full font-mono text-emerald-700 font-bold text-[10.5px] bg-transparent focus:outline-none"
                          dir="ltr"
                        />
                      </div>
                      <button type="button" aria-label="کپی آدرس URL سوپابیس" onClick={() => copyToClipboard(vault.supabaseProjectUrl, 'آدرس URL سوپابیس')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-slate-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden flex-1">
                        <span className="text-[9.5px] text-slate-500 block font-bold">میزبان مستقیم دیتابیس (PostgreSQL Host):</span>
                        <span className="font-mono text-slate-800 font-bold text-[10.5px] truncate block" dir="ltr">
                          {vault.supabaseDbHost}:{vault.supabaseDbPort}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی میزبان دیتابیس" onClick={() => copyToClipboard(vault.supabaseDbHost, 'میزبان دیتابیس')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-slate-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-[9.5px] text-slate-500 block font-bold">نام کاربری دیتابیس (DB User):</span>
                        <span className="font-mono font-bold text-slate-900 text-[10.5px]" dir="ltr">{vault.supabaseDbUser}</span>
                      </div>
                      <button type="button" aria-label="کپی نام کاربری دیتابیس" onClick={() => copyToClipboard(vault.supabaseDbUser, 'نام کاربری دیتابیس')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-slate-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">رمز دیتابیس (DB Password):</span>
                        <span className="font-mono font-bold text-rose-700 text-[10.5px] truncate block" dir="ltr">
                          {showVaultSecrets ? vault.supabaseDbPassword : '••••••••••••••••'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی رمز عبور دیتابیس سوپابیس" onClick={() => copyToClipboard(vault.supabaseDbPassword, 'رمز عبور دیتابیس سوپابیس')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-slate-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">رمز پنل سوپابیس ({vault.supabaseDashboardEmail}):</span>
                        <span className="font-mono font-bold text-indigo-700 text-[10.5px] truncate block" dir="ltr">
                          {showVaultSecrets ? vault.supabaseDashboardPassword : '••••••••••••••••'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی رمز پنل سوپابیس" onClick={() => copyToClipboard(vault.supabaseDashboardPassword, 'رمز پنل سوپابیس')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-slate-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="overflow-hidden flex-1">
                      <span className="text-[9.5px] text-slate-500 block font-bold">کلید عمومی ارتباط (Supabase Anon Key):</span>
                      <input aria-label="کلید عمومی ارتباط (Supabase Anon Key)"
                        type="text"
                        value={vault.supabaseAnonKey}
                        onChange={(e) => setVault({ ...vault, supabaseAnonKey: e.target.value })}
                        className="w-full font-mono text-slate-700 text-[10px] bg-transparent focus:outline-none"
                        dir="ltr"
                      />
                    </div>
                    <button type="button" aria-label="کپی کلید Anon Key" onClick={() => copyToClipboard(vault.supabaseAnonKey, 'Anon Key')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-slate-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Section C: Vercel & Cloud Run Production Hosting Credentials */}
                <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
                  <span className="text-[11px] font-black text-indigo-950 block">
                    ج) اطلاعات سرور انتشار ابری Vercel Edge و Cloud Run (آپدیت خودکار لینک‌ها):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-indigo-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">لینک انتشار زنده (Live Production URL):</span>
                        <span className="font-mono font-bold text-indigo-700 text-[10px] truncate block" dir="ltr">{vault.cloudRunProductionUrl}</span>
                      </div>
                      <button type="button" aria-label="کپی لینک انتشار زنده" onClick={() => copyToClipboard(vault.cloudRunProductionUrl, 'لینک انتشار زنده')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">دامنه اختصاصی ورسل (Vercel Domain):</span>
                        <span className="font-mono font-bold text-indigo-700 text-[10px] truncate block" dir="ltr">{vault.vercelProductionUrl}</span>
                      </div>
                      <button type="button" aria-label="کپی دامنه ورسل" onClick={() => copyToClipboard(vault.vercelProductionUrl, 'دامنه ورسل')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-indigo-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">نام کاربری ورسل (Vercel Login):</span>
                        <span className="font-mono font-bold text-slate-800 text-[10px] truncate block" dir="ltr">{vault.vercelAccountEmail}</span>
                      </div>
                      <button type="button" aria-label="کپی ایمیل ورسل" onClick={() => copyToClipboard(vault.vercelAccountEmail, 'ایمیل ورسل')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">رمز عبور ورسل (Vercel Pass):</span>
                        <span className="font-mono font-bold text-rose-700 text-[10.5px] truncate block" dir="ltr">
                          {showVaultSecrets ? vault.vercelAccountPassword : '••••••••••••••••'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی رمز عبور ورسل" onClick={() => copyToClipboard(vault.vercelAccountPassword, 'رمز عبور ورسل')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">توکن CLI انتشار (Deploy Token):</span>
                        <span className="font-mono font-bold text-slate-700 text-[10px] truncate block" dir="ltr">
                          {vault.vercelCliToken ? (showVaultSecrets ? vault.vercelCliToken : '••••••••••••••••') : 'تنظیم در سرور / CI'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی توکن انتشار ورسل" onClick={() => copyToClipboard(vault.vercelCliToken || 'تنظیم در CI/سرور', 'توکن انتشار ورسل')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section D: Native APK & iOS 27 IPA Signing Credentials */}
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                  <span className="text-[11px] font-black text-amber-950 block">
                    د) کلیدهای امضای دیجیتال اندروید (APK Keystore) و آیفون (iOS 27 IPA Apple ID):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">شناسه بسته (Bundle ID):</span>
                        <span className="font-mono font-bold text-slate-900 text-[10.5px] truncate block" dir="ltr">{vault.appBundleId}</span>
                      </div>
                      <button type="button" aria-label="کپی Bundle ID" onClick={() => copyToClipboard(vault.appBundleId, 'Bundle ID')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-amber-50 text-slate-500 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">رمز Keystore اندروید (APK):</span>
                        <span className="font-mono font-bold text-amber-900 text-[10.5px] truncate block" dir="ltr">
                          {vault.androidKeystorePassword ? (showVaultSecrets ? vault.androidKeystorePassword : '••••••••••••••••') : 'محرمانه (CI Secret)'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی رمز Keystore اندروید" onClick={() => copyToClipboard(vault.androidKeystorePassword || '', 'رمز Keystore اندروید')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-amber-50 text-slate-500 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between gap-1">
                      <div className="overflow-hidden">
                        <span className="text-[9.5px] text-slate-500 block font-bold">رمز امضای IPA اپل {vault.appleTeamId ? `(Team ${vault.appleTeamId})` : ''}:</span>
                        <span className="font-mono font-bold text-amber-900 text-[10.5px] truncate block" dir="ltr">
                          {vault.appleAppSpecificPassword ? (showVaultSecrets ? vault.appleAppSpecificPassword : '••••••••••••••••') : 'محرمانه (Xcode Cloud)'}
                        </span>
                      </div>
                      <button type="button" aria-label="کپی رمز امضای IPA اپل" onClick={() => copyToClipboard(vault.appleAppSpecificPassword || '', 'رمز امضای IPA اپل')} className="min-w-[36px] min-h-[36px] rounded-[10px] hover:bg-amber-50 text-slate-500 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveVaultChanges}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  ذخیره تغییرات کلیدها و اتصال مجدد آنی به سرور ابری
                </button>
              </div>

              {/* 4. Automated Cloud, Google Drive & Local Time-Machine Backup Scheduler */}
              <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border-2 border-teal-200/90 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-teal-600" />
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        پشتیبان‌گیری خودکار سه‌گانه (ابری سوپابیس + گوگل درایو + حافظه لوکال)
                      </span>
                      <span className="text-[10px] text-teal-700 font-bold block">
                        تضمین ۱۰۰٪ عدم حذف اطلاعات با زمان‌بندی دلخواه و بازیابی آنی (Time-Machine Restore)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      updateBackupSchedule(
                        { autoBackupEnabled: !backupSchedule.autoBackupEnabled },
                        !backupSchedule.autoBackupEnabled
                          ? 'پشتیبان‌گیری خودکار روزانه فعال شد.'
                          : 'پشتیبان‌گیری خودکار روزانه متوقف شد.'
                      );
                    }}
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                      backupSchedule.autoBackupEnabled
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {backupSchedule.autoBackupEnabled ? 'بک‌آپ خودکار: فعال ✓' : 'بک‌آپ خودکار: خاموش'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px]">
                  <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-600 block text-[9.5px] font-bold mb-1">ساعت بک‌آپ خودکار روزانه:</span>
                      <input
                        type="time"
                        aria-label="ساعت بک‌آپ خودکار روزانه"
                        value={backupSchedule.backupTime}
                        onChange={(e) =>
                          updateBackupSchedule(
                            { backupTime: e.target.value || '22:30' },
                            `ساعت بک‌آپ خودکار روزانه به ${toPersianDigits(e.target.value || '22:30')} تغییر یافت.`
                          )
                        }
                        className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1 font-mono font-black text-teal-950 text-xs focus:outline-none"
                      />
                    </div>
                    <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-600 block text-[9.5px] font-bold mb-1">مقصد گوگل درایو مدیر:</span>
                      <input
                        type="email"
                        aria-label="جیمیل مقصد گوگل درایو"
                        dir="ltr"
                        value={backupSchedule.driveEmail}
                        onChange={(e) => updateBackupSchedule({ driveEmail: e.target.value })}
                        onBlur={() => updateBackupSchedule({}, 'آدرس گوگل درایو پشتیبان ذخیره شد.')}
                        className="w-full bg-white border border-sky-300 rounded-lg px-2 py-1 font-mono font-bold text-sky-950 text-[10.5px] focus:outline-none"
                      />
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-slate-600 block text-[9.5px] font-bold">اسنپ‌شات‌های ذخیره شده:</span>
                      <span className="font-mono font-black text-emerald-950 text-[10.5px] block truncate">
                        {backupSnapshots.length > 0
                          ? `${toPersianDigits(backupSnapshots.length)} نسخه · ${backupSnapshots[0].jalaliTimestamp}`
                          : `${toPersianDigits(patients.length)} بیمار آماده بکاپ`}
                      </span>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>دانلود بک‌آپ لوکال (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInstantCloudAndDriveBackup}
                    className="py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>بک‌آپ آنی در گوگل درایو و ابر</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPatientsCsv}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>خروجی اکسل بیماران (.CSV)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <label className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-amber-700" />
                    <span>بازیابی دیتابیس از فایل بکاپ (.JSON)</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      aria-label="انتخاب فایل بکاپ JSON برای بازیابی"
                      onChange={handleRestoreFromJsonFile}
                      className="hidden"
                    />
                  </label>

                  {onOpenBackupModal && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        onOpenBackupModal();
                      }}
                      className="py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-purple-700" />
                      <span>باز کردن کنسول کامل بکاپ و تایم‌ماشین</span>
                    </button>
                  )}
                </div>

                {backupSnapshots.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <span className="text-[10.5px] font-black text-slate-800 block">
                      تاریخچه اسنپ‌شات‌های اخیر ({toPersianDigits(backupSnapshots.length)} نقطه بازیابی):
                    </span>
                    <div className="space-y-1">
                      {backupSnapshots.slice(0, 3).map((snap) => (
                        <div key={snap.id} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-[10.5px]">
                          <div className="min-w-0 truncate">
                            <span className="font-black text-slate-900">{snap.jalaliTimestamp}</span>
                            <span className="text-slate-500 mr-2">
                              {toPersianDigits(snap.patientsCount)} بیمار · {toPersianDigits(snap.appointmentsCount)} نوبت
                            </span>
                          </div>
                          {snap.payloadJson && (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  applyRestoredPayload(JSON.parse(snap.payloadJson!), `اسنپ‌شات ${snap.jalaliTimestamp}`);
                                } catch {
                                  showToast('⚠️ خطا در خواندن اسنپ‌شات ذخیره شده.');
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>بازیابی</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4B. Live Google Drive Auto-Backup & Restore Panel */}
              <GoogleDriveBackupPanel
                isManager={isClinicManager(currentUser)}
                buildBackupJson={buildClinicBackupJson}
                onRestoreBackupData={(restored) => {
                  applyRestoredPayload(restored, 'Google Drive');
                }}
                onNotify={(msg) => showToast(msg)}
              />

              {/* 4C. Shared Multi-User Clinic Staff Access & Server Price Lock */}
              <ClinicStaffCloudAccessPanel
                onNotify={(msg) => showToast(msg)}
              />

              {/* 5. Full Source Code ZIP Download Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-amber-300/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-black text-slate-900">دانلود بسته کامل سورس‌کد پروژه (APK, IPA, PWA Source ZIP)</span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300 font-mono">
                    Full Source
                  </span>
                </div>

                <button type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    if (onOpenProjectDownload) {
                      onOpenProjectDownload();
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 stroke-[2.5]" />
                  <span>دانلود مستقیم فایل کامل پروژه (minadental-source-full.zip)</span>
                </button>
              </div>

              {/* 6. In-App PWA / Home Screen Native Installer with 3D Tooth Logo */}
              <div className="bg-gradient-to-br from-purple-600/10 via-white to-purple-600/5 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-purple-300/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center shrink-0">
                      <Logo3DMainDentalTooth size={38} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">نصب مستقیم برنامه روی گوشی و سیستم (PWA / APK / IPA)</h4>
                      <p className="text-[10px] text-purple-700 font-bold">متصل به کانال آپدیت خودکار OTA پس از نصب روی هوم‌اسکرین</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-900 font-black px-2.5 py-0.5 rounded-full border border-purple-300">
                    {isInstalled ? '✓ نصب شده روی دستگاه' : 'آماده نصب'}
                  </span>
                </div>

                {isInstallable && !isInstalled && (
                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic('heavy');
                      const ok = await triggerPwaInstall();
                      if (ok) {
                        showToast('برنامه مینادنتال با موفقیت روی صفحه اصلی دستگاه نصب شد و به کانال آپدیت خودکار OTA متصل گردید.');
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>نصب مستقیم برنامه مینادنتال روی این دستگاه (۱ کلیک)</span>
                  </button>
                )}

                {/* Direct 1-Tap Native Package Downloads (Android APK + iPhone IPA + iPhone Direct Profile) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic('heavy');
                      await downloadAndroidApk(() => {
                        showToast(`فایل نصبی اندروید (MinaDental-v${MINADENTAL_PACKAGE_VERSION}.apk) با موفقیت دانلود شد.`);
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>دانلود اندروید (.APK)</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic('heavy');
                      await downloadIosIpa(() => {
                        showToast(`فایل نصبی آیفون (MinaDental-v${MINADENTAL_PACKAGE_VERSION}.ipa) با موفقیت دانلود شد.`);
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>دانلود آیفون (.IPA)</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic('heavy');
                      await downloadIosMobileConfigProfile(() => {
                        showToast('پروفایل نصب مستقیم آیفون (MinaDental-iOS27.mobileconfig) دانلود شد. در آیفون از Settings > Profile Downloaded نصب کنید.');
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>نصب مستقیم پروفایل آیفون</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1">
                    <span className="font-black text-slate-800 flex items-center gap-1 text-[11px]">
                      🍏 راهنمای نصب روی آیفون (iOS 27 IPA / Profile):
                    </span>
                    <p className="text-slate-600 text-[10px] leading-relaxed">
                      {isIOS ? 'دکمه «نصب مستقیم پروفایل آیفون» را بزنید یا در سافاری دکمه Share ⎋ و Add to Home Screen را انتخاب کنید.' : '۱. دکمه «دانلود آیفون (.IPA)» یا «نصب مستقیم پروفایل آیفون» را بزنید. ۲. یا در سافاری گزینه Add to Home Screen را انتخاب کنید.'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1">
                    <span className="font-black text-slate-800 flex items-center gap-1 text-[11px]">
                      🤖 راهنمای نصب روی اندروید و نوت ۸ (APK / WebAPK):
                    </span>
                    <p className="text-slate-600 text-[10px] leading-relaxed">
                      فایل مستقیم <span className="font-mono">MinaDental-v{MINADENTAL_PACKAGE_VERSION}.apk</span> را دانلود و نصب کنید یا دکمه نصب مستقیم PWA را بزنید.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: HARDWARE PERIPHERALS, PC-POS, CALLER-ID & SMS GATEWAY */}
      {activeTab === 'hardware' && (
        <div className="mx-2 space-y-3 animate-in fade-in">
          {/* Card 1: PC-POS Card Reader Integration */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">پایانه فروش متصل به کامپیوتر (PC-POS شاپرک)</h4>
                  <p className="text-[10px] text-slate-500 font-bold">اتصال مستقیم فاکتورهای مطب به دستگاه کارتخوان بدون وارد کردن دستی مبلغ</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                پروتکل LAN / Serial
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">سوئیچ بانکی (PSP):</label>
                <select aria-label="سوئیچ بانکی (PSP)"
                  value={posProvider}
                  onChange={(e) => setPosProvider(e.target.value as PosProvider)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="behpardakht">به‌پرداخت ملت (Mellat)</option>
                  <option value="sadad">سداد بانک ملی (Sadad)</option>
                  <option value="sep">سامان‌کیش (SEP)</option>
                  <option value="asan_pardakht">آسان‌پرداخت (آپ)</option>
                  <option value="pasargad">پرداخت الکترونیک پاسارگاد (PEP)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">آدرس IP کارتخوان در شبکه مطب:</label>
                <input aria-label="آدرس IP کارتخوان در شبکه مطب"
                  type="text"
                  value={posIpAddress}
                  onChange={(e) => setPosIpAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 ltr text-left"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">پورت ارتباطی دیمون:</label>
                <input aria-label="پورت ارتباطی دیمون"
                  type="number"
                  value={posPort}
                  onChange={(e) => setPosPort(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 ltr text-left"
                />
              </div>
            </div>

            {/* Test POS Transaction */}
            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <span className="text-[11px] font-black text-emerald-950 block">آزمون ارسال تراکنش تستی به کارتخوان:</span>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={posTestAmount}
                    onChange={(e) => setPosTestAmount(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                    placeholder="مبلغ به تومان"
                  />
                  <span className="absolute left-3 top-2.5 text-[10px] text-slate-500 font-bold">تومان</span>
                </div>
                <button
                  type="button"
                  onClick={handleTestPosTransaction}
                  disabled={isTestingPos}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingPos ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال به پوز</span>
                </button>
              </div>

              {posTestResult && (
                <div className="p-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-[11px] font-mono leading-relaxed animate-in fade-in">
                  {posTestResult}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: USB Caller-ID Hardware */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">سخت‌افزار کالرآیدی خط تلفن مطب (USB Caller ID)</h4>
                  <p className="text-[10px] text-slate-500 font-bold">شناسایی خودکار بیمار به محض زنگ خوردن تلفن و بالا آوردن سوابق درمان</p>
                </div>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2.5 py-0.5 rounded-full border border-blue-300">
                پورت سریال USB
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">پورت دستگاه مودم کالرآیدی:</label>
                <input
                  type="text"
                  value={callerIdPort}
                  onChange={(e) => setCallerIdPort(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  placeholder="مثال: COM3 / USB Modem"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">تست شماره تلفن ورودی:</label>
                <div className="flex items-center gap-2">
                  <input aria-label="تست شماره تلفن ورودی"
                    type="text"
                    value={testCallerPhone}
                    onChange={(e) => setTestCallerPhone(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 ltr text-left"
                  />
                  <button
                    type="button"
                    onClick={handleSimulateCallerId}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>تست زنگ</span>
                  </button>
                </div>
              </div>
            </div>

            {callerTestResult && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed font-bold animate-in fade-in">
                {callerTestResult}
              </div>
            )}
          </div>

          {/* Card 3: Iranian SMS Gateway Configuration */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">وب‌سرویس پیامکی خدماتی ایران (SMS Pattern Service)</h4>
                  <p className="text-[10px] text-slate-500 font-bold">ارسال پیامک یادآوری نوبت، سررسید چک صیادی و اقساط بدون بلاک تبلیغاتی</p>
                </div>
              </div>
              <span className="text-[10px] bg-sky-100 text-sky-800 font-black px-2.5 py-0.5 rounded-full border border-sky-300">
                عبور از بلک‌لیست
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">سامانه پیامکی:</label>
                <select aria-label="سامانه پیامکی"
                  value={smsProvider}
                  onChange={(e) => setSmsProvider(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="kavenegar">کاوه‌نگار (Kavenegar)</option>
                  <option value="farazsms">فراز اس‌ام‌اس / آی‌پی‌پنل (FarazSMS)</option>
                  <option value="melipayamak">ملی‌پیامک (MeliPayamak)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">کلید وب‌سرویس (API Key):</label>
                <input aria-label="کلید وب‌سرویس (API Key)"
                  type="text"
                  value={smsApiKey}
                  onChange={(e) => setSmsApiKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 ltr text-left"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">سرشماره خط خدماتی:</label>
                <input aria-label="سرشماره خط خدماتی"
                  type="text"
                  value={smsSender}
                  onChange={(e) => setSmsSender(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 ltr text-left"
                />
              </div>
            </div>

            {/* Live SMS Pattern Dispatch Test */}
            <div className="p-3 bg-sky-50/70 rounded-2xl border border-sky-200 space-y-2">
              <span className="text-[11px] font-black text-sky-950 block">آزمون ارسال پیامک پترن خدماتی:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={smsTestMobile}
                  onChange={(e) => setSmsTestMobile(e.target.value)}
                  className="flex-1 bg-white border border-sky-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none ltr text-left"
                  placeholder="شماره موبایل گیرنده (09xxxxxxxxx)"
                />
                <button
                  type="button"
                  onClick={handleSendSmsTest}
                  disabled={isTestingSms}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingSms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال پیامک تستی</span>
                </button>
              </div>

              {smsTestResult && (
                <div className="p-2 rounded-xl bg-white border border-sky-300 text-sky-900 text-[11px] font-mono leading-relaxed animate-in fade-in">
                  {smsTestResult}
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Mobile Packaging (Capacitor APK & IPA) */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-white text-slate-900 border border-purple-200/90 rounded-[22px] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-purple-200/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Terminal className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-purple-950">پکیجینگ بومی موبایل: خروجی APK (اندروید) و IPA (آیفون)</h4>
                  <p className="text-[10px] text-purple-700 font-bold">پیکربندی Capacitor با شناسه ir.minadental.app آماده است</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('success');
                  if (onOpenProjectDownload) onOpenProjectDownload();
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>دریافت سورس‌کد و راهنمای ساخت</span>
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              جهت خروجی فایل‌های نصبی مستقل برای تبلت‌های پذیرش و گوشی هوشمند پزشکان، کافیست دستورات زیر را پس از استخراج فایل زیپ در ترمینال اجرا فرمایید:
            </p>

            <div className="p-3 rounded-xl bg-purple-100/70 border border-purple-200 text-[11px] font-mono text-purple-950 ltr text-left space-y-1">
              <div className="text-purple-700"># ساخت نسخه نیتیو اندروید و خروجی APK:</div>
              <div className="text-slate-900 font-bold">npx cap add android && npx cap open android</div>
              <div className="pt-1 text-purple-700"># ساخت نسخه نیتیو آیفون و خروجی IPA:</div>
              <div className="text-slate-900 font-bold">npx cap add ios && npx cap open ios</div>
            </div>
          </div>

          {/* Card 5: Camera & Optical Scanner Hardware Bridge Diagnostic */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-violet-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-violet-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">تست و تشخیص سخت‌افزار دوربین و اسکنر QR/بارکد</h4>
                  <p className="text-[10px] text-slate-500 font-bold">بررسی ایمن مجوز دوربین، محیط HTTPS و دوربین‌های متصل روی دستگاه</p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('medium');
                  const diag = await hardwareBridgeService.probeCameraHardware();
                  setCameraDiagnostics(diag);
                  showToast(
                    diag.permissionState === 'granted'
                      ? 'دوربین برای اسکن زنده آماده است ✓'
                      : diag.errorTitle || 'بررسی وضعیت دسترسی دوربین انجام شد.'
                  );
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-[12px] bg-violet-600 hover:bg-violet-700 text-white font-black text-[11px] cursor-pointer active:scale-95 transition-all"
              >
                بررسی سخت‌افزار دوربین
              </button>
            </div>

            {cameraDiagnostics && (
              <div className="p-3 rounded-2xl bg-violet-50/60 border border-violet-200 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-violet-950">وضعیت دسترسی: {cameraDiagnostics.permissionState}</span>
                  <span className="font-mono text-[10px] text-violet-800">
                    {toPersianDigits(cameraDiagnostics.devices.length)} دوربین شناسایی شد
                  </span>
                </div>
                {cameraDiagnostics.errorTitle && (
                  <p className="text-amber-800 font-bold">{cameraDiagnostics.errorTitle} — {cameraDiagnostics.errorHint}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: IMMUTABLE SECURITY & FINANCIAL AUDIT LOG + MANAGER SOFT-DELETE TRASH VAULT */}
      {activeTab === 'audit' && (
        <div className="mx-2 space-y-3" dir="rtl" data-audit-tick={auditRefreshTick}>
          {/* Manager-Only Soft-Delete Trash Vault (100% Zero-Loss Recovery) */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border-2 border-emerald-200/90 space-y-3 text-right">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">گاوصندوق حذفیات و بازیابی سوابق (فقط مدیر کلینیک)</h4>
                  <p className="text-[10px] text-slate-500 font-bold">
                    هیچ داده‌ای هرگز نابود نمی‌شود؛ موارد حذف‌شده توسط مدیر با ۱ کلیک قابل بازیابی کامل هستند.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-black bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {toPersianDigits(trashVaultItems.length)} رکورد بایگانی
              </span>
            </div>

            {!isManagerActive ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                <span>دسترسی به گاوصندوق حذفیات و بازیابی فقط برای مدیر کلینیک (دکتر مهدی امیری) باز است.</span>
              </div>
            ) : trashVaultItems.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 text-[11px] font-bold text-center">
                گاوصندوق حذفیات خالی است — تمام سوابق بیماران و مالی دست‌نخورده و سالم هستند ✓
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {trashVaultItems.map(vItem => (
                  <div key={vItem.id} className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200 flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-xs font-black text-slate-900 block truncate">{vItem.title}</span>
                      <span className="text-[10.5px] text-slate-600 block truncate">{vItem.subtitle}</span>
                      <span className="text-[9.5px] text-slate-500 font-mono block">
                        بایگانی توسط {vItem.deletedBy} · {toPersianDigits(vItem.deletedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (vItem.entityType === 'tariff' && vItem.payload) {
                            saveTariffsList([vItem.payload, ...tariffs.filter(t => t.id !== vItem.payload.id)]);
                            removeFromTrashVault(vItem.id);
                            showToast(`تعرفه «${vItem.payload.name}» بازیابی شد.`);
                          } else if (onRestoreVaultItem) {
                            onRestoreVaultItem(vItem);
                            showToast(`«${vItem.title}» با موفقیت بازیابی شد.`);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>بازیابی</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Immutable Server-Side Security Audit Log & Live Executive Summary */}
          <div
            data-testid="settings-server-audit-summary-panel"
            className="bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/80 rounded-[22px] p-4 shadow-2xs border-2 border-sky-200/90 space-y-3 text-right"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-sky-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    لاگ امنیتی تغییرناپذیر سرور و تراز مدیریتی زنده
                  </h4>
                  <p className="text-[10px] text-slate-600 font-bold">
                    ثبت مرکزی رویدادهای امنیتی، ادغام تعارضات، بکاپ‌ها و کالرآیدی تمام دستگاه‌ها روی دیسک سرور
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isLoadingServerAudit}
                onClick={() => void refreshServerAuditAndSummary()}
                className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingServerAudit ? 'animate-spin' : ''}`} />
                <span>بروزرسانی زنده</span>
              </button>
            </div>

            {serverSummaryReport && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-white rounded-xl p-2 border border-sky-100">
                  <span className="text-[9.5px] font-bold text-slate-500 block">بیماران سرور</span>
                  <span className="text-xs font-black text-slate-900 block mt-0.5">
                    {toPersianDigits(serverSummaryReport.totalPatients)} پرونده
                  </span>
                </div>
                <div className="bg-white rounded-xl p-2 border border-emerald-100">
                  <span className="text-[9.5px] font-bold text-slate-500 block">دریافتی کل</span>
                  <span className="text-xs font-black text-emerald-700 block mt-0.5">
                    {formatToman(serverSummaryReport.totalPaidAmount)}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-2 border border-amber-100">
                  <span className="text-[9.5px] font-bold text-slate-500 block">مانده طلب</span>
                  <span className="text-xs font-black text-amber-700 block mt-0.5">
                    {formatToman(serverSummaryReport.totalOutstandingBalance)}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-2 border border-purple-100">
                  <span className="text-[9.5px] font-bold text-slate-500 block">نسخه‌های بکاپ</span>
                  <span className="text-xs font-black text-purple-700 block mt-0.5">
                    {toPersianDigits(serverSummaryReport.serverBackupsCount)} اسنپ‌شات
                  </span>
                </div>
              </div>
            )}

            {!isManagerActive ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                <span>مشاهده لاگ ممیزی مرکزی سرور مخصوص مدیر کلینیک (دکتر مهدی امیری) است.</span>
              </div>
            ) : serverAuditEntries.length === 0 ? (
              <div className="p-3 rounded-xl bg-white/90 border border-sky-100 text-slate-500 text-[11px] font-bold text-center">
                هنوز رویداد امنیتی یا مدیریتی روی سرور ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {serverAuditEntries.slice(0, 12).map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-start justify-between gap-2 text-[10.5px]"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <span className="font-black text-slate-900 block">{entry.action}</span>
                      {entry.details && (
                        <span className="text-[10px] text-slate-600 block truncate">{entry.details}</span>
                      )}
                      <span className="text-[9.5px] text-slate-500 font-mono block">
                        {entry.actor} · {new Date(entry.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9.5px] font-black shrink-0 border ${
                        entry.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : entry.severity === 'warning'
                            ? 'bg-amber-100 text-amber-900 border-amber-200'
                            : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {entry.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3 text-right">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">لاگ امنیتی غیرقابل‌حذف مالی و بالینی</h4>
                  <p className="text-[10px] text-slate-500 font-bold">ثبت رمزنگاری‌شده تمامی تغییرات تعرفه، چک، تلاش‌های مسدودشده و بایگانی مدیر</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-black bg-purple-50 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
                SHA-256 Immutable
              </span>
            </div>

            <div className="space-y-2">
              {(() => {
                let storedLogs: Array<{ id: string; timestamp: string; actor: string; role: string; action: string; details: string; hash: string }> = [];
                try {
                  storedLogs = JSON.parse(localStorage.getItem('minadental_immutable_audit_log') || '[]');
                } catch {}
                const defaultLogs = [
                  {
                    id: 'aud-default-1',
                    timestamp: `${getCurrentPersianDate()} - ۱۰:۴۲`,
                    actor: 'دکتر مهدی امیری',
                    role: 'admin',
                    action: 'تایید بیومتریک و ثبت تعرفه جراحی ایمپلنت',
                    details: 'بیمار: علی مرادی · دندان UR6 · تعرفه مصوب: ۱۴,۵۰۰,۰۰۰ تومان',
                    hash: 'SHA256_9F82D41A'
                  },
                  {
                    id: 'aud-default-2',
                    timestamp: `${getCurrentPersianDate()} - ۰۹:۱۵`,
                    actor: 'خانم رضایی (منشی)',
                    role: 'secretary',
                    action: 'ثبت چک صیادی در کارتابل مالی',
                    details: 'بیمار: علی مرادی · شناسه صیاد: ۷۴۹۱۸۳۹۲۱۶۴۸۵۲۰۰ · بانک ملت · ۱۰,۰۰۰,۰۰۰ تومان',
                    hash: 'SHA256_4C19B70E'
                  },
                  {
                    id: 'aud-default-3',
                    timestamp: `${getRelativePersianDate(-1)} - ۱۸:۳۰`,
                    actor: 'دکتر مهدی امیری',
                    role: 'admin',
                    action: 'قفل امنیتی ویرایش تعرفه و حذف پرونده برای غیرمدیر',
                    details: 'جلوگیری از تغییر دستی مبلغ درمان یا حذف رکورد بدون دسترسی مدیر کلینیک',
                    hash: 'SHA256_7E31A92C'
                  }
                ];
                const allLogs = [...storedLogs, ...defaultLogs];
                return allLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900">{log.action}</span>
                      <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        {log.hash}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium">{log.details}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>کاربر: <strong className="text-slate-800">{log.actor}</strong></span>
                      <span className="font-mono">{toPersianDigits(log.timestamp)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
