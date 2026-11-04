import { QrParseResult } from '../types/inventory';

/**
 * Parses a QR code with the structure:
 * SKU_Cantidad_Descripcion_Subinventario_Localizador
 * 
 * Example: C0583-00_540_JADE PRO SERIES COMAL XL 35 CM_LINEA_A-1-3
 */
export function parseInventoryQr(qrString: string): QrParseResult {
  const raw = (qrString || '').trim();

  if (!raw) {
    return {
      isValid: false,
      sku: '',
      cantidad: 0,
      descripcion: '',
      subinventario: '',
      localizador: '',
      error: 'Código QR vacío o no detectable',
      raw,
    };
  }

  // Split by underscore delimiter
  const parts = raw.split('_');

  if (parts.length < 5) {
    return {
      isValid: false,
      sku: parts[0] || 'DESCONOCIDO',
      cantidad: parseInt(parts[1] || '0', 10) || 0,
      descripcion: parts.slice(2).join(' ') || raw,
      subinventario: 'DEFAULT',
      localizador: 'GENERAL',
      error: `Formato incorrecto. Se esperaban 5 segmentos separados por guion bajo (_). Encontrados: ${parts.length}`,
      raw,
    };
  }

  // 1. SKU is first part
  const sku = parts[0].trim();

  // 2. Quantity is second part
  const cantidadParsed = parseInt(parts[1].trim(), 10);
  const cantidad = isNaN(cantidadParsed) ? 1 : Math.max(0, cantidadParsed);

  // 4 & 5. Last two are Subinventario and Localizador
  const localizador = parts[parts.length - 1].trim();
  const subinventario = parts[parts.length - 2].trim();

  // 3. Middle parts form the description (handles descriptions that might contain underscores)
  const descripcion = parts.slice(2, parts.length - 2).join('_').trim();

  return {
    isValid: Boolean(sku && descripcion && subinventario && localizador),
    sku,
    cantidad,
    descripcion,
    subinventario,
    localizador,
    raw,
  };
}

/**
 * Format components back into the standard QR barcode payload
 */
export function formatInventoryQr(
  sku: string,
  cantidad: number,
  descripcion: string,
  subinventario: string,
  localizador: string
): string {
  return `${sku.trim()}_${cantidad}_${descripcion.trim()}_${subinventario.trim()}_${localizador.trim()}`;
}

/**
 * Sample items commonly used for testing or warehouse simulation
 */
export const SAMPLE_QR_CODES = [
  {
    label: 'Comal Jade Pro (Ejemplo original)',
    qr: 'C0583-00_540_JADE PRO SERIES COMAL XL 35 CM_LINEA_A-1-3',
  },
  {
    label: 'Sartén Jade Chef 28cm',
    qr: 'C0612-01_320_JADE CHEF SKILLET 28 CM ANODIZADO_PT_B-4-2',
  },
  {
    label: 'Cacerola Jade Cook 24cm',
    qr: 'C0720-00_480_JADE COOK CASSEROLE CON TAPA VIDRIO 24 CM_LINEA_A-2-1',
  },
  {
    label: 'Olla Express Jade Quick 6L',
    qr: 'C0845-02_150_OLLA DE PRESION JADE QUICK 6 LITROS_ALMACEN_C-1-5',
  },
  {
    label: 'Set Cuchillos Jade Precision 5 Pzs',
    qr: 'C0930-00_600_SET DE CUCHILLOS CERAMICA JADE PRECISION_LINEA_A-3-4',
  },
];

/**
 * Detects if a locator corresponds to Level/Fila 1 (Picking area where goods move constantly)
 * Expected structure: Letra-Fila-Columna (e.g. A-1-3, B-1-12, L-1-54, A_1_3)
 */
export function isPickingFila1(locator: string): boolean {
  if (!locator) return false;
  const clean = locator.trim().toUpperCase();
  const parts = clean.split(/[-_\s]+/);
  // Must have Letra, Fila 1, and Columna (e.g. A-1-3, B-1-54)
  if (parts.length >= 3) {
    return (parts[1] === '1' || parts[1] === '01') && parts[2].length > 0;
  }
  return /^[A-Z][-_\s]+0?1[-_\s]+\d+/i.test(clean);
}
