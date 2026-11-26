import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone,
  User,
  Clock,
  Trash2,
  RotateCcw,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { DeviceStatusSummary, CountRound, UserRole } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';
import { Badge, EmptyState, Tabs, Tooltip, TabItem } from './ui/Controls';
import {
  EASE_OUT_EXPO,
  StaggerItem,
  StaggerList,
  TactileButton,
} from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

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
  onDeleteTerminalSession,
  onClearAllTerminalSessions,
  onResetAllDevices,
  onResetSingleDevice,
}) => {
  const { toast } = useToast();
  const [filterRound, setFilterRound] = useState<CountRound | 'ALL'>('ALL');

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'all' }
    | { type: 'single'; device: DeviceStatusSummary }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [rebootTarget, setRebootTarget] = useState<
    | { type: 'all' }
    | { type: 'single'; device: DeviceStatusSummary }
    | null
  >(null);
  const [isRebooting, setIsRebooting] = useState(false);

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

  const roundTabs: TabItem<CountRound | 'ALL'>[] = [
    { id: 'ALL', label: 'Todas', badge: devices.length },
    { id: '1ER_CONTEO', label: '1er Conteo', badge: round1Count },
    { id: '2DO_CONTEO', label: '2do Conteo', badge: round2Count },
    ...(round3Count > 0
      ? [{ id: '3ER_CONTEO' as const, label: '3er Conteo', badge: round3Count }]
      : []),
  ];

  const getRoundBadge = (round: CountRound) => {
    if (round === '1ER_CONTEO') return { label: '1er Conteo', tone: 'emerald' as const };
    if (round === '2DO_CONTEO') return { label: '2do Conteo', tone: 'blue' as const };
    if (round === '3ER_CONTEO') return { label: '3er Conteo Extra', tone: 'amber' as const };
    return { label: 'Finalizado', tone: 'neutral' as const };
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
            toast({
              variant: 'success',
              title: 'Tablero de monitoreo limpiado',
              description: 'Los escaneos y sesiones activas permanecen intactos.',
            });
          } else {
            soundManager.playError();
            toast({
              variant: 'error',
              title: 'Error al limpiar el monitoreo en Supabase',
            });
          }
        }
      } else if (onDeleteTerminalSession) {
        const targetId = deleteTarget.device.deviceId || String(deleteTarget.device.userNumber || '');
        const ok = await onDeleteTerminalSession(targetId);
        if (ok) {
          soundManager.playSuccess();
          toast({
            variant: 'success',
            title: `Tarjeta de ${deleteTarget.device.deviceName} retirada`,
            description: 'Los escaneos capturados siguen intactos.',
          });
        } else {
          soundManager.playError();
          toast({ variant: 'error', title: 'Error al retirar tarjeta del monitoreo' });
        }
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
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
          toast({
            variant: 'warning',
            title: 'Orden de re-login enviada a todas las TC26',
            description: 'Las terminales solicitarán nombre y número de usuario.',
          });
        }
      } else if (onResetSingleDevice) {
        await onResetSingleDevice(rebootTarget.device.userNumber, rebootTarget.device.deviceId);
        soundManager.playSuccess();
        toast({
          variant: 'warning',
          title: `Orden enviada a ${rebootTarget.device.deviceName}`,
          description: 'Pedirá nombre y usuario nuevamente.',
        });
      }
    } catch {
      soundManager.playError();
      toast({ variant: 'error', title: 'Error al enviar orden de reinicio' });
    } finally {
      setIsRebooting(false);
      setRebootTarget(null);
    }
  };

  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5 border border-slate-800/90 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Control en Vivo de Terminales TC26
              </h3>
              <Badge tone="emerald" dot pulse={onlineCount > 0}>
                {onlineCount} En Línea
              </Badge>
              {offlineCount > 0 && <Badge tone="neutral">{offlineCount} Inactivos</Badge>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoreo de operadores y avance de rondas en tiempo real
            </p>
          </div>
        </div>

        {/* Clearly separated Poka-Yoke Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onClearAllTerminalSessions && (
            <Tooltip content="Solo retira tarjetas visuales del tablero; no borra escaneos ni cierra sesión">
              <TactileButton
                type="button"
                onClick={() => setDeleteTarget({ type: 'all' })}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpiar Monitoreo</span>
              </TactileButton>
            </Tooltip>
          )}

          {onResetAllDevices && (
            <Tooltip content="Cierra sesión remota en todas las TC26, vuelve a 1er Conteo y pide usuario">
              <TactileButton
                anticipation
                type="button"
                onClick={() => setRebootTarget({ type: 'all' })}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Forzar Re-login de Handhelds</span>
              </TactileButton>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Shared-element Round Filter Tabs */}
      <Tabs
        items={roundTabs}
        value={filterRound}
        onChange={setFilterRound}
        layoutGroup="monitoring-filter"
      />

      {/* Device Cards Grid or EmptyState */}
      {filteredDevices.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="w-5 h-5" />}
          title="No hay terminales en esta vista"
          description="Las handhelds Zebra TC26 aparecerán automáticamente cuando un operador inicie sesión o capture un código QR."
        />
      ) : (
        <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDevices.map((dev) => {
            const badge = getRoundBadge(dev.currentRound);
            const isOnline = isDeviceOnline(dev);

            return (
              <StaggerItem key={dev.deviceId || dev.deviceName}>
                <div
                  className={`h-full bg-slate-950/85 border rounded-2xl p-4 space-y-3 transition-colors ${
                    isOnline
                      ? 'border-emerald-500/45 shadow-md shadow-emerald-950/20'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black font-mono text-xs flex items-center gap-1.5 shrink-0 select-none">
                      <User className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{dev.userNumber ? `Usuario ${dev.userNumber}` : 'Sin Asignar'}</span>
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOnline ? (
                        <Badge tone="emerald" dot pulse>
                          EN LÍNEA
                        </Badge>
                      ) : (
                        <Badge tone="neutral" dot>
                          INACTIVO
                        </Badge>
                      )}

                      {onResetSingleDevice && (
                        <Tooltip content="Forzar re-login remoto en esta terminal">
                          <button
                            type="button"
                            onClick={() => setRebootTarget({ type: 'single', device: dev })}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg border border-slate-800 hover:border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}

                      {onDeleteTerminalSession && (
                        <Tooltip content="Quitar tarjeta del tablero visual (no borra escaneos)">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'single', device: dev })}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-800 hover:border-rose-500/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {/* Device & Round */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-200 font-bold min-w-0">
                      <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{dev.deviceName || 'Zebra TC26'}</span>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>

                  {/* Operator Name */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                      Operador Asignado
                    </span>
                    <div className="text-slate-100 font-bold text-xs truncate mt-0.5">
                      {dev.operatorName && dev.operatorName.trim()
                        ? dev.operatorName
                        : dev.userNumber
                        ? `Usuario ${dev.userNumber}`
                        : 'Sin asignar'}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Piezas Contadas</span>
                      <span className="text-base font-mono font-extrabold text-amber-400 tabular-nums">
                        {dev.totalPieces.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Códigos QR</span>
                      <span className="text-base font-mono font-extrabold text-slate-200 tabular-nums">
                        {dev.totalScans}{' '}
                        <span className="text-[11px] font-normal text-slate-400 font-sans">
                          escaneos
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono pt-2 border-t border-slate-800/70 text-slate-400">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {isOnline ? (
                        <span className="text-emerald-400 font-semibold text-[10px]">
                          En vivo ({formatTimeAgo(dev.lastActive)})
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">
                          {formatTimeAgo(dev.lastActive)} (Cerrada)
                        </span>
                      )}
                    </span>

                    {dev.lastLocator && (
                      <span className="text-slate-300 font-semibold text-[10px] bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                        Loc:{' '}
                        <span className="text-emerald-400 font-mono font-bold">
                          {dev.lastLocator}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}

      {/* MODAL: LIMPIEZA VISUAL DEL MONITOREO */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="glass-surface-strong border-2 border-slate-600 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative"
            >
              <button
                type="button"
                onClick={() => !isDeleting && setDeleteTarget(null)}
                disabled={isDeleting}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <Badge tone="emerald">SOLO TABLERO VISUAL • NO BORRA ESCANEOS</Badge>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    {deleteTarget.type === 'all'
                      ? '¿Limpiar todas las tarjetas del monitoreo?'
                      : `¿Quitar tarjeta de ${
                          deleteTarget.device.userNumber
                            ? `Usuario ${deleteTarget.device.userNumber}`
                            : deleteTarget.device.deviceName
                        }?`}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {deleteTarget.type === 'all'
                      ? 'Retira las tarjetas viejas o inactivas de este panel. No borra datos de Excel/Supabase ni cierra la sesión de los operadores conectados.'
                      : `Solo retira la tarjeta de monitoreo de ${deleteTarget.device.operatorName}. Sus escaneos y su sesión en la terminal continúan intactos.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <TactileButton
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="min-h-[44px] px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                </TactileButton>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="min-h-[44px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: FORZAR RE-LOGIN EN HANDHELDS */}
      <AnimatePresence>
        {rebootTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="glass-surface-strong border-2 border-amber-500 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative"
            >
              <button
                type="button"
                onClick={() => !isRebooting && setRebootTarget(null)}
                disabled={isRebooting}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <Badge tone="amber">ACCIÓN REMOTA EN HANDHELDS TC26</Badge>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    {rebootTarget.type === 'all'
                      ? '¿Forzar Re-login en todas las handhelds?'
                      : `¿Cerrar sesión remota de ${
                          rebootTarget.device.userNumber
                            ? `Usuario ${rebootTarget.device.userNumber}`
                            : rebootTarget.device.deviceName
                        }?`}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rebootTarget.type === 'all'
                      ? 'Todas las terminales TC26 cerrarán su sesión actual, regresarán al 1er Conteo y abrirán la pantalla inicial para pedir nombre completo y número de usuario (1 al 14) de nuevo.'
                      : `La terminal de ${rebootTarget.device.operatorName} cerrará su sesión, regresará a 1er Conteo y pedirá nombre y selección de usuario nuevamente.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <TactileButton
                  anticipation
                  type="button"
                  onClick={handleConfirmReboot}
                  disabled={isRebooting}
                  className="min-h-[44px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                </TactileButton>

                <button
                  type="button"
                  onClick={() => setRebootTarget(null)}
                  disabled={isRebooting}
                  className="min-h-[44px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
