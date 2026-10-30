import { getAuthHeaders } from './supabase'
import { apiUrl } from './apiBase'
import { errorConectaIa } from './claveIa'
import { lineasVozCliente } from '../utils/vozCliente'
import { esMarcaPersonal, bloqueMarcaPersonal, lineaEspectadorMarcaPersonal } from '../utils/marcaPersonal'
import { CAMPOS_HISTORIA, normalizarHistoria, textoHistoria } from '../utils/historia'
import { esCarrusel, esSinTexto, TIPOS_PIEZA, tipoPiezaDe } from '../utils/formato'

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto en marketing de contenidos para redes sociales especializado en el mercado hispanohablante.
Conoces en profundidad los algoritmos de Instagram, TikTok, Google Maps y WhatsApp Business en 2026.
Generas contenido que convierte, no contenido genérico.
Siempre respondes ÚNICAMENTE con JSON válido, sin texto adicional.
El contenido debe ser específico para el cliente indicado, usando su tono, sector y audiencia real.`

// Los errores 2-4 de los ganchos (los cuatro errores de @tumadreanna: retraso,
// confusión, irrelevancia, falta de interés). El 1, retraso, ya lo cubre la
// regla de "tema primero". Se usa al generar el guion, al regenerar solo el
// gancho y como vara de medir en revisarGancho().
const REGLAS_GANCHO = `Habla de TÚ al espectador (o de usted, si el tono de la marca lo pide), nunca de yo: "si llevas años con el pelo encrespado", no "yo llevaba años con el pelo encrespado".
Parte de un problema que el espectador ya tiene, no de un tema que solo es interesante: "si tienes acné, prueba esto", no "tres tendencias de skincare".
Palabras que entienda un niño de 12 años, voz activa y una sola forma posible de entenderlo.
La segunda frase pone el contraste: lo que hace o cree todo el mundo (A) frente a la alternativa de este vídeo (B), más rápida, mejor o más barata. Puede decir A y B ("casi todos usan X, pero esto funciona el triple de rápido") o solo B y dejar A sobreentendida.`

// ─── Ultra-personalized client prompt builder ─────────────────────────────────

// Datos del onboarding v2 (temas, por qué elegirlos, barreras, qué buscan,
// ritmo...). Solo devuelve líneas para los campos que tienen valor, así un
// cliente antiguo sin ellos genera exactamente el mismo prompt que antes.
const RITMO_PUBLICACION = {
  tranquilo: 'Tranquilo, unas 2 publicaciones por semana',
  equilibrado: 'Equilibrado, 3-4 publicaciones por semana',
  diario: 'Diario, una publicación al día',
}

export function lineasOnboardingV2(cliente) {
  if (!cliente) return ''
  const temas = Array.isArray(cliente.temas) ? cliente.temas.filter(Boolean) : []
  const lineas = [
    temas.length ? `- Pilares de contenido (temas del sector): ${temas.join(', ')}` : '',
    cliente.porQueElegirnos ? `- Por qué le eligen a él y no a la competencia: ${cliente.porQueElegirnos}` : '',
    cliente.rangoPrecio ? `- Rango de precio: ${cliente.rangoPrecio}` : '',
    cliente.publicoObjetivo ? `- Público objetivo: ${cliente.publicoObjetivo}` : '',
    cliente.queBuscan ? `- Qué buscan sus clientes en él: ${cliente.queBuscan}` : '',
    cliente.barrerasInternas ? `- Barreras internas (lo que le frena al crear contenido): ${cliente.barrerasInternas}` : '',
    cliente.barrerasExternas ? `- Barreras externas (mercado, competencia, presupuesto): ${cliente.barrerasExternas}` : '',
    cliente.competidores?.length ? `- Competidores: ${cliente.competidores.join(', ')}` : '',
    cliente.cuentasReferencia?.length ? `- Cuentas de referencia que admira: ${cliente.cuentasReferencia.join(', ')}` : '',
    RITMO_PUBLICACION[cliente.ritmoPublicacion] ? `- Ritmo de publicación deseado: ${RITMO_PUBLICACION[cliente.ritmoPublicacion]}` : '',
  ].filter(Boolean)
  return lineas.join('\n')
}

export function construirPromptCliente(cliente) {
  const instruccionEmojis = {
    'ninguno': 'PROHIBIDO usar emojis. CERO emojis en absolutamente ningún texto generado.',
    'puntual': 'Usar máximo 1 emoji por post, solo si aporta valor.',
    'frecuente': 'Usar 2-3 emojis por post de forma natural.',
    'muchos': 'Usar emojis libremente como parte del estilo de la marca.',
  }[cliente.usoEmojis] || 'Usar emojis con moderación.'

  const instruccionMayusculas = cliente.estiloTexto?.includes('minusculas')
    ? 'ESCRIBIR TODO EN MINÚSCULAS. Sin excepción.'
    : cliente.estiloTexto?.includes('mayusculas')
    ? 'ESCRIBIR TODO EN MAYÚSCULAS. Sin excepción.'
    : 'Usar capitalización normal según gramática.'

  const instruccionEnergia = {
    'calmado': 'Tono calmado, pausado, reflexivo. Frases cortas y claras.',
    'equilibrado': 'Tono equilibrado y natural. Ni muy serio ni muy efusivo.',
    'energetico': 'Tono energético y dinámico. Frases con punch y acción.',
    'intenso': 'Tono muy intenso y apasionado. Máxima energía y emoción.',
  }[cliente.energia] || 'Tono equilibrado.'

  const instruccionVoz = {
    'femenina': 'Voz femenina, cercana y empática.',
    'masculina': 'Voz masculina, directa y segura.',
    'neutro': 'Voz neutra e inclusiva.',
  }[cliente.vozGenero] || 'Voz neutra.'

  const videosRef = cliente.videosReferencia?.length > 0 ? `
ESTILO DE REFERENCIA (vídeos que le gustan al cliente):
${cliente.videosReferencia.map(v => `- ${v.label || v.url} (le gusta: ${v.queMeGusta || 'el estilo general'})`).join('\n')}
Adapta el estilo de contenido a estas referencias.` : ''

  const perfilIA = cliente.perfilComunicacion?.resumen_estilo ? `
ANÁLISIS DE COMUNICACIÓN (extraído de sus vídeos reales):
- Tono real: ${cliente.perfilComunicacion.tono_real}
- Expresiones propias: ${cliente.perfilComunicacion.expresiones_propias?.join(', ')}
- Palabras clave: ${cliente.perfilComunicacion.palabras_clave?.join(', ')}
- Lo que evita: ${cliente.perfilComunicacion.que_evita}
- Resumen: ${cliente.perfilComunicacion.resumen_estilo}` : ''

  const multiplataforma = Object.entries(cliente.redesDetalladas || {})
    .filter(([, r]) => r?.activa && r?.estrategia === 'compartido' && r?.comparteConRedes?.length > 0)
    .map(([nombre, r]) => `${nombre} comparte contenido con: ${r.comparteConRedes.join(', ')}`)
    .join('\n')

  const redesActivas = Object.entries(cliente.redesDetalladas || {})
    .filter(([, r]) => r?.activa)
    .map(([nombre, r]) => `- ${nombre}: ${r.frecuencia || '3x_semana'}, objetivo principal: ${r.objetivo || 'engagement'}`)
    .join('\n') || (Array.isArray(cliente.redes) ? cliente.redes.join(', ') : '')

  const marcaPersonal = esMarcaPersonal(cliente)
  const bloqueQuien = marcaPersonal ? bloqueMarcaPersonal(cliente) : `NEGOCIO:
- Nombre: ${cliente.nombre}
- Sector: ${cliente.sector}${cliente.sectorCustom ? ` (${cliente.sectorCustom})` : ''}
- Ubicación: ${cliente.ubicacion || 'España'}
- Web: ${cliente.web || 'no disponible'}
- Ticket medio: ${cliente.ticketMedio || 'no especificado'}
- Descripción: ${cliente.descripcion || 'no disponible'}
- Diferencial: ${cliente.diferencial || 'no especificado'}`

  return `
=== PERFIL COMPLETO DEL CLIENTE ===

${bloqueQuien}

${marcaPersonal ? 'AUDIENCIA (sus posibles clientes):' : 'AUDIENCIA:'}
- Edad: ${cliente.audiencia?.edadMin || 18}-${cliente.audiencia?.edadMax || 45} años
- Género predominante: ${cliente.audiencia?.genero || 'mixto'}
- Cliente ideal: ${cliente.audiencia?.descripcion || 'no especificado'}
- Valores que importan: ${cliente.audiencia?.valores?.join(', ') || 'no especificados'}
${lineasOnboardingV2(cliente) ? `\nESTRATEGIA (onboarding):\n${lineasOnboardingV2(cliente)}\nUsa los pilares de contenido como ejes de las ideas y ten en cuenta las barreras al proponer formatos.\n` : ''}${lineasVozCliente(cliente) ? `\n${lineasVozCliente(cliente)}\n` : ''}
VOZ Y COMUNICACIÓN:
- ${instruccionEmojis}
- ${instruccionMayusculas}
- ${instruccionEnergia}
- ${instruccionVoz}
- Tono declarado: ${cliente.tono || 'no especificado'}
- LO QUE NUNCA DEBE APARECER: ${cliente.prohibido || 'nada específico'}

REDES ACTIVAS Y OBJETIVOS:
${redesActivas}
${multiplataforma ? `\nCONTENIDO MULTIPLATAFORMA:\n${multiplataforma}` : ''}

HISTORIAL:
- Qué ha funcionado: ${cliente.historial?.queHaFuncionado || 'no especificado'}
- Mejor campaña: ${cliente.historial?.mejorPost || 'no especificado'}
- Hashtags propios: ${cliente.historial?.hashtagsPropio || 'ninguno'}
- Referencias que admira: ${cliente.historial?.referencias || 'ninguna'}

FECHAS CLAVE:
- Generales: ${cliente.fechasClaveObj?.generales?.join(', ') || cliente.fechasClave || 'ninguna'}
- Propias: ${cliente.fechasClaveObj?.propias?.map(f => `${f.nombre} (${f.fecha})`).join(', ') || 'ninguna'}
- Temporada: ${cliente.fechasClaveObj?.temporada || 'no especificada'}
${perfilIA}
${videosRef}

