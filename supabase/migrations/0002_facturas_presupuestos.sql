-- Aify: Facturas + Presupuestos (invoicing + signable quotes)
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  numero text not null,
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  estado text not null default 'pendiente', -- pendiente | pagada | vencida | cancelada
  items jsonb not null default '[]'::jsonb, -- [{concepto, cantidad, precio_unitario, subtotal}]
  subtotal numeric(12,2) not null default 0,
  iva_pct numeric(5,2) not null default 21,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notas text,
  emisor jsonb not null default '{}'::jsonb, -- snapshot: {nombre, nif, direccion}
  creado_en timestamptz not null default now(),
  updated_at timestamptz
);
create index facturas_cliente_idx on public.facturas(cliente_id);

create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  numero text not null,
  fecha_emision date not null default current_date,
  validez_hasta date,
  estado text not null default 'borrador', -- borrador | enviado | firmado | rechazado
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  iva_pct numeric(5,2) not null default 21,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notas text,
  emisor jsonb not null default '{}'::jsonb,
  token uuid not null default gen_random_uuid() unique, -- bearer capability for the public link
  firma_data_url text,
  firmado_en timestamptz,
  firmante_nombre text,
  firmante_email text,
  creado_en timestamptz not null default now(),
  updated_at timestamptz
);
create index presupuestos_cliente_idx on public.presupuestos(cliente_id);
create index presupuestos_token_idx on public.presupuestos(token);

alter table public.facturas enable row level security;
alter table public.presupuestos enable row level security;

create policy "own facturas select" on public.facturas for select using (auth.uid() = user_id);
create policy "own facturas insert" on public.facturas for insert with check (auth.uid() = user_id);
create policy "own facturas update" on public.facturas for update using (auth.uid() = user_id);
create policy "own facturas delete" on public.facturas for delete using (auth.uid() = user_id);

create policy "own presupuestos select" on public.presupuestos for select using (auth.uid() = user_id);
create policy "own presupuestos insert" on public.presupuestos for insert with check (auth.uid() = user_id);
create policy "own presupuestos update" on public.presupuestos for update using (auth.uid() = user_id);
create policy "own presupuestos delete" on public.presupuestos for delete using (auth.uid() = user_id);

-- ── Public signing flow ──────────────────────────────────────────────────────
-- Two security-definer RPCs. Each one only ever touches the single row whose
-- `token` column matches the argument — the token IS the auth, like a signed
-- URL. No other anon access exists on these tables (RLS above blocks it, since
-- auth.uid() is null for an anonymous visitor).

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
    'notas', p.notas,
    'emisor', p.emisor,
    'firmado_en', p.firmado_en,
    'firmante_nombre', p.firmante_nombre,
    'cliente_nombre', c.nombre
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
  v_estado text;
  v_id uuid;
begin
  select id, estado into v_id, v_estado
  from public.presupuestos
  where token = p_token
  for update; -- row lock: evita doble envío en carrera

  if v_id is null then
    raise exception 'Presupuesto no encontrado';
  end if;

  if v_estado in ('firmado', 'rechazado') then
    raise exception 'Este presupuesto ya no admite firma (estado: %)', v_estado;
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
  where id = v_id;

  return jsonb_build_object('ok', true, 'firmado_en', now());
end;
$$;

revoke all on function public.get_presupuesto_publico(uuid) from public;
revoke all on function public.firmar_presupuesto(uuid, text, text, text) from public;
grant execute on function public.get_presupuesto_publico(uuid) to anon, authenticated;
grant execute on function public.firmar_presupuesto(uuid, text, text, text) to anon, authenticated;
