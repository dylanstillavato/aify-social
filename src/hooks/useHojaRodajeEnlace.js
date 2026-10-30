import { supabase } from '../services/supabase'

// Hoja de rodaje compartible (/rodaje/<token>, ver 0035_hoja_rodaje_enlace.sql):
// un enlace por cliente y mes, de solo lectura salvo "Grabado" (0036). Compartir otra vez reutiliza el
// enlace activo y le actualiza las notas y el filtro, así la URL que ya tiene
// el equipo sigue valiendo. Solo funciona con Supabase.

const SIN_SUPABASE = 'Compartir la hoja de rodaje necesita tener Supabase configurado'

export function urlHojaRodaje(token) {
  return `${window.location.origin}/rodaje/${token}`
}

// mes 0-indexed (convención de Date); en la tabla va 1-12
export async function compartirHojaRodaje({ clienteId, organizacionId, año, mes, notas, soloAprobados }) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const ajustes = { notas: notas?.trim() || null, solo_aprobados: !!soloAprobados }
  const { data: activos, error: errLeer } = await supabase
    .from('hojas_rodaje').select('*')
    .eq('cliente_id', clienteId).eq('anio', año).eq('mes', mes + 1).eq('estado', 'activo')
    .gt('expira_en', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1)
  if (errLeer) return { data: null, error: errLeer }

  if (activos?.length) {
    const { data, error } = await supabase
      .from('hojas_rodaje').update(ajustes).eq('id', activos[0].id).select().single()
    if (error) return { data: null, error }
    return { data: { ...data, url: urlHojaRodaje(data.token) }, error: null }
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('hojas_rodaje')
    .insert({ user_id: user.id, organizacion_id: organizacionId || null, cliente_id: clienteId, anio: año, mes: mes + 1, ...ajustes })
    .select().single()
  if (error) return { data: null, error }
  return { data: { ...data, url: urlHojaRodaje(data.token) }, error: null }
}

export async function revocarHojaRodaje(id) {
  if (!supabase) return { error: new Error(SIN_SUPABASE) }
  const { error } = await supabase.from('hojas_rodaje').update({ estado: 'revocado' }).eq('id', id)
  return { error }
}

// ── Página pública (sin sesión) ──────────────────────────────────────────────

export async function getHojaRodajePublica(token) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('get_hoja_rodaje_publica', { p_token: token })
  return { data, error }
}

// Quien graba marca un vídeo como grabado: se guarda en el post (0036) y lo ve
// también la hoja de rodaje de la app. Devuelve { data: grabado_en | null }.
export async function marcarGrabadoPublico(token, postId, grabado) {
  if (!supabase) return { data: null, error: new Error(SIN_SUPABASE) }
  const { data, error } = await supabase.rpc('marcar_grabado_rodaje', { p_token: token, p_post_id: postId, p_grabado: grabado })
  return { data, error }
}
