-- Aify: token de suscripción de calendario por cliente — permite generar un
-- enlace .ics/webcal que cualquier app de calendario (Calendario de iPhone,
-- Google Calendar, Outlook...) puede suscribir de forma read-only, sin login.
-- La seguridad viene de que la URL lleva este token largo e inadivinable
-- (mismo modelo que usan Google Calendar/Notion/Trello para "enlaces de
-- calendario secretos"). Se puede regenerar desde la app si se filtra.

alter table public.clientes add column if not exists feed_token uuid not null default gen_random_uuid();
create unique index if not exists clientes_feed_token_idx on public.clientes(feed_token);

-- Devuelve nombre del cliente + sus posts dado el token del feed. security
-- definer a propósito: la propia app de Calendario del dispositivo pide esta
-- URL sin sesión, así que tiene que poder saltarse RLS — pero SOLO expone lo
-- que esta función decide devolver (nombre + posts de ESE cliente, nada
-- más). Mismo patrón que mi_organizacion_id()/aceptar_invitacion_organizacion
-- en 0006_organizaciones.sql. left join para que un cliente sin posts
-- todavía devuelva igualmente su nombre (la suscripción debe poder crearse
-- vacía, antes de que haya ningún post).
create or replace function public.get_calendar_feed(p_token uuid)
returns table (cliente_nombre text, post_id uuid, titulo text, concepto text, notas text, fecha date, hora time)
language sql security definer set search_path = public
as $$
  select c.nombre, p.id, p.titulo, p.concepto, p.notas, p.fecha, p.hora
  from public.clientes c
  left join public.calendario_posts p on p.cliente_id = c.id
  where c.feed_token = p_token
  order by p.fecha asc nulls last, p.hora asc nulls last;
$$;

revoke all on function public.get_calendar_feed(uuid) from public;
grant execute on function public.get_calendar_feed(uuid) to anon, authenticated;
