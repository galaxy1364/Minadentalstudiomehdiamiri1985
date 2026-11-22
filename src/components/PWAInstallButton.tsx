import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { ViewportModalPortal } from './ViewportModalPortal';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { impactLight, success } = useHapticFeedback();

  useEscapeKey(showIOSGuide, () => setShowIOSGuide(false));

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          impactLight();
          const accepted = await install();
          if (accepted) success();
        }}
        className={
          compact
            ? 'min-h-[38px] px-2 sm:px-2.5 rounded-xl bg-gradient-to-l from-violet-600 to-purple-700 hover:brightness-105 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer'
            : 'flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 to-purple-700 px-4 py-2.5 text-xs font-black text-white shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer'
        }
        title="نصب مستقیم اپلیکیشن مینادنتال (PWA / APK)"
        aria-label="نصب اپلیکیشن مینادنتال"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden md:inline' : ''}>نصب برنامه</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            impactLight();
            setShowIOSGuide(true);
          }}
          className={
            compact
              ? 'min-h-[38px] px-2 sm:px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-[11px] font-black flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer'
              : 'flex items-center justify-center gap-2 rounded-2xl border border-purple-300 bg-purple-50 px-3.5 py-2 text-xs font-black text-purple-900 hover:bg-purple-100 active:scale-95 transition-all cursor-pointer'
          }
          title="راهنمای نصب مینادنتال روی آیفون و آیپد (iOS 27)"
          aria-label="نصب روی آیفون"
        >
          <Smartphone className="w-3.5 h-3.5 text-purple-700 shrink-0" />
          <span className={compact ? 'hidden md:inline' : ''}>نصب iOS</span>
        </button>

        {showIOSGuide && (
          <ViewportModalPortal isOpen={showIOSGuide}>
            <div
              dir="rtl"
              role="dialog"
              aria-modal="true"
              aria-label="راهنمای نصب مینادنتال روی آیفون و آیپد"
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4"
              onClick={() => setShowIOSGuide(false)}
            >
              <div
                className="w-full max-w-sm rounded-[26px] bg-white border border-purple-200 p-5 shadow-2xl space-y-4 text-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-950">نصب مینادنتال روی آیفون / آیپد</h3>
                      <span className="text-[10.5px] font-bold text-purple-700">سازگار با iOS 27 Safari و آپدیت خودکار OTA</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    aria-label="بستن راهنمای نصب آیفون"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ol className="space-y-2.5 text-xs text-slate-700 leading-[1.6]">
                  <li className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <Share className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <span>
                      ۱. در پایین مرورگر <strong>Safari</strong> آیفون، دکمه اشتراک‌گذاری (<strong>Share</strong>) را لمس کنید.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <PlusSquare className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      ۲. صفحه را به پایین اسکرول کرده و گزینه <strong>Add to Home Screen</strong> را بزنید.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-emerald-950 font-bold">
                      ۳. آیکون اختصاصی بنفش «مینادنتال» روی صفحه اصلی اضافه شده و به‌صورت تمام‌صفحه اجرا می‌شود.
                    </span>
                  </li>
                </ol>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer active:scale-95 transition-all"
                >
                  متوجه شدم
                </button>
              </div>
            </div>
          </ViewportModalPortal>
        )}
      </>
    );
  }

  return null;
};
