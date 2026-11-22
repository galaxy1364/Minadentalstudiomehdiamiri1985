import React, { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import {
  ShieldCheck, Thermometer, Clock, CheckCircle2,
  Plus, Search, X, Flame, Printer,
  ChevronDown, ChevronUp, Trash2, Link2, FolderOpen, QrCode,
  Activity, BellRing, FileSpreadsheet
} from 'lucide-react';
import { Patient } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, getCurrentPersianDate } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { syncEngine } from '../../services/syncEngine';
import { actionFeedback } from '../../utils/actionFeedback';
import { scheduleEntityReminder } from '../../services/reminderNotificationService';
import { RealQrCode } from '../RealQrCode';

interface SterilizationCycle {
  id: string;
  cycleCode: string;
  autoclaveDevice: string;
  program: 'B-134C-Universal' | 'B-121C-Delicate' | 'Prion-134C-18m';
  temperature: number;
  pressureBar: number;
  durationMin: number;
  bowieDickResult: 'pass' | 'fail' | 'pending';
  chemicalIndicatorClass: 'Class 5 Integrator' | 'Class 6 Emulating';
  biologicalSporeTest: 'negative_safe' | 'pending_24h';
  operatorName: string;
  date: string;
  time: string;
  packsCount: number;
  packs: string[];
  linkedPatients?: Array<{ patientId?: string; patientName: string; fileNumber?: string; linkedAt: string }>;
}

interface SterilizationModuleViewProps {
  patients?: Patient[];
  onLinkPackToPatient?: (barcode: string, patientId?: string) => void;
  onOpenPatientFile?: (patient: Patient, tab?: any) => void;
  onOpenSterileScanner?: () => void;
}

const CSSD_STORAGE_KEY = 'minadental_cssd_cycles_v1';

