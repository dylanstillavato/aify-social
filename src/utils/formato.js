// Formato de una pieza (idea, post o guion): vídeo o carrusel. El formato del
// post/idea manda; si no lo tiene, el del guion (los guiones de carrusel llevan
// formato: 'carrusel'). Lo que no es carrusel se trata como vídeo.

const RE_CARRUSEL = /carrusel|carousel|carrousel|texto_imagen|texto_corto|seo_local/i

// Tipos de pieza del plan del mes (ideas.tipo_pieza, 0045). El tipo fija el
// formato y si lleva texto; las ideas sin tipo siguen con las reglas de abajo.
export const TIPOS_PIEZA = [
  { id: 'video_guion', etiqueta: 'Vídeos con guion', formato: 'video', definicion: 'vídeo hablado a cámara o con voz: gancho, desarrollo y llamada a la acción' },
  { id: 'trend', etiqueta: 'Trends', formato: 'video', definicion: 'adaptación al negocio de un formato o audio que esté de moda en Reels/TikTok, con un texto o una frase corta' },
  { id: 'solo_planos', etiqueta: 'Solo planos', formato: 'video', sinTexto: true, definicion: 'vídeo cinematográfico de planos bonitos del negocio, sin nadie hablando ni guion' },
  { id: 'viral_musica', etiqueta: 'Virales con música', formato: 'video', sinTexto: true, definicion: 'vídeo corto montado al ritmo de una canción, con una situación o un texto gancho encima, sin voz' },
  { id: 'carrusel', etiqueta: 'Carruseles', formato: 'carrusel', definicion: 'carrusel de Instagram de varias slides con texto e imagen' },
]
export const tipoPiezaDe = (x) => TIPOS_PIEZA.find(t => t.id === x?.tipoPieza) || null

export const esCarrusel = (x) => (tipoPiezaDe(x) && !x?.formato && !x?.guion?.formato
  ? tipoPiezaDe(x).formato === 'carrusel'
  : RE_CARRUSEL.test(`${x?.formato || x?.formatoSugerido || ''} ${x?.guion?.formato || ''}`))
export const formatoDe = (x) => (esCarrusel(x) ? 'carrusel' : 'video')
export const otroFormato = (formato) => (formato === 'carrusel' ? 'video' : 'carrusel')
export const etiquetaFormato = (formato) => (formato === 'carrusel' ? 'Carrusel' : 'Vídeo')

// Pieza sin texto: vídeo de solo planos (cinemático) o carrusel de solo fotos.
// Lo marca el guion (guion.sinTexto) o, antes de tenerlo, la propia idea
// (sinTexto elegido en el editor, o un formato sugerido tipo "Reel cinemático").
const RE_SIN_TEXTO = /cinem|sin voz|sin texto|sin guion|solo planos|solo fotos/i
export const esSinTexto = (x) => !!(x?.guion?.sinTexto ?? x?.sinTexto ?? (tipoPiezaDe(x) ? !!tipoPiezaDe(x).sinTexto : undefined) ?? RE_SIN_TEXTO.test(x?.formatoSugerido || ''))
export const etiquetaEstilo = (formato, sinTexto) => (sinTexto ? (formato === 'carrusel' ? 'Solo fotos' : 'Solo planos') : (formato === 'carrusel' ? 'Con texto' : 'Con guion'))

// Formatos que se eligen al crear un post a mano (calendario, Programar
// publicaciones). El reel se guarda como 'video' (lo que entienden guiones y
// huecos); 'historia' no es una pieza con guion y no entra en Guiones del mes.
export const FORMATOS_POST = [
  { id: 'video', label: 'Reel' },
  { id: 'carrusel', label: 'Carrusel' },
  { id: 'historia', label: 'Historia' },
]
export const esHistoria = (x) => /histori|story/i.test(x?.formato || '')
