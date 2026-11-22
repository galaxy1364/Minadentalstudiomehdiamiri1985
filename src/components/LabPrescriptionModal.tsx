import React, { useState } from 'react';
import { 
  X, Printer, FlaskConical, CheckCircle2,
  Building2, Share2
} from 'lucide-react';
import { LabOrder, Patient } from '../types/dental';
import { toPersianDigits, formatToman } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { RealQrCode } from './RealQrCode';
import { copyTextSafely } from '../utils/clipboard';

interface LabPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LabOrder | null;
  patient?: Patient | null;
}

export const LabPrescriptionModal: React.FC<LabPrescriptionModalProps> = ({
  isOpen,
  onClose,
  order,
  patient
}) => {
  const { impactLight, selection } = useHapticFeedback();
  const [copiedNotice, setCopiedNotice] = useState(false);
  useEscapeKey(isOpen && Boolean(order), onClose);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    impactLight();
    window.print();
  };

  const handleCopyLabSlip = () => {
    selection();
    const slipText = [
      `برگه سفارش لابراتوار کلینیک مینادنتال`,
      `لابراتوار: ${order.labName}`,
      `بیمار: ${order.patientName}${patient ? ` (پرونده ${toPersianDigits(patient.fileNumber)})` : ''}`,
      `نوع پروتز: ${order.workType} · دندان: ${order.toothNumber}`,
      `شید رنگ: ${order.shade || 'A2'} · استامپ: ${order.stumpShade || 'ND2'} · مارجین: ${order.marginType || 'Deep Chamfer'}`,
      `تاریخ ارسال: ${toPersianDigits(order.sendDate)} · موعد تحویل: ${toPersianDigits(order.deliveryDate)}`
    ].join('\n');
    void copyTextSafely(slipText);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2600);
  };

  return (
    <ViewportModalPortal isOpen={isOpen && Boolean(order)}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="برگه رسمی اعزام کار به لابراتوار پروتز"
        className="fixed inset-0 z-[100] bg-purple-950/45 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        onClick={onClose}
      >
        {/* Full-Page Mobile Sheet Box */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-purple-200 shadow-2xl flex flex-col overflow-hidden"
        >
          
          {/* Fixed Sheet Top Control Bar (Hidden on print) */}
          <div className="px-4 pt-3 pb-2.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white shrink-0 sticky top-0 z-20 print:hidden">
            <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/15 text-white border border-white/25 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black truncate">برگه رسمی اعزام کار به لابراتوار پروتز</h3>
                  <span className="text-[10px] text-purple-100 block truncate">شناسه سفارش: {order.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLabSlip}
                  className="py-1.5 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedNotice ? 'کپی شد ✓' : 'واتساپ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 stroke-[2.4]" />
                  <span>چاپ برگه سفارش (Slip)</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="بستن برگه لابراتوار"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Printable Prescription Body */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto overscroll-contain space-y-4 text-xs font-sans bg-white print:p-4 print:text-black print:overflow-visible">
            
            {/* 1. Clinic Header */}
            <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                    م
                  </div>
                  <div>
                    <h1 className="text-base font-black text-slate-900 tracking-tight">
                      کلینیک تخصصی دندانپزشکی مینادنتال
                    </h1>
                    <span className="text-[10.5px] text-slate-600 font-bold">
                      مدیریت: دکتر مهدی امیری · جراح فک و صورت و ایمپلنتولوژیست
                    </span>
                  </div>
                </div>
                <p className="text-[9.5px] text-slate-500 mt-1">
                  تهران، خیابان ولیعصر · تلفن پذیرش: ۰۲۱-۸۸۰۰۹۹۰۰ · همراه مطب: ۰۹۱۲۰۰۰۰۰۰۰
                </p>
              </div>

              <div className="flex items-center gap-2.5 text-left font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">شماره سفارش:</span>
                  <span className="text-xs font-black text-slate-900 block">QR-{order.id.slice(-4).toUpperCase()}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">تاریخ ارسال: {toPersianDigits(order.sendDate)}</span>
                </div>
                <div className="p-1.5 rounded-xl border border-slate-200 bg-white shrink-0">
                  <RealQrCode
                    value={`QR-${order.id.slice(-4).toUpperCase()}`}
                    size={54}
                    darkColor="#4c1d95"
                    ariaLabel={`کد QR پاکت لابراتوار ${order.id}`}
                  />
                </div>
              </div>
            </div>

            {/* 2. Patient & Lab Destination Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 print:bg-white print:border-slate-400">
              {/* Patient Info */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 block uppercase">مشخصات بیمار:</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-sm">{order.patientName}</span>
                  {patient && (
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-mono font-bold">
                      پرونده: {patient.fileNumber}
                    </span>
                  )}
                </div>
                {patient && (
                  <div className="text-[10.5px] text-slate-600 space-x-2 space-x-reverse">
                    <span>{toPersianDigits(patient.age)} ساله</span>
                    <span>·</span>
                    <span>{patient.gender}</span>
                    <span>·</span>
                    <span className="font-mono">{toPersianDigits(patient.phone)}</span>
                  </div>
                )}
              </div>

              {/* Lab Destination */}
              <div className="space-y-1 text-left">
                <span className="text-[10px] font-black text-slate-400 block uppercase">لابراتوار مقصد:</span>
                <span className="font-black text-slate-900 text-sm block">{order.labName}</span>
                <div className="text-[10.5px] text-slate-600 flex items-center justify-end gap-1">
                  <Building2 className="w-3 h-3 text-purple-600" />
                  <span>پروتز تخصصی دندانپزشکی</span>
                </div>
              </div>
            </div>

            {/* 3. Detailed Work Specification (جدول سفارش پروتز) */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-900 block">مشخصات فنی و بالینی قطعه پروتزی:</span>
              
              <table className="w-full text-right border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-200 text-slate-800">
                    <th className="p-2 border border-slate-300 font-black">نوع پروتز درخواستی</th>
                    <th className="p-2 border border-slate-300 font-black">ناحیه / شماره دندان</th>
                    <th className="p-2 border border-slate-300 font-black">شید رنگ دندان (Shade)</th>
                    <th className="p-2 border border-slate-300 font-black">رنگ استامپ (Stump)</th>
                    <th className="p-2 border border-slate-300 font-black">نوع تراش مارجین</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">{order.workType}</td>
                    <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">{order.toothNumber}</td>
                    <td className="p-2 border border-slate-300 font-bold text-purple-700 font-mono">{order.shade || 'A2'}</td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-600">{order.stumpShade || 'ND2'}</td>
                    <td className="p-2 border border-slate-300 text-slate-700">{order.marginType || 'Deep Chamfer'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Timeline Schedule (تقویم رفت و برگشت) */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-2xl bg-slate-50 border border-slate-200 print:bg-white print:border-slate-300">
              <div className="p-1">
                <span className="text-[10px] text-slate-500 block">تاریخ قالب‌گیری و ارسال</span>
                <span className="font-mono font-bold text-xs text-slate-900 mt-0.5 block">{toPersianDigits(order.sendDate)}</span>
              </div>
              <div className="p-1 border-x border-slate-200">
                <span className="text-[10px] text-purple-700 font-bold block">موعد تحویل در مطب (الزامی)</span>
                <span className="font-mono font-black text-xs text-purple-900 mt-0.5 block">{toPersianDigits(order.deliveryDate)}</span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-emerald-700 font-bold block">نوبت رزرو شده بیمار در یونیت</span>
                <span className="font-mono font-black text-xs text-emerald-900 mt-0.5 block">{toPersianDigits(order.appointmentDate)}</span>
              </div>
            </div>

            {/* 5. Special Instructions & Clinical Notes */}
            <div className="p-3 rounded-2xl border border-dashed border-slate-300 bg-amber-50/50 space-y-1">
              <span className="text-[10.5px] font-black text-slate-800 block">دستورات و الزامات تکنیکی دندانپزشک:</span>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                {order.instructions || 'لطفاً کنتاکت‌های پروگزیمال دقیق و بدون باز بودن تنظیم گردد. انطباق مارجینال زیرکونیا بررسی شود و آناتومی اکلوزال طبق دندان‌های مجاور با اکلوژن نرمال بدون هایپراکلود تحویل گردد.'}
              </p>
            </div>

            {/* 6. Quality Control (QC) Checklist & Signatures */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-4">
              {/* QC Box */}
              <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10.5px]">
                <span className="font-black text-slate-800 block">چک‌لیست کنترل کیفیت (QC مطب):</span>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>انطباق نشست روی کست و فیکسچر</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>بررسی شید رنگ و پولیش نهایی</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex items-end justify-between px-3 text-center text-[10.5px] text-slate-600">
                <div>
                  <span className="block mb-6">امضای تحویل‌گیرنده پیک:</span>
                  <span className="text-slate-400 font-mono">...........................</span>
                </div>
                <div>
                  <span className="block mb-6 font-bold text-slate-800">مهر و امضای دکتر مهدی امیری:</span>
                  <span className="text-emerald-700 font-mono font-black">[تایید رسمی کلینیک]</span>
                </div>
              </div>
            </div>

          </div>

          {/* Fixed Bottom Close Bar */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-slate-50 border-t border-slate-200 shrink-0 sticky bottom-0 z-20 flex items-center justify-between text-xs print:hidden">
            <span className="text-slate-500 text-[11px]">
              هزینه توافقی سفارش: <strong className="font-mono text-slate-900">{formatToman(order.cost)}</strong>
            </span>

            <button type="button"
              onClick={onClose}
              className="py-2 px-5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
            >
              بستن برگه
            </button>
          </div>

        </div>
      </div>
    </ViewportModalPortal>
  );
};
