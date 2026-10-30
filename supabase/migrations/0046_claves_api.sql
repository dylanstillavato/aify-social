-- Aify: MCP de Aify 1/3 · claves de API por organización.
--
-- Con una clave de API, Claude (Claude Code, Claude Desktop o claude.ai) se
-- conecta al MCP de Aify (server.js, /mcp) y trabaja con los datos de la
-- organización sin abrir el navegador.
--
-- - claves_api: una fila por clave. NUNCA se guarda la clave en claro, solo su
--   sha256 (hash) y sus últimos 4 caracteres para enseñarla como "aify_…ab12".
--   creada_por es el usuario en cuyo nombre actúa la clave. revocada_en no
--   nulo = clave revocada (no se borra para conservar el historial).
--   RLS activado SIN ninguna policy y sin privilegios para anon/authenticated,
--   igual que organizaciones_claves_ia (0043): el navegador no puede leerla
--   nunca. Solo la service role de server.js la lee y la escribe.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.claves_api (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  creada_por uuid references auth.users(id) on delete set null,
  nombre text not null,
  hash text not null unique,
  ultimos4 text not null,
  creada_en timestamptz not null default now(),
  ultimo_uso_en timestamptz,
  revocada_en timestamptz
);

create index if not exists claves_api_organizacion_idx on public.claves_api (organizacion_id);

alter table public.claves_api enable row level security;

-- Fuera del alcance del navegador por partida doble (sin policies y sin
-- privilegios). La service role se salta RLS y conserva sus privilegios.
revoke all on table public.claves_api from anon, authenticated;
