import React, { useState } from 'react';
import { 
  FlaskConical, Plus, CheckCircle2, Clock, 
  AlertTriangle, Bell, Calendar, ChevronLeft,
  Truck, Sparkles, Shield, Send, Check, Search,
  Palette, FileText
} from 'lucide-react';
import { LabOrder, LabStatus, Patient } from '../../types/dental';
import { toPersianDigits, formatToman } from '../../utils/jalali';

interface LabModuleViewProps {
  patients: Patient[];
  onOpenPatientFile: (patient: Patient) => void;
  onAddLabOrder: () => void;
  onUpdateStatus: (orderId: string, status: LabStatus) => void;
}

export const LabModuleView: React.FC<LabModuleViewProps> = ({
  patients,
  onOpenPatientFile,
  onAddLabOrder,
  onUpdateStatus
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLab, setFilterLab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const allLabOrders = patients.flatMap(p => p.labOrders || []);

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
      case 'sent': return 'تغییر به: در حال تراش CAD/CAM';
      case 'fabrication': return 'تغییر به: امتحان فریم';
      case 'frame_try_in': return 'اعلام وصول در مطب';
      case 'ready_for_clinic': return 'ثبت سمان و تحویل بیمار';
      case 'delivered_cemented': return 'پایان یافته';
    }
  };

  const getStatusBadge = (status: LabStatus) => {
    switch (status) {
      case 'sent':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">ارسال به لابراتوار</span>;
      case 'fabrication':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">تراش CAD/CAM و کوره</span>;
      case 'frame_try_in':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">امتحان فریم در دهان</span>;
      case 'ready_for_clinic':
        return <span className="bg-[#c8ff00] text-black text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs animate-pulse">آماده تحویل در مطب</span>;
      case 'delivered_cemented':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">سمان نهایی و تحویل</span>;
    }
  };

  const filteredOrders = allLabOrders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesLab = filterLab === 'all' || order.labName.includes(filterLab);
    const matchesSearch = !searchQuery || 
      order.patientName.includes(searchQuery) ||
      order.workType.includes(searchQuery) ||
      order.toothNumber.includes(searchQuery);
    return matchesStatus && matchesLab && matchesSearch;
  });

  const totalCost = allLabOrders.reduce((sum, o) => sum + (o.cost || 0), 0);
  const readyCount = allLabOrders.filter(o => o.status === 'ready_for_clinic').length;

  return (
    <div className="pb-28 space-y-3">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-[#162719] border border-[#c8ff00]/60 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-[#c8ff00] stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <FlaskConical className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">لابراتوار پروتز</h3>
            </div>

            <button
              onClick={onAddLabOrder}
              className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>سفارش جدید</span>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">کل سفارشات</span>
              <span className="text-xs font-black text-slate-800 font-mono">{toPersianDigits(allLabOrders.length)} مورد</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-[9px] text-emerald-600 block">آماده تحویل در مطب</span>
              <span className="text-xs font-black text-emerald-700 font-mono">{toPersianDigits(readyCount)} کار</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">صورتحساب لابراتوار</span>
              <span className="text-[10px] font-black text-purple-700 truncate block">{formatToman(totalCost)}</span>
            </div>
          </div>

          {/* Automated Reminders Banner */}
          {readyCount > 0 && (
            <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
              <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <span className="font-black block">کارهای آماده تحویل در کلینیک:</span>
                <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                  {toPersianDigits(readyCount)} سفارش پروتزی به مطب واصل شده و آماده سمان روی یونیت هستند.
                </span>
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجو با نام بیمار، شماره دندان یا نوع روکش..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'all', label: 'همه سفارشات' },
              { id: 'sent', label: 'ارسال شده' },
              { id: 'fabrication', label: 'در حال ساخت' },
              { id: 'frame_try_in', label: 'امتحان فریم' },
              { id: 'ready_for_clinic', label: 'آماده در مطب' },
              { id: 'delivered_cemented', label: 'تحویل نهایی' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`py-1 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  filterStatus === tab.id
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lab Order Cards List */}
      <div className="mx-2 space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
            سفارشی با این وضعیت یافت نشد.
          </div>
        ) : (
          filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2.5 hover:shadow-sm transition-all"
            >
              {/* Top Row: Patient & Work */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-slate-900">{order.patientName}</h4>
                    <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-bold">
                      {order.toothNumber}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 mt-1 block">
                    {order.workType}
                  </span>
                </div>

                <div>{getStatusBadge(order.status)}</div>
              </div>

              {/* Lab Details Grid */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[9px]">لابراتوار طرف قرارداد</span>
                  <span className="font-bold text-slate-800 truncate block">{order.labName}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[9px]">شید رنگ دندان</span>
                  <span className="font-black text-purple-700 font-mono">{order.shade || 'A2'}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[9px]">هزینه لابراتوار</span>
                  <span className="font-bold text-slate-700 font-mono text-[10px]">{formatToman(order.cost || 2500000)}</span>
                </div>
              </div>

              {/* Delivery Date & Appointment Timeline */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/50 p-2 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>موعد تحویل: <strong className="font-mono text-slate-800">{toPersianDigits(order.deliveryDate)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>نوبت بیمار: <strong className="font-mono text-emerald-700">{toPersianDigits(order.appointmentDate)}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  onClick={() => showToast(`پیامک آماده بودن کار پروتزی برای ${order.patientName} ارسال شد.`)}
                  className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1"
                >
                  <Send className="w-3 h-3 -scale-x-100" />
                  <span>پیامک آمادگی کار</span>
                </button>

                {order.status !== 'delivered_cemented' ? (
                  <button
                    onClick={() => {
                      const next = getNextStatus(order.status);
                      onUpdateStatus(order.id, next);
                      showToast(`وضعیت سفارش ${order.workType} تغییر یافت.`);
                    }}
                    className="py-1 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getNextStatusLabel(order.status)}</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>تحویل و سمان نهایی شد</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
