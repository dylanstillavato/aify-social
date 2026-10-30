-- Aify: hora y notas por post del calendario — permite fijar a qué hora se
-- publica cada post y dejar una nota corta (quién lo graba, recordatorios,
-- etc.), como en el Calendario de iPhone.

alter table public.calendario_posts add column if not exists hora time;
alter table public.calendario_posts add column if not exists notas text;
