import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Flashlight, RefreshCw, CheckCircle2,
  Package, Plus, Minus, QrCode,
  Check, FileUp, FlaskConical, User, ShieldCheck, FileCheck2,
  Calendar, FolderOpen, Layers, Link2, Video, Barcode, CameraOff
} from 'lucide-react';
import { InventoryItem, LabOrder, Patient } from '../types/dental';
import { toPersianDigits, formatToman } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useEscapeKey } from '../hooks/useDialogA11y';
import {
  hardwareBridgeService,
  CameraHardwareDevice
} from '../services/hardwareBridgeService';
import {
  decodeBarcodeFromVideoFrame,
  decodeBarcodeFromFile,
  resolveClinicScanPayload,
  getActiveScannerEngineLabel,
  ScannedClinicEntity,
  SayadParsedPayload
} from '../utils/qrBarcodeScanner';
import { ViewportModalPortal } from './ViewportModalPortal';

export type UniversalScannerScope = 'all' | 'inventory' | 'lab' | 'patient' | 'sterilization' | 'sayad_check';

interface UniversalClinicScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope?: UniversalScannerScope;
  patients: Patient[];
  inventory: InventoryItem[];
  onUpdateInventoryStock?: (itemId: string, newStock: number) => void;
  onRegisterScannedProduct?: (item: InventoryItem) => void;
  onUpdateLabOrderStatus?: (orderId: string, status: LabOrder['status']) => void;
  onScheduleLabDelivery?: (patient: Patient, order: LabOrder) => void;
  onOpenPatientFile?: (patient: Patient, tab?: 'treatments' | 'financial' | 'lab' | 'implant' | 'xrays') => void;
  onOpenPalmerChart?: (patient: Patient) => void;
  onLinkSterilizedPack?: (cycleCode: string, patientId: string) => void;
  onSayadCheckScanned?: (payload: SayadParsedPayload) => void;
  onShowToast?: (message: string) => void;
}

