import { aiConsultRequestSchema } from '../utils/eccSchemas';
import { eccLogger } from '../utils/eccLogger';

export interface AiDentalConsultation {
  analysis: string;
  treatmentSteps: string[];
  medicalAlerts: string[];
  suggestedMaterials: string[];
  patientTips: string[];
}

export interface DentalAiPatientContext {
  fullName?: string;
  age?: number;
  medicalHistory?: string[];
  activeTreatments?: string;
  activeImplants?: string;
  activeLabs?: string;
}

/**
 * Queries MinaDental's server-side Gemini AI proxy (/api/ai/consult).
 * Never touches API keys in browser code; falls back to the offline clinical
 * protocol engine when the clinic tablet/phone is offline or server AI is paused.
 */
export async function consultDentalAi(
  prompt: string,
  patientContext?: DentalAiPatientContext
): Promise<string> {
  const validated = aiConsultRequestSchema.safeParse({ prompt, patientContext });
  if (!validated.success) {
    return validated.error.issues[0]?.message || 'لطفاً پرسش بالینی معتبر وارد نمایید.';
  }

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  if (typeof fetch === 'function' && isOnline) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 18000) : null;
      try {
        const res = await fetch('/api/ai/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated.data),
          signal: controller?.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          if (data?.text && data.text.trim().length > 0) {
            return data.text.trim();
          }
        } else {
          eccLogger.warn('DentalAI', `Server AI proxy returned HTTP ${res.status}; using offline clinical engine.`);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (err: unknown) {
      eccLogger.warn('DentalAI', 'Server AI proxy unavailable, falling back to offline clinical engine:', err);
    }
  }

  return generateClinicalFallback(validated.data.prompt, validated.data.patientContext);
}

