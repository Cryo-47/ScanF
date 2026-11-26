import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Smartphone, User, Check, X, Tag } from 'lucide-react';
import { DeviceInfo } from '../types/inventory';
import { Badge } from './ui/Controls';
import { EASE_OUT_EXPO, ShakeContainer, TactileButton } from './ui/MotionPrimitives';

interface DeviceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInfo: DeviceInfo;
  onSave: (newInfo: DeviceInfo) => void;
}

export const DeviceSetupModal: React.FC<DeviceSetupModalProps> = ({
  isOpen,
  onClose,
  currentInfo,
  onSave,
}) => {
  const [deviceName, setDeviceName] = useState(currentInfo.deviceName);
  const [operatorName, setOperatorName] = useState(currentInfo.operatorName);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [shakeCount, setShakeCount] = useState(0);

  // Always sync local form inputs when modal opens or currentInfo changes
  useEffect(() => {
    if (isOpen) {
      setDeviceName(currentInfo.deviceName);
      setOperatorName(currentInfo.operatorName);
      setInlineError(null);
    }
  }, [isOpen, currentInfo]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || operatorName.trim().length < 2) {
      setInlineError('Completa el nombre de la terminal y el nombre del operador.');
      setShakeCount((c) => c + 1);
      return;
    }

    onSave({
      ...currentInfo,
      deviceName: deviceName.trim(),
      operatorName: operatorName.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
        className="glass-surface-strong border border-slate-700/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Identificación de esta Handheld TC26
            </h3>
            <p className="text-xs text-slate-400">
              Nombre asignado a este dispositivo y su operador
            </p>
          </div>
        </div>

        <ShakeContainer shakeKey={shakeCount}>
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {currentInfo.userNumber && (
              <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/35 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Usuario Asignado:</span>
                  <span className="text-sm font-bold font-mono text-amber-400 flex items-center gap-1.5 mt-0.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Usuario {currentInfo.userNumber}</span>
                  </span>
                </div>
                <Badge tone={currentInfo.isUserNumberLocked ? 'amber' : 'neutral'}>
                  {currentInfo.isUserNumberLocked ? 'Vinculado' : 'Libre'}
                </Badge>
              </div>
            )}

            {inlineError && (
              <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl p-2.5">
                {inlineError}
              </p>
            )}

            <div>
              <label className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Nombre o Número de Terminal (TC26):</span>
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => {
                  setDeviceName(e.target.value);
                  if (inlineError) setInlineError(null);
                }}
                placeholder="Ej. TC26 - Terminal 01"
                className="w-full h-11 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 text-sm font-semibold text-white focus:outline-none transition-colors"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Nombre Completo del Operador:</span>
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => {
                  setOperatorName(e.target.value);
                  if (inlineError) setInlineError(null);
                }}
                placeholder="Ej. Carlos Mendoza Gómez"
                className="w-full h-11 bg-slate-950 border border-slate-700 focus:border-blue-400 rounded-xl px-3.5 text-sm font-semibold text-white focus:outline-none transition-colors"
                required
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <TactileButton
                type="submit"
                className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Asignación</span>
              </TactileButton>
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </ShakeContainer>
      </motion.div>
    </div>
  );
};
