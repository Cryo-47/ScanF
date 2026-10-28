import React, { useState } from 'react';
import { 
  Smartphone, 
  User, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowRight,
  Filter,
  Package
} from 'lucide-react';
import { DeviceStatusSummary, CountRound } from '../types/inventory';

interface DeviceMonitoringPanelProps {
  devices: DeviceStatusSummary[];
  onSelectRoundFilter?: (round: CountRound | 'ALL') => void;
}

export const DeviceMonitoringPanel: React.FC<DeviceMonitoringPanelProps> = ({
  devices,
}) => {
  const [filterRound, setFilterRound] = useState<CountRound | 'ALL'>('ALL');

  const filteredDevices = devices.filter((d) => {
    if (filterRound === 'ALL') return true;
    return d.currentRound === filterRound;
  });

  const round1Count = devices.filter((d) => d.currentRound === '1ER_CONTEO').length;
  const round2Count = devices.filter((d) => d.currentRound === '2DO_CONTEO').length;
  const round3Count = devices.filter((d) => d.currentRound === '3ER_CONTEO').length;
  const finishedCount = devices.filter((d) => d.currentRound === 'CONTEO_FINALIZADO').length;

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
              Monitoreo de operadores y avance de rondas (1er vs 2do conteo)
            </p>
          </div>
        </div>

        {/* Quick count chips */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <button
            onClick={() => setFilterRound('ALL')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRound === 'ALL'
                ? 'bg-slate-800 text-white border-slate-600 font-bold'
                : 'text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Todos ({devices.length})
          </button>

          <button
            onClick={() => setFilterRound('1ER_CONTEO')}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
              filterRound === '1ER_CONTEO'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold'
                : 'text-emerald-400/80 border-emerald-950 hover:bg-emerald-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>1er Conteo ({round1Count})</span>
          </button>

          <button
            onClick={() => setFilterRound('2DO_CONTEO')}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
              filterRound === '2DO_CONTEO'
                ? 'bg-blue-950 text-blue-300 border-blue-500 font-bold'
                : 'text-blue-400/80 border-blue-950 hover:bg-blue-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>2do Conteo ({round2Count})</span>
          </button>

          {round3Count > 0 && (
            <button
              onClick={() => setFilterRound('3ER_CONTEO')}
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                filterRound === '3ER_CONTEO'
                  ? 'bg-amber-950 text-amber-300 border-amber-500 font-bold'
                  : 'text-amber-400/80 border-amber-950 hover:bg-amber-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>3er Conteo ({round3Count})</span>
            </button>
          )}
        </div>
      </div>

      {/* Device Cards Grid */}
      {filteredDevices.length === 0 ? (
        <div className="py-6 text-center text-slate-500 text-xs">
          No hay terminales registradas en este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDevices.map((dev) => {
            const badge = getRoundBadge(dev.currentRound);
            return (
              <div
                key={dev.deviceName}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition-all"
              >
                {/* Device Title & Current Round Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs sm:text-sm truncate flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{dev.deviceName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{dev.operatorName}</span>
                    </div>
                  </div>

                  {/* High visibility round indicator */}
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border flex items-center gap-1 shrink-0 ${badge.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                    <span>{badge.label}</span>
                  </span>
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
    </div>
  );
};
