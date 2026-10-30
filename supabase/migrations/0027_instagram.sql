-- Aify: Fase 8 · Seguimiento con métricas reales de Instagram.
--
-- Conexión por cliente con "Instagram API with Instagram Login" (ver
-- docs/instagram-setup.md). Tres tablas:
--
-- - instagram_conexiones: estado de la conexión (cuenta, fechas, errores).
--   La pueden LEER el dueño del cliente y los miembros de su organización;
--   solo el servidor (service role) escribe.
-- - instagram_tokens: el access token de Instagram. RLS activado SIN
--   ninguna policy y sin privilegios para anon/authenticated: el navegador no
--   puede leerla nunca. Solo la service role de server.js la usa.
-- - instagram_metricas_cache: la última lectura de métricas (jsonb), para no
--   pedirle a Meta en cada visita. Lectura igual que instagram_conexiones.
--
-- Sustituye al borrador 0017_instagram_oauth.sql de la rama antigua
-- feature/instagram-metrics, que nunca llegó a main.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.instagram_conexiones (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  ig_user_id text not null,
  ig_username text,
  tipo_cuenta text,
  conectado_por uuid references auth.users(id) on delete set null,
  conectado_en timestamptz not null default now(),
  token_expira_en timestamptz,
  estado text not null default 'activa' check (estado in ('activa', 'caducada')),
  ultimo_error text
);
create index if not exists instagram_conexiones_ig_user_idx on public.instagram_conexiones(ig_user_id);

create table if not exists public.instagram_tokens (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  access_token text not null,
  expira_en timestamptz,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.instagram_metricas_cache (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);

alter table public.instagram_conexiones enable row level security;
alter table public.instagram_tokens enable row level security;
alter table public.instagram_metricas_cache enable row level security;

-- Tokens: fuera del alcance del navegador por partida doble (sin policies y
-- sin privilegios). La service role se salta RLS y conserva sus privilegios.
revoke all on table public.instagram_tokens from anon, authenticated;

-- Conexiones y caché: solo lectura desde el navegador, mismo criterio que
-- clientes (dueño o miembro de la organización del cliente, ver 0006).
revoke insert, update, delete on table public.instagram_conexiones from anon, authenticated;
revoke insert, update, delete on table public.instagram_metricas_cache from anon, authenticated;

drop policy if exists "instagram conexiones select" on public.instagram_conexiones;
create policy "instagram conexiones select" on public.instagram_conexiones for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_conexiones.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));

drop policy if exists "instagram metricas select" on public.instagram_metricas_cache;
create policy "instagram metricas select" on public.instagram_metricas_cache for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_metricas_cache.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));
