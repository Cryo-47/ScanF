import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  RotateCcw,
  BarChart3,
  Users,
  Smartphone,
  Table2,
  Package,
  Layers,
  Eye,
  FileCheck2,
} from 'lucide-react';
import {
  ScannedItem,
  PowerAutomateConfig,
  UserRole,
  DeviceStatusSummary,
  CountRound,
} from '../types/inventory';
import { exportScansToCsv, normalizeRound } from '../utils/storage';
import { soundManager } from '../utils/audioHaptics';
import { SUPABASE_DELETE_POLICY_SQL } from '../utils/supabaseSql';
import { DeviceMonitoringPanel } from './DeviceMonitoringPanel';
import { GerenteRoundControl } from './GerenteRoundControl';
import { GerenteUserAssignmentPanel } from './GerenteUserAssignmentPanel';
import {
  Accordion,
  AutocompleteInput,
  Badge,
  Checkbox,
  DateRangePicker,
  Drawer,
  Dropzone,
  EmptyState,
  Pagination,
  RadioGroup,
  Select,
  SwipeActionRow,
  TabItem,
  Tabs,
  Tooltip,
} from './ui/Controls';
import { ScansBarChart, ScansLineChart, ScansPieChart } from './ui/Charts';
import {
  EASE_OUT_EXPO,
  FadeSlide,
  PullToRefresh,
  ShakeContainer,
  TactileButton,
} from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

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
  onResetAllDevices?: () => Promise<void>;
  onResetUserDevice?: (userNumber: number) => Promise<void>;
}

type WorkspaceTab = 'resumen' | 'operacion' | 'terminales' | 'registros';
type SortMode = 'recent' | 'qty_desc' | 'sku_asc';