INSTRUCCIÓN FINAL CRÍTICA:
Respeta ESTRICTAMENTE todas las instrucciones de comunicación anteriores.
Especialmente el uso de emojis y el estilo de texto.
El contenido debe sonar EXACTAMENTE como esta marca, no genérico.${marcaPersonal ? '\nEs una MARCA PERSONAL: todo el contenido sirve para conseguir clientes para su negocio, según la estrategia de arriba.' : ''}
=================================`
}

// ─── Safe JSON response parsing ───────────────────────────────────────────────
// Always check response.ok / content-type before parsing — a proxy failure,
// gateway timeout, or misconfigured host can return an HTML/text error page
// instead of JSON, and calling response.json() on that throws a cryptic
// "Unexpected token" error instead of a usable message.

async function parseApiResponse(response) {
  let raw
  try {
    raw = await response.json()
  } catch {
    throw new Error(response.ok
      ? 'Respuesta inválida del servidor'
      : `Error del servidor (HTTP ${response.status})`)
  }

  if (!response.ok) {
    // Sin clave de IA propia: aviso común que lleva a Configuración → Tu IA
    if (raw.conectaIa) throw errorConectaIa(raw)
    if (response.status === 429) throw new Error(raw.error || 'Límite de peticiones alcanzado. Espera unos minutos e inténtalo de nuevo.')
    throw new Error(raw.error || `HTTP ${response.status}`)
  }

  return raw
}

function extraerJSON(text) {
  if (!text) throw new Error('La IA no devolvió contenido')

  const clean = text.replace(/```json|```/g, '').trim()

  if (!clean.endsWith('}') && !clean.endsWith(']')) {
    const match = clean.match(/"posts"\s*:\s*\[(.+)/s)
    if (match) {
      const postsText = match[1]
      const complete = []
      let depth = 0, start = -1
      for (let i = 0; i < postsText.length; i++) {
        if (postsText[i] === '{') { if (depth === 0) start = i; depth++ }
        else if (postsText[i] === '}') { depth--; if (depth === 0 && start !== -1) complete.push(postsText.slice(start, i + 1)) }
      }
      if (complete.length > 0) {
        try { return JSON.parse(`{"posts":[${complete.join(',')}]}`) } catch { /* fall through to error below */ }
      }
    }
    throw new Error('JSON_TRUNCADO')
  }

  try {
    return JSON.parse(clean)
  } catch (e) {
    // La IA a veces devuelve JSON casi bueno: texto antes o después, comas
    // finales o saltos de línea sin escapar dentro de las cadenas. Se arregla
    // eso y se vuelve a intentar antes de dar la respuesta por perdida.
    try {
      return JSON.parse(repararJSON(clean))
    } catch {
      console.error('[IA] Error al parsear JSON:', e.message)
      throw new Error('Error al procesar respuesta de la IA', { cause: e })
    }
  }
}

function repararJSON(texto) {
  const ini = texto.search(/[[{]/)
  const fin = Math.max(texto.lastIndexOf('}'), texto.lastIndexOf(']'))
  let t = ini >= 0 && fin > ini ? texto.slice(ini, fin + 1) : texto
  // saltos de línea y tabuladores literales dentro de las cadenas
  let fuera = '', enCadena = false, escape = false
  for (const c of t) {
    if (enCadena) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') enCadena = false
      else if (c === '\n') { fuera += '\\n'; continue }
      else if (c === '\r') continue
      else if (c === '\t') { fuera += '\\t'; continue }
    } else if (c === '"') enCadena = true
    fuera += c
  }
  // comas antes de cerrar objeto o lista
  return fuera.replace(/,\s*([}\]])/g, '$1')
}

// ─── Unified IA caller — la IA de la organización: Gemini y, si no, Claude (server-side)

// tarea 'guion': el servidor usa el modelo de guiones (Gemini 4 Argon, ver
// MODELOS_GUION en server.js); sin tarea, el modelo general.
async function llamarIA(prompt, temperature = 0.8, tarea = null) {
  const response = await fetch(apiUrl('/api/gemini'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ prompt, temperature, ...(tarea ? { tarea } : {}) }),
  })

  const raw = await parseApiResponse(response)
  return extraerJSON(raw.text)
}

// Sin respuesta del servidor (fetch rechazado): pasa cuando Render reinicia el
// backend en un deploy o al despertar del plan gratuito. Tarda ~1 min, así que
// esos fallos esperan más que un 502 o un JSON roto.
const ERROR_DE_RED = /failed to fetch|networkerror|load failed|network request failed/i
const ESPERAS_RED_MS = [5000, 15000, 30000]

async function llamarIAConRetry(prompt, temperature = 0.8, tarea = null) {
  for (let i = 0; ; i++) {
    try {
      return await llamarIA(prompt, temperature, tarea)
    } catch (error) {
      const msg = error.message || ''
      const red = ERROR_DE_RED.test(msg)
      const retryable = red || /50[023]|overloaded|procesar respuesta|JSON_TRUNCADO|no devolvió contenido/i.test(msg)
      const intentos = red ? ESPERAS_RED_MS.length : 2
      if (retryable && i < intentos) {
        const espera = red ? ESPERAS_RED_MS[i] : 2000 * (i + 1)
        console.warn(`[IA] Intento ${i + 1} fallido (${msg}), reintentando en ${espera / 1000}s...`)
        await new Promise(r => setTimeout(r, espera))
        continue
      }
      if (red) throw new Error('No hay conexión con el servidor de Aify. Comprueba tu internet y vuelve a intentarlo en un minuto.', { cause: error })
      throw error
    }
  }
}

// ─── Generadores ──────────────────────────────────────────────────────────────

export async function generarCopies(cliente, red, descripcion, ctx = {}) {
  const { busquedasRelacionadas = [] } = ctx

  const formatos = {
    instagram_reel: 'Gancho en primeras 3 palabras + desarrollo + CTA + hashtags. Máx 300 chars visibles',
    tiktok: 'Primeras 2 palabras críticas para enganchar + tono directo + máx 150 chars + hashtags trending',
    instagram_post: 'Storytelling corto + conexión emocional + CTA + hashtags. Máx 2200 chars',
    googlemaps: 'Keywords locales naturales + credibilidad + CTA. 150-250 palabras. Sin hashtags.',
    whatsapp: 'Mensaje directo + sensación exclusiva + CTA claro. Máx 200 chars.',
    facebook: 'Conversacional + genera comentarios + pregunta al final',
    youtube: 'Descripción SEO optimizada + keywords en primeras 2 líneas',
  }

  const busquedasTexto = busquedasRelacionadas.length
    ? `\nBUSQUEDAS RELACIONADAS ACTUALES: ${busquedasRelacionadas.map(b => b.query || b.formattedValue).filter(Boolean).join(', ')}`
    : ''

  const prompt = `${SYSTEM_PROMPT}

${construirPromptCliente(cliente)}

RED SOCIAL: ${red}
FORMATO: ${formatos[red] || 'Copy optimizado para la plataforma'}
CONTENIDO A PROMOCIONAR: "${descripcion || 'Contenido general del negocio'}"
${busquedasTexto}

Genera 3 variantes de copy completamente distintas (enfoques: emocional, urgencia, storytelling, humor, educativo, social proof...).

JSON exacto:
{
  "variantes": [
    {
      "id": 1,
      "variante": "Variante A — Emocional",
      "copy": "Copy completo listo para publicar",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "engagement": "Alto",
      "longitud": "Corto",
      "nota": "Por qué funciona: explicación en 1 frase"
    },
    {
      "id": 2,
      "variante": "Variante B — Urgencia",
      "copy": "Copy completo listo para publicar",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "engagement": "Muy alto",
      "longitud": "Medio",
      "nota": "Por qué funciona: explicación en 1 frase"
    },
    {
      "id": 3,
      "variante": "Variante C — Storytelling",
      "copy": "Copy completo listo para publicar",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "engagement": "Viral",
      "longitud": "Largo",
      "nota": "Por qué funciona: explicación en 1 frase"
    }
  ]
}

"engagement": Alto / Muy alto / Viral / Medio-alto
"longitud": Muy corto / Corto / Medio / Largo`

  const data = await llamarIAConRetry(prompt, 0.85)
  return data?.variantes ?? null
}

const PLANO_EJEMPLO_JSON = `{
      "segundos": "0-3",
      "plano": "tipo de plano (primer plano a cámara, plano detalle, plano general...)",
      "visual": "qué se ve en pantalla",
      "dice": "lo que se dice en este plano"
    }`

// Bloque del prompt: o la IA escribe la historia, o usa la que ya corrigió el gestor
function bloqueHistoria(historia, pieza = 'vídeo') {
  if (historia) return `
LA HISTORIA EN 5 LÍNEAS (ya escrita y revisada por el gestor: úsala TAL CUAL, no la cambies):
${textoHistoria(historia)}
Todo el ${pieza} cuenta esta historia, en este orden. Lo que no conecte con alguna de las 5 líneas, fuera.
`
  return `
ANTES DE ESCRIBIR, la historia en 5 líneas (una frase corta cada una):
${CAMPOS_HISTORIA.map(({ label, pregunta }, i) => `${i + 1}. ${label.toUpperCase()}: ${pregunta}`).join('\n')}
En un vídeo de negocio el protagonista casi nunca es el negocio: suele ser el espectador.
La situación es algo que cree o vive él, el conflicto es su miedo o lo que no sabe,
y el negocio pone el cambio. No hay temas aburridos, hay historias mal contadas.
Todo el ${pieza} cuenta esta historia, en este orden. Lo que no conecte con alguna de las 5 líneas, fuera.
`
}

const HISTORIA_JSON = `"historia": {
${CAMPOS_HISTORIA.map(({ key, label }) => `    "${key}": "${label.toLowerCase()}, una frase"`).join(',\n')}
  },`

// formato 'carrusel' escribe el guion de un carrusel (slides con texto e
// imagen) en vez del de un vídeo; ver generarGuionCarrusel.
// opciones.historia: reescribe el guion desde esa historia en 5 líneas.
export async function generarGuion(cliente, tema, usarTendencias = true, videosVirales = [], formato = 'video', opciones = {}) {
  const historia = normalizarHistoria(opciones.historia)
  if (formato === 'carrusel') return generarGuionCarrusel(cliente, tema, { historia })
  const contextoCliente = cliente ? `
DATOS DEL CREADOR/MARCA:
- Nombre/Marca: ${cliente.nombre}
- Sector: ${cliente.sector}
- Descripción: ${cliente.descripcion}
- Diferencial: ${cliente.diferencial}
- Audiencia objetivo: ${cliente.audiencia?.descripcion || `${cliente.audiencia?.edadMin}-${cliente.audiencia?.edadMax} años, ${cliente.audiencia?.genero}`}
- Valores de la audiencia: ${cliente.audiencia?.valores?.join(', ')}
- Tono de voz: ${cliente.tono} — ${cliente.tonoDescripcion}
- Energía: ${cliente.energia}
- Emojis: ${cliente.usoEmojis === 'ninguno' ? 'PROHIBIDO usar emojis' : cliente.usoEmojis}
- Lo que nunca debe aparecer: ${cliente.prohibido}
${cliente.perfilComunicacion?.resumen_estilo ? `- Estilo detectado en sus vídeos: ${cliente.perfilComunicacion.resumen_estilo}` : ''}
${cliente.historial?.queHaFuncionado ? `- Qué ha funcionado antes: ${cliente.historial.queHaFuncionado}` : ''}
${lineasOnboardingV2(cliente)}
${lineasVozCliente(cliente)}
${esMarcaPersonal(cliente) ? `\n${bloqueMarcaPersonal(cliente)}\n` : ''}
` : 'Sin cliente específico — guión genérico de marketing.'

  const prompt = `
Escribes guiones de vídeos cortos (Reels y TikTok) para negocios reales.
Un gestor de redes los va a grabar con un móvil en el negocio, así que todo lo que escribas tiene que ser verdad y grabable.

${contextoCliente}

TEMA DEL VÍDEO: ${tema}
${usarTendencias && videosVirales.length > 0 ? `
REFERENCIAS VIRALES ACTUALES EN EL SECTOR:
${videosVirales.map(v => `- "${v.titulo}" (${v.canal})`).join('\n')}
Inspírate en estos formatos pero crea algo 100% original.
` : ''}
${bloqueHistoria(historia, 'guion')}
DATOS: SOLO LOS QUE TIENES
Usa únicamente lo que dicen los datos de la marca y el tema.
No inventes precios, ingredientes, pesos, tiempos de cocción, nombres de productos, ofertas, horarios, plazos ni cifras.
Si el guion necesita un dato que no tienes, déjalo entre corchetes para que lo rellene el gestor: [nombre de la hamburguesa del mes], [precio].
Un guion con un hueco entre corchetes vale más que uno con un dato falso.

CÓMO SE ESCRIBE
1. GANCHO (0-3 s). Dice de qué va el vídeo y para quién, en una o dos frases.
   Abre una pregunta que el vídeo responde: el espectador se queda para saber la respuesta.
   La respuesta NO va en el gancho.
${REGLAS_GANCHO}
   El contraste de la segunda frase solo si es real; no repitas siempre «casi todos..., pero...».
2. PROBLEMA (después del gancho). Una escena concreta que el espectador ha vivido, en segunda persona:
   dónde está, qué hace, qué le fastidia. Nada de frases genéricas («estás cansado de lo mismo»).
3. PROMESA. Una frase que conecta el problema con lo que viene. Prohibido anunciar el vídeo
   («te voy a enseñar», «quédate hasta el final», «al final te digo», «atento a esto»).
4. CONTENIDO. El cambio, paso a paso. Cada paso nace del anterior: «X, pero Y, así que Z».
   Si hay un límite o una condición real (horario, zona, plazas), dilo: da credibilidad.
5. CIERRE. Responde la pregunta del gancho con claridad: es el pago del vídeo.
   Toda pregunta que hayas abierto queda contestada antes del CTA.
   CTA: o una acción concreta (reservar, pedir, venir) o «mándaselo a tu amigo que...»,
   y ese amigo tiene que tener que ver con lo que se ha contado, no ser cualquiera.

PLANOS (para grabar y editar)
- El primer plano ya tiene acción y producto desde el fotograma 0. Nada de alguien quieto saludando a cámara.
- Enséñalo, no lo cuentes: cada frase tiene un plano que muestra literalmente lo que se dice.
- Si una cifra o un dato es clave, indica en el visual el texto en pantalla: TEXTO: «...».
- Entre 5 y 9 planos. Lo que se dice en los planos es el texto del guion, en orden.
- Que lo grabe una persona con un móvil en el negocio. Nada de efectos imposibles.

DURACIÓN
Calcula los segundos con unas 2,5 palabras por segundo.
Teaser o anuncio: 15-25 s. Explicación o receta: 25-45 s. No rellenes para llegar a 60.

LENGUAJE
- Frases de 10 palabras como mucho, una idea cada una. Habla como una persona, no como un anuncio.
- Nada de palabras vacías: «increíble», «épico», «para flipar», «la maravilla», «revolución».
- Español natural del país de la marca. En España, tuteo y nunca voseo.
- Adapta el tono al perfil de la marca.
- ${cliente?.usoEmojis === 'ninguno' ? 'CERO EMOJIS en todo el guión' :
    cliente?.usoEmojis === 'puntual' ? 'Máximo 1-2 emojis en todo el guión' :
    'Usa emojis de forma natural según el tono'}

