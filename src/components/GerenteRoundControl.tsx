import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Check,
  UserCheck,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { CountRound, DeviceStatusSummary } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';
import { Badge, ProcessStepper, StepperStep } from './ui/Controls';
import { EASE_OUT_EXPO, TactileButton } from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

interface GerenteRoundControlProps {
  currentRound: CountRound;
  onAuthorizeRound: (nextRound: CountRound) => void;
  scansCountInRound: {
    round1: number;
    round2: number;
    round3: number;
  };
  totalScans: number;
  userRounds?: Record<number, CountRound>;
  deviceSummaries?: DeviceStatusSummary[];
}

const CYCLE_STEPS: StepperStep[] = [
  { id: '1ER_CONTEO', label: '1er Conteo', sublabel: 'Captura base' },
  { id: '2DO_CONTEO', label: '2do Conteo', sublabel: 'Cotejo ciego' },
  { id: '3ER_CONTEO', label: '3er Conteo', sublabel: 'Desempate' },
  { id: 'CONTEO_FINALIZADO', label: 'Finalizado', sublabel: 'Cierre fiscal' },
];

export const GerenteRoundControl: React.FC<GerenteRoundControlProps> = ({
  currentRound,
  onAuthorizeRound,
  scansCountInRound,
  userRounds,
  deviceSummaries,
}) => {
  const { toast } = useToast();
  const [confirmModal, setConfirmModal] = useState<{
    targetRound: CountRound;
    title: string;
    description: string;
    confirmButtonText: string;
    confirmButtonColor: string;
    isFinalizeAudit?: boolean;
  } | null>(null);

  const getRoundBadge = () => {
    switch (currentRound) {
      case '1ER_CONTEO':
        return {
          badge: '1er Conteo',
          tone: 'emerald' as const,
          stepIndex: 0,
        };
      case '2DO_CONTEO':
        return {
          badge: '2do Conteo',
          tone: 'blue' as const,
          stepIndex: 1,
        };
      case '3ER_CONTEO':
        return {
          badge: '3er Conteo',
          tone: 'amber' as const,
          stepIndex: 2,
        };
      case 'CONTEO_FINALIZADO':
        return {
          badge: 'Finalizado',
          tone: 'rose' as const,
          stepIndex: 3,
        };
    }
  };

  const status = getRoundBadge();

  // Categorize users across 1st, 2nd, and 3rd rounds according to userRounds authority
  const usersInRound1: Array<{ userNum: number; name?: string }> = [];
  const usersInRound2: Array<{ userNum: number; name?: string }> = [];
  const usersInRound3: Array<{ userNum: number; name?: string }> = [];

  for (let i = 1; i <= 14; i++) {
    const round = userRounds?.[i] || currentRound || '1ER_CONTEO';
    const dev = deviceSummaries?.find((d) => d.userNumber === i);
    const name = dev?.operatorName || undefined;

    if (round === '2DO_CONTEO') {
      usersInRound2.push({ userNum: i, name });
    } else if (round === '3ER_CONTEO') {
      usersInRound3.push({ userNum: i, name });
    } else if (round === '1ER_CONTEO') {
      if (dev || (userRounds && userRounds[i])) {
        usersInRound1.push({ userNum: i, name });
      }
    }
  }

  const hasUsersInAdvancedRounds = usersInRound2.length > 0 || usersInRound3.length > 0;

  const handleOpenConfirm = (
    targetRound: CountRound,
    title: string,
    description: string,
    confirmButtonText: string,
    confirmButtonColor: string,
    isFinalizeAudit?: boolean
  ) => {
    setConfirmModal({
      targetRound,
      title,
      description,
      confirmButtonText,
      confirmButtonColor,
      isFinalizeAudit,
    });
  };

  const handleExecuteChange = () => {
    if (!confirmModal) return;
    const target = confirmModal.targetRound;
    soundManager.playSuccess();
    onAuthorizeRound(target);
    setConfirmModal(null);

    const labels: Record<CountRound, string> = {
      '1ER_CONTEO': '1er Conteo',
      '2DO_CONTEO': '2do Conteo',
      '3ER_CONTEO': '3er Conteo Extraordinario',
      'CONTEO_FINALIZADO': 'Conteo Finalizado',
    };
    toast({
      variant: target === 'CONTEO_FINALIZADO' ? 'warning' : 'success',
      title: `Ciclo actualizado a ${labels[target]}`,
      description: 'Las terminales Zebra TC26 sincronizarán el nuevo estado automáticamente.',
    });
  };

  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5 border border-slate-800/90 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Control de Rondas de Conteo
              </h2>
              <Badge tone="indigo">Gerencia</Badge>
            </div>
            <p className="text-xs text-slate-400">
              Autoriza el avance global del inventario en todas las terminales TC26
            </p>
          </div>
        </div>

        <Badge tone={status.tone} dot pulse={currentRound !== 'CONTEO_FINALIZADO'}>
          {status.badge}
        </Badge>
      </div>

      {/* Nielsen #1: Global Cycle Stepper */}
      <div className="bg-slate-950/75 border border-slate-800/80 rounded-xl p-3">
        <ProcessStepper
          steps={CYCLE_STEPS}
          currentStepIndex={status.stepIndex}
          tone={status.tone}
        />
      </div>

      {/* Single-level Round KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className={`p-3.5 rounded-xl border transition-colors ${
            currentRound === '1ER_CONTEO'
              ? 'bg-emerald-950/35 border-emerald-500/50'
              : 'bg-slate-950/70 border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">1er Conteo</span>
            {currentRound === '1ER_CONTEO' && <Badge tone="emerald">ACTIVO</Badge>}
          </div>
          <div className="mt-1.5 text-xl font-mono font-extrabold text-emerald-400 tabular-nums">
            {scansCountInRound.round1}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">escaneos</span>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border transition-colors ${
            currentRound === '2DO_CONTEO'
              ? 'bg-blue-950/35 border-blue-500/50'
              : 'bg-slate-950/70 border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">2do Conteo</span>
            {currentRound === '2DO_CONTEO' && <Badge tone="blue">ACTIVO</Badge>}
          </div>
          <div className="mt-1.5 text-xl font-mono font-extrabold text-blue-400 tabular-nums">
            {scansCountInRound.round2}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">escaneos</span>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border transition-colors ${
            currentRound === '3ER_CONTEO'
              ? 'bg-amber-950/35 border-amber-500/50'
              : 'bg-slate-950/70 border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">3er Conteo</span>
            {currentRound === '3ER_CONTEO' && <Badge tone="amber">ACTIVO</Badge>}
          </div>
          <div className="mt-1.5 text-xl font-mono font-extrabold text-amber-400 tabular-nums">
            {scansCountInRound.round3}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">escaneos</span>
          </div>
        </div>
      </div>

      {/* Action Buttons for Gerente */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Acciones de Gerencia</span>
          <span className="text-[11px] text-slate-500 font-normal">
            Sincronización inmediata en todas las TC26
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {currentRound === '1ER_CONTEO' && (
            <TactileButton
              anticipation
              type="button"
              onClick={() =>
                handleOpenConfirm(
                  '2DO_CONTEO',
                  '¿Autorizar y pasar al 2do Conteo?',
                  'Todos los operadores en sus terminales TC26 comenzarán a registrar los productos en la Hoja 2 de Excel.',
                  'Sí, Autorizar 2do Conteo',
                  'bg-blue-600 hover:bg-blue-500 text-white'
                )
              }
              className={`p-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg flex items-center justify-between cursor-pointer ${
                hasUsersInAdvancedRounds ? 'col-span-1' : 'col-span-1 sm:col-span-2'
              }`}
            >
              <div className="text-left">
                <div>Autorizar y Pasar al 2do Conteo</div>
                <div className="text-[11px] text-blue-100/90 font-normal">
                  Habilita la Hoja 2 de Excel para cotejo de inventario
                </div>
              </div>
              <ArrowRight className="w-5 h-5 shrink-0" />
            </TactileButton>
          )}

          {currentRound !== 'CONTEO_FINALIZADO' &&
            hasUsersInAdvancedRounds &&
            currentRound === '1ER_CONTEO' && (
              <TactileButton
                anticipation
                type="button"
                onClick={() =>
                  handleOpenConfirm(
                    'CONTEO_FINALIZADO',
                    '¿Finalizar Conteo Definitivamente?',
                    'Concluye formalmente la auditoría física. Las terminales TC26 detendrán el registro de escaneos.',
                    'Sí, Finalizar Definitivamente',
                    'bg-emerald-600 hover:bg-emerald-500 text-white',
                    true
                  )
                }
                className="p-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg flex items-center justify-between col-span-1 cursor-pointer"
              >
                <div className="text-left">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Finalizar Conteo Definitivamente</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-200 font-mono text-[10px] border border-emerald-400/40 tabular-nums">
                      {usersInRound2.length + usersInRound3.length} en R2/R3
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-100/90 font-normal">
                    Cerrar auditoría con desglose de usuarios
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              </TactileButton>
            )}

          {currentRound === '2DO_CONTEO' && (
            <>
              <TactileButton
                anticipation
                type="button"
                onClick={() =>
                  handleOpenConfirm(
                    '3ER_CONTEO',
                    '¿Autorizar 3er Conteo Extraordinario?',
                    'Habilita a los operarios una ronda extraordinaria para desempatar aquellos racks o SKUs donde hubo discrepancias.',
                    'Sí, Autorizar 3er Conteo',
                    'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  )
                }
                className="p-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg flex items-center justify-between cursor-pointer"
              >
                <div className="text-left">
                  <div>Pasar a 3er Conteo Extraordinario</div>
                  <div className="text-[11px] text-slate-900 font-normal">
                    Para desempate por discrepancias
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </TactileButton>

              <TactileButton
                anticipation
                type="button"
                onClick={() =>
                  handleOpenConfirm(
                    'CONTEO_FINALIZADO',
                    '¿Finalizar Conteo Definitivamente?',
                    'El inventario quedará cerrado oficialmente tras el 2do conteo. Se bloqueará el escaneo en las terminales TC26.',
                    'Sí, Finalizar Definitivamente',
                    'bg-emerald-600 hover:bg-emerald-500 text-white',
                    true
                  )
                }
                className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg flex items-center justify-between cursor-pointer"
              >
                <div className="text-left">
                  <div>Finalizar Conteo Definitivamente</div>
                  <div className="text-[11px] text-emerald-100/90 font-normal">
                    Concluir auditoría sin 3er conteo
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              </TactileButton>
            </>
          )}

          {currentRound === '3ER_CONTEO' && (
            <TactileButton
              anticipation
              type="button"
              onClick={() =>
                handleOpenConfirm(
                  'CONTEO_FINALIZADO',
                  '¿Finalizar Conteo Definitivamente?',
                  'Concluye formalmente la auditoría tras completar el 3er conteo de desempate. Las terminales TC26 detendrán el registro.',
                  'Sí, Finalizar y Cerrar Auditoría',
                  'bg-emerald-600 hover:bg-emerald-500 text-white',
                  true
                )
              }
              className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg flex items-center justify-between col-span-1 sm:col-span-2 cursor-pointer"
            >
              <div className="text-left">
                <div>Finalizar y Cerrar Conteo Definitivamente</div>
                <div className="text-[11px] text-emerald-100/90 font-normal">
                  Cierra la auditoría física completa
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            </TactileButton>
          )}

          {currentRound === 'CONTEO_FINALIZADO' && (
            <div className="col-span-1 sm:col-span-2 p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-2.5">
              <div className="text-xs text-slate-300">
                El conteo está marcado como <strong className="text-rose-300">Finalizado</strong>.
              </div>
              <TactileButton
                anticipation
                type="button"
                onClick={() =>
                  handleOpenConfirm(
                    '1ER_CONTEO',
                    '¿Iniciar Nuevo Ciclo de Inventario?',
                    'Reiniciará la ronda al 1er Conteo para permitir nuevos escaneos en las terminales TC26.',
                    'Sí, Iniciar Nuevo Ciclo',
                    'bg-emerald-600 hover:bg-emerald-500 text-white'
                  )
                }
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
              >
                Comenzar Nuevo Ciclo (1er Conteo)
              </TactileButton>
            </div>
          )}
        </div>

        {currentRound !== '1ER_CONTEO' && currentRound !== 'CONTEO_FINALIZADO' && (
          <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() =>
                handleOpenConfirm(
                  '1ER_CONTEO',
                  '¿Reiniciar ciclo al 1er Conteo?',
                  'Regresará el estado activo al 1er Conteo. Los registros ya subidos a SharePoint permanecen intactos en Excel.',
                  'Sí, Reiniciar a 1er Conteo',
                  'bg-rose-600 hover:bg-rose-500 text-white'
                )
              }
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar ciclo al 1er Conteo</span>
            </button>
          </div>
        )}
      </div>

      {/* Glassmorphic Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
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
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
              className="glass-surface-strong border-2 border-indigo-500/60 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center relative"
            >
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 cursor-pointer"
                aria-label="Cerrar confirmación"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-13 h-13 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <Badge tone="indigo">AUTORIZACIÓN DE GERENCIA</Badge>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug pt-1">
                  {confirmModal.title}
                </h3>

                {confirmModal.isFinalizeAudit ? (
                  <div className="space-y-3 text-left pt-2">
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Resumen de usuarios por ronda:</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                          <span>3er Conteo Extraordinario:</span>
                          <Badge tone="amber">
                            {usersInRound3.length}{' '}
                            {usersInRound3.length === 1 ? 'usuario' : 'usuarios'}
                          </Badge>
                        </div>
                        {usersInRound3.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {usersInRound3.map((u) => (
                              <span
                                key={u.userNum}
                                className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] border border-amber-500/40 font-semibold"
                              >
                                Usuario {u.userNum}
                                {u.name ? ` (${u.name})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic pl-1">
                            Ningún usuario en 3er conteo
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 pt-1.5 border-t border-slate-900">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                          <span>2do Conteo:</span>
                          <Badge tone="blue">
                            {usersInRound2.length}{' '}
                            {usersInRound2.length === 1 ? 'usuario' : 'usuarios'}
                          </Badge>
                        </div>
                        {usersInRound2.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {usersInRound2.map((u) => (
                              <span
                                key={u.userNum}
                                className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono text-[11px] border border-blue-500/40 font-semibold"
                              >
                                Usuario {u.userNum}
                                {u.name ? ` (${u.name})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic pl-1">
                            Ningún usuario en 2do conteo
                          </div>
                        )}
                      </div>

                      {usersInRound1.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-900 text-[11px] text-slate-400 flex items-center justify-between">
                          <span>Aún en 1er Conteo:</span>
                          <span className="font-mono text-slate-300 font-semibold tabular-nums">
                            {usersInRound1.length}{' '}
                            {usersInRound1.length === 1 ? 'usuario' : 'usuarios'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        ¿Estás seguro de finalizar definitivamente con esta cantidad de usuarios en
                        2do y 3er conteo? Esta acción cerrará la auditoría y bloqueará el escaneo en
                        todas las terminales TC26.
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    {confirmModal.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <TactileButton
                  anticipation
                  type="button"
                  onClick={handleExecuteChange}
                  className={`min-h-[48px] px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${confirmModal.confirmButtonColor}`}
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{confirmModal.confirmButtonText}</span>
                </TactileButton>

                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="min-h-[48px] px-3 sm:px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-colors whitespace-nowrap cursor-pointer"
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
