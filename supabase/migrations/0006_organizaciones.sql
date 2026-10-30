-- (Versión pública: los correos reales de la instalación original se han cambiado por correos de ejemplo.)
-- Aify: organizaciones/equipos (plan Agency real) — permite que varias cuentas
-- compartan el mismo conjunto de clientes bajo una misma organización.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- Diseño: modelo aditivo. No se toca ni una sola política RLS existente —
-- solo se AÑADEN políticas nuevas que amplían el acceso a compañeros de
-- organización a través de clientes.organizacion_id. Postgres combina
-- políticas permisivas con OR, así que esto solo puede ampliar acceso,
-- nunca romper el que ya funciona hoy (auth.uid() = user_id).
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero tantas
-- veces como haga falta (create table/policy usan "if not exists" o se
-- borran antes de recrearse, y el seed final comprueba si ya se aplicó).
--
-- IMPORTANTE — recursión en RLS: una política sobre organizacion_miembros
-- que consulta la propia tabla organizacion_miembros en su USING/WITH CHECK
-- provoca "infinite recursion detected in policy for relation
-- organizacion_miembros" en Postgres (para evaluar la política de una fila
-- hay que ejecutar la subconsulta, que a su vez vuelve a aplicar la misma
-- política sobre sus propias filas, sin fin) — y como varias políticas de
-- otras tablas también consultaban organizacion_miembros, el error se
-- propagaba a casi toda la app. Se soluciona con dos funciones `security
-- definer`: al ejecutarse con los privilegios de su dueño, su consulta
-- interna a organizacion_miembros NO vuelve a aplicar RLS, así que puede
-- usarse dentro de cualquier política sin recursión.

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  plan text not null default 'freelance', -- freelance | agency
  creada_en timestamptz not null default now()
);

create table if not exists public.organizacion_miembros (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  rol text not null default 'owner', -- owner | member
  unido_en timestamptz not null default now(),
  unique (organizacion_id, user_id),
  unique (user_id) -- modelo: un usuario pertenece como mucho a una organización
);

create table if not exists public.organizacion_invitaciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  creada_por uuid not null references auth.users(id),
  usada boolean not null default false,
  usada_por uuid references auth.users(id),
  usada_en timestamptz,
  creada_en timestamptz not null default now()
);

alter table public.clientes add column if not exists organizacion_id uuid references public.organizaciones(id) on delete set null;
create index if not exists clientes_organizacion_idx on public.clientes(organizacion_id);

-- ── Funciones helper (evitan la recursión de RLS descrita arriba) ──────────

create or replace function public.mi_organizacion_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organizacion_id from public.organizacion_miembros where user_id = auth.uid() limit 1
$$;

create or replace function public.soy_owner_org()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.organizacion_miembros where user_id = auth.uid() and rol = 'owner')
$$;

revoke all on function public.mi_organizacion_id() from public;
revoke all on function public.soy_owner_org() from public;
grant execute on function public.mi_organizacion_id() to authenticated;
grant execute on function public.soy_owner_org() to authenticated;

-- ── RLS: tablas nuevas ────────────────────────────────────────────────────

alter table public.organizaciones enable row level security;
alter table public.organizacion_miembros enable row level security;
alter table public.organizacion_invitaciones enable row level security;

drop policy if exists "org members can view org" on public.organizaciones;
create policy "org members can view org" on public.organizaciones for select
  using (id = public.mi_organizacion_id());

drop policy if exists "org owner can update org" on public.organizaciones;
create policy "org owner can update org" on public.organizaciones for update
  using (id = public.mi_organizacion_id() and public.soy_owner_org());