Antes de responder, repasa: ¿hay algún dato inventado? ¿la pregunta del gancho se responde? ¿cada plano enseña lo que se dice? Si algo falla, corrígelo.

Responde ÚNICAMENTE con este JSON:
{
  ${HISTORIA_JSON}
  "gancho": "frase exacta de los primeros 3 segundos",
  "problema": {
    "texto": "la escena que el espectador ha vivido",
    "segundos": "desde-hasta"
  },
  "promesa": {
    "texto": "la frase que conecta con lo que viene",
    "segundos": "desde-hasta"
  },
  "contenido": {
    "frases": [
      "frase 1",
      "frase 2",
      "frase 3"
    ],
    "loopAbierto": "la pregunta que abre el gancho y que responde el cierre",
    "segundos": "desde-hasta"
  },
  "cierre": {
    "remate": "la respuesta a la pregunta del gancho",
    "cta": "llamada a la acción específica",
    "segundos": "desde-hasta"
  },
  "duracion_total": "segundos totales, p. ej. 28s",
  "tip_viral": "consejo específico para maximizar la retención de este vídeo",
  "audio_sugerido": "tipo de música o sonido recomendado",
  "planos": [
    ${PLANO_EJEMPLO_JSON}
  ]
}
`

  const data = await llamarIAConRetry(prompt, 0.85, 'guion')
  if (!data?.gancho) return data
  return conHistoria(data, historia)
}

// La historia que dio el gestor manda sobre la que devuelva la IA; si no hay
// ninguna completa, el guion va sin el campo
function conHistoria(guion, historia, deLaIA = guion.historia) {
  const resto = { ...guion }
  delete resto.historia
  const h = historia || normalizarHistoria(deLaIA)
  return h ? { ...resto, historia: h } : resto
}

// Guion de un carrusel de Instagram: portada, slides y cierre, cada una con el
// texto que lleva y la imagen que hay que hacer o buscar. Devuelve la misma
// forma que un guion de vídeo (gancho, contenido.frases, cierre, planos) para
// que Guiones del mes, la aprobación del cliente y los PDF lo enseñen igual;
// en los planos de carrusel `dice` es el texto de la slide y `visual` la imagen.
export async function generarGuionCarrusel(cliente, tema, { historia = null } = {}) {
  const contextoCliente = cliente ? `
DATOS DE LA MARCA:
- Nombre/Marca: ${cliente.nombre}
- Sector: ${cliente.sector}
- Descripción: ${cliente.descripcion}
- Diferencial: ${cliente.diferencial}
- Audiencia objetivo: ${cliente.audiencia?.descripcion || `${cliente.audiencia?.edadMin}-${cliente.audiencia?.edadMax} años, ${cliente.audiencia?.genero}`}
- Tono de voz: ${cliente.tono} — ${cliente.tonoDescripcion}
- Emojis: ${cliente.usoEmojis === 'ninguno' ? 'PROHIBIDO usar emojis' : cliente.usoEmojis}
- Lo que nunca debe aparecer: ${cliente.prohibido}
${lineasOnboardingV2(cliente)}
${lineasVozCliente(cliente)}
${esMarcaPersonal(cliente) ? `\n${bloqueMarcaPersonal(cliente)}\n` : ''}
` : 'Sin cliente específico — carrusel genérico de marketing.'

  const prompt = `
Actúa como el mejor creador de carruseles de Instagram del mundo.
Sabes que la portada decide si alguien desliza o no,
que cada slide tiene que dar ganas de pasar a la siguiente
y que la gente guarda y comparte los carruseles que le resuelven algo.

${contextoCliente}

TEMA DEL CARRUSEL: ${tema}
${bloqueHistoria(historia, 'carrusel')}
Escribe el guion de UN CARRUSEL (no de un vídeo: aquí nadie habla a cámara).
Cada slide tiene dos cosas:
- TEXTO: lo que pone en la slide, tal cual se maqueta. Corto: máximo 25 palabras por slide.
- IMAGEN: la foto o el diseño de fondo que lleva, concreto y realista
  (una foto que se pueda hacer en el negocio del cliente con un móvil, o un fondo de color de marca).

Estructura:
1. PORTADA: una frase que pare el scroll y prometa algo concreto.
2. Entre 4 y 7 SLIDES de contenido: una idea por slide, en orden, con números concretos si puedes.
3. CIERRE: remate + llamada a la acción clara (guardar, compartir, escribir, reservar...).

REGLAS ABSOLUTAS:
- Cero tecnicismos. Habla como una persona normal
- El tono es cercano, directo y con personalidad. Nada corporativo
- Adapta el tono y estilo al perfil del cliente indicado
- ${cliente?.usoEmojis === 'ninguno' ? 'CERO EMOJIS en todo el carrusel' : 'Máximo 1-2 emojis en todo el carrusel'}

Responde ÚNICAMENTE con este JSON:
{
  ${HISTORIA_JSON}
  "portada": { "texto": "texto de la portada", "imagen": "qué imagen lleva la portada" },
  "slides": [
    { "texto": "texto de la slide", "imagen": "qué imagen lleva" }
  ],
  "cierre": { "texto": "remate y llamada a la acción", "imagen": "qué imagen lleva", "cta": "la llamada a la acción sola" },
  "tip": "consejo concreto para que este carrusel se guarde y se comparta"
}
`

  const data = await llamarIAConRetry(prompt, 0.85, 'guion')
  if (!data?.portada?.texto) return null
  const slides = Array.isArray(data.slides) ? data.slides.filter(s => s?.texto) : []
  const planos = [
    { plano: 'Portada', dice: data.portada.texto, visual: data.portada.imagen || '' },
    ...slides.map((s, i) => ({ plano: `Slide ${i + 2}`, dice: s.texto, visual: s.imagen || '' })),
    ...(data.cierre?.texto ? [{ plano: 'Cierre', dice: data.cierre.texto, visual: data.cierre.imagen || '' }] : []),
  ]
  return conHistoria({
    formato: 'carrusel',
    gancho: data.portada.texto,
    contenido: { frases: slides.map(s => s.texto) },
    cierre: { remate: data.cierre?.texto || '', cta: data.cierre?.cta || '' },
    duracion_total: `${planos.length} slides`,
    tip_viral: data.tip || '',
    planos,
  }, historia, data.historia)
}

// Añade los planos a un guión que ya existe (los generados antes de que el
// guión los incluyera), sin tocar el texto: los planos reparten ese mismo
// texto en tomas, así lo aprobado no cambia de contenido.
export async function generarPlanos(cliente, tema, guion) {
  const prompt = `
Actúa como un director de contenido para Reels y TikTok.
Tienes que convertir un guión ya escrito en la lista de planos que se graban.

${cliente ? `MARCA: ${cliente.nombre} (${cliente.sector})${cliente.ubicacion ? `, ${cliente.ubicacion}` : ''}` : ''}
TEMA DEL VÍDEO: ${tema}

GUIÓN:
GANCHO: ${guion.gancho || ''}
PROBLEMA: ${guion.problema?.texto || ''}
PROMESA: ${guion.promesa?.texto || ''}
DESARROLLO:
${(guion.contenido?.frases || []).map((f, i) => `${i + 1}. ${f}`).join('\n')}
REMATE: ${guion.cierre?.remate || ''}
CTA: ${guion.cierre?.cta || ''}
DURACIÓN: ${guion.duracion_total || '60s'}

TAREA: divide el guión en los planos que se graban, en orden.
- Entre 5 y 9 planos
- Lo que se dice en cada plano es el texto del guión, sin reescribirlo
- Que lo pueda grabar una persona con un móvil en el negocio del cliente
- ${cliente?.usoEmojis === 'ninguno' ? 'CERO EMOJIS' : 'Sin emojis en la descripción de los planos'}

Responde ÚNICAMENTE con este JSON:
{
  "planos": [
    ${PLANO_EJEMPLO_JSON}
  ]
}
`

  const data = await llamarIAConRetry(prompt, 0.6, 'guion')
  const planos = Array.isArray(data?.planos) ? data.planos : null
  if (!planos?.length) throw new Error('La IA no devolvió planos válidos. Intenta de nuevo.')
  return planos
}

// Pieza SIN TEXTO: un vídeo de solo planos (cinemático, sin nadie hablando a
// cámara ni guion leído) o un carrusel de solo fotos. Devuelve la misma forma
// que un guion (gancho, planos...) con `sinTexto: true`, para que Guiones del
// mes, la aprobación del cliente y la hoja de rodaje lo enseñen igual: el
// gancho es visual y en los planos `dice` va vacío.
export async function generarPiezaSinTexto(cliente, tema, formato = 'video') {
  const esCarrusel = formato === 'carrusel'
  const prompt = `
Actúa como un director de fotografía y creador de contenido para Instagram.
${cliente ? construirPromptCliente(cliente) : 'Sin cliente específico.'}

PIEZA: ${tema}

Prepara ${esCarrusel
    ? 'un CARRUSEL DE SOLO FOTOS: sin texto encima, las fotos cuentan la historia por sí solas'
    : 'un VÍDEO DE SOLO PLANOS, cinematográfico: nadie habla a cámara, no hay guion ni voz en off; lo cuentan las imágenes, el ritmo y la música'}.
- ${esCarrusel ? 'Entre 4 y 8 fotos, en el orden en que se publican' : 'Entre 6 y 12 planos, en el orden del montaje, con su duración'}
- Que lo pueda hacer una persona con un móvil en el negocio del cliente
- La primera ${esCarrusel ? 'foto' : 'imagen'} tiene que parar el scroll por sí sola
- Concreto: luz, encuadre, movimiento y qué aparece en cada ${esCarrusel ? 'foto' : 'plano'}
- Sin emojis

Responde ÚNICAMENTE con este JSON:
{
  "gancho": "qué se ve en la primera ${esCarrusel ? 'foto' : 'imagen'} y por qué para el scroll",
  "planos": [
    { ${esCarrusel ? '' : '"segundos": "0-2", '}"plano": "${esCarrusel ? 'Foto 1' : 'tipo de plano (detalle, general, cenital, slow motion...)'}", "visual": "qué se ve, con luz y encuadre" }
  ],
  ${esCarrusel ? '' : '"duracion_total": "15s",\n  "audio_sugerido": "tipo de música o sonido que lleva",\n  '}"tip_viral": "consejo concreto para que funcione"
}
`
  const data = await llamarIAConRetry(prompt, 0.8, 'guion')
  const planos = (Array.isArray(data?.planos) ? data.planos : [])
    .filter(p => p?.visual)
    .map((p, i) => ({ ...p, plano: p.plano || (esCarrusel ? `Foto ${i + 1}` : `Plano ${i + 1}`), dice: '' }))
  if (!data?.gancho || !planos.length) throw new Error('La IA no devolvió los planos. Intenta de nuevo.')
  return {
    formato: esCarrusel ? 'carrusel' : 'video',
    sinTexto: true,
    gancho: data.gancho,
    contenido: { frases: [] },
    cierre: { remate: '', cta: '' },
    duracion_total: esCarrusel ? `${planos.length} fotos` : (data.duracion_total || ''),
    tip_viral: data.tip_viral || '',
    audio_sugerido: esCarrusel ? '' : (data.audio_sugerido || ''),
    planos,
  }
}

// Reescribe una idea: con las indicaciones del gestor ("que pase de noche",
// "más corto", "con la dueña saliendo"...) y/o pasándola a otro formato o
// estilo. Mantiene lo que no se pide cambiar. Devuelve { titulo, concepto,
// formatoSugerido, porQueFunc }.
export async function reescribirIdea(cliente, idea, { indicaciones = '', formato, sinTexto = false } = {}) {
  const destino = formato === 'carrusel'
    ? (sinTexto ? 'un carrusel de solo fotos, sin texto encima' : 'un carrusel de Instagram (varias slides con texto e imagen)')
    : (sinTexto ? 'un vídeo de solo planos, cinematográfico, sin nadie hablando ni guion' : 'un vídeo (Reel/TikTok) con guion')
  const prompt = `
Eres el estratega de contenido de esta marca.
${cliente ? construirPromptCliente(cliente) : ''}

IDEA ACTUAL:
- Título: ${idea.titulo || ''}
- De qué va: ${idea.concepto || ''}
- Formato que ponía: ${idea.formatoSugerido || idea.formato || ''}
${idea.porQueFunc ? `- Por qué funciona: ${idea.porQueFunc}` : ''}

