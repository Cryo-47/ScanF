import React from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { CountRound, ScannedItem, DeviceStatusSummary } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';

interface GerenteUserAssignmentPanelProps {
  currentRound: CountRound;
  authorizations: Record<number, boolean>;
  onToggleUser: (userNumber: number) => void;
  onSetAllUsers: (enabled: boolean) => void;
  scans: ScannedItem[];
  deviceSummaries: DeviceStatusSummary[];
}

export const GerenteUserAssignmentPanel: React.FC<GerenteUserAssignmentPanelProps> = ({
  currentRound,
  authorizations,
  onToggleUser,
  onSetAllUsers,
  scans,
  deviceSummaries,
}) => {
  // Aggregate stats per user number (1 to 10)
  const usersData = Array.from({ length: 10 }, (_, i) => {
    const userNum = i + 1;
    const userLabel = `Usuario ${userNum}`;
    
    // Scans matching this user number
    const userScans = scans.filter(
      (s) => s.userNumber === userNum || s.operador === userLabel
    );
    const round1Scans = userScans.filter((s) => s.conteoRound === '1ER_CONTEO');
    const round2Scans = userScans.filter((s) => s.conteoRound === '2DO_CONTEO');
    
    const round1Pieces = round1Scans.reduce((sum, s) => sum + s.cantidad, 0);
    const round2Pieces = round2Scans.reduce((sum, s) => sum + s.cantidad, 0);

    // Operator name from recent scans or device summary
    const matchingDevice = deviceSummaries.find(
      (d) => d.userNumber === userNum || d.operatorName?.includes(userLabel)
    );
    const operatorName = 
      userScans[0]?.nombreOperadorCompleto || 
      matchingDevice?.operatorName || 
      'Sin operador asignado';

    const isAuthorized = authorizations[userNum] !== false; // defaults to true

    return {
      userNum,
      userLabel,
      operatorName,
      round1Pieces,
      round1ScansCount: round1Scans.length,
      round2Pieces,
      round2ScansCount: round2Scans.length,
      isAuthorized,
      hasActivity: userScans.length > 0,
    };
  });

  const totalAuthorized = usersData.filter((u) => u.isAuthorized).length;

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Asignación de Usuarios para el 2do Conteo
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {totalAuthorized} / 10 Habilitados
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Controla qué handhelds (Usuarios 1 al 10) tienen permiso de continuar al segundo conteo
            </p>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playSuccess();
              onSetAllUsers(true);
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 hover:border-emerald-500/50 transition-colors"
          >
            Habilitar Todos (1-10)
          </button>
          <button
            onClick={() => {
              soundManager.playWarning();
              onSetAllUsers(false);
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 hover:border-rose-500/50 transition-colors"
          >
            Deshabilitar Todos
          </button>
        </div>
      </div>

      {/* Notice on Current Round Context */}
      <div className="text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-slate-300 leading-relaxed">
          Cada handheld TC26 tiene vinculado su número de usuario (1 al 10) plasmado en Excel. 
          {currentRound === '2DO_CONTEO' ? (
            <span className="text-blue-400 font-semibold block mt-0.5">
              ⚠️ El 2do Conteo está ACTIVO: Solo las terminales marcadas en verde pueden escanear actualmente. Las demás mostrarán una pantalla de espera.
            </span>
          ) : (
            <span className="text-slate-400 block mt-0.5">
              Puedes pre-configurar qué usuarios continuarán al 2do conteo antes o durante la transición de rondas.
            </span>
          )}
        </p>
      </div>

      {/* Grid of 10 Users */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {usersData.map((u) => {
          return (
            <div
              key={u.userNum}
              className={`p-3 rounded-xl border transition-all ${
                u.isAuthorized
                  ? 'bg-slate-950 border-emerald-500/40 hover:border-emerald-500'
                  : 'bg-slate-950/60 border-slate-800 opacity-75 hover:opacity-100'
              }`}
            >
              {/* Top: User label and Toggle */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="font-mono font-bold text-xs text-white">
                  {u.userLabel}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playSuccess();
                    onToggleUser(u.userNum);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                    u.isAuthorized
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                  title={u.isAuthorized ? 'Click para deshabilitar del 2do conteo' : 'Click para habilitar para el 2do conteo'}
                >
                  {u.isAuthorized ? (
                    <>
                      <UserCheck className="w-3 h-3" />
                      <span>APROBADO</span>
                    </>
                  ) : (
                    <>
                      <UserX className="w-3 h-3" />
                      <span>EN ESPERA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Operator Name */}
              <div className="text-[11px] text-slate-400 truncate mb-2">
                {u.operatorName}
              </div>

              {/* Stats 1er vs 2do Conteo */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-2 border-t border-slate-900 font-mono">
                <div className="bg-slate-900/80 p-1.5 rounded">
                  <span className="text-slate-500 block">1er Conteo:</span>
                  <span className="text-emerald-400 font-bold">{u.round1Pieces} pzs</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded">
                  <span className="text-slate-500 block">2do Conteo:</span>
                  <span className="text-blue-400 font-bold">{u.round2Pieces} pzs</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
