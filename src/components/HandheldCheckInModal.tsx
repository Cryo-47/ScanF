import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  User, 
  Lock, 
  Check, 
  AlertCircle, 
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Layers,
  Users,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { CountRound, DeviceInfo, DeviceStatusSummary, ScannedItem, SupabaseConfig } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';
import { fetchTerminalSessions } from '../utils/syncService';

interface HandheldCheckInModalProps {
  isOpen: boolean;
  deviceInfo: DeviceInfo;
  currentRound: CountRound;
  onSaveCheckIn: (fullName: string, userNumber: number) => void;
  onConfirmNewRoundName: (fullName: string) => void;
  cloudTerminalSessions?: DeviceStatusSummary[];
  scans?: ScannedItem[];
  supabaseConfig?: SupabaseConfig;
}

export const HandheldCheckInModal: React.FC<HandheldCheckInModalProps> = ({
  isOpen,
  deviceInfo,
  currentRound,
  onSaveCheckIn,
  onConfirmNewRoundName,
  cloudTerminalSessions = [],
  scans = [],
  supabaseConfig,
}) => {
  const isAlreadyLocked = Boolean(deviceInfo.isUserNumberLocked && deviceInfo.userNumber);
  
  const [selectedUserNum, setSelectedUserNum] = useState<number | null>(deviceInfo.userNumber || null);
  const [fullName, setFullName] = useState(deviceInfo.operatorName || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveSessions, setLiveSessions] = useState<DeviceStatusSummary[]>(cloudTerminalSessions);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Keep liveSessions synchronized with prop updates
  useEffect(() => {
    if (cloudTerminalSessions && cloudTerminalSessions.length > 0) {
      setLiveSessions(cloudTerminalSessions);
    }
  }, [cloudTerminalSessions]);

  // Fetch the latest fresh sessions from Supabase whenever the modal opens
  useEffect(() => {
    if (isOpen && supabaseConfig?.isEnabled && supabaseConfig?.url && supabaseConfig?.anonKey) {
      setIsLoadingSessions(true);
      fetchTerminalSessions(supabaseConfig)
        .then((fresh) => {
          if (Array.isArray(fresh)) {
            setLiveSessions(fresh);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingSessions(false));
    }
  }, [isOpen, supabaseConfig]);

  useEffect(() => {
    if (deviceInfo.userNumber) {
      setSelectedUserNum(deviceInfo.userNumber);
    }
    if (deviceInfo.operatorName) {
      setFullName(deviceInfo.operatorName);
    }
  }, [deviceInfo]);

  if (!isOpen) return null;

  const roundLabel = (r: CountRound) => {
    if (r === '1ER_CONTEO') return '1er Conteo';
    if (r === '2DO_CONTEO') return '2do Conteo';
    if (r === '3ER_CONTEO') return '3er Conteo Extraordinario';
    return 'Finalizado';
  };

  /**
   * Determine whether a user number (1 to 10) is already claimed by another device/handheld
   */
  const getClaimStatus = (num: number) => {
    const isCurrentDevice = Boolean(deviceInfo.userNumber === num);

    // 1. Check in live terminal sessions from Supabase
    const session = liveSessions.find(
      (s) => s.userNumber === num && s.status !== 'reset' && s.deviceId !== deviceInfo.deviceId
    );

    if (session) {
      return {
        isTaken: true,
        isCurrentDevice: false,
        operatorName: session.operatorName || 'Operador',
        deviceName: session.deviceName || 'TC26',
      };
    }

    // 2. Fallback check in scans list (in case a terminal scanned before heartbeat was logged)
    if (scans && scans.length > 0) {
      const matchingScan = scans.find(
        (s) => s.userNumber === num && 
               s.dispositivo !== deviceInfo.deviceName && 
               s.dispositivo !== deviceInfo.deviceId &&
               s.operador !== (deviceInfo.operatorName || `Usuario ${num}`)
      );
      if (matchingScan) {
        return {
          isTaken: true,
          isCurrentDevice: false,
          operatorName: matchingScan.nombreOperadorCompleto || matchingScan.operador || 'Operador',
          deviceName: matchingScan.dispositivo || 'TC26',
        };
      }
    }

    return {
      isTaken: false,
      isCurrentDevice,
    };
  };

  const allNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const availableCount = allNumbers.filter((n) => {
    const st = getClaimStatus(n);
    return !st.isTaken || st.isCurrentDevice;
  }).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 3) {
      setErrorMsg('Por favor ingresa tu nombre completo (mínimo 3 letras).');
      soundManager.playError();
      return;
    }

    if (isAlreadyLocked && deviceInfo.userNumber) {
      // Re-prompt of name when round changed
      soundManager.playSuccess();
      onConfirmNewRoundName(trimmedName);
    } else {
      // Initial check-in: require user number selection
      if (!selectedUserNum || selectedUserNum < 1 || selectedUserNum > 10) {
        setErrorMsg('Por favor selecciona tu número de usuario del 1 al 10.');
        soundManager.playError();
        return;
      }

      // Final concurrency validation: check if chosen number was taken
      const status = getClaimStatus(selectedUserNum);
      if (status.isTaken && !status.isCurrentDevice) {
        setErrorMsg(
          `El Usuario ${selectedUserNum} ya está siendo utilizado por ${status.operatorName} (${status.deviceName}). Por favor elige otro número disponible.`
        );
        soundManager.playError();
        return;
      }

      soundManager.playSuccess();
      onSaveCheckIn(trimmedName, selectedUserNum);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-5 text-slate-100 max-h-[95vh] overflow-y-auto">
        
        {/* Top Header Badge */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {isAlreadyLocked ? 'Nueva Ronda de Conteo' : 'Registro de Handheld TC26'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                  APK
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAlreadyLocked
                  ? 'Confirma tu nombre para continuar con la nueva ronda'
                  : 'Ingresa tus datos para vincular esta terminal al inventario'}
              </p>
            </div>
          </div>
        </div>

        {/* Current Round & Cloud Sync Indicator */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Ronda de Inventario:</span>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
              {roundLabel(currentRound)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            {isLoadingSessions ? (
              <span className="flex items-center gap-1 text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Verificando...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>En vivo</span>
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Nombre Completo */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-400" />
              <span>Nombre Completo del Operador:</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Juan Carlos Martínez Pérez"
              className="w-full min-h-[48px] px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm sm:text-base font-semibold text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              autoFocus
              required
            />
            <p className="text-[11px] text-slate-400">
              {isAlreadyLocked
                ? 'El nombre se solicita nuevamente en cada cambio de conteo para control de turno y auditoría.'
                : 'Tu nombre completo quedará registrado en esta sesión.'}
            </p>
          </div>

          {/* 2. Número de Usuario del 1 al 10 */}
          {isAlreadyLocked && deviceInfo.userNumber ? (
            /* User number is locked to this handheld for the entire cycle */
            <div className="p-4 bg-slate-950 rounded-2xl border-2 border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Número de Usuario Vinculado:</span>
                </span>
                <span className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold font-mono text-sm shadow-sm">
                  Usuario {deviceInfo.userNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                🔒 <strong>Vinculado a este dispositivo:</strong> Este número se mantendrá fijo durante todo el ciclo (Conteo 1, 2 y 3) y es el que se plasma en la columna de usuario de Excel en SharePoint.
              </p>
            </div>
          ) : (
            /* Initial User number selection 1 to 10 with Blocked / Claimed Indicators */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Elige tu Número de Usuario (del 1 al 10):</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  <strong className="text-emerald-400 font-bold">{availableCount}</strong> de 10 libres
                </span>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 px-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Disponible</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Seleccionado</span>
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                  <span>Ocupado (Bloqueado)</span>
                </span>
              </div>

              {/* 10-Button Interactive Grid with Real-Time Lock Status */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {allNumbers.map((num) => {
                  const status = getClaimStatus(num);
                  const isSelected = selectedUserNum === num;
                  const isBlocked = status.isTaken && !status.isCurrentDevice;

                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={isBlocked}
                      onClick={() => {
                        if (!isBlocked) {
                          setSelectedUserNum(num);
                          setErrorMsg(null);
                        }
                      }}
                      title={
                        isBlocked
                          ? `Usuario ${num} ya fue seleccionado por ${status.operatorName} (${status.deviceName})`
                          : `Seleccionar Usuario ${num}`
                      }
                      className={`min-h-[58px] p-2 rounded-xl font-mono text-sm sm:text-base font-bold transition-all border flex flex-col items-center justify-center relative select-none ${
                        isBlocked
                          ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25 scale-[1.02] cursor-pointer'
                          : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60 cursor-pointer active:scale-95'
                      }`}
                    >
                      {/* Top Status Tag */}
                      <span className="text-[10px] font-sans font-medium leading-none block mb-0.5">
                        {isBlocked ? (
                          <span className="text-rose-400/90 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Ocupado</span>
                          </span>
                        ) : status.isCurrentDevice ? (
                          <span className="text-emerald-400 font-bold">Tu Usuario</span>
                        ) : (
                          <span className="text-emerald-400">Libre</span>
                        )}
                      </span>

                      {/* User Label */}
                      <span className="leading-tight text-xs sm:text-sm">
                        Usuario {num}
                      </span>

                      {/* Operator snippet if blocked */}
                      {isBlocked && (
                        <span className="text-[9px] font-sans text-slate-400 truncate max-w-[85px] block mt-0.5 leading-none">
                          {status.operatorName}
                        </span>
                      )}

                      {/* Selected dot indicator */}
                      {isSelected && !isBlocked && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-950" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explicit Lock Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-[11px] text-amber-300 leading-relaxed mt-2">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Control de Terminal Única:</strong> Los usuarios marcados como <strong>Ocupado</strong> ya están siendo utilizados por otra handheld en el almacén. Cada handheld debe tener un número de usuario exclusivo para evitar duplicidades en SharePoint.
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full min-h-[52px] bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm sm:text-base rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5 shrink-0" />
              <span>
                {isAlreadyLocked
                  ? `Confirmar y Continuar en ${roundLabel(currentRound)}`
                  : selectedUserNum
                  ? `Vincular como Usuario ${selectedUserNum} y Comenzar`
                  : 'Vincular Dispositivo y Comenzar'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

