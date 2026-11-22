import React, { useState } from 'react';
import { UserAccount, PlatformDevice, RoleType } from '../types/dental';
import { 
  X, UserCheck, Smartphone, Monitor, Tablet, Plus, Shield, 
  CheckCircle2, RefreshCw, Key, Mail, Lock, UserPlus, AlertCircle, Eye, EyeOff, Edit3, Trash2
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { isClinicManager, appendSecurityAuditLog } from '../utils/dataProtection';
import { verifyPasswordCredential, sanitizeUserAccount } from '../utils/authCrypto';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { ViewportModalPortal } from './ViewportModalPortal';
import { toPersianDigits } from '../utils/jalali';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  users: UserAccount[];
  platforms: PlatformDevice[];
  onSwitchUser: (user: UserAccount) => void;
  onAddPlatform: (platform: PlatformDevice) => void;
  onAddUser?: (user: UserAccount) => void;
  onEditUser?: (user: UserAccount) => void;
  onDeleteUser?: (userId: string) => void;
  onLockSession?: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  platforms,
  onSwitchUser,
  onAddPlatform,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onLockSession
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'login' | 'add_user' | 'platforms'>('roles');
  useEscapeKey(isOpen, onClose);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editingPasswordInput, setEditingPasswordInput] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  
  // Platform creation state
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>('tablet');
  const [newAssignedUser, setNewAssignedUser] = useState(users[0]?.username || 'monshi');

  // Email & Password login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // New Staff / Doctor Form state
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<RoleType>('doctor');
  const [newPlatform, setNewPlatform] = useState('یونیت زرد دندانپزشکی');
  const [newLicense, setNewLicense] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [permAppointments, setPermAppointments] = useState(true);
  const [permTreatments, setPermTreatments] = useState(true);
  const [permPayments, setPermPayments] = useState(false);
  const [permChecks, setPermChecks] = useState(false);
  const [permSettings, setPermSettings] = useState(false);
  const [permBackup, setPermBackup] = useState(true);

  React.useEffect(() => {
    if (isOpen) {
      setConfirmDeleteUserId(null);
      setAddUserError(null);
      setLoginError(null);
      setLoginSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getRoleShortBadge = (role: RoleType): string => {
    if (role === 'admin') return 'مدیر';
    if (role === 'doctor') return 'پزشک';
    if (role === 'secretary') return 'منشی';
    if (role === 'assistant') return 'دستیار';
    if (role === 'lab_tech') return 'لابراتوار';
    return 'مالی';
  };

  const handleCreatePlatform = () => {
    if (!newDeviceName) return;
    triggerHaptic('success');
    const user = users.find(u => u.username === newAssignedUser) || users[0];
    onAddPlatform({
      id: `dev-${Date.now()}`,
      deviceName: newDeviceName,
      deviceType: newDeviceType,
      assignedRole: user.role,
      assignedUser: user.fullName,
      lastSyncTime: 'همین الان (آنلاین)',
      isOnline: true
    });
    setNewDeviceName('');
  };

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    const emailTrim = loginEmail.trim().toLowerCase();
    const passTrim = loginPassword.trim();

    if (!emailTrim || !passTrim) {
      setLoginError('لطفاً ایمیل و کلمه عبور را وارد نمایید.');
      triggerHaptic('warning');
      return;
    }

    // Match by email or username
    const matched = users.find(u => 
      (u.email && u.email.toLowerCase() === emailTrim) || 
      (u.username && u.username.toLowerCase() === emailTrim)
    );

    if (!matched) {
      setLoginError('کاربری با این مشخصات یافت نشد.');
      triggerHaptic('warning');
      return;
    }

    // Salted SHA-256 credential verification
    if (!verifyPasswordCredential(passTrim, matched)) {
      appendSecurityAuditLog({
        actor: currentUser.fullName,
        role: currentUser.role,
        action: `تلاش ناموفق ورود به حساب ${matched.fullName}`,
        details: 'کلمه عبور اشتباه وارد شد.',
        severity: 'warning'
      });
      setLoginError('کلمه عبور وارد شده نادرست است.');
      triggerHaptic('warning');
      return;
    }

    appendSecurityAuditLog({
      actor: matched.fullName,
      role: matched.role,
      action: 'ورود و احراز هویت با کلمه عبور',
      details: `کاربر با موفقیت وارد حساب ${matched.assignedPlatform} شد.`,
      severity: 'info'
    });
    triggerHaptic('success');
    setLoginSuccess(`خوش آمدید، ${matched.fullName}`);
    setTimeout(() => {
      onSwitchUser(matched);
      onClose();
    }, 500);
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError(null);
    const trimmedName = newFullName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedPass = newPassword.trim();
    if (!trimmedName || !trimmedEmail || !trimmedPass) {
      setAddUserError('نام، ایمیل و کلمه عبور برای ایجاد حساب پرسنل الزامی است.');
      triggerHaptic('warning');
      return;
    }

    const generatedUsername = newUsername.trim() || trimmedEmail.split('@')[0] || `user_${Date.now()}`;
    const duplicate = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === trimmedEmail) ||
        (u.username && u.username.toLowerCase() === generatedUsername.toLowerCase())
    );
    if (duplicate) {
      setAddUserError('کاربری با این ایمیل یا نام کاربری قبلاً در سیستم ثبت شده است.');
      triggerHaptic('warning');
      return;
    }

    const roleColors: Record<RoleType, string> = {
      admin: '#c8ff00',
      doctor: '#10b981',
      secretary: '#f59e0b',
      accountant: '#8b5cf6',
      assistant: '#14b8a6',
      lab_tech: '#06b6d4'
    };

    const sanitizedUser = sanitizeUserAccount({
      id: `user-${Date.now()}`,
      fullName: trimmedName,
      username: generatedUsername,
      email: trimmedEmail,
      role: newRole,
      assignedPlatform: newPlatform.trim() || 'پلتفرم کلینیک',
      avatarColor: roleColors[newRole],
      phone: newPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
      medicalLicense: newLicense.trim() || undefined,
      isActive: true,
      permissions: {
        canManageAppointments: permAppointments,
        canRegisterTreatments: permTreatments,
        canCollectPayments: permPayments,
        canManageChecks: permChecks,
        canAccessSettingsAndUsers: permSettings,
        canBackupAndRestore: permBackup
      }
    }, trimmedPass);

    triggerHaptic('success');
    if (onAddUser) {
      onAddUser(sanitizedUser);
    }
    setNewFullName('');
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewLicense('');
    setAddUserError(null);
    setActiveTab('roles');
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="مدیریت حساب کاربری و پرسنل کلینیک"
        onClick={onClose}
        className="fixed inset-0 z-[110] bg-emerald-950/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-gradient-to-b from-emerald-50/95 via-white to-sky-50/60 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-emerald-200/90 p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 max-h-[92dvh] overflow-y-auto shadow-2xl text-right"
        >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">حساب کاربری و پرسنل</h3>
              <p className="text-[11px] text-emerald-800 font-bold">کاربر فعال: {currentUser.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onLockSession && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onClose();
                  onLockSession();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                title="قفل فوری پنل کلینیک (نیازمند ورود مجدد با رمز عبور)"
              >
                <Lock className="w-3 h-3" />
                <span>قفل شیفت</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('login');
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10.5px] font-extrabold transition-colors cursor-pointer"
              title="خروج و تغییر حساب کاربری"
            >
              تعویض حساب
            </button>
            <button type="button" 
              onClick={onClose} 
              aria-label="بستن پنجره حساب کاربری"
              className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-[11px]">
          <button type="button"
            onClick={() => { triggerHaptic('selection'); setActiveTab('roles'); }}
            className={`py-1.5 rounded-lg font-bold transition-all ${activeTab === 'roles' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            کاربران
          </button>
          <button type="button"
            onClick={() => { triggerHaptic('selection'); setActiveTab('login'); }}
            className={`py-1.5 rounded-lg font-bold transition-all ${activeTab === 'login' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ورود با رمز
          </button>
          <button type="button"
            onClick={() => { triggerHaptic('selection'); setActiveTab('add_user'); }}
            className={`py-1.5 rounded-lg font-bold transition-all ${activeTab === 'add_user' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            + پرسنل جدید
          </button>
          <button type="button"
            onClick={() => { triggerHaptic('selection'); setActiveTab('platforms'); }}
            className={`py-1.5 rounded-lg font-bold transition-all ${activeTab === 'platforms' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            دستگاه‌ها ({toPersianDigits(platforms.length)})
          </button>
        </div>

        {/* TAB 1: Role Switcher */}
        {activeTab === 'roles' && (
          <div className="space-y-2">

            {users.map(user => {
              const isSelected = user.id === currentUser.id;
              const isTargetManager = isClinicManager(user);
              const isActiveManager = isClinicManager(currentUser);
              const requiresPasswordPrompt = isTargetManager && !isActiveManager;

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    if (requiresPasswordPrompt) {
                      triggerHaptic('warning');
                      setLoginEmail(user.email || user.username);
                      setLoginPassword('');
                      setLoginError('🔐 ورود به حساب مدیر کلینیک (دکتر مهدی امیری) نیازمند وارد کردن کلمه عبور است.');
                      setActiveTab('login');
                      return;
                    }
                    triggerHaptic('selection');
                    onSwitchUser(user);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-[11px] text-black shadow-xs shrink-0"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {getRoleShortBadge(user.role)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">{user.fullName}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">@{user.username}</span>
                      </div>
                      <div className="text-[10.5px] text-emerald-800 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{user.assignedPlatform}</span>
                        {requiresPasswordPrompt && (
                          <span className="text-[9.5px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full border border-amber-300 font-black flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> نیازمند رمز مدیر
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && (
                      <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                        فعال هم‌اکنون
                      </span>
                    )}

                    {isActiveManager && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('selection');
                          setEditingUser({ ...user });
                          setEditingPasswordInput('');
                        }}
                        className="py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                        title="ویرایش رمز عبور، ایمیل، نقش و سطح دسترسی"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>ویرایش</span>
                      </button>
                    )}

                    {isActiveManager && user.role !== 'admin' && onDeleteUser && (
                      confirmDeleteUserId === user.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('warning');
                              onDeleteUser(user.id);
                              setConfirmDeleteUserId(null);
                            }}
                            className="py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black cursor-pointer"
                          >
                            تایید حذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUserId(null)}
                            className="py-1 px-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold cursor-pointer"
                          >
                            لغو
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('warning');
                            setConfirmDeleteUserId(user.id);
                          }}
                          aria-label={`بایگانی حساب ${user.fullName}`}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer active:scale-95"
                          title="بایگانی حساب کاربری (فقط مدیر)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {editingUser && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="font-black text-amber-950 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                    ویرایش حساب کاربری و دسترسی «{editingUser.fullName}»
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-0.5">نام و نام خانوادگی</label>
                    <input aria-label="نام و نام خانوادگی"
                      type="text"
                      value={editingUser.fullName}
                      onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                      className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-0.5">شماره موبایل</label>
                    <input aria-label="شماره موبایل"
                      type="text"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-0.5">ایمیل / نام کاربری</label>
                    <input aria-label="ایمیل / نام کاربری"
                      type="text"
                      value={editingUser.email || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-0.5">رمز عبور جدید (اختیاری)</label>
                    <input
                      type="password"
                      value={editingPasswordInput}
                      onChange={(e) => setEditingPasswordInput(e.target.value)}
                      placeholder="برای تغییر وارد کنید..."
                      dir="ltr"
                      className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10.5px]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions.canManageAppointments}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: { ...editingUser.permissions, canManageAppointments: e.target.checked }
                        })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>مدیریت نوبت‌دهی</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions.canRegisterTreatments}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: { ...editingUser.permissions, canRegisterTreatments: e.target.checked }
                        })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>ثبت طرح درمان</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions.canCollectPayments}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: { ...editingUser.permissions, canCollectPayments: e.target.checked }
                        })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>صندوق و دریافت وجه</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions.canManageChecks}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: { ...editingUser.permissions, canManageChecks: e.target.checked }
                        })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>مدیریت چک و اقساط</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('success');
                      if (onEditUser) {
                        onEditUser(sanitizeUserAccount(editingUser, editingPasswordInput));
                      }
                      setEditingUser(null);
                      setEditingPasswordInput('');
                    }}
                    className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xs cursor-pointer"
                  >
                    ذخیره تغییرات پرسنل ✓
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
              <span className="font-bold text-slate-900 block">مجوزهای نقش فعال ({currentUser.fullName}):</span>
              <div className="grid grid-cols-2 gap-1 text-[10px] pt-1">
                <span className={currentUser.permissions.canManageAppointments ? 'text-emerald-700 font-bold' : 'text-red-600 font-medium'}>
                  {currentUser.permissions.canManageAppointments ? '✓ ثبت و تغییر نوبت‌ها' : '✕ ثبت نوبت'}
                </span>
                <span className={currentUser.permissions.canRegisterTreatments ? 'text-emerald-700 font-bold' : 'text-red-600 font-medium'}>
                  {currentUser.permissions.canRegisterTreatments ? '✓ ثبت درمان در یونیت' : '✕ ثبت درمان'}
                </span>
                <span className={currentUser.permissions.canCollectPayments ? 'text-emerald-700 font-bold' : 'text-red-600 font-medium'}>
                  {currentUser.permissions.canCollectPayments ? '✓ صندوق و دریافت وجه' : '✕ دریافت وجه'}
                </span>
                <span className={currentUser.permissions.canAccessSettingsAndUsers ? 'text-emerald-700 font-bold' : 'text-red-600 font-medium'}>
                  {currentUser.permissions.canAccessSettingsAndUsers ? '✓ تعریف کاربران و پلتفرم' : '✕ دسترسی تنظیمات'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Login with Email & Password */}
        {activeTab === 'login' && (
          <form onSubmit={handleEmailPasswordLogin} className="space-y-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Key className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">ورود امن پرسنل و پزشک با ایمیل شخصی</span>
            </div>

            {loginError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {loginSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{loginSuccess}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>ایمیل یا نام کاربری:</span>
              </label>
              <input
                type="text"
                aria-label="ایمیل یا نام کاربری ورود"
                placeholder="مثلاً: mehdi.amiri19851364@gmail.com یا dr_amiri"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                dir="ltr"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>کلمه عبور اختصاصی:</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  aria-label="کلمه عبور اختصاصی"
                  placeholder="رمز عبور خود را وارد کنید"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 pl-9"
                />
                <button
                  type="button"
                  aria-label="نمایش یا مخفی کردن کلمه عبور"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all mt-2 cursor-pointer"
            >
              احراز هویت و ورود به سامانه
            </button>

            {/* Quick Account Identifier Fill (Never expose plaintext passwords) */}
            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
              <span className="font-bold text-slate-700 block">انتخاب شناسه کاربری (کلمه عبور را وارد کنید):</span>
              <div className="grid grid-cols-2 gap-1 font-mono">
                {users.slice(0, 6).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setLoginEmail(u.email || u.username);
                      setLoginPassword('');
                      setLoginError(null);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors text-right font-sans font-bold text-slate-700 truncate"
                  >
                    {u.role === 'admin' ? '🔐 ' : '👤 '}{u.fullName} ({getRoleShortBadge(u.role)})
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: Add New Staff Member / Doctor (Clinic Manager Only) */}
        {activeTab === 'add_user' && !isClinicManager(currentUser) && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-700" />
            <span>تعریف پرسنل جدید و تعیین سطح دسترسی فقط توسط مدیر کلینیک (دکتر مهدی امیری) مجاز است.</span>
          </div>
        )}
        {activeTab === 'add_user' && isClinicManager(currentUser) && (
          <form onSubmit={handleCreateNewUser} className="space-y-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs text-xs">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">تعریف عضو جدید کادر درمان و تعیین رمز عبور</span>
            </div>

            {addUserError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{addUserError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">نام و نام خانوادگی:</label>
                <input
                  type="text"
                  placeholder="دکتر سارا حسینی"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">نقش سازمانی:</label>
                <select aria-label="نقش سازمانی"
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value as RoleType;
                    setNewRole(r);
                    if (r === 'doctor') {
                      setPermTreatments(true);
                      setPermAppointments(true);
                      setPermPayments(false);
                      setPermChecks(false);
                      setPermSettings(false);
                    } else if (r === 'secretary') {
                      setPermTreatments(false);
                      setPermAppointments(true);
                      setPermPayments(true);
                      setPermChecks(true);
                      setPermSettings(false);
                    } else if (r === 'assistant') {
                      setPermTreatments(true);
                      setPermAppointments(true);
                      setPermPayments(false);
                      setPermChecks(false);
                      setPermSettings(false);
                    } else if (r === 'lab_tech') {
                      setPermTreatments(false);
                      setPermAppointments(false);
                      setPermPayments(false);
                      setPermChecks(false);
                      setPermSettings(false);
                    } else if (r === 'accountant') {
                      setPermTreatments(false);
                      setPermAppointments(false);
                      setPermPayments(true);
                      setPermChecks(true);
                      setPermSettings(false);
                    } else {
                      setPermTreatments(true);
                      setPermAppointments(true);
                      setPermPayments(true);
                      setPermChecks(true);
                      setPermSettings(true);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="doctor">دندانپزشک معالج</option>
                  <option value="secretary">منشی و پذیرش</option>
                  <option value="assistant">دستیار کنار یونیت</option>
                  <option value="lab_tech">تکنسین لابراتوار</option>
                  <option value="accountant">امور مالی و حسابدار</option>
                  <option value="admin">مدیر ارشد کلینیک</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">ایمیل رسمی (جهت ورود):</label>
                <input
                  type="email"
                  placeholder="doctor@minadental.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setAddUserError(null);
                  }}
                  dir="ltr"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">کلمه عبور اولیه:</label>
                <input
                  type="text"
                  placeholder="رمز عبور شخصی"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">شماره موبایل:</label>
                <input
                  type="tel"
                  aria-label="شماره موبایل پرسنل جدید"
                  placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">یونیت / پلتفرم:</label>
                <input
                  type="text"
                  placeholder="یونیت زرد دندانپزشکی"
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">نظام پزشکی:</label>
                <input
                  type="text"
                  placeholder="۲۰۳۴۱-م"
                  value={newLicense}
                  onChange={(e) => setNewLicense(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Granular Permissions */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-800 block">سطح دسترسی:</span>
              <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permAppointments}
                    onChange={(e) => setPermAppointments(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span>مدیریت نوبت‌دهی</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permTreatments}
                    onChange={(e) => setPermTreatments(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span>ثبت طرح درمان یونیت</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permPayments}
                    onChange={(e) => setPermPayments(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span>صندوق و دریافت وجه</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permChecks}
                    onChange={(e) => setPermChecks(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span>مدیریت چک صیاد و اقساط</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              ثبت پرسنل و اعطای دسترسی به کلینیک
            </button>
          </form>
        )}

        {/* TAB 4: Connected Platforms */}
        {activeTab === 'platforms' && (
          <div className="space-y-2.5">

            <div className="space-y-2">
              {platforms.map(p => (
                <div key={p.id} className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                      {p.deviceType === 'desktop' ? <Monitor className="w-4 h-4" /> :
                       p.deviceType === 'tablet' ? <Tablet className="w-4 h-4" /> :
                       <Smartphone className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{p.deviceName}</span>
                      <span className="text-[10px] text-slate-500 font-medium">کاربر: {p.assignedUser}</span>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      آنلاین و سینک
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{p.lastSyncTime}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add platform form */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-black text-slate-800 text-xs block">+ تعریف پلتفرم / دستگاه جدید</span>
              <input
                type="text"
                placeholder="نام دستگاه مثلاً: تبلت یونیت زرد"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="نوع دستگاه"
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800"
                >
                  <option value="desktop">ویندوز / دسکتاپ</option>
                  <option value="tablet">آیپد / تبلت</option>
                  <option value="mobile">موبایل هوشمند</option>
                </select>

                <select aria-label="کاربر متصل به دستگاه"
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.username}>{u.fullName}</option>
                  ))}
                </select>
              </div>

              <button type="button"
                onClick={handleCreatePlatform}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all mt-1 cursor-pointer"
              >
                افزودن دستگاه به شبکه کلینیک
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
    </ViewportModalPortal>
  );
};
