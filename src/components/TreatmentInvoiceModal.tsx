import React, { useMemo, useRef, useState } from 'react';
import { X, Printer, FileText, Share2, Download, CheckCircle2 } from 'lucide-react';
import { Patient } from '../types/dental';
import { toPersianDigits, formatToman, getCurrentPersianDate } from '../utils/jalali';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { copyTextSafely } from '../utils/clipboard';

interface TreatmentInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

const TREATMENT_TITLES: Record<string, string> = {
  composite: 'ترمیم کامپوزیت زیبایی / بیلداپ',
  amalgam: 'ترمیم آمالگام تخصصی',
  endo: 'درمان ریشه (عصب‌کشی تخصصی روت‌کانال)',
  crown_zirconia: 'روکش تمام زیرکونیا مولتی‌لیر',
  crown_pfm: 'روکش پرسلن فلز (PFM)',
  laminate: 'لمینت سرامیکی پرسلن',
  implant: 'جراحی کاشت فیکسچر ایمپلنت دندان',
  extraction: 'کشیدن / جراحی دندان',
  scaling: 'جرم‌گیری و بروساژ کامل دو فک',
  bleaching: 'بلیچینگ آفیس دندان‌ها'
};

export const TreatmentInvoiceModal: React.FC<TreatmentInvoiceModalProps> = ({
  isOpen,
  onClose,
  patient
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  useEscapeKey(isOpen && Boolean(patient), onClose);

  const receiptNumber = useMemo(() => {
    const seed = patient ? `${patient.id}-${patient.fileNumber}` : '000000';
    let hash = 104729;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 900000;
    }
    return toPersianDigits(String(100000 + hash));
  }, [patient?.id, patient?.fileNumber]);

  if (!isOpen || !patient) return null;

  const treatments = Object.entries(patient.teethConditions || {}).map(([key, item]) => ({
    key,
    tooth: `${item.quadrant}${item.toothNumber}`,
    title: TREATMENT_TITLES[item.treatment] || item.treatment,
    doctorName: item.doctorName || 'دکتر مهدی امیری',
    cost: item.cost || 0,
    status: item.status,
    date: item.date || getCurrentPersianDate()
  }));

  const payments = patient.payments || [];
  const checks = patient.sayadChecks || [];

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 2800);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const lines = [
      `صورتحساب رسمی کلینیک دندانپزشکی مینادنتال`,
      `شماره قبض: ${receiptNumber} | تاریخ: ${getCurrentPersianDate()}`,
      `بیمار: ${patient.fullName} (پرونده ${toPersianDigits(patient.fileNumber)})`,
      `خدمات: ${treatments.map(t => `${t.title} [${t.tooth}]`).join('، ') || '---'}`,
      `مجموع هزینه: ${formatToman(patient.totalCost)}`,
      `پرداختی کل: ${formatToman(patient.paidAmount)}`,
      patient.balance < 0 ? `مانده بدهی: ${formatToman(Math.abs(patient.balance))}` : `وضعیت حساب: تسویه کامل ✓`
    ].join('\n');
    void copyTextSafely(lines);
    showNotice('خلاصه صورتحساب برای ارسال به واتساپ بیمار کپی شد ✓');
  };

  const handleExportCsv = () => {
    const headers = ['شماره قبض', 'نام بیمار', 'شماره پرونده', 'دندان', 'شرح خدمت', 'پزشک معالج', 'وضعیت', 'تعرفه (تومان)'];
    const rows = treatments.map(t => [
      receiptNumber,
      patient.fullName,
      patient.fileNumber,
      t.tooth,
      t.title,
      t.doctorName,
      t.status === 'completed' ? 'تکمیل شده' : 'در حال درمان',
      String(t.cost)
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minadental-invoice-${patient.fileNumber}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    showNotice('فایل اکسل صورتحساب (CSV) با موفقیت دانلود شد ✓');
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="صورتحساب رسمی درمان بیمار"
        className="fixed inset-0 z-[100] bg-cyan-950/30 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 print:p-0 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-full min-w-0 sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-cyan-100 overflow-hidden flex flex-col print:max-h-none print:shadow-none print:border-none print:rounded-none text-right"
        >
          {/* Modal Top Bar (Hidden on print) */}
          <div className="p-3 bg-cyan-50/70 border-b border-cyan-100 flex items-center justify-between gap-2 print:hidden shrink-0 sticky top-0 z-20 min-w-0 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-slate-800 truncate">صدور و چاپ صورتحساب رسمی درمان</h3>
                <span className="text-[10px] text-slate-500 block truncate">جهت ارائه به بیمار و بیمه‌های تکمیلی</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleCopySummary}
                className="py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                title="کپی خلاصه صورتحساب برای واتساپ بیمار"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>واتساپ</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                title="دانلود فایل اکسل صورتحساب"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ صورتحساب</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن صورتحساب درمان"
                className="min-w-[38px] min-h-[38px] rounded-[12px] hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {actionNotice && (
            <div className="mx-4 mt-2.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1.5 print:hidden">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

        {/* Printable Invoice Sheet */}
        <div ref={printAreaRef} className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden print:overflow-visible space-y-4 text-slate-900 bg-white min-w-0">
          
          {/* Clinic Header */}
          <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-cyan-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-700 text-white font-black flex items-center justify-center text-xs shadow-xs">
                  MD
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black text-slate-900">کلینیک تخصصی دندانپزشکی مینادنتال</h1>
                  <span className="text-[11px] font-bold text-slate-600 block">دکتر مهدی امیری · جراح و دندانپزشک (ن.پ: ۱۲۸۴۷)</span>
                </div>
              </div>
            </div>

            <div className="text-left font-mono text-[11px] space-y-0.5">
              <div><span className="font-sans text-slate-500">شماره قبض: </span><span className="font-bold text-slate-900">{receiptNumber}</span></div>
              <div><span className="font-sans text-slate-500">تاریخ صدور: </span><span className="font-bold text-slate-900">{getCurrentPersianDate()}</span></div>
            </div>
          </div>

          {/* Patient Info Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">نام بیمار</span>
              <span className="font-extrabold text-slate-900 truncate block">{patient.fullName}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">شماره پرونده</span>
              <span className="font-black text-cyan-700 font-mono text-sm truncate block">{toPersianDigits(patient.fileNumber)}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">کد ملی</span>
              <span className="font-mono text-slate-700 truncate block">{toPersianDigits(patient.nationalId || '---')}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">شماره تماس</span>
              <span className="font-mono text-slate-700 truncate block">{toPersianDigits(patient.phone)}</span>
            </div>
          </div>

          {/* Treatments Table */}
          <div className="min-w-0">
            <h4 className="text-xs font-black text-slate-800 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-600" />
              <span>ریز خدمات، شماره دندان پالمر و پزشک معالج</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-right text-xs min-w-[420px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">دندان</th>
                    <th className="p-2">شرح خدمت دندانپزشکی</th>
                    <th className="p-2">پزشک معالج</th>
                    <th className="p-2 text-center">وضعیت</th>
                    <th className="p-2 text-left">تعرفه (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treatments.length > 0 ? (
                    treatments.map((t, idx) => (
                      <tr key={t.key} className="hover:bg-slate-50">
                        <td className="p-2 text-center text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="p-2 font-mono font-bold text-slate-800">{t.tooth}</td>
                        <td className="p-2 font-bold text-slate-900">{t.title}</td>
                        <td className="p-2 font-bold text-cyan-800 text-[11px]">{t.doctorName}</td>
                        <td className="p-2 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            t.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status === 'completed' ? 'تکمیل شده' : 'در حال درمان'}
                          </span>
                        </td>
                        <td className="p-2 text-left font-mono font-black text-slate-900">
                          {formatToman(t.cost)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        درمانی ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments, Checks, Guarantee Custody & Installments Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Payments & Checks List */}
            <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-2">
              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">پرداختی‌ها و رسید کارتخوان:</span>
                <div className="space-y-1">
                  {payments.length > 0 ? (
                    payments.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-[11px] text-slate-600">
                        <span>{p.forTreatment || 'پرداخت صندوق'} ({toPersianDigits(p.date)})</span>
                        <span className="font-mono font-bold text-emerald-700">{formatToman(p.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[10px]">پرداخت ثبت‌شده‌ای یافت نشد.</span>
                  )}
                </div>
              </div>

              {(() => {
                const insts = patient.installments || [];
                const unpaidInstsCount = insts.filter(i => i.status !== 'paid').length;
                const regularChecks = checks.filter(c => !c.isGuarantee);
                const guaranteeChecks = checks.filter(c => c.isGuarantee);
                return (
                  <>
                    {regularChecks.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                        <span className="font-black text-amber-900 block">
                          چک‌های صیادی اقساط ({toPersianDigits(regularChecks.length)} فقره · {formatToman(regularChecks.reduce((s, c) => s + c.amount, 0))}):
                        </span>
                        {regularChecks.slice(0, 4).map(chk => (
                          <div key={chk.id} className="flex justify-between items-center text-[10px]">
                            <span>بانک {chk.bankName} ({toPersianDigits(chk.dueDate)})</span>
                            <span className="font-mono font-bold">
                              {formatToman(chk.amount)} · {chk.status === 'cleared' ? 'پاس شده ✓' : chk.status === 'bounced' ? 'برگشتی' : 'در جریان'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {guaranteeChecks.length > 0 && (
                      <div className="pt-1.5 border-t border-indigo-200 bg-indigo-50/70 p-2 rounded-lg text-[10px] space-y-0.5">
                        <span className="font-black text-indigo-950 block">
                          چک ضمانت امانی در گاوصندوق ({toPersianDigits(guaranteeChecks.length)} فقره):
                        </span>
                        {guaranteeChecks.map(g => {
                          const readyToReturn = g.status !== 'cleared' && unpaidInstsCount === 0 && patient.balance >= 0;
                          return (
                            <div key={g.id} className="flex justify-between items-center text-[10px] text-indigo-900">
                              <span>ضمانت {g.bankName} (صیاد {toPersianDigits(g.sayadId.slice(-6))})</span>
                              <span className="font-black">
                                {g.status === 'cleared'
                                  ? 'عودت داده شد ✓'
                                  : readyToReturn
                                    ? 'آماده عودت به بیمار ✓'
                                    : `${formatToman(g.amount)} · امانی`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {insts.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200 text-[10px] space-y-0.5">
                        <span className="font-black text-rose-900 block">
                          برنامه اقساط ({toPersianDigits(insts.length - unpaidInstsCount)}/{toPersianDigits(insts.length)} قسط تسویه شده):
                        </span>
                        {insts.slice(0, 4).map(ins => (
                          <div key={ins.id} className="flex justify-between items-center text-[10px] text-slate-600">
                            <span>قسط {toPersianDigits(ins.installmentNumber)} · سررسید {toPersianDigits(ins.dueDate)}</span>
                            <span className={`font-mono font-bold ${ins.status === 'paid' ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {formatToman(ins.amount)} ({ins.status === 'paid' ? 'پرداخت ✓' : ins.status === 'overdue' ? 'معوق' : 'در انتظار'})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Financial Summary Box */}
            <div className="border border-cyan-200 rounded-2xl p-4 bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-700 text-white space-y-2 flex flex-col justify-between shadow-md">
              <div className="flex justify-between items-center text-xs">
                <span className="text-cyan-100">مجموع هزینه‌های درمانی:</span>
                <span className="font-mono font-bold text-white">{formatToman(patient.totalCost)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-cyan-100">مجموع دریافتی کلینیک:</span>
                <span className="font-mono font-bold text-emerald-200">{formatToman(patient.paidAmount)}</span>
              </div>
              <div className="pt-2 border-t border-white/20 flex justify-between items-center text-sm font-black">
                <span>{patient.balance < 0 ? 'مانده بدهی بیمار:' : 'تراز حساب (تسویه):'}</span>
                <span className={`font-mono ${patient.balance < 0 ? 'text-amber-200' : 'text-emerald-200'}`}>
                  {patient.balance === 0 ? 'تسویه کامل' : formatToman(Math.abs(patient.balance))}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Signature & Stamp Box */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-xs text-slate-600">
            <div className="space-y-1 text-[10px] text-slate-500">
              <p>این صورتحساب توسط سامانه یکپارچه بالینی مینادنتال صادر گردیده و معتبر است.</p>
              <p>آدرس: تهران، سعادت‌آباد، خیابان علامه شمالی، پلاک ۴۲ · تلفن: ۰۲۱-۲۲۱۴۵۶۷۸</p>
            </div>

            <div className="text-center w-36">
              <div className="h-14 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 mb-1">
                محل امضا و مهر پزشک
              </div>
              <span className="text-[10px] font-bold text-slate-700">دکتر مهدی امیری</span>
            </div>
          </div>

        </div>

        </div>
      </div>
    </ViewportModalPortal>
  );
};
