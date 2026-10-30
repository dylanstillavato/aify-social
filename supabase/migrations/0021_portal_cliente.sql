-- Aify: portal del cliente — un único enlace estable por cliente que reúne
-- todo lo que el gestor le ha mandado: formularios pendientes (0018),
-- presupuestos por firmar (0002), guiones por aprobar (0019) y sus facturas.
-- Así el cliente no tiene que buscar cada enlace suelto en su WhatsApp.
--
-- Mismo modelo capability-token que 0018 y 0019: el token largo e
-- inadivinable de la URL ES la autenticación. La tabla no tiene ningún acceso
-- anónimo por RLS; el visitante solo pasa por un RPC security definer de solo
-- lectura que únicamente devuelve datos del cliente de ESE token. A diferencia
-- de los otros enlaces, el portal no caduca: vale hasta que se revoca.

create table if not exists public.cliente_portales (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estado text not null default 'activo' check (estado in ('activo', 'revocado')),
  created_at timestamptz not null default now()
);

create index if not exists cliente_portales_cliente_idx on public.cliente_portales(cliente_id);
create index if not exists cliente_portales_org_idx on public.cliente_portales(organizacion_id);

alter table public.cliente_portales enable row level security;

drop policy if exists "portales select" on public.cliente_portales;
create policy "portales select" on public.cliente_portales for select
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- Insert solo como uno mismo, en su organización y para un cliente visible
-- (mismo criterio que "aprobaciones insert" en 0019).
drop policy if exists "portales insert" on public.cliente_portales;
create policy "portales insert" on public.cliente_portales for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    )
  );

-- Update solo para revocar desde la app
drop policy if exists "portales update" on public.cliente_portales;
create policy "portales update" on public.cliente_portales for update
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- ── RPC pública ──────────────────────────────────────────────────────────────

-- Devuelve solo lo que el cliente necesita ver. Cada sub-select filtra por el
-- cliente_id del token; nunca se exponen user_id, emails, notas internas,
-- emisor ni conceptos de las facturas.
create or replace function public.get_portal_cliente(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portal public.cliente_portales;
  v_agencia text;
  v_cliente jsonb;
  v_formularios jsonb;
  v_presupuestos jsonb;
  v_aprobaciones jsonb;
  v_facturas jsonb;
begin
  select * into v_portal from public.cliente_portales where token = p_token;
  if v_portal.id is null then
    raise exception 'Portal no encontrado';
  end if;

  select o.nombre into v_agencia
  from public.organizaciones o
  where o.id = coalesce(
    v_portal.organizacion_id,
    (select c.organizacion_id from public.clientes c where c.id = v_portal.cliente_id)
  );

  if v_portal.estado <> 'activo' then
    return jsonb_build_object('estado', v_portal.estado, 'agencia_nombre', v_agencia);
  end if;

  select jsonb_build_object(
    'nombre', c.nombre,
    'colores', jsonb_build_object(
      'colorPrimario', c.identidad_visual->>'colorPrimario',
      'colorSecundario', c.identidad_visual->>'colorSecundario'
    ),
    'logo', c.identidad_visual->>'logo'
  ) into v_cliente
  from public.clientes c
  where c.id = v_portal.cliente_id;

  -- Formularios de onboarding pendientes y vigentes de este cliente
  select coalesce(jsonb_agg(jsonb_build_object(
    'token', o.token, 'created_at', o.created_at
  ) order by o.created_at desc), '[]'::jsonb)
  into v_formularios
  from public.cliente_onboardings o
  where o.cliente_id = v_portal.cliente_id
    and o.estado = 'pendiente'
    and o.expira_en >= now();

  -- Presupuestos enviados que aún esperan firma
  select coalesce(jsonb_agg(jsonb_build_object(
    'numero', p.numero, 'total', p.total, 'fecha_emision', p.fecha_emision,
    'validez_hasta', p.validez_hasta, 'token', p.token
  ) order by p.fecha_emision desc, p.creado_en desc), '[]'::jsonb)
  into v_presupuestos
  from public.presupuestos p
  where p.cliente_id = v_portal.cliente_id
    and p.estado = 'enviado';

  -- Enlaces de aprobación de guiones activos, con el recuento del mes
  select coalesce(jsonb_agg(jsonb_build_object(
    'token', a.token, 'anio', a.anio, 'mes', a.mes,
    'pendientes', (
      select count(*) from public.calendario_posts cp
      where cp.cliente_id = v_portal.cliente_id
        and cp.fecha >= make_date(a.anio, a.mes, 1)
        and cp.fecha < (make_date(a.anio, a.mes, 1) + interval '1 month')
        and cp.guion is not null
        and (cp.aprobacion_estado is null or cp.aprobacion_estado = 'cambios')
    ),
    'total', (
      select count(*) from public.calendario_posts cp
      where cp.cliente_id = v_portal.cliente_id
        and cp.fecha >= make_date(a.anio, a.mes, 1)
        and cp.fecha < (make_date(a.anio, a.mes, 1) + interval '1 month')
        and cp.guion is not null
    )
  ) order by a.anio desc, a.mes desc, a.created_at desc), '[]'::jsonb)
  into v_aprobaciones
  from public.guion_aprobaciones a
  where a.cliente_id = v_portal.cliente_id
    and a.estado = 'activo'
    and a.expira_en >= now();

  -- Últimas 12 facturas (sin emisor, conceptos ni notas). Las canceladas no
  -- le dicen nada al cliente, se omiten.
  select coalesce(jsonb_agg(jsonb_build_object(
    'numero', f.numero, 'total', f.total, 'estado', f.estado,
    'fecha_emision', f.fecha_emision, 'fecha_vencimiento', f.fecha_vencimiento
  ) order by f.fecha_emision desc, f.creado_en desc), '[]'::jsonb)
  into v_facturas
  from (
    select * from public.facturas
    where cliente_id = v_portal.cliente_id
      and estado <> 'cancelada'
    order by fecha_emision desc, creado_en desc
    limit 12
  ) f;

  return jsonb_build_object(
    'estado', v_portal.estado,
    'agencia_nombre', v_agencia,
    'cliente', v_cliente,
    'formularios', v_formularios,
    'presupuestos', v_presupuestos,
    'aprobaciones', v_aprobaciones,
    'facturas', v_facturas
  );
end;
$$;

revoke all on function public.get_portal_cliente(uuid) from public;
grant execute on function public.get_portal_cliente(uuid) to anon, authenticated;
