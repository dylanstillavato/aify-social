import {
  Utensils, Shirt, Dumbbell, Sparkles, ShoppingBag, Home, BookOpen, Laptop, Grid3X3,
  Smile, SmilePlus, Laugh, Flame, TrendingUp, Briefcase, Zap, Heart, DollarSign, Star, MapPin, Camera,
  Leaf, Users, Gift, Sun, Package, Moon, Award, GraduationCap, Music,
  Wind, Activity, User,
} from 'lucide-react'

export const SECTORES = [
  { id: 'restauracion', icon: Utensils, label: 'Restauración', color: '#FF9500' },
  { id: 'moda', icon: Shirt, label: 'Moda', color: '#3D9BFF' },
  { id: 'fitness', icon: Dumbbell, label: 'Fitness', color: '#30D158' },
  { id: 'belleza', icon: Sparkles, label: 'Belleza', color: '#FF2D55' },
  { id: 'retail', icon: ShoppingBag, label: 'Retail', color: '#1D5FE0' },
  { id: 'servicios', icon: Home, label: 'Servicios', color: '#64D2FF' },
  { id: 'educacion', icon: GraduationCap, label: 'Educación', color: '#FF9500' },
  { id: 'tecnologia', icon: Laptop, label: 'Tecnología', color: '#3D9BFF' },
  { id: 'otro', icon: Grid3X3, label: 'Otro', color: '#86868B' },
]

export const TONOS = [
  { id: 'cercano_divertido', icon: Smile, label: 'Cercano y divertido', desc: 'Como un amigo que te recomienda algo' },
  { id: 'desenfadado_ironico', icon: Flame, label: 'Desenfadado e irónico', desc: 'Con humor y personalidad propia' },
  { id: 'aspiracional', icon: TrendingUp, label: 'Aspiracional', desc: 'Inspira y genera deseo' },
  { id: 'profesional', icon: Briefcase, label: 'Profesional y serio', desc: 'Transmite confianza y expertise' },
  { id: 'energetico', icon: Zap, label: 'Energético', desc: 'Directo, dinámico, mucha acción' },
  { id: 'familiar_calido', icon: Heart, label: 'Familiar y cálido', desc: 'Cercano, inclusivo, de confianza' },
]

export const REDES_CONFIG = [
  { id: 'instagram', icon: Camera, label: 'Instagram', color: '#E1306C' },
  { id: 'tiktok', icon: Music, label: 'TikTok', color: '#86868B' },
  { id: 'facebook', icon: Users, label: 'Facebook', color: '#1877F2' },
]

export const VALORES = [
  { id: 'precio', icon: DollarSign, label: 'Precio' },
  { id: 'calidad', icon: Award, label: 'Calidad' },
  { id: 'proximidad', icon: MapPin, label: 'Proximidad' },
  { id: 'estetica', icon: Camera, label: 'Estética' },
  { id: 'sostenibilidad', icon: Leaf, label: 'Sostenibilidad' },
  { id: 'familia', icon: Users, label: 'Familia' },
  { id: 'experiencias', icon: Star, label: 'Experiencias' },
  { id: 'rapidez', icon: Zap, label: 'Rapidez' },
]

export const FECHAS_GENERALES = [
  { id: 'navidad', icon: Gift, label: 'Navidad' },
  { id: 'san_valentin', icon: Heart, label: 'San Valentín' },
  { id: 'padre_madre', icon: Users, label: 'Día Padre/Madre' },
  { id: 'halloween', icon: Moon, label: 'Halloween' },
  { id: 'vuelta_cole', icon: BookOpen, label: 'Vuelta al cole' },
  { id: 'verano', icon: Sun, label: 'Verano' },
  { id: 'otono', icon: Leaf, label: 'Otoño' },
  { id: 'black_friday', icon: ShoppingBag, label: 'Black Friday' },
  { id: 'cyber_monday', icon: Package, label: 'Cyber Monday' },
  { id: 'ano_nuevo', icon: Star, label: 'Año Nuevo' },
  { id: 'carnaval', icon: Smile, label: 'Carnaval' },
]

export const TICKET_PILLS = [
  'Menos de 15€', '15-30€', '30-60€', 'Más de 60€', 'No aplica',
]

