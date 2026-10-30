-- Aify: tareas archivadas — la lista de tareas se llenaba de completadas y de
-- vencidas que ya no importan. Ahora:
-- - las completadas se archivan solas a las 24 h de completarse,
-- - las vencidas se archivan con un botón ("Archivar vencidas"),
-- - las archivadas se borran a los 7 días de archivarse.
-- El archivado y el borrado los hace la app al cargar las tareas (no hay
-- tarea programada en la base de datos), con las políticas RLS de siempre.
--
-- Idempotente y aditivo: una columna nullable y un índice parcial.

alter table public.tareas add column if not exists archivada_en timestamptz;

create index if not exists tareas_archivada_idx on public.tareas(archivada_en)
  where archivada_en is not null;
