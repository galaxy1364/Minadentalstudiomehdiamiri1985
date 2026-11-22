import {
  Patient,
  Appointment,
  InventoryItem,
  LabOrder,
  ImplantCase,
  SayadCheck
} from '../types/dental';
import { toPersianDigits, formatToman, isSamePersianDate, getCurrentPersianDate } from './jalali';

export interface Patient360Summary {
  patientId: string;
  debtAmount: number;
  bouncedChecksCount: number;
  pendingChecksCount: number;
  overdueInstallmentsCount: number;
  unpaidInstallmentsCount: number;
  guaranteeChecksCount: number;
  guaranteeReadyForReturn: boolean;
  readyLabOrders: LabOrder[];
  tryInLabOrders: LabOrder[];
  activeImplants: ImplantCase[];
  nextAppointment?: Appointment;
  todayAppointment?: Appointment;
  hasSystemicAlert: boolean;
  systemicAlertText: string;
  priorityScore: number;
}

export type SmartActionSeverity = 'critical' | 'warning' | 'info';

export type SmartActionKind =
  | {
      type: 'schedule_appointment';
      patientId: string;
      patientName: string;
      phone: string;
      suggestedTreatment: string;
      suggestedUnit?: string;
    }
  | {
      type: 'open_patient_tab';
      patientId: string;
      tab: 'treatments' | 'financial' | 'lab' | 'implant';
    }
  | {
      type: 'open_module';
      viewId: string;
    };

export interface GlobalSmartAction {
  id: string;
  severity: SmartActionSeverity;
  moduleLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
  payload: SmartActionKind;
}

export interface UniversalSearchHit {
  id: string;
  category: 'بیمار' | 'چک صیادی' | 'لابراتوار' | 'ایمپلنت' | 'نوبت' | 'انبار';
  title: string;
  subtitle: string;
  patientId?: string;
  patientTab?: 'treatments' | 'financial' | 'lab' | 'implant';
  targetView?: string;
}

const NORMALIZE_CHAR_MAP: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  'ي': 'ی',
  'ك': 'ک',
  'آ': 'ا',
  'إ': 'ا',
  'أ': 'ا',
  'ة': 'ه',
  'ئ': 'ی',
  'ء': ''
};

export function normalizeClinicalQuery(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[۰-۹يكآإأةئء]/g, (ch) => NORMALIZE_CHAR_MAP[ch] ?? ch)
    .replace(/[-_/\s٬,]/g, '')
    .trim();
}

export function analyzePatient360(
  patient: Patient,
  appointments: Appointment[] = [],
  todayJalali: string = getCurrentPersianDate()
): Patient360Summary {
  const debtAmount = patient.balance < 0 ? Math.abs(patient.balance) : 0;

  let bouncedChecksCount = 0;
  let pendingChecksCount = 0;
  let guaranteeChecksCount = 0;
  let hasActiveGuarantee = false;
  const checks = patient.sayadChecks;
  if (checks && checks.length > 0) {
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      if (c.status === 'bounced') bouncedChecksCount++;
      else if (c.status === 'in_collection') pendingChecksCount++;
      if (c.isGuarantee) {
        guaranteeChecksCount++;
        if (c.status !== 'cleared' && c.status !== 'returned') {
          hasActiveGuarantee = true;
        }
      }
    }
  }

  let overdueInstallmentsCount = 0;
  let unpaidInstallmentsCount = 0;
  const installments = patient.installments;
  if (installments && installments.length > 0) {
    for (let i = 0; i < installments.length; i++) {
      if (installments[i].status !== 'paid') {
        unpaidInstallmentsCount++;
        if (installments[i].status === 'overdue') overdueInstallmentsCount++;
      }
    }
  }

  const guaranteeReadyForReturn = hasActiveGuarantee && unpaidInstallmentsCount === 0 && debtAmount === 0;

  const readyLabOrders: LabOrder[] = [];
  const tryInLabOrders: LabOrder[] = [];
  const labOrders = patient.labOrders;
  if (labOrders && labOrders.length > 0) {
    for (let i = 0; i < labOrders.length; i++) {
      const l = labOrders[i];
      if (l.status === 'ready_for_clinic') readyLabOrders.push(l);
      else if (l.status === 'frame_try_in') tryInLabOrders.push(l);
    }
  }

  const activeImplants: ImplantCase[] = [];
  const implantCases = patient.implantCases;
  if (implantCases && implantCases.length > 0) {
    for (let i = 0; i < implantCases.length; i++) {
      if (implantCases[i].currentStage !== 'crown_delivered') {
        activeImplants.push(implantCases[i]);
      }
    }
  }

  let nextAppointment: Appointment | undefined;
  let todayAppointment: Appointment | undefined;
  for (let i = 0; i < appointments.length; i++) {
    const a = appointments[i];
    if (
      (a.patientId === patient.id || a.patientName === patient.fullName) &&
      a.status !== 'cancelled' &&
      a.status !== 'completed'
    ) {
      if (!nextAppointment) nextAppointment = a;
      if (!todayAppointment && isSamePersianDate(a.date, todayJalali)) {
        todayAppointment = a;
        nextAppointment = a;
        break;
      }
    }
  }

  const medAlerts = (patient.medicalHistory || []).filter(Boolean);
  const hasSystemicAlert = medAlerts.length > 0;
  const systemicAlertText = medAlerts.join(' · ');

  let priorityScore = 0;
  if (bouncedChecksCount > 0) priorityScore += 40;
  if (overdueInstallmentsCount > 0) priorityScore += 25;
  if (readyLabOrders.length > 0) priorityScore += 30;
  if (hasSystemicAlert) priorityScore += 15;
  if (debtAmount > 0) priorityScore += 10;

  return {
    patientId: patient.id,
    debtAmount,
    bouncedChecksCount,
    pendingChecksCount,
    overdueInstallmentsCount,
    unpaidInstallmentsCount,
    guaranteeChecksCount,
    guaranteeReadyForReturn,
    readyLabOrders,
    tryInLabOrders,
    activeImplants,
    nextAppointment,
    todayAppointment,
    hasSystemicAlert,
    systemicAlertText,
    priorityScore
  };
}

