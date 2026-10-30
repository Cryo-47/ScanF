import { ScannedItem, PowerAutomateConfig, SupabaseConfig, DeviceInfo, DeviceStatusSummary, CountRound } from '../types/inventory';

export interface SyncResult {
  sharepointState: 'synced' | 'pending' | 'failed' | 'simulated';
  supabaseState: 'synced' | 'pending' | 'failed' | 'simulated';
  errorMessage?: string;
}

/**
 * Builds the exact JSON payload expected by Power Automate for SharePoint Excel
 */
export function buildPowerAutomatePayload(item: ScannedItem) {
  const roundMap: Record<string, string> = {
    '1ER_CONTEO': '1er Conteo',
    '2DO_CONTEO': '2do Conteo',
    '3ER_CONTEO': '3er Conteo Extraordinario',
    'CONTEO_FINALIZADO': 'Finalizado',
  };

  // El número de usuario es el que se plasma en el archivo de Excel de SharePoint en la columna de usuario
  const excelUserVal = item.userNumber ? `Usuario ${item.userNumber}` : (item.operador || 'Usuario 1');

  return {
    id_escaneo: item.id,
    fecha_hora: item.timestamp,
    sku: item.sku,
    cantidad: item.cantidad,
    descripcion: item.descripcion,
    subinventario: item.subinventario,
    localizador: item.localizador,
    ronda_conteo: roundMap[item.conteoRound] || item.conteoRound,
    operador: excelUserVal,
    dispositivo: item.dispositivo,
    codigo_qr_raw: item.rawQr,
  };
}

export function getSupabaseRestEndpoint(url: string, tableName: string): string {
  let cleanUrl = url.trim().replace(/\/+$/, '');
  if (cleanUrl.endsWith('/rest/v1')) {
    cleanUrl = cleanUrl.substring(0, cleanUrl.length - '/rest/v1'.length);
  }
  const cleanTable = encodeURIComponent(tableName.trim());
  return `${cleanUrl}/rest/v1/${cleanTable}`;
}

/**
 * Push device heartbeat and selected user number (1 to 10) to Supabase
 * This enables the Gerente web browser to immediately see the connected handheld.
 */
export async function pushTerminalPresence(
  deviceInfo: DeviceInfo,
  currentRound: CountRound,
  stats: {
    totalScans: number;
    totalPieces: number;
    lastSku?: string;
    lastLocator?: string;
  },
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const endpoint = getSupabaseRestEndpoint(supabaseConfig.url, 'terminal_sessions');
  const payload = {
    device_id: deviceInfo.deviceId || 'TC26-DEFAULT',
    device_name: deviceInfo.deviceName || 'TC26 - Terminal',
    operator_name: deviceInfo.operatorName || (deviceInfo.userNumber ? `Usuario ${deviceInfo.userNumber}` : 'Sin asignar'),
    user_number: deviceInfo.userNumber !== undefined ? deviceInfo.userNumber : null,
    current_round: currentRound,
    total_scans: stats.totalScans || 0,
    total_piezas: stats.totalPieces || 0,
    last_sku: stats.lastSku || null,
    last_locator: stats.lastLocator || null,
    last_active: new Date().toISOString(),
    status: 'online',
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    return res.ok || res.status === 200 || res.status === 201 || res.status === 204;
  } catch {
    return false;
  }
}

/**
 * Fetch all active handheld sessions from Supabase for Gerente's live monitoring
 */
export async function fetchTerminalSessions(
  supabaseConfig?: SupabaseConfig
): Promise<DeviceStatusSummary[]> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return [];
  }

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'terminal_sessions')}?select=*&order=last_active.desc`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      deviceId: String(row.device_id || ''),
      deviceName: String(row.device_name || row.device_id || 'TC26'),
      operatorName: String(row.operator_name || (row.user_number ? `Usuario ${row.user_number}` : 'Operador')),
      userNumber: row.user_number ? Number(row.user_number) : undefined,
      currentRound: (row.current_round as CountRound) || '1ER_CONTEO',
      totalPieces: Number(row.total_piezas || 0),
      totalScans: Number(row.total_scans || 0),
      lastActive: String(row.last_active || new Date().toISOString()),
      lastSku: row.last_sku ? String(row.last_sku) : undefined,
      lastLocator: row.last_locator ? String(row.last_locator) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Delete a specific terminal session from Supabase (by deviceId or userNumber)
 */
export async function deleteTerminalSession(
  deviceIdOrUser: string,
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const isUserNum = !isNaN(Number(deviceIdOrUser)) && Number(deviceIdOrUser) > 0;
  const filter = isUserNum 
    ? `user_number=eq.${Number(deviceIdOrUser)}`
    : `device_id=eq.${encodeURIComponent(deviceIdOrUser)}`;

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'terminal_sessions')}?${filter}`;

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    return res.ok || res.status === 204 || res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Clear all live terminal sessions from Supabase (resets live monitoring to 0)
 */
