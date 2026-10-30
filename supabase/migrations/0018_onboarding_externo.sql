-- Aify: onboarding externo — el gestor le manda a su cliente un enlace, el
-- cliente rellena el mismo cuestionario de "Nuevo cliente" sin cuenta de
-- Aify y, al enviarlo, los datos caen directamente en su ficha (un cliente
-- nuevo, o uno que ya existía y se completa).
--
-- Mismo modelo capability-token que la firma de presupuestos
-- (0002_facturas_presupuestos.sql) y las invitaciones (0006): el token largo e
-- inadivinable de la URL ES la autenticación. La tabla no tiene ningún acceso
-- anónimo por RLS; el visitante solo pasa por dos RPCs security definer que
-- únicamente tocan la fila de ESE token.

create table if not exists public.cliente_onboardings (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  -- null = el envío crea un cliente nuevo; con valor = completa ese cliente
  cliente_id uuid references public.clientes(id) on delete cascade,
  nombre_cliente text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'completado', 'revocado')),
  created_at timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '30 days',
  completado_en timestamptz,
  cliente_creado_id uuid references public.clientes(id) on delete set null
);

create index if not exists cliente_onboardings_org_idx on public.cliente_onboardings(organizacion_id);
create index if not exists cliente_onboardings_user_idx on public.cliente_onboardings(user_id);

alter table public.cliente_onboardings enable row level security;

drop policy if exists "onboardings select" on public.cliente_onboardings;
create policy "onboardings select" on public.cliente_onboardings for select
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- Insert solo como uno mismo y dentro de su propia organización (mismo
-- criterio que "org members can insert clientes" en 0006: nada de user_id
-- ajeno). Si el enlace es para un cliente existente, ese cliente tiene que
-- ser visible para quien crea el enlace.
drop policy if exists "onboardings insert" on public.cliente_onboardings;
create policy "onboardings insert" on public.cliente_onboardings for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and (cliente_id is null or exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    ))
  );

-- Update solo para revocar desde la app (el paso a 'completado' lo hace el RPC)
drop policy if exists "onboardings update" on public.cliente_onboardings;
create policy "onboardings update" on public.cliente_onboardings for update
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- ── RPCs públicas ────────────────────────────────────────────────────────────

-- Columnas del cliente que el formulario puede leer y escribir: exactamente
-- las que produce clienteDataParaDB() en src/hooks/useClientes.js, sin
-- organizacion_id (eso lo fija el enlace, nunca el visitante).
create or replace function public.onboarding_columnas_permitidas()
returns text[]
language sql immutable
as $$
  select array[
    'nombre', 'foto_url', 'sector', 'sector_custom', 'web', 'descripcion',
    'diferencial', 'ubicacion', 'ticket_medio', 'audiencia', 'tono',
    'tono_descripcion', 'energia', 'voz_genero', 'uso_emojis', 'estilo_texto',
    'prohibido', 'redes', 'historial', 'fechas_clave', 'identidad_visual',
    'texto_videos', 'videos_cliente', 'videos_referencia'
  ]::text[];
$$;

