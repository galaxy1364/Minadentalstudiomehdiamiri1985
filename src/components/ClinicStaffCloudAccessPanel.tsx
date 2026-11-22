import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Lock,
  Trash2,
  RefreshCw,
  Crown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  clinicRealtimeClient,
  type CloudClinicMember,
  type CloudClinicMembersResponse,
  type CloudMemberRole,
} from '../services/clinicRealtimeClient';
import {
  subscribeGoogleDriveAuth,
  type GoogleDriveAuthSnapshot,
} from '../services/googleDriveBackupService';
import { triggerHaptic } from '../utils/haptics';

interface ClinicStaffCloudAccessPanelProps {
  onNotify: (msg: string) => void;
}

const ROLE_LABELS: Record<CloudMemberRole, string> = {
  manager: 'مدیر کلینیک (دسترسی کامل)',
  doctor: 'پزشک معالج',
  secretary: 'منشی پذیرش (قفل قیمت)',
  assistant: 'دستیار دندانپزشک (قفل قیمت)',
};

const ROLE_BADGE_CLASSES: Record<CloudMemberRole, string> = {
  manager: 'bg-purple-100 text-purple-800 border-purple-200',
  doctor: 'bg-sky-100 text-sky-800 border-sky-200',
  secretary: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  assistant: 'bg-amber-100 text-amber-800 border-amber-200',
};

