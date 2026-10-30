-- 0045: plan del mes por cliente (flujo de contenido, issues #82-#84).
-- Cada cliente puede tener, para un mes, lo que se quiere contar (notas), sus
-- fechas destacadas y cuántas piezas de cada tipo generar. Las ideas quedan
-- ligadas a ese mes y a su tipo de pieza. Idempotente.

create table if not exists public.planes_mes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  notas text,
  fechas jsonb not null default '[]'::jsonb,       -- [{ fecha, nombre }]
  cantidades jsonb not null default '{}'::jsonb,   -- { video_guion, trend, solo_planos, viral_musica, carrusel }
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (cliente_id, mes)
);

alter table public.ideas add column if not exists mes date;
alter table public.ideas add column if not exists tipo_pieza text;
alter table public.ideas add column if not exists plan_mes_id uuid references public.planes_mes(id) on delete set null;
alter table public.ideas add column if not exists feedback text;
create index if not exists ideas_cliente_mes_idx on public.ideas(cliente_id, mes);

-- RLS igual que ideas (0006): el plan es de un cliente de mi organización
alter table public.planes_mes enable row level security;

drop policy if exists "org members can select planes_mes" on public.planes_mes;
create policy "org members can select planes_mes" on public.planes_mes for select
  using (exists (select 1 from public.clientes c where c.id = planes_mes.cliente_id and c.organizacion_id = public.mi_organizacion_id()));
drop policy if exists "org members can insert planes_mes" on public.planes_mes;
create policy "org members can insert planes_mes" on public.planes_mes for insert
  with check (exists (select 1 from public.clientes c where c.id = planes_mes.cliente_id and c.organizacion_id = public.mi_organizacion_id()));
drop policy if exists "org members can update planes_mes" on public.planes_mes;
create policy "org members can update planes_mes" on public.planes_mes for update
  using (exists (select 1 from public.clientes c where c.id = planes_mes.cliente_id and c.organizacion_id = public.mi_organizacion_id()));
drop policy if exists "org members can delete planes_mes" on public.planes_mes;
create policy "org members can delete planes_mes" on public.planes_mes for delete
  using (exists (select 1 from public.clientes c where c.id = planes_mes.cliente_id and c.organizacion_id = public.mi_organizacion_id()));
