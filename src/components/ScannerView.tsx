import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  RotateCcw, 
  CloudUpload, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Scan, 
  ArrowRight,
  Smartphone,
  Edit2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CountRound, ScannedItem, PowerAutomateConfig, SupabaseConfig, UserRole, DeviceInfo } from '../types/inventory';
import { parseInventoryQr, isPickingFila1, canonicalizeLocator } from '../utils/qrParser';
import { soundManager } from '../utils/audioHaptics';
import { normalizeRound, generateUUID, loadAutoUploadMode, saveAutoUploadMode } from '../utils/storage';
import { checkCloudDuplicateLocalizador } from '../utils/syncService';

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
  pendingSharepointCount?: number;
  onManualRetryQueue?: () => Promise<void>;
  isRetryingQueue?: boolean;
  onOpenDeviceSetup: () => void;
  onOpenMasterAuth: () => void;
  onOpenPowerAutomate: () => void;
  onOpenCheckIn?: () => void;
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
  pendingSharepointCount = 0,
  onManualRetryQueue,
  isRetryingQueue = false,
  onOpenDeviceSetup,
  onOpenMasterAuth,
  onOpenPowerAutomate,
  onOpenCheckIn,
}) => {
  // Determine effective count round for this terminal (individual user round has priority)
  const effectiveRound: CountRound = 
    deviceInfo.userNumber && userRounds?.[deviceInfo.userNumber]
      ? userRounds[deviceInfo.userNumber]
      : countRound;
  // 5 Form Fields populated when barcode is scanned
  const [sku, setSku] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [subinventario, setSubinventario] = useState('');
  const [localizador, setLocalizador] = useState('');
  const [rawQrScanned, setRawQrScanned] = useState('');

  // Detect whether the current locator is in Fila 1 (Picking area where goods move constantly)
  const isFila1Picking = isPickingFila1(localizador);

  // Hidden buffer for Zebra TC26 laser keystroke wedge
  const [hardwareBuffer, setHardwareBuffer] = useState('');
  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modals
  const [isConfirmUploadOpen, setIsConfirmUploadOpen] = useState(false);
  const [isConfirmRetryOpen, setIsConfirmRetryOpen] = useState(false);

  // Duplicate Alert Modal (requires 1 button press to dismiss)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    sku: string;
    localizador: string;
    prevTime: string;
    operator?: string;
    round?: string;
  } | null>(null);

  // Success Feedback
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // POKA-YOKE 5: Auto-Upload Fast Mode (1.5s countdown before automatic upload)
  const [autoUploadEnabled, setAutoUploadEnabled] = useState<boolean>(() => loadAutoUploadMode());
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const autoUploadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoUploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cancelAutoUploadTimer = () => {
    if (autoUploadTimerRef.current) {
      clearTimeout(autoUploadTimerRef.current);
      autoUploadTimerRef.current = null;
    }
    if (autoUploadIntervalRef.current) {
      clearInterval(autoUploadIntervalRef.current);
      autoUploadIntervalRef.current = null;
    }
    setCountdownMs(null);
  };

  const handleToggleAutoUpload = () => {
    const next = !autoUploadEnabled;
    setAutoUploadEnabled(next);
    saveAutoUploadMode(next);
    if (!next) {
      cancelAutoUploadTimer();
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      cancelAutoUploadTimer();
    };
  }, []);

  // Keep scanner focused on SKU input when initially ready, but NEVER steal focus if user is typing
  useEffect(() => {
    if (!isConfirmUploadOpen && !isConfirmRetryOpen && !duplicateWarning) {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return;
      }
      if (!sku && skuInputRef.current) {
        skuInputRef.current.focus({ preventScroll: true });
      }
    }
  }, [isConfirmUploadOpen, isConfirmRetryOpen, duplicateWarning, sku]);

  const handleClearBoxes = () => {
    cancelAutoUploadTimer();
    setSku('');
    setCantidad('');
    setDescripcion('');
    setSubinventario('');
    setLocalizador('');
    setRawQrScanned('');
  };

  // Canonical check to ensure no duplicate LOCALIZADOR is uploaded in the active count round
  // Halts upload completely for both Supabase & Power Automate, clears boxes, and alerts the user
  const checkDuplicateLocalizador = (targetLoc: string, currentSku?: string): boolean => {
    const cleanLoc = (targetLoc || '').trim().toUpperCase();
    if (!cleanLoc) return false;

    const normalizedEffectiveRound = normalizeRound(effectiveRound);
    const canonLoc = canonicalizeLocator(cleanLoc);

    const existingInRound = scans.filter((s) => {
      if (normalizeRound(s.conteoRound) !== normalizedEffectiveRound) return false;
      const sLoc = (s.localizador || '').trim().toUpperCase();
      const sCanon = canonicalizeLocator(sLoc);
      return sLoc === cleanLoc || (canonLoc && sCanon === canonLoc);
    });

    if (existingInRound.length > 0) {
      handleClearBoxes();
      setIsConfirmUploadOpen(false);
      soundManager.playWarning();
      const match = existingInRound[0];
      setDuplicateWarning({
        sku: match.sku || currentSku || 'N/A',
        localizador: cleanLoc,
        prevTime: new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        operator: match.operador || match.nombreOperadorCompleto || 'Este dispositivo',
        round: effectiveRound === '3ER_CONTEO' ? '3er Conteo' : (effectiveRound === '2DO_CONTEO' ? '2do Conteo' : '1er Conteo'),
      });
      return true;
    }
    return false;
  };

  // Comprehensive duplicate validation: checks both local memory and Supabase Cloud
  // Halts upload, clears boxes, sounds warning, and opens modal alert if duplicate in current round
  const validateDuplicate = async (targetLoc: string, currentSku?: string): Promise<boolean> => {
    const cleanLoc = (targetLoc || '').trim();
    if (!cleanLoc) return false;

    // 1. Instant check against local scans
    if (checkDuplicateLocalizador(cleanLoc, currentSku)) {
      return true;
    }

    // 2. Real-time check against Supabase Cloud
    if (supabaseConfig?.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        const cloudCheck = await checkCloudDuplicateLocalizador(cleanLoc, effectiveRound, supabaseConfig);
        if (cloudCheck.isDuplicate) {
          handleClearBoxes();
          setIsConfirmUploadOpen(false);
          soundManager.playWarning();
          setDuplicateWarning({
            sku: cloudCheck.sku || currentSku || 'N/A',
            localizador: cleanLoc.toUpperCase(),
            prevTime: cloudCheck.prevTime || 'recientemente',
            operator: cloudCheck.operator || 'Otro dispositivo',
            round: effectiveRound === '3ER_CONTEO' ? '3er Conteo' : (effectiveRound === '2DO_CONTEO' ? '2do Conteo' : '1er Conteo'),
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
    // Dismiss any virtual soft keyboard on handheld by blurring active elements
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

  // Execute upload after confirmation or via fast auto-upload countdown
  const handleConfirmUpload = async (overrideData?: {
    sku: string;
    cantidad: number;
    descripcion: string;
    subinventario: string;
    localizador: string;
    rawQr: string;
  }) => {
    cancelAutoUploadTimer();
    const targetSku = (overrideData?.sku ?? sku).trim();
    const targetCantidad = overrideData?.cantidad ?? cantidad;
    const targetDesc = (overrideData?.descripcion ?? descripcion).trim();
    const targetSubinv = (overrideData?.subinventario ?? subinventario).trim();
    const targetLoc = (overrideData?.localizador ?? localizador).trim();
    const targetRaw = overrideData?.rawQr ?? rawQrScanned;

    if (!targetSku || targetCantidad === '' || !targetLoc) return;

    // Double check that localizador / QR was not already scanned in this round (local and Supabase Cloud)
    setIsUploading(true);
    const isDup = await validateDuplicate(targetLoc, targetSku);
    setIsUploading(false);
    if (isDup) {
      return;
    }

    // Dismiss dialog immediately to free UI
    setIsConfirmUploadOpen(false);

    // El número de usuario es el que se plasma en el archivo de Excel en la columna de usuario
    const userExcelVal = deviceInfo.userNumber ? `Usuario ${deviceInfo.userNumber}` : (deviceInfo.operatorName || 'Usuario 1');
    const isPicking = isPickingFila1(targetLoc);

    const newItem: ScannedItem = {
      id: generateUUID(),
      sku: targetSku,
      cantidad: Number(targetCantidad),
      descripcion: targetDesc || (isPicking ? 'PICKING FILA 1' : ''),
      subinventario: targetSubinv || 'LINEA',
      localizador: targetLoc,
      conteoRound: effectiveRound,
      rawQr: targetRaw || `${targetSku}_${targetCantidad}_${targetDesc || 'PICKING FILA 1'}_${targetSubinv || 'LINEA'}_${targetLoc}`,
      timestamp: new Date().toISOString(),
      operador: userExcelVal,
      nombreOperadorCompleto: deviceInfo.operatorName || operatorName,
      userNumber: deviceInfo.userNumber,
      dispositivo: deviceInfo.deviceName || 'Zebra TC26',
      syncStateSharepoint: powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl ? 'pending' : 'simulated',
    };

    const uploadedSku = targetSku;
    const uploadedQty = targetCantidad;

    // Clear boxes immediately and refocus scanner so next scan is ready in < 50ms
    handleClearBoxes();
    refocusScanner();

    confetti({
      particleCount: 20,
      spread: 40,
      origin: { y: 0.8 },
      colors: ['#10b981', '#f59e0b'],
    });

    setUploadFeedback(`✓ ${uploadedSku} (${uploadedQty} pzs) registrado. Guardando en Excel...`);
    setTimeout(() => setUploadFeedback(null), 3000);

    // Run upload without locking down UI interactions
    setIsUploading(true);
    try {
      await onScanComplete(newItem);
    } catch {
      // Background sync will update status
    } finally {
      setIsUploading(false);
      refocusScanner();
    }
  };

  // Process scanned QR and populate the 5 text boxes
  const handleProcessBarcode = (qrString: string) => {
    cancelAutoUploadTimer();
    const clean = qrString.trim();
    if (!clean) return;

    if (effectiveRound === 'CONTEO_FINALIZADO') {
      soundManager.playError();
      alert('El conteo ha sido finalizado por el Gerente. Para volver a escanear, solicita autorización de Gerencia en la vista web.');
      return;
    }

    const parsed = parseInventoryQr(clean);

    if (!parsed.isValid) {
      soundManager.playError();
      alert(parsed.error || 'Código QR no reconocido. Estructura esperada: SKU_Cantidad_Descripcion_Subinventario_Localizador');
      return;
    }

    // 1. Instant check for duplicate LOCALIZADOR in current count round (memory cache)
    if (checkDuplicateLocalizador(parsed.localizador, parsed.sku)) {
      return;
    }

    // Populate the 5 text boxes only for non-duplicated QRs
    setSku(parsed.sku);
    setCantidad(parsed.cantidad);
    setDescripcion(parsed.descripcion);
    setSubinventario(parsed.subinventario);
    setLocalizador(parsed.localizador);
    setRawQrScanned(clean);
    soundManager.playSuccess();

    // 2. Immediate asynchronous check against Supabase Cloud to catch scans just submitted by other handhelds
    if (supabaseConfig?.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      checkCloudDuplicateLocalizador(parsed.localizador, effectiveRound, supabaseConfig).then((cloudCheck) => {
        if (cloudCheck.isDuplicate) {
          cancelAutoUploadTimer();
          handleClearBoxes();
          setIsConfirmUploadOpen(false);
          soundManager.playWarning();
          setDuplicateWarning({
            sku: cloudCheck.sku || parsed.sku || 'N/A',
            localizador: parsed.localizador.trim().toUpperCase(),
            prevTime: cloudCheck.prevTime || 'recientemente',
            operator: cloudCheck.operator || 'Otro dispositivo',
            round: effectiveRound === '3ER_CONTEO' ? '3er Conteo' : (effectiveRound === '2DO_CONTEO' ? '2do Conteo' : '1er Conteo'),
          });
        }
      }).catch(() => {});
    }

    // 3. POKA-YOKE 5: Auto-upload countdown (1.5s) if auto-upload is enabled and it is NOT picking Fila 1
    const isPicking = isPickingFila1(parsed.localizador);
    if (autoUploadEnabled && !isPicking) {
      const TOTAL_MS = 1500;
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

    // Clear buffer
    setHardwareBuffer('');
    if (hardwareInputRef.current) {
      hardwareInputRef.current.value = '';
    }

    // Dismiss active input focus so virtual keyboard closes and user can review the 5 cards
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Intercept any full QR barcode payload (pasted, typed, or injected by DataWedge)
  const tryParseAndDistribute = (value: string): boolean => {
    const trimmed = (value || '').trim();
    if (!trimmed) return false;

    // Check if it has 5 or more parts separated by underscore
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

  // Global hardware scanner listener
  useEffect(() => {
    let fastBuffer = '';
    let lastKeyTime = Date.now();
    let burstTimer: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, ignore scanner keystrokes
      if (isConfirmUploadOpen || isConfirmRetryOpen || duplicateWarning) {
        return;
      }

      const target = e.target as HTMLElement;
      const isInput = target && target.tagName === 'INPUT';

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime;
      lastKeyTime = now;

      // If time between keys is large (>180ms), reset the fast burst buffer
      if (timeSinceLastKey > 180) {
        fastBuffer = '';
      }

      // If Enter key is pressed (sent by DataWedge suffix or user)
      if (e.key === 'Enter') {
        // 1. Check if the focused input element has a full QR string
        if (isInput && (target as HTMLInputElement).value) {
          const val = (target as HTMLInputElement).value;
          if (tryParseAndDistribute(val)) {
            e.preventDefault();
            e.stopPropagation();
            fastBuffer = '';
            (target as HTMLInputElement).blur();
            return;
          }
        }

        // 2. Check if our fastBuffer has a full QR string
        if (fastBuffer.length > 5) {
          if (tryParseAndDistribute(fastBuffer)) {
            e.preventDefault();
            e.stopPropagation();
            fastBuffer = '';
            if (isInput) (target as HTMLInputElement).blur();
            return;
          }
        }

        // Prevent default form submit on Enter
        if (isInput) {
          e.preventDefault();
        }
        return;
      }

      // If printable character
      if (e.key.length === 1) {
        fastBuffer += e.key;

        // Clear any existing burst timer
        if (burstTimer) {
          clearTimeout(burstTimer);
          burstTimer = null;
        }

        // Check if fastBuffer already contains 5 parts with underscores
        if (fastBuffer.includes('_') && fastBuffer.split('_').length >= 5) {
          // Debounce slightly (80ms) to allow the last segment to finish typing, then distribute
          burstTimer = setTimeout(() => {
            if (fastBuffer.split('_').length >= 5) {
              const parsed = parseInventoryQr(fastBuffer);
              if (parsed.isValid) {
                handleProcessBarcode(fastBuffer);
                fastBuffer = '';
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }
            }
          }, 80);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (burstTimer) clearTimeout(burstTimer);
    };
  }, [isConfirmUploadOpen, isConfirmRetryOpen, duplicateWarning, effectiveRound, scans]);

  // Clear boxes after retry confirmation
  const handleConfirmRetry = () => {
    handleClearBoxes();
    setIsConfirmRetryOpen(false);
    refocusScanner();
  };

  const hasDataInBoxes = Boolean(sku || cantidad !== '' || descripcion || localizador);

  const getRoundDisplay = () => {
    if (effectiveRound === '1ER_CONTEO') return { label: '1er Conteo', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40' };
    if (effectiveRound === '2DO_CONTEO') return { label: '2do Conteo (Individual)', color: 'text-blue-400 bg-blue-950/50 border-blue-500/40' };
    if (effectiveRound === '3ER_CONTEO') return { label: '3er Conteo Extraordinario', color: 'text-amber-400 bg-amber-950/50 border-amber-500/40' };
    return { label: 'Conteo Finalizado', color: 'text-rose-400 bg-rose-950/50 border-rose-500/40' };
  };

  const currentRoundDisplay = getRoundDisplay();

  const isBlockedInRound2 = 
    effectiveRound === '2DO_CONTEO' && 
    Boolean(deviceInfo.userNumber) && 
    round2Authorizations[deviceInfo.userNumber!] === false &&
    userRounds?.[deviceInfo.userNumber!] !== '2DO_CONTEO';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Hidden Buffer Input for TC26 Hardware Laser (inputMode="none" prevents soft keyboard from appearing) */}
      <input
        id="tc26-hidden-buffer"
        ref={hardwareInputRef}
        type="text"
        inputMode="none"
        tabIndex={-1}
        value={hardwareBuffer}
        onChange={(e) => {
          const val = e.target.value;
          setHardwareBuffer(val);
          if (val.split('_').length >= 5) {
            if (tryParseAndDistribute(val)) {
              setHardwareBuffer('');
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (tryParseAndDistribute(hardwareBuffer)) {
              setHardwareBuffer('');
            } else {
              handleProcessBarcode(hardwareBuffer);
            }
          }
        }}
        className="opacity-0 absolute -z-10 pointer-events-none"
        autoComplete="off"
        autoFocus
      />

      {/* Top Status Bar: Minimalist Round Indicator & Device Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Ronda:</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border whitespace-nowrap leading-none ${currentRoundDisplay.color}`}>
            {currentRoundDisplay.label}
          </span>
        </div>

        {/* Assigned Device / User Number / Operator Tag */}
        <div className="flex items-center gap-2">
          {/* Assigned Device / User Number / Operator Tag (Locked during active count) */}
          {deviceInfo.isUserNumberLocked ? (
            <div
              title="🔒 Usuario y terminal vinculados durante el ciclo. El nombre solo se modificará al pasar al 2do conteo y el usuario al finalizar todos los conteos."
              className="px-2.5 py-1 bg-slate-950 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-800 select-none shadow-sm"
            >
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold font-mono text-[11px] flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                <span>U{deviceInfo.userNumber}</span>
              </span>
              <span className="font-bold text-white max-w-[130px] sm:max-w-[200px] truncate">
                Usuario {deviceInfo.userNumber}
              </span>
              {deviceInfo.operatorName && (
                <span className="text-slate-400 max-w-[110px] truncate hidden xs:inline">
                  ({deviceInfo.operatorName})
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenCheckIn || onOpenDeviceSetup}
              title="Configurar asignación inicial de terminal"
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-800"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-white max-w-[130px] sm:max-w-[200px] truncate">
                {deviceInfo.deviceName}
              </span>
              <span className="text-amber-400 text-[11px] font-semibold">
                (Elegir Usuario)
              </span>
            </button>
          )}

          {/* POKA-YOKE 5: Auto-Upload Fast Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleAutoUpload}
            title={
              autoUploadEnabled
                ? 'Modo Rápido Activado: Sube a Excel automáticamente en 1.5s (excepto Fila 1 de picking)'
                : 'Modo Rápido Desactivado: Requiere confirmar antes de subir'
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 ${
              autoUploadEnabled
                ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
          >
            <span className={autoUploadEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}>⚡</span>
            <span className="hidden xs:inline">{autoUploadEnabled ? 'Auto-Subida' : 'Manual'}</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-700/60">
              {autoUploadEnabled ? '1.5s' : 'Off'}
            </span>
          </button>

          {userRole === 'MASTER' && (
            <button
              onClick={onOpenMasterAuth}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-amber-500/30 whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Enlaces (Master)</span>
              <span className="sm:hidden">Master</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Feedback Toast */}
      {uploadFeedback && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in leading-snug">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{uploadFeedback}</span>
          </div>
          <button onClick={() => setUploadFeedback(null)} className="text-slate-400 hover:text-white px-1">✕</button>
        </div>
      )}

      {/* POKA-YOKE 4: Offline SharePoint Sync Queue Indicator with Manual Retry */}
      {pendingSharepointCount > 0 && (
        <div className="bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-400 text-sm shrink-0">{isRetryingQueue ? '🔄' : '⏳'}</span>
            <div className="truncate text-left">
              <span className="font-bold text-white">{pendingSharepointCount}</span>{' '}
              <span>{pendingSharepointCount === 1 ? 'registro pendiente' : 'registros pendientes'} en cola de envío a Excel</span>
              <span className="text-slate-400 text-[10px] block sm:inline sm:ml-1 font-mono">
                (auto-reintento silencioso)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onManualRetryQueue?.()}
            disabled={isRetryingQueue}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-lg transition-all shrink-0 ml-1 disabled:opacity-50 flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <span>{isRetryingQueue ? 'Subiendo...' : 'Reintentar'}</span>
          </button>
        </div>
      )}

      {/* 2DO CONTEO BLOCKED SCREEN (WHEN USER IS NOT AUTHORIZED BY GERENTE) */}
      {isBlockedInRound2 ? (
        <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold inline-block">
              USUARIO EN ESPERA DE ASIGNACIÓN
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Usuario {deviceInfo.userNumber}: No Habilitado para 2do Conteo
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              El <strong>Gerente</strong> no ha asignado a este usuario para continuar en el segundo conteo de inventario.
              Por favor espera indicaciones de tu supervisor o solicita a Gerencia que habilite al <strong>Usuario {deviceInfo.userNumber}</strong> desde su pantalla de control.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 font-mono max-w-sm mx-auto flex items-center justify-between">
            <span>Operador: <strong className="text-white">{deviceInfo.operatorName || 'Sin asignar'}</strong></span>
            <span>Terminal: <strong className="text-white">{deviceInfo.deviceName}</strong></span>
          </div>
        </div>
      ) : (
        /* Main Container: 5 Clean Text Boxes with Non-Clipping Typography */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          
          {/* Helper prompt */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
            <span className="text-slate-200 font-bold uppercase tracking-wider text-[11px] sm:text-xs">
              Datos del Código QR Escaneado
            </span>
            <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">
              {hasDataInBoxes ? 'Código cargado' : 'Apunta el láser de la TC26'}
            </span>
          </div>

          {/* Helper banner when Fila 1 Picking is detected */}
          {isFila1Picking && (
            <div className="p-3 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-300 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📦</span>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Ubicación de Picking Detectada: Fila 1 ({localizador.trim()})</span>
                  </div>
                  <span className="text-[11px] text-amber-200/90 leading-tight block mt-0.5">
                    En Fila 1 los productos se mueven constantemente. Auto-subida pausada para verificación física; la casilla de <strong>SKU</strong> está desbloqueada.
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shrink-0 shadow-sm">
                Fila 1 (Picking)
              </span>
            </div>
          )}

          {/* POKA-YOKE 5: Active Countdown Progress Bar */}
          {countdownMs !== null && (
            <div className="p-3.5 bg-emerald-950/80 border-2 border-emerald-500 rounded-xl space-y-2 animate-in fade-in shadow-lg shadow-emerald-950/50">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <span className="animate-pulse text-base">⚡</span>
                  <span>Subiendo automáticamente a Excel en <strong className="text-white font-mono text-sm">{(countdownMs / 1000).toFixed(1)}s</strong>...</span>
                </div>
                <button
                  type="button"
                  onClick={cancelAutoUploadTimer}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-rose-300 hover:text-white rounded-lg text-xs font-bold border border-rose-500/50 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <span>✕ Cancelar</span>
                </button>
              </div>
              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-emerald-500/30">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-amber-400 h-full transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, ((1500 - countdownMs) / 1500) * 100))}%` }}
                />
              </div>
            </div>
          )}

        {/* 1. SKU (Seleccionable para escaneo; se bloquea al capturar QR, pero se habilita automáticamente si es Fila 1 de picking) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="field-sku" className="block text-xs font-semibold text-slate-300 leading-normal flex items-center gap-1.5">
              <span>SKU / Código del Producto:</span>
              {isFila1Picking ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-1 animate-pulse">
                  <span>📦</span>
                  <span>Fila 1 (Picking): SKU Editable</span>
                </span>
              ) : hasDataInBoxes ? (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  🔒 Bloqueado
                </span>
              ) : (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                  🎯 Listo para Escaneo
                </span>
              )}
            </label>
            {sku.includes('_') && (
              <button
                type="button"
                onClick={() => tryParseAndDistribute(sku)}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/40 active:scale-95 transition-all animate-pulse flex items-center gap-1"
              >
                <span>⚡</span>
                <span>Desglosar QR ({sku.split('_').length} partes)</span>
              </button>
            )}
          </div>
          <input
            id="field-sku"
            ref={skuInputRef}
            type="text"
            readOnly={hasDataInBoxes && !isFila1Picking}
            tabIndex={hasDataInBoxes && !isFila1Picking ? -1 : 0}
            inputMode={isFila1Picking ? "text" : "none"}
            value={sku}
            onChange={(e) => {
              cancelAutoUploadTimer();
              const val = e.target.value;
              if (val.split('_').length >= 5) {
                if (tryParseAndDistribute(val)) return;
              }
              setSku(val.toUpperCase());
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
                const targetVal = (e.target as HTMLInputElement).value;
                if (targetVal.split('_').length >= 5) {
                  tryParseAndDistribute(targetVal);
                }
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text && text.split('_').length >= 5) {
                if (tryParseAndDistribute(text)) {
                  e.preventDefault();
                }
              }
            }}
            placeholder={
              isFila1Picking
                ? 'Escribe el SKU del producto de picking (ej. C0520-00)...'
                : hasDataInBoxes
                ? 'Código cargado'
                : 'Toca aquí o apunta el láser de la TC26...'
            }
            className={`w-full min-h-[48px] py-2.5 px-3.5 rounded-xl font-mono text-base sm:text-lg font-bold placeholder:text-slate-500 focus:outline-none transition-all leading-normal ${
              isFila1Picking
                ? 'bg-slate-950 border-2 border-amber-400 text-amber-300 focus:ring-2 focus:ring-amber-500/20 cursor-text shadow-sm shadow-amber-500/10'
                : hasDataInBoxes
                ? 'bg-slate-900/70 border border-slate-700/80 cursor-default select-none pointer-events-none text-amber-400'
                : 'bg-slate-950 border-2 border-amber-500/70 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 cursor-text shadow-sm shadow-amber-500/10 text-amber-400'
            }`}
          />
        </div>

        {/* 2. Cantidad de piezas (Habilitada para edición si requiere ajuste) */}
        <div>
          <label htmlFor="field-cantidad" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal flex items-center justify-between">
            <span>Cantidad de Piezas:</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">✏️ Editable</span>
          </label>
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
                if (tryParseAndDistribute(text)) {
                  e.preventDefault();
                }
              }
            }}
            placeholder="0"
            className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-base sm:text-lg font-bold text-white placeholder:text-slate-600 focus:outline-none transition-colors leading-normal"
          />
        </div>

        {/* 3. Descripción (Bloqueada contra edición manual) */}
        <div>
          <label htmlFor="field-descripcion" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal flex items-center gap-1.5">
            <span>Descripción:</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">🔒 Bloqueado</span>
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
            className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-900/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 placeholder:text-slate-600 focus:outline-none select-none cursor-default leading-normal pointer-events-none"
          />
        </div>

        {/* 4 & 5. Subinventario y Localizador */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-subinventario" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal flex items-center justify-between">
              <span>Subinventario:</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">✏️ Editable</span>
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
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text && text.split('_').length >= 5) {
                  if (tryParseAndDistribute(text)) {
                    e.preventDefault();
                  }
                }
              }}
              placeholder="Ej. LINEA"
              className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors leading-normal"
            />
          </div>

          <div>
            <label htmlFor="field-localizador" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal flex items-center justify-between">
              <span>Localizador (Rack / Bin):</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">✏️ Editable</span>
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
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text && text.split('_').length >= 5) {
                  if (tryParseAndDistribute(text)) {
                    e.preventDefault();
                  }
                }
              }}
              onBlur={async (e) => {
                const val = e.target.value.trim();
                if (val) {
                  await validateDuplicate(val, sku);
                }
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const targetVal = (e.target as HTMLInputElement).value.trim();
                  if (targetVal) {
                    await validateDuplicate(targetVal, sku);
                  }
                }
              }}
              placeholder="Ej. A-22-1"
              className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-xs sm:text-sm font-bold text-emerald-400 placeholder:text-slate-600 focus:outline-none transition-colors leading-normal"
            />
          </div>
        </div>

        {/* Action Buttons Directly Below the 5 Boxes (Spacious, glove-friendly & non-clipping) */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Button 1: Subir Información a Excel */}
          <button
            onClick={async () => {
              if (hasDataInBoxes) {
                // Verify duplicate locally and in cloud for manual entry or scanned item
                setIsUploading(true);
                const isDup = await validateDuplicate(localizador, sku);
                setIsUploading(false);
                if (isDup) {
                  return;
                }
                setIsConfirmUploadOpen(true);
              }
            }}
            disabled={!hasDataInBoxes}
            className={`w-full min-h-[56px] py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-[0.98] leading-tight ${
              hasDataInBoxes
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <CloudUpload className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">Subir Información a Excel</span>
          </button>

          {/* Button 2: Reintentar */}
          <button
            onClick={() => {
              if (hasDataInBoxes) {
                setIsConfirmRetryOpen(true);
              } else {
                refocusScanner();
              }
            }}
            disabled={!hasDataInBoxes}
            className={`w-full min-h-[56px] py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] border leading-tight ${
              hasDataInBoxes
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/40 hover:border-amber-400 cursor-pointer'
                : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
            }`}
          >
            <RotateCcw className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">Reintentar</span>
          </button>
        </div>

        {/* Bottom Connection Status / Master Link */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-slate-500">
          <span className="text-slate-500 text-left">
            {powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl ? '✓ Conexión SharePoint Activa' : 'Modo Registro'}
          </span>

          {userRole === 'MASTER' && (
            <button
              onClick={onOpenPowerAutomate}
              className="text-amber-400 hover:underline transition-colors font-medium text-left sm:text-right"
            >
              Configurar Enlace SharePoint ➔
            </button>
          )}
        </div>
      </div>
      )}

      {/* CONFIRMATION RECUADRO 1: SUBIR A EXCEL (EMERALD / GREEN COLOR) */}
      {isConfirmUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shrink-0">
              <CloudUpload className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug px-2">
                ¿Estás seguro de subir esta información al archivo de Excel?
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                Se registrará en SharePoint en la ronda <strong className="text-emerald-400 font-semibold">{currentRoundDisplay.label}</strong>
              </p>
            </div>

            {/* Scanned Summary Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-1.5">
              <div className="text-emerald-400 font-bold text-sm truncate">{sku}</div>
              <div className="text-slate-300 font-sans text-xs line-clamp-2 leading-relaxed">{descripcion}</div>
              <div className="flex flex-wrap items-center justify-between gap-1 text-slate-400 pt-1.5 border-t border-slate-800/80 text-[11px]">
                <span>Cant: <strong className="text-white font-bold">{cantidad} piezas</strong></span>
                <span>Subinv: <strong className="text-slate-200">{subinventario}</strong></span>
                <span>Loc: <strong className="text-emerald-400 font-bold">{localizador}</strong></span>
              </div>
            </div>

            {/* Modal Action Buttons with Roomy Spacing */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleConfirmUpload()}
                disabled={isUploading}
                className="min-h-[48px] px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap"
                autoFocus
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{isUploading ? 'Subiendo...' : 'Sí, Subir Dato'}</span>
              </button>

              <button
                onClick={() => {
                  setIsConfirmUploadOpen(false);
                  refocusScanner();
                }}
                disabled={isUploading}
                className="min-h-[48px] px-3 sm:px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION RECUADRO 2: REINTENTAR (AMBER / WARNING COLOR) */}
      {isConfirmRetryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shrink-0">
              <RotateCcw className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug px-2">
                ¿Estás seguro de que deseas reintentar?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed px-2">
                Se limpiarán los cuadros de texto para que puedas volver a escanear el código QR con el láser.
              </p>
            </div>

            {/* Modal Action Buttons with Roomy Spacing */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleConfirmRetry}
                className="min-h-[48px] px-3 sm:px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap"
                autoFocus
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>Sí, Reintentar</span>
              </button>

              <button
                onClick={() => {
                  setIsConfirmRetryOpen(false);
                  refocusScanner();
                }}
                className="min-h-[48px] px-3 sm:px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPEATED QR ALERT (REQUIRES 1 BUTTON TO DISMISS) */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[11px] font-bold inline-block mb-1">
                LOCALIZADOR YA ESCANEADO EN ESTA RONDA
              </div>
              <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                El Localizador {duplicateWarning.localizador} ya fue escaneado en {duplicateWarning.round || 'esta ronda'}
              </h3>
              <p className="text-xs text-amber-300 font-semibold leading-relaxed">
                ¡Información eliminada automáticamente de los cuadros para evitar duplicados en Excel y Supabase!
              </p>
              <p className="text-xs text-slate-400 leading-normal">
                Ubicación registrada previamente a las <strong>{duplicateWarning.prevTime}</strong>
                {duplicateWarning.operator ? <> por <strong>{duplicateWarning.operator}</strong></> : null} (SKU: {duplicateWarning.sku}).
              </p>
            </div>

            {/* SINGLE BUTTON TO CONTINUE */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setDuplicateWarning(null);
                  refocusScanner();
                }}
                className="w-full min-h-[52px] py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-sm sm:text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                autoFocus
              >
                <Check className="w-5 h-5 shrink-0" />
                <span>Aceptar y Continuar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
