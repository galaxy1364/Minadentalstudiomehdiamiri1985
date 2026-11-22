import jsQRLib from 'jsqr';
import * as ZXingNS from '@zxing/library';
import { InventoryItem, LabOrder, Patient } from '../types/dental';
import { toEnglishDigits } from './jalali';

const ZXing: typeof ZXingNS = (ZXingNS as any).default && (ZXingNS as any).default.MultiFormatReader
  ? (ZXingNS as any).default
  : ZXingNS;
const jsQR = ((jsQRLib as any).default || jsQRLib) as typeof jsQRLib;

export type CameraDiagnosticReason =
  | 'ok'
  | 'insecure_context'
  | 'unsupported'
  | 'permission_denied'
  | 'no_camera'
  | 'in_use'
  | 'overconstrained'
  | 'unknown';

export interface CameraStreamResult {
  ok: boolean;
  stream: MediaStream | null;
  reason: CameraDiagnosticReason;
  errorTitle?: string;
  errorHint?: string;
}

export interface SayadParsedPayload {
  sayadId: string;
  bankName?: string;
  amount?: number;
  rawText: string;
}

export interface ParsedProductBarcodeData {
  barcode: string;
  qrCode: string;
  name: string;
  brand: string;
  category: string;
  lotNumber?: string;
  expiryDate: string;
  unit: string;
  suggestedQuantity: number;
  pricePerUnit: number;
  sourceStandard: 'GS1-128 / UDI' | 'JSON QR' | 'کد کالا / EAN-13' | 'برچسب محصول';
  originCountry?: string;
}

export type ScannedClinicEntity =
  | { kind: 'inventory'; item: InventoryItem; rawCode: string }
  | { kind: 'product_data'; product: ParsedProductBarcodeData; rawCode: string }
  | { kind: 'lab'; order: LabOrder; patient?: Patient; rawCode: string }
  | { kind: 'patient'; patient: Patient; rawCode: string }
  | {
      kind: 'sterilization';
      cycleCode: string;
      deviceName?: string;
      statusText: string;
      rawCode: string;
    }
  | { kind: 'sayad_check'; parsed: SayadParsedPayload; rawCode: string };

// Lazy-initialized ZXing MultiFormatReader singleton for 1D & 2D barcodes on iOS/Note 8/Firefox
let zxingReader: InstanceType<typeof ZXingNS.MultiFormatReader> | null = null;
function getZxingReader(): InstanceType<typeof ZXingNS.MultiFormatReader> {
  if (!zxingReader) {
    const reader = new ZXing.MultiFormatReader();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.ITF,
      ZXing.BarcodeFormat.DATA_MATRIX,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    zxingReader = reader;
  }
  return zxingReader;
}

// Lazy-initialized native BarcodeDetector (Android Chrome / Desktop Chromium)
let nativeDetector: any = undefined;
function getNativeBarcodeDetector(): any | null {
  if (nativeDetector !== undefined) return nativeDetector;
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      nativeDetector = new (window as any).BarcodeDetector({
        formats: [
          'qr_code',
          'ean_13',
          'ean_8',
          'code_128',
          'code_39',
          'data_matrix',
          'itf',
          'upc_a',
          'upc_e'
        ]
      });
      return nativeDetector;
    } catch {
      nativeDetector = null;
      return null;
    }
  }
  nativeDetector = null;
  return null;
}

export function getActiveScannerEngineLabel(): string {
  const native = getNativeBarcodeDetector();
  return native ? 'BarcodeDetector · jsQR · ZXing' : 'jsQR · ZXing';
}

/**
 * Open camera stream with graceful constraint fallbacks and clear Persian permission diagnostics.
 */
