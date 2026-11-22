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
  | 'bleaching'
  | 'pulpotomy'
  | 'pulpectomy'
  | 'ss_crown'
  | 'fissure_sealant'
  | 'fluoride'
  | 'space_maintainer';

export interface ToothConditionHistoryEntry {
  treatment: TreatmentType;
  status: 'planned' | 'in_progress' | 'completed';
  date: string;
  cost: number;
  doctorName?: string;
  notes?: string;
  surfaces?: ToothSurface[];
}

export interface ToothCondition {
  quadrant: 'UR' | 'UL' | 'LL' | 'LR';
  toothNumber: number; // 1-8
  surfaces: ToothSurface[];
  treatment: TreatmentType;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
  surgicalNotes?: string; // یادداشت تخصصی جراحی و روت‌کانال
  cost?: number;
  baseCost?: number;
  discountPercent?: number;
  doctorName?: string;
  date?: string;
  annotations?: string; // Freehand drawing canvas overlay (Data URL / PNG)
  history?: ToothConditionHistoryEntry[];
  endoMetrics?: {
    mb1?: string;
    mb2?: string;
    ml?: string;
    dp?: string;
    masterFile?: string;
    sealerType?: string;
  };
  perioMetrics?: {
    pockets: Record<'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL', number>;
    mobility: '0' | 'I' | 'II' | 'III';
    bop: boolean;
  };
  vitalityMetrics?: {
    coldTest: 'نرمال' | 'پالپیت برگشت‌پذیر' | 'پالپیت غیرقابل‌برگشت' | 'نکروز (بدون پاسخ)';
    percussion: 'منفی (-)' | 'مثبت (+)';
    palpation: 'منفی (-)' | 'مثبت (+)';
    eptScore: string;
  };
  reminderConfig?: ReminderConfig;
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
  reminderConfig?: ReminderConfig;
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
  reminderConfig?: ReminderConfig;
}

export interface PaymentRecord {
  id: string;
  patientId: string;
  patientName: string;
  amount: number; // Toman (positive for receipt, negative for refund)
  date: string;
  method: 'pos' | 'card_to_card' | 'cash' | 'check';
  referenceNumber?: string;
  terminalName?: string;
  forTreatment: string;
  isRefund?: boolean;
  refundedAt?: string;
  reminderConfig?: ReminderConfig;
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
  marginType?: string; // نوع تراش مارجین (Chamfer, Shoulder, Knife edge)
  stumpShade?: string; // رنگ استامپ یا عاج زیرین (ND1, ND2, ...)
  translucency?: string; // میزان ترنسلوسنسی زیرکونیا (HT, MT, LT)
  instructions?: string; // دستورات بالینی پزشک به تکنسین
  courierName?: string; // نام پیک یا کد رهگیری
  trackingSlipCode?: string; // کد رهگیری قبض ارسال و دریافت مطب
  receivedAtClinicDate?: string; // تاریخ ورود و دریافت قطعه از لابراتوار در مطب
  deliveredToPatientDate?: string; // تاریخ تحویل و سمان نهایی روی دندان بیمار
  qcPassed?: boolean; // تایید کنترل کیفی در کلینیک
  reminderConfig?: ReminderConfig;
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
  sterilePackCode?: string;
  doctorName?: string;
  boneDensity?: 'D1' | 'D2' | 'D3' | 'D4';
  reminderConfig?: ReminderConfig;
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
  signatureDataUrl?: string; // اثر امضای دیجیتال لمسی بیمار
  timestamp?: string;
  cryptoHash?: string; // هش رمزنگاری SHA-256 منطبق بر ماده ۱۰ تجارت الکترونیک
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
  treatments?: any[];
  clinicalVitals?: {
    bp: string;
    pulse: string;
    spo2: string;
    asaClass: 'ASA I' | 'ASA II' | 'ASA III';
    updatedAt?: string;
  };
  periodontalBpe?: {
    S1: number;
    S2: number;
    S3: number;
    S4: number;
    S5: number;
    S6: number;
    plaqueIndexPct: number;
    updatedAt?: string;
  };
  endoMetrics?: {
    coldTest: 'نرمال (+)' | 'پالپیت حاد (++)' | 'نکروز پالپ (-)';
    workingLength: string;
    updatedAt?: string;
  };
  insuranceType?: string;
  recallMonths?: number;
  nextRecallDate?: string;
  createdAt?: string;
  notes: string;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'waiting'
  | 'in_chair'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  unit: string; // یونیت آبی، یونیت زرد، یونیت جراحی (پشتیبانی از نام‌های قبلی نیز)
  doctor: string;
  date: string; // e.g. "۱۴۰۵/۰۷/۳۰"
  time: string; // e.g. "۱۶:۳۰"
  durationMinutes: number;
  treatment: string;
  status: AppointmentStatus;
  waitingStartedAt?: string; // زمان ورود به سالن انتظار برای پایش SLA کمتر از ۲۰ دقیقه
  chairStartedAt?: string; // زمان دقیق نشستن روی یونیت برای تایمر زنده درمان
  cancellationReason?: string; // علت لغو یا عدم حضور
  reminderConfig?: ReminderConfig;
}

