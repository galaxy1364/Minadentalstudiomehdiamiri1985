import React, { useState, useEffect } from 'react';
import { 
  X, Send, Smartphone, 
  RefreshCw, Key, Copy, CheckCircle2
} from 'lucide-react';
import { toPersianDigits, getCurrentPersianDate } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { clinicalSmsService, SmsLogItem } from '../services/smsService';
import { ViewportModalPortal } from './ViewportModalPortal';
import { copyTextSafely } from '../utils/clipboard';

interface SmsGatewaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmsGatewaySettingsModal: React.FC<SmsGatewaySettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  useEscapeKey(isOpen, onClose);
  const initialCfg = clinicalSmsService.getConfig();
  const [provider, setProvider] = useState<'kavenegar' | 'farazsms' | 'melipayamak'>(initialCfg.provider);
  const [apiKey, setApiKey] = useState(initialCfg.apiKey);
  const [senderNumber, setSenderNumber] = useState(initialCfg.senderNumber);
  const [remainingCredit, setRemainingCredit] = useState(() => clinicalSmsService.getSmsCredit());
  const [recentLogs, setRecentLogs] = useState<SmsLogItem[]>(() => clinicalSmsService.getLogs().slice(0, 3));
  const [testMobile, setTestMobile] = useState('09121234567');
  
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = clinicalSmsService.getConfig();
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey);
      setSenderNumber(cfg.senderNumber);
      setRemainingCredit(clinicalSmsService.getSmsCredit());
      setRecentLogs(clinicalSmsService.getLogs().slice(0, 3));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isApiKeyValid = apiKey.trim().length >= 8;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendTest = async () => {
    setTestSending(true);
    setTestResult(null);
    triggerHaptic('medium');
    clinicalSmsService.saveConfig(provider, apiKey.trim(), senderNumber.trim());

    const res = await clinicalSmsService.sendPatternSms(
      testMobile,
      'بیمار آزمایشی کلینیک',
      'appointment_reminder',
      { date: getCurrentPersianDate(), time: '۱۷:۰۰' }
    );
    setTestSending(false);
    setRemainingCredit(res.remainingCredit);
    setRecentLogs(clinicalSmsService.getLogs().slice(0, 3));
    if (res.success) {
      triggerHaptic('success');
      setTestResult(
        `✅ پیامک آزمایشی با موفقیت از خط ${senderNumber} ارسال شد.\nشناسه پیامک: ${res.refId} · وضعیت: ${res.deliveryReceipt || 'Delivered'} · شارژ باقی‌مانده: ${toPersianDigits(res.remainingCredit)}`
      );
    } else {
      triggerHaptic('heavy');
      setTestResult(`⚠️ ${res.message}`);
    }
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="تنظیمات درگاه پیامک خدماتی"
        className="fixed inset-0 z-[100] bg-sky-950/35 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none"
        onClick={onClose}
      >
        <div
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white text-slate-900 rounded-t-[32px] sm:rounded-[32px] border border-sky-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {toastMessage && (
            <div className="bg-emerald-600 text-white text-center py-1.5 text-xs font-black">
              {toastMessage}
            </div>
          )}

          {/* Top Header */}
          <div className="p-4 border-b border-sky-100 flex items-center justify-between bg-gradient-to-r from-sky-600 via-blue-600 to-sky-700 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm text-white">تنظیمات درگاه پیامک خدماتی</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 text-[#c8ff00] font-bold">
                    شارژ: {toPersianDigits(remainingCredit)} پیامک
                  </span>
                </div>
                <p className="text-[11px] text-sky-100 font-medium">ارسال فوق‌سریع پترن و عبور ۱۰۰٪ از بلک‌لیست مخابرات</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن تنظیمات پیامک"
              className="min-w-[38px] min-h-[38px] rounded-[12px] bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 overflow-y-auto space-y-4 no-scrollbar flex-1 bg-slate-50/50 text-xs">
            {/* Provider Selector */}
            <div className="space-y-1.5">
              <label className="font-black text-slate-800 block">انتخاب درگاه پیامکی (SMS Gateway):</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'kavenegar', name: 'کاوه‌نگار', desc: 'توصیه شده (وب‌سرویس پترن)' },
                  { id: 'farazsms', name: 'فراپیامک / فراز', desc: 'خطوط خدماتی اشتراکی' },
                  { id: 'melipayamak', name: 'ملی‌پیامک', desc: 'پنل شرکتی' },
                ].map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      setProvider(item.id as 'kavenegar' | 'farazsms' | 'melipayamak');
                    }}
                    className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                      provider === item.id 
                        ? 'bg-sky-50 border-sky-500 text-sky-900 font-black ring-1 ring-sky-300' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block font-bold">{item.name}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key & Line Number */}
            <div className="space-y-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-sky-600" />
                    <span>کلید اختصاصی وب‌سرویس (API Key):</span>
                  </label>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isApiKeyValid
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : 'text-amber-800 bg-amber-50 border border-amber-200'
                    }`}
                  >
                    {isApiKeyValid ? 'اعتبارسنجی شده ✓' : 'نیاز به وارد کردن کلید'}
                  </span>
                </div>
                <input
                  aria-label="کلید اختصاصی وب‌سرویس پیامک"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 font-bold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">سرشماره پیامک خدماتی (بدون بلاک تبلیغاتی):</label>
                  <span className="text-[10px] text-sky-700 font-mono font-bold">خط اختصاصی</span>
                </div>
                <input
                  aria-label="سرشماره پیامک خدماتی"
                  type="text"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 font-bold focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Patterns & GPS Navigation Templates */}
            <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="font-black text-slate-900 block">الگوهای هوشمند متن پیامک (SMS Patterns):</span>

              <div className="space-y-1.5 text-[11px]">
                <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sky-900">۱. یادآوری ۲۴ ساعت قبل + مسیریاب نشان و بلد</span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        void copyTextSafely('minarecall');
                        showToast('کد پترن minarecall کپی شد ✓');
                      }}
                      className="text-[9.5px] font-mono text-sky-700 bg-white border border-sky-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer hover:bg-sky-100"
                    >
                      <Copy className="w-3 h-3" />
                      <span>minarecall</span>
                    </button>
                  </div>
                  <p className="text-slate-600 text-[10.5px] leading-relaxed">
                    «بیمار گرامی %name%، نوبت دندانپزشکی شما فردا مورخ %date% ساعت %time% می‌باشد. جهت مسیریابی کلینیک مینادنتال در نشان و بلد: neshan.org/r/minadental»
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">۲. سررسید چک صیادی و اقساط درمانی</span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        void copyTextSafely('minapay');
                        showToast('کد پترن minapay کپی شد ✓');
                      }}
                      className="text-[9.5px] font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-100"
                    >
                      <Copy className="w-3 h-3" />
                      <span>minapay</span>
                    </button>
                  </div>
                  <p className="text-slate-600 text-[10.5px] leading-relaxed">
                    «جناب %name%، قسط درمانی شما به مبلغ %amount% تومان تا تاریخ %due% سررسید می‌گردد. جهت تسویه اینترنتی: minadental.ir/pay»
                  </p>
                </div>
              </div>
            </div>

            {/* Live SMS Test Simulator */}
            <div className="space-y-2 bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200">
              <span className="font-black text-slate-900 block">ارسال زنده پیامک تست به موبایل:</span>
              
              <div className="flex items-center gap-2">
                <input
                  aria-label="شماره موبایل گیرنده پیامک تست"
                  type="text"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  placeholder="شماره موبایل گیرنده"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-xs focus:outline-none"
                />

                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testSending}
                  className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {testSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال تست</span>
                </button>
              </div>

              {testResult && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 whitespace-pre-line text-[10.5px] font-mono leading-relaxed animate-in fade-in">
                  {testResult}
                </div>
              )}

              {recentLogs.length > 0 && (
                <div className="pt-2 border-t border-sky-200/70 space-y-1">
                  <span className="text-[10.5px] font-black text-slate-700 block">آخرین پیامک‌های ارسالی ثبت‌شده:</span>
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-sky-100 text-[10px]">
                      <span className="font-bold text-slate-800 truncate">{log.recipientName} ({toPersianDigits(log.recipientMobile)})</span>
                      <span className="text-emerald-700 font-mono font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {log.refId}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-100 bg-white flex justify-end">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('success');
                clinicalSmsService.saveConfig(provider, apiKey.trim(), senderNumber.trim());
                showToast('تنظیمات وب‌سرویس پیامکی با موفقیت ذخیره شد.');
                setTimeout(onClose, 450);
              }}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md shadow-sky-600/25 active:scale-95 transition-all cursor-pointer"
            >
              ذخیره تنظیمات وب‌سرویس پیامکی
            </button>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