TAREA: reescribe la idea para que sea ${destino}.
${indicaciones.trim() ? `Cambios que pide el gestor (OBLIGATORIOS): "${indicaciones.trim()}"` : 'Sin más cambios: adapta solo lo necesario al formato.'}
- Todo el texto tiene que hablar de ese formato: si es vídeo no menciones fotos ni slides, si es carrusel no menciones planos ni vídeo
- Conserva lo que no se pide cambiar (tema, gancho, tono)
- Sin emojis

Responde ÚNICAMENTE con este JSON:
{
  "titulo": "título llamativo y específico",
  "concepto": "de qué va, en 2-3 frases concretas",
  "formatoSugerido": "${formato === 'carrusel' ? (sinTexto ? 'Carrusel de 5 fotos' : 'Carrusel 6 slides') : (sinTexto ? 'Reel cinemático 15s' : 'Reel 30s')}",
  "porQueFunc": "por qué funciona para este cliente"
}
`
  const data = await llamarIAConRetry(prompt, 0.7)
  if (!data?.titulo || !data?.concepto) throw new Error('La IA no devolvió la idea reescrita. Intenta de nuevo.')
  return {
    titulo: data.titulo, concepto: data.concepto,
    formatoSugerido: data.formatoSugerido || '', porQueFunc: data.porQueFunc || idea.porQueFunc || '',
  }
}

const PARTES_GUION = {
  gancho: {
    label: 'el GANCHO (primeros 3 segundos)',
    instrucciones: `Un resumen clarísimo de lo que va a ver, como un título, muchas veces en forma de pregunta. Dice el tema, no el secreto. Nunca un misterio sin tema ni saludar o presentarse. La primera frase, máximo 10 palabras; si hay segunda frase (el contraste), también corta.\n${REGLAS_GANCHO}`,
  },
  problema: {
    label: 'el PROBLEMA O IDENTIFICACIÓN (segundos 4-10)',
    instrucciones: 'El espectador tiene que sentir que le estás leyendo la mente. Descríbele su situación actual con tanta precisión que piense "esto es para mí".',
  },
  promesa: {
    label: 'la PROMESA O GIRO (segundos 10-20)',
    instrucciones: 'Cuéntale qué va a descubrir si sigue viendo. Dale una razón irresistible para no irse.',
  },
  loopAbierto: {
    label: 'el LOOP ABIERTO',
    instrucciones: 'Una pregunta o gancho que se deja sin resolver hasta el final del vídeo, para generar curiosidad y retención.',
  },
  remate: {
    label: 'el REMATE (frase de cierre emocional, justo antes del CTA)',
    instrucciones: 'Un remate que genere emoción o urgencia.',
  },
  cta: {
    label: 'el CTA (llamada a la acción final)',
    instrucciones: 'Una llamada a la acción clara, directa y específica.',
  },
  tipViral: {
    label: 'el TIP VIRAL',
    instrucciones: 'Un consejo específico y accionable para maximizar la retención de este vídeo concreto (edición, ritmo, texto en pantalla, momento de grabación...).',
  },
  audioSugerido: {
    label: 'el AUDIO SUGERIDO',
    instrucciones: 'El tipo de música o sonido recomendado para este vídeo concreto.',
  },
  frase: {
    label: 'UNA frase del contenido principal (desarrollo)',
    instrucciones: 'Frase corta (máximo 10 palabras), clara, sin tecnicismos, que desarrolle la idea con un ejemplo concreto. Debe encajar en esa posición exacta dentro de la secuencia de frases del contenido principal, sin repetir lo que ya dicen las demás.',
  },
}

// Regenera solo una parte del guión (gancho, problema, cta, una frase concreta...)
// mandando el resto del guión actual como contexto, para que la parte nueva
// encaje en tono y no repita ideas ya usadas en las demás secciones.
export async function regenerarParteGuion(cliente, tema, guionActual, parte, opciones = {}) {
  const { indiceFrase = null } = opciones
  const def = PARTES_GUION[indiceFrase != null ? 'frase' : parte]
  if (!def) throw new Error(`Parte de guión desconocida: ${parte}`)

  const contextoCliente = cliente ? `
DATOS DEL CREADOR/MARCA:
- Nombre/Marca: ${cliente.nombre}
- Sector: ${cliente.sector}
- Tono de voz: ${cliente.tono} — ${cliente.tonoDescripcion}
- Energía: ${cliente.energia}
- Emojis: ${cliente.usoEmojis === 'ninguno' ? 'PROHIBIDO usar emojis' : cliente.usoEmojis}
- Lo que nunca debe aparecer: ${cliente.prohibido}
${lineasVozCliente(cliente)}
${esMarcaPersonal(cliente) ? `\n${bloqueMarcaPersonal(cliente)}\n` : ''}
` : 'Sin cliente específico — guión genérico de marketing.'

  const prompt = `
Actúa como el mejor creador de guiones virales del mundo, el mismo que escribió el guión de abajo.
Sabes que los primeros 3 segundos lo son todo y que el scroll se para cuando en un segundo se entiende de qué va el vídeo.

${contextoCliente}

TEMA DEL VÍDEO: ${tema}
${normalizarHistoria(guionActual.historia) ? `
LA HISTORIA EN 5 LÍNEAS (la parte nueva tiene que contar la misma historia):
${textoHistoria(normalizarHistoria(guionActual.historia))}
` : ''}
GUIÓN ACTUAL COMPLETO (para que la parte nueva encaje con el resto y no repita ideas ya usadas):
GANCHO: ${guionActual.gancho}
PROBLEMA: ${guionActual.problema}
PROMESA: ${guionActual.promesa}
DESARROLLO: ${(guionActual.frases || []).map((f, i) => `${i + 1}. ${f}`).join('\n')}
${guionActual.loopAbierto ? `LOOP ABIERTO: ${guionActual.loopAbierto}` : ''}
REMATE: ${guionActual.remate}
CTA: ${guionActual.cta}

${indiceFrase != null ? `La frase a regenerar es la número ${indiceFrase + 1} del desarrollo (actualmente: "${guionActual.frases[indiceFrase]}"). Debe ocupar esa misma posición en la secuencia.` : ''}

TAREA: Genera una alternativa nueva y genuinamente distinta SOLO para ${def.label}, manteniendo coherencia con el resto del guión.
${def.instrucciones}

REGLAS:
- No repitas el texto actual, dame una variante realmente distinta
- Cero tecnicismos. Habla como una persona normal
- Tono cercano, directo y con personalidad. Nada corporativo
- ${cliente?.usoEmojis === 'ninguno' ? 'CERO EMOJIS' : 'Emojis solo si encajan de forma natural con el tono indicado'}

Responde ÚNICAMENTE con este JSON:
{"valor": "texto nuevo para esta parte"}
`

  const data = await llamarIAConRetry(prompt, 0.9)
  return data?.valor ?? null
}

// Revisa un gancho (normalmente escrito a mano por el gestor) contra los cuatro
// errores, en orden: cada uno solo se mira si el anterior está bien. Devuelve
// { errores: [{ clave, ok, motivo }], principal, version } donde `principal`
// es la clave del primer error que falla (o null) y `version` el gancho
// corregido con el mismo significado (null si ya está bien).
export const ERRORES_GANCHO = [
  { clave: 'retraso', label: 'Retraso', pregunta: '¿Se sabe de qué va el vídeo con la primera frase?' },
  { clave: 'confusion', label: 'Confusión', pregunta: '¿Se entiende a la primera y de una sola manera?' },
  { clave: 'irrelevancia', label: 'Irrelevancia', pregunta: '¿Le habla de tú y de un problema que ya tiene?' },
  { clave: 'interes', label: 'Falta de interés', pregunta: '¿Abre curiosidad con un contraste (lo de siempre frente a esto)?' },
]

export async function revisarGancho(cliente, tema, gancho, guionActual = null) {
  const prompt = `
Eres editor de guiones de vídeos cortos. Revisas ganchos (los primeros 3 segundos) con un método de cuatro errores.

${cliente ? `MARCA: ${cliente.nombre} (${cliente.sector}). Tono: ${cliente.tono}${cliente.tonoDescripcion ? ` — ${cliente.tonoDescripcion}` : ''}.
${cliente.usoEmojis === 'ninguno' ? 'PROHIBIDO usar emojis.' : ''}
${lineaEspectadorMarcaPersonal(cliente)}` : ''}
TEMA DEL VÍDEO: ${tema || '(sin tema indicado)'}
${guionActual?.problema ? `LO QUE VIENE DESPUÉS DEL GANCHO: ${guionActual.problema}` : ''}

GANCHO A REVISAR:
"${gancho}"

LOS CUATRO ERRORES, EN ESTE ORDEN:
1. retraso: la primera frase no dice de qué va el vídeo (misterio sin tema, saludo, presentación, relleno antes del tema).
2. confusion: se dice el tema pero cuesta entenderlo: palabras difíciles, frase larga, voz pasiva, o se puede entender de dos maneras.
3. irrelevancia: habla de "yo" en vez de "tú", o de un tema solo interesante en vez de un problema que el espectador ya tiene.
4. interes: no hay contraste entre lo que hace o cree todo el mundo y la alternativa del vídeo (dicho o sobreentendido), así que no abre ninguna pregunta.

Cómo debe ser un buen gancho:
- Primera frase: el tema, como un título, máximo 10 palabras. Muchas veces en pregunta.
${REGLAS_GANCHO}

TAREA:
- Para cada error di si el gancho lo pasa (ok: true) o no, con un motivo de una frase, concreto, citando las palabras del gancho.
- "principal" es el PRIMER error de la lista que falla, o null si los pasa todos.
- "version": si alguno falla, reescribe el gancho corrigiéndolo todo y manteniendo el mismo significado y el tono de la marca (máximo 2 frases cortas). Si los pasa todos, null.
- Sé exigente pero justo: no marques un error por gusto personal.

Responde ÚNICAMENTE con este JSON:
{"errores": [{"clave": "retraso", "ok": true, "motivo": "..."}, {"clave": "confusion", "ok": true, "motivo": "..."}, {"clave": "irrelevancia", "ok": false, "motivo": "..."}, {"clave": "interes", "ok": false, "motivo": "..."}], "principal": "irrelevancia", "version": "..."}
`

  const data = await llamarIAConRetry(prompt, 0.4)
  if (!data || !Array.isArray(data.errores)) throw new Error('No se pudo revisar el gancho')
  const errores = ERRORES_GANCHO.map(e => {
    const r = data.errores.find(x => x?.clave === e.clave)
    return { clave: e.clave, ok: r ? r.ok !== false : true, motivo: r?.motivo || '' }
  })
  const principal = errores.find(e => !e.ok)?.clave ?? null
  return { errores, principal, version: principal ? (data.version || null) : null }
}

// Variantes Trial: 5 versiones del mismo reel (ya publicado y que funcionó)
// para volver a subirlo como Trial Reel sin grabar nada nuevo. Cambian el
// gancho, el texto en pantalla, la música, la descripción y un ajuste visual,
// para que Instagram no lo trate como un duplicado.
export async function generarVariantesTrial(cliente, reel) {
  const saltos = reel?.saltos != null ? Number(reel.saltos) : null
  const prompt = `
Eres editor de reels. Este reel YA FUNCIONÓ y se va a reciclar como Trial Reel (Instagram lo enseña solo a gente que no sigue la cuenta).

${cliente ? `MARCA: ${cliente.nombre} (${cliente.sector}). Tono: ${cliente.tono}${cliente.tonoDescripcion ? ` — ${cliente.tonoDescripcion}` : ''}.
${cliente.usoEmojis === 'ninguno' ? 'PROHIBIDO usar emojis.' : 'Emojis: como mucho uno por descripción.'}
${lineaEspectadorMarcaPersonal(cliente)}` : ''}
DESCRIPCIÓN ORIGINAL DEL REEL: "${reel?.texto || '(sin descripción)'}"
MÉTRICAS: ${reel?.visualizaciones ?? '?'} visualizaciones, ${reel?.compartidos ?? '?'} compartidos, ${reel?.guardados ?? '?'} guardados, ${reel?.comentarios ?? '?'} comentarios${saltos != null ? `, lo saltó el ${Math.round(saltos)} %` : ''}${reel?.vistoMedioMs ? `, visto de media ${Math.round(reel.vistoMedioMs / 100) / 10} s` : ''}.

TAREA: propone 5 variantes del MISMO vídeo (mismo concepto y mismos planos). Cambia:
- "gancho": la frase o título de los 3 primeros segundos.
- "textoPantalla": el texto que va sobre el vídeo (máximo 12 palabras).
- "musica": estilo de música sugerido (tipo o ambiente, no un tema concreto con copyright).
- "caption": descripción nueva con su llamada a la acción (guardar, compartir, comentar o reservar), máximo 300 caracteres.
- "ajusteVisual": un cambio para el editor (saturación, recorte más cerrado, empezar por otro plano, cambiar el orden...).

