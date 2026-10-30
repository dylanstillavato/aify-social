-- Aify: perfil de "Marca personal" (la cuenta del propio gestor, no un negocio).
-- Run this once in the Supabase SQL Editor. No CLI is linked to this project.
--
-- - clientes.marca_personal: null = negocio normal. Con valor, el perfil es la
--   marca personal de alguien que la usa para conseguir clientes para su
--   propio negocio (p. ej. una agencia). Objeto:
--     { "negocio": "SOLD OUT", "oferta": "...", "clienteIdeal": "...",
--       "llamadaAccion": "...", "historia": "..." }
--   La IA (construirPromptCliente en src/services/ai.js) cambia el enfoque:
--   el espectador es el cliente ideal del negocio y cada pieza acerca a
--   contratarlo.
--
-- Sin esta migración el perfil se guarda igual pero sin estos datos
-- (useClientes.js reintenta sin la columna).
--
-- Idempotente: seguro volver a pegar y ejecutar este archivo entero.

alter table public.clientes
  add column if not exists marca_personal jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_marca_personal_es_objeto'
  ) then
    alter table public.clientes
      add constraint clientes_marca_personal_es_objeto
      check (marca_personal is null or jsonb_typeof(marca_personal) = 'object');
  end if;
end $$;
