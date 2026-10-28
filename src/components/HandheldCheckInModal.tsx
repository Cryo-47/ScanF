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
  Layers
} from 'lucide-react';
import { CountRound, DeviceInfo } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';

interface HandheldCheckInModalProps {
  isOpen: boolean;
  deviceInfo: DeviceInfo;
  currentRound: CountRound;
  onSaveCheckIn: (fullName: string, userNumber: number) => void;
  onConfirmNewRoundName: (fullName: string) => void;
}

export const HandheldCheckInModal: React.FC<HandheldCheckInModalProps> = ({
  isOpen,
  deviceInfo,
  currentRound,
  onSaveCheckIn,
  onConfirmNewRoundName,
}) => {
  const isAlreadyLocked = Boolean(deviceInfo.isUserNumberLocked && deviceInfo.userNumber);
  
  const [selectedUserNum, setSelectedUserNum] = useState<number | null>(deviceInfo.userNumber || null);
  const [fullName, setFullName] = useState(deviceInfo.operatorName || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

        {/* Current Round Indicator */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Ronda de Inventario Activa:</span>
          </div>
          <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
            {roundLabel(currentRound)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
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
            /* Initial User number selection 1 to 10 */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-200">
                  Elige tu Número de Usuario (del 1 al 10):
                </label>
                {selectedUserNum && (
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Seleccionado: Usuario {selectedUserNum}
                  </span>
                )}
              </div>

              {/* 10-Button Interactive Grid */}
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const isSelected = selectedUserNum === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedUserNum(num)}
                      className={`min-h-[52px] rounded-xl font-mono text-sm sm:text-base font-bold transition-all border flex flex-col items-center justify-center relative active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 scale-105'
                          : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-sans font-normal leading-none block mb-0.5">
                        User
                      </span>
                      <span>{num}</span>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-950" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explicit Lock Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-[11px] text-amber-300 leading-relaxed">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Importante:</strong> El número que elijas (1 al 10) quedará <strong>vinculado a este dispositivo</strong> y no podrá cambiarse hasta que Gerencia dé por finalizado o reinicie el ciclo completo. Este número es el que se plasmará en la columna de usuario en Excel.
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full min-h-[52px] bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm sm:text-base rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5 shrink-0" />
              <span>
                {isAlreadyLocked
                  ? `Confirmar y Continuar en ${roundLabel(currentRound)}`
                  : 'Vincular Dispositivo y Comenzar'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
