import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  ArrowRight,
  RotateCcw,
  UserCheck,
  Sparkles,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { CountRound, ScannedItem, DeviceStatusSummary } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';
import { normalizeRound } from '../utils/storage';
import { Badge, Tabs, Tooltip, TabItem } from './ui/Controls';
import {
  EASE_OUT_EXPO,
  StaggerItem,
  StaggerList,
  TactileButton,
} from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

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
}

export const GerenteUserAssignmentPanel: React.FC<GerenteUserAssignmentPanelProps> = ({
  userRounds,
  onSetUserRound,
  onSetAllUsersRound,
  scans,
  deviceSummaries,
  onResetUserDevice,
}) => {
  const { toast } = useToast();
  const [filterRound, setFilterRound] = useState<CountRound | 'ALL'>('ALL');
  const [confirmResetUserNum, setConfirmResetUserNum] = useState<number | null>(null);

  const usersData = Array.from({ length: 14 }, (_, i) => {
    const userNum = i + 1;
    const userLabel = `Usuario ${userNum}`;

    const userScans = scans.filter(
      (s) => s.userNumber === userNum || s.operador === userLabel
    );
    const round1Scans = userScans.filter((s) => normalizeRound(s.conteoRound) === '1ER_CONTEO');
    const round2Scans = userScans.filter((s) => normalizeRound(s.conteoRound) === '2DO_CONTEO');
    const round3Scans = userScans.filter((s) => normalizeRound(s.conteoRound) === '3ER_CONTEO');

    const round1Pieces = round1Scans.reduce((sum, s) => sum + s.cantidad, 0);
    const round2Pieces = round2Scans.reduce((sum, s) => sum + s.cantidad, 0);
    const round3Pieces = round3Scans.reduce((sum, s) => sum + s.cantidad, 0);

    const matchingDevice = deviceSummaries.find(
      (d) => d.userNumber === userNum || d.operatorName?.includes(userLabel)
    );
    const operatorName =
      userScans[0]?.nombreOperadorCompleto ||
      matchingDevice?.operatorName ||
      'Sin operador asignado';

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
    };
  });

  const inRound1Count = usersData.filter((u) => u.round === '1ER_CONTEO').length;
  const inRound2Count = usersData.filter((u) => u.round === '2DO_CONTEO').length;
  const inRound3Count = usersData.filter((u) => u.round === '3ER_CONTEO').length;

  const filterTabs: TabItem<CountRound | 'ALL'>[] = [
    { id: 'ALL', label: 'Todos', badge: usersData.length },
    { id: '1ER_CONTEO', label: '1er Conteo', badge: inRound1Count },
    { id: '2DO_CONTEO', label: '2do Conteo', badge: inRound2Count },
    ...(inRound3Count > 0
      ? [{ id: '3ER_CONTEO' as const, label: '3er Conteo', badge: inRound3Count }]
      : []),
  ];

  const handleAdvanceIndividual = (userNum: number) => {
    soundManager.playSuccess();
    onSetUserRound(userNum, '2DO_CONTEO');
    toast({
      variant: 'success',
      title: `Usuario ${userNum} en 2do Conteo`,
      description: 'Su terminal TC26 ya registra en la Hoja 2 de SharePoint.',
    });
  };

  const handleRevertIndividual = (userNum: number) => {
    soundManager.playWarning();
    onSetUserRound(userNum, '1ER_CONTEO');
    toast({
      variant: 'info',
      title: `Usuario ${userNum} regresado a 1er Conteo`,
    });
  };

  const handleAdvanceToRound3 = (userNum: number) => {
    soundManager.playSuccess();
    onSetUserRound(userNum, '3ER_CONTEO');
    toast({
      variant: 'warning',
      title: `Usuario ${userNum} asignado a 3er Conteo`,
      description: 'Habilitado para desempate de discrepancias.',
    });
  };

  const handleAdvanceAllToRound2 = () => {
    soundManager.playSuccess();
    onSetAllUsersRound('2DO_CONTEO');
    toast({
      variant: 'success',
      title: 'Todos los usuarios (1–14) en 2do Conteo',
    });
  };

  const handleRevertAllToRound1 = () => {
    soundManager.playWarning();
    onSetAllUsersRound('1ER_CONTEO');
    toast({
      variant: 'info',
      title: 'Todos los usuarios regresados a 1er Conteo',
    });
  };

  const visibleUsers = usersData.filter((u) => filterRound === 'ALL' || u.round === filterRound);

  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5 border border-slate-800/90 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Asignación Individual de 14 Usuarios
              </h3>
              <Badge tone="emerald">{inRound1Count} en R1</Badge>
              <Badge tone="blue">{inRound2Count} en R2</Badge>
              {inRound3Count > 0 && <Badge tone="amber">{inRound3Count} en R3</Badge>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Avanza a cada operario al 2do o 3er conteo conforme termine su zona, sin esperar al resto.
            </p>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Mueve simultáneamente a los 14 usuarios al 2do Conteo">
            <TactileButton
              type="button"
              onClick={handleAdvanceAllToRound2}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Avanzar Todos a R2</span>
            </TactileButton>
          </Tooltip>

          <Tooltip content="Regresa a los 14 usuarios al 1er Conteo">
            <TactileButton
              type="button"
              onClick={handleRevertAllToRound1}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            >
              Reiniciar Todos a R1
            </TactileButton>
          </Tooltip>
        </div>
      </div>

      {/* Explanatory tip */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-indigo-500/25 flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong>Avance Independiente:</strong> Los escaneos de cada terminal se clasifican en
          tiempo real hacia su tabla de Excel en SharePoint según la ronda asignada a su tarjeta.
        </p>
      </div>

      {/* Shared-element Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Tabs
          items={filterTabs}
          value={filterRound}
          onChange={setFilterRound}
          layoutGroup="assignment-filter"
        />
        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
          Mostrando {visibleUsers.length} de 14 usuarios
        </span>
      </div>

      {/* 14 User Cards Grid — single-level elevation, clean typography, generous spacing */}
      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {visibleUsers.map((u) => {
          const isRound2 = u.round === '2DO_CONTEO';
          const isRound3 = u.round === '3ER_CONTEO';
          const isRound1 = u.round === '1ER_CONTEO';

          return (
            <StaggerItem key={u.userNum}>
              <div
                className={`h-full p-4 rounded-2xl border flex flex-col justify-between gap-3.5 transition-colors ${
                  isRound2
                    ? 'bg-slate-950/85 border-blue-500/50 shadow-md shadow-blue-950/20'
                    : isRound3
                    ? 'bg-slate-950/85 border-amber-500/50 shadow-md shadow-amber-950/20'
                    : 'bg-slate-950/85 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Top: User ID + Round Badge */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/70">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 font-mono font-black text-xs flex items-center justify-center shrink-0 tabular-nums">
                        {u.userNum}
                      </span>
                      <span className="font-mono font-bold text-sm text-white truncate">
                        {u.userLabel}
                      </span>
                    </div>

                    {isRound1 && <Badge tone="emerald">1ER CONTEO</Badge>}
                    {isRound2 && <Badge tone="blue">2DO CONTEO</Badge>}
                    {isRound3 && <Badge tone="amber">3ER CONTEO</Badge>}
                  </div>

                  {/* Operator Name — clean typography without extra boxed wrapper */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                      Operador Asignado
                    </span>
                    <div
                      className={`text-xs font-bold truncate mt-0.5 ${
                        u.operatorName === 'Sin operador asignado'
                          ? 'text-slate-500 italic font-normal'
                          : 'text-slate-100'
                      }`}
                      title={u.operatorName}
                    >
                      {u.operatorName}
                    </div>
                  </div>

                  {/* Clean Metric Grid (single-level) */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 font-mono">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block">1er Conteo</span>
                      <span className="text-sm font-extrabold text-emerald-400 tabular-nums">
                        {u.round1Pieces.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block tabular-nums">
                        {u.round1ScansCount} QR
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block">2do Conteo</span>
                      <span className="text-sm font-extrabold text-blue-400 tabular-nums">
                        {u.round2Pieces.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block tabular-nums">
                        {u.round2ScansCount} QR
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block">3er Conteo</span>
                      <span className="text-sm font-extrabold text-amber-400 tabular-nums">
                        {u.round3Pieces.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block tabular-nums">
                        {u.round3ScansCount} QR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="space-y-2 pt-2.5 border-t border-slate-800/70">
                  {isRound1 && (
                    <TactileButton
                      anticipation
                      type="button"
                      onClick={() => handleAdvanceIndividual(u.userNum)}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer"
                    >
                      <span>Avanzar a 2do Conteo</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </TactileButton>
                  )}

                  {isRound2 && (
                    <div className="space-y-2">
                      <div className="w-full py-1.5 text-center text-[10px] font-mono font-bold text-blue-300 bg-blue-950/60 rounded-lg border border-blue-500/35 flex items-center justify-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>ESCANEANDO EN 2DO CONTEO</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRevertIndividual(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Regresar R1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceToRound3(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Pasar R3</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isRound3 && (
                    <div className="space-y-2">
                      <div className="w-full py-1.5 text-center text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 rounded-lg border border-amber-500/35">
                        EN 3ER CONTEO (DESEMPATE)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRevertIndividual(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Regresar R1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceIndividual(u.userNum)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-500/40 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>Volver R2</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {onResetUserDevice && (
                    <button
                      type="button"
                      onClick={() => setConfirmResetUserNum(u.userNum)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>Pedir Usuario / Re-login</span>
                    </button>
                  )}
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerList>

      {/* Poka-Yoke Individual Re-login Confirmation Modal */}
      <AnimatePresence>
        {confirmResetUserNum !== null && onResetUserDevice && (
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
              className="glass-surface-strong border-2 border-amber-500/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative"
            >
              <button
                type="button"
                onClick={() => setConfirmResetUserNum(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    ¿Forzar re-login de Usuario {confirmResetUserNum}?
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    La terminal asignada al <strong>Usuario {confirmResetUserNum}</strong> cerrará su
                    sesión actual, volverá al 1er Conteo y pedirá nombre y número de usuario
                    nuevamente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <TactileButton
                  anticipation
                  type="button"
                  onClick={() => {
                    const target = confirmResetUserNum;
                    setConfirmResetUserNum(null);
                    soundManager.playWarning();
                    onResetUserDevice(target);
                    toast({
                      variant: 'warning',
                      title: `Re-login enviado a Usuario ${target}`,
                      description: 'Su terminal TC26 solicitará nombre y usuario nuevamente.',
                    });
                  }}
                  className="min-h-[44px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Sí, Forzar Re-login</span>
                </TactileButton>

                <button
                  type="button"
                  onClick={() => setConfirmResetUserNum(null)}
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
