import { apiUrl } from './apiBase'

// ── Cache utilities ───────────────────────────────────────────────────────────

const TTL = 24 * 60 * 60 * 1000 // 24 hours

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL) { localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch { /* ignore */ }
}

// ── Sector keywords (fallback when Google Trends is unavailable in browser) ───

const SECTOR_KEYWORDS = {
  'Restauración': [
    { formattedValue: 'Restaurante cerca', value: [92] },
    { formattedValue: 'Menú del día', value: [88] },
    { formattedValue: 'Reservas online', value: [81] },
    { formattedValue: 'Comida para llevar', value: [76] },
    { formattedValue: 'Gastro tendencias', value: [68] },
  ],
  'Moda': [
    { formattedValue: 'Tendencias primavera', value: [94] },
    { formattedValue: 'Outfit ideas', value: [89] },
    { formattedValue: 'Moda sostenible', value: [84] },
    { formattedValue: 'Ropa online', value: [79] },
    { formattedValue: 'Segunda mano moda', value: [71] },
  ],
  'Fitness': [
    { formattedValue: 'Rutina en casa', value: [91] },
    { formattedValue: 'Gym cerca', value: [86] },
    { formattedValue: 'Pérdida de peso', value: [82] },
    { formattedValue: 'Pilates clases', value: [75] },
    { formattedValue: 'Nutrición deportiva', value: [70] },
  ],
  'Belleza': [
    { formattedValue: 'Skincare rutina', value: [93] },
    { formattedValue: 'Maquillaje tendencias', value: [88] },
    { formattedValue: 'Tratamientos faciales', value: [80] },
    { formattedValue: 'Peluquería cerca', value: [75] },
    { formattedValue: 'Uñas diseño', value: [72] },
  ],
  'Retail': [
    { formattedValue: 'Ofertas online', value: [90] },
    { formattedValue: 'Compras online', value: [87] },
    { formattedValue: 'Tienda online', value: [83] },
    { formattedValue: 'Envío gratis', value: [78] },
    { formattedValue: 'Descuentos hoy', value: [74] },
  ],
  'Servicios': [
    { formattedValue: 'Servicios profesionales', value: [86] },
    { formattedValue: 'Empresa local', value: [80] },
    { formattedValue: 'Presupuesto gratis', value: [76] },
    { formattedValue: 'Servicio a domicilio', value: [71] },
    { formattedValue: 'Calidad garantizada', value: [67] },
  ],
  'Educación': [
    { formattedValue: 'Cursos online', value: [92] },
    { formattedValue: 'Certificaciones', value: [85] },
    { formattedValue: 'Aprender idiomas', value: [81] },
    { formattedValue: 'Formación profesional', value: [76] },
    { formattedValue: 'Clases particulares', value: [70] },
  ],
  'Tecnología': [
    { formattedValue: 'Inteligencia artificial', value: [96] },
    { formattedValue: 'App móvil', value: [88] },
    { formattedValue: 'Automatización', value: [84] },
    { formattedValue: 'Desarrollo web', value: [79] },
    { formattedValue: 'Ciberseguridad', value: [73] },
  ],
}

const DEFAULT_KEYWORDS = [
  { formattedValue: 'Marketing digital', value: [85] },
  { formattedValue: 'Redes sociales', value: [81] },
  { formattedValue: 'Contenido viral', value: [77] },
  { formattedValue: 'Marca personal', value: [72] },
  { formattedValue: 'Emprendimiento', value: [68] },
]

// ── 1. Google Trends (via proxy server) ──────────────────────────────────────

export async function obtenerTendenciasGoogle(sector, ubicacion = 'ES') {
  const cacheKey = `aify_tendencias_${sector}_${new Date().getMonth()}_${new Date().getFullYear()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(apiUrl(`/api/trends?sector=${encodeURIComponent(sector)}&geo=${ubicacion}`))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { tendencias } = await res.json()
    if (tendencias?.length) {
      const mapped = tendencias.map(t => ({ formattedValue: t.query || t.formattedValue, value: [t.value || 70] }))
      cacheSet(cacheKey, mapped)
      return mapped
    }
    throw new Error('no data')
  } catch {
    const fallback = SECTOR_KEYWORDS[sector] || DEFAULT_KEYWORDS
    cacheSet(cacheKey, fallback)
    return fallback
  }
}

export async function obtenerBusquedasRelacionadas(sector) {
  const cacheKey = `aify_related_${sector}_${new Date().getMonth()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(apiUrl(`/api/trends?sector=${encodeURIComponent(sector)}&geo=ES`))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { tendencias } = await res.json()
    if (tendencias?.length) {
      const queries = tendencias.map(t => ({ query: t.query || t.formattedValue, value: t.value || 70, hasData: true }))
      cacheSet(cacheKey, queries)
      return queries
    }
    throw new Error('no data')
  } catch {
    const fallback = (SECTOR_KEYWORDS[sector] || DEFAULT_KEYWORDS).map(k => ({
      query: k.formattedValue, value: k.value[0], hasData: true,
    }))
    cacheSet(cacheKey, fallback)
    return fallback
  }
}

