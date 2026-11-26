import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  RotateCcw,
  CloudUpload,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Scan,
  Smartphone,
  SlidersHorizontal,
  Crosshair,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CountRound, ScannedItem, PowerAutomateConfig, SupabaseConfig, UserRole, DeviceInfo } from '../types/inventory';
import { parseInventoryQr, isPickingFila1, canonicalizeLocator, normalizeLocator } from '../utils/qrParser';
import { soundManager } from '../utils/audioHaptics';
import {
  normalizeRound,
  generateUUID,
  loadAutoUploadMode,
  saveAutoUploadMode,
  loadAutoUploadDelayMs,
  saveAutoUploadDelayMs,
} from '../utils/storage';
import { checkCloudDuplicateLocalizador } from '../utils/syncService';
import {
  AutocompleteInput,
  Badge,
  BottomSheet,
  FloatingActionButton,
  NumericStepper,
  Popover,
  ProcessStepper,
  Slider,
  Switch,
  Tooltip,
} from './ui/Controls';
import {
  ArcBadgeEntrance,
  PullToRefresh,
  ShakeContainer,
  TactileButton,
  EASE_OUT_EXPO,
} from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

interface ScannerViewProps {
  onScanComplete: (item: ScannedItem) => Promise<void>;
  scans: ScannedItem[];
  powerAutomateConfig: PowerAutomateConfig;
  countRound: CountRound;
  userRounds?: Record<number, CountRound>;
  operatorName: string;
  userRole: UserRole;
  deviceInfo: DeviceInfo;
  round2Authorizations?: Record<number, boolean>;
  supabaseConfig?: SupabaseConfig;
  onOpenDeviceSetup: () => void;
  onOpenMasterAuth: () => void;
  onOpenPowerAutomate: () => void;
  onOpenCheckIn?: () => void;
  onManualCloudRefresh?: () => Promise<number>;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onScanComplete,
  scans,
  powerAutomateConfig,
  countRound,
  userRounds,
  operatorName,
  userRole,
  deviceInfo,
  round2Authorizations = {},
  supabaseConfig,
  onOpenDeviceSetup,
  onOpenMasterAuth,
  onOpenPowerAutomate,
  onOpenCheckIn,
  onManualCloudRefresh,
}) => {
  const { toast, showSnackbar } = useToast();

  // Determine effective count round for this terminal (individual user round has priority)
  const effectiveRound: CountRound =
    deviceInfo.userNumber && userRounds?.[deviceInfo.userNumber]
      ? userRounds[deviceInfo.userNumber]
      : countRound;

  const isBlockedInRound2 =
    effectiveRound === '2DO_CONTEO' &&
    Boolean(deviceInfo.userNumber) &&
    round2Authorizations[deviceInfo.userNumber!] === false &&
    userRounds?.[deviceInfo.userNumber!] !== '2DO_CONTEO';

  // 5 Form Fields populated when barcode is scanned
  const [sku, setSku] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [subinventario, setSubinventario] = useState('');
  const [localizador, setLocalizador] = useState('');
  const [rawQrScanned, setRawQrScanned] = useState('');

  const isFila1Picking = isPickingFila1(localizador);

  // Hidden buffer for Zebra TC26 laser keystroke wedge
  const [hardwareBuffer, setHardwareBuffer] = useState('');
  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Sheets & Alerts
  const [isConfirmUploadOpen, setIsConfirmUploadOpen] = useState(false);
  const [isConfirmRetryOpen, setIsConfirmRetryOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    sku: string;
    localizador: string;
    prevTime: string;
    operator?: string;
    round?: string;
  } | null>(null);
  const [scanAlertModal, setScanAlertModal] = useState<{
    type: 'error' | 'finalized';
    badge: string;
    title: string;
    message: string;
    rawSample?: string;
  } | null>(null);
  const [alertShakeKey, setAlertShakeKey] = useState(0);
  const alertModalOpenedAtRef = useRef<number>(0);

  const [isUploading, setIsUploading] = useState(false);

  // Synchronous guards & scanner wedge burst buffers
  const isSubmittingRef = useRef(false);
  const fastBufferRef = useRef('');
  const burstTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedQrRef = useRef<{ raw: string; at: number } | null>(null);

  // POKA-YOKE 5: Auto-Upload Fast Mode + Configurable Delay Slider
  const [autoUploadEnabled, setAutoUploadEnabled] = useState<boolean>(() => loadAutoUploadMode());
  const [autoUploadDelayMs, setAutoUploadDelayMs] = useState<number>(() => loadAutoUploadDelayMs());
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const autoUploadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoUploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Known SKUs for Autocomplete when editing Fila 1 Picking
  const skuSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const s of scans) {
      if (s.sku && !s.sku.startsWith('TEST-SKU')) set.add(s.sku);
    }
    return Array.from(set);
  }, [scans]);

  const cancelAutoUploadTimer = (notifyUser = false) => {
    const wasRunning = Boolean(autoUploadTimerRef.current);
    if (autoUploadTimerRef.current) {
      clearTimeout(autoUploadTimerRef.current);
      autoUploadTimerRef.current = null;
    }
    if (autoUploadIntervalRef.current) {
      clearInterval(autoUploadIntervalRef.current);
      autoUploadIntervalRef.current = null;
    }
    setCountdownMs(null);
    if (notifyUser && wasRunning) {
      showSnackbar({
        message: 'Auto-subida pausada. Revisa los datos antes de enviar.',
        actionLabel: 'Limpiar',
        onAction: () => handleClearBoxes(),
      });
    }
  };

  const handleToggleAutoUpload = (next: boolean) => {
    setAutoUploadEnabled(next);
    saveAutoUploadMode(next);
    if (!next) {
      cancelAutoUploadTimer();
    }
    toast({
      title: next
        ? `Auto-Subida activada (${(autoUploadDelayMs / 1000).toFixed(1)}s)`
        : 'Modo Manual activado',
      variant: next ? 'success' : 'info',
    });
  };

  const handleChangeDelay = (ms: number) => {
    setAutoUploadDelayMs(ms);
    saveAutoUploadDelayMs(ms);
  };

  useEffect(() => {
    return () => {
      cancelAutoUploadTimer();
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (inputDebounceTimerRef.current) clearTimeout(inputDebounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (effectiveRound === 'CONTEO_FINALIZADO' || isBlockedInRound2) {
      cancelAutoUploadTimer();
      setIsConfirmUploadOpen(false);
      setIsConfirmRetryOpen(false);
    }
  }, [effectiveRound, isBlockedInRound2]);

  useEffect(() => {
    if (!isConfirmUploadOpen && !isConfirmRetryOpen && !duplicateWarning && !scanAlertModal && !isBlockedInRound2) {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return;
      }
      if (!sku && skuInputRef.current) {
        skuInputRef.current.focus({ preventScroll: true });
      }
    }
  }, [isConfirmUploadOpen, isConfirmRetryOpen, duplicateWarning, scanAlertModal, sku, isBlockedInRound2]);

  const handleClearBoxes = () => {
    cancelAutoUploadTimer();
    setSku('');
    setCantidad('');
    setDescripcion('');
    setSubinventario('');
    setLocalizador('');
    setRawQrScanned('');
  };

  const checkDuplicateLocalizador = (targetLoc: string, currentSku?: string): boolean => {
    const cleanLoc = (targetLoc || '').trim().toUpperCase();
    if (!cleanLoc) return false;

    const normalizedEffectiveRound = normalizeRound(effectiveRound);
    const canonLoc = canonicalizeLocator(cleanLoc);
    const normLoc = normalizeLocator(cleanLoc);

    const existingInRound = scans.filter((s) => {
      if (normalizeRound(s.conteoRound) !== normalizedEffectiveRound) return false;
      const sLoc = (s.localizador || '').trim().toUpperCase();
      const sCanon = canonicalizeLocator(sLoc);
      const sNorm = normalizeLocator(sLoc);
      return (
        sLoc === cleanLoc ||
        (canonLoc && sCanon === canonLoc) ||
        (normLoc && sNorm === normLoc)
      );
    });

    if (existingInRound.length > 0) {
      handleClearBoxes();
      setIsConfirmUploadOpen(false);
      soundManager.playWarning();
      setAlertShakeKey((k) => k + 1);
      const match = existingInRound[0];
      setDuplicateWarning({
        sku: match.sku || currentSku || 'N/A',
        localizador: cleanLoc,
        prevTime: new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        operator: match.operador || match.nombreOperadorCompleto || 'Este dispositivo',
        round: effectiveRound === '3ER_CONTEO' ? '3er Conteo' : effectiveRound === '2DO_CONTEO' ? '2do Conteo' : '1er Conteo',
      });
      return true;
    }
    return false;
  };

  const validateDuplicate = async (targetLoc: string, currentSku?: string): Promise<boolean> => {
    const cleanLoc = (targetLoc || '').trim();
    if (!cleanLoc) return false;

    if (checkDuplicateLocalizador(cleanLoc, currentSku)) {
      return true;
    }

    if (supabaseConfig?.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        const cloudCheck = await checkCloudDuplicateLocalizador(cleanLoc, effectiveRound, supabaseConfig);
        if (cloudCheck.isDuplicate) {
          handleClearBoxes();
          setIsConfirmUploadOpen(false);
          soundManager.playWarning();
          setAlertShakeKey((k) => k + 1);
          setDuplicateWarning({
            sku: cloudCheck.sku || currentSku || 'N/A',
            localizador: cleanLoc.toUpperCase(),
            prevTime: cloudCheck.prevTime || 'recientemente',
            operator: cloudCheck.operator || 'Otro dispositivo',
            round: effectiveRound === '3ER_CONTEO' ? '3er Conteo' : effectiveRound === '2DO_CONTEO' ? '2do Conteo' : '1er Conteo',
          });
          return true;
        }
      } catch {
        // network fallback
      }
    }
    return false;
  };

  const refocusScanner = () => {
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTimeout(() => {
      if (!sku && skuInputRef.current) {
        skuInputRef.current.focus({ preventScroll: true });
      } else if (hardwareInputRef.current) {
        hardwareInputRef.current.value = '';
        hardwareInputRef.current.focus({ preventScroll: true });
      }
    }, 60);
  };

  const handleConfirmUpload = async (overrideData?: {
    sku: string;
    cantidad: number;
    descripcion: string;
    subinventario: string;
    localizador: string;
    rawQr: string;
  }) => {
    if (isSubmittingRef.current || isBlockedInRound2 || effectiveRound === 'CONTEO_FINALIZADO') return;

    cancelAutoUploadTimer();
    const targetSku = (overrideData?.sku ?? sku).trim();
    const targetCantidad = overrideData?.cantidad ?? cantidad;
    const targetDesc = (overrideData?.descripcion ?? descripcion).trim();
    const targetSubinv = (overrideData?.subinventario ?? subinventario).trim();
    const targetLoc = (overrideData?.localizador ?? localizador).trim();
    const targetRaw = overrideData?.rawQr ?? rawQrScanned;

    if (!targetSku || targetCantidad === '' || !targetLoc) return;

    isSubmittingRef.current = true;
    setIsUploading(true);

    try {
      const isDup = await validateDuplicate(targetLoc, targetSku);
      if (isDup) return;

      setIsConfirmUploadOpen(false);

      const userExcelVal = deviceInfo.userNumber
        ? `Usuario ${deviceInfo.userNumber}`
        : deviceInfo.operatorName || 'Usuario 1';
      const isPicking = isPickingFila1(targetLoc);

      const newItem: ScannedItem = {
        id: generateUUID(),
        sku: targetSku,
        cantidad: Number(targetCantidad),
        descripcion: targetDesc || (isPicking ? 'PICKING FILA 1' : ''),
        subinventario: targetSubinv || 'LINEA',
        localizador: targetLoc,
        conteoRound: effectiveRound,
        rawQr:
          targetRaw ||
          `${targetSku}_${targetCantidad}_${targetDesc || 'PICKING FILA 1'}_${targetSubinv || 'LINEA'}_${targetLoc}`,
        timestamp: new Date().toISOString(),
        operador: userExcelVal,
        nombreOperadorCompleto: deviceInfo.operatorName || operatorName,
        userNumber: deviceInfo.userNumber,
        dispositivo: deviceInfo.deviceName || 'Zebra TC26',
        syncStateSharepoint:
          powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl ? 'pending' : 'simulated',
      };

      const uploadedSku = targetSku;
      const uploadedQty = targetCantidad;

      handleClearBoxes();
      refocusScanner();

      confetti({
        particleCount: 18,
        spread: 42,
        origin: { y: 0.8 },
        colors: ['#10b981', '#f59e0b'],
      });

      toast({
        title: `${uploadedSku} (${uploadedQty} pzs) registrado`,
        description: `Loc: ${targetLoc} • Guardando en SharePoint y Supabase`,
        variant: 'success',
      });

      await onScanComplete(newItem);
    } catch {
      // Background sync will update status
    } finally {
      isSubmittingRef.current = false;
      setIsUploading(false);
      refocusScanner();
    }
  };

  const clearScannerBuffers = () => {
    fastBufferRef.current = '';
    if (burstTimerRef.current) {
      clearTimeout(burstTimerRef.current);
      burstTimerRef.current = null;
    }
    if (inputDebounceTimerRef.current) {
      clearTimeout(inputDebounceTimerRef.current);
      inputDebounceTimerRef.current = null;
    }
    setHardwareBuffer('');
    if (hardwareInputRef.current) {
      hardwareInputRef.current.value = '';
    }
  };

  const handleProcessBarcode = (qrString: string) => {
    cancelAutoUploadTimer();
    const clean = qrString.trim();
    if (!clean) return;

    const now = Date.now();
    if (
      lastProcessedQrRef.current &&
      lastProcessedQrRef.current.raw === clean &&
      now - lastProcessedQrRef.current.at < 800
    ) {
      clearScannerBuffers();
      return;
    }
    lastProcessedQrRef.current = { raw: clean, at: now };
    clearScannerBuffers();

    // Critical guard: block laser bypass when user is unauthorized in Round 2
    if (isBlockedInRound2) {
      soundManager.playError();
      setAlertShakeKey((k) => k + 1);
      alertModalOpenedAtRef.current = Date.now();
      setScanAlertModal({
        type: 'finalized',
        badge: 'USUARIO EN ESPERA',
        title: `Usuario ${deviceInfo.userNumber || ''} no autorizado en 2do Conteo`,
        message: 'Espera a que Gerencia habilite tu usuario para escanear en esta ronda.',
      });
      return;
    }

    if (effectiveRound === 'CONTEO_FINALIZADO') {
      soundManager.playError();
      if (!rawQrScanned) handleClearBoxes();
      setAlertShakeKey((k) => k + 1);
      alertModalOpenedAtRef.current = Date.now();
      setScanAlertModal({
        type: 'finalized',
        badge: 'CONTEO FINALIZADO',
        title: 'El conteo ha sido cerrado por Gerencia',
        message:
          'Las capturas están bloqueadas porque el inventario finalizó. Solicita autorización a Gerencia para abrir un nuevo ciclo.',
      });
      return;
    }

    const parsed = parseInventoryQr(clean);

    if (!parsed.isValid) {
      soundManager.playError();
      if (!rawQrScanned) handleClearBoxes();
      setAlertShakeKey((k) => k + 1);
      alertModalOpenedAtRef.current = Date.now();
      setScanAlertModal({
        type: 'error',
        badge: 'FORMATO QR NO RECONOCIDO',
        title: 'No se pudo leer este código QR',
        message: parsed.error || 'Estructura esperada: SKU_Cantidad_Descripcion_Subinventario_Localizador',
        rawSample: clean.length > 90 ? `${clean.slice(0, 90)}…` : clean,
      });
      return;
    }

    if (checkDuplicateLocalizador(parsed.localizador, parsed.sku)) {
      return;
    }

    setSku(parsed.sku);
    setCantidad(parsed.cantidad);
    setDescripcion(parsed.descripcion);
    setSubinventario(parsed.subinventario);
    setLocalizador(parsed.localizador);
    setRawQrScanned(clean);
    soundManager.playSuccess();

    if (supabaseConfig?.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      checkCloudDuplicateLocalizador(parsed.localizador, effectiveRound, supabaseConfig)
        .then((cloudCheck) => {
          if (cloudCheck.isDuplicate) {
            cancelAutoUploadTimer();
            handleClearBoxes();
            setIsConfirmUploadOpen(false);
            soundManager.playWarning();
            setAlertShakeKey((k) => k + 1);
            setDuplicateWarning({
              sku: cloudCheck.sku || parsed.sku || 'N/A',
              localizador: parsed.localizador.trim().toUpperCase(),
              prevTime: cloudCheck.prevTime || 'recientemente',
              operator: cloudCheck.operator || 'Otro dispositivo',
              round:
                effectiveRound === '3ER_CONTEO'
                  ? '3er Conteo'
                  : effectiveRound === '2DO_CONTEO'
                  ? '2do Conteo'
                  : '1er Conteo',
            });
          }
        })
        .catch(() => {});
    }

    const isPicking = isPickingFila1(parsed.localizador);
    if (autoUploadEnabled && !isPicking) {
      const TOTAL_MS = autoUploadDelayMs;
      const INTERVAL = 50;
      let remaining = TOTAL_MS;
      setCountdownMs(remaining);

      autoUploadIntervalRef.current = setInterval(() => {
        remaining -= INTERVAL;
        if (remaining <= 0) {
          if (autoUploadIntervalRef.current) {
            clearInterval(autoUploadIntervalRef.current);
            autoUploadIntervalRef.current = null;
          }
          setCountdownMs(null);
        } else {
          setCountdownMs(remaining);
        }
      }, INTERVAL);

      autoUploadTimerRef.current = setTimeout(() => {
        cancelAutoUploadTimer();
        handleConfirmUpload({
          sku: parsed.sku,
          cantidad: parsed.cantidad,
          descripcion: parsed.descripcion,
          subinventario: parsed.subinventario,
          localizador: parsed.localizador,
          rawQr: clean,
        });
      }, TOTAL_MS);
    }

    setHardwareBuffer('');
    if (hardwareInputRef.current) {
      hardwareInputRef.current.value = '';
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const tryParseAndDistribute = (value: string): boolean => {
    const trimmed = (value || '').trim();
    if (!trimmed) return false;
    const parts = trimmed.split('_');
    if (parts.length >= 5) {
      const parsed = parseInventoryQr(trimmed);
      if (parsed.isValid) {
        handleProcessBarcode(trimmed);
        return true;
      }
    }
    return false;
  };

  const scheduleInputQrParse = (val: string) => {
    if (inputDebounceTimerRef.current) {
      clearTimeout(inputDebounceTimerRef.current);
      inputDebounceTimerRef.current = null;
    }
    if (!val || val.split('_').length < 5) return;
    inputDebounceTimerRef.current = setTimeout(() => {
      inputDebounceTimerRef.current = null;
      tryParseAndDistribute(val);
    }, 140);
  };

  useEffect(() => {
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isBlockedInRound2 ||
        effectiveRound === 'CONTEO_FINALIZADO' ||
        isConfirmUploadOpen ||
        isConfirmRetryOpen ||
        duplicateWarning ||
        scanAlertModal
      ) {
        return;
      }

      const target = e.target as HTMLElement;
      const isInput = target && target.tagName === 'INPUT';

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime;
      lastKeyTime = now;

      if (timeSinceLastKey > 180) {
        fastBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (inputDebounceTimerRef.current) {
          clearTimeout(inputDebounceTimerRef.current);
          inputDebounceTimerRef.current = null;
        }
        if (burstTimerRef.current) {
          clearTimeout(burstTimerRef.current);
          burstTimerRef.current = null;
        }

        if (isInput && (target as HTMLInputElement).value) {
          const val = (target as HTMLInputElement).value;
          if (tryParseAndDistribute(val)) {
            e.preventDefault();
            e.stopPropagation();
            fastBufferRef.current = '';
            (target as HTMLInputElement).blur();
            return;
          }
          if (target.id === 'field-sku' && val.includes('_')) {
            e.preventDefault();
            e.stopPropagation();
            fastBufferRef.current = '';
            handleProcessBarcode(val);
            (target as HTMLInputElement).blur();
            return;
          }
        }

        if (fastBufferRef.current.length > 5) {
          if (tryParseAndDistribute(fastBufferRef.current)) {
            e.preventDefault();
            e.stopPropagation();
            fastBufferRef.current = '';
            if (isInput) (target as HTMLInputElement).blur();
            return;
          }
        }

        if (isInput) e.preventDefault();
        return;
      }

      if (e.key.length === 1) {
        fastBufferRef.current += e.key;
        if (burstTimerRef.current) {
          clearTimeout(burstTimerRef.current);
          burstTimerRef.current = null;
        }

        if (fastBufferRef.current.includes('_') && fastBufferRef.current.split('_').length >= 5) {
          burstTimerRef.current = setTimeout(() => {
            const buffered = fastBufferRef.current;
            if (buffered.split('_').length >= 5) {
              const parsed = parseInventoryQr(buffered);
              if (parsed.isValid) {
                handleProcessBarcode(buffered);
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }
            }
          }, 140);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, [
    isConfirmUploadOpen,
    isConfirmRetryOpen,
    duplicateWarning,
    scanAlertModal,
    effectiveRound,
    isBlockedInRound2,
    scans,
  ]);

  const handleConfirmRetry = () => {
    handleClearBoxes();
    setIsConfirmRetryOpen(false);
    refocusScanner();
  };

  const hasDataInBoxes = Boolean(sku || cantidad !== '' || descripcion || localizador);

  // Inline validation for manual / Fila 1 readiness
  const isCantidadValid = cantidad !== '' && Number(cantidad) > 0;
  const isFormComplete = Boolean(sku.trim() && isCantidadValid && localizador.trim());

  const roundMeta =
    effectiveRound === '1ER_CONTEO'
      ? { label: '1er Conteo', tone: 'emerald' as const, stepIdx: 0 }
      : effectiveRound === '2DO_CONTEO'
      ? { label: '2do Conteo', tone: 'blue' as const, stepIdx: 1 }
      : effectiveRound === '3ER_CONTEO'
      ? { label: '3er Conteo', tone: 'amber' as const, stepIdx: 2 }
      : { label: 'Conteo Finalizado', tone: 'rose' as const, stepIdx: 3 };

  const ownFinalSummary = useMemo(() => {
    const userLabel = deviceInfo.userNumber ? `Usuario ${deviceInfo.userNumber}` : null;
    const ownScans = scans.filter((s) => {
      if (s.sku && s.sku.startsWith('TEST-SKU')) return false;
      if (deviceInfo.userNumber) {
        return s.userNumber === deviceInfo.userNumber || s.operador === userLabel;
      }
      if (deviceInfo.operatorName) {
        return (
          s.nombreOperadorCompleto === deviceInfo.operatorName || s.operador === deviceInfo.operatorName
        );
      }
      return false;
    });
    const r1 = ownScans.filter((s) => normalizeRound(s.conteoRound) === '1ER_CONTEO');
    const r2 = ownScans.filter((s) => normalizeRound(s.conteoRound) === '2DO_CONTEO');
    const r3 = ownScans.filter((s) => normalizeRound(s.conteoRound) === '3ER_CONTEO');
    return {
      totalScans: ownScans.length,
      totalPieces: ownScans.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0),
      r1Scans: r1.length,
      r2Scans: r2.length,
      r3Scans: r3.length,
    };
  }, [scans, deviceInfo.userNumber, deviceInfo.operatorName]);

  const handlePullRefresh = async () => {
    if (!onManualCloudRefresh) return;
    try {
      const count = await onManualCloudRefresh();
      toast({
        title: 'Nube sincronizada',
        description: `${count} registros verificados para detección de duplicados.`,
        variant: 'info',
      });
    } catch {
      toast({ title: 'Sin conexión con Supabase', variant: 'warning' });
    }
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh} disabled={!onManualCloudRefresh}>
      <div className="max-w-2xl mx-auto space-y-3.5">
        {/* Hidden Buffer Input for TC26 Hardware Laser */}
        <input
          id="tc26-hidden-buffer"
          ref={hardwareInputRef}
          type="text"
          inputMode="none"
          disabled={isBlockedInRound2 || effectiveRound === 'CONTEO_FINALIZADO'}
          tabIndex={-1}
          value={hardwareBuffer}
          onChange={(e) => {
            if (isBlockedInRound2 || effectiveRound === 'CONTEO_FINALIZADO') return;
            const val = e.target.value;
            setHardwareBuffer(val);
            scheduleInputQrParse(val);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (isBlockedInRound2 || effectiveRound === 'CONTEO_FINALIZADO') return;
              if (inputDebounceTimerRef.current) {
                clearTimeout(inputDebounceTimerRef.current);
                inputDebounceTimerRef.current = null;
              }
              if (tryParseAndDistribute(hardwareBuffer)) {
                setHardwareBuffer('');
              } else {
                handleProcessBarcode(hardwareBuffer);
              }
            }
          }}
          className="opacity-0 absolute -z-10 pointer-events-none"
          autoComplete="off"
          autoFocus={!isBlockedInRound2 && effectiveRound !== 'CONTEO_FINALIZADO'}
        />

        {/* Glassmorphic Terminal Status Card + Process Stepper */}
        <div className="glass-surface rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {deviceInfo.isUserNumberLocked ? (
              <Tooltip content="Usuario vinculado al dispositivo durante todo el ciclo">
                <div className="px-3 py-1.5 bg-slate-950/90 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-2 border border-slate-800 select-none">
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black font-mono text-[11px] flex items-center gap-1 shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>U{deviceInfo.userNumber}</span>
                  </span>
                  <span className="font-bold text-white whitespace-nowrap">
                    Usuario {deviceInfo.userNumber}
                  </span>
                  {deviceInfo.operatorName && (
                    <span className="text-slate-400 truncate max-w-[140px]">
                      • {deviceInfo.operatorName}
                    </span>
                  )}
                </div>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={onOpenCheckIn || onOpenDeviceSetup}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-2 border border-slate-800 cursor-pointer transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold text-white">{deviceInfo.deviceName}</span>
                <span className="text-amber-400 text-[11px] font-semibold">(Elegir Usuario)</span>
              </button>
            )}

            {/* Tactile Neumorphic Auto-Upload Switch + Speed Popover */}
            <div className="flex items-center gap-2">
              <div className="neu-surface px-3 py-1.5 rounded-xl border border-slate-800/90 flex items-center gap-2.5">
                <Switch
                  checked={autoUploadEnabled}
                  onChange={handleToggleAutoUpload}
                  tone="emerald"
                  label={autoUploadEnabled ? `Auto (${(autoUploadDelayMs / 1000).toFixed(1)}s)` : 'Manual'}
                />

                <Popover
                  align="right"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label="Ajustar velocidad de auto-subida"
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  )}
                >
                  {() => (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-white">
                        Velocidad de Auto-Subida
                      </div>
                      <Slider
                        value={autoUploadDelayMs}
                        min={800}
                        max={3000}
                        step={100}
                        onChange={handleChangeDelay}
                        label="Espera antes de enviar"
                        formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
                      />
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Aplica cuando <strong>Auto-Subida</strong> está activa. En Fila 1 (Picking) siempre se pausa para validar físicamente.
                      </p>
                    </div>
                  )}
                </Popover>
              </div>

              {userRole === 'MASTER' && (
                <button
                  type="button"
                  onClick={onOpenMasterAuth}
                  className="h-9 px-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-amber-500/35 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Master</span>
                </button>
              )}
            </div>
          </div>

          {/* Audit Lifecycle Stepper */}
          <div className="pt-2 border-t border-slate-800/70">
            <ProcessStepper
              currentStepIndex={roundMeta.stepIdx}
              tone={roundMeta.tone}
              steps={[
                { id: 'r1', label: '1er Conteo' },
                { id: 'r2', label: '2do Conteo' },
                { id: 'r3', label: '3er Conteo' },
                { id: 'done', label: 'Cierre' },
              ]}
            />
          </div>
        </div>

        {/* CIERRE ESPECIAL: CONTEO FINALIZADO POR GERENCIA */}
        {effectiveRound === 'CONTEO_FINALIZADO' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className="bg-slate-900/95 border border-emerald-500/45 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <Badge tone="emerald">INVENTARIO CERRADO POR GERENCIA</Badge>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                ¡Conteo Finalizado{deviceInfo.operatorName ? `, ${deviceInfo.operatorName}` : ''}!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                La auditoría concluyó y el escáner láser quedó bloqueado para evitar capturas fuera de turno.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <span className="text-[11px] text-slate-400 block">Mis Códigos QR</span>
                <span className="text-2xl font-mono font-extrabold text-emerald-400 tabular-nums">
                  {ownFinalSummary.totalScans}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">ubicaciones registradas</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <span className="text-[11px] text-slate-400 block">Mis Piezas Contadas</span>
                <span className="text-2xl font-mono font-extrabold text-amber-400 tabular-nums">
                  {ownFinalSummary.totalPieces.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">piezas totales</span>
              </div>
            </div>

            {ownFinalSummary.totalScans > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge tone="emerald">1er: {ownFinalSummary.r1Scans}</Badge>
                <Badge tone="blue">2do: {ownFinalSummary.r2Scans}</Badge>
                {ownFinalSummary.r3Scans > 0 && (
                  <Badge tone="amber">3er: {ownFinalSummary.r3Scans}</Badge>
                )}
              </div>
            )}

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 font-mono max-w-md mx-auto flex flex-wrap items-center justify-between gap-2">
              <span>
                Usuario:{' '}
                <strong className="text-white">
                  {deviceInfo.userNumber ? `Usuario ${deviceInfo.userNumber}` : 'Sin asignar'}
                </strong>
              </span>
              <span>
                Terminal: <strong className="text-white">{deviceInfo.deviceName}</strong>
              </span>
            </div>
          </motion.div>
        ) : isBlockedInRound2 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/95 border border-rose-500/55 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400 mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <Badge tone="rose">USUARIO EN ESPERA DE ASIGNACIÓN</Badge>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Usuario {deviceInfo.userNumber}: No Habilitado para 2do Conteo
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                El <strong>Gerente</strong> aún no ha habilitado a este usuario para continuar en el 2do Conteo.
              </p>
            </div>
          </motion.div>
        ) : (
          /* Main Scanner Form Surface */
          <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
            {/* Sub-header with curved Arc badge */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
              <span className="text-slate-200 font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Scan className="w-4 h-4 text-amber-400" />
                <span>Datos del Código QR</span>
              </span>
              <ArcBadgeEntrance show={hasDataInBoxes}>
                <Badge tone="emerald" dot>
                  Código cargado
                </Badge>
              </ArcBadgeEntrance>
              {!hasDataInBoxes && (
                <span className="text-slate-400 font-mono text-[11px]">Apunta el láser TC26</span>
              )}
            </div>

            {/* Fila 1 Picking Alert */}
            <AnimatePresence>
              {isFila1Picking && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                  className="p-3 bg-amber-500/15 border border-amber-500/45 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-200"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white">
                      Picking Detectado: Fila 1 ({localizador.trim()})
                    </div>
                    <span className="text-[11px] text-amber-200/90 block mt-0.5">
                      Auto-subida pausada para verificación física. Casilla <strong>SKU</strong> desbloqueada.
                    </span>
                  </div>
                  <Badge tone="amber">Fila 1</Badge>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Auto-Upload Countdown */}
            <AnimatePresence>
              {countdownMs !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3.5 bg-emerald-950/85 border border-emerald-500/70 rounded-xl space-y-2 shadow-lg"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-300 tabular-nums">
                      <span className="animate-pulse">⚡</span>
                      <span>
                        Subiendo en{' '}
                        <strong className="text-white font-mono text-sm">
                          {(countdownMs / 1000).toFixed(1)}s
                        </strong>
                        ...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelAutoUploadTimer(true)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-white rounded-lg text-xs font-bold border border-rose-500/50 cursor-pointer"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-emerald-500/30">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-amber-400 h-full transition-all duration-75 ease-linear rounded-full"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, ((autoUploadDelayMs - countdownMs) / autoUploadDelayMs) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1. SKU Field with Autocomplete in Fila 1 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="field-sku" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>SKU / Código del Producto</span>
                  {isFila1Picking ? (
                    <Badge tone="amber">Picking Editable</Badge>
                  ) : hasDataInBoxes ? (
                    <Badge tone="neutral">Bloqueado</Badge>
                  ) : (
                    <Badge tone="amber" dot pulse>
                      Listo
                    </Badge>
                  )}
                </label>
                {sku.includes('_') && (
                  <button
                    type="button"
                    onClick={() => handleProcessBarcode(sku)}
                    className="text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/40 cursor-pointer"
                  >
                    Desglosar QR ({sku.split('_').length} partes)
                  </button>
                )}
              </div>

              <AutocompleteInput
                id="field-sku"
                inputRef={skuInputRef}
                readOnly={hasDataInBoxes && !isFila1Picking && Boolean(rawQrScanned)}
                tabIndex={hasDataInBoxes && !isFila1Picking && Boolean(rawQrScanned) ? -1 : 0}
                inputMode={isFila1Picking ? 'text' : 'none'}
                value={sku}
                suggestions={isFila1Picking ? skuSuggestions : []}
                onChange={(val) => {
                  cancelAutoUploadTimer();
                  setSku(val.toUpperCase());
                  scheduleInputQrParse(val);
                }}
                onBlur={async (e) => {
                  const val = e.target.value.trim();
                  if (val && localizador.trim()) {
                    await validateDuplicate(localizador, val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inputDebounceTimerRef.current) {
                      clearTimeout(inputDebounceTimerRef.current);
                      inputDebounceTimerRef.current = null;
                    }
                    const targetVal = (e.target as HTMLInputElement).value;
                    if (targetVal.split('_').length >= 5) {
                      tryParseAndDistribute(targetVal);
                    }
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (text && text.split('_').length >= 5) {
                    if (tryParseAndDistribute(text)) e.preventDefault();
                  }
                }}
                placeholder={
                  isFila1Picking
                    ? 'Escribe o selecciona SKU de picking...'
                    : hasDataInBoxes
                    ? 'Código cargado'
                    : 'Toca aquí o apunta el láser TC26...'
                }
                inputClassName={`w-full min-h-[48px] py-2.5 px-3.5 rounded-xl font-mono text-base sm:text-lg font-bold placeholder:text-slate-500 focus:outline-none transition-all ${
                  isFila1Picking
                    ? 'bg-slate-950 border-2 border-amber-400 text-amber-300 cursor-text'
                    : hasDataInBoxes
                    ? 'bg-slate-900/70 border border-slate-700/80 cursor-default select-none pointer-events-none text-amber-400'
                    : 'bg-slate-950 border-2 border-amber-500/70 focus:border-amber-400 text-amber-400'
                }`}
              />
            </div>

            {/* 2. Cantidad + Tactile Numeric Stepper */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="field-cantidad" className="text-xs font-semibold text-slate-300">
                  Cantidad de Piezas
                </label>
                {cantidad !== '' && (
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      isCantidadValid ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isCantidadValid ? '✓ Cantidad válida' : 'Debe ser mayor a 0'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="field-cantidad"
                  type="number"
                  inputMode="numeric"
                  value={cantidad}
                  onChange={(e) => {
                    cancelAutoUploadTimer();
                    const val = e.target.value;
                    if (val.includes('_') && val.split('_').length >= 5) {
                      if (tryParseAndDistribute(val)) return;
                    }
                    setCantidad(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (text && text.split('_').length >= 5) {
                      if (tryParseAndDistribute(text)) e.preventDefault();
                    }
                  }}
                  placeholder="0"
                  className="flex-1 min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-base sm:text-lg font-bold text-white placeholder:text-slate-600 focus:outline-none tabular-nums"
                />
                <NumericStepper
                  value={cantidad}
                  min={0}
                  onChange={(next) => {
                    cancelAutoUploadTimer();
                    setCantidad(next);
                  }}
                />
              </div>
            </div>

            {/* 3. Descripción (Locked) */}
            <div>
              <label htmlFor="field-descripcion" className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Descripción</span>
                <Badge tone="neutral">Bloqueado</Badge>
              </label>
              <input
                id="field-descripcion"
                type="text"
                readOnly
                tabIndex={-1}
                value={descripcion}
                onFocus={(e) => e.target.blur()}
                onTouchStart={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                placeholder="Descripción obtenida del código QR..."
                className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-900/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 placeholder:text-slate-600 focus:outline-none select-none cursor-default pointer-events-none"
              />
            </div>

            {/* 4 & 5. Subinventario y Localizador */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="field-subinventario" className="text-xs font-semibold text-slate-300 mb-1 block">
                  Subinventario
                </label>
                <input
                  id="field-subinventario"
                  type="text"
                  value={subinventario}
                  onChange={(e) => {
                    cancelAutoUploadTimer();
                    const val = e.target.value;
                    if (val.includes('_') && val.split('_').length >= 5) {
                      if (tryParseAndDistribute(val)) return;
                    }
                    setSubinventario(val.toUpperCase());
                  }}
                  placeholder="Ej. LINEA"
                  className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="field-localizador" className="text-xs font-semibold text-slate-300 mb-1 block">
                  Localizador (Rack / Bin)
                </label>
                <input
                  id="field-localizador"
                  type="text"
                  value={localizador}
                  onChange={(e) => {
                    cancelAutoUploadTimer();
                    const val = e.target.value;
                    if (val.includes('_') && val.split('_').length >= 5) {
                      if (tryParseAndDistribute(val)) return;
                    }
                    setLocalizador(val.toUpperCase());
                  }}
                  onBlur={async (e) => {
                    const val = e.target.value.trim();
                    if (val) await validateDuplicate(val, sku);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const targetVal = (e.target as HTMLInputElement).value.trim();
                      if (targetVal) await validateDuplicate(targetVal, sku);
                    }
                  }}
                  placeholder="Ej. A-22-1"
                  className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-xs sm:text-sm font-bold text-emerald-400 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Primary Actions (Single Clear Set, Zero Duplicates) */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TactileButton
                type="button"
                anticipation
                disabled={!isFormComplete || isUploading}
                onClick={async () => {
                  if (isFormComplete && !isSubmittingRef.current && !isUploading) {
                    cancelAutoUploadTimer();
                    setIsUploading(true);
                    const isDup = await validateDuplicate(localizador, sku);
                    setIsUploading(false);
                    if (isDup) return;
                    setIsConfirmUploadOpen(true);
                  }
                }}
                className={`w-full min-h-[54px] py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-colors ${
                  isFormComplete && !isUploading
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                }`}
              >
                <CloudUpload className="w-5 h-5 shrink-0" />
                <span>{isUploading ? 'Validando...' : 'Subir Información a Excel'}</span>
              </TactileButton>

              <TactileButton
                type="button"
                disabled={!hasDataInBoxes}
                onClick={() => {
                  if (hasDataInBoxes) setIsConfirmRetryOpen(true);
                  else refocusScanner();
                }}
                className={`w-full min-h-[54px] py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 border transition-colors ${
                  hasDataInBoxes
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/40 cursor-pointer'
                    : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                }`}
              >
                <RotateCcw className="w-5 h-5 shrink-0" />
                <span>Reintentar</span>
              </TactileButton>
            </div>

            <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500">
              <span>
                {powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl
                  ? '✓ Conexión SharePoint Activa'
                  : 'Modo Registro Local'}
              </span>
              {userRole === 'MASTER' && (
                <button
                  type="button"
                  onClick={onOpenPowerAutomate}
                  className="text-amber-400 hover:underline font-medium cursor-pointer"
                >
                  Configurar SharePoint ➔
                </button>
              )}
            </div>
          </div>
        )}

        {/* Single Thumb-Zone FAB to refocus hardware laser when idle */}
        {effectiveRound !== 'CONTEO_FINALIZADO' && !isBlockedInRound2 && !hasDataInBoxes && (
          <FloatingActionButton
            onClick={() => {
              refocusScanner();
              toast({ title: 'Láser TC26 enfocado y listo', variant: 'info', durationMs: 1800 });
            }}
            icon={<Crosshair className="w-4 h-4" />}
            label="Enfocar Láser"
          />
        )}

        {/* BOTTOM SHEET 1: CONFIRM UPLOAD */}
        <BottomSheet
          isOpen={isConfirmUploadOpen}
          onClose={() => {
            if (!isUploading) {
              setIsConfirmUploadOpen(false);
              refocusScanner();
            }
          }}
          title="Confirmar Registro en Excel"
        >
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CloudUpload className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300">
              Se enviará a SharePoint en <strong className="text-emerald-400">{roundMeta.label}</strong>
            </p>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-1.5">
              <div className="text-emerald-400 font-bold text-sm truncate">{sku}</div>
              <div className="text-slate-300 font-sans text-xs line-clamp-2">{descripcion}</div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 pt-1.5 border-t border-slate-800 text-[11px]">
                <span>Cant: <strong className="text-white">{cantidad} pzs</strong></span>
                <span>Subinv: <strong className="text-slate-200">{subinventario}</strong></span>
                <span>Loc: <strong className="text-emerald-400">{localizador}</strong></span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <TactileButton
                type="button"
                anticipation
                disabled={isUploading}
                onClick={() => handleConfirmUpload()}
                className="min-h-[48px] px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isUploading ? 'Subiendo...' : 'Sí, Subir Dato'}</span>
              </TactileButton>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setIsConfirmUploadOpen(false);
                  refocusScanner();
                }}
                className="min-h-[48px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </BottomSheet>

        {/* BOTTOM SHEET 2: CONFIRM RETRY */}
        <BottomSheet
          isOpen={isConfirmRetryOpen}
          onClose={() => {
            setIsConfirmRetryOpen(false);
            refocusScanner();
          }}
          title="Limpiar Captura Actual"
        >
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Se limpiarán los campos para volver a escanear el código QR con el láser.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TactileButton
                type="button"
                onClick={handleConfirmRetry}
                className="min-h-[48px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Sí, Reintentar</span>
              </TactileButton>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmRetryOpen(false);
                  refocusScanner();
                }}
                className="min-h-[48px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </BottomSheet>

        {/* DUPLICATE WARNING MODAL WITH SHAKE */}
        {duplicateWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <ShakeContainer shakeKey={alertShakeKey} className="max-w-md w-full">
              <div className="glass-surface-strong border-2 border-amber-500 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <Badge tone="amber">LOCALIZADOR YA ESCANEADO</Badge>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {duplicateWarning.localizador} ya fue escaneado en {duplicateWarning.round}
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold">
                    Información limpiada automáticamente para evitar duplicados en Excel.
                  </p>
                  <p className="text-xs text-slate-400">
                    Registrado a las <strong>{duplicateWarning.prevTime}</strong>
                    {duplicateWarning.operator ? <> por <strong>{duplicateWarning.operator}</strong></> : null} (SKU: {duplicateWarning.sku}).
                  </p>
                </div>
                <TactileButton
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                    refocusScanner();
                  }}
                  className="w-full min-h-[50px] py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-5 h-5" />
                  <span>Aceptar y Continuar</span>
                </TactileButton>
              </div>
            </ShakeContainer>
          </div>
        )}

        {/* INDUSTRIAL SCAN ALERT MODAL WITH SHAKE */}
        {scanAlertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <ShakeContainer shakeKey={alertShakeKey} className="max-w-md w-full">
              <div className="glass-surface-strong border-2 border-rose-500 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                  {scanAlertModal.type === 'finalized' ? (
                    <Lock className="w-7 h-7" />
                  ) : (
                    <AlertTriangle className="w-7 h-7" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Badge tone="rose">{scanAlertModal.badge}</Badge>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {scanAlertModal.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {scanAlertModal.message}
                  </p>
                  {scanAlertModal.rawSample && (
                    <div className="mt-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-left">
                      <span className="text-[10px] font-mono text-slate-500 block mb-0.5">
                        Lectura recibida:
                      </span>
                      <code className="text-[11px] font-mono text-rose-300 break-all block">
                        {scanAlertModal.rawSample}
                      </code>
                    </div>
                  )}
                </div>
                <TactileButton
                  type="button"
                  onClick={() => {
                    setScanAlertModal(null);
                    refocusScanner();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && Date.now() - alertModalOpenedAtRef.current < 400) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full min-h-[50px] py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-5 h-5" />
                  <span>Entendido</span>
                </TactileButton>
              </div>
            </ShakeContainer>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};
