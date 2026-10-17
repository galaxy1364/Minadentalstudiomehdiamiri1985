import React, { useState } from 'react';
import { UserAccount, PlatformDevice, RoleType } from '../types/dental';
import { X, UserCheck, Smartphone, Monitor, Tablet, Plus, Shield, CheckCircle2, RefreshCw } from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  users: UserAccount[];
  platforms: PlatformDevice[];
  onSwitchUser: (user: UserAccount) => void;
  onAddPlatform: (platform: PlatformDevice) => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  platforms,
  onSwitchUser,
  onAddPlatform
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'platforms'>('roles');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>('tablet');
  const [newAssignedUser, setNewAssignedUser] = useState(users[0]?.username || 'monshi');

  if (!isOpen) return null;

  const handleCreatePlatform = () => {
    if (!newDeviceName) return;
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

  return (
    <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-gradient-to-b from-emerald-50/90 via-white to-sky-50/50 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-emerald-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">مدیریت کاربران، سطوح دسترسی و پلتفرم‌ها</h3>
              <p className="text-[11px] text-emerald-800 font-bold">کاربر فعال: {currentUser.fullName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-1.5 rounded-lg font-bold transition-all ${activeTab === 'roles' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            تغییر کاربر و نقش فعال
          </button>
          <button
            onClick={() => setActiveTab('platforms')}
            className={`py-1.5 rounded-lg font-bold transition-all ${activeTab === 'platforms' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            پلتفرم‌های متصل ({platforms.length})
          </button>
        </div>

        {/* TAB 1: Role Switcher */}
        {activeTab === 'roles' && (
          <div className="space-y-2.5">
            <span className="text-xs text-slate-600 font-bold block">
              برای آزمایش همگام‌سازی بین منشی و پزشک، نقش مورد نظر را انتخاب کنید:
            </span>

            {users.map(user => {
              const isSelected = user.id === currentUser.id;

              return (
                <div
                  key={user.id}
                  onClick={() => {
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
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm text-black shadow-sm"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.role === 'admin' ? 'مدیر' : user.role === 'doctor' ? 'پزشک' : user.role === 'secretary' ? 'منشی' : 'مالی'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">{user.fullName}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">@{user.username}</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block">
                        پلتفرم پیش‌فرض: {user.assignedPlatform}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                      فعال هم‌اکنون
                    </span>
                  )}
                </div>
              );
            })}

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

        {/* TAB 2: Connected Platforms */}
        {activeTab === 'platforms' && (
          <div className="space-y-3">
            <span className="text-xs text-slate-600 font-bold block">
              پلتفرم‌ها و دستگاه‌های فعال تعریف شده توسط مدیر کلینیک:
            </span>

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
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
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
                placeholder="نام دستگاه مثلاً: تبلت یونیت ۲"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800"
                >
                  <option value="desktop">ویندوز / دسکتاپ</option>
                  <option value="tablet">آیپد / تبلت</option>
                  <option value="mobile">موبایل هوشمند</option>
                </select>

                <select
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.username}>{u.fullName}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCreatePlatform}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all mt-1"
              >
                افزودن دستگاه به شبکه کلینیک
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
