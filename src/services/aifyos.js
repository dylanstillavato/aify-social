import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'

// Licencia de AifyOS (mcp/aifyos.js). La usa la página /aifyos.

async function llamar(method, ruta) {
  const response = await fetch(apiUrl(`/api/aifyos${ruta}`), {
    method,
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación')
  return data
}

export const verMiLicencia = () => llamar('GET', '/mi-licencia')
export const empezarPago = () => llamar('POST', '/checkout')
export const abrirPortal = () => llamar('POST', '/portal')