export const UniversalClinicScannerModal: React.FC<UniversalClinicScannerModalProps> = ({
  isOpen,
  onClose,
  scope = 'all',
  patients,
  inventory,
  onUpdateInventoryStock,
  onRegisterScannedProduct,
  onUpdateLabOrderStatus,
  onScheduleLabDelivery,
  onOpenPatientFile,
  onOpenPalmerChart,
  onLinkSterilizedPack,
  onSayadCheckScanned,
  onShowToast
}) => {
  const { selection, impactMedium, impactHeavy, success, warning } = useHapticFeedback();
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
  const [cameraDevices, setCameraDevices] = useState<CameraHardwareDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);

  const [scannedEntity, setScannedEntity] = useState<ScannedClinicEntity | null>(null);
  const [adjustedStock, setAdjustedStock] = useState<number>(0);
  const [productDraftName, setProductDraftName] = useState<string>('');
  const [productDraftQty, setProductDraftQty] = useState<number>(1);
  const [sterileTargetPatientId, setSterileTargetPatientId] = useState<string>(patients[0]?.id || '');
  const [manualCode, setManualCode] = useState<string>('');
  const [localAlert, setLocalAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!sterileTargetPatientId && patients[0]?.id) {
      setSterileTargetPatientId(patients[0].id);
    }
  }, [patients, sterileTargetPatientId]);

  const showFeedback = useCallback(
    (msg: string) => {
      setLocalAlert(msg);
      onShowToast?.(msg);
      setTimeout(() => setLocalAlert(null), 2800);
    },
    [onShowToast]
  );

  const playBeepSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
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
      streamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
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
      const resolved = resolveClinicScanPayload(rawCode, patients, inventory);

      if (resolved) {
        playBeepSound();
        success();
        scannerActiveRef.current = false;
        setScannedEntity(resolved);
        if (resolved.kind === 'inventory') {
          setAdjustedStock(resolved.item.stock);
        } else if (resolved.kind === 'product_data') {
          setProductDraftName(resolved.product.name);
          setProductDraftQty(resolved.product.suggestedQuantity || 1);
        }
      } else {
        const now = Date.now();
        if (now - lastMissToastRef.current > 2000) {
          lastMissToastRef.current = now;
          warning();
          showFeedback(`کد نامعتبر: ${rawCode}`);
        }
      }
    },
    [inventory, patients, showFeedback, success, warning]
  );

  const startCamera = useCallback(async (mode: 'environment' | 'user', deviceId?: string) => {
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

    const result = await hardwareBridgeService.requestSafeCameraStream({
      facingMode: mode,
      deviceId: deviceId || undefined
    });
    const diag = result.diagnostics;
    if (diag.devices.length > 0) {
      setCameraDevices(diag.devices);
    }

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
        const settings = track.getSettings?.();
        if (settings?.deviceId) {
          setSelectedDeviceId(settings.deviceId);
        }
        const caps = (track.getCapabilities && track.getCapabilities()) as any;
        setHasTorch(Boolean(caps && caps.torch));
      } catch {
        setHasTorch(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedEntity(null);
      setManualCode('');
      setLocalAlert(null);
      scannerActiveRef.current = true;
      return;
    }

    let cancelled = false;
    scannerActiveRef.current = true;
    startCamera(facingMode, selectedDeviceId || undefined);

    const unsubscribeHw = hardwareBridgeService.onCameraPermissionChange(() => {
      if (!cancelled) {
        startCamera(facingMode, selectedDeviceId || undefined);
      }
    });

    // Real continuous frame-by-frame optical barcode/QR scan loop (160ms)
    scanIntervalRef.current = window.setInterval(async () => {
      if (cancelled || !scannerActiveRef.current || isDecodingFrameRef.current) return;
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

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
  }, [isOpen, facingMode, selectedDeviceId, startCamera, stopCamera, handleDetectCode]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !isTorchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setIsTorchOn(next);
      selection();
    } catch {}
  };

  // Real single-frame capture decode on tap (zero fake fallback)
  const triggerLiveFrameScan = useCallback(async () => {
    selection();
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      warning();
      showFeedback('دوربین آماده نیست');
      return;
    }
    scannerActiveRef.current = true;
    try {
      const liveDecoded = await decodeBarcodeFromVideoFrame(videoRef.current, canvasRef.current);
      if (liveDecoded) {
        handleDetectCode(liveDecoded);
      } else {
        warning();
        showFeedback('بارکد در کادر شناسایی نشد');
      }
    } catch {
      warning();
      showFeedback('خطا در خواندن فریم');
    }
  }, [handleDetectCode, selection, showFeedback, warning]);

  // Real image file barcode/QR decode (zero fake fallback)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsDecodingPhoto(true);
    try {
      const code = await decodeBarcodeFromFile(file);
      scannerActiveRef.current = true;
      if (code) {
        handleDetectCode(code);
      } else {
        warning();
        showFeedback('بارکد در تصویر یافت نشد');
      }
    } finally {
      setIsDecodingPhoto(false);
    }
  };

  const resetToScanNext = () => {
    selection();
    setScannedEntity(null);
    scannerActiveRef.current = true;
  };

  const scopeTitle: Record<UniversalScannerScope, string> = {
    all: 'اسکنر بارکد و QR',
    inventory: 'اسکنر انبار',
    lab: 'اسکنر لابراتوار',
    patient: 'اسکنر پرونده',
    sterilization: 'اسکنر استریل',
    sayad_check: 'اسکنر چک صیادی'
  };

  if (!isOpen) return null;

  return (
    <ViewportModalPortal isOpen={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={scopeTitle[scope]}
        className="fixed inset-0 z-[120] bg-slate-950/92 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-150"
        dir="rtl"
      >
        {localAlert && (
          <div className="fixed top-16 inset-x-4 z-50 max-w-sm mx-auto bg-slate-900 border border-violet-400/50 text-white px-3.5 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{localAlert}</span>
          </div>
        )}

        {/* Header */}
        <div className="p-4 pt-5 flex items-center justify-between text-white z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-400/40 text-violet-300 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">{scopeTitle[scope]}</h3>
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
                className={`min-w-[40px] min-h-[40px] rounded-[12px] flex items-center justify-center cursor-pointer ${
                  isTorchOn ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                selection();
                setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
              }}
              aria-label="تغییر دوربین"
              className="min-w-[40px] min-h-[40px] rounded-[12px] bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
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
              className="min-w-[40px] min-h-[40px] rounded-[12px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Viewfinder / Scanned Entity Result */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
          {scannedEntity ? (
            <div className="w-full max-w-sm bg-white rounded-[28px] p-5 border-2 border-violet-300 shadow-2xl space-y-3.5 text-slate-900 animate-in zoom-in-95">
              {/* 1. LAB PACKET RESULT */}
              {scannedEntity.kind === 'lab' && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black">
                        QR-{scannedEntity.order.id.slice(-4).toUpperCase()}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-1">{scannedEntity.order.patientName}</h4>
                      <span className="text-[11px] font-bold text-slate-600 block">
                        {scannedEntity.order.workType} · دندان {scannedEntity.order.toothNumber} · {scannedEntity.order.shade}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-2.5 text-[11px] space-y-1">
                    <div>لابراتوار: <strong className="text-purple-950">{scannedEntity.order.labName}</strong></div>
                    <div>تحویل: <strong className="font-mono">{toPersianDigits(scannedEntity.order.deliveryDate)}</strong></div>
                    <div>هزینه: <strong className="font-mono">{formatToman(scannedEntity.order.cost)}</strong></div>
                  </div>
                  <div className="space-y-2">
                    {onUpdateLabOrderStatus && scannedEntity.order.status !== 'ready_for_clinic' && (
                      <button
                        type="button"
                        onClick={() => {
                          impactHeavy();
                          onUpdateLabOrderStatus(scannedEntity.order.id, 'ready_for_clinic');
                          showFeedback('وصول پاکت ثبت شد');
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ثبت وصول</span>
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {scannedEntity.patient && onScheduleLabDelivery && (
                        <button
                          type="button"
                          onClick={() => {
                            onScheduleLabDelivery(scannedEntity.patient!, scannedEntity.order);
                            onClose();
                          }}
                          className="py-2 rounded-xl bg-purple-600 text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>نوبت تحویل</span>
                        </button>
                      )}
                      {scannedEntity.patient && onOpenPatientFile && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenPatientFile(scannedEntity.patient!, 'lab');
                            onClose();
                          }}
                          className="py-2 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                          <span>پرونده</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 2. PATIENT WALLET QR RESULT */}
              {scannedEntity.kind === 'patient' && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black">
                        پرونده {toPersianDigits(scannedEntity.patient.fileNumber)}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-1">{scannedEntity.patient.fullName}</h4>
                      <span className="text-[11px] font-mono font-bold text-slate-600 block">
                        {toPersianDigits(scannedEntity.patient.phone)}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {onOpenPatientFile && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPatientFile(scannedEntity.patient, 'treatments');
                          onClose();
                        }}
                        className="py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>پرونده</span>
                      </button>
                    )}
                    {onOpenPalmerChart && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPalmerChart(scannedEntity.patient);
                          onClose();
                        }}
                        className="py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-4 h-4" />
                        <span>چارت پالمر</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* 3. STERILIZATION AUTOCLAVE PACK RESULT */}
              {scannedEntity.kind === 'sterilization' && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black">
                        {scannedEntity.cycleCode}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-1">
                        {scannedEntity.deviceName || 'اتوکلاو کلاس B'}
                      </h4>
                      <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                        {scannedEntity.statusText}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>
                  {patients.length > 0 && onLinkSterilizedPack && (
                    <div className="space-y-2 bg-teal-50 p-2.5 rounded-2xl border border-teal-200 text-xs">
                      <label className="text-[10.5px] font-black text-teal-950 block">بیمار:</label>
                      <select
                        aria-label="انتخاب بیمار"
                        value={sterileTargetPatientId}
                        onChange={(e) => setSterileTargetPatientId(e.target.value)}
                        className="w-full bg-white border border-teal-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                      >
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>{p.fullName} ({p.fileNumber})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          success();
                          onLinkSterilizedPack(scannedEntity.cycleCode, sterileTargetPatientId);
                          showFeedback('پک استریل ثبت شد');
                          onClose();
                        }}
                        className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Link2 className="w-4 h-4" />
                        <span>اتصال به پرونده</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* 4. SAYAD CHECK QR RESULT */}
              {scannedEntity.kind === 'sayad_check' && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
                        شناسه صیاد
                      </span>
                      <h4 className="text-sm font-mono font-black text-slate-900 mt-1" dir="ltr">
                        {toPersianDigits(scannedEntity.parsed.sayadId)}
                      </h4>
                      {scannedEntity.parsed.bankName && (
                        <span className="text-[11px] font-bold text-amber-800 block">
                          {scannedEntity.parsed.bankName}
                        </span>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                  </div>
                  {onSayadCheckScanned && (
                    <button
                      type="button"
                      onClick={() => {
                        success();
                        onSayadCheckScanned(scannedEntity.parsed);
                        onClose();
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                    >
                      ثبت در چک صیادی
                    </button>
                  )}
                </>
              )}

              {/* 5. INVENTORY ITEM RESULT */}
              {scannedEntity.kind === 'inventory' && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                        {scannedEntity.item.category}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-1">{scannedEntity.item.name}</h4>
                      <span className="text-[10.5px] font-bold text-slate-500 block mt-0.5">
                        انقضا: {toPersianDigits(scannedEntity.item.expiryDate)}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustedStock(prev => Math.max(0, prev - 1))}
                      aria-label="کاهش ۱"
                      className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="px-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-black text-base text-emerald-700">
                      {toPersianDigits(adjustedStock)} {scannedEntity.item.unit}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjustedStock(prev => prev + 1)}
                      aria-label="افزایش ۱"
                      className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAdjustedStock(prev => Math.max(0, prev - 1))}
                      className="py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                    >
                      مصرف (-۱)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustedStock(prev => prev + 5)}
                      className="py-1.5 rounded-xl bg-emerald-100/80 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] cursor-pointer"
                    >
                      بسته (+۵)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustedStock(prev => prev + 10)}
                      className="py-1.5 rounded-xl bg-emerald-100/80 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] cursor-pointer"
                    >
                      کارتن (+۱۰)
                    </button>
                  </div>
                  {onUpdateInventoryStock && (
                    <button
                      type="button"
                      onClick={() => {
                        impactMedium();
                        onUpdateInventoryStock(scannedEntity.item.id, adjustedStock);
                        showFeedback(`موجودی به ${toPersianDigits(adjustedStock)} تغییر یافت`);
                        resetToScanNext();
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>ثبت موجودی</span>
                    </button>
                  )}
                </>
              )}

              {/* 6. EXTRACTED PRODUCT DATA FROM BARCODE / GS1-128 / QR */}
              {scannedEntity.kind === 'product_data' && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 text-[10px] font-black">
                        {scannedEntity.product.sourceStandard}
                      </span>
                      <input
                        type="text"
                        aria-label="نام محصول"
                        value={productDraftName}
                        onChange={(e) => setProductDraftName(e.target.value)}
                        className="w-full mt-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-900 bg-slate-50"
                      />
                      <span className="text-[10.5px] font-bold text-slate-600 block mt-1">
                        {scannedEntity.product.brand} · {scannedEntity.product.category}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                      <Barcode className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="bg-sky-50/90 border border-sky-200 rounded-2xl p-2.5 text-[11px] space-y-1">
                    <div>کد: <strong className="font-mono" dir="ltr">{scannedEntity.product.barcode}</strong></div>
                    {scannedEntity.product.lotNumber && (
                      <div>سری ساخت: <strong className="font-mono">{scannedEntity.product.lotNumber}</strong></div>
                    )}
                    <div>انقضا: <strong className="font-mono">{toPersianDigits(scannedEntity.product.expiryDate)}</strong> · {scannedEntity.product.unit}</div>
                    {scannedEntity.product.pricePerUnit > 0 && (
                      <div>قیمت: <strong className="font-mono">{formatToman(scannedEntity.product.pricePerUnit)}</strong></div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProductDraftQty(q => Math.max(1, q - 1))}
                      aria-label="کاهش تعداد"
                      className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 font-mono font-black text-sm text-sky-800">
                      {toPersianDigits(productDraftQty)} {scannedEntity.product.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => setProductDraftQty(q => q + 1)}
                      aria-label="افزایش تعداد"
                      className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {onRegisterScannedProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        impactMedium();
                        success();
                        onRegisterScannedProduct({
                          id: `inv-scan-${Date.now()}`,
                          name: productDraftName.trim() || scannedEntity.product.name,
                          category: scannedEntity.product.category,
                          stock: Math.max(1, productDraftQty),
                          unit: scannedEntity.product.unit,
                          minAlert: Math.max(1, Math.min(3, productDraftQty)),
                          expiryDate: scannedEntity.product.expiryDate,
                          pricePerUnit: scannedEntity.product.pricePerUnit,
                          barcode: scannedEntity.product.barcode,
                          qrCode: scannedEntity.product.qrCode,
                          location: `${scannedEntity.product.brand}${scannedEntity.product.lotNumber ? ` · LOT: ${scannedEntity.product.lotNumber}` : ''}`
                        });
                        showFeedback('کالا در انبار ثبت شد');
                        resetToScanNext();
                      }}
                      className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>افزودن به انبار</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={resetToScanNext}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                اسکن بعدی
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm space-y-3 flex flex-col items-center">
              {/* Status & Camera Device Selector */}
              <div className="w-full flex items-center justify-between gap-2 text-[10.5px]">
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
                      : 'در حال اتصال دوربین...'}
                  </span>
                </span>

                {cameraDevices.length > 1 && (
                  <select
                    aria-label="انتخاب دوربین"
                    value={selectedDeviceId}
                    onChange={(e) => {
                      selection();
                      setSelectedDeviceId(e.target.value);
                    }}
                    className="max-w-[165px] bg-white/10 border border-white/20 rounded-xl px-2 py-1 text-[10.5px] font-bold text-white focus:outline-none"
                  >
                    {cameraDevices.map(dev => (
                      <option key={dev.deviceId} value={dev.deviceId} className="text-slate-900">
                        {dev.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Viewfinder */}
              <div className="relative w-full max-w-xs aspect-square rounded-[32px] overflow-hidden border-2 border-violet-400/80 shadow-[0_0_45px_rgba(139,92,246,0.3)] bg-slate-900 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Corner Brackets */}
                <div className="absolute inset-5 pointer-events-none z-20">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-violet-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-violet-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-violet-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-violet-400 rounded-br-xl" />
                </div>

                {hasCameraPermission === true && (
                  <div className="absolute inset-x-7 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse pointer-events-none z-20" />
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
                      onClick={() => startCamera(facingMode, selectedDeviceId || undefined)}
                      className="min-h-[38px] px-4 py-1.5 rounded-[12px] bg-violet-600 hover:bg-violet-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تلاش مجدد</span>
                    </button>
                  </div>
                )}

                {hasCameraPermission === true && (
                  <button
                    type="button"
                    onClick={triggerLiveFrameScan}
                    className="absolute bottom-3 inset-x-8 z-30 py-2 px-3 rounded-2xl bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-md border border-white/20 text-[11px] text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Barcode className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>اسکن</span>
                  </button>
                )}
              </div>

              {/* Real Image Decode Action */}
              <div className="w-full max-w-xs">
                <label className="w-full py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <FileUp className="w-4 h-4 text-violet-300 shrink-0" />
                  <span>{isDecodingPhoto ? 'در حال اسکن...' : 'انتخاب تصویر'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Real USB Laser Wedge / Manual Code Entry */}
        <div className="p-4 bg-slate-950/85 border-t border-white/10 z-20">
          <div className="flex items-center gap-2 max-w-sm mx-auto">
            <input
              ref={manualInputRef}
              type="text"
              aria-label="ورود کد بارکد یا QR"
              placeholder="کد بارکد، QR یا شناسه صیاد"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) {
                  scannerActiveRef.current = true;
                  handleDetectCode(manualCode.trim());
                  setManualCode('');
                }
              }}
              className="flex-1 bg-white/10 border border-white/15 rounded-2xl px-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (manualCode.trim()) {
                  scannerActiveRef.current = true;
                  handleDetectCode(manualCode.trim());
                  setManualCode('');
                }
              }}
              className="py-2.5 px-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs cursor-pointer"
            >
              ثبت
            </button>
          </div>
        </div>
      </div>
    </ViewportModalPortal>
  );
};
