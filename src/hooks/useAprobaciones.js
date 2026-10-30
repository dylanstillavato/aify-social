import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

// Aprobación de guiones: enlaces que el gestor manda a su cliente con los
// guiones de un mes para que apruebe cada uno o pida cambios, sin cuenta
// (ver supabase/migrations/0019_aprobacion_guiones.sql). Igual que el
// onboarding externo, solo funciona con Supabase.

const SIN_SUPABASE = 'La aprobación de guiones necesita tener Supabase configurado'

export function urlAprobacion(token) {
  return `${window.location.origin}/aprobar/${token}`
}

// 'caducado' no se guarda en la tabla, se deriva
export function estadoAprobacion(row) {
  if (row.estado === 'activo' && row.expira_en && new Date(row.expira_en) < new Date()) return 'caducado'
  return row.estado
}

// mes 0-indexed (convención de Date, como useCalendarioMes); en la tabla va 1-12
export async function crearEnlaceAprobacion({ clienteId, organizacionId, año, mes }) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('guion_aprobaciones')
    .insert({
      user_id: user.id,
      organizacion_id: organizacionId || null,
      cliente_id: clienteId,
      anio: año,
      mes: mes + 1,
    })
    .select().single()
  if (error) return { data: null, error }
  window.dispatchEvent(new CustomEvent('aify:aprobaciones'))
  return { data: { ...data, url: urlAprobacion(data.token) }, error: null }
}

export async function revocarEnlaceAprobacion(id) {
  if (!supabase) return { error: new Error(SIN_SUPABASE) }
  const { error } = await supabase
    .from('guion_aprobaciones').update({ estado: 'revocado' }).eq('id', id)
  if (!error) window.dispatchEvent(new CustomEvent('aify:aprobaciones'))
  return { error }
}

export function useAprobacionesList({ clienteId, año, mes }) {
  const [aprobaciones, setAprobaciones] = useState([])

  const refetch = useCallback(async () => {
    if (!supabase || !clienteId) return
    const { data, error } = await supabase
      .from('guion_aprobaciones').select('*')
      .eq('cliente_id', clienteId).eq('anio', año).eq('mes', mes + 1)
      .order('created_at', { ascending: false })
    if (error) console.warn('[useAprobaciones] no se pudieron cargar los enlaces:', error.message)
    setAprobaciones(data || [])
  }, [clienteId, año, mes])

  useEffect(() => {
    refetch()
    window.addEventListener('aify:aprobaciones', refetch)
    return () => window.removeEventListener('aify:aprobaciones', refetch)
  }, [refetch])

  return { aprobaciones, refetch }
}

// ── Página pública (sin sesión) ──────────────────────────────────────────────

export async function getAprobacionPublica(token) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('get_aprobacion_guiones_publico', { p_token: token })
  return { data, error }
}

export async function responderGuion(token, postId, estado, comentario) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('responder_guion_publico', {
    p_token: token, p_post_id: postId, p_estado: estado, p_comentario: comentario || null,
  })
  return { data, error }
}
