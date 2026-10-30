import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { actualizarTarea, moverTareasDeColumna } from './useTareas'
import { actualizarEtapaCliente, moverClientesDeEtapa } from './useClientes'
import { actualizarPost } from './useCalendario'
import { programarEnSiguienteHueco } from '../services/huecosCliente'
import { ORIGEN_PRODUCCION } from '../utils/vencimiento'

// Tableros Kanban (migración 0024_tableros.sql): columnas por organización
// para dos tableros, 'tareas' y 'clientes'. Las tarjetas se mueven SOLO a
// mano — nada avanza de columna automáticamente. La única regla: la columna
// es_final ("Hecho") completa la tarea al soltarla ahí, y sacarla la
// descompleta; a partir de ahí el archivado de 24 h (0022) sigue igual.

const LS_KEY = 'aify_tableros'

export const COLUMNAS_POR_DEFECTO = {
  tareas: [
    { nombre: 'Por grabar', color: '#1D5FE0' },
    { nombre: 'Por editar', color: '#FF9500' },
    { nombre: 'Por publicar', color: '#AF52DE' },
    { nombre: 'Hecho', color: '#30D158', esFinal: true },
  ],
  clientes: [
    { nombre: 'Presupuesto enviado', color: '#86868B' },
    { nombre: 'Presupuesto firmado', color: '#3D9BFF' },
    { nombre: 'Onboarding', color: '#1D5FE0' },
    { nombre: 'Guiones aprobados', color: '#AF52DE' },
    { nombre: 'Día de grabación', color: '#FF2D55' },
    { nombre: 'En edición', color: '#FF9500' },
    { nombre: 'Vídeos entregados', color: '#64D2FF' },
    { nombre: 'Pagado', color: '#30D158' },
  ],
}

export const COLORES_COLUMNA = ['#86868B', '#1D5FE0', '#3D9BFF', '#64D2FF', '#30D158', '#FF9500', '#FF3B30', '#FF2D55', '#AF52DE']

// ── localStorage (solo sin Supabase) ──────────────────────────────────────────

function lsLeer() {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function lsGuardar(tablero, columnas) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...lsLeer(), [tablero]: columnas }))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') window.dispatchEvent(new CustomEvent('aify:storage_full'))
  }
}

