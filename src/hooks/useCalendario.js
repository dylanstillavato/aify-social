import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

const LS_PREFIX = 'aify_calendario_posts_'

// ── localStorage helpers (only used when Supabase not configured) ──────────────
// One flat array per client (fecha-based, not per-month keys like the old scheme).

function lsKey(clienteId) { return `${LS_PREFIX}${clienteId}` }

function lsRead(clienteId) {
  try {
    const s = localStorage.getItem(lsKey(clienteId))
    return s !== null ? JSON.parse(s) : []
  } catch { return [] }
}

function lsSave(clienteId, posts) {
  try {
    localStorage.setItem(lsKey(clienteId), JSON.stringify(posts))
    window.dispatchEvent(new CustomEvent('aify:calendario'))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
  }
}

function lsNextId() { return `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }

// Aggregates every client's posts (localStorage keeps one array per client,
// keyed by clienteId — there's no single "all clients" key to read directly).
// Only used on the no-Supabase fallback path; with Supabase, RLS does this scoping.
function lsReadTodos() {
  const posts = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(LS_PREFIX)) continue
      try {
        const arr = JSON.parse(localStorage.getItem(key))
        if (Array.isArray(arr)) posts.push(...arr)
      } catch { /* skip malformed entry */ }
    }
  } catch { /* ignore */ }
  return posts
}

// ── Supabase mappers ──────────────────────────────────────────────────────────

function mapearPost(row) {
  const [y, m, d] = (row.fecha || '').split('-').map(Number)
  return {
    id: row.id,
    clienteId: row.cliente_id ?? row.clienteId,
    fecha: row.fecha,
    dia: d,
    mes: m,   // 1-indexed
    año: y,
    red: row.red,
    comparteEn: row.comparte_en || row.comparteEn || [],
    formato: row.formato || '',
    titulo: row.titulo || '',
    concepto: row.concepto || '',
    objetivo: row.objetivo || '',
    esFestivo: !!(row.es_festivo ?? row.esFestivo),
    nombreFestivo: row.nombre_festivo || row.nombreFestivo || '',
    desarrollado: !!row.desarrollado,
    desarrolladoEn: row.desarrollado_en || row.desarrolladoEn || null,
    copy: row.copy ?? null,
    copyHistorial: row.copy_historial || [],
    hashtags: row.hashtags ?? null,
    guion: row.guion ?? null,
    guionHistorial: row.guion_historial || [],
    hora: row.hora || null,
    notas: row.notas || '',
    estado: row.estado || 'borrador',
    aprobacionEstado: row.aprobacion_estado ?? row.aprobacionEstado ?? null,
    aprobacionComentario: row.aprobacion_comentario ?? row.aprobacionComentario ?? '',
    aprobacionEn: row.aprobacion_en ?? row.aprobacionEn ?? null,
    origenIdeaId: row.origen_idea_id ?? row.origenIdeaId ?? null,
    // false = guion sin programar (0030): vive en Guiones del mes, no en el calendario
    enCalendario: row.en_calendario ?? row.enCalendario ?? true,
    // 0036: vídeo grabado (lo marca la hoja de rodaje de la app o el enlace /rodaje)
    grabadoEn: row.grabado_en ?? row.grabadoEn ?? null,
    creadoEn: row.creado_en || row.creadoEn,
  }
}

function fechaDe(datos) {
  if (datos.fecha) return datos.fecha
  if (datos.año && datos.mes && datos.dia) {
    return `${datos.año}-${String(datos.mes).padStart(2, '0')}-${String(datos.dia).padStart(2, '0')}`
  }
  return null
}

function postDataParaDB(datos) {
  return {
    cliente_id: datos.clienteId,
    fecha: fechaDe(datos),
    red: datos.red,
    comparte_en: datos.comparteEn || [],
    formato: datos.formato || null,
    titulo: datos.titulo || null,
    concepto: datos.concepto || null,
    objetivo: datos.objetivo || null,
    es_festivo: !!datos.esFestivo,
    nombre_festivo: datos.nombreFestivo || null,
    desarrollado: !!datos.desarrollado,
    copy: datos.copy ?? null,
    hashtags: datos.hashtags ?? null,
    guion: datos.guion ?? null,
    hora: datos.hora || null,
    notas: datos.notas ?? null,
    estado: datos.estado || 'borrador',
    origen_idea_id: datos.origenIdeaId || null,
    // Solo se escribe para los guiones sin programar: así crear posts normales
    // sigue funcionando aunque la migración 0030 aún no esté aplicada
    ...(datos.enCalendario === false ? { en_calendario: false } : {}),
  }
}

// Los guiones sin programar (en_calendario = false) se guardan con el día 1
// del mes como ancla, pero no son publicaciones: por defecto ninguna consulta
// del calendario los devuelve. Guiones del mes los pide con
// { incluirSinProgramar: true }.
const enCalendario = (p) => p.enCalendario !== false
const filtrar = (posts, opciones) => (opciones?.incluirSinProgramar ? posts : posts.filter(enCalendario))

function rangoMes(año, mes) {
  // mes is 0-indexed (JS Date convention), matching Calendario.jsx's `month` state
  const inicio = `${año}-${String(mes + 1).padStart(2, '0')}-01`
  const ultimoDia = new Date(año, mes + 1, 0).getDate()
  const fin = `${año}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fin }
}

