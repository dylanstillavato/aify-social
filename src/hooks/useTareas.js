import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { ORIGEN_PRODUCCION } from '../utils/vencimiento'

const LS_KEY = 'aify_todo'

// ── localStorage helpers (only used when Supabase not configured) ──────────────

function lsRead() {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s !== null ? (JSON.parse(s).tareas || []) : []
  } catch { return [] }
}

function lsSave(tareas) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ tareas }))
    window.dispatchEvent(new CustomEvent('aify:todo'))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
  }
}

function lsNextId(prefix = 'tarea') { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }

// ── Supabase mappers ──────────────────────────────────────────────────────────

function mapearTarea(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    postId: row.post_id,
    titulo: row.titulo,
    subtitulo: row.subtitulo || '',
    ideaTitulo: row.idea_titulo || '',
    red: row.red || '',
    formato: row.formato || '',
    fechaLimite: row.fecha_limite,
    completada: !!row.completada,
    completadaEn: row.completada_en || null,
    origen: row.origen || 'manual',
    tipo: row.tipo || null,
    nota: row.nota || '',
    orden: row.orden ?? 0,
    creadaEn: row.creada_en,
    fases: row.fases || null,
    enProgreso: !!row.en_progreso,
    archivadaEn: row.archivada_en ?? row.archivadaEn ?? null,
    // columna del tablero (0024_tableros.sql); null = primera columna
    columnaId: row.columna_id ?? row.columnaId ?? null,
    // paso del proceso del cliente (0033_tareas_paso.sql); null = sin paso
    paso: row.paso ?? null,
    // día de edición de las tarjetas de producción (0034_tareas_fecha_edicion.sql)
    fechaEdicion: row.fecha_edicion ?? row.fechaEdicion ?? null,
  }
}

function tareaDataParaDB(datos) {
  const row = {
    cliente_id: datos.clienteId || null,
    post_id: datos.postId || null,
    titulo: datos.titulo,
    subtitulo: datos.subtitulo || null,
    idea_titulo: datos.ideaTitulo || null,
    red: datos.red || null,
    formato: datos.formato || null,
    fecha_limite: datos.fechaLimite || null,
    completada: !!datos.completada,
    origen: datos.origen || 'manual',
    tipo: datos.tipo || null,
    nota: datos.nota || null,
    orden: datos.orden ?? 0,
    fases: datos.fases || null,
    en_progreso: !!datos.enProgreso,
  }
  // columna_id llega con la migración 0024: solo se envía cuando hay valor
  if (datos.columnaId) row.columna_id = datos.columnaId
  // paso llega con la migración 0033: solo se envía cuando hay valor
  if (datos.paso) row.paso = datos.paso
  // fecha_edicion llega con la migración 0034: solo se envía cuando hay valor
  if (datos.fechaEdicion) row.fecha_edicion = datos.fechaEdicion
  return row
}

// ── CRUD: Supabase path or localStorage path ──────────────────────────────────

