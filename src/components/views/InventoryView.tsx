import React, { useState } from 'react';
import { 
  Package, AlertTriangle, Plus, Search, 
  Check, ArrowDownCircle, ShieldCheck, ShoppingCart,
  Layers, ChevronDown, Sparkles
} from 'lucide-react';
import { InventoryItem } from '../../types/dental';
import { toPersianDigits, formatToman } from '../../utils/jalali';

interface InventoryViewProps {
  inventory: InventoryItem[];
  onUpdateStock: (itemId: string, newStock: number) => void;
  onAddItem?: (item: InventoryItem) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  onUpdateStock,
  onAddItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New item form
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('کامپوزیت و باندینگ');
  const [formStock, setFormStock] = useState<number>(10);
  const [formMinAlert, setFormMinAlert] = useState<number>(3);
  const [formUnit, setFormUnit] = useState('تیوپ');
  const [formExpiry, setFormExpiry] = useState('۱۴۰۴/۰۶/۳۰');
  const [formPrice, setFormPrice] = useState<number>(850000);

  const categories = [
    'همه',
    'کامپوزیت و باندینگ',
    'بیحسی و سرنگ',
    'پروتز و قالبگیری',
    'ایمپلنت و جراحی',
    'اندودانتیکس',
    'وسایل مصرفی و ضدعفونی'
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const lowStockItems = inventory.filter(i => i.stock <= i.minAlert);
  const totalValue = inventory.reduce((sum, i) => sum + (i.stock * (i.pricePerUnit || 0)), 0);

  const filtered = inventory.filter(item => {
    const matchesSearch = item.name.includes(searchQuery) || item.category.includes(searchQuery);
    const matchesCat = selectedCategory === 'همه' || item.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || item.stock <= item.minAlert;
    return matchesSearch && matchesCat && matchesLowStock;
  });

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: formName,
      category: formCategory,
      stock: Number(formStock),
      minAlert: Number(formMinAlert),
      unit: formUnit,
      expiryDate: formExpiry,
      pricePerUnit: Number(formPrice)
    };

    if (onAddItem) {
      onAddItem(newItem);
    } else {
      inventory.unshift(newItem);
    }

    showToast(`کالای ${newItem.name} با موفقیت به انبار دندانپزشکی اضافه شد.`);
    setShowAddModal(false);
    setFormName('');
  };

  return (
    <div className="pb-28 space-y-3">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-[#162719] border border-[#c8ff00]/60 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-[#c8ff00] stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">انبار و متریال</h3>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="py-1.5 px-3 rounded-xl bg-[#c8ff00] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>کالای جدید</span>
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">اقلام فعال</span>
              <span className="text-xs font-black text-slate-800 font-mono">{toPersianDigits(inventory.length)} ردیف</span>
            </div>
            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`p-2 rounded-xl border text-center transition-all ${
                showLowStockOnly 
                  ? 'bg-red-500 text-white border-red-600 shadow-2xs' 
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}
            >
              <span className="text-[9px] block opacity-80">کسری موجودی</span>
              <span className="text-xs font-black font-mono">
                {toPersianDigits(lowStockItems.length)} کالا
              </span>
            </button>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] text-slate-400 block">ارزش ریالی انبار</span>
              <span className="text-[10px] font-black text-emerald-700 truncate block font-mono">{formatToman(totalValue)}</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجو در مواد، کامپوزیت، سرنگ، ایمپلنت و تجهیزات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:outline-none"
            />
          </div>

          {/* Categories Pill Scroller */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`py-1 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Items List */}
      <div className="mx-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
            کالایی با این مشخصات یافت نشد.
          </div>
        ) : (
          filtered.map(item => {
            const isLowStock = item.stock <= item.minAlert;

            return (
              <div
                key={item.id}
                className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{item.category}</span>
                  </div>

                  {isLowStock ? (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      هشدار کسری موجودی
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      موجودی کافی
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                  <div>
                    <span className="text-slate-400 block text-[9px]">موجودی در قفسه</span>
                    <span className={`font-mono font-black text-xs ${isLowStock ? 'text-red-500' : 'text-slate-800'}`}>
                      {toPersianDigits(item.stock)} {item.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[9px]">انقضا</span>
                    <span className="text-slate-700 font-mono text-[10px]">{toPersianDigits(item.expiryDate)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[9px]">قیمت خرید</span>
                    <span className="text-slate-700 font-mono text-[10px]">{formatToman(item.pricePerUnit)}</span>
                  </div>
                </div>

                {/* Adjust Stock buttons & Order trigger */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => showToast(`پیش‌فاکتور خرید ۱۰ عدد ${item.name} در لیست سفارش قرار گرفت.`)}
                    className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                  >
                    <ShoppingCart className="w-3 h-3 text-slate-500" />
                    <span>سفارش خرید مجدد</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateStock(item.id, item.stock - 1)}
                      disabled={item.stock <= 0}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center disabled:opacity-30"
                      title="کسر مصرفی"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-xs min-w-[20px] text-center">
                      {toPersianDigits(item.stock)}
                    </span>
                    <button
                      onClick={() => onUpdateStock(item.id, item.stock + 1)}
                      className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs"
                      title="افزودن خرید"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add New Item Modal (Emerald Medical Light Theme - Zero Black) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-emerald-50/90 via-white to-teal-50/50 text-slate-900 rounded-t-[32px] sm:rounded-[28px] border border-emerald-200/90 p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">افزودن متریال و کالا به انبار مطب</h3>
                  <span className="text-[10px] text-emerald-700 font-bold">کاردکس و موجودی کلینیک</span>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">نام کالا یا متریال *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: کامپوزیت 3M Filtek Z250 شید A2"
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">دسته‌بندی</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  {categories.filter(c => c !== 'همه').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">موجودی فعلی</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">حداقل هشدار</label>
                  <input
                    type="number"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">واحد سنجش</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="تیوپ / کارپول / بسته"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 text-center focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">تاریخ انقضا</label>
                  <input
                    type="text"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">قیمت خرید (تومان)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
                >
                  ثبت در کاردکس انبار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
