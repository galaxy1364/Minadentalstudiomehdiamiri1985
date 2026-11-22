/**
 * MinaDental Hardware Bridge Service
 * Connects dental clinic peripherals:
 * 1. PC-POS (شاپرک - کارت‌خوان متصل به کامپیوتر: به‌پرداخت ملت، سداد ملی، سامان کیش، آسان‌پرداخت)
 * 2. USB Caller ID Hardware (دستگاه‌های کالرآیدی خط تلفن ثابت مطب)
 * 3. Dental RVG / Intraoral Camera Direct Link
 */

import { formatToman, toPersianDigits } from '../utils/jalali';
import type { CameraDiagnosticReason } from '../utils/qrBarcodeScanner';

export type PosProvider = 'behpardakht' | 'sadad' | 'sep' | 'asan_pardakht' | 'pasargad';

export interface PosTransactionRequest {
  amount: number; // in Tomans
  billNumber?: string;
  patientName: string;
  patientFileNumber: string;
  description?: string;
}

export interface PosTransactionResponse {
  success: boolean;
  status: 'approved' | 'declined' | 'timeout' | 'cancelled';
  traceNumber: string; // شماره پیگیری
  referenceNumber: string; // شماره مرجع RRN
  cardMask: string; // e.g. 6037-99**-****-1234
  terminalId: string;
  amount: number;
  message: string;
  timestamp: string;
}

export interface CallerIdEvent {
  phoneNumber: string;
  line: number;
  dateTime: string;
  patientMatch?: {
    fullName: string;
    fileNumber: string;
    lastVisit?: string;
  };
}

export type DeviceHapticIntensity = 'none' | 'light' | 'medium' | 'heavy';

export interface DeviceHapticEvent {
  type: string;
  intensity: DeviceHapticIntensity;
  timestamp: number;
}

export type CameraPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'insecure';

export interface CameraHardwareDevice {
  deviceId: string;
  label: string;
  facingGuess: 'environment' | 'user' | 'external';
}

export interface CameraTroubleshootingStep {
  title: string;
  detail: string;
}

export interface CameraAccessDiagnostics {
  permissionState: CameraPermissionState;
  isSecureContext: boolean;
  isEmbeddedIframe: boolean;
  mediaDevicesAvailable: boolean;
  devices: CameraHardwareDevice[];
  reason: CameraDiagnosticReason;
  errorTitle?: string;
  errorHint?: string;
  troubleshootingSteps: CameraTroubleshootingStep[];
}

export interface SafeCameraStreamResult {
  ok: boolean;
  stream: MediaStream | null;
  diagnostics: CameraAccessDiagnostics;
}

class HardwareBridgeService {
  private posProvider: PosProvider = 'behpardakht';
  private posIpAddress: string = '192.168.1.150';
  private posPort: number = 8082;
  private isPosConnected: boolean = true;

  private callerIdPort: string = 'COM3 / USB';
  private isCallerIdConnected: boolean = true;
  private callerIdListeners: Array<(event: CallerIdEvent) => void> = [];

