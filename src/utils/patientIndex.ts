/**
 * O(1) Patient Lookup Indexes & Cursor Pagination Helpers
 * Eliminates linear O(N) scans across large patient pools.
 */

import type { Patient } from '../types/dental';
import { toEnglishDigits } from './jalali';

export interface PatientLookupIndex {
  byId: Map<string, Patient>;
  byFileNumber: Map<string, Patient>;
  byPhoneLast7: Map<string, Patient>;
}

export function normalizePhoneLast7(phone?: string): string {
  if (!phone) return '';
  const clean = toEnglishDigits(phone).replace(/[^0-9]/g, '');
  return clean.length >= 7 ? clean.slice(-7) : clean;
}

export function buildPatientIndex(patients: Patient[]): PatientLookupIndex {
  const byId = new Map<string, Patient>();
  const byFileNumber = new Map<string, Patient>();
  const byPhoneLast7 = new Map<string, Patient>();

  for (const p of patients) {
    if (!p || !p.id) continue;
    byId.set(p.id, p);
    if (p.fileNumber) {
      byFileNumber.set(toEnglishDigits(p.fileNumber).trim().toUpperCase(), p);
    }
    const last7 = normalizePhoneLast7(p.phone);
    if (last7.length === 7 && !byPhoneLast7.has(last7)) {
      byPhoneLast7.set(last7, p);
    }
  }

  return { byId, byFileNumber, byPhoneLast7 };
}

export interface PaginatedSlice<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginateRecords<T>(
  records: T[],
  page: number = 1,
  pageSize: number = 50
): PaginatedSlice<T> {
  const safePageSize = Math.max(1, pageSize);
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  const items = records.slice(start, start + safePageSize);
  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasMore: safePage < totalPages
  };
}
