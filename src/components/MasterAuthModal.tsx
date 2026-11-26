import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  Copy,
  Code,
} from 'lucide-react';
import { UserRole, PowerAutomateConfig, SupabaseConfig } from '../types/inventory';
import { loadMasterPin, saveMasterPin } from '../utils/storage';
import { testPowerAutomateWebhook, testSupabaseConnection } from '../utils/syncService';
import { soundManager } from '../utils/audioHaptics';
import { SUPABASE_SQL_SCRIPT, SUPABASE_SHAREPOINT_SETTINGS_SQL } from '../utils/supabaseSql';
import { Accordion, Switch, Tabs } from './ui/Controls';
import { EASE_OUT_EXPO, FadeSlide, ShakeContainer, TactileButton } from './ui/MotionPrimitives';
import { useToast } from './ui/ToastProvider';

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
  const { toast } = useToast();
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(userRole === 'MASTER');
  const [pinError, setPinError] = useState(false);
  const [pinShakeCount, setPinShakeCount] = useState(0);
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
  const [copiedSharepointSql, setCopiedSharepointSql] = useState(false);

  // Supabase form state
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [sbUrl, setSbUrl] = useState(supabaseConfig.url);
  const [sbAnonKey, setSbAnonKey] = useState(supabaseConfig.anonKey);
  const [sbTableName, setSbTableName] = useState(supabaseConfig.tableName || 'inventory_scans');
  const [sbIsEnabled, setSbIsEnabled] = useState(supabaseConfig.isEnabled);
  const [sbTesting, setSbTesting] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAuthenticated(userRole === 'MASTER');
      setPinError(false);
      setPinInput('');
      setPaWebhookUrl(powerAutomateConfig.webhookUrl);
      setPaExcelDirectUrl(powerAutomateConfig.excelFileDirectUrl || '');
      setPaIsEnabled(powerAutomateConfig.isEnabled);
      setSbUrl(supabaseConfig.url);
      setSbAnonKey(supabaseConfig.anonKey);
      setSbTableName(supabaseConfig.tableName || 'inventory_scans');
      setSbIsEnabled(supabaseConfig.isEnabled);
    }
  }, [isOpen, userRole, powerAutomateConfig, supabaseConfig]);

  if (!isOpen) return null;

  const storedPin = loadMasterPin();
  const isWebhookUrlValid = !paWebhookUrl.trim() || /^https?:\/\//i.test(paWebhookUrl.trim());
  const isSbUrlValid = !sbUrl.trim() || /^https?:\/\//i.test(sbUrl.trim());

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === storedPin) {
      setIsAuthenticated(true);
      onSetUserRole('MASTER');
      setPinError(false);
      setPinInput('');
      soundManager.playSuccess();
      toast({ title: 'Acceso Master habilitado', variant: 'success' });
    } else {
      setPinError(true);
      setPinShakeCount((c) => c + 1);
      setPinInput('');
      soundManager.playError();
    }
  };

  const handleSavePin = () => {
    if (newPin.trim().length >= 4) {
      saveMasterPin(newPin.trim());
      setIsChangingPin(false);
      setNewPin('');
      soundManager.playSuccess();
      toast({ title: 'Nuevo PIN Master guardado', variant: 'success' });
    }
  };

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
      if (res.success) soundManager.playSuccess();
      else soundManager.playError();
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
    soundManager.playSuccess();
    toast({ title: 'Configuración SharePoint guardada en Supabase', variant: 'success' });
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
      if (res.success) soundManager.playSuccess();
      else soundManager.playError();
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
    soundManager.playSuccess();
    toast({ title: 'Configuración Supabase guardada', variant: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
        className="glass-surface-strong border border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Configuración de Enlaces — Usuario Master
            </h2>
            <p className="text-xs text-slate-400">
              Administración exclusiva de conexiones con SharePoint y Supabase
            </p>
          </div>
        </div>

        {!isAuthenticated ? (
          <ShakeContainer shakeKey={pinShakeCount}>
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
                  className={`w-full h-12 bg-slate-950 border rounded-xl px-4 text-center text-2xl font-mono tracking-widest text-white focus:outline-none transition-colors ${
                    pinError ? 'border-rose-500' : 'border-slate-700 focus:border-amber-400'
                  }`}
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs text-rose-400 mt-1.5 text-center font-medium">
                    PIN incorrecto. Verifica tu clave de acceso Master.
                  </p>
                )}
              </div>

              <TactileButton
                type="submit"
                anticipation
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors shadow-md cursor-pointer"
              >
                Acceder a Configuraciones Master
              </TactileButton>
            </form>
          </ShakeContainer>
        ) : (
          <div className="space-y-4">
            <Tabs
              layoutGroup="master-modal-tabs"
              value={activeMasterSection}
              onChange={setActiveMasterSection}
              items={[
                { id: 'sharepoint', label: '1. SharePoint', icon: <Workflow className="w-3.5 h-3.5" /> },
                { id: 'supabase', label: '2. Supabase', icon: <Database className="w-3.5 h-3.5" /> },
              ]}
            />

            {activeMasterSection === 'sharepoint' && (
              <FadeSlide className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      URL del Webhook de Power Automate (HTTP POST):
                    </label>
                    {!isWebhookUrlValid && (
                      <span className="text-[10px] text-rose-400 font-semibold">Debe iniciar con https://</span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={paWebhookUrl}
                      onChange={(e) => setPaWebhookUrl(e.target.value)}
                      placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                      className={`flex-1 h-11 bg-slate-950 border rounded-xl px-3 font-mono text-xs text-amber-300 placeholder:text-slate-600 focus:outline-none ${
                        !isWebhookUrlValid ? 'border-rose-500' : 'border-slate-700 focus:border-amber-400'
                      }`}
                    />
                    <TactileButton
                      type="button"
                      onClick={handleTestSharepoint}
                      disabled={paTesting}
                      className="h-11 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 whitespace-nowrap shadow-md shrink-0 cursor-pointer"
                    >
                      <Send className={`w-3.5 h-3.5 ${paTesting ? 'animate-bounce' : ''}`} />
                      <span>{paTesting ? 'Probando...' : 'Probar Conexión'}</span>
                    </TactileButton>
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
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <Switch
                    checked={paIsEnabled}
                    onChange={setPaIsEnabled}
                    tone="blue"
                    label="Sincronización activa con SharePoint"
                  />
                  <TactileButton
                    type="button"
                    onClick={handleSaveSharepoint}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    Guardar SharePoint
                  </TactileButton>
                </div>

                <Accordion
                  title="Script SQL: Tabla sharepoint_settings"
                  subtitle="Guarda automáticamente el link en la nube para todas las TC26"
                >
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SUPABASE_SHAREPOINT_SETTINGS_SQL);
                        setCopiedSharepointSql(true);
                        soundManager.playSuccess();
                        setTimeout(() => setCopiedSharepointSql(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      {copiedSharepointSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSharepointSql ? 'Copiado' : 'Copiar SQL'}</span>
                    </button>
                    <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900 rounded border border-slate-800 max-h-28">
                      {SUPABASE_SHAREPOINT_SETTINGS_SQL}
                    </pre>
                  </div>
                </Accordion>
              </FadeSlide>
            )}

            {activeMasterSection === 'supabase' && (
              <FadeSlide className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">URL Supabase:</label>
                      {!isSbUrlValid && <span className="text-[10px] text-rose-400">URL inválida</span>}
                    </div>
                    <input
                      type="url"
                      value={sbUrl}
                      onChange={(e) => setSbUrl(e.target.value)}
                      placeholder="https://xyzabcdefg.supabase.co"
                      className={`w-full h-10 bg-slate-950 border rounded-xl px-3 font-mono text-xs text-emerald-300 focus:outline-none ${
                        !isSbUrlValid ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-400'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Tabla:</label>
                    <input
                      type="text"
                      value={sbTableName}
                      onChange={(e) => setSbTableName(e.target.value)}
                      placeholder="inventory_scans"
                      className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supabase Anon Key:</label>
                  <input
                    type="password"
                    value={sbAnonKey}
                    onChange={(e) => setSbAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TactileButton
                    type="button"
                    onClick={handleTestSupabase}
                    disabled={sbTesting}
                    className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 ${sbTesting ? 'animate-bounce' : ''}`} />
                    <span>{sbTesting ? 'Verificando...' : 'Probar Conexión Supabase'}</span>
                  </TactileButton>
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

                <Accordion
                  title={
                    <span className="flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-amber-400" />
                      <span>Script SQL completo de tablas Supabase</span>
                    </span>
                  }
                >
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
                    </button>
                    <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900 rounded max-h-32 border border-slate-800">
                      {SUPABASE_SQL_SCRIPT}
                    </pre>
                  </div>
                </Accordion>

                {onSyncAllToSupabase && (
                  <TactileButton
                    type="button"
                    onClick={async () => {
                      setIsSyncingAll(true);
                      try {
                        const count = await onSyncAllToSupabase();
                        soundManager.playSuccess();
                        toast({
                          title: `${count} códigos respaldados en Supabase`,
                          variant: 'success',
                        });
                      } catch {
                        soundManager.playError();
                        toast({
                          title: 'Error al respaldar escaneos en Supabase',
                          variant: 'error',
                        });
                      } finally {
                        setIsSyncingAll(false);
                      }
                    }}
                    disabled={isSyncingAll || !sbIsEnabled}
                    className="w-full py-2.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Database className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingAll ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncingAll
                        ? 'Guardando en Supabase...'
                        : `Respaldar ${scansCount} códigos locales en Supabase`}
                    </span>
                  </TactileButton>
                )}

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <Switch
                    checked={sbIsEnabled}
                    onChange={setSbIsEnabled}
                    tone="emerald"
                    label="Habilitar sincronización con Supabase"
                  />
                  <TactileButton
                    type="button"
                    onClick={handleSaveSupabase}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    Guardar Supabase
                  </TactileButton>
                </div>
              </FadeSlide>
            )}

            {/* Footer PIN Management & Logout */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {!isChangingPin ? (
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-[11px] text-slate-400 hover:text-amber-400 underline flex items-center gap-1 cursor-pointer"
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
                    placeholder="Nuevo PIN (4+)"
                    className="w-28 h-8 bg-slate-950 border border-slate-700 rounded-lg px-2 text-xs text-center text-white"
                  />
                  <button
                    type="button"
                    disabled={newPin.trim().length < 4}
                    onClick={handleSavePin}
                    className="h-8 px-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPin(false)}
                    className="text-xs text-slate-400 hover:text-white px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsAuthenticated(false);
                  onSetUserRole('GERENTE');
                  onClose();
                }}
                className="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión Master</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
