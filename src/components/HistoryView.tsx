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
  Edit3
} from 'lucide-react';
import { ScannedItem, PowerAutomateConfig, UserRole, DeviceStatusSummary, CountRound } from '../types/inventory';
import { exportScansToCsv } from '../utils/storage';
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
}) => {
  const [search, setSearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [editedLink, setEditedLink] = useState(powerAutomateConfig.excelFileDirectUrl || '');

  const filtered = scans.filter((s) =>
    s.sku.toLowerCase().includes(search.toLowerCase()) ||
    s.descripcion.toLowerCase().includes(search.toLowerCase()) ||
    s.localizador.toLowerCase().includes(search.toLowerCase()) ||
    s.subinventario.toLowerCase().includes(search.toLowerCase())
  );

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
      <DeviceMonitoringPanel devices={deviceSummaries} />

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
          <button
            onClick={() => exportScansToCsv(scans)}
            disabled={scans.length === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Descargar Copia Excel (.CSV)</span>
            <span className="sm:hidden">Descargar Excel (.CSV)</span>
          </button>

          {scans.length > 0 && (
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de vaciar el historial de registros de la terminal?')) {
                  onClearHistory();
                }
              }}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Vaciar historial local"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
