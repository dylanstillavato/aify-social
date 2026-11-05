-- Aify: licencia de AifyOS (mcp/aifyos.js, 44 €/mes con Stripe).
--
-- AifyOS es una app web aparte que entra con la cuenta de Aify (OAuth del MCP) y
-- pregunta aquí si la organización de esa cuenta tiene acceso. Mismas reglas que
-- el muro de pago de 0013 y 0017: estados vivos de Stripe (trialing, active,
-- past_due) y acceso de cortesía que solo se activa a mano.
--
-- - aifyos_licencias: una fila por organización con su suscripción de AifyOS.
--   Solo la escribe el servidor (webhook de Stripe) o el SQL Editor.
--
-- Solo la usa el servidor (service role): RLS activada sin policies y sin
-- privilegios para el navegador, igual que claves_api (0046). Por eso es una tabla
-- aparte y no columnas de organizaciones, que los miembros pueden leer.
--
-- Dar o quitar acceso a mano, desde el SQL Editor:
--   select public.aifyos_conceder_acceso('correo@ejemplo.com', 'motivo');
--   select public.aifyos_retirar_acceso('correo@ejemplo.com');
-- El correo es el de un miembro de la organización. Retirar solo quita el acceso
-- manual: una suscripción de Stripe viva sigue valiendo.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.aifyos_licencias (
  organizacion_id uuid primary key references public.organizaciones(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  acceso_cortesia boolean not null default false,
  nota text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists aifyos_licencias_customer_idx
  on public.aifyos_licencias(stripe_customer_id) where stripe_customer_id is not null;

alter table public.aifyos_licencias enable row level security;
revoke all on public.aifyos_licencias from anon, authenticated;

create or replace function public.aifyos_conceder_acceso(correo text, motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select m.organizacion_id into org
  from public.organizacion_miembros m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = lower(trim(correo))
  limit 1;
  if org is null then
    raise exception 'No hay ninguna organización con un miembro con el correo %', correo;
  end if;

  insert into public.aifyos_licencias (organizacion_id, acceso_cortesia, nota)
  values (org, true, motivo)
  on conflict (organizacion_id) do update
    set acceso_cortesia = true,
        nota = coalesce(excluded.nota, public.aifyos_licencias.nota),
        actualizado_en = now();
  return org;
end;
$$;

create or replace function public.aifyos_retirar_acceso(correo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select m.organizacion_id into org
  from public.organizacion_miembros m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = lower(trim(correo))
  limit 1;
  if org is null then
    raise exception 'No hay ninguna organización con un miembro con el correo %', correo;
  end if;

  update public.aifyos_licencias
    set acceso_cortesia = false, actualizado_en = now()
    where organizacion_id = org;
  return org;
end;
$$;

-- Las funciones nuevas se pueden ejecutar por defecto desde el navegador: se cierra.
revoke all on function public.aifyos_conceder_acceso(text, text) from public, anon, authenticated;
revoke all on function public.aifyos_retirar_acceso(text) from public, anon, authenticated;
