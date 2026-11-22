import { Appointment, Patient, ToothCondition, ToothSurface, TreatmentType } from '../types/dental';
import { calculateAnestheticCarpuleLimit, checkDrugInteractions, DrugInteractionAlert } from './clinicalSafety';
import { parseTimeMinutes, toPersianDigits } from './jalali';
import { consultDentalAi } from '../services/geminiDentalAi';

export interface EndoDiagnosisResult {
  aaeDiagnosis: string;
  apicalDiagnosis: string;
  urgency: 'normal' | 'priority' | 'emergency';
  recommendedTreatments: TreatmentType[];
  recommendedProtocol: string;
  clinicalWarning?: string;
}

export interface PerioRiskResult {
  stageLabel: string;
  maxPocketMm: number;
  meanPocketMm: number;
  deepSitesCount: number;
  riskLevel: 'low' | 'moderate' | 'high';
  prostheticWarning?: string;
  recommendedProtocol: string;
}

export interface TreatmentProtocolSpec {
  treatment: TreatmentType;
  label: string;
  chairMinutes: number;
  recommendedSessions: number;
  followUpDays: number;
  isolationRequired: 'رابردم الزامی' | 'ایزولاسیون نسبی/رول پنبه' | 'فیلد جراحی استریل';
  anesthesiaProtocol: string;
  biomaterialSpec: string;
  chairsideChecklist: string[];
  recommendedRecallMonths: number;
}

export interface ClinicalSequencingAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  toothKey?: string;
  actionHint: string;
}

export interface TreatmentSafetyProfile {
  asaClass: 'ASA I' | 'ASA II' | 'ASA III';
  hasCardiacRisk: boolean;
  hasBleedingRisk: boolean;
  hasDiabetesRisk: boolean;
  hasPenicillinAllergy: boolean;
  anestheticLimit: ReturnType<typeof calculateAnestheticCarpuleLimit>;
  systemicAlerts: string[];
  drugAlerts: DrugInteractionAlert[];
  safeAnalgesic: string;
  safeAntibiotic: string;
  anesthesiaChoice: string;
}

export interface TreatmentRoadmapItem {
  toothKey: string;
  quadrant: 'UR' | 'UL' | 'LL' | 'LR';
  toothNumber: number;
  treatment: TreatmentType;
  treatmentLabel: string;
  status: ToothCondition['status'];
  surfaces: ToothSurface[];
  cost: number;
  doctorName: string;
  date: string;
  notes?: string;
  chairMinutes: number;
  phaseId: 1 | 2 | 3 | 4;
}

export interface TreatmentRoadmapPhase {
  phaseId: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  badgeColor: 'rose' | 'amber' | 'teal' | 'sky';
  items: TreatmentRoadmapItem[];
  totalCost: number;
  completedCost: number;
  totalMinutes: number;
  completionPercent: number;
}

export interface PhasedTreatmentRoadmap {
  phases: TreatmentRoadmapPhase[];
  allItems: TreatmentRoadmapItem[];
  totalPlannedCost: number;
  completedValue: number;
  pendingCost: number;
  totalChairMinutes: number;
  completionPercent: number;
  sequencingAlerts: ClinicalSequencingAlert[];
  estimatedVisits: number;
}

export interface ClinicTreatmentQueueItem extends TreatmentRoadmapItem {
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientFileNumber: string;
  priorityLevel: 'urgent_pain' | 'sequencing_block' | 'in_progress' | 'planned' | 'completed';
  priorityLabel: string;
  hasClinicalAlert: boolean;
}

export const TREATMENT_LABELS_FA: Record<TreatmentType, string> = {
  composite: 'ترمیم کامپوزیت نانوهیبرید',
  amalgam: 'ترمیم آمالگام سیلور',
  endo: 'عصب‌کشی تخصصی (اندودانتیکس)',
  crown_zirconia: 'روکش تمام زیرکونیا CAD/CAM',
  crown_pfm: 'روکش پرسلن متال PFM',
  laminate: 'لمینت سرامیکی E-Max',
  implant: 'کاشت فیکسچر ایمپلنت',
  extraction: 'کشیدن دندان / جراحی',
  scaling: 'جرم‌گیری تخصصی و بروساژ',
  bleaching: 'بلیچینگ آفیس دو فک',
  pulpotomy: 'پالپوتومی دندان شیری',
  pulpectomy: 'پالپکتومی کامل ریشه اطفال',
  ss_crown: 'روکش استیل اطفال (SSC)',
  fissure_sealant: 'فیشورسیلنت پیشگیرانه',
  fluoride: 'فلورایدتراپی وارنیش',
  space_maintainer: 'فضا نگهدارنده اطفال',
};

