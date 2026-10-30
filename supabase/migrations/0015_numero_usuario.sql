-- Aify: insignia "USUARIO #N" para los primeros 50 registrados.
-- auth.users no es consultable directamente desde el cliente (RLS de
-- Supabase no expone ese esquema), así que el ranking se calcula en un RPC
-- security definer que solo devuelve la posición del usuario que llama —
-- nunca la tabla completa ni la posición de otros usuarios.

create or replace function public.mi_numero_usuario()
returns int
language sql
security definer
stable
set search_path = public
as $$
  select ranked.rank::int
  from (
    select id, row_number() over (order by created_at asc, id asc) as rank
    from auth.users
  ) ranked
  where ranked.id = auth.uid()
$$;

revoke all on function public.mi_numero_usuario() from public;
grant execute on function public.mi_numero_usuario() to authenticated;
