import React, { useState } from 'react';
import { 
  Users, Search, UserPlus, Phone, ChevronLeft, 
  AlertTriangle, FileCheck2, Calendar, ShieldCheck,
  Stethoscope, CreditCard, DollarSign, HeartPulse,
  Filter, Check, Clock, Edit3
} from 'lucide-react';
import { Patient } from '../../types/dental';
import { toPersianDigits, formatToman } from '../../utils/jalali';
import { getLatestFileNumber, getNextFileNumber, recordLastFileNumber } from '../../utils/fileNumber';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

interface PatientsListViewProps {
  patients: Patient[];
  onOpenPatientFile: (patient: Patient) => void;
  onAddNewPatient: (patient: Omit<Patient, 'id' | 'totalCost' | 'paidAmount' | 'balance' | 'activeTreatmentsCount' | 'lastVisit' | 'teethConditions' | 'sayadChecks' | 'installments' | 'labOrders' | 'implantCases' | 'payments'>) => void;
  onUpdateFileNumber?: (patientId: string, newFileNumber: string) => void;
}

export const PatientsListView: React.FC<PatientsListViewProps> = ({
  patients,
  onOpenPatientFile,
  onAddNewPatient,
  onUpdateFileNumber
}) => {
  const { selection, impactLight, impactHeavy, success } = useHapticFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'debtors' | 'active_treatment' | 'implants' | 'lab'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFileNumberPatientId, setEditingFileNumberPatientId] = useState<string | null>(null);
  const [tempFileNumber, setTempFileNumber] = useState('');

  // New patient form
  const [formFileNumber, setFormFileNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAge, setFormAge] = useState<number>(32);
  const [formGender, setFormGender] = useState<'مرد' | 'زن'>('مرد');
  const [formInsurance, setFormInsurance] = useState('آزاد');
  const [formMedicalAlerts, setFormMedicalAlerts] = useState<string[]>([]);
  const [formChiefComplaint, setFormChiefComplaint] = useState('');

  const medicalConditionOptions = [
    'دیابت قندی',
    'فشار خون بالا',
    'بیماری‌های قلبی عروقی',
    'حساسیت به پنی‌سیلین',
    'مصرف داروی ضدانعقاد (وارفارین/آسپیرین)',
    'بارداری',
    'هپاتیت / بیماری کبدی',
    'پوکی استخوان (مصرف بیفسفونات)'
  ];

  const toggleMedicalAlert = (cond: string) => {
    selection();
    if (formMedicalAlerts.includes(cond)) {
      setFormMedicalAlerts(formMedicalAlerts.filter(c => c !== cond));
    } else {
      setFormMedicalAlerts([...formMedicalAlerts, cond]);
    }
  };

  // Stats
  const totalCount = patients.length;
  const debtors = patients.filter(p => p.balance < 0);
  const totalDebt = debtors.reduce((sum, p) => sum + Math.abs(p.balance), 0);
  const activeTreatmentsTotal = patients.reduce((sum, p) => sum + p.activeTreatmentsCount, 0);

  const filtered = patients.filter(p => {
    const matchesSearch = 
      p.fullName.includes(searchQuery) ||
      p.phone.includes(searchQuery) ||
      p.fileNumber.includes(searchQuery) ||
      p.nationalId.includes(searchQuery);

    if (!matchesSearch) return false;

    if (activeFilter === 'debtors') return p.balance < 0;
    if (activeFilter === 'active_treatment') return p.activeTreatmentsCount > 0;
    if (activeFilter === 'implants') return p.implantCases && p.implantCases.length > 0;
    if (activeFilter === 'lab') return p.labOrders && p.labOrders.length > 0;

    return true;
  });

  const handleOpenAddModal = () => {
    impactHeavy();
    const nextNum = getNextFileNumber(getLatestFileNumber(patients));
    setFormFileNumber(nextNum);
    setShowAddModal(true);
  };

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName || !formPhone) return;

    success();
    const finalFileNumber = formFileNumber.trim() || getNextFileNumber(getLatestFileNumber(patients));
    recordLastFileNumber(finalFileNumber);

    onAddNewPatient({
      fullName: formName,
      fileNumber: finalFileNumber,
      nationalId: formNationalId || '۰۰۱۲۳۴۵۶۷۸',
      phone: formPhone,
      age: Number(formAge) || 30,
      gender: formGender,
      medicalHistory: formMedicalAlerts,
      notes: formChiefComplaint ? `علت مراجعه: ${formChiefComplaint} | بیمه: ${formInsurance}` : `بیمه: ${formInsurance}`
    });

    setShowAddModal(false);
    setFormName('');
    setFormPhone('');
    setFormNationalId('');
    setFormMedicalAlerts([]);
    setFormChiefComplaint('');
  };

  return (
    <div className="pb-28 space-y-3">
      {/* Top Search & Stats Card */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">بانک پرونده بیماران</h3>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[3]" />
              <span>تشکیل پرونده جدید</span>
            </button>
          </div>

          {/* Quick Stats Badges Bar */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">کل پرونده‌ها</span>
              <span className="text-xs font-black text-slate-800 font-mono">{toPersianDigits(totalCount)}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">درمان‌های جاری</span>
              <span className="text-xs font-black text-emerald-600 font-mono">{toPersianDigits(activeTreatmentsTotal)}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">بدهکاران</span>
              <span className="text-xs font-black text-red-500 font-mono">{toPersianDigits(debtors.length)} نفر</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">مانده مطالبات</span>
              <span className="text-[10px] font-black text-red-600 truncate block">{formatToman(totalDebt)}</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجو با نام بیمار، شماره پرونده، کدملی یا شماره موبایل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'all', label: `همه (${toPersianDigits(totalCount)})` },
              { id: 'debtors', label: `بدهکاران (${toPersianDigits(debtors.length)})` },
              { id: 'active_treatment', label: 'تحت درمان' },
              { id: 'implants', label: 'ایمپلنت' },
              { id: 'lab', label: 'لابراتوار' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  selection();
                  setActiveFilter(tab.id as any);
                }}
                className={`py-1 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  activeFilter === tab.id
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patients List */}
      <div className="mx-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
            بیماری با این مشخصات یافت نشد.
          </div>
        ) : (
          filtered.map(patient => (
            <div
              key={patient.id}
              onClick={() => {
                impactLight();
                onOpenPatientFile(patient);
              }}
              className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-sm hover:border-slate-200 transition-all group"
            >
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-black group-hover:-translate-x-0.5 transition-all" />
              </div>

              <div className="text-right flex-1 pr-1 pl-2">
                <div className="flex items-center justify-between">
                  {/* Left: Financial Badge */}
                  <div>
                    {patient.balance < 0 ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-full font-mono">
                        بدهکار: {formatToman(Math.abs(patient.balance))}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                        تسویه کامل
                      </span>
                    )}
                  </div>

                  {/* Right: Name & File Number */}
                  <div className="flex items-center gap-2">
                    {editingFileNumberPatientId === patient.id ? (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-cyan-500 shadow-sm"
                      >
                        <input
                          type="text"
                          value={tempFileNumber}
                          onChange={(e) => setTempFileNumber(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = tempFileNumber.trim();
                              if (trimmed && onUpdateFileNumber) {
                                onUpdateFileNumber(patient.id, trimmed);
                                recordLastFileNumber(trimmed);
                              }
                              setEditingFileNumberPatientId(null);
                            }
                            if (e.key === 'Escape') setEditingFileNumberPatientId(null);
                          }}
                          className="w-20 px-1.5 py-0.5 text-[11px] font-mono font-bold text-cyan-800 bg-cyan-50 rounded outline-none border border-cyan-200"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const trimmed = tempFileNumber.trim();
                            if (trimmed && onUpdateFileNumber) {
                              onUpdateFileNumber(patient.id, trimmed);
                              recordLastFileNumber(trimmed);
                            }
                            setEditingFileNumberPatientId(null);
                          }}
                          className="p-1 rounded bg-[#c8ff00] text-black hover:opacity-90 active:scale-95"
                          title="ذخیره و مبنا قرار دادن برای پرونده بعدی"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFileNumberPatientId(null);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFileNumberPatientId(patient.id);
                          setTempFileNumber(patient.fileNumber || '');
                        }}
                        className="text-[11px] text-slate-600 hover:text-cyan-700 font-mono font-bold bg-slate-100 hover:bg-cyan-50 border border-slate-200/80 hover:border-cyan-300 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all"
                        title="جهت ویرایش دستی شماره پرونده کلیک کنید (پرونده بعدی از این شماره +۱ می‌شود)"
                      >
                        <span>{patient.fileNumber}</span>
                        <Edit3 className="w-2.5 h-2.5 text-slate-400 group-hover:text-cyan-600" />
                      </span>
                    )}
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-cyan-800 transition-colors">{patient.fullName}</h4>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 text-[11px] text-slate-500 mt-1">
                  <span className="font-mono">{toPersianDigits(patient.phone)}</span>
                  <span>·</span>
                  <span>{patient.gender}</span>
                  <span>·</span>
                  <span>{toPersianDigits(patient.age)} ساله</span>
                </div>

                {/* Medical alert badge if exists */}
                {patient.medicalHistory.length > 0 && (
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/50">
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="truncate">{patient.medicalHistory.join('، ')}</span>
                  </div>
                )}

                {/* Sub status row */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">آخرین مراجعه:</span>
                    <span className="font-mono font-medium">{toPersianDigits(patient.lastVisit)}</span>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-slate-700">
                    <Stethoscope className="w-3 h-3 text-emerald-600" />
                    <span>{toPersianDigits(patient.activeTreatmentsCount)} درمان فعال</span>
                  </div>
                </div>
              </div>

              {/* Avatar Circle */}
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-300/80 text-emerald-800 font-black text-sm flex items-center justify-center shrink-0 ml-2 shadow-2xs">
                {patient.fullName.charAt(0)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Patient Registration Modal (Themed to Fresh Emerald Patients Palette - Zero Black) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-emerald-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-emerald-50/80 via-white to-teal-50/40 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-emerald-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تشکیل پرونده بیمار جدید</h3>
                  <span className="text-[10px] text-emerald-700 font-bold">پذیرش و بایگانی کلینیک</span>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              {/* شماره پرونده (تولید خودکار یکی‌یکی بالا، قابل ویرایش دستی) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 block font-bold">شماره پرونده بالینی *</label>
                  <span className="text-[10px] text-emerald-700 font-bold font-sans">افزایشی خودکار (قابل ادیت دستی)</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formFileNumber}
                    onChange={(e) => setFormFileNumber(e.target.value)}
                    placeholder="مثال: D-1052"
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-emerald-800 font-mono font-black text-sm focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                  <span className="absolute left-3 top-2.5 text-[9.5px] text-emerald-600 font-mono">آخرین ادیت +۱</span>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">نام و نام خانوادگی کامل *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: سارا ابراهیمی"
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">کد ملی (۱۰ رقم)</label>
                  <input
                    type="text"
                    value={formNationalId}
                    onChange={(e) => setFormNationalId(e.target.value)}
                    placeholder="۰۰۱۲۳۴۵۶۷۸"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">شماره تماس همراه *</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">سن بیمار</label>
                  <input
                    type="number"
                    value={formAge}
                    onChange={(e) => setFormAge(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">جنسیت</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  >
                    <option value="مرد">مرد</option>
                    <option value="زن">زن</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">پوشش بیمه</label>
                <select
                  value={formInsurance}
                  onChange={(e) => setFormInsurance(e.target.value)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  <option value="آزاد">آزاد (بدون بیمه)</option>
                  <option value="تامین اجتماعی">تامین اجتماعی</option>
                  <option value="خدمات درمانی">خدمات درمانی / سلامت</option>
                  <option value="نیروهای مسلح">نیروهای مسلح</option>
                  <option value="بیمه تکمیلی">بیمه تکمیلی (ایران/دانا/آسیا)</option>
                </select>
              </div>

              {/* Medical History Checklist */}
              <div>
                <label className="text-slate-700 block mb-1.5 flex items-center justify-between font-bold">
                  <span>سوابق پزشکی و هشدارهای سلامتی:</span>
                  <span className="text-[10px] text-amber-600 font-bold">حیاتی جهت بیحسی و جراحی</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto no-scrollbar p-1.5 bg-slate-50 rounded-xl border border-emerald-100">
                  {medicalConditionOptions.map(cond => {
                    const isChecked = formMedicalAlerts.includes(cond);
                    return (
                      <button
                        type="button"
                        key={cond}
                        onClick={() => toggleMedicalAlert(cond)}
                        className={`text-right p-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          isChecked
                            ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '} {cond}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">علت اصلی مراجعه (Chief Complaint)</label>
                <input
                  type="text"
                  value={formChiefComplaint}
                  onChange={(e) => setFormChiefComplaint(e.target.value)}
                  placeholder="مثلاً دندان‌درد شبانه، شکستگی دندان جلو، کاشت ایمپلنت..."
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
                >
                  تشکیل پرونده و صدور شماره
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
