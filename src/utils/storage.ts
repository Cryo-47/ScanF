import { ScannedItem, PowerAutomateConfig, SupabaseConfig, CountRound, DeviceInfo, DeviceStatusSummary } from '../types/inventory';

const STORAGE_KEYS = {
  SCANS: 'tc26_minimal_scans_v2',
  CONFIG: 'tc26_minimal_config_v2',
  SUPABASE: 'tc26_supabase_config_v2',
  COUNT_ROUND: 'tc26_current_round_v2',
  OPERATOR: 'tc26_operator_name_v2',
  MASTER_PIN: 'tc26_master_pin_v2',
  DEVICE_INFO: 'tc26_device_info_v4',
  ROUND2_AUTH: 'tc26_round2_authorizations_v2',
  USER_ROUNDS: 'tc26_user_rounds_v3',
};

export const DEFAULT_CONFIG: PowerAutomateConfig = {
  webhookUrl: 'https://defaultaa53848cce8346e7a4f67e95722c78.ff.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/03/workflows/2a1f4e5624d6473191e1243e7582b634/triggers/manual/paths/invoke?api-version=1',
  isEnabled: true,
  sharepointSiteUrl: 'https://cvdirectomexico-my.sharepoint.com/personal/darien_perez_cvdirecto_mx',
  excelFileName: 'Scaneo fiscal 2026.xlsx',
  excelFileDirectUrl: 'https://cvdirectomexico-my.sharepoint.com/:x:/g/personal/darien_perez_cvdirecto_mx/IQDD8GrWE8ExQqd0q4UnAx_AAXxNHR0FCYvrChowOlYaUKw?e=lVg9oD',
  tableName: 'TablaConteo1',
  lastTestStatus: 'idle',
};

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://rocvksztovacylltjopq.supabase.co/rest/v1/',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY3Zrc3p0b3ZhY3lsbHRqb3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzMzMjQsImV4cCI6MjEwODcwOTMyNH0.PH9vUDFX92GF24RRX_dL2x5lCg7mzLapllUolMiiXkw',
  tableName: 'inventory_scans',
  isEnabled: true,
  lastTestStatus: 'idle',
};

export function isRunningInApkOrStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function loadScans(): ScannedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SCANS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScans(scans: ScannedItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(scans));
  } catch {
    // Storage quota or disabled
  }
}

export function loadCountRound(): CountRound {
  if (typeof window === 'undefined') return '1ER_CONTEO';
  const val = localStorage.getItem(STORAGE_KEYS.COUNT_ROUND);
  if (val === '2DO_CONTEO' || val === '3ER_CONTEO' || val === 'CONTEO_FINALIZADO') {
    return val;
  }
  return '1ER_CONTEO';
}

export function saveCountRound(round: CountRound): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.COUNT_ROUND, round);
}

export function loadMasterPin(): string {
  if (typeof window === 'undefined') return '1234';
  return localStorage.getItem(STORAGE_KEYS.MASTER_PIN) || '1234';
}

export function saveMasterPin(pin: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.MASTER_PIN, pin);
}

export function loadPowerAutomateConfig(): PowerAutomateConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      webhookUrl: parsed.webhookUrl && parsed.webhookUrl.trim() ? parsed.webhookUrl : DEFAULT_CONFIG.webhookUrl,
      excelFileDirectUrl:
        parsed.excelFileDirectUrl && !parsed.excelFileDirectUrl.includes('tuempresa.sharepoint.com')
          ? parsed.excelFileDirectUrl
          : DEFAULT_CONFIG.excelFileDirectUrl,
      isEnabled: parsed.isEnabled !== undefined ? parsed.isEnabled : DEFAULT_CONFIG.isEnabled,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function savePowerAutomateConfig(cfg: PowerAutomateConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
}

export function loadSupabaseConfig(): SupabaseConfig {
  if (typeof window === 'undefined') return DEFAULT_SUPABASE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE);
    if (!raw) return DEFAULT_SUPABASE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SUPABASE_CONFIG,
      ...parsed,
      url: parsed.url && parsed.url.trim() ? parsed.url : DEFAULT_SUPABASE_CONFIG.url,
      anonKey: parsed.anonKey && parsed.anonKey.trim() ? parsed.anonKey : DEFAULT_SUPABASE_CONFIG.anonKey,
      tableName: parsed.tableName && parsed.tableName.trim() ? parsed.tableName : DEFAULT_SUPABASE_CONFIG.tableName,
      isEnabled: parsed.isEnabled !== undefined ? parsed.isEnabled : DEFAULT_SUPABASE_CONFIG.isEnabled,
    };
  } catch {
    return DEFAULT_SUPABASE_CONFIG;
  }
}

export function saveSupabaseConfig(cfg: SupabaseConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SUPABASE, JSON.stringify(cfg));
}

export function loadRound2Authorizations(): Record<number, boolean> {
  const defaults: Record<number, boolean> = {
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
    9: true,
    10: true,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROUND2_AUTH);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return defaults;
}

export function saveRound2Authorizations(authMap: Record<number, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ROUND2_AUTH, JSON.stringify(authMap));
  } catch {
    // ignore
  }
}

export function loadUserRounds(): Record<number, CountRound> {
  const defaults: Record<number, CountRound> = {
    1: '1ER_CONTEO',
    2: '1ER_CONTEO',
    3: '1ER_CONTEO',
    4: '1ER_CONTEO',
    5: '1ER_CONTEO',
    6: '1ER_CONTEO',
    7: '1ER_CONTEO',
    8: '1ER_CONTEO',
    9: '1ER_CONTEO',
    10: '1ER_CONTEO',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_ROUNDS);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return defaults;
}