const TREATMENT_PROTOCOLS: Record<TreatmentType, Omit<TreatmentProtocolSpec, 'treatment' | 'label'>> = {
  composite: {
    chairMinutes: 35,
    recommendedSessions: 1,
    followUpDays: 14,
    isolationRequired: 'رابردم الزامی',
    anesthesiaProtocol: 'اینفیلتراسیون باکال یا بلوک آلوئولار تحتانی (لیدوکائین ۲٪ + اپی‌نفرین)',
    biomaterialSpec: 'باندینگ نسل ۵ یا Universal یونیورسال + کامپوزیت نانوهیبرید لایه‌گذاری ۲mm',
    chairsideChecklist: [
      'پاک‌سازی کامل پوسیدگی با دتکتور کاریس و محافظت از پالپ نزدیک عصب (Dycal/Biodentine)',
      'ایزولاسیون با رابردم و قرارگیری وج + ماتریکس سکشنال برای کانتاکت پروگزیمال استاندارد',
      'اچ اسید فسفریک ۳۷٪ روی مینا ۱۵ ثانیه + کیورینگ تدریجی و تنظیم اکلوژن با کاغذ کاربن ۴۰ میکرون'
    ],
    recommendedRecallMonths: 6
  },
  amalgam: {
    chairMinutes: 30,
    recommendedSessions: 1,
    followUpDays: 14,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'اینفیلتراسیون یا بلوک منطقه‌ای متناسب با قوس فکی',
    biomaterialSpec: 'آمالگام کپسولی High-Copper عاری از فاز گاما-۲ + لاینر RMGI در دیواره عمیق',
    chairsideChecklist: [
      'ایجاد فرم مقاومتی و گیر مکانیکی (Convergence دیواره‌ها حداقل ۱.۵mm عمق)',
      'کاندنسیشن مرحله‌ای با پلاگر مناسب و کاروینگ دقیق مارجینال ریج',
      'آموزش پرهیز از جویدن غذای سفت تا ۲۴ ساعت و پالیش جلسه بعد'
    ],
    recommendedRecallMonths: 6
  },
  endo: {
    chairMinutes: 65,
    recommendedSessions: 1,
    followUpDays: 7,
    isolationRequired: 'رابردم الزامی',
    anesthesiaProtocol: 'بلوک عصب IANB + تزریق مکمّل اینترالیگامنتاری یا پالپی در پالپیت حاد (Hot Tooth)',
    biomaterialSpec: 'شست‌وشو NaOCl ۵.۲۵٪ + EDTA ۱۷٪ + فایل روتاری NiTi + سیلر بیوسرامیک / AH Plus',
    chairsideChecklist: [
      'ایزولاسیون قطعی با رابردم پیش از باز کردن سقف اتاقک پالپ و تعیین طول کارکرد با Apex Locator',
      'اکتیویشن اولتراسونیک هیپوکلریت سدیم و اسمیرلیر زدایی نهایی با EDTA ۱۷٪',
      'آبچوریشن سه‌بعدی، سیل کرونال موقت مستحکم و ارجاع برای بیلدآپ یا روکش محافظت‌کننده کاسپ'
    ],
    recommendedRecallMonths: 6
  },
  crown_zirconia: {
    chairMinutes: 50,
    recommendedSessions: 2,
    followUpDays: 5,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'اینفیلتراسیون موضعی جهت راحتی حین تراش ساب‌جینجیوال و نخ رترکشن',
    biomaterialSpec: 'زیرکونیا مولتی‌لیر CAD/CAM + سمان رزین سلف‌ادهزیو (G-CEM / RelyX U200)',
    chairsideChecklist: [
      'تراش مارجین Deep Chamfer ۰.۸–۱.۰mm با تیپر ۶ درجه و فضای اکلوژال ۱.۵mm',
      'قرارگیری دو نخ رترکشن (۰۰ و ۰) و قالب‌گیری دقیق سی‌سیلیکونی یا اسکن داخل دهانی',
      'ارسال شید استامپ (ND) و رنگ نهایی VITA به لابراتوار و تحویل روکش موقت با سمان غیر اوژنولی'
    ],
    recommendedRecallMonths: 6
  },
  crown_pfm: {
    chairMinutes: 50,
    recommendedSessions: 2,
    followUpDays: 5,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'اینفیلتراسیون موضعی هنگام تراش و کنترل بافت لثه',
    biomaterialSpec: 'آلیاژ کروم-کبالت و پرسلن فلدسپاتیک + سمان گلاس آینومر لوتینگ (Fuji I)',
    chairsideChecklist: [
      'تراش شولدر با باول در باکال برای پرسلن و چمفر در لینگوال',
      'بررسی مارجین فریم فلزی در جلسه Try-In پیش از پخت پرسلن نهایی',
      'کنترل نقاط تماس بین‌دندانی با نخ دندان و حذف اکلوژن تروماتیک'
    ],
    recommendedRecallMonths: 6
  },
  laminate: {
    chairMinutes: 55,
    recommendedSessions: 2,
    followUpDays: 5,
    isolationRequired: 'رابردم الزامی',
    anesthesiaProtocol: 'بی‌حسی سطحی اینفیلتراسیون زیبایی (مراقبت از خط لبخند و ریلکس بودن لب)',
    biomaterialSpec: 'لیتیوم دی‌سیلیکات IPS e.max + سمان ونیر لایت‌کیور شفاف + سیلان',
    chairsideChecklist: [
      'تراش محافظه‌کارانه درون مینا ۰.۳–۰.۵mm همراه با گاید سیلیکونی از وکس‌آپ تشخیصی',
      'اچ اسید هیدروفلوریک ۹.۵٪ روی پرسلن ۲۰ ثانیه + سیلان، اچ مینا و باندینگ جداگانه هر واحد',
      'کیور موقت ۲ ثانیه‌ای، پاک‌سازی دقیق اضافات سمان مارجینال و گلیز نهایی'
    ],
    recommendedRecallMonths: 6
  },
  implant: {
    chairMinutes: 75,
    recommendedSessions: 3,
    followUpDays: 7,
    isolationRequired: 'فیلد جراحی استریل',
    anesthesiaProtocol: 'اینفیلتراسیون دقیق با حفظ حس عصب آلوئولار تحتانی (بدون بلوک کامل در فک پایین)',
    biomaterialSpec: 'فیکسچر تیتانیوم SLA/SLActive + استئوتومی تدریجی با سرم نرمال سالین خنک + گشتاور ۳۵–۴۵ N·cm',
    chairsideChecklist: [
      'بررسی CBCT سه بعدی و فاصله ایمنی حداقل ۲ میلی‌متر از کانال عصب آلوئولار تحتانی و سینوس ماگزیلاری',
      'پروتکل دریلینگ خنک‌شونده (۸۰۰ RPM با سرم سرد) و ثبت گشتاور اولیه کاشت فیکسچر',
      'تعیین برنامه زمان‌بندی ۳ تا ۴ ماهه استئواینتگریشن و تجویز آنتی‌بیوتیک + کلرهگزیدین ۰.۱۲٪'
    ],
    recommendedRecallMonths: 4
  },
  extraction: {
    chairMinutes: 35,
    recommendedSessions: 1,
    followUpDays: 7,
    isolationRequired: 'فیلد جراحی استریل',
    anesthesiaProtocol: 'بلوک کامل ناحیه یا اینفیلتراسیون + بلوک پالاتال در فک بالا',
    biomaterialSpec: 'لوکساتور آتروماتیک + فورسپس آناتومیک + ژلاتین اسفنجی هموستاتیک / بخیه سیلک ۴-۰',
    chairsideChecklist: [
      'بررسی ریشه‌های خمیده، مجاورت با سینوس یا عصب IAN روی رادیوگرافی پیش از کشیدن',
      'لواسیون ملایم با الواتور و حفظ دیواره باکال ساکت برای کاندیدای احتمالی ایمپلنت',
      'کنترل لخته خون با گاز استریل ۳۰ دقیقه‌ای و ارائه برگ مراقبت‌های پس از جراحی'
    ],
    recommendedRecallMonths: 3
  },
  scaling: {
    chairMinutes: 40,
    recommendedSessions: 1,
    followUpDays: 14,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'ژل بی‌حسی موضعی بنزوکائین یا اینفیلتراسیون در پاکت‌های عمیق',
    biomaterialSpec: 'اسکیلر اولتراسونیک پیزوالکتریک + خمیر پروفیلاکسی کم‌سایندگی + کلرهگزیدین موضعی',
    chairsideChecklist: [
      'ارزیابی شاخص BPE شش‌گانه و ثبت نقاط خونریزی حین پروب (BOP)',
      'جرم‌گیری فوق و زیرلثه‌ای بدون آسیب به سمنتوم ریشه',
      'بروساژ، نخ‌کشی تخصصی و آموزش بهداشت بین‌دندانی (واترجت / مسواک بین‌دندانی)'
    ],
    recommendedRecallMonths: 4
  },
  bleaching: {
    chairMinutes: 50,
    recommendedSessions: 1,
    followUpDays: 7,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'بدون نیاز به بی‌حسی؛ پروفیلاکسی حساسیت با نیترات پتاسیم یا ژل فلوراید خنثی',
    biomaterialSpec: 'ژل هیدروژن پراکساید ۳۵–۴۰٪ با محافظ لثه لایت‌کیور (Gingival Barrier)',
    chairsideChecklist: [
      'ثبت شید اولیه دندان با VITA Bleachedguide پیش از شروع کار و عکسبرداری مستند',
      'پوشش کامل لثه آزاد و پاپیلاها با رزین محافظ پیش از اعمال ژل سفیدکننده',
      'دو تا سه سیکل ۱۵ دقیقه‌ای و تجویز رژیم سفید (White Diet) برای ۴۸ ساعت آینده'
    ],
    recommendedRecallMonths: 6
  },
  pulpotomy: {
    chairMinutes: 30,
    recommendedSessions: 1,
    followUpDays: 14,
    isolationRequired: 'رابردم الزامی',
    anesthesiaProtocol: 'ژل موضعی شیرین + اینفیلتراسیون/بلوک ملایم متناسب با وزن کودک',
    biomaterialSpec: 'پالپ‌کاپ بایوکمپتیبل (MTA / Biodentine یا فریک‌سولفات) + پانسمان ZOE تقویت‌شده',
    chairsideChecklist: [
      'حذف کامل سقف اتاقک پالپ کرونال و کنترل خونریزی پالپ رادیکولار زیر ۳ دقیقه با پنبه مرطوب',
      'در صورت خونریزی غیرقابل کنترل بیش از ۵ دقیقه: تغییر طرح درمان به پالپکتومی',
      'ارائه روکش SSC جهت جلوگیری از شکستگی تاج دندان شیری در جویدن'
    ],
    recommendedRecallMonths: 4
  },
  pulpectomy: {
    chairMinutes: 45,
    recommendedSessions: 1,
    followUpDays: 7,
    isolationRequired: 'رابردم الزامی',
    anesthesiaProtocol: 'تزریق آرام متناسب با وزن کودک (لیدوکائین حداکثر ۴.۴ mg/kg)',
    biomaterialSpec: 'پاکسازی ۲mm کوتاه‌تر از آپکس رادیوگرافیک + خمیر قابل جذب Metapex / ZOE',
    chairsideChecklist: [
      'تعیین دقیق طول ریشه شیری جهت پیشگیری از آسیب به جوانه دندان دائمی زیرین',
      'شست‌وشوی ملایم بدون فشار با سالین یا کلرهگزیدین رقیق',
      'آبچوریشن با خمیر قابل جذب همگام با تحلیل فیزیولوژیک ریشه و سمان روکش SSC'
    ],
    recommendedRecallMonths: 4
  },
  ss_crown: {
    chairMinutes: 25,
    recommendedSessions: 1,
    followUpDays: 14,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'اینفیلتراسیون موضعی ملایم جهت کنترل درد لثه حین تست سایز روکش',
    biomaterialSpec: 'روکش ازپیش‌ساخته 3M Stainless Steel Crown + سمان گلاس آینومر لوتینگ',
    chairsideChecklist: [
      'کاهش اکلوژال ۱.۵mm و باز کردن تماس مزیال و دیستال بدون ایجاد شولدر تیز',
      'انتخاب کوچک‌ترین سایز دارای فیت Snap-Fit در ۱mm زیر شیار لثوی',
      'پاک‌سازی کامل اضافات سمان از شیار لثوی با نخ دندان گره‌دار'
    ],
    recommendedRecallMonths: 6
  },
  fissure_sealant: {
    chairMinutes: 15,
    recommendedSessions: 1,
    followUpDays: 180,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'بدون نیاز به تزریق بی‌حسی (غیرتهاجمی و بدون درد)',
    biomaterialSpec: 'سیلنت رزینی هیدروفیلیک یا فلورایددار رهاش‌پذیر بدون حباب',
    chairsideChecklist: [
      'پاک‌سازی شیارها با پامیس فاقد فلوراید یا بروساژ خشک و شست‌وشوی کامل',
      'حفظ خشکی مطلق سطح مینا بعد از اچ ۲۰ ثانیه‌ای تا ظاهر گچی (Frosty White)',
      'تست با اکسپلورر برای اطمینان از عدم گیر مکانیکی و نبود تماس زودرس اکلوژال'
    ],
    recommendedRecallMonths: 6
  },
  fluoride: {
    chairMinutes: 15,
    recommendedSessions: 1,
    followUpDays: 180,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'کاملاً غیرتهاجمی بدون بی‌حسی',
    biomaterialSpec: 'وارنیش فلوراید سدیم ۵٪ (۲۲٬۶۰۰ ppm) تک‌دوز',
    chairsideChecklist: [
      'خشک‌کردن نسبی سطوح دندانی با رول پنبه و ساکشن بدون نیاز به جرم‌گیری تهاجمی',
      'اعمال لایه نازک وارنیش روی شیارها و سطوح بین‌دندانی ریسک‌پذیر',
      'آموزش مصرف غذای نرم و عدم مسواک‌زدن تا صبح روز بعد'
    ],
    recommendedRecallMonths: 6
  },
  space_maintainer: {
    chairMinutes: 30,
    recommendedSessions: 2,
    followUpDays: 30,
    isolationRequired: 'ایزولاسیون نسبی/رول پنبه',
    anesthesiaProtocol: 'بدون بی‌حسی یا ژل موضعی خفیف هنگام فیت بند مولار',
    biomaterialSpec: 'بند ارتودنسی و لوپ استیل لحیم‌شده (Band & Loop) + سمان گلاس آینومر',
    chairsideChecklist: [
      'اندازه‌گیری دقیق طول فضای ازدست‌رفته و کنترل عدم مزاحمت لوپ در مسیر رویش دندان دائمی',
      'اطمینان از نشست کامل لوپ روی ریج الوئولار بدون فشار یا زخم مخاطی',
      'پیگیری ۳ ماهه جهت بررسی لق‌شدگی سمان و مشاهده رویش دندان جایگزین'
    ],
    recommendedRecallMonths: 3
  }
};

