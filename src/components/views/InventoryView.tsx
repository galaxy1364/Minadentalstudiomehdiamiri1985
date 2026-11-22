import React, { useState } from 'react';
import { 
  Package, AlertTriangle, Plus, Search, 
  Check, ArrowDownCircle, ShieldCheck, ShoppingCart,
  Layers, ChevronDown, Sparkles, QrCode, Camera,
  ArrowUpDown, Tag, Barcode, MapPin, Eye, Filter,
  CheckSquare, Square, X, CheckCheck, SlidersHorizontal,
  Truck, ChevronUp, Edit3, Trash2, Lock, BarChart3
} from 'lucide-react';
import { Appointment, InventoryItem, Patient } from '../../types/dental';
import { toPersianDigits, toEnglishDigits, formatToman, getRelativePersianDate, getCurrentPersianDate, diffPersianDays } from '../../utils/jalali';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { InventoryQrScannerModal } from '../InventoryQrScannerModal';
import { InventoryBarcodeModal } from '../InventoryBarcodeModal';
import { BatchCategoryModal, BatchStockModal } from '../InventoryBatchModal';
import { SupplierPurchaseOrderModal } from '../SupplierPurchaseOrderModal';
import { InventoryAnalyticsD3 } from '../InventoryAnalyticsD3';
import { getModuleHeaderCardClasses, getUnifiedChipClasses, getUnifiedChipBadgeClasses } from '../../utils/chipThemes';
import { ViewportModalPortal } from '../ViewportModalPortal';
import { TrackableIdBadge } from '../TrackableIdBadge';
import { useEscapeKey } from '../../hooks/useDialogA11y';
import { actionFeedback } from '../../utils/actionFeedback';

interface InventoryViewProps {
  inventory: InventoryItem[];
  patients?: Patient[];
  appointments?: Appointment[];
  onUpdateStock: (itemId: string, newStock: number) => void;
  onAddItem?: (item: InventoryItem) => void;
  onBatchUpdate?: (updatedItems: InventoryItem[]) => void;
  isManager?: boolean;
}

