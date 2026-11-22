import React, { useState } from 'react';
import { X, Printer, QrCode, Copy, MapPin } from 'lucide-react';
import { InventoryItem } from '../types/dental';
import { toPersianDigits, formatToman } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { copyTextSafely } from '../utils/clipboard';
import { RealQrCode } from './RealQrCode';
import { ViewportModalPortal } from './ViewportModalPortal';

interface InventoryBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onShowToast: (msg: string) => void;
}

function buildDeterministicBars(code: string): number[] {
  const source = code || '626012345000';
  const bars: number[] = [2, 1, 2];
  for (let i = 0; i < Math.min(22, source.length * 2); i++) {
    const ch = source.charCodeAt(i % source.length);
    const width = ((ch + i * 7) % 3) + 1;
    bars.push(width);
  }
  bars.push(2, 1, 2);
  return bars;
}

export const InventoryBarcodeModal: React.FC<InventoryBarcodeModalProps> = ({
  isOpen,
  onClose,
  item,
  onShowToast
}) => {
  const { impactLight, success } = useHapticFeedback();
  const [labelCopies, setLabelCopies] = useState<number>(1);
  useEscapeKey(isOpen, onClose);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    impactLight();
    onShowToast(`آماده‌سازی چاپ ${toPersianDigits(labelCopies)} عدد برچسب برای «${item.name}»...`);
    window.print?.();
  };

  const handleCopyCode = (code: string) => {
    void copyTextSafely(code);
    success();
    onShowToast(`کد ${code} در کلیپ‌بورد کپی شد.`);
  };

  const barcodeValue = item.barcode || '626012345000';
  const qrValue = item.qrCode || `MINA-INV-${item.id}`;
  const barWidths = buildDeterministicBars(barcodeValue);

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="لیبل بارکد و QR کالا"
        onClick={onClose}
        className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        dir="rtl"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-white rounded-[28px] border border-slate-200 shadow-2xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95 text-right"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">لیبل بارکد و QR کالا</h3>
                <span className="text-[10px] text-slate-400">چاپ برچسب قفسه و انبار مطب</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن پنجره بارکد"
              className="min-w-[38px] min-h-[38px] rounded-[12px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Printable Label Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border-2 border-dashed border-emerald-300 text-center space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold border-b border-slate-100 pb-1.5">
              <span>کلینیک دندانپزشکی مینادنتال</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{item.category}</span>
            </div>

            <h4 className="text-sm font-black text-slate-900">{item.name}</h4>

            {/* Shelf Location, Stock & Unit Price Strip */}
            <div className="flex items-center justify-center gap-2 flex-wrap text-[10px] font-bold text-slate-600">
              {item.location && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span>{item.location}</span>
                </span>
              )}
              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-mono">
                موجودی: {toPersianDigits(item.stock)} {item.unit}
              </span>
              {item.pricePerUnit > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 font-mono">
                  {formatToman(item.pricePerUnit)}
                </span>
              )}
            </div>

            {/* Real Scannable ISO QR Code */}
            <div className="flex items-center justify-center py-1">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs inline-block">
                <RealQrCode
                  value={item.barcode || qrValue}
                  size={120}
                  darkColor="#064e3b"
                  lightColor="#ffffff"
                  className="mx-auto"
                  ariaLabel={`کد QR قابل اسکن ${item.name}`}
                />
              </div>
            </div>

            {/* Deterministic Product-Specific Barcode Strip */}
            <div className="space-y-1">
              <div className="h-9 flex items-center justify-center gap-0.5 px-4" data-testid="inventory-barcode-bars">
                {barWidths.map((w, idx) => (
                  <div
                    key={idx}
                    className="h-full bg-slate-900 rounded-[1px]"
                    style={{ width: `${w * 2}px` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 font-mono text-xs font-black text-slate-700">
                <span>{barcodeValue}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(barcodeValue)}
                  aria-label="کپی بارکد کالا"
                  className="text-slate-400 hover:text-emerald-700 cursor-pointer"
                  title="کپی بارکد"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
              <button
                type="button"
                onClick={() => handleCopyCode(qrValue)}
                className="flex items-center gap-1 hover:text-emerald-700 cursor-pointer"
                title="کپی کد QR"
              >
                <span>کد QR: <code className="font-mono font-bold text-emerald-700">{qrValue}</code></span>
                <Copy className="w-3 h-3 text-slate-400" />
              </button>
              <span>انقضا: <strong className="font-mono text-slate-800">{toPersianDigits(item.expiryDate)}</strong></span>
            </div>
          </div>

          {/* Label Copy Count Selector */}
          <div className="flex items-center justify-between text-[11px] bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-700">تعداد نسخه چاپ لیبل:</span>
            <div className="flex items-center gap-1">
              {[1, 4, 8].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setLabelCopies(cnt)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-black cursor-pointer transition-colors ${
                    labelCopies === cnt
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {toPersianDigits(cnt)} عدد
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-center cursor-pointer"
            >
              بستن
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="w-2/3 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ برچسب لیبل ({toPersianDigits(labelCopies)})</span>
            </button>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
