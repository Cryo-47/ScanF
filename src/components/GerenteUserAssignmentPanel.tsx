import React, { useState } from 'react';
import { 
  Users, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Layers, 
  UserCheck, 
  Sparkles,
  AlertCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { CountRound, ScannedItem, DeviceStatusSummary } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';

interface GerenteUserAssignmentPanelProps {
  currentRound: CountRound;
  userRounds: Record<number, CountRound>;
  onSetUserRound: (userNumber: number, round: CountRound) => void;
  onSetAllUsersRound: (round: CountRound) => void;
  scans: ScannedItem[];
  deviceSummaries: DeviceStatusSummary[];
  authorizations?: Record<number, boolean>;
  onToggleUser?: (userNumber: number) => void;
  onSetAllUsers?: (enabled: boolean) => void;
  onResetUserDevice?: (userNumber: number) => void;
  onResetAllDevices?: () => void;
}

export const GerenteUserAssignmentPanel: React.FC<GerenteUserAssignmentPanelProps> = ({
  currentRound,
  userRounds,
  onSetUserRound,
  onSetAllUsersRound,
  scans,
  deviceSummaries,
  onResetUserDevice,
  onResetAllDevices,
}) => {
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [filterRound, setFilterRound] = useState<CountRound | 'ALL'>('ALL');

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Aggregate stats per user number (1 to 14)
  const usersData = Array.from({ length: 14 }, (_, i) => {
    const userNum = i + 1;
    const userLabel = `Usuario ${userNum}`;
    
    // Scans matching this user number
    const userScans = scans.filter(
      (s) => s.userNumber === userNum || s.operador === userLabel
    );
    const round1Scans = userScans.filter((s) => s.conteoRound === '1ER_CONTEO');
    const round2Scans = userScans.filter((s) => s.conteoRound === '2DO_CONTEO');
    const round3Scans = userScans.filter((s) => s.conteoRound === '3ER_CONTEO');
    
    const round1Pieces = round1Scans.reduce((sum, s) => sum + s.cantidad, 0);
    const round2Pieces = round2Scans.reduce((sum, s) => sum + s.cantidad, 0);
    const round3Pieces = round3Scans.reduce((sum, s) => sum + s.cantidad, 0);

    // Operator name from recent scans or device summary
    const matchingDevice = deviceSummaries.find(
      (d) => d.userNumber === userNum || d.operatorName?.includes(userLabel)
    );
    const operatorName = 
      userScans[0]?.nombreOperadorCompleto || 
      matchingDevice?.operatorName || 
      'Sin operador asignado';

    const lastActive = userScans[0]?.timestamp || matchingDevice?.lastActive;
    const lastSku = userScans[0]?.sku || matchingDevice?.lastSku;

    const round: CountRound = userRounds[userNum] || '1ER_CONTEO';

    return {
      userNum,
      userLabel,
      operatorName,
      round,
      round1Pieces,
      round1ScansCount: round1Scans.length,
      round2Pieces,
      round2ScansCount: round2Scans.length,
      round3Pieces,
      round3ScansCount: round3Scans.length,
      hasActivity: userScans.length > 0,
      lastActive,
      lastSku,
    };
  });

  const inRound1Count = usersData.filter((u) => u.round === '1ER_CONTEO').length;
  const inRound2Count = usersData.filter((u) => u.round === '2DO_CONTEO').length;
  const inRound3Count = usersData.filter((u) => u.round === '3ER_CONTEO').length;

  const handleAdvanceIndividual = (userNum: number) => {
    soundManager.playSuccess();
    onSetUserRound(userNum, '2DO_CONTEO');
    showFeedback(`✓ Usuario ${userNum} avanzado al 2do Conteo de forma individual.`);
  };

  const handleRevertIndividual = (userNum: number) => {
    soundManager.playWarning();
    onSetUserRound(userNum, '1ER_CONTEO');
    showFeedback(`↩ Usuario ${userNum} regresado al 1er Conteo.`);
  };

  const handleAdvanceToRound3 = (userNum: number) => {
    soundManager.playSuccess();
    onSetUserRound(userNum, '3ER_CONTEO');
    showFeedback(`⚡ Usuario ${userNum} asignado a 3er Conteo Extraordinario.`);
  };

  const handleAdvanceAllToRound2 = () => {
    soundManager.playSuccess();
    onSetAllUsersRound('2DO_CONTEO');
    showFeedback('✓ Todos los usuarios (1 al 14) han avanzado al 2do Conteo.');
  };

  const handleRevertAllToRound1 = () => {
    soundManager.playWarning();
    onSetAllUsersRound('1ER_CONTEO');
    showFeedback('↩ Todos los usuarios (1 al 14) regresados al 1er Conteo.');
  };

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Asignación de Usuarios para el 2do Conteo
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {inRound2Count} en 2do Conteo
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {inRound1Count} en 1er Conteo
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Avanza a cada usuario (1 al 14) al 2do conteo de manera individual conforme terminen su área, sin esperar a los demás.
            </p>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAdvanceAllToRound2}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-500/40 hover:border-blue-400 transition-colors flex items-center gap-1.5"
            title="Avanzar a todos los usuarios al 2do Conteo"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Avanzar Todos a 2do Conteo</span>
          </button>
          <button
            onClick={handleRevertAllToRound1}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500 transition-colors"
            title="Regresar a todos al 1er Conteo"
          >
            Reiniciar Todos a 1er Conteo
          </button>
          {onResetAllDevices && (
            <button
              onClick={onResetAllDevices}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 hover:border-rose-400 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Forzar a todas las handhelds TC26 a cerrar sesión, volver al 1er conteo y pedir nombre y usuario de nuevo"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Reiniciar Dispositivos (Re-login)</span>
            </button>
          )}
        </div>
      </div>

      {/* Explanatory Banner on Individual Progression */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed space-y-1">
          <p>
            <strong>Avance Individual Independiente:</strong> Cada operario que termine de contar su pasillo o rack en el <strong>1er Conteo</strong> puede ser avanzado inmediatamente al <strong>2do Conteo</strong> usando el botón azul de su tarjeta.
          </p>
          <p className="text-slate-400 text-[11px]">
            Los demás operadores continuarán en el 1er conteo sin interrupción. Sus escaneos se clasificarán automáticamente en la hoja o tabla correspondiente en Excel de SharePoint (TablaConteo1 vs TablaConteo2).
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="p-2.5 bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Quick Filter Tabs for 14 Users */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-800/80">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400 text-[11px] mr-1 font-sans">Ver:</span>
          <button
            type="button"
            onClick={() => setFilterRound('ALL')}
            className={`px-3 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
              filterRound === 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Todos ({usersData.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterRound('1ER_CONTEO')}
            className={`px-3 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              filterRound === '1ER_CONTEO'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold shadow-sm'
                : 'bg-slate-950 text-emerald-400/80 border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>1er Conteo ({inRound1Count})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterRound('2DO_CONTEO')}
            className={`px-3 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              filterRound === '2DO_CONTEO'
                ? 'bg-blue-950 text-blue-300 border-blue-500 font-bold shadow-sm'
                : 'bg-slate-950 text-blue-400/80 border-slate-800 hover:border-blue-500/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>2do Conteo ({inRound2Count})</span>
          </button>
          {inRound3Count > 0 && (
            <button
              type="button"
              onClick={() => setFilterRound('3ER_CONTEO')}
              className={`px-3 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                filterRound === '3ER_CONTEO'
                  ? 'bg-amber-950 text-amber-300 border-amber-500 font-bold shadow-sm'
                  : 'bg-slate-950 text-amber-400/80 border-slate-800 hover:border-amber-500/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>3er Conteo ({inRound3Count})</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Mostrando {filterRound === 'ALL' ? usersData.length : usersData.filter(u => u.round === filterRound).length} de 14 usuarios
        </div>
      </div>

      {/* 14 User Cards Grid (Spacious 1 to 4 Columns, Never Squished) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {usersData
          .filter((u) => filterRound === 'ALL' || u.round === filterRound)
          .map((u) => {
            const isRound2 = u.round === '2DO_CONTEO';
            const isRound3 = u.round === '3ER_CONTEO';
            const isRound1 = u.round === '1ER_CONTEO';

            return (
              <div
                key={u.userNum}
                className={`p-4 rounded-2xl border flex flex-col justify-between transition-all shadow-sm ${
                  isRound2
                    ? 'bg-slate-950 border-blue-500/50 shadow-blue-500/10 ring-1 ring-blue-500/20'
                    : isRound3
                    ? 'bg-slate-950 border-amber-500/50 shadow-amber-500/10 ring-1 ring-amber-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Header: User Number Pill + Label + Round Badge */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 font-mono font-black text-xs flex items-center justify-center shrink-0">
                        {u.userNum}
                      </div>
                      <span className="font-mono font-bold text-sm text-white whitespace-nowrap">
                        {u.userLabel}
                      </span>
                    </div>

                    {isRound1 && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shadow-sm">
                        1ER CONTEO
                      </span>
                    )}
                    {isRound2 && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-blue-950/80 text-blue-300 border border-blue-500/50 whitespace-nowrap shadow-sm">
                        2DO CONTEO
                      </span>
                    )}
                    {isRound3 && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/50 whitespace-nowrap shadow-sm">
                        3ER CONTEO
                      </span>
                    )}
                  </div>

                  {/* Operator Name */}
                  <div className="text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-850 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Operador Asignado:</span>
                    <div className="text-slate-200 font-bold text-xs truncate" title={u.operatorName}>
                      {u.operatorName}
                    </div>
                  </div>

                  {/* Stats 1er vs 2do Conteo (Comfortable 2-column cards) */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] font-sans">1er Conteo:</span>
                      <span className="text-emerald-400 font-bold text-sm block mt-0.5">
                        {u.round1Pieces.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pzs</span>
                      </span>
                      <span className="text-slate-500 block text-[10px] mt-0.5">{u.round1ScansCount} escaneos</span>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] font-sans">2do Conteo:</span>
                      <span className="text-blue-400 font-bold text-sm block mt-0.5">
                        {u.round2Pieces.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pzs</span>
                      </span>
                      <span className="text-slate-500 block text-[10px] mt-0.5">{u.round2ScansCount} escaneos</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons for this Individual User */}
                <div className="space-y-2 pt-3 mt-3 border-t border-slate-900">
                  {isRound1 && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceIndividual(u.userNum)}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20 whitespace-nowrap cursor-pointer"
                      title={`Avanzar a ${u.userLabel} al 2do conteo individualmente`}
                    >
                      <span>Avanzar a 2do Conteo</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  )}

                  {isRound2 && (
                    <div className="space-y-2">
                      <div className="w-full py-1.5 text-center text-[10px] font-mono font-bold text-blue-300 bg-blue-950/70 rounded-lg border border-blue-500/40 flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>ESCANEANDO EN 2DO CONTEO</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRevertIndividual(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                          title="Regresar este usuario a 1er Conteo"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Regresar R1</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdvanceToRound3(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                          title="Pasar este usuario a 3er Conteo Extraordinario"
                        >
                          <span>Pasar R3</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isRound3 && (
                    <div className="space-y-2">
                      <div className="w-full py-1.5 text-center text-[10px] font-mono font-bold text-amber-300 bg-amber-950/70 rounded-lg border border-amber-500/40 whitespace-nowrap">
                        EN 3ER CONTEO (DESEMPATE)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRevertIndividual(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                          title="Regresar este usuario a 1er Conteo"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Regresar R1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceIndividual(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-500/40 flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                          title="Regresar este usuario a 2do Conteo"
                        >
                          <RotateCcw className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>Volver R2</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botón para forzar Re-login individual de este usuario */}
                  {onResetUserDevice && (
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playWarning();
                        onResetUserDevice(u.userNum);
                        showFeedback(`⚡ Se envió orden de re-login a ${u.userLabel}. Su terminal pedirá nombre y usuario.`);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
                      title={`Cerrar sesión remota de ${u.userLabel} y obligar a pedir nombre y usuario de nuevo en 1er conteo`}
                    >
                      <RotateCcw className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>Pedir Usuario / Re-login</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
