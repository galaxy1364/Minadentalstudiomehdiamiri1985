// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { INITIAL_APPOINTMENTS, INITIAL_PATIENTS } from '../data/mockData';
import { INITIAL_USERS } from '../services/syncEngine';
import { AppointmentsView } from '../components/views/AppointmentsView';
import { PatientsListView } from '../components/views/PatientsListView';
import { PatientFileModal } from '../components/PatientFileModal';
import { PalmerChartModal } from '../components/PalmerChartModal';
import { TreatmentsView } from '../components/views/TreatmentsView';
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
import { PatientBookingPortalModal } from '../components/PatientBookingPortalModal';
import { DigitalLabPortalModal } from '../components/DigitalLabPortalModal';
import { TreatmentInvoiceModal } from '../components/TreatmentInvoiceModal';
import { LabPrescriptionModal } from '../components/LabPrescriptionModal';
import { AddCheckModal } from '../components/AddCheckModal';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { InstallmentPlanModal } from '../components/InstallmentPlanModal';
import { QuickAdmissionModal } from '../components/QuickAdmissionModal';
import { AddLabOrderModal } from '../components/AddLabOrderModal';
import { IncomingCallBanner } from '../components/IncomingCallBanner';
import { SmsGatewaySettingsModal } from '../components/SmsGatewaySettingsModal';
import { DoctorCommissionModal } from '../components/DoctorCommissionModal';
import { BackupModal } from '../components/BackupModal';
import { ClinicalHudDrawer } from '../components/ClinicalHudDrawer';
import { RoleSwitcherModal } from '../components/RoleSwitcherModal';
import { NotificationDrawer } from '../components/NotificationDrawer';
import { ServicesSheet } from '../components/ServicesSheet';
import { GlobalCommandPalette } from '../components/GlobalCommandPalette';
import { ClinicSessionLockOverlay } from '../components/ClinicSessionLockOverlay';
import { AccessibilityControlsModal } from '../components/AccessibilityControlsModal';
import { BatchStockModal } from '../components/InventoryBatchModal';
import { InventoryBarcodeModal } from '../components/InventoryBarcodeModal';
import { OneHandedActionSheet } from '../components/OneHandedActionSheet';
import { SupplierPurchaseOrderModal } from '../components/SupplierPurchaseOrderModal';
import { InventoryQrScannerModal } from '../components/InventoryQrScannerModal';
import { UniversalClinicScannerModal } from '../components/UniversalClinicScannerModal';
import { INITIAL_INVENTORY } from '../data/mockData';
import { clinicalSmsService } from '../services/smsService';
import { inventoryConsumptionService } from '../services/inventoryConsumptionService';
import { getCurrentPersianDate, addMonthsToPersianDate, getRelativePersianDate } from '../utils/jalali';
import * as ThreeDLogos from '../components/ThreeDimensionalLogos';
import { BottomDock } from '../components/BottomDock';
import App from '../App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MD-TST-DOM: Interactive Happy-DOM & Multi-Module Verification', () => {
  it('[MD-TST-03] interactive AppointmentsView: switches sub-tabs, opens Print/CSV drawer, detects SLA wait alerts, and displays unit utilization', () => {
    const todayStr = getCurrentPersianDate();
    const waitStartOld = new Date(Date.now() - 28 * 60000).toISOString();
    const augmentedApts = [
      ...INITIAL_APPOINTMENTS,
      {
        id: 'apt-sla-dom-test',
        patientId: INITIAL_PATIENTS[0].id,
        patientName: 'بیمار تست انتظار طولانی',
        phone: '۰۹۱۲۳۴۵۶۷۸۹',
        doctor: 'دکتر مهدی امیری',
        unit: 'یونیت آبی',
        treatment: 'معاینه اورژانسی',
        date: todayStr,
        time: '۱۲:۰۰',
        durationMinutes: 30,
        status: 'waiting' as const,
        waitingStartedAt: waitStartOld
      }
    ];

    const onAdd = vi.fn();
    render(
      React.createElement(AppointmentsView, {
        appointments: augmentedApts,
        patients: INITIAL_PATIENTS,
        onAddAppointment: onAdd,
        onUpdateStatus: vi.fn(),
        isManager: true
      })
    );

    // 1. Unit headers show canonical names + capacity indicator
    expect(screen.getAllByText('یونیت آبی').length).toBeGreaterThan(0);
    expect(screen.getAllByText('یونیت زرد').length).toBeGreaterThan(0);
    expect(screen.getAllByText('یونیت جراحی').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/اشغال/).length).toBeGreaterThan(0);

    // 2. Waiting SLA alert > 20 min renders on waiting patient card, plus direct Call, SMS, & Service SMS dock
    expect(screen.getByText(/SLA/)).toBeTruthy();
    const telLinks = screen.getAllByTitle(/تماس تلفنی مستقیم/);
    expect(telLinks.length).toBeGreaterThan(0);
    expect(telLinks[0].getAttribute('href')?.startsWith('tel:')).toBe(true);
    const smsLinks = screen.getAllByTitle(/ارسال مستقیم پیامک/);
    expect(smsLinks.length).toBeGreaterThan(0);
    expect(smsLinks[0].getAttribute('href')?.startsWith('sms:')).toBe(true);
    expect(screen.getAllByText('سرویس پیامک').length).toBeGreaterThan(0);

    // 2B. Auto-SMS Automation Service Drawer opens & shows triggers
    fireEvent.click(screen.getByRole('button', { name: /تنظیمات سرویس پیامکی خودکار/ }));
    expect(screen.getByText(/سرویس ارسال اتوماتیک پیامک نوبت‌دهی/)).toBeTruthy();
    expect(screen.getByText(/اعلام فراخوان به یونیت/)).toBeTruthy();

    // 3. Clicking 'لیست انتظار' tab shows waitlist workspace
    fireEvent.click(screen.getByRole('tab', { name: /لیست انتظار/ }));
    expect(screen.getByText(/لیست انتظار هوشمند کنسلی و درد حاد/)).toBeTruthy();

    // 4. Clicking 'شیفت و تعطیلات' tab switches to Iranian holidays & unit manager
    fireEvent.click(screen.getByRole('tab', { name: /شیفت و تعطیلات/ }));
    expect(screen.getByText(/ساعات کاری مطب و زمان استراحت بین‌روز/)).toBeTruthy();

    // 5. Clicking 'چاپ برنامه روز' reveals printable sheet, batch reminder, & CSV Excel export button
    fireEvent.click(screen.getByRole('button', { name: /چاپ برنامه روز/ }));
    expect(screen.getByText(/دانلود اکسل \(CSV\)/)).toBeTruthy();
    expect(screen.getByText(/یادآور گروهی این روز/)).toBeTruthy();
  });

  it('[MD-TST-03B] interactive New Appointment Modal: opens via نوبت جدید, auto-selects یونیت جراحی on implant preset, and renders multi-session dates', () => {
    const { unmount: unmountInitial } = render(
      React.createElement(AppointmentsView, {
        appointments: INITIAL_APPOINTMENTS,
        patients: INITIAL_PATIENTS,
        onAddAppointment: vi.fn(),
        onUpdateStatus: vi.fn(),
        isManager: true
      })
    );

    const newAptBtn = screen.getByRole('button', { name: /نوبت جدید/ });
    fireEvent.click(newAptBtn);

    // Modal should now be mounted inside DOM
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/تکرار \/ جلسات زنجیره‌ای/)).toBeTruthy();

    // Selecting implant preset automatically sets 90 min & یونیت جراحی
    const implantPresetBtn = screen.getByRole('button', { name: /جراحی و ایمپلنت/ });
    fireEvent.click(implantPresetBtn);
    const unitSelect = screen.getByLabelText('یونیت') as HTMLSelectElement;
    expect(unitSelect.value).toBe('یونیت جراحی');

    // Selecting 2 weekly sessions previews generated Jalali session dates
    fireEvent.click(screen.getByRole('button', { name: /۲ جلسه هفتگی/ }));
    expect(screen.getByText(/تاریخ‌های جلسات:/)).toBeTruthy();
    unmountInitial();

    // Smart No-Show Prediction: matching a patient with no_show history & overdue installment warns the secretary
    const riskPat = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-risk-dom',
      fullName: 'حسین رضایی تست غیبت',
      phone: '09128887766',
      balance: -9_000_000,
      installments: [
        {
          id: 'inst-dom-ov',
          patientId: 'pat-risk-dom',
          patientName: 'حسین رضایی تست غیبت',
          treatmentName: 'عصب‌کشی',
          installmentNumber: 1,
          totalInstallments: 2,
          amount: 4_000_000,
          dueDate: '۱۴۰۴/۱۰/۰۱',
          status: 'overdue' as const,
          paymentMethod: 'check' as const
        }
      ]
    };
    const { unmount: unmountRisk } = render(
      React.createElement(AppointmentsView, {
        appointments: [
          ...INITIAL_APPOINTMENTS,
          {
            id: 'apt-prev-noshow-dom',
            patientId: riskPat.id,
            patientName: riskPat.fullName,
            phone: riskPat.phone,
            doctor: 'دکتر مهدی امیری',
            unit: 'یونیت آبی',
            treatment: 'معاینه',
            date: '۱۴۰۵/۰۱/۲۰',
            time: '۱۰:۰۰',
            durationMinutes: 30,
            status: 'no_show' as const
          }
        ],
        patients: [riskPat, ...INITIAL_PATIENTS],
        onAddAppointment: vi.fn(),
        onUpdateStatus: vi.fn(),
        isManager: true
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /نوبت جدید/ }));
    const nameInput = screen.getByPlaceholderText('مثال: رضا محمدی');
    fireEvent.change(nameInput, { target: { value: riskPat.fullName } });
    expect(screen.getByRole('alert').textContent).toContain('هشدار منشی — احتمال عدم حضور');
    const enableSmsBtn = screen.getByRole('button', { name: /فعال‌سازی پیامک و یادآور تایید/ });
    fireEvent.click(enableSmsBtn);
    expect(screen.getByText(/پیامک و یادآور تایید فعال شد/)).toBeTruthy();
    unmountRisk();
  });

  it('[MD-TST-03C] interactive Hourly Timeline Grid & Conflict-to-Waitlist: clicks free unit cell to prefill modal, verifies draggable timeline card & batch tomorrow button, and transfers conflicting slot to waitlist in 1 tap', () => {
    const nextMonthStr = addMonthsToPersianDate(getCurrentPersianDate(), 1);
    const seededApts = [
      {
        id: 'apt-timeline-busy',
        patientId: INITIAL_PATIENTS[0].id,
        patientName: 'سارا کاظمی',
        phone: '۰۹۱۲۱۱۱۲۲۳۳',
        doctor: 'دکتر مهدی امیری',
        unit: 'یونیت آبی',
        treatment: 'ترمیم کامپوزیت',
        date: nextMonthStr,
        time: '۱۰:۰۰',
        durationMinutes: 45,
        status: 'scheduled' as const
      }
    ];

    render(
      React.createElement(AppointmentsView, {
        appointments: seededApts,
        patients: INITIAL_PATIENTS,
        onAddAppointment: vi.fn(),
        onUpdateStatus: vi.fn(),
        onOpenPaymentForPatient: vi.fn(),
        isManager: true
      })
    );

    // Verify 1-tap tomorrow batch reminder button is rendered
    expect(screen.getByText(/یادآور فردا/)).toBeTruthy();

    // 1. Navigate to next Persian month so slots are guaranteed in the future, then open Hourly Timeline Grid
    fireEvent.click(screen.getByRole('button', { name: 'ماه بعد' }));
    fireEvent.click(screen.getByRole('tab', { name: /جدول ساعتی یونیت‌ها/ }));
    expect(screen.getByText(/ماتریس ساعتی یونیت‌ها/)).toBeTruthy();
    const occupiedBtn = screen.getByText('سارا کاظمی').closest('button');
    expect(occupiedBtn?.getAttribute('draggable')).toBe('true');

    // 2. Click free cell for یونیت زرد at ۱۰:۰۰ -> opens Add Modal prefilled for یونیت زرد at ۱۰:۰۰
    const freeCellBtn = screen.getByRole('button', { name: /رزرو یونیت زرد ساعت ۱۰:۰۰/ });
    fireEvent.click(freeCellBtn);
    expect(screen.getByRole('dialog')).toBeTruthy();
    const unitSelect = screen.getByLabelText('یونیت') as HTMLSelectElement;
    expect(unitSelect.value).toBe('یونیت زرد');

    // 3. Switch unit to یونیت آبی at the exact same ۱۰:۰۰ slot -> instant conflict banner with انتقال به لیست انتظار
    fireEvent.change(unitSelect, { target: { value: 'یونیت آبی' } });
    const waitlistTransferBtn = screen.getByRole('button', { name: /انتقال به لیست انتظار/ });
    fireEvent.click(waitlistTransferBtn);

    // 4. Verify waitlist tab became active
    expect(screen.getByText(/لیست انتظار هوشمند کنسلی و درد حاد/)).toBeTruthy();
  });

  it('[MD-TST-ALL] mounts all 14 clinical view modules in live happy-dom with zero crashes or NaN leakage', () => {
    const manager = INITIAL_USERS.find(u => u.role === 'admin')!;
    const viewCases: Array<{ id: string; el: React.ReactElement; expectText: string }> = [
      {
        id: 'MD-TST-01-Dashboard',
        el: React.createElement(DashboardView, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          onNavigate: vi.fn(),
          onOpenPalmerChart: vi.fn(),
          onQuickAdmission: vi.fn(),
          todayAppointmentsCount: INITIAL_APPOINTMENTS.length,
          activeSurgeriesCount: 2,
          readyLabOrdersCount: 1,
          dailyRevenue: 25_000_000
        }),
        expectText: 'پذیرش و نوبت‌دهی'
      },
      {
        id: 'MD-TST-02-Patients',
        el: React.createElement(PatientsListView, {
          patients: INITIAL_PATIENTS,
          onOpenPatientFile: vi.fn(),
          onAddNewPatient: vi.fn(),
          isManager: true
        }),
        expectText: INITIAL_PATIENTS[0].fullName
      },
      {
        id: 'MD-TST-04B-Treatments',
        el: React.createElement(TreatmentsView, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          onOpenPalmerChart: vi.fn(),
          onOpenPatientFile: vi.fn(),
          onUpdateTreatmentStatus: vi.fn(),
          isManager: true
        }),
        expectText: 'مرکز فوق‌هوشمند درمان و طرح درمان'
      },
      {
        id: 'MD-TST-05-Lab',
        el: React.createElement(LabModuleView, {
          patients: INITIAL_PATIENTS,
          onOpenPatientFile: vi.fn(),
          onAddLabOrder: vi.fn(),
          onUpdateStatus: vi.fn(),
          isManager: true
        }),
        expectText: 'لابراتوار'
      },
      {
        id: 'MD-TST-06-Implant',
        el: React.createElement(ImplantModuleView, {
          patients: INITIAL_PATIENTS,
          onOpenPatientFile: vi.fn(),
          onAdvanceStage: vi.fn(),
          isManager: true
        }),
        expectText: 'ایمپلنت'
      },
      {
        id: 'MD-TST-07-Financial',
        el: React.createElement(FinancialView, {
          patients: INITIAL_PATIENTS,
          onOpenCheckModal: vi.fn(),
          onOpenPatientFile: vi.fn(),
          isManager: true
        }),
        expectText: 'تومان'
      },
      {
        id: 'MD-TST-11-Inventory',
        el: React.createElement(InventoryView, {
          inventory: INITIAL_INVENTORY,
          onUpdateStock: vi.fn(),
          isManager: true
        }),
        expectText: INITIAL_INVENTORY[0].name
      },
      {
        id: 'MD-TST-12-Sterilization',
        el: React.createElement(SterilizationModuleView, { patients: INITIAL_PATIENTS }),
        expectText: 'اتوکلاو'
      },
      {
        id: 'MD-TST-13-XRay',
        el: React.createElement(XRayModuleView, { patients: INITIAL_PATIENTS }),
        expectText: 'CBCT'
      },
      {
        id: 'MD-TST-14-Reminders',
        el: React.createElement(RemindersView, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS
        }),
        expectText: 'یادآوری'
      },
      {
        id: 'MD-TST-15-Marketing',
        el: React.createElement(MarketingCampaignsView, { patients: INITIAL_PATIENTS }),
        expectText: 'کمپین'
      },
      {
        id: 'MD-TST-16-Insurance',
        el: React.createElement(InsuranceClaimsView, { patients: INITIAL_PATIENTS }),
        expectText: 'بیمه'
      },
      {
        id: 'MD-TST-17-AI',
        el: React.createElement(AiAssistantView, {
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          inventory: INITIAL_INVENTORY
        }),
        expectText: 'هوش مصنوعی'
      },
      {
        id: 'MD-TST-18-Settings',
        el: React.createElement(SettingsView, {
          currentUser: manager,
          patients: INITIAL_PATIENTS,
          appointments: INITIAL_APPOINTMENTS,
          inventory: INITIAL_INVENTORY,
          users: INITIAL_USERS
        }),
        expectText: 'تعرفه‌ها'
      }
    ];

    for (const tc of viewCases) {
      const { container, unmount } = render(tc.el);
      const text = container.textContent || '';
      expect(text.length, `${tc.id} rendered empty content`).toBeGreaterThan(20);
      expect(text, `${tc.id} leaked NaN`).not.toContain('NaN');
      expect(text, `${tc.id} leaked undefined`).not.toContain('undefined');
      expect(text, `${tc.id} missing expected label`).toContain(tc.expectText);
      unmount();
    }
  });

  it('[MD-TST-02B] interactive PatientsListView & PatientFileModal: verifies نیازمند پیگیری مالی visual badge, Fuzzy Search with typos, Advanced Filters (بدهکاری/آخرین نوبت/نوع درمان), duplicate detection, 1-tap comm dock, scanner launch, vitals auto-save, allergy Rx guard, refund audit, and offline SVG X-rays', () => {
    const samplePat = {
      ...INITIAL_PATIENTS[0],
      balance: -8_500_000,
      medicalHistory: ['حساسیت به پنی‌سیلین'],
      payments: [
        {
          id: 'pay-dom-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          amount: 2_000_000,
          date: '۱۴۰۴/۰۸/۱۰',
          method: 'pos' as const,
          forTreatment: 'پیش‌پرداخت درمان تست'
        }
      ],
      teethConditions: {
        ...INITIAL_PATIENTS[0].teethConditions,
        'UR-5': {
          quadrant: 'UR' as const,
          toothNumber: 5,
          surfaces: ['occlusal' as const],
          treatment: 'pulpotomy' as const,
          status: 'planned' as const,
          cost: 2_500_000,
          doctorName: 'دکتر مهدی امیری'
        }
      }
    };

    const onOpenScannerSpy = vi.fn();
    const { unmount } = render(
      React.createElement(PatientsListView, {
        patients: [samplePat, ...INITIAL_PATIENTS.slice(1)],
        appointments: INITIAL_APPOINTMENTS,
        onOpenPatientFile: vi.fn(),
        onAddNewPatient: vi.fn(),
        onQuickAddAppointment: vi.fn(),
        onOpenPatientScanner: onOpenScannerSpy,
        isManager: true
      })
    );

    // 1. Slim clinical triage KPI strip, نیازمند پیگیری مالی visual badge, scanner button, & inline پذیرش جدید button
    expect(screen.getByText('کل پرونده‌ها')).toBeTruthy();
    expect(screen.getByText('بیماران نوبت‌دار')).toBeTruthy();
    expect(screen.getAllByText(/نیازمند پیگیری مالی/).length).toBeGreaterThan(0);
    expect(screen.getByText('هشدار سیستمیک/آلرژی')).toBeTruthy();
    const scannerBtn = screen.getByRole('button', { name: /اسکن پرونده/ });
    fireEvent.click(scannerBtn);
    expect(onOpenScannerSpy).toHaveBeenCalledTimes(1);

    const newAdmissionBtn = screen.getByRole('button', { name: /پذیرش جدید/ });
    expect(newAdmissionBtn).toBeTruthy();

    // 2. Test Advanced Filter Panel (بدهکاری، آخرین نوبت، نوع درمان)
    const advFilterBtn = screen.getByRole('button', { name: /فیلتر پیشرفته/ });
    fireEvent.click(advFilterBtn);
    const debtSelect = screen.getByLabelText('فیلتر بر اساس بدهکاری') as HTMLSelectElement;
    const lastVisitSelect = screen.getByLabelText('فیلتر بر اساس آخرین نوبت') as HTMLSelectElement;
    const treatmentSelect = screen.getByLabelText('فیلتر بر اساس نوع درمان') as HTMLSelectElement;
    expect(debtSelect).toBeTruthy();
    expect(lastVisitSelect).toBeTruthy();
    expect(treatmentSelect).toBeTruthy();

    // Filter by pediatric treatment -> samplePat (with pulpotomy) remains visible
    fireEvent.change(treatmentSelect, { target: { value: 'pediatric' } });
    expect(screen.getByText(samplePat.fullName)).toBeTruthy();
    // Reset treatment filter
    fireEvent.change(treatmentSelect, { target: { value: 'all' } });

    // 3. Test Typo-Tolerant Fuzzy Search (searching first name with typo/homophone)
    const searchToggleBtn = screen.getByRole('button', { name: 'جستجوی پیش‌بینانه در بیماران' });
    fireEvent.click(searchToggleBtn);
    const fuzzyInput = screen.getByLabelText('جستجوی فازی نام، شماره تماس، کد ملی یا شماره پرونده');
    const typoQuery = samplePat.fullName.slice(0, 3) + samplePat.fullName.charAt(2) + samplePat.fullName.slice(3, 5);
    fireEvent.change(fuzzyInput, { target: { value: typoQuery } });
    expect(screen.getAllByText(samplePat.fullName).length).toBeGreaterThan(0);
    fireEvent.change(fuzzyInput, { target: { value: '' } });

    // 4. Verify Smart Cohort Action Strip (Batch SMS, CSV Export, Recall Radar, Expand All) & Caller-ID Incoming Call Triage
    expect(screen.getByText('خروجی اکسل (CSV)')).toBeTruthy();
    expect(screen.getByText(/پیامک گروهی/)).toBeTruthy();
    const recallBtn = screen.getByRole('button', { name: /رادار فراخوان هوشمند/ });
    fireEvent.click(recallBtn);
    expect(screen.getByText(/لیست اولویت فراخوان هوشمند/)).toBeTruthy();
    fireEvent.click(recallBtn);

    const callerIdBtn = screen.getByRole('button', { name: /تماس ورودی/ });
    fireEvent.click(callerIdBtn);
    const callerIdInput = screen.getByLabelText('شماره تماس ورودی بیمار');
    fireEvent.change(callerIdInput, { target: { value: samplePat.phone } });
    expect(screen.getByText(/پرونده شناسایی شد/)).toBeTruthy();
    expect(screen.getByText('پیشنهاد تعیین نوبت فوری')).toBeTruthy();
    fireEvent.change(callerIdInput, { target: { value: '09120009988' } });
    expect(screen.getByText(/شماره جدید — بدون پرونده قبلی/)).toBeTruthy();
    fireEvent.click(callerIdBtn);

    // 5. Expand first patient card -> reveals 1-tap communication dock, financial follow-up action strip, & Per-Patient Cross-Module Mini-Chips
    fireEvent.click(screen.getByText(samplePat.fullName));
    expect(screen.getByTitle('تماس تلفنی مستقیم').getAttribute('href')?.startsWith('tel:')).toBe(true);
    expect(screen.getByTitle('ارسال پیامک مستقیم از گوشی').getAttribute('href')?.startsWith('sms:')).toBe(true);
    expect(screen.getByText('سرویس پیامک')).toBeTruthy();
    expect(screen.getByText('واتساپ')).toBeTruthy();
    expect(screen.getByText('ارسال اخطار پیامکی')).toBeTruthy();
    // Click per-patient mini-chips on the expanded card & verify interactive clinical timeline
    expect(screen.getByText(/خط روند تعاملی درمان بیمار/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /چک و اقساط \(/ }));
    expect(screen.getByText(/چک‌های صیادی، اقساط و تراز مالی بیمار:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /پزشکی و بیمه \(/ }));
    expect(screen.getByText(/سوابق سیستمیک، حساسیت دارویی و توضیحات بیمه:/)).toBeTruthy();

    // 6. Open Admission Modal & test live duplicate mobile detection + Modulus-11 national ID validation
    fireEvent.click(newAdmissionBtn);
    expect(screen.getByRole('dialog')).toBeTruthy();
    const phoneInput = screen.getByPlaceholderText('۰۹۱۲۳۴۵۶۷۸۹');
    fireEvent.change(phoneInput, { target: { value: samplePat.phone } });
    expect(screen.getByText(/پرونده مشابه با/)).toBeTruthy();

    const nidInput = screen.getByPlaceholderText('۰۰۱۲۳۴۵۶۷۸');
    fireEvent.change(nidInput, { target: { value: '0079123456' } });
    expect(screen.getByText(/بررسی شود/)).toBeTruthy();

    unmount();

    // 7. Mount PatientFileModal: verifies Clinical Vitals & ASA persistence, Periodontal BPE/PSR & Endo WL, Quick Treatment Discount, Manager Refund, Drug-Allergy Guard Substitution, visits tab, and offline SVG X-rays
    const onUpdatePatientSpy = vi.fn();
    const { unmount: unmountModal } = render(
      React.createElement(PatientFileModal, {
        patient: samplePat,
        isOpen: true,
        onClose: vi.fn(),
        onOpenPalmerChart: vi.fn(),
        onAddCheck: vi.fn(),
        onAddPayment: vi.fn(),
        onAddLabOrder: vi.fn(),
        onUpdatePatient: onUpdatePatientSpy,
        currentUser: { id: 'u-mgr', username: 'amir', fullName: 'دکتر مهدی امیری', role: 'admin', isManager: true } as any,
        appointments: INITIAL_APPOINTMENTS
      })
    );

    expect(document.body.textContent).toContain('پالپوتومی اطفال');
    expect(document.body.textContent).toContain('پایش علائم حیاتی، طبقه ریسک ASA و بی‌حسی ایمن قبل از درمان');
    expect(document.body.textContent).toContain('غربالگری ۶ سکستانت لثه (BPE/PSR) و شاخص وایتالیتی/اندو');
    expect(document.body.textContent).toContain('ثبت مستقیم درمان دندان با اعمال خودکار تعرفه و قیمت/تخفیف لحظه‌ای');
    const asaSelect = screen.getByLabelText('طبقه ریسک سیستمیک ASA بیمار') as HTMLSelectElement;
    expect(asaSelect).toBeTruthy();
    fireEvent.change(asaSelect, { target: { value: 'ASA II' } });
    expect(onUpdatePatientSpy).toHaveBeenCalled();

    expect(screen.getByLabelText('طول کارکرد کانال ریشه اندو')).toBeTruthy();
    const quickDiscountSelect = screen.getByLabelText('تخفیف مدیریتی درمان سریع') as HTMLSelectElement;
    expect(quickDiscountSelect).toBeTruthy();
    fireEvent.change(quickDiscountSelect, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ ثبت فوری درمان/ }));
    expect(onUpdatePatientSpy).toHaveBeenCalledTimes(2);

    const finTab = screen.getByRole('tab', { name: /مالی و کیف پول/ });
    fireEvent.click(finTab);
    expect(document.body.textContent).toContain('ماشین‌حساب هوشمند تقسیط، سهم بیمه تکمیلی و تخفیف مدیر');
    expect(screen.getByText('ثبت خودکار اقساط در پرونده')).toBeTruthy();
    expect(screen.getByText(/سهم‌بندی هوشمند پزشک معالج و صندوق مطب/)).toBeTruthy();
    const refundBtn = screen.getByRole('button', { name: 'عودت وجه' });
    fireEvent.click(refundBtn);
    const confirmRefundBtn = screen.getByRole('button', { name: /تایید عودت/ });
    fireEvent.click(confirmRefundBtn);
    expect(onUpdatePatientSpy).toHaveBeenCalledTimes(3);

    const rxTab = screen.getByRole('tab', { name: /نسخه دارویی/ });
    fireEvent.click(rxTab);
    expect(document.body.textContent).toContain('سپر ایمنی تداخل دارویی');
    expect(screen.getByText('پیامک دستور مصرف به بیمار')).toBeTruthy();
    fireEvent.click(screen.getByText('عفونت حاد و آبسه اندو'));
    expect(document.body.textContent).toContain('کلیندامایسین ۳۰۰ میلی‌گرم');

    const visitsTab = screen.getByRole('tab', { name: /نوبت‌ها و مراجعات/ });
    fireEvent.click(visitsTab);
    expect(screen.getByText(/تاریخچه نوبت‌ها و برنامه‌ریزی مراجعات بیمار/)).toBeTruthy();
    expect(screen.getByText(/ژورنال بالینی جلسه \(SOAP\) و تنظیم فراخوان دوره‌ای/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ثبت در ژورنال' })).toBeTruthy();

    const aiTab = screen.getByRole('tab', { name: /هوش مصنوعی/ });
    fireEvent.click(aiTab);
    expect(screen.getByText('۱. اولویت بالینی بعدی:')).toBeTruthy();
    expect(screen.getByText('۲. پروتکل ایمنی سیستمیک:')).toBeTruthy();
    expect(screen.getByText('۳. وضعیت تسویه و پیگیری:')).toBeTruthy();

    const xrayTab = screen.getByRole('tab', { name: /رادیولوژی OPG/ });
    fireEvent.click(xrayTab);
    expect(document.body.innerHTML).not.toContain('unsplash.com');
    expect(screen.getByLabelText('کلیشه پری‌اپیکال PA')).toBeTruthy();
    expect(screen.getByLabelText('کلیشه پانورامیک OPG')).toBeTruthy();

    // Per-patient 360 smart reminder pill & inline quick reminder creator inside PatientFileModal
    const patRemBtn = screen.getByRole('button', { name: /یادآورهای بیمار \(/ });
    fireEvent.click(patRemBtn);
    const patRemInput = screen.getByLabelText('عنوان یادآور سریع پرونده بیمار');
    fireEvent.change(patRemInput, { target: { value: 'پیگیری بخیه جراحی لثه' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ ثبت یادآور/ }));
    expect(screen.getByText('پیگیری بخیه جراحی لثه')).toBeTruthy();

    unmountModal();
  });

  it('[MD-TST-04] interactive PalmerChartModal: switches patient, records endo/perio/vitality/status metrics via 2-step save, and enforces non-manager discount PIN lock', () => {
    const onSaveTreatment = vi.fn();
    const onSelectPatient = vi.fn();
    const onDeleteToothTreatment = vi.fn();

    const { unmount } = render(
      React.createElement(PalmerChartModal, {
        isOpen: true,
        onClose: vi.fn(),
        patientName: INITIAL_PATIENTS[0].fullName,
        patient: INITIAL_PATIENTS[0],
        patients: INITIAL_PATIENTS,
        onSelectPatient,
        teethConditions: INITIAL_PATIENTS[0].teethConditions,
        isManager: true,
        onSaveTreatment,
        onDeleteToothTreatment
      })
    );

    // 1. Header patient switcher triggers onSelectPatient
    const switcher = screen.getByLabelText('انتخاب بیمار فعال در چارت پالمر') as HTMLSelectElement;
    expect(switcher).toBeTruthy();
    if (INITIAL_PATIENTS[1]) {
      fireEvent.change(switcher, { target: { value: INITIAL_PATIENTS[1].id } });
      expect(onSelectPatient).toHaveBeenCalledWith(INITIAL_PATIENTS[1]);
    }

    // 2. Select endo treatment, completed stage, verify tooth completion celebration animation, enable Perio + Vitality drawers
    fireEvent.click(screen.getByRole('button', { name: 'عصب‌کشی (اندو)' }));
    fireEvent.click(screen.getByRole('button', { name: 'تکمیل شده' }));
    const celebratingTeeth = document.querySelectorAll('[data-tooth-celebrating="true"]');
    expect(celebratingTeeth.length).toBe(1);
    expect(screen.getByText(/با موفقیت تکمیل شد/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /چارت پریودنتال ۶ نقطه‌ای و درجه لقی دندان/ }));
    fireEvent.click(screen.getByRole('button', { name: /تست حیات پالپ و حساسیت اپیکال دندان/ }));

    // 2B. Live Chairside CDSS panel renders AAE differential & inserts 1-click protocol into notes
    const cdssPanel = document.querySelector('[data-testid="palmer-cdss-panel"]');
    expect(cdssPanel).toBeTruthy();
    expect(screen.getByText(/هوش بالینی هم‌زمان صندلی/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /درج پروتکل بالینی در یادداشت/ }));

    // 3. Two-step save confirmation submits structured clinical metrics
    fireEvent.click(screen.getByRole('button', { name: /ثبت درمان در پرونده و چارت پالمر/ }));
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت قطعی در چارت/ }));
    expect(onSaveTreatment).toHaveBeenCalledTimes(1);
    const savedPayload = onSaveTreatment.mock.calls[0][0];
    expect(savedPayload.status).toBe('completed');
    expect(savedPayload.treatment).toBe('endo');
    expect(savedPayload.endoMetrics).toBeTruthy();
    expect(savedPayload.perioMetrics).toBeTruthy();
    expect(savedPayload.vitalityMetrics).toBeTruthy();

    unmount();

    // 4. Non-manager discount lock prevents price edits until PIN is verified
    const { unmount: unmountLocked } = render(
      React.createElement(PalmerChartModal, {
        isOpen: true,
        onClose: vi.fn(),
        patientName: INITIAL_PATIENTS[0].fullName,
        patient: INITIAL_PATIENTS[0],
        patients: INITIAL_PATIENTS,
        teethConditions: INITIAL_PATIENTS[0].teethConditions,
        isManager: false,
        onSaveTreatment: vi.fn()
      })
    );

    const lockBtn = screen.getByRole('button', { name: /قفل تخفیف مدیر/ });
    expect(lockBtn).toBeTruthy();
    fireEvent.click(lockBtn);
    expect(screen.getByRole('button', { name: 'تایید مدیر' })).toBeTruthy();

    unmountLocked();
  });

  it('[MD-TST-05-06] interactive LabModuleView & ImplantModuleView: verifies inline سفارش جدید / جراحی جدید beside chip bars, 4-column KPI triage strips, tel links, prosthetics counts, and 1-tap patient communication docks', () => {
    const { unmount: unmountLab } = render(
      React.createElement(LabModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onAddLabOrder: vi.fn(),
        onUpdateStatus: vi.fn(),
        isManager: true
      })
    );

    expect(screen.getByText('کل سفارشات پروتز')).toBeTruthy();
    expect(screen.getByText('در حال ساخت / تراش')).toBeTruthy();
    expect(screen.getByText('آماده تحویل در مطب')).toBeTruthy();
    expect(screen.getByText('گردش مالی لابراتوار')).toBeTruthy();
    expect(screen.getByRole('button', { name: /سفارش جدید/ })).toBeTruthy();

    // Expand all lab order cards -> reveals 1-tap patient communication dock
    const expandAllLabBtn = screen.getByRole('button', { name: /باز کردن همه/ });
    fireEvent.click(expandAllLabBtn);
    expect(screen.getAllByText('تماس مستقیم').length).toBeGreaterThan(0);
    expect(screen.getAllByText('پیامک گوشی').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ارسال پیامک خدماتی').length).toBeGreaterThan(0);

    // Switch to Partner Labs tab -> verifies real <a href="tel:..."> dialer link
    fireEvent.click(screen.getByRole('tab', { name: /تعریف لابراتوارها/ }));
    const labDialLinks = screen.getAllByText('تماس فوری').map(el => el.closest('a'));
    expect(labDialLinks.length).toBeGreaterThan(0);
    expect(labDialLinks[0]?.getAttribute('href')?.startsWith('tel:')).toBe(true);

    unmountLab();

    const { unmount: unmountImp } = render(
      React.createElement(ImplantModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onAdvanceStage: vi.fn(),
        isManager: true
      })
    );

    expect(screen.getByText('کل کیس‌های جراحی')).toBeTruthy();
    expect(screen.getByText('فاز استئواینتگریشن')).toBeTruthy();
    expect(screen.getByText('قالب‌گیری و پروتز')).toBeTruthy();
    expect(screen.getByText('تحویل نهایی روکش')).toBeTruthy();
    expect(screen.getByRole('button', { name: /جراحی جدید/ })).toBeTruthy();

    // Expand all implant cards -> reveals 1-tap patient communication dock
    const expandAllImpBtn = screen.getByRole('button', { name: /باز کردن همه/ });
    fireEvent.click(expandAllImpBtn);
    expect(screen.getAllByText('تماس مستقیم').length).toBeGreaterThan(0);
    expect(screen.getAllByText('پیامک گوشی').length).toBeGreaterThan(0);
    expect(screen.getAllByText('فراخوان پیامکی').length).toBeGreaterThan(0);

    // Switch to Prosthetics tab -> verifies live dynamic counter cards (not static strings)
    fireEvent.click(screen.getByRole('tab', { name: /پروتز و لابراتوار روکش/ }));
    expect(screen.getByText('آماده قالب‌گیری/اباتمنت')).toBeTruthy();

    unmountImp();

    const { unmount: unmountFin } = render(
      React.createElement(FinancialView, {
        patients: INITIAL_PATIENTS,
        onOpenCheckModal: vi.fn(),
        onOpenPatientFile: vi.fn(),
        isManager: true
      })
    );

    expect(screen.getByText('وصولی قطعی مطب')).toBeTruthy();
    expect(screen.getByText('مطالبات و بدهکاران')).toBeTruthy();
    expect(screen.getByText('چک‌های صیادی در جریان')).toBeTruthy();
    expect(screen.getByText('اقساط جاری درمانی')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /ثبت چک/ }).length).toBeGreaterThan(0);

    unmountFin();
  });

  it('[MD-TST-07] interactive FinancialView: verifies Persian itemized debtor breakdown, patient-targeted payment/check launchers, real Sayad maturity filters & bounce action, POS Z-roll variance, and non-manager PIN lock', () => {
    const onOpenCheckModal = vi.fn();
    const onOpenPaymentModal = vi.fn();
    const onUpdateCheckStatus = vi.fn();

    const { unmount } = render(
      React.createElement(FinancialView, {
        patients: INITIAL_PATIENTS,
        onOpenCheckModal,
        onOpenPatientFile: vi.fn(),
        onOpenPaymentModal,
        onUpdateCheckStatus,
        onEditCheck: vi.fn(),
        onDeleteCheck: vi.fn(),
        isManager: true
      })
    );

    // 1. Expand first debtor card -> triggers patient-targeted payment/check callbacks & translated treatments
    const detailsPills = screen.getAllByText('جزئیات');
    expect(detailsPills.length).toBeGreaterThan(0);
    fireEvent.click(detailsPills[0]);
    const payBtn = screen.queryByRole('button', { name: 'وصول به حساب مطب' });
    if (payBtn) {
      fireEvent.click(payBtn);
      expect(onOpenPaymentModal).toHaveBeenCalled();
    }

    // 2. Switch to Sayad checks tab -> verify real maturity filters + Bounce/Clear check actions
    fireEvent.click(screen.getByRole('tab', { name: /چک صیادی/ }));
    expect(screen.getByText(/پایش واقعی سررسید چک‌های صیادی و اقساط/)).toBeTruthy();
    const expandAllBtn = screen.queryByRole('button', { name: /باز کردن همه/ });
    if (expandAllBtn) {
      fireEvent.click(expandAllBtn);
      const bounceBtn = screen.queryAllByRole('button', { name: /برگشت چک/ })[0];
      if (bounceBtn) {
        fireEvent.click(bounceBtn);
        expect(onUpdateCheckStatus).toHaveBeenCalled();
      }
    }

    // 3. Switch to Daily Z-Report tab -> enter physical POS batch roll and confirm live variance
    fireEvent.click(screen.getByRole('tab', { name: /بستن صندوق روزانه/ }));
    const posRollInput = screen.getByLabelText(/جمع تجمیع رول فیزیکی کارت‌خوان POS/) as HTMLInputElement;
    expect(posRollInput).toBeTruthy();
    fireEvent.change(posRollInput, { target: { value: '1234567' } });
    fireEvent.click(screen.getByRole('button', { name: /تایید و بستن صندوق روزانه/ }));
    expect(screen.getByText('شیفت بسته و تایید شد')).toBeTruthy();

    // 3B. Switch to Financial Reports Dashboard tab ('گزارش‌های مالی') -> verifies Bar + Pie charts & breakdowns
    fireEvent.click(screen.getByRole('tab', { name: 'گزارش‌های مالی' }));
    expect(screen.getByText('داشبورد جامع گزارش‌های مالی و پیش‌بینی درآمد')).toBeTruthy();
    expect(screen.getByText('نمودار میله‌ای درآمد ماهانه و پیش‌بینی اقساط')).toBeTruthy();
    expect(screen.getByText('تفکیک روش‌های پرداخت (نقد، پوز، چک)')).toBeTruthy();
    expect(screen.getByText('پوز')).toBeTruthy();
    expect(screen.getByText('نقد')).toBeTruthy();
    expect(screen.getByText('چک')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /خروجی اکسل \(CSV\)/ }));
    expect(screen.getByText(/فایل گزارش مالی ماهانه و پیش‌بینی اقساط آماده شد/)).toBeTruthy();

    // 3C. Switch to Unified Hub tab ('یکپارچه') -> verifies 5-pillar matrix (Financial + Installments + Sayad Checks + Guarantee + Reminders)
    const unifiedTab = screen.getByRole('tab', { name: /یکپارچه/ });
    fireEvent.click(unifiedTab);
    expect(screen.getByText(/میز فرمان یکپارچه مالی، اقساط، چک صیادی، ضمانت و یادآوری/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ثبت طرح یکپارچه جدید/ })).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');

    unmount();

    // 4. Non-manager guard: Check Edit modal locks amounts/dates until PIN verified
    const { unmount: unmountLocked } = render(
      React.createElement(FinancialView, {
        patients: INITIAL_PATIENTS,
        initialSegment: 'sayad',
        onOpenCheckModal: vi.fn(),
        onOpenPatientFile: vi.fn(),
        onEditCheck: vi.fn(),
        isManager: false
      })
    );
    const expSayad = screen.queryByRole('button', { name: /باز کردن همه/ });
    if (expSayad) {
      fireEvent.click(expSayad);
      const editBtn = screen.getAllByRole('button', { name: 'ویرایش' })[0];
      fireEvent.click(editBtn);
      expect(screen.getByText(/تغییر مبلغ و سررسید اسناد مالی فقط با مجوز مدیر مجاز است/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'تایید مدیر' })).toBeTruthy();
    }
    unmountLocked();
  });

  it('[MD-TST-11] interactive InventoryView & SupplierPurchaseOrderModal: tests FEFO expiry filter, stock stepper, PO modal flow, and non-manager PIN lock on price & deletion', () => {
    const onUpdateStock = vi.fn();
    const nearExpiryItem = {
      ...INITIAL_INVENTORY[0],
      id: 'inv-near-exp-test',
      name: 'کامپوزیت تست انقضا نزدیک',
      stock: 2,
      minAlert: 3,
      expiryDate: getCurrentPersianDate(),
      location: 'قفسه B-4'
    };

    const { unmount } = render(
      React.createElement(InventoryView, {
        inventory: [nearExpiryItem, ...INITIAL_INVENTORY.slice(1)],
        onUpdateStock,
        onAddItem: vi.fn(),
        onBatchUpdate: vi.fn(),
        isManager: true
      })
    );

    // 1. Verify shelf location, FEFO expiry badge, and FEFO filter pill
    expect(screen.getByText('قفسه B-4')).toBeTruthy();
    expect(screen.getByRole('button', { name: /انقضای نزدیک FEFO/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /انقضای نزدیک FEFO/ }));
    expect(screen.getByText(nearExpiryItem.name)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /همه تاریخ‌ها/ }));

    // 2. Expand item card -> click '+' stepper -> calls onUpdateStock(id, stock + 1)
    fireEvent.click(screen.getByText(nearExpiryItem.name));
    const incBtn = screen.getByRole('button', { name: 'افزودن یک عدد موجودی' });
    fireEvent.click(incBtn);
    expect(onUpdateStock).toHaveBeenCalledWith(nearExpiryItem.id, 3);

    // 3. Open SupplierPurchaseOrderModal -> verifies editable supplier mobile & pre-filled items
    fireEvent.click(screen.getByRole('button', { name: /سفارش خودکار کسری‌ها/ }));
    expect(screen.getByRole('dialog', { name: /پیش‌فاکتور خرید تجهیزات و مواد دندانپزشکی/ })).toBeTruthy();
    expect(screen.getByLabelText('موبایل نماینده پخش')).toBeTruthy();
    unmount();

    // 4. Non-manager PIN guard: locks unit price & delete until PIN '1234' is verified
    const { unmount: unmountLocked } = render(
      React.createElement(InventoryView, {
        inventory: [nearExpiryItem],
        onUpdateStock: vi.fn(),
        onBatchUpdate: vi.fn(),
        isManager: false
      })
    );
    fireEvent.click(screen.getByText(nearExpiryItem.name));
    fireEvent.click(screen.getByRole('button', { name: /ویرایش کالا/ }));
    const priceInput = screen.getByLabelText('قیمت واحد (تومان)') as HTMLInputElement;
    expect(priceInput.disabled).toBe(true);
    expect(screen.getByText(/تغییر قیمت واحد یا حذف کالای انبار نیازمند پین مدیر است/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تایید مدیر' }));
    const pinField = screen.getByLabelText('پین مدیر انبار') as HTMLInputElement;
    fireEvent.change(pinField, { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'باز کردن قفل' }));
    expect((screen.getByLabelText('قیمت واحد (تومان)') as HTMLInputElement).disabled).toBe(false);
    unmountLocked();
  });

  it('[MD-TST-14] interactive RemindersView: verifies 9-pillar triage, inventory/recall filters, snooze & unsnooze queue, quiet hours settings, CSV export, 2-step delete, and cross-module actions', async () => {
    localStorage.removeItem('minadental_custom_reminders_v1');
    localStorage.removeItem('minadental_snoozed_reminders_v1');
    localStorage.removeItem('minadental_dismissed_reminders_v1');

    const todayStr = getCurrentPersianDate();
    const soonStr = addMonthsToPersianDate(todayStr, 0);
    const patWithRecall = {
      ...INITIAL_PATIENTS[0],
      nextRecallDate: soonStr,
      recallMonths: 6
    };
    const onOpenPatientFile = vi.fn();
    const onScheduleSmartAppointment = vi.fn();

    const { unmount } = render(
      React.createElement(RemindersView, {
        patients: [patWithRecall, ...INITIAL_PATIENTS.slice(1)],
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        onOpenPatientFile,
        onScheduleSmartAppointment,
        onNavigateToModule: vi.fn()
      })
    );

    // 1. Verify live SMS credit pill & 4-column Urgency Triage Bar
    expect(screen.getByText(/شارژ:/)).toBeTruthy();
    expect(screen.getAllByText('بحرانی و فوری').length).toBeGreaterThan(0);
    expect(screen.getByText('امروز و فردا')).toBeTruthy();
    expect(screen.getByText(/مالی در معرض وصول/)).toBeTruthy();
    expect(screen.getByText('تعویق‌یافته / بایگانی')).toBeTruthy();

    // 2. Verify Inventory FEFO & Periodic Recall category pills work
    fireEvent.click(screen.getByRole('button', { name: /انبار و FEFO/ }));
    expect(screen.getAllByText(/هشدار انبار:/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /ریکال دوره‌ای/ }));
    expect(screen.getAllByText(/فراخوان چکاپ دوره‌ای/).length).toBeGreaterThan(0);

    // Expand Recall item and test cross-module deep link callbacks & staff assignment
    fireEvent.click(screen.getAllByText(/فراخوان چکاپ دوره‌ای/)[0]);
    fireEvent.click(screen.getByRole('button', { name: 'ارجاع یادآوری به منشی پذیرش' }));
    expect(screen.getAllByText('مسئول: منشی پذیرش').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /پرونده بیمار/ }));
    expect(onOpenPatientFile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /رزرو نوبت پیگیری/ }));
    expect(onScheduleSmartAppointment).toHaveBeenCalledTimes(1);

    // Snooze this item for 15 mins -> verify it moves to صف تعویق و انجام‌شده and can be unsnoozed
    fireEvent.click(screen.getByRole('button', { name: /۱۵د تعویق/ }));
    fireEvent.click(screen.getByRole('tab', { name: /صف تعویق و انجام‌شده/ }));
    expect(screen.getByRole('button', { name: /لغو تعویق/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /لغو تعویق/ }));

    // Return to Active Alarms & test 2-way appointment confirmation on an expanded appointment card
    fireEvent.click(screen.getByRole('tab', { name: /آلارم‌های هوشمند/ }));
    fireEvent.click(screen.getByRole('button', { name: /نوبت ویزیت/ }));
    const aptCardTitle = screen.getAllByText(/یادآوری نوبت/)[0];
    fireEvent.click(aptCardTitle);
    fireEvent.click(screen.getByRole('button', { name: 'تاییدیه دوطرفه: تایید بیمار ✓' }));
    expect(screen.getAllByText('تایید بیمار ✓').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /همه هشدارها/ }));

    // Trigger CSV export, Morning Digest preview, & Smart Sweep buttons
    fireEvent.click(screen.getByRole('button', { name: /خلاصه صبحگاهی/ }));
    expect(screen.getByText(/پیش‌نمایش خلاصه صبحگاهی مطب/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /خروجی اکسل یادآوری‌ها/ }));
    expect(screen.getByText(/فایل اکسل یادآوری‌ها/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /اسکن و نوتیفای فوری/ }));

    // 2A. Verify 7-Day Jalali Radar strip renders and filters by day bucket cleanly
    expect(screen.getByText('رادار هوشمند ۷ روز آینده')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /فیلتر رادار امروز/ }));
    expect(screen.getByRole('button', { name: /نمایش همه روزها/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /نمایش همه روزها/ }));

    // 2B. Verify Multi-Select Bulk Triage mode (انتخاب گروهی -> انتخاب یک مورد -> تعویق ۱س گروهی -> خروج)
    fireEvent.click(screen.getByRole('button', { name: /انتخاب گروهی/ }));
    expect(screen.getByRole('button', { name: /^انتخاب همه$/ })).toBeTruthy();
    const cardCheckboxes = screen.getAllByRole('button', { name: /^انتخاب / });
    expect(cardCheckboxes.length).toBeGreaterThan(0);
    fireEvent.click(cardCheckboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: /تعویق ۱س گروهی/ }));
    const exitBulkBtn = screen.queryByRole('button', { name: /خروج از انتخاب گروهی/ });
    if (exitBulkBtn) fireEvent.click(exitBulkBtn);
    // Restore snoozed item from queue so subsequent checks stay well-populated
    fireEvent.click(screen.getByRole('tab', { name: /صف تعویق و انجام‌شده/ }));
    while (screen.queryAllByRole('button', { name: /لغو تعویق/ }).length > 0) {
      fireEvent.click(screen.queryAllByRole('button', { name: /لغو تعویق/ })[0]);
    }
    fireEvent.click(screen.getByRole('tab', { name: /آلارم‌های هوشمند/ }));

    // 3. Create a recurring custom reminder & verify 2-step delete confirmation
    fireEvent.click(screen.getByRole('button', { name: /یادآوری جدید/ }));
    const titleInput = screen.getByPlaceholderText(/پیگیری جواب CBCT/);
    fireEvent.change(titleInput, { target: { value: 'تست آلارم جراحی ایمپلنت' } });
    const recurrenceSelect = screen.getByLabelText('چرخه تکرار یادآوری') as HTMLSelectElement;
    fireEvent.change(recurrenceSelect, { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادآوری/ }));
    expect(screen.getByText('تست آلارم جراحی ایمپلنت')).toBeTruthy();

    fireEvent.click(screen.getByText('تست آلارم جراحی ایمپلنت'));
    fireEvent.click(screen.getByRole('button', { name: /حذف یادآوری سفارشی/ }));
    expect(screen.getByRole('button', { name: /تایید حذف/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /تایید حذف/ }));

    // 4. Switch to advance-days config tab -> update Lab Advance Days, Smart Automation Rules, Quiet Hours & Web Audio Chime
    fireEvent.click(screen.getByRole('tab', { name: /تنظیم روزهای پیش‌فرض یادآوری/ }));
    expect(screen.getByText(/پیگیری موعد دریافت کار لابراتوار/)).toBeTruthy();
    expect(screen.getByText(/فراخوان چکاپ دوره‌ای بیماران/)).toBeTruthy();
    expect(screen.getByText(/آستانه هشدار انقضای متریال انبار/)).toBeTruthy();
    expect(screen.getByText(/ساعات سکوت شبانه ارسال پیامک خودکار/)).toBeTruthy();
    expect(screen.getByText(/موتور قوانین خودکار هوشمند کلینیک/)).toBeTruthy();
    expect(screen.getByText(/هشدار صوتی آلارم‌های بحرانی/)).toBeTruthy();
    const soundToggleBtn = screen.getByRole('button', { name: 'تغییر وضعیت آلارم صوتی' });
    fireEvent.click(soundToggleBtn);
    expect(soundToggleBtn.textContent).toContain('خاموش');
    fireEvent.click(screen.getAllByRole('button', { name: /۳ روز قبل/ })[0]);
    const ruleBtns = screen.getAllByRole('button', { name: /فعال ✓/ });
    expect(ruleBtns.length).toBeGreaterThanOrEqual(5);
    fireEvent.click(ruleBtns[ruleBtns.length - 1]);
    expect(screen.getAllByRole('button', { name: 'غیرفعال' }).length).toBeGreaterThan(0);

    // 5. Switch to SMS Composer -> pick patient via quick selector & verify inputs populate; check delivery receipts in logs
    fireEvent.click(screen.getByRole('tab', { name: /ارسال پیامک و الگوها/ }));
    const patientSelect = screen.getByLabelText('انتخاب سریع بیمار برای ارسال پیامک') as HTMLSelectElement;
    fireEvent.change(patientSelect, { target: { value: INITIAL_PATIENTS[0].id } });
    const recipientInput = screen.getByPlaceholderText('مثلاً: علی مرادی') as HTMLInputElement;
    expect(recipientInput.value).toBe(INITIAL_PATIENTS[0].fullName);

    fireEvent.click(screen.getByRole('tab', { name: /گزارش ارسال‌ها/ }));
    expect(screen.getAllByText(/تحویل مخابرات ✓/).length).toBeGreaterThan(0);
    unmount();
  }, 15000);

  it('[MD-TST-15] interactive MarketingCampaignsView: verifies dynamic ROI, new campaign segment creation, and Manager PIN + 2-step delete confirmation', () => {
    localStorage.removeItem('minadental_marketing_campaigns_v1');

    // 1. Mount as non-manager: expand campaign -> shows قفل حذف مدیر & PIN prompt when clicked
    const { unmount: unmountStaff } = render(
      React.createElement(MarketingCampaignsView, {
        patients: INITIAL_PATIENTS,
        isManager: false
      })
    );
    expect(screen.getByText(/بازگشت سرمایه کمپین‌ها:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    const lockDelBtns = screen.getAllByRole('button', { name: /قفل حذف مدیر/ });
    expect(lockDelBtns.length).toBeGreaterThan(0);
    fireEvent.click(lockDelBtns[0]);
    expect(screen.getByLabelText('پین مدیر بازاریابی')).toBeTruthy();
    unmountStaff();

    // 2. Mount as manager: create campaign with segment -> expand -> 2-step delete confirmation
    const { unmount: unmountMgr } = render(
      React.createElement(MarketingCampaignsView, {
        patients: INITIAL_PATIENTS,
        isManager: true
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /کمپین جدید/ }));
    fireEvent.change(screen.getByPlaceholderText(/جشنواره ایمپلنت/), { target: { value: 'کمپین تست لمینت' } });
    const segmentSelect = screen.getByLabelText('گروه هدف کمپین') as HTMLSelectElement;
    fireEvent.change(segmentSelect, { target: { value: 'open_treatment' } });
    fireEvent.click(screen.getByRole('button', { name: /ذخیره و فعال‌سازی کمپین/ }));
    expect(screen.getByText('کمپین تست لمینت')).toBeTruthy();

    fireEvent.click(screen.getByText('کمپین تست لمینت'));
    const delBtns = screen.getAllByRole('button', { name: 'حذف' });
    fireEvent.click(delBtns[0]);
    const confirmDelBtn = screen.getByRole('button', { name: /تایید حذف/ });
    expect(confirmDelBtn).toBeTruthy();
    fireEvent.click(confirmDelBtn);
    expect(screen.queryByText('کمپین تست لمینت')).toBeNull();
    unmountMgr();
  });

  it('[MD-TST-03D] interactive Comprehensive Iranian Calendar: renders tri-calendar Solar/Gregorian/Hijri banner, cross-module day agenda (checks/lab/payments/recalls), weekly & 12-month yearly views, converter/follow-up tools, and monthly CSV export', () => {
    const todayStr = getCurrentPersianDate();
    const targetPatient = {
      ...INITIAL_PATIENTS[0],
      nextRecallDate: todayStr,
      recallMonths: 6,
      payments: [
        {
          id: 'pay-cal-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          amount: 4500000,
          date: todayStr,
          method: 'pos' as const,
          forTreatment: 'قسط اول کامپوزیت'
        }
      ],
      sayadChecks: [
        {
          id: 'chk-cal-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          sayadId: '1234567890123456',
          bankName: 'بانک ملت',
          amount: 12000000,
          dueDate: todayStr,
          drawerName: INITIAL_PATIENTS[0].fullName,
          status: 'in_collection' as const,
          isGuarantee: false
        }
      ],
      labOrders: [
        {
          id: 'lab-cal-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          toothNumber: 'UR6',
          workType: 'روکش زیرکونیا',
          labName: 'لابراتوار پارس',
          shade: 'A2',
          sendDate: todayStr,
          deliveryDate: todayStr,
          appointmentDate: todayStr,
          status: 'fabrication' as const,
          cost: 2500000,
          reminderNotice: ''
        }
      ]
    };

    const onOpenCheckModal = vi.fn();
    const onOpenLabModal = vi.fn();
    const onOpenPaymentModal = vi.fn();
    const onOpenPatientFile = vi.fn();

    const { unmount } = render(
      React.createElement(AppointmentsView, {
        appointments: INITIAL_APPOINTMENTS,
        patients: [targetPatient, ...INITIAL_PATIENTS.slice(1)],
        onAddAppointment: vi.fn(),
        onUpdateStatus: vi.fn(),
        onOpenCheckModal,
        onOpenLabModal,
        onOpenPaymentModal,
        onOpenPatientFile,
        onNavigateToModule: vi.fn(),
        initialViewMode: 'monthly',
        isManager: true
      })
    );

    // 1. Opened directly in 'monthly' (تقویم جامع ایرانی) mode: verify Year/Month selectors, Season/Leap badge, and Tri-Calendar Solar+Gregorian+Hijri display
    expect(screen.getByLabelText('انتخاب ماه تقویم جامع')).toBeTruthy();
    expect(screen.getByLabelText('انتخاب سال تقویم جامع')).toBeTruthy();
    expect(screen.getByText(/قمری:/)).toBeTruthy();
    expect(screen.getByText(/مانده تا نوروز:/)).toBeTruthy();

    // 2. Verify Cross-Module Omni-Agenda shows today's Sayad check, Lab order, Payment, & Periodic Recall
    expect(screen.getByText(/سررسید چک صیادی:/)).toBeTruthy();
    expect(screen.getByText(/تحویل لابراتوار:/)).toBeTruthy();
    expect(screen.getByText(/دریافتی مالی:/)).toBeTruthy();
    expect(screen.getByText(/سررسید ریکال و معاینه دوره‌ای:/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /\+ ثبت نوبت ریکال/ })).toBeTruthy();

    // 3. Test layer filtering: 'دریافتی مالی' & 'لابراتوار'
    fireEvent.click(screen.getByRole('button', { name: 'دریافتی مالی' }));
    expect(screen.getByText(/دریافتی مالی:/)).toBeTruthy();
    expect(screen.queryByText(/تحویل لابراتوار:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'لابراتوار' }));
    expect(screen.queryByText(/سررسید چک صیادی:/)).toBeNull();
    expect(screen.getByText(/تحویل لابراتوار:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'همه لایه‌ها' }));

    // 4. Open Tools Drawer -> Gregorian converter, +90d implant preset, & Monthly occasions digest
    fireEvent.click(screen.getByRole('button', { name: /مبدل تاریخ و مناسبت‌های ماه/ }));
    const gregInput = screen.getByLabelText('تاریخ میلادی برای تبدیل') as HTMLInputElement;
    fireEvent.change(gregInput, { target: { value: '2026-03-21' } });
    expect(screen.getByText(/پرش به ۱۴۰۵\/۰۱\/۰۱/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /\+۹۰ روز \(ایمپلنت\)/ }));
    expect(screen.getByText(/نتیجه دقیق:/)).toBeTruthy();
    expect(screen.getByText(/تقویم مناسبت‌ها و تعطیلات رسمی/)).toBeTruthy();

    // 5. Switch to 7-day Iranian Weekly View (Saturday to Friday), then 12-Month Yearly View
    fireEvent.click(screen.getByRole('button', { name: /نمای هفتگی/ }));
    expect(screen.getAllByText('شنبه').length).toBeGreaterThan(0);
    expect(screen.getAllByText('جمعه').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /نمای سالانه/ }));
    expect(screen.getAllByText('فروردین').length).toBeGreaterThan(0);
    expect(screen.getAllByText('اسفند').length).toBeGreaterThan(0);

    // 6. Monthly CSV Export button & inline reminder creation
    fireEvent.click(screen.getByRole('button', { name: /خروجی اکسل ماه/ }));
    expect(screen.getByText(/آماده شد/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ثبت یادآوری این روز/ }));
    const remInput = screen.getByLabelText('عنوان یادآوری در تقویم');
    fireEvent.change(remInput, { target: { value: 'پیگیری قالب ایمپلنت در تقویم' } });
    fireEvent.click(screen.getByRole('button', { name: /ذخیره یادآوری در تقویم/ }));
    expect(screen.getByText('پیگیری قالب ایمپلنت در تقویم')).toBeTruthy();

    // 7. Trigger 0-to-100 modal launcher callbacks directly from calendar
    fireEvent.click(screen.getByRole('button', { name: /ثبت چک صیادی/ }));
    expect(onOpenCheckModal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /ثبت دریافتی مالی/ }));
    expect(onOpenPaymentModal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /سفارش لابراتوار/ }));
    expect(onOpenLabModal).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('[MD-TST-04B] interactive TreatmentsView: renders 32-tooth Palmer arch, 4-phase ADA roadmap, live CDSS simulator, clinic triage queue, and clinical biomaterial protocols', () => {
    const onOpenPalmerChart = vi.fn();
    const onOpenPatientFile = vi.fn();
    const onUpdateTreatmentStatus = vi.fn();

    const patWithTreatmentAlerts = {
      ...INITIAL_PATIENTS[0],
      medicalHistory: ['سابقه فشار خون و بیماری قلبی', 'حساسیت به پنی‌سیلین'],
      teethConditions: {
        UR_6: {
          quadrant: 'UR' as const,
          toothNumber: 6,
          surfaces: ['occlusal' as const],
          treatment: 'crown_zirconia' as const,
          status: 'planned' as const,
          cost: 4800000,
          doctorName: 'دکتر مهدی امیری',
          vitalityMetrics: {
            coldTest: 'پالپیت غیرقابل‌برگشت' as const,
            percussion: 'مثبت (+)' as const,
            palpation: 'منفی (-)' as const,
            eptScore: '65/80'
          }
        }
      }
    };

    const { unmount } = render(
      React.createElement(TreatmentsView, {
        patients: [patWithTreatmentAlerts, ...INITIAL_PATIENTS.slice(1)],
        appointments: INITIAL_APPOINTMENTS,
        onOpenPalmerChart,
        onOpenPatientFile,
        onUpdateTreatmentStatus,
        isManager: true
      })
    );

    // 1. Renders sequencing alert + 4-phase roadmap + UR6 tooth quick button launching focused Palmer chart
    expect(screen.getByText(/تقدم درمان ریشه پیش از روکش دندان UR6/)).toBeTruthy();
    expect(screen.getByText(/فاز ۳ · بازسازی قطعی، پروتز و ایمپلنت/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /\+ چارت پالمر/ }));
    expect(onOpenPalmerChart).toHaveBeenCalledTimes(1);

    // 2. Inline status transition button triggers onUpdateTreatmentStatus
    fireEvent.click(screen.getByRole('button', { name: /^شروع$/ }));
    expect(onUpdateTreatmentStatus).toHaveBeenCalledWith(patWithTreatmentAlerts.id, 'UR_6', 'in_progress');

    // 3. Switch to CDSS Simulator tab -> verifies cardiac & allergy safety + AAE diagnosis + Ante's Law
    fireEvent.click(screen.getByRole('tab', { name: /هوش بالینی و ایمنی \(CDSS\)/ }));
    expect(screen.getByText(/سپر ایمنی سیستمیک و دوز حداکثر بی‌حسی/)).toBeTruthy();
    expect(screen.getAllByText(/کلیندامایسین/).length).toBeGreaterThan(0);
    expect(screen.getByText(/موتور تشخیص افتراقی AAE اندو، پریو و قانون Ante/)).toBeTruthy();

    // 4. Switch to Clinic Triage Queue tab & filter
    fireEvent.click(screen.getByRole('tab', { name: /صف درمان کلینیک/ }));
    expect(screen.getByText(/صف تریاژ درمان کل بیماران مطب/)).toBeTruthy();

    // 5. Switch to Protocols tab & switch procedure
    fireEvent.click(screen.getByRole('tab', { name: /پروتکل‌ها و متریال/ }));
    fireEvent.click(screen.getByRole('button', { name: /کاشت فیکسچر ایمپلنت/ }));
    expect(screen.getAllByText(/فیلد جراحی استریل/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('NaN');

    unmount();
  });

  it('[MD-TST-05B] bidirectional Lab & Implant modules: verifies linked Lab <-> Implant banners, real Jalali countdown/delay queues, lab settlements, and calendar triggers', () => {
    localStorage.removeItem('minadental_lab_settled_map_v1');
    const patLinked = {
      ...INITIAL_PATIENTS[0],
      implantCases: [
        {
          id: 'imp-sync-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          toothNumber: 'دندان ۶ پایین راست (LR6)',
          brand: 'اشترومن Straumann (BLX/SLA)',
          diameter: '4.1',
          length: '10',
          torque: 45,
          boneGraft: false,
          membrane: false,
          surgeryDate: '۱۴۰۵/۰۷/۰۱',
          healingDueDate: getRelativePersianDate(-3), // 3 days overdue relative to today
          currentStage: 'impression' as const,
          notes: 'آماده ارسال قالب'
        }
      ],
      labOrders: [
        {
          id: 'lab-sync-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          workType: 'روکش زیرکونیا ایمپلنت + اباتمنت',
          toothNumber: 'LR6',
          shade: 'A2',
          labName: 'لابراتوار دیجیتال پیشرو (دکتر کمالی)',
          sendDate: getRelativePersianDate(-4),
          deliveryDate: getRelativePersianDate(-1), // 1 day overdue
          appointmentDate: getRelativePersianDate(1),
          reminderNotice: '24_hours' as const,
          status: 'fabrication' as const,
          cost: 3500000,
          trackingSlipCode: 'SLIP-SYNC1'
        }
      ]
    };

    const onUpdateStatus = vi.fn();
    const onScheduleLabDelivery = vi.fn();
    const { unmount: unmountLab } = render(
      React.createElement(LabModuleView, {
        patients: [patLinked],
        onOpenPatientFile: vi.fn(),
        onAddLabOrder: vi.fn(),
        onUpdateStatus,
        onScheduleLabDelivery,
        isManager: true
      })
    );

    // 1. Expand order card -> shows linked Implant banner & 1-tap calendar button
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    expect(screen.getByText('کیس ایمپلنت متصل')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /نوبت در تقویم/ }));
    expect(onScheduleLabDelivery).toHaveBeenCalledTimes(1);

    // 2. Reminders tab -> shows live overdue queue & 1-tap clinic arrival button
    fireEvent.click(screen.getByRole('tab', { name: /تنظیم یادآوری و آلارم/ }));
    expect(screen.getByText('صف زنده موعد تحویل و تأخیر لابراتوارها')).toBeTruthy();
    expect(screen.getByText(/تأخیر ۱ روز - فوری/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /اعلام وصول مطب/ }));
    expect(onUpdateStatus).toHaveBeenCalledWith('lab-sync-1', 'ready_for_clinic');

    // 3. Settlements tab -> partial/full lab settlement
    fireEvent.click(screen.getByRole('tab', { name: /تسویه‌حساب مالی/ }));
    expect(screen.getByText(/کسر خودکار هزینه لابراتوار از کارکرد/)).toBeTruthy();
    const settleAllBtns = screen.getAllByRole('button', { name: /تسویه کامل/ });
    fireEvent.click(settleAllBtns[0]);
    expect(screen.getByText('✓ تسویه کامل')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    unmountLab();

    const onCreateLabOrderFromImplant = vi.fn();
    const { unmount: unmountImp } = render(
      React.createElement(ImplantModuleView, {
        patients: [patLinked],
        onOpenPatientFile: vi.fn(),
        onAdvanceStage: vi.fn(),
        onCreateLabOrderFromImplant,
        isManager: true
      })
    );

    // 4. Expand implant card -> shows linked Lab banner with slip code
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    expect(screen.getByText('لابراتوار متصل')).toBeTruthy();
    expect(screen.getByText('SLIP-SYNC1')).toBeTruthy();

    // 5. Reminders tab -> real Jalali overdue calculation (3 days overdue) + linked lab badge
    fireEvent.click(screen.getByRole('tab', { name: /تقویم و یادآوری مراحل/ }));
    expect(screen.getByText(/۳ روز تأخیر - پیگیری فوری/)).toBeTruthy();
    expect(screen.getByText(/لابراتوار: ۲\. در حال تراش CAD\/CAM/)).toBeTruthy();

    // 6. Prosthetics tab -> live synced implant lab order list
    fireEvent.click(screen.getByRole('tab', { name: /پروتز و لابراتوار روکش/ }));
    expect(screen.getByText(/سفارشات پروتز ایمپلنت در لابراتوار/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    unmountImp();
  });

  it('[MD-TST-06B] SettingsView control center: verifies tariff persistence, staff commission launcher, persisted backup schedule, real JSON/CSV export, and snapshot restore', () => {
    localStorage.removeItem('minadental_backup_snapshots_v1');
    localStorage.removeItem('minadental_backup_schedule_v1');

    const onOpenBackupModal = vi.fn();
    const onOpenCommissionModal = vi.fn();
    const onRestoreData = vi.fn();
    const managerUser = INITIAL_USERS.find((u) => u.role === 'admin') || INITIAL_USERS[0];

    const { unmount } = render(
      React.createElement(SettingsView, {
        currentUser: managerUser,
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        users: INITIAL_USERS,
        platforms: [],
        onOpenBackupModal,
        onOpenCommissionModal,
        onRestoreData
      })
    );

    // 1. Tariffs tab -> add new service
    fireEvent.click(screen.getByRole('tab', { name: /تعرفه‌های درمانی/ }));
    const tariffNameInput = screen.getByPlaceholderText('نام درمان (مثلاً ونیر کامپوزیت لبه انسیزال)...');
    fireEvent.change(tariffNameInput, { target: { value: 'ایمپلنت اشترومن سوئیسی تست' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت خدمت/ }));
    expect(screen.getByText('ایمپلنت اشترومن سوئیسی تست')).toBeTruthy();

    // 2. Staff tab -> Doctor commission rules summary & launcher
    fireEvent.click(screen.getByRole('tab', { name: /پرسنل و دسترسی/ }));
    expect(screen.getByText(/سهم‌بندی و فرمول تسویه پزشکان و مدیر کلینیک/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /مدیریت فرمول پورسانت پزشکان/ }));
    expect(onOpenCommissionModal).toHaveBeenCalledTimes(1);

    // 3. Cloud & Backup tab -> real scheduler, JSON backup snapshot, CSV export, restore, and Time-Machine modal
    fireEvent.click(screen.getByRole('tab', { name: /پشتیبان و دیتابیس ابری/ }));
    const timeInput = screen.getByLabelText('ساعت بک‌آپ خودکار روزانه') as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: '23:15' } });
    const savedSchedule = JSON.parse(localStorage.getItem('minadental_backup_schedule_v1') || '{}');
    expect(savedSchedule.backupTime).toBe('23:15');

    fireEvent.click(screen.getByRole('button', { name: /دانلود بک‌آپ لوکال/ }));
    const savedSnaps = JSON.parse(localStorage.getItem('minadental_backup_snapshots_v1') || '[]');
    expect(savedSnaps.length).toBe(1);
    expect(savedSnaps[0].patientsCount).toBe(INITIAL_PATIENTS.length);

    fireEvent.click(screen.getByRole('button', { name: /خروجی اکسل بیماران/ }));
    expect(screen.getAllByText(/خروجی اکسل لیست بیماران/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /بازیابی$/ }));
    expect(onRestoreData).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /باز کردن کنسول کامل بکاپ/ }));
    expect(onOpenBackupModal).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('NaN');

    unmount();
  });

  it('[MD-TST-07B] PatientBookingPortalModal closed->open transition and IncomingCallBanner 1-tap quick scheduling', () => {
    const onBookingConfirmed = vi.fn();
    const { rerender, unmount: unmountPortal } = render(
      React.createElement(PatientBookingPortalModal, {
        isOpen: false,
        onClose: vi.fn(),
        onBookingConfirmed,
        appointments: INITIAL_APPOINTMENTS,
        users: INITIAL_USERS
      })
    );

    // Re-rendering from closed -> open must not throw Rules-of-Hooks violation
    rerender(
      React.createElement(PatientBookingPortalModal, {
        isOpen: true,
        onClose: vi.fn(),
        onBookingConfirmed,
        appointments: INITIAL_APPOINTMENTS,
        users: INITIAL_USERS
      })
    );
    expect(screen.getByText(/پورتال نوبت‌دهی آنلاین اختصاصی بیمار/)).toBeTruthy();
    unmountPortal();

    // IncomingCallBanner quick slot & unknown caller handling
    const onScheduleAppointment = vi.fn();
    const onQuickAdmission = vi.fn();
    const { unmount: unmountCall } = render(
      React.createElement(IncomingCallBanner, {
        call: {
          id: 'call-dom-1',
          phoneNumber: '09120001122',
          timestamp: 'همین الان',
          matchedPatient: null
        },
        appointments: INITIAL_APPOINTMENTS,
        onClose: vi.fn(),
        onScheduleAppointment,
        onOpenPatientFile: vi.fn(),
        onQuickAdmission
      })
    );

    expect(screen.getByText('بیمار جدید')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'امروز ۱۷:۰۰' }));
    expect(onScheduleAppointment).toHaveBeenCalledWith(
      'بیمار جدید',
      '09120001122',
      'معاینه و تشکیل پرونده اولیه',
      '۱۷:۰۰',
      getCurrentPersianDate()
    );
    unmountCall();
  });

  it('[MD-TST-14B] interactive RemindersView Checks, Guarantee Check return custody, Installments, Debtors & policy thresholds', () => {
    localStorage.clear();

    const patGuaranteeReady = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-dom-guar',
      fullName: 'حسین رضایی ضمانتی',
      phone: '09123334455',
      balance: 0,
      totalCost: 12_000_000,
      paidAmount: 12_000_000,
      labOrders: [],
      implantCases: [],
      installments: [],
      sayadChecks: [
        {
          id: 'chk-dom-guar-1',
          patientId: 'pat-dom-guar',
          patientName: 'حسین رضایی ضمانتی',
          sayadId: '4455667788990011',
          bankName: 'بانک سامان',
          amount: 15_000_000,
          dueDate: getRelativePersianDate(3),
          drawerName: 'حسین رضایی ضمانتی',
          status: 'in_collection' as const,
          isGuarantee: true
        }
      ]
    };

    const patFinancialActive = {
      ...INITIAL_PATIENTS[0],
      id: 'pat-dom-fin',
      fullName: 'سارا محمدی اقساطی',
      phone: '09127778899',
      balance: -9_000_000,
      totalCost: 14_000_000,
      paidAmount: 5_000_000,
      labOrders: [],
      implantCases: [],
      installments: [
        {
          id: 'inst-dom-fin-1',
          patientId: 'pat-dom-fin',
          patientName: 'سارا محمدی اقساطی',
          treatmentName: 'ارتودنسی ثابت',
          installmentNumber: 2,
          totalInstallments: 4,
          amount: 3_000_000,
          dueDate: getRelativePersianDate(1),
          status: 'pending' as const,
          paymentMethod: 'check' as const
        }
      ],
      sayadChecks: [
        {
          id: 'chk-dom-sayad-1',
          patientId: 'pat-dom-fin',
          patientName: 'سارا محمدی اقساطی',
          sayadId: '1111222233334444',
          bankName: 'بانک ملت',
          amount: 3_000_000,
          dueDate: getRelativePersianDate(1),
          drawerName: 'سارا محمدی اقساطی',
          status: 'in_collection' as const,
          isGuarantee: false
        }
      ]
    };

    const onUpdateCheckStatus = vi.fn();
    const onPayInstallment = vi.fn();
    const onOpenAddPayment = vi.fn();
    const onNavigateToModule = vi.fn();

    const { unmount } = render(
      React.createElement(RemindersView, {
        patients: [patGuaranteeReady, patFinancialActive],
        appointments: [],
        inventory: [],
        onUpdateCheckStatus,
        onPayInstallment,
        onOpenAddPayment,
        onNavigateToModule
      })
    );

    // 1. Filter by Guarantee Check pill -> verify Ready-for-Return badge & 1-tap custody return callback
    fireEvent.click(screen.getByRole('button', { name: /چک ضمانت امانی/ }));
    expect(screen.getByText('آماده عودت لاشه ✓')).toBeTruthy();
    fireEvent.click(screen.getByText(/آماده عودت به بیمار/));
    fireEvent.click(screen.getByRole('button', { name: /ثبت تحویل لاشه ضمانت به بیمار ✓/ }));
    expect(onUpdateCheckStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chk-dom-guar-1', isGuarantee: true }),
      'returned'
    );

    // 2. Filter by Sayad Checks & Installments -> clear Sayad check & pay Installment in 1 tap
    fireEvent.click(screen.getByRole('button', { name: /چک صیادی و اقساط/ }));
    fireEvent.click(screen.getByText(/سررسید چک صیادی/));
    fireEvent.click(screen.getByRole('button', { name: /ثبت وصول چک ✓/ }));
    expect(onUpdateCheckStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chk-dom-sayad-1', isGuarantee: false }),
      'cleared'
    );

    fireEvent.click(screen.getByText(/سررسید قسط درمانی/));
    fireEvent.click(screen.getByRole('button', { name: /ثبت وصول قسط ✓/ }));
    expect(onPayInstallment).toHaveBeenCalledWith(expect.objectContaining({ id: 'inst-dom-fin-1' }));

    // 3. Filter Debtors -> launch payment modal directly
    fireEvent.click(screen.getByRole('button', { name: /بدهکاران مطب/ }));
    fireEvent.click(screen.getByText(/پیگیری بدهی به مطب/));
    fireEvent.click(screen.getByRole('button', { name: /ثبت دریافتی \/ تسویه بدهی ✓/ }));
    expect(onOpenAddPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 'pat-dom-fin' }));

    // 4. Switch to Config chip -> verify Guarantee advance days & Debtor minimum threshold controls
    fireEvent.click(screen.getByRole('tab', { name: /تنظیم روزهای پیش‌فرض یادآوری/ }));
    expect(screen.getByText(/چک‌های ضمانت امانی و عودت لاشه/)).toBeTruthy();
    expect(screen.getByText(/حداقل مانده بدهی برای نمایش آلارم مطب/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '۱۴ روز' }));
    expect(localStorage.getItem('minadental_guarantee_advance_days')).toBe('14');
    fireEvent.click(screen.getByRole('button', { name: 'بالای ۵م' }));
    expect(localStorage.getItem('minadental_debtor_min_alert_toman')).toBe('5000000');

    unmount();
    localStorage.clear();
  });

  it('[MD-TST-05C] interactive LabModuleView: 1-tap arrival & final cementation transitions, partner lab creation, and fuzzy search', () => {
    localStorage.clear();
    const onUpdateStatus = vi.fn();
    const patLab = {
      ...INITIAL_PATIENTS[0],
      labOrders: [
        {
          id: 'lab-1tap-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          workType: 'روکش تمام زیرکونیا',
          toothNumber: 'UR4',
          shade: 'A1',
          labName: 'لابراتوار دیجیتال پیشرو',
          sendDate: getRelativePersianDate(-3),
          deliveryDate: getRelativePersianDate(1),
          appointmentDate: getRelativePersianDate(2),
          reminderNotice: '24_hours' as const,
          status: 'fabrication' as const,
          cost: 2800000,
          trackingSlipCode: 'SLIP-LAB77'
        },
        {
          id: 'lab-1tap-2',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          workType: 'روکش پی‌اف‌ام',
          toothNumber: 'LL6',
          shade: 'A2',
          labName: 'لابراتوار دیجیتال پیشرو',
          sendDate: getRelativePersianDate(-5),
          deliveryDate: getRelativePersianDate(0),
          appointmentDate: getRelativePersianDate(1),
          reminderNotice: '24_hours' as const,
          status: 'ready_for_clinic' as const,
          cost: 1900000,
          trackingSlipCode: 'SLIP-LAB88'
        }
      ]
    };

    const { unmount } = render(
      React.createElement(LabModuleView, {
        patients: [patLab],
        onOpenPatientFile: vi.fn(),
        onAddLabOrder: vi.fn(),
        onUpdateStatus,
        isManager: true
      })
    );

    // 1. 1-tap arrival and 1-tap final delivery buttons work
    fireEvent.click(screen.getByRole('button', { name: /دریافت شد از لابراتوار ✓/ }));
    expect(onUpdateStatus).toHaveBeenCalledWith('lab-1tap-1', 'ready_for_clinic');
    fireEvent.click(screen.getByRole('button', { name: /تحویل و سمان به بیمار ✓/ }));
    expect(onUpdateStatus).toHaveBeenCalledWith('lab-1tap-2', 'delivered_cemented');

    // 2. Fuzzy search by slip code
    fireEvent.click(screen.getByRole('button', { name: 'جستجو در سفارشات' }));
    const searchInput = screen.getByLabelText('جستجوی لابراتوار یا کد قبض');
    fireEvent.change(searchInput, { target: { value: 'SLIP-LAB77' } });
    expect(screen.getByText(/روکش تمام زیرکونیا/)).toBeTruthy();
    expect(screen.queryByText(/روکش پی‌اف‌ام/)).toBeNull();
    fireEvent.change(searchInput, { target: { value: '' } });

    // 3. Switch to Partner Labs tab & create a new partner lab
    fireEvent.click(screen.getByRole('tab', { name: /تعریف لابراتوارها/ }));
    fireEvent.click(screen.getByRole('button', { name: /افزودن لابراتوار همکار/ }));
    fireEvent.change(screen.getByLabelText('نام لابراتوار همکار'), { target: { value: 'لابراتوار دیجیتال آزمایشی پارس' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت لابراتوار/ }));
    expect(screen.getByText('لابراتوار دیجیتال آزمایشی پارس')).toBeTruthy();

    unmount();
    localStorage.clear();
  });

  it('[MD-TST-06C] interactive ImplantModuleView & BOM deduction: CSSD sterile code surgical registration, BOM inventory deduction, and Misch biomechanics alert', () => {
    localStorage.clear();
    const surgicalInventory = [
      ...INITIAL_INVENTORY,
      {
        id: 'inv-mem-test',
        name: 'ممبرین کلاژن Bio-Gide 25x25',
        category: 'ایمپلنت و جراحی',
        stock: 4,
        unit: 'برگ استریل',
        minAlert: 2,
        expiryDate: getRelativePersianDate(300),
        pricePerUnit: 6200000
      }
    ];
    // 1. Direct BOM inventory deduction test for implant surgery
    const bomResult = inventoryConsumptionService.deductSuppliesForImplantSurgery(
      { brand: 'اشترومن Straumann (BLX/SLA)', boneGraft: true, membrane: true },
      surgicalInventory
    );
    expect(bomResult.deductedItems.some(d => d.itemName.includes('فیکسچر'))).toBe(true);
    expect(bomResult.deductedItems.some(d => d.itemName.includes('لیدوکائین') && d.amountDeducted === 2)).toBe(true);
    expect(bomResult.deductedItems.some(d => d.itemName.includes('پودر استخوان'))).toBe(true);
    expect(bomResult.deductedItems.some(d => d.itemName.includes('ممبرین'))).toBe(true);

    const onAddImplantCase = vi.fn();
    const { unmount } = render(
      React.createElement(ImplantModuleView, {
        patients: [INITIAL_PATIENTS[0]],
        inventory: surgicalInventory,
        onOpenPatientFile: vi.fn(),
        onAdvanceStage: vi.fn(),
        onAddImplantCase,
        isManager: true
      })
    );

    // 2. Open New Surgical Case modal -> enter CSSD sterile pack code -> 2-step confirm
    fireEvent.click(screen.getByRole('button', { name: /جراحی جدید/ }));
    expect(screen.getByText(/موجودی فیکسچر انبار:/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('کد پک استریل اتوکلاو یا لات فیکسچر'), {
      target: { value: 'CSSD-134-TEST' }
    });
    fireEvent.click(screen.getByRole('button', { name: /مرحله ۱: بررسی و ثبت جراحی/ }));
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت قطعی جراحی ✓/ }));
    expect(onAddImplantCase).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: INITIAL_PATIENTS[0].id,
        sterilePackCode: 'CSSD-134-TEST'
      })
    );

    // 3. Switch to Biomechanics tab -> test Misch cantilever overhang warning
    fireEvent.click(screen.getByRole('tab', { name: /بیومکانیک و فول‌آرک/ }));
    expect(screen.getByText(/پارامترهای هندسی و بیومکانیک کانتلیور پروتز/)).toBeTruthy();
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    expect(rangeInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(rangeInputs[1], { target: { value: '24' } });
    expect(screen.getByText(/هشدار شکست اهرم بیومکانیکی/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');

    unmount();
    localStorage.clear();
  });

  it('[MD-TST-11B] interactive InventoryView: creates new material in modal and executes +5 quick restock on low-stock item', () => {
    const lowStockItem = {
      ...INITIAL_INVENTORY[0],
      id: 'inv-low-dom-1',
      name: 'فیکسچر تست کمبود موجودی',
      stock: 1,
      minAlert: 3
    };
    const onUpdateStock = vi.fn();
    const onAddItem = vi.fn();

    const { unmount } = render(
      React.createElement(InventoryView, {
        inventory: [lowStockItem],
        onUpdateStock,
        onAddItem
      })
    );

    // 1. Expand item card -> click +5 quick restock
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    fireEvent.click(screen.getByRole('button', { name: /شارژ فوری \(\+۵\)/ }));
    expect(onUpdateStock).toHaveBeenCalledWith('inv-low-dom-1', 6);

    // 2. Open New Inventory Item modal -> fill & submit
    fireEvent.click(screen.getByRole('button', { name: /کالای جدید/ }));
    fireEvent.change(screen.getByLabelText('نام کالا یا متریال'), {
      target: { value: 'کامپوزیت نانو تست DOM' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ثبت در کاردکس انبار/ }));
    expect(onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'کامپوزیت نانو تست DOM' })
    );

    unmount();
  });

  it('[MD-TST-15B] interactive MarketingCampaignsView SMS outbox & SmsGatewaySettingsModal live dispatch', async () => {
    localStorage.clear();
    const creditBefore = clinicalSmsService.getSmsCredit();

    const { unmount } = render(
      React.createElement(MarketingCampaignsView, {
        patients: INITIAL_PATIENTS,
        isManager: true
      })
    );

    // 1. Switch to SMS & Outbox logs chip & send quick SMS to first patient
    fireEvent.click(screen.getByRole('tab', { name: /پیام و گزارش ارسال‌ها/ }));
    const smsTextInput = screen.getByLabelText('متن پیامک سریع');
    fireEvent.change(smsTextInput, { target: { value: 'تست ارسال پیامک کلینیک مینادنتال' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال پیامک/ }));

    // Await async dispatch and confirm delivery receipt appears in outbox logs
    const receipt = await screen.findByText(/تست ارسال پیامک کلینیک مینادنتال/);
    expect(receipt).toBeTruthy();
    const creditAfterQuick = clinicalSmsService.getSmsCredit();
    expect(creditAfterQuick).toBeLessThan(creditBefore);
    expect(clinicalSmsService.getLogs()[0]?.messageText).toContain('تست ارسال پیامک کلینیک مینادنتال');
    unmount();

    // 2. Verify SmsGatewaySettingsModal sends test SMS via clinicalSmsService and updates remaining credit
    const { unmount: unmountModal } = render(
      React.createElement(SmsGatewaySettingsModal, {
        isOpen: true,
        onClose: vi.fn()
      })
    );
    fireEvent.change(screen.getByLabelText('شماره موبایل گیرنده پیامک تست'), {
      target: { value: '09128889900' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ارسال تست/ }));
    const resultBox = await screen.findByText(/پیامک آزمایشی با موفقیت از خط/);
    expect(resultBox).toBeTruthy();
    expect(clinicalSmsService.getSmsCredit()).toBeLessThan(creditBefore);
    expect(clinicalSmsService.getLogs().some((l) => l.recipientMobile === '09128889900')).toBe(true);

    unmountModal();
    localStorage.clear();
  });

  it('[MD-TST-12B] interactive SterilizationModuleView: creates Prion-134C autoclave cycle, toggles biological spore test, searches normalized cycle code, and links pack to patient', () => {
    localStorage.clear();
    const onLinkPackToPatient = vi.fn();

    const { unmount } = render(
      React.createElement(SterilizationModuleView, {
        patients: INITIAL_PATIENTS,
        onLinkPackToPatient,
        onOpenPatientFile: vi.fn()
      })
    );

    // 1. Expand cycles & link first sterile barcode directly to patient
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /ثبت الصاق پک در پرونده/ })[0]);
    expect(onLinkPackToPatient).toHaveBeenCalledWith('AUT-1405-0842', INITIAL_PATIENTS[0].id);

    // 2. Toggle biological spore test status inside first cycle
    fireEvent.click(screen.getAllByRole('button', { name: /تست اسپور بیولوژیک: منفی و ایمن ✓/ })[0]);
    expect(screen.getByText(/در انتظار نتیجه ۲۴ ساعته اسپور ⏳/)).toBeTruthy();

    // 3. Create new Prion 134C autoclave cycle
    fireEvent.click(screen.getByRole('button', { name: /ثبت سیکل جدید/ }));
    fireEvent.change(screen.getByLabelText('برنامه سیکل استریل'), { target: { value: 'Prion-134C-18m' } });
    fireEvent.change(screen.getByLabelText('تعداد پک‌های داخل چمبر'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت سیکل و چاپ لیبل استریل/ }));
    expect(screen.getByText(/سیکل‌های اتوکلاو \(۳\)/)).toBeTruthy();

    // 4. Normalized Persian-digit search filter
    fireEvent.click(screen.getByRole('button', { name: 'جستجو در چرخه‌های استریل' }));
    fireEvent.change(screen.getByLabelText('جستجوی کد سیکل یا دستگاه اتوکلاو'), { target: { value: '۰۸۴۳' } });
    expect(screen.getByText('AUT-1405-0843')).toBeTruthy();
    expect(screen.queryByText('AUT-1405-0842')).toBeNull();

    unmount();
    localStorage.clear();
  });

  it('[MD-TST-13B] interactive XRayModuleView: creates new CBCT study in PACS, searches normalized records, and opens negatoscope controls', () => {
    localStorage.clear();
    const { unmount } = render(
      React.createElement(XRayModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn()
      })
    );

    // 1. Open new radiograph form & submit CBCT study
    fireEvent.click(screen.getByRole('button', { name: /ثبت گرافی/ }));
    fireEvent.change(screen.getByLabelText('نوع تصویربرداری'), { target: { value: 'CBCT (سه‌بعدی ایمپلنت)' } });
    fireEvent.change(screen.getByLabelText('ناحیه فک یا دندان'), { target: { value: 'فک بالا UR6 ایمپلنت تست' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت و آنالیز در PACS/ }));
    expect(screen.getByText(/همه گرافی‌ها \(۴\)/)).toBeTruthy();

    // 2. Open negatoscope AI/sliders drawer and invert contrast
    fireEvent.click(screen.getByRole('button', { name: /نگاتیو \/ کنتراست/ }));
    fireEvent.click(screen.getByRole('button', { name: /تنظیمات و هوش مصنوعی/ }));
    expect(screen.getByLabelText('روشنایی')).toBeTruthy();
    expect(screen.getByLabelText('کنتراست')).toBeTruthy();

    // 3. Normalized search in radiology records
    fireEvent.click(screen.getByRole('button', { name: 'جستجو در آرشیو گرافی‌ها' }));
    fireEvent.change(screen.getByLabelText('جستجو در کلیشه‌های رادیولوژی'), { target: { value: 'ایمپلنت تست' } });
    expect(screen.getByText(/کلیشه‌های آرشیوشده در پرونده بیماران \(۱\)/)).toBeTruthy();

    unmount();
    localStorage.clear();
  });

  it('[MD-TST-16B] interactive InsuranceClaimsView: calculates live franchise split, submits XML, and settles insurance share to ledger', () => {
    localStorage.clear();
    const onRecordInsurancePayment = vi.fn();
    const { unmount } = render(
      React.createElement(InsuranceClaimsView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onRecordInsurancePayment
      })
    );

    // 1. Create a new insurance claim & verify live franchise calculator preview
    fireEvent.click(screen.getByRole('tab', { name: /\+ صدور معرفی‌نامه جدید/ }));
    fireEvent.change(screen.getByLabelText('مبلغ کل تعرفه (تومان)'), { target: { value: '10000000' } });
    fireEvent.change(screen.getByLabelText('درصد فرانشیز سهم بیمار (%)'), { target: { value: '20' } });
    expect(screen.getByText(/پیش‌بینی سهم سازمان بیمه:/)).toBeTruthy();
    expect(screen.getByText(/۸[,٬]۰۰۰[,٬]۰۰۰/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ثبت حواله و استعلام آنلاین/ }));

    // 2. Expand newly added pending claim -> advance to XML -> mark settled
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    fireEvent.click(screen.getByRole('button', { name: /ارسال XML به سامانه بیمه/ }));
    const settleBtns = screen.getAllByRole('button', { name: /تایید واریز بیمه به حساب مطب/ });
    fireEvent.click(settleBtns[0]);
    expect(onRecordInsurancePayment).toHaveBeenCalledWith(
      INITIAL_PATIENTS[0].id,
      8000000,
      'بیمه دانا',
      expect.any(String)
    );

    unmount();
    localStorage.clear();
  });

  it('[MD-TST-17B] interactive AiAssistantView: switches ASA dosage profiles & receives patient-aware clinical AI guideline response', async () => {
    const patCardiac = {
      ...INITIAL_PATIENTS[0],
      medicalHistory: ['سابقه فشار خون و بیماری قلبی']
    };

    const { unmount } = render(
      React.createElement(AiAssistantView, {
        patients: [patCardiac],
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        onOpenPatientFile: vi.fn(),
        onNavigate: vi.fn(),
        onScheduleSmartAppointment: vi.fn()
      })
    );

    // 1. Verify patient warning pill & open ASA carpule dosage calculator
    expect(screen.getByText(/هشدار: سابقه فشار خون و بیماری قلبی/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /محاسبه‌گر هوشمند دوز کارپول/ }));
    fireEvent.click(screen.getByRole('button', { name: /^دیابت نوع ۲$/ }));
    expect(screen.getAllByText(/سقف: 3 کارپول/).length).toBeGreaterThan(0);

    // 2. Submit clinical query & verify response renders cleanly without NaN
    fireEvent.change(screen.getByLabelText('پرسش بالینی یا طرح درمان از هوش مصنوعی'), {
      target: { value: 'پروتکل بی‌حسی مناسب بیمار قلبی برای جراحی ایمپلنت' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پرسش بالینی به هوش مصنوعی' }));

    const answer = await screen.findByText(/تحلیل بالینی و گایدلاین هوشمند مینادنتال/);
    expect(answer).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');

    unmount();
  });

  it('[MD-TST-18B] interactive DoctorCommissionModal & BackupModal: switches payout models, saves verified rule, and executes triple backup integrity verification', () => {
    localStorage.clear();

    const { unmount: unmountComm } = render(
      React.createElement(DoctorCommissionModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS
      })
    );
    expect(screen.getByText(/سهم‌بندی کارکرد پزشکان و تراز مطب/)).toBeTruthy();
    const commSvg = document.querySelector('[data-testid="commission-d3-svg"]') as SVGElement;
    expect(commSvg).toBeTruthy();
    const docBars = commSvg.querySelectorAll('g');
    expect(docBars.length).toBe(3);
    fireEvent.click(docBars[1]); // click Sara Rezvani bar in D3 chart
    expect(screen.getAllByText(/نصف پس از کسر لابراتوار/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/۲\. دستمزد ثابت هر درمان/));
    expect(screen.getByLabelText('دستمزد ثابت هر واحد درمان')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ثبت و تأیید سهم‌بندی کارکرد/ }));
    expect(screen.getByText(/تنظیمات سهم‌بندی .* با دقت میلیونم ثبت گردید/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    unmountComm();

    const { unmount: unmountBackup } = render(
      React.createElement(BackupModal, {
        isOpen: true,
        onClose: vi.fn(),
        clinicName: 'کلینیک دندانپزشکی مینادنتال',
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        users: INITIAL_USERS,
        platforms: [],
        isManager: true,
        onRestoreData: vi.fn()
      })
    );
    expect(screen.getByText(/10⁻⁶ Exact/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /اجرای بکاپ همزمان سه‌گانه/ }));
    expect(screen.getByText(/پشتیبان‌گیری همزمان سه‌لایه .* با موفقیت اجرا شد/)).toBeTruthy();
    unmountBackup();

    localStorage.clear();
  });

  it('[MD-TST-19B] interactive Palmer hover preview card, ClinicalHudDrawer AI duration predictor, and InventoryView D3.js analytics tab', async () => {
    // 1. Palmer Chart Hover-State Preview Card (last 3 conditions + total tooth cost)
    const { unmount: unmountPalmer } = render(
      React.createElement(PalmerChartModal, {
        isOpen: true,
        onClose: vi.fn(),
        patientName: INITIAL_PATIENTS[0].fullName,
        patient: INITIAL_PATIENTS[0],
        patients: INITIAL_PATIENTS,
        teethConditions: INITIAL_PATIENTS[0].teethConditions,
        isManager: true,
        onSaveTreatment: vi.fn()
      })
    );

    const ur5Btn = document.querySelector('[data-tooth-id="UR_5"]') as HTMLElement;
    expect(ur5Btn).toBeTruthy();
    fireEvent.mouseEnter(ur5Btn);

    const hoverCard = document.querySelector('[data-testid="palmer-hover-preview"]') as HTMLElement;
    expect(hoverCard).toBeTruthy();
    expect(hoverCard.textContent).toContain('روکش تمام زیرکونیا');
    expect(hoverCard.textContent).toContain('ترمیم کامپوزیت');
    expect(hoverCard.textContent).toContain('عصب‌کشی');
    expect(hoverCard.textContent).toContain('۱۲,۶۰۰,۰۰۰ تومان');

    // Hover a healthy tooth with zero conditions
    const ul2Btn = document.querySelector('[data-tooth-id="UL_2"]') as HTMLElement;
    expect(ul2Btn).toBeTruthy();
    fireEvent.mouseEnter(ul2Btn);
    expect(document.querySelector('[data-testid="palmer-hover-preview"]')?.textContent).toContain('دندان سالم');
    expect(document.body.textContent).not.toContain('NaN');
    unmountPalmer();

    // 2. ClinicalHudDrawer AI-Driven Treatment Duration Predictor
    const { unmount: unmountHud } = render(
      React.createElement(ClinicalHudDrawer, {
        isOpen: true,
        onClose: vi.fn(),
        patient: INITIAL_PATIENTS[0],
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        onSelectPatient: vi.fn(),
        onOpenPatientFile: vi.fn(),
        onOpenPalmerChart: vi.fn(),
        onOpenPaymentModal: vi.fn()
      })
    );

    const predictorBox = document.querySelector('[data-testid="hud-duration-predictor"]') as HTMLElement;
    expect(predictorBox).toBeTruthy();
    expect(screen.getByText(/پیش‌بینی هوشمند زمان درمان/)).toBeTruthy();
    const treatSelect = screen.getByLabelText('انتخاب درمان برای پیش‌بینی زمان پایان') as HTMLSelectElement;
    const startInput = screen.getByLabelText('ساعت شروع نوبت') as HTMLInputElement;
    fireEvent.change(treatSelect, { target: { value: 'implant' } });
    fireEvent.change(startInput, { target: { value: '10:00' } });
    const endTimeBadge = document.querySelector('[data-testid="hud-predicted-end-time"]') as HTMLElement;
    expect(endTimeBadge.textContent).toMatch(/^[۰-۹]{2}:[۰-۹]{2}$/);
    expect(endTimeBadge.textContent).not.toBe('۱۰:۰۰');

    fireEvent.click(screen.getByRole('button', { name: /پیشنهاد جمنای/ }));
    expect(await screen.findByText(/تحلیل بالینی و گایدلاین هوشمند مینادنتال/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    unmountHud();

    // 3. InventoryView D3.js Inventory Analytics Tab
    const { unmount: unmountInv } = render(
      React.createElement(InventoryView, {
        inventory: INITIAL_INVENTORY,
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        onUpdateStock: vi.fn(),
        onAddItem: vi.fn(),
        onBatchUpdate: vi.fn(),
        isManager: true
      })
    );

    const analyticsTab = screen.getByRole('tab', { name: /تحلیل هوشمند انبار \(D3\)/ });
    fireEvent.click(analyticsTab);

    const analyticsRoot = document.querySelector('[data-testid="inventory-analytics-d3"]') as HTMLElement;
    expect(analyticsRoot).toBeTruthy();
    const lowStockSvg = document.querySelector('[data-testid="d3-low-stock-svg"]') as SVGElement;
    const costProcSvg = document.querySelector('[data-testid="d3-cost-procedure-svg"]') as SVGElement;
    expect(lowStockSvg).toBeTruthy();
    expect(costProcSvg).toBeTruthy();
    expect(lowStockSvg.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(costProcSvg.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(screen.getByText(/پیش‌بینی هوشمند تاریخ سفارش و شارژ مجدد انبار/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountInv();
  });

  it('[MD-TST-20B] verifies 360° Lab & Implant cross-module integrations with Financial, Palmer Chart, Patient File, and Smart Reminders', () => {
    const onOpenPatientFile = vi.fn();
    const onOpenPalmerChart = vi.fn();
    const onOpenPaymentModal = vi.fn();
    const onOpenCheckModal = vi.fn();
    const onNavigateToModule = vi.fn();

    // 1. LabModuleView Cross-Module Hub & Settlements Financial Clearance Ledger
    const { unmount: unmountLab } = render(
      React.createElement(LabModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile,
        onOpenPalmerChart,
        onOpenPaymentModal,
        onOpenCheckModal,
        onNavigateToModule,
        onAddLabOrder: vi.fn(),
        onUpdateStatus: vi.fn(),
        isManager: true
      })
    );

    // Expand first Lab order card
    const expandBtns = screen.getAllByRole('button', { name: /جزئیات/ });
    expect(expandBtns.length).toBeGreaterThan(0);
    fireEvent.click(expandBtns[0]);

    const labHub = document.querySelector('[data-testid="lab-cross-module-hub"]') as HTMLElement;
    expect(labHub).toBeTruthy();
    expect(labHub.textContent).toContain('میز یکپارچه مالی، پرونده، پالمر و یادآوری');

    fireEvent.click(screen.getAllByRole('button', { name: /دریافت وجه \/ تسویه \(POS\)/ })[0]);
    expect(onOpenPaymentModal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: /ثبت چک صیادی \/ ضمانت/ })[0]);
    expect(onOpenCheckModal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: /چارت پالمر/ })[0]);
    expect(onOpenPalmerChart).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: /پرونده مالی و اقساط/ })[0]);
    expect(onOpenPatientFile).toHaveBeenCalledWith(expect.any(Object), 'financial');

    fireEvent.click(screen.getAllByRole('button', { name: /ثبت یادآور هوشمند/ })[0]);
    expect(screen.getByText(/یادآور هوشمند تحویل/)).toBeTruthy();

    // Switch to Settlements tab & verify Patient Financial Clearance & Doctor Commission Lab Deduction Ledger
    fireEvent.click(screen.getByRole('tab', { name: /تسویه‌حساب مالی/ }));
    const clearanceLedger = document.querySelector('[data-testid="lab-patient-financial-clearance"]') as HTMLElement;
    expect(clearanceLedger).toBeTruthy();
    expect(clearanceLedger.textContent).toContain('سهم کسر از پزشک (۵۰٪)');
    expect(document.body.textContent).not.toContain('NaN');
    unmountLab();

    // 2. ImplantModuleView Cross-Module Hub & Prosthetics Bidirectional Sync
    const { unmount: unmountImp } = render(
      React.createElement(ImplantModuleView, {
        patients: INITIAL_PATIENTS,
        inventory: INITIAL_INVENTORY,
        onOpenPatientFile,
        onOpenPalmerChart,
        onOpenPaymentModal,
        onOpenCheckModal,
        onNavigateToModule,
        onAdvanceStage: vi.fn(),
        isManager: true
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));

    const impHub = document.querySelector('[data-testid="implant-cross-module-hub"]') as HTMLElement;
    expect(impHub).toBeTruthy();
    expect(impHub.textContent).toContain('میز یکپارچه مالی، چک ضمانت، پالمر و یادآوری ایمپلنت');

    fireEvent.click(screen.getAllByRole('button', { name: /دریافت وجه \/ قسط \(POS\)/ })[0]);
    expect(onOpenPaymentModal).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getAllByRole('button', { name: /ثبت در مرکز یادآوری/ })[0]);
    expect(screen.getByText(/یادآور هوشمند مرحله ایمپلنت/)).toBeTruthy();

    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountImp();
  });

  it('[MD-TST-21] Volumetric 3D Sculpted Dock & Module Logos: verifies all 32 3D icons and BottomDock render with 3D depth gradients, specular lighting, and zero clutter', () => {
    const logoEntries = Object.entries(ThreeDLogos).filter(([name]) => name.startsWith('Logo3D'));
    expect(logoEntries.length).toBeGreaterThanOrEqual(32);

    for (const [name, LogoComponent] of logoEntries) {
      const { container, unmount } = render(
        React.createElement(LogoComponent as React.FC<{ size?: number; className?: string }>, {
          size: 36,
          className: 'test-3d-logo'
        })
      );
      const svg = container.querySelector('svg');
      expect(svg, `Missing SVG for ${name}`).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 56 56');
      expect(container.querySelectorAll('linearGradient, radialGradient').length).toBeGreaterThan(0);
      expect(container.innerHTML).not.toContain('NaN');
      expect(container.innerHTML).not.toContain('undefined');
      unmount();
    }

    const { container: dockContainer, unmount: unmountDock } = render(
      React.createElement(BottomDock, {
        activeTab: 'home',
        onTabChange: vi.fn(),
        onOpenServicesMenu: vi.fn(),
        onOpenThumbZone: vi.fn()
      })
    );
    const dockSvgs = dockContainer.querySelectorAll('svg[viewBox="0 0 56 56"]');
    expect(dockSvgs.length).toBe(7);
    unmountDock();
  });

  it('[MD-TST-22] interactive LabModuleView 3D CAD/CAM Scan & Mesh Viewer (D3.js Engine): verifies 3D depth-sorted facets, shading modes, camera presets, exploded view, D3 thickness profile chart, and technician QC sign-off', () => {
    const onEditLabOrder = vi.fn();
    const onUpdateStatus = vi.fn();

    const { unmount } = render(
      React.createElement(LabModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onAddLabOrder: vi.fn(),
        onUpdateStatus,
        onEditLabOrder,
        isManager: true
      })
    );

    // 1. Click 1-tap 'اسکن سه‌بعدی (3D)' button on the first lab order card -> switches to 3D CAD/CAM viewer tab
    const scan3dButtons = screen.getAllByRole('button', { name: /اسکن سه‌بعدی \(3D\)/ });
    expect(scan3dButtons.length).toBeGreaterThan(0);
    fireEvent.click(scan3dButtons[0]);

    const viewerRoot = document.querySelector('[data-testid="lab-3d-model-viewer-d3"]') as HTMLElement;
    expect(viewerRoot).toBeTruthy();

    const svg3d = document.querySelector('[data-testid="lab-3d-viewer-svg"]') as SVGElement;
    expect(svg3d).toBeTruthy();

    const facetsGroup = document.querySelector('[data-testid="lab-3d-facets-group"]') as SVGGElement;
    expect(facetsGroup).toBeTruthy();
    expect(facetsGroup.querySelectorAll('path').length).toBeGreaterThan(100);

    const marginLine = document.querySelector('[data-testid="lab-3d-margin-line"]') as SVGGElement;
    expect(marginLine).toBeTruthy();

    const profileSvg = document.querySelector('[data-testid="lab-3d-thickness-profile-svg"]') as SVGElement;
    expect(profileSvg).toBeTruthy();

    // 2. Switch shading modes (D3 Heatmap, CAD Wireframe, X-Ray Cement Gap) and Camera Presets
    fireEvent.click(screen.getByRole('button', { name: 'هیت‌مپ ضخامت D3' }));
    fireEvent.click(screen.getByRole('button', { name: 'مش مثلثی CAD' }));
    fireEvent.click(screen.getByRole('button', { name: 'پرتو ایکس سمان' }));
    fireEvent.click(screen.getByRole('button', { name: 'اکلوزال (بالا)' }));
    fireEvent.click(screen.getByRole('button', { name: 'باکال (روبرو)' }));

    // 3. Adjust Exploded View separation slider & Cross-Section slicing slider
    const explodeSlider = screen.getByLabelText('نمای انفجاری تفکیک لایه‌های پروتز') as HTMLInputElement;
    fireEvent.change(explodeSlider, { target: { value: '65' } });
    expect(viewerRoot.textContent).toContain('۶۵٪');

    const sectionSlider = screen.getByLabelText('صفحه برش مقطعی مدل سه‌بعدی') as HTMLInputElement;
    fireEvent.change(sectionSlider, { target: { value: '10' } });

    // 4. Switch attached 3D file layers (Crown STL vs Intraoral Prep PLY)
    fireEvent.click(screen.getByRole('button', { name: /مش سه‌بعدی روکش نهایی/ }));
    fireEvent.click(screen.getByRole('button', { name: /مجموعه کامل روکش/ }));

    // 5. Technician QC Sign-off button
    fireEvent.click(screen.getByRole('button', { name: /تایید نهایی اسکن سه‌بعدی و ارسال به تراش CAD\/CAM/ }));
    expect(onEditLabOrder).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ qcPassed: true })
    );

    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmount();

    // 6. Mount ImplantModuleView & test 3D Implant Surgical Planner & ISQ Simulator (D3.js Engine)
    const onEditImplantCase = vi.fn();
    const { unmount: unmountImp } = render(
      React.createElement(ImplantModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onAdvanceStage: vi.fn(),
        onEditImplantCase,
        isManager: true
      })
    );

    fireEvent.click(screen.getByRole('tab', { name: /شبیه‌ساز سه‌بعدی جراحی/ }));
    const impPlannerRoot = document.querySelector('[data-testid="implant-3d-surgical-planner-d3"]') as HTMLElement;
    expect(impPlannerRoot).toBeTruthy();

    const impSvg3d = document.querySelector('[data-testid="implant-3d-planner-svg"]') as SVGElement;
    expect(impSvg3d).toBeTruthy();

    const isqChartSvg = document.querySelector('[data-testid="implant-3d-isq-chart-svg"]') as SVGElement;
    expect(isqChartSvg).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'هیت‌مپ تماس استخوان (BIC)' }));
    fireEvent.click(screen.getByRole('button', { name: 'مقطع CBCT پرتو ایکس' }));
    fireEvent.click(screen.getByRole('button', { name: /D1/ }));

    const tiltSlider = screen.getByLabelText('زاویه محور کاشت فیکسچر ایمپلنت') as HTMLInputElement;
    fireEvent.change(tiltSlider, { target: { value: '8' } });

    fireEvent.click(screen.getByRole('button', { name: /ثبت و قفل طرح جراحی سه‌بعدی در پرونده/ }));
    expect(onEditImplantCase).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ boneDensity: 'D1' })
    );

    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountImp();

    // 7. Mount XRayModuleView & test D3 Hounsfield Unit Profile + 3D CBCT & CAD/CAM Superimposition Studio
    const { unmount: unmountXray } = render(
      React.createElement(XRayModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn()
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /تنظیمات و هوش مصنوعی/ }));
    expect(document.querySelector('[data-testid="xray-d3-hu-profile-svg"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /استودیو سه‌بعدی CBCT و اسکن/ }));
    expect(document.querySelector('[data-testid="xray-3d-cbct-studio"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="implant-3d-planner-svg"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="lab-3d-viewer-svg"]')).toBeTruthy();

    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountXray();

    // 8. Mount SterilizationModuleView & test D3 Thermodynamic Telemetry + Smart Spore Reminder
    const { unmount: unmountCssd } = render(
      React.createElement(SterilizationModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn()
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /منحنی ترمودینامیک اتوکلاو/ }));
    expect(document.querySelector('[data-testid="cssd-d3-telemetry-svg"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادآور تست اسپور سیکل/ }));
    unmountCssd();

    // 9. Mount InsuranceClaimsView & test D3 Receivables Analytics + Smart Claim Reminder
    const { unmount: unmountIns } = render(
      React.createElement(InsuranceClaimsView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn()
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /تحلیل مطالبات و فرانشیز/ }));
    expect(document.querySelector('[data-testid="insurance-d3-analytics-svg"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادآور استعلام دیسک بیمه/ }));
    unmountIns();

    // 10. Mount MarketingCampaignsView & test D3 CRM ROI Funnel + Smart Recall Reminder
    const { unmount: unmountMkt } = render(
      React.createElement(MarketingCampaignsView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        isManager: true
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /قیف بازگشت سرمایه و جذب/ }));
    expect(document.querySelector('[data-testid="marketing-d3-roi-svg"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادآور اجرای فراخوان/ }));
    unmountMkt();

    // 11. Mount AiAssistantView & test D3 5-Axis Clinical Risk Radar + Smart Protocol Reminder
    const { unmount: unmountAi } = render(
      React.createElement(AiAssistantView, {
        patients: INITIAL_PATIENTS
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /رادار ریسک بالینی و دارویی/ }));
    expect(document.querySelector('[data-testid="ai-d3-risk-radar-svg"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادآور پایش ریسک بیمار/ }));
    unmountAi();
  });

  it('[MD-TST-23] verifies RemindersView & SettingsView D3.js analytics visualizations plus full root <App /> Happy-DOM navigation (Dashboard, BottomDock, ServicesSheet, Notifications, User Switcher)', async () => {
    localStorage.clear();

    // 1. RemindersView D3.js 11-Pillar Chart & interactive bar filter
    const { unmount: unmountRem } = render(
      React.createElement(RemindersView, {
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY
      })
    );
    const remSvg = document.querySelector('[data-testid="reminders-d3-pillar-svg"]') as SVGElement;
    expect(remSvg).toBeTruthy();
    expect(remSvg.querySelectorAll('rect').length).toBeGreaterThanOrEqual(9);
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountRem();

    // 2. SettingsView D3.js Data & Fleet Telemetry Chart
    const managerUser = INITIAL_USERS.find((u) => u.role === 'admin') || INITIAL_USERS[0];
    const { unmount: unmountSet } = render(
      React.createElement(SettingsView, {
        currentUser: managerUser,
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        users: INITIAL_USERS,
        platforms: []
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /پشتیبان و دیتابیس ابری/ }));
    const setSvg = document.querySelector('[data-testid="settings-d3-telemetry-svg"]') as SVGElement;
    expect(setSvg).toBeTruthy();
    expect(setSvg.querySelectorAll('rect').length).toBe(6);
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountSet();

    // 3. Full <App /> root Happy-DOM integration smoke test
    const { unmount: unmountApp } = render(React.createElement(App));
    expect(document.body.textContent).toContain('مینادنتال');

    // BottomDock navigation: Patients -> Financial -> Appointments -> Home
    const patientsDockBtn = screen.getByRole('button', { name: /^بیماران$/ });
    fireEvent.click(patientsDockBtn);
    expect(document.body.textContent).toContain('پرونده');

    const financialDockBtn = screen.getByRole('button', { name: /^مالی$/ });
    fireEvent.click(financialDockBtn);
    expect(document.body.textContent).toContain('صیادی');

    const homeDockBtn = screen.getByRole('button', { name: /^خانه$/ });
    fireEvent.click(homeDockBtn);
    expect(document.body.textContent).toContain('کاشت ایمپلنت');

    // Open 'کلیه خدمات کلینیک' ServicesSheet & navigate into Radiology module
    const servicesBtn = screen.getByRole('button', { name: /کلیه خدمات کلینیک/ });
    fireEvent.click(servicesBtn);
    expect(document.body.textContent).toContain('رادیولوژی OPG');
    const xrayTile = screen.getByText('رادیولوژی OPG');
    fireEvent.click(xrayTile);
    expect(await screen.findByText(/PACS|رادیولوژی/)).toBeTruthy();

    // Open NotificationDrawer bell
    const notifBtn = screen.getByRole('button', { name: /یادآوری‌ها و اعلان‌ها/ });
    fireEvent.click(notifBtn);

    // Open User Profile / Switcher
    const profileBtn = screen.getByRole('button', { name: /حساب کاربری/ });
    fireEvent.click(profileBtn);
    expect(document.body.textContent).toContain('مهدی امیری');

    expect(document.body.textContent).not.toContain('NaN');
    unmountApp();
  }, 15000);

  it('[MD-TST-24] verifies D3.js interactive charts in PatientsListView, TreatmentsView, AppointmentsView & FinancialView plus cross-module <App /> flows (QuickAdmission, Palmer, Lab, Implant)', async () => {
    localStorage.clear();

    // 1. PatientsListView D3 Cohort Funnel + 1-tap Reminder button on expanded card
    const { unmount: unmountPat } = render(
      React.createElement(PatientsListView, {
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        onOpenPatientFile: vi.fn(),
        onAddNewPatient: vi.fn(),
        isManager: true
      })
    );
    const patCohortSvg = document.querySelector('[data-testid="patients-d3-cohort-svg"]') as SVGElement;
    expect(patCohortSvg).toBeTruthy();
    const patBars = patCohortSvg.querySelectorAll('g');
    expect(patBars.length).toBe(7);
    fireEvent.click(patBars[1]); // click 'پیگیری مالی' bar
    fireEvent.click(patBars[0]); // reset to 'کل پرونده'
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه کارت‌ها/ }));
    const remButtons = screen.getAllByRole('button', { name: /ثبت یادآور/ });
    expect(remButtons.length).toBeGreaterThan(0);
    fireEvent.click(remButtons[0]);
    expect(document.body.textContent).not.toContain('NaN');
    unmountPat();

    // 2. TreatmentsView D3 4-Phase ADA Cost & Chair-Time Chart
    const onOpenPalmer = vi.fn();
    const { unmount: unmountTreat } = render(
      React.createElement(TreatmentsView, {
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        onOpenPalmerChart: onOpenPalmer,
        onOpenPatientFile: vi.fn(),
        isManager: true
      })
    );
    const treatPhasesSvg = document.querySelector('[data-testid="treatments-d3-phases-svg"]') as SVGElement;
    expect(treatPhasesSvg).toBeTruthy();
    const phaseBars = treatPhasesSvg.querySelectorAll('g');
    expect(phaseBars.length).toBe(4);
    fireEvent.click(phaseBars[0]);
    expect(onOpenPalmer).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('NaN');
    unmountTreat();

    // 3. AppointmentsView D3 Hourly Unit Load Chart (board + timeline)
    const { unmount: unmountApt } = render(
      React.createElement(AppointmentsView, {
        appointments: INITIAL_APPOINTMENTS,
        patients: INITIAL_PATIENTS,
        onAddAppointment: vi.fn(),
        onUpdateStatus: vi.fn(),
        isManager: true
      })
    );
    const aptLoadSvg = document.querySelector('[data-testid="appointments-d3-load-svg"]') as SVGElement;
    expect(aptLoadSvg).toBeTruthy();
    const hourBars = aptLoadSvg.querySelectorAll('g');
    expect(hourBars.length).toBe(12);
    fireEvent.click(screen.getByRole('tab', { name: /جدول ساعتی یونیت‌ها/ }));
    expect(document.querySelector('[data-testid="appointments-d3-load-svg"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    unmountApt();

    // 4. FinancialView D3 Overview + Sayad Check Maturity Distribution Chart
    const { unmount: unmountFin } = render(
      React.createElement(FinancialView, {
        patients: INITIAL_PATIENTS,
        onOpenCheckModal: vi.fn(),
        onOpenPatientFile: vi.fn(),
        isManager: true
      })
    );
    const finOverviewSvg = document.querySelector('[data-testid="financial-d3-overview-svg"]') as SVGElement;
    expect(finOverviewSvg).toBeTruthy();
    expect(finOverviewSvg.querySelectorAll('g').length).toBe(5);

    fireEvent.click(screen.getByRole('tab', { name: /چک صیادی/ }));
    const sayadSvg = document.querySelector('[data-testid="financial-d3-sayad-svg"]') as SVGElement;
    expect(sayadSvg).toBeTruthy();
    const sayadBars = sayadSvg.querySelectorAll('g');
    expect(sayadBars.length).toBe(6);
    fireEvent.click(sayadBars[0]); // filter overdue
    fireEvent.click(sayadBars[0]); // toggle back to all
    expect(document.body.textContent).not.toContain('NaN');
    unmountFin();

    // 5. Full <App /> Cross-Module Flows: Dashboard Hero Palmer Chart + Lab & Implant Tiles
    const { unmount: unmountApp2 } = render(React.createElement(App));
    fireEvent.click(screen.getByRole('button', { name: /چارت پالمر/ }));
    expect(document.body.textContent).toContain('چارت');

    const closePalmerBtn = screen.getByRole('button', { name: /بستن چارت پالمر/ });
    fireEvent.click(closePalmerBtn);

    // Launch Lab Module from Dashboard Tile
    fireEvent.click(screen.getByRole('button', { name: /^خانه$/ }));
    const labTileBtn = screen.getByRole('button', { name: /ورود به بخش لابراتوار پروتز/ });
    fireEvent.click(labTileBtn);
    expect(await screen.findByText(/لابراتوار پروتز و سرامیک/)).toBeTruthy();

    // Respect 240ms tile activation debounce before navigating to Implant Module
    await new Promise(resolve => setTimeout(resolve, 260));
    fireEvent.click(screen.getByRole('button', { name: /^خانه$/ }));
    const impTileBtn = screen.getByRole('button', { name: /ورود به بخش کاشت ایمپلنت/ });
    fireEvent.click(impTileBtn);
    expect(await screen.findByText(/کاشت ایمپلنت و جراحی/)).toBeTruthy();

    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
    unmountApp2();
  });

  it('[MD-TST-25] verifies Implant3DSurgicalPlannerD3 interactive 3D CBCT & ISQ curves plus RoleSwitcherModal RBAC staff provisioning', () => {
    localStorage.clear();

    // 1. ImplantModuleView -> 3D Surgical Planner (D3.js Engine)
    const { unmount: unmountImp } = render(
      React.createElement(ImplantModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onAddImplantCase: vi.fn(),
        onEditImplantCase: vi.fn(),
        onAdvanceStage: vi.fn(),
        onOpenPalmerChart: vi.fn(),
        onNavigateToModule: vi.fn()
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /شبیه‌ساز سه‌بعدی جراحی/ }));
    expect(document.querySelector('[data-testid="implant-3d-surgical-planner-d3"]')).toBeTruthy();
    const impSvg = document.querySelector('[data-testid="implant-3d-planner-svg"]') as SVGElement;
    expect(impSvg).toBeTruthy();
    expect(document.querySelector('[data-testid="implant-3d-facets-group"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="implant-3d-isq-chart-svg"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    unmountImp();

    // 2. RoleSwitcherModal RBAC: Manager adds new doctor with custom credentials & platform permissions
    const managerUser = INITIAL_USERS.find((u) => u.role === 'admin') || INITIAL_USERS[0];
    const onAddUser = vi.fn();
    const { unmount: unmountRole } = render(
      React.createElement(RoleSwitcherModal, {
        isOpen: true,
        onClose: vi.fn(),
        currentUser: managerUser,
        users: INITIAL_USERS,
        platforms: [],
        onSwitchUser: vi.fn(),
        onAddPlatform: vi.fn(),
        onAddUser
      })
    );
    expect(document.body.textContent).toContain('مهدی امیری');
    fireEvent.click(screen.getByRole('button', { name: /\+ پرسنل جدید/ }));
    fireEvent.change(screen.getByPlaceholderText('دکتر سارا حسینی'), {
      target: { value: 'دکتر نیما شریفی' }
    });
    fireEvent.change(screen.getByPlaceholderText('doctor@minadental.com'), {
      target: { value: 'nima@minadental.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('رمز عبور شخصی'), {
      target: { value: 'NimaPass#1405' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ثبت پرسنل و اعطای دسترسی به کلینیک/ }));
    expect(onAddUser).toHaveBeenCalledTimes(1);
    expect(onAddUser.mock.calls[0][0].fullName).toBe('دکتر نیما شریفی');
    unmountRole();
  });

  it('[MD-TST-26] verifies .dashboard-view .grid .tile corner quick-action icon buttons, brand-purple gradient surface, and isolated QuickAdmission launch', () => {
    const onNavigate = vi.fn();
    const { container, unmount } = render(
      React.createElement(DashboardView, {
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        onNavigate,
        onOpenPalmerChart: vi.fn(),
        onQuickAdmission: vi.fn(),
        todayAppointmentsCount: 6,
        activeSurgeriesCount: 2,
        readyLabOrdersCount: 3,
        dailyRevenue: 45000000
      })
    );

    // 1. Verify brand-purple gradient surface is applied to dashboard tiles
    const dashboardTiles = container.querySelectorAll('.dashboard-view .grid .tile');
    expect(dashboardTiles.length).toBeGreaterThanOrEqual(8);
    expect(container.innerHTML).toContain('#faf5ff');
    expect(container.innerHTML).toContain('#efe4ff');

    // 2. Verify corner quick-action icon buttons render with explicit type="button"
    const quickActionBtns = container.querySelectorAll('.tile-quick-action-btn');
    expect(quickActionBtns.length).toBeGreaterThanOrEqual(8);
    quickActionBtns.forEach((btn) => {
      expect(btn.getAttribute('type')).toBe('button');
    });

    // 3. Clicking the Patients tile corner quick-action button opens QuickAdmissionModal without navigating away
    const quickPatientBtn = screen.getByRole('button', { name: 'ثبت بیمار جدید' });
    expect(quickPatientBtn).toBeTruthy();
    fireEvent.click(quickPatientBtn);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    unmount();
  });

  it('[MD-TST-27] live end-to-end verification of completed Insurance, Sterilization, AI Assistant, and X-Ray modules plus URL route alias normalization', async () => {
    localStorage.clear();

    // 1. InsuranceClaimsView: create claim with custom serviceName, toothNumber & tariffCode + 2-step delete
    const onRecordInsurancePayment = vi.fn();
    const { unmount: unmountIns } = render(
      React.createElement(InsuranceClaimsView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn(),
        onRecordInsurancePayment
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: /\+ صدور معرفی‌نامه جدید/ }));
    fireEvent.change(screen.getByLabelText('شرح خدمت درمانی'), {
      target: { value: 'روکش زیرکونیا فول‌آناتومیک ایمپلنت' }
    });
    fireEvent.change(screen.getByLabelText('دندان پالمر بیمه'), {
      target: { value: 'LR6' }
    });
    fireEvent.change(screen.getByLabelText('کد تعرفه بیمه'), {
      target: { value: 'D6065-IR' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ثبت حواله و استعلام آنلاین/ }));
    expect(document.body.textContent).toContain('LR6');
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    expect(document.body.textContent).toContain('روکش زیرکونیا فول‌آناتومیک ایمپلنت');
    expect(document.body.textContent).toContain('D6065-IR');
    unmountIns();

    // 2. SterilizationModuleView: create cycle with custom packs + link sterile pack to patient traceability log
    const onLinkPackToPatient = vi.fn();
    const { unmount: unmountCssd } = render(
      React.createElement(SterilizationModuleView, {
        patients: INITIAL_PATIENTS,
        onLinkPackToPatient,
        onOpenPatientFile: vi.fn()
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /ثبت سیکل جدید/ }));
    fireEvent.change(screen.getByLabelText('فهرست ست‌ها و پک‌های استریل'), {
      target: { value: 'ست جراحی سینوس لیفت، هندپیس ایمپلنتولوژی' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ثبت سیکل و چاپ لیبل استریل/ }));
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    expect(document.body.textContent).toContain('ست جراحی سینوس لیفت');
    fireEvent.click(screen.getAllByRole('button', { name: /ثبت الصاق پک در پرونده/ })[0]);
    expect(onLinkPackToPatient).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('رهگیری بیماران استفاده‌کننده از این سیکل');
    unmountCssd();

    // 3. AiAssistantView: Palmer chart trigger, domain-specific implant consultation & persisted history
    const onOpenPalmerChart = vi.fn();
    const { unmount: unmountAi } = render(
      React.createElement(AiAssistantView, {
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        onOpenPatientFile: vi.fn(),
        onOpenPalmerChart,
        onNavigate: vi.fn()
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /چارت پالمر بیمار/ }));
    expect(onOpenPalmerChart).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('پرسش بالینی یا طرح درمان از هوش مصنوعی'), {
      target: { value: 'بررسی گشتاور تورک فیکسچر ایمپلنت در استخوان تیپ ۴ خلف ماگزیلا' }
    });
    fireEvent.click(screen.getByLabelText('ارسال پرسش بالینی به هوش مصنوعی'));
    expect(await screen.findByText(/پروتکل تخصصی جراحی ایمپلنت و مدیریت استخوان/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /تاریخچه \(۱\)/ })).toBeTruthy();
    unmountAi();

    // 4. XRayModuleView: upload study with bone density & custom findings, zoom/reset & edit clinical report
    const { unmount: unmountXray } = render(
      React.createElement(XRayModuleView, {
        patients: INITIAL_PATIENTS,
        onOpenPatientFile: vi.fn()
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /ثبت گرافی/ }));
    fireEvent.change(screen.getByLabelText('گزارش تشخیصی رادیوگرافی'), {
      target: { value: 'فاصله ایمن از کانال عصب مندیبولار ۳.۸ میلی‌متر تایید شد' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ثبت و آنالیز در PACS/ }));
    expect(document.body.textContent).toContain('فاصله ایمن از کانال عصب مندیبولار ۳.۸ میلی‌متر تایید شد');
    fireEvent.click(screen.getByRole('button', { name: /1x/ }));
    expect(screen.getByRole('button', { name: /1.5x/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ریست/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /تنظیمات و هوش مصنوعی/ }));
    fireEvent.click(screen.getByRole('button', { name: /ویرایش گزارش/ }));
    fireEvent.change(screen.getByLabelText('ویرایش گزارش تشخیصی رادیوگرافی'), {
      target: { value: 'گزارش نهایی پزشک: مناسب کاشت ایمپلنت بدون پیوند' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ذخیره گزارش/ }));
    expect(document.body.textContent).toContain('گزارش نهایی پزشک: مناسب کاشت ایمپلنت بدون پیوند');
    unmountXray();

    // 5. Verify root <App /> URL route alias normalization (?view=ai -> ai_assistant) renders real view, never blank
    const winAny = window as unknown as { happyDOM?: { setURL: (url: string) => void } };
    if (winAny.happyDOM?.setURL) {
      winAny.happyDOM.setURL('http://localhost:3000/?view=ai');
    } else {
      window.history.replaceState({}, '', '/?view=ai');
    }
    const { unmount: unmountAppAlias } = render(React.createElement(App));
    expect(await screen.findByText(/هوش مصنوعی و دستیار بالینی/)).toBeTruthy();
    if (winAny.happyDOM?.setURL) {
      winAny.happyDOM.setURL('http://localhost:3000/');
    } else {
      window.history.replaceState({}, '', '/');
    }
    unmountAppAlias();
  });

  it('[MD-TST-28] live E2E verification of DigitalLabPortalModal, PatientBookingPortalModal dynamic deposit/pregnancy, TreatmentInvoiceModal CSV/WhatsApp, SmsGatewaySettingsModal, and MarketingCampaignsView upgrades', () => {
    localStorage.clear();

    // 1. DigitalLabPortalModal: dynamic lab chip, search filter, Persian toast (no raw English enum)
    const onUpdateOrderStatus = vi.fn();
    const customLabPatient = {
      ...INITIAL_PATIENTS[0],
      labOrders: [
        {
          id: 'lab-portal-live-1',
          patientId: INITIAL_PATIENTS[0].id,
          patientName: INITIAL_PATIENTS[0].fullName,
          workType: 'روکش زیرکونیا دیجیتال',
          toothNumber: 'UL1',
          shade: 'BL2',
          labName: 'لابراتوار تخصصی نگین لبخند',
          sendDate: getCurrentPersianDate(),
          deliveryDate: getRelativePersianDate(3),
          appointmentDate: getRelativePersianDate(4),
          reminderNotice: '24_hours' as const,
          status: 'sent' as const,
          cost: 3400000
        }
      ]
    };
    const { unmount: unmountLabPortal } = render(
      React.createElement(DigitalLabPortalModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: [customLabPatient],
        onUpdateOrderStatus
      })
    );
    expect(screen.getByRole('button', { name: /لابراتوار تخصصی نگین لبخند/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /شروع ساخت \(CAD\/CAM\)/ }));
    expect(onUpdateOrderStatus).toHaveBeenCalledWith('lab-portal-live-1', 'fabrication');
    expect(document.body.textContent).toContain('در حال ساخت (CAD/CAM)');
    expect(document.body.textContent).not.toContain('«fabrication»');
    unmountLabPortal();

    // 2. PatientBookingPortalModal: dynamic service fee (350,000), pregnancy checkbox, validation & confirmation
    const onBookingConfirmed = vi.fn();
    const { unmount: unmountBooking } = render(
      React.createElement(PatientBookingPortalModal, {
        isOpen: true,
        onClose: vi.fn(),
        onBookingConfirmed,
        appointments: INITIAL_APPOINTMENTS
      })
    );
    fireEvent.click(screen.getByText('درمان ریشه تخصصی (اندو)'));
    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد: انتخاب روز و ساعت/ }));
    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد: سوابق سلامت و بیعانه/ }));
    expect(document.body.textContent).toContain('۳۵۰,۰۰۰ تومان');

    // Empty name/phone triggers validation error instead of booking
    fireEvent.click(screen.getByRole('button', { name: /پرداخت بیعانه و ثبت نهایی نوبت/ }));
    expect(screen.getByText(/لطفاً نام و نام خانوادگی و شماره همراه بیمار را وارد نمایید/)).toBeTruthy();
    expect(onBookingConfirmed).not.toHaveBeenCalled();

    // Fill contact details + check pregnancy + submit
    fireEvent.change(screen.getByPlaceholderText('مثال: کیان رادفر'), { target: { value: 'مریم کاظمی' } });
    fireEvent.change(screen.getByPlaceholderText('۰۹۱۲۳۴۵۶۷۸۹'), { target: { value: '۰۹۱۲۳۳۳۴۴۵۵' } });
    fireEvent.click(screen.getByText(/بارداری یا دوران شیردهی/));
    fireEvent.click(screen.getByRole('button', { name: /پرداخت بیعانه و ثبت نهایی نوبت/ }));

    expect(onBookingConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        patientName: 'مریم کاظمی',
        depositAmount: 350000,
        healthIntake: expect.objectContaining({ isPregnant: true })
      })
    );
    expect(screen.getByRole('button', { name: /کپی کد رهگیری/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /چاپ برگه پذیرش/ })).toBeTruthy();
    unmountBooking();

    // 3. TreatmentInvoiceModal: WhatsApp copy notice & CSV export button
    const { unmount: unmountInvoice } = render(
      React.createElement(TreatmentInvoiceModal, {
        isOpen: true,
        onClose: vi.fn(),
        patient: INITIAL_PATIENTS[0]
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /واتساپ/ }));
    expect(screen.getByText(/خلاصه صورتحساب برای ارسال به واتساپ بیمار کپی شد/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /CSV/ })).toBeTruthy();
    unmountInvoice();

    // 4. SmsGatewaySettingsModal: dynamic API key validation status
    const { unmount: unmountSms } = render(
      React.createElement(SmsGatewaySettingsModal, {
        isOpen: true,
        onClose: vi.fn()
      })
    );
    const apiInput = screen.getByLabelText('کلید اختصاصی وب‌سرویس پیامک');
    fireEvent.change(apiInput, { target: { value: '' } });
    expect(screen.getByText('نیاز به وارد کردن کلید')).toBeTruthy();
    fireEvent.change(apiInput, { target: { value: 'KVN-LIVE-99887766' } });
    expect(screen.getByText('اعتبارسنجی شده ✓')).toBeTruthy();
    unmountSms();

    // 5. MarketingCampaignsView: live SMS character counter, preview & active/pause toggle
    const { unmount: unmountMkt } = render(
      React.createElement(MarketingCampaignsView, {
        patients: INITIAL_PATIENTS,
        isManager: true
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /کمپین جدید/ }));
    expect(document.body.textContent).toContain('صفحه پیامک فارسی');
    expect(document.body.textContent).toContain('پیش‌نمایش زنده:');
    fireEvent.click(screen.getByRole('button', { name: /باز کردن همه/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /توقف موقت/ })[0]);
    expect(document.body.textContent).toContain('در حالت زمان‌بندی/توقف قرار گرفت');
    unmountMkt();

    // 6. LabPrescriptionModal: bright purple header & WhatsApp copy feedback
    const { unmount: unmountLabSlip } = render(
      React.createElement(LabPrescriptionModal, {
        isOpen: true,
        onClose: vi.fn(),
        order: customLabPatient.labOrders[0],
        patient: customLabPatient
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /واتساپ/ }));
    expect(screen.getByRole('button', { name: /کپی شد ✓/ })).toBeTruthy();
    unmountLabSlip();

    // 7. AddCheckModal: validates 16-digit Sayad ID before advancing to Step 2
    const { unmount: unmountCheck } = render(
      React.createElement(AddCheckModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS,
        onAddCheck: vi.fn()
      })
    );
    fireEvent.change(screen.getByPlaceholderText('شناسه ۱۶ رقمی چک صیاد'), {
      target: { value: '12345' }
    });
    fireEvent.click(screen.getByRole('button', { name: /مرحله ۱: بررسی و ثبت چک/ }));
    expect(screen.getByText(/شناسه صیاد باید دقیقاً ۱۶ رقم باشد/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('شناسه ۱۶ رقمی چک صیاد'), {
      target: { value: '7491839216485200' }
    });
    fireEvent.click(screen.getByRole('button', { name: /مرحله ۱: بررسی و ثبت چک/ }));
    expect(screen.getByRole('button', { name: /تایید و ثبت قطعی چک ✓/ })).toBeTruthy();
    unmountCheck();

    localStorage.clear();
  });

  it('[MD-TST-29] live E2E verification of AddPaymentModal receipt SMS & live balance, InstallmentPlanModal zero-drift rounding & Esfand clamp, QuickAdmissionModal age/gender/priority, and AddLabOrderModal technical fields', async () => {
    localStorage.clear();

    // 1. AddPaymentModal: validates amount <= 0, previews projected balance, sends accurate receipt SMS ('custom')
    const smsSpy = vi.spyOn(clinicalSmsService, 'sendPatternSms').mockResolvedValue({
      success: true,
      refId: 'SMS-RCPT-1405',
      message: 'پیامک رسید با موفقیت ارسال شد',
      remainingCredit: 1420
    });
    const onAddPayment = vi.fn();
    const { unmount: unmountPay } = render(
      React.createElement(AddPaymentModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS,
        onAddPayment,
        initialPatientId: INITIAL_PATIENTS[0].id
      })
    );
    expect(screen.getByText(/تراز پرونده پس از ثبت این پرداخت/)).toBeTruthy();

    // Zero amount blocks advancing to Step 2
    const amountInput = screen.getByLabelText('ورودی اطلاعات بالینی');
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /مرحله ۱: بررسی و ثبت دریافتی/ }));
    expect(screen.getByText(/لطفاً مبلغ پرداختی معتبر/)).toBeTruthy();

    // Valid amount advances to Step 2 and submits with actual receipt SMS
    fireEvent.change(amountInput, { target: { value: '2500000' } });
    fireEvent.click(screen.getByRole('button', { name: /مرحله ۱: بررسی و ثبت دریافتی/ }));
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت قطعی در صندوق ✓/ }));

    expect(onAddPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: INITIAL_PATIENTS[0].id,
        amount: 2500000
      })
    );
    expect(smsSpy).toHaveBeenCalledWith(
      INITIAL_PATIENTS[0].phone,
      INITIAL_PATIENTS[0].fullName,
      'custom',
      expect.objectContaining({
        customText: expect.stringContaining('رسید پرداخت کلینیک مینادنتال')
      })
    );
    unmountPay();

    // 2. InstallmentPlanModal: blocks remainingAmount <= 0, eliminates rounding drift, clamps Esfand day to 29
    const onSaveInstallmentPlan = vi.fn();
    const { unmount: unmountInst } = render(
      React.createElement(InstallmentPlanModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS,
        defaultPatientId: INITIAL_PATIENTS[0].id,
        onSaveInstallmentPlan
      })
    );

    const totalCostInput = screen.getByLabelText('هزینه کل درمان (تومان)');
    const downPaymentInput = screen.getByLabelText('پیش‌پرداخت نقدی / POS');
    const numInstSelect = screen.getByLabelText('تعداد اقساط ماهانه');
    const startMonthSelect = screen.getByLabelText('ماه اولین سررسید');
    const startDaySelect = screen.getByLabelText('روز سررسید هر ماه');

    // First test remainingAmount <= 0 validation
    fireEvent.change(totalCostInput, { target: { value: '10000000' } });
    fireEvent.change(downPaymentInput, { target: { value: '10000000' } });
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت برنامه اقساط در پرونده/ }));
    expect(screen.getByText(/مبلغ باقیمانده جهت تقسیط باید بیشتر از صفر باشد/)).toBeTruthy();
    expect(onSaveInstallmentPlan).not.toHaveBeenCalled();

    // Now test 10,000,000 / 3 installments starting month 12 (Esfand) day 30 -> exact sum 10,000,000 & day clamped to 29
    fireEvent.change(downPaymentInput, { target: { value: '0' } });
    fireEvent.change(numInstSelect, { target: { value: '3' } });
    fireEvent.change(startMonthSelect, { target: { value: '12' } });
    fireEvent.change(startDaySelect, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت برنامه اقساط در پرونده/ }));

    expect(onSaveInstallmentPlan).toHaveBeenCalledTimes(1);
    const savedInstallments = onSaveInstallmentPlan.mock.calls[0][1];
    expect(savedInstallments.length).toBe(3);
    const sumAmount = savedInstallments.reduce((acc: number, item: { amount: number }) => acc + item.amount, 0);
    expect(sumAmount).toBe(10000000);
    expect(savedInstallments[0].dueDate.endsWith('/۱۲/۲۹')).toBe(true);
    unmountInst();

    // 3. QuickAdmissionModal: persists custom age, gender, and emergency priority into Patient record
    const onPatientAdmitted = vi.fn();
    const { unmount: unmountAdm } = render(
      React.createElement(QuickAdmissionModal, {
        isOpen: true,
        onClose: vi.fn(),
        onPatientAdmitted
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'اورژانس' }));
    fireEvent.change(screen.getByPlaceholderText('مثال: مریم کریمی'), { target: { value: 'امیرحسین نوری' } });
    fireEvent.change(screen.getByLabelText('سن بیمار'), { target: { value: '47' } });
    fireEvent.change(screen.getByLabelText('جنسیت بیمار'), { target: { value: 'مرد' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت آنی و تشکیل پرونده/ }));

    expect(onPatientAdmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'امیرحسین نوری',
        age: 47,
        gender: 'مرد',
        totalCost: 0,
        medicalHistory: expect.arrayContaining(['اورژانس فوری']),
        notes: expect.stringContaining('[اورژانس فوری]')
      })
    );
    unmountAdm();

    // 4. AddLabOrderModal: persists stumpShade, marginType, courierName, and dentist technical instructions
    const onAddOrder = vi.fn();
    const { unmount: unmountLab } = render(
      React.createElement(AddLabOrderModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS,
        onAddOrder,
        initialPatientId: INITIAL_PATIENTS[0].id
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'ND4' }));
    fireEvent.change(screen.getByLabelText('نوع تراش مارجین'), { target: { value: 'Radial Shoulder' } });
    fireEvent.change(screen.getByLabelText('نام پیک لابراتوار'), { target: { value: 'آقای حسینی' } });
    fireEvent.change(screen.getByLabelText('دستورات تکنیکی لابراتوار'), {
      target: { value: 'کنتاکت پروگزیمال محکم و اوپک کردن پایه' }
    });
    fireEvent.click(screen.getByRole('button', { name: /مرحله ۱: بررسی و ارسال به لابراتوار/ }));
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت قطعی سفارش ✓/ }));

    expect(onAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        stumpShade: 'ND4',
        marginType: 'Radial Shoulder',
        courierName: 'آقای حسینی',
        instructions: 'کنتاکت پروگزیمال محکم و اوپک کردن پایه'
      })
    );
    unmountLab();

    localStorage.clear();
  });

  it('[MD-TST-30] live E2E verification of NotificationDrawer implant/unread filters, ServicesSheet normalized search & categories, GlobalCommandPalette bright UI & Palmer launch, IncomingCallBanner conflict-free slots & caller draft, and ClinicSessionLockOverlay validation', () => {
    localStorage.clear();

    // 1. NotificationDrawer: implant filter chip, per-tab counts, unread-only toggle, ringing bell
    const { unmount: unmountNotif } = render(
      React.createElement(NotificationDrawer, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        onNavigateToModule: vi.fn()
      })
    );
    const implantFilterBtn = screen.getByRole('button', { name: /ایمپلنت \(/ });
    expect(implantFilterBtn).toBeTruthy();
    fireEvent.click(implantFilterBtn);
    const unreadBtn = screen.getByRole('button', { name: 'فقط خوانده‌نشده' });
    fireEvent.click(unreadBtn);
    expect(unreadBtn.getAttribute('aria-pressed')).toBe('true');
    unmountNotif();

    // 2. ServicesSheet: case-insensitive English/Arabic search normalization, category filter & empty state reset
    const onNavService = vi.fn();
    const { unmount: unmountServices } = render(
      React.createElement(ServicesSheet, {
        isOpen: true,
        onClose: vi.fn(),
        onNavigate: onNavService,
        lowStockCount: 2
      })
    );
    const searchInput = screen.getByPlaceholderText(/جستجو در بخش‌ها/);
    fireEvent.change(searchInput, { target: { value: 'opg' } });
    expect(screen.getByText('رادیولوژی OPG')).toBeTruthy();
    fireEvent.change(searchInput, { target: { value: 'عبارت‌ناموجود۹۹۹' } });
    expect(screen.getByText(/ماژول یا خدمتی مطابق با/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'نمایش همه خدمات کلینیک' }));
    fireEvent.click(screen.getByRole('button', { name: 'مالی و بیمه' }));
    expect(screen.getByText('چک صیادی')).toBeTruthy();
    unmountServices();

    // 3. GlobalCommandPalette: bright theme, patient search + 1-tap Palmer chart secondary action
    const onOpenPalmer = vi.fn();
    const onSelectPat = vi.fn();
    const { unmount: unmountCmd } = render(
      React.createElement(GlobalCommandPalette, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        onSelectPatient: onSelectPat,
        onOpenPalmerChart: onOpenPalmer,
        onNavigate: vi.fn(),
        onQuickAdmission: vi.fn(),
        onOpenPaymentModal: vi.fn(),
        onOpenClinicalHud: vi.fn(),
        onOpenAccessibility: vi.fn()
      })
    );
    const cmdInput = screen.getByLabelText('جستجوی جامع کلینیک');
    fireEvent.change(cmdInput, { target: { value: INITIAL_PATIENTS[0].fullName.split(' ')[0] } });
    const palmerQuickBtns = screen.getAllByRole('button', { name: 'چارت پالمر' });
    expect(palmerQuickBtns.length).toBeGreaterThan(0);
    fireEvent.click(palmerQuickBtns[0]);
    expect(onOpenPalmer).toHaveBeenCalledWith(INITIAL_PATIENTS[0]);
    unmountCmd();

    // 4. IncomingCallBanner: conflict-free slot selection & inline caller name capture for unknown caller
    const todayStr = getCurrentPersianDate();
    const busyAppointments = [
      {
        ...INITIAL_APPOINTMENTS[0],
        id: 'apt-busy-17',
        date: todayStr,
        time: '۱۷:۰۰',
        status: 'scheduled' as const
      }
    ];
    const onScheduleCall = vi.fn();
    const { unmount: unmountCall } = render(
      React.createElement(IncomingCallBanner, {
        call: {
          id: 'call-live-new-1',
          phoneNumber: '۰۹۱۲۷۷۷۸۸۹۹',
          timestamp: '۱۶:۱۵',
          matchedPatient: null
        },
        appointments: busyAppointments,
        onClose: vi.fn(),
        onScheduleAppointment: onScheduleCall,
        onOpenPatientFile: vi.fn(),
        onQuickAdmission: vi.fn()
      })
    );
    // Since ۱۷:۰۰ is booked today, conflict-free slot must advance to ۱۷:۳۰
    const freeSlotBtn = screen.getByRole('button', { name: /امروز ۱۷:۳۰/ });
    expect(freeSlotBtn).toBeTruthy();
    fireEvent.change(screen.getByLabelText('نام تماس‌گیرنده جدید'), { target: { value: 'سعید رضایی' } });
    fireEvent.click(freeSlotBtn);
    expect(onScheduleCall).toHaveBeenCalledWith(
      'سعید رضایی',
      '۰۹۱۲۷۷۷۸۸۹۹',
      'معاینه و تشکیل پرونده اولیه',
      '۱۷:۳۰',
      todayStr
    );
    unmountCall();

    // 5. ClinicSessionLockOverlay: validates empty inputs before invoking onUnlock & supports staff quick-select
    const onUnlock = vi.fn().mockReturnValue({ ok: true });
    const { unmount: unmountLock } = render(
      React.createElement(ClinicSessionLockOverlay, {
        isLocked: true,
        users: INITIAL_USERS,
        onUnlock
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /احراز هویت و بازگشایی پنل/ }));
    expect(screen.getByText(/لطفاً ایمیل یا نام کاربری پرسنل را وارد نمایید/)).toBeTruthy();
    expect(onUnlock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('ایمیل یا نام کاربری'), { target: { value: 'mehdi.amiri19851364@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /احراز هویت و بازگشایی پنل/ }));
    expect(screen.getByText(/لطفاً کلمه عبور حساب کاربری خود را وارد نمایید/)).toBeTruthy();
    expect(onUnlock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('کلمه عبور'), { target: { value: 'clinic1405' } });
    fireEvent.click(screen.getByRole('button', { name: /احراز هویت و بازگشایی پنل/ }));
    expect(onUnlock).toHaveBeenCalledWith('mehdi.amiri19851364@gmail.com', 'clinic1405');
    unmountLock();

    localStorage.clear();
  });

  it('[MD-TST-31] live E2E verification of AccessibilityControlsModal reset & glove toggle, BatchStockModal validation & live projection, InventoryBarcodeModal deterministic bars & copies, OneHandedActionSheet RTL actions, and SupplierPurchaseOrderModal manual item & WhatsApp copy', () => {
    localStorage.clear();
    const originalPrint = window.print;
    const printSpy = vi.fn();
    Object.defineProperty(window, 'print', { value: printSpy, configurable: true, writable: true });

    try {
      // 1. AccessibilityControlsModal: glove toggle + reset to defaults
      const onThemeChange = vi.fn();
      const onFontScaleChange = vi.fn();
      const onGloveModeToggle = vi.fn();
      const { unmount: unmountA11y } = render(
        React.createElement(AccessibilityControlsModal, {
          isOpen: true,
          onClose: vi.fn(),
          onThemeChange,
          onFontScaleChange,
          onGloveModeToggle
        })
      );
      const gloveToggle = screen.getByRole('button', { name: 'تغییر حالت دستکش' });
      expect(gloveToggle.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(gloveToggle);
      expect(gloveToggle.getAttribute('aria-pressed')).toBe('true');
      expect(onGloveModeToggle).toHaveBeenCalledWith(true);

      fireEvent.click(screen.getByRole('button', { name: /بزرگ \(۱۱۵٪\)/ }));
      expect(onFontScaleChange).toHaveBeenCalledWith('large');

      fireEvent.click(screen.getByRole('button', { name: /بازنشانی/ }));
      expect(gloveToggle.getAttribute('aria-pressed')).toBe('false');
      expect(onThemeChange).toHaveBeenCalledWith('light');
      expect(onFontScaleChange).toHaveBeenCalledWith('normal');
      expect(onGloveModeToggle).toHaveBeenCalledWith(false);
      unmountA11y();

      // 2. BatchStockModal: rejects 0 in add mode, displays live projection preview, and submits valid stock delta
      const onApplyStockAdjustment = vi.fn();
      const sampleItems = INITIAL_INVENTORY.slice(0, 2);
      const { unmount: unmountBatch } = render(
        React.createElement(BatchStockModal, {
          isOpen: true,
          onClose: vi.fn(),
          selectedItems: sampleItems,
          onApplyStockAdjustment
        })
      );
      expect(screen.getByText('پیش‌نمایش موجودی پس از اعمال:')).toBeTruthy();
      const amountInput = screen.getByLabelText('ورودی اطلاعات بالینی') as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: /اعمال تغییرات موجودی/ }));
      expect(screen.getByText(/تعداد تغییر موجودی باید بزرگ‌تر از صفر باشد/)).toBeTruthy();
      expect(onApplyStockAdjustment).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /۱۰ عدد/ }));
      expect(screen.getAllByText(/←/).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: /اعمال تغییرات موجودی/ }));
      expect(onApplyStockAdjustment).toHaveBeenCalledWith('add', 10);
      unmountBatch();

      // 3. InventoryBarcodeModal: product-specific deterministic bars, location/stock metadata, copy-count selector & print toast
      const onShowToast = vi.fn();
      const testBarcodeItem = {
        ...INITIAL_INVENTORY[0],
        location: 'قفسه جراحی B2',
        barcode: '626099887766'
      };
      const { unmount: unmountBarcode } = render(
        React.createElement(InventoryBarcodeModal, {
          isOpen: true,
          onClose: vi.fn(),
          item: testBarcodeItem,
          onShowToast
        })
      );
      const barsEl = document.querySelector('[data-testid="inventory-barcode-bars"]') as HTMLElement;
      expect(barsEl).toBeTruthy();
      expect(barsEl.children.length).toBeGreaterThan(20);
      expect(screen.getByText('قفسه جراحی B2')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '۴ عدد' }));
      fireEvent.click(screen.getByRole('button', { name: /چاپ برچسب لیبل \(۴\)/ }));
      expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('آماده‌سازی چاپ ۴ عدد برچسب'));
      expect(printSpy).toHaveBeenCalledTimes(1);
      unmountBarcode();

      // 4. OneHandedActionSheet: RTL portal sheet, triggers Palmer callback & closes
      const onCloseSheet = vi.fn();
      const onOpenPalmerSheet = vi.fn();
      const { unmount: unmountSheet } = render(
        React.createElement(OneHandedActionSheet, {
          isOpen: true,
          onClose: onCloseSheet,
          onQuickAdmission: vi.fn(),
          onOpenAppointments: vi.fn(),
          onOpenPaymentModal: vi.fn(),
          onOpenClinicalHud: vi.fn(),
          onOpenPalmerChart: onOpenPalmerSheet,
          onOpenLabOrders: vi.fn()
        })
      );
      const sheetDialog = screen.getByRole('dialog', { name: 'منوی یک‌دستی شست' });
      expect(sheetDialog.getAttribute('dir')).toBe('rtl');
      fireEvent.click(screen.getByRole('button', { name: /چارت پالمر/ }));
      expect(onOpenPalmerSheet).toHaveBeenCalledTimes(1);
      expect(onCloseSheet).toHaveBeenCalledTimes(1);
      unmountSheet();

      // 5. SupplierPurchaseOrderModal: manual item addition, editable notes, WhatsApp copy confirmation
      const stockedInventory = INITIAL_INVENTORY.map((item) => ({
        ...item,
        stock: item.minAlert + 25
      }));
      const { unmount: unmountPo } = render(
        React.createElement(SupplierPurchaseOrderModal, {
          isOpen: true,
          onClose: vi.fn(),
          inventory: stockedInventory,
          onRestockReceived: vi.fn()
        })
      );
      fireEvent.click(screen.getByRole('button', { name: /افزودن کالا/ }));
      const notesInput = screen.getByLabelText('یادداشت سفارش خرید') as HTMLInputElement;
      fireEvent.change(notesInput, { target: { value: 'تحویل فوری با انقضای بالای ۲ سال' } });
      expect(notesInput.value).toBe('تحویل فوری با انقضای بالای ۲ سال');
      fireEvent.click(screen.getByRole('button', { name: 'کپی واتساپ' }));
      expect(screen.getByText('متن کامل پیش‌فاکتور جهت ارسال در واتساپ کپی شد ✓')).toBeTruthy();
      unmountPo();
    } finally {
      Object.defineProperty(window, 'print', { value: originalPrint, configurable: true, writable: true });
      localStorage.clear();
    }
  });

  it('[MD-TST-32] live E2E verification of RoleSwitcherModal assistant/phone/duplicate-guard/2-step delete, BackupModal persisted snapshot log & manager restore lock, DoctorCommissionModal presets & WhatsApp slip copy, InventoryQrScannerModal GS1 editable price, and UniversalClinicScannerModal quick stock deltas', () => {
    localStorage.clear();

    // 1. RoleSwitcherModal: assistant role, phone capture, duplicate email guard, and 2-step delete confirmation
    const managerUser = INITIAL_USERS.find((u) => u.role === 'admin') || INITIAL_USERS[0];
    const nonAdminUser = INITIAL_USERS.find((u) => u.role !== 'admin') || INITIAL_USERS[1];
    const onAddUser = vi.fn();
    const onDeleteUser = vi.fn();
    const { unmount: unmountRole } = render(
      React.createElement(RoleSwitcherModal, {
        isOpen: true,
        onClose: vi.fn(),
        currentUser: managerUser,
        users: INITIAL_USERS,
        platforms: [],
        onSwitchUser: vi.fn(),
        onAddPlatform: vi.fn(),
        onAddUser,
        onDeleteUser
      })
    );

    // 2-step delete confirmation prevents accidental 1-click deletion
    fireEvent.click(screen.getByRole('button', { name: `بایگانی حساب ${nonAdminUser.fullName}` }));
    expect(onDeleteUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'تایید حذف' }));
    expect(onDeleteUser).toHaveBeenCalledWith(nonAdminUser.id);

    // Duplicate email rejected before creating new staff
    fireEvent.click(screen.getByRole('button', { name: /\+ پرسنل جدید/ }));
    fireEvent.change(screen.getByPlaceholderText('دکتر سارا حسینی'), { target: { value: 'دستیار تکراری' } });
    fireEvent.change(screen.getByPlaceholderText('doctor@minadental.com'), { target: { value: managerUser.email || '' } });
    fireEvent.change(screen.getByPlaceholderText('رمز عبور شخصی'), { target: { value: 'Pass#1405' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت پرسنل و اعطای دسترسی به کلینیک/ }));
    expect(screen.getByText(/کاربری با این ایمیل یا نام کاربری قبلاً در سیستم ثبت شده است/)).toBeTruthy();
    expect(onAddUser).not.toHaveBeenCalled();

    // Valid assistant creation with mobile number
    fireEvent.change(screen.getByLabelText('نقش سازمانی'), { target: { value: 'assistant' } });
    fireEvent.change(screen.getByPlaceholderText('دکتر سارا حسینی'), { target: { value: 'مریم شاکری' } });
    fireEvent.change(screen.getByPlaceholderText('doctor@minadental.com'), { target: { value: 'assistant.maryam@minadental.com' } });
    fireEvent.change(screen.getByLabelText('شماره موبایل پرسنل جدید'), { target: { value: '09123334455' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت پرسنل و اعطای دسترسی به کلینیک/ }));
    expect(onAddUser).toHaveBeenCalledTimes(1);
    expect(onAddUser.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        fullName: 'مریم شاکری',
        role: 'assistant',
        phone: '09123334455'
      })
    );
    unmountRole();

    // 2. BackupModal: persisted history log on triple backup + non-manager restore lock indicator
    const { unmount: unmountBackup } = render(
      React.createElement(BackupModal, {
        isOpen: true,
        onClose: vi.fn(),
        clinicName: 'کلینیک دندانپزشکی مینادنتال',
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        users: INITIAL_USERS,
        platforms: [],
        isManager: false
      })
    );
    expect(screen.getByText('فقط مدیر کلینیک')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /اجرای بکاپ همزمان سه‌گانه/ }));
    expect(screen.getByText(/تاریخچه آخرین پشتیبان‌گیری‌های ثبت‌شده/)).toBeTruthy();
    expect(screen.getByText('بکاپ سه‌لایه همزمان')).toBeTruthy();
    unmountBackup();

    // 3. DoctorCommissionModal: quick percentage preset & WhatsApp settlement slip copy
    const { unmount: unmountComm } = render(
      React.createElement(DoctorCommissionModal, {
        isOpen: true,
        onClose: vi.fn(),
        patients: INITIAL_PATIENTS
      })
    );
    fireEvent.click(screen.getByRole('button', { name: '۶۵٪' }));
    fireEvent.click(screen.getByRole('button', { name: /کپی فیش واتساپ/ }));
    expect(screen.getByText(/جهت ارسال در واتساپ کپی شد ✓/)).toBeTruthy();
    unmountComm();

    // 4. InventoryQrScannerModal: real GS1-128 barcode input extraction + editable unit price registration
    const onRegisterScannedProduct = vi.fn();
    const { unmount: unmountQr } = render(
      React.createElement(InventoryQrScannerModal, {
        isOpen: true,
        onClose: vi.fn(),
        inventory: INITIAL_INVENTORY,
        onUpdateStock: vi.fn(),
        onRegisterScannedProduct,
        onShowToast: vi.fn()
      })
    );
    const qrInput = screen.getByLabelText('ورود کد بارکد یا QR') as HTMLInputElement;
    fireEvent.change(qrInput, { target: { value: '(01)00707387786521(17)280630(10)LOT3M99' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت' }));
    const priceInput = screen.getByLabelText('بهای واحد محصول استخراج‌شده') as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '1850000' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت در انبار/ }));
    expect(onRegisterScannedProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        pricePerUnit: 1850000
      })
    );
    unmountQr();

    // 5. UniversalClinicScannerModal: real inventory barcode scan + quick +5 stock delta button
    const onUpdateInventoryStock = vi.fn();
    const firstInv = INITIAL_INVENTORY[0];
    const { unmount: unmountUni } = render(
      React.createElement(UniversalClinicScannerModal, {
        isOpen: true,
        onClose: vi.fn(),
        scope: 'all',
        patients: INITIAL_PATIENTS,
        inventory: INITIAL_INVENTORY,
        onUpdateInventoryStock,
        onShowToast: vi.fn()
      })
    );
    const uniInput = screen.getByLabelText('ورود کد بارکد یا QR') as HTMLInputElement;
    fireEvent.change(uniInput, { target: { value: firstInv.barcode || firstInv.id } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت' }));
    fireEvent.click(screen.getByRole('button', { name: 'بسته (+۵)' }));
    fireEvent.click(screen.getByRole('button', { name: /ثبت موجودی/ }));
    expect(onUpdateInventoryStock).toHaveBeenCalledWith(firstInv.id, firstInv.stock + 5);
    unmountUni();

    localStorage.clear();
  });
});





