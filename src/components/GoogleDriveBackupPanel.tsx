import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CloudUpload,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Trash2,
  LogOut,
  Clock,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';
import {
  GoogleDriveAuthSnapshot,
  GoogleDriveBackupFile,
  GoogleDriveScheduleConfig,
  deleteGoogleDriveBackupFile,
  downloadAndValidateDriveBackup,
  getGoogleDriveAuthSnapshot,
  getGoogleDriveSchedule,
  listGoogleDriveBackups,
  signInWithGoogleForDrive,
  signOutGoogleDrive,
  subscribeGoogleDriveAuth,
  subscribeGoogleDriveSchedule,
  updateGoogleDriveSchedule,
  uploadBackupToGoogleDrive,
} from '../services/googleDriveBackupService';
import { toPersianDigits } from '../utils/jalali';

interface GoogleDriveBackupPanelProps {
  buildBackupJson: () => string;
  isManager: boolean;
  onRestoreBackupData?: (restoredData: {
    patients?: any[];
    appointments?: any[];
    inventory?: any[];
  }) => void;
  onNotify?: (message: string) => void;
  compact?: boolean;
}

type PendingAction =
  | { type: 'restore'; file: GoogleDriveBackupFile }
  | { type: 'delete'; file: GoogleDriveBackupFile }
  | null;

