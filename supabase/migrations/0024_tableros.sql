-- Aify: tableros Kanban — las tareas dejan de ser una lista con secciones
-- automáticas (Vencidas, Hoy, Esta semana...) y pasan a un tablero con
-- columnas que el equipo mueve a mano. También hay un tablero de clientes
-- (Presupuesto enviado → ... → Pagado). Objetivo: sustituir a Notion.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - tablero_columnas: las columnas de cada tablero ('tareas' o 'clientes'),
--   compartidas por toda la organización. No se siembra nada aquí: la app crea
--   las columnas por defecto la primera vez que se abre un tablero vacío.
--   es_final marca la columna de "hecho": mover una tarea ahí la completa (y a
--   las 24 h se archiva sola, ver 0022_tareas_archivadas.sql).
-- - tareas.columna_id: columna en la que está la tarea. Null = primera columna
--   (tareas antiguas o creadas desde otras pantallas). tareas.orden ya existía
--   y se reutiliza como posición dentro de la columna.
-- - clientes.etapa_id / clientes.etapa_orden: columna y posición del cliente en
--   el tablero de clientes. Null = primera columna.
-- Borrar una columna deja sus tarjetas en null (on delete set null); la app
-- las mueve antes a la primera columna.
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.
-- Aditivo: tabla nueva y columnas nullable; no toca ninguna política existente.
-- RLS con el mismo criterio que cliente_portales (0021): dueño o miembro de la
-- organización (public.mi_organizacion_id(), ver 0006_organizaciones.sql).

-- ── Tabla ───────────────────────────────────────────────────────────────────

create table if not exists public.tablero_columnas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tablero text not null check (tablero in ('tareas', 'clientes')),
  nombre text not null,
  orden int not null default 0,
  color text,
  es_final boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tablero_columnas_org_idx
  on public.tablero_columnas(organizacion_id, tablero, orden);
create index if not exists tablero_columnas_user_idx
  on public.tablero_columnas(user_id, tablero);

-- ── Columnas nuevas en tareas y clientes ────────────────────────────────────

alter table public.tareas add column if not exists columna_id uuid
  references public.tablero_columnas(id) on delete set null;
create index if not exists tareas_columna_idx on public.tareas(columna_id)
  where columna_id is not null;

alter table public.clientes add column if not exists etapa_id uuid
  references public.tablero_columnas(id) on delete set null;
alter table public.clientes add column if not exists etapa_orden int;
create index if not exists clientes_etapa_idx on public.clientes(etapa_id)
  where etapa_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.tablero_columnas enable row level security;

drop policy if exists "tablero columnas select" on public.tablero_columnas;
create policy "tablero columnas select" on public.tablero_columnas for select
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- Insert solo como uno mismo y, si se indica organización, la propia.
drop policy if exists "tablero columnas insert" on public.tablero_columnas;
create policy "tablero columnas insert" on public.tablero_columnas for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
  );

drop policy if exists "tablero columnas update" on public.tablero_columnas;
create policy "tablero columnas update" on public.tablero_columnas for update
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()))
  with check (organizacion_id is null or organizacion_id = public.mi_organizacion_id());

drop policy if exists "tablero columnas delete" on public.tablero_columnas;
create policy "tablero columnas delete" on public.tablero_columnas for delete
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));
