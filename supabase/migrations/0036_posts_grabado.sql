-- Aify: "grabado" compartido entre la hoja de rodaje de la app y el enlace
-- /rodaje/<token>. Hasta ahora cada uno lo guardaba en el localStorage de su
-- navegador, así que lo que marcaba quien graba no llegaba a la app.
-- Ahora vive en el propio post (grabado_en): el enlace lo marca a través de
-- una RPC security definer que solo toca posts del cliente y mes de ESE token,
-- y la app lo lee y lo escribe con su sesión normal.
--
-- Run this once in the Supabase SQL Editor before merging. Idempotente.

alter table public.calendario_posts add column if not exists grabado_en timestamptz;

-- ── Lectura pública: añade grabado_en a cada post ───────────────────────────

create or replace function public.get_hoja_rodaje_publica(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.hojas_rodaje;
  v_agencia text;
  v_cliente public.clientes;
  v_inicio date;
  v_posts jsonb;
  v_fechas jsonb;
begin
  select * into v_link from public.hojas_rodaje where token = p_token;
  if v_link.id is null then
    raise exception 'Enlace no encontrado';
  end if;

  select o.nombre into v_agencia from public.organizaciones o where o.id = v_link.organizacion_id;
  select * into v_cliente from public.clientes c where c.id = v_link.cliente_id;

  -- Un enlace revocado o caducado no enseña nada del rodaje
  if v_link.estado <> 'activo' or v_link.expira_en < now() then
    return jsonb_build_object(
      'estado', v_link.estado, 'expirado', v_link.expira_en < now(),
      'agencia_nombre', v_agencia, 'cliente_nombre', v_cliente.nombre
    );
  end if;

  v_inicio := make_date(v_link.anio, v_link.mes, 1);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'fecha', p.fecha, 'hora', p.hora, 'en_calendario', p.en_calendario,
    'titulo', p.titulo, 'concepto', p.concepto, 'formato', p.formato, 'red', p.red,
    'guion', p.guion, 'notas', p.notas,
    'aprobacion_estado', p.aprobacion_estado,
    'aprobacion_comentario', p.aprobacion_comentario,
    'grabado_en', p.grabado_en
  ) order by p.en_calendario, p.fecha, p.hora nulls last, p.creado_en), '[]'::jsonb)
  into v_posts
  from public.calendario_posts p
  where p.cliente_id = v_link.cliente_id
    and p.fecha >= v_inicio and p.fecha < (v_inicio + interval '1 month')
    and p.guion is not null
    and (not v_link.solo_aprobados or p.aprobacion_estado = 'aprobado');

  -- Días de grabación y edición marcados en el calendario del cliente (ese mes)
  select coalesce(jsonb_agg(jsonb_build_object('fecha', f.fecha, 'titulo', f.titulo) order by f.fecha), '[]'::jsonb)
  into v_fechas
  from public.fechas_marcadas f
  where f.cliente_id = v_link.cliente_id
    and f.fecha >= v_inicio and f.fecha < (v_inicio + interval '1 month')
    and f.titulo in ('Día de grabación', 'Edición');

  return jsonb_build_object(
    'estado', v_link.estado,
    'expirado', false,
    'agencia_nombre', v_agencia,
    'cliente_nombre', v_cliente.nombre,
    'cliente_sector', v_cliente.sector,
    'ubicacion', v_cliente.ubicacion,
    'google_maps', v_cliente.google_maps,
    'contacto_nombre', v_cliente.nombre_contacto,
    'contacto_telefono', v_cliente.telefono,
    'anio', v_link.anio,
    'mes', v_link.mes,
    'notas', v_link.notas,
    'solo_aprobados', v_link.solo_aprobados,
    'fechas', v_fechas,
    'posts', v_posts
  );
end;
$$;

revoke all on function public.get_hoja_rodaje_publica(uuid) from public;
grant execute on function public.get_hoja_rodaje_publica(uuid) to anon, authenticated;

-- ── Escritura pública: marcar / desmarcar un vídeo como grabado ─────────────
-- Solo con un enlace activo y sin caducar, y solo posts del cliente y mes del
-- enlace (los mismos que enseña get_hoja_rodaje_publica). Devuelve grabado_en.

create or replace function public.marcar_grabado_rodaje(p_token uuid, p_post_id uuid, p_grabado boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.hojas_rodaje;
  v_inicio date;
  v_resultado timestamptz;
begin
  select * into v_link from public.hojas_rodaje where token = p_token;
  if v_link.id is null or v_link.estado <> 'activo' or v_link.expira_en < now() then
    raise exception 'Enlace no válido';
  end if;
  v_inicio := make_date(v_link.anio, v_link.mes, 1);

  update public.calendario_posts p
  set grabado_en = case when p_grabado then coalesce(p.grabado_en, now()) else null end
  where p.id = p_post_id
    and p.cliente_id = v_link.cliente_id
    and p.fecha >= v_inicio and p.fecha < (v_inicio + interval '1 month')
    and p.guion is not null
    and (not v_link.solo_aprobados or p.aprobacion_estado = 'aprobado')
  returning p.grabado_en into v_resultado;

  if not found then
    raise exception 'Vídeo no encontrado en esta hoja de rodaje';
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.marcar_grabado_rodaje(uuid, uuid, boolean) from public;
grant execute on function public.marcar_grabado_rodaje(uuid, uuid, boolean) to anon, authenticated;