// ── 2. Open Holidays API ──────────────────────────────────────────────────────

export async function obtenerFestivos(año, mes, pais = 'ES') {
  // mes is 1-indexed here
  const cacheKey = `aify_festivos_${pais}_${año}_${mes}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const pad = n => String(n).padStart(2, '0')
    const ultimoDia = new Date(año, mes, 0).getDate()
    const fechaInicio = `${año}-${pad(mes)}-01`
    const fechaFin = `${año}-${pad(mes)}-${ultimoDia}`
    const url = `https://openholidaysapi.org/PublicHolidays?countryIsoCode=${pais}&languageIsoCode=ES&validFrom=${fechaInicio}&validTo=${fechaFin}`

    const res = await fetch(url)
    if (!res.ok) throw new Error('API error')

    const festivos = await res.json()
    const data = festivos.map(f => ({
      fecha: f.startDate,
      dia: parseInt(f.startDate.split('-')[2]),
      nombre: f.name?.[0]?.text || 'Festivo',
      nacional: !f.subdivisionCode,
    }))
    cacheSet(cacheKey, data)
    return data
  } catch (err) {
    console.error('Open Holidays error:', err)
    return []
  }
}

export function obtenerDiasInternacionales(mes, año) {
  // mes is 0-indexed (like JS Date)
  const mesNum = mes + 1
  const DIAS = {
    1:  [{ dia: 1, nombre: 'Año Nuevo' }],
    2:  [{ dia: 14, nombre: 'San Valentín' }],
    3:  [{ dia: 8, nombre: 'Día de la Mujer' }, { dia: 19, nombre: 'Día del Padre' }],
    4:  [{ dia: 22, nombre: 'Día de la Tierra' }],
    5:  [{ dia: 4, nombre: 'Día de la Madre' }, { dia: 15, nombre: 'Día de la Familia' }],
    6:  [{ dia: 21, nombre: 'Día del Orgullo' }],
    7:  [],
    8:  [],
    9:  [{ dia: 27, nombre: 'Día del Turismo' }],
    10: [{ dia: 31, nombre: 'Halloween' }],
    11: [{ dia: 11, nombre: 'Singles Day' }, { dia: 29, nombre: 'Black Friday' }],
    12: [{ dia: 25, nombre: 'Navidad' }, { dia: 31, nombre: 'Nochevieja' }],
  }
  return (DIAS[mesNum] || []).map(d => ({
    fecha: `${año}-${String(mesNum).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`,
    dia: d.dia,
    nombre: d.nombre,
    esOportunidadMarketing: true,
  }))
}