export async function openCameraStream(
  facingMode: 'environment' | 'user' = 'environment'
): Promise<CameraStreamResult> {
  if (typeof window === 'undefined') {
    return {
      ok: false,
      stream: null,
      reason: 'unsupported',
      errorTitle: 'محیط اجرا فاقد مرورگر دوربین است',
      errorHint: 'از دکمه انتخاب عکس یا ورود دستی کد استفاده کنید.'
    };
  }

  if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return {
      ok: false,
      stream: null,
      reason: 'insecure_context',
      errorTitle: 'اتصال امن HTTPS برای دوربین لازم است',
      errorHint: 'مرورگرهای موبایل و آیفون دوربین زنده را فقط روی HTTPS فعال می‌کنند. می‌توانید کد بارکد را با اسکنر لیزری/USB وارد کنید یا تصویر لیبل بارکد را بخوانید.'
    };
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      ok: false,
      stream: null,
      reason: 'unsupported',
      errorTitle: 'دسترسی مستقیم به دوربین در این مرورگر/وب‌ویو فعال نیست',
      errorHint: 'برای دریافت دیتای محصول از اسکنر لیزری USB، ورود کد بارکد یا خواندن فایل تصویر لیبل بارکد استفاده کنید.'
    };
  }

  const candidateConstraints: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    },
    {
      video: { facingMode },
      audio: false
    },
    {
      video: true,
      audio: false
    }
  ];

  let lastErr: any = null;
  for (const constraints of candidateConstraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { ok: true, stream, reason: 'ok' };
    } catch (err: any) {
      lastErr = err;
      const errName = String(err?.name || '');
      // Do not retry constraint relaxation if user/iframe actively denied permission
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
        break;
      }
    }
  }

  const name = String(lastErr?.name || '');
  const msg = String(lastErr?.message || '').toLowerCase();

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    const isPolicy = msg.includes('policy') || msg.includes('permissions policy') || msg.includes('disallowed');
    return {
      ok: false,
      stream: null,
      reason: 'permission_denied',
      errorTitle: isPolicy
        ? 'دسترسی دوربین در پنجره پیش‌نمایش محدود شده است'
        : 'مجوز دسترسی به دوربین تایید نشد',
      errorHint: isPolicy
        ? 'از دکمه «عکس از دوربین / گالری» در پایین استفاده کنید یا برنامه را در تب مستقل (PWA) باز کنید تا دوربین مستقیم فعال شود.'
        : 'در تنظیمات مرورگر یا نوار آدرس (آیکون قفل / دوربین) اجازه دسترسی دوربین را روی Allow بگذارید و «تلاش مجدد» را بزنید.'
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      ok: false,
      stream: null,
      reason: 'no_camera',
      errorTitle: 'دوربین فعالی روی این دستگاه شناسایی نشد',
      errorHint: 'می‌توانید با دکمه «اسکن از عکس» یا ورود دستی کد ادامه دهید.'
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      ok: false,
      stream: null,
      reason: 'in_use',
      errorTitle: 'دوربین توسط برنامه دیگری در حال استفاده است',
      errorHint: 'برنامه دوربین یا تماس تصویری دیگر را ببندید و دوباره تلاش کنید.'
    };
  }

  return {
    ok: false,
    stream: null,
    reason: 'unknown',
    errorTitle: 'خطا در راه‌اندازی جریان زنده دوربین',
    errorHint: 'از دکمه «اسکن از عکس دوربین / گالری» یا ورود دستی بارکد استفاده کنید.'
  };
}

/**
 * Decode any QR or 1D/2D barcode from raw RGBA ImageData using multi-pass jsQR + ZXing
 * (HybridBinarizer + GlobalHistogramBinarizer + Center Laser-Line High-Contrast ROI Strip).
 */
