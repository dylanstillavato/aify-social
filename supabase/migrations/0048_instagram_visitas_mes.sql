-- Aify: visualizaciones de Instagram por mes, para la tarjeta del Inicio.
--
-- Meta solo deja pedir rangos de 30 días, así que el histórico se va
-- guardando aquí: una fila por cliente y mes con el total de visualizaciones
-- (views) de su cuenta. Los meses cerrados se piden una vez; el mes en curso
-- se refresca como mucho cada hora (server.js → /api/instagram/visitas-mensuales).
--
-- Solo la usa el servidor (service role): sin policies ni privilegios para el
-- navegador, igual que instagram_tokens.
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create table if not exists public.instagram_visitas_mes (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  mes date not null, -- día 1 del mes
  visualizaciones bigint,
  actualizado_en timestamptz not null default now(),
  primary key (cliente_id, mes)
);

alter table public.instagram_visitas_mes enable row level security;
revoke all on table public.instagram_visitas_mes from anon, authenticated;