export const ENERGIA_OPTS = [
  { id: 'calmado', icon: Wind, label: 'Calmado y pausado', desc: 'Ritmo tranquilo, reflexivo' },
  { id: 'equilibrado', icon: Activity, label: 'Equilibrado y natural', desc: 'Ni muy frío ni muy intenso' },
  { id: 'energetico', icon: Zap, label: 'Energético y dinámico', desc: 'Activo, rápido, motivador' },
  { id: 'intenso', icon: Flame, label: 'Muy intenso y apasionado', desc: 'Todo al máximo, sin filtros' },
]

export const VOZ_OPTS = [
  { id: 'femenina', icon: User, label: 'Voz femenina' },
  { id: 'masculina', icon: User, label: 'Voz masculina' },
  { id: 'neutro', icon: Users, label: 'Indistinto / Neutro' },
]

export const EMOJIS_OPTS = [
  { id: 'ninguno', icon: Smile, label: 'No usa emojis', desc: 'Comunicación limpia y profesional' },
  { id: 'puntual', icon: SmilePlus, label: 'Emojis puntuales', desc: 'Solo en momentos clave' },
  { id: 'frecuente', icon: Laugh, label: 'Emojis frecuentes', desc: 'Parte del estilo de la marca' },
  { id: 'muchos', icon: Laugh, label: 'Muchos emojis', desc: 'Lenguaje visual y expresivo' },
]

export const ESTILO_TEXTO_PILLS = [
  { id: 'minusculas', label: 'todo en minúsculas' },
  { id: 'primera_mayuscula', label: 'Primera letra mayúscula' },
  { id: 'mayusculas', label: 'TODO EN MAYÚSCULAS' },
  { id: 'mezcla', label: 'MeZcLa CreAtIvA' },
  { id: 'normal', label: 'Normal (gramática estándar)' },
]

export const TIPOGRAFIA_OPTS = [
  { id: 'serif', label: 'Serif clásica', desc: 'Elegante y tradicional', fontFamily: 'Georgia, serif' },
  { id: 'sans', label: 'Sans-serif moderna', desc: 'Limpia y contemporánea', fontFamily: 'system-ui, sans-serif' },
  { id: 'display', label: 'Display expresiva', desc: 'Llamativa y creativa', fontFamily: 'system-ui', fontWeight: 900 },
  { id: 'script', label: 'Manuscrita/Script', desc: 'Personal y cercana', fontFamily: 'cursive' },
  { id: 'mono', label: 'Monospace', desc: 'Técnica y precisa', fontFamily: 'monospace' },
  { id: 'sin_definir', label: 'Sin tipografía definida', desc: 'No está claro aún', fontFamily: 'inherit' },
]

export const ESTETICA_PILLS = [
  'Minimalista', 'Colorido', 'Vintage', 'Moderno', 'Lujoso', 'Urbano',
  'Natural/Orgánico', 'Divertido', 'Oscuro/Dramático', 'Brillante/Pastel',
  'Retro', 'Industrial', 'Artesanal', 'Tecnológico', 'Romántico',
]

export const COLORES_PRESET = [
  '#000000', '#FFFFFF', '#FF3B30', '#1D5FE0', '#30D158',
  '#FF9500', '#FF2D55', '#3D9BFF', '#FFD700', '#FF69B4',
]

export const POSICION_TEXTO_OPTS = [
  { id: 'arriba', label: 'Texto arriba', preview: 'top' },
  { id: 'centro', label: 'Texto centrado', preview: 'center' },
  { id: 'abajo', label: 'Texto abajo', preview: 'bottom' },
  { id: 'variable', label: 'Variable según escena', preview: null },
]

export const TAMANO_TEXTO_PILLS = [
  { id: 'pequeno', label: 'Pequeño' },
  { id: 'mediano', label: 'Mediano' },
  { id: 'grande', label: 'Grande' },
  { id: 'muy_grande', label: 'Muy grande' },
  { id: 'variable', label: 'Variable' },
]

export const ANIMACION_OPTS = [
  { id: 'ninguna', label: 'Sin animación' },
  { id: 'fade', label: 'Fade in suave' },
  { id: 'palabra', label: 'Palabra por palabra' },
  { id: 'letra', label: 'Letra por letra' },
  { id: 'zoom', label: 'Zoom in' },
  { id: 'slide', label: 'Slide desde abajo' },
  { id: 'typewriter', label: 'Máquina de escribir' },
  { id: 'no_definido', label: 'No definido' },
]

export const SUBTITULO_OPTS = [
  { id: 'tiktok', label: 'Estilo TikTok', desc: 'Una palabra grande centrada' },
  { id: 'caption', label: 'Estilo caption', desc: 'Texto pequeño abajo' },
  { id: 'destacado', label: 'Estilo destacado', desc: 'Palabra clave grande + resto pequeño' },
]

