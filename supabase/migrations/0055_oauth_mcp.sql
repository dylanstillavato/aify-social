-- Aify: OAuth del MCP de Aify (mcp/oauth.js, docs/mcp.md).
--
-- Con OAuth, claude.ai, Claude Desktop y ChatGPT añaden el conector de Aify
-- con solo la URL de /mcp: el usuario inicia sesión en Aify y pulsa
-- «Permitir». Las claves aify_ (0046) siguen funcionando igual.
--
-- - oauth_mcp_clientes: las apps que se registran solas (registro dinámico,
--   RFC 7591). Todas son públicas: sin client_secret, con PKCE obligatorio.
-- - oauth_mcp_autorizaciones: cada solicitud de la pantalla «Permitir»
--   (caduca a los 10 minutos) y, al permitir, su código de un solo uso.
--   Del código solo se guarda el sha256 (codigo_hash).
-- - oauth_mcp_tokens: una fila por app conectada, ligada a la organización y
--   al usuario que la autorizó. Token de acceso (1 h) y de refresco (60 días,
--   se rota en cada uso), guardados solo como sha256. revocado_en no nulo =
--   app desconectada desde Configuración → Tu IA → Apps conectadas.
--
-- Solo las usa el servidor (service role): RLS activada sin policies y sin
-- privilegios para el navegador, igual que claves_api (0046).
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.oauth_mcp_clientes (
  client_id text primary key,
  nombre text,
  redirect_uris text[] not null,
  metadatos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create table if not exists public.oauth_mcp_autorizaciones (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.oauth_mcp_clientes(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scopes text[] not null default '{}',
  state text,
  resource text,
  codigo_hash text unique,
  user_id uuid references auth.users(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  creada_en timestamptz not null default now(),
  caduca_en timestamptz not null,
  aprobada_en timestamptz,
  usada_en timestamptz
);

create table if not exists public.oauth_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.oauth_mcp_clientes(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  scopes text[] not null default '{}',
  resource text,
  access_hash text not null unique,
  access_caduca_en timestamptz not null,
  refresh_hash text unique,
  refresh_caduca_en timestamptz,
  creado_en timestamptz not null default now(),
  ultimo_uso_en timestamptz,
  revocado_en timestamptz
);

create index if not exists oauth_mcp_autorizaciones_caduca_idx on public.oauth_mcp_autorizaciones (caduca_en);
create index if not exists oauth_mcp_tokens_organizacion_idx on public.oauth_mcp_tokens (organizacion_id);

alter table public.oauth_mcp_clientes enable row level security;
alter table public.oauth_mcp_autorizaciones enable row level security;
alter table public.oauth_mcp_tokens enable row level security;

-- Fuera del alcance del navegador (sin policies y sin privilegios). La
-- service role se salta RLS y conserva sus privilegios.
revoke all on table public.oauth_mcp_clientes from anon, authenticated;
revoke all on table public.oauth_mcp_autorizaciones from anon, authenticated;
revoke all on table public.oauth_mcp_tokens from anon, authenticated;
