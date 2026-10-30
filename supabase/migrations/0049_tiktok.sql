-- Aify: TikTok, fase 1. Conectar la cuenta del cliente (Login Kit v2) y
-- publicar desde el calendario (Content Posting API, Direct Post). Ver
-- docs/tiktok-plan.md y docs/tiktok-setup.md.
--
-- - tiktok_conexiones: estado de la conexión (cuenta, permisos concedidos,
--   fechas, errores). La pueden LEER el dueño del cliente y los miembros de
--   su organización; solo el servidor (service role) escribe.
-- - tiktok_tokens: access token (24 h) y refresh token (365 días, rota en
--   cada renovación). RLS sin policies y sin privilegios para
--   anon/authenticated: el navegador no puede leerla nunca.
-- - tiktok_publicaciones: una por post del calendario, calcada de
--   instagram_publicaciones (0036) con las opciones que TikTok obliga a
--   elegir en el formulario (privacidad, interacciones, contenido comercial,
--   consentimiento). El proceso periódico de server.js la va moviendo:
--   programado → procesando → publicado (o error / cancelado).
--
-- Los archivos van al mismo bucket privado "publicaciones" de 0036 (ya admite
-- JPEG, MP4 y MOV); TikTok los descarga de /api/tiktok/medios/<token>.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.tiktok_conexiones (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  open_id text not null,
  username text,
  nombre text,
  avatar_url text,
  -- Permisos concedidos (el usuario puede desmarcar alguno al autorizar).
  permisos text[] not null default '{}',
  conectado_por uuid references auth.users(id) on delete set null,
  conectado_en timestamptz not null default now(),
  token_expira_en timestamptz,
  estado text not null default 'activa' check (estado in ('activa', 'caducada')),
  ultimo_error text
);
create index if not exists tiktok_conexiones_open_id_idx on public.tiktok_conexiones(open_id);

create table if not exists public.tiktok_tokens (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expira_en timestamptz,
  refresh_expira_en timestamptz,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.tiktok_publicaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  post_id uuid not null unique references public.calendario_posts(id) on delete cascade,
  tipo text not null check (tipo in ('video', 'fotos')),
  -- [{ "ruta": "<org>/<cliente>/<archivo>", "tipo": "imagen" | "video", "nombre"?, "bytes"? }]
  archivos jsonb not null default '[]'::jsonb,
  -- Vídeo: el texto (hasta 2.200). Fotos: título (hasta 90) + descripción (hasta 4.000).
  titulo text,
  descripcion text,
  privacidad text not null
    check (privacidad in ('PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY')),
  permitir_comentarios boolean not null default false,
  permitir_duo boolean not null default false,
  permitir_stitch boolean not null default false,
  -- Contenido comercial: marca propia («Contenido promocional») y/o contenido
  -- de marca de un tercero («Colaboración pagada»).
  contenido_comercial boolean not null default false,
  marca_propia boolean not null default false,
  contenido_de_marca boolean not null default false,
  es_ia boolean not null default false,
  musica_auto boolean not null default false,
  -- Portada: milisegundo del vídeo o índice de la foto.
  portada_ms integer,
  portada_indice integer,
  -- Cuándo aceptó el usuario la Music Usage Confirmation (y la Branded
  -- Content Policy si aplica) al programar.
  consentimiento_en timestamptz,
  publicar_en timestamptz not null,
  estado text not null default 'programado'
    check (estado in ('programado', 'procesando', 'publicado', 'error', 'cancelado')),
  -- Último estado que dio TikTok (PROCESSING_DOWNLOAD, PUBLISH_COMPLETE…).
  estado_tiktok text,
  publish_id text,
  procesando_desde timestamptz,
  tiktok_post_id text,
  enlace text,
  publicado_en timestamptz,
  error text,
  intentos integer not null default 0,
  archivos_borrados boolean not null default false,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists tiktok_publicaciones_pendientes_idx
  on public.tiktok_publicaciones(estado, publicar_en);
create index if not exists tiktok_publicaciones_cliente_idx on public.tiktok_publicaciones(cliente_id);
-- El webhook busca por publish_id.
create index if not exists tiktok_publicaciones_publish_id_idx on public.tiktok_publicaciones(publish_id);

-- ── RLS: lectura para el equipo del cliente, escritura solo del servidor ─────

alter table public.tiktok_conexiones enable row level security;
alter table public.tiktok_tokens enable row level security;
alter table public.tiktok_publicaciones enable row level security;

-- Tokens: fuera del alcance del navegador por partida doble (sin policies y
-- sin privilegios). La service role se salta RLS y conserva sus privilegios.
revoke all on table public.tiktok_tokens from anon, authenticated;

revoke insert, update, delete on table public.tiktok_conexiones from anon, authenticated;
revoke insert, update, delete on table public.tiktok_publicaciones from anon, authenticated;

drop policy if exists "tiktok conexiones select" on public.tiktok_conexiones;
create policy "tiktok conexiones select" on public.tiktok_conexiones for select
  using (exists (
    select 1 from public.clientes c
    where c.id = tiktok_conexiones.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));

drop policy if exists "tiktok publicaciones select" on public.tiktok_publicaciones;
create policy "tiktok publicaciones select" on public.tiktok_publicaciones for select
  using (exists (
    select 1 from public.clientes c
    where c.id = tiktok_publicaciones.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));
