import React, { useState } from 'react';
import { 
  FlaskConical, Plus, CheckCircle2, Clock, 
  AlertTriangle, Bell, Calendar, ChevronLeft,
  Truck, Sparkles, Shield, Send, Check, Search,
  Palette, FileText, Phone, Building2, Layers,
  DollarSign, ArrowUpRight, X, Settings2, SlidersHorizontal, Printer,
  ChevronDown, ChevronUp, Stethoscope, Edit3, Trash2, RotateCcw, QrCode, Copy, PackageCheck, MessageSquare, Box
} from 'lucide-react';
import { LabOrder, LabStatus, Patient, ReminderConfig } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, diffPersianDays, getCurrentPersianDate } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { LabPrescriptionModal } from '../LabPrescriptionModal';
import { getModuleHeaderCardClasses, getUnifiedChipClasses } from '../../utils/chipThemes';
import { useActionFeedback } from '../../utils/actionFeedback';
import { ArmedActionButton, CardMutationBadge } from '../ArmedActionButton';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { TrackableIdBadge } from '../TrackableIdBadge';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { clinicalSmsService } from '../../services/smsService';
import { copyTextSafely } from '../../utils/clipboard';
import { ReminderOptionPicker } from '../ReminderOptionPicker';
import { getDefaultReminderConfig, scheduleEntityReminder } from '../../services/reminderNotificationService';
import { evaluateMultiFieldFuzzySearch } from './PatientsListView';
import { Lab3DModelViewerD3 } from '../Lab3DModelViewerD3';

interface LabModuleViewProps {
  patients: Patient[];
  onOpenPatientFile: (patient: Patient, initialTab?: 'treatments' | 'financial' | 'prescriptions' | 'consents' | 'lab' | 'implant' | 'xrays' | 'ai') => void;
  onOpenPalmerChart?: (patient: Patient, toothText?: string) => void;
  onOpenPaymentModal?: (patient: Patient) => void;
  onOpenCheckModal?: (patient: Patient) => void;
  onNavigateToModule?: (targetView: string) => void;
  onAddLabOrder: () => void;
  onUpdateStatus: (orderId: string, status: LabStatus) => void;
  onEditLabOrder?: (orderId: string, updatedFields: Partial<LabOrder>) => void;
  onDeleteLabOrder?: (orderId: string) => void;
  onOpenDigitalLabPortal?: () => void;
  onScheduleLabDelivery?: (patient: Patient, order: LabOrder) => void;
  onOpenLabScanner?: () => void;
  isManager?: boolean;
}

interface PartnerLab {
  id: string;
  name: string;
  type: 'fixed' | 'removable' | 'both';
  typeTitle: string;
  phone: string;
  manager: string;
  address: string;
  avgTurnaroundDays: number;
  activeOrdersCount: number;
  unsettledBalance: number;
}

const DEFAULT_LABS: PartnerLab[] = [
  {
    id: 'lab-1',
    name: 'لابراتوار دیجیتال پیشرو (دکتر کمالی)',
    type: 'fixed',
    typeTitle: 'پروتز ثابت (زیرکونیا، PFM، ایمپلنت)',
    phone: '۰۲۱-۸۸۲۲۳۳۴۴',
    manager: 'مهندس کمالی',
    address: 'تهران، خیابان ولیعصر، بالاتر از ونک',
    avgTurnaroundDays: 5,
    activeOrdersCount: 4,
    unsettledBalance: 12500000
  },
  {
    id: 'lab-2',
    name: 'لابراتوار پروتز پویا (تخصصی متحرک)',
    type: 'removable',
    typeTitle: 'پروتز متحرک (دست‌دندان کامل، پارسیل، کروم کبالت، نایت‌گارد)',
    phone: '۰۲۱-۲۲۳۳۴۴۵۵',
    manager: 'استاد فراهانی',
    address: 'تهران، شریعتی، بالاتر از پل رومی',
    avgTurnaroundDays: 7,
    activeOrdersCount: 2,
    unsettledBalance: 8200000
  },
  {
    id: 'lab-3',
    name: 'لابراتوار زیبایی آریا E-Max',
    type: 'fixed',
    typeTitle: 'پروتز ثابت و زیبایی (لمینت سرامیکی، اینله/آنله)',
    phone: '۰۲۱-۸۸۷۷۶۶۵۵',
    manager: 'آقای صادقی',
    address: 'تهران، ملاصدرا، بعد از بیمارستان بقیه‌الله',
    avgTurnaroundDays: 4,
    activeOrdersCount: 1,
    unsettledBalance: 4500000
  }
];

