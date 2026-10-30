-- (Versión pública: los correos reales de la instalación original se han cambiado por correos de ejemplo.)
-- Aify: falta el DELETE en las políticas de organización — 0006_organizaciones
-- añadió SELECT/INSERT/UPDATE "org members can ..." para clientes, ideas,
-- calendario_posts, tareas, facturas y presupuestos, pero nunca un DELETE
-- equivalente. La única política de borrado que quedaba en pie para estas
-- tablas seguía siendo la original "own X delete" (auth.uid() = user_id),
-- así que cualquier fila creada por OTRO miembro de la organización (o
-- heredada de antes de que existiera la organización) no se puede borrar:
-- el DELETE no da error — PostgREST devuelve 204 igual aunque RLS filtre la
-- fila a 0 resultados — pero la fila sigue ahí después de refrescar.
--
-- Reproducido en producción: borrar un post del calendario de un cliente
-- compartido entre propietario@example.com y miembro@example.com
-- (seed de organización al final de 0006_organizaciones.sql) devolvía 204
-- pero el post seguía apareciendo tras recargar.
--
-- Estas políticas son permisivas (comportamiento por defecto de Postgres),
-- así que conviven con "own X delete" combinándose por OR — no reemplazan
-- nada, solo añaden el permiso que faltaba para el resto de la organización.

drop policy if exists "org members can delete clientes" on public.clientes;
create policy "org members can delete clientes" on public.clientes for delete
  using (organizacion_id is not null and organizacion_id = public.mi_organizacion_id());

drop policy if exists "org members can delete ideas" on public.ideas;
create policy "org members can delete ideas" on public.ideas for delete
  using (cliente_id is not null and exists (
    select 1 from public.clientes c where c.id = ideas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can delete posts" on public.calendario_posts;
create policy "org members can delete posts" on public.calendario_posts for delete
  using (exists (
    select 1 from public.clientes c where c.id = calendario_posts.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can delete tareas" on public.tareas;
create policy "org members can delete tareas" on public.tareas for delete
  using (cliente_id is not null and exists (
    select 1 from public.clientes c where c.id = tareas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can delete facturas" on public.facturas;
create policy "org members can delete facturas" on public.facturas for delete
  using (exists (
    select 1 from public.clientes c where c.id = facturas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can delete presupuestos" on public.presupuestos;
create policy "org members can delete presupuestos" on public.presupuestos for delete
  using (exists (
    select 1 from public.clientes c where c.id = presupuestos.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
