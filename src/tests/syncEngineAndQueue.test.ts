import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncEngine, INITIAL_USERS } from '../services/syncEngine';
import { StateSyncMessageQueue, stateSyncQueue } from '../utils/syncQueue';
import { indexedDbService } from '../services/indexedDbService';
import { computeClinicReceivablesLedger, computeDoctorWorkCommissionLedger } from '../utils/accountingEngine';
import { parseDentalProductBarcodePayload } from '../utils/qrBarcodeScanner';
import { verifyClinicDataIntegrity } from '../utils/integrityVerifier';
import { INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_INVENTORY } from '../data/mockData';
import { Patient, Appointment, InventoryItem } from '../types/dental';

describe('MinaDental SyncEngine & StateSyncMessageQueue Suite (Offline Mutations, Conflict Resolution & Reconnection)', () => {
  beforeEach(async () => {
    stateSyncQueue.clear();
    const pending = await indexedDbService.getPendingSyncOperations();
    for (const op of pending) {
      await indexedDbService.removeSyncOperation(op.opId);
    }
  });

  it('queues offline mutations across clinical entities when network is offline and broadcasts local sync event', async () => {
    const receivedEvents: any[] = [];
    const unsubscribe = syncEngine.onSyncEvent((evt) => {
      receivedEvents.push(evt);
    });

    const patientRes = await syncEngine.recordOfflineOrLiveMutation({
      entity: 'patient',
      action: 'UPSERT',
      payload: { id: 'pat-offline-101', fullName: 'سارا محمدی', totalCost: 8500000 },
      actorName: 'monshi',
      actorRole: 'secretary',
      platform: 'کانتر پذیرش',
      forceOfflineQueue: true
    });

    const checkRes = await syncEngine.recordOfflineOrLiveMutation({
      entity: 'sayad_check',
      action: 'UPSERT',
      payload: { id: 'chk-offline-202', sayadId: '1234567890123456', amount: 4000000 },
      actorName: 'hesabdar',
      actorRole: 'accountant',
      platform: 'اتاق مالی',
      forceOfflineQueue: true
    });

    unsubscribe();

    expect(patientRes.queuedOffline).toBe(true);
    expect(checkRes.queuedOffline).toBe(true);
    expect(receivedEvents.length).toBeGreaterThanOrEqual(2);

    const pendingOps = await indexedDbService.getPendingSyncOperations();
    expect(pendingOps.length).toBe(2);
    expect(pendingOps[0].entity).toBe('patient');
    expect(pendingOps[0].payload.id).toBe('pat-offline-101');
    expect(pendingOps[1].entity).toBe('sayad_check');
    expect(pendingOps[1].payload.id).toBe('chk-offline-202');
  });

  it('flushes queued offline mutations chronologically upon reconnection and preserves failed items on partial network drop', async () => {
    await syncEngine.recordOfflineOrLiveMutation({
      entity: 'patient',
      action: 'UPSERT',
      payload: { id: 'pat-flush-1', fullName: 'بیمار اول' },
      actorName: 'dr_amiri',
      actorRole: 'admin',
      platform: 'یونیت آبی',
      forceOfflineQueue: true
    });

    await syncEngine.recordOfflineOrLiveMutation({
      entity: 'appointment',
      action: 'UPSERT',
      payload: { id: 'apt-flush-2', patientName: 'بیمار اول', time: '۰۹:۳۰' },
      actorName: 'monshi',
      actorRole: 'secretary',
      platform: 'پذیرش',
      forceOfflineQueue: true
    });

    await syncEngine.recordOfflineOrLiveMutation({
      entity: 'lab_order',
      action: 'UPSERT',
      payload: { id: 'lab-flush-3', workType: 'روکش زیرکونیا' },
      actorName: 'dr_amiri',
      actorRole: 'admin',
      platform: 'یونیت آبی',
      forceOfflineQueue: true
    });

    const callOrder: string[] = [];
    let failLabOnce = true;

    const sink = {
      savePatient: vi.fn(async (p: any) => {
        callOrder.push(`patient:${p.id}`);
      }),
      saveAppointment: vi.fn(async (a: any) => {
        callOrder.push(`appointment:${a.id}`);
      }),
      saveLabOrder: vi.fn(async (l: any) => {
        if (failLabOnce) {
          failLabOnce = false;
          throw new Error('Simulated transient network drop during lab_order sync');
        }
        callOrder.push(`lab_order:${l.id}`);
      })
    };

    // First flush: patient & appointment succeed, lab_order fails and remains in outbox
    const firstFlush = await syncEngine.flushOfflineOutbox(sink);
    expect(firstFlush.flushedCount).toBe(2);
    expect(firstFlush.remainingCount).toBe(1);
    expect(callOrder).toEqual(['patient:pat-flush-1', 'appointment:apt-flush-2']);

    // Second flush after network stabilizes: remaining lab_order flushes cleanly
    const secondFlush = await syncEngine.flushOfflineOutbox(sink);
    expect(secondFlush.flushedCount).toBe(1);
    expect(secondFlush.remainingCount).toBe(0);
    expect(callOrder).toEqual([
      'patient:pat-flush-1',
      'appointment:apt-flush-2',
      'lab_order:lab-flush-3'
    ]);
  });

  it('deduplicates rapid echo messages within 3s window while allowing newer conflict-resolving state revisions', () => {
    const queue = new StateSyncMessageQueue();
    const dispatched: any[] = [];
    queue.subscribe((msg) => dispatched.push(msg));

    // First mutation from secretary
    const msg1 = queue.enqueue(
      'patients',
      'UPDATE',
      { id: 'pat-900', fullName: 'رضا علوی', totalCost: 5000000, updatedAt: 1000 },
      'local'
    );
    expect(msg1).not.toBeNull();

    // Duplicate echo of the exact same revision within 3s window -> deduplicated
    const msgDuplicate = queue.enqueue(
      'patients',
      'UPDATE',
      { id: 'pat-900', fullName: 'رضا علوی', totalCost: 5000000, updatedAt: 1000 },
      'supabase'
    );
    expect(msgDuplicate).toBeNull();

    // Concurrent revision from doctor adding a treatment (updated totalCost & updatedAt) -> accepted & dispatched
    const msgDoctorUpdate = queue.enqueue(
      'patients',
      'UPDATE',
      { id: 'pat-900', fullName: 'رضا علوی', totalCost: 9200000, updatedAt: 2000 },
      'mesh'
    );
    expect(msgDoctorUpdate).not.toBeNull();

    expect(dispatched.length).toBe(2);
    expect(dispatched[0].record.totalCost).toBe(5000000);
    expect(dispatched[1].record.totalCost).toBe(9200000);
    queue.clear();
  });

  it('handles simulated Supabase disconnection, exponential backoff retries, and clean reconnection recovery', async () => {
    const queue = new StateSyncMessageQueue();
    const statuses: string[] = [];
    queue.onConnectionChange((status) => {
      statuses.push(status);
    });

    let shouldSucceed = false;
    const reconnectSpy = vi.fn(async () => {
      if (!shouldSucceed) {
        return false; // Simulate failed reconnect attempt
      }
      return true;
    });

    queue.registerReconnectHandler(reconnectSpy);

    // Simulate network drop
    queue.reportDisconnection('Simulated WebSocket closed');
    expect(queue.getConnectionStatus()).toBe('reconnecting');
    expect(queue.getReconnectAttempts()).toBe(1);

    // Trigger manual reconnect while network is still down -> stays in reconnecting & schedules next backoff
    await queue.triggerReconnect(false);
    expect(reconnectSpy).toHaveBeenCalledTimes(1);
    expect(queue.getConnectionStatus()).toBe('reconnecting');
    expect(queue.getReconnectAttempts()).toBeGreaterThanOrEqual(2);

    // Network recovers -> triggerReconnect succeeds and resets attempts to 0
    shouldSucceed = true;
    await queue.triggerReconnect(true);
    expect(queue.getConnectionStatus()).toBe('connected');
    expect(queue.getReconnectAttempts()).toBe(0);
    expect(statuses).toContain('reconnecting');
    expect(statuses[statuses.length - 1]).toBe('connected');

    queue.clear();
  });

  it('executes full real-user end-to-end CRUD lifecycle across Patients, Palmer Chart, Appointments, Checks, Installments, Lab, Implant, Barcode Scanner & Accounting Ledger', async () => {
    // 1. Register a new patient (Secretary)
    const newPatient: Patient = {
      id: 'pat-e2e-user-1',
      fileNumber: 'MD-1405-999',
      fullName: 'کیوان شمس',
      nationalId: '0019988776',
      phone: '09129998877',
      age: 38,
      gender: 'مرد',
      lastVisit: '۱۴۰۵/۰۸/۲۴',
      balance: -24000000,
      totalCost: 24000000,
      paidAmount: 0,
      activeTreatmentsCount: 1,
      medicalHistory: ['سالم'],
      notes: 'مراجع ایمپلنت UR6',
      teethConditions: {
        UR_6: {
          quadrant: 'UR',
          toothNumber: 6,
          surfaces: ['occlusal'],
          treatment: 'implant',
          status: 'in_progress',
          cost: 24000000,
          notes: 'کاشت ایمپلنت اشترومن سوئیس',
          date: '۱۴۰۵/۰۸/۲۴',
          doctorName: 'دکتر مهدی امیری'
        }
      },
      sayadChecks: [
        {
          id: 'chk-e2e-1',
          patientId: 'pat-e2e-user-1',
          patientName: 'کیوان شمس',
          sayadId: '9876543210123456',
          bankName: 'بانک ملت',
          amount: 10000000,
          dueDate: '۱۴۰۵/۰۹/۱۵',
          drawerName: 'کیوان شمس',
          isGuarantee: false,
          status: 'in_collection'
        }
      ],
      installments: [
        {
          id: 'inst-e2e-1',
          patientId: 'pat-e2e-user-1',
          patientName: 'کیوان شمس',
          treatmentName: 'قسط اول ایمپلنت',
          installmentNumber: 1,
          totalInstallments: 2,
          amount: 7000000,
          dueDate: '۱۴۰۵/۰۹/۰۱',
          status: 'pending'
        },
        {
          id: 'inst-e2e-2',
          patientId: 'pat-e2e-user-1',
          patientName: 'کیوان شمس',
          treatmentName: 'قسط دوم ایمپلنت',
          installmentNumber: 2,
          totalInstallments: 2,
          amount: 7000000,
          dueDate: '۱۴۰۵/۱۰/۰۱',
          status: 'pending'
        }
      ],
      labOrders: [
        {
          id: 'lab-e2e-1',
          patientId: 'pat-e2e-user-1',
          patientName: 'کیوان شمس',
          labName: 'لابراتوار دیجیتال پارس',
          workType: 'روکش زیرکونیا ایمپلنت',
          toothNumber: 'UR6',
          shade: 'A2',
          sendDate: '۱۴۰۵/۰۸/۲۴',
          deliveryDate: '۱۴۰۵/۰۹/۰۵',
          appointmentDate: '۱۴۰۵/۰۹/۰۶',
          reminderNotice: '۲ روز قبل',
          status: 'sent',
          cost: 4000000
        }
      ],
      implantCases: [
        {
          id: 'imp-e2e-1',
          patientId: 'pat-e2e-user-1',
          patientName: 'کیوان شمس',
          toothNumber: 'UR6',
          brand: 'Straumann (اشترومن سوئیس)',
          diameter: '4.1',
          length: '10',
          surgeryDate: '۱۴۰۵/۰۸/۲۴',
          healingDueDate: '۱۴۰۵/۱۱/۲۴',
          currentStage: 'fixture_placed',
          torque: 35,
          boneGraft: false,
          membrane: false,
          notes: 'ثبات اولیه عالی'
        }
      ],
      payments: [
        {
          id: 'pay-e2e-1',
          patientId: 'pat-e2e-user-1',
          patientName: 'کیوان شمس',
          amount: 7000000,
          date: '۱۴۰۵/۰۸/۲۴',
          method: 'pos',
          forTreatment: 'پیش‌پرداخت ایمپلنت UR6'
        }
      ],
      prescriptions: [],
      consents: []
    };

    await indexedDbService.savePatient(newPatient);

    // 2. Book an appointment for 22:30 (10:30 PM within 08:00-23:00 window)
    const newApt: Appointment = {
      id: 'apt-e2e-1',
      patientId: newPatient.id,
      patientName: newPatient.fullName,
      phone: newPatient.phone,
      time: '۲۲:۳۰',
      date: '۱۴۰۵/۰۸/۲۴',
      durationMinutes: 45,
      treatment: 'جراحی کاشت فیکسچر ایمپلنت UR6',
      status: 'in_chair',
      unit: 'یونیت جراحی',
      doctor: 'دکتر مهدی امیری'
    };
    await indexedDbService.saveAppointment(newApt);

    // 3. Modify patient data: Clear the Sayad check (10M), pay 1st installment (7M), advance Lab to delivered_cemented, advance Implant to crown_delivered
    const updatedPatient: Patient = {
      ...newPatient,
      fileNumber: 'MD-1405-1000',
      paidAmount: 17000000,
      balance: -7000000,
      teethConditions: {
        ...newPatient.teethConditions,
        UR_6: {
          ...newPatient.teethConditions.UR_6,
          status: 'completed'
        }
      },
      sayadChecks: newPatient.sayadChecks.map((c) => ({ ...c, status: 'cleared' })),
      installments: (newPatient.installments || []).map((ins, idx) =>
        idx === 0 ? { ...ins, status: 'paid', paidDate: '۱۴۰۵/۰۸/۲۴', paymentMethod: 'pos' } : ins
      ),
      labOrders: newPatient.labOrders.map((l) => ({ ...l, status: 'delivered_cemented' })),
      implantCases: newPatient.implantCases.map((imp) => ({ ...imp, currentStage: 'crown_delivered' }))
    };
    await indexedDbService.savePatient(updatedPatient);

    // 4. Scan a GS1-128 Implant barcode and register in Inventory
    const scannedProduct = parseDentalProductBarcodePayload('(01)07613327018493(17)281231(10)STR-BLX-99(30)12');
    expect(scannedProduct).not.toBeNull();
    expect(scannedProduct?.lotNumber).toBe('STR-BLX-99');
    expect(scannedProduct?.suggestedQuantity).toBe(12);

    const newInvItem: InventoryItem = {
      id: 'inv-e2e-scanned',
      name: scannedProduct?.name || 'فیکسچر ایمپلنت اشترومن',
      category: scannedProduct?.category || 'ایمپلنت و جراحی',
      stock: scannedProduct?.suggestedQuantity || 12,
      minAlert: 5,
      unit: scannedProduct?.unit || 'عدد',
      expiryDate: scannedProduct?.expiryDate || '۱۴۰۷/۱۰/۱۱',
      pricePerUnit: scannedProduct?.pricePerUnit || 14500000,
      barcode: scannedProduct?.barcode || '07613327018493'
    };

    // 5. Verify Accounting Split-Ledger & Doctor Commission after modifications
    const clinicLedger = computeClinicReceivablesLedger([updatedPatient]);
    expect(clinicLedger.totalRegisteredClinicWork).toBe(24000000);
    expect(clinicLedger.totalCollectedCashAndPos).toBe(17000000);
    expect(clinicLedger.totalClearedChecks).toBe(10000000);
    expect(clinicLedger.totalOutstandingPatientDebtToClinic).toBe(7000000);

    // Doctor commission: Gross 24,000,000 - Lab 4,000,000 = 20,000,000 Net Commissionable Base
    const doctorLedger = computeDoctorWorkCommissionLedger([updatedPatient], {
      doctorId: 'doc-amiri',
      doctorName: 'دکتر مهدی امیری',
      specialty: 'جراح و مدیر کلینیک',
      isManager: true,
      model: 'lab_split_half',
      percentageRate: 50,
      fixedWagePerTreatment: 0
    });
    expect(doctorLedger.totalRegisteredGrossWork).toBe(24000000);
    expect(doctorLedger.totalAssignedLabDeductions).toBe(4000000);
    expect(doctorLedger.netCommissionableBase).toBe(20000000);
    expect(doctorLedger.exactDoctorPayable).toBe(10000000);

    // 6. Verify Silent Data Integrity Shield across all updated collections
    const integrity = verifyClinicDataIntegrity(
      [...INITIAL_PATIENTS, updatedPatient],
      [...INITIAL_APPOINTMENTS, newApt],
      [...INITIAL_INVENTORY, newInvItem],
      INITIAL_USERS
    );
    expect(integrity.allPassed).toBe(true);
    expect(integrity.ledgerBalanceDeltaToman).toBe(0);
    expect(integrity.integritySeal).toMatch(/^MD-VER-/);
  });
});

