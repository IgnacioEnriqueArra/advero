
-- CORRECCIÓN DEFINITIVA DE TABLA TRANSACCIONES Y PERMISOS
-- Copia y pega todo este contenido en el Editor SQL de Supabase y ejecútalo.

-- 1. AGREGAR COLUMNAS FALTANTES
-- Es posible que falten columnas clave si la tabla se creó con una versión anterior.
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS screen_id UUID REFERENCES screens(id),
  ADD COLUMN IF NOT EXISTS media_upload_id UUID REFERENCES media_uploads(id),
  ADD COLUMN IF NOT EXISTS owner_commission DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- 2. CORREGIR CONSTRAINT DE ESTADO
-- Aseguramos que el estado 'succeeded' sea válido (usado por el código actual)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check 
  CHECK (status IN ('pending', 'succeeded', 'failed', 'completed')); 
  -- Agregamos 'completed' por compatibilidad hacia atrás, aunque usamos 'succeeded'

-- 3. HABILITAR RLS (Seguridad)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. LIMPIAR POLÍTICAS ANTIGUAS (Para evitar duplicados o conflictos)
DROP POLICY IF EXISTS "Enable insert for public" ON transactions;
DROP POLICY IF EXISTS "Public can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Enable read for owners" ON transactions;
DROP POLICY IF EXISTS "Owners can view their transactions" ON transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transactions;

-- 5. PERMITIR INSERCIÓN PÚBLICA (CRÍTICO PARA PAGOS)
-- Permite que cualquier usuario (incluso sin login) registre un pago
CREATE POLICY "Enable insert for public"
ON transactions FOR INSERT
TO public
WITH CHECK (true);

-- 6. PERMITIR LECTURA A DUEÑOS
-- Permite que los dueños vean los ingresos de sus pantallas
CREATE POLICY "Enable read for owners"
ON transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM screens s
    WHERE s.id = transactions.screen_id
    AND s.owner_id = auth.uid()
  )
);
-- Nota: Usamos transactions.screen_id directamente que es más eficiente que join con media_uploads

-- 7. REFRESCAR CACHÉ DE SCHEMA (Opcional pero recomendado)
NOTIFY pgrst, 'reload config';
