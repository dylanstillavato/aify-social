-- Aify: día de edición propio en cada tarea de producción.
-- Hasta ahora las tarjetas que crea "Producción" (PlanProduccion.jsx) solo
-- guardaban el día de grabación (fecha_limite); el de edición iba escrito
-- dentro del subtítulo ("Grabar mar, 6 oct · Editar jue, 8 oct · ...") y no
-- se podía cambiar. Con esta columna el panel "Editar tarea" deja cambiar
-- grabación, edición y publicación, y el subtítulo se reescribe solo.
--
-- Run this once in the Supabase SQL Editor before merging. Idempotente.

alter table public.tareas add column if not exists fecha_edicion date;

-- Rellena las tarjetas que ya existen leyendo "Editar <día>, <n> <mes>" del
-- subtítulo. El año es el de la grabación (o el siguiente si la edición
-- caería más de 60 días antes, p. ej. grabar el 30 dic y editar el 2 ene).
with p as (
  select id, fecha_limite,
         regexp_match(lower(subtitulo), 'editar [^,]+, (\d{1,2}) ([a-zñ]+)') as m
  from public.tareas
  where fecha_edicion is null and fecha_limite is not null and subtitulo ilike '%editar %'
), q as (
  select id, fecha_limite, m[1]::int as dia,
         array_position(array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'], left(m[2], 3)) as mes
  from p where m is not null
)
update public.tareas t
set fecha_edicion = case
  when make_date(extract(year from q.fecha_limite)::int, q.mes, q.dia) < q.fecha_limite - 60
    then make_date(extract(year from q.fecha_limite)::int + 1, q.mes, q.dia)
  else make_date(extract(year from q.fecha_limite)::int, q.mes, q.dia)
end
from q
where t.id = q.id and q.mes is not null and q.dia between 1 and 31;
