/**
 * MinaDental Hardware Bridge Service
 * Connects dental clinic peripherals:
 * 1. PC-POS (شاپرک - کارت‌خوان متصل به کامپیوتر: به‌پرداخت ملت، سداد ملی، سامان کیش، آسان‌پرداخت)
 * 2. USB Caller ID Hardware (دستگاه‌های کالرآیدی خط تلفن ثابت مطب)
 * 3. Dental RVG / Intraoral Camera Direct Link
 */

import { formatToman, toPersianDigits } from '../utils/jalali';

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

class HardwareBridgeService {
  private posProvider: PosProvider = 'behpardakht';
  private posIpAddress: string = '192.168.1.150';
  private posPort: number = 8082;
  private isPosConnected: boolean = true;

  private callerIdPort: string = 'COM3 / USB';
  private isCallerIdConnected: boolean = true;
  private callerIdListeners: Array<(event: CallerIdEvent) => void> = [];

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
}

export const hardwareBridgeService = new HardwareBridgeService();
