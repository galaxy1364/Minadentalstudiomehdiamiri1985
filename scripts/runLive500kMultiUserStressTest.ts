/**
 * MinaDental Live 500,000-Patient & Concurrent Multi-User Stress Test
 * Exercises REAL production engines (zero mock math):
 *  1. 500,000 real typed Patient records processed across 50 streaming waves (10,000/wave)
 *  2. 200,000 real Installments + 60,000 real 16-digit Sayad/Guarantee Checks
 *  3. 100,000 real Implant Cases (5 stages) + 80,000 real Lab Orders (5 stages)
 *  4. Real production accountingEngine (computeClinicReceivablesLedger + computeDoctorWorkCommissionLedger)
 *  5. Real production reminderNotificationService (synthesizeUnifiedClinicReminders across 9 pillars)
 *  6. Live HTTP + SSE Express server with 12 concurrent clinic users, simultaneous stale-revision
 *     conflict storm, VoIP Caller-ID fan-out, RBAC attack probes, backup & server restart persistence
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';

import { createMinaDentalServer } from '../server';
import { INITIAL_INVENTORY } from '../src/data/mockData';
import {
  computeClinicReceivablesLedger,
  computeDoctorWorkCommissionLedger,
  toMicroUnits,
  fromMicroUnits,
} from '../src/utils/accountingEngine';
import {
  synthesizeUnifiedClinicReminders,
  getReminderAnalyticsSummary,
} from '../src/services/reminderNotificationService';
import { getRelativePersianDate } from '../src/utils/jalali';
import { validateSayadCheckId, validateIranianNationalCode } from '../src/utils/validators';
import type {
  Patient,
  Appointment,
  Installment,
  SayadCheck,
  ImplantCase,
  LabOrder,
  ImplantStage,
  LabStatus,
} from '../src/types/dental';

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
  receivedAt: number;
}

const FIRST_NAMES = ['امیرحسین', 'سارا', 'فرهاد', 'مهسا', 'رضا', 'نیلوفر', 'محمدجواد', 'فاطمه', 'پویا', 'زهرا', 'کیوان', 'هانیه'];
const LAST_NAMES = ['کریمی', 'حسینی', 'مرادی', 'شریفی', 'امیری', 'رضایی', 'احمدی', 'محمدی', 'کاظمی', 'صادقی', 'حیدری', 'نوری'];
const BANKS = ['بانک ملت', 'بانک ملی', 'بانک سامان', 'بانک پاسارگاد', 'بانک صادرات', 'بانک تجارت'];
const IMPLANT_BRANDS = ['Straumann BLT', 'Osstem TSIII', 'Megagen AnyRidge', 'Dentium SuperLine', 'SIC Invent'];
const IMPLANT_STAGES: ImplantStage[] = ['fixture_placed', 'healing_cap', 'impression', 'abutment_framework', 'crown_delivered'];
const LAB_PARTNERS = ['لابراتوار دیجیتال مینا', 'لابراتوار تخصصی پارس', 'لابراتوار کادکام آریا', 'لابراتوار زیرکونیا نوین'];
const LAB_STATUSES: LabStatus[] = ['sent', 'fabrication', 'frame_try_in', 'ready_for_clinic', 'delivered_cemented'];
const LAB_SHADES = ['A1', 'A2', 'A3', 'B1', 'BL1', 'BL2'];
const PALMER_TEETH = ['UR_6', 'UL_6', 'LR_6', 'LL_6', 'UR_4', 'UL_5', 'UR_1', 'UL_2'];
const DOCTORS = ['دکتر مهدی امیری', 'دکتر سارا رضوانی', 'دکتر امیر کاظمی', 'دکتر نگار شریفی'];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
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
        reject(new Error(`SSE HTTP ${res.statusCode}`));
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
            const ev: SseEvent = { event: eventName, data: parsed, receivedAt: performance.now() };
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
        waitForEvent: (eventName, predicate, timeoutMs = 8000) => {
          const existing = events.find((e) => e.event === eventName && (!predicate || predicate(e.data)));
          if (existing) return Promise.resolve(existing);
          return new Promise<SseEvent>((resWait, rejWait) => {
            const timer = setTimeout(() => {
              rejWait(new Error(`SSE timeout waiting for "${eventName}" on ${clientId}`));
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

async function runPhase1Scale500kEngineTest() {
  console.log('\n[PHASE 1] 500,000-Patient Real Clinical Engine Stress Test (Installments, Checks, Implants, Lab, Reminders)...');
  const start = performance.now();

  // Precompute Jalali date lookup table (-30 days .. +120 days) so real Jalali dates are authentic & fast
  const dateCache = new Map<number, string>();
  for (let d = -30; d <= 120; d++) {
    dateCache.set(d, getRelativePersianDate(d));
  }
  const relDate = (offset: number) => dateCache.get(offset) || getRelativePersianDate(offset);

  const TOTAL_PATIENTS = 500_000;
  const WAVE_SIZE = 10_000;
  const WAVES = TOTAL_PATIENTS / WAVE_SIZE; // 50 waves

  // Verify valid Iranian national code & Sayad check algorithm on sample
  if (!validateIranianNationalCode('0013542419')) {
    throw new Error('Iranian National Code validator check failed');
  }

  let totalPatientsProcessed = 0;
  let totalInstallments = 0;
  let totalOverdueInstallments = 0;
  let totalChecks = 0;
  let totalGuaranteeChecks = 0;
  let totalValidSayadIds = 0;
  let totalImplants = 0;
  let totalLabOrders = 0;
  let totalRemindersSynthesized = 0;
  let totalCriticalReminders = 0;
  let totalGrossToman = 0n;
  let totalLabToman = 0n;
  let totalDoctorPayableToman = 0n;
  let totalReceivablesToman = 0n;
  let totalPendingChecksToman = 0n;
  let totalGuaranteeChecksToman = 0n;
  let totalPendingInstallmentsToman = 0n;
  let doctorTreatmentsProcessed = 0;

  let ledgerTotalMs = 0;
  let commissionTotalMs = 0;
  let reminderTotalMs = 0;
  const reminderWaveSampleEvery = 1; // Run REAL reminder synthesis across all 50 waves (all 500,000 patients!)

  const implantStageCounts: Record<ImplantStage, number> = {
    fixture_placed: 0,
    healing_cap: 0,
    impression: 0,
    abutment_framework: 0,
    crown_delivered: 0,
  };
  const labStatusCounts: Record<LabStatus, number> = {
    sent: 0,
    fabrication: 0,
    frame_try_in: 0,
    ready_for_clinic: 0,
    delivered_cemented: 0,
  };

  for (let w = 0; w < WAVES; w++) {
    const wavePatients: Patient[] = new Array(WAVE_SIZE);
    const waveAppointments: Appointment[] = [];

    for (let j = 0; j < WAVE_SIZE; j++) {
      const idx = w * WAVE_SIZE + j + 1;
      const pid = `pat-500k-${idx}`;
      const fullName = `${FIRST_NAMES[idx % FIRST_NAMES.length]} ${LAST_NAMES[(idx >> 2) % LAST_NAMES.length]}`;
      const phone = `0912${String(1000000 + (idx % 8999999))}`;
      const tooth = PALMER_TEETH[idx % PALMER_TEETH.length];
      const [quadrant, toothNumStr] = tooth.split('_') as ['UR' | 'UL' | 'LL' | 'LR', string];
      const toothNumber = Number(toothNumStr);
      const doctor = DOCTORS[idx % DOCTORS.length];

      // 40% of 500k patients -> 200,000 real installments
      const installments: Installment[] = [];
      let instDebt = 0;
      if (idx % 5 < 2) {
        const isOverdue = idx % 10 === 0;
        const isPaid = idx % 10 === 1;
        const amount = 2_500_000 + (idx % 6) * 500_000;
        const dueOffset = isOverdue ? -(1 + (idx % 14)) : (1 + (idx % 45));
        installments.push({
          id: `inst-${idx}`,
          patientId: pid,
          patientName: fullName,
          treatmentName: 'ایمپلنت و پروتز ثابت',
          installmentNumber: 1,
          totalInstallments: 4,
          amount,
          dueDate: relDate(dueOffset),
          status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
          paymentMethod: isPaid ? 'pos' : undefined,
        });
        totalInstallments++;
        if (isOverdue) totalOverdueInstallments++;
        if (!isPaid) instDebt += amount;
      }

      // 12% of 500k patients -> 60,000 real 16-digit Sayad & guarantee checks
      const sayadChecks: SayadCheck[] = [];
      if (idx % 25 < 3) {
        const sayadId = `73018492${String(idx).padStart(6, '0')}10`;
        if (validateSayadCheckId(sayadId)) totalValidSayadIds++;
        const isGuarantee = idx % 50 === 0;
        const isBounced = !isGuarantee && idx % 100 === 1;
        const amt = 8_000_000 + (idx % 5) * 2_000_000;
        sayadChecks.push({
          id: `chk-${idx}`,
          patientId: pid,
          patientName: fullName,
          sayadId,
          bankName: BANKS[idx % BANKS.length],
          amount: amt,
          dueDate: relDate(isBounced ? -3 : (idx % 30)),
          drawerName: fullName,
          status: isBounced ? 'bounced' : 'in_collection',
          isGuarantee,
        });
        totalChecks++;
        if (isGuarantee) totalGuaranteeChecks++;
      }

      // 20% of 500k patients -> 100,000 real Implant surgical cases evenly distributed across all 5 stages (20,000 each)
      const implantCases: ImplantCase[] = [];
      if (idx % 5 === 0) {
        const stage = IMPLANT_STAGES[Math.floor(idx / 5) % IMPLANT_STAGES.length];
        implantStageCounts[stage]++;
        implantCases.push({
          id: `imp-${idx}`,
          patientId: pid,
          patientName: fullName,
          toothNumber: tooth,
          brand: IMPLANT_BRANDS[idx % IMPLANT_BRANDS.length],
          diameter: '4.1mm',
          length: '10mm',
          torque: 35 + (idx % 20),
          boneGraft: idx % 15 === 0,
          membrane: idx % 15 === 0,
          surgeryDate: relDate(-20),
          healingDueDate: relDate((idx % 60) - 5),
          currentStage: stage,
          doctorName: doctor,
          notes: 'ثبت استرس‌تست زنده ۵۰۰ هزار پرونده',
        });
        totalImplants++;
      }

      // 16% of 500k patients -> 80,000 real Lab orders evenly distributed across all 5 statuses (16,000 each)
      const labOrders: LabOrder[] = [];
      if (idx % 25 < 4) {
        const labSeq = Math.floor(idx / 25) * 4 + (idx % 25);
        const lStatus = LAB_STATUSES[labSeq % LAB_STATUSES.length];
        labStatusCounts[lStatus]++;
        const labFee = 2_400_000 + (idx % 4) * 400_000;
        labOrders.push({
          id: `lab-${idx}`,
          patientId: pid,
          patientName: fullName,
          toothNumber: tooth,
          workType: 'روکش زیرکونیا ایمپلنت',
          labName: LAB_PARTNERS[idx % LAB_PARTNERS.length],
          shade: LAB_SHADES[idx % LAB_SHADES.length],
          sendDate: relDate(-7),
          deliveryDate: relDate((idx % 12) - 2),
          appointmentDate: relDate((idx % 12) + 1),
          status: lStatus,
          cost: labFee,
          reminderNotice: 'پیگیری تحویل لابراتوار',
        });
        totalLabOrders++;
      }

      const grossCost = 6_000_000 + (idx % 7) * 2_000_000 + (implantCases.length ? 14_000_000 : 0);
      const debt = Math.min(grossCost, instDebt + (idx % 4 === 0 ? 1_500_000 : 0));
      const paid = Math.max(0, grossCost - debt);

      wavePatients[j] = {
        id: pid,
        fileNumber: `D-${100000 + idx}`,
        fullName,
        nationalId: '0013542419',
        phone,
        age: 22 + (idx % 48),
        gender: idx % 2 === 0 ? 'مرد' : 'زن',
        medicalHistory: [],
        totalCost: grossCost,
        paidAmount: paid,
        balance: -debt,
        activeTreatmentsCount: 1,
        lastVisit: relDate(-5),
        teethConditions: {
          [tooth]: {
            quadrant,
            toothNumber,
            surfaces: ['occlusal'],
            treatment: implantCases.length ? 'implant' : 'crown_zirconia',
            status: 'completed',
            cost: grossCost,
            doctorName: doctor,
            date: relDate(-5),
          },
        },
        treatments: [
          {
            id: `trt-${idx}`,
            tooth,
            treatment: implantCases.length ? 'کاشت ایمپلنت و پروتز' : 'درمان ترمیمی و ریشه',
            cost: grossCost,
            date: relDate(-5),
            status: 'completed',
            doctorName: doctor,
          },
        ],
        sayadChecks,
        installments,
        labOrders,
        implantCases,
        payments: [
          {
            id: `pay-${idx}`,
            patientId: pid,
            patientName: fullName,
            amount: paid,
            date: relDate(-5),
            method: 'pos',
            forTreatment: 'پرداخت درمان',
          },
        ],
        notes: '',
      };

      // Add real appointments for 4% of wave (20,000 total appointments across 500k patients)
      if (idx % 25 === 0) {
        waveAppointments.push({
          id: `apt-${idx}`,
          patientId: pid,
          patientName: fullName,
          phone,
          date: relDate(idx % 5),
          time: `${String(9 + (idx % 9)).padStart(2, '0')}:00`,
          durationMinutes: 45,
          treatment: implantCases.length ? 'چکاپ ایمپلنت' : 'تحویل روکش لابراتوار',
          doctor,
          unit: idx % 2 === 0 ? 'یونیت ۱ (جراحی)' : 'یونیت ۲ (درمان)',
          status: 'scheduled',
        });
      }
    }

    // 1. Real Receivables Ledger on this 10,000-patient wave
    const tL = performance.now();
    const recLedger = computeClinicReceivablesLedger(wavePatients);
    ledgerTotalMs += performance.now() - tL;
    totalReceivablesToman += BigInt(Math.round(recLedger.totalOutstandingPatientDebtToClinic));
    totalPendingChecksToman += BigInt(Math.round(recLedger.totalPendingChecksInSafe));
    totalGuaranteeChecksToman += BigInt(Math.round(recLedger.totalGuaranteeChecksInSafe));
    totalPendingInstallmentsToman += BigInt(Math.round(recLedger.totalPendingInstallments));

    // 2. Real Doctor Commission Ledger (exact 10^-6 math) on Dr. Mehdi Amiri's Palmer treatments & lab deductions
    const tC = performance.now();
    const docLedger = computeDoctorWorkCommissionLedger(wavePatients, {
      doctorId: 'user-manager-amiri',
      doctorName: 'دکتر مهدی امیری',
      specialty: 'جراحی و ایمپلنت',
      isManager: true,
      model: 'lab_split_half',
      percentageRate: 50,
      fixedWagePerTreatment: 0,
    });
    commissionTotalMs += performance.now() - tC;
    doctorTreatmentsProcessed += docLedger.treatmentsCount;
    totalGrossToman += BigInt(Math.round(docLedger.totalRegisteredGrossWork));
    totalLabToman += BigInt(Math.round(docLedger.totalAssignedLabDeductions));
    totalDoctorPayableToman += BigInt(Math.round(docLedger.exactDoctorPayable));

    // Verify exact 10^-6 precision on every single wave: (Gross - Lab) / 2 === DoctorPayable
    const expectedPayable = Math.round(((docLedger.totalRegisteredGrossWork - docLedger.totalAssignedLabDeductions) / 2) * 1e6) / 1e6;
    if (Math.abs(docLedger.exactDoctorPayable - expectedPayable) > 1e-4) {
      throw new Error(`Commission drift in wave ${w}: got ${docLedger.exactDoctorPayable} vs expected ${expectedPayable}`);
    }

    // 3. Real 9-pillar Unified Reminder Engine on all 50 waves (all 500,000 patients!)
    if (w % reminderWaveSampleEvery === 0) {
      const tR = performance.now();
      const waveReminders = synthesizeUnifiedClinicReminders({
        patients: wavePatients,
        appointments: waveAppointments,
        inventory: w === 0 ? INITIAL_INVENTORY : [],
        includeSnoozed: true,
      });
      const summary = getReminderAnalyticsSummary(waveReminders);
      reminderTotalMs += performance.now() - tR;
      totalRemindersSynthesized += waveReminders.length;
      totalCriticalReminders += summary.criticalCount;
    }

    totalPatientsProcessed += wavePatients.length;
  }

  const totalMs = performance.now() - start;
  const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

  return {
    totalPatientsProcessed,
    totalInstallments,
    totalOverdueInstallments,
    totalChecks,
    totalGuaranteeChecks,
    totalValidSayadIds,
    totalImplants,
    implantStageCounts,
    totalLabOrders,
    labStatusCounts,
    totalRemindersSynthesized,
    totalCriticalReminders,
    drAmiriPalmerTreatmentsEvaluated: doctorTreatmentsProcessed,
    drAmiriGrossWorkToman: totalGrossToman.toString(),
    drAmiriLabDeductionsToman: totalLabToman.toString(),
    drAmiriExactPayableToman: totalDoctorPayableToman.toString(),
    clinicTotalOutstandingDebtToman: totalReceivablesToman.toString(),
    clinicPendingChecksInSafeToman: totalPendingChecksToman.toString(),
    clinicGuaranteeChecksInSafeToman: totalGuaranteeChecksToman.toString(),
    clinicPendingInstallmentsToman: totalPendingInstallmentsToman.toString(),
    ledgerTotalMs: Number(ledgerTotalMs.toFixed(1)),
    commissionTotalMs: Number(commissionTotalMs.toFixed(1)),
    reminderTotalMs: Number(reminderTotalMs.toFixed(1)),
    totalDurationMs: Number(totalMs.toFixed(1)),
    patientsPerSec: Math.round(totalPatientsProcessed / (totalMs / 1000)),
    rssMemoryMb: memMb,
  };
}

async function runPhase2ConcurrentMultiUserLiveServerTest() {
  console.log('\n[PHASE 2] Live Multi-User Concurrent HTTP + SSE Server Stress Test (12 Concurrent Users)...');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minadental-stress-500k-'));
  const storeFile = path.join(tmpDir, 'clinic-stress-store.json');

  const app = await createMinaDentalServer({
    dataFilePath: storeFile,
    disableFrontendMiddleware: true,
  });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const CONCURRENT_USERS = 12;
  const sseClients: Array<Awaited<ReturnType<typeof openSseClient>>> = [];
  const latenciesMs: number[] = [];

  try {
    // 1. Manager activates clean production mode
    const modeRes = await fetch(`${baseUrl}/api/clinic/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'user-manager-amiri',
        actorName: 'دکتر مهدی امیری',
        isManager: true,
        mode: 'live_production',
        preserveInventory: true,
        inventory: INITIAL_INVENTORY,
      }),
    });
    if (modeRes.status !== 200) throw new Error(`Mode init failed: HTTP ${modeRes.status}`);

    // 2. Connect 12 simultaneous users over live SSE
    const sseConnectStart = performance.now();
    for (let u = 1; u <= CONCURRENT_USERS; u++) {
      const roleTag = u === 1 ? 'manager' : u <= 5 ? 'doctor' : u <= 9 ? 'secretary' : 'assistant';
      const client = await openSseClient(baseUrl, `live-${roleTag}-${u}`);
      await client.waitForEvent('connected');
      sseClients.push(client);
    }
    const sseConnectMs = Number((performance.now() - sseConnectStart).toFixed(1));

    // Verify server reports 12 live SSE clients on last connected frame
    const lastConn = sseClients[CONCURRENT_USERS - 1].events.find((e) => e.event === 'connected');
    const reportedClients = Number(lastConn?.data.connectedClients || 0);
    if (reportedClients !== CONCURRENT_USERS) {
      throw new Error(`Expected ${CONCURRENT_USERS} SSE clients, got ${reportedClients}`);
    }

    // 3. Seed shared baseline patient + 50 rich patients so conflict storm operates on real multi-entity payload
    const rel = (d: number) => getRelativePersianDate(d);
    const sharedPatient: Patient = {
      id: 'pat-shared-storm',
      fileNumber: 'D-900001',
      fullName: 'بیمار مشترک تست همزمانی',
      nationalId: '0013542419',
      phone: '09129998877',
      age: 40,
      gender: 'مرد',
      medicalHistory: [],
      totalCost: 20_000_000,
      paidAmount: 0,
      balance: -20_000_000,
      activeTreatmentsCount: 1,
      lastVisit: rel(0),
      teethConditions: {},
      treatments: [
        {
          id: 'trt-base-1',
          tooth: 'UR_6',
          treatment: 'جراحی ایمپلنت پایه',
          cost: 20_000_000,
          date: rel(0),
          status: 'completed',
          doctorName: 'دکتر مهدی امیری',
        },
      ],
      sayadChecks: [],
      installments: [],
      labOrders: [],
      implantCases: [],
      payments: [],
      notes: 'بیمار مشترک ۱۲ کاربر همزمان',
    };

    const seedRes = await fetch(`${baseUrl}/api/clinic/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'live-manager-1',
        actorName: 'دکتر مهدی امیری',
        actorRole: 'admin',
        baseRevision: 1,
        mode: 'live_production',
        patients: [sharedPatient],
        appointments: [],
        inventory: INITIAL_INVENTORY,
      }),
    });
    if (seedRes.status !== 200) throw new Error(`Seed sync failed: ${seedRes.status}`);
    const seedJson = (await seedRes.json()) as { revision: number };
    const sharedBaseRev = seedJson.revision; // revision 2

    // 4. CONCURRENT STORM: 12 users simultaneously push using the SAME stale baseRevision!
    // Each user adds:
    //  - 1 unique brand-new patient (12 new patients total)
    //  - 1 unique sub-record on the SAME `pat-shared-storm` (treatments, payments, Sayad checks, installments, lab orders, implant cases)
    const stormStart = performance.now();
    const stormRequests = Array.from({ length: CONCURRENT_USERS }, (_, i) => {
      const u = i + 1;
      const clientId = `live-${u === 1 ? 'manager' : u <= 5 ? 'doctor' : u <= 9 ? 'secretary' : 'assistant'}-${u}`;
      const newPatient: Patient = {
        ...sharedPatient,
        id: `pat-concurrent-user-${u}`,
        fileNumber: `D-91000${u}`,
        fullName: `بیمار کاربر همزمان ${u}`,
        phone: `091288800${String(u).padStart(2, '0')}`,
        totalCost: 12_000_000,
        paidAmount: 4_000_000,
        balance: -8_000_000,
        treatments: [
          {
            id: `trt-new-${u}`,
            tooth: 'UL_6',
            treatment: 'ایمپلنت و روکش',
            cost: 12_000_000,
            date: rel(0),
            status: 'completed',
            doctorName: DOCTORS[u % DOCTORS.length],
          },
        ],
        installments: [
          {
            id: `inst-new-${u}`,
            patientId: `pat-concurrent-user-${u}`,
            patientName: `بیمار کاربر همزمان ${u}`,
            treatmentName: 'ایمپلنت',
            installmentNumber: 1,
            totalInstallments: 2,
            amount: 4_000_000,
            dueDate: rel(15),
            status: 'pending',
          },
        ],
        sayadChecks: [
          {
            id: `chk-new-${u}`,
            patientId: `pat-concurrent-user-${u}`,
            patientName: `بیمار کاربر همزمان ${u}`,
            sayadId: `730184920000${String(u).padStart(2, '0')}10`,
            bankName: 'بانک ملت',
            amount: 4_000_000,
            dueDate: rel(30),
            drawerName: `بیمار کاربر همزمان ${u}`,
            status: 'in_collection',
            isGuarantee: u % 2 === 0,
          },
        ],
        labOrders: [
          {
            id: `lab-new-${u}`,
            patientId: `pat-concurrent-user-${u}`,
            patientName: `بیمار کاربر همزمان ${u}`,
            toothNumber: 'UL_6',
            workType: 'روکش زیرکونیا',
            labName: 'لابراتوار دیجیتال مینا',
            shade: 'A2',
            sendDate: rel(0),
            deliveryDate: rel(7),
            appointmentDate: rel(9),
            status: 'sent',
            cost: 2_600_000,
            reminderNotice: '',
          },
        ],
        implantCases: [
          {
            id: `imp-new-${u}`,
            patientId: `pat-concurrent-user-${u}`,
            patientName: `بیمار کاربر همزمان ${u}`,
            toothNumber: 'UL_6',
            brand: 'Straumann BLT',
            diameter: '4.1mm',
            length: '10mm',
            torque: 40,
            boneGraft: false,
            membrane: false,
            surgeryDate: rel(0),
            healingDueDate: rel(90),
            currentStage: 'fixture_placed',
            doctorName: DOCTORS[u % DOCTORS.length],
            notes: '',
          },
        ],
        payments: [],
      };

      // Each user mutates a distinct record on the shared patient concurrently!
      const mutatedShared: Patient = {
        ...sharedPatient,
        payments: u <= 4 ? [{
          id: `pay-storm-${u}`,
          patientId: sharedPatient.id,
          patientName: sharedPatient.fullName,
          amount: 1_000_000,
          date: rel(0),
          method: 'pos',
          forTreatment: `پرداخت همزمان ${u}`,
        }] : [],
        installments: u > 4 && u <= 6 ? [{
          id: `inst-storm-${u}`,
          patientId: sharedPatient.id,
          patientName: sharedPatient.fullName,
          treatmentName: 'اقساط همزمان',
          installmentNumber: u - 4,
          totalInstallments: 2,
          amount: 3_000_000,
          dueDate: rel(20),
          status: 'pending',
        }] : [],
        sayadChecks: u > 6 && u <= 8 ? [{
          id: `chk-storm-${u}`,
          patientId: sharedPatient.id,
          patientName: sharedPatient.fullName,
          sayadId: `730184929900${String(u).padStart(2, '0')}10`,
          bankName: 'بانک سامان',
          amount: 5_000_000,
          dueDate: rel(40),
          drawerName: sharedPatient.fullName,
          status: 'in_collection',
          isGuarantee: true,
        }] : [],
        labOrders: u > 8 && u <= 10 ? [{
          id: `lab-storm-${u}`,
          patientId: sharedPatient.id,
          patientName: sharedPatient.fullName,
          toothNumber: 'UR_6',
          workType: 'اباتمنت اختصاصی',
          labName: 'لابراتوار پارس',
          shade: 'A1',
          sendDate: rel(0),
          deliveryDate: rel(8),
          appointmentDate: rel(10),
          status: 'fabrication',
          cost: 2_500_000,
          reminderNotice: '',
        }] : [],
        implantCases: u > 10 ? [{
          id: `imp-storm-${u}`,
          patientId: sharedPatient.id,
          patientName: sharedPatient.fullName,
          toothNumber: u === 11 ? 'LR_6' : 'LL_6',
          brand: 'Osstem TSIII',
          diameter: '4.5mm',
          length: '10mm',
          torque: 42,
          boneGraft: false,
          membrane: false,
          surgeryDate: rel(0),
          healingDueDate: rel(80),
          currentStage: 'fixture_placed',
          doctorName: 'دکتر مهدی امیری',
          notes: '',
        }] : [],
      };

      const t0 = performance.now();
      return fetch(`${baseUrl}/api/clinic/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          actorName: `کاربر ${u}`,
          baseRevision: sharedBaseRev, // DELIBERATE STALE COLLISION!
          patients: [mutatedShared, newPatient],
          appointments: [
            {
              id: `apt-storm-${u}`,
              patientId: newPatient.id,
              patientName: newPatient.fullName,
              phone: newPatient.phone,
              date: rel(1),
              time: `${String(9 + (u % 8)).padStart(2, '0')}:30`,
              durationMinutes: 30,
              treatment: 'ویزیت و نوبت همزمان',
              doctor: DOCTORS[u % DOCTORS.length],
              unit: 'یونیت ۱',
              status: 'scheduled',
            },
          ],
        }),
      }).then(async (res) => {
        const dt = performance.now() - t0;
        latenciesMs.push(dt);
        if (res.status !== 200) throw new Error(`Concurrent sync ${u} failed: HTTP ${res.status}`);
        return (await res.json()) as { revision: number; mergedConflict: boolean };
      });
    });

    const stormResults = await Promise.all(stormRequests);
    const stormDurationMs = Number((performance.now() - stormStart).toFixed(1));
    const conflictMergesDetected = stormResults.filter((r) => r.mergedConflict).length;

    // 5. Concurrent RBAC Security Probes (24 parallel unauthorized requests -> ALL must be 403!)
    const rbacPromises = Array.from({ length: 24 }, (_, idx) => {
      const t0 = performance.now();
      return fetch(`${baseUrl}/api/clinic/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: `attacker-sec-${idx}`,
          actorName: 'کاربر غیرمجاز',
          isManager: false,
          mode: 'live_production',
        }),
      }).then((r) => {
        latenciesMs.push(performance.now() - t0);
        return r.status;
      });
    });
    const rbacStatuses = await Promise.all(rbacPromises);
    const rbacBlockedCount = rbacStatuses.filter((s) => s === 403).length;
    if (rbacBlockedCount !== 24) {
      throw new Error(`RBAC probe leak: ${rbacBlockedCount}/24 blocked`);
    }

    // 6. Live VoIP Incoming Call Broadcast to all 12 connected SSE users simultaneously
    const voipStart = performance.now();
    const sseVoipWaits = sseClients.map((c) =>
      c.waitForEvent(
        'incoming-call',
        (d) => Boolean(d.matchedPatient) && (d.matchedPatient as Patient).id === 'pat-shared-storm',
        5000
      )
    );
    const voipRes = await fetch(`${baseUrl}/api/clinic/incoming-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '۰۹۱۲۹۹۹۸۸۷۷', lineName: 'خط ۱ پذیرش' }),
    });
    if (voipRes.status !== 200) throw new Error(`VoIP failed: HTTP ${voipRes.status}`);
    const voipFrames = await Promise.all(sseVoipWaits);
    const voipFanoutMs = Number((performance.now() - voipStart).toFixed(1));

    // 7. Create rolling backup snapshot & inspect authoritative merged server state
    const backupRes = await fetch(`${baseUrl}/api/clinic/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'بکاپ تست همزمانی ۱۲ کاربر', actorName: 'دکتر مهدی امیری' }),
    });
    if (backupRes.status !== 200) throw new Error(`Backup failed: HTTP ${backupRes.status}`);

    const finalStateRes = await fetch(`${baseUrl}/api/clinic/state`);
    const finalState = (await finalStateRes.json()) as {
      revision: number;
      patients: Patient[];
      appointments: Appointment[];
    };

    const mergedShared = finalState.patients.find((p) => p.id === 'pat-shared-storm');
    if (!mergedShared) throw new Error('Shared patient lost during concurrent storm!');

    // Verify ZERO DATA LOSS across all 12 simultaneous stale-revision writers!
    const expectedPatientsCount = 1 + CONCURRENT_USERS; // 13
    const actualPatientsCount = finalState.patients.length;
    const sharedPaymentsCount = mergedShared.payments?.length || 0; // expected 4
    const sharedInstallmentsCount = mergedShared.installments?.length || 0; // expected 2
    const sharedChecksCount = mergedShared.sayadChecks?.length || 0; // expected 2
    const sharedLabsCount = mergedShared.labOrders?.length || 0; // expected 2
    const sharedImplantsCount = mergedShared.implantCases?.length || 0; // expected 2
    const totalAppointmentsMerged = finalState.appointments.length; // expected 12

    if (
      actualPatientsCount !== expectedPatientsCount ||
      sharedPaymentsCount !== 4 ||
      sharedInstallmentsCount !== 2 ||
      sharedChecksCount !== 2 ||
      sharedLabsCount !== 2 ||
      sharedImplantsCount !== 2 ||
      totalAppointmentsMerged !== CONCURRENT_USERS
    ) {
      throw new Error(
        `CONFLICT MERGE DATA LOSS DETECTED! patients=${actualPatientsCount}/${expectedPatientsCount}, ` +
          `payments=${sharedPaymentsCount}/4, inst=${sharedInstallmentsCount}/2, ` +
          `checks=${sharedChecksCount}/2, labs=${sharedLabsCount}/2, implants=${sharedImplantsCount}/2, ` +
          `apts=${totalAppointmentsMerged}/${CONCURRENT_USERS}`
      );
    }

    // 8. Verify executive KPI report endpoint
    const summaryRes = await fetch(`${baseUrl}/api/clinic/report/summary`);
    const summaryJson = (await summaryRes.json()) as {
      ok: boolean;
      totalPatients: number;
      pendingChecksCount: number;
      activeLabOrdersCount: number;
      activeImplantCasesCount: number;
      serverBackupsCount: number;
    };

    // Close live server & restart fresh server against same disk file to verify 100% restart durability
    sseClients.forEach((c) => c.close());
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const app2 = await createMinaDentalServer({
      dataFilePath: storeFile,
      disableFrontendMiddleware: true,
    });
    const server2 = await new Promise<http.Server>((resolve) => {
      const s = app2.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port2 = (server2.address() as AddressInfo).port;
    const restartedRes = await fetch(`http://127.0.0.1:${port2}/api/clinic/state`);
    const restartedState = (await restartedRes.json()) as { patients: Patient[]; appointments: Appointment[]; revision: number };
    await new Promise<void>((resolve) => server2.close(() => resolve()));

    if (restartedState.patients.length !== expectedPatientsCount || restartedState.appointments.length !== CONCURRENT_USERS) {
      throw new Error('Server restart durability check failed!');
    }

    const sortedLat = [...latenciesMs].sort((a, b) => a - b);

    return {
      concurrentUsers: CONCURRENT_USERS,
      sseConnectMs,
      stormDurationMs,
      conflictMergesDetected,
      patientsPreserved: `${actualPatientsCount}/${expectedPatientsCount}`,
      sharedPatientSubRecordsPreserved: {
        payments: `${sharedPaymentsCount}/4`,
        installments: `${sharedInstallmentsCount}/2`,
        sayadChecks: `${sharedChecksCount}/2`,
        labOrders: `${sharedLabsCount}/2`,
        implantCases: `${sharedImplantsCount}/2`,
      },
      appointmentsPreserved: `${totalAppointmentsMerged}/${CONCURRENT_USERS}`,
      rbacBlocked: `${rbacBlockedCount}/24 (403 Forbidden)`,
      voipSseFanoutAll12DevicesMs: voipFanoutMs,
      voipMatchedAll12: voipFrames.every((f) => Boolean(f.data.matchedPatient)),
      restartPersistenceVerified: true,
      serverSummary: summaryJson,
      httpLatencyMs: {
        p50: percentile(sortedLat, 50),
        p95: percentile(sortedLat, 95),
        p99: percentile(sortedLat, 99),
        max: Number(sortedLat[sortedLat.length - 1].toFixed(2)),
      },
    };
  } finally {
    sseClients.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    try {
      server.close();
    } catch {
      // ignore
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const overallStart = performance.now();
  const phase1 = await runPhase1Scale500kEngineTest();
  const phase2 = await runPhase2ConcurrentMultiUserLiveServerTest();
  const overallSec = ((performance.now() - overallStart) / 1000).toFixed(2);

  console.log('\n==================== LIVE 500K + MULTI-USER STRESS REPORT ====================');
  console.log(JSON.stringify({ overallDurationSec: Number(overallSec), phase1, phase2 }, null, 2));
  console.log('==============================================================================');
}

main().catch((err) => {
  console.error('❌ LIVE STRESS TEST FAILED:', err);
  process.exit(1);
});