export async function clearAllTerminalSessions(
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'terminal_sessions')}?device_id=not.is.null`;

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    return res.ok || res.status === 204 || res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Push an inventory scan to Supabase cloud table
 */
export async function pushScanToSupabase(
  item: ScannedItem,
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const endpoint = getSupabaseRestEndpoint(supabaseConfig.url, 'inventory_scans');
  const payload = {
    id: item.id,
    fecha_hora: item.timestamp,
    sku: item.sku,
    cantidad: item.cantidad,
    descripcion: item.descripcion,
    subinventario: item.subinventario,
    localizador: item.localizador,
    ronda_conteo: item.conteoRound,
    operador: item.operador,
    dispositivo: item.dispositivo,
    user_number: item.userNumber ?? null,
    codigo_qr_raw: item.rawQr,
    sync_state_sharepoint: item.syncStateSharepoint || 'synced',
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    return res.ok || res.status === 200 || res.status === 201 || res.status === 204;
  } catch {
    return false;
  }
}

/**
 * Fetch all scans stored in Supabase cloud so Gerente and handhelds stay completely synchronized
 */
export async function fetchCloudScans(
  supabaseConfig?: SupabaseConfig
): Promise<ScannedItem[]> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return [];
  }

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'inventory_scans')}?select=*&order=fecha_hora.desc&limit=2000`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id || ''),
      sku: String(row.sku || ''),
      cantidad: Number(row.cantidad || 0),
      descripcion: String(row.descripcion || ''),
      subinventario: String(row.subinventario || ''),
      localizador: String(row.localizador || ''),
      conteoRound: (row.ronda_conteo as CountRound) || '1ER_CONTEO',
      rawQr: String(row.codigo_qr_raw || ''),
      timestamp: String(row.fecha_hora || row.created_at || new Date().toISOString()),
      operador: String(row.operador || 'Usuario 1'),
      userNumber: row.user_number ? Number(row.user_number) : undefined,
      dispositivo: String(row.dispositivo || 'TC26'),
      syncStateSharepoint: (row.sync_state_sharepoint as any) || 'synced',
    }));
  } catch {
    return [];
  }
}

/**
 * Delete a single scan record from Supabase table (Master user only)
 */
export async function deleteScanFromSupabase(
  scanId: string,
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'inventory_scans')}?id=eq.${encodeURIComponent(scanId)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    return res.ok || res.status === 204 || res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Delete all scan records from Supabase table (Master user only)
 */
export async function deleteAllScansFromSupabase(
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  // PostgREST requires a filter to prevent accidental unconditional deletion of whole tables.
  // Using id=not.is.null matches all records with a non-null id.
  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'inventory_scans')}?id=not.is.null`;

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    return res.ok || res.status === 204 || res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Push round authorizations (Gerente) to Supabase so handhelds reflect the changes automatically
 */
export async function pushRoundControl(
  globalRound: CountRound,
  userRounds: Record<number, CountRound>,
  authorizations: Record<number, boolean>,
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const endpoint = getSupabaseRestEndpoint(supabaseConfig.url, 'inventory_round_control');
  const payload = {
    id: 'global_control',
    global_round: globalRound,
    user_rounds: userRounds,
    round2_authorizations: authorizations,
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    return res.ok || res.status === 200 || res.status === 201 || res.status === 204;
  } catch {
    return false;
  }
}

/**
 * Fetch round control state from Supabase
 */
export async function fetchRoundControl(
  supabaseConfig?: SupabaseConfig
): Promise<{
  globalRound: CountRound;
  userRounds: Record<number, CountRound>;
  authorizations: Record<number, boolean>;
} | null> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return null;
  }

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'inventory_round_control')}?id=eq.global_control&limit=1`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const row = data[0];
    return {
      globalRound: (row.global_round as CountRound) || '1ER_CONTEO',
      userRounds: (row.user_rounds as Record<number, CountRound>) || {},
      authorizations: (row.round2_authorizations as Record<number, boolean>) || {},
    };
  } catch {
    return null;
  }
}

/**
 * Synchronize a single scanned item to Power Automate (SharePoint) and Supabase
 */
