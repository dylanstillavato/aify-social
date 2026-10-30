import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { esModoCobroValido, modoCobroOrganizacion } from '../utils/modoCobro'

// ── Modo de cobro (0026_modo_cobro.sql) ─────────────────────────────────────
// El onboarding del usuario pregunta cómo cobra, pero en ese momento la
// organización personal normalmente aún no existe (la crea el bootstrap de
// fetchOrganizacion al entrar en la app). La respuesta se guarda como
// "pendiente" en este navegador (y en user_metadata.modo_cobro, para el caso
// de otro dispositivo) y se aplica en cuanto hay organización y el usuario es
// su owner. Si la migración 0026 no está aplicada, se queda pendiente.

const claveModoCobroPendiente = (userId) => `aify_modo_cobro_pendiente:${userId}`

export function guardarModoCobroPendiente(userId, modo) {
  if (!userId || !esModoCobroValido(modo)) return
  try { localStorage.setItem(claveModoCobroPendiente(userId), modo) } catch { /* ignore */ }
}

function leerModoCobroPendiente(userId) {
  try {
    const modo = localStorage.getItem(claveModoCobroPendiente(userId))
    return esModoCobroValido(modo) ? modo : null
  } catch { return null }
}

function borrarModoCobroPendiente(userId) {
  try { localStorage.removeItem(claveModoCobroPendiente(userId)) } catch { /* ignore */ }
}

// Mensaje claro para los fallos típicos al guardar modo_cobro
export function mensajeErrorModoCobro(error) {
  const msg = error?.message || ''
  if (error?.code === 'PGRST204' || error?.code === '42703' || /modo_cobro/.test(msg)) {
    return 'Falta actualizar la base de datos para guardar el modo de cobro (migración 0026)'
  }
  if (error?.code === '42501' || /permission denied/i.test(msg)) {
    return 'Solo el propietario de la organización puede cambiar el modo de cobro'
  }
  return msg || 'No se pudo guardar el modo de cobro'
}

async function guardarModoCobroOrganizacion(organizacionId, modo) {
  if (!supabase) return { error: new Error('Supabase no configurado') }
  const { data, error } = await supabase
    .from('organizaciones')
    .update({ modo_cobro: modo })
    .eq('id', organizacionId)
    .select('id')
  if (error) return { error }
  // RLS no da error si no deja actualizar la fila: devuelve 0 filas
  if (!data || data.length === 0) return { error: { code: '42501', message: 'permission denied' } }
  return { error: null }
}

// Aplica el modo de cobro pendiente del onboarding si ya se puede. Devuelve el
// modo aplicado o null. Nunca lanza.
async function aplicarModoCobroPendiente(user, organizacionId, rol, creadaAhora) {
  const pendiente = leerModoCobroPendiente(user.id)
    || (creadaAhora && esModoCobroValido(user.user_metadata?.modo_cobro) ? user.user_metadata.modo_cobro : null)
  if (!pendiente || !organizacionId) return null
  if (rol !== 'owner') { borrarModoCobroPendiente(user.id); return null }
  try {
    const { error } = await guardarModoCobroOrganizacion(organizacionId, pendiente)
    if (error) {
      console.warn('[useOrganizacion] Modo de cobro pendiente sin aplicar:', error.message)
      return null
    }
    borrarModoCobroPendiente(user.id)
    return pendiente
  } catch {
    return null
  }
}

// Desde el onboarding: si el usuario ya es owner de una organización (p. ej.
// al reconfigurar Aify), guarda el modo ya; si no, queda pendiente.
export async function guardarModoCobroDesdeOnboarding(user, modo) {
  if (!user || !esModoCobroValido(modo)) return
  guardarModoCobroPendiente(user.id, modo)
  if (!supabase) return
  try {
    const { data } = await supabase
      .from('organizacion_miembros')
      .select('organizacion_id, rol')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data?.organizacion_id) await aplicarModoCobroPendiente(user, data.organizacion_id, data.rol, false)
  } catch { /* se aplica al cargar la organización */ }
}