-- SEGURIDAD (revisión posterior): NO se deja una política de INSERT directa
-- ni en organizaciones ni en organizacion_miembros para el cliente. La
-- versión anterior de este archivo tenía:
--   create policy "authenticated can create org" ... with check (auth.uid() is not null)
--   create policy "self can join as member" ... with check (user_id = auth.uid())
-- La segunda solo comprobaba QUIÉN se inserta, nunca A QUÉ organización — un
-- usuario autenticado cualquiera podía hacer, directamente contra la tabla
-- (sin pasar por la app ni por ningún RPC):
--   insert into organizacion_miembros (organizacion_id, user_id, email, rol)
--   values ('<uuid de la org de otro>', auth.uid(), 'x@x.com', 'owner')
-- y unirse como OWNER a la organización de cualquier otra persona sin
-- invitación, siempre que llegara a conocer su organizacion_id (un uuid
-- aleatorio no es adivinable a ciegas, pero la política en sí era incorrecta
-- como control de acceso — no debía depender solo de que el uuid no se
-- adivine). El bootstrap de "organización personal" (el único caso legítimo
-- de insert directo) se mueve por completo a un RPC `security definer`
-- (bootstrap_organizacion_personal, más abajo) que crea la organización Y la
-- membresía en un solo paso atómico bajo privilegios elevados — así ninguna
-- de las dos tablas necesita una política de insert accesible desde el
-- cliente. El único otro camino para entrar en la organización de otra
-- persona sigue siendo aceptar_invitacion_organizacion, también security
-- definer, más abajo. (De regalo, el RPC atómico también evita la carrera de
-- useOrganizacion.js donde dos pestañas abriendo la app a la vez podían
-- crear dos organizaciones "personales" huérfanas para el mismo usuario.)

drop policy if exists "authenticated can create org" on public.organizaciones;

drop policy if exists "org members can view membership" on public.organizacion_miembros;
create policy "org members can view membership" on public.organizacion_miembros for select
  using (organizacion_id = public.mi_organizacion_id());

drop policy if exists "self can join as member" on public.organizacion_miembros;

