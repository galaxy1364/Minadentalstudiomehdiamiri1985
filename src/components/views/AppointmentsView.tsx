import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, User, Phone, 
  Plus, CheckCircle2, ChevronLeft, ChevronRight,
  Stethoscope, MapPin, AlertCircle, Search, Send,
  XCircle, Filter, CalendarDays, Check, Sparkles
} from 'lucide-react';
import { Appointment, Patient } from '../../types/dental';
import { toPersianDigits, PERSIAN_MONTHS, PERSIAN_WEEKDAYS } from '../../utils/jalali';

interface AppointmentsViewProps {
  appointments: Appointment[];
  patients: Patient[];
  onAddAppointment: (appointment: Omit<Appointment, 'id'>) => void;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  appointments,
  patients,
  onAddAppointment,
  onUpdateStatus
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // 7 = آبان (0-indexed)
  const [selectedDay, setSelectedDay] = useState<number>(15); // ۱۵ آبان
  const [selectedUnit, setSelectedUnit] = useState<string>('همه');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsToast, setSmsToast] = useState<string | null>(null);

  // Form states
  const [formPatientName, setFormPatientName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formUnit, setFormUnit] = useState('یونیت ۱');
  const [formDoctor, setFormDoctor] = useState('دکتر مهدی امیری');
  const [formTime, setFormTime] = useState('۱۷:۰۰');
  const [formTreatment, setFormTreatment] = useState('معاینه و طرح درمان');
  const [sendSmsOnCreate, setSendSmsOnCreate] = useState(true);

  // Month days: Aban has 30 days
  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  const filteredAppointments = appointments.filter(apt => {
    const matchesUnit = selectedUnit === 'همه' || apt.unit === selectedUnit;
    const matchesSearch = !searchQuery || 
      apt.patientName.includes(searchQuery) || 
      apt.phone.includes(searchQuery) ||
      apt.treatment.includes(searchQuery);
    return matchesUnit && matchesSearch;
  });

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formPatientName) return;
    
    onAddAppointment({
      patientId: 'pat-new',
      patientName: formPatientName,
      phone: formPhone || '۰۹۱۲۰۰۰۰۰۰۰',
      unit: formUnit,
      doctor: formDoctor,
      date: `۱۴۰۳/۰۸/${selectedDay < 10 ? '۰' + selectedDay : toPersianDigits(selectedDay)}`,
      time: formTime,
      durationMinutes: 45,
      treatment: formTreatment,
      status: 'scheduled'
    });

    if (sendSmsOnCreate) {
      showSmsAlert(`پیامک تایید نوبت برای ${formPatientName} به شماره ${formPhone || '۰۹۱۲۰۰۰۰۰۰۰'} ارسال شد.`);
    }

    setShowAddModal(false);
    setFormPatientName('');
    setFormPhone('');
  };

  const showSmsAlert = (msg: string) => {
    setSmsToast(msg);
    setTimeout(() => setSmsToast(null), 3500);
  };

  const handlePatientSelectInForm = (patientId: string) => {
    const p = patients.find(item => item.id === patientId);
    if (p) {
      setFormPatientName(p.fullName);
      setFormPhone(p.phone);
    }
  };

  return (
    <div className="pb-28 space-y-3">
      {/* SMS notification toast */}
      {smsToast && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-[#142318] border border-[#c8ff00]/60 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="w-7 h-7 rounded-full bg-[#c8ff00] text-black flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <span className="text-xs font-bold leading-tight">{smsToast}</span>
        </div>
      )}

      {/* Top Jalali Calendar Bar & Header */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-800">
                  تقویم نوبت‌دهی کلینیک
                </h3>
                <span className="text-[10px] text-slate-400">
                  {PERSIAN_MONTHS[selectedMonth]} ماه ۱۴۰۳ · روز {toPersianDigits(selectedDay)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* View mode toggle */}
              <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-[10px] font-bold">
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    viewMode === 'daily' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  روزانه
                </button>
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    viewMode === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  ماهانه
                </button>
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>نوبت جدید</span>
              </button>
            </div>
          </div>

          {/* Month Selector & Navigation */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setSelectedMonth(prev => Math.min(11, prev + 1))}
              disabled={selectedMonth >= 11}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
              title="ماه بعد"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-xs font-black text-slate-800">
              {PERSIAN_MONTHS[selectedMonth]} ۱۴۰۳
            </span>

            <button
              onClick={() => setSelectedMonth(prev => Math.max(0, prev - 1))}
              disabled={selectedMonth <= 0}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
              title="ماه قبل"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Monthly Grid View vs Horizontal Day Scroller */}
          {viewMode === 'monthly' ? (
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
                {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((w, idx) => (
                  <span key={idx}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {daysInMonth.map(day => {
                  const isSelected = selectedDay === day;
                  const dayAptsCount = appointments.filter(a => a.date.includes(String(day))).length;
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setViewMode('daily');
                      }}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-mono font-bold transition-all ${
                        isSelected 
                          ? 'bg-[#1b251d] text-[#c8ff00] shadow-sm scale-105' 
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{toPersianDigits(day)}</span>
                      {dayAptsCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {daysInMonth.map(day => {
                const isSelected = selectedDay === day;
                const dayApts = appointments.filter(a => a.date.includes(String(day)));
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col items-center justify-center min-w-[46px] py-1.5 px-1 rounded-2xl transition-all duration-200 shrink-0 ${
                      isSelected
                        ? 'bg-[#1b251d] text-[#c8ff00] shadow-md scale-105'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    <span className="text-[9px] font-medium opacity-60">آبان</span>
                    <span className="text-sm font-extrabold font-mono mt-0.5">
                      {toPersianDigits(day)}
                    </span>
                    {dayApts.length > 0 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] mt-1" />
                    ) : (
                      <span className="w-1.5 h-1.5 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Unit Filter Selector & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
            {/* Unit tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {['همه', 'یونیت ۱', 'یونیت ۲', 'اتاق جراحی'].map(unit => (
                <button
                  key={unit}
                  onClick={() => setSelectedUnit(unit)}
                  className={`py-1 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedUnit === unit
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                placeholder="جستجوی نوبت..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-44 bg-slate-50 border border-slate-200 rounded-xl pr-7 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Cards List */}
      <div className="mx-2 space-y-2.5">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-black text-slate-800">
            نوبت‌های {toPersianDigits(selectedDay)} {PERSIAN_MONTHS[selectedMonth]} ({toPersianDigits(filteredAppointments.length)} نوبت)
          </span>
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
            یونیت‌های فعال مطب
          </span>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs space-y-2">
            <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
            <p>هیچ نوبتی برای این یونیت در این روز ثبت نشده است.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1 mt-1 shadow-xs"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>ثبت اولین نوبت</span>
            </button>
          </div>
        ) : (
          filteredAppointments.map(apt => (
            <div
              key={apt.id}
              className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2.5 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#162118] text-[#c8ff00] flex flex-col items-center justify-center font-mono font-bold text-xs border border-[#c8ff00]/30 shadow-2xs shrink-0">
                    <span>{toPersianDigits(apt.time)}</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{apt.patientName}</h4>
                    <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                      {toPersianDigits(apt.phone)}
                    </span>
                  </div>
                </div>

                {/* Status pill badge */}
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                    apt.status === 'in_chair' ? 'bg-[#c8ff00] text-black shadow-2xs animate-pulse' :
                    apt.status === 'waiting' ? 'bg-amber-100 text-amber-800' :
                    apt.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {apt.status === 'in_chair' ? 'روی یونیت (در حال درمان)' :
                     apt.status === 'waiting' ? 'حاضر در سالن انتظار' :
                     apt.status === 'completed' ? 'درمان انجام شد' : 'رزرو شده'}
                  </span>
                </div>
              </div>

              {/* Treatment & Unit info */}
              <div className="p-2 rounded-xl bg-slate-50 text-xs text-slate-700 flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-1.5 truncate">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-bold truncate">{apt.treatment}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[11px] shrink-0 font-medium">
                  <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">{apt.unit}</span>
                  <span>{apt.doctor}</span>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100/80">
                <button
                  onClick={() => showSmsAlert(`پیامک یادآوری نوبت برای ${apt.patientName} با موفقیت ارسال گردید.`)}
                  className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1"
                  title="ارسال پیامک یادآوری"
                >
                  <Send className="w-3 h-3 -scale-x-100 text-slate-500" />
                  <span>پیامک یادآوری</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {apt.status !== 'waiting' && apt.status !== 'in_chair' && apt.status !== 'completed' && (
                    <button
                      onClick={() => onUpdateStatus(apt.id, 'waiting')}
                      className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px]"
                    >
                      اعلام حضور در سالن
                    </button>
                  )}

                  {apt.status !== 'in_chair' && apt.status !== 'completed' && (
                    <button
                      onClick={() => onUpdateStatus(apt.id, 'in_chair')}
                      className="py-1 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-2xs"
                    >
                      فراخوان به یونیت
                    </button>
                  )}

                  {apt.status === 'in_chair' && (
                    <button
                      onClick={() => onUpdateStatus(apt.id, 'completed')}
                      className="py-1 px-3 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>پایان درمان و ثبت در پرونده</span>
                    </button>
                  )}

                  {apt.status === 'completed' && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>مختومه</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Appointment Modal (Themed to Sky Blue Appointments Palette - Zero Black) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-sky-950/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-sky-50/80 via-white to-blue-50/40 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-sky-200/90 p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-sky-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ثبت نوبت دندانپزشکی جدید</h3>
                  <span className="text-[10px] text-sky-700 font-bold">تقویم شیفت کلینیک</span>
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
              {/* Existing patient quick-pick */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">پرونده بیمار (اختیاری)</label>
                <select
                  onChange={(e) => handlePatientSelectInForm(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                  defaultValue=""
                >
                  <option value="">انتخاب پرونده موجود...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">نام و نام خانوادگی بیمار *</label>
                <input
                  type="text"
                  required
                  value={formPatientName}
                  onChange={(e) => setFormPatientName(e.target.value)}
                  placeholder="مثال: رضا محمدی"
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">شماره تماس همراه</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-sky-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">یونیت دندانپزشکی</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                  >
                    <option value="یونیت ۱">یونیت ۱</option>
                    <option value="یونیت ۲">یونیت ۲</option>
                    <option value="اتاق جراحی">اتاق جراحی</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">ساعت نوبت</label>
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">پزشک معالج</label>
                <select
                  value={formDoctor}
                  onChange={(e) => setFormDoctor(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-2xs"
                >
                  <option value="دکتر مهدی امیری">دکتر مهدی امیری</option>
                  <option value="دکتر مریم رضایی">دکتر مریم رضایی</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">شرح درمان یا علت مراجعه</label>
                <input
                  type="text"
                  value={formTreatment}
                  onChange={(e) => setFormTreatment(e.target.value)}
                  placeholder="مثلاً ترمیم کامپوزیت، کاشت ایمپلنت، قالب‌گیری روکش..."
                  className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendSmsOnCreate}
                  onChange={(e) => setSendSmsOnCreate(e.target.checked)}
                  className="rounded accent-sky-600 w-4 h-4"
                />
                <span className="text-[11px]">ارسال خودکار پیامک تایید نوبت و نشانی مطب</span>
              </label>

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
                  ثبت قطعی نوبت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
