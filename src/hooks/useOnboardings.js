import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

// Onboarding externo: enlaces que el gestor manda a su cliente para que
// rellene el cuestionario de "Nuevo cliente" sin cuenta (ver
// supabase/migrations/0018_onboarding_externo.sql). Solo funciona con
// Supabase: sin backend no hay forma de que el cliente, desde su móvil,
// escriba en la ficha del gestor, así que aquí no hay camino localStorage.

const SIN_SUPABASE = 'El formulario para clientes necesita tener Supabase configurado'

export function urlFormulario(token) {
  return `${window.location.origin}/formulario/${token}`
}

// Estado que ve el gestor: 'caducado' no se guarda en la tabla, se deriva
export function estadoOnboarding(row) {
  if (row.estado === 'pendiente' && row.expira_en && new Date(row.expira_en) < new Date()) return 'caducado'
  return row.estado
}

export async function crearEnlaceOnboarding({ nombreCliente, clienteId, organizacionId }) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('cliente_onboardings')
    .insert({
      user_id: user.id,
      organizacion_id: organizacionId || null,
      cliente_id: clienteId || null,
      nombre_cliente: nombreCliente?.trim() || null,
    })
    .select().single()
  if (error) return { data: null, error }
  window.dispatchEvent(new CustomEvent('aify:onboardings'))
  return { data: { ...data, url: urlFormulario(data.token) }, error: null }
}

export async function revocarEnlaceOnboarding(id) {
  if (!supabase) return { error: new Error(SIN_SUPABASE) }
  const { error } = await supabase
    .from('cliente_onboardings').update({ estado: 'revocado' }).eq('id', id)
  if (!error) window.dispatchEvent(new CustomEvent('aify:onboardings'))
  return { error }
}

export function useOnboardingsList({ clienteId } = {}) {
  const [onboardings, setOnboardings] = useState([])
  const [loading, setLoading] = useState(!!supabase)

  const refetch = useCallback(async () => {
    if (!supabase) return
    let q = supabase.from('cliente_onboardings').select('*').order('created_at', { ascending: false }).limit(50)
    if (clienteId) q = q.eq('cliente_id', clienteId)
    const { data, error } = await q
    if (error) console.warn('[useOnboardings] no se pudieron cargar los enlaces:', error.message)
    setOnboardings(data || [])
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    refetch()
    window.addEventListener('aify:onboardings', refetch)
    return () => window.removeEventListener('aify:onboardings', refetch)
  }, [refetch])

  return { onboardings, loading, refetch }
}

// ── Página pública (sin sesión) ──────────────────────────────────────────────

export async function getOnboardingPublico(token) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('get_onboarding_publico', { p_token: token })
  return { data, error }
}

export async function enviarOnboarding(token, datosDB) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('enviar_onboarding_cliente', { p_token: token, p_datos: datosDB })
  return { data, error }
}
