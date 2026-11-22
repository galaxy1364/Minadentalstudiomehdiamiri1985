import React, { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  ScanLine, SunMedium, Contrast, Sparkles, 
  Upload, CheckCircle2, Search, X,
  ChevronDown, ChevronUp, Trash2, SlidersHorizontal, FolderOpen, Camera,
  Box, BellRing, Layers, ZoomIn, RotateCcw, Edit3, Save
} from 'lucide-react';
import { Patient, ImplantCase, LabOrder } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, getCurrentPersianDate } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { syncEngine } from '../../services/syncEngine';
import { actionFeedback } from '../../utils/actionFeedback';
import { scheduleEntityReminder } from '../../services/reminderNotificationService';
import { Implant3DSurgicalPlannerD3 } from '../Implant3DSurgicalPlannerD3';
import { Lab3DModelViewerD3 } from '../Lab3DModelViewerD3';

interface XRayModuleViewProps {
  patients: Patient[];
  onOpenPatientFile?: (patient: Patient, tab?: any) => void;
}

export interface XRayRecord {
  id: string;
  patientId?: string;
  patientName: string;
  modality: 'OPG (پانورامیک)' | 'CBCT (سه‌بعدی ایمپلنت)' | 'پری‌اپیکال (RVG تک‌دندان)' | 'سفالومتری لترال';
  region: string;
  date: string;
  doctorName: string;
  aiFindings: string;
  boneDensity: string;
  imageDataUrl?: string;
}

export const XRAY_STORAGE_KEY = 'minadental_xray_records_v1';

