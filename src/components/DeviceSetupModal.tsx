import React, { useState } from 'react';
import { Smartphone, User, Check, X, Tag } from 'lucide-react';
import { DeviceInfo } from '../types/inventory';

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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !operatorName.trim()) return;

    onSave({
      ...currentInfo,
      deviceName: deviceName.trim(),
      operatorName: operatorName.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Identificación de esta Handheld TC26
            </h3>
            <p className="text-xs text-slate-400">
              Nombre asignado a este dispositivo APK y su operador
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* User Number Lock Indicator */}
          {currentInfo.userNumber ? (
            <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Número de Usuario Asignado:</span>
                <span className="text-sm font-bold font-mono text-amber-400 flex items-center gap-1.5 mt-0.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Usuario {currentInfo.userNumber}</span>
                </span>
              </div>
              {currentInfo.isUserNumberLocked ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  🔒 Vinculado al Ciclo
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-700">
                  Desbloqueado
                </span>
              )}
            </div>
          ) : null}

          <div>
            <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Nombre o Número de la Terminal (TC26):</span>
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Ej. TC26 - Terminal 01"
              className="w-full h-11 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 text-sm font-semibold text-white focus:outline-none transition-colors"
              autoFocus
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Este nombre identificará a esta terminal en SharePoint y en el panel del Master.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Nombre Completo del Operador:</span>
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Ej. Carlos Mendoza Gómez"
              className="w-full h-11 bg-slate-950 border border-slate-700 focus:border-blue-400 rounded-xl px-3.5 text-sm font-semibold text-white focus:outline-none transition-colors"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Nombre de la persona a cargo de la terminal durante esta ronda.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Asignación</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
