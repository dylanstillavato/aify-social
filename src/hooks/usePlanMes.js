import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

// Plan del mes de un cliente (0045_plan_mes.sql): de qué hablar ese mes
// (notas), sus fechas destacadas y cuántas piezas de cada tipo generar. Uno
// por cliente y mes; `mes` es siempre el día 1 (YYYY-MM-01). Sin Supabase se
// guarda en localStorage.

const LS_KEY = 'aify_planes_mes'

export const inicioMes = (mes) => `${String(mes).slice(0, 7)}-01`

function mapearPlan(row) {
  if (!row) return null
  return {
    id: row.id,
    clienteId: row.cliente_id ?? row.clienteId,
    mes: row.mes,
    notas: row.notas || '',
    fechas: row.fechas || [],
    cantidades: row.cantidades || {},
  }
}

function lsLeer() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

export async function getPlanMes(clienteId, mes) {
  if (!clienteId || !mes) return { data: null, error: null }
  if (!supabase) return { data: mapearPlan(lsLeer()[`${clienteId}_${inicioMes(mes)}`]), error: null }
  const { data, error } = await supabase.from('planes_mes').select('*')
    .eq('cliente_id', clienteId).eq('mes', inicioMes(mes)).maybeSingle()
  return { data: mapearPlan(data), error }
}

// Upsert por cliente + mes
export async function guardarPlanMes(cliente, mes, { notas = '', fechas = [], cantidades = {} }) {
  const fila = {
    cliente_id: cliente.id, mes: inicioMes(mes), notas, fechas, cantidades,
    actualizado_en: new Date().toISOString(),
  }
  if (!supabase) {
    const clave = `${cliente.id}_${fila.mes}`
    const todos = lsLeer()
    const plan = { id: todos[clave]?.id || `plan_${Date.now()}`, ...fila }
    try { localStorage.setItem(LS_KEY, JSON.stringify({ ...todos, [clave]: plan })) } catch { /* lleno */ }
    return { data: mapearPlan(plan), error: null }
  }
  if (cliente.organizacionId) fila.organizacion_id = cliente.organizacionId
  const { data, error } = await supabase.from('planes_mes')
    .upsert(fila, { onConflict: 'cliente_id,mes' }).select().single()
  return { data: mapearPlan(data), error }
}

// Lee el plan al cambiar de cliente o de mes. `guardar` no toca `plan`: el
// formulario lleva su propio estado y solo se rellena desde aquí al cargar.
export function usePlanMes(cliente, mes) {
  const [plan, setPlan] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const clienteId = cliente?.id

  useEffect(() => {
    let activo = true
    getPlanMes(clienteId, mes).then(({ data, error: e }) => {
      if (!activo) return
      setPlan(data)
      setError(e || null)
      setCargando(false)
    })
    return () => { activo = false }
  }, [clienteId, mes])

  const guardar = useCallback(async (datos) => {
    if (!cliente) return { data: null, error: null }
    const r = await guardarPlanMes(cliente, mes, datos)
    setError(r.error || null)
    return r
  }, [cliente, mes])

  return { plan, cargando, error, guardar }
}
