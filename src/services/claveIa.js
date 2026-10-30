import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'

// Tu IA: claves de IA de la organización (server.js, /api/ia/clave), una por
// proveedor ('gemini' | 'anthropic'). La clave nunca vuelve al navegador: el
// servidor solo responde { proveedor, tiene, ultimos4, verificada_en } (y
// sinMigracion si falta la 0043).

async function llamarClaveIa(method, ruta, body) {
  const response = await fetch(apiUrl(ruta), {
    method,
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación con tu clave de IA')
  return data
}

const conProveedor = (proveedor) => `/api/ia/clave?proveedor=${encodeURIComponent(proveedor)}`

export const obtenerClaveIa = (proveedor) => llamarClaveIa('GET', conProveedor(proveedor))
export const guardarClaveIa = (proveedor, clave) => llamarClaveIa('POST', '/api/ia/clave', { proveedor, clave })
export const probarClaveIa = (proveedor) => llamarClaveIa('POST', '/api/ia/clave/probar', { proveedor })
export const quitarClaveIa = (proveedor) => llamarClaveIa('DELETE', conProveedor(proveedor))

// ── Aviso «Conecta tu IA» ─────────────────────────────────────────────────────
// Sin clave propia, las rutas de IA responden 402 con { conectaIa: true }. Los
// servicios que llaman a la IA (ai.js, gemini.js, palabrasClave.js,
// instagram.js) avisan con este evento y AvisoConectaIa (App.jsx) enseña el
// aviso con el botón a Configuración → Tu IA, sea cual sea el botón de IA.

export const EVENTO_CONECTA_IA = 'aify:conecta-ia'
export const RUTA_TU_IA = '/configuracion#tu-ia'

export function avisarConectaIa(mensaje) {
  window.dispatchEvent(new CustomEvent(EVENTO_CONECTA_IA, { detail: { mensaje } }))
}

// Error con conectaIa: true, para que quien lo recoja pueda distinguirlo.
export function errorConectaIa(data) {
  avisarConectaIa(data.error)
  const error = new Error(data.error || 'Conecta tu IA en Configuración → Tu IA')
  error.conectaIa = true
  return error
}