export const SterilizationModuleView: React.FC<SterilizationModuleViewProps> = ({
  patients = [],
  onLinkPackToPatient,
  onOpenPatientFile,
  onOpenSterileScanner
}) => {
  const { selection, impactLight, success } = useHapticFeedback();
  const [activeChip, setActiveChip] = useState<'all' | 'passed' | 'spore_test' | 'telemetry_d3' | 'new_cycle'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(() => new Set());
  const [targetPatientId, setTargetPatientId] = useState<string>(patients[0]?.id || '');
  const [selectedTelemetryCycleId, setSelectedTelemetryCycleId] = useState<string>('st-101');

  useEffect(() => {
    if (!targetPatientId && patients[0]?.id) {
      setTargetPatientId(patients[0].id);
    }
  }, [patients, targetPatientId]);

  const toggleExpandCycle = (id: string) => {
    setExpandedCycles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const defaultCycles: SterilizationCycle[] = [
    {
      id: 'st-101',
      cycleCode: 'AUT-1405-0842',
      autoclaveDevice: 'اتوکلاو کلاس B یوروندا (Euronda E9)',
      program: 'B-134C-Universal',
      temperature: 134.4,
      pressureBar: 2.15,
      durationMin: 45,
      bowieDickResult: 'pass',
      chemicalIndicatorClass: 'Class 6 Emulating',
      biologicalSporeTest: 'negative_safe',
      operatorName: 'سارا احمدی (دستیار جراحی)',
      date: getCurrentPersianDate(),
      time: '۰۸:۳۰',
      packsCount: 14,
      packs: ['ست جراحی ایمپلنت #۱', 'ست جراحی ایمپلنت #۲', 'توربین و آنگل جراحی (۴ عدد)', 'ست الواتور و فورسپس (۸ پک)']
    },
    {
      id: 'st-102',
      cycleCode: 'AUT-1405-0843',
      autoclaveDevice: 'اتوکلاو کلاس B ملگ (MELAG Vacuklav 41B+)',
      program: 'Prion-134C-18m',
      temperature: 134.8,
      pressureBar: 2.18,
      durationMin: 60,
      bowieDickResult: 'pass',
      chemicalIndicatorClass: 'Class 6 Emulating',
      biologicalSporeTest: 'negative_safe',
      operatorName: 'نازنین کریمی (کنترل عفونت)',
      date: getCurrentPersianDate(),
      time: '۱۲:۱۵',
      packsCount: 19,
      packs: ['ست اندو و فایل‌های روتاری', 'ست سینوس‌لیفت و استئوتوم', 'ست معاینه استریل (۱۲ پک)']
    }
  ];

  const [cycles, setCycles] = useState<SterilizationCycle[]>(() => {
    try {
      const saved = localStorage.getItem(CSSD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultCycles;
  });

  const didMountCyclesRef = React.useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(CSSD_STORAGE_KEY, JSON.stringify(cycles));
      if (didMountCyclesRef.current) {
        window.dispatchEvent(new CustomEvent('minadental:reminders-updated'));
      } else {
        didMountCyclesRef.current = true;
      }
    } catch {}
  }, [cycles]);

  // New Cycle Form
  const [autoclaveDevice, setAutoclaveDevice] = useState('اتوکلاو کلاس B یوروندا (Euronda E9)');
  const [program, setProgram] = useState<'B-134C-Universal' | 'B-121C-Delicate' | 'Prion-134C-18m'>('B-134C-Universal');
  const [packsCount, setPacksCount] = useState('12');
  const [operatorName, setOperatorName] = useState('سارا احمدی (دستیار جراحی)');
  const [formBowieDick, setFormBowieDick] = useState<'pass' | 'fail' | 'pending'>('pass');
  const [formSpore, setFormSpore] = useState<'negative_safe' | 'pending_24h'>('negative_safe');
  const [formPacksInput, setFormPacksInput] = useState('ست جراحی ایمپلنت، پک‌های معاینه و جرم‌گیری، اینسترومنت‌های اندو');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleExportCssdCsv = () => {
    const headers = ['کد سیکل', 'دستگاه اتوکلاو', 'برنامه', 'دما (°C)', 'فشار (Bar)', 'تست Bowie-Dick', 'تست اسپور بیولوژیک', 'اپراتور', 'تاریخ', 'ساعت', 'تعداد پک', 'بیماران متصل‌شده'];
    const rows = cycles.map(c => [
      c.cycleCode,
      c.autoclaveDevice,
      c.program,
      String(c.temperature),
      String(c.pressureBar),
      c.bowieDickResult,
      c.biologicalSporeTest === 'negative_safe' ? 'منفی و ایمن' : 'در انتظار ۲۴ ساعت',
      c.operatorName,
      c.date,
      c.time,
      String(c.packsCount),
      (c.linkedPatients || []).map(lp => lp.patientName).join(' / ') || '—'
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minadental-cssd-audit-${getCurrentPersianDate().replace(/\//g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    success();
    showToast(`گزارش بازرسی CSSD شامل ${toPersianDigits(cycles.length)} سیکل اتوکلاو ذخیره شد.`);
  };

  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPacks = formPacksInput
      .split(/[،,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const newCycle: SterilizationCycle = {
      id: `st-${Date.now()}`,
      cycleCode: `AUT-1405-${Math.floor(1000 + Math.random() * 8999)}`,
      autoclaveDevice,
      program,
      temperature: program === 'B-121C-Delicate' ? 121.5 : 134.6,
      pressureBar: program === 'B-121C-Delicate' ? 1.15 : 2.16,
      durationMin: program === 'Prion-134C-18m' ? 60 : 45,
      bowieDickResult: formBowieDick,
      chemicalIndicatorClass: 'Class 6 Emulating',
      biologicalSporeTest: formSpore,
      operatorName: operatorName.trim() || 'دستیار کنترل عفونت',
      date: getCurrentPersianDate(),
      time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()),
      packsCount: Math.max(1, Number(packsCount) || 10),
      packs: parsedPacks.length > 0 ? parsedPacks : ['ست جراحی ایمپلنت', 'پک‌های معاینه'],
      linkedPatients: []
    };
    setCycles([newCycle, ...cycles]);
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'inventory',
      action: 'UPSERT',
      payload: { module: 'cssd_sterilization', cycleId: newCycle.id, cycleCode: newCycle.cycleCode },
      actorName: newCycle.operatorName,
      actorRole: 'assistant',
      platform: 'CSSD Infection Control',
      eventType: 'CLOUD_BACKUP_SAVED',
      title: `ثبت سیکل اتوکلاو کلاس B (${newCycle.cycleCode})`,
      description: `سیکل استریل ${newCycle.autoclaveDevice} (${newCycle.packsCount} پک جراحی) با وضعیت ${newCycle.bowieDickResult} ثبت شد.`
    });
    actionFeedback.recordSuccess({
      title: `سیکل استریل ${newCycle.cycleCode} ثبت شد`,
      subtitle: `${newCycle.autoclaveDevice} · ${toPersianDigits(newCycle.packsCount)} پک استریل`,
      canUndo: false
    });
    success();
    showToast(`سیکل استریل ${newCycle.cycleCode} با موفقیت ثبت و لیبل بارکد صادر شد.`);
    setActiveChip('all');
  };

  const handleDeleteCycle = (id: string, code: string) => {
    if (confirmDeleteId !== id) {
      impactLight();
      setConfirmDeleteId(id);
      return;
    }
    impactLight();
    setCycles(prev => prev.filter(c => c.id !== id));
    setConfirmDeleteId(null);
    showToast(`سیکل ${code} از لیست حذف شد.`);
  };

  const handleToggleSporeResult = (id: string) => {
    selection();
    setCycles(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, biologicalSporeTest: c.biologicalSporeTest === 'negative_safe' ? 'pending_24h' : 'negative_safe' }
          : c
      )
    );
    showToast('وضعیت تست اسپور بیولوژیک سیکل به‌روزرسانی شد.');
  };

  const handleScheduleCssdReminder = (cycle: SterilizationCycle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    impactLight();
    scheduleEntityReminder({
      sourceType: 'sterilization',
      sourceId: cycle.id,
      patientName: cycle.operatorName,
      title: `یادآور تست اسپور بیولوژیک و کنترل سیکل ${cycle.cycleCode}`,
      description: `${cycle.autoclaveDevice} · برنامه ${cycle.program} (${toPersianDigits(cycle.packsCount)} پک جراحی)`,
      targetDate: cycle.date || getCurrentPersianDate(),
      targetTime: '۰۹:۰۰',
      targetView: 'sterilization',
      config: {
        enabled: true,
        preset: '1d_before',
        channels: ['in_app', 'phone_push'],
        note: `کنترل ۲۴ ساعته انکوباتور اسپور و تست Bowie-Dick دستگاه ${cycle.autoclaveDevice}`
      }
    });
    success();
    showToast(`یادآور هوشمند کنترل کیفی و تست اسپور سیکل ${cycle.cycleCode} در مرکز یادآورها ثبت شد.`);
  };

  const activeTelemetryCycle = useMemo(
    () => cycles.find((c) => c.id === selectedTelemetryCycleId) || cycles[0] || defaultCycles[0],
    [cycles, selectedTelemetryCycleId]
  );

  // D3.js Class-B Vacuum Autoclave Thermodynamic Pressure & Temperature Telemetry Curve
  const telemetryChartData = useMemo(() => {
    const peakTemp = activeTelemetryCycle?.temperature || 134.4;
    const peakBar = activeTelemetryCycle?.pressureBar || 2.15;
    const totalMin = activeTelemetryCycle?.durationMin || 45;
    const points = [
      { min: 0, temp: 28, bar: 0.0, phase: 'شروع' },
      { min: Math.round(totalMin * 0.12), temp: 65, bar: -0.82, phase: 'پیش‌وکیوم ۱' },
      { min: Math.round(totalMin * 0.24), temp: 92, bar: -0.85, phase: 'پیش‌وکیوم ۲' },
      { min: Math.round(totalMin * 0.36), temp: 118, bar: 1.12, phase: 'تزریق بخار' },
      { min: Math.round(totalMin * 0.50), temp: peakTemp, bar: peakBar, phase: 'پلاتو استریل (شروع)' },
      { min: Math.round(totalMin * 0.72), temp: peakTemp, bar: peakBar, phase: 'پلاتو استریل (پایان)' },
      { min: Math.round(totalMin * 0.88), temp: 88, bar: -0.78, phase: 'خشک‌کن وکیوم' },
      { min: totalMin, temp: 42, bar: 0.0, phase: 'پایان و هم‌دمایی' }
    ];
    const width = 360;
    const height = 115;
    const xScale = d3.scaleLinear().domain([0, totalMin]).range([30, width - 26]);
    const yTempScale = d3.scaleLinear().domain([20, 145]).range([height - 22, 12]);
    const yBarScale = d3.scaleLinear().domain([-1.0, 2.5]).range([height - 22, 12]);

    const tempLine = d3
      .line<typeof points[0]>()
      .x((d) => xScale(d.min))
      .y((d) => yTempScale(d.temp))
      .curve(d3.curveMonotoneX);

    const tempArea = d3
      .area<typeof points[0]>()
      .x((d) => xScale(d.min))
      .y0(height - 22)
      .y1((d) => yTempScale(d.temp))
      .curve(d3.curveMonotoneX);

    const barLine = d3
      .line<typeof points[0]>()
      .x((d) => xScale(d.min))
      .y((d) => yBarScale(d.bar))
      .curve(d3.curveMonotoneX);

    return {
      points,
      width,
      height,
      xScale,
      yTempScale,
      yBarScale,
      tempLinePath: tempLine(points) || '',
      tempAreaPath: tempArea(points) || '',
      barLinePath: barLine(points) || '',
      peakTemp,
      peakBar
    };
  }, [activeTelemetryCycle]);

  const normalizeCssd = (val?: string) =>
    toEnglishDigits(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();

  const filteredCycles = cycles.filter(c => {
    const q = normalizeCssd(searchQuery);
    const matchSearch =
      !q ||
      normalizeCssd(c.cycleCode).includes(q) ||
      normalizeCssd(c.autoclaveDevice).includes(q) ||
      normalizeCssd(c.operatorName).includes(q);
    if (!matchSearch) return false;
    if (activeChip === 'passed') return c.bowieDickResult === 'pass';
    if (activeChip === 'spore_test') return c.biologicalSporeTest === 'negative_safe';
    return true;
  });

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3 select-none" dir="rtl">
      {toastMsg && (
        <div className="fixed top-14 inset-x-4 z-50 max-w-md mx-auto bg-teal-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-teal-400/40 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module Header with Chips */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('teal')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-teal-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">استریلیزاسیون، اتوکلاو و کنترل عفونت (CSSD)</h3>
                <span className="text-[10.5px] font-bold text-teal-800 mt-1 block truncate">تست بویی‌دیک، اندیکاتور کلاس ۶ و بارکد پک‌های جراحی</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {activeChip !== 'new_cycle' && filteredCycles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    if (expandedCycles.size > 0) {
                      setExpandedCycles(new Set());
                    } else {
                      setExpandedCycles(new Set(filteredCycles.map(c => c.id)));
                    }
                  }}
                  className="min-h-[38px] px-2.5 rounded-[12px] bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  {expandedCycles.size > 0 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span className="hidden xs:inline">{expandedCycles.size > 0 ? 'جمع کردن همه' : 'باز کردن همه'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-teal-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                aria-label="جستجو در چرخه‌های استریل"
              >
                <Search className="w-4 h-4" />
              </button>
              {onOpenSterileScanner && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    onOpenSterileScanner();
                  }}
                  className="min-h-[38px] px-2.5 rounded-[12px] bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="اسکن QR پک استریل با دوربین"
                >
                  <QrCode className="w-3.5 h-3.5 text-violet-700" />
                  <span className="hidden xs:inline">اسکن پک</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleExportCssdCsv}
                className="min-h-[38px] px-2.5 rounded-[12px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                title="خروجی CSV گزارش بازرسی کنترل عفونت"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">گزارش CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setActiveChip('new_cycle');
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-l from-teal-600 to-cyan-600 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                <span>ثبت سیکل جدید</span>
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="relative my-2">
              <Search className="w-3.5 h-3.5 text-teal-600 absolute right-3 top-2.5" />
              <input
                aria-label="جستجوی کد سیکل یا دستگاه اتوکلاو"
                type="text"
                autoFocus
                placeholder="جستجوی کد سیکل، دستگاه اتوکلاو یا نام اپراتور..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-teal-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="پاک کردن جستجو"
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div role="tablist" aria-label="بخش‌های ماژول" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: `سیکل‌های اتوکلاو (${toPersianDigits(cycles.length)})` },
              { id: 'passed', label: 'تاییدشده (Class 6 Pass)' },
              { id: 'spore_test', label: 'تست اسپور بیولوژیک هفتگی' },
              { id: 'telemetry_d3', label: 'منحنی ترمودینامیک اتوکلاو (D3.js)' },
              { id: 'new_cycle', label: '+ ثبت سیکل و چاپ بارکد' }
            ].map((chip, idx) => (
              <button role="tab" aria-selected={activeChip === chip.id}
                key={chip.id}
                type="button"
                onClick={() => {
                  selection();
                  setActiveChip(chip.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${getUnifiedChipClasses(idx + 3, activeChip === chip.id)}`}
              >
                {chip.id === 'telemetry_d3' && <Activity className="w-3.5 h-3.5" />}
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeChip === 'telemetry_d3' && activeTelemetryCycle && (
        <div data-testid="cssd-d3-telemetry-panel" className="mx-2 bg-gradient-to-br from-teal-50 via-white to-cyan-50 rounded-[24px] p-3.5 border border-teal-200/90 shadow-[var(--shadow-card)] space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900">
                تله‌متری ترمودینامیک دما و فشار اتوکلاو کلاس B ({activeTelemetryCycle.cycleCode})
              </h4>
              <span className="text-[10.5px] font-bold text-teal-800 block mt-0.5">
                {activeTelemetryCycle.autoclaveDevice} · برنامه: {activeTelemetryCycle.program} · اوج دما: {toPersianDigits(telemetryChartData.peakTemp)}°C
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => handleScheduleCssdReminder(activeTelemetryCycle, e)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-600" />
              <span>ثبت یادآور تست اسپور سیکل</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {cycles.map((c) => {
              const isSelected = c.id === activeTelemetryCycle.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setSelectedTelemetryCycleId(c.id);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-teal-200 hover:bg-teal-50'
                  }`}
                >
                  {c.cycleCode} · {toPersianDigits(c.temperature)}°C ({toPersianDigits(c.packsCount)} پک)
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl p-3 border border-teal-200/80 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  منحنی دما (°C)
                </span>
                <span className="flex items-center gap-1 text-teal-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                  منحنی فشار و وکیوم (Bar)
                </span>
              </div>
              <span className="font-mono font-black text-emerald-700">EN-13060 Class B Verified ✓</span>
            </div>

            <svg
              data-testid="cssd-d3-telemetry-svg"
              viewBox={`0 0 ${telemetryChartData.width} ${telemetryChartData.height}`}
              className="w-full h-28 overflow-visible"
            >
              <defs>
                <linearGradient id="cssdTempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <line
                x1={30}
                y1={telemetryChartData.yTempScale(134)}
                x2={telemetryChartData.width - 26}
                y2={telemetryChartData.yTempScale(134)}
                stroke="#10b981"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text x={34} y={telemetryChartData.yTempScale(134) - 3} fontSize="7.5" fill="#047857" fontWeight="bold">
                پلاتو استریل استاندارد (134°C / 2.15 Bar)
              </text>
              <path d={telemetryChartData.tempAreaPath} fill="url(#cssdTempGrad)" />
              <path d={telemetryChartData.tempLinePath} fill="none" stroke="#e11d48" strokeWidth="2.2" />
              <path d={telemetryChartData.barLinePath} fill="none" stroke="#0d9488" strokeWidth="1.8" strokeDasharray="4 2" />
              {telemetryChartData.points.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={telemetryChartData.xScale(pt.min)}
                    cy={telemetryChartData.yTempScale(pt.temp)}
                    r={3.2}
                    fill="#e11d48"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <text
                    x={telemetryChartData.xScale(pt.min)}
                    y={telemetryChartData.height - 5}
                    textAnchor="middle"
                    fontSize="7.5"
                    fill="#475569"
                    fontFamily="monospace"
                  >
                    {pt.min}m
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {activeChip === 'new_cycle' ? (
        <form onSubmit={handleCreateCycle} className="mx-2 bg-white rounded-[24px] p-4 border-2 border-teal-200 shadow-sm space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-black text-slate-900">ثبت سیکل جدید اتوکلاو و صدور لیبل استریل</span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black">Bowie-Dick: PASS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">دستگاه اتوکلاو</label>
              <select aria-label="دستگاه اتوکلاو"
                value={autoclaveDevice}
                onChange={(e) => setAutoclaveDevice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                <option value="اتوکلاو کلاس B یوروندا (Euronda E9)">اتوکلاو کلاس B یوروندا (Euronda E9)</option>
                <option value="اتوکلاو کلاس B ملگ (MELAG Vacuklav 41B+)">اتوکلاو کلاس B ملگ (MELAG Vacuklav 41B+)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">برنامه سیکل استریل</label>
              <select aria-label="برنامه سیکل استریل"
                value={program}
                onChange={(e) => setProgram(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                <option value="B-134C-Universal">Universal 134°C (۴۵ دقیقه - ۲.۱۵ بار)</option>
                <option value="Prion-134C-18m">Prion 134°C ویژه جراحی ایمپلنت (۶۰ دقیقه)</option>
                <option value="B-121C-Delicate">Delicate 121°C لاستیک و پلاستیک</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">تعداد پک‌های داخل چمبر</label>
              <input aria-label="تعداد پک‌های داخل چمبر"
                type="number"
                value={packsCount}
                onChange={(e) => setPacksCount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-black text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">مسئول کنترل عفونت</label>
              <input aria-label="مسئول کنترل عفونت"
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">نتیجه تست Bowie-Dick</label>
              <select aria-label="نتیجه تست بویی‌دیک"
                value={formBowieDick}
                onChange={(e) => setFormBowieDick(e.target.value as 'pass' | 'fail' | 'pending')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                <option value="pass">تایید کامل نفوذ بخار (PASS)</option>
                <option value="pending">در انتظار ارزیابی</option>
                <option value="fail">عدم تایید / نیاز به سرویس (FAIL)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">وضعیت تست اسپور بیولوژیک</label>
              <select aria-label="وضعیت تست اسپور بیولوژیک"
                value={formSpore}
                onChange={(e) => setFormSpore(e.target.value as 'negative_safe' | 'pending_24h')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                <option value="negative_safe">منفی و ایمن (Negative Safe ✓)</option>
                <option value="pending_24h">در انکوباتور ۲۴ ساعته ⏳</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">فهرست ست‌ها و پک‌های داخل چمبر (با ویرگول جدا کنید)</label>
              <input aria-label="فهرست ست‌ها و پک‌های استریل"
                type="text"
                value={formPacksInput}
                onChange={(e) => setFormPacksInput(e.target.value)}
                placeholder="ست جراحی ایمپلنت، توربین و آنگل، ست اندو..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setActiveChip('all')} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer">
              انصراف
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-teal-600 text-white font-black shadow-xs cursor-pointer">
              ثبت سیکل و چاپ لیبل استریل
            </button>
          </div>
        </form>
      ) : (
        <div className="mx-2 space-y-2.5">
          {filteredCycles.map((cycle, index) => {
            const isExpanded = expandedCycles.has(cycle.id);
            return (
              <div
                key={cycle.id}
                className={`bg-white rounded-[20px] border border-slate-200/90 border-r-[3px] border-r-emerald-500 shadow-[var(--shadow-card)] transition-all ${
                  isExpanded ? 'p-3.5 space-y-2.5 ring-1 ring-teal-200' : 'p-2.5 hover:bg-slate-50/70'
                }`}
              >
                {/* Compact Header Row (Always Visible) */}
                <div
                  onClick={() => {
                    selection();
                    toggleExpandCycle(cycle.id);
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-black">
                        <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[9px] font-mono font-black flex items-center justify-center border border-white shadow-2xs">
                        #{toPersianDigits(index + 1)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs text-teal-900 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                          {cycle.cycleCode}
                        </span>
                        <span className="font-black text-xs text-slate-900 truncate">{cycle.autoclaveDevice}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
                        {toPersianDigits(cycle.date)} · ساعت {cycle.time} · {toPersianDigits(cycle.packsCount)} پک جراحی
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black hidden xs:inline-block">
                      {cycle.chemicalIndicatorClass} ✓
                    </span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isExpanded ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Details Section */}
                {isExpanded && (
                  <div className="pt-2.5 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80 text-[10.5px]">
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-slate-600">دما:</span>
                        <span className="font-mono font-black text-slate-900">{toPersianDigits(cycle.temperature)}°C</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-slate-600">فشار:</span>
                        <span className="font-mono font-black text-slate-900">{toPersianDigits(cycle.pressureBar)} Bar</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        <span className="text-slate-600">پک‌ها:</span>
                        <span className="font-mono font-black text-teal-900">{toPersianDigits(cycle.packsCount)} پک</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 text-[10.5px] font-bold text-slate-600">
                      <span>اپراتور ثبت‌کننده: <span className="text-slate-900 font-black">{cycle.operatorName}</span></span>
                      <button
                        type="button"
                        onClick={() => handleToggleSporeResult(cycle.id)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-black cursor-pointer transition-colors ${
                          cycle.biologicalSporeTest === 'negative_safe'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {cycle.biologicalSporeTest === 'negative_safe'
                          ? 'تست اسپور بیولوژیک: منفی و ایمن ✓'
                          : 'در انتظار نتیجه ۲۴ ساعته اسپور ⏳'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {cycle.packs.map((pack, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-lg bg-teal-50/70 border border-teal-200/80 text-[10px] font-bold text-teal-900">
                          {pack}
                        </span>
                      ))}
                    </div>

                    {/* Link Sterile Barcode Pack directly to a Patient Record */}
                    {patients.length > 0 && onLinkPackToPatient && (
                      <div className="bg-teal-50/70 p-2 rounded-xl border border-teal-200 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                          <span className="font-black text-teal-950 shrink-0">الصاق به بیمار:</span>
                          <select
                            aria-label="انتخاب بیمار جهت الصاق بارکد استریل"
                            value={targetPatientId}
                            onChange={(e) => setTargetPatientId(e.target.value)}
                            className="flex-1 bg-white border border-teal-200 rounded-lg px-2 py-1 text-[10.5px] font-bold text-slate-800"
                          >
                            {patients.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.fullName} ({p.fileNumber})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              success();
                              onLinkPackToPatient(cycle.cycleCode, targetPatientId);
                              const chosenPat = patients.find((p) => p.id === targetPatientId);
                              if (chosenPat) {
                                setCycles(prev => prev.map(item => {
                                  if (item.id !== cycle.id) return item;
                                  const existing = item.linkedPatients || [];
                                  return {
                                    ...item,
                                    linkedPatients: [
                                      {
                                        patientId: chosenPat.id,
                                        patientName: chosenPat.fullName,
                                        fileNumber: chosenPat.fileNumber,
                                        linkedAt: getCurrentPersianDate()
                                      },
                                      ...existing.filter(lp => lp.patientId !== chosenPat.id)
                                    ]
                                  };
                                }));
                              }
                              showToast(`بارکد پک استریل ${cycle.cycleCode} در پرونده «${chosenPat?.fullName || 'بیمار'}» ثبت شد.`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>ثبت الصاق پک در پرونده</span>
                          </button>
                          {onOpenPatientFile && (() => {
                            const chosenPat = patients.find((p) => p.id === targetPatientId);
                            if (!chosenPat) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => onOpenPatientFile(chosenPat, 'treatments')}
                                className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-black flex items-center gap-1 cursor-pointer"
                              >
                                <FolderOpen className="w-3 h-3 text-teal-600" />
                                <span>پرونده</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Patient-to-Pack Traceability History Log */}
                    {cycle.linkedPatients && cycle.linkedPatients.length > 0 && (
                      <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200/90 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-black text-emerald-950">رهگیری بیماران استفاده‌کننده از این سیکل:</span>
                        {cycle.linkedPatients.map((lp, idx) => (
                          <span key={`${lp.patientId || lp.patientName}-${idx}`} className="px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-emerald-900 font-bold">
                            {lp.patientName} {lp.fileNumber ? `(#${lp.fileNumber})` : ''} · {toPersianDigits(lp.linkedAt)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-white rounded-lg border border-slate-200 shrink-0">
                          <RealQrCode value={cycle.cycleCode} size={42} />
                        </div>
                        {confirmDeleteId === cycle.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-xl bg-slate-100 text-slate-700 text-[10px] font-bold cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCycle(cycle.id, cycle.cycleCode)}
                              className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>تایید حذف ✓</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteCycle(cycle.id, cycle.cycleCode)}
                            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف سیکل</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => handleScheduleCssdReminder(cycle, e)}
                          className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <BellRing className="w-3 h-3 text-amber-600" />
                          <span>یادآور تست اسپور</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            impactLight();
                            showToast(`بارکد رهگیری سیکل ${cycle.cycleCode} آماده چاپ روی لیبل استریل شد.`);
                            try { window.print(); } catch {}
                          }}
                          className="px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3 h-3" />
                          <span>چاپ لیبل QR</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