export function getTreatmentClinicalProtocol(
  treatment: TreatmentType,
  toothNumber?: number,
  surfaces: ToothSurface[] = []
): TreatmentProtocolSpec {
  const base = TREATMENT_PROTOCOLS[treatment] || TREATMENT_PROTOCOLS.composite;
  const surfaceFactor =
    treatment === 'composite' || treatment === 'amalgam'
      ? Math.max(0, surfaces.length - 1) * 8
      : 0;
  const molarExtra =
    toothNumber && toothNumber >= 6 && (treatment === 'endo' || treatment === 'extraction')
      ? 15
      : 0;

  return {
    treatment,
    label: TREATMENT_LABELS_FA[treatment] || treatment,
    ...base,
    chairMinutes: base.chairMinutes + surfaceFactor + molarExtra
  };
}

/**
 * Live AAE Endodontic Differential Diagnosis from Chairside Vitality & Percussion Findings
 */
export function evaluateEndodonticDiagnosis(params: {
  coldTest: 'نرمال' | 'پالپیت برگشت‌پذیر' | 'پالپیت غیرقابل‌برگشت' | 'نکروز (بدون پاسخ)';
  percussion: 'منفی (-)' | 'مثبت (+)';
  palpation: 'منفی (-)' | 'مثبت (+)';
  eptScore?: string;
  selectedTreatment?: TreatmentType;
  surfaces?: ToothSurface[];
}): EndoDiagnosisResult {
  const { coldTest, percussion, palpation, selectedTreatment, surfaces = [] } = params;
  const apicalSymptomatic = percussion === 'مثبت (+)' || palpation === 'مثبت (+)';
  const apicalDiagnosis = apicalSymptomatic
    ? 'پریودنتیت اپیکال علامت‌دار (Symptomatic Apical Periodontitis)'
    : 'بافت پری‌اپیکال نرمال (Normal Apical Tissues)';

  let aaeDiagnosis = 'پالپ نرمال (Normal Pulp)';
  let urgency: EndoDiagnosisResult['urgency'] = 'normal';
  let recommendedTreatments: TreatmentType[] = ['composite', 'amalgam', 'fissure_sealant'];
  let recommendedProtocol = 'پالپ زنده و سالم است؛ درمان ترمیمی مستقیم بدون نیاز به اندو مجاز است.';

  if (coldTest === 'پالپیت برگشت‌پذیر') {
    aaeDiagnosis = 'پالپیت برگشت‌پذیر (Reversible Pulpitis)';
    urgency = apicalSymptomatic ? 'priority' : 'normal';
    recommendedTreatments = ['composite', 'amalgam', 'pulpotomy'];
    recommendedProtocol = 'ترمیم محافظه‌کارانه همراه با لاینر محافظ پالپ (RMGI یا کلسیم سیلیکات)؛ پیگیری تست سرما در جلسه آینده.';
  } else if (coldTest === 'پالپیت غیرقابل‌برگشت') {
    aaeDiagnosis = apicalSymptomatic
      ? 'پالپیت غیرقابل‌برگشت علامت‌دار + پریودنتیت اپیکال حاد'
      : 'پالپیت غیرقابل‌برگشت (Symptomatic/Asymptomatic Irreversible Pulpitis)';
    urgency = 'emergency';
    recommendedTreatments = ['endo', 'pulpectomy', 'extraction'];
    recommendedProtocol = 'تداخل فوری اندودانتیکس (درمان ریشه تخصصی یا پالپکتومی) با شست‌وشوی کامل NaOCl ۵.۲۵٪ و ایزولاسیون رابردم.';
  } else if (coldTest === 'نکروز (بدون پاسخ)') {
    aaeDiagnosis = apicalSymptomatic
      ? 'نکروز پالپ + آبسه/پریودنتیت اپیکال حاد (اورژانس اندو)'
      : 'نکروز پالپ (Pulp Necrosis)';
    urgency = apicalSymptomatic ? 'emergency' : 'priority';
    recommendedTreatments = ['endo', 'pulpectomy', 'extraction'];
    recommendedProtocol = 'پاکسازی شیمیایی-مکانیکی کامل کانال، پانسمان کلسیم هیدروکساید در صورت ترشح یا اکسودای فعال، سپس آبچوریشن و تاج‌سازی.';
  }

  let clinicalWarning: string | undefined;
  const isRestorativeOnly =
    selectedTreatment === 'composite' ||
    selectedTreatment === 'amalgam' ||
    selectedTreatment === 'fissure_sealant' ||
    selectedTreatment === 'laminate';

  if ((coldTest === 'پالپیت غیرقابل‌برگشت' || coldTest === 'نکروز (بدون پاسخ)') && isRestorativeOnly) {
    clinicalWarning =
      'تضاد بالینی (CDSS): پالپ غیرقابل‌برگشت/نکروز است؛ ترمیم بدون درمان ریشه (اندو) ممنوع است.';
  } else if (selectedTreatment === 'endo' && coldTest === 'نرمال' && !apicalSymptomatic && !surfaces.includes('rootCanal')) {
    clinicalWarning =
      'توجه تشخیصی: تست سرما نرمال است؛ اندیکاسیون پروتزی یا پوسیدگی عمیق را ثبت کنید.';
  }

  return {
    aaeDiagnosis,
    apicalDiagnosis,
    urgency,
    recommendedTreatments,
    recommendedProtocol,
    clinicalWarning
  };
}

