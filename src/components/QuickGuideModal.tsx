import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  X,
  Scan,
  Users,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  ShieldAlert,
  Zap,
  Check
} from 'lucide-react';
import { UserRole } from '../types/inventory';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  activeTab: 'scanner' | 'history' | 'powerautomate';
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  isOpen,
  onClose,
  userRole,
  activeTab,
}) => {
  const [guideTab, setGuideTab] = useState<'operator' | 'manager'>('operator');

  useEffect(() => {
    if (isOpen) {
      if (userRole === 'OPERADOR_APK' || activeTab === 'scanner') {
        setGuideTab('operator');
      } else {
        setGuideTab('manager');
      }
    }
  }, [isOpen, userRole, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Guía Rápida Operativa
              </h3>
              <p className="text-[11px] text-slate-400">
                Reglas clave para escaneo en TC26 y control de inventario
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Guide Tabs (Only show Gerencia tab in Web mode) */}
        {userRole !== 'OPERADOR_APK' && (
          <div className="px-4 sm:px-5 pt-3 flex items-center gap-2 border-b border-slate-800/80 pb-3 shrink-0 bg-slate-950/40">
            <button
              type="button"
              onClick={() => setGuideTab('operator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                guideTab === 'operator'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Operador TC26</span>
            </button>

            <button
              type="button"
              onClick={() => setGuideTab('manager')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                guideTab === 'manager'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Gerencia Web</span>
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs leading-relaxed">
          {guideTab === 'operator' ? (
            <>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] flex items-center justify-center shrink-0">1</span>
                  <span>Registro inicial del operador (Usuarios 1 al 14)</span>
                </div>
                <p className="text-slate-300 pl-7">
                  Al abrir la terminal, ingresa tu nombre completo y selecciona el número de usuario asignado. Tu ronda activa (<strong className="text-emerald-400">1er</strong>, <strong className="text-blue-400">2do</strong> o <strong className="text-amber-400">3er Conteo</strong>) se sincroniza desde Gerencia.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] flex items-center justify-center shrink-0">2</span>
                  <span>Lectura de QR y regla de Fila 1 (Picking)</span>
                </div>
                <p className="text-slate-300 pl-7">
                  Formato de localizador: <code className="font-mono text-emerald-400">Rack-Columna-Fila</code> (ej. <code className="font-mono text-slate-200">A-22-1</code> o <code className="font-mono text-slate-200">A-1-6</code>).
                </p>
                <div className="ml-7 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-2">
                  <PackageCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Solo el último número en <strong>-1</strong> (Fila 1) se detecta como <strong>Picking</strong>: desbloquea la casilla <strong>SKU</strong> y pausa la auto-subida para validar físicamente. Niveles 2 en adelante (ej. <code className="font-mono">A-1-6</code>) son ubicaciones normales.
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] flex items-center justify-center shrink-0">3</span>
                  <span>Bloqueo automático de ubicaciones repetidas</span>
                </div>
                <p className="text-slate-300 pl-7 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Si un localizador ya fue escaneado en tu ronda activa por ti o por otro usuario, la app limpia las casillas y muestra una alerta para impedir duplicados en Excel. Al cambiar de ronda (ej. a 2do Conteo), podrás volver a escanear las ubicaciones para ese conteo.
                  </span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] flex items-center justify-center shrink-0">4</span>
                  <span>Modo Auto-Subida (1.5s) vs Manual</span>
                </div>
                <p className="text-slate-300 pl-7 flex items-start gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Con <strong>Auto-Subida</strong> activa, cada QR válido (no picking) se envía a Excel tras 1.5 segundos salvo que toques <strong>Cancelar</strong> o edites cantidad/datos. En modo <strong>Manual</strong>, confirma con <strong>Subir Información a Excel</strong>.
                  </span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] flex items-center justify-center shrink-0">1</span>
                  <span>Avance individual o grupal de rondas (14 Usuarios)</span>
                </div>
                <p className="text-slate-300 pl-7">
                  Puedes avanzar a cualquier usuario del <strong>1er Conteo</strong> al <strong>2do</strong> o <strong>3er Conteo</strong> de forma individual conforme termine su zona, sin detener a los demás operadores.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] flex items-center justify-center shrink-0">2</span>
                  <span>Diferencia entre Limpiar Monitoreo y Forzar Re-login</span>
                </div>
                <div className="pl-7 space-y-1.5">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                    <strong className="text-white">Limpiar Monitoreo:</strong> Solo limpia las tarjetas visuales del tablero en vivo (útil si quedaron terminales inactivas). <strong>No</strong> borra escaneos ni cierra sesión a nadie.
                  </div>
                  <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200">
                    <strong className="text-amber-300">Forzar Re-login (Handhelds):</strong> Envía orden remota a todas las TC26 para cerrar sesión, regresarlas al 1er Conteo y pedir nombre y usuario nuevamente.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] flex items-center justify-center shrink-0">3</span>
                  <span>Respaldo CSV y limpieza de Supabase</span>
                </div>
                <p className="text-slate-300 pl-7 flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    Antes de usar <strong>Borrar QR de Supabase</strong> al iniciar una nueva prueba o jornada, descarga primero <strong>Descargar Copia Excel (.CSV)</strong>.
                  </span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] flex items-center justify-center shrink-0">4</span>
                  <span>Cierre definitivo de auditoría</span>
                </div>
                <p className="text-slate-300 pl-7 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Al elegir <strong>Finalizar Conteo Definitivamente</strong>, todas las handhelds bloquean el escáner y muestran al operador el resumen de sus piezas y códigos capturados.
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Entendido</span>
          </button>
        </div>
      </div>
    </div>
  );
};
