import { useAjusteOrganizacion } from './useAjusteOrganizacion'

// Objetivo del mes que se ve en la barra del Inicio (0028_objetivo.sql):
// { tipo: 'facturacion' | 'clientes', valor: número } o null.

export const TIPOS_OBJETIVO = [
  { id: 'facturacion', label: 'Facturación del mes' },
  { id: 'clientes', label: 'Clientes activos' },
]

function normalizarObjetivo(o) {
  if (!o || !TIPOS_OBJETIVO.some(t => t.id === o.tipo) || !(Number(o.valor) > 0)) return null
  return { tipo: o.tipo, valor: Number(o.valor) }
}

export function useObjetivo() {
  const { valor, loading, guardar } = useAjusteOrganizacion('objetivo', normalizarObjetivo)
  return { objetivo: valor, loading, guardar }
}
