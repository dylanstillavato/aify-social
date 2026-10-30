-- Aify: programar reels como Trial Reel (Instagram los enseña primero solo a
-- gente que no sigue la cuenta).
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - instagram_publicaciones.es_trial: el reel se publica como Trial Reel
--   (server.js añade trial_params al contenedor de Meta).
-- - instagram_publicaciones.trial_graduacion: cuándo pasa a los seguidores.
--   MANUAL = lo decide la cuenta desde Instagram; SS_PERFORMANCE = Instagram
--   lo comparte solo si funciona bien con no seguidores.
--
-- Sin esta migración se puede seguir programando todo como siempre; solo
-- falla programar un reel con la casilla de Trial marcada.
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.

alter table public.instagram_publicaciones
  add column if not exists es_trial boolean not null default false;

alter table public.instagram_publicaciones
  add column if not exists trial_graduacion text not null default 'MANUAL';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'instagram_publicaciones_trial_graduacion_check'
  ) then
    alter table public.instagram_publicaciones
      add constraint instagram_publicaciones_trial_graduacion_check
      check (trial_graduacion in ('MANUAL', 'SS_PERFORMANCE'));
  end if;
end $$;
