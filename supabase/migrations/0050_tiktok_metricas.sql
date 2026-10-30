-- Aify: TikTok, fase 2. Métricas de la cuenta conectada (docs/tiktok-plan.md).
--
-- La API de TikTok solo da los contadores de ahora (user/info) y, por vídeo
-- público, visualizaciones, me gustas, comentarios y compartidos (video/list).
-- Sin alcance, sin retención y sin series diarias, así que el histórico se
-- guarda aquí:
--
-- - tiktok_metricas_cache: la última lectura de /api/tiktok/metricas (jsonb),
--   para no pedirla a TikTok más de una vez por hora (como
--   instagram_metricas_cache, 0027).
-- - tiktok_metricas_dia: una foto al día por cuenta (seguidores, me gustas,
--   nº de vídeos y la suma de visualizaciones de los vídeos listados). Las
--   visualizaciones de un mes salen de la diferencia entre la última foto del
--   mes y la última del mes anterior (tarjeta del Inicio).
-- - tiktok_videos_24h: los números de cada vídeo una sola vez, entre las 24 y
--   las 48 h de publicarse (como instagram_reels_24h, 0040).
--
-- Solo las usa el servidor (service role): sin policies ni privilegios para el
-- navegador, igual que tiktok_tokens. Al desconectar la cuenta se borran.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.tiktok_metricas_cache (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.tiktok_metricas_dia (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  dia date not null, -- día UTC de la foto
  seguidores bigint,
  me_gustas bigint,
  videos integer,
  -- Suma de view_count de los vídeos que devolvió video/list (hasta 200).
  visualizaciones_totales bigint,
  videos_listados integer,
  tomado_en timestamptz not null default now(),
  primary key (cliente_id, dia)
);

create table if not exists public.tiktok_videos_24h (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  video_id text not null,
  publicado_en timestamptz not null,
  tomado_en timestamptz not null default now(),
  horas numeric(5, 1) not null,
  enlace text,
  texto text,
  visualizaciones bigint,
  me_gusta bigint,
  comentarios bigint,
  compartidos bigint,
  primary key (cliente_id, video_id)
);
create index if not exists tiktok_videos_24h_cliente_fecha_idx
  on public.tiktok_videos_24h(cliente_id, publicado_en desc);

-- ── RLS: solo el servidor ─────────────────────────────────────────────────────

alter table public.tiktok_metricas_cache enable row level security;
alter table public.tiktok_metricas_dia enable row level security;
alter table public.tiktok_videos_24h enable row level security;

revoke all on table public.tiktok_metricas_cache from anon, authenticated;
revoke all on table public.tiktok_metricas_dia from anon, authenticated;
revoke all on table public.tiktok_videos_24h from anon, authenticated;
