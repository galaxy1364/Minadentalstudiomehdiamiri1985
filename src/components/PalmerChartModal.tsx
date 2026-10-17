import React, { useState } from 'react';
import { X, Check, Layers, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { ToothSurface, TreatmentType } from '../types/dental';
import { formatToman } from '../utils/jalali';

interface PalmerChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  onSaveTreatment: (treatmentData: {
    quadrant: 'UR' | 'UL' | 'LL' | 'LR';
    toothNumber: number;
    surfaces: ToothSurface[];
    treatment: TreatmentType;
    cost: number;
    notes: string;
  }) => void;
}

export const PalmerChartModal: React.FC<PalmerChartModalProps> = ({
  isOpen,
  onClose,
  patientName,
  onSaveTreatment
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<'UR' | 'UL' | 'LL' | 'LR'>('UR');
  const [selectedTooth, setSelectedTooth] = useState<number>(6);
  const [selectedSurfaces, setSelectedSurfaces] = useState<ToothSurface[]>(['occlusal', 'mesial']);
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentType>('composite');
  const [treatmentCost, setTreatmentCost] = useState<number>(2400000);
  const [treatmentNotes, setTreatmentNotes] = useState<string>('ترمیم ۲ سطحی کامپوزیت خلفی همرنگ');

  if (!isOpen) return null;

  const toggleSurface = (surface: ToothSurface) => {
    if (selectedSurfaces.includes(surface)) {
      setSelectedSurfaces(selectedSurfaces.filter(s => s !== surface));
    } else {
      setSelectedSurfaces([...selectedSurfaces, surface]);
    }
  };

  const handleTreatmentChange = (t: TreatmentType) => {
    setSelectedTreatment(t);
    switch (t) {
      case 'composite':
        setTreatmentCost(2400000);
        setTreatmentNotes('ترمیم کامپوزیت نانوهیبرید');
        break;
      case 'amalgam':
        setTreatmentCost(1800000);
        setTreatmentNotes('ترمیم آمالگام سیلور');
        break;
      case 'endo':
        setTreatmentCost(4800000);
        setTreatmentNotes('درمان ریشه (روت‌کانال ۳ کانال)');
        break;
      case 'crown_zirconia':
        setTreatmentCost(6500000);
        setTreatmentNotes('روکش زیرکونیا مولتی‌لیر');
        break;
      case 'crown_pfm':
        setTreatmentCost(4200000);
        setTreatmentNotes('روکش پرسلن متال PFM');
        break;
      case 'laminate':
        setTreatmentCost(8500000);
        setTreatmentNotes('لمینت سرامیکی ایمکس زیبایی');
        break;
      case 'implant':
        setTreatmentCost(18000000);
        setTreatmentNotes('کاشت فیکسچر ایمپلنت کره‌ای');
        break;
      case 'extraction':
        setTreatmentCost(1200000);
        setTreatmentNotes('کشیدن دندان / جراحی نسج نرم');
        break;
      case 'scaling':
        setTreatmentCost(1600000);
        setTreatmentNotes('جرم‌گیری کامل ۲ فک');
        break;
      case 'bleaching':
        setTreatmentCost(7000000);
        setTreatmentNotes('بلیچینگ آفیس دو فک');
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTreatment({
      quadrant: selectedQuadrant,
      toothNumber: selectedTooth,
      surfaces: selectedSurfaces,
      treatment: selectedTreatment,
      cost: treatmentCost,
      notes: treatmentNotes
    });
    onClose();
  };

  const getQuadrantLabel = (q: 'UR' | 'UL' | 'LL' | 'LR') => {
    switch (q) {
      case 'UR': return 'بالا راست (UR)';
      case 'UL': return 'بالا چپ (UL)';
      case 'LL': return 'پایین چپ (LL)';
      case 'LR': return 'پایین راست (LR)';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-emerald-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-gradient-to-b from-emerald-50/80 via-white to-teal-50/30 text-slate-900 rounded-t-[32px] sm:rounded-[32px] border border-emerald-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header (Clean Emerald Themed - Zero Black) */}
        <div className="p-4 border-b border-emerald-200/80 flex items-center justify-between bg-gradient-to-r from-emerald-100/90 via-white to-teal-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">چارت پالمر و انتخاب آناتومیک سطوح</h3>
              <p className="text-[11px] text-emerald-800 font-bold">پرونده درمانی: {patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar bg-white">

          {/* Palmer Grid Selection (4 Quadrants) */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">سیستم شماره‌گذاری پالمر (Palmer Notation)</span>
              <span className="text-[11px] text-emerald-700 font-mono font-bold bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                {selectedQuadrant} - دندان {selectedTooth}
              </span>
            </div>

            {/* Palmer Cross Grid */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs select-none">
              {/* Upper Right Quadrant */}
              <div 
                onClick={() => setSelectedQuadrant('UR')}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedQuadrant === 'UR' ? 'border-emerald-500 bg-emerald-50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="text-[10px] text-slate-500 font-bold mb-1">بالا راست (UR)</div>
                <div className="flex items-center justify-center gap-1 flex-wrap" dir="ltr">
                  {[8, 7, 6, 5, 4, 3, 2, 1].map(num => (
                    <button
                      key={`ur-${num}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedQuadrant('UR'); setSelectedTooth(num); }}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${selectedQuadrant === 'UR' && selectedTooth === num ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upper Left Quadrant */}
              <div 
                onClick={() => setSelectedQuadrant('UL')}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedQuadrant === 'UL' ? 'border-emerald-500 bg-emerald-50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="text-[10px] text-slate-500 font-bold mb-1">بالا چپ (UL)</div>
                <div className="flex items-center justify-center gap-1 flex-wrap" dir="ltr">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <button
                      key={`ul-${num}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedQuadrant('UL'); setSelectedTooth(num); }}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${selectedQuadrant === 'UL' && selectedTooth === num ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lower Right Quadrant */}
              <div 
                onClick={() => setSelectedQuadrant('LR')}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedQuadrant === 'LR' ? 'border-emerald-500 bg-emerald-50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="text-[10px] text-slate-500 font-bold mb-1">پایین راست (LR)</div>
                <div className="flex items-center justify-center gap-1 flex-wrap" dir="ltr">
                  {[8, 7, 6, 5, 4, 3, 2, 1].map(num => (
                    <button
                      key={`lr-${num}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedQuadrant('LR'); setSelectedTooth(num); }}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${selectedQuadrant === 'LR' && selectedTooth === num ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lower Left Quadrant */}
              <div 
                onClick={() => setSelectedQuadrant('LL')}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedQuadrant === 'LL' ? 'border-emerald-500 bg-emerald-50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="text-[10px] text-slate-500 font-bold mb-1">پایین چپ (LL)</div>
                <div className="flex items-center justify-center gap-1 flex-wrap" dir="ltr">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <button
                      key={`ll-${num}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedQuadrant('LL'); setSelectedTooth(num); }}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${selectedQuadrant === 'LL' && selectedTooth === num ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3D / Isometric Tooth Surface Selector */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col items-center shadow-2xs">
            <div className="w-full flex items-center justify-between mb-3 text-xs">
              <span className="font-black text-slate-900">انتخاب سطوح دندان ({getQuadrantLabel(selectedQuadrant)} دندان {selectedTooth})</span>
              <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full border border-emerald-300">لمس سطوح برای فعال‌سازی</span>
            </div>

            {/* Isometric / Anatomical 3D Surface Interactive Map */}
            <div className="relative w-48 h-48 flex items-center justify-center my-2">
              <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 200 200">
                {/* Background Tooth Outline */}
                <circle cx="100" cy="100" r="88" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2.5" />

                {/* Buccal / Facial (Top Trapezoid) */}
                <polygon
                  points="35,35 165,35 135,65 65,65"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('buccal')
                      ? 'fill-emerald-600 stroke-emerald-800 stroke-2'
                      : 'fill-slate-200 hover:fill-slate-300 stroke-slate-300'
                  }`}
                  onClick={() => toggleSurface('buccal')}
                />
                <text x="100" y="52" textAnchor="middle" className={`text-[10px] font-bold pointer-events-none ${selectedSurfaces.includes('buccal') ? 'fill-white' : 'fill-slate-700'}`}>
                  باکال (B)
                </text>

                {/* Lingual / Palatal (Bottom Trapezoid) */}
                <polygon
                  points="65,135 135,135 165,165 35,165"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('lingual')
                      ? 'fill-emerald-600 stroke-emerald-800 stroke-2'
                      : 'fill-slate-200 hover:fill-slate-300 stroke-slate-300'
                  }`}
                  onClick={() => toggleSurface('lingual')}
                />
                <text x="100" y="152" textAnchor="middle" className={`text-[10px] font-bold pointer-events-none ${selectedSurfaces.includes('lingual') ? 'fill-white' : 'fill-slate-700'}`}>
                  لینگوال (L)
                </text>

                {/* Mesial (Right Trapezoid in RTL / Left side) */}
                <polygon
                  points="35,35 65,65 65,135 35,165"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('mesial')
                      ? 'fill-emerald-600 stroke-emerald-800 stroke-2'
                      : 'fill-slate-200 hover:fill-slate-300 stroke-slate-300'
                  }`}
                  onClick={() => toggleSurface('mesial')}
                />
                <text x="50" y="103" textAnchor="middle" className={`text-[10px] font-bold pointer-events-none ${selectedSurfaces.includes('mesial') ? 'fill-white' : 'fill-slate-700'}`}>
                  مزیال (M)
                </text>

                {/* Distal (Left Trapezoid in RTL / Right side) */}
                <polygon
                  points="135,65 165,35 165,165 135,135"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('distal')
                      ? 'fill-emerald-600 stroke-emerald-800 stroke-2'
                      : 'fill-slate-200 hover:fill-slate-300 stroke-slate-300'
                  }`}
                  onClick={() => toggleSurface('distal')}
                />
                <text x="150" y="103" textAnchor="middle" className={`text-[10px] font-bold pointer-events-none ${selectedSurfaces.includes('distal') ? 'fill-white' : 'fill-slate-700'}`}>
                  دیستال (D)
                </text>

                {/* Occlusal / Incisal (Center Square) */}
                <polygon
                  points="65,65 135,65 135,135 65,135"
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSurfaces.includes('occlusal')
                      ? 'fill-emerald-600 stroke-emerald-800 stroke-2'
                      : 'fill-slate-300 hover:fill-slate-400 stroke-slate-400'
                  }`}
                  onClick={() => toggleSurface('occlusal')}
                />
                <text x="100" y="104" textAnchor="middle" className={`text-[11px] font-black pointer-events-none ${selectedSurfaces.includes('occlusal') ? 'fill-white' : 'fill-slate-800'}`}>
                  اوکلوزال (O)
                </text>
              </svg>
            </div>

            {/* Root Canal Button */}
            <button
              onClick={() => toggleSurface('rootCanal')}
              className={`mt-2 py-1.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                selectedSurfaces.includes('rootCanal')
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>ریشه و کانال‌های اندو (Root Canals)</span>
              {selectedSurfaces.includes('rootCanal') && <Check className="w-3.5 h-3.5 text-amber-600" />}
            </button>

            {/* Active surfaces pill indicator */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center text-[11px]">
              <span className="text-slate-500 font-bold">سطوح فعال:</span>
              {selectedSurfaces.length === 0 ? (
                <span className="text-red-500 font-bold">هیچ سطحی انتخاب نشده</span>
              ) : (
                selectedSurfaces.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold">
                    {s.toUpperCase()}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Treatment Type Selector */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
            <span className="text-xs font-bold text-slate-800 block mb-2">نوع اقدام و درمان</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'composite', label: 'ترمیم کامپوزیت' },
                { id: 'amalgam', label: 'ترمیم آمالگام' },
                { id: 'endo', label: 'عصب‌کشی (اندو)' },
                { id: 'crown_zirconia', label: 'روکش زیرکونیا' },
                { id: 'crown_pfm', label: 'روکش PFM' },
                { id: 'laminate', label: 'لمینت سرامیکی' },
                { id: 'implant', label: 'کاشت ایمپلنت' },
                { id: 'extraction', label: 'کشیدن دندان' },
                { id: 'scaling', label: 'جرم‌گیری' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTreatmentChange(t.id as TreatmentType)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                    selectedTreatment === t.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cost & Clinical Notes */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">تعرفه و هزینه درمان (تومان)</label>
              <input
                type="number"
                value={treatmentCost}
                onChange={(e) => setTreatmentCost(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none shadow-2xs"
              />
              <span className="text-[10.5px] text-emerald-700 font-bold mt-1 block">معادل: {formatToman(treatmentCost)}</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">یادداشت تخصصی دندانپزشک</label>
              <input
                type="text"
                value={treatmentNotes}
                onChange={(e) => setTreatmentNotes(e.target.value)}
                placeholder="توضیحات تشخیصی، متریال یا وضعیت کانال‌ها..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs focus:border-emerald-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
          >
            انصراف
          </button>
          
          <button
            onClick={handleSubmit}
            className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-[0.98] transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-white stroke-[2.5]" />
            <span>ثبت نهایی در پرونده و چارت</span>
          </button>
        </div>

      </div>
    </div>
  );
};