/**
 * Live AAP/EFP 6-Point Periodontal Risk & Prosthetic Ante's Evaluation
 */
export function evaluatePeriodontalRisk(params: {
  pockets: Record<'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL', number>;
  mobility: '0' | 'I' | 'II' | 'III';
  bop: boolean;
  plannedTreatment?: TreatmentType;
}): PerioRiskResult {
  const { pockets, mobility, bop, plannedTreatment } = params;
  const values = Object.values(pockets);
  const maxPocketMm = values.length ? Math.max(...values) : 2;
  const meanPocketMm = values.length
    ? Math.round((values.reduce((acc, v) => acc + v, 0) / values.length) * 10) / 10
    : 2;
  const deepSitesCount = values.filter(v => v >= 4).length;

  let riskLevel: PerioRiskResult['riskLevel'] = 'low';
  let stageLabel = 'پریودنشیوم سالم (Stage 0 / Health)';
  let recommendedProtocol = 'شاخص‌های پاکت طبیعی (≤۳mm)؛ مناسب برای ترمیم و پروتز.';

  if (maxPocketMm >= 6 || mobility === 'III' || (mobility === 'II' && deepSitesCount >= 2)) {
    riskLevel = 'high';
    stageLabel = 'پریودنتیت پیشرفته (Stage III/IV · High Risk)';
    recommendedProtocol =
      'ممنوعیت تراش/سمان روکش پیش از درمان فاز ۱ پریو (SRP) و ارزیابی مجدد.';
  } else if (maxPocketMm >= 4 || mobility === 'I' || mobility === 'II' || bop) {
    riskLevel = 'moderate';
    stageLabel = bop && maxPocketMm <= 3
      ? 'ژنژیویت فعال (Gingivitis · BOP+)'
      : 'پریودنتیت خفیف تا متوسط (Stage I/II)';
    recommendedProtocol =
      'انجام جرم‌گیری و کنترل خونریزی پیش از قالب‌گیری دقیق.';
  }

  let prostheticWarning: string | undefined;
  const isProstheticOrImplant =
    plannedTreatment === 'crown_zirconia' ||
    plannedTreatment === 'crown_pfm' ||
    plannedTreatment === 'laminate' ||
    plannedTreatment === 'implant';

  if (riskLevel === 'high' && isProstheticOrImplant) {
    prostheticWarning =
      'هشدار پریو-پروتز: پاکت ≥۶mm یا لقی شدید؛ تثبیت پریودنتال پیش از روکش/ایمپلنت الزامی است.';
  } else if (bop && (plannedTreatment === 'crown_zirconia' || plannedTreatment === 'crown_pfm' || plannedTreatment === 'laminate')) {
    prostheticWarning =
      'هشدار خونریزی مارجینال (BOP+): کنترل التهاب لثه با SRP پیش از قالب‌گیری الزامی است.';
  }

  return {
    stageLabel,
    maxPocketMm,
    meanPocketMm,
    deepSitesCount,
    riskLevel,
    prostheticWarning,
    recommendedProtocol
  };
}

/**
 * Comprehensive Systemic, Allergy & Anesthetic Safety Profile for a Patient
 */
