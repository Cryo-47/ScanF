import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Workflow, 
  Database, 
  Check, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  KeyRound, 
  LogOut, 
  ExternalLink,
  Copy,
  Code
} from 'lucide-react';
import { UserRole, PowerAutomateConfig, SupabaseConfig } from '../types/inventory';
import { loadMasterPin, saveMasterPin } from '../utils/storage';
import { testPowerAutomateWebhook, testSupabaseConnection } from '../utils/syncService';
import { soundManager } from '../utils/audioHaptics';
import { SUPABASE_SQL_SCRIPT } from '../utils/supabaseSql';

interface MasterAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  onSetUserRole: (role: UserRole) => void;
  powerAutomateConfig: PowerAutomateConfig;
  onSavePowerAutomate: (cfg: PowerAutomateConfig) => void;
  supabaseConfig: SupabaseConfig;
  onSaveSupabase: (cfg: SupabaseConfig) => void;
  onSyncAllToSupabase?: () => Promise<number>;
  scansCount?: number;
}

export const MasterAuthModal: React.FC<MasterAuthModalProps> = ({
  isOpen,
  onClose,
  userRole,
  onSetUserRole,
  powerAutomateConfig,
  onSavePowerAutomate,
  supabaseConfig,
  onSaveSupabase,
  onSyncAllToSupabase,
  scansCount = 0,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(userRole === 'MASTER');
  const [pinError, setPinError] = useState(false);
  const [activeMasterSection, setActiveMasterSection] = useState<'sharepoint' | 'supabase'>('sharepoint');

  // Change PIN state
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  // SharePoint form state
  const [paWebhookUrl, setPaWebhookUrl] = useState(powerAutomateConfig.webhookUrl);
  const [paExcelDirectUrl, setPaExcelDirectUrl] = useState(powerAutomateConfig.excelFileDirectUrl || '');
  const [paIsEnabled, setPaIsEnabled] = useState(powerAutomateConfig.isEnabled);
  const [paTesting, setPaTesting] = useState(false);
  const [paTestResult, setPaTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);
  const [paSaved, setPaSaved] = useState(false);

  // Supabase form state
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllFeedback, setSyncAllFeedback] = useState<string | null>(null);
  const [sbUrl, setSbUrl] = useState(supabaseConfig.url);
  const [sbAnonKey, setSbAnonKey] = useState(supabaseConfig.anonKey);
  const [sbTableName, setSbTableName] = useState(supabaseConfig.tableName || 'inventory_scans');
  const [sbIsEnabled, setSbIsEnabled] = useState(supabaseConfig.isEnabled);
  const [sbTesting, setSbTesting] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);
  const [sbSaved, setSbSaved] = useState(false);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPaWebhookUrl(powerAutomateConfig.webhookUrl);
      setPaExcelDirectUrl(powerAutomateConfig.excelFileDirectUrl || '');
      setPaIsEnabled(powerAutomateConfig.isEnabled);
      setSbUrl(supabaseConfig.url);
      setSbAnonKey(supabaseConfig.anonKey);
      setSbTableName(supabaseConfig.tableName || 'inventory_scans');
      setSbIsEnabled(supabaseConfig.isEnabled);
    }
  }, [isOpen, powerAutomateConfig, supabaseConfig]);

  if (!isOpen) return null;

  const storedPin = loadMasterPin();

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === storedPin || pinInput === '1234') {
      setIsAuthenticated(true);
      onSetUserRole('MASTER');
      setPinError(false);
      setPinInput('');
      soundManager.playSuccess();
    } else {
      setPinError(true);
      setPinInput('');
      soundManager.playError();
    }
  };

  const handleSavePin = () => {
    if (newPin.length >= 4) {
      saveMasterPin(newPin);
      setIsChangingPin(false);
      setNewPin('');
      soundManager.playSuccess();
      alert('Nuevo PIN de Usuario Master guardado exitosamente.');
    }
  };

  // Test & Save SharePoint
  const handleTestSharepoint = async () => {
    if (!paWebhookUrl.trim()) {
      setPaTestResult({
        success: false,
        message: 'Ingresa la URL del webhook de Power Automate antes de probar.',
        latencyMs: 0,
      });
      return;
    }
    setPaTesting(true);
    setPaTestResult(null);
    try {
      const res = await testPowerAutomateWebhook(paWebhookUrl.trim());
      setPaTestResult(res);
      if (res.success) {
        soundManager.playSuccess();
      } else {
        soundManager.playError();
      }
    } finally {
      setPaTesting(false);
    }
  };

  const handleSaveSharepoint = () => {
    const updated: PowerAutomateConfig = {
      ...powerAutomateConfig,
      webhookUrl: paWebhookUrl.trim(),
      excelFileDirectUrl: paExcelDirectUrl.trim(),
      isEnabled: paIsEnabled && Boolean(paWebhookUrl.trim()),
    };
    onSavePowerAutomate(updated);
    setPaSaved(true);
    soundManager.playSuccess();
    setTimeout(() => setPaSaved(false), 2000);
  };

  // Test & Save Supabase
  const handleTestSupabase = async () => {
    if (!sbUrl.trim() || !sbAnonKey.trim()) {
      setSbTestResult({
        success: false,
        message: 'Ingresa la URL del proyecto y la Anon Key de Supabase para probar la conexión.',
        latencyMs: 0,
      });
      return;
    }
    setSbTesting(true);
    setSbTestResult(null);
    try {
      const res = await testSupabaseConnection(sbUrl.trim(), sbAnonKey.trim(), sbTableName.trim());
      setSbTestResult(res);
      if (res.success) {
        soundManager.playSuccess();
      } else {
        soundManager.playError();
      }
    } finally {
      setSbTesting(false);
    }
  };

  const handleSaveSupabase = () => {
    const updated: SupabaseConfig = {
      ...supabaseConfig,
      url: sbUrl.trim(),
      anonKey: sbAnonKey.trim(),
      tableName: (sbTableName.trim() || 'inventory_scans'),
      isEnabled: sbIsEnabled && Boolean(sbUrl.trim() && sbAnonKey.trim()),
    };
    onSaveSupabase(updated);
    setSbSaved(true);
    soundManager.playSuccess();
    setTimeout(() => setSbSaved(false), 2000);
  };

  const sqlCode = SUPABASE_SQL_SCRIPT;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Configuración de Enlaces - Usuario Master
            </h2>
            <p className="text-xs text-slate-400">
              Administración exclusiva de conexiones con SharePoint y Supabase
            </p>
          </div>
        </div>

        {!isAuthenticated ? (
          /* Step 1: PIN Input */
          <form onSubmit={handleVerifyPin} className="space-y-4 max-w-sm mx-auto py-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                Ingresa el PIN de Usuario Master:
              </label>
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="••••"
                className="w-full h-12 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 text-center text-2xl font-mono tracking-widest text-white focus:outline-none transition-colors"
                autoFocus
              />
              {pinError && (
                <p className="text-xs text-rose-400 mt-1.5 text-center font-medium">
                  PIN incorrecto. (PIN por defecto: 1234)
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md"
            >
              Acceder a Configuraciones Master
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Acceso protegido. Recuerda que el control de rondas es operado por el Gerente.
            </p>
          </form>
        ) : (
          /* Step 2: Master Configuration Tabs: SharePoint vs Supabase */
          <div className="space-y-5">
            {/* Master Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveMasterSection('sharepoint')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  activeMasterSection === 'sharepoint'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Workflow className="w-4 h-4 shrink-0" />
                <span>1. Conexión con SharePoint</span>
              </button>

              <button
                onClick={() => setActiveMasterSection('supabase')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  activeMasterSection === 'supabase'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>2. Conexión con Supabase</span>
              </button>
            </div>

            {/* TAB 1: SHAREPOINT (POWER AUTOMATE) */}
            {activeMasterSection === 'sharepoint' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl text-xs text-blue-300">
                  <strong>Conexión Power Automate ➔ SharePoint Excel:</strong> Permite que cada escaneo se divida automáticamente entre la Hoja 1 (Conteo 1) y Hoja 2 (Conteo 2) de tu archivo Excel.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    URL del Webhook de Power Automate (HTTP POST):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={paWebhookUrl}
                      onChange={(e) => setPaWebhookUrl(e.target.value)}
                      placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                      className="flex-1 h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleTestSharepoint}
                      disabled={paTesting}
                      className="h-11 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 whitespace-nowrap shadow-md transition-all shrink-0"
                    >
                      <Send className={`w-3.5 h-3.5 ${paTesting ? 'animate-bounce' : ''}`} />
                      <span>{paTesting ? 'Probando...' : 'Probar Conexión'}</span>
                    </button>
                  </div>
                </div>

                {paTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      paTestResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {paTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold break-words">{paTestResult.message}</div>
                      {paTestResult.message.includes('DirectApiAuthorizationRequired') && (
                        <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 leading-relaxed space-y-1.5">
                          <div className="font-bold text-amber-300 flex items-center gap-1.5">
                            <span>💡</span>
                            <span>Cómo solucionar este error en Power Automate:</span>
                          </div>
                          <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                            <li>Abre tu flujo en <strong>Power Automate</strong> y haz clic en el bloque disparador <strong>"Cuando se recibe una solicitud HTTP"</strong> (manual).</li>
                            <li>En el campo <strong>"¿Quién puede desencadenar el flujo?"</strong>, confirma que esté seleccionado <strong>"Cualquiera"</strong>.</li>
                            <li>Haz clic en el botón <strong>Guardar (Save)</strong> arriba a la derecha.</li>
                            <li><strong>Importante:</strong> Al guardar con "Cualquiera", Power Automate regenera la URL y le agrega al final la clave de firma secreta (<code className="text-amber-400 font-mono font-bold">&amp;sig=...</code>).</li>
                            <li>Vuelve a copiar esa nueva URL completa con su firma, pégala en el campo de arriba y haz clic en <em>"Guardar Configuración"</em> y luego en <em>"Probar Conexión"</em>.</li>
                          </ol>
                        </div>
                      )}
                      {paTestResult.latencyMs > 0 && (
                        <div className="font-mono text-[10px] text-slate-400 mt-1">
                          Latencia: {paTestResult.latencyMs} ms
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enlace Directo al Archivo Excel en SharePoint:
                  </label>
                  <input
                    type="url"
                    value={paExcelDirectUrl}
                    onChange={(e) => setPaExcelDirectUrl(e.target.value)}
                    placeholder="https://tuempresa.sharepoint.com/:x:/r/..."
                    className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Este link es el que usará el Gerente para abrir el Excel con un solo clic.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={paIsEnabled}
                      onChange={(e) => setPaIsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-500 bg-slate-800 border-slate-700"
                    />
                    <span className="text-xs text-slate-300">
                      Sincronización activa con SharePoint
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    {paSaved && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Guardado
                      </span>
                    )}
                    <button
                      onClick={handleSaveSharepoint}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Guardar Configuración SharePoint
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SUPABASE */}
            {activeMasterSection === 'supabase' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                  <strong>Registro y Base de Datos Supabase (PostgreSQL):</strong> Guarda una copia de respaldo instantánea de cada escaneo en una tabla SQL en la nube.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      URL del Proyecto Supabase:
                    </label>
                    <input
                      type="url"
                      value={sbUrl}
                      onChange={(e) => setSbUrl(e.target.value)}
                      placeholder="https://xyzabcdefg.supabase.co"
                      className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nombre de la Tabla:
                    </label>
                    <input
                      type="text"
                      value={sbTableName}
                      onChange={(e) => setSbTableName(e.target.value)}
                      placeholder="inventory_scans"
                      className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Supabase Anon Key / Public Key:
                  </label>
                  <input
                    type="password"
                    value={sbAnonKey}
                    onChange={(e) => setSbAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Se encuentra en Supabase en: Project Settings &gt; API &gt; Project API keys (anon / public).
                  </p>
                </div>

                {/* Test button & status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    onClick={handleTestSupabase}
                    disabled={sbTesting}
                    className="h-10 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Send className={`w-3.5 h-3.5 ${sbTesting ? 'animate-bounce' : ''}`} />
                    <span>{sbTesting ? 'Verificando con Supabase...' : 'Probar Conexión Supabase'}</span>
                  </button>

                  <button
                    onClick={() => setShowSqlSchema(!showSqlSchema)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Code className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showSqlSchema ? 'Ocultar SQL' : 'Ver Script SQL para Supabase'}</span>
                  </button>
                </div>

                {sbTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      sbTestResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {sbTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{sbTestResult.message}</div>
                      {sbTestResult.latencyMs > 0 && (
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          Latencia: {sbTestResult.latencyMs} ms
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Optional SQL schema viewer */}
                {showSqlSchema && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold text-amber-400">Ejecuta esto en el SQL Editor de Supabase:</span>
                      <button
                        onClick={handleCopySql}
                        className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
                      >
                        {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSql ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900 rounded max-h-32 border border-slate-800">
                      {sqlCode}
                    </pre>
                  </div>
                )}

                {/* Manual backup of local scans to Supabase */}
                {onSyncAllToSupabase && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        Respaldar Escaneos Locales en Supabase:
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        {scansCount || 0} registros en memoria
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsSyncingAll(true);
                        setSyncAllFeedback(null);
                        try {
                          const count = await onSyncAllToSupabase();
                          setSyncAllFeedback(`✓ ${count} códigos guardados y respaldados exitosamente en la nube de Supabase.`);
                          soundManager.playSuccess();
                        } catch {
                          setSyncAllFeedback('Error al respaldar escaneos en Supabase.');
                          soundManager.playError();
                        } finally {
                          setIsSyncingAll(false);
                        }
                      }}
                      disabled={isSyncingAll || !sbIsEnabled}
                      className="w-full py-2.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Database className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingAll ? 'animate-spin' : ''}`} />
                      <span>{isSyncingAll ? 'Guardando en Supabase...' : 'Guardar y Respaldar Todos los Códigos en Supabase Ahora'}</span>
                    </button>
                    {syncAllFeedback && (
                      <p className="text-[11px] text-emerald-400 font-mono mt-1">
                        {syncAllFeedback}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sbIsEnabled}
                      onChange={(e) => setSbIsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
                    />
                    <span className="text-xs text-slate-300">
                      Habilitar sincronización con Supabase
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    {sbSaved && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Guardado
                      </span>
                    )}
                    <button
                      onClick={handleSaveSupabase}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Guardar Configuración Supabase
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer with PIN Management & Logout */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {!isChangingPin ? (
                <button
                  onClick={() => setIsChangingPin(true)}
                  className="text-[11px] text-slate-400 hover:text-amber-400 underline flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Cambiar PIN Master</span>
                </button>
              ) : (
                <div className="flex gap-1.5 items-center">
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Nuevo PIN"
                    className="w-24 h-7 bg-slate-950 border border-slate-700 rounded px-2 text-xs text-center text-white"
                  />
                  <button
                    onClick={handleSavePin}
                    className="h-7 px-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setIsChangingPin(false)}
                    className="text-xs text-slate-400 hover:text-white px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setIsAuthenticated(false);
                  onSetUserRole('GERENTE');
                  onClose();
                }}
                className="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[11px] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión Master</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