Reglas:
- Las 5 claramente distintas entre sí: cada una con un tipo de gancho distinto (pregunta, contraste, cifra, opinión, POV).
${saltos != null && saltos > 60 ? '- Lo saltó mucha gente: al menos 3 variantes cambian el gancho a fondo.\n' : ''}${REGLAS_GANCHO}

Responde ÚNICAMENTE con este JSON:
{"variantes": [{"tipo": "pregunta", "gancho": "...", "textoPantalla": "...", "musica": "...", "caption": "...", "ajusteVisual": "..."}]}
`

  const data = await llamarIAConRetry(prompt, 0.85)
  const variantes = Array.isArray(data?.variantes) ? data.variantes.filter(v => v?.gancho) : []
  if (variantes.length < 5) throw new Error('La IA no devolvió las 5 variantes. Vuelve a intentarlo.')
  return variantes.slice(0, 5).map(v => ({
    tipo: String(v.tipo || ''), gancho: String(v.gancho || ''), textoPantalla: String(v.textoPantalla || ''),
    musica: String(v.musica || ''), caption: String(v.caption || ''), ajusteVisual: String(v.ajusteVisual || ''),
  }))
}

// Guiones similares: n guiones nuevos del mismo tipo de pieza que uno que ya
// existe (mismo formato, misma estructura, misma persona hablando, mismo
// ritmo) pero cada uno con otro tema u otro ángulo. No es el mismo guion con
// otro gancho: eso son las variantes Trial. Devuelve [{ titulo, gancho, planos, historia? }].
export async function generarGuionesSimilares(cliente, post, n = 3) {
  const carrusel = esCarrusel(post)
  const sinTexto = esSinTexto(post)
  const guion = post?.guion || {}
  const planosModelo = Array.isArray(guion.planos) ? guion.planos : []
  const historiaModelo = normalizarHistoria(guion.historia)
  const pieza = carrusel ? 'carrusel' : 'vídeo'
  const plano = carrusel ? 'slide' : 'plano'

  const prompt = `
Actúa como el mejor guionista de contenido para redes sociales del mundo.
${cliente ? construirPromptCliente(cliente) : 'Sin cliente específico.'}

GUION MODELO (${carrusel ? 'carrusel de Instagram' : 'vídeo'}${sinTexto ? ', sin texto' : ''}):
- Título: ${post?.titulo || '(sin título)'}
- ${carrusel ? 'Portada' : 'Gancho'}: ${guion.gancho || ''}
${historiaModelo ? `- Historia en 5 líneas:\n${textoHistoria(historiaModelo)}\n` : ''}- ${carrusel ? 'Slides' : 'Planos'} (${planosModelo.length}):
${planosModelo.map((p, i) => `  ${i + 1}. ${JSON.stringify({ segundos: p.segundos || '', plano: p.plano || '', visual: p.visual || '', dice: p.dice || '' })}`).join('\n')}

TAREA: escribe ${n} guiones NUEVOS del MISMO TIPO de ${pieza} que el modelo, pero cada uno con OTRO TEMA u OTRO ÁNGULO.
Mismo tipo significa:
- Mismo número aproximado de ${plano}s (unos ${planosModelo.length || 'los mismos'})
- Mismos tipos de ${plano} y en un orden parecido
- La misma persona hablando o saliendo (si habla la dueña, habla la dueña; si no sale nadie, no sale nadie)
- El mismo ritmo y el mismo largo de frase
Ejemplo: de "La dueña presenta el menú de Halloween" saldría "La dueña presenta el menú de Navidad" o "El chef explica el plato más pedido".
- Los ${n} distintos entre sí y distintos del modelo: no repitas su tema ni su gancho.
${carrusel
    ? '- Es un CARRUSEL: cada plano es una slide; "dice" es el texto que pone la slide (máximo 25 palabras) y "visual" la imagen que lleva. Sin "segundos".'
    : '- Es un VÍDEO: cada plano lleva "segundos", "plano" (tipo de plano), "visual" (qué se ve) y "dice" (lo que se dice).'}
${sinTexto ? `- Es una pieza SIN TEXTO: nadie habla ni hay texto encima; "dice" va SIEMPRE vacío ("") y el gancho es lo que se ve en la primera ${carrusel ? 'foto' : 'imagen'}.` : ''}
${REGLAS_GANCHO}
${historiaModelo ? '- Cada guion lleva también su propia historia en 5 líneas (campo "historia").' : ''}

Responde ÚNICAMENTE con este JSON:
{
  "guiones": [
    {
      "titulo": "título corto de la pieza, que se entienda solo",
      ${historiaModelo ? HISTORIA_JSON : ''}
      "gancho": "${carrusel ? 'texto de la portada' : 'frase exacta de los primeros 3 segundos'}",
      "planos": [
        { "segundos": "${carrusel ? '' : '0-3'}", "plano": "${carrusel ? 'Portada' : 'tipo de plano'}", "visual": "${carrusel ? 'qué imagen lleva' : 'qué se ve'}", "dice": "${sinTexto ? '' : carrusel ? 'texto de la slide' : 'lo que se dice'}" }
      ]
    }
  ]
}
`

  const data = await llamarIAConRetry(prompt, 0.85)
  const guiones = (Array.isArray(data?.guiones) ? data.guiones : [])
    .filter(g => g?.gancho && Array.isArray(g.planos) && g.planos.length)
    .map(g => {
      const planos = g.planos.map((p, i) => ({
        segundos: carrusel ? '' : String(p?.segundos || ''),
        plano: String(p?.plano || (carrusel ? `Slide ${i + 1}` : `Plano ${i + 1}`)),
        visual: String(p?.visual || ''),
        dice: sinTexto ? '' : String(p?.dice || ''),
      }))
      const historia = historiaModelo ? normalizarHistoria(g.historia) : null
      return {
        titulo: String(g.titulo || g.gancho),
        gancho: String(g.gancho),
        planos,
        ...(historia ? { historia } : {}),
      }
    })
  if (!guiones.length) throw new Error('La IA no devolvió guiones válidos. Intenta de nuevo.')
  return guiones.slice(0, n)
}

export async function generarPostGoogleMaps(cliente, tema) {
  const prompt = `${SYSTEM_PROMPT}

${construirPromptCliente(cliente)}

TIPO DE CONTENIDO: "${tema || 'Actualización general del negocio'}"

Genera 3 posts para Google Business Profile optimizados para SEO local.
Requisitos: lenguaje natural (no robótico), keywords locales integradas,
motivar visitas presenciales, 150-250 palabras por post.

JSON exacto:
{
  "posts": [
    {
      "id": 1,
      "titulo": "Título descriptivo del post",
      "texto": "Texto completo del post optimizado para SEO local",
      "keywords": ["keyword local 1", "keyword local 2", "keyword local 3"],
      "puntuacion": 87
    },
    {
      "id": 2,
      "titulo": "Título del segundo post",
      "texto": "Texto completo",
      "keywords": ["keyword 1", "keyword 2"],
      "puntuacion": 82
    },
    {
      "id": 3,
      "titulo": "Título del tercer post",
      "texto": "Texto completo",
      "keywords": ["keyword 1", "keyword 2"],
      "puntuacion": 79
    }
  ]
}`

  const data = await llamarIAConRetry(prompt, 0.7)
  return data?.posts ?? null
}

export async function generarMensajeWhatsapp(cliente, descripcion, ctx = {}) {
  const { busquedasRelacionadas = [] } = ctx

  const busquedasTexto = busquedasRelacionadas.length
    ? `\nTENDENCIAS ACTUALES DEL SECTOR: ${busquedasRelacionadas.map(b => b.query || b.formattedValue).filter(Boolean).join(', ')}`
    : ''

  const prompt = `${SYSTEM_PROMPT}

${construirPromptCliente(cliente)}

CONTENIDO: "${descripcion || 'Mensaje para canal de WhatsApp'}"
${busquedasTexto}

Genera 3 mensajes para canal de WhatsApp Business distintos.
Cada uno debe ser directo, con sensación exclusiva, máx 200 chars + CTA claro.

JSON exacto:
{
  "mensajes": [
    {
      "id": 1,
      "tipo": "Oferta exclusiva",
      "mensaje": "Texto completo del mensaje listo para enviar",
      "cta": "CTA específico",
      "longitud": "Corto"
    },
    {
      "id": 2,
      "tipo": "Novedad",
      "mensaje": "Texto completo",
      "cta": "CTA específico",
      "longitud": "Medio"
    },
    {
      "id": 3,
      "tipo": "Recordatorio",
      "mensaje": "Texto completo",
      "cta": "CTA específico",
      "longitud": "Corto"
    }
  ]
}`

  const data = await llamarIAConRetry(prompt, 0.85)
  return data?.mensajes ?? null
}

// Identidad visual y estilo de los vídeos del cliente (kit de marca y onboarding)
function construirContextoVisual(cliente) {
  const iv = cliente.identidadVisual || {}
  const tv = cliente.textoVideos || {}
  const colores = [iv.colorPrimario, iv.colorSecundario, iv.colorAcento, iv.colorFondo].filter(Boolean)
  const lineas = [
    colores.length && `- Colores de marca: ${colores.join(', ')}`,
    (iv.estetica || []).length && `- Estética: ${iv.estetica.join(', ')}`,
    iv.referenciaEstetica && `- Referencia estética: ${iv.referenciaEstetica}`,
    (iv.fuenteEspecifica || iv.estiloTipografia) && `- Tipografía: ${[iv.fuenteEspecifica, iv.estiloTipografia].filter(Boolean).join(' · ')}`,
    (tv.posicion || tv.estiloSubtitulos || (tv.animaciones || []).length) && `- Texto en los vídeos: ${[tv.posicion, tv.tamano, tv.estiloSubtitulos, ...(tv.animaciones || [])].filter(Boolean).join(', ')}`,
  ].filter(Boolean)
  return lineas.length ? `=== IDENTIDAD VISUAL Y ESTILO DE ${String(cliente.nombre || 'EL CLIENTE').toUpperCase()} ===\n${lineas.join('\n')}\n=========================================` : ''
}

export async function generarLluviaIdeas(cliente, tema, opciones = {}) {
  const {
    tiposContenido = [],
    formato = 'todos',
    numIdeas = 8,
    nivelCreatividad = 5,
    usarTendencias = true,
    tieneIdea = false,
    ideaTexto = '',
    tieneAnuncio = false,
    anuncioTexto = '',
    anuncioFecha = '',
    anuncioObjetivo = '',
    tieneReferencia = false,
    referenciaUrl = '',
    referenciaNota = '',
    // Títulos ya propuestos en esta misma tanda (las de más de 15 ideas se
    // piden en varias llamadas): la IA no debe repetirlos
    evitarTitulos = [],
    // Resumen de sus métricas reales de Instagram (utils/resumenInstagram.js) o null
    instagram = null,
    // Lo mismo de TikTok (utils/resumenTikTok.js) o null
    tiktok = null,
  } = opciones

  const contextoCliente = cliente ? construirPromptCliente(cliente) : 'No hay cliente seleccionado — genera ideas genéricas de marketing para redes sociales.'
  const hayReferencia = tieneReferencia && !!referenciaUrl.trim()
  // Con una idea propia o un vídeo de referencia, el usuario ya sabe qué
  // quiere: se respeta literalmente y solo se adapta al estilo del cliente
  const literal = (tieneIdea && !!ideaTexto.trim()) || hayReferencia
  const nombreCliente = cliente?.nombre || 'este cliente'
  const versiones = numIdeas > 1
    ? `Se piden ${numIdeas} versiones: la primera es la más fiel; las demás son EXACTAMENTE la misma idea con otro gancho de apertura u otro detalle de ejecución, nunca otro concepto ni otro tema.`
    : 'Se pide 1 sola versión: la más fiel posible.'
  const contextoVisual = cliente ? construirContextoVisual(cliente) : ''

  let contextoEspecifico
  // Se marca a true cuando la referencia ya queda cubierta dentro de
  // contextoEspecifico (caso "solo referencia, sin idea ni anuncio") para no
  // duplicarla luego en contextoReferenciaExtra.
  let referenciaYaIncluida = false

  if (tieneIdea && tieneAnuncio && ideaTexto && anuncioTexto) {
    contextoEspecifico = `
=== EL USUARIO TIENE UNA IDEA Y UN ANUNCIO ===
Idea: "${ideaTexto}"
Anuncio: "${anuncioTexto}"
${anuncioFecha ? `Fecha del anuncio: ${anuncioFecha}` : ''}
${anuncioObjetivo ? `Objetivo: ${anuncioObjetivo}` : ''}

INSTRUCCIÓN: La idea es LITERAL: usa exactamente ese concepto, formato y estructura, y úsala para comunicar el anuncio. No la cambies por otra; solo adáptala a ${nombreCliente} (su producto, su local, su tono y su imagen). ${versiones}
=========================================`
  } else if (tieneIdea && ideaTexto) {
    contextoEspecifico = `
