-- Aify: foto de las métricas de cada reel a las 24 h de publicarse.
--
-- Base del clasificador de reels (bueno / ganador / malo, SOP de Trial reels):
-- la etiqueta se decide con lo que hizo el reel en sus primeras 24 h frente a
-- la media de la cuenta en los últimos 3 meses. instagram_metricas_cache solo
-- guarda la última lectura (se borra y se rehace), así que no sirve: aquí se
-- guarda una fila por reel, tomada una sola vez entre las 24 y las 48 h.
--
-- - horas: horas reales entre la publicación y la foto (24 = a tiempo; más si
--   el servidor estaba dormido). El clasificador puede descartar las tardías.
-- - visto_medio_ms y saltos (reels_skip_rate, 0-100): lo más parecido a la
--   retención que da la API (la curva no la da).
--
-- Mismo criterio que 0027: el navegador solo LEE; escribe server.js (service role).
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.instagram_reels_24h (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  media_id text not null,
  publicado_en timestamptz not null,
  tomado_en timestamptz not null default now(),
  horas numeric(5, 1) not null,
  enlace text,
  texto text,
  visualizaciones integer,
  alcance integer,
  me_gusta integer,
  comentarios integer,
  guardados integer,
  compartidos integer,
  visto_medio_ms integer,
  saltos numeric(5, 2),
  primary key (cliente_id, media_id)
);
create index if not exists instagram_reels_24h_cliente_fecha_idx
  on public.instagram_reels_24h(cliente_id, publicado_en desc);

alter table public.instagram_reels_24h enable row level security;
revoke insert, update, delete on table public.instagram_reels_24h from anon, authenticated;

drop policy if exists "instagram reels 24h select" on public.instagram_reels_24h;
create policy "instagram reels 24h select" on public.instagram_reels_24h for select
  using (exists (
    select 1 from public.clientes c
    where c.id = instagram_reels_24h.cliente_id
      and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
  ));
