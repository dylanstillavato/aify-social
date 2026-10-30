-- Presupuestos y facturas con precios "IVA incluido": lo que se escribe en
-- cada línea ya lleva el IVA; subtotal (base imponible), iva y total se
-- calculan hacia atrás al guardar. La columna solo sirve para enseñar
-- "Base imponible" y "Total (IVA incluido)" en el panel, el PDF y la página
-- pública de firma. Los documentos existentes quedan como estaban (false).

alter table public.presupuestos add column if not exists iva_incluido boolean not null default false;
alter table public.facturas add column if not exists iva_incluido boolean not null default false;

-- Página pública de firma: misma función que en 0002 + iva_incluido
create or replace function public.get_presupuesto_publico(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'numero', p.numero,
    'fecha_emision', p.fecha_emision,
    'validez_hasta', p.validez_hasta,
    'estado', p.estado,
    'items', p.items,
    'subtotal', p.subtotal,
    'iva_pct', p.iva_pct,
    'iva', p.iva,
    'total', p.total,
    'iva_incluido', p.iva_incluido,
    'notas', p.notas,
    'emisor', p.emisor,
    'firmado_en', p.firmado_en,
    'firmante_nombre', p.firmante_nombre,
    'cliente_nombre', c.nombre
  ) into v_result
  from public.presupuestos p
  join public.clientes c on c.id = p.cliente_id
  where p.token = p_token;

  if v_result is null then
    raise exception 'Presupuesto no encontrado';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_presupuesto_publico(uuid) from public;
grant execute on function public.get_presupuesto_publico(uuid) to anon, authenticated;
