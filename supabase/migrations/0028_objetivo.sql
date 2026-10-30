-- Aify: objetivo del mes en el Inicio — la barra de la tarjeta de saludo.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - organizaciones.objetivo: { "tipo": "facturacion" | "clientes", "valor": n }
--   o null (sin objetivo). facturacion = euros cobrados en el mes en curso;
--   clientes = clientes activos (sin archivar). Lo fija el owner desde el
--   Inicio; el resto del equipo lo ve.
--
-- Sin esta migración la app guarda el objetivo solo en el navegador (ver
-- src/hooks/useAjusteOrganizacion.js).
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.

alter table public.organizaciones
  add column if not exists objetivo jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizaciones_objetivo_check'
      and conrelid = 'public.organizaciones'::regclass
  ) then
    alter table public.organizaciones
      add constraint organizaciones_objetivo_check
      check (
        objetivo is null or (
          objetivo->>'tipo' in ('facturacion', 'clientes')
          and jsonb_typeof(objetivo->'valor') = 'number'
          and (objetivo->>'valor')::numeric > 0
        )
      );
  end if;
end $$;

-- Mismo motivo que 0026: 0017 dejó UPDATE de organizaciones solo por
-- columnas, así que hay que conceder esta. La fila sigue limitada por la
-- política "org owner can update org" de 0006 (solo el owner).
grant update (objetivo) on public.organizaciones to authenticated;

select count(*) filter (where objetivo is not null) as orgs_con_objetivo
from public.organizaciones;
