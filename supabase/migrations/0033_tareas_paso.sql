-- Tareas enlazadas a un paso del proceso del cliente (Investigación, Ideas,
-- Guiones, Grabación, Edición y publicación, Seguimiento o uno personalizado).
-- Guarda el id del paso (utils/pasosCliente.js); null = sin paso. El enlace a
-- un guion o post concreto ya existía (post_id).
alter table public.tareas add column if not exists paso text;
