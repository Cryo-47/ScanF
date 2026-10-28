import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  RotateCcw, 
  AlertTriangle, 
  Check, 
  UserCheck, 
  ShieldAlert,
  Layers,
  Sparkles
} from 'lucide-react';
import { CountRound } from '../types/inventory';
import { soundManager } from '../utils/audioHaptics';

interface GerenteRoundControlProps {
  currentRound: CountRound;
  onAuthorizeRound: (nextRound: CountRound) => void;
  scansCountInRound: {
    round1: number;
    round2: number;
    round3: number;
  };
  totalScans: number;
}

export const GerenteRoundControl: React.FC<GerenteRoundControlProps> = ({
  currentRound,
  onAuthorizeRound,
  scansCountInRound,
  totalScans,
}) => {
  const [confirmModal, setConfirmModal] = useState<{
    targetRound: CountRound;
    title: string;
    description: string;
    confirmButtonText: string;
    confirmButtonColor: string;
  } | null>(null);

  const getRoundBadge = () => {
    switch (currentRound) {
      case '1ER_CONTEO':
        return {
          title: '1er Conteo en Progreso',
          desc: 'Los operarios están escaneando el primer inventario físico en sus terminales TC26.',
          color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
          badge: '1er Conteo',
          badgeClass: 'bg-emerald-500 text-slate-950',
        };
      case '2DO_CONTEO':
        return {
          title: '2do Conteo en Progreso',
          desc: 'Se realiza el segundo escaneo para validar y cotejar con el 1er conteo.',
          color: 'text-blue-400 border-blue-500/40 bg-blue-950/40',
          badge: '2do Conteo',
          badgeClass: 'bg-blue-500 text-white',
        };
      case '3ER_CONTEO':
        return {
          title: '3er Conteo Extraordinario',
          desc: 'Ronda de desempate por discrepancias detectadas entre el conteo 1 y el conteo 2.',
          color: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
          badge: '3er Conteo',
          badgeClass: 'bg-amber-500 text-slate-950',
        };
      case 'CONTEO_FINALIZADO':
        return {
          title: 'Conteo Finalizado Definitivamente',
          desc: 'La auditoría física ha concluido. Las terminales TC26 tienen bloqueado el escaneo hasta nuevo ciclo.',
          color: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
          badge: 'Finalizado',
          badgeClass: 'bg-rose-500 text-white',
        };
    }
  };

  const status = getRoundBadge();

  const handleOpenConfirm = (
    targetRound: CountRound,
    title: string,
    description: string,
    confirmButtonText: string,
    confirmButtonColor: string
  ) => {
    setConfirmModal({
      targetRound,
      title,
      description,
      confirmButtonText,
      confirmButtonColor,
    });
  };

  const handleExecuteChange = () => {
    if (!confirmModal) return;
    soundManager.playSuccess();
    onAuthorizeRound(confirmModal.targetRound);
    setConfirmModal(null);
  };

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header of Manager Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Control de Rondas de Conteo
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Rol Gerente
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autoriza el avance de los conteos en todas las handhelds TC26 conectadas
            </p>
          </div>
        </div>

        {/* Current Round Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">Estado actual:</span>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${status.badgeClass} shadow-sm`}>
            {status.badge}
          </span>
        </div>
      </div>

      {/* Status Description & Round KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className={`p-3 rounded-xl border ${currentRound === '1ER_CONTEO' ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">1er Conteo</span>
            {currentRound === '1ER_CONTEO' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">ACTIVO</span>
            )}
          </div>
          <div className="mt-1 text-lg font-mono font-bold text-emerald-400">
            {scansCountInRound.round1} <span className="text-xs font-normal text-slate-400">escaneos</span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${currentRound === '2DO_CONTEO' ? 'bg-blue-950/40 border-blue-500/50' : 'bg-slate-950 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">2do Conteo</span>
            {currentRound === '2DO_CONTEO' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white">ACTIVO</span>
            )}
          </div>
          <div className="mt-1 text-lg font-mono font-bold text-blue-400">
            {scansCountInRound.round2} <span className="text-xs font-normal text-slate-400">escaneos</span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${currentRound === '3ER_CONTEO' ? 'bg-amber-950/40 border-amber-500/50' : 'bg-slate-950 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">3er Conteo</span>
            {currentRound === '3ER_CONTEO' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">ACTIVO</span>
            )}
          </div>
          <div className="mt-1 text-lg font-mono font-bold text-amber-400">
            {scansCountInRound.round3} <span className="text-xs font-normal text-slate-400">escaneos</span>
          </div>
        </div>
      </div>

      {/* Action Buttons for Gerente */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Acciones de Gerencia disponibles:</span>
          <span className="text-[11px] text-slate-500">Se aplica inmediatamente a todas las TC26</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Action 1: If in 1st round -> Advance to 2nd round */}
          {currentRound === '1ER_CONTEO' && (
            <button
              onClick={() =>
                handleOpenConfirm(
                  '2DO_CONTEO',
                  '¿Autorizar y pasar al 2do Conteo?',
                  'Todos los operadores en sus terminales TC26 comenzarán a registrar los productos en la Hoja 2 de Excel.',
                  'Sí, Autorizar 2do Conteo',
                  'bg-blue-600 hover:bg-blue-500 text-white'
                )
              }
              className="p-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-between col-span-1 sm:col-span-2"
            >
              <div className="text-left">
                <div>Autorizar y Pasar al 2do Conteo</div>
                <div className="text-[11px] text-blue-200 font-normal">
                  Habilita la Hoja 2 de Excel para cotejo de inventario
                </div>
              </div>
              <ArrowRight className="w-5 h-5 shrink-0" />
            </button>
          )}

          {/* Action 2: If in 2nd round -> Either 3rd round OR finalize */}
          {currentRound === '2DO_CONTEO' && (
            <>
              <button
                onClick={() =>
                  handleOpenConfirm(
                    '3ER_CONTEO',
                    '¿Autorizar 3er Conteo Extraordinario?',
                    'Habilita a los operarios una ronda extraordinaria para desempatar aquellos racks o SKUs donde hubo discrepancias.',
                    'Sí, Autorizar 3er Conteo',
                    'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  )
                }
                className="p-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-between"
              >
                <div className="text-left">
                  <div>Pasar a 3er Conteo Extraordinario</div>
                  <div className="text-[11px] text-slate-900 font-normal">
                    Para desempate por discrepancias
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </button>

              <button
                onClick={() =>
                  handleOpenConfirm(
                    'CONTEO_FINALIZADO',
                    '¿Finalizar Conteo Definitivamente?',
                    'El inventario quedará cerrado oficialmente tras el 2do conteo. Se bloqueará el escaneo en las terminales TC26.',
                    'Sí, Finalizar Definitivamente',
                    'bg-emerald-600 hover:bg-emerald-500 text-white'
                  )
                }
                className="p-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-between"
              >
                <div className="text-left">
                  <div>Finalizar Conteo Definitivamente</div>
                  <div className="text-[11px] text-emerald-100 font-normal">
                    Concluir auditoría sin 3er conteo
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              </button>
            </>
          )}

          {/* Action 3: If in 3rd round -> Finalize definitely */}
          {currentRound === '3ER_CONTEO' && (
            <button
              onClick={() =>
                handleOpenConfirm(
                  'CONTEO_FINALIZADO',
                  '¿Finalizar Conteo Definitivamente?',
                  'Concluye formalmente la auditoría tras completar el 3er conteo de desempate. Las terminales TC26 detendrán el registro.',
                  'Sí, Finalizar y Cerrar Auditoría',
                  'bg-emerald-600 hover:bg-emerald-500 text-white'
                )
              }
              className="p-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-between col-span-1 sm:col-span-2"
            >
              <div className="text-left">
                <div>Finalizar y Cerrar Conteo Definitivamente</div>
                <div className="text-[11px] text-emerald-100 font-normal">
                  Cierra la auditoría física completa
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            </button>
          )}

          {/* Action 4: If already finalized, allow starting new cycle */}
          {currentRound === 'CONTEO_FINALIZADO' && (
            <div className="col-span-1 sm:col-span-2 p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-2">
              <div className="text-xs text-slate-300">
                El conteo está marcado como <strong>Finalizado</strong>.
              </div>
              <button
                onClick={() =>
                  handleOpenConfirm(
                    '1ER_CONTEO',
                    '¿Iniciar Nuevo Ciclo de Inventario?',
                    'Reiniciará la ronda al 1er Conteo para permitir nuevos escaneos en las terminales TC26.',
                    'Sí, Iniciar Nuevo Ciclo',
                    'bg-emerald-600 hover:bg-emerald-500 text-white'
                  )
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                Comenzar Nuevo Ciclo (1er Conteo)
              </button>
            </div>
          )}
        </div>

        {/* Action: Reiniciar Ciclo (always available as emergency / reset option) */}
        {currentRound !== '1ER_CONTEO' && currentRound !== 'CONTEO_FINALIZADO' && (
          <div className="pt-1 flex justify-end">
            <button
              onClick={() =>
                handleOpenConfirm(
                  '1ER_CONTEO',
                  '¿Reiniciar ciclo al 1er Conteo?',
                  'Regresará el estado activo al 1er Conteo. Los registros ya subidos a SharePoint permanecen intactos en Excel.',
                  'Sí, Reiniciar a 1er Conteo',
                  'bg-rose-600 hover:bg-rose-500 text-white'
                )
              }
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-800/80 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar ciclo al 1er Conteo</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-indigo-500 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold inline-block">
                AUTORIZACIÓN DE GERENCIA
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {confirmModal.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleExecuteChange}
                className={`min-h-[48px] px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${confirmModal.confirmButtonColor}`}
                autoFocus
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{confirmModal.confirmButtonText}</span>
              </button>

              <button
                onClick={() => setConfirmModal(null)}
                className="min-h-[48px] px-3 sm:px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap"
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
