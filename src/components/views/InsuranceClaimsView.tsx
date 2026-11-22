import React, { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Shield, CheckCircle2, Search, X,
  Download, ChevronDown, ChevronUp, Trash2, FolderOpen,
  BarChart3, BellRing, FileSpreadsheet, Printer
} from 'lucide-react';
import { Patient } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, getCurrentPersianDate } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { syncEngine } from '../../services/syncEngine';
import { actionFeedback } from '../../utils/actionFeedback';
import { scheduleEntityReminder } from '../../services/reminderNotificationService';

interface InsuranceClaim {
  id: string;
  patientId?: string;
  patientName: string;
  nationalId: string;
  insurerName: 'بیمه دانا' | 'ایران' | 'آسیا' | 'البرز' | 'تامین اجتماعی' | 'بانک ملت / سپه';
  serviceName: string;
  tariffCode: string;
  toothNumber: string;
  totalFee: number;
  insuranceShare: number;
  patientShare: number;
  franchisePercent: number;
  trackingCode: string;
  date: string;
  status: 'pending_review' | 'submitted_xml' | 'paid_settled';
}

interface InsuranceClaimsViewProps {
  patients: Patient[];
  onOpenPatientFile?: (patient: Patient, tab?: any) => void;
  onRecordInsurancePayment?: (patientId: string, amount: number, insurerName: string, trackingCode: string) => void;
}

const INSURANCE_STORAGE_KEY = 'minadental_insurance_claims_v1';

