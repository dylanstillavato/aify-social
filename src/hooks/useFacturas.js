import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

const LS_KEY = 'aify_facturas'

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
    window.dispatchEvent(new CustomEvent('aify:facturas'))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
  }
}

function lsNextId() { return `factura_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }

// ── Supabase mappers ──────────────────────────────────────────────────────────

function mapearFactura(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id ?? row.clienteId,
    numero: row.numero,
    fechaEmision: row.fecha_emision ?? row.fechaEmision,
    fechaVencimiento: row.fecha_vencimiento ?? row.fechaVencimiento ?? null,
    estado: row.estado || 'pendiente',
    items: row.items || [],
    subtotal: Number(row.subtotal) || 0,
    ivaPct: row.iva_pct ?? row.ivaPct ?? 21,
    iva: Number(row.iva) || 0,
    total: Number(row.total) || 0,
    ivaIncluido: !!(row.iva_incluido ?? row.ivaIncluido),
    notas: row.notas || '',
    emisor: row.emisor || {},
    creadoEn: row.creado_en || row.creadoEn,
    updatedAt: row.updated_at || row.updatedAt || null,
    presupuestoId: row.presupuesto_id ?? row.presupuestoId ?? null,
    periodo: row.periodo ?? null,
  }
}

// Columnas de la migración 0020 (presupuesto_id, periodo). Hasta que se ejecute
// en producción PostgREST rechaza columnas desconocidas, así que solo se
// incluyen en el payload cuando traen valor.
function añadirCamposDinero(row, datos) {
  if (datos.presupuestoId !== undefined && datos.presupuestoId !== null) row.presupuesto_id = datos.presupuestoId
  if (datos.periodo !== undefined && datos.periodo !== null) row.periodo = datos.periodo
  return row
}

// PGRST204 = "column not found in schema cache": la migración 0020 aún no está.
// Solo por código: el mensaje de un duplicado del índice único de periodo
// (23505) también contiene "periodo" y no debe provocar el reintento.
const esColumnaDesconocida = (error) =>
  error?.code === 'PGRST204' || error?.code === '42703'

function facturaDataParaDB(datos) {
  return {
    cliente_id: datos.clienteId,
    numero: datos.numero,
    fecha_emision: datos.fechaEmision,
    fecha_vencimiento: datos.fechaVencimiento || null,
    estado: datos.estado || 'pendiente',
    items: datos.items || [],
    subtotal: datos.subtotal || 0,
    iva_pct: datos.ivaPct ?? 21,
    iva: datos.iva || 0,
    total: datos.total || 0,
    notas: datos.notas || null,
    emisor: datos.emisor || {},
    // Solo si está activo: así se puede guardar aunque 0032 aún no esté aplicada
    ...(datos.ivaIncluido ? { iva_incluido: true } : {}),
  }
}

// ── CRUD: Supabase path or localStorage path ──────────────────────────────────

export async function getFacturas() {
  if (!supabase) {
    return { data: [...lsRead()].sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')), error: null }
  }
  try {
    const { data, error } = await supabase
      .from('facturas').select('*').order('creado_en', { ascending: false })
    if (error) throw error
    return { data: data.map(mapearFactura), error: null }
  } catch (error) {
    console.warn('[useFacturas] Supabase no disponible, usando localStorage:', error.message)
    return { data: [...lsRead()].sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')), error: null }
  }
}

export async function getFacturasCliente(clienteId) {
  if (!supabase) {
    return { data: lsRead().filter(f => String(f.clienteId) === String(clienteId)), error: null }
  }
  try {
    const { data, error } = await supabase
      .from('facturas').select('*')
      .eq('cliente_id', clienteId).order('creado_en', { ascending: false })
    if (error) throw error
    return { data: data.map(mapearFactura), error: null }
  } catch (error) {
    console.warn('[useFacturas] Supabase no disponible, usando localStorage:', error.message)
    return { data: lsRead().filter(f => String(f.clienteId) === String(clienteId)), error: null }
  }
}

export async function getFactura(id) {
  if (!supabase) {
    const found = lsRead().find(f => String(f.id) === String(id))
    return { data: found || null, error: found ? null : new Error('No encontrada') }
  }
  try {
    const { data, error } = await supabase.from('facturas').select('*').eq('id', id).single()
    if (error) throw error
    return { data: mapearFactura(data), error: null }
  } catch (error) {
    console.warn('[useFacturas] Supabase no disponible, usando localStorage:', error.message)
    const found = lsRead().find(f => String(f.id) === String(id))
    return { data: found || null, error: found ? null : new Error('No encontrada') }
  }
}

export async function crearFactura(datos) {
  if (!supabase) {
    const nueva = { ...datos, id: datos.id || lsNextId(), estado: datos.estado || 'pendiente', creadoEn: new Date().toISOString() }
    lsSave([nueva, ...lsRead()])
    return { data: nueva, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const row = añadirCamposDinero({ ...facturaDataParaDB(datos), user_id: user.id }, datos)
    let { data, error } = await supabase.from('facturas').insert(row).select().single()
    if (error && esColumnaDesconocida(error) && (row.presupuesto_id !== undefined || row.periodo !== undefined)) {
      // Sin la migración 0020: se guarda la factura igualmente, sin el vínculo
      // al presupuesto ni el periodo, en vez de caer a localStorage.
      delete row.presupuesto_id
      delete row.periodo
      ;({ data, error } = await supabase.from('facturas').insert(row).select().single())
    }
    if (error) throw error
    return { data: mapearFactura(data), error: null }
  } catch (error) {
    console.warn('[useFacturas] Supabase no disponible, guardando en localStorage:', error.message)
    const nueva = { ...datos, id: datos.id || lsNextId(), estado: datos.estado || 'pendiente', creadoEn: new Date().toISOString() }
    lsSave([nueva, ...lsRead()])
    return { data: nueva, error: null }
  }
}

export async function actualizarFactura(id, datos) {
  if (!supabase) {
    const updated = lsRead().map(f => String(f.id) === String(id) ? { ...f, ...datos } : f)
    lsSave(updated)
    return { data: updated.find(f => String(f.id) === String(id)), error: null }
  }
  try {
    const row = {}
    if (datos.clienteId !== undefined) row.cliente_id = datos.clienteId
    if (datos.numero !== undefined) row.numero = datos.numero
    if (datos.fechaEmision !== undefined) row.fecha_emision = datos.fechaEmision
    if (datos.fechaVencimiento !== undefined) row.fecha_vencimiento = datos.fechaVencimiento
    if (datos.estado !== undefined) row.estado = datos.estado
    if (datos.items !== undefined) row.items = datos.items
    if (datos.subtotal !== undefined) row.subtotal = datos.subtotal
    if (datos.ivaPct !== undefined) row.iva_pct = datos.ivaPct
    if (datos.iva !== undefined) row.iva = datos.iva
    if (datos.total !== undefined) row.total = datos.total
    if (datos.ivaIncluido !== undefined) row.iva_incluido = datos.ivaIncluido
    if (datos.notas !== undefined) row.notas = datos.notas
    if (datos.emisor !== undefined) row.emisor = datos.emisor
    añadirCamposDinero(row, datos)
    row.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('facturas').update(row).eq('id', id).select().single()
    if (error) throw error
    return { data: mapearFactura(data), error: null }
  } catch (error) {
    console.warn('[useFacturas] Supabase no disponible, actualizando en localStorage:', error.message)
    const updated = lsRead().map(f => String(f.id) === String(id) ? { ...f, ...datos } : f)
    lsSave(updated)
    return { data: updated.find(f => String(f.id) === String(id)), error: null }
  }
}

export async function eliminarFactura(id) {
  if (!supabase) {
    lsSave(lsRead().filter(f => String(f.id) !== String(id)))
    return { error: null }
  }
  try {
    const { error } = await supabase.from('facturas').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.warn('[useFacturas] Supabase no disponible, eliminando de localStorage:', error.message)
    lsSave(lsRead().filter(f => String(f.id) !== String(id)))
    return { error: null }
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFacturasList() {
  const [facturas, setFacturasState] = useState(() => supabase ? [] : lsRead())
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!supabase) {
      setFacturasState(lsRead())
      return
    }
    setLoading(true)
    const { data, error: err } = await getFacturas()
    setFacturasState(data)
    setError(err)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) {
      const h = () => setFacturasState(lsRead())
      window.addEventListener('aify:facturas', h)
      return () => window.removeEventListener('aify:facturas', h)
    }
    refetch()
  }, [refetch])

  return { facturas, loading, error, refetch }
}

export function useFacturasCliente(clienteId) {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!clienteId) { setFacturas([]); setLoading(false); return }
    setLoading(true)
    const { data } = await getFacturasCliente(clienteId)
    setFacturas(data)
    setLoading(false)
  }, [clienteId])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    if (supabase) return
    const h = () => refetch()
    window.addEventListener('aify:facturas', h)
    return () => window.removeEventListener('aify:facturas', h)
  }, [refetch])

  return { facturas, loading, refetch }
}
