-- Aify: guiones del mes con aprobación del cliente — el gestor manda a su
-- cliente un enlace con todos los guiones de vídeo de un mes (los posts del
-- calendario de ese cliente que ya tienen guion) y el cliente aprueba cada
-- uno o pide cambios con un comentario, sin cuenta de Aify.
--
-- Mismo modelo capability-token que el onboarding externo (0018) y la firma
-- de presupuestos (0002): el token largo e inadivinable de la URL ES la
-- autenticación. Ni la tabla de enlaces ni calendario_posts tienen acceso
-- anónimo por RLS; el visitante solo pasa por dos RPCs security definer que
-- únicamente leen/tocan los posts del cliente y mes de ESE token.

-- ── Estado de aprobación por post ────────────────────────────────────────────

alter table public.calendario_posts add column if not exists aprobacion_estado text
  check (aprobacion_estado in ('aprobado', 'cambios'));
alter table public.calendario_posts add column if not exists aprobacion_comentario text;
alter table public.calendario_posts add column if not exists aprobacion_en timestamptz;

-- Si el guion cambia (regenerado o editado), la aprobación era de otra
-- versión: vuelve a pendiente. El comentario se conserva para que el gestor
-- siga viendo qué pidió el cliente mientras lo corrige.
create or replace function public.resetear_aprobacion_guion()
returns trigger
language plpgsql
as $$
begin
  if NEW.guion is distinct from OLD.guion
     and NEW.aprobacion_estado is not distinct from OLD.aprobacion_estado then
    NEW.aprobacion_estado := null;
    NEW.aprobacion_en := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_resetear_aprobacion_guion on public.calendario_posts;
create trigger trg_resetear_aprobacion_guion before update on public.calendario_posts
  for each row execute function public.resetear_aprobacion_guion();

-- ── Enlaces de aprobación (uno por cliente y mes) ───────────────────────────

create table if not exists public.guion_aprobaciones (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  anio int not null check (anio between 2020 and 2100),
  mes int not null check (mes between 1 and 12),
  estado text not null default 'activo' check (estado in ('activo', 'revocado')),
  created_at timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '30 days',
  ultima_respuesta_en timestamptz
);

create index if not exists guion_aprobaciones_cliente_idx on public.guion_aprobaciones(cliente_id, anio, mes);
create index if not exists guion_aprobaciones_org_idx on public.guion_aprobaciones(organizacion_id);

alter table public.guion_aprobaciones enable row level security;

drop policy if exists "aprobaciones select" on public.guion_aprobaciones;
create policy "aprobaciones select" on public.guion_aprobaciones for select
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- Insert solo como uno mismo, en su organización y para un cliente visible
-- (mismo criterio que "onboardings insert" en 0018).
drop policy if exists "aprobaciones insert" on public.guion_aprobaciones;
create policy "aprobaciones insert" on public.guion_aprobaciones for insert
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
drop policy if exists "aprobaciones update" on public.guion_aprobaciones;
create policy "aprobaciones update" on public.guion_aprobaciones for update
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- ── RPCs públicas ────────────────────────────────────────────────────────────

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
      'formato', p.formato, 'red', p.red, 'guion', p.guion,
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

create or replace function public.responder_guion_publico(
  p_token uuid, p_post_id uuid, p_estado text, p_comentario text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.guion_aprobaciones;
  v_inicio date;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_post_id uuid;
begin
  select * into v_link from public.guion_aprobaciones where token = p_token;
  if v_link.id is null then
    raise exception 'Enlace no encontrado';
  end if;
  if v_link.estado <> 'activo' then
    raise exception 'Este enlace ya no está activo';
  end if;
  if v_link.expira_en < now() then
    raise exception 'Este enlace ha caducado';
  end if;
  if p_estado is null or p_estado not in ('aprobado', 'cambios') then
    raise exception 'Respuesta inválida';
  end if;
  if p_estado = 'cambios' and v_comentario is null then
    raise exception 'Cuéntanos qué cambiarías';
  end if;
  if length(coalesce(v_comentario, '')) > 2000 then
    raise exception 'El comentario es demasiado largo';
  end if;

  v_inicio := make_date(v_link.anio, v_link.mes, 1);
  update public.calendario_posts p
  set aprobacion_estado = p_estado,
      aprobacion_comentario = v_comentario,
      aprobacion_en = now()
  where p.id = p_post_id
    and p.cliente_id = v_link.cliente_id
    and p.fecha >= v_inicio and p.fecha < (v_inicio + interval '1 month')
    and p.guion is not null
  returning p.id into v_post_id;

  if v_post_id is null then
    raise exception 'Guion no encontrado';
  end if;

  update public.guion_aprobaciones set ultima_respuesta_en = now() where id = v_link.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_aprobacion_guiones_publico(uuid) from public;
revoke all on function public.responder_guion_publico(uuid, uuid, text, text) from public;
grant execute on function public.get_aprobacion_guiones_publico(uuid) to anon, authenticated;
grant execute on function public.responder_guion_publico(uuid, uuid, text, text) to anon, authenticated;
