import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

const LS_KEY = 'aify_presupuestos'

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
    window.dispatchEvent(new CustomEvent('aify:presupuestos'))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
  }
}

function lsNextId() { return `presupuesto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
function lsNextToken() {
  // Not a cryptographically strong UUID, but this is only ever used in
  // localStorage-fallback mode (no Supabase configured) — good enough as a
  // stand-in for the real `gen_random_uuid()` token column.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ── Supabase mappers ──────────────────────────────────────────────────────────

function mapearPresupuesto(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id ?? row.clienteId,
    numero: row.numero,
    fechaEmision: row.fecha_emision ?? row.fechaEmision,
    validezHasta: row.validez_hasta ?? row.validezHasta ?? null,
    estado: row.estado || 'borrador',
    items: row.items || [],
    subtotal: Number(row.subtotal) || 0,
    ivaPct: row.iva_pct ?? row.ivaPct ?? 21,
    iva: Number(row.iva) || 0,
    total: Number(row.total) || 0,
    ivaIncluido: !!(row.iva_incluido ?? row.ivaIncluido),
    cuotaMensual: row.cuota_mensual ?? row.cuotaMensual ?? null,
    pedirOnboarding: !!(row.pedir_onboarding ?? row.pedirOnboarding),
    notas: row.notas || '',
    emisor: row.emisor || {},
    token: row.token,
    firmaDataUrl: row.firma_data_url ?? row.firmaDataUrl ?? null,
    firmadoEn: row.firmado_en ?? row.firmadoEn ?? null,
    firmanteNombre: row.firmante_nombre ?? row.firmanteNombre ?? '',
    firmanteEmail: row.firmante_email ?? row.firmanteEmail ?? '',
    creadoEn: row.creado_en || row.creadoEn,
    updatedAt: row.updated_at || row.updatedAt || null,
  }
}

function presupuestoDataParaDB(datos) {
  return {
    cliente_id: datos.clienteId,
    numero: datos.numero,
    fecha_emision: datos.fechaEmision,
    validez_hasta: datos.validezHasta || null,
    estado: datos.estado || 'borrador',
    items: datos.items || [],
    subtotal: datos.subtotal || 0,
    iva_pct: datos.ivaPct ?? 21,
    iva: datos.iva || 0,
    total: datos.total || 0,
    notas: datos.notas || null,
    emisor: datos.emisor || {},
    // Solo si está activo: así se puede guardar aunque 0032 aún no esté aplicada
    ...(datos.ivaIncluido ? { iva_incluido: true } : {}),
    // Igual con cuota y onboarding (0047): solo se mandan si hay algo
    ...(Number(datos.cuotaMensual) > 0 ? { cuota_mensual: Number(datos.cuotaMensual) } : {}),
    ...(datos.pedirOnboarding ? { pedir_onboarding: true } : {}),
  }
}

// ── CRUD: Supabase path or localStorage path ──────────────────────────────────

export async function getPresupuestos() {
  if (!supabase) {
    return { data: [...lsRead()].sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')), error: null }
  }
  try {
    const { data, error } = await supabase
      .from('presupuestos').select('*').order('creado_en', { ascending: false })
    if (error) throw error
    return { data: data.map(mapearPresupuesto), error: null }
  } catch (error) {
    console.warn('[usePresupuestos] Supabase no disponible, usando localStorage:', error.message)
    return { data: [...lsRead()].sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')), error: null }
  }
}

export async function getPresupuestosCliente(clienteId) {
  if (!supabase) {
    return { data: lsRead().filter(p => String(p.clienteId) === String(clienteId)), error: null }
  }
  try {
    const { data, error } = await supabase
      .from('presupuestos').select('*')
      .eq('cliente_id', clienteId).order('creado_en', { ascending: false })
    if (error) throw error
    return { data: data.map(mapearPresupuesto), error: null }
  } catch (error) {
    console.warn('[usePresupuestos] Supabase no disponible, usando localStorage:', error.message)
    return { data: lsRead().filter(p => String(p.clienteId) === String(clienteId)), error: null }
  }
}

export async function getPresupuesto(id) {
  if (!supabase) {
    const found = lsRead().find(p => String(p.id) === String(id))
    return { data: found || null, error: found ? null : new Error('No encontrado') }
  }
  try {
    const { data, error } = await supabase.from('presupuestos').select('*').eq('id', id).single()
    if (error) throw error
    return { data: mapearPresupuesto(data), error: null }
  } catch (error) {
    console.warn('[usePresupuestos] Supabase no disponible, usando localStorage:', error.message)
    const found = lsRead().find(p => String(p.id) === String(id))
    return { data: found || null, error: found ? null : new Error('No encontrado') }
  }
}

export async function crearPresupuesto(datos) {
  if (!supabase) {
    const nuevo = {
      ...datos, id: datos.id || lsNextId(), estado: datos.estado || 'borrador',
      token: datos.token || lsNextToken(), creadoEn: new Date().toISOString(),
    }
    lsSave([nuevo, ...lsRead()])
    return { data: nuevo, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const row = { ...presupuestoDataParaDB(datos), user_id: user.id }
    const { data, error } = await supabase.from('presupuestos').insert(row).select().single()
    if (error) throw error
    return { data: mapearPresupuesto(data), error: null }
  } catch (error) {
    console.warn('[usePresupuestos] Supabase no disponible, guardando en localStorage:', error.message)
    const nuevo = {
      ...datos, id: datos.id || lsNextId(), estado: datos.estado || 'borrador',
      token: datos.token || lsNextToken(), creadoEn: new Date().toISOString(),
    }
    lsSave([nuevo, ...lsRead()])
    return { data: nuevo, error: null }
  }
}

export async function actualizarPresupuesto(id, datos) {
  if (!supabase) {
    const updated = lsRead().map(p => String(p.id) === String(id) ? { ...p, ...datos } : p)
    lsSave(updated)
    return { data: updated.find(p => String(p.id) === String(id)), error: null }
  }
  try {
    const row = {}
    if (datos.clienteId !== undefined) row.cliente_id = datos.clienteId
    if (datos.numero !== undefined) row.numero = datos.numero
    if (datos.fechaEmision !== undefined) row.fecha_emision = datos.fechaEmision
    if (datos.validezHasta !== undefined) row.validez_hasta = datos.validezHasta
    if (datos.estado !== undefined) row.estado = datos.estado
    if (datos.items !== undefined) row.items = datos.items
    if (datos.subtotal !== undefined) row.subtotal = datos.subtotal
    if (datos.ivaPct !== undefined) row.iva_pct = datos.ivaPct
    if (datos.iva !== undefined) row.iva = datos.iva
    if (datos.total !== undefined) row.total = datos.total
    if (datos.ivaIncluido !== undefined) row.iva_incluido = datos.ivaIncluido
    if (datos.cuotaMensual !== undefined) row.cuota_mensual = Number(datos.cuotaMensual) > 0 ? Number(datos.cuotaMensual) : null
    if (datos.pedirOnboarding !== undefined) row.pedir_onboarding = datos.pedirOnboarding
    if (datos.notas !== undefined) row.notas = datos.notas
    if (datos.emisor !== undefined) row.emisor = datos.emisor
    row.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('presupuestos').update(row).eq('id', id).select().single()
    if (error) throw error
    return { data: mapearPresupuesto(data), error: null }
  } catch (error) {
    console.warn('[usePresupuestos] Supabase no disponible, actualizando en localStorage:', error.message)
    const updated = lsRead().map(p => String(p.id) === String(id) ? { ...p, ...datos } : p)
    lsSave(updated)
    return { data: updated.find(p => String(p.id) === String(id)), error: null }
  }
}

export async function eliminarPresupuesto(id) {
  if (!supabase) {
    lsSave(lsRead().filter(p => String(p.id) !== String(id)))
    return { error: null }
  }
  try {
    const { error } = await supabase.from('presupuestos').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.warn('[usePresupuestos] Supabase no disponible, eliminando de localStorage:', error.message)
    lsSave(lsRead().filter(p => String(p.id) !== String(id)))
    return { error: null }
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePresupuestosList() {
  const [presupuestos, setPresupuestosState] = useState(() => supabase ? [] : lsRead())
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!supabase) {
      setPresupuestosState(lsRead())
      return
    }
    setLoading(true)
    const { data, error: err } = await getPresupuestos()
    setPresupuestosState(data)
    setError(err)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) {
      const h = () => setPresupuestosState(lsRead())
      window.addEventListener('aify:presupuestos', h)
      return () => window.removeEventListener('aify:presupuestos', h)
    }
    refetch()
  }, [refetch])

  return { presupuestos, loading, error, refetch }
}

export function usePresupuestosCliente(clienteId) {
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!clienteId) { setPresupuestos([]); setLoading(false); return }
    setLoading(true)
    const { data } = await getPresupuestosCliente(clienteId)
    setPresupuestos(data)
    setLoading(false)
  }, [clienteId])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    if (supabase) return
    const h = () => refetch()
    window.addEventListener('aify:presupuestos', h)
    return () => window.removeEventListener('aify:presupuestos', h)
  }, [refetch])

  return { presupuestos, loading, refetch }
}

// ── Public signing flow (no localStorage fallback — an external signer's ─────
// browser has no access to the agency's localStorage) ──────────────────────────

export async function getPresupuestoPublico(token) {
  if (!supabase) return { data: null, error: new Error('No disponible sin Supabase configurado') }
  const { data, error } = await supabase.rpc('get_presupuesto_publico', { p_token: token })
  return { data, error }
}

export async function firmarPresupuesto(token, { firmaDataUrl, firmanteNombre, firmanteEmail }) {
  if (!supabase) return { data: null, error: new Error('No disponible sin Supabase configurado') }
  const { data, error } = await supabase.rpc('firmar_presupuesto', {
    p_token: token, p_firma_data_url: firmaDataUrl,
    p_firmante_nombre: firmanteNombre, p_firmante_email: firmanteEmail,
  })
  return { data, error }
}