-- Bootstrap atómico: crea la organización personal (plan freelance) y la
-- membresía de owner en un solo paso, bajo security definer, para el primer
-- login de cada usuario. Si el usuario ya es miembro de alguna organización
-- (la suya u otra a la que se unió por invitación), no hace nada y devuelve
-- la que ya tiene. Atrapa unique_violation por si dos llamadas concurrentes
-- del mismo usuario (doble pestaña, doble montaje) compiten por crear la
-- membresía a la vez — unique(user_id) en organizacion_miembros garantiza
-- que solo una gana, y la otra simplemente relee y devuelve esa.
create or replace function public.bootstrap_organizacion_personal(p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_existente uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select organizacion_id into v_existente from public.organizacion_miembros where user_id = auth.uid();
  if v_existente is not null then
    return jsonb_build_object('organizacion_id', v_existente, 'creada', false);
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.organizaciones (nombre, plan)
    values (coalesce(nullif(trim(p_nombre), ''), 'Mi organización'), 'freelance')
    returning id into v_org_id;

  insert into public.organizacion_miembros (organizacion_id, user_id, email, rol)
    values (v_org_id, auth.uid(), v_email, 'owner');

  return jsonb_build_object('organizacion_id', v_org_id, 'creada', true);
exception
  when unique_violation then
    select organizacion_id into v_existente from public.organizacion_miembros where user_id = auth.uid();
    return jsonb_build_object('organizacion_id', v_existente, 'creada', false);
end;
$$;

revoke all on function public.bootstrap_organizacion_personal(text) from public;
grant execute on function public.bootstrap_organizacion_personal(text) to authenticated;

drop policy if exists "org members can view invitaciones" on public.organizacion_invitaciones;
create policy "org members can view invitaciones" on public.organizacion_invitaciones for select
  using (organizacion_id = public.mi_organizacion_id());

drop policy if exists "org owner can create invitaciones" on public.organizacion_invitaciones;
create policy "org owner can create invitaciones" on public.organizacion_invitaciones for insert
  with check (
    creada_por = auth.uid()
    and organizacion_id = public.mi_organizacion_id()
    and public.soy_owner_org()
  );

-- ── RLS aditiva: contenido compartido dentro de la organización ────────────
-- Se añade select/insert/update para compañeros de organización vía
-- clientes.organizacion_id. Delete se deja fuera a propósito en esta pasada
-- (solo el user_id original puede borrar), para reducir el radio de un error
-- de un miembro nuevo del equipo.
--
-- SEGURIDAD (revisión posterior): las 6 políticas "org members can insert
-- <tabla>" de más abajo llevan también "and user_id = auth.uid()", que no
-- estaba en la versión anterior. Sin esa condición, como las políticas
-- permisivas se combinan con OR junto a la política preexistente ("own ...
-- insert" con check auth.uid() = user_id), un miembro de la organización
-- podía insertar una fila (cliente, idea, post, tarea, factura o
-- presupuesto) con un user_id arbitrario — el suyo, el de un compañero, o
-- incluso el de alguien que no pertenece a la organización — porque la
-- política de organización nunca miraba esa columna. No abre acceso a datos
-- ajenos (el radio sigue limitado a la propia organización), pero permitía
-- falsificar la autoría de un registro, lo cual importa sobre todo en
-- facturas/presupuestos (rastro de quién creó qué) y también interactúa mal
-- con el borrado, que sigue restringido a "solo el user_id original" — un
-- miembro podía sin querer (o a propósito) dejar un registro que ya nadie en
-- el equipo puede borrar, si lo inserta con el user_id de alguien ajeno a la
-- organización.

drop policy if exists "org members can select clientes" on public.clientes;
create policy "org members can select clientes" on public.clientes for select
  using (organizacion_id is not null and organizacion_id = public.mi_organizacion_id());
drop policy if exists "org members can insert clientes" on public.clientes;
create policy "org members can insert clientes" on public.clientes for insert
  with check (organizacion_id is not null and organizacion_id = public.mi_organizacion_id() and user_id = auth.uid());
drop policy if exists "org members can update clientes" on public.clientes;
create policy "org members can update clientes" on public.clientes for update
  using (organizacion_id is not null and organizacion_id = public.mi_organizacion_id());

drop policy if exists "org members can select ideas" on public.ideas;
create policy "org members can select ideas" on public.ideas for select
  using (cliente_id is not null and exists (
    select 1 from public.clientes c where c.id = ideas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can insert ideas" on public.ideas;
create policy "org members can insert ideas" on public.ideas for insert
  with check (cliente_id is not null and user_id = auth.uid() and exists (
    select 1 from public.clientes c where c.id = ideas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can update ideas" on public.ideas;
create policy "org members can update ideas" on public.ideas for update
  using (cliente_id is not null and exists (
    select 1 from public.clientes c where c.id = ideas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can select posts" on public.calendario_posts;
create policy "org members can select posts" on public.calendario_posts for select
  using (exists (
    select 1 from public.clientes c where c.id = calendario_posts.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can insert posts" on public.calendario_posts;
create policy "org members can insert posts" on public.calendario_posts for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.clientes c where c.id = calendario_posts.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can update posts" on public.calendario_posts;
create policy "org members can update posts" on public.calendario_posts for update
  using (exists (
    select 1 from public.clientes c where c.id = calendario_posts.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can select tareas" on public.tareas;
create policy "org members can select tareas" on public.tareas for select
  using (cliente_id is not null and exists (
    select 1 from public.clientes c where c.id = tareas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can insert tareas" on public.tareas;
create policy "org members can insert tareas" on public.tareas for insert
  with check (cliente_id is not null and user_id = auth.uid() and exists (
    select 1 from public.clientes c where c.id = tareas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can update tareas" on public.tareas;
create policy "org members can update tareas" on public.tareas for update
  using (cliente_id is not null and exists (
    select 1 from public.clientes c where c.id = tareas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can select facturas" on public.facturas;
create policy "org members can select facturas" on public.facturas for select
  using (exists (
    select 1 from public.clientes c where c.id = facturas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can insert facturas" on public.facturas;
create policy "org members can insert facturas" on public.facturas for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.clientes c where c.id = facturas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can update facturas" on public.facturas;
create policy "org members can update facturas" on public.facturas for update
  using (exists (
    select 1 from public.clientes c where c.id = facturas.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

drop policy if exists "org members can select presupuestos" on public.presupuestos;
create policy "org members can select presupuestos" on public.presupuestos for select
  using (exists (
    select 1 from public.clientes c where c.id = presupuestos.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can insert presupuestos" on public.presupuestos;
create policy "org members can insert presupuestos" on public.presupuestos for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.clientes c where c.id = presupuestos.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));
drop policy if exists "org members can update presupuestos" on public.presupuestos;
create policy "org members can update presupuestos" on public.presupuestos for update
  using (exists (
    select 1 from public.clientes c where c.id = presupuestos.cliente_id and c.organizacion_id = public.mi_organizacion_id()
  ));

-- ── RPCs: invitaciones (mismo patrón capability-token que 0002_facturas_presupuestos.sql) ──

create or replace function public.get_invitacion_publica(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'organizacion_nombre', o.nombre,
    'usada', i.usada
  ) into v_result
  from public.organizacion_invitaciones i
  join public.organizaciones o on o.id = i.organizacion_id
  where i.token = p_token;

  if v_result is null then
    raise exception 'Invitación no encontrada';
  end if;

  return v_result;
end;
$$;

create or replace function public.aceptar_invitacion_organizacion(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitacion_id uuid;
  v_org_id uuid;
  v_usada boolean;
  v_org_nombre text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación';
  end if;

  select id, organizacion_id, usada into v_invitacion_id, v_org_id, v_usada
  from public.organizacion_invitaciones
  where token = p_token
  for update;

  if v_invitacion_id is null then
    raise exception 'Invitación no encontrada';
  end if;
  if v_usada then
    raise exception 'Esta invitación ya se usó';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  -- modelo un-usuario-una-org: si ya pertenecía a otra, sale de ella primero
  delete from public.organizacion_miembros where user_id = auth.uid();

  insert into public.organizacion_miembros (organizacion_id, user_id, email, rol)
  values (v_org_id, auth.uid(), v_email, 'member');

  update public.organizacion_invitaciones set usada = true, usada_por = auth.uid(), usada_en = now()
  where id = v_invitacion_id;

  select nombre into v_org_nombre from public.organizaciones where id = v_org_id;
  return jsonb_build_object('ok', true, 'organizacion_id', v_org_id, 'organizacion_nombre', v_org_nombre);
end;
$$;

revoke all on function public.get_invitacion_publica(uuid) from public;
revoke all on function public.aceptar_invitacion_organizacion(uuid) from public;
grant execute on function public.get_invitacion_publica(uuid) to anon, authenticated;
grant execute on function public.aceptar_invitacion_organizacion(uuid) to authenticated;

-- ── Seed: organización Agency compartida para las dos cuentas conocidas ────
-- Si alguno de los dos emails no existe todavía, se avisa con raise notice
-- (no exception) para no bloquear el resto de la migración. Si dylan ya
-- tiene una membresía (por una ejecución anterior de este archivo), no
-- vuelve a crear nada — evita duplicar la organización o violar el
-- unique(user_id) de organizacion_miembros al repetir la ejecución.

do $$
declare
  v_org_id uuid;
  v_user_dylan uuid;
  v_user_alex uuid;
  v_ya_miembro uuid;
begin
  select id into v_user_dylan from auth.users where email = 'propietario@example.com';
  select id into v_user_alex  from auth.users where email = 'miembro@example.com';

  if v_user_dylan is null then
    raise notice 'Usuario propietario@example.com no encontrado, se omite el seed de organizacion';
    return;
  end if;

  select organizacion_id into v_ya_miembro from public.organizacion_miembros where user_id = v_user_dylan;

  if v_ya_miembro is not null then
    raise notice 'propietario@example.com ya pertenece a una organizacion (%), no se repite el seed', v_ya_miembro;
    -- Por si acaso una ejecución anterior creó la organización y la membresía
    -- pero no llegó a marcarla como agency o a hacer el backfill de clientes
    -- (p.ej. si el script se cortó justo aquí antes), lo dejamos en el estado
    -- correcto de todas formas — no hace daño repetir estas dos líneas.
    update public.organizaciones set plan = 'agency' where id = v_ya_miembro;
    update public.clientes set organizacion_id = v_ya_miembro
      where organizacion_id is null and user_id in (v_user_dylan, coalesce(v_user_alex, v_user_dylan));
    if v_user_alex is not null and not exists (select 1 from public.organizacion_miembros where user_id = v_user_alex) then
      insert into public.organizacion_miembros (organizacion_id, user_id, email, rol)
        values (v_ya_miembro, v_user_alex, 'miembro@example.com', 'member');
    end if;
    return;
  end if;

  insert into public.organizaciones (nombre, plan) values ('Aify Team', 'agency') returning id into v_org_id;
  insert into public.organizacion_miembros (organizacion_id, user_id, email, rol)
    values (v_org_id, v_user_dylan, 'propietario@example.com', 'owner');

  if v_user_alex is not null then
    insert into public.organizacion_miembros (organizacion_id, user_id, email, rol)
      values (v_org_id, v_user_alex, 'miembro@example.com', 'member');
  else
    raise notice 'Usuario miembro@example.com no encontrado todavia, se omite su membresia (puede unirse luego con una invitacion)';
  end if;

  update public.clientes set organizacion_id = v_org_id
    where user_id in (v_user_dylan, coalesce(v_user_alex, v_user_dylan));
end $$;
