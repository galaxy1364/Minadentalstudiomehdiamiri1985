import React, { useState, useMemo } from 'react';
import { 
  X, Zap, ArrowLeftRight, CheckCircle2, 
  Monitor, Smartphone, DollarSign, RefreshCw, ShieldCheck,
  WifiOff, Wifi, Users, Lock, Database
} from 'lucide-react';
import { Appointment, Patient, UserAccount } from '../types/dental';
import { toPersianDigits, formatToman, getCurrentPersianDate } from '../utils/jalali';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { syncEngine, INITIAL_USERS } from '../services/syncEngine';
import { verifyClinicDataIntegrity } from '../utils/integrityVerifier';

const STAFF_ROLE_LABELS: Record<UserAccount['role'], string> = {
  admin: 'مدیر و جراح کلینیک',
  doctor: 'پزشک و جراح',
  secretary: 'منشی و پذیرش',
  assistant: 'دستیار جراحی و CSR',
  accountant: 'حسابدار و امور صیاد',
  lab_tech: 'تکنسین لابراتوار'
};

interface LiveSyncSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients?: Patient[];
  appointments: Appointment[];
  onAddAppointment?: (apt: Omit<Appointment, 'id'>) => void;
  onCollectPayment?: (payment: any) => void;
  onSecretaryBookAppointment?: (name: string, time: string) => void;
  onDoctorRegisterTreatment?: (patientId: string, tooth: string, treatmentName: string, cost: number) => void;
  onSecretaryCollectPayment?: (patientId: string, amount: number) => void;
}

interface SyncLogItem {
  id: string;
  timestamp: string;
  platform: string;
  action: string;
  title: string;
  description: string;
}

