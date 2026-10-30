-- Aify: guiones sin programar. Los guiones salen de las ideas guardadas en la
-- Lluvia de ideas y ya no entran al calendario al generarse: viven en Guiones
-- del mes (aprobación, planos, hoja de rodaje) y solo se programan en el
-- calendario después del día de grabación. Antes de grabar, lo único que hay
-- en el calendario es el propio día de grabación (fechas marcadas).
--
-- Se quedan en calendario_posts para no rehacer la aprobación (0019) ni la
-- producción, con en_calendario = false. Mientras no se programan, `fecha`
-- es el día 1 del mes del lote: sirve de ancla para las consultas por mes y
-- para el enlace de aprobación, pero no es una fecha de publicación.

alter table public.calendario_posts add column if not exists en_calendario boolean not null default true;

-- El feed .ics (0012) solo publica lo que está en el calendario
create or replace function public.get_calendar_feed(p_token uuid)
returns table (cliente_nombre text, post_id uuid, titulo text, concepto text, notas text, fecha date, hora time)
language sql security definer set search_path = public
as $$
  select c.nombre, p.id, p.titulo, p.concepto, p.notas, p.fecha, p.hora
  from public.clientes c
  left join public.calendario_posts p on p.cliente_id = c.id and p.en_calendario
  where c.feed_token = p_token
  order by p.fecha asc nulls last, p.hora asc nulls last;
$$;

revoke all on function public.get_calendar_feed(uuid) from public;
grant execute on function public.get_calendar_feed(uuid) to anon, authenticated;

-- La página pública de aprobación (0019) necesita saber si el guion tiene
-- fecha de verdad, para enseñar "Sin fecha" en vez del día 1 del mes
create or replace function public.get_aprobacion_guiones_publico(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.guion_aprobaciones;
  v_agencia text;
  v_cliente text;
  v_inicio date;
  v_posts jsonb;
begin
  select * into v_link from public.guion_aprobaciones where token = p_token;
  if v_link.id is null then
    raise exception 'Enlace no encontrado';
  end if;

  select o.nombre into v_agencia from public.organizaciones o where o.id = v_link.organizacion_id;
  select c.nombre into v_cliente from public.clientes c where c.id = v_link.cliente_id;

  -- Un enlace revocado o caducado no enseña los guiones
  if v_link.estado = 'activo' and v_link.expira_en >= now() then
    v_inicio := make_date(v_link.anio, v_link.mes, 1);
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'fecha', p.fecha, 'hora', p.hora, 'titulo', p.titulo,
      'formato', p.formato, 'red', p.red, 'guion', p.guion, 'en_calendario', p.en_calendario,
      'aprobacion_estado', p.aprobacion_estado,
      'aprobacion_comentario', p.aprobacion_comentario,
      'aprobacion_en', p.aprobacion_en
    ) order by p.fecha, p.hora nulls last, p.creado_en), '[]'::jsonb)
    into v_posts
    from public.calendario_posts p
    where p.cliente_id = v_link.cliente_id
      and p.fecha >= v_inicio and p.fecha < (v_inicio + interval '1 month')
      and p.guion is not null;
  end if;

  return jsonb_build_object(
    'estado', v_link.estado,
    'expirado', v_link.expira_en < now(),
    'agencia_nombre', v_agencia,
    'cliente_nombre', v_cliente,
    'anio', v_link.anio,
    'mes', v_link.mes,
    'posts', coalesce(v_posts, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_aprobacion_guiones_publico(uuid) from public;
grant execute on function public.get_aprobacion_guiones_publico(uuid) to anon, authenticated;
