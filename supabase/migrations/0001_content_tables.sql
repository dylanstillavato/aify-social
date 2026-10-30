-- Aify: content persistence migration (ideas, calendario, guiones, tareas)
-- Run this once in the Supabase SQL Editor (Database → SQL Editor → New query).
-- No CLI is linked to this project, so this file is the source of truth to paste in manually.

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  tipo text,
  formato text,
  concepto text,
  por_que_funciona text,
  dificultad text,
  tiempo_estimado text,
  formato_sugerido text,
  guion jsonb,
  guion_guardado_en timestamptz,
  creada_en timestamptz not null default now()
);
create index ideas_cliente_idx on public.ideas(cliente_id);

create table public.calendario_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fecha date not null,
  red text not null,
  comparte_en text[],
  formato text,
  titulo text,
  concepto text,
  objetivo text,
  es_festivo boolean not null default false,
  nombre_festivo text,
  desarrollado boolean not null default false,
  desarrollado_en timestamptz,
  copy text,
  hashtags text,
  guion jsonb,
  estado text not null default 'borrador',
  origen_idea_id uuid references public.ideas(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index calendario_posts_cliente_fecha_idx on public.calendario_posts(cliente_id, fecha);

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  post_id uuid references public.calendario_posts(id) on delete cascade,
  titulo text not null,
  subtitulo text,
  idea_titulo text,
  red text,
  formato text,
  fecha_limite date,
  completada boolean not null default false,
  completada_en timestamptz,
  origen text not null default 'manual',
  tipo text,
  nota text,
  orden integer not null default 0,
  creada_en timestamptz not null default now()
);
create index tareas_cliente_idx on public.tareas(cliente_id);
create index tareas_post_idx on public.tareas(post_id);

alter table public.ideas enable row level security;
alter table public.calendario_posts enable row level security;
alter table public.tareas enable row level security;

create policy "own ideas select" on public.ideas for select using (auth.uid() = user_id);
create policy "own ideas insert" on public.ideas for insert with check (auth.uid() = user_id);
create policy "own ideas update" on public.ideas for update using (auth.uid() = user_id);
create policy "own ideas delete" on public.ideas for delete using (auth.uid() = user_id);

create policy "own posts select" on public.calendario_posts for select using (auth.uid() = user_id);
create policy "own posts insert" on public.calendario_posts for insert with check (auth.uid() = user_id);
create policy "own posts update" on public.calendario_posts for update using (auth.uid() = user_id);
create policy "own posts delete" on public.calendario_posts for delete using (auth.uid() = user_id);

create policy "own tareas select" on public.tareas for select using (auth.uid() = user_id);
create policy "own tareas insert" on public.tareas for insert with check (auth.uid() = user_id);
create policy "own tareas update" on public.tareas for update using (auth.uid() = user_id);
create policy "own tareas delete" on public.tareas for delete using (auth.uid() = user_id);