export const HistoryView: React.FC<HistoryViewProps> = ({
  scans,
  powerAutomateConfig,
  userRole,
  deviceSummaries,
  onUpdateExcelLink,
  currentRound,
  userRounds,
  onAuthorizeRound,
  onSetUserRound,
  onSetAllUsersRound,
  scansCountInRound,
  onDeleteScanFromSupabase,
  onDeleteAllScansFromSupabase,
  onRefreshCloudScans,
  onDeleteTerminalSession,
  onClearAllTerminalSessions,
  onResetAllDevices,
  onResetUserDevice,
}) => {
  const { toast } = useToast();

  // Workspace Tab
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('resumen');

  // Search, Filters, Sort & Pagination
  const [search, setSearch] = useState('');
  const [roundFilter, setRoundFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // SharePoint link edit
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [editedLink, setEditedLink] = useState(powerAutomateConfig.excelFileDirectUrl || '');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkShakeKey, setLinkShakeKey] = useState(0);

  // Refresh & Drawer Inspector
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inspectedItem, setInspectedItem] = useState<ScannedItem | null>(null);

  // CSV Dropzone Preview State
  const [csvPreview, setCsvPreview] = useState<{
    fileName: string;
    rowCount: number;
    totalQty: number;
    sampleSkus: string[];
  } | null>(null);

  // Delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<
    | { type: 'all' }
    | { type: 'single'; item: ScannedItem }
    | null
  >(null);
  const [rebootDevicesOnDelete, setRebootDevicesOnDelete] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteShakeKey, setDeleteShakeKey] = useState(0);
  const [copiedDeleteSql, setCopiedDeleteSql] = useState(false);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roundFilter, userFilter, fromDate, toDate, sortMode, pageSize]);

  // Suggestions for AutocompleteInput
  const searchSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const s of scans) {
      if (s.sku) set.add(s.sku);
      if (s.localizador) set.add(s.localizador);
      if (s.subinventario) set.add(s.subinventario);
      if (s.nombreOperadorCompleto) set.add(s.nombreOperadorCompleto);
      if (set.size >= 40) break;
    }
    return Array.from(set);
  }, [scans]);

  // Filtered + Sorted Scans
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scans.filter((s) => {
      if (roundFilter !== 'ALL' && normalizeRound(s.conteoRound) !== roundFilter) {
        return false;
      }
      if (userFilter !== 'ALL') {
        const num = Number(userFilter);
        if (s.userNumber !== num && s.operador !== `Usuario ${num}`) return false;
      }
      if (fromDate || toDate) {
        const isoDay = new Date(s.timestamp).toISOString().slice(0, 10);
        if (fromDate && isoDay < fromDate) return false;
        if (toDate && isoDay > toDate) return false;
      }
      if (!q) return true;
      return (
        (s.sku || '').toLowerCase().includes(q) ||
        (s.descripcion || '').toLowerCase().includes(q) ||
        (s.localizador || '').toLowerCase().includes(q) ||
        (s.subinventario || '').toLowerCase().includes(q) ||
        (s.operador || '').toLowerCase().includes(q) ||
        (s.nombreOperadorCompleto || '').toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    if (sortMode === 'qty_desc') {
      sorted.sort((a, b) => (Number(b.cantidad) || 0) - (Number(a.cantidad) || 0));
    } else if (sortMode === 'sku_asc') {
      sorted.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
    } else {
      sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return sorted;
  }, [scans, search, roundFilter, userFilter, fromDate, toDate, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedScans = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Live KPI metrics
  const totalPiezas = useMemo(
    () => scans.reduce((sum, s) => sum + (Number(s.cantidad) || 0), 0),
    [scans]
  );

  const onlineTerminals = useMemo(() => {
    const now = Date.now();
    return deviceSummaries.filter((d) => {
      if (!d.lastActive || d.status === 'offline') return false;
      const diff = now - new Date(d.lastActive).getTime();
      return diff >= 0 && diff < 60000;
    }).length;
  }, [deviceSummaries]);

  const usersInAdvanced = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= 14; i++) {
      const r = userRounds[i];
      if (r === '2DO_CONTEO' || r === '3ER_CONTEO') count++;
    }
    return count;
  }, [userRounds]);

  const roundName = (r: string) => {
    const norm = normalizeRound(r);
    if (norm === '1ER_CONTEO') return '1er Conteo';
    if (norm === '2DO_CONTEO') return '2do Conteo';
    if (norm === '3ER_CONTEO') return '3er Conteo Extra';
    return 'Finalizado';
  };

  const excelUrl =
    powerAutomateConfig.excelFileDirectUrl ||
    (powerAutomateConfig.sharepointSiteUrl
      ? `${powerAutomateConfig.sharepointSiteUrl}/${
          powerAutomateConfig.excelFileName || 'Inventario_SharePoint.xlsx'
        }`
      : 'https://tuempresa.sharepoint.com/:x:/r/sites/Almacen/Documentos%20compartidos/Inventario_SharePoint.xlsx?web=1');

  const handleRefresh = async () => {
    if (!onRefreshCloudScans) return;
    setIsRefreshing(true);
    try {
      const count = await onRefreshCloudScans();
      soundManager.playSuccess();
      toast({
        variant: 'success',
        title: 'Sincronización completada',
        description: `${count} registros verificados en Supabase Cloud.`,
      });
    } catch (err: unknown) {
      soundManager.playError();
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'error',
        title: 'Error al recargar desde Supabase',
        description: msg,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(excelUrl);
    setCopiedLink(true);
    toast({ variant: 'info', title: 'Enlace de SharePoint copiado' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveEditedLink = () => {
    const trimmed = editedLink.trim();
    if (!trimmed || !/^https?:\/\/.+/i.test(trimmed)) {
      setLinkError('Ingresa una URL válida que inicie con https://');
      setLinkShakeKey((k) => k + 1);
      soundManager.playError();
      return;
    }
    setLinkError(null);
    if (onUpdateExcelLink) {
      onUpdateExcelLink(trimmed);
      setIsEditingLink(false);
      soundManager.playSuccess();
      toast({
        variant: 'success',
        title: 'Enlace de SharePoint actualizado',
        description: 'Sincronizado en Supabase para todo el equipo.',
      });
    }
  };

  const handleCopyDeleteSql = () => {
    navigator.clipboard.writeText(SUPABASE_DELETE_POLICY_SQL);
    setCopiedDeleteSql(true);
    toast({ variant: 'info', title: 'Script SQL copiado al portapapeles' });
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
        if (rebootDevicesOnDelete && onResetAllDevices) {
          await onResetAllDevices();
        }
        const ok = await onDeleteAllScansFromSupabase();
        if (!ok) {
          throw new Error(
            'Supabase rechazó la eliminación. Ejecuta la política RLS de DELETE en el SQL Editor de Supabase.'
          );
        }
        soundManager.playSuccess();
        toast({
          variant: 'success',
          title: 'Registros eliminados de Supabase',
          description: rebootDevicesOnDelete
            ? 'Orden de re-login enviada a todas las terminales TC26 (1er Conteo).'
            : 'Se han borrado todos los registros escaneados en la nube.',
        });
        setConfirmDeleteModal(null);
      } else {
        if (!onDeleteScanFromSupabase) {
          throw new Error('Función de eliminación de Supabase no configurada.');
        }
        const targetItem = confirmDeleteModal.item;
        const ok = await onDeleteScanFromSupabase(targetItem.id);
        if (!ok) {
          throw new Error(
            'Supabase rechazó la eliminación. Ejecuta la política RLS de DELETE en el SQL Editor de Supabase.'
          );
        }
        soundManager.playSuccess();
        toast({
          variant: 'success',
          title: `Registro eliminado (${targetItem.sku})`,
          description: `Localizador ${targetItem.localizador} removido de Supabase.`,
        });
        if (inspectedItem?.id === targetItem.id) {
          setInspectedItem(null);
        }
        setConfirmDeleteModal(null);
      }
    } catch (err: any) {
      soundManager.playError();
      setDeleteErrorMessage(err?.message || 'Error al eliminar en Supabase.');
      setDeleteShakeKey((k) => k + 1);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCsvDrop = (fileName: string, content: string) => {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      toast({
        variant: 'warning',
        title: 'Archivo CSV vacío o sin filas',
        description: fileName,
      });
      return;
    }
    const dataRows = lines.slice(1);
    let totalQty = 0;
    const sampleSkus: string[] = [];

    for (const line of dataRows) {
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      // Try finding SKU & Quantity across standard export columns
      if (cols[2] && sampleSkus.length < 5) sampleSkus.push(cols[2]);
      const maybeQty = Number(cols[3]);
      if (!isNaN(maybeQty)) totalQty += maybeQty;
    }

    setCsvPreview({
      fileName,
      rowCount: dataRows.length,
      totalQty,
      sampleSkus,
    });
    soundManager.playSuccess();
    toast({
      variant: 'success',
      title: 'Respaldo CSV verificado',
      description: `${dataRows.length} registros listados en modo solo lectura.`,
    });
  };

  // RESTRICCIÓN: En la versión APK (handheld), los datos escaneados NO se pueden ver ni consultar
  if (userRole === 'OPERADOR_APK') {
    return (
      <div className="max-w-md mx-auto p-6 glass-surface border border-slate-800 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-white text-base">Acceso Exclusivo a Escaneo Láser</h3>
        <p className="text-xs text-slate-400">
          La consulta, historial y administración de datos escaneados solo está permitida desde la
          versión web para Gerencia y Master.
        </p>
      </div>
    );
  }

  const workspaceTabs: TabItem<WorkspaceTab>[] = [
    { id: 'resumen', label: 'Resumen & Analítica', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'operacion', label: 'Rondas & 14 Usuarios', icon: <Users className="w-3.5 h-3.5" /> },
    {
      id: 'terminales',
      label: 'Terminales TC26',
      icon: <Smartphone className="w-3.5 h-3.5" />,
      badge: onlineTerminals,
    },
    {
      id: 'registros',
      label: 'Tabla Excel & CSV',
      icon: <Table2 className="w-3.5 h-3.5" />,
      badge: scans.length,
    },
  ];

  const userFilterOptions = [
    { value: 'ALL', label: 'Todos los usuarios (1–14)' },
    ...Array.from({ length: 14 }, (_, i) => ({
      value: String(i + 1),
      label: `Usuario ${i + 1}`,
    })),
  ];

  return (
    <div className="w-full space-y-5">
      {/* Shared-element Workspace Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={workspaceTabs}
          value={workspaceTab}
          onChange={setWorkspaceTab}
          layoutGroup="history-workspace"
        />
      </div>

      {/* ===================================================================
       * TAB 1: RESUMEN & ANALÍTICA (KPI Cards + SharePoint + 3 Charts)
       * =================================================================== */}
      {workspaceTab === 'resumen' && (
        <FadeSlide className="space-y-5">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="glass-surface rounded-2xl p-4 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Registros Subidos</span>
                <Table2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-white tabular-nums">
                {scans.length.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                R1: {scansCountInRound.round1} • R2: {scansCountInRound.round2} • R3:{' '}
                {scansCountInRound.round3}
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-4 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Piezas Contadas</span>
                <Package className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-amber-400 tabular-nums">
                {totalPiezas.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">Suma total del inventario</div>
            </div>

            <div className="glass-surface rounded-2xl p-4 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Terminales En Línea</span>
                <Smartphone className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-blue-400 tabular-nums">
                {onlineTerminals}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {deviceSummaries.length}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">Zebra TC26 activas (&lt;60s)</div>
            </div>

            <div className="glass-surface rounded-2xl p-4 border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Usuarios en R2 / R3</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-indigo-300 tabular-nums">
                {usersInAdvanced}{' '}
                <span className="text-xs font-normal text-slate-500">/ 14</span>
              </div>
              <div className="text-[11px] text-slate-500">Avance hacia cotejo</div>
            </div>
          </div>

          {/* SharePoint Live Excel Card */}
          <div className="glass-surface border border-emerald-500/35 rounded-2xl p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                    Archivo de Excel en SharePoint (Datos en Vivo)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Libro oficial alimentado automáticamente por Power Automate
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <TactileButton
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 whitespace-nowrap cursor-pointer"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedLink ? 'Copiado' : 'Copiar Link'}</span>
                </TactileButton>

                <a
                  href={excelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-md whitespace-nowrap"
                >
                  <span>Abrir en SharePoint</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>

                {(userRole === 'MASTER' || userRole === 'GERENTE') && !isEditingLink && (
                  <Tooltip content="Editar URL de Excel en SharePoint">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedLink(excelUrl);
                        setLinkError(null);
                        setIsEditingLink(true);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-800 text-xs transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {!isEditingLink ? (
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[11px] font-mono text-slate-400 select-all break-all leading-relaxed block">
                  {excelUrl}
                </span>
              </div>
            ) : (
              <ShakeContainer shakeKey={linkShakeKey} className="space-y-1.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={editedLink}
                    onChange={(e) => {
                      setEditedLink(e.target.value);
                      if (linkError) setLinkError(null);
                    }}
                    placeholder="https://tuempresa.sharepoint.com/:x:/r/..."
                    className={`flex-1 h-10 bg-slate-950 border rounded-xl px-3 text-xs font-mono text-emerald-300 focus:outline-none ${
                      linkError
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-slate-700 focus:border-emerald-400'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <TactileButton
                      type="button"
                      onClick={handleSaveEditedLink}
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Guardar Link
                    </TactileButton>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingLink(false);
                        setLinkError(null);
                      }}
                      className="h-10 px-3 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
                {linkError && (
                  <p className="text-[11px] text-rose-400 font-medium">{linkError}</p>
                )}
              </ShakeContainer>
            )}
          </div>

          {/* 3 Live Interactive Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScansBarChart scans={scans} isLoading={isRefreshing} />
            <ScansPieChart scans={scans} isLoading={isRefreshing} />
          </div>
          <ScansLineChart scans={scans} isLoading={isRefreshing} />
        </FadeSlide>
      )}

      {/* ===================================================================
       * TAB 2: RONDAS & 14 USUARIOS
       * =================================================================== */}
      {workspaceTab === 'operacion' && (
        <FadeSlide className="space-y-5">
          <GerenteRoundControl
            currentRound={currentRound}
            onAuthorizeRound={onAuthorizeRound}
            scansCountInRound={scansCountInRound}
            totalScans={scans.length}
            userRounds={userRounds}
            deviceSummaries={deviceSummaries}
          />
          <GerenteUserAssignmentPanel
            currentRound={currentRound}
            userRounds={userRounds}
            onSetUserRound={onSetUserRound}
            onSetAllUsersRound={onSetAllUsersRound}
            scans={scans}
            deviceSummaries={deviceSummaries}
            onResetUserDevice={onResetUserDevice}
          />
        </FadeSlide>
      )}

      {/* ===================================================================
       * TAB 3: TERMINALES TC26 EN VIVO
       * =================================================================== */}
      {workspaceTab === 'terminales' && (
        <FadeSlide>
          <DeviceMonitoringPanel
            devices={deviceSummaries}
            userRole={userRole}
            onDeleteTerminalSession={onDeleteTerminalSession}
            onClearAllTerminalSessions={onClearAllTerminalSessions}
            onResetAllDevices={onResetAllDevices}
            onResetSingleDevice={async (userNumber, deviceId) => {
              if (userNumber && onResetUserDevice) {
                await onResetUserDevice(userNumber);
              } else if (deviceId && onResetUserDevice) {
                const found = deviceSummaries.find((d) => d.deviceId === deviceId);
                if (found?.userNumber) {
                  await onResetUserDevice(found.userNumber);
                }
              }
            }}
          />
        </FadeSlide>
      )}

      {/* ===================================================================
       * TAB 4: TABLA EXCEL & CSV (Filters, Pagination, Drawer, Swipe, Dropzone)
       * =================================================================== */}
      {workspaceTab === 'registros' && (
        <FadeSlide>
          <PullToRefresh onRefresh={handleRefresh} disabled={!onRefreshCloudScans}>
            <div className="space-y-4">
              {/* Action Toolbar (SINGLE location for CSV Download & Supabase Wipe) */}
              <div className="glass-surface rounded-2xl p-4 border border-slate-800/90 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[11px] text-slate-400 block">
                        Registros Filtrados
                      </span>
                      <span className="text-xl font-mono font-extrabold text-white tabular-nums">
                        {filtered.length}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {scans.length}
                        </span>
                      </span>
                    </div>
                    <div className="border-l border-slate-800 pl-4">
                      <span className="text-[11px] text-slate-400 block">Piezas Totales</span>
                      <span className="text-xl font-mono font-extrabold text-amber-400 tabular-nums">
                        {totalPiezas.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onRefreshCloudScans && (
                      <TactileButton
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="px-3.5 py-2 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 font-semibold rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${
                            isRefreshing ? 'animate-spin text-blue-400' : 'text-blue-400'
                          }`}
                        />
                        <span>{isRefreshing ? 'Consultando...' : 'Recargar de Supabase'}</span>
                      </TactileButton>
                    )}

                    <TactileButton
                      type="button"
                      onClick={() => {
                        exportScansToCsv(filtered.length > 0 ? filtered : scans);
                        toast({
                          variant: 'success',
                          title: 'Copia Excel (.CSV) descargada',
                          description: `${(filtered.length > 0 ? filtered : scans).length} registros exportados.`,
                        });
                      }}
                      disabled={scans.length === 0}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Descargar Copia Excel (.CSV)</span>
                    </TactileButton>

                    {(userRole === 'GERENTE' || userRole === 'MASTER') && (
                      <TactileButton
                        anticipation
                        type="button"
                        onClick={() => setConfirmDeleteModal({ type: 'all' })}
                        className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-500/60 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Borrar QR de Supabase</span>
                      </TactileButton>
                    )}
                  </div>
                </div>

                {/* Filter Controls: Autocomplete, Select Round, Select User, DateRangePicker, RadioGroup Sort */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-slate-800/80">
                  <div className="md:col-span-5">
                    <AutocompleteInput
                      value={search}
                      onChange={setSearch}
                      suggestions={searchSuggestions}
                      placeholder="Buscar por SKU, descripción, localizador, operador..."
                      leftIcon={<Search className="w-4 h-4 text-slate-500" />}
                      inputClassName="w-full h-10 bg-slate-950 border border-slate-700/90 rounded-xl pl-10 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Select
                      ariaLabel="Filtrar por ronda"
                      value={roundFilter}
                      onChange={setRoundFilter}
                      options={[
                        { value: 'ALL', label: 'Todas las rondas' },
                        { value: '1ER_CONTEO', label: '1er Conteo' },
                        { value: '2DO_CONTEO', label: '2do Conteo' },
                        { value: '3ER_CONTEO', label: '3er Conteo' },
                      ]}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <Select
                      ariaLabel="Filtrar por usuario"
                      value={userFilter}
                      onChange={setUserFilter}
                      options={userFilterOptions}
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-start md:justify-end">
                    <DateRangePicker
                      fromDate={fromDate}
                      toDate={toDate}
                      onChange={(f, t) => {
                        setFromDate(f);
                        setToDate(t);
                      }}
                    />
                  </div>
                </div>

                {/* Sort RadioGroup */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <RadioGroup<SortMode>
                    name="history-sort"
                    value={sortMode}
                    onChange={setSortMode}
                    options={[
                      { value: 'recent', label: 'Más reciente' },
                      { value: 'qty_desc', label: 'Mayor cantidad' },
                      { value: 'sku_asc', label: 'SKU A–Z' },
                    ]}
                  />
                  {(search || roundFilter !== 'ALL' || userFilter !== 'ALL' || fromDate || toDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setRoundFilter('ALL');
                        setUserFilter('ALL');
                        setFromDate('');
                        setToDate('');
                      }}
                      className="text-[11px] font-semibold text-amber-400 hover:underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Paginated Table (Desktop) + SwipeActionRow Cards (Mobile) */}
              <div className="glass-surface border border-slate-800/90 rounded-2xl overflow-hidden">
                {paginatedScans.length === 0 ? (
                  <EmptyState
                    icon={<Table2 className="w-5 h-5" />}
                    title={
                      scans.length === 0
                        ? 'No hay registros subidos todavía'
                        : 'Sin resultados para los filtros actuales'
                    }
                    description={
                      scans.length === 0
                        ? 'Escanea un código QR con una terminal Zebra TC26 y presiona "Subir Información a Excel".'
                        : 'Prueba ajustando el texto de búsqueda, la ronda, el usuario o el rango de fechas.'
                    }
                  />
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/90 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-3 px-4">Hora</th>
                            <th className="py-3 px-4">Usuario</th>
                            <th className="py-3 px-4">Ronda</th>
                            <th className="py-3 px-4">SKU &amp; Descripción</th>
                            <th className="py-3 px-4 text-right">Cantidad</th>
                            <th className="py-3 px-4">Subinv. / Localizador</th>
                            <th className="py-3 px-4 text-center">Estado</th>
                            <th className="py-3 px-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {paginatedScans.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => setInspectedItem(item)}
                              className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap tabular-nums">
                                {new Date(item.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <Badge tone="amber">
                                  {item.userNumber
                                    ? `Usuario ${item.userNumber}`
                                    : item.operador || 'Usuario 1'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <Badge
                                  tone={
                                    normalizeRound(item.conteoRound) === '1ER_CONTEO'
                                      ? 'emerald'
                                      : normalizeRound(item.conteoRound) === '2DO_CONTEO'
                                      ? 'blue'
                                      : 'amber'
                                  }
                                >
                                  {roundName(item.conteoRound)}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 min-w-[200px]">
                                <div className="font-mono font-bold text-white text-xs">
                                  {item.sku}
                                </div>
                                <div className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                                  {item.descripcion}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-400 text-sm tabular-nums">
                                {item.cantidad}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-mono text-emerald-400 font-bold text-xs">
                                  {item.localizador}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {item.subinventario}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {item.syncStateSharepoint === 'synced' ? (
                                  <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Subido</span>
                                  </span>
                                ) : (
                                  <span className="text-blue-400 font-semibold inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Local</span>
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-3 px-3 text-center whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1">
                                  <Tooltip content="Ver detalle completo">
                                    <button
                                      type="button"
                                      onClick={() => setInspectedItem(item)}
                                      className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-blue-500/15 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </Tooltip>
                                  {(userRole === 'GERENTE' || userRole === 'MASTER') && (
                                    <Tooltip content="Eliminar este registro de Supabase">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDeleteModal({ type: 'single', item })
                                        }
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </Tooltip>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Swipe Cards */}
                    <div className="md:hidden p-3 space-y-2.5">
                      <p className="text-[10px] font-mono text-slate-500 px-1">
                        Desliza una tarjeta a la izquierda para ver detalle o borrar
                      </p>
                      {paginatedScans.map((item) => (
                        <SwipeActionRow
                          key={item.id}
                          onInspect={() => setInspectedItem(item)}
                          onDelete={
                            userRole === 'GERENTE' || userRole === 'MASTER'
                              ? () => setConfirmDeleteModal({ type: 'single', item })
                              : undefined
                          }
                        >
                          <div className="p-3.5 border border-slate-800/80 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-white text-xs truncate">
                                {item.sku}
                              </span>
                              <span className="font-mono font-extrabold text-amber-400 text-sm tabular-nums shrink-0">
                                {item.cantidad} pzs
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-mono text-emerald-400 font-semibold">
                                {item.localizador}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Badge tone="amber">U{item.userNumber || 1}</Badge>
                                <Badge
                                  tone={
                                    normalizeRound(item.conteoRound) === '1ER_CONTEO'
                                      ? 'emerald'
                                      : 'blue'
                                  }
                                >
                                  {roundName(item.conteoRound)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </SwipeActionRow>
                      ))}
                    </div>
                  </>
                )}

                {/* Pagination */}
                <Pagination
                  currentPage={safePage}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>

              {/* Collapsible CSV Backup Inspector Dropzone */}
              <Accordion
                title={
                  <span className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-amber-400" />
                    <span>Verificar / Previsualizar Respaldo (.CSV)</span>
                  </span>
                }
                subtitle="Arrastra un respaldo descargado para auditar sus totales sin modificar la nube"
              >
                <div className="space-y-3 pt-2">
                  <Dropzone onFileLoaded={handleCsvDrop} />
                  {csvPreview && (
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/35 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-emerald-300 font-mono">
                          {csvPreview.fileName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Muestra SKUs: {csvPreview.sampleSkus.join(', ') || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 font-mono tabular-nums">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Filas</span>
                          <strong className="text-white">{csvPreview.rowCount}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Piezas</span>
                          <strong className="text-amber-400">
                            {csvPreview.totalQty.toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Accordion>
            </div>
          </PullToRefresh>
        </FadeSlide>
      )}

      {/* ===================================================================
       * DRAWER: INSPECTOR DETALLADO DE REGISTRO
       * =================================================================== */}
      <Drawer
        isOpen={Boolean(inspectedItem)}
        onClose={() => setInspectedItem(null)}
        title={inspectedItem ? `SKU ${inspectedItem.sku}` : 'Detalle de Registro'}
        subtitle={
          inspectedItem
            ? `${roundName(inspectedItem.conteoRound)} • ${
                inspectedItem.userNumber ? `Usuario ${inspectedItem.userNumber}` : inspectedItem.operador
              }`
            : undefined
        }
      >
        {inspectedItem && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">Cantidad</span>
                <span className="text-2xl font-mono font-extrabold text-amber-400 tabular-nums">
                  {inspectedItem.cantidad}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Localizador</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  {inspectedItem.localizador}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Descripción:</span>
                <span className="text-slate-100 font-medium text-right">
                  {inspectedItem.descripcion || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Subinventario:</span>
                <span className="font-mono text-slate-200">{inspectedItem.subinventario}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Operador:</span>
                <span className="text-slate-200 font-semibold">
                  {inspectedItem.nombreOperadorCompleto || inspectedItem.operador}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Dispositivo:</span>
                <span className="font-mono text-slate-300">{inspectedItem.dispositivo || 'TC26'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Fecha y Hora:</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {new Date(inspectedItem.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Estado Excel:</span>
                <Badge tone={inspectedItem.syncStateSharepoint === 'synced' ? 'emerald' : 'blue'}>
                  {inspectedItem.syncStateSharepoint === 'synced' ? 'Subido a SharePoint' : 'Local'}
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 block">
                Cadena QR Original
              </span>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-300 break-all whitespace-pre-wrap">
                {inspectedItem.rawQr}
              </pre>
            </div>

            {(userRole === 'GERENTE' || userRole === 'MASTER') && (
              <TactileButton
                anticipation
                type="button"
                onClick={() => setConfirmDeleteModal({ type: 'single', item: inspectedItem })}
                className="w-full h-11 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Eliminar este registro de Supabase</span>
              </TactileButton>
            )}
          </div>
        )}
      </Drawer>

      {/* ===================================================================
       * MODAL DE CONFIRMACIÓN DE ELIMINACIÓN EN SUPABASE
       * =================================================================== */}
      <AnimatePresence>
        {confirmDeleteModal && (
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
              className="glass-surface-strong border-2 border-rose-500/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left relative"
            >
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setConfirmDeleteModal(null);
                    setDeleteErrorMessage(null);
                  }
                }}
                disabled={isDeleting}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <Badge tone="rose">Acceso Autorizado Gerente / Master</Badge>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug pt-0.5">
                    ¿Estás seguro de eliminar de Supabase?
                  </h3>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                {confirmDeleteModal.type === 'all' ? (
                  <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3 text-slate-300">
                    <p className="font-semibold text-rose-300">
                      Se borrarán permanentemente todos los registros escaneados:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Total Registros</span>
                        <span className="text-white font-bold text-sm">{scans.length}</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Total Piezas</span>
                        <span className="text-amber-400 font-bold text-sm">
                          {totalPiezas.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-950/35 border border-amber-500/40 rounded-xl">
                      <Checkbox
                        checked={rebootDevicesOnDelete}
                        onChange={setRebootDevicesOnDelete}
                        tone="amber"
                        label="Reiniciar todas las terminales TC26 (Recomendado para pruebas)"
                        description="Cierra sesión en handhelds, regresa al 1er Conteo y pide nombre y usuario."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-1.5 text-slate-300 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">SKU:</span>
                      <span className="text-white font-bold">{confirmDeleteModal.item.sku}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Localizador:</span>
                      <span className="text-emerald-400 font-bold">
                        {confirmDeleteModal.item.localizador}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cantidad:</span>
                      <span className="text-amber-400 font-bold tabular-nums">
                        {confirmDeleteModal.item.cantidad} pzs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ronda:</span>
                      <span className="text-slate-300">
                        {roundName(confirmDeleteModal.item.conteoRound)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-xl text-[11px] text-rose-200 leading-snug">
                  <strong>Advertencia irreversible:</strong> Si necesitas conservar un respaldo,
                  descarga la copia en Excel (.CSV) antes de confirmar.
                </div>
              </div>

              {deleteErrorMessage && (
                <ShakeContainer
                  shakeKey={deleteShakeKey}
                  className="p-3 bg-rose-950/70 border border-rose-500/60 rounded-xl text-xs space-y-2"
                >
                  <div className="text-rose-200 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{deleteErrorMessage}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-400 font-bold">
                        Script SQL para permitir DELETE en Supabase:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyDeleteSql}
                        className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDeleteSql ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedDeleteSql ? 'Copiado' : 'Copiar SQL'}</span>
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-1.5 bg-slate-900 rounded border border-slate-800 max-h-24">
                      {SUPABASE_DELETE_POLICY_SQL}
                    </pre>
                  </div>
                </ShakeContainer>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteModal(null);
                    setDeleteErrorMessage(null);
                  }}
                  disabled={isDeleting}
                  className="min-h-[46px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>

                <TactileButton
                  anticipation
                  type="button"
                  onClick={handleExecuteDelete}
                  disabled={isDeleting}
                  className="min-h-[46px] px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Sí, Eliminar de Supabase</span>
                    </>
                  )}
                </TactileButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
