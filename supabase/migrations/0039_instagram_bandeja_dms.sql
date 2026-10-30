-- Aify: bandeja de DMs de Instagram de todos los clientes + reglas también en DMs.
--
-- 1) Bandeja unificada (/instagram/bandeja). Meta manda cada DM al webhook
--    (campo "messages", ya suscrito en 0036) y el servidor lo guarda aquí;
--    "Sincronizar" trae además las conversaciones recientes desde la API.
--    - instagram_dm_conversaciones: una por cliente y contacto (IGSID).
--      leido_en < ultimo_entrante_en = conversación sin leer.
--    - instagram_dm_mensajes: cada mensaje, entrante o saliente. (cliente_id,
--      mid) es único: Meta reintenta webhooks y también manda un "eco" de lo
--      que enviamos nosotros, y así nunca se duplica.
--
-- 2) instagram_dm_reglas.disparador: la palabra clave puede venir en un
--    comentario (lo de 0036), en un DM o en cualquiera de los dos.
--    instagram_dm_envios.origen distingue de dónde vino cada envío; para los
--    DMs comment_id guarda el id del mensaje (sigue siendo único).
--
-- Mismo criterio que 0027/0036: el navegador solo LEE; las escrituras pasan
-- por server.js (service role).
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.instagram_dm_conversaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  -- Cuenta del cliente y contacto (Instagram-scoped ID de quien escribe).
  ig_user_id text not null,
  contacto_id text not null,
  contacto_username text,
  contacto_nombre text,
  contacto_foto text,
  ultimo_mensaje text,
  ultimo_mensaje_en timestamptz,
  -- Último mensaje del contacto: abre la ventana de 24 h para responder.
  ultimo_entrante_en timestamptz,
  leido_en timestamptz,
  archivada boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (cliente_id, contacto_id)
);
create index if not exists instagram_dm_conversaciones_cliente_idx
  on public.instagram_dm_conversaciones(cliente_id, ultimo_mensaje_en desc);

create table if not exists public.instagram_dm_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.instagram_dm_conversaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  mid text not null,
  direccion text not null check (direccion in ('entrante', 'saliente')),
  texto text,
  -- [{ "tipo": "image" | "video" | "audio" | "share" | ..., "url": "..." }]
  adjuntos jsonb not null default '[]'::jsonb,
  -- instagram = escrito desde la app de Instagram; aify = desde la bandeja;
  -- automatico = respuesta de una regla de palabra clave.
  origen text not null default 'instagram' check (origen in ('instagram', 'aify', 'automatico')),
  enviado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (cliente_id, mid)
);
create index if not exists instagram_dm_mensajes_conversacion_idx
  on public.instagram_dm_mensajes(conversacion_id, creado_en);

alter table public.instagram_dm_reglas add column if not exists disparador text not null default 'comentario';
alter table public.instagram_dm_reglas drop constraint if exists instagram_dm_reglas_disparador_check;
alter table public.instagram_dm_reglas add constraint instagram_dm_reglas_disparador_check
  check (disparador in ('comentario', 'dm', 'ambos'));

alter table public.instagram_dm_envios add column if not exists origen text not null default 'comentario';
alter table public.instagram_dm_envios drop constraint if exists instagram_dm_envios_origen_check;
alter table public.instagram_dm_envios add constraint instagram_dm_envios_origen_check
  check (origen in ('comentario', 'dm'));

-- ── RLS: lectura para el equipo del cliente, escritura solo del servidor ─────

alter table public.instagram_dm_conversaciones enable row level security;
alter table public.instagram_dm_mensajes enable row level security;

revoke insert, update, delete on table public.instagram_dm_conversaciones from anon, authenticated;
revoke insert, update, delete on table public.instagram_dm_mensajes from anon, authenticated;

drop policy if exists "instagram dm conversaciones select" on public.instagram_dm_conversaciones;
create policy "instagram dm conversaciones select" on public.instagram_dm_conversaciones for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_dm_conversaciones.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));

drop policy if exists "instagram dm mensajes select" on public.instagram_dm_mensajes;
create policy "instagram dm mensajes select" on public.instagram_dm_mensajes for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_dm_mensajes.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));
