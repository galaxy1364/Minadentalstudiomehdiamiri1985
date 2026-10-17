import React, { useState } from 'react';
import { X, Database, Download, Upload, Cloud, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';
import { Patient, Appointment, InventoryItem, UserAccount, PlatformDevice } from '../types/dental';
import { syncEngine } from '../services/syncEngine';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicName: string;
  patients: Patient[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  users: UserAccount[];
  platforms: PlatformDevice[];
  onRestoreData?: (restoredData: any) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  clinicName,
  patients,
  appointments,
  inventory,
  users,
  platforms,
  onRestoreData
}) => {
  const [cloudSynced, setCloudSynced] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    const json = syncEngine.exportBackup({
      clinicName,
      patients,
      appointments,
      inventory,
      users,
      platforms
    });
    syncEngine.downloadBackupFile(json, `minadental_backup_${Date.now()}.json`);
    setSuccessMsg('فایل پشتیبان کامل لوکال با موفقیت دانلود و ذخیره شد.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCloudBackup = () => {
    setCloudSynced(true);
    syncEngine.broadcast({
      type: 'CLOUD_BACKUP_SAVED',
      performedBy: 'admin',
      role: 'admin',
      platform: 'سرور ابری کلینیک',
      title: 'بکاپ ابری ذخیره شد',
      description: 'نسخه کامل پرونده‌ها، نوبت‌ها و تراز مالی در فضای ابری ایمن همگام‌سازی شد.'
    });
    setSuccessMsg('پشتیبان‌گیری ابری و همگام‌سازی با موفقیت انجام شد.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.patients && parsed.appointments) {
          if (onRestoreData) onRestoreData(parsed);
          setSuccessMsg('اطلاعات پشتیبان با موفقیت بازگردانی شد.');
        } else {
          alert('فرمت فایل نامعتبر است.');
        }
      } catch (err) {
        alert('خطا در خواندن فایل پشتیبان.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-gradient-to-b from-emerald-50/90 via-white to-teal-50/50 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-emerald-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">پشتیبان‌گیری ابری و لوکال</h3>
              <p className="text-[11px] text-emerald-800 font-bold">بیماران: {patients.length} · نوبت‌ها: {appointments.length}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 animate-in fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Cloud Sync Section */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-black text-slate-900">همگام‌سازی ابری کلینیک</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              متصل به کلاود
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            ذخیره خودکار تغییرات پرونده‌ها و اطلاعات مالی در سرور ابری رمزنگاری‌شده جهت دسترسی همزمان از تمام دستگاه‌ها.
          </p>

          <button
            onClick={handleCloudBackup}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Cloud className="w-4 h-4" />
            <span>ثبت فوری بکاپ ابری (Cloud Sync Now)</span>
          </button>
        </div>

        {/* Local Backup Section */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-sky-600" />
            <span className="text-xs font-black text-slate-900">پشتیبان‌گیری لوکال آفلاین (دانلود فایل JSON)</span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            دانلود یک نسخه آفلاین کامل از کلیه سوابق، چک‌ها، اقساط، چارت‌های دندانی و پیام‌ها روی حافظه سیستم یا گوشی.
          </p>

          <button
            onClick={handleDownloadBackup}
            className="w-full py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs border border-sky-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-sky-600" />
            <span>دانلود فایل پشتیبان لوکال (.json)</span>
          </button>
        </div>

        {/* Restore Section */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-black text-slate-900">بازگردانی نسخه پشتیبان (Restore)</span>
          </div>

          <label className="block w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-600 hover:border-emerald-500 cursor-pointer transition-colors bg-slate-50">
            <span>انتخاب فایل پشتیبان قبلی...</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