export const MOTIVO_VIDEO_PILLS = [
  'Funcionó muy bien', 'Define su estilo', 'Buen ejemplo de tono', 'Formato que repiten',
]

export const GUSTA_VIDEO_PILLS = [
  'El formato', 'El tono', 'La estética', 'El tipo de contenido', 'La música', 'El humor',
]

// Onboarding v2 (Fase 2): 6 pasos + resumen. Los pasos antiguos de Historial
// y Vídeos de referencia ya no se preguntan, pero sus datos siguen en el form
// (clienteToForm los carga y guardar() los vuelve a escribir) para que el modo
// edición no los borre. Los usará la sección de Investigación.
export const TOTAL_PASOS = 6

export const PASOS_TITULOS = ['Quién es', 'Qué hace', 'A quién vende', 'Cómo habla', 'Redes y ritmo', 'Fechas importantes']

export const RANGO_PRECIO_OPTS = [
  { id: 'bajo', label: 'Bajo', desc: 'Precio ajustado, compra fácil' },
  { id: 'medio', label: 'Medio', desc: 'Precio de mercado' },
  { id: 'alto', label: 'Alto', desc: 'Por encima de la media' },
  { id: 'premium', label: 'Premium', desc: 'Exclusivo, alta gama' },
]

export const FRECUENCIA_OPTS = [
  { id: 'tranquilo', label: 'Tranquilo', desc: 'Unas 2 publicaciones por semana' },
  { id: 'equilibrado', label: 'Equilibrado', desc: '3-4 publicaciones por semana', recomendado: true },
  { id: 'diario', label: 'Diario', desc: 'Una publicación al día' },
]

export const REDES_ENLACES_CAMPOS = [
  { id: 'instagram', label: 'Instagram', placeholder: '@usuario o enlace' },
  { id: 'tiktok', label: 'TikTok', placeholder: '@usuario o enlace' },
  { id: 'facebook', label: 'Facebook', placeholder: 'Enlace a la página' },
  { id: 'youtube', label: 'YouTube', placeholder: 'Enlace al canal' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'Enlace al perfil' },
  { id: 'otra', label: 'Otra', placeholder: 'Cualquier otro enlace' },
]

export const defaultRedesEnlaces = { instagram: '', tiktok: '', facebook: '', youtube: '', linkedin: '', otra: '' }

export const NUM_TEMAS = 5
const temasVacios = () => Array.from({ length: NUM_TEMAS }, () => '')

// Rellena hasta NUM_TEMAS huecos para los 5 inputs del paso 2
export function temasParaForm(temas) {
  const arr = Array.isArray(temas) ? temas.filter(t => typeof t === 'string').slice(0, NUM_TEMAS) : []
  return [...arr, ...temasVacios()].slice(0, NUM_TEMAS)
}

export const defaultRedes = Object.fromEntries(
  REDES_CONFIG.map(r => [r.id, { activa: false, frecuencia: '3x_semana', estrategia: 'especifico', comparteConRedes: [] }])
)

export const defaultMarcaPersonal = { negocio: '', oferta: '', clienteIdeal: '', llamadaAccion: '', historia: '' }

export const defaultForm = {
  // Marca personal (0041): perfil propio para conseguir clientes, no un negocio
  esMarcaPersonal: false, marcaPersonal: defaultMarcaPersonal,
  // Paso 1 · Quién es
  nombreContacto: '', nombre: '', sector: '', sectorCustom: '', web: '', googleMaps: '',
  ubicacion: '', email: '', telefono: '', redesEnlaces: defaultRedesEnlaces,
  // Paso 2 · Qué hace
  descripcion: '', diferencial: '', porQueElegirnos: '', rangoPrecio: '', webCarta: '', ticketMedio: '',
  temas: temasVacios(), valores: [], barrerasInternas: '', barrerasExternas: '',
  // Paso 3 · A quién vende
  edadMin: 25, edadMax: 40, genero: 'mixto', audienciaDesc: '', publicoObjetivo: '', queBuscan: '',
  competidores: [], cuentasReferencia: [],
  // Paso 4 · Cómo habla
  tono: '', vozPropia: '', prohibido: '',
  energia: '', vozGenero: '', usoEmojis: '', estiloTexto: [],
  // Paso 5 · Redes y ritmo
  redes: defaultRedes, ritmoPublicacion: '',
  // Ya no se pregunta (antiguo paso Historial): se conserva para no perderlo al editar
  queHaFuncionado: '', mejorPost: '', hashtagsPropio: '', referencias: '',
  // Paso 6 · Fechas importantes
  fechasGenerales: [], fechasPropias: [], temporada: '',
  // Sin paso propio: se conserva tal cual (incluye identidadVisual.logo)
  identidadVisual: {
    colorPrimario: '', colorSecundario: '', colorAcento: '', colorFondo: '',
    estiloTipografia: '', fuenteEspecifica: '',
    estetica: [], referenciaEstetica: '',
  },
  // Paso 9
  textoVideos: {
    posicion: '', tamano: '', animaciones: [],
    colorTexto: '', subtitulosAuto: false, estiloSubtitulos: '',
  },
  // Ya no se pregunta (antiguo paso Vídeos de referencia): se conserva al editar
  videosCliente: [],
  videosReferencia: [],
  perfilComunicacion: null,
}

