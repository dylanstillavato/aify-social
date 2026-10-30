-- Aify: cuota mensual de generaciones de IA por organización — el
-- diferenciador real entre planes (antes el único límite de verdad era el de
-- clientes activos; Freelance/Pro/Agency tenían acceso idéntico al resto).
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.

alter table public.organizaciones add column if not exists uso_ia_mes integer not null default 0;
alter table public.organizaciones add column if not exists uso_ia_periodo text; -- 'YYYY-MM' del período que cuenta uso_ia_mes

-- Incrementa el contador atómicamente y lo reinicia solo si el período
-- guardado ya no es el actual — así el reinicio mensual no necesita ningún
-- cron ni job aparte, solo ocurre la primera vez que alguien genera algo en
-- un mes nuevo. security definer porque lo llama el backend con la clave
-- service_role, nunca el cliente directamente.
create or replace function public.incrementar_uso_ia(p_organizacion_id uuid, p_periodo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.organizaciones
  set uso_ia_mes = case when uso_ia_periodo = p_periodo then uso_ia_mes + 1 else 1 end,
      uso_ia_periodo = p_periodo
  where id = p_organizacion_id
  returning uso_ia_mes into v_count;
  return v_count;
end;
$$;

revoke all on function public.incrementar_uso_ia(uuid, text) from public;
grant execute on function public.incrementar_uso_ia(uuid, text) to service_role;
