-- Aify: revisión de vídeos con comentarios en el segundo exacto (estilo Frame.io),
-- para el portal del cliente. Lo usa primero el estudio de SOLD OUT
-- (soldout.useaify.app), pero es genérico: cualquier organización puede usarlo.
--
-- 1) video_revisiones: una fila por versión de un vídeo que el equipo sube para
--    que el cliente lo revise (v1, v2…). Puede ir ligada a un post del calendario.
--    estado: pendiente → cambios | aprobado.
-- 2) video_comentarios: cada comentario lleva el segundo del vídeo en el que se
--    dejó (p. ej. 12,4 s → «0:12»). Los deja el cliente desde el portal o el
--    equipo desde la app; el equipo los marca como resueltos.
-- 3) Bucket «revisiones» PÚBLICO de solo lectura por URL: la ruta lleva ids
--    inadivinables (<org>/<cliente>/<revision>.mp4) y no hay política de select
--    para anon, así que nadie puede listar el bucket. Solo el equipo de la
--    organización sube y borra.
-- 4) RPCs del portal con el MISMO token de cliente_portales (0021): el token de
--    la URL es la autenticación, igual que el resto de enlaces públicos.
--    - get_portal_studio(token): cliente, vídeos con sus comentarios, guiones
--      del mes, calendario y métricas a 24 h de los últimos reels.
--    - comentar_video_portal(token, revision, segundo, texto, nombre)
--    - responder_video_portal(token, revision, 'aprobado'|'cambios', comentario)
--    - responder_guion_portal(token, post, 'aprobado'|'cambios', comentario)
--
-- Pégalo en Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.

-- ── 1) Versiones de vídeo ─────────────────────────────────────────────────────

create table if not exists public.video_revisiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  post_id uuid references public.calendario_posts(id) on delete set null,
  titulo text not null,
  version int not null default 1 check (version between 1 and 99),
  ruta text not null,                       -- ruta en el bucket «revisiones»
  duracion numeric(8, 2),                   -- segundos
  portada text,                             -- ruta opcional de una imagen
  nota text,                                -- nota del equipo para el cliente
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cambios', 'aprobado')),
  respuesta_comentario text,
  respondido_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists video_revisiones_cliente_idx on public.video_revisiones(cliente_id, created_at desc);
create index if not exists video_revisiones_post_idx on public.video_revisiones(post_id);
create index if not exists video_revisiones_org_idx on public.video_revisiones(organizacion_id);

alter table public.video_revisiones enable row level security;

drop policy if exists "revisiones select" on public.video_revisiones;
create policy "revisiones select" on public.video_revisiones for select
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

drop policy if exists "revisiones insert" on public.video_revisiones;
create policy "revisiones insert" on public.video_revisiones for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    )
  );

drop policy if exists "revisiones update" on public.video_revisiones;
create policy "revisiones update" on public.video_revisiones for update
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

drop policy if exists "revisiones delete" on public.video_revisiones;
create policy "revisiones delete" on public.video_revisiones for delete
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- ── 2) Comentarios con segundo ────────────────────────────────────────────────

create table if not exists public.video_comentarios (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.video_revisiones(id) on delete cascade,
  segundo numeric(8, 2) not null check (segundo >= 0),
  texto text not null check (length(btrim(texto)) between 1 and 2000),
  autor text not null check (autor in ('cliente', 'equipo')),
  autor_nombre text,
  user_id uuid references auth.users(id) on delete set null,   -- solo si lo deja el equipo
  resuelto boolean not null default false,
  resuelto_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists video_comentarios_revision_idx on public.video_comentarios(revision_id, segundo);

alter table public.video_comentarios enable row level security;

-- El equipo ve y gestiona los comentarios de las revisiones que puede ver.
drop policy if exists "comentarios select" on public.video_comentarios;
create policy "comentarios select" on public.video_comentarios for select
  using (exists (select 1 from public.video_revisiones r where r.id = revision_id));

drop policy if exists "comentarios insert" on public.video_comentarios;
create policy "comentarios insert" on public.video_comentarios for insert
  with check (
    autor = 'equipo' and user_id = auth.uid()
    and exists (select 1 from public.video_revisiones r where r.id = revision_id)
  );

drop policy if exists "comentarios update" on public.video_comentarios;
create policy "comentarios update" on public.video_comentarios for update
  using (exists (select 1 from public.video_revisiones r where r.id = revision_id));

drop policy if exists "comentarios delete" on public.video_comentarios;
create policy "comentarios delete" on public.video_comentarios for delete
  using (exists (select 1 from public.video_revisiones r where r.id = revision_id));

-- Si el equipo sube una versión nueva del mismo post, la anterior deja de
-- estar pendiente para el cliente (la ve como «versión anterior»).

-- ── 3) Bucket «revisiones» ────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('revisiones', 'revisiones', true, null, array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "revisiones insert org" on storage.objects;
create policy "revisiones insert org" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'revisiones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

drop policy if exists "revisiones update org" on storage.objects;
create policy "revisiones update org" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'revisiones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

drop policy if exists "revisiones delete org" on storage.objects;
create policy "revisiones delete org" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'revisiones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

-- El equipo puede listar lo de su organización (la app); anon no tiene select.
drop policy if exists "revisiones select org" on storage.objects;
create policy "revisiones select org" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'revisiones'
    and (storage.foldername(name))[1] = public.mi_organizacion_id()::text
  );

