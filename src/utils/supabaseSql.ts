/**
 * Complete Supabase (PostgreSQL) Schema Script for Zebra TC26 Warehouse Inventory
 * Copy and paste this directly into the Supabase SQL Editor and click RUN.
 * 
 * Includes ALTER TABLE ADD COLUMN IF NOT EXISTS to guarantee compatibility
 * even if tables were already partially created.
 */

export const SUPABASE_SQL_SCRIPT = `-- =====================================================================
-- ESQUEMA COMPLETO DE SINCRONIZACIÓN EN VIVO (SUPABASE / POSTGRESQL)
-- TERMINALES ZEBRA TC26 Y MONITOREO DE GERENCIA EN VIVO
-- =====================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA 1: Monitoreo en Vivo de Terminales Handheld (Control en Vivo)
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
    device_id VARCHAR(100) PRIMARY KEY,
    device_name VARCHAR(150) NOT NULL,
    operator_name VARCHAR(150),
    user_number INTEGER,
    current_round VARCHAR(50) DEFAULT '1ER_CONTEO',
    total_scans INTEGER DEFAULT 0,
    total_piezas INTEGER DEFAULT 0,
    last_sku VARCHAR(100),
    last_locator VARCHAR(100),
    last_active TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status VARCHAR(50) DEFAULT 'online',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migraciones seguras por si la tabla ya existía
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(150);
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS operator_name VARCHAR(150);
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS user_number INTEGER;
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS current_round VARCHAR(50) DEFAULT '1ER_CONTEO';
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0;
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS total_piezas INTEGER DEFAULT 0;
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS last_sku VARCHAR(100);
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS last_locator VARCHAR(100);
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'online';
ALTER TABLE public.terminal_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_terminal_user_number ON public.terminal_sessions (user_number);
CREATE INDEX IF NOT EXISTS idx_terminal_last_active ON public.terminal_sessions (last_active DESC);

-- 3. TABLA 2: Registro Centralizado de Escaneos de Inventario
CREATE TABLE IF NOT EXISTS public.inventory_scans (
    id VARCHAR(100) PRIMARY KEY,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sku VARCHAR(100) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    descripcion TEXT,
    subinventario VARCHAR(100),
    localizador VARCHAR(100),
    ronda_conteo VARCHAR(50) DEFAULT '1ER_CONTEO',
    operador VARCHAR(150),
    dispositivo VARCHAR(150),
    user_number INTEGER,
    codigo_qr_raw TEXT,
    sync_state_sharepoint VARCHAR(50) DEFAULT 'synced',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migraciones seguras por si inventory_scans ya existía con un esquema previo
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS id VARCHAR(100);
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 0;
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS subinventario VARCHAR(100);
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS localizador VARCHAR(100);
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS ronda_conteo VARCHAR(50) DEFAULT '1ER_CONTEO';
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS operador VARCHAR(150);
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS dispositivo VARCHAR(150);
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS user_number INTEGER;
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS codigo_qr_raw TEXT;
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS sync_state_sharepoint VARCHAR(50) DEFAULT 'synced';
ALTER TABLE public.inventory_scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_scans_sku ON public.inventory_scans (sku);
CREATE INDEX IF NOT EXISTS idx_scans_localizador ON public.inventory_scans (localizador);
CREATE INDEX IF NOT EXISTS idx_scans_user_number ON public.inventory_scans (user_number);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.inventory_scans (created_at DESC);

-- 4. TABLA 3: Control Central de Rondas (Sincronizado entre Gerente y Handhelds)
CREATE TABLE IF NOT EXISTS public.inventory_round_control (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_control',
    global_round VARCHAR(50) DEFAULT '1ER_CONTEO',
    user_rounds JSONB DEFAULT '{"1":"1ER_CONTEO","2":"1ER_CONTEO","3":"1ER_CONTEO","4":"1ER_CONTEO","5":"1ER_CONTEO","6":"1ER_CONTEO","7":"1ER_CONTEO","8":"1ER_CONTEO","9":"1ER_CONTEO","10":"1ER_CONTEO"}'::jsonb,
    round2_authorizations JSONB DEFAULT '{"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inventory_round_control ADD COLUMN IF NOT EXISTS id VARCHAR(50);
ALTER TABLE public.inventory_round_control ADD COLUMN IF NOT EXISTS global_round VARCHAR(50) DEFAULT '1ER_CONTEO';
ALTER TABLE public.inventory_round_control ADD COLUMN IF NOT EXISTS user_rounds JSONB;
ALTER TABLE public.inventory_round_control ADD COLUMN IF NOT EXISTS round2_authorizations JSONB;
ALTER TABLE public.inventory_round_control ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Insertar fila inicial si no existe
INSERT INTO public.inventory_round_control (id, global_round)
VALUES ('global_control', '1ER_CONTEO')
ON CONFLICT (id) DO NOTHING;

-- 5. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_round_control ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Acceso RLS Públicas (Lectura, Inserción y Actualización con anon key)
DROP POLICY IF EXISTS "Permitir acceso completo terminal_sessions" ON public.terminal_sessions;
CREATE POLICY "Permitir acceso completo terminal_sessions"
ON public.terminal_sessions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso completo inventory_scans" ON public.inventory_scans;
CREATE POLICY "Permitir acceso completo inventory_scans"
ON public.inventory_scans
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso completo inventory_round_control" ON public.inventory_round_control;
CREATE POLICY "Permitir acceso completo inventory_round_control"
ON public.inventory_round_control
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- =====================================================================
-- FIN DEL SCRIPT SQL. EJECUTA EN EL SQL EDITOR DE SUPABASE
-- =====================================================================
`;

/**
 * Quick SQL script specifically for enabling DELETE on inventory_scans table
 */
export const SUPABASE_DELETE_POLICY_SQL = `-- =====================================================================
-- HABILITAR ELIMINACIÓN DE ESCANEOS EN SUPABASE (USUARIO MASTER)
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase:
-- =====================================================================

ALTER TABLE public.inventory_scans ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas para evitar conflictos
DROP POLICY IF EXISTS "Permitir eliminacion inventory_scans" ON public.inventory_scans;
DROP POLICY IF EXISTS "Permitir acceso completo inventory_scans" ON public.inventory_scans;

-- Habilitar permisos de eliminación (DELETE)
CREATE POLICY "Permitir eliminacion inventory_scans"
ON public.inventory_scans
FOR DELETE
TO anon, authenticated
USING (true);

-- Habilitar permisos completos (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Permitir acceso completo inventory_scans"
ON public.inventory_scans
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
`;