export function decodeBarcodeFromImageData(imageData: ImageData): string | null {
  const { data, width, height } = imageData;
  if (!data || width <= 0 || height <= 0) return null;

  // 1. Fast pure-JS 2D QR pass (handles iOS, Note 8, inverted colors)
  try {
    const qrResult = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    if (qrResult && qrResult.data && qrResult.data.trim()) {
      return qrResult.data.trim();
    }
  } catch {
    // Ignore frame decode exception
  }

  // Build standard luminance buffer once for ZXing passes
  const len = width * height;
  const luminances = new Uint8ClampedArray(len);
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < len; i++) {
    const offset = i * 4;
    const lum = (data[offset] * 77 + data[offset + 1] * 150 + data[offset + 2] * 29) >> 8;
    luminances[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const reader = getZxingReader();

  // 2A. ZXing HybridBinarizer full-frame pass (2D QR / DataMatrix / crisp 1D)
  try {
    const source = new ZXing.RGBLuminanceSource(luminances, width, height);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const res = reader.decode(bitmap);
    const txt = res?.getText?.();
    if (txt && txt.trim()) return txt.trim();
  } catch {
    // Continue to next pass
  }

  // 2B. ZXing GlobalHistogramBinarizer full-frame pass (superior for 1D EAN-13 / Code128 / GS1-128 under mobile glare)
  if ((ZXing as any).GlobalHistogramBinarizer) {
    try {
      const source = new ZXing.RGBLuminanceSource(luminances, width, height);
      const bitmap = new ZXing.BinaryBitmap(new (ZXing as any).GlobalHistogramBinarizer(source));
      const res = reader.decode(bitmap);
      const txt = res?.getText?.();
      if (txt && txt.trim()) return txt.trim();
    } catch {
      // Continue to center strip pass
    }
  }

  // 2C. High-Contrast Center Laser-Line ROI Strip Pass (middle 45% height where 1D barcodes are aimed)
  if (height >= 40 && width >= 40) {
    try {
      const stripY0 = Math.floor(height * 0.275);
      const stripH = Math.max(20, Math.floor(height * 0.45));
      const stripLen = width * stripH;
      const stripLum = new Uint8ClampedArray(stripLen);
      const dynamicRange = Math.max(1, maxLum - minLum);

      for (let r = 0; r < stripH; r++) {
        const srcRowOffset = (stripY0 + r) * width;
        const dstRowOffset = r * width;
        for (let c = 0; c < width; c++) {
          const rawVal = luminances[srcRowOffset + c];
          // Auto-stretch contrast to 0..255 so faint printed barcodes lock immediately
          const stretched = Math.min(255, Math.max(0, Math.round(((rawVal - minLum) * 255) / dynamicRange)));
          stripLum[dstRowOffset + c] = stretched;
        }
      }

      const stripSource = new ZXing.RGBLuminanceSource(stripLum, width, stripH);
      const BinarizerCtor = (ZXing as any).GlobalHistogramBinarizer || ZXing.HybridBinarizer;
      const stripBitmap = new ZXing.BinaryBitmap(new BinarizerCtor(stripSource));
      const res = reader.decode(stripBitmap);
      const txt = res?.getText?.();
      if (txt && txt.trim()) return txt.trim();
    } catch {
      // Not found in horizontal center strip
    }

    // 2D. 90-Degree Rotated Vertical Center Strip Pass (for vertically held 1D barcodes on dental syringes/tubes)
    try {
      const stripX0 = Math.floor(width * 0.275);
      const stripW = Math.max(20, Math.floor(width * 0.45));
      const rotW = height;
      const rotH = stripW;
      const rotLum = new Uint8ClampedArray(rotW * rotH);
      const dynamicRange = Math.max(1, maxLum - minLum);

      for (let r = 0; r < height; r++) {
        for (let c = 0; c < stripW; c++) {
          const rawVal = luminances[r * width + (stripX0 + c)];
          const stretched = Math.min(255, Math.max(0, Math.round(((rawVal - minLum) * 255) / dynamicRange)));
          rotLum[c * rotW + (height - 1 - r)] = stretched;
        }
      }

      const rotSource = new ZXing.RGBLuminanceSource(rotLum, rotW, rotH);
      const BinarizerCtor = (ZXing as any).GlobalHistogramBinarizer || ZXing.HybridBinarizer;
      const rotBitmap = new ZXing.BinaryBitmap(new BinarizerCtor(rotSource));
      const res = reader.decode(rotBitmap);
      const txt = res?.getText?.();
      if (txt && txt.trim()) return txt.trim();
    } catch {
      // Not found in vertical center strip
    }
  }

  return null;
}

/**
 * Decode QR or barcode from a live <video> element onto a scratch <canvas>.
 */
export async function decodeBarcodeFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<string | null> {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  // 1. Try native hardware-accelerated BarcodeDetector first when supported
  const native = getNativeBarcodeDetector();
  if (native) {
    try {
      const codes = await native.detect(video);
      if (codes && codes.length > 0 && codes[0]?.rawValue) {
        return String(codes[0].rawValue).trim();
      }
    } catch {
      // Fallback to canvas decoders below
    }
  }

  // 2. Capture frame to canvas (scaled cleanly to max 720px side for fast mobile CPU speed)
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const maxDim = 720;
  const scale = Math.min(1, maxDim / Math.max(vw, vh));
  const targetW = Math.max(1, Math.round(vw * scale));
  const targetH = Math.max(1, Math.round(vh * scale));

  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  return decodeBarcodeFromImageData(imageData);
}

/**
 * Decode QR or 1D/2D barcode from an uploaded image File with multi-scale + center-crop passes.
 */
export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  if (typeof window === 'undefined' || !file) return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        // 1. Native BarcodeDetector on Image element if supported
        const native = getNativeBarcodeDetector();
        if (native) {
          try {
            const codes = await native.detect(img);
            if (codes && codes.length > 0 && codes[0]?.rawValue) {
              URL.revokeObjectURL(objectUrl);
              resolve(String(codes[0].rawValue).trim());
              return;
            }
          } catch {
            // Continue to canvas pass
          }
        }

        // 2. Multi-scale canvas pass (1200px full frame, then 800px center crop if needed)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const nw = img.naturalWidth || 640;
          const nh = img.naturalHeight || 480;
          for (const maxSide of [1200, 720]) {
            const scale = Math.min(1, maxSide / Math.max(nw, nh));
            canvas.width = Math.max(1, Math.round(nw * scale));
            canvas.height = Math.max(1, Math.round(nh * scale));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = decodeBarcodeFromImageData(imageData);
            if (decoded) {
              URL.revokeObjectURL(objectUrl);
              resolve(decoded);
              return;
            }
          }

          // Center 60% crop pass for photos where barcode is small in the middle
          const cropW = Math.max(40, Math.round(nw * 0.6));
          const cropH = Math.max(40, Math.round(nh * 0.6));
          const cropX = Math.round((nw - cropW) / 2);
          const cropY = Math.round((nh - cropH) / 2);
          canvas.width = Math.min(800, cropW);
          canvas.height = Math.min(800, cropH);
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          const cropData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const cropDecoded = decodeBarcodeFromImageData(cropData);
          if (cropDecoded) {
            URL.revokeObjectURL(objectUrl);
            resolve(cropDecoded);
            return;
          }
        }

        URL.revokeObjectURL(objectUrl);
        resolve(null);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

