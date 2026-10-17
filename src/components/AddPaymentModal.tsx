import React, { useState } from 'react';
import { X, Receipt } from 'lucide-react';
import { Patient, PaymentRecord } from '../types/dental';
import { formatToman } from '../utils/jalali';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onAddPayment: (payment: PaymentRecord) => void;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  patients,
  onAddPayment
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [amount, setAmount] = useState(5000000);
  const [method, setMethod] = useState<'pos' | 'card_to_card' | 'cash'>('pos');
  const [refNumber, setRefNumber] = useState('۸۳۹۱۸۲۴۷');
  const [forTreatment, setForTreatment] = useState('تسویه قسط درمانی / بیعانه');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      patientId: selectedPatientId,
      patientName: patient.fullName,
      amount,
      date: '۱۴۰۳/۰۸/۱۵',
      method,
      referenceNumber: refNumber,
      terminalName: method === 'pos' ? 'کارتخوان پذیرش مطب (به‌پرداخت ملت)' : undefined,
      forTreatment
    };

    onAddPayment(newPayment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-emerald-950/20 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-gradient-to-b from-emerald-50/80 via-white to-lime-50/30 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-emerald-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">ثبت پرداخت بیمار (کارتخوان POS / نقد)</h3>
              <span className="text-[10px] text-emerald-700 font-bold">صندوق و تسویه حساب مطب</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-700 font-bold block mb-1">انتخاب بیمار</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-700 font-bold block mb-1">روش پرداخت</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pos', label: 'دستگاه POS' },
                { id: 'card_to_card', label: 'کارت به کارت' },
                { id: 'cash', label: 'وجه نقد' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id as any)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    method === m.id ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-slate-700 font-bold block mb-1">مبلغ پرداختی (تومان)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
              required
            />
            <span className="text-[10.5px] text-emerald-700 font-bold mt-1 block">معادل: {formatToman(amount)}</span>
          </div>

          <div>
            <label className="text-slate-700 font-bold block mb-1">شماره پیگیری / ارجاع تراکنش</label>
            <input
              type="text"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              placeholder="کد پیگیری رسید کارتخوان یا انتقال"
              className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="text-slate-700 font-bold block mb-1">بابت درمان</label>
            <input
              type="text"
              value={forTreatment}
              onChange={(e) => setForTreatment(e.target.value)}
              className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
            >
              ثبت تراکنش و کسر از بدهی
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