=== EL USUARIO TIENE UNA IDEA CONCRETA ===
"${ideaTexto}"

INSTRUCCIÓN: El usuario ya sabe exactamente qué contenido quiere. La idea es LITERAL: mismo concepto, mismo formato y misma estructura que describe. Tu trabajo es SOLO adaptarla a ${nombreCliente}: su producto o servicio, su local, su gente, su forma de hablar y su identidad visual (colores, estética, tipografía). No cambies el tema, no propongas ángulos distintos ni la conviertas en otra cosa. Si la idea no menciona algo (dónde se graba, quién sale, qué se enseña), complétalo con lo que encaje con el cliente. ${versiones}
=========================================`
  } else if (tieneAnuncio && anuncioTexto) {
    contextoEspecifico = `
=== EL USUARIO TIENE ALGO QUE ANUNCIAR ===
Anuncio: "${anuncioTexto}"
${anuncioFecha ? `Fecha del anuncio: ${anuncioFecha}` : ''}
${anuncioObjetivo ? `Objetivo principal: ${anuncioObjetivo}` : ''}

INSTRUCCIÓN: Genera ${numIdeas} formas DIFERENTES de comunicar este anuncio concreto en redes sociales. Cada idea debe comunicar el mismo anuncio pero con un enfoque distinto: expectativa, urgencia, humor, educativo, behind the scenes, testimonial, etc. Todas las ideas deben hacer referencia directa al anuncio.
=========================================`
  } else if (hayReferencia) {
    contextoEspecifico = `
=== EL USUARIO QUIERE HACER ESTE VÍDEO, ADAPTADO A SU CLIENTE ===
Enlace de referencia: ${referenciaUrl.trim()}
${referenciaNota.trim() ? `Lo que describe del vídeo / lo que quiere de él: "${referenciaNota.trim()}"` : ''}

INSTRUCCIÓN: No puedes reproducir el vídeo: dedúcelo de la plataforma, la URL y lo que cuenta el usuario (su descripción manda). Replica ESE vídeo LITERALMENTE: mismo formato, misma estructura y orden de escenas, mismo ritmo, mismo tipo de gancho y de planos y el mismo tema o mecánica. Cambia solo lo imprescindible para que sea de ${nombreCliente}: su producto, su local, su gente, su tono y su imagen. No te "inspires en el estilo" para hacer otra cosa: es el mismo vídeo hecho por esta marca. En "concepto" describe el vídeo escena a escena tal como quedaría para el cliente. ${versiones}
=========================================`
    referenciaYaIncluida = true
  } else {
    contextoEspecifico = `
=== SIN IDEA ESPECÍFICA ===
INSTRUCCIÓN: Propón ${numIdeas} ideas de contenido originales basadas en el perfil del cliente, las tendencias actuales y las oportunidades del momento. Sé creativo y sorprendente.${cliente?.temas?.filter(Boolean).length ? `\nReparte las ideas entre sus pilares de contenido: ${cliente.temas.filter(Boolean).join(', ')}.` : ''}
=========================`
  }

  const contextoReferenciaExtra = (hayReferencia && !referenciaYaIncluida) ? `

=== ADEMÁS, LE GUSTÓ ESTE VIDEO COMO REFERENCIA DE ESTILO ===
Enlace: ${referenciaUrl.trim()}
${referenciaNota.trim() ? `Qué le gustó: "${referenciaNota.trim()}"` : ''}
Ten en cuenta el formato, ritmo y tono probable de ese contenido (según la plataforma y lo indicado) al desarrollar las ideas de arriba.
=========================================` : ''

  const prompt = `Eres un director creativo experto en marketing de contenidos para redes sociales hispanohablantes.

${contextoCliente}

${contextoVisual}

${contextoEspecifico}
${contextoReferenciaExtra}
${instagram ? `
=== QUÉ LE FUNCIONA EN INSTAGRAM (datos reales de su cuenta) ===
${instagram}
${literal
  ? 'Usa estos datos SOLO para afinar la ejecución (gancho, duración, formato y texto), nunca para cambiar la idea o el vídeo pedido.'
  : 'Apóyate en estos datos: propón más de lo que le funciona (temas, formatos, tipo de gancho) y evita lo que no. En "porQueFunc" cita el dato real que respalda la idea cuando lo haya.'}
=========================================` : ''}
${tiktok ? `
=== QUÉ LE FUNCIONA EN TIKTOK (datos reales de su cuenta) ===
${tiktok}
${literal
  ? 'Usa estos datos SOLO para afinar la ejecución (gancho, duración, formato y texto), nunca para cambiar la idea o el vídeo pedido.'
  : 'Apóyate en estos datos igual que en los de Instagram: más de lo que le funciona, menos de lo que no. En "porQueFunc" cita el dato real cuando lo haya.'}
=========================================` : ''}

TEMA ADICIONAL: ${tema || 'ninguno'}
FORMATO OBJETIVO: ${formato === 'todos' ? 'Todos los formatos' : formato}
TIPOS DE CONTENIDO: ${tiposContenido.length > 0 ? tiposContenido.join(', ') : 'Variedad de todos los tipos'}
NIVEL DE CREATIVIDAD (1-10): ${nivelCreatividad}${nivelCreatividad > 7 ? ' — sé arriesgado y original' : nivelCreatividad < 4 ? ' — mantente seguro y probado' : ' — equilibra creatividad y practicidad'}
${usarTendencias && !literal ? 'IMPORTANTE: Incluye ideas que aprovechen tendencias actuales de 2026.' : ''}
${tieneAnuncio && anuncioTexto ? 'TODAS las ideas deben hacer referencia directa al anuncio indicado.' : ''}
${tieneIdea && ideaTexto ? 'TODAS las ideas son la idea indicada, literal, adaptada al cliente.' : ''}
${hayReferencia ? 'TODAS las ideas son el vídeo de referencia, literal, hecho por este cliente.' : ''}
${formato !== 'todos' ? `OBLIGATORIO: el usuario ha pedido EXCLUSIVAMENTE formato "${formato}". El campo "formato" de las ${numIdeas} ideas debe valer EXACTAMENTE "${formato}" en todas y cada una, sin excepción. No propongas ninguna idea del otro formato aunque encaje mejor con el concepto — adapta el concepto a "${formato}" en su lugar.` : ''}

${evitarTitulos.length ? `NO repitas ni reformules ninguna de estas ideas ya propuestas:\n${evitarTitulos.map(t => `- ${t}`).join('\n')}\n` : ''}Genera exactamente ${numIdeas} ${literal ? 'versiones de lo pedido, adaptadas a este cliente' : 'ideas de contenido creativas y específicas para este cliente'}.
Cada idea debe ser ACCIONABLE — que el freelance pueda ejecutarla esta misma semana.
${formato === 'todos' ? 'Especifica el formato ideal para cada idea: video (Reels/TikTok/YouTube) o carrusel (post de varias imágenes).' : `Todas las ideas deben tener "formato": "${formato}".`}
Responde ÚNICAMENTE con JSON válido, sin texto adicional.

{
  "ideas": [
    {
      "id": 1,
      "titulo": "título llamativo y específico de la idea",
      "tipo": "video|post|copy|campaña|engagement|educativo|storytelling",
      "formato": "${formato === 'todos' ? 'video|carrusel' : formato}",
      "concepto": "descripción del concepto en 2-3 frases concretas",
      "porQueFunc": "por qué esta idea funcionaría para este cliente específico",
      "dificultad": "facil|media|alta",
      "tiempoEstimado": "15min|1hora|medio_dia|dia_completo",
      "formatoSugerido": "Reel 30s|Carrusel 5 slides|Post foto|Story|etc"
    }
  ]
}`

  return llamarIAConRetry(prompt, 0.9)
}

// Preparar el mes (paso Ideas, #83): ideas para un mes concreto a partir del
// plan (de qué hablar, fechas y cuántas piezas de cada tipo). Se pide el tipo
// de cada pieza en orden y en lotes de 15, como la lluvia de ideas; el tipo
// lo fija el pedido, no la IA, para que salgan exactamente las cantidades.
export async function generarIdeasMes({ cliente, mes, notas = '', fechas = [], cantidades = {} }) {
  const pedidos = TIPOS_PIEZA.flatMap(t => Array.from({ length: Math.max(0, Number(cantidades[t.id]) || 0) }, () => t))
  const nombreMes = new Date(`${String(mes).slice(0, 7)}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const lineasFechas = fechas.filter(f => f?.nombre).map(f => `- ${f.fecha ? `${f.fecha}: ` : ''}${f.nombre}`).join('\n')
  const ideas = []
  const pedir = async (lote, yaHechas) => {
    const prompt = `
Eres el estratega de contenido de esta marca y preparas su contenido de ${nombreMes}.
${construirPromptCliente(cliente)}

DE QUÉ QUIERE HABLAR ESTE MES (OBLIGATORIO que las ideas giren en torno a esto):
${notas.trim() || 'Sin indicaciones: elige tú lo más interesante para el negocio en esas fechas.'}

FECHAS IMPORTANTES DEL MES (aprovéchalas cuando encajen):
${lineasFechas || '- Ninguna'}
${yaHechas.length ? `\nIDEAS YA PROPUESTAS (no las repitas):\n${yaHechas.map(i => `- ${i.titulo}`).join('\n')}\n` : ''}
TIPOS DE PIEZA:
${TIPOS_PIEZA.map(t => `- ${t.id}: ${t.definicion}`).join('\n')}

TAREA: genera exactamente ${lote.length} ideas, una por línea de esta lista y en este orden:
${lote.map((t, i) => `${i + 1}. ${t.id}`).join('\n')}
- Cada idea encaja con su tipo: si no lleva texto, no hables de guion ni de voz; si es carrusel, no hables de planos ni de vídeo
- Concretas para este negocio y este mes, no genéricas
- Sin emojis

Responde ÚNICAMENTE con este JSON:
{ "ideas": [ { "tipoPieza": "id del tipo", "titulo": "título llamativo y específico", "concepto": "de qué va, en 2-3 frases concretas", "formatoSugerido": "p. ej. Reel 30s, Carrusel 6 slides, Reel cinemático 15s", "porQueFunc": "por qué funciona para este cliente este mes" } ] }
`
    const data = await llamarIAConRetry(prompt, 0.9)
    return (data?.ideas || []).filter(i => i?.titulo).slice(0, lote.length)
      .map((i, n) => ({ titulo: i.titulo, concepto: i.concepto || '', formatoSugerido: i.formatoSugerido || '', porQueFunc: i.porQueFunc || '', tipoPieza: lote[n].id }))
  }
  for (let i = 0; i < pedidos.length; i += 15) {
    const lote = pedidos.slice(i, i + 15)
    let nuevas = await pedir(lote, ideas)
    // Si la IA se queda corta, se piden una vez las que faltan
    if (nuevas.length < lote.length) nuevas = [...nuevas, ...await pedir(lote.slice(nuevas.length), [...ideas, ...nuevas])]
    ideas.push(...nuevas)
  }
  if (ideas.length < pedidos.length) throw new Error(`La IA solo ha devuelto ${ideas.length} de ${pedidos.length} ideas. Intenta de nuevo.`)
  return ideas
}

// Rehace una idea del plan del mes (paso Guiones, #84) con lo que pide el
// gestor en «¿Qué cambiarías?». Mantiene su tipo, su formato y su mes.
export async function regenerarIdea({ idea, cliente, plan, feedback = '' }) {
  const indicaciones = [
    feedback.trim() || 'Propón una alternativa distinta sobre el mismo tema, con otro enfoque',
    tipoPiezaDe(idea) ? `Tiene que seguir siendo una pieza de tipo «${tipoPiezaDe(idea).etiqueta}»: ${tipoPiezaDe(idea).definicion}` : '',
    plan?.notas?.trim() ? `Encaja con lo que se quiere contar este mes: ${plan.notas.trim()}` : '',
  ].filter(Boolean).join('. ')
  return reescribirIdea(cliente, idea, { indicaciones, formato: esCarrusel(idea) ? 'carrusel' : 'video', sinTexto: esSinTexto(idea) })
}