export function obtenerDiasInternacionalesSector(mes, año, sector) {
  // mes is 1-indexed
  const todos = {
    1: [{ dia: 1, nombre: 'Año Nuevo', sectores: ['todos'] }],
    2: [
      { dia: 14, nombre: 'San Valentín', sectores: ['Restauración', 'Moda', 'Belleza', 'Retail'] },
      { dia: 9, nombre: 'Día de la Pizza', sectores: ['Restauración'] },
    ],
    3: [
      { dia: 8, nombre: 'Día de la Mujer', sectores: ['todos'] },
      { dia: 19, nombre: 'Día del Padre', sectores: ['todos'] },
      { dia: 21, nombre: 'Primer día de primavera', sectores: ['Restauración', 'Moda', 'Fitness'] },
    ],
    4: [
      { dia: 22, nombre: 'Día de la Tierra', sectores: ['todos'] },
      { dia: 7, nombre: 'Día Mundial de la Salud', sectores: ['Fitness', 'Belleza', 'Servicios'] },
    ],
    5: [
      { dia: 4, nombre: 'Día de la Madre', sectores: ['todos'] },
      { dia: 15, nombre: 'Día de la Familia', sectores: ['Restauración', 'Retail'] },
      { dia: 31, nombre: 'Día sin Tabaco', sectores: ['Fitness', 'Servicios'] },
    ],
    6: [
      { dia: 21, nombre: 'Primer día de verano', sectores: ['Restauración', 'Moda', 'Fitness'] },
      { dia: 26, nombre: 'Día del Orgullo', sectores: ['todos'] },
    ],
    7: [{ dia: 18, nombre: 'Día del Helado', sectores: ['Restauración'] }],
    8: [{ dia: 12, nombre: 'Día de la Juventud', sectores: ['Moda', 'Fitness', 'Tecnología'] }],
    9: [
      { dia: 27, nombre: 'Día del Turismo', sectores: ['Restauración', 'Servicios'] },
      { dia: 21, nombre: 'Día del Alzheimer', sectores: ['Servicios', 'Educación'] },
    ],
    10: [
      { dia: 31, nombre: 'Halloween', sectores: ['Restauración', 'Retail', 'Moda'] },
      { dia: 10, nombre: 'Día de la Salud Mental', sectores: ['Fitness', 'Servicios'] },
    ],
    11: [
      { dia: 11, nombre: 'Singles Day', sectores: ['Retail', 'Moda', 'Tecnología'] },
      { dia: 29, nombre: 'Black Friday', sectores: ['todos'] },
      { dia: 30, nombre: 'Cyber Monday', sectores: ['Retail', 'Tecnología'] },
    ],
    12: [
      { dia: 25, nombre: 'Navidad', sectores: ['todos'] },
      { dia: 31, nombre: 'Nochevieja', sectores: ['todos'] },
      { dia: 6, nombre: 'Día de la Constitución', sectores: ['todos'] },
    ],
  }

  const diasDelMes = todos[mes] || []
  const hoy = new Date()
  const pad = n => String(n).padStart(2, '0')

  return diasDelMes
    .filter(d => {
      const esSectorRelevante = d.sectores.includes('todos') || d.sectores.includes(sector)
      const fecha = new Date(año, mes - 1, d.dia)
      const esHoyOFuturo = fecha >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
      return esSectorRelevante && esHoyOFuturo
    })
    .map(d => ({
      fecha: `${año}-${pad(mes)}-${pad(d.dia)}`,
      dia: d.dia,
      nombre: d.nombre,
      esOportunidadMarketing: true,
    }))
}

// Combine festivos + días internacionales
export async function obtenerTodosLosDias(año, mes) {
  const [festivos, internacionales] = await Promise.all([
    obtenerFestivos(año, mes),
    Promise.resolve(obtenerDiasInternacionales(mes, año)),
  ])
  // Merge, deduplicating by dia
  const byDia = {}
  ;[...festivos, ...internacionales].forEach(f => {
    if (!byDia[f.dia]) byDia[f.dia] = f
  })
  return Object.values(byDia)
}

// ── 3. YouTube Data API v3 ────────────────────────────────────────────────────

export function hasYouTubeKey() {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY
  return Boolean(key && key !== 'tu_youtube_api_key_aqui')
}

export async function obtenerVideosVirales(sector, maxResults = 5) {
  if (!hasYouTubeKey()) return []

  const cacheKey = `aify_yt_${sector}_${new Date().getMonth()}_${new Date().getFullYear()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
    const QUERIES = {
      'Restauración': 'restaurante viral comida tendencia España',
      'Moda': 'moda tendencia outfit viral España',
      'Fitness': 'fitness workout viral rutina España',
      'Belleza': 'belleza skincare tutorial viral España',
      'Retail': 'tienda haul compras viral España',
      'Servicios': 'negocio emprendimiento viral España',
      'Educación': 'educacion aprender curso viral España',
      'Tecnología': 'tecnologia app digital viral España',
    }
    const query = QUERIES[sector] || `${sector} viral España`
    const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=viewCount&publishedAfter=${publishedAfter}&regionCode=ES&relevanceLanguage=es&maxResults=${maxResults}&key=${API_KEY}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`YouTube API ${res.status}`)

    const json = await res.json()
    if (json.error) throw new Error(json.error.message)

    const videos = (json.items || []).map(v => ({
      titulo: v.snippet.title,
      canal: v.snippet.channelTitle,
      descripcion: v.snippet.description?.slice(0, 120) || '',
      fecha: v.snippet.publishedAt,
      videoId: v.id.videoId,
      url: `https://youtube.com/watch?v=${v.id.videoId}`,
    }))
    cacheSet(cacheKey, videos)
    return videos
  } catch (err) {
    console.error('YouTube API error:', err)
    return []
  }
}
