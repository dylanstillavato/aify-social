// De la idea al calendario (Fase 6): reparto de fechas de publicación y
// fechas de producción. Funciones puras, sin React. Meses 0-indexados
// (convención de Date); las fechas salen como 'YYYY-MM-DD'.

export const DIAS_SEMANA = [
  { id: 1, corto: 'L', label: 'Lunes' },
  { id: 2, corto: 'M', label: 'Martes' },
  { id: 3, corto: 'X', label: 'Miércoles' },
  { id: 4, corto: 'J', label: 'Jueves' },
  { id: 5, corto: 'V', label: 'Viernes' },
  { id: 6, corto: 'S', label: 'Sábado' },
  { id: 0, corto: 'D', label: 'Domingo' },
]

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const aFecha = (s) => new Date(`${s}T00:00:00`)

export function sumarDias(s, n) {
  const d = aFecha(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export function fechaCorta(s) {
  if (!s) return ''
  return aFecha(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Texto de una tarjeta de producción del tablero: "Grabar mar, 6 oct · Editar jue, 8 oct · Publicar sin fecha".
// Lo escriben PlanProduccion al crearla y el panel "Editar tarea" al cambiar cualquiera de las fechas.
export function subtituloProduccion({ grabacion, edicion, publicacion }) {
  return [
    grabacion ? `Grabar ${fechaCorta(grabacion)}` : 'Grabar sin fecha',
    edicion ? `Editar ${fechaCorta(edicion)}` : 'Editar sin fecha',
    publicacion ? `Publicar ${fechaCorta(publicacion)}` : 'Publicar sin fecha',
  ].join(' · ')
}

// El subtítulo se escribe al crear/editar la tarjeta y no se entera si luego
// el guion se programa desde el calendario: al pintarlo, el tramo "Publicar"
// se rehace con la publicación actual del post (undefined = no se sabe, se deja).
export function subtituloConPublicacion(subtitulo, publicacion) {
  const partes = String(subtitulo || '').split(' · ')
  if (publicacion === undefined || partes.length !== 3) return subtitulo
  partes[2] = publicacion ? `Publicar ${fechaCorta(publicacion)}` : 'Publicar sin fecha'
  return partes.join(' · ')
}

// Días del mes que caen en `diasSemana`, desde `desde` (incluido). Si no hay
// ninguno (p. ej. no se marcó ningún día), vale cualquier día.
function diasDisponibles(año, mes, diasSemana, desde) {
  const ultimo = new Date(año, mes + 1, 0).getDate()
  const todos = []
  for (let d = 1; d <= ultimo; d++) {
    const f = new Date(año, mes, d)
    if (desde && iso(f) < desde) continue
    todos.push(f)
  }
  const elegidos = todos.filter(f => diasSemana.includes(f.getDay()))
  return (elegidos.length ? elegidos : todos).map(iso)
}

// Reparte `n` publicaciones lo más espaciadas posible entre los días
// disponibles del mes. Con más publicaciones que días, se repiten días.
// En el mes en curso no se programa nada antes de mañana.
export function repartirFechas(n, año, mes, diasSemana, hoy = new Date()) {
  if (n <= 0) return []
  const esMesActual = año === hoy.getFullYear() && mes === hoy.getMonth()
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1)
  const desde = esMesActual ? iso(manana) : null
  let dias = diasDisponibles(año, mes, diasSemana, desde)
  // Mes en curso ya terminado (es el último día): no queda hueco, se usa el último día
  if (!dias.length) dias = [iso(new Date(año, mes + 1, 0))]
  return Array.from({ length: n }, (_, i) => dias[Math.floor((i * dias.length) / n)])
}

// Día de grabación por defecto: 5 días antes de la primera publicación,
// nunca antes de mañana. La edición, 2 días después de grabar.
export function fechasProduccionPorDefecto(fechasPublicacion, hoy = new Date()) {
  const manana = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1))
  const primera = [...fechasPublicacion].filter(Boolean).sort()[0]
  let grabacion = primera ? sumarDias(primera, -5) : manana
  if (grabacion < manana) grabacion = manana
  return { grabacion, edicion: sumarDias(grabacion, 2) }
}

// Mismo criterio que utils/pasosCliente.js para decidir qué lleva guion
export const esIdeaDeVideo = (idea) => /video|v[ií]deo|reel|tiktok|short/i.test(`${idea?.formato || ''} ${idea?.formatoSugerido || ''}`)
