// @vitest-environment node
/**
 * [MD-TST-34] Real-World 2-Device Clinic User Simulation & Authoritative SSE Live Sync E2E
 * Simulates real clinic operation between:
 *  - Device A: Reception Secretary (آیفون/سیستم پذیرش)
 *  - Device B: Dr. Mehdi Amiri (یونیت جراحی / آیپد پزشک)
 * Verifies:
 *  1. RBAC Manager lock on switching to live_production mode (403 for non-manager)
 *  2. Clean start (live_production mode clears sample patients/appointments while keeping inventory)
 *  3. Real concurrent HTTP SSE streams across 2 devices with live presence count
 *  4. Real patient admission + appointment booking on Device A -> instant SSE broadcast to Device B (no self-echo)
 *  5. Palmer treatment + Implant surgery + Lab order on Device B -> instant SSE broadcast back to Device A
 *  6. Payment + 16-digit Sayad check + Inventory deduction + exact 10^-6 commission ledger math
 *  7. Full Express server restart persistence against isolated atomic JSON disk store (zero data loss)
 */

import { describe, it, expect } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createMinaDentalServer } from '../../server';
import { INITIAL_INVENTORY } from '../data/mockData';
import { validateIranianNationalCode, validateSayadCheckId } from '../utils/validators';
import { computeDoctorWorkCommissionLedger } from '../utils/accountingEngine';
import type { Patient, Appointment } from '../types/dental';

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function openSseClient(baseUrl: string, clientId: string): Promise<{
  events: SseEvent[];
  waitForEvent: (eventName: string, predicate?: (data: Record<string, unknown>) => boolean, timeoutMs?: number) => Promise<SseEvent>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const events: SseEvent[] = [];
    const waiters: Array<{
      eventName: string;
      predicate?: (data: Record<string, unknown>) => boolean;
      resolve: (ev: SseEvent) => void;
    }> = [];

    const req = http.get(`${baseUrl}/api/clinic/stream?clientId=${encodeURIComponent(clientId)}`, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE failed with HTTP ${res.statusCode}`));
        return;
      }

      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        let idx = buffer.indexOf('\n\n');
        while (idx !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf('\n\n');

          if (!frame.trim() || frame.startsWith(':')) continue;
          let eventName = 'message';
          let dataStr = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr) as Record<string, unknown>;
            const ev: SseEvent = { event: eventName, data: parsed };
            events.push(ev);
            for (let i = waiters.length - 1; i >= 0; i--) {
              const w = waiters[i];
              if (w.eventName === ev.event && (!w.predicate || w.predicate(ev.data))) {
                waiters.splice(i, 1);
                w.resolve(ev);
              }
            }
          } catch {
            // ignore non-JSON frames
          }
        }
      });

      resolve({
        events,
        waitForEvent: (eventName, predicate, timeoutMs = 4000) => {
          const existing = events.find((e) => e.event === eventName && (!predicate || predicate(e.data)));
          if (existing) return Promise.resolve(existing);
          return new Promise<SseEvent>((resWait, rejWait) => {
            const timer = setTimeout(() => {
              rejWait(new Error(`Timed out waiting for SSE event "${eventName}" on ${clientId}`));
            }, timeoutMs);
            waiters.push({
              eventName,
              predicate,
              resolve: (ev) => {
                clearTimeout(timer);
                resWait(ev);
              },
            });
          });
        },
        close: () => {
          req.destroy();
          res.destroy();
        },
      });
    });

    req.on('error', reject);
  });
}

describe('[MD-TST-34] Real-World 2-Device Clinic User Simulation & Multi-Device Live Sync E2E', () => {
  it('completes full real patient admission -> 2-device live SSE sync -> treatment/implant/lab -> payment/check -> server restart persistence', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minadental-live-e2e-'));
    const storeFile = path.join(tmpDir, 'clinic-live-store.json');

    const app1 = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });

    const server1 = await new Promise<http.Server>((resolve) => {
      const s = app1.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port1 = (server1.address() as AddressInfo).port;
    const baseUrl1 = `http://127.0.0.1:${port1}`;

    let devSecretary: Awaited<ReturnType<typeof openSseClient>> | null = null;
    let devDoctor: Awaited<ReturnType<typeof openSseClient>> | null = null;

    try {
      // 1. RBAC Verification: Non-manager cannot wipe demo data to live_production
      const forbiddenRes = await fetch(`${baseUrl1}/api/clinic/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-secretary-01',
          actorName: 'منشی پذیرش',
          isManager: false,
          mode: 'live_production',
          preserveInventory: true,
        }),
      });
      expect(forbiddenRes.status).toBe(403);

      // 2. Manager activates Clean Real-Clinic Production Mode while preserving clinic inventory
      const modeRes = await fetch(`${baseUrl1}/api/clinic/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-doctor-amiri',
          actorName: 'دکتر مهدی امیری',
          isManager: true,
          mode: 'live_production',
          preserveInventory: true,
          inventory: INITIAL_INVENTORY,
        }),
      });
      expect(modeRes.status).toBe(200);
      const modeJson = (await modeRes.json()) as { ok: boolean; mode: string; revision: number };
      expect(modeJson.ok).toBe(true);
      expect(modeJson.mode).toBe('live_production');
      expect(modeJson.revision).toBe(1);

      // 3. Connect 2 Real Clinic Devices concurrently via SSE
      devSecretary = await openSseClient(baseUrl1, 'dev-secretary-01');
      await devSecretary.waitForEvent('connected');

      devDoctor = await openSseClient(baseUrl1, 'dev-doctor-amiri');
      const doctorConnEv = await devDoctor.waitForEvent('connected');
      expect(Number(doctorConnEv.data.connectedClients)).toBe(2);

      // 4. Device A (Secretary) admits real patient «فرهاد کریمی» & books chair appointment
      const validNationalId = '0013542419';
      expect(validateIranianNationalCode(validNationalId)).toBe(true);

      const realPatient: Patient = {
        id: 'pat-real-farhad-2001',
        fileNumber: 'D-2001',
        fullName: 'فرهاد کریمی',
        nationalId: validNationalId,
        phone: '09124445566',
        age: 38,
        gender: 'مرد',
        medicalHistory: ['حساسیت به پنی‌سیلین'],
        totalCost: 0,
        paidAmount: 0,
        balance: 0,
        activeTreatmentsCount: 0,
        lastVisit: '1404/05/12',
        teethConditions: {},
        treatments: [],
        sayadChecks: [],
        installments: [],
        labOrders: [],
        implantCases: [],
        payments: [],
        notes: 'پذیرش واقعی توسط منشی پذیرش',
      };

      const realApt: Appointment = {
        id: 'apt-real-2001',
        patientId: realPatient.id,
        patientName: realPatient.fullName,
        phone: realPatient.phone,
        date: '1404/05/12',
        time: '10:30',
        durationMinutes: 45,
        treatment: 'جراحی ایمپلنت دندان ۶ بالا راست (UR_6)',
        doctor: 'دکتر مهدی امیری',
        unit: 'یونیت آبی',
        status: 'scheduled',
      };

      const sync1PromiseOnDoctor = devDoctor.waitForEvent(
        'clinic-sync',
        (d) => d.revision === 2
      );

      const sync1Res = await fetch(`${baseUrl1}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-secretary-01',
          actorName: 'خانم رضایی (منشی)',
          actorRole: 'secretary',
          baseRevision: 1,
          mode: 'live_production',
          patients: [realPatient],
          appointments: [realApt],
          inventory: INITIAL_INVENTORY,
        }),
      });
      expect(sync1Res.status).toBe(200);

      // Verify Device B (Doctor) receives instant SSE update with Farhad Karimi
      const doctorSyncFrame = await sync1PromiseOnDoctor;
      const syncedPatientsOnDoctor = doctorSyncFrame.data.patients as Patient[];
      expect(syncedPatientsOnDoctor).toHaveLength(1);
      expect(syncedPatientsOnDoctor[0].fullName).toBe('فرهاد کریمی');
      expect(syncedPatientsOnDoctor[0].fileNumber).toBe('D-2001');

      // Verify Device A did NOT get echoed its own clinic-sync event
      const secretarySelfEcho = devSecretary.events.find(
        (e) => e.event === 'clinic-sync' && e.data.revision === 2
      );
      expect(secretarySelfEcho).toBeUndefined();

      // 5. Device B (Dr. Mehdi Amiri) registers Palmer Treatment + Implant Surgery + Lab Order
      const updatedPatientByDoctor: Patient = {
        ...realPatient,
        totalCost: 18_000_000,
        balance: -18_000_000,
        activeTreatmentsCount: 1,
        teethConditions: {
          UR_6: {
            quadrant: 'UR',
            toothNumber: 6,
            surfaces: ['occlusal'],
            treatment: 'implant',
            status: 'completed',
            cost: 18_000_000,
            doctorName: 'دکتر مهدی امیری',
            date: '1404/05/12',
            notes: 'فیکسچر اشترومن ۴.۱×۱۰ با تورک ۳۵ N/cm',
          },
        },
        treatments: [
          {
            id: 'trt-real-ur6',
            tooth: 'UR_6',
            treatment: 'جراحی و روکش ایمپلنت اشترومن',
            cost: 18_000_000,
            date: '1404/05/12',
            status: 'completed',
            doctorName: 'دکتر مهدی امیری',
          },
        ],
        implantCases: [
          {
            id: 'imp-real-2001',
            patientId: realPatient.id,
            patientName: realPatient.fullName,
            toothNumber: 'UR_6',
            brand: 'Straumann BLT',
            diameter: '4.1mm',
            length: '10mm',
            torque: 35,
            boneGraft: false,
            membrane: false,
            surgeryDate: '1404/05/12',
            healingDueDate: '1404/08/12',
            currentStage: 'fixture_placed',
            doctorName: 'دکتر مهدی امیری',
            notes: 'کاشت اولیه ایمپلنت بدون عارضه',
          },
        ],
        labOrders: [
          {
            id: 'lab-real-2001',
            patientId: realPatient.id,
            patientName: realPatient.fullName,
            labName: 'لابراتوار تخصصی دیجیتال مینا',
            workType: 'اباتمنت و کرون زیرکونیا ایمپلنت',
            toothNumber: 'UR_6',
            shade: 'A2',
            sendDate: '1404/05/12',
            deliveryDate: '1404/05/20',
            appointmentDate: '1404/05/22',
            cost: 3_200_000,
            status: 'sent',
            reminderNotice: 'یادآوری پیگیری تحویل کرون ایمپلنت',
          },
        ],
      };

      const sync2PromiseOnSecretary = devSecretary.waitForEvent(
        'clinic-sync',
        (d) => d.revision === 3
      );

      const sync2Res = await fetch(`${baseUrl1}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-doctor-amiri',
          actorName: 'دکتر مهدی امیری',
          actorRole: 'admin',
          baseRevision: 2,
          mode: 'live_production',
          patients: [updatedPatientByDoctor],
          appointments: [{ ...realApt, status: 'completed' }],
          inventory: INITIAL_INVENTORY,
        }),
      });
      expect(sync2Res.status).toBe(200);

      // Verify Device A (Secretary) receives Doctor's treatment & lab order immediately via SSE
      const secSyncFrame = await sync2PromiseOnSecretary;
      const patOnSec = (secSyncFrame.data.patients as Patient[])[0];
      expect(patOnSec.totalCost).toBe(18_000_000);
      expect(patOnSec.implantCases).toHaveLength(1);
      expect(patOnSec.labOrders).toHaveLength(1);

      // 6. Device A (Secretary) records 10M POS payment + 8M 16-digit Sayad Check + deducts 1 inventory item
      const settledPatient: Patient = {
        ...updatedPatientByDoctor,
        paidAmount: 10_000_000,
        balance: -8_000_000,
        payments: [
          {
            id: 'pay-real-2001',
            patientId: realPatient.id,
            patientName: realPatient.fullName,
            amount: 10_000_000,
            method: 'pos',
            date: '1404/05/12',
            forTreatment: 'پیش‌پرداخت ایمپلنت اشترومن UR_6',
            terminalName: 'سامان کیش پذیرش',
          },
        ],
        sayadChecks: [
          {
            id: 'chk-real-2001',
            patientId: realPatient.id,
            patientName: realPatient.fullName,
            sayadId: '1234567890123456',
            bankName: 'بانک ملت',
            amount: 8_000_000,
            dueDate: '1404/06/15',
            status: 'in_collection',
            isGuarantee: false,
            drawerName: 'فرهاد کریمی',
          },
        ],
      };

      const updatedInventory = INITIAL_INVENTORY.map((item, idx) =>
        idx === 0 ? { ...item, stock: Math.max(0, item.stock - 1) } : item
      );

      expect(validateSayadCheckId('1234567890123456')).toBe(true);

      // Verify exact 10^-6 commission ledger math: (18,000,000 - 3,200,000) / 2 = 7,400,000
      const ledger = computeDoctorWorkCommissionLedger([settledPatient], {
        doctorId: 'user-manager-amiri',
        doctorName: 'دکتر مهدی امیری',
        specialty: 'جراحی و ایمپلنت',
        isManager: true,
        model: 'lab_split_half',
        percentageRate: 50,
        fixedWagePerTreatment: 0,
      });
      expect(Math.abs(ledger.totalRegisteredGrossWork - 18_000_000)).toBeLessThan(1e-6);
      expect(Math.abs(ledger.totalAssignedLabDeductions - 3_200_000)).toBeLessThan(1e-6);
      expect(Math.abs(ledger.netCommissionableBase - 14_800_000)).toBeLessThan(1e-6);
      expect(Math.abs(ledger.exactDoctorPayable - 7_400_000)).toBeLessThan(1e-6);

      const sync3Res = await fetch(`${baseUrl1}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-secretary-01',
          actorName: 'خانم رضایی (منشی)',
          actorRole: 'secretary',
          baseRevision: 3,
          mode: 'live_production',
          patients: [settledPatient],
          appointments: [{ ...realApt, status: 'completed' }],
          inventory: updatedInventory,
        }),
      });
      expect(sync3Res.status).toBe(200);
      const sync3Json = (await sync3Res.json()) as { revision: number };
      expect(sync3Json.revision).toBe(4);
    } finally {
      devSecretary?.close();
      devDoctor?.close();
      await new Promise<void>((resolve) => server1.close(() => resolve()));
    }

    // 7. Full Server Restart Persistence Proof (Zero Data Loss across process restarts)
    const app2 = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });
    const server2 = await new Promise<http.Server>((resolve) => {
      const s = app2.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port2 = (server2.address() as AddressInfo).port;
    const baseUrl2 = `http://127.0.0.1:${port2}`;

    try {
      const stateRes = await fetch(`${baseUrl2}/api/clinic/state`);
      expect(stateRes.status).toBe(200);
      const restored = (await stateRes.json()) as {
        initialized: boolean;
        revision: number;
        mode: string;
        patients: Patient[];
        appointments: Appointment[];
        inventory: Array<{ id: string; stock: number }>;
      };

      expect(restored.initialized).toBe(true);
      expect(restored.mode).toBe('live_production');
      expect(restored.revision).toBe(4);
      expect(restored.patients).toHaveLength(1);
      expect(restored.patients[0].fullName).toBe('فرهاد کریمی');
      expect(restored.patients[0].paidAmount).toBe(10_000_000);
      expect(restored.patients[0].balance).toBe(-8_000_000);
      expect(restored.patients[0].sayadChecks?.[0]?.sayadId).toBe('1234567890123456');
      expect(restored.patients[0].implantCases?.[0]?.toothNumber).toBe('UR_6');
      expect(restored.patients[0].labOrders?.[0]?.cost).toBe(3_200_000);
      expect(restored.appointments).toHaveLength(1);
      expect(restored.appointments[0].status).toBe('completed');
      expect(restored.inventory[0].stock).toBe(Math.max(0, INITIAL_INVENTORY[0].stock - 1));
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('[MD-TST-35] resolves concurrent stale-revision conflicts with zero data loss, syncs sanitized staff/tariffs live, and enforces Iranian SMS proxy validation', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minadental-conflict-e2e-'));
    const storeFile = path.join(tmpDir, 'clinic-conflict-store.json');

    const app = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });
    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    let devSecretary: Awaited<ReturnType<typeof openSseClient>> | null = null;
    try {
      devSecretary = await openSseClient(baseUrl, 'dev-sec-conflict');
      await devSecretary.waitForEvent('connected');

      // Seed initial patient #1 (shared baseline revision 1)
      const sharedPatient: Patient = {
        id: 'pat-shared-1',
        fileNumber: 'D-3001',
        fullName: 'سارا حسینی',
        nationalId: '0013542419',
        phone: '09121112233',
        age: 31,
        gender: 'زن',
        medicalHistory: [],
        totalCost: 4_000_000,
        paidAmount: 0,
        balance: -4_000_000,
        activeTreatmentsCount: 1,
        lastVisit: '1404/05/15',
        teethConditions: {},
        treatments: [
          {
            id: 'trt-initial-1',
            tooth: 'UL_4',
            treatment: 'ترمیم کامپوزیت',
            cost: 4_000_000,
            date: '1404/05/15',
            status: 'completed',
            doctorName: 'دکتر مهدی امیری',
          },
        ],
        sayadChecks: [],
        installments: [],
        labOrders: [],
        implantCases: [],
        payments: [],
        notes: '',
      };

      const initRes = await fetch(`${baseUrl}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-doctor-conflict',
          actorName: 'دکتر مهدی امیری',
          baseRevision: 0,
          mode: 'live_production',
          patients: [sharedPatient],
          appointments: [],
          inventory: INITIAL_INVENTORY,
        }),
      });
      expect(initRes.status).toBe(200);
      const initJson = (await initRes.json()) as { revision: number };
      expect(initJson.revision).toBe(1);

      // Device A (Secretary) pushes from baseRevision 1: records a 2M payment on pat-shared-1 AND admits Patient #2
      const patient2BySec: Patient = {
        ...sharedPatient,
        id: 'pat-sec-2',
        fileNumber: 'D-3002',
        fullName: 'امیرحسین مرادی',
        phone: '09125556677',
        totalCost: 0,
        paidAmount: 0,
        balance: 0,
        treatments: [],
      };
      const sharedWithPayment: Patient = {
        ...sharedPatient,
        paidAmount: 2_000_000,
        balance: -2_000_000,
        payments: [
          {
            id: 'pay-sec-concurrent',
            patientId: sharedPatient.id,
            patientName: sharedPatient.fullName,
            amount: 2_000_000,
            method: 'pos',
            date: '1404/05/15',
            forTreatment: 'قسط اول کامپوزیت',
          },
        ],
      };

      const secPushRes = await fetch(`${baseUrl}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-sec-conflict',
          actorName: 'منشی پذیرش',
          baseRevision: 1,
          patients: [sharedWithPayment, patient2BySec],
        }),
      });
      expect(secPushRes.status).toBe(200);
      const secPushJson = (await secPushRes.json()) as { revision: number; mergedConflict: boolean };
      expect(secPushJson.revision).toBe(2);
      expect(secPushJson.mergedConflict).toBe(false);

      // Device B (Doctor) was offline and pushes concurrently using STALE baseRevision 1:
      // Adds a new endo treatment on pat-shared-1 AND admits Patient #3 (without knowing about Secretary's payment or Patient #2!)
      const patient3ByDoc: Patient = {
        ...sharedPatient,
        id: 'pat-doc-3',
        fileNumber: 'D-3003',
        fullName: 'مهسا شریفی',
        phone: '09128889900',
        totalCost: 0,
        paidAmount: 0,
        balance: 0,
        treatments: [],
      };
      const sharedWithSecondTreatment: Patient = {
        ...sharedPatient,
        totalCost: 9_000_000,
        balance: -9_000_000,
        treatments: [
          ...(sharedPatient.treatments || []),
          {
            id: 'trt-doc-concurrent',
            tooth: 'UR_5',
            treatment: 'عصب‌کشی (اندو)',
            cost: 5_000_000,
            date: '1404/05/15',
            status: 'completed',
            doctorName: 'دکتر مهدی امیری',
          },
        ],
      };

      // Also sync a staff member with an accidental plaintext `password` + updated clinic tariffs!
      const sseWaitStaff = devSecretary.waitForEvent('clinic-sync', (d) => d.revision === 3);
      const docConflictRes = await fetch(`${baseUrl}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-doctor-conflict',
          actorName: 'دکتر مهدی امیری',
          baseRevision: 1, // STALE! Server is already at revision 2
          patients: [sharedWithSecondTreatment, patient3ByDoc],
          users: [
            {
              id: 'user-doc-new',
              fullName: 'دکتر نیلوفر رضوانی',
              role: 'dentist',
              password: 'SHOULD_BE_STRIPPED_ON_SERVER',
              passwordHash: 'sha256$salt$validhash',
            },
          ],
          clinicConfig: {
            tariffs: [{ id: 't-implant', title: 'ایمپلنت اشترومن', price: 22_000_000 }],
          },
        }),
      });
      expect(docConflictRes.status).toBe(200);
      const docConflictJson = (await docConflictRes.json()) as {
        revision: number;
        mergedConflict: boolean;
        patients: Patient[];
        users: Array<Record<string, unknown>>;
        clinicConfig: Record<string, unknown>;
      };

      // Assert server detected conflict and preserved ALL 3 patients + BOTH concurrent edits on pat-shared-1!
      expect(docConflictJson.mergedConflict).toBe(true);
      expect(docConflictJson.revision).toBe(3);
      expect(docConflictJson.patients.map((p) => p.id).sort()).toEqual([
        'pat-doc-3',
        'pat-sec-2',
        'pat-shared-1',
      ]);

      const mergedShared = docConflictJson.patients.find((p) => p.id === 'pat-shared-1')!;
      expect(mergedShared.treatments?.map((t: { id: string }) => t.id).sort()).toEqual([
        'trt-doc-concurrent',
        'trt-initial-1',
      ]);
      expect(mergedShared.payments?.map((p) => p.id)).toEqual(['pay-sec-concurrent']);
      expect(mergedShared.totalCost).toBe(9_000_000);
      expect(mergedShared.paidAmount).toBe(2_000_000);
      expect(mergedShared.balance).toBe(-7_000_000);

      // Assert plaintext password was strictly stripped server-side and SSE pushed merged state + tariffs to Secretary
      expect(docConflictJson.users[0].password).toBeUndefined();
      expect(docConflictJson.users[0].passwordHash).toBe('sha256$salt$validhash');

      const secFrame = await sseWaitStaff;
      expect(secFrame.data.mergedConflict).toBe(true);
      expect((secFrame.data.users as Array<Record<string, unknown>>)[0].password).toBeUndefined();
      expect((secFrame.data.clinicConfig as { tariffs?: Array<{ price: number }> }).tariffs?.[0]?.price).toBe(
        22_000_000
      );

      // Assert Iranian SMS Gateway Proxy (/api/sms/send) validation & dispatch
      const badPhoneSms = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'kavenegar',
          recipientMobile: '12345',
          recipientName: 'تست',
          messageText: 'پیام تست',
        }),
      });
      expect(badPhoneSms.status).toBe(400);

      const badProviderSms = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'evil-ssrf-host',
          recipientMobile: '09121112233',
          recipientName: 'تست',
          messageText: 'پیام تست',
        }),
      });
      expect(badProviderSms.status).toBe(400);

      const validSms = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'kavenegar',
          recipientMobile: '09121112233',
          recipientName: 'سارا حسینی',
          messageText: 'یادآوری نوبت دندانپزشکی کلینیک مینادنتال',
        }),
      });
      expect(validSms.status).toBe(200);
      const validSmsJson = (await validSms.json()) as { ok: boolean; refId: string };
      expect(validSmsJson.ok).toBe(true);
      expect(validSmsJson.refId).toContain('KAVENEGAR-');
    } finally {
      devSecretary?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('[MD-TST-36] verifies Server Rolling Backup Vault (create/list/download/path-traversal defense/Manager SSE restore) and live VoIP Caller-ID SSE broadcast', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minadental-vault-voip-e2e-'));
    const storeFile = path.join(tmpDir, 'clinic-vault-store.json');

    const app = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });
    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    let devReception: Awaited<ReturnType<typeof openSseClient>> | null = null;
    try {
      devReception = await openSseClient(baseUrl, 'dev-reception-voip');
      await devReception.waitForEvent('connected');

      // 1. Seed 1 real patient
      const pat: Patient = {
        id: 'pat-voip-1',
        fileNumber: 'D-4001',
        fullName: 'رضا شریفی',
        nationalId: '0013542419',
        phone: '09127778899',
        age: 42,
        gender: 'مرد',
        medicalHistory: [],
        totalCost: 6_500_000,
        paidAmount: 2_500_000,
        balance: -4_000_000,
        activeTreatmentsCount: 1,
        lastVisit: '1404/05/18',
        teethConditions: {},
        treatments: [],
        sayadChecks: [],
        installments: [],
        labOrders: [],
        implantCases: [],
        payments: [],
        notes: 'پرونده اصلی برای تست کالرآیدی و بکاپ سرور',
      };

      const seedRes = await fetch(`${baseUrl}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-doctor-vault',
          actorName: 'دکتر مهدی امیری',
          mode: 'live_production',
          patients: [pat],
          appointments: [],
          inventory: INITIAL_INVENTORY,
        }),
      });
      expect(seedRes.status).toBe(200);

      // 2. Create real server snapshot & list it & download it
      const createSnapRes = await fetch(`${baseUrl}/api/clinic/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'بکاپ پایان شیفت عصر',
          actorName: 'دکتر مهدی امیری',
        }),
      });
      expect(createSnapRes.status).toBe(200);
      const createSnapJson = (await createSnapRes.json()) as {
        ok: boolean;
        backup: { id: string; patientsCount: number };
      };
      expect(createSnapJson.ok).toBe(true);
      expect(createSnapJson.backup.patientsCount).toBe(1);
      const snapId = createSnapJson.backup.id;

      const listRes = await fetch(`${baseUrl}/api/clinic/backups`);
      const listJson = (await listRes.json()) as { ok: boolean; backups: Array<{ id: string }> };
      expect(listJson.backups.some((b) => b.id === snapId)).toBe(true);

      const dlRes = await fetch(`${baseUrl}/api/clinic/backups/${encodeURIComponent(snapId)}/download`);
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers.get('content-disposition')).toContain(snapId);

      // 3. Path traversal attack on download & restore strictly blocked (400)
      const traversalDl = await fetch(`${baseUrl}/api/clinic/backups/${encodeURIComponent('..%2F..%2Fpackage.json')}/download`);
      expect(traversalDl.status).toBe(400);

      const traversalRestore = await fetch(`${baseUrl}/api/clinic/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotId: '../../etc/passwd',
          actorName: 'attacker',
          isManager: true,
        }),
      });
      expect(traversalRestore.status).toBe(400);

      // 4. Wipe live state (simulate accidental change) then verify non-manager restore blocked (403)
      await fetch(`${baseUrl}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-doctor-vault',
          actorName: 'دکتر مهدی امیری',
          baseRevision: 1,
          patients: [],
        }),
      });

      const forbiddenRestore = await fetch(`${baseUrl}/api/clinic/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotId: snapId,
          actorName: 'منشی پذیرش',
          isManager: false,
        }),
      });
      expect(forbiddenRestore.status).toBe(403);

      // 5. Manager restores snapshot -> live SSE broadcasts restored patient to Reception device!
      const sseRestoreWait = devReception.waitForEvent('clinic-sync', (d) => d.revision === 3);
      const restoreRes = await fetch(`${baseUrl}/api/clinic/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotId: snapId,
          actorName: 'دکتر مهدی امیری',
          isManager: true,
          clientId: 'dev-doctor-vault',
        }),
      });
      expect(restoreRes.status).toBe(200);
      const sseRestoredFrame = await sseRestoreWait;
      expect((sseRestoredFrame.data.patients as Patient[])[0].fullName).toBe('رضا شریفی');

      // 6. Real VoIP Caller-ID webhook matches existing patient with Persian digits & broadcasts live over SSE
      const sseCallExistingWait = devReception.waitForEvent(
        'incoming-call',
        (d) => Boolean(d.matchedPatient)
      );
      const callExistingRes = await fetch(`${baseUrl}/api/clinic/incoming-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '۰۹۱۲۷۷۷۸۸۹۹',
          lineName: 'خط ۱ پذیرش',
        }),
      });
      expect(callExistingRes.status).toBe(200);
      const callExistingFrame = await sseCallExistingWait;
      expect((callExistingFrame.data.matchedPatient as Patient).fullName).toBe('رضا شریفی');

      // 7. Unknown caller triggers live SSE incoming-call with matchedPatient === null (for auto-booking)
      const sseCallUnknownWait = devReception.waitForEvent(
        'incoming-call',
        (d) => d.phoneNumber === '09120001122' && d.matchedPatient === null
      );
      const callUnknownRes = await fetch(`${baseUrl}/api/clinic/incoming-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '09120001122',
          lineName: 'خط ۲ پذیرش',
        }),
      });
      expect(callUnknownRes.status).toBe(200);
      const callUnknownFrame = await sseCallUnknownWait;
      expect(callUnknownFrame.data.matchedPatient).toBeNull();
    } finally {
      devReception?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('[MD-TST-37] persists immutable server-side Security Audit Trail across restarts and computes exact authoritative Executive Summary KPIs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minadental-audit-report-e2e-'));
    const storeFile = path.join(tmpDir, 'clinic-audit-store.json');

    const app1 = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });
    const server1 = await new Promise<http.Server>((resolve) => {
      const s = app1.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port1 = (server1.address() as AddressInfo).port;
    const baseUrl1 = `http://127.0.0.1:${port1}`;

    try {
      // 1. Seed 2 real patients with financial, check, lab, and implant records
      const pat1: Patient = {
        id: 'pat-rep-1',
        fileNumber: 'D-5001',
        fullName: 'علیرضا محمدی',
        nationalId: '0013542419',
        phone: '09123334455',
        age: 35,
        gender: 'مرد',
        medicalHistory: [],
        totalCost: 20_000_000,
        paidAmount: 12_000_000,
        balance: -8_000_000,
        activeTreatmentsCount: 1,
        lastVisit: '1404/05/20',
        teethConditions: {},
        treatments: [],
        sayadChecks: [
          {
            id: 'chk-rep-1',
            patientId: 'pat-rep-1',
            patientName: 'علیرضا محمدی',
            sayadId: '1234567890123456',
            bankName: 'بانک ملی',
            amount: 8_000_000,
            dueDate: '1404/06/20',
            drawerName: 'علیرضا محمدی',
            status: 'in_collection',
            isGuarantee: false,
          },
        ],
        installments: [],
        labOrders: [
          {
            id: 'lab-rep-1',
            patientId: 'pat-rep-1',
            patientName: 'علیرضا محمدی',
            toothNumber: 'UR_6',
            workType: 'روکش زیرکونیا',
            labName: 'لابراتوار مینا',
            shade: 'A2',
            sendDate: '1404/05/20',
            deliveryDate: '1404/05/27',
            appointmentDate: '1404/05/28',
            status: 'fabrication',
            cost: 3_000_000,
            reminderNotice: '',
          },
        ],
        implantCases: [
          {
            id: 'imp-rep-1',
            patientId: 'pat-rep-1',
            patientName: 'علیرضا محمدی',
            toothNumber: 'UR_6',
            brand: 'Straumann',
            diameter: '4.1mm',
            length: '10mm',
            torque: 35,
            boneGraft: false,
            membrane: false,
            surgeryDate: '1404/05/20',
            healingDueDate: '1404/08/20',
            currentStage: 'fixture_placed',
            notes: '',
          },
        ],
        payments: [],
        notes: '',
      };

      await fetch(`${baseUrl1}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-exec-1',
          actorName: 'دکتر مهدی امیری',
          mode: 'live_production',
          patients: [pat1],
          appointments: [],
          inventory: INITIAL_INVENTORY,
        }),
      });

      // 2. Trigger a 403 security block + a server backup + a custom client audit event
      const secBlock = await fetch(`${baseUrl1}/api/clinic/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'dev-sec-test',
          actorName: 'منشی پذیرش',
          isManager: false,
          mode: 'live_production',
        }),
      });
      expect(secBlock.status).toBe(403);

      await fetch(`${baseUrl1}/api/clinic/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'بکاپ گزارش پایان روز', actorName: 'دکتر مهدی امیری' }),
      });

      const customAuditRes = await fetch(`${baseUrl1}/api/clinic/audit-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: 'دکتر مهدی امیری',
          role: 'admin',
          category: 'financial',
          action: 'تایید تخفیف تخصصی ۱۰ درصد',
          details: 'پرونده D-5001',
          severity: 'info',
        }),
      });
      expect(customAuditRes.status).toBe(200);

      // 3. Verify authoritative Executive Summary KPIs
      const summaryRes = await fetch(`${baseUrl1}/api/clinic/report/summary`);
      expect(summaryRes.status).toBe(200);
      const summary = (await summaryRes.json()) as {
        ok: boolean;
        totalPatients: number;
        totalGrossCost: number;
        totalPaidAmount: number;
        totalOutstandingBalance: number;
        pendingChecksCount: number;
        activeLabOrdersCount: number;
        activeImplantCasesCount: number;
        serverBackupsCount: number;
        auditEventsCount: number;
      };
      expect(summary.ok).toBe(true);
      expect(summary.totalPatients).toBe(1);
      expect(summary.totalGrossCost).toBe(20_000_000);
      expect(summary.totalPaidAmount).toBe(12_000_000);
      expect(summary.totalOutstandingBalance).toBe(8_000_000);
      expect(summary.pendingChecksCount).toBe(1);
      expect(summary.activeLabOrdersCount).toBe(1);
      expect(summary.activeImplantCasesCount).toBe(1);
      expect(summary.serverBackupsCount).toBeGreaterThanOrEqual(1);
      expect(summary.auditEventsCount).toBeGreaterThanOrEqual(3);
    } finally {
      await new Promise<void>((resolve) => server1.close(() => resolve()));
    }

    // 4. Restart server #2 and verify audit log persisted atomically on disk!
    const app2 = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });
    const server2 = await new Promise<http.Server>((resolve) => {
      const s = app2.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port2 = (server2.address() as AddressInfo).port;
    const baseUrl2 = `http://127.0.0.1:${port2}`;

    try {
      const auditRes = await fetch(`${baseUrl2}/api/clinic/audit-log?limit=20`);
      expect(auditRes.status).toBe(200);
      const auditJson = (await auditRes.json()) as {
        ok: boolean;
        entries: Array<{ action: string; severity: string }>;
      };
      expect(auditJson.ok).toBe(true);
      expect(auditJson.entries.some((e) => e.action.includes('تایید تخفیف تخصصی'))).toBe(true);
      expect(auditJson.entries.some((e) => e.severity === 'critical')).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});



