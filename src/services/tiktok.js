import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'

// TikTok (conectar, publicar y métricas). Como instagram.js, todo pasa por el
// backend (server.js → /api/tiktok/*): los tokens de TikTok nunca llegan al
// navegador.

export class TikTokError extends Error {
  constructor(message, { status, codigo } = {}) {
    super(message)
    this.status = status
    this.codigo = codigo || null
  }
}

async function llamar(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(await getAuthHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new TikTokError('No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new TikTokError(data.error || 'No se pudo completar la operación con TikTok', {
      status: response.status, codigo: data.codigo,
    })
  }
  return data
}

// { configurado, conectado, conexion: { username, nombre, avatar_url, estado, permisos, ... } | null }
export function getEstadoTikTok(clienteId) {
  return llamar(`/api/tiktok/estado/${encodeURIComponent(clienteId)}`)
}

// Pide al backend la URL de autorización y navega allí. TikTok vuelve a
// /clientes/:id?tiktok=conectado|error&motivo=...
export async function conectarTikTok(clienteId) {
  const { url } = await llamar(`/api/tiktok/conectar?clienteId=${encodeURIComponent(clienteId)}`)
  window.location.href = url
}

export function desconectarTikTok(clienteId) {
  return llamar(`/api/tiktok/conexion/${encodeURIComponent(clienteId)}`, { method: 'DELETE' })
}

export const MOTIVOS_ERROR_CONEXION_TIKTOK = {
  cancelado: 'Se canceló la conexión con TikTok.',
  enlace_caducado: 'El enlace de conexión caducó. Vuelve a intentarlo.',
  no_configurado: 'La conexión con TikTok todavía no está configurada.',
  cliente: 'No tienes acceso a este cliente.',
  error: 'No se pudo conectar TikTok. Inténtalo de nuevo.',
}

// Métricas con caché de 1 h en el servidor (refrescar=true la salta, como mucho cada 5 min):
// { perfil: { usuario, nombre, foto, seguidores, siguiendo, meGusta, videos },
//   cuenta: { visualizaciones, meGusta, comentarios, compartidos, videosListados } (suma de los vídeos listados),
//   videos: [{ id, fecha, texto, enlace, miniatura, duracionSeg, visualizaciones, meGusta, comentarios, compartidos }],
//   actualizadoEn, desdeCache, aviso? }
// TikTok no da alcance, retención ni series diarias.
export function getMetricasTikTok(clienteId, { refrescar = false } = {}) {
  return llamar(`/api/tiktok/metricas/${encodeURIComponent(clienteId)}${refrescar ? '?refrescar=1' : ''}`)
}

// Datos del creador, pedidos cada vez que se abre el formulario (lo exige TikTok):
// { nombre, usuario, avatar, opcionesPrivacidad[], comentariosDesactivados,
//   duoDesactivado, stitchDesactivado, duracionMaxSeg, soloPrivado }
export function getCreadorTikTok(clienteId) {
  return llamar(`/api/tiktok/creador/${encodeURIComponent(clienteId)}`)
}

// { configurado, conectado, permisosOk, auditada, publicaciones: [{ post_id, tipo, estado, estado_tiktok, publicar_en, enlace, error, ... }] }
export function getPublicacionesTikTok(clienteId) {
  return llamar(`/api/tiktok/publicar/${encodeURIComponent(clienteId)}`)
}

// datos: { tipo: 'video'|'fotos', archivos: [{ ruta, tipo, nombre?, bytes? }], titulo, descripcion?,
//          privacidad, permitirComentarios, permitirDuo, permitirStitch,
//          contenidoComercial, marcaPropia, contenidoDeMarca, esIa, musicaAuto,
//          portadaMs?, portadaIndice?, consentimiento: true, publicarEn (ISO) }
export function programarPublicacionTikTok(clienteId, postId, datos) {
  return llamar(`/api/tiktok/publicar/${encodeURIComponent(clienteId)}/${encodeURIComponent(postId)}`, { method: 'PUT', body: datos })
}

// Solo cambia la hora de lo ya programado (al mover el post en el calendario).
export function moverPublicacionTikTok(clienteId, postId, publicarEn) {
  return llamar(`/api/tiktok/publicar/${encodeURIComponent(clienteId)}/${encodeURIComponent(postId)}`, { method: 'PATCH', body: { publicarEn } })
}

export function cancelarPublicacionTikTok(clienteId, postId) {
  return llamar(`/api/tiktok/publicar/${encodeURIComponent(clienteId)}/${encodeURIComponent(postId)}`, { method: 'DELETE' })
}

export const NOMBRES_PRIVACIDAD = {
  PUBLIC_TO_EVERYONE: 'Todo el mundo',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos (seguidores mutuos)',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  SELF_ONLY: 'Solo yo',
}

export const esDeTikTok = (post) => post.red === 'tiktok' || (post.comparteEn || []).includes('tiktok')
