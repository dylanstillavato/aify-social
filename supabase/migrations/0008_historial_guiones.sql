-- Aify: historial de versiones para guión y copy.
-- Hoy, regenerar un guión o copy (desde PanelDesarrollar.jsx, usado por Lluvia
-- de Ideas / Ideas y Guiones / la tira de ideas del Calendario, o desde el
-- flujo "Desarrollar idea" propio de TabCalendario en ClienteDetalle.jsx)
-- sobrescribe sin más el valor anterior — no hay forma de recuperar una
-- versión previa que resultó mejor.
--
-- Se captura el historial con un trigger de Postgres en vez de repetir
-- "guarda el valor viejo antes de sobrescribir" en cada uno de los varios
-- sitios del frontend que generan/guardan guión o copy: así se captura
-- automáticamente pase lo que pase (incluida cualquier futura vía de
-- guardado que se nos olvide tocar), sin depender de que cada caller se
-- acuerde de hacerlo.
--
-- Run this once in the Supabase SQL Editor (Database → SQL Editor → New
-- query). No CLI is linked to this project, so this file is the source of
-- truth to paste in manually. Idempotente: seguro volver a pegar y ejecutar
-- entero tantas veces como haga falta.

alter table public.ideas add column if not exists guion_historial jsonb not null default '[]'::jsonb;
alter table public.ideas add column if not exists copy_historial jsonb not null default '[]'::jsonb;
alter table public.calendario_posts add column if not exists guion_historial jsonb not null default '[]'::jsonb;
alter table public.calendario_posts add column if not exists copy_historial jsonb not null default '[]'::jsonb;

-- Se aplica a ambas tablas (ideas.guion es jsonb, ideas.copy es jsonb,
-- calendario_posts.guion es jsonb, calendario_posts.copy es text — la
-- función no asume el tipo de columna, jsonb_build_object() convierte
-- cualquiera de los dos con to_jsonb() implícito).
create or replace function public.guardar_historial_guion_copy()
returns trigger
language plpgsql
as $$
begin
  if OLD.guion is not null and NEW.guion is distinct from OLD.guion then
    NEW.guion_historial := OLD.guion_historial || jsonb_build_object('guion', OLD.guion, 'guardado_en', now());
  end if;
  if OLD.copy is not null and NEW.copy is distinct from OLD.copy then
    NEW.copy_historial := OLD.copy_historial || jsonb_build_object('copy', OLD.copy, 'guardado_en', now());
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_historial_ideas on public.ideas;
create trigger trg_historial_ideas before update on public.ideas for each row execute function public.guardar_historial_guion_copy();

drop trigger if exists trg_historial_calendario_posts on public.calendario_posts;
create trigger trg_historial_calendario_posts before update on public.calendario_posts for each row execute function public.guardar_historial_guion_copy();
