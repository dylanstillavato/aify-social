-- Aify: presupuesto firmado → cliente con su cuota y su onboarding.
--
-- Último hueco de la fase 2 de la auditoría UX: hasta ahora la firma solo
-- marcaba el presupuesto como firmado. Con esto, al firmar:
--   1. Si el presupuesto lleva cuota mensual, pasa a clientes.cuota_mensual
--      (y con ella al ingreso recurrente y a "Generar facturas de <mes>").
--   2. Si el cliente sigue en la columna "Presupuesto enviado" del tablero de
--      clientes (o en ninguna, que es lo mismo: la primera), pasa a
--      "Presupuesto firmado", si esa columna existe en su organización.
--   3. Si el presupuesto pide onboarding, se crea (o se reutiliza) el enlace
--      del formulario (cliente_onboardings, 0018) para ese cliente y la
--      página de firma lo enseña como siguiente paso.
--
-- - presupuestos.cuota_mensual: lo que se cobrará cada mes. Null = sin cuota.
-- - presupuestos.pedir_onboarding: la app lo marca por defecto cuando el
--   presupuesto se hace con "Cliente nuevo".
-- - get_presupuesto_publico devuelve además cuota_mensual y, si ya está
--   firmado, onboarding_token (solo el formulario pendiente de ESE cliente,
--   mismo criterio que el portal del cliente en 0021).
-- - firmar_presupuesto: misma firma de función y mismos grants; devuelve
--   además onboarding_token (null si no se pidió).
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

alter table public.presupuestos add column if not exists cuota_mensual numeric(10,2);
alter table public.presupuestos add column if not exists pedir_onboarding boolean not null default false;

-- ── Enlace de onboarding pendiente de un cliente (o null) ───────────────────

create or replace function public.onboarding_pendiente_cliente(p_cliente_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.token
  from public.cliente_onboardings o
  where o.cliente_id = p_cliente_id
    and o.estado = 'pendiente'
    and o.expira_en > now()
  order by o.created_at desc
  limit 1;
$$;

-- Solo la usan las dos RPCs de abajo, nunca el navegador directamente
revoke all on function public.onboarding_pendiente_cliente(uuid) from public, anon, authenticated;

-- ── Lectura pública (token del presupuesto) ─────────────────────────────────

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
    'cuota_mensual', p.cuota_mensual,
    'notas', p.notas,
    'emisor', p.emisor,
    'firmado_en', p.firmado_en,
    'firmante_nombre', p.firmante_nombre,
    'cliente_nombre', c.nombre,
    'onboarding_token', case
      when p.estado = 'firmado' and p.pedir_onboarding
        then public.onboarding_pendiente_cliente(p.cliente_id)
      end
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

-- ── Firma pública ───────────────────────────────────────────────────────────

create or replace function public.firmar_presupuesto(
  p_token uuid,
  p_firma_data_url text,
  p_firmante_nombre text,
  p_firmante_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.presupuestos%rowtype;
  v_c public.clientes%rowtype;
  v_col_firmado uuid;
  v_onboarding uuid;
begin
  select * into v_p
  from public.presupuestos
  where token = p_token
  for update; -- row lock: evita doble envío en carrera

  if v_p.id is null then
    raise exception 'Presupuesto no encontrado';
  end if;

  if v_p.estado in ('firmado', 'rechazado') then
    raise exception 'Este presupuesto ya no admite firma (estado: %)', v_p.estado;
  end if;

  if p_firma_data_url is null or length(p_firma_data_url) < 100 then
    raise exception 'Firma invalida';
  end if;

  update public.presupuestos
  set estado = 'firmado',
      firma_data_url = p_firma_data_url,
      firmado_en = now(),
      firmante_nombre = p_firmante_nombre,
      firmante_email = p_firmante_email,
      updated_at = now()
  where id = v_p.id;

  select * into v_c from public.clientes where id = v_p.cliente_id for update;

  -- 1. Cuota del presupuesto → cliente
  if v_p.cuota_mensual is not null and v_p.cuota_mensual > 0 then
    update public.clientes set cuota_mensual = v_p.cuota_mensual where id = v_c.id;
  end if;

  -- 2. Tablero de clientes: "Presupuesto enviado" (o ninguna) → "Presupuesto firmado"
  if v_c.organizacion_id is not null then
    select id into v_col_firmado
    from public.tablero_columnas
    where organizacion_id = v_c.organizacion_id
      and tablero = 'clientes'
      and lower(nombre) = 'presupuesto firmado'
    order by orden
    limit 1;

    if v_col_firmado is not null and (
      v_c.etapa_id is null or exists (
        select 1 from public.tablero_columnas
        where id = v_c.etapa_id and lower(nombre) = 'presupuesto enviado'
      )
    ) then
      update public.clientes set etapa_id = v_col_firmado where id = v_c.id;
    end if;
  end if;

  -- 3. Formulario de onboarding: se reutiliza el pendiente o se crea uno
  if v_p.pedir_onboarding then
    v_onboarding := public.onboarding_pendiente_cliente(v_c.id);
    if v_onboarding is null then
      insert into public.cliente_onboardings (user_id, organizacion_id, cliente_id, nombre_cliente)
      values (v_p.user_id, v_c.organizacion_id, v_c.id, v_c.nombre)
      returning token into v_onboarding;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'firmado_en', now(), 'onboarding_token', v_onboarding);
end;
$$;

revoke all on function public.firmar_presupuesto(uuid, text, text, text) from public;
grant execute on function public.firmar_presupuesto(uuid, text, text, text) to anon, authenticated;