export async function syncScannedItem(
  item: ScannedItem,
  powerAutomateConfig: PowerAutomateConfig,
  supabaseConfig?: SupabaseConfig
): Promise<SyncResult> {
  let sharepointState: SyncResult['sharepointState'] = 'pending';
  let supabaseState: SyncResult['supabaseState'] = 'simulated';
  let errorMessage: string | undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const sharepointPromise = (async () => {
    if (powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl) {
      try {
        const payload = buildPowerAutomatePayload(item);
        const res = await fetch(powerAutomateConfig.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (res.ok || res.status === 202 || res.status === 200 || res.status === 204) {
          sharepointState = 'synced';
        } else {
          sharepointState = 'failed';
          errorMessage = `Power Automate respondió HTTP ${res.status}: ${res.statusText}`;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sharepointState = 'pending';
        errorMessage = `Error de conexión: ${msg}`;
      }
    } else {
      sharepointState = 'simulated';
    }
  })();

  const supabasePromise = (async () => {
    if (supabaseConfig?.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        const success = await pushScanToSupabase(item, supabaseConfig);
        supabaseState = success ? 'synced' : 'failed';
      } catch {
        supabaseState = 'failed';
      }
    } else {
      supabaseState = 'simulated';
    }
  })();

  try {
    await Promise.all([sharepointPromise, supabasePromise]);
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    sharepointState,
    supabaseState,
    errorMessage,
  };
}

/**
 * Test a Power Automate Webhook URL
 */
export async function testPowerAutomateWebhook(webhookUrl: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'Ingresa una URL válida de Power Automate (debe comenzar con https://)',
      latencyMs: 0,
    };
  }

  const samplePayload = {
    id_escaneo: 'TEST-' + Date.now(),
    fecha_hora: new Date().toISOString(),
    sku: 'TEST-SKU',
    cantidad: 1,
    descripcion: 'PRUEBA CONEXION EXCEL SHAREPOINT',
    subinventario: 'LINEA',
    localizador: 'A-1-1',
    ronda_conteo: '1er Conteo',
    operador: 'OPERADOR_TC26',
    dispositivo: 'Zebra TC26',
    codigo_qr_raw: 'TEST-SKU_1_PRUEBA CONEXION EXCEL SHAREPOINT_LINEA_A-1-1',
  };

  const start = performance.now();
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(samplePayload),
    });

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok || res.status === 202 || res.status === 200 || res.status === 204) {
      return {
        success: true,
        message: `Conexión exitosa con Power Automate (HTTP ${res.status}). SharePoint registrará la fila en Excel.`,
        latencyMs,
      };
    } else {
      const text = await res.text();
      return {
        success: false,
        message: `El webhook respondió HTTP ${res.status}: ${text || res.statusText}`,
        latencyMs,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Error al conectar con Power Automate: ${msg}`,
      latencyMs,
    };
  }
}

export async function testSupabaseConnection(
  url: string, 
  anonKey: string, 
  tableName = 'terminal_sessions'
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  if (!url || !url.startsWith('http')) {
    return {
      success: false,
      message: 'Ingresa una URL válida de Supabase (ej. https://abcdefghijklm.supabase.co)',
      latencyMs: 0,
    };
  }
  if (!anonKey || anonKey.trim().length < 20) {
    return {
      success: false,
      message: 'Ingresa una clave Anon Key (Project API Key) válida de Supabase',
      latencyMs: 0,
    };
  }

  const cleanTable = tableName.trim() || 'terminal_sessions';
  const endpoint = `${getSupabaseRestEndpoint(url, cleanTable)}?select=*&limit=1`;
  const start = performance.now();

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': anonKey.trim(),
        'Authorization': `Bearer ${anonKey.trim()}`,
      },
    });

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok || res.status === 200 || res.status === 206) {
      return {
        success: true,
        message: `Conexión exitosa con Supabase. La tabla "${cleanTable}" está accesible y lista para sincronización en vivo.`,
        latencyMs,
      };
    } else {
      const errText = await res.text();
      let detail = errText;
      try {
        const json = JSON.parse(errText);
        detail = json.message || json.hint || errText;
      } catch {
        // ignore
      }
      return {
        success: false,
        message: `Supabase respondió HTTP ${res.status}: ${detail || res.statusText}`,
        latencyMs,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Error al conectar con Supabase: ${msg}`,
      latencyMs,
    };
  }
}

/**
 * Push SharePoint / Power Automate webhook configuration to Supabase table
 * so all handhelds and devices share the exact same working URL permanently.
 */
export async function pushSharepointSettings(
  cfg: PowerAutomateConfig,
  supabaseConfig?: SupabaseConfig
): Promise<boolean> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return false;
  }

  const endpoint = getSupabaseRestEndpoint(supabaseConfig.url, 'sharepoint_settings');
  const payload = {
    id: 'global_config',
    webhook_url: cfg.webhookUrl,
    excel_file_direct_url: cfg.excelFileDirectUrl || null,
    sharepoint_site_url: cfg.sharepointSiteUrl || null,
    table_name: cfg.tableName || 'TablaConteo1',
    is_enabled: cfg.isEnabled !== undefined ? cfg.isEnabled : true,
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    return res.ok || res.status === 200 || res.status === 201 || res.status === 204;
  } catch {
    return false;
  }
}

/**
 * Fetch SharePoint / Power Automate settings from Supabase
 */
export async function fetchSharepointSettings(
  supabaseConfig?: SupabaseConfig
): Promise<Partial<PowerAutomateConfig> | null> {
  if (!supabaseConfig?.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return null;
  }

  const endpoint = `${getSupabaseRestEndpoint(supabaseConfig.url, 'sharepoint_settings')}?select=*&id=eq.global_config&limit=1`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey.trim(),
        'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const row = data[0];
    if (!row || !row.webhook_url) return null;

    return {
      webhookUrl: String(row.webhook_url),
      excelFileDirectUrl: row.excel_file_direct_url ? String(row.excel_file_direct_url) : undefined,
      sharepointSiteUrl: row.sharepoint_site_url ? String(row.sharepoint_site_url) : undefined,
      tableName: row.table_name ? String(row.table_name) : 'TablaConteo1',
      isEnabled: row.is_enabled !== undefined ? Boolean(row.is_enabled) : true,
    };
  } catch {
    return null;
  }
}

