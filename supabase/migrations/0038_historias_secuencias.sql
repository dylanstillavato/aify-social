-- Aify: herramienta "Secuencias de historias".
--
-- Cada secuencia guarda las historias generadas (textos, plantilla, fondo y
-- las rutas de la foto original y de la imagen final en el bucket
-- "publicaciones" de 0036). Sirve para volver a abrirlas y para que la IA no
-- repita lo que ya se hizo con ese cliente.
--
-- historias: [{ foto_ruta, render_ruta, plantilla, fondo, titular, texto,
--               sticker: { tipo, texto } }]
--
-- Mismo criterio de acceso que investigaciones (0025): el autor o cualquier
-- miembro de la organización del cliente.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.historias_secuencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null default '',
  objetivo text,
  historias jsonb not null default '[]'::jsonb,
  estilo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists historias_secuencias_cliente_idx on public.historias_secuencias(cliente_id, created_at desc);

alter table public.historias_secuencias enable row level security;

drop policy if exists "historias secuencias select" on public.historias_secuencias;
create policy "historias secuencias select" on public.historias_secuencias for select
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = historias_secuencias.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "historias secuencias insert" on public.historias_secuencias;
create policy "historias secuencias insert" on public.historias_secuencias for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    )
  );

drop policy if exists "historias secuencias update" on public.historias_secuencias;
create policy "historias secuencias update" on public.historias_secuencias for update
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = historias_secuencias.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "historias secuencias delete" on public.historias_secuencias;
create policy "historias secuencias delete" on public.historias_secuencias for delete
  using (user_id = auth.uid() or exists (
    select 1 from public.clientes c
    where c.id = historias_secuencias.cliente_id
      and c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()
  ));
