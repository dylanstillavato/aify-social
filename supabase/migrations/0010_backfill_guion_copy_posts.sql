-- Aify: backfill de guión/copy en posts que vinieron de una idea que YA
-- tenía guión/copy generado en el momento de crear el post — vía "Aplicar
-- sugerencia" o arrastrando la idea al calendario (ver fix en
-- ClienteDetalle.jsx: addIdeaToDay y los dos botones "Aplicar"). Esos flujos
-- creaban el post copiando título/concepto/formato pero nunca el guión/copy
-- ya generado, así que el calendario mostraba la idea como "sin desarrollar"
-- aunque "Ideas y Guiones" sí tuviera el guión.
--
-- Este backfill repara los posts ya existentes que quedaron así, copiando
-- desde la idea de origen solo donde el post todavía no tiene ese contenido
-- (no pisa nada que el usuario ya haya editado en el post).

update public.calendario_posts p
set guion = i.guion
from public.ideas i
where p.origen_idea_id = i.id
  and p.guion is null
  and i.guion is not null;

update public.calendario_posts p
set copy = i.copy->0->>'copy',
    hashtags = coalesce(p.hashtags, i.copy->0->>'hashtags')
from public.ideas i
where p.origen_idea_id = i.id
  and p.copy is null
  and i.copy is not null
  and jsonb_typeof(i.copy) = 'array'
  and jsonb_array_length(i.copy) > 0;

update public.calendario_posts p
set desarrollado = true
from public.ideas i
where p.origen_idea_id = i.id
  and p.desarrollado = false
  and (i.guion is not null or i.copy is not null);
