import React, { useState } from 'react';
import { 
  X, Download, Copy, CheckCheck, FileArchive, 
  Smartphone, Apple, ShieldCheck, CheckCircle2
} from 'lucide-react';
import {
  downloadProjectArchive,
  downloadAndroidApk,
  downloadIosIpa,
  downloadIosMobileConfigProfile,
  getProjectArchiveUrl,
  getAndroidApkUrl,
  getIosIpaUrl,
  MINADENTAL_PACKAGE_VERSION
} from '../utils/downloader';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { copyTextSafely } from '../utils/clipboard';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface ProjectDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectDownloadModal: React.FC<ProjectDownloadModalProps> = ({
  isOpen,
  onClose
}) => {
  const { impactLight, impactHeavy, success, selection } = useHapticFeedback();
  const { isInstallable, isInstalled, install: triggerPwaInstall } = usePWAInstall();
  useEscapeKey(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<'native_packages' | 'source_zip'>('native_packages');
  const [downloadingPkg, setDownloadingPkg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const fullZipUrl = getProjectArchiveUrl();
  const apkUrl = getAndroidApkUrl();
  const ipaUrl = getIosIpaUrl();

  const handleCopyText = async (text: string, key: string) => {
    const ok = await copyTextSafely(text);
    if (ok) {
      setCopiedKey(key);
      impactLight();
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleDownloadApk = async () => {
    setDownloadingPkg('apk');
    setStatusMsg('در حال آماده‌سازی و دانلود فایل نصبی اندروید (MinaDental-v27.5.0.apk)...');
    impactHeavy();
    await downloadAndroidApk(
      () => {
        setDownloadingPkg(null);
        success();
        setStatusMsg('✅ فایل نصبی اندروید (MinaDental-v27.5.0.apk) با موفقیت در پوشه دانلودهای دستگاه ذخیره شد.');
      },
      (err) => {
        setDownloadingPkg(null);
        setStatusMsg(`خطا در دانلود APK: ${err.message}`);
      }
    );
  };

  const handleDownloadIpa = async () => {
    setDownloadingPkg('ipa');
    setStatusMsg('در حال آماده‌سازی و دانلود پکیج آیفون (MinaDental-v27.5.0.ipa)...');
    impactHeavy();
    await downloadIosIpa(
      () => {
        setDownloadingPkg(null);
        success();
        setStatusMsg('✅ فایل نصبی آیفون (MinaDental-v27.5.0.ipa) با موفقیت در پوشه دانلودها ذخیره شد.');
      },
      (err) => {
        setDownloadingPkg(null);
        setStatusMsg(`خطا در دانلود IPA: ${err.message}`);
      }
    );
  };

  const handleDownloadIosProfile = async () => {
    setDownloadingPkg('mobileconfig');
    setStatusMsg('در حال دریافت پروفایل نصب مستقیم آیفون (MinaDental-iOS27.mobileconfig)...');
    impactHeavy();
    await downloadIosMobileConfigProfile(
      () => {
        setDownloadingPkg(null);
        success();
        setStatusMsg('✅ پروفایل آیفون دانلود شد! در آیفون وارد Settings > Profile Downloaded شوید و Install را بزنید تا آیکون بنفش مینادنتال نصب شود.');
      },
      (err) => {
        setDownloadingPkg(null);
        setStatusMsg(`خطا در دریافت پروفایل iOS: ${err.message}`);
      }
    );
  };

  const handleDownloadZip = async () => {
    setDownloadingPkg('zip');
    setStatusMsg('در حال بارگیری بسته کامل سورس پروژه...');
    impactHeavy();
    await downloadProjectArchive(
      () => {
        setDownloadingPkg(null);
        success();
        setStatusMsg('✅ فایل minadental-source-full.zip با موفقیت دریافت شد.');
      },
      (err) => {
        setDownloadingPkg(null);
        setStatusMsg(`خطا: ${err.message}`);
      }
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="دانلود مستقیم فایل نصبی اندروید APK و آیفون IPA مینادنتال"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none"
    >
      <div className="w-full max-w-xl bg-white rounded-t-[28px] sm:rounded-[26px] border border-slate-200 p-4 sm:p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl text-slate-900 text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                سورس‌کد و بسته‌های نصبی مینادنتال (APK و IPA)
              </h3>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                مینادنتال نسخه {MINADENTAL_PACKAGE_VERSION} · شناسه بسته: <span className="font-mono">ir.minadental.app</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            aria-label="بستن پنجره دانلود"
            className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => { selection(); setActiveTab('native_packages'); }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'native_packages' ? 'bg-purple-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>دانلود مستقیم APK و IPA</span>
          </button>
          <button
            type="button"
            onClick={() => { selection(); setActiveTab('source_zip'); }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'source_zip' ? 'bg-white text-slate-950 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>سورس کامل و کامپایل (ZIP)</span>
          </button>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-black flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* TAB 1: DIRECT INSTALL (PWA + iOS PROFILE) & CAPACITOR PACKAGES */}
        {activeTab === 'native_packages' && (
          <div className="space-y-3.5 animate-in fade-in">
            
            {/* 1. ANDROID PWA & CAPACITOR APK BUNDLE SECTION */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 border border-emerald-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      نسخه اندروید (نصب مستقیم PWA + بسته Capacitor APK)
                    </h4>
                    <p className="text-[10.5px] text-emerald-800 font-bold">
                      نصب فوری PWA در Chrome/Samsung · بسته وب <span className="font-mono">MinaDental-v{MINADENTAL_PACKAGE_VERSION}.apk</span> (برای APK امضاشده بومی از سورس Capacitor در Android Studio بیلد بگیرید)
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-mono font-black">
                  PWA + APK Bundle
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    impactHeavy();
                    if (isInstallable) {
                      const ok = await triggerPwaInstall();
                      if (ok) {
                        setStatusMsg('✅ اپلیکیشن مینادنتال مستقیماً روی صفحه اصلی اندروید نصب شد!');
                      }
                    } else {
                      setStatusMsg('در مرورگر Chrome اندروید از منوی ⋮ گزینه «نصب اپلیکیشن / Add to Home Screen» را بزنید.');
                    }
                  }}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#c8ff00]" />
                  <span>
                    {isInstalled ? '✓ نصب شده روی دستگاه' : 'نصب مستقیم PWA روی اندروید'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadApk}
                  disabled={downloadingPkg === 'apk'}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloadingPkg === 'apk'
                      ? 'در حال دانلود...'
                      : `بسته Capacitor APK (${MINADENTAL_PACKAGE_VERSION})`}
                  </span>
                </button>
              </div>
            </div>

            {/* 2. IPHONE / IPAD MOBILECONFIG & IPA BUNDLE SECTION */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/90 via-white to-indigo-50/70 border border-purple-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                    <Apple className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      نسخه آیفون و آیپد (پروفایل نصب مستقیم + بسته Capacitor IPA)
                    </h4>
                    <p className="text-[10.5px] text-purple-800 font-bold">
                      نصب فوری تمام‌صفحه روی آیفون با <span className="font-mono">.mobileconfig</span> · برای IPA امضاشده بومی از Xcode و سورس Capacitor بیلد بگیرید
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 text-[10px] font-mono font-black">
                  iOS Profile + IPA
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadIosProfile}
                  disabled={downloadingPkg === 'mobileconfig'}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Apple className="w-4 h-4" />
                  <span>نصب مستقیم روی آیفون (.mobileconfig)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadIpa}
                  disabled={downloadingPkg === 'ipa'}
                  className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloadingPkg === 'ipa'
                      ? 'در حال دانلود...'
                      : `بسته Capacitor IPA (${MINADENTAL_PACKAGE_VERSION})`}
                  </span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-white/90 border border-purple-200/80 text-[10.5px] text-slate-700 space-y-1 font-bold leading-relaxed">
                <div>
                  🍏 <span className="text-purple-900 font-black">نصب فوری آیفون (آماده استفاده):</span> در Safari دکمه «نصب مستقیم روی آیفون» را بزنید و در Settings گزینه <span className="font-mono">Profile Downloaded &gt; Install</span> را تایید کنید (یا <span className="font-mono">Share &gt; Add to Home Screen</span>).
                </div>
                <div>
                  🛠️ <span className="text-purple-900 font-black">بیلد بومی امضاشده (APK / IPA):</span> از تب «سورس کامل (ZIP)» سورس پروژه را دانلود کرده و با Capacitor در Android Studio یا Xcode امضای رسمی بزنید.
                </div>
              </div>
            </div>

            {/* Direct URL Copy Links for Mobile Browsers */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
              <span className="font-black text-slate-800 block">لینک‌های مستقیم دانلود:</span>
              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200">
                <span className="font-mono text-[10.5px] text-slate-700 truncate" dir="ltr">{apkUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(apkUrl, 'apkUrl')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                >
                  {copiedKey === 'apkUrl' ? 'کپی شد ✓' : 'کپی لینک APK'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200">
                <span className="font-mono text-[10.5px] text-slate-700 truncate" dir="ltr">{ipaUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(ipaUrl, 'ipaUrl')}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                >
                  {copiedKey === 'ipaUrl' ? 'کپی شد ✓' : 'کپی لینک IPA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SOURCE CODE ZIP & CAPACITOR CLI */}
        {activeTab === 'source_zip' && (
          <div className="space-y-3.5 text-xs animate-in fade-in">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloadingPkg === 'zip'}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>دانلود کامل سورس پروژه (minadental-source-full.zip)</span>
            </button>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-black text-slate-700 block">لینک مستقیم سورس کامل:</span>
              <div className="flex items-center gap-2">
                <input
                  aria-label="لینک کامل و رسمی دانلود اینترنتی"
                  type="text"
                  readOnly
                  value={fullZipUrl}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-700 text-left focus:outline-none select-all"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText(fullZipUrl, 'zipUrl')}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'zipUrl' ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی لینک</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
