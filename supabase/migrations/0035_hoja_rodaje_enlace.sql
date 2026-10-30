-- Aify: hoja de rodaje compartible por enlace (/rodaje/<token>).
-- El gestor manda un enlace (al cliente, al cámara o a quien grabe) con la
-- hoja de rodaje del mes organizada vídeo a vídeo: día de grabación, dónde,
-- contacto, material, y por cada vídeo el texto completo que se dice, los
-- planos en orden, duración, audio y lo que pidió el cliente al aprobarlo.
--
-- Mismo modelo capability-token que la aprobación de guiones (0019): el token
-- de la URL es la autenticación. Solo lectura: el visitante pasa por una RPC
-- security definer que únicamente lee el cliente y mes de ESE token.
--
-- Run this once in the Supabase SQL Editor before merging. Idempotente.

create table if not exists public.hojas_rodaje (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  anio int not null check (anio between 2020 and 2100),
  mes int not null check (mes between 1 and 12),
  -- Material y notas del día (las de la hoja de rodaje de la app)
  notas text,
  -- true = solo los guiones aprobados por el cliente
  solo_aprobados boolean not null default true,
  estado text not null default 'activo' check (estado in ('activo', 'revocado')),
  created_at timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '60 days'
);

create index if not exists hojas_rodaje_cliente_idx on public.hojas_rodaje(cliente_id, anio, mes);
create index if not exists hojas_rodaje_org_idx on public.hojas_rodaje(organizacion_id);

alter table public.hojas_rodaje enable row level security;

drop policy if exists "hojas rodaje select" on public.hojas_rodaje;
create policy "hojas rodaje select" on public.hojas_rodaje for select
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

drop policy if exists "hojas rodaje insert" on public.hojas_rodaje;
create policy "hojas rodaje insert" on public.hojas_rodaje for insert
  with check (
    user_id = auth.uid()
    and (organizacion_id is null or organizacion_id = public.mi_organizacion_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id
        and (c.user_id = auth.uid() or (c.organizacion_id is not null and c.organizacion_id = public.mi_organizacion_id()))
    )
  );

-- Update para actualizar las notas / el filtro y para revocar desde la app
drop policy if exists "hojas rodaje update" on public.hojas_rodaje;
create policy "hojas rodaje update" on public.hojas_rodaje for update
  using (user_id = auth.uid() or (organizacion_id is not null and organizacion_id = public.mi_organizacion_id()));

-- ── RPC pública ──────────────────────────────────────────────────────────────

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
    'aprobacion_comentario', p.aprobacion_comentario
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
