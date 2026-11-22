import React, { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Megaphone, Send, CheckCircle2, Plus, 
  Gift, ChevronDown, ChevronUp, Search, X, Trash2, FolderOpen, Lock, MessageSquare,
  BarChart3, BellRing, Download, PauseCircle, PlayCircle
} from 'lucide-react';
import { Patient } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, getCurrentPersianDate, diffPersianDays } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { clinicalSmsService, SmsLogItem } from '../../services/smsService';
import { syncEngine } from '../../services/syncEngine';
import { actionFeedback } from '../../utils/actionFeedback';
import { scheduleEntityReminder } from '../../services/reminderNotificationService';

interface MarketingCampaignsViewProps {
  patients: Patient[];
  onOpenPatientFile?: (patient: Patient, tab?: any) => void;
  isManager?: boolean;
}

type CampaignSegment = 'all' | 'recall_6m' | 'open_treatment' | 'vip_settled';

interface CampaignItem {
  id: string;
  title: string;
  targetAudience: string;
  targetSegment?: CampaignSegment;
  audienceCount: number;
  discountPercent: number;
  messageTemplate: string;
  status: 'active' | 'scheduled' | 'completed';
  conversionCount: number;
  estimatedRevenue: number;
  color: string;
}

const CAMPAIGNS_STORAGE_KEY = 'minadental_marketing_campaigns_v1';

const SEGMENT_LABELS: Record<CampaignSegment, string> = {
  recall_6m: 'بیمارانی که بیش از ۶ ماه مراجعه نداشته‌اند',
  open_treatment: 'بیماران دارای طرح درمان باز در چارت پالمر',
  vip_settled: 'بیماران خوش‌حساب و تسویه‌شده کلینیک',
  all: 'همه بیماران ثبت‌شده در پرونده‌ها'
};

