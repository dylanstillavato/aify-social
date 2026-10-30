// Hoja de rodaje: todos los planos de los vídeos de un mes agrupados por tipo
// de plano, para grabar seguidos todos los que comparten encuadre el día de
// rodaje en el local del cliente. Funciones puras (sin React) para poder
// probarlas con node.

export const OTROS_PLANOS = 'Otros planos'

// "Primer plano  a Cámara" y "primer plano a camara" son el mismo grupo
export function normalizarTipoPlano(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

// Clave de un plano para guardar si está grabado: id del post + su contenido
// (tipo, lo que se ve y lo que se dice). Con la posición, regenerar o
// reordenar los planos movía las marcas a planos distintos.
function hashTexto(texto) {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0
  return h.toString(36)
}
export const clavePlano = (postId, plano) =>
  `${postId}:${hashTexto([plano?.plano, plano?.visual, plano?.dice].map(v => String(v || '').trim()).join('|'))}`

// Nombre visible del grupo: la forma más escrita (a igualdad, la primera),
// con mayúscula inicial. Sin variantes = planos sin tipo.
function etiquetaGrupo(variantes) {
  let mejor = null
  let n = 0
  for (const [texto, veces] of variantes) if (veces > n) { mejor = texto; n = veces }
  return mejor ? mejor.charAt(0).toUpperCase() + mejor.slice(1) : OTROS_PLANOS
}

// posts: vídeos del mes (ya ordenados por fecha). Devuelve
// [{ clave, tipo, planos: [{ key, postId, titulo, fecha, index, segundos, plano, visual, dice }] }]
// ordenado por número de planos (desc); a igualdad, por orden de aparición y
// "Otros planos" al final.
export function agruparPlanos(posts, { soloAprobados = false } = {}) {
  const grupos = new Map()
  for (const post of posts || []) {
    if (soloAprobados && post.aprobacionEstado !== 'aprobado') continue
    const planos = Array.isArray(post.guion?.planos) ? post.guion.planos : []
    planos.forEach((p, index) => {
      if (!p) return
      const norm = normalizarTipoPlano(p.plano)
      const clave = norm || '__otros__'
      if (!grupos.has(clave)) {
        grupos.set(clave, { clave, orden: grupos.size, variantes: new Map(), planos: [] })
      }
      const g = grupos.get(clave)
      if (norm) {
        const texto = String(p.plano).trim().replace(/\s+/g, ' ')
        g.variantes.set(texto, (g.variantes.get(texto) || 0) + 1)
      }
      g.planos.push({
        key: clavePlano(post.id, p),
        postId: post.id,
        titulo: post.titulo || 'Vídeo sin título',
        fecha: post.fecha || '',
        index,
        segundos: p.segundos ?? '',
        plano: p.plano || '',
        visual: p.visual || '',
        dice: p.dice || '',
      })
    })
  }
  return [...grupos.values()]
    .sort((a, b) =>
      (b.planos.length - a.planos.length) ||
      ((a.clave === '__otros__') - (b.clave === '__otros__')) ||
      (a.orden - b.orden))
    .map(g => ({ clave: g.clave, tipo: etiquetaGrupo(g.variantes), planos: g.planos }))
}

// Carruseles del mes: no se agrupan por tipo de plano (no hay encuadres que
// repetir), sino uno por carrusel con sus slides, para hacer las fotos de cada
// uno de una vez. Misma forma que agruparPlanos (en los carruseles `visual` es
// la imagen de la slide y `dice` su texto) para compartir marcas y PDF.
export function agruparCarruseles(posts, { soloAprobados = false } = {}) {
  return (posts || [])
    .filter(post => !soloAprobados || post.aprobacionEstado === 'aprobado')
    .filter(post => Array.isArray(post.guion?.planos) && post.guion.planos.length)
    .map(post => ({
      clave: `carrusel:${post.id}`,
      tipo: post.titulo || 'Carrusel sin título',
      fecha: post.fecha || '',
      planos: post.guion.planos.filter(Boolean).map((p, index) => ({
        key: clavePlano(post.id, p),
        postId: post.id,
        titulo: p.plano || `Slide ${index + 1}`,
        fecha: '',
        index,
        segundos: '',
        plano: p.plano || '',
        visual: p.visual || '',
        dice: p.dice || '',
      })),
    }))
}

// "2026-10-07" -> "7 oct."
export function fechaCorta(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export const claveStorageRodaje = (clienteId, año, mes) => `aify_rodaje_${clienteId}_${año}-${mes}`
