/**
 * MinaDental Industrial Security, RBAC, Crypto, Accounting, Design-System & Live Component DOM Audit Suite
 * Run via: npm run test:industrial
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_USERS, INITIAL_PLATFORMS, syncEngine } from '../services/syncEngine';
import { INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY } from '../data/mockData';
import {
  hashPasswordSync,
  verifyPasswordCredential,
  sanitizeUserAccount
} from '../utils/authCrypto';
import {
  isClinicManager,
  verifyManagerDeletion
} from '../utils/dataProtection';
import {
  toMicroUnits,
  fromMicroUnits,
  computeDoctorWorkCommissionLedger
} from '../utils/accountingEngine';
import {
  buildPatientIndex,
  paginateRecords,
  normalizePhoneLast7
} from '../utils/patientIndex';
import { AppHeader } from '../components/AppHeader';
import { BottomDock } from '../components/BottomDock';
import { ClinicHeroCard } from '../components/ClinicHeroCard';
import { FolderCard } from '../components/FolderCard';
import { DentalSkeletonLoader } from '../components/DentalSkeletonLoader';
import { PatientsListView } from '../components/views/PatientsListView';
import { AppointmentsView } from '../components/views/AppointmentsView';
import { FinancialView } from '../components/views/FinancialView';
import { LabModuleView } from '../components/views/LabModuleView';
import { ImplantModuleView } from '../components/views/ImplantModuleView';
import { InventoryView } from '../components/views/InventoryView';
import { RemindersView } from '../components/views/RemindersView';
import { DashboardView } from '../components/views/DashboardView';
import { SettingsView } from '../components/views/SettingsView';
import { AiAssistantView } from '../components/views/AiAssistantView';
import { MarketingCampaignsView } from '../components/views/MarketingCampaignsView';
import { InsuranceClaimsView } from '../components/views/InsuranceClaimsView';
import { SterilizationModuleView } from '../components/views/SterilizationModuleView';
import { XRayModuleView } from '../components/views/XRayModuleView';
import { NotificationDrawer, buildLiveClinicalNotifications } from '../components/NotificationDrawer';
import { IncomingCallBanner } from '../components/IncomingCallBanner';
import { GlobalCommandPalette } from '../components/GlobalCommandPalette';
import {
  analyzePatient360,
  buildGlobalSmartActions,
  searchClinicUniversal
} from '../utils/clinicalIntelligence';
import { ClinicSessionLockOverlay } from '../components/ClinicSessionLockOverlay';
import { ClinicalHudDrawer } from '../components/ClinicalHudDrawer';
import { PatientFileModal } from '../components/PatientFileModal';
import { PalmerChartModal } from '../components/PalmerChartModal';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { AddCheckModal } from '../components/AddCheckModal';
import { QuickAdmissionModal } from '../components/QuickAdmissionModal';
import { DoctorCommissionModal } from '../components/DoctorCommissionModal';
import { InstallmentPlanModal } from '../components/InstallmentPlanModal';
import { ConsentSignatureModal } from '../components/ConsentSignatureModal';
import { TreatmentInvoiceModal } from '../components/TreatmentInvoiceModal';
import { PatientBookingPortalModal } from '../components/PatientBookingPortalModal';
import { AccessibilityControlsModal } from '../components/AccessibilityControlsModal';
import { BackupModal } from '../components/BackupModal';
import { RoleSwitcherModal } from '../components/RoleSwitcherModal';
import { ServicesSheet } from '../components/ServicesSheet';
import { LiveSyncSimulatorModal } from '../components/LiveSyncSimulatorModal';
import { SupabaseTestModal } from '../components/SupabaseTestModal';
import { AddLabOrderModal } from '../components/AddLabOrderModal';
import { DigitalLabPortalModal } from '../components/DigitalLabPortalModal';
import { InventoryBarcodeModal } from '../components/InventoryBarcodeModal';
import { BatchCategoryModal, BatchStockModal } from '../components/InventoryBatchModal';
import { InventoryQrScannerModal } from '../components/InventoryQrScannerModal';
import { UniversalClinicScannerModal } from '../components/UniversalClinicScannerModal';
import { RealQrCode } from '../components/RealQrCode';
import {
  parseSayadCheckPayload,
  resolveClinicScanPayload,
  parseDentalProductBarcodePayload
} from '../utils/qrBarcodeScanner';
import { LabPrescriptionModal } from '../components/LabPrescriptionModal';
import { OneHandedActionSheet } from '../components/OneHandedActionSheet';
import { ProjectDownloadModal } from '../components/ProjectDownloadModal';
import { SmsGatewaySettingsModal } from '../components/SmsGatewaySettingsModal';
import { SupplierPurchaseOrderModal } from '../components/SupplierPurchaseOrderModal';
import {
  RealWorldClinicTestConsole,
  runClinicOperationalStressCycle,
  runRealWorld5k1k50kStressSuite,
  STRESS_TARGET_PATIENTS,
  STRESS_TARGET_LAB_ORDERS,
  STRESS_TARGET_FINANCIAL_TX,
  REAL_WORLD_STRESS_PATIENTS,
  REAL_WORLD_STRESS_LAB_ORDERS,
  REAL_WORLD_STRESS_FINANCIAL_TX
} from '../components/RealWorldClinicTestConsole';
import { PhaseAuditSuiteModal } from '../components/PhaseAuditSuiteModal';
import { ModuleErrorBoundary } from '../components/ModuleErrorBoundary';
import { AnimatedGeminiBackground } from '../components/AnimatedGeminiBackground';
import { SyncNotificationToast } from '../components/SyncNotificationToast';
import { ClinicUrgentAlarmsBanner } from '../components/ClinicUrgentAlarmsBanner';
import { FloatingNotificationBadge } from '../components/FloatingNotificationBadge';
import { FinancialPerformanceChart } from '../components/FinancialPerformanceChart';
import { FinancialWeeklyAnalytics } from '../components/FinancialWeeklyAnalytics';
import { LabPipelineFunnelWidget } from '../components/LabPipelineFunnelWidget';
import { LabOrderStatusVisualizer } from '../components/LabOrderStatusVisualizer';
import { ArmedActionButton } from '../components/ArmedActionButton';
import { DashboardPatientSearch } from '../components/DashboardPatientSearch';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { FramerTooltip } from '../components/FramerTooltip';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { otaUpdateService } from '../services/otaUpdateService';
import { getPersianDateParts, isSamePersianDate } from '../utils/jalali';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../utils/chipThemes';
import { indexedDbService } from '../services/indexedDbService';
import { copyTextSafely } from '../utils/clipboard';
import {
  INDUSTRIAL_STANDARDIZATION_PHASES,
  MASTER_SUPER_AUDIT_TRACKING_ID,
  GLOBAL_RELEASE_ROADMAP_STAGES,
  MASTER_GLOBAL_RELEASE_TRACKING_ID,
  auditTracker
} from '../utils/auditTracker';
import { hardwareBridgeService } from '../services/hardwareBridgeService';
import { verifyClinicDataIntegrity } from '../utils/integrityVerifier';

const WORKSPACE_ROOT = process.cwd();

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    count++;
    pos = idx + needle.length;
  }
  return count;
}

async function runIndustrialAuditSuite() {
  console.log('=== MinaDental Full Industrial + UI/UX Audit Suite ===');

  // ---------------------------------------------------------------------------
  // 1. Zero plaintext passwords in seed users + salted SHA-256 verification
  // ---------------------------------------------------------------------------
  for (const u of INITIAL_USERS) {
    assert.equal(u.password, undefined, `Seed user ${u.username} must NOT store plaintext password`);
    assert.ok(u.passwordHash?.startsWith('sha256$'), `Seed user ${u.username} must have salted sha256 hash`);
  }
  const manager = INITIAL_USERS.find(u => u.role === 'admin')!;
  const secretary = INITIAL_USERS.find(u => u.role === 'secretary')!;
  const doctor = INITIAL_USERS.find(u => u.role === 'doctor')!;

  assert.equal(verifyPasswordCredential('amiri@dental2025', manager), true, 'Manager valid password must verify');
  assert.equal(verifyPasswordCredential('wrong-pass', manager), false, 'Manager invalid password must fail');
  assert.equal(verifyPasswordCredential('monshi@mina2025', secretary), true, 'Secretary valid password must verify');

  // ---------------------------------------------------------------------------
  // 2. Credential sanitization removes plaintext password immediately
  // ---------------------------------------------------------------------------
  const customHash = hashPasswordSync('Clinic@2026');
  assert.ok(customHash.startsWith('sha256$'));
  const sanitized = sanitizeUserAccount({ ...doctor, password: 'TempPassword!99' });
  assert.equal(sanitized.password, undefined, 'Sanitized user must strip plaintext password');
  assert.equal(verifyPasswordCredential('TempPassword!99', sanitized), true, 'Sanitized user must verify via passwordHash');

  // ---------------------------------------------------------------------------
  // 3. Strict Manager-Only Deletion Guard (RBAC)
  // ---------------------------------------------------------------------------
  assert.equal(isClinicManager(manager), true, 'Admin/Manager must be recognized as Clinic Manager');
  assert.equal(isClinicManager(secretary), false, 'Secretary must NOT be recognized as Clinic Manager');
  assert.equal(isClinicManager(doctor), false, 'Non-manager Doctor must NOT be recognized as Clinic Manager');
  assert.equal(isClinicManager(null), false, 'Null user must NOT be recognized as Clinic Manager');

  assert.equal(verifyManagerDeletion(manager, 'حذف تست', 'id-1'), true, 'Manager deletion must pass');
  assert.equal(verifyManagerDeletion(secretary, 'حذف غیرمجاز منشی', 'id-2'), false, 'Secretary deletion must be blocked');
  assert.equal(verifyManagerDeletion(doctor, 'حذف غیرمجاز پزشک', 'id-3'), false, 'Doctor deletion must be blocked');

  // ---------------------------------------------------------------------------
  // 4. Millionth-Precision (10^-6) Fixed-Point Accounting Separation
  // ---------------------------------------------------------------------------
  const microA = toMicroUnits(1_250_000.123456);
  const microB = toMicroUnits(750_000.876544);
  assert.equal(fromMicroUnits(microA + microB), 2_000_001, '10^-6 fixed point addition must have zero float drift');

  const ledger = computeDoctorWorkCommissionLedger(INITIAL_PATIENTS, {
    doctorId: 'doc-1',
    doctorName: 'دکتر مهدی امیری',
    specialty: 'جراحی و ایمپلنت',
    isManager: true,
    model: 'lab_split_half',
    percentageRate: 50,
    fixedWagePerTreatment: 0
  });
  assert.ok(ledger.totalRegisteredGrossWork >= 0, 'Doctor work ledger must compute cleanly');
  assert.equal(
    ledger.exactDoctorPayable + ledger.exactClinicRetainedShare,
    ledger.netCommissionableBase,
    'Doctor payable + Clinic retained share must exactly equal net commissionable base'
  );

  // ---------------------------------------------------------------------------
  // 5. O(1) Patient Index & Pagination Scaling
  // ---------------------------------------------------------------------------
  const index = buildPatientIndex(INITIAL_PATIENTS);
  const sample = INITIAL_PATIENTS[0];
  assert.equal(index.byId.get(sample.id)?.id, sample.id, 'O(1) byId lookup must match');
  const last7 = normalizePhoneLast7(sample.phone);
  if (last7.length === 7) {
    assert.ok(index.byPhoneLast7.get(last7), 'O(1) byPhoneLast7 lookup must resolve patient');
  }
  const page1 = paginateRecords(INITIAL_PATIENTS, 1, 2);
  assert.equal(page1.items.length, Math.min(2, INITIAL_PATIENTS.length));
  assert.equal(page1.total, INITIAL_PATIENTS.length);

  // ---------------------------------------------------------------------------
  // 6. Industrial CSS Design-Token, Motion & Accessibility Contract
  // ---------------------------------------------------------------------------
  const indexCss = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/index.css'), 'utf8');
  assert.ok(
    indexCss.includes('@custom-variant dark (&:where(.theme-dark, .theme-dark *));'),
    'Tailwind v4 @custom-variant dark selector must be declared in index.css'
  );
  for (const token of [
    '--radius-outer: 20px',
    '--radius-inner: 12px',
    '--shadow-card:',
    '--shadow-elevated:',
    '--shadow-dock:',
    '--ease-spring:',
    '--dock-height-mobile: 48px',
    '--header-height-mobile: 54px'
  ]) {
    assert.ok(indexCss.includes(token), `Missing required CSS design token: ${token}`);
  }
  assert.ok(indexCss.includes('prefers-reduced-motion: reduce'), 'Global reduced-motion media query required');
  assert.ok(indexCss.includes(':focus-visible'), 'Global keyboard focus-visible styling required');
  assert.ok(indexCss.includes('tabular-nums'), 'Global tabular-nums numeric alignment required');
  assert.ok(indexCss.includes('.dashboard-view .grid .tile'), 'Dashboard tile CSS contract required');
  assert.ok(indexCss.includes('.dashboard-view .grid .tile .tile-card-typography'), 'Dedicated .tile-card-typography selector required');
  assert.ok(indexCss.includes('box-shadow: 0 4px 24px -2px'), 'Dashboard tile 4px high-blur low-spread box-shadow required');
  assert.ok(indexCss.includes('line-height: 1.6'), 'Clinical typography line-height: 1.6 required across sections');
  assert.ok(indexCss.includes('--leading-clinical: 1.6'), 'Vazirmatn typography system must define --leading-clinical: 1.6');
  for (const typoClass of ['.typo-display', '.typo-heading', '.typo-subheading', '.typo-body', '.typo-numeric']) {
    assert.ok(indexCss.includes(typoClass), `Missing Vazirmatn semantic typography class: ${typoClass}`);
  }
  assert.ok(indexCss.includes('height: var(--dock-height-mobile)'), 'Mobile BottomDock 48px CSS rule required');
  assert.equal(
    countOccurrences(indexCss, '.dashboard-view .grid {'),
    1,
    'Duplicate .dashboard-view .grid rules must not exist'
  );
  assert.equal(
    countOccurrences(indexCss, '.animate-bell-ring {'),
    1,
    'Duplicate .animate-bell-ring rules must not exist'
  );

  // ---------------------------------------------------------------------------
  // 7. Sticky Chrome Budget (<= 15%) & Zero Double-Card Border Audit across Views
  // ---------------------------------------------------------------------------
  const viewsDir = path.join(WORKSPACE_ROOT, 'src/components/views');
  const viewFiles = fs.readdirSync(viewsDir).filter(f => f.endsWith('.tsx'));
  assert.ok(viewFiles.length >= 13, 'Expected all module view files in src/components/views');
  for (const file of viewFiles) {
    const content = fs.readFileSync(path.join(viewsDir, file), 'utf8');
    assert.equal(
      content.includes('sticky top-12'),
      false,
      `${file} must not declare secondary sticky top-12 bars above/behind AppHeader`
    );
  }
  const dashboardContent = fs.readFileSync(path.join(viewsDir, 'DashboardView.tsx'), 'utf8');
  assert.equal(
    dashboardContent.includes('rounded-[24px] p-1.5 sm:p-2 bg-slate-50/40 border-2'),
    false,
    'DashboardView grid must not wrap Q-Bank tiles in redundant outer double borders'
  );
  assert.equal(
    getModuleHeaderCardClasses('emerald').includes('border-b-[5px]'),
    false,
    'Module header cards must use crisp hairline elevation instead of heavy retro border-b-[5px]'
  );
  assert.ok(
    getUnifiedChipClasses(0, true).includes('min-h-[38px]') &&
      !getUnifiedChipClasses(0, true).includes('scale-[1.02]'),
    'Unified chips must enforce 38px min height without scale overflow clipping'
  );

  // ---------------------------------------------------------------------------
  // 8. Real React SSR DOM Mounting & Visual Integrity Assertions
  // ---------------------------------------------------------------------------
  const headerHtml = renderToStaticMarkup(
    React.createElement(AppHeader, {
      title: 'داشبورد',
      currentUser: manager,
      unreadRemindersCount: 3,
      showBack: true,
      onBack: () => {},
      onOpenProfile: () => {},
      onOpenReminders: () => {},
      onOpenSearch: () => {},
      onTriggerSync: async () => true
    })
  );
  assert.ok(headerHtml.includes('<header'), 'AppHeader must render semantic <header>');
  assert.ok(headerHtml.includes('h-[52px]'), 'AppHeader must enforce compact 52px mobile sticky height');
  assert.ok(headerHtml.includes('aria-label="جستجوی بیمار"'), 'AppHeader buttons must carry ARIA labels');
  assert.ok(headerHtml.includes('aria-label="بازگشت به داشبورد"'), 'AppHeader back button must carry ARIA label');
  assert.equal(headerHtml.includes('animate-ping'), false, 'AppHeader must not render decorative animate-ping halos');
  assert.equal(headerHtml.includes('NaN') || headerHtml.includes('undefined'), false, 'AppHeader HTML leak check');

  const dockHtml = renderToStaticMarkup(
    React.createElement(BottomDock, {
      activeTab: 'home',
      onTabChange: () => {},
      onOpenServicesMenu: () => {},
      onOpenThumbZone: () => {}
    })
  );
  assert.ok(dockHtml.includes('<nav'), 'BottomDock must render semantic <nav>');
  assert.ok(dockHtml.includes('BottomDock'), 'BottomDock class selector must be preserved');
  assert.ok(dockHtml.includes('h-[48px]'), 'BottomDock must enforce 48px mobile height');
  assert.ok(dockHtml.includes('flex-1 grow basis-0'), 'BottomDock tabs must evenly distribute with flex-grow');
  assert.ok(dockHtml.includes('dock-icon-slot flex items-center justify-center grow'), 'BottomDock icons must apply flex-grow (grow) to prevent touch overlap');
  assert.equal(dockHtml.includes('undefined') || dockHtml.includes('NaN'), false, 'BottomDock HTML leak check');

  const heroHtml = renderToStaticMarkup(
    React.createElement(ClinicHeroCard, {
      onQuickAdmission: () => {},
      onOpenPalmerChart: () => {},
      onOpenAppointments: () => {},
      onOpenFinancial: () => {},
      onOpenImplant: () => {},
      onOpenLab: () => {},
      todayAppointmentsCount: 14,
      activeSurgeriesCount: 3,
      readyLabOrdersCount: 2,
      dailyRevenue: 45_000_000
    })
  );
  assert.ok(heroHtml.includes('<section'), 'ClinicHeroCard must render semantic <section>');
  assert.ok(heroHtml.includes('min-h-[44px]'), 'ClinicHeroCard primary CTAs must satisfy >= 44px touch targets');
  assert.ok(heroHtml.includes('tabular-nums'), 'ClinicHeroCard KPI values must enforce tabular-nums');
  assert.equal(heroHtml.includes('animate-ping'), false, 'ClinicHeroCard must avoid decorative ping dots');
  assert.equal(heroHtml.includes('NaN') || heroHtml.includes('undefined'), false, 'ClinicHeroCard HTML leak check');

  const folderHtml = renderToStaticMarkup(
    React.createElement(FolderCard, {
      title: 'بیماران',
      subtitle: '۳ پرونده فعال',
      badge: '۳',
      theme: 'emerald',
      onClick: () => {},
      icon: React.createElement('span', null, 'icon')
    })
  );
  assert.ok(folderHtml.includes('tile '), 'FolderCard must expose .tile CSS hook');
  assert.ok(folderHtml.includes('tile-card-typography'), 'FolderCard must apply .tile-card-typography');
  assert.ok(folderHtml.includes('leading-[1.6]'), 'FolderCard must enforce line-height 1.6');
  assert.ok(folderHtml.includes('min-h-[72px]'), 'FolderCard must enforce low-height Q-Bank 72px profile');
  assert.ok(indexCss.includes('min-height: 72px;'), 'index.css .dashboard-view .grid .tile must enforce min-height: 72px');
  assert.ok(
    dashboardContent.includes('grid-cols-2 gap-2.5 sm:gap-3'),
    'DashboardView must render strict 2-column (grid-cols-2) Q-Bank paired tiles'
  );
  assert.ok(
    folderHtml.includes('stroke-width="1.25"') || folderHtml.includes('strokeWidth="1.25"'),
    'FolderCard SVG border must use hairline 1.25 stroke'
  );
  assert.equal(folderHtml.includes('animate-ping'), false, 'FolderCard must avoid pulsing ping halos');

  for (const skType of ['dashboard', 'patient-card', 'table', 'tooth-chart'] as const) {
    const skHtml = renderToStaticMarkup(React.createElement(DentalSkeletonLoader, { type: skType }));
    assert.ok(skHtml.includes('dental-shimmer'), `DentalSkeletonLoader (${skType}) must use deterministic dental-shimmer`);
    assert.equal(skHtml.includes('animate-pulse'), false, `DentalSkeletonLoader (${skType}) must not fall back to generic animate-pulse`);
  }

  // ---------------------------------------------------------------------------
  // 9. Dark-Mode Shell & Surface Parity Contract
  // ---------------------------------------------------------------------------
  for (const darkSelector of [
    'html.theme-dark .AppHeader',
    'html.theme-dark .BottomDock > div',
    'html.theme-dark .bg-white\\/92',
    'html.theme-dark .bg-white\\/95'
  ]) {
    assert.ok(
      indexCss.includes(darkSelector),
      `Missing dark-mode adapter selector in src/index.css: ${darkSelector}`
    );
  }

  // ---------------------------------------------------------------------------
  // 10. Zero Heavy Retro Borders & Unrequested Bounce Clutter
  // ---------------------------------------------------------------------------
  const heavyBorderRegex = /border-r-\[[567]px\]/;
  for (const file of viewFiles) {
    const content = fs.readFileSync(path.join(viewsDir, file), 'utf8');
    assert.equal(
      heavyBorderRegex.test(content),
      false,
      `${file} must use refined hairline border-r-[3px] instead of heavy 5/6/7px borders`
    );
  }
  for (const relPath of [
    'src/components/PatientFileModal.tsx',
    'src/components/PalmerChartModal.tsx',
    'src/components/ActionVerificationHud.tsx',
    'src/components/ArmedActionButton.tsx',
    'src/components/ProjectDownloadModal.tsx',
    'src/components/LabOrderStatusVisualizer.tsx'
  ]) {
    const content = fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf8');
    assert.equal(
      heavyBorderRegex.test(content),
      false,
      `${relPath} must not contain heavy border-r-[567]px`
    );
    assert.equal(
      content.includes('animate-bounce'),
      false,
      `${relPath} must not contain decorative animate-bounce jitter`
    );
  }

  // Scan ALL src/components/**/*.tsx recursively for zero window.alert/confirm/open & zero animate-bounce
  const collectTsxFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectTsxFiles(full));
      else if (entry.name.endsWith('.tsx')) out.push(full);
    }
    return out;
  };
  for (const tsxFile of collectTsxFiles(path.join(WORKSPACE_ROOT, 'src/components'))) {
    const srcContent = fs.readFileSync(tsxFile, 'utf8');
    assert.equal(
      /window\.(alert|confirm|open)\(/.test(srcContent),
      false,
      `${path.relative(WORKSPACE_ROOT, tsxFile)} must not call blocking window.alert/confirm/open`
    );
    assert.equal(
      srcContent.includes('animate-bounce'),
      false,
      `${path.relative(WORKSPACE_ROOT, tsxFile)} must not use unrequested animate-bounce`
    );
  }

  // ---------------------------------------------------------------------------
  // 11. Live SSR DOM Verification of All Core Clinical Views & Overlays
  // ---------------------------------------------------------------------------
  const renderedModules: Array<{ name: string; html: string; mustContain: string[] }> = [
    {
      name: 'PatientsListView',
      html: renderToStaticMarkup(
        React.createElement(PatientsListView, {
          patients: INITIAL_PATIENTS,
          onOpenPatientFile: () => {},
          onAddNewPatient: () => {},
          isManager: true
        })
      ),
      mustContain: [INITIAL_PATIENTS[0].fullName, 'پرونده']
    },
    {
      name: 'AppointmentsView',
      html: renderToStaticMarkup(
        React.createElement(AppointmentsView, {
          appointments: INITIAL_APPOINTMENTS,
          patients: INITIAL_PATIENTS,
          onAddAppointment: () => {},
          onUpdateStatus: () => {},
          isManager: true
        })
      ),
      mustContain: ['یونیت آبی', 'یونیت زرد', 'یونیت جراحی', 'نوبت']
    },
    {
      name: 'FinancialView',
      html: renderToStaticMarkup(
        React.createElement(FinancialView, {
          patients: INITIAL_PATIENTS,
          onOpenCheckModal: () => {},
          onOpenPatientFile: () => {},
          isManager: true
        })
      ),
      mustContain: ['مالی', 'تومان']
    },
    {
      name: 'LabModuleView',
      html: renderToStaticMarkup(
        React.createElement(LabModuleView, {
          patients: INITIAL_PATIENTS,
          onOpenPatientFile: () => {},
          onAddLabOrder: () => {},
          onUpdateStatus: () => {},
          isManager: true
        })
      ),
      mustContain: ['لابراتوار']
    },
    {
      name: 'ImplantModuleView',
      html: renderToStaticMarkup(
        React.createElement(ImplantModuleView, {
          patients: INITIAL_PATIENTS,
          onOpenPatientFile: () => {},
          onAdvanceStage: () => {},
          isManager: true
        })
      ),
      mustContain: ['ایمپلنت']
    },
    {
      name: 'InventoryView',
      html: renderToStaticMarkup(
        React.createElement(InventoryView, {
          inventory: INITIAL_INVENTORY,
          onUpdateStock: () => {},
          isManager: true
        })
      ),
      mustContain: ['انبار', INITIAL_INVENTORY[0].name]
    },
    {
      name: 'RemindersView',
      html: renderToStaticMarkup(
        React.createElement(RemindersView, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS
        })
      ),
      mustContain: ['یادآوری']
    },
    {
      name: 'NotificationDrawer',
      html: renderToStaticMarkup(
        React.createElement(NotificationDrawer, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS
        })
      ),
      mustContain: ['اعلان']
    },
    {
      name: 'IncomingCallBanner',
      html: renderToStaticMarkup(
        React.createElement(IncomingCallBanner, {
          call: {
            id: 'call-ssr-1',
            phoneNumber: INITIAL_PATIENTS[0].phone,
            timestamp: 'هم‌اکنون',
            matchedPatient: INITIAL_PATIENTS[0]
          },
          onClose: () => {},
          onScheduleAppointment: () => {},
          onOpenPatientFile: () => {},
          onQuickAdmission: () => {}
        })
      ),
      mustContain: ['تماس ورودی مطب', INITIAL_PATIENTS[0].fullName]
    },
    {
      name: 'ClinicSessionLockOverlay',
      html: renderToStaticMarkup(
        React.createElement(ClinicSessionLockOverlay, {
          isLocked: true,
          users: INITIAL_USERS,
          onUnlock: () => ({ ok: true })
        })
      ),
      mustContain: ['dir="rtl"', 'پنل کلینیک مینادنتال قفل است', 'احراز هویت و بازگشایی پنل']
    },
    {
      name: 'DashboardView',
      html: renderToStaticMarkup(
        React.createElement(DashboardView, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          onNavigate: () => {},
          onOpenPalmerChart: () => {},
          onQuickAdmission: () => {},
          todayAppointmentsCount: INITIAL_APPOINTMENTS.length,
          activeSurgeriesCount: 2,
          readyLabOrdersCount: 1,
          dailyRevenue: 32_500_000
        })
      ),
      mustContain: [
        'dashboard-view',
        'dashboard-zone',
        'پذیرش و نوبت‌دهی',
        'مالی، چک صیادی و اقساط',
        'بیماران',
        'نوبت',
        'ممیزی و پیگیری',
        '۶ فاز قفل ✓'
      ]
    },
    {
      name: 'SettingsView',
      html: renderToStaticMarkup(
        React.createElement(SettingsView, {
          currentUser: manager
        })
      ),
      mustContain: ['تنظیمات', 'تعرفه‌ها']
    },
    {
      name: 'AiAssistantView',
      html: renderToStaticMarkup(React.createElement(AiAssistantView)),
      mustContain: ['هوش مصنوعی']
    },
    {
      name: 'MarketingCampaignsView',
      html: renderToStaticMarkup(
        React.createElement(MarketingCampaignsView, {
          patients: INITIAL_PATIENTS
        })
      ),
      mustContain: ['کمپین']
    },
    {
      name: 'InsuranceClaimsView',
      html: renderToStaticMarkup(
        React.createElement(InsuranceClaimsView, {
          patients: INITIAL_PATIENTS
        })
      ),
      mustContain: ['بیمه']
    },
    {
      name: 'SterilizationModuleView',
      html: renderToStaticMarkup(React.createElement(SterilizationModuleView)),
      mustContain: ['اتوکلاو']
    },
    {
      name: 'XRayModuleView',
      html: renderToStaticMarkup(
        React.createElement(XRayModuleView, {
          patients: INITIAL_PATIENTS
        })
      ),
      mustContain: ['ثبت گرافی', 'CBCT']
    },
    {
      name: 'ClinicalHudDrawer',
      html: renderToStaticMarkup(
        React.createElement(ClinicalHudDrawer, {
          isOpen: true,
          onClose: () => {},
          patient: INITIAL_PATIENTS[0],
          patients: INITIAL_PATIENTS,
          onSelectPatient: () => {},
          onOpenPatientFile: () => {},
          onOpenPalmerChart: () => {},
          onOpenPaymentModal: () => {}
        })
      ),
      mustContain: ['خلاصه وضعیت بالینی بیمار', INITIAL_PATIENTS[0].fullName]
    }
  ];

  for (const mod of renderedModules) {
    assert.ok(mod.html.length > 100, `${mod.name} must render substantive DOM`);
    assert.equal(mod.html.includes('NaN'), false, `${mod.name} rendered NaN`);
    assert.equal(mod.html.includes('sticky top-12'), false, `${mod.name} must not emit sticky top-12`);
    for (const token of mod.mustContain) {
      assert.ok(mod.html.includes(token), `${mod.name} SSR output must include "${token}"`);
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Core Clinical Modals Live SSR DOM & PWA RTL Manifest Integrity
  // ---------------------------------------------------------------------------
  const manifestJson = JSON.parse(
    fs.readFileSync(path.join(WORKSPACE_ROOT, 'public/manifest.json'), 'utf8')
  );
  assert.equal(manifestJson.dir, 'rtl', 'manifest.json must declare dir="rtl"');
  assert.equal(manifestJson.lang, 'fa', 'manifest.json must declare lang="fa"');
  assert.ok(Array.isArray(manifestJson.icons) && manifestJson.icons.length >= 3, 'manifest.json must declare PWA icons');

  const renderedModals: Array<{ name: string; html: string; mustContain: string[] }> = [
    {
      name: 'PatientFileModal',
      html: renderToStaticMarkup(
        React.createElement(PatientFileModal, {
          patient: INITIAL_PATIENTS[0],
          isOpen: true,
          onClose: () => {},
          onOpenPalmerChart: () => {},
          onAddCheck: () => {},
          onAddPayment: () => {},
          onAddLabOrder: () => {},
          currentUser: manager
        })
      ),
      mustContain: [INITIAL_PATIENTS[0].fullName, 'dir="rtl"', 'بستن پرونده']
    },
    {
      name: 'PalmerChartModal',
      html: renderToStaticMarkup(
        React.createElement(PalmerChartModal, {
          isOpen: true,
          onClose: () => {},
          patientName: INITIAL_PATIENTS[0].fullName,
          patient: INITIAL_PATIENTS[0],
          teethConditions: INITIAL_PATIENTS[0].teethConditions,
          onSaveTreatment: () => {}
        })
      ),
      mustContain: [INITIAL_PATIENTS[0].fullName, 'UR', 'UL', 'LR', 'LL']
    },
    {
      name: 'AddPaymentModal',
      html: renderToStaticMarkup(
        React.createElement(AddPaymentModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          onAddPayment: () => {}
        })
      ),
      mustContain: ['ثبت پرداخت بیمار', 'بستن ثبت پرداخت', 'dir="rtl"']
    },
    {
      name: 'AddCheckModal',
      html: renderToStaticMarkup(
        React.createElement(AddCheckModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          onAddCheck: () => {}
        })
      ),
      mustContain: ['ثبت چک صیادی', 'بستن ثبت چک صیادی', 'dir="rtl"']
    },
    {
      name: 'QuickAdmissionModal',
      html: renderToStaticMarkup(
        React.createElement(QuickAdmissionModal, {
          isOpen: true,
          onClose: () => {},
          onPatientAdmitted: () => {}
        })
      ),
      mustContain: ['پذیرش سریع بیمار', 'بستن پذیرش سریع', 'dir="rtl"']
    }
  ];

  for (const mod of renderedModals) {
    assert.ok(mod.html.length > 200, `${mod.name} must render substantive modal DOM`);
    assert.equal(mod.html.includes('NaN'), false, `${mod.name} rendered NaN`);
    assert.equal(mod.html.includes('animate-bounce'), false, `${mod.name} must not emit animate-bounce`);
    for (const token of mod.mustContain) {
      assert.ok(mod.html.includes(token), `${mod.name} SSR output must include "${token}"`);
    }
  }

  // ---------------------------------------------------------------------------
  // 13. Dark/High-Contrast CSS Parity & 12 Secondary/Diagnostic Modals Live SSR DOM
  // ---------------------------------------------------------------------------
  assert.ok(
    indexCss.includes('html.theme-dark input:not([type="checkbox"])'),
    'src/index.css must adapt form inputs in dark mode'
  );
  assert.ok(
    indexCss.includes('html.theme-high-contrast input:not([type="checkbox"])'),
    'src/index.css must adapt form inputs in high-contrast mode'
  );
  assert.ok(
    indexCss.includes('html.theme-dark .bg-emerald-50'),
    'src/index.css must adapt pastel banners in dark mode'
  );

  const secondaryModals: Array<{ name: string; html: string; mustContain: string[] }> = [
    {
      name: 'DoctorCommissionModal',
      html: renderToStaticMarkup(
        React.createElement(DoctorCommissionModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS
        })
      ),
      mustContain: ['دکتر مهدی امیری', 'سهم']
    },
    {
      name: 'InstallmentPlanModal',
      html: renderToStaticMarkup(
        React.createElement(InstallmentPlanModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          onSaveInstallmentPlan: () => {}
        })
      ),
      mustContain: ['اقساط', INITIAL_PATIENTS[0].fullName]
    },
    {
      name: 'ConsentSignatureModal',
      html: renderToStaticMarkup(
        React.createElement(ConsentSignatureModal, {
          isOpen: true,
          onClose: () => {},
          consentTitle: 'رضایت‌نامه جراحی ایمپلنت',
          consentDesc: 'توضیحات جراحی و مراقبت‌های پس از کاشت',
          patient: INITIAL_PATIENTS[0],
          onSaveSignature: () => {}
        })
      ),
      mustContain: ['رضایت‌نامه جراحی ایمپلنت', INITIAL_PATIENTS[0].fullName]
    },
    {
      name: 'TreatmentInvoiceModal',
      html: renderToStaticMarkup(
        React.createElement(TreatmentInvoiceModal, {
          isOpen: true,
          onClose: () => {},
          patient: INITIAL_PATIENTS[0]
        })
      ),
      mustContain: [INITIAL_PATIENTS[0].fullName, 'صورتحساب']
    },
    {
      name: 'PatientBookingPortalModal',
      html: renderToStaticMarkup(
        React.createElement(PatientBookingPortalModal, {
          isOpen: true,
          onClose: () => {}
        })
      ),
      mustContain: ['نوبت', 'دکتر مهدی امیری']
    },
    {
      name: 'AccessibilityControlsModal',
      html: renderToStaticMarkup(
        React.createElement(AccessibilityControlsModal, {
          isOpen: true,
          onClose: () => {}
        })
      ),
      mustContain: ['دسترسی‌پذیری و ارگونومی مطب', 'حالت']
    },
    {
      name: 'BackupModal',
      html: renderToStaticMarkup(
        React.createElement(BackupModal, {
          isOpen: true,
          onClose: () => {},
          clinicName: 'کلینیک تخصصی مینادنتال',
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          inventory: INITIAL_INVENTORY,
          users: INITIAL_USERS,
          platforms: INITIAL_PLATFORMS,
          isManager: true
        })
      ),
      mustContain: ['پشتیبان‌گیری ابری و لوکال', 'بستن پنجره پشتیبان‌گیری']
    },
    {
      name: 'RoleSwitcherModal',
      html: renderToStaticMarkup(
        React.createElement(RoleSwitcherModal, {
          isOpen: true,
          onClose: () => {},
          currentUser: manager,
          users: INITIAL_USERS,
          platforms: INITIAL_PLATFORMS,
          onSwitchUser: () => {},
          onAddPlatform: () => {}
        })
      ),
      mustContain: [manager.fullName, 'دسترسی']
    },
    {
      name: 'ServicesSheet',
      html: renderToStaticMarkup(
        React.createElement(ServicesSheet, {
          isOpen: true,
          onClose: () => {},
          onNavigate: () => {},
          lowStockCount: 2
        })
      ),
      mustContain: ['بیماران', 'ایمپلنت']
    },
    {
      name: 'GlobalCommandPalette',
      html: renderToStaticMarkup(
        React.createElement(GlobalCommandPalette, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          onSelectPatient: () => {},
          onOpenPalmerChart: () => {},
          onNavigate: () => {},
          onQuickAdmission: () => {},
          onOpenPaymentModal: () => {},
          onOpenClinicalHud: () => {},
          onOpenAccessibility: () => {}
        })
      ),
      mustContain: ['ماژول', 'عملیات بالینی']
    },
    {
      name: 'LiveSyncSimulatorModal',
      html: renderToStaticMarkup(
        React.createElement(LiveSyncSimulatorModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS
        })
      ),
      mustContain: ['بستن شبیه‌ساز همگام‌سازی', 'همگام‌سازی']
    },
    {
      name: 'SupabaseTestModal',
      html: renderToStaticMarkup(
        React.createElement(SupabaseTestModal, {
          isOpen: true,
          onClose: () => {}
        })
      ),
      mustContain: ['بستن پنجره تست سوپابیس', 'Supabase']
    }
  ];

  for (const mod of secondaryModals) {
    assert.ok(mod.html.length > 200, `${mod.name} must render substantive modal DOM`);
    assert.equal(mod.html.includes('NaN'), false, `${mod.name} rendered NaN`);
    assert.equal(mod.html.includes('animate-bounce'), false, `${mod.name} must not emit animate-bounce`);
    for (const token of mod.mustContain) {
      assert.ok(mod.html.includes(token), `${mod.name} SSR output must include "${token}"`);
    }
  }

  // ---------------------------------------------------------------------------
  // 14. Codebase-Wide Button Touch-Target Invariant & Remaining 13 Modals DOM
  // ---------------------------------------------------------------------------
  for (const filePath of collectTsxFiles(path.join(WORKSPACE_ROOT, 'src/components'))) {
    const content = fs.readFileSync(filePath, 'utf8');
    const rel = path.relative(WORKSPACE_ROOT, filePath);
    const hasUndersizedRoundBtn = /<button[\s\S]{0,300}?className="[^"]*\b(?:w-8 h-8 rounded-full|w-7\.5 h-7\.5)\b/.test(
      content
    );
    assert.equal(
      hasUndersizedRoundBtn,
      false,
      `${rel} must not contain undersized w-8 h-8 rounded-full or w-7.5 h-7.5 buttons (use min-w-[38px] min-h-[38px] rounded-[12px])`
    );
  }

  const patientWithLab = INITIAL_PATIENTS.find(p => p.labOrders && p.labOrders.length > 0)!;
  const sampleLabOrder = patientWithLab.labOrders![0];

  const remainingModals: Array<{ name: string; html: string; mustContain: string[] }> = [
    {
      name: 'AddLabOrderModal',
      html: renderToStaticMarkup(
        React.createElement(AddLabOrderModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          onAddOrder: () => {}
        })
      ),
      mustContain: ['ثبت سفارش لابراتوار', INITIAL_PATIENTS[0].fullName]
    },
    {
      name: 'DigitalLabPortalModal',
      html: renderToStaticMarkup(
        React.createElement(DigitalLabPortalModal, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS
        })
      ),
      mustContain: ['لابراتوار']
    },
    {
      name: 'InventoryBarcodeModal',
      html: renderToStaticMarkup(
        React.createElement(InventoryBarcodeModal, {
          isOpen: true,
          onClose: () => {},
          item: INITIAL_INVENTORY[0],
          onShowToast: () => {}
        })
      ),
      mustContain: [INITIAL_INVENTORY[0].name, 'چاپ']
    },
    {
      name: 'BatchCategoryModal',
      html: renderToStaticMarkup(
        React.createElement(BatchCategoryModal, {
          isOpen: true,
          onClose: () => {},
          selectedItems: [INITIAL_INVENTORY[0]],
          categories: ['همه', 'کامپوزیت و ترمیم', 'ایمپلنت'],
          onApplyCategory: () => {}
        })
      ),
      mustContain: ['دسته‌بندی']
    },
    {
      name: 'BatchStockModal',
      html: renderToStaticMarkup(
        React.createElement(BatchStockModal, {
          isOpen: true,
          onClose: () => {},
          selectedItems: [INITIAL_INVENTORY[0]],
          onApplyStockAdjustment: () => {}
        })
      ),
      mustContain: ['موجودی']
    },
    {
      name: 'InventoryQrScannerModal',
      html: renderToStaticMarkup(
        React.createElement(InventoryQrScannerModal, {
          isOpen: true,
          onClose: () => {},
          inventory: INITIAL_INVENTORY,
          onUpdateStock: () => {},
          onShowToast: () => {}
        })
      ),
      mustContain: ['اسکنر']
    },
    {
      name: 'LabPrescriptionModal',
      html: renderToStaticMarkup(
        React.createElement(LabPrescriptionModal, {
          isOpen: true,
          onClose: () => {},
          order: sampleLabOrder,
          patient: patientWithLab
        })
      ),
      mustContain: [sampleLabOrder.workType]
    },
    {
      name: 'OneHandedActionSheet',
      html: renderToStaticMarkup(
        React.createElement(OneHandedActionSheet, {
          isOpen: true,
          onClose: () => {},
          onQuickAdmission: () => {},
          onOpenAppointments: () => {},
          onOpenPaymentModal: () => {},
          onOpenClinicalHud: () => {},
          onOpenPalmerChart: () => {},
          onOpenLabOrders: () => {}
        })
      ),
      mustContain: ['منوی یک‌دستی شست']
    },
    {
      name: 'ProjectDownloadModal',
      html: renderToStaticMarkup(
        React.createElement(ProjectDownloadModal, {
          isOpen: true,
          onClose: () => {}
        })
      ),
      mustContain: ['سورس‌کد و بسته‌های نصبی مینادنتال', 'APK و IPA']
    },
    {
      name: 'SmsGatewaySettingsModal',
      html: renderToStaticMarkup(
        React.createElement(SmsGatewaySettingsModal, {
          isOpen: true,
          onClose: () => {}
        })
      ),
      mustContain: ['پیامک']
    },
    {
      name: 'SupplierPurchaseOrderModal',
      html: renderToStaticMarkup(
        React.createElement(SupplierPurchaseOrderModal, {
          isOpen: true,
          onClose: () => {},
          inventory: INITIAL_INVENTORY,
          onRestockReceived: () => {}
        })
      ),
      mustContain: ['سفارش']
    },
    {
      name: 'RealWorldClinicTestConsole',
      html: renderToStaticMarkup(
        React.createElement(RealWorldClinicTestConsole, {
          isOpen: true,
          onClose: () => {},
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          inventory: INITIAL_INVENTORY
        })
      ),
      mustContain: ['بستن کنسول تست واقعی', 'دکتر مهدی امیری']
    },
    {
      name: 'PhaseAuditSuiteModal',
      html: renderToStaticMarkup(
        React.createElement(PhaseAuditSuiteModal, {
          isOpen: true,
          onClose: () => {}
        })
      ),
      mustContain: ['مرکز آزمون و استانداردهای جهانی مینادنتال', 'ISO 3950']
    }
  ];

  for (const mod of remainingModals) {
    assert.ok(mod.html.length > 200, `${mod.name} must render substantive modal DOM`);
    assert.equal(mod.html.includes('NaN'), false, `${mod.name} rendered NaN`);
    assert.equal(mod.html.includes('animate-bounce'), false, `${mod.name} must not emit animate-bounce`);
    for (const token of mod.mustContain) {
      assert.ok(mod.html.includes(token), `${mod.name} SSR output must include "${token}"`);
    }
  }

  // ---------------------------------------------------------------------------
  // 15. Remaining 13 Clinical Widgets, Charts, HUDs, Tooltips & Vault A11y
  // ---------------------------------------------------------------------------
  const settingsSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/views/SettingsView.tsx'), 'utf8');
  assert.equal(
    /<button\s+onClick=\{\(\)\s*=>\s*copyToClipboard/.test(settingsSrc),
    false,
    'SettingsView copy buttons must specify type="button" and aria-label'
  );

  const widgetChecks: Array<{ name: string; html: string; mustContain: string[] }> = [
    {
      name: 'ModuleErrorBoundary',
      html: renderToStaticMarkup(
        React.createElement(ModuleErrorBoundary, {
          moduleName: 'مالی',
          onResetToHome: () => {},
          children: React.createElement('div', null, 'ماژول ایزوله فعال')
        })
      ),
      mustContain: ['ماژول ایزوله فعال']
    },
    {
      name: 'AnimatedGeminiBackground',
      html: renderToStaticMarkup(React.createElement(AnimatedGeminiBackground, { activeView: 'home' })),
      mustContain: ['gemini-blob-1']
    },
    {
      name: 'SyncNotificationToast',
      html: renderToStaticMarkup(
        React.createElement(SyncNotificationToast, {
          event: {
            id: 'sync-ssr-1',
            type: 'PAYMENT_COLLECTED',
            timestamp: '۱۲:۰۰',
            performedBy: 'monshi',
            role: 'secretary',
            platform: 'پذیرش / منشی',
            title: 'پرداخت با POS ثبت شد',
            description: 'تراکنش شاپرک با موفقیت ثبت گردید'
          },
          onDismiss: () => {}
        })
      ),
      mustContain: ['پرداخت با POS ثبت شد']
    },
    {
      name: 'ClinicUrgentAlarmsBanner',
      html: renderToStaticMarkup(
        React.createElement(ClinicUrgentAlarmsBanner, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          onOpenPatientFile: () => {},
          onNavigate: () => {}
        })
      ),
      mustContain: ['هشدار']
    },
    {
      name: 'FloatingNotificationBadge',
      html: renderToStaticMarkup(
        React.createElement(FloatingNotificationBadge, {
          unreadCount: 4,
          onClick: () => {}
        })
      ),
      mustContain: ['۴']
    },
    {
      name: 'FinancialPerformanceChart',
      html: renderToStaticMarkup(React.createElement(FinancialPerformanceChart, { patients: INITIAL_PATIENTS })),
      mustContain: ['روند']
    },
    {
      name: 'FinancialWeeklyAnalytics',
      html: renderToStaticMarkup(React.createElement(FinancialWeeklyAnalytics, { patients: INITIAL_PATIENTS })),
      mustContain: ['هفتگی']
    },
    {
      name: 'LabPipelineFunnelWidget',
      html: renderToStaticMarkup(
        React.createElement(LabPipelineFunnelWidget, {
          patients: INITIAL_PATIENTS,
          onNavigate: () => {}
        })
      ),
      mustContain: ['لابراتوار']
    },
    {
      name: 'LabOrderStatusVisualizer',
      html: renderToStaticMarkup(
        React.createElement(LabOrderStatusVisualizer, {
          orders: patientWithLab.labOrders || [],
          onUpdateStatus: () => {}
        })
      ),
      mustContain: [sampleLabOrder.workType]
    },
    {
      name: 'ArmedActionButton',
      html: renderToStaticMarkup(
        React.createElement(ArmedActionButton, {
          onConfirm: () => {},
          label: 'ثبت قطعی درمان'
        })
      ),
      mustContain: ['ثبت قطعی درمان']
    },
    {
      name: 'DashboardPatientSearch',
      html: renderToStaticMarkup(
        React.createElement(DashboardPatientSearch, {
          patients: INITIAL_PATIENTS,
          onSelectPatient: () => {}
        })
      ),
      mustContain: ['جستجو']
    },
    {
      name: 'DashboardEmptyState',
      html: renderToStaticMarkup(React.createElement(DashboardEmptyState, { onResetLayout: () => {} })),
      mustContain: ['هیچ کاشی در داشبورد فعال نیست']
    },
    {
      name: 'FramerTooltip',
      html: renderToStaticMarkup(
        React.createElement(FramerTooltip, {
          content: 'راهنمای سریع',
          children: React.createElement('span', null, 'هدف')
        })
      ),
      mustContain: ['هدف']
    }
  ];

  for (const w of widgetChecks) {
    assert.ok(w.html.length > 10, `${w.name} must render substantive DOM`);
    assert.equal(w.html.includes('NaN'), false, `${w.name} rendered NaN`);
    assert.equal(w.html.includes('animate-bounce'), false, `${w.name} must not emit animate-bounce`);
    for (const token of w.mustContain) {
      assert.ok(w.html.includes(token), `${w.name} SSR output must include "${token}"`);
    }
  }

  // ---------------------------------------------------------------------------
  // 16. PWA Service Worker, IndexedDB Persistence-Layer RBAC & App Button Audit
  // ---------------------------------------------------------------------------
  const swSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'public/sw.js'), 'utf8');
  assert.ok(swSrc.includes("'/logo.png'"), 'public/sw.js CORE_ASSETS must precache /logo.png');
  assert.ok(
    swSrc.includes("url.protocol !== 'http:' && url.protocol !== 'https:'"),
    'public/sw.js fetch handler must ignore non-HTTP(S) schemes'
  );
  assert.ok(
    swSrc.includes("cache: 'no-store'"),
    'public/sw.js must fetch version.json and Supabase calls with no-store'
  );
  assert.ok(
    swSrc.includes("networkResponse.type === 'basic' || networkResponse.type === 'cors'"),
    'public/sw.js must validate networkResponse.type before caching'
  );

  // Persistence-layer deletion RBAC: secretary, doctor, and null actor must be rejected
  assert.equal(await indexedDbService.deletePatientById('pat-block-test', secretary), false, 'IndexedDB must block secretary patient delete');
  assert.equal(await indexedDbService.deletePatientById('pat-block-test', doctor), false, 'IndexedDB must block doctor patient delete');
  assert.equal(await indexedDbService.deletePatientById('pat-block-test', null), false, 'IndexedDB must block null-actor patient delete');
  assert.equal(await indexedDbService.deleteAppointmentById('apt-block-test', secretary), false, 'IndexedDB must block secretary appointment delete');
  assert.equal(await indexedDbService.deleteAppointmentById('apt-block-test', doctor), false, 'IndexedDB must block doctor appointment delete');
  assert.equal(await indexedDbService.deleteAppointmentById('apt-block-test', null), false, 'IndexedDB must block null-actor appointment delete');

  const appSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/App.tsx'), 'utf8');
  assert.ok(
    appSrc.includes('indexedDbService.deleteAppointmentById(id, currentUser)'),
    'App.tsx must pass currentUser to indexedDbService.deleteAppointmentById'
  );
  assert.ok(
    appSrc.includes('indexedDbService.deletePatientById(patientId, currentUser)'),
    'App.tsx must pass currentUser to indexedDbService.deletePatientById'
  );
  const appButtons = appSrc.match(/<button[\s\S]*?>/g) || [];
  assert.ok(appButtons.length >= 4, 'App.tsx should render interactive buttons');
  for (const btnTag of appButtons) {
    assert.ok(/\btype=(?:"button"|"submit"|"reset")/.test(btnTag), `Every <button> in App.tsx must declare an explicit type: ${btnTag.slice(0, 80)}`);
  }

  const qrSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/InventoryQrScannerModal.tsx'), 'utf8');
  assert.equal(/w-9 h-9 rounded-full/.test(qrSrc), false, 'InventoryQrScannerModal must use >=38px squircle buttons instead of w-9 h-9 rounded-full');

  // ---------------------------------------------------------------------------
  // 17. Codebase-Wide WAI-ARIA Dialogs, Escape-Key Hook, & Form Button Safety
  // ---------------------------------------------------------------------------
  const dialogFiles = collectTsxFiles(path.join(WORKSPACE_ROOT, 'src/components')).filter((fp) =>
    /(?:Modal|Sheet|Drawer)\.tsx$/.test(path.basename(fp))
  );
  assert.ok(dialogFiles.length >= 28, `Expected >=28 dialog files, found ${dialogFiles.length}`);
  for (const dialogPath of dialogFiles) {
    const dialogSrc = fs.readFileSync(dialogPath, 'utf8');
    const rel = path.relative(WORKSPACE_ROOT, dialogPath);
    assert.ok(dialogSrc.includes('role="dialog"'), `${rel} must declare role="dialog"`);
    assert.ok(dialogSrc.includes('aria-modal="true"'), `${rel} must declare aria-modal="true"`);
    assert.ok(dialogSrc.includes('useEscapeKey('), `${rel} must wire Escape-key dismissal via useEscapeKey`);
  }

  const servicesSheetSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/ServicesSheet.tsx'), 'utf8');
  assert.equal(/w-9 h-9 rounded-full/.test(servicesSheetSrc), false, 'ServicesSheet header buttons must use >=38px squircle targets');

  const extractButtonOpenTags = (text: string): string[] => {
    const tags: string[] = [];
    let i = 0;
    while (true) {
      const idx = text.indexOf('<button', i);
      if (idx === -1) break;
      const after = text[idx + 7];
      if (after && !/\s|>|\//.test(after)) {
        i = idx + 1;
        continue;
      }
      let depth = 0;
      let inStr: string | null = null;
      let j = idx + 1;
      while (j < text.length) {
        const ch = text[j];
        if (inStr) {
          if (ch === '\\') {
            j += 2;
            continue;
          }
          if (ch === inStr) inStr = null;
        } else {
          if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
          else if (ch === '{') depth++;
          else if (ch === '}') depth = Math.max(0, depth - 1);
          else if (ch === '>' && depth === 0) {
            tags.push(text.slice(idx, j + 1));
            break;
          }
        }
        j++;
      }
      i = j + 1;
    }
    return tags;
  };

  const extractOpenTagsByName = (text: string, tagName: string): string[] => {
    const tags: string[] = [];
    let i = 0;
    const needle = `<${tagName}`;
    while (true) {
      const idx = text.indexOf(needle, i);
      if (idx === -1) break;
      const after = text[idx + needle.length];
      if (after && !/\s|>|\//.test(after)) {
        i = idx + 1;
        continue;
      }
      let depth = 0;
      let inStr: string | null = null;
      let j = idx + 1;
      while (j < text.length) {
        const ch = text[j];
        if (inStr) {
          if (ch === '\\') {
            j += 2;
            continue;
          }
          if (ch === inStr) inStr = null;
        } else {
          if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
          else if (ch === '{') depth++;
          else if (ch === '}') depth = Math.max(0, depth - 1);
          else if (ch === '>' && depth === 0) {
            tags.push(text.slice(idx, j + 1));
            break;
          }
        }
        j++;
      }
      i = j + 1;
    }
    return tags;
  };

  for (const compPath of collectTsxFiles(path.join(WORKSPACE_ROOT, 'src'))) {
    const compSrc = fs.readFileSync(compPath, 'utf8');
    const rel = path.relative(WORKSPACE_ROOT, compPath);
    for (const btnTag of extractButtonOpenTags(compSrc)) {
      assert.ok(
        /\btype=(?:"button"|"submit"|"reset")/.test(btnTag),
        `${rel} contains a <button> without explicit type="button|submit|reset": ${btnTag.slice(0, 80)}`
      );
      assert.equal(
        /\bw-9 h-9 rounded-full\b/.test(btnTag),
        false,
        `${rel} must not use w-9 h-9 rounded-full on interactive <button>`
      );
    }
    for (const selTag of extractOpenTagsByName(compSrc, 'select')) {
      assert.ok(
        /\baria-label=|\btitle=/.test(selTag),
        `${rel} contains a <select> without aria-label or title: ${selTag.slice(0, 80)}`
      );
    }
    for (const txtTag of extractOpenTagsByName(compSrc, 'textarea')) {
      assert.ok(
        /\baria-label=|\btitle=|\bplaceholder=/.test(txtTag),
        `${rel} contains a <textarea> without aria-label, title, or placeholder: ${txtTag.slice(0, 80)}`
      );
    }
    for (const inpTag of extractOpenTagsByName(compSrc, 'input')) {
      if (/\btype=(?:"hidden"|"checkbox"|"radio"|"file")/.test(inpTag)) continue;
      assert.ok(
        /\baria-label=|\btitle=|\bplaceholder=/.test(inpTag),
        `${rel} contains an <input> without aria-label, title, or placeholder: ${inpTag.slice(0, 80)}`
      );
    }
  }

  // Verify App shell WCAG skip-to-main navigation, live announcer, GlobalCommandPalette, PWA deep-link & @media print
  const dialogA11ySrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/hooks/useDialogA11y.ts'), 'utf8');
  assert.ok(dialogA11ySrc.includes("document.body.style.overflow = 'hidden'"), 'useDialogA11y must lock background scroll when open');
  assert.ok(dialogA11ySrc.includes('previousActiveElement.focus'), 'useDialogA11y must restore focus on dialog close');
  assert.ok(appSrc.includes('href="#main-content"'), 'App.tsx must provide a skip-to-main link');
  assert.ok(appSrc.includes('id="main-content"'), 'App.tsx <main> must declare id="main-content"');
  assert.ok(appSrc.includes('aria-live="polite"'), 'App.tsx must provide a polite screen-reader status region');
  assert.ok(appSrc.includes('<GlobalCommandPalette'), 'App.tsx must mount GlobalCommandPalette');
  assert.ok(appSrc.includes('new URLSearchParams(window.location.search)'), 'App.tsx must support PWA shortcut ?view= deep-linking');
  assert.ok(appSrc.includes("addEventListener('popstate'"), 'App.tsx must handle hardware Back button popstate navigation');
  assert.ok(appSrc.includes('meta[name="theme-color"]'), 'App.tsx must dynamically sync module theme-color');
  assert.ok(indexCss.includes('@media print'), 'src/index.css must define @media print clinical print rules');
  assert.ok(indexCss.includes('.skip-to-main'), 'src/index.css must style .skip-to-main focus banner');
  assert.ok(
    indexCss.includes('html.theme-dark .module-chip-item[aria-selected="false"]'),
    'src/index.css must style inactive .module-chip-item in dark mode'
  );

  for (const vf of viewFiles) {
    if (vf === 'DashboardView.tsx') continue;
    const vfSrc = fs.readFileSync(path.join(viewsDir, vf), 'utf8');
    assert.ok(vfSrc.includes('role="tablist"'), `${vf} horizontal chip bar must declare role="tablist"`);
    assert.ok(vfSrc.includes('role="tab"'), `${vf} horizontal chip buttons must declare role="tab"`);
    assert.ok(vfSrc.includes('aria-selected='), `${vf} horizontal chip buttons must declare aria-selected`);
  }

  // ---------------------------------------------------------------------------
  // 18. Clipboard Helper Isolation, PWA Manifest Shortcuts, Lockscreen & In-View Dialogs
  // ---------------------------------------------------------------------------
  const collectSrcCodeFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectSrcCodeFiles(full));
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
    }
    return out;
  };
  for (const srcFile of collectSrcCodeFiles(path.join(WORKSPACE_ROOT, 'src'))) {
    const rel = path.relative(WORKSPACE_ROOT, srcFile).replace(/\\/g, '/');
    if (rel === 'src/utils/clipboard.ts' || rel.startsWith('src/tests/')) continue;
    const srcText = fs.readFileSync(srcFile, 'utf8');
    assert.equal(
      srcText.includes('navigator.clipboard'),
      false,
      `${rel} must delegate clipboard writes to copyTextSafely() instead of raw navigator.clipboard`
    );
  }
  assert.equal(
    await copyTextSafely('ssr-safe-check'),
    false,
    'copyTextSafely must return false safely in non-DOM SSR environments'
  );

  const pwaManifestData = JSON.parse(
    fs.readFileSync(path.join(WORKSPACE_ROOT, 'public/manifest.json'), 'utf8')
  ) as { categories?: string[]; shortcuts?: Array<{ name?: string; url?: string; icons?: unknown[] }> };
  assert.ok(
    Array.isArray(pwaManifestData.categories) && pwaManifestData.categories.includes('medical'),
    'public/manifest.json must declare medical category'
  );
  assert.ok(
    Array.isArray(pwaManifestData.shortcuts) && pwaManifestData.shortcuts.length >= 3,
    'public/manifest.json must define >=3 PWA shortcuts'
  );
  for (const sc of pwaManifestData.shortcuts) {
    assert.ok(Boolean(sc.name && sc.url && Array.isArray(sc.icons) && sc.icons.length > 0), 'Every PWA shortcut requires name, url, and icons');
  }

  const lockOverlaySrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, 'src/components/ClinicSessionLockOverlay.tsx'),
    'utf8'
  );
  assert.ok(lockOverlaySrc.includes('role="dialog"'), 'ClinicSessionLockOverlay must declare role="dialog"');
  assert.ok(lockOverlaySrc.includes('aria-modal="true"'), 'ClinicSessionLockOverlay must declare aria-modal="true"');
  assert.equal(
    lockOverlaySrc.includes('useEscapeKey('),
    false,
    'ClinicSessionLockOverlay must NOT allow Escape-key bypass of lockscreen'
  );

  const expectedViewDialogCounts: Array<[string, number]> = [
    ['DashboardView.tsx', 2],
    ['SettingsView.tsx', 1],
    ['AppointmentsView.tsx', 3],
    ['LabModuleView.tsx', 2],
    ['InventoryView.tsx', 2],
    ['ImplantModuleView.tsx', 3],
    ['FinancialView.tsx', 5],
    ['PatientsListView.tsx', 6]
  ];
  for (const [viewFile, expectedCount] of expectedViewDialogCounts) {
    const viewSrc = fs.readFileSync(path.join(viewsDir, viewFile), 'utf8');
    assert.equal(
      countOccurrences(viewSrc, 'fixed inset-0'),
      expectedCount,
      `${viewFile} expected ${expectedCount} fixed inset-0 modal overlays`
    );
    assert.equal(
      countOccurrences(viewSrc, 'role="dialog"'),
      expectedCount,
      `${viewFile} every in-view modal must declare role="dialog"`
    );
    assert.equal(
      countOccurrences(viewSrc, 'aria-modal="true"'),
      expectedCount,
      `${viewFile} every in-view modal must declare aria-modal="true"`
    );
    assert.ok(viewSrc.includes('useEscapeKey('), `${viewFile} must wire useEscapeKey for in-view modals`);
  }

  // ---------------------------------------------------------------------------
  // 19. RealWorldClinicTestConsole Operational Stress Test (1,000 Patients · 500 Lab · 500k Tx)
  // ---------------------------------------------------------------------------
  const stressReport = await runClinicOperationalStressCycle();
  assert.equal(stressReport.status, 'PASSED', 'Operational stress test cycle must PASS reconciliation');
  assert.equal(stressReport.patientsPhase.simulatedCount, STRESS_TARGET_PATIENTS, 'Must simulate 1,000 patient files');
  assert.equal(stressReport.patientsPhase.modulus11ValidatedCount, 1000, 'All 1,000 simulated national codes must pass Modulus-11');
  assert.equal(stressReport.patientsPhase.indexLookupVerifiedCount, 1000, 'All 1,000 patients must resolve in O(1) index');
  assert.equal(stressReport.patientsPhase.portfolioBalanceDeltaToman, 0, '1,000 patient portfolio ledger balance delta must be 0');
  assert.equal(stressReport.labPhase.concurrentOrdersCount, STRESS_TARGET_LAB_ORDERS, 'Must simulate 500 concurrent lab orders');
  assert.equal(stressReport.labPhase.activeInFlightCount, 400, 'Expected 400 active in-flight lab orders across 4 pre-delivery stages');
  assert.equal(stressReport.financialPhase.transactionsCount, STRESS_TARGET_FINANCIAL_TX, 'Must execute 500,000 financial transactions');
  assert.equal(stressReport.financialPhase.reconciliationDelta, 0, '500,000 transaction cycle reconciliation delta must be 0');
  assert.equal(stressReport.financialPhase.microUnitDriftDelta, 0, '500,000 transaction cycle must have zero IEEE-754 drift');
  assert.ok(stressReport.integritySeal.length >= 32, 'Stress test report must emit SHA-256 integrity seal');

  const stress5kReport = await runRealWorld5k1k50kStressSuite();
  assert.equal(stress5kReport.status, 'PASSED', '5,000 patients / 1,000 lab / 50,000 tx stress test must PASS');
  assert.equal(stress5kReport.patientsPhase.simulatedCount, REAL_WORLD_STRESS_PATIENTS, 'Must simulate 5,000 concurrent patient files');
  assert.equal(stress5kReport.patientsPhase.modulus11ValidatedCount, 5000, 'All 5,000 national codes must pass Modulus-11');
  assert.equal(stress5kReport.patientsPhase.indexLookupVerifiedCount, 5000, 'All 5,000 patients must resolve in O(1) index');
  assert.equal(stress5kReport.labPhase.concurrentOrdersCount, REAL_WORLD_STRESS_LAB_ORDERS, 'Must simulate 1,000 concurrent lab orders');
  assert.equal(stress5kReport.financialPhase.transactionsCount, REAL_WORLD_STRESS_FINANCIAL_TX, 'Must execute 50,000 financial transactions');
  assert.equal(stress5kReport.financialPhase.reconciliationDelta, 0, '50,000 financial transaction cycle reconciliation delta must be 0');

  const delRec = auditTracker.recordPatientDeletion({
    patientId: 'pat-test-del',
    patientName: 'بیمار تست حذف ممیزی',
    fileNumber: 'D-9901'
  });
  const costRec = auditTracker.recordTreatmentCostEdit({
    patientId: 'pat-test-cost',
    patientName: 'بیمار تست ویرایش هزینه',
    fileNumber: 'D-9902',
    treatmentTitle: 'عصب‌کشی UR_6',
    previousCostToman: 4200000,
    newCostToman: 3800000
  });
  const refRec = auditTracker.recordPaymentRefund({
    patientId: 'pat-test-ref',
    patientName: 'بیمار تست عودت وجه',
    fileNumber: 'D-9903',
    refundAmountToman: 1200000
  });
  assert.ok(delRec.auditId.startsWith('MD-SENS-DEL-'), 'Patient deletion must emit unique MD-SENS-DEL Audit ID');
  assert.ok(costRec.auditId.startsWith('MD-SENS-CST-'), 'Treatment cost edit must emit unique MD-SENS-CST Audit ID');
  assert.ok(refRec.auditId.startsWith('MD-SENS-RFD-'), 'Payment refund must emit unique MD-SENS-RFD Audit ID');
  assert.ok(auditTracker.getSensitiveTransactions().length >= 6, 'Sensitive transactions must be stored in AuditTracker');
  assert.ok(auditTracker.getStressTestReports().some(r => r.simulatedPatients === 5000 && r.concurrentLabOrders === 1000 && r.financialTransactions === 50000), '5000/1000/50000 stress test result must be stored in AuditTracker');

  // ---------------------------------------------------------------------------
  // 20. Locked Viewport, Horizontal Overflow Prevention & 2-Column Q-Bank Grid Audit
  // ---------------------------------------------------------------------------
  assert.ok(
    indexCss.includes('max-width: 100vw') && indexCss.includes('overscroll-behavior-x: none'),
    'src/index.css must lock html/body/#root max-width: 100vw and overscroll-behavior-x: none'
  );
  assert.ok(
    indexCss.includes('main#main-content') && indexCss.includes('min-width: 0'),
    'src/index.css must enforce min-width: 0 and overflow-x: hidden on main#main-content'
  );
  assert.ok(
    indexCss.includes('repeat(2, minmax(0, 1fr))'),
    'src/index.css .dashboard-view .grid must enforce 2-per-row Q-Bank card layout'
  );
  assert.ok(
    indexCss.includes('repeat(auto-fill, minmax(280px, 1fr))') &&
      indexCss.includes('min-width: 48px;') &&
      indexCss.includes('padding: 12px 14px;'),
    'src/index.css .dashboard-view .grid .tile must enforce repeat(auto-fill, minmax(280px, 1fr)) and >=48px touch area with explicit padding'
  );

  assert.ok(
    appSrc.includes('id="main-content"') && appSrc.includes('w-full max-w-full min-w-0 overflow-x-hidden flex-1'),
    'src/App.tsx main#main-content must enforce w-full max-w-full min-w-0 overflow-x-hidden flex-1'
  );

  const chipThemesSource = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/utils/chipThemes.ts'), 'utf8');
  assert.ok(
    chipThemesSource.includes('w-full max-w-full min-w-0 overflow-hidden'),
    'src/utils/chipThemes.ts getModuleHeaderCardClasses must enforce w-full max-w-full min-w-0 overflow-hidden'
  );

  for (const vf of viewFiles) {
    const vfSrc = fs.readFileSync(path.join(viewsDir, vf), 'utf8');
    assert.ok(
      vfSrc.includes('w-full max-w-full min-w-0 overflow-x-hidden'),
      `${vf} root container must enforce w-full max-w-full min-w-0 overflow-x-hidden to prevent bilateral horizontal overflow`
    );
  }
  const dashSrc = fs.readFileSync(path.join(viewsDir, 'DashboardView.tsx'), 'utf8');
  assert.ok(
    dashSrc.includes('grid-cols-2'),
    'DashboardView.tsx must use 2-per-row grid-cols-2 Q-Bank card layout'
  );

  assert.equal(
    INDUSTRIAL_STANDARDIZATION_PHASES.length,
    6,
    'Must define all 6 locked industrial standardization phases (PHASE-01 to PHASE-06)'
  );
  assert.equal(
    MASTER_SUPER_AUDIT_TRACKING_ID,
    'MD-AUD-1405-LOCKED',
    'Master super-audit tracking ID must be MD-AUD-1405-LOCKED'
  );
  for (let i = 0; i < INDUSTRIAL_STANDARDIZATION_PHASES.length; i++) {
    const phase = INDUSTRIAL_STANDARDIZATION_PHASES[i];
    assert.equal(phase.phaseNumber, i + 1, `Phase index ${i} must have phaseNumber ${i + 1}`);
    assert.equal(phase.trackingId, `MD-AUD-1405-P0${i + 1}`, `Phase ${i + 1} trackingId must be MD-AUD-1405-P0${i + 1}`);
    assert.equal(phase.completionPercent, 100, `Phase ${phase.trackingId} must be 100% completed`);
    assert.equal(phase.status, 'LOCKED_VERIFIED', `Phase ${phase.trackingId} must be LOCKED_VERIFIED`);
    assert.equal(phase.sha256Seal.length, 64, `Phase ${phase.trackingId} must have a 64-hex SHA-256 seal`);
    assert.ok(Array.isArray(phase.subTrackingIds) && phase.subTrackingIds.length >= 4, `Phase ${phase.trackingId} must define >= 4 subTrackingIds`);
  }

  const globalAuditModalSrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, 'src/components/GlobalAuditTrackerModal.tsx'),
    'utf8'
  );
  assert.ok(
    globalAuditModalSrc.includes('phases_roadmap') && globalAuditModalSrc.includes('INDUSTRIAL_STANDARDIZATION_PHASES'),
    'GlobalAuditTrackerModal.tsx must expose the 6-Phase Industrial Standardization Roadmap tab'
  );

  const heroPhaseAuditHtml = renderToStaticMarkup(
    React.createElement(ClinicHeroCard, {
      onQuickAdmission: () => {},
      onOpenPalmerChart: () => {},
      onOpenAppointments: () => {}
    })
  );
  assert.ok(
    !heroPhaseAuditHtml.includes('فوق ممیزی ۶ فاز'),
    'ClinicHeroCard SSR must remain 100% pure clinical UI without audit clutter'
  );
  assert.ok(
    dashSrc.includes('ممیزی و پیگیری') && dashSrc.includes('۶ فاز قفل ✓') && dashSrc.includes("case 'audit_tracker':"),
    'DashboardView must house the 6-Phase Audit inside the Q-Bank FolderCard (ممیزی و پیگیری)'
  );

  const phaseAuditModalSrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, 'src/components/PhaseAuditSuiteModal.tsx'),
    'utf8'
  );
  assert.ok(
    phaseAuditModalSrc.includes('audit_report_table') &&
      phaseAuditModalSrc.includes('Audit ID') &&
      phaseAuditModalSrc.includes("'Done'") &&
      phaseAuditModalSrc.includes("'Pending'"),
    'PhaseAuditSuiteModal.tsx must expose the Final Audit ID Report Table with Done/Pending statuses'
  );

  const cssRulesSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/index.css'), 'utf8');
  assert.ok(
    cssRulesSrc.includes('grid-auto-rows: minmax(min-content, max-content)') &&
      cssRulesSrc.includes('tile-hover-depth') &&
      cssRulesSrc.includes('.dashboard-view .grid .tile:hover'),
    'src/index.css must define grid-auto-rows: minmax(min-content, max-content) and tile hover depth animation'
  );

  // ---------------------------------------------------------------------------
  // 21. Global Release Super-Audit: VitePWA, Maskable Safe-Zone, Live Alerts,
  //     Date-Scoped Appointment Collisions, Galaxy Note 8 & Latency Benchmarks
  // ---------------------------------------------------------------------------
  const viteConfigSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'vite.config.ts'), 'utf8');
  assert.ok(viteConfigSrc.includes("VitePWA("), 'vite.config.ts must register VitePWA plugin');
  assert.ok(viteConfigSrc.includes("registerType: 'autoUpdate'"), 'VitePWA must use registerType: autoUpdate');
  assert.ok(viteConfigSrc.includes('enabled: true'), 'VitePWA devOptions.enabled must be true');

  const tsconfigJson = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'tsconfig.json'), 'utf8'));
  assert.ok(
    Array.isArray(tsconfigJson.compilerOptions?.types) &&
      tsconfigJson.compilerOptions.types.includes('vite-plugin-pwa/client'),
    'tsconfig.json must declare vite-plugin-pwa/client types'
  );

  const mainTsxSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(
    mainTsxSrc.includes("from 'virtual:pwa-register'") && mainTsxSrc.includes('immediate: true'),
    'src/main.tsx must register service worker immediately via virtual:pwa-register'
  );

  const manifestFull = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'public/manifest.json'), 'utf8'));
  assert.ok(
    manifestFull.id === '/' && manifestFull.start_url === '/' && manifestFull.scope === '/' && manifestFull.display === 'standalone',
    'public/manifest.json must satisfy core installability fields'
  );
  assert.ok(
    manifestFull.short_name && manifestFull.short_name.length <= 12,
    'manifest short_name must stay <= 12 chars'
  );
  const manifestIcons: Array<{ src: string; sizes: string; purpose?: string }> = manifestFull.icons || [];
  assert.ok(
    manifestIcons.some(ic => ic.src === '/pwa-192x192.png' && ic.purpose === 'any') &&
      manifestIcons.some(ic => ic.src === '/pwa-512x512.png' && ic.purpose === 'any') &&
      manifestIcons.some(ic => ic.src === '/pwa-maskable-512x512.png' && ic.purpose === 'maskable'),
    'manifest icons must separate any and maskable purposes with dedicated PNG assets'
  );
  for (const iconAsset of ['public/pwa-192x192.png', 'public/pwa-512x512.png', 'public/pwa-maskable-512x512.png', 'public/apple-touch-icon.png']) {
    assert.ok(fs.existsSync(path.join(WORKSPACE_ROOT, iconAsset)), `Missing required PWA icon asset: ${iconAsset}`);
  }

  const headerSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/AppHeader.tsx'), 'utf8');
  assert.ok(headerSrc.includes('<PWAInstallButton'), 'AppHeader.tsx must mount PWAInstallButton');
  assert.ok(appSrc.includes('<OfflineIndicator'), 'App.tsx must mount OfflineIndicator');
  assert.ok(renderToStaticMarkup(React.createElement(OfflineIndicator)) !== undefined, 'OfflineIndicator SSR must execute safely');
  assert.ok(renderToStaticMarkup(React.createElement(PWAInstallButton)) !== undefined, 'PWAInstallButton SSR must execute safely');

  const versionJson = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'public/version.json'), 'utf8'));
  const otaRelease = otaUpdateService.getReleaseInfo();
  assert.equal(otaRelease.version, versionJson.version, 'otaUpdateService INITIAL_RELEASE must stay synced with public/version.json');
  assert.ok(
    otaUpdateService.getFleetNodes().some(n => n.deviceName.includes('Galaxy Note 8') || n.id === 'node-note8-clinic'),
    'OTA Fleet must monitor Samsung Galaxy Note 8 (SM-N950F)'
  );
  const compat = otaUpdateService.getPlatformCompatibilityProfile();
  assert.ok(compat.targets.length === 4 && compat.targets.every(t => t.status === 'READY'), 'All 4 platform targets must report READY');

  // Functional Verification: Live Clinical Notification Engine across appointments, checks, installments, labs, implants
  const liveNotifications = buildLiveClinicalNotifications(INITIAL_PATIENTS, INITIAL_APPOINTMENTS, new Set(), otaRelease.version);
  assert.ok(
    liveNotifications.some(n => n.id.startsWith('live-apt-')),
    'buildLiveClinicalNotifications must surface active appointments'
  );
  assert.ok(
    liveNotifications.some(n => n.category === 'financial') &&
      liveNotifications.some(n => n.category === 'lab') &&
      liveNotifications.some(n => n.category === 'implant') &&
      liveNotifications.some(n => n.category === 'sync'),
    'buildLiveClinicalNotifications must aggregate financial, lab, implant, and OTA sync alerts dynamically'
  );
  const allReadIds = new Set(liveNotifications.map(n => n.id));
  const readNotifications = buildLiveClinicalNotifications(INITIAL_PATIENTS, INITIAL_APPOINTMENTS, allReadIds, otaRelease.version);
  assert.equal(readNotifications.filter(n => !n.isRead).length, 0, 'Persisted read IDs must clear unread badge count cleanly');

  const notifDrawerSsr = renderToStaticMarkup(
    React.createElement(NotificationDrawer, {
      isOpen: true,
      onClose: () => {},
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS
    })
  );
  assert.ok(notifDrawerSsr.includes('اعلانات و یادآوری‌ها'), 'Open NotificationDrawer SSR must render live header');

  // Functional Verification: Jalali Android 9 ICU Leak Protection & Normalized Persian Date Matching
  const jalaliSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/utils/jalali.ts'), 'utf8');
  assert.ok(
    jalaliSrc.includes('year < 1300 ||') && jalaliSrc.includes('year > 1500'),
    'src/utils/jalali.ts must guard against Android 9 Galaxy Note 8 Gregorian Intl leakage'
  );
  const nowParts = getPersianDateParts(new Date('2026-03-21T12:00:00Z'));
  assert.equal(nowParts.year, 1405, 'Farvardin 1405 conversion must remain exact');
  assert.equal(isSamePersianDate('۱۴۰۵/۱/۵', '1405/01/05'), true, 'isSamePersianDate must normalize Persian/English digits and leading zeros');
  assert.equal(isSamePersianDate('1405/01/05', '1405/01/06'), false, 'isSamePersianDate must distinguish different days');

  // Date-scoped collision guard in AppointmentsView.tsx & mobile FolderCard ergonomics
  const aptViewSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/views/AppointmentsView.tsx'), 'utf8');
  assert.ok(
    countOccurrences(aptViewSrc, 'isSamePersianDate(') >= 4,
    'AppointmentsView.tsx must scope create, drag-drop, quick-move, and edit collision checks by exact Jalali date'
  );
  const folderCardSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/FolderCard.tsx'), 'utf8');
  assert.ok(
    folderCardSrc.includes('pl-[31px]') && folderCardSrc.includes('text-[12px]'),
    'FolderCard.tsx must preserve narrow-viewport (360-412px) Q-Bank title readability'
  );

  // Global 8-Stage Release Super-Audit Roadmap Verification
  assert.equal(MASTER_GLOBAL_RELEASE_TRACKING_ID, 'MD-REL-1405-LOCKED');
  assert.equal(GLOBAL_RELEASE_ROADMAP_STAGES.length, 8, 'Must define all 8 Global Release Roadmap stages');
  assert.ok(GLOBAL_RELEASE_ROADMAP_STAGES.every(s => s.status === 'Done' && s.sha256Seal.length === 64));

  // Real Performance Latency Benchmark
  const perfStart = performance.now();
  for (let k = 0; k < 500; k++) {
    buildLiveClinicalNotifications(INITIAL_PATIENTS, INITIAL_APPOINTMENTS, new Set(), '27.5.0');
  }
  const notifBenchMs = performance.now() - perfStart;
  assert.ok(notifBenchMs < 250, `500x buildLiveClinicalNotifications exceeded budget: ${notifBenchMs.toFixed(2)}ms`);

  console.log(`✅ SECTION 21 PASSED (Release Roadmap MD-REL-1405-LOCKED · PWA/OTA/Note8 · 500x Live Alerts in ${notifBenchMs.toFixed(2)}ms)`);

  // ---------------------------------------------------------------------------
  // 22. Global Cross-Module Clinical Intelligence & End-to-End Integration Audit
  // ---------------------------------------------------------------------------
  console.log('\n[22/22] Verifying Global Cross-Module Clinical Intelligence & End-to-End Links...');

  const summary0 = analyzePatient360(INITIAL_PATIENTS[0], INITIAL_APPOINTMENTS);
  assert.equal(summary0.patientId, INITIAL_PATIENTS[0].id);
  assert.ok(summary0.priorityScore >= 0);

  // Synthetic cross-module edge cases: ready lab order without appointment + bounced check + low stock
  const syntheticPatient = {
    ...INITIAL_PATIENTS[0],
    id: 'pat-intel-test',
    fullName: 'بیمار تست سراسری',
    phone: '۰۹۱۲۹۹۹۰۰۱۱',
    medicalHistory: ['فشار خون بالا'],
    sayadChecks: [
      {
        id: 'chk-intel-1',
        patientId: 'pat-intel-test',
        patientName: 'بیمار تست سراسری',
        sayadId: '1234567890123456',
        bankName: 'ملی',
        amount: 15000000,
        dueDate: '۱۴۰۵/۰۹/۰۱',
        drawerName: 'بیمار تست سراسری',
        status: 'bounced' as const,
        isGuarantee: false
      }
    ],
    labOrders: [
      {
        id: 'lab-intel-1',
        patientId: 'pat-intel-test',
        patientName: 'بیمار تست سراسری',
        toothNumber: 'UR6',
        workType: 'روکش زیرکونیا',
        labName: 'لابراتوار پیشرو',
        shade: 'A2',
        sendDate: '۱۴۰۵/۰۸/۱۰',
        deliveryDate: '۱۴۰۵/۰۸/۱۵',
        appointmentDate: '۱۴۰۵/۰۸/۲۰',
        status: 'ready_for_clinic' as const,
        cost: 3000000,
        reminderNotice: ''
      }
    ]
  };
  const synSummary = analyzePatient360(syntheticPatient, []);
  assert.equal(synSummary.bouncedChecksCount, 1);
  assert.equal(synSummary.readyLabOrders.length, 1);
  assert.equal(synSummary.hasSystemicAlert, true);

  const smartActions = buildGlobalSmartActions([syntheticPatient], [], INITIAL_INVENTORY);
  assert.ok(smartActions.some(a => a.payload.type === 'open_patient_tab' && a.payload.tab === 'financial'), 'Bounced check must synthesize financial follow-up action');
  assert.ok(smartActions.some(a => a.payload.type === 'schedule_appointment'), 'Ready lab order without appointment must synthesize scheduling action');
  assert.equal(smartActions[0].severity, 'critical', 'Critical severity actions must sort to top');

  // Universal search across Sayad check, Lab, Patient, Inventory (with Arabic/Persian normalization)
  const checkHits = searchClinicUniversal('1234567890123456', [syntheticPatient], [], INITIAL_INVENTORY);
  assert.ok(checkHits.some(h => h.category === 'چک صیادی'), 'searchClinicUniversal must find 16-digit Sayad checks');
  const labHits = searchClinicUniversal('زيركونيا', [syntheticPatient], [], INITIAL_INVENTORY);
  assert.ok(labHits.some(h => h.category === 'لابراتوار'), 'searchClinicUniversal must normalize Arabic ي/ك and find Lab orders');
  const patHits = searchClinicUniversal('سراسري', [syntheticPatient], [], INITIAL_INVENTORY);
  assert.ok(patHits.some(h => h.category === 'بیمار'), 'searchClinicUniversal must find normalized patient names');

  // SSR Verification of Upgraded IncomingCallBanner 360, GlobalCommandPalette & Patient-Aware AiAssistantView
  const call360Html = renderToStaticMarkup(
    React.createElement(IncomingCallBanner, {
      call: {
        id: 'call-360',
        phoneNumber: syntheticPatient.phone,
        timestamp: '10:00',
        matchedPatient: syntheticPatient
      },
      appointments: INITIAL_APPOINTMENTS,
      onClose: () => {},
      onScheduleAppointment: () => {},
      onOpenPatientFile: () => {},
      onQuickAdmission: () => {}
    })
  );
  assert.ok(call360Html.includes('چک برگشتی') && call360Html.includes('آماده تحویل'), 'IncomingCallBanner must render live 360 badges');

  const cmdPaletteHtml = renderToStaticMarkup(
    React.createElement(GlobalCommandPalette, {
      isOpen: true,
      onClose: () => {},
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS,
      inventory: INITIAL_INVENTORY,
      onSelectPatient: () => {},
      onOpenPalmerChart: () => {},
      onNavigate: () => {},
      onQuickAdmission: () => {},
      onOpenPaymentModal: () => {},
      onOpenClinicalHud: () => {},
      onOpenAccessibility: () => {}
    })
  );
  assert.ok(cmdPaletteHtml.includes('فرمان صوتی و جستجوی جامع مینادنتال'), 'GlobalCommandPalette must render with universal props');

  const aiHtml = renderToStaticMarkup(
    React.createElement(AiAssistantView, {
      patients: [syntheticPatient],
      appointments: INITIAL_APPOINTMENTS,
      inventory: INITIAL_INVENTORY
    })
  );
  assert.ok(
    aiHtml.includes('هوش سراسری مطب') && aiHtml.includes('پرونده هدف تحلیل هوشمند'),
    'AiAssistantView must render live Smart Triage and Patient Context selector'
  );

  // PatientFileModal 360° status bar + 1-tap next appointment booking
  const pfm360Html = renderToStaticMarkup(
    React.createElement(PatientFileModal, {
      patient: syntheticPatient,
      isOpen: true,
      onClose: () => {},
      appointments: INITIAL_APPOINTMENTS,
      onScheduleAppointment: () => {},
      onOpenPalmerChart: () => {},
      onAddCheck: () => {},
      onAddPayment: () => {},
      onAddLabOrder: () => {}
    })
  );
  assert.ok(
    pfm360Html.includes('رزرو نوبت سریع') && pfm360Html.includes('پروتز آماده تحویل'),
    'PatientFileModal must render live 360° cross-module strip and 1-tap booking button'
  );

  // NotificationDrawer live inventory shortage alerts + patient/SMS/appointment bindings
  const lowInvSample = [{ ...INITIAL_INVENTORY[0], id: 'inv-low-test', name: 'کامپوزیت نانوهیبرید A2', stock: 1, minAlert: 5 }];
  const liveNotifs = buildLiveClinicalNotifications([syntheticPatient], INITIAL_APPOINTMENTS, new Set(), '27.5.0', lowInvSample);
  assert.ok(liveNotifs.some(n => n.category === 'inventory' && n.actionModule === 'inventory'), 'buildLiveClinicalNotifications must surface low-stock inventory alerts');
  assert.ok(liveNotifs.some(n => n.patientId === syntheticPatient.id && n.suggestedTreatment), 'Lab/Implant notifications must include suggestedTreatment and patientId');
  const notifCrossHtml = renderToStaticMarkup(
    React.createElement(NotificationDrawer, {
      isOpen: true,
      onClose: () => {},
      patients: [syntheticPatient],
      appointments: INITIAL_APPOINTMENTS,
      inventory: lowInvSample,
      onOpenPatientFile: () => {},
      onScheduleSmartAppointment: () => {}
    })
  );
  assert.ok(notifCrossHtml.includes('کسری موجودی انبار') && notifCrossHtml.includes('رزرو نوبت'), 'NotificationDrawer must render inventory alert and 1-tap booking pill');

  // Connected Secondary Views SSR checks
  const sterHtml = renderToStaticMarkup(React.createElement(SterilizationModuleView, { patients: [syntheticPatient], onLinkPackToPatient: () => {}, onOpenPatientFile: () => {}, onOpenSterileScanner: () => {} }));
  const xrayHtml = renderToStaticMarkup(React.createElement(XRayModuleView, { patients: [syntheticPatient], onOpenPatientFile: () => {} }));
  const insHtml = renderToStaticMarkup(React.createElement(InsuranceClaimsView, { patients: [syntheticPatient], onOpenPatientFile: () => {}, onRecordInsurancePayment: () => {} }));
  const mktHtml = renderToStaticMarkup(React.createElement(MarketingCampaignsView, { patients: [syntheticPatient], onOpenPatientFile: () => {} }));
  assert.ok(sterHtml.includes('اسکن پک') && xrayHtml.includes('پرونده بیمار') && insHtml.includes('خروجی دیسک بیمه') && mktHtml.includes('تبلیغات'), 'All connected secondary views must render cleanly');

  // Camera permission, RealQrCode ISO SVG & Universal Cross-Module Scanner checks
  const metaJson = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'metadata.json'), 'utf8'));
  assert.ok(Array.isArray(metaJson.requestFramePermissions) && metaJson.requestFramePermissions.includes('camera'), 'metadata.json must request camera iframe permission');
  const realQrSvg = renderToStaticMarkup(React.createElement(RealQrCode, { value: 'MINA-PAT-D-9901', size: 120 }));
  assert.ok(realQrSvg.includes('<svg') && realQrSvg.includes('<path d='), 'RealQrCode must synchronously emit scannable ISO QR SVG paths');
  const sayadParsed = parseSayadCheckPayload('https://sayad.ir/check?id=7491839216485299&bank=mellat&amount=12500000');
  assert.equal(sayadParsed?.sayadId, '7491839216485299');
  assert.equal(sayadParsed?.bankName, 'بانک ملت');
  const labScanHit = resolveClinicScanPayload(`QR-${syntheticPatient.labOrders[0].id.slice(-4)}`, [syntheticPatient], INITIAL_INVENTORY);
  assert.equal(labScanHit?.kind, 'lab', 'resolveClinicScanPayload must resolve Lab packet QR codes');
  const patScanHit = resolveClinicScanPayload(`MINA-PAT-${syntheticPatient.fileNumber}`, [syntheticPatient], INITIAL_INVENTORY);
  assert.equal(patScanHit?.kind, 'patient', 'resolveClinicScanPayload must resolve Patient Wallet QR passes');
  const sterScanHit = resolveClinicScanPayload('AUT-1405-0842', [syntheticPatient], INITIAL_INVENTORY);
  assert.equal(sterScanHit?.kind, 'sterilization', 'resolveClinicScanPayload must resolve Sterilization pack QR codes');
  const invScanHit = resolveClinicScanPayload(INITIAL_INVENTORY[0].barcode || INITIAL_INVENTORY[0].id, [syntheticPatient], INITIAL_INVENTORY);
  assert.equal(invScanHit?.kind, 'inventory', 'resolveClinicScanPayload must resolve Inventory barcodes');
  const uniScannerHtml = renderToStaticMarkup(
    React.createElement(UniversalClinicScannerModal, {
      isOpen: true,
      onClose: () => {},
      patients: [syntheticPatient],
      inventory: INITIAL_INVENTORY
    })
  );
  assert.ok(
    uniScannerHtml.includes('اسکنر بارکد و QR') &&
      uniScannerHtml.includes('jsQR') &&
      uniScannerHtml.includes('در حال اتصال دوربین...') &&
      !uniScannerHtml.includes('چرخ غربیلکی') &&
      !uniScannerHtml.includes('تست سریع'),
    'UniversalClinicScannerModal must render real multi-engine scanner UI without fake demo wheels'
  );

  // Camera Hardware Bridge Safe Diagnostics & Troubleshooting Guide Checks
  const iframeGuide = hardwareBridgeService.buildCameraTroubleshootingGuide('permission_denied', { isEmbeddedIframe: true });
  assert.ok(iframeGuide.title.length > 0 && iframeGuide.hint.length > 0 && iframeGuide.steps.length >= 2, 'Iframe camera denied guide must provide step-by-step instructions');
  const httpsGuide = hardwareBridgeService.buildCameraTroubleshootingGuide('insecure_context');
  assert.ok(httpsGuide.title.includes('HTTPS') && httpsGuide.steps.length >= 2, 'Insecure context guide must clearly instruct HTTPS/localhost usage');
  const probeRes = await hardwareBridgeService.probeCameraHardware();
  assert.equal(probeRes.mediaDevicesAvailable, false, 'SSR probeCameraHardware must safely detect non-DOM environment without throwing');
  assert.ok(probeRes.troubleshootingSteps.length >= 2, 'SSR probeCameraHardware must provide fallback troubleshooting steps');
  const safeStreamRes = await hardwareBridgeService.requestSafeCameraStream({ facingMode: 'environment' });
  assert.equal(safeStreamRes.ok, false, 'SSR requestSafeCameraStream must fail gracefully without uncaught error');
  assert.equal(safeStreamRes.stream, null);

  // Live Zero-Loss Data, Offline Outbox, Multi-Account Sync & Product Barcode Data Extraction Checks
  const gs1Parsed = parseDentalProductBarcodePayload('(01)04027591001234(17)281231(10)LOT405B(30)4');
  assert.ok(gs1Parsed, 'GS1-128 dental product barcode must extract structured metadata');
  assert.equal(gs1Parsed?.lotNumber, 'LOT405B');
  assert.equal(gs1Parsed?.suggestedQuantity, 4);
  assert.equal(gs1Parsed?.sourceStandard, 'GS1-128 / UDI');

  const jsonProdParsed = parseDentalProductBarcodePayload(
    '{"name":"کیت ایمپلنت دنتیوم","brand":"Dentium","lot":"DT-99","expiry":"1407/05/01","qty":3,"price":12000000}'
  );
  assert.equal(jsonProdParsed?.name, 'کیت ایمپلنت دنتیوم');
  assert.equal(jsonProdParsed?.brand, 'Dentium');
  assert.equal(jsonProdParsed?.suggestedQuantity, 3);

  const eanResolved = resolveClinicScanPayload('6260110045012', [syntheticPatient], INITIAL_INVENTORY);
  assert.equal(eanResolved?.kind, 'product_data', 'New commercial EAN-13 barcode must resolve to product_data rather than miss');
  const sayadPriorityCheck = resolveClinicScanPayload('7491839216485299', [syntheticPatient], INITIAL_INVENTORY);
  assert.equal(sayadPriorityCheck?.kind, 'sayad_check', '16-digit Sayad ID must preserve priority over product barcode parser');

  const invScannerSsr = renderToStaticMarkup(
    React.createElement(InventoryQrScannerModal, {
      isOpen: true,
      onClose: () => {},
      inventory: INITIAL_INVENTORY,
      onUpdateStock: () => {},
      onRegisterScannedProduct: () => {},
      onShowToast: () => {}
    })
  );
  assert.ok(
    invScannerSsr.includes('اسکنر بارکد انبار') &&
      invScannerSsr.includes('انتخاب تصویر') &&
      !invScannerSsr.includes('چرخ غربیلکی') &&
      !invScannerSsr.includes('تست دریافت دیتای بارکد'),
    'InventoryQrScannerModal must render clean real barcode scanner UI without fake preset wheels'
  );
  assert.ok(!uniScannerHtml.includes('اسکن با عکس دوربین'), 'UniversalClinicScannerModal must keep clean standard labels');

  // Persistent Offline Sync Outbox & Chronological Reconnect Flush Verification
  await indexedDbService.clearSyncOperations();
  const offlineRes = await syncEngine.recordOfflineOrLiveMutation({
    entity: 'inventory',
    action: 'UPSERT',
    payload: { id: 'inv-offline-test', name: 'متریال تست آفلاین', category: 'تست', stock: 5, unit: 'عدد', minAlert: 1, expiryDate: '1407/01/01', pricePerUnit: 100000 },
    actorName: manager.username,
    actorRole: manager.role,
    platform: manager.assignedPlatform,
    forceOfflineQueue: true
  });
  assert.equal(offlineRes.queuedOffline, true, 'Offline mutation must enqueue persistently in sync_queue');
  const queuedOps = await indexedDbService.getPendingSyncOperations();
  assert.equal(queuedOps.length, 1, 'Pending sync queue must hold 1 offline operation prior to reconnect');
  let flushedPayloadId = '';
  const flushResult = await syncEngine.flushOfflineOutbox({
    saveInventoryItem: async (item) => {
      flushedPayloadId = item.id;
    }
  });
  assert.equal(flushResult.flushedCount, 1, 'Reconnect flush must drain queued offline operations');
  assert.equal(flushResult.remainingCount, 0, 'Sync queue must be empty after successful flush');
  assert.equal(flushedPayloadId, 'inv-offline-test');

  const syncEngineSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/syncEngine.ts'), 'utf8');
  assert.ok(
    syncEngineSrc.includes('minadental_clinic_backup.json') && !syncEngineSrc.includes('qdent_clinic_backup.json'),
    'syncEngine.ts must use MinaDental backup filename without legacy qdent naming'
  );

  // Live Zero-Loss Data & Financial Ledger Integrity Verifier Checks (6 checks including Offline/RBAC Sync)
  const integrityReport = verifyClinicDataIntegrity(INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY, INITIAL_USERS);
  assert.equal(integrityReport.allPassed, true, 'Clinic data integrity audit on baseline records must pass 100%');
  assert.equal(integrityReport.ledgerBalanceDeltaToman, 0, 'Fixed-point micro-unit ledger balance delta must be exact 0 Toman');
  assert.ok(integrityReport.checks.length >= 6, 'Integrity verifier must execute all 6 cross-module + offline/RBAC audit checks');
  assert.ok(integrityReport.checks.some(c => c.id === 'chk-offline-rbac-sync'), 'Integrity report must verify offline outbox & encrypted staff RBAC sync');
  assert.ok(integrityReport.integritySeal.startsWith('MD-VER-'), 'Integrity report must emit deterministic MD-VER seal');

  const pkgJson = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkgJson.name, 'minadental-clinic-os', 'package.json name must reflect minadental-clinic-os branding');

  const settingsAuditHtml = renderToStaticMarkup(
    React.createElement(SettingsView, {
      currentUser: manager,
      patients: INITIAL_PATIENTS,
      appointments: INITIAL_APPOINTMENTS,
      inventory: INITIAL_INVENTORY,
      users: INITIAL_USERS
    })
  );
  assert.ok(settingsAuditHtml.includes('تنظیمات'), 'SettingsView with full clinic props must render cleanly in SSR');

  // Latency benchmark for 1000x Global Smart Actions + Universal Search
  const intelStart = performance.now();
  for (let i = 0; i < 1000; i++) {
    buildGlobalSmartActions(INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY);
    searchClinicUniversal('زیرکونیا', INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY);
  }
  const intelMs = performance.now() - intelStart;
  assert.ok(intelMs < 400, `1000x clinicalIntelligence exceeded 400ms budget: ${intelMs.toFixed(2)}ms`);

  console.log(`✅ SECTION 22 PASSED (Product Barcode Data Extraction, Offline Queue Flush, Safe Camera Diagnostics, Integrity Shield & Cross-Module Links · 1000x in ${intelMs.toFixed(2)}ms)`);
  console.log('✅ ALL 22 INDUSTRIAL SECURITY, TYPOGRAPHY, VIEWPORT LOCK, 6-PHASE + 8-STAGE GLOBAL RELEASE AUDIT, STRESS-CYCLE (1K/500/500K), WAI-ARIA DIALOGS & CROSS-MODULE INTEGRATION CHECKS PASSED.');
}

runIndustrialAuditSuite().catch((err) => {
  console.error('❌ Industrial Audit Suite failed:', err);
  process.exit(1);
});