export function evaluatePatientTreatmentSafety(params: {
  patient?: Patient | null;
  weightKg?: number;
  plannedTreatment?: TreatmentType;
}): TreatmentSafetyProfile {
  const { patient, weightKg = 70, plannedTreatment } = params;
  const history = patient?.medicalHistory || [];
  const joined = history.join(' ').toLowerCase();

  const hasCardiacRisk =
    patient?.clinicalVitals?.asaClass === 'ASA III' ||
    ['قلب', 'فشار', 'آریتمی', 'آنژین', 'سکته', 'cardiac', 'hypertension', 'استنت'].some(k => joined.includes(k));

  const hasBleedingRisk = ['وارفارین', 'آسپرین', 'پلاویکس', 'ضدانعقاد', 'warfarin', 'aspirin', 'heparin'].some(k =>
    joined.includes(k)
  );
  const hasDiabetesRisk = ['دیابت', 'قند', 'diabetes', 'insulin'].some(k => joined.includes(k));
  const hasPenicillinAllergy = ['پنی‌سیلین', 'پنی سیلین', 'آموکسی', 'penicillin'].some(k => joined.includes(k));

  const asaClass: 'ASA I' | 'ASA II' | 'ASA III' =
    patient?.clinicalVitals?.asaClass ||
    (hasCardiacRisk || hasBleedingRisk ? 'ASA III' : history.length > 0 ? 'ASA II' : 'ASA I');

  const safeWeight = Math.min(160, Math.max(12, weightKg));
  const anestheticLimit = calculateAnestheticCarpuleLimit(safeWeight, hasCardiacRisk);

  const systemicAlerts: string[] = [];
  if (hasCardiacRisk) {
    systemicAlerts.push(`ریسک قلبی/فشار خون: حداکثر ${anestheticLimit.maxCarpules} کارپول با اپی‌نفرین یا ساده.`);
  }
  if (hasBleedingRisk && (plannedTreatment === 'extraction' || plannedTreatment === 'implant' || plannedTreatment === 'scaling')) {
    systemicAlerts.push('ضدانعقاد: کنترل PT/INR (< ۳.۰) و آماده‌سازی هموستاتیک پیش از اقدام.');
  }
  if (hasDiabetesRisk) {
    systemicAlerts.push('دیابت زمینه‌ای: نوبت صبحگاهی پس از صبحانه + پایش قند خون.');
  }
  if (hasPenicillinAllergy) {
    systemicAlerts.push('آلرژی پنی‌سیلین: منع آموکسی‌سیلین؛ جایگزین کلیندامایسین ۳۰۰mg یا آزیترومایسین.');
  }

  const candidateDrugAlerts = checkDrugInteractions(
    hasPenicillinAllergy ? 'Amoxicillin 500mg' : hasBleedingRisk ? 'Ibuprofen 400mg + Metronidazole' : 'Lidocaine + Epinephrine',
    history,
    history,
    history
  ).alerts;

  const safeAnalgesic = hasBleedingRisk
    ? 'استامینوفن ۵۰۰mg (بدون NSAID)'
    : 'ایبوپروفن ۴۰۰mg هر ۶–۸ ساعت';

  const safeAntibiotic = hasPenicillinAllergy
    ? 'کلیندامایسین ۳۰۰mg یا آزیترومایسین ۵۰۰mg'
    : 'آموکسی‌سیلین ۵۰۰mg هر ۸ ساعت';

  const anesthesiaChoice = hasCardiacRisk
    ? `Mepivacaine 3% ساده (یا حداکثر ${anestheticLimit.maxCarpules} کارپول اپی‌نفرین)`
    : `لیدوکائین ۲٪ + اپی‌نفرین ۱:۱۰۰٬۰۰۰ (تا ${anestheticLimit.maxCarpules} کارپول)`;

  return {
    asaClass,
    hasCardiacRisk,
    hasBleedingRisk,
    hasDiabetesRisk,
    hasPenicillinAllergy,
    anestheticLimit,
    systemicAlerts,
    drugAlerts: candidateDrugAlerts,
    safeAnalgesic,
    safeAntibiotic,
    anesthesiaChoice
  };
}

/**
 * Cross-Tooth Clinical Sequencing Engine (ADA Standard Treatment Phasing & Interdependency Guards)
 */
export function detectClinicalSequencingAlerts(
  patient: Patient,
  conditions: Array<{ key: string; cond: ToothCondition }>
): ClinicalSequencingAlert[] {
  const alerts: ClinicalSequencingAlert[] = [];
  const hasExtractionPlanned = conditions.some(c => c.cond.treatment === 'extraction' && c.cond.status !== 'completed');
  const hasBleachingActive = conditions.some(c => c.cond.treatment === 'bleaching' && c.cond.status !== 'completed');
  const hasActiveCosmeticShadeWork = conditions.some(
    c => (c.cond.treatment === 'laminate' || (c.cond.treatment === 'composite' && c.cond.toothNumber <= 3)) && c.cond.status !== 'completed'
  );
  const hasIncompleteScaling = conditions.some(c => c.cond.treatment === 'scaling' && c.cond.status !== 'completed');

  // 1. Tooth-level Endo before Crown check & Necrosis without Endo check
  conditions.forEach(({ key, cond }) => {
    const label = `${cond.quadrant}${cond.toothNumber}`;
    if ((cond.treatment === 'crown_zirconia' || cond.treatment === 'crown_pfm') && cond.status !== 'completed') {
      const hasNecrosisOrIrreversible =
        cond.vitalityMetrics?.coldTest === 'نکروز (بدون پاسخ)' ||
        cond.vitalityMetrics?.coldTest === 'پالپیت غیرقابل‌برگشت';
      if (hasNecrosisOrIrreversible) {
        alerts.push({
          id: `seq-endo-crown-${key}`,
          severity: 'critical',
          toothKey: key,
          title: `تقدم درمان ریشه پیش از روکش دندان ${label}`,
          detail: 'پالپ دندان نکروز یا پالپیت غیرقابل‌برگشت ثبت شده است؛ روکش بدون اندو قطعی ممنوع است.',
          actionHint: 'تغییر یا افزودن عصب‌کشی پیش از قالب‌گیری پروتز'
        });
      }
    }

    if (cond.vitalityMetrics && (cond.vitalityMetrics.coldTest === 'پالپیت غیرقابل‌برگشت' || cond.vitalityMetrics.coldTest === 'نکروز (بدون پاسخ)')) {
      const isNonEndo = cond.treatment !== 'endo' && cond.treatment !== 'pulpectomy' && cond.treatment !== 'extraction';
      if (isNonEndo && cond.status !== 'completed') {
        alerts.push({
          id: `seq-pulp-${key}`,
          severity: 'critical',
          toothKey: key,
          title: `نیاز قطعی به اندو در دندان ${label}`,
          detail: `تست سرما «${cond.vitalityMetrics.coldTest}» ثبت شده اما طرح درمان فعلی «${TREATMENT_LABELS_FA[cond.treatment] || cond.treatment}» است.`,
          actionHint: 'بازبینی طرح درمان در چارت پالمر'
        });
      }
    }

    if (cond.perioMetrics) {
      const perioEval = evaluatePeriodontalRisk({
        pockets: cond.perioMetrics.pockets,
        mobility: cond.perioMetrics.mobility,
        bop: cond.perioMetrics.bop,
        plannedTreatment: cond.treatment
      });
      if (perioEval.prostheticWarning && cond.status !== 'completed') {
        alerts.push({
          id: `seq-perio-${key}`,
          severity: perioEval.riskLevel === 'high' ? 'critical' : 'warning',
          toothKey: key,
          title: `هشدار پریودنتال پیش از بازسازی دندان ${label}`,
          detail: perioEval.prostheticWarning,
          actionHint: 'انجام درمان فاز ۱ پریو (SRP) و ارزیابی مجدد'
        });
      }
    }
  });

  // 2. Bleaching must precede Anterior Composite / E-Max Laminate shade selection by 14 days
  if (hasBleachingActive && hasActiveCosmeticShadeWork) {
    alerts.push({
      id: 'seq-bleach-shade',
      severity: 'warning',
      title: 'توالی زیبایی: بلیچینگ پیش از کامپوزیت/لمینت قدامی',
      detail: 'باندینگ و انتخاب رنگ لمینت یا کامپوزیت قدامی باید حداقل ۱۴ روز پس از اتمام بلیچینگ برای تثبیت شید و حذف رادیکال‌های اکسیژن انجام شود.',
      actionHint: 'اولویت‌بندی فاز سفیدکردن و ثبت فاصله ۲ هفته‌ای'
    });
  }

  // 3. Periodontal phase (Scaling) before definitive prosthetics/laminate
  const hasProstheticPlanned = conditions.some(
    c => (c.cond.treatment === 'crown_zirconia' || c.cond.treatment === 'crown_pfm' || c.cond.treatment === 'laminate') && c.cond.status !== 'completed'
  );
  if (hasIncompleteScaling && hasProstheticPlanned) {
    alerts.push({
      id: 'seq-scaling-before-pros',
      severity: 'warning',
      title: 'اولویت فاز ۲: جرم‌گیری پیش از قالب‌گیری روکش/لمینت',
      detail: 'کاهش التهاب لثه و جرم‌گیری باعث ثبت دقیق خط ختم تراش (Finish Line) و پیشگیری از تحلیل لثه پس از تحویل روکش می‌شود.',
      actionHint: 'تکمیل جلسه جرم‌گیری پیش از ارسال به لابراتوار'
    });
  }

  // 4. Pain/Extraction hygiene coordination
  if (hasExtractionPlanned) {
    const safety = evaluatePatientTreatmentSafety({ patient, plannedTreatment: 'extraction' });
    if (safety.hasBleedingRisk) {
      alerts.push({
        id: 'seq-bleeding-ext',
        severity: 'critical',
        title: 'اقدام ایمنی کشیدن دندان با سابقه ضدانعقاد',
        detail: 'در سوابق بیمار مصرف داروی ضدانعقاد/آسپرین یا وارفارین دیده می‌شود. کنترل آزمایش PT/INR پیش از جراحی یا کشیدن الزامی است.',
        actionHint: 'تجویز آزمایش INR و مشاوره پیش از جراحی'
      });
    }
  }

  // 5. Completed Endo teeth needing protective crown check
  const completedMolarEndos = conditions.filter(
    c => c.cond.treatment === 'endo' && c.cond.status === 'completed' && c.cond.toothNumber >= 5
  );
  if (completedMolarEndos.length > 0) {
    const first = completedMolarEndos[0];
    const hasLabCrown = (patient.labOrders || []).some(l => l.toothNumber.includes(`${first.cond.quadrant}`) && l.toothNumber.includes(`${first.cond.toothNumber}`));
    const hasCrownCondition = conditions.some(
      c => c.cond.quadrant === first.cond.quadrant && c.cond.toothNumber === first.cond.toothNumber && (c.cond.treatment === 'crown_zirconia' || c.cond.treatment === 'crown_pfm')
    );
    if (!hasLabCrown && !hasCrownCondition) {
      alerts.push({
        id: `seq-endo-protect-${first.key}`,
        severity: 'info',
        toothKey: first.key,
        title: `توصیه محافظت کاسپ پس از اندو دندان ${first.cond.quadrant}${first.cond.toothNumber}`,
        detail: 'دندان خلفی عصب‌کشی‌شده برای پیشگیری از شکستگی عمودی ریشه نیازمند ارزیابی روکش تمام‌سرام یا بیلدآپ پوششی است.',
        actionHint: 'ثبت روکش زیرکونیا در فاز ۳ یا اعزام به لابراتوار'
      });
    }
  }

  return alerts;
}