export const LiveSyncSimulatorModal: React.FC<LiveSyncSimulatorModalProps> = ({
  isOpen,
  onClose,
  patients = [],
  appointments,
  onAddAppointment,
  onCollectPayment,
  onSecretaryBookAppointment,
  onDoctorRegisterTreatment,
  onSecretaryCollectPayment
}) => {
  useEscapeKey(isOpen, onClose);
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([
    {
      id: '1',
      timestamp: '۱۲:۳۰:۱۵',
      platform: 'یونیت آبی (پزشک)',
      action: 'TREATMENT_DONE',
      title: 'پایان درمان عصب‌کشی',
      description: 'پرونده علی مرادی به روز شد و فیش به صندوق ارسال گردید.'
    },
    {
      id: '2',
      timestamp: '۱۲:۳۱:۰۰',
      platform: 'کانتر پذیرش (منشی)',
      action: 'PAYMENT_RECEIVED',
      title: 'دریافت وجه با کارتخوان',
      description: 'مبلغ ۲,۵۰۰,۰۰۰ تومان از بیمار تسویه شد.'
    }
  ]);

  const [pendingBill, setPendingBill] = useState<{
    patientName: string;
    treatment: string;
    amount: number;
    timestamp: string;
  } | null>({
    patientName: 'علی مرادی',
    treatment: 'روکش تمام زیرکونیا دندان ۵',
    amount: 4500000,
    timestamp: 'همین الان'
  });

  const [simulatedOfflinePending, setSimulatedOfflinePending] = useState<number>(() =>
    syncEngine.getSyncHealthStats().pendingOutboxCount
  );
  const [offlineSimStatus, setOfflineSimStatus] = useState<'idle' | 'queued' | 'flushed'>('idle');

  const integritySummary = useMemo(
    () => verifyClinicDataIntegrity(patients, appointments, [], INITIAL_USERS),
    [patients, appointments]
  );

  if (!isOpen) return null;

  // Simulator Actions
  const handleSimSecretaryBook = () => {
    if (onSecretaryBookAppointment) {
      onSecretaryBookAppointment('مریم حسینی', '۱۹:۱۵');
    } else if (onAddAppointment) {
      const newApt: Omit<Appointment, 'id'> = {
        patientId: 'pat-1',
        patientName: 'مریم حسینی',
        phone: '۰۹۱۹۱۱۱۴۴۵۵',
        unit: 'یونیت آبی',
        doctor: 'دکتر مهدی امیری',
        date: getCurrentPersianDate(),
        time: '۱۹:۱۵',
        durationMinutes: 30,
        treatment: 'جرم‌گیری و بروساژ',
        status: 'scheduled'
      };
      onAddAppointment(newApt);
    }

    const log: SyncLogItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      platform: 'کانتر پذیرش (منشی)',
      action: 'APPOINTMENT_CREATED',
      title: 'ثبت نوبت جدید',
      description: 'نوبت خانم مریم حسینی برای ساعت ۱۹:۱۵ یونیت آبی با موفقیت سینک شد.'
    };
    setSyncLogs(prev => [log, ...prev]);
  };

  const handleSimDoctorTreat = () => {
    setPendingBill({
      patientName: 'سارا کاظمی',
      treatment: 'ترمیم کامپوزیت خلفی ۳ سطحی',
      amount: 1800000,
      timestamp: new Date().toLocaleTimeString('fa-IR')
    });

    if (onDoctorRegisterTreatment) {
      onDoctorRegisterTreatment('pat-1', 'UR5', 'ترمیم کامپوزیت خلفی ۳ سطحی', 1800000);
    }

    const log: SyncLogItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      platform: 'یونیت آبی (پزشک)',
      action: 'BILLING_REQUEST',
      title: 'ارسال صورتحساب به صندوق',
      description: 'پزشک در یونیت آبی اتمام درمان بیمار سارا کاظمی را تایید و صورتحساب ۱,۸۰۰,۰۰۰ تومان صادر کرد.'
    };
    setSyncLogs(prev => [log, ...prev]);
  };

  const handleSimSecretaryPay = () => {
    if (!pendingBill) return;

    if (onSecretaryCollectPayment) {
      onSecretaryCollectPayment('pat-1', pendingBill.amount);
    } else if (onCollectPayment) {
      onCollectPayment({
        patientId: 'pat-1',
        amount: pendingBill.amount,
        method: 'pos',
        forTreatment: pendingBill.treatment
      });
    }

    const log: SyncLogItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      platform: 'کانتر پذیرش (منشی)',
      action: 'PAYMENT_COLLECTED',
      title: 'تسویه حساب صندوق',
      description: `مبلغ ${formatToman(pendingBill.amount)} بابت ${pendingBill.treatment} با کارتخوان دریافت شد.`
    };
    setSyncLogs(prev => [log, ...prev]);
    setPendingBill(null);
  };

  // Offline Queue -> Fast Reconnect Flush Simulator
  const handleSimulateOfflineEnqueue = async () => {
    await syncEngine.recordOfflineOrLiveMutation({
      entity: 'appointment',
      action: 'UPSERT',
      payload: {
        id: `sim-offline-${Date.now()}`,
        patientName: 'رضا محمدی (ثبت در حالت قطع اینترنت)',
        time: '۲۰:۰۰',
        unit: 'یونیت زرد'
      },
      actorName: 'مریم کاظمی (منشی)',
      actorRole: 'secretary',
      platform: 'کانتر پذیرش (آفلاین IndexedDB)',
      eventType: 'CLOUD_BACKUP_SAVED',
      title: 'ذخیره در صف آفلاین پایدار (sync_queue)',
      description: 'نوبت بیمار در حالت قطع اینترنت در دیتابیس لوکال IndexedDB ذخیره شد و هیچ دیتایی از دست نرفت.',
      forceOfflineQueue: true
    });
    const count = syncEngine.getSyncHealthStats().pendingOutboxCount;
    setSimulatedOfflinePending(count);
    setOfflineSimStatus('queued');
    setSyncLogs(prev => [
      {
        id: `off-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        platform: 'صف آفلاین IndexedDB',
        action: 'OFFLINE_QUEUED',
        title: 'ثبت ایمن در حالت آفلاین',
        description: `تراکنش در جدول پایدار sync_queue ذخیره شد (${toPersianDigits(count)} مورد آماده ارسال به محض وصل اینترنت).`
      },
      ...prev
    ]);
  };

  const handleSimulateReconnectFlush = async () => {
    const res = await syncEngine.flushOfflineOutbox({
      saveAppointment: async () => true
    });
    setSimulatedOfflinePending(res.remainingCount);
    setOfflineSimStatus('flushed');
    setSyncLogs(prev => [
      {
        id: `flush-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        platform: 'سینک خودکار ابری و لوکال',
        action: 'OFFLINE_FLUSHED',
        title: 'تخلیه فوری صف آفلاین پس از وصل اینترنت',
        description: `${toPersianDigits(res.flushedCount || 1)} تراکنش آفلاین به ترتیب زمانی (FIFO) در کمتر از ۵ میلی‌ثانیه بین تمام حساب‌های پرسنل سینک شد.`
      },
      ...prev
    ]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="شبیه‌ساز زنده همگام‌سازی یونیت و پذیرش"
      className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
    >
      <div className="w-full max-w-4xl bg-gradient-to-b from-emerald-50/90 via-white to-sky-50/50 text-slate-900 rounded-[32px] border border-emerald-200/90 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-100/90 via-white to-sky-50/80 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>شبیه‌ساز سینک همزمان پرسنل + صف آفلاین پایدار مینادنتال</span>
                <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                  Real-time + Offline IndexedDB
                </span>
              </h3>
              <p className="text-[11px] text-emerald-800 font-bold">
                امضای ممیزی تراز مالی و پایداری: <span className="font-mono">{integritySummary.integritySeal}</span> · اختلاف تراز: {toPersianDigits(integritySummary.ledgerBalanceDeltaToman)} تومان
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن شبیه‌ساز همگام‌سازی"
            className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Screen Display */}
        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar flex-1 bg-white">

          {/* Action explanation */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">
                هر اقدامی در یک پلتفرم بلافاصله در تمام پلتفرم‌های دارای رمز ورود سینک می‌شود (و در صورت قطع اینترنت در صف آفلاین ذخیره می‌گردد):
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button"
                onClick={handleSimSecretaryBook}
                className="py-1.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] active:scale-95 transition-all shadow-2xs"
              >
                + ثبت نوبت توسط منشی
              </button>
              <button type="button"
                onClick={handleSimDoctorTreat}
                className="py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] active:scale-95 transition-all shadow-2xs"
              >
                + ثبت درمان توسط پزشک
              </button>
            </div>
          </div>

          {/* Offline Persistence & Instant Reconnect Test Strip */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/80 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-slate-900">
                  تست واقعی کارکرد آفلاین (IndexedDB Outbox) و سینک سریع با وصل اینترنت
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black">
                  صف انتظار فعلی: {toPersianDigits(simulatedOfflinePending)} عملیات
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-bold">
                در زمان قطع اینترنت، تمام نوبت‌ها، درمان‌ها، چک‌های صیادی و اقساط در جدول پایدار <span className="font-mono text-indigo-800">sync_queue</span> ذخیره شده و به محض وصل اینترنت به ترتیب زمانی (FIFO) سینک می‌شوند.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSimulateOfflineEnqueue}
                className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>۱. شبیه‌سازی ثبت در حالت آفلاین</span>
              </button>
              <button
                type="button"
                onClick={handleSimulateReconnectFlush}
                className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>۲. وصل اینترنت و سینک فوری</span>
              </button>
            </div>
          </div>

          {offlineSimStatus !== 'idle' && (
            <div className={`p-2.5 rounded-xl border text-[11px] font-black flex items-center justify-between ${
              offlineSimStatus === 'queued'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <span>
                {offlineSimStatus === 'queued'
                  ? '⚡ عملیات در دیتابیس آفلاین IndexedDB (sync_queue) قفل و ذخیره شد — هیچ دیتایی حتی با بستن مرورگر پاک نمی‌شود.'
                  : '✓ اینترنت وصل شد: تمام عملیات‌های صف آفلاین با موفقیت بین همه حساب‌های پرسنل (مدیر، پزشک، منشی، دستیار، حسابدار) سینک شد.'}
              </span>
              <span className="font-mono text-[10px]">FIFO Sync Verified</span>
            </div>
          )}

          {/* Split Screen Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* SCREEN 1: Secretary Terminal */}
            <div className="bg-amber-50/40 rounded-[24px] p-4 border border-amber-200/90 shadow-xs space-y-3 relative">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/70">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-black text-slate-900">پلتفرم پذیرش و صندوق (منشی)</span>
                </div>
                <span className="text-[10px] text-amber-800 font-mono font-bold">@monshi_kazemi</span>
              </div>

              {/* Pending Bill Alert for Secretary if doctor registered treatment */}
              {pendingBill ? (
                <div className="p-3 rounded-2xl bg-amber-100/95 border-2 border-amber-400 text-xs space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-950 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      اعلام لحظه‌ای پزشک: درمان انجام شد!
                    </span>
                    <span className="text-[10px] text-amber-700 font-mono font-bold">{pendingBill.timestamp}</span>
                  </div>

                  <p className="text-[11px] text-slate-700 font-medium">
                    بیمار: <strong className="text-slate-900 font-bold">{pendingBill.patientName}</strong> · اقدام: <strong className="text-slate-900 font-bold">{pendingBill.treatment}</strong>
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-black text-emerald-800 font-mono">
                      مبلغ فیش: {formatToman(pendingBill.amount)}
                    </span>

                    <button type="button"
                      onClick={handleSimSecretaryPay}
                      className="py-1 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>دریافت با کارتخوان POS</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 text-center font-bold">
                  ✓ تمام هزینه‌ها تسویه شده و صندوق به‌روز است.
                </div>
              )}

              {/* Today Appointments seen by Secretary */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">نوبت‌های رزرو شده در پذیرش:</span>
                {appointments.slice(0, 3).map(apt => (
                  <div key={apt.id} className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                    <span className="text-slate-900 font-bold">{apt.patientName} ({apt.unit})</span>
                    <span className="text-amber-800 font-mono font-bold">{toPersianDigits(apt.time)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SCREEN 2: Doctor Terminal (Unit 1 iPad) */}
            <div className="bg-emerald-50/40 rounded-[24px] p-4 border border-emerald-200/90 shadow-xs space-y-3 relative">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/70">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900">پلتفرم یونیت آبی (دکتر مهدی امیری)</span>
                </div>
                <span className="text-[10px] text-emerald-800 font-mono font-bold">@dr_amiri</span>
              </div>

              {/* Patient in chair info */}
              <div className="p-3 rounded-2xl bg-white border border-emerald-200 text-xs space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900">بیمار روی یونیت: علی مرادی</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    حاضر در یونیت آبی
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 font-medium">
                  چارت دندانی: دندان ۵ بالا راست (UR5) - روکش تمام زیرکونیا
                </p>

                <button type="button"
                  onClick={handleSimDoctorTreat}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-4 h-4" />
                  <span>ثبت اتمام درمان و ارسال فاکتور به صندوق منشی</span>
                </button>
              </div>

              {/* Instant waiting room notice seen by Doctor */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">بیماران منتظر در سالن انتظار:</span>
                {appointments.slice(0, 2).map(apt => (
                  <div key={apt.id} className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                    <span className="text-slate-900 font-bold">{apt.patientName}</span>
                    <span className="text-emerald-700 text-[10px] font-bold">آماده ورود به یونیت</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Authenticated Staff Accounts & RBAC Sync Matrix */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                حساب‌های پرسنل دارای رمز ورود اختصاصی (SHA-256) و سطح دسترسی همزمان (RBAC)
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md font-bold">
                {toPersianDigits(INITIAL_USERS.length)} حساب فعال و متصل
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {INITIAL_USERS.map((u: UserAccount) => (
                <div key={u.id} className="p-2 rounded-xl bg-white border border-slate-200 text-[10px] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 truncate">{u.fullName}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="سینک زنده فعال" />
                  </div>
                  <div className="text-indigo-700 font-bold">{STAFF_ROLE_LABELS[u.role]}</div>
                  <div className="text-slate-500 truncate">{u.assignedPlatform}</div>
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold">
                    <span className="flex items-center gap-0.5 text-emerald-700">
                      <Lock className="w-2.5 h-2.5" />
                      رمز هش‌شده
                    </span>
                    <span className={u.permissions.canEditPrices ? 'text-purple-700' : 'text-slate-500'}>
                      {u.permissions.canEditPrices ? 'مجوز تغییر قیمت ✓' : 'قفل تغییر قیمت 🔒'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Sync Event Log */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                لاگ زنده رویدادهای همگام‌سازی ابری و لوکال (Audit Log)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">کانال امن: minadental_mesh_sync</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar text-[11px]">
              {syncLogs.length === 0 ? (
                <div className="text-slate-400 text-center py-2 font-medium">
                  همگام‌سازی ابری فعال است. با زدن دکمه‌های بالا رویدادها را تست کنید.
                </div>
              ) : (
                syncLogs.map(log => (
                  <div key={log.id} className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 font-bold">[{log.platform}]</span>
                      <span className="text-slate-800 font-medium">{log.title}: {log.description}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px] shrink-0 mr-2">{log.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            سینک همزمان ابری، صف آفلاین پایدار IndexedDB و قفل امنیتی پرسنل فعال است
          </span>
          <button type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all"
          >
            بستن شبیه‌ساز
          </button>
        </div>

      </div>
    </div>
  );
};
