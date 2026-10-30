-- Aify: "Voz del cliente" en la ficha de cada cliente.
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - clientes.voz_cliente: frases reales de los clientes del negocio (por qué
--   le eligieron, cómo cuentan su problema, qué querían conseguir, dudas antes
--   de comprar, elogios). Lista de objetos:
--     { "id": "uuid", "tipo": "motivo" | "problema" | "deseo" | "duda" | "elogio",
--       "texto": "...", "fuente": "Reseña de Google" | null, "fecha": "YYYY-MM-DD" }
--   La generación de ideas y guiones las usa como ángulos (src/utils/vozCliente.js).
--
-- Va en su propia columna y no dentro del formulario de perfil: se guarda con
-- guardarVozCliente() (src/hooks/useClientes.js), que solo toca esta columna.
-- Sin esta migración la tarjeta muestra un aviso y no guarda.
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.

alter table public.clientes
  add column if not exists voz_cliente jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_voz_cliente_es_lista'
  ) then
    alter table public.clientes
      add constraint clientes_voz_cliente_es_lista check (jsonb_typeof(voz_cliente) = 'array');
  end if;
end $$;