function getPhaseIdForTreatment(cond: ToothCondition): 1 | 2 | 3 | 4 {
  const { treatment, vitalityMetrics } = cond;
  if (
    treatment === 'endo' ||
    treatment === 'pulpotomy' ||
    treatment === 'pulpectomy' ||
    treatment === 'extraction' ||
    vitalityMetrics?.coldTest === 'پالپیت غیرقابل‌برگشت' ||
    vitalityMetrics?.coldTest === 'نکروز (بدون پاسخ)'
  ) {
    return 1;
  }
  if (
    treatment === 'scaling' ||
    treatment === 'composite' ||
    treatment === 'amalgam' ||
    treatment === 'fissure_sealant' ||
    treatment === 'fluoride'
  ) {
    return 2;
  }
  if (
    treatment === 'crown_zirconia' ||
    treatment === 'crown_pfm' ||
    treatment === 'implant' ||
    treatment === 'ss_crown' ||
    treatment === 'space_maintainer'
  ) {
    return 3;
  }
  return 4;
}

/**
 * Build Structured 4-Phase ADA Comprehensive Treatment Roadmap for a Patient
 */
export function buildPhasedTreatmentRoadmap(patient?: Patient | null): PhasedTreatmentRoadmap {
  const phaseTemplates: Array<{
    phaseId: 1 | 2 | 3 | 4;
    title: string;
    subtitle: string;
    badgeColor: 'rose' | 'amber' | 'teal' | 'sky';
  }> = [
    {
      phaseId: 1,
      title: 'فاز ۱ · اورژانس، کنترل درد و حذف کانون عفونت',
      subtitle: 'عصب‌کشی (اندو)، پالپوتومی/پالپکتومی و جراحی کشیدن دندان‌های غیرقابل نگهداری',
      badgeColor: 'rose'
    },
    {
      phaseId: 2,
      title: 'فاز ۲ · کنترل بیماری، پریو و ترمیم‌های پایه',
      subtitle: 'جرم‌گیری تخصصی (SRP)، ترمیم کامپوزیت/آمالگام و پیشگیری اطفال',
      badgeColor: 'amber'
    },
    {
      phaseId: 3,
      title: 'فاز ۳ · بازسازی قطعی، پروتز و ایمپلنت',
      subtitle: 'روکش تمام زیرکونیا/PFM، ایمپلنت دندانی و بازسازی قوس فکی',
      badgeColor: 'teal'
    },
    {
      phaseId: 4,
      title: 'فاز ۴ · زیبایی پیشرفته و نگهداری بلندمدت',
      subtitle: 'لمینت سرامیکی E-Max، بلیچینگ و فالوآپ دوره‌ای لبخند',
      badgeColor: 'sky'
    }
  ];

  if (!patient) {
    return {
      phases: phaseTemplates.map(p => ({
        ...p,
        items: [],
        totalCost: 0,
        completedCost: 0,
        totalMinutes: 0,
        completionPercent: 0
      })),
      allItems: [],
      totalPlannedCost: 0,
      completedValue: 0,
      pendingCost: 0,
      totalChairMinutes: 0,
      completionPercent: 0,
      sequencingAlerts: [],
      estimatedVisits: 0
    };
  }

  const rawEntries = Object.entries(patient.teethConditions || {}).map(([key, cond]) => ({
    key,
    cond
  }));

  const allItems: TreatmentRoadmapItem[] = rawEntries.map(({ key, cond }) => {
    const protocol = getTreatmentClinicalProtocol(cond.treatment, cond.toothNumber, cond.surfaces);
    return {
      toothKey: key,
      quadrant: cond.quadrant,
      toothNumber: cond.toothNumber,
      treatment: cond.treatment,
      treatmentLabel: TREATMENT_LABELS_FA[cond.treatment] || cond.treatment,
      status: cond.status,
      surfaces: cond.surfaces || [],
      cost: cond.cost || 0,
      doctorName: cond.doctorName || 'دکتر مهدی امیری',
      date: cond.date || patient.lastVisit || '',
      notes: cond.notes,
      chairMinutes: protocol.chairMinutes,
      phaseId: getPhaseIdForTreatment(cond)
    };
  });

  const phases: TreatmentRoadmapPhase[] = phaseTemplates.map(tpl => {
    const items = allItems.filter(it => it.phaseId === tpl.phaseId);
    const totalCost = items.reduce((s, it) => s + it.cost, 0);
    const completedCost = items.filter(it => it.status === 'completed').reduce((s, it) => s + it.cost, 0);
    const totalMinutes = items.reduce((s, it) => s + it.chairMinutes, 0);
    const completedCount = items.filter(it => it.status === 'completed').length;
    const completionPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    return {
      ...tpl,
      items,
      totalCost,
      completedCost,
      totalMinutes,
      completionPercent
    };
  });

  const totalPlannedCost = allItems.reduce((s, it) => s + it.cost, 0);
  const completedValue = allItems.filter(it => it.status === 'completed').reduce((s, it) => s + it.cost, 0);
  const pendingCost = Math.max(0, totalPlannedCost - completedValue);
  const totalChairMinutes = allItems.filter(it => it.status !== 'completed').reduce((s, it) => s + it.chairMinutes, 0);
  const completedItems = allItems.filter(it => it.status === 'completed').length;
  const completionPercent = allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0;
  const sequencingAlerts = detectClinicalSequencingAlerts(patient, rawEntries);
  const estimatedVisits = totalChairMinutes > 0 ? Math.max(1, Math.ceil(totalChairMinutes / 60)) : 0;

  return {
    phases,
    allItems,
    totalPlannedCost,
    completedValue,
    pendingCost,
    totalChairMinutes,
    completionPercent,
    sequencingAlerts,
    estimatedVisits
  };
}

