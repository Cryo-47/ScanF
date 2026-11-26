import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Database,
  Check,
  Copy,
  Send,
  CheckCircle2,
  AlertTriangle,
  Code,
  HelpCircle,
} from 'lucide-react';
import { PowerAutomateConfig, SupabaseConfig } from '../types/inventory';
import { testPowerAutomateWebhook, testSupabaseConnection } from '../utils/syncService';
import { soundManager } from '../utils/audioHaptics';
import { SUPABASE_SQL_SCRIPT } from '../utils/supabaseSql';
import { Accordion, Badge, Switch, TabItem, Tabs } from './ui/Controls';
import { FadeSlide, ShakeContainer, TactileButton } from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'sharepoint' | 'supabase'>('sharepoint');

  // SharePoint form state
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl);
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [excelFileDirectUrl, setExcelFileDirectUrl] = useState(config.excelFileDirectUrl || '');
  const [spFieldError, setSpFieldError] = useState<string | null>(null);
  const [spShakeKey, setSpShakeKey] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Supabase form state
  const [sbUrl, setSbUrl] = useState(supabaseConfig.url);
  const [sbAnonKey, setSbAnonKey] = useState(supabaseConfig.anonKey);
  const [sbTableName, setSbTableName] = useState(supabaseConfig.tableName || 'inventory_scans');
  const [sbIsEnabled, setSbIsEnabled] = useState(supabaseConfig.isEnabled);
  const [sbFieldError, setSbFieldError] = useState<string | null>(null);
  const [sbShakeKey, setSbShakeKey] = useState(0);
  const [sbTesting, setSbTesting] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

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

  const jsonSchema = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    type: 'object',
    properties: {
      id_escaneo: { type: 'string' },
      fecha_hora: { type: 'string' },
      sku: { type: 'string' },
      cantidad: { type: 'number' },
      descripcion: { type: 'string' },
      subinventario: { type: 'string' },
      localizador: { type: 'string' },
      ronda_conteo: { type: 'string' },
      operador: { type: 'string' },
      dispositivo: { type: 'string' },
      user_number: { type: 'number' },
      codigo_qr_raw: { type: 'string' },
    },
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonSchema, null, 2));
    setCopiedSchema(true);
    toast({ variant: 'info', title: 'Esquema JSON copiado' });
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    toast({ variant: 'info', title: 'Script SQL copiado al portapapeles' });
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const isValidHttpUrl = (url: string) => /^https?:\/\/.+/i.test(url.trim());

  const handleSaveSharepoint = () => {
    if (webhookUrl.trim() && !isValidHttpUrl(webhookUrl)) {
      setSpFieldError('La URL del Webhook debe iniciar con https://');
      setSpShakeKey((k) => k + 1);
      soundManager.playError();
      return;
    }
    if (excelFileDirectUrl.trim() && !isValidHttpUrl(excelFileDirectUrl)) {
      setSpFieldError('El enlace directo del archivo Excel debe iniciar con https://');
      setSpShakeKey((k) => k + 1);
      soundManager.playError();
      return;
    }
    setSpFieldError(null);

    const updated: PowerAutomateConfig = {
      ...config,
      webhookUrl: webhookUrl.trim(),
      isEnabled: isEnabled && Boolean(webhookUrl.trim()),
      excelFileDirectUrl: excelFileDirectUrl.trim(),
    };
    onSaveConfig(updated);
    soundManager.playSuccess();
    toast({
      variant: 'success',
      title: 'Configuración de SharePoint guardada',
      description: updated.isEnabled
        ? 'Sincronización inmediata habilitada.'
        : 'Guardada (webhook desactivado).',
    });
  };

  const handleTestSharepoint = async () => {
    if (!webhookUrl.trim() || !isValidHttpUrl(webhookUrl)) {
      setSpFieldError('Ingresa primero una URL HTTPS válida del desencadenador HTTP.');
      setSpShakeKey((k) => k + 1);
      return;
    }
    setSpFieldError(null);
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testPowerAutomateWebhook(webhookUrl.trim());
      setTestResult(res);
      if (res.success) {
        setIsEnabled(true);
        soundManager.playSuccess();
        toast({ variant: 'success', title: 'Webhook HTTP conectado', description: `${res.latencyMs} ms` });
      } else {
        soundManager.playError();
        toast({ variant: 'error', title: 'Fallo en la prueba de Webhook' });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestSupabase = async () => {
    if (!isValidHttpUrl(sbUrl) || !sbAnonKey.trim()) {
      setSbFieldError('Ingresa la URL HTTPS del proyecto y la Anon Key de Supabase.');
      setSbShakeKey((k) => k + 1);
      return;
    }
    setSbFieldError(null);
    setSbTesting(true);
    setSbTestResult(null);
    try {
      const res = await testSupabaseConnection(sbUrl.trim(), sbAnonKey.trim(), sbTableName.trim());
      setSbTestResult(res);
      if (res.success) {
        setSbIsEnabled(true);
        soundManager.playSuccess();
        toast({ variant: 'success', title: 'Conexión Supabase verificada', description: `${res.latencyMs} ms` });
      } else {
        soundManager.playError();
        toast({ variant: 'error', title: 'Error de conexión Supabase' });
      }
    } finally {
      setSbTesting(false);
    }
  };

  const handleSaveSupabase = () => {
    if (sbUrl.trim() && !isValidHttpUrl(sbUrl)) {
      setSbFieldError('La URL del proyecto Supabase debe iniciar con https://');
      setSbShakeKey((k) => k + 1);
      soundManager.playError();
      return;
    }
    setSbFieldError(null);
    const updated: SupabaseConfig = {
      ...supabaseConfig,
      url: sbUrl.trim(),
      anonKey: sbAnonKey.trim(),
      tableName: sbTableName.trim() || 'inventory_scans',
      isEnabled: sbIsEnabled && Boolean(sbUrl.trim() && sbAnonKey.trim()),
    };
    onSaveSupabase(updated);
    soundManager.playSuccess();
    toast({
      variant: 'success',
      title: 'Configuración de Supabase guardada',
    });
  };

  const tabItems: TabItem<'sharepoint' | 'supabase'>[] = [
    { id: 'sharepoint', label: 'SharePoint (Power Automate)', icon: <Workflow className="w-3.5 h-3.5" /> },
    { id: 'supabase', label: 'Registro Supabase', icon: <Database className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="glass-surface border border-slate-800/90 rounded-2xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Enlaces del Sistema
                </h2>
                <Badge tone="amber">Master</Badge>
              </div>
              <p className="text-xs text-slate-400">
                Configuración de destino para los escaneos de las terminales TC26
              </p>
            </div>
          </div>

          <Tabs
            items={tabItems}
            value={activeTab}
            onChange={setActiveTab}
            layoutGroup="master-config-tabs"
          />
        </div>
      </div>

      {/* TAB 1: SHAREPOINT */}
      {activeTab === 'sharepoint' && (
        <FadeSlide>
          <ShakeContainer shakeKey={spShakeKey}>
            <div className="glass-surface border border-slate-800/90 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-blue-400" />
                  <span>Webhook de Power Automate hacia Excel SharePoint</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedSchema ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
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
                    onChange={(e) => {
                      setWebhookUrl(e.target.value);
                      if (spFieldError) setSpFieldError(null);
                    }}
                    placeholder="https://defaultaa53848cce8346e7a4f67e95722c78.ff.environment.api.powerplatform..."
                    className={`flex-1 h-11 bg-slate-950 border rounded-xl px-3 font-mono text-xs text-amber-300 placeholder:text-slate-600 focus:outline-none ${
                      spFieldError
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  <TactileButton
                    anticipation
                    type="button"
                    onClick={handleTestSharepoint}
                    disabled={isTesting}
                    className="h-11 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 whitespace-nowrap shadow-md shrink-0 cursor-pointer"
                  >
                    <Send className={`w-4 h-4 shrink-0 ${isTesting ? 'animate-bounce' : ''}`} />
                    <span>{isTesting ? 'Probando...' : 'Probar Conexión Webhook'}</span>
                  </TactileButton>
                </div>
              </div>

              {spFieldError && (
                <p className="text-xs text-rose-400 font-medium">{spFieldError}</p>
              )}

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
                      {testResult.success
                        ? 'Conexión Exitosa con Power Automate'
                        : 'Fallo en la Prueba de Webhook'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300 break-words">
                      {testResult.message}
                    </div>
                    {testResult.latencyMs > 0 && (
                      <div className="mt-1 font-mono text-[10px] text-slate-400 tabular-nums">
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
                  onChange={(e) => {
                    setExcelFileDirectUrl(e.target.value);
                    if (spFieldError) setSpFieldError(null);
                  }}
                  placeholder="https://tuempresa.sharepoint.com/:x:/r/..."
                  className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Se muestra a Gerencia en el panel web para abrir el Excel con un clic.
                </p>
              </div>

              <Accordion
                title={
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>Guía rápida si Power Automate devuelve HTTP 401</span>
                  </span>
                }
              >
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-300 leading-relaxed pt-1">
                  <li>
                    Abre el flujo en <strong>Power Automate</strong> y selecciona{' '}
                    <strong>"Cuando se recibe una solicitud HTTP"</strong>.
                  </li>
                  <li>
                    En <strong>"¿Quién puede desencadenar el flujo?"</strong> selecciona{' '}
                    <strong>"Cualquiera"</strong> y guarda el flujo.
                  </li>
                  <li>
                    Copia la URL completa regenerada con firma (<code className="text-amber-300">&amp;sig=...</code>) y pégala arriba.
                  </li>
                </ol>
              </Accordion>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <Switch
                  checked={isEnabled}
                  onChange={setIsEnabled}
                  tone="blue"
                  label="Sincronización inmediata a SharePoint"
                  description="Envía el registro al flujo HTTP en cada captura"
                />

                <TactileButton
                  anticipation
                  type="button"
                  onClick={handleSaveSharepoint}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Guardar Configuración SharePoint
                </TactileButton>
              </div>
            </div>
          </ShakeContainer>
        </FadeSlide>
      )}

      {/* TAB 2: SUPABASE */}
      {activeTab === 'supabase' && (
        <FadeSlide>
          <ShakeContainer shakeKey={sbShakeKey}>
            <div className="glass-surface border border-slate-800/90 rounded-2xl p-5 md:p-6 space-y-4">
              <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Registro y Base de Datos Relacional Supabase</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    URL del Proyecto Supabase:
                  </label>
                  <input
                    type="url"
                    value={sbUrl}
                    onChange={(e) => {
                      setSbUrl(e.target.value);
                      if (sbFieldError) setSbFieldError(null);
                    }}
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
                  onChange={(e) => {
                    setSbAnonKey(e.target.value);
                    if (sbFieldError) setSbFieldError(null);
                  }}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {sbFieldError && (
                <p className="text-xs text-rose-400 font-medium">{sbFieldError}</p>
              )}

              <div className="flex items-center gap-2">
                <TactileButton
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={sbTesting}
                  className="h-11 px-5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Send className={`w-3.5 h-3.5 ${sbTesting ? 'animate-bounce' : ''}`} />
                  <span>{sbTesting ? 'Probando Supabase...' : 'Probar Conexión Supabase'}</span>
                </TactileButton>
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
                      {sbTestResult.success
                        ? 'Conexión Exitosa con Supabase'
                        : 'Error en Conexión con Supabase'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">{sbTestResult.message}</div>
                    {sbTestResult.latencyMs > 0 && (
                      <div className="mt-1 font-mono text-[10px] text-slate-400 tabular-nums">
                        Latencia: {sbTestResult.latencyMs} ms
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Accordion
                title={
                  <span className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    <span>Script SQL de Tablas &amp; Políticas RLS (Supabase)</span>
                  </span>
                }
              >
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold text-amber-400">
                      Pega esto en el SQL Editor de tu proyecto Supabase:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSql ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2.5 bg-slate-900 rounded-xl max-h-40 border border-slate-800">
                    {SUPABASE_SQL_SCRIPT}
                  </pre>
                </div>
              </Accordion>

              {onSyncAllToSupabase && (
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Respaldar Códigos Escaneados en Supabase</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Sube todos los códigos locales que aún no estén guardados en la nube.
                      </p>
                    </div>
                    <Badge tone="emerald">{scansCount} en app</Badge>
                  </div>
                  <TactileButton
                    type="button"
                    onClick={async () => {
                      setIsSyncingAll(true);
                      try {
                        const count = await onSyncAllToSupabase();
                        soundManager.playSuccess();
                        toast({
                          variant: 'success',
                          title: 'Respaldo completado en Supabase',
                          description: `${count} códigos verificados en la nube.`,
                        });
                      } catch {
                        soundManager.playError();
                        toast({
                          variant: 'error',
                          title: 'Error al respaldar en Supabase',
                          description: 'Verifica la URL y la Anon Key.',
                        });
                      } finally {
                        setIsSyncingAll(false);
                      }
                    }}
                    disabled={isSyncingAll || !sbIsEnabled}
                    className="w-full py-2.5 px-4 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Database
                      className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingAll ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isSyncingAll
                        ? 'Guardando en Supabase...'
                        : 'Guardar y Respaldar Códigos Ahora'}
                    </span>
                  </TactileButton>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <Switch
                  checked={sbIsEnabled}
                  onChange={setSbIsEnabled}
                  tone="emerald"
                  label="Guardado simultáneo en Supabase"
                  description="Respalda en la nube cada escaneo de la TC26"
                />

                <TactileButton
                  anticipation
                  type="button"
                  onClick={handleSaveSupabase}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Guardar Configuración Supabase
                </TactileButton>
              </div>
            </div>
          </ShakeContainer>
        </FadeSlide>
      )}
    </div>
  );
};