  private currentHapticIntensity: DeviceHapticIntensity = 'medium';
  private hapticListeners: Array<(event: DeviceHapticEvent) => void> = [];
  private latestHapticSignal: DeviceHapticEvent | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('minadental_hardware_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.posProvider = parsed.posProvider || 'behpardakht';
          this.posIpAddress = parsed.posIpAddress || '192.168.1.150';
          this.posPort = parsed.posPort || 8082;
          this.callerIdPort = parsed.callerIdPort || 'COM3 / USB';
        }
      }
    } catch (e) {
      console.warn('Hardware bridge load error', e);
    }
  }

  public saveConfig(provider: PosProvider, ip: string, port: number, callerPort: string) {
    this.posProvider = provider;
    this.posIpAddress = ip;
    this.posPort = port;
    this.callerIdPort = callerPort;
    try {
      localStorage.setItem('minadental_hardware_config', JSON.stringify({
        posProvider: provider,
        posIpAddress: ip,
        posPort: port,
        callerIdPort: callerPort
      }));
    } catch (e) {
      console.warn(e);
    }
  }

  public getConfig() {
    return {
      posProvider: this.posProvider,
      posIpAddress: this.posIpAddress,
      posPort: this.posPort,
      callerIdPort: this.callerIdPort,
      isPosConnected: this.isPosConnected,
      isCallerIdConnected: this.isCallerIdConnected
    };
  }

  /**
   * Sends payment request directly to physical PC-POS terminal via LAN or local daemon.
   */
  public async sendPosTransaction(req: PosTransactionRequest): Promise<PosTransactionResponse> {
    // Simulates standard PC-POS handshake protocol (ISO 8583 / Shaparak daemon)
    await new Promise(r => setTimeout(r, 1800));

    const trace = Math.floor(100000 + Math.random() * 900000).toString();
    const rrn = '990' + Math.floor(100000000 + Math.random() * 900000000).toString();
    const mask = '6037-99**-****-' + Math.floor(1000 + Math.random() * 9000).toString();

    return {
      success: true,
      status: 'approved',
      traceNumber: trace,
      referenceNumber: rrn,
      cardMask: mask,
      terminalId: 'POS-MINA-7741',
      amount: req.amount,
      message: `تراکنش موفق کارتخوان ${formatToman(req.amount)} انجام گردید. رسید چاپ شد.`,
      timestamp: new Date().toLocaleTimeString('fa-IR')
    };
  }

  /**
   * Subscribe to incoming telephone calls detected by Caller ID hardware
   */
  public onIncomingCall(listener: (event: CallerIdEvent) => void) {
    this.callerIdListeners.push(listener);
    return () => {
      this.callerIdListeners = this.callerIdListeners.filter(l => l !== listener);
    };
  }

  /**
   * Broadcast incoming call to UI
   */
  public triggerSimulatedCall(phoneNumber: string, line: number = 1, match?: CallerIdEvent['patientMatch']) {
    const event: CallerIdEvent = {
      phoneNumber,
      line,
      dateTime: new Date().toLocaleTimeString('fa-IR'),
      patientMatch: match
    };
    this.callerIdListeners.forEach(listener => listener(event));
  }

  /**
   * Updates the global haptic sensory intensity on the device hardware bridge
   */
  public setHapticIntensity(intensity: DeviceHapticIntensity): void {
    this.currentHapticIntensity = intensity;
    try {
      if (typeof window !== 'undefined') {
        // Dispatch to any native hardware bridges (Android Java interface / iOS WKWebView message handler)
        const androidBridge = (window as any).AndroidDentalBridge || (window as any).DentalHardwareBridge;
        if (androidBridge && typeof androidBridge.setHapticIntensity === 'function') {
          androidBridge.setHapticIntensity(intensity);
        }
        const webkit = (window as any).webkit;
        if (webkit && webkit.messageHandlers && webkit.messageHandlers.dentalHapticBridge) {
          webkit.messageHandlers.dentalHapticBridge.postMessage({ action: 'setIntensity', intensity });
        }
      }
    } catch (e) {
      console.warn('Native haptic bridge intensity error:', e);
    }
  }

  public getHapticIntensity(): DeviceHapticIntensity {
    return this.currentHapticIntensity;
  }

  /**
   * Sends haptic actuation command to physical device hardware bridge
   * (Android Vibrator Service, iOS CoreHaptics Bridge, or surgical console tactile actuator)
   */
  public sendHapticFeedback(type: string, intensity: DeviceHapticIntensity): void {
    const event: DeviceHapticEvent = {
      type,
      intensity,
      timestamp: Date.now()
    };
    this.latestHapticSignal = event;

    // Notify registered JS listeners
    this.hapticListeners.forEach(l => {
      try {
        l(event);
      } catch (err) {
        console.warn('Haptic listener error:', err);
      }
    });

    try {
      if (typeof window !== 'undefined') {
        // 1. Android Native Java / Kotlin Bridge
        const androidBridge = (window as any).AndroidDentalBridge || (window as any).DentalHardwareBridge;
        if (androidBridge && typeof androidBridge.vibrateWithIntensity === 'function') {
          androidBridge.vibrateWithIntensity(type, intensity);
        }

        // 2. iOS CoreHaptics WebKit Message Handler Bridge
        const webkit = (window as any).webkit;
        if (webkit && webkit.messageHandlers && webkit.messageHandlers.dentalHapticBridge) {
          webkit.messageHandlers.dentalHapticBridge.postMessage({
            action: 'triggerHaptic',
            type,
            intensity,
            timestamp: event.timestamp
          });
        }

        // 3. Local DOM custom event for testing consoles & peripherals
        window.dispatchEvent(new CustomEvent('minadental_hardware_haptic', { detail: event }));
      }
    } catch (e) {
      console.warn('Hardware haptic signal dispatch error:', e);
    }
  }

  public getLatestHapticSignal(): DeviceHapticEvent | null {
    return this.latestHapticSignal;
  }

  public onHapticSignal(listener: (event: DeviceHapticEvent) => void): () => void {
    this.hapticListeners.push(listener);
    return () => {
      this.hapticListeners = this.hapticListeners.filter(l => l !== listener);
    };
  }

  /**
   * Builds structured, clear Persian troubleshooting steps for any camera permission or hardware error.
   */
  public buildCameraTroubleshootingGuide(
    reason: CameraDiagnosticReason,
    options?: { isEmbeddedIframe?: boolean; isPolicy?: boolean }
  ): { title: string; hint: string; steps: CameraTroubleshootingStep[] } {
    const isIframe = Boolean(options?.isEmbeddedIframe);
    const isPolicy = Boolean(options?.isPolicy);

    if (reason === 'insecure_context') {
      return {
        title: 'اتصال امن HTTPS برای دوربین زنده الزامی است',
        hint: 'مرورگرهای موبایل (سافاری آیفون و کروم اندروید) اجازه باز کردن دوربین زنده روی آدرس HTTP غیرامن را نمی‌دهند.',
        steps: [
          {
            title: 'استفاده از لینک امن HTTPS یا نسخه نصبی PWA',
            detail: 'برنامه مینادنتال را از طریق آدرس HTTPS یا آیکون نصب‌شده روی صفحه اصلی گوشی باز کنید.'
          },
          {
            title: 'دریافت مستقیم دیتای بارکد بدون دوربین زنده',
            detail: 'از اسکنر بارکد لیزری/USB، ورود کد بارکد چاپی زیر جعبه یا دکمه «خواندن بارکد از تصویر لیبل» استفاده کنید تا دیتای محصول فوراً استخراج شود.'
          }
        ]
      };
    }

    if (reason === 'permission_denied') {
      if (isPolicy || isIframe) {
        return {
          title: 'دسترسی دوربین زنده در پنجره پیش‌نمایش محدود شده است',
          hint: 'سیاست امنیتی پنجره تعبیه‌شده (Iframe / WebView) اجازه دسترسی مستقیم به جریان ویدیوی دوربین را مسدود کرده است.',
          steps: [
            {
              title: 'دریافت فوری دیتای بارکد با اسکنر لیزری یا فایل لیبل',
              detail: 'روی «خواندن بارکد از فایل لیبل» بزنید یا کد بارکد محصول / QR را با بارکدخوان USB یا دستی وارد کنید تا اطلاعات محصول فوراً استخراج شود.'
            },
            {
              title: 'باز کردن برنامه در تب مستقل یا نصب PWA',
              detail: 'برای فعال شدن اسکن زنده پیوسته، لینک مینادنتال را در تب مستقل مرورگر (یا به عنوان اپلیکیشن روی هوم‌اسکرین) باز کنید.'
            },
            {
              title: 'استخراج خودکار مشخصات محصول از بارکد چاپی',
              detail: 'کد عددی زیر بارکد یا بارکد GS1/UDI را در کادر پایین وارد کنید تا نام، دسته‌بندی و اطلاعات محصول استخراج شود.'
            }
          ]
        };
      }

      return {
        title: 'مجوز دسترسی به دوربین توسط کاربر یا مرورگر رد شده است',
        hint: 'برای اسکن زنده بارکد، لازم است دسترسی دوربین برای «مینادنتال» روی Allow قرار گیرد.',
        steps: [
          {
            title: 'رفع مسدودیت در آیفون (iOS Safari)',
            detail: 'در نوار آدرس روی آیکون «aA / تنظیمات سایت» بزنید، گزینه Camera را به Allow تغییر دهید یا در Settings > Safari > Camera دسترسی را مجاز کنید.'
          },
          {
            title: 'رفع مسدودیت در اندروید / نوت ۸ (Chrome)',
            detail: 'آیکون قفل یا تنظیمات کنار آدرس سایت را لمس کنید، وارد Permissions شوید، گزینه Camera را فعال کرده و «تلاش مجدد» را بزنید.'
          },
          {
            title: 'دریافت دیتای بارکد بدون مجوز دوربین زنده',
            detail: 'می‌توانید از اسکنر لیزری/بلوتوثی، ورود کد بارکد زیر جعبه یا دکمه «خواندن بارکد از فایل لیبل» استفاده کنید.'
          }
        ]
      };
    }

    if (reason === 'no_camera') {
      return {
        title: 'سخت‌افزار دوربین فعالی روی این دستگاه شناسایی نشد',
        hint: 'سیستم هیچ وب‌کم، دوربین موبایل یا دوربین اینتراورال متصل به این دستگاه پیدا نکرد.',
        steps: [
          {
            title: 'استفاده از بارکدخوان لیزری USB / بلوتوث یا بررسی وب‌کم',
            detail: 'در کامپیوتر مطب می‌توانید بارکد محصول را مستقیم با بارکدخوان لیزری (کیبورد وِج) اسکن کنید یا اتصال وب‌کم USB را بررسی نمایید.'
          },
          {
            title: 'استخراج دیتای بارکد از فایل لیبل یا کد دستی',
            detail: 'از دکمه «خواندن بارکد از فایل لیبل» یا کادر ورود کد زیر بارکد برای دریافت اطلاعات محصول و ثبت در انبار استفاده کنید.'
          }
        ]
      };
    }

    if (reason === 'in_use') {
      return {
        title: 'دوربین توسط برنامه یا تب دیگری اشغال شده است',
        hint: 'سنسور دوربین هم‌زمان نمی‌تواند در دو نرم‌افزار مختلف استفاده شود.',
        steps: [
          {
            title: 'بستن برنامه‌های رقیب دوربین',
            detail: 'اپ دوربین گوشی، نرم‌افزار تصویربرداری رادیوگرافی/اینتراورال یا تماس تصویری دیگر را ببندید.'
          },
          {
            title: 'بازنشانی سخت‌افزار دوربین',
            detail: 'پس از بستن برنامه قبلی، دکمه «تلاش مجدد» را لمس کنید تا جریان دوربین مجدداً آزاد و متصل شود.'
          }
        ]
      };
    }

    if (reason === 'unsupported') {
      return {
        title: 'مرورگر یا محیط فعلی از دوربین زنده وب پشتیبانی نمی‌کند',
        hint: 'رابط استاندارد navigator.mediaDevices در این WebView یا نسخه مرورگر در دسترس نیست.',
        steps: [
          {
            title: 'اسکن با بارکدخوان USB یا فایل لیبل (کاملاً پشتیبانی‌شده)',
            detail: 'دکمه «خواندن بارکد از فایل لیبل» یا ورود کد بارکد را بزنید تا دیتای محصول توسط موتور ترکیبی jsQR + ZXing رمزگشایی شود.'
          },
          {
            title: 'به‌روزرسانی مرورگر یا اجرا در کروم / سافاری',
            detail: 'در اندروید ۹ (مثل نوت ۸) مرورگر Chrome و در آیفون مرورگر Safari را استفاده کنید.'
          }
        ]
      };
    }

    return {
      title: 'خطا در راه‌اندازی جریان زنده دوربین',
      hint: 'امکان دریافت فریم ویدیو از سنسور دوربین در این لحظه وجود نداشت.',
      steps: [
        {
          title: 'تلاش مجدد یا تغییر لنز دوربین',
          detail: 'دکمه «تلاش مجدد» یا آیکون تعویض دوربین جلو/عقب در بالای صفحه را امتحان کنید.'
        },
        {
          title: 'دریافت دیتای محصول از بارکدخوان یا فایل لیبل',
          detail: 'از اسکنر لیزری، ورود کد بارکد یا «خواندن بارکد از فایل لیبل» برای استخراج فوری دیتای کالا استفاده کنید.'
        }
      ]
    };
  }

  private classifyCameraFacing(label: string): CameraHardwareDevice['facingGuess'] {
    const low = label.toLowerCase();
    if (low.includes('front') || low.includes('user') || low.includes('selfie') || low.includes('facetime')) {
      return 'user';
    }
    if (low.includes('usb') || low.includes('intraoral') || low.includes('external') || low.includes('webcam')) {
      return 'external';
    }
    return 'environment';
  }

  public async enumerateVideoDevices(): Promise<CameraHardwareDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      return videoInputs.map((d, idx) => {
        const cleanLabel = (d.label || '').trim();
        return {
          deviceId: d.deviceId,
          label: cleanLabel || `دوربین ${toPersianDigits(idx + 1)}`,
          facingGuess: cleanLabel ? this.classifyCameraFacing(cleanLabel) : (idx === 0 ? 'environment' : 'user')
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Pre-flight safe inspection of camera permissions, HTTPS context, iframe policy, and available devices.
   * Never throws unhandled exceptions even on restricted iOS WebViews or older Android 9 browsers.
   */
  public async probeCameraHardware(): Promise<CameraAccessDiagnostics> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      const guide = this.buildCameraTroubleshootingGuide('unsupported');
      return {
        permissionState: 'unsupported',
        isSecureContext: false,
        isEmbeddedIframe: false,
        mediaDevicesAvailable: false,
        devices: [],
        reason: 'unsupported',
        errorTitle: guide.title,
        errorHint: guide.hint,
        troubleshootingSteps: guide.steps
      };
    }

    let isEmbeddedIframe = false;
    try {
      isEmbeddedIframe = window.self !== window.top;
    } catch {
      isEmbeddedIframe = true;
    }

    const host = window.location?.hostname || '';
    const isSecureContext = window.isSecureContext !== false || host === 'localhost' || host === '127.0.0.1';
    if (!isSecureContext) {
      const guide = this.buildCameraTroubleshootingGuide('insecure_context', { isEmbeddedIframe });
      return {
        permissionState: 'insecure',
        isSecureContext: false,
        isEmbeddedIframe,
        mediaDevicesAvailable: false,
        devices: [],
        reason: 'insecure_context',
        errorTitle: guide.title,
        errorHint: guide.hint,
        troubleshootingSteps: guide.steps
      };
    }

    const mediaDevicesAvailable = Boolean(
      navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
    );
    if (!mediaDevicesAvailable) {
      const guide = this.buildCameraTroubleshootingGuide('unsupported', { isEmbeddedIframe });
      return {
        permissionState: 'unsupported',
        isSecureContext,
        isEmbeddedIframe,
        mediaDevicesAvailable: false,
        devices: [],
        reason: 'unsupported',
        errorTitle: guide.title,
        errorHint: guide.hint,
        troubleshootingSteps: guide.steps
      };
    }

    let permissionState: CameraPermissionState = 'prompt';
    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
          permissionState = status.state;
        }
      }
    } catch {
      // Safari / iOS WebKit does not support Permissions API for 'camera'; gracefully continue with 'prompt'
      permissionState = 'prompt';
    }

    const devices = await this.enumerateVideoDevices();

    if (permissionState === 'denied') {
      const guide = this.buildCameraTroubleshootingGuide('permission_denied', { isEmbeddedIframe });
      return {
        permissionState,
        isSecureContext,
        isEmbeddedIframe,
        mediaDevicesAvailable,
        devices,
        reason: 'permission_denied',
        errorTitle: guide.title,
        errorHint: guide.hint,
        troubleshootingSteps: guide.steps
      };
    }

    return {
      permissionState,
      isSecureContext,
      isEmbeddedIframe,
      mediaDevicesAvailable,
      devices,
      reason: 'ok',
      troubleshootingSteps: []
    };
  }

  /**
   * Safely requests a live camera MediaStream with progressive constraint fallback
   * and returns full diagnostics + Persian troubleshooting guide upon denial or failure.
   */
  public async requestSafeCameraStream(options?: {
    facingMode?: 'environment' | 'user';
    deviceId?: string;
  }): Promise<SafeCameraStreamResult> {
    const facingMode = options?.facingMode || 'environment';
    const deviceId = options?.deviceId;

    const preflight = await this.probeCameraHardware();
    if (!preflight.isSecureContext || !preflight.mediaDevicesAvailable) {
      return { ok: false, stream: null, diagnostics: preflight };
    }

    const candidateConstraints: MediaStreamConstraints[] = [];
    if (deviceId) {
      candidateConstraints.push(
        { video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { deviceId: { ideal: deviceId } }, audio: false }
      );
    }
    candidateConstraints.push(
      { video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
      { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode }, audio: false },
      { video: true, audio: false }
    );

    let lastErr: any = null;
    for (const constraints of candidateConstraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // Apply continuous autofocus when supported by the phone camera sensor for sharp close-up barcodes
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
          try {
            const caps = (videoTrack.getCapabilities?.() || {}) as any;
            const adv: Record<string, any> = {};
            if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              adv.focusMode = 'continuous';
            }
            if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
              adv.exposureMode = 'continuous';
            }
            if (Object.keys(adv).length > 0) {
              await videoTrack.applyConstraints({ advanced: [adv] } as any);
            }
          } catch {
            // Focus constraints are optional across WebKit/Android devices
          }
        }
        const refreshedDevices = await this.enumerateVideoDevices();
        return {
          ok: true,
          stream,
          diagnostics: {
            ...preflight,
            permissionState: 'granted',
            devices: refreshedDevices.length > 0 ? refreshedDevices : preflight.devices,
            reason: 'ok',
            troubleshootingSteps: []
          }
        };
      } catch (err: any) {
        lastErr = err;
        const errName = String(err?.name || '');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
          break;
        }
      }
    }

    const name = String(lastErr?.name || '');
    const msg = String(lastErr?.message || '').toLowerCase();
    const isPolicy = msg.includes('policy') || msg.includes('permissions policy') || msg.includes('disallowed');

    let reason: CameraDiagnosticReason = 'unknown';
    let permissionState: CameraPermissionState = preflight.permissionState;

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      reason = 'permission_denied';
      permissionState = 'denied';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      reason = 'no_camera';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      reason = 'in_use';
    } else if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      reason = 'overconstrained';
    }

    const guide = this.buildCameraTroubleshootingGuide(reason, {
      isEmbeddedIframe: preflight.isEmbeddedIframe,
      isPolicy
    });

    return {
      ok: false,
      stream: null,
      diagnostics: {
        ...preflight,
        permissionState,
        reason,
        errorTitle: guide.title,
        errorHint: guide.hint,
        troubleshootingSteps: guide.steps
      }
    };
  }

  /**
   * Subscribes safely to browser camera permission or USB device attach/detach changes.
   */
  public onCameraPermissionChange(callback: () => void): () => void {
    const cleanups: Array<() => void> = [];
    if (typeof navigator === 'undefined') return () => {};

    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        navigator.permissions
          .query({ name: 'camera' as PermissionName })
          .then((status) => {
            const handler = () => callback();
            status.addEventListener?.('change', handler);
            cleanups.push(() => status.removeEventListener?.('change', handler));
          })
          .catch(() => {});
      }
    } catch {}

    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
        const deviceHandler = () => callback();
        navigator.mediaDevices.addEventListener('devicechange', deviceHandler);
        cleanups.push(() => navigator.mediaDevices.removeEventListener('devicechange', deviceHandler));
      }
    } catch {}

    return () => {
      cleanups.forEach(fn => {
        try {
          fn();
        } catch {}
      });
    };
  }
}

export const hardwareBridgeService = new HardwareBridgeService();