export function buildGlobalSmartActions(
  patients: Patient[] = [],
  appointments: Appointment[] = [],
  inventory: InventoryItem[] = []
): GlobalSmartAction[] {
  const actions: GlobalSmartAction[] = [];
  const todayJalali = getCurrentPersianDate();

  for (let pIdx = 0; pIdx < patients.length; pIdx++) {
    const patient = patients[pIdx];
    const summary = analyzePatient360(patient, appointments, todayJalali);

    // 1. Bounced Sayad check -> Critical Financial Follow-up
    const checks = patient.sayadChecks;
    if (checks && checks.length > 0) {
      let bouncedCheck: SayadCheck | undefined;
      for (let cIdx = 0; cIdx < checks.length; cIdx++) {
        if (checks[cIdx].status === 'bounced') {
          bouncedCheck = checks[cIdx];
          break;
        }
      }
      if (bouncedCheck) {
        actions.push({
          id: `smart-chk-${bouncedCheck.id}`,
          severity: 'critical',
          moduleLabel: 'مالی و صیاد',
          title: `چک صیادی برگشتی — ${patient.fullName}`,
          description: `چک ${bouncedCheck.bankName} به مبلغ ${formatToman(bouncedCheck.amount)} نیازمند پیگیری فوری و تسویه جایگزین است.`,
          ctaLabel: 'پرونده مالی بیمار',
          payload: { type: 'open_patient_tab', patientId: patient.id, tab: 'financial' }
        });
      }
    }

    // 2. Ready Lab Order without an active upcoming appointment -> Schedule Delivery!
    if (!summary.nextAppointment && summary.readyLabOrders.length > 0) {
      for (let lIdx = 0; lIdx < summary.readyLabOrders.length; lIdx++) {
        const lab = summary.readyLabOrders[lIdx];
        actions.push({
          id: `smart-lab-apt-${lab.id}`,
          severity: 'warning',
          moduleLabel: 'لابراتوار ⇄ نوبت‌دهی',
          title: `${lab.workType} آماده تحویل بدون نوبت — ${patient.fullName}`,
          description: `${lab.toothNumber} از «${lab.labName}» رسیده ولی هنوز نوبت تحویل در تقویم رزرو نشده است.`,
          ctaLabel: 'رزرو نوبت تحویل',
          payload: {
            type: 'schedule_appointment',
            patientId: patient.id,
            patientName: patient.fullName,
            phone: patient.phone,
            suggestedTreatment: `تحویل و سمان ${lab.workType} (${lab.toothNumber})`,
            suggestedUnit: 'یونیت آبی'
          }
        });
      }
    }

    // 3. Implant in healing_cap or impression stage -> Next clinical milestone
    for (let iIdx = 0; iIdx < summary.activeImplants.length; iIdx++) {
      const imp = summary.activeImplants[iIdx];
      if (imp.currentStage === 'impression') {
        const patLabs = patient.labOrders || [];
        let hasLinkedLab = false;
        for (let lIdx = 0; lIdx < patLabs.length; lIdx++) {
          const l = patLabs[lIdx];
          if (l.status !== 'delivered_cemented' && (l.toothNumber === imp.toothNumber || l.workType.includes('ایمپلنت'))) {
            hasLinkedLab = true;
            break;
          }
        }
        if (!hasLinkedLab) {
          actions.push({
            id: `smart-imp-lab-${imp.id}`,
            severity: 'info',
            moduleLabel: 'ایمپلنت ⇄ لابراتوار',
            title: `نیاز به ثبت سفارش پروتز ایمپلنت — ${patient.fullName}`,
            description: `ایمپلنت ${imp.brand} (${imp.toothNumber}) در مرحله قالب‌گیری است و هنوز سفارش لابراتوار فعال ندارد.`,
            ctaLabel: 'ارسال به لابراتوار',
            payload: { type: 'open_module', viewId: 'lab' }
          });
        }
      } else if (imp.currentStage === 'healing_cap' && !summary.nextAppointment) {
        actions.push({
          id: `smart-imp-apt-${imp.id}`,
          severity: 'info',
          moduleLabel: 'ایمپلنت ⇄ نوبت‌دهی',
          title: `فراخوان قالب‌گیری ایمپلنت — ${patient.fullName}`,
          description: `فیکسچر ${imp.brand} (${imp.toothNumber}) در فاز هیلینگ (موعد ${toPersianDigits(imp.healingDueDate)}) آماده زمان‌بندی قالب‌گیری است.`,
          ctaLabel: 'رزرو نوبت قالب‌گیری',
          payload: {
            type: 'schedule_appointment',
            patientId: patient.id,
            patientName: patient.fullName,
            phone: patient.phone,
            suggestedTreatment: `قالب‌گیری پروتز ایمپلنت (${imp.toothNumber})`,
            suggestedUnit: 'یونیت جراحی'
          }
        });
      }
    }

    // 4. Overdue Installments
    if (summary.overdueInstallmentsCount > 0) {
      actions.push({
        id: `smart-inst-${patient.id}`,
        severity: 'warning',
        moduleLabel: 'اقساط و پیامک',
        title: `${toPersianDigits(summary.overdueInstallmentsCount)} قسط معوق — ${patient.fullName}`,
        description: `مانده بدهی پرونده ${formatToman(summary.debtAmount)} است و نیاز به یادآوری پیامکی دارد.`,
        ctaLabel: 'ارسال یادآوری',
        payload: { type: 'open_module', viewId: 'reminders' }
      });
    }

    // 4B. Guarantee Check ready to return to patient after full installment settlement
    if (summary.guaranteeReadyForReturn) {
      actions.push({
        id: `smart-guarantee-ret-${patient.id}`,
        severity: 'info',
        moduleLabel: 'ضمانت امانی ⇄ مالی',
        title: `چک ضمانت آماده عودت به بیمار — ${patient.fullName}`,
        description: `تمام اقساط پرونده تسویه شده است؛ لاشه چک ضمانت امانی آماده تحویل به بیمار است.`,
        ctaLabel: 'ثبت عودت ضمانت',
        payload: { type: 'open_patient_tab', patientId: patient.id, tab: 'financial' }
      });
    }
  }

  // 5. Low Inventory Cross-Check
  const lowItems: InventoryItem[] = [];
  let hasZeroStock = false;
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item.stock <= item.minAlert) {
      lowItems.push(item);
      if (item.stock === 0) hasZeroStock = true;
    }
  }
  if (lowItems.length > 0) {
    actions.push({
      id: 'smart-inv-low',
      severity: hasZeroStock ? 'critical' : 'warning',
      moduleLabel: 'انبار و متریال',
      title: `کسری موجودی ${toPersianDigits(lowItems.length)} قلم متریال مصرفی`,
      description: `اقلامی مانند «${lowItems.slice(0, 2).map((i) => i.name).join(' و ')}» به زیر حد هشدار رسیده‌اند.`,
      ctaLabel: 'ورود به انبار و خرید',
      payload: { type: 'open_module', viewId: 'inventory' }
    });
  }

  // Sort critical -> warning -> info
  const order: Record<SmartActionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return actions.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function searchClinicUniversal(
  rawQuery: string,
  patients: Patient[] = [],
  appointments: Appointment[] = [],
  inventory: InventoryItem[] = []
): UniversalSearchHit[] {
  const q = normalizeClinicalQuery(rawQuery);
  if (!q) return [];

  const hits: UniversalSearchHit[] = [];
  const pushHit = (hit: UniversalSearchHit): boolean => {
    hits.push(hit);
    return hits.length >= 14;
  };

  // 1-4. Patients, Sayad Checks, Lab Orders & Implants
  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const haystack = normalizeClinicalQuery(`${p.fullName} ${p.fileNumber} ${p.phone} ${p.nationalId || ''}`);
    if (haystack.includes(q)) {
      if (pushHit({
        id: `u-pat-${p.id}`,
        category: 'بیمار',
        title: p.fullName,
        subtitle: `پرونده ${toPersianDigits(p.fileNumber)} · ${toPersianDigits(p.phone)}${p.balance < 0 ? ` · بدهی ${formatToman(Math.abs(p.balance))}` : ''}`,
        patientId: p.id,
        patientTab: 'treatments'
      })) return hits;
    }

    const checks = p.sayadChecks;
    if (checks && checks.length > 0) {
      for (let j = 0; j < checks.length; j++) {
        const chk = checks[j];
        if (normalizeClinicalQuery(`${chk.sayadId} ${chk.bankName} ${chk.drawerName} ${chk.patientName}`).includes(q)) {
          if (pushHit({
            id: `u-chk-${chk.id}`,
            category: 'چک صیادی',
            title: `چک صیادی ${toPersianDigits(chk.sayadId)} — ${chk.patientName}`,
            subtitle: `${chk.bankName} · ${formatToman(chk.amount)} · سررسید ${toPersianDigits(chk.dueDate)}`,
            patientId: p.id,
            patientTab: 'financial'
          })) return hits;
        }
      }
    }

    const labs = p.labOrders;
    if (labs && labs.length > 0) {
      for (let j = 0; j < labs.length; j++) {
        const lab = labs[j];
        if (normalizeClinicalQuery(`${lab.workType} ${lab.toothNumber} ${lab.labName} ${lab.shade} ${lab.courierName || ''}`).includes(q)) {
          if (pushHit({
            id: `u-lab-${lab.id}`,
            category: 'لابراتوار',
            title: `${lab.workType} (${lab.toothNumber}) — ${p.fullName}`,
            subtitle: `${lab.labName} · شید ${lab.shade} · تحویل ${toPersianDigits(lab.deliveryDate)}`,
            patientId: p.id,
            patientTab: 'lab'
          })) return hits;
        }
      }
    }

    const imps = p.implantCases;
    if (imps && imps.length > 0) {
      for (let j = 0; j < imps.length; j++) {
        const imp = imps[j];
        if (normalizeClinicalQuery(`${imp.brand} ${imp.toothNumber} ${imp.notes}`).includes(q)) {
          if (pushHit({
            id: `u-imp-${imp.id}`,
            category: 'ایمپلنت',
            title: `${imp.brand} (${imp.toothNumber}) — ${p.fullName}`,
            subtitle: `فیکسچر ${toPersianDigits(imp.diameter)}×${toPersianDigits(imp.length)}mm · جراحی ${toPersianDigits(imp.surgeryDate)}`,
            patientId: p.id,
            patientTab: 'implant'
          })) return hits;
        }
      }
    }
  }

  // 5. Appointments
  for (let i = 0; i < appointments.length; i++) {
    const apt = appointments[i];
    if (normalizeClinicalQuery(`${apt.patientName} ${apt.treatment} ${apt.doctor} ${apt.unit} ${apt.date}`).includes(q)) {
      if (pushHit({
        id: `u-apt-${apt.id}`,
        category: 'نوبت',
        title: `نوبت ${apt.patientName} — ${apt.treatment}`,
        subtitle: `${toPersianDigits(apt.date)} ساعت ${toPersianDigits(apt.time)} · ${apt.unit} · ${apt.doctor}`,
        targetView: 'appointments'
      })) return hits;
    }
  }

  // 6. Inventory
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (normalizeClinicalQuery(`${item.name} ${item.category} ${item.barcode || ''} ${item.qrCode || ''}`).includes(q)) {
      if (pushHit({
        id: `u-inv-${item.id}`,
        category: 'انبار',
        title: item.name,
        subtitle: `موجودی: ${toPersianDigits(item.stock)} ${item.unit} (${item.stock <= item.minAlert ? 'کسری موجودی!' : 'کافی'})`,
        targetView: 'inventory'
      })) return hits;
    }
  }

  return hits;
}