const IRANIAN_BANK_HINTS: Array<{ keyword: string; name: string }> = [
  { keyword: 'mellat', name: 'بانک ملت' },
  { keyword: 'ملت', name: 'بانک ملت' },
  { keyword: 'melli', name: 'بانک ملی' },
  { keyword: 'ملی', name: 'بانک ملی' },
  { keyword: 'saderat', name: 'بانک صادرات' },
  { keyword: 'صادرات', name: 'بانک صادرات' },
  { keyword: 'tejarat', name: 'بانک تجارت' },
  { keyword: 'تجارت', name: 'بانک تجارت' },
  { keyword: 'sepah', name: 'بانک سپه' },
  { keyword: 'سپه', name: 'بانک سپه' },
  { keyword: 'pasargad', name: 'بانک پاسارگاد' },
  { keyword: 'پاسارگاد', name: 'بانک پاسارگاد' },
  { keyword: 'saman', name: 'بانک سامان' },
  { keyword: 'سامان', name: 'بانک سامان' },
  { keyword: 'parsian', name: 'بانک پارسیان' },
  { keyword: 'پارسیان', name: 'بانک پارسیان' },
  { keyword: 'keshavarzi', name: 'بانک کشاورزی' },
  { keyword: 'کشاورزی', name: 'بانک کشاورزی' },
  { keyword: 'maskan', name: 'بانک مسکن' },
  { keyword: 'مسکن', name: 'بانک مسکن' }
];

/**
 * Parse Iranian Sayad check QR payload (URL, JSON, or 16-digit serial text).
 */
