-- Aify: pizarras para «Mira mi pizarra» de Aify Pictures (docs/mcp.md).
--
-- Aify Pictures Studio sube la pizarra de un proyecto (notas, referencias,
-- flechas, notas de voz, kit de marca) y la IA del usuario la lee y escribe
-- en ella con el MCP de Aify (guardar_pizarra, listar_pizarras, ver_pizarra,
-- anadir_a_pizarra) o con /api/pizarras.
--
-- - pizarras: una fila por pizarra, siempre de un cliente de la organización.
--   contenido es el JSON de Pictures ({ nodos, flechas, apuntes }), como
--   mucho 1 MB (lo comprueba server.js). Los archivos de los nodos viven en
--   el bucket "publicaciones" bajo <organización>/<cliente>/pizarras/.
--   Solo la usa el servidor (service role): RLS activada sin policies y sin
--   privilegios para el navegador, igual que tiktok_tokens.
-- - Bucket "publicaciones": además de JPEG, MP4 y MOV (0036), admite PNG,
--   WebP y audio (WebM, MP3 y M4A) para las imágenes y notas de voz de las
--   pizarras. Solo si el bucket tiene la lista de tipos limitada.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.pizarras (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  titulo text not null,
  contenido jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create index if not exists pizarras_cliente_actualizada_idx on public.pizarras (cliente_id, actualizada_en desc);
create index if not exists pizarras_organizacion_idx on public.pizarras (organizacion_id);

alter table public.pizarras enable row level security;

-- Fuera del alcance del navegador (sin policies y sin privilegios). La
-- service role se salta RLS y conserva sus privilegios.
revoke all on table public.pizarras from anon, authenticated;

-- Tipos de archivo de las pizarras en el bucket "publicaciones" (sin quitar
-- ninguno de los que ya hay).
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct tipo order by tipo)
  from unnest(
    allowed_mime_types || array['image/png', 'image/webp', 'audio/webm', 'audio/mpeg', 'audio/mp4']
  ) as tipo
)
where id = 'publicaciones'
  and allowed_mime_types is not null;