/**
 * Clinic-wide Active Treatment Queue with Triage Priority Scoring
 */
export function buildClinicTreatmentQueue(patients: Patient[]): ClinicTreatmentQueueItem[] {
  const queue: ClinicTreatmentQueueItem[] = [];

  for (const pat of patients) {
    const entries = Object.entries(pat.teethConditions || {}).map(([key, cond]) => ({ key, cond }));
    const alerts = detectClinicalSequencingAlerts(pat, entries);
    const alertKeys = new Set(alerts.map(a => a.toothKey).filter(Boolean));

    for (const { key, cond } of entries) {
      const protocol = getTreatmentClinicalProtocol(cond.treatment, cond.toothNumber, cond.surfaces);
      const isEmergency =
        cond.status !== 'completed' &&
        (cond.vitalityMetrics?.coldTest === 'پالپیت غیرقابل‌برگشت' ||
          cond.vitalityMetrics?.coldTest === 'نکروز (بدون پاسخ)' ||
          cond.treatment === 'endo' ||
          cond.treatment === 'pulpectomy');
      const hasAlert = alertKeys.has(key);

      let priorityLevel: ClinicTreatmentQueueItem['priorityLevel'] = 'planned';
      let priorityLabel = 'طرح درمان';

      if (cond.status === 'completed') {
        priorityLevel = 'completed';
        priorityLabel = 'تکمیل‌شده';
      } else if (hasAlert) {
        priorityLevel = 'sequencing_block';
        priorityLabel = 'نیازمند بررسی CDSS';
      } else if (isEmergency) {
        priorityLevel = 'urgent_pain';
        priorityLabel = 'اولویت اورژانس/اندو';
      } else if (cond.status === 'in_progress') {
        priorityLevel = 'in_progress';
        priorityLabel = 'در حال اجرا';
      }

      queue.push({
        patientId: pat.id,
        patientName: pat.fullName,
        patientPhone: pat.phone,
        patientFileNumber: pat.fileNumber,
        toothKey: key,
        quadrant: cond.quadrant,
        toothNumber: cond.toothNumber,
        treatment: cond.treatment,
        treatmentLabel: TREATMENT_LABELS_FA[cond.treatment] || cond.treatment,
        status: cond.status,
        surfaces: cond.surfaces || [],
        cost: cond.cost || 0,
        doctorName: cond.doctorName || 'دکتر مهدی امیری',
        date: cond.date || pat.lastVisit || '',
        notes: cond.notes,
        chairMinutes: protocol.chairMinutes,
        phaseId: getPhaseIdForTreatment(cond),
        priorityLevel,
        priorityLabel,
        hasClinicalAlert: hasAlert
      });
    }
  }

  const weight: Record<ClinicTreatmentQueueItem['priorityLevel'], number> = {
    urgent_pain: 0,
    sequencing_block: 1,
    in_progress: 2,
    planned: 3,
    completed: 4
  };

  return queue.sort((a, b) => weight[a.priorityLevel] - weight[b.priorityLevel]);
}

export interface DurationPredictionFactor {
  id: string;
  label: string;
  deltaMinutes: number;
  category: 'protocol' | 'dental_history' | 'medical_risk' | 'coordination';
  reason: string;
}

export interface TreatmentDurationPrediction {
  treatmentType: TreatmentType;
  treatmentLabel: string;
  baseMinutes: number;
  estimatedMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  startTimeEn: string;
  startTimeFa: string;
  predictedEndTimeEn: string;
  predictedEndTimeFa: string;
  complexityLevel: 'ساده' | 'متوسط' | 'پیشرفته و پیچیده';
  confidencePercent: number;
  factors: DurationPredictionFactor[];
  clinicalSummary: string;
}

