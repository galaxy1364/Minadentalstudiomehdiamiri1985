import React, { useState, useEffect } from 'react';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../types/dental';
import { triggerHaptic } from '../utils/haptics';

interface ClinicSessionLockOverlayProps {
  isLocked: boolean;
  users: UserAccount[];
  onUnlock: (emailOrUsername: string, password: string) => { ok: boolean; error?: string };
}

const ROLE_LABELS_FA: Record<UserAccount['role'], string> = {
  admin: 'مدیر و پزشک',
  doctor: 'پزشک',
  secretary: 'منشی',
  accountant: 'حسابدار',
  assistant: 'دستیار',
  lab_tech: 'لابراتوار'
};

export const ClinicSessionLockOverlay: React.FC<ClinicSessionLockOverlayProps> = ({
  isLocked,
  users,
  onUnlock
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLocked) {
      setPassword('');
      setShowPass(false);
      setError(null);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedId = identifier.trim();
    if (!trimmedId) {
      triggerHaptic('warning');
      setError('لطفاً ایمیل یا نام کاربری پرسنل را وارد نمایید.');
      return;
    }
    if (!password.trim()) {
      triggerHaptic('warning');
      setError('لطفاً کلمه عبور حساب کاربری خود را وارد نمایید.');
      return;
    }
    const res = onUnlock(trimmedId, password);
    if (!res.ok) {
      triggerHaptic('warning');
      setError(res.error || 'خطا در احراز هویت');
    } else {
      triggerHaptic('success');
      setPassword('');
    }
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="قفل امنیتی پنل کلینیک مینادنتال"
      className="fixed inset-0 z-[200] bg-purple-950/70 backdrop-blur-xl flex items-center justify-center p-4 select-none animate-in fade-in"
    >
      <div className="w-full max-w-sm bg-white rounded-[28px] border border-purple-200 shadow-2xl p-5 space-y-4 text-right">
        <div className="flex flex-col items-center text-center space-y-2 pb-2 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-emerald-600 text-white flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black text-slate-900">پنل کلینیک مینادنتال قفل است</h2>
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
            برای دسترسی مجدد به پرونده بیماران و صندوق، ایمیل یا نام کاربری و کلمه عبور خود را وارد کنید.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>ایمیل یا نام کاربری</span>
            </label>
            <input
              type="text"
              aria-label="ایمیل یا نام کاربری"
              autoComplete="username"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              placeholder="mehdi.amiri19851364@gmail.com"
              dir="ltr"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>کلمه عبور</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                aria-label="کلمه عبور"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••••"
                dir="ltr"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-9 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                className="absolute left-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-l from-purple-600 to-emerald-600 hover:brightness-105 text-white font-black text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>احراز هویت و بازگشایی پنل</span>
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 block">انتخاب سریع شناسه پرسنل:</span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setIdentifier(u.email || u.username);
                  setPassword('');
                  setError(null);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                  identifier === (u.email || u.username)
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-slate-100 hover:bg-purple-50 text-slate-700 border-slate-200'
                }`}
              >
                {u.role === 'admin' ? '🔐 ' : ''}{u.fullName.split('(')[0].trim()} · {ROLE_LABELS_FA[u.role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