function generateClinicalFallback(
  prompt: string,
  patientContext?: DentalAiPatientContext
): string {
  const normalizedPrompt = prompt.toLowerCase();
  const historyText = patientContext?.medicalHistory?.join('، ') || '';
  const hasCardiac = historyText.includes('قلب') || historyText.includes('فشار') || normalizedPrompt.includes('فشار') || normalizedPrompt.includes('قلب');
  const hasDiabetes = historyText.includes('دیابت') || normalizedPrompt.includes('دیابت') || normalizedPrompt.includes('متفورمین');
  const isPregnant = historyText.includes('باردار') || normalizedPrompt.includes('باردار');
  const isImplant = /ایمپلنت|فیکسچر|تورک|سینوس|استخوان|جراحی|cbct|implant|torque/i.test(normalizedPrompt);
  const isProsthetics = /لمینت|ونیر|روکش|سمان|زیرکونیا|قالب|پروتز|تراش|لابراتوار/i.test(normalizedPrompt);
  const isRx = /نسخه|آنتی‌بیوتیک|دارو|مسکن|دوز|بی‌حسی|کارپول|تداخل|پروفیلاکسی/i.test(normalizedPrompt);
  const patientHeader = patientContext?.fullName ? `برای پرونده «${patientContext.fullName}»` : 'بر اساس ارزیابی بالینی';

  const systemicBlock = [
    hasCardiac
      ? '• هشدار قلبی / فشار خون (ASA II-III): سقف اپی‌نفرین ۰.۰۴ میلی‌گرم (حداکثر ۲ کارپول لیدوکائین ۱:۱۰۰,۰۰۰) یا استفاده از مپیواکائین ۳٪ ساده همراه با آسپیراسیون و پایش فشار خون پیش از تزریق.'
      : isPregnant
      ? '• ملاحظات بارداری: ایمن‌ترین بازه درمان سه‌ماهه دوم در وضعیت نیمه‌نشسته به سمت چپ؛ بی‌حسی مجاز لیدوکائین ۲٪ (گروه B) و مسکن مجاز فقط استامینوفن ساده (منع کامل NSAID و تتراسایکلین).'
      : '• شرایط سیستمیک پایدار (ASA I): لیدوکائین ۲٪ با اپی‌نفرین ۱:۱۰۰,۰۰۰ با رعایت دوز وزنی ایمن (حداکثر ۷mg/kg) بلامانع است.',
    hasDiabetes
      ? '• کنترل دیابت: انجام درمان در نوبت صبح پس از صرف صبحانه و مصرف داروی روتین؛ در جراحی‌های تهاجمی کنترل FBS (<180 mg/dL) و HbA1c (<7.5%) و پوشش آنتی‌بیوتیک پروفیلاکتیک توصیه می‌شود.'
      : ''
  ]
    .filter(Boolean)
    .join('\n');

  let protocolBlock = '';
  let postOpBlock = '';

  if (isImplant) {
    protocolBlock = `۲. پروتکل تخصصی جراحی ایمپلنت و مدیریت استخوان:
• در استخوان تیپ D3/D4 (به‌ویژه خلف ماگزیلا): آندردریلینگ (Under-preparation) به میزان ۰.۵ تا ۰.۸ میلی‌متر یا استفاده از استئوتوم/اوسئودنسیفیکیشن برای دستیابی به ثبات اولیه (Primary Stability) بالای ۳۰–۳۵ Ncm.
• حفظ فاصله ایمن حداقل ۲ میلی‌متر از کانال عصب IAN و ۱.۵ میلی‌متر از ریشه دندان مجاور بر اساس برش کرونال CBCT.
• در صورت تورک کمتر از ۲۵ Ncm، بستن Cover Screw و انتخاب پروتکل دو‌مرحله‌ای با زمان اوسئواینتگریشن ۴ تا ۵ ماهه (به جای بارگذاری فوری).`;
    postOpBlock = `۳. مراقبت و نسخه پیشنهادی پس از جراحی ایمپلنت:
• کمپرس سرد متناوب (۲۰ دقیقه هر ساعت) در ۲۴ ساعت اول و شستشوی ملایم با دهان‌شویه کلرهگزیدین ۰.۱۲٪ از روز دوم به مدت ۱۰ روز.
• ثبت نوبت کشیدن بخیه (۱۰ روز بعد) و یادآور مرحله هیلینگ اباتمنت در ماژول ایمپلنت و تقویم مطب.`;
  } else if (isProsthetics) {
    protocolBlock = `۲. پروتکل پروتز ثابت، لمینت سرامیکی و سمان‌گذاری:
• تراش محافظه‌کارانه درون مینا (۰.۳–۰.۵mm برای لمینت، ۱.۰–۱.۵mm اکلوزال برای زیرکونیا) با خط ختم Chamfer واضح و بدون لبه‌های تیز.
• آماده‌سازی سطح داخلی لیتیوم‌دی‌سیلیکات (E.max) با اسید هیدروفلوئوریک ۵٪ (۲۰ ثانیه) + سیلان (۶۰ ثانیه)؛ برای زیرکونیا سندبلاست اکسید آلومینیوم ۵۰ میکرون + پرایمر حاوی MDP.
• ایزولاسیون کامل با رابردم یا نخ زیرلثه بدون اپی‌نفرین و سمان‌گذاری با سمان رزینی Light-Cure (برای لمینت) یا Dual-Cure (برای روکش).`;
    postOpBlock = `۳. کنترل اکلوژن و تحویل نهایی:
• حذف کامل اضافات سمان در نواحی پروگزیمال با نخ دندان و تیغ بیستوری #۱۲ و بررسی تماس‌های پیش‌رس در حرکات لترال و پروتروژن.
• تحویل نایت‌گارد محافظ در بیماران دارای سابقه براکسیزم و ثبت نوبت کنترل ۱ هفته‌ای.`;
  } else if (isRx) {
    protocolBlock = `۲. راهنمای علمی نسخه‌نویسی و فارماکولوژی دندانپزشکی:
• آنتی‌بیوتیک خط اول در عفونت‌های ادنتوژنیک یا جراحی پیوند استخوان: کپسول آموکسی‌سیلین ۵۰۰mg هر ۸ ساعت (یا کوآموکسی‌کلاو ۶۲۵mg در عفونت‌های مختلط) به مدت ۵–۷ روز.
• در صورت حساسیت به پنی‌سیلین: کپسول کلیندامایسین ۳۰۰mg هر ۸ ساعت یا آزیترومایسین ۵۰۰mg روز اول و سپس ۲۵۰mg روزانه.
• کنترل درد التهابی: ایبوپروفن ۴۰۰mg هر ۶–۸ ساعت همراه با استامینوفن ۵۰۰mg به صورت متناوب (در بیماران بدون زخم معده، نارسایی کلیوی یا بارداری).`;
    postOpBlock = `۳. هشدار تداخلات دارویی و پیگیری:
• در بیماران مصرف‌کننده ضدانعقاد (وارفارین/ریواروکسابان) از تجویز NSAID و مترونیدازول بدون هماهنگی پزشک معالج خودداری شود.
• ثبت نسخه در تب «نسخه‌نویسی» پرونده بیمار و تنظیم یادآور پیگیری ۴۸ ساعته.`;
  } else {
    protocolBlock = `۲. پروتکل اجرایی درمان و کنترل بالینی (موضوع: ${prompt.slice(0, 72)}):
• تشخیص قطعی با تست‌های ویتالیتی (سرما، دق، لمس) و رادیوگرافی پری‌اپیکال دیجیتال جهت تعیین عمق پوسیدگی یا وضعیت پری‌اپیکال.
• در درمان‌های ترمیمی: ایزولاسیون دقیق، برداشت پوسیدگی با هندپیس کم‌سرعت و استفاده از باندینگ یونیورسال (نسل هفتم/هشتم) با تکنیک لایه‌گذاری ۲ میلی‌متری.
• در درمان ریشه (اندو): تعیین طول کارکرد با اپکس‌لوکیتور، شستشوی فراوان با هیپوکلریت سدیم ۲.۵٪ + EDTA 17% و آبچوریشن همگن تا ۰.۵mm اپکس.`;
    postOpBlock = `۳. مراقبت‌های پس از درمان و پیگیری:
• پرهیز از جویدن غذاهای سفت روی دندان درمان‌شده تا رفع کامل بی‌حسی موضعی (۲ تا ۳ ساعت).
• ثبت وضعیت نهایی دندان در چارت پالمر و تنظیم نوبت چکاپ یا ترمیم نهایی در تقویم ایرانی مطب.`;
  }

  return `[تحلیل بالینی و گایدلاین هوشمند مینادنتال]
پاسخ تشخیصی و طرح درمان ${patientHeader}:
${patientContext?.activeTreatments ? `• سوابق درمان چارت پالمر: ${patientContext.activeTreatments}\n` : ''}${patientContext?.activeImplants ? `• وضعیت ایمپلنت: ${patientContext.activeImplants}\n` : ''}${patientContext?.activeLabs ? `• سفارش لابراتوار: ${patientContext.activeLabs}\n` : ''}
۱. ارزیابی ریسک سیستمیک و ایمنی بی‌حسی:
${systemicBlock}

${protocolBlock}

${postOpBlock}`;
}
