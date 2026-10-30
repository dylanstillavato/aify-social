-- Aify: onboarding v2 (Fase 2) — el cuestionario del cliente pasa a 6 pasos
-- (Quién es, Qué hace, A quién vende, Cómo habla, Redes y ritmo, Fechas
-- importantes) y pregunta cosas nuevas: persona de contacto, email, teléfono,
-- Google Maps, enlaces a redes, por qué elegirlos, rango de precio, los 5 temas
-- del sector, barreras internas y externas, público objetivo, qué buscan,
-- competidores, cuentas de referencia y el ritmo de publicación.
--
-- Los pasos que salen del cuestionario (Historial y Vídeos de referencia) NO
-- tocan sus columnas: historial, videos_cliente y videos_referencia siguen
-- igual y la app las conserva al editar.
--
-- También se amplía el onboarding externo (0018_onboarding_externo.sql): la
-- lista de columnas permitidas y las listas fijas de insert/update del RPC
-- enviar_onboarding_cliente, copiadas tal cual de 0018 y con las columnas
-- nuevas añadidas al final.
--
-- Idempotente y aditivo: columnas nullable (o con default) y create or replace.

alter table public.clientes add column if not exists nombre_contacto text;
alter table public.clientes add column if not exists email text;
alter table public.clientes add column if not exists telefono text;
alter table public.clientes add column if not exists google_maps text;
-- { instagram, tiktok, facebook, youtube, linkedin, otra }: @usuario o enlace
alter table public.clientes add column if not exists redes_enlaces jsonb not null default '{}'::jsonb;
alter table public.clientes add column if not exists por_que_elegirnos text;
-- 'bajo' | 'medio' | 'alto' | 'premium'; ticket_medio se mantiene como texto libre
alter table public.clientes add column if not exists rango_precio text;
-- hasta 5 subtemas / pilares de contenido del sector, como array de textos
alter table public.clientes add column if not exists temas jsonb not null default '[]'::jsonb;
alter table public.clientes add column if not exists barreras_internas text;
alter table public.clientes add column if not exists barreras_externas text;
alter table public.clientes add column if not exists publico_objetivo text;
alter table public.clientes add column if not exists que_buscan text;
-- listas de nombres o enlaces
alter table public.clientes add column if not exists competidores jsonb not null default '[]'::jsonb;
alter table public.clientes add column if not exists referencias jsonb not null default '[]'::jsonb;
-- ritmo de publicación que elige el cliente (los formatos los decide la agencia)
alter table public.clientes add column if not exists frecuencia text
  check (frecuencia is null or frecuencia in ('tranquilo', 'equilibrado', 'diario'));

-- ── RPCs públicas del onboarding externo ─────────────────────────────────────

-- Mismas columnas que en 0018 + las del onboarding v2. Sigue sin
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
    'texto_videos', 'videos_cliente', 'videos_referencia',
    'nombre_contacto', 'email', 'telefono', 'google_maps', 'redes_enlaces',
    'por_que_elegirnos', 'rango_precio', 'temas', 'barreras_internas',
    'barreras_externas', 'publico_objetivo', 'que_buscan', 'competidores',
    'referencias', 'frecuencia'
  ]::text[];
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
    -- Las columnas jsonb con default ('{}' / '[]') se rellenan con coalesce
    -- porque el record parte de null y no hereda los defaults de la tabla.
    v_fila := jsonb_populate_record(null::public.clientes,
      v_datos || jsonb_build_object('user_id', v_link.user_id, 'organizacion_id', v_link.organizacion_id));
    insert into public.clientes (
      user_id, organizacion_id, nombre, foto_url, sector, sector_custom, web,
      descripcion, diferencial, ubicacion, ticket_medio, audiencia, tono,
      tono_descripcion, energia, voz_genero, uso_emojis, estilo_texto, prohibido,
      redes, historial, fechas_clave, identidad_visual, texto_videos,
      videos_cliente, videos_referencia,
      nombre_contacto, email, telefono, google_maps, redes_enlaces,
      por_que_elegirnos, rango_precio, temas, barreras_internas, barreras_externas,
      publico_objetivo, que_buscan, competidores, referencias, frecuencia
    ) values (
      v_fila.user_id, v_fila.organizacion_id, v_fila.nombre, v_fila.foto_url, v_fila.sector, v_fila.sector_custom, v_fila.web,
      v_fila.descripcion, v_fila.diferencial, v_fila.ubicacion, v_fila.ticket_medio, v_fila.audiencia, v_fila.tono,
      v_fila.tono_descripcion, v_fila.energia, v_fila.voz_genero, v_fila.uso_emojis, v_fila.estilo_texto, v_fila.prohibido,
      v_fila.redes, v_fila.historial, v_fila.fechas_clave, v_fila.identidad_visual, v_fila.texto_videos,
      v_fila.videos_cliente, v_fila.videos_referencia,
      v_fila.nombre_contacto, v_fila.email, v_fila.telefono, v_fila.google_maps, coalesce(v_fila.redes_enlaces, '{}'::jsonb),
      v_fila.por_que_elegirnos, v_fila.rango_precio, coalesce(v_fila.temas, '[]'::jsonb), v_fila.barreras_internas, v_fila.barreras_externas,
      v_fila.publico_objetivo, v_fila.que_buscan, coalesce(v_fila.competidores, '[]'::jsonb), coalesce(v_fila.referencias, '[]'::jsonb), v_fila.frecuencia
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
      nombre_contacto = v_fila.nombre_contacto, email = v_fila.email, telefono = v_fila.telefono,
      google_maps = v_fila.google_maps, redes_enlaces = coalesce(v_fila.redes_enlaces, '{}'::jsonb),
      por_que_elegirnos = v_fila.por_que_elegirnos, rango_precio = v_fila.rango_precio,
      temas = coalesce(v_fila.temas, '[]'::jsonb), barreras_internas = v_fila.barreras_internas,
      barreras_externas = v_fila.barreras_externas, publico_objetivo = v_fila.publico_objetivo,
      que_buscan = v_fila.que_buscan, competidores = coalesce(v_fila.competidores, '[]'::jsonb),
      referencias = coalesce(v_fila.referencias, '[]'::jsonb), frecuencia = v_fila.frecuencia,
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

revoke all on function public.enviar_onboarding_cliente(uuid, jsonb) from public;
grant execute on function public.enviar_onboarding_cliente(uuid, jsonb) to anon, authenticated;
