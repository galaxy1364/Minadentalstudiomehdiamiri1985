import React, { useState, useEffect } from 'react';
import { 
  X, ShoppingBag, Truck, CheckCircle2, 
  Send, Plus, Trash2, Printer, Building2, 
  Clock, Phone, AlertCircle, History
} from 'lucide-react';
import { InventoryItem } from '../types/dental';
import { 
  inventoryConsumptionService, 
  DENTAL_SUPPLIERS, 
  SupplierPurchaseOrder, 
  DentalSupplier 
} from '../services/inventoryConsumptionService';
import { toPersianDigits, formatToman, getCurrentPersianDate } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { clinicalSmsService } from '../services/smsService';
import { ViewportModalPortal } from './ViewportModalPortal';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { actionFeedback } from '../utils/actionFeedback';
import { copyTextSafely } from '../utils/clipboard';

const PO_HISTORY_STORAGE_KEY = 'minadental_purchase_orders_v1';

const DEFAULT_SUPPLIER_MOBILE: Record<string, string> = {
  'sup-dentkala': '09128899220',
  'sup-pishgaman': '09122265410',
  'sup-caldent': '09126640189',
  'sup-kavosh': '09124421080'
};

interface SupplierPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onRestockReceived: (items: { itemId: string; quantityAdded: number }[]) => void;
}