export async function generarRespuestaResena(resena, cliente) {
  const rating = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[resena.starRating] || 0
  const nombre = resena.reviewer?.displayName || 'cliente'
  const tono = rating >= 4 ? 'agradecido y cercano' :
               rating === 3 ? 'comprensivo y constructivo' :
               'empático, disculpándose y ofreciendo solución'

  const prompt = `Eres el community manager de "${cliente?.nombre || 'este negocio'}", un negocio de ${cliente?.sector || 'servicios'} en ${cliente?.ubicacion || 'España'}.
Tono de la marca: ${cliente?.tono || 'cercano'}.
Energía: ${cliente?.energia || 'equilibrado'}.
${cliente?.usoEmojis === 'ninguno' ? 'PROHIBIDO usar emojis.' : cliente?.usoEmojis === 'puntual' ? 'Máximo 1 emoji.' : ''}

Responde a esta reseña de Google Business:
Puntuación: ${rating}/5 estrellas
Nombre del cliente: ${nombre}
Reseña: "${resena.comment || '(sin texto)'}"

Tono para esta respuesta: ${tono}

REGLAS:
- Personalizar con el nombre del cliente si lo tiene
- Máximo 3-4 frases
- Sonar humano, no corporativo
- Si es negativa: reconocer el problema, disculparse, ofrecer solución concreta
- Si es positiva: agradecer con personalidad, invitar a volver
- No usar frases genéricas de siempre
- Reflejar la personalidad de ${cliente?.nombre || 'la marca'}

Responde ÚNICAMENTE con JSON:
{"respuesta":"texto de la respuesta","tono_usado":"descripción del tono aplicado"}`

  return await llamarIA(prompt, 0.75)
}

export async function analizarWebNegocio(url, nombreNegocio, signal) {
  const response = await fetch(apiUrl('/api/analizar-web'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ url, nombreNegocio }),
    signal,
  })
  const data = await parseApiResponse(response)
  if (!data.success) throw new Error(data.error || 'Error desconocido')
  return data.datos
}

export async function sugerirDistribucion(cliente, ideas, mes, anio) {
  const redesActivas = Object.entries(cliente.redesDetalladas || {})
    .filter(([, r]) => r?.activa)
    .map(([k]) => k)
    .join(', ') || (Array.isArray(cliente.redes) ? cliente.redes.join(', ') : 'instagram')

  const prompt = `Tengo estas ideas guardadas para ${cliente.nombre}:
${ideas.map(i => `- ${i.titulo} (${i.formato || 'video'}) [id: ${i.id}]`).join('\n')}

El cliente tiene estas redes activas: ${redesActivas}

Sugiere cómo distribuirlas en el mes de ${mes}/${anio} de forma equilibrada y estratégica.
Usa los ids exactos de las ideas tal como aparecen arriba.
Distribuye los posts en días distintos del mes, sin agrupar varios el mismo día si es posible.

Responde ÚNICAMENTE con JSON válido:
{
  "sugerencias": [
    { "ideaId": "id_de_la_idea", "diaSugerido": 5, "red": "instagram", "razon": "Breve explicación estratégica" }
  ],
  "consejo": "Consejo general sobre la distribución del mes en una frase."
}`

  return await llamarIAConRetry(prompt, 0.7)
}

// ─── Investigación mensual (Fase 5) ───────────────────────────────────────────

function listaDeTextos(valor, max = 8) {
  if (!Array.isArray(valor)) return []
  return valor.map(v => (typeof v === 'string' ? v : v?.texto || '')).map(s => s.trim()).filter(Boolean).slice(0, max)
}

