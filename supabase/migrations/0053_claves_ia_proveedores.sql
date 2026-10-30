-- Aify: Tu IA. Una clave de IA por proveedor y organización.
--
-- Aify Social ya no paga la IA: cada organización pone su clave de Claude
-- (Anthropic) o de Gemini en Configuración → Tu IA, y los botones de IA solo
-- usan esas claves (server.js, requireIaPropia y /api/ia/clave).
--
-- organizaciones_claves_ia (0043) guardaba una sola clave por organización
-- (clave primaria en organizacion_id) y solo de Gemini. Ahora:
--
-- - clave primaria (organizacion_id, proveedor): una clave de cada proveedor.
-- - proveedor in ('gemini', 'anthropic').
--
-- Las claves que ya hay (todas de Gemini) se quedan como están. Sigue igual
-- todo lo demás: la clave CIFRADA, RLS sin policies y sin privilegios para
-- anon/authenticated (solo la service role de server.js la lee y la escribe).
-- Sin esta migración el servidor sigue funcionando con una sola clave, la de
-- Gemini.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

do $$
declare
  r record;
begin
  -- Clave primaria: de (organizacion_id) a (organizacion_id, proveedor)
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.organizaciones_claves_ia'::regclass
      and c.contype = 'p'
      and pg_get_constraintdef(c.oid) <> 'PRIMARY KEY (organizacion_id, proveedor)'
  loop
    execute format('alter table public.organizaciones_claves_ia drop constraint %I', r.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizaciones_claves_ia'::regclass and contype = 'p'
  ) then
    alter table public.organizaciones_claves_ia
      add constraint organizaciones_claves_ia_pkey primary key (organizacion_id, proveedor);
  end if;

  -- Proveedores: cualquier check sobre proveedor que no admita 'anthropic' se
  -- sustituye por uno que sí.
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.organizaciones_claves_ia'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%proveedor%'
      and pg_get_constraintdef(c.oid) not ilike '%anthropic%'
  loop
    execute format('alter table public.organizaciones_claves_ia drop constraint %I', r.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizaciones_claves_ia'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%anthropic%'
  ) then
    alter table public.organizaciones_claves_ia
      add constraint organizaciones_claves_ia_proveedor_check
      check (proveedor in ('gemini', 'anthropic'));
  end if;
end $$;

comment on column public.organizaciones_claves_ia.proveedor is 'gemini | anthropic';