export interface ClinicUnitDefinition {
  id: string;
  name: string;
  doctor: string;
  accent: string;
  colorTone?: 'blue' | 'yellow' | 'purple' | 'emerald';
  borderActive: string;
  dropActive: string;
}

export interface CustomHolidayEntry {
  date: string;
  reason: string;
}

export interface ClinicScheduleSettings {
  openTime: string; // "۰۸:۳۰"
  closeTime: string; // "۲۲:۰۰"
  breakEnabled: boolean;
  breakStart: string; // "۱۳:۳۰"
  breakEnd: string; // "۱۵:۰۰"
  blockOfficialHolidays: boolean;
  doctorOffWeekdays: Record<string, number[]>; // 0=شنبه .. 6=جمعه
  customHolidays: CustomHolidayEntry[];
  customHolidayDates?: string[]; // Legacy fallback Jalali YYYY/MM/DD
}

export interface WaitlistEntry {
  id: string;
  patientId?: string;
  patientName: string;
  phone: string;
  preferredUnit: string;
  preferredDoctor?: string;
  preferredDate?: string;
  preferredShift: 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
  priority?: 'normal' | 'urgent';
  treatment: string;
  notes?: string;
  createdAt: string;
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
  barcode?: string;
  qrCode?: string;
  location?: string;
}

export type RoleType = 'admin' | 'doctor' | 'secretary' | 'accountant' | 'assistant' | 'lab_tech';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: RoleType;
  assignedPlatform: string; // e.g. "یونیت ۱", "پذیرش و صندوق", "مدیریت کلینیک"
  avatarColor: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  phone?: string;
  medicalLicense?: string; // شماره نظام پزشکی
  isActive?: boolean;
  isManager?: boolean; // آیا این کاربر مدیر کلینیک با دسترسی کامل است؟
  isDoctor?: boolean; // آیا این کاربر دندانپزشک معالج است؟
  isManagerAndDoctor?: boolean; // مدیر کلینیک که همزمان پزشک معالج نیز می‌باشد (مانند دکتر مهدی امیری)
  permissions: {
    canManageAppointments: boolean;
    canRegisterTreatments: boolean;
    canCollectPayments: boolean;
    canManageChecks: boolean;
    canAccessSettingsAndUsers: boolean;
    canBackupAndRestore: boolean;
    canEditPrices?: boolean; // حق ویرایش قیمت‌ها و تخفیف‌ها
    canDeleteRecords?: boolean; // حق حذف پرونده و سوابق
    canManageStaff?: boolean; // حق تایید حساب‌ها و تعیین سطوح دسترسی
    canViewReports?: boolean; // مشاهده گزارش‌های سود و سهم‌بندی
    canAccessLabPortal?: boolean; // ارسال و تایید کارهای لابراتوار
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

export type CommissionModel = 'lab_split_half' | 'fixed_wage' | 'percentage';

export interface DoctorCommissionRule {
  doctorId: string;
  doctorName: string;
  specialty: string;
  isManager: boolean; // دکتر مهدی امیری (مدیر)
  defaultModel: CommissionModel;
  percentageRate: number; // مثلاً ۵۰٪ یا ۱۰۰٪
  fixedWagePerTreatment: number; // دستمزد ثابت
  totalGrossWork: number; // کل کارکرد ناخالص
  totalLabDeductions: number; // کل هزینه لابراتوار کسر شده
  netPayable: number; // خالص پرداختی به پزشک
}

export interface IncomingCallEvent {
  id: string;
  phoneNumber: string;
  timestamp: string;
  matchedPatient?: Patient | null;
}

export interface AutoclaveCycle {
  id: string;
  cycleNumber: number;
  date: string;
  time: string;
  deviceModel: string;
  cycleType: '134_prion' | '134_hollow' | '121_porous' | 'bowie_dick';
  temperature: number;
  pressure: number;
  durationMinutes: number;
  operatorName: string;
  bowieDickPassed: boolean;
  sporeTestResult: 'pending' | 'negative_pass' | 'positive_fail';
  packsCount: number;
  lotBarcode: string;
  notes?: string;
}

export interface InsuranceTariffItem {
  code: string;
  title: string;
  kCoeff: number;
  tariffAmount: number;
  baseInsuranceShare: number;
  patientFranchise: number;
  category: 'تشخیصی' | 'جراحی' | 'اندو' | 'ترمیم' | 'پروتز' | 'اطفال';
}

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  nationalCode: string;
  baseInsurance: 'تامین اجتماعی' | 'بیمه سلامت ایرانیان' | 'نیروهای مسلح' | 'آزاد';
  supplementaryInsurance: 'بیمه ایران' | 'بیمه دانا' | 'بیمه آسیا' | 'بیمه البرز' | 'آتیه‌سازان حافظ' | 'فاقد بیمه تکمیلی';
  policyNumber: string;
  date: string;
  doctorName: string;
  doctorMedicalCode: string;
  items: {
    code: string;
    description: string;
    toothNumber: string;
    totalFee: number;
    baseShare: number;
    supplementaryShare: number;
    patientShare: number;
  }[];
  totalAmount: number;
  totalInsurancePayable: number;
  status: 'draft' | 'approved' | 'sent_to_insurer' | 'paid';
  trackingBarcode: string;
}

