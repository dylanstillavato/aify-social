import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { getPostsCliente, eliminarPost } from './useCalendario'

const LS_KEY = 'aify_ideas_guardadas'

// ── localStorage helpers (only used when Supabase not configured) ──────────────

function lsRead() {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s !== null ? JSON.parse(s) : []
  } catch { return [] }
}

function lsSave(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('aify:ideas'))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
  }
}

// ── Supabase mappers ──────────────────────────────────────────────────────────

function mapearIdea(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    titulo: row.titulo,
    tipo: row.tipo || '',
    formato: row.formato || '',
    concepto: row.concepto || '',
    porQueFunc: row.por_que_funciona || '',
    dificultad: row.dificultad || '',
    tiempoEstimado: row.tiempo_estimado || '',
    formatoSugerido: row.formato_sugerido || '',
    guion: row.guion || null,
    guionGuardadoEn: row.guion_guardado_en,
    guionHistorial: row.guion_historial || [],
    copy: row.copy || null,
    copyHistorial: row.copy_historial || [],
    mes: row.mes || null,
    tipoPieza: row.tipo_pieza || null,
    planMesId: row.plan_mes_id || null,
    feedback: row.feedback || '',
    fechaGuardada: row.creada_en,
  }
}

function ideaDataParaDB(datos) {
  return {
    cliente_id: datos.clienteId || null,
    titulo: datos.titulo,
    tipo: datos.tipo || null,
    formato: datos.formato || null,
    concepto: datos.concepto || null,
    por_que_funciona: datos.porQueFunc || null,
    dificultad: datos.dificultad || null,
    tiempo_estimado: datos.tiempoEstimado || null,
    formato_sugerido: datos.formatoSugerido || null,
    // Plan del mes (0045): solo se envían con valor, para que guardar ideas
    // siga funcionando aunque la migración no esté aplicada
    ...(datos.mes ? { mes: datos.mes } : {}),
    ...(datos.tipoPieza ? { tipo_pieza: datos.tipoPieza } : {}),
    ...(datos.planMesId ? { plan_mes_id: datos.planMesId } : {}),
    ...(datos.feedback ? { feedback: datos.feedback } : {}),
  }
}

// ── CRUD: Supabase path or localStorage path ──────────────────────────────────

export async function getIdeas(clienteId, mes = null) {
  if (!supabase) {
    const all = lsRead()
    return { data: clienteId ? all.filter(i => String(i.clienteId) === String(clienteId) && (!mes || i.mes === mes)) : all, error: null }
  }
  try {
    let query = supabase.from('ideas').select('*').order('creada_en', { ascending: false })
    if (clienteId) query = query.eq('cliente_id', clienteId)
    if (mes) query = query.eq('mes', mes)
    const { data, error } = await query
    if (error) throw error
    return { data: data.map(mapearIdea), error: null }
  } catch (error) {
    console.warn('[useIdeas] Supabase no disponible, usando localStorage:', error.message)
    const all = lsRead()
    return { data: clienteId ? all.filter(i => String(i.clienteId) === String(clienteId)) : all, error: null }
  }
}

export async function crearIdea(datos) {
  if (!supabase) {
    const nuevo = { ...datos, id: datos.id || `idea_${Date.now()}`, fechaGuardada: new Date().toISOString() }
    lsSave([nuevo, ...lsRead()])
    return { data: nuevo, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const row = { ...ideaDataParaDB(datos), user_id: user.id }
    const { data, error } = await supabase.from('ideas').insert(row).select().single()
    if (error) throw error
    return { data: mapearIdea(data), error: null }
  } catch (error) {
    console.warn('[useIdeas] Supabase no disponible, guardando en localStorage:', error.message)
    const nuevo = { ...datos, id: datos.id || `idea_${Date.now()}`, fechaGuardada: new Date().toISOString() }
    lsSave([nuevo, ...lsRead()])
    return { data: nuevo, error: null }
  }
}

export async function actualizarIdea(id, datos) {
  if (!supabase) {
    const updated = lsRead().map(i => String(i.id) === String(id) ? { ...i, ...datos } : i)
    lsSave(updated)
    return { data: updated.find(i => String(i.id) === String(id)), error: null }
  }
  try {
    const row = {}
    if (datos.guion !== undefined) { row.guion = datos.guion; row.guion_guardado_en = new Date().toISOString() }
    if (datos.copy !== undefined) row.copy = datos.copy
    if (datos.formato !== undefined) row.formato = datos.formato
    // Edición a mano o reescrita con la IA (EditorIdea)
    if (datos.titulo !== undefined) row.titulo = datos.titulo
    if (datos.concepto !== undefined) row.concepto = datos.concepto || null
    if (datos.formatoSugerido !== undefined) row.formato_sugerido = datos.formatoSugerido || null
    if (datos.porQueFunc !== undefined) row.por_que_funciona = datos.porQueFunc || null
    if (datos.mes !== undefined) row.mes = datos.mes || null
    if (datos.tipoPieza !== undefined) row.tipo_pieza = datos.tipoPieza || null
    if (datos.planMesId !== undefined) row.plan_mes_id = datos.planMesId || null
    if (datos.feedback !== undefined) row.feedback = datos.feedback || null
    const { data, error } = await supabase.from('ideas').update(row).eq('id', id).select().single()
    if (error) throw error
    return { data: mapearIdea(data), error: null }
  } catch (error) {
    console.warn('[useIdeas] Supabase no disponible, actualizando en localStorage:', error.message)
    const updated = lsRead().map(i => String(i.id) === String(id) ? { ...i, ...datos } : i)
    lsSave(updated)
    return { data: updated.find(i => String(i.id) === String(id)), error: null }
  }
}

export async function eliminarIdea(id) {
  if (!supabase) {
    lsSave(lsRead().filter(i => String(i.id) !== String(id)))
    return { error: null }
  }
  try {
    const { error } = await supabase.from('ideas').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.warn('[useIdeas] Supabase no disponible, eliminando de localStorage:', error.message)
    lsSave(lsRead().filter(i => String(i.id) !== String(id)))
    return { error: null }
  }
}

// Borra una idea y todos los guiones (posts) que salieron de ella. Los posts
// van primero: si se borrase antes la idea, origen_idea_id pasaría a null y ya
// no se sabría cuáles eran. Las tareas enlazadas a esos posts caen en cascada.
export async function eliminarIdeaConGuiones(clienteId, ideaId) {
  const { data } = await getPostsCliente(clienteId, { incluirSinProgramar: true })
  const posts = (data || []).filter(p => String(p.origenIdeaId) === String(ideaId))
  for (const p of posts) {
    const { error } = await eliminarPost(clienteId, p.id)
    if (error) return { error }
  }
  return eliminarIdea(ideaId)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useIdeasList(clienteId) {
  const [ideas, setIdeas] = useState(() => supabase ? [] : lsRead())
  const [loading, setLoading] = useState(!!supabase)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await getIdeas(clienteId)
    setIdeas(data)
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    if (!supabase) {
      const h = () => setIdeas(clienteId ? lsRead().filter(i => String(i.clienteId) === String(clienteId)) : lsRead())
      h()
      window.addEventListener('aify:ideas', h)
      return () => window.removeEventListener('aify:ideas', h)
    }
    refetch()
  }, [refetch, clienteId])

  return { ideas, loading, refetch }
}