export const ClinicStaffCloudAccessPanel: React.FC<ClinicStaffCloudAccessPanelProps> = ({
  onNotify,
}) => {
  const [auth, setAuth] = useState<GoogleDriveAuthSnapshot>({
    user: null,
    email: null,
    displayName: null,
    photoURL: null,
    hasAccessToken: false,
    needsAuth: true,
    isSigningIn: false,
  });
  const isSignedIn = Boolean(auth.user);
  const [data, setData] = useState<CloudClinicMembersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<CloudMemberRole>('secretary');
  const [canEditPrices, setCanEditPrices] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CloudClinicMember | null>(null);

  useEffect(() => {
    return subscribeGoogleDriveAuth(setAuth);
  }, []);

  const loadMembers = useCallback(async () => {
    if (!isSignedIn) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await clinicRealtimeClient.listCloudClinicMembers();
      if (res) {
        setData(res);
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleRoleSelect = (nextRole: CloudMemberRole) => {
    setRole(nextRole);
    setCanEditPrices(nextRole === 'manager');
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      onNotify('⚠️ لطفاً ایمیل جیمیل معتبر پرسنل را وارد کنید.');
      return;
    }
    if (!trimmedName) {
      onNotify('⚠️ لطفاً نام و سمت پرسنل را وارد کنید.');
      return;
    }

    setSaving(true);
    triggerHaptic('light');
    try {
      const res = await clinicRealtimeClient.upsertCloudClinicMember({
        email: trimmedEmail,
        displayName: trimmedName,
        role,
        canEditPrices: role === 'manager' ? true : canEditPrices,
      });
      if (!res.ok) {
        triggerHaptic('error');
        onNotify(res.error || 'خطا در ثبت دسترسی پرسنل.');
        return;
      }
      triggerHaptic('success');
      setEmail('');
      setDisplayName('');
      setRole('secretary');
      setCanEditPrices(false);
      onNotify(`✅ دسترسی همگام‌سازی مشترک برای «${trimmedName}» ثبت شد.`);
      await loadMembers();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setSaving(true);
    try {
      const res = await clinicRealtimeClient.removeCloudClinicMember(target.id);
      if (!res.ok) {
        triggerHaptic('error');
        onNotify(res.error || 'حذف دسترسی ناموفق بود.');
        return;
      }
      triggerHaptic('success');
      onNotify(`🗑️ دسترسی «${target.displayName || target.email}» لغو شد.`);
      await loadMembers();
    } finally {
      setSaving(false);
    }
  };

  const isManager = Boolean(data?.currentUserAccess?.isManager);

  return (
    <div
      dir="rtl"
      className="bg-gradient-to-br from-indigo-500/10 via-white to-violet-500/5 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-indigo-200/90 space-y-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-700 shrink-0" />
          <div>
            <span className="text-xs font-black text-slate-900 block">
              همگام‌سازی چندکاربره پرسنل کلینیک (دسترسی ایمیل و قفل قیمت)
            </span>
            <span className="text-[10px] font-medium text-slate-600">
              پزشک، منشی و دستیار با ایمیل گوگل خود به کلینیک مشترک متصل می‌شوند
            </span>
          </div>
        </div>
        {isSignedIn && (
          <button
            type="button"
            onClick={() => void loadMembers()}
            disabled={loading}
            className="p-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer transition-colors"
            title="بروزرسانی لیست اعضا"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {!isSignedIn ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-700 leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            برای تعریف جیمیل منشی، پزشکان و دستیاران جهت اشتراک زنده پرونده‌ها و اعمال قفل قیمت سمت سرور، ابتدا از کادر بالا با حساب گوگل مدیر کلینیک وارد شوید.
          </span>
        </div>
      ) : (
        <>
          {data?.currentUserAccess && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>حساب فعلی: {data.currentUserAccess.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${ROLE_BADGE_CLASSES[data.currentUserAccess.role]}`}
                >
                  {ROLE_LABELS[data.currentUserAccess.role]}
                </span>
                {!data.currentUserAccess.canEditPrices && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                    <Lock className="w-2.5 h-2.5" />
                    قفل قیمت فعال
                  </span>
                )}
              </div>
            </div>
          )}

          {isManager && (
            <form onSubmit={handleInviteSubmit} className="space-y-2.5 rounded-2xl bg-white/90 border border-indigo-100 p-3">
              <div className="text-[11px] font-black text-indigo-900 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                <span>افزودن یا ویرایش دسترسی پرسنل کلینیک</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  aria-label="نام و سمت پرسنل"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="نام پرسنل (مثلاً خانم رضایی - منشی)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="email"
                  dir="ltr"
                  aria-label="ایمیل گوگل پرسنل"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff.email@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60 text-xs font-bold text-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <select
                  aria-label="نقش پرسنل کلینیک"
                  title="نقش پرسنل کلینیک"
                  value={role}
                  onChange={(e) => handleRoleSelect(e.target.value as CloudMemberRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="secretary">{ROLE_LABELS.secretary}</option>
                  <option value="doctor">{ROLE_LABELS.doctor}</option>
                  <option value="assistant">{ROLE_LABELS.assistant}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                </select>

                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-700 cursor-pointer">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    مجوز تغییر قیمت ثبت‌شده
                  </span>
                  <input
                    type="checkbox"
                    checked={role === 'manager' ? true : canEditPrices}
                    disabled={role === 'manager'}
                    onChange={(e) => setCanEditPrices(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 text-white font-black text-xs shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{saving ? 'در حال ثبت...' : 'ثبت دسترسی ایمیل در کلینیک مشترک'}</span>
              </button>
            </form>
          )}

          <div className="space-y-1.5">
            <div className="text-[11px] font-black text-slate-700">
              اعضای مجاز کلینیک ({data?.members?.length ?? 0} نفر)
            </div>
            {loading && !data ? (
              <div className="text-[11px] text-slate-500 py-2">در حال بارگذاری لیست اعضا...</div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {(data?.members || []).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-200/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {member.isOwner && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-black text-slate-900 truncate">
                          {member.displayName || member.email}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate" dir="ltr">
                        {member.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${ROLE_BADGE_CLASSES[member.role]}`}
                      >
                        {member.role === 'manager'
                          ? 'مدیر'
                          : member.role === 'doctor'
                          ? 'پزشک'
                          : member.role === 'secretary'
                          ? 'منشی'
                          : 'دستیار'}
                      </span>
                      {!member.canEditPrices && (
                        <span
                          className="p-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200"
                          title="قفل تغییر قیمت ثبت‌شده"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                      {isManager && !member.isOwner && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(member)}
                          disabled={saving}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                          title="لغو دسترسی"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {pendingDelete && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="تأیید لغو دسترسی پرسنل"
          className="rounded-2xl bg-rose-50 border border-rose-300 p-3 space-y-2.5"
        >
          <div className="flex items-start gap-2 text-rose-900 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              آیا از لغو دسترسی «{pendingDelete.displayName || pendingDelete.email}» به کلینیک مشترک اطمینان دارید؟
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
            >
              لغو دسترسی
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