export const LabModuleView: React.FC<LabModuleViewProps> = ({
  patients,
  onOpenPatientFile,
  onOpenPalmerChart,
  onOpenPaymentModal,
  onOpenCheckModal,
  onNavigateToModule,
  onAddLabOrder,
  onUpdateStatus,
  onEditLabOrder,
  onDeleteLabOrder,
  onOpenDigitalLabPortal,
  onScheduleLabDelivery,
  onOpenLabScanner,
  isManager = false
}) => {
  const { impactLight, impactHeavy, success, selection } = useHapticFeedback();
  const { getCardFeedbackClasses } = useActionFeedback();

  // Active Chip Tab: orders | scan3d | labs | reminders | settlements
  const [activeChip, setActiveChip] = useState<'orders' | 'scan3d' | 'labs' | 'reminders' | 'settlements'>('orders');
  const [selectedOrderIdFor3D, setSelectedOrderIdFor3D] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLab, setFilterLab] = useState<string>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<LabOrder | null>(null);
  const [pendingStageChange, setPendingStageChange] = useState<{ orderId: string; status: LabStatus; label: string } | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Full Edit Lab Order Modal states
  const [editingLabOrder, setEditingLabOrder] = useState<LabOrder | null>(null);
  const [editWorkType, setEditWorkType] = useState('');
  const [editLabName, setEditLabName] = useState('');
  const [editShade, setEditShade] = useState('A2');
  const [editToothNumber, setEditToothNumber] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editCost, setEditCost] = useState(2500000);
  const [editTrackingSlipCode, setEditTrackingSlipCode] = useState('');
  const [editReminderConfig, setEditReminderConfig] = useState<ReminderConfig>(() => getDefaultReminderConfig('1d_before'));

  const openEditOrderModal = (order: LabOrder) => {
    selection();
    setEditingLabOrder(order);
    setEditWorkType(order.workType);
    setEditLabName(order.labName);
    setEditShade(order.shade || 'A2');
    setEditToothNumber(order.toothNumber);
    setEditDeliveryDate(order.deliveryDate);
    setEditCost(order.cost || 2500000);
    setEditTrackingSlipCode(order.trackingSlipCode || `SLIP-${order.id.slice(-4).toUpperCase()}`);
    setEditReminderConfig(order.reminderConfig || getDefaultReminderConfig('1d_before'));
  };

  const handleCopyLabDispatchSlip = async (order: LabOrder) => {
    selection();
    const slipCode = order.trackingSlipCode || `SLIP-${order.id.slice(-4).toUpperCase()}`;
    const slipText = [
      `🦷 برگه اعزام لابراتوار کلینیک مینادنتال`,
      `کد قبض: ${slipCode}`,
      `بیمار: ${order.patientName}`,
      `دندان (پالمر): ${order.toothNumber}`,
      `نوع کار: ${order.workType}`,
      `شید رنگ: ${order.shade || 'A2'}`,
      `تاریخ ارسال: ${toPersianDigits(order.sendDate || '')}`,
      `موعد تحویل به مطب: ${toPersianDigits(order.deliveryDate)}`,
      `لابراتوار: ${order.labName}`
    ].join('\n');
    await copyTextSafely(slipText);
    showToast(`متن کامل ارسال لابراتوار (${slipCode}) کپی شد؛ آماده ارسال در واتساپ/پیامک لابراتوار.`);
  };

  const getPreviousStatus = (current: LabStatus): LabStatus | null => {
    switch (current) {
      case 'delivered_cemented': return 'ready_for_clinic';
      case 'ready_for_clinic': return 'frame_try_in';
      case 'frame_try_in': return 'fabrication';
      case 'fabrication': return 'sent';
      case 'sent': return null;
    }
  };

  const toggleOrderCollapse = (orderId: string) => {
    selection();
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Partner labs list & add modal (persisted in localStorage)
  const [partnerLabs, setPartnerLabs] = useState<PartnerLab[]>(() => {
    try {
      const saved = localStorage.getItem('minadental_partner_labs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_LABS;
  });
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [newLabName, setNewLabName] = useState('');
  const [newLabType, setNewLabType] = useState<'fixed' | 'removable' | 'both'>('fixed');
  const [newLabPhone, setNewLabPhone] = useState('');
  const [newLabManager, setNewLabManager] = useState('');

  useEscapeKey(showAddLabModal, () => setShowAddLabModal(false));
  useEscapeKey(Boolean(editingLabOrder), () => setEditingLabOrder(null));

  // Reminder settings state (persisted in localStorage)
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('minadental_lab_reminder_cfg_v1');
      if (saved) return JSON.parse(saved).reminderDaysBefore ?? 2;
    } catch {}
    return 2;
  });
  const [autoSmsToPatient, setAutoSmsToPatient] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('minadental_lab_reminder_cfg_v1');
      if (saved) return JSON.parse(saved).autoSmsToPatient ?? true;
    } catch {}
    return true;
  });
  const [labAlarmNotice, setLabAlarmNotice] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('minadental_lab_reminder_cfg_v1');
      if (saved) return JSON.parse(saved).labAlarmNotice ?? true;
    } catch {}
    return true;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('minadental_partner_labs_v1', JSON.stringify(partnerLabs));
    } catch {}
  }, [partnerLabs]);

  React.useEffect(() => {
    try {
      localStorage.setItem(
        'minadental_lab_reminder_cfg_v1',
        JSON.stringify({ reminderDaysBefore, autoSmsToPatient, labAlarmNotice })
      );
    } catch {}
  }, [reminderDaysBefore, autoSmsToPatient, labAlarmNotice]);

  const allLabOrders = patients.flatMap(p => p.labOrders || []);
  const todayJalali = getCurrentPersianDate();

  // Persisted partner lab settlement payments (toman settled per lab id)
  const [settledByLab, setSettledByLab] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('minadental_lab_settled_map_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const [customPayByLab, setCustomPayByLab] = useState<Record<string, string>>({});

  React.useEffect(() => {
    try {
      localStorage.setItem('minadental_lab_settled_map_v1', JSON.stringify(settledByLab));
    } catch {}
  }, [settledByLab]);

  const getLabFinancials = (lab: PartnerLab) => {
    const firstBrandKeyword = lab.name.split('(')[0].replace('لابراتوار', '').trim();
    const matchingOrders = allLabOrders.filter(
      o => o.labName === lab.name || (firstBrandKeyword.length > 2 && o.labName.includes(firstBrandKeyword.split(' ')[0]))
    );
    const liveOrdersTotal = matchingOrders.reduce((s, o) => s + (o.cost || 0), 0);
    const liveActiveCount = matchingOrders.filter(o => o.status !== 'delivered_cemented').length;
    const effectiveActiveCount = matchingOrders.length > 0 ? liveActiveCount : lab.activeOrdersCount;
    const grossPayable = Math.max(lab.unsettledBalance, liveOrdersTotal);
    const paidAlready = settledByLab[lab.id] || 0;
    const remainingBalance = Math.max(0, grossPayable - paidAlready);
    return {
      matchingOrders,
      liveOrdersTotal,
      effectiveActiveCount,
      grossPayable,
      paidAlready,
      remainingBalance
    };
  };

  const extractToothCode = (txt?: string) => (txt || '').match(/[A-Z]{2}[1-8]/i)?.[0]?.toUpperCase() || '';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getNextStatus = (current: LabStatus): LabStatus => {
    switch (current) {
      case 'sent': return 'fabrication';
      case 'fabrication': return 'frame_try_in';
      case 'frame_try_in': return 'ready_for_clinic';
      case 'ready_for_clinic': return 'delivered_cemented';
      case 'delivered_cemented': return 'delivered_cemented';
    }
  };

  const getNextStatusLabel = (current: LabStatus): string => {
    switch (current) {
      case 'sent': return 'ارتقا به: تراش CAD/CAM';
      case 'fabrication': return 'ارتقا به: امتحان فریم';
      case 'frame_try_in': return 'ثبت وصول کار در مطب';
      case 'ready_for_clinic': return 'سمان نهایی و تحویل';
      case 'delivered_cemented': return 'پایان یافته';
    }
  };

  const getStatusBadge = (status: LabStatus) => {
    switch (status) {
      case 'sent':
        return <span className="inline-flex items-center whitespace-nowrap shrink-0 bg-sky-100 text-sky-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-sky-300">۱. ارسال به لابراتوار</span>;
      case 'fabrication':
        return <span className="inline-flex items-center whitespace-nowrap shrink-0 bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-300">۲. تراش CAD/CAM و کوره</span>;
      case 'frame_try_in':
        return <span className="inline-flex items-center whitespace-nowrap shrink-0 bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-300">۳. امتحان فریم در دهان</span>;
      case 'ready_for_clinic':
        return <span className="inline-flex items-center whitespace-nowrap shrink-0 bg-[#c8ff00] text-black text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs border border-[#b8f000]">۴. آماده در مطب</span>;
      case 'delivered_cemented':
        return <span className="inline-flex items-center whitespace-nowrap shrink-0 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">۵. سمان و تحویل بیمار</span>;
    }
  };

  const filteredOrders = allLabOrders.filter(order => {
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'in_progress'
        ? order.status === 'sent' || order.status === 'fabrication' || order.status === 'frame_try_in'
        : order.status === filterStatus);
    const matchesLab = filterLab === 'all' || order.labName.includes(filterLab);
    if (!matchesStatus || !matchesLab) return false;
    if (!searchQuery.trim()) return true;
    const matchedPatient = patients.find(p => p.id === order.patientId || p.fullName === order.patientName);
    const fuzzy = evaluateMultiFieldFuzzySearch(searchQuery, [
      { value: order.patientName, label: 'نام بیمار' },
      { value: order.workType, label: 'نوع پروتز' },
      { value: order.toothNumber, label: 'شماره دندان', maxTypos: 1 },
      { value: order.labName, label: 'لابراتوار' },
      { value: order.trackingSlipCode, label: 'کد قبض', maxTypos: 1 },
      { value: matchedPatient?.phone, label: 'تلفن بیمار', maxTypos: 1 },
      { value: matchedPatient?.fileNumber, label: 'شماره پرونده', maxTypos: 1 }
    ]);
    return fuzzy.matched;
  });

  const totalCost = allLabOrders.reduce((sum, o) => sum + (o.cost || 0), 0);
  const readyCount = allLabOrders.filter(o => o.status === 'ready_for_clinic').length;
  const inFabricationCount = allLabOrders.filter(o => o.status === 'sent' || o.status === 'fabrication' || o.status === 'frame_try_in').length;
  const deliveredCount = allLabOrders.filter(o => o.status === 'delivered_cemented').length;

  const handleAddPartnerLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabName) return;
    success();
    const newLab: PartnerLab = {
      id: `lab-${Date.now()}`,
      name: newLabName,
      type: newLabType,
      typeTitle: newLabType === 'fixed' ? 'پروتز ثابت' : newLabType === 'removable' ? 'پروتز متحرک' : 'ثابت و متحرک',
      phone: newLabPhone || '۰۲۱-۸۸۰۰۰۰۰۰',
      manager: newLabManager || 'مدیریت لابراتوار',
      address: 'تهران',
      avgTurnaroundDays: newLabType === 'fixed' ? 5 : 7,
      activeOrdersCount: 0,
      unsettledBalance: 0
    };
    const nextLabs = [...partnerLabs, newLab];
    setPartnerLabs(nextLabs);
    try {
      localStorage.setItem('minadental_partner_labs_v1', JSON.stringify(nextLabs));
    } catch {}
    setShowAddLabModal(false);
    setNewLabName('');
    setNewLabPhone('');
    setNewLabManager('');
    showToast(`لابراتوار همکار «${newLab.name}» با موفقیت افزوده شد.`);
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-28 space-y-3">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-purple-50 border-2 border-purple-300 text-purple-950 p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-xs font-black">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative z-20 mx-2 mt-2 min-w-0">
        <div className={getModuleHeaderCardClasses('purple')}>
          
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-200/80 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-purple-600 to-violet-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <FlaskConical className="w-4.5 h-4.5 stroke-[2.25]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-black text-sm text-slate-950 leading-none truncate">لابراتوار پروتز و سرامیک</h3>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-black font-mono tabular-nums">
                    {toPersianDigits(allLabOrders.length)} سفارش
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Animated Search Toggle */}
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[38px] min-h-[38px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-purple-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجوی فازی در سفارشات لابراتوار"
                aria-label="جستجو در سفارشات"
              >
                <Search className="w-4 h-4" />
              </button>

              {onOpenDigitalLabPortal && (
                <button type="button"
                  onClick={() => {
                    impactLight();
                    onOpenDigitalLabPortal();
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="ورود به پورتال تکنسین دندانسازی"
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-700" />
                  <span className="hidden sm:inline">پورتال تکنسین</span>
                </button>
              )}

              {onOpenLabScanner && (
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    onOpenLabScanner();
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-900 font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="اسکن دوربین QR پاکت لابراتوار"
                >
                  <QrCode className="w-3.5 h-3.5 text-violet-700" />
                  <span className="hidden sm:inline">اسکن پاکت</span>
                </button>
              )}
            </div>
          </div>

          {/* Slim Single-Line Scrollable (Mobile) / 4-Column (Desktop) Interactive Clinical KPI Triage Strip */}
          <div className="flex sm:grid sm:grid-cols-4 overflow-x-auto no-scrollbar gap-1.5 pt-0.5 [&>button]:shrink-0 [&>button]:min-w-[148px] sm:[&>button]:min-w-0 [&>button]:py-1.5 [&>button]:px-2">
            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('orders');
                setFilterStatus('all');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'orders' && filterStatus === 'all'
                  ? 'bg-purple-100/90 border-purple-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-purple-50/60 border-purple-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">کل سفارشات پروتز</span>
                <span className="text-xs font-black text-purple-950 font-mono tabular-nums">
                  {toPersianDigits(allLabOrders.length)} مورد
                </span>
              </div>
              <FlaskConical className="w-4 h-4 text-purple-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('orders');
                setFilterStatus('in_progress');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'orders' && filterStatus === 'in_progress'
                  ? 'bg-amber-100/90 border-amber-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-amber-50/60 border-amber-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">در حال ساخت / تراش</span>
                <span className="text-xs font-black text-amber-800 font-mono tabular-nums">
                  {toPersianDigits(inFabricationCount)} در جریان
                </span>
              </div>
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('orders');
                setFilterStatus('ready_for_clinic');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'orders' && filterStatus === 'ready_for_clinic'
                  ? 'bg-emerald-100/90 border-emerald-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-emerald-50/60 border-emerald-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">آماده تحویل در مطب</span>
                <span className="text-xs font-black text-emerald-800 font-mono tabular-nums">
                  {toPersianDigits(readyCount)} آماده نصب ({toPersianDigits(deliveredCount)} تحویل)
                </span>
              </div>
              <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                selection();
                setActiveChip('settlements');
              }}
              className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                activeChip === 'settlements'
                  ? 'bg-violet-100/90 border-violet-400 shadow-2xs'
                  : 'bg-white/90 hover:bg-violet-50/60 border-violet-200/70'
              }`}
            >
              <div>
                <span className="text-[9.5px] font-bold text-slate-500 block">گردش مالی لابراتوار</span>
                <span className="text-xs font-black text-violet-900 font-mono tabular-nums">
                  {formatToman(totalCost)}
                </span>
              </div>
              <DollarSign className="w-4 h-4 text-violet-600 shrink-0" />
            </button>
          </div>

          {/* Animated Expandable Fuzzy Search Input */}
          {searchOpen && (
            <div className="relative animate-in slide-in-from-top-2 duration-150">
              <Search className="w-3.5 h-3.5 text-purple-600 absolute right-3 top-2.5" />
              <input
                aria-label="جستجوی لابراتوار یا کد قبض"
                type="text"
                autoFocus
                placeholder="جستجوی فازی نام بیمار (حتی با غلط تایپی)، دندان، کد قبض یا نوع روکش..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-purple-50/60 border border-purple-200 rounded-xl pr-9 pl-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              {searchQuery && (
                <button type="button"
                  aria-label="پاک کردن جستجو"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Row 2: Horizontal Scrollable Chip Bar + Pinned Inline Primary CTA (سفارش جدید) */}
          <div className="flex items-center gap-1.5 pt-0.5 min-w-0">
            <div role="tablist" aria-label="بخش‌های اصلی لابراتوار" className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'orders', label: `کارهای ارسالی و دریافتی (${toPersianDigits(allLabOrders.length)})`, icon: FlaskConical },
                { id: 'scan3d', label: 'بازرس سه‌بعدی اسکن (3D CAD/CAM)', icon: Box },
                { id: 'labs', label: `تعریف لابراتوارها (${toPersianDigits(partnerLabs.length)})`, icon: Building2 },
                { id: 'reminders', label: 'تنظیم یادآوری و آلارم', icon: Bell },
                { id: 'settlements', label: 'تسویه‌حساب مالی', icon: DollarSign }
              ].map((chip, idx) => {
                const IconComp = chip.icon;
                const isActive = activeChip === chip.id;
                return (
                  <button role="tab" aria-selected={isActive}
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      selection();
                      setActiveChip(chip.id as any);
                    }}
                    className={getUnifiedChipClasses(idx + 2, isActive)}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                impactHeavy();
                onAddLabOrder();
              }}
              className="shrink-0 min-h-[34px] py-1.5 px-3 rounded-xl bg-[#c8ff00] hover:bg-[#bce600] text-black font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer border border-lime-400"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>سفارش جدید</span>
            </button>
          </div>

        </div>
      </div>

      {/* TAB 1: ORDERS & 5-STAGE PROGRESS STEPPER */}
      {activeChip === 'orders' && (
        <div className="space-y-2.5 min-w-0 max-w-full">
          {/* Status Filter Badges + Expand/Collapse All Toggle */}
          <div className="mx-2 flex items-center justify-between gap-2 min-w-0">
            <div role="tablist" aria-label="بخش‌های ماژول" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
              {[
                { id: 'all', label: 'همه وضعیت‌ها' },
                { id: 'sent', label: 'ارسال شده' },
                { id: 'fabrication', label: 'تراش/کوره' },
                { id: 'frame_try_in', label: 'امتحان فریم' },
                { id: 'ready_for_clinic', label: 'آماده در مطب' },
                { id: 'delivered_cemented', label: 'تحویل نهایی' },
              ].map((tab, idx) => (
                <button role="tab" aria-selected={filterStatus === tab.id} type="button"
                  key={tab.id}
                  onClick={() => {
                    selection();
                    setFilterStatus(tab.id);
                  }}
                  className={`py-1 px-2.5 rounded-xl text-[11px] whitespace-nowrap cursor-pointer ${getUnifiedChipClasses(idx, filterStatus === tab.id)}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredOrders.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  selection();
                  const anyExpanded = filteredOrders.some(o => expandedOrders[o.id]);
                  if (anyExpanded) {
                    setExpandedOrders({});
                  } else {
                    const next: Record<string, boolean> = {};
                    filteredOrders.forEach(o => { next[o.id] = true; });
                    setExpandedOrders(next);
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 text-[10.5px] font-black flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
              >
                <span>{filteredOrders.some(o => expandedOrders[o.id]) ? 'جمع کردن همه' : 'باز کردن همه'}</span>
                {filteredOrders.some(o => expandedOrders[o.id]) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Orders List (Collapsible Compact Cards by Default) */}
          <div className="mx-2 grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
                سفارشی با این مشخصات یافت نشد.
              </div>
            ) : (
              filteredOrders.map((order, orderIdx) => {
                const stages: LabStatus[] = ['sent', 'fabrication', 'frame_try_in', 'ready_for_clinic', 'delivered_cemented'];
                const currentStageIndex = stages.indexOf(order.status);
                const isExpanded = !!expandedOrders[order.id];
                const matchedPatient = patients.find(p => p.id === order.patientId || p.fullName === order.patientName);

                const borderAccentClass =
                  order.status === 'ready_for_clinic'
                    ? 'border-emerald-300/90 border-r-[3px] border-r-emerald-500'
                    : order.status === 'delivered_cemented'
                    ? 'border-teal-200/90 border-r-[3px] border-r-teal-500'
                    : 'border-purple-200/90 border-r-[3px] border-r-purple-500';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-[20px] p-2.5 sm:p-3 shadow-[var(--shadow-card)] border ${borderAccentClass} space-y-2 hover:shadow-[var(--shadow-elevated)] transition-all ${getCardFeedbackClasses(order.id)}`}
                  >
                    {/* Compact Collapsible Header Row: Click anywhere to expand/collapse */}
                    <div
                      onClick={() => toggleOrderCollapse(order.id)}
                      className="flex items-center justify-between gap-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Numbered Visual Badge */}
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-900 border border-purple-200 flex items-center justify-center font-black text-xs shadow-2xs">
                            <FlaskConical className="w-4 h-4 text-purple-700" />
                          </div>
                          <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-purple-700 text-white font-mono text-[9.5px] font-black flex items-center justify-center shadow-2xs">
                            {toPersianDigits(orderIdx + 1)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-[13px] font-black text-slate-900 leading-tight">
                              {order.patientName}
                            </span>
                            {matchedPatient?.fileNumber && (
                              <span className="text-[10px] font-mono font-black bg-purple-50 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded-md">
                                {toPersianDigits(matchedPatient.fileNumber)}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-purple-800 bg-purple-100/80 border border-purple-300 px-1.5 py-0.2 rounded-md font-black">
                              {order.toothNumber}
                            </span>
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-600 mt-0.5 truncate">
                            {order.workType} · <span className="text-slate-500">{order.labName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getStatusBadge(order.status)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrderCollapse(order.id);
                          }}
                          className={`px-2 py-1 rounded-xl border text-[10px] font-black flex items-center gap-0.5 transition-all cursor-pointer ${
                            isExpanded
                              ? 'bg-purple-600 text-white border-purple-700'
                              : 'bg-slate-100 hover:bg-purple-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Standalone Clinic 1-Tap Action Strip (حتی بدون نصب برنامه در لابراتوار) */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center gap-1 flex-wrap">
                        {order.trackingSlipCode && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100/80 text-purple-900 font-mono font-black border border-purple-200">
                            {order.trackingSlipCode}
                          </span>
                        )}
                        {order.receivedAtClinicDate && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200">
                            وصول مطب: {toPersianDigits(order.receivedAtClinicDate)}
                          </span>
                        )}
                        {order.deliveredToPatientDate && (
                          <span className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono font-bold border border-teal-200">
                            تحویل بیمار: {toPersianDigits(order.deliveredToPatientDate)}
                          </span>
                        )}
                        {!order.receivedAtClinicDate && !order.deliveredToPatientDate && (
                          <span className="font-mono text-slate-500 font-bold">
                            موعد تحویل: <strong className="text-purple-800">{toPersianDigits(order.deliveryDate)}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selection();
                            setSelectedOrderIdFor3D(order.id);
                            setActiveChip('scan3d');
                          }}
                          className="min-h-[30px] px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 font-black flex items-center gap-1 cursor-pointer transition-colors"
                          title="بازرسی سه‌بعدی فایل اسکن داخل دهانی و طراحی CAD/CAM این سفارش"
                        >
                          <Box className="w-3 h-3 text-purple-700" />
                          <span>اسکن سه‌بعدی (3D)</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCopyLabDispatchSlip(order);
                          }}
                          className="min-h-[30px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 font-black flex items-center gap-1 cursor-pointer transition-colors"
                          title="کپی متن ارسال لابراتوار برای واتساپ/پیامک"
                        >
                          <Copy className="w-3 h-3" />
                          <span>کپی ارسال</span>
                        </button>

                        {(order.status === 'sent' || order.status === 'fabrication' || order.status === 'frame_try_in') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              impactHeavy();
                              onUpdateStatus(order.id, 'ready_for_clinic');
                              showToast(`کار لابراتوار «${order.patientName}» به عنوان دریافت‌شده در مطب ثبت شد و نوتیف تحویل به بیمار فعال گردید.`);
                            }}
                            className="min-h-[30px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>دریافت شد از لابراتوار ✓</span>
                          </button>
                        )}

                        {order.status === 'ready_for_clinic' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              impactHeavy();
                              onUpdateStatus(order.id, 'delivered_cemented');
                              showToast(`پروتز «${order.patientName}» به عنوان سمان و تحویل نهایی به بیمار ثبت شد.`);
                            }}
                            className="min-h-[30px] px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تحویل و سمان به بیمار ✓</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        {/* Secondary Details Bar when Expanded */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 text-[10px] text-slate-600 font-bold">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <TrackableIdBadge recordId={order.id} moduleKey="lab" variant="purple" />
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-black">
                              شید رنگ: {order.shade || 'A2'}
                            </span>
                            <span className="flex items-center gap-0.5 text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/70">
                              <Stethoscope className="w-2.5 h-2.5 text-teal-600" />
                              <span>دکتر مهدی امیری</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <span>ارسال: <strong className="text-slate-800">{toPersianDigits(order.sendDate || '۱۴۰۴/۰۲/۱۰')}</strong></span>
                            <span>تحویل: <strong className="text-purple-800">{toPersianDigits(order.deliveryDate)}</strong></span>
                            {matchedPatient && (
                              <button
                                type="button"
                                onClick={() => {
                                  impactLight();
                                  onOpenPatientFile(matchedPatient);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 font-sans font-black cursor-pointer"
                              >
                                پرونده بیمار ←
                              </button>
                            )}
                            {onScheduleLabDelivery && matchedPatient && (
                              <button
                                type="button"
                                onClick={() => {
                                  impactLight();
                                  onScheduleLabDelivery(matchedPatient, order);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-sans font-black flex items-center gap-1 cursor-pointer"
                              >
                                <Calendar className="w-2.5 h-2.5" />
                                <span>نوبت در تقویم</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bidirectional Linked Implant Case Banner */}
                        {(() => {
                          if (!matchedPatient?.implantCases?.length) return null;
                          const orderCode = extractToothCode(order.toothNumber);
                          const isImpWork = /ایمپلنت|اباتمنت|فریم/i.test(order.workType || '');
                          const linkedImp = matchedPatient.implantCases.find(imp => {
                            const impCode = extractToothCode(imp.toothNumber);
                            if (orderCode && impCode) return orderCode === impCode;
                            return imp.toothNumber === order.toothNumber || isImpWork;
                          });
                          if (!linkedImp) return null;
                          const impStageText =
                            linkedImp.currentStage === 'fixture_placed' ? '۱. کاشت فیکسچر'
                            : linkedImp.currentStage === 'healing_cap' ? '۲. بستن هیلینگ'
                            : linkedImp.currentStage === 'impression' ? '۳. قالب‌گیری'
                            : linkedImp.currentStage === 'abutment_framework' ? '۴. تست فریم و اباتمنت'
                            : '۵. تحویل نهایی روکش ✓';
                          return (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/90 border border-cyan-200 text-[10px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-cyan-700 text-white font-black text-[9px]">
                                  کیس ایمپلنت متصل
                                </span>
                                <span className="font-black text-cyan-950">{linkedImp.brand}</span>
                                <span className="font-mono font-bold text-cyan-800">
                                  (Ø{linkedImp.diameter}×{linkedImp.length} · تورک {toPersianDigits(linkedImp.torque)})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-white border border-cyan-200 text-cyan-900 font-black">
                                  وضعیت جراحی: {impStageText}
                                </span>
                                {onNavigateToModule && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onNavigateToModule('implant');
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-black cursor-pointer"
                                  >
                                    پرونده ایمپلنت ←
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 360° Patient Financial Clearance, File, Palmer Chart & Smart Reminder Hub */}
                        {matchedPatient && (() => {
                          const patientDebt = matchedPatient.balance < 0 ? Math.abs(matchedPatient.balance) : 0;
                          const checksCount = (matchedPatient.sayadChecks || []).length;
                          const pendingInstallments = (matchedPatient.installments || []).filter(ins => ins.status !== 'paid').length;
                          const isReadyWithDebt = order.status === 'ready_for_clinic' && patientDebt > 0;

                          return (
                            <div
                              data-testid="lab-cross-module-hub"
                              className={`p-2.5 rounded-2xl border space-y-2 text-[10px] ${
                                isReadyWithDebt
                                  ? 'bg-rose-50/85 border-rose-300'
                                  : 'bg-gradient-to-l from-purple-50/70 via-white to-emerald-50/50 border-purple-200/80'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-lg bg-purple-900 text-white font-black text-[9.5px]">
                                    میز یکپارچه مالی، پرونده، پالمر و یادآوری
                                  </span>
                                  {isReadyWithDebt ? (
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-black text-[9.5px] flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>هشدار ترخیص: پروتز آماده تحویل است اما بیمار {formatToman(patientDebt)} بدهی دارد</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[9.5px]">
                                      {patientDebt === 0 ? '✓ تسویه مالی کامل بیمار جهت تحویل پروتز' : `مانده حساب بیمار: ${formatToman(patientDebt)}`}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 font-mono text-[9.5px] text-slate-700">
                                  <span>کل پرونده: <strong>{formatToman(matchedPatient.totalCost || 0)}</strong></span>
                                  <span>پرداختی: <strong className="text-emerald-700">{formatToman(matchedPatient.paidAmount || 0)}</strong></span>
                                  <span>چک صیادی: <strong className="text-purple-800">{toPersianDigits(checksCount)}</strong></span>
                                  {pendingInstallments > 0 && (
                                    <span>اقساط باز: <strong className="text-amber-800">{toPersianDigits(pendingInstallments)}</strong></span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-200/50">
                                {onOpenPaymentModal && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onOpenPaymentModal(matchedPatient);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    <span>دریافت وجه / تسویه (POS)</span>
                                  </button>
                                )}

                                {onOpenCheckModal && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onOpenCheckModal(matchedPatient);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>ثبت چک صیادی / ضمانت</span>
                                  </button>
                                )}

                                {onOpenPalmerChart && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      impactLight();
                                      onOpenPalmerChart(matchedPatient, order.toothNumber);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>چارت پالمر ({order.toothNumber})</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    impactLight();
                                    onOpenPatientFile(matchedPatient, 'financial');
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <span>پرونده مالی و اقساط</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    impactHeavy();
                                    scheduleEntityReminder({
                                      sourceType: 'lab',
                                      sourceId: order.id,
                                      patientId: matchedPatient.id,
                                      patientName: matchedPatient.fullName,
                                      patientPhone: matchedPatient.phone,
                                      title: `پیگیری و تحویل پروتز ${order.workType} (${order.toothNumber})`,
                                      description: `لابراتوار: ${order.labName} · شید ${order.shade} · مانده بیمار: ${patientDebt > 0 ? formatToman(patientDebt) : 'تسویه'}`,
                                      targetDate: order.deliveryDate || todayJalali,
                                      targetView: 'lab',
                                      config: order.reminderConfig || {
                                        enabled: true,
                                        preset: '1d_before',
                                        channels: ['phone_push', 'in_app']
                                      }
                                    });
                                    showToast(`یادآور هوشمند تحویل «${order.workType}» برای ${order.patientName} در مرکز یادآوری ثبت شد.`);
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                >
                                  <Bell className="w-3 h-3" />
                                  <span>ثبت یادآور هوشمند</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* LIVE 5-STAGE PROGRESS STEPPER LINE (2-Step Mistake-Proof Confirmation) */}
                        <div className="bg-purple-50/50 px-2.5 py-2.5 rounded-2xl border border-purple-200/70 space-y-2 animate-in fade-in duration-150">
                          <div className="relative flex items-center justify-between" dir="rtl">
                            {/* Connecting background bar */}
                            <div className="absolute top-2.5 right-2 left-2 h-0.5 bg-purple-200 -z-0" />
                            
                            {[
                              { key: 'sent', label: 'ارسال' },
                              { key: 'fabrication', label: 'تراش' },
                              { key: 'frame_try_in', label: 'فریم' },
                              { key: 'ready_for_clinic', label: 'وصول مطب' },
                              { key: 'delivered_cemented', label: 'تحویل' }
                            ].map((st, idx) => {
                              const isDone = idx < currentStageIndex;
                              const isCurrent = idx === currentStageIndex;
                              const isPendingTarget = pendingStageChange?.orderId === order.id && pendingStageChange?.status === st.key;

                              return (
                                <div 
                                  key={st.key} 
                                  onClick={() => {
                                    if (order.status === st.key) return;
                                    selection();
                                    setPendingStageChange({
                                      orderId: order.id,
                                      status: st.key as LabStatus,
                                      label: st.label
                                    });
                                  }}
                                  className="flex flex-col items-center z-10 cursor-pointer group"
                                  title={`انتخاب مرحله ${st.label}`}
                                >
                                  <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isPendingTarget
                                      ? 'bg-amber-500 text-white ring-4 ring-amber-300 font-black scale-115 shadow-xs'
                                      : isCurrent 
                                        ? 'bg-[#c8ff00] text-black ring-4 ring-[#c8ff00]/30 font-black scale-110 shadow-xs' 
                                        : isDone 
                                          ? 'bg-purple-600 text-white' 
                                          : 'bg-white border-2 border-purple-200 text-slate-500 group-hover:border-purple-500'
                                  }`}>
                                    {isDone ? '✓' : toPersianDigits(idx + 1)}
                                  </div>
                                  <span className={`text-[9px] mt-1 font-bold whitespace-nowrap ${
                                    isPendingTarget ? 'text-amber-800 font-black' : isCurrent ? 'text-purple-900 font-black' : isDone ? 'text-slate-700' : 'text-slate-500'
                                  }`}>
                                    {st.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {pendingStageChange?.orderId === order.id && (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                              <span className="text-[10.5px] font-black text-amber-950">
                                تغییر مرحله به «{pendingStageChange.label}» ثبت شود؟
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPendingStageChange(null)}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                                >
                                  انصراف
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    impactHeavy();
                                    onUpdateStatus(order.id, pendingStageChange.status);
                                    showToast(`وضعیت سفارش به «${pendingStageChange.label}» تغییر یافت.`);
                                    setPendingStageChange(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black shadow-2xs cursor-pointer"
                                >
                                  تایید نهایی ✓
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Digital Lab Packet QR Code & Instant Check-In Bar */}
                        <div className="lab-qr-packet-bar flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-l from-purple-50/90 via-white to-fuchsia-50/70 border border-purple-200/80 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-purple-900 text-[#c8ff00] font-mono font-black text-[9px] tracking-wider">
                              QR-{order.id.slice(-4).toUpperCase()}
                            </span>
                            <span className="font-bold text-slate-700">
                              شناسه رهگیری دیجیتال پاکت لابراتوار
                            </span>
                          </div>
                          {order.status !== 'ready_for_clinic' && order.status !== 'delivered_cemented' ? (
                            <button
                              type="button"
                              onClick={() => {
                                impactHeavy();
                                onUpdateStatus(order.id, 'ready_for_clinic');
                                showToast(`پاکت QR-${order.id.slice(-4).toUpperCase()} اسکن شد: وصول مطب ثبت گردید و پیشنهاد نوبت سمان برای «${order.patientName}» ارسال شد.`);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>اسکن QR و ثبت وصول آنی + نوبت نصب</span>
                            </button>
                          ) : (
                            <span className="text-[9.5px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              ✓ پاکت تحویل مطب شده است
                            </span>
                          )}
                        </div>

                        {/* 1-Tap Direct Patient Communication Dock (تماس، پیامک سیم‌کارت، سرویس پیامک خودکار) */}
                        {matchedPatient?.phone && (
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span className="font-bold text-slate-700">ارتباط مستقیم با بیمار:</span>
                              <span className="font-mono font-black text-slate-900 tabular-nums" dir="ltr">
                                {toPersianDigits(matchedPatient.phone)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <a
                                href={`tel:${matchedPatient.phone}`}
                                onClick={() => impactLight()}
                                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 shadow-2xs transition-all"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                <span>تماس مستقیم</span>
                              </a>
                              <a
                                href={`sms:${matchedPatient.phone}?body=${encodeURIComponent(`سلام ${order.patientName} عزیز، پروتز (${order.workType}) شما در کلینیک مینادنتال در وضعیت «${order.status === 'ready_for_clinic' ? 'آماده تحویل در مطب' : 'در حال پیگیری'}» می‌باشد.`)}`}
                                onClick={() => impactLight()}
                                className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center gap-1 shadow-2xs transition-all"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>پیامک گوشی</span>
                              </a>
                              <button
                                type="button"
                                onClick={async () => {
                                  impactLight();
                                  await clinicalSmsService.sendPatternSms(
                                    matchedPatient.phone,
                                    order.patientName,
                                    'lab_ready',
                                    { date: order.deliveryDate, workType: order.workType, toothNumber: order.toothNumber }
                                  );
                                  showToast(`پیامک خدماتی آماده بودن «${order.workType}» از طریق وب‌سرویس برای ${order.patientName} ارسال شد.`);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                              >
                                <Send className="w-2.5 h-2.5 -scale-x-100" />
                                <span>ارسال پیامک خدماتی</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Streamlined Footer: Cost + Quick Action Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 flex-wrap gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10.5px] font-mono font-black text-purple-800 bg-purple-50 border border-purple-200/80 px-2 py-1 rounded-lg tabular-nums">
                              {formatToman(order.cost || 2500000)}
                            </span>

                            <button type="button"
                              onClick={async () => {
                                impactLight();
                                const matchedPatient = patients.find((p) => p.id === order.patientId);
                                if (matchedPatient?.phone) {
                                  await clinicalSmsService.sendPatternSms(
                                    matchedPatient.phone,
                                    order.patientName,
                                    'lab_ready',
                                    { date: order.deliveryDate, workType: order.workType, toothNumber: order.toothNumber }
                                  );
                                }
                                showToast(`پیامک اطلاع‌رسانی آماده بودن ${order.workType} برای ${order.patientName} ارسال شد.`);
                              }}
                              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                            >
                              <Send className="w-3 h-3 -scale-x-100 text-slate-500" />
                              <span>پیامک</span>
                            </button>

                            {onScheduleLabDelivery && (order.status === 'ready_for_clinic' || order.status === 'frame_try_in') && (() => {
                              const matchedPatient = patients.find((p) => p.id === order.patientId);
                              if (!matchedPatient) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    impactHeavy();
                                    onScheduleLabDelivery(matchedPatient, order);
                                  }}
                                  className="py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>رزرو نوبت تحویل</span>
                                </button>
                              );
                            })()}

                            <button type="button"
                              onClick={() => {
                                impactLight();
                                setSelectedOrderForSlip(order);
                              }}
                              className="py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                              title="چاپ برگه رسمی اعزام کار به همراه پیک"
                            >
                              <Printer className="w-3 h-3 text-purple-600" />
                              <span>برگه سفارش</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditOrderModal(order)}
                              className="py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                              title="ویرایش شید رنگ، تاریخ تحویل، هزینه یا اصلاحیه لابراتوار"
                            >
                              <Edit3 className="w-3 h-3 text-amber-700" />
                              <span>ویرایش / اصلاحیه</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {getPreviousStatus(order.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const prev = getPreviousStatus(order.status);
                                  if (prev) {
                                    impactLight();
                                    onUpdateStatus(order.id, prev);
                                    showToast(`مرحله لابراتوار «${order.patientName}» به مرحله قبل بازگردانده شد.`);
                                  }
                                }}
                                className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                title="بازگشت به مرحله قبل (اصلاح خطا یا اعزام مجدد)"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>مرحله قبل</span>
                              </button>
                            )}

                            {order.status !== 'delivered_cemented' ? (
                              <ArmedActionButton
                                label={getNextStatusLabel(order.status)}
                                confirmLabel="تایید تغییر مرحله؟ ✓"
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                onConfirm={() => {
                                  const next = getNextStatus(order.status);
                                  onUpdateStatus(order.id, next);
                                  showToast(`وضعیت سفارش ${order.workType} با موفقیت ارتقا یافت.`);
                                }}
                                className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs"
                              />
                            ) : (
                              <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                <span>تحویل و سمان نهایی شد</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Inline Live Mutation Confirmation Badge */}
                    <CardMutationBadge recordId={order.id} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 1B: INTERACTIVE 3D CAD/CAM SCAN & MESH MODEL VIEWER (D3.JS ENGINE) */}
      {activeChip === 'scan3d' && (
        <Lab3DModelViewerD3
          orders={allLabOrders}
          patients={patients}
          selectedOrderId={selectedOrderIdFor3D}
          onSelectOrder={(orderId) => setSelectedOrderIdFor3D(orderId)}
          onEditLabOrder={onEditLabOrder}
          onUpdateStatus={onUpdateStatus}
          onOpenPalmerChart={onOpenPalmerChart}
        />
      )}

      {/* TAB 2: PARTNER LABS DIRECTORY (ثابت و متحرک) */}
      {activeChip === 'labs' && (
        <div className="mx-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700">فهرست لابراتوارهای طرف قرارداد کلینیک:</span>
            <button type="button"
              onClick={() => setShowAddLabModal(true)}
              className="py-1 px-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن لابراتوار همکار</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {partnerLabs.map(lab => {
              const { effectiveActiveCount, remainingBalance, matchingOrders } = getLabFinancials(lab);

              return (
              <div
                key={lab.id}
                className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      lab.type === 'fixed' 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {lab.type === 'fixed' ? 'ثابت' : 'متحرک'}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{lab.name}</h4>
                      <span className="text-[10px] text-slate-500 font-bold block">{lab.typeTitle}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                    میانگین تحویل: {toPersianDigits(lab.avgTurnaroundDays)} روز
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-50 p-2 rounded-xl text-center">
                  <div>
                    <span className="text-slate-400 block text-[9px]">تلفن تماس</span>
                    <span className="font-mono font-bold text-slate-800 text-[10px]">{lab.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">سفارشات جاری</span>
                    <span className="font-mono font-black text-purple-700">
                      {toPersianDigits(effectiveActiveCount)} مورد ({toPersianDigits(matchingOrders.length)} کل)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">مانده بستانکاری</span>
                    <span className={`font-mono font-black text-[10px] ${remainingBalance > 0 ? 'text-purple-800' : 'text-emerald-700'}`}>
                      {remainingBalance > 0 ? formatToman(remainingBalance) : 'تسویه کامل ✓'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">مسئول فنی: {lab.manager}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        selection();
                        setFilterLab(lab.name.split('(')[0].replace('لابراتوار', '').trim().split(' ')[0]);
                        setActiveChip('orders');
                      }}
                      className="py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black cursor-pointer"
                    >
                      مشاهده کارها
                    </button>
                    <a
                      href={`tel:${lab.phone.replace(/[^\d+۰-۹]/g, '')}`}
                      onClick={() => impactLight()}
                      className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>تماس فوری</span>
                    </a>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: REMINDERS & LIVE DELIVERY DELAY QUEUE */}
      {activeChip === 'reminders' && (() => {
        const pendingDeliveryOrders = allLabOrders
          .filter(o => o.status !== 'delivered_cemented' && o.status !== 'ready_for_clinic')
          .map(o => ({
            order: o,
            daysLeft: diffPersianDays(todayJalali, o.deliveryDate),
            matchedPat: patients.find(p => p.id === o.patientId || p.fullName === o.patientName)
          }))
          .sort((a, b) => a.daysLeft - b.daysLeft);

        return (
        <div className="mx-2 space-y-3">
          {/* Live Pending/Overdue Lab Deliveries Queue */}
          <div className="bg-white rounded-[24px] p-4 shadow-sm border border-purple-200/80 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-1.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h4 className="font-black text-xs text-slate-900">صف زنده موعد تحویل و تأخیر لابراتوارها</h4>
              </div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                {toPersianDigits(pendingDeliveryOrders.length)} کار در انتظار تحویل
              </span>
            </div>

            {pendingDeliveryOrders.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                تمام کارهای ارسالی به لابراتوار به مطب وصول شده یا تحویل بیمار گردیده است ✓
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDeliveryOrders.map(({ order, daysLeft, matchedPat }) => {
                  const isOverdue = daysLeft < 0;
                  const isDueSoon = daysLeft >= 0 && daysLeft <= reminderDaysBefore;
                  return (
                    <div
                      key={order.id}
                      className={`p-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                        isOverdue
                          ? 'bg-rose-50/80 border-rose-200'
                          : isDueSoon
                          ? 'bg-amber-50/80 border-amber-200'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900">{order.patientName}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white border border-slate-200 text-purple-900 font-black">
                            {order.toothNumber}
                          </span>
                          <span
                            className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                              isOverdue
                                ? 'bg-rose-600 text-white'
                                : daysLeft === 0
                                ? 'bg-amber-600 text-white'
                                : isDueSoon
                                ? 'bg-amber-200 text-amber-950'
                                : 'bg-sky-100 text-sky-900'
                            }`}
                          >
                            {isOverdue
                              ? `تأخیر ${toPersianDigits(Math.abs(daysLeft))} روز - فوری`
                              : daysLeft === 0
                              ? 'موعد تحویل امروز!'
                              : `${toPersianDigits(daysLeft)} روز تا تحویل`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold mt-0.5 truncate">
                          {order.workType} · {order.labName} · موعد: <span className="font-mono">{toPersianDigits(order.deliveryDate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            impactHeavy();
                            scheduleEntityReminder({
                              sourceType: 'lab',
                              sourceId: order.id,
                              patientId: matchedPat?.id || order.patientId,
                              patientName: order.patientName,
                              patientPhone: matchedPat?.phone,
                              title: `پیگیری تحویل لابراتوار: ${order.workType} (${order.toothNumber})`,
                              description: `لابراتوار ${order.labName} · موعد ${toPersianDigits(order.deliveryDate)}`,
                              targetDate: order.deliveryDate,
                              targetView: 'lab',
                              config: order.reminderConfig || {
                                enabled: true,
                                preset: '1d_before',
                                channels: ['phone_push', 'in_app']
                              }
                            });
                            showToast(`یادآور پیگیری «${order.workType}» در مرکز جامع یادآوری‌ها ثبت و همگام شد.`);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <Bell className="w-3 h-3" />
                          <span>ثبت در مرکز یادآوری</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            impactHeavy();
                            onUpdateStatus(order.id, 'ready_for_clinic');
                            showToast(`وصول کار «${order.patientName}» ثبت شد.`);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer active:scale-95"
                        >
                          اعلام وصول مطب ✓
                        </button>
                        {matchedPat && onOpenPalmerChart && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenPalmerChart(matchedPat, order.toothNumber);
                            }}
                            className="px-2 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 hover:bg-purple-100 text-[10px] font-black cursor-pointer"
                          >
                            چارت پالمر
                          </button>
                        )}
                        {matchedPat?.phone && (
                          <a
                            href={`tel:${matchedPat.phone}`}
                            className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[10px] font-black"
                          >
                            تماس بیمار
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Bell className="w-4 h-4 text-purple-600" />
              <h4 className="font-black text-xs text-slate-900">تنظیمات هوشمند پیگیری و یادآوری تحویل لابراتوار</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  هشدار وصول کار چند روز قبل از نوبت بیمار فعال شود؟
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(days => (
                    <button type="button"
                      key={days}
                      onClick={() => {
                        selection();
                        setReminderDaysBefore(days);
                      }}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        reminderDaysBefore === days 
                          ? 'bg-purple-600 text-white shadow-2xs' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {toPersianDigits(days)} روز قبل
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800 block">پیامک خودکار آمادگی به بیمار</span>
                  <span className="text-[10px] text-slate-400">به محض اعلام وصول در مطب، پیامک نوبت سمان به بیمار ارسال شود.</span>
                </div>
                <input
                  aria-label="پیامک خودکار آمادگی به بیمار"
                  type="checkbox"
                  checked={autoSmsToPatient}
                  onChange={(e) => setAutoSmsToPatient(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800 block">آلارم صوتی و لرزشی هپتیک تأخیر لابراتوار</span>
                  <span className="text-[10px] text-slate-400">در صورت گذشت از موعد تحویل و عدم وصول، اعلان فوری به منشی داده شود.</span>
                </div>
                <input
                  aria-label="آلارم صوتی و لرزشی هپتیک تأخیر لابراتوار"
                  type="checkbox"
                  checked={labAlarmNotice}
                  onChange={(e) => setLabAlarmNotice(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
              </div>
            </div>

            <button type="button"
              onClick={() => {
                success();
                showToast('تنظیمات یادآوری لابراتوار با موفقیت ذخیره شد.');
              }}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
            >
              ذخیره تنظیمات یادآوری
            </button>
          </div>
        </div>
        );
      })()}

      {/* TAB 4: SETTLEMENTS & FINANCIAL INVOICES */}
      {activeChip === 'settlements' && (() => {
        const totalUnsettledAllLabs = partnerLabs.reduce((sum, l) => sum + getLabFinancials(l).remainingBalance, 0);
        const totalSettledAllLabs = partnerLabs.reduce((sum, l) => sum + getLabFinancials(l).paidAlready, 0);

        return (
        <div className="mx-2 space-y-3">
          <div className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <div>
                  <h4 className="font-black text-xs text-slate-900">تسویه‌حساب و فاکتورهای لابراتوار</h4>
                  <span className="text-[9.5px] text-slate-500 font-bold block">
                    کسر خودکار هزینه لابراتوار از کارکرد در فرمول پورسانت پزشکان لحاظ می‌شود
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] font-mono">
                <span className="px-2 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-black">
                  مانده بستانکاری کل: {formatToman(totalUnsettledAllLabs)}
                </span>
                {totalSettledAllLabs > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-black">
                    تسویه‌شده: {formatToman(totalSettledAllLabs)}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {partnerLabs.map(lab => {
                const { matchingOrders, liveOrdersTotal, grossPayable, paidAlready, remainingBalance } = getLabFinancials(lab);
                const rawCustom = customPayByLab[lab.id] ?? '';
                const parsedCustom = Number(toEnglishDigits(rawCustom).replace(/[^\d]/g, '')) || 0;

                const applySettlement = (amount: number) => {
                  if (amount <= 0) return;
                  success();
                  const applied = Math.min(amount, remainingBalance);
                  setSettledByLab(prev => ({
                    ...prev,
                    [lab.id]: (prev[lab.id] || 0) + applied
                  }));
                  setCustomPayByLab(prev => ({ ...prev, [lab.id]: '' }));
                  showToast(`رسید پرداخت و تسویه‌حساب ${formatToman(applied)} برای ${lab.name} ثبت و از مانده کسر شد.`);
                };

                return (
                <div key={lab.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-black text-xs text-slate-900 block">{lab.name}</span>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-0.5 font-mono">
                        <span>کل فاکتور ({toPersianDigits(matchingOrders.length)} کار زنده / {formatToman(liveOrdersTotal)}): <strong>{formatToman(grossPayable)}</strong></span>
                        <span>پرداختی تاکنون: <strong className="text-emerald-700">{formatToman(paidAlready)}</strong></span>
                        <span>مانده: <strong className="text-purple-800">{formatToman(remainingBalance)}</strong></span>
                      </div>
                    </div>

                    {remainingBalance === 0 && (
                      <span className="py-1 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-black">
                        ✓ تسویه کامل
                      </span>
                    )}
                  </div>

                  {remainingBalance > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200/70">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`مبلغ پرداختی دلخواه به ${lab.name}`}
                          placeholder="مبلغ دلخواه (تومان)..."
                          value={rawCustom}
                          onChange={(e) => setCustomPayByLab(prev => ({ ...prev, [lab.id]: e.target.value }))}
                          className="w-36 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                        {parsedCustom > 0 && (
                          <button
                            type="button"
                            onClick={() => applySettlement(parsedCustom)}
                            className="py-1.5 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[10.5px] cursor-pointer"
                          >
                            پرداخت مبلغ واردشده
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applySettlement(Math.min(5000000, remainingBalance))}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] active:scale-95 shadow-2xs transition-all cursor-pointer"
                        >
                          ثبت پرداخت علی‌الحساب
                        </button>
                        <button
                          type="button"
                          onClick={() => applySettlement(remainingBalance)}
                          className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[10.5px] active:scale-95 shadow-2xs transition-all cursor-pointer"
                        >
                          تسویه کامل ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Patient Financial Clearance & Doctor Commission Lab Deduction Ledger */}
          <div
            data-testid="lab-patient-financial-clearance"
            className="bg-white rounded-[24px] p-4 shadow-sm border border-purple-200/80 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h4 className="font-black text-xs text-slate-900">
                  تراز مالی بیماران دارای کار لابراتواری و سهم کسر از کارکرد پزشک
                </h4>
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                  کنترل تسویه حساب، چک صیادی و اقساط بیمار پیش از سمان نهایی + محاسبه کسر هزینه لابراتوار از پورسانت پزشک
                </span>
              </div>
              {onNavigateToModule && (
                <button
                  type="button"
                  onClick={() => {
                    impactLight();
                    onNavigateToModule('financial');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>ورود به ماژول جامع مالی و چک‌ها ←</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {allLabOrders.map((order) => {
                const matchedPat = patients.find(p => p.id === order.patientId || p.fullName === order.patientName);
                const patientDebt = matchedPat && matchedPat.balance < 0 ? Math.abs(matchedPat.balance) : 0;
                const labCost = order.cost || 2500000;
                const doctorDeductionShare = Math.round(labCost / 2);

                return (
                  <div
                    key={`fin-lab-${order.id}`}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900">{order.patientName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black">
                          {order.toothNumber}
                        </span>
                        <span className="text-[10.5px] font-bold text-slate-600">{order.workType}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-600">
                        <span>اجرت لابراتوار: <strong className="text-purple-800">{formatToman(labCost)}</strong></span>
                        <span>سهم کسر از پزشک (۵۰٪): <strong className="text-indigo-800">{formatToman(doctorDeductionShare)}</strong></span>
                        <span>
                          مانده بدهی بیمار:{' '}
                          <strong className={patientDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                            {patientDebt > 0 ? formatToman(patientDebt) : 'تسویه کامل ✓'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {matchedPat && (
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {onOpenPaymentModal && patientDebt > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenPaymentModal(matchedPat);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                          >
                            تسویه / دریافت (POS)
                          </button>
                        )}
                        {onOpenCheckModal && (
                          <button
                            type="button"
                            onClick={() => {
                              impactLight();
                              onOpenCheckModal(matchedPat);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black cursor-pointer"
                          >
                            ثبت چک صیادی
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            impactLight();
                            onOpenPatientFile(matchedPat, 'financial');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-800 text-[10px] font-black cursor-pointer"
                        >
                          پرونده مالی بیمار
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {/* MODAL: ADD PARTNER LAB (Full-Page Mobile Sheet) */}
      {showAddLabModal && (
        <ViewportModalPortal isOpen={showAddLabModal}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="تعریف لابراتوار همکار جدید"
            className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setShowAddLabModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[28px] border-0 sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-slate-100 bg-white shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-purple-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-slate-900">تعریف لابراتوار همکار جدید</h4>
                    <span className="text-[10px] text-purple-700 font-bold">پروتز ثابت، متحرک و ایمپلنت</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddLabModal(false)}
                    aria-label="بستن فرم تعریف لابراتوار"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <form id="new-partner-lab-form" onSubmit={handleAddPartnerLab} className="p-4 space-y-3 text-xs flex-1 overflow-y-auto overscroll-contain">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">نام لابراتوار</label>
                  <input
                    aria-label="نام لابراتوار همکار"
                    type="text"
                    required
                    placeholder="مثلاً لابراتوار دیجیتال پارس..."
                    value={newLabName}
                    onChange={(e) => setNewLabName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">نوع تخصص پروتز</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'fixed', label: 'پروتز ثابت' },
                      { id: 'removable', label: 'پروتز متحرک' },
                      { id: 'both', label: 'هردو' }
                    ].map(t => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setNewLabType(t.id as any)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          newLabType === t.id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">شماره تلفن تماس</label>
                    <input
                      aria-label="شماره تلفن تماس لابراتوار"
                      type="text"
                      placeholder="۰۲۱-۸۸۰۰۰۰۰۰"
                      value={newLabPhone}
                      onChange={(e) => setNewLabPhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">مسئول فنی / مدیر</label>
                    <input
                      aria-label="مسئول فنی یا مدیر لابراتوار"
                      type="text"
                      placeholder="دکتر / آقای ..."
                      value={newLabManager}
                      onChange={(e) => setNewLabManager(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs font-bold"
                    />
                  </div>
                </div>
              </form>

              {/* Fixed Bottom Action Footer */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-slate-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLabModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  form="new-partner-lab-form"
                  className="w-2/3 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black shadow-xs active:scale-95 cursor-pointer"
                >
                  ثبت لابراتوار
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Official Dental Lab Prescription Slip Print Modal */}
      <LabPrescriptionModal
        isOpen={!!selectedOrderForSlip}
        onClose={() => setSelectedOrderForSlip(null)}
        order={selectedOrderForSlip}
        patient={patients.find(p => p.id === selectedOrderForSlip?.patientId) || null}
      />

      {/* Full Edit / Delete Lab Order Modal */}
      {editingLabOrder && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingLabOrder(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ویرایش سفارش و اصلاحیه لابراتوار"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-purple-200 p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">ویرایش سفارش و اصلاحیه لابراتوار</h4>
                    <span className="text-[10px] text-slate-500 font-bold">
                      بیمار: {editingLabOrder.patientName} · اصلاح شید رنگ، موعد تحویل و اجرت
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingLabOrder(null)}
                  aria-label="بستن ویرایش سفارش لابراتوار"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">نوع پروتز / کار لابراتواری</label>
                  <input aria-label="نوع پروتز / کار لابراتواری"
                    type="text"
                    value={editWorkType}
                    onChange={(e) => setEditWorkType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">لابراتوار طرف قرارداد</label>
                    <select aria-label="لابراتوار طرف قرارداد"
                      value={editLabName}
                      onChange={(e) => setEditLabName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                    >
                      {partnerLabs.map(l => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))}
                      {!partnerLabs.some(l => l.name === editLabName) && (
                        <option value={editLabName}>{editLabName}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">شید رنگ VITA</label>
                    <select aria-label="شید رنگ VITA"
                      value={editShade}
                      onChange={(e) => setEditShade(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                    >
                      {['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'BL1', 'BL2', 'BL3'].map(sh => (
                        <option key={sh} value={sh}>{sh}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">دندان (پالمر)</label>
                    <input aria-label="دندان (پالمر)"
                      type="text"
                      value={editToothNumber}
                      onChange={(e) => setEditToothNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">موعد تحویل</label>
                    <input aria-label="موعد تحویل"
                      type="text"
                      value={editDeliveryDate}
                      onChange={(e) => setEditDeliveryDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      اجرت (تومان) {!isManager && '🔒'}
                    </label>
                    <input aria-label="اجرت (تومان)"
                      type="number"
                      readOnly={!isManager}
                      value={editCost}
                      onChange={(e) => {
                        if (!isManager) return;
                        setEditCost(Number(e.target.value));
                      }}
                      className={`w-full border rounded-xl px-2.5 py-2 font-mono font-bold focus:outline-none ${
                        isManager
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-purple-500'
                          : 'bg-amber-50 border-amber-200 text-slate-600 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">کد قبض ارسال مطب</label>
                  <input
                    aria-label="کد قبض ارسال مطب"
                    type="text"
                    dir="ltr"
                    value={editTrackingSlipCode}
                    onChange={(e) => setEditTrackingSlipCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-purple-900 font-mono font-black text-center focus:bg-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <ReminderOptionPicker
                  value={editReminderConfig}
                  onChange={setEditReminderConfig}
                  targetDate={editDeliveryDate}
                  theme="purple"
                  title="یادآوری پیگیری و تحویل لابراتوار (نوتیف گوشی)"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {onDeleteLabOrder && isManager ? (
                  <ArmedActionButton
                    label="حذف سفارش (مدیر)"
                    confirmLabel="تایید بایگانی؟ ✓"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onConfirm={() => {
                      onDeleteLabOrder(editingLabOrder.id);
                      showToast(`سفارش لابراتوار «${editingLabOrder.patientName}» به بایگانی مدیر منتقل شد.`);
                      setEditingLabOrder(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">🔒 حذف سفارش فقط توسط مدیر</span>
                )}
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingLabOrder(null)}
                    className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editWorkType.trim()) return;
                      success();
                      if (onEditLabOrder) {
                        onEditLabOrder(editingLabOrder.id, {
                          workType: editWorkType.trim(),
                          labName: editLabName,
                          shade: editShade,
                          toothNumber: editToothNumber.trim(),
                          deliveryDate: editDeliveryDate.trim(),
                          cost: editCost,
                          trackingSlipCode: editTrackingSlipCode.trim() || undefined,
                          reminderConfig: editReminderConfig
                        });
                      }
                      showToast(`تغییرات سفارش لابراتوار «${editingLabOrder.patientName}» ذخیره شد.`);
                      setEditingLabOrder(null);
                    }}
                    className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    ذخیره تغییرات ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

    </div>
  );
};
