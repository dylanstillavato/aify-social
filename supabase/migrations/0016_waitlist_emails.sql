-- Aify: captura de leads (waitlist) para las páginas públicas de SEO
-- (/agencias, /checklist, /calculadora) — no existía ningún mecanismo de
-- captura de email antes de esto; lo único parecido era INVITE_CODE en
-- server.js, que valida un código ya conocido, no captura nada nuevo.
--
-- La beta de Aify es invite-code + founder badge, no self-serve, así que
-- estas páginas no pueden mandar a "crea tu cuenta ya" — capturan el email
-- como lead cualificado para invitar manualmente/por lotes después. El
-- insert se hace directo desde el cliente de Supabase ya existente
-- (src/services/supabase.js), sin backend nuevo en server.js: RLS de
-- solo-insert-anónimo es suficiente y no añade otro endpoint que mantener
-- para un founder solo.

create table if not exists public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  origen text not null check (origen in ('agencias', 'checklist', 'calculadora')),
  created_at timestamptz not null default now()
);
create index if not exists waitlist_emails_created_idx on public.waitlist_emails(created_at desc);

alter table public.waitlist_emails enable row level security;

-- Solo INSERT, para anon y authenticated (visitante puede o no tener sesión
-- de otra pestaña) — nada de SELECT/UPDATE/DELETE desde el cliente: sin esas
-- políticas, Postgres deniega por defecto para RLS habilitado. Leer la lista
-- de leads se hace desde el dashboard de Supabase (rol postgres/
-- service_role, que no pasa por RLS), no desde la app.
drop policy if exists "anyone can join waitlist" on public.waitlist_emails;
create policy "anyone can join waitlist" on public.waitlist_emails for insert
  to anon, authenticated
  with check (
    email is not null and length(trim(email)) > 3 and position('@' in email) > 1
  );