export const InsuranceClaimsView: React.FC<InsuranceClaimsViewProps> = ({
  patients,
  onOpenPatientFile,
  onRecordInsurancePayment
}) => {
  const { selection, impactLight, success } = useHapticFeedback();
  const [activeChip, setActiveChip] = useState<'all' | 'supplementary' | 'social' | 'analytics_d3' | 'new_claim'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(() => new Set());

  const toggleExpandClaim = (id: string) => {
    setExpandedClaims(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const defaultClaims: InsuranceClaim[] = [
    {
      id: 'ins-201',
      patientId: patients[0]?.id,
      patientName: patients[0]?.fullName || 'سارا رادمهر',
      nationalId: patients[0]?.nationalId || '۰۰۱۲۳۴۵۶۷۸',
      insurerName: 'بیمه دانا',
      serviceName: 'جراحی ایمپلنت و روکش زیرکونیا',
      tariffCode: 'D6010-IR',
      toothNumber: 'UR6',
      totalFee: 18500000,
      insuranceShare: 14800000,
      patientShare: 3700000,
      franchisePercent: 20,
      trackingCode: 'DANA-994821',
      date: getCurrentPersianDate(),
      status: 'submitted_xml'
    },
    {
      id: 'ins-202',
      patientId: patients[1]?.id,
      patientName: patients[1]?.fullName || 'امیرحسین محمدی',
      nationalId: patients[1]?.nationalId || '۰۰۷۸۹۱۲۳۴۵',
      insurerName: 'بانک ملت / سپه',
      serviceName: 'درمان ریشه سه‌کاناله + بازسازی تاج',
      tariffCode: 'D3330-IR',
      toothNumber: 'LL6',
      totalFee: 6800000,
      insuranceShare: 6120000,
      patientShare: 680000,
      franchisePercent: 10,
      trackingCode: 'BNK-442910',
      date: getCurrentPersianDate(),
      status: 'paid_settled'
    }
  ];

  const [claims, setClaims] = useState<InsuranceClaim[]>(() => {
    try {
      const saved = localStorage.getItem(INSURANCE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultClaims;
  });

  const didMountClaimsRef = React.useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(INSURANCE_STORAGE_KEY, JSON.stringify(claims));
      if (didMountClaimsRef.current) {
        window.dispatchEvent(new CustomEvent('minadental:reminders-updated'));
      } else {
        didMountClaimsRef.current = true;
      }
    } catch {}
  }, [claims]);

  // New Claim State
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [insurerName, setInsurerName] = useState<InsuranceClaim['insurerName']>('بیمه دانا');
  const [serviceName, setServiceName] = useState('درمان ریشه و ترمیم کامپوزیت');
  const [toothNumber, setToothNumber] = useState('UR6');
  const [tariffCode, setTariffCode] = useState('D3330-IR');
  const [totalFee, setTotalFee] = useState('5500000');
  const [franchisePercent, setFranchisePercent] = useState('20');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const resolvePatient = (claim: InsuranceClaim): Patient | undefined =>
    patients.find((p) => (claim.patientId && p.id === claim.patientId) || p.fullName === claim.patientName);

  const handleExportXmlDisk = () => {
    const xmlRows = claims.map(c =>
      `  <Claim id="${c.id}" trackingCode="${c.trackingCode}" insurer="${c.insurerName}" nationalId="${c.nationalId}" patient="${c.patientName}" tooth="${c.toothNumber}" tariff="${c.tariffCode}" totalFee="${c.totalFee}" insuranceShare="${c.insuranceShare}" patientShare="${c.patientShare}" status="${c.status}" date="${c.date}" />`
    ).join('\n');
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<MinaDentalInsuranceBatch clinic="مرکز تخصصی دندانپزشکی مینادنتال" exportedAt="${getCurrentPersianDate()}">\n${xmlRows}\n</MinaDentalInsuranceBatch>`;
    try {
      const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minadental-insurance-${getCurrentPersianDate().replace(/\//g, '-')}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    success();
    showToast(`دیسک XML شامل ${toPersianDigits(claims.length)} حواله بیمه دانلود شد.`);
  };

  const handleExportCsvAccounting = () => {
    const headers = ['کد رهگیری', 'بیمار', 'کد ملی', 'سازمان بیمه', 'خدمت درمانی', 'دندان', 'کد تعرفه', 'تعرفه کل', 'سهم بیمه', 'فرانشیز بیمار', 'تاریخ', 'وضعیت'];
    const rows = claims.map(c => [
      c.trackingCode,
      c.patientName,
      c.nationalId,
      c.insurerName,
      c.serviceName,
      c.toothNumber,
      c.tariffCode,
      String(c.totalFee),
      String(c.insuranceShare),
      String(c.patientShare),
      c.date,
      c.status === 'paid_settled' ? 'تسویه‌شده' : c.status === 'submitted_xml' ? 'ارسال XML' : 'در انتظار بررسی'
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minadental-insurance-claims-${getCurrentPersianDate().replace(/\//g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    success();
    showToast(`گزارش اکسل CSV شامل ${toPersianDigits(claims.length)} پرونده بیمه ذخیره شد.`);
  };

  const handleAddClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPat = patients.find(p => p.id === selectedPatientId) || patients[0];
    const fee = Math.max(0, Number(totalFee) || 5000000);
    const fran = Math.min(100, Math.max(0, Number(franchisePercent) || 20));
    const patShare = Math.round((fee * fran) / 100);
    const insShare = fee - patShare;

    const newClaim: InsuranceClaim = {
      id: `ins-${Date.now()}`,
      patientId: targetPat?.id,
      patientName: targetPat?.fullName || 'مراجع کلینیک',
      nationalId: targetPat?.nationalId || '۰۰۰۰۰۰۰۰۰۰',
      insurerName,
      serviceName: serviceName.trim() || 'درمان تخصصی دندانپزشکی',
      tariffCode: tariffCode.trim() || `D${Math.floor(2000 + Math.random() * 5000)}-IR`,
      toothNumber: toothNumber.trim().toUpperCase() || 'UR6',
      totalFee: fee,
      insuranceShare: insShare,
      patientShare: patShare,
      franchisePercent: fran,
      trackingCode: `INS-${Math.floor(100000 + Math.random() * 899999)}`,
      date: getCurrentPersianDate(),
      status: 'pending_review'
    };

    const nextClaims = [newClaim, ...claims];
    setClaims(nextClaims);
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'payment',
      action: 'UPSERT',
      payload: { module: 'insurance_claims', claimId: newClaim.id, trackingCode: newClaim.trackingCode },
      actorName: 'پذیرش و بیمه مینادنتال',
      actorRole: 'secretary',
      platform: 'Insurance Claims Engine',
      eventType: 'PAYMENT_COLLECTED',
      title: `صدور معرفی‌نامه بیمه (${insurerName})`,
      description: `حواله بیمه ${insurerName} برای «${newClaim.patientName}» به مبلغ سهم بیمه ${formatToman(insShare)} صادر گردید.`
    });
    actionFeedback.recordSuccess({
      title: `معرفی‌نامه ${insurerName} صادر شد`,
      subtitle: `${newClaim.patientName} · کد رهگیری: ${newClaim.trackingCode}`,
      diffBefore: 'بدون معرفی‌نامه',
      diffAfter: `سهم بیمه: ${formatToman(insShare)}`,
      canUndo: false
    });
    success();
    showToast(`حواله بیمه ${insurerName} برای ${newClaim.patientName} با موفقیت صادر شد.`);
    setActiveChip('all');
  };

  const handleAdvanceToXml = (claim: InsuranceClaim) => {
    impactLight();
    setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: 'submitted_xml' } : c));
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'payment',
      action: 'UPSERT',
      payload: { module: 'insurance_claims', claimId: claim.id, status: 'submitted_xml' },
      actorName: 'پذیرش و بیمه مینادنتال',
      actorRole: 'secretary',
      platform: 'Insurance Claims Engine',
      eventType: 'CLOUD_BACKUP_SAVED',
      title: `ارسال الکترونیک نسخه بیمه (${claim.trackingCode})`,
      description: `نسخه بیمه «${claim.patientName}» در قالب XML به سامانه ${claim.insurerName} ارسال گردید.`
    });
    showToast(`نسخه ${claim.trackingCode} در قالب استاندارد XML به سامانه ${claim.insurerName} ارسال شد.`);
  };

  const handleMarkSettled = (claim: InsuranceClaim) => {
    impactLight();
    setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: 'paid_settled' } : c));
    const pat = resolvePatient(claim);
    if (pat && onRecordInsurancePayment) {
      onRecordInsurancePayment(pat.id, claim.insuranceShare, claim.insurerName, claim.trackingCode);
    }
    syncEngine.recordOfflineOrLiveMutation({
      entity: 'payment',
      action: 'UPSERT',
      payload: { module: 'insurance_claims', claimId: claim.id, amount: claim.insuranceShare },
      actorName: 'صندوق و بیمه کلینیک',
      actorRole: 'admin',
      platform: 'Insurance Claims Engine',
      eventType: 'PAYMENT_COLLECTED',
      title: `تسویه سهم بیمه (${claim.insurerName})`,
      description: `مبلغ ${formatToman(claim.insuranceShare)} بابت حواله ${claim.trackingCode} (${claim.patientName}) تسویه و ثبت شد.`
    });
    showToast(`واریز سهم بیمه (${formatToman(claim.insuranceShare)}) تایید و در دفتر مالی بیمار ثبت شد.`);
  };

  const handleDeleteClaim = (id: string, trackingCode: string) => {
    if (confirmDeleteId !== id) {
      impactLight();
      setConfirmDeleteId(id);
      return;
    }
    impactLight();
    setClaims(prev => prev.filter(c => c.id !== id));
    setConfirmDeleteId(null);
    showToast(`حواله بیمه ${trackingCode} حذف شد.`);
  };

  const normalizeClaim = (val?: string) =>
    toEnglishDigits(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();

  const filteredClaims = claims.filter(c => {
    const q = normalizeClaim(searchQuery);
    const matchSearch =
      !q ||
      normalizeClaim(c.patientName).includes(q) ||
      normalizeClaim(c.insurerName).includes(q) ||
      normalizeClaim(c.trackingCode).includes(q);
    if (activeChip === 'supplementary') return matchSearch && c.insurerName !== 'تامین اجتماعی';
    if (activeChip === 'social') return matchSearch && c.insurerName === 'تامین اجتماعی';
    return matchSearch;
  });

  const handleScheduleInsuranceReminder = (claim: InsuranceClaim, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    impactLight();
    const matchedPat = resolvePatient(claim);
    scheduleEntityReminder({
      sourceType: 'insurance',
      sourceId: claim.id,
      patientId: matchedPat?.id || claim.patientId,
      patientName: claim.patientName,
      patientPhone: matchedPat?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      title: `پیگیری وصول مطالبات ${claim.insurerName} (${claim.patientName})`,
      description: `کد رهگیری: ${claim.trackingCode} · سهم بیمه: ${formatToman(claim.insuranceShare)} · خدمت: ${claim.serviceName}`,
      targetDate: claim.date || getCurrentPersianDate(),
      targetTime: '۱۱:۰۰',
      targetView: 'insurance_claims',
      config: {
        enabled: true,
        preset: '1d_before',
        channels: ['in_app', 'phone_push'],
        note: `استعلام واریز حواله ${claim.trackingCode} از سامانه ${claim.insurerName}`
      }
    });
    success();
    showToast(`یادآور هوشمند پیگیری مطالبات بیمه «${claim.insurerName}» (${claim.trackingCode}) ثبت شد.`);
  };

  // D3.js Insurer Receivables & Settlement Breakdown Analytics
  const d3InsurerAnalytics = useMemo(() => {
    const grouped = new Map<string, { insurer: string; settled: number; pending: number; patientCopay: number; count: number }>();
    for (const c of claims) {
      const prev = grouped.get(c.insurerName) || { insurer: c.insurerName, settled: 0, pending: 0, patientCopay: 0, count: 0 };
      if (c.status === 'paid_settled') prev.settled += c.insuranceShare;
      else prev.pending += c.insuranceShare;
      prev.patientCopay += c.patientShare;
      prev.count += 1;
      grouped.set(c.insurerName, prev);
    }
    const items = Array.from(grouped.values());
    const width = 350;
    const height = 112;
    const xScale = d3
      .scaleBand<string>()
      .domain(items.map((d) => d.insurer))
      .range([24, width - 16])
      .padding(0.32);
    const maxVal = Math.max(1000000, d3.max(items, (d) => d.settled + d.pending) || 15000000);
    const yScale = d3.scaleLinear().domain([0, maxVal * 1.12]).range([height - 22, 12]);

    return { items, width, height, xScale, yScale };
  }, [claims]);

  const totalInsuranceReceivable = claims.reduce((sum, c) => sum + c.insuranceShare, 0);
  const pendingInsuranceReceivable = claims
    .filter(c => c.status !== 'paid_settled')
    .reduce((sum, c) => sum + c.insuranceShare, 0);

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3 select-none" dir="rtl">
      {toastMsg && (
        <div className="fixed top-14 inset-x-4 z-50 max-w-md mx-auto bg-blue-950 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-blue-400/40 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('blue')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-blue-200/70 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Shield className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm text-slate-900 leading-none truncate">بیمه پایه، تکمیلی و دیسک الکترونیک</h3>
                <span className="text-[10.5px] font-bold text-blue-800 mt-1 block tabular-nums truncate">
                  کل مطالبات: {formatToman(totalInsuranceReceivable)} · در انتظار واریز: {formatToman(pendingInsuranceReceivable)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {activeChip !== 'new_claim' && filteredClaims.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    if (expandedClaims.size > 0) {
                      setExpandedClaims(new Set());
                    } else {
                      setExpandedClaims(new Set(filteredClaims.map(c => c.id)));
                    }
                  }}
                  className="min-h-[38px] px-2.5 rounded-[12px] bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  {expandedClaims.size > 0 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span className="hidden xs:inline">{expandedClaims.size > 0 ? 'جمع کردن همه' : 'باز کردن همه'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                  searchOpen ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                aria-label="جستجو در اسناد بیمه"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExportCsvAccounting}
                className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                title="خروجی اکسل CSV مطالبات بیمه"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
                <span className="hidden sm:inline">اکسل CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportXmlDisk}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>خروجی دیسک بیمه</span>
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="relative my-2">
              <Search className="w-3.5 h-3.5 text-blue-600 absolute right-3 top-2.5" />
              <input
                aria-label="جستجوی بیمار، بیمه یا کد رهگیری"
                type="text"
                autoFocus
                placeholder="جستجوی نام بیمار، سازمان بیمه‌گر یا کد رهگیری..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-blue-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 focus:outline-none"
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
              { id: 'all', label: `همه نسخ بیمه (${toPersianDigits(claims.length)})` },
              { id: 'supplementary', label: 'بیمه‌های تکمیلی و بانک‌ها' },
              { id: 'social', label: 'تامین اجتماعی و سلامت' },
              { id: 'analytics_d3', label: 'تحلیل مطالبات و فرانشیز (D3.js)' },
              { id: 'new_claim', label: '+ صدور معرفی‌نامه جدید' }
            ].map((chip, idx) => (
              <button role="tab" aria-selected={activeChip === chip.id}
                key={chip.id}
                type="button"
                onClick={() => {
                  selection();
                  setActiveChip(chip.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${getUnifiedChipClasses(idx + 1, activeChip === chip.id)}`}
              >
                {chip.id === 'analytics_d3' && <BarChart3 className="w-3.5 h-3.5" />}
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeChip === 'analytics_d3' && (
        <div data-testid="insurance-d3-analytics-panel" className="mx-2 bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-[24px] p-3.5 border border-blue-200/90 shadow-[var(--shadow-card)] space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900">
                نمودار D3.js تفکیک مطالبات وصول‌شده و معوق سازمان‌های بیمه‌گر
              </h4>
              <span className="text-[10.5px] font-bold text-blue-800 block mt-0.5">
                مجموع مطالبات: {formatToman(totalInsuranceReceivable)} · معوق: {formatToman(pendingInsuranceReceivable)}
              </span>
            </div>
            {claims[0] && (
              <button
                type="button"
                onClick={(e) => handleScheduleInsuranceReminder(claims[0], e)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>ثبت یادآور استعلام دیسک بیمه</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl p-3 border border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  وصول‌شده (تسویه)
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  در انتظار واریز (XML)
                </span>
              </div>
              <span className="font-mono font-black text-blue-700">
                {toPersianDigits(claims.length)} پرونده فعال
              </span>
            </div>

            <svg
              data-testid="insurance-d3-analytics-svg"
              viewBox={`0 0 ${d3InsurerAnalytics.width} ${d3InsurerAnalytics.height}`}
              className="w-full h-28 overflow-visible"
            >
              <line
                x1={20}
                y1={d3InsurerAnalytics.height - 22}
                x2={d3InsurerAnalytics.width - 12}
                y2={d3InsurerAnalytics.height - 22}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              {d3InsurerAnalytics.items.map((item) => {
                const x = d3InsurerAnalytics.xScale(item.insurer) || 30;
                const bw = d3InsurerAnalytics.xScale.bandwidth();
                const baseY = d3InsurerAnalytics.height - 22;
                const settledY = d3InsurerAnalytics.yScale(item.settled);
                const settledH = Math.max(0, baseY - settledY);
                const totalY = d3InsurerAnalytics.yScale(item.settled + item.pending);
                const pendingH = Math.max(0, settledY - totalY);

                return (
                  <g key={item.insurer}>
                    {settledH > 0 && (
                      <rect
                        x={x}
                        y={settledY}
                        width={bw}
                        height={settledH}
                        rx={4}
                        fill="#10b981"
                      />
                    )}
                    {pendingH > 0 && (
                      <rect
                        x={x}
                        y={totalY}
                        width={bw}
                        height={pendingH}
                        rx={4}
                        fill="#f59e0b"
                      />
                    )}
                    <text
                      x={x + bw / 2}
                      y={Math.max(9, totalY - 3)}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#1e293b"
                      fontWeight="bold"
                    >
                      {toPersianDigits(Math.round((item.settled + item.pending) / 1000000))}M
                    </text>
                    <text
                      x={x + bw / 2}
                      y={baseY + 12}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#334155"
                      fontWeight="bold"
                    >
                      {item.insurer}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {activeChip === 'new_claim' ? (
        <form onSubmit={handleAddClaim} className="mx-2 bg-white rounded-[24px] p-4 border-2 border-blue-200 shadow-sm space-y-3 text-xs">
          <div className="font-black text-slate-900 border-b border-slate-100 pb-2">
            محاسبه خودکار فرانشیز و صدور پرونده بیمه تکمیلی
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">بیمار</label>
              <select aria-label="بیمار"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">سازمان بیمه‌گر طرف قرارداد</label>
              <select aria-label="سازمان بیمه‌گر طرف قرارداد"
                value={insurerName}
                onChange={(e) => setInsurerName(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
              >
                <option value="بیمه دانا">بیمه دانا (آنلاین سجاد)</option>
                <option value="بانک ملت / سپه">بیمه بانک ملت / سپه / تجارت</option>
                <option value="ایران">بیمه ایران</option>
                <option value="آسیا">بیمه آسیا</option>
                <option value="البرز">بیمه البرز</option>
                <option value="تامین اجتماعی">تامین اجتماعی</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">شرح خدمت درمانی</label>
              <input aria-label="شرح خدمت درمانی"
                type="text"
                required
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="مثلاً درمان ریشه ۳ کاناله + روکش زیرکونیا"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">دندان (پالمر)</label>
                <input aria-label="دندان پالمر بیمه"
                  type="text"
                  dir="ltr"
                  value={toothNumber}
                  onChange={(e) => setToothNumber(e.target.value)}
                  placeholder="UR6"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-black text-center text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">کد تعرفه بیمه</label>
                <input aria-label="کد تعرفه بیمه"
                  type="text"
                  dir="ltr"
                  value={tariffCode}
                  onChange={(e) => setTariffCode(e.target.value)}
                  placeholder="D3330-IR"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-black text-center text-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">مبلغ کل تعرفه (تومان)</label>
              <input aria-label="مبلغ کل تعرفه (تومان)"
                type="number"
                value={totalFee}
                onChange={(e) => setTotalFee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-black"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">درصد فرانشیز سهم بیمار (%)</label>
              <input aria-label="درصد فرانشیز سهم بیمار (%)"
                type="number"
                value={franchisePercent}
                onChange={(e) => setFranchisePercent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-black"
              />
            </div>
          </div>
          {(() => {
            const feeNum = Math.max(0, Number(totalFee) || 0);
            const franNum = Math.min(100, Math.max(0, Number(franchisePercent) || 0));
            const patSharePreview = Math.round((feeNum * franNum) / 100);
            const insSharePreview = feeNum - patSharePreview;
            return (
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px]">
                <div>
                  <span className="text-slate-600 block">پیش‌بینی سهم سازمان بیمه:</span>
                  <strong className="font-mono text-emerald-700">{formatToman(insSharePreview)}</strong>
                </div>
                <div>
                  <span className="text-slate-600 block">فرانشیز پرداختی بیمار:</span>
                  <strong className="font-mono text-rose-700">{formatToman(patSharePreview)}</strong>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setActiveChip('all')} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer">
              انصراف
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 text-white font-black cursor-pointer">
              ثبت حواله و استعلام آنلاین
            </button>
          </div>
        </form>
      ) : (
        <div className="mx-2 space-y-2.5">
          {filteredClaims.map((claim, index) => {
            const isExpanded = expandedClaims.has(claim.id);
            const borderAccent = claim.status === 'paid_settled' ? 'border-r-emerald-500' : claim.status === 'submitted_xml' ? 'border-r-sky-500' : 'border-r-amber-500';
            return (
              <div
                key={claim.id}
                className={`bg-white rounded-[20px] border border-slate-200/90 border-r-[3px] ${borderAccent} shadow-[var(--shadow-card)] transition-all ${
                  isExpanded ? 'p-3.5 space-y-2.5 ring-1 ring-blue-200' : 'p-2.5 hover:bg-slate-50/70'
                }`}
              >
                {/* Compact Header Row (Always Visible) */}
                <div
                  onClick={() => {
                    selection();
                    toggleExpandClaim(claim.id);
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black">
                        <Shield className="w-4 h-4 stroke-[2.4]" />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-mono font-black flex items-center justify-center border border-white shadow-2xs">
                        #{toPersianDigits(index + 1)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-slate-900 truncate">{claim.patientName}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-black text-[10px]">
                          {claim.insurerName}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
                        سهم بیمه: <span className="font-mono font-black text-emerald-700">{formatToman(claim.insuranceShare)}</span> · دندان {claim.toothNumber}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                      claim.status === 'paid_settled'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      {claim.status === 'paid_settled' ? 'تسویه‌شده ✓' : 'در انتظار واریز'}
                    </span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="pt-2.5 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold text-slate-700">
                      خدمت: {claim.serviceName} · کد ملی: <span className="font-mono">{claim.nationalId}</span> · کد تعرفه: <span className="font-mono text-blue-700">{claim.tariffCode}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80 text-[10.5px]">
                      <div>
                        <span className="text-slate-500 block">تعرفه کل:</span>
                        <span className="font-mono font-black text-slate-900">{formatToman(claim.totalFee)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">سهم سازمان بیمه:</span>
                        <span className="font-mono font-black text-emerald-700">{formatToman(claim.insuranceShare)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">فرانشیز بیمار ({toPersianDigits(claim.franchisePercent)}%):</span>
                        <span className="font-mono font-black text-rose-700">{formatToman(claim.patientShare)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-500">کد رهگیری: {claim.trackingCode}</span>
                        {confirmDeleteId === claim.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClaim(claim.id, claim.trackingCode)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>تایید حذف ✓</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteClaim(claim.id, claim.trackingCode)}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            impactLight();
                            showToast(`حواله بیمه ${claim.trackingCode} آماده چاپ شد.`);
                            try { window.print(); } catch {}
                          }}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          <span>چاپ برگه</span>
                        </button>
                        {onOpenPatientFile && (() => {
                          const matchedPat = resolvePatient(claim);
                          if (!matchedPat) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenPatientFile(matchedPat, 'financial')}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-black flex items-center gap-1 cursor-pointer"
                            >
                              <FolderOpen className="w-3 h-3 text-emerald-600" />
                              <span>پرونده مالی</span>
                            </button>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => handleScheduleInsuranceReminder(claim, e)}
                          className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-black flex items-center gap-1 cursor-pointer"
                        >
                          <BellRing className="w-3 h-3 text-amber-600" />
                          <span>یادآور پیگیری</span>
                        </button>
                        {claim.status === 'pending_review' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceToXml(claim)}
                            className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 font-black cursor-pointer"
                          >
                            ارسال XML به سامانه بیمه
                          </button>
                        )}
                        {claim.status !== 'paid_settled' && (
                          <button
                            type="button"
                            onClick={() => handleMarkSettled(claim)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black cursor-pointer"
                          >
                            تایید واریز بیمه به حساب مطب
                          </button>
                        )}
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