export async function getTareas() {
  if (!supabase) return { data: lsRead(), error: null }
  try {
    const { data, error } = await supabase.from('tareas').select('*').order('orden', { ascending: true })
    // La columna solo aparece en las filas si la migración 0022 está aplicada
    if (!error && data?.length) soportaArchivado = 'archivada_en' in data[0]
    if (error) throw error
    return { data: await conPublicacion(data.map(mapearTarea)), error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, usando localStorage:', error.message)
    return { data: lsRead(), error: null }
  }
}

// Las tarjetas de producción vencen por la publicación de su post (ver
// utils/vencimiento.js), que no se guarda en la tarea: se lee del calendario
// en una sola consulta. null = guion sin programar; si la consulta falla la
// tarjeta se queda sin fechaPublicacion (y no vence).
async function conPublicacion(tareas) {
  const ids = [...new Set(tareas.filter(t => t.origen === ORIGEN_PRODUCCION && t.postId).map(t => t.postId))]
  if (!ids.length) return tareas
  const { data, error } = await supabase.from('calendario_posts').select('id, fecha, en_calendario').in('id', ids)
  if (error) {
    console.warn('[useTareas] no se pudo leer la publicación de las tarjetas:', error.message)
    return tareas
  }
  const porId = new Map(data.map(p => [String(p.id), p]))
  return tareas.map(t => {
    const p = t.origen === ORIGEN_PRODUCCION && porId.get(String(t.postId))
    return p ? { ...t, fechaPublicacion: p.en_calendario === false ? null : p.fecha } : t
  })
}

export async function crearTarea(datos) {
  if (!supabase) {
    const nuevo = { ...datos, id: datos.id || lsNextId(), completada: false, creadaEn: new Date().toISOString() }
    lsSave([...lsRead(), nuevo])
    return { data: nuevo, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const row = { ...tareaDataParaDB(datos), user_id: user.id }
    const { data, error } = await supabase.from('tareas').insert(row).select().single()
    if (error) throw error
    return { data: mapearTarea(data), error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, guardando en localStorage:', error.message)
    const nuevo = { ...datos, id: datos.id || lsNextId(), completada: false, creadaEn: new Date().toISOString() }
    lsSave([...lsRead(), nuevo])
    return { data: nuevo, error: null }
  }
}

// Bulk insert — used for the 3 desarrollar/preparar/publicar tasks created together
// from Lluvia de Ideas. Idempotent per postId, matching the old dedup guard.
export async function crearTareasBulk(tareasArr) {
  if (!tareasArr.length) return { data: [], error: null }
  const postId = tareasArr[0].postId
  if (!supabase) {
    const actuales = lsRead()
    if (postId && actuales.some(t => t.postId === postId)) return { data: [], error: null }
    const nuevas = tareasArr.map((t, i) => ({ ...t, id: t.id || lsNextId(), completada: false, creadaEn: new Date().toISOString(), orden: i }))
    lsSave([...actuales, ...nuevas])
    return { data: nuevas, error: null }
  }
  try {
    if (postId) {
      const { data: existentes, error: checkErr } = await supabase.from('tareas').select('id').eq('post_id', postId).limit(1)
      if (checkErr) throw checkErr
      if (existentes.length > 0) return { data: [], error: null }
    }
    const { data: { user } } = await supabase.auth.getUser()
    const rows = tareasArr.map((t, i) => ({ ...tareaDataParaDB({ ...t, orden: i }), user_id: user.id }))
    const { data, error } = await supabase.from('tareas').insert(rows).select()
    if (error) throw error
    return { data: data.map(mapearTarea), error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, guardando en localStorage:', error.message)
    const actuales = lsRead()
    if (postId && actuales.some(t => t.postId === postId)) return { data: [], error: null }
    const nuevas = tareasArr.map((t, i) => ({ ...t, id: t.id || lsNextId(), completada: false, creadaEn: new Date().toISOString(), orden: i }))
    lsSave([...actuales, ...nuevas])
    return { data: nuevas, error: null }
  }
}

export async function actualizarTarea(id, datos) {
  if (!supabase) {
    const updated = lsRead().map(t => String(t.id) === String(id) ? { ...t, ...datos } : t)
    lsSave(updated)
    return { data: updated.find(t => String(t.id) === String(id)), error: null }
  }
  try {
    const row = {}
    if (datos.titulo !== undefined) row.titulo = datos.titulo
    if (datos.clienteId !== undefined) row.cliente_id = datos.clienteId || null
    if (datos.postId !== undefined) row.post_id = datos.postId || null
    if (datos.paso !== undefined) row.paso = datos.paso || null
    if (datos.red !== undefined) row.red = datos.red
    if (datos.fechaLimite !== undefined) row.fecha_limite = datos.fechaLimite
    if (datos.fechaEdicion !== undefined) row.fecha_edicion = datos.fechaEdicion || null
    if (datos.nota !== undefined) row.nota = datos.nota
    if (datos.orden !== undefined) row.orden = datos.orden
    if (datos.subtitulo !== undefined) row.subtitulo = datos.subtitulo
    if (datos.tipo !== undefined) row.tipo = datos.tipo
    if (datos.fases !== undefined) row.fases = datos.fases
    if (datos.enProgreso !== undefined) row.en_progreso = datos.enProgreso
    // archivada_en llega con la migración 0022: solo se envía si se pide
    if (datos.archivadaEn !== undefined) row.archivada_en = datos.archivadaEn
    // columna_id llega con la migración 0024: solo se envía si se pide
    if (datos.columnaId !== undefined) row.columna_id = datos.columnaId
    if (datos.completada !== undefined) {
      row.completada = datos.completada
      row.completada_en = datos.completada ? new Date().toISOString() : null
    }
    const { data, error } = await supabase.from('tareas').update(row).eq('id', id).select().single()
    if (error) throw error
    return { data: mapearTarea(data), error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, actualizando en localStorage:', error.message)
    const updated = lsRead().map(t => String(t.id) === String(id) ? { ...t, ...datos } : t)
    lsSave(updated)
    return { data: updated.find(t => String(t.id) === String(id)), error: null }
  }
}

// Advances a phased tarea to its next fase (marks the active fase completed and
// copies the next fase's fields to row level), or — if it was the last fase —
// completes the row itself, same as completing a plain unphased tarea.
export async function completarFaseActual(tarea) {
  const fases = tarea.fases || []
  const idx = fases.findIndex(f => !f.completada)
  if (idx === -1) return { data: tarea, faseCompletadaTipo: null }
  const now = new Date().toISOString()
  const nuevasFases = fases.map((f, i) => i === idx ? { ...f, completada: true, completadaEn: now } : f)
  const faseCompletadaTipo = fases[idx].tipo
  const siguiente = nuevasFases[idx + 1]
  const cambios = siguiente
    ? {
        fases: nuevasFases,
        titulo: siguiente.titulo,
        subtitulo: siguiente.subtitulo || '',
        fechaLimite: siguiente.fechaLimite,
        tipo: siguiente.tipo,
        completada: false,
        completadaEn: null,
      }
    : {
        fases: nuevasFases,
        completada: true,
        completadaEn: now,
      }
  const { data } = await actualizarTarea(tarea.id, cambios)
  return { data, faseCompletadaTipo }
}

// Undoes the last completed fase — restores its fields to row level and marks it
// pending again. Used both for unchecking a phased tarea and for dragging its
// board card back one column.
export async function retrocederFase(tarea) {
  const fases = tarea.fases || []
  let idx = -1
  for (let i = fases.length - 1; i >= 0; i--) {
    if (fases[i].completada) { idx = i; break }
  }
  if (idx === -1) return { data: tarea }
  const nuevasFases = fases.map((f, i) => i === idx ? { ...f, completada: false, completadaEn: null } : f)
  const fase = nuevasFases[idx]
  const cambios = {
    fases: nuevasFases,
    titulo: fase.titulo,
    subtitulo: fase.subtitulo || '',
    fechaLimite: fase.fechaLimite,
    tipo: fase.tipo,
    completada: false,
    completadaEn: null,
  }
  const { data } = await actualizarTarea(tarea.id, cambios)
  return { data }
}

// Marks every tarea whose postId matches as completed (post → "publicado" sync).
// For a phased tarea this also marks every fase completed, so the fase indicator
// reflects "done" rather than getting stuck mid-sequence.
export async function completarTareasDelPost(postId) {
  const now = new Date().toISOString()
  const marcarCompleta = (t) => ({
    ...t,
    fases: t.fases ? t.fases.map(f => ({ ...f, completada: true, completadaEn: f.completadaEn || now })) : t.fases,
    completada: true,
    completadaEn: now,
  })
  if (!supabase) {
    lsSave(lsRead().map(t => String(t.postId) === String(postId) ? marcarCompleta(t) : t))
    return { error: null }
  }
  try {
    const { data: filas, error: selErr } = await supabase.from('tareas').select('*').eq('post_id', postId)
    if (selErr) throw selErr
    for (const fila of filas) {
      const tarea = mapearTarea(fila)
      const actualizada = marcarCompleta(tarea)
      const row = { completada: true, completada_en: now }
      if (actualizada.fases) row.fases = actualizada.fases
      const { error } = await supabase.from('tareas').update(row).eq('id', tarea.id)
      if (error) throw error
    }
    return { error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, actualizando en localStorage:', error.message)
    lsSave(lsRead().map(t => String(t.postId) === String(postId) ? marcarCompleta(t) : t))
    return { error: null }
  }
}

export async function eliminarTarea(id) {
  if (!supabase) {
    lsSave(lsRead().filter(t => String(t.id) !== String(id)))
    return { error: null }
  }
  try {
    const { error } = await supabase.from('tareas').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, eliminando de localStorage:', error.message)
    lsSave(lsRead().filter(t => String(t.id) !== String(id)))
    return { error: null }
  }
}

// Pasa todas las tareas de una columna del tablero a otra (se usa antes de
// borrar una columna). Requiere la migración 0024.
export async function moverTareasDeColumna(desdeId, hastaId) {
  if (!supabase) {
    lsSave(lsRead().map(t => String(t.columnaId) === String(desdeId) ? { ...t, columnaId: hastaId } : t))
    return { error: null }
  }
  const { error } = await supabase.from('tareas').update({ columna_id: hastaId }).eq('columna_id', desdeId)
  if (error) console.warn('[useTareas] no se pudieron mover las tareas de columna:', error.message)
  return { error }
}

// ── Archivado ─────────────────────────────────────────────────────────────────
// Las completadas se archivan solas a las 24 h; las vencidas, con el botón
// "Archivar vencidas"; las archivadas se borran a los 7 días (ver
// 0022_tareas_archivadas.sql). Sin la migración aplicada, la columna no existe
// y todo esto se desactiva solo (soportaArchivado).

const DIA_MS = 24 * 60 * 60 * 1000
let soportaArchivado = !supabase // en localStorage siempre se puede
let ultimoMantenimiento = 0

export async function archivarTareas(ids, archivar = true) {
  if (!ids.length) return { error: null }
  const archivadaEn = archivar ? new Date().toISOString() : null
  if (!supabase) {
    const set = new Set(ids.map(String))
    lsSave(lsRead().map(t => set.has(String(t.id)) ? { ...t, archivadaEn } : t))
    return { error: null }
  }
  const { error } = await supabase.from('tareas').update({ archivada_en: archivadaEn }).in('id', ids)
  if (error) console.warn('[useTareas] no se pudieron archivar las tareas:', error.message)
  return { error }
}

async function borrarTareas(ids) {
  if (!ids.length) return
  if (!supabase) {
    const set = new Set(ids.map(String))
    lsSave(lsRead().filter(t => !set.has(String(t.id))))
    return
  }
  const { error } = await supabase.from('tareas').delete().in('id', ids)
  if (error) console.warn('[useTareas] no se pudieron borrar las archivadas antiguas:', error.message)
}

// Archiva las completadas hace más de 24 h y borra las archivadas hace más de
// 7 días. Como mucho una vez cada 10 minutos por pestaña. Devuelve true si
// cambió algo (para volver a leer).
async function mantenerTareas(tareas) {
  if (!soportaArchivado || Date.now() - ultimoMantenimiento < 10 * 60 * 1000) return false
  ultimoMantenimiento = Date.now()
  const ahora = Date.now()
  const porArchivar = tareas
    .filter(t => !t.archivadaEn && t.completada && t.completadaEn && ahora - new Date(t.completadaEn).getTime() > DIA_MS)
    .map(t => t.id)
  const porBorrar = tareas
    .filter(t => t.archivadaEn && ahora - new Date(t.archivadaEn).getTime() > 7 * DIA_MS)
    .map(t => t.id)
  await archivarTareas(porArchivar)
  await borrarTareas(porBorrar)
  return porArchivar.length > 0 || porBorrar.length > 0
}

// Batch-renumber `orden` for one section only (orden is never compared across
// sections at render time, so a global renumber like the old code did is unnecessary).
export async function reordenarSeccion(tareasSeccion) {
  const actualizadas = tareasSeccion.map((t, i) => ({ ...t, orden: i }))
  if (!supabase) {
    const ids = new Set(actualizadas.map(t => String(t.id)))
    const porId = new Map(actualizadas.map(t => [String(t.id), t]))
    const updated = lsRead().map(t => ids.has(String(t.id)) ? porId.get(String(t.id)) : t)
    lsSave(updated)
    return { error: null }
  }
  try {
    const rows = actualizadas.map(t => ({ id: t.id, orden: t.orden }))
    const { error } = await supabase.from('tareas').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.warn('[useTareas] Supabase no disponible, actualizando en localStorage:', error.message)
    const ids = new Set(actualizadas.map(t => String(t.id)))
    const porId = new Map(actualizadas.map(t => [String(t.id), t]))
    const updated = lsRead().map(t => ids.has(String(t.id)) ? porId.get(String(t.id)) : t)
    lsSave(updated)
    return { error: null }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// `tareas` son las activas (sin archivar): es lo que ven el Inicio, el menú,
// el calendario y la ficha del cliente. `archivadas` solo la usa la página de
// Tareas.
export function useTareasList() {
  const [todas, setTareas] = useState(() => supabase ? [] : lsRead())
  const [loading, setLoading] = useState(!!supabase)

  const refetch = useCallback(async () => {
    setLoading(true)
    let { data } = await getTareas()
    if (await mantenerTareas(data || [])) ({ data } = await getTareas())
    setTareas(data)
    setLoading(false)
  }, [])

  const tareas = todas.filter(t => !t.archivadaEn)
  const archivadas = todas.filter(t => t.archivadaEn)

  useEffect(() => {
    if (!supabase) {
      const h = () => setTareas(lsRead())
      window.addEventListener('aify:todo', h)
      return () => window.removeEventListener('aify:todo', h)
    }
    refetch()
  }, [refetch])

  return { tareas, archivadas, soportaArchivado, setTareas, loading, refetch }
}
