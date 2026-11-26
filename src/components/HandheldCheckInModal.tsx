import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Smartphone,
  User,
  Lock,
  Check,
  AlertCircle,
  ShieldAlert,
  Layers,
  Users,
  Loader2,
} from 'lucide-react';
import { CountRound, DeviceInfo, DeviceStatusSummary, ScannedItem, SupabaseConfig } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';
import { fetchTerminalSessions } from '../utils/syncService';
import { Badge, Skeleton } from './ui/Controls';
import { EASE_OUT_EXPO, ShakeContainer, TactileButton } from './ui/MotionPrimitives';

interface HandheldCheckInModalProps {
  isOpen: boolean;
  deviceInfo: DeviceInfo;
  currentRound: CountRound;
  onSaveCheckIn: (fullName: string, userNumber: number) => void;
  onConfirmNewRoundName: (fullName: string) => void;
  cloudTerminalSessions?: DeviceStatusSummary[];
  scans?: ScannedItem[];
  supabaseConfig?: SupabaseConfig;
  rebootNotice?: string | null;
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
  rebootNotice,
}) => {
  const isAlreadyLocked = Boolean(!rebootNotice && deviceInfo.isUserNumberLocked && deviceInfo.userNumber);

  const [selectedUserNum, setSelectedUserNum] = useState<number | null>(
    rebootNotice ? null : deviceInfo.userNumber || null
  );
  const [fullName, setFullName] = useState(rebootNotice ? '' : deviceInfo.operatorName || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [liveSessions, setLiveSessions] = useState<DeviceStatusSummary[]>(cloudTerminalSessions);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Sync modal fields cleanly when opened or rebootNotice arrives
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (rebootNotice) {
      setSelectedUserNum(null);
      setFullName('');
    } else {
      setSelectedUserNum(deviceInfo.userNumber || null);
      setFullName(deviceInfo.operatorName || '');
    }
  }, [isOpen, rebootNotice, deviceInfo.userNumber, deviceInfo.operatorName]);

  // Keep liveSessions synchronized with prop updates
  useEffect(() => {
    if (cloudTerminalSessions && cloudTerminalSessions.length > 0) {
      setLiveSessions(cloudTerminalSessions);
    }
  }, [cloudTerminalSessions]);

  // Fetch fresh sessions whenever modal opens
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

  if (!isOpen) return null;

  const roundLabel = (r: CountRound) => {
    if (r === '1ER_CONTEO') return '1er Conteo';
    if (r === '2DO_CONTEO') return '2do Conteo';
    if (r === '3ER_CONTEO') return '3er Conteo Extraordinario';
    return 'Finalizado';
  };

  /**
   * Determine whether a user number (1 to 14) is already claimed by another device/handheld
   */
  const getClaimStatus = (num: number) => {
    const isCurrentDevice = Boolean(deviceInfo.userNumber === num && !rebootNotice);

    // 1. Check live terminal sessions from Supabase
    const session = liveSessions.find(
      (s) =>
        s.userNumber === num &&
        s.status !== 'reset' &&
        s.status !== 'force_relogin' &&
        s.status !== 'offline' &&
        s.deviceId !== deviceInfo.deviceId
    );

    if (session) {
      return {
        isTaken: true,
        isCurrentDevice: false,
        operatorName: session.operatorName || 'Operador',
        deviceName: session.deviceName || 'TC26',
      };
    }

    // 2. Fallback check in recent scans (< 12h) ONLY if liveSessions has no entry for this userNumber
    const hasSessionRecord = liveSessions.some((s) => s.userNumber === num);
    if (!hasSessionRecord && scans && scans.length > 0) {
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      const matchingScan = scans.find((s) => {
        if (s.userNumber !== num) return false;
        const ts = new Date(s.timestamp).getTime();
        if (!isNaN(ts) && ts < twelveHoursAgo) return false;
        const isSameDevice =
          s.dispositivo === deviceInfo.deviceName || s.dispositivo === deviceInfo.deviceId;
        return !isSameDevice;
      });
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

  const allNumbers = Array.from({ length: 14 }, (_, i) => i + 1);
  const availableCount = allNumbers.filter((n) => {
    const st = getClaimStatus(n);
    return !st.isTaken || st.isCurrentDevice;
  }).length;

  const trimmedName = fullName.trim();
  const isNameValid = trimmedName.length >= 3;

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShakeTrigger((c) => c + 1);
    soundManager.playError();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isNameValid) {
      triggerError('Por favor ingresa tu nombre completo (mínimo 3 letras).');
      return;
    }

    if (isAlreadyLocked && deviceInfo.userNumber) {
      soundManager.playSuccess();
      onConfirmNewRoundName(trimmedName);
    } else {
      if (!selectedUserNum || selectedUserNum < 1 || selectedUserNum > 14) {
        triggerError('Por favor selecciona tu número de usuario del 1 al 14.');
        return;
      }

      const status = getClaimStatus(selectedUserNum);
      if (status.isTaken && !status.isCurrentDevice) {
        triggerError(
          `El Usuario ${selectedUserNum} ya está siendo utilizado por ${status.operatorName} (${status.deviceName}). Elige otro número disponible.`
        );
        return;
      }

      soundManager.playSuccess();
      onSaveCheckIn(trimmedName, selectedUserNum);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
        className="glass-surface-strong border-2 border-amber-500/75 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100 max-h-[94vh] overflow-y-auto"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {isAlreadyLocked ? 'Nueva Ronda de Conteo' : 'Registro de Handheld TC26'}
                </h2>
                <Badge tone="amber">APK</Badge>
              </div>
              <p className="text-xs text-slate-400">
                {isAlreadyLocked
                  ? 'Confirma tu nombre para continuar con la nueva ronda'
                  : 'Vincula tu nombre y usuario único del 1 al 14'}
              </p>
            </div>
          </div>
        </div>

        {/* Gerencia Remote Reboot Notice Banner */}
        {rebootNotice && (
          <div className="p-3.5 bg-amber-950/75 border border-amber-500/60 rounded-2xl flex items-start gap-3 text-amber-200 text-xs shadow-lg">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300 text-sm">Dispositivo Reiniciado por Gerencia</div>
              <p className="text-amber-200/90 leading-relaxed text-[11px]">{rebootNotice}</p>
            </div>
          </div>
        )}

        {/* Current Round & Cloud Sync Indicator */}
        <div className="bg-slate-950/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-400">Ronda:</span>
            <Badge tone="emerald">{roundLabel(currentRound)}</Badge>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {isLoadingSessions ? (
              <span className="flex items-center gap-1 text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Verificando...</span>
              </span>
            ) : (
              <Badge tone="emerald" dot pulse>
                En vivo
              </Badge>
            )}
          </div>
        </div>

        <ShakeContainer shakeKey={shakeTrigger}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Nombre Completo with Inline Validation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Nombre Completo del Operador:</span>
                </label>
                {fullName.length > 0 && (
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      isNameValid ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isNameValid ? '✓ Válido' : 'Mín. 3 letras'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ej. Juan Carlos Martínez Pérez"
                className={`w-full min-h-[48px] px-4 py-2.5 bg-slate-950 border rounded-xl text-sm sm:text-base font-semibold text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
                  fullName.length > 0 && !isNameValid
                    ? 'border-amber-500/70'
                    : isNameValid
                    ? 'border-emerald-500/60'
                    : 'border-slate-700 focus:border-amber-400'
                }`}
                autoFocus
                required
              />
            </div>

            {/* 2. Número de Usuario del 1 al 14 */}
            {isAlreadyLocked && deviceInfo.userNumber ? (
              <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Número Vinculado:</span>
                  </span>
                  <Badge tone="emerald">Usuario {deviceInfo.userNumber}</Badge>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Vinculado a esta terminal durante todo el ciclo (Conteo 1, 2 y 3) para su registro en SharePoint Excel.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Elige tu Número de Usuario (1–14):</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    <strong className="text-emerald-400 font-bold">{availableCount}</strong> de 14 libres
                  </span>
                </div>

                {isLoadingSessions && liveSessions.length === 0 ? (
                  <div className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-7 gap-2 pt-1">
                    {allNumbers.map((n) => (
                      <Skeleton key={n} className="h-[58px] w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-7 gap-2 pt-1">
                    {allNumbers.map((num) => {
                      const status = getClaimStatus(num);
                      const isSelected = selectedUserNum === num;
                      const isBlocked = status.isTaken && !status.isCurrentDevice;

                      return (
                        <motion.button
                          key={num}
                          type="button"
                          disabled={isBlocked}
                          whileTap={isBlocked ? undefined : { scale: 0.94 }}
                          onClick={() => {
                            if (!isBlocked) {
                              setSelectedUserNum(num);
                              setErrorMsg(null);
                            }
                          }}
                          title={
                            isBlocked
                              ? `Usuario ${num} ocupado por ${status.operatorName} (${status.deviceName})`
                              : `Seleccionar Usuario ${num}`
                          }
                          className={`min-h-[58px] p-2 rounded-xl font-mono text-sm font-bold transition-all border flex flex-col items-center justify-center relative select-none ${
                            isBlocked
                              ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                              : isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/25 cursor-pointer'
                              : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60 cursor-pointer'
                          }`}
                        >
                          <span className="text-[10px] font-sans font-medium leading-none block mb-0.5">
                            {isBlocked ? (
                              <span className="text-rose-400 flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Ocupado</span>
                              </span>
                            ) : status.isCurrentDevice ? (
                              <span className={isSelected ? 'text-slate-900 font-bold' : 'text-emerald-400 font-bold'}>
                                Tuyo
                              </span>
                            ) : (
                              <span className={isSelected ? 'text-slate-900 font-bold' : 'text-emerald-400'}>
                                Libre
                              </span>
                            )}
                          </span>

                          <span className="leading-tight text-xs">U{num}</span>

                          {isBlocked && (
                            <span className="text-[9px] font-sans text-slate-400 block mt-0.5 line-clamp-1 px-0.5">
                              {status.operatorName}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <TactileButton
              type="submit"
              anticipation
              className="w-full min-h-[52px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm sm:text-base rounded-2xl transition-colors shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5 shrink-0" />
              <span>
                {isAlreadyLocked
                  ? `Confirmar y Continuar en ${roundLabel(currentRound)}`
                  : selectedUserNum
                  ? `Vincular como Usuario ${selectedUserNum} y Comenzar`
                  : 'Vincular Dispositivo y Comenzar'}
              </span>
            </TactileButton>
          </form>
        </ShakeContainer>
      </motion.div>
    </div>
  );
};
