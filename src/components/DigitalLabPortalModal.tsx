import React, { useMemo, useState } from 'react';
import { 
  X, Check, FlaskConical, Share2, Box, Printer, Search
} from 'lucide-react';
import { LabOrder, Patient, LabStatus } from '../types/dental';
import { toPersianDigits } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { copyTextSafely } from '../utils/clipboard';
import { Lab3DModelViewerD3 } from './Lab3DModelViewerD3';
import { ViewportModalPortal } from './ViewportModalPortal';

interface DigitalLabPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onUpdateOrderStatus?: (orderId: string, status: LabStatus) => void;
}

const LAB_STATUS_FA: Record<LabStatus, string> = {
  sent: 'ارسال‌شده به لابراتوار',
  fabrication: 'در حال ساخت (CAD/CAM)',
  frame_try_in: 'جلسه امتحان فریم (Try-in)',
  ready_for_clinic: 'آماده تحویل در کلینیک',
  delivered_cemented: 'تحویل و سمان شد'
};

export const DigitalLabPortalModal: React.FC<DigitalLabPortalModalProps> = ({
  isOpen,
  onClose,
  patients,
  onUpdateOrderStatus
}) => {
  const [selectedLab, setSelectedLab] = useState<string>('همه');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspecting3DOrderId, setInspecting3DOrderId] = useState<string | null>(null);
  useEscapeKey(isOpen, onClose);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const allOrders: LabOrder[] = useMemo(
    () => patients.flatMap(p => p.labOrders || []),
    [patients]
  );

  const labNames = useMemo(() => {
    const baseLabs = ['لابراتوار تخصصی آریا', 'لابراتوار دیجیتال کادکام پارس', 'لابراتوار پروتز ثامن'];
    const dynamicLabs = Array.from(
      new Set(allOrders.map(o => o.labName?.trim()).filter((n): n is string => Boolean(n)))
    );
    const merged = Array.from(new Set([...dynamicLabs, ...baseLabs]));
    return ['همه', ...merged];
  }, [allOrders]);

  if (!isOpen) return null;

  const filteredOrders = allOrders.filter(o => {
    const matchesLab = selectedLab === 'همه' || o.labName.includes(selectedLab);
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      o.patientName.toLowerCase().includes(q) ||
      o.workType.toLowerCase().includes(q) ||
      o.toothNumber.toLowerCase().includes(q) ||
      o.labName.toLowerCase().includes(q);
    return matchesLab && matchesSearch;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleStatusChange = (orderId: string, newStatus: LabStatus) => {
    triggerHaptic('medium');
    onUpdateOrderStatus?.(orderId, newStatus);
    const faLabel = LAB_STATUS_FA[newStatus] || newStatus;
    showToast(`وضعیت سفارش در پورتال لابراتوار به «${faLabel}» تغییر یافت.`);
  };

  const handleShareWhatsApp = (order: LabOrder) => {
    triggerHaptic('selection');
    const rawText =
      `سلام همکار گرامی، برگه دیجیتال سفارش کلینیک مینادنتال:\n` +
      `بیمار: ${order.patientName}\n` +
      `دندان: ${order.toothNumber}\n` +
      `نوع کار: ${order.workType}\n` +
      `رنگ شید: ${order.shade}\n` +
      `موعد تحویل به مطب: ${order.deliveryDate}`;
    void copyTextSafely(rawText);
    showToast(`برگه دیجیتال سفارش «${order.patientName}» کپی و آماده ارسال برای تکنسین شد ✓`);
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="پورتال دیجیتال همکاری با لابراتوارها"
        className="fixed inset-0 z-[100] bg-purple-950/45 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-white text-slate-900 rounded-t-[32px] sm:rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-right"
        >
          {/* Top Header */}
          <div className="p-4 border-b border-purple-100 flex items-center justify-between gap-2 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm text-white truncate">پورتال دیجیتال همکاری با لابراتوارها</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 text-[#c8ff00] font-bold">
                    {toPersianDigits(allOrders.length)} سفارش
                  </span>
                </div>
                <p className="text-[11px] text-purple-100 font-medium truncate">مشاهده، تایید و به‌روزرسانی زنده مراحل ساخت پروتز توسط تکنسین</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  window.print();
                }}
                aria-label="چاپ لیست سفارش‌های لابراتوار"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="چاپ برگه سفارش‌ها"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن پورتال لابراتوار"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toast */}
          {toastMessage && (
            <div className="mx-4 mt-3 bg-purple-900 text-white p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in border border-purple-400">
              <Check className="w-4 h-4 text-[#c8ff00] stroke-[3] shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Lab Selector Chips + Quick Search */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap pl-1">لابراتوار همکار:</span>
              {labNames.map(name => {
                const count = name === 'همه'
                  ? allOrders.length
                  : allOrders.filter(o => o.labName.includes(name)).length;
                return (
                  <button
                    type="button"
                    key={name}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedLab(name);
                    }}
                    className={`py-1.5 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                      selectedLab === name
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {name} ({toPersianDigits(count)})
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                aria-label="جستجو در سفارش‌های پورتال لابراتوار"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام بیمار، شماره دندان، نوع پروتز یا لابراتوار..."
                className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Orders List */}
          <div className="p-4 overflow-y-auto space-y-3 no-scrollbar flex-1 bg-slate-50/50">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                سفارش فعالی برای این فیلتر یا لابراتوار یافت نشد.
              </div>
            ) : (
              filteredOrders.map(order => (
                <div
                  key={order.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900">{order.patientName}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 font-mono px-2 py-0.5 rounded-md font-bold">
                          {order.toothNumber}
                        </span>
                      </div>
                      <span className="text-xs text-slate-600 font-bold mt-0.5 block">{order.workType} · {order.labName}</span>
                    </div>

                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap shrink-0 ${
                      order.status === 'ready_for_clinic' ? 'bg-[#c8ff00] text-black shadow-2xs' :
                      order.status === 'delivered_cemented' ? 'bg-emerald-100 text-emerald-800' :
                      order.status === 'fabrication' ? 'bg-cyan-100 text-cyan-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {LAB_STATUS_FA[order.status] || 'ارسال‌شده به لابراتوار'}
                    </span>
                  </div>

                  {/* Technical Specifications: Shade, Margin, Stump */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[9.5px]">رنگ شید دندان:</span>
                      <span className="font-mono font-black text-purple-900">{order.shade || 'A2 Vita'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9.5px]">مارجین تراش:</span>
                      <span className="font-bold text-slate-800">{order.marginType || 'Chamfer 0.8mm'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9.5px]">تاریخ تحویل:</span>
                      <span className="font-mono font-bold text-slate-800">{toPersianDigits(order.deliveryDate)}</span>
                    </div>
                  </div>

                  {/* Technician Action Buttons: Fast Status Update + 3D CAD/CAM Model Viewer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(order)}
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10.5px] flex items-center gap-1 border border-emerald-200 cursor-pointer"
                        title="کپی برگه دیجیتال جهت ارسال به واتساپ تکنسین"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>ارسال به واتساپ تکنسین</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          setInspecting3DOrderId(prev => (prev === order.id ? null : order.id));
                        }}
                        className={`py-1.5 px-2.5 rounded-lg font-black text-[10.5px] flex items-center gap-1 border cursor-pointer transition-all ${
                          inspecting3DOrderId === order.id
                            ? 'bg-purple-700 text-white border-purple-800'
                            : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
                        }`}
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>{inspecting3DOrderId === order.id ? 'بستن نمای سه‌بعدی' : 'بازرسی سه‌بعدی اسکن (3D)'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {order.status !== 'fabrication' && order.status !== 'delivered_cemented' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'fabrication')}
                          className="py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          شروع ساخت (CAD/CAM)
                        </button>
                      )}

                      {order.status !== 'ready_for_clinic' && order.status !== 'delivered_cemented' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'ready_for_clinic')}
                          className="py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          ارسال به مطب با پیک
                        </button>
                      )}

                      {order.status !== 'delivered_cemented' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'delivered_cemented')}
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          تایید سمان نهایی ✓
                        </button>
                      )}
                    </div>
                  </div>

                  {inspecting3DOrderId === order.id && (
                    <div className="pt-2 border-t border-purple-100">
                      <Lab3DModelViewerD3
                        orders={allOrders}
                        patients={patients}
                        selectedOrderId={order.id}
                        onSelectOrder={(id) => setInspecting3DOrderId(id)}
                        onUpdateStatus={onUpdateOrderStatus}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-100 bg-white flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              بستن پورتال
            </button>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