export const GoogleDriveBackupPanel: React.FC<GoogleDriveBackupPanelProps> = ({
  buildBackupJson,
  isManager,
  onRestoreBackupData,
  onNotify,
  compact = false,
}) => {
  const [authState, setAuthState] = useState<GoogleDriveAuthSnapshot>(() =>
    getGoogleDriveAuthSnapshot()
  );
  const [schedule, setSchedule] = useState<GoogleDriveScheduleConfig>(() =>
    getGoogleDriveSchedule()
  );
  const [driveFiles, setDriveFiles] = useState<GoogleDriveBackupFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const showFeedback = useCallback(
    (tone: 'success' | 'error' | 'info', text: string) => {
      setStatusMessage({ tone, text });
      onNotify?.(text);
    },
    [onNotify]
  );

  useEffect(() => {
    const unsubAuth = subscribeGoogleDriveAuth(setAuthState);
    const unsubSchedule = subscribeGoogleDriveSchedule(setSchedule);
    return () => {
      unsubAuth();
      unsubSchedule();
    };
  }, []);

  const refreshDriveFiles = useCallback(async () => {
    if (!getGoogleDriveAuthSnapshot().hasAccessToken) {
      setDriveFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const files = await listGoogleDriveBackups();
      setDriveFiles(files);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED' || err?.message === 'AUTH_EXPIRED') {
        setDriveFiles([]);
        showFeedback('info', 'نشست گوگل درایو منقضی شده است. لطفاً مجدداً با گوگل وارد شوید.');
      } else {
        showFeedback('error', err?.message || 'خطا در دریافت لیست بکاپ‌های گوگل درایو.');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  }, [showFeedback]);

  useEffect(() => {
    if (authState.hasAccessToken) {
      void refreshDriveFiles();
    } else {
      setDriveFiles([]);
    }
  }, [authState.hasAccessToken, refreshDriveFiles]);

  const handleGoogleSignIn = async () => {
    setStatusMessage(null);
    try {
      const result = await signInWithGoogleForDrive();
      showFeedback(
        'success',
        `حساب گوگل (${result.user.email || 'متصل'}) برای بکاپ خودکار گوگل درایو فعال شد.`
      );
      await refreshDriveFiles();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        showFeedback('info', 'پنجره ورود گوگل بسته شد.');
      } else {
        showFeedback('error', err?.message || 'ورود با گوگل ناموفق بود.');
      }
    }
  };

  const handleUploadNow = async () => {
    setIsUploading(true);
    setStatusMessage(null);
    try {
      const json = buildBackupJson();
      const uploaded = await uploadBackupToGoogleDrive(json, { tag: 'manual' });
      setDriveFiles((prev) => [uploaded, ...prev.filter((f) => f.id !== uploaded.id)]);
      showFeedback('success', `فایل پشتیبان «${uploaded.name}» در پوشه MinaDental Backups گوگل درایو ذخیره شد.`);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED' || err?.message === 'AUTH_EXPIRED') {
        showFeedback('info', 'برای ذخیره در گوگل درایو ابتدا با حساب گوگل وارد شوید.');
      } else {
        showFeedback('error', err?.message || 'خطا در ارسال نسخه پشتیبان به گوگل درایو.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsProcessingAction(true);
    try {
      if (pendingAction.type === 'delete') {
        await deleteGoogleDriveBackupFile(pendingAction.file.id);
        setDriveFiles((prev) => prev.filter((f) => f.id !== pendingAction.file.id));
        showFeedback('success', `فایل «${pendingAction.file.name}» از گوگل درایو حذف شد.`);
      } else if (pendingAction.type === 'restore') {
        if (!isManager) {
          showFeedback('error', 'بازیابی نسخه پشتیبان فقط با دسترسی مدیر کلینیک مجاز است.');
          return;
        }
        const validated = await downloadAndValidateDriveBackup(pendingAction.file.id);
        if (!validated.ok) {
          showFeedback('error', validated.error);
          return;
        }
        onRestoreBackupData?.({
          patients: validated.data.patients,
          appointments: validated.data.appointments,
          inventory: validated.data.inventory,
        });
        showFeedback(
          'success',
          `اطلاعات کلینیک از فایل گوگل درایو «${pendingAction.file.name}» با موفقیت بازیابی شد.`
        );
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'اجرای عملیات روی گوگل درایو با خطا مواجه شد.');
    } finally {
      setIsProcessingAction(false);
      setPendingAction(null);
    }
  };

  const formatFileTime = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatFileSize = (bytes: number) => {
    const kb = Math.max(1, Math.round((Number(bytes) || 0) / 1024));
    return `${toPersianDigits(kb)} KB`;
  };

  return (
    <div
      data-testid="google-drive-backup-panel"
      className={`rounded-[20px] bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/70 border-2 border-sky-200/90 ${
        compact ? 'p-3.5 space-y-2.5' : 'p-4 space-y-3'
      } shadow-2xs`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-sky-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black text-slate-900 block truncate">
              بک‌آپ خودکار واقعی گوگل درایو (Google Drive)
            </span>
            <span className="text-[10px] font-bold text-sky-800 block truncate">
              {authState.hasAccessToken && authState.email
                ? `متصل به: ${authState.email}`
                : schedule.lastConnectedEmail
                ? `آخرین حساب متصل: ${schedule.lastConnectedEmail}`
                : 'ذخیره مستقیم در پوشه MinaDental Backups گوگل درایو شما'}
            </span>
          </div>
        </div>

        {authState.hasAccessToken ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              متصل
            </span>
            <button
              type="button"
              onClick={() => void signOutGoogleDrive()}
              aria-label="قطع اتصال گوگل درایو"
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>خروج</span>
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            نیازمند ورود گوگل
          </span>
        )}
      </div>

      {statusMessage && (
        <div
          className={`p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-2 ${
            statusMessage.tone === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : statusMessage.tone === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-sky-50 text-sky-900 border border-sky-200'
          }`}
        >
          {statusMessage.tone === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Official Sign in with Google button when authentication is needed */}
      {authState.needsAuth ? (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
            برای ذخیره خودکار و بازیابی نسخه‌های پشتیبان کلینیک در گوگل درایو شخصی خود، با حساب گوگل وارد شوید.
          </p>
          <button
            type="button"
            disabled={authState.isSigningIn}
            onClick={() => void handleGoogleSignIn()}
            className="w-full h-11 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.99] text-[#1f1f1f] border border-[#747775] shadow-2xs font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-4.5 h-4.5 shrink-0 block"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span>
              {authState.isSigningIn
                ? 'در حال اتصال به گوگل...'
                : 'Sign in with Google · ورود با گوگل درایو'}
            </span>
          </button>
        </div>
      ) : (
        <>
          {/* Auto-backup scheduler controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px]">
            <button
              type="button"
              onClick={() =>
                updateGoogleDriveSchedule({ enabled: !schedule.enabled })
              }
              className={`p-2.5 rounded-xl border text-right flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                schedule.enabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span className="font-black">بک‌آپ خودکار روزانه</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-current">
                {schedule.enabled ? 'فعال ✓' : 'خاموش'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                updateGoogleDriveSchedule({ backupOnChange: !schedule.backupOnChange })
              }
              className={`p-2.5 rounded-xl border text-right flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                schedule.backupOnChange
                  ? 'bg-sky-50 border-sky-300 text-sky-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span className="font-black">بک‌آپ خودکار با تغییرات</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-current">
                {schedule.backupOnChange ? 'فعال ✓' : 'خاموش'}
              </span>
            </button>

            <div className="p-2 rounded-xl bg-white border border-sky-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>ساعت اجرا:</span>
              </div>
              <input
                type="time"
                aria-label="ساعت بک‌آپ خودکار گوگل درایو"
                value={schedule.dailyTime}
                onChange={(e) =>
                  updateGoogleDriveSchedule({ dailyTime: e.target.value || '22:30' })
                }
                className="bg-sky-50 border border-sky-200 rounded-lg px-2 py-0.5 font-mono font-black text-sky-950 text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => void handleUploadNow()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <CloudUpload className={`w-4 h-4 ${isUploading ? 'animate-pulse' : ''}`} />
              <span>{isUploading ? 'در حال آپلود به گوگل درایو...' : 'آپلود فوری بکاپ به گوگل درایو'}</span>
            </button>

            <button
              type="button"
              disabled={isLoadingFiles}
              onClick={() => void refreshDriveFiles()}
              aria-label="بروزرسانی لیست فایل‌های گوگل درایو"
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              <span>بروزرسانی</span>
            </button>
          </div>

          {schedule.lastBackupAt && (
            <div className="text-[10px] font-bold text-slate-600 flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1.5 rounded-xl border border-sky-100">
              <span className="truncate">
                آخرین بکاپ ثبت‌شده: <span className="font-mono text-sky-900">{schedule.lastBackupFileName || '—'}</span>
              </span>
              <span className="shrink-0 text-emerald-700">{formatFileTime(schedule.lastBackupAt)}</span>
            </div>
          )}

          {/* Real Google Drive backup file list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-black text-slate-800">
              <span>نسخه‌های ذخیره شده در گوگل درایو ({toPersianDigits(driveFiles.length)})</span>
              <Cloud className="w-3.5 h-3.5 text-sky-600" />
            </div>

            {isLoadingFiles && driveFiles.length === 0 ? (
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-center text-[11px] font-bold text-slate-500">
                در حال دریافت فایل‌های پشتیبان از گوگل درایو...
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-3 rounded-xl bg-white border border-dashed border-sky-200 text-center text-[11px] font-medium text-slate-500">
                هنوز نسخه‌ای در پوشه MinaDental Backups ذخیره نشده است. روی «آپلود فوری بکاپ» کلیک کنید.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white rounded-xl p-2 border border-sky-100 flex items-center justify-between gap-2 text-[10.5px]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-slate-900 block truncate" dir="ltr">
                        {file.name}
                      </span>
                      <span className="text-[9.5px] text-slate-500 block">
                        {formatFileTime(file.modifiedTime)} · {formatFileSize(file.size)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isManager && onRestoreBackupData && (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ type: 'restore', file })}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>بازیابی</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingAction({ type: 'delete', file })}
                        aria-label={`حذف فایل ${file.name} از گوگل درایو`}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mandatory Explicit Confirmation Dialog for Mutating/Destructive Google Drive Actions */}
      {pendingAction && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="تایید عملیات گوگل درایو"
          className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2.5 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-amber-950 font-bold">
              {pendingAction.type === 'delete' ? (
                <>
                  آیا از حذف دائمی فایل پشتیبان{' '}
                  <span className="font-mono underline" dir="ltr">
                    {pendingAction.file.name}
                  </span>{' '}
                  از گوگل درایو مطمئن هستید؟ این عملیات قابل بازگشت نیست.
                </>
              ) : (
                <>
                  آیا مایلید کل اطلاعات فعلی کلینیک با فایل پشتیبان{' '}
                  <span className="font-mono underline" dir="ltr">
                    {pendingAction.file.name}
                  </span>{' '}
                  از گوگل درایو جایگزین و بازیابی شود؟
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isProcessingAction}
              onClick={() => setPendingAction(null)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={isProcessingAction}
              onClick={() => void handleConfirmPendingAction()}
              className={`px-3 py-1.5 rounded-xl text-white text-[11px] font-black cursor-pointer disabled:opacity-60 ${
                pendingAction.type === 'delete'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isProcessingAction
                ? 'در حال اجرا...'
                : pendingAction.type === 'delete'
                ? 'تایید حذف از گوگل درایو'
                : 'تایید بازیابی اطلاعات'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