export interface SmsGatewayConfig {
  provider: 'kavenegar' | 'farapayamak' | 'melipayamak';
  apiKey: string;
  senderNumber: string;
  serviceLine: boolean;
  templates: {
    appointmentConfirmPattern: string;
    appointmentReminder24hPattern: string;
    installmentDuePattern: string;
    birthdayGreetingPattern: string;
    neshanMapUrl: string;
  };
  isActive: boolean;
  remainingCreditSms: number;
}

export interface OnlineBookingRequest {
  id: string;
  trackingCode: string;
  patientName: string;
  phone: string;
  nationalCode: string;
  serviceTitle: string;
  doctorName: string;
  date: string;
  time: string;
  depositAmount: number;
  paymentRefNumber: string;
  healthIntake: {
    hasHighBloodPressure: boolean;
    hasDiabetes: boolean;
    hasHeartDisease: boolean;
    hasDrugAllergy: boolean;
    isPregnant: boolean;
    takesBloodThinners: boolean;
    allergyDetails?: string;
  };
  status: 'confirmed' | 'pending_call' | 'checked_in';
  createdAt: string;
}

export interface PeriodontalPocketMeasurement {
  mesioBuccal: number;   // 1-12 mm
  midBuccal: number;
  distoBuccal: number;
  mesioLingual: number;
  midLingual: number;
  distoLingual: number;
  bleedingOnProbing: boolean[]; // 6 booleans
  suppuration: boolean[];
  mobility: 0 | 1 | 2 | 3;
  furcationClass?: 0 | 1 | 2 | 3 | 4;
  gingivalMarginMm: number; // recession (-) or hyperplasia (+)
}

export interface DicomStudyRecord {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopClassUid: string; // e.g. 1.2.840.10008.5.1.4.1.1.1.3 (Digital Intra-Oral X-Ray)
  modality: 'IO' | 'DX' | 'CT' | 'OPG';
  patientId: string;
  windowWidth: number;   // WW
  windowCenter: number;  // WL
  kvp: number;           // Kilovolts peak (e.g. 65-70 kV)
  exposureTimeMs: number;
  bitDepth: 8 | 12 | 16;
}