async function fetchOrganizacion(user) {
  // 1. ¿ya soy miembro de una organización?
  const { data: miembroRow, error: miembroErr } = await supabase
    .from('organizacion_miembros')
    .select('organizacion_id, rol')
    .eq('user_id', user.id)
    .maybeSingle()
  if (miembroErr) throw miembroErr

  let organizacionId = miembroRow?.organizacion_id
  let creadaAhora = false

  if (!organizacionId) {
    // Bootstrap: organización personal. Se hace
    // con un RPC atómico (security definer) en vez de dos inserts sueltos
    // desde el cliente: ni organizaciones ni organizacion_miembros tienen ya
    // una política de INSERT accesible desde el cliente (ver
    // 0006_organizaciones.sql — la política vieja de auto-unirse a un
    // organizacion_id arbitrario permitía saltarse el flujo de invitación),
    // así que este es el único camino para crear la organización personal.
    const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Mi organización'
    const { data: boot, error: bootErr } = await supabase
      .rpc('bootstrap_organizacion_personal', { p_nombre: nombre })
    if (bootErr) throw bootErr

    organizacionId = boot.organizacion_id
    creadaAhora = Boolean(boot.creada)
  }

  const [{ data: organizacion, error: orgFetchErr }, { data: miembros, error: miembrosErr }, { data: invitaciones, error: invErr }] = await Promise.all([
    supabase.from('organizaciones').select('id, nombre').eq('id', organizacionId).single(),
    supabase.from('organizacion_miembros').select('user_id, email, rol').eq('organizacion_id', organizacionId),
    supabase.from('organizacion_invitaciones').select('id, token, usada, creada_en').eq('organizacion_id', organizacionId).eq('usada', false),
  ])
  // modo_cobro va en una consulta aparte y tolerante a error: sin la migración
  // 0026 la columna no existe y no puede tumbar la carga de la organización
  // (de la que depende toda la app, ver OrganizacionGuard en App.jsx).
  const { data: modoRow, error: modoErr } = await supabase
    .from('organizaciones').select('modo_cobro').eq('id', organizacionId).maybeSingle()
  if (orgFetchErr) throw orgFetchErr
  if (miembrosErr) throw miembrosErr
  if (invErr) throw invErr

  const miRol = (miembros || []).find(m => m.user_id === user.id)?.rol || 'owner'
  let modoCobro = modoErr ? null : (modoRow?.modo_cobro ?? null)
  if (modoCobro !== null) {
    const aplicado = await aplicarModoCobroPendiente(user, organizacionId, miRol, creadaAhora)
    if (aplicado) modoCobro = aplicado
  }

  return {
    // modo_cobro null = columna no disponible (migración 0026 sin aplicar)
    organizacion: { ...organizacion, modo_cobro: modoCobro },
    miembros: miembros || [],
    miRol,
    invitacionesPendientes: invitaciones || [],
  }
}

export function useOrganizacion() {
  const { user } = useAuth()
  const [state, setState] = useState({
    loading: true,
    organizacion: null,
    miembros: [],
    miRol: 'owner',
    invitacionesPendientes: [],
    error: null,
  })

  const refetch = useCallback(async () => {
    if (!supabase || !user) {
      setState(s => ({ ...s, loading: false }))
      return
    }
    setState(s => ({ ...s, loading: true }))
    try {
      const data = await fetchOrganizacion(user)
      setState({ ...data, loading: false, error: null })
    } catch (err) {
      console.error('[useOrganizacion] Error cargando organización:', err.message)
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [user])

  useEffect(() => { refetch() }, [refetch])

  const crearInvitacion = useCallback(async () => {
    if (!supabase || !state.organizacion || !user) throw new Error('No hay organización cargada')
    const { data, error } = await supabase
      .from('organizacion_invitaciones')
      .insert({ organizacion_id: state.organizacion.id, creada_por: user.id })
      .select('token')
      .single()
    if (error) throw error
    await refetch()
    return data
  }, [state.organizacion, user, refetch])

  const actualizarModoCobro = useCallback(async (modo) => {
    if (!state.organizacion) return { error: 'No hay organización cargada' }
    if (!esModoCobroValido(modo)) return { error: 'Modo de cobro no válido' }
    const { error } = await guardarModoCobroOrganizacion(state.organizacion.id, modo)
    if (error) return { error: mensajeErrorModoCobro(error) }
    setState(s => (s.organizacion ? { ...s, organizacion: { ...s.organizacion, modo_cobro: modo } } : s))
    return { error: null }
  }, [state.organizacion])

  return {
    loading: state.loading,
    error: state.error,
    organizacion: state.organizacion,
    miembros: state.miembros,
    miRol: state.miRol,
    esOwner: state.miRol === 'owner',
    invitacionesPendientes: state.invitacionesPendientes,
    crearInvitacion,
    // 'adelantado' | 'al_entregar' (por defecto al entregar)
    modoCobro: modoCobroOrganizacion(state.organizacion),
    // false si la columna modo_cobro aún no existe (migración 0026 pendiente)
    modoCobroDisponible: esModoCobroValido(state.organizacion?.modo_cobro),
    actualizarModoCobro,
    refetch,
  }
}

export async function getInvitacionPublica(token) {
  if (!supabase) return { data: null, error: 'Supabase no configurado' }
  const { data, error } = await supabase.rpc('get_invitacion_publica', { p_token: token })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function aceptarInvitacionOrganizacion(token) {
  if (!supabase) return { data: null, error: 'Supabase no configurado' }
  const { data, error } = await supabase.rpc('aceptar_invitacion_organizacion', { p_token: token })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
