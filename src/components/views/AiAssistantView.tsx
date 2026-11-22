import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { Sparkles, Send, CheckCircle2, Search, X, Layers, Activity, FlaskConical, Pill, User, AlertTriangle, Calendar, ArrowLeft, BellRing, Compass, History, FolderOpen, Trash2, Printer } from 'lucide-react';
import { consultDentalAi } from '../../services/geminiDentalAi';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { copyTextSafely } from '../../utils/clipboard';
import { Patient, Appointment, InventoryItem } from '../../types/dental';
import { buildGlobalSmartActions, GlobalSmartAction } from '../../utils/clinicalIntelligence';
import { toPersianDigits, getCurrentPersianDate } from '../../utils/jalali';
import { scheduleEntityReminder } from '../../services/reminderNotificationService';

type AiCategory = 'all' | 'treatment' | 'implant' | 'prosthetics' | 'rx' | 'clinical_radar_d3';

interface AiConsultationHistoryItem {
  id: string;
  prompt: string;
  response: string;
  patientName?: string;
  date: string;
  time: string;
}

const AI_HISTORY_STORAGE_KEY = 'minadental_ai_history_v1';

interface AiAssistantViewProps {
  patients?: Patient[];
  appointments?: Appointment[];
  inventory?: InventoryItem[];
  onOpenPatientFile?: (p: Patient, tab?: 'treatments' | 'financial' | 'lab' | 'implant') => void;
  onOpenPalmerChart?: (p: Patient) => void;
  onNavigate?: (viewId: string) => void;
  onScheduleSmartAppointment?: (draft: { patientName: string; phone: string; treatment: string; unit?: string }) => void;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  patients = [],
  appointments = [],
  inventory = [],
  onOpenPatientFile,
  onOpenPalmerChart,
  onNavigate,
  onScheduleSmartAppointment
}) => {
  const { selection, impactLight } = useHapticFeedback();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeChip, setActiveChip] = useState<AiCategory>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [showSmartTriage, setShowSmartTriage] = useState<boolean>(true);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<AiConsultationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(AI_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(historyItems.slice(0, 20)));
    } catch {}
  }, [historyItems]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const smartClinicActions = useMemo(
    () => buildGlobalSmartActions(patients, appointments, inventory),
    [patients, appointments, inventory]
  );

  const executeSmartAction = (act: GlobalSmartAction) => {
    impactLight();
    if (act.payload.type === 'schedule_appointment') {
      if (onScheduleSmartAppointment) {
        onScheduleSmartAppointment({
          patientName: act.payload.patientName,
          phone: act.payload.phone,
          treatment: act.payload.suggestedTreatment,
          unit: act.payload.suggestedUnit
        });
      }
    } else if (act.payload.type === 'open_patient_tab') {
      const { patientId, tab } = act.payload;
      const target = patients.find((p) => p.id === patientId);
      if (target && onOpenPatientFile) {
        onOpenPatientFile(target, tab);
      }
    } else if (act.payload.type === 'open_module') {
      onNavigate?.(act.payload.viewId);
    }
  };

  const categorizedPrompts: Array<{ text: string; category: AiCategory }> = [
    {
      text: 'طرح درمان کامل برای بیمار با دندان ۶ بالا راست عفونی با دیابت نوع ۲ و مصرف متفورمین',
      category: 'treatment'
    },
    {
      text: 'بررسی گشتاور تورک و پروتکل جراحی فیکسچر در استخوان تیپ ۴ خلف ماگزیلا',
      category: 'implant'
    },
    {
      text: 'پروتکل تراش و انتخاب سمان رزینی مناسب برای لمینت‌های سرامیکی فک بالا',
      category: 'prosthetics'
    },
    {
      text: 'راهنمای نسخه‌نویسی آنتی‌بیوتیک بعد از جراحی ایمپلنت همراه با پیوند استخوان',
      category: 'rx'
    }
  ];

  const filteredPrompts = categorizedPrompts.filter(item => {
    const matchesChip = activeChip === 'all' || item.category === activeChip;
    const matchesSearch = !searchQuery || item.text.includes(searchQuery);
    return matchesChip && matchesSearch;
  });

  const handleAsk = async (queryText?: string) => {
    const q = queryText || prompt;
    if (!q) return;
    impactLight();
    setLoading(true);
    try {
      const patientContext = selectedPatient
        ? {
            fullName: selectedPatient.fullName,
            age: selectedPatient.age,
            medicalHistory: selectedPatient.medicalHistory,
            activeTreatments: Object.values(selectedPatient.teethConditions || {})
              .slice(0, 6)
              .map((t) => `${t.quadrant}${t.toothNumber}: ${t.treatment}`)
              .join('، '),
            activeImplants: (selectedPatient.implantCases || [])
              .map((i) => `${i.brand} (${i.toothNumber} · ${i.currentStage})`)
              .join('، '),
            activeLabs: (selectedPatient.labOrders || [])
              .map((l) => `${l.workType} (${l.toothNumber} · ${l.status})`)
              .join('، ')
          }
        : undefined;
      const res = await consultDentalAi(q, patientContext);
      setResponse(res);
      const entry: AiConsultationHistoryItem = {
        id: `ai-hist-${Date.now()}`,
        prompt: q,
        response: res,
        patientName: selectedPatient?.fullName,
        date: getCurrentPersianDate(),
        time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
      };
      setHistoryItems(prev => [entry, ...prev].slice(0, 20));
    } catch (e) {
      console.error(e);
      setResponse('خطایی رخ داد، لطفاً مجدداً امتحان نمایید.');
    } finally {
      setLoading(false);
    }
  };

  const [asaProfile, setAsaProfile] = useState<'asa1' | 'cardiac' | 'diabetic' | 'pregnant'>('cardiac');
  const [patientWeightKg, setPatientWeightKg] = useState<number>(72);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [showAsaCalculator, setShowAsaCalculator] = useState(false);
  const [aiToastMsg, setAiToastMsg] = useState<string | null>(null);

  const handleScheduleAiProtocolReminder = (customNote?: string) => {
    impactLight();
    const targetPat = selectedPatient || patients[0];
    scheduleEntityReminder({
      sourceType: 'treatment',
      sourceId: `ai-prot-${targetPat?.id || 'general'}`,
      patientId: targetPat?.id,
      patientName: targetPat?.fullName || 'مراجع کلینیک',
      patientPhone: targetPat?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      title: `یادآور پیگیری پروتکل بالینی هوش مصنوعی (${targetPat?.fullName || 'بیمار'})`,
      description: customNote || (response ? response.slice(0, 90) : `کنترل دوز بی‌حسی و پروتکل درمانی (${asaProfile.toUpperCase()})`),
      targetDate: getCurrentPersianDate(),
      targetTime: '۱۱:۳۰',
      targetView: 'ai_assistant',
      config: {
        enabled: true,
        preset: '1d_before',
        channels: ['in_app', 'phone_push'],
        note: 'ثبت‌شده از دستیار هوش مصنوعی بالینی مینادنتال'
      }
    });
    setAiToastMsg(`یادآور هوشمند پیگیری پروتکل بالینی برای «${targetPat?.fullName || 'بیمار'}» در مرکز یادآورها ثبت شد.`);
    setTimeout(() => setAiToastMsg(null), 3200);
  };

  // D3.js 5-Axis Patient Clinical Risk & Pharmacology Safety Radar Chart
  const d3RiskRadar = useMemo(() => {
    const pat = selectedPatient || patients[0];
    const hasMedHistory = (pat?.medicalHistory?.length || 0) > 0;
    const implantCount = pat?.implantCases?.length || 0;
    const openTeethCount = Object.values(pat?.teethConditions || {}).filter(
      (t) => t.status === 'planned' || t.status === 'in_progress'
    ).length;

    const axes = [
      { label: 'ریسک سیستمیک (ASA)', value: asaProfile === 'asa1' ? 28 : hasMedHistory ? 84 : 68 },
      { label: 'پیچیدگی جراحی ایمپلنت', value: Math.min(95, 35 + implantCount * 25) },
      { label: 'بار درمانی پالمر', value: Math.min(92, 30 + openTeethCount * 15) },
      { label: 'حساسیت دارویی و بی‌حسی', value: asaProfile === 'cardiac' || asaProfile === 'pregnant' ? 82 : 45 },
      { label: 'فوریت پیگیری (Recall)', value: (pat?.balance || 0) < 0 ? 86 : 54 }
    ];

    const size = 210;
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = 70;
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, maxRadius]);

    const angleForIndex = (i: number) => (i * 2 * Math.PI) / axes.length - Math.PI / 2;

    const polygonPoints = axes.map((ax, i) => {
      const angle = angleForIndex(i);
      const r = rScale(ax.value);
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
    });

    const lineGen = d3.line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(d3.curveLinearClosed);
    const radarPath = lineGen(polygonPoints) || '';

    const gridLevels = [35, 65, 100].map((lvl) => {
      const pts = axes.map((_, i) => {
        const angle = angleForIndex(i);
        const r = rScale(lvl);
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
      });
      return { level: lvl, path: lineGen(pts) || '' };
    });

    const axisEndpoints = axes.map((ax, i) => {
      const angle = angleForIndex(i);
      const r = maxRadius;
      const labelR = maxRadius + 18;
      return {
        ...ax,
        x2: cx + r * Math.cos(angle),
        y2: cy + r * Math.sin(angle),
        lx: cx + labelR * Math.cos(angle),
        ly: cy + labelR * Math.sin(angle),
        px: polygonPoints[i][0],
        py: polygonPoints[i][1]
      };
    });

    const meanRisk = Math.round(d3.mean(axes, (a) => a.value) || 58);

    return { size, cx, cy, radarPath, gridLevels, axisEndpoints, meanRisk, patName: pat?.fullName || 'مراجع کلینیک' };
  }, [selectedPatient, patients, asaProfile]);

  const asaClinicalData = {
    asa1: {
      label: 'سالم (ASA I)',
      badge: 'بدون محدودیت سیستمیک',
      maxEpiMg: 0.2,
      carpulesLimit: Math.min(11, Math.floor((patientWeightKg * 7) / 36)),
      anestheticChoice: 'لیدوکائین ۲٪ با اپی‌نفرین ۱:۱۰۰,۰۰۰',
      prophylaxis: 'نیاز به پروفیلاکسی آنتی‌بیوتیک قبل از جراحی روتین ندارد.',
      aiPrompt: `پروتکل بی‌حسی و جراحی ایمپلنت برای بیمار سالم وزن ${patientWeightKg} کیلوگرم (ASA I) همراه با دوز دقیق مسکن پس از جراحی`
    },
    cardiac: {
      label: 'قلبی / فشار خون (ASA II-III)',
      badge: 'حداکثر ۰.۰۴mg اپی‌نفرین',
      maxEpiMg: 0.04,
      carpulesLimit: 2,
      anestheticChoice: 'حداکثر ۲ کارپول لیدوکائین ۱:۱۰۰,۰۰۰ یا مپیواکائین ۳٪ ساده',
      prophylaxis: 'پایش فشار خون قبل از تزریق؛ اجتناب از نخ زیرلثه آغشته به اپی‌نفرین؛ در صورت دریچه مصنوعی: آموکسی‌سیلین ۲ گرم ۱ ساعت قبل.',
      aiPrompt: `ملاحظات کامل دندانپزشکی، سقف مجاز کارپول بی‌حسی و تداخلات دارویی در بیمار مبتلا به پرفشاری خون و بیماری عروق کرونر با وزن ${patientWeightKg} کیلوگرم`
    },
    diabetic: {
      label: 'دیابت نوع ۲ (ASA II)',
      badge: 'کنترل قند ناشتا و HbA1c',
      maxEpiMg: 0.04,
      carpulesLimit: 3,
      anestheticChoice: 'لیدوکائین ۲٪ (حداکثر ۳ کارپول) یا پریلوکائین با فلی‌پرسین',
      prophylaxis: 'نوبت صبح بعد از صبحانه و مصرف متفورمین؛ در صورت HbA1c بالای ۸٪ جراحی الکتیو ایمپلنت به تعویق افتد.',
      aiPrompt: `پروتکل جراحی ایمپلنت و اندو برای بیمار دیابت نوع ۲ با وزن ${patientWeightKg} کیلوگرم و راهنمای پیشگیری از افت قند و عفونت پس از عمل`
    },
    pregnant: {
      label: 'بارداری سه‌ماهه دوم',
      badge: 'ایمن‌ترین بازه درمان اورژانس',
      maxEpiMg: 0.036,
      carpulesLimit: 2,
      anestheticChoice: 'لیدوکائین ۲٪ با اپی‌نفرین ۱:۱۰۰,۰۰۰ (گروه B سازمان غذا و دارو)',
      prophylaxis: 'اجتناب کامل از NSAIDها (ایبوپروفن/ژلوفن) و تتراسایکلین؛ مسکن مجاز فقط استامینوفن ساده؛ پوزیشن نیمه‌نشسته چپ.',
      aiPrompt: `راهنمای جامع درمان اورژانس دندانپزشکی، داروهای بی‌حسی، مسکن و آنتی‌بیوتیک‌های مجاز (رده B) در سه‌ماهه دوم بارداری`
    }
  }[asaProfile];

  return (
    <div dir="rtl" className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3 select-none">
      {aiToastMsg && (
        <div className="fixed top-14 left-4 right-4 z-50 max-w-md mx-auto bg-indigo-700 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-indigo-400 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{aiToastMsg}</span>
        </div>
      )}

      {/* Top Module Header Card with Animated Search & Horizontal Scrollable Chips */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('indigo')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-4 h-4 stroke-[2.25]" />
              </div>
              <div className="text-right min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">هوش مصنوعی و دستیار بالینی</h3>
                <span className="text-[10.5px] font-bold text-indigo-800 mt-1 block truncate">مشاوره طرح درمان، پروتکل ایمپلنت و تداخلات دارویی</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {historyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setHistoryOpen(prev => !prev);
                  }}
                  className={`min-h-[40px] px-2.5 rounded-[12px] text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                    historyOpen
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>تاریخچه ({toPersianDigits(historyItems.length)})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجو در پرسش‌های بالینی"
                aria-label="جستجو در پرسش‌های بالینی"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>
            </div>
          </div>

          {/* Animated Expandable Search Bar */}
          {searchOpen && (
            <div className="relative animate-in slide-in-from-top-1 duration-150">
              <Search className="w-3.5 h-3.5 text-indigo-600 absolute right-3 top-2.5" />
              <input
                aria-label="جستجوی موضوع بالینی در هوش مصنوعی"
                type="text"
                autoFocus
                placeholder="جستجوی موضوع بالینی، دارو یا طرح درمان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-indigo-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="پاک کردن جستجوی هوش مصنوعی"
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
              { id: 'all', label: 'همه موضوعات', icon: Sparkles },
              { id: 'treatment', label: 'طرح درمان و اندو', icon: Layers },
              { id: 'implant', label: 'جراحی و ایمپلنت', icon: Activity },
              { id: 'prosthetics', label: 'پروتز و لمینت', icon: FlaskConical },
              { id: 'rx', label: 'دارو و نسخه', icon: Pill },
              { id: 'clinical_radar_d3', label: 'رادار ریسک بالینی و دارویی (D3.js)', icon: Compass }
            ].map((chip, idx) => {
              const IconComp = chip.icon;
              const isActive = activeChip === chip.id;
              return (
                <button role="tab" aria-selected={isActive}
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setActiveChip(chip.id as AiCategory);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${getUnifiedChipClasses(idx + 2, isActive)}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* D3.js 5-Axis Patient Clinical Risk & Pharmacology Safety Radar Panel */}
      {activeChip === 'clinical_radar_d3' && (
        <div data-testid="ai-d3-risk-radar-panel" className="mx-2 bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-[24px] p-3.5 border border-indigo-200/90 shadow-[var(--shadow-card)] space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900">
                رادار ۵محوره D3.js ارزیابی ریسک بالینی و دارویی ({d3RiskRadar.patName})
              </h4>
              <span className="text-[10.5px] font-bold text-indigo-800 block mt-0.5">
                شاخص ترکیبی حساسیت بالینی: {toPersianDigits(d3RiskRadar.meanRisk)} از ۱۰۰ · پروفایل: {asaClinicalData.label}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleScheduleAiProtocolReminder(`پایش رادار ریسک بالینی (${toPersianDigits(d3RiskRadar.meanRisk)}/100) - ${asaClinicalData.label}`)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-600" />
              <span>ثبت یادآور پایش ریسک بیمار</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-indigo-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <svg
              data-testid="ai-d3-risk-radar-svg"
              viewBox={`0 0 ${d3RiskRadar.size} ${d3RiskRadar.size}`}
              className="w-44 h-44 shrink-0 overflow-visible"
            >
              {d3RiskRadar.gridLevels.map((g) => (
                <path
                  key={g.level}
                  d={g.path}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeDasharray={g.level === 100 ? undefined : '2 2'}
                  strokeWidth="1"
                />
              ))}
              {d3RiskRadar.axisEndpoints.map((ax, i) => (
                <g key={i}>
                  <line
                    x1={d3RiskRadar.cx}
                    y1={d3RiskRadar.cy}
                    x2={ax.x2}
                    y2={ax.y2}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                  <text
                    x={ax.lx}
                    y={ax.ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="7"
                    fill="#334155"
                    fontWeight="bold"
                  >
                    {ax.label}
                  </text>
                </g>
              ))}
              <path
                d={d3RiskRadar.radarPath}
                fill="#4f46e5"
                fillOpacity={0.26}
                stroke="#4f46e5"
                strokeWidth="2"
              />
              {d3RiskRadar.axisEndpoints.map((ax, i) => (
                <circle
                  key={i}
                  cx={ax.px}
                  cy={ax.py}
                  r={3.2}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
              ))}
            </svg>

            <div className="flex-1 w-full space-y-1.5 text-[10.5px]">
              {d3RiskRadar.axisEndpoints.map((ax, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const axisQuery = `ارزیابی تخصصی محور «${ax.label}» با شاخص ${ax.value}٪ برای بیمار ${d3RiskRadar.patName} و پروتکل کاهش ریسک بالینی`;
                    setPrompt(axisQuery);
                    void handleAsk(axisQuery);
                  }}
                  className="w-full flex items-center justify-between bg-slate-50 hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-colors cursor-pointer text-right"
                >
                  <span className="font-bold text-slate-700">{ax.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9.5px] font-black text-indigo-600">تحلیل ◀</span>
                    <span className="font-mono font-black text-indigo-800">{toPersianDigits(ax.value)}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Saved AI Consultations History Drawer */}
      {historyOpen && historyItems.length > 0 && (
        <div className="mx-2 bg-white rounded-[22px] p-3 border border-indigo-200 shadow-[var(--shadow-card)] space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>آرشیو مشاوره‌های بالینی اخیر ({toPersianDigits(historyItems.length)})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setHistoryItems([]);
                setHistoryOpen(false);
              }}
              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>پاک‌سازی تاریخچه</span>
            </button>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {historyItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  selection();
                  setPrompt(item.prompt);
                  setResponse(item.response);
                  setHistoryOpen(false);
                }}
                className="w-full text-right p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 transition-colors cursor-pointer space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-black text-indigo-800 truncate">{item.patientName || 'مشاوره عمومی'}</span>
                  <span className="font-mono text-slate-500 shrink-0">{toPersianDigits(item.date)} · {item.time}</span>
                </div>
                <p className="text-[11px] font-bold text-slate-800 truncate">{item.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Smart Clinical Decision Support: Collapsible ASA Risk Triage & Safe Carpule Dosage Calculator */}
      <div className="mx-2">
        <div className="bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/90 rounded-[20px] p-3 border border-indigo-200/80 shadow-[var(--shadow-card)] space-y-2.5">
          <button
            type="button"
            onClick={() => {
              selection();
              setShowAsaCalculator(!showAsaCalculator);
            }}
            className="w-full flex items-center justify-between gap-2 cursor-pointer min-h-[36px] text-right"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-black text-indigo-950 truncate">
                محاسبه‌گر هوشمند دوز کارپول بی‌حسی و تریاژ (ADA / ASA)
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-black text-[10px] border border-emerald-300">
                سقف: {asaClinicalData.carpulesLimit} کارپول
              </span>
              <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-lg">
                {showAsaCalculator ? 'بستن ▴' : 'تنظیم ▾'}
              </span>
            </div>
          </button>

          {showAsaCalculator && (
            <div className="pt-2 border-t border-indigo-200/60 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className="text-[10.5px] font-bold text-slate-600">انتخاب ریسک سیستمیک و وزن بیمار:</span>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-lg border border-indigo-200">
                  <span>وزن بیمار:</span>
                  <input aria-label="وزن بیمار"
                    type="number"
                    min={20}
                    max={150}
                    value={patientWeightKg}
                    onChange={(e) => setPatientWeightKg(Math.max(20, Math.min(150, Number(e.target.value) || 70)))}
                    className="w-11 bg-white border border-indigo-300 rounded px-1 py-0.5 text-center font-mono font-black text-indigo-950"
                  />
                  <span>kg</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'cardiac', title: 'قلبی / فشار خون' },
                  { id: 'diabetic', title: 'دیابت نوع ۲' },
                  { id: 'pregnant', title: 'بارداری (سه‌ماهه ۲)' },
                  { id: 'asa1', title: 'سالم (ASA I)' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      selection();
                      setAsaProfile(item.id as 'asa1' | 'cardiac' | 'diabetic' | 'pregnant');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-[10.5px] font-black border transition-all cursor-pointer ${
                      asaProfile === item.id
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>

              <div className="p-2.5 rounded-xl bg-white/95 border border-indigo-100 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-black text-slate-800">{asaClinicalData.anestheticChoice}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-black text-[10px]">
                    سقف مجاز: حداکثر {asaClinicalData.carpulesLimit} کارپول (1.8ml)
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-600 leading-relaxed font-medium">
                  {asaClinicalData.prophylaxis}
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(asaClinicalData.aiPrompt);
                      handleAsk(asaClinicalData.aiPrompt);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>تحلیل کامل کیس با هوش مصنوعی</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Cross-Module Smart Triage Engine */}
      {smartClinicActions.length > 0 && (
        <div className="mx-2">
          <div className="bg-white/95 rounded-[20px] p-3 border border-indigo-200/80 shadow-[var(--shadow-card)] space-y-2">
            <button
              type="button"
              onClick={() => {
                selection();
                setShowSmartTriage((prev) => !prev);
              }}
              className="w-full flex items-center justify-between gap-2 cursor-pointer text-right"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] font-black text-slate-900 truncate">
                  هوش سراسری مطب (توصیه‌های اقدام فوری بین ماژول‌ها)
                </span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-200 shrink-0">
                {toPersianDigits(smartClinicActions.length)} مورد
              </span>
            </button>

            {showSmartTriage && (
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                {smartClinicActions.slice(0, 4).map((act) => (
                  <div
                    key={act.id}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                      act.severity === 'critical'
                        ? 'bg-rose-50/80 border-rose-200'
                        : act.severity === 'warning'
                        ? 'bg-amber-50/80 border-amber-200'
                        : 'bg-sky-50/80 border-sky-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/90 text-slate-700 border border-slate-200">
                          {act.moduleLabel}
                        </span>
                        <h4 className="text-[11px] font-black text-slate-900 truncate">{act.title}</h4>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">{act.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => executeSmartAction(act)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                    >
                      <Calendar className="w-3 h-3" />
                      <span>{act.ctaLabel}</span>
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patient-Aware Clinical Context Bar */}
      {patients.length > 0 && (
        <div className="mx-2">
          <div className="bg-white rounded-[18px] p-2.5 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[10.5px] font-black text-slate-800">پرونده هدف تحلیل هوشمند:</span>
            </div>
            <select
              aria-label="انتخاب پرونده بیمار برای تحلیل هوشمند"
              value={selectedPatientId}
              onChange={(e) => {
                selection();
                setSelectedPatientId(e.target.value);
              }}
              className="flex-1 min-w-[170px] bg-slate-50 border border-indigo-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="">مشاوره عمومی بدون پرونده بیمار</option>
              {patients.map((pat) => (
                <option key={pat.id} value={pat.id}>
                  {pat.fullName} (پرونده #{toPersianDigits(pat.fileNumber)})
                </option>
              ))}
            </select>
            {selectedPatient && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedPatient.medicalHistory?.length > 0 && (
                  <span className="text-[9.5px] font-black px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200">
                    هشدار: {selectedPatient.medicalHistory.join(' · ')}
                  </span>
                )}
                {onOpenPalmerChart && (
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      onOpenPalmerChart(selectedPatient);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3 h-3 text-violet-600" />
                    <span>چارت پالمر بیمار</span>
                  </button>
                )}
                {onOpenPatientFile && (
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      onOpenPatientFile(selectedPatient, 'treatments');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    <FolderOpen className="w-3 h-3 text-emerald-600" />
                    <span>پرونده کامل</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="mx-2">
        <div className="bg-white rounded-[22px] p-2.5 shadow-2xs border border-indigo-100 flex items-center gap-2">
          <input
            aria-label="پرسش بالینی یا طرح درمان از هوش مصنوعی"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="پرسش تشخیصی، دارویی یا طرح درمان..."
            className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-xs px-2 focus:outline-none font-medium"
          />
          <button type="button"
            aria-label="ارسال پرسش بالینی به هوش مصنوعی"
            onClick={() => handleAsk()}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -scale-x-100" />}
          </button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="mx-2 space-y-1.5">
        {filteredPrompts.map((p, idx) => (
          <button type="button"
            key={idx}
            onClick={() => {
              setPrompt(p.text);
              handleAsk(p.text);
            }}
            className="w-full text-right bg-white p-3 rounded-[20px] border border-slate-200/90 text-xs text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all shadow-2xs leading-relaxed font-bold cursor-pointer"
          >
            {p.text}
          </button>
        ))}
      </div>

      {/* Response Box */}
      {response && (
        <div className="mx-2">
          <div className="bg-white rounded-[22px] p-4 shadow-sm border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-800">پاسخ بالینی</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleScheduleAiProtocolReminder()}
                  className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 cursor-pointer"
                >
                  <BellRing className="w-3 h-3 text-amber-600" />
                  <span>ثبت یادآور پیگیری</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    try { window.print(); } catch {}
                  }}
                  className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>چاپ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void copyTextSafely(response);
                    setCopiedProtocol(true);
                    setTimeout(() => setCopiedProtocol(false), 2000);
                  }}
                  className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer"
                >
                  {copiedProtocol ? 'کپی شد ✓' : 'کپی پروتکل بالینی'}
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
              {response}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
