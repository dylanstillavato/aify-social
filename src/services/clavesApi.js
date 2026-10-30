import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'

// Claves de API del MCP de Aify (server.js, /api/claves-api). La clave en
// claro solo llega una vez, en la respuesta de crearClaveApi (claveEnClaro);
// el listado solo trae nombre, últimos 4 y fechas (y sinMigracion si falta la 0046).

async function llamarClavesApi(method, ruta = '', body) {
  const response = await fetch(apiUrl(`/api/claves-api${ruta}`), {
    method,
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación con tus claves de API')
  return data
}

export const listarClavesApi = () => llamarClavesApi('GET')
export const crearClaveApi = (nombre) => llamarClavesApi('POST', '', { nombre })
export const revocarClaveApi = (id) => llamarClavesApi('DELETE', `/${encodeURIComponent(id)}`)
