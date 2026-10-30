// Resumen de las métricas reales de Instagram de un cliente (respuesta de
// /api/instagram/metricas, ver services/instagram.js) para dárselo a la IA en
// la Lluvia de ideas: qué publicaciones y qué formatos le funcionan y cuáles
// no. Función pura, sin React.

const num = (n) => (n == null ? null : Number(n))
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-ES'))

// Interacciones de una publicación: lo que mejor indica que gustó
const interacciones = (p) =>
  (num(p.meGusta) || 0) + (num(p.comentarios) || 0) * 2 + (num(p.guardados) || 0) * 3 + (num(p.compartidos) || 0) * 3

const etiquetaTipo = (t) => ({ REEL: 'Reel', VIDEO: 'Vídeo', CAROUSEL_ALBUM: 'Carrusel', IMAGE: 'Foto' }[t] || t || 'Publicación')

function linea(p) {
  const texto = (p.texto || '').replace(/\s+/g, ' ').trim().slice(0, 110) || '(sin texto)'
  return `- [${etiquetaTipo(p.tipo)}] "${texto}" · ${fmt(p.visualizaciones)} visualizaciones · ${fmt(p.alcance)} alcance · ${fmt(p.meGusta)} me gusta · ${fmt(p.comentarios)} comentarios · ${fmt(p.guardados)} guardados · ${fmt(p.compartidos)} compartidos`
}

// Devuelve el bloque de texto para el prompt, o null si no hay datos útiles
export function resumenInstagramParaIA(metricas) {
  const pubs = (metricas?.publicaciones || []).filter(p => p && (p.texto || p.visualizaciones != null || p.meGusta != null))
  if (!pubs.length) return null

  const ordenadas = [...pubs].sort((a, b) => interacciones(b) - interacciones(a))
  const mejores = ordenadas.slice(0, Math.min(5, ordenadas.length))
  const peores = ordenadas.length >= 8 ? ordenadas.slice(-3).reverse() : []

  // Media de interacciones por formato (solo formatos con 2+ publicaciones)
  const porTipo = {}
  for (const p of pubs) {
    const t = etiquetaTipo(p.tipo)
    porTipo[t] = porTipo[t] || { n: 0, suma: 0, vis: 0 }
    porTipo[t].n++
    porTipo[t].suma += interacciones(p)
    porTipo[t].vis += num(p.visualizaciones) || 0
  }
  const formatos = Object.entries(porTipo)
    .filter(([, v]) => v.n >= 2)
    .map(([t, v]) => ({ t, media: Math.round(v.suma / v.n), vis: Math.round(v.vis / v.n), n: v.n }))
    .sort((a, b) => b.media - a.media)

  const { perfil = {}, cuenta = {} } = metricas
  return [
    `Cuenta: ${perfil.usuario ? `@${perfil.usuario}` : 'Instagram del cliente'}${perfil.seguidores != null ? ` · ${fmt(perfil.seguidores)} seguidores` : ''}`,
    `Últimos 30 días: ${fmt(cuenta.visualizaciones)} visualizaciones · ${fmt(cuenta.alcance)} alcance · ${fmt(cuenta.interacciones)} interacciones · ${fmt(cuenta.guardados)} guardados · ${fmt(cuenta.compartidos)} compartidos`,
    '',
    'Publicaciones que MEJOR le han funcionado:',
    ...mejores.map(linea),
    ...(peores.length ? ['', 'Publicaciones que PEOR le han funcionado:', ...peores.map(linea)] : []),
    ...(formatos.length ? ['', 'Rendimiento medio por formato: ' + formatos.map(f => `${f.t}: ${fmt(f.vis)} visualizaciones y ${fmt(f.media)} puntos de interacción de media (${f.n} publicaciones)`).join(' · ')] : []),
  ].join('\n')
}
