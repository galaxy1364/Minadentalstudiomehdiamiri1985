/**
 * Dental Management Domain Types
 */

export type ToothSurface = 'occlusal' | 'mesial' | 'distal' | 'buccal' | 'lingual' | 'rootCanal';

export type TreatmentType = 
  | 'composite'
  | 'amalgam'
  | 'endo'
  | 'crown_zirconia'
  | 'crown_pfm'
  | 'laminate'
  | 'implant'
  | 'extraction'
  | 'scaling'
  | 'bleaching';

export interface ToothCondition {
  quadrant: 'UR' | 'UL' | 'LL' | 'LR';
  toothNumber: number; // 1-8
  surfaces: ToothSurface[];
  treatment: TreatmentType;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
  cost?: number;
  date?: string;
}

export interface SayadCheck {
  id: string;
  patientId: string;
  patientName: string;
  sayadId: string; // 16 digits Sayad code
  bankName: string;
  amount: number; // in Toman
  dueDate: string; // Jalali
  drawerName: string; // صاحب چک
  status: 'in_collection' | 'cleared' | 'bounced' | 'returned';
  isGuarantee: boolean; // آیا چک ضمانت است؟
  description?: string;
}

export interface Installment {
  id: string;
  patientId: string;
  patientName: string;
  treatmentName: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number; // in Toman
  dueDate: string; // Jalali
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  paymentMethod?: 'pos' | 'card_to_card' | 'cash' | 'check';
}

export interface PaymentRecord {
  id: string;
  patientId: string;
  patientName: string;
  amount: number; // Toman
  date: string;
  method: 'pos' | 'card_to_card' | 'cash' | 'check';
  referenceNumber?: string;
  terminalName?: string;
  forTreatment: string;
}

export type LabStatus = 'sent' | 'fabrication' | 'frame_try_in' | 'ready_for_clinic' | 'delivered_cemented';

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  toothNumber: string; // e.g. "دندان ۶ بالا راست (UR6)"
  workType: string; // مثلاً روکش تمام زیرکونیا، PFM، لمینت ایمکس، اباتمنت ایمپلنت
  labName: string; // نام لابراتوار همکار
  shade: string; // رنگ مثلا A2, BL2
  sendDate: string;
  deliveryDate: string;
  appointmentDate: string;
  status: LabStatus;
  cost: number;
  reminderNotice: string;
}

export type ImplantStage = 
  | 'fixture_placed'        // مرحله ۱: کاشت فیکسچر
  | 'healing_cap'           // مرحله ۲: بستن هیلینگ کپ (پس از استئواینتگریشن)
  | 'impression'            // مرحله ۳: قالب‌گیری دیجیتال/آنالوگ
  | 'abutment_framework'    // مرحله ۴: تست فریم و اباتمنت
  | 'crown_delivered';      // مرحله ۵: تحویل نهایی روکش

export interface ImplantCase {
  id: string;
  patientId: string;
  patientName: string;
  toothNumber: string;
  brand: string; // مثلا Dentium SuperLine، SIC، Megagen AnyRidge
  diameter: string; // مثلا 4.5 mm
  length: string; // مثلا 10 mm
  torque: number; // مثلا 45 N/cm
  boneGraft: boolean;
  membrane: boolean;
  surgeryDate: string;
  healingDueDate: string;
  currentStage: ImplantStage;
  notes: string;
}

export interface PrescriptionItem {
  medicationName: string; // نام دارو و دوز
  dosage: string;         // تعداد (مثلاً ۲۰ عدد)
  instructions: string;   // دستور مصرف (مثلاً هر ۸ ساعت یک عدد بعد از غذا)
}

export interface DentalPrescription {
  id: string;
  patientId: string;
  date: string;
  doctorName: string;
  items: PrescriptionItem[];
  notes?: string;
}

export interface PatientConsent {
  id: string;
  patientId: string;
  procedureType: 'surgery_implant' | 'endo' | 'extraction' | 'prosthodontics' | 'general';
  title: string;
  signedDate: string;
  isConfirmed: boolean;
  notes?: string;
}

export interface Patient {
  id: string;
  fileNumber: string; // شماره پرونده
  fullName: string;
  nationalId: string;
  phone: string;
  age: number;
  gender: 'مرد' | 'زن';
  medicalHistory: string[]; // مثلا دیابت نوع ۲، حساسیت به پنی‌سیلین، مصرف وارفارین
  totalCost: number;
  paidAmount: number;
  balance: number; // مثبت: طلب بیمار، منفی: بدهکار
  activeTreatmentsCount: number;
  lastVisit: string;
  nextAppointment?: string;
  teethConditions: Record<string, ToothCondition>; // key: UR_6, LL_7 etc.
  sayadChecks: SayadCheck[];
  installments: Installment[];
  labOrders: LabOrder[];
  implantCases: ImplantCase[];
  payments: PaymentRecord[];
  prescriptions?: DentalPrescription[];
  consents?: PatientConsent[];
  notes: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  unit: string; // یونیت ۱، یونیت ۲، اتاق جراحی
  doctor: string;
  date: string; // e.g. "۱۴۰۳/۰۸/۱۵"
  time: string; // e.g. "۱۶:۳۰"
  durationMinutes: number;
  treatment: string;
  status: 'scheduled' | 'waiting' | 'in_chair' | 'completed' | 'cancelled';
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minAlert: number;
  expiryDate: string;
  pricePerUnit: number;
}

export type RoleType = 'admin' | 'doctor' | 'secretary' | 'accountant';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: RoleType;
  assignedPlatform: string; // e.g. "یونیت ۱", "پذیرش و صندوق", "مدیریت کلینیک"
  avatarColor: string;
  permissions: {
    canManageAppointments: boolean;
    canRegisterTreatments: boolean;
    canCollectPayments: boolean;
    canManageChecks: boolean;
    canAccessSettingsAndUsers: boolean;
    canBackupAndRestore: boolean;
  };
}

export interface PlatformDevice {
  id: string;
  deviceName: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  assignedRole: RoleType;
  assignedUser: string;
  lastSyncTime: string;
  isOnline: boolean;
}

export type SyncEventType = 
  | 'APPOINTMENT_SCHEDULED'
  | 'TREATMENT_REGISTERED'
  | 'PAYMENT_COLLECTED'
  | 'CHECK_REGISTERED'
  | 'LAB_DISPATCHED'
  | 'IMPLANT_UPDATED'
  | 'CLOUD_BACKUP_SAVED';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  timestamp: string;
  performedBy: string; // username
  role: RoleType;
  platform: string; // e.g. "پذیرش / منشی", "یونیت ۱ / پزشک"
  title: string;
  description: string;
  actionRequired?: string; // e.g. "نیازمند دریافت وجه در صندوق"
  payload?: any;
}

export interface ClinicBackupData {
  version: string;
  exportedAt: string;
  clinicName: string;
  patients: Patient[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  users: UserAccount[];
  platforms: PlatformDevice[];
}

