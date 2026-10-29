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
import { CountRound, ScannedItem, PowerAutomateConfig, UserRole, DeviceInfo } from '../types/inventory';
import { parseInventoryQr } from '../utils/qrParser';
import { soundManager } from '../utils/audioHaptics';

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

  // Hidden buffer for Zebra TC26 laser keystroke wedge
  const [hardwareBuffer, setHardwareBuffer] = useState('');
  const hardwareInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modals
  const [isConfirmUploadOpen, setIsConfirmUploadOpen] = useState(false);
  const [isConfirmRetryOpen, setIsConfirmRetryOpen] = useState(false);

  // Duplicate Alert Modal (requires 1 button press to dismiss)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    sku: string;
    localizador: string;
    prevTime: string;
  } | null>(null);

  // Success Feedback
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Keep scanner focused on hidden hardware buffer unless a modal is open
  useEffect(() => {
    if (!isConfirmUploadOpen && !isConfirmRetryOpen && !duplicateWarning) {
      if (hardwareInputRef.current) {
        hardwareInputRef.current.focus();
      }
    }
  }, [isConfirmUploadOpen, isConfirmRetryOpen, duplicateWarning]);

  // Process scanned QR and populate the 5 text boxes
  const handleProcessBarcode = (qrString: string) => {
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

    // Populate the 5 text boxes immediately
    setSku(parsed.sku);
    setCantidad(parsed.cantidad);
    setDescripcion(parsed.descripcion);
    setSubinventario(parsed.subinventario);
    setLocalizador(parsed.localizador);
    setRawQrScanned(clean);

    // Check for duplicate in current count round
    const existingInRound = scans.filter(
      (s) => s.sku === parsed.sku && s.conteoRound === effectiveRound
    );

    if (existingInRound.length > 0) {
      soundManager.playWarning();
      setDuplicateWarning({
        sku: parsed.sku,
        localizador: parsed.localizador,
        prevTime: new Date(existingInRound[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else {
      soundManager.playSuccess();
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

  // Execute upload after confirmation
  const handleConfirmUpload = async () => {
    if (!sku || cantidad === '' || !localizador) return;

    setIsUploading(true);
    setIsConfirmUploadOpen(false);

    // El número de usuario es el que se plasma en el archivo de Excel en la columna de usuario
    const userExcelVal = deviceInfo.userNumber ? `Usuario ${deviceInfo.userNumber}` : (deviceInfo.operatorName || 'Usuario 1');

    try {
      const newItem: ScannedItem = {
        id: 'SC-' + Date.now().toString(36).toUpperCase(),
        sku: sku.trim(),
        cantidad: Number(cantidad),
        descripcion: descripcion.trim(),
        subinventario: subinventario.trim(),
        localizador: localizador.trim(),
        conteoRound: effectiveRound,
        rawQr: rawQrScanned || `${sku}_${cantidad}_${descripcion}_${subinventario}_${localizador}`,
        timestamp: new Date().toISOString(),
        operador: userExcelVal,
        nombreOperadorCompleto: deviceInfo.operatorName || operatorName,
        userNumber: deviceInfo.userNumber,
        dispositivo: deviceInfo.deviceName || 'Zebra TC26',
        syncStateSharepoint: powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl ? 'pending' : 'simulated',
      };

      await onScanComplete(newItem);

      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#10b981', '#f59e0b'],
      });

      setUploadFeedback(`✓ ${sku} (${cantidad} pzs) subido exitosamente a Excel.`);
      setTimeout(() => setUploadFeedback(null), 3000);

      // Clear the 5 text boxes for the next scan
      handleClearBoxes();
    } finally {
      setIsUploading(false);
      refocusScanner();
    }
  };

  // Clear boxes after retry confirmation
  const handleConfirmRetry = () => {
    handleClearBoxes();
    setIsConfirmRetryOpen(false);
    refocusScanner();
  };

  const handleClearBoxes = () => {
    setSku('');
    setCantidad('');
    setDescripcion('');
    setSubinventario('');
    setLocalizador('');
    setRawQrScanned('');
  };

  const refocusScanner = () => {
    setTimeout(() => {
      if (hardwareInputRef.current) {
        hardwareInputRef.current.value = '';
        hardwareInputRef.current.focus();
      }
    }, 80);
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
      {/* Hidden Buffer Input for TC26 Hardware Laser */}
      <input
        id="tc26-hidden-buffer"
        ref={hardwareInputRef}
        type="text"
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
          <button
            onClick={onOpenCheckIn || onOpenDeviceSetup}
            title={deviceInfo.isUserNumberLocked ? 'Número de usuario vinculado a este dispositivo' : 'Configurar asignación de terminal'}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-800"
          >
            {deviceInfo.userNumber ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold font-mono text-[11px] flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                <span>U{deviceInfo.userNumber}</span>
              </span>
            ) : (
              <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            
            <span className="font-bold text-white max-w-[130px] sm:max-w-[200px] truncate">
              {deviceInfo.userNumber ? `Usuario ${deviceInfo.userNumber}` : deviceInfo.deviceName}
            </span>
            {deviceInfo.operatorName && (
              <span className="text-slate-400 max-w-[110px] truncate hidden xs:inline">
                ({deviceInfo.operatorName})
              </span>
            )}
            <Edit2 className="w-3 h-3 text-slate-500 hover:text-amber-400 shrink-0" />
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

        {/* 1. SKU */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="field-sku" className="block text-xs font-semibold text-slate-300 leading-normal">
              SKU / Código del Producto:
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
            type="text"
            value={sku}
            onChange={(e) => {
              const val = e.target.value;
              if (val.split('_').length >= 5) {
                if (tryParseAndDistribute(val)) return;
              }
              setSku(val.toUpperCase());
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text && text.split('_').length >= 5) {
                if (tryParseAndDistribute(text)) {
                  e.preventDefault();
                }
              }
            }}
            placeholder="Esperando escaneo con láser..."
            className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-base sm:text-lg font-bold text-amber-400 placeholder:text-slate-600 focus:outline-none transition-colors leading-normal"
          />
        </div>

        {/* 2. Cantidad de piezas */}
        <div>
          <label htmlFor="field-cantidad" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal">
            Cantidad de Piezas:
          </label>
          <input
            id="field-cantidad"
            type="number"
            value={cantidad}
            onChange={(e) => {
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

        {/* 3. Descripción */}
        <div>
          <label htmlFor="field-descripcion" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal">
            Descripción:
          </label>
          <input
            id="field-descripcion"
            type="text"
            value={descripcion}
            onChange={(e) => {
              const val = e.target.value;
              if (val.includes('_') && val.split('_').length >= 5) {
                if (tryParseAndDistribute(val)) return;
              }
              setDescripcion(val.toUpperCase());
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text && text.split('_').length >= 5) {
                if (tryParseAndDistribute(text)) {
                  e.preventDefault();
                }
              }
            }}
            placeholder="Descripción del producto..."
            className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors leading-normal"
          />
        </div>

        {/* 4 & 5. Subinventario y Localizador */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-subinventario" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal">
              Subinventario:
            </label>
            <input
              id="field-subinventario"
              type="text"
              value={subinventario}
              onChange={(e) => {
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
            <label htmlFor="field-localizador" className="block text-xs font-semibold text-slate-300 mb-1 leading-normal">
              Localizador (Rack / Bin):
            </label>
            <input
              id="field-localizador"
              type="text"
              value={localizador}
              onChange={(e) => {
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
              placeholder="Ej. A-1-3"
              className="w-full min-h-[48px] py-2.5 px-3.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-xs sm:text-sm font-bold text-emerald-400 placeholder:text-slate-600 focus:outline-none transition-colors leading-normal"
            />
          </div>
        </div>

        {/* Action Buttons Directly Below the 5 Boxes (Spacious, glove-friendly & non-clipping) */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Button 1: Subir Información a Excel */}
          <button
            onClick={() => {
              if (hasDataInBoxes) {
                setIsConfirmUploadOpen(true);
              }
            }}
            disabled={!hasDataInBoxes || isUploading}
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
                onClick={handleConfirmUpload}
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
                CÓDIGO REPETIDO
              </div>
              <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                El SKU {duplicateWarning.sku} ya fue escaneado en esta ronda
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                Escaneado anteriormente a las <strong>{duplicateWarning.prevTime}</strong> en {duplicateWarning.localizador}.
              </p>
            </div>

            {/* SINGLE BUTTON TO CONTINUE */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setDuplicateWarning(null);
                  refocusScanner();
                }}
                className="w-full min-h-[52px] py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-sm sm:text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
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
