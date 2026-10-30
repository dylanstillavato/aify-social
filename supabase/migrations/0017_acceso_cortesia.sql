-- (Versión pública: los correos reales de la instalación original se han cambiado por correos de ejemplo.)
-- Aify: acceso de cortesía (cuentas que usan Aify sin pagar) + cierre de las
-- columnas de facturación a escritura desde el cliente.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- 1) acceso_cortesia: el muro de pago (SuscripcionGuard en App.jsx y
--    planUsageLimit en server.js) deja pasar a estas organizaciones aunque no
--    tengan suscripción en Stripe. Solo se activa a mano desde aquí; ni el
--    webhook de Stripe ni el cliente lo tocan nunca.
alter table public.organizaciones add column if not exists acceso_cortesia boolean not null default false;

-- 2) SEGURIDAD: la política "org owner can update org" (0006) es por fila, no
--    por columna, así que el owner podía hacer desde el navegador
--      update organizaciones set subscription_status = 'active', plan = 'agency'
--    y saltarse el muro de pago (o resetear uso_ia_mes, o darse
--    acceso_cortesia). El cliente no actualiza organizaciones en ningún sitio
--    (todo pasa por el backend con service_role o por RPCs security definer),
--    así que se quita el UPDATE directo y se deja solo el nombre.
revoke update on public.organizaciones from anon, authenticated;
grant update (nombre) on public.organizaciones to authenticated;

-- 3) Cuentas con cortesía. El plan decide límites de IA y funciones igual que
--    si pagaran: 'agency' = sin límite, 'freelance' = Starter (60/mes).
--    Comprueba que el select final devuelve las 3 filas.
update public.organizaciones o
set acceso_cortesia = true,
    plan = case when c.email = 'cortesia@example.com' then 'freelance' else 'agency' end
from (
  select m.organizacion_id, lower(m.email) as email from public.organizacion_miembros m
  where m.rol = 'owner' and lower(m.email) in (
    'cortesia@example.com', 'propietario@example.com', 'miembro@example.com'
  )
) c
where o.id = c.organizacion_id;

select o.nombre, m.email, o.plan, o.acceso_cortesia
from public.organizaciones o
join public.organizacion_miembros m on m.organizacion_id = o.id and m.rol = 'owner'
where o.acceso_cortesia;
