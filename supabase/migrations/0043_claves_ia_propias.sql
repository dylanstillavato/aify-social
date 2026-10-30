-- Aify: plan gratuito 1/2 · clave propia de la API de Gemini por organización.
--
-- Cada organización puede guardar su propia clave de Gemini (se saca gratis en
-- Google AI Studio). Si la tiene, server.js la usa para generar ideas y
-- guiones de esa organización en vez de la nuestra, y esas generaciones no
-- cuentan para el límite de IA del plan (uso_ia_mes, ver 0014).
--
-- - organizaciones_claves_ia: la clave CIFRADA (AES-256-GCM con la variable de
--   entorno AI_KEYS_SECRET del servidor: iv + tag + texto en base64) y sus
--   últimos 4 caracteres para enseñarla como "****1234". RLS activado SIN
--   ninguna policy y sin privilegios para anon/authenticated, igual que
--   instagram_tokens (0027): el navegador no puede leerla nunca. Solo la
--   service role de server.js la lee y la escribe.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.organizaciones_claves_ia (
  organizacion_id uuid primary key references public.organizaciones(id) on delete cascade,
  proveedor text not null default 'gemini' check (proveedor in ('gemini')),
  clave_cifrada text not null,
  ultimos4 text not null,
  verificada_en timestamptz,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

alter table public.organizaciones_claves_ia enable row level security;

-- Fuera del alcance del navegador por partida doble (sin policies y sin
-- privilegios). La service role se salta RLS y conserva sus privilegios.
revoke all on table public.organizaciones_claves_ia from anon, authenticated;
