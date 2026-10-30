-- Aify: columnas de facturación con Stripe sobre organizaciones.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- Todas las escrituras a estas columnas las hace el backend con la clave
-- service_role (bypassa RLS) — el webhook de Stripe y la creación de sesiones
-- de checkout/portal, nunca el cliente directamente. Las políticas de SELECT
-- ya existentes sobre organizaciones (auth.uid() = owner / miembro de la org)
-- siguen aplicando sin cambios: son políticas por fila, no por columna.

alter table public.organizaciones add column if not exists stripe_customer_id text;
alter table public.organizaciones add column if not exists stripe_subscription_id text;
alter table public.organizaciones add column if not exists subscription_status text;
alter table public.organizaciones add column if not exists trial_ends_at timestamptz;
alter table public.organizaciones add column if not exists current_period_end timestamptz;
alter table public.organizaciones add column if not exists price_interval text; -- 'mensual' | 'anual'

create unique index if not exists organizaciones_stripe_customer_id_idx
  on public.organizaciones(stripe_customer_id) where stripe_customer_id is not null;
