import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

// Portal del cliente: un enlace estable por cliente que reúne sus formularios
// pendientes, presupuestos por firmar, guiones por aprobar y facturas, sin
// cuenta (ver supabase/migrations/0021_portal_cliente.sql). No caduca: vale
// hasta que se revoca. Igual que el resto de enlaces públicos, solo funciona
// con Supabase.

const SIN_SUPABASE = 'El portal del cliente necesita tener Supabase configurado'

export function urlPortal(token) {
  return `${window.location.origin}/portal/${token}`
}

// Reutiliza el portal activo del cliente si ya existe; si no, crea uno
export async function crearOObtenerPortal({ clienteId, organizacionId }) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data: existente, error: errLectura } = await supabase
    .from('cliente_portales').select('*')
    .eq('cliente_id', clienteId).eq('estado', 'activo')
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (errLectura) return { data: null, error: errLectura }
  if (existente) return { data: { ...existente, url: urlPortal(existente.token) }, error: null }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('cliente_portales')
    .insert({
      user_id: user.id,
      organizacion_id: organizacionId || null,
      cliente_id: clienteId,
    })
    .select().single()
  if (error) return { data: null, error }
  window.dispatchEvent(new CustomEvent('aify:portales'))
  return { data: { ...data, url: urlPortal(data.token) }, error: null }
}

export async function revocarPortal(id) {
  if (!supabase) return { error: new Error(SIN_SUPABASE) }
  const { error } = await supabase
    .from('cliente_portales').update({ estado: 'revocado' }).eq('id', id)
  if (!error) window.dispatchEvent(new CustomEvent('aify:portales'))
  return { error }
}

export function usePortalCliente(clienteId) {
  const [portales, setPortales] = useState([])
  // Cliente cuyos portales ya se han cargado: mientras no coincida con
  // clienteId está cargando (para no ofrecer "Crear" antes de saber si ya hay uno)
  const [cargadoPara, setCargadoPara] = useState(null)

  const cargar = useCallback(() => {
    if (!supabase || !clienteId) return Promise.resolve(null)
    return supabase
      .from('cliente_portales').select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.warn('[usePortalCliente] no se pudieron cargar los portales:', error.message)
        return data || []
      })
  }, [clienteId])

  const refetch = useCallback(async () => {
    const data = await cargar()
    if (data === null) return
    setPortales(data)
    setCargadoPara(clienteId)
  }, [cargar, clienteId])

  useEffect(() => {
    let cancelado = false
    const alCargar = (data) => {
      if (cancelado || data === null) return
      setPortales(data)
      setCargadoPara(clienteId)
    }
    const recargar = () => { cargar().then(alCargar) }
    cargar().then(alCargar)
    window.addEventListener('aify:portales', recargar)
    return () => { cancelado = true; window.removeEventListener('aify:portales', recargar) }
  }, [cargar, clienteId])

  const activo = portales.find(p => p.estado === 'activo') || null

  const loading = !!supabase && !!clienteId && cargadoPara !== clienteId

  return { portales, activo, loading, refetch }
}

// ── Página pública (sin sesión) ──────────────────────────────────────────────

export async function getPortalPublico(token) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('get_portal_cliente', { p_token: token })
  return { data, error }
}