export const SupplierPurchaseOrderModal: React.FC<SupplierPurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onRestockReceived
}) => {
  const { impactLight, impactHeavy, success, selection } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('sup-dentkala');
  const [supplierMobile, setSupplierMobile] = useState<string>(DEFAULT_SUPPLIER_MOBILE['sup-dentkala']);
  const [purchaseOrder, setPurchaseOrder] = useState<SupplierPurchaseOrder>(() => 
    inventoryConsumptionService.generateAutoPurchaseOrder(inventory, 'sup-dentkala')
  );
  const [poHistory, setPoHistory] = useState<SupplierPurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem(PO_HISTORY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualItemId, setManualItemId] = useState<string>('');

  // Sync purchase order whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setPurchaseOrder(inventoryConsumptionService.generateAutoPurchaseOrder(inventory, selectedSupplierId));
      setSupplierMobile(DEFAULT_SUPPLIER_MOBILE[selectedSupplierId] || '09128899220');
      setConfirmReceive(false);
    }
  }, [isOpen, selectedSupplierId, inventory]);

  useEffect(() => {
    try {
      localStorage.setItem(PO_HISTORY_STORAGE_KEY, JSON.stringify(poHistory.slice(0, 20)));
    } catch {}
  }, [poHistory]);

  // Sync purchase order when modal opens or supplier changes
  const handleSelectSupplier = (supplierId: string) => {
    selection();
    setSelectedSupplierId(supplierId);
    setSupplierMobile(DEFAULT_SUPPLIER_MOBILE[supplierId] || '09128899220');
    const updated = inventoryConsumptionService.generateAutoPurchaseOrder(inventory, supplierId);
    setPurchaseOrder(updated);
    setConfirmReceive(false);
  };

  if (!isOpen) return null;

  const currentSupplier: DentalSupplier = DENTAL_SUPPLIERS.find(s => s.id === selectedSupplierId) || DENTAL_SUPPLIERS[0];

  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    impactLight();
    const qty = Math.max(1, newQty);
    setPurchaseOrder(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.inventoryItemId === itemId) {
          return {
            ...item,
            quantity: qty,
            totalPrice: qty * item.unitPrice
          };
        }
        return item;
      });
      const newTotal = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
      return {
        ...prev,
        items: updatedItems,
        totalAmount: newTotal
      };
    });
  };

  const handleRemoveItem = (itemId: string) => {
    impactLight();
    setPurchaseOrder(prev => {
      const updatedItems = prev.items.filter(item => item.inventoryItemId !== itemId);
      const newTotal = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
      return {
        ...prev,
        items: updatedItems,
        totalAmount: newTotal
      };
    });
  };

  const addableInventoryItems = inventory.filter(
    (inv) => !purchaseOrder.items.some((poItem) => poItem.inventoryItemId === inv.id)
  );

  const handleAddManualItem = () => {
    const targetId = manualItemId || addableInventoryItems[0]?.id;
    const inv = inventory.find((i) => i.id === targetId);
    if (!inv) return;
    impactLight();
    const defaultQty = Math.max(5, inv.minAlert || 5);
    const unitPrice = inv.pricePerUnit || 500000;
    setPurchaseOrder((prev) => {
      const updatedItems = [
        ...prev.items,
        {
          inventoryItemId: inv.id,
          itemName: inv.name,
          quantity: defaultQty,
          unit: inv.unit,
          unitPrice,
          totalPrice: defaultQty * unitPrice
        }
      ];
      return {
        ...prev,
        items: updatedItems,
        totalAmount: updatedItems.reduce((sum, i) => sum + i.totalPrice, 0)
      };
    });
    setManualItemId('');
  };

  const handleCopyOrderSummary = () => {
    impactLight();
    const lines = [
      `سفارش خرید کلینیک دندانپزشکی مینادنتال (${purchaseOrder.orderNumber})`,
      `تأمین‌کننده: ${currentSupplier.name}`,
      ...purchaseOrder.items.map(
        (it, i) => `${toPersianDigits(i + 1)}. ${it.itemName} — ${toPersianDigits(it.quantity)} ${it.unit} (${formatToman(it.totalPrice)})`
      ),
      `جمع برآورد: ${formatToman(purchaseOrder.totalAmount)}`,
      purchaseOrder.notes ? `یادداشت: ${purchaseOrder.notes}` : ''
    ].filter(Boolean);
    void copyTextSafely(lines.join('\n'));
    success();
    setStatusMessage('متن کامل پیش‌فاکتور جهت ارسال در واتساپ کپی شد ✓');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSendOrderToSupplier = async () => {
    setIsSubmitting(true);
    impactLight();

    const targetMobile = supplierMobile.trim() || DEFAULT_SUPPLIER_MOBILE[currentSupplier.id] || '09128899220';
    let refId = '';
    try {
      const smsRes = await clinicalSmsService.sendPatternSms(
        targetMobile,
        currentSupplier.contactPerson || currentSupplier.name,
        'supplier_order',
        {
          clinicName: 'مینادنتال',
          manager: 'دکتر مهدی امیری',
          orderNumber: purchaseOrder.orderNumber,
          itemCount: toPersianDigits(purchaseOrder.items.length),
          totalAmount: toPersianDigits(purchaseOrder.totalAmount.toLocaleString('en-US')),
          supplier: currentSupplier.name
        }
      );
      refId = smsRes.refId;
    } catch {
      // Non-blocking
    }

    const submittedOrder: SupplierPurchaseOrder = { ...purchaseOrder, status: 'submitted', date: getCurrentPersianDate() };
    setPurchaseOrder(submittedOrder);
    setPoHistory(prev => [submittedOrder, ...prev.filter(o => o.orderNumber !== submittedOrder.orderNumber)]);
    actionFeedback.recordSuccess({
      title: `ارسال سفارش خرید ${submittedOrder.orderNumber}`,
      subtitle: `${currentSupplier.name} (${toPersianDigits(submittedOrder.items.length)} ردیف کالا)`,
      diffAfter: formatToman(submittedOrder.totalAmount),
      badgeText: refId ? `✓ ارسال پیامکی (${refId})` : '✓ ثبت سفارش خرید'
    });
    setIsSubmitting(false);
    success();
    setStatusMessage(`پیش‌فاکتور ${submittedOrder.orderNumber} با موفقیت به ${currentSupplier.name} (${toPersianDigits(targetMobile)}) ارسال و در سوابق ثبت شد.`);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleReceiveStockIntoClinic = () => {
    if (!confirmReceive) {
      impactHeavy();
      setConfirmReceive(true);
      return;
    }
    success();
    const itemsToAdd = purchaseOrder.items.map(i => ({
      itemId: i.inventoryItemId,
      quantityAdded: i.quantity
    }));

    onRestockReceived(itemsToAdd);
    const receivedOrder: SupplierPurchaseOrder = { ...purchaseOrder, status: 'received', date: getCurrentPersianDate() };
    setPurchaseOrder(receivedOrder);
    setPoHistory(prev => [receivedOrder, ...prev.filter(o => o.orderNumber !== receivedOrder.orderNumber)]);
    setConfirmReceive(false);
    actionFeedback.recordSuccess({
      title: `تحویل محموله ${receivedOrder.orderNumber} به انبار`,
      subtitle: `${currentSupplier.name} · ${toPersianDigits(itemsToAdd.length)} قلم کالا`,
      diffAfter: 'شارژ کامل موجودی قفسه‌ها ✓'
    });
    setStatusMessage(`تعداد ${toPersianDigits(itemsToAdd.length)} قلم کالا به موجودی انبار کلینیک اضافه شد.`);
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1800);
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="پیش‌فاکتور خرید تجهیزات و مواد دندانپزشکی"
        className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
        dir="rtl"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-none sm:rounded-[32px] w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] flex flex-col shadow-2xl border-0 sm:border border-slate-100 overflow-hidden text-right"
        >
          {/* Fixed Header with Q-Bank Emerald-Cyan Aesthetic */}
          <div className="px-4 pt-3 pb-3.5 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shrink-0 sticky top-0 z-20">
            <div className="w-10 h-1 rounded-full bg-white/35 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm sm:text-base">پیش‌فاکتور خرید تجهیزات و مواد دندانپزشکی</h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
                      {purchaseOrder.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-white/80">تأمین هوشمند ذخیره انبار و سفارش به شرکت‌های پخش معتبر</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose}
                aria-label="بستن پنجره سفارش خرید"
                className="min-w-[38px] min-h-[38px] rounded-[12px] bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status Toast */}
          {statusMessage && (
            <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto overscroll-contain space-y-4 text-slate-800">
          
          {/* Supplier Selector Chips */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">انتخاب شرکت پخش / تأمین‌کننده:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DENTAL_SUPPLIERS.map(sup => {
                const isSelected = selectedSupplierId === sup.id;
                return (
                  <div
                    key={sup.id}
                    onClick={() => handleSelectSupplier(sup.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-800">{sup.name}</span>
                      <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{sup.specialty}</p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-600">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        {sup.phone}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700 font-bold">
                        <Clock className="w-2.5 h-2.5" />
                        تحویل {toPersianDigits(sup.deliveryTimeDays)} روزه
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supplier Info & Dispatch Mobile Card */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-start gap-2.5">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <span className="font-black text-slate-800">نشانی انبار پخش مرکزی:</span>
                <p className="text-slate-600 text-[11px]">{currentSupplier.address}</p>
                <p className="text-[10px] text-slate-500">مسئول فروش: {currentSupplier.contactPerson}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
              <label htmlFor="supplier-sms-mobile" className="text-[10.5px] font-bold text-slate-700">موبایل نماینده پخش (برای ارسال پیش‌فاکتور پیامکی):</label>
              <input
                id="supplier-sms-mobile"
                aria-label="موبایل نماینده پخش"
                type="tel"
                dir="ltr"
                value={supplierMobile}
                onChange={(e) => setSupplierMobile(e.target.value)}
                className="flex-1 min-w-[140px] bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Order Items List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-700">
                اقلام نیازمند تأمین ({toPersianDigits(purchaseOrder.items.length)} ردیف):
              </span>
              <span className="text-[10px] text-slate-400 font-mono">تاریخ صدور: {toPersianDigits(getCurrentPersianDate())}</span>
            </div>

            {/* Manual Inventory Item Adder (for proactive restocking before low-stock threshold) */}
            {addableInventoryItems.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <select
                  aria-label="افزودن کالای دستی از انبار"
                  value={manualItemId || addableInventoryItems[0]?.id || ''}
                  onChange={(e) => setManualItemId(e.target.value)}
                  className="flex-1 min-w-0 bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {addableInventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} (موجودی: {toPersianDigits(inv.stock)} {inv.unit})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن کالا</span>
                </button>
              </div>
            )}

            {purchaseOrder.items.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                هیچ کالایی در لیست سفارش نیست. می‌توانید از کادر بالا کالای مورد نظر را به‌صورت دستی اضافه کنید.
              </div>
            ) : (
              <div className="space-y-2">
                {purchaseOrder.items.map((item) => (
                  <div 
                    key={item.inventoryItemId}
                    className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-xs text-slate-900 truncate">{item.itemName}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>فی: {formatToman(item.unitPrice)}</span>
                        <span>·</span>
                        <span className="font-bold text-emerald-700">جمع: {formatToman(item.totalPrice)}</span>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(item.inventoryItemId, item.quantity - 1)}
                          aria-label="کاهش تعداد سفارش"
                          className="min-w-[38px] min-h-[38px] rounded-[10px] bg-white hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-black text-xs min-w-[32px] text-center tabular-nums">
                          {toPersianDigits(item.quantity)} {item.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(item.inventoryItemId, item.quantity + 1)}
                          aria-label="افزایش تعداد سفارش"
                          className="min-w-[38px] min-h-[38px] rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.inventoryItemId)}
                        aria-label="حذف ردیف سفارش"
                        className="min-w-[38px] min-h-[38px] rounded-[12px] text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="حذف ردیف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total Summary Box */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
            <span className="font-black text-xs text-emerald-900">مجموع برآورد ارزش خرید:</span>
            <span className="font-mono font-black text-base text-emerald-800">
              {formatToman(purchaseOrder.totalAmount)}
            </span>
          </div>

          {/* Editable Notes */}
          <div className="text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
            <label htmlFor="po-order-notes" className="font-bold text-slate-700 block">یادداشت سفارش (تحویل، تاریخ انقضا، برند):</label>
            <input
              id="po-order-notes"
              aria-label="یادداشت سفارش خرید"
              type="text"
              value={purchaseOrder.notes || ''}
              onChange={(e) => setPurchaseOrder((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="مثال: ارسال با تاریخ انقضای بالای ۱۸ ماه..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Persisted PO History */}
          {poHistory.length > 0 && (
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700">
                <History className="w-3.5 h-3.5 text-emerald-700" />
                <span>سوابق اخیر پیش‌فاکتورهای ارسال و تحویل شده ({toPersianDigits(poHistory.length)})</span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {poHistory.slice(0, 4).map(po => (
                  <div key={po.orderNumber} className="flex items-center justify-between text-[10.5px] bg-white px-2.5 py-1.5 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-800 truncate">{po.orderNumber} · {po.supplierName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-emerald-800 font-bold">{formatToman(po.totalAmount)}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black ${
                        po.status === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {po.status === 'received' ? 'تحویل انبار ✓' : 'ارسال‌شده'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* Fixed Footer Actions */}
          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 sticky bottom-0 z-20">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => window.print?.()}
                className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>چاپ</span>
              </button>
              <button
                type="button"
                onClick={handleCopyOrderSummary}
                disabled={purchaseOrder.items.length === 0}
                className="py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
              >
                <span>کپی واتساپ</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {purchaseOrder.status === 'submitted' ? (
                <div className="flex items-center gap-1.5">
                  {confirmReceive && (
                    <button
                      type="button"
                      onClick={() => setConfirmReceive(false)}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      انصراف
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReceiveStockIntoClinic}
                    className={`py-2.5 px-4 rounded-xl text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
                      confirmReceive ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{confirmReceive ? 'تایید ورود کالا و شارژ انبار ✓' : 'ثبت ورود محموله به انبار کلینیک'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOrderToSupplier}
                  disabled={isSubmitting || purchaseOrder.items.length === 0}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال سفارش خرید به شرکت'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