export function parseSayadCheckPayload(rawText: string): SayadParsedPayload | null {
  if (!rawText) return null;
  const normalized = toEnglishDigits(rawText).trim();

  // Look for 16-digit Sayad serial inside URL query or raw string
  const match16 = normalized.match(/(?:^|\D)(\d{16})(?:\D|$)/);
  if (!match16) return null;

  const sayadId = match16[1];
  const lower = normalized.toLowerCase();
  let bankName: string | undefined;
  for (const b of IRANIAN_BANK_HINTS) {
    if (lower.includes(b.keyword)) {
      bankName = b.name;
      break;
    }
  }

  let amount: number | undefined;
  const amountMatch = lower.match(/(?:amount|mablagh|amt)[=:"\s]+(\d{5,12})/);
  if (amountMatch) {
    const parsedAmt = Number(amountMatch[1]);
    if (Number.isFinite(parsedAmt) && parsedAmt > 0) {
      amount = parsedAmt;
    }
  }

  return {
    sayadId,
    bankName,
    amount,
    rawText
  };
}

const KNOWN_DENTAL_PRODUCT_CATALOG: Record<
  string,
  { name: string; brand: string; category: string; unit: string; pricePerUnit: number }
> = {
  '04027591001234': {
    name: 'کامپوزیت نانو هیبرید 3M Filtek Z350 XT (شید A2)',
    brand: '3M Oral Care',
    category: 'کامپوزیت و ترمیم',
    unit: 'سرنگ',
    pricePerUnit: 1_850_000
  },
  '6260110045012': {
    name: 'کارپول بی‌حسی لیدوکائین ۲٪ با اپی‌نفرین ۱:۸۰۰۰۰',
    brand: 'داروپخش ایران',
    category: 'بی‌حسی و دارو',
    unit: 'بسته ۵۰ عددی',
    pricePerUnit: 680_000
  },
  '8809123450019': {
    name: 'فیکسچر ایمپلنت دنتیوم SuperLine II سایز ۴.۰×۱۰',
    brand: 'Dentium Korea',
    category: 'ایمپلنت و جراحی',
    unit: 'پک استریل',
    pricePerUnit: 5_400_000
  },
  '7610987654321': {
    name: 'ماده قالب‌گیری سیلیکونی افژکتیو Speedex Putty + Light',
    brand: 'Coltene Switzerland',
    category: 'پروتز و قالب‌گیری',
    unit: 'ست کامل',
    pricePerUnit: 2_350_000
  },
  '4009076543210': {
    name: 'سمان گلاس آینومر لوتینگ Fuji Plus / Meron',
    brand: 'VOCO / GC',
    category: 'پروتز و قالب‌گیری',
    unit: 'ست پودر و مایع',
    pricePerUnit: 1_950_000
  },
  '4901234567893': {
    name: 'فایل روتاری اندودانتیکس NiTi Gold Assorted 25mm',
    brand: 'Mani Japan',
    category: 'اندودانتیکس',
    unit: 'بسته ۶ عددی',
    pricePerUnit: 790_000
  }
};

function convertGs1YyMmDdToApproximateJalali(yymmdd: string): string {
  const clean = toEnglishDigits(yymmdd).replace(/[^\d]/g, '');
  if (clean.length !== 6) return '۱۴۰۶/۱۲/۲۹';
  const yy = Number(clean.slice(0, 2));
  const mm = Number(clean.slice(2, 4));
  const dd = Number(clean.slice(4, 6)) || 28;
  const gregYear = 2000 + yy;
  const approxJYear = gregYear - 621 - (mm <= 3 ? 1 : 0);
  const approxJMonth = ((mm + 8) % 12) + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${approxJYear}/${pad(approxJMonth)}/${pad(Math.min(29, Math.max(1, dd)))}`;
}

function resolveGs1PrefixMetadata(digits: string): {
  originCountry: string;
  brand: string;
  category: string;
} {
  if (digits.startsWith('626')) {
    return { originCountry: 'ایران (GS1 626)', brand: 'تجهیزات پزشکی و دارویی ایران', category: 'بی‌حسی و دارو' };
  }
  if (digits.startsWith('40') || digits.startsWith('41') || digits.startsWith('42') || digits.startsWith('43') || digits.startsWith('44')) {
    return { originCountry: 'آلمان (GS1 400-440)', brand: 'VOCO / DMG / Dentsply', category: 'کامپوزیت و ترمیم' };
  }
  if (digits.startsWith('76')) {
    return { originCountry: 'سوئیس (GS1 760-769)', brand: 'Coltene / Straumann', category: 'پروتز و قالب‌گیری' };
  }
  if (digits.startsWith('880')) {
    return { originCountry: 'کره جنوبی (GS1 880)', brand: 'Dentium / Osstem', category: 'ایمپلنت و جراحی' };
  }
  if (digits.startsWith('45') || digits.startsWith('49')) {
    return { originCountry: 'ژاپن (GS1 45-49)', brand: 'GC / Mani / Shofu', category: 'اندودانتیکس' };
  }
  if (digits.startsWith('80') || digits.startsWith('81') || digits.startsWith('82') || digits.startsWith('83')) {
    return { originCountry: 'ایتالیا (GS1 80-83)', brand: 'Zhermack', category: 'پروتز و قالب‌گیری' };
  }
  if (/^(0[0-9]|1[0-3])/.test(digits)) {
    return { originCountry: 'آمریکا / کانادا (GS1)', brand: '3M / Ultradent / Kerr', category: 'کامپوزیت و ترمیم' };
  }
  return { originCountry: 'کد استاندارد بین‌المللی GS1', brand: 'تامین‌کننده دندانپزشکی', category: 'مصرفی و بهداشتی' };
}

/**
 * Extract structured Dental Product Metadata directly from any Barcode/QR/GS1-128/UDI string
 * (NOT product photo — pure structured product data extraction).
 */
export function parseDentalProductBarcodePayload(rawCode: string): ParsedProductBarcodeData | null {
  if (!rawCode) return null;
  const trimmed = rawCode.trim();
  if (trimmed.length < 4) return null;
  const enTrimmed = toEnglishDigits(trimmed);

  // 1. JSON QR Product Payload: {"name": "...", "brand": "...", "lot": "...", "expiry": "...", "price": ...}
  if (enTrimmed.startsWith('{') && enTrimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(enTrimmed);
      if (obj && (obj.name || obj.product || obj.title || obj.sku || obj.barcode || obj.gtin)) {
        const barcode = String(obj.barcode || obj.gtin || obj.sku || obj.code || `SKU-${Date.now().toString().slice(-6)}`);
        return {
          barcode,
          qrCode: String(obj.qrCode || `MINA-INV-${barcode.slice(-6)}`),
          name: String(obj.name || obj.product || obj.title || `محصول دندانپزشکی (${barcode})`),
          brand: String(obj.brand || obj.manufacturer || 'برند دندانپزشکی'),
          category: String(obj.category || 'کامپوزیت و ترمیم'),
          lotNumber: obj.lot || obj.batch ? String(obj.lot || obj.batch) : undefined,
          expiryDate: String(obj.expiry || obj.exp || obj.expiryDate || '۱۴۰۷/۰۱/۰۱'),
          unit: String(obj.unit || 'عدد'),
          suggestedQuantity: Number(obj.qty || obj.quantity || obj.stock) || 1,
          pricePerUnit: Number(obj.price || obj.pricePerUnit || obj.cost) || 0,
          sourceStandard: 'JSON QR'
        };
      }
    } catch {
      // Ignore malformed JSON and continue to other decoders
    }
  }

  // 2. GS1-128 / UDI Medical & Dental Barcode: (01)04027591001234(17)270815(10)LOT94A(30)5
  const gs1ParenMatch = enTrimmed.match(/\(01\)(\d{8,14})/);
  const gs1RawMatch = !gs1ParenMatch ? enTrimmed.match(/^01(\d{14})(?:17(\d{6}))?(?:10([A-Za-z0-9\-_.]+))?/) : null;
  if (gs1ParenMatch || gs1RawMatch) {
    const gtin = gs1ParenMatch ? gs1ParenMatch[1] : gs1RawMatch![1];
    const expMatch = gs1ParenMatch ? enTrimmed.match(/\(17\)(\d{6})/) : null;
    const lotMatch = gs1ParenMatch ? enTrimmed.match(/\(10\)([^\(\s]+)/) : null;
    const qtyMatch = gs1ParenMatch ? enTrimmed.match(/\(30\)(\d{1,5})/) : null;

    const rawExp = expMatch?.[1] || gs1RawMatch?.[2];
    const lot = lotMatch?.[1] || gs1RawMatch?.[3];
    const qty = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;

    const catalogHit = KNOWN_DENTAL_PRODUCT_CATALOG[gtin] || KNOWN_DENTAL_PRODUCT_CATALOG[gtin.replace(/^0+/, '')];
    const prefixMeta = resolveGs1PrefixMetadata(gtin.replace(/^0/, ''));

    return {
      barcode: gtin,
      qrCode: `MINA-UDI-${gtin.slice(-6)}`,
      name: catalogHit?.name || `محصول تخصصی UDI (${prefixMeta.brand} · ${gtin.slice(-5)})`,
      brand: catalogHit?.brand || prefixMeta.brand,
      category: catalogHit?.category || prefixMeta.category,
      lotNumber: lot,
      expiryDate: rawExp ? convertGs1YyMmDdToApproximateJalali(rawExp) : '۱۴۰۷/۰۶/۳۰',
      unit: catalogHit?.unit || 'بسته',
      suggestedQuantity: qty,
      pricePerUnit: catalogHit?.pricePerUnit || 1_250_000,
      sourceStandard: 'GS1-128 / UDI',
      originCountry: prefixMeta.originCountry
    };
  }

  // 3. Structured Pipe/URL Product Data: PRODUCT|نام|برند|دسته|بارکد|لات|انقضا|قیمت  OR  ?name=...&sku=...
  if (enTrimmed.toUpperCase().startsWith('PRODUCT|') || enTrimmed.toUpperCase().startsWith('MINA-PROD|')) {
    const parts = trimmed.split('|');
    const name = parts[1]?.trim() || 'متریال دندانپزشکی اسکن‌شده';
    const brand = parts[2]?.trim() || 'تجهیزات دندانپزشکی';
    const category = parts[3]?.trim() || 'مصرفی و بهداشتی';
    const barcode = toEnglishDigits(parts[4]?.trim() || `PRD-${Date.now().toString().slice(-6)}`);
    const lotNumber = parts[5]?.trim() || undefined;
    const expiryDate = parts[6]?.trim() || '۱۴۰۷/۰۳/۱۵';
    const pricePerUnit = Number(toEnglishDigits(parts[7] || '0').replace(/[^\d]/g, '')) || 0;
    return {
      barcode,
      qrCode: `MINA-INV-${barcode.slice(-6)}`,
      name,
      brand,
      category,
      lotNumber,
      expiryDate,
      unit: parts[8]?.trim() || 'عدد',
      suggestedQuantity: Number(toEnglishDigits(parts[9] || '1').replace(/[^\d]/g, '')) || 1,
      pricePerUnit,
      sourceStandard: 'برچسب محصول'
    };
  }

  if (/^https?:\/\//i.test(enTrimmed) && /(name|sku|gtin|product|barcode|lot|exp)=/i.test(enTrimmed)) {
    try {
      const url = new URL(enTrimmed);
      const sp = url.searchParams;
      const gtin = sp.get('gtin') || sp.get('barcode') || sp.get('sku') || `URL-${Date.now().toString().slice(-6)}`;
      const catalogHit = KNOWN_DENTAL_PRODUCT_CATALOG[gtin];
      return {
        barcode: gtin,
        qrCode: `MINA-INV-${gtin.slice(-6)}`,
        name: sp.get('name') || sp.get('product') || catalogHit?.name || `محصول دندانپزشکی (${gtin})`,
        brand: sp.get('brand') || catalogHit?.brand || 'برند تخصصی',
        category: sp.get('category') || catalogHit?.category || 'کامپوزیت و ترمیم',
        lotNumber: sp.get('lot') || sp.get('batch') || undefined,
        expiryDate: sp.get('exp') || sp.get('expiry') || '۱۴۰۷/۰۱/۰۱',
        unit: sp.get('unit') || catalogHit?.unit || 'عدد',
        suggestedQuantity: Number(sp.get('qty') || '1') || 1,
        pricePerUnit: Number(sp.get('price') || catalogHit?.pricePerUnit || 0) || 0,
        sourceStandard: 'برچسب محصول'
      };
    } catch {
      // ignore invalid url
    }
  }

  // 4. Standard Commercial 1D/2D Barcode (EAN-8, UPC, EAN-13, GTIN-14, Code-128 alphanumeric product code)
  const digitsOnly = enTrimmed.replace(/[^\d]/g, '');
  if (/^\d{8,14}$/.test(digitsOnly)) {
    const catalogHit =
      KNOWN_DENTAL_PRODUCT_CATALOG[digitsOnly] ||
      KNOWN_DENTAL_PRODUCT_CATALOG[`0${digitsOnly}`];
    const prefixMeta = resolveGs1PrefixMetadata(digitsOnly);
    return {
      barcode: digitsOnly,
      qrCode: `MINA-INV-${digitsOnly.slice(-6)}`,
      name: catalogHit?.name || `کالای جدید دندانپزشکی (${digitsOnly})`,
      brand: catalogHit?.brand || prefixMeta.brand,
      category: catalogHit?.category || prefixMeta.category,
      expiryDate: '۱۴۰۷/۰۶/۳۰',
      unit: catalogHit?.unit || 'عدد',
      suggestedQuantity: 1,
      pricePerUnit: catalogHit?.pricePerUnit || 0,
      sourceStandard: 'کد کالا / EAN-13',
      originCountry: prefixMeta.originCountry
    };
  }

  // Alphanumeric supplier SKU / Code-128 (e.g. 3M-Z350-A2, DENTIUM-4010)
  if (/^[A-Za-z0-9\-_.]{5,32}$/.test(enTrimmed) && !enTrimmed.toLowerCase().startsWith('aut-') && !enTrimmed.toLowerCase().startsWith('cssd-')) {
    return {
      barcode: enTrimmed.toUpperCase(),
      qrCode: `MINA-INV-${enTrimmed.slice(-6).toUpperCase()}`,
      name: `متریال دندانپزشکی کد ${enTrimmed.toUpperCase()}`,
      brand: 'تامین‌کننده مجاز مطب',
      category: 'مصرفی و بهداشتی',
      expiryDate: '۱۴۰۷/۰۶/۳۰',
      unit: 'عدد',
      suggestedQuantity: 1,
      pricePerUnit: 0,
      sourceStandard: 'کد کالا / EAN-13'
    };
  }

  return null;
}

/**
 * Resolve ANY scanned clinic QR / barcode across Inventory, New Product Barcodes/GS1, Lab Packets, Patients, Sterilization Packs & Sayad Checks.
 */
export function resolveClinicScanPayload(
  rawCode: string,
  patients: Patient[],
  inventory: InventoryItem[]
): ScannedClinicEntity | null {
  const trimmed = rawCode?.trim();
  if (!trimmed) return null;
  const normalized = toEnglishDigits(trimmed).toLowerCase();

  // 1. Lab Packet QR (e.g. QR-AB12, MINA-LAB-..., or order.id)
  const labSuffixMatch = normalized.match(/^(?:qr-|mina-lab-)([a-z0-9-]+)$/i);
  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const labs = p.labOrders || [];
    for (let j = 0; j < labs.length; j++) {
      const order = labs[j];
      const orderIdLower = order.id.toLowerCase();
      const orderShortLower = order.id.slice(-4).toLowerCase();
      if (
        orderIdLower === normalized ||
        (labSuffixMatch && (orderIdLower === labSuffixMatch[1] || orderShortLower === labSuffixMatch[1])) ||
        normalized === `qr-${orderShortLower}`
      ) {
        return { kind: 'lab', order, patient: p, rawCode: trimmed };
      }
    }
  }

  // 2. Patient Smart QR Card / File Number (e.g. MINA-PAT-D-1042, pat-1, D-1042)
  const patCodeClean = normalized.replace(/^mina-pat-/, '');
  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const fileEn = toEnglishDigits(p.fileNumber || '').toLowerCase();
    if (
      p.id.toLowerCase() === normalized ||
      p.id.toLowerCase() === patCodeClean ||
      (fileEn && (fileEn === normalized || fileEn === patCodeClean))
    ) {
      return { kind: 'patient', patient: p, rawCode: trimmed };
    }
  }

  // 3. Sterilization Autoclave Cycle / Pack (e.g. AUT-1405-0842, CSSD-...)
  if (normalized.startsWith('aut-') || normalized.startsWith('cssd-') || normalized.startsWith('mina-cssd-')) {
    const codeUpper = toEnglishDigits(trimmed).replace(/^mina-cssd-/i, '').toUpperCase();
    let deviceName: string | undefined;
    let statusText = 'اندیکاتور Class 6 تایید شده (Bowie-Dick PASS)';
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('minadental_cssd_cycles_v1') : null;
      if (saved) {
        const cycles = JSON.parse(saved);
        if (Array.isArray(cycles)) {
          const found = cycles.find(
            (c: any) =>
              String(c.cycleCode || '').toUpperCase() === codeUpper ||
              String(c.id || '').toUpperCase() === codeUpper
          );
          if (found) {
            deviceName = found.autoclaveDevice;
            statusText = `${found.chemicalIndicatorClass || 'Class 6'} · ${found.temperature || 134.4}°C (${found.bowieDickResult === 'pass' ? 'PASS' : 'بررسی'})`;
          }
        }
      }
    } catch {
      // Ignore storage error
    }
    return {
      kind: 'sterilization',
      cycleCode: codeUpper,
      deviceName,
      statusText,
      rawCode: trimmed
    };
  }

  // 4. Sayad Check 16-digit QR / URL (check before product barcodes so 16-digit checks don't match EAN)
  const sayadParsed = parseSayadCheckPayload(trimmed);
  if (sayadParsed) {
    return { kind: 'sayad_check', parsed: sayadParsed, rawCode: trimmed };
  }

  // 5. Existing Inventory Barcode / QR (MINA-INV-..., 626..., item.id, item.name)
  const invCodeClean = normalized.replace(/^mina-inv-/, '');
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    const qrMatch = item.qrCode && toEnglishDigits(item.qrCode).toLowerCase() === normalized;
    const barMatch = item.barcode && toEnglishDigits(item.barcode).toLowerCase() === normalized;
    const idMatch = item.id.toLowerCase() === normalized || item.id.toLowerCase() === invCodeClean;
    const nameMatch =
      normalized.length >= 3 &&
      (item.name.toLowerCase().includes(normalized) || normalized.includes(item.name.toLowerCase()));
    if (qrMatch || barMatch || idMatch || nameMatch) {
      return { kind: 'inventory', item, rawCode: trimmed };
    }
  }

  // 6. New Dental Product Barcode / GS1-128 / UDI / JSON QR Payload (Extract Structured Product Data)
  const parsedProduct = parseDentalProductBarcodePayload(trimmed);
  if (parsedProduct) {
    // Also check if parsed GTIN/barcode matches an existing inventory item (e.g. GS1 (01)GTIN wrapped around known barcode)
    const cleanGtin = toEnglishDigits(parsedProduct.barcode).toLowerCase();
    const matchedExisting = inventory.find(
      item =>
        (item.barcode && toEnglishDigits(item.barcode).toLowerCase() === cleanGtin) ||
        (item.qrCode && toEnglishDigits(item.qrCode).toLowerCase() === cleanGtin)
    );
    if (matchedExisting) {
      return { kind: 'inventory', item: matchedExisting, rawCode: trimmed };
    }
    return { kind: 'product_data', product: parsedProduct, rawCode: trimmed };
  }

  return null;
}
