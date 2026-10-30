-- Aify: lista de espera de Aify Pictures (landing en https://pictures.useaify.app).
--
-- La landing es una web estática sin servidor: su formulario hace
-- POST /api/pictures/lista-espera y el correo se guarda aquí.
--
-- - email: en minúsculas (lo normaliza el servidor) y único, para que
--   apuntarse dos veces no duplique la fila.
-- - instagram: la cuenta que deja, si la deja.
-- - origen: utm o referrer de la landing.
-- - creada_en: la posición en la lista es el nº de filas con creada_en menor
--   o igual.
--
-- Solo la usa el servidor (service role): RLS activada, sin policies ni
-- privilegios para el navegador, igual que tiktok_tokens.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.lista_espera_pictures (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  instagram text,
  origen text,
  creada_en timestamptz not null default now()
);
create index if not exists lista_espera_pictures_creada_en_idx
  on public.lista_espera_pictures(creada_en);

-- ── RLS: solo el servidor ─────────────────────────────────────────────────────

alter table public.lista_espera_pictures enable row level security;

revoke all on table public.lista_espera_pictures from anon, authenticated;
