import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Trash2, 
  CheckCircle2, 
  ExternalLink,
  Copy,
  Check,
  Search,
  Edit3,
  AlertTriangle,
  Database,
  ShieldAlert,
  X,
  Loader2,
  Code,
  RotateCcw
} from 'lucide-react';
import { ScannedItem, PowerAutomateConfig, UserRole, DeviceStatusSummary, CountRound } from '../types/inventory';
import { exportScansToCsv } from '../utils/storage';
import { soundManager } from '../utils/audioHaptics';
import { SUPABASE_DELETE_POLICY_SQL } from '../utils/supabaseSql';
import { DeviceMonitoringPanel } from './DeviceMonitoringPanel';
import { GerenteRoundControl } from './GerenteRoundControl';
import { GerenteUserAssignmentPanel } from './GerenteUserAssignmentPanel';

interface HistoryViewProps {
  scans: ScannedItem[];
  powerAutomateConfig: PowerAutomateConfig;
  onClearHistory: () => void;
  userRole: UserRole;
  deviceSummaries: DeviceStatusSummary[];
  onUpdateExcelLink?: (newUrl: string) => void;
  currentRound: CountRound;
  userRounds: Record<number, CountRound>;
  onAuthorizeRound: (nextRound: CountRound) => void;
  onSetUserRound: (userNumber: number, round: CountRound) => void;
  onSetAllUsersRound: (round: CountRound) => void;
  scansCountInRound: {
    round1: number;
    round2: number;
    round3: number;
  };
  round2Authorizations?: Record<number, boolean>;
  onToggleUserRound2?: (userNumber: number) => void;
  onSetAllUsersRound2?: (enabled: boolean) => void;
  onDeleteScanFromSupabase?: (scanId: string) => Promise<boolean>;
  onDeleteAllScansFromSupabase?: () => Promise<boolean>;
  onRefreshCloudScans?: () => Promise<number>;
  onDeleteTerminalSession?: (deviceId: string) => Promise<boolean>;
  onClearAllTerminalSessions?: () => Promise<boolean>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  scans,
  powerAutomateConfig,
  onClearHistory,
  userRole,
  deviceSummaries,
  onUpdateExcelLink,
  currentRound,
  userRounds,
  onAuthorizeRound,
  onSetUserRound,
  onSetAllUsersRound,
  scansCountInRound,
  round2Authorizations,
  onToggleUserRound2,
  onSetAllUsersRound2,
  onDeleteScanFromSupabase,
  onDeleteAllScansFromSupabase,
  onRefreshCloudScans,
  onDeleteTerminalSession,
  onClearAllTerminalSessions,
}) => {
  const [search, setSearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [editedLink, setEditedLink] = useState(powerAutomateConfig.excelFileDirectUrl || '');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Delete from Supabase modal states (Exclusive to MASTER)
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<
    | { type: 'all' }
    | { type: 'single'; item: ScannedItem }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [copiedDeleteSql, setCopiedDeleteSql] = useState(false);
  const [deleteFeedbackToast, setDeleteFeedbackToast] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!onRefreshCloudScans) return;
    setIsRefreshing(true);
    try {
      const count = await onRefreshCloudScans();
      soundManager.playSuccess();
      setDeleteFeedbackToast(`Sincronización completada: ${count} registros verificados en Supabase.`);
      setTimeout(() => setDeleteFeedbackToast(null), 3500);
    } catch (err: unknown) {
      soundManager.playError();
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteFeedbackToast(`Error al recargar: ${msg}`);
      setTimeout(() => setDeleteFeedbackToast(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filtered = scans.filter((s) => {
    const q = (search || '').toLowerCase();
    return (
      (s.sku || '').toLowerCase().includes(q) ||
      (s.descripcion || '').toLowerCase().includes(q) ||
      (s.localizador || '').toLowerCase().includes(q) ||
      (s.subinventario || '').toLowerCase().includes(q) ||
      (s.operador || '').toLowerCase().includes(q)
    );
  });

  const totalPiezas = scans.reduce((sum, s) => sum + s.cantidad, 0);

  const roundName = (r: string) => {
    if (r === '1ER_CONTEO') return '1er Conteo';
    if (r === '2DO_CONTEO') return '2do Conteo';
    if (r === '3ER_CONTEO') return '3er Conteo Extraordinario';
    return 'Finalizado';
  };

  const excelUrl = powerAutomateConfig.excelFileDirectUrl || 
    (powerAutomateConfig.sharepointSiteUrl 
      ? `${powerAutomateConfig.sharepointSiteUrl}/${powerAutomateConfig.excelFileName || 'Inventario_SharePoint.xlsx'}` 
      : 'https://tuempresa.sharepoint.com/:x:/r/sites/Almacen/Documentos%20compartidos/Inventario_SharePoint.xlsx?web=1');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(excelUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveEditedLink = () => {
    if (onUpdateExcelLink && editedLink.trim()) {
      onUpdateExcelLink(editedLink.trim());
      setIsEditingLink(false);
    }
  };

  const handleCopyDeleteSql = () => {
    navigator.clipboard.writeText(SUPABASE_DELETE_POLICY_SQL);
    setCopiedDeleteSql(true);
    setTimeout(() => setCopiedDeleteSql(false), 2000);
  };

  const handleExecuteDelete = async () => {
    if (!confirmDeleteModal) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);

    try {
      if (confirmDeleteModal.type === 'all') {
        if (!onDeleteAllScansFromSupabase) {
          throw new Error('Función de eliminación de Supabase no configurada.');
        }
        const ok = await onDeleteAllScansFromSupabase();
        if (!ok) {
          throw new Error(
            'Supabase rechazó la eliminación. Es necesario ejecutar la política RLS de DELETE en el SQL Editor de Supabase.'
          );
        }
        soundManager.playSuccess();
        setDeleteFeedbackToast(`✓ Se han eliminado todos los registros de Supabase exitosamente.`);
        setConfirmDeleteModal(null);
        setTimeout(() => setDeleteFeedbackToast(null), 4000);
      } else {
        if (!onDeleteScanFromSupabase) {
          throw new Error('Función de eliminación de Supabase no configurada.');
        }
        const targetItem = confirmDeleteModal.item;
        const ok = await onDeleteScanFromSupabase(targetItem.id);
        if (!ok) {
          throw new Error(
            'Supabase rechazó la eliminación. Es necesario ejecutar la política RLS de DELETE en el SQL Editor de Supabase.'
          );
        }
        soundManager.playSuccess();
        setDeleteFeedbackToast(`✓ Se eliminó el registro SKU: ${targetItem.sku} (${targetItem.localizador}) de Supabase.`);
        setConfirmDeleteModal(null);
        setTimeout(() => setDeleteFeedbackToast(null), 4000);
      }
    } catch (err: any) {
      soundManager.playError();
      setDeleteErrorMessage(err?.message || 'Error al eliminar en Supabase.');
    } finally {
      setIsDeleting(false);
    }
  };

  // RESTRICCIÓN: En la versión APK (handheld), los datos escaneados NO se pueden ver ni consultar
  if (userRole === 'OPERADOR_APK') {
    return (
      <div className="max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-white text-base">Acceso Exclusivo a Escaneo Láser</h3>
        <p className="text-xs text-slate-400">
          La consulta, historial y administración de datos escaneados solo está permitida desde la versión web para Gerencia y Master.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* EXCLUSIVO GERENTE: Opciones para pasar de 1er a 2do y 3er conteo, finalizar o reiniciar ciclo */}
      <GerenteRoundControl
        currentRound={currentRound}
        onAuthorizeRound={onAuthorizeRound}
        scansCountInRound={scansCountInRound}
        totalScans={scans.length}
      />

      {/* EXCLUSIVO GERENTE: Asignación y Avance Individual al 2do Conteo */}
      <GerenteUserAssignmentPanel
        currentRound={currentRound}
        userRounds={userRounds}
        onSetUserRound={onSetUserRound}
        onSetAllUsersRound={onSetAllUsersRound}
        authorizations={round2Authorizations}
        onToggleUser={onToggleUserRound2}
        onSetAllUsers={onSetAllUsersRound2}
        scans={scans}
        deviceSummaries={deviceSummaries}
      />

      {/* REQUIRED ESPACIO: Link del archivo de Excel en SharePoint */}
      <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-4 md:p-5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                Archivo de Excel en SharePoint (Datos en Vivo)
              </h2>
              <p className="text-[11px] text-slate-400">
                Pestaña de Excel donde se registran en tiempo real los códigos escaneados
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700 whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copiado' : 'Copiar Link'}</span>
            </button>

            <a
              href={excelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              <span>Abrir en SharePoint</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>

            {userRole === 'MASTER' && !isEditingLink && (
              <button
                onClick={() => {
                  setEditedLink(excelUrl);
                  setIsEditingLink(true);
                }}
                className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 text-xs"
                title="Editar URL directa de Excel (Solo Master)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Link preview box */}
        {!isEditingLink ? (
          <div className="space-y-1.5">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 select-all truncate flex-1">
                {excelUrl}
              </span>
            </div>
            {userRole !== 'MASTER' && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                Configuración de SharePoint y Supabase restringida exclusivamente al Usuario Master.
              </p>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              value={editedLink}
              onChange={(e) => setEditedLink(e.target.value)}
              placeholder="https://tuempresa.sharepoint.com/:x:/r/..."
              className="flex-1 h-9 bg-slate-950 border border-slate-700 rounded-lg px-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <button
              onClick={handleSaveEditedLink}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg"
            >
              Guardar Link
            </button>
            <button
              onClick={() => setIsEditingLink(false)}
              className="px-2 text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Control en Vivo de Terminales TC26 (Quién va por Conteo 1 y quién por Conteo 2) */}
      <DeviceMonitoringPanel 
        devices={deviceSummaries} 
        userRole={userRole}
        onDeleteTerminalSession={onDeleteTerminalSession}
        onClearAllTerminalSessions={onClearAllTerminalSessions}
      />

      {/* KPI Summary Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Registros Subidos:</span>
            <span className="text-xl font-mono font-bold text-white tabular-nums">{scans.length}</span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-slate-400 block text-[11px]">Total de Piezas Contadas:</span>
            <span className="text-xl font-mono font-bold text-amber-400 tabular-nums">{totalPiezas.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefreshCloudScans && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap"
              title="Volver a consultar y descargar todos los escaneos desde Supabase"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
              <span>{isRefreshing ? 'Consultando...' : 'Recargar de Supabase'}</span>
            </button>
          )}

          <button
            onClick={() => exportScansToCsv(scans)}
            disabled={scans.length === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Descargar Copia Excel (.CSV)</span>
            <span className="sm:hidden">Descargar Excel (.CSV)</span>
          </button>

          {/* BOTÓN EXCLUSIVO MASTER: Eliminar registros de Supabase con ventana de confirmación */}
          {userRole === 'MASTER' && (
            <button
              onClick={() => setConfirmDeleteModal({ type: 'all' })}
              disabled={scans.length === 0}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40 active:scale-95 whitespace-nowrap"
              title="Eliminar permanentemente todos los escaneos de Supabase (Acceso Master)"
            >
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
              <Database className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Borrar de Supabase (Master)</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Feedback Toast */}
      {deleteFeedbackToast && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{deleteFeedbackToast}</span>
          </div>
          <button
            onClick={() => setDeleteFeedbackToast(null)}
            className="text-slate-400 hover:text-white text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en historial por SKU, descripción, localizador..."
          className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Table of Scans */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4">Ronda</th>
                <th className="py-3 px-4">SKU & Descripción</th>
                <th className="py-3 px-4 text-right">Cantidad</th>
                <th className="py-3 px-4">Subinv. / Localizador</th>
                <th className="py-3 px-4 text-center">Estado Excel</th>
                {userRole === 'MASTER' && (
                  <th className="py-3 px-3 text-center text-rose-400 whitespace-nowrap">
                    Eliminar (Master)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={userRole === 'MASTER' ? 7 : 6} className="py-8 text-center text-slate-500 text-xs">
                    {scans.length === 0
                      ? 'No hay registros subidos todavía. Escanea un código QR con la TC26 y presiona "Subir Información a Excel".'
                      : 'No se encontraron registros con esa búsqueda.'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {roundName(item.conteoRound)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-white text-xs">{item.sku}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.descripcion}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm tabular-nums">
                      {item.cantidad}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-emerald-400 font-bold text-xs">{item.localizador}</div>
                      <div className="text-[10px] text-slate-500">{item.subinventario}</div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {item.syncStateSharepoint === 'synced' ? (
                        <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Subido</span>
                        </span>
                      ) : (
                        <span className="text-blue-400 font-semibold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Local</span>
                        </span>
                      )}
                    </td>
                    {/* BOTÓN INDIVIDUAL DE ELIMINACIÓN DE SUPABASE (SOLO MASTER) */}
                    {userRole === 'MASTER' && (
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setConfirmDeleteModal({ type: 'single', item })}
                          title="Eliminar este escaneo de Supabase (Acceso Master)"
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL / VENTANA DE CONFIRMACIÓN DE ELIMINACIÓN EN SUPABASE (EXCLUSIVO MASTER) */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative">
            <button
              onClick={() => {
                if (!isDeleting) {
                  setConfirmDeleteModal(null);
                  setDeleteErrorMessage(null);
                }
              }}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon & Title */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold uppercase inline-block">
                  Acceso Exclusivo Usuario Master
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  ¿Estás seguro de que deseas eliminar de Supabase?
                </h3>
              </div>
            </div>

            {/* Description & Item Breakdown */}
            <div className="space-y-2 text-xs">
              {confirmDeleteModal.type === 'all' ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-slate-300">
                  <p className="font-semibold text-rose-300">
                    Se borrarán permanentemente todos los registros escaneados:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Total Registros:</span>
                      <span className="text-white font-bold text-sm">{scans.length}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Total Piezas:</span>
                      <span className="text-amber-400 font-bold text-sm">{totalPiezas.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    Destino: Tabla <code className="text-emerald-400 font-mono">inventory_scans</code> en Supabase Cloud.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-slate-300">
                  <p className="font-semibold text-rose-300">
                    Se eliminará permanentemente este registro de Supabase:
                  </p>
                  <div className="text-[11px] space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">SKU:</span>
                      <span className="text-white font-bold">{confirmDeleteModal.item.sku}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Localizador:</span>
                      <span className="text-emerald-400 font-bold">{confirmDeleteModal.item.localizador}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cantidad:</span>
                      <span className="text-amber-400 font-bold">{confirmDeleteModal.item.cantidad} pzs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ronda:</span>
                      <span className="text-slate-300">{roundName(confirmDeleteModal.item.conteoRound)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-xl text-[11px] text-rose-200 leading-snug">
                ⚠️ <strong>Advertencia irreversible:</strong> Esta acción borrará la información de la base de datos en Supabase. Si necesitas conservar un respaldo, asegúrate de haber descargado la copia en Excel (.CSV) antes.
              </div>
            </div>

            {/* Error Message if RLS DELETE is not enabled in Supabase */}
            {deleteErrorMessage && (
              <div className="p-3 bg-rose-950/70 border border-rose-500/60 rounded-xl text-xs space-y-2">
                <div className="text-rose-200 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{deleteErrorMessage}</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-bold">Script SQL para permitir DELETE en Supabase:</span>
                    <button
                      onClick={handleCopyDeleteSql}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white flex items-center gap-1"
                    >
                      {copiedDeleteSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDeleteSql ? 'Copiado' : 'Copiar SQL'}</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-1.5 bg-slate-900 rounded border border-slate-800 max-h-24">
                    {SUPABASE_DELETE_POLICY_SQL}
                  </pre>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteModal(null);
                  setDeleteErrorMessage(null);
                }}
                disabled={isDeleting}
                className="min-h-[46px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="min-h-[46px] px-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Eliminando en Supabase...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Sí, Eliminar de Supabase</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