export interface VitalSignsRecord {
  id: string;
  patientId: string;
  recordedAt: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulseRate: number;
  oxygenSaturationSpO2: number;
  bloodGlucoseMgDl?: number;
  asaClass: 'ASA I' | 'ASA II' | 'ASA III' | 'ASA IV';
  sedationClearance: boolean;
  notes?: string;
}

export interface PediatricDosageCalculation {
  patientAgeMonths: number;
  weightKg: number;
  medicationName: string;
  standardAdultDoseMg: number;
  calculatedDoseMg: number;
  dosingFrequency: string;
  isWithinSafeMargin: boolean;
}

export interface ImmutableAuditLog {
  id: string;
  timestampUtc: string;
  practitionerId: string;
  actionType: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT_EHR' | 'PRICE_OVERRIDE' | 'DRUG_OVERRIDE';
  resourceType: string;
  recordId: string;
  clientIp: string;
  previousHash: string;
  currentHash: string;
}

export interface EndodonticCanalRecord {
  canalName: 'MB' | 'MB2' | 'DB' | 'Palatal' | 'Distal' | 'Mesial' | 'Distobuccal' | 'Distolingual';
  workingLengthMm: number;
  referencePoint: string;
  apexLocatorReadingMm: number; // e.g. -0.5 mm to apex
  masterApicalFile: string;     // e.g. #30 / 0.04
  obturationTechnique: 'Warm Vertical' | 'Continuous Wave' | 'Single Cone' | 'Cold Lateral';
}

export interface PulpalAssessment {
  coldResponse: 'normal' | 'lingering' | 'no_response';
  eptReading: number; // 0 - 80
  percussionTender: boolean;
  periapicalRadiolucency: boolean;
  pulpalDiagnosis: string;
  periapicalDiagnosis: string;
  treatmentRecommended: string;
}

export interface ElectronicPrescriptionItem {
  drugCode: string;
  drugName: string;
  doseMg: number;
  frequency: string;
  durationDays: number;
  isControlledSubstance: boolean;
  renalAdjusted: boolean;
}

export interface RadiationDosimetryRecord {
  id: string;
  modality: 'IOPA' | 'BITEWING' | 'OPG' | 'CEPH' | 'CBCT';
  effectiveDoseMicroSv: number;
  thyroidShieldUsed: boolean;
  alaraCompliant: boolean;
  recordedAt: string;
}

export interface OrthodonticCephAssessment {
  snaDegrees: number;
  snbDegrees: number;
  anbDegrees: number;
  skeletalClass: 'Class I' | 'Class II' | 'Class III';
  iotnGrade: 1 | 2 | 3 | 4 | 5;
  treatmentUrgency: string;
}

export interface InsuranceClaimCalculation {
  totalTreatmentFeeToman: number;
  baseInsuranceShareToman: number;
  supplementaryShareToman: number;
  patientFinalCopayToman: number;
  fhirClaimBundleId: string;
}

export type ReminderTimingPreset =
  | 'at_time'
  | '30m_before'
  | '2h_before'
  | '1d_before'
  | '2d_before'
  | '3d_before'
  | '1w_before'
  | 'custom';

export type ReminderChannel = 'phone_push' | 'in_app' | 'sms';

export interface ReminderConfig {
  enabled: boolean;
  preset: ReminderTimingPreset;
  customDate?: string;
  customTime?: string;
  channels: ReminderChannel[];
  note?: string;
}

export type UnifiedReminderSourceType =
  | 'appointment'
  | 'treatment'
  | 'lab'
  | 'implant'
  | 'check'
  | 'installment'
  | 'payment'
  | 'insurance'
  | 'sterilization'
  | 'inventory'
  | 'recall'
  | 'custom';

export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface UnifiedReminderRecord {
  id: string;
  sourceType: UnifiedReminderSourceType;
  sourceId?: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  title: string;
  description: string;
  targetDate: string;
  targetTime?: string;
  triggerDate: string;
  triggerTime?: string;
  channels: ReminderChannel[];
  status: 'pending' | 'snoozed' | 'done';
  snoozedUntilMs?: number;
  recurrence?: ReminderRecurrence;
  assignedTo?: string;
  confirmationStatus?: 'unconfirmed' | 'confirmed_by_patient' | 'reschedule_requested';
  targetView: string;
  createdAt: string;
}
