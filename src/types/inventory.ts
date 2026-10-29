export type MovementType = 'CONTEO_CICLICO' | 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export type CountRound = '1ER_CONTEO' | '2DO_CONTEO' | '3ER_CONTEO' | 'CONTEO_FINALIZADO';

export type SyncState = 'synced' | 'pending' | 'failed' | 'simulated';

export interface ScannedItem {
  id: string;
  sku: string;
  cantidad: number;
  descripcion: string;
  subinventario: string;
  localizador: string;
  conteoRound: CountRound;
  rawQr: string;
  timestamp: string;
  operador: string; // "Usuario 1" a "Usuario 10" (se plasma en la columna de usuario en Excel)
  nombreOperadorCompleto?: string; // Nombre completo del operador
  userNumber?: number; // 1 a 10
  dispositivo: string;
  syncStateSharepoint: SyncState;
  syncError?: string;
}

export interface QrParseResult {
  isValid: boolean;
  sku: string;
  cantidad: number;
  descripcion: string;
  subinventario: string;
  localizador: string;
  error?: string;
  raw: string;
}

export type UserRole = 'OPERADOR_APK' | 'GERENTE' | 'MASTER';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  operatorName: string;
  userNumber?: number; // 1 al 10
  isUserNumberLocked: boolean; // Vinculado al dispositivo durante el ciclo completo
  registeredRound?: CountRound; // Ronda para la que se solicitó el nombre completo
}

export type Round2Authorizations = Record<number, boolean>;

export type UserRoundsMap = Record<number, CountRound>;

export interface DeviceStatusSummary {
  deviceId: string;
  deviceName: string;
  operatorName: string;
  userNumber?: number;
  currentRound: CountRound;
  totalPieces: number;
  totalScans: number;
  lastActive: string;
  lastSku?: string;
  lastLocator?: string;
}

export interface PowerAutomateConfig {
  webhookUrl: string;
  isEnabled: boolean;
  sharepointSiteUrl?: string;
  excelFileName?: string;
  excelFileDirectUrl?: string; // Link directo del archivo Excel en SharePoint
  tableName?: string;
  lastTestStatus?: 'success' | 'failed' | 'idle';
  lastTestMessage?: string;
  lastTestTimestamp?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  isEnabled: boolean;
  lastTestStatus?: 'success' | 'failed' | 'idle';
  lastTestMessage?: string;
  lastTestTimestamp?: string;
}
