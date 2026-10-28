import { ScannedItem, PowerAutomateConfig, SupabaseConfig } from '../types/inventory';

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

export function getSupabaseRestEndpoint(url: string, tableName = 'inventory_scans'): string {
  let cleanUrl = url.trim().replace(/\/+$/, '');
  if (cleanUrl.endsWith('/rest/v1')) {
    cleanUrl = cleanUrl.substring(0, cleanUrl.length - '/rest/v1'.length);
  }
  const cleanTable = encodeURIComponent(tableName.trim() || 'inventory_scans');
  return `${cleanUrl}/rest/v1/${cleanTable}`;
}

/**
 * Synchronize a single scanned item to Power Automate (SharePoint)
 */
export async function syncScannedItem(
  item: ScannedItem,
  powerAutomateConfig: PowerAutomateConfig,
  supabaseConfig?: SupabaseConfig
): Promise<SyncResult> {
  let sharepointState: SyncResult['sharepointState'] = 'pending';
  let supabaseState: SyncResult['supabaseState'] = 'simulated';
  let errorMessage: string | undefined;

  // Power Automate Sync (SharePoint Excel)
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
    // If webhook is not configured or in local test mode
    sharepointState = 'simulated';
  }

  // Supabase Sync (Cloud Database)
  if (supabaseConfig?.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
    try {
      const endpoint = getSupabaseRestEndpoint(supabaseConfig.url, supabaseConfig.tableName || 'inventory_scans');
      const payload = {
        id_escaneo: item.id,
        fecha_hora: item.timestamp,
        sku: item.sku,
        cantidad: item.cantidad,
        descripcion: item.descripcion,
        subinventario: item.subinventario,
        localizador: item.localizador,
        ronda_conteo: item.conteoRound,
        operador: item.operador,
        dispositivo: item.dispositivo,
        codigo_qr_raw: item.rawQr,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey.trim(),
          'Authorization': `Bearer ${supabaseConfig.anonKey.trim()}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok || res.status === 201 || res.status === 200 || res.status === 204) {
        supabaseState = 'synced';
      } else {
        supabaseState = 'failed';
      }
    } catch {
      supabaseState = 'failed';
    }
  } else {
    supabaseState = 'simulated';
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
  tableName = 'inventory_scans'
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

  const cleanTable = tableName.trim() || 'inventory_scans';
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
        message: `Conexión exitosa con Supabase. La tabla "${cleanTable}" está accesible.`,
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
