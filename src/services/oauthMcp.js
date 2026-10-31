import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'

// OAuth del MCP de Aify (server.js, /api/oauth-mcp; mcp/oauth.js):
// - la pantalla «Permitir» (AutorizarMcp.jsx) lee y responde una solicitud;
// - Configuración → Tu IA lista y desconecta las apps conectadas.

async function llamar(method, ruta, body) {
  const response = await fetch(apiUrl(`/api/oauth-mcp${ruta}`), {
    method,
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación')
  return data
}

export const verSolicitudOAuth = (id) => llamar('GET', `/solicitudes/${encodeURIComponent(id)}`)
export const responderSolicitudOAuth = (id, permitir) => llamar('POST', `/solicitudes/${encodeURIComponent(id)}`, { permitir })
export const listarAppsConectadas = () => llamar('GET', '/apps')
export const desconectarApp = (id) => llamar('DELETE', `/apps/${encodeURIComponent(id)}`)
