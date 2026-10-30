-- Adds phased-task support to public.tareas: an idea now creates a single row
-- with an internal `fases` (phases) array instead of 3 separate rows. Additive
-- only — existing rows simply have fases = null and keep behaving as before.
alter table public.tareas add column if not exists fases jsonb;
alter table public.tareas add column if not exists en_progreso boolean not null default false;