create or replace function public.get_onboarding_publico(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.cliente_onboardings;
  v_agencia text;
  v_cliente jsonb;
begin
  select * into v_link from public.cliente_onboardings where token = p_token;
  if v_link.id is null then
    raise exception 'Formulario no encontrado';
  end if;

  select o.nombre into v_agencia from public.organizaciones o where o.id = v_link.organizacion_id;

  -- Para completar un cliente existente se devuelven sus datos actuales para
  -- prerrellenar el formulario, filtrados a las columnas permitidas.
  if v_link.cliente_id is not null and v_link.estado = 'pendiente' then
    select jsonb_object_agg(k, v) into v_cliente
    from public.clientes c, jsonb_each(to_jsonb(c)) as e(k, v)
    where c.id = v_link.cliente_id
      and k = any(public.onboarding_columnas_permitidas());
  end if;

  return jsonb_build_object(
    'estado', v_link.estado,
    'expirado', v_link.expira_en < now(),
    'nombre_cliente', v_link.nombre_cliente,
    'agencia_nombre', v_agencia,
    'cliente', v_cliente
  );
end;
$$;

create or replace function public.enviar_onboarding_cliente(p_token uuid, p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.cliente_onboardings;
  v_datos jsonb;
  v_actual jsonb;
  v_fila public.clientes;
  v_cliente_id uuid;
begin
  select * into v_link from public.cliente_onboardings
  where token = p_token
  for update; -- row lock: evita doble envío en carrera

  if v_link.id is null then
    raise exception 'Formulario no encontrado';
  end if;
  if v_link.estado <> 'pendiente' then
    raise exception 'Este formulario ya no admite respuestas (estado: %)', v_link.estado;
  end if;
  if v_link.expira_en < now() then
    raise exception 'Este formulario ha caducado';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Datos inválidos';
  end if;
  -- la foto va como data URL JPEG ya reducida en el navegador; 600 KB cubre
  -- de sobra el formulario completo y corta cualquier payload abusivo
  if octet_length(p_datos::text) > 600000 then
    raise exception 'Los datos enviados son demasiado grandes';
  end if;

  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_datos
  from jsonb_each(p_datos) as e(k, v)
  where k = any(public.onboarding_columnas_permitidas());

  if coalesce(btrim(v_datos->>'nombre'), '') = '' then
    raise exception 'El nombre del negocio es obligatorio';
  end if;

  if v_link.cliente_id is null then
    -- Cliente nuevo: jsonb_populate_record convierte cada clave al tipo real
    -- de su columna (text, jsonb, text[]...), así no dependemos de conocerlos.
    v_fila := jsonb_populate_record(null::public.clientes,
      v_datos || jsonb_build_object('user_id', v_link.user_id, 'organizacion_id', v_link.organizacion_id));
    insert into public.clientes (
      user_id, organizacion_id, nombre, foto_url, sector, sector_custom, web,
      descripcion, diferencial, ubicacion, ticket_medio, audiencia, tono,
      tono_descripcion, energia, voz_genero, uso_emojis, estilo_texto, prohibido,
      redes, historial, fechas_clave, identidad_visual, texto_videos,
      videos_cliente, videos_referencia
    ) values (
      v_fila.user_id, v_fila.organizacion_id, v_fila.nombre, v_fila.foto_url, v_fila.sector, v_fila.sector_custom, v_fila.web,
      v_fila.descripcion, v_fila.diferencial, v_fila.ubicacion, v_fila.ticket_medio, v_fila.audiencia, v_fila.tono,
      v_fila.tono_descripcion, v_fila.energia, v_fila.voz_genero, v_fila.uso_emojis, v_fila.estilo_texto, v_fila.prohibido,
      v_fila.redes, v_fila.historial, v_fila.fechas_clave, v_fila.identidad_visual, v_fila.texto_videos,
      v_fila.videos_cliente, v_fila.videos_referencia
    )
    returning id into v_cliente_id;
  else
    -- Cliente existente: se mezcla sobre la fila actual, así una clave que no
    -- venga en el envío conserva su valor en vez de quedar a null.
    select to_jsonb(c) into v_actual from public.clientes c where c.id = v_link.cliente_id for update;
    if v_actual is null then
      raise exception 'El cliente de este formulario ya no existe';
    end if;
    v_fila := jsonb_populate_record(null::public.clientes, v_actual || v_datos);
    update public.clientes set
      nombre = v_fila.nombre, foto_url = v_fila.foto_url, sector = v_fila.sector,
      sector_custom = v_fila.sector_custom, web = v_fila.web, descripcion = v_fila.descripcion,
      diferencial = v_fila.diferencial, ubicacion = v_fila.ubicacion, ticket_medio = v_fila.ticket_medio,
      audiencia = v_fila.audiencia, tono = v_fila.tono, tono_descripcion = v_fila.tono_descripcion,
      energia = v_fila.energia, voz_genero = v_fila.voz_genero, uso_emojis = v_fila.uso_emojis,
      estilo_texto = v_fila.estilo_texto, prohibido = v_fila.prohibido, redes = v_fila.redes,
      historial = v_fila.historial, fechas_clave = v_fila.fechas_clave,
      identidad_visual = v_fila.identidad_visual, texto_videos = v_fila.texto_videos,
      videos_cliente = v_fila.videos_cliente, videos_referencia = v_fila.videos_referencia,
      updated_at = now()
    where id = v_link.cliente_id;
    v_cliente_id := v_link.cliente_id;
  end if;

  update public.cliente_onboardings
  set estado = 'completado', completado_en = now(), cliente_creado_id = v_cliente_id
  where id = v_link.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_onboarding_publico(uuid) from public;
revoke all on function public.enviar_onboarding_cliente(uuid, jsonb) from public;
grant execute on function public.get_onboarding_publico(uuid) to anon, authenticated;
grant execute on function public.enviar_onboarding_cliente(uuid, jsonb) to anon, authenticated;
