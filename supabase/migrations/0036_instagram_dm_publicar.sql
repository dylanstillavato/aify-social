-- Aify: Instagram, segunda parte. Dos funciones sobre la conexión de 0027:
--
-- 1) DMs automáticos por palabra clave ("Comenta GUIA y te lo mando por DM").
--    Meta avisa de cada comentario por webhook (/api/instagram/webhook) y el
--    servidor responde con una "respuesta privada" al comentario.
--    - instagram_dm_reglas: palabra clave → mensaje, para todas las
--      publicaciones del cliente o para un reel concreto (media_id).
--    - instagram_dm_envios: registro de cada comentario que coincidió con una
--      regla. comment_id es único: Meta reintenta los webhooks y así nunca se
--      manda el mismo DM dos veces.
--
-- 2) Publicar desde el calendario (posts, carruseles, reels e historias).
--    - instagram_publicaciones: una por post del calendario, con los archivos
--      (rutas del bucket "publicaciones"), la hora y el estado. El proceso
--      periódico de server.js la va moviendo:
--      programado → procesando → publicado (o error / cancelado).
--    - Bucket privado "publicaciones": el navegador sube los archivos a
--      <organizacion>/<cliente>/...; el servidor genera URLs firmadas para
--      que Meta los descargue (Meta no admite subidas directas).
--
-- Además, instagram_conexiones.permisos guarda los permisos que concedió la
-- cuenta, para saber si hay que reconectar para activar DMs o publicar.
--
-- Mismo criterio que 0027: el navegador solo LEE (dueño del cliente o
-- miembro de su organización); todas las escrituras pasan por server.js
-- (service role), que es quien comprueba el plan.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

alter table public.instagram_conexiones add column if not exists permisos text[];

-- ── 1) DMs por palabra clave ──────────────────────────────────────────────────

create table if not exists public.instagram_dm_reglas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  palabra_clave text not null,
  mensaje text not null,
  -- Respuesta pública opcional al comentario ("¡Te lo mando por DM!").
  respuesta_publica text,
  -- null = cualquier publicación del cliente; si no, solo ese reel/post.
  media_id text,
  media_permalink text,
  media_miniatura text,
  media_texto text,
  activa boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists instagram_dm_reglas_cliente_idx on public.instagram_dm_reglas(cliente_id);

create table if not exists public.instagram_dm_envios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  regla_id uuid references public.instagram_dm_reglas(id) on delete set null,
  comment_id text not null unique,
  media_id text,
  ig_from_id text,
  ig_from_username text,
  texto_comentario text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'omitido', 'error')),
  error text,
  creado_en timestamptz not null default now()
);
create index if not exists instagram_dm_envios_cliente_idx on public.instagram_dm_envios(cliente_id, creado_en desc);
create index if not exists instagram_dm_envios_regla_from_idx on public.instagram_dm_envios(regla_id, ig_from_id);

-- ── 2) Publicar desde el calendario ──────────────────────────────────────────

create table if not exists public.instagram_publicaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  post_id uuid not null unique references public.calendario_posts(id) on delete cascade,
  tipo text not null check (tipo in ('post', 'carrusel', 'reel', 'historia')),
  -- [{ "ruta": "<org>/<cliente>/<archivo>", "tipo": "imagen" | "video" }]
  archivos jsonb not null default '[]'::jsonb,
  portada_ruta text,
  caption text,
  compartir_en_feed boolean not null default true,
  publicar_en timestamptz not null,
  estado text not null default 'programado'
    check (estado in ('programado', 'procesando', 'publicado', 'error', 'cancelado')),
  -- Contenedores de Meta mientras se procesa: { "hijos": [...], "contenedor": "..." }
  contenedores jsonb,
  procesando_desde timestamptz,
  ig_media_id text,
  permalink text,
  publicado_en timestamptz,
  error text,
  intentos integer not null default 0,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists instagram_publicaciones_pendientes_idx
  on public.instagram_publicaciones(estado, publicar_en);
create index if not exists instagram_publicaciones_cliente_idx on public.instagram_publicaciones(cliente_id);

-- ── RLS: lectura para el equipo del cliente, escritura solo del servidor ─────

alter table public.instagram_dm_reglas enable row level security;
alter table public.instagram_dm_envios enable row level security;
alter table public.instagram_publicaciones enable row level security;

revoke insert, update, delete on table public.instagram_dm_reglas from anon, authenticated;
revoke insert, update, delete on table public.instagram_dm_envios from anon, authenticated;
revoke insert, update, delete on table public.instagram_publicaciones from anon, authenticated;

drop policy if exists "instagram dm reglas select" on public.instagram_dm_reglas;
create policy "instagram dm reglas select" on public.instagram_dm_reglas for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_dm_reglas.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));

drop policy if exists "instagram dm envios select" on public.instagram_dm_envios;
create policy "instagram dm envios select" on public.instagram_dm_envios for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_dm_envios.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));

drop policy if exists "instagram publicaciones select" on public.instagram_publicaciones;
create policy "instagram publicaciones select" on public.instagram_publicaciones for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_publicaciones.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));

-- ── Bucket privado para los archivos a publicar ──────────────────────────────
-- Mismo esquema que "moodboards" (0025): el primer segmento de la ruta es la
-- organización. Solo JPEG (Meta no admite otro formato de imagen; el navegador
-- convierte antes de subir) y vídeo MP4/MOV. El tamaño máximo lo pone el plan
-- de Supabase (50 MB en el gratuito): para reels largos hay que subirlo en
-- Storage → Settings y aquí.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicaciones', 'publicaciones', false, null, array['image/jpeg', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "publicaciones select org" on storage.objects;
create policy "publicaciones select org" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'publicaciones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

drop policy if exists "publicaciones insert org" on storage.objects;
create policy "publicaciones insert org" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'publicaciones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

drop policy if exists "publicaciones delete org" on storage.objects;
create policy "publicaciones delete org" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'publicaciones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );
