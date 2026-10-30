import React, { useState } from 'react';
import { 
  Smartphone, 
  User, 
  Clock, 
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  Check,
  Loader2
} from 'lucide-react';
import { DeviceStatusSummary, CountRound, UserRole } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';

interface DeviceMonitoringPanelProps {
  devices: DeviceStatusSummary[];
  onSelectRoundFilter?: (round: CountRound | 'ALL') => void;
  userRole?: UserRole;
  onDeleteTerminalSession?: (deviceId: string) => Promise<boolean>;
  onClearAllTerminalSessions?: () => Promise<boolean>;
}

export const DeviceMonitoringPanel: React.FC<DeviceMonitoringPanelProps> = ({
  devices,
  userRole,
  onDeleteTerminalSession,
  onClearAllTerminalSessions,
}) => {
  const [filterRound, setFilterRound] = useState<CountRound | 'ALL'>('ALL');
  
  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'all' }
    | { type: 'single'; device: DeviceStatusSummary }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const filteredDevices = devices.filter((d) => {
    if (filterRound === 'ALL') return true;
    return d.currentRound === filterRound;
  });

  const round1Count = devices.filter((d) => d.currentRound === '1ER_CONTEO').length;
  const round2Count = devices.filter((d) => d.currentRound === '2DO_CONTEO').length;
  const round3Count = devices.filter((d) => d.currentRound === '3ER_CONTEO').length;

  const getRoundBadge = (round: CountRound) => {
    if (round === '1ER_CONTEO') {
      return {
        label: '1er Conteo',
        badgeClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40',
        dotClass: 'bg-emerald-400',
      };
    }
    if (round === '2DO_CONTEO') {
      return {
        label: '2do Conteo',
        badgeClass: 'bg-blue-950/60 text-blue-400 border-blue-500/40',
        dotClass: 'bg-blue-400',
      };
    }
    if (round === '3ER_CONTEO') {
      return {
        label: '3er Conteo Extra',
        badgeClass: 'bg-amber-950/60 text-amber-400 border-amber-500/40',
        dotClass: 'bg-amber-400',
      };
    }
    return {
      label: 'Finalizado',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      dotClass: 'bg-slate-500',
    };
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Hace un momento';
      if (diffMin === 1) return 'Hace 1 min';
      if (diffMin < 60) return `Hace ${diffMin} mins`;
      const diffHrs = Math.floor(diffMin / 60);
      return `Hace ${diffHrs}h ${diffMin % 60}m`;
    } catch {
      return 'Reciente';
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === 'all') {
        if (onClearAllTerminalSessions) {
          const ok = await onClearAllTerminalSessions();
          if (ok) {
            soundManager.playSuccess();
            setFeedbackToast('Sesiones en vivo reiniciadas a 0 en Supabase');
          } else {
            soundManager.playError();
            setFeedbackToast('Error al reiniciar sesiones en Supabase');
          }
        }
      } else {
        if (onDeleteTerminalSession) {
          const targetId = deleteTarget.device.deviceId || String(deleteTarget.device.userNumber || '');
          const ok = await onDeleteTerminalSession(targetId);
          if (ok) {
            soundManager.playSuccess();
            setFeedbackToast(`Sesión de ${deleteTarget.device.deviceName} eliminada`);
          } else {
            soundManager.playError();
            setFeedbackToast('Error al eliminar sesión de la terminal');
          }
        }
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header and Live Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Control en Vivo de Terminales TC26</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-[11px] text-slate-400">
              Monitoreo de operadores y avance de rondas en tiempo real
            </p>
          </div>
        </div>

        {/* Action Controls for Gerente / Master */}
        <div className="flex items-center gap-2">
          {onClearAllTerminalSessions && (
            <button
              onClick={() => setDeleteTarget({ type: 'all' })}
              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              title="Borrar o reiniciar todas las tarjetas de sesiones de terminales en Supabase"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reiniciar Monitoreo en Vivo</span>
              <span className="sm:hidden">Reiniciar</span>
            </button>
          )}

          {/* Quick count chips */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <button
              onClick={() => setFilterRound('ALL')}
              className={`px-2 py-1 rounded-lg border transition-colors ${
                filterRound === 'ALL'
                  ? 'bg-slate-800 text-white border-slate-600 font-bold'
                  : 'text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Todos ({devices.length})
            </button>

            <button
              onClick={() => setFilterRound('1ER_CONTEO')}
              className={`px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                filterRound === '1ER_CONTEO'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold'
                  : 'text-emerald-400/80 border-emerald-950 hover:bg-emerald-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>1er ({round1Count})</span>
            </button>

            <button
              onClick={() => setFilterRound('2DO_CONTEO')}
              className={`px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                filterRound === '2DO_CONTEO'
                  ? 'bg-blue-950 text-blue-300 border-blue-500 font-bold'
                  : 'text-blue-400/80 border-blue-950 hover:bg-blue-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>2do ({round2Count})</span>
            </button>

            {round3Count > 0 && (
              <button
                onClick={() => setFilterRound('3ER_CONTEO')}
                className={`px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                  filterRound === '3ER_CONTEO'
                    ? 'bg-amber-950 text-amber-300 border-amber-500 font-bold'
                    : 'text-amber-400/80 border-amber-950 hover:bg-amber-950/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>3er ({round3Count})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className="p-2.5 bg-slate-800/90 border border-slate-700 text-xs text-amber-300 rounded-xl flex items-center justify-between animate-in fade-in">
          <span>{feedbackToast}</span>
          <button onClick={() => setFeedbackToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Device Cards Grid */}
      {filteredDevices.length === 0 ? (
        <div className="py-6 text-center text-slate-500 text-xs">
          No hay terminales activas en este momento. Las handhelds aparecerán automáticamente al escanear o registrarse.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDevices.map((dev) => {
            const badge = getRoundBadge(dev.currentRound);
            return (
              <div
                key={dev.deviceId || dev.deviceName}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition-all relative group"
              >
                {/* Device Title & Current Round Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 pr-6">
                    <div className="font-bold text-white text-xs sm:text-sm truncate flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{dev.deviceName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{dev.operatorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* High visibility round indicator */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border flex items-center gap-1 ${badge.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                      <span>{badge.label}</span>
                    </span>

                    {/* Delete button per device */}
                    {onDeleteTerminalSession && (
                      <button
                        onClick={() => setDeleteTarget({ type: 'single', device: dev })}
                        title={`Eliminar datos y sesión de ${dev.deviceName}`}
                        className="opacity-70 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Piezas Contadas:</span>
                    <span className="text-sm font-mono font-bold text-amber-400">
                      {dev.totalPieces.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Códigos QR:</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {dev.totalScans} escaneos
                    </span>
                  </div>
                </div>

                {/* Last Active info */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(dev.lastActive)}</span>
                  </span>
                  {dev.lastLocator && (
                    <span className="text-emerald-400 font-semibold truncate max-w-[120px]">
                      Loc: {dev.lastLocator}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE TERMINALES */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative">
            <button
              onClick={() => !isDeleting && setDeleteTarget(null)}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  {deleteTarget.type === 'all'
                    ? '¿Reiniciar todas las sesiones de terminales?'
                    : `¿Eliminar datos de ${deleteTarget.device.deviceName}?`}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {deleteTarget.type === 'all'
                    ? 'Se borrarán de Supabase los registros de monitoreo en vivo de todas las terminales TC26 para comenzar con contadores en cero.'
                    : `Se eliminarán los registros de monitoreo en vivo de esta terminal (${deleteTarget.device.operatorName}) en Supabase.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[44px] px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Borrando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="min-h-[44px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
