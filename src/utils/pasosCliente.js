// Navegación de la ficha de cliente (ClienteDetalle): el proceso mensual en
// seis pasos (pestañas principales) y las pestañas secundarias. Funciones
// puras, sin React.

export const PASOS_CLIENTE = [
  { id: 'ideas', label: 'Ideas' },
  { id: 'guiones', label: 'Guiones' },
  { id: 'grabacion', label: 'Grabación' },
  { id: 'edicion', label: 'Publicar' },
  { id: 'seguimiento', label: 'Seguimiento' },
]

export const TABS_SECUNDARIAS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'perfil', label: 'Perfil' },
  { id: 'facturacion', label: 'Facturación' },
]

export const TAB_POR_DEFECTO = 'edicion'

// Ids antiguos (deep links vía location.state.tabInicial, p. ej. desde
// CalendarioGeneral) -> paso nuevo + subvista dentro de "Publicar"
const ALIAS = {
  calendario: { tab: 'edicion', sub: 'calendario' },
  contenido: { tab: 'edicion', sub: 'contenido' },
}

// ── Proceso editable (0029_proceso.sql) ──────────────────────────────────────
// La organización guarda una lista ordenada de pasos: los seis de siempre (por
// id, con su nombre y si están ocultos) y los personalizados, que en la ficha
// son una casilla de "hecho" y una nota por mes.

const IDS_BASE = new Set(PASOS_CLIENTE.map(p => p.id))
// Nombres por defecto que ya no se usan: si una organización guardó su proceso
// con el nombre antiguo sin tocarlo, se enseña el nuevo (un nombre propio se respeta).
const NOMBRES_ANTIGUOS = { edicion: ['Edición y publicación'] }
export const MAX_PASOS = 12

// Limpia lo que venga de la base de datos o del navegador. null = sin cambios
export function normalizarProceso(lista) {
  if (!Array.isArray(lista)) return null
  const vistos = new Set()
  const limpia = []
  for (const p of lista) {
    if (!p || typeof p.id !== 'string' || vistos.has(p.id)) continue
    // La investigación se conserva en el JSON antiguo, pero ya no es un paso.
    if (p.id === 'investigacion') continue
    const personalizado = !IDS_BASE.has(p.id)
    let label = String(p.label || '').trim().slice(0, 40)
    if (NOMBRES_ANTIGUOS[p.id]?.includes(label)) label = ''
    if (personalizado && !label) continue
    vistos.add(p.id)
    limpia.push({ id: p.id, label: label || PASOS_CLIENTE.find(b => b.id === p.id).label, oculto: !!p.oculto, ...(personalizado ? { personalizado: true } : {}) })
  }
  return limpia.length ? limpia.slice(0, MAX_PASOS) : null
}

// Lista completa para editar: la guardada y, al final, los pasos de siempre
// que falten (p. ej. si se añade uno nuevo al producto)
export function procesoEditable(config) {
  const lista = normalizarProceso(config) || []
  const faltan = PASOS_CLIENTE.filter(b => !lista.some(p => p.id === b.id)).map(b => ({ ...b, oculto: false }))
  return [...lista, ...faltan]
}

// Pasos visibles de la ficha, en orden
export const pasosVisibles = (config) => procesoEditable(config).filter(p => !p.oculto)

export const nuevoPasoId = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

// Devuelve { tab, sub }: `sub` solo aplica a 'edicion' ('calendario' | 'contenido').
// `pasos` = los pasos visibles del proceso (por defecto, los seis de siempre)
export function resolverTab(id, pasos = PASOS_CLIENTE) {
  const validos = new Set([...pasos, ...TABS_SECUNDARIAS].map(t => t.id))
  if (ALIAS[id]) return validos.has(ALIAS[id].tab) ? ALIAS[id] : { tab: pasos[0]?.id || 'resumen', sub: null }
  if (validos.has(id)) return { tab: id, sub: null }
  const porDefecto = validos.has(TAB_POR_DEFECTO) ? TAB_POR_DEFECTO : pasos[0]?.id || 'resumen'
  return { tab: porDefecto, sub: null }
}

// Mismo criterio que GuionesMes.jsx para decidir qué posts llevan guion
export const esVideo = (p) => !!p.guion || /video|v[ií]deo|reel|tiktok|short/i.test(p.formato || '')

export const ordenarPorFecha = (posts) =>
  [...posts].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
