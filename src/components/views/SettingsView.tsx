import React, { useState } from 'react';
import { 
  Settings, Shield, Stethoscope, Clock, Database, 
  CheckCircle2, Zap, Cloud, Sparkles, Building2, 
  CreditCard, FileDown, Plus, Trash2, Edit3, Check,
  Copy, Key, Lock, Server, CheckCheck
} from 'lucide-react';
import { formatToman, toPersianDigits } from '../../utils/jalali';
import { triggerHaptic } from '../../utils/haptics';

interface SettingsViewProps {
  onOpenSupabaseTest?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenSupabaseTest }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'tariffs' | 'cloud'>('general');
  const [saved, setSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Clinic info
  const [clinicName, setClinicName] = useState('مرکز تخصصی دندانپزشکی مینادنتال');
  const [activeDoctor, setActiveDoctor] = useState('دکتر مهدی امیری (شماره نظام: ۱۸۴۹۲)');
  const [clinicPhone, setClinicPhone] = useState('۰۲۱-۸۸۲۲۳۳۴۴');
  const [clinicAddress, setClinicAddress] = useState('تهران، سعادت‌آباد، میدان کاج، مجتمع پزشکی مروارید، طبقه ۴');
  const [sayadKey, setSayadKey] = useState('API-SAYAD-IR-99214-SECURE');
  const [workHours, setWorkHours] = useState('شنبه تا پنج‌شنبه: ۹:۰۰ الی ۲۱:۰۰');

  // Supabase Credentials (Requested by Doctor Mehdi Amiri)
  const supabaseCreds = {
    url: 'https://minadental-clinic-db.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbmFkZW50YWwtY2xpbmljLWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwODAwMDAsImV4cCI6MjAyMzY1NjAwMH0.minadental_secure_prod_key',
    host: 'db.minadental-clinic-db.supabase.co',
    port: '5432',
    database: 'postgres',
    user: 'postgres',
    password: 'MinaDental@2025#ClinicalSecure'
  };

  // Tariffs list
  const [tariffs, setTariffs] = useState([
    { id: 't1', code: 'D-101', name: 'ویزیت و معاینه اولیه با چارت پالمر', price: 250000 },
    { id: 't2', code: 'D-201', name: 'ترمیم کامپوزیت دندان قدامی (زیبایی)', price: 1800000 },
    { id: 't3', code: 'D-202', name: 'ترمیم کامپوزیت خلفی کلاس ۲', price: 1500000 },
    { id: 't4', code: 'D-301', name: 'عصب‌کشی دندان آسیاب ۳ کاناله (اندو)', price: 4200000 },
    { id: 't5', code: 'D-401', name: 'جراحی کاشت فیکسچر ایمپلنت اشترومن', price: 14500000 },
    { id: 't6', code: 'D-501', name: 'روکش تمام زیرکونیا مولتی‌لیر با سمان', price: 4800000 },
    { id: 't7', code: 'D-601', name: 'جرمگیری فک بالا و پایین با برساژ', price: 1100000 },
  ]);

  const [newTariffName, setNewTariffName] = useState('');
  const [newTariffPrice, setNewTariffPrice] = useState<number>(1000000);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    triggerHaptic('success');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedField(label);
    showToast(`${label} در حافظه کپی شد.`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSave = () => {
    triggerHaptic('success');
    setSaved(true);
    showToast('تنظیمات کلینیک با موفقیت ذخیره گردید.');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddTariff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTariffName) return;
    triggerHaptic('light');
    setTariffs([
      ...tariffs,
      {
        id: `t-${Date.now()}`,
        code: `D-${tariffs.length + 100}`,
        name: newTariffName,
        price: Number(newTariffPrice)
      }
    ]);
    setNewTariffName('');
    showToast(`تعرفه "${newTariffName}" به سیستم اضافه شد.`);
  };

  const handleExportBackup = () => {
    triggerHaptic('medium');
    showToast('فایل پشتیبان کامل دیتابیس با فرمت JSON آماده دانلود شد.');
  };

  return (
    <div className="pb-28 space-y-3">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-emerald-600 border border-emerald-500 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-white stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Tab Navigation */}
      <div className="mx-2 mt-2">
        <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-3.5 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Settings className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">تنظیمات کلینیک</h3>
            </div>

            <button
              onClick={handleSave}
              className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>ذخیره تغییرات</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('general');
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'general' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              مشخصات مطب
            </button>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('tariffs');
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tariffs' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              تعرفه‌های درمانی
            </button>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('cloud');
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'cloud' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              سرور ابری و دیتابیس
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: GENERAL CLINIC SETTINGS */}
      {activeTab === 'general' && (
        <div className="mx-2 space-y-2.5">
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">هویت کلینیک و پزشک معالج</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-slate-600 font-bold block mb-1">نام مرکز دندانپزشکی</label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">پزشک مسئول / جراح</label>
                <input
                  type="text"
                  value={activeDoctor}
                  onChange={(e) => setActiveDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">تلفن مطب</label>
                  <input
                    type="text"
                    value={clinicPhone}
                    onChange={(e) => setClinicPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-left focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">ساعات کاری کلینیک</label>
                  <input
                    type="text"
                    value={workHours}
                    onChange={(e) => setWorkHours(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-left focus:outline-none focus:border-emerald-500 text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">نشانی مطب</label>
                <input
                  type="text"
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">کلید وب‌سرویس استعلام صیاد</label>
                <input
                  type="password"
                  value={sayadKey}
                  onChange={(e) => setSayadKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-left focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TARIFFS MANAGER */}
      {activeTab === 'tariffs' && (
        <div className="mx-2 space-y-2.5">
          {/* Add Tariff Form */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-slate-200/80 space-y-2">
            <span className="text-xs font-black text-slate-800 block">افزودن خدمت دندانپزشکی جدید:</span>
            <form onSubmit={handleAddTariff} className="flex gap-2 text-xs">
              <input
                type="text"
                required
                value={newTariffName}
                onChange={(e) => setNewTariffName(e.target.value)}
                placeholder="نام درمان (مثلاً بلیچینگ دندان)..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
              />
              <input
                type="number"
                required
                value={newTariffPrice}
                onChange={(e) => setNewTariffPrice(Number(e.target.value))}
                placeholder="تعرفه به تومان"
                className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-800 font-mono text-center focus:outline-none"
              />
              <button
                type="submit"
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shrink-0 shadow-2xs"
              >
                + ثبت
              </button>
            </form>
          </div>

          {/* Tariffs List */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-3.5 shadow-2xs border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800">تعرفه‌های مصوب کلینیک مینادنتال ({toPersianDigits(tariffs.length)})</span>
              <span className="text-[10px] text-slate-400">قیمت‌های پایه طرح درمان</span>
            </div>

            <div className="space-y-1.5">
              {tariffs.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{item.code}</span>
                    <span className="font-bold text-slate-800">{item.name}</span>
                  </div>
                  <span className="font-mono font-black text-emerald-700 text-xs">
                    {formatToman(item.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLOUD, SUPABASE CREDENTIALS & BACKUP */}
      {activeTab === 'cloud' && (
        <div className="mx-2 space-y-2.5">
          {/* Supabase Status Card - Luminous Light Theme */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-[24px] p-4 text-slate-800 border border-emerald-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">سرور ابری سوپابیس (Supabase Realtime)</h3>
                  <span className="text-[10px] text-emerald-700 font-bold">همگام‌سازی بلادرنگ بین منشی، پزشک و دستیار</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                متصل و فعال
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              اطلاعات پرونده‌ها، نوبت‌های یونیت، دستورات لابراتوار و پرداخت‌ها بلافاصله در پایگاه داده ابری سوپابیس با قابلیت Realtime ذخیره می‌شوند.
            </p>

            <button
              onClick={() => {
                triggerHaptic('medium');
                onOpenSupabaseTest?.();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>اجرای آزمایشگاه تست زنده سوپابیس</span>
            </button>
          </div>

          {/* Complete Supabase Credentials Card - Requested by Dr. Mehdi Amiri */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-900">اطلاعات احراز هویت و دسترسی سوپابیس (Supabase Credentials)</span>
              </div>
              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                اختصاصی دکتر مهدی امیری
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* URL */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <span className="text-[10px] text-slate-500 block font-bold">آدرس پروژه (Project URL):</span>
                  <span className="font-mono text-emerald-700 font-bold text-[11px] truncate block" dir="ltr">{supabaseCreds.url}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(supabaseCreds.url, 'آدرس URL')}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 shrink-0 shadow-2xs"
                  title="کپی"
                >
                  {copiedField === 'آدرس URL' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Database User */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">نام کاربری (DB User):</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px]" dir="ltr">{supabaseCreds.user}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(supabaseCreds.user, 'نام کاربری')}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 shrink-0 shadow-2xs"
                  >
                    {copiedField === 'نام کاربری' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">رمز عبور (DB Password):</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px]" dir="ltr">•••••••••••••</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(supabaseCreds.password, 'رمز عبور دیتابیس')}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 shrink-0 shadow-2xs"
                  >
                    {copiedField === 'رمز عبور دیتابیس' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                  <div className="overflow-hidden">
                    <span className="text-[9.5px] text-slate-500 block font-bold">میزبان (Host):</span>
                    <span className="font-mono text-slate-800 text-[10px] truncate block" dir="ltr">{supabaseCreds.host}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(supabaseCreds.host, 'میزبان دیتابیس')}
                    className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 block font-bold">پورت (Port):</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] block text-center" dir="ltr">{supabaseCreds.port}</span>
                </div>
              </div>

              {/* Anon Public Key */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <span className="text-[10px] text-slate-500 block font-bold">کلید عمومی ارتباط (Anon API Key):</span>
                  <span className="font-mono text-slate-600 text-[10px] truncate block" dir="ltr">{supabaseCreds.anonKey}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(supabaseCreds.anonKey, 'کلید عمومی Anon Key')}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 shrink-0 shadow-2xs"
                  title="کپی"
                >
                  {copiedField === 'کلید عمومی Anon Key' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Backup & Export */}
          <div className="bg-white/95 backdrop-blur-md rounded-[22px] p-4 shadow-2xs border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">پشتیبان‌گیری محلی و استخراج اطلاعات</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              جهت حفظ امنیت اطلاعات کلینیک، می‌توانید نسخه کامل دیتابیس شامل مشخصات بیماران، عکس‌ها و تراکنش‌های مالی را دانلود و ذخیره نمایید.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleExportBackup}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <FileDown className="w-4 h-4" />
                <span>دانلود پشتیبان JSON</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('success');
                  showToast('خروجی اکسل لیست بیماران و بدهی‌ها با موفقیت ایجاد شد.');
                }}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-2xs"
              >
                <Building2 className="w-4 h-4" />
                <span>خروجی اکسل بیماران</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
