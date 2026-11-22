import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Flashlight, RefreshCw, CheckCircle2,
  Plus, Minus, QrCode, Check, FileUp, Barcode, Video, CameraOff
} from 'lucide-react';
import { InventoryItem } from '../types/dental';
import { toPersianDigits, toEnglishDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import { hardwareBridgeService } from '../services/hardwareBridgeService';
import {
  decodeBarcodeFromVideoFrame,
  decodeBarcodeFromFile,
  getActiveScannerEngineLabel,
  parseDentalProductBarcodePayload,
  ParsedProductBarcodeData
} from '../utils/qrBarcodeScanner';
import { ViewportModalPortal } from './ViewportModalPortal';

interface InventoryQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onUpdateStock: (itemId: string, newStock: number) => void;
  onRegisterScannedProduct?: (item: InventoryItem) => void;
  onShowToast: (message: string) => void;
}

export const InventoryQrScannerModal: React.FC<InventoryQrScannerModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onUpdateStock,
  onRegisterScannedProduct,
  onShowToast
}) => {
  const { selection, impactMedium, success, warning } = useHapticFeedback();
  useEscapeKey(isOpen, onClose);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const isDecodingFrameRef = useRef<boolean>(false);
  const scannerActiveRef = useRef<boolean>(true);
  const lastMissToastRef = useRef<number>(0);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraErrorTitle, setCameraErrorTitle] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isDecodingLabelFile, setIsDecodingLabelFile] = useState(false);

  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const [adjustedStock, setAdjustedStock] = useState<number>(0);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [scannerActive, setScannerActive] = useState<boolean>(true);

  const [extractedProduct, setExtractedProduct] = useState<ParsedProductBarcodeData | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftBrand, setDraftBrand] = useState('');
  const [draftCategory, setDraftCategory] = useState('مصرفی کلینیک');
  const [draftUnit, setDraftUnit] = useState('بسته');
  const [draftExpiry, setDraftExpiry] = useState('');
  const [draftQty, setDraftQty] = useState(1);
  const [draftPrice, setDraftPrice] = useState(0);

  useEffect(() => {
    scannerActiveRef.current = scannerActive;
  }, [scannerActive]);

  const playBeepSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  };

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
    setIsTorchOn(false);
  }, []);

  const handleDetectCode = useCallback(
    (rawCode: string) => {
      if (!rawCode || !scannerActiveRef.current) return;
      const clean = toEnglishDigits(rawCode).trim().toLowerCase();
      const cleanNoPrefix = clean.replace(/^mina-inv-/, '');

      const matched = inventory.find(item => {
        const qrMatch = item.qrCode && toEnglishDigits(item.qrCode).toLowerCase() === clean;
        const barMatch = item.barcode && toEnglishDigits(item.barcode).toLowerCase() === clean;
        const idMatch = item.id.toLowerCase() === clean || item.id.toLowerCase() === cleanNoPrefix;
        const nameMatch =
          clean.length >= 3 &&
          (item.name.toLowerCase().includes(clean) || clean.includes(item.name.toLowerCase()));
        return qrMatch || barMatch || idMatch || nameMatch;
      });

      if (matched) {
        playBeepSound();
        success();
        setLastScannedCode(rawCode);
        setExtractedProduct(null);
        setScannedItem(matched);
        setAdjustedStock(matched.stock);
        setScannerActive(false);
        scannerActiveRef.current = false;
        return;
      }

      const parsedProduct = parseDentalProductBarcodePayload(rawCode);
      if (parsedProduct) {
        playBeepSound();
        success();
        setLastScannedCode(rawCode);
        setScannedItem(null);
        setExtractedProduct(parsedProduct);
        setDraftName(parsedProduct.name);
        setDraftBrand(parsedProduct.brand);
        setDraftCategory(parsedProduct.category);
        setDraftUnit(parsedProduct.unit);
        setDraftExpiry(parsedProduct.expiryDate);
        setDraftQty(parsedProduct.suggestedQuantity || 1);
        setDraftPrice(parsedProduct.pricePerUnit || 0);
        setScannerActive(false);
        scannerActiveRef.current = false;
        return;
      }

      const now = Date.now();
      if (now - lastMissToastRef.current > 2000) {
        lastMissToastRef.current = now;
        warning();
        onShowToast(`کد نامعتبر: ${rawCode}`);
      }
    },
    [inventory, onShowToast, success, warning]
  );

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setHasCameraPermission(null);
    setCameraErrorTitle('');

    const result = await hardwareBridgeService.requestSafeCameraStream({ facingMode: mode });
    const diag = result.diagnostics;
    if (!result.ok || !result.stream) {
      setHasCameraPermission(false);
      setCameraErrorTitle(
        diag.reason === 'permission_denied'
          ? 'مجوز دوربین رد شد'
          : diag.reason === 'no_camera'
          ? 'دوربین یافت نشد'
          : diag.reason === 'in_use'
          ? 'دوربین اشغال است'
          : 'دوربین در دسترس نیست'
      );
      return;
    }

    streamRef.current = result.stream;
    if (videoRef.current) {
      videoRef.current.srcObject = result.stream;
      videoRef.current.play().catch(() => {});
    }

    setHasCameraPermission(true);

    const track = result.stream.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
        setHasTorch(Boolean(capabilities && capabilities.torch));
      } catch {
        setHasTorch(false);
      }
    }
  }, []);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
        selection();
      } catch {}
    }
  };

  const toggleCameraFacing = () => {
    selection();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Real single-frame capture decode on tap (zero fake fallback)
  const triggerLiveProductScan = useCallback(async () => {
    selection();
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      warning();
      onShowToast('دوربین آماده نیست');
      return;
    }
    scannerActiveRef.current = true;
    setScannerActive(true);
    try {
      const liveCode = await decodeBarcodeFromVideoFrame(videoRef.current, canvasRef.current);
      if (liveCode) {
        handleDetectCode(liveCode);
      } else {
        warning();
        onShowToast('بارکد در کادر شناسایی نشد');
      }
    } catch {
      warning();
      onShowToast('خطا در خواندن فریم');
    }
  }, [handleDetectCode, onShowToast, selection, warning]);

  // Real image file barcode decode (zero fake fallback)
  const handleBarcodeLabelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsDecodingLabelFile(true);
    try {
      const code = await decodeBarcodeFromFile(file);
      scannerActiveRef.current = true;
      setScannerActive(true);
      if (code) {
        handleDetectCode(code);
      } else {
        warning();
        onShowToast('بارکد در تصویر یافت نشد');
      }
    } finally {
      setIsDecodingLabelFile(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedItem(null);
      setExtractedProduct(null);
      setManualCode('');
      scannerActiveRef.current = true;
      setScannerActive(true);
      return;
    }

    let cancelled = false;
    startCamera(facingMode);

    const unsubscribeHw = hardwareBridgeService.onCameraPermissionChange(() => {
      if (!cancelled) startCamera(facingMode);
    });

    // Real continuous live camera decode loop (160ms)
    scanIntervalRef.current = window.setInterval(async () => {
      if (cancelled || !scannerActiveRef.current || isDecodingFrameRef.current) return;
      if (!videoRef.current || !canvasRef.current) return;
      if (videoRef.current.readyState < 2) return;

      isDecodingFrameRef.current = true;
      try {
        const decoded = await decodeBarcodeFromVideoFrame(videoRef.current, canvasRef.current);
        if (!cancelled && decoded) {
          handleDetectCode(decoded);
        }
      } finally {
        isDecodingFrameRef.current = false;
      }
    }, 160);

    return () => {
      cancelled = true;
      unsubscribeHw();
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera, handleDetectCode]);

  if (!isOpen) return null;

  const handleSaveStock = (delta?: number) => {
    if (!scannedItem) return;
    const finalStock = delta !== undefined ? Math.max(0, scannedItem.stock + delta) : Math.max(0, adjustedStock);

    onUpdateStock(scannedItem.id, finalStock);
    impactMedium();
    onShowToast(`موجودی ${scannedItem.name}: ${toPersianDigits(finalStock)} ${scannedItem.unit}`);

    setScannedItem(null);
    scannerActiveRef.current = true;
    setScannerActive(true);
  };

  const handleRegisterExtractedProduct = () => {
    if (!extractedProduct) return;
    if (!onRegisterScannedProduct) {
      onShowToast(draftName || extractedProduct.name);
      return;
    }

    const newItem: InventoryItem = {
      id: `inv-scan-${Date.now()}`,
      name: (draftName || extractedProduct.name).trim(),
      category: draftCategory.trim() || extractedProduct.category,
      stock: Math.max(1, draftQty || 1),
      unit: draftUnit.trim() || extractedProduct.unit || 'بسته',
      minAlert: Math.max(1, Math.min(3, draftQty || 2)),
      expiryDate: draftExpiry.trim() || extractedProduct.expiryDate,
      pricePerUnit: Math.max(0, Number(draftPrice) || 0),
      barcode: extractedProduct.barcode,
      qrCode: extractedProduct.qrCode,
      location: draftBrand
        ? `${draftBrand}${extractedProduct.lotNumber ? ` · LOT: ${extractedProduct.lotNumber}` : ''}`
        : 'انبار مرکزی'
    };

    onRegisterScannedProduct(newItem);
    impactMedium();
    success();
    onShowToast(`«${newItem.name}» در انبار ثبت شد`);
    setExtractedProduct(null);
    scannerActiveRef.current = true;
    setScannerActive(true);
  };

  const handleScanNext = () => {
    selection();
    setScannedItem(null);
    setExtractedProduct(null);
    scannerActiveRef.current = true;
    setScannerActive(true);
  };

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="اسکنر بارکد انبار"
        className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 pt-6 flex items-center justify-between text-white z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">اسکنر بارکد انبار</h3>
              <span className="text-[10px] text-emerald-300 font-bold block truncate" dir="ltr">
                {getActiveScannerEngineLabel()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label="فلاش"
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer ${
                  isTorchOn ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/40' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleCameraFacing}
              aria-label="تغییر دوربین"
              className="min-w-[40px] min-h-[40px] rounded-[12px] bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              aria-label="بستن"
              className="min-w-[40px] min-h-[40px] rounded-[12px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Viewfinder / Scanned Item / Extracted Product */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-y-auto">
          {scannedItem ? (
            <div className="w-full max-w-sm bg-gradient-to-b from-white via-slate-50 to-emerald-50/40 rounded-[28px] p-5 border border-emerald-300/80 shadow-2xl space-y-4 animate-in zoom-in-95 text-slate-900">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold inline-block mb-1">
                    {scannedItem.category}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 leading-snug">{scannedItem.name}</h4>
                  {lastScannedCode && (
                    <span className="text-[10px] font-mono text-emerald-700 block mt-0.5" dir="ltr">
                      {lastScannedCode}
                    </span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-100/80 p-2.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[9px] text-slate-500 block">موجودی</span>
                  <span className="font-mono font-black text-sm text-slate-800">
                    {toPersianDigits(scannedItem.stock)} {scannedItem.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block">هشدار</span>
                  <span className="font-mono font-black text-xs text-amber-600">
                    {toPersianDigits(scannedItem.minAlert)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block">انقضا</span>
                  <span className="font-mono font-black text-[11px] text-slate-700">
                    {toPersianDigits(scannedItem.expiryDate)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      impactMedium();
                      setAdjustedStock(prev => Math.max(0, prev - 1));
                    }}
                    aria-label="کاهش ۱"
                    className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-5 h-5 stroke-[2.5]" />
                  </button>

                  <div className="px-4 py-2 rounded-2xl bg-white border border-slate-200 min-w-[90px] text-center">
                    <span className="font-mono font-black text-lg text-emerald-700">
                      {toPersianDigits(adjustedStock)}
                    </span>
                    <span className="text-[10px] text-slate-400 block -mt-1">{scannedItem.unit}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      impactMedium();
                      setAdjustedStock(prev => prev + 1);
                    }}
                    aria-label="افزایش ۱"
                    className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      impactMedium();
                      setAdjustedStock(prev => Math.max(0, prev - 1));
                    }}
                    className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                  >
                    مصرف (-۱)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      impactMedium();
                      setAdjustedStock(prev => prev + 5);
                    }}
                    className="py-1.5 px-2 rounded-xl bg-emerald-100/70 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] cursor-pointer"
                  >
                    بسته (+۵)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      impactMedium();
                      setAdjustedStock(prev => prev + 10);
                    }}
                    className="py-1.5 px-2 rounded-xl bg-emerald-100/70 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] cursor-pointer"
                  >
                    کارتن (+۱۰)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScanNext}
                  className="w-1/3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveStock()}
                  className="w-2/3 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>ذخیره موجودی</span>
                </button>
              </div>
            </div>
          ) : extractedProduct ? (
            <div className="w-full max-w-sm bg-gradient-to-b from-white via-slate-50 to-sky-50/60 rounded-[28px] p-4 border-2 border-sky-300 shadow-2xl space-y-3 animate-in zoom-in-95 text-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 text-[10px] font-black inline-block mb-1">
                    {extractedProduct.sourceStandard}
                  </span>
                  <h4 className="text-xs font-black text-slate-900">کالای جدید</h4>
                  <span className="text-[10px] font-mono text-sky-800 block mt-0.5 truncate" dir="ltr">
                    {extractedProduct.barcode}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <Barcode className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-black text-slate-600 block mb-0.5">نام کالا</label>
                  <input
                    type="text"
                    aria-label="نام کالا"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-0.5">برند</label>
                    <input
                      type="text"
                      aria-label="برند"
                      value={draftBrand}
                      onChange={(e) => setDraftBrand(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-0.5">دسته‌بندی</label>
                    <input
                      type="text"
                      aria-label="دسته‌بندی"
                      value={draftCategory}
                      onChange={(e) => setDraftCategory(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-0.5">تعداد</label>
                    <input
                      type="number"
                      min={1}
                      aria-label="تعداد"
                      value={draftQty}
                      onChange={(e) => setDraftQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl bg-white border border-slate-200 px-2 py-1.5 text-xs font-mono font-black text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-0.5">واحد</label>
                    <input
                      type="text"
                      aria-label="واحد"
                      value={draftUnit}
                      onChange={(e) => setDraftUnit(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-0.5">انقضا</label>
                    <input
                      type="text"
                      aria-label="تاریخ انقضا"
                      value={draftExpiry}
                      onChange={(e) => setDraftExpiry(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-2 py-1.5 text-[11px] font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 bg-sky-50 border border-sky-200 rounded-xl px-2.5 py-1.5 text-[10.5px]">
                  <span className="font-bold text-sky-900 truncate">
                    {extractedProduct.lotNumber ? `LOT: ${extractedProduct.lotNumber}` : extractedProduct.originCountry || 'کد تجاری'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <label htmlFor="qr-draft-price" className="text-[10px] font-bold text-sky-900">بهای واحد:</label>
                    <input
                      id="qr-draft-price"
                      type="number"
                      min={0}
                      step={50000}
                      aria-label="بهای واحد محصول استخراج‌شده"
                      value={draftPrice}
                      onChange={(e) => setDraftPrice(Math.max(0, Number(e.target.value) || 0))}
                      className="w-24 rounded-lg bg-white border border-sky-200 px-1.5 py-0.5 text-[11px] font-mono font-black text-sky-900 text-left"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScanNext}
                  className="w-1/3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  اسکن بعدی
                </button>
                <button
                  type="button"
                  onClick={handleRegisterExtractedProduct}
                  className="w-2/3 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>ثبت در انبار</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-3 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-[10.5px]">
                <span
                  className={`px-2.5 py-1 rounded-xl border font-bold flex items-center gap-1.5 ${
                    hasCameraPermission === true
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                      : hasCameraPermission === false
                      ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                      : 'bg-white/10 border-white/15 text-slate-300'
                  }`}
                >
                  <Video className="w-3 h-3 shrink-0" />
                  <span>
                    {hasCameraPermission === true
                      ? 'دوربین فعال'
                      : hasCameraPermission === false
                      ? cameraErrorTitle || 'دوربین غیرفعال'
                      : 'در حال اتصال...'}
                  </span>
                </span>
              </div>

              <div className="relative w-full aspect-square rounded-[36px] overflow-hidden border-2 border-emerald-400/80 shadow-[0_0_50px_rgba(16,185,129,0.3)] bg-slate-900 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute inset-5 pointer-events-none z-20">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                </div>

                {hasCameraPermission === true && (
                  <div className="absolute inset-x-7 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_#34d399] animate-pulse pointer-events-none z-20" />
                )}

                {hasCameraPermission === false && (
                  <div className="relative z-10 w-full h-full bg-slate-950/92 flex flex-col items-center justify-center gap-3 p-5 text-center text-white">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-slate-300">
                      <CameraOff className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-white">
                      {cameraErrorTitle || 'دوربین در دسترس نیست'}
                    </span>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="min-h-[38px] px-4 py-1.5 rounded-[12px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تلاش مجدد</span>
                    </button>
                  </div>
                )}

                {hasCameraPermission === true && (
                  <button
                    type="button"
                    onClick={triggerLiveProductScan}
                    className="absolute bottom-3 inset-x-8 z-30 py-2 px-3 rounded-2xl bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-md border border-white/20 text-[11px] text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Barcode className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>اسکن</span>
                  </button>
                )}
              </div>

              <label className="w-full py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                <FileUp className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isDecodingLabelFile ? 'در حال اسکن...' : 'انتخاب تصویر'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBarcodeLabelFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer: USB Laser Scanner / Manual Code Input */}
        <div className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-white/10 z-20">
          <div className="flex items-center gap-2 max-w-sm mx-auto">
            <input
              ref={manualInputRef}
              type="text"
              aria-label="ورود کد بارکد یا QR"
              placeholder="کد بارکد یا QR"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) {
                  scannerActiveRef.current = true;
                  setScannerActive(true);
                  handleDetectCode(manualCode.trim());
                  setManualCode('');
                }
              }}
              className="flex-1 bg-white/10 border border-white/15 rounded-2xl px-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (manualCode.trim()) {
                  scannerActiveRef.current = true;
                  setScannerActive(true);
                  handleDetectCode(manualCode.trim());
                  setManualCode('');
                }
              }}
              className="py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs cursor-pointer"
            >
              ثبت
            </button>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