-- ── 4) RPCs del portal ────────────────────────────────────────────────────────

create or replace function public.portal_activo(p_token uuid)
returns public.cliente_portales
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_portal public.cliente_portales;
begin
  select * into v_portal from public.cliente_portales where token = p_token;
  if v_portal.id is null then
    raise exception 'Portal no encontrado';
  end if;
  if v_portal.estado <> 'activo' then
    raise exception 'Este portal ya no está activo';
  end if;
  return v_portal;
end;
$$;
revoke all on function public.portal_activo(uuid) from public;

create or replace function public.get_portal_studio(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portal public.cliente_portales;
  v_agencia text;
  v_cliente jsonb;
  v_videos jsonb;
  v_posts jsonb;
  v_reels jsonb;
  v_inicio date := date_trunc('month', now())::date;
begin
  select * into v_portal from public.cliente_portales where token = p_token;
  if v_portal.id is null then
    raise exception 'Portal no encontrado';
  end if;

  select o.nombre into v_agencia
  from public.organizaciones o
  where o.id = coalesce(v_portal.organizacion_id,
    (select c.organizacion_id from public.clientes c where c.id = v_portal.cliente_id));

  if v_portal.estado <> 'activo' then
    return jsonb_build_object('estado', v_portal.estado, 'agencia_nombre', v_agencia);
  end if;

  select jsonb_build_object(
    'nombre', c.nombre,
    'sector', c.sector,
    'logo', c.identidad_visual->>'logo',
    'colores', jsonb_build_object(
      'colorPrimario', c.identidad_visual->>'colorPrimario',
      'colorSecundario', c.identidad_visual->>'colorSecundario')
  ) into v_cliente
  from public.clientes c where c.id = v_portal.cliente_id;

  -- Vídeos: todas las versiones (las más recientes primero), con sus comentarios.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'post_id', r.post_id, 'titulo', r.titulo, 'version', r.version,
    'ruta', r.ruta, 'portada', r.portada, 'duracion', r.duracion, 'nota', r.nota,
    'estado', r.estado, 'respuesta_comentario', r.respuesta_comentario,
    'respondido_en', r.respondido_en, 'created_at', r.created_at,
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'segundo', k.segundo, 'texto', k.texto, 'autor', k.autor,
        'autor_nombre', k.autor_nombre, 'resuelto', k.resuelto, 'created_at', k.created_at
      ) order by k.segundo, k.created_at)
      from public.video_comentarios k where k.revision_id = r.id), '[]'::jsonb)
  ) order by r.created_at desc), '[]'::jsonb)
  into v_videos
  from public.video_revisiones r
  where r.cliente_id = v_portal.cliente_id;

  -- Calendario del mes pasado, este y el siguiente (sin notas internas).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'fecha', p.fecha, 'hora', p.hora, 'titulo', p.titulo,
    'formato', p.formato, 'red', p.red, 'guion', p.guion,
    'aprobacion_estado', p.aprobacion_estado,
    'aprobacion_comentario', p.aprobacion_comentario,
    'grabado_en', p.grabado_en
  ) order by p.fecha, p.hora nulls last), '[]'::jsonb)
  into v_posts
  from public.calendario_posts p
  where p.cliente_id = v_portal.cliente_id
    and p.fecha >= (v_inicio - interval '1 month')
    and p.fecha < (v_inicio + interval '2 months');

  -- Resultados: los últimos 24 reels con su foto a 24 h.
  select coalesce(jsonb_agg(x order by x->>'publicado_en' desc), '[]'::jsonb)
  into v_reels
  from (
    select jsonb_build_object(
      'publicado_en', m.publicado_en, 'enlace', m.enlace, 'texto', m.texto,
      'visualizaciones', m.visualizaciones, 'alcance', m.alcance,
      'me_gusta', m.me_gusta, 'comentarios', m.comentarios,
      'guardados', m.guardados, 'compartidos', m.compartidos,
      'visto_medio_ms', m.visto_medio_ms, 'saltos', m.saltos
    ) as x
    from public.instagram_reels_24h m
    where m.cliente_id = v_portal.cliente_id
    order by m.publicado_en desc
    limit 24
  ) s;

  return jsonb_build_object(
    'estado', 'activo',
    'agencia_nombre', v_agencia,
    'cliente', v_cliente,
    'videos', v_videos,
    'posts', v_posts,
    'reels', v_reels
  );