export const MarketingCampaignsView: React.FC<MarketingCampaignsViewProps> = ({
  patients,
  onOpenPatientFile,
  isManager = false
}) => {
  const { selection, impactLight, impactHeavy, success } = useHapticFeedback();
  const [activeFilter, setActiveFilter] = useState<'all' | 'recall' | 'vip' | 'seasonal' | 'roi_funnel_d3' | 'sms_logs'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(() => new Set());
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSendingId, setIsSendingId] = useState<string | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLogItem[]>(() => clinicalSmsService.getLogs());
  const [smsCredit, setSmsCredit] = useState<number>(() => clinicalSmsService.getSmsCredit());
  const [quickSmsPatientId, setQuickSmsPatientId] = useState<string>(() => patients[0]?.id || '');
  const [quickSmsText, setQuickSmsText] = useState<string>('مراجع گرامی، پیگیری وضعیت درمان دندانپزشکی شما در کلینیک مینادنتال.');
  const [sendingQuickSms, setSendingQuickSms] = useState(false);

  useEffect(() => {
    if (!quickSmsPatientId && patients.length > 0) {
      setQuickSmsPatientId(patients[0].id);
    }
  }, [patients, quickSmsPatientId]);

  useEffect(() => {
    const refreshSms = () => {
      setSmsLogs([...clinicalSmsService.getLogs()]);
      setSmsCredit(clinicalSmsService.getSmsCredit());
    };
    window.addEventListener('minadental:sms-updated', refreshSms);
    return () => window.removeEventListener('minadental:sms-updated', refreshSms);
  }, []);

  // Security & 2-step delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [managerPinUnlocked, setManagerPinUnlocked] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const canManageCampaigns = isManager || managerPinUnlocked;

  // New Campaign State
  const [newTitle, setNewTitle] = useState('');
  const [newDiscount, setNewDiscount] = useState('15');
  const [newSegment, setNewSegment] = useState<CampaignSegment>('recall_6m');
  const [newTemplate, setNewTemplate] = useState('مراجع گرامی {نام_بیمار}، به مناسبت جشنواره لبخند مینادنتال، ۱۵٪ هدیه ویژه خدمات زیبایی و ایمپلنت برای شما فعال شد.');

  const defaultCampaigns: CampaignItem[] = [
    {
      id: 'cmp-1',
      title: 'فراخوان چکاپ ۶ ماهه و جرم‌گیری (Recall)',
      targetAudience: SEGMENT_LABELS.recall_6m,
      targetSegment: 'recall_6m',
      audienceCount: Math.max(patients.length, 1),
      discountPercent: 20,
      messageTemplate: 'سلام {نام_بیمار} عزیز؛ ۶ ماه از آخرین چکاپ دندانپزشکی شما در کلینیک دکتر مهدی امیری گذشته است. جهت معاینه رایگان و ۲۰٪ تخفیف جرم‌گیری تماس بگیرید.',
      status: 'active',
      conversionCount: 9,
      estimatedRevenue: 34500000,
      color: 'rose'
    },
    {
      id: 'cmp-2',
      title: 'طرح ویژه تکمیل درمان‌های نیمه‌تمام و ایمپلنت',
      targetAudience: SEGMENT_LABELS.open_treatment,
      targetSegment: 'open_treatment',
      audienceCount: Math.max(patients.filter(p => p.activeTreatmentsCount > 0 || (p.implantCases?.length || 0) > 0).length, 1),
      discountPercent: 10,
      messageTemplate: 'مراجع ارجمند {نام_بیمار}؛ جهت تکمیل مراحل درمان ایمپلنت و پروتز خود با شرایط اقساطی ویژه بدون بهره، نوبت خود را رزرو فرمایید.',
      status: 'active',
      conversionCount: 6,
      estimatedRevenue: 82000000,
      color: 'purple'
    },
    {
      id: 'cmp-3',
      title: 'باشگاه مراجعین VIP و معرفی به دوستان',
      targetAudience: SEGMENT_LABELS.vip_settled,
      targetSegment: 'vip_settled',
      audienceCount: Math.max(patients.filter(p => p.balance >= 0).length, 1),
      discountPercent: 15,
      messageTemplate: '{نام_بیمار} گرامی؛ از اعتماد شما به کلینیک مینادنتال سپاسگزاریم. کد هدیه ۱۵٪ خدمات زیبایی و بلیچینگ ویژه شما و خانواده محترم: MINA-VIP',
      status: 'scheduled',
      conversionCount: 4,
      estimatedRevenue: 29000000,
      color: 'amber'
    }
  ];

  const [campaigns, setCampaigns] = useState<CampaignItem[]>(() => {
    try {
      const saved = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultCampaigns;
  });

  useEffect(() => {
    try {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
    } catch {}
  }, [campaigns]);

  const todayPersian = getCurrentPersianDate();

  const resolveSegment = (camp: CampaignItem): CampaignSegment => {
    if (camp.targetSegment) return camp.targetSegment;
    if (camp.id === 'cmp-1') return 'recall_6m';
    if (camp.id === 'cmp-2') return 'open_treatment';
    if (camp.id === 'cmp-3') return 'vip_settled';
    return 'all';
  };

  const getCohortDetails = (camp: CampaignItem): { list: Patient[]; isFallback: boolean } => {
    const seg = resolveSegment(camp);
    if (seg === 'recall_6m') {
      const stale = patients.filter(p => p.lastVisit && diffPersianDays(p.lastVisit, todayPersian) >= 180);
      return stale.length > 0 ? { list: stale, isFallback: false } : { list: patients, isFallback: true };
    }
    if (seg === 'open_treatment') {
      const openList = patients.filter(p =>
        p.activeTreatmentsCount > 0 ||
        (p.implantCases?.length || 0) > 0 ||
        Object.values(p.teethConditions || {}).some(t => t.status === 'planned' || t.status === 'in_progress')
      );
      return openList.length > 0 ? { list: openList, isFallback: false } : { list: patients, isFallback: true };
    }
    if (seg === 'vip_settled') {
      const vipList = patients.filter(p => p.balance >= 0);
      return vipList.length > 0 ? { list: vipList, isFallback: false } : { list: patients, isFallback: true };
    }
    return { list: patients, isFallback: false };
  };

  const totalEstimatedRevenue = useMemo(
    () => campaigns.reduce((sum, c) => sum + (c.estimatedRevenue || 0), 0),
    [campaigns]
  );

  const totalConversions = useMemo(
    () => campaigns.reduce((sum, c) => sum + (c.conversionCount || 0), 0),
    [campaigns]
  );

  const handleScheduleCampaignReminder = (camp: CampaignItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    impactLight();
    const { list: cohort } = getCohortDetails(camp);
    const samplePatient = cohort[0] || patients[0];
    scheduleEntityReminder({
      sourceType: 'recall',
      sourceId: camp.id,
      patientId: samplePatient?.id,
      patientName: samplePatient?.fullName || 'جامعه هدف کمپین',
      patientPhone: samplePatient?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      title: `یادآور اجرای کمپین «${camp.title}» (${toPersianDigits(cohort.length)} بیمار)`,
      description: `تخفیف ${toPersianDigits(camp.discountPercent)}٪ · آورده پیش‌بینی‌شده: ${formatToman(camp.estimatedRevenue)}`,
      targetDate: todayPersian,
      targetTime: '۱۰:۳۰',
      targetView: 'marketing',
      config: {
        enabled: true,
        preset: '1d_before',
        channels: ['in_app', 'phone_push'],
        note: `پیگیری تلفنی و پیامکی مراجعین کمپین ${camp.title}`
      }
    });
    success();
    triggerToast(`یادآور هوشمند پیگیری کمپین «${camp.title}» در مرکز یادآورهای مطب ثبت شد.`);
  };

  // D3.js CRM Campaign ROI, Audience & Conversion Analytics
  const d3CampaignAnalytics = useMemo(() => {
    const items = campaigns.map((c) => {
      const { list } = getCohortDetails(c);
      return {
        id: c.id,
        shortTitle: c.title.slice(0, 18),
        audience: Math.max(list.length, c.audienceCount || 1),
        conversions: c.conversionCount || 0,
        revenueM: Math.round((c.estimatedRevenue || 0) / 1_000_000)
      };
    });
    const width = 350;
    const height = 114;
    const xScale = d3
      .scaleBand<string>()
      .domain(items.map((d) => d.id))
      .range([26, width - 16])
      .padding(0.32);
    const maxRev = Math.max(10, d3.max(items, (d) => d.revenueM) || 85);
    const yScale = d3.scaleLinear().domain([0, maxRev * 1.15]).range([height - 22, 12]);
    return { items, width, height, xScale, yScale };
  }, [campaigns, patients]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleExpand = (id: string) => {
    selection();
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleCampaignStatus = (camp: CampaignItem) => {
    selection();
    const nextStatus: CampaignItem['status'] = camp.status === 'active' ? 'scheduled' : 'active';
    setCampaigns(prev => prev.map(c => (c.id === camp.id ? { ...c, status: nextStatus } : c)));
    triggerToast(
      nextStatus === 'active'
        ? `کمپین «${camp.title}» فعال شد.`
        : `کمپین «${camp.title}» در حالت زمان‌بندی/توقف قرار گرفت.`
    );
  };

  const handleExportMarketingCsv = () => {
    impactLight();
    const headers = ['عنوان کمپین', 'گروه هدف', 'تعداد مخاطبین', 'درصد تخفیف', 'وضعیت', 'تعداد جذب', 'آورده پیش‌بینی‌شده (تومان)'];
    const rows = campaigns.map(c => {
      const { list } = getCohortDetails(c);
      return [
        c.title,
        c.targetAudience,
        String(list.length),
        String(c.discountPercent),
        c.status === 'active' ? 'فعال' : 'زمان‌بندی‌شده',
        String(c.conversionCount),
        String(c.estimatedRevenue)
      ];
    });
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minadental-marketing-roi-${todayPersian.replace(/\//g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    success();
    triggerToast('گزارش اکسل کمپین‌ها و بازگشت سرمایه (CSV) دانلود شد.');
  };

  const verifyManagerPin = () => {
    let expectedPin = '1234';
    try {
      const stored = localStorage.getItem('minadental_manager_pin_v1');
      if (stored && stored.trim()) expectedPin = toEnglishDigits(stored.trim());
    } catch {}
    if (toEnglishDigits(pinInput.trim()) === expectedPin) {
      success();
      setManagerPinUnlocked(true);
      setShowPinPrompt(false);
      setPinInput('');
      setPinError(false);
      triggerToast('دسترسی مدیریتی بازاریابی و حذف کمپین فعال شد.');
    } else {
      impactHeavy();
      setPinError(true);
    }
  };

  const handleSendCampaign = async (campaign: CampaignItem) => {
    const { list: cohort } = getCohortDetails(campaign);
    setIsSendingId(campaign.id);
    const results = await Promise.allSettled(
      cohort.slice(0, 15).map((p) =>
        clinicalSmsService.sendPatternSms(
          p.phone,
          p.fullName,
          'campaign_promo',
          {
            title: campaign.title,
            discount: toPersianDigits(campaign.discountPercent),
            customText: campaign.messageTemplate.replace(/\{نام_بیمار\}/g, p.fullName)
          }
        )
      )
    );
    const sentOk = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    setIsSendingId(null);
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaign.id
          ? {
              ...c,
              status: 'active',
              audienceCount: cohort.length,
              conversionCount: c.conversionCount + (sentOk > 0 ? 1 : 0)
            }
          : c
      )
    );
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'patient',
      action: 'UPSERT',
      payload: { module: 'marketing_campaigns', campaignId: campaign.id, sentCount: cohort.length },
      actorName: 'سیستم بازاریابی و CRM',
      actorRole: 'admin',
      platform: 'CRM & Campaigns',
      eventType: 'CLOUD_BACKUP_SAVED',
      title: `ارسال کمپین پیامکی (${campaign.title})`,
      description: `پیامک کمپین با ${toPersianDigits(campaign.discountPercent)}٪ تخفیف برای ${toPersianDigits(cohort.length)} بیمار ارسال شد.`
    });
    success();
    triggerToast(
      sentOk > 0
        ? `کمپین «${campaign.title}» با موفقیت به ${toPersianDigits(sentOk)} بیمار واقعی از طریق درگاه پیامک ارسال شد.`
        : `کمپین «${campaign.title}» در صف ارسال پیامک ثبت گردید.`
    );
  };

  const handleDeleteCampaign = (id: string, title: string) => {
    if (!canManageCampaigns) {
      impactHeavy();
      setShowPinPrompt(true);
      triggerToast('حذف کمپین تبلیغاتی نیازمند تایید پین مدیر مطب است.');
      return;
    }
    if (confirmDeleteId !== id) {
      impactLight();
      setConfirmDeleteId(id);
      return;
    }
    impactHeavy();
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setConfirmDeleteId(null);
    actionFeedback.recordSuccess({
      title: `حذف کمپین تبلیغاتی «${title}»`,
      subtitle: 'بایگانی توسط مدیر کلینیک',
      diffAfter: 'حذف از لیست کمپین‌های فعال'
    });
    triggerToast(`کمپین «${title}» حذف شد.`);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const cohortSize = getCohortDetails({
      id: 'draft',
      title: newTitle,
      targetAudience: SEGMENT_LABELS[newSegment],
      targetSegment: newSegment,
      audienceCount: patients.length,
      discountPercent: Number(newDiscount) || 10,
      messageTemplate: newTemplate,
      status: 'active',
      conversionCount: 0,
      estimatedRevenue: 15000000,
      color: 'emerald'
    }).list.length;

    const created: CampaignItem = {
      id: `cmp-${Date.now()}`,
      title: newTitle.trim(),
      targetAudience: SEGMENT_LABELS[newSegment],
      targetSegment: newSegment,
      audienceCount: cohortSize,
      discountPercent: Number(newDiscount) || 10,
      messageTemplate: newTemplate,
      status: 'active',
      conversionCount: 0,
      estimatedRevenue: cohortSize * 3_500_000,
      color: 'emerald'
    };

    setCampaigns([created, ...campaigns]);
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'patient',
      action: 'UPSERT',
      payload: { module: 'marketing_campaigns', campaignId: created.id },
      actorName: 'دکتر مهدی امیری',
      actorRole: 'admin',
      platform: 'CRM & Campaigns',
      eventType: 'CLOUD_BACKUP_SAVED',
      title: `ایجاد کمپین تبلیغاتی جدید (${created.title})`,
      description: `کمپین با ${toPersianDigits(created.discountPercent)}٪ تخفیف برای ${toPersianDigits(cohortSize)} بیمار تعریف شد.`
    });
    actionFeedback.recordSuccess({
      title: `کمپین «${created.title}» فعال شد`,
      subtitle: `تخفیف: ${toPersianDigits(created.discountPercent)}٪ · جامعه هدف: ${toPersianDigits(cohortSize)} نفر`,
      canUndo: false
    });
    setNewTitle('');
    setShowNewModal(false);
    success();
    triggerToast('کمپین تبلیغاتی جدید با موفقیت ایجاد و فعال شد.');
  };

  const normalizeSearch = (val?: string) =>
    toEnglishDigits(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();

  const filteredCampaigns = campaigns.filter(c => {
    const q = normalizeSearch(searchQuery);
    const matchesSearch =
      !q ||
      normalizeSearch(c.title).includes(q) ||
      normalizeSearch(c.targetAudience).includes(q) ||
      normalizeSearch(c.messageTemplate).includes(q);
    if (!matchesSearch) return false;
    if (activeFilter === 'recall') return resolveSegment(c) === 'recall_6m' || c.id === 'cmp-1';
    if (activeFilter === 'vip') return resolveSegment(c) === 'vip_settled' || c.id === 'cmp-3';
    if (activeFilter === 'seasonal') return c.id !== 'cmp-1' && c.id !== 'cmp-3';
    return true;
  });

  return (
    <div dir="rtl" className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-4 right-4 z-50 max-w-md mx-auto bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-rose-400 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Module Header Card with Animated Search & Horizontal Scrollable Chips */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('rose')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-rose-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Megaphone className="w-4 h-4 stroke-[2.25]" />
              </div>
              <div className="text-right min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">تبلیغات، باشگاه مشتریان و فراخوان</h3>
                <span className="text-[10.5px] font-bold text-rose-800 mt-1 block tabular-nums truncate">
                  بازگشت سرمایه کمپین‌ها: {formatToman(totalEstimatedRevenue)} · جذب کل: {toPersianDigits(totalConversions)} بیمار
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {filteredCampaigns.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    if (expandedCampaigns.size > 0) {
                      setExpandedCampaigns(new Set());
                    } else {
                      setExpandedCampaigns(new Set(filteredCampaigns.map(c => c.id)));
                    }
                  }}
                  className="min-h-[38px] px-2.5 rounded-[12px] bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  {expandedCampaigns.size > 0 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span className="hidden xs:inline">{expandedCampaigns.size > 0 ? 'جمع کردن همه' : 'باز کردن همه'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجو در کمپین‌ها"
                aria-label="جستجو در کمپین‌ها"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>

              <button
                type="button"
                onClick={handleExportMarketingCsv}
                className="min-h-[40px] px-2.5 rounded-[12px] bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                title="دانلود خروجی اکسل کمپین‌ها"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">اکسل CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  impactLight();
                  setShowNewModal(!showNewModal);
                }}
                className="min-h-[40px] px-3 rounded-[12px] bg-gradient-to-l from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-xs font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>کمپین جدید</span>
              </button>
            </div>
          </div>

          {/* Animated Expandable Search Bar */}
          {searchOpen && (
            <div className="relative animate-in slide-in-from-top-1 duration-150">
              <Search className="w-3.5 h-3.5 text-rose-600 absolute right-3 top-2.5" />
              <input
                aria-label="جستجوی عنوان کمپین یا متن پیامک"
                type="text"
                autoFocus
                placeholder="جستجوی عنوان کمپین، مخاطب هدف یا متن پیامک..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-rose-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="پاک کردن جستجو"
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
              { id: 'all', label: 'همه کمپین‌ها' },
              { id: 'recall', label: 'فراخوان ۶ ماهه (Recall)' },
              { id: 'vip', label: 'باشگاه مراجعین VIP' },
              { id: 'seasonal', label: 'جشنواره‌های فصلی' },
              { id: 'roi_funnel_d3', label: 'قیف بازگشت سرمایه و جذب (D3.js)' },
              { id: 'sms_logs', label: `پیام و گزارش ارسال‌ها (${toPersianDigits(smsLogs.length)})` }
            ].map((tab, idx) => {
              const isActive = activeFilter === tab.id;
              return (
                <button role="tab" aria-selected={isActive}
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setActiveFilter(tab.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${getUnifiedChipClasses(idx + 5, isActive)}`}
                >
                  {tab.id === 'roi_funnel_d3' && <BarChart3 className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* D3.js CRM Campaign ROI & Patient Conversion Funnel Panel */}
      {activeFilter === 'roi_funnel_d3' && (
        <div data-testid="marketing-d3-roi-panel" className="mx-2 bg-gradient-to-br from-rose-50 via-white to-pink-50 rounded-[24px] p-3.5 border border-rose-200/90 shadow-[var(--shadow-card)] space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900">
                تحلیل D3.js بازگشت سرمایه (ROI) و نرخ تبدیل کمپین‌های باشگاه مشتریان
              </h4>
              <span className="text-[10.5px] font-bold text-rose-800 block mt-0.5">
                مجموع آورده کمپین‌ها: {formatToman(totalEstimatedRevenue)} · کل مراجعین جذب‌شده: {toPersianDigits(totalConversions)} نفر
              </span>
            </div>
            {campaigns[0] && (
              <button
                type="button"
                onClick={(e) => handleScheduleCampaignReminder(campaigns[0], e)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>ثبت یادآور اجرای فراخوان</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl p-3 border border-rose-200/80 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  آورده مالی پیش‌بینی‌شده (میلیون تومان)
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  تعداد جذب واقعی (نفر)
                </span>
              </div>
              <span className="font-mono font-black text-rose-700">
                {toPersianDigits(campaigns.length)} کمپین فعال
              </span>
            </div>

            <svg
              data-testid="marketing-d3-roi-svg"
              viewBox={`0 0 ${d3CampaignAnalytics.width} ${d3CampaignAnalytics.height}`}
              className="w-full h-28 overflow-visible"
            >
              <line
                x1={22}
                y1={d3CampaignAnalytics.height - 22}
                x2={d3CampaignAnalytics.width - 12}
                y2={d3CampaignAnalytics.height - 22}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              {d3CampaignAnalytics.items.map((item) => {
                const x = d3CampaignAnalytics.xScale(item.id) || 30;
                const bw = d3CampaignAnalytics.xScale.bandwidth();
                const baseY = d3CampaignAnalytics.height - 22;
                const barY = d3CampaignAnalytics.yScale(item.revenueM);
                const barH = Math.max(4, baseY - barY);
                return (
                  <g key={item.id}>
                    <rect
                      x={x}
                      y={barY}
                      width={bw}
                      height={barH}
                      rx={5}
                      fill="#e11d48"
                      fillOpacity={0.85}
                    />
                    <text
                      x={x + bw / 2}
                      y={Math.max(10, barY - 4)}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#881337"
                      fontWeight="bold"
                    >
                      {toPersianDigits(item.revenueM)}M ({toPersianDigits(item.conversions)} نفر)
                    </text>
                    <text
                      x={x + bw / 2}
                      y={baseY + 12}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#334155"
                      fontWeight="bold"
                    >
                      {item.shortTitle}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Inline Manager PIN Unlock Strip if non-manager attempts delete */}
      {!canManageCampaigns && showPinPrompt && (
        <div className="mx-2 p-3 rounded-[20px] bg-amber-50 border border-amber-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-amber-900 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-700" />
            <span>احراز هویت مدیر برای حذف کمپین:</span>
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="password"
              aria-label="پین مدیر بازاریابی"
              dir="ltr"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              placeholder="PIN (1234)"
              className="w-28 bg-white border border-amber-300 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={verifyManagerPin}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
            >
              تایید مدیر
            </button>
            <button
              type="button"
              onClick={() => setShowPinPrompt(false)}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
            >
              بستن
            </button>
            {pinError && <span className="text-[10.5px] font-bold text-rose-600">پین نادرست است</span>}
          </div>
        </div>
      )}

      {/* Create Campaign Form */}
      {showNewModal && (
        <form onSubmit={handleCreateCampaign} className="mx-2 bg-white rounded-[24px] p-4 border-2 border-rose-200 shadow-md space-y-3 text-xs animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-black text-slate-900">تعریف کمپین پیامکی و جشنواره تخفیف جدید</span>
            <button type="button" onClick={() => setShowNewModal(false)} className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer">بستن</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2">
              <label className="text-slate-700 font-bold block mb-1">عنوان کمپین تبلیغاتی</label>
              <input
                aria-label="عنوان کمپین تبلیغاتی"
                type="text"
                required
                placeholder="مثال: جشنواره ایمپلنت و طراحی لبخند پاییزه"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label htmlFor="new-campaign-segment" className="text-slate-700 font-bold block mb-1">گروه هدف کمپین</label>
              <select
                id="new-campaign-segment"
                aria-label="گروه هدف کمپین"
                value={newSegment}
                onChange={(e) => setNewSegment(e.target.value as CampaignSegment)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:outline-none focus:border-rose-500"
              >
                <option value="recall_6m">فراخوان تأخیر ۶ ماهه</option>
                <option value="open_treatment">طرح درمان باز پالمر</option>
                <option value="vip_settled">بیماران خوش‌حساب VIP</option>
                <option value="all">همه بیماران مطب</option>
              </select>
            </div>
            <div>
              <label className="text-slate-700 font-bold block mb-1">درصد هدیه / تخفیف (%)</label>
              <input aria-label="درصد هدیه / تخفیف (%)"
                type="number"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold text-center focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-bold block">متن پیامک ارسالی به بیماران</label>
              <span className="text-[10px] font-mono font-bold text-rose-700">
                {toPersianDigits(newTemplate.length)} کاراکتر ({toPersianDigits(Math.max(1, Math.ceil(newTemplate.length / 70)))} صفحه پیامک فارسی)
              </span>
            </div>
            <textarea aria-label="متن پیامک ارسالی به بیماران"
              rows={2}
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 leading-relaxed focus:outline-none focus:border-rose-500"
            />
            {patients[0] && (
              <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200/70 text-[10.5px] text-rose-950">
                <span className="font-black text-rose-700">پیش‌نمایش زنده: </span>
                {newTemplate.replace(/\{نام_بیمار\}/g, patients[0].fullName)}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              ذخیره و فعال‌سازی کمپین
            </button>
          </div>
        </form>
      )}

      {/* Quick SMS Messaging & Outbox Delivery Logs Chip */}
      {activeFilter === 'sms_logs' ? (
        <div className="mx-2 space-y-3">
          <div className="bg-white rounded-[24px] p-4 border border-rose-200/90 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-rose-600" />
                <h4 className="font-black text-slate-900">ارسال سریع پیامک خدماتی و مرکز گزارش ارسال‌ها</h4>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-black text-[10.5px]">
                شارژ پنل پیامک: {toPersianDigits(smsCredit)} عدد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">انتخاب بیمار</label>
                <select
                  aria-label="انتخاب بیمار برای پیامک سریع"
                  value={quickSmsPatientId}
                  onChange={(e) => setQuickSmsPatientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:outline-none focus:border-rose-500"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({toPersianDigits(p.phone)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-6">
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">متن پیامک خدماتی</label>
                <input
                  aria-label="متن پیامک سریع"
                  type="text"
                  value={quickSmsText}
                  onChange={(e) => setQuickSmsText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  disabled={sendingQuickSms}
                  onClick={async () => {
                    const target = patients.find((p) => p.id === quickSmsPatientId) || patients[0];
                    if (!target || !quickSmsText.trim()) return;
                    setSendingQuickSms(true);
                    const res = await clinicalSmsService.sendPatternSms(
                      target.phone,
                      target.fullName,
                      'custom',
                      { customText: quickSmsText.trim() }
                    );
                    setSendingQuickSms(false);
                    setSmsLogs([...clinicalSmsService.getLogs()]);
                    setSmsCredit(res.remainingCredit);
                    if (res.success) {
                      success();
                      triggerToast(`پیامک تکی برای ${target.fullName} ارسال شد (${res.refId}).`);
                    } else {
                      triggerToast(res.message);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 -scale-x-100" />
                  <span>{sendingQuickSms ? 'در حال ارسال...' : 'ارسال پیامک'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="font-black text-slate-800 block">
                تاریخچه پیامک‌های ارسالی و تاییدیه مخابرات ({toPersianDigits(smsLogs.length)} مورد)
              </span>
              {smsLogs.length === 0 ? (
                <div className="p-4 text-center rounded-2xl bg-slate-50 text-slate-500 font-bold">
                  هنوز پیامکی از پنل ارسال نشده است؛ می‌توانید همین بالا پیامک سریع بفرستید.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
                  {smsLogs.slice(0, 25).map((log) => (
                    <div key={log.id} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900">{log.recipientName}</span>
                          <span className="font-mono text-[10px] text-slate-600" dir="ltr">{toPersianDigits(log.recipientMobile)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-black text-[9.5px]">
                            {log.deliveryReceipt || 'ارسال موفق ✓'}
                          </span>
                          <span className="font-mono text-[9.5px] text-slate-500">{log.refId}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{log.messageText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
      /* Campaigns List (Default-Collapsed with Numbered Badges & Accent Borders) */
      <div className="mx-2 space-y-2.5">
        {filteredCampaigns.map((camp, index) => {
          const isExpanded = expandedCampaigns.has(camp.id);
          const borderAccent = camp.status === 'active' ? 'border-r-rose-500' : 'border-r-amber-500';
          const { list: cohort, isFallback } = getCohortDetails(camp);

          return (
            <div
              key={camp.id}
              className={`bg-white rounded-[20px] border border-slate-200/90 border-r-[3px] ${borderAccent} shadow-[var(--shadow-card)] overflow-hidden transition-all ${
                isExpanded ? 'p-3.5 space-y-3 ring-1 ring-rose-200' : 'p-2.5 hover:bg-slate-50/70'
              }`}
            >
              {/* Compact Header Row */}
              <div
                onClick={() => toggleExpand(camp.id)}
                className="flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-black">
                      <Gift className="w-4 h-4 stroke-[2.4]" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-mono font-black flex items-center justify-center border border-white shadow-2xs">
                      #{toPersianDigits(index + 1)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 truncate">{camp.title}</h4>
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200">
                        {toPersianDigits(camp.discountPercent)}٪ تخفیف
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                      مخاطب هدف: {toPersianDigits(cohort.length)} بیمار · جذب: {toPersianDigits(camp.conversionCount)} نفر
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold ${
                    camp.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {camp.status === 'active' ? 'فعال' : 'زمان‌بندی‌شده'}
                  </span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isExpanded ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Collapsible Content */}
              {isExpanded && (
                <div className="pt-2.5 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed">
                    <span className="font-bold text-rose-700 block mb-0.5">الگوی پیامک هوشمند:</span>
                    {camp.messageTemplate}
                  </div>

                  {cohort.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                      <span className="font-black text-slate-600">
                        مخاطبین هدف ({toPersianDigits(cohort.length)} پرونده{isFallback ? ' · کل پرونده‌های پیشنهادی' : ''}):
                      </span>
                      {cohort.slice(0, 6).map((pat) => (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() => onOpenPatientFile?.(pat, 'treatments')}
                          className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen className="w-2.5 h-2.5 text-rose-600" />
                          <span>{pat.fullName}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-slate-600">
                        مخاطبین فعال: <strong className="font-mono text-slate-900">{toPersianDigits(cohort.length)} پرونده</strong>
                      </span>
                      <span className="text-emerald-700 font-bold">
                        آورده مالی: <strong className="font-mono">{formatToman(camp.estimatedRevenue)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleToggleCampaignStatus(camp)}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        {camp.status === 'active' ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>توقف موقت</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>فعال‌سازی</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleScheduleCampaignReminder(camp, e)}
                        className="py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5 text-amber-600" />
                        <span>یادآور فراخوان</span>
                      </button>
                      {!canManageCampaigns ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id, camp.title)}
                          className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>قفل حذف مدیر</span>
                        </button>
                      ) : confirmDeleteId === camp.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="py-1.5 px-2.5 rounded-xl bg-slate-100 text-slate-700 text-[10.5px] font-bold cursor-pointer"
                          >
                            انصراف
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(camp.id, camp.title)}
                            className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 text-[10.5px] font-black flex items-center gap-1 cursor-pointer animate-pulse"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>تایید حذف ✓</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id, camp.title)}
                          className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isSendingId === camp.id}
                        onClick={() => handleSendCampaign(camp)}
                        className="py-1.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[11px] font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 -scale-x-100" />
                        <span>{isSendingId === camp.id ? 'در حال ارسال...' : 'ارسال گروهی واقعی به بیماران'}</span>
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
