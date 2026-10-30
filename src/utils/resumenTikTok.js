// Resumen de las métricas reales de TikTok de un cliente (respuesta de
// /api/tiktok/metricas, ver services/tiktok.js) para dárselo a la IA en la
// Lluvia de ideas, como resumenInstagram.js. TikTok solo da visualizaciones,
// me gusta, comentarios y compartidos por vídeo. Función pura, sin React.

const num = (n) => (n == null ? null : Number(n))
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-ES'))

// Interacciones de un vídeo: lo que mejor indica que gustó
const interacciones = (v) => (num(v.meGusta) || 0) + (num(v.comentarios) || 0) * 2 + (num(v.compartidos) || 0) * 3

function linea(v) {
  const texto = (v.texto || '').replace(/\s+/g, ' ').trim().slice(0, 110) || '(sin texto)'
  const duracion = v.duracionSeg != null ? ` (${v.duracionSeg} s)` : ''
  return `- [Vídeo${duracion}] "${texto}" · ${fmt(v.visualizaciones)} visualizaciones · ${fmt(v.meGusta)} me gusta · ${fmt(v.comentarios)} comentarios · ${fmt(v.compartidos)} compartidos`
}

// Devuelve el bloque de texto para el prompt, o null si no hay datos útiles
export function resumenTikTokParaIA(metricas) {
  const videos = (metricas?.videos || []).filter(v => v && (v.texto || v.visualizaciones != null))
  if (!videos.length) return null

  const ordenados = [...videos].sort((a, b) => interacciones(b) - interacciones(a))
  const mejores = ordenados.slice(0, Math.min(5, ordenados.length))
  const peores = ordenados.length >= 8 ? ordenados.slice(-3).reverse() : []

  const { perfil = {}, cuenta = {} } = metricas
  return [
    `Cuenta: ${perfil.usuario ? `@${perfil.usuario}` : 'TikTok del cliente'}${perfil.seguidores != null ? ` · ${fmt(perfil.seguidores)} seguidores` : ''}`,
    `Últimos ${cuenta.videosListados ?? videos.length} vídeos: ${fmt(cuenta.visualizaciones)} visualizaciones · ${fmt(cuenta.meGusta)} me gusta · ${fmt(cuenta.comentarios)} comentarios · ${fmt(cuenta.compartidos)} compartidos`,
    '',
    'Vídeos que MEJOR le han funcionado:',
    ...mejores.map(linea),
    ...(peores.length ? ['', 'Vídeos que PEOR le han funcionado:', ...peores.map(linea)] : []),
  ].join('\n')
}