end;
$$;

create or replace function public.comentar_video_portal(
  p_token uuid, p_revision_id uuid, p_segundo numeric, p_texto text, p_nombre text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portal public.cliente_portales;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_id uuid;
begin
  v_portal := public.portal_activo(p_token);
  if v_texto is null then raise exception 'Escribe el comentario'; end if;
  if length(v_texto) > 2000 then raise exception 'El comentario es demasiado largo'; end if;
  if p_segundo is null or p_segundo < 0 then raise exception 'Segundo inválido'; end if;
  if not exists (select 1 from public.video_revisiones r
                 where r.id = p_revision_id and r.cliente_id = v_portal.cliente_id) then
    raise exception 'Vídeo no encontrado';
  end if;

  insert into public.video_comentarios (revision_id, segundo, texto, autor, autor_nombre)
  values (p_revision_id, round(p_segundo, 2), v_texto, 'cliente', left(nullif(btrim(coalesce(p_nombre, '')), ''), 80))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.responder_video_portal(
  p_token uuid, p_revision_id uuid, p_estado text, p_comentario text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portal public.cliente_portales;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_id uuid;
begin
  v_portal := public.portal_activo(p_token);
  if p_estado is null or p_estado not in ('aprobado', 'cambios') then raise exception 'Respuesta inválida'; end if;
  if length(coalesce(v_comentario, '')) > 2000 then raise exception 'El comentario es demasiado largo'; end if;

  update public.video_revisiones r
  set estado = p_estado, respuesta_comentario = v_comentario, respondido_en = now()
  where r.id = p_revision_id and r.cliente_id = v_portal.cliente_id
  returning r.id into v_id;

  if v_id is null then raise exception 'Vídeo no encontrado'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.responder_guion_portal(
  p_token uuid, p_post_id uuid, p_estado text, p_comentario text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portal public.cliente_portales;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_id uuid;
begin
  v_portal := public.portal_activo(p_token);
  if p_estado is null or p_estado not in ('aprobado', 'cambios') then raise exception 'Respuesta inválida'; end if;
  if p_estado = 'cambios' and v_comentario is null then raise exception 'Cuéntanos qué cambiarías'; end if;
  if length(coalesce(v_comentario, '')) > 2000 then raise exception 'El comentario es demasiado largo'; end if;

  update public.calendario_posts p
  set aprobacion_estado = p_estado, aprobacion_comentario = v_comentario, aprobacion_en = now()
  where p.id = p_post_id and p.cliente_id = v_portal.cliente_id and p.guion is not null
  returning p.id into v_id;

  if v_id is null then raise exception 'Guion no encontrado'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_portal_studio(uuid) from public;
revoke all on function public.comentar_video_portal(uuid, uuid, numeric, text, text) from public;
revoke all on function public.responder_video_portal(uuid, uuid, text, text) from public;
revoke all on function public.responder_guion_portal(uuid, uuid, text, text) from public;
grant execute on function public.get_portal_studio(uuid) to anon, authenticated;
grant execute on function public.comentar_video_portal(uuid, uuid, numeric, text, text) to anon, authenticated;
grant execute on function public.responder_video_portal(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.responder_guion_portal(uuid, uuid, text, text) to anon, authenticated;
