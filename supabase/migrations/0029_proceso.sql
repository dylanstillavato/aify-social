-- Aify: proceso del mes editable — renombrar, quitar o añadir pasos.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - organizaciones.proceso: lista ordenada de pasos del "Proceso de <mes>" de
--   la ficha de cliente, o null (los seis de siempre):
--     [{ "id": "investigacion", "label": "Investigación", "oculto": false },
--      { "id": "p_1727712000000", "label": "Reunión mensual", "personalizado": true }, ...]
--   Los pasos de siempre se identifican por id (investigacion, ideas, guiones,
--   grabacion, edicion, seguimiento); los personalizados son una casilla de
--   "hecho" y una nota por mes, guardadas en investigaciones.datos.pasos
--   (0025_investigacion.sql), sin tablas nuevas.
--   Lo edita el owner en Configuración; el equipo lo ve.
--
-- Sin esta migración la app guarda el proceso solo en el navegador (ver
-- src/hooks/useAjusteOrganizacion.js).
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.

alter table public.organizaciones
  add column if not exists proceso jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizaciones_proceso_check'
      and conrelid = 'public.organizaciones'::regclass
  ) then
    alter table public.organizaciones
      add constraint organizaciones_proceso_check
      check (proceso is null or jsonb_typeof(proceso) = 'array');
  end if;
end $$;

-- Mismo motivo que 0026/0028: UPDATE de organizaciones va por columnas desde
-- 0017. La fila sigue limitada al owner por la política de 0006.
grant update (proceso) on public.organizaciones to authenticated;

select count(*) filter (where proceso is not null) as orgs_con_proceso_propio
from public.organizaciones;