export const XRayModuleView: React.FC<XRayModuleViewProps> = ({ patients, onOpenPatientFile }) => {
  const { selection, impactLight, success } = useHapticFeedback();
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [brightness, setBrightness] = useState<number>(105);
  const [contrast, setContrast] = useState<number>(115);
  const [invertMode, setInvertMode] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 1.5 | 2>(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingFindingsId, setEditingFindingsId] = useState<string | null>(null);
  const [editingFindingsText, setEditingFindingsText] = useState<string>('');

  // New Study Form State
  const [formPatientId, setFormPatientId] = useState<string>(patients[0]?.id || '');
  const [formModality, setFormModality] = useState<XRayRecord['modality']>('OPG (پانورامیک)');
  const [formRegion, setFormRegion] = useState<string>('بررسی کلی فک بالا و پایین');
  const [formBoneDensity, setFormBoneDensity] = useState<string>('تراکم استخوان تیپ D2 (مطلوب)');
  const [formFindings, setFormFindings] = useState<string>('');
  const [formImageDataUrl, setFormImageDataUrl] = useState<string | undefined>(undefined);

  const defaultRecords: XRayRecord[] = [
    {
      id: 'xr-1',
      patientId: patients[0]?.id,
      patientName: patients[0]?.fullName || 'سارا رادمهر',
      modality: 'CBCT (سه‌بعدی ایمپلنت)',
      region: 'کوادرات بالا راست (UR6 - سینوس ماگزیلا)',
      date: getCurrentPersianDate(),
      doctorName: 'دکتر مهدی امیری',
      aiFindings: 'ارتفاع استخوان کرستال تا کف سینوس: ۹.۵ میلی‌متر · عرض ریج: ۶.۸ میلی‌متر · مناسب کاشت فیکسچر اشترومن 4.1x10mm بدون نیاز به سینوس‌لیفت باز.',
      boneDensity: 'تراکم استخوان تیپ D2 (مطلوب)'
    },
    {
      id: 'xr-2',
      patientId: patients[1]?.id,
      patientName: patients[1]?.fullName || 'امیرحسین محمدی',
      modality: 'OPG (پانورامیک)',
      region: 'فک کامل دوطرفه (Full Arch)',
      date: '۱۴۰۵/۰۸/۱۲',
      doctorName: 'دکتر مهدی امیری',
      aiFindings: 'ضایعه پری‌اپیکال در ریشه دیستال دندان LL6 · نهفتگی کامل دندان عقل پایین چپ (LL8) در مجاورت کانال مندیبولار.',
      boneDensity: 'تراکم استخوان تیپ D2-D3'
    },
    {
      id: 'xr-3',
      patientId: patients[2]?.id,
      patientName: patients[2]?.fullName || 'فاطمه رضایی',
      modality: 'پری‌اپیکال (RVG تک‌دندان)',
      region: 'دندان UL5 (کنترل طول کانال اندو)',
      date: '۱۴۰۵/۰۸/۱۰',
      doctorName: 'دکتر علی مرادی',
      aiFindings: 'سیل کامل کانال ریشه با گوتاپرکا تا ۰.۵ میلی‌متری اپکس رادیوگرافیک (تایید استاندارد طول کارکرد).',
      boneDensity: 'لامینا دورا سالم'
    }
  ];

  const [records, setRecords] = useState<XRayRecord[]>(() => {
    try {
      const saved = localStorage.getItem(XRAY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultRecords;
  });

  const [activeRecordId, setActiveRecordId] = useState<string>(() => records[0]?.id || 'xr-1');

  useEffect(() => {
    try {
      localStorage.setItem(XRAY_STORAGE_KEY, JSON.stringify(records));
    } catch {}
  }, [records]);

  useEffect(() => {
    const handleExternalSync = () => {
      try {
        const saved = localStorage.getItem(XRAY_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecords(parsed);
          }
        }
      } catch {}
    };
    window.addEventListener('minadental:xray-records-updated', handleExternalSync);
    return () => window.removeEventListener('minadental:xray-records-updated', handleExternalSync);
  }, []);

  const activeRecord = records.find(r => r.id === activeRecordId) || records[0];

  const resolvePatient = (rec: XRayRecord): Patient | undefined =>
    patients.find((p) => (rec.patientId && p.id === rec.patientId) || p.fullName === rec.patientName);

  const handleAttachXrayPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxSide = 720;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        canvas.width = Math.max(1, Math.round((img.naturalWidth || 400) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || 300) * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFormImageDataUrl(canvas.toDataURL('image/jpeg', 0.78));
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const handleUploadNew = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetPat = patients.find(p => p.id === formPatientId) || patients[0];
    const newRec: XRayRecord = {
      id: `xr-${Date.now()}`,
      patientId: targetPat?.id,
      patientName: targetPat?.fullName || 'مراجع کلینیک',
      modality: formModality,
      region: formRegion.trim() || 'بررسی کلی فک بالا و پایین',
      date: getCurrentPersianDate(),
      doctorName: 'دکتر مهدی امیری',
      aiFindings: formFindings.trim() || `آنالیز دیجیتال ${formModality} برای ناحیه «${formRegion.trim() || 'فک'}» انجام شد: بررسی تراکم استخوانی و وضعیت پری‌اپیکال در آرشیو ذخیره گردید.`,
      boneDensity: formBoneDensity || (formModality.includes('CBCT') ? 'تراکم استخوان تیپ D2 (مناسب ایمپلنت)' : 'تراکم استخوان تیپ D2'),
      imageDataUrl: formImageDataUrl
    };
    const nextRecords = [newRec, ...records];
    setRecords(nextRecords);
    try {
      localStorage.setItem(XRAY_STORAGE_KEY, JSON.stringify(nextRecords));
      window.dispatchEvent(new CustomEvent('minadental:xray-records-updated'));
    } catch {}
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'patient',
      action: 'UPSERT',
      payload: { module: 'xray_pacs', recordId: newRec.id, patientId: newRec.patientId },
      actorName: 'دکتر مهدی امیری',
      actorRole: 'doctor',
      platform: 'PACS Radiology',
      eventType: 'TREATMENT_REGISTERED',
      title: `ثبت کلیشه رادیوگرافی (${newRec.modality})`,
      description: `گرافی جدید برای بیمار «${newRec.patientName}» (${newRec.region}) ثبت و همگام‌سازی شد.`
    });
    actionFeedback.recordSuccess({
      title: `گرافی ${newRec.modality} ثبت شد`,
      subtitle: `پرونده: ${newRec.patientName} · ناحیه: ${newRec.region}`,
      canUndo: false
    });
    setActiveRecordId(newRec.id);
    setFormFindings('');
    setFormImageDataUrl(undefined);
    setShowNewForm(false);
    success();
    setToastMsg(`گرافی جدید برای «${newRec.patientName}» در آرشیو PACS کلینیک ثبت و آنالیز شد.`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSaveEditedFindings = (id: string) => {
    const trimmed = editingFindingsText.trim();
    if (!trimmed) return;
    const next = records.map(r => (r.id === id ? { ...r, aiFindings: trimmed } : r));
    setRecords(next);
    try {
      localStorage.setItem(XRAY_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('minadental:xray-records-updated'));
    } catch {}
    setEditingFindingsId(null);
    success();
    setToastMsg('گزارش تشخیصی رادیوگرافی با موفقیت به‌روزرسانی و در آرشیو PACS ذخیره شد.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (records.length <= 1) return;
    if (confirmDeleteId !== id) {
      impactLight();
      setConfirmDeleteId(id);
      return;
    }
    impactLight();
    const next = records.filter(r => r.id !== id);
    setRecords(next);
    setConfirmDeleteId(null);
    try {
      localStorage.setItem(XRAY_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('minadental:xray-records-updated'));
    } catch {}
    if (activeRecordId === id && next[0]) {
      setActiveRecordId(next[0].id);
    }
    setToastMsg('کلیشه رادیولوژی از آرشیو حذف شد.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const normalizeXray = (val?: string) =>
    toEnglishDigits(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();

  const extractToothFromRegion = (region: string): string => {
    const match = region.match(/\b(UR|UL|LR|LL)[1-8]\b/i);
    return match ? match[0].toUpperCase() : 'UR6';
  };

  const handleScheduleXrayReminder = (rec: XRayRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    impactLight();
    const matchedPat = resolvePatient(rec);
    const toothCode = extractToothFromRegion(rec.region);
    scheduleEntityReminder({
      sourceType: rec.modality.includes('CBCT') ? 'implant' : 'treatment',
      sourceId: rec.id,
      patientId: matchedPat?.id || rec.patientId,
      patientName: rec.patientName,
      patientPhone: matchedPat?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      title: `پیگیری گرافی ${rec.modality} (${rec.patientName} - دندان ${toothCode})`,
      description: `${rec.region} · ${rec.boneDensity} · پزشک: ${rec.doctorName}`,
      targetDate: rec.date || getCurrentPersianDate(),
      targetTime: '۱۰:۰۰',
      targetView: 'xrays',
      config: {
        enabled: true,
        preset: '1d_before',
        channels: ['in_app', 'phone_push', 'sms'],
        note: `کنترل رادیوگرافی و طرح درمان ${toothCode}`
      }
    });
    success();
    setToastMsg(`یادآور هوشمند پیگیری گرافی «${rec.patientName}» (${rec.region}) در مرکز یادآورها ثبت شد.`);
    setTimeout(() => setToastMsg(null), 3200);
  };

  // D3.js Cross-Sectional Hounsfield Unit (HU) Bone Density Profile for active radiograph
  const huProfileData = useMemo(() => {
    const isD1 = activeRecord?.boneDensity.includes('D1');
    const isD3 = activeRecord?.boneDensity.includes('D3');
    const baseCortical = isD1 ? 1320 : isD3 ? 880 : 1140;
    const baseTrabecular = isD1 ? 920 : isD3 ? 460 : 720;
    const points = [
      { depthMm: 0, hu: baseCortical * 0.85, zone: 'کرست کورتیکال' },
      { depthMm: 1.5, hu: baseCortical, zone: 'پلیت کورتیکال' },
      { depthMm: 3.0, hu: baseTrabecular * 1.15, zone: 'ترابکولار فوقانی' },
      { depthMm: 5.0, hu: baseTrabecular, zone: 'مرکز استخوان اسفنجی' },
      { depthMm: 7.5, hu: baseTrabecular * 0.94, zone: 'ترابکولار میانی' },
      { depthMm: 9.5, hu: baseTrabecular * 0.82, zone: 'مرز ایمن اپیکال' },
      { depthMm: 11.5, hu: 240, zone: 'حاشیه کانال عصب / سینوس' }
    ];
    const width = 340;
    const height = 88;
    const xScale = d3.scaleLinear().domain([0, 11.5]).range([28, width - 14]);
    const yScale = d3.scaleLinear().domain([0, 1450]).range([height - 18, 10]);
    const lineGen = d3
      .line<{ depthMm: number; hu: number }>()
      .x((d) => xScale(d.depthMm))
      .y((d) => yScale(d.hu))
      .curve(d3.curveMonotoneX);
    const areaGen = d3
      .area<{ depthMm: number; hu: number }>()
      .x((d) => xScale(d.depthMm))
      .y0(height - 18)
      .y1((d) => yScale(d.hu))
      .curve(d3.curveMonotoneX);
    return {
      points,
      width,
      height,
      xScale,
      yScale,
      linePath: lineGen(points) || '',
      areaPath: areaGen(points) || '',
      meanHu: Math.round(d3.mean(points, (p) => p.hu) || 780)
    };
  }, [activeRecord]);

  const filteredRecords = records.filter(r => {
    const q = normalizeXray(searchQuery);
    const matchesSearch =
      !q ||
      normalizeXray(r.patientName).includes(q) ||
      normalizeXray(r.region).includes(q) ||
      normalizeXray(r.modality).includes(q);
    if (!matchesSearch) return false;
    if (selectedModality === 'all' || selectedModality === 'cbct3d') return true;
    return r.modality.includes(selectedModality);
  });

  return (
    <div dir="rtl" className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3 select-none">
      {toastMsg && (
        <div className="fixed top-14 left-4 right-4 z-50 max-w-md mx-auto bg-cyan-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-cyan-400 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Module Header Card with Animated Search & Horizontal Scrollable Chips */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('cyan')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-cyan-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-cyan-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <ScanLine className="w-4 h-4 stroke-[2.25]" />
              </div>
              <div className="text-right min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">رادیولوژی دیجیتال OPG، RVG و CBCT</h3>
                <span className="text-[10.5px] font-bold text-cyan-800 mt-1 block truncate">نگاتوسکوپ هوشمند و آنالیز تراکم استخوان ایمپلنت</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-cyan-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجو در آرشیو گرافی‌ها"
                aria-label="جستجو در آرشیو گرافی‌ها"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setShowNewForm(prev => !prev);
                }}
                className="min-h-[40px] px-3 rounded-[12px] bg-gradient-to-l from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white text-xs font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{showNewForm ? 'بستن فرم' : 'ثبت گرافی'}</span>
              </button>
            </div>
          </div>

          {showNewForm && (
            <form onSubmit={handleUploadNew} className="my-2 bg-cyan-50/80 border border-cyan-200 rounded-2xl p-3 space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">بیمار</label>
                  <select
                    aria-label="انتخاب بیمار برای گرافی"
                    value={formPatientId}
                    onChange={(e) => setFormPatientId(e.target.value)}
                    className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">نوع تصویربرداری</label>
                  <select
                    aria-label="نوع تصویربرداری"
                    value={formModality}
                    onChange={(e) => setFormModality(e.target.value as XRayRecord['modality'])}
                    className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  >
                    <option value="OPG (پانورامیک)">OPG (پانورامیک)</option>
                    <option value="CBCT (سه‌بعدی ایمپلنت)">CBCT (سه‌بعدی ایمپلنت)</option>
                    <option value="پری‌اپیکال (RVG تک‌دندان)">پری‌اپیکال (RVG تک‌دندان)</option>
                    <option value="سفالومتری لترال">سفالومتری لترال</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">ناحیه فک / دندان</label>
                  <input
                    aria-label="ناحیه فک یا دندان"
                    type="text"
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    placeholder="مثلاً: UR6 ایمپلنت"
                    className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">تراکم استخوان (Misch)</label>
                  <select
                    aria-label="تراکم استخوان گرافی"
                    value={formBoneDensity}
                    onChange={(e) => setFormBoneDensity(e.target.value)}
                    className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  >
                    <option value="تراکم استخوان تیپ D1 (کورتیکال متراکم)">تیپ D1 (کورتیکال متراکم)</option>
                    <option value="تراکم استخوان تیپ D2 (مطلوب)">تیپ D2 (مطلوب ایمپلنت)</option>
                    <option value="تراکم استخوان تیپ D3 (متوسط اسفنجی)">تیپ D3 (متوسط اسفنجی)</option>
                    <option value="تراکم استخوان تیپ D4 (نیاز به سینوس‌لیفت/پیوند)">تیپ D4 (تراکم پایین)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">گزارش تشخیصی پزشک (اختیاری)</label>
                  <input
                    aria-label="گزارش تشخیصی رادیوگرافی"
                    type="text"
                    value={formFindings}
                    onChange={(e) => setFormFindings(e.target.value)}
                    placeholder="مثلاً: ارتفاع استخوان ۱۰ میلی‌متر، لامینا دورا سالم..."
                    className="w-full bg-white border border-cyan-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-white border border-cyan-300 text-cyan-900 font-black flex items-center gap-1.5 cursor-pointer hover:bg-cyan-100/50">
                  <Camera className="w-3.5 h-3.5 text-cyan-600" />
                  <span>{formImageDataUrl ? 'تصویر گرافی پیوست شد ✓ (تغییر)' : 'عکسبرداری با دوربین / پیوست کلیشه OPG'}</span>
                  <input aria-label="بارگذاری یا عکسبرداری کلیشه رادیوگرافی" type="file" accept="image/*" capture="environment" onChange={handleAttachXrayPhoto} className="hidden" />
                </label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setShowNewForm(false)} className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold cursor-pointer">انصراف</button>
                  <button type="submit" className="px-4 py-1 rounded-xl bg-cyan-600 text-white font-black cursor-pointer">ثبت و آنالیز در PACS</button>
                </div>
              </div>
            </form>
          )}

          {/* Animated Expandable Search Bar */}
          {searchOpen && (
            <div className="relative animate-in slide-in-from-top-1 duration-150">
              <Search className="w-3.5 h-3.5 text-cyan-600 absolute right-3 top-2.5" />
              <input
                aria-label="جستجو در کلیشه‌های رادیولوژی"
                type="text"
                autoFocus
                placeholder="جستجوی نام بیمار، ناحیه فک یا نوع گرافی..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-cyan-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="پاک کردن جستجوی رادیولوژی"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Horizontal Scrollable Chip Bar */}
          <div role="tablist" aria-label="بخش‌های ماژول" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: `همه گرافی‌ها (${toPersianDigits(records.length)})` },
              { id: 'OPG', label: 'پانورامیک OPG' },
              { id: 'CBCT', label: 'سه‌بعدی CBCT ایمپلنت' },
              { id: 'RVG', label: 'تک‌دندان RVG' },
              { id: 'cbct3d', label: 'استودیو سه‌بعدی CBCT و اسکن (3D)' }
            ].map((tab, idx) => {
              const isActive = selectedModality === tab.id;
              return (
                <button role="tab" aria-selected={isActive}
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setSelectedModality(tab.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${getUnifiedChipClasses(idx + 3, isActive)}`}
                >
                  {tab.id === 'cbct3d' && <Box className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3D CBCT Surgical Planner & Intraoral CAD/CAM Superimposition Studio */}
      {selectedModality === 'cbct3d' && activeRecord && (() => {
        const matchedPat = resolvePatient(activeRecord) || patients[0];
        const extractedTooth = extractToothFromRegion(activeRecord.region);
        const fallbackImplantCase: ImplantCase = {
          id: `imp-cbct-${activeRecord.id}`,
          patientId: matchedPat?.id || 'pat-1',
          patientName: activeRecord.patientName,
          toothNumber: `دندان ${extractedTooth}`,
          brand: 'Straumann BLX (سوئیس)',
          diameter: '4.1 mm',
          length: '10 mm',
          torque: 40,
          boneGraft: activeRecord.boneDensity.includes('D3') || activeRecord.boneDensity.includes('D4'),
          membrane: activeRecord.boneDensity.includes('D3') || activeRecord.boneDensity.includes('D4'),
          surgeryDate: activeRecord.date || getCurrentPersianDate(),
          healingDueDate: activeRecord.date || getCurrentPersianDate(),
          doctorName: activeRecord.doctorName || 'دکتر مهدی امیری',
          currentStage: 'fixture_placed',
          boneDensity: (activeRecord.boneDensity.includes('D1')
            ? 'D1'
            : activeRecord.boneDensity.includes('D3')
            ? 'D3'
            : 'D2') as 'D1' | 'D2' | 'D3' | 'D4',
          notes: activeRecord.aiFindings
        };
        const fallbackLabOrder: LabOrder = {
          id: `lab-cbct-${activeRecord.id}`,
          patientId: matchedPat?.id || 'pat-1',
          patientName: activeRecord.patientName,
          toothNumber: `دندان ${extractedTooth}`,
          workType: 'روکش زیرکونیا فول‌آناتومیک روی ایمپلنت',
          labName: 'لابراتوار دیجیتال پارس (CAD/CAM)',
          shade: 'A2',
          sendDate: activeRecord.date || getCurrentPersianDate(),
          deliveryDate: activeRecord.date || getCurrentPersianDate(),
          appointmentDate: activeRecord.date || getCurrentPersianDate(),
          status: 'fabrication',
          cost: 4200000,
          reminderNotice: 'کنترل تطابق اسکن سه‌بعدی و CBCT'
        };
        const patientImplantCases = matchedPat?.implantCases?.length
          ? matchedPat.implantCases
          : patients.flatMap((p) => p.implantCases || []);
        const resolvedImplantCases = patientImplantCases.length ? patientImplantCases : [fallbackImplantCase];

        const patientLabOrders = matchedPat?.labOrders?.length
          ? matchedPat.labOrders
          : patients.flatMap((p) => p.labOrders || []);
        const resolvedLabOrders = patientLabOrders.length ? patientLabOrders : [fallbackLabOrder];

        return (
          <div data-testid="xray-3d-cbct-studio" className="mx-2 space-y-3 animate-in fade-in duration-200">
            {/* Study Switcher Bar inside 3D Studio */}
            <div className="bg-gradient-to-br from-cyan-50 via-white to-teal-50 rounded-[22px] p-3 border border-cyan-200/90 shadow-[var(--shadow-card)] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-2xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      انطباق سه‌بعدی رادیولوژی CBCT و اسکن دهانی CAD/CAM ({activeRecord.patientName})
                    </h4>
                    <span className="text-[10.5px] font-bold text-cyan-800 block">
                      ناحیه: {activeRecord.region} · دندان هدف: {extractedTooth} · {activeRecord.boneDensity}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => handleScheduleXrayReminder(activeRecord, e)}
                    className="px-2.5 py-1.5 rounded-xl text-[10.5px] font-black bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 cursor-pointer"
                  >
                    <BellRing className="w-3.5 h-3.5 text-amber-600" />
                    <span>ثبت یادآور جراحی / پیگیری CBCT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedModality('all')}
                    className="px-2.5 py-1.5 rounded-xl text-[10.5px] font-black bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    بازگشت به نگاتوسکوپ ۲بعدی
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {records.map((rec) => {
                  const active = rec.id === activeRecord.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => {
                        selection();
                        setActiveRecordId(rec.id);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-600 text-white border-cyan-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-cyan-200 hover:bg-cyan-50'
                      }`}
                    >
                      {rec.patientName} · {extractToothFromRegion(rec.region)} ({rec.modality.split(' ')[0]})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. D3.js 3D CBCT Implant Surgical Planner */}
            <Implant3DSurgicalPlannerD3
              implantCases={resolvedImplantCases}
              patients={patients}
              onEditImplantCase={(_caseId, updated) => {
                setToastMsg(`طرح جراحی سه‌بعدی CBCT برای «${activeRecord.patientName}» (${updated.boneDensity || 'D2'}) در PACS ذخیره شد.`);
                setTimeout(() => setToastMsg(null), 3200);
              }}
            />

            {/* 2. D3.js 3D CAD/CAM Prosthetic Crown & Abutment Model Viewer */}
            <Lab3DModelViewerD3
              orders={resolvedLabOrders}
              patients={patients}
              onEditLabOrder={(_orderId, updated) => {
                setToastMsg(`تأییدیه انطباق سه‌بعدی پروتز و CBCT برای «${activeRecord.patientName}» ثبت شد (${updated.qcPassed ? 'تایید QC' : 'بروزرسانی'}).`);
                setTimeout(() => setToastMsg(null), 3200);
              }}
            />
          </div>
        );
      })()}

      {/* Digital Negatoscope Viewer (Compact on Mobile with Collapsible Diagnostic & Slider Controls) */}
      {selectedModality !== 'cbct3d' && activeRecord && (
        <div className="mx-2 bg-gradient-to-br from-cyan-50 via-white to-sky-50 rounded-[24px] p-3.5 text-slate-900 border border-cyan-200/90 shadow-[var(--shadow-card)] space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-black text-cyan-950">{activeRecord.patientName} · {activeRecord.modality}</span>
              <span className="text-[10px] text-slate-500 font-bold block">{activeRecord.region} · تاریخ: {toPersianDigits(activeRecord.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSelectedModality('cbct3d');
                }}
                className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1 cursor-pointer"
                title="شبیه‌ساز سه‌بعدی CBCT و اسکن"
              >
                <Box className="w-3 h-3" />
                <span>نمای 3D CBCT</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleScheduleXrayReminder(activeRecord, e)}
                className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 cursor-pointer"
                title="ثبت یادآور هوشمند پیگیری گرافی"
              >
                <BellRing className="w-3 h-3 text-amber-600" />
                <span>یادآور</span>
              </button>
              {onOpenPatientFile && (() => {
                const matchedPat = resolvePatient(activeRecord);
                if (!matchedPat) return null;
                return (
                  <button
                    type="button"
                    onClick={() => onOpenPatientFile(matchedPat, 'xrays')}
                    className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 cursor-pointer"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>پرونده بیمار</span>
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setZoomLevel(prev => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                  zoomLevel > 1 ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="بزرگ‌نمایی نگاتوسکوپ"
              >
                <ZoomIn className="w-3 h-3" />
                <span className="font-mono">{zoomLevel}x</span>
              </button>
              {(brightness !== 105 || contrast !== 115 || invertMode || zoomLevel !== 1) && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setBrightness(105);
                    setContrast(115);
                    setInvertMode(false);
                    setZoomLevel(1);
                  }}
                  className="px-2 py-1 rounded-xl text-[10px] font-black bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 cursor-pointer"
                  title="بازنشانی فیلترهای نگاتوسکوپ"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>ریست</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setInvertMode(!invertMode);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  invertMode ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                نگاتیو / کنتراست
              </button>
              <button
                type="button"
                onClick={() => {
                  selection();
                  setShowAdvancedControls(!showAdvancedControls);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black border flex items-center gap-1 transition-all cursor-pointer ${
                  showAdvancedControls ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-cyan-50 text-cyan-900 border-cyan-200 hover:bg-cyan-100'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>{showAdvancedControls ? 'بستن ابزارها' : 'تنظیمات و هوش مصنوعی'}</span>
                {showAdvancedControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Dental Panoramic / Uploaded Radiograph Negatoscope Film Viewport */}
          <div 
            className="relative h-36 sm:h-44 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-cyan-300/60 flex flex-col items-center justify-center overflow-hidden"
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%) ${invertMode ? 'invert(1)' : ''}`
            }}
          >
            <div className="w-full h-full flex items-center justify-center transition-transform duration-200" style={{ transform: `scale(${zoomLevel})` }}>
            {activeRecord.imageDataUrl ? (
              <img
                src={activeRecord.imageDataUrl}
                alt={`گرافی ${activeRecord.patientName}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <svg viewBox="0 0 400 140" className="w-full h-full opacity-85">
                <path d="M 30 50 Q 200 85 370 50" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 4" />
                <path d="M 40 95 Q 200 65 360 95" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 4" />
                {[60, 85, 110, 135, 160, 185, 215, 240, 265, 290, 315, 340].map((x, idx) => (
                  <g key={idx}>
                    <rect x={x - 7} y={32} width={14} height={24} rx={4} fill={idx === 2 ? '#22d3ee' : '#cbd5e1'} fillOpacity={idx === 2 ? 0.9 : 0.45} />
                    <rect x={x - 6} y={80} width={12} height={24} rx={4} fill={idx === 8 ? '#f43f5e' : '#cbd5e1'} fillOpacity={idx === 8 ? 0.85 : 0.4} />
                  </g>
                ))}
                <line x1="110" y1="15" x2="110" y2="62" stroke="#a3e635" strokeWidth="2" />
                <text x="116" y="26" fill="#a3e635" fontSize="10" fontFamily="monospace" fontWeight="bold">9.5mm Bone (D2)</text>
              </svg>
            )}
            </div>

            <div className="absolute bottom-2 right-3 left-3 flex items-center justify-between text-[10px] font-mono text-cyan-200 bg-slate-950/75 px-2.5 py-1 rounded-lg">
              <span>{activeRecord.boneDensity}</span>
              <span>DICOM 16-bit · PACS</span>
            </div>
          </div>

          {/* Compact 1-Line AI Summary Bar (Always Visible) */}
          {!showAdvancedControls && (
            <div
              onClick={() => {
                selection();
                setShowAdvancedControls(true);
              }}
              className="p-2 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-between gap-2 text-[10.5px] cursor-pointer hover:bg-cyan-100/70 transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                <span className="text-cyan-950 truncate font-bold">{activeRecord.aiFindings}</span>
              </div>
              <span className="text-[9.5px] font-black text-cyan-700 shrink-0">جزئیات بیشتر ▾</span>
            </div>
          )}

          {/* Collapsible Sliders & AI Diagnostic Details */}
          {showAdvancedControls && (
            <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
              {/* Brightness & Contrast Sliders */}
              <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-xl">
                  <SunMedium className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-slate-700 font-bold shrink-0">روشنایی:</span>
                  <input aria-label="روشنایی"
                    type="range"
                    min="70"
                    max="150"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-cyan-600"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-xl">
                  <Contrast className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <span className="text-slate-700 font-bold shrink-0">کنتراست:</span>
                  <input aria-label="کنتراست"
                    type="range"
                    min="70"
                    max="160"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-cyan-600"
                  />
                </div>
              </div>

              {/* AI Pathology Detection Metrics */}
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 rounded-xl bg-white border border-amber-200 flex flex-col">
                  <span className="text-slate-500">غربالگری پوسیدگی</span>
                  <span className="font-black text-amber-800 mt-0.5">۱ ضایعه پروگزیمال (D2)</span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-200 flex flex-col">
                  <span className="text-slate-500">فاصله از عصب IAN</span>
                  <span className="font-mono font-black text-emerald-700 mt-0.5">Safe &gt; 3.2 mm</span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-cyan-200 flex flex-col">
                  <span className="text-slate-500">پیشنهاد فیکسچر</span>
                  <span className="font-mono font-black text-cyan-800 mt-0.5">Ø 4.1 × 10 mm</span>
                </div>
              </div>

              {/* D3.js Cross-Sectional Hounsfield Unit (HU) Bone Density Profile Chart */}
              <div className="p-2.5 rounded-xl bg-white border border-cyan-200 space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-black text-slate-800">
                    پروفایل تراکم استخوان هانسفیلد (D3.js HU Cross-Section)
                  </span>
                  <span className="font-mono font-black text-cyan-700">
                    میانگین: {toPersianDigits(huProfileData.meanHu)} HU ({activeRecord.boneDensity})
                  </span>
                </div>
                <svg
                  data-testid="xray-d3-hu-profile-svg"
                  viewBox={`0 0 ${huProfileData.width} ${huProfileData.height}`}
                  className="w-full h-22 overflow-visible"
                >
                  <defs>
                    <linearGradient id="xrayHuAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0891b2" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.04" />
                    </linearGradient>
                  </defs>
                  <line
                    x1={28}
                    y1={huProfileData.yScale(850)}
                    x2={huProfileData.width - 14}
                    y2={huProfileData.yScale(850)}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text x={32} y={huProfileData.yScale(850) - 3} fontSize="7.5" fill="#047857" fontWeight="bold">
                    مرز کورتیکال D1/D2 (850 HU)
                  </text>
                  <path d={huProfileData.areaPath} fill="url(#xrayHuAreaGrad)" />
                  <path d={huProfileData.linePath} fill="none" stroke="#0891b2" strokeWidth="2.2" />
                  {huProfileData.points.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={huProfileData.xScale(pt.depthMm)}
                        cy={huProfileData.yScale(pt.hu)}
                        r={3.2}
                        fill={pt.depthMm >= 9.5 ? '#f43f5e' : '#0891b2'}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <text
                        x={huProfileData.xScale(pt.depthMm)}
                        y={huProfileData.height - 4}
                        textAnchor="middle"
                        fontSize="7.5"
                        fill="#475569"
                        fontFamily="monospace"
                      >
                        {pt.depthMm}mm
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              {/* AI & Doctor Editable Diagnostic Report Box */}
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-700 shrink-0" />
                    <span className="font-black text-cyan-950">یافته‌های تشخیصی و گزارش پزشک:</span>
                  </div>
                  {editingFindingsId === activeRecord.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingFindingsId(null)}
                        className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditedFindings(activeRecord.id)}
                        className="px-2.5 py-0.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>ذخیره گزارش</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFindingsId(activeRecord.id);
                        setEditingFindingsText(activeRecord.aiFindings);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>ویرایش گزارش</span>
                    </button>
                  )}
                </div>
                {editingFindingsId === activeRecord.id ? (
                  <textarea
                    aria-label="ویرایش گزارش تشخیصی رادیوگرافی"
                    rows={2}
                    value={editingFindingsText}
                    onChange={(e) => setEditingFindingsText(e.target.value)}
                    className="w-full bg-white border border-cyan-300 rounded-xl p-2 text-slate-800 text-[11px] leading-relaxed focus:outline-none focus:border-cyan-500"
                  />
                ) : (
                  <p className="text-slate-700 leading-relaxed">{activeRecord.aiFindings}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Archived Studies List with Numbered Badges & Right Accent Borders */}
      <div className="mx-2 space-y-2">
        <h4 className="text-xs font-black text-slate-700 px-1">کلیشه‌های آرشیوشده در پرونده بیماران ({toPersianDigits(filteredRecords.length)})</h4>
        {filteredRecords.map((rec, index) => {
          const isSelected = activeRecordId === rec.id;
          return (
            <div
              key={rec.id}
              onClick={() => {
                selection();
                setActiveRecordId(rec.id);
              }}
              className={`p-3 rounded-[20px] border border-r-[3px] border-r-cyan-500 shadow-[var(--shadow-card)] transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isSelected
                  ? 'bg-cyan-50/90 border-cyan-400 ring-1 ring-cyan-300'
                  : 'bg-white border-slate-200/90 hover:border-cyan-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-black">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-600 text-white text-[9px] font-mono font-black flex items-center justify-center border border-white shadow-2xs">
                    #{toPersianDigits(index + 1)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-900 truncate">{rec.patientName}</span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 text-[9.5px] font-bold">{rec.modality}</span>
                  </div>
                  <span className="text-[10.5px] text-slate-500 block mt-0.5 truncate">{rec.region} · {rec.doctorName}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-500 hidden xs:inline">{toPersianDigits(rec.date)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selection();
                    setActiveRecordId(rec.id);
                    setSelectedModality('cbct3d');
                  }}
                  className="min-w-[38px] min-h-[38px] px-2 rounded-[12px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1 text-[10px] font-black cursor-pointer transition-colors active:scale-95"
                  title="باز کردن در استودیو سه‌بعدی CBCT و اسکن"
                  aria-label="باز کردن در استودیو سه‌بعدی CBCT و اسکن"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleScheduleXrayReminder(rec, e)}
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                  title="ثبت یادآور هوشمند پیگیری گرافی"
                  aria-label="ثبت یادآور هوشمند پیگیری گرافی"
                >
                  <BellRing className="w-3.5 h-3.5" />
                </button>
                {onOpenPatientFile && (() => {
                  const matchedPat = resolvePatient(rec);
                  if (!matchedPat) return null;
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPatientFile(matchedPat, 'xrays');
                      }}
                      className="min-w-[38px] min-h-[38px] rounded-[12px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                      title="باز کردن پرونده بیمار"
                      aria-label="باز کردن پرونده بیمار"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  );
                })()}
                {records.length > 1 && (
                  confirmDeleteId === rec.id ? (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRecord(rec.id, e)}
                      className="min-h-[38px] px-2.5 rounded-[12px] bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 flex items-center justify-center gap-1 text-[10px] font-black cursor-pointer"
                      aria-label="تایید حذف کلیشه رادیولوژی"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>تایید حذف ✓</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRecord(rec.id, e)}
                      className="min-w-[38px] min-h-[38px] rounded-[12px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                      title="حذف کلیشه"
                      aria-label="حذف کلیشه رادیولوژی"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
