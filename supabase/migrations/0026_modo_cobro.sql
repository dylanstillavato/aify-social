-- Aify: modo de cobro — por adelantado o al entregar.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - organizaciones.modo_cobro: cómo cobra la agencia por defecto a sus
--   clientes. 'adelantado' = la factura del mes sale al empezar el mes;
--   'al_entregar' = la factura sale al publicar/entregar el contenido.
--   Se elige en Configuración y en el onboarding del usuario.
-- - clientes.modo_cobro: excepción por cliente. null = usa el de la
--   organización (valor por defecto de todas las filas existentes).
--
-- Lo usa "Generar facturas de <mes>" en /dinero: los clientes por adelantado
-- salen marcados; los de al entregar salen desmarcados para que el gestor
-- decida (ver src/utils/modoCobro.js).
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.

alter table public.organizaciones
  add column if not exists modo_cobro text not null default 'al_entregar';

alter table public.clientes
  add column if not exists modo_cobro text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizaciones_modo_cobro_check'
      and conrelid = 'public.organizaciones'::regclass
  ) then
    alter table public.organizaciones
      add constraint organizaciones_modo_cobro_check
      check (modo_cobro in ('adelantado', 'al_entregar'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_modo_cobro_check'
      and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_modo_cobro_check
      check (modo_cobro is null or modo_cobro in ('adelantado', 'al_entregar'));
  end if;
end $$;

-- Permisos: 0017_acceso_cortesia.sql quitó el UPDATE de tabla sobre
-- organizaciones a anon/authenticated y solo devolvió UPDATE sobre la columna
-- "nombre" (para que nadie pudiera tocar plan, subscription_status,
-- acceso_cortesia o uso_ia_mes desde el navegador). Un privilegio de columna
-- nuevo no se hereda, así que sin este grant el owner recibiría "permission
-- denied" al guardar el modo de cobro desde Configuración. Se concede SOLO
-- modo_cobro (no afecta al muro de pago ni a los límites) y la fila sigue
-- limitada por la política RLS "org owner can update org" de 0006: solo el
-- owner de su propia organización. Repetir un grant es inocuo.
grant update (modo_cobro) on public.organizaciones to authenticated;

-- clientes.modo_cobro no necesita nada: las políticas de update de clientes
-- (propias y "org members can update clientes" de 0006) son por fila y no
-- hay restricción por columna en esa tabla.

select
  (select count(*) from public.organizaciones where modo_cobro = 'adelantado') as orgs_adelantado,
  (select count(*) from public.organizaciones where modo_cobro = 'al_entregar') as orgs_al_entregar,
  (select count(*) from public.clientes where modo_cobro is not null) as clientes_con_excepcion;
