import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'
import { avisarConectaIa } from './claveIa'

// Métricas reales de Instagram (Fase 8 · Seguimiento). Todo pasa por el
// backend (server.js → /api/instagram/*): el token de Instagram nunca llega
// al navegador, solo el estado de la conexión y las métricas ya calculadas.

export class InstagramError extends Error {
  constructor(message, { status, codigo } = {}) {
    super(message)
    this.status = status
    this.codigo = codigo || null
  }
}

async function llamar(path, { method = 'GET' } = {}) {
  let response
  try {
    response = await fetch(apiUrl(path), { method, headers: { ...(await getAuthHeaders()) } })
  } catch {
    throw new InstagramError('No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new InstagramError(data.error || 'No se pudo completar la operación con Instagram', {
      status: response.status, codigo: data.codigo,
    })
  }
  return data
}

// { configurado, conectado, conexion: { ig_username, estado, ... } | null }
export function getEstadoInstagram(clienteId) {
  return llamar(`/api/instagram/estado/${encodeURIComponent(clienteId)}`)
}

// Pide al backend la URL de autorización y navega allí. Instagram vuelve a
// /clientes/:id?instagram=conectado|error&motivo=...
export async function conectarInstagram(clienteId) {
  const { url } = await llamar(`/api/instagram/conectar?clienteId=${encodeURIComponent(clienteId)}`)
  window.location.href = url
}

// { perfil, cuenta (últimos 30 días), series, audiencia, publicaciones[], actualizadoEn, desdeCache, aviso? }
// series y audiencia pueden faltar (caché antigua) o venir a null (cuentas
// con menos de 100 seguidores).
export function getMetricasInstagram(clienteId, { refrescar = false } = {}) {
  return llamar(`/api/instagram/metricas/${encodeURIComponent(clienteId)}${refrescar ? '?refrescar=1' : ''}`)
}

// Visualizaciones por mes (últimos 6) sumando todas las cuentas conectadas:
// { configurado, cuentas, meses: [{ mes: 'YYYY-MM-01', visualizaciones | null }] }
export function getVisitasMensuales() {
  return llamar('/api/instagram/visitas-mensuales')
}

