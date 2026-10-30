-- Aify: sección Dinero — presupuestos, facturas e ingresos en un solo sitio.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - clientes.cuota_mensual: lo que se le cobra cada mes a ese cliente. Suma de
--   las cuotas de clientes no archivados = ingreso mensual recurrente, y base
--   del botón "Generar facturas del mes".
-- - facturas.presupuesto_id: presupuesto firmado del que sale la factura
--   ("Convertir en factura"). Si se borra el presupuesto, la factura se queda.
-- - facturas.periodo: 'YYYY-MM' del mes que cubre una factura de cuota
--   mensual. El índice único parcial impide facturar dos veces el mismo mes al
--   mismo cliente (las facturas sueltas llevan periodo null y no cuentan).
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.
-- Aditivo: no toca ninguna política RLS; las columnas nuevas son nullable, así
-- que las filas existentes y la app actual siguen funcionando igual.

alter table public.clientes add column if not exists cuota_mensual numeric(10,2);

alter table public.facturas add column if not exists presupuesto_id uuid
  references public.presupuestos(id) on delete set null;

alter table public.facturas add column if not exists periodo text
  check (periodo is null or periodo ~ '^\d{4}-(0[1-9]|1[0-2])$');

create index if not exists facturas_presupuesto_idx on public.facturas(presupuesto_id)
  where presupuesto_id is not null;

create unique index if not exists facturas_cliente_periodo_uniq on public.facturas(cliente_id, periodo)
  where periodo is not null;
