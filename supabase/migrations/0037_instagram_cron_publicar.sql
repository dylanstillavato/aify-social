-- Aify: el "cron" que publica en Instagram a la hora, desde el propio Supabase.
--
-- La API de Instagram no programa: server.js publica lo que toca cuando se
-- llama a POST /api/instagram/publicar/tick (ver 0036 y
-- docs/instagram-setup.md). El plan free de Render duerme el servidor tras
-- 15 min sin tráfico, así que algo tiene que llamarlo cada minuto. Aquí lo
-- hace pg_cron + pg_net de Supabase, sin servicios externos (y de paso
-- mantiene el servidor despierto).
--
-- El secreto (INSTAGRAM_CRON_SECRET de Render) NO va en este archivo: vive en
-- Supabase Vault con el nombre 'instagram_cron_secret'. Créalo una vez, antes
-- o después de esta migración, con (sustituyendo el valor):
--
--   select vault.create_secret('<INSTAGRAM_CRON_SECRET>', 'instagram_cron_secret');
--
-- Si cambias el secreto en Render, cámbialo también en Vault:
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'instagram_cron_secret'),
--     '<NUEVO_VALOR>');
--
-- Para ver si corre: select * from cron.job_run_details order by start_time desc limit 10;
-- Para pararlo:      select cron.unschedule('aify-instagram-publicar');
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('aify-instagram-publicar')
where exists (select 1 from cron.job where jobname = 'aify-instagram-publicar');

-- Cada minuto. El timeout es largo porque un arranque en frío de Render tarda
-- ~50 s; aunque pg_net se rinda antes, la llamada ya ha despertado el servidor.
select cron.schedule(
  'aify-instagram-publicar',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://aify-backend.onrender.com/api/instagram/publicar/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'instagram_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'instagram_cron_secret');
  $$
);
