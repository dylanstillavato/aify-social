-- Foto de cliente: almacenada como data-URL base64 en una columna text,
-- siguiendo la misma convención ya usada para firma_data_url en presupuestos.
-- Sin Supabase Storage.

alter table public.clientes add column if not exists foto_url text;
