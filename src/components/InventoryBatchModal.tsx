import React, { useState } from 'react';
import { 
  X, Check, Layers, Package, Plus, Minus, 
  ArrowUpDown, Sparkles, AlertCircle, ShoppingCart 
} from 'lucide-react';
import { InventoryItem } from '../types/dental';
import { toPersianDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';

interface BatchCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: InventoryItem[];
  categories: string[];
  onApplyCategory: (newCategory: string) => void;
}

export const BatchCategoryModal: React.FC<BatchCategoryModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  categories,
  onApplyCategory
}) => {
  const { impactMedium, selection } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);
  const validCategories = categories.filter((c) => c !== 'همه');
  const [selectedCat, setSelectedCat] = useState<string>(validCategories[0] || 'کامپوزیت و ترمیم');

  React.useEffect(() => {
    if (isOpen && validCategories.length > 0 && !validCategories.includes(selectedCat)) {
      setSelectedCat(validCategories[0]);
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    impactMedium();
    onApplyCategory(selectedCat);
    onClose();
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="تغییر دسته‌بندی گروهی کالاها"
        className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        dir="rtl"
        onClick={onClose}
      >
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-sm h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[28px] border-0 sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900 text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3 border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-purple-300/80 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تغییر دسته‌بندی گروهی</h3>
                  <span className="text-[10px] text-slate-400">
                    اعمال برای {toPersianDigits(selectedItems.length)} قلم کالای انتخابی
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن تغییر دسته‌بندی"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-3.5">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 max-h-32 overflow-y-auto space-y-1 text-xs">
              <span className="text-[10px] text-slate-500 font-bold block mb-1">کالاهای انتخاب شده:</span>
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-[11px] text-slate-700 bg-white p-1 px-2 rounded-lg border border-slate-100">
                  <span className="truncate">{item.name}</span>
                  <span className="text-[9px] text-slate-400 mr-2 shrink-0">{item.category}</span>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                دسته‌بندی جدید برای انتقال:
              </label>
              <div className="space-y-1.5">
                {validCategories.map(cat => (
                  <label
                    key={cat}
                    onClick={selection}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedCat === cat
                        ? 'bg-purple-50 border-purple-300 text-purple-900 font-black shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat}</span>
                    <input
                      type="radio"
                      name="batchCategory"
                      checked={selectedCat === cat}
                      onChange={() => setSelectedCat(cat)}
                      className="accent-purple-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center gap-2 shrink-0 sticky bottom-0 z-20">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-center cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-lg shadow-purple-600/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>اعمال دسته‌بندی جدید</span>
            </button>
          </div>
        </form>
      </div>
    </ViewportModalPortal>
  );
};

interface BatchStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: InventoryItem[];
  onApplyStockAdjustment: (mode: 'add' | 'subtract' | 'set', amount: number) => void;
}

export const BatchStockModal: React.FC<BatchStockModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  onApplyStockAdjustment
}) => {
  const { impactMedium, selection } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);
  const [mode, setMode] = useState<'add' | 'subtract' | 'set'>('add');
  const [amount, setAmount] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode('add');
      setAmount(5);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const computeProjectedStock = (currentStock: number) => {
    const safeVal = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (mode === 'add') return currentStock + safeVal;
    if (mode === 'subtract') return Math.max(0, currentStock - safeVal);
    return safeVal;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0 || (mode !== 'set' && numeric <= 0)) {
      setErrorMsg(mode === 'set' ? 'مقدار موجودی نمی‌تواند منفی باشد.' : 'تعداد تغییر موجودی باید بزرگ‌تر از صفر باشد.');
      return;
    }
    setErrorMsg(null);
    impactMedium();
    onApplyStockAdjustment(mode, Math.floor(numeric));
    onClose();
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ویرایش گروهی موجودی کالاهای انبار"
        className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
        dir="rtl"
        onClick={onClose}
      >
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-sm h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-[28px] border-0 sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900 text-right"
        >
          {/* Fixed Header */}
          <div className="px-4 pt-3 pb-3 border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-emerald-300/80 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تعدیل گروهی موجودی انبار</h3>
                  <span className="text-[10px] text-slate-400">
                    اعمال برای {toPersianDigits(selectedItems.length)} قلم کالا
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن تعدیل موجودی"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 flex-1 overflow-y-auto overscroll-contain space-y-4">
            {/* Operation Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-center font-bold">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setMode('add');
                }}
                className={`py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  mode === 'add'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                افزایش (+ خرید)
              </button>
              <button
                type="button"
                onClick={() => {
                  selection();
                  setMode('subtract');
                }}
                className={`py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  mode === 'subtract'
                    ? 'bg-rose-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                کاهش (- مصرف)
              </button>
              <button
                type="button"
                onClick={() => {
                  selection();
                  setMode('set');
                }}
                className={`py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  mode === 'set'
                    ? 'bg-amber-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تنظیم مقدار ثابت
              </button>
            </div>

            {/* Amount input & presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block text-center">
                {mode === 'add' && 'تعداد اضافه شده به هر قلم کالا:'}
                {mode === 'subtract' && 'تعداد کسر شده از هر قلم کالا:'}
                {mode === 'set' && 'مقدار موجودی جدید برای همه اقلام انتخابی:'}
              </label>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setAmount(prev => Math.max(1, prev - 1));
                  }}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                >
                  -
                </button>
                
                <input aria-label="ورودی اطلاعات بالینی"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-24 text-center font-mono font-black text-xl py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />

                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setAmount(prev => prev + 1);
                  }}
                  className="w-10 h-10 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-lg flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[1, 5, 10, 20].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      selection();
                      setAmount(val);
                      setErrorMsg(null);
                    }}
                    className={`py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      amount === val 
                        ? 'bg-emerald-700 text-white border-emerald-700' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {toPersianDigits(val)} عدد
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Live Before -> After Stock Projection Preview */}
            {selectedItems.length > 0 && (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-black text-slate-600 block">پیش‌نمایش موجودی پس از اعمال:</span>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {selectedItems.slice(0, 6).map((item) => {
                    const nextStock = computeProjectedStock(item.stock);
                    return (
                      <div key={item.id} className="flex items-center justify-between text-[10.5px] bg-white px-2 py-1 rounded-lg border border-slate-100">
                        <span className="truncate font-bold text-slate-800">{item.name}</span>
                        <span className="font-mono font-black shrink-0 mr-2 text-emerald-700">
                          {toPersianDigits(item.stock)} ← {toPersianDigits(nextStock)} {item.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center gap-2 shrink-0 sticky bottom-0 z-20">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-center cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>اعمال تغییرات موجودی</span>
            </button>
          </div>
        </form>
      </div>
    </ViewportModalPortal>
  );
};