export function saveUserRounds(userRounds: Record<number, CountRound>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.USER_ROUNDS, JSON.stringify(userRounds));
  } catch {
    // ignore
  }
}

export function loadDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'TC26-DEFAULT',
      deviceName: 'TC26 - Terminal 01',
      operatorName: '',
      isUserNumberLocked: false,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.deviceId && parsed.deviceName) {
        return {
          deviceId: parsed.deviceId,
          deviceName: parsed.deviceName,
          operatorName: parsed.operatorName || '',
          userNumber: parsed.userNumber,
          isUserNumberLocked: Boolean(parsed.isUserNumberLocked),
          registeredRound: parsed.registeredRound,
        };
      }
    }
  } catch {
    // ignore
  }

  // Generate new distinct device info for this handheld
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  const newInfo: DeviceInfo = {
    deviceId: `TC26-${randomSuffix}`,
    deviceName: `TC26 - Terminal ${randomSuffix}`,
    operatorName: '',
    isUserNumberLocked: false,
  };
  saveDeviceInfo(newInfo);
  return newInfo;
}

export function saveDeviceInfo(info: DeviceInfo): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(info));
    if (info.operatorName) {
      localStorage.setItem(STORAGE_KEYS.OPERATOR, info.operatorName);
    }
  } catch {
    // ignore
  }
}

export function unlockUserNumberCycle(): void {
  const current = loadDeviceInfo();
  saveDeviceInfo({
    ...current,
    isUserNumberLocked: false,
    userNumber: undefined,
    registeredRound: undefined,
  });
}

export function loadOperatorName(): string {
  const dev = loadDeviceInfo();
  return dev.operatorName || '';
}

export function saveOperatorName(name: string): void {
  const current = loadDeviceInfo();
  saveDeviceInfo({ ...current, operatorName: name });
}

export function computeDeviceSummaries(
  scans: ScannedItem[],
  currentDevice?: DeviceInfo,
  currentRound: CountRound = '1ER_CONTEO',
  userRounds?: Record<number, CountRound>
): DeviceStatusSummary[] {
  const map = new Map<string, DeviceStatusSummary>();

  // If current device exists, register it first
  if (currentDevice) {
    const key = currentDevice.deviceName;
    const effectiveDevRound = (currentDevice.userNumber && userRounds?.[currentDevice.userNumber])
      ? userRounds[currentDevice.userNumber]
      : currentRound;

    map.set(key, {
      deviceId: currentDevice.deviceId,
      deviceName: currentDevice.deviceName,
      operatorName: currentDevice.operatorName || (currentDevice.userNumber ? `Usuario ${currentDevice.userNumber}` : 'Sin asignar'),
      userNumber: currentDevice.userNumber,
      currentRound: effectiveDevRound,
      totalPieces: 0,
      totalScans: 0,
      lastActive: new Date().toISOString(),
    });
  }

  // Iterate scans (scans are ordered newest first)
  for (const scan of scans) {
    const devKey = scan.dispositivo || (scan.userNumber ? `Usuario ${scan.userNumber}` : scan.operador) || 'Dispositivo Desconocido';
    const existing = map.get(devKey);

    if (!existing) {
      map.set(devKey, {
        deviceId: devKey.startsWith('TC26') ? devKey.split(' ')[0] : 'TC26',
        deviceName: devKey,
        operatorName: scan.nombreOperadorCompleto || scan.operador || 'Operador',
        userNumber: scan.userNumber,
        currentRound: scan.conteoRound,
        totalPieces: scan.cantidad,
        totalScans: 1,
        lastActive: scan.timestamp,
        lastSku: scan.sku,
        lastLocator: scan.localizador,
      });
    } else {
      existing.totalPieces += scan.cantidad;
      existing.totalScans += 1;
      if (!existing.userNumber && scan.userNumber) {
        existing.userNumber = scan.userNumber;
      }
      // Scans are ordered newest first, so the first scan encountered has the latest round & sku
      if (!existing.lastSku) {
        existing.lastSku = scan.sku;
        existing.lastLocator = scan.localizador;
        existing.currentRound = scan.conteoRound;
        existing.lastActive = scan.timestamp;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });
}

export function exportScansToCsv(scans: ScannedItem[]): void {
  if (scans.length === 0) return;

  const roundLabel = (r: CountRound) => {
    if (r === '1ER_CONTEO') return '1er Conteo';
    if (r === '2DO_CONTEO') return '2do Conteo';
    if (r === '3ER_CONTEO') return '3er Conteo Extraordinario';
    return 'Finalizado';
  };

  const headers = [
    'ID_Escaneo',
    'Fecha_Hora',
    'Ronda_Conteo',
    'SKU',
    'Cantidad',
    'Descripcion',
    'Subinventario',
    'Localizador',
    'Usuario_Excel',
    'Nombre_Operador',
    'Dispositivo',
    'Estado_Excel',
    'Codigo_QR_Raw',
  ];

  const rows = scans.map((s) => [
    `"${s.id}"`,
    `"${s.timestamp}"`,
    `"${roundLabel(s.conteoRound)}"`,
    `"${s.sku}"`,
    s.cantidad,
    `"${s.descripcion.replace(/"/g, '""')}"`,
    `"${s.subinventario}"`,
    `"${s.localizador}"`,
    `"${s.operador}"`,
    `"${(s.nombreOperadorCompleto || '').replace(/"/g, '""')}"`,
    `"${s.dispositivo}"`,
    `"${s.syncStateSharepoint}"`,
    `"${s.rawQr.replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `Inventario_SharePoint_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