// ── CRUD: Supabase path or localStorage path ──────────────────────────────────

export async function getPostsDelMes(clienteId, año, mes, opciones) {
  const { data, error } = await getPostsDelMesTodos(clienteId, año, mes)
  return { data: filtrar(data, opciones), error }
}

async function getPostsDelMesTodos(clienteId, año, mes) {
  const { inicio, fin } = rangoMes(año, mes)
  if (!supabase) {
    const posts = lsRead(clienteId).filter(p => p.fecha >= inicio && p.fecha <= fin)
    return { data: posts, error: null }
  }
  try {
    const { data, error } = await supabase
      .from('calendario_posts').select('*')
      .eq('cliente_id', clienteId).gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: true })
    if (error) throw error
    return { data: data.map(mapearPost), error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, usando localStorage:', error.message)
    const posts = lsRead(clienteId).filter(p => p.fecha >= inicio && p.fecha <= fin)
    return { data: posts, error: null }
  }
}

// Same as getPostsDelMes but across every client of the logged-in user —
// used by the aggregate "Calendario general" view. RLS already scopes Supabase
// results to the logged-in user, so simply dropping the cliente_id filter is enough.
export async function getPostsMesTodos(año, mes, opciones) {
  const { inicio, fin } = rangoMes(año, mes)
  if (!supabase) {
    const posts = lsReadTodos().filter(p => p.fecha >= inicio && p.fecha <= fin)
    return { data: filtrar(posts, opciones), error: null }
  }
  try {
    const { data, error } = await supabase
      .from('calendario_posts').select('*')
      .gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: true })
    if (error) throw error
    return { data: filtrar(data.map(mapearPost), opciones), error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, usando localStorage:', error.message)
    const posts = lsReadTodos().filter(p => p.fecha >= inicio && p.fecha <= fin)
    return { data: filtrar(posts, opciones), error: null }
  }
}

