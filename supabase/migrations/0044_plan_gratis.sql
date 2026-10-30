-- Aify: plan gratuito 2/2 · plan "gratis" en organizaciones.
--
-- organizaciones.plan pasa a admitir 'gratis' (además de freelance | pro |
-- agency): 1 cliente y la IA solo con la clave propia de Gemini de la
-- organización (0043). Lo activa server.js (POST /api/plan/gratis) sin Stripe
-- y solo si la organización no tiene una suscripción viva.
--
-- Las migraciones del repo no ponen ningún CHECK sobre organizaciones.plan,
-- así que normalmente no hay nada que cambiar. Si en la base de datos hay uno
-- (añadido a mano) que no admite 'gratis', se sustituye por uno que sí.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.organizaciones'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%plan%'
      and pg_get_constraintdef(c.oid) not ilike '%gratis%'
  loop
    execute format('alter table public.organizaciones drop constraint %I', r.conname);
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.organizaciones'::regclass and conname = 'organizaciones_plan_check'
    ) then
      alter table public.organizaciones
        add constraint organizaciones_plan_check
        check (plan in ('freelance', 'pro', 'agency', 'gratis'));
    end if;
  end loop;
end $$;

comment on column public.organizaciones.plan is 'freelance | pro | agency | gratis';
