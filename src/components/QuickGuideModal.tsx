import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  Check,
} from 'lucide-react';
import { UserRole } from '../types/inventory';
import { Accordion, Tabs } from './ui/Controls';
import { EASE_OUT_EXPO, FadeSlide, TactileButton } from './ui/MotionPrimitives';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
        className="glass-surface-strong border border-amber-500/45 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
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
            aria-label="Cerrar guía"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shared-element Tabs (hidden on APK) */}
        {userRole !== 'OPERADOR_APK' && (
          <div className="px-4 sm:px-5 py-3 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
            <Tabs
              layoutGroup="quick-guide-tabs"
              value={guideTab}
              onChange={setGuideTab}
              items={[
                { id: 'operator', label: 'Operador TC26', icon: <Scan className="w-3.5 h-3.5" /> },
                { id: 'manager', label: 'Gerencia Web', icon: <Users className="w-3.5 h-3.5" /> },
              ]}
            />
          </div>
        )}

        {/* Scrollable Content with Accordions */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 text-xs leading-relaxed">
          {guideTab === 'operator' ? (
            <FadeSlide className="space-y-2.5">
              <Accordion
                defaultOpen
                title="1. Registro inicial del operador (Usuarios 1 al 14)"
              >
                <p className="text-slate-300 pt-2">
                  Al abrir la terminal, ingresa tu nombre completo y selecciona el número asignado. Tu ronda (<strong className="text-emerald-400">1er</strong>, <strong className="text-blue-400">2do</strong> o <strong className="text-amber-400">3er Conteo</strong>) se sincroniza en vivo desde Gerencia.
                </p>
              </Accordion>

              <Accordion
                defaultOpen
                title={
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. Lectura de QR y regla de Fila 1 (Picking)</span>
                  </span>
                }
              >
                <div className="space-y-2 pt-2 text-slate-300">
                  <p>
                    Formato de localizador: <code className="font-mono text-emerald-400">Rack-Columna-Fila</code> (ej. <code className="font-mono text-slate-200">A-22-1</code> o <code className="font-mono text-slate-200">A-1-6</code>).
                  </p>
                  <p className="text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                    Solo los localizadores terminados en <strong>-1</strong> (Fila 1) se detectan como <strong>Picking</strong>: desbloquean el SKU y pausan la auto-subida para verificar físicamente.
                  </p>
                </div>
              </Accordion>

              <Accordion
                title={
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>3. Bloqueo automático de ubicaciones repetidas</span>
                  </span>
                }
              >
                <p className="text-slate-300 pt-2">
                  Si un localizador ya fue escaneado en tu ronda activa por ti o por otro operador, la app limpia las casillas y muestra una alerta para evitar duplicados en Excel. Al cambiar de ronda podrás volver a escanear esa ubicación.
                </p>
              </Accordion>

              <Accordion
                title={
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>4. Modo Auto-Subida ajustable vs Manual</span>
                  </span>
                }
              >
                <p className="text-slate-300 pt-2">
                  Activa el switch <strong>Auto-Subida</strong> y ajusta su velocidad (0.8s a 3.0s) desde el botón de ajustes del escáner. Toca <strong>Cancelar</strong> o edita cantidad en cualquier momento antes de que termine la cuenta regresiva.
                </p>
              </Accordion>
            </FadeSlide>
          ) : (
            <FadeSlide className="space-y-2.5">
              <Accordion
                defaultOpen
                title="1. Avance individual o grupal de rondas (14 Usuarios)"
              >
                <p className="text-slate-300 pt-2">
                  Avanza a cualquier usuario del <strong>1er</strong> al <strong>2do</strong> o <strong>3er Conteo</strong> individualmente cuando termine su zona, sin detener a los demás operadores.
                </p>
              </Accordion>

              <Accordion
                defaultOpen
                title="2. Limpiar Monitoreo vs Forzar Re-login"
              >
                <div className="space-y-2 pt-2">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    <strong className="text-white">Limpiar Monitoreo:</strong> Retira tarjetas inactivas del tablero visual sin borrar escaneos ni cerrar sesiones.
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200">
                    <strong className="text-amber-300">Forzar Re-login:</strong> Cierra sesión remota en las handhelds, regresa a 1er Conteo y pide nombre y usuario de nuevo.
                  </div>
                </div>
              </Accordion>

              <Accordion
                title={
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>3. Respaldo CSV y limpieza de Supabase</span>
                  </span>
                }
              >
                <p className="text-slate-300 pt-2">
                  Antes de usar <strong>Borrar QR de Supabase</strong>, descarga primero <strong>Descargar Copia Excel (.CSV)</strong> desde la pestaña Tabla & Respaldo.
                </p>
              </Accordion>

              <Accordion
                title={
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>4. Cierre definitivo de auditoría</span>
                  </span>
                }
              >
                <p className="text-slate-300 pt-2">
                  Al elegir <strong>Finalizar Conteo Definitivamente</strong>, las TC26 bloquean el escáner y muestran a cada operador el resumen de sus QR y piezas contadas.
                </p>
              </Accordion>
            </FadeSlide>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <TactileButton
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Entendido</span>
          </TactileButton>
        </div>
      </motion.div>
    </div>
  );
};
