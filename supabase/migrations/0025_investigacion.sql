-- Aify: investigación mensual por cliente (Fase 5).
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- La investigación es un "onboarding interno" que el gestor repite cada mes:
-- moodboard visual, paleta y tipografías, música, referencias de competidores
-- (con análisis de IA) y fechas clave del sector. Todo es interno: el cliente
-- final no ve nada de esto (no hay RPC pública ni acceso anónimo).
--
--   investigaciones   → una fila por cliente y mes; todo el contenido libre
--                       vive en `datos` (jsonb) para poder iterar la UI sin
--                       migraciones nuevas.
--   fechas_marcadas   → fechas fijadas para un cliente (del onboarding, de la
--                       investigación o añadidas a mano). El calendario de
--                       cada cliente las lee para mostrarlas fijadas.
--   storage 'moodboards' → imágenes del moodboard (bucket privado; la app las
--                       muestra con URLs firmadas de 1 hora).
--
-- RLS: mismo criterio que las tablas con cliente_id de 0006/0021 — visibles
-- para quien las creó y para los compañeros de la organización del cliente.
-- A diferencia de 0006, aquí el borrado también se abre a la organización:
-- son datos de trabajo del equipo (quitar una fecha o una imagen del
-- moodboard), no registros con valor de rastro como facturas.
--
-- Idempotente: seguro volver a ejecutar el archivo entero.

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.investigaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, anio, mes)
);

create index if not exists investigaciones_org_idx on public.investigaciones(organizacion_id);

create table if not exists public.fechas_marcadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  titulo text not null,
  origen text not null default 'manual' check (origen in ('onboarding', 'investigacion', 'manual')),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists fechas_marcadas_cliente_fecha_idx on public.fechas_marcadas(cliente_id, fecha);
create index if not exists fechas_marcadas_org_idx on public.fechas_marcadas(organizacion_id);

alter table public.investigaciones enable row level security;
alter table public.fechas_marcadas enable row level security;

-- ── RLS: investigaciones ────────────────────────────────────────────────────

drop policy if exists "investigaciones select" on public.investigaciones;
create policy "investigaciones select" on public.investigaciones for select
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = investigaciones.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

-- Insert solo como uno mismo y para un cliente visible (propio o de su org)
drop policy if exists "investigaciones insert" on public.investigaciones;
create policy "investigaciones insert" on public.investigaciones for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    )
  );

drop policy if exists "investigaciones update" on public.investigaciones;
create policy "investigaciones update" on public.investigaciones for update
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = investigaciones.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "investigaciones delete" on public.investigaciones;
create policy "investigaciones delete" on public.investigaciones for delete
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = investigaciones.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

-- ── RLS: fechas_marcadas ────────────────────────────────────────────────────

drop policy if exists "fechas marcadas select" on public.fechas_marcadas;
create policy "fechas marcadas select" on public.fechas_marcadas for select
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = fechas_marcadas.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "fechas marcadas insert" on public.fechas_marcadas;
create policy "fechas marcadas insert" on public.fechas_marcadas for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    )
  );

drop policy if exists "fechas marcadas update" on public.fechas_marcadas;
create policy "fechas marcadas update" on public.fechas_marcadas for update
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = fechas_marcadas.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "fechas marcadas delete" on public.fechas_marcadas;
create policy "fechas marcadas delete" on public.fechas_marcadas for delete
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = fechas_marcadas.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

-- ── Storage: bucket privado para el moodboard ───────────────────────────────
-- Convención de ruta: <organizacion_id>/<cliente_id>/<uuid>.<ext>
-- El primer segmento es la organización del usuario que sube
-- (public.mi_organizacion_id(), la misma función security definer de 0006,
-- sin recursión de RLS). Así las políticas no necesitan consultar clientes:
-- cualquier miembro de la organización ve, sube y borra las imágenes de su
-- organización, y nadie de fuera puede ni listarlas. (storage.foldername()
-- devuelve el array de carpetas de la ruta; [1] es el primer segmento.)
-- public = false: no hay URL pública; la app pide URLs firmadas de 1 hora.

insert into storage.buckets (id, name, public)
values ('moodboards', 'moodboards', false)
on conflict (id) do nothing;

drop policy if exists "moodboards select org" on storage.objects;
create policy "moodboards select org" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'moodboards'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

drop policy if exists "moodboards insert org" on storage.objects;
create policy "moodboards insert org" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'moodboards'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

drop policy if exists "moodboards delete org" on storage.objects;
create policy "moodboards delete org" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'moodboards'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );
