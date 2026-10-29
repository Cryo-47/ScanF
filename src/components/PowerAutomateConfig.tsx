import React, { useState, useEffect } from 'react';
import { 
  Workflow, 
  Database,
  Check, 
  Copy, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Code
} from 'lucide-react';
import { PowerAutomateConfig, SupabaseConfig } from '../types/inventory';
import { testPowerAutomateWebhook, testSupabaseConnection } from '../utils/syncService';
import { soundManager } from '../utils/audioHaptics';
import { SUPABASE_SQL_SCRIPT } from '../utils/supabaseSql';

interface PowerAutomateConfigProps {
  config: PowerAutomateConfig;
  onSaveConfig: (config: PowerAutomateConfig) => void;
  supabaseConfig: SupabaseConfig;
  onSaveSupabase: (config: SupabaseConfig) => void;
  onSyncAllToSupabase?: () => Promise<number>;
  scansCount?: number;
}

export const PowerAutomateConfigView: React.FC<PowerAutomateConfigProps> = ({
  config,
  onSaveConfig,
  supabaseConfig,
  onSaveSupabase,
  onSyncAllToSupabase,
  scansCount = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'sharepoint' | 'supabase'>('sharepoint');

  // SharePoint form state
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl);
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [excelFileDirectUrl, setExcelFileDirectUrl] = useState(config.excelFileDirectUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Supabase form state
  const [sbUrl, setSbUrl] = useState(supabaseConfig.url);
  const [sbAnonKey, setSbAnonKey] = useState(supabaseConfig.anonKey);
  const [sbTableName, setSbTableName] = useState(supabaseConfig.tableName || 'inventory_scans');
  const [sbIsEnabled, setSbIsEnabled] = useState(supabaseConfig.isEnabled);
  const [sbTesting, setSbTesting] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);
  const [sbSaveSuccess, setSbSaveSuccess] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllFeedback, setSyncAllFeedback] = useState<string | null>(null);

  useEffect(() => {
    setWebhookUrl(config.webhookUrl);
    setIsEnabled(config.isEnabled);
    setExcelFileDirectUrl(config.excelFileDirectUrl || '');
  }, [config]);

  useEffect(() => {
    setSbUrl(supabaseConfig.url);
    setSbAnonKey(supabaseConfig.anonKey);
    setSbTableName(supabaseConfig.tableName || 'inventory_scans');
    setSbIsEnabled(supabaseConfig.isEnabled);
  }, [supabaseConfig]);

  // Exact JSON Schema for Power Automate HTTP Trigger
  const jsonSchema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
      "id_escaneo": { "type": "string" },
      "fecha_hora": { "type": "string" },
      "sku": { "type": "string" },
      "cantidad": { "type": "number" },
      "descripcion": { "type": "string" },
      "subinventario": { "type": "string" },
      "localizador": { "type": "string" },
      "ronda_conteo": { "type": "string" },
      "operador": { "type": "string" },
      "dispositivo": { "type": "string" },
      "user_number": { "type": "number" },
      "codigo_qr_raw": { "type": "string" }
    }
  };

  const sqlScript = SUPABASE_SQL_SCRIPT;

  const handleCopySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonSchema, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleSaveSharepoint = () => {
    const updated: PowerAutomateConfig = {
      ...config,
      webhookUrl: webhookUrl.trim(),
      isEnabled: isEnabled && Boolean(webhookUrl.trim()),
      excelFileDirectUrl: excelFileDirectUrl.trim(),
    };
    onSaveConfig(updated);
    setSaveSuccess(true);
    soundManager.playSuccess();
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTestSharepoint = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor ingresa primero la URL del desencadenador HTTP de Power Automate.',
        latencyMs: 0,
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testPowerAutomateWebhook(webhookUrl.trim());
      setTestResult(res);
      if (res.success) {
        setIsEnabled(true);
        soundManager.playSuccess();
      } else {
        soundManager.playError();
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestSupabase = async () => {
    if (!sbUrl.trim() || !sbAnonKey.trim()) {
      setSbTestResult({
        success: false,
        message: 'Ingresa la URL del proyecto y la Anon Key de Supabase para probar.',
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
        setSbIsEnabled(true);
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
      tableName: sbTableName.trim() || 'inventory_scans',
      isEnabled: sbIsEnabled && Boolean(sbUrl.trim() && sbAnonKey.trim()),
    };
    onSaveSupabase(updated);
    setSbSaveSuccess(true);
    soundManager.playSuccess();
    setTimeout(() => setSbSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner & Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Workflow className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
                Enlaces del Sistema (Usuario Master)
              </h2>
              <p className="text-xs text-slate-400">
                Configuración de destino para los escaneos de las terminales TC26
              </p>
            </div>
          </div>

          {/* Section Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('sharepoint')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'sharepoint'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>SharePoint (Power Automate)</span>
            </button>

            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'supabase'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Registro Supabase</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: SHAREPOINT */}
      {activeTab === 'sharepoint' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-4 animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <Workflow className="w-4 h-4 text-blue-400" />
              <span>Webhook de Power Automate hacia Excel SharePoint</span>
            </h3>
            <button
              onClick={handleCopySchema}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchema ? 'Esquema copiado' : 'Copiar Esquema JSON'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              URL del Desencadenador HTTP (HTTP POST URL):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://defaultaa53848cce8346e7a4f67e95722c78.ff.environment.api.powerplatform..."
                className="flex-1 h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleTestSharepoint}
                disabled={isTesting}
                className="h-12 px-5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 whitespace-nowrap shadow-md transition-all shrink-0"
              >
                <Send className={`w-4 h-4 shrink-0 ${isTesting ? 'animate-bounce' : ''}`} />
                <span>{isTesting ? 'Probando...' : 'Probar Conexión Webhook'}</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold">
                  {testResult.success ? 'Conexión Exitosa con Power Automate' : 'Fallo en la Prueba de Webhook'}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300 break-words">{testResult.message}</div>
                {testResult.message.includes('DirectApiAuthorizationRequired') && (
                  <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 leading-relaxed space-y-1.5">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Cómo solucionar este error (HTTP 401) en Power Automate:</span>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                      <li>Abre el flujo en <strong>Power Automate</strong> y haz clic en el disparador <strong>"Cuando se recibe una solicitud HTTP"</strong>.</li>
                      <li>En <strong>"¿Quién puede desencadenar el flujo?"</strong>, asegúrate de seleccionar <strong>"Cualquiera"</strong>.</li>
                      <li>Haz clic en el botón <strong>Guardar (Save)</strong> en la barra superior.</li>
                      <li><strong>Paso Clave:</strong> Al guardar con "Cualquiera", Power Automate genera una URL nueva que incluye la firma secreta de acceso (<code className="text-amber-400 font-mono font-bold">&amp;sig=...</code>).</li>
                      <li>Copia esa nueva URL completa (con su <code className="text-amber-400 font-mono">&amp;sig=...</code>) y pégala aquí. Al hacer clic en <em>"Probar Conexión Webhook"</em> responderá HTTP 202 con éxito inmediato.</li>
                    </ol>
                  </div>
                )}
                {testResult.latencyMs > 0 && (
                  <div className="mt-1 font-mono text-[10px] text-slate-400">
                    Latencia: {testResult.latencyMs} ms
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-emerald-400 mb-1">
              Enlace Directo del Archivo Excel en SharePoint:
            </label>
            <input
              type="url"
              value={excelFileDirectUrl}
              onChange={(e) => setExcelFileDirectUrl(e.target.value)}
              placeholder="https://tuempresa.sharepoint.com/:x:/r/..."
              className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Este enlace se muestra al Gerente en la vista web para abrir el Excel con 1 clic.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-500 bg-slate-800 border-slate-700"
              />
              <span className="text-xs font-semibold text-slate-200">
                Habilitar sincronización inmediata a SharePoint en cada escaneo
              </span>
            </label>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Configuración guardada</span>
                </span>
              )}
              <button
                onClick={handleSaveSharepoint}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
              >
                Guardar Configuración SharePoint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPABASE */}
      {activeTab === 'supabase' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-4 animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Registro y Base de Datos Relacional Supabase</span>
            </h3>
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showSql ? 'Ocultar SQL' : 'Ver Script SQL para Supabase'}</span>
            </button>
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
                className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
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
                className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Clave Anon / Public API Key:
            </label>
            <input
              type="password"
              value={sbAnonKey}
              onChange={(e) => setSbAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestSupabase}
              disabled={sbTesting}
              className="h-11 px-5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
            >
              <Send className={`w-3.5 h-3.5 ${sbTesting ? 'animate-bounce' : ''}`} />
              <span>{sbTesting ? 'Probando Supabase...' : 'Probar Conexión Supabase'}</span>
            </button>
          </div>

          {sbTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                sbTestResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {sbTestResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">
                  {sbTestResult.success ? 'Conexión Exitosa con Supabase' : 'Error en Conexión con Supabase'}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">{sbTestResult.message}</div>
                {sbTestResult.latencyMs > 0 && (
                  <div className="mt-1 font-mono text-[10px] text-slate-400">
                    Latencia: {sbTestResult.latencyMs} ms
                  </div>
                )}
              </div>
            </div>
          )}

          {showSql && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-amber-400">Pega esto en el SQL Editor de tu proyecto Supabase:</span>
                <button
                  onClick={handleCopySql}
                  className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900 rounded max-h-36 border border-slate-800">
                {sqlScript}
              </pre>
            </div>
          )}

          {/* Manual backup of local scans to Supabase */}
          {onSyncAllToSupabase && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Respaldar Códigos Escaneados en Supabase</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Sube a la tabla de Supabase todos los códigos locales que aún no se hayan guardado en la nube.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  {scansCount} códigos en app
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setIsSyncingAll(true);
                  setSyncAllFeedback(null);
                  try {
                    const count = await onSyncAllToSupabase();
                    setSyncAllFeedback(`✓ ${count} códigos verificados y respaldados exitosamente en la nube de Supabase.`);
                    soundManager.playSuccess();
                  } catch {
                    setSyncAllFeedback('Error al sincronizar con Supabase. Revisa la URL y la Anon Key.');
                    soundManager.playError();
                  } finally {
                    setIsSyncingAll(false);
                  }
                }}
                disabled={isSyncingAll || !sbIsEnabled}
                className="w-full py-2.5 px-4 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Database className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'Guardando en Supabase...' : 'Guardar y Respaldar Todos los Códigos en Supabase Ahora'}</span>
              </button>
              {syncAllFeedback && (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-[11px] text-emerald-300 font-mono">
                  {syncAllFeedback}
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sbIsEnabled}
                onChange={(e) => setSbIsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
              />
              <span className="text-xs font-semibold text-slate-200">
                Habilitar guardado simultáneo en Supabase al escanear
              </span>
            </label>

            <div className="flex items-center gap-2">
              {sbSaveSuccess && (
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Configuración guardada</span>
                </span>
              )}
              <button
                onClick={handleSaveSupabase}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
              >
                Guardar Configuración Supabase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