export async function getPostsCliente(clienteId, opciones) {
  if (!supabase) return { data: filtrar(lsRead(clienteId), opciones), error: null }
  try {
    const { data, error } = await supabase
      .from('calendario_posts').select('*')
      .eq('cliente_id', clienteId).order('fecha', { ascending: false })
    if (error) throw error
    return { data: filtrar(data.map(mapearPost), opciones), error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, usando localStorage:', error.message)
    return { data: filtrar(lsRead(clienteId), opciones), error: null }
  }
}

// Finds the calendar post (if any) that originated from a given saved idea —
// used to keep a copy/guión developed from "Ideas guardadas" in sync with its
// linked calendar post, wherever that post's month may be.
export async function getPostPorIdea(clienteId, ideaId) {
  if (!supabase) {
    return lsRead(clienteId).find(p => String(p.origenIdeaId) === String(ideaId)) || null
  }
  try {
    const { data, error } = await supabase
      .from('calendario_posts').select('*')
      .eq('cliente_id', clienteId).eq('origen_idea_id', ideaId).limit(1).maybeSingle()
    if (error) throw error
    return data ? mapearPost(data) : null
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, usando localStorage:', error.message)
    return lsRead(clienteId).find(p => String(p.origenIdeaId) === String(ideaId)) || null
  }
}

// Overwrites every post in [año, mes] with a freshly AI-generated batch (matches
// the existing "generar/regenerar calendario" behavior — full month replace).
export async function guardarPostsDelMes(clienteId, año, mes, posts) {
  const { inicio, fin } = rangoMes(año, mes)
  const conFecha = posts.map(p => ({ ...p, clienteId, fecha: fechaDe({ ...p, año, mes: mes + 1 }) }))

  if (!supabase) {
    const otros = lsRead(clienteId).filter(p => p.fecha < inicio || p.fecha > fin || !enCalendario(p))
    const nuevos = conFecha.map(p => ({ ...p, id: p.id || lsNextId(), estado: p.estado || 'borrador', desarrollado: !!p.desarrollado }))
    lsSave(clienteId, [...otros, ...nuevos])
    return { data: nuevos, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const borrarMes = () => supabase
      .from('calendario_posts').delete()
      .eq('cliente_id', clienteId).gte('fecha', inicio).lte('fecha', fin)
    // Los guiones sin programar no son parte del calendario: no se borran.
    // 42703 = la columna aún no existe (0030 sin aplicar): no hay ninguno que proteger.
    let { error: delErr } = await borrarMes().eq('en_calendario', true)
    if (delErr?.code === '42703') ({ error: delErr } = await borrarMes())
    if (delErr) throw delErr
    const rows = conFecha.map(p => ({ ...postDataParaDB(p), user_id: user.id }))
    const { data, error } = await supabase.from('calendario_posts').insert(rows).select()
    if (error) throw error
    return { data: data.map(mapearPost), error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, guardando en localStorage:', error.message)
    const otros = lsRead(clienteId).filter(p => p.fecha < inicio || p.fecha > fin || !enCalendario(p))
    const nuevos = conFecha.map(p => ({ ...p, id: p.id || lsNextId(), estado: p.estado || 'borrador', desarrollado: !!p.desarrollado }))
    lsSave(clienteId, [...otros, ...nuevos])
    return { data: nuevos, error: null }
  }
}

// Single post insert (manual quick-add en el calendario, guiones sin programar desde la Lluvia)
export async function crearPost(datos) {
  if (!supabase) {
    const nuevo = { ...datos, id: datos.id || lsNextId(), fecha: fechaDe(datos), estado: datos.estado || 'borrador', desarrollado: !!datos.desarrollado }
    lsSave(datos.clienteId, [nuevo, ...lsRead(datos.clienteId)])
    return { data: nuevo, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const row = { ...postDataParaDB(datos), user_id: user.id }
    const { data, error } = await supabase.from('calendario_posts').insert(row).select().single()
    if (error) throw error
    return { data: mapearPost(data), error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, guardando en localStorage:', error.message)
    const nuevo = { ...datos, id: datos.id || lsNextId(), fecha: fechaDe(datos), estado: datos.estado || 'borrador', desarrollado: !!datos.desarrollado }
    lsSave(datos.clienteId, [nuevo, ...lsRead(datos.clienteId)])
    return { data: nuevo, error: null }
  }
}

// Partial update — copy/guión/estado/etc. Single UPDATE by id, replaces the old
// "scan every month's localStorage key" approach in utils/calendario.js.
export async function actualizarPost(clienteId, id, datos) {
  if (!supabase) {
    const updated = lsRead(clienteId).map(p => String(p.id) === String(id) ? { ...p, ...datos } : p)
    lsSave(clienteId, updated)
    return { data: updated.find(p => String(p.id) === String(id)), error: null }
  }
  try {
    const row = {}
    if (datos.fecha !== undefined) row.fecha = datos.fecha
    if (datos.copy !== undefined) row.copy = datos.copy
    if (datos.hashtags !== undefined) row.hashtags = datos.hashtags
    if (datos.guion !== undefined) row.guion = datos.guion
    if (datos.hora !== undefined) row.hora = datos.hora
    if (datos.notas !== undefined) row.notas = datos.notas
    if (datos.desarrollado !== undefined) { row.desarrollado = datos.desarrollado; row.desarrollado_en = new Date().toISOString() }
    if (datos.estado !== undefined) row.estado = datos.estado
    if (datos.red !== undefined) row.red = datos.red
    if (datos.comparteEn !== undefined) row.comparte_en = datos.comparteEn
    if (datos.formato !== undefined) row.formato = datos.formato
    if (datos.enCalendario !== undefined) row.en_calendario = datos.enCalendario
    const { data, error } = await supabase.from('calendario_posts').update(row).eq('id', id).select().single()
    if (error) throw error
    return { data: mapearPost(data), error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, actualizando en localStorage:', error.message)
    const updated = lsRead(clienteId).map(p => String(p.id) === String(id) ? { ...p, ...datos } : p)
    lsSave(clienteId, updated)
    return { data: updated.find(p => String(p.id) === String(id)), error: null }
  }
}

// Marca (o desmarca) un vídeo como grabado (0036). Sin el fallback a
// localStorage de actualizarPost: si la columna no existe aún, devuelve el
// error y la hoja de rodaje sigue con sus marcas locales.
export async function marcarPostGrabado(clienteId, id, grabado) {
  const grabadoEn = grabado ? new Date().toISOString() : null
  if (!supabase) {
    lsSave(clienteId, lsRead(clienteId).map(p => String(p.id) === String(id) ? { ...p, grabadoEn } : p))
    return { error: null }
  }
  const { error } = await supabase.from('calendario_posts').update({ grabado_en: grabadoEn }).eq('id', id)
  if (error) console.warn('[useCalendario] no se pudo marcar el vídeo como grabado:', error.message)
  return { error }
}

// Aprobación a mano por el gestor (el cliente dio el ok por WhatsApp o en
// persona): 'aprobado' o null (vuelve a pendiente). El comentario del cliente
// se conserva. Sin fallback a localStorage, igual que marcarPostGrabado: si
// falla, el error se enseña y no parece aprobado sin estarlo.
export async function aprobarPostManual(clienteId, id, aprobado) {
  const cambios = { aprobacionEstado: aprobado ? 'aprobado' : null, aprobacionEn: aprobado ? new Date().toISOString() : null }
  if (!supabase) {
    lsSave(clienteId, lsRead(clienteId).map(p => String(p.id) === String(id) ? { ...p, ...cambios } : p))
    return { error: null }
  }
  const { error } = await supabase.from('calendario_posts')
    .update({ aprobacion_estado: cambios.aprobacionEstado, aprobacion_en: cambios.aprobacionEn })
    .eq('id', id)
  if (error) console.warn('[useCalendario] no se pudo cambiar la aprobación:', error.message)
  return { error }
}

export async function eliminarPost(clienteId, id) {
  if (!supabase) {
    lsSave(clienteId, lsRead(clienteId).filter(p => String(p.id) !== String(id)))
    return { error: null }
  }
  try {
    const { error } = await supabase.from('calendario_posts').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.warn('[useCalendario] Supabase no disponible, eliminando de localStorage:', error.message)
    lsSave(clienteId, lsRead(clienteId).filter(p => String(p.id) !== String(id)))
    return { error: null }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCalendarioMes(clienteId, año, mes, opciones) {
  const incluirSinProgramar = !!opciones?.incluirSinProgramar
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!clienteId) { setPosts([]); setLoading(false); return }
    setLoading(true)
    const { data } = await getPostsDelMes(clienteId, año, mes, { incluirSinProgramar })
    setPosts(data)
    setLoading(false)
  }, [clienteId, año, mes, incluirSinProgramar])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    if (supabase) return
    const h = () => refetch()
    window.addEventListener('aify:calendario', h)
    return () => window.removeEventListener('aify:calendario', h)
  }, [refetch])

  return { posts, loading, refetch }
}

// Mirrors useCalendarioMes, minus the per-client scoping — powers the aggregate
// "Calendario general" view (all clients of the logged-in user, one month).
export function useCalendarioMesTodos(año, mes) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await getPostsMesTodos(año, mes)
    setPosts(data)
    setLoading(false)
  }, [año, mes])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    if (supabase) return
    const h = () => refetch()
    window.addEventListener('aify:calendario', h)
    return () => window.removeEventListener('aify:calendario', h)
  }, [refetch])

  return { posts, loading, refetch }
}