// Analiza los enlaces de referencia (competidores, cuentas, vídeos) que el
// gestor ha apuntado en la investigación del mes. El modelo NO puede abrir los
// enlaces ni ver los vídeos: se le pide que infiera solo a partir de la URL,
// la plataforma, el nombre de la cuenta y las notas del gestor, y que lo diga
// cuando no esté seguro. Devuelve { tono, patrones[], ideas_formato[], que_evitar[] }.
export async function analizarReferencias(cliente, referencias = []) {
  const refs = (referencias || [])
    .filter(r => (r?.url || '').trim() || (r?.nota || '').trim())
    .slice(0, 20)
  if (refs.length === 0) throw new Error('Añade al menos un enlace o una nota para analizar')

  const listado = refs.map((r, i) => `${i + 1}. ${(r.url || '').trim() || '(sin enlace)'}${(r.nota || '').trim() ? `\n   Nota del gestor: "${r.nota.trim()}"` : ''}`).join('\n')

  const prompt = `Eres un estratega de contenidos para redes sociales. Un social media manager está preparando la investigación mensual de su cliente y ha reunido estas referencias (competidores, cuentas que admira, vídeos concretos):

${listado}

${construirPromptCliente(cliente)}

LIMITACIÓN IMPORTANTE: no puedes abrir los enlaces ni ver los vídeos. Trabaja SOLO con lo que se puede deducir de:
- la plataforma (Instagram, TikTok, YouTube, web...) y el tipo de enlace (reel, post, perfil, short...),
- el nombre de la cuenta o el texto visible en la URL,
- las notas que ha escrito el gestor.
No inventes detalles concretos del contenido (qué se dice, qué sale en pantalla, cifras). Si algo es una suposición, dilo ("probablemente", "por el nombre de la cuenta parece..."). Si no hay información suficiente para una conclusión, dilo claramente en vez de rellenar.

TAREA: resume qué pueden aprender de estas referencias para el contenido de ${cliente?.nombre || 'este cliente'}, adaptado a su voz y su negocio (no copiar a la competencia).

Responde ÚNICAMENTE con JSON válido, en español, sin emojis:
{
  "tono": "2-3 frases sobre el tono y la voz que transmiten estas referencias y cómo encaja (o no) con el cliente",
  "patrones": ["patrón común que se deduce de las referencias", "..."],
  "ideas_formato": ["idea de formato concreta para el cliente inspirada en estas referencias", "..."],
  "que_evitar": ["algo que conviene evitar o que no encaja con el cliente", "..."]
}
Entre 3 y 6 elementos en cada lista.`

  const data = await llamarIAConRetry(prompt, 0.6)
  return {
    tono: typeof data?.tono === 'string' ? data.tono.trim() : '',
    patrones: listaDeTextos(data?.patrones),
    ideas_formato: listaDeTextos(data?.ideas_formato),
    que_evitar: listaDeTextos(data?.que_evitar),
  }
}

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// Sugiere fechas clave reales del sector del cliente para el mes indicado y
// el siguiente (España). Devuelve [{ fecha: 'YYYY-MM-DD', titulo, motivo }],
// filtrado a fechas válidas dentro de esos dos meses y ordenado.
export async function sugerirFechasSector(cliente, anio, mes) {
  const nombreMes = (a, m) => new Date(a, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const sigAnio = mes === 12 ? anio + 1 : anio
  const sigMes = mes === 12 ? 1 : mes + 1
  const pad = n => String(n).padStart(2, '0')
  const desde = `${anio}-${pad(mes)}-01`
  const hasta = `${sigAnio}-${pad(sigMes)}-${pad(new Date(sigAnio, sigMes, 0).getDate())}`
  const sector = [cliente?.sector, cliente?.sectorCustom].filter(Boolean).join(' — ') || 'no especificado'

  const prompt = `Eres un planificador de contenidos para redes sociales en España.

CLIENTE: ${cliente?.nombre || 'sin nombre'}
SECTOR: ${sector}
UBICACIÓN: ${cliente?.ubicacion || 'España'}
DESCRIPCIÓN: ${cliente?.descripcion || 'no disponible'}

TAREA: lista las fechas clave relevantes para este cliente en ${nombreMes(anio, mes)} y ${nombreMes(sigAnio, sigMes)} (del ${desde} al ${hasta}, ambos incluidos): festivos nacionales de España, días internacionales o mundiales relacionados con su sector, fechas comerciales (rebajas, Black Friday, San Valentín, Día de la Madre...), temporadas y eventos muy conocidos que le sirvan para planificar contenido. Si su ubicación tiene un festivo local o autonómico muy conocido, inclúyelo.

REGLAS ESTRICTAS:
- Solo fechas REALES y ampliamente conocidas. No inventes días internacionales ni eventos.
- Las fechas móviles (Semana Santa, Día de la Madre, Black Friday, Carnaval...) deben llevar el día correcto para el año ${anio}${sigAnio !== anio ? ` o ${sigAnio}` : ''}. Si no estás seguro del día exacto, NO la incluyas.
- Todas las fechas entre ${desde} y ${hasta}. Formato YYYY-MM-DD.
- Entre 4 y 12 fechas, priorizando las más útiles para este sector.
- "motivo": una frase sobre por qué le sirve a este cliente y qué tipo de contenido encaja. Sin emojis.

Responde ÚNICAMENTE con JSON válido:
{ "fechas": [ { "fecha": "YYYY-MM-DD", "titulo": "nombre de la fecha", "motivo": "por qué le sirve" } ] }`

  const data = await llamarIAConRetry(prompt, 0.3)
  const lista = Array.isArray(data) ? data : (Array.isArray(data?.fechas) ? data.fechas : [])
  const vistas = new Set()
  return lista
    .map(f => ({
      fecha: String(f?.fecha || '').trim(),
      titulo: String(f?.titulo || '').trim(),
      motivo: String(f?.motivo || '').trim(),
    }))
    .filter(f => {
      if (!FECHA_ISO_RE.test(f.fecha) || !f.titulo) return false
      if (f.fecha < desde || f.fecha > hasta) return false
      // Descarta días imposibles (p. ej. 2026-02-30)
      const [a, m, d] = f.fecha.split('-').map(Number)
      const dt = new Date(a, m - 1, d)
      if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false
      const clave = `${f.fecha}|${f.titulo.toLowerCase()}`
      if (vistas.has(clave)) return false
      vistas.add(clave)
      return true
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ─── Voz del cliente desde reseñas ────────────────────────────────────────────

// Reseñas de Google Maps del negocio a partir de su enlace (server.js →
// /api/resenas-google). El error lleva `codigo` ('sin_clave', 'enlace_no_valido',
// 'sin_sitio', 'error_google') para que la UI ofrezca pegar el texto a mano.
export async function obtenerResenasGoogle(url) {
  const response = await fetch(apiUrl('/api/resenas-google'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ url }),
  })
  let data = {}
  try { data = await response.json() } catch { /* cuerpo vacío o HTML: se trata abajo */ }
  if (!response.ok) {
    const error = new Error(data.error || `Error del servidor (HTTP ${response.status})`)
    error.codigo = data.codigo || null
    throw error
  }
  return data
}

const normalizarParaComparar = t => (t || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

// Saca de un bloque de reseñas las frases más útiles como "Voz del cliente".
// Solo se aceptan fragmentos que aparecen tal cual en las reseñas: si la IA
// reescribe o inventa una frase, se descarta.
export async function extraerVozDeResenas(cliente, textoResenas) {
  const texto = (textoResenas || '').trim().slice(0, 20000)
  if (!texto) return []
  const prompt = `
Eres analista de marketing. Estas son reseñas reales de clientes de ${cliente?.nombre || 'un negocio'} (${cliente?.sector || 'sector no indicado'}).

RESEÑAS:
"""
${texto}
"""

Extrae las frases más útiles para crear contenido que convenza a futuros clientes. Clasifica cada una en un tipo:
- "motivo": por qué eligieron este negocio o por qué vuelven
- "problema": cómo describen el problema o la situación que tenían antes
- "deseo": qué querían conseguir
- "duda": miedos o dudas que tenían antes de ir
- "elogio": lo que dicen del resultado o de la experiencia

Reglas:
- Copia cada frase LITERALMENTE de las reseñas, palabra por palabra, sin corregirla ni resumirla. Puedes cortar un fragmento de una frase más larga.
- Entre 5 y 30 palabras por frase.
- Descarta frases genéricas sin contenido ("todo genial", "muy recomendable", "100% recomendable") y nombres de empleados.
- Máximo 15 frases; prioriza las específicas y las de "motivo", "problema" y "duda".

Responde ÚNICAMENTE con JSON válido:
{"frases": [{"tipo": "motivo", "texto": "fragmento literal"}]}`

  const data = await llamarIAConRetry(prompt, 0.2)
  const fuente = normalizarParaComparar(texto)
  const vistas = new Set()
  return (Array.isArray(data?.frases) ? data.frases : [])
    .map(f => ({ tipo: f?.tipo, texto: String(f?.texto || '').trim().replace(/^["“«]+|["”»]+$/g, '') }))
    .filter(f => {
      const clave = normalizarParaComparar(f.texto)
      if (clave.split(' ').length < 3 || !fuente.includes(clave) || vistas.has(clave)) return false
      vistas.add(clave)
      return true
    })
}

// ─── Secuencias de historias (con fotos) ────────────────────────────────────
// Claude ve las fotos (ya reducidas en el navegador) y propone una secuencia
// de historias: orden, plantilla, textos y un sticker sugerido para añadir a
// mano en Instagram. Usa la voz del cliente, su estética y lo que ya se ha
// publicado o hecho en secuencias anteriores para no repetirse.

export const PLANTILLAS_HISTORIA = ['portada', 'foto_texto', 'texto', 'cita', 'cta']
export const FONDOS_HISTORIA = ['primario', 'secundario', 'acento', 'oscuro', 'claro']
export const STICKERS_HISTORIA = ['ninguno', 'encuesta', 'pregunta', 'cuenta_atras', 'enlace', 'deslizador']

export async function generarSecuenciaHistorias(cliente, { objetivo, fotos = [], numHistorias = null, anteriores = [], postsRecientes = [] } = {}) {
  const iv = cliente.identidadVisual || {}
  const estetica = [
    iv.estiloTipografia && `Tipografía: ${iv.estiloTipografia}${iv.fuenteEspecifica ? ` (${iv.fuenteEspecifica})` : ''}`,
    iv.estetica?.length && `Estética: ${iv.estetica.join(', ')}`,
    iv.referenciaEstetica && `Referencia estética: ${iv.referenciaEstetica}`,
  ].filter(Boolean).join('\n')
  const yaHecho = anteriores.length
    ? `\nSECUENCIAS DE HISTORIAS ANTERIORES (no repitas enfoques ni frases):\n${anteriores.map(a => `- ${a.titulo}: ${a.titulares.filter(Boolean).join(' / ')}`).join('\n')}`
    : ''
  const recientes = postsRecientes.length
    ? `\nÚLTIMAS PUBLICACIONES DEL CALENDARIO (para conectar con ellas o no solaparse):\n${postsRecientes.map(t => `- ${t}`).join('\n')}`
    : ''

  const prompt = `${SYSTEM_PROMPT}

${construirPromptCliente(cliente)}
${estetica ? `\nIDENTIDAD VISUAL:\n${estetica}` : ''}${yaHecho}${recientes}

TAREA: crea una SECUENCIA DE HISTORIAS de Instagram para este negocio usando las ${fotos.length} fotos de arriba (numeradas desde 0).
OBJETIVO DE LA SECUENCIA: "${objetivo || 'Contar algo del negocio y generar interacción'}"
${numHistorias ? `NÚMERO DE HISTORIAS: exactamente ${numHistorias}.` : 'NÚMERO DE HISTORIAS: entre 3 y 7, lo que pida la historia que cuentas.'}

REGLAS:
- Una secuencia cuenta una sola historia con principio (gancho), desarrollo y cierre (CTA o pregunta). Cada historia se lee en 3 segundos.
- Mira las fotos: elige el orden que mejor cuente la historia, usa cada foto como mucho una vez y describe lo que se ve con detalle real (no inventes platos, productos ni personas que no aparezcan).
- Puedes incluir historias sin foto (plantilla "texto" o "cta") para el gancho o el cierre.
- titular: máximo 7 palabras. texto: máximo 22 palabras, puede ir vacío. Respeta mayúsculas/minúsculas y emojis según el perfil del cliente.
- Plantillas: "portada" (foto a pantalla completa con titular grande), "foto_texto" (foto arriba y bloque de texto abajo), "texto" (fondo de color, solo texto), "cita" (foto oscurecida con una frase entre comillas), "cta" (fondo de color con la llamada a la acción final).
- fondo: color de marca para el bloque de texto o el fondo: "primario", "secundario", "acento", "oscuro" o "claro". Alterna para que la secuencia tenga ritmo pero se vea de la misma marca.
- sticker: el sticker interactivo que conviene añadir a mano en Instagram en esa historia ("encuesta", "pregunta", "cuenta_atras", "enlace", "deslizador" o "ninguno") y su texto. Usa 1 o 2 en toda la secuencia, no en todas.

JSON exacto, sin texto fuera:
{
  "titulo": "Nombre corto de la secuencia",
  "historias": [
    { "foto": 0, "plantilla": "portada", "fondo": "primario", "titular": "…", "texto": "…", "sticker": { "tipo": "ninguno", "texto": "" } }
  ]
}`

  const response = await fetch(apiUrl('/api/claude-vision'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ prompt, imagenes: fotos }),
  })
  const raw = await parseApiResponse(response)
  const datos = extraerJSON(raw.text)
  const historias = (Array.isArray(datos?.historias) ? datos.historias : []).map(h => ({
    foto: Number.isInteger(h.foto) && h.foto >= 0 && h.foto < fotos.length ? h.foto : null,
    plantilla: PLANTILLAS_HISTORIA.includes(h.plantilla) ? h.plantilla : (Number.isInteger(h.foto) ? 'foto_texto' : 'texto'),
    fondo: FONDOS_HISTORIA.includes(h.fondo) ? h.fondo : 'primario',
    titular: String(h.titular || '').trim(),
    texto: String(h.texto || '').trim(),
    sticker: {
      tipo: STICKERS_HISTORIA.includes(h.sticker?.tipo) ? h.sticker.tipo : 'ninguno',
      texto: String(h.sticker?.texto || '').trim(),
    },
  }))
  // Una plantilla con foto sin foto asignada se queda como texto.
  for (const h of historias) if (h.foto === null && ['portada', 'foto_texto', 'cita'].includes(h.plantilla)) h.plantilla = 'texto'
  if (!historias.length) throw new Error('La IA no ha devuelto ninguna historia. Prueba otra vez.')
  return { titulo: String(datos.titulo || 'Secuencia de historias').trim(), historias }
}

// ─── Horas sugeridas para publicar ──────────────────────────────────────────
// La IA propone las dos mejores horas para una publicación concreta (día de la
// semana, formato, tema): una de mañana (hasta las 17:00) y otra de tarde-noche,
// y cuál de las dos es mejor, según el negocio y su público y, si hay, los
// datos reales de sus últimas publicaciones (hora de publicación → alcance).
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function sugerirHoraPublicacion(cliente, { fecha, tipo, titulo = '', historial = [] }) {
  const [y, m, d] = String(fecha).split('-').map(Number)
  const diaSemana = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long' })
  const datos = historial.length
    ? `\nDATOS REALES DE SUS ÚLTIMAS PUBLICACIONES EN INSTAGRAM (día y hora de Madrid → alcance):\n${historial.map(h => `- ${h.cuando} · ${h.tipo} → ${h.alcance ?? '—'} de alcance`).join('\n')}`
    : ''
  const prompt = `${SYSTEM_PROMPT}

${construirPromptCliente(cliente)}
${datos}

TAREA: sugiere las DOS MEJORES HORAS para publicar en Instagram esta pieza, una de mañana y otra de tarde:
- Día: ${diaSemana} ${fecha}
- Formato: ${tipo}
- Tema: ${titulo || 'sin título'}

- "manana": la mejor hora entre las 06:00 y las 16:59.
- "tarde": la mejor hora entre las 17:00 y las 23:59.
- "mejor": cuál de las dos recomiendas para este día ("manana" o "tarde").

Zona horaria: Europe/Madrid. Ten en cuenta el sector, el horario y la ubicación del negocio, cuándo está su público con el móvil (y cuándo decide comprar o reservar), el día de la semana y el formato (las historias funcionan bien a primera hora y por la noche; los reels cuando hay más tiempo libre). Si hay datos reales, priorízalos.

JSON exacto: { "manana": { "hora": "HH:MM", "motivo": "Una frase corta con el porqué" }, "tarde": { "hora": "HH:MM", "motivo": "Una frase corta con el porqué" }, "mejor": "manana" | "tarde" }`
  const res = await llamarIAConRetry(prompt, 0.3)
  const franja = (f, desde, hasta) => {
    const hora = String(res?.[f]?.hora || '').trim()
    if (!HORA_RE.test(hora) || hora < desde || hora > hasta) return null
    return { hora, motivo: String(res?.[f]?.motivo || '').trim() }
  }
  const manana = franja('manana', '06:00', '16:59')
  const tarde = franja('tarde', '17:00', '23:59')
  if (!manana && !tarde) throw new Error('La IA no ha devuelto una hora válida')
  const mejor = (res?.mejor === 'tarde' && tarde) || !manana ? 'tarde' : 'manana'
  return { manana, tarde, mejor }
}

// ─── Estudio de vídeo con IA ────────────────────────────────────────────────
// La IA "ve" el vídeo por fotogramas (utils/fotogramasVideo.js) y, si ya está
// publicado, lo cruza con sus métricas reales y la media de los reels de la
// cuenta. Sin métricas es un estudio previo a publicar.
const VALORACIONES_GANCHO = ['fuerte', 'medio', 'débil']

export async function estudiarVideo(cliente, { fotogramas, duracion, texto = '', metricas = null, media = null }) {
  const seg = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`)
  const n = (v) => (v == null ? '—' : Number(v).toLocaleString('es-ES'))
  const datos = metricas ? `
MÉTRICAS REALES DE ESTE VÍDEO EN INSTAGRAM:
- Visualizaciones: ${n(metricas.visualizaciones)} · Alcance: ${n(metricas.alcance)}
- Me gusta: ${n(metricas.meGusta)} · Comentarios: ${n(metricas.comentarios)} · Guardados: ${n(metricas.guardados)} · Compartidos: ${n(metricas.compartidos)}
- Tiempo medio visto: ${seg(metricas.vistoMedioMs)} de ${duracion.toFixed(1)} s · Porcentaje de gente que lo saltó en los primeros segundos: ${metricas.saltos == null ? '—' : `${metricas.saltos}%`}
${media ? `MEDIA DE LOS REELS DE LA CUENTA (${media.n} reels): ${n(media.visualizaciones)} visualizaciones · ${n(media.alcance)} alcance · ${seg(media.vistoMedioMs)} visto de media · ${media.saltos == null ? '—' : `${media.saltos}%`} de saltos · ${media.tasaInteraccion == null ? '—' : `${media.tasaInteraccion}%`} de interacción sobre alcance` : ''}
Compara SIEMPRE con la media: di si está por encima o por debajo y explica por qué, apoyándote en lo que ves en los fotogramas.` : `
Este vídeo TODAVÍA NO SE HA PUBLICADO: es un estudio previo. Predice cómo funcionará y qué cambiar antes de publicarlo.`

  const prompt = `${SYSTEM_PROMPT}

${cliente ? construirPromptCliente(cliente) : ''}

Eres además un analista de vídeo corto (Reels, TikTok) muy exigente. Las imágenes de arriba son fotogramas de UN vídeo vertical de ${duracion.toFixed(1)} segundos, en orden:
${fotogramas.map((f, i) => `- Foto ${i} = segundo ${f.segundo}`).join('\n')}
Los primeros fotogramas (hasta el segundo 3) son el GANCHO: lo que decide si la gente se queda o pasa.
${texto ? `\nTEXTO DE LA PUBLICACIÓN (caption): "${String(texto).slice(0, 600)}"` : ''}
${datos}

REGLAS:
- Describe solo lo que se ve de verdad en los fotogramas (planos, personas, producto, texto en pantalla, luz, ritmo de cambios de plano). No inventes audio ni diálogo: no lo oyes.
- Sé concreto y accionable, como un director creativo que revisa el vídeo con el cliente. Nada genérico tipo "mejora la calidad".
- Cada punto en una frase corta. Español de España.

JSON exacto, sin texto fuera:
{
  "nota": 7,
  "veredicto": "Una frase con la conclusión principal",
  "gancho": { "valoracion": "fuerte", "analisis": "Qué pasa en los 3 primeros segundos y por qué engancha o no", "alternativas": ["Otro gancho concreto", "Otro más"] },
  "ritmo": "Cómo evoluciona el vídeo: cambios de plano, momentos muertos, dónde se puede caer la gente",
  "visual": "Encuadre, luz, texto en pantalla, legibilidad dentro de la zona segura de Instagram",
  "funciona": ["…", "…"],
  "mejorar": ["…", "…", "…"],
  "siguienteVideo": "Una idea concreta de próximo vídeo que aproveche lo aprendido"
}`

  const response = await fetch(apiUrl('/api/claude-vision'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ prompt, imagenes: fotogramas.map(f => ({ mediaType: f.mediaType, data: f.data })), maxTokens: 4000 }),
  })
  const raw = await parseApiResponse(response)
  const r = extraerJSON(raw.text)
  const lista = (v) => (Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean) : [])
  const nota = Math.round(Number(r?.nota))
  if (!r?.veredicto && !r?.gancho) throw new Error('La IA no ha devuelto el estudio. Prueba otra vez.')
  return {
    nota: Number.isFinite(nota) ? Math.min(10, Math.max(1, nota)) : null,
    veredicto: String(r.veredicto || '').trim(),
    gancho: {
      valoracion: VALORACIONES_GANCHO.includes(r.gancho?.valoracion) ? r.gancho.valoracion : null,
      analisis: String(r.gancho?.analisis || '').trim(),
      alternativas: lista(r.gancho?.alternativas),
    },
    ritmo: String(r.ritmo || '').trim(),
    visual: String(r.visual || '').trim(),
    funciona: lista(r.funciona),
    mejorar: lista(r.mejorar),
    siguienteVideo: String(r.siguienteVideo || '').trim(),
  }
}
