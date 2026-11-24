import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  User, 
  Clock, 
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  Check,
  Loader2,
  Radio,
  Wifi,
  WifiOff
} from 'lucide-react';
import { DeviceStatusSummary, CountRound, UserRole } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';

interface DeviceMonitoringPanelProps {
  devices: DeviceStatusSummary[];
  userRole?: UserRole;
  onSelectRoundFilter?: (round: CountRound | 'ALL') => void;
  onDeleteTerminalSession?: (deviceId: string) => Promise<boolean>;
  onClearAllTerminalSessions?: () => Promise<boolean>;
  onResetAllDevices?: () => Promise<void>;
  onResetSingleDevice?: (userNumber?: number, deviceId?: string) => Promise<void>;
}

export const DeviceMonitoringPanel: React.FC<DeviceMonitoringPanelProps> = ({
  devices,
  userRole,
  onDeleteTerminalSession,
  onClearAllTerminalSessions,
  onResetAllDevices,
  onResetSingleDevice,
}) => {
  const [filterRound, setFilterRound] = useState<CountRound | 'ALL'>('ALL');
  
  // 10s tick so relative times and online/offline statuses update dynamically in real time
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'all' }
    | { type: 'single'; device: DeviceStatusSummary }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reboot / Force Re-login modal state
  const [rebootTarget, setRebootTarget] = useState<
    | { type: 'all' }
    | { type: 'single'; device: DeviceStatusSummary }
    | null
  >(null);
  const [isRebooting, setIsRebooting] = useState(false);

  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Online / Inactive helper (< 60s is considered actively inside the app)
  const isDeviceOnline = (d: DeviceStatusSummary) => {
    if (!d.lastActive || d.status === 'offline') return false;
    const diffMs = Date.now() - new Date(d.lastActive).getTime();
    return diffMs >= 0 && diffMs < 60000;
  };

  const onlineCount = devices.filter(isDeviceOnline).length;
  const offlineCount = devices.length - onlineCount;

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
            setFeedbackToast('✓ Tablero de monitoreo limpiado. Los escaneos y sesiones activas permanecen intactos.');
          } else {
            soundManager.playError();
            setFeedbackToast('Error al limpiar el monitoreo en Supabase');
          }
        }
      } else {
        if (onDeleteTerminalSession) {
          const targetId = deleteTarget.device.deviceId || String(deleteTarget.device.userNumber || '');
          const ok = await onDeleteTerminalSession(targetId);
          if (ok) {
            soundManager.playSuccess();
            setFeedbackToast(`✓ Tarjeta de ${deleteTarget.device.deviceName} retirada del monitoreo (sin afectar escaneos).`);
          } else {
            soundManager.playError();
            setFeedbackToast('Error al retirar tarjeta del monitoreo');
          }
        }
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  const handleConfirmReboot = async () => {
    if (!rebootTarget) return;
    setIsRebooting(true);
    try {
      if (rebootTarget.type === 'all') {
        if (onResetAllDevices) {
          await onResetAllDevices();
          soundManager.playSuccess();
          setFeedbackToast('✓ Orden de reinicio enviada a todas las TC26. Pedirán nombre y usuario.');
        }
      } else {
        if (onResetSingleDevice) {
          await onResetSingleDevice(rebootTarget.device.userNumber, rebootTarget.device.deviceId);
          soundManager.playSuccess();
          setFeedbackToast(`✓ Orden enviada a ${rebootTarget.device.deviceName}. Pedirá nombre y usuario.`);
        }
      }
    } catch {
      soundManager.playError();
      setFeedbackToast('Error al enviar orden de reinicio');
    } finally {
      setIsRebooting(false);
      setRebootTarget(null);
      setTimeout(() => setFeedbackToast(null), 4000);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full pt-1">
          {/* Status counts & Quick round filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Online / Inactive count badges */}
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 font-bold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{onlineCount} En Línea</span>
            </span>

            {offlineCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                <span>{offlineCount} Inactivos</span>
              </span>
            )}

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* Quick Round Filters */}
            <div className="flex items-center gap-1">
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

          {/* Action Buttons: Clearly separated visually and functionally */}
          <div className="flex flex-wrap items-center gap-2">
            {onClearAllTerminalSessions && (
              <button
                onClick={() => setDeleteTarget({ type: 'all' })}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/80 hover:border-slate-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                title="Solo limpia las tarjetas visuales del tablero en vivo (no borra escaneos ni cierra sesión en las handhelds)"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpiar Monitoreo</span>
              </button>
            )}

            {onResetAllDevices && (
              <button
                onClick={() => setRebootTarget({ type: 'all' })}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap cursor-pointer"
                title="Cierra la sesión remota en todas las handhelds TC26, las regresa al 1er conteo y pide nombre y usuario de nuevo"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Forzar Re-login de Handhelds</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className="p-3 bg-slate-800/90 border border-slate-700 text-xs text-amber-300 rounded-xl flex items-center justify-between animate-in fade-in">
          <span className="font-medium">{feedbackToast}</span>
          <button onClick={() => setFeedbackToast(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Device Cards Grid */}
      {filteredDevices.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs font-mono">
          No hay terminales activas en este momento. Las handhelds aparecerán automáticamente al escanear o registrarse.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDevices.map((dev) => {
            const badge = getRoundBadge(dev.currentRound);
            const isOnline = isDeviceOnline(dev);

            return (
              <div
                key={dev.deviceId || dev.deviceName}
                className={`bg-slate-950 border rounded-2xl p-4 space-y-3 transition-all relative group ${
                  isOnline 
                    ? 'border-emerald-500/40 shadow-md shadow-emerald-950/20' 
                    : 'border-slate-800/80 hover:border-slate-700 opacity-95'
                }`}
              >
                {/* Row 1: Top Bar with User Identity & Status + Action Buttons (Spacious, Never Overlapping) */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
                  {/* User Number Badge */}
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black font-mono text-xs flex items-center gap-1.5 shadow-sm shadow-amber-500/20 shrink-0 select-none">
                    <User className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{dev.userNumber ? `Usuario ${dev.userNumber}` : 'Sin Asignar'}</span>
                  </span>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Online / Inactivo Indicator */}
                    {isOnline ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>EN LÍNEA</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        <span>INACTIVO</span>
                      </span>
                    )}

                    {/* Force Re-login button */}
                    {onResetSingleDevice && (
                      <button
                        type="button"
                        onClick={() => setRebootTarget({ type: 'single', device: dev })}
                        title={`Cerrar sesión de ${dev.userNumber ? `Usuario ${dev.userNumber}` : dev.deviceName} y pedir nombre y usuario en 1er conteo`}
                        className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-all border border-slate-800 hover:border-amber-500/30 active:scale-90"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete card from monitoring button */}
                    {onDeleteTerminalSession && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: 'single', device: dev })}
                        title={`Quitar tarjeta de ${dev.userNumber ? `Usuario ${dev.userNumber}` : dev.deviceName} del tablero (no borra escaneos)`}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all border border-slate-800 hover:border-rose-500/30 active:scale-90 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Device & Round Badge (Full Width, Never Overlapping) */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium min-w-0">
                    <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-bold text-white break-words">
                      {dev.deviceName || 'Zebra TC26'}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border flex items-center gap-1 shrink-0 ${badge.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {/* Row 3: Operator Name (Full Display, No Awkward "O|" Cut-offs) */}
                <div className="text-xs bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 space-y-0.5">
                  <span className="text-[10px] text-slate-400 block font-medium">Operador Asignado:</span>
                  <div className="text-slate-100 font-bold break-words leading-snug">
                    {dev.operatorName && dev.operatorName.trim() ? dev.operatorName : (dev.userNumber ? `Usuario ${dev.userNumber}` : 'Sin asignar')}
                  </div>
                </div>

                {/* Row 4: Metrics (Spacious 2-column Grid) */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium block">Piezas Contadas:</span>
                    <span className="text-base font-mono font-extrabold text-amber-400 block mt-0.5">
                      {dev.totalPieces.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium block">Códigos QR:</span>
                    <span className="text-base font-mono font-extrabold text-slate-200 block mt-0.5">
                      {dev.totalScans} <span className="text-xs font-normal text-slate-400">escaneos</span>
                    </span>
                  </div>
                </div>

                {/* Row 5: Status & Last Activity Info (Comfortable spacing, no clipping) */}
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono pt-1 border-t border-slate-900 text-slate-400">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {isOnline ? (
                      <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>En vivo ({formatTimeAgo(dev.lastActive)})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">
                        {formatTimeAgo(dev.lastActive)} <span className="text-slate-500 font-sans">(Cerrada)</span>
                      </span>
                    )}
                  </span>

                  {dev.lastLocator && (
                    <span className="text-slate-300 font-semibold text-[10px] bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                      Loc: <span className="text-emerald-400 font-mono font-bold">{dev.lastLocator}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE LIMPIEZA DEL TABLERO DE MONITOREO (SOLO VISUAL) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-slate-600 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative">
            <button
              onClick={() => !isDeleting && setDeleteTarget(null)}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold inline-block">
                  SOLO TABLERO VISUAL • NO BORRA ESCANEOS
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  {deleteTarget.type === 'all'
                    ? '¿Limpiar todas las tarjetas del monitoreo?'
                    : `¿Quitar tarjeta de ${deleteTarget.device.userNumber ? `Usuario ${deleteTarget.device.userNumber}` : deleteTarget.device.deviceName}?`}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {deleteTarget.type === 'all'
                    ? 'Retira las tarjetas viejas o inactivas de este panel. No borra datos de Excel/Supabase ni cierra la sesión de los operadores conectados (volverán a mostrarse automáticamente en su siguiente latido).'
                    : `Solo retira la tarjeta de monitoreo de ${deleteTarget.device.operatorName}. Sus escaneos y su sesión en la terminal continúan intactos.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[44px] px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Limpiando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Sí, Limpiar Vista</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="min-h-[44px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE FORZAR RE-LOGIN EN HANDHELDS */}
      {rebootTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative">
            <button
              onClick={() => !isRebooting && setRebootTarget(null)}
              disabled={isRebooting}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold inline-block">
                  ACCIÓN REMOTA EN HANDHELDS TC26
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  {rebootTarget.type === 'all'
                    ? '¿Forzar Re-login en todas las handhelds?'
                    : `¿Cerrar sesión remota de ${rebootTarget.device.userNumber ? `Usuario ${rebootTarget.device.userNumber}` : rebootTarget.device.deviceName}?`}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {rebootTarget.type === 'all'
                    ? 'Todas las terminales TC26 cerrarán su sesión actual, regresarán al 1er Conteo y abrirán la pantalla inicial para pedir nombre completo y número de usuario (1 al 14) de nuevo.'
                    : `La terminal de ${rebootTarget.device.operatorName} cerrará su sesión, regresará a 1er Conteo y pedirá nombre y selección de usuario nuevamente.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleConfirmReboot}
                disabled={isRebooting}
                className="min-h-[44px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isRebooting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Enviando orden...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Sí, Forzar Re-login</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setRebootTarget(null)}
                disabled={isRebooting}
                className="min-h-[44px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
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
