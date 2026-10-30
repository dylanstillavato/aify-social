// Huecos sugeridos de publicación: antes de que el cliente apruebe nada, el
// calendario ya enseña en qué días conviene publicar cada formato según el
// ritmo que eligió en el onboarding (cliente.ritmoPublicacion). Luego esos
// huecos se rellenan con los posts aprobados y con los vídeos grabados.
// Nada se guarda: los huecos se calculan al vuelo y un hueco está "ocupado"
// si ese día ya hay un post de su formato. Funciones puras, sin React.

import { iso, aFecha, sumarDias } from './planificacion'

export const FORMATOS_HUECO = {
  reel: { label: 'Reel', texto: 'Publicar reel', color: '#E1306C' },
  carrusel: { label: 'Carrusel', texto: 'Publicar carrusel', color: '#1D5FE0' },
  historias: { label: 'Historias', texto: 'Publicar historias', color: '#FF9500' },
}

// Mejores días por formato (getDay: 0 = domingo). Los reels rinden mejor entre
// semana, los carruseles (que se guardan) en días tranquilos y las historias
// se mantienen a diario cuanto más alto es el ritmo.
export const RITMOS = {
  tranquilo: {
    label: 'Tranquilo', resumen: 'unas 2 publicaciones por semana',
    reel: [2], carrusel: [4], historias: [1, 3, 5],
  },
  equilibrado: {
    label: 'Equilibrado', resumen: '3-4 publicaciones por semana',
    reel: [2, 5], carrusel: [3, 0], historias: [1, 2, 3, 4, 5],
  },
  diario: {
    label: 'Diario', resumen: 'una publicación al día',
    reel: [2, 4, 5, 0], carrusel: [1, 3, 6], historias: [0, 1, 2, 3, 4, 5, 6],
  },
}

export const ritmoDe = (cliente) => RITMOS[cliente?.ritmoPublicacion] ? cliente.ritmoPublicacion : 'equilibrado'

// Formato de hueco que ocupa un post (null = no ocupa ninguno)
export function formatoDePost(post) {
  const f = `${post?.formato || ''}`.toLowerCase()
  if (/histori|story/.test(f)) return 'historias'
  if (/carrusel|imagen|texto|seo/.test(f)) return 'carrusel'
  if (post?.guion || /video|v[ií]deo|reel|tiktok|short/.test(f)) return 'reel'
  return null
}

// Formatos sugeridos para una fecha 'YYYY-MM-DD'
export function formatosDelDia(ritmo, fecha) {
  const r = RITMOS[ritmo] || RITMOS.equilibrado
  const dow = aFecha(fecha).getDay()
  return Object.keys(FORMATOS_HUECO).filter(f => r[f].includes(dow))
}

// Formatos ya cubiertos cada día, a partir de los posts programados
export function ocupacion(posts) {
  const porFecha = {}
  for (const p of posts || []) {
    if (p.enCalendario === false || !p.fecha) continue
    const f = formatoDePost(p)
    if (!f) continue
    ;(porFecha[p.fecha] ||= new Set()).add(f)
  }
  return porFecha
}

// Huecos libres de una fecha (los días pasados no tienen huecos)
export function huecosLibresDelDia(ritmo, fecha, ocupados, hoy = iso(new Date())) {
  if (fecha < hoy) return []
  const usados = ocupados[fecha]
  return formatosDelDia(ritmo, fecha).filter(f => !usados?.has(f))
}

// Reparte posts sin programar entre los próximos huecos libres de su formato,
// desde `desde` (incluido) y como mucho `dias` días hacia delante. Devuelve
// [{ post, fecha }] solo para los que encontraron hueco.
export function asignarHuecos(ritmo, pendientes, postsProgramados, desde, dias = 120) {
  const ocupados = ocupacion(postsProgramados)
  const asignados = []
  for (const post of pendientes) {
    const formato = formatoDePost(post) || 'reel'
    for (let i = 0; i < dias; i++) {
      const fecha = sumarDias(desde, i)
      if (!formatosDelDia(ritmo, fecha).includes(formato) || ocupados[fecha]?.has(formato)) continue
      ;(ocupados[fecha] ||= new Set()).add(formato)
      asignados.push({ post, fecha })
      break
    }
  }
  return asignados
}
