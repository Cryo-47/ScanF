/**
 * Complete Supabase (PostgreSQL) Schema Script for Zebra TC26 Warehouse Inventory
 * Copy and paste this directly into the Supabase SQL Editor.
 */

export const SUPABASE_SQL_SCRIPT = `-- =====================================================================
-- ESQUEMA DE INVENTARIO PARA HANDHELD ZEBRA TC26 (SUPABASE / POSTGRESQL)
-- =====================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla Principal: Registro de Escaneos Individuales (Audit Log)
CREATE TABLE IF NOT EXISTS public.inventory_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    descripcion TEXT NOT NULL,
    subinventario VARCHAR(100) NOT NULL,
    localizador VARCHAR(100) NOT NULL,
    tipo_movimiento VARCHAR(50) NOT NULL DEFAULT 'ENTRADA', -- ENTRADA, SALIDA, CONTEO_CICLICO, REUBICACION, AJUSTE
    operador VARCHAR(100) DEFAULT 'OPERADOR_TC26',
    turno VARCHAR(50) DEFAULT 'TURNO_1',
    dispositivo VARCHAR(100) DEFAULT 'Zebra TC26',
    codigo_qr_raw TEXT NOT NULL,
    notas TEXT,
    sincronizado_sharepoint BOOLEAN DEFAULT false,
    sharepoint_sync_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de alto rendimiento para consultas en almacén
CREATE INDEX IF NOT EXISTS idx_scans_sku ON public.inventory_scans (sku);
CREATE INDEX IF NOT EXISTS idx_scans_subinventario ON public.inventory_scans (subinventario);
CREATE INDEX IF NOT EXISTS idx_scans_localizador ON public.inventory_scans (localizador);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.inventory_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_composite ON public.inventory_scans (sku, subinventario, localizador);

-- 3. Tabla Resumen: Stock Consolidado en Tiempo Real por Ubicación
CREATE TABLE IF NOT EXISTS public.inventory_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    subinventario VARCHAR(100) NOT NULL,
    localizador VARCHAR(100) NOT NULL,
    stock_actual BIGINT NOT NULL DEFAULT 0,
    total_escaneos INTEGER NOT NULL DEFAULT 0,
    ultimo_movimiento VARCHAR(50),
    ultimo_escaneo_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sku_subinv_loc UNIQUE (sku, subinventario, localizador)
);

CREATE INDEX IF NOT EXISTS idx_stock_sku ON public.inventory_stock (sku);
CREATE INDEX IF NOT EXISTS idx_stock_loc ON public.inventory_stock (localizador);

-- 4. Función y Trigger: Actualización Automática de Stock tras cada Escaneo
CREATE OR REPLACE FUNCTION public.fn_process_inventory_scan()
RETURNS TRIGGER AS $$
BEGIN
    -- Manejo del stock según tipo de movimiento
    IF NEW.tipo_movimiento = 'SALIDA' THEN
        INSERT INTO public.inventory_stock (
            sku, descripcion, subinventario, localizador, stock_actual, total_escaneos, ultimo_movimiento, ultimo_escaneo_at, updated_at
        )
        VALUES (
            NEW.sku, NEW.descripcion, NEW.subinventario, NEW.localizador, -NEW.cantidad, 1, NEW.tipo_movimiento, NEW.created_at, timezone('utc'::text, now())
        )
        ON CONFLICT (sku, subinventario, localizador)
        DO UPDATE SET
            stock_actual = public.inventory_stock.stock_actual - EXCLUDED.stock_actual,
            total_escaneos = public.inventory_stock.total_escaneos + 1,
            descripcion = EXCLUDED.descripcion,
            ultimo_movimiento = EXCLUDED.ultimo_movimiento,
            ultimo_escaneo_at = EXCLUDED.ultimo_escaneo_at,
            updated_at = timezone('utc'::text, now());
            
    ELSIF NEW.tipo_movimiento = 'CONTEO_CICLICO' THEN
        -- En conteo cíclico se sobreescribe el stock con el valor verificado
        INSERT INTO public.inventory_stock (
            sku, descripcion, subinventario, localizador, stock_actual, total_escaneos, ultimo_movimiento, ultimo_escaneo_at, updated_at
        )
        VALUES (
            NEW.sku, NEW.descripcion, NEW.subinventario, NEW.localizador, NEW.cantidad, 1, NEW.tipo_movimiento, NEW.created_at, timezone('utc'::text, now())
        )
        ON CONFLICT (sku, subinventario, localizador)
        DO UPDATE SET
            stock_actual = EXCLUDED.stock_actual,
            total_escaneos = public.inventory_stock.total_escaneos + 1,
            descripcion = EXCLUDED.descripcion,
            ultimo_movimiento = EXCLUDED.ultimo_movimiento,
            ultimo_escaneo_at = EXCLUDED.ultimo_escaneo_at,
            updated_at = timezone('utc'::text, now());
            
    ELSE
        -- ENTRADA, REUBICACION o AJUSTE positivo
        INSERT INTO public.inventory_stock (
            sku, descripcion, subinventario, localizador, stock_actual, total_escaneos, ultimo_movimiento, ultimo_escaneo_at, updated_at
        )
        VALUES (
            NEW.sku, NEW.descripcion, NEW.subinventario, NEW.localizador, NEW.cantidad, 1, NEW.tipo_movimiento, NEW.created_at, timezone('utc'::text, now())
        )
        ON CONFLICT (sku, subinventario, localizador)
        DO UPDATE SET
            stock_actual = public.inventory_stock.stock_actual + EXCLUDED.stock_actual,
            total_escaneos = public.inventory_stock.total_escaneos + 1,
            descripcion = EXCLUDED.descripcion,
            ultimo_movimiento = EXCLUDED.ultimo_movimiento,
            ultimo_escaneo_at = EXCLUDED.ultimo_escaneo_at,
            updated_at = timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asociar trigger
DROP TRIGGER IF EXISTS trg_after_inventory_scan ON public.inventory_scans;
CREATE TRIGGER trg_after_inventory_scan
AFTER INSERT ON public.inventory_scans
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_inventory_scan();

-- 5. Vista de Auditoría y Métricas Diarias
CREATE OR REPLACE VIEW public.vw_inventory_daily_kpis AS
SELECT
    DATE(created_at) AS fecha,
    COUNT(*) AS total_escaneos,
    SUM(cantidad) AS total_piezas_movidas,
    COUNT(DISTINCT sku) AS skus_distintos,
    COUNT(DISTINCT localizador) AS ubicaciones_impactadas,
    COUNT(DISTINCT operador) AS operadores_activos
FROM public.inventory_scans
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- 6. Configuración de Seguridad RLS (Row Level Security)
ALTER TABLE public.inventory_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para API Anónima / Handheld
CREATE POLICY "Permitir inserción de escaneos desde handheld"
ON public.inventory_scans
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir lectura de escaneos"
ON public.inventory_scans
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir lectura de stock consolidado"
ON public.inventory_stock
FOR SELECT
TO anon, authenticated
USING (true);

-- =====================================================================
-- FIN DEL SCRIPT SQL DE SUPABASE
-- =====================================================================
`;
