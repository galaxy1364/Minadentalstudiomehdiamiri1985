import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  enforceServerPriceAndRoleGuard,
  type SqlClinicStoreSnapshot,
} from '../db/clinicRepository';
import { createMinaDentalServer } from '../../server';

describe('Cloud SQL Multi-User RBAC, Price-Lock Guard & Workspace SSE Isolation', () => {
  const baseStore: SqlClinicStoreSnapshot = {
    initialized: true,
    revision: 5,
    mode: 'live_production',
    updatedAt: '2026-11-22T10:00:00.000Z',
    updatedBy: 'دکتر مهدی امیری',
    patients: [
      {
        id: 'pat-101',
        fileNumber: '1001',
        fullName: 'علی رضایی',
        phone: '09121112233',
        totalCost: 18_000_000,
        paidAmount: 8_000_000,
        balance: -10_000_000,
        treatments: [
          {
            id: 'tx-1',
            title: 'ایمپلنت اشترومن سوئیس',
            cost: 18_000_000,
            discount: 0,
            doctor: 'دکتر مهدی امیری',
          },
        ],
      },
      {
        id: 'pat-102',
        fileNumber: '1002',
        fullName: 'مریم احمدی',
        phone: '09123334455',
        totalCost: 4_500_000,
        paidAmount: 4_500_000,
        balance: 0,
        treatments: [
          {
            id: 'tx-2',
            title: 'عصب‌کشی مولر اول',
            cost: 4_500_000,
            discount: 0,
          },
        ],
      },
    ],
    appointments: [],
    inventory: [],
    users: [
      { id: 'u-1', name: 'دکتر مهدی امیری', role: 'manager' },
      { id: 'u-2', name: 'خانم رضایی', role: 'secretary' },
    ],
    clinicConfig: {
      tariffs: [{ id: 'tr-1', name: 'ایمپلنت', price: 18_000_000 }],
    },
  };

  it('[MD-RBAC-01] blocks secretary from tampering with recorded treatment prices, deleting patients, or changing tariffs/staff', () => {
    const tamperedPatients = [
      {
        ...baseStore.patients[0],
        totalCost: 1_000_000, // Attempted price reduction
        paidAmount: 1_000_000,
        treatments: [
          {
            id: 'tx-1',
            title: 'ایمپلنت اشترومن سوئیس',
            cost: 1_000_000, // Attempted price tampering
            discount: 17_000_000,
          },
        ],
      },
      // Note: pat-102 omitted (attempted deletion by secretary)
    ];

    const res = enforceServerPriceAndRoleGuard({
      existingStore: baseStore,
      incomingPatients: tamperedPatients,
      incomingUsers: [{ id: 'u-2', name: 'خانم رضایی', role: 'manager' }],
      incomingClinicConfig: {
        tariffs: [{ id: 'tr-1', name: 'ایمپلنت', price: 100 }],
      },
      canEditPrices: false,
      isManager: false,
    });

    expect(res.enforcedViolations.length).toBeGreaterThanOrEqual(4);
    // Both patients must survive
    expect(res.patients.length).toBe(2);
    const p1 = res.patients.find((p) => p.id === 'pat-101') as Record<string, any>;
    expect(p1.totalCost).toBe(18_000_000);
    expect(p1.treatments[0].cost).toBe(18_000_000);
    expect(p1.treatments[0].discount).toBe(0);
    // Balance recalculated accurately using protected totalCost
    expect(p1.balance).toBe(1_000_000 - 18_000_000);
    // Staff and tariffs remain untouched
    expect(res.users).toEqual(baseStore.users);
    expect(res.clinicConfig.tariffs).toEqual(baseStore.clinicConfig.tariffs);
  });

  it('[MD-RBAC-02] allows secretary to admit a brand-new patient and record new treatments without triggering violations', () => {
    const withNewPatient = [
      ...baseStore.patients,
      {
        id: 'pat-103',
        fileNumber: '1003',
        fullName: 'حسین کریمی',
        phone: '09127778899',
        totalCost: 3_200_000,
        paidAmount: 1_000_000,
        balance: -2_200_000,
        treatments: [{ id: 'tx-3', title: 'ترمیم کامپوزیت', cost: 3_200_000 }],
      },
    ];

    const res = enforceServerPriceAndRoleGuard({
      existingStore: baseStore,
      incomingPatients: withNewPatient,
      canEditPrices: false,
      isManager: false,
    });

    expect(res.enforcedViolations).toEqual([]);
    expect(res.patients.length).toBe(3);
  });

  it('[MD-RBAC-03] allows server-verified manager to adjust prices, tariffs, and staff list cleanly', () => {
    const updatedPatients = [
      {
        ...baseStore.patients[0],
        totalCost: 16_500_000,
        treatments: [
          {
            id: 'tx-1',
            title: 'ایمپلنت اشترومن سوئیس',
            cost: 16_500_000,
            discount: 1_500_000,
          },
        ],
      },
    ];

    const res = enforceServerPriceAndRoleGuard({
      existingStore: baseStore,
      incomingPatients: updatedPatients,
      incomingClinicConfig: {
        tariffs: [{ id: 'tr-1', name: 'ایمپلنت', price: 20_000_000 }],
      },
      canEditPrices: true,
      isManager: true,
    });

    expect(res.enforcedViolations).toEqual([]);
    expect(res.patients.length).toBe(1);
    expect((res.patients[0] as Record<string, any>).totalCost).toBe(16_500_000);
    expect((res.clinicConfig.tariffs as Array<any>)[0].price).toBe(20_000_000);
  });

  describe('Live HTTP Auth & Workspace SSE Isolation Endpoints', () => {
    let server: http.Server;
    let baseUrl = '';
    let tmpDir = '';

    beforeAll(async () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minadental-rbac-test-'));
      const dataFilePath = path.join(tmpDir, 'clinic-test-store.json');
      const app = await createMinaDentalServer({
        dataFilePath,
        disableFrontendMiddleware: true,
      });
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address();
          const port = typeof addr === 'object' && addr ? addr.port : 0;
          baseUrl = `http://127.0.0.1:${port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('[MD-RBAC-04] rejects unauthenticated and forged requests on member management and workspace SSE ticket/stream endpoints', async () => {
      const r1 = await fetch(`${baseUrl}/api/sql/clinic/members`);
      expect(r1.status).toBe(401);

      const r2 = await fetch(`${baseUrl}/api/sql/clinic/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer forged.invalid.token',
        },
        body: JSON.stringify({
          email: 'secretary@gmail.com',
          displayName: 'منشی',
          role: 'secretary',
        }),
      });
      expect(r2.status).toBe(401);

      const r3 = await fetch(`${baseUrl}/api/sql/clinic/members/1`, {
        method: 'DELETE',
      });
      expect(r3.status).toBe(401);

      const r4 = await fetch(`${baseUrl}/api/sql/clinic/stream-ticket`, {
        method: 'POST',
      });
      expect(r4.status).toBe(401);

      const r5 = await fetch(
        `${baseUrl}/api/sql/clinic/stream?ticket=invalid_ticket_forged_123`
      );
      expect(r5.status).toBe(401);
    });
  });
});
