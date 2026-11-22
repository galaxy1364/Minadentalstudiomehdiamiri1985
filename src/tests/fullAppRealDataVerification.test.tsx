// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, screen, within, cleanup, waitFor } from '@testing-library/react';
import App from '../App';
import { SettingsView } from '../components/views/SettingsView';
import { INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY } from '../data/mockData';
import { INITIAL_USERS } from '../services/syncEngine';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MD-FULL-APP: End-to-End Real-Data Verification Across Every Mounted Capability', () => {
  it('[MD-FULL-01] mounts root <App />, navigates all 5 BottomDock primary tabs + ServicesSheet all secondary views & modals with zero crashes/NaN/undefined', async () => {
    const { container } = render(React.createElement(App));

    // 1. Dashboard (Home) loads cleanly with Persian branding, hero, header controls, and BottomDock
    expect(container.textContent).toContain('مینادنتال');
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('undefined');

    // 2. Navigate all 5 primary BottomDock tabs
    const dockTabs = ['بیماران', 'درمان', 'مالی', 'نوبت‌ها', 'خانه'];
    for (const tabLabel of dockTabs) {
      const btn = screen.getByRole('button', { name: tabLabel });
      fireEvent.click(btn);
      expect(container.textContent?.length || 0).toBeGreaterThan(50);
      expect(container.textContent, `Dock tab ${tabLabel} leaked NaN`).not.toContain('NaN');
      expect(container.textContent, `Dock tab ${tabLabel} leaked undefined`).not.toContain('undefined');
    }

    // 3. Open ServicesSheet ("خدمات") and verify navigation to every secondary module (eager & lazy)
    const secondaryRoutes: Array<{ tileLabel: string; expectedText: RegExp }> = [
      { tileLabel: 'کاشت ایمپلنت', expectedText: /ایمپلنت/ },
      { tileLabel: 'لابراتوار پروتز', expectedText: /لابراتوار/ },
      { tileLabel: 'چک صیادی', expectedText: /چک صیادی|صیادی/ },
      { tileLabel: 'اقساط درمانی', expectedText: /اقساط/ },
      { tileLabel: 'چک ضمانت', expectedText: /ضمانت|مالی/ },
      { tileLabel: 'انبار و متریال', expectedText: /انبار|متریال|موجودی/ },
      { tileLabel: 'پیامک و یادآوری', expectedText: /یادآوری/ },
      { tileLabel: 'رادیولوژی OPG', expectedText: /CBCT|OPG|رادیولوژی/ },
      { tileLabel: 'تبلیغات و کمپین‌ها', expectedText: /کمپین|تبلیغات/ },
      { tileLabel: 'استریلیزاسیون و اتوکلاو', expectedText: /اتوکلاو|استریل/ },
      { tileLabel: 'بیمه پایه و تکمیلی', expectedText: /بیمه/ },
      { tileLabel: 'هوش مصنوعی', expectedText: /هوش مصنوعی/ },
      { tileLabel: 'تنظیمات کلینیک', expectedText: /تعرفه‌ها|تنظیمات/ },
    ];

    for (const route of secondaryRoutes) {
      const servicesBtn = screen.getByRole('button', { name: 'کلیه خدمات کلینیک' });
      fireEvent.click(servicesBtn);
      const servicesDialog = screen.getByRole('dialog', { name: 'همه ماژول‌ها و خدمات کلینیک' });
      expect(servicesDialog).toBeTruthy();

      const tileEl = within(servicesDialog).getByText(route.tileLabel);
      fireEvent.click(tileEl);

      await waitFor(
        () => {
          const text = container.textContent || '';
          expect(text, `Module ${route.tileLabel} missing expected content`).toMatch(route.expectedText);
          expect(text, `Module ${route.tileLabel} leaked NaN`).not.toContain('NaN');
          expect(text, `Module ${route.tileLabel} leaked undefined`).not.toContain('undefined');
        },
        { timeout: 4000 }
      );
    }

    // 4. Verify interactive modal launchers from ServicesSheet: Palmer Chart, Doctor Commissions, Online Booking, Digital Lab, SMS Gateway
    const modalLaunchers: Array<{ tileLabel: string; expectedDialogText: RegExp }> = [
      { tileLabel: 'چارت دندانی پالمر', expectedDialogText: /پالمر|انتخاب بیمار فعال/ },
      { tileLabel: 'سهم‌بندی پزشکان', expectedDialogText: /سهم‌بندی|پزشک|درصد/ },
      { tileLabel: 'نوبت‌دهی آنلاین بیمار', expectedDialogText: /نوبت‌دهی آنلاین|پورتال/ },
      { tileLabel: 'پورتال همکار لابراتوار', expectedDialogText: /لابراتوار|پورتال/ },
      { tileLabel: 'تنظیمات پیامک خدماتی', expectedDialogText: /پیامک|کاوه‌نگار|پنل/ },
    ];

    for (const modalCase of modalLaunchers) {
      const servicesBtn = screen.getByRole('button', { name: 'کلیه خدمات کلینیک' });
      fireEvent.click(servicesBtn);
      const servicesDialog = screen.getByRole('dialog', { name: 'همه ماژول‌ها و خدمات کلینیک' });
      fireEvent.click(within(servicesDialog).getByText(modalCase.tileLabel));

      await waitFor(
        () => {
          expect(document.body.textContent || '', `Modal ${modalCase.tileLabel} failed to open`).toMatch(
            modalCase.expectedDialogText
          );
        },
        { timeout: 3000 }
      );
      // Close via Escape key (tests useEscapeKey accessibility across every modal!)
      fireEvent.keyDown(window, { key: 'Escape' });
    }
  }, 30000);

  it('[MD-FULL-02] executes complete real-data clinic workflow inside mounted <App />: Patient Admission -> Palmer Treatment -> Financial Debtor -> Caller-ID -> Notifications -> Role Switcher -> Manager Settings Cloud & Audit', async () => {
    render(React.createElement(App));

    // 1. Go to Patients tab and admit a brand new REAL patient ("بهرام نادری")
    fireEvent.click(screen.getByRole('button', { name: 'بیماران' }));
    const newPatientBtn = screen.getByRole('button', { name: /پذیرش جدید/ });
    fireEvent.click(newPatientBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();

    const fullNameInput = within(dialog).getByPlaceholderText('مثال: سارا ابراهیمی');
    fireEvent.change(fullNameInput, { target: { value: 'بهرام نادری' } });

    const phoneInput = within(dialog).getByPlaceholderText('۰۹۱۲۳۴۵۶۷۸۹');
    fireEvent.change(phoneInput, { target: { value: '09124455667' } });

    const submitBtn = within(dialog).getByRole('button', { name: /تشکیل پرونده و صدور شماره/ });
    fireEvent.click(submitBtn);

    // Verify new real patient is immediately visible in list AND persisted to localStorage (debounced)!
    await waitFor(() => {
      expect(screen.getAllByText('بهرام نادری').length).toBeGreaterThan(0);
      expect(localStorage.getItem('minadental_patients') || '').toContain('بهرام نادری');
    }, { timeout: 4000 });

    // 2. Open Palmer Chart from ServicesSheet, select "بهرام نادری", record an Endo treatment & verify cost/balance update!
    fireEvent.click(screen.getByRole('button', { name: 'کلیه خدمات کلینیک' }));
    const servicesDialog = screen.getByRole('dialog', { name: 'همه ماژول‌ها و خدمات کلینیک' });
    fireEvent.click(within(servicesDialog).getByText('چارت دندانی پالمر'));

    const patSwitcher = await screen.findByLabelText('انتخاب بیمار فعال در چارت پالمر');
    const savedPatients = JSON.parse(localStorage.getItem('minadental_patients') || '[]');
    const bahram = savedPatients.find((p: { fullName: string }) => p.fullName === 'بهرام نادری');
    expect(bahram).toBeTruthy();
    fireEvent.change(patSwitcher, { target: { value: bahram.id } });

    fireEvent.click(screen.getByRole('button', { name: 'عصب‌کشی (اندو)' }));
    fireEvent.click(screen.getByRole('button', { name: 'تکمیل شده' }));
    fireEvent.click(screen.getByRole('button', { name: /ثبت درمان در پرونده و چارت پالمر/ }));
    fireEvent.click(screen.getByRole('button', { name: /تایید و ثبت قطعی در چارت/ }));

    // Verify patient's totalCost increased > 0 and balance became negative (canonical MinaDental debt)
    await waitFor(() => {
      const updated = JSON.parse(localStorage.getItem('minadental_patients') || '[]');
      const updatedBahram = updated.find((p: { id: string }) => p.id === bahram.id);
      expect(updatedBahram.totalCost).toBeGreaterThan(0);
      expect(updatedBahram.balance).toBe(-updatedBahram.totalCost);
    });

    // 3. Open Financial View -> verify "بهرام نادری" immediately appears in Debtors list!
    fireEvent.click(screen.getByRole('button', { name: 'مالی' }));
    await waitFor(() => {
      expect(screen.getAllByText('بهرام نادری').length).toBeGreaterThan(0);
    });

    // 4. Trigger AppHeader Notification Drawer (sliding bell), Role Switcher (User Profile), and Caller-ID banner!
    const notifBtn = screen.getByRole('button', { name: /یادآوری‌ها و اعلان‌ها/ });
    fireEvent.click(notifBtn);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/اعلان|یادآور|مرکز/);
    });
    fireEvent.keyDown(window, { key: 'Escape' });

    const profileBtn = screen.getByRole('button', { name: /حساب کاربری/ });
    fireEvent.click(profileBtn);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/مهدی امیری|تغییر کاربر|مدیریت حساب|پرسنل/);
    });
    fireEvent.keyDown(window, { key: 'Escape' });

    const callerIdBtn = screen.getByRole('button', { name: 'کالرآیدی و تماس ورودی' });
    fireEvent.click(callerIdBtn);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/تماس ورودی|ثبت نوبت|پذیرش/);
    });

    // 5. Verify Manager-level SettingsView Cloud Live SSE Sync & Immutable Server Audit Trail panels render cleanly
    cleanup();
    const manager = INITIAL_USERS.find((u) => u.role === 'admin')!;
    render(
      React.createElement(SettingsView, {
        currentUser: manager,
        patients: INITIAL_PATIENTS,
        appointments: INITIAL_APPOINTMENTS,
        inventory: INITIAL_INVENTORY,
        users: INITIAL_USERS,
        clinicDataMode: 'demo_seeded',
      })
    );

    const cloudTab = screen.getByRole('tab', { name: /ابری|بکاپ|همگام‌سازی/ });
    fireEvent.click(cloudTab);
    expect(document.body.textContent).toContain('همگام‌سازی زنده چنددستگاهی (SSE)');
    expect(document.body.textContent).toContain('شروع دیتای واقعی مطب');

    const auditTab = screen.getByRole('tab', { name: /امنیت|لاگ|ممیزی/ });
    fireEvent.click(auditTab);
    expect(document.body.textContent).toContain('لاگ امنیتی تغییرناپذیر سرور');
  }, 30000);
});