// El mp4 de un reel del cliente como Blob (lo sirve el backend: el CDN de
// Instagram no deja leer fotogramas desde el navegador).
export async function descargarVideoInstagram(clienteId, mediaId) {
  let response
  try {
    response = await fetch(apiUrl(`/api/instagram/video/${encodeURIComponent(clienteId)}/${encodeURIComponent(mediaId)}`), {
      headers: { ...(await getAuthHeaders()) },
    })
  } catch {
    throw new InstagramError('No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new InstagramError(data.error || `No se pudo descargar el vídeo (error ${response.status}). Inténtalo de nuevo en un minuto.`, { status: response.status, codigo: data.codigo })
  }
  return response.blob()
}

export function desconectarInstagram(clienteId) {
  return llamar(`/api/instagram/conexion/${encodeURIComponent(clienteId)}`, { method: 'DELETE' })
}

export const MOTIVOS_ERROR_CONEXION = {
  cancelado: 'Se canceló la conexión con Instagram.',
  enlace_caducado: 'El enlace de conexión caducó. Vuelve a intentarlo.',
  no_configurado: 'La conexión con Instagram todavía no está configurada.',
  cliente: 'No tienes acceso a este cliente.',
  error: 'No se pudo conectar Instagram. Comprueba que la cuenta es profesional (Business o Creator) e inténtalo de nuevo.',
}

// ── DMs automáticos por palabra clave ─────────────────────────────────────────

async function enviar(path, method, body) {
  let response
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new InstagramError('No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    // Sugerir respuesta con IA sin clave propia (ver claveIa.js)
    if (data.conectaIa) avisarConectaIa(data.error)
    throw new InstagramError(data.error || 'No se pudo completar la operación con Instagram', {
      status: response.status, codigo: data.codigo,
    })
  }
  return data
}

// { conectado, permisosOk, reglas[] (con .enviados), envios[] }
export function getDmAutomaticos(clienteId) {
  return llamar(`/api/instagram/dm/${encodeURIComponent(clienteId)}`)
}

// regla: { palabraClave, mensaje, respuestaPublica?, media?: { id, enlace, miniatura, texto } | null }
export function crearReglaDm(clienteId, regla) {
  return enviar(`/api/instagram/dm/${encodeURIComponent(clienteId)}/reglas`, 'POST', regla)
}

// cambios: cualquier campo de crearReglaDm, más { activa }
export function actualizarReglaDm(clienteId, reglaId, cambios) {
  return enviar(`/api/instagram/dm/${encodeURIComponent(clienteId)}/reglas/${encodeURIComponent(reglaId)}`, 'PATCH', cambios)
}

export function borrarReglaDm(clienteId, reglaId) {
  return enviar(`/api/instagram/dm/${encodeURIComponent(clienteId)}/reglas/${encodeURIComponent(reglaId)}`, 'DELETE')
}

// Últimas 24 publicaciones de la cuenta: { publicaciones: [{ id, fecha, tipo, texto, enlace, miniatura }] }
export function getMediaInstagram(clienteId) {
  return llamar(`/api/instagram/media/${encodeURIComponent(clienteId)}`)
}

// ── Publicar desde el calendario ──────────────────────────────────────────────

export const BUCKET_PUBLICACIONES = 'publicaciones'

// { conectado, permisosOk, publicaciones: [{ post_id, tipo, estado, publicar_en, permalink, error, ... }] }
export function getPublicacionesInstagram(clienteId) {
  return llamar(`/api/instagram/publicar/${encodeURIComponent(clienteId)}`)
}

// datos: { tipo: 'post'|'carrusel'|'reel'|'historia', archivos: [{ ruta, tipo: 'imagen'|'video', nombre?, bytes? }],
//          portadaRuta?, portadaNombre?, caption, compartirEnFeed, publicarEn (ISO),
//          esTrial?, trialGraduacion? ('MANUAL' | 'SS_PERFORMANCE', solo reels; migración 0042) }
// Las rutas son del bucket "publicaciones": <organizacionId>/<clienteId>/<archivo>.
export function programarPublicacionInstagram(clienteId, postId, datos) {
  return enviar(`/api/instagram/publicar/${encodeURIComponent(clienteId)}/${encodeURIComponent(postId)}`, 'PUT', datos)
}

export function cancelarPublicacionInstagram(clienteId, postId) {
  return enviar(`/api/instagram/publicar/${encodeURIComponent(clienteId)}/${encodeURIComponent(postId)}`, 'DELETE')
}

// ── Bandeja de DMs de todos los clientes ──────────────────────────────────────

// { clientes: [{ id, nombre, foto_url, igUsername, conectado, permisosOk, noLeidas }],
//   conversaciones: [{ id, cliente_id, contacto_username, contacto_nombre, contacto_foto,
//                      ultimo_mensaje, ultimo_mensaje_en, noLeida, ventanaAbierta, archivada }] }
export function getBandejaDms({ clienteId, archivadas = false } = {}) {
  const params = new URLSearchParams()
  if (clienteId) params.set('clienteId', clienteId)
  if (archivadas) params.set('archivadas', '1')
  const query = params.toString()
  return llamar(`/api/instagram/bandeja${query ? `?${query}` : ''}`)
}

// { conversacion, mensajes: [{ id, direccion: 'entrante'|'saliente', texto, adjuntos, origen, creado_en }] }
// Abrirla la marca como leída.
export function getConversacionDm(conversacionId) {
  return llamar(`/api/instagram/bandeja/conversaciones/${encodeURIComponent(conversacionId)}`)
}

// cambios: { archivada?, leida? }
export function actualizarConversacionDm(conversacionId, cambios) {
  return enviar(`/api/instagram/bandeja/conversaciones/${encodeURIComponent(conversacionId)}`, 'PATCH', cambios)
}

export function responderConversacionDm(conversacionId, texto) {
  return enviar(`/api/instagram/bandeja/conversaciones/${encodeURIComponent(conversacionId)}/responder`, 'POST', { texto })
}

// { texto }: respuesta sugerida por la IA de la organización (Tu IA).
export function sugerirRespuestaDm(conversacionId, borrador = '') {
  return enviar(`/api/instagram/bandeja/conversaciones/${encodeURIComponent(conversacionId)}/sugerir`, 'POST', { borrador })
}

// { nuevos, errores: [{ clienteId, nombre, error }], cuentas: [{ clienteId, nombre, conversacionesMeta }] }
export function sincronizarBandejaDms(clienteId) {
  return enviar('/api/instagram/bandeja/sincronizar', 'POST', clienteId ? { clienteId } : {})
}
