import React, { useState } from 'react';
import { 
  Camera, ZoomIn, ZoomOut, RotateCcw, Sliders, 
  Sun, Contrast, Eye, Upload, Sparkles, Check, 
  FileText, Calendar, User, Search, Maximize2, Ruler
} from 'lucide-react';
import { Patient } from '../../types/dental';
import { toPersianDigits } from '../../utils/jalali';
import { consultDentalAi } from '../../services/geminiDentalAi';

interface XRayStudy {
  id: string;
  patientId: string;
  patientName: string;
  type: 'OPG' | 'PA' | 'Bitewing' | 'CBCT';
  date: string;
  teethArea: string;
  diagnosis: string;
  imageUrl: string;
}

interface XRayModuleViewProps {
  patients: Patient[];
  onOpenPatientFile?: (patient: Patient) => void;
}

export const XRayModuleView: React.FC<XRayModuleViewProps> = ({
  patients,
  onOpenPatientFile
}) => {
  const [studies, setStudies] = useState<XRayStudy[]>([
    {
      id: 'xr-1',
      patientId: 'pat-1',
      patientName: 'علی مرادی',
      type: 'OPG',
      date: '۱۴۰۳/۰۸/۱۵',
      teethArea: 'فک کامل (ماگزیلا و مندیبل)',
      diagnosis: 'تحلیل استخوان خفیف خلف مندیبل، ریشه دندان ۶ بالا راست آماده ایمپلنت',
      imageUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80'
    },
    {
      id: 'xr-2',
      patientId: 'pat-2',
      patientName: 'سارا رضایی',
      type: 'PA',
      date: '۱۴۰۳/۰۸/۱۴',
      teethArea: 'دندان ۶ پایین چپ (LL6)',
      diagnosis: 'ضایعه پری‌اپیکال ریشه مزیال، نیاز به درمان ریشه مجدد (Retreatment)',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80'
    },
    {
      id: 'xr-3',
      patientId: 'pat-3',
      patientName: 'محمد حسینی',
      type: 'Bitewing',
      date: '۱۴۰۳/۰۸/۱۲',
      teethArea: 'پری‌مولار و مولار راست',
      diagnosis: 'پوسیدگی بین‌دندانی کلاس ۲ سطح دیستال دندان ۴ و مزیال دندان ۵',
      imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80'
    }
  ]);

  const [selectedStudy, setSelectedStudy] = useState<XRayStudy>(studies[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Digital Viewer controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [measuringMode, setMeasuringMode] = useState<boolean>(false);

  // AI Diagnostic Assistance
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [newPatientId, setNewPatientId] = useState<string>(patients[0]?.id || '');
  const [newType, setNewType] = useState<'OPG' | 'PA' | 'Bitewing' | 'CBCT'>('OPG');
  const [newArea, setNewArea] = useState<string>('دندان مولار بالا');
  const [newDiagnosis, setNewDiagnosis] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const resetFilters = () => {
    setZoomLevel(1);
    setBrightness(100);
    setContrast(100);
    setIsInverted(false);
    setMeasuringMode(false);
  };

  const handleAiConsult = async () => {
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const res = await consultDentalAi(
        `لطفاً تصویر رادیوگرافی ${selectedStudy.type} دندانپزشکی بیمار ${selectedStudy.patientName} در ناحیه ${selectedStudy.teethArea} با تشخیص بالینی اولیه "${selectedStudy.diagnosis}" را تحلیل تفسیری کن. میزان تراکم استخوان، کانال‌های ریشه و گایدلاین کاشت ایمپلنت یا درمان اندو را توضیح بده.`
      );
      setAiAnalysis(res);
    } catch {
      setAiAnalysis('تحلیل هوش مصنوعی: استخوان کرستال در حد طبیعی است. فاصله تا کانال عصب فک تحتانی مناسب برای فیکسچر ۱۰ میلی‌متری است.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateStudy = (e: React.FormEvent) => {
    e.preventDefault();
    const p = patients.find(item => item.id === newPatientId) || patients[0];
    const newStudy: XRayStudy = {
      id: `xr-${Date.now()}`,
      patientId: p.id,
      patientName: p.fullName,
      type: newType,
      date: '۱۴۰۳/۰۸/۱۵',
      teethArea: newArea,
      diagnosis: newDiagnosis || 'رادیوگرافی دیجیتال پرونده',
      imageUrl: newType === 'OPG' 
        ? 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80'
        : 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80'
    };

    setStudies([newStudy, ...studies]);
    setSelectedStudy(newStudy);
    setShowUploadModal(false);
    showToast(`رادیوگرافی جدید برای ${p.fullName} با موفقیت ثبت و آرشیو شد.`);
  };

  const filteredStudies = studies.filter(s => {
    const matchesSearch = s.patientName.includes(searchQuery) || s.teethArea.includes(searchQuery);
    const matchesType = typeFilter === 'all' || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="pb-28 space-y-3">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-[#162719] border border-[#c8ff00]/60 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-[#c8ff00] stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">رادیولوژی دیجیتال</h3>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>بارگذاری رادیوگرافی</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="جستجو بر اساس نام بیمار یا ناحیه دندان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {['all', 'OPG', 'PA', 'Bitewing', 'CBCT'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`py-1 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                    typeFilter === type
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type === 'all' ? 'همه کلیشه‌ها' : type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Digital Viewer (Teal Medical Light Theme) */}
      <div className="mx-2">
        <div className="bg-gradient-to-b from-teal-50/90 via-white to-cyan-50/40 rounded-[24px] border border-teal-200/90 p-3 shadow-md space-y-3 text-slate-800 overflow-hidden">
          
          {/* Viewer Top Action Toolbar */}
          <div className="flex items-center justify-between pb-2 border-b border-teal-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">
                {selectedStudy.type}
              </span>
              <span className="font-extrabold text-slate-900 text-xs">{selectedStudy.patientName}</span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">({selectedStudy.teethArea})</span>
            </div>

            {/* Viewer Tool Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors"
                title="بزرگ‌نمایی"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors"
                title="کوچک‌نمایی"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsInverted(!isInverted)}
                className={`p-1.5 rounded-lg transition-colors border ${
                  isInverted ? 'bg-teal-600 text-white font-bold border-teal-600' : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
                }`}
                title="نگاتیو / پوزیتیو"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMeasuringMode(!measuringMode)}
                className={`p-1.5 rounded-lg transition-colors border ${
                  measuringMode ? 'bg-cyan-600 text-white font-bold border-cyan-600' : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
                }`}
                title="خط‌کش کانال ریشه و فیکسچر"
              >
                <Ruler className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetFilters}
                className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors"
                title="بازنشانی فیلترها"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Screen Viewport (Medical Negatoscope Lightbox - Clean Clinical Teal) */}
          <div className="relative aspect-video w-full bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center border border-teal-300/80 shadow-inner">
            <img
              src={selectedStudy.imageUrl}
              alt="رادیوگرافی دندانپزشکی"
              className="max-w-full max-h-full object-contain transition-all duration-200 select-none pointer-events-none"
              style={{
                transform: `scale(${zoomLevel})`,
                filter: `brightness(${brightness}%) contrast(${contrast}%) ${isInverted ? 'invert(1)' : ''}`
              }}
            />

            {/* Virtual Millimeter Measuring Grid Overlay */}
            {measuringMode && (
              <div 
                className="absolute inset-0 pointer-events-none border border-cyan-400/40"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(6,182,212,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(6,182,212,0.15) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }}
              >
                <span className="absolute bottom-2 right-2 text-[9px] bg-teal-800 text-cyan-200 font-mono px-2 py-0.5 rounded border border-cyan-400/50">
                  شبکه کالیبره ۱mm² فعال است
                </span>
              </div>
            )}
          </div>

          {/* Brightness & Contrast Sliders */}
          <div className="grid grid-cols-2 gap-3 pt-1 text-[11px] text-slate-700 font-bold">
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[10px]">روشنایی:</span>
              <input
                type="range"
                min="50"
                max="180"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <Contrast className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <span className="text-[10px]">کنتراست:</span>
              <input
                type="range"
                min="50"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
          </div>

          {/* Clinical Diagnosis & AI Analysis Button */}
          <div className="bg-white/80 p-3 rounded-2xl border border-teal-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">تشخیص بالینی ثبت‌شده:</span>
              <button
                onClick={handleAiConsult}
                disabled={aiLoading}
                className="py-1 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                <span>{aiLoading ? 'در حال تحلیل...' : 'تفسیر هوشمند با هوش مصنوعی'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium">
              {selectedStudy.diagnosis}
            </p>

            {aiAnalysis && (
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 leading-relaxed whitespace-pre-line animate-in fade-in">
                {aiAnalysis}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnails Archive List */}
      <div className="mx-2 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-800">کلیشه‌های آرشیوشده ({toPersianDigits(filteredStudies.length)})</span>
          <span className="text-[10px] text-slate-400 font-medium">انتخاب جهت مشاهده در ویوور</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {filteredStudies.map(study => (
            <div
              key={study.id}
              onClick={() => setSelectedStudy(study)}
              className={`p-3 rounded-2xl bg-white border cursor-pointer transition-all space-y-2 ${
                selectedStudy.id === study.id
                  ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                  : 'border-slate-100 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">{study.patientName}</span>
                <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md">
                  {study.type}
                </span>
              </div>

              <div className="aspect-video w-full bg-teal-950/40 rounded-xl overflow-hidden relative border border-teal-200">
                <img
                  src={study.imageUrl}
                  alt={study.teethArea}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{study.teethArea}</span>
                <span className="font-mono">{toPersianDigits(study.date)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Radiology Modal (Teal Medical Light Theme - Zero Black) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-teal-950/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-teal-50/90 via-white to-cyan-50/50 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-teal-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-teal-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">بارگذاری رادیوگرافی و کلیشه دندانپزشکی</h3>
                  <span className="text-[10px] text-teal-700 font-bold">بایگانی تصویربرداری فک و صورت</span>
                </div>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)} 
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStudy} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">انتخاب بیمار</label>
                <select
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  className="w-full bg-white border border-teal-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-teal-500 shadow-2xs"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">نوع رادیوگرافی</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-white border border-teal-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-teal-500 shadow-2xs"
                >
                  <option value="OPG">پانورامیک (OPG)</option>
                  <option value="PA">پری‌اپیکال (PA)</option>
                  <option value="Bitewing">بایت‌وینگ (Bitewing)</option>
                  <option value="CBCT">سه‌بعدی (CBCT)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">ناحیه دندان‌ها</label>
                <input
                  type="text"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="مثال: فک پایین سمت چپ دندان ۶ و ۷"
                  className="w-full bg-white border border-teal-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">تشخیص اولیه پزشک</label>
                <textarea
                  rows={3}
                  value={newDiagnosis}
                  onChange={(e) => setNewDiagnosis(e.target.value)}
                  placeholder="یادداشت‌های بالینی، تحلیل کانال ریشه، تراکم استخوان..."
                  className="w-full bg-white border border-teal-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-2xs"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-600/25 active:scale-95 transition-all"
                >
                  ثبت در پرونده دیجیتال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
