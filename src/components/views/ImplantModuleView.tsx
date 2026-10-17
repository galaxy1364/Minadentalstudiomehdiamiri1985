import React, { useState } from 'react';
import { 
  Activity, Plus, Clock, CheckCircle2, 
  AlertCircle, ShieldCheck, ChevronRight, Layers,
  Calendar, Stethoscope, Search, Sparkles, Check,
  Send, Award
} from 'lucide-react';
import { ImplantCase, ImplantStage, Patient } from '../../types/dental';
import { toPersianDigits, formatToman } from '../../utils/jalali';

interface ImplantModuleViewProps {
  patients: Patient[];
  onOpenPatientFile: (patient: Patient) => void;
  onAdvanceStage: (caseId: string, nextStage: ImplantStage) => void;
  onAddImplantCase?: (newCase: any) => void;
}

export const ImplantModuleView: React.FC<ImplantModuleViewProps> = ({
  patients,
  onOpenPatientFile,
  onAdvanceStage,
  onAddImplantCase
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('همه');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for new implant
  const [formPatientId, setFormPatientId] = useState(patients[0]?.id || '');
  const [formTooth, setFormTooth] = useState('دندان ۶ پایین راست (LR6)');
  const [formBrand, setFormBrand] = useState('اشترومن Straumann (BLX)');
  const [formDiameter, setFormDiameter] = useState('۴.۲');
  const [formLength, setFormLength] = useState('۱۰');
  const [formTorque, setFormTorque] = useState(45);
  const [formSurgeryDate, setFormSurgeryDate] = useState('۱۴۰۳/۰۸/۱۵');
  const [formDoctor, setFormDoctor] = useState('دکتر مهدی امیری');

  const allImplants = patients.flatMap(p => p.implantCases || []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getStageTitle = (stage: ImplantStage) => {
    switch (stage) {
      case 'fixture_placed': return 'مرحله ۱: کاشت فیکسچر';
      case 'healing_cap': return 'مرحله ۲: بستن هیلینگ کپ';
      case 'impression': return 'مرحله ۳: قالب‌گیری پروتز';
      case 'abutment_framework': return 'مرحله ۴: تست اباتمنت و فریم';
      case 'crown_delivered': return 'مرحله ۵: تحویل نهایی روکش';
    }
  };

  const getNextStage = (stage: ImplantStage): ImplantStage => {
    switch (stage) {
      case 'fixture_placed': return 'healing_cap';
      case 'healing_cap': return 'impression';
      case 'impression': return 'abutment_framework';
      case 'abutment_framework': return 'crown_delivered';
      case 'crown_delivered': return 'crown_delivered';
    }
  };

  const getNextStageButtonText = (stage: ImplantStage): string => {
    switch (stage) {
      case 'fixture_placed': return 'ارتقا به: بستن هیلینگ کپ';
      case 'healing_cap': return 'ارتقا به: قالب‌گیری ایمپلنت';
      case 'impression': return 'ارتقا به: تست فریم و اباتمنت';
      case 'abutment_framework': return 'ثبت تحویل نهایی روکش';
      case 'crown_delivered': return 'درمان تکمیل شد';
    }
  };

  const filteredImplants = allImplants.filter(imp => {
    const matchesBrand = selectedBrand === 'همه' || imp.brand.includes(selectedBrand);
    const matchesSearch = !searchQuery || 
      imp.patientName.includes(searchQuery) ||
      imp.toothNumber.includes(searchQuery) ||
      imp.brand.includes(searchQuery);
    return matchesBrand && matchesSearch;
  });

  const handleCreateImplant = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === formPatientId);
    if (!patient) return;

    const newCase: ImplantCase = {
      id: `imp-${Date.now()}`,
      patientId: formPatientId,
      patientName: patient.fullName,
      toothNumber: formTooth,
      brand: formBrand,
      diameter: formDiameter,
      length: formLength,
      torque: Number(formTorque),
      boneGraft: false,
      membrane: false,
      surgeryDate: formSurgeryDate,
      healingDueDate: '۱۴۰۳/۱۰/۱۵',
      currentStage: 'fixture_placed',
      notes: `جراحی توسط ${formDoctor} با گشتاور تورک ${formTorque} N/cm انجام شد.`
    };

    if (onAddImplantCase) {
      onAddImplantCase(newCase);
    } else {
      patient.implantCases = [newCase, ...(patient.implantCases || [])];
    }

    showToast(`کیس جراحی ایمپلنت ${newCase.brand} برای ${patient.fullName} با موفقیت ثبت شد.`);
    setShowAddModal(false);
  };

  return (
    <div className="pb-28 space-y-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-[#162719] border border-[#c8ff00]/60 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-[#c8ff00] stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">جراحی و ایمپلنت</h3>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>جراحی جدید</span>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">کیس‌های فعال</span>
              <span className="text-xs font-black text-slate-800 font-mono">{toPersianDigits(allImplants.length)} فیکسچر</span>
            </div>
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-100">
              <span className="text-[9px] text-sky-700 block">دوره هیلینگ</span>
              <span className="text-xs font-black text-sky-800 font-mono">
                {toPersianDigits(allImplants.filter(i => i.currentStage === 'fixture_placed').length)} در انتظار
              </span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-[9px] text-emerald-600 block">تحویل روکش</span>
              <span className="text-xs font-black text-emerald-700 font-mono">
                {toPersianDigits(allImplants.filter(i => i.currentStage === 'crown_delivered').length)} موفق
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجوی کیس ایمپلنت با نام بیمار یا برند..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Brand Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
            {['همه', 'Straumann', 'Osstem', 'Dentium', 'Megagen', 'DIO'].map(brand => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`py-1 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  selectedBrand === brand
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {brand === 'همه' ? 'همه برندها' : brand}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Implant Cases Cards */}
      <div className="mx-2 space-y-2.5">
        {filteredImplants.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
            کیس ایمپلنتی با این مشخصات یافت نشد.
          </div>
        ) : (
          filteredImplants.map(imp => {
            const patient = patients.find(p => p.id === imp.patientId);

            return (
              <div
                key={imp.id}
                className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2.5 hover:shadow-sm transition-all"
              >
                {/* Header: Patient & Tooth */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900">{imp.patientName}</h4>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                        {imp.toothNumber}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-sky-700 mt-1 block">
                      سیستم و برند: {imp.brand}
                    </span>
                  </div>

                  <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-300 font-black px-2.5 py-1 rounded-full shadow-2xs">
                    {getStageTitle(imp.currentStage)}
                  </span>
                </div>

                {/* 5-Step Process Timeline Tracker */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold">
                    <div className={`p-1 rounded-lg transition-all ${imp.currentStage === 'fixture_placed' ? 'bg-sky-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                      ۱. فیکسچر
                    </div>
                    <div className={`p-1 rounded-lg transition-all ${imp.currentStage === 'healing_cap' ? 'bg-sky-600 text-white' : imp.currentStage === 'fixture_placed' ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-800'}`}>
                      ۲. هیلینگ
                    </div>
                    <div className={`p-1 rounded-lg transition-all ${imp.currentStage === 'impression' ? 'bg-sky-600 text-white' : ['fixture_placed', 'healing_cap'].includes(imp.currentStage) ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-800'}`}>
                      ۳. قالب‌گیری
                    </div>
                    <div className={`p-1 rounded-lg transition-all ${imp.currentStage === 'abutment_framework' ? 'bg-sky-600 text-white' : ['fixture_placed', 'healing_cap', 'impression'].includes(imp.currentStage) ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-800'}`}>
                      ۴. اباتمنت
                    </div>
                    <div className={`p-1 rounded-lg transition-all ${imp.currentStage === 'crown_delivered' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-500'}`}>
                      ۵. تحویل روکش
                    </div>
                  </div>
                </div>

                {/* Implant Surgical Details */}
                <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[9px]">ابعاد فیکسچر</span>
                    <span className="font-bold text-slate-800 font-mono">Ø {imp.diameter} × {imp.length}mm</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[9px]">گشتاور تورک اولیه</span>
                    <span className="font-black text-emerald-600 font-mono">{toPersianDigits(imp.torque)} N/cm</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[9px]">تاریخ جراحی</span>
                    <span className="text-slate-700 font-mono">{toPersianDigits(imp.surgeryDate)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <button
                    onClick={() => showToast(`شناسنامه گارانتی ایمپلنت ${imp.brand} برای ${imp.patientName} صادر شد.`)}
                    className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>شناسنامه ایمپلنت</span>
                  </button>

                  {imp.currentStage !== 'crown_delivered' ? (
                    <button
                      onClick={() => {
                        const next = getNextStage(imp.currentStage);
                        onAdvanceStage(imp.id, next);
                        showToast(`مرحله ایمپلنت با موفقیت ارتقا یافت.`);
                      }}
                      className="py-1 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{getNextStageButtonText(imp.currentStage)}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>پروتز با موفقیت تحویل شد</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add New Implant Surgical Case Modal (Pure Cyan Medical Theme - Zero Black) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-sky-950/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-sky-50/90 via-white to-cyan-50/50 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-sky-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-sky-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ثبت جراحی کاشت ایمپلنت جدید</h3>
                  <span className="text-[10px] text-sky-700 font-bold">پرونده جراحی و فیکسچر</span>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateImplant} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">انتخاب بیمار</label>
                <select
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">دندان هدف جراحی</label>
                <input
                  type="text"
                  value={formTooth}
                  onChange={(e) => setFormTooth(e.target.value)}
                  placeholder="مثال: دندان ۶ پایین راست (LR6)"
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">سیستم ایمپلنت</label>
                <select
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                >
                  <option value="اشترومن Straumann (BLX)">اشترومن (Straumann)</option>
                  <option value="اوستم Osstem (TSIII)">اوستم (Osstem)</option>
                  <option value="دنتیوم Dentium (SuperLine)">دنتیوم (Dentium)</option>
                  <option value="مگاژن Megagen (AnyRidge)">مگاژن (Megagen)</option>
                  <option value="بایوهورایزنز BioHorizons">بایوهورایزنز (BioHorizons)</option>
                  <option value="دیو DIO (SM)">دیو (DIO)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">قطر فیکسچر</label>
                  <input
                    type="text"
                    value={formDiameter}
                    onChange={(e) => setFormDiameter(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono focus:outline-none focus:border-sky-500 shadow-2xs"
                    placeholder="۴.۲"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">طول فیکسچر</label>
                  <input
                    type="text"
                    value={formLength}
                    onChange={(e) => setFormLength(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono focus:outline-none focus:border-sky-500 shadow-2xs"
                    placeholder="۱۰"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">تورک (N/cm)</label>
                  <input
                    type="number"
                    value={formTorque}
                    onChange={(e) => setFormTorque(Number(e.target.value))}
                    className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono focus:outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">تاریخ کاشت</label>
                  <input
                    type="text"
                    value={formSurgeryDate}
                    onChange={(e) => setFormSurgeryDate(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">جراح معالج</label>
                  <input
                    type="text"
                    value={formDoctor}
                    onChange={(e) => setFormDoctor(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>
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
                  className="w-2/3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md shadow-sky-600/25 active:scale-95 transition-all"
                >
                  ثبت پرونده جراحی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
