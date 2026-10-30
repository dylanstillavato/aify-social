-- Aify: la columna archivado en clientes se usaba en el frontend (filtro
-- "Archivados" en Clientes.jsx, botón "Archivar cliente" en ClienteDetalle.jsx)
-- pero nunca se leía ni escribía realmente contra Supabase — useClientes.js
-- reconstruye siempre la fila a guardar desde un whitelist fijo de campos que
-- no incluía archivado, así que el botón solo cambiaba el estado local en
-- memoria; al recargar la página, el cliente volvía a aparecer como activo.
-- Ya arreglado en el código (mapearCliente/actualizarCliente); esta migración
-- solo asegura que la columna existe.
alter table public.clientes add column if not exists archivado boolean not null default false;