export function clienteToForm(c) {
  const sectorId = SECTORES.find(s => s.label === c.sector)?.id || c.sector || ''
  const redesForm = { ...defaultRedes }
  if (c.redesDetalladas) {
    Object.entries(c.redesDetalladas).forEach(([id, val]) => {
      if (redesForm[id]) redesForm[id] = { ...redesForm[id], ...val, estrategia: val.estrategia || 'especifico', comparteConRedes: val.comparteConRedes || [] }
    })
  } else if (c.redes) {
    c.redes.forEach(id => { if (redesForm[id]) redesForm[id].activa = true })
  }
  return {
    esMarcaPersonal: !!c.marcaPersonal,
    marcaPersonal: { ...defaultMarcaPersonal, ...(c.marcaPersonal || {}) },
    nombreContacto: c.nombreContacto || '',
    nombre: c.nombre || '',
    sector: sectorId,
    sectorCustom: c.sectorCustom || '',
    web: c.web || '',
    googleMaps: c.googleMaps || '',
    email: c.email || '',
    telefono: c.telefono || '',
    redesEnlaces: { ...defaultRedesEnlaces, ...(c.redesEnlaces || {}) },
    descripcion: c.descripcion || '',
    diferencial: c.diferencial || '',
    porQueElegirnos: c.porQueElegirnos || '',
    rangoPrecio: c.rangoPrecio || '',
    ubicacion: c.ubicacion || '',
    webCarta: '',
    ticketMedio: c.ticketMedio || '',
    temas: temasParaForm(c.temas),
    barrerasInternas: c.barrerasInternas || '',
    barrerasExternas: c.barrerasExternas || '',
    edadMin: c.audiencia?.edadMin ?? 25,
    edadMax: c.audiencia?.edadMax ?? 40,
    genero: c.audiencia?.genero || 'mixto',
    audienciaDesc: c.audiencia?.descripcion || '',
    valores: c.audiencia?.valores || [],
    publicoObjetivo: c.publicoObjetivo || '',
    queBuscan: c.queBuscan || '',
    competidores: Array.isArray(c.competidores) ? c.competidores : [],
    cuentasReferencia: Array.isArray(c.cuentasReferencia) ? c.cuentasReferencia : [],
    ritmoPublicacion: c.ritmoPublicacion || '',
    tono: TONOS.find(t => t.label === c.tono)?.id || c.tonoId || '',
    vozPropia: c.vozPropia || '',
    prohibido: c.prohibido || '',
    energia: c.energia || '',
    vozGenero: c.vozGenero || '',
    usoEmojis: c.usoEmojis || '',
    estiloTexto: c.estiloTexto || [],
    redes: redesForm,
    queHaFuncionado: c.historial?.queHaFuncionado || '',
    mejorPost: c.historial?.mejorPost || '',
    hashtagsPropio: c.historial?.hashtagsPropio || '',
    referencias: c.historial?.referencias || '',
    fechasGenerales: c.fechasClaveObj?.generales || [],
    fechasPropias: c.fechasClaveObj?.propias || [],
    temporada: c.fechasClaveObj?.temporada || '',
    identidadVisual: c.identidadVisual || defaultForm.identidadVisual,
    textoVideos: c.textoVideos || defaultForm.textoVideos,
    videosCliente: c.videosCliente || [],
    videosReferencia: c.videosReferencia || [],
    perfilComunicacion: c.perfilComunicacion || null,
  }
}