function formatMinutesAsClockEn(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function inferTreatmentTypeFromLabel(label?: string): TreatmentType {
  const txt = (label || '').toLowerCase();
  if (txt.includes('ایمپلنت') || txt.includes('فیکسچر') || txt.includes('جراحی')) return 'implant';
  if (txt.includes('عصب') || txt.includes('اندو') || txt.includes('روت')) return 'endo';
  if (txt.includes('زیرکونیا')) return 'crown_zirconia';
  if (txt.includes('pfm') || txt.includes('روکش')) return 'crown_pfm';
  if (txt.includes('لمینت') || txt.includes('emax')) return 'laminate';
  if (txt.includes('کشیدن')) return 'extraction';
  if (txt.includes('جرم') || txt.includes('بروساژ')) return 'scaling';
  if (txt.includes('بلیچینگ')) return 'bleaching';
  if (txt.includes('آمالگام')) return 'amalgam';
  if (txt.includes('پالپوتومی')) return 'pulpotomy';
  if (txt.includes('پالپکتومی')) return 'pulpectomy';
  if (txt.includes('استیل') || txt.includes('ss')) return 'ss_crown';
  if (txt.includes('فیشور')) return 'fissure_sealant';
  if (txt.includes('فلوراید')) return 'fluoride';
  if (txt.includes('فضا')) return 'space_maintainer';
  return 'composite';
}

/**
 * AI-driven chairside duration & appointment end-time predictor.
 * Evaluates dental chart history, periodontal/endodontic complexity, implant healing,
 * medical systemic risk (ASA / allergies / age), and appointment baseline.
 */
export function predictClinicalAppointmentDuration(params: {
  patient?: Patient | null;
  plannedTreatment: TreatmentType;
  toothNumber?: number;
  surfaces?: ToothSurface[];
  startTime?: string;
  appointment?: Appointment | null;
}): TreatmentDurationPrediction {
  const { patient, plannedTreatment, toothNumber = 6, surfaces = ['occlusal', 'mesial'], startTime, appointment } = params;
  const protocol = getTreatmentClinicalProtocol(plannedTreatment, toothNumber, surfaces);
  const baseMinutes = protocol.chairMinutes;
  const factors: DurationPredictionFactor[] = [
    {
      id: 'base-protocol',
      label: `زمان استاندارد ${protocol.label}`,
      deltaMinutes: baseMinutes,
      category: 'protocol',
      reason: `${protocol.isolationRequired} · ${protocol.anesthesiaProtocol}`
    }
  ];

  let extraMinutes = 0;

  // 1. Analyze Dental Chart History (multi-tooth burden, posterior molars, perio pockets, multi-step tooth history)
  const toothEntries = Object.values(patient?.teethConditions || {});
  const ongoingCount = toothEntries.filter((c) => c.status !== 'completed').length;
  const complexHistoryCount = toothEntries.filter((c) => (c.history?.length || 0) >= 1).length;
  const hasPerioSeverity = toothEntries.some((c) => {
    if (!c.perioMetrics) return false;
    const pockets = Object.values(c.perioMetrics.pockets || {});
    return pockets.some((p) => p >= 5) || c.perioMetrics.mobility === 'II' || c.perioMetrics.mobility === 'III';
  });

  if (ongoingCount >= 3 || complexHistoryCount >= 1) {
    const dentalDelta = ongoingCount >= 4 ? 12 : 8;
    extraMinutes += dentalDelta;
    factors.push({
      id: 'dental-history-burden',
      label: 'تراکم سوابق و دندان‌های در حال درمان',
      deltaMinutes: dentalDelta,
      category: 'dental_history',
      reason: `${toPersianDigits(ongoingCount)} دندان فعال و سوابق چندمرحله‌ای چارت پالمر نیاز به ارزیابی اکلوژن و ردیف‌سازی دارد.`
    });
  }

  if (hasPerioSeverity) {
    extraMinutes += 10;
    factors.push({
      id: 'perio-isolation',
      label: 'شاخص پریودنتال و کنترل خونریزی لثه',
      deltaMinutes: 10,
      category: 'dental_history',
      reason: 'پاکت‌های عمیق یا لقی دندانی نیازمند ایزولاسیون دقیق‌تر و هموستاز لثه‌ای است.'
    });
  }

  // 2. Implant & Lab prosthetic coordination time
  const activeImplantWithGraft = (patient?.implantCases || []).some(
    (imp) => imp.currentStage !== 'crown_delivered' && (imp.boneGraft || imp.membrane)
  );
  const readyLabCount = (patient?.labOrders || []).filter((l) => l.status === 'ready_for_clinic' || l.status === 'frame_try_in').length;
  if (
    (activeImplantWithGraft && (plannedTreatment === 'implant' || plannedTreatment === 'crown_zirconia' || plannedTreatment === 'crown_pfm')) ||
    (readyLabCount > 0 && (plannedTreatment === 'crown_zirconia' || plannedTreatment === 'crown_pfm' || plannedTreatment === 'laminate'))
  ) {
    extraMinutes += 10;
    factors.push({
      id: 'lab-implant-tryin',
      label: 'تست فریم لابراتوار / پیوند استخوان ایمپلنت',
      deltaMinutes: 10,
      category: 'coordination',
      reason: 'تنظیم کانتکت، چک اکلوزال با کاغذ آرتیکولیشن یا پروتکل استریل گرافت.'
    });
  }

  // 3. Medical History & Age / ASA Safety Buffer
  const safety = evaluatePatientTreatmentSafety({
    patient,
    plannedTreatment
  });
  const medJoined = (patient?.medicalHistory || []).join(' ');
  const hasMedicalLoad =
    safety.asaClass !== 'ASA I' ||
    safety.hasCardiacRisk ||
    safety.hasBleedingRisk ||
    safety.hasDiabetesRisk ||
    medJoined.includes('باردار') ||
    medJoined.includes('آسم');

  if (hasMedicalLoad) {
    const medDelta = safety.asaClass === 'ASA III' ? 15 : 10;
    extraMinutes += medDelta;
    factors.push({
      id: 'systemic-buffer',
      label: `حاشیه ایمنی پزشکی (${safety.asaClass})`,
      deltaMinutes: medDelta,
      category: 'medical_risk',
      reason: safety.systemicAlerts[0] || 'پایش فشار خون، انتخاب کارپول ایمن و استراحت کوتاه حین درمان.'
    });
  }

  if (patient && (patient.age >= 65 || patient.age <= 10)) {
    extraMinutes += 10;
    factors.push({
      id: 'age-pacing',
      label: patient.age <= 10 ? 'مدیریت رفتاری اطفال' : 'پروتکل راحتی بیماران سالمند',
      deltaMinutes: 10,
      category: 'medical_risk',
      reason: `سن بیمار (${toPersianDigits(patient.age)} سال) مستلزم گام‌بندی منعطف و مکث‌های حفاظتی است.`
    });
  }

  // Posterior tooth / multi-surface difficulty adjustment
  if (toothNumber >= 6 && (plannedTreatment === 'endo' || plannedTreatment === 'composite')) {
    extraMinutes += 5;
    factors.push({
      id: 'posterior-access',
      label: `دسترسی مولار خلفی (دندان ${toPersianDigits(toothNumber)})`,
      deltaMinutes: 5,
      category: 'dental_history',
      reason: 'آناتومی چندکاناله و دسترسی محدود خلفی دهان.'
    });
  }

  const estimatedMinutes = Math.max(20, Math.min(165, baseMinutes + extraMinutes));
  const minMinutes = Math.max(15, estimatedMinutes - 10);
  const maxMinutes = estimatedMinutes + 10;

  const resolvedStartRaw = startTime || appointment?.time || '16:30';
  const startMinutes = parseTimeMinutes(resolvedStartRaw);
  const startTimeEn = formatMinutesAsClockEn(startMinutes);
  const predictedEndTimeEn = formatMinutesAsClockEn(startMinutes + estimatedMinutes);

  const complexityLevel: TreatmentDurationPrediction['complexityLevel'] =
    estimatedMinutes >= 75 || factors.length >= 4
      ? 'پیشرفته و پیچیده'
      : estimatedMinutes >= 45 || factors.length >= 3
      ? 'متوسط'
      : 'ساده';

  let confidencePercent = 85;
  if (patient) confidencePercent += 4;
  if ((patient?.medicalHistory?.length || 0) > 0) confidencePercent += 3;
  if (toothEntries.length > 0) confidencePercent += 3;
  confidencePercent = Math.min(96, confidencePercent);

  const clinicalSummary = `برآورد هوشمند بر اساس ${toPersianDigits(factors.length)} شاخص بالینی (${safety.asaClass}، ${toPersianDigits(toothEntries.length)} سابقه دندانی) با ریسک تاخیر ${complexityLevel === 'پیشرفته و پیچیده' ? 'بالا' : 'کنترل‌شده'}.`;

  return {
    treatmentType: plannedTreatment,
    treatmentLabel: protocol.label,
    baseMinutes,
    estimatedMinutes,
    minMinutes,
    maxMinutes,
    startTimeEn,
    startTimeFa: toPersianDigits(startTimeEn),
    predictedEndTimeEn,
    predictedEndTimeFa: toPersianDigits(predictedEndTimeEn),
    complexityLevel,
    confidencePercent,
    factors,
    clinicalSummary
  };
}

export async function analyzeAppointmentDurationWithAi(
  patient: Patient | null | undefined,
  prediction: TreatmentDurationPrediction
): Promise<string> {
  const prompt = `تخمین زمان صندلی برای درمان «${prediction.treatmentLabel}» معادل ${toPersianDigits(prediction.estimatedMinutes)} دقیقه (پایان حدود ${prediction.predictedEndTimeFa}) برآورد شده است. با توجه به سابقه دندانی و پزشکی بیمار، ۲ نکته عملی کوتاه جهت جلوگیری از تداخل نوبت بعدی و کاهش زمان یونیت ارائه کن.`;
  return consultDentalAi(prompt, patient ? {
    fullName: patient.fullName,
    age: patient.age,
    medicalHistory: patient.medicalHistory,
    activeTreatments: Object.entries(patient.teethConditions || {})
      .map(([k, c]) => `${k}: ${c.treatment} (${c.status})`)
      .join('، '),
    activeImplants: (patient.implantCases || []).map((i) => `${i.toothNumber} (${i.currentStage})`).join('، '),
    activeLabs: (patient.labOrders || []).map((l) => `${l.workType} (${l.status})`).join('، ')
  } : undefined);
}