export type SortOrder = 'min_stock' | 'name' | 'highest_price' | 'lowest_price' | 'expiry';

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  patients = [],
  appointments = [],
  onUpdateStock,
  onAddItem,
  onBatchUpdate,
  isManager = false
}) => {
  const { selection, impactLight, impactHeavy, success } = useHapticFeedback();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState<'catalog' | 'analytics'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('min_stock');
  
  // Multi-Select Mode state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleCollapseItem = (id: string) => {
    selection();
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBatchCategoryModal, setShowBatchCategoryModal] = useState(false);
  const [showBatchStockModal, setShowBatchStockModal] = useState(false);
  const [itemForBarcodeModal, setItemForBarcodeModal] = useState<InventoryItem | null>(null);
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Inventory Item Modal state & Manager PIN Guard
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemStock, setEditItemStock] = useState(0);
  const [editItemMinAlert, setEditItemMinAlert] = useState(2);
  const [editItemUnit, setEditItemUnit] = useState('عدد');
  const [editItemExpiry, setEditItemExpiry] = useState('');
  const [editItemPrice, setEditItemPrice] = useState(0);
  const [editItemLocation, setEditItemLocation] = useState('');
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [managerPinUnlocked, setManagerPinUnlocked] = useState(false);

  const canModifyCostOrDelete = isManager || managerPinUnlocked;

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
    } else {
      impactHeavy();
      setPinError(true);
    }
  };

  useEscapeKey(showAddModal, () => setShowAddModal(false));
  useEscapeKey(Boolean(editingItem), () => {
    setEditingItem(null);
    setConfirmDeleteItem(false);
    setShowPinPrompt(false);
  });

  const openEditInventoryModal = (item: InventoryItem) => {
    selection();
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemCategory(item.category);
    setEditItemStock(item.stock);
    setEditItemMinAlert(item.minAlert);
    setEditItemUnit(item.unit);
    setEditItemExpiry(item.expiryDate);
    setEditItemPrice(item.pricePerUnit || 0);
    setEditItemLocation(item.location || '');
    setConfirmDeleteItem(false);
    setShowPinPrompt(false);
    setPinError(false);
  };

  // New item form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('کامپوزیت و ترمیم');
  const [formStock, setFormStock] = useState<number>(10);
  const [formMinAlert, setFormMinAlert] = useState<number>(3);
  const [formUnit, setFormUnit] = useState('تیوپ');
  const [formExpiry, setFormExpiry] = useState(() => getRelativePersianDate(365));
  const [formPrice, setFormPrice] = useState<number>(850000);
  const [formBarcode, setFormBarcode] = useState('');
  const [formQrCode, setFormQrCode] = useState('');
  const [formLocation, setFormLocation] = useState('قفسه A-1');

  const categories = [
    'همه',
    'کامپوزیت و ترمیم',
    'بی‌حسی و دارو',
    'ایمپلنت و جراحی',
    'پروتز و قالب‌گیری',
    'اندودانتیکس',
    'مصرفی و بهداشتی'
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const todayPersian = getCurrentPersianDate();
  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return 9999;
    return diffPersianDays(todayPersian, expiryDate);
  };

  const lowStockItems = inventory.filter(i => i.stock <= i.minAlert);
  const expiringSoonItems = inventory.filter(i => i.expiryDate && getDaysUntilExpiry(i.expiryDate) <= 60);
  const totalValue = inventory.reduce((sum, i) => sum + (i.stock * (i.pricePerUnit || 0)), 0);

  // Filter items (supports Persian/Arabic normalized search)
  const normalizeSearch = (val?: string) =>
    toEnglishDigits(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();

  const filtered = inventory.filter(item => {
    const q = normalizeSearch(searchQuery);
    const matchesSearch = !q || 
      normalizeSearch(item.name).includes(q) || 
      normalizeSearch(item.category).includes(q) ||
      normalizeSearch(item.barcode).includes(q) ||
      normalizeSearch(item.qrCode).includes(q) ||
      normalizeSearch(item.location).includes(q);

    const matchesCat = selectedCategory === 'همه' || item.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || item.stock <= item.minAlert;
    const matchesExpiring = !showExpiringOnly || (Boolean(item.expiryDate) && getDaysUntilExpiry(item.expiryDate) <= 60);
    return matchesSearch && matchesCat && matchesLowStock && matchesExpiring;
  });

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'min_stock') {
      const aIsLow = a.stock <= a.minAlert ? 1 : 0;
      const bIsLow = b.stock <= b.minAlert ? 1 : 0;
      if (aIsLow !== bIsLow) return bIsLow - aIsLow;
      return a.stock - b.stock;
    }
    if (sortOrder === 'name') {
      return a.name.localeCompare(b.name, 'fa');
    }
    if (sortOrder === 'highest_price') {
      return (b.pricePerUnit || 0) - (a.pricePerUnit || 0);
    }
    if (sortOrder === 'lowest_price') {
      return (a.pricePerUnit || 0) - (b.pricePerUnit || 0);
    }
    if (sortOrder === 'expiry') {
      return getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate);
    }
    return 0;
  });

  // Multi-Select handlers
  const toggleSelectAll = () => {
    selection();
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(i => i.id)));
    }
  };

  const toggleItemSelection = (id: string) => {
    selection();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Batch Category Update
  const handleApplyBatchCategory = (newCategory: string) => {
    const updated = inventory.map(item =>
      selectedIds.has(item.id) ? { ...item, category: newCategory } : item
    );

    if (onBatchUpdate) {
      onBatchUpdate(updated);
    }

    success();
    actionFeedback.recordSuccess({
      title: `تغییر دسته‌بندی گروهی انبار`,
      subtitle: `${toPersianDigits(selectedIds.size)} قلم کالا`,
      diffAfter: `گروه جدید: ${newCategory}`
    });
    showToast(`دسته‌بندی ${toPersianDigits(selectedIds.size)} قلم کالا به «${newCategory}» تغییر یافت.`);
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  // Batch Stock Adjustment
  const handleApplyBatchStockAdjustment = (mode: 'add' | 'subtract' | 'set', amount: number) => {
    const updated = inventory.map(item => {
      if (selectedIds.has(item.id)) {
        let newStock = item.stock;
        if (mode === 'add') newStock = item.stock + amount;
        if (mode === 'subtract') newStock = Math.max(0, item.stock - amount);
        if (mode === 'set') newStock = Math.max(0, amount);
        onUpdateStock(item.id, newStock);
        return { ...item, stock: newStock };
      }
      return item;
    });

    if (onBatchUpdate) {
      onBatchUpdate(updated);
    }

    success();
    const actionDesc = mode === 'add' ? `افزایش ${toPersianDigits(amount)} واحدی` : mode === 'subtract' ? `کسر ${toPersianDigits(amount)} واحدی` : `تنظیم روی ${toPersianDigits(amount)} واحد`;
    actionFeedback.recordSuccess({
      title: `تعدیل موجودی انبار (${actionDesc})`,
      subtitle: `${toPersianDigits(selectedIds.size)} قلم کالای انتخابی`
    });
    showToast(`${actionDesc} برای ${toPersianDigits(selectedIds.size)} قلم کالا با موفقیت ثبت شد.`);
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  // Batch Reorder Requisition
  const handleBatchReorder = () => {
    selection();
    setShowPurchaseOrderModal(true);
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

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
      pricePerUnit: Number(formPrice),
      barcode: formBarcode || `62601${Math.floor(1000000 + Math.random() * 9000000)}`,
      qrCode: formQrCode || `MINA-INV-${Date.now().toString().slice(-6)}`,
      location: formLocation
    };

    if (onAddItem) {
      onAddItem(newItem);
    } else if (onBatchUpdate) {
      onBatchUpdate([newItem, ...inventory]);
    }

    success();
    actionFeedback.recordSuccess({
      title: `ثبت کالای جدید انبار: ${newItem.name}`,
      subtitle: `${newItem.category} · قفسه ${newItem.location || 'ثبت‌نشده'}`,
      diffAfter: `${toPersianDigits(newItem.stock)} ${newItem.unit}`
    });
    showToast(`کالای ${newItem.name} با موفقیت به انبار دندانپزشکی اضافه شد.`);
    setShowAddModal(false);
    setFormName('');
    setFormBarcode('');
    setFormQrCode('');
  };

  const selectedItemsList = inventory.filter(i => selectedIds.has(i.id));

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden pb-32 space-y-3" dir="rtl">
      {/* Bright QBank Emerald Toast alert */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-emerald-700 border border-emerald-400 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-lime-200 stroke-[3]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="relative z-20 mx-2 mt-2">
        <div className={getModuleHeaderCardClasses('emerald')}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/80 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-emerald-600 to-green-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <Package className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm text-slate-950 leading-none truncate">انبار و متریال مصرفی</h3>
                <span className="text-[10.5px] font-bold text-emerald-900 mt-1 block truncate">کنترل موجودی، هشدار کسری و سفارش خرید</span>
              </div>
            </div>

            {/* Top Action Buttons: Animated Search Magnifier, Multi-Select, QR Scanner & Add Item */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  selection();
                  setSearchOpen(!searchOpen);
                }}
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  searchOpen ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="جستجو در انبار"
                aria-label="جستجو در انبار"
              >
                <Search className="w-4 h-4 stroke-[2.25]" />
              </button>

              <button type="button"
                onClick={() => {
                  selection();
                  setIsMultiSelectMode(!isMultiSelectMode);
                  if (isMultiSelectMode) {
                    setSelectedIds(new Set());
                  }
                }}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all ${
                  isMultiSelectMode 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
                title="حالت انتخاب گروهی و ویرایش دسته‌جمعی"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isMultiSelectMode ? 'اتمام انتخاب' : 'انتخاب گروهی'}</span>
                <span className="sm:hidden">{isMultiSelectMode ? 'خروج' : 'گروهی'}</span>
              </button>

              <button type="button"
                onClick={() => {
                  selection();
                  setShowScannerModal(true);
                }}
                className="py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm shadow-emerald-600/30 active:scale-95 transition-all"
                title="اسکن بارکد و دریافت دیتای محصول (GS1 / EAN / QR)"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>اسکن دیتای بارکد</span>
              </button>

              <button type="button"
                onClick={() => {
                  selection();
                  setShowAddModal(true);
                }}
                className="py-1.5 px-2.5 rounded-xl bg-[#c8ff00] hover:bg-[#bbf000] text-black font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>کالای جدید</span>
              </button>
            </div>
          </div>

          {/* Animated Expandable Search Box & Sort Controls */}
          {searchOpen && (
            <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-150">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-emerald-600 absolute right-3 top-2.5" />
                <input
                  aria-label="جستجوی کالا یا بارکد انبار"
                  type="text"
                  autoFocus
                  placeholder="جستجو با نام، بارکد، QR یا دسته‌بندی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <select aria-label="انتخاب گزینه بالینی"
                  value={sortOrder}
                  onChange={(e) => {
                    selection();
                    setSortOrder(e.target.value as SortOrder);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-bold focus:outline-none appearance-none pr-6 cursor-pointer"
                >
                  <option value="min_stock">اولویت کسری موجودی</option>
                  <option value="name">نام کالا (الفبا)</option>
                  <option value="highest_price">بیشترین ارزش ریالی</option>
                  <option value="lowest_price">کمترین قیمت</option>
                  <option value="expiry">نزدیک‌ترین تاریخ انقضا</option>
                </select>
                <ArrowUpDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Material Category & D3 Analytics Pill Scroller */}
          <div role="tablist" aria-label="بخش‌های ماژول" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {categories.map((cat, idx) => {
              const count = cat === 'همه' 
                ? inventory.length 
                : inventory.filter(i => i.category === cat).length;
              const isActive = activeTabMode === 'catalog' && selectedCategory === cat;

              return (
                <button role="tab" aria-selected={isActive}
                  key={cat}
                  type="button"
                  onClick={() => {
                    selection();
                    setActiveTabMode('catalog');
                    setSelectedCategory(cat);
                  }}
                  className={getUnifiedChipClasses(idx, isActive)}
                >
                  <span>{cat}</span>
                  <span className={getUnifiedChipBadgeClasses(idx, isActive)}>
                    {toPersianDigits(count)}
                  </span>
                </button>
              );
            })}

            <button
              role="tab"
              aria-selected={activeTabMode === 'analytics'}
              type="button"
              onClick={() => {
                selection();
                setActiveTabMode('analytics');
                setIsMultiSelectMode(false);
              }}
              className={getUnifiedChipClasses(categories.length, activeTabMode === 'analytics')}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>تحلیل هوشمند انبار (D3)</span>
              <span className={getUnifiedChipBadgeClasses(categories.length, activeTabMode === 'analytics')}>
                AI
              </span>
            </button>
          </div>
        </div>
      </div>

      {activeTabMode === 'analytics' ? (
        <InventoryAnalyticsD3
          inventory={inventory}
          patients={patients}
          appointments={appointments}
          onOpenPurchaseOrder={() => setShowPurchaseOrderModal(true)}
        />
      ) : (
        <>
      {/* Executive Inventory Valuation, FEFO Expiry & 1-Click Low-Stock Filter Bar */}
      <div className="mx-2 p-3 rounded-[22px] bg-gradient-to-l from-emerald-50/90 via-white to-rose-50/60 border border-emerald-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-slate-900">
              ارزش کل موجودی انبار: <strong className="font-mono text-emerald-800">{formatToman(totalValue)}</strong>
            </span>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
              {toPersianDigits(lowStockItems.length)} قلم نیازمند شارژ فوری
            </span>
            {expiringSoonItems.length > 0 && (
              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                {toPersianDigits(expiringSoonItems.length)} قلم انقضای نزدیک FEFO
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {sorted.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  selection();
                  const anyExpanded = sorted.some(i => expandedItems[i.id]);
                  if (anyExpanded) {
                    setExpandedItems({});
                  } else {
                    const next: Record<string, boolean> = {};
                    sorted.forEach(i => { next[i.id] = true; });
                    setExpandedItems(next);
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black cursor-pointer active:scale-95 transition-all"
              >
                {sorted.some(i => expandedItems[i.id]) ? 'جمع کردن همه' : 'باز کردن همه'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                selection();
                setShowExpiringOnly(!showExpiringOnly);
              }}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer active:scale-95 ${
                showExpiringOnly
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
              }`}
            >
              {showExpiringOnly ? 'همه تاریخ‌ها' : `انقضای نزدیک FEFO (${toPersianDigits(expiringSoonItems.length)})`}
            </button>
            <button
              type="button"
              onClick={() => {
                selection();
                setShowLowStockOnly(!showLowStockOnly);
              }}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer active:scale-95 ${
                showLowStockOnly
                  ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              {showLowStockOnly ? 'نمایش همه کالاها' : `فقط کسری‌ها (${toPersianDigits(lowStockItems.length)})`}
            </button>
            <button
              type="button"
              onClick={() => {
                impactHeavy();
                setShowPurchaseOrderModal(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
            >
              <Truck className="w-3 h-3" />
              <span>سفارش خودکار کسری‌ها</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Items List */}
      <div className="mx-2 space-y-2">
        {sorted.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
            کالایی با این مشخصات در انبار دندانپزشکی یافت نشد.
          </div>
        ) : (
          sorted.map((item, idx) => {
            const isLowStock = item.stock <= item.minAlert;
            const daysLeft = getDaysUntilExpiry(item.expiryDate);
            const isExpired = Boolean(item.expiryDate) && daysLeft < 0;
            const isNearExpiry = Boolean(item.expiryDate) && daysLeft >= 0 && daysLeft <= 60;
            const isSelected = selectedIds.has(item.id);
            const isExpanded = !!expandedItems[item.id];
            const itemTotalValuation = item.stock * (item.pricePerUnit || 0);

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleItemSelection(item.id);
                  }
                }}
                className={`bg-white rounded-[20px] p-3 shadow-[var(--shadow-card)] border border-r-[3px] transition-all ${
                  isMultiSelectMode ? 'cursor-pointer select-none' : ''
                } ${
                  isSelected 
                    ? 'ring-2 ring-purple-500 bg-purple-50/30 border-purple-300 border-r-purple-600' 
                    : isLowStock 
                      ? 'border-rose-200/90 border-r-rose-500 bg-gradient-to-l from-rose-50/25 via-white to-white' 
                      : 'border-slate-200/90 border-r-emerald-500 hover:border-emerald-300'
                }`}
              >
                <div
                  onClick={(e) => {
                    if (!isMultiSelectMode) {
                      e.stopPropagation();
                      toggleCollapseItem(item.id);
                    }
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Multi-Select Checkbox */}
                    {isMultiSelectMode && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItemSelection(item.id);
                        }}
                        className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          isSelected 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'border-2 border-slate-300 hover:border-purple-400 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    )}

                    {/* Numbered Visual Badge */}
                    <div className={`w-8 h-8 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                      isLowStock
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      <Package className="w-3.5 h-3.5" />
                      <span className="text-[8px] font-mono font-black leading-none mt-0.5">#{toPersianDigits(idx + 1)}</span>
                    </div>

                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-black text-slate-900 truncate">{item.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9.5px] font-extrabold">
                          {item.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-mono font-black ${isLowStock ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
                          {toPersianDigits(item.stock)} {item.unit}
                        </span>
                        {item.location && (
                          <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-800 text-[9px] font-bold flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {item.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock Status & FEFO Expiry Badges + Collapse Toggle */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {(isExpired || isNearExpiry) && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                        isExpired
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        {isExpired ? 'منقضی شده' : `انقضا ${toPersianDigits(daysLeft)} روز`}
                      </span>
                    )}
                    {isLowStock ? (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9.5px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        <span>کسری</span>
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-700 text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        کافی ✓
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapseItem(item.id);
                      }}
                      className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-0.5 border transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                      title={isExpanded ? 'جمع کردن کارت کالا' : 'باز کردن جزئیات کالا'}
                    >
                      <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                    {/* Metrics Table */}
                    <div className="grid grid-cols-4 gap-1.5 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                      <div>
                        <span className="text-slate-400 block text-[9px]">موجودی قفسه</span>
                        <span className={`font-mono font-black text-xs ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                          {toPersianDigits(item.stock)} {item.unit}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[9px]">آستانه هشدار</span>
                        <span className="text-amber-700 font-mono font-bold text-[10px]">
                          ≤ {toPersianDigits(item.minAlert)} {item.unit}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[9px]">تاریخ انقضا</span>
                        <span className="text-slate-700 font-mono text-[10px]">{toPersianDigits(item.expiryDate)}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[9px]">ارزش کل موجودی</span>
                        <span className="text-emerald-800 font-mono font-black text-[10px]">{formatToman(itemTotalValuation)}</span>
                      </div>
                    </div>

                    {/* Bottom Bar: Barcode / QR Preview and Quick Stock Adjustments */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* View Barcode & QR Label Button */}
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selection();
                            setItemForBarcodeModal(item);
                          }}
                          className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="مشاهده و چاپ برچسب QR و بارکد"
                        >
                          <QrCode className="w-3 h-3 text-emerald-600" />
                          <span>لیبل QR</span>
                        </button>

                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selection();
                            setShowPurchaseOrderModal(true);
                          }}
                          className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
                        >
                          <ShoppingCart className="w-3 h-3 text-emerald-600" />
                          <span>سفارش مجدد</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditInventoryModal(item);
                          }}
                          className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center gap-1 transition-colors border border-amber-200/80 cursor-pointer active:scale-95"
                          title="ویرایش مشخصات کالا، قیمت، قفسه یا حذف کالا"
                        >
                          <Edit3 className="w-3 h-3 text-amber-700" />
                          <span>ویرایش کالا</span>
                        </button>

                        {isLowStock && (
                          <button type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              impactHeavy();
                              onUpdateStock(item.id, item.stock + 5);
                              showToast(`۵ ${item.unit} به موجودی «${item.name}» اضافه شد.`);
                            }}
                            className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                            <span>شارژ فوری (+۵)</span>
                          </button>
                        )}
                      </div>

                      {/* Direct + / - Stock Stepper */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button"
                          onClick={() => {
                            impactLight();
                            onUpdateStock(item.id, Math.max(0, item.stock - 1));
                          }}
                          disabled={item.stock <= 0}
                          aria-label="کسر یک عدد موجودی"
                          className="min-w-[38px] min-h-[38px] rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform cursor-pointer"
                          title="کسر ۱ عدد مصرفی"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs min-w-[24px] text-center tabular-nums">
                          {toPersianDigits(item.stock)}
                        </span>
                        <button type="button"
                          onClick={() => {
                            impactLight();
                            onUpdateStock(item.id, item.stock + 1);
                          }}
                          aria-label="افزودن یک عدد موجودی"
                          className="min-w-[38px] min-h-[38px] rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-2xs active:scale-90 transition-transform cursor-pointer"
                          title="افزودن ۱ عدد ورودی"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
        </>
      )}

      {/* Floating Batch Action Dock Bar (appears when items are selected) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-3 right-3 z-40 bg-white/95 backdrop-blur-md text-slate-900 p-3 rounded-[26px] border-2 border-purple-300 shadow-2xl flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-mono font-black text-xs">
              {toPersianDigits(selectedIds.size)}
            </span>
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">کالای انتخابی</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Batch Category Update */}
            <button type="button"
              onClick={() => {
                selection();
                setShowBatchCategoryModal(true);
              }}
              className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>تغییر دسته‌بندی</span>
            </button>

            {/* Batch Stock Adjustment */}
            <button type="button"
              onClick={() => {
                selection();
                setShowBatchStockModal(true);
              }}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>تعدیل موجودی</span>
            </button>

            {/* Batch Reorder */}
            <button type="button"
              onClick={handleBatchReorder}
              className="py-1.5 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-bold text-xs flex items-center gap-1 transition-all"
              title="سفارش خرید گروهی"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-purple-700" />
              <span className="hidden sm:inline">سفارش</span>
            </button>

            {/* Clear Selection */}
            <button type="button"
              onClick={() => {
                selection();
                setSelectedIds(new Set());
              }}
              aria-label="لغو انتخاب‌ها"
              className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
              title="لغو انتخاب‌ها"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add New Item Modal (Full-Page Mobile Sheet - Zero Page Scroll Required) */}
      {showAddModal && (
        <ViewportModalPortal isOpen={showAddModal}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="افزودن متریال و کالا به انبار مطب"
            className="fixed inset-0 z-[100] bg-emerald-950/35 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setShowAddModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-gradient-to-b from-emerald-50/95 via-white to-teal-50/50 text-slate-900 rounded-none sm:rounded-[28px] border-0 sm:border border-emerald-200/90 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Fixed Sheet Header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-emerald-200/80 bg-white/95 shrink-0 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-emerald-300/80 mx-auto mb-2 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900">افزودن متریال و کالا به انبار مطب</h3>
                      <span className="text-[9.5px] font-bold text-emerald-700">شیت تمام‌صفحه ثبت کاردکس کالا</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)} 
                    aria-label="بستن افزودن کالای انبار"
                    className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet Content */}
              <form id="new-inventory-item-form" onSubmit={handleCreateItem} className="p-4 space-y-3 text-[11px] flex-1 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <label className="text-slate-700 font-bold block mb-1">نام کالا یا متریال *</label>
                    <input
                      aria-label="نام کالا یا متریال"
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="مثال: کامپوزیت 3M Filtek Z250"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div className="col-span-5">
                    <label className="text-slate-700 font-bold block mb-1">دسته‌بندی متریال</label>
                    <select aria-label="دسته‌بندی متریال"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    >
                      {categories.filter(c => c !== 'همه').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">موجودی فعلی</label>
                    <input aria-label="موجودی فعلی"
                      type="number"
                      value={formStock}
                      onChange={(e) => setFormStock(Number(e.target.value))}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">حداقل هشدار</label>
                    <input aria-label="حداقل هشدار"
                      type="number"
                      value={formMinAlert}
                      onChange={(e) => setFormMinAlert(Number(e.target.value))}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 text-center font-mono font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">واحد سنجش</label>
                    <input
                      aria-label="واحد سنجش کالا"
                      type="text"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="تیوپ / بسته"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2 py-2 text-slate-900 text-center font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">تاریخ انقضا</label>
                    <input aria-label="تاریخ انقضا"
                      type="text"
                      value={formExpiry}
                      onChange={(e) => setFormExpiry(e.target.value)}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">قیمت خرید (تومان)</label>
                    <input aria-label="قیمت خرید (تومان)"
                      type="number"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">بارکد کالا (اختیاری)</label>
                    <input
                      aria-label="بارکد کالا"
                      type="text"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      placeholder="626012345010"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">محل نگهداری / قفسه</label>
                    <input
                      aria-label="محل نگهداری یا قفسه"
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="قفسه A-1 / یخچال"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>
              </form>

              {/* Fixed Bottom Action Footer */}
              <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 border-t border-emerald-100 shrink-0 sticky bottom-0 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  form="new-inventory-item-form"
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  ثبت در کاردکس انبار
                </button>
              </div>
            </div>
          </div>
        </ViewportModalPortal>
      )}

      {/* Batch Category Update Modal */}
      <BatchCategoryModal
        isOpen={showBatchCategoryModal}
        onClose={() => setShowBatchCategoryModal(false)}
        selectedItems={selectedItemsList}
        categories={categories}
        onApplyCategory={handleApplyBatchCategory}
      />

      {/* Batch Stock Adjustment Modal */}
      <BatchStockModal
        isOpen={showBatchStockModal}
        onClose={() => setShowBatchStockModal(false)}
        selectedItems={selectedItemsList}
        onApplyStockAdjustment={handleApplyBatchStockAdjustment}
      />

      {/* Camera QR & Barcode Scanner Modal */}
      <InventoryQrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        inventory={inventory}
        onUpdateStock={onUpdateStock}
        onRegisterScannedProduct={onAddItem}
        onShowToast={showToast}
      />

      {/* Barcode & QR Sticker Preview Modal */}
      <InventoryBarcodeModal
        isOpen={!!itemForBarcodeModal}
        onClose={() => setItemForBarcodeModal(null)}
        item={itemForBarcodeModal}
        onShowToast={showToast}
      />

      {/* Dental Supplier Purchase Order & Restock Modal */}
      <SupplierPurchaseOrderModal
        isOpen={showPurchaseOrderModal}
        onClose={() => setShowPurchaseOrderModal(false)}
        inventory={inventory}
        onRestockReceived={(restockedItems) => {
          restockedItems.forEach(({ itemId, quantityAdded }) => {
            const currentItem = inventory.find(i => i.id === itemId);
            if (currentItem) {
              onUpdateStock(itemId, currentItem.stock + quantityAdded);
            }
          });
          showToast(`موجودی ${toPersianDigits(restockedItems.length)} قلم کالا با موفقیت به‌روزرسانی و شارژ شد.`);
        }}
      />

      {/* Full Edit / Delete Inventory Item Modal */}
      {editingItem && (
        <ViewportModalPortal>
          <div
            className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setEditingItem(null)}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="ویرایش مشخصات کالای انبار"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white text-slate-900 rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-emerald-200 p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">ویرایش مشخصات کالای انبار</h4>
                    <span className="text-[10px] text-slate-500 font-bold">اصلاح نام، قیمت واحد، تاریخ انقضا، قفسه یا حذف کالا</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  aria-label="بستن ویرایش کالای انبار"
                  className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">نام دقیق کالا / متریال مصرفی</label>
                  <input aria-label="نام دقیق کالا / متریال مصرفی"
                    type="text"
                    value={editItemName}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">دسته‌بندی</label>
                    <select aria-label="دسته‌بندی"
                      value={editItemCategory}
                      onChange={(e) => setEditItemCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      {categories.filter(c => c !== 'همه').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">واحد شمارش</label>
                    <input aria-label="واحد شمارش"
                      type="text"
                      value={editItemUnit}
                      onChange={(e) => setEditItemUnit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">موجودی فعلی</label>
                    <input aria-label="موجودی فعلی"
                      type="number"
                      value={editItemStock}
                      onChange={(e) => setEditItemStock(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">حداقل هشدار</label>
                    <input aria-label="حداقل هشدار"
                      type="number"
                      value={editItemMinAlert}
                      onChange={(e) => setEditItemMinAlert(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">قیمت واحد (تومان)</label>
                    <input aria-label="قیمت واحد (تومان)"
                      type="number"
                      disabled={!canModifyCostOrDelete}
                      value={editItemPrice}
                      onChange={(e) => setEditItemPrice(Number(e.target.value))}
                      className={`w-full border rounded-xl px-2.5 py-2 font-mono font-bold focus:outline-none ${
                        canModifyCostOrDelete
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-500'
                          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                {!canModifyCostOrDelete && (
                  <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-bold text-amber-900 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        <span>تغییر قیمت واحد یا حذف کالای انبار نیازمند پین مدیر است</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          selection();
                          setShowPinPrompt(!showPinPrompt);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black cursor-pointer"
                      >
                        تایید مدیر
                      </button>
                    </div>
                    {showPinPrompt && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="password"
                          aria-label="پین مدیر انبار"
                          dir="ltr"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value);
                            setPinError(false);
                          }}
                          placeholder="PIN (1234)"
                          className="w-28 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-center text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={verifyManagerPin}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black cursor-pointer"
                        >
                          باز کردن قفل
                        </button>
                        {pinError && <span className="text-[10px] font-bold text-rose-600">پین نادرست است</span>}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">تاریخ انقضا</label>
                    <input aria-label="تاریخ انقضا"
                      type="text"
                      value={editItemExpiry}
                      onChange={(e) => setEditItemExpiry(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">محل قفسه / یخچال</label>
                    <input aria-label="محل قفسه / یخچال"
                      type="text"
                      value={editItemLocation}
                      onChange={(e) => setEditItemLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {onBatchUpdate && canModifyCostOrDelete ? (
                  <div className="flex items-center gap-1">
                    {confirmDeleteItem && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItem(false)}
                        className="py-2 px-2.5 rounded-xl bg-slate-100 text-slate-600 text-[10.5px] font-bold cursor-pointer"
                      >
                        لغو
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmDeleteItem) {
                          impactHeavy();
                          setConfirmDeleteItem(true);
                          return;
                        }
                        impactHeavy();
                        onBatchUpdate(inventory.filter(i => i.id !== editingItem.id));
                        actionFeedback.recordSuccess({
                          title: `حذف کالا از انبار: ${editingItem.name}`,
                          subtitle: `گروه ${editingItem.category}`,
                          diffBefore: `${toPersianDigits(editingItem.stock)} ${editingItem.unit}`,
                          diffAfter: 'انتقال به بایگانی مدیر'
                        });
                        showToast(`کالای «${editingItem.name}» با مجوز مدیر حذف و بایگانی شد.`);
                        setConfirmDeleteItem(false);
                        setEditingItem(null);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center gap-1 cursor-pointer transition-all ${
                        confirmDeleteItem
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 animate-pulse'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{confirmDeleteItem ? 'تایید حذف قطعی ✓' : 'حذف کالا (مدیر)'}</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">🔒 حذف کالا فقط با مجوز مدیر</span>
                )}
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteItem(false);
                      setEditingItem(null);
                    }}
                    className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editItemName.trim()) return;
                      success();
                      const nextPrice = canModifyCostOrDelete ? editItemPrice : (editingItem.pricePerUnit || 0);
                      if (onBatchUpdate) {
                        onBatchUpdate(
                          inventory.map(i =>
                            i.id === editingItem.id
                              ? {
                                  ...i,
                                  name: editItemName.trim(),
                                  category: editItemCategory,
                                  stock: editItemStock,
                                  minAlert: editItemMinAlert,
                                  unit: editItemUnit.trim(),
                                  expiryDate: editItemExpiry.trim(),
                                  pricePerUnit: nextPrice,
                                  location: editItemLocation.trim()
                                }
                              : i
                          )
                        );
                      }
                      actionFeedback.recordSuccess({
                        title: `به‌روزرسانی کالای «${editItemName}»`,
                        subtitle: `قفسه: ${editItemLocation.trim() || '—'} · موجودی: ${toPersianDigits(editItemStock)} ${editItemUnit}`
                      });
                      showToast(`مشخصات کالای «${editItemName}» با موفقیت ذخیره شد.`);
                      setEditingItem(null);
                    }}
                    className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    ذخیره تغییرات کالا ✓
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