function lsId() { return `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapearColumna(row) {
  return {
    id: row.id,
    tablero: row.tablero,
    nombre: row.nombre,
    orden: row.orden ?? 0,
    color: row.color || null,
    esFinal: !!(row.es_final ?? row.esFinal),
  }
}

const ordenar = (cols) => [...cols].sort((a, b) => a.orden - b.orden)

// La tabla no existe todavía (migración 0024 sin aplicar)
function esTablaInexistente(error) {
  const msg = `${error?.message || ''} ${error?.details || ''}`
  return error?.code === '42P01' || error?.code === 'PGRST205' || msg.includes('tablero_columnas')
}

// ── Lectura (+ columnas por defecto la primera vez) ───────────────────────────

// Evita crear las columnas por defecto dos veces si el tablero se monta dos
// veces a la vez (StrictMode, dos componentes): la primera carga se comparte.
const cargasEnCurso = new Map()

async function contexto() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: orgId } = await supabase.rpc('mi_organizacion_id')
  return { userId: user?.id, orgId: orgId || null }
}

async function cargarColumnasSupabase(tablero) {
  const { userId, orgId } = await contexto()
  let q = supabase.from('tablero_columnas').select('*').eq('tablero', tablero)
  q = orgId ? q.eq('organizacion_id', orgId) : q.eq('user_id', userId)
  const { data, error } = await q.order('orden', { ascending: true })
  if (error) throw error
  if (data.length) return data.map(mapearColumna)
  const filas = COLUMNAS_POR_DEFECTO[tablero].map((c, i) => ({
    organizacion_id: orgId,
    user_id: userId,
    tablero,
    nombre: c.nombre,
    orden: i,
    color: c.color || null,
    es_final: !!c.esFinal,
  }))
  const { data: creadas, error: errCrear } = await supabase.from('tablero_columnas').insert(filas).select()
  if (errCrear) throw errCrear
  return ordenar(creadas.map(mapearColumna))
}

function cargarColumnasLocal(tablero) {
  const guardadas = lsLeer()[tablero]
  if (guardadas?.length) return ordenar(guardadas)
  const cols = COLUMNAS_POR_DEFECTO[tablero].map((c, i) => ({
    id: lsId(), tablero, nombre: c.nombre, orden: i, color: c.color || null, esFinal: !!c.esFinal,
  }))
  lsGuardar(tablero, cols)
  return cols
}

// Devuelve { columnas, sinMigracion, error }
export async function getColumnas(tablero) {
  if (!supabase) return { columnas: cargarColumnasLocal(tablero), sinMigracion: false, error: null }
  if (!cargasEnCurso.has(tablero)) {
    cargasEnCurso.set(tablero, cargarColumnasSupabase(tablero).finally(() => cargasEnCurso.delete(tablero)))
  }
  try {
    return { columnas: await cargasEnCurso.get(tablero), sinMigracion: false, error: null }
  } catch (error) {
    if (esTablaInexistente(error)) {
      console.warn('[useTableros] falta la migración 0024_tableros.sql:', error.message)
      return { columnas: [], sinMigracion: true, error: null }
    }
    console.error('[useTableros] no se pudieron cargar las columnas:', error.message)
    return { columnas: [], sinMigracion: false, error }
  }
}

// ── Escritura de columnas ─────────────────────────────────────────────────────

async function actualizarColumnaDB(tablero, id, cambios) {
  if (!supabase) {
    lsGuardar(tablero, (lsLeer()[tablero] || []).map(c => c.id === id ? { ...c, ...cambios } : c))
    return { error: null }
  }
  const row = {}
  if (cambios.nombre !== undefined) row.nombre = cambios.nombre
  if (cambios.orden !== undefined) row.orden = cambios.orden
  if (cambios.color !== undefined) row.color = cambios.color
  if (cambios.esFinal !== undefined) row.es_final = cambios.esFinal
  const { error } = await supabase.from('tablero_columnas').update(row).eq('id', id)
  if (error) console.error('[useTableros] no se pudo actualizar la columna:', error.message)
  return { error }
}

async function crearColumnaDB(tablero, datos) {
  if (!supabase) {
    const nueva = { id: lsId(), tablero, color: null, esFinal: false, ...datos }
    lsGuardar(tablero, [...(lsLeer()[tablero] || []), nueva])
    return { data: nueva, error: null }
  }
  const { userId, orgId } = await contexto()
  const { data, error } = await supabase.from('tablero_columnas').insert({
    organizacion_id: orgId, user_id: userId, tablero,
    nombre: datos.nombre, orden: datos.orden, color: datos.color || null, es_final: !!datos.esFinal,
  }).select().single()
  if (error) { console.error('[useTableros] no se pudo crear la columna:', error.message); return { data: null, error } }
  return { data: mapearColumna(data), error: null }
}

async function eliminarColumnaDB(tablero, id) {
  if (!supabase) {
    lsGuardar(tablero, (lsLeer()[tablero] || []).filter(c => c.id !== id))
    return { error: null }
  }
  const { error } = await supabase.from('tablero_columnas').delete().eq('id', id)
  if (error) console.error('[useTableros] no se pudo borrar la columna:', error.message)
  return { error }
}

// ── Mover tarjetas ────────────────────────────────────────────────────────────

// Coloca una tarea en `columna` y renumera `orden` de toda la columna destino
// según `idsOrdenados` (las tarjetas que aún no tenían columna quedan
// asignadas aquí). Solo se escriben las que cambian.
export async function moverTarea({ tarea, columna, idsOrdenados, tareas }) {
  const porId = new Map(tareas.map(t => [String(t.id), t]))
  const escrituras = idsOrdenados.map((id, i) => {
    const t = String(id) === String(tarea.id) ? tarea : porId.get(String(id))
    if (!t) return null
    const cambios = {}
    if (String(t.columnaId) !== String(columna.id)) cambios.columnaId = columna.id
    if (t.orden !== i) cambios.orden = i
    if (String(id) === String(tarea.id) && !!t.completada !== columna.esFinal) {
      cambios.completada = columna.esFinal
      // en localStorage completada_en no se calcula solo (y el archivado de 24 h lo necesita)
      cambios.completadaEn = columna.esFinal ? new Date().toISOString() : null
    }
    return Object.keys(cambios).length ? actualizarTarea(t.id, cambios) : null
  }).filter(Boolean)
  await Promise.all(escrituras)
  // El estado del post del calendario va con el tablero: en la columna final
  // ("Hecho") está publicado; al sacarlo de ahí, vuelve a aprobado. Las
  // tareas antiguas de "Desarrollar" solo marcaban el post como desarrollado.
  if (tarea.postId && tarea.clienteId && !!tarea.completada !== columna.esFinal) {
    if (tarea.tipo === 'desarrollar') {
      if (columna.esFinal) await actualizarPost(tarea.clienteId, tarea.postId, { desarrollado: true })
    } else {
      await actualizarPost(tarea.clienteId, tarea.postId, { estado: columna.esFinal ? 'publicado' : 'aprobado' })
    }
  }
  // Vídeo editado (tarjeta de producción que pasa de "Por editar" en adelante
  // sin llegar a "Hecho") y aún sin publicación: va solo al siguiente hueco
  // sugerido de su formato. Devuelve el día elegido para poder avisarlo.
  if (tarea.origen === ORIGEN_PRODUCCION && tarea.postId && tarea.clienteId && !columna.esFinal && !tarea.fechaPublicacion) {
    const { columnas } = await getColumnas('tareas')
    const idx = columnas.findIndex(c => String(c.id) === String(columna.id))
    if (idx >= 2) return programarEnSiguienteHueco(tarea.clienteId, tarea.postId)
  }
  return { fecha: null }
}

// Columna del tablero en la que está una tarea (misma regla que /todo: sin
// columna, la primera; completada sin columna, la final)
export function columnaDeTarea(tarea, columnas) {
  if (!columnas.length) return null
  return columnas.find(c => String(c.id) === String(tarea.columnaId))
    || (tarea.completada && columnas.find(c => c.esFinal)) || columnas[0]
}

// Igual para clientes: etapa_id + etapa_orden.
export async function moverCliente({ columna, idsOrdenados, clientes }) {
  const porId = new Map(clientes.map(c => [String(c.id), c]))
  const escrituras = idsOrdenados.map((id, i) => {
    const c = porId.get(String(id))
    if (!c) return null
    if (String(c.etapaId) === String(columna.id) && c.etapaOrden === i) return null
    return actualizarEtapaCliente(c.id, columna.id, i)
  }).filter(Boolean)
  const res = await Promise.all(escrituras)
  if (supabase) window.dispatchEvent(new CustomEvent('aify:clientes'))
  return { error: res.find(r => r?.error)?.error || null }
}

// Al soltar una tarjeta el navegador puede disparar un click sobre ella; las
// tarjetas que navegan al pulsarlas lo comprueban con acabaDeArrastrar().
let ultimoArrastre = 0
export function marcarArrastre() { ultimoArrastre = Date.now() }
export function acabaDeArrastrar() { return Date.now() - ultimoArrastre < 300 }

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTablero(tablero) {
  const [estado, setEstado] = useState({ columnas: [], loading: true, sinMigracion: false, error: null })

  const recargar = useCallback(async () => {
    const r = await getColumnas(tablero)
    setEstado({ ...r, loading: false })
    return r
  }, [tablero])

  useEffect(() => {
    let vivo = true
    getColumnas(tablero).then(r => { if (vivo) setEstado({ ...r, loading: false }) })
    return () => { vivo = false }
  }, [tablero])

  const { columnas } = estado
  const editable = !estado.loading && !estado.sinMigracion && !estado.error && columnas.length > 0

  const setColumnasLocal = (fn) => setEstado(s => ({ ...s, columnas: fn(s.columnas) }))

  const renombrarColumna = async (id, nombre) => {
    const limpio = (nombre || '').trim()
    if (!limpio) return
    setColumnasLocal(cols => cols.map(c => c.id === id ? { ...c, nombre: limpio } : c))
    const { error } = await actualizarColumnaDB(tablero, id, { nombre: limpio })
    if (error) recargar()
  }

  const cambiarColorColumna = async (id, color) => {
    setColumnasLocal(cols => cols.map(c => c.id === id ? { ...c, color } : c))
    const { error } = await actualizarColumnaDB(tablero, id, { color })
    if (error) recargar()
  }

  // idsOrdenados: todas las columnas en el orden nuevo
  const reordenarColumnas = async (idsOrdenados) => {
    const actuales = new Map(columnas.map(c => [c.id, c]))
    setColumnasLocal(cols => ordenar(cols.map(c => ({ ...c, orden: idsOrdenados.indexOf(c.id) }))))
    await Promise.all(idsOrdenados
      .map((id, i) => actuales.get(id)?.orden !== i ? actualizarColumnaDB(tablero, id, { orden: i }) : null)
      .filter(Boolean))
    return recargar()
  }

  const moverColumna = (id, direccion) => {
    const ids = columnas.map(c => c.id)
    const i = ids.indexOf(id)
    const j = i + direccion
    if (i === -1 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    return reordenarColumnas(ids)
  }

  // Nueva columna al final, pero antes de la columna de "hecho" si es la última.
  const crearColumna = async (nombre) => {
    const limpio = (nombre || '').trim()
    if (!limpio) return
    const ultima = columnas[columnas.length - 1]
    if (ultima?.esFinal) {
      await actualizarColumnaDB(tablero, ultima.id, { orden: ultima.orden + 1 })
      await crearColumnaDB(tablero, { nombre: limpio, orden: ultima.orden })
    } else {
      await crearColumnaDB(tablero, { nombre: limpio, orden: (ultima?.orden ?? -1) + 1 })
    }
    return recargar()
  }

  // Sus tarjetas pasan a la primera columna que quede. Siempre queda al menos una.
  const eliminarColumna = async (id) => {
    if (columnas.length <= 1) return
    const destino = columnas.find(c => c.id !== id)
    if (tablero === 'tareas') await moverTareasDeColumna(id, destino.id)
    else await moverClientesDeEtapa(id, destino.id)
    await eliminarColumnaDB(tablero, id)
    return recargar()
  }

  return {
    ...estado,
    editable,
    recargar,
    crearColumna,
    renombrarColumna,
    cambiarColorColumna,
    reordenarColumnas,
    moverColumna,
    eliminarColumna,
  }
}
