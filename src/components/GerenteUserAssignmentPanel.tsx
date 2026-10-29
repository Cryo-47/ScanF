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
}

export const GerenteUserAssignmentPanel: React.FC<GerenteUserAssignmentPanelProps> = ({
  currentRound,
  userRounds,
  onSetUserRound,
  onSetAllUsersRound,
  scans,
  deviceSummaries,
}) => {
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

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
    showFeedback('✓ Todos los usuarios (1 al 10) han avanzado al 2do Conteo.');
  };

  const handleRevertAllToRound1 = () => {
    soundManager.playWarning();
    onSetAllUsersRound('1ER_CONTEO');
    showFeedback('↩ Todos los usuarios regresados al 1er Conteo.');
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
              Avanza a cada usuario (1 al 10) al 2do conteo de manera individual conforme terminen su área, sin esperar a los demás.
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

      {/* 10 User Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {usersData.map((u) => {
          const isRound2 = u.round === '2DO_CONTEO';
          const isRound3 = u.round === '3ER_CONTEO';
          const isRound1 = u.round === '1ER_CONTEO';

          return (
            <div
              key={u.userNum}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
                isRound2
                  ? 'bg-slate-950 border-blue-500/50 shadow-blue-500/5 ring-1 ring-blue-500/20'
                  : isRound3
                  ? 'bg-slate-950 border-amber-500/50'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: User label + Round Badge */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-white">
                      {u.userLabel}
                    </span>
                  </div>

                  {isRound1 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                      1ER CONTEO
                    </span>
                  )}
                  {isRound2 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950/80 text-blue-300 border border-blue-500/50">
                      2DO CONTEO
                    </span>
                  )}
                  {isRound3 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/50">
                      3ER CONTEO
                    </span>
                  )}
                </div>

                {/* Operator Name */}
                <div className="text-[11px] font-medium text-slate-300 truncate mb-2.5">
                  {u.operatorName}
                </div>

                {/* Stats 1er vs 2do Conteo */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] py-2 border-y border-slate-900 font-mono mb-3">
                  <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-400 block text-[9px]">1er Conteo:</span>
                    <span className="text-emerald-400 font-bold text-xs">{u.round1Pieces} pzs</span>
                    <span className="text-slate-500 block text-[9px]">{u.round1ScansCount} escaneos</span>
                  </div>
                  <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-400 block text-[9px]">2do Conteo:</span>
                    <span className="text-blue-400 font-bold text-xs">{u.round2Pieces} pzs</span>
                    <span className="text-slate-500 block text-[9px]">{u.round2ScansCount} escaneos</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for this Individual User */}
              <div className="space-y-1.5 pt-1">
                {isRound1 && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceIndividual(u.userNum)}
                    className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
                    title={`Avanzar a ${u.userLabel} al 2do conteo individualmente`}
                  >
                    <span>Avanzar a 2do Conteo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {isRound2 && (
                  <div className="space-y-1.5">
                    <div className="w-full py-1 text-center text-[10px] font-mono font-bold text-blue-300 bg-blue-950/60 rounded border border-blue-500/30 flex items-center justify-center gap-1">
                      <UserCheck className="w-3 h-3 text-blue-400" />
                      <span>ESCANEANDO EN 2DO CONTEO</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => handleRevertIndividual(u.userNum)}
                        className="px-1.5 py-1 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1 transition-colors"
                        title="Regresar este usuario a 1er Conteo"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Regresar R1</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAdvanceToRound3(u.userNum)}
                        className="px-1.5 py-1 rounded text-[10px] font-semibold bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1 transition-colors"
                        title="Pasar este usuario a 3er Conteo Extraordinario"
                      >
                        <span>Pasar R3</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )}

                {isRound3 && (
                  <div className="space-y-1">
                    <div className="w-full py-1 text-center text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 rounded border border-amber-500/40">
                      EN 3ER CONTEO (DESEMPATE)
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdvanceIndividual(u.userNum)}
                      className="w-full px-2 py-1 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Volver a 2do Conteo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
