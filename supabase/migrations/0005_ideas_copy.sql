-- Aify: adds the missing `copy` column on ideas.
-- PanelDesarrollar.jsx has always saved a generated copy via
-- actualizarIdea(id, { copy }), but the ideas table only ever had a `guion`
-- column — so against real Supabase, saving a copy for an idea silently
-- dropped it (only the guion made it to the database). Run this once in the
-- Supabase SQL Editor.

alter table public.ideas add column if not exists copy jsonb;
